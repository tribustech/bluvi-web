/** fish `helpers/formatBookingPeriod.ts` (date-fns replaced by `./dates`, same output). */
import { capitalize, formatDayKey, formatHHmm, formatMonthAbbr, formatWeekdayWide } from './dates';

/** date-fns `subMinutes`. */
const subMinutes = (d: Date, minutes: number) => new Date(d.getTime() - minutes * 60_000);

/** `cap(format(d, 'EEEE, d MMM', { locale: ro }))` — «Sâmbătă, 15 aug». */
const day = (d: Date) => capitalize(`${formatWeekdayWide(d)}, ${d.getDate()} ${formatMonthAbbr(d)}`);

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
 */
export function formatBookingPeriod(startISO: string, endISO: string, checkoutBufferMinutes = 0): string {
  const start = new Date(startISO);
  const end = subMinutes(new Date(endISO), checkoutBufferMinutes);
  const sameDay = formatDayKey(start) === formatDayKey(end);
  if (sameDay) return `${day(start)} · ${formatHHmm(start)}–${formatHHmm(end)}`;
  return `${day(start)} ${formatHHmm(start)} – ${day(end)} ${formatHHmm(end)}`;
}

/**
 * One endpoint of a booking period, e.g. "Duminică, 23 aug · 06:00".
 * Pass the lake's checkout buffer as `subtractMinutes` for an END point; leave it at 0
 * for a start point.
 */
export function formatBookingPoint(iso: string, subtractMinutes = 0): string {
  const d = subMinutes(new Date(iso), subtractMinutes);
  return `${day(d)} · ${formatHHmm(d)}`;
}
