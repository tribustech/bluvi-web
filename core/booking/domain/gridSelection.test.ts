import { describe, expect, it } from 'vitest';
import {
  canExtendSelection,
  computeDaySelection,
  extendSelection,
  isCellSelected,
  seedFromSelection,
  selectDaySelection,
  selectionFromState,
  toggleSelectionCell,
  type GridSelectionState,
  type IsAvailable,
  type SelectionSlot,
} from './gridSelection';

// Ported from fish `useGridSelection.test.ts`: the hook tests drove toggleCell/selectDay/extend
// through React state; here the same scenarios drive the pure transitions.

process.env.TZ = 'Europe/Bucharest';

const SLOTS: SelectionSlot[] = [
  { start: '2026-06-13T06:00:00', end: '2026-06-13T18:00:00' },
  { start: '2026-06-13T18:00:00', end: '2026-06-14T06:00:00' },
  { start: '2026-06-14T06:00:00', end: '2026-06-14T18:00:00' },
];

function predicateFrom(statuses: ('available' | 'booked' | 'blocked')[]): IsAvailable {
  return (_standId: string, cellIndex: number) => statuses[cellIndex] === 'available';
}

const STAND_ID = 'stand-1';

describe('computeDaySelection', () => {
  it('returns the inclusive index range of available cells starting that local day', () => {
    const isAvailable = predicateFrom(['available', 'available', 'available']);
    // 13th = cells 0 and 1 (both start on the 13th; the overnight slot starts 13th, ends 14th).
    expect(computeDaySelection(STAND_ID, new Date('2026-06-13T00:00:00'), SLOTS, isAvailable)).toEqual({
      startIndex: 0,
      endIndex: 1,
    });
    // 14th = only cell 2.
    expect(computeDaySelection(STAND_ID, new Date('2026-06-14T00:00:00'), SLOTS, isAvailable)).toEqual({
      startIndex: 2,
      endIndex: 2,
    });
  });

  it('returns null when the day has no available cells', () => {
    const isAvailable = predicateFrom(['booked', 'booked', 'booked']);
    expect(computeDaySelection(STAND_ID, new Date('2026-06-13T00:00:00'), SLOTS, isAvailable)).toBeNull();
  });

  it('returns null when the day exists but its run is not fully available (gap)', () => {
    const isAvailable = predicateFrom(['available', 'booked', 'available']);
    expect(computeDaySelection(STAND_ID, new Date('2026-06-13T00:00:00'), SLOTS, isAvailable)).toBeNull();
  });

  it('treats a PAST (non-selectable) slot exactly like booked/blocked — day run is rejected', () => {
    const isAvailable = predicateFrom(['available', 'booked' /* stands in for past */, 'available']);
    expect(computeDaySelection(STAND_ID, new Date('2026-06-13T00:00:00'), SLOTS, isAvailable)).toBeNull();
    expect(computeDaySelection(STAND_ID, new Date('2026-06-14T00:00:00'), SLOTS, isAvailable)).toEqual({
      startIndex: 2,
      endIndex: 2,
    });
  });
});

describe('toggleSelectionCell / selectDaySelection — past / non-selectable slots', () => {
  const PAST_AT_1: IsAvailable = predicateFrom(['available', 'booked', 'available']);

  it('toggle on a non-selectable (past) index is a no-op', () => {
    const next = toggleSelectionCell(null, STAND_ID, 1, PAST_AT_1);
    expect(next).toBeNull();
    expect(isCellSelected(next, STAND_ID, 1)).toBe(false);
  });

  it('extending a selection ACROSS a non-selectable (past) slot never includes it', () => {
    let s = toggleSelectionCell(null, STAND_ID, 0, PAST_AT_1);
    expect(isCellSelected(s, STAND_ID, 0)).toBe(true);
    s = toggleSelectionCell(s, STAND_ID, 2, PAST_AT_1);
    // Contiguity contract: the run restarts at the new cell; the past cell 1 is never selected.
    expect(isCellSelected(s, STAND_ID, 1)).toBe(false);
    expect(isCellSelected(s, STAND_ID, 2)).toBe(true);
  });

  it('selectDay for a day whose run contains a non-selectable (past) slot makes no selection', () => {
    expect(selectDaySelection(STAND_ID, new Date('2026-06-13T00:00:00'), SLOTS, PAST_AT_1)).toBeNull();
  });

  it('selectDay selects a fully-selectable future day (guard against over-blocking)', () => {
    const s = selectDaySelection(STAND_ID, new Date('2026-06-14T00:00:00'), SLOTS, PAST_AT_1);
    expect(selectionFromState(s, SLOTS)).toEqual({
      standDocumentId: STAND_ID,
      startISO: SLOTS[2].start,
      endISO: SLOTS[2].end,
    });
  });

  it('a normal selectable slot IS still tappable', () => {
    const s = toggleSelectionCell(null, STAND_ID, 0, PAST_AT_1);
    expect(selectionFromState(s, SLOTS)).toEqual({
      standDocumentId: STAND_ID,
      startISO: SLOTS[0].start,
      endISO: SLOTS[0].end,
    });
  });

  it('tapping the single selected cell again clears it; another stand restarts there', () => {
    const all = predicateFrom(['available', 'available', 'available']);
    const s = toggleSelectionCell(null, STAND_ID, 0, all);
    expect(toggleSelectionCell(s, STAND_ID, 0, all)).toBeNull();
    expect(toggleSelectionCell(s, 'other', 2, all)).toEqual({ standDocumentId: 'other', startIndex: 2, endIndex: 2 });
  });

  it('extends backward and collapses on a tap inside the range', () => {
    const all = predicateFrom(['available', 'available', 'available']);
    let s = toggleSelectionCell(null, STAND_ID, 2, all);
    s = toggleSelectionCell(s, STAND_ID, 0, all);
    expect(s).toEqual({ standDocumentId: STAND_ID, startIndex: 0, endIndex: 2 });
    expect(toggleSelectionCell(s, STAND_ID, 1, all)).toEqual({ standDocumentId: STAND_ID, startIndex: 1, endIndex: 1 });
  });
});

const SIX_SLOTS: SelectionSlot[] = [
  { start: '2026-06-13T00:00:00', end: '2026-06-13T06:00:00' }, // 0
  { start: '2026-06-13T06:00:00', end: '2026-06-13T12:00:00' }, // 1
  { start: '2026-06-13T12:00:00', end: '2026-06-13T18:00:00' }, // 2
  { start: '2026-06-13T18:00:00', end: '2026-06-14T00:00:00' }, // 3
  { start: '2026-06-14T00:00:00', end: '2026-06-14T06:00:00' }, // 4
  { start: '2026-06-14T06:00:00', end: '2026-06-14T12:00:00' }, // 5
];

describe('canExtendSelection / extendSelection', () => {
  const ALL = predicateFrom(['available', 'available', 'available', 'available', 'available', 'available']);
  const run: GridSelectionState = { standDocumentId: STAND_ID, startIndex: 2, endIndex: 3 };

  it('case 1: no selection → cannot extend', () => {
    expect(canExtendSelection(null, 2, SIX_SLOTS, ALL)).toBe(false);
    expect(extendSelection(null, 2, SIX_SLOTS, ALL)).toBeNull();
  });

  it('case 2: selection [2,3], slots 4 and 5 available → extend(2) grows to [2,5] on the same stand', () => {
    let s = toggleSelectionCell(null, STAND_ID, 2, ALL);
    s = toggleSelectionCell(s, STAND_ID, 3, ALL);
    expect(s).toEqual(run);
    expect(canExtendSelection(s, 2, SIX_SLOTS, ALL)).toBe(true);
    const grown = extendSelection(s, 2, SIX_SLOTS, ALL);
    expect(selectionFromState(grown, SIX_SLOTS)).toEqual({
      standDocumentId: STAND_ID,
      startISO: SIX_SLOTS[2].start,
      endISO: SIX_SLOTS[5].end,
    });
  });

  it('case 3: slot 4 unavailable for the stand → cannot extend by 1', () => {
    const isAvailable = predicateFrom(['available', 'available', 'available', 'available', 'booked', 'available']);
    expect(canExtendSelection(run, 1, SIX_SLOTS, isAvailable)).toBe(false);
    expect(extendSelection(run, 1, SIX_SLOTS, isAvailable)).toBeNull();
  });

  it('case 4: selection ends at the last loaded slot → cannot extend (no next page loaded)', () => {
    const last: GridSelectionState = { standDocumentId: STAND_ID, startIndex: 5, endIndex: 5 };
    expect(canExtendSelection(last, 1, SIX_SLOTS, ALL)).toBe(false);
    expect(extendSelection(last, 1, SIX_SLOTS, ALL)).toBeNull();
  });

  it('refuses a gap in the slot sequence', () => {
    const gappy = [...SIX_SLOTS.slice(0, 4), { start: '2026-06-14T01:00:00', end: '2026-06-14T06:00:00' }];
    expect(canExtendSelection(run, 1, gappy, ALL)).toBe(false);
  });
});

describe('seedFromSelection (re-mount after the extras/review step unmounted the grid)', () => {
  it('seeds a multi-cell selection whose ISO bounds match a contiguous slot run', () => {
    const s = seedFromSelection({ standDocumentId: STAND_ID, startISO: SLOTS[0].start, endISO: SLOTS[1].end }, SLOTS);
    expect(selectionFromState(s, SLOTS)).toEqual({
      standDocumentId: STAND_ID,
      startISO: SLOTS[0].start,
      endISO: SLOTS[1].end,
    });
    expect(isCellSelected(s, STAND_ID, 0)).toBe(true);
    expect(isCellSelected(s, STAND_ID, 1)).toBe(true);
    expect(isCellSelected(s, STAND_ID, 2)).toBe(false);
  });

  it('ignores an initial selection whose bounds match no loaded slot', () => {
    expect(
      seedFromSelection({ standDocumentId: STAND_ID, startISO: '2030-01-01T06:00:00', endISO: '2030-01-01T18:00:00' }, SLOTS)
    ).toBeNull();
  });

  it('null initial seeds nothing', () => {
    expect(seedFromSelection(null, SLOTS)).toBeNull();
  });
});
