import type { SuggestedAnglerStats } from '../schemas';

/** fish `features/anglers/helpers/pickTopStats.ts` */

const formatKg = (kg: number) => `${kg.toFixed(1).replace('.', ',')} kg`;
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

export type TopStat = { value: string; label: string };

/**
 * Up to TWO stats for a suggestion card, by priority: podiums → competitions → record catch (CMMC)
 * → partide. Zeros are skipped; empty means the caller shows "Pescar nou".
 */
export function pickTopStats(stats: SuggestedAnglerStats): TopStat[] {
  const out: TopStat[] = [];
  if (stats.podiums > 0) out.push({ value: String(stats.podiums), label: plural(stats.podiums, 'podium', 'podiumuri') });
  if (stats.competitions > 0)
    out.push({ value: String(stats.competitions), label: plural(stats.competitions, 'concurs', 'concursuri') });
  if (stats.recordKg != null && stats.recordKg > 0) out.push({ value: formatKg(stats.recordKg), label: 'CMMC' });
  if (stats.sessions > 0) out.push({ value: String(stats.sessions), label: plural(stats.sessions, 'partidă', 'partide') });
  return out.slice(0, 2);
}

/** "1.284 urmăritori" / "1 urmăritor" / "fără urmăritori" — always a line, so cards in a rail keep one height. */
export function formatFollowers(n: number): string {
  if (!(n > 0)) return 'fără urmăritori';
  const grouped = String(Math.trunc(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${grouped} ${n === 1 ? 'urmăritor' : 'urmăritori'}`;
}

/**
 * fish `features/anglers/state/dismissedSuggestionsAtom.ts` — the rail hides cards the user X-ed
 * out for the session (in-memory on purpose: a person can resurface next launch). The atom is UI
 * state; this is the pure add + filter it drives.
 */
export function dismissSuggestion(dismissed: ReadonlySet<string>, documentId: string): ReadonlySet<string> {
  const next = new Set(dismissed);
  next.add(documentId);
  return next;
}

export function withoutDismissed<T extends { documentId: string }>(items: T[], dismissed: ReadonlySet<string>): T[] {
  return dismissed.size === 0 ? items : items.filter(i => !dismissed.has(i.documentId));
}
