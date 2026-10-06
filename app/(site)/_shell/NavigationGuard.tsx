'use client';

import { useEffect } from 'react';

/** fish hooks/useNavigationGuard.ts NAV_GUARD_WINDOW_MS. */
const WINDOW_MS = 800;

/**
 * The shell's navigation double-activation guard (fish useNavigationGuard, inventory
 * global.shell.c14): a fast double click on a card, a rail card or a top-bar link while a dynamic
 * route is still streaming would push two history entries, so Back would land on the same page.
 * One capture-phase listener on the document — it runs before React's (delegated at the root) —
 * drops a second activation of the SAME in-app link within 800 ms: no default, no propagation, so
 * neither the browser nor next/link navigates again. Back / forward (popstate) resets it, as fish's
 * dismiss does. A new-tab click (modifier keys, middle button, target, download) is never guarded.
 */
export function NavigationGuard() {
  useEffect(() => {
    let last: { href: string; at: number } | null = null;

    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a[href]');
      if (!(a instanceof HTMLAnchorElement)) return;
      if ((a.target && a.target !== '_self') || a.hasAttribute('download')) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      // An in-page anchor moves the scroll only: nothing to guard.
      if (url.pathname === location.pathname && url.search === location.search && url.hash) return;
      const href = url.pathname + url.search;
      const now = performance.now();
      if (last && last.href === href && now - last.at < WINDOW_MS) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      last = { href, at: now };
    };
    const reset = () => {
      last = null;
    };

    document.addEventListener('click', onClick, true);
    window.addEventListener('popstate', reset);
    return () => {
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('popstate', reset);
    };
  }, []);
  return null;
}
