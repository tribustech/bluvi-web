import { listParam, listParamOf } from '@/components/templates/T1/listParams';
import {
  DEFAULT_COMPETITION_FILTERS,
  hasActiveFilters,
  parseCustomPeriod,
  type CompetitionCardsParams,
  type CompetitionCardsScope,
  type CompetitionCardStatus,
  type CompetitionFilterValues,
  type CompetitionsCommittedSearch,
} from '@/core/competitions';
import { formatCount, periodChipLabel } from '@/core/competitions';
import { routes } from '@/lib/routes';

/*
 * Where the Concursuri list starts and what it says — fish (tabs)/competitions/index.tsx. No
 * 'use client': page.tsx (a Server Component) reads the same place from the URL to pick its
 * Suspense fallback and its prefetch, so the stream fills the frame the list opens in.
 */

/** `'all'` is not a tab: it is what results mode (a search, filters) asks for. */
export type Status = CompetitionCardStatus | 'all';
export type UrlParams = Record<string, string | string[] | undefined>;

export type ListPlace = {
  status: Status;
  scope: CompetitionCardsScope;
  search: CompetitionsCommittedSearch;
  filters: CompetitionFilterValues;
};

export const DEFAULT_PLACE: ListPlace = {
  status: 'notStarted',
  scope: 'all',
  search: null,
  filters: DEFAULT_COMPETITION_FILTERS,
};

/** fish LIST_HEADING (index.tsx:62). */
export const LIST_HEADING: Record<CompetitionCardStatus, string> = {
  notStarted: 'Alege următorul start',
  started: 'Live acum',
  completed: 'După ultima cântărire',
};

/** fish SCOPE_HEADING. */
export const SCOPE_HEADING: Partial<Record<CompetitionCardsScope, string>> = {
  registered: 'Înscrierile mele',
  organized: 'Organizate de mine',
  followed: 'Urmărite',
};

export const TAB_LABEL: Record<CompetitionCardStatus, string> = { notStarted: 'Viitoare', started: 'Live', completed: 'Rezultate' };

/** Romanian agrees the adjective with the noun: un concurs viitor, două viitoare (fish STATUS_WORD). */
export const STATUS_WORD: Record<CompetitionCardStatus, { one: string; many: string }> = {
  notStarted: { one: 'viitor', many: 'viitoare' },
  started: { one: 'în desfășurare', many: 'în desfășurare' },
  completed: { one: 'încheiat', many: 'încheiate' },
};

/**
 * fish countLabel: «1 concurs viitor» / «N concursuri viitoare». Web keeps the Romanian «de» from 20
 * (formatCount, the rule every other count on the site follows: «24 de concursuri încheiate»).
 */
export function countLabel(count: number, status: CompetitionCardStatus): string {
  const word = count === 1 ? STATUS_WORD[status].one : STATUS_WORD[status].many;
  return `${formatCount(count, 'concurs', 'concursuri')} ${word}`;
}

/** fish mixedCountLabel: the personal list mixes statuses, nothing can agree with one of them. */
export function mixedCountLabel(count: number): string {
  return formatCount(count, 'concurs', 'concursuri');
}

const SCOPES = ['followed', 'registered'] as const;
const FOLLOWED_ONLY = ['followed'] as const;
const FORMATS = ['single', 'team'] as const;

function validPeriod(v: string | undefined): string | undefined {
  if (!v) return undefined;
  return v === 'next7' || v === 'weekend' || /^\d{4}-\d{2}$/.test(v) || parseCustomPeriod(v) ? v : undefined;
}

/** The committed search from the URL: `lakeId` / `organizerId` (+ `label`, the picked name) or `q`. */
function searchFromUrl(url: UrlParams): CompetitionsCommittedSearch {
  const lakeId = listParam(url, 'lakeId')?.trim();
  const organizerId = listParam(url, 'organizerId')?.trim();
  const label = listParam(url, 'label')?.trim();
  if (lakeId) return { type: 'lake', value: lakeId, label: label || 'Baltă' };
  if (organizerId) return { type: 'organizer', value: organizerId, label: label || 'Organizator' };
  const q = listParam(url, 'q')?.trim();
  return q ? { type: 'text', value: q, label: q } : null;
}

/** The search's own URL params — what useListUrlState mirrors (the others are cleared). */
export function searchUrlValues(search: CompetitionsCommittedSearch): Record<'q' | 'lakeId' | 'organizerId' | 'label', string | null> {
  return {
    q: search?.type === 'text' ? search.value : null,
    lakeId: search?.type === 'lake' ? search.value : null,
    organizerId: search?.type === 'organizer' ? search.value : null,
    label: search && search.type !== 'text' ? search.label : null,
  };
}

/** Where the list sits in the URL path: one tab's own page, or /concursuri (its tab decided by the server). */
export type ListRoute = { tab: CompetitionCardStatus } | { index: CompetitionCardStatus };

/** `?stare=toate`: «Orice stare» applied from the filters with nothing else narrowing (fish's tab-less list). */
export const ALL_STATES_PARAM = { key: 'stare', value: 'toate' } as const;

/**
 * The place from the URL: the path names the tab (/concursuri/viitoare · /live · /rezultate; plain
 * /concursuri opens on `index`, Live when something is live, else Viitoare), the query the rest —
 * `scope` (followed | registered), the search (q | lakeId | organizerId + label) and the filters
 * (period, format, availableOnly=true — the older `available=1` still reads —, countyId +
 * countyName), plus `stare=toate` (an applied «Orice stare»). The list then mirrors its own place
 * into the URL (useListUrlState), so a reload, a back from a competition and a shared link come back
 * to it.
 */
export function placeFromUrl(url: UrlParams, route: ListRoute = { index: 'notStarted' }): ListPlace {
  const search = searchFromUrl(url);
  const countyId = listParam(url, 'countyId')?.trim() || null;
  const filters: CompetitionFilterValues = {
    ...DEFAULT_COMPETITION_FILTERS,
    period: validPeriod(listParam(url, 'period')) ?? 'all',
    format: listParamOf(url, 'format', FORMATS) ?? 'all',
    availableOnly: listParam(url, 'availableOnly') === 'true' || listParam(url, 'available') === '1',
    countyId,
    countyName: countyId ? (listParam(url, 'countyName')?.trim() ?? null) : null,
  };
  const results = search !== null || hasActiveFilters(filters);
  const tab = 'tab' in route ? route.tab : null;
  if (!results) {
    const allStates = listParam(url, ALL_STATES_PARAM.key) === ALL_STATES_PARAM.value;
    const status = allStates ? 'all' : (tab ?? ('index' in route ? route.index : 'notStarted'));
    return { ...DEFAULT_PLACE, status, scope: listParamOf(url, 'scope', SCOPES) ?? 'all' };
  }
  // Results mode answers across statuses unless a tab's path narrowed it (the status chip). Filtering
  // keeps «Urmărite» (fish onApply → changeStatus leaves only «Ale mele»), so a filtered followed
  // list comes back followed. A search always answers under scope all (results.c2).
  return {
    status: tab ?? 'all',
    scope: search ? 'all' : (listParamOf(url, 'scope', FOLLOWED_ONLY) ?? 'all'),
    search,
    filters,
  };
}

/**
 * The path a place lives at (the inverse of placeFromUrl's path half): a tab's own page, or
 * /concursuri for every state at once — and for the tab /concursuri opened on, until the list moves
 * off it (`onIndex`), so a landing on /concursuri keeps its clean URL.
 */
export function pathFor(place: Pick<ListPlace, 'status' | 'search' | 'filters'>, onIndex: CompetitionCardStatus | null): string {
  if (place.status === 'all') return routes.competitions();
  if (!isResultsMode(place) && place.status === onIndex) return routes.competitions();
  return routes.competitions(place.status);
}

/** A committed search or any filter takes the screen over (fish resultsMode). */
export function isResultsMode(place: Pick<ListPlace, 'search' | 'filters'>): boolean {
  return place.search !== null || hasActiveFilters(place.filters);
}

/** The list read for a place — the same params the client list asks for (fish index.tsx:213). */
export function listParamsFor(place: ListPlace): Omit<CompetitionCardsParams, 'page' | 'pageSize'> {
  const mine = place.scope === 'registered';
  return {
    scope: place.scope,
    status: mine || place.status === 'all' ? undefined : place.status,
    search: place.search,
    filters: place.filters,
    sort: 'date',
  };
}

/** fish `registered` (index.tsx:245): the «Ale mele» tab and its badge, every status at once. */
export const REGISTERED_PARAMS = {
  scope: 'registered',
  search: null,
  filters: DEFAULT_COMPETITION_FILTERS,
  sort: 'date',
} as const satisfies Omit<CompetitionCardsParams, 'page' | 'pageSize'>;

/** The list's heading (fish index.tsx:512): one rule for the list and its fallback. */
export function headingFor(place: Pick<ListPlace, 'status' | 'scope' | 'search' | 'filters'>): string {
  const { status, scope, search } = place;
  // Filtered on «Urmărite» (results.c6 keeps the scope): the heading says it is still the followed list.
  if (isResultsMode(place)) return search ? `Rezultate pentru „${search.label}”` : scope === 'followed' ? 'Urmărite · filtrate' : 'Concursuri filtrate';
  if (status === 'all') return 'Toate concursurile';
  return scope === 'all' ? LIST_HEADING[status] : (SCOPE_HEADING[scope] ?? LIST_HEADING[status]);
}

/** fish showPulse (index.tsx:279): Viitoare, scope all, nothing searched or filtered. */
export function showsPulse(place: ListPlace): boolean {
  return !isResultsMode(place) && place.scope === 'all' && place.status === 'notStarted';
}

/** The status chip's words (results.c7) — the tab's, except Live (fish CompetitionFilterChips). */
export const STATUS_CHIP: Record<CompetitionCardStatus, string> = { notStarted: 'Viitoare', started: 'Live', completed: 'Încheiate' };
export const FORMAT_LABEL = { single: 'Individual', team: 'Echipe' } as const;

/**
 * The active-filter chips' labels in rail order (results.c7: status, Locuri libere, county, period,
 * format) — the live rail's and the page's Suspense frame's, so the frame holds the rail's height.
 */
export function chipLabels(place: ListPlace, now: Date): string[] {
  const { status, filters } = place;
  const labels: string[] = [];
  if (isResultsMode(place) && status !== 'all') labels.push(STATUS_CHIP[status]);
  if (filters.availableOnly) labels.push('Locuri libere');
  if (filters.countyId) labels.push(filters.countyName ?? 'Județ');
  if (filters.period !== 'all') labels.push(periodChipLabel(filters.period, now));
  if (filters.format !== 'all') labels.push(FORMAT_LABEL[filters.format]);
  return labels;
}

/** What the results pill says (results.c3): the search, else filtered — «Urmărite» when it still is. */
export function resultsLabelFor(place: Pick<ListPlace, 'search' | 'scope'>): string {
  return place.search ? place.search.label : place.scope === 'followed' ? 'Urmărite · filtrate' : 'Concursuri filtrate';
}
