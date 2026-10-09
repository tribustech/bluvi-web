import { expect, test, type Page } from '@playwright/test';
import { BASE_URL } from './helpers/base-url';

/*
 * m8.sentry / global.b.observability — Sentry stays OFF when it is not configured. The local dev
 * server has no NEXT_PUBLIC_SENTRY_DSN / SENTRY_DSN and runs in development (lib/observability/env.ts),
 * so whatever breaks, nothing may reach Sentry: no request to *.sentry.io / an ingest endpoint, no
 * SDK chunk, no global carrier (`window.__SENTRY__`, set by any @sentry/* import). Holds even when
 * the visitor accepted «Monitorizarea erorilor». The «consent errors:false → no init even with a
 * DSN» half is a unit test (lib/observability/observability.test.ts): a DSN cannot be set per spec
 * on the shared dev server. Live reporting needs the owner's Sentry project.
 */

/** Sentry hosts, an ingest / envelope endpoint, or an SDK chunk (dev chunk names carry the package). */
const SENTRY = /sentry\.io|ingest\.|\/envelope\/|@sentry|_sentry_|sentry_nextjs|\/monitoring\b/i;

function watchSentry(page: Page) {
  const hits: string[] = [];
  page.on('request', (r) => {
    if (SENTRY.test(r.url())) hits.push(r.url());
  });
  return hits;
}

const sdkLoaded = (page: Page) => page.evaluate(() => '__SENTRY__' in window);

/** The visitor accepted every category (the consent layer's own cookie, v1). */
const ACCEPTED = {
  name: 'bluvi_consent',
  value: encodeURIComponent(JSON.stringify({ v: 1, analytics: true, errors: true, at: '2026-10-09T00:00:00.000Z' })),
  domain: new URL(BASE_URL).hostname,
  path: '/',
  expires: -1,
  httpOnly: false,
  secure: false,
  sameSite: 'Lax' as const,
};

test.describe('global.b.observability — Sentry off without a DSN', () => {
  test('a forced client error (uncaught throw + unhandled rejection) sends nothing', async ({ page }) => {
    const hits = watchSentry(page);
    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));
    await page.goto('/concursuri');
    await expect(page.locator('main').first()).toBeVisible();
    await page.evaluate(() => {
      setTimeout(() => {
        throw new Error('m8.sentry: forced uncaught error');
      }, 0);
      void Promise.reject(new Error('m8.sentry: forced rejection'));
    });
    await expect.poll(() => pageErrors.some((m) => m.includes('forced uncaught error'))).toBe(true);
    await page.waitForTimeout(1500);
    expect(hits).toEqual([]);
    expect(await sdkLoaded(page)).toBe(false);
  });

  test('a render error reaching the root boundary (app/global-error.tsx) sends nothing', async ({ page }) => {
    const hits = watchSentry(page);
    await page.goto('/dev/observability?crash=render');
    await expect(page.getByRole('heading', { name: 'Ceva nu a mers bine' })).toBeVisible();
    const alert = page.getByRole('alert').filter({ hasText: 'Pagina nu s-a putut încărca.' });
    await expect(alert).toBeVisible();
    await expect(alert.getByRole('button', { name: 'Reîncearcă' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Înapoi acasă' })).toHaveAttribute('href', '/');
    await expect(page).toHaveTitle(/A apărut o eroare · Bluvi/);
    await page.waitForTimeout(1500);
    expect(hits).toEqual([]);
    expect(await sdkLoaded(page)).toBe(false);
  });

  test('a render error caught by a route boundary (error.tsx) sends nothing', async ({ page }) => {
    const hits = watchSentry(page);
    await page.goto('/dev/templates/t1?state=crash');
    await expect(page.getByRole('alert').first()).toBeVisible();
    await page.waitForTimeout(1500);
    expect(hits).toEqual([]);
    expect(await sdkLoaded(page)).toBe(false);
  });

  test.describe('with «Monitorizarea erorilor» accepted', () => {
    test.use({ storageState: { cookies: [ACCEPTED], origins: [] } });

    test('consent alone never starts the SDK: no DSN, no request, no chunk', async ({ page }) => {
      const hits = watchSentry(page);
      await page.goto('/dev/observability?crash=render');
      await expect(page.getByRole('heading', { name: 'Ceva nu a mers bine' })).toBeVisible();
      await page.goto('/balti');
      await page.evaluate(() => {
        setTimeout(() => {
          throw new Error('m8.sentry: forced uncaught error');
        }, 0);
      });
      await page.waitForTimeout(1500);
      expect(hits).toEqual([]);
      expect(await sdkLoaded(page)).toBe(false);
    });
  });
});
