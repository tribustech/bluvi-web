/*
 * Calendar maths for the desktop tab views, in Bucharest — pure (no React, no Next), unit-tested in
 * model.test.ts.
 */

const TZ = 'Europe/Bucharest';
export const MONTHS_FULL = ['Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie', 'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie'] as const;
const WD: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const fmt = new Intl.DateTimeFormat('en-US', { timeZone: TZ, year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short' });

export type DayParts = { year: number; month: number; day: number; weekday: number; index: number };

/** A date's calendar day in Bucharest; `index` counts days since the epoch (week maths). */
export function dayParts(iso: string | Date): DayParts {
  const out: Record<string, string> = {};
  for (const p of fmt.formatToParts(new Date(iso))) out[p.type] = p.value;
  const year = Number(out.year);
  const month = Number(out.month) - 1;
  const day = Number(out.day);
  return { year, month, day, weekday: WD[out.weekday] ?? 0, index: Math.round(Date.UTC(year, month, day) / 86_400_000) };
}

/** The bucket a start day before today falls in: a not-started competition whose date passed. */
export const PAST_BUCKET = 'past';

/**
 * Agenda bucket: this week (Mon–Sun, from today), next week, then the month's name, then no date;
 * a start day already gone (still «not started») comes LAST, muted — what is ahead leads.
 */
export function bucketOf(startIso: string | null, now: Date): { key: string; label: string; order: number } {
  if (!startIso) return { key: 'tbd', label: 'Fără dată', order: 9e9 };
  const d = dayParts(startIso);
  const today = dayParts(now);
  if (d.index < today.index) return { key: PAST_BUCKET, label: 'Data de start a trecut', order: 1e10 };
  const weekStart = today.index - ((today.weekday + 6) % 7);
  if (d.index < weekStart + 7) return { key: 'w0', label: 'Săptămâna asta', order: 0 };
  if (d.index < weekStart + 14) return { key: 'w1', label: 'Săptămâna viitoare', order: 1 };
  const label = d.year === today.year ? MONTHS_FULL[d.month] : `${MONTHS_FULL[d.month]} ${d.year}`;
  return { key: `m${d.year}-${d.month}`, label, order: 2 + d.year * 12 + d.month };
}
