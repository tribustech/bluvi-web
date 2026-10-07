import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type { Page, Route } from '@playwright/test';
import { expectNoA11yViolations } from './helpers/a11y';
import { collectConsoleErrors } from './helpers/console';
import { expect, test, type FakeLiveDoc } from './helpers/fake-live';
import { CMS, qaJwt, signIn } from './helpers/session';

/*
 * partide.captura — /partide/[id]/captura (T6; fish app/(app)/partide/captura.tsx) + the capture
 * spam soft-confirm partide.partida-lansete.c8 (fish scenes/useCaptureFlow.tsx).
 *
 * Data, all in the browser — NOTHING reaches Firestore and NOTHING is written to any CMS:
 *  - the live partidă comes from the shared Firestore fake (helpers/fake-live.ts); any Firebase
 *    request fails the test;
 *  - the pointer (GET /feed/sessions/active), the fish catalog and EVERY write (POST …/events, the
 *    photo upload POST /feed/sessions/photo, PATCH …/events/:id, POST …/rods/:n/stop, PATCH
 *    /feed/sessions/:id) are route-mocked and recorded; ids start with `e2e-`.
 * The viewer is the real QA account (the session cookie, read by the server gate); its documentId
 * is the partidă's owner / member uid.
 */

const SHOTS = '.shots/partida-captura';
mkdirSync(SHOTS, { recursive: true });
const FIXTURE = path.join(__dirname, '../fixtures/partide/catch-quadrants.jpg');

const LIVE = { documentId: 'e2e-cap-live', clientId: 'e2e-capc-live' };
const OTHER = { documentId: 'e2e-cap-other', clientId: 'e2e-capc-other' };
// The anchor (stand 7) and rod 2's cast pin, ~70 m north of it.
const ANCHOR = { lat: 44.4321, lng: 26.1234 };
const PIN = { lat: 44.43273, lng: 26.1234 };

let selfId = '';
let jwt = '';

test.beforeAll(async ({ request }) => {
  jwt = await qaJwt(request);
  const me = await request.get(`${CMS}/user/profile`, { headers: { authorization: `Bearer ${jwt}` } });
  expect(me.ok(), 'QA profile read').toBe(true);
  selfId = (await me.json()).documentId as string;
});

/* ------------------------------------------------------------------------------------------------
 * Fixtures
 * ---------------------------------------------------------------------------------------------- */

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
const member = (uid: string, name: string) => ({ uid, name, avatar: null, joinedAt: minutesAgo(130) });

type Rod = Record<string, unknown> & { clientId: string; index: number };
const rod1 = (patch: Partial<Rod> = {}): Rod => ({ clientId: 'rod-1', index: 1, label: 'L1', color: '#F43F5E', bait: 'Boilies 20mm Scopex', baitType: 'boilies', baitSize: 20, baitFlavor: 'scopex', lane: 'left', distance: 60, runtimePhase: 'idle', ...patch });
const rod2 = (patch: Partial<Rod> = {}): Rod => ({ clientId: 'rod-2', index: 2, label: 'L2', color: '#22C55E', bait: 'Porumb', lane: 'center', distance: 70, castLat: PIN.lat, castLng: PIN.lng, runtimePhase: 'idle', ...patch });

function liveDoc(patch: Partial<FakeLiveDoc> = {}): FakeLiveDoc {
  return {
    startedAt: minutesAgo(134),
    endedAt: null,
    status: 'active',
    venueType: 'lake',
    lakeId: 'e2e-lake-1',
    lakeName: 'Balta Mock',
    standName: '7',
    anchorLat: ANCHOR.lat,
    anchorLong: ANCHOR.lng,
    plannedDurationMs: 8 * 3_600_000,
    visibleOnProfile: true,
    hostUid: selfId,
    members: [member(selfId, 'Eu Pescar'), member('e2e-angler-2', 'Ana Crap')],
    targetSpecies: [
      { documentId: 'f-crap', name: 'Crap' },
      { documentId: 'f-somn', name: 'Somn' },
    ],
    rods: [rod1(), rod2()],
    catches: [
      { clientId: 'ev-old-1', outcome: 'capture', occurredAt: minutesAgo(100), rodIndex: 1, weightKg: 2.4, species: 'Crap', speciesId: 'f-crap', bait: 'Boilies 20mm Scopex', distance: 60 },
      {
        clientId: 'ev-photo',
        outcome: 'capture',
        occurredAt: minutesAgo(60),
        rodIndex: null,
        weightKg: 8.69,
        weightEstimated: true,
        species: 'Somn',
        speciesId: 'f-somn',
        bait: 'Viermi',
        photoUrl: 'https://e2e-photos.invalid/somn.jpg',
        photoFileId: 77,
      },
    ],
    rev: 3,
    ...patch,
  };
}

const CATALOG = [
  { id: 1, documentId: 'f-crap', Name: 'Crap', competitionPriority: 1, partidaDefaultRank: 1 },
  { id: 2, documentId: 'f-caras', Name: 'Caras', competitionPriority: 2, partidaDefaultRank: 3 },
  { id: 3, documentId: 'f-somn', Name: 'Somn', competitionPriority: 3, partidaDefaultRank: 2 },
  { id: 4, documentId: 'f-stiuca', Name: 'Știucă', competitionPriority: 4, partidaDefaultRank: null },
  { id: 5, documentId: 'f-salau', Name: 'Șalău', competitionPriority: 5, partidaDefaultRank: null },
];

type Answer = number | { status: number; delayMs?: number };
type Calls = {
  events: Record<string, unknown>[];
  uploads: number;
  eventPatches: { eventDocumentId: string; data: Record<string, unknown> }[];
  stops: number[];
  rodsPatch: unknown[];
  sessionPatch: Record<string, unknown>[];
  fishes: number;
};

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const fail = (route: Route, status: number) => json(route, { data: null, error: { status, name: 'Error', message: 'mock', details: {} } }, status);

/** GET /feed/sessions/:id for the live partidă (the hub's active card reads it). */
function liveDetailDto() {
  return {
    documentId: LIVE.documentId,
    clientId: LIVE.clientId,
    clientUpdatedAt: null,
    venueType: 'lake',
    lakeId: 'e2e-lake-1',
    lakeName: 'Balta Mock',
    lakeImageUrl: null,
    publicWaterCode: null,
    publicWaterName: null,
    manualVenueName: null,
    standId: null,
    standName: '7',
    locality: null,
    anchorLat: ANCHOR.lat,
    anchorLong: ANCHOR.lng,
    anchorName: null,
    startedAt: minutesAgo(134),
    endedAt: null,
    plannedDurationMs: 8 * 3_600_000,
    notes: null,
    visibleOnProfile: true,
    status: 'active',
    targetSpecies: [],
    hostUid: selfId,
    joinCode: 'K7M2QX',
    rods: [],
    members: [member(selfId, 'Eu Pescar')],
    events: [],
  };
}

/** The CMS's echo of an upserted catch (toEventDTO). */
function eventDtoOf(body: Record<string, unknown>, n: number) {
  return {
    id: 900 + n,
    documentId: `evd-${body.clientId as string}`,
    clientId: body.clientId,
    clientUpdatedAt: body.clientUpdatedAt ?? null,
    outcome: body.outcome,
    rodIndex: body.rodIndex ?? null,
    rodLabel: body.rodLabel ?? null,
    rodColor: body.rodColor ?? null,
    bait: body.bait ?? null,
    baitType: body.baitType ?? null,
    baitSize: body.baitSize ?? null,
    baitFlavor: body.baitFlavor ?? null,
    lane: body.lane ?? null,
    distance: body.distance ?? null,
    lat: body.lat ?? null,
    lng: body.lng ?? null,
    weightKg: body.weightKg ?? null,
    weightEstimated: body.weightEstimated ?? false,
    species: body.species ?? null,
    speciesId: body.speciesId ?? null,
    photoUrl: null,
    photoThumbUrl: null,
    notes: null,
    occurredAt: body.occurredAt,
    photoTagUids: [],
  };
}

/** The CMS as the capture page sees it. `eventAnswers`: one answer per POST …/events, the last repeats. */
async function mockCms(
  page: Page,
  { active = LIVE as null | { documentId: string; clientId: string }, eventAnswers = [200] as Answer[], fishes = CATALOG, mine = null as null | unknown[] } = {},
): Promise<Calls & { mine: number }> {
  const calls: Calls & { mine: number } = { events: [], uploads: 0, eventPatches: [], stops: [], rodsPatch: [], sessionPatch: [], fishes: 0, mine: 0 };
  await page.route('https://e2e-photos.invalid/**', r => r.fulfill({ status: 200, contentType: 'image/jpeg', path: FIXTURE }));
  await page.route(/tiles\.openfreemap\.org|arcgisonline\.com/, r => r.abort());
  await page.route('**/api/cms/feed/session-follows/mine', route => json(route, { data: { sessionDocumentIds: [] } }));
  await page.route(/\/fishes(\?.*)?$/, route => {
    calls.fishes += 1;
    return json(route, { data: fishes, meta: { pagination: { page: 1, pageSize: 100, pageCount: 1, total: fishes.length } } });
  });
  await page.route('**/api/cms/feed/sessions/active', route =>
    json(route, { data: active ? { documentId: active.documentId, clientId: active.clientId, firestoreId: active.clientId } : null }),
  );
  await page.route(/\/api\/cms\/feed\/sessions\/mine(\?.*)?$/, route => {
    calls.mine += 1;
    return json(route, { data: mine ?? [], meta: { page: 1, pageSize: 100, total: (mine ?? []).length } });
  });
  await page.route('**/api/cms/feed/sessions/photo', route => {
    calls.uploads += 1;
    return json(route, { fileId: 4242, url: 'https://e2e-photos.invalid/up.jpg', thumbUrl: null });
  });
  await page.route(/\/api\/cms\/feed\/sessions\/(e2e-[^/?]+)(\/[^?]*)?(\?.*)?$/, async route => {
    const url = new URL(route.request().url());
    const m = /\/feed\/sessions\/(e2e-[^/]+)(\/.*)?$/.exec(url.pathname)!;
    const rest = m[2] ?? '';
    const method = route.request().method();
    if (method === 'POST' && rest === '/events') {
      const body = (route.request().postDataJSON() as { data: Record<string, unknown> }).data;
      calls.events.push(body);
      const a = eventAnswers.length > 1 ? eventAnswers.shift()! : eventAnswers[0];
      const spec = typeof a === 'number' ? { status: a } : a;
      if (spec.delayMs) await new Promise(r => setTimeout(r, spec.delayMs));
      if (spec.status !== 200) return fail(route, spec.status);
      return json(route, { data: eventDtoOf(body, calls.events.length) });
    }
    if (method === 'PATCH' && rest.startsWith('/events/')) {
      calls.eventPatches.push({ eventDocumentId: rest.slice('/events/'.length), data: (route.request().postDataJSON() as { data: Record<string, unknown> }).data });
      return json(route, { data: { ok: true } });
    }
    const stop = /^\/rods\/(\d+)\/stop$/.exec(rest);
    if (method === 'POST' && stop) {
      calls.stops.push(Number(stop[1]));
      return json(route, { data: { rod: { index: Number(stop[1]), runtimePhase: 'idle', runtimeEndsAt: null }, serverNow: new Date().toISOString(), applied: true } });
    }
    if (method === 'PATCH' && rest === '/rods') {
      calls.rodsPatch.push(route.request().postDataJSON());
      return json(route, { data: { rods: [], serverNow: new Date().toISOString() } });
    }
    if (method === 'PATCH' && !rest) {
      calls.sessionPatch.push((route.request().postDataJSON() as { data: Record<string, unknown> }).data);
      return json(route, { data: { ok: true } });
    }
    if (method === 'GET' && !rest && m[1] === LIVE.documentId) return json(route, { data: liveDetailDto() });
    // Any other partidă: unknown.
    return fail(route, 404);
  });
  return calls;
}

async function open(page: Page, query = '', { width = 1280, documentId = LIVE.documentId }: { width?: number; documentId?: string } = {}) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(`/partide/${documentId}/captura${query}`);
}

const form = (page: Page) => page.getByTestId('capture-form');
const save = (page: Page) => page.getByTestId('capture-save');
const chip = (page: Page, name: string) => page.getByTestId('species-chips').getByRole('button', { name, exact: true });

test.beforeEach(async ({ context }) => {
  await signIn(context, jwt);
});

/* ------------------------------------------------------------------------------------------------
 * c1 — gate and not found
 * ---------------------------------------------------------------------------------------------- */

test('partide.captura auth-only: a guest is sent to sign-in with the capture path (query kept) to return to', async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`/partide/${LIVE.documentId}/captura?lanseta=2`);
  await expect(page).toHaveURL(/\/intra\?next=/);
  expect(decodeURIComponent(new URL(page.url()).searchParams.get('next') ?? '')).toBe(`/partide/${LIVE.documentId}/captura?lanseta=2`);
  await ctx.close();
});

test('partide.captura.c1 no live partidă with this id → «Partida nu a fost găsită.» + «Înapoi»; another live partidă → the same; noindex', async ({ page, fakeLive }) => {
  await fakeLive.seed({ docs: { [OTHER.clientId]: liveDoc() } });
  await mockCms(page, { active: null });
  await open(page);
  await expect(page.getByTestId('capture-not-found')).toBeVisible();
  await expect(page.getByText('Partida nu a fost găsită.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Înapoi' })).toBeVisible();
  await expect(page.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(1);
  await expect(form(page)).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/not-found-1280.png` });

  // The viewer's live partidă is another one.
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await mockCms(page, { active: OTHER });
  await page.reload();
  await expect(page.getByTestId('capture-not-found')).toBeVisible();
  // «Înapoi» with no in-app history goes to the partidă page.
  await page.getByRole('button', { name: 'Înapoi' }).click();
  await expect(page).toHaveURL(new RegExp(`/partide/${LIVE.documentId}$`));
});

test('partide.captura.c1 an ended partidă is not capturable → not found', async ({ page, fakeLive }) => {
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc({ endedAt: minutesAgo(5), status: 'finished' }) } });
  await mockCms(page);
  await open(page);
  await expect(page.getByTestId('capture-not-found')).toBeVisible();
});

test('partide.captura.c1 the pointer names this partidă but no live snapshot ever comes → «Nu am putut descărca partida», «Reîncearcă» / «Înapoi» (never an endless skeleton)', async ({ page, fakeLive }) => {
  // No doc for LIVE: the fake listener never emits (an ad-blocker on Firestore, a projection rebuild).
  await fakeLive.seed({ docs: { [OTHER.clientId]: liveDoc() } });
  await mockCms(page);
  await open(page, '', { width: 375 });
  await expect(page.getByTestId('capture-skeleton').first()).toBeVisible();
  const failed = page.getByTestId('capture-download-failed');
  await expect(failed).toBeVisible({ timeout: 15_000 });
  await expect(failed.getByRole('heading', { name: 'Nu am putut descărca partida' })).toBeVisible();
  await expect(failed.getByRole('button', { name: 'Reîncearcă' })).toBeVisible();
  await expect(failed.getByRole('button', { name: 'Înapoi' })).toBeVisible();
  await expect(page.getByTestId('capture-skeleton')).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/download-failed-375.png`, fullPage: true });
  await expectNoA11yViolations(page);
  // The snapshot is there now → «Reîncearcă» loads the form.
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc() } });
  await failed.getByRole('button', { name: 'Reîncearcă' }).click();
  await expect(form(page)).toBeVisible();
});

/* ------------------------------------------------------------------------------------------------
 * c2 — hero
 * ---------------------------------------------------------------------------------------------- */

test('partide.captura.c2 indigo hero: back control, «Captură nouă» and the helper; edit mode «Editează captura»', async ({ page, fakeLive }) => {
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc() } });
  await mockCms(page);
  const errors = collectConsoleErrors(page);
  await open(page);
  await expect(form(page)).toHaveAttribute('data-mode', 'new');
  const hero = page.getByTestId('capture-hero');
  await expect(hero.getByRole('heading', { level: 1, name: 'Captură nouă' })).toBeVisible();
  await expect(hero.getByText('Completează datele pentru o statistică personală cât mai completă.')).toBeVisible();
  await expect(hero.getByRole('button', { name: 'Înapoi' })).toBeVisible();
  // Indigo = the accent token.
  const bg = await hero.evaluate(el => getComputedStyle(el).backgroundColor);
  expect(bg).toBe('rgb(98, 101, 241)');
  await expect(save(page)).toHaveText('Salvează captura');
  await page.waitForTimeout(450);
  await expectNoA11yViolations(page);
  await page.screenshot({ path: `${SHOTS}/new-1280.png`, fullPage: true });

  await page.goto(`/partide/${LIVE.documentId}/captura?editare=ev-photo`);
  await expect(form(page)).toHaveAttribute('data-mode', 'edit');
  await expect(page.getByRole('heading', { level: 1, name: 'Editează captura' })).toBeVisible();
  await expect(save(page)).toHaveText('Salvează modificările');
  expect(errors).toEqual([]);
});

test('partide.captura.c2 an `editare` id that matches no capture is a NEW capture everywhere: «Captură nouă» in the breadcrumb and the hero, the spam gate applies, the save logs a new catch', async ({ page, fakeLive }) => {
  await fakeLive.seed({
    docs: { [LIVE.clientId]: liveDoc({ catches: [{ clientId: 'ev-free', outcome: 'capture', occurredAt: new Date(Date.now() - 10_000).toISOString(), rodIndex: null, weightKg: 1, species: 'Crap' }] }) },
  });
  const calls = await mockCms(page);
  await open(page, '?editare=ev-sters');
  await expect(page.getByRole('heading', { name: 'Sigur adaugi altă captură?' })).toBeVisible();
  await page.getByTestId('capture-spam-confirm').click();
  await expect(form(page)).toHaveAttribute('data-mode', 'new');
  await expect(page.getByTestId('capture-hero').getByRole('heading', { level: 1, name: 'Captură nouă' })).toBeVisible();
  const crumbs = page.getByRole('navigation', { name: 'Cale de navigare' });
  await expect(crumbs.locator('[aria-current="page"]')).toHaveText('Captură nouă');
  await expect(crumbs).not.toContainText('Editează');
  await expect(save(page)).toHaveText('Salvează captura');
  await save(page).click();
  await expect.poll(() => calls.events.length).toBe(1);
  expect(calls.events[0].clientId).not.toBe('ev-sters');
  expect(calls.events[0].clientId).not.toBe('ev-free');
});

/* ------------------------------------------------------------------------------------------------
 * c3 — species
 * ---------------------------------------------------------------------------------------------- */

test('partide.captura.c3 species chips = the partidă targets, single-select; «Mai mult» adds targets (PATCH) and selects the first new one; «Altele»', async ({ page, fakeLive }) => {
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc() } });
  const calls = await mockCms(page);
  await open(page);
  await expect(page.getByTestId('species-chips').getByRole('button')).toHaveText(['Crap', 'Somn', 'Mai mult']);
  await expect(chip(page, 'Crap')).toHaveAttribute('aria-pressed', 'true');
  await chip(page, 'Somn').click();
  await expect(chip(page, 'Somn')).toHaveAttribute('aria-pressed', 'true');
  await expect(chip(page, 'Crap')).toHaveAttribute('aria-pressed', 'false');

  await chip(page, 'Mai mult').click();
  const picker = page.getByTestId('species-picker');
  await expect(picker).toBeVisible();
  // The current targets first, checked; then the catalog.
  await expect(picker.getByRole('checkbox')).toHaveText(['Crap', 'Somn', 'Caras', 'Știucă', 'Șalău']);
  await expect(picker.getByRole('checkbox', { name: 'Crap' })).toHaveAttribute('aria-checked', 'true');
  await picker.getByRole('checkbox', { name: 'Știucă' }).click();
  await picker.getByRole('checkbox', { name: 'Șalău' }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SHOTS}/species-picker-1280.png` });
  await page.getByTestId('species-picker-save').click();
  await expect.poll(() => calls.sessionPatch.length).toBe(1);
  expect(calls.sessionPatch[0]).toEqual({
    targetSpecies: [
      { documentId: 'f-crap', name: 'Crap' },
      { documentId: 'f-somn', name: 'Somn' },
      { documentId: 'f-stiuca', name: 'Știucă' },
      { documentId: 'f-salau', name: 'Șalău' },
    ],
  });
  await expect(chip(page, 'Știucă')).toHaveAttribute('aria-pressed', 'true');

  // «Altele»: this capture only — no session PATCH.
  await chip(page, 'Mai mult').click();
  await page.getByRole('button', { name: 'Altele', exact: true }).click();
  await expect(chip(page, 'Altele')).toHaveAttribute('aria-pressed', 'true');
  expect(calls.sessionPatch).toHaveLength(1);
});

test('partide.captura.c3 the selection is never invisible: an edited catch whose species is no longer a target gets its own chip; an emptied target list falls back to the catalog defaults at once', async ({ page, fakeLive }) => {
  await fakeLive.seed({
    docs: { [LIVE.clientId]: liveDoc({ catches: [{ clientId: 'ev-caras', outcome: 'capture', occurredAt: minutesAgo(40), rodIndex: null, weightKg: 1.2, species: 'Caras', speciesId: 'f-caras' }] }) },
  });
  const calls = await mockCms(page);
  await open(page, '?editare=ev-caras');
  await expect(page.getByTestId('species-chips').getByRole('button')).toHaveText(['Crap', 'Somn', 'Caras', 'Mai mult']);
  await expect(chip(page, 'Caras')).toHaveAttribute('aria-pressed', 'true');

  // A new capture: «Mai mult» → uncheck everything → «Salvează» → the defaults, not just «Mai mult».
  await open(page);
  await chip(page, 'Mai mult').click();
  const picker = page.getByTestId('species-picker');
  await picker.getByRole('checkbox', { name: 'Crap' }).click();
  await picker.getByRole('checkbox', { name: 'Somn' }).click();
  await page.getByTestId('species-picker-save').click();
  await expect.poll(() => calls.sessionPatch.length).toBe(1);
  expect(calls.sessionPatch[0]).toEqual({ targetSpecies: [] });
  await expect(page.getByTestId('species-chips').getByRole('button')).toHaveText(['Crap', 'Somn', 'Caras', 'Mai mult']);
  await expect(page.getByTestId('species-chips').getByRole('button', { pressed: true })).toHaveCount(1);
});

test('partide.captura.c3 no targets on the partidă → the catalog defaults (partidaDefaultRank order)', async ({ page, fakeLive }) => {
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc({ targetSpecies: [] }) } });
  await mockCms(page);
  await open(page);
  await expect(page.getByTestId('species-chips').getByRole('button')).toHaveText(['Crap', 'Somn', 'Caras', 'Mai mult']);
});

/* ------------------------------------------------------------------------------------------------
 * c4 — weight
 * ---------------------------------------------------------------------------------------------- */

test('partide.captura.c4 weight is optional; keypad (comma, ≤3 decimals, ≤60 kg), ± 0,1 kg, Cântărită / Estimată, «Fără greutate»', async ({ page, fakeLive }) => {
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc() } });
  await mockCms(page);
  await open(page, '', { width: 375 });
  const add = page.getByTestId('weight-add');
  await expect(add).toContainText('Adaugă greutatea');
  await expect(add).toContainText('Opțional — captura se salvează și fără');
  await page.screenshot({ path: `${SHOTS}/weight-absent-375.png`, fullPage: true });

  await add.click();
  const keypad = page.getByTestId('weight-keypad');
  await expect(keypad).toBeVisible();
  const key = (k: string) => keypad.getByRole('button', { name: k, exact: true });
  await key('1').click();
  await key('2').click();
  await key('Virgulă').click();
  await expect(page.getByTestId('weight-value')).toContainText('12,');
  await page.screenshot({ path: `${SHOTS}/weight-entering-375.png`, fullPage: true });
  // The physical keyboard types into it too.
  await page.keyboard.press('5');
  await page.keyboard.press('0');
  await page.keyboard.press('0');
  await expect(page.getByTestId('weight-value')).toContainText('12,500');
  // A fourth decimal is refused.
  await key('7').click();
  await expect(page.getByTestId('weight-value')).toHaveAttribute('data-refused', 'true');
  await expect(page.getByTestId('weight-value')).toContainText('12,500');
  await expect(page.getByTestId('weight-value')).not.toContainText('12,5007');
  // Over 60 kg is refused: 6 → 61 refused, 60 accepted.
  for (let i = 0; i < 6; i++) await key('Șterge ultima cifră').click();
  await key('6').click();
  await key('1').click();
  await expect(page.getByTestId('weight-value')).toContainText(/^6\s*kg/);
  await key('0').click();
  await expect(page.getByTestId('weight-value')).toContainText('60');
  await keypad.getByRole('button', { name: 'Gata' }).click();
  await expect(keypad).toHaveCount(0);
  await expect(page.getByTestId('weight-value')).toContainText('60,0');
  // ± 0,1 kg (capped at 60).
  await page.getByRole('button', { name: 'Crește 0,1 kg' }).click();
  await expect(page.getByTestId('weight-value')).toContainText('60,0');
  await page.getByRole('button', { name: 'Scade 0,1 kg' }).click();
  await expect(page.getByTestId('weight-value')).toContainText('59,9');
  // Cântărită / Estimată.
  await expect(page.getByRole('radio', { name: 'Cântărită' })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('radio', { name: 'Estimată' }).click();
  await expect(page.getByRole('radio', { name: 'Estimată' })).toHaveAttribute('aria-checked', 'true');
  await page.screenshot({ path: `${SHOTS}/weight-set-375.png`, fullPage: true });
  await expectNoA11yViolations(page);
  // «Fără greutate» drops it.
  await page.getByText('Atinge pentru a scrie').click();
  await page.getByRole('button', { name: 'Fără greutate' }).click();
  await expect(page.getByTestId('weight-add')).toBeVisible();
});

test('partide.captura.c4 a ± step while the keypad is open re-seeds what is typed: the number shown is the number saved', async ({ page, fakeLive }) => {
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc() } });
  const calls = await mockCms(page);
  await open(page, '', { width: 375 });
  await page.getByTestId('weight-add').click();
  const keypad = page.getByTestId('weight-keypad');
  await keypad.getByRole('button', { name: '3', exact: true }).click();
  await page.getByRole('button', { name: 'Crește 0,1 kg' }).click();
  await expect(keypad).toBeVisible();
  await expect(page.getByTestId('weight-value')).toContainText('3,1');
  await keypad.getByRole('button', { name: 'Gata' }).click();
  await expect(page.getByTestId('weight-value')).toContainText('3,1');
  await save(page).click();
  await expect.poll(() => calls.events.length).toBe(1);
  expect(calls.events[0].weightKg).toBe(3.1);

  // The next key builds on the stepped value: 3 → + → 5 = 3,15 (not 35).
  await open(page, '', { width: 375 });
  await page.getByTestId('weight-add').click();
  await keypad.getByRole('button', { name: '3', exact: true }).click();
  await page.getByRole('button', { name: 'Crește 0,1 kg' }).click();
  await keypad.getByRole('button', { name: '5', exact: true }).click();
  await expect(page.getByTestId('weight-value')).toContainText('3,15');
});

/* ------------------------------------------------------------------------------------------------
 * c5 / c6 — details rows, rod preselection
 * ---------------------------------------------------------------------------------------------- */

test('partide.captura.c5 «DETALII»: Lansetă (chooser + helper), Poziția pe hartă, Momeală, Poză, Ora', async ({ page, fakeLive }) => {
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc() } });
  await mockCms(page);
  // The picker's map tiles are aborted on purpose (no network in a test): maplibre reports each one.
  const errors = collectConsoleErrors(page, { warnings: true, ignore: [/Failed to load resource: net::ERR_FAILED/, /AJAXError: Failed to fetch \(0\): https:\/\/(server\.arcgisonline\.com|tiles\.openfreemap\.org)/] });
  await open(page);
  await expect(page.getByTestId('detail-rod')).toContainText('Fără lansetă');
  await expect(page.getByTestId('detail-place')).toContainText('Alege pe hartă');
  await expect(page.getByTestId('detail-bait')).toContainText('Adaugă');
  await expect(page.getByTestId('detail-photo')).toContainText('Adaugă');
  await expect(page.getByTestId('detail-time')).toContainText(/acum · \d\d:\d\d/);

  await page.getByTestId('detail-rod').click();
  await expect(page.getByText('Aici îți apar lansetele pe care le-ai configurat în cadrul partidei')).toBeVisible();
  const chooser = page.getByTestId('rod-chooser');
  await expect(chooser.getByRole('radio')).toHaveText(['Fără lansetă', 'L1', 'L2']);
  await expect(chooser.getByRole('radio', { name: 'Fără lansetă' })).toHaveAttribute('aria-checked', 'true');
  await page.screenshot({ path: `${SHOTS}/rod-chooser-1280.png` });
  await chooser.getByRole('radio', { name: 'L1' }).click();
  await expect(chooser).toBeHidden();
  await expect(page.getByTestId('detail-rod')).toContainText('L1');
  // The rod's lane · distance, and its bait.
  await expect(page.getByTestId('detail-place')).toContainText('Stânga · 60 m');
  await expect(page.getByTestId('detail-bait')).toContainText('Boilies 20mm Scopex');

  // The map: «{m} m · pe hartă» once a point is picked.
  await page.getByTestId('detail-place').click();
  const picker = page.getByTestId('map-point-picker-body');
  await expect(picker).toHaveAttribute('data-state', 'ready', { timeout: 20_000 });
  await page.locator('.maplibregl-canvas').focus();
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  await page.getByTestId('map-point-picker-confirm').click();
  await expect(page.getByTestId('detail-place')).toContainText(/\d+ m · pe hartă/);

  // The bait editor: a recent bait chip, then the taxonomy composes the name.
  await page.getByTestId('detail-bait').click();
  const editor = page.getByTestId('bait-editor');
  await expect(editor).toBeVisible();
  await expect(editor.getByRole('textbox', { name: 'Numele momelii' })).toHaveValue('Boilies 20mm Scopex');
  await editor.getByRole('button', { name: 'Pop-up', exact: true }).click();
  await expect(editor.getByRole('textbox', { name: 'Numele momelii' })).toHaveValue('Pop-up 20mm Scopex');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SHOTS}/bait-editor-1280.png` });
  await page.getByTestId('bait-save').click();
  await expect(page.getByTestId('detail-bait')).toContainText('Pop-up 20mm Scopex');
  await expectNoA11yViolations(page);
  expect(errors).toEqual([]);
});

test('partide.captura.c6 from a rod: preselected, the position defaults to its cast pin; changing rod resets a custom bait; an edit never moves to the pin', async ({ page, fakeLive }) => {
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc() } });
  await mockCms(page);
  await open(page, '?lanseta=2');
  await expect(page.getByTestId('detail-rod')).toContainText('L2');
  await expect(page.getByTestId('detail-place')).toContainText(/la pinul lansetei · 7\d m/);
  await expect(page.getByTestId('detail-bait')).toContainText('Porumb');
  // A custom bait, then another rod → the rod's bait shows again.
  await page.getByTestId('detail-bait').click();
  await page.getByRole('textbox', { name: 'Numele momelii' }).fill('Viermi');
  await page.getByTestId('bait-save').click();
  await expect(page.getByTestId('detail-bait')).toContainText('Viermi');
  await page.getByTestId('detail-rod').click();
  await page.getByTestId('rod-chooser').getByRole('radio', { name: 'L1' }).click();
  await expect(page.getByTestId('detail-bait')).toContainText('Boilies 20mm Scopex');
  // L1 has no pin: lane · distance.
  await expect(page.getByTestId('detail-place')).toContainText('Stânga · 60 m');

  // Edit of a catch on rod 2 without a point keeps «no point» (fish: never the rod pin).
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc({ catches: [{ clientId: 'ev-r2', outcome: 'capture', occurredAt: minutesAgo(30), rodIndex: 2, weightKg: 3, species: 'Crap', speciesId: 'f-crap', bait: 'Porumb', distance: 70 }] }) } });
  await page.goto(`/partide/${LIVE.documentId}/captura?editare=ev-r2`);
  await expect(page.getByTestId('detail-rod')).toContainText('L2');
  // Its only map-placed rod has no honest lane (derivedLane): the distance alone.
  await expect(page.getByTestId('detail-place')).toContainText(/Poziția pe hartă\s*70 m$/);
});

test('partide.captura.c6 a legacy 0/0 anchor has no stand to measure from: the pin shows with no metres (owner rule 4)', async ({ page, fakeLive }) => {
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc({ anchorLat: 0, anchorLong: 0 }) } });
  await mockCms(page);
  await open(page, '?lanseta=2');
  const place = page.getByTestId('detail-place');
  await expect(place).toContainText('la pinul lansetei');
  await expect(place).not.toContainText(/\d m/);
});

/* ------------------------------------------------------------------------------------------------
 * c7 — time
 * ---------------------------------------------------------------------------------------------- */

test('partide.captura.c7 «Ora capturii» sets HH:MM on the day; a future time goes back 24 h', async ({ page, fakeLive }) => {
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc() } });
  const calls = await mockCms(page);
  await open(page);
  const now = new Date(await page.evaluate(() => Date.now()));
  await page.getByTestId('detail-time').click();
  await expect(page.getByRole('heading', { name: 'Ora capturii' })).toBeVisible();
  // One minute in the future (wall clock) → yesterday.
  const future = new Date(now.getTime() + 2 * 60_000);
  const hh = String(future.getHours()).padStart(2, '0');
  const mm = String(future.getMinutes()).padStart(2, '0');
  await page.getByTestId('time-input').fill(`${hh}:${mm}`);
  await page.getByTestId('time-done').click();
  await expect(page.getByTestId('detail-time')).toContainText(`${hh}:${mm}`);
  await expect(page.getByTestId('detail-time')).not.toContainText('acum');
  await save(page).click();
  await expect.poll(() => calls.events.length).toBe(1);
  const occurred = new Date(calls.events[0].occurredAt as string);
  expect(occurred.getHours()).toBe(future.getHours());
  expect(occurred.getMinutes()).toBe(future.getMinutes());
  expect(occurred.getTime()).toBeLessThan(now.getTime());
  expect(now.getTime() - occurred.getTime()).toBeGreaterThan(23 * 3_600_000);
});

/* ------------------------------------------------------------------------------------------------
 * c8 — photo
 * ---------------------------------------------------------------------------------------------- */

test('partide.captura.c8 «Poză»: the file → preparing → the preview dialog → «Gata» → the thumb; save uploads then PATCHes the photo', async ({ page, fakeLive }) => {
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc() } });
  const calls = await mockCms(page);
  await open(page);
  await page.getByTestId('photo-input').setInputFiles(FIXTURE);
  const dialog = page.getByTestId('photo-preview');
  await expect(dialog).toBeVisible();
  // A co-op partidă: who is in the photo.
  await expect(dialog.getByText('Cine e în poză?')).toBeVisible();
  await page.getByTestId('photo-preview-done').click();
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId('detail-photo-thumb')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/photo-chosen-1280.png`, fullPage: true });
  await save(page).click();
  await expect.poll(() => calls.events.length).toBe(1);
  // The catch is written first, without `photo: null` (it has one coming), then the upload + PATCH.
  expect(calls.events[0]).not.toHaveProperty('photo');
  await expect.poll(() => calls.uploads).toBe(1);
  await expect.poll(() => calls.eventPatches.length).toBe(1);
  expect(calls.eventPatches[0]).toEqual({ eventDocumentId: `evd-${calls.events[0].clientId as string}`, data: { photo: 4242 } });
});

test('partide.captura.c8 a file that is not an image → «Nu am putut pregăti poza. Încearcă din nou.»; remove ✕ clears a photo', async ({ page, fakeLive }) => {
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc() } });
  await mockCms(page);
  await open(page);
  await page.getByTestId('photo-input').setInputFiles({ name: 'nu.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('not an image') });
  await expect(page.getByText('Nu am putut pregăti poza. Încearcă din nou.')).toBeVisible();
  await expect(page.getByTestId('photo-preview')).toBeHidden();
  await expect(page.getByTestId('detail-photo')).toContainText('Adaugă');

  await page.getByTestId('photo-input').setInputFiles(FIXTURE);
  await page.getByTestId('photo-preview-done').click();
  await expect(page.getByTestId('detail-photo-thumb')).toBeVisible();
  await page.getByTestId('detail-photo-remove').click();
  await expect(page.getByTestId('detail-photo-thumb')).toHaveCount(0);
  await expect(page.getByTestId('detail-photo')).toContainText('Adaugă');
});

test.describe('touch screen', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 375, height: 812 } });
  test('partide.captura.c8 on a touch screen «Poză» asks «Adaugă o poză» → «Fă o poză» / «Alege din galerie» / «Anulează»', async ({ page, fakeLive }) => {
    await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc() } });
    await mockCms(page);
    await page.goto(`/partide/${LIVE.documentId}/captura`);
    await page.getByTestId('detail-photo').click();
    await expect(page.getByRole('heading', { name: 'Adaugă o poză' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Fă o poză' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Alege din galerie' })).toBeVisible();
    await expect(page.getByTestId('photo-camera-input')).toHaveAttribute('capture', 'environment');
    await expect(page.getByTestId('photo-camera-input')).toHaveAttribute('accept', 'image/*');
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${SHOTS}/photo-choice-375.png` });
    await page.getByRole('button', { name: 'Anulează' }).click();
    await expect(page.getByRole('heading', { name: 'Adaugă o poză' })).toBeHidden();
  });
});

/* ------------------------------------------------------------------------------------------------
 * c9 / c10 / c12 — save
 * ---------------------------------------------------------------------------------------------- */

test('partide.captura.c9 c10 c12 a free capture: the event body, the curtain for a minimum time, the projection awaited, then back', async ({ page, fakeLive }) => {
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc() } });
  const calls = await mockCms(page, { eventAnswers: [{ status: 200, delayMs: 100 }] });
  // Arrive from the partidă page (in-app history) so «back» is a real Back.
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/partide/${LIVE.documentId}`);
  await page.goto(`/partide/${LIVE.documentId}/captura`);
  await chip(page, 'Somn').click();
  await page.getByTestId('weight-add').click();
  await page.keyboard.type('4,25');
  await page.getByTestId('weight-keypad').getByRole('button', { name: 'Gata' }).click();
  await page.getByRole('radio', { name: 'Estimată' }).click();
  const started = Date.now();
  await save(page).click();
  const curtain = page.getByTestId('save-curtain');
  await expect(curtain).toBeVisible();
  await expect(curtain.getByRole('status')).toHaveText('Punem peștele pe cântar…');
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${SHOTS}/saving-1280.png` });
  await expect.poll(() => calls.events.length).toBe(1);
  const body = calls.events[0];
  expect(body).toMatchObject({ outcome: 'capture', rodIndex: null, weightKg: 4.25, weightEstimated: true, species: 'Somn', speciesId: 'f-somn', bait: '', lat: null, lng: null, distance: 0, photo: null });
  expect(typeof body.clientId).toBe('string');
  // Still saving — the projection has not shown the catch yet.
  await page.waitForTimeout(1200);
  await expect(page).toHaveURL(/\/captura$/);
  await expect(curtain).toBeVisible();
  // The snapshot lands → back at once.
  const doc = liveDoc();
  const pushedAt = Date.now();
  await fakeLive.push(LIVE.clientId, { ...doc, rev: 4, catches: [...(doc.catches ?? []), { clientId: body.clientId as string, outcome: 'capture', occurredAt: body.occurredAt as string, weightKg: 4.25, species: 'Somn' }] });
  await expect(page).toHaveURL(new RegExp(`/partide/${LIVE.documentId}$`));
  expect(Date.now() - pushedAt).toBeLessThan(1500);
  expect(Date.now() - started).toBeGreaterThan(900);
});

test('partide.captura.c10 the save curtain opens out of the hero: from 768 its exact rect + radius (clip-path), on the phone a scaleY band from the top, scrolled out of view a plain fade', async ({ page, fakeLive }) => {
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc() } });
  await mockCms(page, { eventAnswers: [{ status: 200, delayMs: 3000 }] });
  /** The panel's first style, as it was inserted (before it grows). */
  const firstStyle = async () => {
    await page.evaluate(() => {
      const w = window as unknown as { __curtainStart?: Record<string, string> | null };
      w.__curtainStart = null;
      new MutationObserver((_, obs) => {
        const el = document.querySelector<HTMLElement>('[data-testid="save-curtain-panel"]');
        if (!el) return;
        w.__curtainStart = { clipPath: el.style.clipPath, transform: el.style.transform, opacity: el.style.opacity };
        obs.disconnect();
      }).observe(document.body, { childList: true, subtree: true });
    });
    await save(page).click();
    await expect.poll(() => page.evaluate(() => (window as unknown as { __curtainStart?: Record<string, string> | null }).__curtainStart)).not.toBeNull();
    return page.evaluate(() => (window as unknown as { __curtainStart: Record<string, string> }).__curtainStart);
  };

  await open(page, '', { width: 1280 });
  await expect(form(page)).toBeVisible();
  const hero = await page.getByTestId('capture-hero').boundingBox();
  const desk = await firstStyle();
  // The browser serialises the shortest form (`inset(t r b round x)` when left = right).
  const m = /^inset\(([^)]*?) round ([\d.]+)px\)$/.exec(desk.clipPath);
  expect(m, desk.clipPath).not.toBeNull();
  const [t, r = t, b = t, l = r] = m![1].split(' ').map(v => Number.parseFloat(v));
  expect(t).toBeCloseTo(hero!.y, 0);
  expect(l).toBeCloseTo(hero!.x, 0);
  expect(r).toBeCloseTo(1280 - hero!.x - hero!.width, 0);
  expect(b).toBeCloseTo(900 - hero!.y - hero!.height, 0);
  expect(Number(m![2])).toBeGreaterThan(0);
  await expect(page.getByTestId('save-curtain')).toHaveAttribute('data-phase', 'shown');

  await open(page, '', { width: 375 });
  await expect(form(page)).toBeVisible();
  const phone = await firstStyle();
  expect(phone.transform).toMatch(/^scaleY\(0\.\d+\)$/);

  // Scrolled so the hero is gone: nothing to grow from → a fade from 0.
  await open(page, '', { width: 1280 });
  await page.setViewportSize({ width: 1280, height: 400 });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect.poll(() => page.getByTestId('capture-hero').evaluate(el => el.getBoundingClientRect().bottom)).toBeLessThan(0);
  const faded = await firstStyle();
  expect(faded.opacity).toBe('0');
});

test('partide.captura.c12 after a save the viewer’s lists are refetched (the own list, before the community grace)', async ({ page, fakeLive }) => {
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc() } });
  const calls = await mockCms(page, { mine: [] });
  await page.setViewportSize({ width: 1280, height: 900 });
  // Ale mele (the own list) → the capture link of the live card (client-side, the cache survives).
  await page.goto('/partide/ale-mele');
  await expect.poll(() => calls.mine).toBeGreaterThanOrEqual(1);
  const link = page.locator(`a[href="/partide/${LIVE.documentId}/captura"]`).filter({ visible: true }).first();
  await expect(link).toBeVisible();
  await link.click();
  await expect(form(page)).toBeVisible();
  const before = calls.mine;
  await save(page).click();
  await expect.poll(() => calls.events.length).toBe(1);
  await expect(page).toHaveURL(/\/partide\/ale-mele$/, { timeout: 10_000 });
  await expect.poll(() => calls.mine).toBeGreaterThan(before);
});

test('partide.captura.c9 failure → inline «Nu am putut salva captura. Încearcă din nou.», «Reîncearcă» replays the SAME event id', async ({ page, fakeLive }) => {
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc() } });
  // 400: not retried by the write's own backoff.
  const calls = await mockCms(page, { eventAnswers: [400, 200] });
  await open(page, '', { width: 375 });
  await save(page).click();
  await expect(page.getByTestId('capture-save-error')).toHaveText('Nu am putut salva captura. Încearcă din nou.');
  await expect(save(page)).toHaveText('Reîncearcă');
  await expect(page.getByTestId('save-curtain')).toHaveCount(0, { timeout: 2000 });
  await page.screenshot({ path: `${SHOTS}/save-error-375.png`, fullPage: true });
  await expectNoA11yViolations(page);
  await save(page).click();
  await expect.poll(() => calls.events.length).toBe(2);
  expect(calls.events[1].clientId).toBe(calls.events[0].clientId);
});

test('partide.captura.c9 offline → «Fără conexiune. Reconectare…», nothing is written', async ({ page, fakeLive, context }) => {
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc() } });
  const calls = await mockCms(page);
  await open(page, '', { width: 375 });
  await expect(form(page)).toBeVisible();
  await context.setOffline(true);
  await save(page).click();
  await expect(page.getByTestId('capture-save-error')).toHaveText('Fără conexiune. Reconectare…');
  await expect(save(page)).toHaveText('Reîncearcă');
  await page.screenshot({ path: `${SHOTS}/offline-375.png`, fullPage: true });
  await context.setOffline(false);
  expect(calls.events).toHaveLength(0);
});

test('partide.captura.c10 a rod capture logs the rod snapshot, bait, the pin, the distance and the time', async ({ page, fakeLive }) => {
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc() } });
  const calls = await mockCms(page);
  await open(page, '?lanseta=2');
  await save(page).click();
  await expect.poll(() => calls.events.length).toBe(1);
  const body = calls.events[0];
  expect(body).toMatchObject({ outcome: 'capture', rodIndex: 2, rodLabel: 'L2', rodColor: '#22C55E', bait: 'Porumb', lat: PIN.lat, lng: PIN.lng, species: 'Crap', weightKg: null, weightEstimated: false });
  expect(body.distance).toBe(70);
  expect(calls.stops).toEqual([]);
});

test('partide.captura.c10 an expired rod resolves its cycle (stop + the catch); a running rod asks «Continuă» (log) / «Oprește» (resolve)', async ({ page, fakeLive }) => {
  const past = new Date(Date.now() - 60_000).toISOString();
  const future = new Date(Date.now() + 30 * 60_000).toISOString();
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc({ rods: [rod1({ runtimePhase: 'fishing', runtimeEndsAt: past, durationMs: 1_800_000, alarmSound: 'tone-1' }), rod2({ runtimePhase: 'fishing', runtimeEndsAt: future, durationMs: 1_800_000, alarmSound: 'tone-1' })] }) } });
  const calls = await mockCms(page);
  await open(page, '?lanseta=1');
  await save(page).click();
  await expect.poll(() => calls.stops).toEqual([1]);
  await expect.poll(() => calls.events.length).toBe(1);
  expect(calls.events[0]).toMatchObject({ outcome: 'capture', rodIndex: 1, rodLabel: 'L1' });

  // Running: «Lanseta cronometrează».
  await open(page, '?lanseta=2');
  await save(page).click();
  await expect(page.getByText('Oprești cronometrul Lansetei 2?')).toBeVisible();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SHOTS}/rod-running-ask-1280.png` });
  await page.getByRole('button', { name: 'Continuă' }).click();
  await expect.poll(() => calls.events.length).toBe(2);
  expect(calls.stops).toEqual([1]);
  expect(calls.events[1]).toMatchObject({ rodIndex: 2 });

  await open(page, '?lanseta=2');
  await save(page).click();
  await page.getByTestId('rod-running-stop').click();
  await expect.poll(() => calls.stops).toEqual([1, 2]);
  await expect.poll(() => calls.events.length).toBe(3);
});

/* ------------------------------------------------------------------------------------------------
 * c11 — edit
 * ---------------------------------------------------------------------------------------------- */

test('partide.captura.c11 edit: prefilled; only what changed (no photo field, rod untouched); waits for the projection to echo the edit', async ({ page, fakeLive }) => {
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc() } });
  const calls = await mockCms(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/partide/${LIVE.documentId}`);
  await page.goto(`/partide/${LIVE.documentId}/captura?editare=ev-photo`);
  await expect(chip(page, 'Somn')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('weight-value')).toContainText('8,69');
  await expect(page.getByRole('radio', { name: 'Estimată' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('detail-bait')).toContainText('Viermi');
  await expect(page.getByTestId('detail-photo-thumb')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/edit-1280.png`, fullPage: true });
  await page.getByRole('button', { name: 'Crește 0,1 kg' }).click();
  await save(page).click();
  await expect.poll(() => calls.events.length).toBe(1);
  const body = calls.events[0];
  expect(body).toMatchObject({ clientId: 'ev-photo', weightKg: 8.79, weightEstimated: true, species: 'Somn', rodIndex: null, bait: 'Viermi' });
  // The photo was not touched: no `photo` key (a `null` would detach it), no upload, no PATCH.
  expect(body).not.toHaveProperty('photo');
  await page.waitForTimeout(1300);
  expect(calls.uploads).toBe(0);
  expect(calls.eventPatches).toEqual([]);
  await expect(page).toHaveURL(/editare=ev-photo/);
  // The projection echoes the clientUpdatedAt → back.
  const doc = liveDoc();
  await fakeLive.push(LIVE.clientId, { ...doc, catches: doc.catches!.map(c => (c.clientId === 'ev-photo' ? { ...c, weightKg: 8.79, clientUpdatedAt: body.clientUpdatedAt as string } : c)) });
  await expect(page).toHaveURL(new RegExp(`/partide/${LIVE.documentId}$`), { timeout: 1500 });
});

test('partide.captura.c11 edit: removing the photo detaches it (`photo: null`); another rod re-attributes the snapshot', async ({ page, fakeLive }) => {
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc() } });
  const calls = await mockCms(page);
  await open(page, '?editare=ev-photo');
  await page.getByTestId('detail-photo-remove').click();
  await page.getByTestId('detail-rod').click();
  await page.getByTestId('rod-chooser').getByRole('radio', { name: 'L1' }).click();
  await save(page).click();
  await expect.poll(() => calls.events.length).toBe(1);
  expect(calls.events[0]).toMatchObject({ clientId: 'ev-photo', photo: null, rodIndex: 1, rodLabel: 'L1', distance: 60 });
});

/* ------------------------------------------------------------------------------------------------
 * partide.partida-lansete.c8 — the 30 s spam soft-confirm
 * ---------------------------------------------------------------------------------------------- */

test('partide.partida-lansete.c8 a capture in the same bucket within 30 s asks «Sigur adaugi altă captură?» — «Anulează» back, «Da, adaug» on; another bucket and edits are not gated', async ({ page, fakeLive }) => {
  const recent = (s: number) => new Date(Date.now() - s * 1000).toISOString();
  await fakeLive.seed({
    docs: {
      [LIVE.clientId]: liveDoc({
        catches: [
          { clientId: 'ev-free', outcome: 'capture', occurredAt: recent(12), rodIndex: null, weightKg: 1, species: 'Crap' },
          { clientId: 'ev-r1', outcome: 'lost', occurredAt: recent(5), rodIndex: 1 },
        ],
      }),
    },
  });
  await mockCms(page);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`/partide/${LIVE.documentId}`);
  await page.goto(`/partide/${LIVE.documentId}/captura`);
  const guard = page.getByTestId('capture-spam-guard');
  await expect(page.getByRole('heading', { name: 'Sigur adaugi altă captură?' })).toBeVisible();
  await expect(guard).toHaveText(/Ai adăugat o captură acum 1\ds\. Ești sigur că vrei să adaugi alta\?/);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}/spam-guard-375.png` });
  await expectNoA11yViolations(page);
  await page.getByRole('button', { name: 'Anulează' }).click();
  await expect(page).toHaveURL(new RegExp(`/partide/${LIVE.documentId}$`));

  await page.goto(`/partide/${LIVE.documentId}/captura`);
  await page.getByTestId('capture-spam-confirm').click();
  await expect(guard).toBeHidden();
  await expect(form(page)).toBeVisible();

  // Rod 1's bucket: only a «lost» there → no confirm. An edit → never.
  await page.goto(`/partide/${LIVE.documentId}/captura?lanseta=1`);
  await expect(form(page)).toBeVisible();
  await expect(guard).toHaveCount(0);
  await page.goto(`/partide/${LIVE.documentId}/captura?editare=ev-free`);
  await expect(form(page)).toHaveAttribute('data-mode', 'edit');
  await expect(guard).toHaveCount(0);
});
