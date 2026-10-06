import { cardRankingLabel } from '../../core/competitions/domain/cardCopy';
import { LAKE_ON_WEB } from '../../app/(site)/balti/[id]/_components/availability';
import { expectNoA11yViolations } from './helpers/a11y';
import { CMS, qaJwt, signIn } from './helpers/session';
import { expect, test, type ConsoleMessage, type Page, type Route } from '@playwright/test';

/*
 * The lake's subpages, batch 2 — parity docs/parity/areas/lakes.yml: lakes.gallery (/galerie),
 * lakes.catches (/capturi), lakes.anglers-ranking (/clasament), lakes.stands-ranking (/standuri),
 * lakes.competitions (/concursuri). Each test names the criterion / state ids it covers.
 *
 * Lakes in the local CMS (override with E2E_LAKE_*):
 *  - Ceorpelarilor: ~880 catch photos, a year of community stats (10 ranked anglers, species);
 *  - Chita (the QA user's lake): one catch, two stands this year, upcoming and finished competitions;
 *  - Belin: two lake photos, no catch.
 * The first page / period / tab is read on the server: its failures go through the dev-only fault
 * switch (POST /balti/<id>/e2e-fault — reads `catches-page`, `stats`, `competitions-tab`); what the
 * browser reads after that (next pages, other periods, a retry) is intercepted with page.route.
 */

const BASE = process.env.BASE_URL ?? 'http://localhost:3101';
test.use({ baseURL: BASE });
test.describe.configure({ timeout: 180_000 });

const ID = {
  big: process.env.E2E_LAKE_CATCHES ?? 'r4lf1ykkdquk7hru484l6r3k',
  chita: process.env.E2E_LAKE_CHITA ?? 's84u55lo4n9z0emngozttt6e',
  belin: process.env.E2E_LAKE_FULL ?? 'g14bobjsal2dbks2jg38v0oi',
};

const PHONE = { width: 375, height: 812 };
const TABLET = { width: 768, height: 1024 };
const LAPTOP = { width: 1280, height: 800 };
const DESKTOP = { width: 1440, height: 900 };

type Lake = { documentId: string; name: string; images: { url: string; blurhash?: string | null }[] };
type Catch = { clientId: string; species: string | null; weightKg: number | null; photoUrl: string | null; photoGridUrl: string | null; angler: { uid: string; name: string | null } };
type Stats = {
  totals: { partide: number; anglers: number; catches: number; totalKg: number };
  topAnglers: { uid: string; name: string | null; avatarUrl: string | null; partide: number; catches: number; totalKg: number }[];
  species: { name: string; count: number; pct: number }[];
  stands?: { standId: string; name: string; partide: number; catches: number; totalKg: number; recordKg: number | null }[];
  [k: string]: unknown;
};

const lakes = new Map<string, Lake>();
let bigCatches: Catch[] = [];
let bigTotal = 0;
let bigYear: Stats;
let chitaYear: Stats;
type Card = {
  documentId: string;
  name: string;
  status: 'notStarted' | 'started' | 'completed';
  rankingLabel: string;
  rounds?: { current: number; count: number; status: string } | null;
  format: { kind: 'single' | 'team'; unit: 'pescari' | 'echipe' };
  joinedCount: number;
  pendingCount: number;
  capacity: number | null;
  viewers: number;
};
let chitaFinished: Card[] = [];
let chitaFinishedTotal = 0;
let chitaUpcoming: Card[] = [];
let chitaCounts = { notStarted: 0, started: 0, completed: 0 };
let jwt = '';
let me = '';

/** The rankings' kg (clasament, standuri): always two decimals, so the column's commas line up. */
const kg2 = (n: number) => n.toFixed(2).replace('.', ',');
/** A ranked row's value cell: the number, the unit on the line under it (RankRow, the kit RankingRow's grammar). */
const kgCell = (n: number) => new RegExp(`^${kg2(n)}\\s*kg$`);

/** Cumulative layout shift since the page started (a PerformanceObserver installed before load). */
async function trackCls(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as { __cls: number }).__cls = 0;
    new PerformanceObserver(list => {
      for (const e of list.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) {
        if (!e.hadRecentInput) (window as unknown as { __cls: number }).__cls += e.value;
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });
}
const readCls = (page: Page) => page.evaluate(() => (window as unknown as { __cls: number }).__cls);

/** The lightbox's photo (the footer may carry the angler's avatar too). */
const stageImg = (page: Page) => page.getByTestId('lightbox-stage').locator('img');

/** T1 ListFooter: «Încarcă mai multe» / «Se încarcă…» while a page is on its way. */
const moreButton = (page: Page) => page.getByRole('button', { name: /^(Încarcă mai multe|Se încarcă…|Reîncearcă)$/ });

const fmtKg = (n: number) => {
  const s = (Math.round(n * 1000) / 1000).toFixed(3).replace(/0+$/, '');
  return (s.endsWith('.') ? `${s}0` : s).replace('.', ',');
};

test.beforeAll(async ({ request }) => {
  for (const id of Object.values(ID)) {
    const res = await request.get(`${CMS}/feed/lakes/${id}`);
    expect(res.ok(), `lake ${id} exists in the local CMS`).toBeTruthy();
    lakes.set(id, (await res.json()).data);
  }
  const page1 = await (await request.get(`${CMS}/feed/community/lakes/${ID.big}/catches?page=1&pageSize=20`)).json();
  bigCatches = page1.data;
  bigTotal = page1.meta.pagination.total;
  bigYear = (await (await request.get(`${CMS}/feed/community/stats?period=year&venue=lake:${ID.big}`)).json()).data;
  chitaYear = (await (await request.get(`${CMS}/feed/community/stats?period=year&venue=lake:${ID.chita}`)).json()).data;
  // The lake's tabs read the /concursuri cards (/feed/competition-cards, scoped to the lake, 10 a page).
  const done = await (await request.get(`${CMS}/feed/competition-cards?status=completed&lakeId=${ID.chita}&page=1&pageSize=10`)).json();
  chitaFinished = done.data;
  chitaFinishedTotal = done.meta.pagination.total;
  chitaCounts = done.meta.counts;
  chitaUpcoming = (await (await request.get(`${CMS}/feed/competition-cards?status=notStarted&lakeId=${ID.chita}&page=1&pageSize=10`)).json()).data;
  jwt = await qaJwt(request);
  me = (await (await request.get(`${CMS}/users/me`, { headers: { authorization: `Bearer ${jwt}` } })).json()).documentId;
});

async function faults(page: Page, id: string, list: string[]) {
  const res = await page.request.post(`${BASE}/balti/${id}/e2e-fault`, { data: { faults: list } });
  expect(res.ok(), 'the dev-only fault switch answers (development server)').toBeTruthy();
}
test.afterEach(async ({ page }) => {
  for (const id of Object.values(ID)) await faults(page, id, []);
});

function collectConsoleErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', (msg: ConsoleMessage) => {
    // Photos of the local test data that 404 on S3 are the data's, not the page's.
    if (msg.type() === 'error' && !/Failed to load resource|ERR_|net::/.test(msg.text())) errors.push(msg.text());
  });
  page.on('pageerror', err => errors.push(`pageerror: ${err.message}`));
  return errors;
}

const settle = (page: Page) => page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});

async function go(page: Page, path: string, viewport = PHONE) {
  await page.setViewportSize(viewport);
  const res = await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  expect(res?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 60_000 });
  await settle(page);
}

/** No sideways page scroll at this width. */
async function expectNoHorizontalScroll(page: Page) {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(over).toBeLessThanOrEqual(0);
}

/** The cards of the active tab: the grid's own items (a Trecute card carries its podium <ol>). */
const cardItems = (page: Page) => page.getByRole('tabpanel').getByRole('list').first().locator(':scope > li');

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });

/* ============================================================================================== */
/* Galerie — lakes.gallery                                                                         */
/* ============================================================================================== */

test('lakes.gallery.c1 lakes.gallery.c2 lakes.gallery.c3 lakes.gallery.c4 lakes.gallery.c5 — header, filters, interleave, masonry tiles', async ({ page }) => {
  const errors = collectConsoleErrors(page);
  const lake = lakes.get(ID.big)!;
  await go(page, `/balti/${ID.big}/galerie`);
  // c1
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Galerie');
  const n = lake.images.length + bigTotal;
  await expect(page.getByTestId('gallery-subtitle')).toHaveText(`${lake.name} · ${n} ${n === 1 ? 'fotografie' : 'fotografii'}`);
  await expect(page.getByRole('button', { name: 'Închide galeria' })).toBeVisible();
  // c2: three filters, Toate first and checked, one line.
  const group = page.getByRole('radiogroup', { name: 'Arată' });
  await expect(group.getByRole('radio')).toHaveCount(3);
  await expect(group.locator('label')).toHaveText(['Toate', 'Foto baltă', 'Capturi comunitate']);
  await expect(group.getByRole('radio', { name: 'Toate' })).toBeChecked();
  const tops = await group.locator('label').evaluateAll(els => els.map(e => Math.round(e.getBoundingClientRect().top)));
  expect(new Set(tops).size, 'the filters stay on one line (the row scrolls)').toBe(1);
  await expect(page.getByTestId('gallery-filters')).toHaveCSS('overflow-x', 'auto');
  // c3: photo, catch, (photo…), then the rest of the catches.
  const grid = page.getByTestId('gallery-grid');
  const kinds = await grid.locator('button[data-kind]').evaluateAll(els => els.slice(0, 4).map(e => e.getAttribute('data-kind')));
  const expected = lake.images.length >= 2 ? ['photo', 'catch', 'photo', 'catch'] : ['photo', 'catch', 'catch', 'catch'];
  expect(kinds).toEqual(expected.slice(0, kinds.length));
  // c4: lake photos at 4:3 over the blurhash, catches at their own ratio; masonry columns.
  const photo = grid.locator('button[data-kind="photo"]').first();
  expect(await photo.evaluate(e => getComputedStyle(e).aspectRatio)).toMatch(/1\.33|4 \/ 3/);
  if (lake.images[0]?.blurhash) expect(await photo.evaluate(e => getComputedStyle(e).backgroundImage)).toContain('data:image/bmp');
  const c0 = bigCatches.find(c => c.photoUrl)!;
  await expect(grid).toHaveAttribute('data-columns', '2');
  // c5: kg, species pill, initials + name.
  const tile = grid.locator('button[data-kind="catch"]').first();
  if (c0.weightKg != null) await expect(tile).toContainText(`${fmtKg(c0.weightKg)}kg`);
  if (c0.species) await expect(tile).toContainText(c0.species);
  await expect(tile).toContainText(c0.angler.name ?? 'Pescar');
  // Foto baltă: only the lake's photos, no paging footer.
  await group.getByText('Foto baltă').click();
  await expect(grid.locator('button[data-kind]')).toHaveCount(lake.images.length);
  await expect(grid.locator('button[data-kind="catch"]')).toHaveCount(0);
  await expect(moreButton(page)).toHaveCount(0);
  await group.getByText('Capturi comunitate').click();
  await expect(grid.locator('button[data-kind="photo"]')).toHaveCount(0);
  // The full-width rule: more columns as the page widens.
  await page.setViewportSize(DESKTOP);
  await expect(grid).toHaveAttribute('data-columns', /^[5-7]$/);
  for (const w of [PHONE, TABLET, LAPTOP, DESKTOP]) {
    await page.setViewportSize(w);
    await expectNoHorizontalScroll(page);
  }
  await expectNoA11yViolations(page);
  expect(errors).toEqual([]);
});

test('lakes.gallery.c7 lakes.gallery.s5 — catches page 20 at a time with a loading footer (the kit ListFooter), prefetched before the end', async ({ page }) => {
  await go(page, `/balti/${ID.big}/galerie`);
  const grid = page.getByTestId('gallery-grid');
  await page.getByRole('radiogroup', { name: 'Arată' }).getByText('Capturi comunitate').click();
  await expect(grid.locator('button[data-kind="catch"]')).toHaveCount(bigCatches.filter(c => c.photoUrl).length);
  let release!: () => void;
  const gate = new Promise<void>(r => (release = r));
  await page.route('**/feed/community/lakes/*/catches?*page=2*', async route => {
    expect(new URL(route.request().url()).searchParams.get('pageSize')).toBe('20');
    await gate;
    await route.continue();
  });
  await moreButton(page).scrollIntoViewIfNeeded();
  await expect(moreButton(page)).toHaveText('Se încarcă…');
  await expect(moreButton(page)).toHaveAttribute('aria-busy', 'true');
  release();
  await expect.poll(() => grid.locator('button[data-kind="catch"]').count(), { timeout: 30_000 }).toBeGreaterThan(20);
});

test('lakes.gallery.c8 lakes.gallery.s6 — a tile opens the lightbox there; a catch carries its footer; ← → page; Escape closes', async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await go(page, `/balti/${ID.big}/galerie`, DESKTOP);
  const lake = lakes.get(ID.big)!;
  const n = lake.images.length + bigTotal;
  // A lake photo: the original resolution.
  await page.getByTestId('gallery-grid').locator('button[data-kind="photo"]').first().click();
  const box = page.getByTestId('lightbox');
  await expect(box).toBeVisible();
  await expect(box).toContainText(`Galerie · 1 din ${n}`);
  await expect(stageImg(page)).toHaveAttribute('src', lake.images[0].url);
  // → the first catch: its footer.
  await page.keyboard.press('ArrowRight');
  const c0 = bigCatches.find(c => c.photoUrl)!;
  await expect(box).toContainText(`Galerie · 2 din ${n}`);
  await expect(stageImg(page)).toHaveAttribute('src', c0.photoUrl!);
  const footer = page.getByTestId('lightbox-footer');
  if (c0.weightKg != null) await expect(footer).toContainText(`${fmtKg(c0.weightKg)}kg`);
  if (c0.species) await expect(footer).toContainText(c0.species);
  await expect(footer).toContainText(/\d{4}/);
  if (c0.angler.name) await expect(footer).toContainText(c0.angler.name);
  await page.waitForTimeout(400);
  await expectNoA11yViolations(page);
  await page.keyboard.press('Escape');
  await expect(box).toBeHidden();
  // The lightbox's end asks for the next catches page (Capturi comunitate, last loaded tile).
  await page.getByRole('radiogroup', { name: 'Arată' }).getByText('Capturi comunitate').click();
  const tiles = page.getByTestId('gallery-grid').locator('button[data-kind="catch"]');
  // The footer may already have loaded a few pages (it asks 600px early); once that settles, the
  // lightbox's end asks for the next one, whichever it is.
  await settle(page);
  const loaded = await tiles.count();
  const next = page.waitForRequest(r => /\/catches\?.*page=([2-9]|\d{2,})/.test(r.url()), { timeout: 30_000 });
  await tiles.nth(loaded - 1).click();
  await next;
  await expect(box).toContainText(`Galerie · ${loaded} din ${bigTotal}`);
  expect(errors).toEqual([]);
});

test('lakes.gallery.c6 lakes.gallery.s3 lakes.gallery.s4 — the empty copy per filter', async ({ page }) => {
  // Belin: two photos, no catch.
  await go(page, `/balti/${ID.belin}/galerie`);
  const group = page.getByRole('radiogroup', { name: 'Arată' });
  await group.getByText('Capturi comunitate').click();
  await expect(page.getByTestId('gallery-empty')).toContainText('Nicio captură cu poză la această baltă încă.');
  // The way forward: the lake's own photos.
  await page.getByTestId('gallery-empty').getByRole('button', { name: 'Vezi fotografiile bălții' }).click();
  await expect(group.getByRole('radio', { name: 'Foto baltă' })).toBeChecked();
  await group.getByText('Capturi comunitate').click();
  // Chita without its photo: «Foto baltă» empty.
  await faults(page, ID.chita, ['no-photos']);
  await go(page, `/balti/${ID.chita}/galerie`);
  await page.getByRole('radiogroup', { name: 'Arată' }).getByText('Foto baltă').click();
  await expect(page.getByTestId('gallery-empty')).toContainText('Nicio fotografie încă.');
  await expectNoA11yViolations(page);
});

test('lakes.gallery.s1 lakes.gallery.s5 — loading: the masonry skeleton while the catches are read; a failed read says so with a retry', async ({ page }) => {
  await faults(page, ID.chita, ['no-photos', 'catches-page']);
  let fail = true;
  let release!: () => void;
  const gate = new Promise<void>(r => (release = r));
  await page.route('**/feed/community/lakes/*/catches**', async route => {
    await gate;
    if (fail) return json(route, { error: { status: 500 } }, 500);
    return route.continue();
  });
  await page.setViewportSize(PHONE);
  await page.goto(`/balti/${ID.chita}/galerie`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await expect(page.getByTestId('masonry-skeleton').locator('visible=true').first()).toBeVisible({ timeout: 60_000 });
  release();
  await expect(page.getByTestId('gallery-catches-error')).toContainText('Nu am putut încărca capturile comunității.');
  fail = false;
  await page.getByTestId('gallery-catches-error').getByRole('button', { name: 'Încearcă din nou' }).click();
  await expect(page.getByTestId('gallery-grid').locator('button[data-kind="catch"]')).toHaveCount(1);
});

test('lakes.gallery.c1 — the close control returns to the lake', async ({ page }) => {
  await go(page, `/balti/${ID.chita}/galerie`);
  await page.getByRole('button', { name: 'Închide galeria' }).click();
  await expect(page).toHaveURL(new RegExp(`/balti/${ID.chita}$`), { timeout: 60_000 });
});

/* ============================================================================================== */
/* Capturi — lakes.catches                                                                         */
/* ============================================================================================== */

test('lakes.catches.c1 lakes.catches.c2 lakes.catches.c6 lakes.catches.s3 lakes.catches.s5 — header, masonry with captions, pages of 20', async ({ page }) => {
  const errors = collectConsoleErrors(page);
  const lake = lakes.get(ID.big)!;
  await go(page, `/balti/${ID.big}/capturi`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Capturi');
  await expect(page.getByTestId('gallery-subtitle')).toHaveText(`${lake.name} · ${bigTotal} capturi`);
  await expect(page.getByRole('button', { name: 'Închide capturile' })).toBeVisible();
  const grid = page.getByTestId('catches-grid');
  const withPhoto = bigCatches.filter(c => c.photoUrl || c.photoGridUrl);
  await expect(grid.getByRole('button')).toHaveCount(withPhoto.length);
  const c0 = withPhoto[0];
  await expect(grid.getByRole('button').first().locator('img')).toHaveAttribute('src', (c0.photoGridUrl || c0.photoUrl)!);
  // The shared CatchTile `caption`: the catch signature (navy chip, lavender kg) and the species.
  if (c0.weightKg != null) await expect(grid.getByRole('button').first()).toContainText(`${fmtKg(c0.weightKg)}kg`);
  if (c0.species) await expect(grid.getByRole('button').first()).toContainText(c0.species);
  // c6: the next 20 on scroll, with the loading footer.
  let release!: () => void;
  const gate = new Promise<void>(r => (release = r));
  await page.route('**/feed/community/lakes/*/catches?*page=2*', async route => {
    await gate;
    await route.continue();
  });
  await moreButton(page).scrollIntoViewIfNeeded();
  await expect(moreButton(page)).toHaveAttribute('aria-busy', 'true');
  release();
  await expect.poll(() => grid.getByRole('button').count(), { timeout: 30_000 }).toBeGreaterThan(20);
  for (const w of [PHONE, TABLET, LAPTOP, DESKTOP]) {
    await page.setViewportSize(w);
    await expectNoHorizontalScroll(page);
  }
  await expectNoA11yViolations(page);
  expect(errors).toEqual([]);
  // «1 captură» on Chita.
  await go(page, `/balti/${ID.chita}/capturi`);
  await expect(page.getByTestId('gallery-subtitle')).toHaveText(`${lakes.get(ID.chita)!.name} · 1 captură`);
});

test('lakes.catches.c4 lakes.catches.c5 lakes.catches.s4 — ?foto opens the lightbox once on that catch; a tile opens it with the footer', async ({ page }) => {
  const target = bigCatches.filter(c => c.photoUrl)[2];
  await go(page, `/balti/${ID.big}/capturi?foto=${encodeURIComponent(target.clientId)}`, DESKTOP);
  const box = page.getByTestId('lightbox');
  await expect(box).toBeVisible();
  await expect(box).toContainText(`Capturi · 3 din ${bigTotal}`);
  await expect(stageImg(page)).toHaveAttribute('src', target.photoUrl!);
  await box.getByRole('button', { name: 'Închide', exact: true }).click();
  await expect(box).toBeHidden();
  // Once: closing keeps it closed.
  await page.waitForTimeout(500);
  await expect(box).toBeHidden();
  // c5: a tile → the full photo and the footer.
  const first = bigCatches.filter(c => c.photoUrl)[0];
  await page.getByTestId('catches-grid').getByRole('button').first().click();
  await expect(stageImg(page)).toHaveAttribute('src', first.photoUrl!);
  if (first.angler.name) await expect(page.getByTestId('lightbox-footer')).toContainText(first.angler.name);
  // fish VenueCatchesGalleryScreen `members={[c.angler]}`: the angler's ringed avatar by the name.
  if (first.angler.name) await expect(page.getByTestId('lightbox-angler-avatar')).toBeVisible();
  if (first.weightKg != null) await expect(page.getByTestId('lightbox-footer')).toContainText(fmtKg(first.weightKg));
  await page.waitForTimeout(400);
  await expectNoA11yViolations(page);
});

test('lakes.catches.c4 lakes.catches.s4 lakes.catches.s5 — ?foto of a catch past the first page opens nothing, and loading its page never pops the lightbox', async ({ page, request }) => {
  const page2 = (await (await request.get(`${CMS}/feed/community/lakes/${ID.big}/catches?page=2&pageSize=20`)).json()).data as Catch[];
  const later = page2.find(c => c.photoUrl);
  test.skip(!later, 'needs a second page of catch photos');
  await go(page, `/balti/${ID.big}/capturi?foto=${encodeURIComponent(later!.clientId)}`, DESKTOP);
  const box = page.getByTestId('lightbox');
  await expect(page.getByTestId('catches-grid')).toBeVisible();
  await expect(box).toBeHidden();
  const grid = page.getByTestId('catches-grid');
  await moreButton(page).scrollIntoViewIfNeeded();
  await expect.poll(() => grid.getByRole('button').count(), { timeout: 30_000 }).toBeGreaterThan(20);
  await page.waitForTimeout(500);
  await expect(box).toBeHidden();
});

test('lakes.catches.c3 lakes.catches.s1 lakes.catches.s2 — masonry skeleton while loading, then the empty copy', async ({ page }) => {
  await faults(page, ID.chita, ['catches-page']);
  let release!: () => void;
  const gate = new Promise<void>(r => (release = r));
  await page.route('**/feed/community/lakes/*/catches**', async route => {
    await gate;
    return json(route, { data: [], meta: { pagination: { page: 1, pageSize: 20, pageCount: 0, total: 0 } } });
  });
  await page.setViewportSize(PHONE);
  await page.goto(`/balti/${ID.chita}/capturi`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await expect(page.getByTestId('masonry-skeleton').locator('visible=true').first()).toBeVisible({ timeout: 60_000 });
  release();
  await expect(page.getByTestId('catches-empty')).toContainText('Nicio captură cu fotografie încă.');
  // The empty card says it: no «0 capturi» over it; the card leads back to the lake.
  await expect(page.getByTestId('gallery-subtitle')).not.toContainText('capturi');
  await expect(page.getByTestId('catches-empty').getByRole('link', { name: 'Înapoi la baltă' })).toHaveAttribute('href', `/balti/${ID.chita}`);
  await expectNoA11yViolations(page);
});

/* ============================================================================================== */
/* Clasament — lakes.anglers-ranking                                                               */
/* ============================================================================================== */

test('lakes.anglers-ranking.c1 lakes.anglers-ranking.c3 lakes.anglers-ranking.c4 lakes.anglers-ranking.c5 lakes.anglers-ranking.c6 — title, podium, Pescari / Specii', async ({ page }) => {
  const errors = collectConsoleErrors(page);
  const lake = lakes.get(ID.big)!;
  await go(page, `/balti/${ID.big}/clasament?perioada=year`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(`Clasament · ${lake.name}`);
  await expect(page.getByRole('button', { name: 'Înapoi' })).toBeVisible();
  // c3: 2 · 1 · 3, first name, kg.
  const podium = page.getByTestId('podium');
  await expect(podium.locator('[data-rank]')).toHaveCount(3);
  expect(await podium.locator('[data-rank]').evaluateAll(els => els.map(e => e.getAttribute('data-rank')))).toEqual(['2', '1', '3']);
  const [a1, a2] = bigYear.topAnglers;
  await expect(podium.locator('[data-rank="1"]')).toContainText(`${kg2(a1.totalKg)} kg`);
  await expect(podium.locator('[data-rank="1"]')).toContainText((a1.name ?? 'Pescar').split(/\s+/)[0]);
  await expect(podium.locator('[data-rank="2"]')).toContainText(`${kg2(a2.totalKg)} kg`);
  // c4: two segments.
  const seg = page.getByRole('group', { name: 'Arată' }).locator('visible=true');
  await expect(seg.getByRole('radio')).toHaveCount(2);
  await expect(seg.locator('label')).toHaveText(['Pescari', 'Specii']);
  await expect(page.getByRole('radio', { name: 'Bălți' })).toHaveCount(0);
  // c5: from rank 4.
  const rows = page.getByTestId('angler-rows').getByRole('listitem');
  await expect(rows).toHaveCount(bigYear.topAnglers.length - 3);
  const a4 = bigYear.topAnglers[3];
  await expect(rows.first()).toContainText('4');
  await expect(rows.first()).toContainText(a4.name ?? 'Pescar');
  await expect(rows.first()).toContainText(`${a4.partide} ${a4.partide === 1 ? 'partidă' : 'partide'} · ${a4.catches} ${a4.catches === 1 ? 'captură' : 'capturi'}`);
  await expect(rows.first().getByTestId('rank-value')).toHaveText(kgCell(a4.totalKg));
  // The place is the kit PositionPill (36px square, Fundații §05) on every row.
  expect(await rows.first().locator('span.size-9').first().evaluate(e => getComputedStyle(e).width)).toBe('36px');
  // c6: species — the podium stays (fish shows it over both lists), the toggle under it.
  await seg.getByText('Specii').click();
  await expect(page.getByTestId('podium')).toBeVisible();
  const order = await page.getByTestId('ranking-content').evaluate(root => {
    const at = (el: Element | null) => (el ? el.getBoundingClientRect().top : -1);
    return { podium: at(root.querySelector('[data-testid="podium"]')), seg: at([...root.querySelectorAll('fieldset')].find(f => f.getBoundingClientRect().height > 0) ?? null), list: at(root.querySelector('[data-testid="species-rows"]')) };
  });
  expect(order.podium).toBeLessThan(order.seg);
  expect(order.seg).toBeLessThan(order.list);
  const sp = page.getByTestId('species-rows').getByRole('listitem');
  await expect(sp).toHaveCount(bigYear.species.length);
  const s0 = bigYear.species[0];
  await expect(sp.first()).toContainText(s0.name);
  await expect(sp.first()).toContainText(`${s0.count} ${s0.count === 1 ? 'captură' : 'capturi'}`);
  await expect(sp.first()).toContainText(`${s0.pct}%`);
  // One leader rule: the first species is the winner (navy pill), as the first stand.
  await expect(sp.first().locator('span.size-9').first()).toHaveClass(/bg-navy/);
  await expectNoA11yViolations(page);
  // Three columns from 1280: the options left, the period right.
  await page.setViewportSize(DESKTOP);
  await expect(page.getByRole('complementary', { name: 'Opțiuni clasament' })).toBeVisible();
  await expect(page.getByTestId('period-totals')).toContainText(String(bigYear.totals.partide));
  for (const w of [PHONE, TABLET, LAPTOP, DESKTOP]) {
    await page.setViewportSize(w);
    await expectNoHorizontalScroll(page);
  }
  await expectNoA11yViolations(page);
  expect(errors).toEqual([]);
});

test('lakes.anglers-ranking.c2 lakes.anglers-ranking.s7 — the period chips drive the URL (replaced) and the ranking', async ({ page }) => {
  await go(page, `/balti/${ID.big}/clasament`);
  const chips = page.getByTestId('period-chips');
  await expect(chips.getByRole('radio', { name: 'Luna' })).toBeChecked();
  await expect(chips.locator('label')).toHaveText(['Săptămâna', 'Luna', 'Anul curent']);
  const before = await page.evaluate(() => history.length);
  await chips.getByText('Anul curent').click();
  await expect(page).toHaveURL(/\?perioada=year$/);
  expect(await page.evaluate(() => history.length)).toBe(before);
  await expect(page.getByTestId('podium').locator('[data-rank="1"]')).toContainText(`${kg2(bigYear.topAnglers[0].totalKg)} kg`, { timeout: 30_000 });
  // A link with the period opens on it.
  await go(page, `/balti/${ID.big}/clasament?perioada=year`);
  await expect(page.getByTestId('period-chips').getByRole('radio', { name: 'Anul curent' })).toBeChecked();
  // Switching: the previous period stays, marked busy.
  let release!: () => void;
  const gate = new Promise<void>(r => (release = r));
  await page.route('**/feed/community/stats?*period=week*', async route => {
    await gate;
    await route.continue();
  });
  await page.getByTestId('period-chips').getByText('Săptămâna').click();
  await expect(page.getByTestId('ranking-content')).toHaveAttribute('aria-busy', 'true');
  await expect(page.getByTestId('podium')).toBeVisible();
  release();
  await expect(page.getByTestId('ranking-content')).not.toHaveAttribute('aria-busy', 'true', { timeout: 30_000 });
});

test('lakes.anglers-ranking.c8 lakes.anglers-ranking.s3 — an empty period', async ({ page }) => {
  await go(page, `/balti/${ID.chita}/clasament?perioada=week`);
  await expect(page.getByTestId('ranking-empty')).toContainText('Niciun clasament pentru perioada selectată încă.');
  await expectNoA11yViolations(page);
});

test('lakes.anglers-ranking.c8 lakes.anglers-ranking.s1 lakes.anglers-ranking.s2 — skeleton, then the error with a retry that reads again', async ({ page }) => {
  await faults(page, ID.big, ['stats']);
  let fail = true;
  let release!: () => void;
  const gate = new Promise<void>(r => (release = r));
  await page.route('**/feed/community/stats**', async route => {
    await gate;
    if (fail) return json(route, { error: { status: 500 } }, 500);
    return route.continue();
  });
  await page.setViewportSize(PHONE);
  await page.goto(`/balti/${ID.big}/clasament?perioada=year`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await expect(page.getByTestId('ranking-content').getByTestId('ranking-skeleton')).toBeVisible({ timeout: 60_000 });
  release();
  const err = page.getByTestId('stats-error');
  await expect(err).toContainText('Nu am putut încărca statisticile.');
  await expect(page.getByTestId('ranking-empty')).toHaveCount(0);
  await expectNoA11yViolations(page);
  fail = false;
  await err.getByRole('button', { name: 'Încearcă din nou' }).click();
  await expect(page.getByTestId('podium')).toBeVisible({ timeout: 30_000 });
});

test('lakes.anglers-ranking.c5 lakes.anglers-ranking.c7 lakes.anglers-ranking.s4 lakes.anglers-ranking.s6 — only the podium; the signed-in, ranked user sees «EU»', async ({ page, context }) => {
  await signIn(context, jwt, BASE);
  await faults(page, ID.big, ['stats']);
  const fixture: Stats = {
    ...bigYear,
    totals: { ...bigYear.totals, anglers: 7 },
    topAnglers: [bigYear.topAnglers[0], { ...bigYear.topAnglers[1], uid: me, totalKg: 12.5 }, bigYear.topAnglers[2]],
  };
  await page.route('**/feed/community/stats**', route => json(route, { data: fixture }));
  await go(page, `/balti/${ID.big}/clasament?perioada=year`);
  await expect(page.getByTestId('podium-only')).toHaveText('Doar podiumul are date pentru perioada asta.');
  // Below 1280 the pill is in the content, at the bottom: podium → toggle → list → «EU» (fish).
  const pill = page.getByTestId('me-pill').locator('visible=true');
  await expect(pill).toHaveCount(1);
  await expect(pill).toContainText('EU');
  await expect(pill).toContainText('Ești pe locul 2 din 7 anul asta — 12,50 kg');
  const pillTop = await pill.evaluate(e => e.getBoundingClientRect().top);
  const podiumTop = await page.getByTestId('podium').evaluate(e => e.getBoundingClientRect().top);
  const listTop = await page.getByTestId('podium-only').evaluate(e => e.getBoundingClientRect().top);
  expect(podiumTop).toBeLessThan(listTop);
  expect(listTop).toBeLessThan(pillTop);
  // Pescari only.
  await page.getByRole('group', { name: 'Arată' }).locator('visible=true').getByText('Specii').click();
  await expect(page.getByTestId('me-pill')).toHaveCount(0);
  await expectNoA11yViolations(page);
});

/* ============================================================================================== */
/* Standuri — lakes.stands-ranking                                                                 */
/* ============================================================================================== */

test('lakes.stands-ranking.c1 lakes.stands-ranking.c2 lakes.stands-ranking.c3 lakes.stands-ranking.s4 — title, sort in the URL, the count and the ranked stands', async ({ page }) => {
  const errors = collectConsoleErrors(page);
  const lake = lakes.get(ID.chita)!;
  const stands = chitaYear.stands ?? [];
  test.skip(stands.length < 2, 'Chita has no stand activity this year in the local CMS');
  await go(page, `/balti/${ID.chita}/standuri?perioada=year`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Clasament standuri');
  // The period is in the subtitle: the only period cue a phone has (no chips here).
  await expect(page.locator('header').getByText(`${lake.name} · Anul curent`, { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Înapoi' })).toBeVisible();
  // c2: no period chips here; sort chips, kg first.
  await expect(page.getByTestId('period-chips')).toHaveCount(0);
  const sort = page.getByRole('radiogroup', { name: 'Ordonează după' });
  await expect(sort.locator('label')).toHaveText(['Kg total', 'Capturi', 'Record']);
  await expect(sort.getByRole('radio', { name: 'Kg total' })).toBeChecked();
  // c3
  await expect(page.getByTestId('stands-count')).toHaveText(`${stands.length} standuri cu activitate`);
  const rows = page.getByTestId('stand-rows').getByRole('listitem');
  await expect(rows).toHaveCount(stands.length);
  const byKg = [...stands].sort((a, b) => b.totalKg - a.totalKg || a.name.localeCompare(b.name, 'ro'));
  await expect(rows.first()).toContainText(`Stand ${byKg[0].name}`);
  await expect(rows.first().getByTestId('rank-value')).toHaveText(byKg[0].catches ? kgCell(byKg[0].totalKg) : '—');
  // One kg format per row: the record in the meta line takes the value column's two decimals.
  const rec = byKg.find(x => x.recordKg != null);
  if (rec) await expect(page.getByTestId(`stand-${rec.standId}`)).toContainText(`record ${kg2(rec.recordKg!)} kg`);
  // Switching writes the URL (replaced) and keeps the period.
  await sort.getByText('Capturi').click();
  await expect(page).toHaveURL(/perioada=year/);
  await expect(page).toHaveURL(/sortare=catches/);
  // ?sortare= opens on it; an unknown value is kg.
  await go(page, `/balti/${ID.chita}/standuri?perioada=year&sortare=record`);
  await expect(page.getByRole('radiogroup', { name: 'Ordonează după' }).getByRole('radio', { name: 'Record' })).toBeChecked();
  await go(page, `/balti/${ID.chita}/standuri?perioada=year&sortare=greutate`);
  await expect(page.getByRole('radiogroup', { name: 'Ordonează după' }).getByRole('radio', { name: 'Kg total' })).toBeChecked();
  for (const w of [PHONE, TABLET, LAPTOP, DESKTOP]) {
    await page.setViewportSize(w);
    await expectNoHorizontalScroll(page);
  }
  await expectNoA11yViolations(page);
  expect(errors).toEqual([]);
});

test('lakes.stands-ranking.c4 lakes.stands-ranking.c3 lakes.stands-ranking.s4 — Record: stands without a record sink, ties by name; «1 stand cu activitate»', async ({ page }) => {
  await faults(page, ID.chita, ['stats']);
  const s = (name: string, recordKg: number | null, totalKg = 1) => ({ standId: `s-${name}`, name, partide: 1, catches: 1, totalKg, recordKg });
  let stands = [s('B', null), s('Ș', 3), s('A', null), s('C', 5), s('S', 3)];
  await page.route('**/feed/community/stats**', route => json(route, { data: { ...chitaYear, stands } }));
  await go(page, `/balti/${ID.chita}/standuri?sortare=record`);
  await expect(page.getByTestId('stand-rows').getByRole('listitem')).toHaveText([/Stand C/, /Stand S/, /Stand Ș/, /Stand A/, /Stand B/]);
  await expect(page.getByTestId('stand-rows').getByTestId('rank-value').last()).toHaveText('—');
  stands = [s('9', 2)];
  await go(page, `/balti/${ID.chita}/standuri`);
  await expect(page.getByTestId('stands-count')).toHaveText('1 stand cu activitate');
});

test('lakes.stands-ranking.c5 lakes.stands-ranking.s1 lakes.stands-ranking.s2 — the skeleton, then the error (never «0 standuri»)', async ({ page }) => {
  await faults(page, ID.chita, ['stats']);
  let release!: () => void;
  const gate = new Promise<void>(r => (release = r));
  await page.route('**/feed/community/stats**', async route => {
    await gate;
    return json(route, { error: { status: 500 } }, 500);
  });
  await page.setViewportSize(PHONE);
  await page.goto(`/balti/${ID.chita}/standuri`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await expect(page.getByTestId('stands-content').getByTestId('stands-skeleton')).toBeVisible({ timeout: 60_000 });
  release();
  await expect(page.getByTestId('stats-error')).toContainText('Nu am putut încărca statisticile.');
  await expect(page.getByText(/0 standuri/)).toHaveCount(0);
  await expectNoA11yViolations(page);
});

/* ============================================================================================== */
/* Concursuri — lakes.competitions                                                                 */
/* ============================================================================================== */

test('lakes.competitions.c1 lakes.competitions.c2 lakes.competitions.c4 lakes.competitions.s3 — header, tabs (Live first), the empty tab', async ({ page }) => {
  const errors = collectConsoleErrors(page);
  const lake = lakes.get(ID.chita)!;
  await go(page, `/balti/${ID.chita}/concursuri`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(lake.name);
  await expect(page.getByRole('button', { name: 'Înapoi' })).toBeVisible();
  const tabs = page.getByRole('tablist', { name: 'Concursuri la baltă' });
  await expect(tabs.getByRole('tab')).toHaveText(['Live', 'Viitoare', 'Trecute']);
  await expect(tabs.getByRole('tab', { name: 'Live' })).toHaveAttribute('aria-selected', 'true');
  // Chita has nothing live: no LIVE dot on the tab (it would signal activity that is not there), and
  // the empty card leads to the next tab that has competitions.
  test.skip(chitaCounts.started > 0, 'needs no live competition at Chita');
  await expect(page.getByRole('tabpanel')).toContainText('Momentan nu este disponibil niciun concurs.');
  // The Live tab is built like its neighbours: no leading dot element.
  expect(await tabs.getByRole('tab', { name: 'Live' }).locator('*').count()).toBe(await tabs.getByRole('tab', { name: 'Trecute' }).locator('*').count());
  const next = chitaCounts.notStarted ? 'Vezi concursurile viitoare' : chitaCounts.completed ? 'Vezi concursurile trecute' : null;
  if (next) {
    await page.getByRole('tabpanel').getByRole('button', { name: next }).click();
    await expect(tabs.getByRole('tab', { name: chitaCounts.notStarted ? 'Viitoare' : 'Trecute' })).toHaveAttribute('aria-selected', 'true');
    await expect(cardItems(page).first()).toBeVisible({ timeout: 30_000 });
  }
  await expectNoA11yViolations(page);
  expect(errors).toEqual([]);
});

test('lakes.competitions.c3 lakes.competitions.c6 lakes.competitions.s4 lakes.competitions.s5 — ?tab picks the tab, a switch replaces the URL, 10 a page with more on scroll, cards open the competition', async ({ page }) => {
  test.skip(chitaFinishedTotal <= 10, 'needs more than one page of finished competitions at Chita');
  await go(page, `/balti/${ID.chita}/concursuri?tab=viitoare`, DESKTOP);
  const tabs = page.getByRole('tablist', { name: 'Concursuri la baltă' });
  await expect(tabs.getByRole('tab', { name: 'Viitoare' })).toHaveAttribute('aria-selected', 'true');
  const panel = page.getByRole('tabpanel');
  await expect(cardItems(page)).toHaveCount(chitaUpcoming.length);
  const before = await page.evaluate(() => history.length);
  await tabs.getByRole('tab', { name: 'Trecute' }).click();
  await expect(page).toHaveURL(/\?tab=trecute$/);
  expect(await page.evaluate(() => history.length)).toBe(before);
  await expect(cardItems(page)).toHaveCount(10, { timeout: 30_000 });
  await expect(panel.locator(`a[href="/concursuri/${chitaFinished[0].documentId}"]`).first()).toBeVisible();
  // The footer loads the next page as it comes into view.
  await page.mouse.wheel(0, 20_000);
  await expect(cardItems(page)).toHaveCount(Math.min(chitaFinishedTotal, 20), { timeout: 30_000 });
  // Keyboard: arrows move between tabs.
  await tabs.getByRole('tab', { name: 'Trecute' }).focus();
  await page.keyboard.press('ArrowLeft');
  await expect(tabs.getByRole('tab', { name: 'Viitoare' })).toHaveAttribute('aria-selected', 'true');
  await expect(page).toHaveURL(/\?tab=viitoare$/);
  for (const w of [PHONE, TABLET, LAPTOP, DESKTOP]) {
    await page.setViewportSize(w);
    await expectNoHorizontalScroll(page);
  }
  await expectNoA11yViolations(page);
  // A card opens /concursuri/[id].
  await panel.locator(`a[href="/concursuri/${chitaUpcoming[0].documentId}"]`).first().click();
  await expect(page).toHaveURL(new RegExp(`/concursuri/${chitaUpcoming[0].documentId}`), { timeout: 60_000 });
});

test('lakes.competitions.c5 lakes.competitions.s1 lakes.competitions.s2 — a failed tab: its error card, «Încearcă din nou» reads it again', async ({ page }) => {
  await faults(page, ID.chita, ['competitions-tab']);
  let fail = true;
  let release!: () => void;
  const gate = new Promise<void>(r => (release = r));
  await page.route('**/feed/competition-cards?*status=notStarted*', async route => {
    await gate;
    if (fail) return json(route, { error: { status: 500 } }, 500);
    return route.continue();
  });
  await page.setViewportSize(PHONE);
  await page.goto(`/balti/${ID.chita}/concursuri?tab=viitoare`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await expect(page.getByRole('tabpanel').getByRole('status')).toBeVisible({ timeout: 60_000 });
  release();
  const alert = page.getByRole('tabpanel').getByRole('alert');
  await expect(alert).toContainText('Nu am putut încărca concursurile');
  await expectNoA11yViolations(page);
  fail = false;
  await alert.getByRole('button', { name: 'Încearcă din nou' }).click();
  await expect(cardItems(page)).toHaveCount(chitaUpcoming.length, { timeout: 30_000 });
});

test('lakes.competitions.c6 — the lake page «Vezi tot» lands on the matching tab', async ({ page }) => {
  test.skip(!chitaUpcoming.length, 'no upcoming competition at Chita');
  await go(page, `/balti/${ID.chita}`, DESKTOP);
  await page.locator(`#concursuri a[href="/balti/${ID.chita}/concursuri?tab=viitoare"]`).click();
  await expect(page).toHaveURL(new RegExp(`/balti/${ID.chita}/concursuri\\?tab=viitoare$`), { timeout: 60_000 });
  await expect(page.getByRole('tab', { name: 'Viitoare' })).toHaveAttribute('aria-selected', 'true');
});

/* ============================================================================================== */
/* SEO                                                                                             */
/* ============================================================================================== */

test('lakes subpages — canonical, title and JSON-LD on every subpage; an unknown lake is the lake not-found', async ({ page }) => {
  const lake = lakes.get(ID.chita)!;
  for (const [path, title] of [
    ['galerie', 'Galerie'],
    ['capturi', 'Capturi'],
    ['clasament', 'Clasament pescari'],
    ['standuri', 'Clasament standuri'],
    ['concursuri', 'Concursuri'],
  ] as const) {
    await go(page, `/balti/${ID.chita}/${path}`);
    await expect(page).toHaveTitle(new RegExp(`${title} · ${lake.name}`));
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', new RegExp(`/balti/${ID.chita}/${path}$`));
    const ld = await page.locator('script[type="application/ld+json"]').allTextContents();
    expect(ld.join(' ')).toContain('BreadcrumbList');
  }
  await page.goto(`/balti/nu-exista-${Date.now()}/clasament`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await expect(page.getByRole('heading', { name: 'Balta nu a fost găsită' })).toBeVisible({ timeout: 60_000 });
});

/* ============================================================================================== */
/* Batch-2 review fixes — layout stability, retries, back, gestures, broken photos                 */
/* ============================================================================================== */

test('lakes.gallery.c4 lakes.catches.c2 — no layout shift on load: the first paint has the masonry geometry (CLS < 0.1 at 375 and 1440)', async ({ page }) => {
  await trackCls(page);
  for (const path of ['galerie', 'capturi']) {
    for (const w of [PHONE, DESKTOP]) {
      await page.setViewportSize(w);
      await page.goto(`/balti/${ID.big}/${path}`, { waitUntil: 'load', timeout: 120_000 });
      await expect(page.getByTestId(path === 'galerie' ? 'gallery-grid' : 'catches-grid')).toHaveAttribute('data-columns', /\d/, { timeout: 60_000 });
      await page.waitForTimeout(1500);
      expect(await readCls(page), `${path} at ${w.width}`).toBeLessThan(0.1);
    }
  }
});

test('lakes.gallery.c4 lakes.catches.c2 — a photo that fails to load is a muted glyph on the tile, never a broken image', async ({ page }) => {
  const c0 = bigCatches.find(c => c.photoGridUrl || c.photoUrl)!;
  const src = (c0.photoGridUrl || c0.photoUrl)!;
  await page.route(src, route => route.fulfill({ status: 404, body: '' }));
  await go(page, `/balti/${ID.big}/capturi`);
  const tile = page.getByTestId('catches-grid').getByRole('button').first();
  await expect(tile).toHaveAttribute('data-broken', 'true');
  await expect(tile.locator('img')).toHaveCount(0);
  await expect(tile.locator('svg')).toBeVisible();
});

test('lakes.catches.c1 lakes.catches.s2 — a failed first read prints no count; the retry keeps its card and focus, then focus goes to the heading', async ({ page }) => {
  await faults(page, ID.chita, ['catches-page']);
  let mode: 'fail' | 'ok' = 'fail';
  let release!: () => void;
  let gate = Promise.resolve();
  await page.route('**/feed/community/lakes/*/catches**', async route => {
    await gate;
    if (mode === 'fail') return json(route, { error: { status: 500 } }, 500);
    return route.continue();
  });
  await page.setViewportSize(PHONE);
  await page.goto(`/balti/${ID.chita}/capturi`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  const err = page.getByTestId('catches-error');
  await expect(err).toContainText('Nu am putut încărca capturile.', { timeout: 60_000 });
  await expect(page.getByTestId('gallery-subtitle')).toHaveText(lakes.get(ID.chita)!.name);
  // A retry that fails again: the card stays, «Se reîncarcă…» while it runs, focus stays on it.
  gate = new Promise<void>(r => (release = r));
  const retry = err.getByRole('button', { name: 'Încearcă din nou' });
  await retry.focus();
  await page.keyboard.press('Enter');
  await expect(err.getByRole('button')).toHaveAttribute('aria-busy', 'true');
  expect(await page.evaluate(() => document.activeElement?.tagName)).toBe('BUTTON');
  release();
  await expect(err).toContainText('Încercarea 2');
  expect(await page.evaluate(() => document.activeElement?.textContent)).toBe('Încearcă din nou');
  // A retry that works: the content replaces the card and focus goes to the h1, never <body>.
  mode = 'ok';
  gate = Promise.resolve();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('catches-grid')).toBeVisible({ timeout: 30_000 });
  await expect.poll(() => page.evaluate(() => document.activeElement?.id)).toBe('balta-sub-titlu');
});

test('lakes.anglers-ranking.c8 lakes.anglers-ranking.s2 — the stats retry keeps focus when it fails again and lands on the h1 when it works', async ({ page }) => {
  await faults(page, ID.big, ['stats']);
  let fail = true;
  await page.route('**/feed/community/stats**', route => (fail ? json(route, { error: { status: 500 } }, 500) : route.continue()));
  await page.setViewportSize(PHONE);
  await page.goto(`/balti/${ID.big}/clasament?perioada=year`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  const err = page.getByTestId('stats-error');
  await expect(err).toContainText('Nu am putut încărca statisticile.', { timeout: 60_000 });
  await err.getByRole('button', { name: 'Încearcă din nou' }).focus();
  await page.keyboard.press('Enter');
  await expect(err).toContainText('Încercarea 2', { timeout: 30_000 });
  expect(await page.evaluate(() => document.activeElement?.tagName)).toBe('BUTTON');
  fail = false;
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('podium')).toBeVisible({ timeout: 30_000 });
  await expect.poll(() => page.evaluate(() => document.activeElement?.id)).toBe('balta-sub-titlu');
});

test('lakes.anglers-ranking.c2 lakes.anglers-ranking.s7 lakes.anglers-ranking.s6 — at 1280 a period switch keeps the shown period\'s name, shows a spinner in the docked column and dims the ranking', async ({ page }) => {
  await go(page, `/balti/${ID.big}/clasament?perioada=year`, LAPTOP);
  const aside = page.getByRole('complementary', { name: 'Perioada și poziția ta' });
  await expect(aside.getByRole('heading', { name: 'Anul curent' })).toBeVisible();
  let release!: () => void;
  const gate = new Promise<void>(r => (release = r));
  await page.route('**/feed/community/stats?*period=week*', async route => {
    await gate;
    await route.continue();
  });
  const column = page.getByRole('complementary', { name: 'Opțiuni clasament' });
  await column.getByText('Săptămâna').click();
  await expect(page.getByTestId('ranking-content')).toHaveAttribute('aria-busy', 'true');
  // The numbers are still the year's: so is the title over them.
  await expect(aside.getByRole('heading', { name: 'Anul curent' })).toBeVisible();
  await expect(aside.getByRole('heading', { name: 'Săptămâna aceasta' })).toHaveCount(0);
  await expect(column.locator('legend svg.animate-spin')).toBeVisible();
  expect(Number(await page.getByTestId('ranking-content').evaluate(e => getComputedStyle(e).opacity))).toBeLessThan(1);
  release();
  await expect(page.getByTestId('ranking-content')).not.toHaveAttribute('aria-busy', 'true', { timeout: 30_000 });
  await expect(aside.getByRole('heading', { name: 'Săptămâna aceasta' })).toBeVisible();
});

test('lakes.anglers-ranking.c8 lakes.anglers-ranking.s3 — an empty or failed period never changes the page structure (the right column stays, the centre keeps its width)', async ({ page }) => {
  await go(page, `/balti/${ID.chita}/clasament?perioada=year`, DESKTOP);
  const centre = page.getByTestId('ranking-content');
  const before = await centre.evaluate(e => Math.round(e.getBoundingClientRect().width));
  await page.getByRole('complementary', { name: 'Opțiuni clasament' }).getByText('Săptămâna').click();
  await expect(page.getByTestId('ranking-empty')).toBeVisible({ timeout: 30_000 });
  expect(await centre.evaluate(e => Math.round(e.getBoundingClientRect().width))).toBe(before);
  await expect(page.getByRole('complementary', { name: 'Perioada și poziția ta' }).getByRole('heading', { name: 'Săptămâna aceasta' })).toBeVisible();
  // Below 1280 the right column is never an empty landmark: its blocks follow the list.
  await page.setViewportSize(PHONE);
  const aside = page.getByRole('complementary', { name: 'Perioada și poziția ta' });
  expect(await aside.evaluate(e => e.getBoundingClientRect().height)).toBeGreaterThan(0);
  await expect(aside).toContainText('Nicio partidă în această perioadă.');
});

test('lakes.anglers-ranking.c3 — fewer than three ranked anglers: the podium keeps its 2 · 1 · 3 shape with a ghost step', async ({ page }) => {
  test.skip(chitaYear.topAnglers.length >= 3 || chitaYear.topAnglers.length === 0, 'needs one or two ranked anglers at Chita this year');
  await go(page, `/balti/${ID.chita}/clasament?perioada=year`);
  await expect(page.getByTestId('podium').locator('[data-ghost="3"]')).toHaveCount(1);
});

test('lakes.anglers-ranking.c3 — each podium column and row opens /pescari/[uid]', async ({ page }) => {
  // Blocked: /pescari/[id] is not on the web yet (availability.ts `angler`); flips on with it.
  test.skip(!LAKE_ON_WEB.angler, 'c3 waits on /pescari/[id] (LAKE_ON_WEB.angler)');
  await go(page, `/balti/${ID.big}/clasament?perioada=year`);
  const a1 = bigYear.topAnglers[0];
  await expect(page.getByTestId('podium').locator(`a[href="/pescari/${a1.uid}"]`)).toBeVisible();
  await expect(page.getByTestId('angler-rows').locator('a[href^="/pescari/"]')).toHaveCount(bigYear.topAnglers.length - 3);
});

test('lakes.stands-ranking.c3 lakes.stands-ranking.s3 — no stand activity: the empty card alone (no «0 standuri» line), the sort inert', async ({ page }) => {
  await faults(page, ID.chita, ['stats']);
  await page.route('**/feed/community/stats**', route => json(route, { data: { ...chitaYear, stands: [] } }));
  await go(page, `/balti/${ID.chita}/standuri`, DESKTOP);
  await expect(page.getByTestId('stands-count')).toHaveCount(0);
  // Nothing to sort: the docked sort is disabled; on a phone the chip row is not there.
  await expect(page.getByRole('complementary', { name: 'Ordonare standuri' }).getByRole('radio', { name: 'Capturi' })).toBeDisabled();
  await expect(page.getByTestId('stands-empty')).toContainText('Nicio activitate la standuri în perioada asta.');
  await expect(page.getByTestId('stands-empty').getByRole('link', { name: 'Vezi anul curent' })).toHaveAttribute('href', `/balti/${ID.chita}/standuri?perioada=year`);
  await expectNoA11yViolations(page);
  await page.setViewportSize(PHONE);
  await expect(page.getByRole('radiogroup', { name: 'Ordonează după' })).toHaveCount(0);
});

test('lakes.competitions.c3 — a card names its ranking type (the server label) beside Individual / Echipe, and an aligned row\'s footers share one line', async ({ page }) => {
  test.skip(chitaUpcoming.length < 2, 'needs two upcoming competitions at Chita');
  await go(page, `/balti/${ID.chita}/concursuri?tab=viitoare`, DESKTOP);
  const card = cardItems(page).first();
  await expect(card).toContainText(cardRankingLabel(chitaUpcoming[0]));
  await expect(card).toContainText(chitaUpcoming[0].format.kind === 'team' ? 'Echipe' : 'Individual');
  // Footers of one grid row on one line (Live / Viitoare: the aligned subgrid).
  const bottoms = await cardItems(page).evaluateAll(els =>
    els.slice(0, 5).map(li => ({ top: Math.round(li.getBoundingClientRect().top), bottom: Math.round(li.querySelector('article')!.getBoundingClientRect().bottom) })),
  );
  const firstRow = bottoms.filter(b => b.top === bottoms[0].top);
  expect(new Set(firstRow.map(b => b.bottom)).size).toBe(1);
});

test('lakes.gallery.c1 — ✕ after an in-site visit goes BACK (no new history entry), even on a lake page opened directly', async ({ page }) => {
  await go(page, `/balti/${ID.big}`, DESKTOP);
  await page.locator(`a[href="/balti/${ID.big}/galerie"]`).first().click();
  await expect(page).toHaveURL(new RegExp(`/balti/${ID.big}/galerie$`), { timeout: 60_000 });
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Galerie', { timeout: 60_000 });
  const length = await page.evaluate(() => history.length);
  await page.getByRole('button', { name: 'Închide galeria' }).click();
  await expect(page).toHaveURL(new RegExp(`/balti/${ID.big}$`), { timeout: 60_000 });
  expect(await page.evaluate(() => history.length)).toBe(length);
});

test('lakes.gallery.c8 lakes.catches.c5 — on a phone a horizontal swipe pages the lightbox', async ({ page }) => {
  await go(page, `/balti/${ID.big}/capturi`, PHONE);
  await page.getByTestId('catches-grid').getByRole('button').first().click();
  const box = page.getByTestId('lightbox');
  await expect(box).toContainText(`Capturi · 1 din ${bigTotal}`);
  const stage = page.getByTestId('lightbox-stage');
  const r = (await stage.boundingBox())!;
  const y = r.y + r.height / 2;
  const swipe = async (from: number, to: number) => {
    await stage.dispatchEvent('pointerdown', { pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: from, clientY: y, bubbles: true });
    await stage.dispatchEvent('pointerup', { pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: to, clientY: y + 4, bubbles: true });
  };
  await swipe(r.x + r.width * 0.8, r.x + r.width * 0.2);
  await expect(box).toContainText(`Capturi · 2 din ${bigTotal}`);
  await swipe(r.x + r.width * 0.2, r.x + r.width * 0.8);
  await expect(box).toContainText(`Capturi · 1 din ${bigTotal}`);
});

test('lakes.b.inbound-links — the lake page leads to the ranking and the catches while /partide and /statistici are not on the web', async ({ page }) => {
  test.skip(LAKE_ON_WEB.partide, 'the Partide page carries these links once it ships');
  await go(page, `/balti/${ID.big}`, DESKTOP);
  const section = page.locator('#partide');
  await expect(section.getByRole('link', { name: 'Clasament' })).toHaveAttribute('href', `/balti/${ID.big}/clasament`);
  await expect(section.getByRole('link', { name: 'Vezi capturile' })).toHaveAttribute('href', `/balti/${ID.big}/capturi`);
});

/* ============================================================================================== */
/* M1 lake-page batch 2 review — shared tiles, masonry geometry, states, competitions cards        */
/* ============================================================================================== */

/** A catches page for Belin (2 lake photos, no catch of its own): the first page of the big lake. */
const catchesFixture = () => ({ data: bigCatches, meta: { pagination: { page: 1, pageSize: 20, pageCount: 1, total: bigCatches.length } } });

test('lakes.gallery.s5 — photos on screen and a failed catches read: a successful retry hands focus to the h1, never <body>', async ({ page }) => {
  await faults(page, ID.belin, ['catches-page']);
  let fail = true;
  await page.route('**/feed/community/lakes/*/catches**', route => (fail ? json(route, { error: { status: 500 } }, 500) : json(route, catchesFixture())));
  await page.setViewportSize(PHONE);
  await page.goto(`/balti/${ID.belin}/galerie`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  const err = page.getByTestId('gallery-catches-error');
  await expect(err).toContainText('Nu am putut încărca capturile comunității.', { timeout: 60_000 });
  // «Toate» keeps the lake's photos above the error card.
  await expect(page.getByTestId('gallery-grid').locator('button[data-kind="photo"]')).toHaveCount(lakes.get(ID.belin)!.images.length);
  fail = false;
  await err.getByRole('button', { name: 'Încearcă din nou' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('gallery-grid').locator('button[data-kind="catch"]').first()).toBeVisible({ timeout: 30_000 });
  await expect.poll(() => page.evaluate(() => document.activeElement?.id)).toBe('balta-sub-titlu');
});

test('lakes.gallery.c3 lakes.gallery.c4 lakes.gallery.s1 — «Toate» waits for the catches with the skeleton (no photos-only grid that reshuffles): CLS < 0.1 with a slow catches read', async ({ page }) => {
  test.skip(lakes.get(ID.belin)!.images.length < 2, 'needs a lake with two or more photos');
  await faults(page, ID.belin, ['catches-page']);
  let release!: () => void;
  const gate = new Promise<void>(r => (release = r));
  await page.route('**/feed/community/lakes/*/catches**', async route => {
    await gate;
    return json(route, catchesFixture());
  });
  await trackCls(page);
  await page.setViewportSize(DESKTOP);
  await page.goto(`/balti/${ID.belin}/galerie`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await expect(page.getByTestId('masonry-skeleton').locator('visible=true').first()).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId('gallery-grid')).toHaveCount(0);
  release();
  await expect(page.getByTestId('gallery-grid')).toHaveAttribute('data-columns', /\d/, { timeout: 30_000 });
  await page.waitForTimeout(1500);
  expect(await readCls(page)).toBeLessThan(0.1);
  // «Foto baltă» does not wait for anything.
  await page.getByRole('radiogroup', { name: 'Arată' }).getByText('Foto baltă').click();
  await expect(page.getByTestId('gallery-grid').locator('button[data-kind="photo"]')).toHaveCount(lakes.get(ID.belin)!.images.length);
});

test('lakes.gallery.c4 — few photos are a gallery row of proper tiles: never more columns than photos, ~360px tiles, no thumbnails in a corner', async ({ page }) => {
  const n = lakes.get(ID.belin)!.images.length;
  test.skip(n < 1 || n > 4, 'needs a lake with one to four photos');
  await go(page, `/balti/${ID.belin}/galerie`, DESKTOP);
  const grid = page.getByTestId('gallery-grid');
  await expect(grid).toHaveAttribute('data-columns', String(Math.max(2, n)));
  const widths = await grid.locator('button[data-kind]').evaluateAll(els => els.map(e => Math.round(e.getBoundingClientRect().width)));
  for (const w of widths) expect(w).toBeGreaterThanOrEqual(340);
  // The chips sit on a surface strip (the page ground swallows soft-fill chips).
  expect(await page.getByTestId('gallery-filters').evaluate(e => getComputedStyle(e).backgroundColor)).not.toBe(await page.evaluate(() => getComputedStyle(document.body).backgroundColor));
});

test('lakes.catches.c2 lakes.gallery.c5 — every tile is drawn within the 4:5 → 3:2 band (no phone-screenshot towers); a catch carries the navy weight chip', async ({ page }) => {
  await go(page, `/balti/${ID.big}/capturi`, DESKTOP);
  const ratios = await page.getByTestId('catches-grid').getByRole('button').evaluateAll(els => els.map(e => e.getBoundingClientRect().width / e.getBoundingClientRect().height));
  expect(ratios.length).toBeGreaterThan(0);
  for (const r of ratios) {
    expect(r).toBeGreaterThanOrEqual(0.79);
    expect(r).toBeLessThanOrEqual(1.51);
  }
  const c0 = bigCatches.find(c => (c.photoGridUrl || c.photoUrl) && c.weightKg != null);
  if (c0) {
    const chip = page.getByTestId('catches-grid').getByRole('button').first().locator('.bg-navy');
    await expect(chip.first()).toBeVisible();
  }
});

test('lakes.gallery.c4 lakes.catches.c2 — a broken photo turns its tile 4:3 with a solid caption band (no gradient over a pale fill)', async ({ page }) => {
  const c0 = bigCatches.find(c => (c.photoGridUrl || c.photoUrl) && (c.weightKg != null || c.species))!;
  const src = (c0.photoGridUrl || c0.photoUrl)!;
  await page.route(src, route => route.fulfill({ status: 404, body: '' }));
  await go(page, `/balti/${ID.big}/capturi`);
  const tile = page.locator(`[data-testid="catches-grid"] button[data-broken="true"]`).first();
  await expect(tile).toBeVisible();
  const box = await tile.boundingBox();
  expect(box!.width / box!.height).toBeCloseTo(4 / 3, 1);
  const band = tile.locator('span.bg-surface');
  await expect(band).toBeVisible();
  expect(await band.evaluate(e => getComputedStyle(e).backgroundImage)).toBe('none');
});

test('lakes.gallery.s6 lakes.catches.c5 — while the original downloads the lightbox shows the cached rendition with «Se încarcă fotografia…», never a black stage', async ({ page }) => {
  const [c0] = bigCatches.filter(c => c.photoUrl && c.photoGridUrl && c.photoUrl !== c.photoGridUrl);
  test.skip(!c0, 'needs a catch with a grid rendition and an original');
  let release!: () => void;
  const gate = new Promise<void>(r => (release = r));
  await page.route(c0.photoUrl!, async route => {
    await gate;
    await route.continue();
  });
  await go(page, `/balti/${ID.big}/capturi?foto=${encodeURIComponent(c0.clientId)}`, DESKTOP);
  const loading = page.getByTestId('lightbox-photo-loading');
  await expect(loading).toBeVisible({ timeout: 30_000 });
  await expect(loading).toHaveText('Se încarcă fotografia…');
  release();
  await expect(loading).toHaveCount(0, { timeout: 30_000 });
});

test('lakes.stands-ranking.c2 lakes.stands-ranking.s4 — a period switch with no server data keeps the shown period\'s name on the previous stands, dimmed and busy', async ({ page }) => {
  // Week first (read in the browser too), then «Anul curent» whose read is held.
  await faults(page, ID.chita, ['stats']);
  let release!: () => void;
  const gate = new Promise<void>(r => (release = r));
  await page.route('**/feed/community/stats?*period=year*', async route => {
    await gate;
    await route.continue();
  });
  await page.route('**/feed/community/stats?*period=week*', route => json(route, { data: { ...chitaYear, stands: [] } }));
  await go(page, `/balti/${ID.chita}/standuri?perioada=week`, DESKTOP);
  await expect(page.getByTestId('stands-empty')).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('stands-empty').getByRole('link', { name: 'Vezi anul curent' }).click();
  await expect(page).toHaveURL(/perioada=year/, { timeout: 60_000 });
  const content = page.getByTestId('stands-content');
  // Whether the new page keeps the previous numbers (busy) or starts clean (skeleton), it never
  // puts the week's stands under «Anul curent».
  const header = page.locator('header').getByText(/· (Săptămâna aceasta|Anul curent)$/);
  const busy = await content.getAttribute('aria-busy');
  if (busy === 'true' && (await page.getByTestId('stands-skeleton').count()) === 0) {
    await expect(header).toHaveText(/Săptămâna aceasta$/);
    expect(Number(await content.evaluate(e => getComputedStyle(e).opacity))).toBeLessThan(1);
  }
  release();
  await expect(content).not.toHaveAttribute('aria-busy', 'true', { timeout: 30_000 });
  await expect(header).toHaveText(/Anul curent$/);
});

test('lakes.anglers-ranking.c3 — from 768 the podium names the whole angler (first names collide) at the hero size', async ({ page }) => {
  await go(page, `/balti/${ID.big}/clasament?perioada=year`, DESKTOP);
  const a1 = bigYear.topAnglers[0];
  const first = page.getByTestId('podium').locator('[data-rank="1"]');
  // The phone's first name is in the DOM too (md:hidden): a one-word name matches both spans.
  if (a1.name) await expect(first.getByText(a1.name, { exact: true }).filter({ visible: true })).toBeVisible();
  // The winner's avatar is the 64 step from 768.
  const sizes = await first.locator('span.rounded-full').evaluateAll(els => els.filter(e => e.getBoundingClientRect().width > 0).map(e => Math.round(e.getBoundingClientRect().width)));
  expect(Math.max(...sizes)).toBe(64);
  // The period card: one row of three numbers, never tall KPI tiles.
  const totals = page.getByTestId('period-totals');
  expect(await totals.evaluate(e => e.getBoundingClientRect().height)).toBeLessThan(100);
  await expect(page.getByRole('complementary', { name: 'Perioada și poziția ta' }).getByRole('link', { name: 'Clasament standuri' })).toBeVisible();
});

test('lakes.competitions.c3 — the cards are the /concursuri cards: «/20 echipe» on a team card, the followers pill on every card, no lake line, the first row eager', async ({ page }) => {
  const team = chitaUpcoming.find(c => c.format.kind === 'team' && c.capacity != null);
  test.skip(!team, 'needs an upcoming team competition with a capacity at Chita');
  await go(page, `/balti/${ID.chita}/concursuri?tab=viitoare`, PHONE);
  const card = cardItems(page).filter({ hasText: team!.name }).first();
  await expect(card).toContainText(`${team!.joinedCount}/${team!.capacity} echipe`);
  if (team!.pendingCount > 0) await expect(card).toContainText(`${team!.pendingCount} în așteptare`);
  // fish FollowersPill on every card, «0 urmăritori» included — a control that opens the list.
  const pills = page.getByRole('tabpanel').getByRole('button', { name: /urmăritor/ });
  await expect(pills).toHaveCount(chitaUpcoming.length);
  // The lake's own page never repeats the lake on its cards.
  await expect(page.getByRole('tabpanel')).not.toContainText(lakes.get(ID.chita)!.name);
  // The first row carries the LCP: its thumbnail is eager.
  await expect(cardItems(page).first().locator('img').first()).toHaveAttribute('fetchpriority', 'high');
});

test('lakes.competitions.c2 — a tab press logs fish\'s competition_list_tab_pressed with fish\'s tab ids', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __events: unknown[]; gtag: (...a: unknown[]) => void };
    w.__events = [];
    w.gtag = (...a: unknown[]) => w.__events.push(a);
  });
  await go(page, `/balti/${ID.chita}/concursuri`);
  await page.getByRole('tablist', { name: 'Concursuri la baltă' }).getByRole('tab', { name: 'Trecute' }).click();
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __events: unknown[][] }).__events.filter(e => e[1] === 'competition_list_tab_pressed')))
    .toEqual([['event', 'competition_list_tab_pressed', { tab_id: 'past', screen_name: 'Competitions List', screen_class: 'Competitions List' }]]);
});
