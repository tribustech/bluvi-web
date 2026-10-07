'use client';

import { useSyncExternalStore } from 'react';

/*
 * The connectivity flag (fish NetInfoContext `isOnline`): the browser's online / offline events.
 * The server and the first client render answer «online» (the server cannot know), so hydration
 * never mismatches — the same rule as the shell's NetworkBanner.
 */
function subscribe(onChange: () => void) {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}
