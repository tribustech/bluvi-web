import {
  bookingActionGates,
  bookingHours,
  bookingName,
  bookingPeriod,
  capitalize,
  formatHHmm,
  formatLei,
  formatMonthAbbr,
  formatWeekdayShort,
  meaningfulNoShowNote,
  PAYMENT,
  stripAppendedCancelReason,
  type BookingDTO,
  type PaymentStatus,
} from '@/core/booking';
import { formatCount } from '@/core/realtime/chat/format';
import { routes } from '@/lib/routes';

/*
 * What the operator's booking detail says — fish features/operator/BookingDetailSheet.tsx
 * (DetailBody + BookingActionRow), as data, so the dialog only draws it and the rules are
 * unit-tested. `nowMs` is passed in: the action row depends on whether the stay has ended.
 */

/** «120 lei» — the amount, a space, the unit (owner rule: units spaced). */
export const lei = (n: number) => `${formatLei(n)} lei`;

export type DetailLine = { label: string; value: string; strong?: boolean };

/** Which buttons the action row holds (fish BookingActionRow, one branch per variant). */
export type ActionVariant = 'pending' | 'cancel' | 'rate' | 'none';

export type BookingDetailModel = {
  name: string;
  /** The angler's account, when the booking has one: the avatar and the name open the profile. */
  anglerId: string | null;
  avatar: string | null;
  /** «Standul 5», or null without a stand. */
  standLabel: string | null;
  extras: { key: string; label: string }[];
  /** «Jo 27 aug 18:00 → Vi 28 aug 06:00 · 12h». */
  periodLine: string;
  /** «150 lei» (rounded, as fish's header). */
  price: string;
  /** «Cum s-a calculat» — null without a basis (bookings made before the server sent it). */
  basis: { lines: DetailLine[]; total: DetailLine } | null;
  /** «Plată»: Stare, Încasat (when > 0), Rest de plată (bold, when paid < total and still owed: owesRest). */
  payment: DetailLine[];
  /** «Rezervare»: Cod, Cerută (when createdAt), Telefon (when contactPhone). */
  request: DetailLine[];
  /** The angler's message, the operator's appended reason stripped; '' when none. */
  note: string;
  /** «Motiv refuz» / «Motiv anulare» + the reason, or null. */
  reason: { title: string; text: string } | null;
  /** A no-show note the operator actually wrote (not the default sentence); '' when none. */
  noShowNote: string;
  actions: ActionVariant;
  /** The guest's phone for «Sună», or null. */
  phone: string | null;
};

/** «Lu 1 sep, 14:53» — fish `format(createdAt, 'EEEEEE d MMM, HH:mm', { locale: ro })`, capitalised. */
export function requestedAtLabel(iso: string): string {
  const d = new Date(iso);
  return capitalize(`${formatWeekdayShort(d)} ${d.getDate()} ${formatMonthAbbr(d)}, ${formatHHmm(d)}`.replace('.', ''));
}

export function actionVariant(b: BookingDTO, nowMs: number): ActionVariant {
  const { isPending, canCancel, canRate } = bookingActionGates(b, nowMs);
  if (isPending) return 'pending';
  if (canCancel) return 'cancel';
  if (canRate) return 'rate';
  return 'none';
}

/**
 * Whether «Rest de plată» means anything: the stay can still be paid for — pending, confirmed or
 * completed, the angler came, and the money is neither settled (Plătit) nor given back (Rambursat).
 * Deliberately stricter than fish (BookingDetailSheet.tsx:383 shows it whenever paid < total, so a
 * cancelled or refunded stay reads «Rest de plată 50 lei»): owner rule 4, never tell the operator
 * to collect money that is not due.
 */
export function owesRest(b: BookingDTO): boolean {
  const live = b.bookingStatus === 'pending' || b.bookingStatus === 'confirmed' || b.bookingStatus === 'completed';
  return live && !b.noShow && b.paymentStatus !== 'paidInFull' && b.paymentStatus !== 'refunded';
}

/**
 * The detail may show this booking on lake `lakeId`'s page only if it is the booking asked for and
 * it belongs to that lake. GET /feed/bookings/:id answers the angler OR any owner, so a ?rezervare=
 * link could otherwise paint another owned lake's booking — or the viewer's own angler booking —
 * with this lake's operator actions. A booking without a lake ref (older CMS) is trusted.
 */
export function isBookingOfLake(data: BookingDTO | null | undefined, bookingId: string | null, lakeId: string): data is BookingDTO {
  if (!data || !bookingId || data.documentId !== bookingId) return false;
  return !data.lake?.documentId || data.lake.documentId === lakeId;
}

export function bookingDetailModel(b: BookingDTO, nowMs: number): BookingDetailModel {
  const basis = b.basis;
  const extras = basis?.extras ?? [];
  const payment = PAYMENT[b.paymentStatus as PaymentStatus] ?? PAYMENT.none;
  const paid = b.amountPaid ?? 0;
  const paymentLines: DetailLine[] = [{ label: 'Stare', value: payment.label }];
  if (paid > 0) paymentLines.push({ label: 'Încasat', value: lei(paid) });
  if (owesRest(b) && paid < b.priceTotal) paymentLines.push({ label: 'Rest de plată', value: lei(b.priceTotal - paid), strong: true });

  const request: DetailLine[] = [{ label: 'Cod', value: b.code }];
  if (b.createdAt) request.push({ label: 'Cerută', value: requestedAtLabel(b.createdAt) });
  if (b.contactPhone) request.push({ label: 'Telefon', value: b.contactPhone });

  return {
    name: bookingName(b),
    anglerId: b.angler?.documentId ?? null,
    avatar: b.angler?.avatar ?? null,
    standLabel: b.stand?.name ? `Standul ${b.stand.name}` : null,
    extras: extras.map((e) => ({ key: e.key, label: e.label })),
    periodLine: `${bookingPeriod(b)} · ${bookingHours(b)}h`,
    price: lei(Math.round(b.priceTotal)),
    basis: basis
      ? {
          lines: [
            { label: basis.rowLabel || `Tur ${basis.durationHours}h`, value: lei(basis.tourPrice) },
            ...extras.map((e) => ({ label: e.quantity > 1 ? `${e.label} × ${e.quantity}` : e.label, value: lei(e.total) })),
          ],
          total: { label: 'Total', value: lei(b.priceTotal), strong: true },
        }
      : null,
    payment: paymentLines,
    request,
    note: stripAppendedCancelReason(b.notes),
    reason: b.cancelReason ? { title: b.bookingStatus === 'rejected' ? 'Motiv refuz' : 'Motiv anulare', text: b.cancelReason } : null,
    noShowNote: meaningfulNoShowNote(b.noShow, b.noShowComment),
    actions: actionVariant(b, nowMs),
    phone: b.contactPhone ? b.contactPhone : null,
  };
}

/** «★ 4,6» on the avatar — one decimal, Romanian comma; null (no pill) without a rating. */
export function ratingText(avgStars: number | null | undefined): string | null {
  return avgStars == null ? null : avgStars.toFixed(1).replace('.', ',');
}

/** «1 neprezentare» / «3 neprezentări» / «20 de neprezentări»; null (no pill) at 0. */
export function noShowText(count: number | null | undefined): string | null {
  return count && count > 0 ? formatCount(count, 'neprezentare', 'neprezentări') : null;
}

/** fish `openRateAngler`: the rate screen, carrying what it shows before it has fetched anything. */
export function rateAnglerHref(b: BookingDTO): string {
  return routes.operatorRateAngler(b.documentId, {
    anglerName: bookingName(b),
    anglerId: b.angler?.documentId,
    anglerAvatar: b.angler?.avatar ?? undefined,
    standName: b.stand?.name,
    startDate: b.startDate,
    endDate: b.endDate,
  });
}
