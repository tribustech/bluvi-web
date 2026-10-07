import {
  buildTimeline,
  cancelWindowClosed,
  formatHHmm,
  RO_MONTHS_ABBR,
  stripAppendedCancelReason,
  type BookingBasis,
  type BookingDTO,
  type TimelineStep,
} from '@/core/booking';
import { formatCount } from '@/core/realtime/chat/format';

/*
 * What the booking page (booking.rezervare) may show and offer — fish app/(app)/bookings/[id].tsx +
 * the `actions` half of features/bookings/MyBookingRow.tsx, as data, so the screen only draws it and
 * the gates are unit-tested. `nowMs` is the browser's clock (fish Date.now() per render).
 */

export type BookingDetailModel = {
  /** End minus the lake's checkout buffer is past. */
  ended: boolean;
  /** c4 — pending or confirmed and not ended. */
  canCancel: boolean;
  /** c3 — confirmed / completed, ended, not a no-show, with a lake: may be reviewed (if no review yet). */
  reviewable: boolean;
  /** c5 — cancellable, but inside the lake's minCancelNoticeHours. */
  noticeClosed: boolean;
  /** c4 — the call button's label when the lake has a phone (null: no call button). */
  callLabel: 'Sună pentru anulare' | 'Sună la baltă' | null;
  /** The lake's phone (tel:), only when the call button shows. */
  lakePhone: string | null;
  /** c5 — «Anulează» in the app. */
  showCancel: boolean;
  /** c5 — «Anulările cu mai puțin de {h} … se fac telefonic.» (null while the window is open). */
  noticeLine: string | null;
  /** c10 — the rebook card (cancelled, rejected or ended, with a lake). */
  rebook: { lakeId: string; lakeName: string } | null;
  /** c11 — the price basis snapshot (null: no card). */
  basis: BookingBasis | null;
  /** c12 — the angler's timeline. */
  timeline: TimelineStep[];
  /** c13 — the angler's own note, the operator's appended reason stripped ('' → no card). */
  note: string;
};

const CANCELLABLE = new Set(['pending', 'confirmed']);

/** «27 aug, 18:00» — fish format(d, 'd MMM, HH:mm', { locale: ro }). */
export function dayMonthTime(d: Date): string {
  return `${d.getDate()} ${RO_MONTHS_ABBR[d.getMonth()]}, ${formatHHmm(d)}`;
}

/**
 * fish isPastBooking: a booking the angler can no longer act on — cancelled / rejected, or the
 * (raw) end is past. fish reads `endDate` here, not end minus the buffer (unlike `ended`).
 */
export function isPastBooking(b: BookingDTO, nowMs: number): boolean {
  if (b.bookingStatus === 'cancelled' || b.bookingStatus === 'rejected') return true;
  return new Date(b.endDate).getTime() < nowMs;
}

/** c5 — the owner's plural rule (formatCount): «1 oră», «2 ore», «24 de ore». */
export function cancelNoticeLine(hours: number): string {
  return `Anulările cu mai puțin de ${formatCount(hours, 'oră', 'ore')} înainte de început se fac telefonic.`;
}

export function bookingDetailModel(b: BookingDTO, nowMs: number): BookingDetailModel {
  const startMs = new Date(b.startDate).getTime();
  const bufferMin = b.lake?.checkoutBufferMinutes ?? 0;
  const end = new Date(new Date(b.endDate).getTime() - bufferMin * 60_000);
  const ended = end.getTime() < nowMs;
  const canCancel = CANCELLABLE.has(b.bookingStatus) && !ended;
  const reviewable = (b.bookingStatus === 'confirmed' || b.bookingStatus === 'completed') && ended && !b.noShow && !!b.lake?.documentId;
  const noticeClosed = canCancel && cancelWindowClosed(b, nowMs);
  const started = startMs <= nowMs;
  const phone = b.lake?.contactPhone?.trim() || null;
  const hours = b.lake?.minCancelNoticeHours ?? 0;
  return {
    ended,
    canCancel,
    reviewable,
    noticeClosed,
    callLabel: canCancel && phone ? (noticeClosed && !started ? 'Sună pentru anulare' : 'Sună la baltă') : null,
    lakePhone: canCancel ? phone : null,
    showCancel: canCancel && !noticeClosed,
    noticeLine: noticeClosed ? cancelNoticeLine(hours) : null,
    rebook: isPastBooking(b, nowMs) && b.lake?.documentId ? { lakeId: b.lake.documentId, lakeName: b.lake.name } : null,
    basis: b.basis ?? null,
    timeline: buildTimeline({
      status: b.bookingStatus,
      audience: 'angler',
      // The DTO has no createdAt / confirmedAt for the angler's steps: titles only, never a made-up
      // date. The end is known — minus the checkout buffer, as every other surface shows it.
      endedLabel: `după ${dayMonthTime(end)}`,
    }),
    note: stripAppendedCancelReason(b.notes),
  };
}

/**
 * The lake's phone as people read it (c4, printed beside the call from 1024, where a tel: link may
 * do nothing): a Romanian number grouped 4-3-3 («0712 345 678», «+40 712 345 678»); anything else
 * as the lake typed it, trimmed. Display only — the tel: href keeps the raw digits.
 */
export function formatPhone(raw: string): string {
  const t = raw.trim();
  const compact = t.replace(/[\s.\-()]/g, '');
  let m = /^0(\d{3})(\d{3})(\d{3})$/.exec(compact);
  if (m) return `0${m[1]} ${m[2]} ${m[3]}`;
  m = /^(?:\+|00)40(\d{3})(\d{3})(\d{3})$/.exec(compact);
  if (m) return `+40 ${m[1]} ${m[2]} ${m[3]}`;
  return t;
}

/** fish PriceBreakdownCard rows: the tour (row label or «{h}h»), then each extra («× qty» above 1). */
export function priceRows(basis: BookingBasis): { label: string; value: number }[] {
  return [
    { label: basis.rowLabel ?? `${basis.durationHours}h`, value: basis.tourPrice },
    ...basis.extras.map((e) => ({ label: e.quantity > 1 ? `${e.label} × ${e.quantity}` : e.label, value: e.total })),
  ];
}

/** «Tura s-a compus din 12h + 12h.» when the engine composed the tour from more than one rate. */
export function composedLine(basis: BookingBasis): string | null {
  return basis.composedFrom.length > 1 ? `Tura s-a compus din ${basis.composedFrom.map((h) => `${h}h`).join(' + ')}.` : null;
}
