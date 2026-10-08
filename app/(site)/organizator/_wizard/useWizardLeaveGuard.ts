'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

/*
 * The wizard's leave guard (organizer.wizard.c4 beyond the header's back): fish asks «Salvezi
 * progresul înainte de a ieși?» when a dirty form is left from step 1; on the web the form can also
 * be left by the top bar's links, the browser's Back and closing / reloading the tab. Same mechanics
 * as components/account/profile-form/useLeaveGuard (capture-phase link clicks, the Navigation API's
 * cancelable traversals, `beforeunload`), with two wizard rules:
 *  - moving between the wizard's own steps (Back / Forward over the step entries the wizard pushed,
 *    or a link to another step) is never held: those URLs start with `basePath`;
 *  - a held exit is handed to `onHold(leave)`: the screen opens its own exit dialog (save label /
 *    «Ies fără să salvez») and calls `leave()` to complete the navigation.
 * Closing or reloading the tab asks the browser's own prompt (no page dialog is possible there).
 */

type NavigateEventLike = Event & {
  navigationType: 'push' | 'replace' | 'reload' | 'traverse';
  cancelable: boolean;
  destination: { url: string; key: string | null };
};
type NavigationLike = {
  addEventListener(type: 'navigate', listener: (e: NavigateEventLike) => void): void;
  removeEventListener(type: 'navigate', listener: (e: NavigateEventLike) => void): void;
  traverseTo(key: string): { committed: Promise<unknown> };
};

export function useWizardLeaveGuard({
  active,
  basePath,
  onHold,
}: {
  active: boolean;
  basePath: string;
  onHold: (leave: () => void) => void;
}) {
  const router = useRouter();
  const onHoldRef = useRef(onHold);
  const traversingRef = useRef(false);
  useEffect(() => {
    onHoldRef.current = onHold;
  }, [onHold]);

  useEffect(() => {
    if (!active) return;
    const inWizard = (url: URL) => url.origin === location.origin && url.pathname.startsWith(basePath);
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a[href]');
      if (!(a instanceof HTMLAnchorElement)) return;
      if ((a.target && a.target !== '_self') || a.hasAttribute('download')) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || inWizard(url)) return;
      e.preventDefault();
      e.stopPropagation();
      const href = `${url.pathname}${url.search}${url.hash}`;
      onHoldRef.current(() => router.push(href));
    };
    const nav = (window as unknown as { navigation?: NavigationLike }).navigation;
    const onNavigate = (e: NavigateEventLike) => {
      if (e.navigationType !== 'traverse' || !e.cancelable || traversingRef.current) return;
      const key = e.destination.key;
      if (!key) return;
      const url = new URL(e.destination.url);
      if (inWizard(url)) return;
      e.preventDefault();
      onHoldRef.current(() => {
        if (!nav) return;
        traversingRef.current = true;
        const done = () => {
          traversingRef.current = false;
        };
        nav.traverseTo(key).committed.then(done, done);
      });
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('click', onClick, true);
    nav?.addEventListener('navigate', onNavigate);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('click', onClick, true);
      nav?.removeEventListener('navigate', onNavigate);
    };
  }, [active, basePath, router]);
}
