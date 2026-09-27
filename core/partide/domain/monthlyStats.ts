// Ported from fish `features/partide/helpers/monthlyStats.ts` (pure).
// Powers the "Statistici" section on the Ale mele scene (design 6a): a
// 7-month capture bar chart, best-catch tile, and hours-fished tile.
import type { LocalSession } from './types';
import { aggForSession, sessionVenueName, type Aggregate } from './historyView';

export const MONTH_LABELS_RO = ['IAN', 'FEB', 'MAR', 'APR', 'MAI', 'IUN', 'IUL', 'AUG', 'SEP', 'OCT', 'NOI', 'DEC'];

export type MonthlyStats = {
  months: { label: string; count: number }[];
  // NOTE: `Aggregate` (features/partide/helpers/historyView.ts) carries no species
  // field, so `species` is always null here — the tile falls back to venue-only,
  // per the design's "Crap · Vidraru" line degrading gracefully to "Vidraru".
  bestCatch: { weightKg: number; species: string | null; venueName: string } | null;
  totalHours: number;
  avgHoursPerPartida: number | null;
};

const HOUR_MS = 3_600_000;

/**
 * Last 7 calendar months ending with `now`'s month (oldest first), capture
 * counts + best catch + fished hours over `sessions`. Uses `aggForSession` so
 * both fully-hydrated and summary-only (list-DTO) rows contribute correctly —
 * `usePartideHistory` ships history rows as summary-only with an empty
 * `aggregates` map, so reading `aggregates[clientId]` directly would silently
 * zero everything out in production.
 */
export function monthlyStats(
  sessions: LocalSession[],
  aggregates: Record<string, Aggregate>,
  now: Date
): MonthlyStats {
  const buckets: { year: number; month: number; label: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({ year: d.getFullYear(), month: d.getMonth(), label: MONTH_LABELS_RO[d.getMonth()], count: 0 });
  }
  const bucketIndex = new Map<string, number>();
  buckets.forEach((b, i) => bucketIndex.set(`${b.year}-${b.month}`, i));

  let bestCatch: { weightKg: number; species: string | null; venueName: string } | null = null;
  let totalHours = 0;
  let endedCount = 0;

  for (const s of sessions) {
    const agg = aggForSession(s, aggregates);
    const d = new Date(s.startedAt);
    const idx = bucketIndex.get(`${d.getFullYear()}-${d.getMonth()}`);
    if (idx !== undefined) buckets[idx].count += agg.captures;

    if (agg.recordKg != null && (bestCatch == null || agg.recordKg > bestCatch.weightKg)) {
      bestCatch = { weightKg: agg.recordKg, species: null, venueName: sessionVenueName(s) };
    }

    if (s.endedAt != null) {
      totalHours += (s.endedAt - s.startedAt) / HOUR_MS;
      endedCount += 1;
    }
  }

  return {
    months: buckets.map(({ label, count }) => ({ label, count })),
    bestCatch,
    totalHours,
    avgHoursPerPartida: endedCount > 0 ? totalHours / endedCount : null,
  };
}
