'use client';

import { track } from '@/lib/analytics';
import type {
  CompetitionCardsScope,
  CompetitionCardStatus,
  CompetitionFilterValues,
  CompetitionsCommittedSearch,
  HeroKind,
} from '@/core/competitions';

/*
 * fish features/competitions/helpers/competitionsAnalytics.ts. Every event is a scalar bag; free
 * text is never sent; a failure never reaches the page. Events go out on the site's one channel
 * (lib/analytics.ts) — the call sites and parameters are fish's, so wiring GA4 changes nothing here.
 */

type Params = Record<string, string | number | boolean>;

export function logEvent(name: string, params?: Params): void {
  track(name, params);
}

export const logStatusChanged = (input: { status: CompetitionCardStatus; scope: CompetitionCardsScope }) =>
  logEvent('competitions_status_changed', input);

export const logScopeChanged = (input: { scope: CompetitionCardsScope }) => logEvent('competitions_scope_changed', input);

export type PulseTracker = {
  /** Deduped per competition for the tracker's life — one visit, one impression. */
  heroImpression: (input: { competitionId: string; kind: HeroKind }) => void;
  heroPress: (input: { competitionId: string; kind: HeroKind }) => void;
  momentPress: (input: { competitionId: string; kicker: string }) => void;
  countTilePress: (input: { live: number }) => void;
};

/** fish createPulseTracker: one per page visit. */
export function createPulseTracker(log: (name: string, params?: Params) => void = logEvent): PulseTracker {
  const seen = new Set<string>();
  return {
    heroImpression: ({ competitionId, kind }) => {
      if (seen.has(competitionId)) return;
      seen.add(competitionId);
      log('competitions_hero_impression', { kind, competition_id: competitionId });
    },
    heroPress: ({ competitionId, kind }) => log('competitions_hero_pressed', { kind, competition_id: competitionId }),
    momentPress: ({ competitionId, kicker }) => log('competitions_moment_pressed', { kicker, competition_id: competitionId }),
    countTilePress: ({ live }) => log('competitions_count_tile_pressed', { live }),
  };
}

/** fish logCompetitionsSearchCommitted: the pick type only, never the typed text (search.c14). */
export const logSearchCommitted = (search: NonNullable<CompetitionsCommittedSearch>) =>
  logEvent('competitions_search_committed', { type: search.type });

/** fish filtersEventParams (filters.c15): «none» when no county is picked. */
export const logFiltersApplied = (values: CompetitionFilterValues) =>
  logEvent('competitions_filters_applied', {
    period: values.period,
    format: values.format,
    available_only: values.availableOnly,
    county_id: values.countyId ?? 'none',
    county_name: values.countyName ?? 'none',
  });
