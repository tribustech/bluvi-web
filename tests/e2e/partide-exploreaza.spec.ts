import { expect, test, type BrowserContext, type Page, type Route } from '@playwright/test';
import { partideHrefs } from '@/lib/partide-pages';
import { routes } from '@/lib/routes';
import { expectNoA11yViolations } from './helpers/a11y';
import { expectPartidaHero } from './helpers/app-cta';
import { collectConsoleErrors } from './helpers/console';
import { CMS, qaJwt, signIn } from './helpers/session';
import {
  DUEL,
  FINISHED_ROW,
  LEADERBOARD,
  mockActivePartida,
  partideFaultsAvailable,
  servePhotos,
  setPartideNoPrefetch,
  SOLO,
} from './partide-comunitate.fixtures';

/*
 * Partide · Explorează (/partide/exploreaza) — parity docs/parity/areas/partide.yml
 * partide.exploreaza c1–c21. fish: features/partide/scenes/CommunityScene.tsx,
 * components/community/VenueSearchScreen.tsx, recentVenueSearches.ts, services/queries/useVenueSearch.ts.
 *
 * Every read is served with page.route (the page's dev-only `noprefetch` switch leaves the first
 * pages to the browser): /feed/community/active|history, /feed/session-follows/mine,
 * /feed/anglers/<uid>/following, the lake search and /ape-publice/api/search. Nothing is written
 * anywhere, no Firestore; the signed-in viewer's live probe answers «no partidă».
 */

test.setTimeout(120_000);

const PHONE = { width: 375, height: 812 };
const DESKTOP = { width: 1440, height: 900 };

test.beforeAll(async ({ request }) => {
  test.skip(!(await partideFaultsAvailable(request)), 'needs next dev (the noprefetch switch is dev-only)');
});
test.beforeEach(async ({ context }) => {
  await setPartideNoPrefetch(context);
});

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', headers: { date: new Date().toUTCString() }, body: JSON.stringify(body) });

type Venue = typeof SOLO | typeof DUEL | typeof LEADERBOARD | Record<string, unknown>;
type Row = Record<string, unknown> & { documentId: string };

const finished = (id: string, over: Partial<Row> = {}): Row => ({ ...FINISHED_ROW, documentId: id, ...over });

type Mock = {
  /** Live pages (cursor-paged), or 'error'. Per venue key when a function. */
  live?: Venue[][] | 'error' | ((venue: string | null) => Venue[][]);
  /** Finished pages (page-numbered), or 'error'. */
  history?: Row[][] | 'error' | ((venue: string | null) => Row[][]);
  /** Total history pages announced (defaults to the pages given). */
  historyPageCount?: number;
  follows?: string[];
  following?: string[];
  delayMs?: number;
};

async function mockExplore(page: Page, mock: Mock) {
  const hits = { live: [] as string[], history: [] as string[], follows: 0, following: 0 };
  const state = { ...mock };
  await page.route('**/feed/community/active*', async route => {
    const url = new URL(route.request().url());
    hits.live.push(url.search);
    if (state.delayMs) await new Promise(r => setTimeout(r, state.delayMs));
    const venue = url.searchParams.get('venue');
    const src = typeof state.live === 'function' ? state.live(venue) : (state.live ?? [[]]);
    if (src === 'error') return json(route, { error: { status: 500 } }, 500);
    const cursor = url.searchParams.get('cursor');
    const i = cursor ? Number(cursor.slice(1)) : 0;
    const data = src[i] ?? [];
    return json(route, { data, meta: { pagination: { pageSize: 10, total: src.flat().length }, nextCursor: i + 1 < src.length ? `c${i + 1}` : null } });
  });
  await page.route('**/feed/community/history*', async route => {
    const url = new URL(route.request().url());
    hits.history.push(url.search);
    if (state.delayMs) await new Promise(r => setTimeout(r, state.delayMs));
    const venue = url.searchParams.get('venue');
    const src = typeof state.history === 'function' ? state.history(venue) : (state.history ?? [[]]);
    if (src === 'error') return json(route, { error: { status: 500 } }, 500);
    const p = Number(url.searchParams.get('page') ?? 1);
    const pageCount = state.historyPageCount ?? src.length;
    const data = src[p - 1] ?? [];
    return json(route, { data, meta: { pagination: { page: p, pageSize: 10, pageCount, total: pageCount * 10 } } });
  });
  await page.route('**/api/cms/feed/session-follows/mine*', route => {
    hits.follows += 1;
    return json(route, { data: { sessionDocumentIds: state.follows ?? [] } });
  });
  await page.route(/\/api\/cms\/feed\/anglers\/[^/]+\/following/, route => {
    hits.following += 1;
    const ids = state.following ?? [];
    return json(route, {
      data: ids.map(id => ({ documentId: id, username: id, avatarUrl: null, isFollowedByMe: true })),
      meta: { pagination: { page: 1, pageSize: 100, pageCount: 1, total: ids.length } },
    });
  });
  return { hits, state };
}

async function open(page: Page, mock: Mock, { viewport = DESKTOP, query = '' }: { viewport?: typeof DESKTOP; query?: string } = {}) {
  await page.setViewportSize(viewport);
  await servePhotos(page);
  const m = await mockExplore(page, mock);
  await page.goto(`${routes.partideExplore()}${query}`);
  return m;
}

async function signedIn(context: BrowserContext, page: Page) {
  const jwt = await qaJwt(page.request);
  await signIn(context, jwt);
  await mockActivePartida(page, null);
  const me = await (await page.request.get(`${CMS}/users/me`, { headers: { authorization: `Bearer ${jwt}` } })).json();
  return me.documentId as string;
}

const chip = (page: Page, name: string) => page.getByRole('group', { name: 'Filtre partide' }).getByRole('button', { name, exact: true });
const liveHeading = (page: Page) => page.getByRole('heading', { name: 'În direct' });
const doneHeading = (page: Page) => page.getByRole('heading', { name: 'Încheiate' });

const LIVE_PAGES = [[SOLO, DUEL, LEADERBOARD], [{ ...SOLO, key: 'lake:page2', lakeId: 'page2', name: 'Balta Doi', sessions: [{ ...SOLO.sessions[0], documentId: 'p2-1' }] }]];

test('c1 c2 c5 c7 c8 c9 c11 — filter row, ÎN DIRECT (page 1), «Vezi toate» → live-only, ÎNCHEIATE', async ({ page }) => {
  const errors = collectConsoleErrors(page);
  const { hits } = await open(page, { live: LIVE_PAGES, history: [[finished('fin-1'), finished('fin-2', { standName: null })]] });

  // c1 — the four chips in one row, in fish's order.
  const bar = page.getByRole('group', { name: 'Filtre partide' });
  await expect(bar.getByRole('button')).toHaveText(['LIVE', 'Cu notificări', 'Prieteni', 'Toate bălțile']);
  await expect(chip(page, 'LIVE')).toHaveAttribute('aria-pressed', 'false');

  // c5/c9 — ÎN DIRECT with page 1 only (c7), the three card shapes, «Vezi toate» (page 1 has a cursor).
  await expect(liveHeading(page)).toBeVisible();
  const liveGrid = page.getByTestId('live-grid');
  await expect(liveGrid.getByTestId('venue-card-solo')).toHaveCount(1);
  await expect(liveGrid.getByTestId('venue-card-duel')).toHaveCount(1);
  await expect(liveGrid.getByTestId('venue-card-leaderboard')).toHaveCount(1);
  await expect(liveGrid).not.toContainText('Balta Doi');

  // c8 — ÎNCHEIATE, card D.
  await expect(doneHeading(page)).toBeVisible();
  const card = page.getByTestId('finished-grid').getByTestId('history-card').first();
  await expect(card.getByTestId('card-ribbon')).toHaveText('Încheiată');
  await expect(card).toContainText('Gheorghe Ilie');
  await expect(card).toContainText('Balta Solo');
  await expect(card).toContainText('kg total');
  await expect(card).toContainText('durată');
  await expect(card).toContainText('26 IUL');

  // c11 — every card opens /partide/[documentId] (own vs spectator is decided by that page) once it is on the web.
  const fin = partideHrefs.partida('fin-1');
  if (fin) {
    await expect(card.getByRole('link', { name: 'Gheorghe Ilie' })).toHaveAttribute('href', fin);
    await expect(liveGrid.getByTestId('venue-card-solo').getByRole('link', { name: 'Ion Popescu' })).toHaveAttribute('href', partideHrefs.partida('solo-1') as string);
  } else {
    await expect(card.getByRole('link')).toHaveCount(0);
  }

  await expectNoA11yViolations(page);

  // c5/c7 — «Vezi toate» → live-only: URL ?live=1, the LIVE chip on, ÎNCHEIATE hidden, more live pages load.
  await page.getByRole('button', { name: 'Vezi toate partidele live' }).click();
  await expect(chip(page, 'LIVE')).toHaveAttribute('aria-pressed', 'true');
  await expect(page).toHaveURL(/\?live=1$/);
  await expect(doneHeading(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Vezi toate partidele live' })).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(liveGrid).toContainText('Balta Doi');
  expect(hits.live.some(s => s.includes('cursor=c1'))).toBe(true);
  await expect(page.getByTestId('explore-footer')).toHaveCount(0);

  // c1 — the LIVE chip toggles back.
  await chip(page, 'LIVE').click();
  await expect(page).toHaveURL(/\/partide\/exploreaza$/);
  await expect(doneHeading(page)).toBeVisible();
  // c7 — back outside live-only, ÎN DIRECT is page 1 again.
  await expect(liveGrid).not.toContainText('Balta Doi');

  // c2 — «Cu notificări» / «Prieteni» are exclusive; the active one again clears.
  await chip(page, 'Cu notificări').click();
  await expect(chip(page, 'Cu notificări')).toHaveAttribute('aria-pressed', 'true');
  await expect(page).toHaveURL(/filtru=notificari/);
  await chip(page, 'Prieteni').click();
  await expect(chip(page, 'Prieteni')).toHaveAttribute('aria-pressed', 'true');
  await expect(chip(page, 'Cu notificări')).toHaveAttribute('aria-pressed', 'false');
  await expect(page).toHaveURL(/filtru=prieteni/);
  await chip(page, 'Prieteni').click();
  await expect(chip(page, 'Prieteni')).toHaveAttribute('aria-pressed', 'false');
  await expect(page).toHaveURL(/\/partide\/exploreaza$/);
  expect(errors).toEqual([]);
});

test('c21 c14 — signed out, «Cu notificări» and «Prieteni» match nothing (no per-user read)', async ({ page }) => {
  const { hits } = await open(page, { live: [[SOLO]], history: [[finished('fin-1')]] }, { viewport: PHONE });
  await expect(page.getByTestId('venue-card-solo')).toBeVisible();

  await chip(page, 'Cu notificări').click();
  const empty = page.getByTestId('explore-empty-filtered');
  await expect(empty).toContainText('Nicio partidă încheiată pentru filtrele alese.');
  await chip(page, 'Prieteni').click();
  await expect(empty).toContainText(
    'Nu ești singur — pescuitul leagă prietenii. Urmărește profilul unui pescar și vei fi mereu la curent cu partidele lui.',
  );
  // «Șterge filtrele» resets to the unfiltered view.
  await empty.getByRole('button', { name: 'Șterge filtrele' }).click();
  await expect(page.getByTestId('venue-card-solo')).toBeVisible();
  await expect(chip(page, 'Prieteni')).toHaveAttribute('aria-pressed', 'false');
  expect(hits.follows).toBe(0);
  expect(hits.following).toBe(0);
  await expectNoA11yViolations(page);
});

test('c3 c6 c21 — signed in: followed sessions, followed anglers, the hint row', async ({ context, page }) => {
  await signedIn(context, page);
  // Page 1: SOLO (solo-1), DUEL (duel-a by u-a, duel-b), LEADERBOARD; a second live page exists.
  const { hits } = await open(page, {
    live: LIVE_PAGES,
    history: [[finished('fin-1'), finished('fin-2', { members: [{ uid: 'u-a', name: 'Mihai Dan', avatarUrl: null }] })]],
    follows: ['solo-1', 'fin-1'],
    following: ['u-a'],
  });
  await expect(page.getByTestId('venue-card-leaderboard')).toBeVisible();

  // c3 — Cu notificări: the followed sessions only (solo-1 live, fin-1 finished); venues left empty are dropped.
  await chip(page, 'Cu notificări').click();
  const live = page.getByTestId('live-grid');
  await expect(live.getByTestId('venue-card-solo')).toHaveCount(1);
  await expect(live).toContainText('Ion Popescu');
  await expect(live.getByTestId('venue-card-duel')).toHaveCount(0);
  await expect(live.getByTestId('venue-card-leaderboard')).toHaveCount(0);
  await expect(page.getByTestId('finished-grid').getByTestId('history-card')).toHaveCount(1);

  // c3 — Prieteni: sessions with a followed member; the duel keeps one side (a solo card now).
  await chip(page, 'Prieteni').click();
  await expect(live.getByTestId('venue-card-solo')).toHaveCount(1);
  await expect(live).toContainText('Mihai Dan');
  await expect(live).not.toContainText('Ion Popescu');
  await expect(page.getByTestId('finished-grid')).toContainText('Mihai Dan');
  expect(hits.follows).toBeGreaterThan(0);
  expect(hits.following).toBeGreaterThan(0);
});

test('c6 — live page 1 filtered to nothing while more pages exist: the hint row under ÎN DIRECT', async ({ context, page }) => {
  await signedIn(context, page);
  await open(page, { live: LIVE_PAGES, history: [[finished('fin-1')]], follows: ['p2-1'], following: [] });
  await expect(page.getByTestId('venue-card-solo')).toBeVisible();
  await chip(page, 'Cu notificări').click();
  await expect(liveHeading(page)).toBeVisible();
  await expect(page.getByTestId('live-hint')).toHaveText(
    'Niciun rezultat pe această pagină cu acest filtru. Atinge „Vezi toate” pentru toate partidele live.',
  );
  // The escape hatch: live-only shows page 2's followed session.
  await page.getByRole('button', { name: 'Vezi toate partidele live' }).click();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(page.getByTestId('live-grid')).toContainText('Balta Doi');
});

test('c10 — auto-loading stops after 3 fetches that add no visible row; a filter change re-arms it', async ({ page }) => {
  const rows = (p: number) => Array.from({ length: 10 }, (_, i) => finished(`h-${p}-${i}`));
  const pages = Array.from({ length: 20 }, (_, i) => rows(i + 1));
  // A duplicate documentId across pages is shown once (fish dedupeByKey).
  pages[1][0] = finished('h-1-0');
  const { hits } = await open(page, { live: [[]], history: pages }, { viewport: PHONE });
  await expect(page.getByTestId('history-card')).toHaveCount(10);

  // Signed out, «Prieteni» matches nothing: the footer pages history while it stays in view, 3 times.
  await chip(page, 'Prieteni').click();
  await expect(page.getByTestId('explore-empty-filtered')).toBeVisible();
  await expect.poll(() => hits.history.length).toBe(4);
  await page.waitForTimeout(1500);
  expect(hits.history.length).toBe(4);
  // The manual button still loads on demand.
  await page.getByTestId('explore-footer').getByRole('button', { name: 'Caută mai departe' }).click();
  await expect.poll(() => hits.history.length).toBe(5);

  // Back to the unfiltered view: 50 loaded, one duplicate dropped.
  await chip(page, 'Prieteni').click();
  await expect(page.getByTestId('history-card')).toHaveCount(49);
});

test('c12 c13 c15 c16 — empty, live-only empty, history error + retry, skeleton', async ({ page }) => {
  // c16 — the list skeleton while live page 1 is in flight.
  const m = await open(page, { live: [[]], history: [[]], delayMs: 1500 }, { viewport: PHONE });
  await expect(page.getByTestId('explore-skeleton')).toBeVisible();
  // c12 — nothing anywhere.
  await expect(page.getByTestId('explore-empty')).toContainText('Nicio partidă publică activă acum.');
  // The «Ești la pescuit?» hero hands over to the app (owner 2026-10-08).
  await expectPartidaHero(page);
  m.state.delayMs = 0;

  // c13 — live-only empty: «Nicio partidă live acum.» + «Șterge filtrele».
  await chip(page, 'LIVE').click();
  const liveEmpty = page.getByTestId('explore-empty-live');
  await expect(liveEmpty).toContainText('Nicio partidă live acum.');
  await liveEmpty.getByRole('button', { name: 'Șterge filtrele' }).click();
  await expect(chip(page, 'LIVE')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByTestId('explore-empty')).toBeVisible();
});

test('c15 — history error with no rows: the error and a working retry', async ({ page }) => {
  const m = await open(page, { live: [[]], history: 'error' }, { viewport: PHONE });
  const alert = page.getByRole('alert').filter({ hasText: 'Nu am putut' });
  await expect(alert).toContainText('Nu am putut încărca partidele încheiate.');
  m.state.history = [[finished('fin-1')]];
  await alert.getByRole('button', { name: 'Încearcă din nou' }).click();
  await expect(page.getByTestId('history-card')).toHaveCount(1);
});

test('c4 c17 c18 c19 c20 — the venue picker: browse, search, pick, recents; the venue changes the query', async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await page.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem(
      'bluvi.partide.recentVenueSearches',
      JSON.stringify([
        { key: 'water:R:1', name: 'Snagov', helper: 'Lac de acumulare · Ilfov', imageUrl: null },
        { key: 'lake:', name: 'Invalidă', helper: null, imageUrl: null },
        { nope: 1 },
      ]),
    );
  });
  const lakeRow = finished('at-chita', { venue: { key: 'lake:chita', venueType: 'lake', lakeId: 'chita', name: 'Chita Lake', locality: 'Giurgiu', imageUrl: null } });
  const { hits } = await open(page, {
    live: venue => (venue ? [[]] : [[SOLO, DUEL]]),
    history: venue => (venue === 'lake:chita' ? [[lakeRow]] : [[finished('fin-1')]]),
  });
  await page.route('**/feed/lakes/search*', route =>
    json(route, {
      data: new URL(route.request().url()).searchParams.get('q')?.startsWith('chi')
        ? [{ documentId: 'chita', name: 'Chita Lake', county: null, countyRef: { documentId: 'gr', name: 'Giurgiu' }, cityRef: null, regime: null, reviewsMeta: null, images: [], facility: [], fishSpecies: [] }]
        : [],
      meta: { pagination: { page: 1, pageSize: 10, pageCount: 1, total: 1 } },
    }),
  );
  await page.route('**/ape-publice/api/search*', route => {
    const q = new URL(route.request().url()).searchParams.get('q') ?? '';
    const water = (id: number, name: string, linkCode: string | null) => ({ id, name, type: 'river', county: 'Giurgiu', countyId: 1, countyIds: [1], centerLat: 44, centerLng: 26, linkCode, areaKm2: null });
    return json(route, q.startsWith('chi') ? [water(1, 'Chiajna', 'RV:1'), water(2, 'Fără cod', null)] : []);
  });
  await expect(page.getByTestId('venue-card-duel')).toBeVisible();

  // c17 — title, close control, focused field.
  await chip(page, 'Filtrează după baltă: Toate bălțile').click();
  const dialog = page.getByRole('dialog', { name: 'Filtrează după baltă' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Închide' })).toBeVisible();
  const field = dialog.getByRole('textbox', { name: 'Caută o baltă sau o apă publică' });
  await expect(field).toBeFocused();

  // c18 — browse: Toate bălțile (current), Căutări recente (invalid entries ignored), Cu partide acum.
  await expect(dialog.getByTestId('venue-option').first()).toContainText('Toate bălțile');
  await expect(dialog.getByTestId('venue-option').first()).toContainText('Fără filtru — tot ce e public');
  await expect(dialog.getByText('Căutări recente')).toBeVisible();
  await expect(dialog.getByTestId('venue-row')).toHaveCount(1);
  await expect(dialog.getByTestId('venue-row')).toContainText('Snagov');
  await expect(dialog.getByText('Cu partide acum')).toBeVisible();
  await expect(dialog.getByTestId('venue-option')).toHaveText([/Toate bălțile/, /Balta Solo/, /Lacul Tineretului/]);
  // After the dialog's fade-in (axe reads the colours mid-transition otherwise).
  await page.waitForTimeout(600);
  await expectNoA11yViolations(page);

  // c19 — no match.
  await field.fill('zzz');
  await expect(dialog.getByTestId('venue-picker-empty')).toHaveText('Nu am găsit nicio baltă sau apă publică pentru căutarea ta.');
  // c19 — lakes first, then «Ape publice» (a water without a linkCode left out).
  await field.fill('chi');
  const rows = dialog.getByTestId('venue-row');
  await expect(rows).toHaveText([/Chita Lake/, /Chiajna/]);
  await expect(dialog.getByText('Ape publice')).toBeVisible();
  await expect(dialog).not.toContainText('Fără cod');

  // c20/c4 — a pick applies, closes, is remembered; both lists are read again for that venue.
  await rows.filter({ hasText: 'Chita Lake' }).click();
  await expect(dialog).toBeHidden();
  await expect(chip(page, 'Baltă: Chita Lake. Schimbă')).toBeVisible();
  await expect(page).toHaveURL(/loc=lake%3Achita|loc=lake:chita/);
  await expect(page.getByTestId('history-card')).toContainText('Chita Lake');
  expect(hits.history.some(s => s.includes('venue=lake%3Achita') || s.includes('venue=lake:chita'))).toBe(true);
  expect(hits.live.some(s => s.includes('venue=lake%3Achita') || s.includes('venue=lake:chita'))).toBe(true);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('bluvi.partide.recentVenueSearches') ?? '[]'));
  expect(stored.map((p: { key: string }) => p.key)).toEqual(['lake:chita', 'water:R:1']);

  // The venue survives a reload (its name from the recents).
  await page.reload();
  await expect(chip(page, 'Baltă: Chita Lake. Schimbă')).toBeVisible();

  // «Toate bălțile» clears the venue; «Șterge tot» clears the recents.
  await chip(page, 'Baltă: Chita Lake. Schimbă').click();
  await expect(dialog.getByTestId('venue-row').first()).toContainText('Activ');
  await dialog.getByRole('button', { name: 'Șterge tot' }).click();
  await expect(dialog.getByText('Căutări recente')).toHaveCount(0);
  await dialog.getByTestId('venue-option').first().click();
  await expect(chip(page, 'Filtrează după baltă: Toate bălțile')).toBeVisible();
  await expect(page).toHaveURL(/\/partide\/exploreaza$/);
  expect(errors).toEqual([]);
});

test('the picker is a sheet on the phone', async ({ page }) => {
  await open(page, { live: [[SOLO]], history: [[]] }, { viewport: PHONE });
  await chip(page, 'Filtrează după baltă: Toate bălțile').click();
  const sheet = page.getByRole('dialog', { name: 'Filtrează după baltă' });
  await expect(sheet).toBeVisible();
  const box = await sheet.boundingBox();
  expect(box && box.y + box.height).toBeGreaterThan(PHONE.height - 4);
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();
});


/** A schema-valid /feed/lakes/:id DTO (core lakeDetailSchema), so the chip is named by the read. */
const lakeDetail = (documentId: string, name: string) => ({
  documentId, name, county: null, countyRef: { documentId: 'gr', name: 'Giurgiu' }, cityRef: null, regime: null, reviewsMeta: null,
  images: [], facility: [], fishSpecies: [], description: null, address: null, directions: null, website: null, surface: null, depth: null,
  numberOfSeats: null, fishingType: null, fishingSpotTypes: null, price: [], contact: [], coordinates: null, stands: [], bookingEnabled: false,
  incrementHours: null, minDurationHours: null, checkoutBufferMinutes: null, slotStartTimes: [], paymentMode: null, depositPercent: null,
  confirmationMode: null, cancellationPolicy: null, regulationUrl: null,
});

/** A schema-valid /ape-publice/api/water/:code answer (core publicWaterDetailSchema). */
const waterDetail = (linkCode: string, name: string) => ({
  id: 7, name, type: 'reservoir_lake', county: 'Ilfov', countyId: 23, countyIds: [23], centerLat: 44.7, centerLng: 26.1, linkCode, areaKm2: 15.7,
  geometry: { type: 'Polygon', coordinates: [[[26.1, 44.7], [26.2, 44.7], [26.2, 44.8], [26.1, 44.7]]] },
  nameEn: null, euCode: null, anarCode: null, basin: null, volumeMilM3: null, elevationM: null, source: 'ANAR',
});

test('c4 — a venue from the URL: the filtered reads, the chip named by the lake read (a bone meanwhile)', async ({ page }) => {
  let lakeReads = 0;
  await page.route(/\/feed\/lakes\/far-lake(\?.*)?$/, async route => {
    lakeReads += 1;
    await new Promise(r => setTimeout(r, 600));
    return json(route, { data: lakeDetail('far-lake', 'Balta Departe') });
  });
  const { hits } = await open(page, { live: [[]], history: [[]] }, { query: '?loc=lake:far-lake&live=1' });
  await expect(chip(page, 'LIVE')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('explore-empty-live')).toBeVisible();
  expect(hits.live.every(s => s.includes('venue=lake%3Afar-lake') || s.includes('venue=lake:far-lake'))).toBe(true);
  // A bone while the read is in flight (600ms), then the lake's own name — never a guess.
  await expect(chip(page, 'Baltă: se încarcă. Schimbă')).toBeVisible();
  await expect(chip(page, 'Baltă: Balta Departe. Schimbă')).toHaveText('Balta Departe');
  expect(lakeReads).toBe(1);
});

test('c4 — a public water from the URL: the chip named by the /ape-publice read', async ({ page }) => {
  let waterReads = 0;
  await page.route('**/ape-publice/api/water/**', route => {
    waterReads += 1;
    expect(decodeURIComponent(new URL(route.request().url()).pathname)).toContain('/water/L:RO_SNAGOV');
    return json(route, waterDetail('L:RO_SNAGOV', 'Lacul Snagov'));
  });
  const { hits } = await open(page, { live: [[]], history: [[]] }, { query: '?loc=water:L:RO_SNAGOV' });
  await expect(chip(page, 'Baltă: Lacul Snagov. Schimbă')).toHaveText('Lacul Snagov');
  expect(hits.history.some(s => s.includes('venue=water%3AL%3ARO_SNAGOV') || s.includes('venue=water:L:RO_SNAGOV'))).toBe(true);
  expect(waterReads).toBe(1);
});

test('c4 — a venue from the URL that cannot be read: the chip says «Locul ales» (never a guess)', async ({ page }) => {
  await page.route(/\/feed\/lakes\/gone-lake(\?.*)?$/, route => json(route, { data: null, error: { status: 404, name: 'NotFoundError', message: 'Not Found' } }, 404));
  await page.route('**/ape-publice/api/water/**', route => json(route, null));
  await open(page, { live: [[]], history: [[]] }, { query: '?loc=lake:gone-lake' });
  // By role: while the page streams in, the hidden copy of the screen is in the DOM too.
  await expect(chip(page, 'Baltă: Locul ales. Schimbă')).toHaveText('Locul ales');
  await page.goto(`${routes.partideExplore()}?loc=water:L:NOPE`);
  await expect(chip(page, 'Baltă: Locul ales. Schimbă')).toHaveText('Locul ales');
});

test('c16 — after the first load a venue change never blanks the list (section-level pending only)', async ({ page }) => {
  const venueRow = finished('at-solo', { venue: { key: 'lake:solo-lake', venueType: 'lake', lakeId: 'solo-lake', name: 'Balta Solo', locality: 'Giurgiu', imageUrl: null } });
  const m = await open(page, {
    live: venue => (venue ? [[SOLO]] : [[SOLO, DUEL]]),
    history: venue => (venue ? [[venueRow]] : [[finished('fin-1')]]),
  }, { viewport: PHONE });
  await expect(page.getByTestId('venue-card-duel')).toBeVisible();

  m.state.delayMs = 1500;
  await chip(page, 'Filtrează după baltă: Toate bălțile').click();
  const dialog = page.getByRole('dialog', { name: 'Filtrează după baltă' });
  await dialog.getByTestId('venue-option').filter({ hasText: 'Balta Solo' }).click();
  await expect(dialog).toBeHidden();
  // The new key is in flight: the chip row stays, a section-level pending state, never the full skeleton.
  await expect(page.getByTestId('explore-section-skeleton').first()).toBeVisible();
  await expect(page.getByTestId('explore-skeleton')).toHaveCount(0);
  await expect(chip(page, 'Baltă: Balta Solo. Schimbă')).toBeVisible();
  await expect(page.getByTestId('venue-card-solo')).toBeVisible();
  await expect(page.getByTestId('history-card')).toContainText('Balta Solo');
  await expect(page.getByTestId('venue-card-duel')).toHaveCount(0);

  // Clearing the venue: the same — no full skeleton on the way back.
  await chip(page, 'Baltă: Balta Solo. Schimbă').click();
  await dialog.getByTestId('venue-option').first().click();
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId('explore-skeleton')).toHaveCount(0);
  await expect(page.getByTestId('venue-card-duel')).toBeVisible();
  await expect(page.getByTestId('explore-skeleton')).toHaveCount(0);
});

test('c19 — a failed half of the venue search is never «no results» (owner rule 4)', async ({ page }) => {
  const search = { lakes: 'error' as 'error' | 'ok', waters: [] as unknown[] };
  await page.route('**/feed/lakes/search*', route =>
    search.lakes === 'error'
      ? json(route, { error: { status: 500 } }, 500)
      : json(route, {
          data: [{ documentId: 'chita', name: 'Chita Lake', county: null, countyRef: { documentId: 'gr', name: 'Giurgiu' }, cityRef: null, regime: null, reviewsMeta: null, images: [], facility: [], fishSpecies: [] }],
          meta: { pagination: { page: 1, pageSize: 10, pageCount: 1, total: 1 } },
        }),
  );
  await page.route('**/ape-publice/api/search*', route => json(route, search.waters));
  await open(page, { live: [[SOLO]], history: [[]] });
  await expect(page.getByTestId('venue-card-solo')).toBeVisible();
  await chip(page, 'Filtrează după baltă: Toate bălțile').click();
  const dialog = page.getByRole('dialog', { name: 'Filtrează după baltă' });
  const field = dialog.getByRole('textbox', { name: 'Caută o baltă sau o apă publică' });

  // Lakes 500, waters []: nothing answered with rows — the error and its retry, never the empty copy.
  await field.fill('chi');
  const error = dialog.getByTestId('venue-picker-error');
  await expect(error).toContainText('Căutarea nu a mers.');
  await expect(dialog.getByTestId('venue-picker-empty')).toHaveCount(0);
  search.lakes = 'ok';
  await error.getByRole('button', { name: 'Încearcă din nou' }).click();
  await expect(dialog.getByTestId('venue-row')).toHaveText([/Chita Lake/]);
  await expect(error).toHaveCount(0);

  // Lakes 500, waters with a row: the waters show, the lakes half gets its own short retry.
  search.lakes = 'error';
  search.waters = [{ id: 1, name: 'Chiajna', type: 'river', county: 'Ilfov', countyId: 1, countyIds: [1], centerLat: 44, centerLng: 26, linkCode: 'RV:1', areaKm2: null }];
  await field.fill('chia');
  const partial = dialog.getByTestId('venue-picker-partial-error');
  await expect(partial).toContainText('Bălțile nu s-au încărcat.');
  await expect(dialog.getByTestId('venue-row')).toHaveText([/Chiajna/]);
  await expect(dialog.getByTestId('venue-picker-empty')).toHaveCount(0);
  search.lakes = 'ok';
  await partial.getByRole('button', { name: 'Încearcă din nou' }).click();
  await expect(dialog.getByTestId('venue-row')).toHaveText([/Chita Lake/, /Chiajna/]);
  await expect(partial).toHaveCount(0);
});
