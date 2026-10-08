import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { partideHrefs } from '@/lib/partide-pages';
import { routes } from '@/lib/routes';
import { expectNoA11yViolations } from './helpers/a11y';
import { collectConsoleErrors } from './helpers/console';
import { qaJwt, signIn } from './helpers/session';
import { aCatch, aleMeleRows, catchesPage, mockMine } from './partide-ale-mele.fixtures';

/*
 * «Capturile mele» (/partide/capturile-mele) — parity docs/parity/areas/partide.yml
 * partide.capturile-mele c1–c4. fish: app/(app)/partide/capturi.tsx,
 * features/partide/screens/MyCatchesGalleryScreen.tsx, components/community/MasonryPhotoList.tsx,
 * components/ShareCatchSheet.tsx, services/queries/useMyCatches.ts.
 *
 * The QA user's catches are route-mocked at /api/cms (/feed/sessions/mine/catches, the Ale mele
 * mocks: catch 1 is a competition catch, «Cupa Toamnei»). Nothing is created or written anywhere —
 * no CMS write, no Firestore (the shared fake aborts and records every Firebase request: asserted
 * empty).
 */

test.setTimeout(120_000);
test.use({ locale: 'ro-RO', timezoneId: 'Europe/Bucharest' });

const PHONE = { width: 375, height: 812 };
const DESKTOP = { width: 1440, height: 900 };
const PAGE = routes.myCatches();

async function signedIn(context: BrowserContext, page: Page) {
  await signIn(context, await qaJwt(page.request));
}

async function open(page: Page, viewport = PHONE, path = PAGE) {
  await page.setViewportSize(viewport);
  await page.goto(path);
}

const grid = (page: Page) => page.getByTestId('my-catches-grid');
const tiles = (page: Page) => grid(page).getByRole('button');

const TWO_PAGES = { first: catchesPage(0, 20, 25, 'c2'), c2: catchesPage(20, 5, 25, null) };

test('signed out → sign-in, back to «Capturile mele»', async ({ page }) => {
  await page.goto(PAGE);
  await expect(page).toHaveURL(/\/intra\?next=/);
  expect(new URL(page.url()).searchParams.get('next')).toBe(PAGE);
});

/** A session cookie the server cannot send as a bearer (invalid header byte): /users/me throws → «unknown» (acasa.spec's UNREADABLE_SESSION). */
const UNREADABLE_SESSION = '%C8%99abc';

test('dead cookie (the CMS refuses it) → requireViewer sends to sign-in, back to «Capturile mele»', async ({ page, baseURL }) => {
  await page.context().addCookies([{ name: 'bluvi_session', value: 'dead-token', url: baseURL ?? 'http://localhost:3120' }]);
  await page.goto(PAGE);
  await expect(page).toHaveURL(/\/intra\?next=/);
  expect(new URL(page.url()).searchParams.get('next')).toBe(PAGE);
  await expect(page.getByRole('heading', { level: 1, name: 'Capturile mele' })).toHaveCount(0);
});

test('unreadable session → error.tsx «Serverul nu răspunde», the header, retry focused, never a sign-in form', async ({ page, baseURL }) => {
  test.slow();
  const errors = collectConsoleErrors(page, { ignore: [/session unknown|Session unknown|\[partide\/capturile-mele\]/] });
  await page.context().addCookies([{ name: 'bluvi_session', value: UNREADABLE_SESSION, url: baseURL ?? 'http://localhost:3120' }]);
  await page.setViewportSize(PHONE);
  await page.goto(PAGE);
  await expect(page).toHaveURL(PAGE);
  await expect(page.getByText('Serverul nu răspunde')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('heading', { level: 1, name: 'Capturile mele' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Încearcă din nou' })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Închide capturile' })).toBeVisible();
  // Never a sign-in form, never the gallery.
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  await expect(page.getByRole('main').getByText(/Intră în cont|Conectează-te/)).toHaveCount(0);
  await expect(page.getByTestId('my-catches-body')).toHaveCount(0);
  await expectNoA11yViolations(page);
  expect(errors).toEqual([]);
});

test('c1 — «Capturile mele», «25 de capturi», a close control (→ Ale mele without history); noindex, accessible', async ({ page, context }) => {
  const errors = collectConsoleErrors(page);
  await signedIn(context, page);
  const { hits } = await mockMine(page, { rows: [], catches: TWO_PAGES });
  await open(page);
  await expect(page.getByRole('heading', { level: 1, name: 'Capturile mele' })).toBeVisible();
  await expect(page.getByTestId('my-catches-subtitle')).toHaveText('25 de capturi');
  await expect(page).toHaveTitle(/Capturile mele/);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await expect(tiles(page).first()).toBeVisible();
  await expectNoA11yViolations(page);
  await page.setViewportSize(DESKTOP);
  await expectNoA11yViolations(page);
  // Opened directly (no in-app history): the close control goes to Ale mele.
  await page.getByRole('button', { name: 'Închide capturile' }).click();
  await expect(page).toHaveURL(routes.partideMine());
  expect(hits.firebase).toEqual([]);
  expect(errors).toEqual([]);
});

test('c1 — one catch: «1 captură»', async ({ page, context }) => {
  await signedIn(context, page);
  await mockMine(page, { rows: [], catches: { first: catchesPage(0, 1, 1, null) } });
  await open(page);
  await expect(page.getByTestId('my-catches-subtitle')).toHaveText('1 captură');
  await expect(tiles(page)).toHaveCount(1);
});

test('Ale mele «Vezi tot» opens the gallery, and its close control comes back', async ({ page, context }) => {
  await signedIn(context, page);
  await mockMine(page, { rows: [aleMeleRows().F1], catches: TWO_PAGES });
  await open(page, PHONE, routes.partideMine());
  expect(partideHrefs.myCatches()).toBe(PAGE);
  await page.getByTestId('my-catches-see-all').click();
  await expect(page).toHaveURL(PAGE);
  await expect(page.getByRole('heading', { level: 1, name: 'Capturile mele' })).toBeVisible();
  await page.getByRole('button', { name: 'Închide capturile' }).click();
  await expect(page).toHaveURL(routes.partideMine());
});

test('c2 — my feed only, masonry of every photo deduplicated by key, the next page at the end', async ({ page, context }) => {
  const errors = collectConsoleErrors(page);
  await signedIn(context, page);
  // Page 2 repeats the last row of page 1 (a cursor boundary): it is shown once.
  const second = catchesPage(20, 5, 25, null);
  second.data.unshift(aCatch(19));
  const { hits } = await mockMine(page, { rows: [], catches: { first: TWO_PAGES.first, c2: second } });
  await open(page);
  await expect(tiles(page)).toHaveCount(20);
  expect(hits.catches).toBe(1);
  expect(hits.profileCatches).toBe(0);
  // Two columns on a phone (fish MasonryPhotoList).
  await expect(grid(page)).toHaveAttribute('data-columns', '2');
  // A tile: the catch signature (kg on the navy chip) and the species; its name says the venue.
  await expect(tiles(page).nth(0)).toHaveAccessibleName('Deschide captura: 4,0 kg, Crap, Balta Chita');
  await expect(tiles(page).nth(1)).toHaveAccessibleName('Deschide captura: 5,0 kg, Balta Chita, Cupa Toamnei');
  await expect(tiles(page).nth(0)).toHaveAttribute('data-kind', 'partida');
  await expect(tiles(page).nth(1)).toHaveAttribute('data-kind', 'competition');
  // Scrolling to the end asks for the next page; 25 distinct catches, never 26.
  await tiles(page).last().scrollIntoViewIfNeeded();
  await page.mouse.wheel(0, 4000);
  await expect.poll(() => hits.catches).toBe(2);
  await expect(tiles(page)).toHaveCount(25);
  const names = await tiles(page).evaluateAll(els => els.map(e => e.getAttribute('aria-label')));
  expect(names.length).toBe(25);
  // Nothing more to load: no third read.
  await page.mouse.wheel(0, 4000);
  await page.waitForTimeout(500);
  expect(hits.catches).toBe(2);
  // Desktop: the full width, more columns as it grows (owner rule 5).
  await page.setViewportSize(DESKTOP);
  await expect.poll(async () => Number(await grid(page).getAttribute('data-columns'))).toBeGreaterThanOrEqual(5);
  await page.setViewportSize({ width: 1920, height: 1000 });
  await expect.poll(async () => Number(await grid(page).getAttribute('data-columns'))).toBeGreaterThanOrEqual(7);
  expect(hits.firebase).toEqual([]);
  expect(errors).toEqual([]);
});

test('c3 — empty: «Nicio captură cu fotografie încă.», no count', async ({ page, context }) => {
  const errors = collectConsoleErrors(page);
  await signedIn(context, page);
  await mockMine(page, { rows: [], catches: {} });
  await open(page);
  await expect(page.getByTestId('my-catches-empty')).toContainText('Nicio captură cu fotografie încă.');
  await expect(page.getByTestId('my-catches-subtitle')).toHaveCount(0);
  await expect(grid(page)).toHaveCount(0);
  await expectNoA11yViolations(page);
  expect(errors).toEqual([]);
});

test('c3 — loading: the masonry skeleton, then the photos', async ({ page, context }) => {
  await signedIn(context, page);
  await mockMine(page, { rows: [] });
  let release!: () => void;
  const gate = new Promise<void>(r => (release = r));
  await page.route(/\/api\/cms\/feed\/sessions\/mine\/catches/, async route => {
    await gate;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(catchesPage(0, 4, 4, null)) });
  });
  await open(page);
  await expect(page.getByTestId('my-catches-body').getByTestId('masonry-skeleton')).toBeVisible();
  await expect(page.getByTestId('my-catches-subtitle')).toHaveCount(0);
  release();
  await expect(tiles(page)).toHaveCount(4);
  await expect(page.getByTestId('my-catches-subtitle')).toHaveText('4 capturi');
});

test('c3 — a failed first read is an error card with a retry, never an empty gallery', async ({ page, context }) => {
  await signedIn(context, page);
  await mockMine(page, { rows: [] });
  let fail = true;
  await page.route(/\/api\/cms\/feed\/sessions\/mine\/catches/, route =>
    fail
      ? route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":{"status":500}}' })
      : route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(catchesPage(0, 3, 3, null)) }),
  );
  await open(page);
  await expect(page.getByText('Capturile nu s-au putut încărca.')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('my-catches-empty')).toHaveCount(0);
  fail = false;
  await page.getByRole('button', { name: 'Încearcă din nou' }).click();
  await expect(tiles(page)).toHaveCount(3);
});

test('c4 — a photo opens the lightbox with CatchDetailFooter; it pages on; share opens the Bluvi card with the competition', async ({ page, context }) => {
  const errors = collectConsoleErrors(page);
  await signedIn(context, page);
  const { hits } = await mockMine(page, { rows: [], catches: TWO_PAGES });
  await open(page, DESKTOP);
  await tiles(page).nth(1).click();
  const box = page.getByRole('dialog', { name: 'Captura 2 din 25' });
  await expect(box).toBeVisible();
  const footer = box.getByTestId('catch-detail-footer');
  await expect(footer).toContainText('5,0kg');
  await expect(footer).toContainText('Balta Chita');
  await expect(footer).toContainText('Cupa Toamnei');
  await expect(footer).toContainText('19 sep 2026');
  await expectNoA11yViolations(page);
  // Reaching the last loaded catch asks for the next page.
  for (let i = 2; i < 20; i++) await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('dialog', { name: 'Captura 20 din 25' })).toBeVisible();
  await expect.poll(() => hits.catches).toBe(2);
  await expect(page.getByRole('button', { name: 'Fotografia următoare' })).not.toHaveAttribute('aria-disabled', 'true');
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('dialog', { name: 'Captura 21 din 25' })).toBeVisible();
  // Back to the competition catch; share: the lightbox closes, the composed card opens.
  for (let i = 21; i > 2; i--) await page.keyboard.press('ArrowLeft');
  const two = page.getByRole('dialog', { name: 'Captura 2 din 25' });
  await expect(two).toBeVisible();
  await two.getByRole('button', { name: 'Distribuie captura' }).click();
  await expect(page.getByRole('dialog', { name: /Captura/ })).toHaveCount(0);
  const sheet = page.getByRole('dialog', { name: 'Distribuie captura' });
  await expect(sheet).toBeVisible();
  const card = sheet.getByRole('img', { name: /^Imaginea care se distribuie/ });
  await expect(card).toHaveAttribute('aria-label', 'Imaginea care se distribuie: Balta Chita · Cupa Toamnei · 5,0 kg · 19 sep 2026');
  await expect(sheet.getByRole('group', { name: 'Ce să apară pe poză' }).getByRole('button')).toHaveText(['Greutate', 'Baltă', 'Data', 'Competiție']);
  await expect(sheet.getByRole('button', { name: 'Distribuie', exact: true })).toBeEnabled();
  // The sheet's entrance (opacity) settled before axe reads the colours.
  await sheet.evaluate(el => Promise.all(el.getAnimations({ subtree: true }).map(a => a.finished)));
  await page.waitForTimeout(300);
  await expectNoA11yViolations(page);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // A partidă catch: no «Competiție» switch, the venue on the card.
  await tiles(page).nth(0).click();
  await page.getByRole('dialog', { name: 'Captura 1 din 25' }).getByRole('button', { name: 'Distribuie captura' }).click();
  const sheet2 = page.getByRole('dialog', { name: 'Distribuie captura' });
  await expect(sheet2.getByRole('img', { name: /^Imaginea care se distribuie/ })).toHaveAttribute(
    'aria-label',
    'Imaginea care se distribuie: Balta Chita · 4,0 kg · Crap · 20 sep 2026',
  );
  await expect(sheet2.getByRole('button', { name: 'Competiție' })).toHaveCount(0);
  expect(hits.firebase).toEqual([]);
  expect(errors).toEqual([]);
});

test('keyboard — Tab reaches a tile, Enter opens the lightbox, Escape returns', async ({ page, context }) => {
  await signedIn(context, page);
  await mockMine(page, { rows: [], catches: { first: catchesPage(0, 4, 4, null) } });
  await open(page);
  await expect(tiles(page)).toHaveCount(4);
  await tiles(page).nth(0).focus();
  await page.keyboard.press('Tab');
  await expect(tiles(page).nth(1)).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Captura 2 din 4' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

// Owner rule 5 on the beginner's gallery (1–4 catches) at ≥1280: the grid spans the band, or sits
// centred under the header — never a ~1100px strip on the left of a 1920 page. The cap lives in the
// shared Masonry (app/(site)/balti/[id]/_sub/Masonry.tsx capOf / WIDE_PX), not owned here: raised with
// the lake gallery's owner; un-fixme with that change.
test.fixme('few photos at 1920: the masonry fills the band or is centred in it', async ({ page, context }) => {
  await signedIn(context, page);
  await mockMine(page, { rows: [], catches: { first: catchesPage(0, 4, 4, null) } });
  await open(page, { width: 1920, height: 1000 });
  await expect(tiles(page)).toHaveCount(4);
  const band = (await page.getByTestId('my-catches-body').boundingBox())!;
  const g = (await grid(page).boundingBox())!;
  const fills = g.width >= band.width * 0.9;
  const centred = Math.abs(g.x - band.x - (band.x + band.width - (g.x + g.width))) <= 2;
  expect(fills || centred).toBe(true);
});
