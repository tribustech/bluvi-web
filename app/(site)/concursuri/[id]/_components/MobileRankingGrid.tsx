import { ExclamationTriangleIcon, StarIcon, TrophyIcon } from '@heroicons/react/20/solid';
import type { ColumnDefinition } from '@/core/competitions';
import {
  formatPlain,
  formatWeight,
  isCapot,
  parseStand,
  penaltyChips,
  readCell,
  tiedIndices,
  toWebColumns,
  type RankingRowData,
  type WebColumn,
} from '@/components/ranking';
import { cn } from '@/components/ui/cn';
import { sectorInk } from './sectorInk';
import { standLabel } from './stand';

/*
 * fish components/ranking-table/RankingTable.tsx (ScrollableTable) on the phone: the builder's
 * columns in the builder's order with fish's titles, the Stand column frozen on the left, 60px
 * cells (120 for the participant), 60px header, 40px rows.
 *
 * Composed from the kit's ranking model (readCell, formatWeight, penaltyChips, …) because the kit
 * RankingTable re-sorts by place and has no frozen column, while fish opens sorted by stand and
 * the bar's Sortare decides the order. The sector is the 4px stripe; rows carry a light wash of
 * it, and winner rows are painted in the sector colour (fish: sector colour at 0.9 opacity, white
 * text) with an ink picked per hue (sectorInk): white is 1.9:1 on W, so light hues take navy.
 */

const WASH = { row: 10, winner: 90 };

export function MobileRankingGrid({
  columns,
  rows,
  caption,
}: {
  columns: ReadonlyArray<ColumnDefinition>;
  rows: ReadonlyArray<RankingRowData>;
  caption: string;
}) {
  const kinds = new Map<string, WebColumn>(toWebColumns(columns).map(c => [c.key, c]));
  const [first, ...rest] = columns;
  const tied = tiedIndices(rows);
  const mainKey = columns.some(c => c.key === 'quantity')
    ? 'quantity'
    : columns.find(c => kinds.get(c.key)?.kind === 'weight')?.key;

  return (
    <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none]" role="region" aria-label={caption} tabIndex={0}>
      <table className="border-separate border-spacing-0 tabular-nums">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th
              scope="col"
              className="sticky left-0 z-10 h-15 w-15 min-w-15 border border-hairline bg-accent-tint-2 px-1 t-caption text-accent"
            >
              {first.title}
            </th>
            {rest.map(col => (
              <th
                key={col.key}
                scope="col"
                className={cn(
                  'h-15 border border-hairline px-1 text-center t-micro',
                  col.key === 'participant' ? 'w-30 min-w-30' : 'w-15 min-w-15',
                  col.isTier ? 'bg-accent-tint text-accent-ink' : 'bg-accent-tint-2 text-accent',
                )}
              >
                {col.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const { sector, stand } = parseStand(row.position);
            const capot = isCapot(row);
            const wash = `color-mix(in srgb, ${row.backgroundColor} ${row.isWinner ? WASH.winner : WASH.row}%, var(--color-surface))`;
            const winnerInk = sectorInk(sector);
            const minFish = typeof row.sectorMinNumberOfFish === 'number' ? row.sectorMinNumberOfFish : undefined;
            return (
              <tr key={row.standId ?? `${row.position}-${index}`} className="h-10">
                <th
                  scope="row"
                  className="sticky left-0 z-10 border border-l-4 border-hairline bg-surface px-1 text-center t-label text-ink"
                  style={{ borderLeftColor: row.backgroundColor }}
                >
                  <span className="sr-only">Sector {sector}, stand {stand}</span>
                  <span aria-hidden>{standLabel(sector, stand)}</span>
                </th>
                {rest.map(col => {
                  const kind = kinds.get(col.key)?.kind;
                  const cell = readCell(row[col.key]);
                  const n = Number(/^catch(\d+)$/.exec(col.key)?.[1] ?? 0);
                  // fish greys out catch columns past the sector's minimum number of fish.
                  if (n > 0 && minFish !== undefined && n > minFish) {
                    return <td key={col.key} aria-label="nu se punctează" className="border border-hairline bg-soft-fill" />;
                  }
                  const fill = cell.isTierWin
                    ? 'bg-accent text-on-accent font-bold'
                    : cell.isTier
                      ? 'bg-accent-tint text-accent-ink'
                      : cell.isBiggest
                        ? 'bg-rating text-ink font-bold'
                        : '';
                  const style = fill ? undefined : { background: wash };
                  const onWinner = row.isWinner && !fill ? winnerInk : '';
                  const weightLike = kind === 'weight' || kind === 'catch';

                  if (col.key === 'participant') {
                    const chips = penaltyChips(row.penalties);
                    return (
                      <td key={col.key} className={cn('border border-hairline px-1 text-center', onWinner)} style={style}>
                        <span className="flex items-center justify-center gap-1">
                          <span className={cn('truncate t-caption', row.isWinner ? 'font-bold' : '')}>{row.participant}</span>
                          {chips.length ? (
                            <span title={chips.map(c => c.description).join(' · ')} className="shrink-0">
                              <ExclamationTriangleIcon aria-hidden className={cn('size-3', row.isWinner ? winnerInk : chips.some(c => c.tone === 'danger') ? 'text-status-danger-fg' : 'text-yellow-5')} />
                              <span className="sr-only">Penalizare: {chips.map(c => c.label).join(', ')}</span>
                            </span>
                          ) : null}
                        </span>
                      </td>
                    );
                  }

                  let text =
                    weightLike ? (capot ? '–' : formatWeight(row[col.key])) : formatPlain(row[col.key]);
                  if (col.key === 'generalPosition' && tied.has(index)) text = `=${text}`;
                  return (
                    <td
                      key={col.key}
                      className={cn(
                        'relative border border-hairline px-1 text-center t-caption whitespace-nowrap',
                        row.isWinner && !fill ? cn('font-bold', winnerInk) : '',
                        fill,
                      )}
                      style={style}
                    >
                      {cell.isBiggest ? (
                        <>
                          <StarIcon aria-hidden className="mr-0.5 inline size-2.5 align-[-1px]" />
                          <span className="sr-only">Cea mai mare captură: </span>
                        </>
                      ) : null}
                      {col.key === 'generalPosition' && row.isWinner ? (
                        <>
                          <TrophyIcon aria-hidden className={cn('mr-0.5 inline size-3 align-[-1px]', fill ? 'text-accent-ink' : winnerInk)} />
                          <span className="sr-only">Câștigător, </span>
                        </>
                      ) : null}
                      {col.key === mainKey && capot ? (
                        <>
                          <span aria-hidden>–</span>
                          <span className="sr-only">capot</span>
                        </>
                      ) : (
                        text
                      )}
                      {cell.isSplit ? <span className="absolute right-0.5 -bottom-0.5 t-nano">SPLIT</span> : null}
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
