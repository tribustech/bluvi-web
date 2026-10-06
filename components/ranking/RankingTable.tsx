'use client';

import { ChevronDownIcon, ChevronUpDownIcon, ChevronUpIcon } from '@heroicons/react/16/solid';
import { useMemo, useState } from 'react';
import type { ColumnDefinition } from '@/core/competitions/domain/table/getTableColumns';
import { cn } from '@/components/ui/cn';
import { cellNumber, isNoCatch, readCell, tiedIndices, type RankingRowData } from './model';
import { RankingFace, type RankingFaceData } from './RankingFace';
import {
  EMPTY_STAND,
  compareByStand,
  formatRankingPlain,
  formatRankingWeight,
  isPodium,
  mainValueKey,
  penaltyMarker,
  rankingColumns,
  winnerMode,
  type RankingColumn,
} from './rankingColumns';
import { parseStand, sectorFill } from './sector';
import { PenaltyMarker, PlaceCell, WinnerTrophy } from './shell';
import { RANKING_HEAD, RANKING_HEAD_TIER } from './tableHead';

/*
 * Ranking table · desktop (Fundații §07) — the competition's ranking table as it ships (the
 * competition page's CompetitionRankingTable wraps it with the page's faces; /dev/kit shows this
 * same table). fish components/ranking-table/RankingTable.tsx with the
 * builders' columns as they are (core getTableColumns: titles and order, parity clasament c7–c13),
 * drawn in the page's table language (the kit RankingTable's tokens: the coloured 40px header row
 * RANKING_HEAD, 52px rows, t-table, hairlines, sortable headers, the avatar beside each name from
 * 768 — ROADMAP §4b.12–13). A row without a catch reads «–» in its weights (§4b.11).
 *
 * What fish draws and the web draws differently, each for a reason the design system states:
 *  - the sector is the 4px edge on the Stand cell, never a fill under the row's text (fish tints
 *    every cell at 40%: Fundații §01 «niciodată ca fundal sub text … pe web devine prea zgomotos la
 *    24 de sectoare»);
 *  - fish's 🎖️ on a 90% fill becomes the ranking tables' one place idiom (./shell PlaceCell): the
 *    number, and a solid trophy for the podium (places 1–3 with a catch) on «Poziție generală».
 *    What `isWinner` means depends on the type (./rankingColumns winnerMode): the sector winners
 *    (general places 1..S) get a light muted trophy on «Poziție sector»; bestOf / bestOfTiers /
 *    Best N winners the trophy on the general place. No navy pill: on a 24-sector competition it
 *    turned the column into a wall of navy.
 * Everything else is fish: Stand order by default (the headers sort, «Poziție generală» = fish
 * Sortare → Poziția în clasament), three-decimal weights, the gold biggest-catch cell, grey catch
 * cells past the sector's minimum, SPLIT, the bestOfTiers indigo band with the solid green won
 * cell, one penalty marker per row.
 */

export type RankingTableSort = 'stand' | 'place';

type SortState = { key: string; dir: 'asc' | 'desc' };

function compare(a: RankingRowData, b: RankingRowData, col: RankingColumn): number {
  if (col.kind === 'stand') return compareByStand(a, b);
  if (col.kind === 'name') return a.participant.localeCompare(b.participant, 'ro');
  const va = cellNumber(a[col.key]);
  const vb = cellNumber(b[col.key]);
  if (va === null && vb === null) return 0;
  if (va === null) return 1;
  if (vb === null) return -1;
  return va - vb;
}

function defaultDir(col: RankingColumn): SortState['dir'] {
  // Bigger is better for weights and counts of catches; smaller for places and points.
  return col.kind === 'weight' || col.kind === 'catch' || col.kind === 'tier' || col.kind === 'count' ? 'desc' : 'asc';
}

const WIDTH: Partial<Record<RankingColumn['kind'], string>> = {
  stand: 'w-19',
  place: 'w-24',
};

export type RankingTableProps = {
  /** From getXColumns() (core/competitions/domain/table/getTableColumns), fish's order. */
  columns: ReadonlyArray<ColumnDefinition>;
  /** From createXRow() (core/competitions/domain/table/createTableRows). */
  rows: ReadonlyArray<RankingRowData>;
  /** The signed-in user's stand: that row is tinted and prefixed «Tu · ». */
  currentUserStandId?: string | null;
  /** Accessible table name, e.g. «Clasament general». */
  caption: string;
  /** The table scrolls inside this height so the header can stay stuck. */
  maxHeight?: string;
  /** fish's order: by stand (default), or by place (the phone's Sortare → Poziția în clasament). */
  initialSort?: RankingTableSort;
  /** The row's face (photo / team); without it every name gets its initials (ROADMAP §4b.13). */
  faceOf?: (row: RankingRowData) => RankingFaceData | null | undefined;
};

export function RankingTable({
  columns,
  rows,
  currentUserStandId,
  caption,
  maxHeight = 'min(70vh, 720px)',
  initialSort = 'stand',
  faceOf,
}: RankingTableProps) {
  const cols = useMemo(() => rankingColumns(columns), [columns]);
  const initial: SortState = useMemo(
    () => ({ key: initialSort === 'place' ? 'generalPosition' : 'position', dir: 'asc' }),
    [initialSort],
  );
  const [sort, setSort] = useState<SortState>(initial);
  // The default order is not a user choice: the header stays neutral (aria-sort still says it).
  const userSorted = sort.key !== initial.key || sort.dir !== initial.dir;

  const tied = useMemo(() => tiedIndices(rows), [rows]);
  const mainKey = useMemo(() => mainValueKey(columns), [columns]);
  const mode = useMemo(() => winnerMode(columns), [columns]);

  const sorted = useMemo(() => {
    const col = cols.find(c => c.key === sort.key);
    const indexed = rows.map((row, index) => ({ row, index }));
    if (!col) return indexed;
    const sign = sort.dir === 'asc' ? 1 : -1;
    return [...indexed].sort((a, b) => sign * compare(a.row, b.row, col) || a.index - b.index);
  }, [rows, cols, sort]);

  const onSort = (col: RankingColumn) =>
    setSort(s => (s.key === col.key ? { key: col.key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key: col.key, dir: defaultDir(col) }));

  const last = cols.length - 1;

  return (
    <div
      className="overflow-auto rounded-card bg-surface shadow-e0 [scrollbar-width:thin]"
      style={{ maxHeight }}
      tabIndex={0}
      role="region"
      aria-label={caption}
    >
      <table className="w-full min-w-[680px] border-separate border-spacing-0 tabular-nums">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {cols.map((col, i) => {
              const active = sort.key === col.key;
              const shown = active && userSorted;
              const Icon = !active ? ChevronUpDownIcon : sort.dir === 'asc' ? ChevronUpIcon : ChevronDownIcon;
              const icon = (
                <Icon
                  aria-hidden
                  className={cn('size-3.5 shrink-0', !shown && 'opacity-0 group-hover:opacity-60 group-focus-visible:opacity-60')}
                />
              );
              return (
                <th
                  key={col.key}
                  scope="col"
                  aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  className={cn(
                    'sticky top-0 z-above h-10 p-0 t-label whitespace-nowrap',
                    // fish getTierCellColors: the Best-N block's header in indigo4 with a dark label.
                    col.isTier ? RANKING_HEAD_TIER : RANKING_HEAD,
                    WIDTH[col.kind],
                    i === 0 && 'rounded-tl-card',
                    i === last && 'rounded-tr-card',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onSort(col)}
                    className={cn(
                      'group flex h-10 w-full items-center gap-0.5 outline-none focus-visible:bg-accent-tint focus-visible:text-accent-ink',
                      col.align === 'right' ? 'justify-end pr-3 pl-2' : 'justify-start pr-3',
                      i === 0 && 'pl-[18px]',
                      i === last && 'pr-3.5',
                      shown ? 'text-ink' : col.isTier ? '' : 'hover:text-ink',
                    )}
                  >
                    {col.align === 'right' && icon}
                    {col.title}
                    {col.align === 'left' && icon}
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map(({ row, index }) => {
            const me = currentUserStandId != null && row.standId === String(currentUserStandId);
            const noCatch = isNoCatch(row);
            const marker = penaltyMarker(row.penalties);
            const { sector, stand } = parseStand(row.position);
            const fill = sectorFill(sector, row.backgroundColor);
            const minFish = typeof row.sectorMinNumberOfFish === 'number' ? row.sectorMinNumberOfFish : undefined;
            const empty = row.participant === EMPTY_STAND;
            return (
              <tr
                key={row.standId ?? `${row.position}-${index}`}
                data-stand-id={row.standId}
                className={cn('h-[52px] t-table', me ? 'bg-accent-tint' : noCatch ? 'text-ink-2' : 'text-ink')}
              >
                {cols.map((col, i) => {
                  const edge = cn('border-t border-hairline', i === last && 'pr-3.5');

                  if (col.kind === 'stand') {
                    return (
                      <td key={col.key} className={cn(edge, 'relative pr-3 pl-[18px] text-left font-bold whitespace-nowrap')}>
                        {/* The sector: a 4px edge on the Stand cell (fish), never a fill under text. */}
                        <span aria-hidden className={cn('absolute inset-y-0 left-0 w-1', fill.className)} style={fill.style} />
                        <span className="sr-only">
                          Sector {sector}, stand {stand}
                        </span>
                        <span aria-hidden>
                          {sector}
                          {stand}
                        </span>
                      </td>
                    );
                  }
                  if (col.kind === 'name') {
                    return (
                      <th key={col.key} scope="row" className={cn(edge, 'pr-3 text-left font-bold')}>
                        <span className="flex min-w-0 items-center gap-1.5">
                          {empty ? null : <RankingFace name={row.participant} face={faceOf?.(row)} className="mr-1" />}
                          <span className="truncate">
                            {me && 'Tu · '}
                            {empty ? (
                              <>
                                <span aria-hidden>–</span>
                                <span className="sr-only">{EMPTY_STAND}</span>
                              </>
                            ) : (
                              row.participant
                            )}
                          </span>
                          {marker ? <PenaltyMarker {...marker} /> : null}
                        </span>
                      </th>
                    );
                  }
                  if (col.kind === 'place') {
                    // The podium (1–3 with a catch); bestOf-type winners ride on this place too.
                    const mark = empty ? null : mode === 'prize' && row.isWinner && !noCatch ? 'prize' : isPodium(row.generalPosition, noCatch) ? 'podium' : null;
                    return (
                      <td key={col.key} className={cn(edge, 'pr-3 pl-2 text-right')}>
                        <PlaceCell value={row.generalPosition} tied={tied.has(index)} mark={mark} onTint={me} align="end" />
                      </td>
                    );
                  }
                  if (col.kind === 'sectorPlace' && mode === 'sector' && row.isWinner && !noCatch && !empty) {
                    // A sector winner: the light cue on its sector place (fish: 🎖️ on every winner row).
                    return (
                      <td key={col.key} className={cn(edge, 'pr-3 pl-2 text-right whitespace-nowrap')}>
                        <span className="inline-flex items-center gap-1">
                          <WinnerTrophy mark="sector" />
                          {formatRankingPlain(row[col.key])}
                        </span>
                      </td>
                    );
                  }

                  const cell = readCell(row[col.key]);
                  const align = 'pr-3 pl-2 text-right whitespace-nowrap';
                  if (col.kind === 'catch') {
                    const n = Number(/^catch(\d+)$/.exec(col.key)?.[1] ?? 0);
                    // fish: catch cells past the row's sectorMinNumberOfFish are grey and empty (c21).
                    if (minFish !== undefined && n > minFish) {
                      return <td key={col.key} aria-label="nu se punctează" className={cn(edge, 'bg-soft-fill')} />;
                    }
                  }
                  if (noCatch && col.key === mainKey) {
                    // No catch: «–», as fish (never «capot», ROADMAP §4b.11).
                    return (
                      <td key={col.key} className={cn(edge, align, 'font-extrabold')}>
                        <span aria-hidden>–</span>
                        <span className="sr-only">Fără capturi</span>
                      </td>
                    );
                  }
                  const weight = col.kind === 'weight' || col.kind === 'catch' || col.kind === 'tier';
                  const text = weight ? (noCatch && col.kind !== 'tier' ? '–' : formatRankingWeight(row[col.key])) : formatRankingPlain(row[col.key]);
                  return (
                    <td
                      key={col.key}
                      data-biggest={cell.isBiggest || undefined}
                      data-tier-win={cell.isTierWin || undefined}
                      className={cn(
                        edge,
                        align,
                        col.key === mainKey && 'font-extrabold',
                        // fish getTierCellColors: the Best-N block one indigo band (a step deeper on a
                        // winner row), the cell the competitor won their place at solid green, bold.
                        cell.isTierWin
                          ? 'bg-success font-extrabold text-on-accent'
                          : cell.isTier
                            ? row.isWinner
                              ? 'bg-accent-tint-3'
                              : 'bg-accent-tint-2'
                            : // fish: the competition's biggest catch is gold with bold dark text (c19).
                              cell.isBiggest && 'bg-medal-gold font-extrabold text-on-medal',
                      )}
                    >
                      {cell.isBiggest && <span className="sr-only">Cea mai mare captură: </span>}
                      {cell.isTierWin && <span className="sr-only">Loc câștigat la: </span>}
                      {text}
                      {cell.isSplit && <sup className="ml-0.5 t-micro text-muted">SPLIT</sup>}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
