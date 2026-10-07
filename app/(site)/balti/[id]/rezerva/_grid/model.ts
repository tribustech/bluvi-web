import {
  addDays,
  BLOCK_REASON_LABELS,
  buildGridGeometryFromSlots,
  cellA11yLabel,
  differenceInCalendarDays,
  formatInterval,
  formatLocalIso,
  formatMonthAbbr,
  formatSelectionLabel,
  generateSlots,
  indexExceptions,
  isSameDay,
  mergeRowBands,
  resolveSlotStatus,
  startOfDay,
  type Band,
  type BlockInfo,
  type CellStatus,
  type DayHeader,
  type ExceptionIndex,
  type GridGeometry,
  type GridSelectionState,
  type IsAvailable,
  type MergedAvailability,
  type RowBandInput,
  type RowRun,
  type Slot,
  zoneOffsetMinutes,
} from '@/core/booking';
import { formatCount } from '@/core/realtime/chat/format';

/*
 * The grid's model — fish AvailabilityGrid's memos, outside React so they read as one pipeline:
 * merged pages → slots from yesterday (c8) → proportional geometry → per-stand runs with their
 * status (c12) → selection label (c21). The angler flow always enforces the lead time (fish
 * `enforceLeadTime` on BookingGridStep) and never sells a running slot (`allowInProgress` off).
 */

/** Frozen «Stand» column, one stand row, the two header rows (fish PINNED_WIDTH, CELL_HEIGHT…). */
export const PINNED_W = 56;
export const CELL_H = 48;
export const HEADER_DAY_H = 40;
export const HEADER_SUB_H = 28;
export const HEADER_H = HEADER_DAY_H + HEADER_SUB_H;
/** An interval chip at full dress (glyph + gap + «00–06»); narrower columns drop the glyph (c11). */
export const CHIP_MIN_FIT_PX = 60;

export type GridModel = {
  slots: Slot[];
  geometry: GridGeometry;
  idx: ExceptionIndex;
  /** The first day column's date (yesterday, or the loaded range's start when later). */
  gridFrom: string;
  todayDayIndex: number;
  nowMs: number;
  leadHours: number;
  /** «Sâmbătă 15 aug» per day, in `geometry.days` order. */
  dayLabels: string[];
  isAvailable: IsAvailable;
};

/** «Sâmbătă 15 aug» — fish `${day.dayLabel} ${format(day.date, 'd MMM', { locale: ro })}`. */
export const dayPillLabel = (day: DayHeader) => `${day.dayLabel} ${day.date.getDate()} ${formatMonthAbbr(day.date)}`;

/**
 * fish sizes the day column for a phone (the narrowest band clears a 44px touch target, 5–10px an
 * hour). Wider screens draw the same axis `scale`× wider, so a day pill reads in full and every
 * interval chip keeps its glyph; the grid still fills its column with more days, never wider cells
 * than that (ROADMAP §4: tables take the width).
 */
function scaleGeometry(g: GridGeometry, k: number): GridGeometry {
  if (k === 1) return g;
  return {
    days: g.days,
    dayWidthPx: g.dayWidthPx * k,
    bodyWidthPx: g.bodyWidthPx * k,
    bands: g.bands.map(b => ({ ...b, leftPx: b.leftPx * k, widthPx: b.widthPx * k })),
    headerSlots: g.headerSlots.map(h => ({ ...h, leftPx: h.leftPx * k, widthPx: h.widthPx * k })),
  };
}

export function buildGridModel(merged: MergedAvailability, nowMs: number, scale = 1): GridModel {
  // The grid starts at YESTERDAY, not at the loaded range's month boundary: deeper history is dead
  // weight (unselectable), so it is clipped out of the geometry (c8).
  const yesterday = startOfDay(addDays(new Date(nowMs), -1));
  const loadedFrom = new Date(merged.loadedRange.from);
  const gridFrom = loadedFrom >= yesterday ? merged.loadedRange.from : formatLocalIso(yesterday);
  const slots = generateSlots({
    from: gridFrom,
    to: merged.loadedRange.to,
    slotStartTimes: merged.slotStartTimes,
    incrementHours: merged.incrementHours,
    timezone: merged.timezone,
  });
  const geometry = scaleGeometry(buildGridGeometryFromSlots(slots), scale);
  const idx = indexExceptions(merged.bookings, merged.blocks);
  const leadHours = merged.leadHours;
  const isAvailable: IsAvailable = (standId, cellIndex) => {
    const slot = slots[cellIndex];
    if (!slot) return false;
    const r = resolveSlotStatus(standId, slot, idx, nowMs, leadHours);
    return r.status === 'available' && !r.isPast && !r.tooSoon;
  };
  return {
    slots,
    geometry,
    idx,
    gridFrom,
    todayDayIndex: Math.max(0, differenceInCalendarDays(startOfDay(new Date(nowMs)), startOfDay(new Date(gridFrom)))),
    nowMs,
    leadHours,
    dayLabels: geometry.days.map(dayPillLabel),
    isAvailable,
  };
}

/** Every cell of the selection is still free to book now (not taken, not started, past the lead time). */
export function selectionFree(model: GridModel, state: GridSelectionState | null): boolean {
  if (!state) return false;
  for (let i = state.startIndex; i <= state.endIndex; i++) if (!model.isAvailable(state.standDocumentId, i)) return false;
  return true;
}

/** The day column a date falls on (≥ 0), for the «open on its day» snap (c24). */
export function dayIndexOf(model: GridModel, iso: string): number {
  return Math.max(0, differenceInCalendarDays(startOfDay(new Date(iso)), startOfDay(new Date(model.gridFrom))));
}

/**
 * The selected run's pill text (c21): the compact hours («18–06») for a single slot, the day-aware
 * range («Ma 18:00 – Mi 06:00») for a multi-slot run, where the merged pill is wide enough.
 */
export function selectionLabelOf(model: GridModel, state: GridSelectionState | null): string | null {
  if (!state) return null;
  const a = model.slots[state.startIndex];
  const b = model.slots[state.endIndex];
  if (!a || !b) return null;
  return state.startIndex === state.endIndex ? formatInterval(a.start, b.end) : formatSelectionLabel(a.start, b.end);
}

export type GridRun = RowRun & {
  /** Every cell the run covers (a merged block / selection spans several). */
  firstCell: number;
  lastCell: number;
  /** Spoken name (c25 + the day and the interval, which the web's buttons need to be told apart). */
  ariaLabel: string;
};

/**
 * One stand's runs, left to right (fish StandRow: resolve every band, then mergeRowBands). Free
 * cells carry no text; booked ones the booker's initials; the selection its interval (c13, c21).
 */
export function standRuns(
  model: GridModel,
  stand: { documentId: string; name: string },
  state: GridSelectionState | null,
  selectionLabel: string | null
): GridRun[] {
  const { slots, idx, nowMs, leadHours, geometry } = model;
  const inputs: (RowBandInput & { band: Band })[] = geometry.bands.map(b => {
    const slot = slots[b.cellIndex];
    const r = resolveSlotStatus(stand.documentId, slot, idx, nowMs, leadHours);
    const selected = !!state && state.standDocumentId === stand.documentId && b.cellIndex >= state.startIndex && b.cellIndex <= state.endIndex;
    return {
      band: b,
      cellIndex: b.cellIndex,
      leftPx: b.leftPx,
      widthPx: b.widthPx,
      label: r.status === 'booked' ? r.initials : '',
      status: r.status,
      block: r.block,
      selected,
      isPast: r.isPast,
      tooSoon: r.tooSoon,
    };
  });
  const runs = mergeRowBands(inputs, selectionLabel);
  // Cell span per run: mergeRowBands consumes the bands in order, so each run owns the next ones.
  let i = 0;
  return runs.map(run => {
    // A band belongs to this run when it starts before the run's right edge (bands that merely
    // touch the edge start the next run).
    const right = run.leftPx + run.widthPx - 0.5;
    let first = Infinity;
    let last = -Infinity;
    while (i < inputs.length && inputs[i].leftPx < right) {
      first = Math.min(first, inputs[i].cellIndex);
      last = Math.max(last, inputs[i].cellIndex);
      i++;
    }
    const firstCell = Number.isFinite(first) ? first : run.cellIndex;
    const lastCell = Number.isFinite(last) ? last : run.cellIndex;
    return { ...run, firstCell, lastCell, ariaLabel: runLabel(model, stand.name, run, firstCell, lastCell) };
  });
}

/** «Luni 12 oct 06–18» / the selection's own range — when the cell is, in words. */
function whenOf(model: GridModel, run: RowRun, firstCell: number, lastCell: number): string {
  const a = model.slots[firstCell];
  const b = model.slots[lastCell];
  if (!a || !b) return '';
  const day = model.geometry.days.find(d => isSameDay(d.date, new Date(a.start)));
  const dayText = day ? `${dayPillLabel(day)} ` : '';
  if (run.selected && firstCell !== lastCell) return `${dayText}${formatSelectionLabel(a.start, b.end)}`;
  if (run.status === 'blocked' && firstCell !== lastCell) return `${dayText}${formatSelectionLabel(a.start, b.end)}`;
  return `${dayText}${formatInterval(a.start, b.end)}`;
}

function runLabel(model: GridModel, standName: string, run: RowRun, firstCell: number, lastCell: number): string {
  const base = cellA11yLabel(standName, run.status as CellStatus, run.isPast, run.selected, whenOf(model, run, firstCell, lastCell));
  if (run.isPast || run.selected) return base;
  if (run.status === 'available' && run.tooSoon) return `${base}, doar telefonic`;
  if (run.status === 'blocked' && run.block) return `${base}, ${blockTitle(run.block)}`;
  return base;
}

/** The block panel's title (fish CompetitionBlockSheet): its label, else the reason, else «Indisponibil». */
export function blockTitle(block: BlockInfo): string {
  return block.label || REASON_LABEL[block.reason] || 'Indisponibil';
}

// core BLOCK_REASON_LABELS, read as a plain record (the CMS also sends reasons it does not list).
const REASON_LABEL = BLOCK_REASON_LABELS as Record<string, string | undefined>;

/** What a tap on a run does (fish GridBand handlePress precedence, c14–c19). */
export type RunAction = 'toggle' | 'too-soon' | 'past' | 'block' | 'none';
export function runAction(run: RowRun): RunAction {
  const pressable = run.status === 'available' && !run.isPast;
  if (pressable) return run.tooSoon ? 'too-soon' : 'toggle';
  if (run.isPast) return 'past';
  if (run.status === 'blocked' && run.block && (run.block.competitionId || run.block.label)) return 'block';
  return 'none';
}

/** The pixel right edge of the selection (the edge chevron's trigger, c23); -1 without one. */
export function selectionRightPx(model: GridModel, state: GridSelectionState | null): number {
  if (!state) return -1;
  let right = -1;
  for (const b of model.geometry.bands) if (b.cellIndex === state.endIndex) right = Math.max(right, b.leftPx + b.widthPx);
  return right;
}

/** Why a day pill tap was turned down (fish AvailabilityGrid onDayPress, c20), in the order a person notices it. */
export function dayRefusal(model: GridModel, day: DayHeader): string {
  const today = startOfDay(new Date(model.nowMs)).getTime();
  const started = model.slots.some(s => isSameDay(new Date(s.start), day.date) && new Date(s.start).getTime() < model.nowMs);
  return startOfDay(day.date).getTime() < today
    ? 'Ziua a trecut — alege o zi viitoare.'
    : started
      ? 'Ziua a început deja — alege o zi viitoare.'
      : 'Ziua nu e liberă integral la standul ales.';
}

/**
 * booking.b.timezone: slots are the lake's (lake zone), but the grid, the panel and the dialogs read
 * them on the browser's clock (fish does the same — phones are in RO). When that clock differs from
 * the lake's, say so once above the grid, so «04–16» is not taken for the lake's own 06–18. Null
 * when they agree or the lake sends no zone. (Formatting everything in the lake zone is the owner's
 * call — parity web_note.)
 */
export function zoneHint(timezone: string | null | undefined, nowMs: number): string | null {
  const tz = timezone?.trim();
  if (!tz) return null;
  let lake: number;
  try {
    lake = zoneOffsetMinutes(new Date(nowMs), tz);
  } catch {
    return null;
  }
  const local = -new Date(nowMs).getTimezoneOffset();
  const diff = Math.abs(lake - local);
  if (!diff) return null;
  const by = diff % 60 === 0 ? formatCount(diff / 60, 'oră', 'ore') : `${Math.floor(diff / 60)} h ${diff % 60} min`;
  const of = tz === 'Europe/Bucharest' ? 'orei României' : 'orei bălții';
  return `Orele sunt afișate după ceasul tău, cu ${by} ${local < lake ? 'în urma' : 'înaintea'} ${of}.`;
}

/** A price in lei, Romanian digits («1.250», «187,5»). The unit is the caller's own element (rule 10). */
export const lei = (n: number) => new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 2 }).format(n);

/**
 * The note under the panel's price (fish BookingSelectionSheet, c33): extras come at the next step
 * when this stand offers any for this tour; else a deposit lake states its deposit (the server's
 * total × the lake's percent, fish rounding); else a lake not paid in full online is paid on site;
 * a full-payment lake says nothing. Without a server total (loading, refused, failed) a deposit lake
 * says nothing either: «0 lei» would be a false amount (owner rule 4; fish shows it — not copied).
 */
export function selectionNote({
  offeredCount,
  paymentMode,
  depositPercent,
  total,
}: {
  offeredCount: number;
  paymentMode: string | null;
  depositPercent: number | null;
  total: number | null;
}): string | null {
  if (offeredCount > 0) return 'Poți adăuga extra la pasul următor.';
  if (paymentMode === 'deposit') {
    if (total == null) return null;
    const deposit = Math.round(((total * (depositPercent ?? 0)) / 100 + Number.EPSILON) * 100) / 100;
    return `Avans ${depositPercent ?? 0}%: ${lei(deposit)} lei`;
  }
  if (paymentMode !== 'full') return 'Plata se face la fața locului.';
  return null;
}
