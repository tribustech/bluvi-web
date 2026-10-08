'use client';

import { useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { withBookingDetail } from '@/lib/routes';

export const BOOKING_DETAIL_PARAM = 'rezervare';

/** The current URL with `rezervare` set to `bookingId`, or removed (null); query and hash kept. */
export function bookingDetailUrl(current: string, bookingId: string | null): string {
  if (bookingId) return withBookingDetail(current, bookingId);
  const u = new URL(current, 'http://x');
  u.searchParams.delete(BOOKING_DETAIL_PARAM);
  return `${u.pathname}${u.search}${u.hash}`;
}

/** The page's own fields of a history state (Next's `__NA` / `__PRIVATE…` / `_N` dropped), or null. */
export function ownHistoryState(state: unknown): Record<string, unknown> | null {
  if (!state || typeof state !== 'object') return null;
  const own = Object.entries(state as Record<string, unknown>).filter(([k]) => !k.startsWith('_'));
  return own.length ? Object.fromEntries(own) : null;
}

/**
 * The open operator booking detail lives in the URL (?rezervare=[bookingId], operator.detaliu-rezervare)
 * so it survives a reload and a shared link opens it. Opening and closing REPLACE the entry, never push:
 * Back leaves the page rather than walking through every booking looked at (fish: a sheet, no route).
 *
 * Written with the native History API, which Next's router follows (useSearchParams updates) without
 * a server round trip — router.replace would re-render the operator page on the server for a dialog.
 * Wrap the caller in <Suspense> on a prerendered route (useSearchParams).
 */
export function useBookingDetailParam() {
  const params = useSearchParams();
  const bookingId = params.get(BOOKING_DETAIL_PARAM) || null;

  const write = useCallback((id: string | null) => {
    const { pathname, search, hash } = window.location;
    const next = bookingDetailUrl(`${pathname}${search}${hash}`, id);
    // Never the current state as is: it carries Next's __NA, and Next would treat the call as its own
    // and skip syncing useSearchParams (Next copies its own fields in). The page's own marks stay
    // (the booking grid's selection mark, operator.calendar): only `_`-prefixed router fields drop.
    window.history.replaceState(ownHistoryState(window.history.state), '', next);
  }, []);

  const open = useCallback((id: string) => write(id), [write]);
  /** c13: Esc, the backdrop, the X — the id is cleared and the dialog can open on another booking at once. */
  const close = useCallback(() => write(null), [write]);

  return { bookingId, open, close };
}
