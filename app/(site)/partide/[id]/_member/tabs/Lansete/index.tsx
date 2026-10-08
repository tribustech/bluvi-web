'use client';

import { useCallback, useMemo, useState } from 'react';
import { FishingRodIcon } from '@/components/icons/brand';
import { useCaptureFlow } from '@/components/partide/capture';
import {
  anchorCoord,
  computeRodStats,
  cooldownMessage,
  COOLDOWN_MS,
  effectivePhase,
  isRunningPhase,
  lastOutcomeAgeMs,
  laneForRod,
  type LocalRod,
  type RodCycleResult,
  type RodRuntime,
} from '@/core/partide';
import { useSiteToast } from '../../../../../_shell/Toast';
import { liveClock, useLivePartide, useLiveSession, useWriteGuard } from '../../../../_live';
import type { MemberTabProps } from '../types';
import { RodCard, rodTitle } from './RodCard';
import { commitOutcomeEvents, reduceCast, reduceForceStop, reduceResolve, reportRodWriteError, runtimeWrite, type RodWriteContext } from './rodWrites';
import { StopRodDialog } from './StopRodDialog';
import { useBoardClock, useRodRuntimes } from './useRodBoard';
import type { FlashKind } from './OutcomeTakeover';

/*
 * The member view's «Lansete» tab (parity partide.partida-lansete; fish
 * features/partide/scenes/CronometreScene.tsx) — the rods first, the timers optional. Never shown
 * for an ended partidă (the frame hides the tab).
 *
 * Reads: rods, runtimes and events come from the frame (the live provider's read-only Firestore
 * projection); the countdowns read the server-corrected clock (liveClock), ticking once a second
 * only while a rod runs (./useRodBoard), and are provisional — «Se sincronizează», never a false
 * «Expirat» — while the projection is the offline cache or the clock has no server sample (c3,
 * c10, b.server-clock, invariant 18). A deadline that passes moves the card to «Expirat» on the
 * next tick; nothing is written for it ('firing' is derived) and no alarm exists on the web
 * (ROADMAP §3).
 *
 * Writes, all CMS (./rodWrites):
 *  - «Pornește» (idle / ready / expired) → POST …/rods/:n/cast; the stop control asks «Oprești
 *    cronometrul?» first («{lane} · {m} m») and then POST …/rods/:n/stop (c9);
 *  - «Scăpat» / «Fără trăsătură»: refused within 60 s of the same outcome on the same rod (fish's
 *    copy, c5); on a running / expired rod they resolve the cycle (runtime → ready + the event), on
 *    an idle one they only log the event (c7); the takeover plays (c6);
 *  - «Captură» → the capture flow for that rod (routes.partidaCapture(id, { lanseta })), behind the
 *    30 s soft-confirm (c4, c8; components/partide/capture).
 * Offline every write is refused with «Fără conexiune. Reconectare…» (c12) — cast and stop too:
 * fish kept them live offline because its runtimes were device-local, on the web they are CMS
 * writes. A partidă that is open but not followed live here (its runtimes come from a CMS read)
 * shows its rods without controls (nothing would reflect a write back), under one quiet caption saying
 * why, and its countdowns are provisional: that read is never refreshed here. A write that fails for
 * good rolls back and says «Nu am putut salva. Mai încearcă.» (no Sentry on the web until M8).
 *
 * Layout: one column on the phone; from 768 an auto-filling grid of cards at least 340 px wide
 * (two columns beside the summary at 1280 / 1440, three at 1920 — more columns, never wider cards).
 *
 * Adding / configuring rods is fish's mobile-only rod-config (c11 / c13, owner decision pending):
 * no «Adaugă lansetă» tile and no configure entry; the empty state keeps fish's title and says
 * quietly where rods are added (rule 4: no dead action).
 */

const IDLE: RodRuntime = { phase: 'idle', endEpoch: null };
const WRITE_FAILED = 'Nu am putut salva. Mai încearcă.';

export default function LanseteTab({ documentId, session, events, isLive }: MemberTabProps) {
  const live = useLivePartide();
  const { fromCache } = useLiveSession(documentId);
  const toast = useSiteToast();
  const guard = useWriteGuard();
  const capture = useCaptureFlow(documentId);
  const board = useRodRuntimes(session);
  const now = useBoardClock(board.runtimes);
  // Not followed live here: the runtimes are a one-shot CMS read nothing keeps fresh — never a
  // confident «Timp rămas» / «Expirat» on them (invariant 18, c3).
  const provisional = !isLive || fromCache || !liveClock.hasSample();
  const offline = !live.online;

  /** A write that failed for good (after retryWrite; a CAS miss adopts and is no failure). fish sent
   *  these to Sentry only; the web has none until M8, so the angler is told. */
  const onWriteFailed = useCallback(
    (error: unknown) => {
      reportRodWriteError(error);
      toast(WRITE_FAILED, 'danger');
    },
    [toast],
  );

  // Display lane is DERIVED (map rods: relative to the swim's mean cast bearing), per render.
  const anchor = useMemo(() => anchorCoord(session.anchorLat, session.anchorLng), [session.anchorLat, session.anchorLng]);
  const rods = useMemo(
    () => session.rods.map((rod, i) => ({ rod, runtime: board.runtimes[i] ?? IDLE, lane: laneForRod(session.rods, rod, anchor) })),
    [session.rods, board.runtimes, anchor],
  );

  const ctx = useCallback(
    (): RodWriteContext => ({ live, documentId, session: { ...session, rodRuntimes: board.runtimes } }),
    [live, documentId, session, board.runtimes],
  );

  /** Optimistic runtime + the CMS write: adopt the server's deadline, roll back on failure. */
  const applyRuntime = useCallback(
    (rod: LocalRod, previous: RodRuntime, res: RodCycleResult): Promise<void> => {
      const write = runtimeWrite(ctx(), rod, res, previous);
      if (!write) return Promise.resolve();
      const token = board.begin(rod.index, res.runtime);
      return write.then(
        server => {
          if (server !== undefined) board.adopt(rod.index, token, server);
          board.settle(rod.index, token);
        },
        err => {
          board.rollback(rod.index, token);
          throw err;
        },
      );
    },
    [board, ctx],
  );

  /* ── start (c9) ──────────────────────────────────────────────────── */
  const onStart = useCallback(
    (rod: LocalRod) => {
      if (!guard()) return;
      const previous = board.runtimeOf(rod.index);
      // An expired rod restarts from the same pill, logging nothing; a counting one refuses.
      if (effectivePhase(previous, liveClock.now()) === 'fishing') return;
      void applyRuntime(rod, previous, reduceCast(rod, previous, liveClock.now())).catch(onWriteFailed);
    },
    [applyRuntime, board, guard, onWriteFailed],
  );

  /* ── stop (c9) ───────────────────────────────────────────────────── */
  const [stop, setStop] = useState<{ rod: LocalRod; label: string; open: boolean } | null>(null);
  const onStopRequest = useCallback(
    (rod: LocalRod) => {
      if (!guard()) return;
      setStop({ rod, label: rodTitle(laneForRod(session.rods, rod, anchor), rod.distance), open: true });
    },
    [anchor, guard, session.rods],
  );
  const confirmStop = () => {
    if (!stop?.open) return;
    setStop({ ...stop, open: false });
    if (!guard()) return;
    const previous = board.runtimeOf(stop.rod.index);
    void applyRuntime(stop.rod, previous, reduceForceStop(stop.rod, previous, liveClock.now())).catch(onWriteFailed);
  };

  /* ── outcomes (c5, c7) ───────────────────────────────────────────── */
  const onOutcome = useCallback(
    (rod: LocalRod, outcome: FlashKind): boolean => {
      if (!guard()) return false;
      const age = lastOutcomeAgeMs(events, rod.index, outcome, Date.now());
      if (age != null && age < COOLDOWN_MS) {
        // fish also fed one spam signal to Sentry here (spamTelemetry); the web has no Sentry yet (M8).
        toast(cooldownMessage(outcome, Math.floor(Math.max(0, age) / 1000)), 'danger');
        return false;
      }
      const previous = board.runtimeOf(rod.index);
      const c = ctx();
      if (isRunningPhase(previous.phase)) {
        // Running / expired: resolve closes the cycle (→ ready) and writes the event.
        const res = reduceResolve(rod, previous, outcome, liveClock.now());
        const emits = res.effects.flatMap(e => (e.type === 'emitEvent' ? [{ outcome: e.outcome, occurredAt: e.occurredAt }] : []));
        void Promise.all([applyRuntime(rod, previous, res), commitOutcomeEvents(c, rod, emits)]).catch(onWriteFailed);
      } else {
        // Idle / ready (timer-free rods included): only the journal event.
        void commitOutcomeEvents(c, rod, [{ outcome, occurredAt: Date.now() }]).catch(onWriteFailed);
      }
      return true;
    },
    [applyRuntime, board, ctx, events, guard, onWriteFailed, toast],
  );

  const onCapture = useCallback(
    (rod: LocalRod) => {
      if (!guard()) return;
      capture.open({ kind: 'rod', rodIndex: rod.index });
    },
    [capture, guard],
  );

  if (session.rods.length === 0) return <NoRods />;

  return (
    <>
      {isLive ? null : (
        <p data-testid="lansete-not-live" className="px-4 pb-2 t-caption text-muted md:px-0 md:pb-3">
          Partida nu e urmărită în timp real aici: vezi lansetele, fără cronometre și fără butoane.
        </p>
      )}
      <section aria-label="Lansete" data-testid="lansete-board" className="grid gap-3 px-4 pt-1 pb-4 md:grid-cols-[repeat(auto-fill,minmax(340px,1fr))] md:gap-4 md:p-0">
        {rods.map(({ rod, runtime, lane }) => (
          <RodCard
            key={rod.index}
            rod={rod}
            lane={lane}
            runtime={runtime}
            now={now}
            provisional={provisional}
            stats={computeRodStats(events, rod.index)}
            actions={isLive}
            offline={offline}
            onCapture={() => onCapture(rod)}
            onOutcome={kind => onOutcome(rod, kind)}
            onStart={() => onStart(rod)}
            onStop={() => onStopRequest(rod)}
          />
        ))}
      </section>
      <StopRodDialog open={!!stop?.open} rodLabel={stop?.label ?? null} onConfirm={confirmStop} onClose={() => setStop(s => (s ? { ...s, open: false } : s))} />
      {capture.guard}
    </>
  );
}

/** No rods yet (fish CronometreScene empty state, c1) — without fish's «Adaugă lansetă» (c11/c13). */
function NoRods() {
  return (
    <section data-testid="lansete-empty" className="flex flex-col items-center gap-3.5 bg-surface px-6 py-10 text-center md:rounded-card md:shadow-e0 xl:py-14">
      <span aria-hidden className="flex size-28 items-center justify-center rounded-full bg-accent-tint text-accent">
        <FishingRodIcon size={52} />
      </span>
      <h2 className="t-title2">Nicio lansetă încă</h2>
      <p className="max-w-sm t-body text-muted">Adaugă o lansetă ca să-ți notezi momeala și capturile. Cronometrul e opțional.</p>
      <p data-testid="lansete-empty-app" className="max-w-sm t-caption text-muted">
        Lansetele se adaugă din aplicația Bluvi.
      </p>
    </section>
  );
}
