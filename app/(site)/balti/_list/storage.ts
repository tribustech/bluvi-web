'use client';

import {
  parseRecentLakeSearches,
  parseRecentViewedLakeIds,
  pushRecentLakeSearch,
  RECENT_LAKE_SEARCHES_KEY,
  RECENT_VIEWED_LAKE_IDS_KEY,
  suggestionToCommittedSearch,
  type LakesSearchSuggestion,
} from '@/core/lakes';
import { useSyncExternalStore } from 'react';

/*
 * Per-browser lists (fish AsyncStorage): recently viewed lakes (lakes.b.recently-viewed — the lake
 * page pushes, the Bălți home reads) and recent searches (lakes.b.recent-searches). Storage can be
 * missing or throw (private mode, blocked site data): every access is guarded and the page works
 * without it — an empty list.
 */

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Not stored: the list just starts empty next time.
  }
}

/** Newest LAST (fish order); the home reverses it. */
export function readRecentViewedLakeIds(): string[] {
  return parseRecentViewedLakeIds(read(RECENT_VIEWED_LAKE_IDS_KEY));
}

/*
 * Recently viewed as an external store (lakes.home.c22): the server and the hydrating pass read
 * «none yet» (an empty list — never «unknown», so the rows render in the server HTML), the browser
 * then reads storage and re-reads it whenever the tab comes back. The snapshot is cached per raw
 * value, so React gets the same array until storage changes.
 */
const NO_IDS: string[] = [];
let cachedRaw: string | null | undefined;
let cachedIds: string[] = NO_IDS;

function recentViewedSnapshot(): string[] {
  const raw = read(RECENT_VIEWED_LAKE_IDS_KEY);
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedIds = parseRecentViewedLakeIds(raw);
  }
  return cachedIds;
}

function subscribeRecentViewed(onChange: () => void) {
  const onVisible = () => {
    if (document.visibilityState === 'visible') onChange();
  };
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('pageshow', onChange);
  window.addEventListener('storage', onChange);
  return () => {
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('pageshow', onChange);
    window.removeEventListener('storage', onChange);
  };
}

/** The recently viewed lake ids (newest LAST); [] on the server and while hydrating. */
export function useRecentViewedLakeIds(): string[] {
  return useSyncExternalStore(subscribeRecentViewed, recentViewedSnapshot, () => NO_IDS);
}

/**
 * Recent searches. A lake pick saved without its id (fish's old recents, whose fallback is a map
 * focused on the lake) is dropped: the web always saves the id and opens the lake page, and has no
 * lake-focused map (lakes.results-map.c5's lake branch does not apply).
 */
export function readRecentLakeSearches(): LakesSearchSuggestion[] {
  return parseRecentLakeSearches(read(RECENT_LAKE_SEARCHES_KEY)).filter((s) => {
    const search = suggestionToCommittedSearch(s);
    return !(search?.mode === 'lake' && !search.lakeId);
  });
}

export function saveRecentLakeSearch(suggestion: LakesSearchSuggestion): LakesSearchSuggestion[] {
  const next = pushRecentLakeSearch(readRecentLakeSearches(), suggestion);
  write(RECENT_LAKE_SEARCHES_KEY, JSON.stringify(next));
  return next;
}

export function clearRecentLakeSearches() {
  write(RECENT_LAKE_SEARCHES_KEY, null);
}
