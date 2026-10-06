import { describe, expect, it } from 'vitest';
import type { PublicWaterListItem } from './publicWaters';
import {
  buildPublicWaterSectionChips,
  countiesHeading,
  countyApplyLabel,
  directionsLinks,
  filterCounties,
  groupSearchResults,
  parsePublicWaterRouteParam,
  parseRecentPublicWaters,
  publicWaterFacts,
  publicWaterName,
  publicWaterRowMeta,
  publicWatersListTitle,
  publicWaterSubtitle,
  publicWaterTypeBadge,
  pushRecentPublicWater,
  rankSearchResults,
  showPublicWatersNewBadge,
  sortWatersByArea,
  speciesChips,
} from './publicWaterDetail';

const row = (id: number, over: Partial<PublicWaterListItem> = {}): PublicWaterListItem => ({
  id,
  name: `Apa ${id}`,
  type: 'natural_lake',
  county: 'Ilfov',
  countyId: 36,
  countyIds: [36],
  centerLat: 44.6,
  centerLng: 26.1,
  linkCode: `L:${id}`,
  areaKm2: null,
  ...over,
});

describe('route param (fish routeParam.ts)', () => {
  it('numeric positive safe integer → row id; anything else → trimmed link code; empty → null', () => {
    expect(parsePublicWaterRouteParam('2245')).toEqual({ kind: 'id', id: 2245 });
    expect(parsePublicWaterRouteParam(' R:RO11_01.018_R1 ')).toEqual({ kind: 'code', code: 'R:RO11_01.018_R1' });
    expect(parsePublicWaterRouteParam('0')).toEqual({ kind: 'code', code: '0' });
    expect(parsePublicWaterRouteParam('99999999999999999999')).toEqual({ kind: 'code', code: '99999999999999999999' });
    expect(parsePublicWaterRouteParam('  ')).toBeNull();
    expect(parsePublicWaterRouteParam(undefined)).toBeNull();
    expect(parsePublicWaterRouteParam(['12', 'x'])).toEqual({ kind: 'id', id: 12 });
  });
});

describe('labels', () => {
  it('name fallback, subtitle with multi-county rivers, badge', () => {
    expect(publicWaterName({ name: null })).toBe('Apă publică');
    expect(publicWaterSubtitle({ type: 'reservoir_lake', county: 'Ilfov', countyIds: [36] })).toBe('Lac de acumulare · Ilfov');
    expect(publicWaterSubtitle({ type: 'river', county: 'Tulcea', countyIds: [1, 2, 3] })).toBe('Râu · 3 județe');
    expect(publicWaterSubtitle({ type: 'transitional_lake', county: null, countyIds: [] })).toBe('Apă de tranziție');
    expect(publicWaterTypeBadge('river')).toBe('Râu');
    expect(publicWaterTypeBadge('coastal_lake')).toBe('Lac');
  });

  it('row meta: location · ha (rounded, ro-RO thousands)', () => {
    expect(publicWaterRowMeta({ type: 'natural_lake', county: 'Ilfov', countyIds: [36], areaKm2: 5.57354554 })).toBe('Ilfov · 557 ha');
    expect(publicWaterRowMeta({ type: 'natural_lake', county: 'Tulcea', countyIds: [1], areaKm2: 12.345 })).toBe('Tulcea · 1.235 ha');
    expect(publicWaterRowMeta({ type: 'river', county: 'Arges', countyIds: [1], areaKm2: null })).toBe('Arges');
  });

  it('area sort puts rivers last', () => {
    const out = sortWatersByArea([row(1, { areaKm2: null }), row(2, { areaKm2: 3 }), row(3, { areaKm2: 9 })]);
    expect(out.map((w) => w.id)).toEqual([3, 2, 1]);
  });

  it('list titles per band', () => {
    expect(publicWatersListTitle({ band: 'clusters', count: 4, loading: false })).toBe('Cele mai mari ape din zonă');
    expect(publicWatersListTitle({ band: 'clusters', count: 0, loading: false })).toBe('Nicio apă în această zonă');
    expect(publicWatersListTitle({ band: 'geometry', count: 0, loading: true })).toBe('Se încarcă…');
    expect(publicWatersListTitle({ band: 'geometry', count: 1, loading: false })).toBe('1 apă în această zonă');
    expect(publicWatersListTitle({ band: 'geometry', count: 12, loading: true })).toBe('12 ape în această zonă');
  });
});

describe('detail', () => {
  it('facts only when present, formatted like fish', () => {
    expect(publicWaterFacts({ basin: 'XI', areaKm2: 5.57354554, volumeMilM3: 32.2, elevationM: 92.89, euCode: null })).toEqual([
      { key: 'basin', label: 'Bazin hidrografic', value: 'XI' },
      { key: 'area', label: 'Suprafață', value: '5.57 km²' },
      { key: 'volume', label: 'Volum', value: '32 mil. m³' },
      { key: 'elevation', label: 'Altitudine', value: '93 m' },
    ]);
    expect(publicWaterFacts({ basin: null, areaKm2: null, volumeMilM3: null, elevationM: null, euCode: null })).toEqual([]);
  });

  it('section chips in order; Capturi on photos OR species', () => {
    expect(buildPublicWaterSectionChips({ hasPartide: false, hasCatches: false })).toEqual(['prezentare', 'locatie']);
    expect(buildPublicWaterSectionChips({ hasPartide: true, hasCatches: false, hasSpecies: true })).toEqual([
      'prezentare',
      'partide',
      'capturi',
      'locatie',
    ]);
    expect(buildPublicWaterSectionChips({ hasPartide: false, hasCatches: true })).toEqual(['prezentare', 'capturi', 'locatie']);
  });

  it('species chips: six then +N', () => {
    const species = Array.from({ length: 8 }, (_, i) => ({ species: `S${i}`, count: 10 - i }));
    const { shown, rest } = speciesChips(species);
    expect(shown).toHaveLength(6);
    expect(rest).toBe(2);
    expect(speciesChips(undefined)).toEqual({ shown: [], rest: 0 });
  });

  it('county heading', () => {
    expect(countiesHeading(1)).toBe('Județ');
    expect(countiesHeading(3)).toBe('Județe (3)');
  });

  it('directions links (fish NavigationSheet)', () => {
    expect(directionsLinks(44.6, 26.1)?.google).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=44.6,26.1&travelmode=driving&dir_action=navigate',
    );
    expect(directionsLinks(44.6, 26.1)?.waze).toContain('navigate=yes');
    expect(directionsLinks(null, 26.1)).toBeNull();
  });
});

describe('recents (fish recentSearches.ts)', () => {
  it('newest first, de-duplicated by id, max 8, no geometry', () => {
    let list: PublicWaterListItem[] = [];
    for (let i = 1; i <= 10; i++) list = pushRecentPublicWater(list, row(i));
    expect(list.map((w) => w.id)).toEqual([10, 9, 8, 7, 6, 5, 4, 3]);
    list = pushRecentPublicWater(list, { ...row(5), geometry: { type: 'LineString', coordinates: [] } } as PublicWaterListItem);
    expect(list.map((w) => w.id).slice(0, 3)).toEqual([5, 10, 9]);
    expect(list).toHaveLength(8);
    expect('geometry' in list[0]).toBe(false);
  });

  it('reads stored data defensively', () => {
    expect(parseRecentPublicWaters('nope')).toEqual([]);
    expect(parseRecentPublicWaters(JSON.stringify([row(1), { x: 1 }]))).toHaveLength(1);
  });
});

describe('search + counties', () => {
  it('ranks names starting with the term first, then shorter names; max 40', () => {
    const rows = [row(1, { name: 'Lacul Snagov' }), row(2, { name: 'Snagov' }), row(3, { name: 'Snagovel', county: 'Ilfov' }), row(4, { name: 'X', county: 'Snagov' })];
    expect(rankSearchResults(rows, 'snag').map((r) => r.id)).toEqual([2, 3, 4, 1]);
    expect(rankSearchResults(rows, 's')).toEqual([]);
  });

  it('groups results under Râuri then Lacuri', () => {
    const groups = groupSearchResults([row(1), row(2, { type: 'river' })]);
    expect(groups.map((g) => g.title)).toEqual(['Râuri', 'Lacuri']);
    expect(groupSearchResults([row(1)]).map((g) => g.title)).toEqual(['Lacuri']);
  });

  it('county search is diacritic-insensitive', () => {
    const counties = [{ name: 'Argeș' }, { name: 'Iași' }, { name: null }];
    expect(filterCounties(counties, 'arges').map((c) => c.name)).toEqual(['Argeș']);
    expect(filterCounties(counties, '')).toHaveLength(2);
    expect(countyApplyLabel(0)).toBe('Aplică');
    expect(countyApplyLabel(2)).toBe('Aplică (2)');
  });

  it('the «NOU» badge is date-gated to before 2026-09-06', () => {
    expect(showPublicWatersNewBadge(Date.UTC(2026, 8, 5, 23))).toBe(true);
    expect(showPublicWatersNewBadge(Date.UTC(2026, 9, 5))).toBe(false);
  });
});
