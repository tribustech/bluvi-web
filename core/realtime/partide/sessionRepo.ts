/**
 * fish `features/partide/domain/firestore/sessionRepo.ts` — the live-session data plane for
 * online co-op Partide.
 *
 * Plan A Task 7 (Postgres is truth): the CMS owns EVERY write for sessions,
 * catches and rods — it rebuilds a single Firestore PROJECTION document per
 * live session so teammates' `subscribeSession` listener sees changes in ~1s.
 * This repo therefore:
 *  - Subscribes to that ONE `sessions/{id}` doc (session meta + catches +
 *    markers, all at the doc root — see mappers.ts).
 *  - Sends `writeCatch`/`deleteCatch`/`updateMeta` over HTTP to the CMS
 *    (injected `PartideControlPlane` — the web wires its core Partide API into it),
 *    resolving the target Strapi documentId from the active-session pointer.
 *  - Still writes `writeMarker`/`deleteMarker` directly to Firestore — markers
 *    are parked and deliberately excluded from the projection.
 *
 * Two identifiers, do not conflate them:
 *  - `sessionId` === `firestoreId` === the session `clientId` — the Firestore
 *    `sessions/{id}` doc id; used for the subscription and the marker paths.
 *  - `documentId` — the Strapi documentId; used for every HTTP write (events,
 *    session meta, rods) plus the finish route.
 *  Both are persisted in the active-session pointer so writes + finish work
 *  after a restart (the Firestore doc does not contain the Strapi documentId).
 *
 * SHARED FIRESTORE: Partide always uses the `(default)` database (`ctx.db`) from every
 * environment, and it is live in production. This module only ports the existing read (one
 * doc listener) and the existing marker writes, byte-for-byte; it adds nothing.
 */
import { deleteDoc, doc, onSnapshot, setDoc, type Unsubscribe } from 'firebase/firestore';
import type { RealtimeContext } from '../firebase';
import type { KeyValueStorage } from '../storage';
import {
  firestoreSessionToLocal,
  localMarkerToFirestore,
  localRodToFirestore,
  localSessionMetaPatchToFirestore,
  type AssembledSession,
  type FirestoreCatchDoc,
  type FirestoreMarkerDoc,
  type FirestoreSessionMeta,
} from './mappers';
import { clearActiveSession, getActiveSession, knownSessionDocumentId, setActiveSession } from './pointer';
import type { LocalEvent, LocalMarker, LocalRod, LocalSession, RodRuntime } from './types';

// ── Firestore handles / path helpers ─────────────────────────────────────────

const SESSIONS = 'sessions';
const MARKERS = 'markers';

const sessionDoc = (ctx: Pick<RealtimeContext, 'db'>, sessionId: string) => doc(ctx.db, SESSIONS, sessionId);
const markerDoc = (ctx: Pick<RealtimeContext, 'db'>, sessionId: string, clientId: string) =>
  doc(ctx.db, SESSIONS, sessionId, MARKERS, clientId);

// ── Live subscription ─────────────────────────────────────────────────────────

export type SnapshotMeta = {
  /** The doc came from the offline cache — nothing confirmed it with the server yet. */
  fromCache: boolean;
};

/**
 * Subscribe to the live session: ONE `sessions/{id}` doc — the CMS-rebuilt
 * PROJECTION carrying session meta FLAT at the doc root plus `catches`/
 * `markers` arrays (see `mappers.ts` header + the CMS's
 * `services/projection/build.ts`, which the field names must stay in lockstep
 * with). A snapshot with no data (doc not yet created / deleted) is ignored
 * rather than emitting an empty session. Returns an unsubscribe that detaches
 * the single listener.
 *
 * `serverNow` is the caller's server-clock reading (fish `serverClock.serverNow`), used to
 * derive rod phases at read time.
 */
export function subscribeSession(
  ctx: Pick<RealtimeContext, 'db'>,
  sessionId: string,
  onData: (assembled: AssembledSession, meta: SnapshotMeta) => void,
  onError: (err: Error) => void,
  serverNow: () => number = Date.now
): Unsubscribe {
  return onSnapshot(
    sessionDoc(ctx, sessionId),
    // Metadata changes included: on a cold start the FIRST snapshot is the
    // persisted cache (instant, possibly stale), and when the server then
    // confirms the very same bytes only `fromCache` flips — without this option
    // that flip never fires and the scene would stay marked provisional.
    { includeMetadataChanges: true },
    snap => {
      const data = snap.data() as
        | (FirestoreSessionMeta & { catches?: FirestoreCatchDoc[]; markers?: FirestoreMarkerDoc[] })
        | undefined;
      if (!data) return;
      // `data.serverNow` is deliberately NOT fed to serverClock. It is stamped
      // when the CMS BUILDS the projection, and Firestore re-delivers an
      // unchanged document on every resubscribe — so treating it as a clock
      // sample rewound `serverNow()` by the projection's age. Reopening the app
      // three hours after casting a 45-minute rod showed 45:00 counting down,
      // and the runtime derivation below never crossed `endEpoch` to expire it.
      // The clock is sampled from live responses instead (serverClock).
      onData(firestoreSessionToLocal(sessionId, data, data.catches ?? [], data.markers ?? [], serverNow()), {
        fromCache: snap.metadata?.fromCache ?? false,
      });
    },
    err => onError(err as Error)
  );
}

// Markers are parked and deliberately excluded from the projection (spec
// 2026-07-25) — they keep writing straight to Firestore for now.

/** Upsert a marker, keyed by its `clientId`; stamps a fresh `clientUpdatedAt`. */
export async function writeMarker(ctx: Pick<RealtimeContext, 'db'>, sessionId: string, marker: LocalMarker): Promise<void> {
  const data = { ...localMarkerToFirestore(marker), clientUpdatedAt: new Date().toISOString() };
  await setDoc(markerDoc(ctx, sessionId, marker.clientId), data);
}

export async function deleteMarker(ctx: Pick<RealtimeContext, 'db'>, sessionId: string, clientId: string): Promise<void> {
  await deleteDoc(markerDoc(ctx, sessionId, clientId));
}

// ── Control plane (HTTP, injected) ─────────────────────────────────────────────

/**
 * The fish `services/api/partide` calls this repo makes. The adapter owns the wire mapping
 * (`sessionToUpsertBody`, `eventToUpsertBody`) so this module stays free of HTTP DTOs.
 */
export interface PartideControlPlane {
  /** POST /feed/sessions with `sessionToUpsertBody(session)`. */
  createSession(session: LocalSession): Promise<{ documentId: string; firestoreId: string; joinCode: string | null }>;
  /** POST /feed/sessions/join. */
  joinSession(code: string): Promise<{ documentId: string; firestoreId: string }>;
  finishSession(documentId: string): Promise<unknown>;
  extendSession(documentId: string): Promise<unknown>;
  leaveSession<T = unknown>(documentId: string): Promise<T>;
  kickSessionMember<T = unknown>(documentId: string, targetDocumentId: string): Promise<T>;
  rotateSessionJoinCode<T = unknown>(documentId: string): Promise<T>;
  /** POST /feed/sessions/:id/events with `eventToUpsertBody(event)`. */
  upsertEvent(documentId: string, event: LocalEvent): Promise<{ documentId: string }>;
  deleteEventByClientId(documentId: string, clientId: string): Promise<unknown>;
  patchSession(documentId: string, meta: Record<string, unknown>): Promise<unknown>;
  patchRods(documentId: string, rods: Record<string, unknown>[]): Promise<{ serverNow: string }>;
}

/** The ids a caller must retain from create/join: `sessionId` for Firestore, `documentId` for finish. */
export interface SessionHandle {
  sessionId: string; // === firestoreId === clientId (Firestore doc + pointer)
  documentId: string; // Strapi documentId (finish route)
}

/**
 * A meta patch. A `configOnly` rods write deliberately carries NO runtime at all:
 * the server skips its entire runtime block when `runtimePhase` is absent, on the
 * new CMS and the currently deployed one alike, so omitting the runtime is what
 * leaves a running teammate's countdown untouched. A non-configOnly write still ships
 * the runtimes: that is the legacy path, kept only as the fallback for a server without
 * the rod commands.
 *
 * `changedRodIndex` names the ONE rod the caller actually touched, so the write
 * carries just that rod instead of this device's whole (possibly stale) view of
 * the array. That is what completes spec §1 defect 4 end-to-end: the server's
 * per-index merge is correct, but a full-array patch still `Object.assign`s a
 * stale sibling over a teammate's concurrent edit to it. Omit it only when the
 * caller genuinely changed every rod.
 */
export type SessionMetaPatch = Partial<LocalSession> &
  (
    | { rods: LocalRod[]; rodRuntimes: RodRuntime[]; changedRodIndex?: number; configOnly?: false }
    | { rods: LocalRod[]; configOnly: true; rodRuntimes?: undefined; changedRodIndex?: number }
    | { rods?: undefined }
  );

export type PartideSessionRepoDeps = {
  /** Pointer persistence (fish: AsyncStorage). */
  storage: KeyValueStorage;
  api: PartideControlPlane;
  /** fish `serverClock.noteServerNow` — fed from the rods PATCH reply. */
  noteServerNow?: (iso: string) => void;
};

/** The fish repo's HTTP half, bound to injected pointer storage + API. */
export function createPartideSessionRepo({ storage, api, noteServerNow }: PartideSessionRepoDeps) {
  /**
   * The Strapi documentId for a session clientId: the active-session pointer
   * first, then whatever a list/detail fetch recorded in `rememberSessionDocumentId`.
   *
   * The fallback is what lets a device that did NOT create or join this session
   * locally still write to it — same account on a second device, a cleared
   * storage. Without it those devices render the partidă fine (the route
   * carries the documentId) and then fail every write.
   */
  async function resolveSessionDocumentId(sessionId: string): Promise<string | null> {
    const active = await getActiveSession(storage);
    if (active?.sessionId === sessionId && active.documentId) return active.documentId;
    return knownSessionDocumentId(sessionId);
  }

  async function documentIdFor(sessionId: string): Promise<string> {
    const documentId = await resolveSessionDocumentId(sessionId);
    if (documentId) return documentId;
    throw new Error(`sessionRepo: no documentId for session ${sessionId}`);
  }

  return {
    resolveSessionDocumentId,

    /**
     * Create a session from a LocalSession: POST /feed/sessions (CMS mints the join
     * code and mirrors the Firestore doc), record it as the active session (both
     * ids), and return the ids + join code.
     */
    async createSession(session: LocalSession): Promise<SessionHandle & { joinCode: string | null }> {
      const dto = await api.createSession(session);
      await setActiveSession(storage, { sessionId: dto.firestoreId, documentId: dto.documentId });
      return { sessionId: dto.firestoreId, documentId: dto.documentId, joinCode: dto.joinCode };
    },

    /**
     * Join a session by code: POST /feed/sessions/join. A `PARTIDA:*` bluCode error
     * propagates unswallowed (the UI shows it); on success the session becomes the
     * active one (both ids persisted).
     */
    async joinSession(code: string): Promise<SessionHandle> {
      const dto = await api.joinSession(code);
      await setActiveSession(storage, { sessionId: dto.firestoreId, documentId: dto.documentId });
      return { sessionId: dto.firestoreId, documentId: dto.documentId };
    },

    /**
     * Finish + archive a session. `documentId` is the Strapi documentId; when omitted
     * it is read from the active-session pointer (so a post-restart finish works
     * without the caller re-supplying it). Clears the pointer once archived.
     */
    async finishSession(documentId?: string): Promise<void> {
      let id = documentId;
      if (!id) {
        const active = await getActiveSession(storage);
        if (!active) throw new Error('finishSession: no documentId provided and no active session pointer');
        id = active.documentId;
      }
      await api.finishSession(id);
      await clearActiveSession(storage);
    },

    /** "Da, continui" on the auto-close sheet: extend the active session through
     * the CMS, resolving its documentId from the active-session pointer. */
    async extendActiveSession(): Promise<void> {
      const active = await getActiveSession(storage);
      if (!active) throw new Error('extendActiveSession: no active session pointer');
      await api.extendSession(active.documentId);
    },

    /** Leave through the CMS. A route-hydrated Strapi id takes precedence; live
     * callers can continue resolving it from the active pointer. */
    async leaveSession<T = unknown>(sessionId: string, documentIdOverride?: string): Promise<T> {
      return api.leaveSession<T>(documentIdOverride ?? (await documentIdFor(sessionId)));
    },

    /** Remove a member through the CMS; membership fields are never written to Firestore. */
    async kickMember<T = unknown>(sessionId: string, targetDocumentId: string, documentIdOverride?: string): Promise<T> {
      return api.kickSessionMember<T>(documentIdOverride ?? (await documentIdFor(sessionId)), targetDocumentId);
    },

    /** Rotate a live session's join code through the CMS. */
    async rotateJoinCode<T = unknown>(sessionId: string, documentIdOverride?: string): Promise<T> {
      return api.rotateSessionJoinCode<T>(documentIdOverride ?? (await documentIdFor(sessionId)));
    },

    /**
     * Upsert a catch through the CMS (POST /feed/sessions/:id/events — create or
     * LWW update, keyed by `clientId`). Returns the event's Strapi documentId so a
     * follow-up photo PATCH can target it directly.
     */
    async writeCatch(sessionId: string, event: LocalEvent): Promise<string> {
      const dto = await api.upsertEvent(await documentIdFor(sessionId), event);
      return dto.documentId;
    },

    /** Delete a catch by its `clientId` (DELETE …/events/by-client/:clientId). */
    async deleteCatch(sessionId: string, clientId: string): Promise<void> {
      await api.deleteEventByClientId(await documentIdFor(sessionId), clientId);
    },

    /**
     * Patch the editable session META (notes, venue, targetSpecies, rods config,
     * endedAt, …) through the CMS. A `rods` patch goes to the dedicated per-rod
     * merge endpoint (PATCH …/rods, mapped through `localRodToFirestore` so field
     * names stay aligned with the wire DTO); everything else goes to the session
     * PATCH (…/:id). If a patch carries both, both calls happen.
     */
    async updateMeta(sessionId: string, partial: SessionMetaPatch): Promise<void> {
      const documentId = await documentIdFor(sessionId);
      const { rods, rodRuntimes, changedRodIndex, configOnly, ...rest } = partial as SessionMetaPatch & {
        rodRuntimes?: RodRuntime[];
        changedRodIndex?: number;
        configOnly?: boolean;
      };

      if (rods) {
        // Zip each rod with ITS OWN runtime FIRST, then narrow — narrowing before
        // zipping would re-index the runtimes and hand rod N rod 0's timer.
        const zipped = rods.map((r, i) => localRodToFirestore(r, r.index, rodRuntimes?.[i], { includeRuntime: !configOnly }));
        // Send only the rod the caller changed. An index that isn't in the array is
        // a caller bug: fall back to the full array rather than silently dropping
        // the write (a lost rod write is strictly worse than a stale sibling).
        const narrowed = changedRodIndex === undefined ? zipped : zipped.filter(r => r.index === changedRodIndex);
        const payload = narrowed.length ? narrowed : zipped;

        // The server stamps runtimeEndsAt off its own clock (not the caller's), and
        // returns it as `serverNow` — feed that into serverClock so this device's
        // countdown matches teammates' immediately, without waiting for the next
        // projection snapshot.
        const res = await api.patchRods(documentId, payload);
        noteServerNow?.(res.serverNow);
      }

      const meta = localSessionMetaPatchToFirestore(rest);
      if (Object.keys(meta).length) await api.patchSession(documentId, meta);
    },

    getActiveSession: () => getActiveSession(storage),
    setActiveSession: (active: { sessionId: string; documentId: string }) => setActiveSession(storage, active),
    clearActiveSession: () => clearActiveSession(storage),
  };
}

export type PartideSessionRepo = ReturnType<typeof createPartideSessionRepo>;
