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

/** The pages served from a slug URL (proxy.ts): their route param `id` is the documentId. */
const SLUG_ROUTES = ['/balti/[id]', '/concursuri/[id]'];

/** Tests only. */
export function resetLastLoggedRouteKey(): void {
  lastLoggedRouteKey = null;
}

/** Logs the active route once (exported for unit tests). `fallbackParams` only for pages outside the table. */
export function logScreenView(pathname: string, fallbackParams: RouteParams = {}): void {
  const resolved = resolveRoute(pathname, fallbackParams);
  const { pattern } = resolved;
  let { params } = resolved;
  // Lake and competition URLs carry the slug (proxy.ts serves /balti/<slug> from
  // /balti/<documentId>, /concursuri/<slug> likewise); the page's route params carry the documentId,
  // which is what fish logs as lake_id / competition_id and in page_path — so the app's and the
  // web's reports keep one key (owner 2026-10-12, competitions 2026-10-13).
  const slugRoute = SLUG_ROUTES.some((r) => pattern === r || pattern.startsWith(`${r}/`));
  if (slugRoute && typeof fallbackParams.id === 'string') {
    params = { ...params, id: fallbackParams.id };
  }
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
