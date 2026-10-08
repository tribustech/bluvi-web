'use client';

import { useCallback, useRef } from 'react';

/** fish hooks/useNavigationGuard.ts: the window in which a repeated activation is ignored. */
export const NAVIGATION_GUARD_MS = 800;

/**
 * organizer.b.navigation-guard (fish guardNavigation): a forward navigation from a management screen
 * fires once — a second activation within 800 ms (a double tap, a double click, Enter held down) is
 * ignored, so a page never opens twice. Returns `guard(event?)`: true when the activation may go on;
 * false when it is a repeat (and the event's default — the link's navigation — is prevented).
 */
export function useNavigationGuard(ms = NAVIGATION_GUARD_MS) {
  const last = useRef(-Infinity);
  return useCallback(
    (event?: { preventDefault: () => void }) => {
      const now = performance.now();
      if (now - last.current < ms) {
        event?.preventDefault();
        return false;
      }
      last.current = now;
      return true;
    },
    [ms],
  );
}
