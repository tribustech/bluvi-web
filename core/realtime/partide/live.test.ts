import { describe, expect, it, vi } from 'vitest';
import { createMemoryOutboxStorage } from '../chat/outbox/storage';
import {
  activePartidaOf,
  applyLiveSnapshot,
  classifyLiveListenerError,
  createPendingRuntimeWrites,
  emptyLivePartideState,
  eventGone,
  eventPresent,
  preserveLocalRuntimes,
  probeActiveSessionAfterSignIn,
  remoteAlarmCancels,
  revAdvanced,
  runtimeWriteKey,
  waitForProjection,
  type LivePartideState,
} from './live';
import { getActiveSession, knownSessionDocumentId, rememberSessionDocumentId } from './pointer';
import { resetPartidePersistence } from './live';
import type { LocalEvent, LocalRod, LocalSession, RodRuntime } from './types';

const rod = (index: number): LocalRod => ({
  index, label: `L${index}`, color: '#000', bait: '', baitType: null, baitSize: null, baitFlavor: null,
  lane: 'center', distance: 0, castLat: null, castLng: null, durationMs: null, alarmSound: null,
});
const session = (runtimes: RodRuntime[], over: Partial<LocalSession> = {}): LocalSession =>
  ({
    clientId: 's1', startedAt: 1, endedAt: null, rods: runtimes.map((_, i) => rod(i + 1)), rodRuntimes: runtimes, projectionRev: 0, ...over,
  }) as LocalSession;
const fishing: RodRuntime = { phase: 'fishing', endEpoch: 10 };
const idle: RodRuntime = { phase: 'idle', endEpoch: null };

describe('remoteAlarmCancels', () => {
  it('cancels the alarm of a rod that stopped running remotely, matched by index', () => {
    expect(remoteAlarmCancels(session([fishing, fishing]), session([idle, fishing]))).toEqual(['s1-1']);
    expect(remoteAlarmCancels(undefined, session([idle]))).toEqual([]);
  });
});

describe('pending runtime writes', () => {
  it('keeps the local runtime of a rod whose write is still travelling', () => {
    const pending = createPendingRuntimeWrites();
    pending.begin(runtimeWriteKey('s1', 1));
    const merged = preserveLocalRuntimes(session([fishing, fishing]), session([idle, idle]), pending.has);
    expect(merged.rodRuntimes).toEqual([fishing, idle]);
    pending.end(runtimeWriteKey('s1', 1));
    expect(pending.has(runtimeWriteKey('s1', 1))).toBe(false);
    const incoming = session([idle]);
    expect(preserveLocalRuntimes(session([fishing]), incoming, pending.has)).toBe(incoming);
  });

  it('nests overlapping writes', () => {
    const pending = createPendingRuntimeWrites();
    pending.begin('k');
    pending.begin('k');
    pending.end('k');
    expect(pending.has('k')).toBe(true);
    pending.end('k');
    expect(pending.has('k')).toBe(false);
  });
});

describe('applyLiveSnapshot', () => {
  const ev = { clientId: 'e1', clientUpdatedAt: 5 } as LocalEvent;

  it('replaces the state wholesale and reports the side effects', () => {
    const prev: LivePartideState = { ...emptyLivePartideState(), sessions: { s1: session([fishing]) }, reconnecting: true };
    const out = applyLiveSnapshot(prev, { session: session([idle]), events: [ev], markers: [] }, { fromCache: true });
    expect(out.state.sessions.s1.rodRuntimes).toEqual([idle]);
    expect(out.state.events).toEqual({ e1: ev });
    expect(out.state).toMatchObject({ reconnecting: false, projectionFromCache: true });
    expect(out).toMatchObject({ alarmCancels: ['s1-1'], releasePointer: false, primeClock: false });
  });

  it('releases the persisted pointer when a teammate finished the session', () => {
    const out = applyLiveSnapshot(emptyLivePartideState(), { session: session([], { endedAt: 99 }), events: [], markers: [] }, undefined);
    expect(out.releasePointer).toBe(true);
    expect(out.primeClock).toBe(true);
    expect(activePartidaOf(out.state)).toBeNull();
  });

  it('classifies permission-denied in both SDK code shapes', () => {
    expect(classifyLiveListenerError({ code: 'permission-denied' })).toBe('permission-denied');
    expect(classifyLiveListenerError({ code: 'firestore/permission-denied' })).toBe('permission-denied');
    expect(classifyLiveListenerError(new Error('x'))).toBe('other');
  });
});

describe('waitForProjection', () => {
  it('resolves true once the predicate holds after a state change, false on timeout', async () => {
    vi.useFakeTimers();
    let state: LivePartideState = emptyLivePartideState();
    const listeners = new Set<() => void>();
    const subscribe = (fn: () => void) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    };
    const read = () => state;
    const landed = waitForProjection(subscribe, eventPresent(read, 'e1'));
    state = { ...state, events: { e1: { clientId: 'e1' } as LocalEvent } };
    listeners.forEach(fn => fn());
    await expect(landed).resolves.toBe(true);
    expect(listeners.size).toBe(0);

    const never = waitForProjection(subscribe, revAdvanced(read, 's1', 0), 2500);
    vi.advanceTimersByTime(2500);
    await expect(never).resolves.toBe(false);
    expect(eventGone(read, 'nope')()).toBe(true);
    vi.useRealTimers();
  });
});

describe('probeActiveSessionAfterSignIn', () => {
  it('restores the pointer from the server, keyed by firestoreId (or clientId)', async () => {
    const storage = createMemoryOutboxStorage();
    await expect(probeActiveSessionAfterSignIn(async () => ({ clientId: 's9', documentId: 'd9' }), storage)).resolves.toEqual({
      sessionId: 's9',
      documentId: 'd9',
    });
    expect(await getActiveSession(storage)).toEqual({ sessionId: 's9', documentId: 'd9' });
  });

  it('never rejects and restores nothing on failure or an incomplete DTO', async () => {
    const storage = createMemoryOutboxStorage();
    await expect(probeActiveSessionAfterSignIn(async () => Promise.reject(new Error('x')), storage)).resolves.toBeNull();
    await expect(probeActiveSessionAfterSignIn(async () => ({ firestoreId: 's1', documentId: null }), storage)).resolves.toBeNull();
    await expect(probeActiveSessionAfterSignIn(async () => null, storage)).resolves.toBeNull();
    expect(await getActiveSession(storage)).toBeNull();
  });

  it('sign-out clears the pointer and the learned documentIds', async () => {
    const storage = createMemoryOutboxStorage();
    rememberSessionDocumentId('s1', 'd1');
    await probeActiveSessionAfterSignIn(async () => ({ firestoreId: 's1', documentId: 'd1' }), storage);
    await resetPartidePersistence(storage);
    expect(await getActiveSession(storage)).toBeNull();
    expect(knownSessionDocumentId('s1')).toBeNull();
  });
});
