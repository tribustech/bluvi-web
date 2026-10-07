import {
  deadBookingReason,
  startsInLabel,
  statusAppearance,
  when,
  type BookingDTO,
  type StatusAppearance,
} from '@/core/booking';
import { formatCount } from '@/core/realtime/chat/format';

/*
 * What one booking card says — fish features/bookings/MyBookingRow.tsx:57-90, as data, so the row
 * (components/booking/BookingRow) only draws it and the rules are unit-tested. `nowMs` is passed in:
 * the card reads the browser's clock (a live stay's progress, «Începe mâine»).
 */

/** The pill's colour family (fish statusModel's semantic tints, drawn with the kit's status tokens). */
export type BookingTone = 'warning' | 'success' | 'outline' | 'danger';

export type BookingCardModel = {
  appearance: StatusAppearance;
  tone: BookingTone;
  /** Dead booking (cancelled, rejected, no-show): the receded card, muted lake name and price. */
  quiet: boolean;
  lakeName: string;
  /** «Standul 5», or null without a stand. */
  standLabel: string | null;
  extras: { key: string; label: string }[];
  /** «Jo 27 aug 18:00 → Vi 28 aug 06:00 · 12h» (end minus the lake's checkout buffer; no hours while live). */
  periodLine: string;
  /** Confirmed, started, not ended, not a no-show. */
  live: boolean;
  /** Live only: the elapsed share 0–100 and «{elapsed}h din {h}h». */
  progressPct: number;
  progressLabel: string;
  /** «Începe astăzi / mâine / în {n} zile» — not-started, non-quiet bookings. */
  startsIn: string | null;
  /** The no-show note (unless the default one) or the cancel / reject reason. */
  deadReason: string | null;
  /** A request, not a reservation yet (the red warning). */
  pending: boolean;
  priceTotal: number;
};

/**
 * Pill tone per status. fish's own tints (statusModel APPEARANCE): pending yellow, confirmed green,
 * completed white with an indigo outline, rejected / cancelled / no-show red. An unknown status reads
 * as pending there (statusAppearance's fallback), and so does its tone here.
 */
export function bookingTone(status: string, noShow?: boolean): BookingTone {
  if (noShow) return 'danger';
  switch (status) {
    case 'confirmed':
      return 'success';
    case 'completed':
      return 'outline';
    case 'rejected':
    case 'cancelled':
      return 'danger';
    default:
      return 'warning';
  }
}

/**
 * fish startsInLabel with the owner's plural rule (ROADMAP: formatCount — «20 de zile», «101 zile»):
 * fish adds «de» above 19 days at every count, Romanian only from 20 up to the next hundred.
 */
export function startsInText(startISO: string, nowMs: number): string | null {
  const label = startsInLabel(startISO, nowMs);
  if (!label || label === 'Începe astăzi' || label === 'Începe mâine') return label;
  const days = Number(/\d+/.exec(label)?.[0]);
  return Number.isFinite(days) ? `Începe în ${formatCount(days, 'zi', 'zile')}` : label;
}

export function bookingCardModel(booking: BookingDTO, nowMs: number): BookingCardModel {
  const startMs = new Date(booking.startDate).getTime();
  const buffer = booking.lake?.checkoutBufferMinutes ?? 0;
  const endMs = new Date(booking.endDate).getTime() - buffer * 60_000;
  const appearance = statusAppearance(booking.bookingStatus, {
    cancelledBy: booking.cancelledBy,
    viewer: 'angler',
    noShow: booking.noShow,
  });
  const live = booking.bookingStatus === 'confirmed' && nowMs >= startMs && nowMs < endMs && !booking.noShow;
  const hours = booking.basis?.durationHours ?? Math.max(1, Math.round((endMs - startMs) / 3_600_000));
  const elapsed = Math.min(hours, Math.floor((nowMs - startMs) / 3_600_000));
  const period = `${when(booking.startDate)} → ${when(new Date(endMs).toISOString())}`;
  const span = endMs - startMs;
  return {
    appearance,
    tone: bookingTone(booking.bookingStatus, booking.noShow),
    quiet: appearance.quiet,
    lakeName: booking.lake?.name || 'Lac',
    standLabel: booking.stand?.name ? `Standul ${booking.stand.name}` : null,
    extras: (booking.basis?.extras ?? []).map((e) => ({ key: e.key, label: e.label })),
    periodLine: live ? period : `${period} · ${hours}h`,
    live,
    progressPct: live && span > 0 ? Math.min(100, Math.max(0, Math.round(((nowMs - startMs) / span) * 100))) : 0,
    progressLabel: live ? `${elapsed}h din ${hours}h` : '',
    startsIn: appearance.quiet || live ? null : startsInText(booking.startDate, nowMs),
    deadReason: deadBookingReason(booking) || null,
    pending: booking.bookingStatus === 'pending',
    priceTotal: booking.priceTotal,
  };
}
