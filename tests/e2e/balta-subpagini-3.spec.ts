import { expectNoA11yViolations } from './helpers/a11y';
import { CMS, qaJwt, signIn } from './helpers/session';
import { expect, test, type ConsoleMessage, type Page, type Route } from '@playwright/test';

/*
 * The lake's subpages, batch 3 — parity docs/parity/areas/lakes.yml: lakes.stats (/statistici),
 * lakes.partide (/partide), lakes.map (/harta), lakes.reviews (/recenzii). Each test names the
 * criterion / state ids it covers (state ids: s<n> = the n-th entry of the screen's `states`).
 *
 * Lakes in the local CMS (override with E2E_LAKE_*):
 *  - Ceorpelarilor: a year of community stats, ~240 finished partide, ~880 catch photos;
 *  - Chita (the QA user's lake): 21 stands (one placed on the map: «7»), one review, 3 partide;
 *  - Belin: no partidă, no stand, no review.
 * The first reads are server-side: their failures go through the dev-only fault switch (POST
 * /balti/<id>/e2e-fault — reads `stats`, `partide`, `stand-stats`, `reviews-page`); with the server
 * read failed the browser reads it, and page.route shapes or fails that read. No CMS writes: the
 * review delete is answered by page.route.
 *
 * Blocked criteria are never cited in a title (so /web-drift does not count them as covered):
 * lakes.stats c8 (a top-3 row opens /pescari/[id], M2) and c9 (the record opens its partidă, M4),
 * lakes.partide c4 («Începe o partidă aici» → /partide/incepe, M4), c8 («Vezi rezumatul») and c9 (a
 * card opens its partidă, M4), lakes.reviews c5 (an author opens /pescari/[id], M2), c6 («Editează» →
 * /recenzie?editare=1, M3) and c9 (signed in, «Adaugă o recenzie» → /recenzie, M3). The tests below assert the interim state (no dead link) under a
 * «blocked:» note; flip them with the hrefs in _components/availability.ts.
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

type Lake = { documentId: string; name: string; coordinates: { lat: string; long: string } | null; reviewsMeta: { quality: number; facilities: number; atmosphere: number; count: number } | null };
type Stats = {
  totals: { partide: number; anglers: number; catches: number; totalKg: number };
  topAnglers: { uid: string; name: string | null; totalKg: number }[];
  species: { name: string; pct: number }[];
  weeklySeries: { label: string; count: number }[];
  record: { weightKg: number; sessionDocumentId: string | null; photoUrl?: string | null } | null;
  stands?: { standId: string; name: string; partide: number; catches: number; totalKg: number; recordKg: number | null }[];
};
type StandStats = { standId: string; name: string; coordinates: { latitude: number | null; longitude: number | null }; biggestFish: number; totalCatchesCount: number; quality: number | null };
type Review = { documentId: string; author: { documentId: string; username: string | null } | null; recommendToOthers: boolean; comment: string | null; verified?: boolean; createdAt: string };

const lakes = new Map<string, Lake>();
let bigYear: Stats;
let bigMonth: Stats;
let chitaYear: Stats;
let bigHistoryTotal = 0;
let chitaStands: StandStats[] = [];
let chitaReviews: Review[] = [];
let bigSection: { stats: { activeNow: number; catchesThisMonth: number; recordKg: number | null }; activeSessions: unknown[]; monthlyActivity: unknown[] };
let jwt = '';

/** The rankings' kg (_sub/stats rankKg): always two decimals, the Romanian comma. */
const kg2 = (n: number) => n.toFixed(2).replace('.', ',');

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
  bigYear = (await (await request.get(`${CMS}/feed/community/stats?period=year&venue=lake:${ID.big}`)).json()).data;
  bigMonth = (await (await request.get(`${CMS}/feed/community/stats?period=month&venue=lake:${ID.big}`)).json()).data;
  chitaYear = (await (await request.get(`${CMS}/feed/community/stats?period=year&venue=lake:${ID.chita}`)).json()).data;
  bigHistoryTotal = (await (await request.get(`${CMS}/feed/community/history?page=1&pageSize=10&venue=lake:${ID.big}`)).json()).meta.pagination.total;
  bigSection = (await (await request.get(`${CMS}/feed/community/lakes/${ID.big}`)).json()).data;
  chitaStands = await (await request.get(`${CMS}/lakes/${ID.chita}/statistics`)).json();
  chitaReviews = (await (await request.get(`${CMS}/feed/lakes/${ID.chita}/reviews?page=1&pageSize=10`)).json()).data;
  jwt = await qaJwt(request);
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
    // Photos / tiles of the local test data that fail are the data's, not the page's.
    if (msg.type() === 'error' && !/Failed to load resource|ERR_|net::|e2e fault/.test(msg.text())) errors.push(msg.text());
  });
  page.on('pageerror', err => errors.push(`pageerror: ${err.message}`));
  return errors;
}

const settle = (page: Page) => page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});

async function go(page: Page, path: string, viewport = PHONE) {
  await page.setViewportSize(viewport);
  const res = await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  expect(res?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1 })).toBeAttached({ timeout: 60_000 });
  await settle(page);
}

async function expectNoHorizontalScroll(page: Page) {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(over).toBeLessThanOrEqual(0);
}

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });

/** The browser's read of a CMS path (direct or through the same-origin proxy). */
const cms = (path: string) => (url: URL) => url.pathname.endsWith(`/api${path}`) || url.pathname.endsWith(`/api/cms${path}`);

/* ============================================================================================== */
/* Statistici — lakes.stats                                                                        */
/* ============================================================================================== */

test('lakes.stats.c1 lakes.stats.c2 lakes.stats.c6 lakes.stats.c7 lakes.stats.c11 lakes.stats.s5 — the year at the big lake (blocked: the top-3 rows open no profile until M2)', async ({ page }) => {
  const errors = collectConsoleErrors(page);
  const lake = lakes.get(ID.big)!;
  await go(page, `/balti/${ID.big}/statistici?perioada=year`);
  // c1
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(lake.name);
  await expect(page.getByRole('button', { name: 'Înapoi' }).first()).toBeVisible();
  // c2: three chips, the URL's period checked.
  const chips = page.getByTestId('period-chips').getByRole('radio');
  await expect(chips).toHaveCount(3);
  await expect(page.getByTestId('period-chips').locator('label')).toHaveText(['Săptămâna', 'Luna', 'Anul curent']);
  await expect(page.getByTestId('period-chips').getByRole('radio', { name: 'Anul curent' })).toBeChecked();
  // c6: partide · pescari · capturi, no kg — the T5 KPI row (compact tiles).
  const strip = page.getByTestId('stat-strip');
  await expect(strip.getByRole('group', { name: 'Perioada, pe scurt' })).toBeVisible();
  await expect(strip.getByTestId('stat-value')).toHaveText([String(bigYear.totals.partide), String(bigYear.totals.anglers), bigYear.totals.catches.toLocaleString('ro-RO')]);
  await expect(strip).not.toContainText('kg');
  // c7
  if (bigYear.weeklySeries.length) await expect(page.getByTestId('activity-card')).toBeVisible();
  // c8: three anglers and «Clasament ›» carrying the period.
  const top = page.getByTestId('top-anglers').getByTestId('top-angler');
  await expect(top).toHaveCount(Math.min(3, bigYear.topAnglers.length));
  await expect(top.first()).toContainText(bigYear.topAnglers[0].name ?? 'Pescar');
  // The rankings' grammar (Clasament's RankRow): the place pill, kg with two decimals and the unit.
  await expect(top.first().getByTestId('rank-value')).toHaveText(`${kg2(bigYear.topAnglers[0].totalKg)}kg`);
  await expect(top.first()).toContainText('Locul 1');
  // An unweighed angler: «—» muted, no «kg» under it (the stands card's rule).
  const unweighed = bigYear.topAnglers.slice(0, 3).findIndex(a => !(a.totalKg > 0));
  if (unweighed >= 0) {
    await expect(top.nth(unweighed).getByTestId('rank-value')).toHaveText('—');
    await expect(top.nth(unweighed).getByTestId('rank-value').locator('span').first()).toHaveClass(/text-muted/);
  }
  await expect(page.getByTestId('top-anglers-ranking')).toHaveAttribute('href', `/balti/${ID.big}/clasament?perioada=year`);
  // c11
  if (bigYear.species.length) {
    const species = page.getByTestId('species-card').locator('visible=true').locator('li');
    await expect(species).toHaveCount(bigYear.species.length);
    // The share with the Romanian comma («14,5%»), never «14.5%».
    const s0 = bigYear.species[0];
    await expect(species.first()).toContainText(`${String(s0.pct).replace('.', ',')}%`);
    await expect(page.getByTestId('species-card').locator('visible=true')).not.toContainText(/\d\.\d%/);
  }
  await expectNoHorizontalScroll(page);
  await expectNoA11yViolations(page);
  expect(errors).toEqual([]);
});

test('lakes.stats.c10 lakes.stats.s5 — «Top standuri»: sort chips, top 5 with bars vs the leader, «Clasament ›» with the period and the sort', async ({ page }) => {
  const stands = chitaYear.stands ?? [];
  test.skip(!stands.length, 'no stand activity at Chita this year');
  await go(page, `/balti/${ID.chita}/statistici?perioada=year`, TABLET);
  const card = page.getByTestId('top-stands');
  const rows = card.locator('li');
  await expect(rows).toHaveCount(Math.min(5, stands.length));
  const group = page.getByRole('radiogroup', { name: 'Ordonează standurile după' });
  await expect(group.locator('label')).toHaveText(['Kg total', 'Capturi', 'Record']);
  await expect(group.getByRole('radio', { name: 'Kg total' })).toBeChecked();
  const byKg = [...stands].sort((x, y) => y.totalKg - x.totalKg || x.name.localeCompare(y.name, 'ro', { numeric: true }));
  await expect(rows.first()).toContainText(`Stand ${byKg[0].name}`);
  await expect(rows.first().getByTestId('stand-value')).toHaveText(kg2(byKg[0].totalKg));
  await expect(rows.first().getByTestId('rank-value')).toContainText('kg');
  // The leader's bar is full; the others are relative to it (none for a zero).
  await expect(rows.first().getByTestId('stand-bar')).toHaveAttribute('style', /width: ?100%/);
  const link = page.getByTestId('top-stands-ranking');
  await expect(link).toHaveAttribute('href', `/balti/${ID.chita}/standuri?perioada=year`);
  await group.getByText('Capturi').click();
  await expect(link).toHaveAttribute('href', `/balti/${ID.chita}/standuri?perioada=year&sortare=catches`);
  const top = [...stands].sort((x, y) => y.catches - x.catches)[0];
  await expect(rows.first().getByTestId('stand-value')).toHaveText(String(top.catches));
  await expect(rows.first().getByTestId('rank-value')).toContainText(top.catches === 1 ? 'captură' : 'capturi');
  await group.getByText('Record').click();
  await expect(link).toHaveAttribute('href', `/balti/${ID.chita}/standuri?perioada=year&sortare=record`);
  const noRecord = stands.find(s => s.recordKg == null);
  if (noRecord) await expect(rows.last().getByTestId('stand-value')).toHaveText('—');
  await expectNoA11yViolations(page);
});

test('lakes.stats.c2 lakes.stats.c3 lakes.stats.c12 lakes.stats.s4 — a period switch replaces the URL, keeps the previous figures dimmed with a spinner, then lands', async ({ page }) => {
  await go(page, `/balti/${ID.big}/statistici?perioada=year`);
  await expect(page.getByTestId('period-chips').getByRole('radio', { name: 'Anul curent' })).toBeChecked();
  const length = await page.evaluate(() => history.length);
  let release = () => {};
  const gate = new Promise<void>(r => (release = r));
  await page.route(url => url.pathname.endsWith('/feed/community/stats') && url.searchParams.get('period') === 'week', async route => {
    await gate;
    await route.continue();
  });
  await page.getByTestId('period-chips').getByText('Săptămâna').click();
  await expect(page).toHaveURL(/\?perioada=week$/);
  // c3: the year's figures stay, dimmed and inert, the spinner beside the chips.
  const content = page.getByTestId('stats-content');
  await expect(content).toHaveClass(/opacity-60/);
  await expect(content).toHaveAttribute('inert', '');
  await expect(page.getByTestId('period-chips').locator('svg.animate-spin, [class*="animate-spin"]').first()).toBeVisible();
  await expect(page.getByTestId('stat-strip').getByTestId('stat-value').first()).toHaveText(String(bigYear.totals.partide));
  release();
  await expect(content).not.toHaveClass(/opacity-60/);
  expect(await page.evaluate(() => history.length), 'the chips replace the entry, never push').toBe(length);
  // Back to the year comes from the cache (c12: the previous period is kept) — no dimming.
  await page.getByTestId('period-chips').getByText('Anul curent').click();
  await expect(page).toHaveURL(/\?perioada=year$/);
  await expect(page.getByTestId('stat-strip').getByTestId('stat-value').first()).toHaveText(String(bigYear.totals.partide));
  await expect(content).not.toHaveClass(/opacity-60/);
  // Luna (empty at this lake now or not) is the default: it leaves the URL bare.
  await page.getByTestId('period-chips').getByText('Luna').click();
  await expect(page).toHaveURL(new RegExp(`/balti/${ID.big}/statistici$`));
  if (bigMonth.totals.partide === 0) await expect(page.getByTestId('stats-empty')).toBeVisible();
});

test('lakes.stats.c5 lakes.stats.s3 — an empty period: «Nicio partidă în perioada selectată.» with the chips kept', async ({ page }) => {
  await go(page, `/balti/${ID.belin}/statistici`);
  await expect(page.getByTestId('stats-empty')).toContainText('Nicio partidă în perioada selectată.');
  await expect(page.getByTestId('period-chips').getByRole('radio')).toHaveCount(3);
  await expect(page.getByTestId('stat-strip')).toHaveCount(0);
  await expectNoA11yViolations(page);
  // From 1280 the three tracks stay (the centre never jumps sideways): the right column says there
  // is no record, the centre says there is no partidă — once each.
  await page.setViewportSize(DESKTOP);
  const aside = page.getByRole('complementary', { name: 'Recordul și speciile' });
  await expect(aside).toContainText('Nicio captură cu record în această perioadă.');
  await expect(page.getByText(/Nicio partidă/)).toHaveCount(1);
});

test('lakes.stats.s3 lakes.stats.s5 — from 1280 the centre column keeps its place between a period with figures and an empty one', async ({ page }) => {
  test.skip(bigMonth.totals.partide > 0 || !bigYear.totals.partide, 'needs an empty month and a year with figures at the big lake');
  await go(page, `/balti/${ID.big}/statistici?perioada=year`, DESKTOP);
  const content = page.getByTestId('stats-content');
  const data = (await content.boundingBox())!;
  await page.locator('label:has(input[name^="perioada-col-"])', { hasText: 'Luna' }).locator('visible=true').first().click();
  await expect(page.getByTestId('stats-empty')).toBeVisible({ timeout: 30_000 });
  const empty = (await content.boundingBox())!;
  expect(Math.abs(empty.x - data.x)).toBeLessThan(2);
  expect(Math.abs(empty.width - data.width)).toBeLessThan(2);
});

test('lakes.stats.c4 lakes.stats.s1 lakes.stats.s2 — the skeleton, then the error (never the empty copy); the retry reads again', async ({ page }) => {
  await faults(page, ID.big, ['stats']);
  let fail = true;
  let release = () => {};
  const gate = new Promise<void>(r => (release = r));
  await page.route(url => url.pathname.endsWith('/feed/community/stats'), async route => {
    await gate;
    if (fail) await route.abort();
    else await route.continue();
  });
  await page.setViewportSize(PHONE);
  await page.goto(`/balti/${ID.big}/statistici?perioada=year`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('stats-skeleton').locator('visible=true').first()).toBeVisible({ timeout: 60_000 });
  release();
  const error = page.getByTestId('stats-error');
  await expect(error).toContainText('Nu am putut încărca statisticile.');
  await expect(page.getByTestId('stats-empty')).toHaveCount(0);
  await expect(page.getByTestId('period-chips').getByRole('radio')).toHaveCount(3);
  await expectNoA11yViolations(page);
  fail = false;
  await error.getByRole('button', { name: /Încearcă din nou|Reîncearcă/ }).click();
  await expect(page.getByTestId('stat-strip')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
});

test('lakes.stats — the record of the period (blocked: it opens its partidă once /partide/[id] ships, M4)', async ({ page }) => {
  test.skip(!bigYear.record, 'no record this year');
  await go(page, `/balti/${ID.big}/statistici?perioada=year`, DESKTOP);
  const hero = page.getByTestId('record-hero').locator('visible=true');
  await expect(hero).toHaveCount(1);
  await expect(hero).toContainText(`${fmtKg(bigYear.record!.weightKg)}`);
  await expect(hero.getByRole('link')).toHaveCount(0);
  // next/image (a sized rendition outside dev), loaded lazily: the hidden copy fetches nothing.
  await expect(hero.locator('img')).toHaveAttribute('loading', 'lazy');
  await expect(hero.locator('img')).toHaveAttribute('data-nimg', 'fill');
});

test('lakes.stats — a record photo that fails: the short no-photo card (gradient ground, light tag)', async ({ page }) => {
  test.skip(!bigYear.record?.photoUrl, 'no record photo this year');
  await page.route(url => url.href.startsWith(bigYear.record!.photoUrl!.split('?')[0]) || url.searchParams.get('url')?.includes('Catch_') === true, route => route.abort());
  await go(page, `/balti/${ID.big}/statistici?perioada=year`, DESKTOP);
  const hero = page.getByTestId('record-hero').locator('visible=true');
  await expect(hero.locator('img')).toHaveCount(0, { timeout: 15_000 });
  await expect(hero).toContainText(kg2(bigYear.record!.weightKg));
});

test('lakes.stats — 768: the record and the species share a row (no 720px photo, no 590px bars)', async ({ page }) => {
  test.skip(!bigYear.record || !bigYear.species.length, 'needs a record and species this year');
  await go(page, `/balti/${ID.big}/statistici?perioada=year`, TABLET);
  const hero = (await page.getByTestId('record-hero').locator('visible=true').boundingBox())!;
  const species = (await page.getByTestId('species-card').locator('visible=true').boundingBox())!;
  expect(hero.width).toBeLessThan(400);
  expect(Math.abs(hero.y - species.y)).toBeLessThan(80);
  await expectNoHorizontalScroll(page);
});

test('lakes.stats — from 1280 three columns: the period and the lake\'s pages · the figures · the record and the species', async ({ page }) => {
  await go(page, `/balti/${ID.big}/statistici?perioada=year`, LAPTOP);
  const nav = page.getByRole('navigation', { name: 'Pe această baltă' });
  await expect(nav).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Statistici' })).toHaveAttribute('aria-current', 'page');
  await expect(nav.getByRole('link', { name: 'Clasament pescari' })).toHaveAttribute('href', `/balti/${ID.big}/clasament?perioada=year`);
  await expect(page.getByRole('complementary', { name: 'Recordul și speciile' })).toBeVisible();
  // The chips row is the phone's; here the period is in the left column.
  await expect(page.getByTestId('period-chips')).toBeHidden();
  await expect(page.locator('label:has(input[name^="perioada-col-"])').locator('visible=true')).toHaveCount(3);
  await expectNoHorizontalScroll(page);
  await expectNoA11yViolations(page);
});

/* ============================================================================================== */
/* Partide — lakes.partide                                                                         */
/* ============================================================================================== */

test('lakes.partide.c1 lakes.partide.s5 lakes.partide.s6 — finished partide, 10 a page, more near the end; cards ribboned «Încheiată» (blocked: «Vezi rezumatul» and the card link wait for /partide/[id], M4)', async ({ page }) => {
  const errors = collectConsoleErrors(page);
  const lake = lakes.get(ID.big)!;
  await go(page, `/balti/${ID.big}/partide`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(lake.name);
  await expect(page.getByRole('heading', { name: 'Partide încheiate' })).toBeVisible();
  const cards = page.getByTestId('history-list').getByTestId('history-card');
  await expect(cards).toHaveCount(Math.min(10, bigHistoryTotal));
  await expect(cards.first().getByTestId('history-ribbon')).toHaveText('Încheiată');
  // c10: the refresh control is never busy on its own (no spin / aria-busy from a background read).
  await expect(page.getByTestId('partide-refresh')).not.toHaveAttribute('aria-busy', 'true');
  // Blocked (M4): the card is not a link yet (never a dead one).
  await expect(cards.first().getByRole('link')).toHaveCount(0);
  // fish fmtSpan: «73h 24m» / «45 min», never a clock-like «73:24».
  await expect(cards.first().locator('dl')).not.toContainText(/\d:\d\d/);
  await expect(cards.first().locator('dl')).toContainText(/\d+h\s?\d{2}m|\d+min/);
  if (bigHistoryTotal > 10) {
    await cards.last().scrollIntoViewIfNeeded();
    await page.mouse.wheel(0, 4000);
    await expect(cards).toHaveCount(Math.min(20, bigHistoryTotal), { timeout: 30_000 });
    // Deduplicated: every card once.
    const ids = await page.getByTestId('history-card').evaluateAll(els => els.map(e => e.textContent));
    expect(ids.length).toBe(Math.min(20, bigHistoryTotal));
  }
  await expectNoHorizontalScroll(page);
  await expectNoA11yViolations(page);
  expect(errors).toEqual([]);
});

test('lakes.partide.c6 lakes.partide.c7 — the latest catches rail (3 tiles → /capturi?foto=) and the statistics card', async ({ page }) => {
  await go(page, `/balti/${ID.big}/partide`, TABLET);
  const rail = page.getByTestId('catches-rail').locator('visible=true');
  await expect(rail.getByRole('heading')).toHaveText('Ultimele capturi');
  const tiles = rail.getByTestId('rail-tile');
  await expect(tiles).toHaveCount(3);
  await expect(tiles.first()).toHaveAttribute('href', new RegExp(`^/balti/${ID.big}/capturi\\?foto=`));
  const cta = page.getByTestId('stats-cta').locator('visible=true');
  await expect(cta).toContainText('Statisticile bălții');
  await expect(cta).toContainText('Top pescari, standuri și recorduri');
  // The kit card: its title is the stretched link.
  const ctaLink = cta.getByRole('link', { name: 'Statisticile bălții' });
  await expect(ctaLink).toHaveAttribute('href', `/balti/${ID.big}/statistici`);
  // The rail and the card are both cards, on every width.
  await expect(rail.locator('section')).toHaveCSS('background-color', await cta.locator('article').evaluate(e => getComputedStyle(e).backgroundColor));
  // A press on the card's «Vezi statisticile» goes through to the stretched link.
  const button = (await cta.getByText('Vezi statisticile').boundingBox())!;
  await page.mouse.click(button.x + button.width / 2, button.y + button.height / 2);
  await expect(page).toHaveURL(new RegExp(`/balti/${ID.big}/statistici$`));
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(lakes.get(ID.big)!.name);
});

test('lakes.partide.s3 — never had a partidă: the empty copy and «Începe o partidă aici» (blocked: the button opens the app until /partide/incepe ships, M4)', async ({ page }) => {
  await go(page, `/balti/${ID.belin}/partide`);
  const empty = page.getByTestId('partide-empty');
  await expect(empty).toContainText('Nicio partidă înregistrată la această baltă încă.');
  await expect(empty.getByTestId('start-here')).toHaveText('Începe o partidă aici');
  // fish Button preset="green": the kit success variant.
  await expect(empty.getByTestId('start-here')).toHaveClass(/bg-success/);
  await expectNoA11yViolations(page);
});

/** The lake's live section with one live partidă (the real section reshaped). */
const liveSection = () => ({
  data: {
    ...bigSection,
    stats: { ...bigSection.stats, activeNow: 1 },
    activeSessions: [
      {
        documentId: 'e2e-live-1',
        startedAt: new Date(Date.now() - 95 * 60_000).toISOString(),
        members: [{ uid: 'e2e-u1', name: 'Ion Pescaru', avatarUrl: null }],
        catchCount: 2,
        maxKg: 6.4,
        totalKg: 9.1,
        standName: '4',
        lastCatchAt: new Date().toISOString(),
      },
    ],
  },
});

test('lakes.partide.c5 lakes.partide.c10 lakes.partide.s4 — live sessions lead with the lake page\'s live card; «Reîmprospătează» reloads live + history together', async ({ page }) => {
  await faults(page, ID.big, ['partide']);
  let liveReads = 0;
  let historyReads = 0;
  await page.route(cms(`/feed/community/lakes/${ID.big}`), route => {
    liveReads += 1;
    return json(route, liveSection());
  });
  await page.route(url => url.pathname.endsWith('/feed/community/history'), route => {
    historyReads += 1;
    return route.continue();
  });
  await go(page, `/balti/${ID.big}/partide`);
  const live = page.getByTestId('live-block');
  await expect(live).toContainText('1 ACTIVI ACUM');
  await expect(live).toContainText('Ion Pescaru');
  // c5: the live card comes before the rail and the finished partide.
  const order = await page.evaluate(() => {
    const a = document.querySelector('[data-testid="live-block"]')!;
    const b = document.getElementById('partide-incheiate')!;
    return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING;
  });
  expect(order).toBeTruthy();
  const [l0, h0] = [liveReads, historyReads];
  // Below 768 the tool is the icon square (the title keeps the row); its name is still the label.
  const refresh = page.getByTestId('partide-refresh');
  await expect(refresh).toHaveAccessibleName('Reîmprospătează');
  expect((await refresh.boundingBox())!.width).toBeLessThanOrEqual(48);
  await refresh.click();
  await expect.poll(() => liveReads).toBeGreaterThan(l0);
  await expect.poll(() => historyReads).toBeGreaterThan(h0);
  await expect(refresh).not.toHaveAttribute('aria-busy', 'true');
  await expect(refresh).toBeFocused();
  await expectNoA11yViolations(page);
});

test('lakes.partide.c2 lakes.partide.c3 lakes.partide.s1 lakes.partide.s2 — the skeleton; both feeds failed: the error, never the empty copy; the retry reads both', async ({ page }) => {
  await faults(page, ID.big, ['partide']);
  let fail = true;
  let release = () => {};
  const gate = new Promise<void>(r => (release = r));
  const handler = async (route: Route) => {
    await gate;
    if (fail) await route.abort();
    else await route.continue();
  };
  await page.route(cms(`/feed/community/lakes/${ID.big}`), handler);
  await page.route(url => url.pathname.endsWith('/feed/community/history'), handler);
  await page.setViewportSize(PHONE);
  await page.goto(`/balti/${ID.big}/partide`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('partide-skeleton').locator('visible=true').first()).toBeVisible({ timeout: 60_000 });
  release();
  const error = page.getByTestId('partide-error');
  await expect(error).toContainText('Nu am putut încărca partidele.');
  await expect(page.getByTestId('partide-empty')).toHaveCount(0);
  await expectNoA11yViolations(page);
  fail = false;
  await error.getByRole('button', { name: /Încearcă din nou|Reîncearcă/ }).click();
  await expect(page.getByTestId('history-list')).toBeVisible();
});

test('lakes.partide — from 1280 the lake\'s pages on the left, the rail and the statistics card docked on the right', async ({ page }) => {
  await go(page, `/balti/${ID.big}/partide`, LAPTOP);
  const nav = page.getByRole('navigation', { name: 'Pe această baltă' });
  await expect(nav.getByRole('link', { name: 'Partide' })).toHaveAttribute('aria-current', 'page');
  // The lake's own pages too (Recenzii, Galerie, Hartă, Concursuri).
  await expect(nav.getByRole('link', { name: 'Recenzii' })).toHaveAttribute('href', `/balti/${ID.big}/recenzii`);
  await expect(nav.getByRole('link', { name: 'Hartă' })).toHaveAttribute('href', `/balti/${ID.big}/harta`);
  await expect(nav.getByRole('link', { name: 'Galerie' })).toHaveAttribute('href', `/balti/${ID.big}/galerie`);
  await expect(nav.getByRole('link', { name: 'Concursuri' })).toHaveAttribute('href', `/balti/${ID.big}/concursuri`);
  // One header height for a solo angler and a group: every card of a row starts its figures on one line.
  const bands = await page.getByTestId('history-card').locator('dl').evaluateAll(els => els.slice(0, 4).map(e => Math.round(e.getBoundingClientRect().top)));
  expect(bands[0]).toBe(bands[1]);
  expect(bands[2]).toBe(bands[3]);
  const aside = page.getByRole('complementary', { name: 'Capturi și statistici' });
  await expect(aside.getByTestId('stats-cta')).toBeVisible();
  await expectNoHorizontalScroll(page);
  await expectNoA11yViolations(page);
});

test('lakes.partide — a card\'s photo strip: fish\'s three tiles, the last one «+N» when the partidă has more photos', async ({ page, request }) => {
  type Row = { documentId: string; photos?: unknown[]; photoCount?: number };
  let found: { row: Row; index: number } | null = null;
  for (let n = 1; n <= 3 && !found; n++) {
    const res = await request.get(`${CMS}/feed/community/history?page=${n}&pageSize=10&venue=lake:${ID.big}`);
    const rows: Row[] = (await res.json()).data;
    const i = rows.findIndex(r => (r.photoCount ?? 0) > (r.photos?.length ?? 0) && (r.photos?.length ?? 0) > 0);
    if (i >= 0) found = { row: rows[i], index: (n - 1) * 10 + i };
  }
  test.skip(!found, 'no partidă with more photos than the feed sends in its first 30');
  await go(page, `/balti/${ID.big}/partide`, DESKTOP);
  const cards = page.getByTestId('history-list').getByTestId('history-card');
  while ((await cards.count()) <= found!.index) {
    await cards.last().scrollIntoViewIfNeeded();
    await page.mouse.wheel(0, 4000);
    await page.waitForTimeout(500);
  }
  const strip = cards.nth(found!.index).getByTestId('history-photos');
  const shown = Math.min(3, found!.row.photos!.length);
  await expect(strip.locator('li')).toHaveCount(shown);
  await expect(strip.getByTestId('history-photos-more')).toHaveText(`+${found!.row.photoCount! - shown}`);
  await expect(strip.locator('li').last().getByTestId('history-photos-more')).toHaveCount(1);
});

test('lakes.partide.s1 lakes.partide.s2 — from 1280 the skeleton, the error and the empty view keep the three tracks (the centre never moves sideways)', async ({ page }) => {
  await faults(page, ID.big, ['partide']);
  let release = () => {};
  const gate = new Promise<void>(r => (release = r));
  const handler = async (route: Route) => {
    await gate;
    await route.abort();
  };
  await page.route(cms(`/feed/community/lakes/${ID.big}`), handler);
  await page.route(url => url.pathname.endsWith('/feed/community/history'), handler);
  await page.setViewportSize(DESKTOP);
  await page.goto(`/balti/${ID.big}/partide`, { waitUntil: 'domcontentloaded' });
  const skeleton = page.getByTestId('partide-skeleton').locator('visible=true').first();
  await expect(skeleton).toBeVisible({ timeout: 60_000 });
  // The real «Pe această baltă» column while loading (no «Resetează»), the rail + card shapes docked.
  await expect(page.getByRole('navigation', { name: 'Pe această baltă' }).locator('visible=true')).toHaveCount(1);
  await expect(page.getByText('Resetează').locator('visible=true')).toHaveCount(0);
  const before = (await skeleton.boundingBox())!;
  release();
  const error = page.getByTestId('partide-error');
  await expect(error).toBeVisible();
  const after = (await error.boundingBox())!;
  expect(Math.abs(after.x - before.x)).toBeLessThan(2);
  await expect(page.getByRole('complementary', { name: 'Statistici' }).getByTestId('stats-cta')).toBeVisible();
  // The empty view (Belin) docks the same columns.
  await go(page, `/balti/${ID.belin}/partide`, DESKTOP);
  const empty = (await page.getByTestId('partide-empty').boundingBox())!;
  expect(Math.abs(empty.x - before.x)).toBeLessThan(2);
});

/* ============================================================================================== */
/* Hartă — lakes.map                                                                               */
/* ============================================================================================== */

test('lakes.map.c1 lakes.map.c4 lakes.map.c5 lakes.map.s3 — the satellite map at the lake, a pin per placed stand, every stand\'s card, the first selected', async ({ page }) => {
  const errors = collectConsoleErrors(page);
  const imagery: string[] = [];
  page.on('request', r => {
    if (/World_Imagery/.test(r.url())) imagery.push(r.url());
  });
  await go(page, `/balti/${ID.chita}/harta`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(`Hartă ${lakes.get(ID.chita)!.name}`);
  await expect(page.getByTestId('map-back')).toBeVisible();
  // The screen says which lake it is (the h1 is sr-only, a phone has no breadcrumb).
  await expect(page.getByTestId('map-title')).toContainText(lakes.get(ID.chita)!.name);
  await expect(page.getByTestId('map-title')).toContainText('standuri');
  const map = page.getByTestId('lake-map');
  await expect(map).toHaveAttribute('data-map-status', 'ready', { timeout: 30_000 });
  // The kit's attribution chip, never MapLibre's own control.
  await expect(page.locator('.maplibregl-ctrl-attrib')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Sursele hărții' })).toBeVisible();
  // The map fills the screen under the bar (never a zero-height canvas).
  const box = (await map.boundingBox())!;
  expect(box.height).toBeGreaterThan(500);
  expect(box.width).toBe(375);
  // c1: satellite imagery at close zoom (z ≥ 16) around the lake.
  await expect.poll(() => imagery.length).toBeGreaterThan(0);
  expect(imagery.some(u => Number(u.match(/tile\/(\d+)\//)?.[1]) >= 16)).toBeTruthy();
  // c4: the lake's pin + one per placed stand.
  const placed = chitaStands.filter(s => s.coordinates.latitude && s.coordinates.longitude);
  await expect(page.getByTestId('stand-pin')).toHaveCount(placed.length);
  await expect(page.getByTestId('lake-pin')).toHaveCount(1);
  // c5: every stand has a card; the first is selected.
  const cards = page.getByTestId('stand-card');
  await expect(cards).toHaveCount(chitaStands.length);
  const first = chitaStands[0];
  await expect(cards.first()).toHaveAttribute('data-selected', 'true');
  await expect(cards.first()).toContainText(`Stand ${first.name}`);
  // One kg rule on the card: the rankings' two decimals («12,00», «3,70»).
  await expect(cards.first()).toContainText(`Cea mai mare captură:${first.biggestFish ? `${kg2(first.biggestFish)} kg` : 'N/A'}`);
  await expect(cards.first()).toContainText(`Calitate:${first.quality ? `${kg2(first.quality)} kg` : 'N/A'}`);
  await expect(cards.first()).toContainText(`Capturi:${first.totalCatchesCount}`);
  await expectNoHorizontalScroll(page);
  // T2's controls only: no MapLibre stock zoom; phones pinch (no zoom buttons below 768).
  await expect(page.locator('.maplibregl-ctrl-zoom-in')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Mărește' })).toBeHidden();
  // The map is not wider than the window (no 50vw escape) and starts right under the bar.
  // The map canvas is MapLibre's (its own focusable canvas, labelled by the region).
  await expectNoA11yViolations(page, { exclude: ['.maplibregl-canvas'] });
  expect(errors).toEqual([]);
});

test('lakes.map — layout: the carousel from the left edge at 768 with «‹ N din M ›» as one control; docked column from 1280 on the shell edge; T2 zoom', async ({ page }) => {
  await go(page, `/balti/${ID.chita}/harta`, TABLET);
  await expect(page.getByTestId('lake-map')).toHaveAttribute('data-map-status', 'ready', { timeout: 30_000 });
  const first = (await page.getByTestId('stand-card').first().boundingBox())!;
  expect(first.x).toBeLessThan(40);
  const prev = (await page.getByRole('button', { name: 'Standul anterior' }).boundingBox())!;
  expect(prev.x).toBeLessThan(200);
  // The counter sits between the arrows, in their group, on their centre line.
  const counter = (await page.getByTestId('stands-counter').boundingBox())!;
  const next = (await page.getByRole('button', { name: 'Standul următor' }).boundingBox())!;
  expect(counter.x).toBeGreaterThan(prev.x + prev.width - 1);
  expect(counter.x + counter.width).toBeLessThan(next.x + 1);
  expect(Math.abs(counter.y + counter.height / 2 - (prev.y + prev.height / 2))).toBeLessThan(2);
  // The map starts right under the breadcrumb band (no extra white strip).
  const map = (await page.getByTestId('lake-map').boundingBox())!;
  expect(map.y).toBeLessThanOrEqual(104);
  await expect(page.getByRole('button', { name: 'Mărește' })).toBeVisible();
  for (const vp of [LAPTOP, DESKTOP]) {
    await page.setViewportSize(vp);
    const slot = (await page.getByTestId('stand-cards').boundingBox())!;
    const back = (await page.getByTestId('map-back').boundingBox())!;
    // The back square and the column on the shell's left edge (the logo's: 32 up to 1744).
    expect(back.x).toBe(32);
    expect(slot.x).toBe(32);
    expect(slot.width).toBe(380);
    expect(slot.height).toBeGreaterThan(400);
  }
  await expectNoHorizontalScroll(page);
});

test('lakes.map.c5 — a lake whose stands have no pin: one note instead of the pager and a badge on every card', async ({ page, request }) => {
  const stands: StandStats[] = await (await request.get(`${CMS}/lakes/${ID.big}/statistics`)).json();
  test.skip(!stands.length || stands.some(s => s.coordinates.latitude && s.coordinates.longitude), 'needs stands, none placed');
  await go(page, `/balti/${ID.big}/harta`, TABLET);
  await expect(page.getByTestId('stand-card')).toHaveCount(stands.length, { timeout: 30_000 });
  await expect(page.getByTestId('stands-unplaced')).toHaveText('Standurile nu sunt încă marcate pe hartă');
  await expect(page.getByText('fără pin pe hartă')).toHaveCount(0);
  await expect(page.getByTestId('stands-counter')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Standul următor' })).toHaveCount(0);
});

test('lakes.map.s3 — the stands read failed: an error card with «Încearcă din nou» in the cards\' slot; the lake pin stays', async ({ page }) => {
  await faults(page, ID.chita, ['stand-stats']);
  let fail = true;
  await page.route(url => url.pathname.endsWith(`/lakes/${ID.chita}/statistics`), route => (fail ? route.abort() : route.continue()));
  await go(page, `/balti/${ID.chita}/harta`);
  const error = page.getByTestId('stands-error');
  await expect(error).toContainText('Nu am putut încărca standurile.', { timeout: 30_000 });
  await expect(page.getByTestId('stand-cards')).toHaveCount(0);
  await expect(page.getByTestId('lake-map')).toHaveAttribute('data-map-status', 'ready', { timeout: 30_000 });
  await expect(page.getByTestId('lake-pin')).toHaveCount(1);
  fail = false;
  await error.getByRole('button', { name: 'Încearcă din nou' }).click();
  await expect(page.getByTestId('stand-card')).toHaveCount(chitaStands.length, { timeout: 30_000 });
  // Focus follows the retry to the cards (never <body>).
  await expect(page.getByTestId('stand-cards')).toBeFocused();
});

test('lakes.map.s3 — the map fails (imagery blocked): T2\'s unavailable state, announced; the stand cards stay; «Reîncearcă» keeps focus in the map', async ({ page }) => {
  await page.route(/World_Imagery/, route => route.abort());
  await go(page, `/balti/${ID.chita}/harta`);
  const failed = page.getByTestId('map-failed');
  await expect(failed).toBeVisible({ timeout: 30_000 });
  await expect(failed.getByRole('status')).toHaveText('Harta nu s-a putut încărca. Standurile rămân disponibile.');
  // The stands' figures are their own read: still there, and not under the failure block.
  await expect(page.getByTestId('stand-card')).toHaveCount(chitaStands.length);
  const button = (await failed.getByRole('button', { name: 'Reîncearcă' }).boundingBox())!;
  const slot = (await page.getByTestId('stand-cards').boundingBox())!;
  expect(button.y + button.height).toBeLessThan(slot.y);
  await expectNoA11yViolations(page);
  await page.unroute(/World_Imagery/);
  await failed.getByRole('button', { name: 'Reîncearcă' }).click();
  await expect(page.getByTestId('lake-map')).toHaveAttribute('data-map-status', 'ready', { timeout: 30_000 });
  await expect(page.locator('.maplibregl-canvas')).toBeFocused();
});

test('lakes.map.c3 lakes.map.c6 lakes.map.c7 lakes.map.s4 — cards ↔ pins: a card selects its stand and opens its callout; a callout opens Direcții', async ({ page }) => {
  const placed = chitaStands.find(s => s.coordinates.latitude && s.coordinates.longitude);
  test.skip(!placed, 'no stand placed on the map at Chita');
  await go(page, `/balti/${ID.chita}/harta`, DESKTOP);
  await expect(page.getByTestId('lake-map')).toHaveAttribute('data-map-status', 'ready', { timeout: 30_000 });
  const cards = page.getByTestId('stand-card');
  const card = cards.filter({ hasText: `Stand ${placed!.name}` }).first();
  await card.getByRole('button', { name: `Stand ${placed!.name}` }).click();
  await expect(card).toHaveAttribute('data-selected', 'true');
  const pin = page.getByTestId('stand-pin');
  await expect(pin).toHaveAttribute('data-selected', 'true');
  // c7: its callout opens the navigation choices to THAT stand.
  await pin.getByTestId('pin-callout').click();
  const dialog = page.getByRole('dialog', { name: 'Direcții' });
  await expect(dialog).toContainText(`Stand ${placed!.name}`);
  await expect(dialog.getByRole('link', { name: /Google Maps/ })).toHaveAttribute('href', new RegExp(String(placed!.coordinates.latitude)));
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  // The arrows move the selection through every stand.
  await page.getByRole('button', { name: 'Standul următor' }).click();
  const idx = chitaStands.findIndex(s => s.standId === placed!.standId);
  if (idx < chitaStands.length - 1) await expect(cards.nth(idx + 1)).toHaveAttribute('data-selected', 'true');
  // c6: a pin selects its stand (the first card after selecting the first stand by the arrows).
  await cards.first().getByRole('button').first().click();
  await expect(cards.first()).toHaveAttribute('data-selected', 'true');
  await pin.getByRole('button', { name: `Stand ${placed!.name}` }).click();
  await expect(card).toHaveAttribute('data-selected', 'true');
  await expect(pin.getByTestId('pin-callout')).toBeVisible();
  // c3: the lake's pin and its callout.
  const lakePin = page.getByTestId('lake-pin');
  await lakePin.getByRole('button', { name: /adresa bălții/ }).click();
  await lakePin.getByTestId('pin-callout').click();
  const { lat } = lakes.get(ID.chita)!.coordinates!;
  await expect(dialog).toContainText(lakes.get(ID.chita)!.name);
  await expect(dialog.getByRole('link', { name: /Waze/ })).toHaveAttribute('href', new RegExp(lat.slice(0, 6)));
});

test('lakes.map.c6 lakes.map.s4 — a phone: swiping the carousel selects that stand; pressing the pin of the centred stand never swallows the next swipe', async ({ page }) => {
  const placedIdx = chitaStands.findIndex(s => s.coordinates.latitude && s.coordinates.longitude);
  test.skip(placedIdx < 0 || chitaStands.length < 3, 'needs a placed stand and three stands at Chita');
  await go(page, `/balti/${ID.chita}/harta`);
  await expect(page.getByTestId('lake-map')).toHaveAttribute('data-map-status', 'ready', { timeout: 30_000 });
  const cards = page.getByTestId('stand-card');
  const strip = page.getByTestId('stand-cards').locator('ul');
  const swipeTo = (i: number) =>
    strip.evaluate((el, i) => {
      const c = el.querySelectorAll<HTMLElement>('[data-stand]')[i];
      el.scrollTo({ left: c.offsetLeft - (el.clientWidth - c.clientWidth) / 2, behavior: 'instant' as ScrollBehavior });
    }, i);
  const other = placedIdx === 1 ? 2 : 1;
  await swipeTo(other);
  await expect(cards.nth(other)).toHaveAttribute('data-selected', 'true');
  await swipeTo(placedIdx);
  await expect(cards.nth(placedIdx)).toHaveAttribute('data-selected', 'true');
  const pin = page.getByTestId('stand-pin');
  // Moving the carousel to a placed stand selects its pin and shows its callout (fish showCallout).
  await expect(pin).toHaveAttribute('data-selected', 'true');
  await expect(pin.getByTestId('pin-callout')).toBeVisible();
  // Its card is already centred: pressing its pin scrolls nothing — the next swipe still selects.
  await pin.getByRole('button', { name: `Stand ${chitaStands[placedIdx].name}`, exact: true }).click();
  await swipeTo(other);
  await expect(cards.nth(other)).toHaveAttribute('data-selected', 'true');
  await expect(page.getByTestId('stands-counter')).toHaveText(`${other + 1} din ${chitaStands.length}`);
});

test('lakes.map.c2 lakes.map.s1 — without coordinates: «Coordonatele bălții nu sunt disponibile»', async ({ page }) => {
  await faults(page, ID.belin, ['no-coordinates']);
  await go(page, `/balti/${ID.belin}/harta`);
  await expect(page.getByTestId('map-no-coordinates')).toHaveText('Coordonatele bălții nu sunt disponibile');
  await expect(page.getByTestId('map-back')).toBeVisible();
  await expectNoA11yViolations(page);
});

test('lakes.map.s2 — no stands: the lake\'s pin only, no cards', async ({ page }) => {
  await go(page, `/balti/${ID.belin}/harta`, TABLET);
  await expect(page.getByTestId('lake-map')).toHaveAttribute('data-map-status', 'ready', { timeout: 30_000 });
  await expect(page.getByTestId('lake-pin')).toHaveCount(1);
  await expect(page.getByTestId('stand-pin')).toHaveCount(0);
  await expect(page.getByTestId('stand-cards')).toHaveCount(0);
});

/* ============================================================================================== */
/* Recenzii — lakes.reviews                                                                        */
/* ============================================================================================== */

test('lakes.reviews.c1 lakes.reviews.c2 lakes.reviews.c4 lakes.reviews.s4 lakes.reviews.s7 lakes.reviews.s8 — the scores, the count, the explainer, the cards; signed out: the sign-in bar (blocked: the author opens no profile until M2)', async ({ page }) => {
  const errors = collectConsoleErrors(page);
  const meta = lakes.get(ID.chita)!.reviewsMeta!;
  await go(page, `/balti/${ID.chita}/recenzii`);
  // c1: the lake's name as the title, «Recenzii» under it (every lake subpage's order).
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(lakes.get(ID.chita)!.name);
  await expect(page.getByRole('button', { name: 'Înapoi' }).first()).toBeVisible();
  // c2: one decimal, comma.
  const summary = page.getByTestId('reviews-summary').locator('visible=true');
  await expect(summary.getByTestId('score-quality')).toHaveText(meta.quality.toFixed(1).replace('.', ','));
  await expect(summary.getByTestId('score-facilities')).toHaveText(meta.facilities.toFixed(1).replace('.', ','));
  await expect(summary.getByTestId('score-atmosphere')).toHaveText(meta.atmosphere.toFixed(1).replace('.', ','));
  // Below 1280 the T5 KPI tiles (Statistici's figures): the label over the value, the stars under it.
  for (const label of ['Pescuit', 'Facilități', 'Atmosferă']) await expect(summary.getByText(label, { exact: true })).toBeVisible();
  await expect(summary.getByRole('img', { name: /din 5$/ })).toHaveCount(3);
  await expect(summary.getByTestId('reviews-count')).toHaveText(`${meta.count} ${meta.count === 1 ? 'recenzie' : 'recenzii'}`);
  await summary.getByTestId('reviews-info-link').click();
  const info = page.getByRole('dialog', { name: 'Cum funcționează recenziile' });
  await expect(info.getByRole('heading', { level: 3 })).toHaveText(['Pescuit', 'Facilități', 'Atmosferă']);
  await page.keyboard.press('Escape');
  await expect(info).toBeHidden();
  // c4: the card.
  const card = page.getByTestId('reviews-list').getByTestId('lake-review').first();
  const r = chitaReviews[0];
  await expect(card).toContainText(r.author?.username ?? 'Pescar');
  await expect(card).toContainText(r.recommendToOthers ? 'Recomandă' : 'Nu recomandă');
  await expect(card.getByText(/^acum /)).toBeVisible();
  if (r.verified) await expect(card).toContainText('Verificat');
  if (r.comment) await expect(card).toContainText(r.comment.slice(0, 20));
  // Blocked (M2): the author's profile is not a link yet (never a dead one).
  await expect(card.getByRole('link')).toHaveCount(0);
  // c9 signed out: the outlined sign-in bar → /intra, back to this list afterwards.
  const signIn = page.getByTestId('review-sign-in').locator('visible=true');
  await expect(signIn).toHaveText('Autentifică-te pentru a putea adăuga o recenzie');
  await expect(signIn).toHaveAttribute('href', `/intra?next=${encodeURIComponent(`/balti/${ID.chita}/recenzii`)}`);
  // c4: the verdict is the status pill in its tone.
  await expect(card.getByTestId('review-verdict')).toHaveAttribute('data-tone', r.recommendToOthers ? 'success' : 'danger');
  await expectNoHorizontalScroll(page);
  await expectNoA11yViolations(page);
  expect(errors).toEqual([]);
});

test('lakes.reviews.c8 lakes.reviews.s3 — no reviews: «0 recenzii» + the explainer, the sad star and the copy', async ({ page }) => {
  await go(page, `/balti/${ID.belin}/recenzii`, TABLET);
  const empty = page.getByTestId('reviews-empty');
  // fish ReviewListEmptyComponent: ReviewsCount («0 recenzii» + the explainer) leads the empty view.
  await expect(empty.getByTestId('reviews-count')).toHaveText('0 recenzii');
  await expect(page.getByTestId('reviews-count')).toHaveCount(1);
  await expect(empty.getByTestId('reviews-info-link')).toBeVisible();
  const order = await empty.evaluate(el => {
    const count = el.querySelector('[data-testid="reviews-count"]')!;
    const star = el.querySelector('svg')!;
    return count.compareDocumentPosition(star) & Node.DOCUMENT_POSITION_FOLLOWING;
  });
  expect(order).toBeTruthy();
  await empty.getByTestId('reviews-info-link').click();
  await expect(page.getByRole('dialog', { name: 'Cum funcționează recenziile' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(empty).toContainText('Momentan nu există recenzii pentru această baltă');
  await expect(empty).toContainText('Fii primul care adaugă una!');
  await expect(page.getByTestId('reviews-summary')).toHaveCount(0);
  // The kit empty card (capped, centred), the sign-in action inside it — not in the header too.
  await expect(empty.getByTestId('review-sign-in')).toBeVisible();
  await expect(page.getByTestId('review-sign-in')).toHaveCount(1);
  await expectNoHorizontalScroll(page);
  await expectNoA11yViolations(page);
  await page.setViewportSize(DESKTOP);
  // From 1280 the lake's pages on the left, as on Partide and Statistici; the three tracks stay
  // (the scores' column says there are none yet).
  await expect(page.getByRole('navigation', { name: 'Pe această baltă' }).getByRole('link', { name: 'Recenzii' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('complementary', { name: 'Scorurile bălții' })).toContainText('Scorurile apar după prima recenzie.');
});

test('lakes.reviews.c4 — «Nu recomandă» is the red (danger) pill', async ({ page }) => {
  await faults(page, ID.chita, ['reviews-page']);
  const page1 = reviewsPage(1, 1, 1);
  page1.data[0] = { ...page1.data[0], recommendToOthers: false };
  await page.route(cms(`/feed/lakes/${ID.chita}/reviews`), route => json(route, page1));
  await go(page, `/balti/${ID.chita}/recenzii`);
  const verdict = page.getByTestId('review-verdict').first();
  await expect(verdict).toHaveText('Nu recomandă');
  await expect(verdict).toHaveAttribute('data-tone', 'danger');
  await expect(verdict.locator('span').first()).toHaveClass(/bg-status-danger-bg/);
  await expectNoA11yViolations(page);
});

test('lakes.reviews.s2 — the lake read failed while the reviews are here: a compact error in the scores\' slot, the list stays', async ({ page }) => {
  await faults(page, ID.chita, ['reviews-page']);
  let fail = true;
  await page.route(cms(`/feed/lakes/${ID.chita}`), route => (fail ? route.abort() : route.continue()));
  await go(page, `/balti/${ID.chita}/recenzii`, DESKTOP);
  await expect(page.getByTestId('reviews-list').getByTestId('lake-review')).toHaveCount(chitaReviews.length);
  const aside = page.getByRole('complementary', { name: 'Scorurile bălții' });
  const error = aside.getByTestId('scores-error');
  await expect(error).toContainText('Nu am putut încărca scorurile.', { timeout: 30_000 });
  const listX = (await page.getByTestId('reviews-list').boundingBox())!.width;
  fail = false;
  await error.getByRole('button', { name: 'Încearcă din nou' }).click();
  await expect(aside.getByTestId('reviews-summary')).toBeVisible({ timeout: 30_000 });
  // Focus follows the retry to the scores (never <body>).
  await expect(aside.getByTestId('reviews-summary')).toBeFocused();
  expect((await page.getByTestId('reviews-list').boundingBox())!.width).toBe(listX);
});

test('lakes.reviews.c10 — from 1280 the loading view has the loaded page\'s tracks (pages · list · scores)', async ({ page }) => {
  await faults(page, ID.chita, ['reviews-page']);
  let release = () => {};
  const gate = new Promise<void>(r => (release = r));
  await page.route(cms(`/feed/lakes/${ID.chita}/reviews`), async route => {
    await gate;
    await route.continue();
  });
  await page.setViewportSize(DESKTOP);
  await page.goto(`/balti/${ID.chita}/recenzii`, { waitUntil: 'domcontentloaded' });
  const skeleton = page.getByTestId('reviews-skeleton').locator('visible=true').first();
  await expect(skeleton).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole('complementary', { name: 'Scorurile bălții' })).toBeVisible();
  const before = (await skeleton.boundingBox())!;
  release();
  const list = page.getByTestId('reviews-list');
  await expect(list).toBeVisible();
  const after = (await list.boundingBox())!;
  expect(Math.abs(after.x - before.x)).toBeLessThan(2);
  expect(Math.abs(after.width - before.width)).toBeLessThan(2);
});

test('lakes.reviews.c10 lakes.reviews.s1 lakes.reviews.s2 — the loading view, then the error view with a retry (no back of its own)', async ({ page }) => {
  await faults(page, ID.chita, ['reviews-page']);
  let fail = true;
  let release = () => {};
  const gate = new Promise<void>(r => (release = r));
  await page.route(cms(`/feed/lakes/${ID.chita}/reviews`), async route => {
    await gate;
    if (fail) await route.abort();
    else await route.continue();
  });
  await page.setViewportSize(PHONE);
  await page.goto(`/balti/${ID.chita}/recenzii`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('reviews-skeleton').locator('visible=true').first()).toBeVisible({ timeout: 60_000 });
  release();
  const error = page.getByTestId('reviews-error');
  await expect(error).toContainText('Nu am putut încărca recenziile.');
  await expect(error.getByRole('button', { name: 'Înapoi' })).toHaveCount(0);
  await expectNoA11yViolations(page);
  fail = false;
  await error.getByRole('button', { name: /Încearcă din nou|Reîncearcă/ }).click();
  await expect(page.getByTestId('reviews-list').getByTestId('lake-review')).toHaveCount(chitaReviews.length);
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
});

/** A page of made-up reviews (page `n` of `pages`, 10 each). */
function reviewsPage(n: number, pages: number, total: number) {
  const base = chitaReviews[0];
  return {
    data: Array.from({ length: Math.min(10, total - (n - 1) * 10) }, (_, i) => ({
      ...base,
      documentId: `e2e-review-${n}-${i}`,
      author: { documentId: `e2e-author-${n}-${i}`, username: `Pescar ${n}-${i}`, avatar: null },
      comment: `Recenzia ${n}-${i}`,
    })),
    meta: { pagination: { page: n, pageSize: 10, pageCount: pages, total } },
  };
}

test('lakes.reviews.c3 — 10 a page, the next page as the list\'s end nears', async ({ page }) => {
  await faults(page, ID.chita, ['reviews-page']);
  await page.route(cms(`/feed/lakes/${ID.chita}/reviews`), route => {
    const n = Number(new URL(route.request().url()).searchParams.get('page') ?? '1');
    expect(new URL(route.request().url()).searchParams.get('pageSize')).toBe('10');
    return json(route, reviewsPage(n, 2, 15));
  });
  await go(page, `/balti/${ID.chita}/recenzii`, PHONE);
  const cards = page.getByTestId('reviews-list').getByTestId('lake-review');
  await expect(cards).toHaveCount(10);
  await cards.last().scrollIntoViewIfNeeded();
  await page.mouse.wheel(0, 3000);
  await expect(cards).toHaveCount(15);
});

test('lakes.reviews.c7 lakes.reviews.s5 lakes.reviews.s6 — signed in: no add bar on the own review, Editează / Șterge, the confirmation, the delete (blocked: «Editează» opens the app until /recenzie ships, M3)', async ({ page, context }) => {
  await signIn(context, jwt, BASE);
  const own = chitaReviews[0];
  await page.route(cms('/feed/reviews/mine'), route => json(route, { data: own }));
  let deletes = 0;
  await page.route(url => url.pathname.includes(`/lakes/${ID.chita}/review/`), route => {
    if (route.request().method() !== 'DELETE') return route.continue();
    deletes += 1;
    return json(route, { message: 'ok' });
  });
  await go(page, `/balti/${ID.chita}/recenzii`);
  const card = page.getByTestId('reviews-list').getByTestId('lake-review').first();
  // c6
  await expect(card.getByTestId('review-edit')).toHaveText('Editează');
  await expect(card.getByTestId('review-delete')).toHaveText('Șterge');
  // c9: the viewer reviewed — no add bar.
  await expect(page.getByTestId('review-add')).toHaveCount(0);
  await expect(page.getByTestId('review-sign-in')).toHaveCount(0);
  // The review form is M3: «Editează» explains where to edit, never a dead link.
  await card.getByTestId('review-edit').click();
  await expect(page.getByTestId('review-in-app').locator('visible=true')).toContainText('aplicație');
  await page.keyboard.press('Escape');
  // c7: the confirmation — «Închide» keeps the review.
  await card.getByTestId('review-delete').click();
  const confirm = page.getByRole('alertdialog', { name: 'Ești sigur că vrei să îți ștergi recenzia?' });
  await expect(confirm.getByRole('button')).toHaveText(['Închide', 'Șterge']);
  await page.waitForTimeout(600); // the dialog's fade-in (axe reads contrast mid-transition)
  await expectNoA11yViolations(page);
  await confirm.getByRole('button', { name: 'Închide' }).click();
  await expect(confirm).toBeHidden();
  expect(deletes).toBe(0);
  // «Șterge» deletes and says so. The list's next read is a stale edge copy (the purge is queued):
  // the deleted card stays gone, focus lands on the h1 (the card and «Șterge» are gone).
  await page.route(cms(`/feed/lakes/${ID.chita}/reviews`), route => json(route, { data: chitaReviews, meta: { pagination: { page: 1, pageSize: 10, pageCount: 1, total: chitaReviews.length } } }));
  await card.getByTestId('review-delete').click();
  await confirm.getByTestId('review-delete-confirm').click();
  await expect(page.getByText('Recenzia ta a fost ștearsă cu succes.')).toBeVisible();
  expect(deletes).toBe(1);
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
  await page.waitForTimeout(1500);
  await expect(page.getByTestId('reviews-list').getByTestId('lake-review').filter({ hasText: own.author?.username ?? 'Pescar' })).toHaveCount(0);
});

test('lakes.reviews — the own-review read failed: no add / sign-in CTA (never a duplicate review)', async ({ page, context }) => {
  await signIn(context, jwt, BASE);
  await page.route(cms('/feed/reviews/mine'), route => route.abort());
  await go(page, `/balti/${ID.chita}/recenzii`);
  await page.waitForTimeout(4000);
  await expect(page.getByTestId('review-add')).toHaveCount(0);
  await expect(page.getByTestId('review-sign-in')).toHaveCount(0);
});

test('lakes.reviews.c7 — a failed delete shows the error\'s message', async ({ page, context }) => {
  await signIn(context, jwt, BASE);
  await page.route(cms('/feed/reviews/mine'), route => json(route, { data: chitaReviews[0] }));
  await page.route(url => url.pathname.includes(`/lakes/${ID.chita}/review/`), route =>
    route.request().method() === 'DELETE' ? json(route, { error: { status: 403, name: 'ForbiddenError', message: 'Forbidden' } }, 403) : route.continue(),
  );
  await go(page, `/balti/${ID.chita}/recenzii`);
  await page.getByTestId('review-delete').click();
  await page.getByTestId('review-delete-confirm').click();
  await expect(page.locator('[role="status"], [role="alert"]').filter({ hasText: /eroare|Forbidden|permisiun|acces/i }).first()).toBeVisible();
});

test('lakes.reviews.s6 — signed in without a review: «Adaugă o recenzie» (pinned on a phone, in the header from 768) (blocked: it opens the app until /recenzie ships, M3)', async ({ page, context }) => {
  await signIn(context, jwt, BASE);
  await page.route(cms('/feed/reviews/mine'), route => json(route, { data: null }));
  await go(page, `/balti/${ID.chita}/recenzii`);
  const add = page.getByTestId('review-add').locator('visible=true');
  await expect(add).toHaveText('Adaugă o recenzie');
  await add.click();
  await expect(page.getByTestId('review-in-app').locator('visible=true')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.setViewportSize(TABLET);
  await expect(page.getByTestId('review-add').locator('visible=true')).toHaveCount(1);
  await expectNoA11yViolations(page);
});

/* ============================================================================================== */
/* Shared — SEO, inbound links                                                                     */
/* ============================================================================================== */

test('lakes batch 3 — canonical, title and breadcrumb JSON-LD on every subpage; an unknown lake is not found', async ({ page }) => {
  const lake = lakes.get(ID.big)!;
  for (const [path, label] of [
    ['statistici', 'Statistici'],
    ['partide', 'Partide'],
    ['harta', 'Hartă'],
    ['recenzii', 'Recenzii'],
  ] as const) {
    await go(page, `/balti/${ID.big}/${path}`, DESKTOP);
    await expect(page).toHaveTitle(new RegExp(`${label} · ${lake.name}`));
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', new RegExp(`/balti/${ID.big}/${path}$`));
    const ld = await page.locator('script[type="application/ld+json"]').allTextContents();
    expect(ld.some(t => t.includes('BreadcrumbList') && t.includes(label))).toBeTruthy();
  }
  const res = await page.goto('/balti/nu-exista-balta-asta/statistici');
  expect(res?.status()).toBeGreaterThanOrEqual(200);
  await expect(page.getByText(/nu a fost găsită/i).first()).toBeVisible({ timeout: 60_000 });
});

test('lakes.b.inbound-links — the lake page opens Partide, Statistici, Hartă and Recenzii', async ({ page }) => {
  await go(page, `/balti/${ID.chita}`, PHONE);
  const tiles = page.getByRole('list', { name: 'Acțiuni rapide' });
  await expect(tiles.getByRole('link', { name: 'Partide' })).toHaveAttribute('href', `/balti/${ID.chita}/partide`);
  await expect(tiles.getByRole('link', { name: 'Statistici' })).toHaveAttribute('href', `/balti/${ID.chita}/statistici`);
  await expect(tiles.getByRole('link', { name: 'Hartă' })).toHaveAttribute('href', `/balti/${ID.chita}/harta`);
  await expect(page.locator('#recenzii').getByRole('link', { name: /Vezi recenzia|Vezi toate/ })).toHaveAttribute('href', `/balti/${ID.chita}/recenzii`);
  await expect(page.getByTestId('lake-mini-map')).toHaveAttribute('href', `/balti/${ID.chita}/harta`);
});
