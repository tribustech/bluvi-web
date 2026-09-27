import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { createFakeTransport } from '@/tests/transport';
import { ApiError, type TransportRequest } from '../transport';
import * as api from './api';
import {
  applySessionFollow,
  COMMUNITY_PURGE_GRACE_MS,
  deletePartidaMutation,
  finishPartidaMutation,
  followSessionMutation,
  invalidateCommunityAfterCatch,
  invalidateMembershipCaches,
  joinPartidaMutation,
  kickPartidaMemberMutation,
  leavePartidaMutation,
  refetchCommunitySessionOnFocus,
  rollbackSessionFollows,
  rotatePartidaJoinCodeMutation,
} from './mutations';
import {
  communityActiveInfiniteQuery,
  communityHistoryInfiniteQuery,
  communityKeys,
  communityOverviewQuery,
  communitySessionQuery,
  communityStatsQuery,
  communityVenueCatchesInfiniteQuery,
  communityVenueSectionQuery,
  followedAnglerUidsQuery,
  myCatchesInfiniteQuery,
  partidaDetailQuery,
  partideHistoryQuery,
  partideKeys,
  sessionCatchesInfiniteQuery,
  sessionFollowsQuery,
} from './queries';
import { communityVenueKey } from './domain/venueKeys';
import type { SessionListItemDTO } from './schemas';

// ── fixtures (shapes copied from the local CMS) ─────────────────────────────

const listItem = (clientId: string): SessionListItemDTO => ({
  documentId: `doc-${clientId}`,
  clientId,
  clientUpdatedAt: null,
  venueType: 'lake',
  lakeId: 's84u55lo4n9z0emngozttt6e',
  lakeName: 'Chita Lake',
  lakeImageUrl: null,
  publicWaterCode: null,
  publicWaterName: null,
  manualVenueName: null,
  standId: null,
  standName: null,
  locality: 'Giurgiu',
  anchorLat: 44.1,
  anchorLong: 26.1,
  anchorName: null,
  startedAt: '2026-09-22T07:24:13.212Z',
  endedAt: '2026-09-23T19:30:00.375Z',
  plannedDurationMs: 3_600_000,
  notes: null,
  visibleOnProfile: true,
  status: 'finished',
  targetSpecies: [{ documentId: 'f1', name: 'Crap' }],
  hostUid: 'u1',
  captures: 1,
  recordKg: 3,
  totalKg: 3,
});

const member = { uid: 'u1', name: 'Andrew', avatar: null, joinedAt: '2026-09-22T07:24:13.212Z' };
const sessionDTO = { ...listItem('c1'), joinCode: 'ABC123', members: [member], rods: [] };
const eventDTO = {
  id: 7,
  documentId: 'ev1',
  clientId: 'e1',
  clientUpdatedAt: null,
  outcome: 'capture',
  rodIndex: null,
  rodLabel: null,
  rodColor: null,
  bait: null,
  baitType: null,
  baitSize: null,
  baitFlavor: null,
  lane: null,
  distance: null,
  lat: null,
  lng: null,
  weightKg: 3,
  weightEstimated: false,
  species: 'Koi',
  speciesId: null,
  photoUrl: null,
  photoThumbUrl: null,
  notes: null,
  occurredAt: '2026-09-22T08:00:00.000Z',
  photoTagUids: [],
};
const marker = {
  documentId: 'm1',
  clientId: 'mc1',
  clientUpdatedAt: null,
  type: 'snag',
  lat: 44,
  lng: 26,
  label: null,
  scope: 'anchor',
  venueType: 'lake',
  lakeId: 'L',
  publicWaterCode: null,
  sessionId: null,
};
const angler = { uid: 'u1', name: 'Andrew', avatarUrl: null };
const catchRow = {
  clientId: 'e2e-Aev-1',
  species: 'Somn',
  weightKg: 30.2,
  photoUrl: 'https://x/p.png',
  photoGridUrl: 'https://x/p.png',
  photoThumbUrl: 'https://x/p.png',
  width: 1,
  height: 1,
  occurredAt: '2026-09-07T08:52:10.000Z',
};
const sessionDetail = {
  documentId: 'qca4',
  startedAt: '2026-09-07T08:52:08.000Z',
  endedAt: '2026-09-07T09:05:13.692Z',
  venueName: 'Balta Luica Waterland',
  venueType: 'lake',
  publicWaterCode: null,
  locality: null,
  lakeId: 'fg1m',
  imageUrl: 'https://x/p.png',
  venueImageUrl: 'https://x/v.jpg',
  members: [angler],
  catchCount: 1,
  maxKg: 30.2,
  durationMs: 785692,
  catches: [catchRow],
  hasMoreCatches: false,
  photos: [catchRow],
  weighedCatches: [{ t: '2026-09-07T11:52:10.000Z', kg: 30.2, species: 'Somn' }],
  maxCatch: catchRow,
  photoCount: 1,
  anglerStats: { partide: 3, followers: 1 },
};
const historyRow = {
  documentId: 'yzea',
  startedAt: '2026-09-22T07:24:13.212Z',
  endedAt: '2026-09-23T19:30:00.375Z',
  members: [angler],
  venue: { key: 'lake:s84u', venueType: 'lake', lakeId: 's84u', name: 'Chita Lake', locality: 'Giurgiu', imageUrl: null },
  catchCount: 0,
  maxKg: null,
  totalKg: null,
  photoUrl: null,
  standName: null,
  photos: [],
  photoCount: 0,
};
const pagination = (page: number, pageCount: number) => ({ pagination: { page, pageSize: 10, pageCount, total: pageCount * 10 } });
const cursorMeta = (nextCursor: string | null) => ({ pagination: { pageSize: 20, total: 1 }, nextCursor });
const statsDTO = {
  period: 'year',
  totals: { partide: 1, anglers: 1, catches: 1, totalKg: 1 },
  weeklySeries: [{ label: 'IAN', count: 1 }],
  topAnglers: [{ ...angler, partide: 1, catches: 1, totalKg: 1 }],
  topVenues: [{ key: 'water:AG-08', name: 'Arges', locality: null, lakeId: null, imageUrl: null, partide: 1, catches: 1, liveCount: 0 }],
  record: null,
  species: [{ name: 'Crap', count: 1, pct: 100 }],
  stands: [],
};
const lakeSection = {
  stats: { activeNow: 0, catchesThisMonth: 0, recordKg: 3 },
  activeSessions: [],
  monthlyActivity: [{ month: 'SEP', count: 0 }],
};

// ── api ─────────────────────────────────────────────────────────────────────

describe('partide api — sessions', () => {
  it('lists my sessions with the non-standard meta and rejects a { data: null } body', async () => {
    const body = { data: [listItem('a')], meta: { page: 1, pageSize: 50, total: 1 } };
    const { transport, calls } = createFakeTransport([body, { data: null, meta: { page: 1, pageSize: 50, total: 0 } }]);
    await expect(api.getMySessions(transport)).resolves.toEqual(body);
    expect(calls[0]).toMatchObject({ method: 'GET', path: '/feed/sessions/mine', query: { page: 1, pageSize: 50 }, auth: 'required' });
    await expect(api.getMySessions(transport)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });

  // fish services/api/__tests__/partide.getAll.test.ts
  describe('getAllMySessions', () => {
    const page = (rows: SessionListItemDTO[], total: number, pageNo = 1, pageSize = 100) => ({
      data: rows,
      meta: { page: pageNo, pageSize, total },
    });
    const mk = (start: number, count: number) => Array.from({ length: count }, (_, i) => listItem(`r${start + i}`));

    it('single short page → 1 request', async () => {
      const { transport, calls } = createFakeTransport([page(mk(0, 3), 3)]);
      const res = await api.getAllMySessions(transport);
      expect(calls).toHaveLength(1);
      expect(res.total).toBe(3);
      expect(res.data.map(r => r.clientId)).toEqual(['r0', 'r1', 'r2']);
    });

    it('a full page then an empty page → 2 requests', async () => {
      const { transport, calls } = createFakeTransport([page(mk(0, 2), 99, 1, 2), page([], 99, 2, 2)]);
      const res = await api.getAllMySessions(transport, 2);
      expect(calls).toHaveLength(2);
      expect(res.data).toHaveLength(2);
    });

    it('250 rows at pageSize 100 → 3 requests, in order', async () => {
      const { transport, calls } = createFakeTransport([page(mk(0, 100), 250, 1), page(mk(100, 100), 250, 2), page(mk(200, 50), 250, 3)]);
      const res = await api.getAllMySessions(transport, 100);
      expect(calls.map(c => c.query?.page)).toEqual([1, 2, 3]);
      expect(res.data.map(r => r.clientId)).toEqual(Array.from({ length: 250 }, (_, i) => `r${i}`));
    });

    it('runaway guard: always-full pages still terminate via length >= total', async () => {
      const { transport, calls } = createFakeTransport(() => page(mk(0, 100), 250));
      const res = await api.getAllMySessions(transport, 100);
      expect(calls).toHaveLength(3);
      expect(res.total).toBe(250);
    });

    it('propagates a rejected page', async () => {
      let n = 0;
      const transport = {
        request: async () => {
          n += 1;
          if (n === 2) throw new Error('network down');
          return { data: page(mk(0, 2), 99, 1, 2), status: 200, headers: new Headers() } as never;
        },
      };
      await expect(api.getAllMySessions(transport, 2)).rejects.toThrow('network down');
    });
  });

  it('reads a session detail with events and defaults legacy-missing event fields', async () => {
    const { weightEstimated: _w, photoTagUids: _p, ...legacyEvent } = eventDTO;
    void _w;
    void _p;
    const { transport, calls } = createFakeTransport([{ data: { ...sessionDTO, events: [legacyEvent] } }]);
    const res = await api.getSession(transport, 'doc-c1');
    expect(calls[0]).toMatchObject({ method: 'GET', path: '/feed/sessions/doc-c1', auth: 'required' });
    expect(res.events[0]).toMatchObject({ weightEstimated: false, photoTagUids: [] });
  });

  it('writes events and markers inside the { data } envelope', async () => {
    const { transport, calls } = createFakeTransport([{ data: eventDTO }, null, { data: marker }, { data: [marker] }, null, null, null]);
    await expect(api.upsertEvent(transport, 's1', { clientId: 'e1' } as never)).resolves.toMatchObject({ documentId: 'ev1' });
    await api.deleteEvent(transport, 's1', 'ev1');
    await expect(api.upsertMarker(transport, { clientId: 'mc1' })).resolves.toMatchObject({ documentId: 'm1' });
    await expect(api.getMarkers(transport, { lakeId: 'L' })).resolves.toHaveLength(1);
    await api.deleteMarker(transport, 'm1');
    await api.deleteEventByClientId(transport, 's1', 'e1');
    await api.patchSession(transport, 's1', { notes: 'x' });
    expect(calls.map(c => [c.method, c.path])).toEqual([
      ['POST', '/feed/sessions/s1/events'],
      ['DELETE', '/feed/sessions/s1/events/ev1'],
      ['POST', '/feed/map-markers'],
      ['GET', '/feed/map-markers'],
      ['DELETE', '/feed/map-markers/m1'],
      ['DELETE', '/feed/sessions/s1/events/by-client/e1'],
      ['PATCH', '/feed/sessions/s1'],
    ]);
    expect(calls[0].body).toEqual({ data: { clientId: 'e1' } });
    expect(calls[3].query).toEqual({ lakeId: 'L' });
    expect(calls[6].body).toEqual({ data: { notes: 'x' } });
    expect(calls.every(c => c.auth === 'required')).toBe(true);
  });

  it('runs the co-op control plane', async () => {
    const createJoin = { ...sessionDTO, firestoreId: 'c1' };
    const { transport, calls } = createFakeTransport([
      { data: createJoin },
      { data: { documentId: 'doc-c1', clientId: 'c1', firestoreId: 'c1' } },
      { data: null },
      { data: createJoin },
      { data: { ...sessionDTO, events: [] } },
      null,
      null,
      { data: { rods: [], serverNow: '2026-09-27T00:00:00Z' } },
    ]);
    await expect(api.createSession(transport, { clientId: 'c1' } as never)).resolves.toMatchObject({ firestoreId: 'c1' });
    await expect(api.getActiveSession(transport)).resolves.toEqual({ documentId: 'doc-c1', clientId: 'c1', firestoreId: 'c1' });
    await expect(api.getActiveSession(transport)).resolves.toBeNull();
    await api.joinSession(transport, 'ABC123');
    await api.finishSession(transport, 'doc-c1');
    await api.extendSession(transport, 'doc-c1');
    await api.deleteSession(transport, 'doc c1');
    await api.patchRods(transport, 'doc-c1', [{ index: 1 }]);
    expect(calls.map(c => [c.method, c.path])).toEqual([
      ['POST', '/feed/sessions'],
      ['GET', '/feed/sessions/active'],
      ['GET', '/feed/sessions/active'],
      ['POST', '/feed/sessions/join'],
      ['POST', '/feed/sessions/doc-c1/finish'],
      ['POST', '/feed/sessions/doc-c1/extend'],
      ['DELETE', '/feed/sessions/doc%20c1'],
      ['PATCH', '/feed/sessions/doc-c1/rods'],
    ]);
    expect(calls[3].body).toEqual({ data: { code: 'ABC123' } });
    expect(calls[7].body).toEqual({ data: { rods: [{ index: 1 }] } });
  });

  // fish services/api/__tests__/partide.membership.test.ts
  it('membership endpoints encode ids and unwrap the feed envelope', async () => {
    const data = { removed: true, joinCode: 'JOIN42', members: [member], hostUid: 'u1', projectionRev: 6 };
    const { transport, calls } = createFakeTransport([
      { data: { removed: true } },
      { data },
      { data: { joinCode: 'ROTATED', projectionRev: 7 } },
    ]);
    await expect(api.leaveSession(transport, 'session/a b')).resolves.toEqual({ removed: true });
    await expect(api.kickSessionMember(transport, 'session/a b', 'user/a b')).resolves.toEqual(data);
    await expect(api.rotateSessionJoinCode(transport, 'session/a b')).resolves.toEqual({ joinCode: 'ROTATED', projectionRev: 7 });
    expect(calls.map(c => [c.method, c.path])).toEqual([
      ['POST', '/feed/sessions/session%2Fa%20b/leave'],
      ['DELETE', '/feed/sessions/session%2Fa%20b/members/user%2Fa%20b'],
      ['POST', '/feed/sessions/session%2Fa%20b/join-code/rotate'],
    ]);
  });

  // fish services/api/__tests__/partide.photo.test.ts
  it('uploads a photo as multipart and coerces a missing thumbUrl to null', async () => {
    const { transport, calls } = createFakeTransport([
      { fileId: 42, url: 'https://cdn/full.jpg', thumbUrl: 'https://cdn/thumb.jpg' },
      { fileId: 7, url: 'https://cdn/full.jpg' },
    ]);
    const file = new Blob(['x'], { type: 'image/jpeg' });
    await expect(api.uploadSessionPhoto(transport, file)).resolves.toEqual({ fileId: 42, url: 'https://cdn/full.jpg', thumbUrl: 'https://cdn/thumb.jpg' });
    expect(calls[0]).toMatchObject({ method: 'POST', path: '/feed/sessions/photo', auth: 'required' });
    expect(calls[0].body).toBeInstanceOf(FormData);
    expect((calls[0].body as FormData).get('files')).toBeInstanceOf(Blob);
    await expect(api.uploadSessionPhoto(transport, file)).resolves.toEqual({ fileId: 7, url: 'https://cdn/full.jpg', thumbUrl: null });
  });

  it('patches only the photo or only the tags of an event', async () => {
    const { transport, calls } = createFakeTransport([null, null]);
    await api.patchEventPhoto(transport, 's1', 'ev1', 42);
    await api.patchEventTags(transport, 's1', 'ev1', ['u1']);
    expect(calls[0]).toMatchObject({ method: 'PATCH', path: '/feed/sessions/s1/events/ev1', body: { data: { photo: 42 } } });
    expect(calls[1].body).toEqual({ data: { photoTagUids: ['u1'] } });
  });

  it('rod commands fall back (null) on 403/404/405 and remember it per session', async () => {
    const memo = api.createRodCommandAvailability();
    const reply = { rod: { index: 1, runtimeEndsAt: '2026-09-27T00:30:00Z' }, serverNow: '2026-09-27T00:00:00Z', applied: true };
    const calls: TransportRequest[] = [];
    const transport = {
      request: async (req: TransportRequest) => {
        calls.push(req);
        if (req.path.startsWith('/feed/sessions/old/')) throw new ApiError({ message: 'x', status: 403, code: 'HTTP' });
        if (req.path.startsWith('/feed/sessions/boom/')) throw new ApiError({ message: 'x', status: 500, code: 'HTTP' });
        return { data: { data: reply }, status: 200, headers: new Headers() } as never;
      },
    };
    await expect(api.castRod(transport, memo, 's1', 1, { expectEndsAt: null })).resolves.toEqual(reply);
    expect(calls[0]).toMatchObject({ method: 'POST', path: '/feed/sessions/s1/rods/1/cast', body: { data: { expectEndsAt: null } } });
    await expect(api.stopRod(transport, memo, 'old', 1)).resolves.toBeNull();
    expect(api.rodCommandsUnavailable(memo, 'old')).toBe(true);
    await expect(api.castRod(transport, memo, 'old', 1, { expectEndsAt: null })).resolves.toBeNull();
    expect(calls).toHaveLength(2); // memo short-circuits the second probe
    await expect(api.stopRod(transport, memo, 'boom', 1)).rejects.toMatchObject({ status: 500 });
  });

  it('reads my catches (cursor) and my session follows', async () => {
    const page = {
      data: [{ key: 'k', source: 'partida', photoUrl: 'u', weightKg: null, species: null, venueName: null, date: 'd', competitionName: null, competitionDocumentId: null }],
      meta: cursorMeta('c2'),
    };
    const { transport, calls } = createFakeTransport([page, page, { data: { sessionDocumentIds: ['a'] } }, null, null]);
    await api.getMyCatches(transport, { pageSize: 20 });
    await api.getMyCatches(transport, { pageSize: 20, cursor: 'c1' });
    await expect(api.getMySessionFollows(transport)).resolves.toEqual(['a']);
    await api.followSession(transport, 's1');
    await api.unfollowSession(transport, 's1');
    expect(calls[0]).toMatchObject({ path: '/feed/sessions/mine/catches', query: { pageSize: 20 }, auth: 'required' });
    expect(calls[1].query).toEqual({ pageSize: 20, cursor: 'c1' });
    expect(calls.slice(2).map(c => [c.method, c.path])).toEqual([
      ['GET', '/feed/session-follows/mine'],
      ['POST', '/feed/sessions/s1/follow'],
      ['POST', '/feed/sessions/s1/unfollow'],
    ]);
  });

  it('formats text', async () => {
    const { transport, calls } = createFakeTransport([{ data: { formatted: 'Salut' } }]);
    await expect(api.formatText(transport, 'salut')).resolves.toBe('Salut');
    expect(calls[0]).toMatchObject({ method: 'POST', path: '/ai/format-text', body: { text: 'salut' }, auth: 'required' });
  });
});

describe('partide api — community', () => {
  it('reads the overview, stats and session detail as public data', async () => {
    const overview = { latestCatches: [], activeVenues: [], records: [], popularVenues: [] };
    const { transport, calls } = createFakeTransport([{ data: overview }, { data: statsDTO }, { data: statsDTO }, { data: sessionDetail }]);
    await expect(api.getCommunityOverview(transport)).resolves.toEqual(overview);
    await api.getCommunityStats(transport, 'year');
    await api.getCommunityStats(transport, 'week', { kind: 'lake', id: 'abc' });
    await expect(api.getCommunitySession(transport, 'qca4')).resolves.toMatchObject({ documentId: 'qca4', photoCount: 1 });
    expect(calls[1]).toMatchObject({ path: '/feed/community/stats', query: { period: 'year' }, auth: 'none' });
    expect(calls[2].query).toEqual({ period: 'week', venue: 'lake:abc' });
    expect(calls[3].path).toBe('/feed/community/sessions/qca4');
    expect(calls.every(c => c.auth === 'none')).toBe(true);
  });

  it('serialises venues as repeated params on active and history', async () => {
    const active = { data: [], meta: cursorMeta(null) };
    const { transport, calls } = createFakeTransport([active, active, { data: [historyRow], meta: pagination(1, 3) }]);
    await api.getCommunityActive(transport, { pageSize: 10 });
    await api.getCommunityActive(transport, { pageSize: 10, cursor: 'c:1', venues: ['lake:a', 'water:L:RO'] });
    await api.getCommunityHistory(transport, { page: 2, pageSize: 10, venues: ['lake:a', 'lake:b'] });
    expect(calls[0].path).toBe('/feed/community/active?pageSize=10');
    expect(calls[1].path).toBe('/feed/community/active?pageSize=10&cursor=c%3A1&venue=lake%3Aa&venue=water%3AL%3ARO');
    expect(calls[2].path).toBe('/feed/community/history?page=2&pageSize=10&venue=lake%3Aa&venue=lake%3Ab');
  });

  it('tolerates an active body without the cursor envelope (pre-deploy edge cache)', async () => {
    const { transport } = createFakeTransport([{ data: [] }]);
    await expect(api.getCommunityActive(transport, { pageSize: 10 })).resolves.toEqual({ data: [] });
  });

  // fish services/api/__tests__/community.test.ts
  it('uses the lake section endpoint for a normal document id and encodes a raw water code', async () => {
    const { transport, calls } = createFakeTransport([{ data: lakeSection }, { data: lakeSection }]);
    await expect(api.getCommunityVenueSection(transport, { kind: 'lake', id: 'lake-doc-1' })).resolves.toEqual(lakeSection);
    await api.getCommunityVenueSection(transport, { kind: 'water', code: 'L:RO10_01.025_L1' });
    expect(calls[0].path).toBe('/feed/community/lakes/lake-doc-1');
    expect(calls[1].path).toBe('/feed/community/waters/L%3ARO10_01.025_L1');
  });

  it('uses the venue catches endpoint with unchanged pagination params', async () => {
    const payload = { data: [], meta: { pagination: { page: 2, pageSize: 20, pageCount: 2, total: 21 } } };
    const { transport, calls } = createFakeTransport([payload]);
    await expect(api.getCommunityVenueCatches(transport, { kind: 'water', code: 'L:RO10_01.025_L1' }, { page: 2, pageSize: 20 })).resolves.toEqual(payload);
    expect(calls[0]).toMatchObject({ path: '/feed/community/waters/L%3ARO10_01.025_L1/catches', query: { page: 2, pageSize: 20 } });
  });

  it('builds a canonical key that includes the venue kind', () => {
    expect(communityVenueKey({ kind: 'lake', id: 'abc' })).toBe('lake:abc');
    expect(communityVenueKey({ kind: 'water', code: 'abc' })).toBe('water:abc');
  });

  it('pages session catches by cursor with photos=1', async () => {
    const page = { data: [catchRow], meta: cursorMeta(null) };
    const { transport, calls } = createFakeTransport([page, page]);
    await api.getSessionCatches(transport, 'qca4', {});
    await api.getSessionCatches(transport, 'qca4', { cursor: 'x', pageSize: 5, photosOnly: true });
    expect(calls[0]).toMatchObject({ path: '/feed/community/sessions/qca4/catches', query: { pageSize: 20 } });
    expect(calls[1].query).toEqual({ pageSize: 5, cursor: 'x', photos: 1 });
  });

  it('walks every following page for the prieteni set', async () => {
    const following = (documentId: string) => ({ documentId, username: documentId, avatarUrl: null, isFollowedByMe: true });
    const { transport, calls } = createFakeTransport([
      { data: [following('a')], meta: { pagination: { page: 1, pageSize: 100, pageCount: 2, total: 2 } } },
      { data: [following('b')], meta: { pagination: { page: 2, pageSize: 100, pageCount: 2, total: 2 } } },
    ]);
    await expect(api.fetchAllFollowingUids(transport, 'me')).resolves.toEqual(new Set(['a', 'b']));
    expect(calls.map(c => [c.path, c.query?.page, c.auth])).toEqual([
      ['/feed/anglers/me/following', 1, 'required'],
      ['/feed/anglers/me/following', 2, 'required'],
    ]);
  });
});

// ── queries ─────────────────────────────────────────────────────────────────

describe('partide queries', () => {
  const { transport } = createFakeTransport();

  it('keeps the fish key shapes', () => {
    expect(partideKeys.mine).toEqual(['partide', 'mine']);
    expect(partideKeys.myCatches).toEqual(['partide', 'mine', 'catches']);
    expect(partideKeys.detail('d')).toEqual(['partide', 'detail', 'd']);
    expect(partideKeys.markers('lake:x')).toEqual(['partide', 'markers', 'lake:x']);
    expect(communityKeys.stats('month')).toEqual(['community', 'stats', 'month', '']);
    expect(communityKeys.sessionFollows).toEqual(['community', 'session-follows']);
    expect(partideHistoryQuery(transport).queryKey).toEqual(['partide', 'mine']);
    expect(partideHistoryQuery(transport).staleTime).toBe(300_000);
    expect(partidaDetailQuery(transport, '').enabled).toBe(false);
    expect(myCatchesInfiniteQuery(transport).queryKey).toEqual(['partide', 'mine', 'catches']);
    expect(communityOverviewQuery(transport)).toMatchObject({ queryKey: ['community', 'overview'], staleTime: 30_000, refetchInterval: 60_000, retry: false });
    expect(sessionFollowsQuery(transport, false).enabled).toBe(false);
    expect(followedAnglerUidsQuery(transport, null)).toMatchObject({ queryKey: ['community', 'followed-angler-uids', 'none'], enabled: false });
  });

  it('keys venue selections sorted, so order does not split the cache', () => {
    expect(communityActiveInfiniteQuery(transport, ['b', 'a']).queryKey).toEqual(['community', 'active', 'a|b']);
    expect(communityHistoryInfiniteQuery(transport, []).queryKey).toEqual(['community', 'history', 'all']);
  });

  // fish community/__tests__/hooks.stats.test.tsx
  it('keys stats per venue and shortens staleTime on a venue page', () => {
    expect(communityStatsQuery(transport, 'week').queryKey).toEqual(['community', 'stats', 'week', '']);
    expect(communityStatsQuery(transport, 'week').staleTime).toBe(120_000);
    const lake = communityStatsQuery(transport, 'week', { kind: 'lake', id: 'L' });
    expect(lake.queryKey).toEqual(['community', 'stats', 'week', 'lake:L']);
    expect(lake.staleTime).toBe(60_000);
    const keep = lake.placeholderData as (prev: unknown) => unknown;
    expect(keep('prev')).toBe('prev');
  });

  // fish community/__tests__/hooks.venue.test.tsx
  it('keeps the null-venue key separate from real venues and disabled', () => {
    expect(communityVenueSectionQuery(transport, null)).toMatchObject({ queryKey: ['community', 'venue', 'none'], enabled: false });
    expect(communityVenueSectionQuery(transport, { kind: 'water', code: 'X' })).toMatchObject({
      queryKey: ['community', 'venue', 'water:X'],
      staleTime: 30_000,
      refetchInterval: 60_000,
      enabled: true,
    });
    const catches = communityVenueCatchesInfiniteQuery(transport, { kind: 'lake', id: 'L' });
    expect(catches.queryKey).toEqual(['community', 'venue', 'lake:L', 'catches']);
    const last = { data: [], meta: pagination(2, 2) };
    expect(catches.getNextPageParam({ data: [], meta: pagination(1, 2) }, [], 1, [1])).toBe(2);
    expect(catches.getNextPageParam(last, [], 2, [2])).toBeUndefined();
  });

  // fish community/__tests__/hooks.session.test.tsx
  it('polls a live community session and stops once it has ended', () => {
    const q = communitySessionQuery(transport, 'qca4');
    expect(q).toMatchObject({ refetchOnWindowFocus: true, refetchOnReconnect: true, staleTime: 30_000 });
    const interval = q.refetchInterval as (query: { state: { data?: { endedAt: string | null } } }) => number | false;
    expect(interval({ state: { data: { endedAt: null } } })).toBe(60_000);
    expect(interval({ state: { data: { endedAt: 'x' } } })).toBe(false);
    expect(interval({ state: {} })).toBe(false);
  });

  it('caches plain and photo-only session catches separately and pages by cursor', () => {
    const all = sessionCatchesInfiniteQuery(transport, 'd');
    const photos = sessionCatchesInfiniteQuery(transport, 'd', { photosOnly: true });
    expect(all.queryKey).toEqual(['community', 'session', 'd', 'catches', 'all']);
    expect(photos.queryKey).toEqual(['community', 'session', 'd', 'catches', 'photos']);
    expect(all.getNextPageParam({ data: [], meta: cursorMeta('n') }, [], null, [null])).toBe('n');
    expect(all.getNextPageParam({ data: [], meta: cursorMeta(null) }, [], null, [null])).toBeUndefined();
    const active = communityActiveInfiniteQuery(transport, []);
    expect(active.getNextPageParam({ data: [] }, [], null, [null])).toBeUndefined();
  });
});

// ── mutations ───────────────────────────────────────────────────────────────

const runMutation = async <TVars, TData>(
  options: { mutationFn?: (vars: TVars, ctx: never) => Promise<TData> },
  vars: TVars
) => options.mutationFn!(vars, {} as never);

describe('partide mutations', () => {
  // fish community/__tests__/rollbackSessionFollows.test.ts
  describe('rollbackSessionFollows', () => {
    it('removes the entry when the snapshot was undefined', () => {
      const qc = new QueryClient();
      qc.setQueryData<string[]>(communityKeys.sessionFollows, ['s1']);
      rollbackSessionFollows(qc, { previous: undefined });
      expect(qc.getQueryData(communityKeys.sessionFollows)).toBeUndefined();
    });

    it('restores a defined snapshot', () => {
      const qc = new QueryClient();
      qc.setQueryData<string[]>(communityKeys.sessionFollows, ['s1', 's2']);
      rollbackSessionFollows(qc, { previous: ['s1'] });
      expect(qc.getQueryData(communityKeys.sessionFollows)).toEqual(['s1']);
    });

    it('does nothing without a context', () => {
      const qc = new QueryClient();
      qc.setQueryData<string[]>(communityKeys.sessionFollows, ['s1']);
      rollbackSessionFollows(qc, undefined);
      expect(qc.getQueryData(communityKeys.sessionFollows)).toEqual(['s1']);
    });
  });

  it('flips follows optimistically and rolls back on error', async () => {
    expect(applySessionFollow(undefined, 'a', true)).toEqual(['a']);
    expect(applySessionFollow(['a'], 'a', true)).toEqual(['a']);
    expect(applySessionFollow(['a', 'b'], 'a', false)).toEqual(['b']);

    const qc = new QueryClient();
    qc.setQueryData<string[]>(communityKeys.sessionFollows, ['x']);
    const { transport } = createFakeTransport();
    const m = followSessionMutation(transport, qc);
    const ctx = await m.onMutate!('s1', {} as never);
    expect(qc.getQueryData(communityKeys.sessionFollows)).toEqual(['x', 's1']);
    m.onError!(new Error('x'), 's1', ctx, {} as never);
    expect(qc.getQueryData(communityKeys.sessionFollows)).toEqual(['x']);
  });

  it('invalidates the community session on focus, and no-ops on an empty id', () => {
    const qc = new QueryClient();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    refetchCommunitySessionOnFocus(qc, '');
    expect(spy).not.toHaveBeenCalled();
    refetchCommunitySessionOnFocus(qc, 'd');
    expect(spy).toHaveBeenCalledWith({ queryKey: ['community', 'session', 'd'] });
  });

  it('refreshes my list now and the community only after the purge grace', () => {
    const qc = new QueryClient();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    const scheduled: [() => void, number][] = [];
    invalidateCommunityAfterCatch(qc, (fn, ms) => scheduled.push([fn, ms]));
    expect(spy).toHaveBeenCalledWith({ queryKey: ['partide', 'mine'] });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(scheduled[0][1]).toBe(COMMUNITY_PURGE_GRACE_MS);
    scheduled[0][0]();
    expect(spy).toHaveBeenLastCalledWith({ queryKey: ['community'] });
  });

  it('invalidates membership caches for the current and affected users', async () => {
    const qc = new QueryClient();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    await invalidateMembershipCaches(qc, 'd', 'me', 'them');
    const keys = spy.mock.calls.map(c => c[0]!.queryKey);
    expect(keys).toEqual(
      expect.arrayContaining([
        ['partide', 'mine'],
        ['partide', 'detail', 'd'],
        ['profile-statistics'],
        ['community'],
        ['community', 'session-follows'],
        ['anglers', 'me'],
        ['anglers', 'them', 'sessions'],
        ['anglers', 'them', 'catches'],
      ])
    );
  });

  describe('leavePartidaMutation', () => {
    const vars = { documentId: 'd', currentUserDocumentId: 'me' };

    it('leaves and runs the cache cleanup', async () => {
      const qc = new QueryClient();
      qc.setQueryData(partideKeys.detail('d'), { x: 1 });
      const { transport, calls } = createFakeTransport([{ data: { removed: true } }]);
      await expect(runMutation(leavePartidaMutation(transport, qc), vars)).resolves.toEqual({ outcome: 'left' });
      expect(calls[0].path).toBe('/feed/sessions/d/leave');
      expect(qc.getQueryData(partideKeys.detail('d'))).toBeUndefined();
    });

    it('reconciles a lost response once REST confirms the access is gone', async () => {
      const qc = new QueryClient();
      const transport = {
        request: async (req: TransportRequest) => {
          if (req.path.endsWith('/leave')) throw new ApiError({ message: 'x', status: 0, code: 'NETWORK' });
          throw new ApiError({ message: 'x', status: 404, code: 'HTTP', bluCode: 'PARTIDA:NOT_FOUND' });
        },
      };
      await expect(runMutation(leavePartidaMutation(transport, qc), vars)).resolves.toEqual({ outcome: 'left' });
    });

    it('rethrows a retryable error when access is still valid', async () => {
      const qc = new QueryClient();
      const transport = {
        request: async (req: TransportRequest) => {
          if (req.path.endsWith('/leave')) throw new ApiError({ message: 'x', status: 502, code: 'HTTP' });
          return { data: { data: { ...sessionDTO, events: [] } }, status: 200, headers: new Headers() } as never;
        },
      };
      await expect(runMutation(leavePartidaMutation(transport, qc), vars)).rejects.toMatchObject({ retryable: true, accessConfirmation: 'valid' });
    });

    it('propagates a definite 4xx without probing', async () => {
      const qc = new QueryClient();
      const calls: string[] = [];
      const transport = {
        request: async (req: TransportRequest) => {
          calls.push(req.path);
          throw new ApiError({ message: 'x', status: 403, code: 'HTTP' });
        },
      };
      await expect(runMutation(leavePartidaMutation(transport, qc), vars)).rejects.toMatchObject({ status: 403 });
      expect(calls).toEqual(['/feed/sessions/d/leave']);
    });
  });

  it('deletes, kicks, rotates, joins and finishes', async () => {
    const qc = new QueryClient();
    qc.setQueryData(partideKeys.detail('d'), { x: 1 });
    const membership = { removed: true, joinCode: 'J', members: [member], hostUid: 'u1', projectionRev: 1 };
    const { transport, calls } = createFakeTransport([
      null,
      { data: membership },
      { data: { joinCode: 'R', projectionRev: 2 } },
      { data: { ...sessionDTO, firestoreId: 'c1' } },
      { data: { ...sessionDTO, events: [] } },
    ]);
    await runMutation(deletePartidaMutation(transport, qc), { documentId: 'd', currentUserDocumentId: 'me', wasActive: false });
    expect(qc.getQueryData(partideKeys.detail('d'))).toBeUndefined();
    await expect(runMutation(kickPartidaMemberMutation(transport, qc), { documentId: 'd', currentUserDocumentId: 'me', targetDocumentId: 't' })).resolves.toEqual(membership);
    await runMutation(rotatePartidaJoinCodeMutation(transport, qc), { documentId: 'd', currentUserDocumentId: null });
    await runMutation(joinPartidaMutation(transport), '  abc123 ');
    const scheduled: number[] = [];
    const finish = finishPartidaMutation(transport, qc, (_fn, ms) => scheduled.push(ms));
    const spy = vi.spyOn(qc, 'invalidateQueries');
    await runMutation(finish, 'd');
    finish.onSuccess!(undefined as never, 'd', undefined, {} as never);
    expect(spy).toHaveBeenCalledWith({ queryKey: ['partide', 'mine'] });
    expect(scheduled).toEqual([COMMUNITY_PURGE_GRACE_MS]);
    expect(calls.map(c => [c.method, c.path])).toEqual([
      ['DELETE', '/feed/sessions/d'],
      ['DELETE', '/feed/sessions/d/members/t'],
      ['POST', '/feed/sessions/d/join-code/rotate'],
      ['POST', '/feed/sessions/join'],
      ['POST', '/feed/sessions/d/finish'],
    ]);
    expect(calls[3].body).toEqual({ data: { code: 'ABC123' } });
  });
});
