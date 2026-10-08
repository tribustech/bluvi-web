import { mkdirSync } from 'node:fs';
import type { Page, Route } from '@playwright/test';
import { expectNoA11yViolations } from './helpers/a11y';
import { collectConsoleErrors } from './helpers/console';
import { expect, test, type FakeLiveDoc } from './helpers/fake-live';
import { CMS, qaJwt, signIn } from './helpers/session';

/*
 * partide.partida-lansete — the member view's «Lansete» tab (/partide/[id]?tab=lansete; fish
 * features/partide/scenes/CronometreScene.tsx + components/PartidaRodCard.tsx + StopRodSheet.tsx).
 *
 * Data, all in the browser — NOTHING reaches Firestore and NOTHING is written to any CMS:
 *  - the live partidă (rods with their runtimes, catches) comes from the shared Firestore fake
 *    (helpers/fake-live.ts); any Firebase request fails the test;
 *  - the pointer (GET /feed/sessions/active) answers with a `Date` header = the fixed clock, which
 *    samples the server clock (b.server-clock) — a test that leaves it out sees the provisional
 *    «Se sincronizează»;
 *  - every write (POST …/rods/:n/cast, …/rods/:n/stop, …/events) is route-mocked and recorded.
 * A fixed clock (page.clock) gives the countdowns their deadlines. The viewer is the real QA account
 * (its documentId is the owner / member uid).
 */

const NOW = new Date('2026-10-07T12:00:00.000Z');
const T = NOW.getTime();
const iso = (ms: number) => new Date(ms).toISOString();
const at = (minutesAgo: number) => iso(T - minutesAgo * 60_000);
const SHOTS = '.shots/partida-lansete';
mkdirSync(SHOTS, { recursive: true });

const LIVE = { documentId: 'e2e-l-live', clientId: 'e2e-lc-live' };
const MIN30 = 30 * 60_000;

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

type Rod = Record<string, unknown> & { clientId: string; index: number };
const ANCHOR = { lat: 44.4321, lng: 26.1234 };

/** L1 idle, timer 30 min, left · 60 m, boilies. */
const rodIdle = (patch: Partial<Rod> = {}): Rod => ({ clientId: 'rod-1', index: 1, label: 'L1', color: '#F43F5E', bait: 'Boilies 20mm Scopex', lane: 'left', distance: 60, durationMs: MIN30, alarmSound: 'tone-1', runtimePhase: 'idle', ...patch });
/** L2 counting down: 12:30 left of 30:00, centre · 70 m, no bait. */
const rodFishing = (patch: Partial<Rod> = {}): Rod => ({ clientId: 'rod-2', index: 2, label: 'L2', color: '#22C55E', bait: '', lane: 'center', distance: 70, durationMs: MIN30, alarmSound: 'tone-2', runtimePhase: 'fishing', runtimeEndsAt: iso(T + 12 * 60_000 + 30_000), ...patch });
/** L3 expired 2:13 ago (stored «fishing» past due — 'firing' is derived), right · 85 m. */
const rodExpired = (patch: Partial<Rod> = {}): Rod => ({ clientId: 'rod-3', index: 3, label: 'L3', color: '#6366F1', bait: 'Porumb', lane: 'right', distance: 85, durationMs: 20 * 60_000, alarmSound: 'tone-3', runtimePhase: 'fishing', runtimeEndsAt: iso(T - 133_000), ...patch });
/** L4 timer-free, placed on the map (the only map cast → no honest lane: «45 m»). */
const rodFree = (patch: Partial<Rod> = {}): Rod => ({ clientId: 'rod-4', index: 4, label: 'L4', color: '#FACC15', bait: 'Viermi', lane: 'center', distance: 45, castLat: 44.4325, castLng: 26.1236, durationMs: null, alarmSound: null, runtimePhase: 'idle', ...patch });

const catchOn = (id: string, rodIndex: number, outcome: 'capture' | 'lost' | 'blank', occurredAt: string, kg: number | null = null) => ({ clientId: id, outcome, occurredAt, rodIndex, weightKg: kg, species: outcome === 'capture' ? 'Crap' : null, photoUrl: null, photoThumbUrl: null });

const member = (uid: string, name: string) => ({ uid, name, avatar: null, joinedAt: at(130) });

function liveDoc(patch: Partial<FakeLiveDoc> = {}): FakeLiveDoc {
  return {
    startedAt: at(134),
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
    joinCode: 'K7M2QX',
    members: [member(selfId, 'Eu Pescar'), member('e2e-angler-2', 'Ana Crap')],
    rods: [rodIdle(), rodFishing(), rodExpired(), rodFree()],
    catches: [
      catchOn('ev-1', 1, 'capture', at(100), 2.4),
      catchOn('ev-2', 1, 'capture', at(60), 8.69),
      catchOn('ev-3', 1, 'lost', at(40)),
      catchOn('ev-4', 3, 'blank', at(30)),
    ],
    rev: 3,
    ...patch,
  };
}

type Calls = { cast: { index: number; body: Record<string, unknown> }[]; stop: { index: number; body: Record<string, unknown> }[]; events: Record<string, unknown>[] };

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const fail = (route: Route, status: number) => json(route, { data: null, error: { status, name: 'Error', message: 'mock', details: {} } }, status);

/** The CMS's echo of an upserted event (toEventDTO). */
function eventDtoOf(body: Record<string, unknown>, n: number) {
  return {
    id: 900 + n,
    documentId: `evd-${String(body.clientId)}`,
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

/**
 * The CMS as the tab sees it. `sampled`: the pointer answers with the fixed clock's Date header.
 * `castEndsAt`: the deadline the server stamps on a cast (default: now + the rod's 30 min).
 */
async function mockCms(page: Page, { sampled = true, castEndsAt = null as number | null, castStatus = 200, eventsStatus = 200 } = {}): Promise<Calls> {
  const calls: Calls = { cast: [], stop: [], events: [] };
  await page.route(/tiles\.openfreemap\.org|arcgisonline\.com/, r => r.abort());
  await page.route('**/api/cms/feed/session-follows/mine', route => json(route, { data: { sessionDocumentIds: [] } }));
  await page.route('**/api/cms/feed/sessions/active', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: sampled ? { date: NOW.toUTCString() } : {},
      body: JSON.stringify({ data: { documentId: LIVE.documentId, clientId: LIVE.clientId, firestoreId: LIVE.clientId } }),
    }),
  );
  await page.route(/\/api\/cms\/feed\/sessions\/mine(\?.*)?$/, route => json(route, { data: [], meta: { page: 1, pageSize: 100, total: 0 } }));
  await page.route(/\/feed\/community\/sessions\/(e2e-[^/?]+)(\?.*)?$/, route => fail(route, 404));
  await page.route(/\/fishes(\?.*)?$/, route => json(route, { data: [], meta: { pagination: { page: 1, pageSize: 100, pageCount: 1, total: 0 } } }));
  await page.route(/\/api\/cms\/feed\/sessions\/(e2e-[^/?]+)(\/[^?]*)?(\?.*)?$/, async route => {
    const url = new URL(route.request().url());
    const m = /\/feed\/sessions\/(e2e-[^/]+)(\/.*)?$/.exec(url.pathname)!;
    const rest = m[2] ?? '';
    const method = route.request().method();
    const cmd = /^\/rods\/(\d+)\/(cast|stop)$/.exec(rest);
    if (method === 'POST' && cmd) {
      const index = Number(cmd[1]);
      const body = ((route.request().postDataJSON() as { data?: Record<string, unknown> }) ?? {}).data ?? {};
      if (cmd[2] === 'cast') {
        calls.cast.push({ index, body });
        if (castStatus !== 200) return fail(route, castStatus);
        const endsAt = castEndsAt ?? Date.now() + MIN30;
        return json(route, { data: { rod: { index, runtimePhase: 'fishing', runtimeEndsAt: iso(endsAt) }, serverNow: iso(Date.now()), applied: true } });
      }
      calls.stop.push({ index, body });
      return json(route, { data: { rod: { index, runtimePhase: 'idle', runtimeEndsAt: null }, serverNow: iso(Date.now()), applied: true } });
    }
    if (method === 'POST' && rest === '/events') {
      const body = (route.request().postDataJSON() as { data: Record<string, unknown> }).data;
      calls.events.push(body);
      if (eventsStatus !== 200) return fail(route, eventsStatus);
      return json(route, { data: eventDtoOf(body, calls.events.length) });
    }
    return fail(route, 404);
  });
  return calls;
}

async function open(page: Page, { width = 1280 }: { width?: number } = {}) {
  await page.setViewportSize({ width, height: 900 });
  await page.clock.install({ time: NOW });
  await page.goto(`/partide/${LIVE.documentId}?tab=lansete`);
  await expect(page.getByTestId('partida-member-view')).toBeVisible();
}

const card = (page: Page, index: number) => page.locator(`[data-testid="rod-card"][data-rod="${index}"]`);
const toast = (page: Page, text: string) => page.getByText(text, { exact: true }).filter({ visible: true });
const settle = (page: Page) => page.waitForTimeout(450);

test.beforeEach(async ({ context }) => {
  await signIn(context, jwt);
});

/* ------------------------------------------------------------------------------------------------
 * The board at every width — c2 c3 c4, desktop grid, axe
 * ---------------------------------------------------------------------------------------------- */

for (const width of [375, 1280, 1440, 1920] as const) {
  test(`partide.partida-lansete.c2 c3 c4 the board at ${width}: idle / counting / expired / timer-free rods; the «Lansete» tab first — axe clean`, async ({ page, fakeLive }) => {
    await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc() } });
    await mockCms(page);
    // The 404 is this spec's own mock of the public community read (an e2e- id has no public page).
    const errors = collectConsoleErrors(page, { ignore: /Failed to load resource: the server responded with a status of 404/ });
    await open(page, { width });
    await expect(page.getByRole('tab', { name: 'Lansete' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('rod-card')).toHaveCount(4);
    // c2: titles (lane · distance, units spaced; the lone map cast has no honest lane).
    await expect(page.getByTestId('rod-title')).toHaveText(['Stânga · 60 m', 'Centru · 70 m', 'Dreapta · 85 m', '45 m']);
    // c2: the left border in the rod colour.
    await expect(card(page, 1)).toHaveCSS('border-left-color', 'rgb(244, 63, 94)');
    await expect(card(page, 2)).toHaveCSS('border-left-color', 'rgb(34, 197, 94)');
    // c2: the badge «L{n}», ringed (timer) on L1–L3, plain on the timer-free L4.
    await expect(card(page, 1).getByTestId('rod-badge')).toHaveText('L1');
    await expect(card(page, 1).getByTestId('rod-badge')).toHaveAttribute('data-timer', 'true');
    await expect(card(page, 4).getByTestId('rod-badge')).not.toHaveAttribute('data-timer', /.*/);
    // c2: bites → captures, best kg (unit apart), «3 trăsături»; no bites → no stats.
    await expect(card(page, 1).getByTestId('rod-stats')).toHaveText('Capturi: 2Cea mai mare: 8,69kg3 trăsături');
    await expect(card(page, 3).getByTestId('rod-stats')).toHaveCount(0); // a blank is not a bite
    // c3: idle → the bait line; unknown bait → «Momeală necunoscută».
    await expect(card(page, 1).getByTestId('rod-bait')).toHaveText('Momeală: Boilies 20mm Scopex');
    await expect(card(page, 2).getByTestId('rod-bait')).toHaveText('Momeală: Momeală necunoscută');
    await expect(card(page, 1).getByTestId('rod-countdown')).toHaveCount(0);
    // c3: running → «Timp rămas» + the countdown; expired → «Expirat», red, on minus.
    await expect(card(page, 2).getByTestId('rod-countdown-label')).toHaveText('Timp rămas');
    await expect(card(page, 2).getByTestId('rod-countdown-value')).toHaveText(/^00:12:(2\d|30)$/);
    await expect(card(page, 2).getByTestId('rod-countdown')).toHaveAttribute('data-tone', 'ink');
    await expect(card(page, 3)).toHaveAttribute('data-phase', 'firing');
    await expect(card(page, 3).getByTestId('rod-countdown-label')).toHaveText('Expirat');
    await expect(card(page, 3).getByTestId('rod-countdown-value')).toHaveText(/^-00:02:1\d$/);
    await expect(card(page, 3).getByTestId('rod-countdown')).toHaveAttribute('data-tone', 'danger');
    // c4: three outcomes on every card.
    for (const i of [1, 2, 3, 4]) {
      await expect(card(page, i).getByRole('group', { name: 'Rezultat' }).getByRole('button')).toHaveText(['Fără trăsătură', 'Scăpat', 'Captură']);
    }
    // c11 / c13 (owner decision pending): no «Adaugă lansetă», no configure entry.
    await expect(page.getByText('Adaugă lansetă')).toHaveCount(0);
    await expect(page.getByText('Adaugă cronometru')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Configurează|Modifică cronometrul/ })).toHaveCount(0);
    // Desktop: two columns of cards; phone: one.
    const a = await card(page, 1).boundingBox();
    const b = await card(page, 2).boundingBox();
    if (width >= 768) expect(Math.abs(a!.y - b!.y)).toBeLessThan(2);
    else expect(b!.y).toBeGreaterThan(a!.y + a!.height);
    await expectNoA11yViolations(page);
    await page.screenshot({ path: `${SHOTS}/board-${width}.png`, fullPage: true });
    expect(errors).toEqual([]);
  });
}

/* ------------------------------------------------------------------------------------------------
 * c1 — no rods
 * ---------------------------------------------------------------------------------------------- */

test('partide.partida-lansete.c1 no rods: fish\'s title and text, one quiet line instead of «Adaugă lansetă» (c11/c13 pending)', async ({ page, fakeLive }) => {
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc({ rods: [], catches: [] }) } });
  await mockCms(page);
  for (const width of [375, 1280, 1440, 1920]) {
    await open(page, { width });
    const empty = page.getByTestId('lansete-empty');
    await expect(empty.getByRole('heading', { name: 'Nicio lansetă încă' })).toBeVisible();
    await expect(empty).toContainText('Adaugă o lansetă ca să-ți notezi momeala și capturile. Cronometrul e opțional.');
    await expect(page.getByTestId('lansete-empty-app')).toHaveText('Lansetele se adaugă din aplicația Bluvi.');
    await expect(page.getByRole('button', { name: /Adaugă lansetă/ })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /Adaugă lansetă/ })).toHaveCount(0);
    if (width === 375) await expectNoA11yViolations(page);
    await page.screenshot({ path: `${SHOTS}/empty-${width}.png`, fullPage: true });
  }
});

/* ------------------------------------------------------------------------------------------------
 * c3 / b.server-clock — provisional
 * ---------------------------------------------------------------------------------------------- */

test('partide.partida-lansete.c3 no server clock sample yet: running rods read «Se sincronizează», grey — never a red «Expirat»', async ({ page, fakeLive }) => {
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc() } });
  await mockCms(page, { sampled: false });
  await open(page, { width: 375 });
  for (const i of [2, 3]) {
    await expect(card(page, i).getByTestId('rod-countdown-label')).toHaveText('Se sincronizează');
    await expect(card(page, i).getByTestId('rod-countdown')).toHaveAttribute('data-tone', 'muted');
  }
  await expect(page.getByText('Expirat', { exact: true })).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/provisional-375.png`, fullPage: true });
});

test('partide.partida-lansete.c3 the projection from the offline cache is provisional too, until a server snapshot lands', async ({ page, fakeLive }) => {
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc() }, fromCache: true });
  await mockCms(page);
  await open(page);
  await expect(card(page, 3).getByTestId('rod-countdown-label')).toHaveText('Se sincronizează');
  await fakeLive.push(LIVE.clientId, liveDoc(), false);
  await expect(card(page, 3).getByTestId('rod-countdown-label')).toHaveText('Expirat');
});

/* ------------------------------------------------------------------------------------------------
 * Open but not followed live here (runtimes from a one-shot GET /feed/sessions/:id)
 * ---------------------------------------------------------------------------------------------- */

const ELSEWHERE = { documentId: 'e2e-l-open', clientId: 'e2e-lc-open' };
const dtoRod = (index: number, patch: Record<string, unknown> = {}) => ({ index, label: `L${index}`, color: '#22C55E', bait: 'Porumb', baitType: null, baitSize: null, baitFlavor: null, lane: 'center', distance: 70, castLat: null, castLng: null, durationMs: MIN30, alarmSound: 'tone-1', runtimePhase: 'idle', runtimeEndsAt: null, ...patch });

/** The CMS for a partidă open on another device: no pointer to it, the own list and its detail. */
async function mockOpenElsewhere(page: Page): Promise<Calls> {
  const calls: Calls = { cast: [], stop: [], events: [] };
  const item = {
    documentId: ELSEWHERE.documentId, clientId: ELSEWHERE.clientId, clientUpdatedAt: null, venueType: 'lake', lakeId: 'e2e-lake-1', lakeName: 'Balta Mock', lakeImageUrl: null,
    publicWaterCode: null, publicWaterName: null, manualVenueName: null, standId: null, standName: '7', locality: 'Ilfov', anchorLat: ANCHOR.lat, anchorLong: ANCHOR.lng, anchorName: null,
    startedAt: at(134), endedAt: null, plannedDurationMs: 8 * 3_600_000, notes: null, visibleOnProfile: true, status: 'active', targetSpecies: [], hostUid: selfId,
  };
  // A stale read: L2 «fishing» with a deadline already past by the device clock — never «Expirat» from it.
  const detail = { ...item, joinCode: 'K7M2QX', rods: [dtoRod(1), dtoRod(2, { runtimePhase: 'fishing', runtimeEndsAt: iso(T - 133_000) })], members: [member(selfId, 'Eu Pescar')], events: [] };
  await page.route(/tiles\.openfreemap\.org|arcgisonline\.com/, r => r.abort());
  await page.route('**/api/cms/feed/session-follows/mine', route => json(route, { data: { sessionDocumentIds: [] } }));
  // The pointer answers (and samples the clock) — but it points nowhere.
  await page.route('**/api/cms/feed/sessions/active', route => route.fulfill({ status: 200, contentType: 'application/json', headers: { date: NOW.toUTCString() }, body: JSON.stringify({ data: null }) }));
  await page.route(/\/api\/cms\/feed\/sessions\/mine(\?.*)?$/, route => json(route, { data: [{ ...item, captures: 0, recordKg: null, totalKg: null }], meta: { page: 1, pageSize: 100, total: 1 } }));
  await page.route(/\/feed\/community\/sessions\/(e2e-[^/?]+)(\?.*)?$/, route => fail(route, 404));
  await page.route(/\/api\/cms\/feed\/sessions\/(e2e-[^/?]+)(\/[^?]*)?(\?.*)?$/, route => {
    const url = new URL(route.request().url());
    const rest = /\/feed\/sessions\/e2e-[^/]+(\/.*)?$/.exec(url.pathname)![1] ?? '';
    if (route.request().method() === 'GET' && !rest) return json(route, { data: detail });
    if (/\/rods\/\d+\/cast$/.test(rest)) calls.cast.push({ index: 0, body: {} });
    else if (/\/rods\/\d+\/stop$/.test(rest)) calls.stop.push({ index: 0, body: {} });
    else if (rest === '/events') calls.events.push({});
    return fail(route, 404);
  });
  return calls;
}

test('partide.partida-lansete open but not followed live here: one quiet caption says why, rods without controls, no confident countdown — axe clean', async ({ page, fakeLive }) => {
  const calls = await mockOpenElsewhere(page);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.clock.install({ time: NOW });
  await page.goto(`/partide/${ELSEWHERE.documentId}?tab=lansete`);
  await expect(page.getByTestId('partida-member-view')).not.toHaveAttribute('data-live', 'true');
  await expect(page.getByTestId('lansete-not-live')).toHaveText('Partida nu e urmărită în timp real aici: vezi lansetele, fără cronometre și fără butoane.');
  await expect(page.getByTestId('rod-card')).toHaveCount(2);
  await expect(page.getByTestId('rod-title')).toHaveText(['Centru · 70 m', 'Centru · 70 m']);
  // No controls: no start / stop, no outcomes.
  await expect(page.getByTestId('rod-start')).toHaveCount(0);
  await expect(page.getByTestId('rod-stop')).toHaveCount(0);
  await expect(page.getByRole('group', { name: 'Rezultat' })).toHaveCount(0);
  // Never a guessed «Expirat» / «Timp rămas» from the stale read.
  await expect(page.getByText('Expirat', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Timp rămas', { exact: true })).toHaveCount(0);
  await expect(card(page, 2).getByTestId('rod-countdown-value').locator('xpath=self::*[contains(@class,"text-status-danger-fg")]')).toHaveCount(0);
  await expectNoA11yViolations(page);
  await page.screenshot({ path: `${SHOTS}/not-live-375.png`, fullPage: true });
  expect(calls).toEqual({ cast: [], stop: [], events: [] });
  expect(fakeLive.attempts).toEqual([]);
});

/* ------------------------------------------------------------------------------------------------
 * c10 — the tick
 * ---------------------------------------------------------------------------------------------- */

test('partide.partida-lansete.c10 countdowns tick every second on the server clock; a passed deadline turns the rod «Expirat» with no write', async ({ page, fakeLive }) => {
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc({ rods: [rodIdle(), rodFishing({ runtimeEndsAt: iso(T + 4_000) })] }) } });
  const calls = await mockCms(page);
  await open(page);
  const value = card(page, 2).getByTestId('rod-countdown-value');
  await expect(card(page, 2).getByTestId('rod-countdown-label')).toHaveText('Timp rămas');
  await expect(value).toHaveText(/^00:00:0[1-4]$/);
  await page.clock.runFor(6_000);
  await expect(card(page, 2)).toHaveAttribute('data-phase', 'firing');
  await expect(card(page, 2).getByTestId('rod-countdown-label')).toHaveText('Expirat');
  await expect(value).toHaveText(/^-00:00:0\d$/);
  const before = await value.textContent();
  await page.clock.runFor(3_000);
  await expect(value).not.toHaveText(before!);
  // Nothing is written for an expiry ('firing' is derived) — and no alarm exists on the web.
  expect(calls.cast).toEqual([]);
  expect(calls.stop).toEqual([]);
  expect(calls.events).toEqual([]);
});

test('partide.partida-lansete.c10 the server clock, not the device clock: a server one hour ahead sees the deadline passed', async ({ page, fakeLive }) => {
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc({ rods: [rodFishing({ runtimeEndsAt: iso(T + 30 * 60_000) })] }) } });
  await mockCms(page, { sampled: false });
  await page.route('**/api/cms/feed/sessions/active', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { date: new Date(T + 3_600_000).toUTCString() },
      body: JSON.stringify({ data: { documentId: LIVE.documentId, clientId: LIVE.clientId, firestoreId: LIVE.clientId } }),
    }),
  );
  await open(page);
  await expect(card(page, 2).getByTestId('rod-countdown-label')).toHaveText('Expirat');
  await expect(card(page, 2).getByTestId('rod-countdown-value')).toHaveText(/^-00:(29|30):\d\d$/);
});

/* ------------------------------------------------------------------------------------------------
 * c9 — start / stop
 * ---------------------------------------------------------------------------------------------- */

test('partide.partida-lansete.c9 «Pornește cronometrul» on a timer rod casts (CAS null), counts at once, adopts the server deadline; timer-free rods have no pill', async ({ page, fakeLive }) => {
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc() } });
  const calls = await mockCms(page, { castEndsAt: T + 29 * 60_000 });
  await open(page);
  await expect(card(page, 4).getByTestId('rod-start')).toHaveCount(0);
  const start = card(page, 1).getByRole('button', { name: 'Pornește cronometrul 30:00' });
  await expect(start).toBeVisible();
  await start.click();
  await expect.poll(() => calls.cast.length).toBe(1);
  expect(calls.cast[0]).toEqual({ index: 1, body: { expectEndsAt: null } });
  await expect(card(page, 1).getByTestId('rod-countdown-label')).toHaveText('Timp rămas');
  // The server's 29:00 replaces the optimistic 30:00.
  await expect(card(page, 1).getByTestId('rod-countdown-value')).toHaveText(/^00:28:5\d|00:29:00$/);
  await expect(card(page, 1).getByTestId('rod-start')).toHaveCount(0);
  await expect(card(page, 1).getByTestId('rod-stop')).toBeVisible();
  // The projection's echo takes over seamlessly.
  const doc = liveDoc();
  doc.rods = [rodIdle({ runtimePhase: 'fishing', runtimeEndsAt: iso(T + 29 * 60_000) }), rodFishing(), rodExpired(), rodFree()];
  await fakeLive.push(LIVE.clientId, doc);
  await expect(card(page, 1).getByTestId('rod-countdown-value')).toHaveText(/^00:28:5\d|00:29:00$/);
  expect(calls.events).toEqual([]);
});

test('partide.partida-lansete.c9 an expired rod restarts from the same pill (expectEndsAt = its deadline), no stop on it; a failed cast rolls back', async ({ page, fakeLive }) => {
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc() } });
  const calls = await mockCms(page, { castStatus: 400 });
  await open(page);
  await expect(card(page, 3).getByTestId('rod-stop')).toHaveCount(0);
  await card(page, 3).getByRole('button', { name: 'Pornește cronometrul 20:00' }).click();
  await expect.poll(() => calls.cast.length).toBe(1);
  expect(calls.cast[0]).toEqual({ index: 3, body: { expectEndsAt: iso(T - 133_000) } });
  // 400 is not retried: the optimistic countdown goes back to «Expirat», and the angler is told.
  await expect(card(page, 3).getByTestId('rod-countdown-label')).toHaveText('Expirat');
  await expect(toast(page, 'Nu am putut salva. Mai încearcă.')).toBeVisible();
  expect(calls.events).toEqual([]);
});

test('partide.partida-lansete.c7 an outcome whose event write fails for good says «Nu am putut salva. Mai încearcă.» after the takeover', async ({ page, fakeLive }) => {
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc() } });
  const calls = await mockCms(page, { eventsStatus: 400 });
  await open(page);
  await card(page, 4).getByRole('button', { name: 'Fără trăsătură' }).click();
  await expect(card(page, 4).getByTestId('rod-takeover')).toBeVisible();
  await expect.poll(() => calls.events.length).toBe(1);
  await expect(toast(page, 'Nu am putut salva. Mai încearcă.')).toBeVisible();
});

test('partide.partida-lansete.c9 a CAS miss is no failure: the server\'s rod is adopted, no error toast', async ({ page, fakeLive }) => {
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc() } });
  const calls = await mockCms(page);
  // The cast loses the race: the server answers with the rod a teammate already started.
  await page.route(/\/api\/cms\/feed\/sessions\/e2e-[^/]+\/rods\/1\/cast$/, route => {
    calls.cast.push({ index: 1, body: {} });
    return json(route, { data: { rod: { index: 1, runtimePhase: 'fishing', runtimeEndsAt: iso(T + 20 * 60_000) }, serverNow: iso(T), applied: false } });
  });
  await open(page);
  await card(page, 1).getByRole('button', { name: 'Pornește cronometrul 30:00' }).click();
  await expect.poll(() => calls.cast.length).toBe(1);
  await expect(card(page, 1).getByTestId('rod-countdown-value')).toHaveText(/^00:(20:00|19:5\d)$/);
  await settle(page);
  await expect(toast(page, 'Nu am putut salva. Mai încearcă.')).toHaveCount(0);
});

test('partide.partida-lansete.c9 the stop control asks «Oprești cronometrul?» with «{lane} · {m} m»; «Nu» keeps it, «Da, oprește» stops (CAS on the deadline), nothing logged', async ({ page, fakeLive }) => {
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc() } });
  const calls = await mockCms(page);
  for (const width of [375, 1280]) {
    await open(page, { width });
    await card(page, 2).getByRole('button', { name: 'Oprește cronometrul' }).click();
    const dialog = page.getByTestId('stop-rod-dialog');
    await expect(page.getByRole('heading', { name: 'Oprești cronometrul?' })).toBeVisible();
    await expect(dialog).toContainText('Vrei să oprești cronometrul fără să înregistrezi o acțiune?');
    await expect(page.getByTestId('stop-rod-label')).toHaveText('Centru · 70 m');
    await settle(page);
    if (width === 375) await expectNoA11yViolations(page);
    await page.screenshot({ path: `${SHOTS}/stop-dialog-${width}.png` });
    await page.getByRole('button', { name: 'Nu', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Oprești cronometrul?' })).toHaveCount(0);
    expect(calls.stop).toEqual([]);
  }
  await card(page, 2).getByRole('button', { name: 'Oprește cronometrul' }).click();
  await page.getByRole('button', { name: 'Da, oprește' }).click();
  await expect.poll(() => calls.stop.length).toBe(1);
  expect(calls.stop[0]).toEqual({ index: 2, body: { expectEndsAt: iso(T + 12 * 60_000 + 30_000) } });
  await expect(card(page, 2).getByTestId('rod-countdown')).toHaveCount(0);
  await expect(card(page, 2).getByRole('button', { name: 'Pornește cronometrul 30:00' })).toBeVisible();
  expect(calls.events).toEqual([]);
});

/* ------------------------------------------------------------------------------------------------
 * c7 — outcome dispatch, c6 — takeover
 * ---------------------------------------------------------------------------------------------- */

test('partide.partida-lansete.c7 on an idle rod an outcome only logs the event (no runtime write)', async ({ page, fakeLive }) => {
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc() } });
  const calls = await mockCms(page);
  await open(page);
  await card(page, 4).getByRole('button', { name: 'Fără trăsătură' }).click();
  await expect.poll(() => calls.events.length).toBe(1);
  expect(calls.events[0]).toMatchObject({ outcome: 'blank', rodIndex: 4, rodLabel: 'L4', bait: 'Viermi', distance: 45 });
  expect(calls.stop).toEqual([]);
  expect(calls.cast).toEqual([]);
});

test('partide.partida-lansete.c7 on a running and on an expired rod an outcome resolves the cycle: stop (CAS) + the event, the card back to idle', async ({ page, fakeLive }) => {
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc() } });
  const calls = await mockCms(page);
  const errors = collectConsoleErrors(page, { ignore: /Failed to load resource: the server responded with a status of 404/ });
  await open(page);
  await card(page, 2).getByRole('button', { name: 'Scăpat' }).click();
  await expect.poll(() => calls.events.length).toBe(1);
  expect(calls.events[0]).toMatchObject({ outcome: 'lost', rodIndex: 2 });
  await expect.poll(() => calls.stop.length).toBe(1);
  expect(calls.stop[0]).toEqual({ index: 2, body: { expectEndsAt: iso(T + 12 * 60_000 + 30_000) } });
  await expect(card(page, 2).getByTestId('rod-countdown')).toHaveCount(0);

  await card(page, 3).getByRole('button', { name: 'Fără trăsătură' }).click();
  await expect.poll(() => calls.events.length).toBe(2);
  expect(calls.events[1]).toMatchObject({ outcome: 'blank', rodIndex: 3 });
  await expect.poll(() => calls.stop.length).toBe(2);
  expect(calls.stop[1]).toEqual({ index: 3, body: { expectEndsAt: iso(T - 133_000) } });
  await expect(card(page, 3).getByTestId('rod-countdown')).toHaveCount(0);
  expect(calls.cast).toEqual([]);
  // The writes parse (no «[partida lansete]» error, no dev overlay issue).
  expect(errors).toEqual([]);
});

test('partide.partida-lansete.c6 a recorded outcome covers the card with its scene and a joke, swallows taps while it plays, then goes', async ({ page, fakeLive }) => {
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc() } });
  const calls = await mockCms(page);
  await open(page);
  await card(page, 1).getByRole('button', { name: 'Fără trăsătură' }).click();
  const takeover = card(page, 1).getByTestId('rod-takeover');
  await expect(takeover).toBeVisible();
  await expect(takeover).toHaveAttribute('data-kind', 'blank');
  await expect(takeover).toContainText('Fără trăsătură');
  const joke = (await takeover.locator('p').nth(1).textContent())!;
  expect(['Nu îi e foame...', 'Hmm, probabil era în mâl.', 'Azi peștii țin post.', 'Liniște totală pe baltă.']).toContain(joke);
  await page.screenshot({ path: `${SHOTS}/takeover-blank-1280.png` });
  // A tap on the covered card and a keyboard activation of the focused button do nothing.
  await card(page, 1).click({ position: { x: 40, y: 40 } });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  expect(calls.events).toHaveLength(1);
  await page.clock.runFor(3_000);
  await expect(takeover).toHaveCount(0);

  await card(page, 4).getByRole('button', { name: 'Scăpat' }).click();
  const lost = card(page, 4).getByTestId('rod-takeover');
  await expect(lost).toHaveAttribute('data-kind', 'lost');
  await expect(lost).toContainText('Scăpat');
  expect(['A scăpat... oricum era mic.', 'S-a dus... lasă că vine altul mai mare.', 'Peștele: 1 — Tu: 0', 'A zis că revine cu întăriri.']).toContain((await lost.locator('p').nth(1).textContent())!);
  await page.setViewportSize({ width: 375, height: 900 });
  await lost.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${SHOTS}/takeover-lost-375.png` });
});

test('partide.partida-lansete.c6 prefers-reduced-motion: the takeover is static (no running animation) and still covers the card', async ({ page, fakeLive }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc() } });
  await mockCms(page);
  await open(page);
  await card(page, 1).getByRole('button', { name: 'Scăpat' }).click();
  const takeover = card(page, 1).getByTestId('rod-takeover');
  await expect(takeover).toBeVisible();
  const running = await card(page, 1).evaluate(el => el.getAnimations({ subtree: true }).length);
  expect(running).toBe(0);
});

/* ------------------------------------------------------------------------------------------------
 * c5 — the 60 s cooldown
 * ---------------------------------------------------------------------------------------------- */

test('partide.partida-lansete.c5 the same outcome on the same rod within 60 s is refused with fish\'s copy; other outcomes / rods are not', async ({ page, fakeLive }) => {
  await fakeLive.seed({
    docs: {
      [LIVE.clientId]: liveDoc({
        catches: [catchOn('ev-l', 1, 'lost', iso(T - 20_000)), catchOn('ev-b', 4, 'blank', iso(T - 30_000)), catchOn('ev-old', 1, 'blank', iso(T - 61_000))],
      }),
    },
  });
  const calls = await mockCms(page);
  await open(page);
  await card(page, 1).getByRole('button', { name: 'Scăpat' }).click();
  await expect(toast(page, 'Ai marcat deja «scăpat» pe lanseta asta acum 20s. Un pește nu scapă de două ori într-un minut 🎣')).toBeVisible();
  await expect(card(page, 1).getByTestId('rod-takeover')).toHaveCount(0);
  await card(page, 4).getByRole('button', { name: 'Fără trăsătură' }).click();
  await expect(toast(page, 'Ai marcat deja «fără trăsătură» acum 30s. Stai un pic până la următoarea aruncare 🎣')).toBeVisible();
  await page.waitForTimeout(300);
  expect(calls.events).toEqual([]);
  // A blank 61 s ago on L1 does not block another; a lost on L4 is independent of its blank.
  await card(page, 1).getByRole('button', { name: 'Fără trăsătură' }).click();
  await card(page, 4).getByRole('button', { name: 'Scăpat' }).click();
  await expect.poll(() => calls.events.map(e => `${String(e.rodIndex)}:${String(e.outcome)}`)).toEqual(['1:blank', '4:lost']);
});

/* ------------------------------------------------------------------------------------------------
 * c4 / c8 — Captură
 * ---------------------------------------------------------------------------------------------- */

test('partide.partida-lansete.c4 «Captură» opens the capture flow for that rod', async ({ page, fakeLive }) => {
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc() } });
  await mockCms(page);
  await open(page);
  await card(page, 2).getByRole('button', { name: 'Captură' }).click();
  await expect(page).toHaveURL(new RegExp(`/partide/${LIVE.documentId}/captura\\?lanseta=2$`));
});

test('partide.partida-lansete.c8 «Captură» on a rod with a capture 12 s ago asks first; «Anulează» stays, «Da, adaug» goes', async ({ page, fakeLive }) => {
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc({ catches: [catchOn('ev-r', 1, 'capture', iso(T - 12_000), 3.1)] }) } });
  await mockCms(page);
  await open(page);
  await card(page, 1).getByRole('button', { name: 'Captură' }).click();
  await expect(page.getByRole('heading', { name: 'Sigur adaugi altă captură?' })).toBeVisible();
  await expect(page.getByTestId('capture-spam-guard')).toHaveText(/^Ai adăugat o captură acum 1[2-4]s\. Ești sigur că vrei să adaugi alta\?$/);
  await page.getByRole('button', { name: 'Anulează' }).click();
  await expect(page).toHaveURL(/\?tab=lansete$/);
  await card(page, 1).getByRole('button', { name: 'Captură' }).click();
  await page.getByRole('button', { name: 'Da, adaug' }).click();
  await expect(page).toHaveURL(new RegExp(`/captura\\?lanseta=1$`));
});

/* ------------------------------------------------------------------------------------------------
 * c12 — offline
 * ---------------------------------------------------------------------------------------------- */

test('partide.partida-lansete.c12 offline: outcome, capture, start and stop are refused with «Fără conexiune. Reconectare…»; the controls dim', async ({ page, context, fakeLive }) => {
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc() } });
  const calls = await mockCms(page);
  await open(page, { width: 375 });
  await expect(card(page, 1)).toBeVisible();
  await context.setOffline(true);
  await expect(page.getByTestId('partida-reconnecting')).toBeVisible();
  await expect(card(page, 1).getByRole('button', { name: 'Scăpat' })).toHaveAttribute('aria-disabled', 'true');
  // aria-disabled, not disabled: still focusable and pressable — the press answers with the toast
  // (Playwright treats aria-disabled as not actionable, hence `force`). The keyboard too:
  await card(page, 1).getByRole('button', { name: 'Fără trăsătură' }).focus();
  await page.keyboard.press('Enter');
  await expect(toast(page, 'Fără conexiune. Reconectare…')).toBeVisible();
  await card(page, 1).getByRole('button', { name: 'Scăpat' }).click({ force: true });
  await expect(toast(page, 'Fără conexiune. Reconectare…')).toBeVisible();
  await expect(card(page, 1).getByTestId('rod-takeover')).toHaveCount(0);
  await card(page, 1).getByRole('button', { name: 'Captură' }).click({ force: true });
  await card(page, 1).getByRole('button', { name: 'Pornește cronometrul 30:00' }).click({ force: true });
  await card(page, 2).getByRole('button', { name: 'Oprește cronometrul' }).click({ force: true });
  await expect(page.getByRole('heading', { name: 'Oprești cronometrul?' })).toHaveCount(0);
  await expect(page).toHaveURL(/\?tab=lansete$/);
  await page.screenshot({ path: `${SHOTS}/offline-375.png`, fullPage: true });
  expect(calls).toEqual({ cast: [], stop: [], events: [] });
  await context.setOffline(false);
  await expect(card(page, 1).getByRole('button', { name: 'Scăpat' })).not.toHaveAttribute('aria-disabled', /.*/);
});
