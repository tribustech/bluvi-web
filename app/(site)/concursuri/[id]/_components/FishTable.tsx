'use client';

import { useId, useMemo, type CSSProperties, type ReactNode } from 'react';
import { cn } from '@/components/ui/cn';

/*
 * The phone's ranking table (below 768): fish components/ranking-table/RankingTable.tsx
 * (ScrollableTable), as fish draws it on the competition screen (owner 2026-10-10: «Nu arată așa în
 * fish, refă-l»; ROADMAP §4b.25). The desktop keeps the kit RankingTable.
 *
 *  - fish's dimensions: CELL_WIDTH 60, PARTICIPANT_CELL_WIDTH 120, the header 60 tall, 40px rows,
 *    padding 4, a 1px $gray4 border round every cell (two cells side by side: a 2px light line);
 *    the Stand column computeStandColumnWidth (7px a character + 16, 60–140), dynamic widths
 *    computeColumnWidth (6px a character + 40, clamped).
 *  - fish's type: the Stand head caption 12/600, the other heads micro 10/600, both $indigo5 on
 *    $indigo2 (a Best N head: indigo4 under #312E81); the Stand cell caption 12 bold black on white
 *    with the sector's 4px left border; every other cell 12/500 centred on one line (ellipsis).
 *  - fish's fills: the sector colour at 40% under black, a winner row at 90% under white, the gold
 *    biggest catch (bold, black), the Best N band / the solid green cell won at, grey and empty past
 *    the sector's minimum of fish.
 *  - fish's layout: the Stand column frozen, everything else in one sideways ScrollView without a
 *    scrollbar or bounce; the table as tall as its rows (the page scrolls; the header row scrolls
 *    away with it). The host is `marginHorizontal={-20}` inside the screen's 16px padding: the
 *    table starts 4px left of the screen (the Stand cell's sector edge is off screen) and ends 4px
 *    short of its right edge — drawn the same here (FISH_TABLE_BLEED).
 *
 * Web-only (the data and a11y conventions every ranking width shares): a real <table> (the frozen
 * column is a sticky first cell), the region named by its caption, the decimal comma and «–» from
 * the shared formatters, «Fără capturi» for a screen reader.
 */

/** fish RankingTable constants. */
const CELL_WIDTH = 60;
const PARTICIPANT_CELL_WIDTH = 120;
const DYNAMIC_WIDTH_PADDING = 40;
const DYNAMIC_WIDTH_CHAR = 6;
const STAND_CHAR_WIDTH = 7;
const STAND_CELL_PADDING = 16;
const STAND_MIN_WIDTH = 60;
const STAND_MAX_WIDTH = 140;

export type FishColumn = {
  key: string;
  title: string;
  width?: number;
  dynamicWidth?: { min?: number; max?: number };
  /** bestOfTiers «Best N»: the head shares the block's fill. */
  isTier?: boolean;
};

/** How fish fills a body cell (RankingTable backgroundColor chain). */
export type FishFill = 'sector' | 'grey' | 'tier' | 'tierWin' | 'biggest';

export type FishCell = {
  content: ReactNode;
  /** fish's text, for the column width (cellValueLength). */
  measure: string;
  fill?: FishFill;
  /** A split catch: fish's small «SPLIT» at the cell's bottom right. */
  split?: boolean;
  /** After the text (fish PenaltyCard beside the participant). */
  after?: ReactNode;
  /** The participant cell: a row header for the table's semantics. */
  rowHeader?: boolean;
  attrs?: Record<string, string | undefined>;
};

export type FishRow = {
  key: string;
  standId?: string;
  registrationId?: string;
  /** The frozen cell: its text, and what a screen reader hears instead. */
  stand: string;
  standSr?: string;
  /** The sector's colour (a CSS value): the frozen cell's edge and the fills. */
  color: string;
  winner: boolean;
  /** One per column after the first. */
  cells: FishCell[];
  attrs?: Record<string, string | undefined>;
};

/** fish computeColumnWidth. */
function columnWidth(column: FishColumn, values: string[]): number {
  if (column.dynamicWidth) {
    const min = column.dynamicWidth.min ?? CELL_WIDTH;
    const max = column.dynamicWidth.max ?? Number.POSITIVE_INFINITY;
    const len = Math.max(column.title.length, ...values.map(v => v.length));
    return Math.min(Math.max(len * DYNAMIC_WIDTH_CHAR + DYNAMIC_WIDTH_PADDING, min), max);
  }
  if (column.width != null) return column.width;
  if (column.key === 'participant') return PARTICIPANT_CELL_WIDTH;
  return CELL_WIDTH;
}

/** fish computeStandColumnWidth. */
function standWidth(column: FishColumn, values: string[]): number {
  const len = Math.max(column.title.length, ...values.map(v => v.length));
  return Math.min(Math.max(len * STAND_CHAR_WIDTH + STAND_CELL_PADDING, STAND_MIN_WIDTH), STAND_MAX_WIDTH);
}

const px = (w: number): CSSProperties => ({ width: w, minWidth: w, maxWidth: w });

/** fish TableCell: padding 4, the 1px $gray4 border, border-box. */
const CELL = 'box-border border border-fish-rk-line p-1 align-middle';

/**
 * The bleed: fish's `marginHorizontal={-20}` inside the 16px screen padding — 4px off the left edge,
 * 4px short of the right one. The host cancels the section's own 16px gutter.
 */
export const FISH_TABLE_BLEED = '-mx-4 overflow-hidden';

function fillClass(fill: FishFill, winner: boolean, tierWinnerRow: boolean): string {
  switch (fill) {
    case 'grey':
      return 'bg-fish-rk-line';
    case 'tierWin':
      return 'bg-fish-rk-tier-win font-bold! text-rank-on-dark';
    case 'tier':
      return cn(tierWinnerRow ? 'bg-fish-rk-tier-winner-row' : 'bg-fish-rk-tier', 'text-rank-on-light');
    case 'biggest':
      return 'bg-fish-rk-biggest font-bold! text-rank-on-light';
    default:
      return winner ? 'rank-sector-win text-rank-on-dark' : 'rank-sector-tint text-rank-on-light';
  }
}

export function FishTable({
  columns,
  rows,
  caption,
  className,
}: {
  columns: ReadonlyArray<FishColumn>;
  rows: ReadonlyArray<FishRow>;
  /** The region's name (the table's caption). */
  caption: string;
  className?: string;
}) {
  const widths = useMemo(
    () =>
      columns.map((col, i) => {
        const values = rows.map(r => (i === 0 ? r.stand : (r.cells[i - 1]?.measure ?? '')));
        if (i === 0 && col.key === 'position' && col.width == null) return standWidth(col, values);
        return columnWidth(col, values);
      }),
    [columns, rows],
  );
  const total = widths.reduce((a, b) => a + b, 0);

  return (
    <div
      role="region"
      aria-label={caption}
      tabIndex={0}
      data-fish-colours=""
      className={cn(
        // fish ScrollView horizontal: no scrollbar, no bounce.
        'w-full overflow-x-auto overscroll-x-none bg-rank-base [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        'outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-solid focus-visible:outline-accent',
        className,
      )}
    >
      <table className="table-fixed border-separate border-spacing-0 text-center" style={{ width: total }}>
        <caption className="sr-only">{caption}</caption>
        <colgroup>
          {widths.map((w, i) => (
            <col key={columns[i].key} style={{ width: w }} />
          ))}
        </colgroup>
        <thead>
          <tr className="h-15">
            {columns.map((col, i) => (
              <th
                key={col.key}
                scope="col"
                style={px(widths[i])}
                className={cn(
                  CELL,
                  'h-15 font-semibold! break-words',
                  col.isTier ? 'bg-fish-rk-tier-head text-fish-rk-tier-head-ink' : 'bg-fish-rk-head text-fish-rk-head-ink',
                  // fish: the Stand head in caption (12), the others in micro (10).
                  i === 0 ? 'sticky left-0 z-above t-caption' : 't-micro',
                )}
              >
                {col.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => {
            const tierWinnerRow = row.winner;
            return (
              <tr
                key={row.key}
                data-stand-id={row.standId}
                data-registration={row.registrationId}
                data-winner={row.winner || undefined}
                {...row.attrs}
                style={{ '--sector': row.color } as CSSProperties}
                className="h-10"
              >
                {/* fish FrozenFirstCell: white, caption bold black, the sector's 4px left border. */}
                <td
                  style={{ ...px(widths[0]), borderLeftColor: row.color }}
                  className={cn(CELL, 'sticky left-0 z-above h-10 border-l-4 bg-rank-base t-caption font-bold! text-rank-on-light')}
                >
                  {row.standSr ? <span className="sr-only">{row.standSr}</span> : null}
                  <span aria-hidden={row.standSr ? true : undefined} className="block truncate">
                    {row.stand}
                  </span>
                </td>
                {row.cells.map((cell, ci) => {
                  const Tag = cell.rowHeader ? 'th' : 'td';
                  const fill = cell.fill ?? 'sector';
                  return (
                    <Tag
                      key={columns[ci + 1]?.key ?? ci}
                      scope={cell.rowHeader ? 'row' : undefined}
                      data-fill=""
                      {...cell.attrs}
                      style={px(widths[ci + 1])}
                      className={cn(
                        CELL,
                        'relative h-10 t-caption',
                        // fish: 500, bold on the gold and the won-at cell (fillClass).
                        fill !== 'biggest' && fill !== 'tierWin' && 'font-medium!',
                        fillClass(fill, row.winner, tierWinnerRow),
                      )}
                    >
                      {fill === 'grey' ? (
                        cell.content
                      ) : (
                        <span className="flex min-w-0 items-center justify-center gap-1">
                          <span className="min-w-0 truncate">{cell.content}</span>
                          {cell.after}
                        </span>
                      )}
                      {cell.split ? (
                        // fish: micro «SPLIT» at bottom -4, right 0 (white on a winner row).
                        <sup className="absolute right-0 -bottom-1 t-micro leading-none">SPLIT</sup>
                      ) : null}
                    </Tag>
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

/** fish PenaltyCard: 10×14, radius 2, $yellow5 (penalised) or $red6 (eliminated). */
export function FishPenaltyCard({ eliminated, label, reasons }: { eliminated: boolean; label: string; reasons?: string }) {
  return (
    <span
      role="img"
      aria-label={label}
      title={reasons ? `${label}: ${reasons}` : label}
      className={cn('inline-block h-3.5 w-2.5 shrink-0 rounded-[2px]', eliminated ? 'bg-fish-rk-eliminated' : 'bg-fish-rk-penalty')}
    />
  );
}

/**
 * fish's pill strip (CompetitionRanking FeederLegTabs, NationalChampionshipRanking sectorPillRow):
 * 6/14 padding, radius 16, the selected pill filled (its own colour) under white, the others #f0f0f0
 * under $gray12. Native radios named by `label` (the arrow keys move the selection).
 */
export function FishPills<V extends string>({
  name,
  label,
  options,
  value,
  onChange,
  size,
  wrap = false,
  className,
}: {
  name: string;
  label: string;
  /** `active`: the selected pill's fill class (fish: #37474F for the legs, the sector's colour). */
  options: { value: V; label: string; active: string; style?: CSSProperties }[];
  value: V;
  onChange: (v: V) => void;
  /** fish: 13 for the legs, 12 for the sectors. */
  size: 13 | 12;
  /** The legs wrap (flexWrap); the sectors scroll sideways. */
  wrap?: boolean;
  className?: string;
}) {
  const uid = useId();
  return (
    <div
      role="radiogroup"
      aria-label={label}
      data-fish-colours=""
      className={cn('flex gap-2', wrap ? 'flex-wrap' : 'overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden', className)}
    >
      {options.map(o => {
        const selected = o.value === value;
        return (
          <label
            key={o.value}
            style={o.style}
            className={cn(
              // Typography's body line (22) under fontSize 13 / 12: a 34px pill.
              'flex h-8.5 shrink-0 cursor-pointer items-center rounded-2xl px-3.5 whitespace-nowrap active:opacity-85',
              size === 13 ? 't-control' : 't-caption',
              selected ? cn(o.active, 'font-semibold! text-fish-on') : 'bg-fish-chip font-medium! text-fish-rk-pill-ink',
              'has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-solid has-focus-visible:outline-accent',
            )}
          >
            <input
              type="radio"
              name={`${name}-${uid}`}
              value={o.value}
              checked={selected}
              onChange={() => onChange(o.value)}
              className="sr-only"
            />
            {o.label}
          </label>
        );
      })}
    </div>
  );
}
