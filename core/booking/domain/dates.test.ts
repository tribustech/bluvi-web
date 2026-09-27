import { describe, expect, it } from 'vitest';
import {
  addDays,
  differenceInCalendarDays,
  formatDayKey,
  formatLocalIso,
  formatMonthAbbr,
  formatMonthYear,
  formatWeekdayShort,
  formatWeekdayWide,
  isSameDay,
  startOfDay,
  startOfMonthOffset,
} from './dates';
import { bookingActionGates, cancellationPolicyText, startsInLabel, when } from './bookingCard';
import type { BookingDTO } from '../schemas';

// These replace date-fns in the port: pinned to the outputs date-fns gives in the Romanian zone,
// so the circular expectations elsewhere (timezone.test fallback) stay anchored.
process.env.TZ = 'Europe/Bucharest';

describe('date-fns replacements (device-local, Europe/Bucharest)', () => {
  it('formats ISO with the local offset like "yyyy-MM-dd\'T\'HH:mm:ssxxx"', () => {
    expect(formatLocalIso(new Date(2026, 6, 15, 6, 0))).toBe('2026-07-15T06:00:00+03:00');
    expect(formatLocalIso(new Date(2026, 0, 15, 18, 30, 5))).toBe('2026-01-15T18:30:05+02:00');
  });

  it('counts calendar days across the DST change', () => {
    expect(differenceInCalendarDays(new Date(2025, 9, 27), new Date(2025, 9, 26))).toBe(1);
    expect(differenceInCalendarDays(new Date(2026, 2, 30, 23), new Date(2026, 2, 29, 0))).toBe(1);
  });

  it('adds local days and starts days / months', () => {
    expect(formatLocalIso(addDays(new Date(2025, 9, 25, 12), 2))).toBe('2025-10-27T12:00:00+02:00');
    expect(formatLocalIso(startOfDay(new Date(2026, 5, 13, 17, 45)))).toBe('2026-06-13T00:00:00+03:00');
    expect(formatDayKey(startOfMonthOffset(new Date(2026, 0, 31), 1))).toBe('2026-02-01');
    expect(formatDayKey(startOfMonthOffset(new Date(2026, 0, 15), -1))).toBe('2025-12-01');
    expect(isSameDay(new Date(2026, 5, 13, 0), new Date(2026, 5, 13, 23, 59))).toBe(true);
  });

  it('uses the date-fns ro locale names', () => {
    const sun = new Date(2026, 7, 23);
    expect(formatWeekdayWide(sun)).toBe('duminică');
    expect(formatWeekdayShort(sun)).toBe('du');
    expect(formatMonthAbbr(new Date(2026, 8, 1))).toBe('sep');
    expect(formatMonthYear(new Date(2026, 8, 1))).toBe('septembrie 2026');
  });
});

describe('booking card helpers', () => {
  const booking = (over: Partial<BookingDTO>): BookingDTO => ({
    documentId: 'b',
    code: 'BK-1',
    startDate: new Date(2026, 7, 27, 18).toISOString(),
    endDate: new Date(2026, 7, 28, 6).toISOString(),
    bookingStatus: 'confirmed',
    priceTotal: 100,
    depositAmount: 0,
    paymentStatus: 'none',
    contactPhone: '+40',
    ...over,
  });

  it('writes the operator list date like fish "EEEEEE d MMM HH:mm"', () => {
    expect(when(new Date(2026, 7, 27, 18).toISOString())).toBe('Jo 27 aug 18:00');
  });

  it('says when a booking starts', () => {
    const now = new Date(2026, 7, 27, 10).getTime();
    expect(startsInLabel(new Date(2026, 7, 27, 18).toISOString(), now)).toBe('Începe astăzi');
    expect(startsInLabel(new Date(2026, 7, 28, 6).toISOString(), now)).toBe('Începe mâine');
    expect(startsInLabel(new Date(2026, 8, 20, 6).toISOString(), now)).toBe('Începe în 24 de zile');
    expect(startsInLabel(new Date(2026, 7, 26).toISOString(), now)).toBeNull();
  });

  it('gates operator actions', () => {
    const during = new Date(2026, 7, 27, 20).getTime();
    expect(bookingActionGates(booking({}), during)).toMatchObject({ canCancel: true, canRate: false });
    const after = new Date(2026, 7, 29).getTime();
    expect(bookingActionGates(booking({}), after)).toMatchObject({ ended: true, canCancel: false, canRate: true });
    expect(bookingActionGates(booking({ noShow: true }), after).canRate).toBe(false);
  });

  it('explains the cancellation policy', () => {
    expect(cancellationPolicyText({ type: 'refundable', refundWindowHours: 48 })).toBe(
      'Anulare cu rambursare dacă anulezi cu cel puțin 48 ore înainte.'
    );
    expect(cancellationPolicyText(null)).toBe('Contactează administratorul lacului pentru detalii despre anulare.');
  });
});
