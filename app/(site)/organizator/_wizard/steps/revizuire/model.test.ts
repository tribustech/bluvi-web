import { describe, expect, it } from 'vitest';
import type { CreateCompetitionFormData } from '@/core/organizer';
import { isPublishBlocked } from '../../model';
import {
  buildReview,
  capacityWarningText,
  FEE_RANGE_ERROR,
  formatFee,
  formatReviewDate,
  standShortageText,
  tiersInsufficientText,
  tiersInvalidText,
  reviewStepStatus,
  type ReviewModel,
  type ReviewSectionId,
} from './model';

const VALID: CreateCompetitionFormData = {
  name: 'Cupa validă',
  startDate: '2026-11-14T05:00:00.000Z',
  endDate: '2026-11-15T12:00:00.000Z',
  competitionType: 'single',
  participantsLimit: '2',
  fishSpeciesIds: ['crap', 'caras'],
  rankingType: 'quantity',
  lake: 'lake1',
  sectors: [{ name: 'A', minFishNumber: 1 }],
  standAllocations: { A: ['s1', 's2'] },
};

const review = (over: Partial<CreateCompetitionFormData> = {}, lakeName: string | null | undefined = 'Chita Lake') =>
  buildReview({ values: { ...VALID, ...over }, lakeName });

const sec = (m: ReviewModel, id: ReviewSectionId) => m.sections.find((s) => s.id === id)!;
const rowOf = (m: ReviewModel, id: ReviewSectionId, key: string) =>
  [...sec(m, id).rows, ...(sec(m, id).tail ?? []), ...(sec(m, id).sectors ?? [])].find((r) => r.key === key);

describe('buildReview — a valid form', () => {
  it('has four sections, none in error, and agrees with the frame gate', () => {
    const m = review();
    expect(m.sections.map((s) => [s.title, s.step])).toEqual([
      ['Detalii de bază', 'detalii'],
      ['Configurare', 'configurare'],
      ['Clasament', 'clasament'],
      ['Lac și sectoare', 'lac-si-sectoare'],
    ]);
    expect(m.hasAnyError).toBe(false);
    expect(m.problems).toEqual([]);
    expect(isPublishBlocked({ ...VALID })).toBe(false);
  });

  it('c3 c4 c8 — the rows and their values', () => {
    const m = review({ registerFee: '150' });
    expect(sec(m, 'basics').rows.map((r) => [r.label, r.value])).toEqual([
      ['Nume', 'Cupa validă'],
      ['Data început', formatReviewDate(VALID.startDate)],
      ['Data sfârșit', formatReviewDate(VALID.endDate)],
      ['Taxă înscriere', '150 RON'],
    ]);
    expect(sec(m, 'config').rows.map((r) => [r.label, r.value])).toEqual([
      ['Tip competiție', 'Individual'],
      ['Total participanți', '2'],
      ['Specii de pește', '2 specii'],
    ]);
    expect(sec(m, 'ranking').rows.map((r) => [r.label, r.value])).toEqual([['Tip clasament', 'Cantitate']]);
    expect(sec(m, 'lakeSectors').rows.map((r) => [r.label, r.value])).toEqual([
      ['Lac', 'Chita Lake'],
      ['Sectoare', '1 sector'],
    ]);
    expect(sec(m, 'lakeSectors').sectors?.map((r) => [r.label, r.value, r.sector])).toEqual([['Sector A', '2 standuri', 'A']]);
  });
});

describe('formatting', () => {
  it('dates: «d MMM yyyy, HH:mm» in Romanian, local time', () => {
    const d = new Date(2026, 10, 14, 7, 5);
    expect(formatReviewDate(d.toISOString())).toBe('14 noi 2026, 07:05');
    expect(formatReviewDate(undefined)).toBeNull();
    expect(formatReviewDate('nope')).toBeNull();
  });

  it('fee: «X RON» above 0, else «Gratuit»', () => {
    expect(formatFee('150')).toBe('150 RON');
    expect(formatFee('0')).toBe('Gratuit');
    expect(formatFee('')).toBe('Gratuit');
    expect(formatFee(undefined)).toBe('Gratuit');
  });
});

describe('c2 c3 — missing and invalid basics', () => {
  it('empty name and dates read «Lipsește»; the section is red', () => {
    const m = review({ name: '', startDate: undefined, endDate: undefined });
    expect(sec(m, 'basics').hasError).toBe(true);
    for (const key of ['name', 'startDate', 'endDate']) expect(rowOf(m, 'basics', key)?.missing).toBe(true);
    expect(m.problems.map((p) => p.text)).toEqual(['Nume: lipsește', 'Data început: lipsește', 'Data sfârșit: lipsește']);
  });

  it('a fee out of range keeps its row and adds the range error', () => {
    const m = review({ registerFee: '60000' });
    const fee = rowOf(m, 'basics', 'registerFee');
    expect(fee?.value).toBe('60000 RON');
    expect(fee?.note).toEqual({ tone: 'danger', text: FEE_RANGE_ERROR });
    expect(sec(m, 'basics').hasError).toBe(true);
    expect(m.problems.map((p) => p.text)).toEqual([FEE_RANGE_ERROR]);
  });

  it('a name under 3 characters (schema) is said on its row, as the frame blocks publish on it', () => {
    const m = review({ name: 'ab' });
    expect(rowOf(m, 'basics', 'name')?.error).toBe('Numele trebuie să aibă cel puțin 3 caractere');
    expect(m.hasAnyError).toBe(true);
    expect(isPublishBlocked({ ...VALID, name: 'ab' })).toBe(true);
  });
});

describe('c4 c5 — configuration', () => {
  it('team: «Echipă», «Participanți/echipă», «Total echipe»', () => {
    const m = review({ competitionType: 'team', teamParticipants: '3', participantsLimit: '2' });
    expect(sec(m, 'config').rows.map((r) => [r.label, r.value])).toEqual([
      ['Tip competiție', 'Echipă'],
      ['Participanți/echipă', '3'],
      ['Total echipe', '2'],
      ['Specii de pește', '2 specii'],
    ]);
  });

  it('team members out of 1–10, no limit, no species → «Lipsește»', () => {
    const m = review({ competitionType: 'team', teamParticipants: '11', participantsLimit: '', fishSpeciesIds: [] });
    expect(rowOf(m, 'config', 'teamParticipants')?.missing).toBe(true);
    expect(rowOf(m, 'config', 'participantsLimit')?.missing).toBe(true);
    expect(rowOf(m, 'config', 'fishSpeciesIds')?.missing).toBe(true);
    expect(sec(m, 'config').hasError).toBe(true);
  });

  it('a single species: «1 specie»', () => {
    expect(rowOf(review({ fishSpeciesIds: ['crap'] }), 'config', 'fishSpeciesIds')?.value).toBe('1 specie');
  });

  it('fewer allocated stands than the limit: the red shortage note, the section stays neutral', () => {
    const m = review({ participantsLimit: '12' });
    expect(rowOf(m, 'config', 'participantsLimit')?.note).toEqual({ tone: 'danger', text: 'Ai doar 2 standuri pe lac pentru 12 participanți.' });
    expect(sec(m, 'config').hasError).toBe(false);
    const none = review({ participantsLimit: '25', standAllocations: {} });
    expect(rowOf(none, 'config', 'participantsLimit')?.note?.text).toBe('Nu ai standuri pe lac pentru 25 de participanți.');
  });

  it('shortage copy: plurals and teams', () => {
    expect(standShortageText({ configuredStands: 1, participantsLimit: 4, missingSlots: 3 }, true)).toBe('Ai doar 1 stand pe lac pentru 4 echipe.');
    expect(standShortageText({ configuredStands: 0, participantsLimit: 1, missingSlots: 1 }, false)).toBe('Nu ai standuri pe lac pentru 1 participant.');
  });
});

describe('c6 c7 — ranking', () => {
  it('the general mode and the grid rule, when set', () => {
    const m = review({ rankingType: 'quantityQuality', generalRankingWinnerMode: 'bySectorPosition', gridRule: 'average', sectors: [{ name: 'A', minFishNumber: 2 }] });
    expect(sec(m, 'ranking').rows.map((r) => [r.label, r.value])).toEqual([
      ['Tip clasament', 'Cantitate/Calitate'],
      ['Mod clasament general', 'După poziția în sector, primează Cantitatea'],
      ['Regula departajare', 'După media greutății'],
    ]);
  });

  it('Best of: fish count and winners, «Lipsește» when missing', () => {
    const ok = review({ rankingType: 'bestOf', bestOfFishCount: '5', numberOfWinners: '3' });
    expect(sec(ok, 'ranking').rows.map((r) => [r.label, r.value])).toEqual([
      ['Tip clasament', 'Best of'],
      ['Nr. pești clasament', '5'],
      ['Nr. câștigători', '3'],
    ]);
    const bad = review({ rankingType: 'bestOf' });
    expect(rowOf(bad, 'ranking', 'bestOfFishCount')?.missing).toBe(true);
    expect(rowOf(bad, 'ranking', 'numberOfWinners')?.missing).toBe(true);
  });

  it('Feeder: the legs, required', () => {
    expect(rowOf(review({ rankingType: 'feederRounds', roundsCount: '3' }), 'ranking', 'roundsCount')?.value).toBe('3 manșe');
    expect(rowOf(review({ rankingType: 'feederRounds', roundsCount: '1' }), 'ranking', 'roundsCount')?.value).toBe('1 manșă');
    expect(rowOf(review({ rankingType: 'feederRounds', roundsCount: undefined }), 'ranking', 'roundsCount')?.missing).toBe(true);
    expect(rowOf(review({ rankingType: 'feederRounds', roundsCount: '7' }), 'ranking', 'roundsCount')?.missing).toBe(true);
  });

  it('Best of tiers: the list, missing, invalid, not enough stands', () => {
    const one = { sectors: [{ name: 'A', minFishNumber: 1 }] };
    expect(rowOf(review({ rankingType: 'bestOfTiers', bestOfTierSizes: [9, 7, 5], standAllocations: { A: ['a', 'b', 'c'] }, ...one }), 'ranking', 'bestOfTierSizes')?.value).toBe('9, 7, 5');
    expect(rowOf(review({ rankingType: 'bestOfTiers', bestOfTierSizes: [], ...one }), 'ranking', 'bestOfTierSizes')?.missing).toBe(true);
    const invalid = review({ rankingType: 'bestOfTiers', bestOfTierSizes: [5, 7], ...one });
    expect(rowOf(invalid, 'ranking', 'bestOfTierSizes')?.error).toBe(tiersInvalidText([5, 7]));
    expect(tiersInvalidText([5, 7])).toBe('Pragurile (5, 7) trebuie să fie întregi pozitive, ordonate descrescător și distincte.');
    const short = review({ rankingType: 'bestOfTiers', bestOfTierSizes: [9, 7, 5], ...one });
    expect(rowOf(short, 'ranking', 'allocatedStands')?.error).toBe('Ai 3 praguri dar doar 2 standuri. Alocă cel puțin 3 standuri.');
    expect(sec(short, 'ranking').hasError).toBe(true);
  });

  it('tiers copy: singular', () => {
    expect(tiersInsufficientText(1, 0)).toBe('Ai 1 prag dar doar 0 standuri. Alocă cel puțin un stand.');
    expect(tiersInsufficientText(2, 1)).toBe('Ai 2 praguri dar doar 1 stand. Alocă cel puțin 2 standuri.');
  });

  it('no ranking type: «Lipsește»', () => {
    expect(rowOf(review({ rankingType: undefined }), 'ranking', 'rankingType')?.missing).toBe(true);
  });
});

describe('c8 c9 c10 — lake and sectors', () => {
  it('the lake name: loading → null, unreadable → «Selectat»', () => {
    expect(rowOf(review({}, null), 'lakeSectors', 'lake')?.value).toBeNull();
    expect(rowOf(buildReview({ values: VALID, lakeName: undefined }), 'lakeSectors', 'lake')?.value).toBe('Selectat');
  });

  it('no lake, no sectors: «Lipsește»', () => {
    const m = review({ lake: undefined, sectors: [] });
    expect(rowOf(m, 'lakeSectors', 'lake')?.missing).toBe(true);
    expect(rowOf(m, 'lakeSectors', 'sectors')?.missing).toBe(true);
    expect(sec(m, 'lakeSectors').hasError).toBe(true);
  });

  it('quality types: «min N pești» per sector, «Min pești invalid (N)» and «Minim 1 per sector» below 1', () => {
    const m = review({
      rankingType: 'quality',
      sectors: [
        { name: 'A', minFishNumber: 2 },
        { name: 'B', minFishNumber: 1 },
        { name: 'C', minFishNumber: 0 },
      ],
      standAllocations: { A: ['s1', 's2'], B: ['s3'] },
    });
    expect(sec(m, 'lakeSectors').sectors?.map((r) => [r.label, r.value ?? r.error])).toEqual([
      ['Sector A', '2 standuri, min 2 pești'],
      ['Sector B', '1 stand, min 1 pește'],
      ['Sector C', 'Min pești invalid (0)'],
    ]);
    expect(rowOf(m, 'lakeSectors', 'minFishNumber')?.error).toBe('Minim 1 per sector');
    expect(m.problems.map((p) => p.text)).toEqual(['Nr. minim pești: Minim 1 per sector']);
  });

  it('national / FIPSed need exactly 3 sectors; best of tiers exactly 1', () => {
    expect(rowOf(review({ rankingType: 'nationalChampionship' }), 'lakeSectors', 'sectorCount')?.error).toBe('Necesită exact 3 sectoare');
    expect(rowOf(review({ rankingType: 'fipsed' }), 'lakeSectors', 'sectorCount')?.label).toBe('Campionat Național / FIPSed');
    const tiers = review({
      rankingType: 'bestOfTiers',
      bestOfTierSizes: [2, 1],
      sectors: [
        { name: 'A', minFishNumber: 1 },
        { name: 'B', minFishNumber: 1 },
      ],
    });
    expect(rowOf(tiers, 'lakeSectors', 'bestOfTiersSectorCount')?.error).toBe('Necesită exact 1 sector');
  });

  it('c9 — the amber capacity warning, plurals and agreement', () => {
    const m = review({ participantsLimit: '12' });
    expect(sec(m, 'lakeSectors').warning).toEqual({
      tone: 'warning',
      text: 'Avertisment: ai configurat 2 standuri pentru 12 participanți. Cel puțin 10 participanți nu vor putea fi alocați pe stand.',
    });
    expect(sec(review(), 'lakeSectors').warning).toBeUndefined();
    expect(capacityWarningText({ configuredStands: 1, participantsLimit: 2, missingSlots: 1 }, true)).toBe(
      'Avertisment: ai configurat 1 stand pentru 2 echipe. Cel puțin 1 echipă nu va putea fi alocată pe stand.',
    );
    expect(capacityWarningText({ configuredStands: 0, participantsLimit: 30, missingSlots: 30 }, true)).toBe(
      'Avertisment: ai configurat 0 standuri pentru 30 de echipe. Cel puțin 30 de echipe nu vor putea fi alocate pe stand.',
    );
  });
});

describe('the review and the frame gate agree', () => {
  const cases: Partial<CreateCompetitionFormData>[] = [
    {},
    { name: '' },
    { name: 'ab' },
    { registerFee: '70000' },
    { participantsLimit: '0' },
    { competitionType: 'team', teamParticipants: '0' },
    { fishSpeciesIds: [] },
    { rankingType: 'bestOf', bestOfFishCount: '150', numberOfWinners: '1' },
    { rankingType: 'bestOfTiers', bestOfTierSizes: [3, 3] },
    { rankingType: 'fipsed' },
    { lake: undefined },
    { rankingType: 'quality', sectors: [{ name: 'A', minFishNumber: 0 }] },
    // Type-owned values left over from another type (a hydrated draft, an edited competition).
    { competitionType: 'single', teamParticipants: '11' },
    { rankingType: 'quantity', bestOfFishCount: '150' },
    { rankingType: 'quantity', numberOfWinners: '0' },
    { rankingType: 'quantity', bestOfTierSizes: [0, -1] },
  ];
  it.each(cases.map((c) => [JSON.stringify(c), c]))('%s', (_, over) => {
    const m = review(over as Partial<CreateCompetitionFormData>);
    expect(m.hasAnyError).toBe(isPublishBlocked({ ...VALID, ...(over as Partial<CreateCompetitionFormData>) }));
  });
});

describe('a schema error on a field no row shows', () => {
  it('gets a red row in its card and a line in the problem list', () => {
    const team = review({ competitionType: 'single', teamParticipants: '11' });
    expect(team.hasAnyError).toBe(true);
    expect(sec(team, 'config').hasError).toBe(true);
    expect(rowOf(team, 'config', 'teamParticipants')).toEqual({
      key: 'teamParticipants',
      label: 'Participanți/echipă',
      value: null,
      error: 'Participanți per echipă trebuie să fie între 1 și 10.',
    });
    expect(team.problems.map((p) => p.text)).toEqual(['Participanți/echipă: Participanți per echipă trebuie să fie între 1 și 10.']);

    const fish = review({ rankingType: 'quantity', bestOfFishCount: '150' });
    expect(sec(fish, 'ranking').hasError).toBe(true);
    expect(rowOf(fish, 'ranking', 'bestOfFishCount')?.error).toBe('Numărul de pești trebuie să fie între 1 și 100.');
    expect(rowOf(review({ rankingType: 'quantity', numberOfWinners: '0' }), 'ranking', 'numberOfWinners')?.label).toBe('Nr. câștigători');
    expect(rowOf(review({ rankingType: 'quantity', bestOfTierSizes: [0] }), 'ranking', 'bestOfTierSizes')?.label).toBe('Praguri Best of');
  });

  it('is not listed twice when a row already says it', () => {
    const m = review({ rankingType: 'bestOf', bestOfFishCount: '150', numberOfWinners: '1' });
    expect(m.problems.filter((p) => p.key.endsWith('bestOfFishCount'))).toHaveLength(1);
    expect(review({ name: 'ab' }).problems.filter((p) => p.key.endsWith('name'))).toHaveLength(1);
  });
});

describe('reviewStepStatus — the rail says what the cards say', () => {
  it('a valid form: every step complete', () => {
    expect(reviewStepStatus({ ...VALID })).toEqual({
      detalii: 'complete',
      configurare: 'complete',
      clasament: 'complete',
      'lac-si-sectoare': 'complete',
      standuri: 'complete',
    });
  });

  it('an empty form: the four cards red, no stand allocated yet', () => {
    expect(reviewStepStatus({ name: '' })).toEqual({
      detalii: 'error',
      configurare: 'error',
      clasament: 'error',
      'lac-si-sectoare': 'error',
      standuri: 'incomplete',
    });
  });

  it('a red card is a red step; fewer stands than places or tiers', () => {
    const minFish = reviewStepStatus({ ...VALID, rankingType: 'quality', sectors: [{ name: 'A', minFishNumber: 0 }] });
    expect(minFish['lac-si-sectoare']).toBe('error');
    expect(minFish.detalii).toBe('complete');
    expect(reviewStepStatus({ ...VALID, participantsLimit: '12' }).standuri).toBe('incomplete');
    expect(reviewStepStatus({ ...VALID, rankingType: 'bestOfTiers', bestOfTierSizes: [5, 3, 1] }).standuri).toBe('error');
  });

  it('exposes the capacity warning (the review’s warning notice)', () => {
    expect(review({ participantsLimit: '12' }).capacity).toEqual({ configuredStands: 2, participantsLimit: 12, missingSlots: 10 });
    expect(review().capacity).toBeNull();
  });
});
