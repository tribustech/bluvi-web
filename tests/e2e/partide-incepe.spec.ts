import { mkdirSync } from 'node:fs';
import type { BrowserContext, Page, Route } from '@playwright/test';
import { expectNoA11yViolations } from './helpers/a11y';
import { collectConsoleErrors } from './helpers/console';
import { expect, test, type FakeLiveDoc } from './helpers/fake-live';
import { CMS, qaJwt, signIn } from './helpers/session';

/*
 * partide.incepe — «Începe o partidă» (/partide/incepe; fish app/(app)/partide/start.tsx,
 * features/partide/components/VenuePicker.tsx, helpers/pinVenue.ts, helpers/venueSuggestions.ts).
 *
 * Data — NOTHING reaches Firestore and NOTHING is written to any CMS:
 *  - the live layer is the shared Firestore fake (helpers/fake-live.ts; a Firebase request fails the
 *    test); the new partidă's projection is seeded there so the page it lands on can follow it;
 *  - POST /feed/sessions is route-mocked (the body is recorded and asserted), as are the pointer
 *    (/feed/sessions/active), the own list (/feed/sessions/mine → «Folosite recent»), the lakes
 *    index (→ «Aproape de tine»), the lake detail (the local CMS's Chita Lake DTO reshaped: stands,
 *    coordinates), the lake search, the claimed waters and the fish catalog;
 *  - the public waters are the site's own dataset (/ape-publice/api/*, deterministic); the pin's
 *    point lookup (/partide/incepe/api/apa-la-punct) is mocked per tier;
 *  - the position is Playwright's geolocation (context permissions), or an init-script stand-in for
 *    the states a browser cannot be put in on demand (denied, unavailable, timeout).
 * The viewer is the real QA account (the session cookie).
 */

const SHOTS = '.shots/partide-incepe';
mkdirSync(SHOTS, { recursive: true });
const WIDTHS = [375, 1280, 1440, 1920] as const;

const LAKE = 'e2e-inc-lake';
const LAKE_PLAIN = 'e2e-inc-plain';
const LAKE_NOCOORD = 'e2e-inc-nocoord';
const NEW = { documentId: 'e2e-inc-new', clientId: 'e2e-inc-new-client' };
const LIVE = { documentId: 'e2e-inc-live', clientId: 'e2e-inc-live-client' };
const ORIGIN = { latitude: 44.43, longitude: 26.1 }; // Bucharest
const TIN = { code: 'L:RO10_01.025_L3', name: 'Tineretului' };

let jwt = '';
let selfId = '';
let lakeDto: Record<string, unknown> = {};
let lakeCard: Record<string, unknown> = {};

test.use({ timezoneId: 'Europe/Bucharest', locale: 'ro-RO' });

test.beforeAll(async ({ request }) => {
  jwt = await qaJwt(request);
  const me = await request.get(`${CMS}/user/profile`, { headers: { authorization: `Bearer ${jwt}` } });
  expect(me.ok(), 'QA profile read').toBe(true);
  selfId = (await me.json()).documentId as string;
  const lake = await request.get(`${CMS}/feed/lakes/s84u55lo4n9z0emngozttt6e`);
  expect(lake.ok(), 'local lake read (a valid DTO to shape)').toBe(true);
  lakeDto = (await lake.json()).data;
  const search = await request.get(`${CMS}/feed/lakes/search?q=Chita&pageSize=1`);
  lakeCard = (await search.json()).data[0];
});

/* ------------------------------------------------------------------------------------------------
 * Fixtures
 * ---------------------------------------------------------------------------------------------- */

const STANDS = [
  { documentId: 'st-10', name: 'Stand 10', coordinates: { lat: '44.60100', long: '26.30100' } },
  { documentId: 'st-2', name: 'Stand 2', coordinates: { lat: '44.55000', long: '26.25000' } },
];

const lakeDetail = (id: string, name: string, patch: Record<string, unknown> = {}) => ({
  ...lakeDto,
  documentId: id,
  name,
  county: 'Ilfov',
  countyRef: { id: 1, documentId: 'c-ilfov', name: 'Ilfov' },
  cityRef: { id: 2, documentId: 'c-snagov', name: 'Snagov' },
  coordinates: { lat: '44.60000', long: '26.30000' },
  stands: [],
  ...patch,
});

/** Built on use: lakeDto is read in beforeAll. */
const LAKES = (): Record<string, Record<string, unknown>> => ({
  [LAKE]: lakeDetail(LAKE, 'Balta cu Standuri', { stands: STANDS }),
  [LAKE_PLAIN]: lakeDetail(LAKE_PLAIN, 'Balta Simplă', { coordinates: { lat: '44.47000', long: '26.12000' } }),
  [LAKE_NOCOORD]: lakeDetail(LAKE_NOCOORD, 'Balta fără Coordonate', { coordinates: null }),
});

/** The lean index: three lakes near Bucharest (≤150 km), one near Snagov, one far (Satu Mare). */
const INDEX = [
  { documentId: LAKE_PLAIN, name: 'Balta Simplă', locality: 'Snagov, Ilfov', lat: 44.47, lng: 26.12, thumb: null },
  { documentId: LAKE, name: 'Balta cu Standuri', locality: 'Snagov, Ilfov', lat: 44.6, lng: 26.3, thumb: null },
  { documentId: 'e2e-inc-ix3', name: 'Balta Trei', locality: 'Giurgiu', lat: 44.0, lng: 25.97, thumb: null },
  { documentId: 'e2e-inc-ix4', name: 'Balta Patru', locality: 'Călărași', lat: 44.2, lng: 27.3, thumb: null },
  { documentId: 'e2e-inc-far', name: 'Balta Departe', locality: 'Satu Mare', lat: 47.79, lng: 22.88, thumb: null },
];

const mineItem = (patch: Record<string, unknown>) => ({
  documentId: `e2e-inc-m-${Math.random().toString(36).slice(2, 8)}`,
  clientId: 'x',
  clientUpdatedAt: null,
  venueType: 'lake',
  lakeId: null,
  lakeName: null,
  lakeImageUrl: null,
  publicWaterCode: null,
  publicWaterName: null,
  manualVenueName: null,
  standId: null,
  standName: null,
  locality: null,
  anchorLat: 44.5,
  anchorLong: 26.2,
  anchorName: null,
  startedAt: '2026-10-01T08:00:00.000Z',
  endedAt: '2026-10-01T18:00:00.000Z',
  plannedDurationMs: 36_000_000,
  notes: null,
  visibleOnProfile: true,
  status: 'finished',
  targetSpecies: [],
  hostUid: 'x',
  captures: 0,
  recordKg: null,
  totalKg: null,
  ...patch,
});

/** Four past partide: a pin (newest), a public water, a lake twice (one venue), another pin. */
const MINE = [
  mineItem({ venueType: 'pin', manualVenueName: 'Cotul Ionel', locality: 'Jud. Ialomița', anchorLat: 44.71, anchorLong: 27.41, startedAt: '2026-10-05T08:00:00.000Z' }),
  mineItem({ venueType: 'publicWater', publicWaterCode: 'L:e2e-olt', publicWaterName: 'Oltul Mock', locality: 'Râu · Olt', startedAt: '2026-10-04T08:00:00.000Z' }),
  mineItem({ venueType: 'lake', lakeId: 'e2e-inc-old', lakeName: 'Lacul Vechi', locality: 'Giurgiu', startedAt: '2026-10-03T08:00:00.000Z' }),
  mineItem({ venueType: 'lake', lakeId: 'e2e-inc-old', lakeName: 'Lacul Vechi', locality: 'Giurgiu', startedAt: '2026-09-03T08:00:00.000Z' }),
  mineItem({ venueType: 'pin', manualVenueName: 'Malul Doi', anchorLat: 45.1, anchorLong: 26.9, startedAt: '2026-09-01T08:00:00.000Z' }),
];

/** Seven catalog fish: «Crap» and «Caras» ranked first by priority, the rest A→Z. */
const FISHES = ['Crap', 'Caras', 'Amur', 'Biban', 'Plătică', 'Somn', 'Știucă'].map((Name, i) => ({
  id: i + 1,
  documentId: `fish-${i + 1}`,
  Name,
  competitionPriority: Name === 'Crap' ? 1 : Name === 'Caras' ? 2 : null,
  partidaDefaultRank: null,
}));

const createdDto = (body: Record<string, unknown>) => ({
  documentId: NEW.documentId,
  clientId: body.clientId,
  clientUpdatedAt: body.clientUpdatedAt ?? null,
  venueType: body.venueType,
  lakeId: body.lakeId ?? null,
  lakeName: null,
  lakeImageUrl: null,
  publicWaterCode: body.publicWaterCode ?? null,
  publicWaterName: body.publicWaterName ?? null,
  manualVenueName: body.manualVenueName ?? null,
  standId: body.standId ?? null,
  standName: null,
  locality: body.locality ?? null,
  anchorLat: body.anchorLat,
  anchorLong: body.anchorLong,
  anchorName: body.anchorName ?? null,
  startedAt: body.startedAt,
  endedAt: null,
  plannedDurationMs: body.plannedDurationMs,
  notes: null,
  visibleOnProfile: body.visibleOnProfile,
  status: 'active',
  targetSpecies: body.targetSpecies,
  hostUid: selfId,
  joinCode: 'NEW123',
  rods: [],
  members: [{ uid: selfId, name: 'Eu Pescar', avatar: null, joinedAt: body.startedAt }],
  firestoreId: NEW.clientId,
});

const newDoc = (): FakeLiveDoc => ({
  startedAt: new Date().toISOString(),
  status: 'active',
  venueType: 'lake',
  lakeId: LAKE,
  lakeName: 'Balta cu Standuri',
  locality: 'Snagov, Ilfov',
  anchorLat: 44.55,
  anchorLong: 26.25,
  plannedDurationMs: 24 * 3_600_000,
  visibleOnProfile: true,
  hostUid: selfId,
  joinCode: 'NEW123',
  members: [{ uid: selfId, name: 'Eu Pescar', avatar: null, joinedAt: new Date().toISOString() }],
  rods: [],
  catches: [],
});

/* ------------------------------------------------------------------------------------------------
 * Mocks
 * ---------------------------------------------------------------------------------------------- */

type PointAnswer = { water: Record<string, unknown> | null; county: string | null };
type Opts = {
  mine?: unknown[];
  index?: unknown[];
  fishes?: 'ok' | 'fail';
  live?: boolean;
  create?: { status: number; body?: unknown; delayMs?: number };
  point?: PointAnswer;
  pointDelayMs?: number;
  claimed?: { linkCode: string; lakeDocumentId: string }[];
  search?: unknown[];
};
type Calls = { create: Record<string, unknown>[]; point: string[]; geo: () => Promise<number> };

/** Public reads go straight to the CMS (cross-origin, NEXT_PUBLIC_CMS_URL): the answer carries CORS. */
const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });

async function mock(page: Page, o: Opts = {}): Promise<Calls> {
  const calls: Calls = { create: [], point: [], geo: () => page.evaluate(() => (window as unknown as { __geoCalls?: number }).__geoCalls ?? 0) };
  await page.route(/tiles\.openfreemap\.org|arcgisonline\.com/, r => r.abort());
  await page.route(/\/fishes(\?.*)?$/, r => (o.fishes === 'fail' ? json(r, { error: { status: 500 } }, 500) : json(r, { data: FISHES, meta: {} })));
  await page.route(/\/feed\/lakes\/index(\?.*)?$/, r => json(r, { data: o.index ?? INDEX }));
  await page.route(/\/feed\/public-waters\/claimed(\?.*)?$/, r => json(r, { data: o.claimed ?? [] }));
  await page.route(/\/feed\/lakes\/search(\?.*)?$/, r => {
    const q = new URL(r.request().url()).searchParams.get('q');
    const data = q ? (o.search ?? []).filter(l => String((l as { name: string }).name).toLowerCase().includes(q.toLowerCase())) : [lakeCard];
    return json(r, { data, meta: { pagination: { page: 1, pageSize: 10, pageCount: 1, total: data.length } } });
  });
  await page.route(/\/feed\/lakes\/(e2e-inc-[^/?]+)(\?.*)?$/, r => {
    const id = /\/feed\/lakes\/(e2e-inc-[^/?]+)/.exec(r.request().url())![1];
    const lakes = LAKES();
    return lakes[id] ? json(r, { data: lakes[id] }) : json(r, { data: null, error: { status: 404, name: 'NotFoundError', message: 'Not Found', details: {} } }, 404);
  });
  await page.route('**/api/cms/feed/session-follows/mine', r => json(r, { data: { sessionDocumentIds: [] } }));
  await page.route('**/api/cms/feed/sessions/active', r =>
    json(r, { data: o.live ? { documentId: LIVE.documentId, clientId: LIVE.clientId, firestoreId: LIVE.clientId } : null }),
  );
  const mine = o.mine ?? [];
  await page.route(/\/api\/cms\/feed\/sessions\/mine(\?.*)?$/, r => json(r, { data: mine, meta: { page: 1, pageSize: 100, total: mine.length } }));
  await page.route(/\/api\/cms\/feed\/sessions(\?.*)?$/, async r => {
    if (r.request().method() !== 'POST') return r.fallback();
    const body = (r.request().postDataJSON() as { data: Record<string, unknown> }).data;
    calls.create.push(body);
    const c = o.create ?? { status: 200 };
    if (c.delayMs) await new Promise(res => setTimeout(res, c.delayMs));
    if (c.status === 200) return json(r, { data: createdDto(body) });
    return json(r, c.body ?? { data: null, error: { status: c.status, name: 'Error', message: 'mock', details: {} } }, c.status);
  });
  await page.route(/\/api\/cms\/feed\/(community\/)?sessions\/e2e-inc-/, r => json(r, { data: null, error: { status: 404, name: 'NotFoundError', message: 'Not Found', details: {} } }, 404));
  await page.route(/\/partide\/incepe\/api\/apa-la-punct/, async r => {
    calls.point.push(r.request().url());
    if (o.pointDelayMs) await new Promise(res => setTimeout(res, o.pointDelayMs));
    return json(r, o.point ?? { water: null, county: 'Brașov' });
  });
  return calls;
}

/** The position: granted (Playwright's emulation), or a stand-in for a blocked / failing device. */
async function geo(page: Page, context: BrowserContext, mode: 'granted' | 'prompt' | 'denied' | 'unavailable' | 'timeout') {
  if (mode === 'granted') {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation(ORIGIN);
  }
  await page.addInitScript(
    ({ mode }) => {
      const w = window as unknown as { __geoCalls: number };
      w.__geoCalls = 0;
      const geo = navigator.geolocation;
      const real = geo.getCurrentPosition.bind(geo);
      const perm = mode === 'granted' ? 'granted' : mode === 'denied' ? 'denied' : mode === 'prompt' ? 'prompt' : 'granted';
      const query = navigator.permissions.query.bind(navigator.permissions);
      navigator.permissions.query = ((d: PermissionDescriptor) =>
        d.name === 'geolocation'
          ? Promise.resolve({ state: perm, onchange: null, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => true } as unknown as PermissionStatus)
          : query(d)) as typeof navigator.permissions.query;
      geo.getCurrentPosition = (ok: PositionCallback, ko?: PositionErrorCallback | null, opts?: PositionOptions) => {
        w.__geoCalls += 1;
        if (mode === 'granted' || mode === 'prompt') return real(ok, ko, opts);
        const code = mode === 'denied' ? 1 : mode === 'unavailable' ? 2 : 3;
        setTimeout(() => ko?.({ code, message: mode, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as GeolocationPositionError), 20);
      };
    },
    { mode },
  );
}

async function open(page: Page, path = '/partide/incepe', width = 1280) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(path);
  await expect(page.getByRole('heading', { level: 1, name: 'Începe o partidă' })).toBeVisible();
}

const toast = (page: Page, text: string) => page.getByText(text, { exact: true }).filter({ visible: true });
const section = (page: Page, id: 'nearby' | 'recent' | 'random') => page.getByTestId(`venue-section-${id}`);
const rowNames = (page: Page, id: 'nearby' | 'recent' | 'random') =>
  section(page, id).getByTestId('venue-row').evaluateAll(rows => rows.map(r => r.querySelector('.t-body-strong')?.textContent?.trim()));
const preview = (page: Page) => page.getByTestId(/^anchor-preview/).filter({ visible: true }).first();
const submit = (page: Page) => page.getByTestId('start-submit');

async function pickVenueFromSearch(page: Page, term: string, name: string) {
  await page.getByTestId('venue-search').fill(term);
  await page.getByTestId('venue-results').getByRole('button', { name: new RegExp(name) }).click();
  await expect(page.getByTestId('start-venue-name')).toHaveText(name);
}

async function confirmMapAt(page: Page) {
  const body = page.getByTestId('map-point-picker-body');
  await expect(body).toHaveAttribute('data-state', 'ready', { timeout: 20_000 });
  const lat = Number(await body.getAttribute('data-lat'));
  const lng = Number(await body.getAttribute('data-lng'));
  await page.getByTestId('map-point-picker-confirm').click();
  return { lat, lng };
}

test.beforeEach(async ({ context }) => {
  await signIn(context, jwt);
});

/* ------------------------------------------------------------------------------------------------
 * c1 — signed out
 * ---------------------------------------------------------------------------------------------- */

test('partide.incepe.c1 signed out: the route goes to sign-in and comes back with its query', async ({ page, context }) => {
  await context.clearCookies();
  await page.goto(`/partide/incepe?balta=${LAKE}`);
  await expect.poll(() => new URL(page.url()).pathname).toBe('/intra');
  expect(new URL(page.url()).searchParams.get('next')).toBe(`/partide/incepe?balta=${LAKE}`);
});

/* ------------------------------------------------------------------------------------------------
 * c2 c3 c4 — the venue step at every width
 * ---------------------------------------------------------------------------------------------- */

for (const width of WIDTHS) {
  test(`partide.incepe.c2 c3 c4 the venue step at ${width}: title, back, step 1 of 2, search, pin card, nearby + recent — axe clean`, async ({ page, context }) => {
    const errors = collectConsoleErrors(page, { ignore: [/Failed to load resource/] });
    await geo(page, context, 'granted');
    await mock(page, { mine: MINE });
    await open(page, '/partide/incepe', width);
    // c2
    await expect(page.getByRole('button', { name: 'Înapoi' }).first()).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Pașii partidei' }).filter({ visible: true })).toBeVisible();
    if (width >= 768) await expect(page.getByText('Pasul 1 din 2', { exact: true }).filter({ visible: true }).first()).toBeVisible();
    // c3
    await expect(page.getByTestId('venue-search')).toHaveAttribute('placeholder', 'Caută o baltă sau o apă publică...');
    await expect(page.getByTestId('drop-pin')).toContainText('Pune un pin pe hartă');
    await expect(page.getByTestId('drop-pin')).toContainText('Pentru un loc care nu e în listă');
    // c4: nearby — ≤3 lakes within 150 km + the nearest waters, 5 rows, one distance order.
    await expect(section(page, 'nearby')).toBeVisible();
    const nearby = await rowNames(page, 'nearby');
    expect(nearby).toHaveLength(5);
    expect(nearby).not.toContain('Balta Departe');
    expect(nearby.filter(n => n?.startsWith('Balta'))).toHaveLength(3);
    expect(nearby).toContain(TIN.name);
    await expect(section(page, 'nearby').getByTestId('venue-row').first()).toContainText(/km/);
    // c4: recent — newest first, one row per venue, 3 under «Aproape de tine».
    expect(await rowNames(page, 'recent')).toEqual(['Cotul Ionel', 'Oltul Mock', 'Lacul Vechi']);
    await expect(section(page, 'random')).toHaveCount(0);
    await expect(page.getByTestId('location-permission-card')).toHaveCount(0);
    await expectNoA11yViolations(page);
    await page.screenshot({ path: `${SHOTS}/venue-${width}.png`, fullPage: true });
    expect(errors).toEqual([]);
  });
}

test('partide.incepe.c4 never asked: the permission card, no position request before the gesture; «Permite locația» asks, nearby fills in', async ({ page, context }) => {
  const errors = collectConsoleErrors(page);
  await geo(page, context, 'prompt');
  const calls = await mock(page);
  await open(page, '/partide/incepe', 375);
  const card = page.getByTestId('location-permission-card');
  await expect(card).toContainText('Descoperă bălți aproape de tine');
  await expect(card).toContainText('Permite locația și îți arătăm instant locurile din apropiere.');
  // Nothing recent and no position: «Sugestii» (random catalog lakes, ≤5).
  await expect(section(page, 'random')).toBeVisible();
  expect((await rowNames(page, 'random')).length).toBeLessThanOrEqual(5);
  await page.waitForTimeout(500);
  expect(await calls.geo(), 'no geolocation request without a user gesture').toBe(0);
  await expectNoA11yViolations(page);
  await page.screenshot({ path: `${SHOTS}/never-asked-375.png`, fullPage: true });
  // The gesture: the browser is asked (granted here), «Aproape de tine» replaces the card.
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation(ORIGIN);
  await card.getByText('Permite locația', { exact: true }).click();
  await expect(section(page, 'nearby')).toBeVisible();
  expect(await calls.geo()).toBeGreaterThan(0);
  await expect(section(page, 'random')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('partide.incepe.c4 denied: «Activează locația din setări», whose press says how to unblock it', async ({ page, context }) => {
  await geo(page, context, 'denied');
  await mock(page, { mine: MINE });
  await open(page, '/partide/incepe', 375);
  const card = page.getByTestId('location-permission-card');
  await expect(card).toContainText('Activează locația din setări');
  await expect(card).toContainText('Deschide setările');
  // Recent alone: 5 at most (here the 4 distinct venues).
  expect(await rowNames(page, 'recent')).toEqual(['Cotul Ionel', 'Oltul Mock', 'Lacul Vechi', 'Malul Doi']);
  await card.click();
  await expect(page.getByRole('dialog')).toContainText('Locația e blocată pentru Bluvi în acest browser');
  await expectNoA11yViolations(page);
  await page.screenshot({ path: `${SHOTS}/denied-375.png`, fullPage: true });
});

test('partide.incepe.c4 unavailable: «Activează locația dispozitivului»', async ({ page, context }) => {
  await geo(page, context, 'unavailable');
  await mock(page);
  await open(page, '/partide/incepe', 1280);
  await expect(page.getByTestId('location-permission-card')).toContainText('Activează locația dispozitivului');
  await expect(page.getByTestId('location-permission-card')).toContainText('Permisiunea e dată, dar locația telefonului este oprită.');
});

test('partide.incepe.c4 unresolved: the retry card «Nu am putut afla locația» — «Reîncearcă» asks again', async ({ page, context }) => {
  await geo(page, context, 'timeout');
  const calls = await mock(page);
  await open(page, '/partide/incepe', 375);
  const card = page.getByTestId('nearby-location-retry');
  await expect(card).toContainText('Nu am putut afla locația');
  await expect(card).toContainText('GPS-ul nu a răspuns încă. Încearcă din nou într-un loc deschis.');
  await expect(page.getByTestId('location-permission-card')).toHaveCount(0);
  const before = await calls.geo();
  await card.click();
  await expect.poll(() => calls.geo()).toBeGreaterThan(before);
  await expectNoA11yViolations(page);
  await page.screenshot({ path: `${SHOTS}/unresolved-375.png`, fullPage: true });
});

test('partide.incepe.c4 while the suggestions load: the skeleton, never empty sections', async ({ page, context }) => {
  await geo(page, context, 'granted');
  await mock(page);
  await page.route(/\/api\/cms\/feed\/sessions\/mine(\?.*)?$/, async r => {
    await new Promise(res => setTimeout(res, 1500));
    return json(r, { data: [], meta: { page: 1, pageSize: 100, total: 0 } });
  });
  await open(page, '/partide/incepe', 375);
  await expect(page.getByTestId('venue-suggestions-skeleton')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/loading-375.png`, fullPage: true });
  await expect(section(page, 'nearby')).toBeVisible();
});

test('partide.incepe.c3 search: from 2 characters, lakes first then public waters; «Niciun rezultat pentru „…”.»', async ({ page, context }) => {
  await geo(page, context, 'granted');
  await mock(page, { search: [{ ...lakeCard, documentId: LAKE, name: 'Balta Tineretului' }] });
  await open(page, '/partide/incepe', 1280);
  const input = page.getByTestId('venue-search');
  await input.fill('T');
  await page.waitForTimeout(400);
  await expect(page.getByTestId('venue-results')).toHaveCount(0);
  await expect(section(page, 'nearby')).toBeVisible();
  await input.fill('Tineretului');
  const rows = page.getByTestId('venue-results').getByTestId('venue-row');
  await expect(rows.first()).toHaveAttribute('data-kind', 'lake');
  await expect(rows.first()).toContainText('Balta Tineretului');
  const water = rows.filter({ has: page.locator('.t-body-strong', { hasText: new RegExp(`^${TIN.name}$`) }) }).first();
  await expect(water).toHaveAttribute('data-kind', 'publicWater');
  await expect(water).toContainText('Lac natural · București');
  await expect(section(page, 'nearby')).toHaveCount(0);
  await expectNoA11yViolations(page);
  await page.screenshot({ path: `${SHOTS}/search-1280.png`, fullPage: true });
  await input.fill('zzqxwvv');
  await expect(page.getByTestId('venue-no-results')).toHaveText('Niciun rezultat pentru „zzqxwvv”.');
  await page.screenshot({ path: `${SHOTS}/no-results-375.png`, fullPage: true });
});

/* ------------------------------------------------------------------------------------------------
 * c5 c6 — a pin on the map
 * ---------------------------------------------------------------------------------------------- */

test('partide.incepe.c5 c6 a pin on nothing known: «Verificăm locul...», then «Loc nou pe hartă» with the coordinates and «Nume loc»; «Continuă» names it «Loc nou»', async ({ page, context }) => {
  await geo(page, context, 'granted');
  const calls = await mock(page, { point: { water: null, county: 'Brașov' }, pointDelayMs: 800 });
  await open(page, '/partide/incepe', 375);
  await page.getByTestId('drop-pin').click();
  await expect(page.getByRole('heading', { name: 'Alege locul' })).toBeVisible();
  const at = await confirmMapAt(page);
  await expect(page.getByTestId('pin-resolving')).toContainText('Verificăm locul...');
  const naming = page.getByTestId('pin-naming');
  await expect(naming).toContainText('Loc nou pe hartă');
  await expect(naming).toContainText(`${at.lat.toFixed(4)}, ${at.lng.toFixed(4)}`);
  await expect(naming.getByLabel('Nume loc')).toHaveAttribute('placeholder', 'ex. Cot Dunăre');
  await expect(naming.getByLabel('Nume loc')).toHaveValue('');
  expect(calls.point.length).toBe(1);
  await expectNoA11yViolations(page);
  await page.screenshot({ path: `${SHOTS}/pin-naming-375.png`, fullPage: true });
  // «Înapoi» returns to the picker.
  await naming.getByRole('button', { name: 'Înapoi' }).click();
  await expect(page.getByTestId('venue-search')).toBeVisible();
  // Again, then «Continuă» with no name: «Loc nou», the pin county as the locality.
  await page.getByTestId('drop-pin').click();
  await confirmMapAt(page);
  await page.getByTestId('pin-naming').getByRole('button', { name: 'Continuă' }).click();
  await expect(page.getByTestId('start-venue-name')).toHaveText('Loc nou');
  await expect(page.getByTestId('start-venue-locality')).toHaveText('Jud. Brașov');
  await expect(preview(page)).toHaveAttribute('data-lat', at.lat.toFixed(5));
  await expect(preview(page)).toHaveAttribute('data-lng', at.lng.toFixed(5));
});

test('partide.incepe.c5 a catalog lake within 400 m of the pin wins; the pin stays the anchor', async ({ page, context }) => {
  await geo(page, context, 'granted');
  // ROMANIA_CENTER is where the picker opens: an index lake ~100 m away.
  const calls = await mock(page, { index: [...INDEX, { documentId: LAKE_PLAIN, name: 'Balta Simplă', locality: 'Brașov', lat: 45.9409, lng: 24.97, thumb: null }] });
  await open(page, '/partide/incepe', 1280);
  await page.getByTestId('drop-pin').click();
  const at = await confirmMapAt(page);
  await expect(page.getByTestId('start-venue-name')).toHaveText('Balta Simplă');
  await expect(page.getByTestId('start-venue-locality')).toHaveText('Brașov');
  await expect(preview(page)).toHaveAttribute('data-lat', at.lat.toFixed(5));
  expect(calls.point, 'the lake tier needs no water lookup').toEqual([]);
});

test('partide.incepe.c5 a public water at the pin: the water; a water claimed by a lake: that lake', async ({ page, context }) => {
  await geo(page, context, 'granted');
  const water = { id: 9, name: 'Lacul Mock', type: 'reservoir_lake', county: 'Brașov', countyId: 8, countyIds: [8], centerLat: 45.9, centerLng: 24.9, linkCode: 'R:e2e-mock', areaKm2: 1.2 };
  await mock(page, { point: { water, county: 'Brașov' } });
  await open(page, '/partide/incepe', 1280);
  await page.getByTestId('drop-pin').click();
  const at = await confirmMapAt(page);
  await expect(page.getByTestId('start-venue-name')).toHaveText('Lacul Mock');
  await expect(page.getByTestId('start-venue-locality')).toHaveText('Brașov');
  await expect(preview(page)).toHaveAttribute('data-lat', at.lat.toFixed(5));
  // The same water, claimed by a lake → the lake (its name and locality), the pin still the anchor.
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await mock(page, { point: { water, county: 'Brașov' }, claimed: [{ linkCode: 'R:e2e-mock', lakeDocumentId: LAKE_PLAIN }] });
  await page.goto('/partide/incepe');
  await page.getByTestId('drop-pin').click();
  const at2 = await confirmMapAt(page);
  await expect(page.getByTestId('start-venue-name')).toHaveText('Balta Simplă');
  await expect(page.getByTestId('start-venue-locality')).toHaveText('Snagov, Ilfov');
  await expect(preview(page)).toHaveAttribute('data-lat', at2.lat.toFixed(5));
});

/* ------------------------------------------------------------------------------------------------
 * c7 c8 c9 — step 2: venue card, stand, position
 * ---------------------------------------------------------------------------------------------- */

for (const width of WIDTHS) {
  test(`partide.incepe.c7 c8 c10 c11 c12 a lake with stands at ${width}: the venue card, «Alege standul» first (dimmed preview), durations, species, public — axe clean`, async ({ page, context }) => {
    await geo(page, context, 'granted');
    await mock(page);
    await open(page, `/partide/incepe?balta=${LAKE}`, width);
    // c7
    await expect(page.getByTestId('start-venue-name')).toHaveText('Balta cu Standuri');
    await expect(page.getByTestId('start-venue-locality')).toHaveText('Snagov, Ilfov');
    await expect(page.getByTestId('start-venue-change')).toHaveText('Schimbă');
    // c8
    await expect(page.getByTestId('start-stand-select')).toHaveText('Alege standul');
    await expect(page.getByTestId('start-stand-hint')).toHaveText('Alege standul, apoi poți ajusta poziția pe hartă.');
    await expect(preview(page)).toHaveAttribute('data-state', 'dimmed');
    if (width >= 1280) await expect(page.getByTestId('start-position-aside')).toBeVisible();
    // c10
    const duration = page.getByTestId('start-duration');
    await expect(duration.getByRole('radio')).toHaveCount(6);
    for (const label of ['12h', '1 zi', '2 zile', '3 zile', '7 zile', 'Alta']) await expect(duration.getByRole('radio', { name: label })).toBeVisible();
    await expect(duration.getByRole('radio', { name: '1 zi' })).toBeChecked();
    // c11: the first 6 catalog fish (priority, then A→Z) + «Vezi toate»
    const species = page.getByTestId('start-species');
    await expect(species.getByRole('button')).toHaveText(['Crap', 'Caras', 'Amur', 'Biban', 'Plătică', 'Somn', 'Vezi toate']);
    // c12
    await expect(page.getByTestId('start-public')).toContainText('Partidă publică');
    await expect(page.getByTestId('start-public')).toContainText('Vizibilă în comunitate și pe profil — ceilalți văd doar capturile, nu locul exact sau alte detalii.');
    await expect(page.getByRole('switch', { name: 'Partidă publică' })).toBeChecked();
    await expect(submit(page)).toBeEnabled();
    await expectNoA11yViolations(page);
    await page.screenshot({ path: `${SHOTS}/detail-stands-${width}.png`, fullPage: true });
  });
}

test('partide.incepe.c8 the dimmed preview opens the stands; a stand re-anchors and opens the adjust map; «Șterge standul» goes back to the lake', async ({ page, context }) => {
  await geo(page, context, 'granted');
  await mock(page);
  await open(page, `/partide/incepe?balta=${LAKE}`, 375);
  await expect(preview(page)).toHaveAttribute('data-lat', '44.60000');
  await preview(page).click();
  const list = page.getByTestId('stand-picker');
  await expect(list).toBeVisible();
  await list.getByRole('button', { name: 'Stand 2' }).click();
  await expect(page.getByRole('heading', { name: 'Ajustează poziția' })).toBeVisible();
  await expect(page.getByTestId('map-point-picker-body')).toHaveAttribute('data-lat', '44.550000');
  await page.getByTestId('map-point-picker').getByRole('button', { name: 'Închide' }).click();
  await expect(page.getByTestId('start-stand-select')).toHaveText('Stand 2');
  await expect(page.getByTestId('start-stand-hint')).toHaveCount(0);
  await expect(preview(page)).toHaveAttribute('data-state', 'ready');
  await expect(preview(page)).toHaveAttribute('data-lat', '44.55000');
  await page.screenshot({ path: `${SHOTS}/stand-chosen-375.png`, fullPage: true });
  // Pressing the preview now opens the adjust map on the stand.
  await preview(page).click();
  await expect(page.getByTestId('map-point-picker-body')).toHaveAttribute('data-lat', '44.550000');
  await page.getByTestId('map-point-picker').getByRole('button', { name: 'Închide' }).click();
  await page.getByRole('button', { name: 'Șterge standul' }).click();
  await expect(page.getByTestId('start-stand-select')).toHaveText('Alege standul');
  await expect(preview(page)).toHaveAttribute('data-lat', '44.60000');
});

test('partide.incepe.c9 a venue without stands: «Poziție» preview opens the adjust map; the optional spot name', async ({ page, context }) => {
  await geo(page, context, 'granted');
  await mock(page);
  await open(page, `/partide/incepe?balta=${LAKE_PLAIN}`, 375);
  await expect(page.getByTestId('start-stand-select')).toHaveCount(0);
  await expect(page.locator('#start-position')).toContainText('Poziție');
  await expect(page.getByLabel('Nume standul / locul (opțional)')).toBeVisible();
  await preview(page).click();
  await expect(page.getByRole('heading', { name: 'Ajustează poziția' })).toBeVisible();
  await expect(page.getByTestId('map-point-picker-body')).toHaveAttribute('data-lat', '44.470000');
  await page.getByTestId('map-point-picker').getByRole('button', { name: 'Închide' }).click();
  await expectNoA11yViolations(page);
  await page.screenshot({ path: `${SHOTS}/detail-plain-375.png`, fullPage: true });
});

test('partide.incepe.c7 «Schimbă» resets the venue, anchor, spot name and stand and returns to step 1', async ({ page, context }) => {
  await geo(page, context, 'granted');
  await mock(page, { search: [{ ...lakeCard, documentId: LAKE_PLAIN, name: 'Balta Simplă' }] });
  await open(page, `/partide/incepe?balta=${LAKE}`, 1280);
  await preview(page).click();
  await page.getByTestId('stand-picker').getByRole('button', { name: 'Stand 10' }).click();
  await page.getByTestId('map-point-picker').getByRole('button', { name: 'Închide' }).click();
  await expect(page.getByTestId('start-stand-select')).toHaveText('Stand 10');
  await page.getByTestId('start-venue-change').click();
  await expect(page.getByTestId('venue-search')).toBeVisible();
  await expect(page.getByText('Pasul 1 din 2', { exact: true }).filter({ visible: true }).first()).toBeVisible();
  // Another venue: nothing of the old one survives (no stand, the new lake's own anchor, an empty name).
  await pickVenueFromSearch(page, 'Simpl', 'Balta Simplă');
  await expect(page.getByTestId('start-stand-select')).toHaveCount(0);
  await expect(page.getByLabel('Nume standul / locul (opțional)')).toHaveValue('');
  await expect(preview(page)).toHaveAttribute('data-lat', '44.47000');
});

/* ------------------------------------------------------------------------------------------------
 * c10 c11 c12 c13 — the create
 * ---------------------------------------------------------------------------------------------- */

test('partide.incepe.c10 c11 c12 c13 the create: venue, stand (no spot name), custom duration, species, private — then /partide/[documentId] and the pointer', async ({ page, context, fakeLive }) => {
  await fakeLive.seed({ docs: { [NEW.clientId]: newDoc() } });
  await geo(page, context, 'granted');
  const calls = await mock(page, { create: { status: 200, delayMs: 600 } });
  await open(page, `/partide/incepe?balta=${LAKE}`, 1440);
  await preview(page).click();
  await page.getByTestId('stand-picker').getByRole('button', { name: 'Stand 2' }).click();
  await page.getByTestId('map-point-picker').getByRole('button', { name: 'Închide' }).click();
  // c10: «Alta» — 2 zile 5 ore.
  await page.getByTestId('start-duration').getByText('12h').click();
  await expect(page.getByTestId('start-duration').getByRole('radio', { name: '12h' })).toBeChecked();
  await page.getByTestId('start-duration').getByText('Alta').click();
  await page.getByLabel('Zile', { exact: true }).selectOption('2');
  await page.getByLabel('Ore', { exact: true }).selectOption('5');
  await expect(page.getByTestId('start-duration-custom')).toContainText('Total: 2 zile și 5 ore');
  // c11: a chip toggles; «Vezi toate» adds one outside the six — it gets a chip, first.
  await page.getByTestId('start-species').getByRole('button', { name: 'Crap' }).click();
  await expect(page.getByTestId('start-species').getByRole('button', { name: 'Crap' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('start-species-all').click();
  await page.getByTestId('species-picker').getByRole('checkbox', { name: 'Știucă' }).click();
  await page.getByTestId('species-picker-save').click();
  await expect(page.getByTestId('start-species').getByRole('button').first()).toHaveText('Crap');
  await expect(page.getByTestId('start-species').getByRole('button', { name: 'Știucă' })).toHaveAttribute('aria-pressed', 'true');
  // c12: private.
  await page.getByRole('switch', { name: 'Partidă publică' }).click();
  await expect(page.getByRole('switch', { name: 'Partidă publică' })).not.toBeChecked();
  await page.screenshot({ path: `${SHOTS}/ready-1440.png`, fullPage: true });
  // c13
  await submit(page).click();
  await expect(submit(page)).toHaveText('Se pornește…');
  await expect(page).toHaveURL(new RegExp(`/partide/${NEW.documentId}$`));
  expect(calls.create).toHaveLength(1);
  const body = calls.create[0];
  expect(body).toMatchObject({
    venueType: 'lake',
    lakeId: LAKE,
    publicWaterCode: null,
    manualVenueName: null,
    standId: 'st-2',
    locality: 'Snagov, Ilfov',
    anchorLat: 44.55,
    anchorLong: 26.25,
    anchorName: null,
    endedAt: null,
    plannedDurationMs: 53 * 3_600_000,
    visibleOnProfile: false,
    rods: [],
    targetSpecies: [
      { documentId: 'fish-1', name: 'Crap' },
      { documentId: 'fish-7', name: 'Știucă' },
    ],
  });
  expect(typeof body.clientId).toBe('string');
  // The pointer is claimed: the new partidă's projection is followed (the fake, never Firestore).
  await expect.poll(() => fakeLive.subscribed()).toContain(NEW.clientId);
});

test('partide.incepe.c13 a public water: the code, the type line as locality, the spot name; the default 1 zi, public', async ({ page, context, fakeLive }) => {
  await fakeLive.seed({ docs: { [NEW.clientId]: newDoc() } });
  await geo(page, context, 'granted');
  const calls = await mock(page);
  await open(page, `/partide/incepe?apa=${encodeURIComponent(TIN.code)}`, 375);
  await expect(page.getByTestId('start-venue-name')).toHaveText(TIN.name);
  await expect(page.getByTestId('start-venue-locality')).toHaveText('Lac natural');
  await page.getByLabel('Nume standul / locul (opțional)').fill('  Lângă ponton ');
  await submit(page).click();
  await expect(page).toHaveURL(new RegExp(`/partide/${NEW.documentId}$`));
  expect(calls.create[0]).toMatchObject({
    venueType: 'publicWater',
    lakeId: null,
    publicWaterCode: TIN.code,
    publicWaterName: TIN.name,
    locality: 'Lac natural',
    anchorName: 'Lângă ponton',
    standId: null,
    plannedDurationMs: 24 * 3_600_000,
    visibleOnProfile: true,
    targetSpecies: [],
  });
});

test('partide.incepe.c13 a lake without coordinates: «Fixează poziția pe hartă», «Începe partida» disabled until a point is set', async ({ page, context }) => {
  await geo(page, context, 'granted');
  const calls = await mock(page);
  await open(page, `/partide/incepe?balta=${LAKE_NOCOORD}`, 375);
  await expect(preview(page)).toHaveAttribute('data-state', 'missing');
  await expect(preview(page)).toContainText('Fixează poziția pe hartă');
  await expect(submit(page)).toBeDisabled();
  await page.screenshot({ path: `${SHOTS}/no-anchor-375.png`, fullPage: true });
  await submit(page).click({ force: true });
  expect(calls.create).toEqual([]);
  await preview(page).click();
  await expect(page.getByRole('heading', { name: 'Ajustează poziția' })).toBeVisible();
  await confirmMapAt(page);
  await expect(preview(page)).toHaveAttribute('data-state', 'ready');
  await expect(submit(page)).toBeEnabled();
});

/* ------------------------------------------------------------------------------------------------
 * c14 — refusals
 * ---------------------------------------------------------------------------------------------- */

test('partide.incepe.c14 the CMS refuses with PARTIDA:ALREADY_ACTIVE: «Ai deja o partidă activă» and that partidă opens (pointer rebuilt)', async ({ page, context, fakeLive }) => {
  await fakeLive.seed({ docs: { [LIVE.clientId]: { ...newDoc() } } });
  await geo(page, context, 'granted');
  await mock(page, {
    create: {
      status: 400,
      body: {
        data: null,
        error: {
          status: 400,
          name: 'BadRequestError',
          message: 'Ai deja o partidă în desfășurare. Încheie-o înainte să începi alta.',
          details: { bluCode: 'PARTIDA:ALREADY_ACTIVE', activeSessionDocumentId: LIVE.documentId, activeSessionClientId: LIVE.clientId },
        },
      },
    },
  });
  await open(page, `/partide/incepe?balta=${LAKE_PLAIN}`, 1280);
  await submit(page).click();
  await expect(toast(page, 'Ai deja o partidă activă')).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/partide/${LIVE.documentId}$`));
  await expect.poll(() => fakeLive.subscribed()).toContain(LIVE.clientId);
});

test('partide.incepe.c14 a live pointer on this browser refuses locally (no POST): «Ai deja o partidă activă» + that partidă', async ({ page, context, fakeLive }) => {
  await fakeLive.seed({ docs: { [LIVE.clientId]: { ...newDoc() } } });
  await geo(page, context, 'granted');
  const calls = await mock(page, { live: true });
  await open(page, `/partide/incepe?balta=${LAKE_PLAIN}`, 1280);
  await expect.poll(() => fakeLive.subscribed()).toContain(LIVE.clientId);
  await submit(page).click();
  await expect(toast(page, 'Ai deja o partidă activă')).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/partide/${LIVE.documentId}$`));
  expect(calls.create).toEqual([]);
});

test('partide.incepe.c14 any other failure: «Ceva n-a mers. Încearcă din nou.», the form stays as it was', async ({ page, context }) => {
  const errors = collectConsoleErrors(page, { ignore: [/Failed to load resource/] });
  await geo(page, context, 'granted');
  const calls = await mock(page, { create: { status: 500 } });
  await open(page, `/partide/incepe?balta=${LAKE_PLAIN}`, 375);
  await page.getByLabel('Nume standul / locul (opțional)').fill('Ponton');
  await submit(page).click();
  await expect(toast(page, 'Ceva n-a mers. Încearcă din nou.')).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/partide/incepe\\?balta=${LAKE_PLAIN}$`));
  await expect(page.getByLabel('Nume standul / locul (opțional)')).toHaveValue('Ponton');
  await expect(submit(page)).toBeEnabled();
  expect(calls.create).toHaveLength(1);
  await page.screenshot({ path: `${SHOTS}/error-375.png`, fullPage: true });
  expect(errors).toEqual([]);
});

test('partide.incepe.c14 the session is gone (401): sign-in, back to this page', async ({ page, context }) => {
  await geo(page, context, 'granted');
  await mock(page, { create: { status: 401, body: { data: null, error: { status: 401, name: 'UnauthorizedError', message: 'Unauthorized', details: {} } } } });
  await open(page, `/partide/incepe?balta=${LAKE_PLAIN}`, 375);
  await submit(page).click();
  await expect.poll(() => new URL(page.url()).pathname).toBe('/intra');
  expect(new URL(page.url()).searchParams.get('next')).toBe(`/partide/incepe?balta=${LAKE_PLAIN}`);
});

/* ------------------------------------------------------------------------------------------------
 * c15 — ?balta / ?apa
 * ---------------------------------------------------------------------------------------------- */

test('partide.incepe.c15 ?balta preselects once and opens step 2; «Schimbă» then stays on step 1; an unknown venue drops back to the picker', async ({ page, context }) => {
  await geo(page, context, 'granted');
  await mock(page);
  await open(page, `/partide/incepe?balta=${LAKE}`, 1280);
  await expect(page.getByText('Pasul 2 din 2', { exact: true }).filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByTestId('start-venue-name')).toHaveText('Balta cu Standuri');
  await page.getByTestId('start-venue-change').click();
  await expect(page.getByTestId('venue-search')).toBeVisible();
  await page.waitForTimeout(500);
  await expect(page.getByTestId('venue-search')).toBeVisible();
  await expect(page.getByTestId('start-venue-card')).toHaveCount(0);
  // An unknown lake.
  await page.goto('/partide/incepe?balta=e2e-inc-nope');
  await expect(page.getByText('Nu am găsit locul din link. Alege-l din listă.')).toBeVisible();
  await expect(page.getByTestId('venue-search')).toBeVisible();
});

test('partide.incepe.c2 on step 2 the header back leaves the flow (fish goBackOrHome); «Schimbă» / «Locul» are the way to step 1', async ({ page, context }) => {
  await geo(page, context, 'granted');
  await mock(page);
  // Came from a page of the site (a lake / water page's «Începe o partidă aici»): back returns there.
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/ape-publice');
  await page.goto(`/partide/incepe?balta=${LAKE}`);
  await expect(page.getByTestId('start-venue-name')).toHaveText('Balta cu Standuri');
  // One back control on step 2 — no footer «Înapoi», no «Înapoi la alegerea locului».
  await expect(page.getByRole('button', { name: /^Înapoi/ }).filter({ visible: true })).toHaveCount(1);
  await page.getByRole('button', { name: 'Înapoi', exact: true }).filter({ visible: true }).click();
  await expect(page).toHaveURL(/\/ape-publice$/);
  // A shared link in a new tab (no page of ours before it): the fallback is the Partide hub, never the picker.
  const tab = await context.newPage();
  await mock(tab);
  await open(tab, `/partide/incepe?balta=${LAKE}`, 375);
  await expect(tab.getByTestId('start-venue-name')).toHaveText('Balta cu Standuri');
  await expect(tab.getByRole('button', { name: /^Înapoi/ }).filter({ visible: true })).toHaveCount(1);
  await tab.getByRole('button', { name: 'Înapoi', exact: true }).filter({ visible: true }).click();
  await expect(tab).toHaveURL(/\/partide$/);
  await tab.close();
  // The «Locul» segment still goes back to step 1.
  await open(page, `/partide/incepe?balta=${LAKE}`, 1440);
  await expect(page.getByTestId('start-venue-name')).toHaveText('Balta cu Standuri');
  await page.getByRole('navigation', { name: 'Pașii partidei' }).filter({ visible: true }).getByRole('button', { name: /Locul/ }).click();
  await expect(page.getByTestId('venue-search')).toBeVisible();
});

test('partide.incepe.c15 ?apa preselects the public water by its linkCode', async ({ page, context }) => {
  await geo(page, context, 'granted');
  await mock(page);
  await open(page, `/partide/incepe?apa=${encodeURIComponent(TIN.code)}`, 1920);
  await expect(page.getByTestId('start-venue-name')).toHaveText(TIN.name);
  await expect(page.getByTestId('start-venue-locality')).toHaveText('Lac natural');
  await expect(preview(page)).toHaveAttribute('data-state', 'ready');
  await expect(page.getByTestId('start-position-aside')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/water-1920.png`, fullPage: true });
});

/* ------------------------------------------------------------------------------------------------
 * c11 — the catalog fails
 * ---------------------------------------------------------------------------------------------- */

test('partide.incepe.c11 without the catalog: fish’s default targets (Crap, Caras, Somn, Știucă)', async ({ page, context }) => {
  await geo(page, context, 'granted');
  await mock(page, { fishes: 'fail' });
  await open(page, `/partide/incepe?balta=${LAKE_PLAIN}`, 375);
  await expect(page.getByTestId('start-species').getByRole('button')).toHaveText(['Crap', 'Caras', 'Somn', 'Știucă', 'Vezi toate']);
});
