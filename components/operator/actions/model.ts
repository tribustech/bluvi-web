import {
  bookingName,
  bookingPeriod,
  MIN_CANCEL_REASON_LEN,
  NO_SHOW_REASON_KEY,
  type BookingDTO,
  type CancelReasonOption,
} from '@/core/booking';

/**
 * Pure model of the operator's booking actions (fish features/operator/useOperatorBookingActions.tsx,
 * AcceptBookingSheet.tsx, features/bookings/CancelBookingSheet.tsx): the copy, the reason rule, which
 * write a picked reason performs and what the accept confirmation shows. No React here, so the rules
 * are unit-tested on their own (model.test.ts).
 */

/** Success toasts (fish useOperatorBookingActions showSuccessToast). */
export const ACTION_TOAST = {
  accepted: 'Rezervare confirmată',
  rejected: 'Rezervare respinsă',
  cancelled: 'Rezervare anulată',
  noShow: 'Neprezentare înregistrată',
} as const;

/** The reason dialogs' shared lead (fish CancelBookingSheet body). */
export const REASON_LEAD = 'Această acțiune este definitivă. Spune-ne motivul — îl trimitem celeilalte părți.';

export const REASON_REQUIRED = `Motivul este obligatoriu (minim ${MIN_CANCEL_REASON_LEN} caractere).`;
export const REASON_PICK_REQUIRED = 'Alege un motiv din listă.';

/**
 * Why the reason cannot be sent, or null when it can (fish CancelBookingSheet `valid` + its error
 * line). With a reason list the pick comes first: without it the caller cannot tell which write to
 * perform, so «Alege un motiv din listă.» wins over the length rule.
 */
export function reasonError(text: string, opts: { reasons?: readonly CancelReasonOption[]; optionKey?: string } = {}): string | null {
  if (opts.reasons && opts.optionKey == null) return REASON_PICK_REQUIRED;
  if (text.trim().length < MIN_CANCEL_REASON_LEN) return REASON_REQUIRED;
  return null;
}

/** The text a pick seeds (fish pickReason): its prefill, or empty («Alt motiv» — the operator types). */
export function prefillFor(option: CancelReasonOption): string {
  return option.prefill ?? '';
}

/** The confirm label: the picked reason's own («Da, marchează» for a no-show), else the dialog's. */
export function confirmLabelFor(reasons: readonly CancelReasonOption[] | undefined, optionKey: string | undefined, fallback: string): string {
  return reasons?.find((r) => r.key === optionKey)?.confirmLabel ?? fallback;
}

/**
 * Which write the operator's cancel dialog performs. «Pescarul nu s-a prezentat» is NOT a
 * cancellation: it POSTs /no-show (the booking stays confirmed and counts against the angler);
 * every other reason PATCHes /operator-cancel.
 */
export function cancelWrite(optionKey: string | undefined): 'noShow' | 'operatorCancel' {
  return optionKey === NO_SHOW_REASON_KEY ? 'noShow' : 'operatorCancel';
}

export type AcceptSummary = {
  anglerName: string;
  /** null: no stand on the booking — no badge, no «Stand» row. */
  standName: string | null;
  period: string;
  rows: { label: string; value: string }[];
  /** Due at the gate, in lei (fish passes priceTotal). */
  amount: number;
};

/**
 * The accept confirmation's body (fish OperatorBookingRow → AcceptBookingSheet props): stand badge,
 * angler, period, rows «Stand» and «Extra» (only when present), «Încasezi … la fața locului».
 */
export function acceptSummary(b: BookingDTO): AcceptSummary {
  const standName = b.stand?.name ?? null;
  const extras = (b.basis?.extras ?? []).map((e) => e.label);
  return {
    anglerName: bookingName(b),
    standName,
    period: bookingPeriod(b),
    rows: [
      ...(standName ? [{ label: 'Stand', value: standName }] : []),
      ...(extras.length ? [{ label: 'Extra', value: extras.join(', ') }] : []),
    ],
    amount: b.priceTotal,
  };
}
