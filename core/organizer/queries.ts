import { infiniteQueryOptions, nextPageParam, queryOptions } from '../shared';
import type { Transport } from '../transport';
import {
  fetchActiveRaffle,
  fetchRaffleParticipation,
  getAllocatedParticipants,
  getCatchThresholdCounts,
  getCompetitionActiveWeighing,
  getCompetitionCatches,
  getCompetitionTimelineSnapshot,
  getCompetitionWeighingStatistics,
  getExtraScalesList,
  getOrganizerCompetitions,
  getOrganizerDashboard,
  getOrganizerRecentLakes,
  getOrganizerStatDetails,
  getWeighingById,
  getWeighingRevisions,
  getWeighings,
  getWeighingsSummary,
  getWeightingsTotal,
  type MediaOriginOption,
} from './api';
import { groupRevisionsBySession } from './domain/weighing';
import type { CompetitionCatchesFilter, CompetitionCatchesSort, CompetitionStatus, OrganizerStatKey } from './schemas';

/* ------------------------------------------------------------------ */
/* Keys — exact fish `queryKeys.*` shapes                              */
/* ------------------------------------------------------------------ */

/** fish `queryKeys.organizer` */
export const organizerKeys = {
  dashboard: ['organizer', 'dashboard'] as const,
  competitionsRoot: ['organizer', 'competitions'] as const,
  competitions: (status?: string, pageSize?: number) =>
    ['organizer', 'competitions', { status: status ?? 'all', pageSize: pageSize ?? null }] as const,
  statDetailsRoot: ['organizer', 'stat-details'] as const,
  statDetails: (statKey?: string, pageSize?: number) =>
    ['organizer', 'stat-details', { statKey: statKey ?? null, pageSize: pageSize ?? null }] as const,
  recentLakes: ['organizer', 'recent-lakes'] as const,
};

/** fish `queryKeys.weighings` */
export const weighingKeys = {
  all: ['weighings'] as const,
  byCompetitionId: (competitionId: string) => ['weighings', 'competition', competitionId] as const,
  summaryByCompetitionId: (competitionId: string) => ['weighings', 'competition', competitionId, 'summary'] as const,
  byCompetitionIdAndStandId: (competitionId: string, standId: string) =>
    ['weighings', 'competition', competitionId, 'stand', standId] as const,
  byId: (weighingId: string) => ['weighings', 'id', weighingId] as const,
  totalWeightByCompetitionIdAndStandId: (competitionId: string, standId: string) =>
    ['weighings', 'competition', competitionId, 'stand', standId, 'totalWeight'] as const,
  revisions: (weighingId: string) => ['weighings', 'id', weighingId, 'revisions'] as const,
};

/** fish `queryKeys.raffle` */
export const raffleKeys = {
  state: ['raffle', 'state'] as const,
  active: ['raffle', 'active'] as const,
  participation: ['raffle', 'participation'] as const,
};

/**
 * The organizer/referee entries of fish `queryKeys.competition` / `queryKeys.competitions`.
 * The rest of those roots (lists, detail, rankings…) belong to `core/competitions`.
 */
export const competitionManagementKeys = {
  activeWeighingById: (id: string) => ['competitions', id, 'active-weighing'] as const,
  allocatedParticipants: (id: string) => ['competitions', id, 'allocated-participants'] as const,
  extraScalesList: (id: string) => ['competition', id, 'extra-scales-list'] as const,
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
 * Keys owned by other domains that organizer mutations invalidate. Minimal local copies of
 * fish `queryKeys` (reconciled with `core/competitions`, `core/profile` once they land).
 */
export const externalKeys = {
  competitionsAll: ['competitions'] as const,
  competitionsById: (id: string) => ['competitions', id] as const,
  competitionLive: ['competition', 'live'] as const,
  competitionCardsRoot: ['competition-cards'] as const,
  rankingsByCompetitionId: (competitionId: string) => ['rankings', competitionId] as const,
  rankingBestN: (competitionId: string) => ['competition', competitionId, 'ranking-best-n'] as const,
  profileMy: ['my-profile'] as const,
};

/* ------------------------------------------------------------------ */
/* Organizer dashboard                                                 */
/* ------------------------------------------------------------------ */

const DEFAULT_ORGANIZER_COMPETITIONS_PAGE_SIZE = 10;
const DEFAULT_ORGANIZER_STAT_DETAILS_PAGE_SIZE = 5;

/** Every organizer query is gated on the profile role (`isOrganizerProfile`). */
export type OrganizerGate = { isOrganizer: boolean };

/**
 * fish `useOrganizerCompetitions`. fish returns `data` flattened across pages — call
 * `flattenPages(query.data)` in the UI.
 */
export function organizerCompetitionsInfiniteQuery(
  t: Transport,
  {
    status,
    enabled = true,
    pageSize = DEFAULT_ORGANIZER_COMPETITIONS_PAGE_SIZE,
    isOrganizer,
  }: OrganizerGate & { status?: string; enabled?: boolean; pageSize?: number }
) {
  return infiniteQueryOptions({
    queryKey: organizerKeys.competitions(status, pageSize),
    queryFn: ({ pageParam }) => getOrganizerCompetitions(t, { status, page: pageParam, pageSize }),
    getNextPageParam: last => nextPageParam(last?.meta),
    initialPageParam: 1,
    enabled: isOrganizer && enabled,
  });
}

/** fish `useOrganizerDashboard` */
export function organizerDashboardQuery(t: Transport, { isOrganizer }: OrganizerGate) {
  return queryOptions({
    queryKey: organizerKeys.dashboard,
    queryFn: () => getOrganizerDashboard(t),
    enabled: isOrganizer,
  });
}

/** fish `useOrganizerRecentLakes` */
export function organizerRecentLakesQuery(t: Transport, { isOrganizer, enabled = true }: OrganizerGate & { enabled?: boolean }) {
  return queryOptions({
    queryKey: organizerKeys.recentLakes,
    queryFn: () => getOrganizerRecentLakes(t),
    enabled: isOrganizer && enabled,
  });
}

/** fish `useOrganizerStatDetails` (flatten with `flattenPages`). */
export function organizerStatDetailsInfiniteQuery(
  t: Transport,
  statKey: OrganizerStatKey | null,
  {
    isOrganizer,
    enabled = true,
    pageSize = DEFAULT_ORGANIZER_STAT_DETAILS_PAGE_SIZE,
  }: OrganizerGate & { enabled?: boolean; pageSize?: number }
) {
  const hasStatKey = typeof statKey === 'string' && statKey.length > 0;
  return infiniteQueryOptions({
    queryKey: organizerKeys.statDetails(statKey || undefined, pageSize),
    queryFn: ({ pageParam }) =>
      getOrganizerStatDetails(t, { statKey: statKey as OrganizerStatKey, page: pageParam, pageSize }),
    getNextPageParam: last => nextPageParam(last?.meta),
    initialPageParam: 1,
    enabled: isOrganizer && enabled && hasStatKey,
  });
}

/* ------------------------------------------------------------------ */
/* Weighings / cântar                                                  */
/* ------------------------------------------------------------------ */

/** fish `useActiveWeighing` */
export function activeWeighingQuery(t: Transport, competitionId: string, { isAuthenticated }: { isAuthenticated: boolean }) {
  return queryOptions({
    queryKey: competitionManagementKeys.activeWeighingById(competitionId),
    queryFn: () => getCompetitionActiveWeighing(t, competitionId),
    enabled: isAuthenticated && !!competitionId,
  });
}

/** fish `useWeighings` */
export function weighingsQuery(t: Transport, competitionId: string, standId: string, options?: { enabled?: boolean }) {
  return queryOptions({
    queryKey: weighingKeys.byCompetitionIdAndStandId(competitionId, standId),
    queryFn: () => getWeighings(t, competitionId, standId),
    enabled: options?.enabled ?? true,
  });
}

/** fish `useWeighingById` */
export function weighingByIdQuery(t: Transport, weighingId: string) {
  return queryOptions({
    queryKey: weighingKeys.byId(weighingId),
    queryFn: () => getWeighingById(t, weighingId),
    enabled: !!weighingId,
  });
}

/** fish `useWeighingRevisions` — revisions grouped by close/reopen session. */
export function weighingRevisionsQuery(t: Transport, weighingId: string) {
  return queryOptions({
    queryKey: weighingKeys.revisions(weighingId),
    queryFn: async () => groupRevisionsBySession((await getWeighingRevisions(t, weighingId)).data),
    enabled: !!weighingId,
    staleTime: 0,
  });
}

/** fish `useWeighingsSummary` */
export function weighingsSummaryQuery(t: Transport, competitionId: string, enabled = true) {
  return queryOptions({
    queryKey: weighingKeys.summaryByCompetitionId(competitionId),
    queryFn: () => getWeighingsSummary(t, competitionId),
    enabled: !!competitionId && enabled,
  });
}

/** fish `useWeighingsTotal` */
export function weighingsTotalQuery(t: Transport, competitionId: string, standId: string, options?: { enabled?: boolean }) {
  return queryOptions({
    queryKey: weighingKeys.totalWeightByCompetitionIdAndStandId(competitionId, standId),
    queryFn: () => getWeightingsTotal(t, competitionId, standId),
    enabled: options?.enabled ?? true,
  });
}

/** fish `useGetAllocatedParticipants` */
export function allocatedParticipantsQuery(t: Transport, competitionId: string) {
  return queryOptions({
    queryKey: competitionManagementKeys.allocatedParticipants(competitionId),
    queryFn: () => getAllocatedParticipants(t, competitionId),
    // Skip the request until we have a real competition id. Without this, callers that
    // pass `competition?.documentId` before it loaded fire `/competitions/undefined/…`.
    enabled: !!competitionId,
  });
}

/** fish `useGetExtraScalesList` */
export function extraScalesListQuery(t: Transport, competitionId: string) {
  return queryOptions({
    queryKey: competitionManagementKeys.extraScalesList(competitionId),
    queryFn: () => getExtraScalesList(t, competitionId),
    enabled: !!competitionId,
  });
}

/* ------------------------------------------------------------------ */
/* Competition statistics (Statistici tab) — fish queries/useRankings  */
/* ------------------------------------------------------------------ */

const RANKINGS_STALE_TIME_MS = 1000 * 60 * 5; // 5 minutes
const CATCHES_PAGE_SIZE = 20;

type StatsOptions = { enabled?: boolean };

/** fish `useCompetitionWeighingStatistics` */
export function competitionWeighingStatisticsQuery(
  t: Transport,
  competitionId: string,
  competitionStatus?: CompetitionStatus,
  options?: StatsOptions
) {
  return queryOptions({
    queryKey: competitionManagementKeys.weighingStatistics(competitionId),
    queryFn: () => getCompetitionWeighingStatistics(t, competitionId),
    staleTime: RANKINGS_STALE_TIME_MS,
    enabled: !!competitionId && competitionStatus !== 'notStarted' && options?.enabled !== false,
  });
}

/** fish `useCompetitionTimelineSnapshot` */
export function competitionTimelineSnapshotQuery(
  t: Transport,
  competitionId: string,
  competitionStatus?: CompetitionStatus,
  options?: StatsOptions
) {
  return queryOptions({
    queryKey: competitionManagementKeys.timelineSnapshot(competitionId),
    queryFn: () => getCompetitionTimelineSnapshot(t, competitionId),
    staleTime: RANKINGS_STALE_TIME_MS,
    enabled:
      !!competitionId &&
      competitionStatus !== 'notStarted' &&
      competitionStatus !== 'draft' &&
      options?.enabled !== false,
  });
}

/** fish `useCompetitionCatchesInfinite` — note the CMS puts `pagination` at the top level. */
export function competitionCatchesInfiniteQuery(
  t: Transport,
  competitionId: string,
  sort: CompetitionCatchesSort,
  competitionStatus?: CompetitionStatus,
  options?: StatsOptions & { filter?: CompetitionCatchesFilter }
) {
  const filter = options?.filter ?? null;
  return infiniteQueryOptions({
    queryKey: competitionManagementKeys.catchesInfinite(competitionId, sort, filter),
    queryFn: ({ pageParam }) => getCompetitionCatches(t, competitionId, sort, pageParam, CATCHES_PAGE_SIZE, filter),
    initialPageParam: 1,
    getNextPageParam: last => {
      const { page, pageCount } = last.pagination;
      return page < pageCount ? page + 1 : undefined;
    },
    enabled: !!competitionId && competitionStatus !== 'notStarted' && options?.enabled !== false,
    staleTime: RANKINGS_STALE_TIME_MS,
  });
}

/** fish `useCatchThresholdCounts` */
export function catchThresholdCountsQuery(
  t: Transport,
  competitionId: string,
  competitionStatus?: CompetitionStatus,
  options?: StatsOptions
) {
  return queryOptions({
    queryKey: competitionManagementKeys.catchThresholdCounts(competitionId),
    queryFn: () => getCatchThresholdCounts(t, competitionId),
    staleTime: RANKINGS_STALE_TIME_MS,
    enabled: !!competitionId && competitionStatus !== 'notStarted' && options?.enabled !== false,
  });
}

/* ------------------------------------------------------------------ */
/* Raffle                                                              */
/* ------------------------------------------------------------------ */

const RAFFLE_STALE_TIME_MS = 1000 * 60 * 2; // 2 minutes

/**
 * fish `useRaffleActive` — active raffle session. Refetches when invalidated (e.g. root
 * invalidateQueries on app foreground).
 */
export function raffleActiveQuery(t: Transport, options: MediaOriginOption = {}) {
  return queryOptions({
    queryKey: raffleKeys.active,
    queryFn: () => fetchActiveRaffle(t, options),
    staleTime: RAFFLE_STALE_TIME_MS,
  });
}

/**
 * fish `useRaffleParticipation` — current user's participation for the active session.
 * Enabled only when signed in and there is an active session (fish reads it from
 * `useRaffleActive().data?.session`; the web passes it in).
 */
export function raffleParticipationQuery(
  t: Transport,
  { isAuthenticated, hasActiveSession, mediaOrigin }: MediaOriginOption & { isAuthenticated: boolean; hasActiveSession: boolean }
) {
  return queryOptions({
    queryKey: raffleKeys.participation,
    queryFn: () => fetchRaffleParticipation(t, { mediaOrigin }),
    enabled: isAuthenticated && hasActiveSession,
    staleTime: RAFFLE_STALE_TIME_MS,
  });
}
