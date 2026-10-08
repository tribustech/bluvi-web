import { describe, expect, it } from 'vitest';
import { rankingResponseSchema, type Penalty } from '../../competitions/schemas';
import { hydrateRanking, type RankingFixture } from '../../../tests/fixtures/rankings/hydrate';
import quantity from '../../../tests/fixtures/rankings/quantity.json';
import quantityQuality from '../../../tests/fixtures/rankings/quantityQuality.json';
import {
  emptyPenaltiesLine,
  formatPenaltyTimestamp,
  gatherPenalties,
  penaltyActionLabel,
  penaltyPermissions,
  penaltyTeamLabel,
} from './penalties';

const P = (documentId: string, createdAt: string, over: Partial<Penalty> = {}): Penalty => ({
  documentId,
  action: 'WARNING',
  value: null,
  reason: 'Motiv de test',
  createdAt,
  ...over,
});

/** A real ranking payload (tests/fixtures/rankings) with penalties put on some rows. */
function withPenalties(fixture: RankingFixture, byRow: Record<number, Penalty[]>) {
  const hydrated = hydrateRanking(fixture);
  return rankingResponseSchema.parse({
    ...hydrated,
    rankings: hydrated.rankings.map((r, i) => ({ ...r, penalties: byRow[i] ?? [] })),
  });
}

describe('penalties hub (organizer.penalties c2)', () => {
  it('gathers every row’s penalties, labelled «Stand N · nume», newest first', () => {
    const ranking = withPenalties(quantity as RankingFixture, {
      0: [P('a', '2026-10-08T08:00:00.000Z', { action: 'DEDUCT_TOTAL_WEIGHT', value: 1.5 })],
      2: [P('b', '2026-10-08T09:30:00.000Z', { action: 'ELIMINATE' }), P('c', '2026-10-08T07:00:00.000Z')],
    });
    const all = gatherPenalties(ranking);
    expect(all.map(p => p.documentId)).toEqual(['b', 'a', 'c']);
    // quantity.json rows: teamName "" (individual) → the guest name, never «Stand 9 · ».
    expect(all.map(p => p.teamLabel)).toEqual(['Stand 5 · Pescar 3', 'Stand 2 · Pescar 1', 'Stand 5 · Pescar 3']);
    expect(all[1]).toMatchObject({ action: 'DEDUCT_TOTAL_WEIGHT', value: 1.5, reason: 'Motiv de test' });
  });

  it('also on quantityQuality payloads; none when no row has any', () => {
    expect(gatherPenalties(withPenalties(quantityQuality as RankingFixture, {}))).toEqual([]);
    const one = gatherPenalties(withPenalties(quantityQuality as RankingFixture, { 1: [P('x', '2026-10-08T08:00:00.000Z')] }));
    expect(one).toHaveLength(1);
    expect(one[0].teamLabel).toMatch(/^Stand \S+ · \S/);
  });

  it('reads the teams inside a club row (National Championship / FIPSed)', () => {
    const ranking = {
      rankings: [
        {
          clubName: 'Club 1',
          teams: [
            { standName: '3', teamName: 'Echipa Roșie', penalties: [P('t1', '2026-10-08T06:00:00.000Z')] },
            { standName: '7', teamName: null, participant: { username: 'ion' }, penalties: [P('t2', '2026-10-08T10:00:00.000Z')] },
          ],
          // a club's own `penalties` are not read when it has teams (fish reads `r.teams` only)
          penalties: [P('club', '2026-10-08T11:00:00.000Z')],
        },
      ],
    };
    expect(gatherPenalties(ranking).map(p => [p.documentId, p.teamLabel])).toEqual([
      ['t2', 'Stand 7 · ion'],
      ['t1', 'Stand 3 · Echipa Roșie'],
    ]);
  });

  it('a penalty whose author account is gone (`author: null`, Strapi 5) parses and is gathered', () => {
    const ranking = withPenalties(quantity as RankingFixture, {
      1: [P('orphan', '2026-10-08T06:05:00.000Z', { author: null }), P('known', '2026-10-08T05:00:00.000Z', { author: { id: 1, username: 'Ion' } })],
    });
    const all = gatherPenalties(ranking);
    expect(all.map(p => [p.documentId, p.author])).toEqual([
      ['orphan', null],
      ['known', { id: 1, username: 'Ion' }],
    ]);
  });

  it('not started (no ranking read) → none', () => {
    expect(gatherPenalties(undefined)).toEqual([]);
    expect(gatherPenalties(null)).toEqual([]);
    expect(gatherPenalties({})).toEqual([]);
  });

  it('labels: team, then guest, then user; no stand → the name; nothing → «—»', () => {
    expect(penaltyTeamLabel({ standName: '2', teamName: 'Crapii', guestName: 'G' })).toBe('Stand 2 · Crapii');
    expect(penaltyTeamLabel({ standName: '2', teamName: '', guestName: 'Gigi' })).toBe('Stand 2 · Gigi');
    expect(penaltyTeamLabel({ standName: '2', participant: { username: 'mihai' } })).toBe('Stand 2 · mihai');
    expect(penaltyTeamLabel({ teamName: 'Crapii' })).toBe('Crapii');
    expect(penaltyTeamLabel({ standName: '4' })).toBe('Stand 4 · —');
  });
});

describe('penalties hub — copy and rights (c3–c6)', () => {
  it('action labels (an unknown action reads as itself)', () => {
    expect(penaltyActionLabel('WARNING')).toBe('Avertisment');
    expect(penaltyActionLabel('DEDUCT_TOTAL_WEIGHT')).toBe('Penalizare greutate');
    expect(penaltyActionLabel('ELIMINATE')).toBe('Eliminare');
    expect(penaltyActionLabel('NEW_ONE')).toBe('NEW_ONE');
  });

  it('dd.mm.yyyy, hh:mm in Romania’s time', () => {
    expect(formatPenaltyTimestamp('2026-10-08T06:05:00.000Z')).toBe('08.10.2026, 09:05');
    expect(formatPenaltyTimestamp('2026-01-31T23:30:00.000Z')).toBe('01.02.2026, 01:30');
    expect(formatPenaltyTimestamp('nope')).toBe('nope');
  });

  it('apply: author/referee + started + quantity|quantityQuality; revoke: author/referee + started', () => {
    const c = (competitionStatus: string, rankingType: string) => ({ competitionStatus, rankingType });
    expect(penaltyPermissions(true, c('started', 'quantity'))).toEqual({ canApply: true, canRevoke: true, rankingSupportsPenalties: true });
    expect(penaltyPermissions(true, c('started', 'quantityQuality')).canApply).toBe(true);
    expect(penaltyPermissions(true, c('started', 'bestOf'))).toEqual({ canApply: false, canRevoke: true, rankingSupportsPenalties: false });
    expect(penaltyPermissions(true, c('finished', 'quantity'))).toEqual({ canApply: false, canRevoke: false, rankingSupportsPenalties: true });
    expect(penaltyPermissions(false, c('started', 'quantity'))).toEqual({ canApply: false, canRevoke: false, rankingSupportsPenalties: true });
    expect(penaltyPermissions(true, null).canApply).toBe(false);
  });

  it('the empty line, one of three', () => {
    expect(emptyPenaltiesLine({ canApply: false, rankingSupportsPenalties: false })).toBe('Penalizările nu se aplică pentru acest tip de clasament.');
    expect(emptyPenaltiesLine({ canApply: true, rankingSupportsPenalties: true })).toBe('Aplică o penalizare pentru a o vedea aici.');
    expect(emptyPenaltiesLine({ canApply: false, rankingSupportsPenalties: true })).toBe(
      'Organizatorul nu a aplicat încă nicio penalizare în această competiție.',
    );
  });
});
