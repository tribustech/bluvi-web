import { expect, type Locator, type Page } from '@playwright/test';

/*
 * Owner 2026-10-08 (ROADMAP §4b rule 21): starting, joining and running a partidă are app-only on
 * web. Every such entry point is components/partide/OpenInApp — the universal link below 1280, the
 * two store links from 1280. These assert that hand-over inside `scope`.
 */

export const APP_ORIGIN = 'https://bluvi-app.wearetribus.com';
export const APP_STORE = 'https://apps.apple.com/ro/app/bluvi-aplicatia-pescarilor/id6743083184';
export const PLAY_STORE = 'https://play.google.com/store/apps/details?id=com.tribustech.bluvi';

/** The hand-over at the page's current width: `href` (the universal link) below 1280, the stores from 1280. */
export async function expectOpenInApp(page: Page, scope: Locator, href: string) {
  const width = page.viewportSize()?.width ?? 0;
  const link = scope.getByRole('link', { name: /aplicați/ }).filter({ visible: true });
  const stores = scope.getByTestId('open-in-app-store').filter({ visible: true });
  if (width < 1280) {
    await expect(link.first()).toHaveAttribute('href', href);
    await expect(stores).toHaveCount(0);
  } else {
    await expect(stores).toHaveCount(2);
    await expect(stores.nth(0)).toHaveAttribute('href', APP_STORE);
    await expect(stores.nth(1)).toHaveAttribute('href', PLAY_STORE);
  }
  // Never a web start / join / capture page.
  await expect(scope.locator('a[href*="/partide/incepe"], a[href*="/partide/intra"], a[href*="/captura"]')).toHaveCount(0);
}

/** «Ești la pescuit?» (Acasă, the Partide hub): it hands over to the app's Partide hub. */
export async function expectPartidaHero(page: Page) {
  const hero = page.getByRole('region', { name: 'Ești la pescuit?' }).locator('visible=true');
  await expect(hero).toBeVisible();
  await expect(hero.getByRole('link', { name: 'Începe o partidă' })).toHaveCount(0);
  await expect(hero.getByRole('link', { name: 'Intră cu cod' })).toHaveCount(0);
  await expectOpenInApp(page, hero, `${APP_ORIGIN}/partide`);
  return hero;
}
