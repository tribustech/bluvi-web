'use client';

import { useRouter } from 'next/navigation';

/*
 * fish BackButton / the gallery's close ✕ (router.back()): back in history when the page before
 * this one is the site's own — a client-side navigation or an earlier page of this tab — otherwise
 * (a shared link, a search result, a new tab, the way back from an OAuth round trip) `fallbackHref`.
 *
 * `document.referrer` cannot tell: a client-side navigation never updates it, and it is empty on a
 * typed URL — so lake → galerie → ✕ pushed the lake again and the browser's Back returned to the
 * gallery. The Navigation API knows: its entries are this tab's same-origin history only, so
 * `canGoBack` is true exactly when the previous entry is one of ours. Without it (older browsers)
 * the module counts the App Router's client-side navigations itself.
 * The kit copy of app/(site)/balti/[id]/_sub/useBack.ts (its TODO(kit)); the lake pages and
 * ape-publice still import their own copies — move them here when their owners next touch them.
 */

type NavigationLike = { canGoBack?: boolean };

/** Client-side navigations seen by this module (the fallback where the Navigation API is missing). */
let seenPath: string | null = null;
let inAppSteps = 0;

function noteLocation() {
  if (typeof window === 'undefined') return;
  const path = window.location.pathname + window.location.search;
  if (seenPath !== null && seenPath !== path) inAppSteps += 1;
  seenPath = path;
}

function canGoBackInApp(): boolean {
  const nav = (window as unknown as { navigation?: NavigationLike }).navigation;
  if (nav && typeof nav.canGoBack === 'boolean') return nav.canGoBack;
  return inAppSteps > 0 && window.history.length > 1;
}

export function useBack(fallbackHref: string) {
  const router = useRouter();
  noteLocation();
  return () => {
    if (canGoBackInApp()) router.back();
    else router.push(fallbackHref);
  };
}
