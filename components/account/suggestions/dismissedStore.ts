'use client';

import { useSyncExternalStore } from 'react';
import { dismissSuggestion } from '@/core/social';

/*
 * fish features/anglers/state/dismissedSuggestionsAtom.ts (parity account.b.suggestion-dismissals):
 * the suggestions the person X-ed out, a plain in-memory set — a dismissal lasts the app session and
 * the angler may resurface next launch. Here: until the tab reloads (never persisted). Module-level,
 * so the Home rail (app/(site)/_home/SuggestedAnglers.tsx, both of its compositions) and
 * /pescari/sugerati read and write the same set across client navigations.
 */

let dismissed: ReadonlySet<string> = new Set();
const listeners = new Set<() => void>();
const EMPTY: ReadonlySet<string> = new Set();

export const dismissedStore = {
  subscribe: (l: () => void) => (listeners.add(l), () => void listeners.delete(l)),
  get: () => dismissed,
  /** The server never knows the browser's dismissals: render everything, hide after hydration. */
  getServer: () => EMPTY,
  dismiss: (documentId: string) => {
    dismissed = dismissSuggestion(dismissed, documentId);
    listeners.forEach((l) => l());
  },
};

/** The dismissed documentIds, re-rendering on every dismissal. */
export function useDismissedSuggestions(): ReadonlySet<string> {
  return useSyncExternalStore(dismissedStore.subscribe, dismissedStore.get, dismissedStore.getServer);
}
