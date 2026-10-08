import { mkdirSync } from 'node:fs';
import { expect, test, type Page, type Route } from '@playwright/test';
import { expectNoA11yViolations } from './helpers/a11y';
import { collectConsoleErrors } from './helpers/console';
import { BASE_URL } from './helpers/base-url';
import { CMS, qaJwt, signIn } from './helpers/session';

/*
 * operator.alege-balta (/operator, «Administrare lacuri», T1) + operator.b.role-gating,
 * operator.b.single-lake, operator.b.entry-points. fish: app/(app)/operator/index.tsx,
 * components/OwnedLakeCard.tsx.
 *
 * Data: the local QA user owns exactly one lake (Chita) on the LOCAL CMS, so the single-lake
 * redirect runs against the real GET /feed/owned-lakes. Every other state (several lakes, none,
 * failures, a slow read) is a route mock of the browser's proxy call /api/cms/feed/owned-lakes —
 * the server's own read (the shell's Administrare menu) is untouched. Read-only screen: no writes.
 */

const PATH = '/operator';
const WIDTHS = [375, 1280, 1440, 1920] as const;
const SHOTS = '.shots/operator-alege-balta';
/** Failed requests the specs provoke on purpose (mocked 401 / 500s) are logged by the browser. */
const EXPECTED_CONSOLE = [/Failed to load resource: the server responded with a status of (401|500)/];
const OWNED = /\/api\/cms\/feed\/owned-lakes(\?|$)/;

let jwt: string;
let chita: { documentId: string; name: string };

test.beforeAll(async ({ request }) => {
  jwt = await qaJwt(request);
  mkdirSync(SHOTS, { recursive: true });
  const res = await request.get(`${CMS}/feed/owned-lakes`, { headers: { Authorization: `Bearer ${jwt}` } });
  expect(res.ok()).toBe(true);
  const lakes = (await res.json()).data as { documentId: string; name: string }[];
  expect(lakes, 'the local QA user owns exactly one lake (Chita)').toHaveLength(1);
  chita = lakes[0]!;
});

const LAKES = [
  { documentId: 'lake-z', name: 'Lacul Zăvoi cu un nume foarte lung care nu încape pe un singur rând', coverImageUrl: null, pending: 3, active: 12, cashToCollect: 12500 },
  { documentId: 'lake-a', name: 'Balta Albă', coverImageUrl: '/images/placeholder-lake.jpg', pending: 0, active: 1, cashToCollect: 450.5 },
  // Missing stats read 0 (c8).
  { documentId: 'lake-m', name: 'Moara Veche', coverImageUrl: '/images/competition-placeholder.jpg' },
];

/**
 * The QA user owns one lake, so /operator redirects to its panel on the SERVER (c4) before any
 * browser read could be mocked. The test-only fault label makes the server's owned-lakes read count
 * as failed (page.tsx): the picker's client path runs and its read is route-mocked.
 */
async function clientPath(page: Page) {
  const { hostname } = new URL(BASE_URL);
  await page.context().addCookies([{ name: 'bluvi_e2e_fault', value: 'operator-owned-lakes', domain: hostname, path: '/' }]);
}

type Reply = { status?: number; body?: unknown; delayMs?: number };

/** Mocks the browser's owned-lakes read (client path on); `reply` per call (1-based). Returns the call count. */
async function mockOwned(page: Page, reply: (call: number) => Reply) {
  await clientPath(page);
  const calls = { n: 0 };
  await page.route(OWNED, async (r: Route) => {
    calls.n += 1;
    const { status = 200, body, delayMs } = reply(calls.n);
    if (delayMs) await new Promise((res) => setTimeout(res, delayMs));
    await r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body ?? { data: [] }) });
  });
  return calls;
}

const list = (data: unknown[]) => ({ status: 200, body: { data } });
const fail = (status: number, message = 'x') => ({ status, body: { data: null, error: { status, name: 'Error', message } } });

const cards = (page: Page) => page.getByTestId('owned-lake-card');
const heading = (page: Page) => page.getByRole('heading', { level: 1, name: 'Administrare lacuri' });

async function shoot(page: Page, name: string, widths: readonly number[] = WIDTHS) {
  for (const w of widths) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.waitForTimeout(150);
    await page.screenshot({ path: `${SHOTS}/${name}-${w}.png`, fullPage: true });
  }
}

test.describe('signed out', () => {
  test('operator.b.role-gating: /operator sends a signed-out visitor to /intra and back', async ({ page }) => {
    await page.goto(PATH);
    await expect(page).toHaveURL(/\/intra\?next=%2Foperator$/);
  });
});

test.describe('signed in', () => {
  test.beforeEach(async ({ context }) => {
    await signIn(context, jwt);
  });

  test('c4 operator.b.single-lake: one owned lake (real CMS) → replaced by its panel, no list flash, Back leaves /operator', async ({ page }) => {
    // Record whether a lake card is ever painted on /operator (it must not be, c4).
    await page.addInitScript(() => {
      const w = window as unknown as { __cardSeen?: boolean };
      new MutationObserver(() => {
        if (location.pathname === '/operator' && document.querySelector('[data-testid="owned-lake-card"]')) w.__cardSeen = true;
      }).observe(document, { childList: true, subtree: true });
    });
    await page.goto('/');
    await page.goto(PATH);
    await expect(page).toHaveURL(new RegExp(`/operator/${chita.documentId}$`), { timeout: 30_000 });
    expect(await page.evaluate(() => (window as unknown as { __cardSeen?: boolean }).__cardSeen ?? false)).toBe(false);
    // History REPLACE: Back skips the picker and returns to Acasă.
    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
  });

  test('c4 operator.b.single-lake: in-app navigation is redirected on the server — the picker never paints', async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { __pickerSeen?: boolean };
      new MutationObserver(() => {
        if (location.pathname === '/operator' && document.querySelector('[data-testid="operator-picker-loading"], [data-testid="owned-lake-card"]')) w.__pickerSeen = true;
      }).observe(document, { childList: true, subtree: true });
    });
    await page.goto('/');
    await page.waitForFunction(() => !!(window as unknown as { next?: { router?: unknown } }).next?.router);
    // A client (RSC) navigation, as a Link would do: the gate's redirect answers before any commit.
    await page.evaluate((p) => (window as unknown as { next: { router: { push: (h: string) => void } } }).next.router.push(p), PATH);
    await expect(page).toHaveURL(new RegExp(`/operator/${chita.documentId}$`), { timeout: 30_000 });
    expect(await page.evaluate(() => (window as unknown as { __pickerSeen?: boolean }).__pickerSeen ?? false)).toBe(false);
    // Replace: Back returns to Acasă, not to /operator.
    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
  });

  test('c4 fallback: the server read failed → the picker\'s client read redirects (replace)', async ({ page }) => {
    await clientPath(page);
    await page.goto('/');
    await page.goto(PATH);
    await expect(page).toHaveURL(new RegExp(`/operator/${chita.documentId}$`), { timeout: 30_000 });
    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
  });

  test('c1 c2 c6 c7 c8 c9: several lakes → the cards in server order, loader first', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await mockOwned(page, () => ({ ...list(LAKES), delayMs: 1500 }));
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(PATH);

    // c1: the header — back square + the title.
    await expect(heading(page)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Înapoi' })).toBeVisible();
    // c2: the loader while the read is out.
    await expect(page.getByTestId('operator-picker-loading')).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: 'Se încarcă bălțile…' })).toHaveCount(1);
    await shoot(page, 'loading');
    await page.setViewportSize({ width: 1280, height: 900 });

    // c6: one card per lake, server order.
    await expect(cards(page)).toHaveCount(3);
    await expect(page.getByTestId('operator-picker-loading')).toHaveCount(0);
    await expect(cards(page).getByRole('link')).toHaveCount(3);
    // c9: each card is ONE link named by the lake, to its panel.
    for (const [i, lake] of LAKES.entries()) {
      const link = cards(page).nth(i).getByRole('link');
      await expect(link).toHaveAccessibleName(lake.name);
      await expect(link).toHaveAttribute('href', `/operator/${lake.documentId}`);
    }

    // c7: cover photo, the bundled lake when there is none; the name on one line (truncated).
    await expect(cards(page).nth(0).locator('img')).toHaveAttribute('src', '/images/lake.jpeg');
    await expect(cards(page).nth(1).locator('img')).toHaveAttribute('src', '/images/placeholder-lake.jpg');
    const nameBox = await cards(page).nth(0).getByRole('link').evaluate((el) => {
      const s = getComputedStyle(el);
      return { overflow: s.textOverflow, wrap: s.whiteSpace, h: el.getBoundingClientRect().height };
    });
    expect(nameBox.overflow).toBe('ellipsis');
    expect(nameBox.wrap).toBe('nowrap');
    expect(nameBox.h).toBeLessThan(30);

    // c8: three tiles, missing values read 0, cash ro-RO with «lei» as its own element.
    const tiles = (i: number) => cards(page).nth(i).locator('dl > div');
    await expect(tiles(0)).toHaveCount(3);
    await expect(tiles(0).nth(0).locator('dt')).toHaveText('În așteptare');
    await expect(tiles(0).nth(0).locator('dd')).toHaveText('3');
    await expect(tiles(0).nth(1).locator('dt')).toHaveText('Active');
    await expect(tiles(0).nth(1).locator('dd')).toHaveText('12');
    await expect(tiles(0).nth(2).locator('dt')).toHaveText('De încasat azi');
    await expect(tiles(0).nth(2).locator('dd span').first()).toHaveText('12.500');
    await expect(tiles(0).nth(2).locator('dd span').last()).toHaveText('lei');
    await expect(tiles(1).nth(2).locator('dd span').first()).toHaveText('450,5');
    await expect(tiles(2).locator('dd span:not([aria-hidden])').filter({ hasNotText: 'lei' })).toHaveText(['0', '0', '0']);
    // Amber + teal dots on the first two tiles only.
    const dots = await tiles(0).evaluateAll((els) => els.map((el) => getComputedStyle(el.querySelector('dd > span[aria-hidden]') ?? el).backgroundColor));
    expect(dots.slice(0, 2)).toEqual(['rgb(251, 191, 36)', 'rgb(94, 234, 212)']);
    expect(await tiles(0).nth(2).locator('dd > span[aria-hidden]').count()).toBe(0);
    // Whole card is the hit area: a click on the stat tiles opens the panel.
    const box = (await tiles(1).nth(1).boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page).toHaveURL(/\/operator\/lake-a$/);
    // c6: a push — Back returns to the picker.
    await page.goBack();
    await expect(page).toHaveURL(/\/operator$/);
    await expect(cards(page)).toHaveCount(3);

    await expectNoA11yViolations(page);
    await shoot(page, 'list');
    for (const w of [375, 1920]) {
      await page.setViewportSize({ width: w, height: 900 });
      await expectNoA11yViolations(page);
    }
    // One column on a phone, several from 768 (auto-fill).
    await page.setViewportSize({ width: 375, height: 900 });
    const xs375 = await cards(page).evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().x)));
    expect(new Set(xs375).size).toBe(1);
    await page.setViewportSize({ width: 1440, height: 900 });
    const xs1440 = await cards(page).evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().x)));
    expect(new Set(xs1440).size).toBe(3);
    // No horizontal scroll at any width.
    for (const w of WIDTHS) {
      await page.setViewportSize({ width: w, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
    expect(errors).toEqual([]);
  });

  test('c9 keyboard: Tab reaches each card as one stop, Enter opens it', async ({ page }) => {
    await mockOwned(page, () => list(LAKES));
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(PATH);
    await expect(cards(page)).toHaveCount(3);
    const back = page.getByRole('button', { name: 'Înapoi' });
    await back.focus();
    await page.keyboard.press('Tab');
    await expect(cards(page).nth(0).getByRole('link')).toBeFocused();
    // The ring is drawn around the card (the stretched link's ::after outline).
    const outline = await cards(page)
      .nth(0)
      .getByRole('link')
      .evaluate((el) => getComputedStyle(el, '::after').outlineStyle);
    expect(outline).not.toBe('none');
    await page.keyboard.press('Tab');
    await expect(cards(page).nth(1).getByRole('link')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/operator\/lake-a$/);
  });

  test('c1: Back goes to the previous page, else to Acasă', async ({ page }) => {
    await mockOwned(page, () => list(LAKES));
    await page.goto(PATH);
    await expect(cards(page)).toHaveCount(3);
    // Opened directly: no in-app history → Acasă.
    await page.getByRole('button', { name: 'Înapoi' }).click();
    await expect(page).toHaveURL(/\/$/, { timeout: 30_000 });
    // From another page of the site → history back.
    await page.goto('/concursuri');
    await page.goto(PATH);
    await expect(cards(page)).toHaveCount(3);
    await page.getByRole('button', { name: 'Înapoi' }).click();
    await expect(page).toHaveURL(/\/concursuri/);
  });

  test('c5: no owned lake → «Nu administrezi niciun lac.»', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await mockOwned(page, () => list([]));
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(PATH);
    await expect(page.getByText('Nu administrezi niciun lac.', { exact: true })).toBeVisible();
    await expect(cards(page)).toHaveCount(0);
    await expect(page).toHaveURL(/\/operator$/);
    await expectNoA11yViolations(page);
    await shoot(page, 'empty');
    await page.setViewportSize({ width: 375, height: 900 });
    await expectNoA11yViolations(page);
    expect(errors).toEqual([]);
  });

  test('c3: a failed read → the error screen, «Încearcă din nou» refetches', async ({ page }) => {
    const errors = collectConsoleErrors(page, { ignore: EXPECTED_CONSOLE });
    // TanStack retries a failed query: every call fails until the user retries.
    let healthy = false;
    const calls = await mockOwned(page, () => (healthy ? list(LAKES) : fail(500)));
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(PATH);
    const alert = page.locator('main').getByRole('alert');
    await expect(alert).toContainText('Serverul nu răspunde', { timeout: 30_000 });
    await expect(alert.getByRole('button', { name: 'Încearcă din nou' })).toBeVisible();
    await expect(alert.getByRole('button', { name: 'Deconectează-te' })).toHaveCount(0);
    await expect(heading(page)).toBeVisible();
    await expectNoA11yViolations(page);
    await shoot(page, 'error');
    await page.setViewportSize({ width: 375, height: 900 });
    await expectNoA11yViolations(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    const before = calls.n;
    healthy = true;
    await alert.getByRole('button', { name: 'Încearcă din nou' }).click();
    await expect(cards(page)).toHaveCount(3);
    expect(calls.n).toBeGreaterThan(before);
    expect(errors).toEqual([]);
  });

  test('c3: a refused session (401) offers «Deconectează-te» and no retry; it signs out to /intra?next=/operator', async ({ page }) => {
    collectConsoleErrors(page, { ignore: EXPECTED_CONSOLE });
    await mockOwned(page, () => fail(401, 'Unauthorized'));
    await page.setViewportSize({ width: 375, height: 900 });
    await page.goto(PATH);
    const alert = page.locator('main').getByRole('alert');
    await expect(alert).toContainText('Sesiunea a expirat', { timeout: 30_000 });
    await expect(alert.getByRole('button', { name: 'Încearcă din nou' })).toHaveCount(0);
    await expectNoA11yViolations(page);
    await shoot(page, 'error-session');
    // A throwaway sign-out: only this browser context's cookie goes (the JWT is stateless).
    await alert.getByRole('button', { name: 'Deconectează-te' }).click();
    await expect(page).toHaveURL(/\/intra\?next=%2Foperator$/);
  });

  test('operator.b.role-gating: a 403 from the owner gate reads «Nu ai acces»', async ({ page }) => {
    collectConsoleErrors(page, { ignore: [/status of 403/] });
    await mockOwned(page, () => fail(403, 'Forbidden'));
    await page.goto(PATH);
    await expect(page.locator('main').getByRole('alert')).toContainText('Nu ai acces', { timeout: 30_000 });
  });

  test('c7: a cover that fails to load falls back to the bundled lake', async ({ page }) => {
    await page.route('**/broken-cover.jpg', (r) => r.fulfill({ status: 404, body: '' }));
    await mockOwned(page, () => list([{ ...LAKES[1], coverImageUrl: '/broken-cover.jpg' }, LAKES[2]]));
    await page.goto(PATH);
    await expect(cards(page)).toHaveCount(2);
    await expect(cards(page).nth(0).locator('img')).toHaveAttribute('src', '/images/lake.jpeg');
  });

  test('operator.b.entry-points: Acasă and the top bar’s Administrare link the real lake (single lake → its panel)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');
    await page.getByRole('button', { name: /Administrare/ }).click();
    await expect(page.getByRole('menuitem', { name: new RegExp(chita.name) })).toHaveAttribute('href', `/operator/${chita.documentId}`);
    await page.keyboard.press('Escape');
    await expect(page.locator(`main a[href="/operator/${chita.documentId}"]:visible`).first()).toBeVisible({ timeout: 20_000 });
    // Several lakes would send to the picker, which is a real page now (not the catch-all 404).
    const res = await page.goto(PATH);
    expect(res?.status()).toBe(200);
  });
});
