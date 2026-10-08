import { describe, expect, it } from 'vitest';
import type { BookingDTO } from '@/core/booking';
import { findBookingForCell, mayBeOnLaterPage } from './findBookingForCell';

const b = (id: string, stand: string | null, start: string, end: string, status = 'confirmed'): BookingDTO =>
  ({
    documentId: id,
    code: id.toUpperCase(),
    startDate: start,
    endDate: end,
    bookingStatus: status,
    priceTotal: 0,
    depositAmount: 0,
    paymentStatus: 'unpaid',
    contactPhone: '',
    ...(stand ? { stand: { documentId: stand, name: stand } } : {}),
  }) as BookingDTO;

const CELL = { standDocumentId: 's1', startISO: '2026-10-10T06:00:00+03:00', endISO: '2026-10-10T18:00:00+03:00' };

describe('findBookingForCell (operator.calendar.c6)', () => {
  it('matches by stand and overlap, not exact bounds (a booking spanning several slots)', () => {
    const long = b('a', 's1', '2026-10-09T18:00:00+03:00', '2026-10-11T06:00:00+03:00');
    expect(findBookingForCell([long], CELL)).toBe(long);
  });

  it('another stand, or a booking that only touches the slot, is no match', () => {
    const other = b('a', 's2', CELL.startISO, CELL.endISO);
    const before = b('b', 's1', '2026-10-09T18:00:00+03:00', CELL.startISO);
    const after = b('c', 's1', CELL.endISO, '2026-10-11T06:00:00+03:00');
    const noStand = b('d', null, CELL.startISO, CELL.endISO);
    expect(findBookingForCell([other, before, after, noStand], CELL)).toBeNull();
  });

  it('nothing loaded (or beyond the loaded pages) → null', () => {
    expect(findBookingForCell([], CELL)).toBeNull();
  });

  it('a booking that still holds the stand wins over a cancelled / rejected one on the same slot', () => {
    const cancelled = b('x', 's1', CELL.startISO, CELL.endISO, 'cancelled');
    const live = b('y', 's1', CELL.startISO, CELL.endISO, 'pending');
    expect(findBookingForCell([cancelled, live], CELL)).toBe(live);
    expect(findBookingForCell([cancelled], CELL)).toBe(cancelled);
  });

  it('compares instants, whatever the offset spelling', () => {
    const utc = b('u', 's1', '2026-10-10T03:00:00.000Z', '2026-10-10T15:00:00.000Z');
    expect(findBookingForCell([utc], CELL)).toBe(utc);
  });

  it('a malformed cell matches nothing', () => {
    expect(findBookingForCell([b('a', 's1', CELL.startISO, CELL.endISO)], { ...CELL, startISO: 'x' })).toBeNull();
  });
});

describe('mayBeOnLaterPage (the list is latest-first, bounded by the booked interval\'s start)', () => {
  const at = (start: string) => b('a', 's9', start, start);
  const cell = (bookingStartISO: string | null) => ({ ...CELL, bookingStartISO });

  it('the last loaded booking starts at or after the booked interval → a later page may hold it', () => {
    expect(mayBeOnLaterPage([at('2026-11-20T06:00:00+02:00')], cell('2026-10-10T06:00:00+03:00'))).toBe(true);
    // A tie: the next page may hold another booking with the same start.
    expect(mayBeOnLaterPage([at('2026-10-10T06:00:00+03:00')], cell('2026-10-10T06:00:00+03:00'))).toBe(true);
  });

  it('a stay longer than three days: still read on while the list has not passed its start', () => {
    // A 6-night stay from Oct 5 06:00, tapped on its 5th day (Oct 10): the list's last row (Oct 7)
    // starts 3 days before the slot — the old 3-day guess gave up here and the band opened nothing.
    const sixNights = cell('2026-10-05T06:00:00+03:00');
    expect(mayBeOnLaterPage([at('2026-10-07T06:00:00+03:00')], sixNights)).toBe(true);
    expect(mayBeOnLaterPage([at('2026-10-05T06:00:00+03:00')], sixNights)).toBe(true);
    // Once the list is past its start, no later page can hold it.
    expect(mayBeOnLaterPage([at('2026-10-04T18:00:00+03:00')], sixNights)).toBe(false);
  });

  it('and the stay is found on the page that reaches it (overlap, not the tapped bounds)', () => {
    const stay = b('long', 's1', '2026-10-05T06:00:00+03:00', '2026-10-11T06:00:00+03:00');
    const page1 = [b('x', 's2', '2026-10-20T06:00:00+03:00', '2026-10-20T18:00:00+03:00'), b('y', 's3', '2026-10-07T06:00:00+03:00', '2026-10-07T18:00:00+03:00')];
    const sixNights = cell('2026-10-05T06:00:00+03:00');
    expect(findBookingForCell(page1, sixNights)).toBeNull();
    expect(mayBeOnLaterPage(page1, sixNights)).toBe(true);
    expect(findBookingForCell([...page1, stay], sixNights)).toBe(stay);
  });

  it('nothing loaded → no; no bound known (never for a booked band) → read on until the guard', () => {
    expect(mayBeOnLaterPage([], cell('2026-10-05T06:00:00+03:00'))).toBe(false);
    expect(mayBeOnLaterPage([at('2026-01-01T06:00:00+02:00')], cell(null))).toBe(true);
  });
});
