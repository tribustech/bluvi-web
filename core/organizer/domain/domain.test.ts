import { describe, expect, it } from 'vitest';
import { organizerCompetitionSchema } from '../schemas';
import { competitionDoc, weighingByStand, weighingDetail } from '../fixtures.test-data';
import {
  buildCompetitionPayload,
  createCompetitionSchema,
  formatAutoSaveLabel,
  getCompetitionEditRiskMessage,
  getDateConstraintUpdates,
  getGeneralPriorityMetric,
  getStandCapacityWarning,
  mapCompetitionToFormData,
  mapDraftToFormData,
  parseTierSizesInput,
  shouldAttemptAutoSave,
} from './createCompetition';
import { flattenPages, isOrganizerProfile, normalizePaginatedResponse } from './organizer';
import { findSectorForStand, penaltyFormSchema, supportsPenalties, toCreatePenaltyParams } from './penalties';
import { htmlToStrapiBlocks, strapiBlocksToHtml } from './richText';
import {
  applyOptimisticCatches,
  applyReopenToWeighings,
  groupRevisionsBySession,
  isOptimisticCatchId,
  splitWeightWithScaleConstraint,
  sumWeighingsTotal,
} from './weighing';
import { weighingDetailSchema } from '../schemas';

describe('rich text', () => {
  it('round-trips paragraphs, headings, lists and marks', () => {
    const html = '<h2>Premii</h2><p>Loc <strong>1</strong> și <em>2</em></p><ul><li><p>Crap</p></li><li>Știucă</li></ul><ol><li>A</li></ol>';
    const blocks = htmlToStrapiBlocks(html);
    expect(blocks?.[0]).toEqual({ type: 'heading', level: 2, children: [{ type: 'text', text: 'Premii' }] });
    expect(blocks?.[1].children).toEqual([
      { type: 'text', text: 'Loc ' },
      { type: 'text', text: '1', bold: true },
      { type: 'text', text: ' și ' },
      { type: 'text', text: '2', italic: true },
    ]);
    expect(strapiBlocksToHtml(blocks)).toBe(
      '<h2>Premii</h2><p>Loc <strong>1</strong> și <em>2</em></p><ul><li>Crap</li><li>Știucă</li></ul><ol><li>A</li></ol>'
    );
  });

  it('handles multi-line content and nested marks', () => {
    expect(htmlToStrapiBlocks('<p>a\nb <strong><em>x</em></strong></p>')?.[0].children).toEqual([
      { type: 'text', text: 'a\nb ' },
      { type: 'text', text: 'x', bold: true, italic: true },
    ]);
    expect(htmlToStrapiBlocks('  ')).toBeNull();
    expect(strapiBlocksToHtml(null)).toBe('');
    expect(strapiBlocksToHtml([{ type: 'paragraph', children: [{ type: 'text', text: '<a&b>' }] }])).toBe('<p>&lt;a&amp;b&gt;</p>');
  });
});

describe('create-competition wizard', () => {
  it('validates the relaxed form rules', () => {
    expect(createCompetitionSchema.safeParse({ name: 'ab' }).success).toBe(false);
    expect(createCompetitionSchema.safeParse({ name: 'Cupa', teamParticipants: '11' }).success).toBe(false);
    expect(createCompetitionSchema.safeParse({ name: 'Cupa', registerFee: '50001' }).success).toBe(false);
    expect(createCompetitionSchema.safeParse({ name: 'Cupa', bestOfFishCount: '0' }).success).toBe(false);
    expect(createCompetitionSchema.safeParse({ name: 'Cupa', participantsLimit: '', registerFee: '0' }).success).toBe(true);
  });

  it('builds the draft payload like fish', () => {
    const payload = buildCompetitionPayload({
      name: 'Cupa',
      competitionType: 'single',
      participantsLimit: '20',
      registerFee: '',
      rankingType: 'quantity',
      lake: 'l1',
      startDate: '2026-05-08T14:00:00.000Z',
      description: '<p>Hi</p>',
      reward: '',
      banner: 'file:///x.jpg',
      sectors: [{ name: 'A', minFishNumber: 1 }],
      standAllocations: { A: ['s1', ' ', 's2'] },
      sponsorIds: [],
      fishSpeciesIds: ['f1'],
    });
    expect(payload).toEqual({
      name: 'Cupa',
      competitionType: 'single',
      participantsLimit: '20',
      rankingType: 'quantity',
      lake: 'l1',
      startDate: '2026-05-08T14:00:00.000Z',
      registrationDeadline: '2026-05-08T14:00:00.000Z',
      description: [{ type: 'paragraph', children: [{ type: 'text', text: 'Hi' }] }],
      draftMeta: {
        sectors: [{ name: 'A', minFishNumber: 1 }],
        standAllocations: { A: ['s1', 's2'] },
        sponsorIds: [],
        fishSpeciesIds: ['f1'],
        completedSteps: [1, 2, 3, 4, 5],
      },
    });
  });

  it('hydrates a draft from draftMeta and a competition from its relations', () => {
    const draft = organizerCompetitionSchema.parse(competitionDoc);
    expect(mapDraftToFormData(draft)).toMatchObject({
      name: 'Cupa Bluvi',
      description: '<p>Descriere</p>',
      registerFee: '300',
      participantsLimit: '20',
      lake: 's84u55lo4n9z0emngozttt6e',
      banner: 'https://x/banner.jpg',
      sectors: [{ name: 'A', minFishNumber: 1 }],
      standAllocations: { A: ['s1', 's2'] },
      fishSpeciesIds: ['f1'],
    });
    expect(
      mapCompetitionToFormData({
        name: 'X',
        sectors: [{ name: 'A', minFishNumber: null, stands: [{ documentId: 's1' }, { documentId: null }] }],
        fishType: [{ documentId: 'f1' }],
        sponsors: [{ documentId: 'sp' }],
      })
    ).toMatchObject({
      competitionType: 'single',
      sectors: [{ name: 'A', minFishNumber: 1 }],
      standAllocations: { A: ['s1'] },
      fishSpeciesIds: ['f1'],
      sponsorIds: ['sp'],
    });
  });

  it('keeps dates consistent', () => {
    const current = { startDate: '2026-05-08T10:00:00Z', endDate: '2026-05-09T10:00:00Z', registrationDeadline: '2026-05-08T10:00:00Z' };
    expect(getDateConstraintUpdates(current, 'startDate', '2026-05-10T10:00:00Z')).toEqual({
      startDate: '2026-05-10T10:00:00Z',
      endDate: '2026-05-10T10:00:00Z',
      registrationDeadline: '2026-05-10T10:00:00Z',
    });
    expect(getDateConstraintUpdates(current, 'endDate', '2026-05-07T10:00:00Z')).toMatchObject({ startDate: '2026-05-07T10:00:00Z' });
  });

  it('warns on missing stands, parses tiers, picks metrics and risk copy', () => {
    expect(getStandCapacityWarning(5, { A: ['s1', 's1', 's2'] })).toEqual({ configuredStands: 2, participantsLimit: 5, missingSlots: 3 });
    expect(getStandCapacityWarning(2, { A: ['s1', 's2'] })).toBeNull();
    expect(parseTierSizesInput('9,7,5,3')).toEqual({ tiers: [9, 7, 5, 3], error: null });
    expect(parseTierSizesInput('3,5').error).toMatch(/descrescător/);
    expect(parseTierSizesInput('').tiers).toBeNull();
    expect(getGeneralPriorityMetric('quantityQuality', 'bySectorPositionPerisReversed')).toBe('quality');
    expect(getCompetitionEditRiskMessage('LAKE_CHANGED_WITH_ALLOCATIONS')).toMatch(/lacului/);
    expect(getCompetitionEditRiskMessage('NEW')).toMatch(/Revizuiește/);
  });

  it('gates and labels auto-save', () => {
    const ok = { isOnline: true, isEditCompetitionMode: false, name: 'Cupa', isDirty: true, isInFlight: false };
    expect(shouldAttemptAutoSave(ok)).toBe(true);
    expect(shouldAttemptAutoSave({ ...ok, name: ' ab ' })).toBe(false);
    expect(shouldAttemptAutoSave({ ...ok, isEditCompetitionMode: true })).toBe(false);
    expect(formatAutoSaveLabel({ status: 'saved', at: new Date(2026, 0, 1, 9, 5) })).toEqual({ icon: 'saved', text: 'Salvat la 09:05' });
    expect(formatAutoSaveLabel({ status: 'idle' })).toBeNull();
  });
});

describe('organizer helpers', () => {
  it('detects the organizer role and flattens pages', () => {
    expect(isOrganizerProfile({ role: { name: 'Organizer' } })).toBe(true);
    expect(isOrganizerProfile({ role: { name: 'Authenticated' } })).toBe(false);
    expect(flattenPages({ pages: [{ data: [1, 2] }, { data: [3] }] })).toEqual([1, 2, 3]);
  });

  it('fills missing pagination', () => {
    expect(normalizePaginatedResponse({ data: [1, 2, 3], meta: { pagination: { total: 12 } } }, { page: 1, pageSize: 5 }).meta.pagination).toEqual({
      page: 1,
      pageSize: 5,
      total: 12,
      pageCount: 3,
    });
  });
});

describe('weighing helpers', () => {
  it('totals catches to 3 decimals', () => {
    expect(sumWeighingsTotal([weighingByStand, { catches: [] }])).toBe('19.600');
  });

  it('splits weight on the scale unit', () => {
    const parts = splitWeightWithScaleConstraint(10, 3);
    expect(parts).toHaveLength(3);
    expect(parts.reduce((a, b) => a + b, 0)).toBeCloseTo(10, 3);
    expect(parts.slice(1)).toEqual([3.325, 3.325]);
  });

  it('groups revisions and applies optimistic updates', () => {
    const rev = (sessionId: number) => ({ sessionId }) as never;
    expect(groupRevisionsBySession([rev(1), rev(2), rev(1)])).toEqual({ 1: [rev(1), rev(1)], 2: [rev(2)] });
    expect(groupRevisionsBySession(undefined)).toEqual({});

    const detail = weighingDetailSchema.parse(weighingDetail);
    const next = applyOptimisticCatches(detail, [{ weight: 1, fishType: 'f' }, { weight: 2, fishType: 'f' }], 'Crap');
    expect(next.catches.map(c => c.documentId).slice(0, 2)).toEqual(['optimistic-catch-0', 'optimistic-catch-1']);
    expect(isOptimisticCatchId(next.catches[0].documentId)).toBe(true);
    expect(isOptimisticCatchId(next.catches[2].documentId)).toBe(false);

    const list = [{ ...weighingByStand } as never, { ...weighingByStand, documentId: 'other' } as never];
    expect(applyReopenToWeighings(list, weighingByStand.documentId).map(w => w.weighingStatus)).toEqual(['started', 'finished']);
    expect(applyReopenToWeighings(undefined, 'x')).toEqual([]);
  });
});

describe('penalties', () => {
  it('only quantity rankings support penalties', () => {
    expect(supportsPenalties('quantity')).toBe(true);
    expect(supportsPenalties('quality')).toBe(false);
    expect(supportsPenalties(null)).toBe(false);
  });

  it('validates the form and builds the request', () => {
    expect(penaltyFormSchema.safeParse({ action: 'DEDUCT_TOTAL_WEIGHT', value: '0', reason: 'Nada ilegala' }).success).toBe(false);
    expect(penaltyFormSchema.safeParse({ action: 'WARNING', reason: 'abc' }).success).toBe(false);
    const values = penaltyFormSchema.parse({ action: 'DEDUCT_TOTAL_WEIGHT', value: ' 1,5 ', reason: ' Nada ilegala ' });
    expect(toCreatePenaltyParams(values, { competitionId: 'c', registrationId: 'r' })).toEqual({
      competitionId: 'c',
      registrationId: 'r',
      action: 'DEDUCT_TOTAL_WEIGHT',
      value: 1.5,
      reason: 'Nada ilegala',
    });
    expect(toCreatePenaltyParams({ action: 'WARNING', value: '3', reason: 'Motiv' }, { competitionId: 'c', registrationId: 'r' }).value).toBeUndefined();
    const sectors = [{ name: 'A', stands: [{ id: 1, documentId: 's1' }] }];
    expect(findSectorForStand(sectors, 's1')?.name).toBe('A');
  });
});
