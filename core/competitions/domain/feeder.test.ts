import { describe, expect, it } from 'vitest';
import type { FeederRoundsRanking } from '../schemas';
import {
  currentLegOf,
  defaultFeederTab,
  feederGeneralModel,
  feederLegCount,
  feederLegModel,
  feederPoints,
  feederProvisionalStatus,
  feederTabCount,
  feederWeight,
  futureLegMessage,
  feederRoundActions,
  previousLegSeats,
  type FeederRoundState,
} from './feeder';

/* Ported from fish features/competitions/feeder-rounds/__tests__ (the model and the tab helpers). */

const cell = (round: number, o: Partial<FeederRoundsRanking['rounds'][number]> = {}) => ({
  round,
  sectorName: 'A',
  standId: 1,
  standName: '1',
  quantity: 0,
  catchCount: 0,
  biggestFish: 0,
  points: 1,
  sectorPosition: 1,
  ...o,
});

const row = (o: Partial<FeederRoundsRanking>): FeederRoundsRanking => ({
  registrationId: 'r',
  participant: { username: 'Ion' },
  participants: [],
  teamName: null,
  guestName: null,
  sectorDrawPosition: null,
  standId: 4,
  standName: '4',
  sectorName: 'B',
  rounds: [],
  totalPoints: 0,
  quantity: 0,
  catchCount: 0,
  biggestFish: 0,
  roundsFished: 0,
  generalPosition: 1,
  ...o,
});

const ion = row({
  registrationId: 'r1',
  participant: { username: 'Ion' },
  standId: 4,
  generalPosition: 2,
  totalPoints: 3.5,
  quantity: 12.4,
  rounds: [
    cell(1, { sectorName: 'A', standName: '1', points: 1, quantity: 8, catchCount: 5, biggestFish: 2.1 }),
    cell(2, { sectorName: 'B', standName: '4', points: 2.5, quantity: 4.4, catchCount: 3, biggestFish: 1.2 }),
  ],
});
const ana = row({
  registrationId: 'r2',
  participant: { username: 'Ana' },
  standId: 1,
  generalPosition: 1,
  totalPoints: 3,
  quantity: 10,
  rounds: [
    cell(1, { sectorName: 'B', standName: '4', points: 2, quantity: 4 }),
    cell(2, { sectorName: 'A', standName: '1', points: 1, quantity: 6 }),
  ],
});
const absent = row({
  registrationId: 'r3',
  participant: { username: 'Vlad' },
  standId: null,
  generalPosition: 3,
  rounds: [cell(1, { sectorName: null, standName: null, points: null, sectorPosition: null })],
});

describe('feederGeneralModel', () => {
  it('rows in final order, totals formatted, legs in order', () => {
    const m = feederGeneralModel([ion, ana], 2);
    expect(m.legs).toEqual([1, 2]);
    expect(m.rows.map(r => r.name)).toEqual(['Ana', 'Ion']);
    expect(m.rows[1]).toMatchObject({ position: 2, totalPoints: '3.5', totalKg: '12.400', standId: '4' });
  });

  it('each leg holds its points, sector+stand joined and kg, aligned per leg', () => {
    const m = feederGeneralModel([ion], 2);
    expect(m.rows[0].legs).toEqual([
      { points: '1', seat: 'A1', kg: '8.000' },
      { points: '2.5', seat: 'B4', kg: '4.400' },
    ]);
  });

  it('a leg not fished (or not yet in the ranking) shows dashes', () => {
    const m = feederGeneralModel([absent], 2);
    expect(m.rows[0].legs).toEqual([
      { points: '-', seat: '-', kg: '-' },
      { points: '-', seat: '-', kg: '-' },
    ]);
  });

  it('only the podium (1–3) with fish stands out', () => {
    const m = feederGeneralModel(
      [1, 2, 3, 4].map(p => row({ registrationId: `p${p}`, generalPosition: p, quantity: p === 3 ? 0 : 5 })),
      1
    );
    expect(m.rows.map(r => r.podium)).toEqual([true, true, false, false]);
  });
});

describe('feederLegModel', () => {
  it('groups the leg by sector (A, B…), best first', () => {
    const m = feederLegModel([ion, ana], 2);
    expect(m.sections.map(s => s.sector)).toEqual(['A', 'B']);
    expect(m.sections[0].rows[0]).toMatchObject({ name: 'Ana', seat: 'A1', points: '1', kg: '6.000' });
    expect(m.sections[1].rows[0]).toMatchObject({ name: 'Ion', seat: 'B4', points: '2.5', catchCount: '3', biggestFish: '1.200' });
  });

  it('marks the sector winner (lowest points, with fish)', () => {
    const blank = row({
      registrationId: 'b',
      participant: { username: 'Dan' },
      rounds: [cell(1, { sectorName: 'A', standName: '2', points: 2, quantity: 0 })],
    });
    const m = feederLegModel([ion, blank], 1);
    expect(m.sections[0].rows.map(r => [r.name, r.sectorWinner])).toEqual([
      ['Ion', true],
      ['Dan', false],
    ]);
  });

  it('a blank (no fish) shows points but dashes for fish and biggest', () => {
    const blank = row({
      registrationId: 'b',
      participant: { username: 'Dan' },
      rounds: [cell(1, { sectorName: 'A', standName: '2', points: 4.5, quantity: 0, catchCount: 0 })],
    });
    expect(feederLegModel([blank], 1).sections[0].rows[0]).toMatchObject({
      points: '4.5',
      kg: '0.000',
      catchCount: '-',
      biggestFish: '-',
    });
  });

  it('entrants who did not fish the leg go to a last group without a sector', () => {
    const m = feederLegModel([absent, ion], 1);
    expect(m.sections.map(s => s.sector)).toEqual(['A', null]);
    expect(m.sections[1].rows[0]).toMatchObject({ name: 'Vlad', seat: '-', points: '-' });
  });

  it('rows keep the entrant’s current stand so a tap opens the right angler', () => {
    expect(feederLegModel([ion], 1).sections[0].rows[0].standId).toBe('4');
  });
});

describe('entrant names', () => {
  it('team name first', () => {
    const r = row({ registrationId: 't1', teamName: 'Crapii', participants: [{ username: 'Ion' }, { username: 'Ana' }] });
    expect(feederGeneralModel([r], 1).rows[0].name).toBe('Crapii');
  });
  it('a team without a name shows every member, not only the first', () => {
    const r = row({
      registrationId: 't2',
      teamName: null,
      participant: { username: 'Ion' },
      participants: [{ username: 'Ion' }, { username: 'Ana' }],
    });
    expect(feederGeneralModel([r], 1).rows[0].name).toBe('Ion, Ana');
  });
  it('guests (no accounts) show the guest name', () => {
    const r = row({ registrationId: 't3', teamName: null, participant: null, participants: [], guestName: 'Vasile si Mihai' });
    expect(feederGeneralModel([r], 1).rows[0].name).toBe('Vasile si Mihai');
  });
});

describe('feederLegModel before the first weighing', () => {
  // The ranking sends a started leg with each entrant's seat and no points until its first catch.
  const seated = (id: string, name: string, standName: string) =>
    row({
      registrationId: id,
      participant: { username: name },
      rounds: [cell(1, { points: null, sectorPosition: null, sectorName: 'A', standName, quantity: 0, catchCount: 0 })],
    });
  it('shows everyone seated in their sector, by stand, with dashes', () => {
    const m = feederLegModel([seated('a', 'Ion', '2'), seated('b', 'Ana', '1')], 1);
    expect(m.sections.map(s => s.sector)).toEqual(['A']);
    expect(m.sections[0].rows.map(r => [r.seat, r.name, r.points, r.kg])).toEqual([
      ['A1', 'Ana', '-', '-'],
      ['A2', 'Ion', '-', '-'],
    ]);
    expect(m.sections[0].rows.every(r => !r.sectorWinner)).toBe(true);
  });
});

describe('feederLegCount', () => {
  it('counts the legs the ranking already holds', () => {
    expect(feederLegCount([row({ rounds: [cell(1), cell(2)] })])).toBe(2);
    expect(feederLegCount([])).toBe(0);
  });
});

describe('defaultFeederTab', () => {
  it('opens on the leg in progress', () => {
    expect(defaultFeederTab({ competitionStatus: 'started', currentRound: 2, roundStatus: 'running' })).toBe(2);
  });
  it('opens on General between legs and once the competition is over', () => {
    expect(defaultFeederTab({ competitionStatus: 'started', currentRound: 1, roundStatus: 'closed' })).toBe('general');
    expect(defaultFeederTab({ competitionStatus: 'completed', currentRound: 2, roundStatus: 'running' })).toBe('general');
    expect(defaultFeederTab({ competitionStatus: 'started', currentRound: null, roundStatus: null })).toBe('general');
  });
});

describe('feederTabCount', () => {
  it('a tab for every leg of the competition, started or not', () => {
    expect(feederTabCount([row({ rounds: [cell(1)] })], 2)).toBe(2);
    expect(feederTabCount([row({ rounds: [cell(1)] })], 3)).toBe(3);
  });
  it('never fewer than the legs the ranking already holds (old data without roundsCount)', () => {
    expect(feederTabCount([row({ rounds: [cell(1), cell(2)] })], null)).toBe(2);
  });
});

describe('futureLegMessage', () => {
  it('nothing for a leg that has started and is in the ranking', () => {
    expect(futureLegMessage(1, 1, 'running', 1)).toBeNull();
    expect(futureLegMessage('general', 1, 'running', 1)).toBeNull();
  });
  it('a leg that started but nothing is weighed yet: the ranking has no column for it', () => {
    expect(futureLegMessage(2, 2, 'running', 1)).toEqual({
      title: 'Manșa 2 a început',
      detail: 'Clasamentul manșei apare după prima cântărire.',
    });
  });
  it('the next leg after a closed one: re-seating then start', () => {
    expect(futureLegMessage(2, 1, 'closed', 1)).toEqual({
      title: 'Manșa 2 nu a început încă',
      detail: 'Organizatorul reașază standurile după tragerea la sorți, apoi pornește manșa.',
    });
  });
  it('a later leg: starts after the current one ends', () => {
    expect(futureLegMessage(3, 1, 'running', 1)).toEqual({
      title: 'Manșa 3 nu a început încă',
      detail: 'Începe după încheierea manșei 2.',
    });
    expect(futureLegMessage(2, 1, 'running', 1)?.detail).toBe('Începe după încheierea manșei 1.');
  });
});

describe('formatting', () => {
  it('weights with three decimals, points with at most one', () => {
    expect(feederWeight(12.4)).toBe('12.400');
    expect(feederWeight(null)).toBe('-');
    expect(feederPoints(2.5)).toBe('2.5');
    expect(feederPoints(3)).toBe('3');
    expect(feederPoints(15.55)).toBe('15.6');
    expect(feederPoints(null)).toBe('-');
  });
});

describe('feederProvisionalStatus', () => {
  it('names the current leg while the competition is not over', () => {
    expect(feederProvisionalStatus('started', 2, 'running')).toBe('manșa 2 este în desfășurare');
    expect(feederProvisionalStatus('started', 1, 'closed')).toBe('manșa 1 este încheiată');
  });
  it('nothing once completed, or before the first leg', () => {
    expect(feederProvisionalStatus('completed', 2, 'running')).toBeNull();
    expect(feederProvisionalStatus('started', null, null)).toBeNull();
  });
});

describe('currentLegOf (fish feederRoundActions.ts)', () => {
  it('is the current leg on a feeder competition only', () => {
    expect(currentLegOf({ rankingType: 'feederRounds', currentRound: 2 })).toBe(2);
    expect(currentLegOf({ rankingType: 'feederRounds', currentRound: null })).toBeUndefined();
    expect(currentLegOf({ rankingType: 'quantity', currentRound: 2 })).toBeUndefined();
    expect(currentLegOf(null)).toBeUndefined();
  });
});

/* Ported from fish feeder-rounds/__tests__/feederRoundActions.test.ts and feederRoundsTable.test.ts. */

const comp = (o: Partial<FeederRoundState> = {}): FeederRoundState => ({
  rankingType: 'feederRounds',
  competitionStatus: 'started',
  roundsCount: 2,
  currentRound: 1,
  roundStatus: 'running',
  ...o,
});
const kinds = (c: FeederRoundState) => feederRoundActions(c)?.map(a => `${a.kind}:${a.round ?? ''}`);

describe('feederRoundActions', () => {
  it('is null for other ranking types and for competitions not started', () => {
    expect(feederRoundActions(comp({ rankingType: 'quantity' }))).toBeNull();
    expect(feederRoundActions(comp({ competitionStatus: 'notStarted' }))).toBeNull();
    expect(feederRoundActions(comp({ competitionStatus: 'completed' }))).toBeNull();
    expect(feederRoundActions(null)).toBeNull();
  });
  it('offers closing a running leg that is not the last', () => {
    expect(kinds(comp())).toEqual(['closeRound:1']);
  });
  it('offers re-seating and starting the next leg once a leg is closed', () => {
    expect(kinds(comp({ roundStatus: 'closed' }))).toEqual(['allocateNext:2', 'startNext:2']);
  });
  it('offers ending the competition from the last leg', () => {
    expect(kinds(comp({ currentRound: 2 }))).toEqual(['end:']);
    expect(kinds(comp({ roundsCount: 3, currentRound: 2 }))).toEqual(['closeRound:2']);
  });
  it('a single-leg competition goes straight to ending', () => {
    expect(kinds(comp({ roundsCount: 1, currentRound: 1 }))).toEqual(['end:']);
  });
  it('labels and confirmations carry the leg', () => {
    expect(feederRoundActions(comp({ roundStatus: 'closed' }))?.map(a => a.label)).toEqual(['Reașază pentru manșa 2', 'Pornește manșa 2']);
    expect(feederRoundActions(comp())?.[0]).toMatchObject({
      label: 'Închide manșa 1',
      confirmation: 'Închizi manșa 1? Cântarele ei nu mai pot fi redeschise.',
    });
    expect(feederRoundActions(comp({ roundStatus: 'closed' }))?.[1].confirmation).toBe('Pornești manșa 2? Standurile trase sunt salvate?');
  });
});

describe('previousLegSeats', () => {
  it('maps each entrant to where they fished in the leg before', () => {
    const ion = row({ registrationId: 'r1', rounds: [cell(1, { sectorName: 'A', standName: '7' })] });
    const absent = row({ registrationId: 'r2', rounds: [cell(1, { sectorName: null, standName: null, points: null })] });
    expect(previousLegSeats([ion, absent], 2)).toEqual({ r1: 'M1: A/7' });
    expect(previousLegSeats([ion], 1)).toEqual({});
  });
});
