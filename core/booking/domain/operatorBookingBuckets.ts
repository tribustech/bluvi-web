/** fish `features/operator/bookingBuckets.ts` (verbatim). */
/**
 * Tab model for the operator inbox. Mirrors the server's bucket contract
 * (fir-intins-cms/src/api/booking/services/booking-buckets.ts) and owns every
 * string the screen shows, so the screen itself stays layout.
 */

export type OperatorBucket = 'pending' | 'confirmed' | 'unfinished' | 'all';
export type OperatorSub =
  | 'today'
  | 'upcoming'
  | 'past'
  | 'toreview'
  | 'rejected'
  | 'cancelled'
  | 'noshow';

/** Screen tab order. The single source of truth — BUCKET_LABELS is keyed off
 *  this shape too, and a test asserts the two cannot drift apart. */
export const BUCKETS: OperatorBucket[] = ['pending', 'confirmed', 'unfinished', 'all'];

export const BUCKET_LABELS: Record<OperatorBucket, string> = {
  pending: 'De aprobat',
  confirmed: 'Confirmate',
  unfinished: 'Nefinalizate',
  all: 'Toate',
};

export const SUB_LABELS: Record<OperatorSub, string> = {
  today: 'Azi',
  upcoming: 'Viitoare',
  past: 'Trecute',
  toreview: 'De evaluat',
  rejected: 'Cereri neacceptate',
  cancelled: 'Anulate',
  noshow: 'Neprezentări',
};

const SUBS: Record<OperatorBucket, OperatorSub[]> = {
  pending: [],
  confirmed: ['today', 'upcoming', 'past', 'toreview'],
  unfinished: ['rejected', 'cancelled', 'noshow'],
  all: [],
};

export function subsFor(bucket: OperatorBucket): OperatorSub[] {
  return SUBS[bucket];
}

/** `undefined` means the bucket's own unfiltered view — rendered as "Toate". */
export function defaultSub(bucket: OperatorBucket): OperatorSub | undefined {
  return bucket === 'confirmed' ? 'today' : undefined;
}

/**
 * Home and the operator panel link here with ?status=cancelled when they show
 * the "N cancelled in the last 24h" line. Neither screen is being changed, so
 * the link keeps working through this translation.
 *
 * `toreview` is not a booking status at all — it is the review queue's name,
 * carried on the same parameter so Home has one way of saying "open this list"
 * rather than a second, parallel link format.
 */
export function bucketFromLegacyStatus(status?: string): {
  bucket: OperatorBucket;
  sub?: OperatorSub;
} {
  if (status === 'cancelled') return { bucket: 'unfinished', sub: 'cancelled' };
  if (status === 'pending') return { bucket: 'pending' };
  if (status === 'rejected') return { bucket: 'unfinished', sub: 'rejected' };
  if (status === 'toreview') return { bucket: 'confirmed', sub: 'toreview' };
  // Used when a caller wants ONE named booking on screen and cannot know which tab
  // holds it — "all" is the only bucket guaranteed to contain it.
  if (status === 'all') return { bucket: 'all' };
  return { bucket: 'confirmed', sub: 'today' };
}

const EMPTY: Record<string, string> = {
  pending: 'Nimic de aprobat.',
  'confirmed:today': 'Nicio rezervare azi.',
  'confirmed:upcoming': 'Nicio rezervare viitoare.',
  'confirmed:past': 'Nicio rezervare încheiată.',
  'confirmed:toreview': 'Nimic de evaluat.',
  confirmed: 'Nicio rezervare confirmată.',
  unfinished: 'Nimic nefinalizat.',
  'unfinished:rejected': 'Nicio cerere neacceptată.',
  'unfinished:cancelled': 'Nicio anulare.',
  'unfinished:noshow': 'Nicio neprezentare.',
  all: 'Nicio rezervare.',
};

/** "Nicio rezervare." on the approvals tab reads as an error when what it means
 *  is "nothing is waiting on you". */
export function emptyCopy(bucket: OperatorBucket, sub?: OperatorSub): string {
  return EMPTY[sub ? `${bucket}:${sub}` : bucket] ?? EMPTY.all;
}
