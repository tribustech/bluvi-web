import { collectConsoleErrors } from './helpers/console';
import { BASE_URL } from './helpers/base-url';
import { expect, test, type Page, type Route } from '@playwright/test';
import { expectNoA11yViolations } from './helpers/a11y';
import { CMS, qaJwt, signIn } from './helpers/session';

/*
 * Ape publice (parity docs/parity/areas/public-waters.yml): public-waters.detaliu (/ape-publice/<id>),
 * public-waters.harta (/ape-publice/<id>/harta) and public-waters.harta-ape (/ape-publice).
 * Each test names the criterion / state ids it covers.
 *
 * The waters come from the bundled ANAR dataset (ids and linkCodes are fish's, stable for DB
 * version 4). The community reads (Partide, Capturi) are public CMS GETs the browser makes, so the
 * states the local CMS has no data for (live partide, photo catches, failures, pagination) are
 * served from fixtures with page.route; everything else is the real local data.
 */


const WATER = {
  /** Lacul Tineretului (București): partide activity + species, no photo catches on the local CMS. */
  tineretului: { id: 328, code: 'L:RO10_01.025_L3', name: 'Tineretului' },
  /** Snagov reservoir: every fact present (basin, area, volume, altitude). */
  snagov: { id: 2245, code: 'R:RO11_01.018_R1', name: 'Snagov' },
  /** Dunărea: a river through 12 counties. */
  dunarea: { id: 3506, code: 'RV:RO14-1-0-0-0-0-0', name: 'Dunarea' },
};

/** A real local lake (Chita), the target of the claimed-water redirect (c4). */
const CHITA = process.env.E2E_LAKE_CHITA ?? 's84u55lo4n9z0emngozttt6e';

const PHONE = { width: 375, height: 812 };
const DESKTOP = { width: 1440, height: 900 };

const venueUrl = (code: string) => `**/feed/community/waters/${encodeURIComponent(code)}`;
const catchesUrl = (code: string) => `**/feed/community/waters/${encodeURIComponent(code)}/catches*`;

const section = (o: Partial<{ activeNow: number; catchesThisMonth: number; recordKg: number | null }> = {}, extra: Record<string, unknown> = {}) => ({
  data: {
    stats: { activeNow: 0, catchesThisMonth: 0, recordKg: null, ...o },
    activeSessions: [],
    monthlyActivity: [
      { month: 'MAI', count: 1 },
      { month: 'IUN', count: 3 },
      { month: 'IUL', count: 2 },
    ],
    speciesCounts: [
      { species: 'Crap', count: 9 },
      { species: 'Caras', count: 7 },
      { species: 'Șalău', count: 5 },
      { species: 'Știucă', count: 4 },
      { species: 'Biban', count: 3 },
      { species: 'Plătică', count: 2 },
      { species: 'Somn', count: 1 },
    ],
    ...extra,
  },
});

const PIXEL = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="4" height="3"><rect width="4" height="3" fill="gray"/></svg>';
const aCatch = (i: number) => ({
  clientId: `c${i}`,
  sessionDocumentId: `s${i}`,
  species: 'Crap',
  weightKg: 2 + i / 10,
  photoUrl: PIXEL,
  photoGridUrl: PIXEL,
  photoThumbUrl: PIXEL,
  photoWidth: 400,
  photoHeight: 300,
  occurredAt: '2026-09-20T08:30:00.000Z',
  angler: { uid: `u${i}`, name: `Pescar ${i}`, avatarUrl: null },
});
const catchesPage = (page: number, total: number) => ({
  data: Array.from({ length: Math.min(20, total - (page - 1) * 20) }, (_, i) => aCatch((page - 1) * 20 + i)),
  meta: { pagination: { page, pageSize: 20, pageCount: Math.ceil(total / 20), total } },
});

const fulfill = (body: unknown) => (route: Route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

/** The water pages' dev-only fault switch (app/(site)/ape-publice/_server/e2e-faults.ts): the water is a server read. */
async function setFaults(page: Page, id: number | string, faults: string[]) {
  const res = await page.request.post(`${BASE_URL}/ape-publice/${encodeURIComponent(String(id))}/e2e-fault`, { data: { faults } });
  expect(res.ok()).toBe(true);
}
async function withFaults(page: Page, id: number | string, faults: string[], run: () => Promise<void>) {
  await setFaults(page, id, faults);
  try {
    await run();
  } finally {
    await setFaults(page, id, []);
  }
}

/** Errors in the browser console fail the test (ROADMAP: no console errors), bar the ones a test provokes. */
function watchConsole(page: Page, allow: RegExp[] = []) {
  return collectConsoleErrors(page, { ignore: allow });
}

/* ============================================================================================
 * public-waters.detaliu
 * ========================================================================================== */

test.describe('public-waters.detaliu', () => {
  test('public-waters.detaliu.c1 c6 c16 c29 — id and linkCode resolve the same water; header, facts, attribution', async ({ page }) => {
    const errors = watchConsole(page);
    await page.setViewportSize(DESKTOP);
    await page.goto(`/ape-publice/${WATER.snagov.id}`);
    await expect(page.getByRole('heading', { level: 1, name: 'Snagov' })).toBeVisible();
    await expect(page.locator('[data-t3="header"]').getByText('Lac de acumulare · Ilfov')).toBeVisible();
    // c16: every fact, formatted like fish.
    const facts = page.getByRole('complementary', { name: 'Pe scurt' });
    await expect(facts.getByText('Bazin hidrografic')).toBeVisible();
    await expect(facts.getByText('5.57 km²')).toBeVisible();
    await expect(facts.getByText('32 mil. m³')).toBeVisible();
    await expect(facts.getByText('93 m')).toBeVisible();
    // c29
    await expect(page.getByText(/Date hidrografice: Administrația Națională „Apele Române”/)).toBeVisible();
    // c1: the linkCode (encoded) is the same page; the canonical is the linkCode.
    await page.goto(`/ape-publice/${encodeURIComponent(WATER.snagov.code)}`);
    await expect(page.getByRole('heading', { level: 1, name: 'Snagov' })).toBeVisible();
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/ape-publice\/R%3ARO11_01\.018_R1$/);
    const ld = await page.locator('script[type="application/ld+json"]').first().textContent();
    expect(ld).toContain('"Reservoir"');
    await expectNoA11yViolations(page);
    expect(errors).toEqual([]);
  });

  test('public-waters.detaliu.c3 public-waters.detaliu.s2 — an unknown water is not found, without a retry', async ({ page }) => {
    await page.goto('/ape-publice/999999');
    await expect(page.getByRole('heading', { name: 'Apa publică nu a fost găsită.' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Încearcă din nou' })).toHaveCount(0);
    await page.goto(`/ape-publice/${encodeURIComponent('X:nu-exista')}`);
    await expect(page.getByRole('heading', { name: 'Apa publică nu a fost găsită.' })).toBeVisible();
    await expectNoA11yViolations(page);
  });

  test('public-waters.detaliu.c5 c12 c13 c14 — hero opens the map, back over the hero, quick actions (no dead tiles)', async ({ page, request }) => {
    await page.setViewportSize(PHONE);
    await page.route(venueUrl(WATER.tineretului.code), fulfill(section({ activeNow: 2 })));
    await page.route(catchesUrl(WATER.tineretului.code), fulfill(catchesPage(1, 3)));
    await page.goto(`/ape-publice/${WATER.tineretului.id}`);
    const hero = page.getByRole('link', { name: 'Deschide harta pentru Tineretului' });
    await expect(hero).toBeVisible();
    // c12: the back chip sits over the hero, top-left.
    const back = page.getByRole('button', { name: 'Înapoi' }).first();
    await expect(back).toBeVisible();
    const [heroBox, backBox] = [(await hero.boundingBox())!, (await back.boundingBox())!];
    expect(backBox.y).toBeLessThan(heroBox.y + 40);
    expect(backBox.x).toBeLessThan(heroBox.x + 40);
    // c13 / c14: the tiles in fish's order: Direcții, Hartă, (Partide,) Statistici, then Capturi.
    // Owner (one entry point per page): with the Partide section on the page its «Vezi tot» is the
    // way in — no Partide tile beside it.
    const tiles = page.locator('[data-action]');
    await expect(page.locator('#partide')).toBeVisible();
    await expect(tiles).toHaveCount(4);
    await expect(tiles.nth(0)).toHaveAccessibleName('Direcții');
    await expect(tiles.nth(1)).toHaveAccessibleName('Hartă');
    await expect(tiles.nth(2)).toHaveAccessibleName('Statistici');
    await expect(tiles.nth(3)).toHaveAccessibleName(/^Capturi\s*, 3 capturi cu poză$/);
    await expect(page.getByTestId('quick-actions-later')).toHaveCount(0);
    const code = encodeURIComponent(WATER.tineretului.code);
    await expect(page.locator('[data-action="harta"]')).toHaveAttribute('href', `/ape-publice/${code}/harta`);
    await expect(page.locator('[data-action="partide"]')).toHaveCount(0);
    await expect(page.locator('#partide').getByRole('link', { name: 'Vezi tot' })).toHaveAttribute('href', `/ape-publice/${code}/partide`);
    await expect(page.locator('[data-action="statistici"]')).toHaveAttribute('href', `/ape-publice/${code}/statistici`);
    // Every quick-action link leads somewhere real.
    for (const href of await tiles.evaluateAll((els) => els.map((e) => e.getAttribute('href')).filter(Boolean))) {
      expect((await request.get(href as string)).status(), href as string).not.toBe(404);
    }
    await page.locator('[data-action="capturi"]').click();
    await expect(page).toHaveURL(/#capturi$/);
    await hero.click();
    await expect(page).toHaveURL(new RegExp(`/ape-publice/${code.replace(/[.%]/g, '\\$&')}/harta$`));
  });

  test('public-waters.detaliu.c15 — Direcții offers Google Maps and Waze to the centre', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto(`/ape-publice/${WATER.snagov.id}`);
    // From 1024 Direcții is the summary card's (the tile row drops it — one entry per area).
    await page.getByRole('complementary', { name: 'Pe scurt' }).getByRole('button', { name: 'Direcții' }).click();
    const dialog = page.getByRole('dialog', { name: 'Direcții' });
    await expect(dialog.getByRole('link', { name: /Google Maps/ })).toHaveAttribute('href', /google\.com\/maps\/dir\/\?api=1&destination=44\.70\d+,26\.14\d+&travelmode=driving/);
    await expect(dialog.getByRole('link', { name: /Waze/ })).toHaveAttribute('href', /waze\.com\/ul\?ll=44\.70\d+,26\.14\d+&navigate=yes/);
    await expectNoA11yViolations(page);
  });

  test('public-waters.detaliu.c7 c8 c18 c22 c23 s6 s7 — real data: Partide (activity), Capturi (species, no photos)', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto(`/ape-publice/${WATER.tineretului.id}`);
    await expect(page.getByRole('heading', { name: 'Partide pe această apă' })).toBeVisible();
    const toc = page.getByRole('navigation', { name: 'Secțiuni' });
    // From 1024 Prezentare (tiles + facts, both in the summary card there) leaves the page and the index.
    await expect(toc.getByRole('link')).toHaveText(['Partide', 'Capturi', 'Locație']);
    // c18: «Vezi tot» leads to the water's partide page — the page's one way there (owner: no
    // «Vezi toate partidele» button under it, no Partide button in the summary card).
    const partide = page.locator('#partide');
    const code = encodeURIComponent(WATER.tineretului.code);
    await expect(partide.getByRole('link', { name: 'Vezi tot' })).toHaveAttribute('href', `/ape-publice/${code}/partide`);
    await expect(partide.getByRole('link', { name: /Vezi toate partidele/ })).toHaveCount(0);
    await expect(page.locator(`a[href="/ape-publice/${code}/partide"]`)).toHaveCount(1);
    await expect(page.getByText('ultimele 7 luni')).toBeVisible();
    await expect(page.getByRole('list', { name: 'Specii prinse' }).getByText('Crap')).toBeVisible();
    await expect(page.getByText('Nicio captură cu poză pe această apă încă.')).toBeVisible();
    // c13: no Capturi tile without photo catches.
    await expect(page.locator('[data-action="capturi"]')).toHaveCount(0);
    await expectNoA11yViolations(page);
  });

  test('public-waters.detaliu.c16 — «Cod corp de apă» shows the euCode when the water has one', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    // Canalul Piatra Neamț - Buhuși: one of the few rows with an EU water-body code.
    await page.goto('/ape-publice/5250');
    const facts = page.getByRole('complementary', { name: 'Pe scurt' });
    await expect(facts.getByText('Cod corp de apă')).toBeVisible();
    await expect(facts.getByText('ROA1', { exact: true })).toBeVisible();
  });

  test('public-waters.detaliu.c22 — species chips: server order, «<species> <count>», six then «+N»', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.route(venueUrl(WATER.tineretului.code), fulfill(section()));
    await page.route(catchesUrl(WATER.tineretului.code), fulfill(catchesPage(1, 0)));
    await page.goto(`/ape-publice/${WATER.tineretului.id}`);
    const chips = page.getByRole('list', { name: 'Specii prinse' }).getByRole('listitem');
    await expect(chips).toHaveCount(7);
    await expect(chips).toHaveText(['Crap9', 'Caras7', 'Șalău5', 'Știucă4', 'Biban3', 'Plătică2', '+1']);
    await expect(chips.last()).toHaveAccessibleName('încă 1 specie');
    await expect(page.getByText('Somn')).toHaveCount(0);
  });

  test('public-waters.detaliu.c14 — the Capturi badge is read with Romanian agreement (1 captură, 20 de capturi)', async ({ page }) => {
    // The tiles are below 1024 only (from 1024 the summary card carries them).
    await page.setViewportSize(PHONE);
    await page.route(venueUrl(WATER.tineretului.code), fulfill(section()));
    let total = 1;
    await page.route(catchesUrl(WATER.tineretului.code), (route) => fulfill(catchesPage(1, total))(route));
    await page.goto(`/ape-publice/${WATER.tineretului.id}`);
    await expect(page.locator('[data-action="capturi"]')).toHaveAccessibleName(/^Capturi\s*, 1 captură cu poză$/);
    total = 25;
    await page.reload();
    await expect(page.locator('[data-action="capturi"]')).toHaveAccessibleName(/^Capturi\s*, 25 de capturi cu poză$/);
  });

  test('public-waters.detaliu.c7 s6 — no activity and no species: only Prezentare and Locație', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto(`/ape-publice/${WATER.dunarea.id}`);
    await expect(page.getByRole('heading', { level: 1, name: 'Dunarea' })).toBeVisible();
    const toc = page.getByRole('navigation', { name: 'Secțiuni' });
    await expect(toc.getByRole('link')).toHaveText(['Locație']);
    await expect(page.getByRole('heading', { name: 'Partide pe această apă' })).toHaveCount(0);
  });

  test('public-waters.detaliu.c20 s13 — live partide: rose pill, kg headline, ranked rows', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    const sessions = [
      { documentId: 'p1', startedAt: new Date(Date.now() - 3_600_000).toISOString(), members: [{ uid: 'a', name: 'Ion Pop', avatarUrl: null }], catchCount: 3, maxKg: 4.2, totalKg: 9.5, standName: '2' },
      { documentId: 'p2', startedAt: new Date(Date.now() - 1_800_000).toISOString(), members: [{ uid: 'b', name: 'Ana Ene', avatarUrl: null }], catchCount: 0, maxKg: null, totalKg: null },
    ];
    await page.route(venueUrl(WATER.tineretului.code), fulfill(section({ activeNow: 2 }, { activeSessions: sessions })));
    await page.goto(`/ape-publice/${WATER.tineretului.id}`);
    const card = page.getByTestId('live-partide-card');
    await expect(card.getByText('2 ACTIVI ACUM')).toBeVisible();
    await expect(card.getByText('9,5 kg').first()).toBeVisible();
    await expect(card.getByText('3 capturi', { exact: true })).toBeVisible();
    await expect(card.getByText('cea mai mare')).toBeVisible();
    const rows = card.getByRole('list', { name: 'Partide active acum' }).getByRole('listitem');
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText('Ion Pop');
    await expect(rows.nth(1)).toContainText('— kg');
    // /partide/<id> is not on the web yet: the rows are plain rows, not dead links.
    await expect(card.getByRole('link')).toHaveCount(0);
    await expectNoA11yViolations(page);
  });

  // Criterion 21 is only partly met (rows open nothing until the web has a partidă page): this
  // checks the own-row marker and is deliberately not titled with the criterion id.
  test('public-waters.detaliu — signed in: your own live partidă is marked as yours (own-row marker)', async ({ page, context, request }) => {
    const jwt = await qaJwt(request);
    const me = await (await request.get(`${CMS}/users/me`, { headers: { authorization: `Bearer ${jwt}` } })).json();
    await signIn(context, jwt, BASE_URL);
    await page.setViewportSize(DESKTOP);
    const sessions = [
      { documentId: 'p1', startedAt: new Date(Date.now() - 3_600_000).toISOString(), members: [{ uid: 'other', name: 'Ion Pop', avatarUrl: null }], catchCount: 3, maxKg: 4.2, totalKg: 9.5, standName: '2' },
      { documentId: 'p2', startedAt: new Date(Date.now() - 1_800_000).toISOString(), members: [{ uid: me.documentId, name: 'Eu', avatarUrl: null }], catchCount: 0, maxKg: null, totalKg: null },
    ];
    await page.route(venueUrl(WATER.tineretului.code), fulfill(section({ activeNow: 2 }, { activeSessions: sessions })));
    await page.goto(`/ape-publice/${WATER.tineretului.id}`);
    const mine = page.getByTestId('live-row-p2');
    await expect(mine).toContainText('(partida ta)');
    await expect(mine.locator('span.t-body-strong.text-accent-ink')).toHaveText(/^Eu/);
    await expect(page.getByTestId('live-row-p1')).not.toContainText('(partida ta)');
  });

  test('public-waters.detaliu.c17 s9 — a failed community read shows the banner; retry is busy, then refetches', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    let fail = true;
    let release: () => void = () => {};
    await page.route(venueUrl(WATER.tineretului.code), async (route) => {
      if (fail) return route.fulfill({ status: 500, body: '{}' });
      await new Promise<void>((r) => (release = r));
      return fulfill(section())(route);
    });
    const errors = watchConsole(page, [/500/, /Failed to load resource/]);
    await page.goto(`/ape-publice/${WATER.tineretului.id}`);
    const banner = page.getByRole('alert').filter({ hasText: 'Activitatea comunității nu a putut fi încărcată.' });
    await expect(banner).toBeVisible();
    // Only the failed read: the catches (which answered) are not asked again.
    fail = false;
    await banner.getByRole('button', { name: 'Încearcă din nou' }).click();
    const busy = banner.getByRole('button', { name: 'Se încarcă…' });
    await expect(busy).toHaveAttribute('aria-busy', 'true');
    await expect(busy).toHaveAttribute('aria-disabled', 'true');
    release();
    await expect(banner).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Partide pe această apă' })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('public-waters.detaliu.c19 c31 — the venue section polls every 60s and keeps its last data when a poll fails', async ({ page }) => {
    await page.clock.install();
    await page.setViewportSize(DESKTOP);
    let calls = 0;
    await page.route(venueUrl(WATER.tineretului.code), (route) => {
      calls += 1;
      return calls === 1 ? fulfill(section({ activeNow: 1 }))(route) : route.fulfill({ status: 500, body: '{}' });
    });
    watchConsole(page, [/500/, /Failed to load resource/]);
    await page.goto(`/ape-publice/${WATER.tineretului.id}`);
    const card = page.getByTestId('live-partide-card');
    await expect(card.getByText('1 ACTIVI ACUM')).toBeVisible();
    expect(calls).toBe(1);
    // c31: one more read a minute later.
    await page.clock.runFor(60_000);
    await expect.poll(() => calls).toBe(2);
    // c19: it failed — the card stays (last good data), the banner says so.
    await expect(page.getByRole('alert').filter({ hasText: 'Activitatea comunității nu a putut fi încărcată.' })).toBeVisible();
    await expect(card.getByText('1 ACTIVI ACUM')).toBeVisible();
  });

  test('public-waters.detaliu.s8 — species before the catches: the grid waits in its own shape, never «nicio captură»', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.route(venueUrl(WATER.tineretului.code), fulfill(section()));
    let release: () => void = () => {};
    await page.route(catchesUrl(WATER.tineretului.code), async (route) => {
      await new Promise<void>((r) => (release = r));
      return fulfill(catchesPage(1, 0))(route);
    });
    await page.goto(`/ape-publice/${WATER.tineretului.id}`);
    const capturi = page.locator('#capturi');
    await expect(capturi.getByRole('status')).toHaveText('Se încarcă capturile…');
    await expect(capturi.getByText('Nicio captură cu poză pe această apă încă.')).toHaveCount(0);
    release();
    await expect(capturi.getByText('Nicio captură cu poză pe această apă încă.')).toBeVisible();
  });

  test('public-waters.detaliu.c24 c25 s10 — photo grid, lightbox with footer, next page near the end', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.route(venueUrl(WATER.tineretului.code), fulfill(section()));
    const pages: number[] = [];
    await page.route(catchesUrl(WATER.tineretului.code), (route) => {
      const n = Number(new URL(route.request().url()).searchParams.get('page') ?? '1');
      pages.push(n);
      return fulfill(catchesPage(n, 30))(route);
    });
    await page.goto(`/ape-publice/${WATER.tineretului.id}`);
    const grid = page.getByTestId('catch-grid');
    await expect(grid.getByRole('button')).toHaveCount(20);
    await expect(grid.getByText('Crap · 2,0 kg')).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect(grid.getByRole('button')).toHaveCount(30);
    expect(pages).toEqual([1, 2]);
    await grid.getByRole('button').first().click();
    const box = page.getByRole('dialog', { name: 'Captura 1 din 30' });
    await expect(box.getByText('2,0', { exact: true })).toBeVisible();
    await expect(box.getByText('Pescar 0')).toBeVisible();
    await expect(box.getByText(/Crap · 20 septembrie 2026/)).toBeVisible();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('dialog', { name: 'Captura 2 din 30' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Distribuie captura' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('public-waters.detaliu — the lightbox counts the server total, keeps focus at the ends; ?foto= opens a photo', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.route(venueUrl(WATER.tineretului.code), fulfill(section()));
    await page.route(catchesUrl(WATER.tineretului.code), (route) => {
      const n = Number(new URL(route.request().url()).searchParams.get('page') ?? '1');
      return fulfill(n === 1 ? { ...catchesPage(1, 2), meta: { pagination: { page: 1, pageSize: 20, pageCount: 1, total: 2 } } } : catchesPage(n, 2))(route);
    });
    // A shared link reopens its photo.
    await page.goto(`/ape-publice/${WATER.tineretului.id}?foto=c1`);
    await expect(page.getByRole('dialog', { name: 'Captura 2 din 2' })).toBeVisible();
    // At the last photo «următoare» stays (aria-disabled), so keyboard focus is not lost.
    const next = page.getByRole('button', { name: 'Fotografia următoare' });
    await next.focus();
    await page.keyboard.press('Enter');
    await expect(next).toHaveAttribute('aria-disabled', 'true');
    await expect(next).toBeFocused();
    await expect(page.getByRole('dialog', { name: 'Captura 2 din 2' })).toBeVisible();
    await page.getByRole('button', { name: 'Fotografia anterioară' }).click();
    await expect(page.getByRole('dialog', { name: 'Captura 1 din 2' })).toBeVisible();
  });

  test('public-waters.detaliu.c24 — «Distribuie captura» hands the catch to the Bluvi share card: the image, its switches, a PNG to the share sheet', async ({ page }) => {
    const errors = watchConsole(page);
    await page.setViewportSize(DESKTOP);
    await page.route(venueUrl(WATER.tineretului.code), fulfill(section()));
    await page.route(catchesUrl(WATER.tineretului.code), fulfill(catchesPage(1, 3)));
    await page.goto(`/ape-publice/${WATER.tineretului.id}`);
    await page.getByTestId('catch-grid').getByRole('button').first().click();
    await page.getByRole('dialog', { name: 'Captura 1 din 3' }).getByRole('button', { name: 'Distribuie captura' }).click();
    // fish shareHandoff: the lightbox closes, the share sheet opens.
    await expect(page.getByRole('dialog', { name: /Captura/ })).toHaveCount(0);
    const sheet = page.getByRole('dialog', { name: 'Distribuie captura' });
    await expect(sheet).toBeVisible();
    // The exact image that is shared: the water's name burned in, the kg, the species, the date.
    const card = sheet.getByRole('img', { name: /^Imaginea care se distribuie/ });
    await expect(card).toHaveAttribute('aria-label', 'Imaginea care se distribuie: Tineretului · 2,0 kg · Crap · 20 sep 2026');
    expect(await card.evaluate((c: HTMLCanvasElement) => [c.width, c.height])).toEqual([1080, 1370]);
    // «Ce să apară pe poză»: one switch per field the catch has, all on.
    const switches = sheet.getByRole('group', { name: 'Ce să apară pe poză' }).getByRole('button');
    await expect(switches).toHaveText(['Greutate', 'Baltă', 'Specie', 'Data']);
    for (const b of await switches.all()) await expect(b).toHaveAttribute('aria-pressed', 'true');
    await sheet.getByRole('button', { name: 'Baltă' }).click();
    await expect(sheet.getByRole('button', { name: 'Baltă' })).toHaveAttribute('aria-pressed', 'false');
    await expect(card).toHaveAttribute('aria-label', 'Imaginea care se distribuie: 2,0 kg · Crap · 20 sep 2026');
    await sheet.getByRole('button', { name: 'Baltă' }).click();
    await expectNoA11yViolations(page);
    // «Distribuie» hands the PNG to the system share sheet, with no message (fish: the card says it all).
    await page.evaluate(() => {
      const w = window as unknown as { __shared: unknown[] };
      w.__shared = [];
      Object.defineProperty(navigator, 'canShare', { value: (d: ShareData) => !!d.files?.length, configurable: true });
      Object.defineProperty(navigator, 'share', {
        value: async (d: ShareData) => {
          const f = d.files![0];
          w.__shared.push({ name: f.name, type: f.type, big: f.size > 10_000, text: d.text ?? null, url: d.url ?? null });
        },
        configurable: true,
      });
    });
    await sheet.getByRole('button', { name: 'Distribuie', exact: true }).click();
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __shared: unknown[] }).__shared))
      .toEqual([{ name: 'bluvi-captura.png', type: 'image/png', big: true, text: null, url: null }]);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('public-waters.detaliu.c24 — no file sharing (desktop): the PNG is saved; the phone gets a sheet; no weight, no «Greutate»', async ({ page, request }) => {
    const errors = watchConsole(page);
    await page.setViewportSize(DESKTOP);
    await page.route(venueUrl(WATER.tineretului.code), fulfill(section()));
    const weightless = { ...catchesPage(1, 1), data: [{ ...aCatch(0), weightKg: null }] };
    await page.route(catchesUrl(WATER.tineretului.code), fulfill(weightless));
    await page.goto(`/ape-publice/${WATER.tineretului.id}`);
    await page.evaluate(() => Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true }));
    await page.getByTestId('catch-grid').getByRole('button').first().click();
    await page.getByRole('button', { name: 'Distribuie captura' }).click();
    const sheet = page.getByRole('dialog', { name: 'Distribuie captura' });
    await expect(sheet.getByRole('img', { name: /^Imaginea/ })).toHaveAttribute('aria-label', 'Imaginea care se distribuie: Tineretului · Crap · 20 sep 2026');
    await expect(sheet.getByRole('group', { name: 'Ce să apară pe poză' }).getByRole('button')).toHaveText(['Baltă', 'Specie', 'Data']);
    const download = page.waitForEvent('download');
    await sheet.getByRole('button', { name: 'Distribuie', exact: true }).click();
    expect((await download).suggestedFilename()).toBe('bluvi-captura.png');
    await expect(page.getByText('Imaginea a fost salvată.')).toBeVisible();
    await page.keyboard.press('Escape');

    // Phone: the same card in a bottom sheet.
    await page.setViewportSize(PHONE);
    await page.getByTestId('catch-grid').getByRole('button').first().click();
    await page.getByRole('button', { name: 'Distribuie captura' }).click();
    await expect(page.getByRole('dialog', { name: 'Distribuie captura' }).getByRole('img', { name: /^Imaginea/ })).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Distribuie captura' }).getByRole('button', { name: 'Distribuie', exact: true })).toBeEnabled();
    await expectNoA11yViolations(page);
    expect(errors).toEqual([]);

    // The photo proxy the card draws through passes only the CMS's own photos.
    expect((await request.get(`${BASE_URL}/ape-publice/api/foto?src=${encodeURIComponent('https://example.com/a.jpg')}`)).status()).toBe(400);
    expect((await request.get(`${BASE_URL}/ape-publice/api/foto`)).status()).toBe(400);
  });

  test('public-waters.detaliu.c25 s10 — a failed next page says so with its own retry and is not re-asked by scrolling', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.route(venueUrl(WATER.tineretului.code), fulfill(section()));
    let failPage2 = true;
    const asked: number[] = [];
    await page.route(catchesUrl(WATER.tineretului.code), (route) => {
      const n = Number(new URL(route.request().url()).searchParams.get('page') ?? '1');
      asked.push(n);
      if (n === 2 && failPage2) return route.fulfill({ status: 500, body: '{}' });
      return fulfill(catchesPage(n, 30))(route);
    });
    watchConsole(page, [/500/, /Failed to load resource/]);
    await page.goto(`/ape-publice/${WATER.tineretului.id}`);
    const grid = page.getByTestId('catch-grid');
    await expect(grid.getByRole('button')).toHaveCount(20);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const line = page.getByRole('alert').filter({ hasText: 'Nu am putut încărca mai multe capturi.' });
    await expect(line).toBeVisible();
    // The top banner is for first-load failures only.
    await expect(page.getByRole('alert').filter({ hasText: 'Activitatea comunității' })).toHaveCount(0);
    for (const y of [-200, 200, -100, 300]) await page.mouse.wheel(0, y);
    await page.waitForTimeout(500);
    expect(asked.filter((n) => n === 2)).toHaveLength(1);
    failPage2 = false;
    await line.getByRole('button', { name: 'Încearcă din nou' }).click();
    await expect(grid.getByRole('button')).toHaveCount(30);
    expect(asked.filter((n) => n === 1)).toHaveLength(1);
  });

  test('public-waters.detaliu.c26 c27 c28 s11 — Județe (N), the map card, the link code copies', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.setViewportSize(DESKTOP);
    await page.goto(`/ape-publice/${WATER.dunarea.id}`);
    const loc = page.locator('#locatie');
    await expect(loc.getByRole('heading', { name: 'Județe (12)' })).toBeVisible();
    await expect(loc.getByRole('listitem')).toHaveCount(12);
    // From 1024 the map is the summary card's; the Locație map card is there below 1024.
    await expect(loc.getByRole('link', { name: 'Deschide apa pe hartă' })).toBeHidden();
    await expect(page.getByRole('complementary', { name: 'Pe scurt' }).getByRole('link', { name: /^Deschide harta pentru/ })).toHaveAttribute('href', /\/harta$/);
    await page.setViewportSize(PHONE);
    await expect(loc.getByRole('link', { name: 'Deschide apa pe hartă' })).toHaveAttribute('href', /\/harta$/);
    await page.setViewportSize(DESKTOP);
    const copy = loc.getByRole('button', { name: `Copiază codul apei ${WATER.dunarea.code}` });
    await copy.click();
    await expect(copy).toContainText('Copiat');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(WATER.dunarea.code);
    await expect(copy).toContainText('Copiază', { timeout: 4000 });
  });

  test('public-waters.detaliu.c9 c10 c11 — phone: chips jump to their section, the pinned row shows the name', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto(`/ape-publice/${WATER.tineretului.id}`);
    const nav = page.getByRole('navigation', { name: 'Secțiuni' });
    await expect(nav.getByRole('link')).toHaveText(['Prezentare', 'Partide', 'Capturi', 'Locație']);
    await nav.getByRole('link', { name: 'Locație' }).click();
    await expect(nav.getByRole('link', { name: 'Locație' })).toHaveAttribute('aria-current', 'location');
    await expect(page.locator('[data-t3="chips"]')).toHaveAttribute('data-pinned', 'true');
    await expect(page.locator('[data-t3="chips"]').getByText('Tineretului')).toBeVisible();
    await expectNoA11yViolations(page);
  });

  test('public-waters.detaliu.c30 — another water on the same mounted page starts over: top, Prezentare, unpinned, page 1', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.route(venueUrl(WATER.tineretului.code), fulfill(section()));
    await page.route(catchesUrl(WATER.tineretului.code), (route) => {
      const n = Number(new URL(route.request().url()).searchParams.get('page') ?? '1');
      return fulfill(catchesPage(n, 30))(route);
    });
    const snagovPages: number[] = [];
    await page.route(catchesUrl(WATER.snagov.code), (route) => {
      snagovPages.push(Number(new URL(route.request().url()).searchParams.get('page') ?? '1'));
      return fulfill(catchesPage(1, 0))(route);
    });
    await page.goto(`/ape-publice/${WATER.tineretului.id}`);
    // Scrolled deep, a later chip active, the nav pinned, page 2 loaded.
    await expect(page.getByTestId('catch-grid').getByRole('button')).toHaveCount(20);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect(page.getByTestId('catch-grid').getByRole('button')).toHaveCount(30);
    const chips = page.locator('[data-t3="chips"]');
    await expect(chips).toHaveAttribute('data-pinned', 'true');
    // A client-side navigation: the same mounted layout, a new water.
    await page.evaluate((href) => (window as unknown as { next: { router: { push: (h: string) => void } } }).next.router.push(href), `/ape-publice/${WATER.snagov.id}`);
    await expect(page.getByRole('heading', { level: 1, name: 'Snagov' })).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    // Next keeps the previous water's page mounted but hidden (for Back): the shown one counts.
    await expect(chips.filter({ visible: true })).not.toHaveAttribute('data-pinned');
    await expect(page.getByRole('navigation', { name: 'Secțiuni' }).getByRole('link', { name: 'Prezentare' })).toHaveAttribute('aria-current', 'location');
    await expect.poll(() => snagovPages).toEqual([1]);
  });

  test('public-waters.detaliu.c2 s1 — loading: the page skeleton (busy) with the back control', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await withFaults(page, WATER.snagov.id, ['slow'], async () => {
      await page.goto(`/ape-publice/${WATER.snagov.id}`, { waitUntil: 'commit' });
      await expect(page.getByRole('status').filter({ hasText: 'Se încarcă apa publică' })).toBeAttached();
      await expect(page.locator('[aria-busy="true"]').first()).toBeAttached();
      await expect(page.getByRole('button', { name: 'Înapoi' }).first()).toBeVisible();
      await expect(page.getByRole('heading', { level: 1, name: 'Snagov' })).toBeVisible();
    });
  });

  test('public-waters.detaliu.c3 s3 — a dataset failure: «Nu am putut încărca apa publică.» with a retry that is never silent', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    // React dev reports a server error its boundary handled (dev only, never our own log).
    const errors = watchConsole(page, [/Failed to load resource/, /500/, /It was handled by the <ErrorBoundaryHandler> error boundary/]);
    await withFaults(page, WATER.snagov.id, ['error'], async () => {
      await page.goto(`/ape-publice/${WATER.snagov.id}`);
      await expect(page.getByRole('heading', { name: 'Nu am putut încărca apa publică.' })).toBeVisible();
      // One band: the shell's, named («Bălți / Ape publice / Eroare»).
      const crumbs = page.getByRole('navigation', { name: 'Cale de navigare' });
      await expect(crumbs).toHaveCount(1);
      await expect(crumbs).toContainText('Bălți');
      await expect(crumbs).toContainText('Ape publice');
      // The fault stays on: the retry fails again and says so.
      await page.getByRole('button', { name: 'Încearcă din nou' }).click();
      await expect(page.getByText('Tot nu s-a putut încărca.').first()).toBeVisible();
      await setFaults(page, WATER.snagov.id, []);
      await page.getByRole('button', { name: 'Încearcă din nou' }).click();
      const h1 = page.getByRole('heading', { level: 1, name: 'Snagov' });
      await expect(h1).toBeVisible();
      // Focus lands on the page's title, not <body>.
      await expect(h1).toBeFocused();
    });
    expect(errors).toEqual([]);
  });

  test('public-waters.detaliu.c4 s4 — a claimed water is replaced (not pushed) by its lake, on the page and its map', async ({ page }) => {
    await withFaults(page, WATER.snagov.id, [`claimed:${CHITA}`], async () => {
      for (const path of [`/ape-publice/${WATER.snagov.id}`, `/ape-publice/${WATER.snagov.id}/harta`]) {
        await page.goto('/ape-publice');
        const before = await page.evaluate(() => history.length);
        await page.evaluate((href) => (window as unknown as { next: { router: { push: (h: string) => void } } }).next.router.push(href), path);
        await expect(page).toHaveURL(new RegExp(`/balti/${CHITA}$`));
        // Replaced: the water's URL is not in the history (back returns to the map, not the water).
        expect(await page.evaluate(() => history.length)).toBeLessThanOrEqual(before + 1);
        await page.goBack();
        await expect(page).toHaveURL(/\/ape-publice$/);
      }
    });
  });

  test('public-waters.detaliu.c32 s5 — a water without linkCode: no community sections, no code row, no community request', async ({ page }) => {
    const community: string[] = [];
    page.on('request', (r) => {
      if (/\/feed\/community\//.test(r.url())) community.push(r.url());
    });
    await page.setViewportSize(DESKTOP);
    await withFaults(page, WATER.tineretului.id, ['nolinkcode'], async () => {
      await page.goto(`/ape-publice/${WATER.tineretului.id}`);
      await expect(page.getByRole('heading', { level: 1, name: 'Tineretului' })).toBeVisible();
      await expect(page.getByRole('navigation', { name: 'Secțiuni' }).getByRole('link')).toHaveText(['Locație']);
      await expect(page.locator('#partide')).toHaveCount(0);
      await expect(page.locator('#capturi')).toHaveCount(0);
      await expect(page.getByRole('alert').filter({ hasText: 'Activitatea comunității' })).toHaveCount(0);
      await expect(page.getByText('Cod apă (pentru asociere)')).toHaveCount(0);
      await page.waitForTimeout(500);
    });
    expect(community).toEqual([]);
  });

  test('public-waters.detaliu.c16 s12 — no facts: no «Detalii» block, in the body or the aside', async ({ page }) => {
    for (const size of [PHONE, DESKTOP]) {
      await page.setViewportSize(size);
      await withFaults(page, WATER.snagov.id, ['nofacts'], async () => {
        await page.goto(`/ape-publice/${WATER.snagov.id}`);
        await expect(page.getByRole('heading', { level: 1, name: 'Snagov' })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Detalii' })).toHaveCount(0);
        await expect(page.getByText('Bazin hidrografic')).toHaveCount(0);
        await expect(page.getByText('Suprafață')).toHaveCount(0);
        // The tiles: below 1024 only (the summary card carries them from 1024).
        if (size === PHONE) await expect(page.getByText('Acțiuni rapide')).toBeVisible();
        else await expect(page.getByText('Acțiuni rapide')).toBeHidden();
      });
    }
  });

  test('public-waters.detaliu.s14 — signed out and signed in see the same page, with no sign-in prompt', async ({ page, context, request }) => {
    await page.setViewportSize(DESKTOP);
    await page.route(venueUrl(WATER.tineretului.code), fulfill(section({ activeNow: 0, catchesThisMonth: 3 })));
    await page.route(catchesUrl(WATER.tineretului.code), fulfill(catchesPage(1, 3)));
    const shape = async () => {
      await page.goto(`/ape-publice/${WATER.tineretului.id}`);
      await expect(page.getByRole('heading', { name: 'Partide pe această apă' })).toBeVisible();
      await expect(page.getByTestId('catch-grid').getByRole('button')).toHaveCount(3);
      await expect(page.locator('main').getByText(/Intră în cont/)).toHaveCount(0);
      return {
        toc: await page.getByRole('navigation', { name: 'Secțiuni' }).getByRole('link').allTextContents(),
        tiles: await page.locator('[data-action]').evaluateAll((els) => els.map((e) => e.getAttribute('data-action'))),
        h2: await page.locator('main h2').allTextContents(),
      };
    };
    const signedOut = await shape();
    await signIn(context, await qaJwt(request), BASE_URL);
    const signedIn = await shape();
    expect(signedIn).toEqual(signedOut);
  });

  test('public-waters.detaliu.c20 — idle, nothing this month, no record: one muted line, not the navy card', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.route(venueUrl(WATER.tineretului.code), fulfill(section({ activeNow: 0, catchesThisMonth: 0, recordKg: null })));
    await page.goto(`/ape-publice/${WATER.tineretului.id}`);
    const card = page.getByTestId('live-partide-card');
    await expect(card).toHaveText('Nicio captură luna aceasta · ultima activitate: iulie');
    await expect(page.locator('#partide').getByText(/luna aceasta/i)).toHaveCount(1);
  });

  test('public-waters.detaliu.c20 — idle with a record: «0 capturi» + «luna aceasta · record istoric», no eyebrow', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.route(venueUrl(WATER.tineretului.code), fulfill(section({ activeNow: 0, catchesThisMonth: 0, recordKg: 7.4 })));
    await page.goto(`/ape-publice/${WATER.tineretului.id}`);
    const card = page.getByTestId('live-partide-card');
    await expect(card).toContainText('0 capturi');
    await expect(card.getByText('luna aceasta · record istoric 7,4 kg')).toBeVisible();
    await expect(card.getByText('Luna aceasta', { exact: true })).toHaveCount(0);
  });

  test('public-waters.detaliu.c25 s10 — at the last loaded photo the lightbox waits for the next page, and a failed one has its retry in the dialog', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.route(venueUrl(WATER.tineretului.code), fulfill(section()));
    let failPage2 = true;
    await page.route(catchesUrl(WATER.tineretului.code), (route) => {
      const n = Number(new URL(route.request().url()).searchParams.get('page') ?? '1');
      if (n === 2 && failPage2) return route.fulfill({ status: 500, body: '{}' });
      return fulfill(catchesPage(n, 45))(route);
    });
    watchConsole(page, [/500/, /Failed to load resource/]);
    await page.goto(`/ape-publice/${WATER.tineretului.id}?foto=c19`);
    const box = page.getByRole('dialog', { name: 'Captura 20 din 45' });
    await expect(box).toBeVisible();
    const alert = box.getByRole('alert');
    await expect(alert).toContainText('Nu am putut încărca mai multe capturi.');
    failPage2 = false;
    await alert.getByRole('button', { name: 'Încearcă din nou' }).click();
    await expect(alert).toHaveCount(0);
    await box.getByRole('button', { name: 'Fotografia următoare' }).click();
    await expect(page.getByRole('dialog', { name: 'Captura 21 din 45' })).toBeVisible();
  });

  test('public-waters.detaliu — the catch masonry reads across and never moves a tile when a page is appended', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.route(venueUrl(WATER.tineretului.code), fulfill(section()));
    await page.route(catchesUrl(WATER.tineretului.code), (route) => {
      const n = Number(new URL(route.request().url()).searchParams.get('page') ?? '1');
      return fulfill(catchesPage(n, 30))(route);
    });
    await page.goto(`/ape-publice/${WATER.tineretului.id}`);
    const tiles = page.getByTestId('catch-grid').getByRole('button');
    await expect(tiles).toHaveCount(20);
    const boxes = async () => (await tiles.evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => [Math.round(r.x), Math.round(r.y + window.scrollY)])));
    const first = await boxes();
    // The first row reads left to right: tiles 1, 2, 3 are side by side.
    expect(first[1][0]).toBeGreaterThan(first[0][0]);
    expect(first[1][1]).toBe(first[0][1]);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect(tiles).toHaveCount(30);
    expect((await boxes()).slice(0, 20)).toEqual(first);
  });

  test('public-waters.detaliu — one breadcrumb trail from Bălți; a repeated alt name is not shown', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto(`/ape-publice/${WATER.snagov.id}`);
    const crumbs = page.getByRole('navigation', { name: 'Cale de navigare' });
    await expect(crumbs).toHaveCount(1);
    await expect(crumbs.getByRole('link')).toHaveText(['Bălți', 'Ape publice']);
    await expect(crumbs.locator('[aria-current="page"]')).toHaveText('Snagov');
    // The dataset's «SNAGOV» is the name again: not shown.
    await expect(page.locator('[data-t3="header"]').getByText('SNAGOV', { exact: true })).toHaveCount(0);
    const ld = await page.locator('script[type="application/ld+json"]').allTextContents();
    const list = ld.map((t) => JSON.parse(t)).flat().find((d: { '@type': string }) => d['@type'] === 'BreadcrumbList');
    expect(list.itemListElement.map((i: { name: string }) => i.name)).toEqual(['Bălți', 'Ape publice', 'Snagov']);
  });
});

/* ============================================================================================
 * public-waters.harta
 * ========================================================================================== */

test.describe('public-waters.harta', () => {
  test('public-waters.harta.c3 c5 c6 c7 s4 — full map, back control, bottom card; id and linkCode', async ({ page }) => {
    const errors = watchConsole(page);
    await page.setViewportSize(PHONE);
    await page.goto(`/ape-publice/${encodeURIComponent(WATER.dunarea.code)}/harta`);
    await expect(page.getByRole('heading', { level: 1, name: 'Hartă Dunarea' })).toBeAttached();
    await expect(page.getByRole('link', { name: 'Înapoi' })).toBeVisible();
    await expect(page.getByText('Tulcea', { exact: true })).toBeVisible();
    await expect(page.locator('.maplibregl-canvas')).toBeVisible();
    await page.goto(`/ape-publice/${WATER.dunarea.id}/harta`);
    await expect(page.locator('main p.t-heading, #continut p.t-heading').getByText('Dunarea', { exact: true })).toBeVisible();
    await expectNoA11yViolations(page);
    expect(errors).toEqual([]);
  });

  test('public-waters.harta.c4 — the water in the amber outline over the indigo wash', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto(`/ape-publice/${WATER.snagov.id}/harta`);
    const map = page.locator('[data-map-status="ready"]');
    await expect(map).toHaveAttribute('data-selected-water', String(WATER.snagov.id));
    await expect(map).toHaveAttribute('data-selected-style', 'outline-amber wash-indigo');
  });

  test('public-waters.harta.c1 s1 — loading: a centred spinner with the back control', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await withFaults(page, WATER.snagov.id, ['slow'], async () => {
      await page.goto(`/ape-publice/${WATER.snagov.id}/harta`, { waitUntil: 'commit' });
      const status = page.getByRole('status').filter({ hasText: 'Se încarcă harta…' });
      await expect(status).toBeVisible();
      // While it loads: an <h1> and the history back (the water page's own back).
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Hartă/);
      await expect(page.getByRole('button', { name: 'Înapoi' })).toBeVisible();
      await expect(status).toBeVisible();
      await expect(page.getByRole('heading', { level: 1, name: 'Hartă Snagov' })).toBeAttached();
    });
  });

  test('public-waters.harta.c2 s3 — a dataset failure: «Nu am putut încărca harta.» with a retry that is never silent', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    // React dev reports a server error its boundary handled (dev only, never our own log).
    const errors = watchConsole(page, [/Failed to load resource/, /500/, /It was handled by the <ErrorBoundaryHandler> error boundary/]);
    await withFaults(page, WATER.snagov.id, ['error'], async () => {
      await page.goto(`/ape-publice/${WATER.snagov.id}/harta`);
      await expect(page.getByRole('heading', { name: 'Nu am putut încărca harta.' })).toBeVisible();
      await page.getByRole('button', { name: 'Încearcă din nou' }).click();
      await expect(page.getByText('Tot nu s-a putut încărca.').first()).toBeVisible();
      await setFaults(page, WATER.snagov.id, []);
      await page.getByRole('button', { name: 'Încearcă din nou' }).click();
      await expect(page.getByRole('heading', { level: 1, name: 'Hartă Snagov' })).toBeAttached();
    });
    expect(errors).toEqual([]);
  });

  test('public-waters.harta.c3 s5 — a geometry with one coordinate: the map frames the centre ± 0.1°', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await withFaults(page, WATER.snagov.id, ['point'], async () => {
      await page.goto(`/ape-publice/${WATER.snagov.id}/harta`);
      const map = page.locator('[data-map-status="ready"]');
      await expect(map).toBeVisible({ timeout: 20_000 });
      await expect(page.getByRole('heading', { level: 1, name: 'Hartă Snagov' })).toBeAttached();
      // Snagov's centre is ≈ 44.70 N, 26.14 E: the map is centred on it.
      const [lng, lat] = ((await map.getAttribute('data-initial-center')) ?? '').split(',').map(Number);
      expect(Math.abs(lat - 44.7)).toBeLessThan(0.1);
      expect(Math.abs(lng - 26.14)).toBeLessThan(0.1);
    });
  });

  test('public-waters.harta — one breadcrumb trail «Bălți / Ape publice / <water> / Hartă», with room above the map', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto(`/ape-publice/${WATER.snagov.id}/harta`);
    const crumbs = page.getByRole('navigation', { name: 'Cale de navigare' });
    await expect(crumbs).toHaveCount(1);
    await expect(crumbs.getByRole('link')).toHaveText(['Bălți', 'Ape publice', 'Snagov']);
    await expect(crumbs.locator('[aria-current="page"]')).toHaveText('Hartă');
    const crumbBox = (await crumbs.boundingBox())!;
    const mapBox = (await page.locator('[data-map-status]').first().boundingBox())!;
    expect(mapBox.y - (crumbBox.y + crumbBox.height)).toBeGreaterThanOrEqual(12);
  });

  test('public-waters.harta.c2 s2 — unknown water: not found, no retry', async ({ page }) => {
    await page.goto('/ape-publice/999999/harta');
    await expect(page.getByRole('heading', { name: 'Apa publică nu a fost găsită.' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Încearcă din nou' })).toHaveCount(0);
  });
});

/* ============================================================================================
 * public-waters.harta-ape
 * ========================================================================================== */

test.describe('public-waters.harta-ape', () => {
  test('public-waters.harta-ape.c1 — Bălți home toggle opens Ape publice', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/balti');
    const toggle = page.getByRole('navigation', { name: 'Tip de apă' });
    test.skip((await toggle.count()) === 0, '/balti home (lakes unit) not built in this tree yet');
    await toggle.getByRole('link', { name: 'Ape publice' }).click();
    await expect(page).toHaveURL(/\/ape-publice$/);
  });

  test('public-waters.harta-ape.c3 c4 c5 c8 c21 c22 s1 s13 — chrome, chips, clusters and the largest waters; no lake request', async ({ page }) => {
    const errors = watchConsole(page);
    const lakeRequests: string[] = [];
    page.on('request', (r) => {
      if (/\/feed\/lakes|\/api\/lakes/.test(r.url())) lakeRequests.push(r.url());
    });
    await page.setViewportSize(DESKTOP);
    await page.goto('/ape-publice');
    await expect(page.getByRole('heading', { level: 1, name: 'Ape publice' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Caută un râu sau lac' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Lacuri' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'Râuri' })).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByRole('heading', { name: 'Cele mai mari ape din zonă' })).toBeVisible();
    const rows = page.locator('[data-t2-id] button');
    await expect(rows.first()).toContainText('Razim');
    await expect(rows.first()).toContainText('Tulcea · 39.266 ha');
    await expect(page.getByRole('button', { name: /ape — mărește harta aici/ }).first()).toBeVisible();
    // c5: the active type is a no-op; Râuri switches to rivers (badge «Râu», no area).
    await page.getByRole('button', { name: 'Râuri' }).click();
    await expect(page.getByRole('button', { name: 'Râuri' })).toHaveAttribute('aria-pressed', 'true');
    await expect(rows.first()).toContainText('Râu');
    await expectNoA11yViolations(page);
    expect(lakeRequests).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('public-waters.harta-ape.c15 c17 c18 c20 s6 — a list row selects: amber, preview card to the detail page', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/ape-publice');
    await page.locator('[data-t2-id] button').first().click();
    const card = page.getByRole('article', { name: 'Razim' });
    await expect(card).toBeVisible();
    await expect(card.getByText('Lac natural · Tulcea')).toBeVisible();
    await expect(card.getByRole('link', { name: 'Razim' })).toHaveAttribute('href', '/ape-publice/56');
    await expect(page.locator('[data-water-pin="56"]')).toHaveAttribute('aria-pressed', 'true');
    await card.getByRole('button', { name: 'Închide' }).click();
    await expect(card).toHaveCount(0);
  });

  test('public-waters.harta-ape.c24 s5 — phone: a pan hides the list, «Vezi lista (N)» brings it back', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto('/ape-publice');
    await expect(page.getByRole('heading', { name: 'Cele mai mari ape din zonă' })).toBeVisible();
    await expect(page.locator('.maplibregl-canvas')).toBeVisible();
    const box = (await page.locator('.maplibregl-canvas').boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + 200);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 60, box.y + 260, { steps: 6 });
    await page.mouse.up();
    const pill = page.getByRole('button', { name: /^Vezi lista \(\d+\)$/ });
    await expect(pill).toBeVisible();
    await pill.click();
    await expect(pill).toHaveCount(0);
  });

  test('public-waters.harta-ape.c26 c27 c28 c29 c31 s10 — search: recents, grouped results, no results, opens the water', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/ape-publice');
    await page.evaluate(() => localStorage.removeItem('recent_public_water_searches'));
    await page.getByRole('button', { name: 'Caută un râu sau lac' }).click();
    const dialog = page.getByRole('dialog', { name: 'Caută ape publice' });
    const input = dialog.getByRole('searchbox', { name: 'Caută un râu sau lac' });
    await expect(input).toBeFocused();
    await expect(dialog.getByText('În jurul meu')).toBeVisible();
    await expect(dialog.getByText('Ape publice în apropiere')).toBeVisible();
    await input.fill('snagov');
    await expect(dialog.getByRole('heading', { name: 'Râuri' })).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Lacuri' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: /Snagov Lac de acumulare · Ilfov/ })).toBeVisible();
    await input.fill('zzzzqq');
    await expect(dialog.getByRole('status')).toHaveText('Niciun rezultat pentru „zzzzqq”.');
    await expect(dialog.getByText('Niciun rezultat pentru „zzzzqq”.').last()).toBeVisible();
    await input.fill('snagov');
    await dialog.getByRole('button', { name: /Snagov Lac de acumulare · Ilfov/ }).click();
    await expect(page).toHaveURL(/\/ape-publice\/2245$/);
    // Back on the map: the selection is a recent («Șterge tot» clears them).
    await page.goto('/ape-publice');
    await page.getByRole('button', { name: 'Caută un râu sau lac' }).click();
    await expect(dialog.getByRole('heading', { name: 'Căutări recente' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: /Snagov/ })).toBeVisible();
    await expectNoA11yViolations(page);
    await dialog.getByRole('button', { name: 'Șterge tot' }).click();
    await expect(dialog.getByRole('heading', { name: 'Căutări recente' })).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Închide' }).click();
    await expect(dialog).toBeHidden();
  });

  test('public-waters.harta-ape.c30 s11 — «În jurul meu» lists the nearest waters with distance', async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 44.406, longitude: 26.105 });
    await page.setViewportSize(DESKTOP);
    await page.goto('/ape-publice');
    await page.getByRole('button', { name: 'Caută un râu sau lac' }).click();
    const dialog = page.getByRole('dialog', { name: 'Caută ape publice' });
    await dialog.getByRole('button', { name: /În jurul meu/ }).click();
    await expect(dialog.getByRole('heading', { name: 'Cele mai apropiate' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: /Tineretului \d+ m · Lac natural · București/ })).toBeVisible();
    await expect(dialog.locator('section ul > li')).toHaveCount(20);
  });

  test('public-waters.harta-ape.c32 c33 c34 s9 s12 — county filter: draft, Toate, Aplică (N), Anulează', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/ape-publice');
    await page.getByRole('button', { name: 'Județe' }).click();
    const panel = page.getByRole('heading', { name: 'Județe', level: 2 });
    await expect(panel).toBeVisible();
    await page.getByRole('searchbox', { name: 'Caută un județ' }).fill('tulc');
    await page.locator('label').filter({ hasText: /^Tulcea/ }).click();
    await expect(page.getByRole('button', { name: 'Aplică (1)' })).toBeVisible();
    await page.getByRole('button', { name: 'Toate' }).click();
    await expect(page.getByRole('button', { name: 'Aplică', exact: true })).toBeVisible();
    await page.locator('label').filter({ hasText: /^Tulcea/ }).click();
    await page.getByRole('button', { name: 'Aplică (1)' }).click();
    await expect(page.getByRole('button', { name: 'Județe · 1' })).toBeVisible();
    // c34: the list holds Tulcea's waters only.
    await expect(page.locator('[data-t2-id] button').first()).toContainText('Tulcea');
    const metas = await page.locator('[data-t2-id] button').allTextContents();
    expect(metas.every((t) => t.includes('Tulcea'))).toBe(true);
    // Anulează leaves the applied filter alone.
    await page.getByRole('button', { name: 'Județe · 1' }).click();
    await page.locator('label').filter({ hasText: /^Tulcea/ }).click();
    await page.getByRole('button', { name: 'Anulează' }).click();
    await expect(page.getByRole('button', { name: 'Județe · 1' })).toBeVisible();
  });

  test('public-waters.harta-ape.c25 s11 — locate denied shows how to allow it', async ({ page, context }) => {
    await context.clearPermissions();
    await page.setViewportSize(DESKTOP);
    await page.goto('/ape-publice');
    await page.getByRole('button', { name: 'Locația mea' }).click();
    await expect(page.getByRole('dialog', { name: /Găsește ape aproape de tine|Nu am putut afla locația/ })).toBeVisible();
  });

  test('public-waters.harta-ape.c21 s3 — no map (tiles down): the list still lists the largest waters', async ({ page }) => {
    await page.route(/tiles\.openfreemap\.org/, (route) => route.abort());
    watchConsole(page, [/openfreemap/, /Failed to load resource/]);
    for (const size of [PHONE, DESKTOP]) {
      await page.setViewportSize(size);
      await page.goto('/ape-publice');
      await expect(page.getByText(/Harta nu s-a putut încărca\./)).toBeVisible({ timeout: 20_000 });
      await expect(page.getByRole('heading', { name: 'Cele mai mari ape din zonă' })).toBeVisible();
      await expect(page.locator('[data-t2-id] button').first()).toContainText('Razim');
    }
  });

  test('public-waters.harta-ape.s14 — a failed dataset read is an error with a retry, never «nicio apă»', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    let fail = true;
    await page.route('**/ape-publice/api/markers*', (route) => (fail ? route.fulfill({ status: 500, body: '{}' }) : route.fallback()));
    watchConsole(page, [/500/, /Failed to load resource/]);
    await page.goto('/ape-publice');
    const alert = page.getByRole('alert').filter({ hasText: 'Nu am putut încărca apele' });
    await expect(alert).toBeVisible({ timeout: 20_000 });
    await expect(alert).toContainText('Verifică conexiunea și încearcă din nou.');
    await expect(page.getByText('Nicio apă publică în această zonă.')).toHaveCount(0);
    await expect(alert).toBeVisible();
    fail = false;
    await alert.getByRole('button', { name: 'Încearcă din nou' }).click();
    await expect(page.getByRole('heading', { name: 'Cele mai mari ape din zonă' })).toBeVisible();
    await expect(page.locator('[data-t2-id] button').first()).toContainText('Razim');
  });

  test('public-waters.harta-ape.s10 — a failed search says so (status too) and retries the same term', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    let fail = true;
    await page.route('**/ape-publice/api/search*', (route) => (fail ? route.fulfill({ status: 500, body: '{}' }) : route.fallback()));
    watchConsole(page, [/500/, /Failed to load resource/]);
    await page.goto('/ape-publice');
    await page.getByRole('button', { name: 'Caută un râu sau lac' }).click();
    const dialog = page.getByRole('dialog', { name: 'Caută ape publice' });
    await dialog.getByRole('searchbox', { name: 'Caută un râu sau lac' }).fill('snagov');
    const alert = dialog.getByRole('alert');
    await expect(alert).toContainText('Căutarea nu a funcționat.');
    await expect(dialog.getByRole('status')).toHaveText('Căutarea nu a funcționat.');
    fail = false;
    await alert.getByRole('button', { name: 'Încearcă din nou' }).click();
    await expect(dialog.getByRole('button', { name: /Snagov Lac de acumulare · Ilfov/ })).toBeVisible();
  });

  test('public-waters.harta-ape.c32 s9 — counties: rows-shaped loading; a failed read retries and applies nothing', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    let fail = true;
    await page.route('**/ape-publice/api/counties*', (route) => (fail ? route.fulfill({ status: 500, body: '{}' }) : route.fallback()));
    watchConsole(page, [/500/, /Failed to load resource/]);
    await page.goto('/ape-publice');
    await page.getByRole('button', { name: 'Județe' }).click();
    const alert = page.getByRole('alert').filter({ hasText: 'Județele nu s-au putut încărca.' });
    await expect(alert).toBeVisible();
    await expect(page.getByRole('button', { name: /^Aplică/ })).toHaveCount(0);
    fail = false;
    await alert.getByRole('button', { name: 'Încearcă din nou' }).click();
    await expect(page.locator('label').filter({ hasText: /^Tulcea/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Aplică', exact: true })).toBeVisible();
  });

  test('public-waters.harta-ape.c15 — a selection in progress is busy (row, announcement)', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    let release: () => void = () => {};
    await page.route('**/ape-publice/api/water/*', async (route) => {
      await new Promise<void>((r) => (release = r));
      return route.fallback();
    });
    await page.goto('/ape-publice');
    const row = page.locator('[data-t2-id] button').first();
    await expect(row).toContainText('Razim');
    await row.click();
    await expect(row).toHaveAttribute('aria-busy', 'true');
    await expect(page.getByText('Se încarcă Razim…')).toBeAttached();
    release();
    await expect(page.getByRole('article', { name: 'Razim' })).toBeVisible();
    await expect(row).not.toHaveAttribute('aria-busy', 'true');
  });
});
