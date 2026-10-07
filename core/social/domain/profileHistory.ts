import type { PublicSession } from '../schemas';

/*
 * Pure helpers of the angler profile's history tabs (fish components/profile/AnglerProfileScreen.tsx
 * and its helpers/). Dates are read in Romania's time by default (`timeZone`), so the server render
 * and the browser group and label a session the same way — fish reads the device's local time,
 * which on a phone in Romania is the same thing.
 */

/** fish helpers/roMonths.ts MONTHS_RO_FULL — full Romanian month names, uppercase, 0 = January. */
export const MONTHS_RO_FULL = [
  'IANUARIE',
  'FEBRUARIE',
  'MARTIE',
  'APRILIE',
  'MAI',
  'IUNIE',
  'IULIE',
  'AUGUST',
  'SEPTEMBRIE',
  'OCTOMBRIE',
  'NOIEMBRIE',
  'DECEMBRIE',
] as const;

/** fish helpers/roMonths.ts MONTH_ABBR_RO — 0 = January. */
export const MONTH_ABBR_RO = ['IAN', 'FEB', 'MAR', 'APR', 'MAI', 'IUN', 'IUL', 'AUG', 'SEP', 'OCT', 'NOI', 'DEC'] as const;

export const PROFILE_TIME_ZONE = 'Europe/Bucharest';

const formatters = new Map<string, Intl.DateTimeFormat>();

/** Year, month (0-based) and day of `iso` in `timeZone`; null for an unparseable date. */
export function datePartsIn(iso: string, timeZone = PROFILE_TIME_ZONE): { year: number; month: number; day: number } | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-GB', { timeZone, year: 'numeric', month: 'numeric', day: 'numeric' });
    formatters.set(timeZone, f);
  }
  const p = Object.fromEntries(f.formatToParts(d).map(x => [x.type, x.value]));
  return { year: Number(p.year), month: Number(p.month) - 1, day: Number(p.day) };
}

export type PublicSessionListRow =
  | { type: 'header'; key: string; label: string }
  | { type: 'session'; key: string; session: PublicSession };

/**
 * fish helpers/groupSessionsByMonth.ts (the PublicSession variant — core/partide's
 * groupSessionsByMonth groups the viewer's LOCAL sessions, a different shape). Sessions arrive
 * sorted startedAt desc from the API; grouping preserves that order: a header «{LUNA} {an}» each
 * time the month changes, then the session rows.
 */
export function groupPublicSessionsByMonth(sessions: readonly PublicSession[], timeZone = PROFILE_TIME_ZONE): PublicSessionListRow[] {
  const rows: PublicSessionListRow[] = [];
  let currentMonth = '';
  for (const session of sessions) {
    const p = datePartsIn(session.startedAt, timeZone);
    const label = p ? `${MONTHS_RO_FULL[p.month]} ${p.year}` : '';
    if (label && label !== currentMonth) {
      currentMonth = label;
      rows.push({ type: 'header', key: `h-${label}`, label });
    }
    rows.push({ type: 'session', key: session.documentId, session });
  }
  return rows;
}

/**
 * fish helpers/fmtCompetitionRange.ts — a competition's date range:
 *  - same day:        «2 OCT 2025»
 *  - same month:      «5–7 SEP 2025»
 *  - crosses month:   «30 SEP – 2 OCT 2025»
 *  - crosses year:    «30 DEC 2025 – 2 IAN 2026»
 * No start → ''.
 */
export function fmtCompetitionRange(start: string | null, end: string | null, timeZone = PROFILE_TIME_ZONE): string {
  if (!start) return '';
  const s = datePartsIn(start, timeZone);
  if (!s) return '';
  const e = end ? datePartsIn(end, timeZone) : null;

  const sameDay = !e || (e.year === s.year && e.month === s.month && e.day === s.day);
  if (sameDay) return `${s.day} ${MONTH_ABBR_RO[s.month]} ${s.year}`;

  const sameYear = e.year === s.year;
  const sameMonth = sameYear && e.month === s.month;
  if (sameMonth) return `${s.day}–${e.day} ${MONTH_ABBR_RO[s.month]} ${s.year}`;

  const startLabel = sameYear ? `${s.day} ${MONTH_ABBR_RO[s.month]}` : `${s.day} ${MONTH_ABBR_RO[s.month]} ${s.year}`;
  return `${startLabel} – ${e.day} ${MONTH_ABBR_RO[e.month]} ${e.year}`;
}

/**
 * A finished session's range on the profile's Sesiuni card — fish fmtRange «26 IUL · 06:40 – 18:10»
 * in `timeZone`. A session that ends on another day (overnight, the common 24–48h ones) names the
 * end day too — «17 FEB 14:32 – 18 FEB 12:54» — where fish's start-day-only form read backwards
 * («17 FEB · 14:32 – 12:54»). '' for an unparseable start; the end alone is dropped when unparseable.
 */
export function fmtSessionRange(startedAt: string, endedAt: string, timeZone = PROFILE_TIME_ZONE): string {
  const s = datePartsIn(startedAt, timeZone);
  if (!s) return '';
  const time = (iso: string) =>
    new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));
  const startDay = `${s.day} ${MONTH_ABBR_RO[s.month]}`;
  const e = datePartsIn(endedAt, timeZone);
  if (!e) return `${startDay} · ${time(startedAt)}`;
  const sameDay = e.year === s.year && e.month === s.month && e.day === s.day;
  return sameDay
    ? `${startDay} · ${time(startedAt)} – ${time(endedAt)}`
    : `${startDay} ${time(startedAt)} – ${e.day} ${MONTH_ABBR_RO[e.month]} ${time(endedAt)}`;
}

/**
 * fish helpers/dedupeByKey.ts — drops later duplicates by `keyFn`, keeping each key's FIRST
 * occurrence and otherwise preserving order (a no-op when there are none).
 *
 * A stable server-side sort tiebreaker is necessary but NOT sufficient for offset pagination: a row
 * that finishes / is created BETWEEN two page fetches shifts every later offset, so the same id can
 * come back on two pages. This is the client-side backstop wherever an infinite query's pages are
 * flattened into one list, so a duplicate never becomes a duplicate React key. Keeping the FIRST
 * occurrence matters: it is the one already on screen, so visible rows never jump. (fish also warns
 * in dev; a pure core function stays silent.)
 */
export function dedupeByKey<T>(items: readonly T[], keyFn: (item: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

/** fish StatStrip / CatchDetailFooter `fmtKg`: one decimal, a comma — «12,4» (no unit: the caller spaces it, owner rule 10). */
export function fmtProfileKg(kg: number): string {
  return kg.toFixed(1).replace('.', ',');
}

/** fish CatchDetailFooter `fmtDate`: «d MMM yyyy» with the Romanian abbreviations — «5 SEP 2025». */
export function fmtCatchDate(iso: string, timeZone = PROFILE_TIME_ZONE): string {
  const p = datePartsIn(iso, timeZone);
  return p ? `${p.day} ${MONTH_ABBR_RO[p.month]} ${p.year}` : '';
}

/** fish BioText: splits a bio into text and #hashtags (letters, digits, underscore). */
export function bioParts(bio: string): { text: string; tag: boolean }[] {
  return bio
    .split(/(#[\p{L}\p{N}_]+)/u)
    .filter(part => part !== '')
    .map(part => ({ text: part, tag: /^#[\p{L}\p{N}_]+$/u.test(part) }));
}

/** fish TrophyRow: the podium tiers above zero, in order (empty = no row). */
export function trophyTiers(podium: { first: number; second: number; third: number }): { key: 'first' | 'second' | 'third'; count: number }[] {
  return (['first', 'second', 'third'] as const).filter(k => podium[k] > 0).map(k => ({ key: k, count: podium[k] }));
}
