'use client';

import { useSyncExternalStore } from 'react';
import type { Transport } from '@/core/transport';
import { partideServerClock } from '../_hub/activePartida';

/*
 * The server-corrected clock for every Partide surface (fish serverClock, parity
 * partide.b.server-clock). ONE clock per tab: the hub's instance (_hub/activePartida.ts), which its
 * probe already feeds — this module adds the live layer's sampling and the React reading of it.
 *
 * Sampled ONLY from a live CMS response's `Date` (+ `Age`) header — never from the Firestore
 * projection's `serverNow`, which is stamped when the CMS built the document and re-delivered on
 * every resubscribe (core serverClock header). Until a sample exists, `hasSample()` is false and a
 * countdown drawn from it is provisional («sincronizare…»), never a false «expirat».
 */

export const liveClock = partideServerClock;

/** A transport that feeds the clock from each response's Date / Age headers. */
export function samplingTransport(t: Transport): Transport {
  return {
    async request<T>(req: Parameters<Transport['request']>[0]) {
      const res = await t.request<T>(req);
      liveClock.noteHttpDate(res.headers);
      return res;
    },
  };
}

/* The clock ticks once a second while someone reads it. */
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;
let tick = 0;
function subscribe(listener: () => void) {
  listeners.add(listener);
  timer ??= setInterval(() => {
    tick += 1;
    for (const l of listeners) l();
  }, 1000);
  return () => {
    listeners.delete(listener);
    if (!listeners.size && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

/**
 * The server-corrected `now`, re-read every second; null on the server and during hydration (the
 * caller shows a neutral placeholder, never a guess baked into the static HTML).
 */
export function useServerNow(): number | null {
  const t = useSyncExternalStore(
    subscribe,
    () => tick,
    () => -1,
  );
  return t < 0 ? null : liveClock.now();
}

/** Whether the clock has a live sample yet. */
export function useClockSampled(): boolean {
  const t = useSyncExternalStore(
    subscribe,
    () => tick,
    () => -1,
  );
  return t >= 0 && liveClock.hasSample();
}
