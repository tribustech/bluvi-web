import type { Bbox } from '../schemas';
import { DEFAULT_NEARBY_RADIUS_KM, type LakesCommittedSearch } from './filters';
import type { MapRegion } from './publicWaterMap';

/*
 * The results map's camera logic — fish `features/lakes/helpers/getMapFocusRegion.ts`,
 * `features/lakes/helpers/clusterTargetRegion.ts` and the region helpers of
 * `features/lakes/components/LakesResultsWithMap.tsx` (getMapBounds, getZoomFromRegion,
 * deltaFromRadiusKm, the locate ladder). Regions are react-native-maps' shape (centre + deltas);
 * a web map converts them with `regionToBbox`.
 */

/** fish `getMapFocusRegion.ts#FocusBbox` (= the CMS focus-bbox / cluster bbox). */
export type FocusBbox = Bbox;

const LAKE_MODE_DELTA = 0.015;
const MIN_DELTA = 0.02;
const PAD_RATIO = 0.1;

/**
 * Full-country overview. Used as the focus region for searches with no geographic anchor
 * (all-lakes / free-text / filters-only) so the map zooms out to show the whole result set.
 * Romania spans ~20°E–30°E (≈9.5° wide) and ~43.6°N–48.3°N (≈4.7° tall), so the longitude
 * delta must be ~10 to fit the whole country's width.
 */
export const COUNTRY_OVERVIEW_REGION: MapRegion = {
  latitude: 45.9432,
  longitude: 24.9668,
  latitudeDelta: 6,
  longitudeDelta: 10,
};

/**
 * A search "targets a place" when it resolves to a specific map region (a county/city bbox, a
 * lake's coordinates, or the user's nearby area). All-lakes / free-text / filters-only searches
 * have no such anchor and fall back to the country overview.
 */
export function isGeographicSearchMode(mode: LakesCommittedSearch['mode']): boolean {
  return mode === 'county' || mode === 'city' || mode === 'lake' || mode === 'nearby';
}

function bboxToRegion(bbox: FocusBbox): MapRegion {
  const latSpan = Math.max(bbox.north - bbox.south, 0);
  const lonSpan = Math.max(bbox.east - bbox.west, 0);
  const paddedLat = latSpan * (1 + 2 * PAD_RATIO);
  const paddedLon = lonSpan * (1 + 2 * PAD_RATIO);
  return {
    latitude: (bbox.north + bbox.south) / 2,
    longitude: (bbox.east + bbox.west) / 2,
    latitudeDelta: Math.max(paddedLat, MIN_DELTA),
    longitudeDelta: Math.max(paddedLon, MIN_DELTA),
  };
}

/** fish `LakesResultsWithMap.tsx#deltaFromRadiusKm` — a square of `km` around a point, as deltas. */
export function deltaFromRadiusKm(km: number, latitude: number): Pick<MapRegion, 'latitudeDelta' | 'longitudeDelta'> {
  const latDelta = km / 111;
  const lonDelta = km / (111 * Math.max(Math.cos((latitude * Math.PI) / 180), 0.1));
  return { latitudeDelta: latDelta * 2, longitudeDelta: lonDelta * 2 };
}

/** fish `getMapFocusRegion` — null when the search has no region (yet). */
export function getMapFocusRegion(params: {
  committedSearch: LakesCommittedSearch;
  countyBbox: FocusBbox | null | undefined;
  userLocation: { latitude: number; longitude: number } | null;
}): MapRegion | null {
  const { committedSearch: s, countyBbox, userLocation } = params;
  switch (s.mode) {
    case 'county':
    case 'city':
      return countyBbox ? bboxToRegion(countyBbox) : null;
    case 'lake':
      if (s.latitude == null || s.longitude == null) return null;
      return { latitude: s.latitude, longitude: s.longitude, latitudeDelta: LAKE_MODE_DELTA, longitudeDelta: LAKE_MODE_DELTA };
    case 'nearby': {
      const loc =
        userLocation ?? (s.latitude != null && s.longitude != null ? { latitude: s.latitude, longitude: s.longitude } : null);
      if (!loc) return null;
      return { latitude: loc.latitude, longitude: loc.longitude, ...deltaFromRadiusKm(s.radiusKm || DEFAULT_NEARBY_RADIUS_KM, loc.latitude) };
    }
    default:
      return null;
  }
}

/**
 * fish `app/(app)/(tabs)/lakes/index.tsx#focusRegion` — the region the results map frames for a
 * committed search, or null while it must wait:
 * - a geographic search frames its region (getMapFocusRegion);
 * - a search with no geographic anchor frames the country overview;
 * - a county / city search waits for its bbox — unless the bbox read failed (or a lake / nearby
 *   search can never resolve), then it falls back to the country overview so the screen is never
 *   stuck on the skeleton; results stay scoped by the search either way.
 */
export function resolveMapFocusRegion(params: {
  committedSearch: LakesCommittedSearch;
  countyBbox: FocusBbox | null | undefined;
  countyBboxFailed: boolean;
  userLocation: { latitude: number; longitude: number } | null;
  /** nearby only: the position is still being resolved — wait instead of falling back. */
  locating?: boolean;
}): MapRegion | null {
  const region = getMapFocusRegion(params);
  if (region) return region;
  const mode = params.committedSearch.mode;
  if (!isGeographicSearchMode(mode)) return COUNTRY_OVERVIEW_REGION;
  const bboxStillResolving = (mode === 'county' || mode === 'city') && !params.countyBboxFailed;
  if (bboxStillResolving) return null;
  if (mode === 'nearby' && params.locating) return null;
  return COUNTRY_OVERVIEW_REGION;
}

/** fish `getFocusSignature` — the nonce re-runs the same framing (re-applying the same search). */
export function getFocusSignature(search: LakesCommittedSearch, nonce: number): string {
  return [
    search.mode ?? 'none',
    search.countyId ?? '',
    search.cityId ?? '',
    search.lakeId ?? '',
    search.latitude ?? '',
    search.longitude ?? '',
    search.radiusKm,
    nonce,
  ].join('|');
}

/** fish `LakesResultsWithMap.tsx#getMapBounds`. */
export function regionToBbox(region: MapRegion): Bbox {
  return {
    north: region.latitude + region.latitudeDelta / 2,
    south: region.latitude - region.latitudeDelta / 2,
    east: region.longitude + region.longitudeDelta / 2,
    west: region.longitude - region.longitudeDelta / 2,
  };
}

/** The inverse of `regionToBbox`. */
export function bboxToMapRegion(bbox: Bbox): MapRegion {
  return {
    latitude: (bbox.north + bbox.south) / 2,
    longitude: (bbox.east + bbox.west) / 2,
    latitudeDelta: Math.max(bbox.north - bbox.south, 0),
    longitudeDelta: Math.max(bbox.east - bbox.west, 0),
  };
}

/** fish `LakesResultsWithMap.tsx#getZoomFromRegion` — the zoom the CMS clusters are computed at. */
export function getZoomFromRegion(region: Pick<MapRegion, 'longitudeDelta'>): number {
  const rawZoom = Math.log2(360 / Math.max(region.longitudeDelta, 0.0001));
  return Math.max(0, Math.min(22, Math.round(rawZoom)));
}

/* fish `features/lakes/helpers/clusterTargetRegion.ts` */

export const CLUSTER_PADDING_FACTOR = 1.4;
export const CLUSTER_MAX_ZOOM_IN_LEVELS = 2;
export const CLUSTER_MIN_DELTA = 0.0005;

/** Where a cluster tap goes: its bbox padded ×1.4, never more than 2 zoom levels in at once. */
export function computeClusterTargetRegion(clusterBbox: Bbox, currentRegion: MapRegion): MapRegion {
  const latitude = (clusterBbox.north + clusterBbox.south) / 2;
  const longitude = (clusterBbox.east + clusterBbox.west) / 2;
  const paddedLatDelta = (clusterBbox.north - clusterBbox.south) * CLUSTER_PADDING_FACTOR;
  const paddedLonDelta = (clusterBbox.east - clusterBbox.west) * CLUSTER_PADDING_FACTOR;
  const maxZoomInDivisor = 2 ** CLUSTER_MAX_ZOOM_IN_LEVELS;
  const minLatDelta = Math.max(currentRegion.latitudeDelta / maxZoomInDivisor, CLUSTER_MIN_DELTA);
  const minLonDelta = Math.max(currentRegion.longitudeDelta / maxZoomInDivisor, CLUSTER_MIN_DELTA);
  return {
    latitude,
    longitude,
    latitudeDelta: Math.max(paddedLatDelta, minLatDelta),
    longitudeDelta: Math.max(paddedLonDelta, minLonDelta),
  };
}

/* fish `LakesResultsWithMap.tsx#handleLocatePress` — the progressive locate zoom */

export const LOCATE_START_MAX_KM = 20;
export const LOCATE_STEP_KM = 5;
export const LOCATE_MIN_KM = 5;

/**
 * The radius the next «Locația mea» press frames: the first press min(radius, 20) km around the
 * user; while the map is still centred on them each press tightens by 5 km down to 5 km. A pan
 * away (`centeredOnUser` false, or no previous radius) starts the ladder again.
 */
export function nextLocateRadiusKm(params: { previousKm: number | null; centeredOnUser: boolean; nearbyRadiusKm: number }): number {
  const startKm = Math.min(params.nearbyRadiusKm, LOCATE_START_MAX_KM);
  return params.centeredOnUser && params.previousKm != null ? Math.max(LOCATE_MIN_KM, params.previousKm - LOCATE_STEP_KM) : startKm;
}

/** fish: the map counts as «centred on the user» when they are within 20% of the deltas of its centre. */
export function isRegionCenteredOn(region: MapRegion, point: { latitude: number; longitude: number }): boolean {
  return (
    Math.abs(region.latitude - point.latitude) < region.latitudeDelta * 0.2 &&
    Math.abs(region.longitude - point.longitude) < region.longitudeDelta * 0.2
  );
}
