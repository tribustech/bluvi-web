import { collectConsoleErrors } from './helpers/console';
import { BASE_URL as BASE } from './helpers/base-url';
import { expectNoA11yViolations } from './helpers/a11y';
import { expect, test, type Page } from '@playwright/test';

/*
 * Concurs · Imagine clasament — parity docs/parity/areas/competition-page.yml
 * competition-page.imagine-clasament (fish app/(app)/competitions/ranking-image.tsx,
 * ranking-image-cn.tsx, RankingTableForScreenshot.tsx). Local CMS on :1337; override the ids with
 * E2E_COMPETITION_* when the local data moves. The page's server reads are failed or held through the
 * dev-only fault switch (POST /concursuri/<id>/clasament/imagine/e2e-fault, imagine/e2e-faults.ts).
 *
 * State ids (docs/parity/areas/competition-page.yml): s1 competition loading / error, s2 image
 * generating / ready / failed, s3 the table kinds, s4 no sponsors, s5 opened directly. «Nothing to
 * draw» and «the competition is gone» are c6's own states (its web_note), not s1.
 */

const ID = {
  /** completed, quantity, one sector. */
  completed: process.env.E2E_COMPETITION_COMPLETED ?? 'uxxie29m6820wrpdv45w0m7q',
  /** completed feederRounds, team, 4 sectors, 2 legs. */
  feeder: process.env.E2E_COMPETITION_FEEDER ?? 'rg340d4r4gnwf2mbyhxvasnr',
  /** completed nationalChampionship, 3 sectors, 6 clubs. */
  nc: process.env.E2E_COMPETITION_NC ?? 'z7rvhm55ziyr0tbblqwjp39q',
  /** completed bestOfTiers. */
  bestOfTiers: process.env.E2E_COMPETITION_BESTOF_TIERS ?? 'wyjmy091opw9wat92j7i9xc5',
  /** notStarted: no ranking yet. */
  upcoming: process.env.E2E_COMPETITION_UPCOMING_OWN ?? 'a6xjl65ooe9eadrtvvqj9hn1',
};

const PHONE = { width: 375, height: 812 };
const DESKTOP = { width: 1440, height: 900 };
const page$ = (id: string, q = '') => `/concursuri/${id}/clasament/imagine${q}`;
const png$ = (id: string, q = '') => `/concursuri/${id}/clasament/imagine/png${q}`;

test.describe.configure({ timeout: 120_000 });

/** Collects console errors and the `bluvi:analytics` events the page dispatches. */
async function open(page: Page, url: string, viewport = DESKTOP) {
  await page.setViewportSize(viewport);
  const errors = collectConsoleErrors(page);
  await page.addInitScript(() => {
    (window as unknown as { __events: unknown[] }).__events = [];
    window.addEventListener('bluvi:analytics', e => (window as unknown as { __events: unknown[] }).__events.push((e as CustomEvent).detail));
  });
  const res = await page.goto(url, { waitUntil: 'domcontentloaded' });
  expect(res?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1, name: 'Imagine clasament' })).toBeVisible({ timeout: 45_000 });
  return errors;
}

const events = (page: Page) => page.evaluate(() => (window as unknown as { __events: { name: string; params: Record<string, string> }[] }).__events);
const stage = (page: Page) => page.getByTestId('ranking-image-stage');
/**
 * The image is on screen. A shared `next dev` that is rewriting a route manifest while the PNG is
 * asked for answers that one request with a 500 (SyntaxError in loadManifest — the environment, not
 * the page); the page then shows its own «Încearcă din nou», pressed here once before failing.
 */
async function ready(page: Page) {
  const img = stage(page).locator('img');
  const retry = page.getByRole('alert').filter({ hasText: 'Am întâmpinat o eroare!' }).getByRole('button', { name: 'Încearcă din nou' });
  await expect(img.or(retry).first()).toBeVisible({ timeout: 60_000 });
  if (!(await img.isVisible())) await retry.click();
  await expect(img).toBeVisible({ timeout: 60_000 });
}
const hydrated = (page: Page) =>
  expect
    .poll(() => page.getByRole('button', { name: 'Mărește' }).evaluate(el => Object.keys(el).some(k => k.startsWith('__reactProps'))), { timeout: 60_000 })
    .toBe(true);

/** The image page's dev-only fault switch for one competition ([] clears it). */
async function faults(page: Page, id: string, list: string[]) {
  const res = await page.request.post(`${BASE}/concursuri/${id}/clasament/imagine/e2e-fault`, { data: { faults: list } });
  expect(res.ok(), 'the dev-only fault switch answers (development server)').toBeTruthy();
}

/** PNG width/height from its IHDR. */
function pngSize(buf: Buffer) {
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

test('competition-page.imagine-clasament.c1 competition-page.imagine-clasament.c3 competition-page.imagine-clasament.c5 — standard: a PNG at least 1300 wide (×1.5), named Clasament_{name}', async ({ request }) => {
  for (const id of [ID.completed, ID.bestOfTiers]) {
    for (const q of ['', '?sortare=loc']) {
      const res = await request.get(png$(id, q), { timeout: 90_000 });
      expect(res.status()).toBe(200);
      expect(res.headers()['content-type']).toBe('image/png');
      expect(res.headers()['x-ranking-image']).toBe('standard');
      expect(decodeURIComponent(res.headers()['content-disposition'])).toMatch(/filename\*=UTF-8''Clasament_.+\.png$/);
      // «Exportat la data {now}»: even a completed ranking's drawing is never kept past the minute it was stamped.
      expect(res.headers()['cache-control']).toBe('public, max-age=60');
      const size = pngSize(await res.body());
      expect(size.width).toBeGreaterThanOrEqual(1300 * 1.5);
      expect(size.height).toBeGreaterThan(600);
    }
  }
});

test('competition-page.imagine-clasament.c2 competition-page.imagine-clasament.c4 competition-page.imagine-clasament.s3 — feeder General / Manșa N, NC General (cn) and an NC sector', async ({ request }) => {
  const get = async (id: string, q: string) => {
    const res = await request.get(png$(id, q), { timeout: 90_000 });
    expect(res.status(), `${id}${q}`).toBe(200);
    return res;
  };
  const general = await get(ID.feeder, '');
  const leg = await get(ID.feeder, '?mansa=2');
  // A leg is drawn by sector: its own sheet, not the General one.
  expect(pngSize(await leg.body()).height).not.toBe(pngSize(await general.body()).height);
  const cn = await get(ID.nc, '');
  expect(cn.headers()['x-ranking-image']).toBe('cn');
  expect(decodeURIComponent(cn.headers()['content-disposition'])).toContain('Clasament_Campionat_National_');
  const sector = await get(ID.nc, '?sector=B');
  expect(sector.headers()['x-ranking-image']).toBe('standard');
  // A leg past the last one: no such table — an answer (200 JSON), not an error a browser logs.
  const none = await request.get(png$(ID.feeder, '?mansa=9'));
  expect(none.status()).toBe(200);
  expect(await none.json()).toEqual({ reason: 'noSuchView' });
});

test('competition-page.imagine-clasament.c6 competition-page.imagine-clasament.s2 competition-page.imagine-clasament.c9 — generating, then ready; download and share disabled until then', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>(r => (release = r));
  await page.route('**/clasament/imagine/png*', async route => {
    await gate;
    await route.continue();
  });
  const errors = await open(page, page$(ID.completed));
  const status = page.getByRole('status').filter({ hasText: 'imaginea clasamentului' });
  await expect(status).toHaveText('Se generează imaginea clasamentului…');
  // The plan has streamed in: the skeleton is the planned sheet's.
  // (Visible: until React reveals the streamed boundary, its content also sits in a hidden node.)
  await expect(page.locator('[data-sheet]').locator('visible=true')).toHaveCount(1, { timeout: 30_000 });
  const generating = page.getByText('Se generează imaginea…').locator('visible=true');
  await expect(generating).toBeVisible();
  await expect(page.getByRole('button', { name: 'Descarcă clasamentul' }).locator('visible=true')).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Distribuie clasamentul' }).locator('visible=true')).toBeDisabled();
  // The skeleton has the planned sheet's shape: the stage that replaces it does not move.
  const frame = await generating.evaluate(el => el.closest('[style*="--ratio"]')!.getBoundingClientRect().toJSON());
  release();
  await ready(page);
  await expect(page.getByRole('button', { name: 'Descarcă clasamentul' }).locator('visible=true')).toBeEnabled();
  await expect(status).toHaveText('Imaginea clasamentului este gata. O poți descărca sau distribui.');
  const box = (await stage(page).boundingBox())!;
  expect(Math.abs(box.y - frame.y)).toBeLessThan(2);
  expect(Math.abs(box.height - frame.height)).toBeLessThan(2);
  await expectNoA11yViolations(page);
  expect(errors).toEqual([]);
});

test('competition-page.imagine-clasament.c9 — «Descarcă» saves Clasament_{name}.png, «Distribuie» shares the file; analytics as fish', async ({ page }) => {
  await page.addInitScript(() => {
    const nav = navigator as Navigator & { __shared?: { files?: File[] }[] };
    nav.__shared = [];
    Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true });
    Object.defineProperty(navigator, 'share', {
      value: async (data: { files?: File[] }) => {
        nav.__shared!.push(data);
      },
      configurable: true,
    });
  });
  await open(page, page$(ID.completed));
  await ready(page);
  await hydrated(page);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Descarcă clasamentul' }).locator('visible=true').click();
  expect((await download).suggestedFilename()).toMatch(/^Clasament_.+\.png$/);
  await page.getByRole('button', { name: 'Distribuie clasamentul' }).locator('visible=true').click();
  await expect
    .poll(() => page.evaluate(() => (navigator as Navigator & { __shared?: { files?: File[] }[] }).__shared?.map(s => s.files?.[0]?.name)))
    .toEqual([expect.stringMatching(/^Clasament_.+\.png$/)]);
  const names = (await events(page)).map(e => e.name);
  expect(names).toEqual(['download_ranking_image', 'share_ranking_image']);
  // fish confirms both (downloadFile «Descarcat cu succes!», shareImage «Distribuit cu succes»).
  await expect(page.getByText('Distribuit cu succes')).toBeVisible();
  expect((await events(page))[0].params.competition_id).toBe(ID.completed);
});

test('competition-page.imagine-clasament.c9 — National Championship General logs the cn events', async ({ page }) => {
  await open(page, page$(ID.nc));
  await ready(page);
  await hydrated(page);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Descarcă clasamentul' }).locator('visible=true').click();
  expect((await download).suggestedFilename()).toMatch(/^Clasament_Campionat_National_.+\.png$/);
  expect((await events(page)).map(e => e.name)).toEqual(['download_cn_ranking_image']);
});

test('competition-page.imagine-clasament.c8 — the image zooms (buttons, keyboard) and pans (drag)', async ({ page }) => {
  await open(page, page$(ID.feeder), PHONE);
  await ready(page);
  await hydrated(page);
  const scale = async () => Number(await stage(page).getAttribute('data-scale'));
  // The stage measures itself once the image has decoded: read the fit and the opening scale then.
  await expect.poll(async () => Number(await stage(page).getAttribute('data-fit'))).toBeGreaterThan(0);
  const fitWidth = Number(await stage(page).getAttribute('data-fit'));
  // The phone opens at a readable scale (not the ~19% fit), anchored at the table's left edge (the next test).
  await expect.poll(scale).toBeGreaterThan(fitWidth * 1.5);
  const fitted = await scale();
  await page.getByRole('button', { name: 'Mărește' }).click();
  await expect.poll(scale).toBeGreaterThan(fitted);
  const once = await scale();
  await stage(page).focus();
  await page.keyboard.press('+');
  // Each step is its own render: wait for the second one before reading it.
  await expect.poll(scale).toBeGreaterThan(once);
  expect(await scale()).toBeGreaterThan(fitted * 1.4);
  const img = stage(page).locator('img');
  const before = await img.evaluate(el => getComputedStyle(el).transform);
  const box = (await stage(page).boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 80, box.y + box.height / 2 - 120, { steps: 5 });
  await page.mouse.up();
  await expect.poll(() => img.evaluate(el => getComputedStyle(el).transform)).not.toBe(before);
  await page.getByRole('button', { name: 'Potrivește pe lățime' }).click();
  await expect.poll(scale).toBeCloseTo(fitWidth, 3);
  // Fitted, nothing is left to the right: the phone's drag hint fades out. Axe reads the colours once
  // the fade has ended (its easing dips to 0 and back before it settles; mid-fade the text is the page's colour).
  const hint = stage(page).getByText('Trage pentru a vedea tot clasamentul').locator('..');
  await expect.poll(() => hint.evaluate(el => el.getAnimations().length === 0 && getComputedStyle(el).opacity === '0')).toBe(true);
  await expectNoA11yViolations(page);
});

test('competition-page.imagine-clasament.c8 — from 768 the sheet is fitted at its own height (no inner scroll), on a paper edge, the zoom toolbar in the window; the wheel scrolls the page when the image cannot move', async ({ page }) => {
  for (const viewport of [DESKTOP, { width: 1280, height: 800 }, { width: 768, height: 900 }]) {
    await open(page, page$(ID.nc), viewport);
    await ready(page);
    await hydrated(page);
    const where = `${viewport.width}×${viewport.height}`;
    const toolbar = (await page.getByRole('toolbar', { name: 'Zoom' }).boundingBox())!;
    expect(toolbar.y + toolbar.height, where).toBeLessThanOrEqual(viewport.height);
    // The whole sheet at the column's width: the stage is the image's own height, nothing hidden under a fold.
    const { stageH, imgH, more, shadow } = await stage(page).evaluate(el => ({
      stageH: el.getBoundingClientRect().height,
      imgH: el.querySelector('img')!.getBoundingClientRect().height,
      more: el.getAttribute('data-more'),
      shadow: getComputedStyle(el).boxShadow,
    }));
    expect(Math.abs(stageH - imgH), where).toBeLessThan(2);
    expect(more, where).toBe('');
    expect(shadow, where).not.toBe('none');
  }
  // A fitted sheet (from 768 it takes its own height and the page scrolls it): nothing to pan, so
  // the wheel over it scrolls the page.
  await open(page, page$(ID.feeder), DESKTOP);
  await ready(page);
  await hydrated(page);
  const box = (await stage(page).boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, Math.min(box.y + box.height / 2, DESKTOP.height - 200));
  await page.mouse.wheel(0, 400);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  // Zoomed in, the wheel pans the image instead.
  await page.waitForTimeout(600); // the page's smooth scroll settles
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await page.getByRole('button', { name: 'Mărește' }).click();
  await page.getByRole('button', { name: 'Mărește' }).click();
  const img = stage(page).locator('img');
  const before = await img.evaluate(el => el.style.transform);
  // Over the part of the (taller than the window) sheet that is on screen.
  const after = (await stage(page).boundingBox())!;
  await page.mouse.move(after.x + after.width / 2, Math.min(after.y + after.height / 2, DESKTOP.height - 200));
  await page.mouse.wheel(0, 200);
  await expect.poll(() => img.evaluate(el => el.style.transform)).not.toBe(before);
  await page.waitForTimeout(600);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});

test('competition-page.imagine-clasament.c7 competition-page.imagine-clasament.s2 — generation failure: fish copy and «Înapoi»', async ({ page }) => {
  await page.route('**/clasament/imagine/png*', route => route.fulfill({ status: 500, contentType: 'application/json', body: '{"reason":"failed"}' }));
  await page.goto(`/concursuri/${ID.completed}`);
  await open(page, page$(ID.completed));
  const alert = page.getByRole('alert').filter({ hasText: 'Am întâmpinat o eroare!' });
  await expect(alert).toBeVisible();
  await expect(alert.getByRole('heading', { level: 2, name: 'Am întâmpinat o eroare!' })).toBeVisible();
  await expect(alert).toContainText('Nu s-a putut genera imaginea, dacă problema persistă vă rugăm să lăsați un feedback în aplicație.');
  // Nothing to save: no dead download / share actions beside the error.
  await expect(page.getByRole('button', { name: 'Descarcă clasamentul' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Distribuie clasamentul' })).toHaveCount(0);
  await expectNoA11yViolations(page);
  await expect
    .poll(() => alert.getByRole('button', { name: 'Înapoi' }).evaluate(el => Object.keys(el).some(k => k.startsWith('__reactProps'))), { timeout: 60_000 })
    .toBe(true);
  await alert.getByRole('button', { name: 'Înapoi' }).click();
  await expect(page).toHaveURL(new RegExp(`/concursuri/${ID.completed}$`));
});

test('competition-page.imagine-clasament.c7 — a failed generation retries in place: «Încearcă din nou», the attempt, then the image', async ({ page }) => {
  let fail = true;
  await page.route('**/clasament/imagine/png*', route => {
    if (fail) return route.fulfill({ status: 500, contentType: 'application/json', body: '{"reason":"failed"}' });
    return route.continue();
  });
  await open(page, page$(ID.completed));
  const alert = page.getByRole('alert').filter({ hasText: 'Am întâmpinat o eroare!' });
  const retry = alert.getByRole('button', { name: 'Încearcă din nou' });
  await expect(retry).toBeVisible({ timeout: 60_000 });
  await expect.poll(() => retry.evaluate(el => Object.keys(el).some(k => k.startsWith('__reactProps'))), { timeout: 60_000 }).toBe(true);
  await retry.click();
  // As the kit DetailRetry: a polite status says it failed again, the button stays (secondary).
  await expect(alert.getByRole('status')).toHaveText('Tot nu s-a putut genera imaginea.');
  fail = false;
  await alert.getByRole('button', { name: 'Încearcă din nou' }).click();
  await ready(page);
  await expect(page.getByRole('button', { name: 'Descarcă clasamentul' }).locator('visible=true')).toBeEnabled();
});

test('competition-page.imagine-clasament.c6 — a competition that has not started says so, decided on the server (no PNG request, no console error)', async ({ page }) => {
  const asked: string[] = [];
  page.on('request', r => void (r.url().includes('/clasament/imagine/png') && asked.push(r.url())));
  const errors = await open(page, page$(ID.upcoming), PHONE);
  const state = page.getByRole('heading', { level: 2, name: 'Concursul nu a început încă' });
  await expect(state).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText('Imaginea clasamentului apare după primul cântar.')).toBeVisible();
  // Not the «no weighing in the chosen table» copy: that would be false before the start.
  await expect(page.getByText('Imaginea apare după primul cântar al clasamentului ales.')).toHaveCount(0);
  // The way on, and no dead download / share actions.
  await expect(page.getByRole('link', { name: 'Înapoi la clasament' })).toHaveAttribute('href', `/concursuri/${ID.upcoming}`);
  await expect(page.getByRole('button', { name: 'Descarcă clasamentul' })).toHaveCount(0);
  // The phone names the competition (the eyebrow is hidden below 768).
  await expect(page.getByText('SIM3 Cupa C&B Ed 8', { exact: true }).locator('visible=true')).toBeVisible();
  await expectNoA11yViolations(page);
  expect(asked).toEqual([]);
  expect(errors).toEqual([]);
});

test('competition-page.imagine-clasament.c6 — the competition is gone after the page rendered: «Concursul nu mai există», the way to the list', async ({ page }) => {
  await page.route('**/clasament/imagine/png*', route => route.fulfill({ status: 404, contentType: 'application/json', body: '{"reason":"missing"}' }));
  await open(page, page$(ID.completed));
  await expect(page.getByRole('heading', { level: 2, name: 'Concursul nu mai există' })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole('link', { name: 'Vezi concursurile' })).toHaveAttribute('href', '/concursuri');
  await expect(page.getByText('Imaginea apare după primul cântar')).toHaveCount(0);
});

test('competition-page.imagine-clasament.s4 — no sponsors: the sheet ends with the totals (no sponsor band)', async ({ page, request }) => {
  const cms = await request.get(`http://localhost:1337/api/feed/competitions/${ID.completed}`);
  expect(((await cms.json()) as { data: { sponsors: unknown[] } }).data.sponsors).toEqual([]);
  await open(page, page$(ID.completed));
  // The page plans the sheet with the sponsors it has (none); the PNG drawn is exactly that size.
  const planned = await page.locator('[data-sheet]').locator('visible=true').getAttribute('data-sheet');
  const res = await request.get(png$(ID.completed), { timeout: 90_000 });
  const size = pngSize(await res.body());
  expect(`${size.width}x${size.height}`).toBe(planned);
});

test('competition-page.imagine-clasament.c6 — an unknown competition: the not-found page (soft 404 + noindex, as /concursuri/[id]); the PNG answers 404', async ({ page, request }) => {
  // loading.tsx commits the 200 before the read (ROADMAP §8 «Production 404s»), as on the competition page.
  await page.goto(page$('nu-exista-concursul'));
  await expect(page.getByRole('heading', { name: 'Concursul nu a fost găsit' })).toBeVisible({ timeout: 45_000 });
  await expect(page.locator('meta[name="robots"][content*="noindex"]').first()).toBeAttached();
  expect((await request.get(png$('nu-exista-concursul'))).status()).toBe(404);
});

test('competition-page.imagine-clasament.c10 competition-page.imagine-clasament.s5 — opened from «Clasament complet» with the table in the URL; a reload rebuilds it', async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await page.addInitScript(() => {
    (window as unknown as { __events: unknown[] }).__events = [];
    window.addEventListener('bluvi:analytics', e => (window as unknown as { __events: unknown[] }).__events.push((e as CustomEvent).detail));
  });
  await page.goto(`/concursuri/${ID.feeder}`, { waitUntil: 'domcontentloaded' });
  const legs = page.getByRole('radiogroup', { name: 'Manșa clasamentului' }).locator('visible=true').first();
  const leg2 = legs.getByRole('radio', { name: 'Manșa 2', exact: true });
  await expect
    .poll(() => leg2.evaluate(el => Object.keys(el).some(k => k.startsWith('__reactProps'))), { timeout: 60_000 })
    .toBe(true);
  await legs.getByText('Manșa 2', { exact: true }).click();
  await page.getByRole('button', { name: 'Clasament complet' }).locator('visible=true').first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('link', { name: 'Imagine clasament' }).click();
  await expect(page).toHaveURL(new RegExp(`/concursuri/${ID.feeder}/clasament/imagine\\?mansa=2$`));
  expect((await events(page)).map((e: { name: string }) => e.name)).toContain('ranking_image_pressed');
  await expect(page.getByRole('heading', { level: 1, name: 'Imagine clasament' })).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText('Manșa 2', { exact: true }).locator('visible=true').first()).toBeVisible();
  await ready(page);
  await page.reload();
  await expect(page.getByText('Manșa 2', { exact: true }).locator('visible=true').first()).toBeVisible({ timeout: 45_000 });
  await ready(page);
});

test('competition-page.imagine-clasament.s1 — while the competition is read: the image page own skeleton first (its h1, the stage frame), never the competition shell', async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  // Warm the route (dev compiles on the first request), then hold the competition read.
  await page.request.get(`${BASE}${page$(ID.completed)}`);
  await faults(page, ID.completed, ['competition-slow']);
  try {
    void page.goto(page$(ID.completed), { waitUntil: 'commit' }).catch(() => {});
    const busy = page.locator('[aria-busy="true"]');
    await expect(busy.getByRole('heading', { level: 1, name: 'Imagine clasament' })).toBeVisible({ timeout: 3000 });
    await expect(busy.locator('[style*="--ratio"]')).toBeVisible();
    await expect(busy.getByRole('toolbar', { name: 'Zoom' })).toBeVisible();
    // The competition page's skeleton (its «Concurs» h1 and tabs) never shows here.
    await expect(page.getByRole('heading', { level: 1, name: 'Concurs', exact: true }).locator('visible=true')).toHaveCount(0);
    const loading = (await busy.getByRole('heading', { level: 1 }).boundingBox())!;
    // Then the page: the same h1 in the same place (no layout shift).
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 30_000 });
    const loaded = (await page.getByRole('heading', { level: 1, name: 'Imagine clasament' }).boundingBox())!;
    expect(Math.abs(loaded.y - loading.y)).toBeLessThan(2);
  } finally {
    await faults(page, ID.completed, []);
  }
});

test('competition-page.imagine-clasament.s1 competition-page.imagine-clasament.c6 — the competition read fails: the error card, «Încearcă din nou», the attempt; no console error', async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  // The boundary logs the error it shows (error.tsx); everything else is a defect.
  const errors = collectConsoleErrors(page, { ignore: /e2e fault|Failed to load resource/ });
  await faults(page, ID.completed, ['competition']);
  try {
    await page.goto(page$(ID.completed), { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Concursul nu a putut fi afișat' })).toBeVisible({ timeout: 45_000 });
    const retry = page.getByRole('button', { name: 'Încearcă din nou' });
    await expect.poll(() => retry.evaluate(el => Object.keys(el).some(k => k.startsWith('__reactProps'))), { timeout: 60_000 }).toBe(true);
    await retry.click();
    await expect(page.getByText('Tot nu s-a putut încărca. Încercarea 2.')).toBeVisible({ timeout: 30_000 });
    await expectNoA11yViolations(page);
    expect(errors).toEqual([]);
  } finally {
    await faults(page, ID.completed, []);
  }
});

test('competition-page.imagine-clasament.c6 competition-page.imagine-clasament.s2 — the ranking read streams in under the band: the stage skeleton first, then the planned sheet', async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await page.request.get(`${BASE}${page$(ID.feeder)}`);
  await faults(page, ID.feeder, ['ranking-slow']);
  try {
    void page.goto(page$(ID.feeder), { waitUntil: 'commit' }).catch(() => {});
    // The band is the loaded one (the competition is known); the stage waits for the plan.
    await expect(page.getByText('Clasament general', { exact: true }).locator('visible=true')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('[data-sheet]')).toHaveCount(0);
    await expect(page.getByText('Se generează imaginea…').locator('visible=true')).toBeVisible();
    await expect(page.locator('[data-sheet]').locator('visible=true')).toHaveCount(1, { timeout: 30_000 });
  } finally {
    await faults(page, ID.feeder, []);
  }
  await ready(page);
});

test('competition-page.imagine-clasament.c7 competition-page.imagine-clasament.s2 — a PNG that takes longer than the page waits fails with fish copy (the timeout path)', async ({ page }) => {
  await page.clock.install();
  await page.route('**/clasament/imagine/png*', () => {
    // Never answered: only the page's own bound ends the wait.
  });
  await open(page, page$(ID.completed));
  await expect(page.getByText('Se generează imaginea…').locator('visible=true')).toBeVisible();
  await page.clock.runFor(10_000);
  await expect(page.getByText('Durează mai mult decât de obicei…')).toBeVisible();
  await page.clock.runFor(55_000);
  await expect(page.getByRole('alert').getByRole('heading', { level: 2, name: 'Am întâmpinat o eroare!' })).toBeVisible();
});

test('competition-page.imagine-clasament.c10 competition-page.imagine-clasament.c2 — the URL names a table that does not exist: an unknown NC sector is the club table, named so; a leg past the last one says so', async ({ page, request }) => {
  await open(page, page$(ID.nc, '?sector=Z'));
  // The band names what is drawn (the club table), never «Sector Z»; the canonical and the PNG drop the sector.
  await expect(page.getByText('Clasament pe cluburi', { exact: true }).locator('visible=true')).toBeVisible();
  await expect(page.getByText('Sector Z')).toHaveCount(0);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', new RegExp(`/concursuri/${ID.nc}/clasament/imagine$`));
  const png = await request.get(png$(ID.nc, '?sector=Z'), { timeout: 90_000 });
  expect(png.headers()['x-ranking-image']).toBe('cn');
  // A standard ranking ignores the NC order: no duplicate canonical for it.
  await open(page, page$(ID.completed, '?sortare=club&sector=A'));
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', new RegExp(`/concursuri/${ID.completed}/clasament/imagine$`));
  await open(page, page$(ID.feeder, '?mansa=9'));
  await expect(page.getByRole('heading', { level: 2, name: 'Clasamentul ales nu există' })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText('Imaginea apare după primul cântar')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Vezi clasamentul general' })).toHaveAttribute('href', `/concursuri/${ID.feeder}/clasament/imagine`);
});

test('competition-page.imagine-clasament.c9 — a shared link previews the image only when there is one (og:image), never a JSON answer', async ({ page }) => {
  await open(page, page$(ID.completed));
  await expect(page.locator('meta[property="og:image"]').first()).toHaveAttribute('content', new RegExp(`/concursuri/${ID.completed}/clasament/imagine/png$`));
  await open(page, page$(ID.upcoming));
  const og = page.locator('meta[property="og:image"]');
  const count = await og.count();
  for (let i = 0; i < count; i++) expect(await og.nth(i).getAttribute('content')).not.toContain('/clasament/imagine/png');
});

test('competition-page.imagine-clasament.c8 competition-page.imagine-clasament.c5 — the image in words for screen readers, and the way to the table', async ({ page }) => {
  await open(page, page$(ID.completed));
  await ready(page);
  const described = await stage(page).getAttribute('aria-describedby');
  expect(described).toBeTruthy();
  const summary = page.locator(`[id="${described}"]`);
  await expect(summary).toContainText('Clasament complet, după stand');
  await expect(summary).toContainText('locul 1:');
  await expect(summary).toContainText('Cantitate totală');
  await expect(page.getByRole('link', { name: 'Vezi clasamentul ca tabel' })).toHaveAttribute('href', `/concursuri/${ID.completed}`);
  await expectNoA11yViolations(page);
});

test('competition-page.imagine-clasament.c8 — the phone opens on the table\'s first columns (Stand, Participant), under the sheet\'s top margin, with the edges that continue faded and a one-time drag hint', async ({ page }) => {
  await open(page, page$(ID.feeder), PHONE);
  await ready(page);
  await hydrated(page);
  const img = stage(page).locator('img');
  await expect.poll(async () => Number(await stage(page).getAttribute('data-fit'))).toBeGreaterThan(0);
  const tableX = Number(await stage(page).getAttribute('data-table-x'));
  expect(tableX, 'the table is centred on a sheet wider than it (its left edge is not the sheet\'s)').toBeGreaterThan(0);
  const { x, y, scale, boxW } = await img.evaluate(el => {
    const m = /translate\((-?[\d.]+)px, (-?[\d.]+)px\) scale\(([\d.]+)\)/.exec(el.style.transform)!;
    return { x: Number(m[1]), y: Number(m[2]), scale: Number(m[3]), boxW: el.parentElement!.clientWidth };
  });
  // The table's left edge (its Stand column, then Participant) is in view, a few px in from the
  // stage's: the first view names who is ranked, the drag hint invites panning right to the numbers.
  const tableLeft = x + tableX * scale;
  expect(tableLeft).toBeGreaterThanOrEqual(0);
  expect(tableLeft).toBeLessThan(16);
  // The participant column starts well inside the stage (stand 80–180 sheet px, ×1.5 ×scale).
  expect(tableLeft + 180 * 1.5 * scale).toBeLessThan(boxW / 2);
  // The top margin skipped.
  expect(y).toBeLessThan(0);
  await expect(stage(page)).toHaveAttribute('data-more', /right/);
  await expect(stage(page)).toHaveAttribute('data-more', /left/);
  // The chip's wrapper fades (opacity), the chip itself stays as drawn.
  const hint = page.getByText('Trage pentru a vedea tot clasamentul').locator('..');
  await expect(hint).toHaveCSS('opacity', '1');
  const box = (await stage(page).boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.up();
  await expect(hint).toHaveCSS('opacity', '0');
  // The toolbar sits at the window's bottom, the same place for every ranking.
  const toolbar = (await page.getByRole('toolbar', { name: 'Zoom' }).boundingBox())!;
  expect(PHONE.height - (toolbar.y + toolbar.height)).toBeLessThan(40);
});
