import { collectConsoleErrors } from './helpers/console';
import { BASE_URL } from './helpers/base-url';
import { expect, test, type Page, type Route } from '@playwright/test';
import { expectNoA11yViolations } from './helpers/a11y';
import { CMS, qaJwt, signIn } from './helpers/session';

/*
 * The public water's community pages (parity docs/parity/areas/public-waters.yml):
 * public-waters.partide (/ape-publice/<id>/partide), public-waters.statistici (/statistici),
 * public-waters.clasament (/clasament) and public-waters.capturi (/capturi). Each test names the
 * criterion / state ids it covers.
 *
 * Real local data: Lacul Tineretului (id 328) has 12 finished partide (two history pages) and a
 * year of statistics (12 partide, 3 anglers, Crap) but no photo catches. Every other state is
 * served from fixtures with page.route: the pages prefetch their first reads on the server, so a
 * fixture test first sets the dev-only `noprefetch` switch (app/(site)/ape-publice/_server/e2e-faults.ts)
 * and the browser makes the reads.
 */

// The shared dev server compiles on first hit and the machine is shared: generous per-test time.
test.setTimeout(180_000);

const TIN = { id: 328, code: 'L:RO10_01.025_L3', name: 'Tineretului' };
const CODE = encodeURIComponent(TIN.code);
const PHONE = { width: 375, height: 812 };
const DESKTOP = { width: 1440, height: 900 };

const venueUrl = `**/feed/community/waters/${CODE}`;
const catchesUrl = `**/feed/community/waters/${CODE}/catches*`;
const historyUrl = '**/feed/community/history*';
const statsUrl = '**/feed/community/stats*';

const fulfill = (body: unknown) => (route: Route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
const fail = (route: Route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });

async function setFaults(page: Page, id: number | string, faults: string[]) {
  const res = await page.request.post(`${BASE_URL}/ape-publice/${encodeURIComponent(String(id))}/e2e-fault`, { data: { faults } });
  expect(res.ok()).toBe(true);
}
/** Runs `run` with the community reads left to the browser (fixtures apply). */
async function clientReads(page: Page, run: () => Promise<void>, extra: string[] = []) {
  await setFaults(page, TIN.id, ['noprefetch', ...extra]);
  try {
    await run();
  } finally {
    await setFaults(page, TIN.id, []);
  }
}

function watchConsole(page: Page, allow: RegExp[] = []) {
  return collectConsoleErrors(page, { ignore: allow });
}

/** A period chip as the viewer sees it (from 1280 the chips live in the left column, the toolbar's are hidden). */
const chip = (page: Page, label: string) => page.getByText(label, { exact: true }).locator('visible=true').first();

/** No broken-image glyph: every <img> on the page that finished loading has pixels. */
async function expectNoBrokenImages(page: Page) {
  await expect
    .poll(() => page.evaluate(() => [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && i.getClientRects().length > 0).length))
    .toBe(0);
}

/* ---------------------------------------------------------------- fixtures */

const PIXEL = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="4" height="3"><rect width="4" height="3" fill="gray"/></svg>';
const aCatch = (i: number, session = `s${i}`, ago = 0) => ({
  clientId: `c${i}`,
  sessionDocumentId: session,
  species: 'Crap',
  weightKg: 2 + i / 10,
  photoUrl: PIXEL,
  photoGridUrl: PIXEL,
  photoThumbUrl: PIXEL,
  photoWidth: 400,
  photoHeight: 300,
  occurredAt: new Date(Date.now() - ago).toISOString(),
  angler: { uid: `u${i}`, name: `Pescar ${i}`, avatarUrl: null },
});
const catchesPage = (page: number, total: number, make = (i: number) => aCatch(i, `s${i}`, 2 * 86_400_000)) => ({
  data: Array.from({ length: Math.max(0, Math.min(20, total - (page - 1) * 20)) }, (_, i) => make((page - 1) * 20 + i)),
  meta: { pagination: { page, pageSize: 20, pageCount: Math.ceil(total / 20), total } },
});
const session = (id: string, name: string, kg: number | null) => ({
  documentId: id,
  startedAt: new Date(Date.now() - 3_600_000).toISOString(),
  members: [{ uid: `u-${id}`, name, avatarUrl: null }],
  catchCount: kg ? 2 : 0,
  maxKg: kg,
  totalKg: kg,
});
const section = (sessions: ReturnType<typeof session>[]) => ({
  data: {
    stats: { activeNow: sessions.length, catchesThisMonth: 4, recordKg: 8.4 },
    activeSessions: sessions,
    monthlyActivity: [{ month: 'SEP', count: 2 }],
    speciesCounts: [{ species: 'Crap', count: 4 }],
  },
});
const historyRow = (i: number) => ({
  documentId: `h${i}`,
  startedAt: '2026-09-20T05:00:00.000Z',
  endedAt: '2026-09-20T15:30:00.000Z',
  members: [{ uid: `u${i}`, name: `Pescar ${i}`, avatarUrl: null }],
  venue: { key: `water:${TIN.code}`, venueType: 'publicWater', lakeId: null, name: TIN.name, locality: null, imageUrl: null },
  catchCount: 3,
  maxKg: 4.2,
  totalKg: 9.5,
  photoUrl: null,
  standName: null,
  photos: [{ url: PIXEL, thumbUrl: PIXEL, weightKg: 4.2 }],
  photoCount: 1,
});
const historyPage = (rows: number) => ({ data: Array.from({ length: rows }, (_, i) => historyRow(i)), meta: { pagination: { page: 1, pageSize: 10, pageCount: rows ? 1 : 0, total: rows } } });
const emptyHistory = historyPage(0);
const emptySection = { data: { stats: { activeNow: 0, catchesThisMonth: 0, recordKg: null }, activeSessions: [], monthlyActivity: [], speciesCounts: [] } };

const angler = (i: number, uid = `a${i}`) => ({ uid, name: `Pescar ${i} Popescu` as string | null, avatarUrl: null as string | null, partide: 10 - i, catches: 20 - i, totalKg: 50 - i * 5 });
const stats = (period: string, o: Partial<{ partide: number; anglers: number; top: ReturnType<typeof angler>[]; species: { name: string; count: number; pct: number }[]; record: unknown; series: { label: string; count: number }[] }> = {}) => ({
  data: {
    period,
    totals: { partide: o.partide ?? 7, anglers: o.anglers ?? (o.top?.length ?? 5), catches: 31, totalKg: 120.5 },
    weeklySeries: o.series ?? [
      { label: 'L', count: 1 },
      { label: 'Ma', count: 4 },
      { label: 'Mi', count: 2 },
    ],
    topAnglers: o.top ?? [angler(1), angler(2), angler(3), angler(4), angler(5)],
    topVenues: [],
    record: o.record === undefined ? { weightKg: 12.4, species: 'Somn', venueName: TIN.name, sessionDocumentId: 'p9', angler: { uid: 'a1', name: 'Pescar 1 Popescu', avatarUrl: null }, occurredAt: '2026-09-12T10:00:00.000Z', photoUrl: null, photoWidth: null, photoHeight: null } : o.record,
    species: o.species ?? [
      { name: 'Crap', count: 20, pct: 65 },
      { name: 'Caras', count: 11, pct: 35 },
    ],
    stands: [],
  },
});

/* ============================================================================================
 * Shared: the water resolves like the detail page
 * ========================================================================================== */

test.describe('public-waters subpages — the water', () => {
  for (const sub of ['partide', 'statistici', 'clasament', 'capturi'] as const) {
    test(`public-waters.${sub}.c1 public-waters.${sub}.s1 public-waters.${sub}.s2 — not found, no linkCode, dataset error`, async ({ page }) => {
      await page.goto(`/ape-publice/999999/${sub}`);
      await expect(page.getByRole('heading', { name: 'Apa publică nu a fost găsită.' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Încearcă din nou' })).toHaveCount(0);
      // A water without a linkCode has no community identity: a permanent not-found.
      await setFaults(page, TIN.id, ['nolinkcode']);
      try {
        await page.goto(`/ape-publice/${TIN.id}/${sub}`);
        await expect(page.getByRole('heading', { name: 'Apa publică nu a fost găsită.' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Încearcă din nou' })).toHaveCount(0);
        // A dataset failure keeps its retry.
        await setFaults(page, TIN.id, ['error']);
        await page.goto(`/ape-publice/${TIN.id}/${sub}`);
        await expect(page.getByRole('heading', { name: 'Nu am putut încărca apa publică.' })).toBeVisible();
        // The error's way back is the water's own page (the route param), never the map.
        await expect(page.getByRole('link', { name: 'Apa publică', exact: true })).toHaveAttribute('href', `/ape-publice/${TIN.id}`);
        await setFaults(page, TIN.id, []);
        await page.getByRole('button', { name: 'Încearcă din nou' }).click();
        await expect(page.getByRole('heading', { level: 1 })).not.toHaveText('Nu am putut încărca apa publică.');
      } finally {
        await setFaults(page, TIN.id, []);
      }
    });
  }

  test('public-waters.b.route-param — the linkCode and the row id open the same subpage; canonical is the linkCode', async ({ page }) => {
    await page.goto(`/ape-publice/${CODE}/statistici`);
    await expect(page.getByRole('heading', { level: 1, name: TIN.name })).toBeVisible();
    await page.goto(`/ape-publice/${TIN.id}/clasament?perioada=year`);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', new RegExp(`/ape-publice/${CODE.replace(/[.%]/g, '\\$&')}/clasament$`));
    const ld = await page.locator('script[type="application/ld+json"]').first().textContent();
    expect(ld).toContain('"BreadcrumbList"');
  });
});

/* ============================================================================================
 * public-waters.partide
 * ========================================================================================== */

test.describe('public-waters.partide', () => {
  test('public-waters.partide.c2 public-waters.partide.s7 — real data: the header and the history', async ({ page, request }) => {
    const errors = watchConsole(page);
    // Whatever the local CMS holds today: the first page is its first min(total, 10) partide.
    const total = (await (await request.get(`${CMS}/feed/community/history?page=1&pageSize=10&venue=${encodeURIComponent(`water:${TIN.code}`)}`)).json()).meta.pagination.total as number;
    await page.setViewportSize(DESKTOP);
    await page.goto(`/ape-publice/${TIN.id}/partide`);
    await expect(page.getByRole('heading', { level: 1, name: TIN.name })).toBeVisible();
    await expect(page.getByText('Partide pe apă', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Înapoi' })).toBeVisible();
    if (total > 0) {
      await expect(page.getByRole('heading', { name: 'Partide încheiate' })).toBeVisible();
      await expect.poll(() => page.getByTestId('history-card').count()).toBeGreaterThanOrEqual(Math.min(total, 10));
    }
    await expectNoA11yViolations(page);
    expect(errors).toEqual([]);
  });

  test('public-waters.partide.c9 c10 public-waters.partide.s7 s8 — the statistics card; history pages of 10, de-duplicated', async ({ page }) => {
    await clientReads(page, async () => {
      const pages: number[] = [];
      await page.route(venueUrl, fulfill(emptySection));
      await page.route(catchesUrl, fulfill(catchesPage(1, 0)));
      await page.route(historyUrl, (route) => {
        const url = new URL(route.request().url());
        const n = Number(url.searchParams.get('page') ?? '1');
        pages.push(n);
        expect(url.searchParams.get('pageSize')).toBe('10');
        // Page 2 repeats the last row of page 1 (a partidă finished between the reads): shown once.
        const rows = n === 1 ? Array.from({ length: 10 }, (_, i) => historyRow(i)) : [historyRow(9), historyRow(10), historyRow(11)];
        return fulfill({ data: rows, meta: { pagination: { page: n, pageSize: 10, pageCount: 2, total: 13 } } })(route);
      });
      await page.setViewportSize(DESKTOP);
      await page.goto(`/ape-publice/${TIN.id}/partide`);
      const cards = page.getByTestId('history-card');
      await expect.poll(() => cards.count()).toBeGreaterThanOrEqual(10);
      // c10: the next page near the end of the list.
      await cards.last().scrollIntoViewIfNeeded();
      await page.mouse.wheel(0, 3000);
      await expect(cards).toHaveCount(12);
      expect(pages).toEqual([1, 2]);
      // c9: the statistics card opens the water's statistics.
      const cta = page.locator('[data-testid="stats-cta"]:visible');
      await expect(cta).toContainText('Statisticile apei');
      // A water's Statistici has no stands (statistici.c11): the caption never promises them.
      await expect(cta).toContainText('Top pescari, recorduri și specii');
      await expect(cta).not.toContainText('standuri');
      await expect(cta).toContainText('Vezi statisticile');
      await expect(cta).toHaveAttribute('href', `/ape-publice/${CODE}/statistici`);
      await cta.click();
      await expect(page).toHaveURL(new RegExp(`/ape-publice/${CODE.replace(/[.%]/g, '\\$&')}/statistici$`));
    });
  });

  test('public-waters.partide.c8 — rail tiles: kg, initials, «acum» / «acum N min» / «acum N h» under a day, else the short date', async ({ page }) => {
    await clientReads(page, async () => {
      const at = (i: number, iso: string) => ({ ...aCatch(i, `s${i}`), occurredAt: iso, angler: { uid: `u${i}`, name: 'Ana Maria', avatarUrl: null } });
      const now = Date.now();
      const data = [at(1, new Date(now - 20_000).toISOString()), at(2, new Date(now - 2 * 3_600_000 - 60_000).toISOString()), at(3, '2026-07-27T10:00:00.000Z')];
      await page.route(venueUrl, fulfill(emptySection));
      await page.route(historyUrl, fulfill(historyPage(1)));
      await page.route(catchesUrl, fulfill({ data, meta: { pagination: { page: 1, pageSize: 20, pageCount: 1, total: 3 } } }));
      for (const size of [PHONE, DESKTOP]) {
        await page.setViewportSize(size);
        await page.goto(`/ape-publice/${TIN.id}/partide`);
        const rail = page.locator('[data-testid="catches-rail"]:visible');
        await expect(rail.getByRole('heading')).toHaveText('Ultimele capturi');
        const tiles = rail.getByRole('link');
        await expect(tiles).toHaveCount(3);
        await expect(tiles.nth(0)).toHaveText(/^2,1\s*kgAM\s*acum$/);
        await expect(tiles.nth(1)).toContainText('acum 2 h');
        await expect(tiles.nth(2)).toContainText('27 IUL');
        await expect(tiles.nth(2)).not.toContainText('acum');
        await expect(tiles.nth(1)).toHaveAccessibleName('Deschide captura: Crap, 2,2 kg, Ana Maria');
        for (const [i, tile] of (await tiles.all()).entries()) await expect(tile).toHaveAttribute('href', `/ape-publice/${CODE}/capturi?foto=c${i + 1}`);
      }
    });
  });

  test('public-waters.partide.c3 public-waters.partide.s3 — the skeleton while a feed is pending', async ({ page }) => {
    await clientReads(page, async () => {
      let release: () => void = () => {};
      const gate = new Promise<void>((r) => (release = r));
      await page.route(venueUrl, async (route) => {
        await gate;
        return fulfill(emptySection)(route);
      });
      await page.route(historyUrl, fulfill(historyPage(2)));
      await page.goto(`/ape-publice/${TIN.id}/partide`);
      await expect(page.getByTestId('partide-skeleton')).toBeVisible();
      release();
      await expect(page.getByTestId('history-card')).toHaveCount(2);
    });
  });

  test('public-waters.partide.c4 c12 public-waters.partide.s4 — both feeds failed; the retry refetches both', async ({ page }) => {
    watchConsole(page, [/500/, /Failed to load resource/]);
    await clientReads(page, async () => {
      let broken = true;
      const hits = { venue: 0, history: 0 };
      await page.route(venueUrl, (route) => (hits.venue++, broken ? fail(route) : fulfill(emptySection)(route)));
      await page.route(historyUrl, (route) => (hits.history++, broken ? fail(route) : fulfill(historyPage(1))(route)));
      await page.goto(`/ape-publice/${TIN.id}/partide`);
      const alert = page.getByTestId('partide-error');
      await expect(alert).toContainText('Nu am putut încărca partidele.');
      await expect(alert).toContainText('Verifică conexiunea');
      await expectNoA11yViolations(page);
      broken = false;
      const before = { ...hits };
      await alert.getByRole('button', { name: 'Încearcă din nou' }).click();
      await expect(page.getByTestId('history-card')).toHaveCount(1);
      expect(hits.venue).toBeGreaterThan(before.venue);
      expect(hits.history).toBeGreaterThan(before.history);
      // c12: «Reîmprospătează» refetches both feeds together.
      const again = { ...hits };
      await page.getByRole('button', { name: 'Reîmprospătează' }).click();
      await expect.poll(() => hits.venue > again.venue && hits.history > again.history).toBe(true);
    });
  });

  test('public-waters.partide.c5 public-waters.partide.s5 — nothing recorded on the water', async ({ page }) => {
    await clientReads(page, async () => {
      await page.route(venueUrl, fulfill(emptySection));
      await page.route(historyUrl, fulfill(emptyHistory));
      await page.setViewportSize(PHONE);
      await page.goto(`/ape-publice/${TIN.id}/partide`);
      const empty = page.getByTestId('partide-empty');
      await expect(empty).toContainText('Nicio partidă înregistrată pe această apă încă.');
      // Until the web's start flow ships: «Începe o partidă aici» opens the app's store listing
      // (Google Play first off Apple devices), the other store beside it — never a dead end.
      await expect(empty.getByRole('link', { name: 'Începe o partidă aici' })).toHaveAttribute('href', /play\.google\.com/);
      await expect(empty.getByRole('link', { name: 'App Store' })).toHaveAttribute('href', /apps\.apple\.com/);
      await expectNoA11yViolations(page);
    });
  });

  test('public-waters.partide.c4 public-waters.partide.s4 — one feed failed: never the empty state, never «Actualizat»', async ({ page }) => {
    watchConsole(page, [/500/, /Failed to load resource/]);
    await clientReads(page, async () => {
      // The live section failed, the history is empty: the page's error, not «Nicio partidă…».
      let venueBroken = true;
      await page.route(venueUrl, (route) => (venueBroken ? fail(route) : fulfill(emptySection)(route)));
      await page.route(historyUrl, fulfill(emptyHistory));
      await page.goto(`/ape-publice/${TIN.id}/partide`);
      await expect(page.getByTestId('partide-error')).toContainText('Nu am putut încărca partidele.');
      await expect(page.getByTestId('partide-empty')).toHaveCount(0);
      // The refresh reports the failure, never «Actualizat».
      await page.getByRole('button', { name: 'Reîmprospătează' }).click();
      await expect(page.getByRole('status').filter({ hasText: 'Nu s-a putut actualiza' })).toBeAttached();
      venueBroken = false;
      await page.getByTestId('partide-error').getByRole('button', { name: 'Încearcă din nou' }).click();
      await expect(page.getByTestId('partide-empty')).toContainText('Nicio partidă înregistrată pe această apă încă.');
      await page.unrouteAll({ behavior: 'ignoreErrors' });

      // The history failed, the live section is empty: the same.
      await page.route(venueUrl, fulfill(emptySection));
      await page.route(historyUrl, fail);
      await page.goto(`/ape-publice/${TIN.id}/partide`);
      await expect(page.getByTestId('partide-error')).toContainText('Nu am putut încărca partidele.');
      await expect(page.getByTestId('partide-empty')).toHaveCount(0);
      await page.unrouteAll({ behavior: 'ignoreErrors' });

      // The history failed beside live sessions: the live card stays, the error takes the history's place.
      await page.route(venueUrl, fulfill(section([session('p1', 'Ion Pop', 9.5)])));
      await page.route(historyUrl, fail);
      await page.route(catchesUrl, fulfill(catchesPage(1, 0)));
      await page.goto(`/ape-publice/${TIN.id}/partide`);
      await expect(page.getByTestId('live-block')).toBeVisible();
      await expect(page.getByTestId('history-error')).toContainText('Nu am putut încărca partidele încheiate.');
      await page.unrouteAll({ behavior: 'ignoreErrors' });

      // The live section failed beside history rows: the rows stay, the error takes the live card's place.
      await page.route(venueUrl, fail);
      await page.route(historyUrl, fulfill(historyPage(2)));
      await page.route(catchesUrl, fulfill(catchesPage(1, 0)));
      await page.goto(`/ape-publice/${TIN.id}/partide`);
      await expect(page.getByTestId('history-card')).toHaveCount(2);
      await expect(page.getByTestId('live-error')).toContainText('Nu am putut încărca partidele active.');
      await expectNoA11yViolations(page);
    });
  });

  test('public-waters.partide.c10 — history cards: a dead avatar falls back to initials, the stand alone on the meta line, a multi-day range', async ({ page }) => {
    await clientReads(page, async () => {
      const dead = `${BASE_URL}/__e2e-missing-avatar.jpg`;
      const rows = [
        { ...historyRow(1), members: [{ uid: 'u1', name: 'Mario Tt', avatarUrl: dead }], standName: '12', endedAt: '2026-09-22T15:30:00.000Z', photos: [{ url: dead, thumbUrl: dead, weightKg: 4.2 }] },
        { ...historyRow(2), members: [{ uid: 'u2', name: 'Ana Ene', avatarUrl: dead }, { uid: 'u3', name: 'Ion Pop', avatarUrl: null }] },
      ];
      await page.route(venueUrl, fulfill(emptySection));
      await page.route(historyUrl, fulfill({ data: rows, meta: { pagination: { page: 1, pageSize: 10, pageCount: 1, total: 2 } } }));
      await page.route(catchesUrl, fulfill(catchesPage(1, 0)));
      for (const size of [PHONE, DESKTOP]) {
        await page.setViewportSize(size);
        await page.goto(`/ape-publice/${TIN.id}/partide`);
        const first = page.getByTestId('history-card').first();
        await expect(first.getByTestId('angler-avatar')).toContainText('MT');
        await expectNoBrokenImages(page);
        // The water's own page: the stand alone, once, no water name, no double separator.
        await expect(first.getByTestId('history-meta')).toHaveText('Stand 12');
        await expect(first.getByText('20 SEP 08:00 – 22 SEP 18:30')).toBeVisible();
        await expect(page.getByTestId('history-card').nth(1).getByTestId('history-meta')).toHaveCount(0);
      }
    });
  });

  test('public-waters.partide.c6 c7 c8 public-waters.partide.s6 — two live sessions: the live card, their catches in the rail', async ({ page }) => {
    await clientReads(page, async () => {
      await page.route(venueUrl, fulfill(section([session('p1', 'Ion Pop', 9.5), session('p2', 'Ana Ene', null)])));
      await page.route(historyUrl, fulfill(emptyHistory));
      await page.route(catchesUrl, fulfill({ ...catchesPage(1, 0), data: [aCatch(1, 'other', 3_000_000), aCatch(2, 'p1', 8 * 60_000 + 45_000), aCatch(3, 'p2', 26 * 3_600_000)] }));
      await page.setViewportSize(PHONE);
      await page.goto(`/ape-publice/${TIN.id}/partide`);
      await expect(page.getByTestId('live-block').getByText('2 ACTIVI ACUM')).toBeVisible();
      const rail = page.locator('[data-testid="catches-rail"]:visible');
      await expect(rail.getByRole('heading')).toHaveText('Capturi în partidele active');
      const tiles = rail.getByRole('link');
      await expect(tiles).toHaveCount(2);
      // c8: kg, the angler's initials, «acum N min» under a day, a date after; → /capturi?foto=.
      await expect(tiles.nth(0)).toContainText('2,2');
      await expect(tiles.nth(0)).toContainText('acum 8 min');
      await expect(tiles.nth(1)).not.toContainText('acum');
      await expect(tiles.nth(0)).toHaveAttribute('href', `/ape-publice/${CODE}/capturi?foto=c2`);
      await expectNoA11yViolations(page);
      await tiles.nth(0).click();
      await expect(page).toHaveURL(/\/capturi\?foto=c2$/);
    });
  });

  test('public-waters.partide.c7 — one live session: the rail shows the venue’s OTHER catches, «Ultimele capturi»', async ({ page }) => {
    await clientReads(page, async () => {
      await page.route(venueUrl, fulfill(section([session('p1', 'Ion Pop', 9.5)])));
      await page.route(historyUrl, fulfill(historyPage(1)));
      await page.route(catchesUrl, fulfill({ ...catchesPage(1, 0), data: [aCatch(1, 'p1'), aCatch(2, 'x'), aCatch(3, 'y')] }));
      await page.setViewportSize(DESKTOP);
      await page.goto(`/ape-publice/${TIN.id}/partide`);
      const rail = page.locator('[data-testid="catches-rail"]:visible');
      await expect(rail.getByRole('heading')).toHaveText('Ultimele capturi');
      await expect(rail.getByRole('link')).toHaveCount(2);
      await expect(rail.getByRole('link').first()).toHaveAttribute('href', /foto=c2$/);
    });
  });
});

/* ============================================================================================
 * public-waters.statistici
 * ========================================================================================== */

test.describe('public-waters.statistici', () => {
  test('public-waters.statistici.c2 c3 c8 c9 c11 public-waters.statistici.s7 — real data (year): content order, «Clasament ›» carries the period', async ({ page, request }) => {
    const errors = watchConsole(page);
    // The figures are whatever the local CMS holds today (never hard-coded: local data drifts).
    const year = (await (await request.get(`${CMS}/feed/community/stats?period=year&venue=${encodeURIComponent(`water:${TIN.code}`)}`)).json()).data;
    test.skip(year.totals.partide === 0 || year.topAnglers.length === 0, 'needs a year of partide on Lacul Tineretului in the local CMS');
    await page.setViewportSize(DESKTOP);
    await page.goto(`/ape-publice/${TIN.id}/statistici?perioada=year`);
    await expect(page.getByRole('heading', { level: 1, name: TIN.name })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Anul curent' })).toBeChecked();
    const strip = page.getByTestId('stat-strip');
    await expect(strip).toContainText(String(year.totals.partide));
    await expect(strip).toContainText(year.totals.partide === 1 ? 'partidă' : 'partide');
    await expect(page.getByText('Statisticile apei', { exact: true })).toBeVisible();
    // c2: the back control at every width (the family's header).
    await expect(page.getByRole('button', { name: 'Înapoi' })).toBeVisible();
    await expect(page.getByTestId('activity-card')).toBeVisible();
    await expect(page.getByTestId('top-anglers').getByRole('listitem')).toHaveCount(Math.min(3, year.topAnglers.length));
    // c9: «Clasament ›» and the left column's link both carry the period.
    const toRanking = page.getByRole('link', { name: 'Clasament' });
    await expect(toRanking).toHaveCount(2);
    for (const link of await toRanking.all()) await expect(link).toHaveAttribute('href', `/ape-publice/${CODE}/clasament?perioada=year`);
    // From 1280 three columns, as Clasament: the period in the left column.
    await expect(page.getByRole('complementary', { name: 'Perioada și paginile apei' })).toBeVisible();
    if (year.species.length) await expect(page.locator('[data-testid="species-card"]:visible')).toContainText(year.species[0].name);
    // c11: never «Top standuri» on a public water.
    await expect(page.getByText('Top standuri')).toHaveCount(0);
    // c3: switching the period replaces the URL (no new history entry).
    const length = await page.evaluate(() => history.length);
    await chip(page, 'Săptămâna').click();
    await expect(page).toHaveURL(/statistici\?perioada=week$/);
    expect(await page.evaluate(() => history.length)).toBe(length);
    await chip(page, 'Luna').click();
    await expect(page).toHaveURL(/statistici$/);
    // Settled (the switch is over) before the contrast audit — the month may or may not have partide.
    await expect(page.getByTestId('stats-empty').or(page.getByTestId('stat-strip'))).toBeVisible();
    await expect(page.getByTestId('switching-bar')).toHaveCount(0);
    await expectNoA11yViolations(page);
    expect(errors).toEqual([]);
  });

  test('public-waters.statistici.c3 c6 public-waters.statistici.s5 — unknown period → month; an empty period keeps the chips', async ({ page }) => {
    await clientReads(page, async () => {
      const asked: string[] = [];
      await page.route(statsUrl, (route) => {
        const url = new URL(route.request().url());
        asked.push(`${url.searchParams.get('period')}|${url.searchParams.get('venue')}`);
        return fulfill(stats(url.searchParams.get('period') ?? 'month', { partide: 0, anglers: 0, top: [], species: [], record: null, series: [] }))(route);
      });
      for (const size of [PHONE, DESKTOP]) {
        await page.setViewportSize(size);
        await page.goto(`/ape-publice/${TIN.id}/statistici?perioada=decenii`);
        await expect(page.getByRole('radio', { name: 'Luna' }).locator('visible=true')).toBeChecked();
        await expect(page.getByTestId('stats-empty')).toContainText('Nicio partidă în perioada selectată.');
        // c6: the chips stay, and they still switch.
        await expect(chip(page, 'Săptămâna')).toBeVisible();
        await expect(page.getByTestId('stat-strip')).toHaveCount(0);
      }
      expect(asked[0]).toBe(`month|water:${TIN.code}`);
      await chip(page, 'Săptămâna').click();
      await expect(page).toHaveURL(/statistici\?perioada=week$/);
      await expect(page.getByTestId('stats-empty')).toContainText('Nicio partidă în perioada selectată.');
    });
  });

  test('public-waters.statistici.c11 c12 — never «Top standuri» on a water; cached per period for 60s; a failed read is not retried', async ({ page }) => {
    watchConsole(page, [/500/, /Failed to load resource/]);
    await clientReads(page, async () => {
      const asked: string[] = [];
      let broken = false;
      const stand = { standId: 's1', name: '7', partide: 3, catches: 5, totalKg: 12, recordKg: 4 };
      await page.route(statsUrl, (route) => {
        const period = new URL(route.request().url()).searchParams.get('period') ?? 'month';
        asked.push(period);
        if (broken) return fail(route);
        const body = stats(period);
        return fulfill({ data: { ...body.data, stands: [stand] } })(route);
      });
      await page.clock.install();
      await page.setViewportSize(DESKTOP);
      await page.goto(`/ape-publice/${TIN.id}/statistici`);
      await expect(page.getByTestId('stat-strip')).toContainText('7');
      // c11: the CMS may send stands; a water never shows them.
      await expect(page.getByText('Top standuri')).toHaveCount(0);
      await expect(page.getByText('Stand 7')).toHaveCount(0);
      // c12: month → week → month inside 60s: the month comes from the cache.
      await chip(page, 'Săptămâna').click();
      await expect(page).toHaveURL(/perioada=week$/);
      await expect(page.getByTestId('switching-bar')).toHaveCount(0);
      await chip(page, 'Luna').click();
      await expect(page.getByTestId('stat-strip')).toBeVisible();
      expect(asked).toEqual(['month', 'week']);
      // Past 60s the month is stale: going back to it reads it again.
      await page.clock.runFor(61_000);
      await chip(page, 'Săptămâna').click();
      await expect.poll(() => asked.length).toBe(3);
      expect(asked[2]).toBe('week');
      // A failed read is one request: no automatic retry.
      broken = true;
      await page.clock.runFor(61_000);
      await chip(page, 'Anul curent').click();
      await expect(page.getByTestId('stats-error')).toBeVisible();
      await page.clock.runFor(30_000);
      expect(asked.filter((p) => p === 'year')).toHaveLength(1);
    });
  });

  test('public-waters.statistici.c4 c7 c12 public-waters.statistici.s3 s6 — skeleton, then the switch dims the previous period', async ({ page }) => {
    await clientReads(page, async () => {
      const gates: Record<string, () => void> = {};
      await page.route(statsUrl, async (route) => {
        const period = new URL(route.request().url()).searchParams.get('period') ?? 'month';
        await new Promise<void>((r) => (gates[period] = r));
        return fulfill(stats(period))(route);
      });
      await page.setViewportSize(PHONE);
      await page.goto(`/ape-publice/${TIN.id}/statistici`);
      await expect(page.getByTestId('stats-skeleton')).toBeVisible();
      await expect.poll(() => typeof gates.month).toBe('function');
      gates.month();
      await expect(page.getByTestId('stat-strip')).toContainText('7');
      await chip(page, 'Anul curent').click();
      const content = page.getByTestId('stats-content');
      // c7 (the family's switch: AA-safe, parity deviation): the progress bar, inert, text at full strength.
      await expect(page.getByTestId('switching-bar')).toBeVisible();
      await expect(content).toHaveAttribute('inert', '');
      await expect(content).toHaveCSS('opacity', '1');
      await expect.poll(() => typeof gates.year).toBe('function');
      gates.year();
      await expect(page.getByTestId('switching-bar')).toHaveCount(0);
      await expect(content).not.toHaveAttribute('inert');
      // c12: back to a period already fetched within 60s: from the cache, no request.
      let asked = false;
      await page.unroute(statsUrl);
      await page.route(statsUrl, (route) => ((asked = true), fulfill(stats('month'))(route)));
      await chip(page, 'Luna').click();
      await expect(page.getByTestId('stat-strip')).toContainText('7');
      expect(asked).toBe(false);
    });
  });

  test('public-waters.statistici.c7 — from 1280 a keyboard period switch keeps the focus on the chosen radio', async ({ page }) => {
    await clientReads(page, async () => {
      let release: () => void = () => {};
      const week = new Promise<void>((r) => (release = r));
      await page.route(statsUrl, async (route) => {
        const period = new URL(route.request().url()).searchParams.get('period') ?? 'month';
        if (period === 'week') await week;
        return fulfill(stats(period))(route);
      });
      await page.setViewportSize(DESKTOP);
      await page.goto(`/ape-publice/${TIN.id}/statistici`);
      await expect(page.getByTestId('stat-strip')).toBeVisible();
      const column = page.getByRole('complementary', { name: 'Perioada și paginile apei' });
      await column.getByRole('radio', { name: 'Luna' }).focus();
      await page.keyboard.press('ArrowUp');
      // While the period loads only the figures are inert: the left column keeps the focus.
      await expect(page.getByTestId('switching-bar')).toBeVisible();
      await expect(page.getByTestId('stats-content')).toHaveAttribute('inert', '');
      await expect(column.getByRole('radio', { name: 'Săptămâna' })).toBeFocused();
      release();
      await expect(page.getByTestId('switching-bar')).toHaveCount(0);
      await expect(column.getByRole('radio', { name: 'Săptămâna' })).toBeFocused();
      // The water's pages, the current one marked.
      await expect(column.getByRole('link', { name: 'Statistici' })).toHaveAttribute('aria-current', 'page');
      await expect(column.getByRole('link', { name: 'Clasament' })).toHaveAttribute('href', `/ape-publice/${CODE}/clasament?perioada=week`);
    });
  });

  test('public-waters.statistici.c5 public-waters.statistici.s4 — the error, with a working retry', async ({ page }) => {
    watchConsole(page, [/500/, /Failed to load resource/]);
    await clientReads(page, async () => {
      let broken = true;
      await page.route(statsUrl, (route) => (broken ? fail(route) : fulfill(stats('month'))(route)));
      await page.goto(`/ape-publice/${TIN.id}/statistici`);
      const alert = page.getByTestId('stats-error');
      await expect(alert).toContainText('Nu am putut încărca statisticile.');
      await expectNoA11yViolations(page);
      broken = false;
      await alert.getByRole('button', { name: 'Încearcă din nou' }).click();
      await expect(page.getByTestId('stat-strip')).toBeVisible();
      // A failed switch keeps the chips: the period that worked comes back from the cache.
      let asked = 0;
      await page.unroute(statsUrl);
      await page.route(statsUrl, (route) => (asked++, fail(route)));
      await page.setViewportSize(PHONE);
      await chip(page, 'Săptămâna').click();
      await expect(page.getByTestId('stats-error')).toBeVisible();
      await expect(page.getByTestId('period-chips').locator('visible=true')).toHaveCount(1);
      const before = asked;
      await chip(page, 'Luna').click();
      await expect(page.getByTestId('stat-strip')).toContainText('7');
      expect(asked).toBe(before);
    });
  });

  test('public-waters.statistici.c2 — back returns to the page the user came from (in-app history), not the referrer', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto(`/ape-publice/${TIN.id}/statistici?perioada=year`);
    await expect(page.getByTestId('top-anglers')).toBeVisible();
    await page.getByTestId('top-anglers').locator('xpath=ancestor::section[1]').getByRole('link', { name: 'Clasament' }).click();
    await expect(page.getByText('Clasamentul apei', { exact: true })).toBeVisible();
    const length = await page.evaluate(() => history.length);
    await page.getByRole('button', { name: 'Înapoi' }).click();
    await expect(page).toHaveURL(/\/statistici\?perioada=year$/);
    expect(await page.evaluate(() => history.length)).toBe(length);
    // Loaded directly: back goes to the water's page (never out of the site).
    await page.goto(`/ape-publice/${TIN.id}/clasament`);
    await page.getByRole('button', { name: 'Înapoi' }).click();
    await expect(page).toHaveURL(new RegExp(`/ape-publice/${CODE.replace(/[.%]/g, '\\$&')}$`));
  });

  test('public-waters.statistici.c8 c10 — record hero and the activity chart’s scrub', async ({ page }) => {
    await clientReads(page, async () => {
      await page.route(statsUrl, fulfill(stats('week')));
      await page.setViewportSize(DESKTOP);
      await page.goto(`/ape-publice/${TIN.id}/statistici?perioada=week`);
      const hero = page.locator('[data-testid="record-hero"]:visible');
      await expect(hero).toContainText('RECORDUL SĂPTĂMÂNII');
      await expect(hero).toContainText('12,4');
      await expect(hero).toContainText('Somn');
      await expect(hero).toContainText('Pescar · Tineretului · 12 SEP');
      const chart = page.getByRole('img', { name: /Activitate pe perioada aleasă/ });
      await chart.focus();
      await page.keyboard.press('End');
      await expect(page.getByTestId('activity-card')).toContainText('2 capturi ·');
    });
  });
});

/* ============================================================================================
 * public-waters.clasament
 * ========================================================================================== */

test.describe('public-waters.clasament', () => {
  test('public-waters.clasament.c2 c5 c6 public-waters.clasament.s6 — real data (year)', async ({ page, request }) => {
    const errors = watchConsole(page);
    const year = (await (await request.get(`${CMS}/feed/community/stats?period=year&venue=${encodeURIComponent(`water:${TIN.code}`)}`)).json()).data;
    test.skip(year.topAnglers.length < 3, 'needs three ranked anglers this year on Lacul Tineretului in the local CMS');
    await page.setViewportSize(PHONE);
    await page.goto(`/ape-publice/${TIN.id}/clasament?perioada=year`);
    // c2 (the family header, parity note): the water's name, «Clasamentul apei» under it.
    await expect(page.getByRole('heading', { level: 1, name: TIN.name })).toBeVisible();
    await expect(page.getByText('Clasamentul apei', { exact: true })).toBeVisible();
    const podium = page.getByTestId('podium');
    await expect(podium.locator('[data-rank]')).toHaveCount(3);
    expect(await podium.locator('[data-rank]').evaluateAll((els) => els.map((e) => e.getAttribute('data-rank')))).toEqual(['2', '1', '3']);
    if (year.topAnglers.length === 3) await expect(page.getByTestId('podium-only')).toHaveText('Doar 3 pescari au partide în această perioadă.');
    else await expect(page.getByTestId('angler-rows').getByRole('listitem')).toHaveCount(year.topAnglers.length - 3);
    // c6: Pescari / Specii only.
    const seg = page.getByRole('group', { name: 'Arată' });
    await expect(seg.getByRole('radio')).toHaveCount(2);
    await expect(page.getByText('Bălți', { exact: true }).locator('xpath=ancestor::fieldset')).toHaveCount(0);
    await expectNoA11yViolations(page);
    expect(errors).toEqual([]);
  });

  test('public-waters.clasament.c4 c7 c8 public-waters.clasament.s3 s4 s5 — skeleton, rows from 4, species, empty, error', async ({ page }) => {
    watchConsole(page, [/500/, /Failed to load resource/]);
    await clientReads(page, async () => {
      let mode: 'ok' | 'empty' | 'fail' = 'ok';
      let release: () => void = () => {};
      const first = new Promise<void>((r) => (release = r));
      await page.route(statsUrl, async (route) => {
        const period = new URL(route.request().url()).searchParams.get('period') ?? 'month';
        if (period === 'month') await first;
        if (mode === 'fail') return fail(route);
        if (mode === 'empty') return fulfill(stats(period, { partide: 0, top: [], species: [], record: null }))(route);
        return fulfill(stats(period))(route);
      });
      await page.setViewportSize(PHONE);
      await page.goto(`/ape-publice/${TIN.id}/clasament`);
      await expect(page.getByTestId('ranking-skeleton').filter({ visible: true }).first()).toBeVisible();
      release();
      const rows = page.getByTestId('angler-rows').getByRole('listitem');
      await expect(rows).toHaveCount(2);
      await expect(rows.first()).toContainText('4');
      await expect(rows.first()).toContainText('Pescar 4 Popescu');
      await expect(rows.first()).toContainText('6 partide · 16 capturi');
      await expect(rows.first()).toContainText('30,0 kg');
      await page.getByRole('group', { name: 'Arată' }).getByText('Specii').click();
      await expect(page.getByTestId('species-rows').getByRole('listitem').first()).toContainText('20 de capturi');
      await expect(page.getByTestId('species-rows').getByRole('listitem').first()).toContainText('65%');
      mode = 'empty';
      await page.getByTestId('period-chips').getByText('Săptămâna', { exact: true }).click();
      await expect(page.getByTestId('ranking-empty')).toContainText('Niciun clasament pentru perioada selectată încă.');
      await expect(page.getByTestId('ranking-empty').getByRole('button', { name: 'Vezi luna' })).toBeVisible();
      mode = 'fail';
      await page.getByTestId('period-chips').getByText('Anul curent', { exact: true }).click();
      // The error names the page (not Statistici's copy).
      await expect(page.getByTestId('ranking-error')).toContainText('Nu am putut încărca clasamentul.');
      await expect(page.getByTestId('stats-error')).toHaveCount(0);
      await expectNoA11yViolations(page);
    });
  });

  test('public-waters.clasament.c3 — chips from ?perioada= (default month), switching replaces the URL', async ({ page }) => {
    await clientReads(page, async () => {
      const asked: string[] = [];
      await page.route(statsUrl, (route) => {
        const period = new URL(route.request().url()).searchParams.get('period') ?? 'month';
        asked.push(period);
        return fulfill(stats(period))(route);
      });
      for (const [query, label] of [['', 'Luna'], ['?perioada=week', 'Săptămâna'], ['?perioada=year', 'Anul curent'], ['?perioada=zi', 'Luna']] as const) {
        await page.goto(`/ape-publice/${TIN.id}/clasament${query}`);
        await expect(page.getByRole('radio', { name: label }).locator('visible=true')).toBeChecked();
      }
      // Each load read its own period (an unknown one is the month).
      expect(asked.slice(0, 3)).toEqual(['month', 'week', 'year']);
      expect(new Set(asked.slice(3))).toEqual(new Set(asked.length > 3 ? ['month'] : []));
      await page.goto(`/ape-publice/${TIN.id}/clasament`);
      await expect(page.getByTestId('podium')).toBeVisible();
      const length = await page.evaluate(() => history.length);
      await chip(page, 'Anul curent').click();
      await expect(page).toHaveURL(/clasament\?perioada=year$/);
      await chip(page, 'Luna').click();
      await expect(page).toHaveURL(/clasament$/);
      expect(await page.evaluate(() => history.length)).toBe(length);
    });
  });

  test('public-waters.clasament.c6 c7 c8 — Pescari / Specii only; row copy, «Pescar» fallback, singulars; podium only; empty species', async ({ page }) => {
    await clientReads(page, async () => {
      let mode: 'rows' | 'podium' = 'rows';
      const loner = { uid: 'a9', name: null, avatarUrl: null, partide: 1, catches: 1, totalKg: 2.5 };
      await page.route(statsUrl, (route) => {
        const period = new URL(route.request().url()).searchParams.get('period') ?? 'month';
        if (mode === 'podium') return fulfill(stats(period, { top: [angler(1), angler(2), angler(3)], species: [] }))(route);
        return fulfill(stats(period, { top: [angler(1), angler(2), angler(3), angler(4), loner], species: [{ name: 'Crap', count: 21, pct: 95 }, { name: 'Șalău', count: 1, pct: 5 }] }))(route);
      });
      for (const size of [PHONE, DESKTOP]) {
        await page.setViewportSize(size);
        mode = 'rows';
        await page.goto(`/ape-publice/${TIN.id}/clasament`);
        // c6: only «Pescari» and «Specii».
        const seg = page.getByRole('group', { name: 'Arată' });
        await expect(seg.getByRole('radio')).toHaveCount(2);
        await expect(seg.getByRole('radio', { name: 'Pescari' })).toBeChecked();
        await expect(seg.getByRole('radio', { name: 'Specii' })).toHaveCount(1);
        // c7: rows from rank 4.
        const rows = page.getByTestId('angler-rows').getByRole('listitem');
        await expect(rows).toHaveCount(2);
        await expect(rows.nth(0)).toContainText('4');
        await expect(rows.nth(0)).toContainText('6 partide · 16 capturi');
        await expect(rows.nth(0)).toContainText('30,0 kg');
        await expect(rows.nth(1)).toContainText('5');
        await expect(rows.nth(1)).toContainText('Pescar');
        await expect(rows.nth(1)).toContainText('1 partidă · 1 captură');
        await expect(rows.nth(1)).toContainText('2,5 kg');
        // fish initialsOf(null): «?» on the disc, never the fallback name's letters.
        await expect(rows.nth(1).getByTestId('angler-avatar')).toHaveText('?');
        // c8: Specii rows.
        await seg.getByText('Specii').click();
        const species = page.getByTestId('species-rows').getByRole('listitem');
        await expect(species).toHaveCount(2);
        await expect(species.nth(0)).toContainText('Crap');
        await expect(species.nth(0)).toContainText('21 de capturi');
        await expect(species.nth(0)).toContainText('95%');
        await expect(species.nth(1)).toContainText('Șalău');
        await expect(species.nth(1)).toContainText('1 captură');
        await expect(species.nth(1)).toContainText('5%');
        // ≤3 anglers: the podium only; no species: the empty copy.
        mode = 'podium';
        await page.goto(`/ape-publice/${TIN.id}/clasament?perioada=week`);
        await expect(page.getByTestId('podium-only')).toHaveText('Doar 3 pescari au partide în această perioadă.');
        await expect(page.getByTestId('angler-rows')).toHaveCount(0);
        await page.getByRole('group', { name: 'Arată' }).getByText('Specii').click();
        await expect(page.getByTestId('species-empty')).toHaveText('Nicio specie înregistrată în această perioadă.');
      }
      await expectNoA11yViolations(page);
    });
  });

  test('public-waters.clasament.c9 public-waters.clasament.s8 — signed in and ranked: the «EU» pill', async ({ page, context, request }) => {
    const jwt = await qaJwt(request);
    const me = await (await request.get(`${CMS}/users/me`, { headers: { authorization: `Bearer ${jwt}` } })).json();
    await signIn(context, jwt, BASE_URL);
    await clientReads(page, async () => {
      await page.route(statsUrl, fulfill(stats('month', { top: [angler(1), angler(2), angler(3), angler(4), angler(5, me.documentId)], anglers: 9 })));
      await page.setViewportSize(DESKTOP);
      await page.goto(`/ape-publice/${TIN.id}/clasament`);
      const pill = page.locator('[data-testid="me-pill"]:visible');
      await expect(pill).toContainText('Ești pe locul 5 din 9 pescari luna asta — 25,0 kg');
      // From 1280 in the right column.
      await expect(page.getByRole('complementary', { name: 'Poziția ta și perioada' }).getByTestId('me-pill')).toBeVisible();
      // Below 1280 after the rows (the fish order), at the list's full width.
      await page.setViewportSize(PHONE);
      await expect(pill).toHaveCount(1);
      const [rowsBox, pillBox] = await Promise.all([page.getByTestId('angler-rows').boundingBox(), pill.boundingBox()]);
      expect(pillBox!.y).toBeGreaterThan(rowsBox!.y + rowsBox!.height);
      expect(Math.round(pillBox!.width)).toBe(Math.round(rowsBox!.width));
      // Its late arrival (the viewer resolves in the browser) never moves the list: no layout shift.
      await page.goto('about:blank');
      await page.addInitScript(() => {
        (window as unknown as { __cls: number }).__cls = 0;
        new PerformanceObserver((list) => {
          for (const e of list.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) {
            if (!e.hadRecentInput) (window as unknown as { __cls: number }).__cls += e.value;
          }
        }).observe({ type: 'layout-shift', buffered: true });
      });
      await page.goto(`/ape-publice/${TIN.id}/clasament`);
      await expect(pill).toHaveCount(1);
      await page.waitForTimeout(500);
      expect(await page.evaluate(() => (window as unknown as { __cls: number }).__cls)).toBeLessThan(0.01);
      // Not on Specii.
      await page.getByRole('group', { name: 'Arată' }).getByText('Specii').click();
      await expect(page.getByTestId('me-pill')).toHaveCount(0);
      // Signed in but not ranked: no pill.
      await page.unroute(statsUrl);
      await page.route(statsUrl, fulfill(stats('week')));
      await chip(page, 'Săptămâna').click();
      await page.getByRole('group', { name: 'Arată' }).getByText('Pescari').click();
      await expect(page.getByTestId('angler-rows')).toBeVisible();
      await expect(page.getByTestId('me-pill')).toHaveCount(0);
    });
  });

  test('public-waters.clasament.c9 public-waters.clasament.s8 — signed out: no «EU» pill', async ({ page }) => {
    await clientReads(page, async () => {
      await page.route(statsUrl, fulfill(stats('month')));
      await page.goto(`/ape-publice/${TIN.id}/clasament`);
      await expect(page.getByTestId('angler-rows')).toBeVisible();
      await expect(page.getByTestId('me-pill')).toHaveCount(0);
    });
  });

  test('public-waters.clasament.c10 public-waters.clasament.s7 — the period switch (bar, inert, busy) and the refresh refetches', async ({ page }) => {
    await clientReads(page, async () => {
      const asked: string[] = [];
      let release: () => void = () => {};
      const year = new Promise<void>((r) => (release = r));
      await page.route(statsUrl, async (route) => {
        const period = new URL(route.request().url()).searchParams.get('period') ?? 'month';
        asked.push(period);
        if (period === 'year') await year;
        return fulfill(stats(period))(route);
      });
      await page.setViewportSize(PHONE);
      await page.goto(`/ape-publice/${TIN.id}/clasament`);
      const content = page.getByTestId('ranking-content');
      await expect(page.getByTestId('podium')).toBeVisible();
      await chip(page, 'Anul curent').click();
      await expect(content.getByTestId('switching-bar')).toBeVisible();
      await expect(content).toHaveAttribute('inert', '');
      await expect(content).toHaveAttribute('aria-busy', 'true');
      await expect(content).toHaveCSS('opacity', '1');
      release();
      await expect(page.getByTestId('switching-bar')).toHaveCount(0);
      await expect(content).not.toHaveAttribute('inert');
      const before = asked.length;
      await page.getByRole('button', { name: 'Reîmprospătează' }).click();
      await expect.poll(() => asked.length).toBeGreaterThan(before);
      expect(asked.at(-1)).toBe('year');
    });
  });

  test('public-waters.clasament.c5 public-waters.statistici.c8 — a dead avatar shows initials on the podium and in Top pescari', async ({ page }) => {
    await clientReads(page, async () => {
      const dead = `${BASE_URL}/__e2e-missing-avatar.jpg`;
      const top = [angler(1), { ...angler(2), name: 'Mario Tt', avatarUrl: dead }, angler(3)];
      await page.route(statsUrl, fulfill(stats('month', { top })));
      for (const sub of ['clasament', 'statistici']) {
        await page.goto(`/ape-publice/${TIN.id}/${sub}`);
        await expect(page.locator('[data-testid="angler-avatar"]:visible').filter({ hasText: 'MT' }).first()).toBeVisible();
        await expectNoBrokenImages(page);
      }
    });
  });
});

/* ============================================================================================
 * public-waters.capturi
 * ========================================================================================== */

test.describe('public-waters.capturi', () => {
  test('public-waters.capturi.c2 c3 public-waters.capturi.s4 — real data: header and the empty gallery', async ({ page }) => {
    const errors = watchConsole(page);
    await page.setViewportSize(PHONE);
    await page.goto(`/ape-publice/${TIN.id}/capturi`);
    await expect(page.getByRole('heading', { level: 1, name: 'Capturi' })).toBeVisible();
    // c2: fish always counts, «· 0 capturi» included, once the server answered.
    await expect(page.getByTestId('gallery-subtitle')).toHaveText(`${TIN.name} · 0 capturi`);
    const empty = page.getByTestId('catches-empty');
    await expect(empty).toContainText('Nicio captură cu fotografie încă.');
    await expect(empty.getByRole('link', { name: 'Vezi partidele de pe apă' })).toHaveAttribute('href', `/ape-publice/${CODE}/partide`);
    await expect(page.getByRole('button', { name: 'Închide capturile' })).toBeVisible();
    await expectNoA11yViolations(page);
    expect(errors).toEqual([]);
  });

  test('public-waters.capturi.c3 c4 c5 public-waters.capturi.s3 s5 — skeleton, masonry with captions, pages of 20, lightbox', async ({ page }) => {
    await clientReads(page, async () => {
      let release: () => void = () => {};
      const gate = new Promise<void>((r) => (release = r));
      const pages: number[] = [];
      await page.route(catchesUrl, async (route) => {
        const p = Number(new URL(route.request().url()).searchParams.get('page') ?? '1');
        pages.push(p);
        if (p === 1) await gate;
        return fulfill(catchesPage(p, 25))(route);
      });
      await page.setViewportSize(DESKTOP);
      await page.addInitScript(() => {
        (window as unknown as { __cls: number }).__cls = 0;
        new PerformanceObserver((list) => {
          for (const e of list.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) if (!e.hadRecentInput) (window as unknown as { __cls: number }).__cls += e.value;
        }).observe({ type: 'layout-shift', buffered: true });
      });
      await page.goto(`/ape-publice/${TIN.id}/capturi`);
      const skeleton = page.getByTestId('masonry-skeleton').first();
      await expect(skeleton).toBeVisible();
      // The skeleton has the real grid's columns (auto-fill 220px tracks: 6 at 1440).
      const skeletonCols = await skeleton.evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
      release();
      await expect(page.getByTestId('gallery-subtitle')).toHaveText(`${TIN.name} · 25 capturi`);
      const tiles = page.getByTestId('catch-grid').getByRole('button');
      await expect(tiles.first()).toHaveAccessibleName('Deschide fotografia: Crap · 2,0 kg');
      // The masonry: the same column count as the skeleton, every gap 8px down and across.
      const boxes = await page.getByTestId('catch-grid').locator('li').evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => ({ x: Math.round(r.x), y: r.y, b: r.bottom })));
      const xs = [...new Set(boxes.map((b) => b.x))].sort((a, b) => a - b);
      expect(xs.length).toBe(skeletonCols);
      for (const x of xs) {
        const col = boxes.filter((b) => b.x === x).sort((a, b) => a.y - b.y);
        for (let i = 1; i < col.length; i++) expect(Math.abs(col[i].y - col[i - 1].b - 8)).toBeLessThan(1);
      }
      expect(await page.evaluate(() => (window as unknown as { __cls: number }).__cls)).toBeLessThan(0.05);
      // Pages of 20: the second page arrives near the end (the footer is in reach on a desktop).
      await page.mouse.wheel(0, 6000);
      await expect(tiles).toHaveCount(25);
      expect(pages).toEqual([1, 2]);
      await tiles.nth(1).click();
      const box = page.getByRole('dialog');
      await expect(box).toContainText('Captura 2 din 25');
      await expect(box).toContainText('2,1');
      await expect(box).toContainText('Pescar 1');
      // axe reads colours mid fade-in (the dialog's opacity blends them): let the finite animations land.
      await page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished.catch(() => {}))));
      await expectNoA11yViolations(page);
      await page.keyboard.press('Escape');
      await expect(box).toBeHidden();
    });
  });

  test('public-waters.capturi.c6 c7 public-waters.capturi.s6 — ?foto= opens that catch once; an unknown one is ignored', async ({ page }) => {
    await clientReads(page, async () => {
      await page.route(catchesUrl, (route) => fulfill(catchesPage(Number(new URL(route.request().url()).searchParams.get('page') ?? '1'), 25))(route));
      await page.goto(`/ape-publice/${TIN.id}/capturi?foto=c3`);
      const box = page.getByRole('dialog');
      await expect(box).toContainText('Captura 4 din 25');
      // fish VenueCatchesGalleryScreen's ImageLightbox is not `shareable`: no «Distribuie» here.
      await expect(box.getByRole('button', { name: 'Distribuie captura' })).toHaveCount(0);
      await page.keyboard.press('Escape');
      await expect(box).toBeHidden();
      // c6: a catch the first page does not have opens nothing, even once later pages arrive.
      await page.goto(`/ape-publice/${TIN.id}/capturi?foto=c22`);
      await expect(page.getByTestId('catch-grid')).toBeVisible();
      await page.mouse.wheel(0, 6000);
      await expect(page.getByTestId('catch-grid').getByRole('button')).toHaveCount(25);
      await expect(box).toBeHidden();
    });
  });

  test('public-waters.capturi.c7 c6 c2 c5 public-waters.capturi.s6 — from the Partide rail: a cache hit, the lightbox on that catch, ✕ goes back', async ({ page }) => {
    const errors = watchConsole(page);
    await clientReads(page, async () => {
      let catchReads = 0;
      const data = [aCatch(1, 'other'), aCatch(2, 'x'), aCatch(3, 'y')];
      await page.route(venueUrl, fulfill(emptySection));
      await page.route(historyUrl, fulfill(historyPage(1)));
      await page.route(catchesUrl, (route) => {
        catchReads++;
        return fulfill({ data, meta: { pagination: { page: 1, pageSize: 20, pageCount: 1, total: 3 } } })(route);
      });
      // The rail links by linkCode: that route param skips its server prefetch too (set before the
      // rail's links are router-prefetched), so the only catches read is the rail's — a server
      // prefetch would hydrate the same query with fresher data.
      await setFaults(page, CODE, ['noprefetch']); // the page sees the param still encoded
      await page.setViewportSize(PHONE);
      await page.goto(`/ape-publice/${TIN.id}/partide`);
      const rail = page.locator('[data-testid="catches-rail"]:visible');
      await rail.getByRole('link').nth(1).click();
      await expect(page).toHaveURL(/\/capturi\?foto=c2$/);
      // c6 after a client navigation: the lightbox opens on the tapped catch.
      const box = page.getByRole('dialog');
      await expect(box).toContainText('Captura 2 din 3');
      // c5: the footer carries the angler's face beside the name (fish members={[c.angler]}).
      await expect(box.getByTestId('lightbox-angler')).toContainText('Pescar 2');
      await expect(box.getByTestId('lightbox-angler').getByTestId('angler-avatar')).toBeVisible();
      // c7: the rail's query — arriving here renders from its cache, no second read.
      expect(catchReads).toBe(1);
      await page.keyboard.press('Escape');
      await expect(box).toBeHidden();
      await expect(page.getByTestId('gallery-subtitle')).toHaveText(`${TIN.name} · 3 capturi`);
      // c2: the ✕ goes back to where the user came from.
      await page.getByRole('button', { name: 'Închide capturile' }).click();
      await expect(page).toHaveURL(new RegExp(`/ape-publice/${TIN.id}/partide$`));
    }).finally(() => setFaults(page, CODE, []));
    expect(errors).toEqual([]);
  });

  test('public-waters.capturi.c4 c2 — tiles take grid → thumb → full; a shared link’s ✕ lands on the water', async ({ page }) => {
    await clientReads(page, async () => {
      const svg = (fill: string) => `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="4" height="3"><rect width="4" height="3" fill="${fill}"/></svg>`;
      const [GRID, THUMB, FULL] = [svg('red'), svg('green'), svg('blue')];
      const data = [
        { ...aCatch(1), photoGridUrl: GRID, photoThumbUrl: THUMB, photoUrl: FULL },
        { ...aCatch(2), photoGridUrl: null, photoThumbUrl: THUMB, photoUrl: FULL },
        { ...aCatch(3), photoGridUrl: '', photoThumbUrl: null, photoUrl: FULL, species: null, weightKg: null },
      ];
      await page.route(catchesUrl, fulfill({ data, meta: { pagination: { page: 1, pageSize: 20, pageCount: 1, total: 3 } } }));
      await page.setViewportSize(PHONE);
      await page.goto(`/ape-publice/${TIN.id}/capturi`);
      const tiles = page.getByTestId('catch-grid').getByRole('button');
      await expect(tiles).toHaveCount(3);
      await expect(tiles.nth(0).locator('img')).toHaveAttribute('src', GRID);
      await expect(tiles.nth(1).locator('img')).toHaveAttribute('src', THUMB);
      await expect(tiles.nth(2).locator('img')).toHaveAttribute('src', FULL);
      // c4: no caption when neither species nor kg exists.
      await expect(tiles.nth(2)).toHaveAccessibleName('Deschide fotografia');
      // c2: opened from a shared link (no in-site history) the ✕ goes to the water's page.
      await page.getByRole('button', { name: 'Închide capturile' }).click();
      await expect(page).toHaveURL(new RegExp(`/ape-publice/${CODE}$`));
    });
  });

  test('public-waters.capturi.c3 public-waters.capturi.s7 — the gallery read failed: an error with a retry', async ({ page }) => {
    watchConsole(page, [/500/, /Failed to load resource/]);
    await clientReads(page, async () => {
      let broken = true;
      await page.route(catchesUrl, (route) => (broken ? fail(route) : fulfill(catchesPage(1, 3))(route)));
      await page.goto(`/ape-publice/${TIN.id}/capturi`);
      await expect(page.getByTestId('catches-error')).toContainText('Nu am putut încărca capturile.');
      broken = false;
      await page.getByRole('button', { name: 'Încearcă din nou' }).click();
      await expect(page.getByTestId('catch-grid').getByRole('button')).toHaveCount(3);
    });
  });
});

/* ============================================================================================
 * Review 2026-10-07: the family's way out of an empty period, the sibling tabs below 1280, the
 * unweighed ranking, the medal ranks, the period the labels name during a switch.
 * ========================================================================================== */

test.describe('public-waters subpages — the period, the siblings, the unweighed ranking', () => {
  test('public-waters.statistici.c6 public-waters.clasament.c4 — an empty period offers the wider one; the aside never repeats it', async ({ page }) => {
    await clientReads(page, async () => {
      await page.route(statsUrl, (route) => {
        const period = new URL(route.request().url()).searchParams.get('period') ?? 'month';
        const empty = { partide: 0, anglers: 0, top: [], species: [], record: null, series: [] };
        return fulfill(stats(period, period === 'year' ? {} : empty))(route);
      });
      for (const size of [PHONE, DESKTOP]) {
        await page.setViewportSize(size);
        // Statistici: Luna (default) empty → «Vezi anul curent» opens the year.
        await page.goto(`/ape-publice/${TIN.id}/statistici`);
        const empty = page.getByTestId('stats-empty');
        await expect(empty).toContainText('Nicio partidă în perioada selectată.');
        // One statement of the fact: no «Nicio partidă în această perioadă.» in the right column.
        await expect(page.getByText('Nicio partidă în această perioadă.')).toHaveCount(0);
        await empty.getByRole('button', { name: 'Vezi anul curent' }).click();
        await expect(page).toHaveURL(/statistici\?perioada=year$/);
        await expect(page.getByTestId('stat-strip').locator('visible=true').first()).toBeVisible();
        // Săptămâna empty → «Vezi luna»; the year has nothing wider.
        await page.goto(`/ape-publice/${TIN.id}/statistici?perioada=week`);
        await expect(page.getByTestId('stats-empty').getByRole('button', { name: 'Vezi luna' })).toBeVisible();
        // Clasament: the same way out.
        await page.goto(`/ape-publice/${TIN.id}/clasament`);
        const rEmpty = page.getByTestId('ranking-empty');
        await expect(rEmpty).toContainText('Niciun clasament pentru perioada selectată încă.');
        await expect(page.getByText('Nicio partidă în această perioadă.')).toHaveCount(0);
        await rEmpty.getByRole('button', { name: 'Vezi anul curent' }).click();
        await expect(page).toHaveURL(/clasament\?perioada=year$/);
        await expect(page.getByTestId('podium')).toBeVisible();
      }
      await expectNoA11yViolations(page);
    });
  });

  test('public-waters.partide.c2 public-waters.statistici.c2 public-waters.clasament.c2 — below 1280 the water’s pages are tabs under the header', async ({ page }) => {
    await clientReads(page, async () => {
      await page.route(venueUrl, fulfill(emptySection));
      await page.route(catchesUrl, fulfill(catchesPage(1, 0)));
      await page.route(historyUrl, fulfill(historyPage(2)));
      // An empty period: the tabs are the only way to a sibling besides back.
      await page.route(statsUrl, (route) => fulfill(stats(new URL(route.request().url()).searchParams.get('period') ?? 'month', { partide: 0, top: [], species: [], record: null, series: [] }))(route));
      const subs = [
        ['partide', 'Partide'],
        ['statistici', 'Statistici'],
        ['clasament', 'Clasament'],
      ] as const;
      for (const [sub, label] of subs) {
        await page.setViewportSize(PHONE);
        await page.goto(`/ape-publice/${TIN.id}/${sub}`);
        const tabs = page.getByTestId('water-tabs').getByRole('navigation', { name: 'Pe această apă' });
        await expect(tabs).toBeVisible();
        await expect(tabs.getByRole('link')).toHaveText(['Partide', 'Statistici', 'Clasament', 'Capturi']);
        await expect(tabs.getByRole('link', { name: label })).toHaveAttribute('aria-current', 'page');
        // Under the header, above the content.
        const [h1, nav] = await Promise.all([page.getByRole('heading', { level: 1 }).boundingBox(), tabs.boundingBox()]);
        expect(nav!.y).toBeGreaterThan(h1!.y);
        // From 1280 the left column's list takes over: the row is gone.
        await page.setViewportSize(DESKTOP);
        await expect(page.getByTestId('water-tabs')).toBeHidden();
        await expect(page.getByTestId('water-pages')).toBeVisible();
      }
      // The tabs move between siblings.
      await page.setViewportSize(PHONE);
      await page.getByTestId('water-tabs').getByRole('link', { name: 'Partide' }).click();
      await expect(page).toHaveURL(new RegExp(`/ape-publice/${CODE.replace(/[.%]/g, '\\$&')}/partide$`));
      await expectNoA11yViolations(page);
    });
  });

  test('public-waters.clasament.c5 c7 c8 public-waters.statistici.c8 — nothing weighed: catches explain the order; species ranks in medal colours', async ({ page }) => {
    await clientReads(page, async () => {
      // The CMS order when nothing is weighed (kg ties → uid): a1 2 capturi, a2 7, a3 5, a4 7 with more partide.
      const NAMES = ['Ana Pop', 'Bogdan Ion', 'Cristi Mihai', 'Dan Radu'];
      const un = (i: number, catches: number, partide: number) => ({ ...angler(i), name: NAMES[i - 1], totalKg: 0, catches, partide });
      const top = [un(1, 2, 1), un(2, 7, 1), un(3, 5, 2), un(4, 7, 3)];
      await page.route(statsUrl, fulfill(stats('month', { top })));
      await page.setViewportSize(PHONE);
      await page.goto(`/ape-publice/${TIN.id}/clasament`);
      const podium = page.getByTestId('podium');
      // Ordered by catches, then partide: 1st Dan (7, 3 partide), 2nd Bogdan (7, 1), 3rd Cristi (5).
      await expect(podium.locator('[data-rank="1"]')).toContainText('Dan');
      await expect(podium.locator('[data-rank="2"]')).toContainText('Bogdan');
      await expect(podium.locator('[data-rank="3"]')).toContainText('Cristi');
      await expect(podium.locator('[data-rank="1"] [data-testid="podium-score"]')).toHaveText('7 capturi');
      await expect(podium.locator('[data-rank="2"] [data-testid="podium-score"]')).toHaveText('7 capturi');
      await expect(podium.locator('[data-rank="3"] [data-testid="podium-score"]')).toHaveText('5 capturi');
      await expect(podium.getByText('— kg')).toHaveCount(0);
      const rows = page.getByTestId('angler-rows').getByRole('listitem');
      await expect(rows).toHaveCount(1);
      await expect(rows.first()).toContainText('Ana Pop');
      await expect(rows.first()).toContainText('2 capturi');
      await expect(rows.first()).not.toContainText('— kg');
      // c8: the top three species ranks in gold, silver, bronze (fish RankBadge rankColor), the 4th muted.
      await page.unroute(statsUrl);
      const species = ['Crap', 'Caras', 'Somn', 'Știucă'].map((name, i) => ({ name, count: 10 - i, pct: 40 - i * 10 }));
      await page.route(statsUrl, fulfill(stats('week', { top, species })));
      await page.goto(`/ape-publice/${TIN.id}/clasament?perioada=week`);
      await page.getByRole('group', { name: 'Arată' }).getByText('Specii').click();
      const ranks = page.getByTestId('species-rows').getByTestId('rank');
      await expect(ranks).toHaveCount(4);
      const bg = await ranks.evaluateAll((els) => els.map((e) => getComputedStyle(e).backgroundColor));
      const medalVars = await page.evaluate(() => {
        const probe = document.createElement('span');
        document.body.append(probe);
        const out = ['gold', 'silver', 'bronze'].map((m) => {
          probe.style.backgroundColor = `var(--color-medal-${m})`;
          return getComputedStyle(probe).backgroundColor;
        });
        probe.remove();
        return out;
      });
      expect(bg.slice(0, 3)).toEqual(medalVars);
      expect(new Set(medalVars).size).toBe(3);
      expect(bg[3]).toBe('rgba(0, 0, 0, 0)');
      // Statistici's Top pescari: the same order and figure.
      await page.goto(`/ape-publice/${TIN.id}/statistici?perioada=week`);
      const topRows = page.getByTestId('top-anglers').getByRole('listitem');
      await expect(topRows.nth(0)).toContainText('Dan Radu');
      await expect(topRows.nth(0)).toContainText('7 capturi');
      await expect(topRows.nth(2)).toContainText('Cristi Mihai');
      await expect(page.getByTestId('top-anglers').getByText('— kg')).toHaveCount(0);
      await expectNoA11yViolations(page);
    });
  });

  test('public-waters.clasament.c9 — the «EU» pill: noun and plural on the total, no kg clause when nothing weighed', async ({ page, context, request }) => {
    const jwt = await qaJwt(request);
    const me = await (await request.get(`${CMS}/users/me`, { headers: { authorization: `Bearer ${jwt}` } })).json();
    await signIn(context, jwt, BASE_URL);
    await clientReads(page, async () => {
      const mine = { ...angler(4, me.documentId), totalKg: 0, catches: 1, partide: 1 };
      await page.route(statsUrl, fulfill(stats('month', { top: [angler(1), angler(2), angler(3), mine], anglers: 24 })));
      await page.setViewportSize(DESKTOP);
      await page.goto(`/ape-publice/${TIN.id}/clasament`);
      const pill = page.locator('[data-testid="me-pill"]:visible');
      await expect(pill).toContainText('Ești pe locul 4 din 24 de pescari luna asta');
      await expect(pill).not.toContainText('kg');
    });
  });

  test('public-waters.clasament.c10 public-waters.statistici.c7 — while a period loads, every label still names the period on screen', async ({ page, context, request }) => {
    const jwt = await qaJwt(request);
    const me = await (await request.get(`${CMS}/users/me`, { headers: { authorization: `Bearer ${jwt}` } })).json();
    await signIn(context, jwt, BASE_URL);
    await clientReads(page, async () => {
      let release: () => void = () => {};
      const year = new Promise<void>((r) => (release = r));
      await page.route(statsUrl, async (route) => {
        const period = new URL(route.request().url()).searchParams.get('period') ?? 'month';
        if (period === 'year') await year;
        return fulfill(stats(period, { top: [angler(1), angler(2), angler(3), angler(4, me.documentId)], anglers: 9 }))(route);
      });
      await page.setViewportSize(DESKTOP);
      // Clasament: the pill and the right column's heading.
      await page.goto(`/ape-publice/${TIN.id}/clasament`);
      const aside = page.getByTestId('ranking-aside');
      const pill = page.locator('[data-testid="me-pill"]:visible');
      await expect(pill).toContainText('Ești pe locul 4 din 9 pescari luna asta — 30,0 kg');
      await expect(aside.getByText('Luna aceasta')).toBeVisible();
      await chip(page, 'Anul curent').click();
      await expect(page.getByTestId('switching-bar').first()).toBeVisible();
      // The month's figures are still on screen: so is the month's name — and the column is busy too.
      await expect(pill).toContainText('Ești pe locul 4 din 9 pescari luna asta — 30,0 kg');
      await expect(aside.getByText('Luna aceasta')).toBeVisible();
      await expect(aside.getByText('Anul curent')).toHaveCount(0);
      await expect(aside).toHaveAttribute('aria-busy', 'true');
      await expect(aside).toHaveAttribute('inert', '');
      await expect(aside.getByTestId('switching-bar')).toBeVisible();
      release();
      await expect(page.getByTestId('switching-bar')).toHaveCount(0);
      await expect(pill).toContainText('Ești pe locul 4 din 9 pescari anul ăsta — 30,0 kg');
      await expect(aside.getByText('Anul curent')).toBeVisible();
      await expect(aside).not.toHaveAttribute('aria-busy');
    });
    await clientReads(page, async () => {
      let release: () => void = () => {};
      const week = new Promise<void>((r) => (release = r));
      await page.unroute(statsUrl);
      await page.route(statsUrl, async (route) => {
        const period = new URL(route.request().url()).searchParams.get('period') ?? 'month';
        if (period === 'week') await week;
        return fulfill(stats(period))(route);
      });
      // Statistici: the record's tag.
      await page.goto(`/ape-publice/${TIN.id}/statistici`);
      const hero = page.locator('[data-testid="record-hero"]:visible');
      await expect(hero).toContainText('RECORDUL LUNII');
      await chip(page, 'Săptămâna').click();
      await expect(page.getByTestId('switching-bar').first()).toBeVisible();
      await expect(hero).toContainText('RECORDUL LUNII');
      await expect(hero).not.toContainText('SĂPTĂMÂNII');
      release();
      await expect(page.getByTestId('switching-bar')).toHaveCount(0);
      await expect(hero).toContainText('RECORDUL SĂPTĂMÂNII');
    });
  });
});

/* ============================================================================================
 * Review 2026-10-07 (b): history cards, the left column's title, unweighed rankings
 * ========================================================================================== */

test.describe('public-waters subpages — review 2026-10-07 (b)', () => {
  test('public-waters.partide.c10 — card strip: kg only when weighed, the longest duration on one line, «+N» photos, the year on old cards, «de» in the progress', async ({ page }) => {
    await clientReads(page, async () => {
      // 123 h 59 min, nothing weighed, 7 photos of which the CMS sends 3 (PHOTO_STRIP_CAP).
      const long = {
        ...historyRow(1),
        startedAt: '2026-09-15T05:00:00.000Z',
        endedAt: '2026-09-20T08:59:00.000Z',
        catchCount: 0,
        maxKg: 0,
        totalKg: 0,
        photos: [1, 2, 3].map(() => ({ url: PIXEL, thumbUrl: PIXEL, weightKg: null })),
        photoCount: 7,
      };
      // The worst strip: weighed (three cells) and the longest duration.
      const weighed = { ...historyRow(2), startedAt: '2026-09-15T05:00:00.000Z', endedAt: '2026-09-20T08:59:00.000Z' };
      // Last year's partidă (Romania: 9 AUG 2025 09:07 – 13:20).
      const old = { ...historyRow(3), startedAt: '2025-08-09T06:07:00.000Z', endedAt: '2025-08-09T10:20:00.000Z', totalKg: 0, photos: [], photoCount: 0 };
      await page.route(venueUrl, fulfill(emptySection));
      await page.route(catchesUrl, fulfill(catchesPage(1, 0)));
      await page.route(historyUrl, fulfill({ data: [long, weighed, old], meta: { pagination: { page: 1, pageSize: 10, pageCount: 3, total: 23 } } }));
      for (const width of [375, 1280, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(`/ape-publice/${TIN.id}/partide`);
        const cards = page.getByTestId('history-card');
        await expect(cards).toHaveCount(3);
        // Unweighed: two cells (capturi · durată), no «—» placeholder.
        const strip = cards.nth(0).getByTestId('history-stats');
        await expect(strip.locator('dd')).toHaveCount(2);
        await expect(strip).not.toContainText('kg total');
        await expect(strip).not.toContainText('—');
        // The longest duration fits one line: its value is as tall as the catches' value.
        const dd = strip.locator('dd');
        await expect(dd.nth(1)).toHaveText('123 h 59 min');
        const [h0, h1] = await dd.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
        expect(h1).toBe(h0);
        // Weighed: three cells, the kg in the middle.
        const wstrip = cards.nth(1).getByTestId('history-stats');
        await expect(wstrip.locator('dd')).toHaveCount(3);
        await expect(wstrip).toContainText('9,5');
        await expect(wstrip).toContainText('kg total');
        const [w0, w1, w2] = await wstrip.locator('dd').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
        expect([w1, w2]).toEqual([w0, w0]);
        // fish PhotoStrip: 3 tiles in thirds, «+4» over the last one.
        const photos = cards.nth(0).getByTestId('history-photos');
        await expect(photos.getByRole('listitem')).toHaveCount(3);
        await expect(photos.getByRole('listitem').nth(2).getByTestId('history-photos-more')).toHaveText('+4');
        await expect(photos).toHaveAccessibleName('7 fotografii');
        await expect(cards.nth(1).getByTestId('history-photos-more')).toHaveCount(0);
        // Another year's partidă carries it; this year's keeps fish's form.
        await expect(cards.nth(2)).toContainText('9 AUG 2025 · 09:07 – 13:20');
        await expect(cards.nth(1)).toContainText('15 SEP 08:00 – 20 SEP 11:59');
        await expect(wstrip.locator('dd').nth(2)).toHaveText('123 h 59 min');
        // «de» from 20.
        await expect(page.getByText('3 din 23 de partide', { exact: true })).toBeVisible();
      }
      // From 1280 the column holds only the water's pages: titled «Pe această apă», said once.
      const column = page.getByRole('complementary', { name: 'Paginile apei' });
      await expect(column.getByRole('heading', { level: 2 })).toHaveText('Pe această apă');
      await expect(column.getByText('Pe această apă', { exact: true })).toHaveCount(1);
      await expect(column.getByRole('link', { name: 'Partide' })).toHaveAttribute('aria-current', 'page');
      await expectNoA11yViolations(page);
    });
  });

  test('public-waters.clasament.c5 c7 public-waters.statistici.c8 — nothing weighed: the catches said once per row; a catchless podium place shows its partide; columns titled «Opțiuni»', async ({ page }) => {
    await clientReads(page, async () => {
      const un = (i: number, catches: number, partide: number) => ({ ...angler(i), name: `Pescar ${i} Ionescu`, totalKg: 0, catches, partide });
      const top = [un(1, 4, 8), un(2, 0, 3), un(3, 0, 2), un(4, 0, 1)];
      await page.route(statsUrl, fulfill(stats('month', { top })));
      await page.setViewportSize(DESKTOP);
      await page.goto(`/ape-publice/${TIN.id}/clasament`);
      const podium = page.getByTestId('podium');
      await expect(podium.locator('[data-rank="1"] [data-testid="podium-score"]')).toHaveText('4 capturi');
      await expect(podium.locator('[data-rank="2"] [data-testid="podium-score"]')).toHaveText('3 partide');
      await expect(podium.locator('[data-rank="3"] [data-testid="podium-score"]')).toHaveText('2 partide');
      await expect(podium).not.toContainText('0 capturi');
      const row = page.getByTestId('angler-rows').getByRole('listitem').first();
      await expect(row).toContainText('1 partidă');
      await expect(row).not.toContainText('·');
      await expect(row).toContainText('0 capturi');
      await expect(page.getByRole('complementary', { name: 'Opțiuni clasament' }).getByRole('heading', { level: 2 }).first()).toHaveText('Opțiuni');
      await page.goto(`/ape-publice/${TIN.id}/statistici`);
      const first = page.getByTestId('top-anglers').getByRole('listitem').first();
      await expect(first).toContainText('8 partide');
      expect(((await first.innerText()).match(/4 capturi/g) ?? []).length).toBe(1);
      await expect(page.getByRole('complementary', { name: 'Perioada și paginile apei' }).getByRole('heading', { level: 2 }).first()).toHaveText('Opțiuni');
      await expectNoA11yViolations(page);
    });
  });
});
