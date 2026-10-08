'use client';

import {
  buildEvent,
  buildRuntimeMetaPatch,
  castRod,
  commitCatchWithPhoto,
  reduceRodCycle,
  retryWrite,
  stopRod,
  type LocalRod,
  type LocalSession,
  type RodCycleResult,
  type RodRuntime,
} from '@/core/partide';
import { rodCommandMemo } from '@/components/partide/capture';
import type { LivePartide } from '../../../../_live';

/*
 * The Lansete board's writes (fish features/partide/domain/hooks.ts useRodActions: cast, forceStop,
 * resolve, logOutcome → applyRodResult / writeRodRuntime). Every one is an HTTP call to the CMS
 * through the /api/cms proxy — POST /feed/sessions/:id/rods/:n/cast|stop (a compare-and-swap on the
 * deadline this client believed was current, falling back to PATCH …/rods where the server or the
 * role does not offer the commands) and POST /feed/sessions/:id/events for an outcome. The CMS
 * rebuilds the Firestore projection the tab reads; nothing here writes to Firestore.
 *
 * Web differences, each for a reason:
 *  - no alarm is scheduled or cancelled (ROADMAP §3: background alarms are mobile-only), so the
 *    rod-cycle's scheduleAlarm / cancelAlarm effects are dropped;
 *  - fish's runtimes were device-local first (an optimistic atom write fenced against the echo);
 *    here the projection is read-only, so the tab keeps a short-lived overlay instead
 *    (./useRodRuntimes) and adopts the deadline the SERVER answers (fish adoptServerRuntime).
 */

export type RodWriteContext = {
  live: Pick<LivePartide, 'transport' | 'repo'>;
  /** The session's Strapi documentId (the route's [id]). */
  documentId: string;
  /** The session as the board draws it (the overlay applied): what this tap believed was current. */
  session: LocalSession;
};

/** The CMS's confirmed deadline: a number (running), null (stopped), undefined (legacy PATCH, no answer). */
export type ServerRuntime = number | null | undefined;

const report = (error: unknown) => console.error('[partida lansete]', error);

/**
 * fish hooks.ts#writeRodRuntime — ONE rod's runtime move. `expectEndsAt` is minted ONCE per tap
 * (outside the retry) so every attempt carries the same token and at most one can apply.
 */
function writeRodRuntime(ctx: RodWriteContext, rodIndex: number, next: RodRuntime, previous: RodRuntime): Promise<ServerRuntime> {
  const expectEndsAt = previous.endEpoch != null ? new Date(previous.endEpoch).toISOString() : null;
  const legacyPatch = buildRuntimeMetaPatch(ctx.session, rodIndex, next);
  return retryWrite(async () => {
    const result =
      next.phase === 'fishing'
        ? await castRod(ctx.live.transport, rodCommandMemo, ctx.documentId, rodIndex, { expectEndsAt })
        : await stopRod(ctx.live.transport, rodCommandMemo, ctx.documentId, rodIndex, { expectEndsAt });
    if (result) {
      // The server owns the clock: its deadline supersedes the optimistic one. On a CAS miss the
      // reply still carries the rod that won — adopt it either way.
      const iso = (result.rod?.runtimeEndsAt as string | null | undefined) ?? null;
      const parsed = iso ? Date.parse(iso) : null;
      return parsed != null && Number.isNaN(parsed) ? null : parsed;
    }
    if (legacyPatch) await (await ctx.live.repo()).updateMeta(ctx.session.clientId, legacyPatch);
    return undefined;
  });
}

/** The runtime write a cycle result needs, or null when nothing changes ('firing' is derived). */
export function runtimeWrite(ctx: RodWriteContext, rod: LocalRod, res: RodCycleResult, previous: RodRuntime): Promise<ServerRuntime> | null {
  if (res.runtime.phase === 'firing') return null;
  if (res.runtime.phase === previous.phase && res.runtime.endEpoch === previous.endEpoch) return null;
  return writeRodRuntime(ctx, rod.index, res.runtime, previous);
}

/** fish useRodActions().cast — the start pill (idle / ready / expired → fishing). */
export function reduceCast(rod: LocalRod, runtime: RodRuntime, now: number): RodCycleResult {
  return reduceRodCycle(rod, runtime, { type: 'cast' }, now);
}

/** fish useRodActions().forceStop — «Da, oprește»: park at idle, record nothing. */
export function reduceForceStop(rod: LocalRod, runtime: RodRuntime, now: number): RodCycleResult {
  return reduceRodCycle(rod, runtime, { type: 'forceStop' }, now);
}

/** fish useRodActions().resolve(rod, 'lost' | 'blank') — closes a running / expired rod's cycle. */
export function reduceResolve(rod: LocalRod, runtime: RodRuntime, outcome: 'lost' | 'blank', now: number): RodCycleResult {
  return reduceRodCycle(rod, runtime, { type: 'resolve', outcome }, now);
}

/**
 * The journal events a cycle result emits (resolve), or — `logOnly` — fish logOutcome's event on
 * an idle rod (the runtime untouched). Fire and forget like fish: a rejection is reported, never
 * thrown into the click handler.
 */
export function commitOutcomeEvents(ctx: RodWriteContext, rod: LocalRod, emits: { outcome: 'capture' | 'lost' | 'blank'; occurredAt: number }[]): Promise<void> {
  const writes = emits.map(eff => {
    const event = buildEvent(ctx.session, rod, { type: 'emitEvent', ...eff }, undefined, crypto.randomUUID(), Date.now());
    return commitCatchWithPhoto(ctx.live.transport, ctx.documentId, event, { isNew: true, onBackgroundError: report });
  });
  return Promise.all(writes).then(() => undefined);
}

export { report as reportRodWriteError };
