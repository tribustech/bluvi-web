import { expect, test, type ConsoleMessage, type Page } from '@playwright/test';

/*
 * Concurs · Clasament smoke at phone and desktop width, signed out and signed in (QA user, local
 * CMS on :1337). Two local competitions: a completed one (prerendered by generateStaticParams)
 * and a live one (rendered per request). Override with E2E_COMPETITION_IDS=id1,id2.
 */

const CMS = process.env.E2E_CMS_URL ?? 'http://localhost:1337/api';
const COMPETITION_IDS = (process.env.E2E_COMPETITION_IDS ?? 'uxxie29m6820wrpdv45w0m7q,kee49a3e64b3f636b4b60daa').split(',');
const QA_USER = { identifier: 'sim-qa@bluvi.test', password: '***REMOVED***' };

const WIDTHS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'desktop', width: 1440, height: 900 },
] as const;

const names = new Map<string, string>();
let jwt = '';

test.beforeAll(async ({ request }) => {
  for (const id of COMPETITION_IDS) {
    const c = await request.get(`${CMS}/feed/competitions/${id}`);
    expect(c.ok(), `competition ${id} exists in the local CMS`).toBeTruthy();
    names.set(id, (await c.json()).data.name);
  }
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

for (const id of COMPETITION_IDS) {
  const PATH = `/concursuri/${id}`;
  for (const signedIn of [false, true]) {
    for (const vp of WIDTHS) {
      test(`${PATH} · ${vp.width}px · ${signedIn ? 'signed in' : 'signed out'}`, async ({ page, context }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        if (signedIn) {
          await context.addCookies([{ name: 'bluvi_session', value: jwt, domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' }]);
        }
        const errors = collectConsoleErrors(page);

        const res = await page.goto(PATH, { waitUntil: 'domcontentloaded' });
        expect(res?.status()).toBe(200);

        // Header: the competition name as the page heading (one h1 per breakpoint).
        await expect(page.getByRole('heading', { level: 1, name: names.get(id) })).toBeVisible();
        // Detail tabs, Clasament current.
        const sections = page.getByRole('navigation', { name: 'Secțiunile concursului' });
        await expect(sections).toBeVisible();
        await expect(sections.locator('[aria-current="page"]')).toHaveText('Clasament');

        // The four views, Clasament selected.
        const tablist = page.getByRole('tablist', { name: 'Vederi clasament' }).locator('visible=true');
        await expect(tablist).toHaveCount(1);
        await expect(tablist.getByRole('tab', { selected: true })).toContainText('Clasament');

        // The ranking itself, with at least one angler row.
        // Phone: the scrollable grid region; desktop: the «Clasament» section around the kit table.
        const ranking = page.getByRole('region', { name: 'Clasament', exact: true }).locator('visible=true').first();
        await expect(ranking).toBeVisible();
        await expect(ranking.locator('tbody tr').first()).toBeVisible();

        if (vp.name === 'mobile') {
          // Fixed action bar above the tab bar.
          await expect(page.getByRole('navigation', { name: 'Acțiuni concurs' })).toBeVisible();
        }

        // Let client queries (viewer overlay, statute, weighings) settle before judging the console.
        await page.waitForLoadState('networkidle').catch(() => {});
        expect(errors, errors.join('\n')).toEqual([]);
      });
    }
  }
}
