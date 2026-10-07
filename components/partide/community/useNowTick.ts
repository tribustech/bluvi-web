'use client';

import { useSyncExternalStore } from 'react';
import { createNowTickStore } from '@/lib/now-tick';

/** The one clock of the Partide pages (lib/now-tick.ts): one interval for every subscribed card. */
const store = createNowTickStore();
const serverSnapshot = () => null;

/** «now» for relative labels, ticking every 30s on one shared timer; null on the server and while hydrating. */
export function useNowTick(): number | null {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, serverSnapshot);
}
