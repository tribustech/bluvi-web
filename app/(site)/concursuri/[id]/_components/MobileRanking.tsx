import { useMemo, useRef } from 'react';
import type { ColumnDefinition } from '@/core/competitions';
import {
  EMPTY_STAND,
  cellNumber,
  formatRankingPlain,
  formatRankingWeight,
  isNoCatch,
  mainValueKey,
  parseStand,
  penaltyMarker,
  readCell,
  rankingColumns,
  type RankingRowData,
} from '@/components/ranking';
import { cn } from '@/components/ui/cn';
import { FISH_TABLE_BLEED, FishPenaltyCard, FishTable, type FishCell, type FishRow } from './FishTable';
import { PRESSABLE_ROWS, useRowPress } from './rowPress';

/*
 * The phone ranking (below 768): fish's ScrollableTable (FishTable) on the builders' columns and rows
 * (core getTableColumns / createTableRows), in the order the bar's Sortare built (stand by default,
 * as fish). fish's table has no header sort, no legend, no own-row mark: neither has this one. A row
 * pressed opens its angler (fish onRowPress on the Stand and participant cells; here the whole row).
 */
export function MobileRanking({
  columns,
  rows,
  onRowPress,
}: {
  columns: ReadonlyArray<ColumnDefinition>;
  rows: ReadonlyArray<RankingRowData>;
  /** A row pressed: its stand (the angler stats open; parity statistici-pescar.c1). */
  onRowPress?: (standId: string) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  useRowPress<HTMLTableRowElement>(host, 'tbody tr', row => row.dataset.standId || null, onRowPress);
  const fishRows = useMemo(() => standardFishRows(columns, rows), [columns, rows]);
  return (
    <div ref={host} className={cn(FISH_TABLE_BLEED, PRESSABLE_ROWS, PRESSED)}>
      <FishTable caption="Clasament general" columns={columns} rows={fishRows} className="-ml-1" />
    </div>
  );
}

/** fish: a pressed Stand / participant cell at 60% (Pressable opacity); no hover tint on a phone. */
const PRESSED = '[&_tbody_tr[data-pressable]:active>*:nth-child(-n+2)]:opacity-60';

/**
 * fish RankingTable's cell rules on the builders' rows. The values keep the page's shared formats
 * (decimal comma, «–», ROADMAP §4b.11's «–» + «Fără capturi» for a row without a catch); the
 * widths are measured on fish's own strings (cellValueLength).
 */
export function standardFishRows(columns: ReadonlyArray<ColumnDefinition>, rows: ReadonlyArray<RankingRowData>): FishRow[] {
  const cols = rankingColumns(columns).slice(1);
  const mainKey = mainValueKey(columns);
  return rows.map((row, index) => {
    const { sector, stand } = parseStand(row.position);
    const noCatch = isNoCatch(row);
    const empty = row.participant === EMPTY_STAND;
    // As every ranking width: a row without a catch (or an empty stand) is never a winner.
    const winner = !!row.isWinner && !noCatch && !empty;
    const minFish = typeof row.sectorMinNumberOfFish === 'number' ? row.sectorMinNumberOfFish : undefined;
    const marker = penaltyMarker(row.penalties);
    const cells = cols.map((col): FishCell => {
      const raw = row[col.key];
      const cell = readCell(raw);
      const measure = cell.raw == null ? '' : String(cell.raw);
      if (col.kind === 'name') {
        return {
          rowHeader: true,
          measure: row.participant,
          content: empty ? (
            <>
              <span aria-hidden>–</span>
              <span className="sr-only">{EMPTY_STAND}</span>
            </>
          ) : (
            row.participant
          ),
          after: marker ? <FishPenaltyCard {...marker} /> : null,
        };
      }
      const catchN = col.kind === 'catch' ? Number(/^catch(\d+)$/.exec(col.key)?.[1] ?? 0) : 0;
      if (col.kind === 'catch' && minFish !== undefined && catchN > minFish) {
        // fish: past the sector's minimum of fish the catch cell is grey and empty.
        return {
          measure,
          fill: 'grey',
          content: null,
          attrs: { 'aria-label': 'nu se punctează' },
        };
      }
      if (col.kind === 'place') {
        // fish: 🎖️ before the general place of every winner row.
        return {
          measure,
          content: (
            <>
              {winner ? (
                <span aria-hidden data-mark="prize">
                  🎖️
                </span>
              ) : null}
              {winner ? <span className="sr-only">Premiat, </span> : null}
              {formatRankingPlain(raw)}
            </>
          ),
        };
      }
      if (noCatch && (col.key === mainKey || col.kind === 'count')) {
        return {
          measure,
          content: (
            <>
              <span aria-hidden>–</span>
              <span className="sr-only">Fără capturi</span>
            </>
          ),
        };
      }
      const tierN = col.kind === 'tier' ? Number(/^tier(\d+)$/.exec(col.key)?.[1] ?? 0) : 0;
      const unreached =
        col.kind === 'tier' &&
        !cell.isTierWin &&
        (noCatch || (typeof row.catchCount === 'number' && row.catchCount < tierN && !cellNumber(raw)));
      const weight = col.kind === 'weight' || col.kind === 'catch' || col.kind === 'tier';
      const fill = cell.isTierWin ? 'tierWin' : cell.isTier ? 'tier' : cell.isBiggest ? 'biggest' : 'sector';
      const content = unreached ? (
        <>
          <span aria-hidden>–</span>
          <span className="sr-only">{noCatch ? 'Fără capturi' : `Sub ${tierN} capturi`}</span>
        </>
      ) : (
        <>
          {cell.isBiggest && <span className="sr-only">Cea mai mare captură: </span>}
          {cell.isTierWin && <span className="sr-only">Loc câștigat la: </span>}
          {weight ? (noCatch ? '–' : formatRankingWeight(raw)) : formatRankingPlain(raw)}
        </>
      );
      return {
        measure,
        fill,
        content,
        split: cell.isSplit,
        attrs: {
          'data-biggest': cell.isBiggest ? '' : undefined,
          'data-tier-win': cell.isTierWin ? '' : undefined,
        },
      };
    });
    return {
      key: row.standId ?? `${row.position}-${index}`,
      standId: row.standId,
      stand: row.position,
      standSr: `Sector ${sector}, stand ${stand}`,
      color: row.backgroundColor,
      winner,
      cells,
    };
  });
}
