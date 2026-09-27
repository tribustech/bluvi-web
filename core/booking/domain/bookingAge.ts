/** fish `features/operator/bookingAge.ts` (verbatim). */
/**
 * How long a booking request has been sitting there, written the way an operator
 * would say it out loud. Minutes stay visible inside the first day because the
 * difference between "acum 2 h" and "acum 2 h 13 min" is what tells them whether
 * a request just came in or has been drifting.
 */
export function bookingAgeLabel(createdAt: string | undefined, now: number = Date.now()): string | null {
  if (!createdAt) return null;
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return null;

  const minutes = Math.floor((now - created) / 60_000);
  // A clock skew between device and server can put a fresh row slightly in the
  // future; "acum câteva secunde" is the honest reading, not a negative age.
  if (minutes < 1) return 'acum câteva secunde';
  if (minutes < 60) return `acum ${minutes} min`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    const rest = minutes % 60;
    return rest === 0 ? `acum ${hours} h` : `acum ${hours} h ${rest} min`;
  }

  const days = Math.floor(hours / 24);
  return days === 1 ? 'acum o zi' : `acum ${days} zile`;
}

/** Past this, an unanswered request is late enough to call out in red. */
export const STALE_REQUEST_HOURS = 5;

/** Only a request still waiting on the operator can be late — a confirmed or
 *  cancelled booking is simply old, and colouring it red would cry wolf. */
export function isRequestStale(
  createdAt: string | undefined,
  isPending: boolean,
  now: number = Date.now()
): boolean {
  if (!isPending || !createdAt) return false;
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return false;
  return now - created >= STALE_REQUEST_HOURS * 3_600_000;
}
