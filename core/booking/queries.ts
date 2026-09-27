import { infiniteQueryOptions, queryOptions } from '../shared';
import type { Transport } from '../transport';
import {
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
} from './api';
import { monthWindow } from './domain/availabilityPaging';
import type { MyBucket, MySub } from './domain/myBookingBuckets';
import type { OperatorBucket, OperatorSub } from './domain/operatorBookingBuckets';
import type { BookingQuote, LakeBookingsPage, MyBookingsPage } from './schemas';

/** fish `queryKeys.bookings` (+ the inline `['booking-quote', …]` key of `useBookingQuote`). */
export const bookingKeys = {
  all: ['bookings'] as const,
  mine: ['bookings', 'mine'] as const,
  // Sits under the ['bookings'] prefix so the Home pull-to-refresh, which
  // invalidates that prefix, brings the badge current too.
  mineCount: ['bookings', 'mine-count'] as const,
  mineList: (bucket: string, sub?: string) => ['bookings', 'mine', bucket, sub ?? ''] as const,
  toReview: ['bookings', 'to-review'] as const,
  detail: (id: string) => ['bookings', 'detail', id] as const,
  lakeList: (lakeId: string, bucket: string, sub?: string) => ['bookings', 'lake', lakeId, bucket, sub ?? ''] as const,
  availabilityPaged: (lakeId: string) => ['bookings', 'availability-paged', lakeId] as const,
  blocks: (lakeId: string) => ['bookings', 'blocks', lakeId] as const,
  ownedLakes: ['bookings', 'owned-lakes'] as const,
  anglerLookup: (lakeId: string, phone: string) => ['bookings', 'angler-lookup', lakeId, phone] as const,
  /** NOT under ['bookings']: fish keys the quote on its own root, so booking writes never refetch it. */
  quote: (
    lakeId: string | undefined,
    standId: string | undefined,
    startISO: string | undefined,
    endISO: string | undefined,
    sortedExtras: string,
    walkIn: boolean
  ) => ['booking-quote', lakeId, standId, startISO, endISO, sortedExtras, walkIn] as const,
};

/** fish `useBooking` */
export function bookingQuery(t: Transport, id: string) {
  return queryOptions({
    queryKey: bookingKeys.detail(id),
    queryFn: () => getBooking(t, id),
    enabled: !!id,
  });
}

/**
 * fish `useBookingQuote`
 *
 * What the selected tour costs, according to the server that will charge it.
 *
 * The app deliberately does not price anything itself. Availability, the rules
 * and the rate table all live on the backend, and a resolver here would drift
 * from them the moment either changed.
 *
 * Cached per (stand, window, extras) so toggling an extra back and forth shows
 * the last answer instantly, and kept on screen while a new one is in flight so
 * the sheet never blanks mid-selection.
 *
 * DELIBERATELY NOT stale-tolerant. A cached price is shown at once and refetched
 * at once: an operator can change a rate while an angler is choosing, and the
 * only thing standing between a stale number and a wrong booking is the
 * `expectedTotal` guard — which answers 409 PRICE_CHANGED without a `bluCode`,
 * so the app cannot even tell the angler what happened. Better to be right
 * within one round-trip than to explain that.
 */
export function bookingQuoteQuery(
  t: Transport,
  args: { lakeId?: string; standId?: string; startISO?: string; endISO?: string; extras: string[]; walkIn?: boolean }
) {
  const { lakeId, standId, startISO, endISO } = args;
  const extras = [...args.extras].sort();
  return queryOptions({
    queryKey: bookingKeys.quote(lakeId, standId, startISO, endISO, extras.join(','), !!args.walkIn),
    queryFn: (): Promise<BookingQuote> =>
      getBookingQuote(t, {
        lakeId: lakeId as string,
        standId: standId as string,
        startISO: startISO as string,
        endISO: endISO as string,
        extras,
        walkIn: args.walkIn,
      }),
    enabled: !!lakeId && !!standId && !!startISO && !!endISO,
    placeholderData: (previous: BookingQuote | undefined) => previous,
    staleTime: 0,
  });
}

/**
 * fish `useLakeAvailability` — one page per calendar month, endless forward; no back-paging
 * (the grid starts at yesterday). fish pins `now` once per mount (`useMemo`); pass the same
 * Date for the lifetime of the grid.
 */
export function lakeAvailabilityInfiniteQuery(t: Transport, lakeId: string, now: Date = new Date()) {
  return infiniteQueryOptions({
    queryKey: bookingKeys.availabilityPaged(lakeId),
    queryFn: ({ pageParam }: { pageParam: number }) => {
      const w = monthWindow(pageParam, now);
      return getLakeAvailability(t, lakeId, { from: w.from, to: w.to });
    },
    initialPageParam: 0,
    getNextPageParam: (_lastPage, _allPages, lastPageParam: number) => lastPageParam + 1,
    enabled: !!lakeId,
    staleTime: 0, // live availability
  });
}

/** fish `useLakeBlocks` */
export function lakeBlocksQuery(t: Transport, lakeId: string) {
  return queryOptions({
    queryKey: bookingKeys.blocks(lakeId),
    queryFn: () => getBlocks(t, lakeId),
    enabled: !!lakeId,
  });
}

/**
 * fish `useLakeBookings`
 *
 * One infinite query per (bucket, sub). The endpoint returns no total, so a page
 * that comes back short IS the last page — asking the server to count every
 * matching row on every request would buy a number the UI never displays.
 *
 * No `keepPreviousData`: it kept the previous bucket's rows up until the new
 * ones landed, so a tab tap looked like a lagging list rather than a loading
 * one. The screen renders a skeleton for an uncached tab instead; a cached tab
 * still paints instantly and revalidates in the background.
 */
export function lakeBookingsInfiniteQuery(t: Transport, lakeId: string, bucket: OperatorBucket, sub?: OperatorSub) {
  return infiniteQueryOptions({
    queryKey: bookingKeys.lakeList(lakeId, bucket, sub),
    queryFn: ({ pageParam }: { pageParam: number }) => getLakeBookings(t, lakeId, { bucket, sub, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage: LakeBookingsPage) =>
      lastPage.data.length < lastPage.pageSize ? undefined : lastPage.page + 1,
    enabled: !!lakeId,
  });
}

/** fish `useMyBookingsCount` — backs the number on the Home "Rezervări" tile. A count, not a list. */
export function myBookingsCountQuery(t: Transport, options?: { enabled?: boolean }) {
  return queryOptions({
    queryKey: bookingKeys.mineCount,
    queryFn: () => getMyBookingsUpcomingCount(t),
    enabled: options?.enabled ?? true,
  });
}

/**
 * fish `useMyBookingsPage`
 *
 * One infinite query per (bucket, sub), mirroring the operator inbox: the
 * endpoint returns no total, so a short page IS the last page.
 *
 * Deliberately NO `keepPreviousData`: holding the previous tab's rows on screen
 * made the tab switch look laggy — the pill moved, the list did not. An
 * uncached tab is `isPending` immediately, which the screen renders as a
 * skeleton; a tab already in cache still paints instantly and refetches behind.
 */
export function myBookingsPageInfiniteQuery(t: Transport, bucket: MyBucket, sub?: MySub) {
  return infiniteQueryOptions({
    queryKey: bookingKeys.mineList(bucket, sub),
    queryFn: ({ pageParam }: { pageParam: number }) => getMyBookingsPage(t, { bucket, sub, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage: MyBookingsPage) =>
      lastPage.data.length < lastPage.pageSize ? undefined : lastPage.page + 1,
  });
}

/**
 * fish `useLakesToReview`
 *
 * Lakes the angler has fished but never reviewed. Served by its own endpoint
 * rather than derived from the bookings list, which is paginated — the prompt
 * has to be right regardless of which tab or page is on screen.
 */
export function lakesToReviewQuery(t: Transport) {
  return queryOptions({
    queryKey: bookingKeys.toReview,
    queryFn: () => getLakesToReview(t),
    staleTime: 60_000,
  });
}

/** fish `useOwnedLakes` */
export function ownedLakesQuery(t: Transport) {
  return queryOptions({
    queryKey: bookingKeys.ownedLakes,
    queryFn: () => getOwnedLakes(t),
  });
}

/** Below this many digits a number can't be a real phone in any country plan. */
export const MIN_PHONE_DIGITS = 7;

/**
 * fish `useAnglerLookup`
 *
 * Look up whether a typed phone belongs to an existing app account, for the
 * walk-in match-confirm sheet. `armed` is what fires it — the caller arms it on
 * blur (and on submit), never per keystroke: an earlier version keyed off a
 * complete-looking 10-digit RO number, which both spammed the endpoint mid-typing
 * and silently skipped every international number. Owner-gated on the server.
 * `staleTime` keeps the result for the session so re-typing the same number
 * doesn't re-hit the API.
 */
export function anglerLookupQuery(t: Transport, lakeId: string, phone: string, armed: boolean) {
  const digits = phone.replace(/\D/g, '');
  const enabled = armed && Boolean(lakeId) && digits.length >= MIN_PHONE_DIGITS;
  return queryOptions({
    queryKey: bookingKeys.anglerLookup(lakeId, phone),
    queryFn: () => lookupAnglerByPhone(t, lakeId, phone),
    enabled,
    staleTime: 5 * 60 * 1000,
    // A miss (no account) or a 403 (not granted) is a definitive answer — don't
    // hammer the endpoint with the default retry burst.
    retry: false,
  });
}
