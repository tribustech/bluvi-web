/**
 * fish `features/operator/cancelReasons.ts` (verbatim) + the reason-option type and the minimum
 * reason length from `features/bookings/CancelBookingSheet.tsx`.
 */

/** The cancel/reject reason is MANDATORY and at least this long (the server refuses shorter). */
export const MIN_CANCEL_REASON_LEN = 5;

/**
 * A pickable reason. `prefill` seeds the free-text box (still editable — the
 * text is what reaches the other side, so context is worth allowing); a reason
 * with no prefill leaves the box empty and the operator must type.
 */
export type CancelReasonOption = {
  key: string;
  label: string;
  prefill?: string;
  /** Overrides the confirm button while this reason is picked — not every reason
   *  in the list actually cancels anything. */
  confirmLabel?: string;
};

/**
 * The operator's single exit from a confirmed booking. "Neprezentare" is NOT a
 * cancellation — it routes to the no-show endpoint instead, which keeps the
 * booking `confirmed`, counts against the angler's reputation and never refunds.
 * Everything else is a real cancellation, where the fault is the lake's.
 *
 * Shared by the reservations inbox and the "Azi la baltă" panel, so both
 * surfaces open the very same sheet with the very same choices.
 */
export const NO_SHOW_REASON_KEY = 'noShow';
export const OPERATOR_CANCEL_REASONS: CancelReasonOption[] = [
  {
    key: NO_SHOW_REASON_KEY,
    label: 'Pescarul nu s-a prezentat',
    prefill: 'Pescarul nu s-a prezentat.',
    confirmLabel: 'Da, marchează',
  },
  {
    key: 'anglerCalled',
    label: 'Pescarul a anunțat telefonic',
    prefill: 'Pescarul a anunțat telefonic că nu mai vine.',
  },
  { key: 'weather', label: 'Condiții meteo', prefill: 'Condiții meteo nefavorabile.' },
  { key: 'closure', label: 'Lucrări sau închidere', prefill: 'Lucrări la baltă.' },
  {
    key: 'standUnavailable',
    label: 'Standul nu e disponibil',
    prefill: 'Standul nu este disponibil pe acest interval.',
  },
  { key: 'other', label: 'Alt motiv' },
];

/**
 * Operator-facing copy for an accept/reject/cancel failure.
 *
 * Switches on `bluCode`, not on the message. The server puts the SENTENCE in
 * `message` and the code in `details.bluCode`, so a switch over `message` never
 * matched: every case was dead and the operator got the angler's copy —
 * "Standul tocmai a fost rezervat. Alege altul." — which asks them to do
 * something this screen cannot do.
 */
export function friendlyActionError(error: { bluCode?: string; message?: string } | undefined): string {
  switch (error?.bluCode) {
    case 'STAND_TAKEN':
      return 'Standul are deja o rezervare confirmată pe acel interval.';
    case 'INVALID_STATUS':
      return 'Rezervarea nu mai poate fi modificată.';
    case 'REJECT_REASON_REQUIRED':
    case 'CANCEL_REASON_REQUIRED':
      return 'Motivul este obligatoriu (minim 5 caractere).';
    default:
      // The server's own sentence is the better fallback: a refusal added
      // tomorrow reads correctly on this build.
      return error?.message || 'Acțiunea nu a putut fi finalizată. Încearcă din nou.';
  }
}

/**
 * fish `helpers/friendlyCancelError.ts` (verbatim) — what to show when the ANGLER's cancellation
 * fails.
 *
 * The server now sends a Romanian sentence with every code, so the default is
 * simply to show it — a refusal added to the backend later reads correctly on an
 * app built today. Nothing is mapped here any more: the two codes this file used
 * to name (`ALREADY_CANCELLED`, `NOT_CANCELLABLE`) were never emitted by the
 * server, while the three that are — CANCEL_NOTICE_TOO_SHORT,
 * CANCELLATION_WINDOW_PASSED, INVALID_STATUS — fell through and reached the
 * angler as raw uppercase codes.
 */
export function friendlyCancelError(error: unknown): string {
  const message = typeof error === 'string' ? error : (error as { message?: string } | null | undefined)?.message;
  const bluCode = (error as { bluCode?: string } | null | undefined)?.bluCode;
  // A message that IS the code means an older backend; do not show it.
  if (message && message !== bluCode && !/^[A-Z_]+$/.test(message)) return message;
  return 'Nu am putut anula rezervarea. Încearcă din nou.';
}
