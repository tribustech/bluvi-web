import { describe, expect, it } from 'vitest';
import { DEFAULT_LAKES_COMMITTED_SEARCH, nearbyCommittedSearch, type LakesCommittedSearch } from './filters';
import { splitLakesHomeSections } from './homeSections';
import { deriveLakesLocationState, deriveNearbyPermissionPlaceholderMode } from './locationState';
import {
  bboxToMapRegion,
  computeClusterTargetRegion,
  COUNTRY_OVERVIEW_REGION,
  getFocusSignature,
  getMapFocusRegion,
  getZoomFromRegion,
  isGeographicSearchMode,
  isRegionCenteredOn,
  nextLocateRadiusKm,
  regionToBbox,
  resolveMapFocusRegion,
} from './mapFocus';
import { MAX_RECENT_LAKE_SEARCHES, parseRecentLakeSearches, pushRecentLakeSearch } from './recentSearches';
import type { LakeHomeSection, LakesSearchSuggestion } from '../schemas';

const county: LakesCommittedSearch = { ...DEFAULT_LAKES_COMMITTED_SEARCH, mode: 'county', query: 'Giurgiu', countyId: 'c1' };
const bbox = { north: 44.3, south: 44.1, east: 26.3, west: 25.7 };

describe('getMapFocusRegion (fish getMapFocusRegion.ts)', () => {
  it('county / city: the bbox padded 10% each side, centred', () => {
    const r = getMapFocusRegion({ committedSearch: county, countyBbox: bbox, userLocation: null })!;
    expect(r.latitude).toBeCloseTo(44.2);
    expect(r.longitude).toBeCloseTo(26);
    expect(r.latitudeDelta).toBeCloseTo(0.24);
    expect(r.longitudeDelta).toBeCloseTo(0.72);
  });
  it('county without its bbox yet: null', () => {
    expect(getMapFocusRegion({ committedSearch: county, countyBbox: null, userLocation: null })).toBeNull();
  });
  it('a tiny bbox keeps the 0.02 minimum delta', () => {
    const r = getMapFocusRegion({ committedSearch: county, countyBbox: { north: 1, south: 1, east: 1, west: 1 }, userLocation: null })!;
    expect(r.latitudeDelta).toBe(0.02);
  });
  it('lake: its point at 0.015', () => {
    const s = { ...DEFAULT_LAKES_COMMITTED_SEARCH, mode: 'lake' as const, latitude: 44, longitude: 26 };
    expect(getMapFocusRegion({ committedSearch: s, countyBbox: null, userLocation: null })).toEqual({
      latitude: 44,
      longitude: 26,
      latitudeDelta: 0.015,
      longitudeDelta: 0.015,
    });
  });
  it('nearby: a square of the radius around the user', () => {
    const r = getMapFocusRegion({ committedSearch: nearbyCommittedSearch(44, 26), countyBbox: null, userLocation: { latitude: 45, longitude: 25 } })!;
    expect(r.latitude).toBe(45);
    expect(r.latitudeDelta).toBeCloseTo((50 / 111) * 2);
  });
  it('no anchor: null', () => {
    expect(getMapFocusRegion({ committedSearch: DEFAULT_LAKES_COMMITTED_SEARCH, countyBbox: null, userLocation: null })).toBeNull();
  });
});

describe('resolveMapFocusRegion (fish lakes/index.tsx focusRegion)', () => {
  it('no anchor → the country overview (lakes.results-map.c5)', () => {
    expect(resolveMapFocusRegion({ committedSearch: DEFAULT_LAKES_COMMITTED_SEARCH, countyBbox: null, countyBboxFailed: false, userLocation: null })).toBe(
      COUNTRY_OVERVIEW_REGION,
    );
  });
  it('county bbox in flight → wait (null)', () => {
    expect(resolveMapFocusRegion({ committedSearch: county, countyBbox: null, countyBboxFailed: false, userLocation: null })).toBeNull();
  });
  it('county bbox failed → the country overview (lakes.results-map.c6)', () => {
    expect(resolveMapFocusRegion({ committedSearch: county, countyBbox: null, countyBboxFailed: true, userLocation: null })).toBe(COUNTRY_OVERVIEW_REGION);
  });
  it('nearby without a position: waits while locating, then the country', () => {
    const s = { ...DEFAULT_LAKES_COMMITTED_SEARCH, mode: 'nearby' as const };
    expect(resolveMapFocusRegion({ committedSearch: s, countyBbox: null, countyBboxFailed: false, userLocation: null, locating: true })).toBeNull();
    expect(resolveMapFocusRegion({ committedSearch: s, countyBbox: null, countyBboxFailed: false, userLocation: null })).toBe(COUNTRY_OVERVIEW_REGION);
  });
});

describe('map helpers', () => {
  it('isGeographicSearchMode', () => {
    expect(['county', 'city', 'lake', 'nearby'].every((m) => isGeographicSearchMode(m as LakesCommittedSearch['mode']))).toBe(true);
    expect(isGeographicSearchMode('text')).toBe(false);
    expect(isGeographicSearchMode(null)).toBe(false);
  });
  it('getFocusSignature differs only by the nonce for the same search', () => {
    expect(getFocusSignature(county, 0)).toBe('county|c1|||||50|0');
    expect(getFocusSignature(county, 1)).toBe('county|c1|||||50|1');
  });
  it('regionToBbox ↔ bboxToMapRegion', () => {
    const b = regionToBbox(COUNTRY_OVERVIEW_REGION);
    expect(b.north).toBeCloseTo(48.9432);
    expect(b.west).toBeCloseTo(19.9668);
    const r = bboxToMapRegion(b);
    expect(r.latitude).toBeCloseTo(COUNTRY_OVERVIEW_REGION.latitude);
    expect(r.longitudeDelta).toBeCloseTo(10);
  });
  it('getZoomFromRegion rounds log2(360 / lngDelta), clamped 0–22', () => {
    expect(getZoomFromRegion({ longitudeDelta: 10 })).toBe(5);
    expect(getZoomFromRegion({ longitudeDelta: 360 })).toBe(0);
    expect(getZoomFromRegion({ longitudeDelta: 0 })).toBe(22);
  });
  it('computeClusterTargetRegion: bbox ×1.4, never more than 2 zoom levels in (lakes.results-map.c10)', () => {
    const current = { latitude: 45, longitude: 25, latitudeDelta: 4, longitudeDelta: 8 };
    const wide = computeClusterTargetRegion({ north: 46, south: 44, east: 27, west: 23 }, current);
    expect(wide.latitudeDelta).toBeCloseTo(2.8);
    expect(wide.longitudeDelta).toBeCloseTo(5.6);
    const tiny = computeClusterTargetRegion({ north: 45.001, south: 45, east: 25.001, west: 25 }, current);
    expect(tiny.latitudeDelta).toBe(1);
    expect(tiny.longitudeDelta).toBe(2);
  });
  it('nextLocateRadiusKm: min(radius, 20), then −5 while centred, floor 5 (lakes.results-map.c21)', () => {
    expect(nextLocateRadiusKm({ previousKm: null, centeredOnUser: false, nearbyRadiusKm: 50 })).toBe(20);
    expect(nextLocateRadiusKm({ previousKm: null, centeredOnUser: false, nearbyRadiusKm: 10 })).toBe(10);
    expect(nextLocateRadiusKm({ previousKm: 20, centeredOnUser: true, nearbyRadiusKm: 50 })).toBe(15);
    expect(nextLocateRadiusKm({ previousKm: 5, centeredOnUser: true, nearbyRadiusKm: 50 })).toBe(5);
    expect(nextLocateRadiusKm({ previousKm: 10, centeredOnUser: false, nearbyRadiusKm: 50 })).toBe(20);
  });
  it('isRegionCenteredOn: within 20% of the deltas', () => {
    const r = { latitude: 45, longitude: 25, latitudeDelta: 1, longitudeDelta: 1 };
    expect(isRegionCenteredOn(r, { latitude: 45.1, longitude: 25.1 })).toBe(true);
    expect(isRegionCenteredOn(r, { latitude: 45.3, longitude: 25 })).toBe(false);
  });
});

describe('recent lake searches (fish recentLakeSearches.ts)', () => {
  const s = (id: string, type: LakesSearchSuggestion['type'] = 'county'): LakesSearchSuggestion => ({
    id,
    type,
    title: id,
    subtitle: '',
    icon: 'county',
    color: '',
  });
  it('push: newest first, deduped, max 5; nearby is never stored (lakes.search.c4)', () => {
    let list: LakesSearchSuggestion[] = [];
    for (const id of ['a', 'b', 'c', 'd', 'e', 'f']) list = pushRecentLakeSearch(list, s(id));
    expect(list.map((x) => x.id)).toEqual(['f', 'e', 'd', 'c', 'b']);
    expect(list).toHaveLength(MAX_RECENT_LAKE_SEARCHES);
    list = pushRecentLakeSearch(list, s('c'));
    expect(list.map((x) => x.id)).toEqual(['c', 'f', 'e', 'd', 'b']);
    expect(pushRecentLakeSearch(list, s('n', 'nearby'))).toBe(list);
  });
  it('parse: drops junk and non-place entries', () => {
    expect(parseRecentLakeSearches(null)).toEqual([]);
    expect(parseRecentLakeSearches('nope')).toEqual([]);
    expect(parseRecentLakeSearches(JSON.stringify([s('a', 'lake'), s('b', 'nearby'), { id: 1 }])).map((x) => x.id)).toEqual(['a']);
  });
});

describe('location state (fish locationPermissionState.ts)', () => {
  it('derive + placeholder mode', () => {
    expect(deriveLakesLocationState({ status: 'granted' })).toBe('granted');
    expect(deriveLakesLocationState({ status: 'denied' })).toBe('denied');
    expect(deriveLakesLocationState({ status: 'prompt' })).toBe('never_asked');
    expect(deriveNearbyPermissionPlaceholderMode('granted')).toBeNull();
    expect(deriveNearbyPermissionPlaceholderMode('services_off')).toBe('services_off');
  });
});

describe('splitLakesHomeSections', () => {
  const section = (key: string): LakeHomeSection => ({ key, title: key, lakes: [] });
  it('nearby and all_lakes out of the fixed rows, server order kept (lakes.home.c7)', () => {
    const r = splitLakesHomeSections([section('nearby'), section('bookable'), section('top_rated'), section('all_lakes')]);
    expect(r.nearbySection?.key).toBe('nearby');
    expect(r.allLakesSection?.key).toBe('all_lakes');
    expect(r.fixedSections.map((x) => x.key)).toEqual(['bookable', 'top_rated']);
  });
});
