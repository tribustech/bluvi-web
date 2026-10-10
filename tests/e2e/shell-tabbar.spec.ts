import { expect, test, type Page } from '@playwright/test';
import { expectNoA11yViolations } from './helpers/a11y';
import { tabBar } from './helpers/chrome';
import { collectConsoleErrors } from './helpers/console';
import { qaJwt, signIn } from './helpers/session';

/*
 * ROADMAP §4b rule 25 (owner 2026-10-10): below 768 the shell is the fish app's — no top bar, and
 * fish's bottom tab bar (app/(app)/(tabs)/_layout.tsx) on the tab roots only: Acasă, Bălți,
 * Competiții, Partide, Profil (signed in only, fish `href: null`), the same glyphs, accent when
 * active, 49px.
 * From 768 the top bar is unchanged and the tab bar is gone. Local CMS on :1337.
 */

const PHONE = { width: 390, height: 844 };
const LIVE = process.env.E2E_COMPETITION_LIVE ?? 'kee49a3e64b3f636b4b60daa';

/** The first path of each tab's glyph, as fish's packages draw it (heroicons 4.0.0 outline, lucide 1.17.0). */
const GLYPH: Record<string, string> = {
  Acasă: 'm2.25 12 8.954-8.955',
  Bălți: 'M9 6.75V15m6-6v8.25',
  Competiții: 'M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15',
  Partide: 'M6.5 12c.94-3.46 4.94-6 8.5-6',
};

async function open(page: Page, path: string, viewport = PHONE) {
  await page.setViewportSize(viewport);
  const res = await page.goto(path, { waitUntil: 'domcontentloaded' });
  expect(res?.status()).toBeLessThan(500);
}

const tabs = (page: Page) => tabBar(page).getByRole('link');

test.describe('phone tab bar', () => {
  test('signed out on Acasă: no top bar; Acasă · Bălți · Competiții · Partide (no Profil), fish glyphs, Acasă current; 49px on the bottom edge', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await open(page, '/');
    await expect(page.getByRole('banner')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Meniu', exact: true })).toHaveCount(0);
    const bar = tabBar(page);
    await expect(bar).toBeVisible();
    await expect(bar).toHaveAccessibleName('Navigare principală');
    await expect(tabs(page)).toHaveText(['Acasă', 'Bălți', 'Competiții', 'Partide']);
    for (const [label, href] of [
      ['Acasă', '/'],
      ['Bălți', '/balti'],
      ['Competiții', '/concursuri'],
      ['Partide', '/partide'],
    ]) {
      const link = bar.getByRole('link', { name: label, exact: true });
      await expect(link).toHaveAttribute('href', href);
      expect(await link.locator('svg path').first().getAttribute('d')).toContain(GLYPH[label]);
    }
    await expect(bar.getByRole('link', { name: 'Acasă', exact: true })).toHaveAttribute('aria-current', 'page');
    await expect(bar.locator('[aria-current]')).toHaveCount(1);
    // Active = accent, the others one muted tint.
    const color = (name: string) => bar.getByRole('link', { name, exact: true }).evaluate((e) => getComputedStyle(e).color);
    expect(await color('Acasă')).not.toBe(await color('Bălți'));
    expect(await color('Bălți')).toBe(await color('Partide'));
    // React Navigation's iOS bar: 49 tall (no safe area in a desktop browser), flush with the bottom.
    const box = (await bar.boundingBox())!;
    expect(Math.round(box.height)).toBe(49);
    expect(Math.round(box.y + box.height)).toBe(PHONE.height);
    expect(Math.round(box.width)).toBe(PHONE.width);
    // The page ends above the bar: scrolled to the bottom, nothing of <main> is under it.
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(300);
    const mainBottom = await page.getByRole('main').evaluate((m) => m.getBoundingClientRect().bottom);
    expect(mainBottom).toBeLessThanOrEqual(box.y + 1);
    await expectNoA11yViolations(page);
    expect(errors).toEqual([]);
  });

  test('every tab root shows it with its tab current; screens fish pushes above the tabs do not', async ({ page }) => {
    for (const [path, current] of [
      ['/balti', 'Bălți'],
      ['/balti/harta', 'Bălți'],
      ['/ape-publice', 'Bălți'],
      ['/concursuri', 'Competiții'],
      ['/concursuri/rezultate', 'Competiții'],
      ['/partide', 'Partide'],
      ['/partide/exploreaza', 'Partide'],
    ]) {
      await open(page, path);
      await expect(tabBar(page), path).toBeVisible();
      await expect(tabBar(page).locator('[aria-current]'), path).toHaveText(current);
    }
    for (const path of [`/concursuri/${LIVE}`, '/intra', '/stiri']) {
      await open(page, path);
      await expect(page.locator('main')).toBeVisible();
      await expect(tabBar(page), path).toHaveCount(0);
    }
  });

  test('from 768 the top bar is back and the tab bar is gone', async ({ page }) => {
    for (const width of [768, 1280]) {
      await open(page, '/concursuri', { width, height: 900 });
      await expect(page.getByRole('banner')).toBeVisible();
      await expect(tabBar(page)).toBeHidden();
    }
  });

  test('signed in: the Profil tab is the viewer\'s avatar, current (accent ring) on /profil; it opens the profile', async ({ page, request }) => {
    await signIn(page.context(), await qaJwt(request));
    await open(page, '/concursuri');
    const profil = tabBar(page).getByRole('link', { name: 'Profil', exact: true });
    await expect(tabs(page)).toHaveText(['Acasă', 'Bălți', 'Competiții', 'Partide', 'Profil']);
    await expect(profil).toHaveAttribute('href', '/profil');
    await expect(profil).not.toHaveAttribute('aria-current');
    await profil.click();
    await expect(page).toHaveURL(/\/profil$/);
    await expect(profil).toHaveAttribute('aria-current', 'page');
    const ring = await profil.locator(':scope > :first-child').evaluate((e) => getComputedStyle(e).borderTopWidth);
    // fish: a 28px round avatar.
    expect(Math.round((await profil.locator(':scope > :first-child').boundingBox())!.width)).toBe(28);
    // 1.5px (a 1x screen draws it as 1px).
    expect(ring).toMatch(/^1(\.5)?px$/);
    await expectNoA11yViolations(page);
  });
});
