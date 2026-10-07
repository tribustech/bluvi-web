'use client';

import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { bookingQuoteQuery, lakeAvailabilityInfiniteQuery, mergePages, monthWindow } from '@/core/booking';
import { createBrowserTransport } from '@/lib/client/transport';
import type { FlowSelection } from './params';

/*
 * The flow's live reads, shared by the three steps (fish BookingFlowProvider's useLakeAvailability
 * + useBookingGridFlow's useBookingQuote).
 *
 * Both go through the same-origin proxy (/api/cms), never straight to the CMS and never into the
 * HTML: availability is LIVE (staleTime 0, the CMS never edge-caches it — parity
 * booking.b.live-availability) and the quote is a POST. No 'use cache', no server prefetch.
 */

/** One transport per mount; `direct: false` keeps the public availability GET on the proxy too. */
export function useFlowTransport() {
  return useMemo(() => createBrowserTransport({ direct: false }), []);
}

/**
 * The lake's availability, one lake-zone month per page from the current month, endless forward
 * (c6). fish re-reads it every time the grid becomes the focused screen again (index.tsx
 * useFocusEffect → invalidate, c7): on the web the step re-reads it on mount (a return from the
 * extras / review step is a mount), and react-query refetches it on window focus (staleTime 0).
 * `now` (the month the pages count from) is pinned for the mount, as fish's `useMemo(() => new
 * Date())` — but a browser tab outlives a phone screen: when the tab comes back in a later month,
 * `now` moves and every page is read again from the new month.
 */
export function useLiveAvailability(lakeId: string) {
  const t = useFlowTransport();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    // react-query's focus manager listens on window too (the event bubbles there from document).
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      const d = new Date();
      setNow(prev => (monthWindow(0, prev).from === monthWindow(0, d).from ? prev : d));
    };
    window.addEventListener('visibilitychange', onVisible);
    return () => window.removeEventListener('visibilitychange', onVisible);
  }, []);
  const query = useInfiniteQuery({
    ...lakeAvailabilityInfiniteQuery(t, lakeId, now),
    // A cached copy (an earlier visit in this tab) paints at once; every page is read again behind it.
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
  });
  // A new month: the focus refetch may have run with the old one, so read again with the new.
  const firstNow = useRef(now);
  const { refetch } = query;
  useEffect(() => {
    if (now === firstNow.current) return;
    firstNow.current = now;
    void refetch();
  }, [now, refetch]);
  const pages = query.data?.pages;
  const merged = useMemo(() => (pages?.length ? mergePages(pages) : null), [pages]);
  /** Lake-level facts that mergePages leaves out (first page, like the rest of the config). */
  const checkoutBufferMinutes = pages?.[0]?.checkoutBufferMinutes ?? null;
  return { query, merged, checkoutBufferMinutes };
}

/**
 * What the selected tour costs, according to the server (POST /feed/lakes/:id/quote, walkIn false).
 * The grid quotes the bare tour (`extras` []); the extras step re-quotes with its choice. The
 * previous answer stays as placeholder while a newer one is in flight (c29).
 */
export function useFlowQuote(lakeId: string, selection: FlowSelection | null, extras: string[] = []) {
  const t = useFlowTransport();
  return useQuery(
    bookingQuoteQuery(t, {
      lakeId,
      standId: selection?.stand,
      startISO: selection?.start,
      endISO: selection?.end,
      extras,
      walkIn: false,
    })
  );
}
