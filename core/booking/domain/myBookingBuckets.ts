/** fish `features/bookings/myBookingBuckets.ts` (verbatim). */
/**
 * Tab model for the angler's "Rezervările mele". Same server contract as the
 * operator inbox (fir-intins-cms/src/api/booking/services/booking-buckets.ts),
 * different words and a different sub set — the angler is reading their own
 * bookings, not working a queue.
 *
 * Two deliberate differences from `features/operator/bookingBuckets.ts`:
 *   · no `toreview` sub — that one filters on the OPERATOR's review of the
 *     angler, a different relation entirely; the angler's own "leave a review"
 *     prompt is a separate endpoint (/feed/bookings/to-review);
 *   · "Confirmate" has no unfiltered view. Without a sub the server returns
 *     future and finished stays in one `startDate asc` list, i.e. the oldest
 *     completed stay first — which is exactly the ordering the sub-filters exist
 *     to avoid, so it is never offered.
 */

export type MyBucket = 'pending' | 'confirmed' | 'unfinished' | 'all';
export type MySub = 'today' | 'upcoming' | 'past' | 'rejected' | 'cancelled' | 'noshow';

/**
 * Tab order — "Toate" leads because it is also the landing tab: with the
 * operator's order it sat last, off the right edge of the scroller, so the
 * screen opened on a tab the angler could not see was selected.
 */
export const MY_BUCKETS: MyBucket[] = ['all', 'pending', 'confirmed', 'unfinished'];

export const MY_BUCKET_LABELS: Record<MyBucket, string> = {
  pending: 'În așteptare',
  confirmed: 'Confirmate',
  unfinished: 'Nefinalizate',
  all: 'Toate',
};

export const MY_SUB_LABELS: Record<MySub, string> = {
  today: 'Azi',
  upcoming: 'Viitoare',
  past: 'Trecute',
  rejected: 'Respinse',
  cancelled: 'Anulate',
  noshow: 'Neprezentări',
};

const SUBS: Record<MyBucket, MySub[]> = {
  pending: [],
  confirmed: ['today', 'upcoming', 'past'],
  unfinished: ['rejected', 'cancelled', 'noshow'],
  all: [],
};

export function mySubsFor(bucket: MyBucket): MySub[] {
  return SUBS[bucket];
}

/** Whether the bucket also offers its own unfiltered view as a leading chip. */
export function allowsUnfilteredView(bucket: MyBucket): boolean {
  return bucket !== 'confirmed';
}

/** `undefined` means the bucket's own unfiltered view. */
export function myDefaultSub(bucket: MyBucket): MySub | undefined {
  return bucket === 'confirmed' ? 'upcoming' : undefined;
}

const EMPTY: Record<string, string> = {
  pending: 'Nicio cerere în așteptare.',
  'confirmed:today': 'Nicio rezervare astăzi.',
  'confirmed:upcoming': 'Nicio rezervare viitoare.',
  'confirmed:past': 'Nicio rezervare încheiată.',
  'unfinished:rejected': 'Nicio rezervare respinsă.',
  'unfinished:cancelled': 'Nicio rezervare anulată.',
  'unfinished:noshow': 'Nicio neprezentare.',
  unfinished: 'Nimic nefinalizat.',
};

/** What an empty list says, per (bucket, sub). `all` has none: an angler with no
 *  bookings at all gets the full empty-state hero instead of a one-liner. */
export function myEmptyCopy(bucket: MyBucket, sub?: MySub): string {
  return EMPTY[sub ? `${bucket}:${sub}` : bucket] ?? 'Nicio rezervare.';
}
