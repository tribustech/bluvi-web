/*
 * Pure helpers of step «Detalii de bază» (organizer.step-basics), in the browser's local time like
 * fish (date-fns `format` on the device clock): the date row's label, the picker's draft date.
 */

/** date-fns `ro` abbreviated months (fish formats with `{ locale: ro }`). */
const MONTHS_SHORT = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'noi', 'dec'];

const pad = (n: number) => String(n).padStart(2, '0');

const parse = (iso: string | null | undefined): Date | null => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** «d MMM yyyy» (ro): «14 noi 2026». */
export function formatDay(d: Date): string {
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

/** «HH:mm», 24 h. */
export function formatTime(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** fish getDateLabel: «Selectează data» or «d MMM yyyy, HH:mm» in Romanian (c7). */
export function formatDateLabel(iso: string | null | undefined): string {
  const d = parse(iso);
  return d ? `${formatDay(d)}, ${formatTime(d)}` : 'Selectează data';
}

/** fish getCurrentFieldDate: the field's own date, else now. */
export function initialPickerDate(iso: string | null | undefined, now: Date = new Date()): Date {
  const d = parse(iso) ?? now;
  const out = new Date(d);
  out.setSeconds(0, 0);
  return out;
}

/** fish combineDateAndTime: the day of `datePart` at the hour and minute of `timePart`. */
export function combineDateAndTime(datePart: Date, timePart: Date): Date {
  const out = new Date(datePart);
  out.setHours(timePart.getHours(), timePart.getMinutes(), 0, 0);
  return out;
}

/** Local `YYYY-MM-DD` of a date (the calendar's day keys). */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * fish keyboardType="number-pad": the fee field keeps digits only (no sign, no decimals), so a
 * typed «-» or «,» never reaches the form.
 */
export function feeDigits(raw: string): string {
  return raw.replace(/\D+/g, '');
}
