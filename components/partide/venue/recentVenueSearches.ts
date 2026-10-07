/*
 * fish features/partide/components/community/recentVenueSearches.ts — the venues picked in the
 * «Filtrează după baltă» picker (Explorează; partide.exploreaza c18, c20), per browser. Its own key,
 * separate from the Bălți and Concursuri recents: it holds only committable community venue keys
 * («lake:<documentId>» / «water:<linkCode>»), so a shared store would surface entries this picker
 * cannot apply and leak partide picks elsewhere.
 *
 * The list logic is pure (parse / push, unit-tested in tests/unit/recent-venue-searches.test.ts);
 * the storage calls are guarded — storage can be missing or throw (private mode, blocked site data)
 * and the picker then simply has no recents.
 */

export const RECENT_VENUE_SEARCHES_KEY = 'bluvi.partide.recentVenueSearches';
export const MAX_RECENT_VENUE_SEARCHES = 5;

/** A remembered pick: the venue key (enough to re-apply the filter), its name, the row subtitle and the lake thumbnail. */
export interface RecentVenuePick {
  key: string;
  name: string;
  helper: string | null;
  imageUrl: string | null;
}

/** fish isPersistablePick: a well-formed entry with a non-empty id / code after its prefix. */
export function isPersistablePick(value: unknown): value is RecentVenuePick {
  if (!value || typeof value !== 'object') return false;
  const pick = value as Partial<RecentVenuePick>;
  if (typeof pick.key !== 'string' || typeof pick.name !== 'string' || pick.name.length === 0) return false;
  if (pick.helper !== null && typeof pick.helper !== 'string') return false;
  if (pick.imageUrl !== null && typeof pick.imageUrl !== 'string') return false;
  const prefix = ['lake:', 'water:'].find(p => (pick.key as string).startsWith(p));
  return !!prefix && pick.key.length > prefix.length;
}

/** The stored JSON → the valid entries, newest first, at most 5 (invalid entries ignored, c20). */
export function parseRecentVenueSearches(raw: string | null | undefined): RecentVenuePick[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isPersistablePick).slice(0, MAX_RECENT_VENUE_SEARCHES);
  } catch {
    return [];
  }
}

/** fish pushRecentVenueSearch: the pick first, an older entry for the same venue dropped, 5 at most. */
export function pushRecentVenuePick(current: RecentVenuePick[], pick: RecentVenuePick): RecentVenuePick[] {
  if (!isPersistablePick(pick)) return current;
  return [pick, ...current.filter(p => p.key !== pick.key)].slice(0, MAX_RECENT_VENUE_SEARCHES);
}

export function readRecentVenueSearches(): RecentVenuePick[] {
  try {
    return parseRecentVenueSearches(window.localStorage.getItem(RECENT_VENUE_SEARCHES_KEY));
  } catch {
    return [];
  }
}

export function saveRecentVenueSearch(pick: RecentVenuePick): RecentVenuePick[] {
  const next = pushRecentVenuePick(readRecentVenueSearches(), pick);
  try {
    window.localStorage.setItem(RECENT_VENUE_SEARCHES_KEY, JSON.stringify(next));
  } catch {
    // Not stored: the picker just starts without it next time.
  }
  return next;
}

export function clearRecentVenueSearches() {
  try {
    window.localStorage.removeItem(RECENT_VENUE_SEARCHES_KEY);
  } catch {
    // Nothing stored to clear.
  }
}
