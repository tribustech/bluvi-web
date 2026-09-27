/** fish `features/bookings/ui/statusModel.ts` (verbatim; `status` also accepts the raw DTO string). */
import type { BookingStatus, CancelledBy } from '../schemas';

export type StatusAppearance = { label: string; fill: string; text: string; quiet: boolean; border?: string };

/**
 * Semantic tint carries state and nothing else — indigo stays brand and action.
 * `quiet` drives the receded card variant, so a cancelled booking stops
 * competing with a live one. Completed and cancelled use white fill with an
 * indigo outline: this maintains contrast on both the page background and the
 * quiet card's softFill, ensuring the pill is never invisible over its background.
 */
const APPEARANCE: Record<BookingStatus, StatusAppearance> = {
  pending: { label: 'În așteptare', fill: '#FEF9C3', text: '#CA8A04', quiet: false },
  confirmed: { label: 'Confirmată', fill: '#E5F6F3', text: '#15803D', quiet: false },
  completed: { label: 'Încheiată', fill: 'white', text: '#475467', quiet: false, border: '#E0E7FF' },
  rejected: { label: 'Respinsă', fill: '#FEE4E2', text: '#E11D48', quiet: true },
  // Red like rejected: a cancellation is a bad ending on either side, and the
  // white/indigo outline made it read like a plain "Încheiată".
  cancelled: { label: 'Anulată', fill: '#FEE4E2', text: '#B42318', quiet: true },
};

/**
 * Who is looking. A cancellation reads differently from each side of it, so the
 * pill is written from the viewer's point of view rather than in the API's
 * absolute terms.
 */
export type BookingViewer = 'angler' | 'operator';

const CANCELLED_LABEL: Record<BookingViewer, Record<CancelledBy, string>> = {
  operator: {
    angler: 'Anulată de pescar',
    operator: 'Anulată de tine',
    system: 'Anulare automată',
  },
  angler: {
    angler: 'Anulată de tine',
    operator: 'Anulată de baltă',
    system: 'Anulare automată',
  },
};

/**
 * A no-show stays `confirmed` server-side (that is what keeps it counting as a
 * no-show rather than a cancellation), so the raw status would show "Confirmată"
 * on a booking nobody turned up for. The pill reports what happened instead.
 */
const NO_SHOW_APPEARANCE: StatusAppearance = {
  label: 'Nu a venit',
  fill: '#FEE4E2',
  text: '#B42318',
  quiet: true,
};

export function statusAppearance(
  status: BookingStatus | (string & {}),
  opts?: { cancelledBy?: CancelledBy; viewer?: BookingViewer; noShow?: boolean }
): StatusAppearance {
  if (opts?.noShow) return NO_SHOW_APPEARANCE;
  // Fallback to pending if CMS adds a new status before this app ships.
  // At runtime, the API returns a string that might be unknown to this code.
  const base = APPEARANCE[status as BookingStatus] ?? APPEARANCE.pending;
  if (status !== 'cancelled' || !opts?.cancelledBy) return base;
  // Bookings cancelled before the CMS shipped `cancelledBy` have none, and the
  // plain "Anulată" above is the honest label for them.
  const label = CANCELLED_LABEL[opts.viewer ?? 'angler'][opts.cancelledBy];
  return label ? { ...base, label } : base;
}
