import { DEFAULT_NEARBY_RADIUS_KM, type LakesCommittedSearch } from './filters';

/* fish `helpers/lakesSearch.ts` */

interface Coordinate {
  latitude: number;
  longitude: number;
}

/** The lake fields these helpers read (fish types them on the legacy `Lake`). */
export type SearchableLake = {
  documentId: string;
  name: string;
  county?: string | null;
  address?: string | null;
  directions?: string | null;
  coordinates?: { lat: string; long: string } | null;
};

export interface NearbyLakeResult<L extends SearchableLake = SearchableLake> {
  lake: L;
  distanceKm: number;
}

const EARTH_RADIUS_KM = 6371;

export function normalizeSearchText(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function parseLakeCoordinate(lake: SearchableLake): Coordinate | null {
  const latitude = Number(lake.coordinates?.lat);
  const longitude = Number(lake.coordinates?.long);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }
  return { latitude, longitude };
}

function includesNormalized(haystack: string | null | undefined, needle: string): boolean {
  if (!needle) {
    return true;
  }
  return normalizeSearchText(haystack ?? '').includes(needle);
}

function matchesLakeTextQuery(lake: SearchableLake, normalizedQuery: string): boolean {
  return (
    includesNormalized(lake.name, normalizedQuery) ||
    includesNormalized(lake.county, normalizedQuery) ||
    includesNormalized(lake.address, normalizedQuery) ||
    includesNormalized(lake.directions, normalizedQuery)
  );
}

/** Haversine distance in km. */
export function getDistanceKm(a: Coordinate, b: Coordinate): number {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const haversineA =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  const haversineC = 2 * Math.atan2(Math.sqrt(haversineA), Math.sqrt(1 - haversineA));
  return EARTH_RADIUS_KM * haversineC;
}

export function getNearbyLakes<L extends SearchableLake>(
  lakes: L[],
  userLocation: Coordinate,
  radiusKm = DEFAULT_NEARBY_RADIUS_KM
): NearbyLakeResult<L>[] {
  return lakes
    .map(lake => {
      const coordinate = parseLakeCoordinate(lake);
      if (!coordinate) {
        return null;
      }
      return { lake, distanceKm: getDistanceKm(userLocation, coordinate) };
    })
    .filter((item): item is NearbyLakeResult<L> => Boolean(item))
    .filter(item => item.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

export function formatNearbyDistanceKm(distanceKm: number): string | null {
  if (!Number.isFinite(distanceKm)) {
    return null;
  }
  if (distanceKm < 10) {
    return `${distanceKm.toFixed(1)} km`;
  }
  return `${Math.round(distanceKm)} km`;
}

export function buildNearbyDistanceLabelMap(
  lakes: SearchableLake[],
  userLocation: Coordinate | null
): Record<string, string> {
  if (!userLocation) {
    return {};
  }
  return lakes.reduce<Record<string, string>>((accumulator, lake) => {
    const coordinate = parseLakeCoordinate(lake);
    if (!coordinate) {
      return accumulator;
    }
    const distanceLabel = formatNearbyDistanceKm(getDistanceKm(userLocation, coordinate));
    if (!distanceLabel) {
      return accumulator;
    }
    accumulator[lake.documentId] = distanceLabel;
    return accumulator;
  }, {});
}

export function applyCommittedLakesSearch<L extends SearchableLake>(lakes: L[], committedSearch: LakesCommittedSearch): L[] {
  if (!committedSearch.mode) {
    return lakes;
  }

  if (committedSearch.mode === 'nearby') {
    if (!committedSearch.nearbyLakeIds.length) {
      return [];
    }
    const nearbyIndexMap = new Map(committedSearch.nearbyLakeIds.map((id, index) => [id, index]));
    return lakes
      .filter(lake => nearbyIndexMap.has(lake.documentId))
      .sort((a, b) => (nearbyIndexMap.get(a.documentId) ?? 9999) - (nearbyIndexMap.get(b.documentId) ?? 9999));
  }

  const normalizedQuery = normalizeSearchText(committedSearch.query);
  if (!normalizedQuery) {
    return lakes;
  }

  if (committedSearch.mode === 'county') {
    const normalizedCounty = normalizeSearchText(committedSearch.county ?? committedSearch.query);
    return lakes.filter(lake => normalizeSearchText(lake.county ?? '') === normalizedCounty);
  }

  if (committedSearch.mode === 'city') {
    const normalizedCity = normalizeSearchText(committedSearch.query);
    return lakes.filter(lake => {
      if (normalizeSearchText(lake.address ?? '') === normalizedCity) {
        return true;
      }
      return normalizeSearchText(lake.address ?? '').includes(normalizedCity);
    });
  }

  if (committedSearch.mode === 'lake') {
    if (committedSearch.lakeId) {
      return lakes.filter(lake => lake.documentId === committedSearch.lakeId);
    }
    return lakes.filter(lake => normalizeSearchText(lake.name) === normalizedQuery);
  }

  return lakes.filter(lake => matchesLakeTextQuery(lake, normalizedQuery));
}

export function formatLakePriceRange(priceMin: number | null | undefined, priceMax: number | null | undefined): string | null {
  if (priceMin == null && priceMax == null) return null;
  if (priceMin != null && priceMax != null) {
    if (priceMin === priceMax) return `${priceMin} lei`;
    return `${priceMin}–${priceMax} lei`;
  }
  const value = priceMin ?? priceMax;
  return `de la ${value} lei`;
}

export function getLakesSearchSummary(committedSearch: LakesCommittedSearch): string {
  if (committedSearch.mode === 'nearby') {
    return `În jurul meu · ${committedSearch.radiusKm || DEFAULT_NEARBY_RADIUS_KM}km`;
  }
  if (committedSearch.query.trim()) {
    return committedSearch.query;
  }
  return 'Caută bălți, lacuri...';
}

/* fish `helpers/getLakeLocationSubtitle.ts` */

export type LakeLocationInput = {
  address?: string | null;
  county?: string | null;
  countyRef?: { name?: string | null } | null;
  cityRef?: { name?: string | null } | null;
};

function trimOrNull(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** "address, city, county" — county falls back from the relation to the legacy free-text column. */
export function getLakeLocationSubtitle(
  lake: LakeLocationInput,
  options: { includeAddress?: boolean } = {}
): string | null {
  const { includeAddress = true } = options;
  const city = trimOrNull(lake.cityRef?.name ?? null);
  const county = trimOrNull(lake.countyRef?.name ?? null) ?? trimOrNull(lake.county ?? null);
  const address = includeAddress ? trimOrNull(lake.address ?? null) : null;
  const parts = [address, city, county].filter((p): p is string => Boolean(p));
  return parts.length > 0 ? parts.join(', ') : null;
}

/* fish `features/lakes/helpers/recentViewedLakes.ts` — the list logic, minus AsyncStorage */

export const MAX_RECENT_VIEWED_LAKE_IDS = 10;

/** Parses a stored recent-viewed list (a JSON string array), keeping the newest 10. */
export function parseRecentViewedLakeIds(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(item => `${item}`.trim())
      .filter(Boolean)
      .slice(-MAX_RECENT_VIEWED_LAKE_IDS);
  } catch {
    return [];
  }
}

/** The list after viewing `lakeId`: moved to the end (newest), deduplicated, capped at 10. */
export function pushRecentViewedLakeId(current: string[], lakeId: string): string[] {
  const normalizedId = lakeId.trim();
  if (!normalizedId) return current;
  return [...current.filter(id => id !== normalizedId), normalizedId].slice(-MAX_RECENT_VIEWED_LAKE_IDS);
}
