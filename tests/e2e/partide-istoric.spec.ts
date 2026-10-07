import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { routes } from '@/lib/routes';
import { expectNoA11yViolations } from './helpers/a11y';
import { collectConsoleErrors } from './helpers/console';
import { qaJwt, signIn } from './helpers/session';
import { mockMine } from './partide-ale-mele.fixtures';
import { historyRows, manyRows } from './partide-istoric.fixtures';

/*
 * «Istoric partide» (/partide/istoric) — parity docs/parity/areas/partide.yml partide.istoric c1–c8.
 * fish: app/(app)/partide/istoric.tsx, components/community/VenueFilterScreen.tsx,
 * helpers/{historyView,history}.ts, domain/viewAtoms.ts.
 *
 * The QA user's own list is mocked at /api/cms (/feed/sessions/mine, ./partide-istoric.fixtures via
 * the Ale mele mocks). Nothing is created or written anywhere — no CMS write, no Firestore (the
 * shared fake aborts and records every Firebase request: asserted empty).
 */

test.setTimeout(120_000);
test.use({ locale: 'ro-RO', timezoneId: 'Europe/Bucharest' });

const PHONE = { width: 375, height: 812 };
const DESKTOP = { width: 1440, height: 900 };
const PAGE = routes.partideHistory();

const R = historyRows();

async function signedIn(context: BrowserContext, page: Page) {
  await signIn(context, await qaJwt(page.request));
}

async function open(page: Page, viewport = PHONE, path = PAGE) {
  await page.setViewportSize(viewport);
  await page.goto(path);
}

const cards = (page: Page) => page.getByTestId('history-body').getByTestId('own-card');

/** The card titles (the venue), in document order. */
const titles = (page: Page) =>
  cards(page).evaluateAll(els => els.map(e => e.querySelector('header > span:last-child > :first-child')?.textContent?.trim() ?? ''));

const monthHeaders = (page: Page) => page.getByTestId('history-month').getByRole('heading', { level: 2 });

const chip = (page: Page, name: string | RegExp) => page.getByRole('group', { name: 'Filtre istoric' }).getByRole('button', { name });

test('signed out → sign-in, back to the history with its filters', async ({ page }) => {
  await page.goto(routes.partideHistory({ byWeight: true, withCaptures: true }));
  await expect(page).toHaveURL(/\/intra\?next=/);
  const next = new URL(page.url()).searchParams.get('next');
  expect(next).toBe('/partide/istoric?sortare=greutate&cu-capturi=1');
});

test('c1 — title «Istoric partide» with back; chips «Greutate», «Baltă», «Cu capturi»; noindex, accessible', async ({ page, context }) => {
  const errors = collectConsoleErrors(page);
  await signedIn(context, page);
  const { hits } = await mockMine(page, { rows: R.ALL });
  await open(page);
  await expect(page.getByRole('heading', { level: 1, name: 'Istoric partide' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Înapoi' })).toBeVisible();
  await expect(chip(page, 'Greutate')).toHaveAttribute('aria-pressed', 'false');
  await expect(chip(page, 'Baltă')).toBeVisible();
  await expect(chip(page, 'Cu capturi')).toHaveAttribute('aria-pressed', 'false');
  await expect(cards(page).first()).toBeVisible();
  await expect(page).toHaveTitle(/Istoric partide/);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await expectNoA11yViolations(page);
  await page.setViewportSize(DESKTOP);
  await expectNoA11yViolations(page);
  // Back without in-app history: Ale mele.
  await page.getByRole('button', { name: 'Înapoi' }).click();
  await expect(page).toHaveURL(routes.partideMine());
  expect(hits.firebase).toEqual([]);
  expect(errors).toEqual([]);
});

test('Ale mele «Vezi tot» opens the history', async ({ page, context }) => {
  await signedIn(context, page);
  await mockMine(page, { rows: R.ALL });
  await open(page, PHONE, routes.partideMine());
  await page.getByRole('link', { name: 'Vezi tot istoricul partidelor' }).click();
  await expect(page).toHaveURL(PAGE);
  await expect(page.getByRole('heading', { level: 1, name: 'Istoric partide' })).toBeVisible();
});

test('c2 — only finished partide, grouped by month (newest first), newest first inside; sticky month labels stay attached', async ({ page, context }) => {
  const errors = collectConsoleErrors(page);
  await signedIn(context, page);
  await mockMine(page, { rows: R.ALL });
  await open(page);
  await expect(monthHeaders(page)).toHaveText(['SEPTEMBRIE 2026', 'AUGUST 2026', 'IULIE 2026', 'MAI 2026']);
  await expect.poll(() => titles(page)).toEqual(['Balta Chita', 'Lacul Snagov', 'Balta Dridu', 'Balta Chita', 'Dunărea', 'Ălești']);
  // The open partidă is never listed.
  await expect(page.getByTestId('own-card-live')).toHaveCount(0);
  await expect(page.getByText('Balta Deschisă')).toHaveCount(0);
  const sep = page.getByTestId('history-month').nth(0);
  await expect(sep.getByTestId('own-card')).toHaveCount(2);

  // Owner rule 3 — scroll into August: its label sticks to the top edge (under the bar, or at 0
  // once the phone's bar slid away), never floating, and casts the stack's shadow.
  const aug = page.getByTestId('history-month').nth(1);
  await aug.getByTestId('own-card').nth(1).scrollIntoViewIfNeeded();
  await page.mouse.wheel(0, 120);
  await page.waitForTimeout(500);
  const label = aug.getByRole('heading', { level: 2 });
  await expect(label).toHaveAttribute('data-pinned', 'true');
  const y = (await label.boundingBox())!.y;
  const barConcealed = await page.evaluate(() => document.documentElement.hasAttribute('data-bar-concealed'));
  expect(Math.round(y)).toBe(barConcealed ? 0 : 56);
  await expect(page.locator('html')).toHaveAttribute('data-stack-pinned', '');

  // Desktop (a short window, so the page scrolls that far): under the 64px bar.
  await page.setViewportSize({ width: 1440, height: 500 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(200);
  // The August section's top 100px above the bar's bottom edge: its label is stuck there.
  await aug.evaluate(el => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 64 + 100));
  await page.waitForTimeout(500);
  expect(Math.round((await label.boundingBox())!.y)).toBe(64);
  await expect(label).toHaveAttribute('data-pinned', 'true');
  expect(errors).toEqual([]);
});

test('c3 — «Greutate» switches to one flat list by record kg, descending; in the URL', async ({ page, context }) => {
  await signedIn(context, page);
  await mockMine(page, { rows: R.ALL });
  await open(page);
  await chip(page, 'Greutate').click();
  await expect(chip(page, 'Greutate')).toHaveAttribute('aria-pressed', 'true');
  await expect(page).toHaveURL(/\?sortare=greutate$/);
  await expect(page.getByTestId('history-weight')).toBeVisible();
  await expect(page.getByTestId('history-month')).toHaveCount(0);
  // 15,6 · 12,35 · 8,4 · 4 · then the two without a weight (0), in their list order.
  await expect.poll(() => titles(page)).toEqual(['Dunărea', 'Balta Chita', 'Lacul Snagov', 'Balta Chita', 'Balta Dridu', 'Ălești']);
  await chip(page, 'Greutate').click();
  await expect(page).toHaveURL(PAGE);
  await expect(page.getByTestId('history-month')).toHaveCount(4);
});

test('c4 — «Filtrează după baltă»: multi-select over the finished partide venues (ro order, helpers), applied by name', async ({ page, context }) => {
  const errors = collectConsoleErrors(page);
  await signedIn(context, page);
  await mockMine(page, { rows: R.ALL });
  await open(page);
  await chip(page, 'Baltă').click();
  const dialog = page.getByRole('dialog', { name: 'Filtrează după baltă' });
  await expect(dialog).toBeVisible();
  const options = dialog.getByTestId('venue-multi-option');
  // ro collation: «Ă» after «A», before «B»; the open partidă's venue is not offered.
  await expect(options).toHaveCount(5);
  await expect(options.locator('span.t-body')).toHaveText(['Ălești', 'Balta Chita', 'Balta Dridu', 'Dunărea', 'Lacul Snagov']);
  // Helper: the locality, else «{n} partidă / partide».
  await expect(options.nth(1)).toContainText('Ilfov');
  await expect(options.nth(2)).toContainText('1 partidă');
  await expect(dialog.getByTestId('venue-draft-count')).toHaveText('Nicio baltă selectată');
  await expectNoA11yViolations(page);

  // Search is local and diacritic-insensitive.
  await dialog.getByRole('textbox', { name: 'Caută o baltă' }).fill('alesti');
  await expect(options).toHaveCount(1);
  await dialog.getByRole('textbox', { name: 'Caută o baltă' }).fill('');

  await options.filter({ hasText: 'Balta Chita' }).click();
  await options.filter({ hasText: 'Lacul Snagov' }).click();
  await expect(options.filter({ hasText: 'Balta Chita' })).toHaveAttribute('aria-checked', 'true');
  await expect(dialog.getByTestId('venue-draft-count')).toHaveText('2 selectate');
  await dialog.getByRole('button', { name: 'Aplică (2)' }).click();
  await expect(dialog).toBeHidden();
  await expect(chip(page, /Baltă: 2 bălți/)).toBeVisible();
  await expect.poll(() => titles(page)).toEqual(['Balta Chita', 'Lacul Snagov', 'Balta Chita']);
  await expect(page).toHaveURL(/balti=Balta\+Chita&balti=Lacul\+Snagov/);

  // Closing with the X discards the draft.
  await chip(page, /Baltă/).click();
  await dialog.getByRole('button', { name: 'Golește filtrele' }).click();
  await expect(dialog.getByTestId('venue-draft-count')).toHaveText('Nicio baltă selectată');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(chip(page, /Baltă: 2 bălți/)).toBeVisible();

  // One venue: the chip names it.
  await chip(page, /Baltă/).click();
  await options.filter({ hasText: 'Lacul Snagov' }).click();
  await dialog.getByRole('button', { name: 'Aplică (1)' }).click();
  await expect(chip(page, 'Baltă: Balta Chita')).toBeVisible();
  await expect.poll(() => titles(page)).toEqual(['Balta Chita', 'Balta Chita']);
  expect(errors).toEqual([]);
});

test('c5 — «Cu capturi» keeps only partide with at least one capture', async ({ page, context }) => {
  await signedIn(context, page);
  await mockMine(page, { rows: R.ALL });
  await open(page);
  await chip(page, 'Cu capturi').click();
  await expect(page).toHaveURL(/\?cu-capturi=1$/);
  await expect.poll(() => titles(page)).toEqual(['Balta Chita', 'Lacul Snagov', 'Balta Chita', 'Dunărea']);
  await expect(monthHeaders(page)).toHaveText(['SEPTEMBRIE 2026', 'AUGUST 2026', 'IULIE 2026']);
});

test('c6 — 10 partide at a time as the list scrolls; any filter change resets the window', async ({ page, context }) => {
  const errors = collectConsoleErrors(page);
  await signedIn(context, page);
  await mockMine(page, { rows: manyRows(25) });
  await open(page);
  await expect(cards(page)).toHaveCount(10);
  await page.getByTestId('history-sentinel').scrollIntoViewIfNeeded();
  await expect(cards(page)).toHaveCount(20);
  await page.getByTestId('history-sentinel').scrollIntoViewIfNeeded();
  await expect(cards(page)).toHaveCount(25);
  await expect(page.getByTestId('history-sentinel')).toHaveCount(0);
  // A filter change: back to 10 (16 partide have captures).
  await page.evaluate(() => window.scrollTo(0, 0));
  await chip(page, 'Cu capturi').click();
  await expect(cards(page)).toHaveCount(10);
  await page.getByTestId('history-sentinel').scrollIntoViewIfNeeded();
  await expect(cards(page)).toHaveCount(16);
  await page.evaluate(() => window.scrollTo(0, 0));
  await chip(page, 'Greutate').click();
  await expect(cards(page)).toHaveCount(10);
  // Back to an EARLIER combination after growing it: still 10 (the window is not remembered per
  // combination). Grow the plain list to 25, «Cu capturi» on, then off again.
  await page.evaluate(() => window.scrollTo(0, 0));
  await chip(page, 'Greutate').click();
  await chip(page, 'Cu capturi').click();
  await expect(cards(page)).toHaveCount(10);
  await page.getByTestId('history-sentinel').scrollIntoViewIfNeeded();
  await expect(cards(page)).toHaveCount(20);
  await page.getByTestId('history-sentinel').scrollIntoViewIfNeeded();
  await expect(cards(page)).toHaveCount(25);
  await page.evaluate(() => window.scrollTo(0, 0));
  await chip(page, 'Cu capturi').click();
  await expect(cards(page)).toHaveCount(10);
  await chip(page, 'Cu capturi').click();
  await expect(cards(page)).toHaveCount(10);
  await expect(page).toHaveURL(PAGE);
  expect(errors).toEqual([]);
});

test('c4/c8 — a `balti` none of the finished partide carries is dropped once the list answers (never a stuck filter)', async ({ page, context }) => {
  const errors = collectConsoleErrors(page);
  await signedIn(context, page);
  await mockMine(page, { rows: R.ALL });
  await open(page, PHONE, routes.partideHistory({ venues: ['Inexistent'] }));
  await expect(cards(page)).toHaveCount(6);
  await expect(page.getByTestId('history-empty')).toHaveCount(0);
  await expect(chip(page, 'Baltă')).toBeVisible();
  await expect(page).toHaveURL(PAGE);
  await chip(page, 'Baltă').click();
  const dialog = page.getByRole('dialog', { name: 'Filtrează după baltă' });
  await expect(dialog.getByTestId('venue-draft-count')).toHaveText('Nicio baltă selectată');
  await page.keyboard.press('Escape');
  // Mixed with a known venue: only the unknown one goes.
  await open(page, PHONE, routes.partideHistory({ venues: ['Inexistent', 'Balta Chita'] }));
  await expect(chip(page, 'Baltă: Balta Chita')).toBeVisible();
  await expect.poll(() => titles(page)).toEqual(['Balta Chita', 'Balta Chita']);
  await expect(page).toHaveURL(/\?balti=Balta\+Chita$/);
  expect(errors).toEqual([]);
});

test('from 1440 — the summary column: partide, capturi, cantitate, record over what the list shows', async ({ page, context }) => {
  const errors = collectConsoleErrors(page);
  await signedIn(context, page);
  await mockMine(page, { rows: R.ALL });
  await open(page, DESKTOP);
  const aside = page.getByRole('complementary', { name: 'Istoricul în cifre' });
  await expect(aside.getByTestId('bento-partide')).toContainText('6');
  await expect(aside.getByTestId('history-summary-scope')).toHaveText('Toate partidele încheiate');
  await chip(page, 'Cu capturi').click();
  await expect(aside.getByTestId('bento-partide')).toContainText('4');
  await expect(aside.getByTestId('history-summary-scope')).toHaveText('Pentru filtrele selectate');
  // Beside the cards, never under them.
  const [a, c] = [await aside.boundingBox(), await cards(page).first().boundingBox()];
  expect(a!.x).toBeGreaterThan(c!.x + c!.width);
  await expectNoA11yViolations(page);
  // Below 1440 there is no summary (1280 keeps four card columns; Ale mele leads with the figures).
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(aside).toBeHidden();
  expect(errors).toEqual([]);
});

test('c7 — skeleton while the list is read; «Nicio partidă pentru filtrele selectate.» after filtering', async ({ page, context }) => {
  const errors = collectConsoleErrors(page);
  await signedIn(context, page);
  await mockMine(page, { rows: R.ALL, delayMs: 1500 });
  await open(page, PHONE, routes.partideHistory({ venues: ['Balta Dridu'] }));
  const body = page.getByTestId('history-body');
  await expect(body.getByTestId('history-skeleton')).toBeVisible();
  await expect(page.getByTestId('history-empty')).toHaveCount(0);
  await expect(cards(page)).toHaveCount(1);
  await expect(body.getByTestId('history-skeleton')).toHaveCount(0);
  // Dridu had no capture.
  await chip(page, 'Cu capturi').click();
  await expect(page.getByTestId('history-empty')).toContainText('Nicio partidă pentru filtrele selectate.');
  await expect(cards(page)).toHaveCount(0);
  await page.getByRole('button', { name: 'Resetează' }).click();
  await expect(cards(page)).toHaveCount(6);
  await expect(page).toHaveURL(PAGE);
  expect(errors).toEqual([]);
});

test('c7 — a failed first read is an error card with a retry, never an empty history', async ({ page, context }) => {
  await signedIn(context, page);
  const { state } = await mockMine(page, { rows: 'error' });
  await open(page);
  await expect(page.getByText('Istoricul nu s-a putut încărca.')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('history-empty')).toHaveCount(0);
  state.rows = R.ALL;
  await page.getByRole('button', { name: 'Încearcă din nou' }).click();
  await expect(cards(page)).toHaveCount(6);
});

test('c8 — filters live in the URL (a reload keeps them); the refresh refetches the own list', async ({ page, context }) => {
  const errors = collectConsoleErrors(page);
  await signedIn(context, page);
  const { hits, state } = await mockMine(page, { rows: R.ALL });
  await open(page, DESKTOP, routes.partideHistory({ byWeight: true, venues: ['Balta Chita'], withCaptures: true }));
  await expect(chip(page, 'Greutate')).toHaveAttribute('aria-pressed', 'true');
  await expect(chip(page, 'Cu capturi')).toHaveAttribute('aria-pressed', 'true');
  await expect(chip(page, 'Baltă: Balta Chita')).toBeVisible();
  await expect.poll(() => titles(page)).toEqual(['Balta Chita', 'Balta Chita']);
  await page.reload();
  await expect(chip(page, 'Baltă: Balta Chita')).toBeVisible();
  await expect.poll(() => titles(page)).toEqual(['Balta Chita', 'Balta Chita']);
  // Desktop: the months are card grids, not a stretched phone list.
  await chip(page, 'Greutate').click();
  await chip(page, 'Cu capturi').click();
  await chip(page, /Baltă/).click();
  const dialog = page.getByRole('dialog', { name: 'Filtrează după baltă' });
  await dialog.getByRole('button', { name: 'Golește filtrele' }).click();
  await dialog.getByRole('button', { name: 'Aplică', exact: true }).click();
  await expect(page).toHaveURL(PAGE);
  const sep = page.getByTestId('history-month').nth(0).getByTestId('own-card');
  const [a, b] = [await sep.nth(0).boundingBox(), await sep.nth(1).boundingBox()];
  expect(Math.round(a!.y)).toBe(Math.round(b!.y));
  expect(a!.width).toBeLessThan(560);

  const before = hits.mine;
  state.rows = [...R.ALL, { ...R.SEP_20, documentId: 'new', clientId: 'client-new', lakeName: 'Balta Nouă', startedAt: '2026-09-26T05:00:00.000Z', endedAt: '2026-09-26T09:00:00.000Z' }];
  await page.getByRole('button', { name: 'Reîmprospătează' }).click();
  await expect.poll(() => hits.mine).toBe(before + 1);
  await expect(cards(page).first()).toContainText('Balta Nouă');
  expect(hits.firebase).toEqual([]);
  expect(errors).toEqual([]);
});
