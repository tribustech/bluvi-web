import type { Facility, FishSpecies, LakesSearchSuggestion } from '../schemas';

/* fish `features/lakes/models/lake-filters.types.ts` */

export type LakeFilterValue = { id: string; name: string; documentId: string };

export type LakeRatingTier = 'excellent' | 'very_good' | 'good' | 'acceptable';

export type LakeFilterValues = {
  selectedFish: LakeFilterValue[];
  selectedRegimes: LakeFilterValue[];
  selectedFacilities: LakeFilterValue[];
  ratingTier: LakeRatingTier | null;
  /** Only lakes with online booking enabled (Lake.bookingEnabled). */
  bookableOnly: boolean;
};

export const EMPTY_LAKE_FILTERS: LakeFilterValues = {
  selectedFish: [],
  selectedRegimes: [],
  selectedFacilities: [],
  ratingTier: null,
  bookableOnly: false,
};

/* fish `features/lakes/models/lakes-search.types.ts` */

export type LakesSearchMode = 'text' | 'county' | 'city' | 'lake' | 'nearby';

export const DEFAULT_NEARBY_RADIUS_KM = 50;

export interface LakesCommittedSearch {
  mode: LakesSearchMode | null;
  query: string;
  county: string | null;
  countyId: string | null;
  cityId: string | null;
  lakeId: string | null;
  nearbyLakeIds: string[];
  latitude: number | null;
  longitude: number | null;
  radiusKm: number;
}

export const DEFAULT_LAKES_COMMITTED_SEARCH: LakesCommittedSearch = {
  mode: null,
  query: '',
  county: null,
  countyId: null,
  cityId: null,
  lakeId: null,
  nearbyLakeIds: [],
  latitude: null,
  longitude: null,
  radiusKm: DEFAULT_NEARBY_RADIUS_KM,
};

/* fish `services/api/lakes.ts` + `lakesExplore.ts` — filter → query-param builders */

export function toCsv(values: string[]): string | undefined {
  if (!values.length) {
    return undefined;
  }
  return values.join(',');
}

export interface ExploreFilterQuery {
  facilityIds?: string;
  fishIds?: string;
  regimes?: string;
  ratingTier?: LakeRatingTier;
  bookable?: 'true';
}

/**
 * fish `lakes.ts#mapFiltersToClusterQuery` and `lakesExplore.ts#mapFiltersToQuery` — the two are
 * the same mapping (ids/names as csv, rating tier, bookable flag), so one function serves both.
 */
export function mapFiltersToQuery(filters?: LakeFilterValues): ExploreFilterQuery {
  return {
    facilityIds: toCsv(filters?.selectedFacilities.map(item => item.documentId) ?? []),
    fishIds: toCsv(filters?.selectedFish.map(item => item.documentId) ?? []),
    regimes: toCsv(filters?.selectedRegimes.map(item => item.name) ?? []),
    ratingTier: filters?.ratingTier ?? undefined,
    bookable: filters?.bookableOnly ? ('true' as const) : undefined,
  };
}

/** fish `lakesExplore.ts#mapSearchToCountQuery`. */
export function mapSearchToCountQuery(search?: LakesCommittedSearch) {
  const safeSearch = search ?? DEFAULT_LAKES_COMMITTED_SEARCH;
  return {
    mode: safeSearch.mode ?? undefined,
    q: safeSearch.query.trim() || undefined,
    countyId: safeSearch.countyId ?? undefined,
    cityId: safeSearch.cityId ?? undefined,
    lakeId: safeSearch.lakeId ?? undefined,
    nearbyLakeIds: toCsv(safeSearch.nearbyLakeIds),
    latitude: Number.isFinite(safeSearch.latitude) ? (safeSearch.latitude as number) : undefined,
    longitude: Number.isFinite(safeSearch.longitude) ? (safeSearch.longitude as number) : undefined,
    radiusKm: safeSearch.radiusKm || undefined,
  };
}

/** fish `lakesExplore.ts#mapApiSuggestion` — copies the known fields only. */
export function mapApiSuggestion(suggestion: LakesSearchSuggestion): LakesSearchSuggestion {
  return {
    id: suggestion.id,
    type: suggestion.type,
    title: suggestion.title,
    subtitle: suggestion.subtitle,
    icon: suggestion.icon,
    color: suggestion.color,
    county: suggestion.county,
    countyId: suggestion.countyId,
    cityId: suggestion.cityId,
    lakeId: suggestion.lakeId,
    latitude: suggestion.latitude,
    longitude: suggestion.longitude,
  };
}

/* fish `features/lakes/helpers/lakeFilterOptions.ts` */

export function mapFacilitiesToFilterValues(facilities: Facility[] | null | undefined): LakeFilterValue[] {
  return (
    facilities?.map(facility => ({ id: facility.documentId, name: facility.name, documentId: facility.documentId })) ??
    []
  );
}

export function mapFishToFilterValues(fishes: FishSpecies[] | null | undefined): LakeFilterValue[] {
  return fishes?.map(fish => ({ id: fish.documentId, name: fish.Name, documentId: fish.documentId })) ?? [];
}

export function getRegimeOptions(): LakeFilterValue[] {
  return [
    { id: '1', name: 'C&R', documentId: '1' },
    { id: '2', name: 'Retinere', documentId: '2' },
    { id: '3', name: 'C&R + Retinere', documentId: '3' },
  ];
}

/* fish `features/lakes/helpers/lakesWizardSummaries.ts` */

/** Strictest first — the order the picker lists them in. */
export const RATING_TIER_ORDER: LakeRatingTier[] = ['excellent', 'very_good', 'good', 'acceptable'];

const RATING_TIER_LABELS: Record<LakeRatingTier, string> = {
  excellent: 'Excelent',
  very_good: 'Foarte bun',
  good: 'Bun',
  acceptable: 'Acceptabil',
};

/** Mirrors `minRatingForTier` in the CMS (`src/api/lake/utils/rating-tier.ts`). */
const RATING_TIER_THRESHOLDS: Record<LakeRatingTier, string> = {
  excellent: '4,5+',
  very_good: '4,0+',
  good: '3,5+',
  acceptable: '3,0+',
};

export function getRatingTierLabel(ratingTier: LakeRatingTier): string {
  return RATING_TIER_LABELS[ratingTier];
}

export function getRatingTierThresholdLabel(ratingTier: LakeRatingTier): string {
  return RATING_TIER_THRESHOLDS[ratingTier];
}

/** Picker row label — the threshold carries the meaning, the word backs it up. */
export function getRatingTierOptionLabel(ratingTier: LakeRatingTier): string {
  return `${RATING_TIER_THRESHOLDS[ratingTier]} · ${RATING_TIER_LABELS[ratingTier]}`;
}

/* fish `features/lakes/helpers/lakeFilterChips.ts` */

export type LakeFilterSection = 'regime' | 'fish' | 'facilities' | 'rating' | 'booking' | 'all';

export interface LakeFilterChipState {
  key: Exclude<LakeFilterSection, 'all'>;
  label: string;
  active: boolean;
  badgeCount?: number;
}

/**
 * Chip-rail state for the Bălți map chrome: one chip per filter section. Multi-select sections show
 * their count; the single-select rating chip shows the tier label. The booking chip is a plain
 * on/off toggle (no picker) and Pești sits last: it is the longest vocabulary and the least often
 * reached for.
 */
export function getLakeFilterChips(filters: LakeFilterValues): LakeFilterChipState[] {
  const multi = (key: 'regime' | 'fish' | 'facilities', label: string, count: number): LakeFilterChipState => ({
    key,
    label,
    active: count > 0,
    ...(count > 0 ? { badgeCount: count } : {}),
  });
  return [
    multi('regime', 'Regim', filters.selectedRegimes.length),
    multi('facilities', 'Facilități', filters.selectedFacilities.length),
    {
      key: 'rating',
      label: filters.ratingTier ? getRatingTierLabel(filters.ratingTier) : 'Rating',
      active: filters.ratingTier != null,
    },
    { key: 'booking', label: 'Rezervări', active: filters.bookableOnly },
    multi('fish', 'Pești', filters.selectedFish.length),
  ];
}

/* fish `features/lakes/helpers/suggestionToCommittedSearch.ts` */

const EMPTY_PARTS = {
  county: null,
  countyId: null,
  cityId: null,
  lakeId: null,
  nearbyLakeIds: [] as string[],
  latitude: null,
  longitude: null,
  radiusKm: DEFAULT_NEARBY_RADIUS_KM,
};

/**
 * Committed search for a picked suggestion — the same mappings the retired wizard used.
 * Returns null for 'nearby': the caller must resolve the device location first and then
 * build the search with nearbyCommittedSearch().
 */
export function suggestionToCommittedSearch(s: LakesSearchSuggestion): LakesCommittedSearch | null {
  if (s.type === 'county') {
    return { ...EMPTY_PARTS, mode: 'county', query: s.title, county: s.county ?? s.title, countyId: s.countyId ?? null };
  }
  if (s.type === 'city') {
    return {
      ...EMPTY_PARTS,
      mode: 'city',
      query: s.title,
      county: s.county ?? null,
      countyId: s.countyId ?? null,
      cityId: s.cityId ?? null,
    };
  }
  if (s.type === 'lake') {
    return {
      ...EMPTY_PARTS,
      mode: 'lake',
      query: s.title,
      lakeId: s.lakeId ?? null,
      latitude: s.latitude ?? null,
      longitude: s.longitude ?? null,
    };
  }
  return null;
}

export function nearbyCommittedSearch(latitude: number, longitude: number): LakesCommittedSearch {
  return { ...EMPTY_PARTS, mode: 'nearby', query: 'În jurul meu', latitude, longitude };
}
