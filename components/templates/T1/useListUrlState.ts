'use client';

import { useEffect } from 'react';

/*
 * A T1 list's place — tab, scope, search, filters, density — lives in the URL, so a reload, the
 * browser's back from a detail page, a shared link and a sign-in `next` all bring the user back to
 * the same list. The screen reads its starting values from the page's searchParams (a Server
 * Component passes them down) and calls useListUrlState with its current values; this hook mirrors
 * them into the query string with history.replaceState — no navigation, no server round trip (Next
 * keeps useSearchParams in sync), no extra history entry per filter tap.
 *
 * Values equal to the default are passed as null/undefined and are removed, so a list at rest has
 * a clean URL. Params the hook was not given (another feature's, a dev `?state=`) are kept.
 *
 * `pathname`: a list whose tabs are pages of their own (/concursuri/live) mirrors the tab into the
 * path the same way (replaceState; Next keeps usePathname in sync).
 */

export type ListUrlValues = Record<string, string | null | undefined>;

export function useListUrlState(values: ListUrlValues, { pathname }: { pathname?: string } = {}) {
  // A primitive dependency: the effect runs when a value changes, not on every render.
  const serialized = JSON.stringify(Object.entries(values).sort(([a], [b]) => a.localeCompare(b)));
  useEffect(() => {
    const entries = JSON.parse(serialized) as Array<[string, string | null]>;
    const url = new URL(window.location.href);
    if (pathname) url.pathname = pathname;
    for (const [key, value] of entries) {
      if (value) url.searchParams.set(key, value);
      else url.searchParams.delete(key);
    }
    if (url.href !== window.location.href) window.history.replaceState(null, '', url);
  }, [serialized, pathname]);
}
