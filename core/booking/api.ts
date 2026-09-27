import { z } from 'zod';
import { call, type Transport } from '../transport';
import type { MyBucket, MySub } from './domain/myBookingBuckets';
import type { OperatorBucket, OperatorSub } from './domain/operatorBookingBuckets';
import {
  anglerLookupResultSchema,
  availabilityBlockSchema,
  bookingQuoteSchema,
  bookingSchema,
  bookingsPageResponseSchema,
  createBookingResultSchema,
  deletedBlockSchema,
  lakeAvailabilitySchema,
  lakeToReviewSchema,
  ownedLakeSchema,
  type AvailabilityBlockInput,
  type BookingQuoteInput,
  type CreateBookingInput,
  type LakeBookingsPage,
  type LakeReservation,
  type MyBookingsPage,
  type WalkInBookingInput,
} from './schemas';

const enc = encodeURIComponent;

/**
 * fish `services/api/booking.ts#getLakeAvailability`
 *
 * Public and live (never edge-cached, `cache-control.ts`). fish also defaulted a `packages` array
 * and `stands[].excludeFromPackages`; the CMS no longer sends either (the package evaluator was
 * deleted) and nothing reads them, so they are not carried over.
 */
export async function getLakeAvailability(t: Transport, lakeId: string, params?: { from?: string; to?: string }) {
  const res = await call(
    t,
    {
      method: 'GET',
      path: `/feed/lakes/${enc(lakeId)}/availability`,
      query: { from: params?.from, to: params?.to },
      auth: 'none',
    },
    z.object({ data: lakeAvailabilitySchema })
  );
  return res.data;
}

/**
 * fish `services/queries/useBookingQuote.ts` (the POST lived inline in the hook).
 *
 * What the selected tour costs, according to the server that will charge it. A refusal is a
 * 200 with `{ total: null, refusal }`, not an error. Public route (`auth: false`).
 */
export async function getBookingQuote(t: Transport, args: BookingQuoteInput) {
  const extras = [...args.extras].sort();
  const res = await call(
    t,
    {
      method: 'POST',
      path: `/feed/lakes/${enc(args.lakeId)}/quote`,
      body: {
        data: { stand: args.standId, startDate: args.startISO, endDate: args.endISO, extras, walkIn: !!args.walkIn },
      },
      auth: 'none',
    },
    z.object({ data: bookingQuoteSchema })
  );
  return res.data;
}

/** fish `services/api/booking.ts#createBooking` — returns `{ data, payment? }` as-is. */
export function createBooking(t: Transport, input: CreateBookingInput) {
  return call(
    t,
    { method: 'POST', path: '/feed/bookings', body: { data: input }, auth: 'required' },
    createBookingResultSchema
  );
}

/** fish `services/api/booking.ts#createWalkInBooking` */
export async function createWalkInBooking(t: Transport, input: WalkInBookingInput) {
  const res = await call(
    t,
    { method: 'POST', path: '/feed/bookings/walk-in', body: { data: input }, auth: 'required' },
    z.object({ data: bookingSchema })
  );
  return res.data;
}

/** fish `services/api/booking.ts#lookupAnglerByPhone` — owner-gated on the server. */
export async function lookupAnglerByPhone(t: Transport, lake: string, phone: string) {
  const res = await call(
    t,
    { method: 'GET', path: '/feed/bookings/lookup-angler', query: { lake, phone }, auth: 'required' },
    z.object({ data: anglerLookupResultSchema })
  );
  return res.data;
}

/**
 * fish `services/api/booking.ts#getMyBookingsUpcomingCount`
 *
 * Just the number on the Home "Rezervări" tile.
 *
 * A count, not a list: this replaced a client-side count over the bucket-less
 * `/feed/bookings/mine`, which meant fetching 25 fully populated bookings on
 * every Home mount to render one integer. That endpoint stays on the server for
 * shipped 3.3.x builds, but nothing here calls it any more.
 */
export async function getMyBookingsUpcomingCount(t: Transport): Promise<number> {
  const res = await call(
    t,
    { method: 'GET', path: '/feed/bookings/mine/count', auth: 'required' },
    z.object({ data: z.object({ upcoming: z.number() }) })
  );
  return res.data.upcoming;
}

export const MY_BOOKINGS_PAGE_SIZE = 20;

/**
 * fish `services/api/booking.ts#getMyBookingsPage`
 *
 * The paged, bucketed read behind the tabbed screen. A CMS that predates the
 * bucket contract ignores these params and answers with the whole list and no
 * `meta` — the fallbacks below make that degrade into a single full page rather
 * than an endless one (the list would otherwise keep asking for page 2).
 */
export async function getMyBookingsPage(
  t: Transport,
  params: { bucket: MyBucket; sub?: MySub; page?: number; pageSize?: number }
): Promise<MyBookingsPage> {
  const pageSize = params.pageSize ?? MY_BOOKINGS_PAGE_SIZE;
  const page = params.page ?? 1;
  const res = await call(
    t,
    {
      method: 'GET',
      path: '/feed/bookings/mine',
      query: { bucket: params.bucket, sub: params.sub, page, pageSize },
      auth: 'required',
    },
    bookingsPageResponseSchema
  );
  const rows = res.data;
  return {
    data: rows,
    pendingCount: res.meta?.pendingCount ?? 0,
    page: res.meta?.page ?? page,
    pageSize: res.meta?.pageSize ?? Math.max(rows.length, pageSize),
  };
}

/** fish `services/api/booking.ts#getLakesToReview` */
export async function getLakesToReview(t: Transport) {
  const res = await call(
    t,
    { method: 'GET', path: '/feed/bookings/to-review', auth: 'required' },
    z.object({ data: z.array(lakeToReviewSchema).nullish() })
  );
  return res.data ?? [];
}

export const LAKE_BOOKINGS_PAGE_SIZE = 20;

/** fish `services/api/booking.ts#getLakeBookings` — the operator inbox. */
export async function getLakeBookings(
  t: Transport,
  lakeId: string,
  params: { bucket: OperatorBucket; sub?: OperatorSub; page?: number; pageSize?: number }
): Promise<LakeBookingsPage> {
  const pageSize = params.pageSize ?? LAKE_BOOKINGS_PAGE_SIZE;
  const page = params.page ?? 1;
  const res = await call(
    t,
    {
      method: 'GET',
      path: `/feed/bookings/lake/${enc(lakeId)}`,
      query: { bucket: params.bucket, sub: params.sub, page, pageSize },
      auth: 'required',
    },
    bookingsPageResponseSchema
  );
  // `meta` is absent on a CMS that predates the bucket contract; the badge
  // reads zero rather than crashing the screen.
  return {
    data: res.data,
    pendingCount: res.meta?.pendingCount ?? 0,
    page: res.meta?.page ?? page,
    pageSize: res.meta?.pageSize ?? pageSize,
  };
}

/** fish `services/api/booking.ts#getBooking` — angler-or-owner gated. */
export async function getBooking(t: Transport, id: string) {
  const res = await call(
    t,
    { method: 'GET', path: `/feed/bookings/${enc(id)}`, auth: 'required' },
    z.object({ data: bookingSchema })
  );
  return res.data;
}

/** fish `services/api/booking.ts#cancelBooking` — the angler's own cancel. */
export async function cancelBooking(t: Transport, id: string, reason: string) {
  const res = await call(
    t,
    { method: 'PATCH', path: `/feed/bookings/${enc(id)}/cancel`, body: { reason }, auth: 'required' },
    z.object({ data: bookingSchema })
  );
  return res.data;
}

/** fish `services/api/booking.ts#acceptBooking` */
export async function acceptBooking(t: Transport, id: string) {
  const res = await call(
    t,
    { method: 'PATCH', path: `/feed/bookings/${enc(id)}/accept`, auth: 'required' },
    z.object({ data: bookingSchema })
  );
  return res.data;
}

/** fish `services/api/booking.ts#rejectBooking` */
export async function rejectBooking(t: Transport, id: string, reason: string) {
  const res = await call(
    t,
    { method: 'PATCH', path: `/feed/bookings/${enc(id)}/reject`, body: { reason }, auth: 'required' },
    z.object({ data: bookingSchema })
  );
  return res.data;
}

/** fish `services/api/booking.ts#operatorCancelBooking` */
export async function operatorCancelBooking(t: Transport, id: string, reason: string) {
  const res = await call(
    t,
    { method: 'PATCH', path: `/feed/bookings/${enc(id)}/operator-cancel`, body: { reason }, auth: 'required' },
    z.object({ data: bookingSchema })
  );
  return res.data;
}

/** fish `services/api/booking.ts#markNoShow` */
export async function markNoShow(t: Transport, bookingId: string, comment: string) {
  const res = await call(
    t,
    { method: 'POST', path: `/feed/bookings/${enc(bookingId)}/no-show`, body: { data: { comment } }, auth: 'required' },
    z.object({ data: bookingSchema })
  );
  return res.data;
}

/** fish `services/api/booking.ts#getOwnedLakes` */
export async function getOwnedLakes(t: Transport) {
  const res = await call(
    t,
    { method: 'GET', path: '/feed/owned-lakes', auth: 'required' },
    z.object({ data: z.array(ownedLakeSchema) })
  );
  return res.data;
}

/** fish `services/api/booking.ts#createBlock` */
export async function createBlock(t: Transport, input: AvailabilityBlockInput) {
  const res = await call(
    t,
    { method: 'POST', path: '/feed/availability-blocks', body: { data: input }, auth: 'required' },
    z.object({ data: availabilityBlockSchema })
  );
  return res.data;
}

/** fish `services/api/booking.ts#getBlocks` */
export async function getBlocks(t: Transport, lakeId: string) {
  const res = await call(
    t,
    { method: 'GET', path: '/feed/availability-blocks', query: { lakeId }, auth: 'required' },
    z.object({ data: z.array(availabilityBlockSchema) })
  );
  return res.data;
}

/** fish `services/api/booking.ts#deleteBlock` */
export async function deleteBlock(t: Transport, id: string) {
  const res = await call(
    t,
    { method: 'DELETE', path: `/feed/availability-blocks/${enc(id)}`, auth: 'required' },
    z.object({ data: deletedBlockSchema })
  );
  return res.data;
}

/**
 * fish `services/api/reservation.ts#createReservation`
 *
 * Legacy: the CMS emails staff and then always answers 400 `RESERVATION:NOT_IMPLEMENTED`
 * (`reservation/controllers/reservation.ts`). Kept because fish still ships the call.
 */
export async function createReservation(t: Transport, data: LakeReservation) {
  const res = await call(
    t,
    { method: 'POST', path: '/reservations', body: { data }, auth: 'optional' },
    z.object({ data: z.unknown() })
  );
  return res.data;
}
