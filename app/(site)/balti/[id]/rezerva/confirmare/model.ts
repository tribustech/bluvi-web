import * as z from 'zod';
import { formatLei, rowLabelAddsMeaning, type BookingQuote, type CreateBookingInput } from '@/core/booking';
import type { CancellationPolicy } from '@/core/lakes';
import { PHONE_ERROR, PHONE_REGEX } from '@/components/account/profile-form/schema';
import type { FlowSelection } from '../_flow/params';

/*
 * The review step's rules, as data — fish app/(app)/book-lake/[lakeId]/review.tsx (the contact form)
 * + features/lakes/booking/BookingReview.tsx (the price block) + BookingConfirmSheet.tsx (the terms).
 * Pure: the components draw it, the unit tests pin it.
 */

/** The lake facts the step needs (the cached public lake, page.tsx). */
export type ReviewLake = {
  documentId: string;
  name: string;
  county: string | null;
  paymentMode: string | null;
  depositPercent: number | null;
  confirmationMode: string | null;
  checkoutBufferMinutes: number | null;
  regulationUrl: string | null;
  cancellationPolicy: Pick<CancellationPolicy, 'type' | 'refundWindowHours'> | null;
};

/** A priced quote (the union's priced half). */
export type PricedQuote = Extract<BookingQuote, { total: number }>;

// ── Contact form (fish review.tsx:71-80 + schemas/phone.schema.ts) ───────────────────────────────

export const NOTES_MAX = 1000;

export const contactSchema = z.object({
  contactFullname: z.string().trim().min(1, 'Acest câmp este obligatoriu'),
  contactPhone: z.string().trim().min(1, 'Adaugă un număr de telefon.').regex(PHONE_REGEX, PHONE_ERROR),
  notes: z.string().trim().max(NOTES_MAX, 'Ai voie maxim 1000 de caractere').optional(),
});
export type ContactValues = z.input<typeof contactSchema>;
export type ContactField = keyof ContactValues;

/** Form order — the first invalid one gets focus after a refused «Continuă» (fish CONTACT_FIELDS). */
export const CONTACT_FIELDS = [
  { name: 'contactFullname', id: 'rezervare-nume', label: 'Nume și prenume' },
  { name: 'contactPhone', id: 'rezervare-telefon', label: 'Număr telefon' },
  { name: 'notes', id: 'rezervare-detalii', label: 'Detalii adiționale' },
] as const satisfies readonly { name: ContactField; id: string; label: string }[];

export type Profile = { username?: string | null; phone?: string | null } | null | undefined;

/**
 * The profile prefill (fish review.tsx:104-131): the defaults when the profile is already there,
 * and once it arrives later a re-sync that fills only empty, untouched fields — react-hook-form's
 * `reset(prev => prev.x || profile.x, { keepDirtyValues: true })`: what the user typed (even an
 * emptied field) is never overwritten.
 */
export function prefillContact(values: ContactValues, dirty: ReadonlySet<ContactField>, profile: Profile): ContactValues {
  if (!profile) return values;
  const fill = (key: 'contactFullname' | 'contactPhone', from: string | null | undefined) =>
    dirty.has(key) ? values[key] : values[key] || from || '';
  const next = {
    contactFullname: fill('contactFullname', profile.username),
    contactPhone: fill('contactPhone', profile.phone),
    notes: values.notes,
  };
  return next.contactFullname === values.contactFullname && next.contactPhone === values.contactPhone ? values : next;
}

// ── Price block (fish BookingReview.tsx:62-85) ────────────────────────────────────────────────────

export type MoneyRow = { label: string; amount: number };

/**
 * The server's own breakdown: the tour (its row's name when that says more than the duration, else
 * «{h}h»), then one line per extra with the quantity it was charged for. Nothing is recomputed.
 */
export function priceRows(quote: PricedQuote): MoneyRow[] {
  const b = quote.basis;
  return [
    { label: rowLabelAddsMeaning(b.rowLabel, b.durationHours) ? (b.rowLabel as string) : `${b.durationHours}h`, amount: b.tourPrice },
    ...b.extras.map(e => ({ label: e.quantity > 1 ? `${e.label} × ${e.quantity}` : e.label, amount: e.total })),
  ];
}

/** fish's deposit: round2(total × p / 100). */
export const depositOf = (total: number, percent: number | null) =>
  Math.round(((total * (percent ?? 0)) / 100 + Number.EPSILON) * 100) / 100;

/** The total row by payment mode (fish BookingReview.tsx:79-85): label, an optional sub, the amount in lei. */
export function totalRow(lake: Pick<ReviewLake, 'paymentMode' | 'depositPercent'>, total: number): { label: string; sub?: string; amount: number } {
  if (lake.paymentMode === 'deposit') {
    return { label: 'Avans de plată', sub: `${lake.depositPercent ?? 0}% din ${formatLei(total)} lei`, amount: depositOf(total, lake.depositPercent) };
  }
  if (lake.paymentMode === 'full') return { label: 'De plată acum', amount: total };
  return { label: 'Total', sub: 'se plătește la fața locului', amount: total };
}

// ── Confirmation terms (fish BookingConfirmSheet.tsx:96-105) ──────────────────────────────────────

/** Money is collected up front: only then does a cancellation (refund) policy mean anything. */
export const collectsUpFront = (paymentMode: string | null) => paymentMode === 'deposit' || paymentMode === 'full';

export function paymentTermText(lake: Pick<ReviewLake, 'paymentMode' | 'depositPercent'>, total: number): string {
  const t = formatLei(total);
  if (lake.paymentMode === 'deposit') return `Avans ${lake.depositPercent ?? 0}% din ${t} lei, restul la fața locului`;
  if (lake.paymentMode === 'full') return `${t} lei, se plătesc acum`;
  return `${t} lei, se plătesc la fața locului`;
}

// ── The quote's state (fish QuoteUnavailable + review.tsx quotePriced) ────────────────────────────

export type QuoteView =
  | { kind: 'priced'; quote: PricedQuote; refreshing: boolean }
  | { kind: 'quoting' }
  | { kind: 'refused'; message: string }
  | { kind: 'failed' };

/**
 * A price on screen only from the server: priced (with `refreshing` while a newer answer is in
 * flight over it — after a price change the CTA waits for it), else why not. A refusal is the
 * lake's own sentence; a failure with no previous answer offers a retry.
 */
export function quoteView(data: BookingQuote | null | undefined, isFetching: boolean, isError: boolean): QuoteView {
  if (data && data.total !== null) return { kind: 'priced', quote: data, refreshing: isFetching };
  if (isFetching) return { kind: 'quoting' };
  if (data && data.refusal) return { kind: 'refused', message: data.refusal.message };
  if (isError) return { kind: 'failed' };
  return { kind: 'quoting' };
}

// ── The submit (fish review.tsx:159-183) ──────────────────────────────────────────────────────────

export function createInput(
  lakeId: string,
  sel: FlowSelection,
  extras: string[],
  contact: z.output<typeof contactSchema>,
  quote: PricedQuote
): CreateBookingInput {
  return {
    lake: lakeId,
    stand: sel.stand,
    startDate: sel.start,
    endDate: sel.end,
    extras,
    notes: contact.notes,
    contactFullname: contact.contactFullname,
    contactPhone: contact.contactPhone,
    expectedTotal: quote.total,
  };
}

/** The phone is written back to the profile only when it changed (fish review.tsx:168). */
export const phoneChanged = (phone: string, profile: Profile) => !!phone && phone !== (profile?.phone || '');
