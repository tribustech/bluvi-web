import { expect, test, type Page, type Route } from '@playwright/test';
import { expectNoA11yViolations } from './helpers/a11y';
import { card, media, page as cardsPage } from './competitions-list.fixtures';

/*
 * competitions-list.{viitoare,live,incheiate}-balta — fish /competitions/{status}/[lakeId]. These
 * screens have no page of their own: merged_into lakes.competitions (/balti/[id]/concursuri?tab=…),
 * whose header (the lake's name, not «Concursuri viitoare»), page size (10, not 5), data source
 * (/feed/competition-cards scoped by lakeId, not the legacy /feed/competitions list) and card
 * (the /concursuri compact card, not the legacy two-column card) win — parity README «Shared
 * routes». Each test below names the merged criterion and checks what the owner's page does for it.
 * c3, c5–c7 (lake from the URL, skeleton, error, empty) are in competitions-list-status.spec.ts.
 *
 * The lake page's dev fault switch (`competitions-tab`) makes the browser read the tab, so the
 * mocks answer it.
 */

const CHITA = 's84u55lo4n9z0emngozttt6e';
const CARDS = /\/feed\/competition-cards\?/;
const BALTA = [
  { id: 'competitions-list.viitoare-balta', tab: 'viitoare', status: 'notStarted' },
  { id: 'competitions-list.live-balta', tab: 'live', status: 'started' },
  { id: 'competitions-list.incheiate-balta', tab: 'trecute', status: 'completed' },
] as const;

const json = (r: Route, body: unknown, status = 200) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const setFaults = (page: Page, faults: string[]) => page.request.post(`/balti/${CHITA}/e2e-fault`, { data: { faults } });
const url = (tab: string) => `/balti/${CHITA}/concursuri${tab === 'live' ? '' : `?tab=${tab}`}`;

const lakeImage = media({ url: 'http://localhost:1337/uploads/lake.jpg?o' });
lakeImage.smallUrl = 'http://localhost:1337/uploads/lake.jpg?s';

function rows(status: string, n: number, prefix: string) {
  return Array.from({ length: n }, (_, i) =>
    card(`${prefix}-${i}`, {
      name: `FX ${prefix} ${i}`,
      status,
      lake: { documentId: CHITA, name: 'Chita Lake', county: null, image: lakeImage },
      pendingCount: status === 'notStarted' && i === 0 ? 2 : 0,
      format: i === 1 ? { kind: 'team', teamSize: 2, unit: 'echipe' } : { kind: 'single', teamSize: null, unit: 'pescari' },
      participantFaces: ['http://localhost:1337/uploads/face.jpg'],
      viewers: 3,
      dateLabel: '20 oct – 21 oct',
    }),
  );
}

for (const b of BALTA) {
  test(`${b.id}.c1 ${b.id}.c2 ${b.id}.c4 ${b.id}.c8 ${b.id}.c9 ${b.id}.c10 ${b.id}.c11 ${b.id}.c12 ${b.id}.c13 ${b.id}.c14 ${b.id}.c15 ${b.id}.s4 ${b.id}.s6 — the lake's tab: header, lake-scoped cards, next page, card content, a card opens the competition`, async ({ page }) => {
    test.setTimeout(120_000);
    await setFaults(page, ['competitions-tab']);
    try {
      const asked: URL[] = [];
      await page.route(CARDS, async (r) => {
        const u = new URL(r.request().url());
        if (u.searchParams.get('status') !== b.status) return r.continue();
        asked.push(u);
        const n = Number(u.searchParams.get('page') ?? '1');
        if (n === 2) await new Promise((res) => setTimeout(res, 800));
        return json(r, cardsPage(rows(b.status, n === 1 ? 10 : 3, `p${n}`), { page: n, pageCount: 2, total: 13 }));
      });
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(url(b.tab));
      // c1: a back control beside the title; the owner's title is the lake's name (lakes.competitions.c1).
      await expect(page.getByRole('heading', { level: 1, name: 'Chita Lake' })).toBeVisible({ timeout: 60_000 });
      await expect(page.getByRole('button', { name: 'Înapoi' })).toBeVisible();
      await expect(page.getByRole('tab', { selected: true })).toHaveText(b.tab === 'live' ? /Live/ : b.tab === 'viitoare' ? /Viitoare/ : /Trecute/);
      // c2: this lake's cards of this status (owner: competition cards, 10 a page).
      const panel = page.getByRole('tabpanel');
      const items = panel.getByRole('listitem').filter({ has: page.getByRole('link', { name: /^FX / }) });
      await expect(items).toHaveCount(10);
      expect(asked[0].searchParams.get('lakeId')).toBe(CHITA);
      expect(asked[0].searchParams.get('pageSize')).toBe('10');
      // c4: the compact card in a grid.
      const first = items.first();
      // c10: no banner → the lake's image, small format.
      await expect(first.locator('img').first()).toHaveAttribute('src', /lake\.jpg(%3F|\?)s/);
      // c11 / c12: live → LIVE + date; otherwise the date in upper case; the followers pill on every card.
      if (b.status === 'started') await expect(first.getByText('LIVE · 20 oct – 21 oct')).toBeVisible();
      else await expect(first.getByText('20 oct – 21 oct', { exact: true })).toHaveCSS('text-transform', 'uppercase');
      await expect(first.getByRole('button', { name: /3 urmăritori/ })).toBeVisible();
      // c13: the name; the lake line is the owner's call (not repeated on its own lake's page).
      await expect(first.getByRole('link', { name: 'FX p1 0' })).toBeVisible();
      await expect(first.getByText('Chita Lake')).toHaveCount(0);
      if (b.status === 'notStarted') {
        await expect(first.getByText('6/10 pescari')).toBeVisible();
        // c14: pending registrations on an upcoming card.
        await expect(first.getByText('2 în așteptare')).toBeVisible();
      }
      // c15: format and ranking chips.
      await expect(first.getByText('Individual', { exact: true })).toBeVisible();
      await expect(items.nth(1).getByText('Echipe', { exact: true })).toBeVisible();
      await expect(first.getByText('Cantitate', { exact: true })).toBeVisible();
      // c8: the end of the list loads the next page, with the footer while it loads.
      await page.getByText('10 din 13 concursuri').scrollIntoViewIfNeeded();
      await expect(page.getByRole('button', { name: 'Se încarcă…' })).toBeVisible();
      await expect(items).toHaveCount(13);
      expect(asked.map((u) => u.searchParams.get('page'))).toContain('2');
      await expectNoA11yViolations(page);
      // c9: a card opens the competition.
      await first.getByRole('link', { name: 'FX p1 0' }).click();
      await expect(page).toHaveURL(/\/concursuri\/p1-0$/, { timeout: 60_000 });
    } finally {
      await setFaults(page, []);
    }
  });
}

for (const b of BALTA) {
  test(`${b.id}.c16 — a card that crashes the render: the route's retry card, the shell keeps working`, async ({ page }) => {
    test.setTimeout(120_000);
    await setFaults(page, ['competitions-tab']);
    try {
      await page.addInitScript(() => {
        const toFixed = Number.prototype.toFixed;
        Number.prototype.toFixed = function (this: number, digits?: number) {
          if (Number(this) === 4242.4) throw new Error('fixture: unrenderable figure');
          return toFixed.call(this, digits);
        };
      });
      // A live card with a weighed total renders the figure; the other tabs read an empty list.
      const broken = card('fx-crash', {
        name: 'FX Card stricat',
        status: 'started',
        results: { capturedAt: '2026-10-05T10:00:00.000Z', hasCatches: true, catchCount: 3, totalKg: 4242.4, biggestFishKg: 2.5, podium: [] },
      });
      await page.route(CARDS, async (r) => {
        const u = new URL(r.request().url());
        if (u.searchParams.get('status') !== b.status) return r.continue();
        return json(r, cardsPage([broken]));
      });
      await page.goto(url(b.tab));
      const heading = page.getByRole('heading', { name: 'Concursurile nu au putut fi încărcate' });
      await expect(heading).toBeVisible({ timeout: 60_000 });
      await expect(page.getByRole('link', { name: 'Acasă' }).first()).toBeVisible();
      // The retry is never silent and never a blank page (the cached card still crashes, so the
      // card stays and says so — re-reading on retry is lakes.b.route-error-boundary's call).
      await page.getByRole('button', { name: 'Încearcă din nou' }).click();
      await expect(page.getByText(/^Tot nu s-a putut încărca\. Încercarea/)).toBeVisible({ timeout: 30_000 });
      await expect(heading).toBeVisible();
      await expectNoA11yViolations(page);
    } finally {
      await setFaults(page, []);
    }
  });
}

for (const b of BALTA) {
  // fish sends the request with an unknown lakeId and shows empty or error. WEB: the lake is read
  // first, so an unknown one is the shared «not found» page (noindex) and no card list is asked for.
  test(`${b.id}.s7 — an unknown lakeId: the not-found page, no card read`, async ({ page }) => {
    const reads: string[] = [];
    page.on('request', (r) => {
      if (CARDS.test(r.url())) reads.push(r.url());
    });
    await page.goto(`/balti/nuexista000000000000000/concursuri?tab=${b.tab}`);
    await expect(page).toHaveTitle(/Balta nu a fost găsită/);
    await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute('content', /noindex/);
    await expect(page.getByRole('link', { name: 'Acasă' }).first()).toBeVisible();
    expect(reads.filter((u) => u.includes('nuexista'))).toEqual([]);
    await expectNoA11yViolations(page);
  });
}
