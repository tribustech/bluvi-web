/**
 * fish `features/competitions/models/competition-filters.types.ts` + `competitions-search.types.ts`.
 *
 * The chip filters — "when / how". "Where / who" is the search, which is why
 * there is no lake or organizer filter here: picking a lake and then filtering
 * by lake is the nonsense this split exists to avoid.
 *
 * One global set, shared across the status tabs. Per-tab memory makes the
 * screen-level results mode flicker as you switch tabs and leaves the three tab
 * counts computed on different bases with nothing saying so.
 */
export type CompetitionPeriod = 'all' | 'next7' | 'weekend' | string; // 'YYYY-MM' | 'YYYY-MM-DD..YYYY-MM-DD'

export type CompetitionFilterValues = {
  period: CompetitionPeriod;
  format: 'all' | 'single' | 'team';
  /** Only meaningful on Viitoare; ignored elsewhere rather than stored per tab. */
  availableOnly: boolean;
  countyId: string | null;
  /**
   * The picked county's name, kept next to the id so the chip rail can say
   * "Ilfov" instead of a documentId. Required, and set together with the id:
   * an optional label is a label that goes missing.
   */
  countyName: string | null;
};

export const DEFAULT_COMPETITION_FILTERS: CompetitionFilterValues = {
  period: 'all',
  format: 'all',
  availableOnly: false,
  countyId: null,
  countyName: null,
};

export type CompetitionSort = 'date' | 'places';

export type CompetitionCardsScope = 'all' | 'registered' | 'organized' | 'followed';

export function countActiveFilters(values: CompetitionFilterValues): number {
  return (
    (values.period !== 'all' ? 1 : 0) +
    (values.format !== 'all' ? 1 : 0) +
    (values.availableOnly ? 1 : 0) +
    (values.countyId ? 1 : 0)
  );
}

export function hasActiveFilters(values: CompetitionFilterValues): boolean {
  return countActiveFilters(values) > 0;
}

/**
 * A committed search — what the user PICKED in the search screen, never what
 * they are typing. Typing filters nothing; only a pick enters results mode.
 *
 * Lake and organizer carry a documentId, never a display name: organiser
 * usernames are free text (production has one with a trailing space), so
 * matching on them would split one person into two.
 */
export type CompetitionsCommittedSearch =
  | { type: 'lake'; value: string; label: string }
  | { type: 'organizer'; value: string; label: string }
  | { type: 'text'; value: string; label: string }
  | null;

export const MAX_RECENT_SEARCHES = 5;
