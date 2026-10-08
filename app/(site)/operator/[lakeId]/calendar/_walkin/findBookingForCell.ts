import type { BookingDTO } from '@/core/booking';

/*
 * The booking a booked band stands for — fish app/(app)/operator/[lakeId]/walk-in/index.tsx
 * openBooking (operator.calendar.c6). The availability endpoint is anonymous by design (initials,
 * never a name), so the identity comes from a client-side join against the lake's own bookings
 * (bucket «all», the pages loaded so far): same stand and an overlap with the tapped slot — not
 * exact bounds, the tapped cell is ONE slot while the booking may span several. Pure; it runs only
 * when a booked band is activated, never per cell.
 */

export type CellRef = {
  standDocumentId: string;
  startISO: string;
  endISO: string;
  /** The booked interval's start on that slot, from the availability (BookedCell) — at or before the booking's. */
  bookingStartISO?: string | null;
};

/** Statuses that hold a stand (what the availability draws as booked). */
const ENDED = new Set(['cancelled', 'rejected']);
/** The booking still holds its stand (the availability draws it): a cancelled / rejected one does not. */
export const holdsStand = (b: BookingDTO) => !ENDED.has(String(b.bookingStatus));

/**
 * The loaded booking on `cell`'s stand overlapping its slot, or null (none loaded — a cell beyond the
 * loaded pages has nothing to open on). One that still holds the stand wins over a cancelled /
 * rejected one on the same slot (the band is drawn for the live one); fish takes the first match.
 */
export function findBookingForCell(rows: readonly BookingDTO[], cell: CellRef): BookingDTO | null {
  const s = Date.parse(cell.startISO);
  const e = Date.parse(cell.endISO);
  if (!Number.isFinite(s) || !Number.isFinite(e)) return null;
  let fallback: BookingDTO | null = null;
  for (const b of rows) {
    if (b.stand?.documentId !== cell.standDocumentId || !b.documentId) continue;
    if (!(Date.parse(b.startDate) < e && Date.parse(b.endDate) > s)) continue;
    if (holdsStand(b)) return b;
    fallback ??= b;
  }
  return fallback;
}

/** At most this many more pages are read for one activation (a guard, not the bound: see below). */
export const MAX_EXTRA_PAGES = 20;

/**
 * The bucket «all» list is sorted by start, latest first (the CMS's order, booking-buckets.ts): a lake
 * with bookings far ahead has the coming days' stays on later pages, so «the pages loaded so far»
 * (fish) misses them — a tap on next week's booked band would open nothing. True when the booking
 * covering `cell` can still be on a later page: the last loaded booking starts at or after the
 * booked interval's own start (`cell.bookingStartISO`, from the availability — the real bound, so a
 * stay of any length is found: no guessed look-back). Without that start (never for a booked band)
 * the pages are read until the guard. The web then reads the next page on that activation only (fish
 * reads one page and gives up — a web fix).
 */
export function mayBeOnLaterPage(rows: readonly BookingDTO[], cell: CellRef): boolean {
  const last = rows[rows.length - 1];
  if (!last) return false;
  const lastStart = Date.parse(last.startDate);
  if (!Number.isFinite(lastStart)) return false;
  const bound = cell.bookingStartISO ? Date.parse(cell.bookingStartISO) : NaN;
  // Equal starts may continue on the next page (ties), so `>=`.
  return Number.isFinite(bound) ? lastStart >= bound : true;
}
