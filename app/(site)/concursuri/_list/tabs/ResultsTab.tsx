'use client';

import { ResultsList, ResultsListSkeleton } from '../results/ResultsList';
import type { TabModule, TabViewProps } from './types';

/*
 * Rezultate (/concursuri/rezultate) — the tab's content (contract: ./types.ts): the result rows of
 * the approved prototype at every width (../results: grouped by day, the per-type headline, opened
 * inline into the podium, the type's tiles, places 4–8 and «Vezi clasamentul complet»).
 */

function Body({ cards, t, viewer, isAuthenticated, labelledBy }: TabViewProps) {
  return <ResultsList cards={cards} t={t} viewer={viewer} isAuthenticated={isAuthenticated} labelledBy={labelledBy} />;
}

function Skeleton() {
  return <ResultsListSkeleton />;
}

export const resultsTab: TabModule = { Body, Skeleton };
