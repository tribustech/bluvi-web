/*
 * Calendar maths for the tab views, in Bucharest — pure (no React, no Next); Viitoare's groups are
 * ../upcoming/buckets.ts (unit-tested there).
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

