import { describe, expect, it } from 'vitest';
import { buildCompetitionPayload, createCompetitionDefaultValues, getCompletedSteps, mapDraftToFormData } from './createCompetition';
import {
  buildTimeoutRecovery,
  CREATE_COMPETITION_PUBLISH_JOKES,
  EDIT_BLOCKING_VALIDATION_CODES,
  getCreateCompetitionPublishJoke,
  getCreateCompetitionPublishStatus,
  getEditSavedMessage,
  getOperationCaption,
  getOperationStatusText,
  getSaveActionLabel,
  OPERATION_TIMEOUT_MS,
  PUBLISH_JOKE_INTERVAL_MS,
} from './publishFeedback';
import {
  DISABLED_RANKING_TYPES,
  getGeneralRankingOptions,
  getGeneralRankingWinnerModeLabel,
  getMaxSectors,
  getRankingTypeLabel,
  getSectorPriorityOptions,
  hasGeneralRankingWinnerMode,
  hasGridRule,
  normalizeGeneralRankingWinnerMode,
  normalizeGridRule,
  RANKING_TYPES,
  requiresMinFishNumber,
} from './rankingConfig';
import {
  getGeneralModeGroupExplanation,
  getGeneralRankingModeExplanation,
  getGridRuleExplanation,
  getRankingExplanation,
  RANKING_EXPLANATIONS,
} from './rankingExplanations';
import type { DraftCompetition } from '../schemas';

/* fish helpers/rankingConfig.ts + step-ranking.tsx lists */
describe('rankingConfig', () => {
  it('lists fish\'s 11 ranking types in order, national / FIPSed not selectable', () => {
    expect(RANKING_TYPES.map(t => t.value)).toEqual([
      'quantity',
      'quality',
      'quantityQuality',
      'qualityQuantity',
      'calitateCalitate',
      'calitateCantitateCMMC',
      'bestOf',
      'bestOfTiers',
      'feederRounds',
      'nationalChampionship',
      'fipsed',
    ]);
    expect([...DISABLED_RANKING_TYPES]).toEqual(['nationalChampionship', 'fipsed']);
    expect(getRankingTypeLabel('feederRounds')).toBe('Feeder (FIPS)');
    expect(getRankingTypeLabel('unknownType')).toBe('unknownType');
    expect(getRankingTypeLabel(undefined)).toBeUndefined();
  });

  it('requiresMinFishNumber only for the quality-based types', () => {
    for (const t of ['quality', 'quantityQuality', 'qualityQuantity', 'calitateCalitate', 'calitateCantitateCMMC']) {
      expect(requiresMinFishNumber(t)).toBe(true);
    }
    for (const t of ['quantity', 'bestOf', 'bestOfTiers', 'feederRounds', 'fipsed', null, undefined]) {
      expect(requiresMinFishNumber(t)).toBe(false);
    }
  });

  it('caps sectors at 3 for national / FIPSed, else 24', () => {
    expect(getMaxSectors('nationalChampionship')).toBe(3);
    expect(getMaxSectors('fipsed')).toBe(3);
    expect(getMaxSectors('quantity')).toBe(24);
    expect(getMaxSectors(undefined)).toBe(24);
  });

  it('general ranking modes: supported types, perisReversed only for the composite ones', () => {
    expect(hasGeneralRankingWinnerMode('bestOf')).toBe(false);
    expect(getGeneralRankingOptions('bestOf')).toEqual([]);
    expect(getGeneralRankingOptions('quantity').map(o => o.value)).toEqual(['bySectorPosition', 'byPoints']);
    expect(getGeneralRankingOptions('qualityQuantity').map(o => o.value)).toEqual([
      'bySectorPosition',
      'byPoints',
      'bySectorPositionPerisReversed',
    ]);
    expect(getGeneralRankingOptions('quality')[0].label).toBe('După poziția în sector, primează Calitatea');
    expect(getGeneralRankingWinnerModeLabel('bySectorPositionPerisReversed', 'quantityQuality')).toBe(
      'După poziția în sector, primează Calitatea',
    );
    expect(getGeneralRankingWinnerModeLabel('bySectorPositionPerisReversed', 'quantity')).toBe('Poziție sector (inversată)');
    expect(getGeneralRankingWinnerModeLabel('byPoints', 'quality')).toBe('După punctaj');
    expect(getSectorPriorityOptions('quantityQuality')).toHaveLength(2);
    expect(getSectorPriorityOptions('quantity')[0].label).toBe('Primează cantitatea pe sector, cantitatea la general');
  });

  it('normalizes the general mode and the grid rule like fish', () => {
    expect(normalizeGeneralRankingWinnerMode(undefined, 'quantity')).toBe('bySectorPosition');
    expect(normalizeGeneralRankingWinnerMode('byPoints', 'quantity')).toBe('byPoints');
    expect(normalizeGeneralRankingWinnerMode('bySectorPositionPerisReversed', 'quantity')).toBe('bySectorPosition');
    expect(normalizeGeneralRankingWinnerMode('byPoints', 'bestOf')).toBeUndefined();
    expect(hasGridRule('quality')).toBe(true);
    expect(hasGridRule('calitateCalitate')).toBe(false);
    expect(normalizeGridRule('average', 'quality')).toBe('average');
    expect(normalizeGridRule('nope', 'quality')).toBe('catchCount');
    expect(normalizeGridRule('average', 'quantity')).toBeUndefined();
  });
});

/* fish constants/*Explanation*.ts */
describe('rankingExplanations', () => {
  it('has one explanation per ranking type, «Necunoscut» otherwise', () => {
    for (const t of RANKING_TYPES) expect(RANKING_EXPLANATIONS[t.value]?.sections.length).toBeGreaterThan(0);
    expect(getRankingExplanation('quantity').title).toBe('⚖️ Cantitate');
    expect(getRankingExplanation('x')).toEqual({ title: 'Necunoscut', sections: [{ body: 'Tip de clasament necunoscut.' }] });
  });

  it('never says «capot» (owner rule 11)', () => {
    const all = JSON.stringify([
      RANKING_EXPLANATIONS,
      RANKING_TYPES.map(t => getGeneralModeGroupExplanation(t.value)),
      ['quality', 'quantityQuality', 'qualityQuantity'].map(getGridRuleExplanation),
    ]);
    expect(all.toLowerCase()).not.toContain('capot');
    expect(RANKING_EXPLANATIONS.nationalChampionship.sections.map(s => s.heading)).toContain('Echipe fără capturi');
  });

  it('general mode explanations per type × mode, and the grouped sheet', () => {
    expect(getGeneralRankingModeExplanation('quantity', 'byPoints')?.title).toBe('🔢 După punctaj');
    expect(getGeneralRankingModeExplanation('bestOf', 'byPoints')).toBeUndefined();
    const group = getGeneralModeGroupExplanation('quantityQuality');
    expect(group?.title).toBe('Cum funcționează departajarea la Cantitate/Calitate');
    expect(group?.sections.map(s => s.heading)).toEqual([
      '1. 📊 După poziția în sector',
      '1.1 ⚖️ După poziția în sector, primează Cantitatea',
      '1.2 🐟 După poziția în sector, primează Calitatea',
      '2. 🔢 După punctaj',
    ]);
    expect(group?.sections[1].body.startsWith('Cum funcționează:\n')).toBe(true);
    expect(group?.sections[1].body).toContain('\n\nExemplu concret:\n');
    expect(getGeneralModeGroupExplanation('bestOf')).toBeUndefined();
  });

  it('grid rule explanation adds the composite notes', () => {
    const q = getGridRuleExplanation('quality');
    expect(q.title).toBe('🔀 Regula departajare standuri fără grilă');
    expect(q.sections.map(s => s.heading)).toContain('Exemplu concret — La Calitate');
    const qq = getGridRuleExplanation('qualityQuantity');
    expect(qq.sections[1].body).toContain('regula afectează doar punctajul de calitate');
  });
});

/* fish helpers/createCompetitionPublishFeedback.ts + createCompetitionTimeoutRecovery.ts */
describe('publishFeedback', () => {
  it('stages, jokes and timings', () => {
    expect(OPERATION_TIMEOUT_MS).toBe(60_000);
    expect(PUBLISH_JOKE_INTERVAL_MS).toBe(3_500);
    expect(getCreateCompetitionPublishStatus('draft')).toBe('Pregătim competiția...');
    expect(getCreateCompetitionPublishStatus('banner')).toBe('Încărcăm banner-ul competiției...');
    expect(getCreateCompetitionPublishStatus('publish')).toBe('Publicăm competiția...');
    expect(CREATE_COMPETITION_PUBLISH_JOKES).toHaveLength(4);
    expect(getCreateCompetitionPublishJoke(0)).toBe('Aruncăm nada potrivită...');
    expect(getCreateCompetitionPublishJoke(5)).toBe(CREATE_COMPETITION_PUBLISH_JOKES[1]);
    expect(getCreateCompetitionPublishJoke(-1)).toBe(CREATE_COMPETITION_PUBLISH_JOKES[3]);
  });

  it('progress dialog copy per mode', () => {
    expect(getOperationStatusText('save')).toBe('Salvare în curs...');
    expect(getOperationStatusText('delete')).toBe('Ștergere în curs...');
    expect(getOperationStatusText('publish')).toBe('Pregătim competiția...');
    expect(getOperationCaption('delete', 'x')).toBe('Te rugăm să aștepți până finalizăm ștergerea ciornei.');
    expect(getOperationCaption('save', 'x')).toBe('Te rugăm să aștepți până finalizăm actualizarea competiției.');
    expect(getOperationCaption('publish', 'glumă')).toBe('glumă');
  });

  it('timeout recovery: publish / delete / save draft → the panel, save edit → the competition', () => {
    expect(buildTimeoutRecovery({ mode: 'publish', draftId: 'd', competitionId: null })).toMatchObject({
      title: 'Publicarea durează mai mult decât estimăm',
      primaryLabel: 'Verifică lista',
      primaryDestination: { kind: 'organizer' },
    });
    expect(buildTimeoutRecovery({ mode: 'delete', draftId: 'd', competitionId: null }).title).toBe('Nu putem confirma ștergerea');
    expect(buildTimeoutRecovery({ mode: 'save', draftId: null, competitionId: 'c1' })).toMatchObject({
      title: 'Nu putem confirma salvarea',
      primaryLabel: 'Verifică competiția',
      primaryDestination: { kind: 'competition', competitionId: 'c1' },
    });
    expect(buildTimeoutRecovery({ mode: 'save', draftId: 'd', competitionId: null }).primaryDestination).toEqual({ kind: 'organizer' });
  });

  it('edit refusal codes, toasts and labels', () => {
    expect(EDIT_BLOCKING_VALIDATION_CODES.size).toBe(9);
    expect(EDIT_BLOCKING_VALIDATION_CODES.has('ORGANIZER:DUPLICATE_STAND_ALLOCATION')).toBe(true);
    expect(getEditSavedMessage(true)).toBe('Alocările pe standuri au fost resetate și trebuie refăcute.');
    expect(getEditSavedMessage(false)).toBe('Modificările au fost salvate cu succes.');
    expect(getSaveActionLabel(true)).toBe('Salvează modificările');
    expect(getSaveActionLabel(false)).toBe('Salvează și ieși');
  });
});

/* fish CreateCompetitionContext.tsx buildPayload (c23, c24) */
describe('completed steps + payload', () => {
  it('completedSteps (c23)', () => {
    expect(getCompletedSteps({ ...createCompetitionDefaultValues })).toEqual([]);
    expect(
      getCompletedSteps({
        ...createCompetitionDefaultValues,
        name: 'Cupa',
        participantsLimit: '0',
        rankingType: 'quantity',
        lake: 'l1',
        sectors: [],
      }),
    ).toEqual([1, 3]);
    expect(
      getCompletedSteps({
        ...createCompetitionDefaultValues,
        name: 'Cupa',
        participantsLimit: '12',
        rankingType: 'quantity',
        lake: 'l1',
        sectors: [{ name: 'A', minFishNumber: 1 }],
        standAllocations: { A: ['s1'] },
      }),
    ).toEqual([1, 2, 3, 4, 5]);
  });

  it('payload: registrationDeadline = startDate, empty numerics dropped (feeder legs too), blocks', () => {
    const payload = buildCompetitionPayload({
      ...createCompetitionDefaultValues,
      name: 'Cupa',
      startDate: '2026-11-01T07:00:00.000Z',
      registerFee: '',
      roundsCount: '',
      numberOfWinners: '',
      description: '<p>Salut</p>',
      banner: 'blob:x',
    });
    expect(payload.registrationDeadline).toBe('2026-11-01T07:00:00.000Z');
    expect(payload).not.toHaveProperty('registerFee');
    expect(payload).not.toHaveProperty('roundsCount');
    expect(payload).not.toHaveProperty('numberOfWinners');
    expect(payload).not.toHaveProperty('banner');
    expect(payload.description).toEqual([{ type: 'paragraph', children: [{ type: 'text', text: 'Salut' }] }]);
    expect(buildCompetitionPayload({ ...createCompetitionDefaultValues, name: 'Cupa', roundsCount: '3' }).roundsCount).toBe('3');
  });

  it('a draft hydrates its feeder legs', () => {
    const draft = { id: 1, documentId: 'd', name: 'Cupa', competitionStatus: 'draft', roundsCount: 2 } as DraftCompetition;
    expect(mapDraftToFormData(draft).roundsCount).toBe('2');
  });
});
