/** fish `features/lakes/booking/availabilityStatus.ts` (verbatim). */
import type { CellStatus, OccupiedInterval, BlockedInterval } from '../schemas';

export interface SlotStatus {
  status: CellStatus;
  /** Booker's initials for a `booked` slot; '' otherwise. */
  initials: string;
  /** The block that produced a `blocked` verdict; null otherwise. */
  block: BlockInfo | null;
  isPast: boolean;
  /** The slot has ENDED, not merely started. An operator adding a walk-in at the
   * gate can still sell a running interval (a 12→12 lake would otherwise be
   * unbookable on-site from noon onward); an angler cannot. */
  isOver: boolean;
  /** Starts under 24h from now: not selectable in-app (short-notice goes by
   * phone), but still tappable — the grid opens a call-the-operator sheet. */
  tooSoon: boolean;
}

/** Booking lead time (hours) — mirrors the backend BOOKING_TOO_SOON guard. */
export const BOOKING_LEAD_HOURS = 24;
/** What a blocked cell can tell the user, carried through from the API. */
export interface BlockInfo {
  reason: string;
  /** The block's own window — the sheet states how long the lake is closed. */
  start: string;
  end: string;
  /** Competition name, or the operator's note on a manual block. */
  label: string | null;
  /** Present only for real competitions — the sheet's "see it" target. */
  competitionId: string | null;
}
/** Interval plus the payload the grid renders for it (initials / block info). */
interface Span { s: number; e: number; initials: string; block: BlockInfo | null }
export interface ExceptionIndex {
  bookingsByStand: Map<string, Span[]>;
  blocksByStand: Map<string, Span[]>;
  lakeWideBlocks: Span[];
}
const ms = (iso: string) => new Date(iso).getTime();
function push(map: Map<string, Span[]>, key: string, span: Span) {
  const a = map.get(key); if (a) a.push(span); else map.set(key, [span]);
}
export function indexExceptions(bookings: OccupiedInterval[], blocks: BlockedInterval[]): ExceptionIndex {
  const bookingsByStand = new Map<string, Span[]>();
  const blocksByStand = new Map<string, Span[]>();
  const lakeWideBlocks: Span[] = [];
  for (const b of bookings) {
    push(bookingsByStand, b.standDocumentId, { s: ms(b.start), e: ms(b.end), initials: b.initials ?? '', block: null });
  }
  for (const b of blocks) {
    const span: Span = {
      s: ms(b.start),
      e: ms(b.end),
      initials: '',
      block: {
        reason: b.reason,
        start: b.start,
        end: b.end,
        label: b.label ?? null,
        competitionId: b.competitionId ?? null,
      },
    };
    if (b.standDocumentId == null) lakeWideBlocks.push(span);
    else push(blocksByStand, b.standDocumentId, span);
  }
  return { bookingsByStand, blocksByStand, lakeWideBlocks };
}
// Half-open overlap: [s,e) intersects [sp.s, sp.e) — touching endpoints do NOT overlap.
// Returns the FIRST overlapping span so the caller can render what it carries.
const firstOverlap = (spans: Span[] | undefined, s: number, e: number): Span | undefined =>
  spans && spans.find(sp => sp.s < e && sp.e > s);
export function resolveSlotStatus(
  standId: string,
  slot: { start: string; end: string },
  idx: ExceptionIndex,
  nowMs: number,
  /** Per-lake minimum booking lead; the API's `leadHours` (24 when absent). */
  leadHours: number = BOOKING_LEAD_HOURS
): SlotStatus {
  const s = ms(slot.start), e = ms(slot.end);
  const isPast = s < nowMs;
  const isOver = e <= nowMs;
  const tooSoon = !isPast && s < nowMs + leadHours * 3600_000;
  // Stand-specific blocks are checked first: a stand closed for maintenance during
  // a competition should say maintenance, matching the backend's precedence.
  const block = firstOverlap(idx.blocksByStand.get(standId), s, e) ?? firstOverlap(idx.lakeWideBlocks, s, e);
  if (block) return { status: 'blocked', initials: '', block: block.block, isPast, isOver, tooSoon };
  const booking = firstOverlap(idx.bookingsByStand.get(standId), s, e);
  if (booking) return { status: 'booked', initials: booking.initials, block: null, isPast, isOver, tooSoon };
  return { status: 'available', initials: '', block: null, isPast, isOver, tooSoon };
}

/** Accessibility label for a grid cell. Cells carry no visible text anymore
 *  (price lives in the selection sheet), so the status word comes from the
 *  resolved status itself: "trecut" for history, "indisponibil" for booked/blocked,
 *  "disponibil" otherwise. `label` is the selection pill's interval text — spoken
 *  when present. "selectat" always appends last when the cell is the active selection. */
export function cellA11yLabel(
  standName: string,
  status: CellStatus,
  isPast: boolean,
  selected: boolean,
  label: string
): string {
  const parts = [standName];
  if (label) parts.push(label);
  parts.push(isPast ? 'trecut' : status !== 'available' ? 'indisponibil' : 'disponibil');
  if (selected) parts.push('selectat');
  return parts.join(', ');
}
