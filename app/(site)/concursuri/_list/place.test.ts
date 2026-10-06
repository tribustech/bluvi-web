import { describe, expect, it } from 'vitest';
import { routes } from '@/lib/routes';
import { DEFAULT_COMPETITION_FILTERS } from '@/core/competitions';
import { headingFor, isResultsMode, listParamsFor, pathFor, placeFromUrl, searchUrlValues } from './place';

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
    const place = placeFromUrl({ period: '2026-10-03..2026-10-05', format: 'team', availableOnly: 'true', countyId: 'c1', countyName: 'Ilfov' }, { tab: 'notStarted' });
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

  it('stare=toate outside results is the tab-less «Toate concursurile» (an applied «Orice stare»)', () => {
    const place = placeFromUrl({ stare: 'toate' });
    expect(place.status).toBe('all');
    expect(isResultsMode(place)).toBe(false);
    expect(headingFor(place)).toBe('Toate concursurile');
    expect(listParamsFor(place)).toMatchObject({ status: undefined });
  });

  it('filtered «Urmărite» says so in its heading', () => {
    expect(headingFor(placeFromUrl({ format: 'single', scope: 'followed' }))).toBe('Urmărite · filtrate');
  });
});

/* competitions-list.index.c37: the tab is the path, everything else the query. */
describe('placeFromUrl / pathFor — one page per tab', () => {
  const browse = (status: 'notStarted' | 'started' | 'completed' | 'all') => ({ status, search: null, filters: DEFAULT_COMPETITION_FILTERS });

  it('a tab page opens on its tab; /concursuri on the tab the server picked', () => {
    expect(placeFromUrl({}, { tab: 'completed' }).status).toBe('completed');
    expect(placeFromUrl({}, { index: 'started' }).status).toBe('started');
    expect(placeFromUrl({}, { index: 'notStarted' }).status).toBe('notStarted');
    // ?status= is not a tab entry any more.
    expect(placeFromUrl({ status: 'completed' }, { index: 'started' }).status).toBe('started');
  });

  it('results answer across every state on /concursuri, narrowed to the tab on a tab page', () => {
    expect(placeFromUrl({ q: 'cupa' }, { index: 'started' }).status).toBe('all');
    expect(placeFromUrl({ q: 'cupa' }, { tab: 'started' }).status).toBe('started');
  });

  it('keeps the scope in the query', () => {
    expect(placeFromUrl({ scope: 'followed' }, { tab: 'started' })).toMatchObject({ status: 'started', scope: 'followed' });
  });

  it('pathFor: each tab its page; every state, and the tab /concursuri opened on, at /concursuri', () => {
    expect(pathFor(browse('notStarted'), null)).toBe('/concursuri/viitoare');
    expect(pathFor(browse('started'), null)).toBe('/concursuri/live');
    expect(pathFor(browse('completed'), null)).toBe('/concursuri/rezultate');
    expect(pathFor(browse('started'), 'started')).toBe('/concursuri');
    expect(pathFor(browse('completed'), 'started')).toBe('/concursuri/rezultate');
    expect(pathFor(browse('all'), null)).toBe('/concursuri');
    // Results narrowed to a state live on that state's page, even from /concursuri.
    expect(pathFor({ ...browse('started'), search: { type: 'text', value: 'x', label: 'x' } }, 'started')).toBe('/concursuri/live');
  });

  it('routes.competitions builds the clean URLs', () => {
    expect(routes.competitions()).toBe('/concursuri');
    expect(routes.competitions('notStarted')).toBe('/concursuri/viitoare');
    expect(routes.competitions('started')).toBe('/concursuri/live');
    expect(routes.competitions('completed')).toBe('/concursuri/rezultate');
  });
});
