'use client';

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { blockTimeOptions, busyDaySet, lakeAvailabilityInfiniteQuery, localDayKey, mergePages } from '@/core/booking';
import { useOperatorTransport } from '../../../../_shared/useOperatorTransport';
import { pageIndexOf } from './model';

/*
 * The data of «Adaugă blocaj» (fish blocks.tsx:28-30 + BlockCalendar.tsx:29-54): the lake's
 * availability, one page per calendar month (core lakeAvailabilityInfiniteQuery — /feed/lakes/:id/
 * availability through /api/cms, live, never cached; the same key the walk-in grid reads).
 *  - c3: stands and tour start times from the FIRST page;
 *  - c5: the days any booking or block touches (core busyDaySet over every loaded page);
 *  - c6: only the first page loads on its own — a month ahead is pulled page by page until the
 *    month on screen (`monthOffset`) is covered; `monthLoading` meanwhile. A failed page stops the
 *    pulling (no retry loop) until `retryMonth`.
 */

const MINUTE = 60_000;
const subscribe = (onChange: () => void) => {
  const id = setInterval(onChange, MINUTE);
  return () => clearInterval(id);
};
const readToday = () => localDayKey(Date.now());
const serverToday = () => null;

/**
 * Today's device-local day key (operator.b.local-day), in the browser only — the server's zone is
 * not the operator's, so it renders none (null) and the calendar waits for the client. Re-read every
 * minute, so a form left open past midnight greys yesterday.
 */
export function useTodayKey(): string | null {
  return useSyncExternalStore(subscribe, readToday, serverToday);
}

/**
 * `monthOffset` counts months from `todayKey`'s month (the calendar's), which may move past
 * midnight; the pages count from the `now` pinned at mount, so the month on screen maps to its page
 * through pageIndexOf (never page 0 = the previous month after a month boundary).
 */
export function useBlockAvailability(lakeId: string, monthOffset: number, todayKey: string | null) {
  const t = useOperatorTransport();
  // fish pins `now` once per mount (the month windows never shift under a mounted form).
  const [now] = useState(() => new Date());
  const q = useInfiniteQuery(lakeAvailabilityInfiniteQuery(t, lakeId, now));
  const { fetchNextPage, hasNextPage, isFetchingNextPage, isFetchNextPageError } = q;
  const loadedMonths = q.data?.pages.length ?? 0;
  const pageIndex = todayKey ? pageIndexOf(localDayKey(now), todayKey, monthOffset) : monthOffset;

  useEffect(() => {
    if (!loadedMonths || pageIndex < loadedMonths || !hasNextPage || isFetchingNextPage || isFetchNextPageError) return;
    void fetchNextPage();
  }, [pageIndex, loadedMonths, hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage]);

  const merged = useMemo(() => (q.data?.pages.length ? mergePages(q.data.pages) : null), [q.data]);
  const busy = useMemo(
    () =>
      merged
        ? busyDaySet([
            ...merged.bookings.map((b) => ({ start: b.start, end: b.end })),
            ...merged.blocks.map((b) => ({ start: b.start, end: b.end })),
          ])
        : null,
    [merged],
  );
  const timeOptions = useMemo(() => blockTimeOptions(merged?.slotStartTimes ?? []), [merged?.slotStartTimes]);

  const covered = pageIndex < loadedMonths;
  return {
    query: q,
    stands: merged?.stands ?? [],
    timeOptions,
    /** Busy days, or null while nothing is loaded. */
    busy,
    /** The month on screen has its page. */
    covered,
    monthLoading: !covered && !isFetchNextPageError && loadedMonths > 0,
    monthFailed: !covered && isFetchNextPageError,
    retryMonth: () => void fetchNextPage(),
  };
}
