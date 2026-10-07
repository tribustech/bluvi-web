import type { ColumnDefinition } from '@/core/competitions/domain/table/getTableColumns';
import { cn } from '@/components/ui/cn';
import { isNoCatch, readCell, tiedIndices, type RankingRowData } from './model';
import { EMPTY_STAND, winnerMode } from './rankingColumns';
import { parseStand } from './sector';
import { PenaltyMarker, WinnerTrophy } from './shell';

/*
 * The ranking table's legend — one module for every width (the desktop card's footer row, the
 * phone's line under the table): each key is the very element the cells draw, and only what this
 * ranking's visible columns draw is named (the gold biggest catch, SPLIT, the grey unscored catch,
 * the green won Best N, the trophies, the penalty markers, the no-catch «–», the tied place).
 */

type Marks = {
  biggest: boolean;
  split: boolean;
  unscored: boolean;
  tierWin: boolean;
  winner: boolean;
  sectorWinner: boolean;
  penalty: boolean;
  eliminated: boolean;
  tie: boolean;
};

/** Which marks the table draws for these columns and rows (RankingTable's own conditions). */
export function legendMarks(columns: ReadonlyArray<ColumnDefinition>, rows: ReadonlyArray<RankingRowData>): Marks {
  const keys = columns.map(c => c.key);
  const anyCell = (test: (cell: ReturnType<typeof readCell>) => boolean) => rows.some(r => keys.some(k => test(readCell(r[k]))));
  const catchNumbers = keys.map(k => /^catch(\d+)$/.exec(k)?.[1]).filter(Boolean).map(Number);
  const lastCatch = catchNumbers.length ? Math.max(...catchNumbers) : 0;
  const sectors = new Set(rows.map(r => parseStand(r.position).sector));
  return {
    // Quantity rankings never flag a cell (fish createQuantityRow): no gold cell, no entry.
    biggest: anyCell(c => c.isBiggest),
    split: anyCell(c => c.isSplit),
    unscored: rows.some(r => typeof r.sectorMinNumberOfFish === 'number' && r.sectorMinNumberOfFish < lastCatch),
    tierWin: anyCell(c => c.isTierWin),
    winner: keys.includes('generalPosition') && rows.some(r => r.isWinner && !isNoCatch(r) && r.participant !== EMPTY_STAND),
    sectorWinner:
      keys.includes('sectorPosition') && winnerMode(columns) === 'sector' && sectors.size > 1 && rows.some(r => r.sectorPosition === 1 && !isNoCatch(r) && r.participant !== EMPTY_STAND),
    penalty: rows.some(r => (r.penalties?.length ?? 0) > 0 && !r.penalties?.some(p => p.action === 'ELIMINATE')),
    eliminated: rows.some(r => r.penalties?.some(p => p.action === 'ELIMINATE')),
    tie: tiedIndices(rows).size > 0,
  };
}

const ITEM = 'flex items-center gap-1.5';

export function RankingLegend({
  columns,
  rows,
  className,
}: {
  columns: ReadonlyArray<ColumnDefinition>;
  rows: ReadonlyArray<RankingRowData>;
  /** Where it sits: the card's footer row (default) or its own block (the phone). */
  className?: string;
}) {
  const m = legendMarks(columns, rows);
  return (
    <ul
      aria-label="Legendă"
      // Like the band: the legend wraps to the table's width, never widens the card.
      className={cn(
        'flex flex-wrap [contain:inline-size] items-center gap-x-5 gap-y-2 t-caption text-muted',
        className ?? 'border-t border-hairline px-5 py-3.5 first:border-t-0',
      )}
    >
      {m.winner ? (
        <li className={ITEM}>
          <WinnerTrophy mark="prize" srText="" />
          câștigător
        </li>
      ) : null}
      {m.sectorWinner ? (
        <li className={ITEM}>
          <WinnerTrophy mark="sector" srText="" />
          câștigător de sector
        </li>
      ) : null}
      {m.biggest ? (
        <li className={ITEM}>
          <span aria-hidden className="size-3.5 rounded-[4px] bg-medal-gold" />
          C.M.M.C a concursului
        </li>
      ) : null}
      {m.tierWin ? (
        <li className={ITEM}>
          <span aria-hidden className="size-3.5 rounded-[4px] bg-success" />
          Best N la care s-a câștigat locul
        </li>
      ) : null}
      {m.unscored ? (
        <li className={ITEM}>
          <span aria-hidden className="size-3.5 rounded-[4px] bg-rank-unscored" />
          captură care nu se punctează
        </li>
      ) : null}
      {m.split ? (
        <li className={ITEM}>
          <span aria-hidden className="t-micro text-muted">
            SPLIT
          </span>
          puncte împărțite la egalitate în sector
        </li>
      ) : null}
      {m.penalty ? (
        <li className={ITEM}>
          <span aria-hidden className="flex">
            <PenaltyMarker eliminated={false} label="Echipa are penalizări" />
          </span>
          penalizare aplicată
        </li>
      ) : null}
      {m.eliminated ? (
        <li className={ITEM}>
          <span aria-hidden className="flex">
            <PenaltyMarker eliminated label="Echipa este eliminată" />
          </span>
          eliminat
        </li>
      ) : null}
      <li className={ITEM}>
        <span aria-hidden className="t-label text-ink">
          –
        </span>
        fără capturi
      </li>
      {m.tie ? (
        <li className={ITEM}>
          <span aria-hidden className="t-label text-ink tabular-nums">
            =4
          </span>
          egalitate la loc
        </li>
      ) : null}
    </ul>
  );
}
