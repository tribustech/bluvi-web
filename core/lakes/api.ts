import { z } from 'zod';
import { dataSchema } from '../shared';
import { call, type Transport } from '../transport';
import {
  DEFAULT_LAKES_COMMITTED_SEARCH,
  mapApiSuggestion,
  mapFiltersToQuery,
  mapSearchToCountQuery,
  toCsv,
  type LakeFilterValues,
  type LakesCommittedSearch,
} from './domain/filters';
import type { LakesExploreCountParams, LakesExploreSuggestionsParams, LakesHomeParams } from './domain/signatures';
import {
  claimedPublicWaterSchema,
  exploreCountResponseSchema,
  exploreSuggestionsResponseSchema,
  facilitySchema,
  fishSpeciesSchema,
  lakeBookingInterestResultSchema,
  lakeCardListResponseSchema,
  lakeCardSchema,
  lakeClaimResultSchema,
  lakeDetailSchema,
  lakeIndexEntrySchema,
  lakeMapClustersResponseSchema,
  lakeMapLeavesResponseSchema,
  lakeOperatorStatsSchema,
  lakesFocusBboxResponseSchema,
  lakesHomeResponseSchema,
  lakesInBboxResponseSchema,
  lakeSuggestionResponseSchema,
  ownedLakesStatsSchema,
  reviewSchema,
  reviewsForLakeResponseSchema,
  reviewWriteResponseSchema,
  type LakeBookingInterestSource,
  type LakeClaimInput,
  type LakesExploreSuggestionsPage,
  type LakeSuggestionRequest,
  type OperatorStatsWindowName,
  type ReviewReqBody,
} from './schemas';

const enc = encodeURIComponent;

/* ------------------------------------------------------------------------------------------------
 * fish services/api/lakes.ts
 * ---------------------------------------------------------------------------------------------- */

/** fish `services/api/lakes.ts#getLake` */
export async function getLake(t: Transport, id: string) {
  const res = await call(t, { method: 'GET', path: `/feed/lakes/${enc(id)}`, auth: 'none' }, dataSchema(lakeDetailSchema));
  return res.data;
}

/** fish `services/api/lakes.ts#getLakes` — text search over the card DTO. */
export function getLakes(t: Transport, { page = 1, pageSize = 20, search = '' }: { page?: number; pageSize?: number; search?: string } = {}) {
  return call(
    t,
    { method: 'GET', path: '/feed/lakes/search', query: { q: search || undefined, page, pageSize }, auth: 'none' },
    lakeCardListResponseSchema
  );
}

/** fish `services/api/lakes.ts#getFilteredLakes` */
export function getFilteredLakes(
  t: Transport,
  { page = 1, pageSize = 20, filters }: { page?: number; pageSize?: number; filters?: LakeFilterValues }
) {
  // fish sends facility/fish/regime only here (no rating tier, no bookable) — kept as is.
  const { facilityIds, fishIds, regimes } = mapFiltersToQuery(filters);
  return call(
    t,
    { method: 'GET', path: '/feed/lakes/filtered', query: { facilityIds, fishIds, regimes, page, pageSize }, auth: 'none' },
    lakeCardListResponseSchema
  );
}

/** fish `services/api/lakes.ts#getFilteredLakesCount` — delegates to the explore count. */
export function getFilteredLakesCount(t: Transport, params: { filters?: LakeFilterValues; search?: LakesCommittedSearch }) {
  return getLakesExploreCount(t, params);
}

/** fish `services/api/lakes.ts#GetLakeMapClustersParams` */
export interface GetLakeMapClustersParams {
  north: number;
  south: number;
  east: number;
  west: number;
  zoom: number;
  filters?: LakeFilterValues;
}

/** fish `services/api/lakes.ts#getLakeMapClusters` */
export function getLakeMapClusters(t: Transport, { north, south, east, west, zoom, filters }: GetLakeMapClustersParams) {
  return call(
    t,
    {
      method: 'GET',
      path: '/lakes/map-clusters',
      query: { north, south, east, west, zoom, ...mapFiltersToQuery(filters) },
      auth: 'none',
    },
    lakeMapClustersResponseSchema
  );
}

/** fish `services/api/lakes.ts#getLakeMapClusterLeaves` */
export function getLakeMapClusterLeaves(
  t: Transport,
  { clusterId, north, south, east, west, zoom, filters }: GetLakeMapClustersParams & { clusterId: string }
) {
  return call(
    t,
    {
      method: 'GET',
      path: `/lakes/map-clusters/${enc(clusterId)}/leaves`,
      query: { north, south, east, west, zoom, ...mapFiltersToQuery(filters) },
      auth: 'none',
    },
    lakeMapLeavesResponseSchema
  );
}

/** fish `services/api/lakes.ts#LakesInBboxParams` */
export interface LakesInBboxParams {
  north: number;
  south: number;
  east: number;
  west: number;
  page: number;
  pageSize: number;
  filters?: LakeFilterValues;
}

/** fish `services/api/lakes.ts#getLakesInBbox` */
export function getLakesInBbox(t: Transport, { north, south, east, west, page, pageSize, filters }: LakesInBboxParams) {
  return call(
    t,
    {
      method: 'GET',
      path: '/lakes/in-bbox',
      query: { north, south, east, west, page, pageSize, ...mapFiltersToQuery(filters) },
      auth: 'none',
    },
    lakesInBboxResponseSchema
  );
}

/** fish `services/api/lakes.ts#getLakesFocusBbox` — the CMS wants exactly one of the two ids. */
export function getLakesFocusBbox(t: Transport, params: { countyId?: string | null; cityId?: string | null }) {
  return call(
    t,
    {
      method: 'GET',
      path: '/lakes/focus-bbox',
      query: { countyId: params.countyId ?? undefined, cityId: params.cityId ?? undefined },
      auth: 'none',
    },
    lakesFocusBboxResponseSchema
  );
}

/** fish `services/api/lakes.ts#getLakesIndex` — all published lakes as lean proximity rows. */
export async function getLakesIndex(t: Transport) {
  const res = await call(t, { method: 'GET', path: '/feed/lakes/index', auth: 'none' }, dataSchema(z.array(lakeIndexEntrySchema)));
  return res.data;
}

/* ------------------------------------------------------------------------------------------------
 * fish services/api/lakesExplore.ts
 * ---------------------------------------------------------------------------------------------- */

/** fish `services/api/lakesExplore.ts#getLakesExploreSuggestions` */
export async function getLakesExploreSuggestions(
  t: Transport,
  params: LakesExploreSuggestionsParams = {}
): Promise<LakesExploreSuggestionsPage> {
  const res = await call(
    t,
    {
      method: 'GET',
      path: '/lakes/explore/suggestions',
      query: {
        q: params.q?.trim() || undefined,
        mode: params.mode ?? undefined,
        page: params.page,
        pageSize: params.pageSize,
        limit: params.limit,
        radiusKm: params.radiusKm,
        latitude: Number.isFinite(params.latitude) ? params.latitude : undefined,
        longitude: Number.isFinite(params.longitude) ? params.longitude : undefined,
        nearbyLakeIds: toCsv(params.nearbyLakeIds ?? []),
        ...mapFiltersToQuery(params.filters),
      },
      auth: 'none',
    },
    exploreSuggestionsResponseSchema
  );
  return { suggestions: (res.data?.suggestions ?? []).map(mapApiSuggestion), meta: res.meta };
}

/** fish `services/api/lakesExplore.ts#getLakesExploreCount` */
export async function getLakesExploreCount(t: Transport, params: LakesExploreCountParams = {}): Promise<number> {
  const res = await call(
    t,
    {
      method: 'GET',
      path: '/lakes/explore/count',
      query: { ...mapSearchToCountQuery(params.search ?? DEFAULT_LAKES_COMMITTED_SEARCH), ...mapFiltersToQuery(params.filters) },
      auth: 'none',
    },
    exploreCountResponseSchema
  );
  return res.data?.total ?? 0;
}

/* ------------------------------------------------------------------------------------------------
 * fish services/api/lakesHome.ts
 * ---------------------------------------------------------------------------------------------- */

/** fish `services/api/lakesHome.ts#getLakesHome` */
export async function getLakesHome(t: Transport, params: LakesHomeParams = {}) {
  const res = await call(
    t,
    {
      method: 'GET',
      path: '/lakes/home',
      query: {
        limit: params.limit,
        lat: Number.isFinite(params.latitude) ? params.latitude : undefined,
        lng: Number.isFinite(params.longitude) ? params.longitude : undefined,
        radiusKm: params.radiusKm,
      },
      auth: 'none',
    },
    lakesHomeResponseSchema
  );
  return res.data?.sections ?? [];
}

/** fish `services/api/lakesHome.ts#getLakesByDocumentIds` — the server returns the supplied id order. */
export async function getLakesByDocumentIds(t: Transport, documentIds: string[]) {
  if (!documentIds.length) {
    return [];
  }
  const res = await call(
    t,
    { method: 'GET', path: '/feed/lakes/by-ids', query: { ids: documentIds.join(',') }, auth: 'none' },
    z.object({ data: z.array(lakeCardSchema).nullish() })
  );
  return res.data ?? [];
}

/* ------------------------------------------------------------------------------------------------
 * fish services/api/facilities.ts, fishes.ts, publicWaters.ts
 * ---------------------------------------------------------------------------------------------- */

/** fish `services/api/facilities.ts#getFacilities` */
export async function getFacilities(t: Transport) {
  const res = await call(t, { method: 'GET', path: '/facilities', auth: 'none' }, dataSchema(z.array(facilitySchema)));
  return res.data;
}

/** fish `services/api/fishes.ts#getFishes` */
export async function getFishes(t: Transport) {
  // Strapi paginates at 25 by default — with >25 fishes the tail silently vanished (lake filters +
  // partide catalog). 100 is Strapi's maxLimit.
  const res = await call(
    t,
    { method: 'GET', path: '/fishes', query: { pagination: { pageSize: 100 } }, auth: 'none' },
    dataSchema(z.array(fishSpeciesSchema))
  );
  return res.data;
}

/**
 * fish `services/api/publicWaters.ts#getClaimedPublicWaters` — every bookable Lake associated with
 * a public water via its stable ANAR `linkCode`. Small and rarely-changing.
 */
export async function getClaimedPublicWaters(t: Transport) {
  const res = await call(
    t,
    { method: 'GET', path: '/feed/public-waters/claimed', auth: 'none' },
    z.object({ data: z.array(claimedPublicWaterSchema).nullish() })
  );
  return res.data ?? [];
}

/* ------------------------------------------------------------------------------------------------
 * fish services/api/lakeClaims.ts, lakeRequests.ts, lakeBookingInterest.ts
 * ---------------------------------------------------------------------------------------------- */

/** fish `services/api/lakeClaims.ts#createLakeClaim` — "Ești administratorul acestei bălți?" */
export async function createLakeClaim(t: Transport, input: LakeClaimInput) {
  const res = await call(
    t,
    {
      method: 'POST',
      path: '/feed/lake-claims',
      body: { data: { lake: input.lakeId, name: input.name, phone: input.phone, message: input.message } },
      auth: 'required',
    },
    dataSchema(lakeClaimResultSchema)
  );
  return res.data;
}

/** fish `services/api/lakeRequests.ts#sendLakeSuggestion` */
export function sendLakeSuggestion(t: Transport, body: LakeSuggestionRequest) {
  return call(t, { method: 'POST', path: '/lake-suggestions', body: { data: body }, auth: 'required' }, lakeSuggestionResponseSchema);
}

/** fish `services/api/lakeBookingInterest.ts#createLakeBookingInterest` — "Aș vrea să pot rezerva aici". */
export async function createLakeBookingInterest(t: Transport, input: { lakeId: string; source: LakeBookingInterestSource }) {
  const res = await call(
    t,
    {
      method: 'POST',
      path: '/feed/lake-booking-interests',
      body: { data: { lake: input.lakeId, source: input.source } },
      auth: 'required',
    },
    dataSchema(lakeBookingInterestResultSchema)
  );
  return res.data;
}

/* ------------------------------------------------------------------------------------------------
 * fish services/api/review.ts (lake reviews)
 * ---------------------------------------------------------------------------------------------- */

/** fish `services/api/review.ts#getReviewsForLake` */
export function getReviewsForLake(t: Transport, lakeId: string, { page, pageSize }: { page: number; pageSize: number }) {
  return call(
    t,
    { method: 'GET', path: `/feed/lakes/${enc(lakeId)}/reviews`, query: { page, pageSize }, auth: 'none' },
    reviewsForLakeResponseSchema
  );
}

/** fish `services/api/review.ts#postReview` */
export function postReview(t: Transport, body: ReviewReqBody, lakeId: string) {
  return call(t, { method: 'POST', path: `/lakes/${enc(lakeId)}/review`, body: { data: body }, auth: 'required' }, reviewWriteResponseSchema);
}

/** fish `services/api/review.ts#editReview` */
export function editReview(t: Transport, body: ReviewReqBody, lakeId: string) {
  return call(t, { method: 'PUT', path: `/lakes/${enc(lakeId)}/review`, body: { data: body }, auth: 'required' }, reviewWriteResponseSchema);
}

/** fish `services/api/review.ts#deleteReview` */
export function deleteReview(t: Transport, reviewId: string, lakeId: string) {
  return call(
    t,
    { method: 'DELETE', path: `/lakes/${enc(lakeId)}/review/${enc(reviewId)}`, auth: 'required' },
    reviewWriteResponseSchema
  );
}

/** fish `services/api/review.ts#getReviewForLakeByAuthorId` — the signed-in user's own review, or null. */
export async function getReviewForLakeByAuthorId(t: Transport, { lakeId }: { lakeId: string }) {
  const res = await call(
    t,
    { method: 'GET', path: '/feed/reviews/mine', query: { lakeId }, auth: 'required' },
    z.object({ data: reviewSchema.nullish() }).nullish()
  );
  return res?.data ?? null;
}

/* ------------------------------------------------------------------------------------------------
 * fish services/api/operatorStats.ts
 * ---------------------------------------------------------------------------------------------- */

/** fish `services/api/operatorStats.ts#getOwnedLakesStats` */
export async function getOwnedLakesStats(t: Transport) {
  const res = await call(t, { method: 'GET', path: '/feed/owned-lakes/stats', auth: 'required' }, dataSchema(ownedLakesStatsSchema));
  return res.data;
}

/**
 * fish `services/api/operatorStats.ts#getLakeOperatorStats` — the panel's figures are all anchored
 * to now or to today, so the only argument is the trend chart's window; omitted when no chart is
 * drawn, in which case the server skips its buckets entirely.
 */
export async function getLakeOperatorStats(t: Transport, lakeId: string, window?: OperatorStatsWindowName) {
  const res = await call(
    t,
    { method: 'GET', path: `/feed/lakes/${enc(lakeId)}/operator-stats`, query: { window }, auth: 'required' },
    dataSchema(lakeOperatorStatsSchema)
  );
  return res.data;
}
