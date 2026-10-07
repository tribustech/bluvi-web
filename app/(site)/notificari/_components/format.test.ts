import { describe, expect, it } from 'vitest';
import { formatNotificationTime } from './format';

describe('formatNotificationTime (account.notifications.c6)', () => {
  const now = new Date('2026-10-07T09:00:00.000Z');

  it('this year: «d MMMM, ora HH:mm» in Romanian, Bucharest time', () => {
    // 18:31 UTC = 21:31 in Bucharest (EEST, +3)
    expect(formatNotificationTime('2026-10-03T18:31:59.032Z', now)).toBe('3 octombrie, ora 21:31');
  });

  it('pads the hour and minute', () => {
    // 07:05 UTC in winter = 09:05 (EET, +2)
    expect(formatNotificationTime('2026-01-15T07:05:00.000Z', now)).toBe('15 ianuarie, ora 09:05');
  });

  it('another year: the year after the month', () => {
    expect(formatNotificationTime('2025-12-28T10:00:00.000Z', now)).toBe('28 decembrie 2025, ora 12:00');
  });

  it('the year is Bucharest’s: New Year’s Eve 23:30 UTC is already next year there', () => {
    expect(formatNotificationTime('2025-12-31T23:30:00.000Z', now)).toBe('1 ianuarie, ora 01:30');
  });

  it('an unreadable date shows nothing', () => {
    expect(formatNotificationTime('nope', now)).toBe('');
  });
});
