import { qaJwt, signIn } from './helpers/session';
import { expect, test, type Page } from '@playwright/test';

/*
 * The full-width rule (docs/ROADMAP.md §4, owner decision 2026-10-04) on the shell and the built
 * screens: the top bar is full width; pages are full width with 24–32px gutters up to 1680 of
 * content and centred beyond; reading text is capped at ~720; from 1280 dashboards (Acasă, T5) and
 * detail pages (Concurs, T3) use their side columns; tables take all the width there is.
 * Checked at 1280, 1440, 1920 and 2560 (the phone and tablet layouts are covered by acasa.spec.ts
 * and concurs.spec.ts). Local CMS on :1337; competition ids as in concurs.spec.ts.
 */

const WIDTHS = [1280, 1440, 1920, 2560];
/** SHELL_MAX (components/nav/shell.tsx): 1680 of content + 2 × 32 gutters. */
const SHELL = 1744;
const GUTTER = 32;

const LIVE = process.env.E2E_COMPETITION_LIVE ?? 'kee49a3e64b3f636b4b60daa';
const UPCOMING = process.env.E2E_COMPETITION_UPCOMING_OWN ?? 'a6xjl65ooe9eadrtvvqj9hn1';

let jwt = '';
test.beforeAll(async ({ request }) => {
  jwt = await qaJwt(request);
});

test.describe.configure({ timeout: 90_000 });

async function open(page: Page, path: string, width: number, signedIn = false) {
  await page.setViewportSize({ width, height: 1000 });
  if (signedIn) await signIn(page.context(), jwt);
  const res = await page.goto(path, { waitUntil: 'domcontentloaded' });
  expect(res?.status()).toBe(200);
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
}

/** The shell's geometry: full-width bar, no sideways scroll, the column capped and centred. */
async function expectShell(page: Page, width: number) {
  const g = await page.evaluate(() => {
    const main = document.querySelector('main')!.getBoundingClientRect();
    const bar = document.querySelector('header')!.getBoundingClientRect();
    return { overflow: document.documentElement.scrollWidth - window.innerWidth, bar: bar.width, left: main.left, main: main.width };
  });
  expect(g.overflow, 'no horizontal scroll').toBeLessThanOrEqual(0);
  expect(g.bar, 'the top bar is full width').toBe(width);
  expect(g.main, 'the column is full width up to SHELL_MAX').toBe(Math.min(width, SHELL));
  expect(g.left, 'centred beyond SHELL_MAX').toBe(Math.max(0, (width - SHELL) / 2));
}

for (const width of WIDTHS) {
  test(`full width · Acasă · ${width}px — three columns: Scurtături · feed · Ce mă așteaptă`, async ({ page }) => {
    await open(page, '/', width, true);
    await expectShell(page, width);
    const left = page.getByRole('complementary', { name: 'Scurtături' });
    const right = page.getByRole('complementary', { name: 'Ce mă așteaptă' });
    await expect(left).toBeVisible();
    await expect(right).toBeVisible();
    const feed = page.getByRole('region', { name: /^Concursuri (live|viitoare)|^Bălți/ }).locator('visible=true').first();
    const [l, f, r] = await Promise.all([left.boundingBox(), feed.boundingBox(), right.boundingBox()]);
    expect(l && f && r).toBeTruthy();
    // Left, centre, right in that order, the centre the widest; the outer edges sit on the gutters.
    expect(l!.x + l!.width).toBeLessThan(f!.x);
    expect(f!.x + f!.width).toBeLessThan(r!.x);
    expect(f!.width).toBeGreaterThan(Math.max(l!.width, r!.width));
    const colLeft = Math.max(0, (width - SHELL) / 2) + GUTTER;
    expect(Math.round(l!.x)).toBe(colLeft);
    expect(Math.round(r!.x + r!.width)).toBe(Math.min(width, SHELL) + Math.max(0, (width - SHELL) / 2) - GUTTER);
    // Signed in: the viewer's own areas first.
    const nav = left.getByRole('navigation', { name: 'Scurtături' });
    await expect(nav.getByRole('link', { name: 'Profilul meu' })).toHaveAttribute('href', '/profil');
    await expect(nav.getByRole('link', { name: 'Concursuri live' })).toHaveAttribute('href', '/concursuri?status=started');
  });

  test(`full width · Concurs (live) · ${width}px — the ranking table takes the whole column`, async ({ page }) => {
    await open(page, `/concursuri/${LIVE}`, width);
    await expectShell(page, width);
    const table = page.getByRole('region', { name: 'Clasament general' });
    await expect(table).toBeVisible();
    const box = await table.boundingBox();
    expect(Math.round(box!.width)).toBe(Math.min(width, SHELL) - 2 * GUTTER);
  });

  test(`full width · Concurs (preview) · ${width}px — Ce mă așteaptă column, reading text ≤ 720`, async ({ page }) => {
    await open(page, `/concursuri/${UPCOMING}`, width, true);
    await expectShell(page, width);
    const right = page.getByRole('complementary', { name: 'Ce mă așteaptă' });
    await expect(right.getByRole('region', { name: /Competiția începe în|Startul competiției/ })).toBeVisible();
    await expect(right.getByRole('region', { name: 'Înscrieri' })).toBeVisible();
    const notice = page.getByText(/^Această competiție încă nu a început/);
    await expect(notice).toBeVisible();
    expect((await notice.boundingBox())!.width).toBeLessThanOrEqual(720);
  });
}

test('full width · Acasă signed out · 1920px — public shortcuts and the account invitation', async ({ page }) => {
  await open(page, '/', 1920);
  const left = page.getByRole('complementary', { name: 'Scurtături' });
  const nav = left.getByRole('navigation', { name: 'Scurtături' });
  await expect(nav.getByRole('link', { name: 'Bălți' })).toHaveAttribute('href', '/balti');
  await expect(nav.getByRole('link', { name: 'Profilul meu' })).toHaveCount(0);
  await expect(left.getByRole('link', { name: 'Intră în cont' })).toHaveAttribute('href', '/intra');
});
