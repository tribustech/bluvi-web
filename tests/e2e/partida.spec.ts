import { mkdirSync } from 'node:fs';
import type { Page, Route } from '@playwright/test';
import { expectNoA11yViolations } from './helpers/a11y';
import { expect, test, type FakeLiveDoc } from './helpers/fake-live';
import { CMS, qaJwt, signIn } from './helpers/session';

/*
 * partide.partida — the member view of /partide/[id] (T3 with tabs; fish app/(app)/partide/[id].tsx)
 * + partide.spectator.c1, partide.b.own-vs-spectator, b.live-subscription, b.server-clock.
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
const OPEN_ELSEWHERE = { documentId: 'e2e-m-open', clientId: 'e2e-c-open' };
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
/** Surfaces fade / scale in: let the entrance finish before axe reads colours. */
const settle = (page: Page) => page.waitForTimeout(450);
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
    // The Jurnal (the ended partidă's landing tab) shows the private partidă's catches to its member.
    await expect(page.getByRole('tab', { name: 'Jurnal' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('jurnal-row')).toHaveCount(2);
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
 * The page — c1 c3 c4 c5 at every width
 * ---------------------------------------------------------------------------------------------- */

for (const width of [375, 1280, 1440, 1920] as const) {
  test(`partide.partida.c1 c4 live partidă at ${width}: header, 5 tabs (Lansete first), Jurnal count, summary — axe clean`, async ({ page, fakeLive }) => {
    await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc() }, allTabs: true });
    await mockCms(page, { active: LIVE });
    await open(page, LIVE.documentId, { width });
    await expect(page.getByRole('heading', { level: 1, name: 'Balta Mock' })).toBeVisible();
    await expect(page.getByTestId('partida-subtitle')).toHaveText('Stand 7 · 2 lansete');
    await expect(visibleButton(page, 'Înapoi')).toBeVisible();
    const tabs = page.getByRole('tab');
    await expect(tabs).toHaveText(['Lansete', 'Jurnal4', 'Galerie', 'Statistici', 'Setări']);
    await expect(page.getByRole('tab', { name: 'Lansete' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('partida-tab-count-jurnal')).toHaveText('4');
    await expect(page.getByRole('tabpanel')).toBeVisible();
    // The summary: Durată from the clock, 3 captures, the biggest «8,69 kg» (unit apart).
    const stats = page.getByTestId('partida-summary-stats');
    await expect(stats).toContainText('2h 14m');
    await expect(stats).toContainText('Capturi3');
    await expect(stats).toContainText('8,69kg');
    await expect(page.getByTestId('partida-roster-member')).toHaveCount(2);
    await expect(page.getByTestId('partida-join-code')).toContainText('K7M2QX');
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

test('partide.partida.c1 c4 c5 an ended partidă: «{date} · {duration}», 4 tabs (no Lansete), Jurnal first, Termină gone', async ({ page, fakeLive }) => {
  await fakeLive.seed({ allTabs: true });
  const item = listItem(ENDED);
  await mockCms(page, { mine: [item], details: { [ENDED.documentId]: [detailOf(item)] } });
  await open(page, ENDED.documentId);
  await expect(page.getByTestId('partida-subtitle')).toHaveText(/^\d{1,2} \S+ · 6h$/);
  await expect(page.getByRole('tab')).toHaveText(['Jurnal2', 'Galerie', 'Statistici', 'Setări']);
  await expect(page.getByRole('tab', { name: /Jurnal/ })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('button', { name: /Termină/ })).toHaveCount(0);
  await expect(page.getByText('ÎNCHEIATĂ').filter({ visible: true })).toBeVisible();
  await expectNoA11yViolations(page);
  for (const width of [375, 1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.screenshot({ path: `${SHOTS}/ended-${width}.png`, fullPage: true });
  }
});

test('partide.partida.c5 initial tab: live without a rod → Jurnal; ?tab= opens that tab; a click and ←/→ switch it and keep the URL', async ({ page, fakeLive }) => {
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc({ rods: [] }) }, allTabs: true });
  await mockCms(page, { active: LIVE });
  await open(page, LIVE.documentId);
  await expect(page.getByRole('tab', { name: /Jurnal/ })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('tab', { name: 'Statistici' }).click();
  await expect(page).toHaveURL(/\?tab=statistici$/);
  await expect(page.getByRole('tabpanel')).toHaveAttribute('id', 'partida-panel-stats');
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Setări' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab', { name: 'Setări' })).toBeFocused();
  await expect(page).toHaveURL(/\?tab=setari$/);
  await page.goto(`/partide/${LIVE.documentId}?tab=galerie`);
  await expect(page.getByRole('tab', { name: 'Galerie' })).toHaveAttribute('aria-selected', 'true');
});

test('partide.partida.c5 the partidă ends while open: a kept tab stays, Lansete falls back to Jurnal (a teammate finished)', async ({ page, fakeLive }) => {
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc() }, allTabs: true });
  await mockCms(page, { active: LIVE });
  await open(page, LIVE.documentId);
  await expect(page.getByRole('tab', { name: 'Lansete' })).toHaveAttribute('aria-selected', 'true');
  await fakeLive.push(LIVE.clientId, liveDoc({ endedAt: at(1), status: 'finished' }));
  await expect(page.getByRole('tab')).toHaveCount(4);
  await expect(page.getByRole('tab', { name: /Jurnal/ })).toHaveAttribute('aria-selected', 'true');
  // b.live-subscription: a teammate's finish releases the PERSISTED pointer, the recap stays.
  await expect.poll(() => pointerStored(page)).toBeNull();
  await expect(memberView(page)).toHaveAttribute('data-ended', 'true');
  // And a tab that still exists is kept.
  await page.goto(`/partide/${LIVE.documentId}`);
});

test('partide.partida.c5 ended while on «Statistici»: Statistici stays', async ({ page, fakeLive }) => {
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc() }, allTabs: true });
  await mockCms(page, { active: LIVE });
  await open(page, LIVE.documentId, { tab: 'statistici' });
  await expect(page.getByRole('tab', { name: 'Statistici' })).toHaveAttribute('aria-selected', 'true');
  await fakeLive.push(LIVE.clientId, liveDoc({ endedAt: at(1), status: 'finished' }));
  await expect(page.getByRole('tab')).toHaveCount(4);
  await expect(page.getByRole('tab', { name: 'Statistici' })).toHaveAttribute('aria-selected', 'true');
});

for (const width of [375, 1280, 1440, 1920] as const) {
  test(`partide.partida.c4 rule 4 at ${width}: only the shipped tabs (Lansete, Jurnal, Setări), never a «curând» one; each action once`, async ({ page, fakeLive }) => {
    await fakeLive.seed({
      docs: { [LIVE.clientId]: liveDoc({ catches: [{ ...catchDoc(1, 2.4, 'Crap', 100), photoUrl: 'https://e2e-photos.invalid/a.png' }, catchDoc(2, 8.69, 'Somn', 60), catchDoc(3, null, 'Caras', 40), catchDoc(4, null, null, 20, 'lost')] }) },
    });
    await mockCms(page, { active: LIVE });
    await open(page, LIVE.documentId, { width });
    await expect(memberView(page)).toBeVisible();
    // Galerie / Statistici have not shipped: left out, not shown as «curând» (lib/partide-pages).
    await expect(page.getByRole('tab')).toHaveText(['Lansete', /^Jurnal/, 'Setări']);
    await expect(page.getByText(/curând/)).toHaveCount(0);
    await expect(page.getByTestId('partida-summary-stats')).toBeVisible();
    // Each action once on the screen: «Termină» / «Distribuie» in the header below 1280, in the
    // summary from 1280 — never both.
    await expect(page.getByRole('button', { name: 'Termină partida' }).filter({ visible: true })).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Distribuie partida' }).filter({ visible: true })).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Șterge partida' }).filter({ visible: true })).toHaveCount(1);
    await expectNoA11yViolations(page);
    await page.screenshot({ path: `${SHOTS}/shipped-tabs-owner-${width}.png`, fullPage: true });
  });
}

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
 * Roles — c2 c3 c12
 * ---------------------------------------------------------------------------------------------- */

test('partide.partida.c2 c12 owner vs member vs not synced: «Termină» only for the owner of a live synced partidă; «Părăsește» for a member', async ({ page, fakeLive }) => {
  // Owner.
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc() } });
  await mockCms(page, { active: LIVE });
  await open(page, LIVE.documentId, { width: 375 });
  await expect(page.getByTestId('partida-finish')).toBeVisible();
  // Below 1280 the header's chips only: the summary leaves «Termină» / «Distribuie» out.
  await expect(page.getByRole('button', { name: 'Termină partida' }).filter({ visible: true })).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Distribuie partida' }).filter({ visible: true })).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Părăsește partida' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Șterge partida' })).toBeVisible();
  // Member (someone else hosts).
  await fakeLive.push(LIVE.clientId, liveDoc({ hostUid: 'e2e-angler-2' }));
  await expect(page.getByTestId('partida-finish')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Termină partida' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Părăsește partida' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Șterge partida' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Elimină/ })).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/live-member-375.png`, fullPage: true });
  // Not synced (no host identity yet): no membership action at all.
  await fakeLive.push(LIVE.clientId, liveDoc({ hostUid: null }));
  await expect(page.getByRole('button', { name: /Termină|Părăsește/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Schimbă codul' })).toHaveCount(0);
});

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
 * Finish — c10 c11 c12, b.community-purge-grace
 * ---------------------------------------------------------------------------------------------- */

test('partide.partida.c10 c11 finish the live partidă: the recap, POST finish, the pointer cleared, back to Partide', async ({ page, fakeLive }) => {
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc() } });
  const calls = await mockCms(page, { active: LIVE });
  await open(page, LIVE.documentId, { width: 375 });
  await page.getByTestId('partida-finish').click();
  const dialog = page.getByTestId('finish-dialog');
  await expect(page.getByRole('heading', { name: 'Termină partida?' })).toBeVisible();
  await expect(dialog).toContainText('Balta Mock · 7');
  await expect(dialog).toContainText('2h 14m');
  await expect(dialog).toContainText('Durată');
  await expect(dialog).toContainText('3Capturi');
  await expect(dialog).toContainText('8,69kgCea mai mare');
  await expect(dialog).toContainText('Partida va fi arhivată în partidele tale. Cronometrele active se vor opri.');
  await settle(page);
  await expectNoA11yViolations(page);
  await page.screenshot({ path: `${SHOTS}/finish-dialog-375.png` });
  // «Continuă» closes without finishing.
  await page.getByRole('button', { name: 'Continuă' }).click();
  await expect(page.getByRole('heading', { name: 'Termină partida?' })).toHaveCount(0);
  expect(calls.finish).toEqual([]);
  await page.getByTestId('partida-finish').click();
  await page.getByTestId('finish-dialog-confirm').click();
  await expect(page).toHaveURL(/\/partide$/);
  await expect.poll(() => calls.finish).toEqual([LIVE.documentId]);
  await expect.poll(() => pointerStored(page)).toBeNull();
});

test('partide.partida.c11 a failed live finish says so and keeps the pointer', async ({ page, fakeLive }) => {
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc() } });
  await mockCms(page, { active: LIVE, writes: { finish: 500 } });
  await open(page, LIVE.documentId);
  await visibleButton(page, 'Termină partida').click();
  await page.getByTestId('finish-dialog-confirm').click();
  await expect(toast(page, 'Nu am putut încheia partida. Mai încearcă o dată.')).toBeVisible();
  expect(await pointerStored(page)).not.toBeNull();
});

test('partide.partida.c11 c12 a partidă left open on another device (not followed live here): finish over REST; failure → «Ceva n-a mers. Încearcă din nou.»', async ({ page }) => {
  const item = listItem(OPEN_ELSEWHERE, { endedAt: null, status: 'active' });
  const calls = await mockCms(page, { mine: [item], details: { [OPEN_ELSEWHERE.documentId]: [detailOf(item)] }, writes: { finish: 500 } });
  await open(page, OPEN_ELSEWHERE.documentId);
  await expect(memberView(page)).not.toHaveAttribute('data-live', 'true');
  await visibleButton(page, 'Termină partida').click();
  await page.getByTestId('finish-dialog-confirm').click();
  await expect(toast(page, 'Ceva n-a mers. Încearcă din nou.')).toBeVisible();
  expect(calls.finish).toEqual([OPEN_ELSEWHERE.documentId]);
  await page.unroute(/\/api\/cms\/feed\/sessions\/(e2e-[^/?]+)(\/[^?]*)?(\?.*)?$/);
  let finished = 0;
  await page.route(/\/api\/cms\/feed\/sessions\/e2e-m-open\/finish$/, route => {
    finished += 1;
    return json(route, { data: detailOf(item, { status: 'finished', endedAt: at(0) }) });
  });
  await page.getByTestId('finish-dialog-confirm').click();
  await expect(page).toHaveURL(/\/partide$/);
  expect(finished).toBe(1);
});

/* ------------------------------------------------------------------------------------------------
 * Auto-close — c13
 * ---------------------------------------------------------------------------------------------- */

test('partide.partida.c13 warnedAt on the owner\'s live partidă: «Încă pescuiești?», «Da, continui» extends (failure says so), the snapshot closes it', async ({ page, fakeLive }) => {
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc() } });
  const calls = await mockCms(page, { active: LIVE, writes: { extend: 500 } });
  await open(page, LIVE.documentId, { width: 375 });
  await expect(memberView(page)).toBeVisible();
  await fakeLive.push(LIVE.clientId, liveDoc({ warnedAt: at(5), autoCloseAt: new Date(NOW.getTime() + 42 * 60_000 + 30_000).toISOString() }));
  await expect(page.getByRole('heading', { name: 'Încă pescuiești?' })).toBeVisible();
  await expect(page.getByTestId('autoclose-dialog')).toHaveText(/Se închide automat în 4[12]m/);
  // Not dismissable: Escape keeps it.
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'Încă pescuiești?' })).toBeVisible();
  await settle(page);
  await expectNoA11yViolations(page);
  await page.screenshot({ path: `${SHOTS}/autoclose-375.png` });
  await page.getByRole('button', { name: 'Da, continui' }).click();
  await expect(toast(page, 'Nu am putut prelungi partida. Încearcă din nou.')).toBeVisible();
  expect(calls.extend).toEqual([LIVE.documentId]);
  // The CMS clears warnedAt; the snapshot closes the dialog.
  await fakeLive.push(LIVE.clientId, liveDoc());
  await expect(page.getByRole('heading', { name: 'Încă pescuiești?' })).toHaveCount(0);
});

test('partide.partida.c13 «Nu, închid partida» runs the very same finish', async ({ page, fakeLive }) => {
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc({ warnedAt: at(5), autoCloseAt: new Date(NOW.getTime() + 3 * 3_600_000).toISOString() }) } });
  const calls = await mockCms(page, { active: LIVE });
  await open(page, LIVE.documentId);
  await expect(page.getByTestId('autoclose-dialog')).toHaveText(/^Se închide automat în (3h 00m|2h 59m)$/);
  await page.getByRole('button', { name: 'Nu, închid partida' }).click();
  await expect(page).toHaveURL(/\/partide$/);
  await expect.poll(() => calls.finish).toEqual([LIVE.documentId]);
});

test('partide.partida.c13 a guest (not the owner) never sees the auto-close dialog', async ({ page, fakeLive }) => {
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc({ hostUid: 'e2e-angler-2', warnedAt: at(5), autoCloseAt: at(-30) }) } });
  await mockCms(page, { active: LIVE });
  await open(page, LIVE.documentId);
  await expect(memberView(page)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Încă pescuiești?' })).toHaveCount(0);
});

/* ------------------------------------------------------------------------------------------------
 * Delete, leave, kick, rotate — c14 c15 c16 c17 c18
 * ---------------------------------------------------------------------------------------------- */

test('partide.partida.c14 delete: what is lost, a click does nothing, a hold deletes; failure inline, success toast + Partide', async ({ page, fakeLive }) => {
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc() } });
  const calls = await mockCms(page, { active: LIVE, writes: { remove: 500 } });
  await open(page, LIVE.documentId);
  await page.getByRole('button', { name: 'Șterge partida' }).click();
  await expect(page.getByRole('heading', { name: 'Ștergi această partidă?' })).toBeVisible();
  const dialog = page.getByTestId('delete-dialog');
  await expect(dialog).toContainText('Balta Mock');
  await expect(dialog).toContainText(
    'Se șterg definitiv 3 capturi, împreună cu tot jurnalul partidei. Coechipierul tău pierde și el accesul și capturile lui. Acțiunea nu poate fi anulată.',
  );
  await settle(page);
  await expectNoA11yViolations(page);
  await page.screenshot({ path: `${SHOTS}/delete-dialog-1280.png` });
  const hold = page.getByTestId('delete-dialog-hold');
  await expect(hold).toHaveText('Ține apăsat pentru a șterge');
  await hold.click();
  await page.waitForTimeout(300);
  expect(calls.remove).toEqual([]);
  const box = (await hold.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(1500);
  await page.mouse.up();
  await expect(dialog.getByText('Nu am putut șterge partida. Încearcă din nou.')).toBeVisible();
  expect(calls.remove).toEqual([LIVE.documentId]);
  // Keyboard: hold Space.
  await page.unroute(/\/api\/cms\/feed\/sessions\/(e2e-[^/?]+)(\/[^?]*)?(\?.*)?$/);
  await page.route(/\/api\/cms\/feed\/sessions\/e2e-m-live$/, route => {
    if (route.request().method() === 'DELETE') calls.remove.push(LIVE.documentId);
    return json(route, { data: { ok: true } });
  });
  await hold.focus();
  await page.keyboard.down(' ');
  await page.waitForTimeout(1500);
  await page.keyboard.up(' ');
  await expect(page).toHaveURL(/\/partide$/);
  await expect(toast(page, 'Partida a fost ștearsă.')).toBeVisible();
  expect(calls.remove).toEqual([LIVE.documentId, LIVE.documentId]);
  expect(await pointerStored(page)).toBeNull();
});

test('partide.partida.c14 delete an ENDED partidă: the page stays on the member view until it has gone to Partide — never the spectator page nor «not found»', async ({ page }) => {
  const item = listItem(ENDED);
  // The public read answers (a public partidă): a fallback to the spectator view would show it.
  const calls = await mockCms(page, {
    mine: [item],
    details: { [ENDED.documentId]: [detailOf(item)] },
    community: { [ENDED.documentId]: { documentId: ENDED.documentId } },
  });
  let deleted = false;
  await page.route(/\/api\/cms\/feed\/sessions\/mine(\?.*)?$/, route => json(route, { data: deleted ? [] : [item], meta: { page: 1, pageSize: 100, total: deleted ? 0 : 1 } }));
  await page.route(/\/api\/cms\/feed\/sessions\/e2e-m-ended$/, async route => {
    if (route.request().method() === 'DELETE') {
      calls.remove.push(ENDED.documentId);
      deleted = true;
      return json(route, { data: { ok: true } });
    }
    return deleted ? fail(route, 404, 'PARTIDA:NOT_FOUND') : json(route, { data: detailOf(item) });
  });
  await open(page, ENDED.documentId);
  await expect(memberView(page)).toBeVisible();
  // From here on (the page is the member view): record whether the spectator / not-found views
  // ever attach while the delete runs.
  await page.evaluate(() => {
    const seen = new Set<string>();
    (window as unknown as { __seenTestIds: Set<string> }).__seenTestIds = seen;
    new MutationObserver(() => {
      for (const id of ['partida-spectator', 'partida-not-found', 'partida-member-not-found']) if (document.querySelector(`[data-testid="${id}"]`)) seen.add(id);
    }).observe(document.body, { childList: true, subtree: true });
  });
  await page.getByRole('button', { name: 'Șterge partida' }).click();
  const hold = page.getByTestId('delete-dialog-hold');
  await hold.focus();
  await page.keyboard.down(' ');
  await page.waitForTimeout(1500);
  await page.keyboard.up(' ');
  await expect(page).toHaveURL(/\/partide$/);
  await expect(toast(page, 'Partida a fost ștearsă.')).toBeVisible();
  expect(calls.remove).toEqual([ENDED.documentId]);
  expect(await seenTestIds(page)).toEqual([]);
});

test('partide.partida.c11 c18 the live finish is single-flight: two activations of «Termină» → one POST /finish, one step back', async ({ page, fakeLive }) => {
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc() } });
  const calls = await mockCms(page, { active: LIVE, writes: { finish: { status: 200, delayMs: 600 } } });
  await page.setViewportSize({ width: 375, height: 900 });
  await page.clock.install({ time: NOW });
  // History: Partide → the partidă. Two «back» would leave Partide too.
  await page.goto('/partide');
  await page.goto(`/partide/${LIVE.documentId}`);
  await expect(memberView(page)).toBeVisible();
  await page.getByTestId('partida-finish').click();
  const confirm = page.getByTestId('finish-dialog-confirm');
  await expect(confirm).toBeVisible();
  // Two activations: a second click while the sheet animates out (the button is still attached).
  await confirm.evaluate((el: HTMLElement) => {
    el.click();
    setTimeout(() => {
      sessionStorage.setItem('e2e-second-attached', String(el.isConnected));
      el.click();
    }, 40);
  });
  await page.waitForTimeout(300);
  // One step back: still on Partide (two would have left it).
  await expect(page).toHaveURL(/\/partide$/);
  expect(await page.evaluate(() => sessionStorage.getItem('e2e-second-attached')), 'the second activation reached the confirm').toBe('true');
  await expect(page).toHaveURL(/\/partide$/);
  await expect.poll(() => calls.finish).toEqual([LIVE.documentId]);
  await page.waitForTimeout(800);
  expect(calls.finish).toEqual([LIVE.documentId]);
  await expect(page).toHaveURL(/\/partide$/);
});

test('partide.partida.c15 c18 leave: the explanation, single-flight while pending, failure inline, then success → toast + Partide', async ({ page, fakeLive }) => {
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc({ hostUid: 'e2e-angler-2' }) } });
  const calls = await mockCms(page, { active: LIVE, writes: { leave: { status: 403, bluCode: 'PARTIDA:FORBIDDEN', delayMs: 800 } }, details: { [LIVE.documentId]: [200] } });
  await open(page, LIVE.documentId);
  await page.getByRole('button', { name: 'Părăsește partida' }).click();
  await expect(page.getByRole('heading', { name: 'Părăsești partida?' })).toBeVisible();
  await expect(page.getByTestId('leave-dialog')).toContainText('Vei pierde accesul la partidă.');
  const confirm = page.getByTestId('leave-dialog-confirm');
  await confirm.click();
  await expect(confirm).toHaveAttribute('aria-busy', 'true');
  await confirm.click({ force: true });
  await confirm.click({ force: true });
  await expect(page.getByTestId('leave-dialog').getByText('Nu am putut părăsi partida. Încearcă din nou.')).toBeVisible();
  expect(calls.leave).toEqual([LIVE.documentId]);
  await page.unroute(/\/api\/cms\/feed\/sessions\/(e2e-[^/?]+)(\/[^?]*)?(\?.*)?$/);
  await page.route(/\/api\/cms\/feed\/sessions\/e2e-m-live\/leave$/, route => {
    calls.leave.push(LIVE.documentId);
    return json(route, { data: { removed: true } });
  });
  await confirm.click();
  await expect(page).toHaveURL(/\/partide$/);
  await expect(toast(page, 'Ai părăsit partida.')).toBeVisible();
  expect(calls.leave).toHaveLength(2);
  expect(await pointerStored(page)).toBeNull();
});

test('partide.partida.c16 c18 kick: the owner removes a member (never the host); the code rotates; failure inline', async ({ page, fakeLive }) => {
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc() } });
  const calls = await mockCms(page, { active: LIVE, writes: { kick: { status: 500, delayMs: 600 } } });
  await open(page, LIVE.documentId);
  const roster = page.getByTestId('partida-roster-member');
  await expect(roster.nth(0).getByRole('button')).toHaveCount(0); // the host (the viewer)
  await roster.nth(1).getByRole('button', { name: 'Elimină pe Ana Crap' }).click();
  await expect(page.getByRole('heading', { name: 'Elimini participantul?' })).toBeVisible();
  const dialog = page.getByTestId('kick-dialog');
  await expect(dialog).toContainText('Ana Crap va pierde accesul la partidă.');
  await expect(dialog).toContainText('Codul de acces va fi schimbat automat.');
  const confirm = page.getByTestId('kick-dialog-confirm');
  await confirm.dblclick();
  await expect(dialog.getByText('Nu am putut elimina participantul. Încearcă din nou.')).toBeVisible();
  expect(calls.kick).toEqual(['e2e-angler-2']);
  await page.unroute(/\/api\/cms\/feed\/sessions\/(e2e-[^/?]+)(\/[^?]*)?(\?.*)?$/);
  await page.route(/\/api\/cms\/feed\/sessions\/e2e-m-live\/members\/[^/]+$/, route => {
    calls.kick.push('again');
    return json(route, { data: { removed: true, joinCode: 'NEW123', members: [member(selfId, 'Eu Pescar')], hostUid: selfId, projectionRev: 4 } });
  });
  await confirm.click();
  await expect(toast(page, 'Participant eliminat. Codul a fost schimbat.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Elimini participantul?' })).toHaveCount(0);
});

test('partide.partida.c17 c18 rotate the join code: copy, single-flight, failure inline, success toast', async ({ page, fakeLive }) => {
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc() } });
  const calls = await mockCms(page, { active: LIVE, writes: { rotate: { status: 500, delayMs: 600 } } });
  await open(page, LIVE.documentId, { width: 375 });
  await page.getByRole('button', { name: 'Schimbă codul' }).click();
  await expect(page.getByRole('heading', { name: 'Schimbi codul de acces?' })).toBeVisible();
  await expect(page.getByTestId('rotate-dialog')).toContainText('Codul și linkurile trimise anterior nu vor mai funcționa.');
  await page.screenshot({ path: `${SHOTS}/rotate-sheet-375.png` });
  const confirm = page.getByTestId('rotate-dialog-confirm');
  await confirm.click();
  await confirm.click({ force: true });
  await expect(page.getByTestId('rotate-dialog').getByText('Codul nu a putut fi schimbat. Încearcă din nou.')).toBeVisible();
  expect(calls.rotate).toEqual([LIVE.documentId]);
  await page.unroute(/\/api\/cms\/feed\/sessions\/(e2e-[^/?]+)(\/[^?]*)?(\?.*)?$/);
  await page.route(/\/api\/cms\/feed\/sessions\/e2e-m-live\/join-code\/rotate$/, route => json(route, { data: { joinCode: 'NEW123', projectionRev: 4 } }));
  await confirm.click();
  await expect(toast(page, 'Codul de acces a fost schimbat.')).toBeVisible();
});

/* ------------------------------------------------------------------------------------------------
 * Anchor — c19
 * ---------------------------------------------------------------------------------------------- */

test('partide.partida.c19 «Ajustează poziția»: the picker on the anchor (satellite, close), the map moved, «Confirmă locul» patches anchorLat / anchorLong', async ({ page, fakeLive }) => {
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc() } });
  const calls = await mockCms(page, { active: LIVE });
  await open(page, LIVE.documentId);
  await page.getByRole('button', { name: /Ajustează poziția/ }).click();
  const picker = page.getByTestId('map-point-picker-body');
  await expect(page.getByRole('heading', { name: 'Ajustează poziția' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Satelit' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Trage harta ca să muți pinul')).toBeVisible();
  await expect(picker).toHaveAttribute('data-lat', '44.432100');
  await expect(picker).toHaveAttribute('data-state', 'ready', { timeout: 20_000 });
  await page.screenshot({ path: `${SHOTS}/picker-1280.png` });
  // Keyboard: the canvas pans with the arrows.
  await page.locator('.maplibregl-canvas').focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => Number(await picker.getAttribute('data-lng'))).toBeGreaterThan(26.1234);
  await page.getByTestId('map-point-picker-confirm').click();
  await expect(page.getByRole('heading', { name: 'Ajustează poziția' })).toHaveCount(0);
  await expect.poll(() => calls.patch.length).toBe(1);
  const body = calls.patch[0] as { data: { anchorLat: number; anchorLong: number } };
  expect(body.data.anchorLat).toBeCloseTo(44.4321, 3);
  expect(body.data.anchorLong).toBeGreaterThan(26.1234);
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

/* ------------------------------------------------------------------------------------------------
 * Feedback — c21 c22
 * ---------------------------------------------------------------------------------------------- */

test('partide.partida.c21 the nudge: ≥3 captures on a live partidă; X records it, the hint shows 3.5 s, a reload does not ask again', async ({ page, fakeLive }) => {
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc() } });
  await mockCms(page, { active: LIVE });
  await open(page, LIVE.documentId, { width: 375 });
  const nudge = page.getByTestId('partida-feedback-nudge');
  await expect(nudge).toBeVisible();
  await expect(nudge).toContainText('Ceva de îmbunătățit?');
  await expect(nudge).toContainText('Spune-ne ce nu merge sau ce ți-ar plăcea să existe.');
  await expectNoA11yViolations(page);
  await page.screenshot({ path: `${SHOTS}/nudge-375.png` });
  await nudge.getByRole('button', { name: 'Ascunde' }).click();
  const hint = page.getByTestId('partida-feedback-hint');
  await expect(hint).toBeVisible();
  await expect(hint).toHaveText('Bine. O găsești oricând în Info › Raportează o problemă.');
  await expect(nudge).toBeHidden();
  await page.clock.runFor(3_600);
  await expect(hint).toBeHidden();
  expect(await page.evaluate(() => localStorage.getItem('bluvi.partide.feedbackNudgeSessions.v1'))).toBe(JSON.stringify([LIVE.clientId]));
  await page.reload();
  await expect(memberView(page)).toBeVisible();
  await page.waitForTimeout(500);
  await expect(nudge).toBeHidden();
});

test('partide.partida.c21 under the threshold (2 captures, 2 h) or ended: no nudge', async ({ page, fakeLive }) => {
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc({ catches: [catchDoc(1, 2, 'Crap', 30), catchDoc(2, 3, 'Crap', 20)] }) } });
  await mockCms(page, { active: LIVE });
  await open(page, LIVE.documentId);
  await expect(memberView(page)).toBeVisible();
  await page.waitForTimeout(400);
  await expect(page.getByTestId('partida-feedback-nudge')).toBeHidden();
  // ≥ 4 h elapsed is enough on its own.
  await fakeLive.push(LIVE.clientId, liveDoc({ startedAt: at(4 * 60 + 1), catches: [] }));
  await expect(page.getByTestId('partida-feedback-nudge')).toBeVisible();
});

test('partide.partida.c22 the feedback dialog: empty → the prompt; «Idee nouă» + text → POST /feedbacks with the partidă; the nudge is answered', async ({ page, fakeLive }) => {
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc() } });
  const calls = await mockCms(page, { active: LIVE, writes: { feedback: 500 } });
  await open(page, LIVE.documentId, { width: 375 });
  await page.getByTestId('partida-feedback-nudge').getByRole('button', { name: 'Trimite feedback despre partidă' }).click();
  await expect(page.getByRole('heading', { name: 'Spune-ne ce nu merge' })).toBeVisible();
  const form = page.getByTestId('feedback-dialog');
  await expect(form.getByText('Problemă tehnică')).toBeVisible();
  await expect(form.getByText('Altceva')).toBeVisible();
  await page.getByRole('button', { name: 'Trimite', exact: true }).click();
  await expect(form.getByText('Scrie câteva cuvinte despre ce s-a întâmplat.')).toBeVisible();
  expect(calls.feedback).toEqual([]);
  await settle(page);
  await expectNoA11yViolations(page);
  await page.screenshot({ path: `${SHOTS}/feedback-375.png` });
  await form.getByText('Idee nouă').click();
  await form.getByLabel('Detalii').fill('Aș vrea o hartă a lansetelor.');
  await expect(form.getByLabel('Detalii')).toHaveAttribute('maxlength', '1000');
  await page.getByRole('button', { name: 'Trimite', exact: true }).click();
  await expect(toast(page, 'N-am putut trimite mesajul. Mai încearcă o dată.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Spune-ne ce nu merge' })).toBeVisible();
  await page.unroute('**/api/cms/feedbacks');
  await page.route('**/api/cms/feedbacks', route => {
    calls.feedback.push(route.request().postDataJSON());
    return json(route, { data: { documentId: 'fb-1' } });
  });
  await page.getByRole('button', { name: 'Trimite', exact: true }).click();
  await expect(toast(page, 'Mulțumim! Mesajul a ajuns la echipă.')).toBeVisible();
  const sent = calls.feedback.at(-1) as { data: { rating: number; category: string; feedback: string; metadata: Record<string, unknown> } };
  expect(sent.data).toMatchObject({ rating: 5, category: 'feature', feedback: 'Aș vrea o hartă a lansetelor.' });
  expect(sent.data.metadata).toMatchObject({
    source: 'partida',
    ratingAsked: false,
    entryPoint: 'nudge',
    sessionClientId: LIVE.clientId,
    sessionDocumentId: LIVE.documentId,
    captures: 3,
  });
  expect(sent.data.metadata.elapsedMs).toBeGreaterThan(2 * 3_600_000);
  await expect(page.getByTestId('partida-feedback-nudge')).toBeHidden();
});

test('partide.partida.c22 «Raportează o problemă» opens the same dialog from the summary (entry point «info»)', async ({ page, fakeLive }) => {
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc() } });
  const calls = await mockCms(page, { active: LIVE });
  await open(page, LIVE.documentId);
  await page.getByRole('button', { name: /Raportează o problemă/ }).click();
  await page.getByTestId('feedback-dialog').getByLabel('Detalii').fill('Cronometrul sare.');
  await page.getByRole('button', { name: 'Trimite', exact: true }).click();
  await expect(toast(page, 'Mulțumim! Mesajul a ajuns la echipă.')).toBeVisible();
  expect((calls.feedback[0] as { data: { category: string; metadata: { entryPoint: string } } }).data).toMatchObject({ category: 'technical', metadata: { entryPoint: 'info' } });
});
