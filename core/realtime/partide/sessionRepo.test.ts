/**
 * Port of fish `sessionRepo.test.ts`: doc paths, payloads (clientId keying + fresh ISO
 * clientUpdatedAt), the HTTP control-plane wiring + active-pointer bookkeeping, and the
 * single-doc subscribe/unsubscribe. Firestore is the in-memory fake (no app, no network — the
 * shared production `sessions` data is never reachable from here) and the API is a stub.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('firebase/firestore', async orig => (await import('../__tests__/fakeFirestore')).fakeFirestoreModule(await orig()));

import { fs } from '../__tests__/fakeFirestore';
import { createMemoryOutboxStorage } from '../chat/outbox/storage';
import {
  ACTIVE_SESSION_KEY,
  clearActiveSession,
  forgetSessionDocumentIds,
  getActiveSession,
  rememberSessionDocumentId,
  setActiveSession,
} from './pointer';
import { createPartideSessionRepo, deleteMarker, subscribeSession, writeMarker, type PartideControlPlane } from './sessionRepo';
import type { LocalEvent, LocalMarker, LocalRod, LocalSession, RodRuntime } from './types';

const DEFAULT_DB = { name: '(default)' };
const ctx = { db: DEFAULT_DB } as never;

const api = {
  createSession: vi.fn(),
  joinSession: vi.fn(),
  finishSession: vi.fn(),
  extendSession: vi.fn(),
  leaveSession: vi.fn(),
  kickSessionMember: vi.fn(),
  rotateSessionJoinCode: vi.fn(),
  upsertEvent: vi.fn(),
  deleteEventByClientId: vi.fn(),
  patchSession: vi.fn(),
  patchRods: vi.fn(),
};

const rod: LocalRod = {
  index: 2, label: 'L2', color: '#000', bait: 'Pellet', baitType: null, baitSize: null, baitFlavor: null,
  lane: 'left', distance: 40, castLat: null, castLng: null, durationMs: 3600000, alarmSound: 'tone-2',
};

const event: LocalEvent = {
  clientId: 'evt-9', serverId: null, serverNumericId: null, syncStatus: 'pending', clientUpdatedAt: 1751790001000,
  sessionClientId: 'sess-1', outcome: 'capture', rodIndex: 1, rodLabel: 'L1', rodColor: '#F43F5E', bait: 'Boilies',
  baitType: null, baitSize: null, baitFlavor: null, lane: 'center', distance: 65, lat: 44.43, lng: 26.01, weightKg: 6.4,
  weightEstimated: false, species: 'Crap', speciesId: 'f1', photoLocalUri: null, photoUploadStatus: 'none', photoUrl: null,
  notes: null, occurredAt: 1751790000500,
};

const marker: LocalMarker = {
  clientId: 'mk-9', serverId: null, syncStatus: 'pending', clientUpdatedAt: 1751790002000, type: 'baited',
  lat: 44.41, lng: 26.02, label: null, scope: 'session', venue: { venueType: 'lake', lakeId: 'lake-1' }, sessionClientId: 'sess-1',
};

const localSession: LocalSession = {
  clientId: 'sess-1', serverId: null, syncStatus: 'pending', clientUpdatedAt: 1751790000000, venueType: 'lake',
  lakeId: 'lake-1', lakeName: 'Roveng', publicWaterCode: null, publicWaterName: null, manualVenueName: null, standId: null,
  standName: null, locality: null, anchorLat: 44.4, anchorLng: 26.0, anchorName: null, startedAt: 1751780000000,
  endedAt: null, warnedAt: null, autoCloseAt: null, plannedDurationMs: 86_400_000, notes: null, visibleOnProfile: true,
  targetSpecies: [], rods: [rod], rodRuntimes: [{ phase: 'idle', endEpoch: null }], detailsHydrated: true, projectionRev: 0,
};

let storage: ReturnType<typeof createMemoryOutboxStorage>;
let noteServerNow: ReturnType<typeof vi.fn>;
let repo: ReturnType<typeof createPartideSessionRepo>;

beforeEach(() => {
  fs.reset();
  vi.clearAllMocks();
  for (const fn of Object.values(api)) fn.mockReset();
  api.finishSession.mockResolvedValue({});
  api.extendSession.mockResolvedValue(undefined);
  api.patchSession.mockResolvedValue(undefined);
  api.patchRods.mockResolvedValue({ rods: [], serverNow: '2026-07-25T00:00:00.000Z' });
  api.deleteEventByClientId.mockResolvedValue(undefined);
  storage = createMemoryOutboxStorage();
  noteServerNow = vi.fn();
  repo = createPartideSessionRepo({ storage, api: api as unknown as PartideControlPlane, noteServerNow: noteServerNow as never });
  // Module-level Map — a mapping left by one test would silently satisfy the
  // next one's "no documentId" expectation.
  forgetSessionDocumentIds();
});

afterEach(() => {
  vi.restoreAllMocks();
});

const noFirestoreWrites = () => {
  expect(fs.setDoc).not.toHaveBeenCalled();
  expect(fs.updateDoc).not.toHaveBeenCalled();
  expect(fs.deleteDoc).not.toHaveBeenCalled();
};

describe('active-session pointer', () => {
  it('set / get / clear the { sessionId, documentId } pair (persisted as JSON)', async () => {
    await setActiveSession(storage, { sessionId: 'sess-1', documentId: 'doc-abc' });
    expect(JSON.parse(storage.data.get(ACTIVE_SESSION_KEY) as string)).toEqual({ sessionId: 'sess-1', documentId: 'doc-abc' });
    expect(await getActiveSession(storage)).toEqual({ sessionId: 'sess-1', documentId: 'doc-abc' });
    await clearActiveSession(storage);
    expect(await getActiveSession(storage)).toBeNull();
  });

  it('getActiveSession returns null on a malformed / partial pointer', async () => {
    await storage.set(ACTIVE_SESSION_KEY, '{ not json');
    expect(await getActiveSession(storage)).toBeNull();
    await storage.set(ACTIVE_SESSION_KEY, JSON.stringify({ sessionId: 'sess-1' }));
    expect(await getActiveSession(storage)).toBeNull();
  });
});

describe('createSession', () => {
  it('POSTs the session, returns ids + joinCode, persists both ids', async () => {
    api.createSession.mockResolvedValue({ documentId: 'doc-abc', firestoreId: 'sess-1', joinCode: 'AB12CD', status: 'active', members: [] });
    const res = await repo.createSession(localSession);
    expect(api.createSession).toHaveBeenCalledWith(localSession);
    expect(res).toEqual({ sessionId: 'sess-1', documentId: 'doc-abc', joinCode: 'AB12CD' });
    expect(await getActiveSession(storage)).toEqual({ sessionId: 'sess-1', documentId: 'doc-abc' });
  });
});

describe('joinSession', () => {
  it('returns ids and persists both in the pointer', async () => {
    api.joinSession.mockResolvedValue({ documentId: 'doc-xyz', firestoreId: 'sess-7', joinCode: 'ZZ99', status: 'active', members: [] });
    const res = await repo.joinSession('zz99');
    expect(api.joinSession).toHaveBeenCalledWith('zz99');
    expect(res).toEqual({ sessionId: 'sess-7', documentId: 'doc-xyz' });
    expect(await getActiveSession(storage)).toEqual({ sessionId: 'sess-7', documentId: 'doc-xyz' });
  });

  it('propagates a PARTIDA:* bluCode error and does NOT set the pointer', async () => {
    api.joinSession.mockRejectedValue({ bluCode: 'PARTIDA:CODE_INVALID', message: 'invalid' });
    await expect(repo.joinSession('bad')).rejects.toMatchObject({ bluCode: 'PARTIDA:CODE_INVALID' });
    expect(await getActiveSession(storage)).toBeNull();
  });
});

describe('finishSession', () => {
  it('POSTs the explicit documentId and clears the pointer', async () => {
    await setActiveSession(storage, { sessionId: 'sess-1', documentId: 'doc-abc' });
    await repo.finishSession('doc-abc');
    expect(api.finishSession).toHaveBeenCalledWith('doc-abc');
    expect(await getActiveSession(storage)).toBeNull();
  });

  it('falls back to the pointer documentId when none is passed (post-restart finish)', async () => {
    await setActiveSession(storage, { sessionId: 'sess-1', documentId: 'doc-from-pointer' });
    await repo.finishSession();
    expect(api.finishSession).toHaveBeenCalledWith('doc-from-pointer');
    expect(await getActiveSession(storage)).toBeNull();
  });

  it('throws when no documentId is passed and there is no active pointer', async () => {
    await expect(repo.finishSession()).rejects.toThrow(/no active session pointer/);
    expect(api.finishSession).not.toHaveBeenCalled();
  });
});

describe('extendActiveSession', () => {
  it('POSTs the pointer documentId and leaves the pointer intact', async () => {
    await setActiveSession(storage, { sessionId: 'sess-1', documentId: 'doc-abc' });
    await repo.extendActiveSession();
    expect(api.extendSession).toHaveBeenCalledWith('doc-abc');
    expect(await getActiveSession(storage)).toEqual({ sessionId: 'sess-1', documentId: 'doc-abc' });
  });

  it('throws when there is no active pointer', async () => {
    await expect(repo.extendActiveSession()).rejects.toThrow(/no active session pointer/);
    expect(api.extendSession).not.toHaveBeenCalled();
  });
});

describe('membership control plane (HTTP)', () => {
  beforeEach(async () => {
    await setActiveSession(storage, { sessionId: 'sess-members', documentId: 'session-doc-1' });
  });

  it('leaveSession resolves the documentId and returns the API result without a Firestore write', async () => {
    api.leaveSession.mockResolvedValueOnce({ removed: true });
    await expect(repo.leaveSession('sess-members')).resolves.toEqual({ removed: true });
    expect(api.leaveSession).toHaveBeenCalledWith('session-doc-1');
    noFirestoreWrites();
  });

  it('kickMember resolves the session documentId and preserves the target documentId/result', async () => {
    const result = { removed: true, joinCode: 'NEXT42', hostUid: 'host', projectionRev: 8 };
    api.kickSessionMember.mockResolvedValueOnce(result);
    await expect(repo.kickMember('sess-members', 'user-doc-7')).resolves.toEqual(result);
    expect(api.kickSessionMember).toHaveBeenCalledWith('session-doc-1', 'user-doc-7');
    noFirestoreWrites();
  });

  it('rotateJoinCode resolves the session documentId and returns the API result without a Firestore write', async () => {
    api.rotateSessionJoinCode.mockResolvedValueOnce({ joinCode: 'ROTATE7', projectionRev: 9 });
    await expect(repo.rotateJoinCode('sess-members')).resolves.toEqual({ joinCode: 'ROTATE7', projectionRev: 9 });
    expect(api.rotateSessionJoinCode).toHaveBeenCalledWith('session-doc-1');
    noFirestoreWrites();
  });

  it('an explicit Strapi documentId wins without consulting the pointer or writing Firestore', async () => {
    await clearActiveSession(storage);
    const get = vi.spyOn(storage, 'get');
    api.leaveSession.mockResolvedValueOnce({ removed: true });
    api.kickSessionMember.mockResolvedValueOnce({ removed: true });
    api.rotateSessionJoinCode.mockResolvedValueOnce({ joinCode: 'NEW123', projectionRev: 10 });

    await repo.leaveSession('history-live', 'detail-doc-1');
    await repo.kickMember('history-live', 'target-doc-7', 'detail-doc-1');
    await repo.rotateJoinCode('history-live', 'detail-doc-1');

    expect(api.leaveSession).toHaveBeenCalledWith('detail-doc-1');
    expect(api.kickSessionMember).toHaveBeenCalledWith('detail-doc-1', 'target-doc-7');
    expect(api.rotateSessionJoinCode).toHaveBeenCalledWith('detail-doc-1');
    expect(get).not.toHaveBeenCalled();
    noFirestoreWrites();
  });
});

describe('writes (HTTP — catches/session meta)', () => {
  beforeEach(async () => {
    await setActiveSession(storage, { sessionId: 'sess-c-1', documentId: 'sess-doc-1' });
  });

  it('writeCatch POSTs the event to the CMS instead of writing Firestore', async () => {
    api.upsertEvent.mockResolvedValue({ documentId: 'evt-doc-1', clientId: 'ev-1' });
    const returned = await repo.writeCatch('sess-c-1', { ...event, clientId: 'ev-1' });
    expect(api.upsertEvent).toHaveBeenCalledWith('sess-doc-1', expect.objectContaining({ clientId: 'ev-1' }));
    expect(fs.setDoc).not.toHaveBeenCalled();
    expect(returned).toBe('evt-doc-1'); // the event's Strapi documentId, for the photo PATCH
  });

  it('writeCatch rejects when there is no active pointer for the given sessionId', async () => {
    await expect(repo.writeCatch('other-session', event)).rejects.toThrow(/no documentId/);
    expect(api.upsertEvent).not.toHaveBeenCalled();
  });

  // The pointer is written only by createSession/joinSession, so a device that
  // merely OPENS someone's live partidă has none — and used to fail every write while
  // still rendering the session fine.
  it('writeCatch falls back to a documentId learned from a list/detail fetch', async () => {
    rememberSessionDocumentId('other-session', 'remembered-doc');
    api.upsertEvent.mockResolvedValue({ documentId: 'evt-doc-2', clientId: 'ev-2' });
    await repo.writeCatch('other-session', { ...event, clientId: 'ev-2' });
    expect(api.upsertEvent).toHaveBeenCalledWith('remembered-doc', expect.objectContaining({ clientId: 'ev-2' }));
  });

  it('the active pointer wins over a remembered mapping for the same session', async () => {
    rememberSessionDocumentId('sess-c-1', 'stale-doc');
    api.upsertEvent.mockResolvedValue({ documentId: 'evt-doc-3', clientId: 'ev-3' });
    await repo.writeCatch('sess-c-1', { ...event, clientId: 'ev-3' });
    expect(api.upsertEvent).toHaveBeenCalledWith('sess-doc-1', expect.anything());
  });

  it('deleteCatch and updateMeta take the same fallback', async () => {
    rememberSessionDocumentId('other-session', 'remembered-doc');
    await repo.deleteCatch('other-session', 'ev-1');
    await repo.updateMeta('other-session', { notes: 'de pe al doilea telefon' });
    expect(api.deleteEventByClientId).toHaveBeenCalledWith('remembered-doc', 'ev-1');
    expect(api.patchSession).toHaveBeenCalledWith('remembered-doc', expect.objectContaining({ notes: 'de pe al doilea telefon' }));
  });

  it('resolveSessionDocumentId returns null once the mapping is forgotten (sign-out)', async () => {
    rememberSessionDocumentId('other-session', 'remembered-doc');
    expect(await repo.resolveSessionDocumentId('other-session')).toBe('remembered-doc');
    forgetSessionDocumentIds();
    expect(await repo.resolveSessionDocumentId('other-session')).toBeNull();
  });

  it('deleteCatch DELETEs the event by clientId instead of writing Firestore', async () => {
    await repo.deleteCatch('sess-c-1', 'ev-1');
    expect(api.deleteEventByClientId).toHaveBeenCalledWith('sess-doc-1', 'ev-1');
    expect(fs.deleteDoc).not.toHaveBeenCalled();
  });

  it('updateMeta PATCHes the session instead of writing Firestore', async () => {
    await repo.updateMeta('sess-c-1', { notes: 'vant slab' });
    expect(api.patchSession).toHaveBeenCalledWith('sess-doc-1', expect.objectContaining({ notes: 'vant slab' }));
    expect(fs.updateDoc).not.toHaveBeenCalled();
  });

  it('updateMeta forwards a re-anchor patch (anchorLat/anchorLng/anchorName/standId) to patchSession', async () => {
    await repo.updateMeta('sess-c-1', { anchorLat: 44.9, anchorLng: 26.5, anchorName: 'Nou reper', standId: 'stand-doc-2' });
    expect(api.patchSession).toHaveBeenCalledWith(
      'sess-doc-1',
      expect.objectContaining({ anchorLat: 44.9, anchorLong: 26.5, anchorName: 'Nou reper', standId: 'stand-doc-2' })
    );
  });

  it('updateMeta routes a rods patch to the rods endpoint and feeds the server clock from its serverNow', async () => {
    api.patchRods.mockResolvedValue({ rods: [], serverNow: '2026-07-25T00:00:30.000Z' });
    await repo.updateMeta('sess-c-1', { rods: [{ ...rod, index: 1 }], rodRuntimes: [{ phase: 'fishing', endEpoch: null }] });
    expect(api.patchRods).toHaveBeenCalledWith('sess-doc-1', expect.any(Array));
    expect(noteServerNow).toHaveBeenCalledWith('2026-07-25T00:00:30.000Z');
  });

  it('updateMeta with BOTH rods and other meta fires both calls; ONLY rods skips patchSession', async () => {
    await repo.updateMeta('sess-c-1', { notes: 'both', rods: [{ ...rod, index: 1 }], rodRuntimes: [{ phase: 'idle', endEpoch: null }] });
    expect(api.patchRods).toHaveBeenCalledTimes(1);
    expect(api.patchSession).toHaveBeenCalledWith('sess-doc-1', expect.objectContaining({ notes: 'both' }));

    api.patchSession.mockClear();
    await repo.updateMeta('sess-c-1', { rods: [{ ...rod, index: 1 }], rodRuntimes: [{ phase: 'idle', endEpoch: null }] });
    expect(api.patchSession).not.toHaveBeenCalled();
  });

  /**
   * I3 (fix round 2) — spec §1 defect 4 ("A starting rod 2's timer clobbers B's
   * edit to rod 3") is only fixed end-to-end if the CLIENT sends the rod it changed.
   */
  describe('updateMeta rods narrowing', () => {
    const rods: LocalRod[] = [{ ...rod, index: 1, label: 'L1' }, { ...rod, index: 2 }, { ...rod, index: 3, label: 'L3' }];
    const runtimes: RodRuntime[] = [
      { phase: 'fishing', endEpoch: 1 },
      { phase: 'idle', endEpoch: null },
      { phase: 'idle', endEpoch: null },
    ];
    const sentRods = () => api.patchRods.mock.calls[0][1] as { index: number; runtimePhase: string }[];

    it('sends ONLY the named rod when the caller knows which one it changed', async () => {
      await repo.updateMeta('sess-c-1', { rods, rodRuntimes: runtimes, changedRodIndex: 2 });
      expect(api.patchRods).toHaveBeenCalledTimes(1);
      expect(api.patchRods.mock.calls[0][0]).toBe('sess-doc-1');
      expect(sentRods().map(r => r.index)).toEqual([2]);
    });

    it('pairs the narrowed rod with ITS OWN runtime, not the array head', async () => {
      await repo.updateMeta('sess-c-1', { rods, rodRuntimes: runtimes, changedRodIndex: 2 });
      expect(sentRods()[0]).toMatchObject({ index: 2, runtimePhase: 'idle', runtimeEndsAt: null });
      api.patchRods.mockClear();
      await repo.updateMeta('sess-c-1', { rods, rodRuntimes: runtimes, changedRodIndex: 1 });
      expect(sentRods()[0]).toMatchObject({ index: 1, runtimePhase: 'fishing' });
    });

    it('still sends every rod when the caller genuinely changed them all', async () => {
      await repo.updateMeta('sess-c-1', { rods, rodRuntimes: runtimes });
      expect(sentRods().map(r => r.index)).toEqual([1, 2, 3]);
    });

    it('falls back to the full array rather than dropping the write on an unknown index', async () => {
      await repo.updateMeta('sess-c-1', { rods, rodRuntimes: runtimes, changedRodIndex: 99 });
      expect(sentRods().map(r => r.index)).toEqual([1, 2, 3]);
    });

    it('a configOnly write carries no runtime keys', async () => {
      await repo.updateMeta('sess-c-1', { rods, configOnly: true, changedRodIndex: 2 });
      expect('runtimePhase' in sentRods()[0]).toBe(false);
    });

    it('never leaks changedRodIndex into the session meta PATCH', async () => {
      await repo.updateMeta('sess-c-1', { rods, rodRuntimes: runtimes, changedRodIndex: 2, notes: 'vant slab' });
      expect(api.patchSession).toHaveBeenCalledWith('sess-doc-1', { notes: 'vant slab' });
    });
  });
});

describe('writes (Firestore — markers, parked)', () => {
  it('writeMarker → sessions/<id>/markers/<clientId> on the (default) database, with flattened venue', async () => {
    await writeMarker(ctx, 'sess-1', marker);
    const [ref, data] = fs.setDoc.mock.calls[0] as unknown as [{ path: string; db: unknown }, Record<string, unknown>];
    expect(ref.path).toBe('sessions/sess-1/markers/mk-9');
    expect(ref.db).toBe(DEFAULT_DB);
    expect(data.venueType).toBe('lake');
    expect(data.publicWaterCode).toBeNull();
    expect(typeof data.clientUpdatedAt).toBe('string');
  });

  it('deleteMarker targets the right doc path', async () => {
    await deleteMarker(ctx, 'sess-1', 'mk-9');
    expect((fs.deleteDoc.mock.calls[0][0] as unknown as { path: string }).path).toBe('sessions/sess-1/markers/mk-9');
  });
});

describe('subscribeSession', () => {
  const projection = (over: Record<string, unknown> = {}) => ({ venueType: 'lake', rods: [], catches: [], markers: [], ...over });
  const snap = (data: Record<string, unknown> | undefined, metadata?: { fromCache: boolean }) => ({ data: () => data, metadata });

  it('listens with metadata changes and tells the caller whether the snapshot came from the offline cache', () => {
    const onData = vi.fn();
    subscribeSession(ctx, 'sess-1', onData, vi.fn());
    const [listener] = fs.on('sessions/sess-1');
    expect(listener.options).toEqual({ includeMetadataChanges: true });
    expect(listener.ref.db).toBe(DEFAULT_DB);
    listener.next(snap(projection(), { fromCache: true }));
    listener.next(snap(projection(), { fromCache: false }));
    listener.next(snap(projection()));
    expect(onData.mock.calls.map(c => c[1])).toEqual([{ fromCache: true }, { fromCache: false }, { fromCache: false }]);
  });

  it('subscribes to ONE doc and assembles meta + catches from it', () => {
    const onData = vi.fn();
    subscribeSession(ctx, 'sess-1', onData, vi.fn());
    expect(fs.listeners).toHaveLength(1);
    fs.on('sessions/sess-1')[0].next(
      snap(
        projection({
          lakeId: 'lake-1',
          lakeName: 'Balta',
          startedAt: '2026-07-25T05:00:00.000Z',
          targetSpecies: [],
          members: [],
          memberUids: [],
          status: 'active',
          catches: [{ clientId: 'ev-1', outcome: 'capture', occurredAt: '2026-07-25T07:00:00.000Z' }],
          rev: 3,
          serverNow: '2026-07-25T08:00:00.000Z',
        })
      )
    );
    expect(onData).toHaveBeenCalledWith(
      expect.objectContaining({
        session: expect.objectContaining({ clientId: 'sess-1', lakeName: 'Balta', projectionRev: 3 }),
        events: [expect.objectContaining({ clientId: 'ev-1' })],
        markers: [],
      }),
      { fromCache: false }
    );
  });

  // REGRESSION: the projection's `serverNow` is stamped when the CMS BUILT the
  // document, not when the snapshot arrives. Rod phases must derive from the caller's
  // live server clock, never from the stored field.
  it('derives rod phases from the injected server clock, NOT the stored snapshot serverNow field', () => {
    const onData = vi.fn();
    const endsAt = Date.parse('2026-07-25T09:00:00.000Z');
    subscribeSession(ctx, 'sess-1', onData, vi.fn(), () => endsAt + 1000);
    fs.on('sessions/sess-1')[0].next(
      snap(
        projection({
          startedAt: '2026-07-25T05:00:00.000Z',
          // A projection built long before the deadline and untouched since.
          serverNow: '2026-07-25T08:00:00.000Z',
          rods: [{ clientId: 'rod-1', index: 1, runtimePhase: 'fishing', runtimeEndsAt: new Date(endsAt).toISOString() }],
        })
      )
    );
    expect(onData.mock.calls[0][0].session.rodRuntimes[0]).toEqual({ phase: 'firing', endEpoch: endsAt });
  });

  it('ignores a snapshot with no data instead of emitting an empty session', () => {
    const onData = vi.fn();
    subscribeSession(ctx, 'sess-1', onData, vi.fn());
    fs.on('sessions/sess-1')[0].next(snap(undefined));
    expect(onData).not.toHaveBeenCalled();
  });

  it('returns an unsubscribe that detaches the single listener', () => {
    const unsubscribe = subscribeSession(ctx, 'sess-1', vi.fn(), vi.fn());
    unsubscribe();
    expect(fs.on('sessions/sess-1')[0].unsub).toHaveBeenCalledTimes(1);
  });

  it('forwards listener errors to onError', () => {
    const onError = vi.fn();
    subscribeSession(ctx, 'sess-1', vi.fn(), onError);
    const boom = Object.assign(new Error('denied'), { code: 'permission-denied' });
    fs.on('sessions/sess-1')[0].error?.(boom);
    expect(onError).toHaveBeenCalledWith(boom);
  });
});
