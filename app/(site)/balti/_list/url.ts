import {
  DEFAULT_LAKES_COMMITTED_SEARCH,
  DEFAULT_NEARBY_RADIUS_KM,
  EMPTY_LAKE_FILTERS,
  getRegimeOptions,
  RATING_TIER_ORDER,
  type LakeFilterValue,
  type LakeFilterValues,
  type LakeRatingTier,
  type LakesCommittedSearch,
} from '@/core/lakes';

/*
 * The results map's state in its URL (parity lakes.results-map web_route: «/balti/harta (?q,
 * ?judet, ?localitate, ?aproape&raza, filtre în query)»). fish keeps the committed search and the
 * filters in app-session atoms shared by the home and the map (lakes.filters.c13); on the web the
 * map's URL is that shared state: the home writes it when it opens the map, the map edits it in
 * place (router.replace), and «Înapoi» to /balti drops it (lakes.results-map.c2). A link to a
 * filtered map therefore reopens the same map — the one web addition.
 *
 * The user's position is never written to the URL: nearby mode is `?aproape=1&raza=50` and the
 * page asks the browser for the position (a link shared from «În jurul meu» shows the receiver's
 * own surroundings).
 */

export const PARAM = {
  query: 'q',
  county: 'judet',
  city: 'localitate',
  nearby: 'aproape',
  radius: 'raza',
  regimes: 'regim',
  facilities: 'facilitati',
  fish: 'pesti',
  rating: 'rating',
  bookable: 'rezervari',
} as const;

/** Rating tiers in the URL, in Romanian (the CMS keys stay inside). */
const RATING_SLUG: Record<LakeRatingTier, string> = {
  excellent: 'excelent',
  very_good: 'foarte-bun',
  good: 'bun',
  acceptable: 'acceptabil',
};

const MAX_RADIUS_KM = 500;

export type LakesMapState = { search: LakesCommittedSearch; filters: LakeFilterValues };

type ParamsLike = { get(name: string): string | null };

function csv(value: string | null): string[] {
  return (value ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

/** Ids from the URL until the catalog answers: the name is the id (chips only count them). */
function idValues(ids: string[]): LakeFilterValue[] {
  return [...new Set(ids)].map((id) => ({ id, name: id, documentId: id }));
}

export function parseLakesMapParams(params: ParamsLike): LakesMapState {
  const query = params.get(PARAM.query)?.trim() ?? '';
  const countyId = params.get(PARAM.county)?.trim() || null;
  const cityId = params.get(PARAM.city)?.trim() || null;
  const nearby = params.get(PARAM.nearby) === '1';
  const radiusRaw = Number(params.get(PARAM.radius));
  const radiusKm = Number.isFinite(radiusRaw) && radiusRaw > 0 ? Math.min(Math.round(radiusRaw), MAX_RADIUS_KM) : DEFAULT_NEARBY_RADIUS_KM;

  let search: LakesCommittedSearch = DEFAULT_LAKES_COMMITTED_SEARCH;
  if (nearby) {
    search = { ...DEFAULT_LAKES_COMMITTED_SEARCH, mode: 'nearby', query: 'În jurul meu', radiusKm };
  } else if (cityId) {
    search = { ...DEFAULT_LAKES_COMMITTED_SEARCH, mode: 'city', query, countyId, cityId };
  } else if (countyId) {
    search = { ...DEFAULT_LAKES_COMMITTED_SEARCH, mode: 'county', query, county: query || null, countyId };
  }

  const regimeNames = new Set(csv(params.get(PARAM.regimes)));
  const tierSlug = params.get(PARAM.rating);
  const ratingTier = RATING_TIER_ORDER.find((tier) => RATING_SLUG[tier] === tierSlug) ?? null;
  const filters: LakeFilterValues = {
    selectedRegimes: getRegimeOptions().filter((option) => regimeNames.has(option.name)),
    selectedFacilities: idValues(csv(params.get(PARAM.facilities))),
    selectedFish: idValues(csv(params.get(PARAM.fish))),
    ratingTier,
    bookableOnly: params.get(PARAM.bookable) === '1',
  };
  return { search, filters };
}

/** The query string of a map state (no leading «?»; empty for the all-lakes map). */
export function lakesMapQuery({ search, filters }: Partial<LakesMapState>): string {
  const p = new URLSearchParams();
  if (search?.mode === 'nearby') {
    p.set(PARAM.nearby, '1');
    if (search.radiusKm && search.radiusKm !== DEFAULT_NEARBY_RADIUS_KM) p.set(PARAM.radius, String(search.radiusKm));
  } else if (search?.mode === 'county' || search?.mode === 'city') {
    if (search.query.trim()) p.set(PARAM.query, search.query.trim());
    if (search.countyId && search.mode === 'county') p.set(PARAM.county, search.countyId);
    if (search.cityId && search.mode === 'city') {
      if (search.countyId) p.set(PARAM.county, search.countyId);
      p.set(PARAM.city, search.cityId);
    }
  }
  const f = filters ?? EMPTY_LAKE_FILTERS;
  if (f.selectedRegimes.length) p.set(PARAM.regimes, f.selectedRegimes.map((v) => v.name).join(','));
  if (f.selectedFacilities.length) p.set(PARAM.facilities, f.selectedFacilities.map((v) => v.documentId).join(','));
  if (f.selectedFish.length) p.set(PARAM.fish, f.selectedFish.map((v) => v.documentId).join(','));
  if (f.ratingTier) p.set(PARAM.rating, RATING_SLUG[f.ratingTier]);
  if (f.bookableOnly) p.set(PARAM.bookable, '1');
  return p.toString();
}

/** Replaces id-only filter values (from the URL) with the catalog's names once it has answered. */
export function withCatalogNames(values: LakeFilterValue[], catalog: LakeFilterValue[]): LakeFilterValue[] {
  if (!catalog.length) return values;
  const byId = new Map(catalog.map((v) => [v.documentId, v]));
  return values.map((v) => byId.get(v.documentId) ?? v);
}

export function countLakeFilters(values: LakeFilterValues): number {
  return (
    values.selectedFish.length +
    values.selectedRegimes.length +
    values.selectedFacilities.length +
    (values.ratingTier ? 1 : 0) +
    (values.bookableOnly ? 1 : 0)
  );
}
