/** fish `features/lakes/booking/availabilityPaging.ts` (date-fns replaced by `./dates`). */
import type { AvailabilityExtra, BlockedInterval, LakeAvailability, OccupiedInterval } from '../schemas';
import { formatLocalIso, startOfMonthOffset } from './dates';
import { zonedWallTimeIso } from './timezone';

export interface MonthWindow {
  from: string;
  to: string;
}

/**
 * Month-boundary ISO. When `timezone` (an IANA zone) is given, the boundary is
 * the start of the lake-zone calendar month (DST-correct, carries the lake-zone
 * offset). When absent, FALL BACK to the device-local boundary byte-for-byte —
 * matching the previous behavior so the common RO-zone case is unchanged. The
 * `d` argument is already a device-local start-of-month Date; we read its
 * calendar fields to anchor the lake-zone boundary on the same calendar month.
 *
 * Device-local ISO ("2026-06-01T00:00:00+03:00") keeps `from.slice(0,10)` aligned to the
 * local calendar month boundary (a bare `toISOString()` would drift the date across the UTC
 * boundary in non-UTC zones).
 */
const monthBoundaryIso = (d: Date, timezone?: string): string => {
  const tz = timezone?.trim();
  if (!tz) return formatLocalIso(d);
  return zonedWallTimeIso(d.getFullYear(), d.getMonth() + 1, 1, 0, tz);
};

/**
 * [start-of-month(now+offset), start-of-month(now+offset+1)).
 * When `timezone` is supplied the boundaries are lake-zone month starts; otherwise
 * device-local (the original, masked-by-RO-userbase behavior — preserved exactly).
 */
export function monthWindow(offset: number, now: Date, timezone?: string): MonthWindow {
  const start = startOfMonthOffset(now, offset);
  const next = startOfMonthOffset(now, offset + 1);
  return { from: monthBoundaryIso(start, timezone), to: monthBoundaryIso(next, timezone) };
}

export interface MergedAvailability {
  lakeId: string;
  bookingEnabled: boolean;
  incrementHours: number;
  /** Per-lake minimum booking lead in hours (24 when the backend omits it). */
  leadHours: number;
  slotStartTimes: string[];
  /** Lake-local times a tour may not end at; empty when the lake (or an older
   *  backend) sets none. Lake-level, so taken from the first page like the rest. */
  forbiddenEndTimes: string[];
  /** Shortest tour the lake sells; falls back to one increment. */
  minDurationHours: number;
  timezone: string;
  stands: LakeAvailability['stands'];
  bookings: OccupiedInterval[];
  blocks: BlockedInterval[];
  loadedRange: { from: string; to: string };
  /** What the lake sells beside the tour — lake-level, taken from the first page. */
  extras: AvailabilityExtra[];
}

const bKey = (b: OccupiedInterval) => `${b.standDocumentId}|${b.start}|${b.end}`;
const blKey = (b: BlockedInterval) => `${b.standDocumentId ?? '*'}|${b.start}|${b.end}|${b.reason}`;

function dedupe<T>(arr: T[], key: (t: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const x of arr) {
    const k = key(x);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(x);
    }
  }
  return out;
}

/** Merge monthly pages into one view: config/stands from the first page, deduped intervals, union range. */
export function mergePages(pages: LakeAvailability[]): MergedAvailability {
  if (pages.length === 0) {
    return {
      lakeId: '',
      bookingEnabled: false,
      incrementHours: 24,
      leadHours: 24,
      slotStartTimes: [],
      forbiddenEndTimes: [],
      minDurationHours: 24,
      timezone: 'Europe/Bucharest',
      stands: [],
      bookings: [],
      blocks: [],
      loadedRange: { from: '', to: '' },
      extras: [],
    };
  }
  const first = pages[0];
  return {
    lakeId: first.lakeId,
    bookingEnabled: first.bookingEnabled,
    incrementHours: first.incrementHours,
    leadHours: first.leadHours ?? 24,
    slotStartTimes: first.slotStartTimes,
    forbiddenEndTimes: first.forbiddenEndTimes ?? [],
    minDurationHours: first.minDurationHours ?? first.incrementHours,
    timezone: first.timezone,
    stands: first.stands,
    extras: first.extras ?? [],
    bookings: dedupe(
      pages.flatMap(p => p.bookings),
      bKey
    ),
    blocks: dedupe(
      pages.flatMap(p => p.blocks),
      blKey
    ),
    loadedRange: { from: pages[0].window.from, to: pages[pages.length - 1].window.to },
  };
}
