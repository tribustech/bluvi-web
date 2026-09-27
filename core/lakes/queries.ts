import type { InfiniteData, QueryClient } from '@tanstack/react-query';
import { infiniteQueryOptions, nextPageParam, queryOptions } from '../shared';
import type { Transport } from '../transport';
import {
  getClaimedPublicWaters,
  getFacilities,
  getFilteredLakes,
  getFishes,
  getLake,
  getLakeMapClusterLeaves,
  getLakeMapClusters,
  getLakeOperatorStats,
  getLakes,
  getLakesExploreCount,
  getLakesExploreSuggestions,
  getLakesFocusBbox,
  getLakesHome,
  getLakesInBbox,
  getLakesIndex,
  getOwnedLakesStats,
  getReviewForLakeByAuthorId,
  getReviewsForLake,
} from './api';
import type { LakeFilterValues, LakesCommittedSearch } from './domain/filters';
import {
  bboxBucketKey,
  makeLakesExploreCountSignature,
  makeLakesExploreSuggestionsSignature,
  makeLakesHomeSignature,
  makeLakesInBboxSignature,
  type LakesExploreCountParams,
  type LakesExploreSuggestionsParams,
  type LakesHomeParams,
  type LakesInBboxQueryParams,
} from './domain/signatures';
import type {
  Bbox,
  LakeCardListResponse,
  LakeOperatorStats,
  LakesExploreSuggestionsPage,
  LakeHomeSection,
  OperatorStatsWindowName,
} from './schemas';

/* ------------------------------------------------------------------------------------------------
 * Keys — exact fish `queryKeys.*` shapes
 * ---------------------------------------------------------------------------------------------- */

/** fish `queryKeys.lakes` */
export const lakesKeys = {
  all: ['lakes'] as const,
  index: ['lakes', 'index'] as const,
  byId: (id: string) => ['lakes', id] as const,
  searchResults: (search: string) => ['lakes', 'search', search] as const,
  home: (querySignature: string) => ['lakes', 'home', querySignature] as const,
  exploreSuggestions: (querySignature: string) => ['lakes', 'explore', 'suggestions', querySignature] as const,
  exploreCount: (querySignature: string) => ['lakes', 'explore', 'count', querySignature] as const,
  inBbox: (querySignature: string) => ['lakes', 'in-bbox', querySignature] as const,
  focusBbox: (countyId: string | null, cityId: string | null) => ['lakes', 'focus-bbox', countyId ?? '', cityId ?? ''] as const,
  /** fish `useFilteredLakes` builds this inline. */
  filtered: (filters: LakeFilterValues, pageSize: number) => ['lakes', JSON.stringify(filters), pageSize] as const,
  /** fish `useMapClusters` builds this inline. */
  mapClusters: (bucket: string, filters: LakeFilterValues, committedSearch: LakesCommittedSearch) =>
    ['lakes', 'map-clusters', bucket, filters, committedSearch] as const,
  /**
   * Web-only: fish fetches cluster leaves imperatively (no cache entry). Nested under the
   * `map-clusters` prefix so the same invalidations reach it.
   */
  mapClusterLeaves: (clusterId: string, bucket: string, filters: LakeFilterValues | undefined) =>
    ['lakes', 'map-clusters', 'leaves', clusterId, bucket, filters ?? null] as const,
};

/** fish `queryKeys.publicWaters` */
export const publicWatersKeys = {
  claimed: ['public-waters', 'claimed'] as const,
};

/** fish `useFacilities` / `useFishes` inline keys. */
export const facilitiesKeys = { all: ['facilities'] as const };
export const fishesKeys = { all: ['fishes'] as const };

/** fish `queryKeys.reviews` (lake reviews). */
export const lakeReviewsKeys = {
  all: ['reviews'] as const,
  byLakeId: (lakeId: string, pageSize?: number) => ['reviews', 'lakeId=', lakeId, 'pageSize', pageSize || 10] as const,
  myReviewByLakeId: (lakeId: string) => ['reviews', 'lakeId=', lakeId, 'my'] as const,
};

/** fish `queryKeys.operatorStats` */
export const operatorStatsKeys = {
  // The whole family, used as an invalidation prefix by every booking write — see
  // core/booking `invalidateOperatorSurfaces`.
  all: ['operator-stats'] as const,
  owned: ['operator-stats', 'owned'] as const,
  lake: (lakeId: string, window?: string) => ['operator-stats', 'lake', lakeId, window ?? ''] as const,
};

/** fish `useVenueSearch` inline key (screen-local, deliberately not in `queryKeys`). */
export const venueSearchKey = (term: string) => ['partide', 'venue-search', term] as const;

/* ------------------------------------------------------------------------------------------------
 * Lakes lists and detail
 * ---------------------------------------------------------------------------------------------- */

const LAKES_STALE_TIME_MS = 60 * 60 * 1000;

/** fish `useLake` */
export function lakeQuery(t: Transport, id: string, options?: { enabled?: boolean }) {
  return queryOptions({
    queryKey: lakesKeys.byId(id),
    queryFn: () => getLake(t, id),
    enabled: (options?.enabled ?? true) && !!id,
  });
}

/** fish `useLakes` */
export function lakesInfiniteQuery(t: Transport, { pageSize = 5, search = '' }: { pageSize?: number; search?: string } = {}) {
  return infiniteQueryOptions({
    queryKey: search ? lakesKeys.searchResults(search) : lakesKeys.all,
    queryFn: ({ pageParam }) => getLakes(t, { page: pageParam, pageSize, search }),
    getNextPageParam: (last: LakeCardListResponse) => nextPageParam(last.meta),
    initialPageParam: 1,
    staleTime: LAKES_STALE_TIME_MS,
    gcTime: LAKES_STALE_TIME_MS,
  });
}

/**
 * fish `useLakeSearchResults` — seeded with whatever the unfiltered list already holds so the
 * results screen paints instantly. fish passes `skipToken` when the search is empty; `enabled`
 * has the same effect without importing TanStack at runtime.
 */
export function lakeSearchResultsInfiniteQuery(
  t: Transport,
  qc: QueryClient,
  { pageSize = 5, search = '' }: { pageSize?: number; search?: string } = {}
) {
  return infiniteQueryOptions({
    queryKey: lakesKeys.searchResults(search),
    queryFn: ({ pageParam }) => getLakes(t, { page: pageParam, pageSize, search }),
    enabled: search !== '',
    getNextPageParam: (last: LakeCardListResponse) => nextPageParam(last.meta),
    initialPageParam: 1,
    initialData: qc.getQueryData<InfiniteData<LakeCardListResponse, number>>(lakesKeys.all),
    staleTime: LAKES_STALE_TIME_MS,
    gcTime: LAKES_STALE_TIME_MS,
  });
}

/** fish `useFilteredLakes` — fish reads the filters from `filtersAtom`; here they are an argument. */
export function filteredLakesInfiniteQuery(t: Transport, filters: LakeFilterValues, { pageSize = 20 }: { pageSize?: number } = {}) {
  return infiniteQueryOptions({
    queryKey: lakesKeys.filtered(filters, pageSize),
    queryFn: ({ pageParam }) => getFilteredLakes(t, { page: pageParam, pageSize, filters }),
    getNextPageParam: (last: LakeCardListResponse) => nextPageParam(last.meta),
    initialPageParam: 1,
    staleTime: LAKES_STALE_TIME_MS,
    gcTime: LAKES_STALE_TIME_MS,
  });
}

const SIX_HOURS_MS = 6 * 3_600_000;

/**
 * fish `useLakesIndex` / `lakesIndexQueryOptions` — lean index of all published lakes for proximity
 * scans. Edge-cached under the lakes-list tag; a stale copy is harmless, so it refetches at most
 * every 6 h. Hook and imperative `fetchQuery` callers share this one entry.
 */
export function lakesIndexQuery(t: Transport, options?: { enabled?: boolean }) {
  return queryOptions({
    queryKey: lakesKeys.index,
    queryFn: () => getLakesIndex(t),
    staleTime: SIX_HOURS_MS,
    gcTime: SIX_HOURS_MS,
    enabled: options?.enabled ?? true,
  });
}

const HOME_CACHE_TIME_MS = 60 * 60 * 1000;

/** fish `useLakesHome` (`placeholderData: keepPreviousData`). */
export function lakesHomeQuery(t: Transport, params: LakesHomeParams) {
  return queryOptions({
    queryKey: lakesKeys.home(makeLakesHomeSignature(params)),
    queryFn: () => getLakesHome(t, params),
    placeholderData: (previous: LakeHomeSection[] | undefined) => previous,
    staleTime: HOME_CACHE_TIME_MS,
    gcTime: HOME_CACHE_TIME_MS,
  });
}

/* ------------------------------------------------------------------------------------------------
 * Explore (search sheet). fish debounces the params inside the hook; the UI debounces here and
 * passes the settled params — the constants below are fish's delays.
 * ---------------------------------------------------------------------------------------------- */

export const LAKES_EXPLORE_COUNT_DEBOUNCE_MS = 240;
export const LAKES_EXPLORE_SUGGESTIONS_DEBOUNCE_MS = 260;

/** fish `useLakesExploreCount` — `enabled` is false while fish is still debouncing. */
export function lakesExploreCountQuery(t: Transport, params: LakesExploreCountParams, enabled = true) {
  return queryOptions({
    queryKey: lakesKeys.exploreCount(makeLakesExploreCountSignature(params)),
    queryFn: () => getLakesExploreCount(t, params),
    enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
}

const SUGGESTIONS_PAGE_SIZE = 20;
const SUGGESTIONS_STALE_TIME = 60 * 60 * 1000;
const SUGGESTIONS_GC_TIME = 4 * 60 * 60 * 1000;

/** fish `useLakesExploreSuggestions`. Flatten the pages with `flattenLakesExploreSuggestions`. */
export function lakesExploreSuggestionsInfiniteQuery(t: Transport, params: LakesExploreSuggestionsParams, enabled = true) {
  return infiniteQueryOptions({
    queryKey: lakesKeys.exploreSuggestions(makeLakesExploreSuggestionsSignature(params)),
    queryFn: ({ pageParam }) => getLakesExploreSuggestions(t, { ...params, page: pageParam, pageSize: SUGGESTIONS_PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (last: LakesExploreSuggestionsPage) => nextPageParam(last.meta),
    enabled,
    staleTime: SUGGESTIONS_STALE_TIME,
    gcTime: SUGGESTIONS_GC_TIME,
  });
}

/** fish `prefetchDefaultSuggestions` — pass to `qc.prefetchInfiniteQuery`. */
export function defaultLakesExploreSuggestionsInfiniteQuery(t: Transport) {
  return infiniteQueryOptions({
    queryKey: lakesKeys.exploreSuggestions(makeLakesExploreSuggestionsSignature({})),
    queryFn: () => getLakesExploreSuggestions(t, { page: 1, pageSize: SUGGESTIONS_PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (last: LakesExploreSuggestionsPage) => nextPageParam(last.meta),
    staleTime: SUGGESTIONS_STALE_TIME,
  });
}

/** fish `useLakesExploreSuggestions` return value: every loaded page's suggestions, in order. */
export function flattenLakesExploreSuggestions(data: InfiniteData<LakesExploreSuggestionsPage> | undefined) {
  return data?.pages.flatMap(page => page.suggestions) ?? [];
}

/* ------------------------------------------------------------------------------------------------
 * Map viewport
 * ---------------------------------------------------------------------------------------------- */

const IN_BBOX_PAGE_SIZE = 7;

/** fish `useLakesInBbox` */
export function lakesInBboxInfiniteQuery(t: Transport, params: LakesInBboxQueryParams) {
  return infiniteQueryOptions({
    queryKey: lakesKeys.inBbox(makeLakesInBboxSignature(params)),
    queryFn: ({ pageParam }) => {
      const bbox = params.bbox as Bbox;
      return getLakesInBbox(t, {
        north: bbox.north,
        south: bbox.south,
        east: bbox.east,
        west: bbox.west,
        page: pageParam,
        pageSize: IN_BBOX_PAGE_SIZE,
        filters: params.filters,
      });
    },
    initialPageParam: 1,
    getNextPageParam: last => (last.meta.hasMore ? last.meta.page + 1 : undefined),
    enabled: params.enabled && params.bbox !== null,
    placeholderData: previous => previous,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });
}

/** fish `useLakesFocusBbox` */
export function lakesFocusBboxQuery(t: Transport, params: { countyId?: string | null; cityId?: string | null }) {
  const countyId = params.countyId ?? null;
  const cityId = params.cityId ?? null;
  return queryOptions({
    queryKey: lakesKeys.focusBbox(countyId, cityId),
    queryFn: () => getLakesFocusBbox(t, { countyId, cityId }),
    enabled: Boolean(countyId || cityId),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

/** fish `useMapClusters.ts#UseMapClustersParams` */
export interface MapClustersQueryParams {
  bbox: Bbox | null;
  zoom: number;
  filters: LakeFilterValues;
  committedSearch: LakesCommittedSearch;
  enabled: boolean;
}

/** fish `useMapClusters` */
export function lakeMapClustersQuery(t: Transport, { bbox, zoom, filters, committedSearch, enabled }: MapClustersQueryParams) {
  return queryOptions({
    queryKey: lakesKeys.mapClusters(bboxBucketKey(bbox, zoom), filters, committedSearch),
    queryFn: () => getLakeMapClusters(t, { ...(bbox as Bbox), zoom, filters }),
    enabled: enabled && bbox !== null,
    placeholderData: previous => previous,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });
}

/** Web-only factory for `getLakeMapClusterLeaves` (fish calls it imperatively); same cache times as clusters. */
export function lakeMapClusterLeavesQuery(
  t: Transport,
  params: { clusterId: string; bbox: Bbox; zoom: number; filters?: LakeFilterValues }
) {
  return queryOptions({
    queryKey: lakesKeys.mapClusterLeaves(params.clusterId, bboxBucketKey(params.bbox, params.zoom), params.filters),
    queryFn: () => getLakeMapClusterLeaves(t, { ...params.bbox, zoom: params.zoom, clusterId: params.clusterId, filters: params.filters }),
    enabled: !!params.clusterId,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });
}

/* ------------------------------------------------------------------------------------------------
 * Venue search (Partide "Începe o partidă") — lakes half only
 * ---------------------------------------------------------------------------------------------- */

export const VENUE_SEARCH_DEBOUNCE_MS = 250;
export const VENUE_SEARCH_MIN_CHARS = 2;
export const VENUE_SEARCH_RESULT_LIMIT = 10;

/**
 * fish `useVenueSearch` — the catalog-lakes half. fish merges it with a public-waters search over
 * the bundled SQLite DB, which has no web counterpart in `core/`. `term` is the debounced term.
 * The lakes are `data.data`; fish shows none below the minimum length.
 */
export function venueSearchLakesQuery(t: Transport, term: string) {
  return queryOptions({
    queryKey: venueSearchKey(term),
    queryFn: () => getLakes(t, { search: term, pageSize: VENUE_SEARCH_RESULT_LIMIT }),
    enabled: term.trim().length >= VENUE_SEARCH_MIN_CHARS,
  });
}

/* ------------------------------------------------------------------------------------------------
 * Catalogs
 * ---------------------------------------------------------------------------------------------- */

const CATALOG_CACHE_MS = 3 * 60 * 60 * 1000;

/** fish `useFacilities` */
export function facilitiesQuery(t: Transport) {
  return queryOptions({
    queryKey: facilitiesKeys.all,
    queryFn: () => getFacilities(t),
    staleTime: CATALOG_CACHE_MS,
    gcTime: CATALOG_CACHE_MS,
  });
}

/** fish `useFishes` */
export function fishesQuery(t: Transport) {
  return queryOptions({
    queryKey: fishesKeys.all,
    queryFn: () => getFishes(t),
    staleTime: CATALOG_CACHE_MS,
    gcTime: CATALOG_CACHE_MS,
  });
}

/**
 * fish `useClaimedPublicWaters` — fetched once per session (long staleTime), edge-cached and
 * tag-purged server-side. Turn the rows into the lookup map with `toClaimedPublicWatersMap`.
 */
export function claimedPublicWatersQuery(t: Transport) {
  return queryOptions({
    queryKey: publicWatersKeys.claimed,
    queryFn: () => getClaimedPublicWaters(t),
    staleTime: 60 * 60 * 1000, // 1h
    gcTime: 24 * 60 * 60 * 1000, // 24h
  });
}

/* ------------------------------------------------------------------------------------------------
 * Lake reviews (fish features/reviews/queries.ts)
 * ---------------------------------------------------------------------------------------------- */

/** fish `useGetReviewsForLakeQuery` */
export function lakeReviewsInfiniteQuery(t: Transport, lakeId: string, pageSize?: number) {
  return infiniteQueryOptions({
    initialPageParam: 1,
    queryKey: lakeReviewsKeys.byLakeId(lakeId, pageSize),
    queryFn: ({ pageParam }) => getReviewsForLake(t, lakeId, { page: pageParam, pageSize: pageSize || 10 }),
    enabled: !!lakeId,
    staleTime: 1000 * 60 * 5, // 5 minutes
    getNextPageParam: last => nextPageParam(last.meta),
  });
}

/**
 * fish `useGetMyReviewForLakeQuery` — fish gates on the loaded profile's documentId; pass the
 * signed-in user's documentId (undefined when signed out).
 */
export function myLakeReviewQuery(t: Transport, lakeId: string, userDocumentId: string | null | undefined) {
  return queryOptions({
    queryKey: lakeReviewsKeys.myReviewByLakeId(lakeId),
    queryFn: () => getReviewForLakeByAuthorId(t, { lakeId }),
    enabled: !!userDocumentId && !!lakeId,
  });
}

/* ------------------------------------------------------------------------------------------------
 * Operator stats
 * ---------------------------------------------------------------------------------------------- */

/** fish `useOwnedLakesStats` */
export function ownedLakesStatsQuery(t: Transport, enabled = true) {
  return queryOptions({
    queryKey: operatorStatsKeys.owned,
    queryFn: () => getOwnedLakesStats(t),
    enabled,
  });
}

/** fish `useLakeOperatorStats` */
export function lakeOperatorStatsQuery(t: Transport, lakeId: string, window?: OperatorStatsWindowName) {
  return queryOptions({
    queryKey: operatorStatsKeys.lake(lakeId, window),
    queryFn: () => getLakeOperatorStats(t, lakeId, window),
    enabled: Boolean(lakeId),
    // Switching the chart's window must not blank the whole panel: every number above the chart
    // is window-independent, so dropping them to a spinner while a different window loads would
    // be a lie about what changed.
    placeholderData: (previous: LakeOperatorStats | undefined) => previous,
  });
}
