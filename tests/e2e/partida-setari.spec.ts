import { mkdirSync } from 'node:fs';
import type { Page, Route } from '@playwright/test';
import { expectNoA11yViolations } from './helpers/a11y';
import { expect, test, type FakeLiveDoc } from './helpers/fake-live';
import { CMS, qaJwt, signIn } from './helpers/session';

/*
 * partide.partida-setari — the member view's «Setări» tab (/partide/[id]?tab=setari; fish
 * features/partide/scenes/InfoScene.tsx + CoopCard, SpeciesPickerSheet, StandPickerSheet).
 *
 * Data, all in the browser — NOTHING reaches Firestore or writes to any CMS:
 *  - the live partidă is the shared Firestore fake (helpers/fake-live.ts; a Firebase request fails
 *    the test), seeded with `allTabs` so the tab renders whatever lib/partide-pages says;
 *  - every CMS read and write is route-mocked: the pointer (/feed/sessions/active), the own list,
 *    an ended partidă's detail, PATCH /feed/sessions/:id (species, stand + anchor, visibility),
 *    rotate, kick, finish, leave, delete, /feedbacks; the lake read (/feed/lakes/:id) is the local
 *    CMS's real Chita Lake DTO with the stands replaced per test; the fish catalog fails (→ fish's
 *    four fallback names).
 * The viewer is the real QA account (the session cookie), its documentId the owner / member uid.
 */

const NOW = new Date('2026-10-07T12:00:00.000Z');
const at = (minutesAgo: number) => new Date(NOW.getTime() - minutesAgo * 60_000).toISOString();
const SHOTS = '.shots/partida-setari';
mkdirSync(SHOTS, { recursive: true });

const LIVE = { documentId: 'e2e-s-live', clientId: 'e2e-sc-live' };
const ENDED = { documentId: 'e2e-s-ended', clientId: 'e2e-sc-ended' };
const LAKE = 'e2e-lake-s';
const WIDTHS = [375, 1280, 1440, 1920] as const;

let selfId = '';
let jwt = '';
let lakeDto: Record<string, unknown> = {};

test.use({ timezoneId: 'Europe/Bucharest', locale: 'ro-RO' });

test.beforeAll(async ({ request }) => {
  jwt = await qaJwt(request);
  const me = await request.get(`${CMS}/user/profile`, { headers: { authorization: `Bearer ${jwt}` } });
  expect(me.ok(), 'QA profile read').toBe(true);
  selfId = (await me.json()).documentId as string;
  const lake = await request.get(`${CMS}/feed/lakes/s84u55lo4n9z0emngozttt6e`);
  expect(lake.ok(), 'local lake read (a valid DTO to shape)').toBe(true);
  lakeDto = (await lake.json()).data;
});

/* ------------------------------------------------------------------------------------------------
 * Fixtures
 * ---------------------------------------------------------------------------------------------- */

const member = (uid: string, name: string | null) => ({ uid, name, avatar: null, joinedAt: at(130) });
const STANDS = [
  { documentId: 'st-10', name: 'Stand 10', coordinates: { lat: '44.60000', long: '26.30000' } },
  { documentId: 'st-2', name: 'Stand 2', coordinates: { lat: '44.55000', long: '26.25000' } },
  { documentId: 'st-3', name: 'Stand 3', coordinates: null },
];

function liveDoc(patch: Partial<FakeLiveDoc> = {}): FakeLiveDoc {
  return {
    startedAt: at(134), // 09:46 Bucharest
    endedAt: null,
    status: 'active',
    venueType: 'lake',
    lakeId: LAKE,
    lakeName: 'Balta Mock',
    standId: null,
    standName: null,
    locality: 'Giurgiu',
    anchorLat: 44.4321,
    anchorLong: 26.1234,
    anchorName: null,
    plannedDurationMs: 8 * 3_600_000,
    visibleOnProfile: true,
    targetSpecies: [{ documentId: null, name: 'Crap' }],
    hostUid: selfId,
    joinCode: 'K7M2QX',
    members: [member(selfId, 'Eu Pescar'), member('e2e-angler-2', 'Ana Crap')],
    rods: [{ clientId: 'rod-1', index: 1, label: 'L1', runtimePhase: 'idle' }],
    catches: [{ clientId: 'ev-1', outcome: 'capture', occurredAt: at(60), weightKg: 2.4, species: 'Crap' }],
    rev: 3,
    ...patch,
  };
}

const listItem = (patch: Record<string, unknown> = {}) => ({
  documentId: ENDED.documentId,
  clientId: ENDED.clientId,
  clientUpdatedAt: null,
  venueType: 'lake',
  lakeId: LAKE,
  lakeName: 'Lacul Istoric',
  lakeImageUrl: null,
  publicWaterCode: null,
  publicWaterName: null,
  manualVenueName: null,
  standId: 'st-2',
  standName: 'A9',
  locality: 'Ilfov',
  anchorLat: 44.5,
  anchorLong: 26.2,
  anchorName: 'Lângă ponton',
  startedAt: at(26 * 60), // 6 oct 13:00 Bucharest
  endedAt: at(20 * 60 - 12), // 19:12
  plannedDurationMs: 6 * 3_600_000,
  notes: null,
  visibleOnProfile: false,
  status: 'finished',
  targetSpecies: [{ documentId: null, name: 'Crap' }, { documentId: null, name: 'Somn' }],
  hostUid: selfId,
  captures: 0,
  recordKg: null,
  totalKg: null,
  ...patch,
});

function detailOf(item: ReturnType<typeof listItem>, patch: Record<string, unknown> = {}) {
  const { captures: _c, recordKg: _r, totalKg: _t, ...base } = item;
  void [_c, _r, _t];
  return { ...base, joinCode: 'ARH1VE', rods: [], members: [member(selfId, 'Eu Pescar'), member('e2e-angler-3', null)], events: [], ...patch };
}

type Answer = number | { status: number; delayMs?: number };
type Calls = { patch: Record<string, unknown>[]; rotate: string[]; kick: string[]; finish: string[]; leave: string[]; remove: string[]; feedback: unknown[]; lake: number };

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const fail = (route: Route, status: number) => json(route, { data: null, error: { status, name: 'Error', message: 'mock', details: {} } }, status);
async function answer(route: Route, a: Answer | undefined, ok: unknown) {
  const spec = typeof a === 'number' ? { status: a } : (a ?? { status: 200 });
  if (spec.delayMs) await new Promise(r => setTimeout(r, spec.delayMs));
  return spec.status === 200 ? json(route, ok) : fail(route, spec.status);
}

async function mockCms(
  page: Page,
  {
    live = true,
    ended = null as null | ReturnType<typeof listItem>,
    stands = STANDS as unknown[],
    writes = {} as Partial<Record<'patch' | 'rotate' | 'kick', Answer>>,
  } = {},
): Promise<Calls> {
  const calls: Calls = { patch: [], rotate: [], kick: [], finish: [], leave: [], remove: [], feedback: [], lake: 0 };
  await page.route(/tiles\.openfreemap\.org|arcgisonline\.com/, r => r.abort());
  await page.route(/\/fishes(\?.*)?$/, r => fail(r, 500));
  await page.route(/\/feed\/community\/sessions\/e2e-/, r => fail(r, 404));
  await page.route('**/api/cms/feed/session-follows/mine', r => json(r, { data: { sessionDocumentIds: [] } }));
  await page.route(new RegExp(`/feed/lakes/${LAKE}(\\?.*)?$`), r => {
    calls.lake += 1;
    return json(r, { data: { ...lakeDto, documentId: LAKE, stands } });
  });
  await page.route('**/api/cms/feed/sessions/active', r =>
    json(r, { data: live ? { documentId: LIVE.documentId, clientId: LIVE.clientId, firestoreId: LIVE.clientId } : null }),
  );
  await page.route(/\/api\/cms\/feed\/sessions\/mine(\?.*)?$/, r => json(r, { data: ended ? [ended] : [], meta: { page: 1, pageSize: 100, total: ended ? 1 : 0 } }));
  await page.route(/\/api\/cms\/feed\/sessions\/(e2e-[^/?]+)(\/[^?]*)?(\?.*)?$/, async route => {
    const url = new URL(route.request().url());
    const m = /\/feed\/sessions\/(e2e-[^/]+)(\/.*)?$/.exec(url.pathname)!;
    const id = m[1];
    const rest = m[2] ?? '';
    const method = route.request().method();
    if (method === 'GET' && !rest) return ended && id === ENDED.documentId ? json(route, { data: detailOf(ended) }) : fail(route, 404);
    if (method === 'PATCH' && !rest) {
      calls.patch.push((route.request().postDataJSON() as { data: Record<string, unknown> }).data);
      return answer(route, writes.patch, { data: { ok: true } });
    }
    if (method === 'POST' && rest === '/join-code/rotate') {
      calls.rotate.push(id);
      return answer(route, writes.rotate, { data: { joinCode: 'NEW123', projectionRev: 4 } });
    }
    if (method === 'DELETE' && rest.startsWith('/members/')) {
      calls.kick.push(rest.slice('/members/'.length));
      return answer(route, writes.kick, { data: { removed: true, joinCode: 'NEW123', members: [member(selfId, 'Eu Pescar')], hostUid: selfId, projectionRev: 4 } });
    }
    if (method === 'POST' && rest === '/finish') {
      calls.finish.push(id);
      return fail(route, 500);
    }
    if (method === 'POST' && rest === '/leave') {
      calls.leave.push(id);
      return fail(route, 500);
    }
    if (method === 'DELETE' && !rest) {
      calls.remove.push(id);
      return fail(route, 500);
    }
    return fail(route, 418);
  });
  await page.route('**/api/cms/feedbacks', r => {
    calls.feedback.push(r.request().postDataJSON());
    return json(r, { data: { documentId: 'fb-1' } });
  });
  return calls;
}

async function open(page: Page, documentId: string, width = 1280) {
  await page.setViewportSize({ width, height: 900 });
  await page.clock.install({ time: NOW });
  await page.goto(`/partide/${documentId}?tab=setari`);
  await expect(page.getByTestId('partida-setari')).toBeVisible();
}

const tab = (page: Page) => page.getByTestId('partida-setari');
const coop = (page: Page) => page.getByTestId('setari-coop');
const toast = (page: Page, text: string) => page.getByText(text, { exact: true }).filter({ visible: true });
const settle = (page: Page) => page.waitForTimeout(450);
/** «Șterge partida» is the last visible thing under the tab bar (fish InfoScene ends there): nothing below it. */
async function expectDeleteLast(page: Page) {
  const del = (await page.getByRole('button', { name: 'Șterge partida' }).filter({ visible: true }).boundingBox())!;
  const below = await page.evaluate(top => {
    const main = document.querySelector('[data-testid="partida-member-view"]')?.parentElement ?? document.body;
    return Array.from(main.querySelectorAll('[data-testid]'))
      .filter(el => {
        const r = el.getBoundingClientRect();
        return r.height > 0 && r.top + window.scrollY > top + 1 && !el.closest('dialog') && !el.closest('footer');
      })
      .map(el => el.getAttribute('data-testid'));
  }, del.y + del.height);
  expect(below).toEqual([]);
}

const detailRows = (page: Page) =>
  page
    .getByTestId('setari-detail-row')
    .evaluateAll(rows => rows.map(r => Array.from(r.querySelectorAll('span')).filter(s => !s.querySelector('span')).map(s => s.textContent?.trim()).join(' | ')));

test.beforeEach(async ({ context }) => {
  await signIn(context, jwt);
});

/* ------------------------------------------------------------------------------------------------
 * The tab at every width — owner, co-op, live (c1 c2 c3 c4 c5 c7 c8 c9)
 * ---------------------------------------------------------------------------------------------- */

for (const width of WIDTHS) {
  test(`partide.partida-setari.c1 c2 c4 c5 c7 c8 c9 owner · co-op · live at ${width}: every block, two columns on desktop, each action once — axe clean`, async ({ page, fakeLive }) => {
    await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc() }, allTabs: true });
    await mockCms(page);
    await open(page, LIVE.documentId, width);
    await expect(page.getByRole('tab', { name: 'Setări' })).toHaveAttribute('aria-selected', 'true');
    // c1
    await expect(coop(page)).toContainText('Partidă în echipă');
    await expect(page.getByTestId('setari-join-code')).toHaveText('K7M2QX');
    await expect(coop(page).getByRole('button', { name: /^Invită/ })).toBeVisible();
    // c2
    await expect(coop(page).getByRole('button', { name: 'Schimbă codul' })).toBeVisible();
    await expect(page.getByTestId('setari-members-count')).toHaveText('2 membri');
    const members = page.getByTestId('setari-member');
    await expect(members.nth(0)).toContainText('Eu Pescar (tu)Organizator');
    await expect(members.nth(0).getByRole('button')).toHaveCount(0);
    await expect(members.nth(1).getByRole('button', { name: 'Elimină Ana Crap' })).toBeVisible();
    // c4 (live)
    await expect.poll(() => detailRows(page)).toEqual([
      'Baltă | Balta Mock | Giurgiu',
      'Început | 7 oct. · 12:46',
      'Sfârșit estimat | 7 oct. · 20:46',
      'Durată estimată | 8h',
    ]);
    // c5 — the lake has stands
    await expect(page.getByTestId('setari-edit-pozitie')).toContainText('44.43210, 26.12340');
    await expect(page.getByTestId('setari-edit-specii')).toContainText('Crap');
    await expect(page.getByTestId('setari-edit-stand')).toContainText('Alege standul');
    // c7 c8
    await expect(page.getByTestId('setari-sync')).toContainText('Sincronizat');
    await expect(page.getByRole('switch', { name: 'Partidă publică' })).toBeChecked();
    // c3 c9 — and each action once on the screen (the summary keeps only its numbers here)
    await expect(page.getByTestId('setari-report')).toBeVisible();
    // «Termină» in the tab; below 1280 the compact header carries it too (fish PartidaCompactHeader +
    // InfoScene both have it), from 1280 the header leaves it to the page.
    await expect(tab(page).getByRole('button', { name: 'Termină partida' })).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Termină partida' }).filter({ visible: true })).toHaveCount(width < 1280 ? 2 : 1);
    await expect(page.getByRole('button', { name: 'Șterge partida' }).filter({ visible: true })).toHaveCount(1);
    await expect(page.getByRole('button', { name: /Raportează o problemă/ }).filter({ visible: true })).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Părăsește partida' })).toHaveCount(0);
    await expect(page.getByTestId('partida-roster')).toHaveCount(0);
    await expect(page.getByTestId('partida-join-code')).toHaveCount(0);
    // «Pe scurt» only as the right column (≥1280); below it, nothing after «Șterge partida».
    if (width >= 1280) await expect(page.getByTestId('partida-summary-stats')).toBeVisible();
    else {
      await expect(page.getByTestId('partida-summary-stats')).toBeHidden();
      await expectDeleteLast(page);
    }
    // Desktop: Detalii + Editează left, the co-op card right, tops aligned.
    const details = (await page.getByTestId('setari-details').locator('ul').boundingBox())!;
    const card = (await coop(page).boundingBox())!;
    const report = (await page.getByTestId('setari-report').boundingBox())!;
    const sync = (await page.getByTestId('setari-sync').boundingBox())!;
    if (width >= 1024) {
      expect(card.x).toBeGreaterThan(details.x + details.width - 1);
      expect(Math.abs(card.y - details.y)).toBeLessThan(2);
    } else {
      // Phone: fish's order — the co-op card first.
      expect(card.y).toBeLessThan(details.y);
    }
    // c3 — «Raportează o problemă» right under the co-op card at every width (fish InfoScene: buried
    // under Detalii / Editează / Sincronizare nobody found it), above Sincronizare.
    expect(report.y).toBeGreaterThan(card.y + card.height - 1);
    expect(report.y).toBeLessThan(sync.y);
    expect(report.y - (card.y + card.height)).toBeLessThan(32);
    await expectNoA11yViolations(page);
    await page.screenshot({ path: `${SHOTS}/owner-coop-live-${width}.png`, fullPage: true });
  });
}

/* ------------------------------------------------------------------------------------------------
 * c1 — Invită
 * ---------------------------------------------------------------------------------------------- */

test('partide.partida-setari.c1 «Invită» shares fish’s message with the join link (Web Share API)', async ({ page, fakeLive }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __shared: unknown[] };
    w.__shared = [];
    Object.defineProperty(navigator, 'share', { configurable: true, value: (d: unknown) => (w.__shared.push(d), Promise.resolve()) });
  });
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc() }, allTabs: true });
  await mockCms(page);
  await open(page, LIVE.documentId, 375);
  await coop(page).getByRole('button', { name: /^Invită/ }).click();
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __shared: unknown[] }).__shared))
    .toEqual([{ text: 'Hai în partida mea pe Bluvi! Folosește codul K7M2QX sau deschide linkul: https://bluvi-app.wearetribus.com/partide/join/K7M2QX' }]);
});

test('partide.partida-setari.c1 «Invită» without the Web Share API copies the message and says so', async ({ page, fakeLive }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __copied: string[] };
    w.__copied = [];
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: (t: string) => (w.__copied.push(t), Promise.resolve()) } });
  });
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc() }, allTabs: true });
  await mockCms(page);
  await open(page, LIVE.documentId, 1280);
  await coop(page).getByRole('button', { name: /^Invită/ }).click();
  await expect(toast(page, 'Invitația a fost copiată.')).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __copied: string[] }).__copied)).toEqual([
    'Hai în partida mea pe Bluvi! Folosește codul K7M2QX sau deschide linkul: https://bluvi-app.wearetribus.com/partide/join/K7M2QX',
  ]);
});

/* ------------------------------------------------------------------------------------------------
 * c2 — rotate, kick, roles
 * ---------------------------------------------------------------------------------------------- */

test('partide.partida-setari.c2 «Schimbă codul» → the rotate confirmation → POST join-code/rotate (keyboard)', async ({ page, fakeLive }) => {
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc() }, allTabs: true });
  const calls = await mockCms(page);
  await open(page, LIVE.documentId, 1280);
  await coop(page).getByRole('button', { name: 'Schimbă codul' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Schimbi codul de acces?' })).toBeVisible();
  await page.getByTestId('rotate-dialog-confirm').click();
  await expect(toast(page, 'Codul de acces a fost schimbat.')).toBeVisible();
  expect(calls.rotate).toEqual([LIVE.documentId]);
  // The projection brings the new code.
  await fakeLive.push(LIVE.clientId, liveDoc({ joinCode: 'NEW123', rev: 4 }));
  await expect(page.getByTestId('setari-join-code')).toHaveText('NEW123');
});

test('partide.partida-setari.c2 «Elimină Ana Crap» → the kick confirmation → DELETE members/:uid', async ({ page, fakeLive }) => {
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc() }, allTabs: true });
  const calls = await mockCms(page);
  await open(page, LIVE.documentId, 375);
  await page.getByRole('button', { name: 'Elimină Ana Crap' }).click();
  await expect(page.getByRole('heading', { name: 'Elimini participantul?' })).toBeVisible();
  await expect(page.getByTestId('kick-dialog')).toContainText('Ana Crap va pierde accesul la partidă.');
  await settle(page);
  await page.screenshot({ path: `${SHOTS}/kick-375.png` });
  await page.getByTestId('kick-dialog-confirm').click();
  await expect(toast(page, 'Participant eliminat. Codul a fost schimbat.')).toBeVisible();
  expect(calls.kick).toEqual(['e2e-angler-2']);
});

test('partide.partida-setari.c2 c9 a member (not the owner): «1 membru»-style roster, no Schimbă / Elimină, «Părăsește partida», no Șterge, read-only visibility', async ({ page, fakeLive }) => {
  const doc = liveDoc({ hostUid: 'e2e-host', members: [member('e2e-host', null), member(selfId, 'Eu Pescar'), member('e2e-angler-4', 'Dan')] });
  await fakeLive.seed({ docs: { [LIVE.clientId]: doc }, allTabs: true });
  const calls = await mockCms(page);
  await open(page, LIVE.documentId, 1440);
  await expect(page.getByTestId('setari-members-count')).toHaveText('3 membri');
  const members = page.getByTestId('setari-member');
  await expect(members.nth(0)).toContainText('PescarOrganizator');
  await expect(coop(page).getByRole('button', { name: /^Invită/ })).toBeVisible();
  await expect(coop(page).getByRole('button', { name: 'Schimbă codul' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Elimină/ })).toHaveCount(0);
  await expect(page.getByRole('switch')).toHaveCount(0);
  await expect(page.getByTestId('setari-public-value')).toHaveText('Publică');
  await expect(page.getByRole('button', { name: 'Termină partida' }).filter({ visible: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Șterge partida' })).toHaveCount(0);
  // c5: a member edits the meta too (any member may — CMS).
  await expect(page.getByTestId('setari-edit')).toBeVisible();
  await expectNoA11yViolations(page);
  await page.screenshot({ path: `${SHOTS}/member-live-1440.png`, fullPage: true });
  await page.getByRole('button', { name: 'Părăsește partida' }).click();
  await expect(page.getByRole('heading', { name: 'Părăsești partida?' })).toBeVisible();
  expect(calls.leave).toEqual([]);
});

test('partide.partida-setari.c1 c2 solo partidă (no join code): no co-op card; «1 membru» for a one-member co-op', async ({ page, fakeLive }) => {
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc({ joinCode: null, members: [member(selfId, 'Eu Pescar')] }) }, allTabs: true });
  await mockCms(page);
  await open(page, LIVE.documentId, 1280);
  await expect(coop(page)).toHaveCount(0);
  await expect(page.getByTestId('setari-details')).toBeVisible();
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    await page.screenshot({ path: `${SHOTS}/solo-live-${width}.png`, fullPage: true });
  }
  await fakeLive.push(LIVE.clientId, liveDoc({ members: [member(selfId, 'Eu Pescar')], rev: 4 }));
  await expect(page.getByTestId('setari-members-count')).toHaveText('1 membru');
});

/* ------------------------------------------------------------------------------------------------
 * c3 — feedback
 * ---------------------------------------------------------------------------------------------- */

test('partide.partida-setari.c3 «Raportează o problemă» opens the feedback dialog (live and ended)', async ({ page, fakeLive }) => {
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc() }, allTabs: true });
  await mockCms(page);
  await open(page, LIVE.documentId, 375);
  await expect(page.getByTestId('setari-report')).toContainText('Ceva nu merge sau ai o idee? Scrie-ne direct din partidă.');
  await page.getByTestId('setari-report').click();
  await expect(page.getByRole('heading', { name: 'Spune-ne ce nu merge' })).toBeVisible();
  await expect(page.getByTestId('feedback-dialog')).toBeVisible();
});

/* ------------------------------------------------------------------------------------------------
 * c4 c8 c9 — ended
 * ---------------------------------------------------------------------------------------------- */

for (const width of WIDTHS) {
  test(`partide.partida-setari.c4 c8 c9 ended at ${width}: Sfârșit + Durată, the settings as facts, no Editează, «Privată» read-only, only «Șterge»`, async ({ page, fakeLive }) => {
    await fakeLive.seed({ allTabs: true });
    const item = listItem();
    await mockCms(page, { live: false, ended: item });
    await open(page, ENDED.documentId, width);
    await expect.poll(() => detailRows(page)).toEqual([
      'Baltă | Lacul Istoric | Stand A9',
      'Început | 6 oct. · 13:00',
      'Sfârșit | 6 oct. · 19:12',
      'Durată | 06:12',
      'Reper | Lângă ponton',
      'Poziție | 44.50000, 26.20000',
      'Specii vizate | Crap, Somn',
      'Stand | A9',
    ]);
    await expect(page.getByTestId('setari-edit')).toHaveCount(0);
    await expect(page.getByRole('switch')).toHaveCount(0);
    await expect(page.getByTestId('setari-public-value')).toHaveText('Privată');
    // The co-op card stays, read-only: the code and the roster, no Invită / Schimbă / Elimină.
    await expect(page.getByTestId('setari-join-code')).toHaveText('ARH1VE');
    await expect(coop(page).getByRole('button')).toHaveCount(0);
    await expect(page.getByTestId('setari-member').nth(1)).toContainText('Pescar');
    await expect(page.getByRole('button', { name: 'Termină partida' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Părăsește partida' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Șterge partida' }).filter({ visible: true })).toHaveCount(1);
    await expect(page.getByTestId('setari-report')).toBeVisible();
    if (width < 1280) {
      await expect(page.getByTestId('partida-summary-stats')).toBeHidden();
      await expectDeleteLast(page);
    }
    await expectNoA11yViolations(page);
    await page.screenshot({ path: `${SHOTS}/owner-ended-${width}.png`, fullPage: true });
  });
}

test('partide.partida-setari.c9 owner: «Termină partida» opens the finish confirmation, «Șterge partida» the delete one', async ({ page, fakeLive }) => {
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc() }, allTabs: true });
  const calls = await mockCms(page);
  await open(page, LIVE.documentId, 375);
  await tab(page).getByRole('button', { name: 'Termină partida' }).click();
  await expect(page.getByRole('heading', { name: 'Termină partida?' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'Termină partida?' })).toHaveCount(0);
  await tab(page).getByRole('button', { name: 'Șterge partida' }).click();
  await expect(page.getByRole('heading', { name: 'Ștergi această partidă?' })).toBeVisible();
  expect(calls.finish).toEqual([]);
  expect(calls.remove).toEqual([]);
});

/* ------------------------------------------------------------------------------------------------
 * c5 c6 — Editează
 * ---------------------------------------------------------------------------------------------- */

test('partide.partida-setari.c5 «Poziție» opens the adjust map on the anchor', async ({ page, fakeLive }) => {
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc() }, allTabs: true });
  await mockCms(page);
  await open(page, LIVE.documentId, 1280);
  await page.getByTestId('setari-edit-pozitie').click();
  await expect(page.getByRole('heading', { name: 'Ajustează poziția' })).toBeVisible();
  await expect(page.getByTestId('map-point-picker-body')).toHaveAttribute('data-lat', '44.432100');
});

test('partide.partida-setari.c5 «Specii vizate» → the species picker → «Salvează» PATCHes targetSpecies', async ({ page, fakeLive }) => {
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc() }, allTabs: true });
  const calls = await mockCms(page);
  await open(page, LIVE.documentId, 375);
  await page.getByTestId('setari-edit-specii').click();
  const picker = page.getByTestId('species-picker');
  await expect(picker).toBeVisible();
  await expect(picker.getByRole('checkbox', { name: 'Crap' })).toHaveAttribute('aria-checked', 'true');
  await picker.getByRole('checkbox', { name: 'Somn' }).click();
  await settle(page);
  await page.screenshot({ path: `${SHOTS}/species-375.png` });
  await page.getByTestId('species-picker-save').click();
  await expect.poll(() => calls.patch).toEqual([{ targetSpecies: [{ documentId: null, name: 'Crap' }, { documentId: null, name: 'Somn' }] }]);
  await fakeLive.push(LIVE.clientId, liveDoc({ targetSpecies: [{ documentId: null, name: 'Crap' }, { documentId: null, name: 'Somn' }], rev: 4 }));
  await expect(page.getByTestId('setari-edit-specii')).toContainText('Crap, Somn');
});

test('partide.partida-setari.c5 c6 «Stand» → «Alege standul» (natural order) → the anchor moves to the stand, then the adjust map opens', async ({ page, fakeLive }) => {
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc() }, allTabs: true });
  const calls = await mockCms(page);
  await open(page, LIVE.documentId, 1280);
  await page.getByTestId('setari-edit-stand').click();
  const list = page.getByTestId('stand-picker');
  await expect(page.getByRole('heading', { name: 'Alege standul' })).toBeVisible();
  await expect(list.getByRole('button')).toHaveText(['Fără stand', 'Stand 2', 'Stand 3', 'Stand 10']);
  await expect(list.getByRole('button', { name: 'Fără stand' })).toHaveAttribute('aria-pressed', 'true');
  await settle(page);
  await expectNoA11yViolations(page);
  await page.screenshot({ path: `${SHOTS}/stand-picker-1280.png` });
  await list.getByRole('button', { name: 'Stand 2' }).click();
  await expect(page.getByRole('heading', { name: 'Alege standul' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Ajustează poziția' })).toBeVisible();
  await expect.poll(() => calls.patch).toEqual([{ anchorLat: 44.55, anchorLong: 26.25, standId: 'st-2', standName: 'Stand 2' }]);
  // The map opens on the stand itself, ahead of the projection…
  const body = page.getByTestId('map-point-picker-body');
  await expect(body).toHaveAttribute('data-lat', '44.550000');
  await expect(body).toHaveAttribute('data-lng', '26.250000');
  await expect(page.getByTestId('setari-edit-stand')).toContainText('Stand 2');
  const mapEl = await body.elementHandle();
  // …and the projection landing while it is open neither moves nor remounts it.
  await fakeLive.push(LIVE.clientId, liveDoc({ anchorLat: 44.55, anchorLong: 26.25, standId: 'st-2', standName: 'Stand 2', rev: 4 }));
  await expect(page.getByTestId('setari-edit-pozitie')).toContainText('44.55000, 26.25000');
  await expect(body).toHaveAttribute('data-lat', '44.550000');
  await expect(body).toHaveAttribute('data-lng', '26.250000');
  expect(await mapEl!.evaluate(el => el.isConnected)).toBe(true);
});

test('partide.partida-setari.c5 c6 a failed save (502): the chosen value shows at once, then goes back with an error toast', async ({ page, fakeLive }) => {
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc() }, allTabs: true });
  const calls = await mockCms(page, { writes: { patch: { status: 502, delayMs: 300 } } });
  await open(page, LIVE.documentId, 375);
  await page.getByTestId('setari-edit-specii').click();
  const picker = page.getByTestId('species-picker');
  await picker.getByRole('checkbox', { name: 'Somn' }).click();
  await page.getByTestId('species-picker-save').click();
  await expect(page.getByTestId('setari-edit-specii')).toContainText('Crap, Somn');
  await expect(toast(page, 'Nu am putut salva modificarea. Încearcă din nou.')).toBeVisible();
  await expect(page.getByTestId('setari-edit-specii')).not.toContainText('Somn');
  await page.screenshot({ path: `${SHOTS}/edit-failed-375.png` });
  // The stand too: the row goes back to «Alege standul».
  await page.getByTestId('setari-edit-stand').click();
  await page.getByTestId('stand-picker').getByRole('button', { name: 'Stand 2' }).click();
  await page.getByTestId('map-point-picker').getByRole('button', { name: 'Închide' }).click();
  await expect(page.getByTestId('setari-edit-stand')).toContainText('Alege standul');
  await expect.poll(() => calls.patch.length).toBe(2);
});

test('partide.partida-setari.c6 a stand without coordinates keeps the anchor; «Fără stand» clears it and opens no map', async ({ page, fakeLive }) => {
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc({ standId: 'st-2', standName: 'Stand 2' }) }, allTabs: true });
  const calls = await mockCms(page);
  await open(page, LIVE.documentId, 375);
  await expect(page.getByTestId('setari-edit-stand')).toContainText('Stand 2');
  await page.getByTestId('setari-edit-stand').click();
  await page.getByTestId('stand-picker').getByRole('button', { name: 'Stand 3' }).click();
  await expect(page.getByRole('heading', { name: 'Ajustează poziția' })).toBeVisible();
  await expect.poll(() => calls.patch[0]).toEqual({ anchorLat: 44.4321, anchorLong: 26.1234, standId: 'st-3', standName: 'Stand 3' });
  await page.getByTestId('map-point-picker').getByRole('button', { name: 'Închide' }).click();
  await expect(page.getByRole('heading', { name: 'Ajustează poziția' })).toHaveCount(0);
  await page.getByTestId('setari-edit-stand').click();
  await page.getByTestId('stand-picker').getByRole('button', { name: 'Fără stand' }).click();
  await expect.poll(() => calls.patch.length).toBe(2);
  expect(calls.patch[1]).toEqual({ anchorLat: 44.4321, anchorLong: 26.1234, standId: null, standName: null });
  await page.waitForTimeout(300);
  await expect(page.getByRole('heading', { name: 'Ajustează poziția' })).toHaveCount(0);
});

test('partide.partida-setari.c5 a lake without stands, and a public water: no «Stand» row (no lake read for the water)', async ({ page, fakeLive }) => {
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc() }, allTabs: true });
  const calls = await mockCms(page, { stands: [] });
  await open(page, LIVE.documentId, 1280);
  await expect.poll(() => calls.lake).toBeGreaterThan(0);
  await expect(page.getByTestId('setari-edit-specii')).toBeVisible();
  await expect(page.getByTestId('setari-edit-stand')).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/no-stands-1280.png`, fullPage: true });
  const lakeReads = calls.lake;
  await fakeLive.push(LIVE.clientId, liveDoc({ venueType: 'publicWater', lakeId: null, lakeName: null, publicWaterCode: 'RO-1', publicWaterName: 'Dunărea', rev: 4 }));
  await expect(page.getByTestId('setari-details')).toContainText('Dunărea');
  await expect(page.getByTestId('setari-edit-stand')).toHaveCount(0);
  expect(calls.lake).toBe(lakeReads);
});

/* ------------------------------------------------------------------------------------------------
 * c7 — sync
 * ---------------------------------------------------------------------------------------------- */

test('partide.partida-setari.c7 «Sincronizat» online, «Offline» offline', async ({ page, context, fakeLive }) => {
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc() }, allTabs: true });
  await mockCms(page);
  await open(page, LIVE.documentId, 375);
  const row = page.getByTestId('setari-sync');
  await expect(row).toContainText('Sincronizat');
  await context.setOffline(true);
  await expect(row).toContainText('Offline');
  await page.screenshot({ path: `${SHOTS}/offline-375.png`, fullPage: true });
  await context.setOffline(false);
  await expect(row).toContainText('Sincronizat');
});

/* ------------------------------------------------------------------------------------------------
 * c8 — the privacy opt-out (domain invariant 14, b.private-partida)
 * ---------------------------------------------------------------------------------------------- */

test('partide.partida-setari.c8 turning «Partidă publică» off: pending while the CMS purges, then off; one write at a time', async ({ page, fakeLive }) => {
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc() }, allTabs: true });
  const calls = await mockCms(page, { writes: { patch: { status: 200, delayMs: 800 } } });
  await open(page, LIVE.documentId, 1280);
  const sw = page.getByRole('switch', { name: 'Partidă publică' });
  await expect(sw).toHaveAccessibleDescription(/ceilalți văd doar capturile/);
  await sw.press('Space');
  await expect(sw).not.toBeChecked();
  await expect(sw).toHaveAttribute('aria-busy', 'true');
  await expect(page.getByTestId('setari-public')).toContainText('Se salvează…');
  await page.screenshot({ path: `${SHOTS}/public-pending-1280.png` });
  await sw.click(); // ignored while in flight
  await expect(sw).not.toHaveAttribute('aria-busy');
  await expect(sw).not.toBeChecked();
  expect(calls.patch).toEqual([{ visibleOnProfile: false }]);
  await fakeLive.push(LIVE.clientId, liveDoc({ visibleOnProfile: false, rev: 4 }));
  await expect(sw).not.toBeChecked();
});

test('partide.partida-setari.c8 b.private-partida a failed opt-out (the purge failed) reverts the switch and says so', async ({ page, fakeLive }) => {
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc() }, allTabs: true });
  const calls = await mockCms(page, { writes: { patch: { status: 502, delayMs: 300 } } });
  await open(page, LIVE.documentId, 375);
  const sw = page.getByRole('switch', { name: 'Partidă publică' });
  await sw.click();
  await expect(sw).not.toBeChecked();
  await expect(toast(page, 'Nu am putut schimba vizibilitatea partidei. Încearcă din nou.')).toBeVisible();
  await expect(sw).toBeChecked();
  await expect(sw).not.toHaveAttribute('aria-busy');
  await page.screenshot({ path: `${SHOTS}/public-failed-375.png` });
  expect(calls.patch).toEqual([{ visibleOnProfile: false }]);
});

test('partide.partida-setari.c8 a private live partidă turns public again', async ({ page, fakeLive }) => {
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc({ visibleOnProfile: false }) }, allTabs: true });
  const calls = await mockCms(page);
  await open(page, LIVE.documentId, 1920);
  const sw = page.getByRole('switch', { name: 'Partidă publică' });
  await expect(sw).not.toBeChecked();
  await sw.click();
  await expect(sw).toBeChecked();
  await expect.poll(() => calls.patch).toEqual([{ visibleOnProfile: true }]);
});
