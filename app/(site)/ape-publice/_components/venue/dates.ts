/*
 * Dates of the community pages in Romania's time, on the server and in the browser alike, so a
 * server-rendered card never disagrees with its hydrated twin (fish formats in the device's zone —
 * Romania for its users). Same copy as fish format.ts: «12 IUL», «26 IUL · 06:40 – 18:10».
 */

const MONTHS = ['IAN', 'FEB', 'MAR', 'APR', 'MAI', 'IUN', 'IUL', 'AUG', 'SEP', 'OCT', 'NOI', 'DEC'];

const PARTS = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Bucharest',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function parts(iso: string | number) {
  const p = Object.fromEntries(PARTS.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return { year: Number(p.year), day: Number(p.day), month: Number(p.month) - 1, time: `${p.hour}:${p.minute}` };
}

/** fish fmtRecordDate: «12 IUL». */
export function dayMonth(iso: string): string {
  const p = parts(iso);
  return `${p.day} ${MONTHS[p.month]}`;
}

/**
 * fish fmtRange: «26 IUL · 06:40 – 18:10» for a partidă within one day (Romania's day). One that
 * runs past midnight names both days — «20 SEP 08:00 – 22 SEP 18:30» — so the range never
 * contradicts the duration beside it.
 */
export function dateRange(startedAt: string, endedAt: string): string {
  const s = parts(startedAt);
  const e = parts(endedAt);
  if (s.year === e.year && s.month === e.month && s.day === e.day) return `${s.day} ${MONTHS[s.month]} · ${s.time} – ${e.time}`;
  return `${s.day} ${MONTHS[s.month]} ${s.time} – ${e.day} ${MONTHS[e.month]} ${e.time}`;
}

/** A machine-readable date for <time dateTime>. */
export const isoDate = (iso: string) => new Date(iso).toISOString();
