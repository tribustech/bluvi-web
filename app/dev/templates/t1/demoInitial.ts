import { listParam, listParamOf } from '@/components/templates/T1/listParams';
import {
  DEFAULT_COMPETITION_FILTERS,
  hasActiveFilters,
  parseCustomPeriod,
  type CompetitionCardsScope,
  type CompetitionCardStatus,
  type CompetitionFilterValues,
  type CompetitionsCommittedSearch,
} from '@/core/competitions';
import type { RowEnd } from './CompetitionItems';
import type { DemoState } from './StateSwitcher';

/*
 * Where the demo list starts — the state's own starting point, then the URL's place over it. No
 * 'use client': the page (a Server Component) calls the same functions to pick a Suspense fallback
 * in the shape the list will open in, so the stream fills that frame instead of swapping it.
 */

export type Status = CompetitionCardStatus | 'all';
export type Density = 'list' | 'poster';
export type UrlParams = Record<string, string | string[] | undefined>;

export type DemoPlace = {
  status: Status;
  scope: CompetitionCardsScope;
  search: CompetitionsCommittedSearch;
  filters: CompetitionFilterValues;
  density: Density;
};

export const LIST_HEADING: Record<CompetitionCardStatus, string> = {
  notStarted: 'Alege următorul start',
  started: 'Live acum',
  completed: 'După ultima cântărire',
};

export const SCOPE_HEADING: Partial<Record<CompetitionCardsScope, string>> = {
  registered: 'Înscrierile mele',
  followed: 'Urmărite',
};

/** The demo's starting point for each state. */
export function initialFor(state: DemoState): DemoPlace {
  const base: DemoPlace = {
    status: 'notStarted',
    scope: 'all',
    search: null,
    filters: DEFAULT_COMPETITION_FILTERS,
    density: 'poster',
  };
  switch (state) {
    case 'results':
      return { ...base, status: 'all', search: { type: 'text', value: 'Chita', label: 'Chita' } as CompetitionsCommittedSearch };
    case 'results-empty':
      return { ...base, status: 'all', search: { type: 'text', value: 'Cupa Marte 2091', label: 'Cupa Marte 2091' } as CompetitionsCommittedSearch };
    case 'filtered':
      return { ...base, filters: { ...DEFAULT_COMPETITION_FILTERS, format: 'single', availableOnly: true } };
    case 'filtered-empty':
      return { ...base, filters: { ...DEFAULT_COMPETITION_FILTERS, period: '2027-06-01..2027-06-07', format: 'team' } };
    case 'gate':
    case 'followed-empty':
      return { ...base, scope: 'followed' };
    case 'mine':
    case 'mine-finished':
      return { ...base, scope: 'registered' };
    case 'live-tab':
      return { ...base, status: 'started' };
    case 'completed':
    case 'loading-list':
    case 'next-page':
    case 'next-page-error':
      // Rezultate has more than one page of 20 on the local CMS.
      return { ...base, status: 'completed', density: 'list' };
    default:
      return base;
  }
}

const STATUSES = ['notStarted', 'started', 'completed', 'all'] as const;
const SCOPES = ['followed', 'registered'] as const;
const FORMATS = ['single', 'team'] as const;
const VIEWS = ['list', 'poster'] as const;

function validPeriod(v: string | undefined): string | undefined {
  if (!v) return undefined;
  return v === 'next7' || v === 'weekend' || /^\d{4}-\d{2}$/.test(v) || parseCustomPeriod(v) ? v : undefined;
}

/**
 * The list's place from the URL (status · scope · q · period · format · available · view), over
 * the demo state's own starting point. Anything malformed is ignored, never an error.
 */
export function initialFromUrl(state: DemoState, url: UrlParams): DemoPlace {
  const base = initialFor(state);
  const q = listParam(url, 'q')?.trim();
  return {
    status: listParamOf(url, 'status', STATUSES) ?? base.status,
    scope: listParamOf(url, 'scope', SCOPES) ?? base.scope,
    search: q ? ({ type: 'text', value: q, label: q } as CompetitionsCommittedSearch) : base.search,
    filters: {
      ...base.filters,
      period: validPeriod(listParam(url, 'period')) ?? base.filters.period,
      format: listParamOf(url, 'format', FORMATS) ?? base.filters.format,
      availableOnly: listParam(url, 'available') === '1' || base.filters.availableOnly,
    },
    density: listParamOf(url, 'view', VIEWS) ?? base.density,
  };
}

/** A search or a filter takes the screen over (fish CompetitionResultsChrome). */
export function isResultsMode(place: Pick<DemoPlace, 'search' | 'filters'>): boolean {
  return place.search !== null || hasActiveFilters(place.filters);
}

/** The list read for a place — the same params the client list asks for. */
export function listParamsFor(place: DemoPlace) {
  const mine = place.scope === 'registered';
  return {
    scope: place.scope,
    status: mine || place.status === 'all' ? undefined : place.status,
    search: place.search,
    filters: place.filters,
    sort: 'date' as const,
  };
}

/** The «Ale mele» list (tab, badge, aside block). */
export const REGISTERED_PARAMS = {
  scope: 'registered' as const,
  search: null,
  filters: DEFAULT_COMPETITION_FILTERS,
  sort: 'date' as const,
};

/** The page h1 (results mode) or the list's h2 (browse) — one rule for the list and its fallback. */
export function headingFor(place: Pick<DemoPlace, 'status' | 'scope' | 'search' | 'filters'>): string {
  const { status, scope, search } = place;
  if (isResultsMode(place)) return search ? `Rezultate pentru „${search.label}”` : 'Concursuri filtrate';
  if (status === 'all') return 'Toate concursurile';
  return scope === 'all' ? LIST_HEADING[status] : (SCOPE_HEADING[scope] ?? LIST_HEADING[status]);
}

/** One look for the rows' last column, decided by the list (see CompetitionItems RowEnd). */
export function rowEndFor(place: Pick<DemoPlace, 'status' | 'scope'>): RowEnd {
  const uniform = place.scope !== 'registered' && place.status !== 'all' ? place.status : null;
  return uniform === 'completed' ? 'winner' : uniform === 'started' ? 'none' : 'status';
}

/** The bento shows only on Viitoare with nothing searched, filtered or scoped. */
export function showsPulse(place: DemoPlace): boolean {
  return !isResultsMode(place) && place.scope === 'all' && place.status === 'notStarted';
}
