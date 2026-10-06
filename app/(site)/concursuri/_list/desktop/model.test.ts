import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { miniRanking, resultsPodium, viewerRow } from './model';

/* competitions-list.index c33 (one podium source), c33/c35 (the viewer by identity). */

const ranking = (rows: Array<Record<string, unknown>>, rankingType = 'quantity') => miniRanking({ rankings: rows, metadata: { rankingType } });

describe('viewerRow — by identity, never by display name', () => {
  const r = ranking([
    { registrationId: 'reg-team', teamName: 'Nada Grea', participant: { id: 286, username: 'Andrei' }, quantity: 12, catchCount: 3, generalPosition: 1 },
    { registrationId: 'reg-pair', participants: [{ id: 7, username: 'Ana' }, { id: 8, username: 'Ion' }], quantity: 8, catchCount: 2, generalPosition: 2 },
    { registrationId: 'reg-guest', guestName: 'Mara', quantity: 5, catchCount: 1, generalPosition: 3 },
  ]);

  it('finds a team row by its participant, and a pair row by either member', () => {
    expect(viewerRow(r.rows, 286)?.position).toBe(1);
    expect(viewerRow(r.rows, 8)?.position).toBe(2);
  });

  it('finds a team member the row does not list, by the viewer’s own registration', () => {
    expect(viewerRow(r.rows, 999, 'reg-team')?.position).toBe(1);
  });

  it('never matches a name: an angler called like the team is nobody here', () => {
    expect(viewerRow(r.rows, 12345)).toBeNull();
    expect(viewerRow(r.rows, null)).toBeNull();
  });
});

describe('resultsPodium — the row and the panel crown the same winner', () => {
  const card = [
    { position: 1, tied: false, displayName: 'Mara Ilie', standName: '3', clubName: null, avatarUrls: ['https://x/mara.jpg'] },
    { position: 2, tied: false, displayName: 'Ana Marin', standName: '5', clubName: null, avatarUrls: [] },
  ];

  it('agrees: the ranking, with the card’s photos', () => {
    const r = ranking([
      { registrationId: 'a', guestName: 'Mara Ilie', totalPoints: 2, catchCount: 4, generalPosition: 1 },
      { registrationId: 'b', guestName: 'Ana Marin', totalPoints: 3, catchCount: 3, generalPosition: 2 },
    ], 'feederRounds');
    const p = resultsPodium(card, r);
    expect(p).toMatchObject({ fromRanking: true, agrees: true });
    expect(p.rows[0]).toMatchObject({ name: 'Mara Ilie', value: 2, avatar: 'https://x/mara.jpg' });
  });

  it('disagrees (a guest who never fished ranked first): the card’s podium, without values', () => {
    const r = ranking([
      { registrationId: 'g', guestName: 'Ion Popescu', totalPoints: 0, catchCount: 0, generalPosition: 1 },
      { registrationId: 'a', guestName: 'Mara Ilie', totalPoints: 2, catchCount: 4, generalPosition: 2 },
    ], 'feederRounds');
    const p = resultsPodium(card, r);
    expect(p).toMatchObject({ fromRanking: false, agrees: false });
    expect(p.rows.map((x) => x.name)).toEqual(['Mara Ilie', 'Ana Marin']);
    expect(p.rows.every((x) => x.value === null)).toBe(true);
  });

  it('a tie at the top: either tied first agrees with the card', () => {
    const r = ranking([
      { registrationId: 'b', guestName: 'Ana Marin', quantity: 4, catchCount: 1, generalPosition: 1 },
      { registrationId: 'a', guestName: 'Mara Ilie', quantity: 4, catchCount: 1, generalPosition: 1 },
    ]);
    expect(resultsPodium(card, r).fromRanking).toBe(true);
  });

  it('no ranking read yet: the card’s podium', () => {
    expect(resultsPodium(card, null)).toMatchObject({ fromRanking: false, agrees: true });
  });
});

describe('miniRanking — the headline value per ranking type (core resultHeadline, c34)', () => {
  const fixture = (type: string) =>
    JSON.parse(readFileSync(path.resolve(__dirname, '../../../../../tests/fixtures/rankings', `${type}.json`), 'utf8')) as { rankings: unknown[]; metadata: unknown };

  it('quantityQuality ranks by points (the fewest win), never «kg total»', () => {
    const r = miniRanking(fixture('quantityQuality'));
    expect(r).toMatchObject({ unit: 'puncte', valueLabel: 'puncte', lowerIsBetter: true });
    expect(r.rows[0].value).toBe(2);
  });

  it('bestOfTiers: the winner’s tier average, captioned with its tier', () => {
    const r = miniRanking(fixture('bestOfTiers'));
    expect(r).toMatchObject({ unit: 'kg', valueLabel: 'medie Best 9', lowerIsBetter: false });
    expect(r.rows[0].value).toBe(17.461);
  });

  it('nationalChampionship: the club points', () => {
    const r = miniRanking(fixture('nationalChampionship'));
    expect(r.rows.map((x) => x.value)).toEqual([7, 8, 9]);
    expect(r.unit).toBe('puncte');
  });
});
