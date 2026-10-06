'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { DENSITY_COOKIE, parseDensity, type Density } from './densityValue';

export type { Density } from './densityValue';

/*
 * fish features/competitions/hooks/useCompetitionCardDensity.ts — «Listă» (compact) / «Afiș»
 * (expanded), ONE value for the whole tab, persisted across visits under fish's storage key. On the
 * web it is per browser (localStorage), mirrored into a cookie so the server renders the list (and
 * its skeleton) in the density the visitor chose — no re-layout after hydration. Compact for anyone
 * who never chose (parity competitions-list.index.c13).
 */

/** fish ASYNC_STORAGE_KEYS.COMPETITION_CARD_DENSITY_V1. */
export const DENSITY_STORAGE_KEY = 'COMPETITION_CARD_DENSITY_V1';

const listeners = new Set<() => void>();

/** Only when storage is unavailable (private mode, blocked site data): the choice for this page's life. */
let memory: Density | null = null;

function cookieDensity(): Density | null {
  try {
    const hit = document.cookie.split('; ').find((c) => c.startsWith(`${DENSITY_COOKIE}=`));
    return parseDensity(hit?.slice(DENSITY_COOKIE.length + 1));
  } catch {
    return null;
  }
}

function writeCookie(value: Density) {
  try {
    document.cookie = `${DENSITY_COOKIE}=${value}; path=/; max-age=31536000; samesite=lax`;
  } catch {
    // Cookies blocked: the server keeps rendering compact; the browser still switches.
  }
}

/** The current choice: this visit's fallback, else storage, else the cookie, else compact. */
function read(): Density {
  if (memory) return memory;
  try {
    const stored = parseDensity(window.localStorage.getItem(DENSITY_STORAGE_KEY));
    if (stored) return stored;
  } catch {
    // Blocked storage: the cookie (or the default) below.
  }
  return cookieDensity() ?? 'compact';
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  const onStorage = (e: StorageEvent) => {
    if (e.key === DENSITY_STORAGE_KEY) onChange();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onStorage);
  };
}

/** `initial`: the server's read of the cookie — the server render and the hydration pass. */
export function useCardDensity(initial: Density = 'compact'): { density: Density; setDensity: (next: Density) => void } {
  const density = useSyncExternalStore(subscribe, read, () => initial);

  // A choice made before the cookie existed: mirror it once, so the next server render matches.
  useEffect(() => {
    const current = read();
    const cookie = cookieDensity();
    // Never a cookie for someone who never chose (no cookie and the default).
    if (cookie !== current && (cookie !== null || current === 'expanded')) writeCookie(current);
  }, []);

  const setDensity = useCallback((next: Density) => {
    // Tapping the segment you are on is a no-op, not a toggle (fish select()).
    if (next === read()) return;
    try {
      window.localStorage.setItem(DENSITY_STORAGE_KEY, next);
      memory = null;
    } catch {
      // Not persisted; this visit still switches (read() answers from memory).
      memory = next;
    }
    writeCookie(next);
    for (const l of listeners) l();
  }, []);
  return { density, setDensity };
}
