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
 * - `guard(leave)` does the same for the screen's own exits (the back chip, a sheet's close).
 * The click listener is a capture-phase one on the document, so it runs before next/link's own
 * (delegated at the React root); a new-tab click (modifiers, middle button, target) leaves the
 * form open and is never held. A click the shell's NavigationGuard already dropped is ignored.
 */
export function useLeaveGuard(active: boolean): { guard: (leave: () => void) => void; dialog: ReactNode } {
  const router = useRouter();
  const [held, setHeld] = useState<{ leave: () => void } | null>(null);
  const activeRef = useRef(active);
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
    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('click', onClick, true);
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
