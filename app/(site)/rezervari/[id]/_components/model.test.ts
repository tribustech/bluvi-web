import { describe, expect, it } from 'vitest';
import type { BookingDTO } from '@/core/booking';
import { bookingDetailModel, cancelNoticeLine, composedLine, dayMonthTime, formatPhone, isPastBooking, priceRows } from './model';

/* booking.rezervare c3–c5, c10–c13 — the page's gates (fish MyBookingRow `actions`, bookings/[id].tsx). */

const H = 3_600_000;
const NOW = new Date(2026, 9, 7, 12, 0).getTime();
const iso = (ms: number) => new Date(ms).toISOString();

function b(over: Partial<BookingDTO> = {}, lake: Partial<NonNullable<BookingDTO['lake']>> = {}): BookingDTO {
  return {
    documentId: 'bk1',
    code: 'BK-1',
    startDate: iso(NOW + 48 * H),
    endDate: iso(NOW + 60 * H),
    bookingStatus: 'confirmed',
    priceTotal: 150,
    depositAmount: 0,
    paymentStatus: 'none',
    contactPhone: '0700',
    lake: {
      documentId: 'lake1',
      name: 'Chita Lake',
      contactPhone: '0712345678',
      minCancelNoticeHours: 24,
      checkoutBufferMinutes: 0,
      ...lake,
    },
    ...over,
  } as BookingDTO;
}

describe('bookingDetailModel — actions', () => {
  it('confirmed future, window open: cancel + «Sună la baltă», no notice', () => {
    const m = bookingDetailModel(b(), NOW);
    expect(m).toMatchObject({ canCancel: true, showCancel: true, noticeClosed: false, callLabel: 'Sună la baltă', lakePhone: '0712345678', noticeLine: null, reviewable: false, rebook: null });
  });

  it('inside the notice window, not started: call «Sună pentru anulare» only + the notice line (formatCount)', () => {
    const m = bookingDetailModel(b({ startDate: iso(NOW + 5 * H), endDate: iso(NOW + 17 * H) }), NOW);
    expect(m).toMatchObject({ noticeClosed: true, showCancel: false, callLabel: 'Sună pentru anulare' });
    expect(m.noticeLine).toBe('Anulările cu mai puțin de 24 de ore înainte de început se fac telefonic.');
  });

  it('live (started, not ended): «Sună la baltă», no cancel', () => {
    const m = bookingDetailModel(b({ startDate: iso(NOW - 2 * H), endDate: iso(NOW + 10 * H) }), NOW);
    expect(m).toMatchObject({ canCancel: true, noticeClosed: true, showCancel: false, callLabel: 'Sună la baltă' });
  });

  it('no notice rule (0 / null): cancel stays open until the end', () => {
    const m = bookingDetailModel(b({ startDate: iso(NOW - 2 * H), endDate: iso(NOW + 10 * H) }, { minCancelNoticeHours: 0 }), NOW);
    expect(m).toMatchObject({ noticeClosed: false, showCancel: true, noticeLine: null });
    expect(bookingDetailModel(b({}, { minCancelNoticeHours: null }), NOW).showCancel).toBe(true);
  });

  it('no lake phone: no call button', () => {
    expect(bookingDetailModel(b({}, { contactPhone: null }), NOW)).toMatchObject({ callLabel: null, lakePhone: null, showCancel: true });
    expect(bookingDetailModel(b({}, { contactPhone: '  ' }), NOW).callLabel).toBeNull();
  });

  it('pending is cancellable; rejected / cancelled / completed / ended are not', () => {
    expect(bookingDetailModel(b({ bookingStatus: 'pending' }), NOW).showCancel).toBe(true);
    for (const s of ['rejected', 'cancelled', 'completed']) expect(bookingDetailModel(b({ bookingStatus: s }), NOW).canCancel).toBe(false);
    expect(bookingDetailModel(b({ startDate: iso(NOW - 20 * H), endDate: iso(NOW - 8 * H) }), NOW).canCancel).toBe(false);
  });

  it('ended = end minus the checkout buffer', () => {
    const near = b({ startDate: iso(NOW - 12 * H), endDate: iso(NOW + 20 * 60_000) }, { checkoutBufferMinutes: 30 });
    expect(bookingDetailModel(near, NOW)).toMatchObject({ ended: true, canCancel: false, reviewable: true });
  });

  it('c3 reviewable: confirmed / completed, ended, not a no-show, with a lake', () => {
    const past = { startDate: iso(NOW - 30 * H), endDate: iso(NOW - 18 * H) };
    expect(bookingDetailModel(b({ ...past, bookingStatus: 'completed' }), NOW).reviewable).toBe(true);
    expect(bookingDetailModel(b({ ...past }), NOW).reviewable).toBe(true);
    expect(bookingDetailModel(b({ ...past, noShow: true }), NOW).reviewable).toBe(false);
    expect(bookingDetailModel(b({ ...past, bookingStatus: 'cancelled' }), NOW).reviewable).toBe(false);
    expect(bookingDetailModel(b({ ...past, lake: undefined }), NOW).reviewable).toBe(false);
    expect(bookingDetailModel(b(), NOW).reviewable).toBe(false);
  });
});

describe('c10 rebook', () => {
  it('cancelled / rejected (even future) or raw end past, with a lake', () => {
    expect(bookingDetailModel(b({ bookingStatus: 'cancelled' }), NOW).rebook).toEqual({ lakeId: 'lake1', lakeName: 'Chita Lake' });
    expect(bookingDetailModel(b({ bookingStatus: 'rejected' }), NOW).rebook).not.toBeNull();
    expect(bookingDetailModel(b({ startDate: iso(NOW - 30 * H), endDate: iso(NOW - 18 * H), noShow: true }), NOW).rebook).not.toBeNull();
    expect(bookingDetailModel(b(), NOW).rebook).toBeNull();
    expect(bookingDetailModel(b({ bookingStatus: 'pending' }), NOW).rebook).toBeNull();
    expect(bookingDetailModel(b({ bookingStatus: 'cancelled', lake: undefined }), NOW).rebook).toBeNull();
  });
  it('isPastBooking reads the raw end (fish), not the buffered one', () => {
    expect(isPastBooking(b({ startDate: iso(NOW - 12 * H), endDate: iso(NOW + 10 * 60_000) }, { checkoutBufferMinutes: 30 }), NOW)).toBe(false);
  });
});

describe('c11 price basis', () => {
  const basis = {
    durationHours: 24,
    rowLabel: null,
    composedFrom: [12, 12],
    tourPrice: 200,
    extras: [
      { key: 'boat', label: 'Barcă', unit: 'perStay', unitPrice: 30, quantity: 1, total: 30 },
      { key: 'cabin', label: 'Cabană', unit: 'perNight', unitPrice: 100, quantity: 2, total: 200 },
    ],
  } as BookingDTO['basis'] & object;
  it('rows: «{h}h» without a row label, «label × qty» above 1', () => {
    expect(priceRows(basis)).toEqual([
      { label: '24h', value: 200 },
      { label: 'Barcă', value: 30 },
      { label: 'Cabană × 2', value: 200 },
    ]);
    expect(priceRows({ ...basis, rowLabel: 'Tură de zi' })[0].label).toBe('Tură de zi');
  });
  it('the composed line only above one rate', () => {
    expect(composedLine(basis)).toBe('Tura s-a compus din 12h + 12h.');
    expect(composedLine({ ...basis, composedFrom: [24] })).toBeNull();
  });
  it('no basis → no card', () => {
    expect(bookingDetailModel(b(), NOW).basis).toBeNull();
  });
});

describe('c12 timeline (angler, no invented timestamps)', () => {
  const end = NOW + 60 * H;
  it('pending → waiting current; the end step «după {d MMM, HH:mm}» minus the buffer', () => {
    const m = bookingDetailModel(b({ bookingStatus: 'pending' }, { checkoutBufferMinutes: 30 }), NOW);
    expect(m.timeline.map((s) => [s.title, s.state, s.detail])).toEqual([
      ['Cerere trimisă', 'done', undefined],
      ['Așteaptă răspunsul lacului', 'current', undefined],
      ['Confirmată', 'future', undefined],
      ['Încheiată', 'future', `după ${dayMonthTime(new Date(end - 30 * 60_000))}`],
    ]);
  });
  it('confirmed current; completed done', () => {
    expect(bookingDetailModel(b(), NOW).timeline.map((s) => s.state)).toEqual(['done', 'done', 'current', 'future']);
    expect(bookingDetailModel(b({ bookingStatus: 'completed' }), NOW).timeline.map((s) => s.state)).toEqual(['done', 'done', 'done', 'done']);
  });
  it('rejected / cancelled: one terminal step carrying the date', () => {
    const r = bookingDetailModel(b({ bookingStatus: 'rejected' }), NOW).timeline;
    expect(r.map((s) => [s.title, s.state])).toEqual([
      ['Cerere trimisă', 'done'],
      ['Respinsă', 'current'],
    ]);
    expect(r[1].detail).toBe(`după ${dayMonthTime(new Date(end))}`);
    expect(bookingDetailModel(b({ bookingStatus: 'cancelled' }), NOW).timeline[1].title).toBe('Anulată');
  });
  it('dayMonthTime: «7 oct, 09:05»', () => {
    expect(dayMonthTime(new Date(2026, 9, 7, 9, 5))).toBe('7 oct, 09:05');
  });
});

describe('c13 note', () => {
  it('strips the operator part; empty → hidden', () => {
    expect(bookingDetailModel(b({ notes: 'Vin cu un prieten. [Refuz operator] Plin.' }), NOW).note).toBe('Vin cu un prieten.');
    expect(bookingDetailModel(b({ notes: '[Anulare operator] Lucrări.' }), NOW).note).toBe('');
    expect(bookingDetailModel(b(), NOW).note).toBe('');
  });
});

describe('cancelNoticeLine', () => {
  it('singular / plural / «de»', () => {
    expect(cancelNoticeLine(1)).toBe('Anulările cu mai puțin de 1 oră înainte de început se fac telefonic.');
    expect(cancelNoticeLine(12)).toBe('Anulările cu mai puțin de 12 ore înainte de început se fac telefonic.');
    expect(cancelNoticeLine(48)).toBe('Anulările cu mai puțin de 48 de ore înainte de început se fac telefonic.');
  });
});

describe('formatPhone (c4, the number printed beside the call from 1024)', () => {
  it('groups a Romanian number 4-3-3, with or without the country code', () => {
    expect(formatPhone('0712345678')).toBe('0712 345 678');
    expect(formatPhone(' 0712 345-678 ')).toBe('0712 345 678');
    expect(formatPhone('+40712345678')).toBe('+40 712 345 678');
    expect(formatPhone('0040 712 345 678')).toBe('+40 712 345 678');
  });
  it('leaves anything else as the lake typed it (trimmed)', () => {
    expect(formatPhone(' 112 ')).toBe('112');
    expect(formatPhone('+44 20 7946 0958')).toBe('+44 20 7946 0958');
  });
});
