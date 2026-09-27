import { describe, expect, it } from 'vitest';
import { bookingAgeLabel, isRequestStale } from './bookingAge';

const NOW = new Date('2026-08-18T12:00:00.000Z').getTime();
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const MIN = 60_000;
const HOUR = 60 * MIN;

describe('bookingAgeLabel', () => {
  it('returns null without a timestamp or with a garbage one', () => {
    expect(bookingAgeLabel(undefined, NOW)).toBeNull();
    expect(bookingAgeLabel('not-a-date', NOW)).toBeNull();
  });

  it('reads in minutes inside the first hour', () => {
    expect(bookingAgeLabel(ago(2 * MIN), NOW)).toBe('acum 2 min');
    expect(bookingAgeLabel(ago(59 * MIN), NOW)).toBe('acum 59 min');
  });

  it('keeps the minutes alongside the hours inside the first day', () => {
    expect(bookingAgeLabel(ago(2 * HOUR + 13 * MIN), NOW)).toBe('acum 2 h 13 min');
    expect(bookingAgeLabel(ago(2 * HOUR), NOW)).toBe('acum 2 h');
    expect(bookingAgeLabel(ago(23 * HOUR + 59 * MIN), NOW)).toBe('acum 23 h 59 min');
  });

  it('drops to whole days past 24h', () => {
    expect(bookingAgeLabel(ago(24 * HOUR), NOW)).toBe('acum o zi');
    expect(bookingAgeLabel(ago(72 * HOUR), NOW)).toBe('acum 3 zile');
    expect(bookingAgeLabel(ago(47 * HOUR), NOW)).toBe('acum o zi');
  });

  it('never reads negative when the row is slightly ahead of the device clock', () => {
    expect(bookingAgeLabel(new Date(NOW + 30_000).toISOString(), NOW)).toBe('acum câteva secunde');
  });
});

describe('isRequestStale', () => {
  it('flags a pending request only once it passes five hours', () => {
    expect(isRequestStale(ago(4 * HOUR + 59 * MIN), true, NOW)).toBe(false);
    expect(isRequestStale(ago(5 * HOUR), true, NOW)).toBe(true);
  });

  it('never flags a booking that is no longer waiting on the operator', () => {
    expect(isRequestStale(ago(40 * HOUR), false, NOW)).toBe(false);
  });

  it('is false without a timestamp', () => {
    expect(isRequestStale(undefined, true, NOW)).toBe(false);
  });
});
