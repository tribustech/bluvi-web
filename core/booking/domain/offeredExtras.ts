/** fish `features/lakes/booking/offeredExtras.ts` (verbatim). */
import type { AvailabilityExtra, AvailabilityStand } from '../schemas';

/**
 * The extras this stand can actually add to THIS booking.
 *
 * A stand offering only a per-night extra has nothing to add to a day tour: a
 * 06:00–18:00 booking covers no nights, so a cabin priced per night cannot be
 * sold with it. `ExtrasStep` has always filtered on that, but the two callers
 * that decide whether to *show* the step asked the weaker question — "does this
 * stand have any extras at all" — so a day tour on a stand with a cabin walked
 * into the step and found it empty, under a sheet that had just promised extras
 * at the next step.
 *
 * One predicate, used by everything that asks the question: the step's own
 * render, the decision to enter it, and the sentence in the selection sheet.
 */
export function offeredExtras(
  stand: Pick<AvailabilityStand, 'extras'>,
  extras: AvailabilityExtra[],
  nights: number
): AvailabilityExtra[] {
  return extras.filter(e => stand.extras.includes(e.key) && (e.unit === 'perStay' || nights > 0));
}
