import { describe, expect, it } from 'vitest';
import type { LakeHomeSection, LegacyLake, NearbyLakeHomeSection } from '../schemas';
import {
  DEFAULT_LAKES_COMMITTED_SEARCH,
  DEFAULT_NEARBY_RADIUS_KM,
  EMPTY_LAKE_FILTERS,
  getLakeFilterChips,
  getRatingTierLabel,
  getRatingTierOptionLabel,
  getRegimeOptions,
  mapApiSuggestion,
  mapFacilitiesToFilterValues,
  mapFishToFilterValues,
  nearbyCommittedSearch,
  suggestionToCommittedSearch,
  type LakeFilterValues,
  type LakesCommittedSearch,
} from './filters';
import { buildLakesHomeSections, getLakesHomeCardPresentation, getTotalLakesInSections } from './homeSections';
import { formatWaterDistance, publicWaterAreaHaLabel, publicWaterFilterToTypes, publicWaterLocationLabel, waterDistanceKm } from './publicWaters';
import { calculateOptimisticReviewMeta, formatReviewsCount, getLakeRatingDisplay, toClaimedPublicWatersMap } from './reviews';
import {
  applyCommittedLakesSearch,
  buildNearbyDistanceLabelMap,
  formatLakePriceRange,
  formatNearbyDistanceKm,
  getDistanceKm,
  getLakeLocationSubtitle,
  getLakesSearchSummary,
  getNearbyLakes,
  normalizeSearchText,
  parseRecentViewedLakeIds,
  pushRecentViewedLakeId,
} from './search';
import {
  bboxBucketKey,
  makeLakesExploreCountSignature,
  makeLakesExploreSuggestionsSignature,
  makeLakesHomeSignature,
  makeLakesInBboxSignature,
} from './signatures';

const lake = (documentId: string, extra: Partial<LegacyLake> = {}): LegacyLake => ({ documentId, name: documentId, ...extra });

/* fish helpers/__tests__/lakesSearch.test.ts */
describe('lakesSearch helpers', () => {
  const lakes = [
    lake('brasov-lake', { name: 'Lacul Nou Brașov', county: 'Brașov', address: 'Brașov', coordinates: { lat: '45.6600', long: '25.6100' } }),
    lake('prejmer-lake', { name: 'Balta Prejmer', county: 'Brașov', address: 'Prejmer', coordinates: { lat: '45.7200', long: '25.7800' } }),
    lake('timis-lake', { name: 'Lacul Banat', county: 'Timiș', address: 'Timișoara', coordinates: { lat: '45.7489', long: '21.2087' } }),
  ];

  it('normalizes diacritics and case', () => {
    expect(normalizeSearchText('  Brașov  ')).toBe('brasov');
    expect(normalizeSearchText('TÎMIȘ')).toBe('timis');
  });

  it('computes haversine distance', () => {
    const distance = getDistanceKm({ latitude: 44.4268, longitude: 26.1025 }, { latitude: 45.658, longitude: 25.6012 });
    expect(distance).toBeGreaterThan(120);
    expect(distance).toBeLessThan(160);
  });

  it('returns nearby lakes inside radius sorted by distance', () => {
    const result = getNearbyLakes(lakes, { latitude: 45.66, longitude: 25.61 }, 50);
    expect(result.map(item => item.lake.documentId)).toEqual(['brasov-lake', 'prejmer-lake']);
    expect(result[0].distanceKm).toBeLessThan(result[1].distanceKm);
  });

  it('formats nearby distances for card display', () => {
    expect(formatNearbyDistanceKm(3.36)).toBe('3.4 km');
    expect(formatNearbyDistanceKm(9.95)).toBe('9.9 km');
    expect(formatNearbyDistanceKm(10.1)).toBe('10 km');
    expect(formatNearbyDistanceKm(Number.NaN)).toBeNull();
  });

  it('builds nearby distance labels and skips invalid coordinates', () => {
    const invalid = lake('invalid-lake', { coordinates: { lat: 'abc', long: '25.65' } });
    const labels = buildNearbyDistanceLabelMap([lakes[0], invalid], { latitude: 45.66, longitude: 25.61 });
    expect(labels['brasov-lake']).toBe('0.0 km');
    expect(labels['invalid-lake']).toBeUndefined();
    expect(buildNearbyDistanceLabelMap(lakes, null)).toEqual({});
  });

  it('applies county, city, lake and nearby committed modes', () => {
    const base = DEFAULT_LAKES_COMMITTED_SEARCH;
    const countySearch: LakesCommittedSearch = { ...base, mode: 'county', query: 'brasov', county: 'Brașov' };
    const citySearch: LakesCommittedSearch = { ...base, mode: 'city', query: 'prejmer', cityId: 'city-prejmer' };
    const lakeSearch: LakesCommittedSearch = { ...base, mode: 'lake', query: 'Lacul Nou Brașov', lakeId: 'brasov-lake' };
    const nearbySearch: LakesCommittedSearch = { ...base, mode: 'nearby', query: 'În jurul meu', nearbyLakeIds: ['prejmer-lake', 'brasov-lake'] };
    const ids = (s: LakesCommittedSearch) => applyCommittedLakesSearch(lakes, s).map(item => item.documentId);
    expect(ids(countySearch)).toEqual(['brasov-lake', 'prejmer-lake']);
    expect(ids(citySearch)).toEqual(['prejmer-lake']);
    expect(ids(lakeSearch)).toEqual(['brasov-lake']);
    expect(ids(nearbySearch)).toEqual(['prejmer-lake', 'brasov-lake']);
    expect(ids(base)).toHaveLength(3);
  });

  it('summarises the committed search', () => {
    expect(getLakesSearchSummary({ ...DEFAULT_LAKES_COMMITTED_SEARCH, mode: 'nearby' })).toBe('În jurul meu · 50km');
    expect(getLakesSearchSummary({ ...DEFAULT_LAKES_COMMITTED_SEARCH, query: 'Cluj' })).toBe('Cluj');
    expect(getLakesSearchSummary(DEFAULT_LAKES_COMMITTED_SEARCH)).toBe('Caută bălți, lacuri...');
  });
});

/* fish helpers/__tests__/formatLakePriceRange.test.ts */
describe('formatLakePriceRange', () => {
  it('formats every case', () => {
    expect(formatLakePriceRange(null, undefined)).toBeNull();
    expect(formatLakePriceRange(20, 240)).toBe('20–240 lei');
    expect(formatLakePriceRange(120, 120)).toBe('120 lei');
    expect(formatLakePriceRange(80, null)).toBe('de la 80 lei');
    expect(formatLakePriceRange(undefined, 150)).toBe('de la 150 lei');
  });
});

/* fish helpers/__tests__/getLakeLocationSubtitle.test.ts */
describe('getLakeLocationSubtitle', () => {
  it('joins address, city and county', () => {
    expect(getLakeLocationSubtitle({ address: 'Str. Lacului 12', county: 'Argeș', countyRef: { name: 'Argeș' }, cityRef: { name: 'Pitești' } })).toBe(
      'Str. Lacului 12, Pitești, Argeș'
    );
  });
  it('falls back to the legacy county and drops missing parts', () => {
    expect(getLakeLocationSubtitle({ address: null, county: 'Argeș', countyRef: null, cityRef: null })).toBe('Argeș');
    expect(getLakeLocationSubtitle({ address: 'Str. Lacului 12', county: 'Argeș', countyRef: null, cityRef: null })).toBe('Str. Lacului 12, Argeș');
    expect(getLakeLocationSubtitle({ address: null, county: null, countyRef: null, cityRef: null })).toBeNull();
  });
  it('honors includeAddress: false and trims blanks', () => {
    expect(
      getLakeLocationSubtitle({ address: 'X', county: 'Argeș', countyRef: { name: 'Argeș' }, cityRef: { name: 'Pitești' } }, { includeAddress: false })
    ).toBe('Pitești, Argeș');
    expect(getLakeLocationSubtitle({ address: '   ', county: '  Argeș  ', countyRef: { name: '  ' }, cityRef: { name: 'Pitești' } })).toBe('Pitești, Argeș');
  });
});

/* fish helpers/__tests__/recentViewedLakes.test.ts (storage-free half) */
describe('recent viewed lake ids', () => {
  it('parses defensively and keeps the newest 10', () => {
    expect(parseRecentViewedLakeIds(null)).toEqual([]);
    expect(parseRecentViewedLakeIds('not json')).toEqual([]);
    expect(parseRecentViewedLakeIds('{"a":1}')).toEqual([]);
    const many = JSON.stringify(Array.from({ length: 12 }, (_, i) => `l${i}`));
    expect(parseRecentViewedLakeIds(many)).toEqual(Array.from({ length: 10 }, (_, i) => `l${i + 2}`));
  });
  it('moves a re-viewed id to the end', () => {
    expect(pushRecentViewedLakeId(['a', 'b', 'c'], 'a')).toEqual(['b', 'c', 'a']);
    expect(pushRecentViewedLakeId(['a'], '  ')).toEqual(['a']);
  });
});

/* fish helpers/__tests__/lakesHomeSections.test.ts */
describe('lakesHomeSections helper', () => {
  const section = (key: string, ids: string[]): LakeHomeSection => ({ key, title: key, lakes: ids.map(id => lake(id)) });

  it('merges sections in expected order with recent first', () => {
    const nearbySection: NearbyLakeHomeSection = { key: 'nearby', title: 'Bălți din zona ta', lakes: [{ ...lake('lake-near'), distanceKm: 1.2 }] };
    const result = buildLakesHomeSections({ recentViewedLakes: [lake('lake-recent')], nearbySection, fixedSections: [section('top_rated', ['lake-top'])] });
    expect(result.map(s => s.key)).toEqual(['recent_viewed', 'nearby', 'top_rated']);
  });

  it('keeps lakes in fixed sections even when they appear in recent viewed', () => {
    const result = buildLakesHomeSections({
      recentViewedLakes: [lake('lake-1')],
      fixedSections: [section('top_rated', ['lake-1', 'lake-2']), section('with_retention', ['lake-2', 'lake-3'])],
    });
    expect(result.map(s => s.lakes.map(l => l.documentId))).toEqual([['lake-1'], ['lake-1', 'lake-2'], ['lake-3']]);
  });

  it('reverses recent viewed order so newest appears first', () => {
    const result = buildLakesHomeSections({ recentViewedLakes: [lake('a'), lake('b'), lake('c')], fixedSections: [section('top_rated', ['a', 'd'])] });
    expect(result[0].lakes.map(l => l.documentId)).toEqual(['c', 'b', 'a']);
    expect(result[1].lakes.map(l => l.documentId)).toEqual(['a', 'd']);
  });

  it('counts total lakes across sections', () => {
    const result = buildLakesHomeSections({ recentViewedLakes: [lake('a')], fixedSections: [section('recently_added', ['b', 'c'])] });
    expect(getTotalLakesInSections(result)).toBe(3);
  });

  it('includes the nearby placeholder when location is unavailable', () => {
    const result = buildLakesHomeSections({ fixedSections: [section('top_rated', ['b'])], nearbyPermissionPlaceholderMode: 'denied' });
    expect(result.map(s => s.key)).toEqual(['nearby', 'top_rated']);
    expect(result[0]).toMatchObject({ title: 'Bălți din zona ta', lakes: [], nearbyPermissionPlaceholderMode: 'denied' });
  });

  it('places all lakes right after nearby, also behind a placeholder', () => {
    const result = buildLakesHomeSections({
      nearbyPermissionPlaceholderMode: 'denied',
      allLakesSection: section('all_lakes', ['x']),
      fixedSections: [section('top_rated', ['t'])],
    });
    expect(result.map(s => s.key)).toEqual(['nearby', 'all_lakes', 'top_rated']);
  });

  it('uses the compact card for recent views only', () => {
    expect(getLakesHomeCardPresentation('recent_viewed').width).toBe(132);
    expect(getLakesHomeCardPresentation('top_rated').width).toBe(182);
  });
});

/* fish lakesWizardSummaries.test.ts + lakeFilterChips.test.ts + lakeFilterOptions */
describe('filters', () => {
  const value = (name: string) => ({ id: name, name, documentId: `doc-${name}` });

  it('returns stable regime options and tier labels', () => {
    expect(getRegimeOptions().map(o => o.name)).toEqual(['C&R', 'Retinere', 'C&R + Retinere']);
    expect(getRatingTierLabel('excellent')).toBe('Excelent');
    expect(getRatingTierLabel('very_good')).toBe('Foarte bun');
    expect(getRatingTierLabel('good')).toBe('Bun');
    expect(getRatingTierOptionLabel('acceptable')).toBe('3,0+ · Acceptabil');
  });

  it('maps catalogs to filter values', () => {
    expect(mapFacilitiesToFilterValues([{ id: 1, documentId: 'f', name: 'Parcare' }])).toEqual([{ id: 'f', name: 'Parcare', documentId: 'f' }]);
    expect(mapFishToFilterValues([{ id: 1, documentId: 'c', Name: 'Crap' }])).toEqual([{ id: 'c', name: 'Crap', documentId: 'c' }]);
    expect(mapFishToFilterValues(undefined)).toEqual([]);
  });

  it('returns the five chips inactive when nothing is selected', () => {
    const chips = getLakeFilterChips(EMPTY_LAKE_FILTERS);
    expect(chips.map(c => c.key)).toEqual(['regime', 'facilities', 'rating', 'booking', 'fish']);
    expect(chips.map(c => c.label)).toEqual(['Regim', 'Facilități', 'Rating', 'Rezervări', 'Pești']);
    expect(chips.every(c => !c.active && !c.badgeCount)).toBe(true);
  });

  it('marks active chips with counts, tier label and the booking toggle', () => {
    const chips = getLakeFilterChips({ ...EMPTY_LAKE_FILTERS, selectedFish: [value('Crap'), value('Șalău')], ratingTier: 'excellent', bookableOnly: true });
    const byKey = Object.fromEntries(chips.map(c => [c.key, c]));
    expect(byKey.fish).toMatchObject({ active: true, badgeCount: 2 });
    expect(byKey.rating).toMatchObject({ active: true, label: 'Excelent' });
    expect(byKey.rating.badgeCount).toBeUndefined();
    expect(byKey.booking).toMatchObject({ active: true, label: 'Rezervări' });
  });

  it('copies only the known suggestion fields (fish useLakesExploreApi.test)', () => {
    const s = mapApiSuggestion({ id: 'city-1', type: 'city', title: 'Sinaia', subtitle: 'x', icon: 'city', color: '#E0F2FE', cityId: 'city-1', countyId: 'county-1' });
    expect(s).toMatchObject({ type: 'city', cityId: 'city-1', countyId: 'county-1' });
  });
});

/* fish features/lakes/helpers/__tests__/suggestionToCommittedSearch.test.ts */
describe('suggestionToCommittedSearch', () => {
  const base = { id: 's1', subtitle: '', color: '#000' } as const;

  it('maps a county suggestion', () => {
    expect(suggestionToCommittedSearch({ ...base, type: 'county', icon: 'county', title: 'Cluj', county: 'Cluj', countyId: 'c-12' })).toEqual({
      mode: 'county', query: 'Cluj', county: 'Cluj', countyId: 'c-12', cityId: null, lakeId: null, nearbyLakeIds: [], latitude: null, longitude: null, radiusKm: DEFAULT_NEARBY_RADIUS_KM,
    });
  });

  it('maps a city suggestion with its county', () => {
    expect(suggestionToCommittedSearch({ ...base, type: 'city', icon: 'city', title: 'Gherla', county: 'Cluj', countyId: 'c-12', cityId: 'ct-9' })).toMatchObject({
      mode: 'city', query: 'Gherla', county: 'Cluj', countyId: 'c-12', cityId: 'ct-9', lakeId: null,
    });
  });

  it('maps a lake suggestion with coordinates', () => {
    expect(suggestionToCommittedSearch({ ...base, type: 'lake', icon: 'lake', title: 'Balta Chiroiu', lakeId: 'lk-3', latitude: 44.5, longitude: 26.4 })).toEqual({
      mode: 'lake', query: 'Balta Chiroiu', county: null, countyId: null, cityId: null, lakeId: 'lk-3', nearbyLakeIds: [], latitude: 44.5, longitude: 26.4, radiusKm: DEFAULT_NEARBY_RADIUS_KM,
    });
  });

  it('returns null for nearby; nearbyCommittedSearch builds it', () => {
    expect(suggestionToCommittedSearch({ ...base, type: 'nearby', icon: 'location', title: 'În jurul meu' })).toBeNull();
    expect(nearbyCommittedSearch(46.77, 23.6)).toMatchObject({ mode: 'nearby', query: 'În jurul meu', latitude: 46.77, longitude: 23.6, radiusKm: 50 });
  });
});

/* fish useLakesHome.signature.test + useLakesInBbox.signature.test */
describe('signatures', () => {
  it('home signature changes with location and is stable otherwise', () => {
    const a = makeLakesHomeSignature({ limit: 10, latitude: null, longitude: null, radiusKm: 50 });
    const b = makeLakesHomeSignature({ limit: 10, latitude: 45.661, longitude: 25.61, radiusKm: 50 });
    expect(a).not.toEqual(b);
    expect(b).toEqual(makeLakesHomeSignature({ limit: 10, latitude: 45.661, longitude: 25.61, radiusKm: 50 }));
    expect(makeLakesHomeSignature({})).toBe(a);
  });

  const BASE = { bbox: { north: 46, south: 45, east: 26, west: 25 }, filters: EMPTY_LAKE_FILTERS, committedSearch: { mode: null }, enabled: true };

  it('in-bbox signature follows the rating tier and is stable', () => {
    const tier = (ratingTier: LakeFilterValues['ratingTier']) => makeLakesInBboxSignature({ ...BASE, filters: { ...BASE.filters, ratingTier } });
    expect(tier(null)).not.toEqual(tier('excellent'));
    expect(tier('good')).not.toEqual(tier('excellent'));
    expect(makeLakesInBboxSignature(BASE)).toEqual(makeLakesInBboxSignature({ ...BASE }));
  });

  it('in-bbox signature buckets tiny pans together and sorts selections', () => {
    const moved = makeLakesInBboxSignature({ ...BASE, bbox: { north: 46.01, south: 45.01, east: 26.01, west: 25.01 } });
    expect(moved).toEqual(makeLakesInBboxSignature(BASE));
    const ab = { ...EMPTY_LAKE_FILTERS, selectedFish: [{ id: 'a', name: 'a', documentId: 'a' }, { id: 'b', name: 'b', documentId: 'b' }] };
    const ba = { ...EMPTY_LAKE_FILTERS, selectedFish: [...ab.selectedFish].reverse() };
    expect(makeLakesExploreCountSignature({ filters: ab })).toEqual(makeLakesExploreCountSignature({ filters: ba }));
    expect(makeLakesExploreSuggestionsSignature({ filters: ab })).toEqual(makeLakesExploreSuggestionsSignature({ filters: ba }));
  });

  it('cluster bucket key includes the zoom', () => {
    expect(bboxBucketKey(null, 10)).toBe('none');
    expect(bboxBucketKey({ north: 46, south: 45, east: 26, west: 25 }, 7)).toBe('7|46|45|26|25');
  });
});

/* reviews */
describe('review helpers', () => {
  it('recomputes the aggregate after an edit', () => {
    const meta = { quality: 4, facilities: 4, atmosphere: 4, overall: 4, count: 2 };
    const next = calculateOptimisticReviewMeta(meta, { quality: 4, facilities: 4, atmosphere: 4 }, { quality: 5, facilities: 3, atmosphere: 4 });
    expect(next).toEqual({ quality: 4.5, facilities: 3.5, atmosphere: 4, overall: 4, count: 2 });
    const empty = { ...meta, count: 0 };
    expect(calculateOptimisticReviewMeta(empty, { quality: 1, facilities: 1, atmosphere: 1 }, { quality: 5, facilities: 5, atmosphere: 5 })).toBe(empty);
  });

  it('formats rating display and counts', () => {
    expect(formatReviewsCount(1)).toBe('1 recenzie');
    expect(formatReviewsCount(3)).toBe('3 recenzii');
    expect(formatReviewsCount(20)).toBe('20 de recenzii');
    expect(formatReviewsCount(101)).toBe('101 recenzii');
    expect(getLakeRatingDisplay(null).label).toBe('Fără recenzii');
    expect(getLakeRatingDisplay({ overall: 4.333, count: 3 })).toMatchObject({ label: '4,33 · 3 recenzii', scoreLabel: '4,33' });
  });

  it('builds the claimed-waters map, skipping empty link codes', () => {
    const map = toClaimedPublicWatersMap([{ linkCode: 'R:1', lakeDocumentId: 'a' }, { linkCode: '', lakeDocumentId: 'b' }]);
    expect([...map.entries()]).toEqual([['R:1', 'a']]);
    expect(toClaimedPublicWatersMap(undefined).size).toBe(0);
  });
});

/* public waters */
describe('public water helpers', () => {
  it('labels location, area and filter types', () => {
    expect(publicWaterLocationLabel({ type: 'river', county: 'Olt', countyIds: [1, 2, 3] })).toBe('3 județe');
    expect(publicWaterLocationLabel({ type: 'natural_lake', county: 'Cluj', countyIds: [1, 2] })).toBe('Cluj');
    expect(publicWaterAreaHaLabel(5.75)).toBe('575 ha');
    expect(publicWaterAreaHaLabel(null)).toBeNull();
    expect(publicWaterFilterToTypes('river')).toEqual(['river']);
    expect(publicWaterFilterToTypes('lake')).toHaveLength(4);
  });

  it('measures and formats distance to a water', () => {
    expect(waterDistanceKm(45, 25, { centerLat: 45, centerLng: 25 })).toBe(0);
    expect(formatWaterDistance(0.42)).toBe('420 m');
    expect(formatWaterDistance(3.21)).toBe('3.2 km');
    expect(formatWaterDistance(13.4)).toBe('13 km');
  });
});
