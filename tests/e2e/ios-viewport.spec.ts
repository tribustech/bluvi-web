import { expect, test, type Page } from '@playwright/test';

/*
 * iOS Safari viewport (owner, real iPhone, 2026-10-10: «white spaces, can scroll and move header to
 * top»). Run in WebKit as an iPhone 13 and an iPhone 15 Pro (playwright.config `webkit-ios-*`).
 *  - a full-screen map (/balti/harta, /ape-publice) is a fixed window: the document can't scroll,
 *    a scroll attempt leaves the floating header where it is, the tab bar's bottom is the window's;
 *  - /intra: the deep-water welcome reaches the bottom edge (no page-grey band under it), and the
 *    root paints it too (the overscroll);
 *  - every phone tab screen and the competition page: viewport-fit=cover, a theme-color, the root
 *    painted with the page ground (no white canvas in the rubber band), the tab bar on the bottom edge.
 * Local CMS on :1337.
 */

const COMPETITION = process.env.E2E_COMPETITION_COMPLETED ?? 'uxxie29m6820wrpdv45w0m7q';
const settle = (page: Page) => page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});

async function open(page: Page, path: string) {
  const res = await page.goto(path, { waitUntil: 'domcontentloaded' });
  expect(res?.status()).toBe(200);
  await settle(page);
}

/** The window's height and the tab bar's bottom edge (null without a tab bar). */
async function tabBarBottom(page: Page) {
  return page.evaluate(() => {
    const nav = document.querySelector('nav[data-tab-bar]');
    return { inner: window.innerHeight, bottom: nav ? Math.round(nav.getBoundingClientRect().bottom) : null };
  });
}

async function expectChrome(page: Page) {
  const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
  expect(viewport).toContain('viewport-fit=cover');
  await expect(page.locator('meta[name="theme-color"]')).toHaveCount(1);
  const bg = await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);
  expect(bg).not.toBe('rgba(0, 0, 0, 0)');
}

/** Each map's floating header: the back control (Hartă bălți), the Bălți | Ape publice toggle. */
const MAPS = [
  { path: '/balti/harta', header: (page: Page) => page.getByRole('link', { name: 'Înapoi' }).or(page.getByRole('button', { name: 'Înapoi' })).first() },
  { path: '/ape-publice', header: (page: Page) => page.getByRole('navigation', { name: 'Tip de apă' }) },
];

for (const { path, header: headerOf } of MAPS) {
  test(`ios: ${path} is a fixed full-screen map — no document scroll, the header stays put, tab bar on the bottom edge`, async ({ page }) => {
    await open(page, path);
    const header = headerOf(page);
    await expect(header).toBeVisible();
    await expectChrome(page);

    const before = await header.boundingBox();
    const doc = await page.evaluate(() => {
      const el = document.scrollingElement!;
      return { scrollHeight: el.scrollHeight, inner: window.innerHeight, overflow: getComputedStyle(document.documentElement).overflowY };
    });
    expect(doc.scrollHeight).toBeLessThanOrEqual(doc.inner);
    expect(doc.overflow).toBe('hidden');

    // A drag on the header that would scroll the page: the document stays at 0, the header in place.
    await page.evaluate(() => {
      window.scrollTo(0, 400);
      document.scrollingElement!.scrollTop = 400;
    });
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    const after = await header.boundingBox();
    expect(after?.y).toBe(before?.y);

    const { inner, bottom } = await tabBarBottom(page);
    expect(bottom).toBe(inner);
  });
}

test('ios: /intra — the dark welcome reaches the bottom edge, the root is painted with it', async ({ page }) => {
  await open(page, '/intra');
  const section = page.locator('section[aria-labelledby="intra-titlu"]');
  await expect(section).toBeVisible();
  await expectChrome(page);
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#071d29');
  const r = await page.evaluate(() => {
    const s = document.querySelector('section[aria-labelledby="intra-titlu"]')!;
    const at = document.elementFromPoint(window.innerWidth / 2, window.innerHeight - 2);
    return {
      bottom: s.getBoundingClientRect().bottom,
      inner: window.innerHeight,
      inside: !!at && s.contains(at),
      sectionBg: getComputedStyle(s).backgroundColor,
      rootBg: getComputedStyle(document.documentElement).backgroundColor,
      bodyBg: getComputedStyle(document.body).backgroundColor,
    };
  });
  expect(r.bottom).toBeGreaterThanOrEqual(r.inner);
  expect(r.inside).toBe(true);
  expect(r.rootBg).toBe(r.sectionBg);
  expect(r.bodyBg).toBe(r.sectionBg);
});

for (const path of ['/', '/balti', '/concursuri', '/partide']) {
  test(`ios: tab screen ${path} — painted root, tab bar on the bottom edge`, async ({ page }) => {
    await open(page, path);
    await expect(page.locator('nav[data-tab-bar]')).toBeVisible();
    await expectChrome(page);
    const { inner, bottom } = await tabBarBottom(page);
    expect(bottom).toBe(inner);
    const bg = await page.evaluate(() => ({
      root: getComputedStyle(document.documentElement).backgroundColor,
      body: getComputedStyle(document.body).backgroundColor,
    }));
    expect(bg.root).toBe(bg.body);
  });
}

test('ios: competition page — painted root, the page reaches the bottom edge', async ({ page }) => {
  await open(page, `/concursuri/${COMPETITION}`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expectChrome(page);
  const r = await page.evaluate(() => ({
    root: getComputedStyle(document.documentElement).backgroundColor,
    body: getComputedStyle(document.body).backgroundColor,
    scrollHeight: document.scrollingElement!.scrollHeight,
    inner: window.innerHeight,
  }));
  expect(r.root).toBe(r.body);
  expect(r.scrollHeight).toBeGreaterThanOrEqual(r.inner);
});
