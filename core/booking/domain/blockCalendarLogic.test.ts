import { describe, expect, it } from 'vitest';
import { nextRange, isInRange, busyDaySet, blockTimeOptions, buildBlockInterval } from './blockCalendarLogic';

describe('nextRange', () => {
  it('first tap sets the start', () => {
    expect(nextRange({}, '2026-08-20')).toEqual({ startDate: '2026-08-20', endDate: undefined });
  });
  it('second (later) tap sets the end', () => {
    expect(nextRange({ startDate: '2026-08-20' }, '2026-08-22')).toEqual({
      startDate: '2026-08-20',
      endDate: '2026-08-22',
    });
  });
  it('same-day second tap makes a one-day range', () => {
    expect(nextRange({ startDate: '2026-08-20' }, '2026-08-20')).toEqual({
      startDate: '2026-08-20',
      endDate: '2026-08-20',
    });
  });
  it('tapping before the start restarts the selection', () => {
    expect(nextRange({ startDate: '2026-08-20' }, '2026-08-18')).toEqual({
      startDate: '2026-08-18',
      endDate: undefined,
    });
  });
  it('tapping with a complete range restarts', () => {
    expect(nextRange({ startDate: '2026-08-20', endDate: '2026-08-22' }, '2026-08-25')).toEqual({
      startDate: '2026-08-25',
      endDate: undefined,
    });
  });
});

describe('isInRange', () => {
  it('start-only highlights just the start day', () => {
    expect(isInRange('2026-08-20', { startDate: '2026-08-20' })).toBe(true);
    expect(isInRange('2026-08-21', { startDate: '2026-08-20' })).toBe(false);
  });
  it('full range is inclusive', () => {
    const r = { startDate: '2026-08-20', endDate: '2026-08-22' };
    expect(isInRange('2026-08-20', r)).toBe(true);
    expect(isInRange('2026-08-21', r)).toBe(true);
    expect(isInRange('2026-08-22', r)).toBe(true);
    expect(isInRange('2026-08-23', r)).toBe(false);
  });
});

describe('busyDaySet', () => {
  it('marks every day an interval touches', () => {
    const days = busyDaySet([{ start: '2026-08-20T06:00:00.000Z', end: '2026-08-21T18:00:00.000Z' }]);
    expect(days.has('2026-08-20')).toBe(true);
    expect(days.has('2026-08-21')).toBe(true);
    expect(days.has('2026-08-22')).toBe(false);
  });
  it('an interval ending exactly at midnight does not touch that day', () => {
    const days = busyDaySet([
      { start: new Date(2026, 7, 20, 0, 0).toISOString(), end: new Date(2026, 7, 21, 0, 0).toISOString() },
    ]);
    expect(days.has('2026-08-20')).toBe(true);
    expect(days.has('2026-08-21')).toBe(false);
  });
});

describe('busyDaySet uses lake-local calendar days', () => {
  // A block Fri 00:00 → Mon 00:00 in the local zone (Thu 21:00Z in Romania) must
  // NOT paint Thursday. Built from local Dates so the test holds in any TZ.
  it('a local-midnight block does not leak into the previous UTC day', () => {
    const days = busyDaySet([
      { start: new Date(2026, 8, 4, 0, 0).toISOString(), end: new Date(2026, 8, 7, 0, 0).toISOString() },
    ]);
    expect([...days].sort()).toEqual(['2026-09-04', '2026-09-05', '2026-09-06']);
  });
});

describe('blockTimeOptions', () => {
  it('is 00:00, the lake slot starts (sorted, deduped) and 24:00', () => {
    expect(blockTimeOptions(['18:00', '06:00', '06:00'])).toEqual(['00:00', '06:00', '18:00', '24:00']);
  });
  it('falls back to whole days when the lake has no slots', () => {
    expect(blockTimeOptions([])).toEqual(['00:00', '24:00']);
  });
});

describe('buildBlockInterval', () => {
  it('whole-day range: start day 00:00 → day after end day 00:00', () => {
    const r = buildBlockInterval({ startDate: '2026-09-04', endDate: '2026-09-06' }, '00:00', '24:00');
    expect(r).toEqual({
      start: new Date(2026, 8, 4, 0, 0).toISOString(),
      end: new Date(2026, 8, 7, 0, 0).toISOString(),
    });
  });
  it('applies the picked hours on the end day itself', () => {
    const r = buildBlockInterval({ startDate: '2026-09-04', endDate: '2026-09-06' }, '18:00', '06:00');
    expect(r).toEqual({
      start: new Date(2026, 8, 4, 18, 0).toISOString(),
      end: new Date(2026, 8, 6, 6, 0).toISOString(),
    });
  });
  it('same-day 06:00 → 18:00 is a half-day block', () => {
    const r = buildBlockInterval({ startDate: '2026-09-04', endDate: '2026-09-04' }, '06:00', '18:00');
    expect(r).toEqual({
      start: new Date(2026, 8, 4, 6, 0).toISOString(),
      end: new Date(2026, 8, 4, 18, 0).toISOString(),
    });
  });
  it('returns null while the range is incomplete', () => {
    expect(buildBlockInterval({ startDate: '2026-09-04' }, '00:00', '24:00')).toBeNull();
    expect(buildBlockInterval({}, '00:00', '24:00')).toBeNull();
  });
});
