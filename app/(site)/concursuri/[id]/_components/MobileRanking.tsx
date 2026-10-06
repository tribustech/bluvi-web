import { useMemo, useRef } from 'react';
import type { ColumnDefinition } from '@/core/competitions';
import { compareByStand, mainValueKey, type RankingRowData } from '@/components/ranking';
import { RANK_SCROLL_CAP_PHONE } from '@/components/ranking/shell';
import { cn } from '@/components/ui/cn';
import { CompetitionRankingTable } from './CompetitionRankingTable';
import { PRESSABLE_ROWS, useRowPress } from './rowPress';
import { GENERAL_TABLE_LAYOUT, RANKING_TABLE_FIXES, useTablePins } from './tableFixes';

/*
 * The phone ranking: fish's ScrollableTable (components/ranking-table/RankingTable.tsx) — a table on
 * the phone too, as every ranking type (ROADMAP §4b.12, §4b.15; the feeder and club tables are
 * tables at 375 as well). The kit RankingTable, the same one the desktop draws: the indigo header row
 * (RANKING_HEAD), the white Stand cell with the sector's 4px edge, every other cell in fish's 40%
 * sector tint (90% on a winner row), fish's grid lines; the Stand stays pinned at the left while the
 * other columns scroll sideways, the deciding totals pinned at the right when there is room
 * (tableFixes useTablePins / GENERAL_TABLE_LAYOUT, the «wide» half: the table always scrolls in its
 * own region here). The rows keep the bar's Sortare order (stand by default, as fish); the column
 * headers sort too. No avatars at this width (RankingFace, §4b.13). The region is viewport-high
 * (RANK_SCROLL_CAP_PHONE), so its header row sticks while the rows scroll.
 *
 * A table without catch columns (quantity, quality…) has no totals after its catches to pin: its
 * deciding columns — the main value and «Poziție generală» — close the table here (decidingLast) and
 * are pinned at the right, the name capped beside them (kit WIDTH), so Stand, name, value and Loc
 * are on the first screen at 375 and the rest (C.M.M.C, Nr. Buc, points, sector place) scrolls.
 */
function decidingLast(columns: ReadonlyArray<ColumnDefinition>): ReadonlyArray<ColumnDefinition> {
  if (columns.some(c => /^(catch|tier)\d+$/.test(c.key))) return columns;
  const main = mainValueKey(columns);
  const place = columns.find(c => c.key === 'generalPosition');
  const value = columns.find(c => c.key === main);
  if (!place || !value) return columns;
  return [...columns.filter(c => c !== place && c !== value), value, place];
}

export function MobileRanking({
  columns,
  rows,
  currentUserStandId,
  onRowPress,
}: {
  columns: ReadonlyArray<ColumnDefinition>;
  rows: ReadonlyArray<RankingRowData>;
  currentUserStandId: string | null;
  /** A row pressed: its stand (the angler stats open; parity statistici-pescar.c1). */
  onRowPress?: (standId: string) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const shown = useMemo(() => decidingLast(columns), [columns]);
  const pins = useTablePins(host, shown, rows.length);
  // The table sorts itself; it opens on the order the bar's Sortare built (stand or place).
  const byStand = useMemo(() => rows.every((r, i) => i === 0 || compareByStand(rows[i - 1], r) <= 0), [rows]);
  useRowPress<HTMLTableRowElement>(host, 'tbody tr', row => row.dataset.standId || null, onRowPress);
  return (
    <div
      ref={host}
      // Only the «wide» rules: without data-wide=false the region keeps its own sideways scroll.
      data-wide={pins.wide ? 'true' : undefined}
      data-fade={pins.wide && pins.fade ? 'true' : undefined}
      style={pins.style}
      className={cn(RANKING_TABLE_FIXES, GENERAL_TABLE_LAYOUT, PRESSABLE_ROWS)}
    >
      <CompetitionRankingTable
        // A new Sortare (the bar) starts the table over in that order.
        key={byStand ? 'stand' : 'place'}
        caption="Clasament general"
        columns={shown}
        rows={rows}
        currentUserStandId={currentUserStandId}
        initialSort={byStand ? 'stand' : 'place'}
        // Viewport-high, so the header row stays at the region's top while the rows scroll under
        // it (ROADMAP §4b.12) — at full height the whole table scrolled with the page, header too.
        maxHeight={RANK_SCROLL_CAP_PHONE}
      />
    </div>
  );
}
