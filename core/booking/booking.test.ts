import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { createFakeTransport } from '@/tests/transport';
import {
  acceptBooking,
  cancelBooking,
  createBlock,
  createBooking,
  createReservation,
  createWalkInBooking,
  deleteBlock,
  getBlocks,
  getBooking,
  getBookingQuote,
  getLakeAvailability,
  getLakeBookings,
  getLakesToReview,
  getMyBookingsPage,
  getMyBookingsUpcomingCount,
  getOwnedLakes,
  lookupAnglerByPhone,
  markNoShow,
  operatorCancelBooking,
  rejectBooking,
} from './api';
import {
  acceptBookingMutation,
  cancelBookingMutation,
  createBlockMutation,
  createBookingMutation,
  createLakeReservationMutation,
  createWalkInBookingMutation,
  deleteBlockMutation,
  invalidateOperatorSurfaces,
  markNoShowMutation,
  operatorCancelBookingMutation,
  rejectBookingMutation,
} from './mutations';
import {
  anglerLookupQuery,
  bookingKeys,
  bookingQuery,
  bookingQuoteQuery,
  lakeAvailabilityInfiniteQuery,
  lakeBlocksQuery,
  lakeBookingsInfiniteQuery,
  lakesToReviewQuery,
  myBookingsCountQuery,
  myBookingsPageInfiniteQuery,
  ownedLakesQuery,
} from './queries';
import { lakeAvailabilitySchema, type BookingDTO } from './schemas';

process.env.TZ = 'Europe/Bucharest';

const LAKE = 's84u55lo4n9z0emngozttt6e';

// Shapes taken from the local CMS (Chita Lake, 2026-09-27).
const availabilityRaw = {
  lakeId: LAKE,
  bookingEnabled: true,
  incrementHours: 12,
  checkoutBufferMinutes: 0,
  leadHours: 24,
  slotStartTimes: ['06:00', '18:00'],
  forbiddenEndTimes: ['06:00'],
  minDurationHours: 12,
  timezone: 'Europe/Bucharest',
  stands: [
    { documentId: 'st1', name: '1', coordinates: null, extras: [] },
    { documentId: 'st7', name: '7', coordinates: { id: 357, lat: '44.084794', long: '25.669669' }, extras: ['cabana150'] },
  ],
  extras: [{ key: 'cabana150', label: 'Cabana', price: 150, unit: 'perNight' }],
  bookings: [{ standDocumentId: 'st1', start: '2026-09-02T15:00:00.000Z', end: '2026-09-03T03:00:00.000Z', initials: 'I2' }],
  blocks: [
    {
      standDocumentId: null,
      start: '2026-09-12T03:00:00.000Z',
      end: '2026-09-13T15:00:00.000Z',
      reason: 'competition',
      label: 'Cupa',
      competitionId: 'c1',
    },
  ],
  window: { from: '2026-08-31T21:00:00.000Z', to: '2026-09-30T21:00:00.000Z' },
};
const availability = lakeAvailabilitySchema.parse(availabilityRaw);

const booking: BookingDTO = {
  documentId: 'n1l4',
  code: 'BK-E533EDC2',
  startDate: '2026-09-03T03:00:00.000Z',
  endDate: '2026-09-03T15:00:00.000Z',
  bookingStatus: 'rejected',
  priceTotal: 50,
  depositAmount: 0,
  paymentStatus: 'none',
  contactPhone: '+40712345678',
  noShow: false,
  createdAt: '2026-09-01T15:08:06.696Z',
  cancelledBy: 'system',
  paymentMode: 'offline',
  basis: { durationHours: 12, rowLabel: null, composedFrom: [12], tourPrice: 50, extras: [] },
  lake: {
    documentId: LAKE,
    name: 'Chita Lake',
    contactPhone: null,
    minCancelNoticeHours: 24,
    thumbUrl: 'https://x/thumbnail.jpeg',
    locality: 'Giurgiu',
    checkoutBufferMinutes: 0,
  },
  stand: { documentId: 'st5', name: '5' },
  angler: { documentId: 'u1', username: 'Sim QA', avatar: null },
};

const block = { documentId: 'bl1', startDate: 'a', endDate: 'b', reason: 'closure', standKey: null };

describe('booking api — reads', () => {
  it('reads availability from the public live route', async () => {
    const { transport, calls } = createFakeTransport([{ data: availabilityRaw }]);
    const res = await getLakeAvailability(transport, LAKE, { from: 'f', to: 't' });
    expect(res.stands[1].coordinates).toEqual({ lat: '44.084794', long: '25.669669' });
    expect(res.blocks[0].competitionId).toBe('c1');
    expect(calls[0]).toMatchObject({
      method: 'GET',
      path: `/feed/lakes/${LAKE}/availability`,
      query: { from: 'f', to: 't' },
      auth: 'none',
    });
  });

  it('posts the quote with sorted extras and parses both union halves', async () => {
    const priced = {
      total: 250,
      basis: {
        durationHours: 24,
        rowLabel: null,
        composedFrom: [24],
        tourPrice: 100,
        extras: [{ key: 'cabana150', label: 'Cabana', unit: 'perNight', unitPrice: 150, quantity: 1, total: 150 }],
      },
      refusal: null,
    };
    const refused = { total: null, basis: null, refusal: { code: 'END_TIME_NOT_ALLOWED', message: 'Nu.' } };
    const { transport, calls } = createFakeTransport([{ data: priced }, { data: refused }]);
    const args = { lakeId: LAKE, standId: 'st7', startISO: 's', endISO: 'e', extras: ['b', 'a'] };
    await expect(getBookingQuote(transport, args)).resolves.toEqual(priced);
    await expect(getBookingQuote(transport, { ...args, walkIn: true })).resolves.toEqual(refused);
    expect(calls[0]).toMatchObject({
      method: 'POST',
      path: `/feed/lakes/${LAKE}/quote`,
      auth: 'none',
      body: { data: { stand: 'st7', startDate: 's', endDate: 'e', extras: ['a', 'b'], walkIn: false } },
    });
    expect((calls[1].body as { data: { walkIn: boolean } }).data.walkIn).toBe(true);
  });

  it('reads the Home count', async () => {
    const { transport, calls } = createFakeTransport([{ data: { upcoming: 3 } }]);
    await expect(getMyBookingsUpcomingCount(transport)).resolves.toBe(3);
    expect(calls[0]).toMatchObject({ method: 'GET', path: '/feed/bookings/mine/count', auth: 'required' });
  });

  it('pages my bookings and falls back when the CMS predates the bucket contract', async () => {
    const { transport, calls } = createFakeTransport([
      { data: [booking], meta: { pendingCount: 2, page: 1, pageSize: 20 } },
      { data: [booking, booking] },
    ]);
    await expect(getMyBookingsPage(transport, { bucket: 'confirmed', sub: 'upcoming' })).resolves.toEqual({
      data: [booking],
      pendingCount: 2,
      page: 1,
      pageSize: 20,
    });
    expect(calls[0]).toMatchObject({
      path: '/feed/bookings/mine',
      query: { bucket: 'confirmed', sub: 'upcoming', page: 1, pageSize: 20 },
      auth: 'required',
    });
    // No meta: one full page, never an endless one.
    const legacy = await getMyBookingsPage(transport, { bucket: 'all', pageSize: 1 });
    expect(legacy).toMatchObject({ pendingCount: 0, page: 1, pageSize: 2 });
  });

  it('pages the operator inbox', async () => {
    const { transport, calls } = createFakeTransport([{ data: [booking], meta: { pendingCount: 0 } }]);
    await expect(getLakeBookings(transport, LAKE, { bucket: 'pending', page: 2 })).resolves.toEqual({
      data: [booking],
      pendingCount: 0,
      page: 2,
      pageSize: 20,
    });
    expect(calls[0]).toMatchObject({
      path: `/feed/bookings/lake/${LAKE}`,
      query: { bucket: 'pending', sub: undefined, page: 2, pageSize: 20 },
      auth: 'required',
    });
  });

  it('reads detail, to-review, owned lakes, blocks and the angler lookup', async () => {
    const toReview = [{ lakeId: LAKE, lakeName: 'Chita Lake', bookingId: 'b', endDate: 'e' }];
    const owned = [{ documentId: LAKE, name: 'Chita Lake', coverImageUrl: null, pending: 0, active: 0, cashToCollect: 0 }];
    const lookup = { matched: true, user: { documentId: 'u', username: 'Andrew', avatar: null } };
    const { transport, calls } = createFakeTransport([
      { data: booking },
      { data: toReview },
      { data: null },
      { data: owned },
      { data: [block] },
      { data: lookup },
    ]);
    await expect(getBooking(transport, 'n1l4')).resolves.toEqual(booking);
    await expect(getLakesToReview(transport)).resolves.toEqual(toReview);
    await expect(getLakesToReview(transport)).resolves.toEqual([]);
    await expect(getOwnedLakes(transport)).resolves.toEqual(owned);
    await expect(getBlocks(transport, LAKE)).resolves.toEqual([block]);
    await expect(lookupAnglerByPhone(transport, LAKE, '0700')).resolves.toEqual(lookup);
    expect(calls.map(c => [c.method, c.path, c.auth])).toEqual([
      ['GET', '/feed/bookings/n1l4', 'required'],
      ['GET', '/feed/bookings/to-review', 'required'],
      ['GET', '/feed/bookings/to-review', 'required'],
      ['GET', '/feed/owned-lakes', 'required'],
      ['GET', '/feed/availability-blocks', 'required'],
      ['GET', '/feed/bookings/lookup-angler', 'required'],
    ]);
    expect(calls[4].query).toEqual({ lakeId: LAKE });
    expect(calls[5].query).toEqual({ lake: LAKE, phone: '0700' });
  });
});

describe('booking api — writes', () => {
  it('sends every write where fish sends it', async () => {
    const { transport, calls } = createFakeTransport(req =>
      req.path === '/feed/bookings'
        ? { data: booking, payment: { clientSecret: 'cs' } }
        : req.path.startsWith('/feed/availability-blocks/')
          ? { data: { documentId: 'bl1' } }
          : req.path.startsWith('/feed/availability-blocks')
            ? { data: block }
            : req.path === '/reservations'
              ? { data: null }
              : { data: booking }
    );
    const input = { lake: LAKE, stand: 'st1', startDate: 's', endDate: 'e', extras: [] };
    await expect(createBooking(transport, { ...input, expectedTotal: 50 })).resolves.toEqual({
      data: booking,
      payment: { clientSecret: 'cs' },
    });
    await createWalkInBooking(transport, { ...input, contactPhone: '07' });
    await cancelBooking(transport, 'b1', 'motiv lung');
    await acceptBooking(transport, 'b1');
    await rejectBooking(transport, 'b1', 'motiv lung');
    await operatorCancelBooking(transport, 'b1', 'motiv lung');
    await markNoShow(transport, 'b1', 'Pescarul nu s-a prezentat.');
    await createBlock(transport, { lake: LAKE, startDate: 's', endDate: 'e', reason: 'closure' });
    await expect(deleteBlock(transport, 'bl1')).resolves.toEqual({ documentId: 'bl1' });
    await createReservation(transport, {
      fullname: 'A',
      email: 'a@b.c',
      phone: '07',
      details: '',
      isTermsAgreed: true,
      lake: 'Chita',
      startDate: 's',
      endDate: 'e',
    });
    expect(calls.map(c => [c.method, c.path, c.body])).toEqual([
      ['POST', '/feed/bookings', { data: { ...input, expectedTotal: 50 } }],
      ['POST', '/feed/bookings/walk-in', { data: { ...input, contactPhone: '07' } }],
      ['PATCH', '/feed/bookings/b1/cancel', { reason: 'motiv lung' }],
      ['PATCH', '/feed/bookings/b1/accept', undefined],
      ['PATCH', '/feed/bookings/b1/reject', { reason: 'motiv lung' }],
      ['PATCH', '/feed/bookings/b1/operator-cancel', { reason: 'motiv lung' }],
      ['POST', '/feed/bookings/b1/no-show', { data: { comment: 'Pescarul nu s-a prezentat.' } }],
      ['POST', '/feed/availability-blocks', { data: { lake: LAKE, startDate: 's', endDate: 'e', reason: 'closure' } }],
      ['DELETE', '/feed/availability-blocks/bl1', undefined],
      ['POST', '/reservations', expect.objectContaining({ data: expect.objectContaining({ fullname: 'A' }) })],
    ]);
    expect(calls.slice(0, 9).every(c => c.auth === 'required')).toBe(true);
    expect(calls[9].auth).toBe('optional');
  });
});

describe('booking queries', () => {
  const { transport } = createFakeTransport();

  it('keeps the fish key shapes', () => {
    expect(bookingQuery(transport, 'b').queryKey).toEqual(['bookings', 'detail', 'b']);
    expect(lakeBlocksQuery(transport, LAKE).queryKey).toEqual(['bookings', 'blocks', LAKE]);
    expect(lakeAvailabilityInfiniteQuery(transport, LAKE).queryKey).toEqual(['bookings', 'availability-paged', LAKE]);
    expect(lakeBookingsInfiniteQuery(transport, LAKE, 'confirmed', 'today').queryKey).toEqual([
      'bookings',
      'lake',
      LAKE,
      'confirmed',
      'today',
    ]);
    expect(lakeBookingsInfiniteQuery(transport, LAKE, 'pending').queryKey).toEqual(['bookings', 'lake', LAKE, 'pending', '']);
    expect(myBookingsPageInfiniteQuery(transport, 'all').queryKey).toEqual(['bookings', 'mine', 'all', '']);
    expect(myBookingsCountQuery(transport).queryKey).toEqual(['bookings', 'mine-count']);
    expect(lakesToReviewQuery(transport).queryKey).toEqual(['bookings', 'to-review']);
    expect(ownedLakesQuery(transport).queryKey).toEqual(['bookings', 'owned-lakes']);
    expect(anglerLookupQuery(transport, LAKE, '0700 000 000', true).queryKey).toEqual([
      'bookings',
      'angler-lookup',
      LAKE,
      '0700 000 000',
    ]);
    expect(bookingKeys.all).toEqual(['bookings']);
  });

  it('keys the quote on sorted extras and only fires with a full selection', () => {
    const q = bookingQuoteQuery(transport, { lakeId: LAKE, standId: 's', startISO: 'a', endISO: 'b', extras: ['z', 'a'] });
    expect(q.queryKey).toEqual(['booking-quote', LAKE, 's', 'a', 'b', 'a,z', false]);
    expect(q.enabled).toBe(true);
    expect(q.staleTime).toBe(0);
    expect(bookingQuoteQuery(transport, { lakeId: LAKE, extras: [] }).enabled).toBe(false);
  });

  it('pages availability by calendar month from the pinned now', async () => {
    const { transport: t, calls } = createFakeTransport(() => ({ data: availabilityRaw }));
    const q = lakeAvailabilityInfiniteQuery(t, LAKE, new Date(2026, 8, 27, 12));
    expect(q.getNextPageParam(availability, [availability], 0, [0])).toBe(1);
    await q.queryFn!({ pageParam: 1 } as never);
    expect(calls[0].query).toEqual({ from: '2026-10-01T00:00:00+03:00', to: '2026-11-01T00:00:00+02:00' });
  });

  it('stops paging on a short page', () => {
    const q = myBookingsPageInfiniteQuery(transport, 'all');
    const full = { data: Array(20).fill(booking), pendingCount: 0, page: 1, pageSize: 20 };
    expect(q.getNextPageParam(full, [full], 1, [1])).toBe(2);
    const short = { ...full, data: [booking] };
    expect(q.getNextPageParam(short, [short], 1, [1])).toBeUndefined();
    const inbox = lakeBookingsInfiniteQuery(transport, LAKE, 'all');
    expect(inbox.getNextPageParam(short, [short], 1, [1])).toBeUndefined();
  });

  it('arms the angler lookup only on a plausible phone', () => {
    expect(anglerLookupQuery(transport, LAKE, '0700 000', true).enabled).toBe(true);
    expect(anglerLookupQuery(transport, LAKE, '0700', true).enabled).toBe(false);
    expect(anglerLookupQuery(transport, LAKE, '0700 000 000', false).enabled).toBe(false);
    expect(anglerLookupQuery(transport, LAKE, '0700 000 000', true).retry).toBe(false);
  });
});

describe('booking mutations', () => {
  function spyClient() {
    const qc = new QueryClient();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    const keys = () => spy.mock.calls.map(c => c[0]?.queryKey);
    return { qc, keys };
  }
  const ctx = {} as never;

  it('invalidateOperatorSurfaces hits both disjoint roots', () => {
    const { qc, keys } = spyClient();
    invalidateOperatorSurfaces(qc);
    expect(keys()).toEqual([['bookings'], ['operator-stats']]);
  });

  it.each([
    ['accept', acceptBookingMutation, 'b1'],
    ['reject', rejectBookingMutation, { id: 'b1', reason: 'motiv lung' }],
    ['cancel', cancelBookingMutation, { id: 'b1', reason: 'motiv lung' }],
    ['operator cancel', operatorCancelBookingMutation, { id: 'b1', reason: 'motiv lung' }],
    ['create', createBookingMutation, { lake: LAKE, stand: 's', startDate: 'a', endDate: 'b', extras: [] }],
    ['create block', createBlockMutation, { lake: LAKE, startDate: 'a', endDate: 'b', reason: 'closure' }],
    ['delete block', deleteBlockMutation, 'bl1'],
  ] as const)('%s invalidates the operator surfaces on success', async (_name, factory, vars) => {
    const { transport: t } = createFakeTransport(() => ({ data: booking }));
    const { qc, keys } = spyClient();
    const m = factory(t, qc);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (m.onSuccess as any)?.(undefined, vars, undefined, ctx);
    expect(keys()).toEqual([['bookings'], ['operator-stats']]);
    expect(m.mutationFn).toBeTypeOf('function');
  });

  it('walk-in invalidates bookings, the owned stats and every per-lake stats entry', async () => {
    const { transport: t } = createFakeTransport();
    const { qc, keys } = spyClient();
    await createWalkInBookingMutation(t, qc).onSuccess?.(booking, { lake: LAKE, stand: 's', startDate: 'a', endDate: 'b', extras: [] }, undefined, ctx);
    expect(keys()).toEqual([['bookings'], ['operator-stats', 'owned'], ['operator-stats', 'lake']]);
  });

  it('no-show also refreshes the reputation', async () => {
    const { transport: t, calls } = createFakeTransport(() => ({ data: booking }));
    const { qc, keys } = spyClient();
    const m = markNoShowMutation(t, qc);
    await m.mutationFn!({ bookingId: 'b1', comment: 'x' }, ctx);
    await m.onSuccess?.(booking, { bookingId: 'b1', comment: 'x' }, undefined, ctx);
    expect(calls[0].path).toBe('/feed/bookings/b1/no-show');
    expect(keys()).toEqual([['bookings'], ['operator-stats'], ['reputation']]);
  });

  it('the legacy reservation has no cache effects', () => {
    const { transport: t } = createFakeTransport();
    expect(createLakeReservationMutation(t).onSuccess).toBeUndefined();
  });
});
