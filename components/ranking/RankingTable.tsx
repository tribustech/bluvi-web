'use client';

import { ChevronDownIcon, ChevronUpDownIcon, ChevronUpIcon } from '@heroicons/react/16/solid';
import { useMemo, useState, type CSSProperties } from 'react';
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
import { parseStand, sectorFill, sectorInk, sectorVar } from './sector';
import { PenaltyMarker, PlaceCell, WinnerTrophy } from './shell';
import { RANKING_HEAD, RANKING_HEAD_TIER } from './tableHead';

/*
 * Ranking table · desktop (Fundații §07) — the competition's ranking table as it ships (the
 * competition page's CompetitionRankingTable wraps it with the page's faces; /dev/kit shows this
 * same table). fish components/ranking-table/RankingTable.tsx with the
 * builders' columns as they are (core getTableColumns: titles and order, parity clasament c7–c13),
 * drawn in fish's colour language (ROADMAP §4b.15): the indigo header row (RANKING_HEAD, its titles
 * wrapping on two lines over narrow columns), the white Stand cell with the sector's 4px edge, every
 * other cell in the sector's colour — 40% under black, a winner row (`isWinner`) 90% under white or
 * black, whichever clears AA for that sector (sector.ts sectorInk) — and fish's grid lines. Compact
 * (§4b.16): fish's widths as the tracks, the region only as wide as the table. Sortable headers,
 * the avatar beside each name from 768 (§4b.13). A row without a catch reads «–» in its weights
 * (§4b.11).
 *
 * Kept from the web's ranking idiom: fish's 🎖️ becomes the tables' one place mark (./shell
 * PlaceCell), a trophy in the cell's own ink — on «Poziție generală» for the podium (places 1–3
 * with a catch) and bestOf / bestOfTiers / Best N winners, on «Poziție sector» for the sector
 * winners (./rankingColumns winnerMode).
 * Everything else is fish: Stand order by default (the headers sort, «Poziție generală» = fish
 * Sortare → Poziția în clasament), three-decimal weights, the gold biggest-catch cell, grey catch
 * cells past the sector's minimum, SPLIT, the bestOfTiers indigo band with the solid green won
 * cell, one penalty marker per row.
 */

export type RankingTableSort = 'stand' | 'place';

/**
 * The viewer's own row (`data-me`): every cell but the Stand paints its own fill (the sector tint,
 * the gold, the Best-N band), so a row background alone hides under them. The mark rides over any
 * fill instead: a 3px accent-ink rule along the top and bottom of every cell (a background image, so the
 * pinned cells' edge shadows stay theirs), and the white Stand cell in the accent tint; the name keeps «Tu · ».
 */
export const ME_ROW = [
  '[&>*]:[background-image:linear-gradient(var(--color-accent-ink),var(--color-accent-ink)),linear-gradient(var(--color-accent-ink),var(--color-accent-ink))]',
  '[&>*]:[background-size:100%_3px,100%_3px] [&>*]:[background-position:top,bottom] [&>*]:bg-no-repeat',
  '[&>*:not([data-fill])]:bg-accent-tint',
].join(' ');

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

/**
 * Column tracks, fish's widths as the baseline (CELL_WIDTH 60, a 60–140 Stand), a step wider for
 * the web's 14px digits and the sort chevron: every number column is a fixed narrow track whose
 * title wraps (fish's 60px header), the name takes what is left (ROADMAP §4b.16: the table is only
 * as wide as its content).
 */
const WIDTH: Record<RankingColumn['kind'], string> = {
  stand: 'w-19',
  // Below 768 the name is capped (as the feeder table's NAME_W; 104px with a slimmer right padding),
  // its words wrapping balanced, so Stand, the name, the deciding value and Loc share a 375 phone's
  // 343px card (tableFixes useTablePins pins the value and Loc at the right).
  name: 'max-md:w-26 max-md:max-w-26 max-md:min-w-26 md:min-w-48',
  place: 'w-20',
  sectorPlace: 'w-20',
  weight: 'w-21',
  catch: 'w-18',
  tier: 'w-21',
  count: 'w-18',
  points: 'w-18',
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
      // As wide as its columns (ROADMAP §4b.16), never wider than its container (then it scrolls).
      className="w-fit max-w-full overflow-auto rounded-card bg-surface shadow-e0 [scrollbar-width:thin]"
      style={{ maxHeight }}
      tabIndex={0}
      role="region"
      aria-label={caption}
    >
      <table className="w-full border-separate border-spacing-0 tabular-nums">
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
                    // fish HeaderCell: the indigo band, its titles wrap on two lines in a narrow column.
                    'sticky top-0 z-above p-0 t-label',
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
                      'group flex min-h-11 w-full items-center gap-0.5 py-1 outline-none focus-visible:bg-accent-tint focus-visible:text-accent-ink',
                      col.align === 'right' ? 'justify-end pr-2.5 pl-1.5 text-right' : 'justify-start pr-3 text-left',
                      i === 0 && 'pl-[18px]',
                      i === last && 'pr-3.5',
                      col.kind === 'name' ? 'whitespace-nowrap' : 'text-balance',
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
            // fish RankingTable: every value cell in the sector's colour — 40% under black, a
            // winner row 90% under white or black (whichever clears AA for that sector).
            const win = !!row.isWinner && !empty;
            const sectorCell = win ? cn('rank-sector-win', sectorInk(sector, 'win')) : 'rank-sector-tint text-rank-on-light';
            return (
              <tr
                key={row.standId ?? `${row.position}-${index}`}
                data-stand-id={row.standId}
                data-winner={win || undefined}
                data-me={me || undefined}
                style={sectorVar(sector, row.backgroundColor) as CSSProperties}
                className={cn('h-12 t-table text-ink', me && cn('bg-accent-tint', ME_ROW))}
              >
                {cols.map((col, i) => {
                  const edge = cn('border-t border-rank-line', i > 0 && 'border-l', i === last && 'pr-3.5');

                  if (col.kind === 'stand') {
                    return (
                      <td key={col.key} className={cn(edge, 'relative pr-3 pl-[18px] text-left font-bold whitespace-nowrap')}>
                        {/* fish: the Stand cell stays white, the sector its 4px left edge. */}
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
                      <th key={col.key} scope="row" data-fill="" className={cn(edge, sectorCell, 'pr-2 pl-2.5 text-left font-bold md:pr-3')}>
                        <span className="flex min-w-0 items-center gap-1.5">
                          {empty ? null : <RankingFace name={row.participant} face={faceOf?.(row)} className="mr-1" />}
                          <span className="max-md:text-balance max-md:break-normal md:truncate">
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
                      <td key={col.key} data-fill="" className={cn(edge, sectorCell, 'pr-3 pl-2 text-right')}>
                        <PlaceCell value={row.generalPosition} tied={tied.has(index)} mark={mark} onFill align="end" />
                      </td>
                    );
                  }
                  if (col.kind === 'sectorPlace' && mode === 'sector' && row.isWinner && !noCatch && !empty) {
                    // A sector winner: the trophy on its sector place (fish: 🎖️ on every winner row).
                    return (
                      <td key={col.key} data-fill="" className={cn(edge, sectorCell, 'pr-2.5 pl-1.5 text-right whitespace-nowrap')}>
                        <span className="inline-flex items-center gap-1 align-middle">
                          <WinnerTrophy mark="sector" inherit />
                          {formatRankingPlain(row[col.key])}
                        </span>
                      </td>
                    );
                  }

                  const cell = readCell(row[col.key]);
                  const align = 'pr-2.5 pl-1.5 text-right whitespace-nowrap';
                  if (col.kind === 'catch') {
                    const n = Number(/^catch(\d+)$/.exec(col.key)?.[1] ?? 0);
                    // fish: catch cells past the row's sectorMinNumberOfFish are grey and empty (c21).
                    if (minFish !== undefined && n > minFish) {
                      return <td key={col.key} data-fill="" aria-label="nu se punctează" className={cn(edge, 'bg-rank-unscored')} />;
                    }
                  }
                  if (noCatch && col.key === mainKey) {
                    // No catch: «–», as fish (never «capot», ROADMAP §4b.11).
                    return (
                      <td key={col.key} data-fill="" className={cn(edge, sectorCell, align, 'font-extrabold')}>
                        <span aria-hidden>–</span>
                        <span className="sr-only">Fără capturi</span>
                      </td>
                    );
                  }
                  const weight = col.kind === 'weight' || col.kind === 'catch' || col.kind === 'tier';
                  // A Best-N cell the row never reached (fewer catches than N: the builder's 0.000)
                  // reads «–» like its catch cells (§4b.11), on the same indigo band.
                  const tierN = col.kind === 'tier' ? Number(/^tier(\d+)$/.exec(col.key)?.[1] ?? 0) : 0;
                  const unreached =
                    col.kind === 'tier' && !cell.isTierWin && (noCatch || (typeof row.catchCount === 'number' && row.catchCount < tierN && !cellNumber(row[col.key])));
                  const text = unreached ? (
                    <>
                      <span aria-hidden>–</span>
                      <span className="sr-only">{noCatch ? 'Fără capturi' : `Sub ${tierN} capturi`}</span>
                    </>
                  ) : weight ? (
                    noCatch ? '–' : formatRankingWeight(row[col.key])
                  ) : (
                    formatRankingPlain(row[col.key])
                  );
                  return (
                    <td
                      key={col.key}
                      data-fill=""
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
                              cell.isBiggest
                              ? 'bg-medal-gold font-extrabold text-on-medal'
                              : sectorCell,
                      )}
                    >
                      {cell.isBiggest && <span className="sr-only">Cea mai mare captură: </span>}
                      {cell.isTierWin && <span className="sr-only">Loc câștigat la: </span>}
                      {text}
                      {cell.isSplit && <sup className="ml-0.5 t-micro">SPLIT</sup>}
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
