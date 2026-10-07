import { describe, expect, it } from 'vitest';
import { catchesNoun, partidaRange, popularVenueMeta, venuePartidePage } from './partide-community';
import { createNowTickStore, NOW_TICK_INTERVAL_MS } from './now-tick';

describe('partidaRange (fish fmtRange, Romania time)', () => {
  it('one day: «26 IUL · 06:40 – 18:10»', () => {
    expect(partidaRange('2026-07-26T03:40:00.000Z', '2026-07-26T15:10:00.000Z')).toBe('26 IUL · 06:40 – 18:10');
  });
  it('past midnight names both days', () => {
    expect(partidaRange('2026-09-22T07:24:13.212Z', '2026-09-23T19:30:00.375Z')).toBe('22 SEP 10:24 – 23 SEP 22:30');
  });
});

describe('venuePartidePage (fish venuePartideHref, parity partide.comunitate.c16)', () => {
  it('lake → /balti/<id>/partide', () => {
    expect(venuePartidePage({ key: 'lake:abc', venueType: 'lake', lakeId: 'abc' })).toBe('/balti/abc/partide');
  });
  it('public water → /ape-publice/<code>/partide, the code from «water:<code>», encoded', () => {
    expect(venuePartidePage({ key: 'water:L:RO10_01.025_L3', venueType: 'publicWater', lakeId: null })).toBe(
      `/ape-publice/${encodeURIComponent('L:RO10_01.025_L3')}/partide`,
    );
  });
  it('pin, or a lake without its id → null', () => {
    expect(venuePartidePage({ key: 'pin:1', venueType: 'pin', lakeId: null })).toBeNull();
    expect(venuePartidePage({ key: 'lake:', venueType: 'lake', lakeId: null })).toBeNull();
    expect(venuePartidePage({ key: 'water:', venueType: 'publicWater', lakeId: null })).toBeNull();
  });
});

describe('popularVenueMeta (formatCount plurals)', () => {
  it('singular, plural and «de»', () => {
    expect(popularVenueMeta('Giurgiu', 1)).toBe('Giurgiu · 1 partidă');
    expect(popularVenueMeta('Giurgiu', 3)).toBe('Giurgiu · 3 partide');
    expect(popularVenueMeta(null, 24)).toBe('24 de partide');
  });
  it('catchesNoun', () => {
    expect(catchesNoun(1)).toBe('captură');
    expect(catchesNoun(0)).toBe('capturi');
  });
});

describe('createNowTickStore (fish useNowTick, parity partide.comunitate.c22)', () => {
  function fakeTimers() {
    const intervals = new Map<number, () => void>();
    let next = 1;
    return {
      intervals,
      set: (fn: () => void) => {
        intervals.set(next, fn);
        return next++;
      },
      clear: (id: unknown) => intervals.delete(id as number),
    };
  }

  it('one interval for every subscriber; stops with the last one', () => {
    let now = 1_000_000;
    const timers = fakeTimers();
    const store = createNowTickStore(() => now, timers);
    const a = { n: 0 };
    const b = { n: 0 };
    const offA = store.subscribe(() => a.n++);
    const offB = store.subscribe(() => b.n++);
    expect(timers.intervals.size).toBe(1);
    now += NOW_TICK_INTERVAL_MS;
    [...timers.intervals.values()][0]();
    expect(a.n).toBe(1);
    expect(b.n).toBe(1);
    expect(store.getSnapshot()).toBe(now);
    offA();
    expect(timers.intervals.size).toBe(1);
    offB();
    expect(timers.intervals.size).toBe(0);
  });

  it('idle: the first read after a gap is fresh, repeated reads are stable', () => {
    let now = 0;
    const store = createNowTickStore(() => now, fakeTimers());
    now = 5 * NOW_TICK_INTERVAL_MS;
    const first = store.getSnapshot();
    now += 5;
    expect(first).toBe(5 * NOW_TICK_INTERVAL_MS);
    expect(store.getSnapshot()).toBe(first);
  });
});
