/** fish `features/lakes/booking/gridGeometry.ts` (date-fns replaced by `./dates`, same output). */
import {
  addDays,
  capitalize,
  differenceInCalendarDays,
  formatHH,
  formatHHmm,
  formatLocalIso,
  formatWeekdayShort,
  formatWeekdayWide,
  isSameDay,
  isValidDate,
  startOfDay,
} from './dates';
import { zonedWallTimeIso, zonedWallTimeToUtc } from './timezone';

/** Compact interval label: "06–18" when on the hour, "07:30–19:30" otherwise. */
export function formatInterval(startISO: string, endISO: string): string {
  const start = new Date(startISO);
  const end = new Date(endISO);
  const onHour = start.getMinutes() === 0 && end.getMinutes() === 0;
  const fmt = onHour ? formatHH : formatHHmm;
  return `${fmt(start)}–${fmt(end)}`;
}

/**
 * A slot's character, from geometry already computed by `splitCell`: `segmentCount` is
 * how many calendar days it touches, `totalHours` its wall-clock length. Deriving it
 * this way is DST-safe — segments are cut on calendar-day boundaries, so a 24h tour on
 * a clock-change day still reports 24, where a raw millisecond diff would say 23 or 25.
 *
 * 24h or more is deliberately NOT classified as night even when it starts at 18:00: it
 * covers a full day too, and a moon on it misleads.
 */
export function classifySlot(totalHours: number, segmentCount: number): SlotKind {
  if (totalHours >= 24) return 'long';
  return segmentCount > 1 ? 'night' : 'day';
}

/**
 * Header chip text. Short slots keep the compact `06–18`; long ones lead with the
 * duration, because `18–18` and `12–12` read as zero-length intervals. A long slot's
 * band is at least a full day column wide, so the longer string fits.
 */
export function formatSlotLabel(startISO: string, endISO: string, kind: SlotKind, totalHours: number): string {
  if (kind !== 'long') return formatInterval(startISO, endISO);
  const t = (iso: string) => formatHHmm(new Date(iso));
  return `${totalHours}h · ${t(startISO)} → ${t(endISO)}`;
}

/**
 * Label for the SELECTED interval pill: full HH:mm times, with the weekday on each end
 * when the interval crosses calendar days (so "06–06" can't be misread as zero-length).
 * Same-day selections omit the weekday (the day is in the column header).
 */
export function formatSelectionLabel(startISO: string, endISO: string): string {
  const s = new Date(startISO);
  const e = new Date(endISO);
  if (isSameDay(s, e)) return `${formatHHmm(s)} – ${formatHHmm(e)}`;
  const wd = (d: Date) => capitalize(formatWeekdayShort(d));
  return `${wd(s)} ${formatHHmm(s)} – ${wd(e)} ${formatHHmm(e)}`;
}

export type SlotKind = 'day' | 'night' | 'long';

export interface Slot {
  start: string;
  end: string;
}
export interface DayHeader {
  dayIndex: number;
  dayLabel: string;
  dayNumber: string;
  date: Date;
}
export interface Band {
  cellIndex: number;
  dayIndex: number;
  leftPx: number;
  widthPx: number;
  label: string;
  isSegmentOfSplit: boolean;
}
/** One header cell per slot, positioned at the slot's START, full slot duration wide —
 * an overnight slot's header cell lives entirely under its start day. `kind` drives the
 * chip: a sun/moon glyph names a short shift, while anything 24h or longer is both day
 * and night, so it drops the glyph and leads with its duration instead. */
export interface HeaderSlot {
  cellIndex: number;
  leftPx: number;
  widthPx: number;
  label: string;
  kind: SlotKind;
}
export interface GridGeometry {
  days: DayHeader[];
  bands: Band[];
  dayWidthPx: number;
  bodyWidthPx: number;
  headerSlots: HeaderSlot[];
}

const MIN_BAND_PX = 44;
// Floor, not a target: a 12h slot still draws a 60px band at 5px/hour, well past
// MIN_BAND_PX, and the narrower day fits ~2.8 days on a 6.9" screen instead of 2.3.
const HOUR_W_MIN = 5;
const HOUR_W_MAX = 10; // DAY_W cap = 240

interface CellSegment {
  dayIndex: number;
  startHour: number;
  hours: number;
}

function hourOfDay(d: Date): number {
  return d.getHours() + d.getMinutes() / 60;
}

/** Split a cell into per-calendar-day segments. Resolution-independent (no px). */
function splitCell(cell: { start: string; end: string }, gridStart: Date): CellSegment[] {
  const start = new Date(cell.start);
  const end = new Date(cell.end);
  const segments: CellSegment[] = [];
  let segStart = start;
  while (segStart < end) {
    const nextMidnight = startOfDay(addDays(segStart, 1));
    const segEnd = nextMidnight < end ? nextMidnight : end;
    const dayIndex = differenceInCalendarDays(startOfDay(segStart), gridStart);
    const startHour = hourOfDay(segStart);
    const endHour = segEnd.getTime() === nextMidnight.getTime() ? 24 : hourOfDay(segEnd);
    segments.push({ dayIndex, startHour, hours: endHour - startHour });
    segStart = segEnd;
  }
  return segments;
}

/**
 * Pick an hour-width so the narrowest RENDERED band clears the touch-target floor,
 * clamped to a column-size cap.
 *
 * Measured per CELL, not per day-segment. A cell that straddles midnight is split into
 * segments for positioning, but `mergeRowBands` fuses every segment of the same
 * `cellIndex` back into ONE pill with ONE press handler — so a segment is never a tap
 * target on its own. Sizing off segments made the canonical 06/18 + 12h config derive
 * its column from the night's 6h half instead of its full 12h, inflating the day to
 * 192px and fitting under two days on screen.
 */
function deriveHourW(minCellHours: number): number {
  if (!isFinite(minCellHours) || minCellHours <= 0) return HOUR_W_MIN;
  const needed = Math.ceil(MIN_BAND_PX / minCellHours);
  return Math.min(HOUR_W_MAX, Math.max(HOUR_W_MIN, needed));
}

/**
 * Canonical chronological slot list for [from, to): for each day in the range,
 * one slot per slotStartTimes entry, each lasting incrementHours. A slot is
 * included iff its `start` falls within [from, to); an overnight slot's `end`
 * may legitimately cross midnight.
 *
 * Timezone: when `opts.timezone` (an IANA zone like "Europe/Bucharest", carried
 * by the availability contract) is provided, slot start instants are generated
 * against the LAKE's wall clock — correct even on a device in another timezone
 * (the backend validates slots in the lake zone). When `timezone` is absent we
 * FALL BACK to the previous DEVICE-LOCAL behavior byte-for-byte — so the common
 * RO-zone case is unchanged and this carries zero regression risk.
 */
export function generateSlots(opts: {
  from: string;
  to: string;
  slotStartTimes: string[];
  incrementHours: number;
  timezone?: string;
}): Slot[] {
  const tz = opts.timezone?.trim();
  return tz ? generateSlotsZoned(opts, tz) : generateSlotsLocal(opts);
}

/** Device-local generation (the original implementation; the no-timezone fallback). */
function generateSlotsLocal(opts: { from: string; to: string; slotStartTimes: string[]; incrementHours: number }): Slot[] {
  const from = new Date(opts.from);
  const to = new Date(opts.to);
  const durationMs = opts.incrementHours * 3600_000;
  const slots: Slot[] = [];

  for (let day = startOfDay(from); day < to; day = startOfDay(addDays(day, 1))) {
    for (const raw of opts.slotStartTimes) {
      // Accept any time form: "06:00", "06:00:00", or the Strapi `time` field "06:00:00.000".
      // We only need the leading hour:minute. Guard malformed entries so one bad value
      // can't crash the whole grid.
      const m = /^(\d{1,2}):(\d{2})/.exec(String(raw));
      if (!m) continue;
      const start = new Date(day.getTime());
      start.setHours(Number(m[1]), Number(m[2]), 0, 0);
      if (!isValidDate(start) || start < from || start >= to) continue;
      const end = new Date(start.getTime() + durationMs);
      if (!isValidDate(end)) continue;
      slots.push({ start: formatLocalIso(start), end: formatLocalIso(end) });
    }
  }

  slots.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  return slots;
}

// Formatters are immutable and expensive to construct on Hermes; one per zone, for the
// life of the module. `utcInstantToZonedIso` used to build one PER SLOT.
const dayPartsFmtByZone = new Map<string, Intl.DateTimeFormat>();
function dayPartsFmtFor(tz: string): Intl.DateTimeFormat {
  let fmt = dayPartsFmtByZone.get(tz);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
    dayPartsFmtByZone.set(tz, fmt);
  }
  return fmt;
}
const wallFmtByZone = new Map<string, Intl.DateTimeFormat>();
function wallFmtFor(tz: string): Intl.DateTimeFormat {
  let fmt = wallFmtByZone.get(tz);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
    wallFmtByZone.set(tz, fmt);
  }
  return fmt;
}

/**
 * Lake-timezone generation. Walks the lake-zone CALENDAR days the [from, to)
 * window touches and places each slot at its lake-zone wall time. The slot ISO
 * carries the lake-zone offset, so `new Date(slot.start)` is the correct UTC
 * instant and the literal "HH:mm" still reads the lake wall clock for the grid.
 */
function generateSlotsZoned(
  opts: { from: string; to: string; slotStartTimes: string[]; incrementHours: number },
  tz: string
): Slot[] {
  const fromMs = new Date(opts.from).getTime();
  const toMs = new Date(opts.to).getTime();
  const durationMs = opts.incrementHours * 3600_000;
  const slots: Slot[] = [];

  // Lake-zone calendar day of the window start. We then step day by day (DST-safe:
  // +26h past local midnight re-derives the next local date) until past `to`.
  const dayPartsFmt = dayPartsFmtFor(tz);
  const localDate = (ms: number): { y: number; m: number; d: number } => {
    const [y, m, d] = dayPartsFmt.format(new Date(ms)).split('-').map(Number);
    return { y, m, d };
  };

  let cur = localDate(fromMs);
  // Bound the walk (a month window is ≤ 31 days; guard runaway loops).
  for (let guard = 0; guard < 400; guard++) {
    const midnightUtcMs = zonedWallTimeToUtc(cur.y, cur.m, cur.d, 0, tz).getTime();
    if (midnightUtcMs >= toMs) break;

    for (const raw of opts.slotStartTimes) {
      const match = /^(\d{1,2}):(\d{2})/.exec(String(raw));
      if (!match) continue;
      const minuteOfDay = Number(match[1]) * 60 + Number(match[2]);
      const startMs = zonedWallTimeToUtc(cur.y, cur.m, cur.d, minuteOfDay, tz).getTime();
      if (!Number.isFinite(startMs) || startMs < fromMs || startMs >= toMs) continue;

      const startIso = zonedWallTimeIso(cur.y, cur.m, cur.d, minuteOfDay, tz);
      // End is the start instant + duration, re-expressed as a lake wall-clock ISO so
      // the grid reads the end "HH:mm" in lake time too (and the offset stays correct
      // across a DST boundary inside the slot).
      const endMs = startMs + durationMs;
      if (!Number.isFinite(endMs)) continue;
      const endIso = utcInstantToZonedIso(endMs, tz);
      slots.push({ start: startIso, end: endIso });
    }

    // Advance one lake-zone calendar day.
    cur = localDate(midnightUtcMs + 26 * 3600_000);
  }

  slots.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  return slots;
}

/** ISO 8601 for a UTC instant expressed in `tz`'s wall clock + offset suffix. */
function utcInstantToZonedIso(ms: number, tz: string): string {
  const parts = wallFmtFor(tz)
    .formatToParts(new Date(ms))
    .reduce<Record<string, string>>((acc, x) => {
      if (x.type !== 'literal') acc[x.type] = x.value;
      return acc;
    }, {});
  const y = Number(parts.year);
  const mo = Number(parts.month);
  const d = Number(parts.day);
  const minuteOfDay = (Number(parts.hour) % 24) * 60 + Number(parts.minute);
  return zonedWallTimeIso(y, mo, d, minuteOfDay, tz);
}

export function buildGridGeometryFromSlots(slots: Slot[]): GridGeometry {
  if (slots.length === 0) {
    return { days: [], bands: [], dayWidthPx: HOUR_W_MIN * 24, bodyWidthPx: 0, headerSlots: [] };
  }
  // Precondition: `slots` are in chronological order, so slots[0] is the earliest. Do NOT sort
  // here — `cellIndex` must stay the exact index into slots[] (selection logic depends on that
  // mapping). Out-of-order slots would produce a later gridStart and thus negative dayIndex values.
  const gridStart = startOfDay(new Date(slots[0].start));

  // Pass 1: split every slot into day segments and find the shortest CELL. A cell's
  // segments render as one merged pill, so the cell's TOTAL duration is what has to
  // clear the touch-target floor — see deriveHourW.
  const cellSegments = slots.map(slot => splitCell(slot, gridStart));
  let minCellHours = Infinity;
  for (const segs of cellSegments) {
    const total = segs.reduce((acc, seg) => acc + seg.hours, 0);
    if (total > 0 && total < minCellHours) minCellHours = total;
  }
  const hourW = deriveHourW(minCellHours);
  const dayW = hourW * 24;

  // Pass 2: build day headers + absolutely-positioned bands using the derived width.
  const days: DayHeader[] = [];
  const seenDays = new Set<number>();
  const bands: Band[] = [];

  cellSegments.forEach((segments, cellIndex) => {
    const slot = slots[cellIndex];
    const label = formatInterval(slot.start, slot.end);
    const isSegmentOfSplit = segments.length > 1;
    for (const seg of segments) {
      if (!seenDays.has(seg.dayIndex)) {
        seenDays.add(seg.dayIndex);
        const dayDate = addDays(gridStart, seg.dayIndex);
        days.push({
          dayIndex: seg.dayIndex,
          dayLabel: capitalize(formatWeekdayWide(dayDate)),
          dayNumber: String(dayDate.getDate()),
          date: dayDate,
        });
      }
      bands.push({
        cellIndex,
        dayIndex: seg.dayIndex,
        leftPx: seg.dayIndex * dayW + (seg.startHour / 24) * dayW,
        widthPx: (seg.hours / 24) * dayW,
        label,
        isSegmentOfSplit,
      });
    }
  });

  days.sort((a, b) => a.dayIndex - b.dayIndex);
  const numDays = days.length ? days[days.length - 1].dayIndex + 1 : 0;

  // Pass 3: one header cell per slot, positioned at the slot's START day/hour, full
  // slot duration wide — an overnight slot's header cell lives entirely under its
  // start day (per spec: "capul de coloană spune ziua în care intervalul începe").
  const headerSlots: HeaderSlot[] = [];
  cellSegments.forEach((segments, cellIndex) => {
    if (segments.length === 0) return;
    const first = segments[0];
    const totalHours = segments.reduce((acc, s) => acc + s.hours, 0);
    const kind = classifySlot(totalHours, segments.length);
    headerSlots.push({
      cellIndex,
      leftPx: first.dayIndex * dayW + (first.startHour / 24) * dayW,
      widthPx: (totalHours / 24) * dayW,
      label: formatSlotLabel(slots[cellIndex].start, slots[cellIndex].end, kind, totalHours),
      kind,
    });
  });

  return { days, bands, dayWidthPx: dayW, bodyWidthPx: numDays * dayW, headerSlots };
}

/**
 * Day-index range to render given the horizontal scroll offset + viewport width.
 * Renders only columns near the viewport (± buffer days) so far-scrolled grids stay bounded.
 */
export function visibleColumnRange(
  scrollX: number,
  viewportW: number,
  dayWidthPx: number,
  buffer = 2
): { firstDay: number; lastDay: number } {
  if (dayWidthPx <= 0) return { firstDay: 0, lastDay: 0 };
  const firstDay = Math.max(0, Math.floor(scrollX / dayWidthPx) - buffer);
  const lastDay = Math.floor((scrollX + viewportW) / dayWidthPx) + buffer;
  return { firstDay, lastDay };
}
