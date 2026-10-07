'use client';

import { useSyncExternalStore } from 'react';

/*
 * A clock that only exists in the browser: null on the server and while hydrating (so the static
 * HTML never bakes a «de 2h» that is wrong a minute later, and hydration never mismatches), then
 * the time, ticking every 30 s — the live partidă's elapsed time in the meta line and the
 * «în desfășurare» tile (fish elapsedRoCompact(Date.now(), …), re-rendered by the 60 s poll).
 */

const TICK_MS = 30_000;

const subscribe = (cb: () => void) => {
  const id = window.setInterval(cb, TICK_MS);
  return () => window.clearInterval(id);
};

export function useNow(): number | null {
  return useSyncExternalStore(
    subscribe,
    () => Math.floor(Date.now() / TICK_MS) * TICK_MS,
    () => null,
  );
}
