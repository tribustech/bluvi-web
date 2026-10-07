import { infiniteQueryOptions, nextPageParam, queryOptions } from '../shared';
import type { Transport } from '../transport';
import {
  fetchAllFollowingUids,
  getAllMySessions,
  getCommunityActive,
  getCommunityHistory,
  getCommunityOverview,
  getCommunitySession,
  getCommunityStats,
  getCommunityVenueCatches,
  getCommunityVenueSection,
  getMyCatches,
  getMySessionFollows,
  getSession,
  getSessionCatches,
} from './api';
import { communityVenueKey, venueSelectionKey, type CommunityVenueRef } from './domain/venueKeys';
import type { CommunitySessionDetailDTO, StatsPeriod } from './schemas';

/** fish `queryKeys.partide` */
export const partideKeys = {
  mine: ['partide', 'mine'] as const,
  /** My own catch gallery — /feed/sessions/mine/catches. Distinct from `anglers.catches(me)`:
   *  that one is the PUBLIC profile grid and hides partide taken off the profile. */
  myCatches: ['partide', 'mine', 'catches'] as const,
  detail: (documentId: string) => ['partide', 'detail', documentId] as const,
  markers: (venueKey: string) => ['partide', 'markers', venueKey] as const,
};

/** fish `queryKeys.community` (+ the inline session-catches key of `useSessionCatchesInfinite`). */
export const communityKeys = {
  all: ['community'] as const,
  overview: ['community', 'overview'] as const,
  // `venueSelection` = 'all' for none, else the sorted keys joined with '|' (`venueSelectionKey`).
  active: (venueSelection: string) => ['community', 'active', venueSelection] as const,
  history: (venueSelection: string) => ['community', 'history', venueSelection] as const,
  venueSection: (venueKey: string) => ['community', 'venue', venueKey] as const,
  venueCatches: (venueKey: string) => ['community', 'venue', venueKey, 'catches'] as const,
  session: (documentId: string) => ['community', 'session', documentId] as const,
  sessionCatches: (documentId: string, photosOnly?: boolean) =>
    ['community', 'session', documentId, 'catches', photosOnly ? 'photos' : 'all'] as const,
  // '' for the community-wide screen, `lake:<id>` / `water:<code>` for a venue page.
  stats: (period: string, venueKey = '') => ['community', 'stats', period, venueKey] as const,
  sessionFollows: ['community', 'session-follows'] as const,
  followedAnglerUids: (documentId: string) => ['community', 'followed-angler-uids', documentId] as const,
};

// Matches the CMS default so both community feeds page identically.
const HISTORY_PAGE_SIZE = 10;
const LIVE_PAGE_SIZE = 10;
export const VENUE_CATCHES_PAGE_SIZE = 20;

/** TanStack's `keepPreviousData` is a runtime export of react-query; this is the same identity. */
const keepPreviousData = <T>(previousData: T | undefined): T | undefined => previousData;

// ── my partide ──────────────────────────────────────────────────────────────

/**
 * fish `usePartideHistory` (query part). Behind a tab, pass `enabled: <that tab is open>`; it is
 * also gated on auth in fish (`isAuthenticated && enabled`). Re-entering within 5 min reuses the
 * cached list; pull-to-refresh invalidates `partideKeys.mine`. Derived lists:
 * `domain/historySelectors.ts#selectPartideHistory`.
 */
export function partideHistoryQuery(t: Transport, { enabled = true }: { enabled?: boolean } = {}) {
  return queryOptions({
    queryKey: partideKeys.mine,
    queryFn: () => getAllMySessions(t),
    enabled,
    staleTime: 5 * 60_000,
  });
}

/**
 * fish `usePartidaDetail` (history branch). fish keyed it `detail(documentId ?? clientId)` and
 * enabled it only when the session is neither the live one nor a live snapshot and a documentId
 * is known — pass that as `enabled`. View derivation: `historySelectors.ts#historyDetailView`.
 */
export function partidaDetailQuery(t: Transport, documentId: string, { enabled = true }: { enabled?: boolean } = {}) {
  return queryOptions({
    queryKey: partideKeys.detail(documentId),
    queryFn: () => getSession(t, documentId),
    enabled: enabled && !!documentId,
  });
}

/** fish `services/queries/useMyCatches` — gated on auth by the caller (`enabled`). */
export function myCatchesInfiniteQuery(t: Transport, pageSize = 20, { enabled = true }: { enabled?: boolean } = {}) {
  return infiniteQueryOptions({
    queryKey: partideKeys.myCatches,
    queryFn: ({ pageParam }) => getMyCatches(t, { cursor: pageParam, pageSize }),
    // `nextCursor` is null on the last page; `undefined` tells React Query there is nothing more.
    getNextPageParam: lastPage => lastPage.meta.nextCursor ?? undefined,
    initialPageParam: null as string | null,
    enabled,
  });
}

// ── community (public) ──────────────────────────────────────────────────────

/** fish `useCommunityOverview` */
export function communityOverviewQuery(t: Transport, enabled = true) {
  return queryOptions({
    queryKey: communityKeys.overview,
    queryFn: () => getCommunityOverview(t),
    enabled,
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: false,
  });
}

/**
 * fish `useCommunityActiveInfinite` — the ÎN DIRECT feed. Deliberately NO `refetchInterval`: an
 * infinite query's interval refetch re-fetches EVERY loaded page. Freshness comes from staleTime
 * and pull-to-refresh (which invalidates `communityKeys.all`).
 */
export function communityActiveInfiniteQuery(t: Transport, venueKeys: string[], enabled = true) {
  return infiniteQueryOptions({
    queryKey: communityKeys.active(venueSelectionKey(venueKeys)),
    queryFn: ({ pageParam }) => getCommunityActive(t, { cursor: pageParam, pageSize: LIVE_PAGE_SIZE, venues: venueKeys }),
    // Optional-chained: a pre-cursor edge-cached body must read as "no further page", not throw.
    getNextPageParam: lastPage => lastPage?.meta?.nextCursor ?? undefined,
    initialPageParam: null as string | null,
    enabled,
    staleTime: 30_000,
    retry: false,
  });
}

/** fish `useCommunityVenueSection` */
export function communityVenueSectionQuery(t: Transport, venue: CommunityVenueRef | null) {
  return queryOptions({
    queryKey: communityKeys.venueSection(venue ? communityVenueKey(venue) : 'none'),
    queryFn: () => getCommunityVenueSection(t, venue!),
    enabled: !!venue,
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: false,
  });
}

/** fish `useCommunityVenueCatchesInfinite` — paginated photo catches for a lake or public water. */
export function communityVenueCatchesInfiniteQuery(t: Transport, venue: CommunityVenueRef | null) {
  return infiniteQueryOptions({
    queryKey: communityKeys.venueCatches(venue ? communityVenueKey(venue) : 'none'),
    queryFn: ({ pageParam }) => getCommunityVenueCatches(t, venue!, { page: pageParam, pageSize: VENUE_CATCHES_PAGE_SIZE }),
    getNextPageParam: lastPage => nextPageParam(lastPage.meta),
    initialPageParam: 1,
    enabled: !!venue,
    staleTime: 60_000,
    retry: false,
  });
}

/**
 * fish `useCommunityStats` — one fetch per period tab, cached per period. A venue page sits next to
 * a 60s-polled live section, hence the shorter staleTime there. `placeholderData` keeps the chips
 * on screen while a new period loads.
 */
export function communityStatsQuery(t: Transport, period: StatsPeriod, venue?: CommunityVenueRef | null) {
  const venueKey = venue ? communityVenueKey(venue) : '';
  return queryOptions({
    queryKey: communityKeys.stats(period, venueKey),
    queryFn: () => getCommunityStats(t, period, venue),
    staleTime: venueKey ? 60_000 : 120_000,
    retry: false,
    placeholderData: keepPreviousData,
  });
}

/**
 * fish `useCommunitySession` — the live session-detail read (the Firestore projection is only a
 * latency optimization; spectators stay off Firestore). Polls every 60s while the session is
 * live, stops once it has ended (an archived detail is immutable).
 */
export function communitySessionQuery(t: Transport, documentId: string) {
  return queryOptions({
    queryKey: communityKeys.session(documentId),
    queryFn: () => getCommunitySession(t, documentId),
    enabled: !!documentId,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: (query: { state: { data?: CommunitySessionDetailDTO } }) =>
      query.state.data && query.state.data.endedAt == null ? 60_000 : false,
    retry: false,
  });
}

/**
 * fish `useSessionCatchesInfinite` — the full catch list behind "Vezi toate". `photosOnly` is in
 * the key so the plain list and the photo gallery cache independently.
 */
export function sessionCatchesInfiniteQuery(
  t: Transport,
  documentId: string,
  opts: { photosOnly?: boolean; pageSize?: number } = {}
) {
  return infiniteQueryOptions({
    queryKey: communityKeys.sessionCatches(documentId, opts.photosOnly),
    queryFn: ({ pageParam }) => getSessionCatches(t, documentId, { cursor: pageParam, ...opts }),
    initialPageParam: null as string | null,
    getNextPageParam: last => last.meta.nextCursor ?? undefined,
    enabled: !!documentId,
    retry: false,
  });
}

/** fish `useCommunityHistoryInfinite` — ÎNCHEIATE and the Acasă no-live fallback. */
export function communityHistoryInfiniteQuery(t: Transport, venueKeys: string[], enabled = true) {
  return infiniteQueryOptions({
    queryKey: communityKeys.history(venueSelectionKey(venueKeys)),
    queryFn: ({ pageParam }) => getCommunityHistory(t, { page: pageParam, pageSize: HISTORY_PAGE_SIZE, venues: venueKeys }),
    getNextPageParam: lastPage => nextPageParam(lastPage.meta),
    initialPageParam: 1,
    enabled,
    staleTime: 120_000,
    retry: false,
  });
}

// ── session follows / following set (per-user) ──────────────────────────────

/**
 * fish `useSessionFollows` (query part). Gated on auth: the route 401s for a guest, so a guest must
 * never fire it — pass `isAuthenticated`. Mutations: `followSessionMutation`/`unfollowSessionMutation`.
 */
export function sessionFollowsQuery(t: Transport, isAuthenticated: boolean) {
  return queryOptions({
    queryKey: communityKeys.sessionFollows,
    queryFn: () => getMySessionFollows(t),
    enabled: isAuthenticated,
    staleTime: 30_000,
    retry: false,
  });
}

/** fish `useFollowedAnglerUids` — the current user's following list as a `Set<uid>`. */
export function followedAnglerUidsQuery(t: Transport, myDocumentId: string | null) {
  return queryOptions({
    queryKey: communityKeys.followedAnglerUids(myDocumentId ?? 'none'),
    queryFn: () => fetchAllFollowingUids(t, myDocumentId!),
    enabled: !!myDocumentId,
    staleTime: 30_000,
  });
}
