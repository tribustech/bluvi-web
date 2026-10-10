import type { Bbox } from '../schemas';
import { mapSearchToScopeQuery, type LakeFilterValues, type LakesCommittedSearch } from './filters';

/**
 * Query-key signatures, ported verbatim from the fish hooks that build them. The key IS the cache
 * identity, so a drift here splits (or merges) cache entries the mobile app keeps apart.
 */

/** fish `useLakesHome.ts#UseLakesHomeParams` (= `GetHomeParams`). */
export interface LakesHomeParams {
  limit?: number;
  latitude?: number | null;
  longitude?: number | null;
  radiusKm?: number;
}

/** fish `useLakesHome.ts#makeLakesHomeSignature`. */
export function makeLakesHomeSignature(params: LakesHomeParams): string {
  return JSON.stringify({
    limit: params.limit ?? 10,
    latitude: params.latitude ?? null,
    longitude: params.longitude ?? null,
    radiusKm: params.radiusKm ?? 50,
  });
}

/** fish `lakesExplore.ts#GetLakesExploreCountParams`. */
export interface LakesExploreCountParams {
  search?: LakesCommittedSearch;
  filters?: LakeFilterValues;
}

/** fish `useLakesExploreCount.ts#makeSignature`. */
export function makeLakesExploreCountSignature(params: LakesExploreCountParams): string {
  return JSON.stringify({
    mode: params.search?.mode ?? null,
    q: params.search?.query?.trim() ?? '',
    countyId: params.search?.countyId ?? null,
    cityId: params.search?.cityId ?? null,
    lakeId: params.search?.lakeId ?? null,
    nearbyLakeIds: params.search?.nearbyLakeIds ?? [],
    latitude: params.search?.latitude ?? null,
    longitude: params.search?.longitude ?? null,
    radiusKm: params.search?.radiusKm ?? null,
    facilities: params.filters?.selectedFacilities.map(item => item.documentId).sort() ?? [],
    fishes: params.filters?.selectedFish.map(item => item.documentId).sort() ?? [],
    regimes: params.filters?.selectedRegimes.map(item => item.name).sort() ?? [],
    ratingTier: params.filters?.ratingTier ?? null,
    bookableOnly: params.filters?.bookableOnly ?? false,
  });
}

/** fish `lakesExplore.ts#GetLakesExploreSuggestionsParams`. */
export interface LakesExploreSuggestionsParams {
  mode?: LakesCommittedSearch['mode'];
  q?: string;
  page?: number;
  pageSize?: number;
  limit?: number;
  radiusKm?: number;
  latitude?: number | null;
  longitude?: number | null;
  nearbyLakeIds?: string[];
  filters?: LakeFilterValues;
}

/** fish `useLakesExploreSuggestions.ts#makeSignature`. */
export function makeLakesExploreSuggestionsSignature(params: LakesExploreSuggestionsParams): string {
  return JSON.stringify({
    mode: params.mode ?? null,
    q: params.q?.trim() || '',
    radiusKm: params.radiusKm ?? null,
    latitude: params.latitude ?? null,
    longitude: params.longitude ?? null,
    nearbyLakeIds: params.nearbyLakeIds ?? [],
    facilities: params.filters?.selectedFacilities.map(item => item.documentId).sort() ?? [],
    fishes: params.filters?.selectedFish.map(item => item.documentId).sort() ?? [],
    regimes: params.filters?.selectedRegimes.map(item => item.name).sort() ?? [],
    ratingTier: params.filters?.ratingTier ?? null,
    bookableOnly: params.filters?.bookableOnly ?? false,
  });
}

const BBOX_BUCKET_DEG = 0.05;

function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

/** fish `useLakesInBbox.ts#bboxListBucketKey` — 0.05° buckets so a tiny pan reuses the entry. */
export function bboxListBucketKey(bbox: Bbox): string {
  return [
    roundTo(bbox.north, BBOX_BUCKET_DEG),
    roundTo(bbox.south, BBOX_BUCKET_DEG),
    roundTo(bbox.east, BBOX_BUCKET_DEG),
    roundTo(bbox.west, BBOX_BUCKET_DEG),
  ].join('|');
}

/** fish `useMapClusters.ts#bboxBucketKey` — same buckets, prefixed by the zoom. */
export function bboxBucketKey(bbox: Bbox | null, zoom: number): string {
  if (!bbox) return 'none';
  const round = (value: number) => Math.round(value / 0.05) * 0.05;
  return `${zoom}|${round(bbox.north)}|${round(bbox.south)}|${round(bbox.east)}|${round(bbox.west)}`;
}

/** fish `useLakesInBbox.ts#UseLakesInBboxParams`. */
export interface LakesInBboxQueryParams {
  bbox: Bbox | null;
  filters: LakeFilterValues;
  /** `countyId` / `cityId` scope the read on a county / city search (`mapSearchToScopeQuery`). */
  committedSearch: Pick<LakesCommittedSearch, 'mode'> & Partial<Pick<LakesCommittedSearch, 'countyId' | 'cityId'>>;
  enabled: boolean;
}

/** fish `useLakesInBbox.ts#makeLakesInBboxSignature`. */
export function makeLakesInBboxSignature(params: LakesInBboxQueryParams): string {
  return JSON.stringify({
    bbox: params.bbox ? bboxListBucketKey(params.bbox) : null,
    facilities: params.filters.selectedFacilities.map(f => f.documentId).sort(),
    fishes: params.filters.selectedFish.map(f => f.documentId).sort(),
    regimes: params.filters.selectedRegimes.map(r => r.name).sort(),
    ratingTier: params.filters.ratingTier ?? null,
    bookableOnly: params.filters.bookableOnly,
    mode: params.committedSearch.mode ?? null,
    // Web-only: the scope is a request param, so it is part of the key.
    scope: mapSearchToScopeQuery(params.committedSearch),
  });
}
