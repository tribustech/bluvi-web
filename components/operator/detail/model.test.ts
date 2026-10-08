import { describe, expect, it } from 'vitest';
import type { BookingDTO } from '@/core/booking';
import { actionVariant, bookingDetailModel, isBookingOfLake, noShowText, rateAnglerHref, ratingText, requestedAtLabel } from './model';

const H = 3_600_000;
const NOW = new Date(2026, 9, 8, 12, 0).getTime();
const iso = (h: number) => new Date(NOW + h * H).toISOString();

function b(over: Partial<BookingDTO> = {}): BookingDTO {
  return {
    documentId: 'bk1',
    code: 'BK-1',
    startDate: iso(24),
    endDate: iso(36),
    bookingStatus: 'confirmed',
    priceTotal: 230,
    depositAmount: 0,
    paymentStatus: 'none',
    contactPhone: '0722111222',
    noShow: false,
    basis: {
      durationHours: 12,
      rowLabel: null,
      composedFrom: [12],
      tourPrice: 150,
      extras: [
        { key: 'boat', label: 'Barcă', unit: 'perStay', unitPrice: 30, quantity: 1, total: 30 },
        { key: 'cabin', label: 'Cabană', unit: 'perNight', unitPrice: 25, quantity: 2, total: 50 },
      ],
    },
    stand: { documentId: 's5', name: '5' },
    angler: { documentId: 'u1', username: 'ion.pescarul', avatar: null },
    ...over,
  } as BookingDTO;
}

describe('bookingDetailModel', () => {
  it('c3 header: name, stand, extras, period with hours, rounded price with spaced unit', () => {
    const m = bookingDetailModel(b({ priceTotal: 1230.4 }), NOW);
    expect(m.name).toBe('ion.pescarul');
    expect(m.standLabel).toBe('Standul 5');
    expect(m.extras.map((e) => e.label)).toEqual(['Barcă', 'Cabană']);
    expect(m.periodLine).toMatch(/ → .* · 12h$/);
    expect(m.price).toBe(`${(1230).toLocaleString('ro-RO')} lei`);
  });

  it('c4 account vs walk-in: anglerId only with an account; walk-in falls back to the contact name', () => {
    expect(bookingDetailModel(b(), NOW).anglerId).toBe('u1');
    const walkIn = bookingDetailModel(b({ angler: undefined, contactFullname: 'Ion Popescu' }), NOW);
    expect(walkIn.anglerId).toBeNull();
    expect(walkIn.name).toBe('Ion Popescu');
    expect(bookingDetailModel(b({ angler: undefined }), NOW).name).toBe('Pescar');
  });

  it('c5 basis: tour line (Tur {h}h without rowLabel), extras with × qty > 1, bold total; null without basis', () => {
    const m = bookingDetailModel(b(), NOW);
    expect(m.basis?.lines).toEqual([
      { label: 'Tur 12h', value: '150 lei' },
      { label: 'Barcă', value: '30 lei' },
      { label: 'Cabană × 2', value: '50 lei' },
    ]);
    expect(m.basis?.total).toEqual({ label: 'Total', value: '230 lei', strong: true });
    const row = bookingDetailModel(b({ basis: { durationHours: 24, rowLabel: 'Tur 24h weekend', composedFrom: [24], tourPrice: 200, extras: [] } }), NOW);
    expect(row.basis?.lines[0].label).toBe('Tur 24h weekend');
    expect(bookingDetailModel(b({ basis: undefined }), NOW).basis).toBeNull();
  });

  it('c6 payment: unpaid / partly paid / fully paid', () => {
    expect(bookingDetailModel(b(), NOW).payment).toEqual([
      { label: 'Stare', value: 'Numerar' },
      { label: 'Rest de plată', value: '230 lei', strong: true },
    ]);
    expect(bookingDetailModel(b({ amountPaid: 100, paymentStatus: 'depositPaid' }), NOW).payment).toEqual([
      { label: 'Stare', value: 'Avans' },
      { label: 'Încasat', value: '100 lei' },
      { label: 'Rest de plată', value: '130 lei', strong: true },
    ]);
    expect(bookingDetailModel(b({ amountPaid: 230, paymentStatus: 'paidInFull' }), NOW).payment).toEqual([
      { label: 'Stare', value: 'Plătit' },
      { label: 'Încasat', value: '230 lei' },
    ]);
    // paidInFull without amountPaid (older rows): nothing is owed, no «Rest de plată 230 lei».
    expect(bookingDetailModel(b({ paymentStatus: 'paidInFull' }), NOW).payment).toEqual([{ label: 'Stare', value: 'Plătit' }]);
    // An unknown payment status from a newer CMS reads as Numerar.
    expect(bookingDetailModel(b({ paymentStatus: 'crypto' }), NOW).payment[0].value).toBe('Numerar');
  });

  it('c6 no «Rest de plată» when nothing can be owed (deliberate improvement on fish)', () => {
    const only = (over: Partial<BookingDTO>) => bookingDetailModel(b(over), NOW).payment.map((l) => l.label);
    expect(only({ bookingStatus: 'cancelled', cancelledBy: 'operator' } as Partial<BookingDTO>)).toEqual(['Stare']);
    expect(only({ bookingStatus: 'rejected' })).toEqual(['Stare']);
    expect(only({ noShow: true })).toEqual(['Stare']);
    expect(only({ paymentStatus: 'refunded', amountPaid: 50 })).toEqual(['Stare', 'Încasat']);
    expect(only({ bookingStatus: 'completed', amountPaid: 50, paymentStatus: 'depositPaid' })).toEqual(['Stare', 'Încasat', 'Rest de plată']);
    expect(only({ bookingStatus: 'pending' })).toEqual(['Stare', 'Rest de plată']);
  });

  it('c7 request block: code, requested-at, phone only when present', () => {
    const created = new Date(2026, 8, 1, 14, 53).toISOString();
    expect(bookingDetailModel(b({ createdAt: created }), NOW).request).toEqual([
      { label: 'Cod', value: 'BK-1' },
      { label: 'Cerută', value: 'Ma 1 sep, 14:53' },
      { label: 'Telefon', value: '0722111222' },
    ]);
    expect(bookingDetailModel(b({ contactPhone: '' }), NOW).request).toEqual([{ label: 'Cod', value: 'BK-1' }]);
    expect(bookingDetailModel(b({ contactPhone: '' }), NOW).phone).toBeNull();
  });

  it('c8 optional blocks: note stripped of the appended reason, reject vs cancel title, meaningful no-show note', () => {
    const rej = bookingDetailModel(b({ bookingStatus: 'rejected', cancelReason: 'Standul e ocupat.', notes: 'Vin cu fiul. [Refuz operator] Standul e ocupat.' }), NOW);
    expect(rej.note).toBe('Vin cu fiul.');
    expect(rej.reason).toEqual({ title: 'Motiv refuz', text: 'Standul e ocupat.' });
    const canc = bookingDetailModel(b({ bookingStatus: 'cancelled', cancelReason: 'Lucrări.', notes: '[Anulare operator] Lucrări.' }), NOW);
    expect(canc.note).toBe('');
    expect(canc.reason?.title).toBe('Motiv anulare');
    expect(bookingDetailModel(b({ noShow: true, noShowComment: 'Pescarul nu s-a prezentat.' }), NOW).noShowNote).toBe('');
    expect(bookingDetailModel(b({ noShow: true, noShowComment: ' A sunat la 5. ' }), NOW).noShowNote).toBe('A sunat la 5.');
  });
});

describe('isBookingOfLake (c14 — the ?rezervare= guard)', () => {
  const lake = { documentId: 'lake-a', name: 'A', contactPhone: null, minCancelNoticeHours: null } as BookingDTO['lake'];
  it('the booking asked for, on this lake → shown', () => expect(isBookingOfLake(b({ lake }), 'bk1', 'lake-a')).toBe(true));
  it('another lake the operator also owns → refused', () => expect(isBookingOfLake(b({ lake }), 'bk1', 'lake-b')).toBe(false));
  it('a booking fetched for another id → refused', () => expect(isBookingOfLake(b({ lake }), 'bk2', 'lake-a')).toBe(false));
  it('no data / closed → refused', () => {
    expect(isBookingOfLake(undefined, 'bk1', 'lake-a')).toBe(false);
    expect(isBookingOfLake(b({ lake }), null, 'lake-a')).toBe(false);
  });
  it('an older CMS without the lake ref → trusted', () => expect(isBookingOfLake(b({ lake: undefined }), 'bk1', 'lake-a')).toBe(true));
});

describe('actionVariant (c9)', () => {
  const past = { startDate: iso(-30), endDate: iso(-18) };
  it('pending → accept/reject', () => expect(actionVariant(b({ bookingStatus: 'pending' }), NOW)).toBe('pending'));
  it('confirmed, not ended, not no-show → cancel', () => expect(actionVariant(b(), NOW)).toBe('cancel'));
  it('confirmed live → still cancel', () => expect(actionVariant(b({ startDate: iso(-1), endDate: iso(5) }), NOW)).toBe('cancel'));
  it('confirmed no-show → none', () => expect(actionVariant(b({ noShow: true }), NOW)).toBe('none'));
  it('ended confirmed / completed, not reviewed → rate', () => {
    expect(actionVariant(b(past), NOW)).toBe('rate');
    expect(actionVariant(b({ ...past, bookingStatus: 'completed' }), NOW)).toBe('rate');
  });
  it('ended but reviewed, or a no-show → none', () => {
    expect(actionVariant(b({ ...past, reviewedByOperator: true }), NOW)).toBe('none');
    expect(actionVariant(b({ ...past, noShow: true }), NOW)).toBe('none');
  });
  it('cancelled / rejected → none', () => {
    expect(actionVariant(b({ bookingStatus: 'cancelled' }), NOW)).toBe('none');
    expect(actionVariant(b({ bookingStatus: 'rejected' }), NOW)).toBe('none');
  });
});

describe('reputation labels (b.reputation)', () => {
  it('rating: one decimal with a comma; nothing without a rating', () => {
    expect(ratingText(4.6)).toBe('4,6');
    expect(ratingText(5)).toBe('5,0');
    expect(ratingText(null)).toBeNull();
    expect(ratingText(undefined)).toBeNull();
  });
  it('no-shows: formatCount plurals; nothing at 0', () => {
    expect(noShowText(1)).toBe('1 neprezentare');
    expect(noShowText(3)).toBe('3 neprezentări');
    expect(noShowText(20)).toBe('20 de neprezentări');
    expect(noShowText(0)).toBeNull();
  });
});

describe('requestedAtLabel', () => {
  it('«Wd d mmm, HH:mm», capitalised', () => {
    expect(requestedAtLabel(new Date(2026, 9, 4, 9, 5).toISOString())).toBe('Du 4 oct, 09:05');
  });
});

describe('rateAnglerHref (c12)', () => {
  it('carries angler, stand and period; walk-in leaves the empty ones out', () => {
    const href = rateAnglerHref(b());
    const u = new URL(href, 'http://x');
    expect(u.pathname).toBe('/operator/evalueaza/bk1');
    expect(u.searchParams.get('anglerName')).toBe('ion.pescarul');
    expect(u.searchParams.get('anglerId')).toBe('u1');
    expect(u.searchParams.get('standName')).toBe('5');
    expect(u.searchParams.get('startDate')).toBe(b().startDate);
    expect(u.searchParams.has('anglerAvatar')).toBe(false);
    const walk = new URL(rateAnglerHref(b({ angler: undefined, contactFullname: 'Ion' })), 'http://x');
    expect(walk.searchParams.has('anglerId')).toBe(false);
    expect(walk.searchParams.get('anglerName')).toBe('Ion');
  });
});
