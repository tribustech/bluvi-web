import type { ColumnDefinition } from '@/core/competitions';
import { formatDecimal } from '@/components/cards/format';
import { cellNumber, readCell, type RankingRowData } from './model';
import { parseStand } from './sector';
import type { Penalty } from '@/core/competitions/schemas';

/*
 * The competition ranking's columns as fish draws them (helpers/table/getTableColumns.ts, ported in
 * core/competitions/domain/table/getTableColumns): the builders' titles and order, untouched —
 * Stand, Participant, the type's values, Poziție sector, Poziție generală (parity
 * competition-page.clasament c7–c13). This file only says how each column is drawn — shared by the
 * kit RankingTable / RankingRow and the competition page.
 */

/**
 * A stand without a registration: the builders give an empty / «-» participant, the page names it
 * (screen readers) and draws «–». One constant for the kit and the page.
 */
export const EMPTY_STAND = 'Stand liber';

export type RankingColumnKind = 'stand' | 'name' | 'catch' | 'tier' | 'weight' | 'count' | 'points' | 'sectorPlace' | 'place';

export type RankingColumn = ColumnDefinition & { kind: RankingColumnKind; align: 'left' | 'right' };

const WEIGHT_KEYS = new Set(['quantity', 'quality', 'quality1', 'biggestFish', 'topNCatchesAvarage', 'averageBestN']);
const COUNT_KEYS = new Set(['catchCount', 'bestOfCount']);

export function kindOf(key: string): RankingColumnKind {
  if (key === 'position') return 'stand';
  if (key === 'participant') return 'name';
  if (key === 'generalPosition') return 'place';
  if (key === 'sectorPosition') return 'sectorPlace';
  if (/^catch\d+$/.test(key)) return 'catch';
  if (/^tier\d+$/.test(key)) return 'tier';
  if (WEIGHT_KEYS.has(key)) return 'weight';
  if (COUNT_KEYS.has(key)) return 'count';
  return 'points';
}

/** The builders' columns, in their order, with how each is drawn. */
export function rankingColumns(columns: ReadonlyArray<ColumnDefinition>): RankingColumn[] {
  return columns.map(c => {
    const kind = kindOf(c.key);
    return { ...c, kind, align: kind === 'stand' || kind === 'name' ? 'left' : 'right' };
  });
}

/**
 * The value a ranking is decided on (drawn a step stronger): the stand's quantity when the type has
 * one, else its quality / best-of average. bestOfTiers has none (its Best-N block carries it).
 */
export function mainValueKey(columns: ReadonlyArray<ColumnDefinition>): string | undefined {
  const keys = new Set(columns.map(c => c.key));
  return ['quantity', 'quality', 'quality1', 'topNCatchesAvarage', 'averageBestN'].find(k => keys.has(k));
}

/**
 * fish `kg()`: every weight with three decimals (64 → «64,000»), «–» for a missing one (fish «-»;
 * the page's no-value mark is the en dash). The decimal comma: Romanian (fish prints «64.000», which
 * a Romanian reader takes for sixty-four thousand).
 */
export function formatRankingWeight(value: unknown): string {
  const n = cellNumber(value);
  return n === null ? '–' : formatDecimal(n, 3, 3);
}

/** Points and places: as the builders give them (points at most one decimal), decimal comma. */
export function formatRankingPlain(value: unknown): string {
  const n = cellNumber(value);
  if (n === null) {
    const { raw } = readCell(value);
    return raw === null || raw === '' || raw === '-' ? '–' : String(raw);
  }
  return Number.isInteger(n) ? String(n) : formatDecimal(n, 1, 3);
}

/**
 * fish PenaltyCard: ONE marker per row — red when any penalty eliminates, yellow otherwise — named
 * «Echipa este eliminată» / «Echipa are penalizări». The reasons ride along as its title.
 */
export function penaltyMarker(penalties: ReadonlyArray<Penalty> | undefined): { eliminated: boolean; label: string; reasons: string } | null {
  if (!penalties?.length) return null;
  const eliminated = penalties.some(p => p.action === 'ELIMINATE');
  return {
    eliminated,
    label: eliminated ? 'Echipa este eliminată' : 'Echipa are penalizări',
    reasons: penalties.map(p => p.reason).filter(Boolean).join(' · '),
  };
}

/** fish's default order (CompetitionRanking sortedRankings `stand`): sector name A→Z, then stand number. */
export function compareByStand(a: Pick<RankingRowData, 'position'>, b: Pick<RankingRowData, 'position'>): number {
  const pa = parseStand(a.position);
  const pb = parseStand(b.position);
  const sector = pa.sector.localeCompare(pb.sector);
  if (sector !== 0) return sector;
  const na = Number.parseInt(pa.stand, 10);
  const nb = Number.parseInt(pb.stand, 10);
  if (Number.isNaN(na) || Number.isNaN(nb)) return pa.stand.localeCompare(pb.stand, 'ro', { numeric: true });
  return na - nb;
}

/**
 * What a row's `isWinner` means for this ranking type (core buildRankingTable: generalPosition ≤ W):
 *  - 'sector': W = the number of sectors — the general places 1..S are the sector winners (their
 *    sector place is 1), so the mark sits on «Poziție sector»;
 *  - 'prize': bestOf (numberOfWinners), bestOfTiers (one per tier), Best N — the top W overall,
 *    marked on the general place.
 */
export type WinnerMode = 'sector' | 'prize';

export function winnerMode(columns: ReadonlyArray<ColumnDefinition>): WinnerMode {
  const keys = new Set(columns.map(c => c.key));
  const bestOf = keys.has('topNCatchesAvarage') || keys.has('averageBestN') || columns.some(c => /^tier\d+$/.test(c.key));
  return !bestOf && keys.has('sectorPosition') ? 'sector' : 'prize';
}

/** The general podium: places 1–3 of a row that caught (a row without a catch is never on it). */
export const isPodium = (generalPosition: number, noCatch: boolean) => !noCatch && generalPosition >= 1 && generalPosition <= 3;
