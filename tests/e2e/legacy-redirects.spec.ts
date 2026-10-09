import { mkdirSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { BASE_URL } from './helpers/base-url';
import { CMS } from './helpers/session';
import { LEGACY_CASES, NOT_REDIRECTED } from './legacy-redirects.cases';

/*
 * m8.redirects (M8-B1): fish's legacy paths on the running server (next.config.ts redirects()).
 *
 *  - global.b.legacy-path-redirects: one request per row of legacy-redirects.cases.ts, no redirect
 *    followed → the status (308, the two app-only partidă links 307) and the Location (path + the
 *    query keys that matter; fish's timestamp rides along, Next merges the request query).
 *  - the web's own routes are never caught by the table.
 *  - lakes.b.share-link, competition-page.b.share-url + the news link: a browser opening the legacy
 *    URL of a real LOCAL CMS document lands on its page; an unknown id lands on the not-found card.
 */

const SHOTS = '.shots/legacy-redirects';
mkdirSync(SHOTS, { recursive: true });

const COMPETITION = process.env.E2E_COMPETITION_LIVE ?? 'kee49a3e64b3f636b4b60daa';
const LAKE = process.env.E2E_LAKE_CHITA ?? 's84u55lo4n9z0emngozttt6e';

test.describe('global.b.legacy-path-redirects', () => {
  for (const c of LEGACY_CASES) {
    test(`global.b.legacy-path-redirects — ${c.from} → ${c.status} ${c.path} (${c.why})`, async ({ request }) => {
      const res = await request.get(`${BASE_URL}${c.from}`, { maxRedirects: 0 });
      expect(res.status()).toBe(c.status);
      const location = new URL(res.headers().location ?? '', BASE_URL);
      expect(location.origin).toBe(new URL(BASE_URL).origin);
      expect(location.pathname).toBe(c.path);
      for (const [key, value] of Object.entries(c.query ?? {})) expect(location.searchParams.get(key), key).toBe(value);
      for (const key of c.absent ?? []) expect(location.searchParams.has(key), key).toBe(false);
    });
  }

  test('global.b.legacy-path-redirects — the web\'s own routes are not redirected', async ({ request }) => {
    for (const path of NOT_REDIRECTED) {
      const res = await request.get(`${BASE_URL}${path}`, { maxRedirects: 0 });
      expect(res.status(), path).toBeLessThan(300);
    }
  });
});

async function shoot(page: Page, name: string) {
  for (const width of [375, 1280]) {
    await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
    await page.screenshot({ path: `${SHOTS}/${name}-${width}.png` });
  }
}

test.describe('legacy links land on real pages', () => {
  test('competition-page.b.share-url — /competitions/[id] (the app\'s share link) opens the competition', async ({ page, request }) => {
    const res = await request.get(`${CMS}/feed/competitions/${COMPETITION}`);
    test.skip(!res.ok(), 'the local competition is missing');
    const name = (await res.json()).data.name as string;
    await page.goto(`/competitions/${COMPETITION}?timestamp=1760000000000`);
    await expect(page).toHaveURL(new RegExp(`/concursuri/${COMPETITION}\\?`));
    await expect(page.getByRole('heading', { level: 1 })).toContainText(name);
    await shoot(page, 'competition');
  });

  test('lakes.b.share-link — /lakes/[id] (ShareLakeSheet) and /lakes/[id]/reviews open the lake', async ({ page, request }) => {
    const res = await request.get(`${CMS}/feed/lakes/${LAKE}`);
    test.skip(!res.ok(), 'the local lake is missing');
    const name = (await res.json()).data.name as string;
    await page.goto(`/lakes/${LAKE}`);
    await expect(page).toHaveURL(new RegExp(`/balti/${LAKE}$`));
    await expect(page.getByRole('heading', { level: 1 })).toContainText(name);
    await shoot(page, 'lake');
    await page.goto(`/lakes/${LAKE}/reviews?timestamp=1760000000000`);
    await expect(page).toHaveURL(new RegExp(`/balti/${LAKE}/recenzii`));
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('global.b.legacy-path-redirects — /news/[id] (NEWS push) opens the article', async ({ page, request }) => {
    const news = (await (await request.get(`${CMS}/feed/announcements?page=1&pageSize=1`)).json()).data as { documentId: string; title: string }[];
    test.skip(!news.length, 'no news in the local CMS');
    await page.goto(`/news/${news[0].documentId}`);
    await expect(page).toHaveURL(new RegExp(`/stiri/${news[0].documentId}$`));
    await expect(page.getByRole('heading', { level: 1 })).toContainText(news[0].title);
    await shoot(page, 'news');
  });

  test('global.b.legacy-path-redirects — an unknown id lands on the not-found card, never a blank page', async ({ page }) => {
    await page.goto('/competitions/nu-exista-e2e?activeTabId=clasament');
    await expect(page).toHaveURL(/\/concursuri\/nu-exista-e2e\/clasament/);
    await expect(page.getByRole('heading', { name: 'Concursul nu a fost găsit' })).toBeVisible();
    await page.goto('/lakes/nu-exista-e2e');
    await expect(page).toHaveURL(/\/balti\/nu-exista-e2e$/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await shoot(page, 'lake-not-found');
  });
});
