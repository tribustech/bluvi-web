import type { CompetitionSuggestion } from '../schemas';
import { MAX_RECENT_SEARCHES } from './filters';

/*
 * fish `features/competitions/helpers/recentCompetitionSearches.ts` — the pure half. Storage is the
 * UI's (fish AsyncStorage, the web per-browser storage): core owns the key, the parse and the update
 * so both agree (parity competitions-list.search.c12, c13).
 *
 * Only resolvable picks are stored, never a free-text term — replaying a term would re-run a search
 * whose results may since have changed under the same label, while a lake or an organiser is still
 * the same lake or organiser.
 */

/** fish ASYNC_STORAGE_KEYS.RECENT_COMPETITION_SEARCHES. */
export const RECENT_COMPETITION_SEARCHES_KEY = 'recentCompetitionSearches';

export function isPersistableCompetitionSearch(value: unknown): value is CompetitionSuggestion {
  if (!value || typeof value !== 'object') return false;
  const s = value as Partial<CompetitionSuggestion>;
  return (
    typeof s.id === 'string' &&
    typeof s.value === 'string' &&
    typeof s.title === 'string' &&
    typeof s.subtitle === 'string' &&
    (s.type === 'lake' || s.type === 'organizer' || s.type === 'competition')
  );
}

/** A stored list (JSON array) → the valid picks, newest first, at most 5. Unreadable → []. */
export function parseRecentCompetitionSearches(value: string | null | undefined): CompetitionSuggestion[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isPersistableCompetitionSearch).slice(0, MAX_RECENT_SEARCHES);
  } catch {
    return [];
  }
}

/** The list after picking `suggestion`: moved to the front, deduped by id, capped at 5. Unpersistable picks change nothing. */
export function pushRecentCompetitionSearch(current: CompetitionSuggestion[], suggestion: CompetitionSuggestion): CompetitionSuggestion[] {
  if (!isPersistableCompetitionSearch(suggestion)) return current;
  return [suggestion, ...current.filter((item) => item.id !== suggestion.id)].slice(0, MAX_RECENT_SEARCHES);
}
