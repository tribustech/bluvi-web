import { expect, test, type Route } from '@playwright/test';

/*
 * The global status lists (parity docs/parity/areas/competitions-list.yml: competitions-list.viitoare
 * / .live / .incheiate) are the Concursuri list's own tabs, each at a clean URL of its own
 * (competitions-list.index.c37): /concursuri/viitoare · /live · /rezultate — the index's tab order
 * and names, its cards and its filter bar. No ?status=, no redirects (the web is not deployed yet).
 * The per-lake lists below keep their own page.
 */

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });

const LISTS = [
  { key: 'viitoare', id: 'competitions-list.viitoare', tab: 'Viitoare' },
  { key: 'live', id: 'competitions-list.live', tab: 'Live' },
  { key: 'rezultate', id: 'competitions-list.incheiate', tab: 'Rezultate' },
] as const;

for (const l of LISTS) {
  test(`${l.id}.c1 competitions-list.index.c37 — /concursuri/${l.key} is the list's «${l.tab}» tab, its own page (200, canonical), with its filter bar and cards`, async ({ page, request }) => {
    const res = await request.get(`/concursuri/${l.key}`, { maxRedirects: 0 });
    expect(res.status()).toBe(200);
    expect(await res.text()).toContain(`<link rel="canonical" href="`);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/concursuri/${l.key}`);
    await expect(page).toHaveURL(new RegExp(`/concursuri/${l.key}$`));
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', new RegExp(`/concursuri/${l.key}$`));
    await expect(page.getByRole('heading', { level: 1, name: 'Concursuri' })).toBeVisible();
    await expect(page.getByRole('tab', { name: new RegExp(`^${l.tab}`) })).toHaveAttribute('aria-selected', 'true');
    // One order and one name for the tabs; each a link to its page. The count badges (§4b.20)
    // follow the labels: compare the labels.
    const tabs = page.getByRole('tablist', { name: 'Stare concursuri' }).getByRole('tab');
    const labels = (await tabs.allTextContents()).map((t) => t.trim().replace(/(\d+|99\+)$/, ''));
    expect(labels.slice(0, 3)).toEqual(['Viitoare', 'Live', 'Rezultate']);
    expect((await tabs.evaluateAll((els) => els.map((e) => e.getAttribute('href')))).slice(0, 3)).toEqual([
      '/concursuri/viitoare',
      '/concursuri/live',
      '/concursuri/rezultate',
    ]);
    await expect(page.getByRole('group', { name: /^Filtre/ }).first()).toBeVisible();
  });
}

/*
 * The per-lake status lists (competitions-list.*-balta) have no page of their own: merged_into
 * lakes.competitions (/balti/[id]/concursuri?tab=…), whose header, page size and card layout win
 * (parity README «Shared routes»). Their own states — the lake from the URL, loading, error, empty,
 * a card opening the competition — are checked here on that page, with the lake page's dev fault
 * switch (POST /balti/<id>/e2e-fault, `competitions-tab`) so the browser reads the tab.
 */
const CHITA = 's84u55lo4n9z0emngozttt6e';
const CARDS = /\/feed\/competition-cards\?/;
const BALTA = [
  { id: 'competitions-list.viitoare-balta', tab: 'viitoare', status: 'notStarted' },
  { id: 'competitions-list.live-balta', tab: 'live', status: 'started' },
  { id: 'competitions-list.incheiate-balta', tab: 'trecute', status: 'completed' },
] as const;

for (const b of BALTA) {
  test(`${b.id}.c3 ${b.id}.c5 ${b.id}.c6 ${b.id}.c7 ${b.id}.s1 ${b.id}.s2 ${b.id}.s3 — the lake's list: lakeId from the URL, skeleton, error with retry, empty`, async ({ page }) => {
    const set = (faults: string[]) => page.request.post(`/balti/${CHITA}/e2e-fault`, { data: { faults } });
    await set(['competitions-tab']);
    try {
      let mode: 'fail' | 'empty' = 'fail';
      let release!: () => void;
      const gate = new Promise<void>((r) => (release = r));
      let asked: URL | undefined;
      await page.route(CARDS, async (r) => {
        const u = new URL(r.request().url());
        if (u.searchParams.get('status') !== b.status) return r.continue();
        asked = u;
        await gate;
        return mode === 'fail' ? json(r, { error: { status: 503, message: 'down' } }, 503) : json(r, {
          data: [],
          meta: { pagination: { page: 1, pageSize: 10, pageCount: 0, total: 0 }, counts: { notStarted: 0, started: 0, completed: 0 } },
        });
      });
      await page.goto(`/balti/${CHITA}/concursuri${b.tab === 'live' ? '' : `?tab=${b.tab}`}`);
      // c5 / s1: the skeleton while the tab is read.
      await expect(page.getByRole('tabpanel').getByRole('status').first()).toBeVisible({ timeout: 60_000 });
      // c3: only this lake (lakeId from the route parameter).
      await expect.poll(() => asked?.searchParams.get('lakeId'), { timeout: 30_000 }).toBe(CHITA);
      release();
      // c6 / s2: the error card with «Încearcă din nou»; the header's back stays.
      const alert = page.getByRole('tabpanel').getByRole('alert');
      // describeError (lakes.competitions.c5): a 503 is the server's, not the connection's.
      await expect(alert).toContainText('Serverul nu răspunde', { timeout: 20_000 });
      await expect(page.getByRole('button', { name: 'Înapoi' })).toBeVisible();
      // c7 / s3: the retry answers empty.
      mode = 'empty';
      await alert.getByRole('button', { name: 'Încearcă din nou' }).click();
      await expect(page.getByRole('tabpanel')).toContainText('Momentan nu este disponibil niciun concurs.');
    } finally {
      await set([]);
    }
  });
}

test('competitions-list.incheiate-balta.c8 competitions-list.incheiate-balta.c9 competitions-list.incheiate-balta.s4 — next page on scroll, a card opens the competition', async ({ page }) => {
  await page.goto(`/balti/${CHITA}/concursuri?tab=trecute`);
  const panel = page.getByRole('tabpanel');
  const items = panel.getByRole('listitem');
  await expect(items.first()).toBeVisible({ timeout: 60_000 });
  const first = await items.count();
  test.skip(first < 10, 'needs more than one page of finished competitions at Chita');
  await page.mouse.wheel(0, 20_000);
  await expect.poll(() => items.count(), { timeout: 30_000 }).toBeGreaterThan(first);
  const href = await panel.locator('a[href^="/concursuri/"]').first().getAttribute('href');
  await panel.locator(`a[href="${href}"]`).first().click();
  await expect(page).toHaveURL(new RegExp(`${href}$`), { timeout: 60_000 });
});
