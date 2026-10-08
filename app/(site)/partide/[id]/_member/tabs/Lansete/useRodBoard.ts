'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LocalSession, RodRuntime } from '@/core/partide';
import { liveClock } from '../../../../_live';
import { anyRunning, sameRuntime } from './countdown';

const IDLE: RodRuntime = { phase: 'idle', endEpoch: null };

/** How long an overlay outlives its settled write when no matching snapshot came: then the projection wins. */
export const OVERLAY_GRACE_MS = 8_000;

/**
 * The 1 s tick of the Lansete board (fish CronometreScene's focused interval): the
 * server-corrected `now`, re-read every second ONLY while a rod is running (counting down, or
 * past zero on minus) — an idle board never re-renders. Mounted only while the tab is shown.
 */
export function useBoardClock(runtimes: RodRuntime[]): number {
  // The tick only re-renders; every render reads the clock itself, so the first frame after a cast
  // or a snapshot is already exact.
  const [, setTick] = useState(0);
  const now = liveClock.now();
  const running = anyRunning(runtimes, now);
  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [running]);
  return now;
}

type Overlay = { runtime: RodRuntime; token: number; settled: boolean };

/**
 * The rods' runtimes as the board draws them: the projection's (read-only), with this tab's own
 * pending moves on top. fish wrote the runtime to its local atom first and fenced the snapshot off
 * the rod until the write settled (pendingRuntimeWrites); the web cannot write the projection, so
 * a tap sets an overlay for that rod which goes away as soon as
 *  - a snapshot draws the same runtime (the CMS's echo),
 *  - the write failed (fish rollbackRodRuntime — only if nothing moved the rod meanwhile), or
 *  - OVERLAY_GRACE_MS after the write settled with no matching snapshot (the projection wins: a
 *    teammate moved the rod, or the echo was lost).
 * `adopt` replaces the optimistic deadline with the one the SERVER answered (fish adoptServerRuntime).
 */
export function useRodRuntimes(session: LocalSession) {
  const [overlays, setOverlays] = useState<Record<number, Overlay>>({});
  const tokenRef = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const projected = useCallback((rodIndex: number): RodRuntime => {
    const i = session.rods.findIndex(r => r.index === rodIndex);
    return (i >= 0 ? session.rodRuntimes[i] : undefined) ?? IDLE;
  }, [session]);

  // A snapshot that draws what the overlay draws ends it (also right after `adopt`, when the echo
  // with the server's deadline was already in).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reconciling against a new snapshot
    setOverlays(prev => {
      let changed = false;
      const next: Record<number, Overlay> = {};
      for (const [k, o] of Object.entries(prev)) {
        if (sameRuntime(o.runtime, projected(Number(k)))) changed = true;
        else next[Number(k)] = o;
      }
      return changed ? next : prev;
    });
  }, [projected, overlays]);

  useEffect(() => {
    const t = timers.current;
    return () => t.forEach(clearTimeout);
  }, []);

  const runtimeOf = useCallback((rodIndex: number): RodRuntime => overlays[rodIndex]?.runtime ?? projected(rodIndex), [overlays, projected]);

  /** Start an optimistic move; returns its token. */
  const begin = useCallback((rodIndex: number, runtime: RodRuntime): number => {
    const token = ++tokenRef.current;
    const pending = timers.current.get(rodIndex);
    if (pending) clearTimeout(pending);
    setOverlays(prev => ({ ...prev, [rodIndex]: { runtime, token, settled: false } }));
    return token;
  }, []);

  const adopt = useCallback((rodIndex: number, token: number, serverEndsAt: number | null) => {
    setOverlays(prev => {
      const o = prev[rodIndex];
      if (!o || o.token !== token) return prev;
      const runtime: RodRuntime = serverEndsAt == null ? IDLE : { phase: serverEndsAt > liveClock.now() ? 'fishing' : 'firing', endEpoch: serverEndsAt };
      return { ...prev, [rodIndex]: { ...o, runtime } };
    });
  }, []);

  /** The write settled: the overlay lasts until the echo, at most OVERLAY_GRACE_MS. */
  const settle = useCallback((rodIndex: number, token: number) => {
    setOverlays(prev => (prev[rodIndex]?.token === token ? { ...prev, [rodIndex]: { ...prev[rodIndex], settled: true } } : prev));
    timers.current.set(
      rodIndex,
      setTimeout(() => {
        timers.current.delete(rodIndex);
        setOverlays(prev => {
          if (prev[rodIndex]?.token !== token) return prev;
          const next = { ...prev };
          delete next[rodIndex];
          return next;
        });
      }, OVERLAY_GRACE_MS),
    );
  }, []);

  /** The write failed for good: undo only what is still ours. */
  const rollback = useCallback((rodIndex: number, token: number) => {
    setOverlays(prev => {
      if (prev[rodIndex]?.token !== token) return prev;
      const next = { ...prev };
      delete next[rodIndex];
      return next;
    });
  }, []);

  const runtimes = useMemo(() => session.rods.map(r => runtimeOf(r.index)), [session.rods, runtimeOf]);
  return { runtimes, runtimeOf, begin, adopt, settle, rollback };
}
