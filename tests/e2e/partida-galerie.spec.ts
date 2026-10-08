import { mkdirSync, readFileSync } from 'node:fs';
import type { Page, Route } from '@playwright/test';
import { expectNoA11yViolations } from './helpers/a11y';
import { collectConsoleErrors } from './helpers/console';
import { expect, test, type FakeCatchDoc, type FakeLiveDoc } from './helpers/fake-live';
import { CMS, qaJwt, signIn } from './helpers/session';

/*
 * partide.partida-galerie — the member view's «Galerie» tab (/partide/[id]?tab=galerie; fish
 * features/partide/scenes/GalerieScene.tsx, MasonryGallery, gifExport, ImageLightbox +
 * CatchLightboxFooter).
 *
 * NOTHING reaches Firestore or writes to a CMS: the live partidă is the shared Firestore fake
 * (helpers/fake-live.ts — the fixture fails the test on any request to a Firebase host), the CMS
 * reads are route-mocked, the tab makes no write. The photos are same-origin SVGs served by the
 * test (route-fulfilled), so the GIF canvas can read them. The system share sheet is stubbed
 * (navigator.canShare / share) or absent (the download path). The tab ships for real (lib/
 * partide-pages partidaGalerie): no `allTabs`.
 */

test.use({ timezoneId: 'Europe/Bucharest', locale: 'ro-RO' });

const NOW = new Date('2026-10-07T12:00:00.000Z'); // 15:00 in Bucharest
const at = (minutesAgo: number) => new Date(NOW.getTime() - minutesAgo * 60_000).toISOString();
const SHOTS = '.shots/partida-galerie';
mkdirSync(SHOTS, { recursive: true });

const LIVE = { documentId: 'e2e-g-live', clientId: 'e2e-gc-live' };
const ENDED = { documentId: 'e2e-g-ended', clientId: 'e2e-gc-ended' };
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

/** A same-origin photo of `w`×`h` in `fill` (served by photoRoutes). */
const photo = (name: string) => `/__e2e-galerie/${name}.svg`;
const PHOTOS: Record<string, { w: number; h: number; fill: string }> = {
  p1: { w: 1200, h: 900, fill: '#2F6F4F' },
  p2: { w: 900, h: 1200, fill: '#3B5BA5' },
  p3: { w: 1000, h: 1000, fill: '#A5683B' },
  p4: { w: 1600, h: 900, fill: '#6A3BA5' },
  p5: { w: 800, h: 1000, fill: '#A53B5B' },
};

/** Five photo catches (p1 oldest … p5 newest) among events without a photo. */
const FIVE: FakeCatchDoc[] = [
  { clientId: 'g-1', outcome: 'capture', occurredAt: at(200), rodIndex: 1, weightKg: 2.4, species: 'Crap', photoUrl: photo('p1') },
  { clientId: 'n-1', outcome: 'capture', occurredAt: at(190), rodIndex: 1, weightKg: 4.1, species: 'Crap' },
  { clientId: 'g-2', outcome: 'capture', occurredAt: at(160), rodIndex: 2, weightKg: 8.69, species: 'Somn', photoUrl: photo('p2') },
  { clientId: 'n-2', outcome: 'lost', occurredAt: at(150), rodIndex: 2, photoUrl: photo('p1') },
  { clientId: 'g-3', outcome: 'capture', occurredAt: at(120), rodIndex: null, weightKg: null, species: 'Caras', photoUrl: photo('p3') },
  { clientId: 'n-3', outcome: 'blank', occurredAt: at(100), rodIndex: 1 },
  { clientId: 'g-4', outcome: 'capture', occurredAt: at(60), rodIndex: 1, weightKg: 12.345, species: null, photoUrl: photo('p4') },
  { clientId: 'g-5', outcome: 'capture', occurredAt: at(20), rodIndex: 2, weightKg: 1.25, species: 'Plătică', photoUrl: photo('p5') },
];
const NO_PHOTO: FakeCatchDoc[] = FIVE.filter(c => !c.clientId.startsWith('g-'));
const ONE: FakeCatchDoc[] = [...NO_PHOTO, FIVE[0]];

const member = (uid: string, name: string) => ({ uid, name, avatar: null, joinedAt: at(170) });

function liveDoc(catches: FakeCatchDoc[]): FakeLiveDoc {
  return {
    startedAt: at(240),
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
    rods: [],
    catches,
    markers: [],
    rev: 3,
  };
}

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

/** The test's photos: same-origin SVGs (`delayMs` slows each, so the GIF progress is observable). */
async function photoRoutes(page: Page, { delayMs = 0 }: { delayMs?: number } = {}) {
  await page.route('**/__e2e-galerie/*.svg', async route => {
    const name = /\/([^/]+)\.svg/.exec(route.request().url())![1];
    const p = PHOTOS[name];
    if (!p) return route.fulfill({ status: 404 });
    if (delayMs) await new Promise(r => setTimeout(r, delayMs));
    return route.fulfill({
      status: 200,
      contentType: 'image/svg+xml',
      headers: { 'cache-control': 'no-store' },
      body: `<svg xmlns="http://www.w3.org/2000/svg" width="${p.w}" height="${p.h}" viewBox="0 0 ${p.w} ${p.h}"><rect width="100%" height="100%" fill="${p.fill}"/><circle cx="${p.w / 2}" cy="${p.h / 2}" r="${Math.min(p.w, p.h) / 4}" fill="#F2C94C"/></svg>`,
    });
  });
}

/** The CMS as the tab sees it: the pointer (live) or the own list + detail (ended). */
async function mockCms(page: Page, { live = true }: { live?: boolean } = {}) {
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
  const event = (id: number, p: Record<string, unknown>) => ({
    id,
    documentId: `evd-${id}`,
    clientId: `h-${id}`,
    clientUpdatedAt: null,
    outcome: 'capture',
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
    occurredAt: at(22 * 60),
    photoTagUids: [],
    ...p,
  });
  await page.route(/\/api\/cms\/feed\/sessions\/mine(\?.*)?$/, r => json(r, { data: live ? [] : [{ ...ended, captures: 3, recordKg: 5.1, totalKg: 9.3 }], meta: { page: 1, pageSize: 100, total: 1 } }));
  await page.route(/\/api\/cms\/feed\/sessions\/e2e-g-ended$/, r =>
    json(r, {
      data: {
        ...ended,
        joinCode: null,
        rods: [],
        members: [member(selfId, 'Eu Pescar')],
        events: [
          event(1, { weightKg: 5.1, species: 'Crap', photoUrl: photo('p1'), photoThumbUrl: photo('p1'), occurredAt: at(23 * 60) }),
          event(2, { weightKg: 4.2, species: 'Somn', photoUrl: photo('p2'), occurredAt: at(22 * 60) }),
          event(3, { weightKg: 1, species: 'Caras', occurredAt: at(21 * 60) }),
        ],
      },
    }),
  );
}

async function open(page: Page, { width = 375, documentId = LIVE.documentId }: { width?: number; documentId?: string } = {}) {
  await page.setViewportSize({ width, height: 900 });
  await page.clock.install({ time: NOW });
  await page.goto(`/partide/${documentId}?tab=galerie`);
  await expect(page.getByRole('tab', { name: 'Galerie' })).toHaveAttribute('aria-selected', 'true');
}

const CONSOLE_NOISE = [/Failed to load resource/, /net::ERR_/];
const tiles = (page: Page) => page.getByTestId('galerie-grid').getByRole('button');
const gifButton = (page: Page) => page.getByTestId('galerie-gif').filter({ visible: true });
const toast = (page: Page, text: string) => page.getByText(text, { exact: true }).filter({ visible: true });
const settle = (page: Page) => page.waitForTimeout(450);

/** Records what the page hands navigator.share (canShare true) — the GIF's name, type, size, header. */
async function stubShare(page: Page, canShare: boolean) {
  await page.addInitScript(can => {
    const w = window as unknown as { __shared__: unknown[] };
    w.__shared__ = [];
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => can });
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (data: { files?: File[]; title?: string }) => {
        const f = data.files?.[0];
        const head = f ? new TextDecoder().decode(new Uint8Array(await f.slice(0, 6).arrayBuffer())) : '';
        w.__shared__.push({ title: data.title, name: f?.name, type: f?.type, size: f?.size ?? 0, head });
      },
    });
  }, canShare);
}
const shared = (page: Page) => page.evaluate(() => (window as unknown as { __shared__: { title: string; name: string; type: string; size: number; head: string }[] }).__shared__);

/* ------------------------------------------------------------------------------------------------
 * c1 — the masonry
 * ---------------------------------------------------------------------------------------------- */

for (const width of [375, 1280, 1440, 1920] as const) {
  test(`partide.partida-galerie.c1 c4 at ${width}: only photo captures, newest first, captions «specie · kg kg», «Exportă GIF» — axe clean`, async ({ page, fakeLive }) => {
    await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc(FIVE) } });
    await mockCms(page);
    await photoRoutes(page);
    const errors = collectConsoleErrors(page, { ignore: CONSOLE_NOISE });
    await open(page, { width });
    await expect(page.getByTestId('galerie')).toHaveAttribute('data-count', '5');
    // Newest first; the lost event with a photo and the captures without one are left out.
    await expect(tiles(page)).toHaveCount(5);
    expect(await tiles(page).evaluateAll(els => els.map(e => e.getAttribute('aria-label')))).toEqual([
      'Deschide poza: Plătică · 1,25 kg',
      'Deschide poza: 12,345 kg',
      'Deschide poza: Caras',
      'Deschide poza: Somn · 8,69 kg',
      'Deschide poza: Crap · 2,4 kg',
    ]);
    await expect(page.getByText('5 capturi cu poză', { exact: true })).toBeVisible();
    // The masonry: two columns on a phone, more as the page widens; the unit apart from the number.
    await expect(page.getByTestId('galerie-grid')).toHaveAttribute('data-columns', width === 375 ? '2' : /^[3-5]$/);
    await expect(tiles(page).first().getByText('kg', { exact: true })).toBeVisible();
    // c4: from two photos the export action — the floating pill on a phone, the toolbar's from 768. Once.
    await expect(gifButton(page)).toHaveCount(1);
    await expect(gifButton(page)).toHaveText('Exportă GIF');
    await expect(page.getByText(/capot/i)).toHaveCount(0);
    await settle(page);
    await expectNoA11yViolations(page);
    await page.screenshot({ path: `${SHOTS}/photos-${width}.png`, fullPage: true });
    expect(errors).toEqual([]);
  });
}

test('partide.partida-galerie.c1 a capture arriving live joins the gallery at the top', async ({ page, fakeLive }) => {
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc(ONE) } });
  await mockCms(page);
  await photoRoutes(page);
  await open(page, { width: 1280 });
  await expect(tiles(page)).toHaveCount(1);
  await fakeLive.push(LIVE.clientId, liveDoc([...ONE, FIVE[2]]));
  await expect(tiles(page)).toHaveCount(2);
  await expect(tiles(page).first()).toHaveAttribute('aria-label', 'Deschide poza: Somn · 8,69 kg');
  await expect(gifButton(page)).toBeVisible();
});

test('partide.partida-galerie.c1 an ended partidă: the photos of the CMS detail', async ({ page, fakeLive }) => {
  await fakeLive.seed({ docs: {} });
  await mockCms(page, { live: false });
  await photoRoutes(page);
  await open(page, { width: 375, documentId: ENDED.documentId });
  expect(await tiles(page).evaluateAll(els => els.map(e => e.getAttribute('aria-label')))).toEqual(['Deschide poza: Somn · 4,2 kg', 'Deschide poza: Crap · 5,1 kg']);
  await expect(gifButton(page)).toHaveCount(1);
  await page.screenshot({ path: `${SHOTS}/ended-375.png`, fullPage: true });
});

/* ------------------------------------------------------------------------------------------------
 * c2 — empty, and one photo
 * ---------------------------------------------------------------------------------------------- */

for (const width of [375, 1280, 1440, 1920] as const) {
  test(`partide.partida-galerie.c2 at ${width}: no photo capture → fish's two lines, no export`, async ({ page, fakeLive }) => {
    await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc(NO_PHOTO) } });
    await mockCms(page);
    await photoRoutes(page);
    await open(page, { width });
    const empty = page.getByTestId('galerie-empty');
    await expect(empty.getByRole('heading', { name: 'Nicio captură cu poză încă' })).toBeVisible();
    await expect(empty.getByText('Pozele capturilor din această partidă apar aici.')).toBeVisible();
    await expect(page.getByTestId('galerie-gif')).toHaveCount(0);
    await settle(page);
    await expectNoA11yViolations(page);
    await page.screenshot({ path: `${SHOTS}/empty-${width}.png`, fullPage: true });
  });
}

test('partide.partida-galerie.c4 one photo: the tile, no «Exportă GIF» (fish: from two)', async ({ page, fakeLive }) => {
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc(ONE) } });
  await mockCms(page);
  await photoRoutes(page);
  for (const width of [375, 1280]) {
    await open(page, { width });
    await expect(tiles(page)).toHaveCount(1);
    await expect(page.getByText('1 captură cu poză', { exact: true })).toBeVisible();
    await expect(page.getByTestId('galerie-gif')).toHaveCount(0);
    await page.screenshot({ path: `${SHOTS}/one-${width}.png`, fullPage: true });
  }
});

/* ------------------------------------------------------------------------------------------------
 * c3 — the lightbox and its share
 * ---------------------------------------------------------------------------------------------- */

for (const width of [375, 1280] as const) {
  test(`partide.partida-galerie.c3 at ${width}: a tile opens the lightbox on it (kg, «specie · ora»), → pages, share closes it and opens the share card`, async ({ page, fakeLive }) => {
    await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc(FIVE) } });
    await mockCms(page);
    await photoRoutes(page);
    await open(page, { width });
    // Keyboard: the second tile (newest first: the 12,345 kg one), Enter.
    await tiles(page).nth(1).focus();
    await page.keyboard.press('Enter');
    const box = page.getByTestId('lightbox');
    await expect(box).toBeVisible();
    await expect(box.getByText('Captura 2 din 5', { exact: true })).toBeVisible();
    const footer = box.getByTestId('galerie-lightbox-footer');
    await expect(footer.getByText('12,345', { exact: true })).toBeVisible();
    await expect(footer.getByText('kg', { exact: true })).toBeVisible();
    await expect(footer).toContainText('14:00'); // no species: the time alone
    await page.keyboard.press('ArrowRight');
    await expect(box.getByText('Captura 3 din 5', { exact: true })).toBeVisible();
    await expect(footer).not.toContainText('kg');
    await expect(footer.getByText('Caras · 13:00', { exact: true })).toBeVisible();
    await page.keyboard.press('ArrowRight');
    await expect(footer.getByText('Somn · 12:20', { exact: true })).toBeVisible();
    await settle(page);
    await expectNoA11yViolations(page);
    await page.screenshot({ path: `${SHOTS}/lightbox-${width}.png` });
    // Share: the lightbox closes, the share card opens for THAT catch (Somn 8,69 kg at Balta Mock).
    await box.getByRole('button', { name: 'Distribuie captura' }).click();
    await expect(box).toBeHidden();
    const sheet = page.getByRole('dialog', { name: 'Distribuie captura' });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByTestId('share-catch')).toBeVisible();
    await expect(sheet.getByRole('img', { name: /8,69 kg/ })).toBeVisible();
    await expect(sheet.getByRole('img', { name: /Balta Mock/ })).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/share-${width}.png` });
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
    // Escape closes the lightbox and focus returns to the tile.
    await tiles(page).first().click();
    await expect(box.getByText('Captura 1 din 5', { exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(box).toBeHidden();
    await expect(tiles(page).first()).toBeFocused();
  });
}

/* ------------------------------------------------------------------------------------------------
 * c4 — the GIF export
 * ---------------------------------------------------------------------------------------------- */

test('partide.partida-galerie.c4 phone: «Exportă GIF» shows «{done}/{total}», then hands a GIF to the system share sheet', async ({ page, fakeLive }) => {
  await stubShare(page, true);
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc(FIVE) } });
  await mockCms(page);
  // Every photo answers slowly (no-store: the export reloads them), so the progress is observable.
  await photoRoutes(page, { delayMs: 350 });
  await open(page, { width: 375 });
  await expect(tiles(page)).toHaveCount(5);
  await gifButton(page).click();
  await expect(gifButton(page)).toHaveText(/^[0-4]\/5$/);
  await expect(gifButton(page)).toHaveAttribute('aria-busy', 'true');
  await page.screenshot({ path: `${SHOTS}/gif-progress-375.png` });
  await expect(gifButton(page)).toHaveText('Exportă GIF', { timeout: 30_000 });
  await expect.poll(() => shared(page).then(s => s.length)).toBe(1);
  const [gif] = await shared(page);
  expect(gif.title).toBe('Distribuie GIF-ul');
  expect(gif.type).toBe('image/gif');
  expect(gif.name).toMatch(/^bluvi-galerie-\d+\.gif$/);
  expect(gif.head).toBe('GIF89a');
  expect(gif.size).toBeGreaterThan(10_000);
});

test('partide.partida-galerie.c4 desktop: no file share → the GIF is downloaded, «GIF-ul a fost salvat.»', async ({ page, fakeLive }) => {
  await stubShare(page, false);
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc(FIVE) } });
  await mockCms(page);
  await photoRoutes(page);
  await open(page, { width: 1440 });
  const download = page.waitForEvent('download', { timeout: 30_000 });
  await gifButton(page).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^bluvi-galerie-\d+\.gif$/);
  const bytes = readFileSync(await file.path());
  expect(bytes.subarray(0, 6).toString()).toBe('GIF89a');
  await expect(toast(page, 'GIF-ul a fost salvat.')).toBeVisible();
  expect(await shared(page)).toEqual([]);
  await expect(gifButton(page)).toHaveText('Exportă GIF');
});

test('partide.partida-galerie.c4 a failed export → «Eroare la generarea GIF-ului», the action is back', async ({ page, fakeLive }) => {
  await stubShare(page, true);
  await page.addInitScript(() => {
    CanvasRenderingContext2D.prototype.getImageData = () => {
      throw new DOMException('The canvas has been tainted by cross-origin data.', 'SecurityError');
    };
  });
  await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc(FIVE) } });
  await mockCms(page);
  await photoRoutes(page);
  await open(page, { width: 1280 });
  await gifButton(page).click();
  await expect(toast(page, 'Eroare la generarea GIF-ului')).toBeVisible();
  await expect(gifButton(page)).toHaveText('Exportă GIF');
  expect(await shared(page)).toEqual([]);
});
