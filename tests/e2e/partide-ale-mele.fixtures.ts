import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page, Route } from '@playwright/test';
import { installFakeLive } from './helpers/fake-live';
import { ACTIVE_ID, activeSession, IMG, servePhotos } from './partide-comunitate.fixtures';

/*
 * The QA user's own reads for Partide · Ale mele, served at /api/cms (the proxy the page uses):
 * /feed/sessions/mine (the journal), /feed/sessions/mine/catches (MY catches),
 * /feed/sessions/active and the live session (the hub's probe). Shared by the e2e
 * (tests/e2e/partide-ale-mele.spec.ts, relative to the real clock) and the screenshots
 * (tests/visual/partide-ale-mele.visual.spec.ts, relative to a frozen one). Nothing is created or
 * written anywhere — no CMS write, no Firestore: the shared Firestore fake (helpers/fake-live) is
 * installed, every Firebase request is aborted and recorded (`hits.firebase`, asserted empty).
 */

export const H = 3_600_000;
export const D = 24 * H;

/** A long venue and locality (40+ characters): the own cards must still fit a phone. */
export const LONG_LAKE = 'Balta Complexul Piscicol Moara Vlăsiei de Sus — Lacul Mare Nr. 2';
export const LONG_LOCALITY = 'Comuna Moara Vlăsiei, județul Ilfov';

type RowOpts = {
  startedAgo: number;
  hours: number | null;
  captures: number;
  recordKg: number | null;
  totalKg: number | null;
  lake: string;
  stand?: string | null;
  locality?: string | null;
  img?: boolean;
};

/** The journal's rows, relative to `now` (the real clock in the e2e, a frozen one in the screenshots). */
export function aleMeleRows(now = Date.now()) {
  const iso = (msAgo: number) => new Date(now - msAgo).toISOString();
  /** One /feed/sessions/mine row (toSessionListItemDTO). */
  const row = (id: string, { startedAgo, hours, captures, recordKg, totalKg, lake, stand = null, locality = 'Ilfov', img = true }: RowOpts) => ({
    documentId: id,
    clientId: `client-${id}`,
    clientUpdatedAt: null,
    venueType: 'lake',
    lakeId: `lake-${id}`,
    lakeName: lake,
    lakeImageUrl: img ? `${IMG}/lake.jpg` : null,
    publicWaterCode: null,
    publicWaterName: null,
    manualVenueName: null,
    standId: null,
    standName: stand,
    locality,
    anchorLat: null,
    anchorLong: null,
    anchorName: null,
    startedAt: iso(startedAgo),
    endedAt: hours == null ? null : iso(startedAgo - hours * H),
    plannedDurationMs: null,
    notes: null,
    visibleOnProfile: id !== 'f2',
    status: hours == null ? 'active' : 'finished',
    targetSpecies: [],
    hostUid: null,
    captures,
    recordKg,
    totalKg,
  });

  const F1 = row('f1', { startedAgo: 2 * D, hours: 6, captures: 6, recordKg: 12.35, totalKg: 41.2, lake: 'Balta Chita', stand: '7' });
  const F2 = row('f2', { startedAgo: 12 * D, hours: 4, captures: 3, recordKg: 8.4, totalKg: 19.1, lake: 'Lacul Snagov', locality: null });
  const F3 = row('f3', { startedAgo: 40 * D, hours: 5, captures: 0, recordKg: null, totalKg: null, lake: 'Balta Dridu', img: false });
  const F4 = row('f4', { startedAgo: 70 * D, hours: 3, captures: 2, recordKg: 4, totalKg: 5, lake: 'Balta Veche' });
  /** The live partidă (the probe answers with it): counted, never rendered as a card. */
  const LIVE = { ...row(ACTIVE_ID, { startedAgo: 95 * 60_000, hours: null, captures: 4, recordKg: 14.2, totalKg: 20, lake: 'Balta Mea' }), clientId: 'active-client' };
  /** Open but not the live one (a stuck partidă): «În desfășurare». */
  const OPEN = row('open', { startedAgo: 3 * H, hours: null, captures: 1, recordKg: null, totalKg: null, lake: 'Balta Moara Vlăsiei', stand: 'Stand 3' });
  /** The newest finished partidă with a 40+ character venue and locality. */
  const LONG = row('long', { startedAgo: 1 * D, hours: 6, captures: 4, recordKg: 9.1, totalKg: 22.5, lake: LONG_LAKE, locality: LONG_LOCALITY, stand: '12' });
  /** Open, with the same long venue. */
  const LONG_OPEN = row('long-open', { startedAgo: 4 * H, hours: null, captures: 2, recordKg: 3.2, totalKg: 5.1, lake: LONG_LAKE, locality: LONG_LOCALITY });
  const ALL = [F3, OPEN, F1, LIVE, F4, F2];
  return { F1, F2, F3, F4, LIVE, OPEN, LONG, LONG_OPEN, ALL };
}

/** The hub probe's live session, its times relative to `now`. */
export function liveSession(now = Date.now()) {
  const s = activeSession();
  return {
    ...s,
    startedAt: new Date(now - 95 * 60_000).toISOString(),
    events: s.events.map((e) => ({ ...e, occurredAt: new Date(now - 10 * 60_000).toISOString() })),
  };
}

const SPECIES = ['Crap', null, 'Amur', 'Somn'];
/** One /feed/sessions/mine/catches item (toPartidaCatchDTO / toCompetitionCatchDTO). */
export function aCatch(i: number) {
  const competition = i === 1;
  return {
    key: `catch-${i}`,
    source: competition ? 'competition' : 'partida',
    photoUrl: `${IMG}/catch.jpg?full=${i}`,
    photoGridUrl: `${IMG}/catch.jpg?grid=${i}`,
    blurhash: null,
    photoWidth: 1600,
    photoHeight: 1200,
    weightKg: i === 3 ? null : 4 + i,
    species: SPECIES[i % 4],
    venueName: 'Balta Chita',
    date: new Date(Date.UTC(2026, 8, 20, 8, 30) - i * D).toISOString(),
    competitionName: competition ? 'Cupa Toamnei' : null,
    competitionDocumentId: competition ? 'cmp-1' : null,
  };
}
export const catchesPage = (from: number, count: number, total: number, next: string | null) => ({
  data: Array.from({ length: count }, (_, k) => aCatch(from + k)),
  meta: { pagination: { pageSize: 20, total }, nextCursor: next },
});

export type MineMock = {
  rows?: unknown[] | 'error';
  /** Catches pages by cursor ('first' = the first page). */
  catches?: Record<string, unknown>;
  live?: boolean;
  delayMs?: number;
  /** The clock the answers' Date header (the hub's server clock) and the live session follow. */
  now?: number;
};

/** The viewer's reads, through /api/cms; returns the request counters (and the mutable mock). */
export async function mockMine(page: Page, mock: MineMock) {
  const fake = await installFakeLive(page);
  const hits = { mine: 0, catches: 0, active: 0, profileCatches: 0, firebase: fake.attempts };
  const state = { ...mock };
  const json = (body: unknown, status = 200) => (route: Route) =>
    route.fulfill({
      status,
      contentType: 'application/json',
      headers: { date: new Date(state.now ?? Date.now()).toUTCString() },
      body: JSON.stringify(body),
    });
  await servePhotos(page);
  // The share card's same-origin photo (the proxy only fetches real CMS hosts).
  await page.route('**/ape-publice/api/foto**', (route) =>
    route.fulfill({ status: 200, contentType: 'image/jpeg', body: readFileSync(join(process.cwd(), 'public/images/placeholder-lake.jpg')) }),
  );
  await page.route(/\/api\/cms\/feed\/sessions\/mine(\?|$)/, async (route) => {
    hits.mine += 1;
    if (state.delayMs) await new Promise((r) => setTimeout(r, state.delayMs));
    const rows = state.rows ?? [];
    if (rows === 'error') return json({ error: { status: 500 } }, 500)(route);
    return json({ data: rows, meta: { page: 1, pageSize: 100, total: rows.length } })(route);
  });
  await page.route(/\/api\/cms\/feed\/sessions\/mine\/catches/, (route) => {
    hits.catches += 1;
    const cursor = new URL(route.request().url()).searchParams.get('cursor') ?? 'first';
    const pages = state.catches ?? {};
    return json(pages[cursor] ?? { data: [], meta: { pagination: { pageSize: 20, total: 0 }, nextCursor: null } })(route);
  });
  await page.route(/\/feed\/anglers\/[^/]+\/catches/, (route) => {
    hits.profileCatches += 1;
    return route.continue();
  });
  await page.route(/\/api\/cms\/feed\/sessions\/active/, (route) => {
    hits.active += 1;
    return json({ data: state.live ? { documentId: ACTIVE_ID, clientId: 'active-client', firestoreId: 'active-client' } : null })(route);
  });
  await page.route(new RegExp(`/api/cms/feed/sessions/${ACTIVE_ID}(\\?|$)`), (route) => json({ data: liveSession(state.now) })(route));
  return { hits, state };
}
