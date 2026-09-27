/** fish `features/lakes/booking/rowRuns.ts` (verbatim). */
import type { CellStatus } from '../schemas';
import type { BlockInfo } from './availabilityStatus';

export interface RowBandInput {
  cellIndex: number;
  leftPx: number;
  widthPx: number;
  label: string;
  status: CellStatus;
  selected: boolean;
  /** Set on `blocked` bands — drives the competition icon and the info sheet. */
  block: BlockInfo | null;
  /** True when the slot's start is in the past — rendered dimmed + non-pressable. */
  isPast: boolean;
  /** Starts under the 24h booking lead — dimmed but pressable (call sheet). */
  tooSoon: boolean;
}

export interface RowRun {
  /** Grouping key: 'sel' for any selected band, `b<block window>` for a blocked band,
   *  else `c<cellIndex>` + past flag. */
  key: string;
  leftPx: number;
  widthPx: number;
  label: string;
  status: CellStatus;
  selected: boolean;
  /** Block behind a `blocked` run. Merged bands share a cell, so they share it. */
  block: BlockInfo | null;
  /** True when the run is in the past (all merged bands share the same flag). */
  isPast: boolean;
  tooSoon: boolean;
  /** First cell index in the run — used as the tap target. */
  cellIndex: number;
}

const TOUCH_EPS = 0.5; // px; segments of one cell / a contiguous selection touch exactly at the seam

/**
 * Merge a row's bands (already left-to-right) into visual runs:
 *  - all bands of the SAME cell merge (overnight split → one pill),
 *  - all bands of the SAME BLOCK merge (a competition weekend → one pill, one trophy),
 *  - all SELECTED bands merge into one run (a contiguous selection → one pill),
 *  - distinct UNSELECTED cells stay separate.
 * Only merges bands that actually touch (guards against time gaps).
 * Selected runs are labeled with `selectionLabel` (the overall interval); unselected
 * runs keep their cell's own label.
 */
export function mergeRowBands(bands: RowBandInput[], selectionLabel: string | null): RowRun[] {
  const runs: RowRun[] = [];
  for (const b of bands) {
    // Only merge consecutive bands of the same cell (or the same selected run) when they
    // share the same past/future state, so a past read-only segment never fuses with a
    // pressable future one.
    // Selected runs always key on 'sel' regardless of isPast — safe because `isAvailable`
    // forbids selecting past cells, so a selected band is never past.
    // A blocked band keys on its BLOCK, not its cell: every slot a competition (or a
    // closure) covers merges into one pill per stand, with one trophy. Six red cells
    // with six trophies read as six things; the block is one event. It also drops
    // the per-slot trophy SVG from the hottest commit a competition weekend has.
    const key = b.selected
      ? 'sel'
      : b.status === 'blocked' && b.block
        ? `b${b.block.start}|${b.block.end}|${b.block.reason}|${b.isPast ? 'p' : ''}`
        : `c${b.cellIndex}|${b.isPast ? 'p' : ''}${b.tooSoon ? 'ts' : ''}`;
    const last = runs[runs.length - 1];
    const touching = !!last && Math.abs(last.leftPx + last.widthPx - b.leftPx) <= TOUCH_EPS;
    if (last && last.key === key && touching) {
      last.widthPx = b.leftPx + b.widthPx - last.leftPx;
      continue;
    }
    runs.push({
      key,
      leftPx: b.leftPx,
      widthPx: b.widthPx,
      label: b.selected ? (selectionLabel ?? b.label) : b.label,
      status: b.status,
      selected: b.selected,
      block: b.block,
      isPast: b.isPast,
      tooSoon: b.tooSoon,
      cellIndex: b.cellIndex,
    });
  }
  return runs;
}
