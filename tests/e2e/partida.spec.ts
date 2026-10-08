import { mkdirSync } from 'node:fs';
import type { Page, Route } from '@playwright/test';
import { expectNoA11yViolations } from './helpers/a11y';
import { expect, test, type FakeLiveDoc } from './helpers/fake-live';
import { CMS, qaJwt, signIn } from './helpers/session';

/*
 * partide.partida — the viewer's own partidă on /partide/[id], read-only (owner 2026-10-08, ROADMAP
 * §4b rule 21: running a partidă is app-only on web; fish app/(app)/partide/[id].tsx) + the app
 * hand-over, partide.spectator.c1, partide.b.own-vs-spectator, b.live-subscription, b.server-clock.
 *
 * Data, all in the browser — NOTHING reaches Firestore or writes to any CMS:
 *  - the live partidă comes from the shared Firestore fake (helpers/fake-live.ts: projection docs,
 *    pushed snapshots, listener errors); any Firebase request fails the test;
 *  - GET /feed/sessions/active (the pointer), /feed/sessions/mine (the own list), /feed/sessions/:id
 *    (a non-live partidă's detail, and the access confirmation) are route-mocked, as is every write
 *    (finish, extend, delete, leave, kick, rotate, PATCH, /feedbacks) — mocks answer without a Date
 *    header, so the server clock stays unsampled unless a test feeds it;
 *  - ids start with `e2e-`: the server never reads them (_spectator/load.ts), so the public read
 *    of the static shell is answered here too (404 unless a test says otherwise).
 * The viewer is the real QA account (the session cookie; the server reads its profile) — its
 * documentId is the owner / member uid below. A fixed clock (page.clock) keeps the durations exact.
 */

const NOW = new Date('2026-10-07T12:00:00.000Z');
const at = (minutesAgo: number) => new Date(NOW.getTime() - minutesAgo * 60_000).toISOString();
const SHOTS = '.shots/partida';
mkdirSync(SHOTS, { recursive: true });

const LIVE = { documentId: 'e2e-m-live', clientId: 'e2e-c-live' };
const ENDED = { documentId: 'e2e-m-ended', clientId: 'e2e-c-ended' };
const OTHER = 'e2e-m-other';

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

const member = (uid: string, name: string | null) => ({ uid, name, avatar: null, joinedAt: at(130) });
const rod = (index: number) => ({ clientId: `rod-${index}`, index, label: `L${index}`, color: '#6366F1', bait: 'Boilies', lane: 'center' as const, distance: 60, runtimePhase: 'idle' as const });
const catchDoc = (n: number, kg: number | null, species: string | null, minutesAgo: number, outcome: 'capture' | 'lost' = 'capture') => ({
  clientId: `ev-${n}`,
  outcome,
  occurredAt: at(minutesAgo),
  rodIndex: 1,
  weightKg: kg,
  species,
  photoUrl: null,
  photoThumbUrl: null,
});

function liveDoc(patch: Partial<FakeLiveDoc> = {}): FakeLiveDoc {
  return {
    startedAt: at(134), // 2h 14m before NOW
    endedAt: null,
    status: 'active',
    venueType: 'lake',
    lakeId: 'e2e-lake-1',
    lakeName: 'Balta Mock',
    standName: '7',
    locality: 'Giurgiu',
    anchorLat: 44.4321,
    anchorLong: 26.1234,
    anchorName: null,
    warnedAt: null,
    autoCloseAt: null,
    plannedDurationMs: 8 * 3_600_000,
    visibleOnProfile: true,
    hostUid: selfId,
    joinCode: 'K7M2QX',
    members: [member(selfId, 'Eu Pescar'), member('e2e-angler-2', 'Ana Crap')],
    rods: [rod(1), rod(2)],
    catches: [catchDoc(1, 2.4, 'Crap', 100), catchDoc(2, 8.69, 'Somn', 60), catchDoc(3, null, 'Caras', 40), catchDoc(4, null, null, 20, 'lost')],
    rev: 3,
    ...patch,
  };
}

type ListItem = Record<string, unknown> & { documentId: string; clientId: string };

function listItem(ids: { documentId: string; clientId: string }, patch: Record<string, unknown> = {}): ListItem {
  return {
    documentId: ids.documentId,
    clientId: ids.clientId,
    clientUpdatedAt: null,
    venueType: 'lake',
    lakeId: 'e2e-lake-1',
    lakeName: 'Lacul Istoric',
    lakeImageUrl: null,
    publicWaterCode: null,
    publicWaterName: null,
    manualVenueName: null,
    standId: null,
    standName: null,
    locality: 'Ilfov',
    anchorLat: 44.5,
    anchorLong: 26.2,
    anchorName: null,
    startedAt: at(26 * 60),
    endedAt: at(20 * 60),
    plannedDurationMs: 6 * 3_600_000,
    notes: null,
    visibleOnProfile: true,
    status: 'finished',
    targetSpecies: [],
    hostUid: selfId,
    captures: 2,
    recordKg: 5.1,
    totalKg: 7.3,
    ...patch,
  };
}

const eventDto = (n: number, kg: number | null, minutesAgo: number, photo = false) => ({
  id: n,
  documentId: `evd-${n}`,
  clientId: `ev-${n}`,
  clientUpdatedAt: null,
  outcome: 'capture',
  rodIndex: 1,
  rodLabel: 'L1',
  rodColor: null,
  bait: null,
  baitType: null,
  baitSize: null,
  baitFlavor: null,
  lane: null,
  distance: null,
  lat: null,
  lng: null,
  weightKg: kg,
  weightEstimated: false,
  species: 'Crap',
  speciesId: null,
  photoUrl: photo ? 'https://e2e-photos.invalid/p.png' : null,
  photoThumbUrl: null,
  notes: null,
  occurredAt: at(minutesAgo),
  photoTagUids: [],
});

function detailOf(item: ListItem, patch: Record<string, unknown> = {}) {
  const { captures: _c, recordKg: _r, totalKg: _t, ...base } = item;
  void _c;
  void _r;
  void _t;
  return {
    ...base,
    joinCode: 'ARH1VE',
    rods: [],
    members: [member(selfId, 'Eu Pescar'), member('e2e-angler-3', 'Mihai')],
    events: [eventDto(1, 5.1, 22 * 60, true), eventDto(2, 2.2, 21 * 60)],
    ...patch,
  };
}

type Answer = number | { status: number; bluCode?: string; delayMs?: number; body?: unknown };
type Calls = {
  active: number;
  detail: string[];
  finish: string[];
  extend: string[];
  remove: string[];
  leave: string[];
  kick: string[];
  rotate: string[];
  patch: unknown[];
  feedback: Record<string, unknown>[];
};

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const fail = (route: Route, status: number, bluCode?: string) =>
  json(route, { data: null, error: { status, name: 'Error', message: 'mock', details: bluCode ? { bluCode } : {} } }, status);

async function answer(route: Route, a: Answer | undefined, ok: unknown) {
  const spec = typeof a === 'number' ? { status: a } : (a ?? { status: 200 });
  if (spec.delayMs) await new Promise(r => setTimeout(r, spec.delayMs));
  if (spec.status !== 200) return fail(route, spec.status, spec.bluCode);
  return json(route, spec.body ?? ok);
}

/**
 * The CMS, as the member view sees it. `details[documentId]`: the detail (or an error) per read, a
 * queue whose last entry repeats.
 */
async function mockCms(
  page: Page,
  {
    active = null as null | { documentId: string; clientId: string },
    activeDate = undefined as string | undefined,
    mine = [] as ListItem[],
    details = {} as Record<string, (Answer | Record<string, unknown>)[]>,
    community = {} as Record<string, unknown>,
    writes = {} as Partial<Record<'finish' | 'extend' | 'remove' | 'leave' | 'kick' | 'rotate' | 'patch' | 'feedback', Answer>>,
  } = {},
): Promise<Calls> {
  const calls: Calls = { active: 0, detail: [], finish: [], extend: [], remove: [], leave: [], kick: [], rotate: [], patch: [], feedback: [] };
  await page.route('https://e2e-photos.invalid/**', r => r.fulfill({ status: 404 }));
  // Map tiles / styles of the picker: never fetched from the network in a test.
  await page.route(/tiles\.openfreemap\.org|arcgisonline\.com/, r => r.abort());
  await page.route(/\/feed\/community\/sessions\/(e2e-[^/?]+)(\?.*)?$/, route => {
    const id = /sessions\/(e2e-[^/?]+)/.exec(route.request().url())![1];
    return community[id] ? json(route, { data: community[id] }) : fail(route, 404);
  });
  await page.route('**/api/cms/feed/session-follows/mine', route => json(route, { data: { sessionDocumentIds: [] } }));
  await page.route('**/api/cms/feed/sessions/active', route => {
    calls.active += 1;
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: activeDate ? { date: activeDate } : {},
      body: JSON.stringify({ data: active ? { documentId: active.documentId, clientId: active.clientId, firestoreId: active.clientId } : null }),
    });
  });
  await page.route(/\/api\/cms\/feed\/sessions\/mine(\?.*)?$/, route => json(route, { data: mine, meta: { page: 1, pageSize: 100, total: mine.length } }));
  await page.route(/\/api\/cms\/feed\/sessions\/(e2e-[^/?]+)(\/[^?]*)?(\?.*)?$/, async route => {
    const url = new URL(route.request().url());
    const m = /\/feed\/sessions\/(e2e-[^/]+)(\/.*)?$/.exec(url.pathname)!;
    const id = m[1];
    const rest = m[2] ?? '';
    const method = route.request().method();
    if (method === 'GET' && !rest) {
      calls.detail.push(id);
      const queue = details[id] ?? [404];
      const next = queue.length > 1 ? queue.shift()! : queue[0];
      if (typeof next === 'number' || (typeof next === 'object' && 'status' in next && typeof next.status === 'number' && !('documentId' in next))) {
        return answer(route, next as Answer, null);
      }
      return json(route, { data: next });
    }
    if (method === 'POST' && rest === '/finish') {
      calls.finish.push(id);
      return answer(route, writes.finish, { data: detailOf(listItem({ documentId: id, clientId: 'x' })) });
    }
    if (method === 'POST' && rest === '/extend') {
      calls.extend.push(id);
      return answer(route, writes.extend, { data: { ok: true } });
    }
    if (method === 'POST' && rest === '/leave') {
      calls.leave.push(id);
      return answer(route, writes.leave, { data: { removed: true } });
    }
    if (method === 'DELETE' && rest.startsWith('/members/')) {
      calls.kick.push(rest.slice('/members/'.length));
      return answer(route, writes.kick, { data: { removed: true, joinCode: 'NEW123', members: [member(selfId, 'Eu Pescar')], hostUid: selfId, projectionRev: 4 } });
    }
    if (method === 'POST' && rest === '/join-code/rotate') {
      calls.rotate.push(id);
      return answer(route, writes.rotate, { data: { joinCode: 'NEW123', projectionRev: 4 } });
    }
    if (method === 'DELETE' && !rest) {
      calls.remove.push(id);
      return answer(route, writes.remove, { data: { ok: true } });
    }
    if (method === 'PATCH' && !rest) {
      calls.patch.push(route.request().postDataJSON());
      return answer(route, writes.patch, { data: { ok: true } });
    }
    return fail(route, 418);
  });
  await page.route('**/api/cms/feedbacks', route => {
    calls.feedback.push(route.request().postDataJSON());
    return answer(route, writes.feedback, { data: { documentId: 'fb-1' } });
  });
  return calls;
}

async function open(page: Page, documentId: string, { width = 1280, tab }: { width?: number; tab?: string } = {}) {
  await page.setViewportSize({ width, height: 900 });
  await page.clock.install({ time: NOW });
  await page.goto(`/partide/${documentId}${tab ? `?tab=${tab}` : ''}`);
}

const memberView = (page: Page) => page.getByTestId('partida-member-view');
const visibleButton = (page: Page, name: string | RegExp) => page.getByRole('button', { name }).filter({ visible: true }).first();
const toast = (page: Page, text: string) => page.getByText(text, { exact: true }).filter({ visible: true });
/**
 * Records, from the first byte of HTML on, every `data-testid` of `ids` that was ever attached
 * (a MutationObserver installed before any page script) — «never X first» is then provable, not
 * just the end state. Read with `seenTestIds(page)`.
 */
async function watchTestIds(page: Page, ids: string[]) {
  await page.addInitScript(watch => {
    const seen = new Set<string>();
    (window as unknown as { __seenTestIds: Set<string> }).__seenTestIds = seen;
    const scan = (n: Node) => {
      if (!(n instanceof Element)) return;
      for (const id of watch) if (n.matches(`[data-testid="${id}"]`) || n.querySelector(`[data-testid="${id}"]`)) seen.add(id);
    };
    new MutationObserver(records => records.forEach(r => r.addedNodes.forEach(scan))).observe(document, { childList: true, subtree: true });
  }, ids);
}
const seenTestIds = (page: Page) => page.evaluate(() => [...((window as unknown as { __seenTestIds?: Set<string> }).__seenTestIds ?? [])]);
const pointerStored = (page: Page) => page.evaluate(() => localStorage.getItem('@bluvi/partide/activeSessionId'));

test.beforeEach(async ({ context }) => {
  await signIn(context, jwt);
});

/* ------------------------------------------------------------------------------------------------
 * Ownership — partide.spectator.c1, b.own-vs-spectator, c23
 * ---------------------------------------------------------------------------------------------- */

test.describe('own vs spectator', () => {
  test('partide.partida.c23 b.live-subscription the live pointer (GET /feed/sessions/active) → the member view from the realtime projection', async ({ page, fakeLive }) => {
    await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc() } });
    const calls = await mockCms(page, { active: LIVE });
    await open(page, LIVE.documentId);
    await expect(memberView(page)).toBeVisible();
    await expect(memberView(page)).toHaveAttribute('data-live', 'true');
    expect(await fakeLive.subscribed()).toEqual([LIVE.clientId]);
    expect(calls.active).toBeGreaterThanOrEqual(1);
    // The live view never reads the detail over REST.
    expect(calls.detail).toEqual([]);
    expect(await pointerStored(page)).toBe(JSON.stringify({ sessionId: LIVE.clientId, documentId: LIVE.documentId }));
    // noindex
    await expect(page.locator('meta[name="robots"][content="noindex"]')).toHaveCount(1);
  });

  test('partide.spectator.c1 b.own-vs-spectator an own partidă from the own list (no pointer) → the member view over GET /feed/sessions/:id', async ({ page }) => {
    const item = listItem(ENDED);
    const calls = await mockCms(page, { mine: [item], details: { [ENDED.documentId]: [detailOf(item)] } });
    await open(page, ENDED.documentId);
    await expect(memberView(page)).toBeVisible();
    await expect(page.getByTestId('partida-title')).toHaveText('Lacul Istoric');
    expect(calls.detail).toContain(ENDED.documentId);
  });

  test('partide.spectator.c1 a private own partidă (the public read 404s) opens for its member — never «not found» first', async ({ page }) => {
    const item = listItem(ENDED, { visibleOnProfile: false });
    await mockCms(page, { mine: [item], details: { [ENDED.documentId]: [{ ...detailOf(item), visibleOnProfile: false }] } });
    await watchTestIds(page, ['partida-not-found', 'partida-member-not-found', 'partida-spectator']);
    await open(page, ENDED.documentId);
    await expect(memberView(page)).toBeVisible();
    // Neither the static shell nor the client's first renders ever showed «not found».
    expect(await seenTestIds(page)).toEqual([]);
    // The recap shows the private partidă's catches to its member.
    await expect(page.getByTestId('partida-catch')).toHaveCount(2);
    // partide.b.private-partida (member side): no share link.
    await expect(page.getByRole('button', { name: /Distribuie/ })).toHaveCount(0);
  });

  test('partide.spectator.c1 someone else\'s partidă → the spectator view (here: not found), never the member view', async ({ page, fakeLive }) => {
    await fakeLive.seed({ docs: {} });
    await mockCms(page, { active: null, mine: [listItem(ENDED)] });
    await open(page, OTHER);
    await expect(page.getByTestId('partida-not-found')).toBeVisible();
    await expect(memberView(page)).toHaveCount(0);
    expect(await fakeLive.subscribed()).toEqual([]);
  });

  test('signed out: the public page, no live layer request', async ({ page, context }) => {
    await context.clearCookies();
    const calls = await mockCms(page, { active: LIVE, mine: [listItem(LIVE)] });
    await open(page, LIVE.documentId);
    await expect(page.getByTestId('partida-not-found')).toBeVisible();
    await expect(memberView(page)).toHaveCount(0);
    expect(calls.active).toBe(0);
  });
});

/* ------------------------------------------------------------------------------------------------
 * The page — read-only (owner 2026-10-08, ROADMAP §4b rule 21): c1 c3 c4, the app hand-over
 * ---------------------------------------------------------------------------------------------- */

const APP_PARTIDA = (documentId: string) => `https://bluvi-app.wearetribus.com/partide/comunitate/${documentId}`;

for (const width of [375, 1280, 1440, 1920] as const) {
  test(`partide.partida.c1 c4 live partidă at ${width}: header, recap, summary, the app hand-over — no tab, no run control — axe clean`, async ({ page, fakeLive }) => {
    await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc() } });
    await mockCms(page, { active: LIVE });
    await open(page, LIVE.documentId, { width });
    await expect(page.getByRole('heading', { level: 1, name: 'Balta Mock' })).toBeVisible();
    await expect(page.getByTestId('partida-subtitle')).toHaveText('Stand 7 · 2 lansete');
    await expect(visibleButton(page, 'Înapoi')).toBeVisible();
    // Read-only: no tab strip, none of fish's member controls.
    await expect(page.getByRole('tab')).toHaveCount(0);
    for (const name of [/Termină/, /Părăsește/, /Șterge partida/, /Elimină/, /Schimbă codul/, /Ajustează poziția/, /Raportează/, /^Captură$/]) {
      await expect(page.getByRole('button', { name })).toHaveCount(0);
    }
    await expect(page.getByTestId('partida-recap')).toBeVisible();
    await expect(page.getByTestId('partida-catch')).toHaveCount(3);
    // The summary: Durată from the clock, 3 captures, the biggest «8,69 kg» (unit apart).
    const stats = page.getByTestId('partida-summary-stats');
    await expect(stats).toContainText('2h 14m');
    await expect(stats).toContainText('Capturi3');
    await expect(stats).toContainText('8,69kg');
    await expect(page.getByTestId('partida-roster-member')).toHaveCount(2);
    await expect(page.getByTestId('partida-join-code')).toContainText('K7M2QX');
    // The hand-over: the universal link below 1280, the store links from 1280.
    const cta = page.getByTestId('partida-app-cta');
    await expect(cta).toContainText('Partida ta e live');
    const link = cta.getByTestId('partida-open-in-app-link');
    const stores = cta.getByTestId('open-in-app-store');
    if (width < 1280) {
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute('href', APP_PARTIDA(LIVE.documentId));
      await expect(stores.filter({ visible: true })).toHaveCount(0);
    } else {
      await expect(link).toBeHidden();
      await expect(stores.filter({ visible: true })).toHaveCount(2);
    }
    // Share once on the screen: the header chip below 1280, the summary row from 1280.
    await expect(page.getByRole('button', { name: 'Distribuie partida' }).filter({ visible: true })).toHaveCount(1);
    await expectNoA11yViolations(page);
    await page.screenshot({ path: `${SHOTS}/live-owner-${width}.png`, fullPage: true });
  });
}

test('partide.partida.c1 the venue name falls back lake → public water → manual → anchor → «Partidă»; no rods → no rod part', async ({ page, fakeLive }) => {
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc({ lakeName: null, publicWaterName: 'Dunărea', rods: [], standName: null }) } });
  await mockCms(page, { active: LIVE });
  await open(page, LIVE.documentId);
  const title = page.getByTestId('partida-title');
  await expect(title).toHaveText('Dunărea');
  await expect(page.getByTestId('partida-subtitle')).toHaveText('Giurgiu');
  await fakeLive.push(LIVE.clientId, liveDoc({ lakeName: null, publicWaterName: null, manualVenueName: 'Balta lui Ion', rods: [] }));
  await expect(title).toHaveText('Balta lui Ion');
  await fakeLive.push(LIVE.clientId, liveDoc({ lakeName: null, anchorName: 'Cotul mare', rods: [rod(1)] }));
  await expect(title).toHaveText('Cotul mare');
  await expect(page.getByTestId('partida-subtitle')).toHaveText('Stand 7 · 1 lansetă');
  await fakeLive.push(LIVE.clientId, liveDoc({ lakeName: null, rods: [] }));
  await expect(title).toHaveText('Partidă');
});

test('partide.partida.c1 an ended partidă: «{date} · {duration}», ÎNCHEIATĂ, the recap, the app hand-over for edits — no join code', async ({ page }) => {
  const item = listItem(ENDED);
  await mockCms(page, { mine: [item], details: { [ENDED.documentId]: [detailOf(item)] } });
  await open(page, ENDED.documentId);
  await expect(page.getByTestId('partida-subtitle')).toHaveText(/^\d{1,2} \S+ · 6h$/);
  await expect(page.getByText('ÎNCHEIATĂ').filter({ visible: true })).toBeVisible();
  await expect(page.getByRole('tab')).toHaveCount(0);
  await expect(page.getByTestId('partida-catch')).toHaveCount(2);
  await expect(page.getByTestId('partida-app-cta')).toContainText('Partida se editează în aplicația Bluvi');
  await expect(page.getByTestId('partida-join-code')).toHaveCount(0);
  await expectNoA11yViolations(page);
  for (const width of [375, 1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.screenshot({ path: `${SHOTS}/ended-${width}.png`, fullPage: true });
  }
});

test('partide.partida.c4 the partidă ends while open (a teammate finished): the page follows, the persisted pointer is released', async ({ page, fakeLive }) => {
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc() } });
  await mockCms(page, { active: LIVE });
  await open(page, LIVE.documentId);
  await expect(memberView(page)).toHaveAttribute('data-live', 'true');
  await fakeLive.push(LIVE.clientId, liveDoc({ endedAt: at(1), status: 'finished' }));
  // b.live-subscription: a teammate's finish releases the PERSISTED pointer, the recap stays.
  await expect.poll(() => pointerStored(page)).toBeNull();
  await expect(memberView(page)).toHaveAttribute('data-ended', 'true');
  await expect(page.getByTestId('partida-recap')).toBeVisible();
});


/* ------------------------------------------------------------------------------------------------
 * States — c6 c7 c8 c9
 * ---------------------------------------------------------------------------------------------- */

test('partide.partida.c6 preparing: the pointer is known, the snapshot is not → «Se pregătește partida…», then the partidă', async ({ page, fakeLive }) => {
  await fakeLive.seed({ docs: {} });
  await mockCms(page, { active: LIVE });
  await open(page, LIVE.documentId, { width: 375 });
  await expect(page.getByTestId('partida-preparing')).toBeVisible();
  await expect(page.getByText('Se pregătește partida…')).toBeVisible();
  await expect(page.getByText('Partida nu a fost găsită')).toHaveCount(0);
  for (const width of [375, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.screenshot({ path: `${SHOTS}/preparing-${width}.png`, fullPage: true });
  }
  await fakeLive.push(LIVE.clientId, liveDoc());
  await expect(page.getByRole('heading', { level: 1, name: 'Balta Mock' })).toBeVisible();
});

test('partide.partida.c7 not found: the detail answers PARTIDA:NOT_FOUND → «Partida nu a fost găsită» / «…sau încă nu s-a sincronizat.»', async ({ page }) => {
  await mockCms(page, { mine: [listItem(ENDED)], details: { [ENDED.documentId]: [{ status: 404, bluCode: 'PARTIDA:NOT_FOUND' }] } });
  await open(page, ENDED.documentId);
  await expect(page.getByTestId('partida-member-not-found')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Partida nu a fost găsită' })).toBeVisible();
  await expect(page.getByText('Poate a fost ștearsă sau încă nu s-a sincronizat.')).toBeVisible();
  await expectNoA11yViolations(page);
  for (const width of [375, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.screenshot({ path: `${SHOTS}/not-found-${width}.png`, fullPage: true });
  }
});

test('partide.partida.c8 summary only → the detail skeleton; a failed download → «Nu am putut descărca partida» + «Reîncearcă» reads it again', async ({ page }) => {
  const item = listItem(ENDED);
  await mockCms(page, { mine: [item] });
  let reads = 0;
  let online = false;
  await page.route(/\/api\/cms\/feed\/sessions\/e2e-m-ended$/, async route => {
    reads += 1;
    if (reads === 1) await new Promise(r => setTimeout(r, 1200));
    return online ? json(route, { data: detailOf(item) }) : fail(route, 500);
  });
  await open(page, ENDED.documentId);
  // The list row is known, the detail is not: the skeleton under the real header (the row's venue).
  await expect(page.getByTestId('partida-detail-skeleton')).toBeVisible();
  await expect(page.getByTestId('partida-title')).toHaveText('Lacul Istoric');
  await page.screenshot({ path: `${SHOTS}/skeleton-1280.png`, fullPage: true });
  // The query's own retries (1 / 2 / 4 s) run out.
  await page.clock.runFor(10_000);
  const failed = page.getByTestId('partida-download-failed');
  await expect(failed).toBeVisible();
  await expect(failed.getByText('Nu am putut descărca partida')).toBeVisible();
  await expect(failed.getByText('Ai nevoie de conexiune pentru a descărca această partidă.')).toBeVisible();
  await expectNoA11yViolations(page);
  for (const width of [375, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.screenshot({ path: `${SHOTS}/download-failed-${width}.png`, fullPage: true });
  }
  online = true;
  const before = reads;
  await failed.getByRole('button', { name: 'Reîncearcă' }).click();
  await expect(memberView(page)).toBeVisible();
  expect(reads).toBe(before + 1);
});

test('partide.partida.c9 a live partidă offline shows «Reconectare…» under the header; back online it goes', async ({ page, context, fakeLive }) => {
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc() } });
  await mockCms(page, { active: LIVE });
  await open(page, LIVE.documentId, { width: 375 });
  await expect(memberView(page)).toBeVisible();
  await expect(page.getByTestId('partida-reconnecting')).toHaveCount(0);
  await context.setOffline(true);
  await expect(page.getByTestId('partida-reconnecting')).toHaveText('Reconectare…');
  await page.screenshot({ path: `${SHOTS}/offline-375.png`, fullPage: true });
  await context.setOffline(false);
  await expect(page.getByTestId('partida-reconnecting')).toHaveCount(0);
});

/* ------------------------------------------------------------------------------------------------
 * Share — c3
 * ---------------------------------------------------------------------------------------------- */


test('partide.partida.c3 share: «Distribuie partida» shares fish\'s message with the universal link; a private partidă has no share', async ({ page, fakeLive }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (d: unknown) => {
        (window as unknown as { __shared: unknown }).__shared = d;
      },
    });
  });
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc() } });
  await mockCms(page, { active: LIVE });
  await open(page, LIVE.documentId, { width: 375 });
  await page.getByTestId('partida-share').click();
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __shared?: { text: string } }).__shared?.text))
    .toBe(`Vezi partida mea pe Bluvi 🎣 https://bluvi-app.wearetribus.com/partide/comunitate/${LIVE.documentId}`);
  await fakeLive.push(LIVE.clientId, liveDoc({ visibleOnProfile: false }));
  await expect(page.getByRole('button', { name: /Distribuie/ })).toHaveCount(0);
});

/* ------------------------------------------------------------------------------------------------
 * Access revoked — c20, b.live-subscription
 * ---------------------------------------------------------------------------------------------- */

test('partide.partida.c20 kicked while open: the listener is denied, REST says NOT_MEMBER → «Ai fost eliminat din partidă.», cleared, Partide', async ({ page, fakeLive }) => {
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc() } });
  await mockCms(page, { active: LIVE, details: { [LIVE.documentId]: [{ status: 403, bluCode: 'PARTIDA:NOT_MEMBER' }] } });
  await open(page, LIVE.documentId);
  await expect(memberView(page)).toBeVisible();
  await fakeLive.fail(LIVE.clientId, 'permission-denied');
  await expect(page).toHaveURL(/\/partide$/);
  await expect(toast(page, 'Ai fost eliminat din partidă.')).toBeVisible();
  expect(await pointerStored(page)).toBeNull();
});

test('partide.partida.c20 deleted while open: NOT_FOUND → «Partida a fost ștearsă.»', async ({ page, fakeLive }) => {
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc() } });
  await mockCms(page, { active: LIVE, details: { [LIVE.documentId]: [{ status: 404, bluCode: 'PARTIDA:NOT_FOUND' }] } });
  await open(page, LIVE.documentId);
  await expect(memberView(page)).toBeVisible();
  await fakeLive.fail(LIVE.clientId);
  await expect(page).toHaveURL(/\/partide$/);
  await expect(toast(page, 'Partida a fost ștearsă.')).toBeVisible();
});

test('b.live-subscription a denied listener whose access is still valid re-subscribes (1 s backoff); an unknown answer never clears anything', async ({ page, fakeLive }) => {
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc() } });
  await mockCms(page, { active: LIVE, details: { [LIVE.documentId]: [{ ...detailOf(listItem(LIVE)), status: 'active' }, 503] } });
  await open(page, LIVE.documentId);
  await expect(memberView(page)).toBeVisible();
  await fakeLive.fail(LIVE.clientId);
  await expect.poll(() => fakeLive.subscribed(), { timeout: 5000 }).toEqual([LIVE.clientId, LIVE.clientId]);
  // Unknown (a 503 — not the CMS's own code): the page stays, the pointer stays.
  await fakeLive.fail(LIVE.clientId);
  await page.waitForTimeout(500);
  await expect(memberView(page)).toBeVisible();
  expect(await pointerStored(page)).not.toBeNull();
  await expect(page).toHaveURL(new RegExp(`/partide/${LIVE.documentId}`));
});

test('b.live-subscription sign-out drops the pointer and unsubscribes', async ({ page, fakeLive, context }) => {
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc() } });
  await mockCms(page, { active: LIVE });
  await open(page, LIVE.documentId);
  await expect(memberView(page)).toBeVisible();
  expect(await pointerStored(page)).not.toBeNull();
  await context.clearCookies();
  await page.goto(`/partide/${LIVE.documentId}`);
  await expect(memberView(page)).toHaveCount(0);
  await expect.poll(() => pointerStored(page)).toBeNull();
  expect(await fakeLive.subscribed()).toEqual([]);
});

/* ------------------------------------------------------------------------------------------------
 * Server clock — b.server-clock
 * ---------------------------------------------------------------------------------------------- */

test('b.server-clock durations read the CMS clock (Date header), not the device clock', async ({ page, fakeLive }) => {
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc() } });
  // The server is one hour ahead of this device.
  await mockCms(page, { active: LIVE, activeDate: new Date(NOW.getTime() + 3_600_000).toUTCString() });
  await open(page, LIVE.documentId);
  await expect(page.getByTestId('partida-summary-stats')).toContainText('3h 14m');
});
