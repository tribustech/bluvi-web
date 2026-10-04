import { qaUser } from '../qa-user';
import { expect, test, type ConsoleMessage, type Page } from '@playwright/test';

/*
 * Acasă smoke at phone and desktop width, signed out and signed in (QA user: operator of the local
 * lake Chita, not an organizer, no partide). Below 1280px the single fish-order column renders,
 * from 1280px the main column + «Ce mă așteaptă»; only one is displayed, so every locator is
 * narrowed to the visible match.
 */

const CMS = process.env.E2E_CMS_URL ?? 'http://localhost:1337/api';
const QA_USER = qaUser();

const WIDTHS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'desktop', width: 1440, height: 900 },
] as const;

let jwt = '';

test.beforeAll(async ({ request }) => {
  const auth = await request.post(`${CMS}/auth/local`, { data: QA_USER });
  expect(auth.ok(), 'QA user signs in against the local CMS').toBeTruthy();
  jwt = (await auth.json()).jwt;
});

function collectConsoleErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', (msg: ConsoleMessage) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', err => errors.push(`pageerror: ${err.message}`));
  return errors;
}

function visibleHeading(page: Page, name: string | RegExp) {
  return page.getByRole('heading', { level: 2, name }).locator('visible=true').first();
}

for (const signedIn of [false, true]) {
  for (const vp of WIDTHS) {
    test(`/ · ${vp.width}px · ${signedIn ? 'signed in' : 'signed out'}`, async ({ page, context }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      if (signedIn) {
        await context.addCookies([{ name: 'bluvi_session', value: jwt, domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' }]);
      }
      const errors = collectConsoleErrors(page);

      const res = await page.goto('/', { waitUntil: 'domcontentloaded' });
      expect(res?.status()).toBe(200);
      await expect(page.getByRole('heading', { level: 1, name: 'Bluvi · Acasă' })).toBeAttached();

      // Public rails, each with at least one card.
      for (const name of [/^Concursuri live/, /^Bălți/, /^Noutăți$/]) {
        const heading = visibleHeading(page, name);
        await expect(heading).toBeVisible();
      }
      await expect(page.getByRole('heading', { level: 3 }).locator('visible=true').first()).toBeVisible();
      await expect(visibleHeading(page, 'Sponsori')).toBeVisible();
      await expect(visibleHeading(page, 'Instrumente')).toBeVisible();
      await expect(visibleHeading(page, 'Ești la pescuit?')).toBeVisible();
      await expect(visibleHeading(page, 'Nu găsești balta preferată?')).toBeVisible();

      if (vp.name === 'desktop') {
        await expect(page.getByRole('complementary', { name: 'Ce mă așteaptă' })).toBeVisible();
      }

      if (signedIn) {
        // Per-user blocks stream in: operator lake card and suggested anglers.
        await expect(visibleHeading(page, /^Balta mea/)).toBeVisible();
        await expect(visibleHeading(page, 'Pescari pe care îi poți urmări')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Contactează-ne' }).locator('visible=true')).toHaveCount(0);
      } else {
        await expect(page.getByRole('button', { name: 'Contactează-ne' }).locator('visible=true')).toBeVisible();
        await expect(visibleHeading(page, /^Balta mea/)).toHaveCount(0);
        await expect(visibleHeading(page, 'Pescari pe care îi poți urmări')).toHaveCount(0);
      }

      // Let client queries settle before judging the console.
      await page.waitForLoadState('networkidle').catch(() => {});
      expect(errors, errors.join('\n')).toEqual([]);
    });
  }
}
