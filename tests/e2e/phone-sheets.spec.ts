import { devices, expect, test, type Page } from '@playwright/test';
import { BASE_URL } from './helpers/base-url';
import { expectPhoneSheet, fakeTouchDrag, settledBox, sheetPanel } from './helpers/phone-sheet';

/*
 * One phone sheet primitive (owner 2026-10-10, iPhone Safari: «more sheets misbehave on scroll — fix
 * them all»). Every phone sheet / modal sheet is the kit Sheet (directly, via ResponsiveSurface, or
 * ModalSurface's 85% sheet), all on useModalDialog's iOS-proof page lock: the contract in
 * helpers/phone-sheet.ts, run in Safari's engine as an iPhone 13 — on the /dev/sheets harness (every
 * flavour over a long page) and on the real screens that open each flavour. Local CMS on :1337.
 */

/** iPhone 13 as context options (the device's browser pick is a project option, not a context one). */
const iphone = (({ defaultBrowserType, ...rest }) => (void defaultBrowserType, rest))(devices['iPhone 13']);
test.use({ ...iphone, browserName: 'webkit' });

const LAKE = process.env.E2E_LAKE_CHITA ?? 's84u55lo4n9z0emngozttt6e';
const settle = (page: Page) => page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});

async function harness(page: Page) {
  await page.goto('/dev/sheets', { waitUntil: 'domcontentloaded' });
  await settle(page);
  // The page is scrolled first: a sheet must leave it exactly there.
  await page.evaluate(() => window.scrollTo(0, 900));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(800);
}

test.describe('phone sheets · harness (every flavour)', () => {
  for (const [label, name, scrollable] of [
    ['Foaie lungă', 'Foaie de probă', true],
    ['Foaie scurtă', 'Foaie de probă', false],
    ['Foaie cu câmp', 'Foaie de probă', undefined],
    ['Suprafață', 'Suprafață de probă', true],
    ['Filtre', 'Filtre', true],
  ] as const) {
    test(`${label}: docked, page locked, inner scroll, drag / flick / Escape / scrim close`, async ({ page }) => {
      await harness(page);
      const opener = page.getByRole('button', { name: label, exact: true });
      await expectPhoneSheet({
        page,
        dialog: page.getByRole('dialog', { name }),
        opener,
        open: () => opener.click(),
        scrollable,
      });
    });
  }

  test('the 50% sheet: a pull up on the content raises it to 90% before the list scrolls; a slow small drag springs back', async ({ page }) => {
    await harness(page);
    await page.getByRole('button', { name: 'Foaie lungă', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Foaie de probă' });
    const panel = await sheetPanel(dialog);
    const vh = page.viewportSize()!.height;
    expect((await settledBox(panel)).height).toBeCloseTo(vh * 0.5, -1);
    const body = dialog.locator('[data-sheet-body]');
    expect(await fakeTouchDrag(body, -160)).toBe(true);
    expect((await settledBox(panel)).height).toBeCloseTo(vh * 0.9, -1);
    expect(await body.evaluate((b) => b.scrollTop)).toBe(0);
    // A slow 40 px pull: not far, not fast — back to the 90% rest, still open.
    expect(await fakeTouchDrag(body, 40, { steps: 10, stepMs: 40 })).toBe(true);
    expect((await settledBox(panel)).height).toBeCloseTo(vh * 0.9, -1);
    await expect(dialog).toBeVisible();
  });

  test('the field sheet follows the visual viewport (iOS keyboard) and pins its footer', async ({ page }) => {
    await harness(page);
    await page.getByRole('button', { name: 'Foaie cu câmp', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Foaie de probă' });
    await expect(dialog).toBeVisible();
    const vars = await dialog.evaluate((d) => ({ h: d.style.getPropertyValue('--vv-h'), top: d.style.getPropertyValue('--vv-top') }));
    expect(parseFloat(vars.h)).toBeGreaterThan(0);
    expect(vars.top).toBe('0px');
    // The keyboard: the visible area shrinks — the sheet's box follows it, the footer stays visible.
    await dialog.evaluate((d) => {
      d.style.setProperty('--vv-h', `${window.innerHeight - 300}px`);
    });
    const panel = await sheetPanel(dialog);
    const box = await settledBox(panel);
    expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize()!.height - 299);
    await expect(dialog.getByRole('button', { name: 'Salvează' })).toBeInViewport();
  });

  test('the full-screen modal locks the page too', async ({ page }) => {
    await harness(page);
    const y0 = await page.evaluate(() => window.scrollY);
    await page.getByRole('button', { name: 'Căutare', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Caută' });
    await expect(dialog).toBeVisible();
    expect(await fakeTouchDrag(dialog.getByRole('heading', { name: 'Caută' }), 200)).toBe(true);
    expect(await page.evaluate(() => window.scrollY)).toBe(y0);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    expect(await page.evaluate(() => window.scrollY)).toBe(y0);
  });
});

test.describe('phone sheets · real screens', () => {
  test('Concursuri · Filtre (ModalSurface 85% sheet)', async ({ page }) => {
    await page.goto('/concursuri', { waitUntil: 'domcontentloaded' });
    await settle(page);
    const opener = page.getByRole('button', { name: 'Filtre', exact: true }).last();
    test.skip(!(await opener.count()), 'no «Filtre» on the phone list');
    await expectPhoneSheet({ page, dialog: page.getByRole('dialog', { name: 'Filtre' }), opener, open: () => opener.click() });
  });

  test('Balta · «Vezi mai mult» Descriere (kit Sheet, 90%)', async ({ page }) => {
    await page.goto(`/balti/${LAKE}`, { waitUntil: 'domcontentloaded' });
    await settle(page);
    const opener = page.getByRole('button', { name: /Vezi mai mult/ }).first();
    test.skip(!(await opener.count()), 'the local lake has no long description');
    await expectPhoneSheet({ page, dialog: page.getByRole('dialog', { name: 'Descriere' }), opener, open: () => opener.click() });
  });

  test('Concursuri live · Urmăritori (ResponsiveSurface → Sheet)', async ({ page }) => {
    await page.goto('/concursuri/live', { waitUntil: 'domcontentloaded' });
    await settle(page);
    const opener = page.getByRole('button', { name: /urmăritor/i }).first();
    test.skip(!(await opener.count()), 'no live competition card locally');
    await expectPhoneSheet({ page, dialog: page.getByRole('dialog', { name: 'Urmăritori' }), opener, open: () => opener.click() });
  });

  test('Bălți · Filtre (kit Sheet via PhoneSheet / T2Panel)', async ({ page }) => {
    await page.goto('/balti', { waitUntil: 'domcontentloaded' });
    await settle(page);
    const opener = page.getByRole('button', { name: /^Filtre/ }).first();
    test.skip(!(await opener.count()), 'no «Filtre» on the phone lakes screen');
    await expectPhoneSheet({ page, dialog: page.getByRole('dialog', { name: /Filtre/ }), opener, open: () => opener.click() });
  });

  test('Cookie preferences «Personalizează» (ModalSurface sheet)', async ({ browser }) => {
    // The banner shows on localhost only with the preview cookie (consent.spec.ts).
    const preview = { name: 'bluvi_consent_preview', value: 'all', domain: new URL(BASE_URL).hostname, path: '/', expires: -1, httpOnly: false, secure: false, sameSite: 'Lax' as const };
    const context = await browser.newContext({ ...iphone, storageState: { cookies: [preview], origins: [] }, baseURL: BASE_URL });
    const page = await context.newPage();
    await page.goto('/concursuri', { waitUntil: 'domcontentloaded' });
    await settle(page);
    const opener = page.getByRole('region', { name: 'Consimțământ cookie-uri' }).getByRole('button', { name: 'Personalizează' });
    await expectPhoneSheet({ page, dialog: page.getByRole('dialog', { name: 'Setări de confidențialitate' }), opener, open: () => opener.click() });
    await context.close();
  });
});
