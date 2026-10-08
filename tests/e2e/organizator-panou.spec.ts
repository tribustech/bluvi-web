import { mkdirSync } from 'node:fs';
import type { Page, Request } from '@playwright/test';
import { expectNoA11yViolations } from './helpers/a11y';
import { collectConsoleErrors } from './helpers/console';
import { CMS, signIn } from './helpers/session';
import {
  anglerJwt,
  competitionFixture,
  dashboardFixture,
  draftFixture,
  expect,
  mockRead,
  paginated,
  S3_IMAGE,
  signInOrganizer,
  statDetailFixture,
  test,
} from './helpers/fake-organizer';

/*
 * organizer.panel (/organizator, T5) + organizer.b.signed-out-gate, role-gate, home-banner,
 * card-edit-entry, cannot-edit-started (the panel's entry), no-polling, navigation-guard.
 * fish: app/(app)/organizer/index.tsx, StatDetailSheet, CancelCompetitionSheet, HoldToConfirmButton,
 * MiniatureDraftCard, CompetitionCard (compact).
 *
 * Reads: the QA Organizer against the LOCAL CMS (dashboard, lists, stat details). Every state the
 * local data cannot show (drafts, pending > 0, pages, empty, errors, slow loads) is a route mock of
 * the browser's /api/cms reads. WRITES: the delete-draft DELETE and the cancel PUT are route-mocked
 * ONLY (the local CMS sends real pushes / e-mails) — the harness (helpers/fake-organizer) aborts any
 * other write and fails the test.
 */

const PATH = '/organizator';
const WIDTHS = [375, 1280, 1440, 1920] as const;
const SHOTS = '.shots/organizator';
mkdirSync(SHOTS, { recursive: true });
/** Mocked 5xx on purpose: the browser logs the failed resource. */
const EXPECTED_CONSOLE = [/Failed to load resource: the server responded with a status of 50\d/];

const DASH = '/competitions/organizer/dashboard';
const LIST = '/competitions/organizer/my-competitions';
const STATS = '/competitions/organizer/stat-details';

let jwt = '';
test.beforeEach(async ({ context, request }) => {
  jwt = await signInOrganizer(context, request);
});

async function open(page: Page, width = 1280, path = PATH) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(path);
  await expect(page.getByRole('heading', { level: 1, name: 'Panou organizator' })).toBeVisible();
}

const tiles = (p: Page) => p.getByRole('group', { name: 'Statistici organizator', exact: true });
const tile = (p: Page, key: string) => p.locator(`button[data-stat="${key}"]`);
const tablist = (p: Page) => p.getByRole('tablist', { name: 'Stare competiții' });
const tab = (p: Page, name: string | RegExp) => tablist(p).getByRole('tab', { name });
const panel = (p: Page) => p.getByRole('tabpanel');
const grid = (p: Page) => p.getByTestId('organizer-grid');
const cards = (p: Page) => grid(p).locator('article');
const isList = (status: string) => (r: Request) => r.method() === 'GET' && r.url().includes(`/api/cms${LIST}`) && new URL(r.url()).searchParams.get('status') === status;
const isDash = (r: Request) => r.method() === 'GET' && r.url().includes(`/api/cms${DASH}`);

async function cms<T>(page: Page, path: string): Promise<T> {
  const res = await page.request.get(`${CMS}${path}`, { headers: { Authorization: `Bearer ${jwt}` } });
  expect(res.ok(), `${path} → ${res.status()}`).toBe(true);
  return (await res.json()) as T;
}

/** A list mock answering every status from `byStatus` (pages of `pageSize`). */
async function mockLists(page: Page, byStatus: Record<string, unknown[]>, { delayMs = 0, pageSize = 10 } = {}) {
  await mockRead(page, LIST, (url) => {
    const status = url.searchParams.get('status') ?? '';
    const pageNo = Number(url.searchParams.get('page') ?? 1);
    const all = byStatus[status] ?? [];
    return { delayMs, json: paginated(all.slice((pageNo - 1) * pageSize, pageNo * pageSize), { page: pageNo, pageSize, total: all.length }) };
  });
}

async function shot(page: Page, name: string) {
  const w = page.viewportSize()?.width ?? 0;
  // Let a surface's entrance transition (sheet, dialog, docked panel) settle first.
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${SHOTS}/${name}-${w}.png`, fullPage: true });
}

test.describe('organizer.b.signed-out-gate / role-gate', () => {
  test('signed out: every M6 organizer route answers 307 /intra?next=<path+query>', async ({ browser }) => {
    const ctx = await browser.newContext();
    for (const path of [
      '/organizator',
      '/organizator/concursuri/nou/detalii?ciorna=d1',
      '/concursuri/c1/editeaza/detalii',
      '/concursuri/c1/sectoare',
      '/concursuri/c1/alocare?mansa=2',
      '/concursuri/c1/cantar',
      '/concursuri/c1/cantar/s1/w1/modificari',
      '/concursuri/c1/penalizari',
      '/concursuri/c1/penalizari/aplica?inscriere=r1',
    ]) {
      const res = await ctx.request.get(path, { maxRedirects: 0 });
      expect(res.status(), path).toBe(307);
      expect(res.headers().location, path).toContain(`/intra?next=${encodeURIComponent(path)}`);
    }
    const page = await ctx.newPage();
    await page.goto(PATH);
    await expect(page).toHaveURL(/\/intra\?next=%2Forganizator$/);
    await ctx.close();
  });

  test('c28 role-gate: a signed-in angler (not an Organizer) gets the neutral gate, no organizer read; axe', async ({ browser, request }) => {
    const angler = await anglerJwt(request);
    test.skip(!angler, 'E2E_CMS_ADMIN_TOKEN (local CMS API token) is not set in .env.local');
    const ctx = await browser.newContext({ viewport: { width: 375, height: 800 } });
    await signIn(ctx, angler!);
    const page = await ctx.newPage();
    const errors = collectConsoleErrors(page);
    const organizerReads: string[] = [];
    page.on('request', (r) => {
      if (r.url().includes('/competitions/organizer')) organizerReads.push(r.url());
    });
    await page.goto(PATH);
    await expect(page.getByRole('heading', { level: 1, name: 'Panou organizator' })).toBeVisible();
    await expect(page.getByText('Panoul organizator este disponibil doar organizatorilor.')).toBeVisible();
    const home = page.getByRole('link', { name: 'Acasă', exact: true }).last();
    await expect(home).toHaveAttribute('href', '/');
    await expect(tiles(page)).toHaveCount(0);
    await page.waitForTimeout(800);
    expect(organizerReads).toEqual([]);
    await expectNoA11yViolations(page);
    for (const w of WIDTHS) {
      await page.setViewportSize({ width: w, height: 800 });
      await shot(page, 'role-gate');
    }
    await home.click();
    await expect(page).toHaveURL(/\/$/);
    expect(errors).toEqual([]);
    await ctx.close();
  });
});

test.describe('organizer.panel', () => {
  test('c1 title + back (history, else Acasă); breadcrumb from 768; noindex', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    // Opened directly: «Înapoi» falls back to Acasă (once hydrated: the tiles are client-rendered).
    await page.goto(PATH);
    await expect(page.getByRole('heading', { level: 1, name: 'Panou organizator' })).toBeVisible();
    await expect(tiles(page)).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    await page.getByRole('button', { name: 'Înapoi' }).click();
    await expect(page).toHaveURL(/\/$/);
    // From a previous page: back returns there.
    await page.goto('/concursuri');
    await page.goto(PATH);
    await expect(tiles(page)).toBeVisible();
    await page.getByRole('button', { name: 'Înapoi' }).click();
    await expect(page).toHaveURL(/\/concursuri$/);
    // ≥768: the breadcrumb band carries the way back.
    await open(page, 1280);
    const crumbs = page.getByRole('navigation', { name: 'Cale de navigare' });
    await expect(crumbs.getByRole('link', { name: 'Acasă' })).toHaveAttribute('href', '/');
    await expect(crumbs.getByText('Panou organizator')).toBeVisible();
  });

  test('c2 the header art: decorative, plays (Web Animations), replays after the hold; still under reduced motion', async ({ page, browser }) => {
    await open(page, 375);
    const art = page.getByTestId('organizer-art');
    await expect(art).toHaveAttribute('aria-hidden', 'true');
    await expect.poll(() => art.evaluate((el) => el.getAnimations({ subtree: true }).length)).toBeGreaterThan(0);
    // One pass (2.6 s) then the 5 s hold: nothing runs mid-hold, then it plays again.
    await page.waitForTimeout(3600);
    expect(await art.evaluate((el) => el.getAnimations({ subtree: true }).filter((a) => a.playState === 'running').length)).toBe(0);
    await page.waitForTimeout(5200);
    expect(await art.evaluate((el) => el.getAnimations({ subtree: true }).filter((a) => a.playState === 'running').length)).toBeGreaterThan(0);

    const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 375, height: 800 } });
    await signIn(ctx, jwt);
    const still = await ctx.newPage();
    await still.goto(PATH);
    await expect(still.getByTestId('organizer-art')).toBeVisible();
    await still.waitForTimeout(500);
    expect(await still.getByTestId('organizer-art').evaluate((el) => el.getAnimations({ subtree: true }).length)).toBe(0);
    await ctx.close();
  });

  test('c3 four KPI tiles in fish order with the real dashboard values, % apart; c13 tab badges; c12 Ciorne first; axe', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    const real = (await cms<{ data: { pendingRegistrations: number; emptySpots: number; fillRate: number; totalOrganized: number; draftsCount: number; byStatus: Record<string, number> } }>(page, DASH)).data;
    const dash = page.waitForRequest(isDash);
    const drafts = page.waitForRequest(isList('draft'));
    await open(page, 1280);
    await dash;
    const q = new URL((await drafts).url()).searchParams;
    expect([q.get('status'), q.get('page'), q.get('pageSize')]).toEqual(['draft', '1', '10']);

    await expect(tiles(page).locator('button')).toHaveCount(4);
    const labels = await tiles(page).locator('button').evaluateAll((els) => els.map((e) => e.getAttribute('data-stat')));
    expect(labels).toEqual(['pending', 'empty', 'fill', 'total']);
    await expect(tile(page, 'pending')).toContainText('Participanți în așteptare');
    await expect(tile(page, 'pending')).toContainText(String(real.pendingRegistrations));
    await expect(tile(page, 'empty')).toContainText('Locuri libere');
    await expect(tile(page, 'empty')).toContainText(String(real.emptySpots));
    await expect(tile(page, 'fill')).toContainText('Rată de ocupare');
    await expect(tile(page, 'fill').locator('[data-number]')).toHaveText(String(real.fillRate));
    await expect(tile(page, 'fill').locator('[data-unit]')).toHaveText(' %');
    await expect(tile(page, 'total')).toContainText('Total organizate');
    await expect(tile(page, 'total')).toContainText(String(real.totalOrganized));

    // c12 / c13 — the tabs in order, Ciorne selected, a badge only where the count > 0.
    const names = await tablist(page).getByRole('tab').allInnerTexts();
    expect(names.map((n) => n.replace(/\s*\d+$/, '').trim())).toEqual(['Ciorne', 'Viitoare', 'Live', 'Încheiate', 'Anulate']);
    await expect(tab(page, /^Ciorne/)).toHaveAttribute('aria-selected', 'true');
    const expectBadge = async (name: string, n: number | undefined) => {
      if (n && n > 0) await expect(tab(page, new RegExp(`^${name}`))).toHaveAccessibleName(`${name}, ${n}`);
      else await expect(tab(page, new RegExp(`^${name}`))).toHaveAccessibleName(name);
    };
    await expectBadge('Ciorne', real.draftsCount);
    await expectBadge('Viitoare', real.byStatus.notStarted);
    await expectBadge('Live', real.byStatus.started);
    await expectBadge('Încheiate', real.byStatus.completed);
    await expectBadge('Anulate', real.byStatus.cancelled);
    await expectNoA11yViolations(page);
    expect(errors).toEqual([]);
  });

  test('c4 the pending figure pulses only when > 0 and never under reduced motion', async ({ page, browser }) => {
    await mockRead(page, DASH, { json: dashboardFixture({ pendingRegistrations: 5 }) });
    await open(page, 375);
    const pulse = tile(page, 'pending').locator('[data-pulse]');
    await expect(pulse).toBeVisible();
    expect(await pulse.evaluate((el) => el.getAnimations().length)).toBe(1);
    expect(await tile(page, 'empty').locator('span').first().evaluate((el) => el.getAnimations().length)).toBe(0);
    for (const w of WIDTHS) {
      await page.setViewportSize({ width: w, height: 900 });
      await shot(page, 'pending-pulse');
    }

    const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 375, height: 800 } });
    await signIn(ctx, jwt);
    const still = await ctx.newPage();
    await mockRead(still, DASH, { json: dashboardFixture({ pendingRegistrations: 5 }) });
    await still.goto(PATH);
    const p2 = tile(still, 'pending').locator('[data-pulse]');
    await expect(p2).toBeVisible();
    expect(await p2.evaluate((el) => el.getAnimations().length)).toBe(0);
    await ctx.close();

    const none = await browser.newContext({ viewport: { width: 375, height: 800 } });
    await signIn(none, jwt);
    const zero = await none.newPage();
    await mockRead(zero, DASH, { json: dashboardFixture({ pendingRegistrations: 0 }) });
    await zero.goto(PATH);
    await expect(tile(zero, 'pending')).toBeVisible();
    await expect(tile(zero, 'pending').locator('[data-pulse]')).toHaveCount(0);
    await none.close();
  });

  test('c5 / c16 loading: the tiles skeleton while the stats load, a card-grid skeleton while the first page loads', async ({ page }) => {
    await mockRead(page, DASH, { json: dashboardFixture(), delayMs: 2500 });
    await mockLists(page, { draft: [] }, { delayMs: 2500 });
    await page.setViewportSize({ width: 375, height: 900 });
    await page.goto(PATH);
    // The client's own skeletons (the route's streamed fallback may still sit hidden in the DOM).
    await expect(page.locator('[data-testid="stats-skeleton"]:visible')).toHaveCount(1);
    await expect(page.getByTestId('list-skeleton')).toBeVisible();
    await expect(page.getByTestId('list-skeleton').locator('li')).toHaveCount(6);
    for (const w of WIDTHS) {
      await page.setViewportSize({ width: w, height: 900 });
      await shot(page, 'loading');
    }
    await expect(tiles(page)).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('[data-testid="stats-skeleton"]:visible')).toHaveCount(0);
    await expect(panel(page).getByText('Nu ai ciorne. Creează o competiție nouă!')).toBeVisible();
  });

  test('c6 c8 c9 c10 c11 stat detail: panel per key (sheet on a phone, docked panel ≥1280), 5 a page, skeleton, empty copy, row → competition', async ({ page }) => {
    const rows = Array.from({ length: 7 }, (_, i) => statDetailFixture(i + 1, i === 1 ? { competition: { ...statDetailFixture(2).competition, competitionStatus: 'started' } } : {}));
    await mockRead(page, STATS, (url) => {
      const key = url.searchParams.get('statKey');
      const pageNo = Number(url.searchParams.get('page'));
      if (key === 'empty') return { json: paginated([], { pageSize: 5 }) };
      const slice = rows.slice((pageNo - 1) * 5, pageNo * 5);
      return { delayMs: pageNo === 1 ? 1200 : 1500, json: paginated(slice, { page: pageNo, pageSize: 5, total: rows.length }) };
    });
    // Phone: a bottom sheet (modal dialog).
    await open(page, 375);
    const req = page.waitForRequest((r) => r.url().includes(STATS));
    await tile(page, 'pending').click();
    const q = new URL((await req).url()).searchParams;
    expect([q.get('statKey'), q.get('page'), q.get('pageSize')]).toEqual(['pending', '1', '5']);
    const sheet = page.getByRole('dialog', { name: 'Participanți în așteptare' });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByTestId('stat-detail-skeleton')).toBeVisible();
    await expect(sheet.getByTestId('stat-dot')).toBeVisible();
    await shot(page, 'stat-loading');
    const list = sheet.getByRole('list', { name: 'Participanți în așteptare' });
    await expect(list.getByRole('listitem')).toHaveCount(5);
    const first = list.getByRole('listitem').first();
    await expect(first).toContainText('Concurs statistic 1');
    await expect(first).toContainText('SÂM, 10 - DUM, 11 OCT');
    await expect(first).toContainText('În viitor');
    await expect(first).toContainText('12/20 participanți');
    await expect(first).toContainText('2 în așteptare');
    await expect(list.getByRole('listitem').nth(1)).toContainText('Live');
    await expectNoA11yViolations(page);
    await shot(page, 'stat-list');
    // Next page: the footer loads it (a spinner while it comes).
    const next = page.waitForRequest((r) => r.url().includes(STATS) && new URL(r.url()).searchParams.get('page') === '2');
    await sheet.getByRole('button', { name: /Mai multe|Se încarcă/ }).click();
    await next;
    await expect(sheet.getByRole('button', { name: /Se încarcă/ })).toBeVisible();
    await expect(list.getByRole('listitem')).toHaveCount(7);
    await page.keyboard.press('Escape');
    await expect(sheet).toHaveCount(0);

    // Per-key empty copy.
    await tile(page, 'empty').click();
    const emptySheet = page.getByRole('dialog', { name: 'Locuri libere' });
    await expect(emptySheet.getByText('Nicio competiție cu locuri libere.')).toBeVisible();
    await shot(page, 'stat-empty');
    await page.keyboard.press('Escape');

    // ≥1280: the docked side panel (real rows); a row opens the competition and closes the panel.
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    const reguard = await guardAgain(page);
    await open(page, 1440);
    await tile(page, 'total').click();
    const side = page.locator('aside').filter({ has: page.getByRole('heading', { name: 'Total organizate' }) });
    await expect(side).toBeVisible();
    await expect(side.getByRole('button', { name: 'Închide' })).toBeFocused();
    const realRows = side.getByRole('list', { name: 'Total organizate' }).getByRole('link');
    await expect(realRows.first()).toBeVisible();
    await shot(page, 'stat-panel');
    // Docked beside the page, not over it: under the top bar (64 + the banner's height), and the
    // header actions, the tiles and the list all end left of the panel.
    const dock = await page.getByTestId('stat-dock').boundingBox();
    expect(dock?.y).toBe(64);
    for (const target of [
      page.getByRole('button', { name: 'Reîmprospătează' }),
      page.getByTestId('create-competition'),
      tile(page, 'total'),
      panel(page),
    ]) {
      const box = await target.boundingBox();
      expect(box!.x + box!.width).toBeLessThanOrEqual(dock!.x);
    }
    const href = await realRows.first().getAttribute('href');
    expect(href).toMatch(/^\/concursuri\/[a-z0-9]+$/);
    await realRows.first().click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
    await expect(side).toHaveCount(0);
    expect(reguard.blocked).toEqual([]);
  });

  test('c7 on scroll the tiles collapse into a chip row in the pinned band (attached to the top, the list does not jump); a chip opens its detail', async ({ page }) => {
    const many = Array.from({ length: 10 }, (_, i) => competitionFixture({ documentId: `ns${i}`, competitionStatus: 'notStarted' }));
    await mockLists(page, { draft: many.map((c, i) => ({ ...c, documentId: `d${i}`, competitionStatus: 'draft' })) });
    await open(page, 375);
    await expect(cards(page)).toHaveCount(10);
    const band = page.getByTestId('organizer-band');
    const firstCardTop = () => cards(page).first().evaluate((el) => Math.round(el.getBoundingClientRect().top + window.scrollY));
    const before = await firstCardTop();
    await expect(band).not.toHaveAttribute('data-collapsed');
    await page.evaluate(() => window.scrollTo(0, 1100));
    await expect(band).toHaveAttribute('data-collapsed', 'true');
    const chips = page.getByRole('group', { name: 'Statistici organizator, pe scurt' });
    await expect(chips.getByRole('button')).toHaveCount(4);
    await expect(chips.locator('[data-chip="pending"]')).toContainText('În așteptare');
    await expect(chips.locator('[data-chip="empty"]')).toContainText('Locuri libere');
    await expect(chips.locator('[data-chip="fill"]')).toContainText('Ocupare');
    await expect(chips.locator('[data-chip="total"]')).toContainText('Organizate');
    await page.waitForTimeout(700);
    expect(await firstCardTop()).toBe(before);
    // Owner rule 3: the band sits on the bar's bottom edge (or the top edge when the bar slid away).
    const geo = await page.evaluate(() => {
      const bar = Math.max(0, Math.round(document.querySelector('header')!.getBoundingClientRect().bottom));
      const row = Math.round(document.querySelector('[data-testid="organizer-band"]')!.getBoundingClientRect().top);
      return { bar, row };
    });
    expect(geo.row).toBe(geo.bar);
    for (const w of WIDTHS) {
      await page.setViewportSize({ width: w, height: 900 });
      await page.evaluate(() => window.scrollTo(0, 1100));
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${SHOTS}/scrolled-${w}.png` });
    }
    await page.setViewportSize({ width: 375, height: 900 });
    await page.evaluate(() => window.scrollTo(0, 1100));
    await chips.locator('[data-chip="fill"]').click();
    await expect(page.getByRole('dialog', { name: 'Rată de ocupare' })).toBeVisible();
  });

  test('c12 c14 c15 tabs: keyboard, a switch loads that status 10 a page and goes back to the top; the next page loads at the end (spinner)', async ({ page }) => {
    const ns = Array.from({ length: 13 }, (_, i) => competitionFixture({ documentId: `ns${i}`, competitionStatus: 'notStarted' }));
    await mockRead(page, LIST, (url) => {
      if (url.searchParams.get('status') !== 'notStarted') return { json: paginated([]) };
      const pageNo = Number(url.searchParams.get('page'));
      return { delayMs: pageNo === 2 ? 1500 : 0, json: paginated(ns.slice((pageNo - 1) * 10, pageNo * 10), { page: pageNo, total: 13 }) };
    });
    const pages2: string[] = [];
    page.on('request', (r) => {
      if (isList('notStarted')(r) && new URL(r.url()).searchParams.get('page') === '2') pages2.push(r.url());
    });
    await open(page, 1280);
    await page.evaluate(() => window.scrollTo(0, 300));
    await tab(page, /^Ciorne/).focus();
    const first = page.waitForRequest(isList('notStarted'));
    await page.keyboard.press('ArrowRight');
    const q = new URL((await first).url()).searchParams;
    expect([q.get('page'), q.get('pageSize')]).toEqual(['1', '10']);
    await expect(tab(page, /^Viitoare/)).toHaveAttribute('aria-selected', 'true');
    await expect(tab(page, /^Viitoare/)).toBeFocused();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    await expect(cards(page)).toHaveCount(10);
    await expect(panel(page)).toHaveAttribute('aria-labelledby', 'organizer-list-tab-notStarted');
    // The footer in range (here at once: ten cards fit the window) loads page 2, a spinner meanwhile.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect.poll(() => pages2.length).toBe(1);
    await expect(panel(page).getByRole('button', { name: /Se încarcă/ })).toBeVisible();
    await expect(cards(page)).toHaveCount(13);
    await shot(page, 'next-page');
  });

  test('c16 empty copies: Ciorne vs the other tabs', async ({ page }) => {
    await mockLists(page, {});
    await open(page, 375);
    await expect(panel(page).getByText('Nu ai ciorne. Creează o competiție nouă!')).toBeVisible();
    for (const w of WIDTHS) {
      await page.setViewportSize({ width: w, height: 900 });
      await shot(page, 'empty-ciorne');
    }
    await tab(page, /^Anulate/).click();
    await expect(panel(page).getByText('Nu ai competiții în această categorie.')).toBeVisible();
    await shot(page, 'empty-anulate');
  });

  test('c17 c18 draft cards: banner chain or the indigo placeholder, name, lake, date, «Pas N/5»; opens the wizard with ?ciorna & inapoi', async ({ page }) => {
    const withBanner = draftFixture({ documentId: 'dr1', name: 'Cupa de toamnă cu un nume foarte lung care ocupă două rânduri', banner: S3_IMAGE, startDate: '2026-10-24T05:00:00.000Z' }, [1, 2, 3]);
    const plain = draftFixture({ documentId: 'dr2', name: 'Fără afiș', lake: null, startDate: null }, []);
    await mockRead(page, DASH, { json: dashboardFixture({ draftsCount: 2 }) });
    await mockLists(page, { draft: [withBanner, plain] });
    await open(page, 1280);
    await expect(tab(page, /^Ciorne/)).toHaveAccessibleName('Ciorne, 2');
    const a = cards(page).nth(0);
    await expect(a.locator('img')).toHaveAttribute('src', /small_Pexels/);
    await expect(a).toContainText('Chita Lake');
    await expect(a).toContainText('24 oct. 2026');
    await expect(a).toContainText('Pas 3/5');
    const b = cards(page).nth(1);
    await expect(b.getByTestId('draft-placeholder')).toContainText('Ciornă');
    await expect(b).toContainText('Pas 0/5');
    await expect(b).not.toContainText('Chita Lake');
    await expect(a.getByRole('link', { name: /Cupa de toamnă/ })).toHaveAttribute(
      'href',
      '/organizator/concursuri/nou/detalii?ciorna=dr1&inapoi=%2Forganizator',
    );
    await expectNoA11yViolations(page);
    for (const w of WIDTHS) {
      await page.setViewportSize({ width: w, height: 900 });
      await shot(page, 'drafts');
    }
  });

  test('c19 c20 delete a draft: confirm copy, «Renunță» writes nothing; «Șterge» → DELETE (mocked), spinner on the card, refetch, toast; failure toast', async ({ page, organizer }) => {
    const d = draftFixture({ documentId: 'dr1', name: 'Ciorna mea' });
    let deleted = false;
    await mockLists(page, { draft: [d] });
    await organizer.mockWrite('DELETE', '/competitions/organizer/draft/dr1', () => {
      deleted = true;
      return { delayMs: 1200, json: { data: { documentId: 'dr1' } } };
    });
    await open(page, 375);
    const card = cards(page).first();
    await card.getByRole('button', { name: 'Șterge ciorna Ciorna mea' }).click();
    const dialog = page.getByRole('alertdialog', { name: 'Ștergi această ciornă?' }).or(page.getByRole('dialog', { name: 'Ștergi această ciornă?' }));
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Ciorna va fi ștearsă definitiv și nu o vei mai putea recupera.');
    await shot(page, 'delete-confirm');
    await dialog.getByRole('button', { name: 'Renunță' }).click();
    await expect(dialog).toHaveCount(0);
    expect(organizer.writes).toEqual([]);

    await card.getByRole('button', { name: 'Șterge ciorna Ciorna mea' }).click();
    const dashAfter = page.waitForRequest((r) => isDash(r) && deleted);
    const listAfter = page.waitForRequest((r) => isList('draft')(r) && deleted);
    await dialog.getByRole('button', { name: 'Șterge', exact: true }).click();
    await expect(card.getByRole('button', { name: 'Se șterge ciorna Ciorna mea' })).toHaveAttribute('aria-busy', 'true');
    await shot(page, 'deleting');
    await Promise.all([dashAfter, listAfter]);
    await expect(page.getByRole('status').getByText('Ciorna a fost ștearsă.')).toBeVisible();
    expect(organizer.writes).toEqual([{ method: 'DELETE', path: '/competitions/organizer/draft/dr1', query: '', body: undefined }]);

    // A failure: the screen's own message.
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    const errors = collectConsoleErrors(page, { ignore: EXPECTED_CONSOLE });
    const fresh = await guardAgain(page);
    await mockLists(page, { draft: [d] });
    await fresh.mockWrite('DELETE', '/competitions/organizer/draft/dr1', { status: 500, json: { error: { message: 'boom' } } });
    await page.reload();
    await cards(page).first().getByRole('button', { name: 'Șterge ciorna Ciorna mea' }).click();
    await dialog.getByRole('button', { name: 'Șterge', exact: true }).click();
    await expect(page.getByRole('alert').getByText('A apărut o eroare la ștergerea ciornei.')).toBeVisible();
    expect(fresh.blocked).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('c21 c22 b.card-edit-entry b.cannot-edit-started: compact cards link to the competition; notStarted: cancel + «Modifică» (edit wizard); started: «Modifică» → notice + «Apelează»; completed: neither', async ({ page }) => {
    const ns = competitionFixture({ documentId: 'ns1', name: 'Viitor 1', competitionStatus: 'notStarted', competitionType: 'team' });
    const st = competitionFixture({ documentId: 'st1', name: 'Live 1', competitionStatus: 'started' });
    const done = competitionFixture({ documentId: 'cp1', name: 'Gata 1', competitionStatus: 'completed' });
    await mockLists(page, { notStarted: [ns], started: [st], completed: [done] });
    await open(page, 1280);
    // Under load the click can land before hydration: retry it until the tab is really selected.
    await expect(async () => {
      await tab(page, /^Viitoare/).click();
      await expect(tab(page, /^Viitoare/)).toHaveAttribute('aria-selected', 'true', { timeout: 1_000 });
    }).toPass();
    const c = cards(page).first();
    await expect(c.getByRole('link', { name: 'Viitor 1', exact: true })).toHaveAttribute('href', '/concursuri/ns1');
    await expect(c).toContainText('2/20 echipe');
    await expect(c).toContainText('1 în așteptare');
    await expect(c).toContainText('Echipe');
    await expect(c).toContainText('Cantitate');
    await expect(c.getByRole('button', { name: 'Anulează Viitor 1' })).toBeVisible();
    await expect(c.getByRole('link', { name: 'Modifică Viitor 1' })).toHaveAttribute('href', '/concursuri/ns1/editeaza/detalii?inapoi=%2Forganizator');
    await shot(page, 'viitoare');

    await tab(page, /^Live/).click();
    const live = cards(page).first();
    await expect(live).toContainText('LIVE');
    await expect(live.getByRole('button', { name: /^Anulează/ })).toHaveCount(0);
    await live.getByRole('button', { name: 'Modifică Live 1' }).click();
    const notice = page.getByRole('dialog', { name: 'Nu poți modifica competiția' });
    await expect(notice).toBeVisible();
    await expect(notice).toContainText('Competiția a început deja. Pentru modificări, contactează echipa Bluvi.');
    await expect(notice.getByRole('link', { name: 'Apelează' })).toHaveAttribute('href', 'tel:+40733017091');
    // After the dialog's fade-in (axe reads the colours mid-transition otherwise).
    await page.waitForTimeout(500);
    await expectNoA11yViolations(page);
    await shot(page, 'cannot-edit');
    await page.keyboard.press('Escape');

    await tab(page, /^Încheiate/).click();
    const old = cards(page).first();
    await expect(old.getByRole('link', { name: 'Gata 1', exact: true })).toBeVisible();
    await expect(old.getByRole('button')).toHaveCount(0);
    await expect(old.getByRole('link', { name: /Modifică/ })).toHaveCount(0);
  });

  test('c23 c24 c25 cancel: copy, reason ≤ 280 with counter, «Renunță» clears; only a 1.5 s hold confirms → PUT (mocked) with the trimmed reason; spinner; toasts', async ({ page, organizer }) => {
    const ns = competitionFixture({ documentId: 'ns1', name: 'Cupa de anulat', competitionStatus: 'notStarted' });
    await mockLists(page, { notStarted: [ns] });
    let call = 0;
    await organizer.mockWrite('PUT', '/competitions/organizer/ns1/cancel', () => {
      call += 1;
      return { delayMs: 1200, json: { data: { documentId: 'ns1', notifiedUsers: 3, failedNotifications: call === 2 ? 1 : 0 } } };
    });
    await open(page, 375);
    await tab(page, /^Viitoare/).click();
    const card = cards(page).first();
    await card.getByRole('button', { name: 'Anulează Cupa de anulat' }).click();
    const dialog = page.getByRole('alertdialog', { name: 'Anulezi această competiție?' }).or(page.getByRole('dialog', { name: 'Anulezi această competiție?' }));
    await expect(dialog).toBeVisible();
    await expect(dialog.getByTestId('cancel-name')).toHaveText('Cupa de anulat');
    await expect(dialog).toContainText('Toți participanții vor primi o notificare și înscrierile lor vor fi anulate. Această acțiune nu poate fi anulată.');
    const reason = dialog.getByLabel('Motiv (opțional)');
    await expect(reason).toHaveAttribute('placeholder', 'ex. Vreme nefavorabilă');
    await expect(reason).toHaveAttribute('maxlength', '280');
    await expect(dialog.getByTestId('reason-counter')).toHaveText('0 / 280');
    await expectNoA11yViolations(page);
    await shot(page, 'cancel-empty');
    await reason.fill('x'.repeat(300));
    await expect(dialog.getByTestId('reason-counter')).toHaveText('280 / 280');
    await reason.fill('  Vreme nefavorabilă  ');
    await expect(dialog.getByTestId('reason-counter')).toHaveText('22 / 280');
    for (const w of WIDTHS) {
      await page.setViewportSize({ width: w, height: 900 });
      await shot(page, 'cancel-typed');
    }
    await page.setViewportSize({ width: 375, height: 900 });
    // «Renunță» closes and clears the reason.
    await dialog.getByRole('button', { name: 'Renunță' }).click();
    await expect(dialog).toHaveCount(0);
    await card.getByRole('button', { name: 'Anulează Cupa de anulat' }).click();
    await expect(dialog.getByLabel('Motiv (opțional)')).toHaveValue('');
    await dialog.getByLabel('Motiv (opțional)').fill('  Vreme nefavorabilă  ');

    // A click, or a hold shorter than 1.5 s, confirms nothing.
    const hold = dialog.getByRole('button', { name: 'Ține apăsat pentru a șterge' });
    await hold.click();
    await hold.hover();
    await page.mouse.down();
    await page.waitForTimeout(700);
    await page.mouse.up();
    await page.waitForTimeout(1200);
    expect(organizer.writes).toEqual([]);

    // A full pointer hold: PUT with the trimmed reason, busy while it runs, the card's spinner.
    const refetch = page.waitForRequest((r) => isDash(r) && call > 0);
    await hold.hover();
    await page.mouse.down();
    await page.waitForTimeout(1700);
    await page.mouse.up();
    await expect(dialog.getByRole('button', { name: /Se procesează/ })).toBeVisible();
    await expect(card.getByRole('button', { name: 'Se anulează Cupa de anulat' })).toHaveAttribute('aria-busy', 'true');
    await shot(page, 'cancelling');
    await refetch;
    await expect(page.getByRole('status').getByText('Competiția a fost anulată.', { exact: true })).toBeVisible();
    await expect(dialog).toHaveCount(0);
    expect(organizer.writes).toEqual([{ method: 'PUT', path: '/competitions/organizer/ns1/cancel', query: '', body: { reason: 'Vreme nefavorabilă' } }]);

    // Keyboard: hold Space 1.6 s; a blank reason is omitted; failedNotifications > 0 → the variant.
    await card.getByRole('button', { name: 'Anulează Cupa de anulat' }).click();
    await dialog.getByLabel('Motiv (opțional)').fill('   ');
    await dialog.getByRole('button', { name: 'Ține apăsat pentru a șterge' }).focus();
    await page.keyboard.down('Space');
    await page.waitForTimeout(1700);
    await page.keyboard.up('Space');
    await expect(page.getByRole('status').getByText('Competiția a fost anulată. Unii participanți ar putea să nu primească notificarea.')).toBeVisible();
    expect(organizer.writes[1]).toEqual({ method: 'PUT', path: '/competitions/organizer/ns1/cancel', query: '', body: {} });

    // Assistive tech (one synthetic activation, no pointer, no key held): arm, then confirm.
    await card.getByRole('button', { name: 'Anulează Cupa de anulat' }).click();
    const at = dialog.getByRole('button', { name: 'Ține apăsat pentru a șterge' });
    await at.dispatchEvent('click', { detail: 0 });
    await expect(dialog.getByRole('button', { name: 'Apasă din nou pentru a confirma' })).toBeVisible();
    expect(organizer.writes).toHaveLength(2);
    await dialog.getByRole('button', { name: 'Apasă din nou pentru a confirma' }).dispatchEvent('click', { detail: 0 });
    await expect.poll(() => organizer.writes.length).toBe(3);
  });

  test('c25 cancel failure: the screen’s message, the dialog stays', async ({ page, organizer }) => {
    const errors = collectConsoleErrors(page, { ignore: EXPECTED_CONSOLE });
    await mockLists(page, { notStarted: [competitionFixture({ documentId: 'ns1', name: 'Cupa', competitionStatus: 'notStarted' })] });
    await organizer.mockWrite('PUT', '/competitions/organizer/ns1/cancel', { status: 500, json: { error: { message: 'x' } } });
    await open(page, 1280);
    await tab(page, /^Viitoare/).click();
    await cards(page).first().getByRole('button', { name: 'Anulează Cupa' }).click();
    const dialog = page.getByRole('alertdialog', { name: 'Anulezi această competiție?' });
    const hold = dialog.getByRole('button', { name: 'Ține apăsat pentru a șterge' });
    await hold.hover();
    await page.mouse.down();
    await page.waitForTimeout(1700);
    await page.mouse.up();
    await expect(page.getByRole('alert').getByText('A apărut o eroare la anularea competiției.')).toBeVisible();
    await expect(dialog).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('c26 «Reîmprospătează» refetches the dashboard and the lists; b.no-polling: nothing refetches on its own', async ({ page }) => {
    const dashReqs: string[] = [];
    const listReqs: string[] = [];
    page.on('request', (r) => {
      if (isDash(r)) dashReqs.push(r.url());
      if (r.url().includes(`/api/cms${LIST}`)) listReqs.push(r.url());
    });
    await open(page, 1280);
    await expect(tiles(page)).toBeVisible();
    await page.waitForTimeout(6000);
    expect(dashReqs).toHaveLength(1);
    expect(listReqs).toHaveLength(1);
    await page.getByRole('button', { name: 'Reîmprospătează' }).click();
    await expect.poll(() => dashReqs.length).toBe(2);
    await expect.poll(() => listReqs.length).toBe(2);
    await expect(page.getByRole('status').filter({ hasText: 'Actualizat' })).toHaveCount(1);
  });

  test('c26 «Reîmprospătează» also refreshes the stat details (a reopened panel refetches) and reports the list’s own outcome', async ({ page }) => {
    let pending = 3;
    let listStatus = 200;
    const statReqs: string[] = [];
    page.on('request', (r) => {
      if (r.url().includes(`/api/cms${STATS}`)) statReqs.push(r.url());
    });
    await mockRead(page, DASH, () => ({ json: dashboardFixture({ pendingRegistrations: pending }) }));
    await mockRead(page, STATS, () => ({
      json: paginated(
        Array.from({ length: pending }, (_, i) => statDetailFixture(i + 1)),
        { pageSize: 5 },
      ),
    }));
    await mockRead(page, LIST, () => (listStatus === 200 ? { json: paginated([]) } : { status: listStatus, json: { error: { message: 'x' } } }));
    await open(page, 1440);
    await tile(page, 'pending').click();
    const side = page.locator('aside').filter({ has: page.getByRole('heading', { name: 'Participanți în așteptare' }) });
    await expect(side.getByRole('list').getByRole('listitem')).toHaveCount(3);
    await side.getByRole('button', { name: 'Închide' }).click();
    expect(statReqs).toHaveLength(1);

    // Refresh: 5 pending now; the reopened panel refetches and lists the 5 (staleTime would hide them).
    pending = 5;
    await page.getByRole('button', { name: 'Reîmprospătează' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Actualizat' })).toHaveCount(1);
    await tile(page, 'pending').click();
    await expect(side.getByRole('list').getByRole('listitem')).toHaveCount(5);
    expect(statReqs).toHaveLength(2);
    await side.getByRole('button', { name: 'Închide' }).click();

    // The list fails during the refresh (the dashboard succeeds): reported as failed, not «Actualizat».
    listStatus = 404;
    await page.getByRole('button', { name: 'Reîmprospătează' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Nu s-a putut actualiza' })).toHaveCount(1);
    // It recovers on the next refresh: reported as done.
    listStatus = 200;
    await page.getByRole('button', { name: 'Reîmprospătează' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Actualizat' })).toHaveCount(1);
  });

  test('c27 «Creează competiție»: fixed at the bottom on a phone, in the header from 768; opens the wizard returning here', async ({ page }) => {
    await open(page, 375);
    const phone = page.getByTestId('create-competition-phone');
    await expect(phone).toBeVisible();
    await expect(phone).toHaveAttribute('href', '/organizator/concursuri/nou/detalii?inapoi=%2Forganizator');
    const box = await phone.evaluate((el) => {
      const bar = el.parentElement!;
      return { position: getComputedStyle(bar).position, bottom: Math.round(window.innerHeight - bar.getBoundingClientRect().bottom) };
    });
    expect(box).toEqual({ position: 'fixed', bottom: 0 });
    await page.evaluate(() => window.scrollTo(0, 400));
    await expect(phone).toBeInViewport();
    await expect(page.getByTestId('create-competition')).toBeHidden();
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(page.getByTestId('create-competition')).toBeVisible();
    await expect(page.getByTestId('create-competition')).toHaveAttribute('href', '/organizator/concursuri/nou/detalii?inapoi=%2Forganizator');
    await expect(phone).toBeHidden();
  });

  test('error states (web addition): stats and list failures show a retry that recovers', async ({ page }) => {
    const errors = collectConsoleErrors(page, { ignore: EXPECTED_CONSOLE });
    let fail = true;
    await mockRead(page, DASH, () => (fail ? { status: 500, json: { error: { message: 'x' } } } : { json: dashboardFixture() }));
    await mockRead(page, LIST, () => (fail ? { status: 500, json: { error: { message: 'x' } } } : { json: paginated([]) }));
    await page.setViewportSize({ width: 375, height: 900 });
    await page.goto(PATH);
    await expect(page.getByText('Statisticile nu s-au putut încărca.')).toBeVisible({ timeout: 20_000 });
    await expect(panel(page).getByText('Competițiile nu s-au putut încărca.')).toBeVisible({ timeout: 20_000 });
    await expectNoA11yViolations(page);
    for (const w of WIDTHS) {
      await page.setViewportSize({ width: w, height: 900 });
      await shot(page, 'error');
    }
    fail = false;
    await page.getByRole('button', { name: 'Încearcă din nou' }).first().click();
    await expect(tiles(page)).toBeVisible();
    await panel(page).getByRole('button', { name: 'Încearcă din nou' }).click();
    await expect(panel(page).getByText('Nu ai ciorne. Creează o competiție nouă!')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('real data at 4 widths (Viitoare, unmocked): screenshots, axe at 375 and 1920', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await open(page, 375);
    await tab(page, /^Viitoare/).click();
    await expect(cards(page).first()).toBeVisible();
    await expectNoA11yViolations(page);
    for (const w of WIDTHS) {
      await page.setViewportSize({ width: w, height: 900 });
      await page.waitForTimeout(300);
      await shot(page, 'real-viitoare');
    }
    await expectNoA11yViolations(page);
    expect(errors).toEqual([]);
  });

  test('b.navigation-guard: a double activation of a card opens its page once', async ({ page }) => {
    await mockLists(page, { notStarted: [competitionFixture({ documentId: 'ns1', name: 'Dublu', competitionStatus: 'notStarted' })] });
    await open(page, 1280);
    await tab(page, /^Viitoare/).click();
    const before = await page.evaluate(() => history.length);
    await cards(page).first().getByRole('link', { name: 'Dublu', exact: true }).dblclick();
    await expect(page).toHaveURL(/\/concursuri\/ns1$/);
    await page.waitForTimeout(800);
    expect(await page.evaluate(() => history.length)).toBe(before + 1);
  });

  test('b.home-banner: Acasă and the top bar’s Administrare menu link the panel', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');
    await page.getByRole('button', { name: /Administrare/ }).click();
    await expect(page.getByRole('menuitem', { name: /Concursurile mele/ })).toHaveAttribute('href', '/organizator');
    await page.keyboard.press('Escape');
    await expect(page.locator('main a[href="/organizator"]:visible').first()).toBeVisible({ timeout: 20_000 });
  });
});

/** A second guard after `unrouteAll` (the fixture's routes are gone with it). */
async function guardAgain(page: Page) {
  const { guardCmsWrites } = await import('./helpers/fake-organizer');
  return guardCmsWrites(page);
}
