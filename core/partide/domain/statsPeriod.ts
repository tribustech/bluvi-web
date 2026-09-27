// Ported from fish `features/partide/helpers/statsPeriod.ts` (pure).
import type { StatsPeriod } from '../schemas';

/** URL `?period=` → `StatsPeriod`, defaulting anything unrecognised (missing,
 * stale, or hand-edited) to `'month'` — the shared default across every
 * screen backed by `useCommunityStats` (community-wide, venue dashboard,
 * stand leaderboard). */
export function parseStatsPeriodParam(raw: string | undefined): StatsPeriod {
  return raw === 'week' || raw === 'year' ? raw : 'month';
}
