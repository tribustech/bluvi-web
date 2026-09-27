import { describe, expect, it } from 'vitest';
import {
  cashDueToday,
  groupTodayByStand,
  stayProgress,
  todayBand,
  todayListRows,
  todayMoment,
  todayMomentBand,
  todayPhase,
} from './todayCounts';
import type { OperatorUpcomingBooking } from './todayCounts';

// The full fish row (`models/operatorStats.type.ts`) carries more than the slice the helpers read.
type Row = OperatorUpcomingBooking & { anglerName: string | null; anglerAvatar: string | null; code: string | null };

const NOW = new Date('2026-08-23T12:00:00+03:00').getTime();

const row = (over: Partial<Row>): Row => ({
  standName: 'A1',
  anglerName: 'Ion',
  anglerAvatar: null,
  startDate: '2026-08-23T09:00:00+03:00',
  endDate: '2026-08-23T18:00:00+03:00',
  bookingStatus: 'confirmed',
  priceTotal: 100,
  noShow: false,
  code: null,
  ...over,
});

describe('todayPhase', () => {
  it('flags a no-show before anything else', () => {
    expect(todayPhase(row({ noShow: true, bookingStatus: 'confirmed' }), NOW)).toBe('noshow');
  });
  it('reads an unanswered request as pending', () => {
    expect(todayPhase(row({ bookingStatus: 'pending' }), NOW)).toBe('pending');
  });
  it('reads a running window as live', () => {
    expect(todayPhase(row({}), NOW)).toBe('live');
  });
  it('reads a finished window as done', () => {
    expect(todayPhase(row({ endDate: '2026-08-23T10:00:00+03:00' }), NOW)).toBe('done');
  });
  it('reads a future start as next', () => {
    expect(todayPhase(row({ startDate: '2026-08-23T18:00:00+03:00', endDate: '2026-08-24T17:30:00+03:00' }), NOW)).toBe(
      'next'
    );
  });
});

describe('todayBand', () => {
  it('drops empty segments instead of printing zeros', () => {
    const band = todayBand([row({}), row({})], NOW);
    expect(band).toBe('2 pe baltă');
  });
  it('keeps the reading order and singular forms', () => {
    const band = todayBand(
      [
        row({}),
        row({ startDate: '2026-08-23T18:00:00+03:00', endDate: '2026-08-24T17:30:00+03:00' }),
        row({ bookingStatus: 'pending' }),
        row({ endDate: '2026-08-23T10:00:00+03:00' }),
        row({ noShow: true }),
      ],
      NOW
    );
    expect(band).toBe('1 pe baltă · 1 urmează · 1 încheiată · 1 n-a venit');
  });
  it('is empty for an empty day', () => {
    expect(todayBand([], NOW)).toBe('');
  });
});

describe('cashDueToday', () => {
  it('sums honored arrivals that start today', () => {
    expect(cashDueToday([row({ priceTotal: 250 }), row({ priceTotal: 300 })], NOW)).toBe(550);
  });
  it('excludes a stay that started yesterday and is still running', () => {
    const overnight = row({
      startDate: '2026-08-22T18:00:00+03:00',
      endDate: '2026-08-23T17:30:00+03:00',
      priceTotal: 400,
    });
    expect(cashDueToday([overnight], NOW)).toBe(0);
  });
  it('excludes no-shows and unanswered requests', () => {
    expect(
      cashDueToday([row({ noShow: true, priceTotal: 250 }), row({ bookingStatus: 'pending', priceTotal: 300 })], NOW)
    ).toBe(0);
  });
  it('coerces a decimal column arriving as a string', () => {
    expect(cashDueToday([row({ priceTotal: '150.50' as unknown as number })], NOW)).toBe(151);
  });
});

describe('todayListRows', () => {
  it('drops pending requests and orders by stand, naturally', () => {
    const rows = todayListRows([
      row({ standName: '10' }),
      row({ standName: '2', bookingStatus: 'pending' }),
      row({ standName: '9' }),
      row({ standName: 'A1' }),
    ]);
    expect(rows.map(r => r.standName)).toEqual(['9', '10', 'A1']);
  });
});

describe('stayProgress', () => {
  const start = new Date(2026, 7, 28, 18).toISOString();
  const end = new Date(2026, 7, 30, 18).toISOString();
  it('counts elapsed hours while on the lake', () => {
    const now = new Date(2026, 7, 29, 6, 30).getTime();
    expect(stayProgress(row({ startDate: start, endDate: end }), now)).toEqual({
      label: '12h din 48h',
      ratio: 12.5 / 48,
    });
  });
  it('says how long until arrival before the start', () => {
    const now = new Date(2026, 7, 28, 15).getTime();
    expect(stayProgress(row({ startDate: start, endDate: end }), now).label).toBe('peste 3h · 48h');
  });
  it('shows just the length once over', () => {
    const now = new Date(2026, 7, 31).getTime();
    expect(stayProgress(row({ startDate: start, endDate: end }), now)).toEqual({ label: '48h', ratio: 1 });
  });
});

describe('todayMoment', () => {
  // "Today" is Saturday 29 Aug 2026, 10:00 local.
  const now = new Date(2026, 7, 29, 10).getTime();
  const at = (d: number, h: number) => new Date(2026, 7, d, h).toISOString();
  it('a night stay ending this morning has left', () => {
    expect(todayMoment(row({ startDate: at(28, 18), endDate: at(29, 6) }), now)).toEqual({
      kind: 'leaves',
      label: 'a plecat 06:00',
    });
  });
  it('a stay ending tonight leaves', () => {
    expect(todayMoment(row({ startDate: at(28, 18), endDate: at(29, 18) }), now)).toEqual({
      kind: 'leaves',
      label: 'pleacă 18:00',
    });
  });
  it('a stay starting tonight arrives, with its length', () => {
    expect(todayMoment(row({ startDate: at(29, 18), endDate: at(30, 6) }), now)).toEqual({
      kind: 'arrives',
      label: 'vine 18:00 · 12h',
    });
  });
  it('a day tour that already started arrived and will leave', () => {
    expect(todayMoment(row({ startDate: at(29, 6), endDate: at(29, 18) }), now)).toEqual({
      kind: 'arrives',
      label: 'a venit 06:00 · pleacă 18:00',
    });
  });
  it('a long stay that started this morning arrived, with the departure day', () => {
    expect(todayMoment(row({ startDate: at(29, 6), endDate: at(31, 6) }), now)).toEqual({
      kind: 'arrives',
      label: 'a venit 06:00 → Lu 06:00',
    });
  });
  it('a stay spanning today just stays', () => {
    expect(todayMoment(row({ startDate: at(28, 18), endDate: at(30, 18) }), now)).toEqual({
      kind: 'stays',
      label: 'Vi 18:00 → Du 18:00',
    });
  });
});

describe('todayMomentBand', () => {
  it('counts arrivals, stays and departures with Romanian plurals', () => {
    const now = new Date(2026, 7, 29, 10).getTime();
    const at = (d: number, h: number) => new Date(2026, 7, d, h).toISOString();
    const band = todayMomentBand(
      [
        row({ startDate: at(29, 18), endDate: at(30, 6) }),
        row({ startDate: at(29, 6), endDate: at(29, 18) }),
        row({ startDate: at(28, 18), endDate: at(30, 18) }),
        row({ startDate: at(28, 18), endDate: at(29, 6) }),
      ],
      now
    );
    expect(band).toBe('2 vin · 1 stă · 1 pleacă');
  });
});

describe('groupTodayByStand', () => {
  it('one group per stand, natural order, bookings by start, pending dropped', () => {
    const at = (d: number, h: number) => new Date(2026, 7, d, h).toISOString();
    const groups = groupTodayByStand([
      row({ standName: '10', startDate: at(29, 18), endDate: at(30, 6), code: 'late' }),
      row({ standName: '5', startDate: at(29, 18), endDate: at(30, 6), code: 'b' }),
      row({ standName: '5', startDate: at(28, 18), endDate: at(29, 6), code: 'a' }),
      row({ standName: '7', bookingStatus: 'pending' }),
    ]);
    expect(groups.map(g => [g.standName, g.bookings.map(b => b.code)])).toEqual([
      ['5', ['a', 'b']],
      ['10', ['late']],
    ]);
  });
});
