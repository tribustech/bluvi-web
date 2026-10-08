import { describe, expect, it } from 'vitest';
import type { BookingDTO } from '@/core/booking';
import {
  focusIndex,
  inboxItems,
  inboxUrlValues,
  listHasCardActions,
  parseInboxPlace,
  pendingBadge,
  rowAccessibleName,
  rowModel,
  subChips,
  subOf,
  type InboxPlace,
} from './model';

const H = 3_600_000;
const NOW = new Date(2026, 9, 9, 12, 0, 0).getTime(); // Jo 9 oct 12:00 local

function b(over: Partial<BookingDTO> = {}): BookingDTO {
  return {
    documentId: 'b1',
    code: 'BK1',
    startDate: new Date(NOW + 24 * H).toISOString(),
    endDate: new Date(NOW + 36 * H).toISOString(),
    bookingStatus: 'confirmed',
    priceTotal: 1250.4,
    depositAmount: 0,
    paymentStatus: 'none',
    contactPhone: '+40700000000',
    contactFullname: 'Ion Pop',
    ...over,
  } as BookingDTO;
}

describe('c6 / b.status-param — parseInboxPlace', () => {
  it.each([
    ['pending', undefined, { bucket: 'pending', sub: undefined }],
    ['cancelled', undefined, { bucket: 'unfinished', sub: 'cancelled' }],
    ['rejected', undefined, { bucket: 'unfinished', sub: 'rejected' }],
    ['toreview', undefined, { bucket: 'confirmed', sub: 'toreview' }],
    ['all', undefined, { bucket: 'all', sub: undefined }],
    ['junk', undefined, { bucket: 'confirmed', sub: 'today' }],
    [undefined, undefined, { bucket: 'confirmed', sub: 'today' }],
    // web-only extension
    ['confirmed', 'upcoming', { bucket: 'confirmed', sub: 'upcoming' }],
    ['confirmed', 'toate', { bucket: 'confirmed', sub: undefined }],
    ['confirmed', 'nope', { bucket: 'confirmed', sub: 'today' }],
    ['unfinished', undefined, { bucket: 'unfinished', sub: undefined }],
    ['unfinished', 'noshow', { bucket: 'unfinished', sub: 'noshow' }],
    ['unfinished', 'today', { bucket: 'unfinished', sub: undefined }],
  ] as const)('%s %s', (status, filtru, place) => {
    expect(parseInboxPlace(status, filtru)).toEqual(place);
  });

  it('round-trips every place through the URL', () => {
    const places: InboxPlace[] = [
      { bucket: 'pending', sub: undefined },
      { bucket: 'all', sub: undefined },
      ...([undefined, 'today', 'upcoming', 'past', 'toreview'] as const).map((sub) => ({ bucket: 'confirmed' as const, sub })),
      ...([undefined, 'rejected', 'cancelled', 'noshow'] as const).map((sub) => ({ bucket: 'unfinished' as const, sub })),
    ];
    for (const p of places) {
      const v = inboxUrlValues(p);
      expect(parseInboxPlace(v.status, v.filtru)).toEqual(p);
    }
  });

  it('uses the shared vocabulary whenever it names the place', () => {
    expect(inboxUrlValues({ bucket: 'pending', sub: undefined })).toEqual({ status: 'pending', filtru: null });
    expect(inboxUrlValues({ bucket: 'unfinished', sub: 'cancelled' })).toEqual({ status: 'cancelled', filtru: null });
    expect(inboxUrlValues({ bucket: 'confirmed', sub: 'today' })).toEqual({ status: null, filtru: null });
    expect(inboxUrlValues({ bucket: 'confirmed', sub: undefined })).toEqual({ status: 'confirmed', filtru: 'toate' });
  });
});

describe('tabs and chips', () => {
  it('c3 badge omitted at 0 and before the first page', () => {
    expect(pendingBadge(undefined)).toBeUndefined();
    expect(pendingBadge(0)).toBeUndefined();
    expect(pendingBadge(3)).toBe(3);
  });
  it('c4 chips only for Confirmate and Nefinalizate, led by Toate', () => {
    expect(subChips('pending')).toEqual([]);
    expect(subChips('all')).toEqual([]);
    expect(subChips('confirmed').map((c) => c.label)).toEqual(['Toate', 'Azi', 'Viitoare', 'Trecute', 'De evaluat']);
    expect(subChips('unfinished').map((c) => c.label)).toEqual(['Toate', 'Cereri neacceptate', 'Anulate', 'Neprezentări']);
  });
  it('c4 c5 default sub, then the remembered one', () => {
    expect(subOf('confirmed', {})).toBe('today');
    expect(subOf('unfinished', {})).toBeUndefined();
    expect(subOf('confirmed', { confirmed: undefined })).toBeUndefined();
    expect(subOf('confirmed', { confirmed: 'past' })).toBe('past');
  });
  it('c23 card actions only in De aprobat and De evaluat', () => {
    expect(listHasCardActions({ bucket: 'pending', sub: undefined })).toBe(true);
    expect(listHasCardActions({ bucket: 'confirmed', sub: 'toreview' })).toBe(true);
    expect(listHasCardActions({ bucket: 'confirmed', sub: 'today' })).toBe(false);
    expect(listHasCardActions({ bucket: 'all', sub: undefined })).toBe(false);
  });
});

describe('c14 inboxItems', () => {
  const s = (id: string, stand: string, startH: number) =>
    b({ documentId: id, stand: { documentId: `s${stand}`, name: stand }, startDate: new Date(NOW + startH * H).toISOString() });
  const rows = [s('a', '10', 2), s('b', '9', 5), s('c', '10', -6), s('d', '2', 0)];

  it('Azi: by stand in natural order, 2+ stays fold into a turnover (by start)', () => {
    const items = inboxItems(rows, { bucket: 'confirmed', sub: 'today' });
    expect(items.map((i) => (i.kind === 'one' ? i.booking.documentId : i.bookings.map((x) => x.documentId).join('+')))).toEqual(['d', 'b', 'c+a']);
  });
  it('other lists keep the server order', () => {
    expect(inboxItems(rows, { bucket: 'confirmed', sub: 'upcoming' }).map((i) => i.kind === 'one' && i.booking.documentId)).toEqual(['a', 'b', 'c', 'd']);
  });
  it('c26 focusIndex finds a booking inside a turnover; -1 when absent', () => {
    const items = inboxItems(rows, { bucket: 'confirmed', sub: 'today' });
    expect(focusIndex(items, 'a')).toBe(2);
    expect(focusIndex(items, 'd')).toBe(0);
    expect(focusIndex(items, 'zz')).toBe(-1);
    expect(focusIndex(items, undefined)).toBe(-1);
  });
});

describe('rowModel', () => {
  it('c15 name fallbacks', () => {
    expect(rowModel(b({ angler: { documentId: 'u', username: 'pescar1', avatar: null } }), NOW).name).toBe('pescar1');
    expect(rowModel(b(), NOW).name).toBe('Ion Pop');
    expect(rowModel(b({ contactFullname: undefined }), NOW).name).toBe('Pescar');
  });
  it('c16 age only for pending, red from 5 h', () => {
    const fresh = rowModel(b({ bookingStatus: 'pending', createdAt: new Date(NOW - (2 * H + 13 * 60_000)).toISOString() }), NOW);
    expect(fresh.age).toBe('acum 2 h 13 min');
    expect(fresh.stale).toBe(false);
    const late = rowModel(b({ bookingStatus: 'pending', createdAt: new Date(NOW - 5 * H).toISOString() }), NOW);
    expect(late.age).toBe('acum 5 h');
    expect(late.stale).toBe(true);
    expect(rowModel(b({ createdAt: new Date(NOW - 9 * H).toISOString() }), NOW).age).toBeNull();
  });
  it('c17 stand and extras', () => {
    const m = rowModel(
      b({
        stand: { documentId: 's', name: 'A10' },
        basis: { durationHours: 12, rowLabel: null, composedFrom: [12], tourPrice: 1, extras: [{ key: 'boat', label: 'Barcă', unit: 'perStay', unitPrice: 1, quantity: 1, total: 1 }] },
      } as Partial<BookingDTO>),
      NOW,
    );
    expect(m.standLabel).toBe('Standul A10');
    expect(m.extras).toEqual([{ key: 'boat', label: 'Barcă' }]);
  });
  it('c18 period with hours; while live the bare period and the progress', () => {
    expect(rowModel(b(), NOW).periodText).toMatch(/ → .* · 12h$/);
    expect(rowModel(b(), NOW).live).toBeNull();
    const live = rowModel(b({ startDate: new Date(NOW - 3 * H).toISOString(), endDate: new Date(NOW + 9 * H).toISOString() }), NOW);
    expect(live.periodText).not.toMatch(/· 12h$/);
    expect(live.live).toEqual({ pct: 25, label: '3h din 12h' });
  });
  it('c19 price rounded ro-RO; money pill for confirmed, status pill otherwise', () => {
    expect(rowModel(b(), NOW).price).toBe('1.250');
    expect(rowModel(b(), NOW).pill).toEqual({ kind: 'money', label: 'Numerar', tone: 'success' });
    expect(rowModel(b({ paymentStatus: 'depositPaid' }), NOW).pill).toEqual({ kind: 'money', label: 'Avans', tone: 'warning' });
    expect(rowModel(b({ paymentStatus: 'paidInFull' }), NOW).pill).toEqual({ kind: 'money', label: 'Plătit', tone: 'accent' });
    expect(rowModel(b({ paymentStatus: 'refunded' }), NOW).pill).toEqual({ kind: 'money', label: 'Rambursat', tone: 'neutral' });
    expect(rowModel(b({ bookingStatus: 'pending' }), NOW).pill).toEqual({ kind: 'status' });
    expect(rowModel(b({ noShow: true }), NOW).pill).toEqual({ kind: 'status' });
  });
  it('c20 quiet: cancelled, rejected, no-show', () => {
    expect(rowModel(b({ bookingStatus: 'cancelled' }), NOW).quiet).toBe(true);
    expect(rowModel(b({ bookingStatus: 'rejected' }), NOW).quiet).toBe(true);
    expect(rowModel(b({ noShow: true }), NOW).quiet).toBe(true);
    expect(rowModel(b(), NOW).quiet).toBe(false);
  });
  it('c21 note stripped of the operator reason', () => {
    expect(rowModel(b({ notes: 'Vin cu barca [Refuz operator] plin' }), NOW).note).toBe('Vin cu barca');
    expect(rowModel(b({ notes: '[Anulare operator] x' }), NOW).note).toBe('');
  });
  it('c22 reason lines and the 90-char toggle', () => {
    expect(rowModel(b({ bookingStatus: 'cancelled', cancelReason: 'Ploaie' }), NOW).reason).toEqual({ label: 'Motiv anulare', text: 'Ploaie', long: false });
    expect(rowModel(b({ bookingStatus: 'rejected', cancelReason: 'x'.repeat(91) }), NOW).reason?.long).toBe(true);
    expect(rowModel(b({ bookingStatus: 'rejected', cancelReason: 'x'.repeat(90) }), NOW).reason?.long).toBe(false);
    expect(rowModel(b({ noShow: true, noShowComment: 'Pescarul nu s-a prezentat.' }), NOW).reason).toBeNull();
    expect(rowModel(b({ noShow: true, noShowComment: 'A sunat târziu' }), NOW).reason?.label).toBe('Neprezentare');
  });
  it('c23 card actions: pending, rateable; none outside the decision lists', () => {
    const ended = { startDate: new Date(NOW - 24 * H).toISOString(), endDate: new Date(NOW - 12 * H).toISOString() };
    expect(rowModel(b({ bookingStatus: 'pending' }), NOW, { cardActions: true }).actions).toBe('pending');
    expect(rowModel(b(ended), NOW, { cardActions: true }).actions).toBe('rate');
    expect(rowModel(b({ ...ended, reviewedByOperator: true }), NOW, { cardActions: true }).actions).toBeNull();
    expect(rowModel(b({ bookingStatus: 'pending' }), NOW).actions).toBeNull();
  });
  it('c14 turnover: the moment replaces the period', () => {
    const m = rowModel(b({ startDate: new Date(NOW + 6 * H).toISOString(), endDate: new Date(NOW + 30 * H).toISOString() }), NOW, { turnover: true });
    expect(m.turnover).toEqual({ kind: 'arrives' });
    expect(m.periodText).toMatch(/^vine 18:00 · 24h$/);
  });
  it('accessible name starts with the visible name', () => {
    expect(rowAccessibleName(rowModel(b({ stand: { documentId: 's', name: '5' } }), NOW))).toMatch(/^Ion Pop, Standul 5, /);
  });
});
