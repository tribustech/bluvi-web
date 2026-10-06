import { describe, expect, it } from 'vitest';
import { routes } from '@/lib/routes';
import { headingFor, isResultsMode, listParamsFor, placeFromUrl, searchUrlValues } from './place';

/* competitions-list.results web_route: the place a results URL opens on, and back. */

describe('placeFromUrl — results params', () => {
  it('reads a lake pick by documentId, with its label', () => {
    const place = placeFromUrl({ lakeId: 'abc', label: 'Chita Lake' });
    expect(place.search).toEqual({ type: 'lake', value: 'abc', label: 'Chita Lake' });
    expect(place.status).toBe('all');
    expect(place.scope).toBe('all');
    expect(headingFor(place)).toBe('Rezultate pentru „Chita Lake”');
  });

  it('reads an organizer pick, and a free-text search', () => {
    expect(placeFromUrl({ organizerId: 'o1', label: 'Sim QA' }).search).toEqual({ type: 'organizer', value: 'o1', label: 'Sim QA' });
    expect(placeFromUrl({ q: '  cupa ' }).search).toEqual({ type: 'text', value: 'cupa', label: 'cupa' });
  });

  it('reads every filter, keeping the county name with its id', () => {
    const place = placeFromUrl({ period: '2026-10-03..2026-10-05', format: 'team', availableOnly: 'true', countyId: 'c1', countyName: 'Ilfov', status: 'notStarted' });
    expect(place.filters).toEqual({ period: '2026-10-03..2026-10-05', format: 'team', availableOnly: true, countyId: 'c1', countyName: 'Ilfov' });
    expect(place.status).toBe('notStarted');
    expect(isResultsMode(place)).toBe(true);
    expect(headingFor(place)).toBe('Concursuri filtrate');
    expect(listParamsFor(place)).toMatchObject({ status: 'notStarted', scope: 'all' });
  });

  it('still reads the older available=1, and ignores invalid values', () => {
    expect(placeFromUrl({ available: '1' }).filters.availableOnly).toBe(true);
    const bad = placeFromUrl({ period: 'soon', format: 'pairs', countyName: 'Ilfov' });
    expect(isResultsMode(bad)).toBe(false);
    expect(bad.filters.countyName).toBeNull();
  });

  it('a search answers under scope all; filters alone keep «Urmărite»', () => {
    expect(placeFromUrl({ q: 'x', scope: 'followed' }).scope).toBe('all');
    expect(placeFromUrl({ format: 'single', scope: 'followed' }).scope).toBe('followed');
  });

  it('round-trips through routes.competitionsSearch and searchUrlValues', () => {
    const search = { type: 'organizer' as const, value: 'o 1', label: 'Ana & Co' };
    const url = new URL(routes.competitionsSearch(search), 'http://x');
    expect(placeFromUrl(Object.fromEntries(url.searchParams)).search).toEqual(search);
    expect(searchUrlValues(search)).toEqual({ q: null, lakeId: null, organizerId: 'o 1', label: 'Ana & Co' });
    expect(searchUrlValues({ type: 'text', value: 'cupa', label: 'cupa' })).toEqual({ q: 'cupa', lakeId: null, organizerId: null, label: null });
  });

  it('status=all outside results is the tab-less «Toate concursurile» (an applied «Orice stare»)', () => {
    const place = placeFromUrl({ status: 'all' });
    expect(place.status).toBe('all');
    expect(isResultsMode(place)).toBe(false);
    expect(headingFor(place)).toBe('Toate concursurile');
    expect(listParamsFor(place)).toMatchObject({ status: undefined });
  });

  it('filtered «Urmărite» says so in its heading', () => {
    expect(headingFor(placeFromUrl({ format: 'single', scope: 'followed' }))).toBe('Urmărite · filtrate');
  });
});
