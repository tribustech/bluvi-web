'use client';

import { useEffect } from 'react';
import { useParams, usePathname } from 'next/navigation';
import { trackPageView } from '@/lib/analytics';
import { resolveRoute, screenInstanceKey, screenViewParams, type RouteParams } from './screenNames';

/**
 * Module scope, so a remount of the tracker (a layout boundary re-rendering) never logs the same
 * screen twice. Keyed on the fish screen instance (screenInstanceKey): one lake to another re-logs
 * (new pathname), a re-render of the same route does not, and the tabs of one competition (or the
 * status tabs of the list) are one screen, as in fish.
 */
let lastLoggedRouteKey: string | null = null;

/** Tests only. */
export function resetLastLoggedRouteKey(): void {
  lastLoggedRouteKey = null;
}

/** Logs the active route once (exported for unit tests). `fallbackParams` only for pages outside the table. */
export function logScreenView(pathname: string, fallbackParams: RouteParams = {}): void {
  const { pattern, params } = resolveRoute(pathname, fallbackParams);
  const key = screenInstanceKey(pathname, pattern, params);
  if (lastLoggedRouteKey === key) return;
  lastLoggedRouteKey = key;
  trackPageView(screenViewParams(pattern, params));
}

/**
 * The site's only page_view emitter (fish ScreenViewTracker 1:1), mounted once from app/layout.tsx
 * inside a <Suspense>. The route comes from usePathname() — always the URL on screen, also after a
 * history.pushState / replaceState (a tab, a filter, a wizard step), which leaves Next's layout
 * segments and params on the previous route. It always reports to lib/analytics; GA4 sees it only
 * with consent.
 */
export function ScreenViewTracker(): null {
  const pathname = usePathname();
  const params = useParams() as RouteParams | null;

  useEffect(() => {
    if (!pathname) return;
    logScreenView(pathname, params ?? {});
  }, [pathname, params]);

  return null;
}
