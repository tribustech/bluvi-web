/**
 * fish `features/lakes/booking/useGridSelection.ts`, minus React: the hook's `useState` reducer
 * logic as pure transitions. A UI keeps `GridSelectionState | null` in its own state and calls
 * `toggleSelectionCell` / `selectDaySelection` / `extendSelection` to get the next one.
 *
 * Rules (single stand row + contiguous run of AVAILABLE cells):
 *  - Tapping a cell on a different stand resets selection to that stand (single cell).
 *  - Tapping the current single-selected cell again clears the selection (toggle off).
 *  - Tapping a later available cell on the SAME row:
 *      • if every intermediate cell is available → extend to the inclusive contiguous range.
 *      • if a gap/booked/blocked cell sits in between → restart selection at the new cell.
 *  - Tapping an earlier available cell on the same row behaves symmetrically.
 *  - Tapping a non-available cell is a no-op.
 *
 * startISO = first selected slot.start, endISO = last selected slot.end.
 */
import { isSameDay } from './dates';

export interface GridSelection {
  standDocumentId: string;
  startISO: string;
  endISO: string;
}

/** Minimal per-slot info the selection model needs (index = cellIndex). */
export interface SelectionSlot {
  start: string;
  end: string;
}

/** Predicate the caller supplies: is cell `cellIndex` selectable (available & not past) for `standDocumentId`? */
export type IsAvailable = (standDocumentId: string, cellIndex: number) => boolean;

/**
 * Internal selection state. Kept index-based (cheap to compare); the public ISO selection is
 * derived from the slots array with `selectionFromState`.
 */
export interface GridSelectionState {
  standDocumentId: string;
  /** Inclusive index of the first selected cell. */
  startIndex: number;
  /** Inclusive index of the last selected cell. */
  endIndex: number;
}

/** Tap on a cell → the next state (`prev` unchanged when the cell is not selectable). */
export function toggleSelectionCell(
  prev: GridSelectionState | null,
  standDocumentId: string,
  cellIndex: number,
  isAvailable: IsAvailable
): GridSelectionState | null {
  if (!isAvailable(standDocumentId, cellIndex)) return prev;

  // Different stand (or no prior selection) → start fresh single-cell selection.
  if (!prev || prev.standDocumentId !== standDocumentId) {
    return { standDocumentId, startIndex: cellIndex, endIndex: cellIndex };
  }

  const { startIndex, endIndex } = prev;

  // Tapping the exact same single cell → toggle off.
  if (startIndex === endIndex && cellIndex === startIndex) {
    return null;
  }

  // Extend forward.
  if (cellIndex > endIndex) {
    if (rangeAllAvailable(standDocumentId, endIndex + 1, cellIndex, isAvailable)) {
      return { standDocumentId, startIndex, endIndex: cellIndex };
    }
    // Gap in between → restart at the new cell.
    return { standDocumentId, startIndex: cellIndex, endIndex: cellIndex };
  }

  // Extend backward.
  if (cellIndex < startIndex) {
    if (rangeAllAvailable(standDocumentId, cellIndex, startIndex - 1, isAvailable)) {
      return { standDocumentId, startIndex: cellIndex, endIndex };
    }
    return { standDocumentId, startIndex: cellIndex, endIndex: cellIndex };
  }

  // Tap inside an existing multi-cell range → collapse to that single cell.
  return { standDocumentId, startIndex: cellIndex, endIndex: cellIndex };
}

/** Selects the whole day on that stand; null when the day can't be taken (past, or a
 *  booked/blocked cell breaks the run) so the caller can say why (fish `selectDay` → false). */
export function selectDaySelection(
  standDocumentId: string,
  day: Date,
  slots: SelectionSlot[],
  isAvailable: IsAvailable
): GridSelectionState | null {
  const range = computeDaySelection(standDocumentId, day, slots, isAvailable);
  return range ? { standDocumentId, ...range } : null;
}

/** Cheap predicate the grid uses to derive each cell's `selected` boolean. */
export function isCellSelected(state: GridSelectionState | null, standDocumentId: string, cellIndex: number): boolean {
  if (!state) return false;
  if (state.standDocumentId !== standDocumentId) return false;
  return cellIndex >= state.startIndex && cellIndex <= state.endIndex;
}

/** The public ISO selection for a state; null when an index no longer matches a loaded slot. */
export function selectionFromState(state: GridSelectionState | null, slots: SelectionSlot[]): GridSelection | null {
  if (!state) return null;
  const startSlot = slots[state.startIndex];
  const endSlot = slots[state.endIndex];
  if (!startSlot || !endSlot) return null;
  return { standDocumentId: state.standDocumentId, startISO: startSlot.start, endISO: endSlot.end };
}

/**
 * Package-upsell extend: true iff a selection exists and the next `count` slots past its end are
 * contiguous (no gap in the slot sequence) and available for the selected stand.
 */
export function canExtendSelection(
  state: GridSelectionState | null,
  count: number,
  slots: SelectionSlot[],
  isAvailable: IsAvailable
): boolean {
  if (!state || count <= 0) return false;
  const { standDocumentId, endIndex } = state;
  for (let i = 1; i <= count; i++) {
    const idx = endIndex + i;
    const prev = slots[idx - 1];
    const next = slots[idx];
    if (!next) return false;
    if (next.start !== prev.end) return false; // gap in the slot sequence
    if (!isAvailable(standDocumentId, idx)) return false;
  }
  return true;
}

/**
 * Grows the current selection by `count` slots when `canExtendSelection`; null when it can't
 * (fish `extend` → false, selection unchanged). Goes through the same forward-extend path a tap
 * on a later cell uses, so the invariants live in one place.
 */
export function extendSelection(
  state: GridSelectionState | null,
  count: number,
  slots: SelectionSlot[],
  isAvailable: IsAvailable
): GridSelectionState | null {
  if (!state || !canExtendSelection(state, count, slots, isAvailable)) return null;
  return toggleSelectionCell(state, state.standDocumentId, state.endIndex + count, isAvailable);
}

/**
 * Map an ISO-bounded selection back to slot indices. Null when either bound matches
 * no loaded slot (e.g. the loaded window changed while the grid was unmounted).
 * Seed for a fresh mount: the cabin/review step unmounts the grid; the flow keeps the selection.
 */
export function seedFromSelection(
  initial: GridSelection | null | undefined,
  slots: SelectionSlot[]
): GridSelectionState | null {
  if (!initial) return null;
  const startIndex = slots.findIndex(s => s.start === initial.startISO);
  if (startIndex === -1) return null;
  const endIndex = slots.findIndex((s, i) => i >= startIndex && s.end === initial.endISO);
  if (endIndex === -1) return null;
  return { standDocumentId: initial.standDocumentId, startIndex, endIndex };
}

/**
 * Indices of the AVAILABLE cells whose `start` falls on `day` (local), as an inclusive
 * range — but only when that range is contiguous and fully available (same rule as toggle).
 * Returns null when the day has no cells or the run has a gap.
 */
export function computeDaySelection(
  standDocumentId: string,
  day: Date,
  slots: SelectionSlot[],
  isAvailable: IsAvailable
): { startIndex: number; endIndex: number } | null {
  // Index span of all slots whose `start` falls on this local day (regardless of status),
  // so a booked/blocked cell inside the day breaks the run rather than being skipped over.
  const idx = slots
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => isSameDay(new Date(c.start), day))
    .map(({ i }) => i);
  if (idx.length === 0) return null;
  const startIndex = idx[0];
  const endIndex = idx[idx.length - 1];
  if (!rangeAllAvailable(standDocumentId, startIndex, endIndex, isAvailable)) return null;
  return { startIndex, endIndex };
}

/** True if every cell in the inclusive [from, to] index range is available for the stand. */
function rangeAllAvailable(standDocumentId: string, from: number, to: number, isAvailable: IsAvailable): boolean {
  for (let i = from; i <= to; i++) {
    if (!isAvailable(standDocumentId, i)) return false;
  }
  return true;
}
