import type { CompetitionCardStatus } from '@/core/competitions';

/*
 * The lake's competition tabs (fish concursuri.tsx: Live started · Viitoare notStarted · Trecute
 * completed, 10 a page) and their URL values (`?tab=`, lakes.competitions.c6). No 'use client':
 * the page reads the URL with it.
 */

export type LakeCompetitionTab = 'live' | 'viitoare' | 'trecute';

export const LAKE_COMPETITION_TABS: { key: LakeCompetitionTab; label: string; status: CompetitionCardStatus; title: string }[] = [
  { key: 'live', label: 'Live', status: 'started', title: 'Concursuri live' },
  { key: 'viitoare', label: 'Viitoare', status: 'notStarted', title: 'Concursuri viitoare' },
  { key: 'trecute', label: 'Trecute', status: 'completed', title: 'Concursuri trecute' },
];

/** fish `useFilteredCompetitions({ status, pagination: { pageSize: 10 }, lakeId })`. */
export const LAKE_COMPETITIONS_PAGE = { pageSize: 10 };

export function parseLakeCompetitionTab(raw: string | undefined): LakeCompetitionTab {
  return raw === 'viitoare' || raw === 'trecute' ? raw : 'live';
}

export const tabOf = (key: LakeCompetitionTab) => LAKE_COMPETITION_TABS.find(t => t.key === key) ?? LAKE_COMPETITION_TABS[0];
