import { useRef } from 'react';
import type { ColumnDefinition } from '@/core/competitions';
import { RankingRow, readCell, tiedIndices, type RankingRowData } from '@/components/ranking';
import { cn } from '@/components/ui/cn';
import { PRESSABLE_ROWS, useRowPress } from './rowPress';

/*
 * The phone ranking (fish components/ranking-table ScrollableTable) as Fundații §07 «Rând
 * clasament · mobil»: the kit RankingRow — position pill (winner = navy + lavender, tied «=4»),
 * the angler, «sector · stand · capturi · CMMC», the signature value in kg, the sector only as the
 * 4px edge, penalties as the kit's small yellow / red Tag. The rows keep the bar's Sortare order
 * (stand by default, as fish); every column of the builder is in the «Tot ecranul» table.
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
  const list = useRef<HTMLOListElement>(null);
  useRowPress<HTMLLIElement>(list, ':scope > li', (_, i) => rows[i]?.standId ?? null, onRowPress);
  return (
    // Full bleed on the phone's white ground: the sector edge sits on the screen edge, as in fish.
    // The penalty Tag in the warning ink: the kit's yellow pair is 2.86:1 (tableFixes.ts).
    <ol ref={list} aria-label="Clasament" className={cn('-mx-4 border-y border-hairline [&_.text-badge-yellow-fg]:text-status-warning-fg', PRESSABLE_ROWS)}>
      {rows.map((row, index) => (
        <RankingRow
          key={row.standId ?? `${row.position}-${index}`}
          row={row}
          valueKey={valueKey(row)}
          tied={tied.has(index)}
          isCurrentUser={currentUserStandId != null && row.standId === String(currentUserStandId)}
        />
      ))}
    </ol>
  );
}
