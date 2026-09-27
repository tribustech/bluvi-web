import { offsetSuffix } from './timezone';

/**
 * The handful of date-fns calls the fish booking logic makes (`format`, `startOfDay`, `addDays`,
 * `differenceInCalendarDays`, `isSameDay`, `startOfMonth(addMonths())` and the `ro` locale names),
 * re-implemented on plain `Date` because bluvi-web does not depend on date-fns. Same semantics as
 * date-fns: everything reads and writes the DEVICE-LOCAL wall clock, exactly as fish does — the
 * lake-zone paths go through `timezone.ts` instead.
 */

export const pad2 = (n: number) => String(n).padStart(2, '0');

/** date-fns `ro` locale — `EEEE` (wide weekdays), JS `getDay()` order. */
export const RO_WEEKDAYS_WIDE = ['duminică', 'luni', 'marți', 'miercuri', 'joi', 'vineri', 'sâmbătă'];
/** date-fns `ro` locale — `EEEEEE` (short weekdays), JS `getDay()` order. */
export const RO_WEEKDAYS_SHORT = ['du', 'lu', 'ma', 'mi', 'jo', 'vi', 'sâ'];
/** date-fns `ro` locale — `MMM` (abbreviated months). */
export const RO_MONTHS_ABBR = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'noi', 'dec'];
/** date-fns `ro` locale — `LLLL` (wide months). */
export const RO_MONTHS_WIDE = [
  'ianuarie',
  'februarie',
  'martie',
  'aprilie',
  'mai',
  'iunie',
  'iulie',
  'august',
  'septembrie',
  'octombrie',
  'noiembrie',
  'decembrie',
];

export const capitalize = (v: string) => (v ? v.charAt(0).toUpperCase() + v.slice(1) : v);

/** date-fns `startOfDay`. */
export function startOfDay(d: Date): Date {
  const r = new Date(d.getTime());
  r.setHours(0, 0, 0, 0);
  return r;
}

/** date-fns `addDays` (local calendar days, DST-safe). */
export function addDays(d: Date, amount: number): Date {
  const r = new Date(d.getTime());
  r.setDate(r.getDate() + amount);
  return r;
}

/** date-fns `startOfMonth(addMonths(d, amount))`. */
export function startOfMonthOffset(d: Date, amount: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + amount, 1, 0, 0, 0, 0);
}

/** date-fns `differenceInCalendarDays` — whole local calendar days, DST-safe. */
export function differenceInCalendarDays(later: Date, earlier: Date): number {
  const a = Date.UTC(later.getFullYear(), later.getMonth(), later.getDate());
  const b = Date.UTC(earlier.getFullYear(), earlier.getMonth(), earlier.getDate());
  return Math.round((a - b) / 86_400_000);
}

/** date-fns `isSameDay`. */
export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** date-fns `isValid`. */
export const isValidDate = (d: Date) => !Number.isNaN(d.getTime());

/** `format(d, 'HH')`. */
export const formatHH = (d: Date) => pad2(d.getHours());
/** `format(d, 'HH:mm')`. */
export const formatHHmm = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
/** `format(d, 'yyyy-MM-dd')`. */
export const formatDayKey = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
/** `format(d, "yyyy-MM-dd'T'HH:mm:ssxxx")` — device-local ISO 8601 with offset. */
export const formatLocalIso = (d: Date) =>
  `${formatDayKey(d)}T${formatHHmm(d)}:${pad2(d.getSeconds())}${offsetSuffix(-d.getTimezoneOffset())}`;
/** `format(d, 'EEEE', { locale: ro })`. */
export const formatWeekdayWide = (d: Date) => RO_WEEKDAYS_WIDE[d.getDay()];
/** `format(d, 'EEEEEE', { locale: ro })`. */
export const formatWeekdayShort = (d: Date) => RO_WEEKDAYS_SHORT[d.getDay()];
/** `format(d, 'MMM', { locale: ro })`. */
export const formatMonthAbbr = (d: Date) => RO_MONTHS_ABBR[d.getMonth()];
/** `format(d, 'LLLL yyyy', { locale: ro })`. */
export const formatMonthYear = (d: Date) => `${RO_MONTHS_WIDE[d.getMonth()]} ${d.getFullYear()}`;
