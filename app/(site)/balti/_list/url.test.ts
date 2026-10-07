import { describe, expect, it } from 'vitest';
import { DEFAULT_LAKES_COMMITTED_SEARCH, EMPTY_LAKE_FILTERS, getRegimeOptions } from '@/core/lakes';
import { countLakeFilters, lakesMapQuery, lakesSearchSummary, parseLakesMapParams, withCatalogNames } from './url';

const parse = (q: string) => parseLakesMapParams(new URLSearchParams(q));

describe('lakes map URL state', () => {
  it('no params: the all-lakes map, no filters', () => {
    const s = parse('');
    expect(s.search).toEqual(DEFAULT_LAKES_COMMITTED_SEARCH);
    expect(s.filters).toEqual(EMPTY_LAKE_FILTERS);
    expect(lakesMapQuery(s)).toBe('');
  });

  it('county search round-trips with its title', () => {
    const s = parse('q=Giurgiu&judet=c1');
    expect(s.search).toMatchObject({ mode: 'county', query: 'Giurgiu', countyId: 'c1', county: 'Giurgiu' });
    expect(parse(lakesMapQuery(s)).search).toEqual(s.search);
  });

  it('city search keeps its county', () => {
    const s = parse('q=Mihailesti&judet=c1&localitate=x9');
    expect(s.search).toMatchObject({ mode: 'city', countyId: 'c1', cityId: 'x9' });
    expect(parse(lakesMapQuery(s)).search).toEqual(s.search);
  });

  it('nearby: mode + radius, no position in the URL', () => {
    const s = parse('aproape=1&raza=30');
    expect(s.search).toMatchObject({ mode: 'nearby', radiusKm: 30, latitude: null, longitude: null, query: 'În jurul meu' });
    expect(lakesMapQuery({ search: { ...s.search, latitude: 44, longitude: 26 } })).toBe('aproape=1&raza=30');
    expect(parse('aproape=1&raza=junk').search.radiusKm).toBe(50);
    // The CMS takes radiusKm 5..250 (explore/count 400s outside): the URL is clamped into it.
    expect(parse('aproape=1&raza=300').search.radiusKm).toBe(250);
    expect(parse('aproape=1&raza=2').search.radiusKm).toBe(5);
    expect(parse('aproape=1&raza=250').search.radiusKm).toBe(250);
    expect(lakesMapQuery({ search: parse('aproape=1').search })).toBe('aproape=1');
  });

  it('filters round-trip; unknown regimes and tiers are dropped', () => {
    const [cr, ret] = getRegimeOptions();
    const s = parse(`regim=${encodeURIComponent(`${cr.name},${ret.name},Altul`)}&facilitati=f1,f2,f1&pesti=p1&rating=foarte-bun&rezervari=1`);
    expect(s.filters.selectedRegimes).toEqual([cr, ret]);
    expect(s.filters.selectedFacilities.map((v) => v.documentId)).toEqual(['f1', 'f2']);
    expect(s.filters.selectedFish.map((v) => v.documentId)).toEqual(['p1']);
    expect(s.filters.ratingTier).toBe('very_good');
    expect(s.filters.bookableOnly).toBe(true);
    expect(countLakeFilters(s.filters)).toBe(7);
    expect(parse(lakesMapQuery(s)).filters).toEqual(s.filters);
    expect(parse('rating=super').filters.ratingTier).toBeNull();
  });

  it('withCatalogNames swaps id placeholders for catalog names', () => {
    const named = withCatalogNames([{ id: 'f1', name: 'f1', documentId: 'f1' }, { id: 'zz', name: 'zz', documentId: 'zz' }], [
      { id: 'f1', name: 'Pontoane', documentId: 'f1' },
    ]);
    expect(named.map((v) => v.name)).toEqual(['Pontoane', 'zz']);
  });

  it('the pill summary: the unit spaced, and no «În jurul meu» without a position', () => {
    const nearby = parse('aproape=1').search;
    expect(lakesSearchSummary(nearby, true)).toBe('În jurul meu · 50 km');
    expect(lakesSearchSummary(parse('aproape=1&raza=20').search, true)).toBe('În jurul meu · 20 km');
    expect(lakesSearchSummary(nearby, false)).toBeNull();
    expect(lakesSearchSummary(parse('q=Giurgiu&judet=x').search, false)).toBe('Giurgiu');
    expect(lakesSearchSummary(DEFAULT_LAKES_COMMITTED_SEARCH, false)).toBeNull();
  });
});
