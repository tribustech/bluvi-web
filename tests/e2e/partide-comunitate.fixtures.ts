import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { APIRequestContext, BrowserContext, Page, Route } from '@playwright/test';
import { BASE_URL } from './helpers/base-url';

/*
 * Shapes of /feed/community/* for the Comunitate e2e and screenshots (tests/e2e/partide-comunitate.spec.ts):
 * the local CMS has no live partidă, no catch with a photo in the overview and no record, so the
 * live / duel / leaderboard / records / empty states are served with page.route. Photos come from a
 * fake host answered with the repo's own images, so nothing leaves the machine. No Firestore, no
 * write anywhere.
 */

export const IMG = 'https://fixtures.bluvi.test';
const FILES: Record<string, string> = {
  'lake.jpg': 'public/images/lake.jpeg',
  'catch.jpg': 'public/images/placeholder-lake.jpg',
  'poster.jpg': 'public/images/competition-placeholder.jpg',
};

/** Serves every fixture photo from public/images (deterministic, offline). */
export async function servePhotos(page: Page) {
  await page.route(`${IMG}/**`, (route) => {
    const name = new URL(route.request().url()).pathname.slice(1);
    const file = FILES[name] ?? FILES['catch.jpg'];
    return route.fulfill({ status: 200, contentType: 'image/jpeg', body: readFileSync(join(process.cwd(), file)) });
  });
}

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
const member = (uid: string, name: string | null, avatar = false) => ({ uid, name, avatarUrl: avatar ? `${IMG}/poster.jpg` : null });

const photo = (kg: number | null) => ({ url: `${IMG}/catch.jpg`, thumbUrl: `${IMG}/catch.jpg`, weightKg: kg });

export const SOLO = {
  key: 'lake:solo-lake',
  venueType: 'lake' as const,
  lakeId: 'solo-lake',
  name: 'Balta Solo',
  locality: 'Giurgiu',
  imageUrl: `${IMG}/lake.jpg`,
  sessions: [
    {
      documentId: 'solo-1',
      startedAt: minutesAgo(125),
      members: [member('u-solo', 'Ion Popescu', true)],
      catchCount: 3,
      maxKg: 6.4,
      totalKg: 12.5,
      standName: '7',
      lastCatchAt: minutesAgo(18),
      photos: [photo(6.4), photo(4.1), photo(2)],
      photoCount: 5,
    },
  ],
};

export const DUEL = {
  key: 'water:L:RO10_01.025_L3',
  venueType: 'publicWater' as const,
  lakeId: null,
  name: 'Lacul Tineretului',
  locality: 'București',
  imageUrl: `${IMG}/lake.jpg`,
  sessions: [
    { documentId: 'duel-a', startedAt: minutesAgo(200), members: [member('u-a', 'Mihai Dan')], catchCount: 4, maxKg: 5, totalKg: 14.2, standName: null, lastCatchAt: minutesAgo(9) },
    {
      documentId: 'duel-b',
      startedAt: minutesAgo(90),
      members: [member('u-b1', 'Ana Pop'), member('u-b2', 'Radu Ionescu')],
      catchCount: 2,
      maxKg: 4,
      totalKg: 8.7,
      standName: null,
      lastCatchAt: minutesAgo(40),
    },
  ],
};

export const LEADERBOARD = {
  key: 'lake:board-lake',
  venueType: 'lake' as const,
  lakeId: 'board-lake',
  name: 'Lacul Mare',
  locality: 'Ilfov',
  imageUrl: null,
  sessions: [
    { documentId: 'lb-1', startedAt: minutesAgo(300), members: [member('u-1', 'Vlad Matei')], catchCount: 6, maxKg: 9, totalKg: 31.4, standName: '3' },
    { documentId: 'lb-2', startedAt: minutesAgo(280), members: [member('u-2', 'Dan Stoica')], catchCount: 4, maxKg: 7, totalKg: 18.9, standName: '5' },
    { documentId: 'lb-3', startedAt: minutesAgo(250), members: [member('VIEWER', 'Eu')], catchCount: 1, maxKg: 3, totalKg: 3, standName: '9' },
    { documentId: 'lb-4', startedAt: minutesAgo(60), members: [member('u-4', null)], catchCount: 0, maxKg: null, totalKg: null, standName: '12' },
  ],
};

export const CATCHES = [
  {
    clientId: 'c1',
    sessionDocumentId: 'solo-1',
    species: 'Crap',
    weightKg: 6.4,
    photoUrl: `${IMG}/catch.jpg`,
    photoGridUrl: `${IMG}/catch.jpg`,
    photoThumbUrl: `${IMG}/catch.jpg`,
    occurredAt: minutesAgo(18),
    angler: member('u-solo', 'Ion Popescu', true),
    extraMembers: 0,
    venueName: 'Balta Solo',
  },
  // Same clientId in another session: the rail must key on session + clientId.
  {
    clientId: 'c1',
    sessionDocumentId: 'duel-b',
    species: null,
    weightKg: null,
    photoUrl: `${IMG}/lake.jpg`,
    occurredAt: minutesAgo(130),
    angler: member('u-b1', 'Ana Pop'),
    extraMembers: 1,
    venueName: 'Lacul Tineretului',
  },
  {
    clientId: 'c3',
    sessionDocumentId: 'lb-1',
    species: 'Amur',
    weightKg: 9,
    photoUrl: `${IMG}/poster.jpg`,
    occurredAt: minutesAgo(60 * 26),
    angler: member('u-1', 'Vlad Matei'),
    extraMembers: 0,
    venueName: 'Lacul Mare',
  },
];

export const RECORD_TODAY = {
  window: 'today' as const,
  weightKg: 9,
  species: 'Amur',
  venueName: 'Lacul Mare',
  photoUrl: `${IMG}/catch.jpg`,
  photoGridUrl: `${IMG}/catch.jpg`,
  sessionDocumentId: 'lb-1',
  angler: member('u-1', 'Vlad Matei'),
  extraMembers: 0,
};
export const RECORD_MONTH = {
  window: 'month' as const,
  weightKg: 21.35,
  species: null,
  venueName: 'Balta Solo',
  photoUrl: `${IMG}/lake.jpg`,
  sessionDocumentId: null,
  angler: member('u-solo', 'Ion Popescu', true),
  extraMembers: 2,
};

export const POPULAR = [
  { key: 'lake:solo-lake', lakeId: 'solo-lake', name: 'Balta Solo', locality: 'Giurgiu', imageUrl: `${IMG}/lake.jpg`, liveCount: 1, sessionsLast30d: 24 },
  { key: 'water:X', lakeId: null, name: 'Râul Argeș', locality: null, imageUrl: null, liveCount: 0, sessionsLast30d: 1 },
  { key: 'lake:third', lakeId: 'third', name: 'A treia', locality: 'Arad', imageUrl: null, liveCount: 0, sessionsLast30d: 3 },
];

export type Overview = { latestCatches: unknown[]; activeVenues: unknown[]; records: unknown[]; popularVenues: unknown[] };

export const OVERVIEW_LIVE: Overview = {
  latestCatches: CATCHES,
  activeVenues: [SOLO, DUEL, LEADERBOARD],
  records: [RECORD_TODAY, RECORD_MONTH],
  popularVenues: POPULAR,
};
export const OVERVIEW_EMPTY: Overview = { latestCatches: [], activeVenues: [], records: [], popularVenues: [] };

export const FINISHED_ROW = {
  documentId: 'fin-1',
  startedAt: '2026-07-26T03:40:00.000Z',
  endedAt: '2026-07-26T15:10:00.000Z',
  members: [member('u-f', 'Gheorghe Ilie')],
  venue: { key: 'lake:solo-lake', venueType: 'lake', lakeId: 'solo-lake', name: 'Balta Solo', locality: 'Giurgiu', imageUrl: null },
  catchCount: 1,
  maxKg: 4.25,
  totalKg: 4.25,
  photoUrl: null,
  standName: 'Stand 2',
  photos: [photo(4.25)],
  photoCount: 1,
};

export const historyPage = (rows: unknown[]) => ({ data: rows, meta: { pagination: { page: 1, pageSize: 10, pageCount: rows.length ? 1 : 0, total: rows.length } } });

const json = (body: unknown, status = 200) => (route: Route) =>
  route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', date: new Date().toUTCString() }, body: JSON.stringify(body) });

export type CommunityMock = { overview: Overview | 'error'; history?: unknown[] | 'error'; delayMs?: number };

/**
 * Serves /feed/community/overview and /history (direct to the CMS or through /api/cms) and counts
 * the requests. `delayMs` holds the answers (the skeleton).
 */
export async function mockCommunity(page: Page, mock: CommunityMock) {
  const hits = { overview: 0, history: 0 };
  const state = { ...mock };
  await page.route('**/feed/community/overview*', async (route) => {
    hits.overview += 1;
    if (state.delayMs) await new Promise((r) => setTimeout(r, state.delayMs));
    return state.overview === 'error' ? json({ error: { status: 500 } }, 500)(route) : json({ data: state.overview })(route);
  });
  await page.route('**/feed/community/history*', async (route) => {
    hits.history += 1;
    if (state.delayMs) await new Promise((r) => setTimeout(r, state.delayMs));
    const h = state.history ?? [];
    return h === 'error' ? json({ error: { status: 500 } }, 500)(route) : json(historyPage(h))(route);
  });
  return { hits, state };
}

/**
 * Skip the page's server prefetch for THIS context only, so the browser makes (mockable) community
 * reads (dev only: app/(site)/partide/_comunitate/e2e-faults.ts reads the cookie per request; a
 * production build ignores it — `partideFaultsAvailable` tells the suite to skip there).
 */
export async function setPartideNoPrefetch(context: BrowserContext) {
  await context.addCookies([{ name: 'bluvi-e2e-partide', value: 'noprefetch', url: BASE_URL }]);
}

/**
 * The switch only exists on a dev server (next dev serves its HMR client); against `next start` / a
 * CI build the page prefetches regardless, so the mocked suite cannot run there and skips.
 */
export async function partideFaultsAvailable(request: APIRequestContext): Promise<boolean> {
  const res = await request.get(`${BASE_URL}/partide`);
  return res.ok() && (await res.text()).includes('hmr-client');
}

/* ------------------------------------------------------------------ the viewer's live partidă */

export const ACTIVE_ID = 'active-doc';

export function activeSession(opts: { rods?: { index: number; color: string; phase: 'fishing' | 'ready'; endsInMs: number | null }[] } = {}) {
  const event = (id: number, outcome: 'capture' | 'lost', weightKg: number | null) => ({
    id,
    documentId: `ev-${id}`,
    clientId: `ev-${id}`,
    clientUpdatedAt: null,
    outcome,
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
    weightKg,
    weightEstimated: false,
    species: null,
    speciesId: null,
    photoUrl: null,
    photoThumbUrl: null,
    notes: null,
    occurredAt: minutesAgo(10),
    photoTagUids: [],
  });
  return {
    documentId: ACTIVE_ID,
    clientId: 'active-client',
    clientUpdatedAt: null,
    venueType: 'lake',
    lakeId: 'solo-lake',
    lakeName: 'Balta Mea',
    lakeImageUrl: null,
    publicWaterCode: null,
    publicWaterName: null,
    manualVenueName: null,
    standId: null,
    standName: null,
    locality: 'Giurgiu',
    anchorLat: null,
    anchorLong: null,
    anchorName: null,
    startedAt: minutesAgo(95),
    endedAt: null,
    plannedDurationMs: null,
    notes: null,
    visibleOnProfile: true,
    status: 'active',
    targetSpecies: [],
    hostUid: 'VIEWER',
    joinCode: 'ABC123',
    members: [],
    rods: (opts.rods ?? []).map((r) => ({
      index: r.index,
      label: null,
      color: r.color,
      bait: null,
      baitType: null,
      baitSize: null,
      baitFlavor: null,
      lane: null,
      distance: null,
      castLat: null,
      castLng: null,
      durationMs: 3_600_000,
      alarmSound: null,
      runtimePhase: r.phase,
      runtimeEndsAt: r.endsInMs == null ? null : new Date(Date.now() + r.endsInMs).toISOString(),
    })),
    events: [event(1, 'capture', 9.4), event(2, 'capture', 2), event(3, 'capture', null), event(4, 'capture', 1), event(5, 'lost', null)],
  };
}

/** The signed-in viewer's live probe: /feed/sessions/active → the session read (through /api/cms). */
export async function mockActivePartida(page: Page, session: ReturnType<typeof activeSession> | null) {
  const hits = { active: 0, session: 0, mine: 0 };
  await page.route('**/api/cms/feed/sessions/active*', (route) => {
    hits.active += 1;
    return json({ data: session ? { documentId: session.documentId, clientId: session.clientId, firestoreId: session.clientId } : null })(route);
  });
  await page.route(`**/api/cms/feed/sessions/${ACTIVE_ID}*`, (route) => {
    hits.session += 1;
    return json({ data: session })(route);
  });
  await page.route('**/api/cms/feed/sessions/mine*', (route) => {
    hits.mine += 1;
    return json({ data: [], meta: { page: 1, pageSize: 50, total: 0 } })(route);
  });
  return hits;
}
