import { expect, test, type Page, type Route } from '@playwright/test';
import { BASE_URL } from './helpers/base-url';
import { collectConsoleErrors } from './helpers/console';

/*
 * Ape publice — Partide pe apă: the refresh rhythm (parity public-waters.partide.c13, behaviour
 * public-waters.b.refresh-intervals). The live venue section polls every 60s; the history does not
 * poll (staleTime 120s); neither retries a failed read on its own. Driven with the page clock;
 * the community reads are left to the browser (the page's dev-only fault switch `noprefetch`).
 */

test.setTimeout(180_000);

const TIN = { id: 328, code: 'L:RO10_01.025_L3' };
const venueUrl = `**/feed/community/waters/${encodeURIComponent(TIN.code)}`;
const historyUrl = '**/feed/community/history*';

const json = (body: unknown) => (route: Route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
const section = {
  data: {
    stats: { activeNow: 1, catchesThisMonth: 2, recordKg: 5 },
    activeSessions: [
      { documentId: 'p1', startedAt: new Date(Date.now() - 3_600_000).toISOString(), members: [{ uid: 'u1', name: 'Ion Pop', avatarUrl: null }], catchCount: 1, maxKg: 3, totalKg: 3 },
    ],
    monthlyActivity: [{ month: 'SEP', count: 1 }],
    speciesCounts: [],
  },
};
const history = { data: [], meta: { pagination: { page: 1, pageSize: 10, pageCount: 0, total: 0 } } };

async function setFaults(page: Page, faults: string[]) {
  const res = await page.request.post(`${BASE_URL}/ape-publice/${TIN.id}/e2e-fault`, { data: { faults } });
  expect(res.ok()).toBe(true);
}

test('public-waters.partide.c13 — the live section polls every 60s, the history does not; a failed poll is not retried', async ({ page }) => {
  collectConsoleErrors(page, { ignore: [/500/, /Failed to load resource/] });
  await setFaults(page, ['noprefetch']);
  try {
    await page.clock.install();
    await page.setViewportSize({ width: 1440, height: 900 });
    const hits = { venue: 0, history: 0 };
    let broken = false;
    await page.route(venueUrl, (route) => {
      hits.venue += 1;
      return broken ? route.fulfill({ status: 500, body: '{}' }) : json(section)(route);
    });
    await page.route(historyUrl, (route) => {
      hits.history += 1;
      return json(history)(route);
    });
    await page.goto(`/ape-publice/${TIN.id}/partide`);
    await expect(page.getByText('1 ACTIVI ACUM')).toBeVisible();
    const start = { ...hits };

    // Under a minute: nothing is asked again.
    await page.clock.runFor(55_000);
    expect(hits).toEqual(start);
    // At 60s the live section is read again; the history is not.
    await page.clock.runFor(6_000);
    await expect.poll(() => hits.venue).toBe(start.venue + 1);
    expect(hits.history).toBe(start.history);

    // A failed poll is one request — no automatic retry — and the last data stays.
    broken = true;
    await page.clock.runFor(60_000);
    await expect.poll(() => hits.venue).toBe(start.venue + 2);
    await page.clock.runFor(30_000);
    expect(hits.venue).toBe(start.venue + 2);
    await expect(page.getByText('1 ACTIVI ACUM')).toBeVisible();
    expect(hits.history).toBe(start.history);
  } finally {
    await setFaults(page, []);
  }
});
