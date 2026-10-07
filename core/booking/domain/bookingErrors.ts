/**
 * The angler's booking submit, in words — fish `app/(app)/book-lake/[lakeId]/review.tsx`:
 *  - `friendlyBookingError` (review.tsx:37-69, verbatim rules);
 *  - the outcome of a refused create (review.tsx:218-257: a changed price stays on the review, a
 *    stand that went sends the angler back to the grid, anything else is a toast);
 *  - the success toast (review.tsx:210-216).
 * Pure: the screen does the toasts, the invalidations and the navigation.
 */

/** The copy fish maps by code (review.tsx:45-65). Every other code shows the server's own sentence. */
export const BOOKING_ERROR_COPY: Record<string, string> = {
  STAND_TAKEN: 'Standul tocmai a fost rezervat. Alege altul.',
  STAND_BLOCKED: 'Intervalul nu mai este disponibil (a fost blocat sau există un concurs).',
  NAME_REQUIRED: 'Adaugă numele pentru rezervare.',
  PHONE_REQUIRED: 'Adaugă un număr de telefon.',
  INVALID_DURATION: 'Durata selectată nu este validă.',
  INVALID_SLOT_ALIGNMENT: 'Intervalul ales nu începe la o oră de start validă.',
  END_TIME_NOT_ALLOWED: 'Balta nu acceptă rezervări care se încheie la ora aceasta. Alege alt interval.',
  START_IN_PAST: 'Nu poți rezerva un interval din trecut.',
  BOOKING_DISABLED: 'Rezervările nu sunt active pentru acest lac.',
  PAYMENTS_NOT_CONFIGURED: 'Plățile online nu sunt disponibile momentan.',
};

export const BOOKING_ERROR_FALLBACK = 'A apărut o eroare. Încearcă din nou.';

type ErrorLike = { bluCode?: unknown; message?: unknown; status?: unknown; details?: unknown };

const asError = (error: unknown): ErrorLike | null =>
  typeof error === 'object' && error !== null ? (error as ErrorLike) : null;

const bluCodeOf = (error: unknown): string | undefined => {
  const code = asError(error)?.bluCode;
  return typeof code === 'string' && code ? code : undefined;
};

/**
 * Maps known backend error codes to friendly RO copy (fish friendlyBookingError). Keys off `bluCode`
 * (the code the CMS attaches in `details.bluCode`) and falls back to `message`, so a bare code string
 * (a payment error) is mapped too.
 *
 * The server sends the sentence and the code side by side, and the sentence is preferred for every
 * code this screen was not taught: a rule added to the backend after this build shipped explains
 * itself. The mapped cases survive only where this screen says something the server cannot. Without
 * a code there is no server sentence (the transport replaces it with a generic one): the fallback.
 */
export function friendlyBookingError(error: unknown): string {
  const e = asError(error);
  const bluCode = bluCodeOf(error);
  const message = typeof e?.message === 'string' ? e.message : undefined;
  const serverMessage = bluCode ? message : undefined;
  const code = typeof error === 'string' ? error : (bluCode ?? message);
  return (code !== undefined ? BOOKING_ERROR_COPY[code] : undefined) ?? (serverMessage || BOOKING_ERROR_FALLBACK);
}

/**
 * What a refused create means for the review step (fish review.tsx onError):
 *  - `price-changed` — 409 / PRICE_CHANGED: stay, re-quote; `fresh` is the server's new total when it
 *    sent one (the CMS puts it in `details.priceTotal`);
 *  - `stand-gone` — STAND_TAKEN / STAND_BLOCKED: the selection is dead, back to the grid;
 *  - `other` — a toast with friendlyBookingError.
 */
export type BookingSubmitFailure =
  | { kind: 'price-changed'; fresh: number | null; message: string }
  | { kind: 'stand-gone'; code: 'STAND_TAKEN' | 'STAND_BLOCKED'; message: string }
  | { kind: 'other'; message: string };

export function bookingSubmitFailure(error: unknown): BookingSubmitFailure {
  const e = asError(error);
  const bluCode = bluCodeOf(error);
  if (e?.status === 409 || bluCode === 'PRICE_CHANGED') {
    const details = asError(e?.details) as { priceTotal?: unknown } | null;
    const fresh = typeof details?.priceTotal === 'number' && Number.isFinite(details.priceTotal) ? details.priceTotal : null;
    return { kind: 'price-changed', fresh, message: priceChangedMessage(fresh) };
  }
  if (bluCode === 'STAND_TAKEN' || bluCode === 'STAND_BLOCKED') {
    return {
      kind: 'stand-gone',
      code: bluCode,
      message:
        bluCode === 'STAND_TAKEN'
          ? 'Standul tocmai a fost rezervat. Am actualizat intervalele — alege altul.'
          : 'Intervalul nu mai este disponibil. Am actualizat intervalele — alege altul.',
    };
  }
  return { kind: 'other', message: friendlyBookingError(error) };
}

/** fish review.tsx:227-230 — the fresh figure when the server named it. */
export function priceChangedMessage(fresh: number | null): string {
  return fresh !== null
    ? `Prețul s-a actualizat la ${fresh} lei. Verifică și confirmă din nou.`
    : 'Prețul s-a actualizat. Verifică noul total și confirmă din nou.';
}

/** fish review.tsx:211-216 — « Cod: {code}.» only when the server returned a code. */
export function bookingSuccessMessage(isRequest: boolean, code: string | null | undefined): string {
  const c = code ? ` Cod: ${code}.` : '';
  return isRequest ? `Cererea a fost trimisă!${c} Vei fi notificat când este confirmată.` : `Rezervare confirmată!${c}`;
}

/**
 * A request, not a reservation (fish review.tsx:151 / BookingReview.tsx:51): the lake confirms by
 * hand, or takes the money on site (the CMS couples confirmation to the payment mode).
 */
export function isBookingRequest(lake: { confirmationMode?: string | null; paymentMode?: string | null }): boolean {
  return lake.confirmationMode === 'manual' || lake.paymentMode === 'offline';
}
