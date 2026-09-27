/**
 * The framework-free parts of fish's Partide live plane:
 *  - `useLiveMount.ts`   → `applyLiveSnapshot` (the snapshot → state reduction), `remoteAlarmCancels`,
 *                          `classifyLiveListenerError`, `VALID_RECOVERY_DELAYS_MS`.
 *  - `store.ts`          → `LivePartideState` (the three atoms + reconnect/fromCache flags) and its
 *                          selectors/clearers, as a plain value the app keeps in its own store.
 *  - `pendingRuntimeWrites.ts` → `createPendingRuntimeWrites` + `preserveLocalRuntimes`.
 *  - `awaitProjection.ts` → the predicate factories over `LivePartideState`.
 *  - `activeSessionProbe.ts` → `probeActiveSessionAfterSignIn` with injected API + storage.
 *
 * What stays in the app: local rod alarms (fish cancels OS notifications), toasts, navigation,
 * Sentry, the permission-denied REST confirmation + cleanup flow (it drives React Query and the
 * router), and the NetInfo-driven reconnect (the web listens to `online`/`offline` events).
 */
import type { KeyValueStorage } from '../storage';
import type { AssembledSession } from './mappers';
import { clearActiveSession, forgetSessionDocumentIds, setActiveSession, type ActiveSession } from './pointer';
import type { SnapshotMeta } from './sessionRepo';
import type { LocalEvent, LocalMarker, LocalSession, RodRuntime } from './types';

// ── store.ts ─────────────────────────────────────────────────────────────────

/**
 * The live-session state (online model). The ACTIVE session lives in Firestore; the live
 * subscription pipes each snapshot into this state and the UI reads it. There is NO local
 * session persistence, NO outbox and NO hand-rolled sync engine.
 *
 * Keyed by clientId. In the online model the records hold AT MOST ONE session — the active one
 * from the subscription — but the Record shape is kept so lookups by clientId work as before.
 */
export type LivePartideState = {
  sessions: Record<string, LocalSession>;
  events: Record<string, LocalEvent>;
  markers: Record<string, LocalMarker>;
  /** The reactive active-session pointer that drives the subscription. Null = no live session. */
  active: ActiveSession | null;
  /** True while a permission-denied listener error has not been conclusively reconciled. */
  reconnecting: boolean;
  /**
   * True while the live session came from Firestore's OFFLINE CACHE (`snapshot.metadata.fromCache`),
   * i.e. nothing has confirmed it with the server since the app started. Rod countdowns drawn from
   * it are provisional ("Se sincronizează").
   */
  projectionFromCache: boolean;
};

export const emptyLivePartideState = (): LivePartideState => ({
  sessions: {},
  events: {},
  markers: {},
  active: null,
  reconnecting: false,
  projectionFromCache: false,
});

/** Object.values() dropping any null/undefined slot. */
export const recordValues = <T>(rec: Record<string, T | null | undefined>): T[] => Object.values(rec).filter((v): v is T => v != null);

/**
 * fish `activePartidaAtom`: the newest session with `endedAt === null`, or null. The subscription
 * puts at most one session into `sessions`, so this is that session while it is running.
 */
export function activePartidaOf(state: Pick<LivePartideState, 'sessions'>): LocalSession | null {
  const actives = recordValues(state.sessions).filter(s => s.endedAt === null);
  if (!actives.length) return null;
  return actives.sort((a, b) => b.startedAt - a.startedAt)[0];
}

/** fish `clearLivePartideState`: every field that can expose the current live session. */
export function clearLivePartideState(state: LivePartideState): LivePartideState {
  return { ...state, sessions: {}, events: {}, markers: {}, active: null, reconnecting: false };
}

// ── pendingRuntimeWrites.ts ──────────────────────────────────────────────────

/**
 * Rods whose runtime write has not settled yet.
 *
 * A projection snapshot is authoritative for rod runtimes — except for a rod
 * this device has just changed and whose write is still travelling. Measured on
 * a physical Samsung, stopping a rod and starting it again 1.28s later: the stop's
 * snapshot lands AFTER the start and drags the card back to "Pornește" for ~800ms
 * before the next snapshot restores it. The echo takes ~1.3-1.6s, so any start
 * inside that window flickers; a slower tap never does, which is why this looked
 * intermittent.
 *
 * While a rod is in this set the snapshot keeps its hands off that rod's
 * runtime and applies everything else as usual. A teammate's change to the same
 * rod inside that window is ignored — the write about to land would have
 * overwritten it anyway. (fish: module state; here one registry per app.)
 */
export function createPendingRuntimeWrites() {
  const pending = new Map<string, number>();
  return {
    /** Call alongside the optimistic runtime write. Counted, so overlapping writes nest. */
    begin(key: string): void {
      pending.set(key, (pending.get(key) ?? 0) + 1);
    },
    /** Call when the write settles — resolved OR rejected (a rejection rolls back locally). */
    end(key: string): void {
      const n = pending.get(key);
      if (n == null) return;
      if (n <= 1) pending.delete(key);
      else pending.set(key, n - 1);
    },
    has(key: string): boolean {
      return pending.has(key);
    },
    clear(): void {
      pending.clear();
    },
  };
}

export const runtimeWriteKey = (sessionClientId: string, rodIndex: number) => `${sessionClientId}-${rodIndex}`;

/**
 * Snapshot merge: take `incoming` as-is, except for rods with an unsettled
 * write, which keep the runtime already in `existing`. Matching is by rod
 * `index`, never by array position — the two arrays need not be aligned.
 */
export function preserveLocalRuntimes(
  existing: LocalSession | undefined,
  incoming: LocalSession,
  isPending: (key: string) => boolean
): LocalSession {
  if (!existing) return incoming;
  let changed = false;
  const rodRuntimes: RodRuntime[] = incoming.rods.map((rod, i) => {
    const remote = incoming.rodRuntimes[i];
    if (!isPending(runtimeWriteKey(incoming.clientId, rod.index))) return remote;
    const li = existing.rods.findIndex(r => r.index === rod.index);
    if (li < 0) return remote;
    const local = existing.rodRuntimes[li];
    if (!local) return remote;
    changed = true;
    return local;
  });
  return changed ? { ...incoming, rodRuntimes } : incoming;
}

// ── useLiveMount.ts ──────────────────────────────────────────────────────────

const IDLE_RUNTIME: RodRuntime = { phase: 'idle', endEpoch: null };
const RUNNING = new Set<RodRuntime['phase']>(['fishing', 'firing']);

/** Backoff for re-subscribing after a permission-denied the server confirmed as still valid. */
export const VALID_RECOVERY_DELAYS_MS = [1000, 2000, 4000];

/**
 * Rod alarms are scheduled on the casting device. When a rod leaves its
 * running state via a REMOTE change (a teammate resolved/stopped it — spec
 * 2026-07-22), this device's pending alarm must be cancelled. Matched by rod
 * `index`; rodKey format mirrors applyRodResult's `${clientId}-${index}`.
 */
export function remoteAlarmCancels(prev: LocalSession | undefined, next: LocalSession): string[] {
  if (!prev) return [];
  const nextByIndex = new Map(next.rods.map((r, i) => [r.index, next.rodRuntimes[i] ?? IDLE_RUNTIME]));
  const keys: string[] = [];
  prev.rods.forEach((r, i) => {
    const was = prev.rodRuntimes[i] ?? IDLE_RUNTIME;
    const now = nextByIndex.get(r.index) ?? IDLE_RUNTIME;
    if (RUNNING.has(was.phase) && !RUNNING.has(now.phase)) keys.push(`${prev.clientId}-${r.index}`);
  });
  return keys;
}

export const keyByClientId = <T extends { clientId: string }>(items: T[]): Record<string, T> =>
  Object.fromEntries(items.map(item => [item.clientId, item]));

/**
 * One snapshot into the live state (fish's `subscribeSession` onData body). Returns the next state
 * plus the side effects the app must run:
 *  - `alarmCancels`: local alarm keys to cancel (a rod stopped REMOTELY).
 *  - `releasePointer`: a TEAMMATE finished this session (only the finisher's own device runs the
 *    end flow, which drops the pointer itself). Release the PERSISTED pointer so a restart doesn't
 *    resubscribe to a dead session and a new start isn't blocked — but keep the in-memory state +
 *    snapshot so the recap screen stays alive until a new create/join overwrites it.
 *  - `primeClock`: a server snapshot proves the network is back even when the connectivity flag
 *    has not noticed; take the clock sample an offline launch could not.
 */
export function applyLiveSnapshot(
  state: LivePartideState,
  { session: incoming, events, markers }: AssembledSession,
  meta: SnapshotMeta | undefined,
  isPendingRuntimeWrite: (key: string) => boolean = () => false
): { state: LivePartideState; alarmCancels: string[]; releasePointer: boolean; primeClock: boolean } {
  const fromCache = meta?.fromCache ?? false;
  const existing = state.sessions[incoming.clientId];
  // A rod whose own write is still travelling keeps its local runtime: the snapshot in hand may
  // be the echo of an EARLIER write and would drag the card back.
  const session = preserveLocalRuntimes(existing, incoming, isPendingRuntimeWrite);
  return {
    state: {
      ...state,
      sessions: { [session.clientId]: session },
      events: keyByClientId(events),
      markers: keyByClientId(markers),
      reconnecting: false,
      projectionFromCache: fromCache,
    },
    alarmCancels: remoteAlarmCancels(existing, session),
    releasePointer: session.endedAt != null,
    primeClock: !fromCache,
  };
}

/**
 * The live listener's error triage. Only a permission-denied needs the private REST confirmation
 * (was I removed? was the partidă deleted?); anything else is just reported. Both SDK code shapes
 * are accepted (RN-firebase prefixes `firestore/`).
 */
export function classifyLiveListenerError(err: unknown): 'permission-denied' | 'other' {
  const code = (err as { code?: unknown } | null)?.code;
  return code === 'firestore/permission-denied' || code === 'permission-denied' ? 'permission-denied' : 'other';
}

// ── awaitProjection.ts (predicates) ──────────────────────────────────────────
// "Has the projection caught up with my write yet?" The live plane REPLACES the state wholesale
// on every snapshot, so an optimistic local write would just be flattened by the next push —
// instead the save screens hold their curtain until the real data arrives, capped by
// PROJECTION_TIMEOUT_MS (a presentation fallback only: the HTTP response already decided success).

/** How long a screen waits for the snapshot after its write resolved. */
export const PROJECTION_TIMEOUT_MS = 2500;

type StateRead = () => Pick<LivePartideState, 'sessions' | 'events'>;

/** The session's current projection rev (0 when unknown) — snapshot this BEFORE a write. */
export const currentRev = (read: StateRead, sessionClientId: string): number => read().sessions[sessionClientId]?.projectionRev ?? 0;

/** A brand-new rod has landed. */
export const rodPresent = (read: StateRead, sessionClientId: string, rodIndex: number) => (): boolean =>
  !!read().sessions[sessionClientId]?.rods.some(r => r.index === rodIndex);

/** Any session write landed — the only reliable signal for an EDIT, where the entity already exists. */
export const revAdvanced = (read: StateRead, sessionClientId: string, sinceRev: number) => (): boolean =>
  currentRev(read, sessionClientId) > sinceRev;

/** A brand-new catch has landed. */
export const eventPresent = (read: StateRead, eventClientId: string) => (): boolean => !!read().events[eventClientId];

/** An edited catch has landed: the server echoes back our `clientUpdatedAt`. */
export const eventUpdatedSince = (read: StateRead, eventClientId: string, sinceMs: number) => (): boolean => {
  const e = read().events[eventClientId];
  return !!e && e.clientUpdatedAt >= sinceMs;
};

/** A deleted catch is gone from the projection. */
export const eventGone = (read: StateRead, eventClientId: string) => (): boolean => !read().events[eventClientId];

/**
 * fish `waitForProjection`: resolves `true` when `predicate` holds (checked now, and again on
 * every state change the app reports via `subscribe`), or `false` when `timeoutMs` elapses first.
 * Never rejects — a timeout is not a failure.
 */
export function waitForProjection(
  subscribe: (onChange: () => void) => () => void,
  predicate: () => boolean,
  timeoutMs: number = PROJECTION_TIMEOUT_MS
): Promise<boolean> {
  if (predicate()) return Promise.resolve(true);
  return new Promise<boolean>(resolve => {
    let settled = false;
    const unsubs: (() => void)[] = [];
    const finish = (confirmed: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      unsubs.forEach(u => u());
      resolve(confirmed);
    };
    const check = () => {
      if (predicate()) finish(true);
    };
    const timer = setTimeout(() => finish(false), timeoutMs);
    unsubs.push(subscribe(check));
    // Re-check after subscribing: a snapshot landing between the early return
    // above and the subscription would otherwise be missed.
    check();
  });
}

// ── activeSessionProbe.ts ────────────────────────────────────────────────────

/**
 * The post-sign-in live-session probe. The pointer is local-only and the session data lives in
 * Firestore — so losing the pointer means the app no longer knows WHICH session to subscribe to,
 * even though the session is still running server-side (a tester reinstalled, saw no live
 * partidă, started a second one — 2026-08-09). Every way of losing the pointer also drops the
 * session, so a sign-in is the ONLY moment the pointer can be missing while a live session
 * exists: run this once per sign-in.
 *
 * Never rejects: a failed probe leaves the app exactly as it is (no live session known), and the
 * server-side create guard still refuses a second start. Resolves the pointer it restored (the
 * app sets it into its live state only if nothing claimed the state meanwhile — a create/join
 * that landed while the probe was in flight owns the pointer).
 */
export async function probeActiveSessionAfterSignIn(
  getActiveSessionRequest: () => Promise<{ firestoreId?: string | null; clientId?: string | null; documentId?: string | null } | null>,
  storage: KeyValueStorage
): Promise<ActiveSession | null> {
  let dto;
  try {
    dto = await getActiveSessionRequest();
  } catch {
    // A sign-in must not fail because the probe did.
    return null;
  }
  if (!dto) return null;

  // The mount subscribes by firestoreId; it equals clientId by construction
  // (create writes both from the same value), so either one is a valid id.
  const sessionId = dto.firestoreId ?? dto.clientId;
  if (!sessionId || !dto.documentId) return null;

  const pointer = { sessionId, documentId: dto.documentId };
  await setActiveSession(storage, pointer);
  return pointer;
}

/**
 * fish `resetPartideStore` minus the in-memory state (the app sets `clearLivePartideState`):
 * sign-out clears the persisted pointer and the learned session→documentId map.
 */
export async function resetPartidePersistence(storage: KeyValueStorage): Promise<void> {
  forgetSessionDocumentIds();
  await clearActiveSession(storage);
}
