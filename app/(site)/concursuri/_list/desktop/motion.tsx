'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';

/*
 * The list's client helpers: a ticking clock (relative times render after hydration, so the server
 * and the first client paint agree) and the desktop media query.
 */

/** `Date.now()` that ticks every `everyMs`; null on the server and the hydration pass. */
export function useNow(everyMs = 30_000): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, everyMs);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [everyMs]);
  return now;
}

const subscribeTo = (query: string) => (cb: () => void) => {
  const m = window.matchMedia(query);
  m.addEventListener('change', cb);
  return () => m.removeEventListener('change', cb);
};

const LG = '(min-width: 64rem)';
const subscribeLG = subscribeTo(LG);
/**
 * ≥1024 (Tailwind `lg`): the desktop tab views are on screen. Their extra reads (rankings,
 * weighings, registrations) wait for it, so a phone never pays for a view it does not show.
 */
export function useDesktop(): boolean {
  return useSyncExternalStore(subscribeLG, () => window.matchMedia(LG).matches, () => false);
}
