import { describe, expect, it } from 'vitest';
import { dateRange, dayMonth } from './dates';

describe('venue dates (Romania time)', () => {
  it('dayMonth: «12 IUL»', () => {
    expect(dayMonth('2026-07-12T10:00:00.000Z')).toBe('12 IUL');
  });

  it('dateRange: a same-day partidă keeps the short form', () => {
    // 05:00Z = 08:00 EEST, 15:30Z = 18:30 EEST.
    expect(dateRange('2026-09-20T05:00:00.000Z', '2026-09-20T15:30:00.000Z')).toBe('20 SEP · 08:00 – 18:30');
  });

  it('dateRange: a partidă over several days names both days (58h 30m, 20 → 22 SEP)', () => {
    expect(dateRange('2026-09-20T05:00:00.000Z', '2026-09-22T15:30:00.000Z')).toBe('20 SEP 08:00 – 22 SEP 18:30');
  });

  it('dateRange: past midnight in Romania is another day even when UTC is not', () => {
    // 20:00Z = 23:00 EEST on the 20th; 22:30Z = 01:30 EEST on the 21st.
    expect(dateRange('2026-09-20T20:00:00.000Z', '2026-09-20T22:30:00.000Z')).toBe('20 SEP 23:00 – 21 SEP 01:30');
  });
});
