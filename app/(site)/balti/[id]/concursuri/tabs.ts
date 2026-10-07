import type { CompetitionCardStatus } from '@/core/competitions';

/*
 * The lake's competition tabs (fish concursuri.tsx: Live started · Viitoare notStarted · Trecute
 * completed, 10 a page) and their URL values (`?tab=`, lakes.competitions.c6). No 'use client':
 * the page reads the URL with it.
 */

export type LakeCompetitionTab = 'live' | 'viitoare' | 'trecute';

/**
 * `empty`: the tab's own empty card (lakes.competitions.c4). fish's «Momentan nu este disponibil
 * niciun concurs.» was written for a single-status list; under a strip whose counts say «Viitoare 2»
 * it contradicts what the user sees, so it is kept only when the lake has no competition at all
 * (NO_COMPETITIONS).
 */
export const LAKE_COMPETITION_TABS: { key: LakeCompetitionTab; label: string; status: CompetitionCardStatus; title: string; empty: string }[] = [
  { key: 'live', label: 'Live', status: 'started', title: 'Concursuri live', empty: 'Niciun concurs live acum.' },
  { key: 'viitoare', label: 'Viitoare', status: 'notStarted', title: 'Concursuri viitoare', empty: 'Niciun concurs programat.' },
  { key: 'trecute', label: 'Trecute', status: 'completed', title: 'Concursuri trecute', empty: 'Niciun concurs încheiat încă.' },
];

/** fish CompetitionsFullList's empty copy: every tab is empty. */
export const NO_COMPETITIONS = 'Momentan nu este disponibil niciun concurs.';

/**
 * The caption under the lake's name (c1): the page's subject, not a promotional subtitle — at 375 the
 * breadcrumb is hidden and the lake's name over Live · Viitoare · Trecute read as the lake page.
 */
export const LAKE_COMPETITIONS_CAPTION = 'Concursuri';

/** fish `useFilteredCompetitions({ status, pagination: { pageSize: 10 }, lakeId })`. */
export const LAKE_COMPETITIONS_PAGE = { pageSize: 10 };

/** The tab `?tab=` names, or null when the URL names none (the bare page: see bareLakeCompetitionTab). */
export function parseLakeCompetitionTab(raw: string | undefined): LakeCompetitionTab | null {
  return raw === 'live' || raw === 'viitoare' || raw === 'trecute' ? raw : null;
}

/**
 * The tab the bare page (no `?tab=`, the canonical, sitemapped URL every entry point links) opens:
 * Live while something is live, else Viitoare, else Trecute — so a lake with nothing live lands on
 * its competitions, not on an empty card. The strip keeps fish's Live-first order; an explicit
 * `?tab=` always wins. Without the counts (a failed read), Live as before.
 */
export function bareLakeCompetitionTab(counts: { started: number; notStarted: number; completed: number } | null | undefined): LakeCompetitionTab {
  if (!counts || counts.started > 0) return 'live';
  if (counts.notStarted > 0) return 'viitoare';
  if (counts.completed > 0) return 'trecute';
  return 'live';
}

export const tabOf = (key: LakeCompetitionTab) => LAKE_COMPETITION_TABS.find(t => t.key === key) ?? LAKE_COMPETITION_TABS[0];
