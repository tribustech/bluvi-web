import { DEFAULT_COMPETITION_FILTERS, type CompetitionCardsScope, type CompetitionCardStatus, type CompetitionFilterValues, type CompetitionsCommittedSearch } from '@/core/competitions';
import type { DemoState } from './StateSwitcher';

/*
 * Where the demo list starts for each forced state — the place the production screen opens on
 * (page.tsx; the list's own URL params win when present). No 'use client': the page calls it.
 */

export type Status = CompetitionCardStatus | 'all';
export type Density = 'list' | 'poster';

export type DemoPlace = {
  status: Status;
  scope: CompetitionCardsScope;
  search: CompetitionsCommittedSearch;
  filters: CompetitionFilterValues;
  density: Density;
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

