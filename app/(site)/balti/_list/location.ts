'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { nearbyCommittedSearch, type LakesCommittedSearch, type LakesLocationState } from '@/core/lakes';
import { writeGeoHint } from './geoHint';
import type { LocationDialogMode } from './LocationDialog';

/*
 * The web side of fish's location state machine (lakes.b.location-state): never_asked / denied /
 * services_off / granted, from the Permissions API and the Geolocation API.
 * - «never_asked» = permission «prompt» (or a browser without the Permissions API);
 * - «services_off» = permission granted but the browser cannot get a position (OS location off,
 *   POSITION_UNAVAILABLE / TIMEOUT) — fish's «the phone's location is off»;
 * - re-read when the tab comes back to the foreground (visibilitychange) and when the permission
 *   changes (PermissionStatus change), as fish re-reads on AppState «active».
 *
 * One store for the session (module scope, like fish's screen-level state that survives the tab
 * switch): /balti and /balti/harta share the position, so opening the map from «Vezi toate» on the
 * nearby row does not ask again.
 */

export type UserPosition = { latitude: number; longitude: number };

export type LakesLocation = {
  state: LakesLocationState;
  position: UserPosition | null;
  /** A position request is running. */
  locating: boolean;
  /** The first read (permission query) is done: until then the state is a guess. */
  known: boolean;
};

type RequestResult = { state: LakesLocationState; position: UserPosition | null };

const SERVER: LakesLocation = { state: 'never_asked', position: null, locating: false, known: false };

let snapshot: LakesLocation = SERVER;
const listeners = new Set<() => void>();
let started = false;
let pending: Promise<RequestResult> | null = null;

function set(next: Partial<LakesLocation>) {
  const before = snapshot.state;
  snapshot = { ...snapshot, ...next };
  if (snapshot.known && snapshot.state !== before) writeGeoHint(snapshot.state === 'granted');
  // fish: the services-off sheet may open by itself again only after the state left services_off.
  if (before === 'services_off' && snapshot.state !== 'services_off') autoShown.services_off = false;
  listeners.forEach((l) => l());
}

/*
 * The location dialogs that open by themselves (lakes.home.c20) do so once per session, not once per
 * page mount — fish keeps hasShownServicesOffSheetRef / hasShownDeniedLocationSheetRef on the Bălți
 * tab screen, which stays mounted for the whole session. The web's session is this module: /balti
 * and /balti/harta share it across client navigations. The denied dialog never comes back; the
 * services-off one comes back only after the state left services_off (reset in `set`).
 */
type AutoDialog = 'services_off' | 'denied';
const autoShown: Record<AutoDialog, boolean> = { services_off: false, denied: false };

/** True the first time a dialog may open by itself this session (and marks it shown). */
export function claimAutoDialog(kind: AutoDialog): boolean {
  if (autoShown[kind]) return false;
  autoShown[kind] = true;
  return true;
}

/**
 * Calls `open` when the dialog `kind` is due and has not opened by itself this session yet: now,
 * and whenever the location state changes while the page is mounted. Returns the unsubscribe.
 */
export function watchAutoDialog(kind: AutoDialog, open: () => void): () => void {
  const check = () => {
    const due = kind === 'services_off' ? snapshot.state === 'services_off' : snapshot.known && snapshot.state === 'denied';
    if (due && claimAutoDialog(kind)) open();
  };
  check();
  listeners.add(check);
  return () => {
    listeners.delete(check);
  };
}

/** The page answers this outcome itself (a tap that asked for the position): no auto-open. */
export function markAutoDialogShown(kind: AutoDialog) {
  autoShown[kind] = true;
}

/** fish Location.Accuracy.Balanced; a fix up to 5 minutes old is fine for «bălți în apropiere». */
const POSITION_OPTIONS: PositionOptions = { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60_000 };

function geolocation(): Geolocation | null {
  return typeof navigator !== 'undefined' && 'geolocation' in navigator ? navigator.geolocation : null;
}

/**
 * How long an unanswered permission prompt may hold a request. The Geolocation `timeout` starts only
 * once permission is granted: a prompt clicked away (Firefox's doorhanger) or ignored (Safari) never
 * calls back, and the shared request would spin forever — every later entry (the search's «În jurul
 * meu», the placeholder, «Încearcă din nou», «Locația mea») would wait on it until a reload.
 */
const PROMPT_WATCHDOG_MS = 15_000;

async function permissionState(): Promise<PermissionState | null> {
  try {
    return (await navigator.permissions?.query({ name: 'geolocation' }))?.state ?? null;
  } catch {
    return null;
  }
}

/**
 * Asks the browser for the position — the permission prompt when it was never answered. Concurrent
 * calls share one request (a second tap while locating is ignored, lakes.search.c12). A request the
 * browser never answers settles after PROMPT_WATCHDOG_MS with the permission as it stands («prompt»
 * → never_asked, «denied» → denied); a late answer still updates the state (the callbacks below, and
 * the PermissionStatus change listener in start()).
 */
export function requestUserPosition(): Promise<RequestResult> {
  if (pending) return pending;
  const geo = geolocation();
  if (!geo) {
    set({ state: 'services_off', position: null, known: true });
    return Promise.resolve({ state: 'services_off', position: null });
  }
  set({ locating: true });
  const request = new Promise<RequestResult>((resolve) => {
    let settled = false;
    let status: PermissionStatus | null = null;
    const giveUp = (state: LakesLocationState) => {
      if (settled) return;
      set({ state, position: null, locating: false, known: true });
      finish({ state, position: null });
    };
    // The prompt answered «Block» somewhere the request does not hear it (the site settings): settle.
    const onPermission = () => {
      if (status?.state === 'denied') giveUp('denied');
    };
    const finish = (result: RequestResult) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(watchdog);
      status?.removeEventListener('change', onPermission);
      resolve(result);
    };
    void navigator.permissions
      ?.query({ name: 'geolocation' })
      .then((s) => {
        if (settled) return;
        status = s;
        s.addEventListener('change', onPermission);
      })
      .catch(() => {});
    const watchdog = window.setTimeout(() => {
      void permissionState().then((permission) => {
        // Granted: the position read runs on its own timeout (POSITION_OPTIONS) and settles it.
        if (permission === 'granted') return;
        giveUp(permission === 'denied' ? 'denied' : 'never_asked');
      });
    }, PROMPT_WATCHDOG_MS);
    geo.getCurrentPosition(
      (pos) => {
        const position = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        // A late answer after the watchdog still lands in the shared state.
        set({ state: 'granted', position, locating: false, known: true });
        finish({ state: 'granted', position });
      },
      (err) => {
        const state: LakesLocationState = err.code === err.PERMISSION_DENIED ? 'denied' : 'services_off';
        set({ state, position: null, locating: false, known: true });
        finish({ state, position: null });
      },
      POSITION_OPTIONS,
    );
  });
  pending = request.finally(() => {
    pending = null;
  });
  return pending;
}

/** Reads the permission; when it is granted, also the position (fish resolveLocationState). */
async function refresh(status?: PermissionStatus) {
  const permission: PermissionState | null = status?.state ?? (await permissionState());
  if (permission === 'granted') {
    // Say «granted» now (a known position is kept while re-reading): the page reserves the nearby
    // row, not the placeholder card's box, while the position is read (up to the timeout). The
    // request settles the state.
    if (snapshot.state !== 'granted' || !snapshot.known) set({ state: 'granted', known: true, locating: true });
    await requestUserPosition();
    return;
  }
  set({ state: permission === 'denied' ? 'denied' : 'never_asked', position: null, known: true });
}

function start() {
  if (started || typeof window === 'undefined') return;
  started = true;
  void refresh();
  void (async () => {
    try {
      const status = await navigator.permissions?.query({ name: 'geolocation' });
      if (status) status.addEventListener('change', () => void refresh(status));
    } catch {
      // No Permissions API for geolocation (older Safari): the request answers instead.
    }
  })();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !snapshot.locating) void refresh();
  });
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** The shared location state; the first subscriber starts the reads. */
export function useLakesLocation(): LakesLocation {
  useEffect(start, []);
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => SERVER,
  );
}

/**
 * The page's location dialog and the search's «În jurul meu» hand-off, one wiring for /balti and
 * /balti/harta (lakes.search.c11 / s8). One modal at a time: a blocked «În jurul meu» closes the
 * search before the dialog opens, and a retry from that dialog that gets a position finishes the
 * pick (`commit` the nearby search) instead of leaving the user to tap it again. `open` is for every
 * other entry (the nearby placeholder, «Locația mea», the auto-open), which a retry does not commit.
 */
export function useLocationDialog({ closeSearch, commit }: { closeSearch: () => void; commit: (search: LakesCommittedSearch) => void }) {
  const [mode, setMode] = useState<LocationDialogMode | null>(null);
  const fromSearch = useRef(false);
  const commitRef = useRef(commit);
  useEffect(() => {
    commitRef.current = commit;
  });
  const open = useCallback((next: LocationDialogMode) => {
    fromSearch.current = false;
    setMode(next);
  }, []);
  const onLocationBlocked = useCallback(
    (next: LocationDialogMode) => {
      closeSearch();
      fromSearch.current = true;
      setMode(next);
    },
    [closeSearch],
  );
  const close = useCallback(() => setMode(null), []);
  const onRetry = useCallback(() => {
    setMode(null);
    void requestUserPosition().then((r) => {
      // Still blocked: the dialog comes back (and still remembers where it came from).
      if (r.state === 'denied') return setMode('permission');
      if (r.state === 'never_asked') return; // the prompt was left unanswered
      if (!r.position) return setMode('services_off');
      if (!fromSearch.current) return;
      fromSearch.current = false;
      commitRef.current(nearbyCommittedSearch(r.position.latitude, r.position.longitude));
    });
  }, []);
  return { mode, open, close, onLocationBlocked, onRetry };
}
