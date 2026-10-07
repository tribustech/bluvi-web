/** fish `helpers/formatBookingPeriod.ts` (date-fns replaced by `./dates`, same output). */
import { capitalize, pad2, RO_MONTHS_ABBR, RO_WEEKDAYS_WIDE } from './dates';
import { zoneOffsetMinutes } from './timezone';

/** date-fns `subMinutes`. */
const subMinutes = (d: Date, minutes: number) => new Date(d.getTime() - minutes * 60_000);

/** The wall-clock fields of an instant: the device's (fish, date-fns), or `timeZone`'s when given. */
type Wall = { y: number; mo: number; d: number; wd: number; h: number; mi: number };

/**
 * fish reads the device clock, which on a Romanian phone is the lake's. The web runs in any zone
 * (a visitor in London or Chișinău), so a caller that knows the lake's zone passes it and every
 * figure reads the lake's wall clock — the same clock `countNights` counts nights in.
 */
function wall(instant: Date, timeZone?: string): Wall {
  if (!timeZone) {
    return {
      y: instant.getFullYear(),
      mo: instant.getMonth(),
      d: instant.getDate(),
      wd: instant.getDay(),
      h: instant.getHours(),
      mi: instant.getMinutes(),
    };
  }
  const s = new Date(instant.getTime() + zoneOffsetMinutes(instant, timeZone) * 60_000);
  return {
    y: s.getUTCFullYear(),
    mo: s.getUTCMonth(),
    d: s.getUTCDate(),
    wd: s.getUTCDay(),
    h: s.getUTCHours(),
    mi: s.getUTCMinutes(),
  };
}

/** `cap(format(d, 'EEEE, d MMM', { locale: ro }))` — «Sâmbătă, 15 aug». */
const day = (w: Wall) => capitalize(`${RO_WEEKDAYS_WIDE[w.wd]}, ${w.d} ${RO_MONTHS_ABBR[w.mo]}`);
/** `format(d, 'HH:mm')`. */
const hhmm = (w: Wall) => `${pad2(w.h)}:${pad2(w.mi)}`;
const dayKey = (w: Wall) => `${w.y}-${w.mo}-${w.d}`;

/** The hour (0–23) an instant reads on the lake's clock (`timeZone`), or the device's without one. */
export function wallHour(iso: string, timeZone?: string): number {
  return wall(new Date(iso), timeZone).h;
}

/**
 * Booking period line with the FULL weekday, e.g.
 * "Sâmbătă, 15 aug · 06:00–18:00". Multi-day periods show both dates:
 * "Sâmbătă, 15 aug 06:00 – Duminică, 16 aug 18:00".
 *
 * `checkoutBufferMinutes` is the lake's stand-changeover time: the booking still
 * OWNS the full cycle (all availability and pricing math uses `endISO` untouched),
 * but the angler must be gone this many minutes earlier so the next arrival can move
 * in. Only the displayed end moves — and it is computed before the same-day check,
 * since a buffer can pull an end at midnight back into the previous day.
 *
 * `timeZone` (the lake's IANA zone) reads the period on the lake's clock; without it, the device's.
 */
export function formatBookingPeriod(startISO: string, endISO: string, checkoutBufferMinutes = 0, timeZone?: string): string {
  const start = wall(new Date(startISO), timeZone);
  const end = wall(subMinutes(new Date(endISO), checkoutBufferMinutes), timeZone);
  if (dayKey(start) === dayKey(end)) return `${day(start)} · ${hhmm(start)}–${hhmm(end)}`;
  return `${day(start)} ${hhmm(start)} – ${day(end)} ${hhmm(end)}`;
}

/**
 * One endpoint of a booking period, e.g. "Duminică, 23 aug · 06:00".
 * Pass the lake's checkout buffer as `subtractMinutes` for an END point; leave it at 0
 * for a start point. `timeZone` as in `formatBookingPeriod`.
 */
export function formatBookingPoint(iso: string, subtractMinutes = 0, timeZone?: string): string {
  const w = wall(subMinutes(new Date(iso), subtractMinutes), timeZone);
  return `${day(w)} · ${hhmm(w)}`;
}
