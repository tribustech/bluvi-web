import { ChevronDownIcon } from '@heroicons/react/16/solid';
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { ColumnDefinition } from '@/core/competitions';
import { compareByStand, type RankingRowData } from '@/components/ranking';
import { RANK_SCROLL_CAP_PHONE } from '@/components/ranking/shell';
import { cn } from '@/components/ui/cn';
import { formatCount } from '@/core/realtime/chat/format';
import { CompetitionRankingTable } from './CompetitionRankingTable';
import { PRESSABLE_ROWS, useRowPress } from './rowPress';
import { RankingLegend } from '@/components/ranking/RankingLegend';
import { GENERAL_TABLE_LAYOUT, RANKING_TABLE_FIXES, rankingPinKeys, useTablePins } from './tableFixes';

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
 * (RANK_SCROLL_CAP_PHONE), so its header row sticks while the rows scroll. While rows are still
 * below its bottom edge the region says so: its bottom fades, its rounded end squares off, and a
 * «Încă N pescari» line under it (pressing it scrolls the region on) — the card never looks finished
 * while anglers wait in the inner scroll (useRowsBelow).
 *
 * fish's columns in fish's order (parity clasament c7–c13), never reordered: the deciding columns —
 * «Poziție generală» and the value the ranking is decided on (Cantitate / Calitate / Medie / Puncte
 * total; bestOfTiers: its last Best N) — wait pinned at the right edge (tableFixes rankingPinKeys,
 * `sticky` in place), the name capped beside them (kit WIDTH), so Stand, name, value and Loc are on
 * the first screen at 375 and the rest scrolls between them. The legend under the table names the
 * marks the cells draw (RankingLegend).
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
  const pinRight = useMemo(() => rankingPinKeys(columns, rows), [columns, rows]);
  const pins = useTablePins(host, columns, rows.length, rows);
  // The table sorts itself; it opens on the order the bar's Sortare built (stand or place).
  const byStand = useMemo(() => rows.every((r, i) => i === 0 || compareByStand(rows[i - 1], r) <= 0), [rows]);
  useRowPress<HTMLTableRowElement>(host, 'tbody tr', row => row.dataset.standId || null, onRowPress);
  const tableKey = `${byStand ? 'stand' : 'place'}-${sortNonce}`;
  const below = useRowsBelow(host, tableKey, rows.length);
  return (
    <>
    <div
      ref={host}
      data-rows-below={below || undefined}
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
        // More rows below: the region's end is not the table's end (no rounded bottom).
        below > 0 && '[&>[role=region]]:rounded-b-none',
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
        // Viewport-high, so the header row stays at the region's top while the rows scroll under
        // it (ROADMAP §4b.12) — at full height the whole table scrolled with the page, header too.
        maxHeight={RANK_SCROLL_CAP_PHONE}
      />
      {below > 0 ? (
        <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 z-above h-10 bg-linear-to-b from-transparent to-surface" />
      ) : null}
    </div>
    {below > 0 ? (
      <button
        type="button"
        data-rows-below-cue=""
        onClick={() => {
          const region = host.current?.querySelector<HTMLElement>('[role=region]');
          region?.scrollBy({ top: region.clientHeight * 0.8, behavior: 'smooth' });
        }}
        className="flex min-h-11 w-full items-center justify-center gap-1 rounded-b-card border-t border-hairline bg-surface t-label text-accent-ink shadow-e0 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-solid focus-visible:outline-accent"
      >
        Încă {formatCount(below, 'pescar', 'pescari')} în tabel
        <ChevronDownIcon aria-hidden className="size-4" />
      </button>
    ) : null}
    <RankingLegend columns={columns} rows={rows} className="mt-2 rounded-card bg-surface px-4 py-3 shadow-e0" />
    </>
  );
}

/**
 * How many rows sit (even partly) below the scroll region's bottom edge: the cue under the phone
 * table. Re-measured on the region's own scroll and on any resize; a new table (`key`) re-binds.
 */
function useRowsBelow(host: RefObject<HTMLDivElement | null>, key: string, count: number): number {
  const [below, setBelow] = useState(0);
  useEffect(() => {
    const region = host.current?.querySelector<HTMLElement>('[role=region]');
    if (!region) return;
    const update = () => {
      const edge = region.getBoundingClientRect().bottom + 1;
      let n = 0;
      for (const tr of region.querySelectorAll<HTMLElement>('tbody tr')) if (tr.getBoundingClientRect().bottom > edge) n += 1;
      setBelow(n);
    };
    update();
    region.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(region);
    const table = region.querySelector('table');
    if (table) ro.observe(table);
    return () => {
      region.removeEventListener('scroll', update);
      ro.disconnect();
    };
  }, [host, key, count]);
  return below;
}
