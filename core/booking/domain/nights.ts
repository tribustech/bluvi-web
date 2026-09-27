/** fish `features/lakes/booking/nights.ts` (verbatim). */
import { zoneOffsetMinutes } from './timezone';

/**
 * Nights spent, counted as the local midnights the tour crosses — the same rule
 * the server prices per-night extras by (`countNights` in booking-extras.ts).
 *
 * Not `hours / 24`: a lake sells the night, and 18:00 to 06:00 is one night
 * whether that is 12 hours or 13 across the autumn change. A tour that starts
 * and ends on the same local day crosses none.
 *
 * Display only. The total always comes from the server's quote.
 */
export function countNights(startISO: string, endISO: string, timeZone: string): number {
  const localDay = (iso: string) => {
    const instant = new Date(iso);
    const shifted = new Date(instant.getTime() + zoneOffsetMinutes(instant, timeZone) * 60000);
    return Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate());
  };
  return Math.max(0, Math.round((localDay(endISO) - localDay(startISO)) / 86_400_000));
}
