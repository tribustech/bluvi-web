'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Dialog } from '@/components/surfaces/Dialog';
import { Button } from '@/components/ui/Button';

export const LEAVE_TITLE = 'Renunți la modificări?';
const LEAVE_BODY = 'Modificările pe care nu le-ai salvat se pierd.';

/**
 * Unsaved edits are never dropped silently (account.edit-profile, web addition — fish's screen is
 * a modal the user dismisses on purpose; on the web a top-bar link sits right above the form).
 * While `active`:
 * - closing or reloading the tab asks the browser's own «Leave site?» (`beforeunload`);
 * - a click on an in-app link (top bar, menus, «Vezi profilul public»…) is held and asks
 *   «Renunți la modificări?» — «Renunță» follows the link, «Continuă editarea» stays;
 * - `guard(leave)` does the same for the screen's own exits (the back chip, a sheet's close);
 * - browser Back/Forward (or a swipe) within the site — a same-document traversal, which fires no
 *   `beforeunload` — is cancelled through the Navigation API's `navigate` event and asks the same
 *   dialog; «Renunță» then completes that traversal (`navigation.traverseTo`). Only where the
 *   browser lets the page cancel it (`event.cancelable`: Chromium 123+, and it needs a user
 *   gesture since the last cancel); elsewhere the traversal goes through unasked.
 * Not guarded: a programmatic router.push/replace that is not a link click (no hook in the App
 * Router to hold it) — the site's menus and palette navigate through links.
 * The click listener is a capture-phase one on the document, so it runs before next/link's own
 * (delegated at the React root); a new-tab click (modifiers, middle button, target) leaves the
 * form open and is never held. A click the shell's NavigationGuard already dropped is ignored.
 */
/** The slice of the Navigation API used here (not in TypeScript's DOM lib yet). */
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

export function useLeaveGuard(active: boolean): { guard: (leave: () => void) => void; dialog: ReactNode } {
  const router = useRouter();
  const [held, setHeld] = useState<{ leave: () => void } | null>(null);
  const activeRef = useRef(active);
  /** «Renunță» on a held Back: the traversal it starts must not be held again. */
  const traversingRef = useRef(false);
  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    if (!active) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Older engines show the prompt only when returnValue is set.
      e.returnValue = '';
    };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a[href]');
      if (!(a instanceof HTMLAnchorElement)) return;
      if ((a.target && a.target !== '_self') || a.hasAttribute('download')) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
      e.preventDefault();
      e.stopPropagation();
      const href = `${url.pathname}${url.search}${url.hash}`;
      setHeld({ leave: () => router.push(href) });
    };
    const nav = (window as unknown as { navigation?: NavigationLike }).navigation;
    const onNavigate = (e: NavigateEventLike) => {
      if (e.navigationType !== 'traverse' || !e.cancelable || traversingRef.current) return;
      const key = e.destination.key;
      if (!key) return;
      const url = new URL(e.destination.url);
      if (url.pathname === location.pathname && url.search === location.search) return;
      e.preventDefault();
      setHeld({
        leave: () => {
          if (!nav) return;
          traversingRef.current = true;
          const done = () => {
            traversingRef.current = false;
          };
          nav.traverseTo(key).committed.then(done, done);
        },
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
  }, [active, router]);

  const guard = useCallback((leave: () => void) => {
    if (activeRef.current) setHeld({ leave });
    else leave();
  }, []);

  const stay = () => setHeld(null);
  const dialog = (
    <Dialog
      open={held !== null}
      onClose={stay}
      alert
      title={LEAVE_TITLE}
      description={LEAVE_BODY}
      actions={
        <>
          <Button variant="secondary" onClick={stay}>
            Continuă editarea
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              const leave = held?.leave;
              setHeld(null);
              leave?.();
            }}
          >
            Renunță
          </Button>
        </>
      }
    />
  );
  return { guard, dialog };
}
