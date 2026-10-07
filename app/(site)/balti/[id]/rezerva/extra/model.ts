import { countNights, type AvailabilityExtra, type BookingQuote, type MergedAvailability } from '@/core/booking';
import { formatCount } from '@/core/realtime/chat/format';
import { offeredForSelection, selectionStand } from '../_flow/guards';
import { stepHref, type FlowParams, type FlowSelection } from '../_flow/params';
import { lei } from '../_grid/model';

/*
 * The extras step's pure parts (parity booking.rezerva-extra) — fish extras.tsx's guard,
 * ExtrasStep's per-card price and note, useBookingGridFlow's setExtras. Unit-tested (model.test.ts).
 */

/**
 * Where the step must go before it can render, or null when it may (c1, c2). fish extras.tsx:
 * no selection, no selected stand or no availability → the grid. The web keeps a still-valid
 * selection on that way back when only the extras are missing (a reload after the lake removed its
 * cabin, a hand-edited link), so the angler lands on the same pill and «Continuă» goes straight to
 * the review (nextStepFromGrid). A stand the lake no longer has, or a lake that stopped taking
 * bookings, is not a valid selection: the bare grid. `merged` null = the availability is still
 * loading: only the URL can be judged yet.
 */
export function extrasRedirect(lakeId: string, params: FlowParams, merged: MergedAvailability | null): string | null {
  const sel = params.selection;
  if (!sel) return stepHref(lakeId, 'grid', { selection: null, extras: [] });
  if (!merged) return null;
  if (!merged.bookingEnabled || !selectionStand(merged, sel)) return stepHref(lakeId, 'grid', { selection: null, extras: [] });
  if (offeredForSelection(merged, sel).length === 0) return stepHref(lakeId, 'grid', { selection: sel, extras: [] });
  return null;
}

/** Nights of the tour in the lake's zone (lake-local midnights crossed, fish nights.ts — c5). */
export function tourNights(merged: MergedAvailability, sel: FlowSelection): number {
  return countNights(sel.start, sel.end, merged.timezone);
}

/**
 * One card's figures (fish ExtrasStep, c5): a per-night extra costs price × nights and says how
 * («150 lei/noapte · 2 nopți», the owner's plural rule: «20 de nopți»); a per-stay extra its flat
 * price, no note. Display only — the total is the server's.
 */
export function extraLine(extra: AvailabilityExtra, nights: number): { price: number; note: string | null } {
  if (extra.unit === 'perNight') {
    return { price: extra.price * nights, note: `${lei(extra.price)} lei/noapte · ${formatCount(nights, 'noapte', 'nopți')}` };
  }
  return { price: extra.price, note: null };
}

/** The chosen keys after a toggle, sorted (the quote's key and the URL's order — c6). */
export function toggleExtra(chosen: string[], key: string, on: boolean): string[] {
  const next = on ? [...new Set([...chosen, key])] : chosen.filter((k) => k !== key);
  return next.sort();
}

/** The URL's extras this tour can really have (a stale or hand-edited key is dropped), sorted. */
export function keepOffered(chosen: string[], offered: AvailabilityExtra[]): string[] {
  return chosen.filter((k) => offered.some((e) => e.key === k)).sort();
}

export type QuoteView =
  | { kind: 'priced'; total: number; quote: Extract<BookingQuote, { refusal: null }>; refreshing: boolean }
  | { kind: 'quoting' }
  | { kind: 'refused'; message: string }
  | { kind: 'failed' };

/**
 * What the price slot shows (c6, c7). The answer for THIS list when the cache has it — shown at once
 * and re-read behind it (fish staleTime 0): `refreshing`, «Continuă» held. Another list's answer
 * (react-query's placeholder) is never shown as this one's price: «Calculăm prețul…».
 */
export function quoteView(q: {
  data: BookingQuote | undefined;
  isPlaceholderData: boolean;
  isFetching: boolean;
  isError: boolean;
}): QuoteView {
  if (q.data && !q.isPlaceholderData) {
    if (q.data.refusal) return q.isFetching ? { kind: 'quoting' } : { kind: 'refused', message: q.data.refusal.message };
    return { kind: 'priced', total: q.data.total, quote: q.data, refreshing: q.isFetching };
  }
  if (q.isError && !q.isFetching) return { kind: 'failed' };
  return { kind: 'quoting' };
}

/** «Continuă» is held while re-quoting and whenever there is no total (fish extras.tsx:21, c7). */
export const continueHeld = (v: QuoteView) => v.kind !== 'priced' || v.refreshing;
