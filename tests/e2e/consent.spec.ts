import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { expectNoA11yViolations } from './helpers/a11y';
import { BASE_URL } from './helpers/base-url';
import { collectConsoleErrors } from './helpers/console';
import { qaJwt, signIn } from './helpers/session';

/*
 * m8.consent — the cookie-consent layer: banner (components/consent/ConsentBanner), preferences
 * dialog (ConsentPreferencesDialog), the public /cookie-uri page, and its entry points
 * (account.settings.c16 LegalCard row, home.acasa.c53 signed-out card). fish CMP/ui/PersonalizeScreen.
 *
 * Every other spec runs with a decided consent (playwright.config.ts storageState); this one starts
 * with no decision, so the visitor is new. No CMS writes; no Firestore; the session is the QA user.
 *
 * Neither NEXT_PUBLIC_GA4_ID nor NEXT_PUBLIC_SENTRY_DSN is set locally, so there is no optional
 * category and no banner (lib/consent/active.ts, owner rule 4). The dev-only cookie
 * `bluvi_consent_preview=all` shows every category; the specs that exercise the banner carry it,
 * and «no service configured» runs without it.
 */

const PREVIEW = { name: 'bluvi_consent_preview', value: 'all', domain: new URL(BASE_URL).hostname, path: '/', expires: -1, httpOnly: false, secure: false, sameSite: 'Lax' as const };
test.use({ storageState: { cookies: [PREVIEW], origins: [] } });

const PAGE = '/cookie-uri';
const banner = (page: Page) => page.getByRole('region', { name: 'Consimțământ cookie-uri' });
const dialog = (page: Page) => page.getByRole('dialog', { name: 'Setări de confidențialitate' });

async function consentCookie(context: BrowserContext) {
  const c = (await context.cookies()).find((k) => k.name === 'bluvi_consent');
  return c ? { ...c, json: JSON.parse(decodeURIComponent(c.value)) as Record<string, unknown> } : undefined;
}

/** Every request to Google's tag / analytics hosts (there must be none without consent). */
function watchGtag(page: Page) {
  const hits: string[] = [];
  page.on('request', (r) => {
    if (/googletagmanager\.com|google-analytics\.com|analytics\.google\.com/.test(r.url())) hits.push(r.url());
  });
  return hits;
}

async function settled(page: Page) {
  // Finite animations only (a skeleton's endless pulse never settles).
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity));
}

test('s1 — a first visit shows the banner at 375 and 1280, client-only, and loads no gtag', async ({ page }) => {
  const errors = collectConsoleErrors(page);
  const gtag = watchGtag(page);
  // The server HTML has no banner (static prerender, CLS untouched).
  const html = await (await page.request.get('/')).text();
  expect(html).not.toContain('Consimțământ cookie-uri');
  for (const width of [375, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const b = banner(page);
    await expect(b).toBeVisible();
    await expect(b.getByRole('heading', { name: 'Cookie-uri pe Bluvi' })).toBeVisible();
    await expect(b.getByRole('link', { name: /Politica de confidențialitate/ })).toHaveAttribute('href', /termly\.io.*958c9787/);
    const buttons = ['Refuz toate', 'Accept toate', 'Personalizează'].map((name) => b.getByRole('button', { name }));
    for (const btn of buttons) await expect(btn).toBeVisible();
    // Refusing is as prominent as accepting: same size, same look.
    const [reject, accept] = await Promise.all(buttons.slice(0, 2).map((x) => x.boundingBox()));
    expect(Math.abs(reject!.width - accept!.width)).toBeLessThan(2);
    expect(reject!.height).toBe(accept!.height);
    expect(await buttons[0].getAttribute('class')).toBe(await buttons[1].getAttribute('class'));
    const box = (await b.boundingBox())!;
    if (width < 768) {
      // Bottom sheet across the width.
      expect(box.x).toBe(0);
      expect(box.width).toBe(width);
      expect(Math.round(box.y + box.height)).toBe(900);
    } else {
      // Bottom-left card ≤ 440, clear of the bottom-centre CTAs.
      expect(box.width).toBeLessThanOrEqual(440);
      expect(box.x).toBeLessThan(48);
      expect(box.x + box.width).toBeLessThan(width / 2);
    }
  }
  expect(await consentCookie(page.context())).toBeUndefined();
  expect(gtag).toEqual([]);
  expect(errors, errors.join('\n')).toEqual([]);
});

test('s2 — «Refuz toate» stores analytics:false, errors:false; the banner stays gone after a reload', async ({ page }) => {
  const gtag = watchGtag(page);
  await page.goto('/');
  await banner(page).getByRole('button', { name: 'Refuz toate' }).click();
  await expect(banner(page)).toHaveCount(0);
  const c = (await consentCookie(page.context()))!;
  expect(c.json).toMatchObject({ v: 1, analytics: false, errors: false });
  expect(Date.parse(String(c.json.at))).toBeGreaterThan(Date.now() - 60_000);
  expect(c.path).toBe('/');
  expect(c.sameSite).toBe('Lax');
  expect(c.httpOnly).toBe(false);
  // 180 days.
  expect(c.expires - Date.now() / 1000).toBeGreaterThan(179 * 86_400);
  expect(c.expires - Date.now() / 1000).toBeLessThan(181 * 86_400);
  await page.reload();
  await expect(banner(page)).toHaveCount(0);
  await page.goto(PAGE);
  await expect(page.getByRole('heading', { level: 1, name: 'Setări de confidențialitate' })).toBeVisible();
  await expect(page.getByRole('switch', { name: 'Analiză' })).not.toBeChecked();
  await expect(banner(page)).toHaveCount(0);
  expect(gtag).toEqual([]);
});

test('s3 — «Accept toate» stores both categories on; the page shows them on', async ({ page }) => {
  await page.goto('/');
  await banner(page).getByRole('button', { name: 'Accept toate' }).click();
  await expect(banner(page)).toHaveCount(0);
  expect((await consentCookie(page.context()))!.json).toMatchObject({ v: 1, analytics: true, errors: true });
  await page.goto(PAGE);
  await expect(page.getByRole('switch', { name: 'Analiză' })).toBeChecked();
  await expect(page.getByRole('switch', { name: 'Monitorizarea erorilor' })).toBeChecked();
});

test('s4 — «Personalizează» opens the dialog: switches, details, save; then the page changes and withdraws', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  await banner(page).getByRole('button', { name: 'Personalizează' }).click();
  const d = dialog(page);
  await expect(d).toBeVisible();
  // Strict necesare is always on, no switch; the optional ones start off.
  await expect(d.getByText('Mereu active')).toBeVisible();
  const analytics = d.getByRole('switch', { name: 'Analiză' });
  const errorsSwitch = d.getByRole('switch', { name: 'Monitorizarea erorilor' });
  await expect(analytics).not.toBeChecked();
  await expect(errorsSwitch).not.toBeChecked();
  // fish's service sections under «Detalii».
  await d.getByText('Detalii — Analiză').click();
  for (const label of ['Scopurile prelucrării', 'Tehnologii folosite', 'Informații colectate', 'Baze legale', 'Transferul către țări terțe']) {
    await expect(d.locator('[data-consent-category="analytics"]').getByText(label, { exact: true })).toBeVisible();
  }
  await expect(d.locator('[data-consent-category="analytics"]').getByText('_ga', { exact: true })).toBeVisible();
  await analytics.click();
  await expect(analytics).toBeChecked();
  // Nothing is stored until a button decides.
  expect(await consentCookie(page.context())).toBeUndefined();
  await d.getByRole('button', { name: 'Salvează preferințele' }).click();
  await expect(d).toBeHidden();
  await expect(banner(page)).toHaveCount(0);
  expect((await consentCookie(page.context()))!.json).toMatchObject({ analytics: true, errors: false });

  // The page's inline controls: withdraw analytics → GA cookies deleted.
  await page.goto(PAGE);
  await page.context().addCookies([
    { name: '_ga', value: 'GA1.1.1.1', url: BASE_URL },
    { name: '_ga_TEST123', value: 'GS1.1.1', url: BASE_URL },
  ]);
  const inline = page.getByTestId('cookie-settings');
  await expect(inline.getByRole('switch', { name: 'Analiză' })).toBeChecked();
  await inline.getByRole('switch', { name: 'Analiză' }).click();
  await inline.getByRole('switch', { name: 'Monitorizarea erorilor' }).click();
  await inline.getByRole('button', { name: 'Salvează preferințele' }).click();
  await expect(inline.getByRole('status')).toHaveText('Preferințele au fost salvate.');
  expect((await consentCookie(page.context()))!.json).toMatchObject({ analytics: false, errors: true });
  const names = (await page.context().cookies()).map((c) => c.name);
  expect(names.filter((n) => n.startsWith('_ga'))).toEqual([]);
});

test('s5 — keyboard: banner first in Tab order, dialog keeps focus, Escape closes without saving and returns focus', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  await expect(banner(page)).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(banner(page).getByRole('link', { name: /Politica de confidențialitate/ })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(banner(page).getByRole('button', { name: 'Refuz toate' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(banner(page).getByRole('button', { name: 'Accept toate' })).toBeFocused();
  await page.keyboard.press('Tab');
  const customize = banner(page).getByRole('button', { name: 'Personalizează' });
  await expect(customize).toBeFocused();
  await page.keyboard.press('Enter');
  const d = dialog(page);
  await expect(d).toBeVisible();
  // Focus is inside the dialog and stays there while tabbing through it.
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    expect(await d.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  }
  // Space toggles a switch from the keyboard.
  await d.getByRole('switch', { name: 'Analiză' }).focus();
  await page.keyboard.press('Space');
  await expect(d.getByRole('switch', { name: 'Analiză' })).toBeChecked();
  await page.keyboard.press('Escape');
  await expect(d).toBeHidden();
  await expect(customize).toBeFocused();
  expect(await consentCookie(page.context())).toBeUndefined();
  // Reopened: the draft starts again from the stored decision (none: all off).
  await page.keyboard.press('Enter');
  await expect(dialog(page).getByRole('switch', { name: 'Analiză' })).not.toBeChecked();
  await dialog(page).getByRole('button', { name: 'Refuz toate' }).focus();
  await page.keyboard.press('Enter');
  await expect(dialog(page)).toBeHidden();
  expect((await consentCookie(page.context()))!.json).toMatchObject({ analytics: false, errors: false });
});

test('s6 account.settings.c16 home.acasa.c53 — «Setări de confidențialitate» opens the dialog from /setari and the guest Acasă', async ({ page, request }) => {
  const errors = collectConsoleErrors(page, { ignore: /Failed to load resource: the server responded with a status of (401|404)/ });
  // Decided already (no banner): the entry points re-open the preferences.
  await page.context().addCookies([
    { name: 'bluvi_consent', value: encodeURIComponent(JSON.stringify({ v: 1, analytics: true, errors: false, at: new Date().toISOString() })), url: BASE_URL },
  ]);

  // Signed out, Acasă (phone): the card is a link to /cookie-uri that opens the dialog in place.
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto('/');
  const card = page.getByRole('link', { name: 'Setări de confidențialitate' }).filter({ visible: true });
  await expect(card).toHaveAttribute('href', '/cookie-uri');
  await card.click();
  await expect(dialog(page)).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
  await expect(dialog(page).getByRole('switch', { name: 'Analiză' })).toBeChecked();
  await dialog(page).getByRole('button', { name: 'Închide' }).click();
  await expect(dialog(page)).toBeHidden();
  await expect(card).toBeFocused();

  // Signed in, /setari (1280): the legal card's third row.
  await signIn(page.context(), await qaJwt(request));
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/setari');
  const row = page.getByTestId('settings-legal').getByRole('link', { name: 'Setări de confidențialitate' });
  await expect(row).toHaveAttribute('href', '/cookie-uri');
  await row.click();
  await expect(dialog(page)).toBeVisible();
  await expect(page).toHaveURL(/\/setari$/);
  await dialog(page).getByRole('switch', { name: 'Monitorizarea erorilor' }).click();
  await dialog(page).getByRole('button', { name: 'Salvează preferințele' }).click();
  await expect(dialog(page)).toBeHidden();
  await expect(row).toBeFocused();
  expect((await consentCookie(page.context()))!.json).toMatchObject({ analytics: true, errors: true });
  expect(errors, errors.join('\n')).toEqual([]);
});

test('s7 — JS off: /cookie-uri renders its content and links, no banner (no service configured: only «Strict necesare»)', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL: BASE_URL });
  const page = await context.newPage();
  const res = await page.goto(PAGE);
  expect(res?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1, name: 'Setări de confidențialitate' })).toBeVisible();
  // The server HTML lists the configured categories only; locally none is (lib/consent/active.ts).
  await expect(page.getByRole('heading', { name: 'Strict necesare', exact: true })).toBeVisible();
  for (const name of ['Analiză', 'Monitorizarea erorilor']) await expect(page.getByRole('heading', { name, exact: true })).toHaveCount(0);
  await expect(page.getByText('Ultima actualizare: 9 octombrie 2026')).toBeVisible();
  // The <noscript> line (Playwright keeps the parser's scripting flag on, so it is read from the HTML).
  expect(await page.content()).toMatch(/<noscript><p[^>]*>Pentru a-ți schimba alegerea, activează JavaScript în browser\.<\/p><\/noscript>/);
  // «Detalii» opens natively (details/summary).
  await page.getByText('Detalii — Strict necesare').click();
  await expect(page.getByText('bluvi_consent', { exact: true })).toBeVisible();
  await expect(page.getByText('_ga', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Consimțământ cookie-uri' })).toHaveCount(0);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/cookie-uri$/);
  await expect(page.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(0);
  await context.close();
});

test('axe — banner open and dialog open at 375, 768, 1280, 1440', async ({ page }) => {
  for (const width of [375, 768, 1280, 1440]) {
    await page.context().clearCookies();
    await page.context().addCookies([PREVIEW]);
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expect(banner(page)).toBeVisible();
    await settled(page);
    await expectNoA11yViolations(page);
    await banner(page).getByRole('button', { name: 'Personalizează' }).click();
    await expect(dialog(page)).toBeVisible();
    await dialog(page).getByText('Detalii — Monitorizarea erorilor').click();
    await settled(page);
    await expectNoA11yViolations(page);
    await page.keyboard.press('Escape');
  }
});

test('m8.consent review 1 — a new visitor on /cookie-uri sees no banner; the inline panel decides', async ({ page }) => {
  for (const width of [375, 1280]) {
    await page.context().clearCookies();
    await page.context().addCookies([PREVIEW]);
    await page.setViewportSize({ width, height: 812 });
    await page.goto(PAGE);
    const inline = page.getByTestId('cookie-settings');
    await expect(inline.getByRole('switch', { name: 'Analiză' })).toBeVisible();
    await expect(banner(page)).toHaveCount(0);
    expect(await consentCookie(page.context())).toBeUndefined();
  }
  await page.getByTestId('cookie-settings').getByRole('button', { name: 'Accept toate' }).click();
  expect((await consentCookie(page.context()))!.json).toMatchObject({ analytics: true, errors: true });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  await expect(banner(page)).toHaveCount(0);
});

test.describe('m8.consent review 2 — no service configured (no preview cookie)', () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  test('no banner; /cookie-uri lists only «Strict necesare», without decision buttons', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    await page.waitForLoadState('networkidle');
    await expect(banner(page)).toHaveCount(0);
    await page.goto(PAGE);
    const inline = page.getByTestId('cookie-settings');
    await expect(inline.getByRole('heading', { name: 'Strict necesare', exact: true })).toBeVisible();
    await expect(inline.locator('[data-consent-category]')).toHaveCount(1);
    await expect(inline.getByRole('switch')).toHaveCount(0);
    await expect(inline.getByRole('button', { name: /Accept toate|Refuz toate|Salvează/ })).toHaveCount(0);
    await expect(page.getByText(/Google Analytics|Sentry|_ga/)).toHaveCount(0);
  });
});

test('m8.consent review 4+5 — at 375 the banner is ≤ 35% of the screen and the lake action bar sits above it', async ({ page }) => {
  const LAKE = process.env.E2E_LAKE_FULL ?? 'g14bobjsal2dbks2jg38v0oi';
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  const b = banner(page);
  await expect(b).toBeVisible();
  expect((await b.boundingBox())!.height).toBeLessThanOrEqual(812 * 0.35);
  // «Personalizează» is lighter than the two equal decisions.
  const [reject, customize] = await Promise.all([b.getByRole('button', { name: 'Refuz toate' }).boundingBox(), b.getByRole('button', { name: 'Personalizează' }).boundingBox()]);
  expect(customize!.height).toBeLessThan(reject!.height);

  await page.goto(`/balti/${LAKE}`);
  await expect(b).toBeVisible();
  const bar = page.locator('[data-t3="actionbar"]');
  await expect(bar).toBeAttached();
  // Scroll to the end, where the bar is shown whatever the hero does.
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect(async () => {
    const [barBox, bannerBox] = await Promise.all([bar.boundingBox(), b.boundingBox()]);
    expect(barBox).not.toBeNull();
    expect(barBox!.y + barBox!.height).toBeLessThanOrEqual(bannerBox!.y + 1);
  }).toPass();
  // The primary action is reachable: nothing covers its centre.
  const cta = bar.getByRole('link').or(bar.getByRole('button')).last();
  const box = (await cta.boundingBox())!;
  const hit = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest('[data-t3="actionbar"]') !== null, [box.x + box.width / 2, box.y + box.height / 2]);
  expect(hit).toBe(true);
  // Decided: the bar goes back to the bottom edge.
  await b.getByRole('button', { name: 'Refuz toate' }).click();
  await expect(async () => {
    const barBox = (await bar.boundingBox())!;
    expect(Math.round(barBox.y + barBox.height)).toBe(812);
  }).toPass();
});
