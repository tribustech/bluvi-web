import type { LakesSearchSuggestion } from '../schemas';

/*
 * fish `features/lakes/helpers/recentLakeSearches.ts` — the pure half. Storage is the UI's (fish
 * AsyncStorage, the web per-browser storage): core owns the key, the parse and the update so both
 * agree (parity lakes.search.c4, lakes.b.recent-searches).
 */

/** fish ASYNC_STORAGE_KEYS.RECENT_LAKE_SEARCHES. */
export const RECENT_LAKE_SEARCHES_KEY = 'recentLakeSearches';

export const MAX_RECENT_LAKE_SEARCHES = 5;

/**
 * Only resolvable place/lake picks are remembered — never the 'nearby' row (it is always shown)
 * nor free-text terms.
 */
export function isPersistableLakeSearch(value: unknown): value is LakesSearchSuggestion {
  if (!value || typeof value !== 'object') return false;
  const s = value as Partial<LakesSearchSuggestion>;
  return typeof s.id === 'string' && typeof s.title === 'string' && (s.type === 'county' || s.type === 'city' || s.type === 'lake');
}

/** A stored list (JSON array) → the valid picks, newest first, at most 5. */
export function parseRecentLakeSearches(value: string | null | undefined): LakesSearchSuggestion[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isPersistableLakeSearch).slice(0, MAX_RECENT_LAKE_SEARCHES);
  } catch {
    return [];
  }
}

/** The list after picking `suggestion`: moved to the front, deduped by id, capped at 5. Unpersistable picks change nothing. */
export function pushRecentLakeSearch(current: LakesSearchSuggestion[], suggestion: LakesSearchSuggestion): LakesSearchSuggestion[] {
  if (!isPersistableLakeSearch(suggestion)) return current;
  return [suggestion, ...current.filter((item) => item.id !== suggestion.id)].slice(0, MAX_RECENT_LAKE_SEARCHES);
}
