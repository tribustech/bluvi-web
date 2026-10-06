'use client';

import {
  parseRecentCompetitionSearches,
  pushRecentCompetitionSearch,
  RECENT_COMPETITION_SEARCHES_KEY,
  type CompetitionSuggestion,
} from '@/core/competitions';

/*
 * Recent competition searches, per browser (fish AsyncStorage — competitions-list.search.c12, c13).
 * Storage can be missing or throw (private mode, blocked site data): every access is guarded and the
 * dialog works without it — an empty list.
 *
 * FISH DISCREPANCY (search.c13, b.recents-bug): fish's search screen never reaches
 * pushRecentCompetitionSearch, so its recents stay empty. The web records the picks as the helper
 * intends — a lake, an organizer and a competition — never free text.
 */

export function readRecentCompetitionSearches(): CompetitionSuggestion[] {
  try {
    return parseRecentCompetitionSearches(window.localStorage.getItem(RECENT_COMPETITION_SEARCHES_KEY));
  } catch {
    return [];
  }
}

export function saveRecentCompetitionSearch(suggestion: CompetitionSuggestion): CompetitionSuggestion[] {
  const next = pushRecentCompetitionSearch(readRecentCompetitionSearches(), suggestion);
  try {
    window.localStorage.setItem(RECENT_COMPETITION_SEARCHES_KEY, JSON.stringify(next));
  } catch {
    // Not stored: the list just starts empty next time.
  }
  return next;
}

export function clearRecentCompetitionSearches() {
  try {
    window.localStorage.removeItem(RECENT_COMPETITION_SEARCHES_KEY);
  } catch {
    // Nothing stored to clear.
  }
}
