/*
 * Competition dates in Bucharest time, formatted on the server (the browser never formats them, so
 * server and client render the same string). Hand-rolled month/day names: no ICU drift.
 */

const TZ = 'Europe/Bucharest';
const WEEKDAYS_SHORT = ['DUM', 'LUN', 'MAR', 'MIE', 'JOI', 'VIN', 'SÂM'];
const WEEKDAYS = ['duminică', 'luni', 'marți', 'miercuri', 'joi', 'vineri', 'sâmbătă'];
const MONTHS_SHORT = ['IAN.', 'FEB.', 'MAR.', 'APR.', 'MAI', 'IUN.', 'IUL.', 'AUG.', 'SEPT.', 'OCT.', 'NOV.', 'DEC.'];
const MONTHS = [
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
const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

type Parts = { year: number; month: number; day: number; weekday: number; hour: string; minute: string };

function parts(iso: string): Parts | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: TZ,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .map(x => [x.type, x.value]),
  );
  return {
    year: Number(p.year),
    month: Number(p.month) - 1,
    day: Number(p.day),
    weekday: WEEKDAY_INDEX[p.weekday] ?? 0,
    hour: p.hour,
    minute: p.minute,
  };
}

/** Header line (design): «SÂM, 27 – DUM, 28 SEPT.» · «SÂM, 30 SEPT. – DUM, 1 OCT.» · «SÂM, 27 SEPT.» */
export function competitionDateLabel(startIso: string, endIso: string): string {
  const s = parts(startIso);
  const e = parts(endIso);
  if (!s) return '';
  const start = `${WEEKDAYS_SHORT[s.weekday]}, ${s.day}`;
  if (!e || (e.year === s.year && e.month === s.month && e.day === s.day)) return `${start} ${MONTHS_SHORT[s.month]}`;
  const end = `${WEEKDAYS_SHORT[e.weekday]}, ${e.day} ${MONTHS_SHORT[e.month]}`;
  if (e.year !== s.year) return `${start} ${MONTHS_SHORT[s.month]} ${s.year} – ${end} ${e.year}`;
  if (e.month !== s.month) return `${start} ${MONTHS_SHORT[s.month]} – ${end}`;
  return `${start} – ${end}`;
}

/** Metadata / JSON-LD prose: «27–28 septembrie 2026». */
export function competitionDateProse(startIso: string, endIso: string): string {
  const s = parts(startIso);
  const e = parts(endIso);
  if (!s) return '';
  if (!e || (e.year === s.year && e.month === s.month && e.day === s.day)) return `${s.day} ${MONTHS[s.month]} ${s.year}`;
  if (e.year !== s.year) return `${s.day} ${MONTHS[s.month]} ${s.year} – ${e.day} ${MONTHS[e.month]} ${e.year}`;
  if (e.month !== s.month) return `${s.day} ${MONTHS[s.month]} – ${e.day} ${MONTHS[e.month]} ${e.year}`;
  return `${s.day}–${e.day} ${MONTHS[s.month]} ${s.year}`;
}

/** fish CompetitionDetailsPreview `EEE, dd MMM yyyy, HH:mm` (ro): «sâmbătă, 27 septembrie 2026, 07:00». */
export function competitionDateTime(iso: string): string {
  const p = parts(iso);
  if (!p) return '';
  return `${WEEKDAYS[p.weekday]}, ${String(p.day).padStart(2, '0')} ${MONTHS[p.month]} ${p.year}, ${p.hour}:${p.minute}`;
}

/** The countdown caption (Fundații StatTile «Începe în»): «sâm, 11 oct · 07:00». */
export function competitionStartShort(iso: string): string {
  const p = parts(iso);
  if (!p) return '';
  return `${WEEKDAYS_SHORT[p.weekday].toLocaleLowerCase('ro')}, ${p.day} ${MONTHS_SHORT[p.month].replace('.', '').toLocaleLowerCase('ro')} · ${p.hour}:${p.minute}`;
}

/** A compact date-time for the details' facts (one line in a narrow column): «mar, 6 oct 2026 · 00:01». */
export function competitionDateTimeCompact(iso: string): string {
  const p = parts(iso);
  if (!p) return '';
  return `${WEEKDAYS_SHORT[p.weekday].toLocaleLowerCase('ro')}, ${p.day} ${MONTHS_SHORT[p.month].replace('.', '').toLocaleLowerCase('ro')} ${p.year} · ${p.hour}:${p.minute}`;
}

/** «07:42» in Bucharest. */
export function clockTime(iso: string): string {
  const p = parts(iso);
  return p ? `${p.hour}:${p.minute}` : '';
}

/** fish CantarItem `dd.MM, HH:mm`: «27.09, 07:42». */
export function shortDateTime(iso: string): string {
  const p = parts(iso);
  return p ? `${String(p.day).padStart(2, '0')}.${String(p.month + 1).padStart(2, '0')}, ${p.hour}:${p.minute}` : '';
}

/**
 * fish CompetitionInfo TimeBadge: «07:00» over the day. fish writes the day upper case
 * («SÂM, 04 OCT. 2026»); the web keeps sentence case (Fundații: no all-caps) — `date` the compact
 * «sâm, 4 oct 2026» (the phone's half-width marks, the same short forms as the facts' dates),
 * `dateLong` the full «sâmbătă, 4 octombrie 2026» (from 768).
 */
export function timeBadge(iso: string): { time: string; date: string; dateLong: string } {
  const p = parts(iso);
  if (!p) return { time: '', date: '', dateLong: '' };
  return {
    time: `${p.hour}:${p.minute}`,
    date: `${WEEKDAYS_SHORT[p.weekday].toLocaleLowerCase('ro')}, ${p.day} ${MONTHS_SHORT[p.month].replace('.', '').toLocaleLowerCase('ro')} ${p.year}`,
    dateLong: `${WEEKDAYS[p.weekday]}, ${p.day} ${MONTHS[p.month]} ${p.year}`,
  };
}

const HOUR = 3_600_000;

/**
 * fish `getCompetitionDuration` (core competitionLabels.ts) with Romanian count agreement: up to
 * 72 h «N oră/ore», above «N zi/zile [și M oră/ore]» — «de» from 20 («51 de ore», «20 de zile»),
 * which fish (and core) leave out. TODO(core owner): fold into core getCompetitionDuration.
 */
export function competitionDuration(startIso: string, endIso: string): string {
  const totalHours = Math.trunc((new Date(endIso).getTime() - new Date(startIso).getTime()) / HOUR);
  if (!Number.isFinite(totalHours)) return '';
  if (totalHours <= 72) return count(totalHours, 'oră', 'ore');
  const days = Math.trunc(totalHours / 24);
  const rest = totalHours - days * 24;
  const d = count(days, 'zi', 'zile');
  return rest === 0 ? d : `${d} și ${count(rest, 'oră', 'ore')}`;
}

/** fish ScaleItem «Finalizat la» `d MMM, HH:mm` (ro): «30 apr., 13:58». */
export function dayMonthTime(iso: string): string {
  const p = parts(iso);
  return p ? `${p.day} ${MONTHS_SHORT[p.month].toLocaleLowerCase('ro')}, ${p.hour}:${p.minute}` : '';
}

/** Romanian count + noun: «1 minut», «5 minute», «20 de minute» (the «de» from 20, as Romanian has it). */
function count(n: number, one: string, many: string): string {
  if (n === 1) return `1 ${one}`;
  if (n === 0) return `0 ${many}`;
  const r = n % 100;
  return r === 0 || r >= 20 ? `${n} de ${many}` : `${n} ${many}`;
}

/**
 * fish ScaleItem «acum {formatDistanceToNowStrict}» (date-fns ro): the elapsed time in its one
 * largest unit, rounded — seconds under a minute, then minutes, hours, days (under 30), months
 * (under 12), years. Grammar as Romanian has it («acum 20 de minute»; date-fns writes «20 minute»).
 * Time-dependent: render it in the browser only.
 */
export function timeAgo(iso: string, now: Date): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '';
  const s = Math.max(0, (now.getTime() - then) / 1000);
  const m = s / 60;
  const h = m / 60;
  const d = h / 24;
  let text: string;
  if (s < 60) text = count(Math.round(s), 'secundă', 'secunde');
  else if (m < 60) text = count(Math.round(m), 'minut', 'minute');
  else if (h < 24) text = count(Math.round(h), 'oră', 'ore');
  else if (d < 30) text = count(Math.round(d), 'zi', 'zile');
  else if (d < 365) text = count(Math.max(1, Math.round(d / 30.4375)), 'lună', 'luni');
  else text = count(Math.round(d / 365.25), 'an', 'ani');
  return `acum ${text}`;
}
