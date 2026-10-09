import * as z from 'zod';
import type { AnglerLookupResult, WalkInBookingInput } from '@/core/booking';
import { noShowLabel, ratingCountLabel, type Reputation } from '@/core/social';
import type { LakeDetail } from '@/core/lakes';
import { contactSchema, NOTES_MAX, type ReviewLake } from '@/app/(site)/balti/[id]/rezerva/confirmare/model';
import type { FlowSelection } from '@/app/(site)/balti/[id]/rezerva/_flow/params';

/*
 * The walk-in review's rules, as data — fish app/(app)/operator/[lakeId]/walk-in/review.tsx
 * (parity operator.calendar-confirmare) + AnglerAccountPicker / AnglerReputationLine. Pure: the
 * components draw it, model.test.ts pins it.
 *
 * The guest form is the angler review's own contact schema (rezerva/confirmare/model.ts
 * `contactSchema`: fish WalkInSchema is the same three rules — name required, the shared phone rule
 * of components/account/profile-form/schema.ts, notes ≤ 1000), never a third copy of the phone rule.
 */

export { NOTES_MAX };

// ── The lake's facts for the summary (c1, c4, c15) ───────────────────────────────────────────────

/**
 * A walk-in is cash at the gate whatever the lake's own mode: the CMS snapshots it with
 * `paymentMode: 'offline'` (fir-intins-cms booking controller, walkIn). Web over fish, which shows
 * the lake's «Avans de plată» / «De plată acum» next to «plătită cash la fața locului».
 */
export const WALK_IN_PAYMENT_MODE = 'offline';

/**
 * The summary's lake: name / county / checkout buffer from the public lake when it has one, else
 * the owned-lakes name the gate read (an unpublished / unlisted / pending lake — the calendar's and
 * the extras step's own fallback), no county. Always a cash booking: «Numerar», «Total · se
 * plătește la fața locului», no deposit.
 */
export function walkInFacts(lakeId: string, lake: LakeDetail | null, ownedName: string | undefined): ReviewLake {
  return {
    documentId: lakeId,
    name: lake?.name || ownedName || '',
    county: lake ? lake.county || lake.countyRef?.name || null : null,
    paymentMode: WALK_IN_PAYMENT_MODE,
    depositPercent: null,
    confirmationMode: lake?.confirmationMode ?? null,
    checkoutBufferMinutes: lake?.checkoutBufferMinutes ?? null,
    regulationUrl: lake?.regulationUrl ?? null,
    cancellationPolicy: lake?.cancellationPolicy ?? null,
  };
}

/** Who the booking is for (c5): an app account picked by username, or a walk-up without one. */
export type AnglerMode = 'account' | 'guest';
export const DEFAULT_MODE: AnglerMode = 'account';

export const MODE_OPTIONS: { value: AnglerMode; label: string }[] = [
  { value: 'account', label: 'Cont Bluvi' },
  { value: 'guest', label: 'Fără cont' },
];

// ── Guest form (c9, c14) ─────────────────────────────────────────────────────────────────────────

export const guestSchema = contactSchema;
export type GuestValues = z.input<typeof guestSchema>;
export type GuestField = keyof GuestValues;

/** Form order: the error summary and the focus after a refused submit follow it. */
export const GUEST_FIELDS = [
  { name: 'contactFullname', id: 'la-poarta-nume', label: 'Nume și prenume' },
  { name: 'contactPhone', id: 'la-poarta-telefon', label: 'Număr telefon' },
  { name: 'notes', id: 'la-poarta-detalii', label: 'Detalii adiționale' },
] as const satisfies readonly { name: GuestField; id: string; label: string }[];

/** In account mode only the notes are asked (fish sends `watch('notes')`): the same 1000 cap. */
export const notesSchema = z.object({ notes: guestSchema.shape.notes });
export const NOTES_FIELD = [GUEST_FIELDS[2]];

export const EMPTY_GUEST: GuestValues = { contactFullname: '', contactPhone: '', notes: '' };

// ── Account picker (c6) ──────────────────────────────────────────────────────────────────────────

export const SEARCH_DEBOUNCE_MS = 300;
/** A short capped column inside the form, not its own scroller: more hits need a narrower query. */
export const MAX_RESULTS = 8;
export const MIN_QUERY = 2;

export const PICKER_HINT = 'Scrie cel puțin 2 litere din numele de utilizator.';
export const PICKER_EMPTY = 'Niciun cont găsit. Treci pe „Fără cont” dacă pescarul nu are aplicația.';

export type PickerState = 'hint' | 'searching' | 'empty' | 'results';

/** What the picker shows under its field (fish AnglerAccountPicker:90-140). */
export function pickerState(query: string, isFetching: boolean, count: number): PickerState {
  if (query.trim().length < MIN_QUERY) return 'hint';
  if (count > 0) return 'results';
  return isFetching ? 'searching' : 'empty';
}

// ── Reputation line (c7) ─────────────────────────────────────────────────────────────────────────

/**
 * fish AnglerReputationLine: «★ 4,5 · 3 evaluări» or «Fără evaluări încă» (spelled out: an empty
 * row next to a name reads as a bad score), and the no-shows when there are any. The decimal comma
 * and «de» from 20 as everywhere on the web (ReputationBlock, formatCount).
 */
export function reputationLine(rep: Pick<Reputation, 'avgStars' | 'ratingCount' | 'noShowCount'>): {
  stars: string | null;
  count: string | null;
  noShows: string | null;
} {
  const rated = rep.avgStars != null;
  return {
    stars: rated ? rep.avgStars!.toFixed(1).replace('.', ',') : null,
    count: rated ? ratingCountLabel(rep.ratingCount) : null,
    noShows: rep.noShowCount > 0 ? `${rep.noShowCount} ${noShowLabel(rep.noShowCount)}` : null,
  };
}

// ── Phone match (c10–c13) ────────────────────────────────────────────────────────────────────────

export type MatchedUser = NonNullable<AnglerLookupResult['user']>;

/**
 * The account the CURRENT number belongs to: the lookup answers for the number it was armed with
 * (on blur / submit), so a number typed since then has no match yet — a changed number drops the
 * link (c12) and the prompt is re-armed by the next blur.
 */
export function currentMatch(phone: string, lookedUp: string | null, result: AnglerLookupResult | undefined): MatchedUser | null {
  if (!lookedUp || lookedUp !== phone || !result?.matched || !result.user) return null;
  return result.user;
}

/** A match the operator has not answered for this number: a submit opens the dialog instead (c13). */
export const undecided = (match: MatchedUser | null, phone: string, decidedPhone: string | null) => !!match && phone !== decidedPhone;

// ── The submit (c8, c13, c17) ────────────────────────────────────────────────────────────────────

type Base = Pick<WalkInBookingInput, 'lake' | 'stand' | 'startDate' | 'endDate' | 'extras'>;

export function baseInput(lakeId: string, sel: FlowSelection, extras: string[]): Base {
  return { lake: lakeId, stand: sel.stand, startDate: sel.start, endDate: sel.end, extras };
}

/** Account mode: the account and the notes only — the server snapshots the account's name and phone. */
export function accountInput(base: Base, anglerId: string, notes: string): WalkInBookingInput {
  return { ...base, angler: anglerId, notes: notes.trim() };
}

/** Guest mode: the typed contact (trimmed by the schema), the matched account only when linked. */
export function guestInput(base: Base, contact: z.output<typeof guestSchema>, linkedAnglerId: string | null): WalkInBookingInput {
  return {
    ...base,
    contactFullname: contact.contactFullname,
    contactPhone: contact.contactPhone,
    notes: contact.notes,
    ...(linkedAnglerId ? { angler: linkedAnglerId } : {}),
  };
}

export const NO_ACCOUNT_PICKED = 'Alege un cont sau treci pe „Fără cont”.';

/** fish review.tsx:190-191 — « Cod: {code}.» only when the server returned one. */
export function walkInSuccessMessage(code: string | null | undefined): string {
  return `Rezervare adăugată!${code ? ` Cod: ${code}.` : ''}`;
}

// ── Refusals (c18) ───────────────────────────────────────────────────────────────────────────────

/** fish friendlyWalkInError (review.tsx:29-56), keyed off the CMS `details.bluCode`. */
export const WALK_IN_ERROR_COPY: Record<string, string> = {
  STAND_TAKEN: 'Standul tocmai a fost rezervat. Alege altul.',
  NAME_REQUIRED: 'Adaugă numele pescarului.',
  PHONE_REQUIRED: 'Adaugă un număr de telefon.',
  PHONE_MISMATCH: 'Numărul nu corespunde contului selectat. Reîncearcă.',
  ANGLER_NOT_FOUND: 'Contul selectat nu mai există. Alege altul.',
  WINDOW_ENDED: 'Intervalul ales s-a încheiat deja.',
  INVALID_DURATION: 'Durata selectată nu este validă.',
  INVALID_SLOT_ALIGNMENT: 'Intervalul ales nu începe la o oră de start validă.',
  BOOKING_DISABLED: 'Rezervările nu sunt active pentru acest lac.',
  FORBIDDEN: 'Nu ai dreptul să adaugi rezervări pentru acest lac.',
};
export const WALK_IN_ERROR_FALLBACK = 'A apărut o eroare. Încearcă din nou.';

type ErrorLike = { bluCode?: unknown; message?: unknown; status?: unknown };

/**
 * The toast for a refused walk-in. A known code → fish's copy; an unknown code → the server's own
 * sentence (a rule added later explains itself); the CMS owner gate answers a bare 403
 * (`ctx.forbidden()`, no code) → FORBIDDEN; anything else (no code: the transport's generic text,
 * a network failure) → the fallback.
 */
export function walkInErrorMessage(error: unknown): string {
  if (typeof error === 'string') return WALK_IN_ERROR_COPY[error] ?? (error || WALK_IN_ERROR_FALLBACK);
  const e = typeof error === 'object' && error !== null ? (error as ErrorLike) : null;
  const bluCode = typeof e?.bluCode === 'string' && e.bluCode ? e.bluCode : undefined;
  if (bluCode) {
    const message = typeof e?.message === 'string' ? e.message : '';
    return WALK_IN_ERROR_COPY[bluCode] ?? (message || WALK_IN_ERROR_FALLBACK);
  }
  if (e?.status === 403) return WALK_IN_ERROR_COPY.FORBIDDEN;
  return WALK_IN_ERROR_FALLBACK;
}

// ── Copy ─────────────────────────────────────────────────────────────────────────────────────────

export const TITLE = 'Confirmă rezervarea';
export const AUTO_CONFIRM_NOTE = 'Rezervarea va fi confirmată automat și plătită cash la fața locului.';
