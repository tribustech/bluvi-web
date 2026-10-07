/*
 * fish hooks/useNouBadge.ts — the home Rezervări tile's «NOU» pill (booking.b.nou-badge): shown
 * before the launch deadline and until the first visit of Rezervările mele, which writes the key
 * (booking.rezervarile-mele.c21). Per browser, in localStorage; every access is try/catch (private
 * mode, blocked storage): no badge rather than one that never goes away.
 */

/** The storage key fish uses (AsyncStorage there, localStorage here). */
export const BOOKINGS_NOU_KEY = '@bluvi/bookings/visited/v1';

/** The pill is retired for everyone after this instant (fish BOOKINGS_NEW_BADGE_UNTIL). */
export const BOOKINGS_NEW_BADGE_UNTIL = Date.UTC(2026, 9, 1);

/** Records the visit (fish useNouVisitMarker). Safe to call anywhere in the browser. */
export function markBookingsVisited(): void {
  try {
    localStorage.setItem(BOOKINGS_NOU_KEY, '1');
  } catch {
    // Storage unavailable: the pill simply stays until the deadline.
  }
}
