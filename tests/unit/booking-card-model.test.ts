import { describe, expect, it } from 'vitest';
import type { BookingDTO } from '@/core/booking';
import { bookingCardModel, bookingTone, startsInText } from '@/components/booking/model';

const H = 3_600_000;
// A fixed local noon, so day boundaries never depend on when the suite runs.
const NOW = new Date(2026, 9, 7, 12, 0, 0).getTime();
const iso = (ms: number) => new Date(ms).toISOString();

function booking(over: Partial<BookingDTO> = {}): BookingDTO {
  return {
    documentId: 'b1',
    code: 'BK-1',
    startDate: iso(NOW + 48 * H),
    endDate: iso(NOW + 60 * H),
    bookingStatus: 'confirmed',
    priceTotal: 150,
    depositAmount: 0,
    paymentStatus: 'none',
    contactPhone: '+40700000000',
    lake: { documentId: 'l1', name: 'Chita Lake', contactPhone: null, minCancelNoticeHours: 0, checkoutBufferMinutes: 0 },
    stand: { documentId: 's1', name: '5' },
    ...over,
  };
}

describe('startsInText — fish startsInLabel with formatCount', () => {
  const at = (days: number) => iso(new Date(2026, 9, 7 + days, 10, 0).getTime() + (days === 0 ? 4 * H : 0));
  it('astăzi / mâine / în N zile (de from 20, like formatCount)', () => {
    expect(startsInText(at(0), NOW)).toBe('Începe astăzi');
    expect(startsInText(at(1), NOW)).toBe('Începe mâine');
    expect(startsInText(at(3), NOW)).toBe('Începe în 3 zile');
    expect(startsInText(at(19), NOW)).toBe('Începe în 19 zile');
    expect(startsInText(at(20), NOW)).toBe('Începe în 20 de zile');
    expect(startsInText(at(102), NOW)).toBe('Începe în 102 zile');
  });
  it('null once started', () => expect(startsInText(iso(NOW - H), NOW)).toBeNull());
});

describe('bookingTone', () => {
  it('maps fish statusModel tints, no-show and unknown', () => {
    expect(bookingTone('pending')).toBe('warning');
    expect(bookingTone('confirmed')).toBe('success');
    expect(bookingTone('completed')).toBe('outline');
    expect(bookingTone('rejected')).toBe('danger');
    expect(bookingTone('cancelled')).toBe('danger');
    expect(bookingTone('confirmed', true)).toBe('danger');
    expect(bookingTone('paused')).toBe('warning');
  });
});

describe('bookingCardModel (fish MyBookingRow)', () => {
  it('future confirmed: period · hours, starts-in, stand, no progress', () => {
    const m = bookingCardModel(booking({ basis: { durationHours: 12, rowLabel: null, composedFrom: [12], tourPrice: 150, extras: [{ key: 'boat', label: 'Barcă', unit: 'perStay', unitPrice: 50, quantity: 1, total: 50 }] } }), NOW);
    expect(m.standLabel).toBe('Standul 5');
    expect(m.periodLine).toMatch(/ → .* · 12h$/);
    expect(m.startsIn).toBe('Începe în 2 zile');
    expect(m.live).toBe(false);
    expect(m.extras).toEqual([{ key: 'boat', label: 'Barcă' }]);
    expect(m.appearance.label).toBe('Confirmată');
    expect(m.quiet).toBe(false);
  });

  it('end minus the checkout buffer', () => {
    const b = booking({
      startDate: iso(new Date(2026, 9, 9, 6, 0).getTime()),
      endDate: iso(new Date(2026, 9, 9, 18, 0).getTime()),
      lake: { documentId: 'l1', name: 'X', contactPhone: null, minCancelNoticeHours: 0, checkoutBufferMinutes: 30 },
    });
    expect(bookingCardModel(b, NOW).periodLine).toBe('Vi 9 oct 06:00 → Vi 9 oct 17:30 · 12h');
  });

  it('live: no hours suffix, progress, no starts-in', () => {
    const m = bookingCardModel(booking({ startDate: iso(NOW - 3 * H), endDate: iso(NOW + 9 * H) }), NOW);
    expect(m.live).toBe(true);
    expect(m.periodLine).not.toMatch(/·/);
    expect(m.progressLabel).toBe('3h din 12h');
    expect(m.progressPct).toBe(25);
    expect(m.startsIn).toBeNull();
  });

  it('dead bookings: quiet, reason, labels per side', () => {
    const cancelled = bookingCardModel(booking({ bookingStatus: 'cancelled', cancelledBy: 'operator', cancelReason: 'Lucrări la baltă.' }), NOW);
    expect(cancelled.quiet).toBe(true);
    expect(cancelled.appearance.label).toBe('Anulată de baltă');
    expect(cancelled.deadReason).toBe('Lucrări la baltă.');
    expect(cancelled.startsIn).toBeNull();
    expect(bookingCardModel(booking({ bookingStatus: 'cancelled', cancelledBy: 'angler' }), NOW).appearance.label).toBe('Anulată de tine');
    expect(bookingCardModel(booking({ bookingStatus: 'cancelled', cancelledBy: 'system' }), NOW).appearance.label).toBe('Anulare automată');
    expect(bookingCardModel(booking({ bookingStatus: 'cancelled' }), NOW).appearance.label).toBe('Anulată');
    const noShowDefault = bookingCardModel(booking({ noShow: true, noShowComment: 'Pescarul nu s-a prezentat.' }), NOW);
    expect(noShowDefault.appearance.label).toBe('Nu a venit');
    expect(noShowDefault.deadReason).toBeNull();
    expect(bookingCardModel(booking({ noShow: true, noShowComment: 'A sunat la 5 dimineața.' }), NOW).deadReason).toBe('A sunat la 5 dimineața.');
  });

  it('pending warning; unknown status falls back to pending; lake fallback «Lac»', () => {
    expect(bookingCardModel(booking({ bookingStatus: 'pending' }), NOW).pending).toBe(true);
    const unknown = bookingCardModel(booking({ bookingStatus: 'paused', lake: undefined, stand: undefined }), NOW);
    expect(unknown.appearance.label).toBe('În așteptare');
    expect(unknown.lakeName).toBe('Lac');
    expect(unknown.standLabel).toBeNull();
  });
});
