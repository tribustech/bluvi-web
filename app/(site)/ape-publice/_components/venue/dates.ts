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
 * contradicts the duration beside it. The history pages back without end, so a partidă from
 * another year (Romania's year, `now`) carries it: «9 AUG 2025 · 09:07 – 13:20», «9 AUG 09:07 –
 * 11 AUG 2025 08:51» (the year after the end date), both years when the range crosses New Year.
 * The current year's form is fish's, unchanged.
 */
export function dateRange(startedAt: string, endedAt: string, now: number = Date.now()): string {
  const s = parts(startedAt);
  const e = parts(endedAt);
  const thisYear = parts(now).year;
  const crossYear = s.year !== e.year;
  const sy = crossYear ? ` ${s.year}` : '';
  const ey = crossYear || e.year !== thisYear ? ` ${e.year}` : '';
  if (s.year === e.year && s.month === e.month && s.day === e.day) return `${s.day} ${MONTHS[s.month]}${ey} · ${s.time} – ${e.time}`;
  return `${s.day} ${MONTHS[s.month]}${sy} ${s.time} – ${e.day} ${MONTHS[e.month]}${ey} ${e.time}`;
}

/** A machine-readable date for <time dateTime>. */
export const isoDate = (iso: string) => new Date(iso).toISOString();

/**
 * A partidă's length with spaced units, one abbreviation family («47 h 44 min», «18 min», «<1 min»
 * under a minute — never «0 min»). The web's own wording for the water's cards (owner rule 10);
 * core fmtSpan keeps fish's «47h 44m» for the parity texts that quote it.
 */
export function fmtDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 60_000));
  if (total < 1) return '<1 min';
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}
