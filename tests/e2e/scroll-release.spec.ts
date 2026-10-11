import { devices, expect, test, type Locator, type Page } from '@playwright/test';

/*
 * Scroll locks are released on navigation, and phone sheets hug their content (owner, real iPhone,
 * 2026-10-11: «din harta de bălți când ajung pe detalii baltă nu mai merge scrollul»; the same going
 * back to Bălți; «butonul de închide jos și restul content nu e legat»).
 *
 * A full-screen map locks the document (html[data-viewport-lock], T2Viewport → scrollLock
 * lockViewport). Next's cacheComponents keeps the previous route mounted but hidden (React
 * <Activity>), so the lock must belong to the mounted, shown map — not to a `:has()` that still
 * matches the hidden one. Every way out of a map is driven as a client navigation (a list card, the
 * pin card, the in-app back, browser back, the tab bar, the Bălți | Ape publice toggle) and the
 * destination must scroll: scrollHeight > innerHeight and window.scrollTo moves it. Also after a
 * sheet opened and closed on the destination. Safari's engine as an iPhone 13. Local CMS on :1337.
 */

const iphone = (({ defaultBrowserType, ...rest }) => (void defaultBrowserType, rest))(devices['iPhone 13']);
test.use({ ...iphone, browserName: 'webkit' });

const NO_BOOKING_LAKE = process.env.E2E_LAKE_BELIN ?? 'g14bobjsal2dbks2jg38v0oi';
const settle = (page: Page) => page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});

async function open(page: Page, path: string) {
  const res = await page.goto(path, { waitUntil: 'domcontentloaded' });
  expect(res?.status()).toBe(200);
  await settle(page);
}

/** The map screen is up and holds its document lock. */
async function onMap(page: Page) {
  await expect(page.locator('[data-viewport-frame]').first()).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('html')).toHaveAttribute('data-viewport-lock', '');
}

/** The page scrolls as a whole: no lock left, content taller than the window, scrollTo moves it. */
async function expectScrolls(page: Page) {
  await expect(page.locator('html')).not.toHaveAttribute('data-viewport-lock', /.*/);
  await expect(page.locator('html')).not.toHaveAttribute('data-scroll-locked', /.*/);
  await expect
    .poll(() => page.evaluate(() => document.scrollingElement!.scrollHeight - window.innerHeight), { timeout: 15_000 })
    .toBeGreaterThan(100);
  await expect
    .poll(() =>
      page.evaluate(() => {
        window.scrollTo(0, 0);
        window.scrollTo(0, 200);
        return window.scrollY;
      }),
    )
    .toBeGreaterThan(0);
  const s = await page.evaluate(() => ({
    html: getComputedStyle(document.documentElement).overflowY,
    body: getComputedStyle(document.body).overflowY,
  }));
  expect(s.html).not.toBe('hidden');
  expect(s.body).not.toBe('hidden');
  await page.evaluate(() => window.scrollTo(0, 0));
}

/** A lake card link in the map's list sheet (client navigation). */
function listLake(page: Page): Locator {
  return page.getByRole('region', { name: 'Rezultate' }).locator('a[href^="/balti/"]').filter({ hasNotText: /^Rezervă$/ }).first();
}

test.describe('scroll locks are released on every way out of a map', () => {
  test('/balti/harta → a lake from the list sheet; back to the map; back again to /balti', async ({ page }) => {
    await open(page, '/balti');
    await page.locator('a[href="/balti/harta"]').filter({ visible: true }).first().click();
    await expect(page).toHaveURL(/\/balti\/harta/);
    await onMap(page);
    const link = listLake(page);
    await expect(link).toBeVisible({ timeout: 25_000 });
    const href = (await link.getAttribute('href'))!;
    await link.click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 20_000 });
    await expectScrolls(page);
    // Browser back: the map locks again; back once more to /balti, which scrolls.
    await page.goBack();
    await expect(page).toHaveURL(/\/balti\/harta/);
    await onMap(page);
    await page.goBack();
    await expect(page).toHaveURL(/\/balti$/);
    await expectScrolls(page);
  });

  test('/balti/harta → a lake from the pin card; then a sheet opened and closed there', async ({ page }) => {
    await open(page, '/balti/harta');
    await onMap(page);
    const pin = page.locator('[data-t2-pin]').first();
    await expect(pin).toBeAttached({ timeout: 25_000 });
    await pin.dispatchEvent('click');
    const card = page.getByRole('article').filter({ has: page.getByRole('button', { name: 'Închide' }) });
    await expect(card).toBeVisible();
    const link = card.locator('a[href^="/balti/"]').first();
    const href = (await link.getAttribute('href'))!;
    await link.click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 20_000 });
    await expectScrolls(page);
    // A sheet on the lake page: open it (the page locks), close it (it scrolls again).
    const share = page.getByRole('button', { name: /Distribuie/ }).filter({ visible: true }).first();
    await share.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-scroll-locked', '');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
    await expectScrolls(page);
  });

  test('/balti/harta → the in-app back to /balti, and the tab bar to another tab', async ({ page }) => {
    await open(page, '/balti');
    await page.locator('a[href="/balti/harta"]').filter({ visible: true }).first().click();
    await onMap(page);
    await page.getByRole('link', { name: /^Înapoi/ }).or(page.getByRole('button', { name: /^Înapoi/ })).filter({ visible: true }).first().click();
    await expect(page).toHaveURL(/\/balti$/);
    await expectScrolls(page);
    // Into the map again, out by the tab bar.
    await page.locator('a[href="/balti/harta"]').filter({ visible: true }).first().click();
    await onMap(page);
    await page.locator('nav[data-tab-bar] a[href="/concursuri"]').click();
    await expect(page).toHaveURL(/\/concursuri$/);
    await expectScrolls(page);
  });

  test('/ape-publice → a water from the list sheet; back; the toggle to Bălți', async ({ page }) => {
    await open(page, '/ape-publice');
    await onMap(page);
    const link = page.locator('a[href^="/ape-publice/"]').filter({ visible: true }).first();
    await expect(link).toBeVisible({ timeout: 25_000 });
    const href = (await link.getAttribute('href'))!;
    await link.click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 20_000 });
    await expectScrolls(page);
    await page.goBack();
    await expect(page).toHaveURL(/\/ape-publice$/);
    await onMap(page);
    await page.getByRole('navigation', { name: 'Tip de apă' }).getByRole('link', { name: 'Bălți' }).click();
    await expect(page).toHaveURL(/\/balti$/);
    await expectScrolls(page);
  });
});

test.describe('phone sheets hug their content', () => {
  /** The panel, its footer right under the body, nothing to scroll, no focus ring on open. */
  async function expectHugs(page: Page, dialog: Locator) {
    const panel = dialog.locator('[data-sheet-panel]');
    await expect(panel).toBeVisible();
    await page.waitForTimeout(700); // the slide-in
    const m = await panel.evaluate((p) => {
      const body = p.querySelector<HTMLElement>('[data-sheet-body]')!;
      const content = p.querySelector<HTMLElement>('[data-sheet-content]')!;
      const r = p.getBoundingClientRect();
      const active = document.activeElement as HTMLElement | null;
      return {
        height: r.height,
        bottom: r.bottom,
        vh: window.innerHeight,
        // The empty band under the content inside the body.
        gap: body.getBoundingClientRect().bottom - parseFloat(getComputedStyle(body).paddingBottom) - content.getBoundingClientRect().bottom,
        scrolls: body.scrollHeight > body.clientHeight + 1,
        handleFocused: !!active?.closest('[data-sheet-handle] button:not([aria-label="Închide"])'),
        outline: active ? getComputedStyle(active).outlineStyle : 'none',
      };
    });
    expect(m.height).toBeLessThan(m.vh * 0.92);
    expect(Math.abs(m.bottom - m.vh)).toBeLessThan(2);
    expect(Math.abs(m.gap)).toBeLessThan(2);
    expect(m.scrolls).toBe(false);
    expect(m.handleFocused).toBe(false);
    expect(m.outline).toBe('none');
  }

  test('lakes.booking-interest — «Rezervări prin Bluvi» is as tall as its content, «Închide» right under it', async ({ page }) => {
    await open(page, `/balti/${NO_BOOKING_LAKE}`);
    await page.getByRole('button', { name: 'Vreau să rezerv online' }).filter({ visible: true }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Rezervări prin Bluvi' });
    await expectHugs(page, dialog);
    await expect(dialog.getByRole('button', { name: 'Aș vrea să pot rezerva aici' })).toBeInViewport();
    await dialog.getByRole('button', { name: 'Închide' }).click();
    await expect(dialog).toBeHidden();
    await expectScrolls(page);
  });

  test('harness — a short sheet at the 50% snap with a footer hugs its content', async ({ page }) => {
    await open(page, '/dev/sheets');
    await page.getByRole('button', { name: 'Foaie mică', exact: true }).click();
    await expectHugs(page, page.getByRole('dialog', { name: 'Foaie de probă' }));
  });
});
