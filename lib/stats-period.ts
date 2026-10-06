import type { StatsPeriod } from '@/core/partide';

/*
 * The community stats period of a venue's pages — a lake's or a public water's Statistici,
 * Clasament and Standuri (fish features/partide/components/stats/PeriodChips PERIOD_OPTIONS +
 * community/view periodPhraseFor). A module with no 'use client': the pages and their fallbacks
 * read it on the server. Parsing `?perioada=` is core's (`parseStatsPeriodParam`).
 */

/** fish PeriodChips PERIOD_OPTIONS (lakes.anglers-ranking.c2, public-waters.clasament.c3). */
export const PERIOD_OPTIONS: { value: StatsPeriod; label: string }[] = [
  { value: 'week', label: 'Săptămâna' },
  { value: 'month', label: 'Luna' },
  { value: 'year', label: 'Anul curent' },
];

/** The period as a phrase for the side cards («Luna aceasta»). */
export const PERIOD_TITLE: Record<StatsPeriod, string> = {
  week: 'Săptămâna aceasta',
  month: 'Luna aceasta',
  year: 'Anul curent',
};
