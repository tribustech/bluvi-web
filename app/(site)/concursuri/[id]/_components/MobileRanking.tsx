import { useRef } from 'react';
import type { ColumnDefinition } from '@/core/competitions';
import { RankingRow } from '@/components/ranking/RankingRow';
import { readCell, tiedIndices, type RankingRowData } from '@/components/ranking/model';
import { winnerMode } from '@/components/ranking/rankingColumns';
import { cn } from '@/components/ui/cn';
import { PRESSABLE_ROWS, useRowPress } from './rowPress';

/*
 * The phone ranking (fish components/ranking-table ScrollableTable) as Fundații §07 «Rând
 * clasament · mobil», drawn by the kit RankingRow (position pill — navy only for the untied 1st
 * place; a winner's trophy after the name, muted for a sector winner; «sector · stand · capturi ·
 * CMMC»; the deciding value in kg with fish's three decimals; the sector only as the 4px edge).
 * The rows keep the bar's Sortare order (stand by default, as fish); every column of the builder, as fish's grid, is in «Tot ecranul» (CompetitionRankingTable).
 */

const WEIGHT_KEYS = ['quantity', 'quality', 'quality1', 'topNCatchesAvarage', 'averageBestN'] as const;

/**
 * The value a ranking type is decided on, per row: the stand's quantity when the type has one,
 * else its quality / best-of average; bestOfTiers has no single column, so the tier the row was
 * placed on (`isTierWin`), or its biggest tier.
 */
function valueKeyOf(columns: ReadonlyArray<ColumnDefinition>): (row: RankingRowData) => string {
  const keys = new Set(columns.map(c => c.key));
  const fixed = WEIGHT_KEYS.find(k => keys.has(k));
  if (fixed) return () => fixed;
  const tiers = columns.filter(c => /^tier\d+$/.test(c.key)).map(c => c.key);
  return row => tiers.find(k => readCell(row[k]).isTierWin) ?? tiers[tiers.length - 1] ?? 'quantity';
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
  const tied = tiedIndices(rows);
  const valueKey = valueKeyOf(columns);
  const mode = winnerMode(columns);
  const list = useRef<HTMLOListElement>(null);
  useRowPress<HTMLLIElement>(list, ':scope > li', (_, i) => rows[i]?.standId ?? null, onRowPress);
  return (
    // Full bleed on the phone's white ground: the sector edge sits on the screen edge, as in fish.
    <ol ref={list} aria-label="Clasament" className={cn('-mx-4 border-y border-hairline', PRESSABLE_ROWS)}>
      {rows.map((row, index) => (
        <RankingRow
          key={row.standId ?? `${row.position}-${index}`}
          row={row}
          valueKey={valueKey(row)}
          tied={tied.has(index)}
          winnerMode={mode}
          isCurrentUser={currentUserStandId != null && row.standId === String(currentUserStandId)}
        />
      ))}
    </ol>
  );
}
