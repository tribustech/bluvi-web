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
import { ANGLER_RULES, type GridRules } from '../_flow/config';

/*
 * The grid's model — fish AvailabilityGrid's memos, outside React so they read as one pipeline:
 * merged pages → slots from yesterday (c8) → proportional geometry → per-stand runs with their
 * status (c12) → selection label (c21). The angler flow always enforces the lead time (fish
 * `enforceLeadTime` on BookingGridStep) and never sells a running slot (`allowInProgress` off); the
 * operator's walk-in grid does the opposite (GridRules, _flow/config.ts — operator.calendar.c3/c4).
 * The rules are read once per resolved band (two booleans), never a closure per cell.
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
  /** Lead time / in-progress rules of this flow (the angler's by default). */
  rules: GridRules;
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

export function buildGridModel(merged: MergedAvailability, nowMs: number, scale = 1, rules: GridRules = ANGLER_RULES): GridModel {
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
  const { enforceLeadTime, allowInProgress } = rules;
  const isAvailable: IsAvailable = (standId, cellIndex) => {
    const slot = slots[cellIndex];
    if (!slot) return false;
    const r = resolveSlotStatus(standId, slot, idx, nowMs, leadHours);
    // fish AvailabilityGrid isAvailable: spent = allowInProgress ? isOver : isPast.
    return r.status === 'available' && !(allowInProgress ? r.isOver : r.isPast) && !(enforceLeadTime && r.tooSoon);
  };
  return {
    slots,
    geometry,
    idx,
    gridFrom,
    todayDayIndex: Math.max(0, differenceInCalendarDays(startOfDay(new Date(nowMs)), startOfDay(new Date(gridFrom)))),
    nowMs,
    leadHours,
    rules,
    dayLabels: geometry.days.map(dayPillLabel),
    isAvailable,
  };
}

/*
 * Desktop pages (≥768, owner 2026-10-11: «evităm scroll orizontal … câte o săptămână cu butoane
 * față/spate»). The grid never scrolls sideways there: it shows as many WHOLE days as fit at a
 * comfortable width (7 from ~1280, fewer below), stretched to fill the column exactly, and ‹ › page
 * through them. A page is a view of the same model: the cells (slots, selection, isAvailable) keep
 * their global indices, only the geometry is cut to the page's days and rescaled — so a selection
 * can run across pages and every rule stays the phone's.
 */

/** The narrowest a day column gets on a page (two 12h chips keep their glyph, the pill its weekday). */
export const PAGE_MIN_DAY_PX = 160;
/** A page is at most a week. */
export const PAGE_MAX_DAYS = 7;

/**
 * How many whole days a page shows in `innerPx` (the grid's width without the stand column), 1–7,
 * and the day width that fills it exactly. A lake whose own axis is wider than the comfortable
 * minimum (short slots: 6h, 4h) keeps its own day width as the floor, so no band drops under 44px.
 */
export function pageFit(innerPx: number, baseDayPx: number): { days: number; dayPx: number } {
  const min = Math.max(PAGE_MIN_DAY_PX, baseDayPx);
  const days = Math.max(1, Math.min(PAGE_MAX_DAYS, Math.floor(innerPx / min)));
  return { days, dayPx: innerPx / days };
}

/** Day columns the model holds (yesterday … the end of the last loaded month). */
export const loadedDayCount = (model: GridModel) =>
  model.geometry.dayWidthPx > 0 ? Math.round(model.geometry.bodyWidthPx / model.geometry.dayWidthPx) : 0;

const hourOf = (d: Date) => d.getHours() + d.getMinutes() / 60;

/**
 * Where a page's day column starts, in hours after midnight: the lake's earliest slot start (06:00
 * for a 06–18 / 18–06 lake, 00:00 for one that starts a slot at midnight, 07:30 for 07:30 / 19:30),
 * on the clock the grid reads. Each column then runs from that hour to the same hour the next day
 * and holds every slot that STARTS in it whole — a night is never split across two pages.
 */
export function slotShiftHours(model: GridModel): number {
  let min = Infinity;
  for (const s of model.slots) {
    const h = hourOf(new Date(s.start));
    if (h < min) min = h;
    if (min === 0) break;
  }
  return Number.isFinite(min) ? min : 0;
}

/**
 * The day column «now» falls in on a page axis: before the lake's first start hour it is still
 * yesterday's column (its night slot is the one running).
 */
export function pageDayOf(model: GridModel, shift: number): number {
  return model.todayDayIndex - (hourOf(new Date(model.nowMs)) < shift ? 1 : 0);
}

/**
 * The model seen through one page: days [from, from + days) of the model's columns, each column
 * from the lake's first start hour (slotShiftHours) to the same hour the next day, drawn `dayPx`
 * wide from x = 0. One band and one header chip per slot that starts on the page, whole (never cut
 * at midnight or at the page edge); day indices and «today» are page-relative; cells keep their
 * global indices, so a selection lives outside the page. Days the model has not loaded yet are
 * absent (`geometry.bodyWidthPx` stops at the loaded end; the grid draws the rest as pending).
 */
export function pageModel(model: GridModel, from: number, days: number, dayPx: number, shift = slotShiftHours(model)): GridModel {
  const g = model.geometry;
  const loaded = Math.max(0, Math.min(days, loadedDayCount(model) - from));
  const col0 = columnDate(model, from);
  const at = (i: number) => {
    const d = columnDate(model, from + i);
    d.setHours(Math.floor(shift), Math.round((shift % 1) * 60), 0, 0);
    return d.getTime();
  };
  const ws = at(0);
  const we = at(days);
  const right = days * dayPx;
  const chipOf = new Map(g.headerSlots.map(h => [h.cellIndex, h]));
  const bands: GridGeometry['bands'] = [];
  const headerSlots: GridGeometry['headerSlots'] = [];
  model.slots.forEach((slot, cellIndex) => {
    const start = new Date(slot.start);
    const t = start.getTime();
    if (t < ws || t >= we) return;
    let col = differenceInCalendarDays(startOfDay(start), col0);
    let h = hourOf(start) - shift;
    if (h < 0) {
      col -= 1;
      h += 24;
    }
    const leftPx = col * dayPx + (h / 24) * dayPx;
    const widthPx = Math.min(((Date.parse(slot.end) - t) / 86_400_000) * dayPx, right - leftPx);
    const label = formatInterval(slot.start, slot.end);
    bands.push({ cellIndex, dayIndex: col, leftPx, widthPx, label, isSegmentOfSplit: false });
    const chip = chipOf.get(cellIndex);
    headerSlots.push({ cellIndex, leftPx, widthPx, label: chip?.label ?? label, kind: chip?.kind ?? 'day' });
  });
  const dayList: DayHeader[] = [];
  const labels: string[] = [];
  g.days.forEach((d, i) => {
    if (d.dayIndex < from || d.dayIndex >= from + loaded) return;
    dayList.push({ ...d, dayIndex: d.dayIndex - from });
    labels.push(model.dayLabels[i]);
  });
  return {
    ...model,
    geometry: { days: dayList, bands, headerSlots, dayWidthPx: dayPx, bodyWidthPx: loaded * dayPx },
    dayLabels: labels,
    todayDayIndex: model.todayDayIndex - from,
  };
}

/** The date of the model's day column `i` (0 = the grid's first day). */
export const columnDate = (model: GridModel, i: number) => addDays(startOfDay(new Date(model.gridFrom)), i);

/** «11 – 17 oct 2026», «28 oct – 3 noi 2026», «29 dec 2026 – 4 ian 2027», «11 oct 2026» — a page's period. */
export function periodLabel(first: Date, last: Date): string {
  const dm = (d: Date) => `${d.getDate()} ${formatMonthAbbr(d)}`;
  if (isSameDay(first, last)) return `${dm(first)} ${first.getFullYear()}`;
  if (first.getFullYear() !== last.getFullYear()) return `${dm(first)} ${first.getFullYear()} – ${dm(last)} ${last.getFullYear()}`;
  if (first.getMonth() === last.getMonth()) return `${first.getDate()} – ${dm(last)} ${last.getFullYear()}`;
  return `${dm(first)} – ${dm(last)} ${last.getFullYear()}`;
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
  const { enforceLeadTime, allowInProgress } = model.rules;
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
      // fish StandRow: a running slot is past only once it is over on the operator's grid, and the
      // operator has no lead time (no yellow band).
      isPast: allowInProgress ? r.isOver : r.isPast,
      tooSoon: enforceLeadTime ? r.tooSoon : false,
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

/**
 * What a tap on a run does (fish GridBand handlePress precedence, c14–c19). `blockOpens`: a labelled
 * block / a competition explains itself (the angler's grid; the operator's opens nothing,
 * operator.calendar.c5). `bookedOpens`: a booked run opens the booking it stands for (fish
 * `onBookedPress`, the operator's grid only — operator.calendar.c6).
 */
export type RunAction = 'toggle' | 'too-soon' | 'past' | 'block' | 'booked' | 'none';
export function runAction(run: RowRun, opts: { blockOpens?: boolean; bookedOpens?: boolean } = {}): RunAction {
  const { blockOpens = true, bookedOpens = false } = opts;
  const pressable = run.status === 'available' && !run.isPast;
  if (pressable) return run.tooSoon ? 'too-soon' : 'toggle';
  // fish GridBand: select > open the booking (a past one too) > past > block.
  if (bookedOpens && run.status === 'booked') return 'booked';
  if (run.isPast) return 'past';
  if (blockOpens && run.status === 'blocked' && run.block && (run.block.competitionId || run.block.label)) return 'block';
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
