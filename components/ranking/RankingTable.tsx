'use client';

import { ChevronDownIcon, ChevronUpDownIcon, ChevronUpIcon } from '@heroicons/react/16/solid';
import { StarIcon } from '@heroicons/react/20/solid';
import { useMemo, useState } from 'react';
import type { ColumnDefinition } from '@/core/competitions/domain/table/getTableColumns';
import { CapotChip, Tag } from '@/components/cards/parts';
import { toWebColumns, type WebColumn } from './columns';
import {
  cellNumber,
  formatPlain,
  formatWeight,
  isCapot,
  penaltyChips,
  readCell,
  tiedIndices,
  type RankingRowData,
} from './model';
import { parseStand, sectorFill } from './sector';

export type RankingTableProps = {
  /** From getXColumns() in core/competitions/domain/table/getTableColumns. */
  columns: ReadonlyArray<ColumnDefinition>;
  /** From createXRow() in core/competitions/domain/table/createTableRows, in ranking order. */
  rows: ReadonlyArray<RankingRowData>;
  /** The signed-in user's stand: that row is tinted and prefixed "Tu · ". */
  currentUserStandId?: string | null;
  /** Accessible table name, e.g. "Clasament general". */
  caption: string;
  /** The table scrolls inside this height so the header can stay stuck. */
  maxHeight?: string;
};

type SortState = { key: string; dir: 'asc' | 'desc' };

const INITIAL_SORT: SortState = { key: 'generalPosition', dir: 'asc' };

function standSortKey(position: string): [string, number, string] {
  const { sector, stand } = parseStand(position);
  const n = Number.parseInt(stand, 10);
  return [sector, Number.isNaN(n) ? Number.POSITIVE_INFINITY : n, stand];
}

function compare(a: RankingRowData, b: RankingRowData, col: WebColumn): number {
  if (col.kind === 'stand') {
    const [sa, na, ra] = standSortKey(a.position);
    const [sb, nb, rb] = standSortKey(b.position);
    return sa.localeCompare(sb) || na - nb || ra.localeCompare(rb);
  }
  if (col.kind === 'name') return a.participant.localeCompare(b.participant, 'ro');
  const va = cellNumber(a[col.key]);
  const vb = cellNumber(b[col.key]);
  if (va === null && vb === null) return 0;
  if (va === null) return 1;
  if (vb === null) return -1;
  return va - vb;
}

function defaultDir(col: WebColumn): SortState['dir'] {
  // Bigger is better for weights and counts of catches; smaller for places and points.
  return col.kind === 'weight' || col.kind === 'catch' || col.key === 'catchCount' || col.key === 'bestOfCount'
    ? 'desc'
    : 'asc';
}

const WIDTH: Record<WebColumn['kind'], string> = {
  place: 'w-[64px]',
  stand: 'w-[90px]',
  name: '',
  weight: 'w-[96px]',
  count: 'w-[90px]',
  points: 'w-[84px]',
  catch: 'w-[72px]',
};

/**
 * Ranking table · desktop (Fundații §07): sticky header, tabular numbers, sortable columns, the
 * sector only as a 4px stripe on the row edge — never a cell fill or a dot.
 */
export function RankingTable({
  columns,
  rows,
  currentUserStandId,
  caption,
  maxHeight = 'min(70vh, 720px)',
}: RankingTableProps) {
  const webColumns = useMemo(() => toWebColumns(columns), [columns]);
  const [sort, setSort] = useState<SortState>(INITIAL_SORT);
  // The default order is not a user choice: the header stays neutral (aria-sort still says it).
  const userSorted = sort.key !== INITIAL_SORT.key || sort.dir !== INITIAL_SORT.dir;

  const tied = useMemo(() => tiedIndices(rows), [rows]);
  const mainValueKey = useMemo(
    () => (webColumns.some(c => c.key === 'quantity') ? 'quantity' : webColumns.find(c => c.kind === 'weight')?.key),
    [webColumns],
  );

  const sorted = useMemo(() => {
    const col = webColumns.find(c => c.key === sort.key);
    const indexed = rows.map((row, index) => ({ row, index }));
    if (!col) return indexed;
    const sign = sort.dir === 'asc' ? 1 : -1;
    return [...indexed].sort((a, b) => sign * compare(a.row, b.row, col) || a.index - b.index);
  }, [rows, webColumns, sort]);

  const onSort = (col: WebColumn) =>
    setSort(s =>
      s.key === col.key ? { key: col.key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key: col.key, dir: defaultDir(col) },
    );

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
            {webColumns.map((col, i) => {
              const active = sort.key === col.key;
              const shown = active && userSorted;
              const Icon = !active ? ChevronUpDownIcon : sort.dir === 'asc' ? ChevronUpIcon : ChevronDownIcon;
              return (
                <th
                  key={col.key}
                  scope="col"
                  aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  className={`sticky top-0 z-above h-10 bg-page p-0 t-label whitespace-nowrap text-ink-2 ${
                    WIDTH[col.kind]
                  } ${i === 0 ? 'rounded-tl-card' : ''} ${i === webColumns.length - 1 ? 'rounded-tr-card' : ''}`}
                >
                  <button
                    type="button"
                    onClick={() => onSort(col)}
                    className={`group flex h-10 w-full items-center gap-0.5 outline-none focus-visible:bg-accent-tint focus-visible:text-accent-ink ${
                      col.align === 'right' ? 'justify-end' : 'justify-start'
                    } ${i === 0 ? 'pl-[18px]' : ''} ${i === webColumns.length - 1 ? 'pr-3.5' : col.align === 'right' ? 'pr-0' : ''} ${
                      shown ? 'text-accent-ink' : 'hover:text-ink'
                    }`}
                  >
                    {col.align === 'right' && (
                      <Icon
                        aria-hidden
                        className={`size-3.5 shrink-0 ${shown ? '' : 'opacity-0 group-hover:opacity-60 group-focus-visible:opacity-60'}`}
                      />
                    )}
                    {col.title}
                    {col.align === 'left' && (
                      <Icon
                        aria-hidden
                        className={`size-3.5 shrink-0 ${shown ? '' : 'opacity-0 group-hover:opacity-60 group-focus-visible:opacity-60'}`}
                      />
                    )}
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map(({ row, index }) => {
            const me = currentUserStandId != null && row.standId === String(currentUserStandId);
            const capot = isCapot(row);
            const chips = penaltyChips(row.penalties);
            const { sector, stand } = parseStand(row.position);
            const fill = sectorFill(sector, row.backgroundColor);
            const minFish = typeof row.sectorMinNumberOfFish === 'number' ? row.sectorMinNumberOfFish : undefined;
            return (
              <tr
                key={row.standId ?? `${row.position}-${index}`}
                className={`h-[52px] t-table ${
                  me ? 'bg-accent-tint' : capot ? 'text-ink-2' : 'text-ink'
                }`}
              >
                {webColumns.map((col, i) => {
                  const edge = `border-t border-hairline ${i === webColumns.length - 1 ? 'pr-3.5' : ''}`;
                  const align = col.align === 'right' ? 'text-right' : 'text-left';

                  if (col.kind === 'place') {
                    return (
                      <th
                        key={col.key}
                        scope="row"
                        className={`${edge} ${align} relative pl-[18px] t-num-18 ${me ? 'text-accent-ink' : ''}`}
                      >
                        {/* The sector stripe: 4px on the row edge, never a fill under text. */}
                        <span aria-hidden className={`absolute inset-y-0 left-0 w-1 ${fill.className}`} style={fill.style} />
                        {tied.has(index) && <span aria-label="egal">=</span>}
                        {row.generalPosition}
                      </th>
                    );
                  }
                  if (col.kind === 'stand') {
                    return (
                      <td key={col.key} className={`${edge} ${align} font-bold whitespace-nowrap`}>
                        <span className="sr-only">Sector {sector}, stand {stand}</span>
                        <span aria-hidden>
                          {sector}
                          {stand}
                        </span>
                      </td>
                    );
                  }
                  if (col.kind === 'name') {
                    return (
                      <td key={col.key} className={`${edge} ${align} pr-3 font-bold`}>
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span className="truncate">
                            {me && 'Tu · '}
                            {row.participant}
                          </span>
                          {chips.map((c, ci) => (
                            <Tag key={ci} tone={c.tone === 'danger' ? 'red' : 'yellow'} size="sm" title={c.description}>
                              {c.label}
                            </Tag>
                          ))}
                        </span>
                      </td>
                    );
                  }

                  const cell = readCell(row[col.key]);
                  if (col.kind === 'catch') {
                    const n = Number(/^catch(\d+)$/.exec(col.key)?.[1] ?? 0);
                    if (minFish !== undefined && n > minFish) {
                      return <td key={col.key} aria-label="nu se punctează" className={`${edge} bg-soft-fill`} />;
                    }
                  }
                  if (capot && col.key === mainValueKey) {
                    return (
                      <td key={col.key} className={`${edge} ${align}`}>
                        <CapotChip size="sm" />
                      </td>
                    );
                  }
                  const text =
                    col.kind === 'weight' || col.kind === 'catch'
                      ? capot
                        ? '–'
                        : formatWeight(row[col.key])
                      : formatPlain(row[col.key]);
                  const strong =
                    col.key === mainValueKey
                      ? 't-heading font-extrabold'
                      : col.kind === 'points' && /total|^quantityPoints$|^qualityPoints$/.test(col.key)
                        ? 'font-bold'
                        : '';
                  return (
                    <td
                      key={col.key}
                      className={`${edge} ${align} whitespace-nowrap ${strong} ${
                        cell.isTierWin ? 'font-extrabold text-accent-ink' : cell.isTier ? 'text-ink-2' : ''
                      }`}
                    >
                      {cell.isBiggest && (
                        <>
                          <StarIcon aria-hidden className="mr-0.5 inline size-3 align-[-1px] text-rating" />
                          <span className="sr-only">Cea mai mare captură: </span>
                        </>
                      )}
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
