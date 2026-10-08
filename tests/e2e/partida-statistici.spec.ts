import { mkdirSync } from 'node:fs';
import type { Page, Route } from '@playwright/test';
import { expectNoA11yViolations } from './helpers/a11y';
import { collectConsoleErrors } from './helpers/console';
import { expect, test, type FakeCatchDoc, type FakeLiveDoc } from './helpers/fake-live';
import { CMS, qaJwt, signIn } from './helpers/session';

/*
 * partide.partida-statistici — the member view's «Statistici» tab (/partide/[id]?tab=statistici;
 * fish features/partide/scenes/StatisticiScene.tsx, components/Leaderboard + HourHeatmap,
 * helpers/patterns.ts, domain/hooks.ts usePatterns).
 *
 * NOTHING reaches Firestore or writes to a CMS: the live partidă is the shared Firestore fake
 * (helpers/fake-live.ts — the fixture fails on any request to a Firebase host), and the CMS reads
 * the tab makes (the own list /feed/sessions/mine and each sibling's /feed/sessions/:id) are
 * route-mocked. The tab only reads. A fixed clock and the Bucharest time zone keep the hours exact
 * (October = UTC+3).
 */

test.use({ timezoneId: 'Europe/Bucharest', locale: 'ro-RO' });

const NOW = new Date('2026-10-07T12:00:00.000Z'); // 15:00 in Bucharest
const at = (minutesAgo: number) => new Date(NOW.getTime() - minutesAgo * 60_000).toISOString();
const SHOTS = '.shots/partida-statistici';
mkdirSync(SHOTS, { recursive: true });

const LIVE = { documentId: 'e2e-s-live', clientId: 'e2e-sc-live' };
const LAKE = 'e2e-lake-s';
const ANCHOR = { lat: 44.4321, lng: 26.1234 };

let selfId = '';
let jwt = '';

test.beforeAll(async ({ request }) => {
  jwt = await qaJwt(request);
  const me = await request.get(`${CMS}/user/profile`, { headers: { authorization: `Bearer ${jwt}` } });
  expect(me.ok(), 'QA profile read').toBe(true);
  selfId = (await me.json()).documentId as string;
});

test.beforeEach(async ({ context }) => {
  await signIn(context, jwt);
});

/* ------------------------------------------------------------------------------------------------
 * Fixtures
 * ---------------------------------------------------------------------------------------------- */

const ROD_COLOR = { 1: '#6366F1', 2: '#F97316', 3: '#10B981' } as const;
const rod = (index: 1 | 2 | 3) => ({ clientId: `rod-${index}`, index, label: `L${index}`, color: ROD_COLOR[index], bait: 'Boilies', lane: 'center' as const, distance: 60, runtimePhase: 'idle' as const });

/*
 * This partidă (Bucharest hours): 12:20 and 12:50 captures, 13:20 lost, 13:50 blank, 14:20 a
 * rod-less unweighed capture, 14:40 a capture.
 *  - Capturi 4 · Cea mai mare 8,69 kg · Greutate totală 12,34 kg;
 *  - per rod: L1 2, L2 1, L3 0;
 *  - baits: Boilies 2 (avg 1,825, max 2,4) · Porumb 1 (8,69) · Necunoscută 1 (— —);
 *  - hours: 12 → 2, 13 → 1 (the blank is not counted), 14 → 2.
 */
const CATCHES: FakeCatchDoc[] = [
  { clientId: 'ev-1', outcome: 'capture', occurredAt: at(160), rodIndex: 1, rodColor: ROD_COLOR[1], weightKg: 2.4, species: 'Crap', bait: 'Boilies' },
  { clientId: 'ev-2', outcome: 'capture', occurredAt: at(130), rodIndex: 2, rodColor: ROD_COLOR[2], weightKg: 8.69, species: 'Somn', bait: 'Porumb' },
  { clientId: 'ev-3', outcome: 'lost', occurredAt: at(100), rodIndex: 1, rodColor: ROD_COLOR[1], bait: 'Porumb' },
  { clientId: 'ev-4', outcome: 'blank', occurredAt: at(70), rodIndex: 2, rodColor: ROD_COLOR[2], bait: 'Porumb' },
  { clientId: 'ev-5', outcome: 'capture', occurredAt: at(40), rodIndex: null, weightKg: null, species: 'Caras' },
  { clientId: 'ev-6', outcome: 'capture', occurredAt: at(20), rodIndex: 1, rodColor: ROD_COLOR[1], weightKg: 1.25, species: 'Crap', bait: 'boilies' },
];

const member = (uid: string, name: string) => ({ uid, name, avatar: null, joinedAt: at(170) });

function liveDoc(patch: Partial<FakeLiveDoc> = {}): FakeLiveDoc {
  return {
    startedAt: at(180),
    endedAt: null,
    status: 'active',
    venueType: 'lake',
    lakeId: LAKE,
    lakeName: 'Balta Mock',
    standName: '7',
    locality: 'Giurgiu',
    anchorLat: ANCHOR.lat,
    anchorLong: ANCHOR.lng,
    hostUid: selfId,
    joinCode: null,
    visibleOnProfile: true,
    members: [member(selfId, 'Eu Pescar')],
    rods: [rod(1), rod(2), rod(3)],
    catches: CATCHES,
    markers: [],
    rev: 3,
    ...patch,
  };
}

/** A lean list row of /feed/sessions/mine. */
const listItem = (documentId: string, clientId: string, lakeId: string, startedAt: string, endedAt: string | null) => ({
  documentId,
  clientId,
  clientUpdatedAt: null,
  venueType: 'lake',
  lakeId,
  lakeName: lakeId === LAKE ? 'Balta Mock' : 'Alt Lac',
  lakeImageUrl: null,
  publicWaterCode: null,
  publicWaterName: null,
  manualVenueName: null,
  standId: null,
  standName: null,
  locality: 'Giurgiu',
  anchorLat: ANCHOR.lat,
  anchorLong: ANCHOR.lng,
  anchorName: null,
  startedAt,
  endedAt,
  plannedDurationMs: null,
  notes: null,
  visibleOnProfile: true,
  status: endedAt ? 'finished' : 'active',
  targetSpecies: [],
  hostUid: 'someone',
  captures: 0,
  recordKg: null,
  totalKg: null,
});

let evId = 100;
const dtoEvent = (outcome: 'capture' | 'lost' | 'blank', occurredAt: string, patch: Record<string, unknown> = {}) => ({
  id: evId++,
  documentId: `evd-${evId}`,
  clientId: `h-${evId}`,
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
  weightKg: null,
  weightEstimated: false,
  species: null,
  speciesId: null,
  photoUrl: null,
  photoThumbUrl: null,
  notes: null,
  occurredAt,
  photoTagUids: [],
  ...patch,
});

/*
 * The viewer's other partide (06:10, 06:40, 06:50 and 06:30, 07:10 in Bucharest):
 *  - A (same lake, yesterday): three Pop-up captures at 72 m, 5 / 6 / 7 kg;
 *  - B (same lake, 3 days ago): a Porumb capture at 40 m (3 kg) and a lost fish;
 *  - X (another lake): never read.
 * Venue scope: Partide 3 · Top momeală Pop-up · Distanță ideală 70–75 m (the only bait × band
 * with 3 events) · Ore de vârf 05:00–08:00 (the densest 3 hours of bites: 5) · baits Pop-up 3,
 * Porumb 2 (max 8,69), Boilies 2 (max 2,4), Necunoscută 1 · 10 bites on the heatmap.
 */
const A = listItem('e2e-s-a', 'e2e-sc-a', LAKE, '2026-10-06T02:00:00.000Z', '2026-10-06T08:00:00.000Z');
const B = listItem('e2e-s-b', 'e2e-sc-b', LAKE, '2026-10-04T02:00:00.000Z', '2026-10-04T08:00:00.000Z');
const X = listItem('e2e-s-x', 'e2e-sc-x', 'e2e-lake-other', '2026-10-05T02:00:00.000Z', '2026-10-05T08:00:00.000Z');
const LIVE_ROW = listItem(LIVE.documentId, LIVE.clientId, LAKE, at(180), null);

const DETAIL_EVENTS: Record<string, ReturnType<typeof dtoEvent>[]> = {
  [A.documentId]: [
    dtoEvent('capture', '2026-10-06T03:10:00.000Z', { bait: 'Pop-up', distance: 72, weightKg: 5, species: 'Crap' }),
    dtoEvent('capture', '2026-10-06T03:40:00.000Z', { bait: 'Pop-up', distance: 72, weightKg: 6, species: 'Crap' }),
    dtoEvent('capture', '2026-10-06T03:50:00.000Z', { bait: 'Pop-up', distance: 72, weightKg: 7, species: 'Crap' }),
  ],
  [B.documentId]: [
    dtoEvent('capture', '2026-10-04T03:30:00.000Z', { bait: 'Porumb', distance: 40, weightKg: 3, species: 'Caras' }),
    dtoEvent('lost', '2026-10-04T04:10:00.000Z', { bait: 'Porumb', distance: 40 }),
  ],
  [X.documentId]: [dtoEvent('capture', '2026-10-05T03:00:00.000Z', { bait: 'Viermi', weightKg: 1 })],
};

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

type Calls = { mine: number; details: string[]; other: string[] };

/**
 * The CMS as the tab sees it: the pointer (this partidă is live), the own list, and each detail —
 * `detailAnswers` queues status codes per id (the last one repeats; default 200), `delayMs` holds
 * every detail. Any other `/feed/*` read of a statistic is recorded in `other` (c7: none).
 */
async function mockCms(
  page: Page,
  { mine = [LIVE_ROW, A, B, X], detailAnswers = {}, delayMs = 0 }: { mine?: unknown[]; detailAnswers?: Record<string, number[]>; delayMs?: number } = {},
): Promise<Calls> {
  const calls: Calls = { mine: 0, details: [], other: [] };
  await page.route(/tiles\.openfreemap\.org|arcgisonline\.com/, r => r.abort());
  await page.route(/\/feed\/community\//, route => {
    // The frame's spectator probe of this partidă is not a statistic; anything else would be.
    const path = new URL(route.request().url()).pathname;
    if (!path.endsWith(`/community/sessions/${LIVE.documentId}`)) calls.other.push(path);
    return json(route, { error: { status: 404 } }, 404);
  });
  await page.route('**/api/cms/feed/session-follows/mine', r => json(r, { data: { sessionDocumentIds: [] } }));
  await page.route('**/api/cms/feed/sessions/active', r => json(r, { data: { ...LIVE, firestoreId: LIVE.clientId } }));
  await page.route(/\/api\/cms\/feed\/sessions\/mine(\?.*)?$/, r => {
    calls.mine += 1;
    return json(r, { data: mine, meta: { page: 1, pageSize: 100, total: mine.length } });
  });
  await page.route(/\/api\/cms\/feed\/sessions\/(e2e-s-[a-z]+)$/, async route => {
    if (route.request().method() !== 'GET') return route.fallback();
    const id = /sessions\/(e2e-s-[a-z]+)$/.exec(route.request().url())![1];
    // The frame's own read of this partidă is not the tab's (and has nothing to add: it is live).
    if (id === LIVE.documentId) return json(route, { error: { status: 404 } }, 404);
    calls.details.push(id);
    if (delayMs) await new Promise(r => setTimeout(r, delayMs));
    const queue = detailAnswers[id] ?? [200];
    const status = queue.length > 1 ? queue.shift()! : queue[0];
    if (status !== 200) return json(route, { error: { status, name: 'Error', message: 'mock' } }, status);
    const row = [A, B, X].find(s => s.documentId === id)!;
    return json(route, { data: { ...row, joinCode: null, rods: [], members: [member('someone', 'Alt Pescar')], events: DETAIL_EVENTS[id] } });
  });
  return calls;
}

async function open(page: Page, { width = 375 }: { width?: number } = {}) {
  await page.setViewportSize({ width, height: 900 });
  await page.clock.install({ time: NOW });
  await page.goto(`/partide/${LIVE.documentId}?tab=statistici`);
  await expect(page.getByTestId('partida-stats')).toBeVisible();
}

const CONSOLE_NOISE = [/Failed to load resource/, /net::ERR_/, /AJAXError|Failed to fetch/];

const radio = (page: Page, name: string) => page.getByRole('radio', { name, exact: true });
const tile = (page: Page, id: string) => page.getByTestId(`stat-${id}`);
const tileValue = (page: Page, id: string) => tile(page, id).getByTestId('stat-value');
const baitLabels = (page: Page) => page.getByTestId('stats-bait-label').allTextContents();
const hourCounts = (page: Page) => page.getByTestId('stats-hour').evaluateAll(els => els.map(e => Number(e.getAttribute('data-count'))));
const settle = (page: Page) => page.waitForTimeout(400);

/** A click on the segment (the radio itself is visually hidden under its label). */
const pick = (page: Page, name: string) => page.getByTestId('stats-scope').locator('label', { hasText: name }).click();

async function toVenue(page: Page) {
  await pick(page, 'Toate partidele');
  await expect(page.getByTestId('partida-stats')).toHaveAttribute('data-scope', 'balta');
}

/* ------------------------------------------------------------------------------------------------
 * c1 c2 c4 c5 — «Această partidă»
 * ---------------------------------------------------------------------------------------------- */

for (const width of [375, 1280, 1440, 1920] as const) {
  test(`partide.partida-statistici.c1 c2 c4 c5 at ${width}: «Această partidă» by default — tiles, per-rod bars, bait ranking, 24 h heatmap; axe clean`, async ({ page, fakeLive }) => {
    await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc() } });
    const calls = await mockCms(page);
    const errors = collectConsoleErrors(page, { ignore: CONSOLE_NOISE });
    await open(page, { width });
    await expect(page.getByRole('tab', { name: 'Statistici' })).toHaveAttribute('aria-selected', 'true');
    // c1: the two segments, «Această partidă» chosen.
    await expect(page.getByRole('group', { name: 'Statistici pentru' }).getByRole('radio')).toHaveCount(2);
    await expect(radio(page, 'Această partidă')).toBeChecked();
    await expect(radio(page, 'Toate partidele')).not.toBeChecked();
    // c2: the three tiles, kg spaced apart from the number (rule 10).
    await expect(tileValue(page, 'capturi')).toHaveText('4');
    await expect(tileValue(page, 'record')).toHaveText('8,69');
    await expect(tileValue(page, 'total')).toHaveText('12,34');
    for (const id of ['record', 'total']) {
      await expect(tile(page, id).locator('[data-unit]')).toHaveText(' kg');
    }
    // The signature tile is the navy one (rule 19), wider than each weight tile.
    const cap = (await tile(page, 'capturi').boundingBox())!;
    const rec = (await tile(page, 'record').boundingBox())!;
    expect(cap.width).toBeGreaterThan(rec.width * 1.5);
    // c4: one bar per rod, relative to the busiest rod.
    const bars = page.getByTestId('stats-rod-bar');
    await expect(bars).toHaveCount(3);
    await expect(bars.nth(0)).toHaveAccessibleName('L1: 2 capturi');
    await expect(bars.nth(1)).toHaveAccessibleName('L2: 1 captură');
    await expect(bars.nth(2)).toHaveAccessibleName('L3: 0 capturi');
    const fills = await page.getByTestId('stats-rod-fill').evaluateAll(els => els.map(e => (e as HTMLElement).style.width));
    expect(fills).toEqual(['100%', '50%', '0%']);
    await expect(page.getByTestId('stats-rod-fill').first()).toHaveCSS('background-color', 'rgb(99, 102, 241)');
    // c5: the bait leaderboard (case folded, first spelling kept; no-name bait → Necunoscută) …
    expect(await baitLabels(page)).toEqual(['Boilies', 'Porumb', 'Necunoscută']);
    const first = page.getByTestId('stats-bait-row').first();
    await expect(first).toHaveAttribute('data-top', 'true');
    await expect(first.getByRole('cell')).toHaveText(['1', 'Boilies', '2', '1,825', '2,4']);
    await expect(page.getByTestId('stats-bait-row').nth(2).getByRole('cell')).toHaveText(['3', 'Necunoscută', '1', '—', '—']);
    // … and the 24 h heatmap of non-blank events (the 13:50 blank is not counted).
    const hours = await hourCounts(page);
    expect(hours).toHaveLength(24);
    expect(hours[12]).toBe(2);
    expect(hours[13]).toBe(1);
    expect(hours[14]).toBe(2);
    expect(hours.reduce((a, b) => a + b, 0)).toBe(5);
    await expect(page.locator('[data-testid="stats-hour"][data-hour="12"]')).toHaveAttribute('data-level', '4');
    await expect(page.locator('[data-testid="stats-hour"][data-hour="13"]')).toHaveAttribute('data-level', '2');
    if (width >= 1280) {
      // Two rows of 12 hours at 1280, one row of 24 from 1440; the rod bars beside the leaderboard.
      const y = async (h: number) => (await page.locator(`[data-hour="${h}"]`).boundingBox())!.y;
      expect(Math.abs((await y(0)) - (await y(11)))).toBeLessThan(2);
      if (width >= 1440) expect(Math.abs((await y(0)) - (await y(23)))).toBeLessThan(2);
      else expect(await y(12)).toBeGreaterThan((await y(0)) + 10);
      const rods = (await page.getByTestId('stats-rod-bars').boundingBox())!;
      const lb = (await page.getByTestId('stats-leaderboard').boundingBox())!;
      expect(Math.abs(rods.y - lb.y)).toBeLessThan(2);
    } else {
      // Three rows of eight on the phone.
      const h0 = (await page.locator('[data-hour="0"]').boundingBox())!;
      const h8 = (await page.locator('[data-hour="8"]').boundingBox())!;
      expect(h8.y).toBeGreaterThan(h0.y + 10);
    }
    // c7: nothing about other partide is read while the venue scope is not chosen.
    expect(calls.details).toEqual([]);
    await expect(page.getByText(/capot/i)).toHaveCount(0);
    await settle(page);
    await expectNoA11yViolations(page);
    await page.screenshot({ path: `${SHOTS}/partida-${width}.png`, fullPage: true });
    expect(errors).toEqual([]);
  });
}

/* ------------------------------------------------------------------------------------------------
 * c1 c3 c5 c7 — «Toate partidele»
 * ---------------------------------------------------------------------------------------------- */

for (const width of [375, 1280, 1440, 1920] as const) {
  test(`partide.partida-statistici.c1 c3 c5 c7 at ${width}: «Toate partidele» — the viewer's own partide at this lake, read on the client; axe clean`, async ({ page, fakeLive }) => {
    await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc() } });
    const calls = await mockCms(page, { delayMs: 600 });
    const errors = collectConsoleErrors(page, { ignore: CONSOLE_NOISE });
    await open(page, { width });
    await toVenue(page);
    // Rule 4: a skeleton while the partide are read, never half-computed figures.
    await expect(page.getByTestId('stats-skeleton')).toBeVisible();
    await expect(page.getByTestId('stats-tiles')).toHaveCount(0);
    await expect(page.getByTestId('stats-skeleton')).toHaveCount(0);
    // c3: the venue tiles.
    await expect(tileValue(page, 'partide')).toHaveText('3');
    await expect(tile(page, 'partide')).toContainText('ale tale la această baltă');
    await expect(tileValue(page, 'momeala')).toHaveText('Pop-up');
    await expect(tileValue(page, 'distanta')).toHaveText('70–75');
    await expect(tile(page, 'distanta').locator('[data-unit]')).toHaveText(' m');
    await expect(tileValue(page, 'ore')).toHaveText('05:00–08:00');
    // c4: no rod bars across the venue.
    await expect(page.getByTestId('stats-rod-bars')).toHaveCount(0);
    // c5: the venue's bait ranking and heatmap (this partidă + A + B; X is another lake).
    expect(await baitLabels(page)).toEqual(['Pop-up', 'Porumb', 'Boilies', 'Necunoscută']);
    await expect(page.getByTestId('stats-bait-row').first().getByRole('cell')).toHaveText(['1', 'Pop-up', '3', '6,0', '7,0']);
    const hours = await hourCounts(page);
    expect(hours.reduce((a, b) => a + b, 0)).toBe(10);
    expect(hours[6]).toBe(4);
    expect(hours[7]).toBe(1);
    // c7: computed here from the own list + the details of the same-lake partide, in parallel;
    // never this partidă's own detail, never the other lake, never a server statistic.
    expect(calls.mine).toBeGreaterThan(0);
    expect([...calls.details].sort()).toEqual(['e2e-s-a', 'e2e-s-b']);
    expect(calls.other).toEqual([]);
    // c1: back to this partidă — instant, nothing read again.
    await pick(page, 'Această partidă');
    await expect(tileValue(page, 'capturi')).toHaveText('4');
    await toVenue(page);
    await expect(tileValue(page, 'partide')).toHaveText('3');
    expect(calls.details).toHaveLength(2);
    await expect(page.getByText(/capot/i)).toHaveCount(0);
    await settle(page);
    await expectNoA11yViolations(page);
    await page.screenshot({ path: `${SHOTS}/balta-${width}.png`, fullPage: true });
    expect(errors).toEqual([]);
  });
}

test('partide.partida-statistici.c1 keyboard: the scope is a radio pair — Tab reaches it, the arrows switch it', async ({ page, fakeLive }) => {
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc() } });
  await mockCms(page);
  await open(page, { width: 1280 });
  await radio(page, 'Această partidă').focus();
  await expect(radio(page, 'Această partidă')).toBeFocused();
  // The chosen segment is the filled accent (rule 20).
  const seg = (name: string) => page.getByTestId('stats-scope').locator('label', { hasText: name });
  const accent = await seg('Această partidă').evaluate(el => getComputedStyle(el).backgroundColor);
  expect(accent).not.toBe(await seg('Toate partidele').evaluate(el => getComputedStyle(el).backgroundColor));
  await page.keyboard.press('ArrowRight');
  await expect(radio(page, 'Toate partidele')).toBeChecked();
  await expect(tileValue(page, 'partide')).toHaveText('3');
  await page.keyboard.press('ArrowLeft');
  await expect(radio(page, 'Această partidă')).toBeChecked();
  await expect(tileValue(page, 'capturi')).toHaveText('4');
});

test('partide.partida-statistici.c3 «—» when a pattern is unknown: no bait × distance reaches three events', async ({ page, fakeLive }) => {
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc({ catches: CATCHES.slice(0, 2) }) } });
  await mockCms(page, { mine: [LIVE_ROW, X] });
  await open(page, { width: 375 });
  await toVenue(page);
  await expect(tileValue(page, 'partide')).toHaveText('1');
  await expect(tileValue(page, 'momeala')).toHaveText('—');
  await expect(tileValue(page, 'distanta')).toHaveText('—');
  await expect(tile(page, 'distanta').locator('[data-unit]')).toHaveCount(0);
  await expect(tileValue(page, 'ore')).toHaveText('10:00–13:00');
  await page.screenshot({ path: `${SHOTS}/balta-unknown-375.png`, fullPage: true });
});

/* ------------------------------------------------------------------------------------------------
 * c6 — empty; c4 — no rods; errors
 * ---------------------------------------------------------------------------------------------- */

for (const width of [375, 1280] as const) {
  test(`partide.partida-statistici.c6 at ${width}: zero events — fish's copy in each scope`, async ({ page, fakeLive }) => {
    await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc({ catches: [] }) } });
    const calls = await mockCms(page, { mine: [LIVE_ROW, X] });
    await open(page, { width });
    await expect(page.getByTestId('stats-empty-partida')).toHaveText('Niciun eveniment încă în această partidă.');
    await expect(page.getByTestId('stats-tiles')).toHaveCount(0);
    await expect(page.getByTestId('stats-leaderboard')).toHaveCount(0);
    await page.screenshot({ path: `${SHOTS}/empty-partida-${width}.png`, fullPage: true });
    await toVenue(page);
    await expect(page.getByTestId('stats-empty-balta')).toHaveText('Încă nu sunt suficiente date pentru această baltă.');
    await expect(page.getByTestId('stats-tiles')).toHaveCount(0);
    expect(calls.details).toEqual([]);
    await settle(page);
    await expectNoA11yViolations(page);
    await page.screenshot({ path: `${SHOTS}/empty-balta-${width}.png`, fullPage: true });
  });
}

test('partide.partida-statistici.c4 no rods: no «Capturi pe lansetă»; the leaderboard beside the heatmap from 1280', async ({ page, fakeLive }) => {
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc({ rods: [] }) } });
  await mockCms(page);
  await open(page, { width: 1440 });
  await expect(tileValue(page, 'capturi')).toHaveText('4');
  await expect(page.getByTestId('stats-rod-bars')).toHaveCount(0);
  await expect(page.getByText('Capturi pe lansetă')).toHaveCount(0);
  const lb = (await page.getByTestId('stats-leaderboard').boundingBox())!;
  const hm = (await page.getByTestId('stats-heatmap').boundingBox())!;
  expect(Math.abs(lb.y - hm.y)).toBeLessThan(2);
  expect(hm.x).toBeGreaterThan(lb.x + lb.width - 1);
  await page.screenshot({ path: `${SHOTS}/no-rods-1440.png`, fullPage: true });
});

test('partide.partida-statistici.c7 a failed read is an error with a retry — never figures from part of the venue', async ({ page, fakeLive }) => {
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc() } });
  const calls = await mockCms(page, { detailAnswers: { 'e2e-s-a': [500, 500, 500, 200] } });
  await open(page, { width: 375 });
  await toVenue(page);
  const error = page.getByTestId('stats-error');
  await expect(error).toBeVisible();
  await expect(error).toContainText('Nu am putut încărca statisticile.');
  await expect(page.getByTestId('stats-tiles')).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/error-375.png`, fullPage: true });
  await error.getByRole('button', { name: 'Încearcă din nou' }).click();
  await expect(tileValue(page, 'partide')).toHaveText('3');
  await expect(tileValue(page, 'momeala')).toHaveText('Pop-up');
  // Only the failed read was repeated.
  expect(calls.details.filter(id => id === 'e2e-s-b')).toHaveLength(1);
});
