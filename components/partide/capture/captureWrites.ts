'use client';

import type { QueryClient } from '@tanstack/react-query';
import {
  applyCaptureUpdate,
  buildEvent,
  buildLogCaptureEvent,
  buildRuntimeMetaPatch,
  commitCatchWithPhoto,
  createRodCommandAvailability,
  invalidateCommunityAfterCatch,
  partideKeys,
  reduceRodCycle,
  retryWrite,
  stopRod,
  castRod,
  type LocalSession,
  type LogCaptureDetail,
  type ResolveDetail,
  type RodRuntime,
  type UpdateCaptureDetail,
} from '@/core/partide';
import { anglersKeys } from '@/core/social';
import type { LivePartide } from '@/app/(site)/partide/_live';
import { liveClock } from '@/app/(site)/partide/_live';

/*
 * The capture writes of a live partidă (fish features/partide/domain/hooks.ts useLogCapture,
 * useUpdateCaptureEvent, useRodActions().resolve → applyRodResult, useSetTargetSpecies), for the
 * capture flow and — later — the Lansete and Jurnal tabs.
 *
 * Every write is an HTTP call to the CMS (/feed/sessions/:id/events, …/rods/:n/stop, PATCH …/rods,
 * PATCH /feed/sessions/:id) through the /api/cms proxy; the CMS rebuilds the Firestore projection
 * the live layer reads. Nothing here writes to Firestore. Each function returns the in-flight
 * catch write (`committed`): the screen holds its curtain on it and owns its rejection; the photo
 * upload and the tags PATCH follow in the background (core commitCatchWithPhoto).
 */

export type CaptureWriteContext = {
  live: Pick<LivePartide, 'transport' | 'read' | 'repo'>;
  queryClient: QueryClient;
  /** The session's Strapi documentId (the route's [id]). */
  documentId: string;
  /** The session's clientId (=== firestoreId). */
  sessionClientId: string;
};

/**
 * Sessions whose CMS has no rod-command routes (or whose role lacks the grant) — fish keeps this as
 * module state, one per app; here one per browser tab.
 */
export const rodCommandMemo = createRodCommandAvailability();

const newClientId = (): string => crypto.randomUUID();

const reportBackground = (error: unknown) => console.error('[partide capture]', error);

/**
 * fish useLogCapture: a capture with no cycle transition (standalone or rod-attributed).
 * `retryClientId` replays a failed attempt's id (the upsert is keyed by clientId, so a retry can
 * never write a second catch). `photoFile`: the picked, prepared photo (uploaded after the catch).
 */
export function logCapture(
  ctx: CaptureWriteContext,
  detail: LogCaptureDetail,
  { retryClientId, photoFile }: { retryClientId?: string; photoFile?: Blob | null } = {},
): { clientId: string; committed: Promise<void> } {
  const clientId = retryClientId ?? newClientId();
  const event = buildLogCaptureEvent(ctx.sessionClientId, detail, clientId, Date.now());
  const invalidate = () => invalidateCommunityAfterCatch(ctx.queryClient);
  const committed = commitCatchWithPhoto(ctx.live.transport, ctx.documentId, event, {
    isNew: true,
    photoFile: photoFile ?? null,
    onPhotoAttached: invalidate,
    onBackgroundError: reportBackground,
  });
  // Only on success: a failed write leaves the community payload correct as it stands.
  void committed.then(invalidate, () => {});
  return { clientId, committed };
}

/**
 * fish useUpdateCaptureEvent: patch a logged capture in place (the whole catch re-written by
 * clientId; a new photo uploads after; the tags PATCH only when the selection changed — resetting
 * to «Toți» sends the roster's uids, never `[]`). `stampedAt` is the clientUpdatedAt the CMS echoes
 * on the projection, i.e. what eventUpdatedSince waits for.
 */
export function updateCapture(
  ctx: CaptureWriteContext,
  eventClientId: string,
  patch: UpdateCaptureDetail,
  { stampedAt, photoFile }: { stampedAt: number; photoFile?: Blob | null },
): Promise<void> {
  const state = ctx.live.read();
  const e = state.events[eventClientId];
  if (!e || e.sessionClientId !== ctx.sessionClientId) return Promise.resolve();
  const rosterUids = (state.sessions[ctx.sessionClientId]?.members ?? []).map(m => m.uid);
  const { next, photoTagUidsPatch } = applyCaptureUpdate(e, patch, rosterUids, stampedAt);
  const invalidate = () => invalidateCommunityAfterCatch(ctx.queryClient);
  const committed = commitCatchWithPhoto(ctx.live.transport, ctx.documentId, next, {
    isNew: false,
    photoFile: patch.photo?.localUri ? (photoFile ?? null) : null,
    onPhotoAttached: invalidate,
    onBackgroundError: reportBackground,
    ...(photoTagUidsPatch ? { photoTagUidsPatch } : {}),
  });
  void committed.then(invalidate, () => {});
  return committed;
}

/**
 * fish hooks.ts#writeRodRuntime: ONE rod's runtime transition through the explicit command routes
 * (cast / stop, a compare-and-swap on the deadline this client believed was current), falling back
 * to the legacy rods PATCH when the server or the role does not offer them.
 */
async function writeRodRuntime(
  ctx: CaptureWriteContext,
  rodIndex: number,
  next: RodRuntime,
  previous: RodRuntime,
  legacyPatch: ReturnType<typeof buildRuntimeMetaPatch>,
): Promise<void> {
  const expectEndsAt = previous.endEpoch != null ? new Date(previous.endEpoch).toISOString() : null;
  const result =
    next.phase === 'fishing'
      ? await castRod(ctx.live.transport, rodCommandMemo, ctx.documentId, rodIndex, { expectEndsAt })
      : await stopRod(ctx.live.transport, rodCommandMemo, ctx.documentId, rodIndex, { expectEndsAt });
  if (result) return;
  if (legacyPatch) await (await ctx.live.repo()).updateMeta(ctx.sessionClientId, legacyPatch);
}

/**
 * fish useRodActions().resolve(rodIndex, 'capture', detail) → applyRodResult: a capture on a
 * running / expired rod closes its timer cycle (runtime → ready, persisted) and emits the catch.
 * Returns ONE promise over every CMS write, so the capture screen holds its curtain on the whole
 * resolve. The web schedules no alarm (ROADMAP §3), so the alarm effects are no-ops here.
 */
export function resolveRodCapture(ctx: CaptureWriteContext, rodIndex: number, detail: ResolveDetail, { photoFile }: { photoFile?: Blob | null } = {}): Promise<void> {
  const s: LocalSession | undefined = ctx.live.read().sessions[ctx.sessionClientId];
  if (!s) return Promise.resolve();
  const i = s.rods.findIndex(r => r.index === rodIndex);
  if (i < 0) return Promise.resolve();
  const rod = s.rods[i];
  const previous = s.rodRuntimes[i] ?? { phase: 'idle', endEpoch: null };
  const res = reduceRodCycle(rod, previous, { type: 'resolve', outcome: 'capture' }, liveClock.now());

  const writes: Promise<unknown>[] = [];
  const patch = buildRuntimeMetaPatch(s, rodIndex, res.runtime);
  if (patch) writes.push(retryWrite(() => writeRodRuntime(ctx, rodIndex, res.runtime, previous, patch)));
  for (const eff of res.effects) {
    if (eff.type !== 'emitEvent') continue;
    const event = buildEvent(s, rod, eff, detail, newClientId(), Date.now());
    const invalidate = () => invalidateCommunityAfterCatch(ctx.queryClient);
    writes.push(
      commitCatchWithPhoto(ctx.live.transport, ctx.documentId, event, {
        isNew: true,
        photoFile: photoFile ?? null,
        onPhotoAttached: invalidate,
        onBackgroundError: reportBackground,
      }).then(invalidate),
    );
  }
  return Promise.all(writes).then(() => undefined);
}

/**
 * fish useSetTargetSpecies: overwrite the session's target species (PATCH /feed/sessions/:id).
 * Fire-and-forget like fish (a failure is logged, never thrown into an event handler).
 */
export function setTargetSpecies(ctx: CaptureWriteContext, targets: { id: string | null; name: string }[]): Promise<void> {
  return ctx.live
    .repo()
    .then(repo => repo.updateMeta(ctx.sessionClientId, { targetSpecies: targets }))
    .catch(reportBackground);
}

/**
 * fish captura.tsx finishSave: once a capture is saved for good — the angler photo galleries (a
 * plain cache with no other invalidation path; broad `anglers` on purpose, the gallery that changed
 * may be a teammate's) and the partidă detail (what a device NOT following the projection renders).
 */
export function invalidateAfterCaptureSaved(queryClient: QueryClient, documentId: string): void {
  void queryClient.invalidateQueries({ queryKey: anglersKeys.all });
  void queryClient.invalidateQueries({ queryKey: partideKeys.detail(documentId), exact: true });
}

export type { LogCaptureDetail, ResolveDetail, UpdateCaptureDetail };
