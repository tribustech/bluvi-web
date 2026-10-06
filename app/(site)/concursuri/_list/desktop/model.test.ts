import { describe, expect, it } from 'vitest';
import { bucketOf } from './dates';
import { miniRanking, resultsPodium, viewerRow } from './model';

/* competitions-list.index c30 (agenda buckets), c33 (one podium source), c33/c35 (the viewer by identity). */

describe('bucketOf — the agenda never files a passed start under «Săptămâna asta»', () => {
  // Tuesday 6 Oct 2026, noon in Bucharest.
  const now = new Date('2026-10-06T09:00:00Z');

  it('a not-started competition whose start day passed goes last, in its own bucket — after the months and «Fără dată»', () => {
    const past = bucketOf('2026-09-28T05:00:00Z', now);
    expect(past.key).toBe('past');
    expect(past.order).toBeGreaterThan(bucketOf('2027-12-02T05:00:00Z', now).order);
    expect(past.order).toBeGreaterThan(bucketOf(null, now).order);
    // Sunday 4 Oct: still last week, and still before today.
    expect(bucketOf('2026-10-04T05:00:00Z', now).key).toBe('past');
    // Monday 5 Oct: this week, but yesterday — passed.
    expect(bucketOf('2026-10-05T05:00:00Z', now).key).toBe('past');
  });

  it('today and the rest of the week are «Săptămâna asta»; then next week; then the month', () => {
    expect(bucketOf('2026-10-06T04:00:00Z', now)).toMatchObject({ key: 'w0', label: 'Săptămâna asta' });
    expect(bucketOf('2026-10-11T15:00:00Z', now).key).toBe('w0');
    expect(bucketOf('2026-10-12T05:00:00Z', now)).toMatchObject({ key: 'w1', label: 'Săptămâna viitoare' });
    expect(bucketOf('2026-11-02T05:00:00Z', now)).toMatchObject({ label: 'Noiembrie' });
    expect(bucketOf(null, now).key).toBe('tbd');
  });
});

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
