import { infiniteQueryOptions, nextPageParam, queryOptions } from '../shared';
import type { Transport } from '../transport';
import {
  getAnglerCatches,
  getAnglerCompetitions,
  getAnglerFollowers,
  getAnglerFollowing,
  getAnglerProfile,
  getAnglerSessions,
  getNotificationsForLoggedUser,
  getPaginatedUsers,
  getProfile,
  getStatistics,
  getSuggestedAnglers,
  getSuggestedHome,
  getUnreadNotificationsForLoggedInUser,
  getUserReputation,
  searchAnglers,
} from './api';
import type { CompetitionsHistoryFilter } from './schemas';

/*
 * fish gates most of these hooks on `useSession().isAuthenticated` (via `skipToken`). core has no
 * session, so the factories take `isAuthenticated` (default true: a server prefetch only runs for a
 * signed-in request) and turn it into `enabled`.
 */
type AuthGate = { isAuthenticated?: boolean };

/** fish `queryKeys.anglers` */
export const anglersKeys = {
  all: ['anglers'] as const,
  profile: (documentId: string) => ['anglers', documentId] as const,
  followers: (documentId: string) => ['anglers', documentId, 'followers'] as const,
  following: (documentId: string) => ['anglers', documentId, 'following'] as const,
  sessions: (documentId: string) => ['anglers', documentId, 'sessions'] as const,
  catches: (documentId: string) => ['anglers', documentId, 'catches'] as const,
  competitions: (documentId: string, filter?: string, year?: number) =>
    ['anglers', documentId, 'competitions', filter ?? 'all', year ?? 'all'] as const,
  search: (q: string) => ['anglers', 'search', q] as const,
  suggested: ['anglers', 'suggested'] as const,
  suggestedHome: ['anglers', 'suggested-home'] as const,
};

/** fish `queryKeys.profile` (the social part; statute/batch keys belong to competitions). */
export const profileKeys = {
  my: ['my-profile'] as const,
  statistics: ['profile-statistics'] as const,
};

/** fish `queryKeys.users` */
export const usersKeys = {
  all: ['users'] as const,
  paginated: ['users', 'paginated'] as const,
  paginatedWithParams: (search: string, page: number, pageSize: number) =>
    ['users', 'paginated', search, page, pageSize] as const,
};

/** fish `queryKeys.notifications` (the inbox part; preferences keys belong to competitions). */
export const notificationsKeys = {
  all: ['notifications'] as const,
  allForLoggedUser: ['notifications', 'all', 'for-logged-user'] as const,
  unread: ['notifications', 'unread'] as const,
};

/** fish `queryKeys.reputation` */
export const reputationKeys = {
  all: ['reputation'] as const,
  byUser: (id: string) => ['reputation', id] as const,
};

/** Roots owned by booking / lakes that an angler review invalidates (social imports neither). */
export const socialForeignKeys = {
  bookingsAll: ['bookings'] as const,
  operatorStatsAll: ['operator-stats'] as const,
};

/** Runtime-free twin of TanStack's `keepPreviousData` (identity on the previous data). */
const keepPreviousData = <T>(previousData: T | undefined) => previousData;

// ── useAnglerConnections ────────────────────────────────────────────────────────────────────────────

function connectionsInfiniteQuery(
  t: Transport,
  documentId: string | undefined,
  kind: 'followers' | 'following',
  { isAuthenticated = true, pageSize = 20 }: AuthGate & { pageSize?: number }
) {
  const fetcher = kind === 'followers' ? getAnglerFollowers : getAnglerFollowing;
  return infiniteQueryOptions({
    queryKey: documentId ? anglersKeys[kind](documentId) : (['anglers', 'none', kind] as const),
    queryFn: ({ pageParam }) => fetcher(t, documentId!, { page: pageParam, pageSize }),
    enabled: isAuthenticated && !!documentId,
    initialPageParam: 1,
    getNextPageParam: last => nextPageParam(last.meta),
  });
}

/** fish `useAnglerFollowers` */
export function anglerFollowersInfiniteQuery(t: Transport, documentId: string | undefined, opts: AuthGate & { pageSize?: number } = {}) {
  return connectionsInfiniteQuery(t, documentId, 'followers', opts);
}

/** fish `useAnglerFollowing` */
export function anglerFollowingInfiniteQuery(t: Transport, documentId: string | undefined, opts: AuthGate & { pageSize?: number } = {}) {
  return connectionsInfiniteQuery(t, documentId, 'following', opts);
}

// ── useAnglerDiscovery ──────────────────────────────────────────────────────────────────────────────

/** fish `useAnglerSearchInfinite` — min 2 chars, enforced client AND server side. */
export function anglerSearchInfiniteQuery(
  t: Transport,
  q: string,
  { isAuthenticated = true, pageSize = 20 }: AuthGate & { pageSize?: number } = {}
) {
  const trimmed = q.trim();
  return infiniteQueryOptions({
    queryKey: anglersKeys.search(trimmed),
    queryFn: ({ pageParam }) => searchAnglers(t, trimmed, { page: pageParam, pageSize }),
    enabled: isAuthenticated && trimmed.length >= 2,
    initialPageParam: 1,
    getNextPageParam: last => nextPageParam(last.meta),
  });
}

/**
 * fish `useSuggestedAnglersInfinite`. `friendsOfFollows` (page 1 only) is a weighted-random sample
 * the server rotates per request — it must stay STABLE for a visit, so no focus refetch and a
 * 5-minute `staleTime`: only an explicit refresh reshuffles it.
 */
export function suggestedAnglersInfiniteQuery(
  t: Transport,
  { isAuthenticated = true, pageSize = 20 }: AuthGate & { pageSize?: number } = {}
) {
  return infiniteQueryOptions({
    queryKey: anglersKeys.suggested,
    queryFn: ({ pageParam }) => getSuggestedAnglers(t, { page: pageParam, pageSize }),
    enabled: isAuthenticated,
    initialPageParam: 1,
    getNextPageParam: last => nextPageParam(last.recentlyActive.meta),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}

// ── useAnglerHistory ────────────────────────────────────────────────────────────────────────────────

/** fish `useAnglerSessions` */
export function anglerSessionsInfiniteQuery(
  t: Transport,
  documentId: string | undefined,
  { isAuthenticated = true, pageSize = 10 }: AuthGate & { pageSize?: number } = {}
) {
  return infiniteQueryOptions({
    queryKey: documentId ? anglersKeys.sessions(documentId) : (['anglers', 'none', 'sessions'] as const),
    queryFn: ({ pageParam }) => getAnglerSessions(t, documentId!, { page: pageParam, pageSize }),
    enabled: isAuthenticated && !!documentId,
    initialPageParam: 1,
    getNextPageParam: last => nextPageParam(last.meta),
  });
}

/**
 * fish `useAnglerCatches`. Cursor-paginated: `pageParam` is the opaque cursor, `null` for the first
 * page. `nextCursor` is null on the last page and `undefined` is what ends the list.
 */
export function anglerCatchesInfiniteQuery(
  t: Transport,
  documentId: string | undefined,
  { isAuthenticated = true, pageSize = 20 }: AuthGate & { pageSize?: number } = {}
) {
  return infiniteQueryOptions({
    queryKey: documentId ? anglersKeys.catches(documentId) : (['anglers', 'none', 'catches'] as const),
    queryFn: ({ pageParam }) => getAnglerCatches(t, documentId!, { cursor: pageParam, pageSize }),
    enabled: isAuthenticated && !!documentId,
    initialPageParam: null as string | null,
    getNextPageParam: last => last.meta.nextCursor ?? undefined,
  });
}

/** fish `useAnglerCompetitions` */
export function anglerCompetitionsInfiniteQuery(
  t: Transport,
  documentId: string | undefined,
  { filter, year }: { filter?: CompetitionsHistoryFilter; year?: number } = {},
  { isAuthenticated = true, pageSize = 20 }: AuthGate & { pageSize?: number } = {}
) {
  return infiniteQueryOptions({
    queryKey: documentId
      ? anglersKeys.competitions(documentId, filter, year)
      : (['anglers', 'none', 'competitions'] as readonly unknown[]),
    queryFn: ({ pageParam }) => getAnglerCompetitions(t, documentId!, { page: pageParam, pageSize, filter, year }),
    enabled: isAuthenticated && !!documentId,
    initialPageParam: 1,
    getNextPageParam: last => nextPageParam(last.meta),
    placeholderData: keepPreviousData,
  });
}

// ── useAnglerProfile ────────────────────────────────────────────────────────────────────────────────

/** fish `useAnglerProfile` */
export function anglerProfileQuery(t: Transport, documentId: string | undefined, { isAuthenticated = true }: AuthGate = {}) {
  return queryOptions({
    queryKey: documentId ? anglersKeys.profile(documentId) : (['anglers', 'none'] as const),
    queryFn: () => getAnglerProfile(t, documentId!),
    enabled: isAuthenticated && !!documentId,
  });
}

// ── useSuggestedAnglersHome ─────────────────────────────────────────────────────────────────────────

export const SUGGESTED_HOME_PAGE_SIZE = 10;

/**
 * Cache policy for the Home suggestions rail (spec 2026-09-04): one request per app launch. The
 * server rotates the pool per fetch, so refetching on focus/reconnect/refresh would cost a scoring
 * query AND reshuffle cards under the user's thumb. The ONLY thing that marks it stale is a
 * follow/unfollow (`followAnglerMutation`, `refetchType: 'none'`). `refetchOnMount: false` because
 * v5 treats an invalidated query as stale regardless of `staleTime`. `retry: false`: the realistic
 * failure is a 403 before the role grant lands, which must not be retried.
 */
export const suggestedHomeQueryOptions = {
  staleTime: 6 * 60 * 60_000,
  gcTime: 24 * 60 * 60_000,
  refetchOnWindowFocus: false as const,
  refetchOnReconnect: false as const,
  refetchOnMount: false as const,
  retry: false as const,
};

/** fish `useSuggestedAnglersHome` */
export function suggestedAnglersHomeInfiniteQuery(t: Transport, { isAuthenticated = true }: AuthGate = {}) {
  return infiniteQueryOptions({
    queryKey: anglersKeys.suggestedHome,
    queryFn: ({ pageParam }) => getSuggestedHome(t, { page: pageParam, pageSize: SUGGESTED_HOME_PAGE_SIZE }),
    enabled: isAuthenticated,
    initialPageParam: 1,
    getNextPageParam: last => nextPageParam(last.meta),
    ...suggestedHomeQueryOptions,
  });
}

// ── useProfile / useProfileStatistics ───────────────────────────────────────────────────────────────

const DAY_MS = 1000 * 60 * 60 * 24;

/** fish `useProfile`. fish also hands the profile to `Sentry.setUser` — an app concern, not ported. */
export function profileQuery(t: Transport, { isAuthenticated = true }: AuthGate = {}) {
  return queryOptions({
    queryKey: profileKeys.my,
    // `enabled` so invalidate/refetch treat the query as inactive while signed out.
    enabled: isAuthenticated,
    queryFn: () => getProfile(t),
    staleTime: DAY_MS,
    gcTime: DAY_MS,
  });
}

/** fish `useProfileStatistics` */
export function profileStatisticsQuery(t: Transport, { isAuthenticated = true }: AuthGate = {}) {
  return queryOptions({
    queryKey: profileKeys.statistics,
    queryFn: () => getStatistics(t),
    enabled: isAuthenticated,
    retry: 1,
  });
}

// ── useUserReputation ───────────────────────────────────────────────────────────────────────────────

/** fish `useUserReputation` — public; not gated on the session. */
export function userReputationQuery(t: Transport, userId?: string) {
  return queryOptions({
    queryKey: reputationKeys.byUser(userId ?? ''),
    queryFn: () => getUserReputation(t, userId!),
    enabled: !!userId,
  });
}

// ── useUsers ────────────────────────────────────────────────────────────────────────────────────────

/** fish `usePaginatedUsers` */
export function paginatedUsersInfiniteQuery(
  t: Transport,
  { page = 1, pageSize = 20, search = '' }: { page?: number; pageSize?: number; search?: string } = {}
) {
  return infiniteQueryOptions({
    queryKey: usersKeys.paginatedWithParams(search, page, pageSize),
    queryFn: ({ pageParam }) => getPaginatedUsers(t, { page: pageParam, pageSize, search }),
    initialPageParam: 1,
    getNextPageParam: last => nextPageParam(last?.meta),
  });
}

// ── notifications ───────────────────────────────────────────────────────────────────────────────────

/** fish `useNotificationsForLoggedUser` */
export function notificationsForLoggedUserInfiniteQuery(
  t: Transport,
  { isAuthenticated = true, pageSize = 20 }: AuthGate & { pageSize?: number } = {}
) {
  return infiniteQueryOptions({
    queryKey: notificationsKeys.allForLoggedUser,
    queryFn: ({ pageParam }) => getNotificationsForLoggedUser(t, { page: pageParam, pageSize }),
    enabled: isAuthenticated,
    initialPageParam: 1,
    getNextPageParam: last => nextPageParam(last.meta),
  });
}

/** fish `useUnreadNotificationsCount` — `select`s the number; fresh until a mutation invalidates it. */
export function unreadNotificationsCountQuery(t: Transport, { isAuthenticated = true }: AuthGate = {}) {
  return queryOptions({
    queryKey: notificationsKeys.unread,
    queryFn: () => getUnreadNotificationsForLoggedInUser(t),
    enabled: isAuthenticated,
    select: (data: { count: number }) => data.count,
    staleTime: Infinity,
  });
}
