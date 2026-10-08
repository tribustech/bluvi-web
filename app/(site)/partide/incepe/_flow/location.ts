'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Coord } from './model';

/*
 * The viewer's position for «Aproape de tine» (fish features/partide/helpers/useVenueSuggestions.ts
 * resolvePermission / cachedOrigin / freshOrigin), over the browser's Permissions + Geolocation APIs.
 *
 * States (parity partide.incepe c4):
 *  - `checking`     — the permission read has not answered yet (the suggestions keep their skeleton);
 *  - `never_asked`  — permission «prompt» (or no Permissions API): the permission card. Unlike fish,
 *                     which fires the OS prompt on mount, the web asks ONLY from a user gesture (the
 *                     card's button) — a prompt on page load is the browser anti-pattern;
 *  - `denied`       — blocked for the site: the card says how to unblock it;
 *  - `services_off` — no geolocation in this browser, or the device has no position source
 *                     (POSITION_UNAVAILABLE): «Activează locația dispozitivului»;
 *  - `unresolved`   — permission fine, but no fix within the time limit (TIMEOUT): the retry card;
 *  - `granted`      — `origin` is the position.
 * Granted on arrival: the browser's cached fix paints first (maximumAge ∞, timeout 0 — fish phase 1),
 * then a fresh fix (6 s, fish POSITION_TIMEOUT_MS) re-sorts. While blocked or unresolved, coming back
 * to the tab re-reads silently (fish AppState «active»).
 */

export type StartLocationState = 'checking' | 'never_asked' | 'denied' | 'services_off' | 'unresolved' | 'granted';

export type StartLocation = {
  state: StartLocationState;
  origin: Coord | null;
  /** A position request is running (the card's busy label). */
  locating: boolean;
  /** Ask for the position — from a user gesture only (the card's button, «Reîncearcă»). */
  request: () => Promise<void>;
};

const POSITION_TIMEOUT_MS = 6_000;

function geolocation(): Geolocation | null {
  return typeof navigator !== 'undefined' && 'geolocation' in navigator ? navigator.geolocation : null;
}

async function permission(): Promise<PermissionState | null> {
  try {
    return (await navigator.permissions?.query({ name: 'geolocation' }))?.state ?? null;
  } catch {
    return null;
  }
}

type Fix = { origin: Coord } | { error: 'denied' | 'services_off' | 'unresolved' };

function readPosition(options: PositionOptions): Promise<Fix> {
  const geo = geolocation();
  if (!geo) return Promise.resolve({ error: 'services_off' });
  return new Promise(resolve => {
    // A prompt left unanswered never calls back: the watchdog settles it as «never asked yet».
    const watchdog = window.setTimeout(() => resolve({ error: 'unresolved' }), (options.timeout ?? POSITION_TIMEOUT_MS) + 15_000);
    geo.getCurrentPosition(
      pos => {
        window.clearTimeout(watchdog);
        resolve({ origin: { lat: pos.coords.latitude, lng: pos.coords.longitude } });
      },
      err => {
        window.clearTimeout(watchdog);
        resolve({ error: err.code === err.PERMISSION_DENIED ? 'denied' : err.code === err.POSITION_UNAVAILABLE ? 'services_off' : 'unresolved' });
      },
      options,
    );
  });
}

export function useStartLocation(): StartLocation {
  const [state, setState] = useState<StartLocationState>('checking');
  const [origin, setOrigin] = useState<Coord | null>(null);
  const [locating, setLocating] = useState(false);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  /** Two phases: the cached fix now, then a fresh one (fish cachedOrigin → freshOrigin). */
  const locate = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setLocating(true);
    try {
      const cached = await readPosition({ maximumAge: Infinity, timeout: 0, enableHighAccuracy: false });
      if (!mounted.current) return;
      if ('origin' in cached) {
        setOrigin(cached.origin);
        setState('granted');
      } else if (cached.error === 'denied') {
        setState('denied');
        return;
      }
      const fresh = await readPosition({ maximumAge: 0, timeout: POSITION_TIMEOUT_MS, enableHighAccuracy: false });
      if (!mounted.current) return;
      if ('origin' in fresh) {
        setOrigin(fresh.origin);
        setState('granted');
      } else if (!('origin' in cached)) {
        // No position at all: a denial or an off switch is blocked; a timeout is retriable.
        setOrigin(null);
        setState(fresh.error);
      }
    } finally {
      inFlight.current = false;
      if (mounted.current) setLocating(false);
    }
  }, []);

  /** Reads the permission; granted → the position (no prompt); else the blocked state. */
  const resolve = useCallback(async () => {
    if (!geolocation()) {
      setState('services_off');
      return;
    }
    const p = await permission();
    if (!mounted.current) return;
    if (p === 'granted') await locate();
    else setState(p === 'denied' ? 'denied' : 'never_asked');
  }, [locate]);

  useEffect(() => {
    // An external system (the browser's permission store) is read once on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void resolve();
  }, [resolve]);

  // While blocked or unresolved, a return to the tab re-reads (back from the site settings, or the
  // device found itself in the meantime) — never a prompt.
  useEffect(() => {
    if (state !== 'denied' && state !== 'services_off' && state !== 'unresolved') return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') void resolve();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [state, resolve]);

  return { state, origin, locating, request: locate };
}
