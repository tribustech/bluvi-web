import { useMemo, useRef } from 'react';
import type { ColumnDefinition } from '@/core/competitions';
import { compareByStand, type RankingRowData } from '@/components/ranking';
import { cn } from '@/components/ui/cn';
import { CompetitionRankingTable } from './CompetitionRankingTable';
import { PRESSABLE_ROWS, useRowPress } from './rowPress';
import { GENERAL_TABLE_LAYOUT, RANKING_TABLE_FIXES, useTablePins } from './tableFixes';

/*
 * The phone ranking: fish's ScrollableTable (components/ranking-table/RankingTable.tsx), as fish draws
 * it (ROADMAP §4b.25): edge to edge, square, the indigo header row, 40px rows of 12/500 centred
 * text (the Stand bold, white, without the sector edge), the name on one line (ellipsis), fish's grid lines; the Stand stays pinned at the left while
 * the other columns scroll sideways, and the table is as tall as its rows — the page scrolls, as in
 * fish (no inner viewport cap, no right-pinned totals, no legend under it). The kit RankingTable,
 * the same one the desktop draws, restyled here for the phone only. The rows keep the bar's Sortare
 * order (stand by default, as fish); the column headers sort too.
 */
export function MobileRanking({
  columns,
  rows,
  currentUserStandId,
  onRowPress,
  sortNonce = 0,
}: {
  /** Bumped by every Sortare pick: the table starts over in the bar's order, the same pick too. */
  sortNonce?: number;
  columns: ReadonlyArray<ColumnDefinition>;
  rows: ReadonlyArray<RankingRowData>;
  currentUserStandId: string | null;
  /** A row pressed: its stand (the angler stats open; parity statistici-pescar.c1). */
  onRowPress?: (standId: string) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  // fish pins nothing at the right: every column after the Stand scrolls.
  const pinRight = useMemo<string[]>(() => [], []);
  const pins = useTablePins(host, columns, rows.length, rows);
  // The table sorts itself; it opens on the order the bar's Sortare built (stand or place).
  const byStand = useMemo(() => rows.every((r, i) => i === 0 || compareByStand(rows[i - 1], r) <= 0), [rows]);
  useRowPress<HTMLTableRowElement>(host, 'tbody tr', row => row.dataset.standId || null, onRowPress);
  const tableKey = `${byStand ? 'stand' : 'place'}-${sortNonce}`;
  return (
    <div
      ref={host}
      // Only the «wide» rules: without data-wide=false the region keeps its own sideways scroll.
      data-wide={pins.wide ? 'true' : undefined}
      data-fade={pins.wide && pins.fade ? 'true' : undefined}
      data-pinned={pins.wide ? pins.pinned : undefined}
      style={pins.style}
      className={cn(
        'relative',
        RANKING_TABLE_FIXES,
        GENERAL_TABLE_LAYOUT,
        PRESSABLE_ROWS,
        FISH_TABLE,
      )}
    >
      <CompetitionRankingTable
        // Every Sortare pick (the bar) starts the table over in that order — after a header sort,
        // the same pick too (sortNonce).
        key={tableKey}
        caption="Clasament general"
        columns={columns}
        rows={rows}
        pinRight={pinRight}
        currentUserStandId={currentUserStandId}
        initialSort={byStand ? 'stand' : 'place'}
        // fish: as tall as its rows, the page scrolls.
        maxHeight="none"
      />
    </div>
  );
}

/**
 * fish RankingTable on the phone: full bleed (the section's 16px gutter cancelled), square, the
 * header band without the card's rounded corners, CELL_HEIGHT 40, cells 12/500 centred (the main
 * value is not bolder), the name on one line with an ellipsis.
 */
const FISH_TABLE = cn(
  '-mx-4',
  '[&>[role=region]]:w-full [&>[role=region]]:rounded-none [&>[role=region]]:shadow-none',
  '[&_thead_th]:rounded-none [&_thead_button]:justify-center [&_thead_button]:text-center',
  '[&_tbody_tr]:h-10',
  // fish CELL_WIDTH 60 / PARTICIPANT_CELL_WIDTH 120, the header 60 tall in micro 10/600 (indigo).
  '[&_thead_tr]:h-15 [&_thead_th:not(:first-child)_button]:t-micro',
  '[&_tbody_th]:w-30 [&_tbody_th]:min-w-30 [&_tbody_th]:px-1 [&_tbody_th]:max-w-30 [&_tbody_td:not(:first-child)]:min-w-15',
  '[&_tbody_td]:t-caption [&_tbody_td]:font-medium [&_tbody_td]:text-center [&_tbody_th]:t-caption [&_tbody_th]:font-medium',
  '[&_tbody_th]:max-w-31 [&_tbody_th>span]:justify-center [&_tbody_th>span>span]:truncate [&_tbody_th>span>span]:whitespace-nowrap',
  // fish FrozenFirstCell: white, bold, centred, no sector edge.
  '[&_tbody_td:first-child]:pl-1 [&_tbody_td:first-child]:pr-1 [&_tbody_td:first-child]:font-bold [&_tbody_td:first-child>span:first-child]:hidden',
);
