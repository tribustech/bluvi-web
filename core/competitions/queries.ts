import type { InfiniteData, QueryClient } from '@tanstack/react-query';
import { infiniteQueryOptions, nextPageParam, queryOptions, type PaginationParams } from '../shared';
import type { Transport } from '../transport';
import {
  SIGNED_OUT_MY_STATUS,
  buildCompetitionCardsQuery,
  getCatchThresholdCounts,
  getCompetition,
  getCompetitionCards,
  getCompetitionCatches,
  getCompetitionMyStatus,
  getCompetitionNotificationPreferences,
  getCompetitionRegistrations,
  getCompetitionsByStatus,
  getCompetitionsList,
  getCompetitionSuggestions,
  getCompetitionTimelineSnapshot,
  getCompetitionWeighingStatistics,
  getCurrentPoll,
  getFeaturedCompetition,
  getFishSpecies,
  getFollowedCompetitions,
  getFollowers,
  getLiveCompetition,
  getMyCompetitions,
  getPastPolls,
  getPulsePerson,
  getRankingBestN,
  getRankings,
  getSponsorById,
  getSponsors,
  getStandStatsByLakeId,
  type CompetitionCardsParams,
  type CompetitionCatchesFilter,
} from './api';
import type {
  CompetitionCardsPage,
  CompetitionCatchesSort,
  CompetitionStatus,
  CompetitionWithMyStatus,
  MyCompetitionsResponse,
  Poll,
  StandStats,
} from './schemas';
import { getUSerStatuteForCompetition, postUserStatisticsBatch } from '../social/api';
import type { ParticipantStats } from '../social/schemas';

/* ------------------------------------------------------------------ */
/* Keys — exact fish `queryKeys.*` shapes                              */
/* ------------------------------------------------------------------ */

/** fish `queryKeys.competition` (singular — live + ranking sub-resources). */
export const competitionKeys = {
  all: ['competition'] as const,
  live: ['competition', 'live'] as const,
  byId: (id: string) => ['competition', id] as const,
  followers: (id: string) => ['competition', id, 'followers'] as const,
  rankingBestN: (competitionId: string) => ['competition', competitionId, 'ranking-best-n'] as const,
  weighingStatistics: (competitionId: string) => ['competition', competitionId, 'weighing-statistics'] as const,
  timelineSnapshot: (competitionId: string) => ['competition', competitionId, 'timeline-snapshot'] as const,
  catchesInfinite: (
    competitionId: string,
    sort: string,
    filter: { sectorName?: string; standKey?: string } | null = null
  ) =>
    [
      'competition',
      competitionId,
      'catches',
      sort,
      filter ? ('sectorName' in filter ? `sector:${filter.sectorName}` : `stand:${filter.standKey}`) : 'all',
    ] as const,
  catchThresholdCounts: (competitionId: string) => ['competition', competitionId, 'catch-threshold-counts'] as const,
};

/**
 * fish `queryKeys.competitionCards` — the redesigned Concursuri tab. Separate root from
 * `competitions` so the two endpoints' caches never collide while both exist.
 */
export const competitionCardsKeys = {
  root: ['competition-cards'] as const,
  list: (signature: string) => ['competition-cards', 'list', signature] as const,
  suggestions: (term: string) => ['competition-cards', 'suggestions', term] as const,
  /** The bento's person tile. One entry: the endpoint takes no parameters. */
  pulsePerson: ['competition-cards', 'pulse-person'] as const,
  /** The bento's hero, when nothing is live. Same for everyone. */
  featured: ['competition-cards', 'featured'] as const,
};

/** fish `queryKeys.competitions` */
export const competitionsKeys = {
  all: ['competitions'] as const,
  my: ['competitions', 'my'] as const,
  byId: (id: string) => ['competitions', id] as const,
  myStatus: (id: string) => ['competitions', id, 'my-status'] as const,
  fishSpecies: (id: string) => ['competitions', 'competitionId', id, 'fish-species'] as const,
  registrationsListById: (id: string) => ['competitions', id, 'registrations'] as const,
  byStatus: (status: CompetitionStatus) => ['competitions', status] as const,
  byStatusAndLake: (status: CompetitionStatus, lakeId: string) => ['competitions', status, lakeId] as const,
};

/** fish `queryKeys.rankings` */
export const rankingsKeys = {
  all: ['rankings'] as const,
  byCompetitionId: (competitionId: string) => ['rankings', competitionId] as const,
};

/** fish `queryKeys.stands` */
export const standsKeys = {
  all: ['stands'] as const,
  statsByLakeId: (id: string) => ['stands', id, 'stats'] as const,
};

/** fish `queryKeys.sponsors` */
export const sponsorsKeys = {
  all: ['sponsors'] as const,
  byId: (id: string) => ['sponsors', id] as const,
};

/** fish `queryKeys.poll` */
export const pollKeys = {
  current: ['poll', 'current'] as const,
  past: ['poll', 'past'] as const,
};

/** The competition-scoped slice of fish `queryKeys.notifications` (the rest belongs to notifications). */
export const competitionNotificationKeys = {
  preferences: (competitionId: string) => ['notifications', 'preferences', competitionId] as const,
  followedCompetitions: ['notifications', 'followed-competitions'] as const,
};

/** The competition-scoped slice of fish `queryKeys.profile` (`my` is social's `profileKeys.my`). */
export const competitionProfileKeys = {
  statuteForCompetition: (competitionId: string) => ['profile-statute', competitionId] as const,
  participantStatisticsBatch: (competitionId: string) =>
    ['profile', 'participant-statistics-batch', competitionId] as const,
};

/** Signed-in state the fish hooks read from `useSession()`; the caller passes it in. */
export type SessionState = { isAuthenticated: boolean };

const FIVE_MINUTES = 5 * 60_000;

/* ------------------------------------------------------------------ */
/* fish services/queries/useCompetitions.ts                           */
/* ------------------------------------------------------------------ */

/** fish `useCompetitions` (legacy list) */
export function competitionsQuery(t: Transport, pagination?: PaginationParams) {
  return queryOptions({
    queryKey: [...competitionsKeys.all, pagination] as const,
    queryFn: () => getCompetitionsList(t, pagination),
  });
}

/** fish `useFilteredCompetitions` */
export function filteredCompetitionsInfiniteQuery(
  t: Transport,
  { status, pagination, lakeId }: { status: CompetitionStatus; pagination?: PaginationParams; lakeId?: string }
) {
  return infiniteQueryOptions({
    queryKey: lakeId
      ? ([...competitionsKeys.byStatusAndLake(status, lakeId), pagination] as const)
      : ([...competitionsKeys.byStatus(status), pagination] as const),
    queryFn: ({ pageParam }) =>
      getCompetitionsByStatus(t, status, { page: pageParam, pageSize: pagination?.pageSize }, lakeId),
    getNextPageParam: last => nextPageParam(last.meta),
    initialPageParam: 1,
  });
}

/* ------------------------------------------------------------------ */
/* fish services/queries/useCompetition.ts                            */
/* ------------------------------------------------------------------ */

/**
 * fish `useCompetitionMyStatus`. A signed-out viewer resolves locally to the signed-out overlay
 * instead of calling `/my-status`, whose 401 used to be the loudest error in production
 * (BLUVI-MOBILE-7).
 */
export function competitionMyStatusQuery(t: Transport, competitionId: string, { isAuthenticated }: SessionState) {
  return queryOptions({
    queryKey: competitionsKeys.myStatus(competitionId),
    queryFn: () => (isAuthenticated ? getCompetitionMyStatus(t, competitionId) : Promise.resolve(SIGNED_OUT_MY_STATUS)),
    enabled: !!competitionId,
    staleTime: FIVE_MINUTES,
  });
}

/**
 * fish `useCompetition`. Fetches the shared core and the per-user overlay and merges them under
 * the `byId` key, so `followCompetitionMutation`'s optimistic write to that key still patches
 * `isFollowing`.
 */
export function competitionQuery(t: Transport, competitionId: string, { isAuthenticated }: SessionState) {
  return queryOptions({
    queryKey: competitionsKeys.byId(competitionId),
    queryFn: async (): Promise<CompetitionWithMyStatus> => {
      const [core, myStatus] = await Promise.all([
        getCompetition(t, competitionId),
        // getCompetitionMyStatus still defaults to SIGNED_OUT_MY_STATUS on a 401,
        // so a token that dies mid-session degrades the same way it always did.
        isAuthenticated ? getCompetitionMyStatus(t, competitionId) : Promise.resolve(SIGNED_OUT_MY_STATUS),
      ]);
      return { ...core, ...myStatus };
    },
    staleTime: FIVE_MINUTES,
  });
}

/** fish `queries/competitions.ts#useCompetitionRegistrationsList` */
export function competitionRegistrationsListQuery(t: Transport, competitionId: string) {
  return queryOptions({
    queryKey: competitionsKeys.registrationsListById(competitionId),
    queryFn: () => getCompetitionRegistrations(t, competitionId),
    enabled: !!competitionId,
    staleTime: FIVE_MINUTES,
  });
}

/** fish `useGetFishTypes` */
export function fishTypesQuery(t: Transport, competitionId: string) {
  return queryOptions({
    queryKey: competitionsKeys.fishSpecies(competitionId),
    queryFn: () => getFishSpecies(t, competitionId),
    enabled: !!competitionId,
  });
}

/** fish `mutations/useCompetitionFollowers` (a query despite its folder) */
export function competitionFollowersQuery(t: Transport, competitionId: string) {
  return queryOptions({
    queryKey: competitionKeys.followers(competitionId),
    queryFn: () => getFollowers(t, competitionId),
    enabled: !!competitionId,
    staleTime: 30_000,
  });
}

/* ------------------------------------------------------------------ */
/* fish services/queries/useCompetitionCards.ts                       */
/* ------------------------------------------------------------------ */

export const COMPETITION_CARDS_PAGE_SIZE = 20;

/**
 * The one cache knob a CALLER gets to turn. Polling is a property of what is on screen, so the
 * screen passes it in and everybody who does not pass it gets nothing — which keeps the
 * Concursuri bento (five unconditional observers) from polling. `refetchInterval` is resolved per
 * observer in React Query v5, so the shared cache entry still gets fresh data for free.
 */
export type CompetitionCardsCachePolicy = {
  /** Milliseconds, or `false`/omitted for no polling at all. */
  refetchInterval?: number | false;
};

/** `keepPreviousData` without importing it at runtime (it is `previousData => previousData`). */
const keepPrevious = <T>(previous: T | undefined) => previous;

/**
 * fish `useCompetitionCards`. `scope: 'all'` hits the public endpoint; everything else hits the
 * per-user one and is disabled when signed out (fish uses `skipToken`), so the tab still renders
 * Descoperă for an anonymous visitor. The key is the serialised query string — the one thing that
 * actually determines the response. Read the result with `selectCompetitionCards`.
 */
export function competitionCardsInfiniteQuery(
  t: Transport,
  params: Omit<CompetitionCardsParams, 'page' | 'pageSize'>,
  { isAuthenticated }: SessionState,
  options: CompetitionCardsCachePolicy = {}
) {
  const needsAuth = params.scope !== 'all';
  const signature = buildCompetitionCardsQuery({ ...params, page: 1, pageSize: COMPETITION_CARDS_PAGE_SIZE });
  return infiniteQueryOptions({
    queryKey: competitionCardsKeys.list(signature),
    queryFn: ({ pageParam }) =>
      getCompetitionCards(t, { ...params, page: pageParam, pageSize: COMPETITION_CARDS_PAGE_SIZE }),
    enabled: !(needsAuth && !isAuthenticated),
    getNextPageParam: (lastPage: CompetitionCardsPage) => {
      const { page, pageCount } = lastPage.meta.pagination;
      return page < pageCount ? page + 1 : undefined;
    },
    initialPageParam: 1,
    // Keep the previous list on screen while a filter change loads, instead of
    // flashing an empty state under a sticky header that stays put.
    placeholderData: keepPrevious,
    /**
     * Five minutes, the SAME for every status tab: what changes in these lists is MEMBERSHIP,
     * not the rows, and weighings are bursty, so a per-status number is false precision. Five is
     * also what the two server-drawn bento slots use. Anything fresher is a pull away.
     */
    staleTime: FIVE_MINUTES,
    /** Half an hour: the cache is what makes a tab switch free. */
    gcTime: 30 * 60_000,
    /** OFF unless the caller asks — see `CompetitionCardsCachePolicy`. */
    refetchInterval: options.refetchInterval ?? false,
  });
}

/** The derived fields fish's `useCompetitionCards` returns next to the query. */
export function selectCompetitionCards(
  data: InfiniteData<CompetitionCardsPage> | undefined,
  params: Pick<CompetitionCardsParams, 'scope'>,
  { isAuthenticated }: SessionState
) {
  const needsAuth = params.scope !== 'all';
  return {
    competitions: data?.pages.flatMap(p => p.data) ?? [],
    counts: data?.pages[0]?.meta.counts,
    total: data?.pages[0]?.meta.pagination.total ?? 0,
    requiresSignIn: needsAuth && !isAuthenticated,
  };
}

/** fish `useCompetitionSuggestions`. Typing never filters the list behind it. */
export function competitionSuggestionsQuery(t: Transport, term: string) {
  return queryOptions({
    queryKey: competitionCardsKeys.suggestions(term.trim()),
    queryFn: () => getCompetitionSuggestions(t, term),
    // The default groups and any typed term are both cheap and rarely change.
    staleTime: 60_000,
    placeholderData: keepPrevious,
  });
}

/* ------------------------------------------------------------------ */
/* fish usePulsePerson / useFeaturedCompetition                       */
/* ------------------------------------------------------------------ */

/**
 * fish `pulsePersonQueryOptions`. The server re-draws on every request it serves, so WHO is on the
 * tile is decided by when this query fetches — a product decision: 5 min stale, no focus/reconnect
 * refetch, no retry (the local fallback is already on screen). A pull calls `refetch()`.
 */
export const pulsePersonQueryPolicy = {
  staleTime: FIVE_MINUTES,
  gcTime: 30 * 60_000,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
  retry: false,
} as const;

/** fish `featuredCompetitionQueryOptions` — copied from the person tile on purpose. */
export const featuredCompetitionQueryPolicy = pulsePersonQueryPolicy;

/** fish `usePulsePerson`. Public (`auth: false`), so it is NOT gated on the session. */
export function pulsePersonQuery(t: Transport, enabled: boolean) {
  return queryOptions({
    queryKey: competitionCardsKeys.pulsePerson,
    queryFn: () => getPulsePerson(t),
    enabled,
    ...pulsePersonQueryPolicy,
  });
}

/**
 * fish `useFeaturedCompetition`. `enabled` is the feature: featured only reaches the screen when
 * the hero would otherwise be a discovery pick (see `wantsFeaturedHero`).
 */
export function featuredCompetitionQuery(t: Transport, enabled: boolean) {
  return queryOptions({
    queryKey: competitionCardsKeys.featured,
    queryFn: () => getFeaturedCompetition(t),
    enabled,
    ...featuredCompetitionQueryPolicy,
  });
}

/* ------------------------------------------------------------------ */
/* fish services/queries/useRankings.ts                               */
/* ------------------------------------------------------------------ */

type RankingQueryOptions = { enabled?: boolean };

/** fish `useRankings` */
export function rankingsQuery(t: Transport, competitionId: string, competitionStatus?: CompetitionStatus) {
  return queryOptions({
    queryKey: rankingsKeys.byCompetitionId(competitionId),
    queryFn: () => getRankings(t, competitionId),
    enabled: !!competitionId && competitionStatus !== 'notStarted',
    staleTime: FIVE_MINUTES,
  });
}

/** fish `useRankingBestN` */
export function rankingBestNQuery(
  t: Transport,
  competitionId: string,
  competitionStatus?: CompetitionStatus,
  options?: RankingQueryOptions
) {
  return queryOptions({
    queryKey: competitionKeys.rankingBestN(competitionId),
    queryFn: () => getRankingBestN(t, competitionId),
    staleTime: FIVE_MINUTES,
    enabled: !!competitionId && competitionStatus !== 'notStarted' && options?.enabled !== false,
  });
}

/** fish `useCompetitionWeighingStatistics` */
export function competitionWeighingStatisticsQuery(
  t: Transport,
  competitionId: string,
  competitionStatus?: CompetitionStatus,
  options?: RankingQueryOptions
) {
  return queryOptions({
    queryKey: competitionKeys.weighingStatistics(competitionId),
    queryFn: () => getCompetitionWeighingStatistics(t, competitionId),
    staleTime: FIVE_MINUTES,
    enabled: !!competitionId && competitionStatus !== 'notStarted' && options?.enabled !== false,
  });
}

/** fish `useCompetitionTimelineSnapshot` */
export function competitionTimelineSnapshotQuery(
  t: Transport,
  competitionId: string,
  competitionStatus?: CompetitionStatus,
  options?: RankingQueryOptions
) {
  return queryOptions({
    queryKey: competitionKeys.timelineSnapshot(competitionId),
    queryFn: () => getCompetitionTimelineSnapshot(t, competitionId),
    staleTime: FIVE_MINUTES,
    enabled:
      !!competitionId &&
      competitionStatus !== 'notStarted' &&
      competitionStatus !== 'draft' &&
      options?.enabled !== false,
  });
}

export const COMPETITION_CATCHES_PAGE_SIZE = 20;

/** fish `useCompetitionCatchesInfinite` */
export function competitionCatchesInfiniteQuery(
  t: Transport,
  competitionId: string,
  sort: CompetitionCatchesSort,
  competitionStatus?: CompetitionStatus,
  options?: RankingQueryOptions & { filter?: CompetitionCatchesFilter }
) {
  const filter = options?.filter ?? null;
  return infiniteQueryOptions({
    queryKey: competitionKeys.catchesInfinite(competitionId, sort, filter),
    queryFn: ({ pageParam }) =>
      getCompetitionCatches(t, competitionId, sort, pageParam, COMPETITION_CATCHES_PAGE_SIZE, filter),
    initialPageParam: 1,
    getNextPageParam: lastPage => {
      const { page, pageCount } = lastPage.pagination;
      return page < pageCount ? page + 1 : undefined;
    },
    enabled: !!competitionId && competitionStatus !== 'notStarted' && options?.enabled !== false,
    staleTime: FIVE_MINUTES,
  });
}

/** fish `useCatchThresholdCounts` */
export function catchThresholdCountsQuery(
  t: Transport,
  competitionId: string,
  competitionStatus?: CompetitionStatus,
  options?: RankingQueryOptions
) {
  return queryOptions({
    queryKey: competitionKeys.catchThresholdCounts(competitionId),
    queryFn: () => getCatchThresholdCounts(t, competitionId),
    staleTime: FIVE_MINUTES,
    enabled: !!competitionId && competitionStatus !== 'notStarted' && options?.enabled !== false,
  });
}

/* ------------------------------------------------------------------ */
/* fish useLiveCompetition / useMyCompetitionts / useFollowedCompetitions */
/* ------------------------------------------------------------------ */

/** fish `useLiveCompetition` */
export function liveCompetitionQuery(t: Transport, { isAuthenticated }: SessionState) {
  return queryOptions({
    queryKey: competitionKeys.live,
    queryFn: () => getLiveCompetition(t),
    enabled: isAuthenticated,
    staleTime: 60_000,
  });
}

export const MY_COMPETITIONS_PAGE_SIZE = 10;

/** fish `useMyCompetitions`. Flatten with `flattenMyCompetitions`. */
export function myCompetitionsInfiniteQuery(t: Transport, { isAuthenticated }: SessionState) {
  return infiniteQueryOptions({
    queryKey: competitionsKeys.my,
    queryFn: ({ pageParam }) => getMyCompetitions(t, { page: pageParam, pageSize: MY_COMPETITIONS_PAGE_SIZE }),
    enabled: isAuthenticated,
    getNextPageParam: (lastPage: MyCompetitionsResponse) => nextPageParam(lastPage?.meta),
    initialPageParam: 1,
  });
}

/** What fish's `useMyCompetitions` returns as `data`. */
export function flattenMyCompetitions(data: InfiniteData<MyCompetitionsResponse> | undefined) {
  return data?.pages.flatMap(page => page.data);
}

/** fish `useFollowedCompetitions` */
export function followedCompetitionsQuery(t: Transport, enabled = true) {
  return queryOptions({
    queryKey: competitionNotificationKeys.followedCompetitions,
    queryFn: () => getFollowedCompetitions(t),
    enabled,
  });
}

/* ------------------------------------------------------------------ */
/* fish useCompetitionNotificationPreferences                         */
/* ------------------------------------------------------------------ */

const NOTIFICATION_PREFERENCES_STALE_TIME = 60_000;

/** fish `useCompetitionNotificationPreferences` */
export function competitionNotificationPreferencesQuery(t: Transport, competitionId: string, enabled = true) {
  return queryOptions({
    queryKey: competitionNotificationKeys.preferences(competitionId),
    queryFn: () => getCompetitionNotificationPreferences(t, competitionId),
    enabled: enabled && !!competitionId,
    staleTime: NOTIFICATION_PREFERENCES_STALE_TIME,
  });
}

/**
 * fish `prefetchCompetitionNotificationPreferences`. Warms the cache before the follow sheet is
 * presented. Failures are swallowed: the sheet's own query reports them.
 */
export function prefetchCompetitionNotificationPreferences(qc: QueryClient, t: Transport, competitionId: string) {
  return qc
    .prefetchQuery({
      queryKey: competitionNotificationKeys.preferences(competitionId),
      queryFn: () => getCompetitionNotificationPreferences(t, competitionId),
      staleTime: NOTIFICATION_PREFERENCES_STALE_TIME,
    })
    .catch(() => {});
}

/* ------------------------------------------------------------------ */
/* fish usePollCurrent / usePollsPast                                 */
/* ------------------------------------------------------------------ */

/** fish `usePollCurrent#sortByVotes` — most votes first, admin order as the stable tiebreak. */
export function sortPollOptionsByVotes(poll: Poll | null): Poll | null {
  if (!poll) return poll;
  const options = [...poll.options].sort((a, b) => {
    if (b.votesCount !== a.votesCount) return b.votesCount - a.votesCount;
    return a.order - b.order; // stable tiebreak on admin-set order
  });
  return { ...poll, options };
}

/** fish `usePollCurrent` */
export function currentPollQuery(t: Transport) {
  return queryOptions({
    queryKey: pollKeys.current,
    queryFn: () => getCurrentPoll(t),
    select: sortPollOptionsByVotes,
    // No automatic polling. Counts refresh on screen focus, manual pull-to-refresh and
    // post-vote / post-suggest mutation invalidation.
    staleTime: 10_000,
  });
}

export const PAST_POLLS_PAGE_SIZE = 10;

/** fish `usePollsPast` */
export function pastPollsInfiniteQuery(t: Transport) {
  return infiniteQueryOptions({
    queryKey: pollKeys.past,
    queryFn: ({ pageParam }) => getPastPolls(t, { page: pageParam, pageSize: PAST_POLLS_PAGE_SIZE }),
    getNextPageParam: lastPage => nextPageParam(lastPage.meta),
    initialPageParam: 1,
  });
}

/* ------------------------------------------------------------------ */
/* fish useSponsors / useStandStatsByLakeId                           */
/* ------------------------------------------------------------------ */

/** fish `useSponsors` (default export) */
export function sponsorsQuery(t: Transport) {
  return queryOptions({ queryKey: sponsorsKeys.all, queryFn: () => getSponsors(t) });
}

/** fish `useSponsorById` */
export function sponsorByIdQuery(t: Transport, id: string) {
  return queryOptions({ queryKey: sponsorsKeys.byId(id), queryFn: () => getSponsorById(t, id), enabled: !!id });
}

/** fish `useStandStatsByLakeId` */
export function standStatsByLakeIdQuery(t: Transport, lakeId: string) {
  return queryOptions({
    queryKey: standsKeys.statsByLakeId(lakeId),
    queryFn: () => getStandStatsByLakeId(t, lakeId),
    enabled: !!lakeId,
    initialData: [] as StandStats[],
  });
}

/* ------------------------------------------------------------------ */
/* fish useGetUserStatuteForCompetition / useParticipantStatisticsBatch */
/* ------------------------------------------------------------------ */

/** fish `useGetUserStatuteForCompetition` */
export function userStatuteForCompetitionQuery(t: Transport, competitionId: string, { isAuthenticated }: SessionState) {
  return queryOptions({
    queryKey: competitionProfileKeys.statuteForCompetition(competitionId),
    queryFn: () => getUSerStatuteForCompetition(t, competitionId),
    enabled: isAuthenticated && !!competitionId,
    staleTime: 60 * 60_000, // 1 hour
  });
}

const STATS_BATCH_UNAUTHORIZED_BLU = 'GET_STATISTICS_BATCH:USER_NOT_LOGGED_IN';

/** Sorted unique ids — the batch key is order-independent. */
export function dedupeStatisticsIds(documentIds: string[]): string[] {
  return documentIds.length > 0 ? [...new Set(documentIds)].sort() : [];
}

/** fish `useParticipantStatisticsBatch` (the query half; derive the state with `participantStatisticsState`). */
export function participantStatisticsBatchQuery(
  t: Transport,
  competitionId: string,
  documentIds: string[],
  { isAuthenticated }: SessionState
) {
  const deduped = dedupeStatisticsIds(documentIds);
  return queryOptions({
    queryKey: [...competitionProfileKeys.participantStatisticsBatch(competitionId), deduped.join(',')] as const,
    queryFn: () => postUserStatisticsBatch(t, deduped),
    enabled: isAuthenticated && deduped.length > 0 && !!competitionId,
    staleTime: FIVE_MINUTES,
    retry: (_failureCount: number, err: unknown) => {
      const e = err as { status?: number } | undefined;
      if (e?.status === 401 || e?.status === 403) return false;
      return true;
    },
  });
}

/** The state fish's `useParticipantStatisticsBatch` returns, from the query result. */
export function participantStatisticsState(
  query: { data: Record<string, ParticipantStats> | undefined; isError: boolean; error: unknown; isLoading: boolean },
  documentIds: string[],
  { isAuthenticated }: SessionState
): { statsMap: Record<string, ParticipantStats>; isStatsUnauthorized: boolean; isLoading: boolean } {
  const deduped = dedupeStatisticsIds(documentIds);
  const err = query.error as { status?: number; bluCode?: string } | undefined | null;
  const isStatsUnauthorized =
    !isAuthenticated ||
    (query.isError &&
      (err?.status === 401 || err?.status === 403 || err?.bluCode === STATS_BATCH_UNAUTHORIZED_BLU));
  return {
    statsMap: query.data ?? {},
    isStatsUnauthorized: !!isStatsUnauthorized,
    isLoading: query.isLoading && deduped.length > 0 && isAuthenticated,
  };
}
