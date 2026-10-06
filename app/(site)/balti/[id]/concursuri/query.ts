import { infiniteQueryOptions } from '@tanstack/react-query';
import {
  buildCompetitionCardsQuery,
  competitionCardsKeys,
  DEFAULT_COMPETITION_FILTERS,
  getCompetitionCards,
  type CompetitionCard,
  type CompetitionCardsPage,
  type CompetitionCardsParams,
  type CompetitionCardStatus,
} from '@/core/competitions';
import type { Transport } from '@/core/transport';
import { LAKE_COMPETITIONS_PAGE } from './tabs';

/*
 * The lake's competition tabs read the SAME cards as the /concursuri list (/feed/competition-cards:
 * public, edge-cached, every label derived by the server — date, unit «pescari» / «echipe», pending
 * registrations, faces, podium), scoped to the lake (`lakeId`), fish's 10 a page. One read per tab;
 * its `meta.counts` gives every tab's size, so the Live tab knows whether anything is live and the
 * empty card can point at the next tab that has competitions — no extra request. No 'use client':
 * the page prefetches it.
 */

export function lakeCompetitionCardsParams(lakeId: string, status: CompetitionCardStatus): CompetitionCardsParams {
  return {
    scope: 'all',
    status,
    // The label is not sent (buildCompetitionCardsQuery reads `value` only).
    search: { type: 'lake', value: lakeId, label: '' },
    filters: DEFAULT_COMPETITION_FILTERS,
    sort: 'date',
  };
}

export function lakeCompetitionCardsQuery(t: Transport, lakeId: string, status: CompetitionCardStatus) {
  const params = lakeCompetitionCardsParams(lakeId, status);
  const pageSize = LAKE_COMPETITIONS_PAGE.pageSize;
  return infiniteQueryOptions({
    queryKey: competitionCardsKeys.list(buildCompetitionCardsQuery({ ...params, page: 1, pageSize })),
    queryFn: ({ pageParam }) => getCompetitionCards(t, { ...params, page: pageParam, pageSize }),
    getNextPageParam: (last: CompetitionCardsPage) => {
      const { page, pageCount } = last.meta.pagination;
      return page < pageCount ? page + 1 : undefined;
    },
    initialPageParam: 1,
    // As the /concursuri lists: membership changes, not rows; a tab switch is free for 30 minutes.
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });
}

/**
 * On the lake's own page the card does not repeat the lake (every card would read «Chita Lake»):
 * the lake goes, its photo stays as the poster fallback (fish: banner → lake image).
 */
export function withoutLake(c: CompetitionCard): CompetitionCard {
  return c.lake ? { ...c, banner: c.banner ?? c.lake.image, lake: null } : c;
}
