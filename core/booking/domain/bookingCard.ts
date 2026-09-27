/**
 * Pure helpers that lived inside fish booking components:
 * - `extrasSummary` — `features/bookings/ui/ExtrasRow.tsx`
 * - `startsInLabel`, `cancelWindowClosed`, `deadBookingReason` — `features/bookings/MyBookingRow.tsx`
 * - `PAYMENT`, `formatLei`, `when`, `bookingName`, `bookingPeriod`, `bookingHours`,
 *   `bookingActionGates` — `features/operator/BookingDetailSheet.tsx`
 * - `cancellationPolicyText` — `features/lakes/booking/BookingReview.tsx`
 */
import type { BookingDTO, CancellationPolicyDTO, PaymentStatus, QuoteExtraLine } from '../schemas';
import { meaningfulNoShowNote } from './cancelNotes';
import { capitalize as cap, formatHHmm, formatMonthAbbr, formatWeekdayShort } from './dates';

/**
 * What the collapsed extras row says:
 *  - a single extra names itself; several are counted, since the names would not
 *    fit on one line and the point of the row is the money
 *  - a single extra charged once has nothing more to show — expanding it would
 *    repeat the collapsed line, so the row stays plain and untappable
 */
export function extrasSummary(extras: QuoteExtraLine[]): {
  total: number;
  headline: string;
  expandable: boolean;
} {
  return {
    total: extras.reduce((sum, e) => sum + e.total, 0),
    headline: extras.length > 1 ? `${extras.length} extra` : (extras[0]?.label ?? ''),
    expandable: extras.length > 1 || (extras[0]?.quantity ?? 0) > 1,
  };
}

/** Inside the lake's `minCancelNoticeHours` the angler can no longer cancel in-app (they call). */
export function cancelWindowClosed(booking: BookingDTO, nowMs: number = Date.now()): boolean {
  const hours = booking.lake?.minCancelNoticeHours ?? 0;
  if (!hours) return false;
  return nowMs > new Date(booking.startDate).getTime() - hours * 3_600_000;
}

function startOfDayMs(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** "Începe astăzi / mâine / în N zile" for a booking that has not started. */
export function startsInLabel(startISO: string, nowMs = Date.now()): string | null {
  const start = new Date(startISO);
  if (start.getTime() - nowMs < 0) return null;
  const days = Math.round((startOfDayMs(start) - startOfDayMs(new Date(nowMs))) / 86_400_000);
  if (days === 0) return 'Începe astăzi';
  if (days === 1) return 'Începe mâine';
  return `Începe în ${days} ${days > 19 ? 'de zile' : 'zile'}`;
}

/** Why a dead booking died, for the angler's card: the no-show note or the cancel reason. */
export function deadBookingReason(booking: BookingDTO): string | null {
  if (booking.noShow) return meaningfulNoShowNote(true, booking.noShowComment);
  if (booking.bookingStatus === 'cancelled' || booking.bookingStatus === 'rejected')
    return booking.cancelReason ?? null;
  return null;
}

/** Money badge — the one thing beside the total the operator scans a list for. */
export const PAYMENT: Record<PaymentStatus, { label: string; fill: string; text: string }> = {
  none: { label: 'Numerar', fill: '#E5F6F3', text: '#15803D' },
  depositPaid: { label: 'Avans', fill: '#FEF9C3', text: '#CA8A04' },
  paidInFull: { label: 'Plătit', fill: '#F0F3FD', text: '#4338CA' },
  refunded: { label: 'Rambursat', fill: '#F2F4F7', text: '#475467' },
};

export const formatLei = (n: number) => n.toLocaleString('ro-RO');

/** "Jo 27 aug 18:00" — the list spans days, so unlike the panel's "Azi" card the date is there. */
export const when = (iso: string) => {
  const d = new Date(iso);
  return cap(`${formatWeekdayShort(d)} ${d.getDate()} ${formatMonthAbbr(d)} ${formatHHmm(d)}`.replace('.', ''));
};

export const bookingName = (b: BookingDTO) => b.angler?.username ?? b.contactFullname ?? 'Pescar';
export const bookingPeriod = (b: BookingDTO) => `${when(b.startDate)} → ${when(b.endDate)}`;
export const bookingHours = (b: BookingDTO) => {
  const startMs = new Date(b.startDate).getTime();
  const endMs = new Date(b.endDate).getTime();
  return b.basis?.durationHours ?? Math.max(1, Math.round((endMs - startMs) / 3600_000));
};

/** What the operator may do about this booking right now — one gate set, shared by card, sheet and panel. */
export function bookingActionGates(b: BookingDTO, nowMs = Date.now()) {
  const ended = new Date(b.endDate).getTime() < nowMs;
  const isPending = b.bookingStatus === 'pending';
  const isAcceptedStay = b.bookingStatus === 'confirmed' || b.bookingStatus === 'completed';
  const canRate = isAcceptedStay && ended && !b.noShow && !b.reviewedByOperator;
  const canCancel = b.bookingStatus === 'confirmed' && !b.noShow && !ended;
  return { ended, isPending, canRate, canCancel };
}

/** Maps a cancellation policy type to plain RO copy. */
export function cancellationPolicyText(
  policy: Pick<CancellationPolicyDTO, 'type' | 'refundWindowHours'> | null | undefined
): string {
  if (!policy) return 'Contactează administratorul lacului pentru detalii despre anulare.';
  const hours = policy.refundWindowHours;
  switch (policy.type) {
    case 'refundable':
      return hours
        ? `Anulare cu rambursare dacă anulezi cu cel puțin ${hours} ore înainte.`
        : 'Anulare cu rambursare.';
    case 'nonRefundable':
      return 'Avansul nu se restituie.';
    case 'rescheduleOnly':
      return hours
        ? `Reprogramare posibilă dacă anunți cu cel puțin ${hours} ore înainte.`
        : 'Reprogramare (fără rambursare în numerar).';
    default:
      return 'Contactează administratorul lacului pentru detalii despre anulare.';
  }
}
