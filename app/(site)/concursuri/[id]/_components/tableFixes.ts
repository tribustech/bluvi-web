import type { ColumnDefinition } from '@/core/competitions';
import { cellNumber, readCell, type RankingRowData } from '@/components/ranking/model';
import { mainValueKey } from './rankingColumns';

/*
 * Shared by the competition's ranking tables (FishTable and fish's feeder / club tables, every width).
 *
 *  - Rows mark the pointer and the keyboard focus (duration-fast) ON THE CELLS: every cell but the
 *    Stand paints its own fill (fish's sector tints, the grey «nu se punctează», the gold biggest
 *    catch, the Best-N band, the solid green won cell), so a row background only ever showed in the
 *    narrow white Stand cell. The plain cells take the soft tint, every filled cell goes a clear step
 *    darker (a filter, so it sits on whatever fill the cell has). A pressed row opens the angler
 *    (popover / sheet): the cue says the row is pressable.
 */
export const RANKING_TABLE_FIXES = [
  // Only the filter eases (a background transition would also ease the pinned cells' surface in
  // when the wide layout switches on).
  '[&_tbody_td]:transition-[filter] [&_tbody_th]:transition-[filter] [&_tbody_td]:duration-(--duration-fast) [&_tbody_th]:duration-(--duration-fast)',
  '[&_tbody_tr:hover>[data-fill]]:brightness-90 [&_tbody_tr:focus-visible>[data-fill]]:brightness-90',
  '[&_tbody_tr:not([data-me]):hover>*:not([data-fill])]:bg-soft-fill [&_tbody_tr:not([data-me]):focus-visible>*:not([data-fill])]:bg-soft-fill',
].join(' ');

/**
 * The value a ranking is decided on, as a column key: «Puncte total» for the point rankings, else
 * the main value (Cantitate, Calitate, Medie — rankingColumns mainValueKey). bestOfTiers has none of
 * them — each row's own Best N decides (its green cell): the Best-N column that decided the most
 * rows stands for the block (the most green cells, then the most values, then the smaller N, which
 * more anglers reach); without rows, the smallest Best N.
 */
export function decidingKey(columns: ReadonlyArray<ColumnDefinition>, rows?: ReadonlyArray<RankingRowData>): string | undefined {
  if (columns.some(c => c.key === 'totalPoints')) return 'totalPoints';
  const main = mainValueKey(columns);
  if (main) return main;
  const tiers = columns.filter(c => /^tier\d+$/.test(c.key)).map(c => c.key);
  const score = (key: string) => {
    const wins = rows?.filter(r => readCell(r[key]).isTierWin).length ?? 0;
    const values = rows?.filter(r => (cellNumber(r[key]) ?? 0) > 0).length ?? 0;
    return wins * 10_000 + values;
  };
  // Stable on ties: the tiers come ascending (Best 3 … Best 9), so the first best score is the smaller N.
  return tiers.reduce<string | undefined>((best, key) => (best === undefined || score(key) > score(best) ? key : best), undefined);
}
