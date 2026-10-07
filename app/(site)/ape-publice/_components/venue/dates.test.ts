import { describe, expect, it } from 'vitest';
import { dateRange, dayMonth, fmtDuration } from './dates';

const NOW = Date.parse('2026-10-07T10:00:00.000Z');

describe('venue dates (Romania time)', () => {
  it('dayMonth: «12 IUL»', () => {
    expect(dayMonth('2026-07-12T10:00:00.000Z')).toBe('12 IUL');
  });

  it('dateRange: a same-day partidă keeps the short form', () => {
    // 05:00Z = 08:00 EEST, 15:30Z = 18:30 EEST.
    expect(dateRange('2026-09-20T05:00:00.000Z', '2026-09-20T15:30:00.000Z', NOW)).toBe('20 SEP · 08:00 – 18:30');
  });

  it('dateRange: a partidă over several days names both days (58h 30m, 20 → 22 SEP)', () => {
    expect(dateRange('2026-09-20T05:00:00.000Z', '2026-09-22T15:30:00.000Z', NOW)).toBe('20 SEP 08:00 – 22 SEP 18:30');
  });

  it('dateRange: past midnight in Romania is another day even when UTC is not', () => {
    // 20:00Z = 23:00 EEST on the 20th; 22:30Z = 01:30 EEST on the 21st.
    expect(dateRange('2026-09-20T20:00:00.000Z', '2026-09-20T22:30:00.000Z', NOW)).toBe('20 SEP 23:00 – 21 SEP 01:30');
  });

  it('dateRange: another year carries it (Romania time); the current year keeps fish\'s form', () => {
    const now = Date.parse('2026-10-07T10:00:00.000Z');
    expect(dateRange('2026-08-09T06:07:00.000Z', '2026-08-09T10:20:00.000Z', now)).toBe('9 AUG · 09:07 – 13:20');
    expect(dateRange('2025-08-09T06:07:00.000Z', '2025-08-09T10:20:00.000Z', now)).toBe('9 AUG 2025 · 09:07 – 13:20');
    expect(dateRange('2025-08-09T06:07:00.000Z', '2025-08-11T05:51:00.000Z', now)).toBe('9 AUG 09:07 – 11 AUG 2025 08:51');
    // Across New Year (Romania: 31 DEC 22:00 → 1 IAN 02:00): both years.
    expect(dateRange('2025-12-31T20:00:00.000Z', '2026-01-01T00:00:00.000Z', now)).toBe('31 DEC 2025 22:00 – 1 IAN 2026 02:00');
    // New Year's Eve 23:30 UTC is already the new year in Romania.
    expect(dateRange('2026-12-31T22:30:00.000Z', '2026-12-31T23:30:00.000Z', Date.parse('2026-12-31T12:00:00.000Z'))).toBe('1 IAN 2027 · 00:30 – 01:30');
  });

  it('fmtDuration: spaced units, one family, never «0 min»', () => {
    const min = 60_000;
    expect(fmtDuration(0)).toBe('<1 min');
    expect(fmtDuration(59_000)).toBe('<1 min');
    expect(fmtDuration(18 * min)).toBe('18 min');
    expect(fmtDuration(60 * min)).toBe('1 h');
    expect(fmtDuration((29 * 60 + 5) * min)).toBe('29 h 5 min');
    expect(fmtDuration((47 * 60 + 44) * min)).toBe('47 h 44 min');
    expect(fmtDuration(-5)).toBe('<1 min');
  });
});
