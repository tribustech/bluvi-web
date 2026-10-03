import type { Penalty } from '@/core/competitions/schemas';
import type { CatchCell } from '@/core/competitions/domain/table/createTableRows';
import { formatDecimal } from '@/components/cards/format';

/**
 * Any row produced by core/competitions/domain/table/createTableRows (QuantityRowType,
 * QualityRowType, BestNRowType, …). The table stays type-blind like fish's RankingTable: it reads
 * `row[column.key]` and the flags the builders put on each cell.
 */
export type RankingRowData = {
  position: string;
  participant: string;
  generalPosition: number;
  backgroundColor: string;
  isWinner: boolean;
  standId?: string;
  sectorPosition?: number;
  catchCount?: number;
  penalties?: Penalty[];
  [key: string]: unknown;
};

/** Reads a cell that may be a plain value or the builders' `{ weight, isBiggest, … }` object. */
export function readCell(value: unknown): {
  raw: string | number | null;
  isSplit: boolean;
  isBiggest: boolean;
  isTier: boolean;
  isTierWin: boolean;
} {
  if (value !== null && typeof value === 'object' && 'weight' in value) {
    const c = value as Exclude<CatchCell, string>;
    return {
      raw: c.weight,
      isSplit: !!c.isSplit,
      isBiggest: !!c.isBiggest,
      isTier: !!c.isTier,
      isTierWin: !!c.isTierWin,
    };
  }
  return {
    raw: typeof value === 'string' || typeof value === 'number' ? value : null,
    isSplit: false,
    isBiggest: false,
    isTier: false,
    isTierWin: false,
  };
}

/** Numeric value of a cell for sorting; `null` for "-", empty or text. */
export function cellNumber(value: unknown): number | null {
  const { raw } = readCell(value);
  if (raw === null || raw === '' || raw === '-') return null;
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** Builders format weights as "86.400"; the web shows "86,4" (3 decimals kept when they matter). */
export function formatWeight(value: unknown): string {
  const n = cellNumber(value);
  return n === null ? '–' : formatDecimal(n, 1, 3);
}

/** Points/positions: integers stay integers, fractions get a comma. */
export function formatPlain(value: unknown): string {
  const n = cellNumber(value);
  if (n === null) {
    const { raw } = readCell(value);
    return raw === null || raw === '' || raw === '-' ? '–' : String(raw);
  }
  return Number.isInteger(n) ? String(n) : formatDecimal(n, 1, 3);
}

/** Capot: the competitor finished with no catch (there is no disqualification in Bluvi). */
export function isCapot(row: RankingRowData): boolean {
  return typeof row.catchCount === 'number' && row.catchCount === 0;
}

/** Indices of rows sharing their generalPosition with a neighbour → shown as "=4". */
export function tiedIndices(rows: ReadonlyArray<Pick<RankingRowData, 'generalPosition'>>): Set<number> {
  const counts = new Map<number, number>();
  for (const r of rows) counts.set(r.generalPosition, (counts.get(r.generalPosition) ?? 0) + 1);
  const out = new Set<number>();
  rows.forEach((r, i) => {
    if ((counts.get(r.generalPosition) ?? 0) > 1) out.add(i);
  });
  return out;
}

export type PenaltyChip = { label: string; tone: 'warning' | 'danger'; description: string };

/** One chip per penalty, as fish's PenaltyCard marks them (yellow = penalty, red = eliminated). */
export function penaltyChips(penalties: ReadonlyArray<Penalty> | undefined): PenaltyChip[] {
  return (penalties ?? []).map(p => {
    if (p.action === 'ELIMINATE') return { label: 'eliminat', tone: 'danger', description: p.reason };
    if (p.action === 'DEDUCT_TOTAL_WEIGHT' && typeof p.value === 'number') {
      return { label: `−${formatDecimal(p.value, 0, 3)} kg`, tone: 'warning', description: p.reason };
    }
    return { label: 'avertisment', tone: 'warning', description: p.reason };
  });
}
