import { mkdirSync } from 'node:fs';
import type { Page, Route } from '@playwright/test';
import { expectNoA11yViolations } from './helpers/a11y';
import { collectConsoleErrors } from './helpers/console';
import { expect, test, type FakeCatchDoc, type FakeLiveDoc } from './helpers/fake-live';
import { CMS, qaJwt, signIn } from './helpers/session';

/*
 * partide.partida-jurnal — the member view's «Jurnal» tab (/partide/[id]?tab=jurnal; fish
 * features/partide/scenes/JurnalScene.tsx, JurnalRow, ShareCatchSheet, PartidaMap).
 *
 * NOTHING reaches Firestore or writes to a CMS:
 *  - the live partidă is the shared Firestore fake (helpers/fake-live.ts); the marker writes — the
 *    one Firestore write fish makes — are recorded by the fake (`markerWrites`), and the fixture
 *    fails the test on any request to a Firebase host;
 *  - the CMS reads (pointer, own list, detail) and the catch DELETE are route-mocked.
 * The tab ships for real here (lib/partide-pages partidaJurnal): no `allTabs`. The viewer is the QA
 * account (session cookie); a fixed clock and the Bucharest time zone keep the times exact.
 */

test.use({ timezoneId: 'Europe/Bucharest', locale: 'ro-RO' });

const NOW = new Date('2026-10-07T12:00:00.000Z'); // 15:00 in Bucharest
const at = (minutesAgo: number) => new Date(NOW.getTime() - minutesAgo * 60_000).toISOString();
const SHOTS = '.shots/partida-jurnal';
mkdirSync(SHOTS, { recursive: true });

const LIVE = { documentId: 'e2e-j-live', clientId: 'e2e-jc-live' };
const ENDED = { documentId: 'e2e-j-ended', clientId: 'e2e-jc-ended' };
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

const ROD_COLOR = { 1: '#6366F1', 2: '#F97316' } as const;
const rod = (index: 1 | 2) => ({ clientId: `rod-${index}`, index, label: `L${index}`, color: ROD_COLOR[index], bait: 'Boilies', lane: 'center' as const, distance: 60, runtimePhase: 'idle' as const });

/** The register the tests read (newest first: ev-6 … ev-1). */
const CATCHES: FakeCatchDoc[] = [
  { clientId: 'ev-1', outcome: 'capture', occurredAt: at(160), rodIndex: 1, rodColor: ROD_COLOR[1], weightKg: 2.4, species: 'Crap', lane: 'center', distance: 60, bait: 'Boilies', lat: 44.4323, lng: 26.1236 },
  { clientId: 'ev-2', outcome: 'capture', occurredAt: at(130), rodIndex: 2, rodColor: ROD_COLOR[2], weightKg: 8.69, weightEstimated: true, species: 'Somn', photoUrl: 'https://e2e-photos.invalid/somn.png', lat: 44.4318, lng: 26.123 },
  { clientId: 'ev-3', outcome: 'lost', occurredAt: at(100), rodIndex: 1, rodColor: ROD_COLOR[1], lane: 'left', distance: 40, bait: 'Porumb', lat: 44.4325, lng: 26.124 },
  { clientId: 'ev-4', outcome: 'blank', occurredAt: at(70), rodIndex: 2, rodColor: ROD_COLOR[2], lat: 44.432, lng: 26.1232 },
  { clientId: 'ev-5', outcome: 'capture', occurredAt: at(40), rodIndex: null, weightKg: null, species: 'Caras', notes: 'lângă stuf' },
  { clientId: 'ev-6', outcome: 'capture', occurredAt: at(20), rodIndex: 1, rodColor: ROD_COLOR[1], weightKg: 1.25, species: 'Crap' },
];

const member = (uid: string, name: string) => ({ uid, name, avatar: null, joinedAt: at(170) });

function liveDoc(patch: Partial<FakeLiveDoc> = {}): FakeLiveDoc {
  return {
    startedAt: at(180),
    endedAt: null,
    status: 'active',
    venueType: 'lake',
    lakeId: 'e2e-lake-1',
    lakeName: 'Balta Mock',
    standName: '7',
    locality: 'Giurgiu',
    anchorLat: ANCHOR.lat,
    anchorLong: ANCHOR.lng,
    hostUid: selfId,
    joinCode: 'K7M2QX',
    visibleOnProfile: true,
    members: [member(selfId, 'Eu Pescar')],
    rods: [rod(1), rod(2)],
    catches: CATCHES,
    markers: [],
    rev: 3,
    ...patch,
  };
}

/** `n` captures, one a minute (the paging tests). */
const many = (n: number): FakeCatchDoc[] =>
  Array.from({ length: n }, (_, i) => ({ clientId: `m-${i + 1}`, outcome: 'capture' as const, occurredAt: at(n - i), rodIndex: (i % 2) + 1, rodColor: ROD_COLOR[((i % 2) + 1) as 1 | 2], weightKg: 1 + i / 100, species: `Pește ${i + 1}` }));

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

type Calls = { deletes: string[] };

/**
 * The CMS as the tab sees it: the pointer (live) or the own list + detail (ended), and the catch
 * DELETE (`deleteAnswer`: status and an optional delay).
 */
async function mockCms(page: Page, { live = true, deleteAnswer = { status: 200, delayMs: 0 } }: { live?: boolean; deleteAnswer?: { status: number; delayMs?: number } } = {}): Promise<Calls> {
  const calls: Calls = { deletes: [] };
  await page.route('https://e2e-photos.invalid/**', r => r.fulfill({ status: 404 }));
  await page.route(/tiles\.openfreemap\.org|arcgisonline\.com/, r => r.abort());
  await page.route(/\/feed\/community\/sessions\/e2e-/, r => json(r, { error: { status: 404 } }, 404));
  await page.route('**/api/cms/feed/session-follows/mine', r => json(r, { data: { sessionDocumentIds: [] } }));
  await page.route('**/api/cms/feed/sessions/active', r => json(r, { data: live ? { ...LIVE, firestoreId: LIVE.clientId } : null }));
  const ended = {
    documentId: ENDED.documentId,
    clientId: ENDED.clientId,
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
    anchorLat: ANCHOR.lat,
    anchorLong: ANCHOR.lng,
    anchorName: null,
    startedAt: at(26 * 60),
    endedAt: at(20 * 60),
    plannedDurationMs: null,
    notes: null,
    visibleOnProfile: true,
    status: 'finished',
    targetSpecies: [],
    hostUid: selfId,
  };
  await page.route(/\/api\/cms\/feed\/sessions\/mine(\?.*)?$/, r => json(r, { data: live ? [] : [{ ...ended, captures: 2, recordKg: 5.1, totalKg: 7.3 }], meta: { page: 1, pageSize: 100, total: 1 } }));
  await page.route(/\/api\/cms\/feed\/sessions\/e2e-j-ended$/, r =>
    json(r, {
      data: {
        ...ended,
        joinCode: null,
        rods: [],
        members: [member(selfId, 'Eu Pescar')],
        events: [
          { id: 1, documentId: 'evd-1', clientId: 'h-1', clientUpdatedAt: null, outcome: 'capture', rodIndex: null, rodLabel: null, rodColor: null, bait: null, baitType: null, baitSize: null, baitFlavor: null, lane: null, distance: null, lat: 44.4322, lng: 26.1235, weightKg: 5.1, weightEstimated: false, species: 'Crap', speciesId: null, photoUrl: null, photoThumbUrl: null, notes: null, occurredAt: at(22 * 60), photoTagUids: [] },
          { id: 2, documentId: 'evd-2', clientId: 'h-2', clientUpdatedAt: null, outcome: 'lost', rodIndex: null, rodLabel: null, rodColor: null, bait: null, baitType: null, baitSize: null, baitFlavor: null, lane: null, distance: null, lat: null, lng: null, weightKg: null, weightEstimated: false, species: null, speciesId: null, photoUrl: null, photoThumbUrl: null, notes: null, occurredAt: at(21 * 60), photoTagUids: [] },
        ],
      },
    }),
  );
  await page.route(/\/api\/cms\/feed\/sessions\/e2e-j-live\/events\/by-client\/([^/?]+)$/, async route => {
    if (route.request().method() !== 'DELETE') return route.fallback();
    calls.deletes.push(decodeURIComponent(/by-client\/([^/?]+)$/.exec(route.request().url())![1]));
    if (deleteAnswer.delayMs) await new Promise(r => setTimeout(r, deleteAnswer.delayMs));
    return deleteAnswer.status === 200 ? json(route, { data: { ok: true } }) : json(route, { error: { status: deleteAnswer.status, name: 'Error', message: 'mock' } }, deleteAnswer.status);
  });
  return calls;
}

async function open(page: Page, { width = 375, documentId = LIVE.documentId }: { width?: number; documentId?: string } = {}) {
  await page.setViewportSize({ width, height: 900 });
  await page.clock.install({ time: NOW });
  await page.goto(`/partide/${documentId}?tab=jurnal`);
  await expect(page.getByTestId('jurnal')).toBeVisible();
}

/**
 * Console lines that are the test's own doing, not the page's: the map tiles and the photo host
 * are blocked / 404 on purpose (no network in a test).
 */
const CONSOLE_NOISE = [/Failed to load resource/, /net::ERR_/, /AJAXError|Failed to fetch/];

const rows = (page: Page) => page.getByTestId('jurnal-row');
const rowIds = (page: Page) => rows(page).evaluateAll(els => els.map(e => e.getAttribute('data-client-id')));
const row = (page: Page, id: string) => page.locator(`[data-testid="jurnal-row"][data-client-id="${id}"]`);
const toast = (page: Page, text: string) => page.getByText(text, { exact: true }).filter({ visible: true });
const settle = (page: Page) => page.waitForTimeout(450);
/** A confirmation: a bottom sheet (dialog) on the phone, an alert dialog from 768. */
const surface = (page: Page, name: string) => page.getByRole('alertdialog', { name }).or(page.getByRole('dialog', { name }));
const chip = (page: Page, name: string) => page.getByTestId('jurnal-filters').getByRole('button', { name, exact: true });
/**
 * Adding a marker is off until the CMS projection carries markers (rule 4; Jurnal markersProjected).
 * The fake switches it on so the add flow stays tested — call before open().
 */
const enableMarkerAdd = (page: Page) =>
  page.addInitScript(() => {
    const fake = (window as unknown as { __BLUVI_FAKE_LIVE__?: Record<string, unknown> }).__BLUVI_FAKE_LIVE__;
    if (fake) fake.markersProjected = true;
  });
/** A finger held still on `(x, y)` for `ms`, then lifted (CDP touch: Playwright has no hold). */
async function touchHold(page: Page, x: number, y: number, ms = 800) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  await page.waitForTimeout(ms);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}
const centreOf = async (l: import('@playwright/test').Locator) => {
  const b = (await l.boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};

/* ------------------------------------------------------------------------------------------------
 * c1 c2 c3 — the register
 * ---------------------------------------------------------------------------------------------- */

for (const width of [375, 1280, 1440, 1920] as const) {
  test(`partide.partida-jurnal.c2 c3 at ${width}: newest first, every lead kind, rod pill, meta, photo, time — axe clean`, async ({ page, fakeLive }) => {
    await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc() } });
    await mockCms(page);
    const errors = collectConsoleErrors(page, { ignore: CONSOLE_NOISE });
    await open(page, { width });
    await expect(page.getByRole('tab', { name: /Jurnal/ })).toHaveAttribute('aria-selected', 'true');
    expect(await rowIds(page)).toEqual(['ev-6', 'ev-5', 'ev-4', 'ev-3', 'ev-2', 'ev-1']);
    const visible = (id: string) => ({
      getByText: (t: string | RegExp, o?: { exact?: boolean }) => row(page, id).getByText(t, o).filter({ visible: true }),
    });
    // c3: weight + «ESTIMAT», «SCĂPAT», «FĂRĂ TRĂSĂTURĂ», the glyph (a capture without weight).
    await expect(row(page, 'ev-1')).toContainText('2,4');
    await expect(visible('ev-2').getByText('Estimat', { exact: true })).toBeVisible();
    await expect(visible('ev-2').getByText('8,69', { exact: true })).toBeVisible();
    await expect(visible('ev-3').getByText('Scăpat', { exact: true })).toBeVisible();
    await expect(visible('ev-4').getByText(/Fără\s*trăsătură/i)).toBeVisible();
    // The rod pill, the species, fish's meta line (lane · distance · bait, else the note), the time.
    await expect(visible('ev-1').getByText('L1', { exact: true })).toBeVisible();
    await expect(visible('ev-1').getByText('Crap', { exact: true })).toBeVisible();
    await expect(visible('ev-1').getByText('Centru · 60 m · Boilies')).toBeVisible();
    await expect(visible('ev-5').getByText('lângă stuf')).toBeVisible();
    await expect(visible('ev-1').getByText('12:20', { exact: true })).toBeVisible();
    // The photo thumb only where there is a photo.
    await expect(row(page, 'ev-2').locator('img:visible, [aria-hidden]:visible').first()).toBeVisible();
    await expect(row(page, 'ev-1').locator('img')).toHaveCount(0);
    // The kg unit stands apart from the number (rule 10).
    await expect(visible('ev-1').getByText('kg', { exact: true })).toBeVisible();
    if (width >= 1280) {
      // Rule 14: a timeline with every column named.
      for (const h of ['Ora', 'Lansetă', 'Rezultat', 'Specie', 'Greutate', 'Poză']) await expect(page.getByText(h, { exact: true }).filter({ visible: true })).toBeVisible();
      await expect(visible('ev-1').getByText('Captură', { exact: true })).toBeVisible();
      // Rule 16: compact columns — the weight sits right after the species, never across the screen.
      const sp = (await visible('ev-1').getByText('Crap', { exact: true }).boundingBox())!;
      const kg = (await visible('ev-1').getByText('2,4', { exact: true }).boundingBox())!;
      expect(kg.x - (sp.x + sp.width)).toBeLessThan(400);
      // The meta line is never cut («Stânga · 40 m · Po…»).
      const meta = visible('ev-3').getByText('Stânga · 40 m · Porumb');
      expect(await meta.evaluate(el => el.scrollWidth <= el.clientWidth && el.scrollHeight <= el.clientHeight + 1)).toBe(true);
      if (width >= 1440) {
        // The map is the side panel, not a dialog — open by itself only from 1440 (with something to plot).
        await expect(page.getByTestId('jurnal-map-panel')).toBeVisible();
        // The register keeps its width; the map takes the rest.
        const reg = (await page.getByRole('region', { name: 'Înregistrări' }).boundingBox())!;
        expect(reg.width).toBeLessThanOrEqual(720);
      } else {
        await expect(page.getByTestId('jurnal-map-panel')).toHaveCount(0);
        await expect(page.getByTestId('jurnal-map-button').filter({ visible: true })).toHaveAttribute('aria-expanded', 'false');
      }
    } else {
      await expect(page.getByTestId('jurnal-map-panel')).toHaveCount(0);
    }
    // Never «capot» (rule 11).
    await expect(page.getByText(/capot/i)).toHaveCount(0);
    await settle(page);
    await expectNoA11yViolations(page);
    await page.screenshot({ path: `${SHOTS}/live-${width}.png`, fullPage: true });
    expect(errors).toEqual([]);
  });
}

test('partide.partida-jurnal.c1 chips: outcome and rod toggles combine (multi-select); the rod chip carries the rod colour', async ({ page, fakeLive }) => {
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc() } });
  await mockCms(page);
  await open(page, { width: 375 });
  for (const name of ['Capturi', 'Scăpate', 'Fără trăsătură', 'L1', 'L2']) await expect(chip(page, name)).toHaveAttribute('aria-pressed', 'false');
  await chip(page, 'Capturi').click();
  await expect(chip(page, 'Capturi')).toHaveAttribute('aria-pressed', 'true');
  expect(await rowIds(page)).toEqual(['ev-6', 'ev-5', 'ev-2', 'ev-1']);
  await chip(page, 'Scăpate').click();
  expect(await rowIds(page)).toEqual(['ev-6', 'ev-5', 'ev-3', 'ev-2', 'ev-1']);
  // Outcome ∧ rod: a rod-less event drops out once a rod is chosen.
  await chip(page, 'L1').click();
  expect(await rowIds(page)).toEqual(['ev-6', 'ev-3', 'ev-1']);
  await chip(page, 'L2').click();
  expect(await rowIds(page)).toEqual(['ev-6', 'ev-3', 'ev-2', 'ev-1']);
  // The «on» rod chip is filled with the rod colour.
  await expect(chip(page, 'L2')).toHaveCSS('background-color', 'rgb(249, 115, 22)');
  // Everything off again → the whole register.
  for (const name of ['Capturi', 'Scăpate', 'L1', 'L2']) await chip(page, name).click();
  await expect(rows(page)).toHaveCount(6);
  await page.screenshot({ path: `${SHOTS}/filters-375.png`, fullPage: true });
});

test('partide.partida-jurnal.c1 c2 30 rows at a time: scrolling (or «Arată mai multe») grows the window; a filter change resets it', async ({ page, fakeLive }) => {
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc({ catches: many(75) }) } });
  await mockCms(page);
  await open(page, { width: 1280 });
  await expect(rows(page)).toHaveCount(30);
  expect((await rowIds(page))[0]).toBe('m-75');
  // The end of the list comes into view → 30 more.
  await page.getByRole('button', { name: 'Arată mai multe' }).scrollIntoViewIfNeeded();
  await expect(rows(page)).toHaveCount(60);
  await page.getByRole('button', { name: 'Arată mai multe' }).click();
  await expect(rows(page)).toHaveCount(75);
  await expect(page.getByRole('button', { name: 'Arată mai multe' })).toHaveCount(0);
  // A filter change is a new data set: back to the first page.
  await page.evaluate(() => window.scrollTo(0, 0));
  await chip(page, 'L1').click();
  await expect(page.getByTestId('jurnal')).toHaveAttribute('data-count', '38');
  await expect(rows(page)).toHaveCount(30);
});

/* ------------------------------------------------------------------------------------------------
 * c4 c5 — the share dialog
 * ---------------------------------------------------------------------------------------------- */

test('partide.partida-jurnal.c4 c5 a capture opens «Distribuie captura» (card, switches, Distribuie), with «Editează captura» → the capture flow in edit mode', async ({ page, fakeLive }) => {
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc() } });
  await mockCms(page);
  await open(page, { width: 375 });
  // No system file share here: the PNG is saved and the toast says so.
  await page.evaluate(() => Object.defineProperty(navigator, 'canShare', { value: () => false, configurable: true }));
  await row(page, 'ev-1').getByRole('button').click();
  const dialog = page.getByRole('dialog', { name: 'Distribuie captura' });
  await expect(dialog).toBeVisible();
  for (const s of ['Greutate', 'Baltă', 'Specie', 'Data']) await expect(dialog.getByRole('button', { name: s })).toHaveAttribute('aria-pressed', 'true');
  await dialog.getByRole('button', { name: 'Baltă' }).click();
  await expect(dialog.getByRole('button', { name: 'Baltă' })).toHaveAttribute('aria-pressed', 'false');
  await expect(dialog.getByRole('img', { name: /Imaginea care se distribuie/ })).not.toContainText('Balta Mock');
  await expect(dialog.getByRole('button', { name: 'Distribuie', exact: true })).toBeEnabled();
  await expect(dialog.getByRole('button', { name: 'Editează captura' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Șterge captura' })).toBeVisible();
  const download = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Distribuie', exact: true }).click();
  expect((await download).suggestedFilename()).toMatch(/\.png$/);
  await expect(toast(page, 'Imaginea a fost salvată.')).toBeVisible();
  await settle(page);
  await expectNoA11yViolations(page);
  await page.screenshot({ path: `${SHOTS}/share-capture-375.png` });
  await dialog.getByRole('button', { name: 'Editează captura' }).click();
  await expect(page).toHaveURL(new RegExp(`/partide/${LIVE.documentId}/captura\\?editare=ev-1$`));
});

test('partide.partida-jurnal.c4 a scăpat / fără trăsătură opens its record («Scăpat», «Fără trăsătură»): no card, no edit — delete only', async ({ page, fakeLive }) => {
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc() } });
  await mockCms(page);
  await open(page, { width: 1280 });
  await row(page, 'ev-3').getByRole('button').click();
  const lost = page.getByRole('dialog', { name: 'Scăpat' });
  await expect(lost).toBeVisible();
  await expect(lost.getByTestId('share-catch-record')).toContainText('Stânga · 40 m · Porumb');
  await expect(lost.getByTestId('share-catch-record')).toContainText('Balta Mock');
  await expect(lost.getByRole('button', { name: 'Distribuie', exact: true })).toHaveCount(0);
  await expect(lost.getByRole('button', { name: 'Editează captura' })).toHaveCount(0);
  await expect(lost.getByRole('button', { name: 'Șterge', exact: true })).toBeVisible();
  await settle(page);
  await expectNoA11yViolations(page);
  await page.screenshot({ path: `${SHOTS}/share-lost-1280.png` });
  await page.keyboard.press('Escape');
  await row(page, 'ev-4').getByRole('button').click();
  await expect(page.getByRole('dialog', { name: 'Fără trăsătură' })).toBeVisible();
});

test('partide.partida-jurnal.c4 c6 c8 an ended partidă: the share dialog has no edit / delete, no long-press delete, no «Captură», the map has no add', async ({ page, fakeLive }) => {
  await fakeLive.seed({ docs: {} });
  await mockCms(page, { live: false });
  await open(page, { width: 375, documentId: ENDED.documentId });
  expect(await rowIds(page)).toEqual(['h-2', 'h-1']);
  await expect(page.getByRole('button', { name: 'Captură', exact: true })).toHaveCount(0);
  await expect(page.getByTestId('jurnal-map-button').filter({ visible: true })).toBeVisible();
  await row(page, 'h-1').getByRole('button').click({ button: 'right' });
  await expect(surface(page, 'Ștergi această înregistrare?')).toHaveCount(0);
  await row(page, 'h-1').getByRole('button').click();
  const dialog = page.getByRole('dialog', { name: 'Distribuie captura' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Editează captura' })).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Șterge captura' })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await row(page, 'h-2').getByRole('button').click();
  await expect(page.getByRole('dialog', { name: 'Scăpat' }).getByRole('button', { name: 'Șterge' })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.getByTestId('jurnal-map-button').filter({ visible: true }).click();
  await expect(page.getByTestId('partida-map')).toHaveAttribute('data-captures', '1');
  await expect(page.getByRole('button', { name: 'Adaugă reper' })).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/ended-map-375.png` });
});

/* ------------------------------------------------------------------------------------------------
 * c6 — delete
 * ---------------------------------------------------------------------------------------------- */

test('partide.partida-jurnal.c6 delete from the dialog: «Ștergi această înregistrare?» → DELETE by clientId, the row dims with «Ștergem captura…» until the projection drops it', async ({ page, fakeLive }) => {
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc() } });
  const calls = await mockCms(page, { deleteAnswer: { status: 200, delayMs: 800 } });
  await open(page, { width: 375 });
  await row(page, 'ev-6').getByRole('button').click();
  await page.getByRole('dialog', { name: 'Distribuie captura' }).getByRole('button', { name: 'Șterge captura' }).click();
  const confirm = surface(page, 'Ștergi această înregistrare?');
  await expect(confirm).toBeVisible();
  // «Închide» keeps everything.
  await confirm.getByRole('button', { name: 'Închide' }).click();
  await expect(confirm).toBeHidden();
  expect(calls.deletes).toEqual([]);
  // The long-press shortcut (a right-click on the web) asks the same.
  await row(page, 'ev-6').getByRole('button').click({ button: 'right' });
  await expect(confirm).toBeVisible();
  await settle(page);
  await expectNoA11yViolations(page);
  await page.getByTestId('jurnal-delete-confirm').click();
  await expect(row(page, 'ev-6')).toHaveAttribute('data-pending', 'true');
  await expect(page.getByText('Ștergem captura…')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/deleting-375.png` });
  await expect.poll(() => calls.deletes).toEqual(['ev-6']);
  // Still pending after the 200 — until the projection drops it.
  await expect(row(page, 'ev-6')).toHaveAttribute('data-pending', 'true');
  await fakeLive.push(LIVE.clientId, liveDoc({ catches: CATCHES.filter(c => c.clientId !== 'ev-6'), rev: 4 }));
  await expect(row(page, 'ev-6')).toHaveCount(0);
  await expect(page.getByText('Ștergem captura…')).toHaveCount(0);
  await expect(page.getByRole('tab', { name: /Jurnal/ })).toContainText('5');
});

test('partide.partida-jurnal.c6 a failed delete: «Nu am putut șterge captura. Încearcă din nou.», the row comes back; Delete on a focused row asks too', async ({ page, fakeLive }) => {
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc() } });
  const calls = await mockCms(page, { deleteAnswer: { status: 400 } });
  await open(page, { width: 1280 });
  await row(page, 'ev-5').getByRole('button').focus();
  await page.keyboard.press('Delete');
  await page.getByTestId('jurnal-delete-confirm').click();
  await expect(toast(page, 'Nu am putut șterge captura. Încearcă din nou.')).toBeVisible();
  expect(calls.deletes).toEqual(['ev-5']);
  await expect(row(page, 'ev-5')).not.toHaveAttribute('data-pending', 'true');
  await expect(page.getByText('Ștergem captura…')).toHaveCount(0);
});

test('partide.partida-jurnal.c6 c8 c10 offline: delete, «Captură» and a new marker are refused at once with «Fără conexiune. Reconectare…»', async ({ page, context, fakeLive }) => {
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc() } });
  await enableMarkerAdd(page);
  const calls = await mockCms(page);
  await open(page, { width: 375 });
  // The map is open (its code loaded) before the connection drops.
  await page.getByTestId('jurnal-map-button').filter({ visible: true }).click();
  await expect(page.getByTestId('partida-map')).toHaveAttribute('data-state', 'ready');
  await page.getByRole('button', { name: 'Închide harta' }).click();
  await context.setOffline(true);
  // c8: «Captură» dimmed.
  const captura = page.getByRole('button', { name: 'Captură', exact: true }).filter({ visible: true });
  await expect(captura).toHaveAttribute('aria-disabled', 'true');
  await captura.click({ force: true });
  await expect(toast(page, 'Fără conexiune. Reconectare…')).toBeVisible();
  await expect(page).toHaveURL(/\?tab=jurnal$/);
  // c6
  await row(page, 'ev-6').getByRole('button').click({ button: 'right' });
  await page.getByTestId('jurnal-delete-confirm').click();
  await expect(row(page, 'ev-6')).not.toHaveAttribute('data-pending', 'true');
  expect(calls.deletes).toEqual([]);
  // c10
  await page.getByTestId('jurnal-map-button').filter({ visible: true }).click();
  await page.getByRole('button', { name: 'Adaugă reper' }).click();
  await expect(toast(page, 'Fără conexiune. Reconectare…').first()).toBeVisible();
  await expect(surface(page, 'Adaugă un reper')).toHaveCount(0);
  expect(await fakeLive.markerWrites()).toEqual([]);
  await context.setOffline(false);
});

/* ------------------------------------------------------------------------------------------------
 * c7 — empty
 * ---------------------------------------------------------------------------------------------- */

for (const width of [375, 1280, 1440, 1920] as const) {
  test(`partide.partida-jurnal.c7 at ${width}: no events → «Liniște pe baltă… deocamdată»; filtered to zero → «Niciun rezultat pentru filtrele alese»`, async ({ page, fakeLive }) => {
    await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc({ catches: [] }) } });
    await mockCms(page);
    await open(page, { width });
    await expect(page.getByTestId('jurnal-empty')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Liniște pe baltă… deocamdată' })).toBeVisible();
    await expect(page.getByText('Tot ce se întâmplă la partidă se strânge aici — capturi, scăpate și trăsături, în ordinea în care le trăiești.')).toBeVisible();
    // Rule 4: nothing to plot → no empty map beside the empty state («Hartă» still opens it).
    await expect(page.getByTestId('jurnal-map-panel')).toHaveCount(0);
    await settle(page);
    await expectNoA11yViolations(page);
    await page.screenshot({ path: `${SHOTS}/empty-${width}.png`, fullPage: true });
    await fakeLive.push(LIVE.clientId, liveDoc({ catches: CATCHES.filter(c => c.outcome === 'capture') }));
    await expect(rows(page)).toHaveCount(4);
    await chip(page, 'Fără trăsătură').click();
    await expect(page.getByText('Niciun rezultat pentru filtrele alese')).toBeVisible();
    await expect(page.getByTestId('jurnal-empty')).toHaveCount(0);
    await page.screenshot({ path: `${SHOTS}/filtered-empty-${width}.png`, fullPage: true });
  });
}

/* ------------------------------------------------------------------------------------------------
 * c8 — Captură / Hartă
 * ---------------------------------------------------------------------------------------------- */

test('partide.partida-jurnal.c8 phone: floating «Captură» (dark) + «Hartă» at the bottom; «Captură» opens the free capture', async ({ page, fakeLive }) => {
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc({ catches: many(40) }) } });
  await mockCms(page);
  await open(page, { width: 375 });
  const captura = page.getByRole('button', { name: 'Captură', exact: true }).filter({ visible: true });
  const harta = page.getByTestId('jurnal-map-button').filter({ visible: true });
  await expect(captura).toHaveCount(1);
  await expect(harta).toHaveCount(1);
  // Floating at the screen's bottom edge while the register is in view (sticky, never over the summary).
  const box = (await captura.boundingBox())!;
  expect(box.y + box.height).toBeGreaterThan(900 - 80);
  await page.mouse.wheel(0, 1200);
  await expect.poll(async () => {
    const b = (await captura.boundingBox())!;
    return b.y + b.height;
  }).toBeGreaterThan(900 - 80);
  await page.screenshot({ path: `${SHOTS}/floating-375.png` });
  await captura.click();
  await expect(page).toHaveURL(new RegExp(`/partide/${LIVE.documentId}/captura$`));
});

/* ------------------------------------------------------------------------------------------------
 * c9 c10 — the map and its markers
 * ---------------------------------------------------------------------------------------------- */

const MARKERS = [
  { clientId: 'mk-1', type: 'hardSpot', lat: 44.4324, lng: 26.1238, label: null, scope: 'anchor', venueType: 'lake', clientUpdatedAt: at(50) },
  { clientId: 'mk-2', type: 'snag', lat: 44.4317, lng: 26.1229, label: null, scope: 'anchor', venueType: 'lake', clientUpdatedAt: at(45) },
];

test('partide.partida-jurnal.c9 phone «Hartă»: a full map on the anchor with the filtered non-blank located events and the venue markers (legend), Pini / Heatmap', async ({ page, fakeLive }) => {
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc({ markers: MARKERS }) } });
  await mockCms(page);
  const errors = collectConsoleErrors(page, { ignore: CONSOLE_NOISE });
  await open(page, { width: 375 });
  await page.getByTestId('jurnal-map-button').filter({ visible: true }).click();
  const dialog = page.getByTestId('partida-map-dialog');
  await expect(dialog).toBeVisible();
  const map = dialog.getByTestId('partida-map');
  await expect(map).toHaveAttribute('data-state', 'ready');
  // ev-1, ev-2, ev-3 (ev-4 is blank, ev-5/ev-6 have no coordinates).
  await expect(map).toHaveAttribute('data-captures', '3');
  await expect(dialog.getByTestId('partida-map-catch')).toHaveCount(3);
  await expect(dialog.getByTestId('partida-map-marker')).toHaveCount(2);
  await expect(dialog.getByTestId('partida-map-legend')).toContainText('Zonă tare');
  await expect(dialog.getByTestId('partida-map-legend')).toContainText('Capturi');
  await dialog.getByRole('button', { name: 'Heatmap' }).click();
  await expect(dialog.getByTestId('partida-map-heat')).toHaveCount(3);
  await expect(dialog.getByTestId('partida-map-catch')).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Pini' }).click();
  await settle(page);
  await page.screenshot({ path: `${SHOTS}/map-375.png` });
  await expectNoA11yViolations(page, { exclude: ['.maplibregl-canvas-container'] });
  await dialog.getByRole('button', { name: 'Închide harta' }).click();
  await expect(dialog).toBeHidden();
  // The map follows the filters: only «Scăpate» → one event on it.
  await chip(page, 'Scăpate').click();
  await page.getByTestId('jurnal-map-button').filter({ visible: true }).click();
  await expect(page.getByTestId('partida-map')).toHaveAttribute('data-captures', '1');
  expect(errors).toEqual([]);
});

test('partide.partida-jurnal.c10 adding is off while the CMS projection carries no markers (rule 4): no right-click / long-press sheet, no «Adaugă reper», no hint, nothing written', async ({ page, fakeLive }) => {
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc() } });
  await mockCms(page);
  await open(page, { width: 1440 });
  const panel = page.getByTestId('jurnal-map-panel');
  await expect(panel.getByTestId('partida-map')).toHaveAttribute('data-state', 'ready');
  await panel.locator('.maplibregl-canvas').click({ button: 'right', position: { x: 60, y: 60 } });
  await settle(page);
  await expect(surface(page, 'Adaugă un reper')).toHaveCount(0);
  await expect(panel.getByRole('button', { name: 'Adaugă reper' })).toHaveCount(0);
  await expect(panel.getByText(/ca să pui un reper/)).toHaveCount(0);
  expect(await fakeLive.markerWrites()).toEqual([]);
});

test('partide.partida-jurnal.c10 add a marker: right-click → «Adaugă un reper» / «Ce ai găsit aici?» → «Zonă tare» (anchor scope) — written to the fake, never to Firebase; keyboard «Adaugă reper» at the centre → «Pat nadă» (session scope)', async ({ page, fakeLive }) => {
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc() } });
  await enableMarkerAdd(page);
  await mockCms(page);
  await open(page, { width: 1440 });
  const panel = page.getByTestId('jurnal-map-panel');
  await expect(panel.getByTestId('partida-map')).toHaveAttribute('data-state', 'ready');
  await panel.locator('.maplibregl-canvas').click({ button: 'right', position: { x: 60, y: 60 } });
  const ask = surface(page, 'Adaugă un reper');
  await expect(ask).toBeVisible();
  await expect(ask.getByText('Ce ai găsit aici?')).toBeVisible();
  for (const b of ['Zonă tare', 'Pat nadă', 'Agățătură', 'Anulează']) await expect(ask.getByRole('button', { name: b })).toBeVisible();
  await settle(page);
  await expectNoA11yViolations(page, { exclude: ['.maplibregl-canvas-container'] });
  await page.screenshot({ path: `${SHOTS}/add-marker-1440.png` });
  await ask.getByRole('button', { name: 'Anulează' }).click();
  await expect(ask).toBeHidden();
  expect(await fakeLive.markerWrites()).toEqual([]);
  await panel.locator('.maplibregl-canvas').click({ button: 'right', position: { x: 60, y: 60 } });
  await ask.getByRole('button', { name: 'Zonă tare' }).click();
  await expect.poll(() => fakeLive.markerWrites()).toHaveLength(1);
  const [first] = await fakeLive.markerWrites();
  expect(first).toMatchObject({ op: 'set', sessionId: LIVE.clientId, data: { type: 'hardSpot', scope: 'anchor', venueType: 'lake', label: null } });
  // Up and left of the anchor (the panel's top-left corner).
  expect(first.data!.lat as number).toBeGreaterThan(ANCHOR.lat);
  expect(first.data!.lng as number).toBeLessThan(ANCHOR.lng);
  // The keyboard path: the centre cross.
  await panel.getByRole('button', { name: 'Adaugă reper' }).focus();
  await page.keyboard.press('Enter');
  await ask.getByRole('button', { name: 'Pat nadă' }).click();
  await expect.poll(() => fakeLive.markerWrites()).toHaveLength(2);
  const second = (await fakeLive.markerWrites())[1];
  expect(second).toMatchObject({ op: 'set', sessionId: LIVE.clientId, data: { type: 'baited', scope: 'session' } });
  expect(Math.abs((second.data!.lat as number) - ANCHOR.lat)).toBeLessThan(0.0005);
  expect(Math.abs((second.data!.lng as number) - ANCHOR.lng)).toBeLessThan(0.0005);
  // No marker shows up by itself: the CMS projection carries none (fish parks them) — see c10 delete.
  await expect(panel.getByTestId('partida-map-marker')).toHaveCount(0);
});

test('partide.partida-jurnal.c10 a marker asks «Ștergi reperul?» → «Șterge» deletes it (the fake records it); «Închide» keeps it', async ({ page, fakeLive }) => {
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc({ markers: MARKERS }) } });
  await mockCms(page);
  await open(page, { width: 375 });
  await page.getByTestId('jurnal-map-button').filter({ visible: true }).click();
  const dialog = page.getByTestId('partida-map-dialog');
  await expect(dialog.getByTestId('partida-map-marker')).toHaveCount(2);
  await dialog.getByRole('button', { name: 'Agățătură — șterge reperul' }).click();
  const ask = surface(page, 'Ștergi reperul?');
  await expect(ask).toBeVisible();
  await ask.getByRole('button', { name: 'Închide' }).click();
  expect(await fakeLive.markerWrites()).toEqual([]);
  await dialog.getByRole('button', { name: 'Agățătură — șterge reperul' }).click();
  await ask.getByRole('button', { name: 'Șterge' }).click();
  await expect.poll(() => fakeLive.markerWrites()).toEqual([{ op: 'delete', sessionId: LIVE.clientId, clientId: 'mk-2' }]);
});

test('partide.partida-jurnal.c9 from 1280 the map is a side panel beside the timeline: closed at 1280 (the timeline keeps its room), open from 1440; «Hartă» closes / reopens it', async ({ page, fakeLive }) => {
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc({ markers: MARKERS }) } });
  await mockCms(page);
  await open(page, { width: 1280 });
  await expect(page.getByTestId('jurnal-map-panel')).toHaveCount(0);
  await page.getByTestId('jurnal-map-button').filter({ visible: true }).click();
  await expect(page.getByTestId('jurnal-map-panel')).toBeVisible();
  await expect(page.getByTestId('partida-map-dialog')).toBeHidden();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.reload();
  await expect(page.getByTestId('jurnal')).toBeVisible();
  const panel = page.getByTestId('jurnal-map-panel');
  await expect(panel).toBeVisible();
  await expect(panel.getByTestId('partida-map')).toHaveAttribute('data-captures', '3');
  const harta = page.getByTestId('jurnal-map-button').filter({ visible: true });
  await expect(harta).toHaveAttribute('aria-expanded', 'true');
  await harta.click();
  await expect(panel).toHaveCount(0);
  await expect(page.getByTestId('partida-map-dialog')).toBeHidden();
  await harta.click();
  await expect(page.getByTestId('jurnal-map-panel')).toBeVisible();
});

/* ------------------------------------------------------------------------------------------------
 * The phone's touch paths: a held finger (fish's long-press) on the map and on a row
 * ---------------------------------------------------------------------------------------------- */

test.describe('touch (375, hasTouch)', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 375, height: 900 } });

  test('partide.partida-jurnal.c10 phone: a finger held on the map opens «Adaugă un reper» ABOVE the map dialog, it survives the lift; «Agățătură» is written to the fake', async ({ page, fakeLive }) => {
    await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc() } });
    await enableMarkerAdd(page);
    await mockCms(page);
    await open(page, { width: 375 });
    await page.getByTestId('jurnal-map-button').filter({ visible: true }).tap();
    const dialog = page.getByTestId('partida-map-dialog');
    await expect(dialog.getByTestId('partida-map')).toHaveAttribute('data-state', 'ready');
    await expect(dialog.getByText('Ține apăsat ca să pui un reper')).toBeVisible();
    const canvas = dialog.locator('.maplibregl-canvas');
    const c = await centreOf(canvas);
    await touchHold(page, c.x - 60, c.y - 80);
    const ask = surface(page, 'Adaugă un reper');
    await expect(ask).toBeVisible();
    // Still open after the lift (no ghost click dismissing it), and on top: its button takes the tap.
    await settle(page);
    await expect(ask).toBeVisible();
    const snag = ask.getByRole('button', { name: 'Agățătură' });
    const at = await centreOf(snag);
    expect(await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest('button')?.textContent ?? '', [at.x, at.y])).toContain('Agățătură');
    await page.screenshot({ path: `${SHOTS}/add-marker-touch-375.png` });
    await snag.tap();
    await expect.poll(() => fakeLive.markerWrites()).toHaveLength(1);
    const [w] = await fakeLive.markerWrites();
    expect(w).toMatchObject({ op: 'set', sessionId: LIVE.clientId, data: { type: 'snag', scope: 'anchor' } });
    await expect(ask).toBeHidden();
    await expect(dialog).toBeVisible();
  });

  test('partide.partida-jurnal.c10 phone: without the projection a held finger on the map opens nothing and writes nothing', async ({ page, fakeLive }) => {
    await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc() } });
    await mockCms(page);
    await open(page, { width: 375 });
    await page.getByTestId('jurnal-map-button').filter({ visible: true }).tap();
    const dialog = page.getByTestId('partida-map-dialog');
    await expect(dialog.getByTestId('partida-map')).toHaveAttribute('data-state', 'ready');
    const c = await centreOf(dialog.locator('.maplibregl-canvas'));
    await touchHold(page, c.x, c.y);
    await settle(page);
    await expect(surface(page, 'Adaugă un reper')).toHaveCount(0);
    expect(await fakeLive.markerWrites()).toEqual([]);
  });

  test('partide.partida-jurnal.c6 phone: a finger held on a row asks «Ștergi această înregistrare?» (no share dialog after the lift) → DELETE', async ({ page, fakeLive }) => {
    await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc() } });
    const calls = await mockCms(page);
    await open(page, { width: 375 });
    const c = await centreOf(row(page, 'ev-6').getByRole('button'));
    await touchHold(page, c.x, c.y);
    const confirm = surface(page, 'Ștergi această înregistrare?');
    await expect(confirm).toBeVisible();
    await settle(page);
    await expect(confirm).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Distribuie captura' })).toHaveCount(0);
    await page.getByTestId('jurnal-delete-confirm').tap();
    await expect.poll(() => calls.deletes).toEqual(['ev-6']);
  });
});
