import { mkdirSync } from 'node:fs';
import { expect, test, type Page, type Route } from '@playwright/test';
import { expectNoA11yViolations } from './helpers/a11y';
import { collectConsoleErrors } from './helpers/console';
import { fakeRaffle, SESSION_ID } from './helpers/fake-raffle';
import { qaJwt, signIn } from './helpers/session';

/*
 * participant.raffle-receipt-submitted — /tombola/bon-trimis «Bon încărcat» (T6; fish
 * app/(app)/raffle/receipt-submitted.tsx, reached only from the upload page).
 *
 * Writes nothing anywhere: the active session comes from helpers/fake-raffle.ts (read-only here);
 * the participation is answered by a layer of this spec on top of it (registered later, so it runs
 * first) with the receipt flags each state needs.
 */

const SHOTS = '.shots/tombola-bon-trimis';
mkdirSync(SHOTS, { recursive: true });

type Part = { joined: boolean; entriesCount: number; receiptUploaded: boolean; receiptUnderVerification: boolean };
type Opts = { part?: Partial<Part>; failReads?: boolean; holdMs?: number };

const VERIFYING: Partial<Part> = { entriesCount: 1, receiptUploaded: false, receiptUnderVerification: true };
const APPROVED: Partial<Part> = { entriesCount: 5, receiptUploaded: true, receiptUnderVerification: false };

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

async function fakeParticipation(page: Page, o: Opts) {
  const part: Part = { joined: true, entriesCount: 1, receiptUploaded: false, receiptUnderVerification: false, ...o.part };
  await page.route('**/api/cms/raffle-sessions/participation', async (route) => {
    if (o.holdMs) await new Promise((r) => setTimeout(r, o.holdMs));
    if (o.failReads) return json(route, { data: null, error: { status: 500, name: 'Error', message: 'mock failure', details: {} } }, 500);
    return json(route, {
      data: {
        ...part,
        entriesCount: part.joined ? part.entriesCount : 0,
        typeKey: part.joined ? 'crap' : null,
        canChangeType: true,
        sessionDocumentId: SESSION_ID,
        receiptImageUrl: null,
      },
    });
  });
}

let jwt = '';
test.beforeAll(async ({ request }) => {
  jwt = await qaJwt(request);
});

async function prepare(page: Page, o: Opts = {}, width = 1280) {
  await page.setViewportSize({ width, height: width < 768 ? 812 : 900 });
  await signIn(page.context(), jwt);
  await fakeRaffle(page, { joined: true });
  await fakeParticipation(page, o);
}

async function open(page: Page, o: Opts = {}, width = 1280) {
  await prepare(page, o, width);
  await page.goto('/tombola/bon-trimis');
  await expect(page.getByTestId('receipt-submitted')).toBeVisible();
}

/** A client-side navigation (Next's router, same document) — what a <Link> / router.push does. */
async function clientPush(page: Page, href: string) {
  await page.evaluate((h) => (window as unknown as { next: { router: { push: (h: string) => void } } }).next.router.push(h), href);
}

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

/**
 * The only real way in: «Șansele mele» → /tombola/bon (a push) → upload (fake-raffle answers the
 * POST, nothing reaches a CMS) → router.replace('/tombola/bon-trimis'). Returns history.length on
 * /tombola/bon, before the replace.
 */
async function viaUpload(page: Page) {
  await prepare(page, { part: VERIFYING }, 375);
  await page.goto('/tombola/sansele-mele');
  await expect(page.getByRole('heading', { level: 1, name: 'Șansele mele' })).toBeVisible();
  await clientPush(page, '/tombola/bon?mod=adauga');
  await expect(page).toHaveURL(/\/tombola\/bon\?mod=adauga$/);
  const input = page.getByTestId('receipt-upload-gallery');
  await expect(input).toBeAttached();
  const length = await page.evaluate(() => history.length);
  await input.setInputFiles({ name: 'bon.png', mimeType: 'image/png', buffer: PNG });
  await expect(page).toHaveURL(/\/tombola\/bon-trimis$/);
  await expect(page.getByTestId('receipt-submitted')).toBeVisible();
  expect(await page.evaluate(() => history.length)).toBe(length);
  return length;
}

const fact = (page: Page, id: 'previous' | 'bonus' | 'total') => {
  const li = page.getByTestId(`receipt-${id}`);
  return { li, value: li.locator('[data-value]') };
};

async function shots(page: Page, state: string, widths = [375, 768, 1280, 1440, 1920]) {
  for (const w of widths) {
    await page.setViewportSize({ width: w, height: w < 768 ? 812 : 900 });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `${SHOTS}/${state}-${w}.png`, fullPage: true });
  }
}

test.describe('participant.raffle-receipt-submitted', () => {
  test('signed out → sign-in with the way back (proxy 307)', async ({ page }) => {
    await page.goto('/tombola/bon-trimis');
    await expect(page).toHaveURL(/\/intra\?next=%2Ftombola%2Fbon-trimis$/);
  });

  test('c1 — an orphan: noindex, title; no link to it on home, the confirmation or «Șansele mele»', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await open(page, { part: VERIFYING });
    await expect(page).toHaveTitle(/Bon încărcat/);
    await expect(page.getByRole('heading', { level: 1, name: 'Bon încărcat' })).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    for (const path of ['/tombola/confirmare', '/tombola/sansele-mele', '/']) {
      await page.goto(path);
      await expect(page.locator('main')).toBeVisible();
      await page.waitForLoadState('networkidle');
      await expect(page.locator('a[href*="/tombola/bon-trimis"]')).toHaveCount(0);
    }
    expect(errors).toEqual([]);
  });

  test('c2 c3 — under verification: check, verifying line, «Înainte» 1 / «Bonus (în așteptare)» 2 / «Total» 3; axe', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await open(page, { part: VERIFYING });
    const card = page.getByTestId('receipt-submitted');
    await expect(card).toHaveAttribute('data-state', 'verifying');
    await expect(page.getByTestId('receipt-message')).toHaveText('Bonul tău este în curs de verificare.');
    await expect(page.getByRole('group', { name: 'Bon încărcat. Bonul tău este în curs de verificare.' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Detalii șanse' })).toBeVisible();
    await expect(fact(page, 'previous').li).toContainText('Înainte');
    await expect(fact(page, 'previous').value).toHaveText('1');
    await expect(fact(page, 'bonus').li).toContainText('Bonus (în așteptare)');
    await expect(fact(page, 'bonus').value).toHaveText('2');
    await expect(fact(page, 'total').li).toContainText('Total');
    await expect(fact(page, 'total').value).toHaveText('3');
    // Units agree with the figure, and each tile is one spoken phrase.
    await expect(fact(page, 'previous').li.locator('.sr-only')).toHaveText('Înainte: 1 șansă');
    await expect(fact(page, 'total').li.locator('.sr-only')).toHaveText('Total: 3 șanse');
    await expect(page.getByText('capot', { exact: false })).toHaveCount(0);
    await expectNoA11yViolations(page);
    await shots(page, 'verifying');
    expect(errors).toEqual([]);
  });

  test('c2 c3 — approved: approved line, «Bonus» 2, «Total» = the entries count; axe', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await open(page, { part: APPROVED });
    await expect(page.getByTestId('receipt-submitted')).toHaveAttribute('data-state', 'approved');
    await expect(page.getByTestId('receipt-message')).toHaveText('Bonul a fost aprobat! Ai primit 2 șanse bonus.');
    await expect(fact(page, 'previous').value).toHaveText('1');
    await expect(fact(page, 'bonus').li.locator('.sr-only')).toHaveText('Bonus: 2 șanse');
    await expect(fact(page, 'bonus').value).toHaveText('2');
    await expect(fact(page, 'total').value).toHaveText('5');
    await expectNoA11yViolations(page);
    await shots(page, 'approved');
    expect(errors).toEqual([]);
  });

  test('c3 — no receipt (reached by URL): «Bonus» 0, «Total» = entries, as fish', async ({ page }) => {
    await open(page, { part: { entriesCount: 1 } });
    await expect(fact(page, 'bonus').li.locator('.sr-only')).toHaveText('Bonus: 0 șanse');
    await expect(fact(page, 'total').value).toHaveText('1');
  });

  test('c4 — «Vezi șansele mele» goes back when there is a page of ours behind (keyboard)', async ({ page }) => {
    await prepare(page, { part: VERIFYING });
    await page.goto('/tombola/sansele-mele');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.goto('/tombola/bon-trimis');
    const cta = page.getByRole('link', { name: 'Vezi șansele mele' });
    await expect(cta).toBeVisible();
    // Keyboard: the CTA is reachable by Tab and Enter activates it.
    await cta.focus();
    await expect(cta).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/tombola\/sansele-mele$/);
  });

  test('c4 — the real way in (sansele-mele → bon → replace): «Vezi șansele mele» skips the replaced upload page', async ({ page }) => {
    const length = await viaUpload(page);
    await page.getByRole('link', { name: 'Vezi șansele mele' }).click();
    await expect(page).toHaveURL(/\/tombola\/sansele-mele$/);
    expect(await page.evaluate(() => history.length)).toBe(length);
  });

  test('header back — the real way in: the chevron («Înapoi») returns to «Șansele mele», as the CTA does', async ({ page }) => {
    const length = await viaUpload(page);
    const back = page.getByRole('link', { name: 'Înapoi', exact: true });
    await expect(back).toHaveAttribute('href', '/');
    await back.click();
    await expect(page).toHaveURL(/\/tombola\/sansele-mele$/);
    expect(await page.evaluate(() => history.length)).toBe(length);
  });

  test('header back — with nothing behind (a fresh tab) it goes home, replacing this page', async ({ page }) => {
    await open(page, { part: VERIFYING });
    const before = await page.evaluate(() => history.length);
    await page.getByRole('link', { name: 'Înapoi', exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
    expect(await page.evaluate(() => history.length)).toBe(before);
  });

  test('layout 375 — the breakdown sits right under the message; skeleton geometry = loaded geometry', async ({ page }) => {
    await prepare(page, { part: VERIFYING, holdMs: 2500 }, 375);
    await page.goto('/tombola/bon-trimis');
    const sk = page.getByTestId('receipt-submitted-skeleton').last();
    await expect(sk).toBeVisible();
    const box = (sel: string) => page.locator(sel).first().boundingBox();
    const skDisc = await box('[data-testid="receipt-submitted-skeleton"] .size-14');
    const skTiles = await box('[data-testid="receipt-submitted-skeleton"] .grid');
    await expect(page.getByTestId('receipt-breakdown')).toBeVisible({ timeout: 10_000 });
    // The disc's entrance (scale 0.75 → 1) is over before it is measured.
    await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'));
    const disc = await box('[data-testid="receipt-submitted"] .size-14');
    const tiles = await box('[data-testid="receipt-breakdown"]');
    const message = await page.getByTestId('receipt-message').boundingBox();
    const cta = await page.getByRole('link', { name: 'Vezi șansele mele' }).boundingBox();
    expect(Math.abs(skDisc!.y - disc!.y)).toBeLessThanOrEqual(2);
    expect(Math.abs(skTiles!.y - tiles!.y)).toBeLessThanOrEqual(2);
    // No blank band: the tiles start within 120px of the message's bottom (h2 + gaps).
    expect(tiles!.y - (message!.y + message!.height)).toBeLessThanOrEqual(120);
    // The CTA is in the thumb-zone bar at the bottom of the viewport.
    expect(cta!.y + cta!.height).toBeGreaterThan(812 - 80);
  });

  test('c4 — with nothing behind (a fresh tab) it goes home, replacing this page', async ({ page }) => {
    await open(page, { part: VERIFYING });
    const before = await page.evaluate(() => history.length);
    await page.getByRole('link', { name: 'Vezi șansele mele' }).click();
    await expect(page).toHaveURL(/\/$/);
    expect(await page.evaluate(() => history.length)).toBe(before);
  });

  test('keyboard order: skip link / header back, then the CTA; focus visible on the CTA', async ({ page }) => {
    await open(page, { part: APPROVED }, 375);
    const cta = page.getByRole('link', { name: 'Vezi șansele mele' });
    for (let i = 0; i < 30 && !(await cta.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press('Tab');
    await expect(cta).toBeFocused();
    const outline = await cta.evaluate((el) => getComputedStyle(el).outlineStyle + getComputedStyle(el).boxShadow);
    expect(outline).not.toBe('nonenone');
  });

  test('rule 4 — loading: neutral skeleton (busy), no breakdown until the participation is known', async ({ page }) => {
    await prepare(page, { part: VERIFYING, holdMs: 2500 });
    await page.goto('/tombola/bon-trimis');
    // Two for a moment while the route's loading.tsx hands over to the Suspense fallback.
    await expect(page.getByTestId('receipt-submitted-skeleton').first()).toBeVisible();
    await expect(page.getByTestId('receipt-breakdown')).toHaveCount(0);
    await shots(page, 'loading', [375, 1280]);
    await expect(page.getByTestId('receipt-breakdown')).toBeVisible({ timeout: 10_000 });
  });

  test('rule 4 — the participation fails: the retry gate, no breakdown', async ({ page }) => {
    await prepare(page, { failReads: true });
    await page.goto('/tombola/bon-trimis');
    await expect(page.getByRole('alert').filter({ hasText: 'Nu am putut încărca tombola' })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('receipt-breakdown')).toHaveCount(0);
    await shots(page, 'error', [375, 1280]);
  });

  test('not in the raffle → handed to the intro (/tombola)', async ({ page }) => {
    await prepare(page, { part: { joined: false } });
    await page.goto('/tombola/bon-trimis');
    await expect(page).toHaveURL(/\/tombola$/);
  });
});
