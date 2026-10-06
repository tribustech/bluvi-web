import { expect, test, type Route } from '@playwright/test';

/*
 * The global status lists /concursuri/viitoare · /live · /incheiate (parity
 * docs/parity/areas/competitions-list.yml: competitions-list.viitoare / .live / .incheiate).
 *
 * WEB (owner review 2026-10-06): the three lists disagreed with the /concursuri index they hang off
 * — another tab order and label («Trecute»), another card, no search or filter bar, «Competiții» in
 * the breadcrumb under a «Concursuri» h1. They are now the index's own tabs: each URL redirects
 * permanently (308) to /concursuri?status=…, where the tabs read Viitoare · Live · Rezultate, the
 * cards are CompetitionCardItem and the FilterBar filters them. The index's footer links the three
 * tabs (crawlers keep a way in). The per-lake lists below keep their own page.
 */

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });

const LISTS = [
  { key: 'viitoare', id: 'competitions-list.viitoare', status: 'notStarted', tab: 'Viitoare' },
  { key: 'live', id: 'competitions-list.live', status: 'started', tab: 'Live' },
  { key: 'incheiate', id: 'competitions-list.incheiate', status: 'completed', tab: 'Rezultate' },
] as const;

for (const l of LISTS) {
  test(`${l.id}.c1 — /concursuri/${l.key} is the index's «${l.tab}» tab (308), with its filter bar and cards`, async ({ page, request }) => {
    const res = await request.get(`/concursuri/${l.key}`, { maxRedirects: 0 });
    expect(res.status()).toBe(308);
    expect(res.headers()['location']).toMatch(new RegExp(`/concursuri\\?status=${l.status}$`));
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/concursuri/${l.key}`);
    await expect(page).toHaveURL(new RegExp(`/concursuri\\?status=${l.status}$`));
    await expect(page.getByRole('heading', { level: 1, name: 'Concursuri' })).toBeVisible();
    await expect(page.getByRole('tab', { name: l.tab })).toHaveAttribute('aria-selected', 'true');
    // One order and one name for the tabs, here and in the footer.
    // The count badges (§4b.20) follow the labels: compare the labels.
    const tabs = (await page.getByRole('tab').allTextContents()).map((t) => t.trim().replace(/(\d+|99\+)$/, ''));
    expect(tabs.slice(0, 3)).toEqual(['Viitoare', 'Live', 'Rezultate']);
    await expect(page.getByRole('group', { name: /^Filtre/ }).first()).toBeVisible();
    const footer = page.getByRole('navigation', { name: 'Concursuri pe stări' });
    await expect(footer.getByRole('link')).toHaveText(['Viitoare', 'Live', 'Rezultate']);
    await expect(footer.getByRole('link', { name: l.tab })).toHaveAttribute('href', `/concursuri?status=${l.status}`);
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
      await expect(alert).toContainText('Nu am putut încărca concursurile', { timeout: 20_000 });
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
