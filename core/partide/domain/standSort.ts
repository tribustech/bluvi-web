// Ported from fish `features/partide/helpers/standSort.ts` (pure).
import type { StandStat } from '../schemas';

export type StandSort = 'kg' | 'catches' | 'record';

export const STAND_SORT_OPTIONS: { value: StandSort; label: string }[] = [
  { value: 'kg', label: 'Kg total' },
  { value: 'catches', label: 'Capturi' },
  { value: 'record', label: 'Record' },
];

export function standSortValue(stand: StandStat, sort: StandSort): number | null {
  if (sort === 'kg') return stand.totalKg;
  if (sort === 'catches') return stand.catches;
  return stand.recordKg;
}

/** Ranks a COPY of the rows. A stand with no weighed catch (`recordKg: null`)
 * sinks to the bottom rather than sorting as 0, so "Record" never puts an empty
 * stand above one that produced fish. */
export function sortStands(stands: StandStat[], sort: StandSort): StandStat[] {
  return [...stands].sort((a, b) => {
    const av = standSortValue(a, sort);
    const bv = standSortValue(b, sort);
    if (av == null && bv == null) return a.name.localeCompare(b.name, 'ro');
    if (av == null) return 1;
    if (bv == null) return -1;
    return bv - av || a.name.localeCompare(b.name, 'ro');
  });
}

/** fish `StandsLeaderboardScreen#parseStandSortParam` — URL `?sort=` → `StandSort`, anything
 * unrecognised (missing, stale, hand-edited) → `'kg'`; mirrors `parseStatsPeriodParam`. */
export function parseStandSortParam(raw: string | undefined | null): StandSort {
  return STAND_SORT_OPTIONS.some(opt => opt.value === raw) ? (raw as StandSort) : 'kg';
}
