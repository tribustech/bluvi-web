'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { routes } from '@/lib/routes';

/**
 * Where «Înapoi» and a successful save go without usable history (fish router.dismiss() back to
 * Settings, its entry point — account.edit-profile.c17). Setări (/setari) is not on the web yet, so
 * until account.settings ships the exit is the viewer's own public profile (/pescari/<id>, live
 * since ON_WEB.angler), or Acasă while the viewer is not known (the skeleton's back control).
 * TODO(account.settings): return routes.settings() here in the commit that adds /setari.
 */
export function editProfileExit(viewerId?: string): string {
  return viewerId ? routes.angler(viewerId) : routes.home();
}

type Exit = { kind: 'pop' } | { kind: 'replace'; href: string };

type NavEntry = { url: string | null; index: number; sameDocument: boolean };
type NavigationLike = { canGoBack?: boolean; currentEntry?: NavEntry | null; entries?: () => NavEntry[] };

const SIGN_IN_PATH = routes.signIn();

/**
 * The Navigation API knows the previous entry:
 * - none, or not ours (another site: `canGoBack` only counts same-origin entries) → the fallback;
 * - sign-in → the fallback;
 * - an entry of THIS page load (a client navigation opened the screen) → pop it (router.back());
 * - an entry of an EARLIER page load (the screen was opened by a full load) → popping it would
 *   reload the document and lose the success toast and the refresh, so the screen is replaced by
 *   that URL instead (a client navigation).
 * Without the API (older Safari / Firefox) a same-origin referrer stands in, and back() is used.
 */
function exitTarget(fallback: string): Exit {
  const settings: Exit = { kind: 'replace', href: fallback };
  const nav = (window as Window & { navigation?: NavigationLike }).navigation;
  if (nav && typeof nav.canGoBack === 'boolean') {
    if (!nav.canGoBack) return settings;
    const index = nav.currentEntry?.index ?? -1;
    const prev = index > 0 ? nav.entries?.()[index - 1] : undefined;
    if (!prev?.url) return { kind: 'pop' };
    let url: URL;
    try {
      url = new URL(prev.url);
    } catch {
      return settings;
    }
    if (url.origin !== window.location.origin || url.pathname === SIGN_IN_PATH) return settings;
    return prev.sameDocument ? { kind: 'pop' } : { kind: 'replace', href: `${url.pathname}${url.search}${url.hash}` };
  }
  try {
    const ref = document.referrer ? new URL(document.referrer) : null;
    return ref && ref.origin === window.location.origin && ref.pathname !== SIGN_IN_PATH ? { kind: 'pop' } : settings;
  } catch {
    return settings;
  }
}

/**
 * `refresh`: after a save, re-render the server parts of the page we land on — the (site) layout's
 * Viewer (top-bar avatar and name) is read on the server. It must run on the DESTINATION: the
 * router's actions run in order, so after replace() a refresh() is queued behind it; back() only
 * restores the cached page on popstate, so the refresh is queued from the popstate listener (Next's
 * own listener, registered first, has queued the restore by then).
 */
export function useExitEditProfile(fallback: string) {
  const router = useRouter();
  return useCallback(
    ({ refresh = false }: { refresh?: boolean } = {}) => {
      const target = exitTarget(fallback);
      if (target.kind === 'pop') {
        if (refresh) window.addEventListener('popstate', () => router.refresh(), { once: true });
        router.back();
      } else {
        router.replace(target.href);
        if (refresh) router.refresh();
      }
    },
    [router, fallback],
  );
}
