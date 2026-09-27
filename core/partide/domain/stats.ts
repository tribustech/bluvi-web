// Ported from fish `features/partide/helpers/stats.ts` (pure).
// Pure aggregation helpers for the session logger (per-trip + lake-wide).
// See design §8. Unit-tested in helpers/__tests__/stats.test.ts.
import type { LocalEvent } from './types';
import type { PatternLeaderboardRow, SessionEvent } from './types';

/** Per-rod session tally surfaced in a rod card's stat strip. */
export type RodStats = { captures: number; bites: number; bestKg: number | null };
export const EMPTY_ROD_STATS: RodStats = { captures: 0, bites: 0, bestKg: null };

/**
 * Per-rod tally over a session's events: `captures` (landed), `bites`
 * (captures + escapes — a fish was there; blanks don't count), and `bestKg`
 * (biggest landed fish on that rod). Only events attributed to `rodIndex` count.
 */
export function computeRodStats(events: LocalEvent[], rodIndex: number): RodStats {
  const s: RodStats = { captures: 0, bites: 0, bestKg: null };
  for (const e of events) {
    if (e.rodIndex !== rodIndex) continue;
    if (e.outcome === 'capture') {
      s.captures += 1;
      s.bites += 1;
      if (e.weightKg != null) s.bestKg = Math.max(s.bestKg ?? 0, e.weightKg);
    } else if (e.outcome === 'lost') {
      s.bites += 1;
    }
  }
  return s;
}

/** A "bite" = capture + lost (a fish was there). Blank is denominator-only. */
export const isBite = (e: SessionEvent) => e.outcome === 'capture' || e.outcome === 'lost';

/** Round a distance (m) to its band, e.g. 63 → "60–65 m" (5 m bands by default). */
export const distanceBand = (distance: number, size = 5): string => {
  const lo = Math.floor(distance / size) * size;
  return `${lo}–${lo + size} m`;
};

/**
 * Leaderboard of bait × distance-band over captures, ranked by count then max
 * weight. Free-text baits group by their string; empty → "Altele".
 */
export function computeLeaderboard(events: SessionEvent[]): PatternLeaderboardRow[] {
  const groups = new Map<string, { bait: string; distanceBand: string; count: number; weights: number[] }>();
  for (const e of events) {
    if (e.outcome !== 'capture') continue;
    const bait = (e.bait || '').trim() || 'Altele';
    const band = distanceBand(e.distance);
    const key = `${bait}__${band}`;
    const g = groups.get(key) ?? { bait, distanceBand: band, count: 0, weights: [] };
    g.count += 1;
    // Weight is optional on a capture — an unweighed fish still counts, but it
    // must not enter the average as a zero.
    if (e.weightKg != null) g.weights.push(e.weightKg);
    groups.set(key, g);
  }
  return Array.from(groups.values())
    .map(g => ({
      bait: g.bait,
      distanceBand: g.distanceBand,
      count: g.count,
      avg: g.weights.length ? g.weights.reduce((a, b) => a + b, 0) / g.weights.length : 0,
      max: g.weights.length ? Math.max(...g.weights) : 0,
    }))
    .sort((a, b) => b.count - a.count || b.max - a.max);
}

/** 24-length array of bite counts (capture+lost) bucketed by hour-of-day. */
export function computeHourHeatmap(events: SessionEvent[]): number[] {
  const hours = new Array<number>(24).fill(0);
  for (const e of events) {
    if (!isBite(e)) continue;
    const h = new Date(e.occurredAt).getHours();
    if (h >= 0 && h < 24) hours[h] += 1;
  }
  return hours;
}

/** Heat level 0–4 for a value given the column max (for the heatmap ramp). */
export const heatLevel = (value: number, max: number): 0 | 1 | 2 | 3 | 4 => {
  if (value <= 0 || max <= 0) return 0;
  const r = value / max;
  if (r <= 0.25) return 1;
  if (r <= 0.5) return 2;
  if (r <= 0.75) return 3;
  return 4;
};
