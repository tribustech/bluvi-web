import { describe, expect, it } from 'vitest';
import type { CompetitionCard, RecentWeighing } from '@/core/competitions';
import type { MiniRanking, MiniRow } from '../desktop/model';
import { avatarsOf, latestByCompetition, liveOrder, myStanding, nextStart, shortAgo, startsWhen, stripItems, unitWord } from './model';

const card = (documentId: string, startDate: string | null, name = documentId): CompetitionCard =>
  ({ documentId, name, startDate, dateLabel: '20 oct', hoursLabel: '08:00–16:00' }) as CompetitionCard;

const row = (key: string, position: number, value: number | null, sector: string | null = 'A'): MiniRow => ({
  key,
  position,
  name: key,
  avatar: null,
  sector,
  stand: '1',
  value,
  catches: 1,
  biggest: 0,
  delta: null,
  fresh: false,
  userIds: [],
  registrationId: key,
});

const ranking = (rows: MiniRow[], lowerIsBetter = false): MiniRanking => ({
  rows,
  valueLabel: 'kg total',
  unit: lowerIsBetter ? 'puncte' : 'kg',
  lowerIsBetter,
  totalKg: null,
  totalCatches: null,
  biggestCatch: null,
});

const weighing = (id: string, comp: string, endAt: string): RecentWeighing => ({
  weighingDocumentId: id,
  endAt,
  weighingType: 'normal',
  competition: { documentId: comp, name: comp, posterUrl: null },
  standLabel: 'Stand 1',
  angler: null,
  catchCount: 1,
  totalKg: 2,
});

describe('liveOrder', () => {
  it('puts mine first, then by start time, then by name; never by activity', () => {
    const cards = [card('c', '2026-10-06T07:00:00Z'), card('a', '2026-10-06T05:00:00Z'), card('b', '2026-10-06T05:00:00Z', 'Ă'), card('n', null)];
    expect(liveOrder(cards, new Set()).map((c) => c.documentId)).toEqual(['a', 'b', 'c', 'n']);
    expect(liveOrder(cards, new Set(['c'])).map((c) => c.documentId)).toEqual(['c', 'a', 'b', 'n']);
  });

  it('is the same order whatever order the poll answers in', () => {
    const cards = [card('x', '2026-10-06T07:00:00Z'), card('y', '2026-10-06T06:00:00Z')];
    expect(liveOrder(cards, new Set()).map((c) => c.documentId)).toEqual(liveOrder([...cards].reverse(), new Set()).map((c) => c.documentId));
  });
});

describe('unitWord', () => {
  it('reads kg, or points with Romanian agreement', () => {
    expect(unitWord('kg', 3)).toBe('kg');
    expect(unitWord('puncte', 1)).toBe('punct');
    expect(unitWord('puncte', 2.5)).toBe('puncte');
    expect(unitWord('puncte', 20)).toBe('de puncte');
  });
});

describe('myStanding', () => {
  const rows = [row('l', 1, 30), row('b', 2, 20, 'B'), row('me', 3, 12.5), row('c', 4, 5)];
  it('my place, my sector place and the gap to the leader', () => {
    const s = myStanding(ranking(rows), rows[2]);
    expect(s).toMatchObject({ of: 4, sectorPlace: 2, gapToLeader: 17.5, leads: false });
  });
  it('the leader has no gap; points count the other way', () => {
    expect(myStanding(ranking(rows), rows[0])).toMatchObject({ leads: true, gapToLeader: null, sectorPlace: 1 });
    const pts = [row('l', 1, 3), row('me', 2, 7, null)];
    expect(myStanding(ranking(pts, true), pts[1])).toMatchObject({ gapToLeader: 4, sectorPlace: null });
  });
  it('null when the ranking does not list me', () => {
    expect(myStanding(ranking(rows), null)).toBeNull();
  });
});

describe('strip', () => {
  const items = [weighing('1', 'a', '2026-10-06T08:00:00Z'), weighing('2', 'b', '2026-10-06T09:00:00Z'), weighing('3', 'a', '2026-10-06T08:30:00Z')];
  it('newest first, narrowed to the given competitions', () => {
    expect(stripItems(items, null).map((w) => w.weighingDocumentId)).toEqual(['2', '3', '1']);
    expect(stripItems(items, new Set(['a'])).map((w) => w.weighingDocumentId)).toEqual(['3', '1']);
    expect(stripItems(items, null, 1)).toHaveLength(1);
  });
  it('each competition’s newest weighing', () => {
    expect(latestByCompetition(items)).toEqual({ a: '3', b: '2' });
  });
  it('short relative times', () => {
    const now = Date.parse('2026-10-06T09:00:00Z');
    expect(shortAgo('2026-10-06T08:59:30Z', now)).toBe('chiar acum');
    expect(shortAgo('2026-10-06T08:57:00Z', now)).toBe('acum 3 min');
    expect(shortAgo('2026-10-06T06:50:00Z', now)).toBe('acum 2 h');
    expect(shortAgo('2026-10-05T06:50:00Z', now)).toBe('ieri');
    expect(shortAgo('2026-10-03T06:50:00Z', now)).toBe('acum 3 zile');
    expect(shortAgo('2026-09-10T06:50:00Z', now)).toBe('acum 26 de zile');
  });
});

describe('next start', () => {
  it('the first start still ahead, with the server’s labels', () => {
    const now = Date.parse('2026-10-06T09:00:00Z');
    const next = nextStart([card('past', '2026-10-05T05:00:00Z'), card('later', '2026-10-09T05:00:00Z'), card('soon', '2026-10-07T05:00:00Z')], now);
    expect(next?.documentId).toBe('soon');
    expect(startsWhen(next!)).toBe('pe 20 oct la 08:00');
    expect(startsWhen({ ...next!, hoursLabel: null })).toBe('pe 20 oct');
    expect(startsWhen({ ...next!, dateLabel: '10–11 oct', hoursLabel: null })).toBe('pe 10 oct');
    expect(startsWhen({ ...next!, dateLabel: '30 sept–2 oct', hoursLabel: null })).toBe('pe 30 sept');
    expect(nextStart([card('past', '2026-10-05T05:00:00Z')], now)).toBeNull();
  });
});

describe('avatarsOf', () => {
  it('maps the podium names to their first photo, skipping rows without one', () => {
    const c = {
      ...card('a', null),
      results: {
        podium: [
          { position: 1, tied: false, displayName: 'Ion', standName: null, clubName: null, avatarUrls: ['u1', 'u2'] },
          { position: 2, tied: false, displayName: 'Ana', standName: null, clubName: null, avatarUrls: [] },
        ],
      },
    } as unknown as CompetitionCard;
    expect([...avatarsOf(c)]).toEqual([['Ion', 'u1']]);
    expect(avatarsOf(card('b', null)).size).toBe(0);
  });
});
