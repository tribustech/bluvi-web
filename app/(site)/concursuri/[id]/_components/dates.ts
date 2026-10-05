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
