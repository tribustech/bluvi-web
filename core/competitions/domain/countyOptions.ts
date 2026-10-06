import type { LakesSearchSuggestion } from '../../lakes/schemas';

/*
 * fish `features/competitions/components/CompetitionFiltersSheet.tsx#useCountyOptions` — the pure
 * half (parity competitions-list.filters.c11, c12).
 *
 * The county list is the one the Bălți search already serves: `/lakes/explore/suggestions` with no
 * query ranks counties first and hands back each county's documentId — the same id the card
 * endpoint filters on. There is no counties endpoint.
 */

/** 42 counties at 20 suggestions a page; the stop condition below normally trips first. */
export const MAX_COUNTY_PAGES = 4;

export type CountyOption = { id: string; name: string };

/**
 * With no query the ranking puts every county before the first city or lake, so once one of those
 * appears every county is in. Page further only while this is false (and under MAX_COUNTY_PAGES).
 */
export function countyListComplete(suggestions: Pick<LakesSearchSuggestion, 'type'>[]): boolean {
  return suggestions.some((item) => item.type === 'city' || item.type === 'lake');
}

/** The counties among the suggestions, id and name together, sorted in Romanian order. */
export function countyOptions(suggestions: Pick<LakesSearchSuggestion, 'type' | 'countyId' | 'title'>[]): CountyOption[] {
  const seen = new Set<string>();
  const out: CountyOption[] = [];
  for (const item of suggestions) {
    if (item.type !== 'county' || !item.countyId || !item.title || seen.has(item.countyId)) continue;
    seen.add(item.countyId);
    out.push({ id: item.countyId, name: item.title });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, 'ro', { sensitivity: 'base' }));
}

/** Diacritic- and case-insensitive (fish `normalize`, as in PublicWaterCountyFilter). */
export function normalizeCountyText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/** fish filteredCounties: «contains», ignoring diacritics and case; an empty term keeps them all. */
export function filterCounties(counties: CountyOption[], term: string): CountyOption[] {
  const needle = normalizeCountyText(term.trim());
  if (!needle) return counties;
  return counties.filter((c) => normalizeCountyText(c.name).includes(needle));
}
