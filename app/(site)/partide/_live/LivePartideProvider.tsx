'use client';

import { createContext, Suspense, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { confirmSessionAccess, getActiveSession, invalidateSessionAccessCaches, isRevoked } from '@/core/partide';
import * as partide from './partideCore';
import type { Transport } from '@/core/transport';
import { createBrowserTransport } from '@/lib/client/transport';
import { routes } from '@/lib/routes';
import { useSiteToast } from '../../_shell/Toast';
import { useViewerState } from '../../_shell/viewer-context';
import { isUnknownViewer, userOf } from '../../_shell/viewer-state';
import { liveSource } from './source';
import { liveClock, samplingTransport } from './serverClock';
import { localKeyValueStorage } from './storage';
import { useOnline } from './useOnline';

/*
 * The Partide live layer (parity partide.b.live-subscription; fish features/partide/domain/useLiveMount.ts,
 * mounted once for every /partide page by ../layout.tsx).
 *
 *  - Signed in: the active-session pointer is hydrated from this browser's storage (fast path, only
 *    when it belongs to this account), then from GET /feed/sessions/active — the probe fish runs
 *    after sign-in, here on every load because the web has no install to persist across. The probe
 *    is the truth when it answers; a failed probe keeps the stored pointer (never «no partidă» on
 *    a blip). `ready` flips once the probe settled.
 *  - While the pointer names a session, its Firestore projection is followed (./source.ts; the
 *    in-memory fake in tests) and every snapshot is reduced into the state by core applyLiveSnapshot
 *    (rods with their runtimes, catches, markers). A teammate finishing releases the PERSISTED
 *    pointer only — the in-memory snapshot stays, so the recap remains on screen.
 *  - A listener permission-denied is confirmed over private REST (core confirmSessionAccess):
 *    kicked → «Ai fost eliminat din partidă.», deleted → «Partida a fost ștearsă.», then the caches
 *    are cleaned (invalidateSessionAccessCaches), the pointer and the live state cleared and the
 *    page goes to /partide (c20); valid → re-subscribe after 1 / 2 / 4 s; unknown → wait for the
 *    browser to come back online (never a timer loop offline). A generation guard keeps a late
 *    answer of an old subscription from touching a newer one.
 *  - Sign-out (the viewer turns null): unsubscribe, clear the pointer (resetPartidePersistence)
 *    and the live state.
 * The web only READS Firestore; writes go through the CMS (./controlPlane.ts).
 */

export type LivePartide = {
  /** Undefined while the session read is pending; null signed out; else the viewer's documentId. */
  uid: string | null | undefined;
  /** The pointer resolution is over (signed in: the probe settled; signed out: at once). */
  ready: boolean;
  state: partide.LivePartideState;
  online: boolean;
  /** The CMS transport that samples the server clock. */
  transport: Transport;
  /** The write repo (core createPartideSessionRepo over the CMS), loaded on the first write. */
  repo: () => Promise<partide.PartideSessionRepo>;
  pendingRuntimeWrites: ReturnType<typeof partide.createPendingRuntimeWrites>;
  /** A create / join claimed the pointer: persist it and follow that session. */
  setActive: (pointer: partide.ActiveSession) => Promise<void>;
  /** The live partidă is over for this device (finished, left, deleted): pointer + state cleared. */
  clearLive: () => Promise<void>;
  /** For waitForProjection: the current state and a change subscription. */
  read: () => partide.LivePartideState;
  subscribeState: (onChange: () => void) => () => void;
};

const LiveContext = createContext<LivePartide | null>(null);

/** The live layer; throws outside /partide (../layout.tsx mounts it). */
export function useLivePartide(): LivePartide {
  const value = use(LiveContext);
  if (!value) throw new Error('useLivePartide must be used under app/(site)/partide/layout.tsx');
  return value;
}

/** The account the persisted pointer belongs to (a pointer of another account is ignored). */
const POINTER_OWNER_KEY = '@bluvi/partide/activeSessionOwner';

export function LivePartideProvider({ children }: { children: ReactNode }) {
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  return (
    <>
      <Suspense fallback={null}>
        <ViewerBridge onViewer={setUid} />
      </Suspense>
      <LiveMount uid={uid}>{children}</LiveMount>
    </>
  );
}

/** Reads the session (it suspends) without holding the page: the provider renders its children at once. */
function ViewerBridge({ onViewer }: { onViewer: (uid: string | null | undefined) => void }) {
  const viewer = useViewerState();
  const uid = isUnknownViewer(viewer) ? undefined : (userOf(viewer)?.documentId ?? null);
  useEffect(() => onViewer(uid), [onViewer, uid]);
  return null;
}

function LiveMount({ uid, children }: { uid: string | null | undefined; children: ReactNode }) {
  const transport = useMemo(() => samplingTransport(createBrowserTransport()), []);
  const repo = useMemo(() => {
    let loaded: Promise<partide.PartideSessionRepo> | null = null;
    return () => (loaded ??= import('./controlPlane').then(m => m.createLiveRepo(transport)));
  }, [transport]);
  const pendingRuntimeWrites = useMemo(() => partide.createPendingRuntimeWrites(), []);
  const queryClient = useQueryClient();
  const router = useRouter();
  const toast = useSiteToast();
  const online = useOnline();

  const [state, setStateRaw] = useState<partide.LivePartideState>(partide.emptyLivePartideState);
  const stateRef = useRef(state);
  const stateListeners = useRef(new Set<() => void>());
  const setState = useCallback((next: (prev: partide.LivePartideState) => partide.LivePartideState) => {
    const value = next(stateRef.current);
    if (value === stateRef.current) return;
    stateRef.current = value;
    setStateRaw(value);
    for (const l of stateListeners.current) l();
  }, []);
  /** The account whose pointer resolution is over. */
  const [readyFor, setReadyFor] = useState<string | null>(null);
  const claimedRef = useRef(false);

  const sessionId = state.active?.sessionId ?? null;
  const documentId = state.active?.documentId ?? null;

  /* ── pointer hydration ─────────────────────────────────────────────────── */
  useEffect(() => {
    if (uid === undefined) return undefined;
    if (uid === null) {
      // Signed out (or signed out under us): nothing to follow, nothing kept.
      claimedRef.current = false;
      void partide.resetPartidePersistence(localKeyValueStorage);
      void localKeyValueStorage.remove(POINTER_OWNER_KEY);
      pendingRuntimeWrites.clear();
      setState(() => partide.emptyLivePartideState());
      return undefined;
    }
    let cancelled = false;
    void (async () => {
      const owner = await localKeyValueStorage.get(POINTER_OWNER_KEY);
      const stored = owner === uid ? await partide.getActiveSession(localKeyValueStorage) : null;
      if (cancelled) return;
      if (stored && !claimedRef.current) setState(s => (s.active ? s : { ...s, active: stored }));
      try {
        const dto = await getActiveSession(transport);
        if (cancelled) return;
        const id = dto?.firestoreId ?? dto?.clientId;
        if (dto && id && dto.documentId && !claimedRef.current) {
          const pointer = { sessionId: id, documentId: dto.documentId };
          await partide.setActiveSession(localKeyValueStorage, pointer);
          await localKeyValueStorage.set(POINTER_OWNER_KEY, uid);
          setState(s => (s.active?.sessionId === pointer.sessionId && s.active.documentId === pointer.documentId ? s : { ...s, active: pointer }));
        }
      } catch {
        // A failed probe is «unknown», never «no partidă»: the stored pointer (if any) stays.
      }
      if (!cancelled) setReadyFor(uid);
    })();
    return () => {
      cancelled = true;
    };
  }, [uid, transport, setState, pendingRuntimeWrites]);

  /* ── the subscription (fish usePartideLiveMount) ───────────────────────── */
  const generationRef = useRef(0);
  const mountedRef = useRef(true);
  const recoveryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const validRecoveryAttemptsRef = useRef(0);
  const unknownAwaitingOnlineRef = useRef(false);
  const wasOnlineRef = useRef(online);
  const onlineEpochRef = useRef(0);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const setReconnecting = useCallback((reconnecting: boolean) => setState(s => (s.reconnecting === reconnecting ? s : { ...s, reconnecting })), [setState]);

  /** A sample for the countdowns: any live CMS answer carries the server's Date header. */
  const primeClock = useCallback(() => {
    if (liveClock.hasSample()) return;
    void getActiveSession(transport).catch(() => null);
  }, [transport]);

  const scheduleValidRecovery = useCallback(
    (generation: number) => {
      setReconnecting(true);
      const n = validRecoveryAttemptsRef.current;
      if (n >= partide.VALID_RECOVERY_DELAYS_MS.length) return;
      validRecoveryAttemptsRef.current += 1;
      if (recoveryTimerRef.current) clearTimeout(recoveryTimerRef.current);
      recoveryTimerRef.current = setTimeout(() => {
        recoveryTimerRef.current = null;
        if (generationRef.current !== generation) return;
        setReconnecting(false);
        setAttempt(a => a + 1);
      }, partide.VALID_RECOVERY_DELAYS_MS[n]);
    },
    [setReconnecting],
  );

  // Online transitions (fish NetInfo): an «unknown» confirmation waits for the browser to come back.
  useEffect(() => {
    const wasOnline = wasOnlineRef.current;
    wasOnlineRef.current = online;
    if (wasOnline && !online && unknownAwaitingOnlineRef.current && recoveryTimerRef.current) {
      clearTimeout(recoveryTimerRef.current);
      recoveryTimerRef.current = null;
    }
    if (!wasOnline && online) {
      onlineEpochRef.current += 1;
      primeClock();
    }
    if (wasOnline || !online || !unknownAwaitingOnlineRef.current) return;
    unknownAwaitingOnlineRef.current = false;
    validRecoveryAttemptsRef.current = 0;
    setReconnecting(false);
    setAttempt(a => a + 1);
  }, [online, primeClock, setReconnecting]);

  useEffect(() => {
    validRecoveryAttemptsRef.current = 0;
    unknownAwaitingOnlineRef.current = false;
  }, [documentId, sessionId]);

  const cleanupRevoked = useCallback(
    async (revokedDocumentId: string) => {
      await invalidateSessionAccessCaches(queryClient, revokedDocumentId, uid ?? null);
      await partide.clearActiveSession(localKeyValueStorage);
      pendingRuntimeWrites.clear();
      setState(s => partide.clearLivePartideState(s));
      if (mountedRef.current) router.replace(routes.partide());
    },
    [pendingRuntimeWrites, queryClient, router, setState, uid],
  );

  useEffect(() => {
    const generation = ++generationRef.current;
    if (!uid || !sessionId || !documentId) {
      setState(s => (Object.keys(s.sessions).length || Object.keys(s.events).length || Object.keys(s.markers).length ? { ...s, sessions: {}, events: {}, markers: {} } : s));
      return undefined;
    }
    primeClock();
    let unsubscribe: (() => void) | null = null;
    let disposed = false;
    const onError = (err: Error) => {
      if (partide.classifyLiveListenerError(err) !== 'permission-denied') {
        console.error('[partide live]', err);
        return;
      }
      const epochAtStart = onlineEpochRef.current;
      void (async () => {
        const confirmation = await confirmSessionAccess(transport, documentId);
        if (generationRef.current !== generation) return;
        if (isRevoked(confirmation)) {
          await cleanupRevoked(documentId);
          // Cleanup tears this effect down (the pointer is gone); the one notice is still owed.
          if (mountedRef.current) toast(confirmation === 'deleted' ? 'Partida a fost ștearsă.' : 'Ai fost eliminat din partidă.', 'danger');
          return;
        }
        if (confirmation === 'valid') {
          scheduleValidRecovery(generation);
          return;
        }
        // Unknown: non-destructive. Online → the same bounded backoff; offline → wait for online.
        if (onlineEpochRef.current !== epochAtStart && wasOnlineRef.current) {
          unknownAwaitingOnlineRef.current = false;
          validRecoveryAttemptsRef.current = 0;
          setReconnecting(false);
          setAttempt(a => a + 1);
          return;
        }
        unknownAwaitingOnlineRef.current = true;
        setReconnecting(true);
        if (wasOnlineRef.current) scheduleValidRecovery(generation);
      })().catch(e => console.error('[partide live]', e));
    };
    void liveSource()
      .subscribe(
        sessionId,
        uid,
        (assembled, meta) => {
          if (generationRef.current !== generation) return;
          partide.rememberSessionDocumentId(assembled.session.clientId, documentId);
          const out = partide.applyLiveSnapshot(stateRef.current, assembled, meta, key => pendingRuntimeWrites.has(key));
          setState(() => out.state);
          validRecoveryAttemptsRef.current = 0;
          unknownAwaitingOnlineRef.current = false;
          if (recoveryTimerRef.current) {
            clearTimeout(recoveryTimerRef.current);
            recoveryTimerRef.current = null;
          }
          if (out.primeClock) primeClock();
          // A TEAMMATE finished: release the PERSISTED pointer, keep the snapshot on screen.
          if (out.releasePointer) void partide.clearActiveSession(localKeyValueStorage);
        },
        onError,
        () => liveClock.now(),
      )
      .then(
        unsub => {
          if (disposed) unsub();
          else unsubscribe = unsub;
        },
        onError,
      );
    return () => {
      disposed = true;
      unsubscribe?.();
      if (generationRef.current === generation) generationRef.current += 1;
      if (recoveryTimerRef.current) {
        clearTimeout(recoveryTimerRef.current);
        recoveryTimerRef.current = null;
      }
    };
  }, [uid, sessionId, documentId, attempt, transport, toast, setState, primeClock, scheduleValidRecovery, setReconnecting, cleanupRevoked, pendingRuntimeWrites]);

  /* ── the API the pages use ─────────────────────────────────────────────── */
  const setActive = useCallback(
    async (pointer: partide.ActiveSession) => {
      claimedRef.current = true;
      await partide.setActiveSession(localKeyValueStorage, pointer);
      if (uid) await localKeyValueStorage.set(POINTER_OWNER_KEY, uid);
      setState(s => ({ ...s, active: pointer }));
    },
    [setState, uid],
  );

  const clearLive = useCallback(async () => {
    claimedRef.current = false;
    await partide.clearActiveSession(localKeyValueStorage);
    pendingRuntimeWrites.clear();
    setState(s => partide.clearLivePartideState(s));
  }, [pendingRuntimeWrites, setState]);

  const read = useCallback(() => stateRef.current, []);
  const subscribeState = useCallback((onChange: () => void) => {
    stateListeners.current.add(onChange);
    return () => {
      stateListeners.current.delete(onChange);
    };
  }, []);

  const value = useMemo<LivePartide>(
    () => ({ uid, ready: uid === null || (uid !== undefined && readyFor === uid), state, online, transport, repo, pendingRuntimeWrites, setActive, clearLive, read, subscribeState }),
    [uid, readyFor, state, online, transport, repo, pendingRuntimeWrites, setActive, clearLive, read, subscribeState],
  );
  return <LiveContext value={value}>{children}</LiveContext>;
}
