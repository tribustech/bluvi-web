import { expect, test, type Page, type Route } from '@playwright/test';
import { expectNoA11yViolations } from './helpers/a11y';
import { collectConsoleErrors } from './helpers/console';
import { CMS, qaJwt, signIn } from './helpers/session';

/*
 * account.notification-settings (/setari/notificari) — fish app/(app)/notification-settings.tsx,
 * components/settings/SettingsRows.tsx, services/mutations/useToggleNotifications.ts.
 *
 * Data: the local QA user against the LOCAL CMS. The profile read is real unless a test mocks it.
 * Writes: the c3 test sends the real PATCH /notifications/enable-disable-pns (a flag on the QA
 * account only); afterEach writes the original value back (read in beforeAll). Failure, pending and
 * the «off» state are route-mocked. No Firestore.
 */

const PATH = '/setari/notificari';
const PROFILE = '**/api/cms/user/profile';
const TOGGLE = '**/api/cms/notifications/enable-disable-pns';
const WIDTHS = [375, 768, 1280, 1440, 1920] as const;
const MASTER = 'Permite notificări';
const MASTER_HELPER = 'Oprește tot: concursuri, chat, rezervări.';
const FOLLOWED = 'Concursuri urmărite';
const FOLLOWED_HELPER = 'Alege ce primești din fiecare concurs urmărit.';
const TOGGLE_FAILED = 'Nu am putut salva setarea. Încearcă din nou.';
/** Failed requests the specs provoke on purpose (mocked 5xx) are logged by the browser. */
const EXPECTED_CONSOLE = [/Failed to load resource: the server responded with a status of (500|503)/];

let jwt: string;
let profileJson: Record<string, unknown>;
let originalEnabled: boolean;
let realToggled = false;

test.beforeAll(async ({ request }) => {
  jwt = await qaJwt(request);
  const res = await request.get(`${CMS}/user/profile`, { headers: { authorization: `Bearer ${jwt}` } });
  expect(res.ok(), 'QA profile read').toBe(true);
  profileJson = await res.json();
  originalEnabled = Boolean(profileJson.notificationsEnabled);
});

test.afterEach(async ({ request }) => {
  if (!realToggled) return;
  realToggled = false;
  const res = await request.patch(`${CMS}/notifications/enable-disable-pns`, {
    headers: { authorization: `Bearer ${jwt}` },
    data: { enabled: originalEnabled },
  });
  expect(res.ok(), 'QA notificationsEnabled restored').toBe(true);
  const check = await request.get(`${CMS}/user/profile`, { headers: { authorization: `Bearer ${jwt}` } });
  expect(Boolean((await check.json()).notificationsEnabled)).toBe(originalEnabled);
});

/** Answers GET /user/profile with the real profile plus `patch` (other methods fall through). */
async function mockProfile(page: Page, patch: Record<string, unknown>) {
  await page.route(PROFILE, (r) =>
    r.request().method() === 'GET'
      ? r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...profileJson, ...patch }) })
      : r.fallback(),
  );
}

async function open(page: Page, { width = 375, signedIn = true }: { width?: number; signedIn?: boolean } = {}) {
  await page.setViewportSize({ width, height: 900 });
  if (signedIn) await signIn(page.context(), jwt);
  await page.goto(PATH);
}

const master = (page: Page) => page.getByRole('switch', { name: MASTER });
const followed = (page: Page) => page.getByRole('link', { name: FOLLOWED });
const competitionsCard = (page: Page) => page.getByTestId('notifications-competitions');

test.describe('account.notification-settings — signed out', () => {
  test('signed out: a real 307 to /intra?next=%2Fsetari%2Fnotificari', async ({ request }) => {
    const res = await request.get(PATH, { maxRedirects: 0 });
    expect(res.status()).toBe(307);
    const loc = new URL(res.headers().location, 'http://x');
    expect(loc.pathname + loc.search).toBe('/intra?next=%2Fsetari%2Fnotificari');
  });

  test('signed out in a browser, or with a session the CMS refuses: sign-in with the return path', async ({ page }) => {
    await open(page, { signedIn: false });
    await expect(page).toHaveURL(/\/intra\?next=%2Fsetari%2Fnotificari$/);
    await page.context().addCookies([{ name: 'bluvi_session', value: 'dead-token', url: page.url() }]);
    await page.goto(PATH);
    await expect(page).toHaveURL(/\/intra\?next=%2Fsetari%2Fnotificari$/);
  });
});

test.describe('account.notification-settings', () => {
  test('c1 c2 c4 — header, master switch from the real profile, CONCURSURI row; axe at every width', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await open(page);
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      // c1
      await expect(page.getByRole('heading', { level: 1, name: 'Notificări' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Înapoi' })).toBeVisible();
      // c2: the real value, its label and helper (the switch's description).
      await expect(master(page)).toBeVisible();
      if (originalEnabled) await expect(master(page)).toBeChecked();
      else await expect(master(page)).not.toBeChecked();
      await expect(master(page)).toHaveAccessibleDescription(MASTER_HELPER);
      // c4: the section (an h2, drawn in caps) and its row.
      const section = page.getByRole('heading', { level: 2, name: 'Concursuri' });
      await expect(section).toBeVisible();
      expect(await section.evaluate((el) => getComputedStyle(el).textTransform)).toBe('uppercase');
      if (originalEnabled) {
        await expect(followed(page)).toHaveAttribute('href', '/setari/notificari/concursuri');
        await expect(followed(page)).toHaveAccessibleDescription(FOLLOWED_HELPER);
        await expect(followed(page).locator('svg').last()).toBeVisible(); // the chevron (after the trophy)
      }
      // Never stretched: below 1280 the cards in one column ≤ 720, centred; from 1280 on the shell's
      // left gutter (the h1's edge, as /notificari), ≤ 840 — never a centred island.
      const card = (await page.getByTestId('notifications-master').boundingBox())!;
      const h1 = (await page.getByRole('heading', { level: 1, name: 'Notificări' }).boundingBox())!;
      const back = (await page.getByRole('button', { name: 'Înapoi' }).boundingBox())!;
      if (width < 1280) {
        expect(card.width).toBeLessThanOrEqual(720);
        if (width >= 768) expect(Math.abs(card.x + card.width / 2 - width / 2)).toBeLessThan(12);
      } else {
        expect(card.width).toBeLessThanOrEqual(840);
        const main = (await page.locator('main').boundingBox())!;
        expect(card.x - main.x).toBeLessThanOrEqual(40); // the shell's own gutter (24–32), not centred
        expect(Math.abs(back.x - card.x)).toBeLessThan(2); // the header on the cards' edge
      }
      expect(h1.x).toBeGreaterThan(back.x);
      // No crumb band over the header: its back control owns the way back.
      await expect(page.getByRole('navigation', { name: 'Cale de navigare' })).toHaveCount(0);
      await expectNoA11yViolations(page);
    }
    // Nothing about browser push.
    await expect(page.locator('main')).not.toContainText(/browser|navigator|push/i);
    expect(errors).toEqual([]);
  });

  test('c3 — the real PATCH: flips at once, sends {enabled}, refetches the profile; keyboard operable', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await open(page, { width: 1280 });
    await expect(master(page)).toBeVisible();
    const target = !originalEnabled;

    const patch = page.waitForRequest((r) => r.url().includes('/api/cms/notifications/enable-disable-pns') && r.method() === 'PATCH');
    const refetch = page.waitForResponse(
      (r) => r.url().includes('/api/cms/user/profile') && r.request().method() === 'GET' && r.status() === 200,
    );
    // Keyboard: focus the switch and press Space.
    await master(page).focus();
    realToggled = true;
    await page.keyboard.press('Space');
    // Flipped immediately (optimistic), before the CMS answered.
    if (target) await expect(master(page)).toBeChecked();
    else await expect(master(page)).not.toBeChecked();
    const req = await patch;
    expect(req.postDataJSON()).toEqual({ enabled: target });
    const after = await (await refetch).json();
    expect(Boolean(after.notificationsEnabled)).toBe(target);
    // c5 follows the new value.
    if (target) await expect(followed(page)).toHaveAttribute('href', '/setari/notificari/concursuri');
    else await expect(page.getByRole('link', { name: FOLLOWED })).toHaveAttribute('aria-disabled', 'true');

    // Enter toggles too (as a tap), back to the original value — through the real PATCH.
    const back = page.waitForResponse((r) => r.url().includes('/api/cms/notifications/enable-disable-pns') && r.request().method() === 'PATCH');
    await master(page).focus();
    await page.keyboard.press('Enter');
    expect((await back).ok()).toBe(true);
    if (originalEnabled) await expect(master(page)).toBeChecked();
    else await expect(master(page)).not.toBeChecked();
    expect(errors).toEqual([]);
  });

  test('c3 toggle pending: the new value shows at once and the switch is aria-busy until the CMS answers', async ({ page }) => {
    await mockProfile(page, { notificationsEnabled: true });
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    await page.route(TOGGLE, async (r: Route) => {
      await gate;
      await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
    });
    await open(page);
    await expect(master(page)).toBeChecked();
    // After the PATCH the mocked GET still says «on» — the point here is the in-flight state only.
    await page.getByText(MASTER, { exact: true }).click();
    await expect(master(page)).not.toBeChecked();
    await expect(master(page)).toHaveAttribute('aria-busy', 'true');
    await expect(competitionsCard(page)).toHaveCSS('opacity', '0.5');
    await expectNoA11yViolations(page);
    release();
    await expect(master(page)).not.toHaveAttribute('aria-busy', 'true');
  });

  test('c3 toggle failure: the switch rolls back and the site toast says so', async ({ page }) => {
    const errors = collectConsoleErrors(page, { ignore: EXPECTED_CONSOLE });
    await mockProfile(page, { notificationsEnabled: true });
    const patches: unknown[] = [];
    await page.route(TOGGLE, (r) => {
      patches.push(r.request().postDataJSON());
      return r.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ data: null, error: { status: 500, name: 'InternalServerError', message: 'x' } }) });
    });
    await open(page, { width: 1280 });
    await expect(master(page)).toBeChecked();
    const refetch = page.waitForRequest((r) => r.url().includes('/api/cms/user/profile') && r.method() === 'GET');
    await master(page).click();
    await expect(page.getByRole('alert').filter({ hasText: TOGGLE_FAILED })).toBeVisible();
    await expect(master(page)).toBeChecked();
    await refetch; // settled → the profile is read again
    await expect(master(page)).toBeChecked();
    await expect(followed(page)).toHaveAttribute('href', '/setari/notificari/concursuri');
    expect(patches).toEqual([{ enabled: false }]);
    expect(errors).toEqual([]);
  });

  test('c3 toggle failure with the CMS down: the settle refetch fails too, the screen stays (no error card)', async ({ page }) => {
    const errors = collectConsoleErrors(page, { ignore: EXPECTED_CONSOLE });
    let down = false;
    let failedReads = 0;
    await page.route(PROFILE, (r) => {
      if (r.request().method() !== 'GET') return r.fallback();
      if (down) return failedReads++, r.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ data: null, error: { status: 503, name: 'ServiceUnavailableError', message: 'down' } }) });
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...profileJson, notificationsEnabled: true }) });
    });
    await page.route(TOGGLE, (r) =>
      r.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ data: null, error: { status: 500, name: 'InternalServerError', message: 'x' } }) }),
    );
    await open(page, { width: 1280 });
    await expect(master(page)).toBeChecked();
    down = true;
    await master(page).click();
    await expect(page.getByRole('alert').filter({ hasText: TOGGLE_FAILED })).toBeVisible();
    // The settle refetch and the client's 2 retries (lib/client/query-client.ts) all fail: the query
    // is now in status 'error' with the last data — the rows stay, rolled back.
    await expect.poll(() => failedReads, { timeout: 15_000 }).toBe(3);
    await page.waitForTimeout(300);
    await expect(master(page)).toBeVisible();
    await expect(master(page)).toBeChecked();
    await expect(followed(page)).toHaveAttribute('href', '/setari/notificari/concursuri');
    await expect(page.getByRole('button', { name: 'Încearcă din nou' })).toHaveCount(0);
    await expect(page.getByText('Nu am putut încărca setările')).toHaveCount(0);
    // A failed refetch on focus keeps it too.
    await page.evaluate(() => {
      window.dispatchEvent(new Event('visibilitychange'));
      window.dispatchEvent(new Event('focus'));
    });
    await expect.poll(() => failedReads, { timeout: 15_000 }).toBe(6);
    await page.waitForTimeout(300);
    await expect(master(page)).toBeChecked();
    await expect(page.getByRole('button', { name: 'Încearcă din nou' })).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('c3 one save at a time: a double click while the PATCH is in flight sends one PATCH, no flicker', async ({ page }) => {
    await mockProfile(page, { notificationsEnabled: true });
    const patches: unknown[] = [];
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    await page.route(TOGGLE, async (r: Route) => {
      patches.push(r.request().postDataJSON());
      await gate;
      await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
    });
    await open(page, { width: 1280 });
    await expect(master(page)).toBeChecked();
    await master(page).dblclick();
    await expect(master(page)).not.toBeChecked();
    await expect(master(page)).toHaveAttribute('aria-busy', 'true');
    // A third click while pending: ignored too.
    await master(page).click();
    await expect(master(page)).not.toBeChecked();
    // Record every value the switch shows from here on: it must never flip back while in flight.
    await master(page).evaluate((el) => {
      const seen: boolean[] = [];
      (window as unknown as { __seen: boolean[] }).__seen = seen;
      new MutationObserver(() => seen.push((el as HTMLInputElement).checked)).observe(el, { attributes: true });
      const id = setInterval(() => seen.push((el as HTMLInputElement).checked), 10);
      setTimeout(() => clearInterval(id), 1500);
    });
    await page.waitForTimeout(300);
    expect(patches).toEqual([{ enabled: false }]);
    // The CMS says «off» from now on: the settle refetch confirms it.
    await page.unroute(PROFILE);
    await mockProfile(page, { notificationsEnabled: false });
    release();
    await expect(master(page)).not.toHaveAttribute('aria-busy', 'true');
    await page.waitForTimeout(1300);
    const seen = await page.evaluate(() => (window as unknown as { __seen: boolean[] }).__seen);
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((v) => v === false)).toBe(true);
    expect(patches).toEqual([{ enabled: false }]);
    // After the save a toggle goes through again.
    await master(page).click();
    await expect.poll(() => patches).toEqual([{ enabled: false }, { enabled: true }]);
  });

  test('entry point: reached by a click — /notificari (gear 768–1279, summary row from 1280), Profil → Setări on a phone', async ({ page }) => {
    await mockProfile(page, { notificationsEnabled: true });
    await signIn(page.context(), jwt);
    // Phone (fish, §4b rule 25): the Profil tab → its cog «Setări» (the hub) → «Notificări».
    await page.setViewportSize({ width: 375, height: 900 });
    await page.goto('/');
    await page.locator('nav[data-tab-bar]').getByRole('link', { name: 'Profil', exact: true }).click();
    await expect(page).toHaveURL(/\/profil$/);
    await page.getByTestId('profile-settings-button').filter({ visible: true }).click();
    await expect(page).toHaveURL(/\/setari$/);
    await page.getByRole('main').getByRole('link', { name: 'Notificări', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${PATH}$`));
    await expect(master(page)).toBeVisible();
    // The /notificari header keeps its title whole on a phone (no fourth tool there).
    await page.goto('/notificari');
    const title = page.getByRole('heading', { level: 1, name: 'Notificări' });
    await expect(title).toBeVisible();
    expect(await title.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    for (const width of [768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/notificari');
      const link = page.getByRole('main').getByRole('link', { name: 'Setări notificări' });
      await expect(link).toHaveCount(1, { timeout: 30_000 });
      await expect(link).toBeVisible();
      await link.click();
      await expect(page).toHaveURL(new RegExp(`${PATH}$`));
      await expect(master(page)).toBeVisible();
      // «Înapoi» returns to the list it came from.
      await page.getByRole('button', { name: 'Înapoi' }).click();
      await expect(page).toHaveURL(/\/notificari$/);
    }
  });

  test('c5 — master off: CONCURSURI at half opacity, its row aria-disabled and not a link; axe', async ({ page }) => {
    await mockProfile(page, { notificationsEnabled: false });
    await open(page);
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      await expect(master(page)).not.toBeChecked();
      await expect(competitionsCard(page)).toHaveCSS('opacity', '0.5');
      const row = page.getByRole('link', { name: FOLLOWED });
      await expect(row).toHaveAttribute('aria-disabled', 'true');
      await expect(row).not.toHaveAttribute('href');
      expect(await row.evaluate((el) => el.tagName)).not.toBe('A');
      await row.click({ force: true });
      await expect(page).toHaveURL(new RegExp(`${PATH}$`));
      await expectNoA11yViolations(page);
    }
    // Not a tab stop: Tab from the switch leaves the column.
    await master(page).focus();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: FOLLOWED })).not.toBeFocused();
    // null (never set) reads as off, as fish's Boolean().
    await page.unroute(PROFILE);
    await mockProfile(page, { notificationsEnabled: null });
    await page.reload();
    await expect(master(page)).not.toBeChecked();
  });

  test('c4 — the row opens the followed-competition preferences', async ({ page }) => {
    await mockProfile(page, { notificationsEnabled: true });
    await open(page, { width: 1280 });
    await followed(page).click();
    await expect(page).toHaveURL(/\/setari\/notificari\/concursuri$/);
  });

  test('loading: the skeleton in the rows’ shape, announced, under the real header', async ({ page }) => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    await page.route(PROFILE, async (r) => {
      if (r.request().method() !== 'GET') return r.fallback();
      await gate;
      await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(profileJson) });
    });
    await open(page);
    await expect(page.getByRole('heading', { level: 1, name: 'Notificări' })).toBeVisible();
    const status = page.getByRole('status').filter({ hasText: 'Se încarcă setările…' });
    await expect(status).toBeAttached();
    // Announced outside the busy region (aria-busy holds a subtree's updates back from assistive tech).
    expect(await status.evaluate((el) => el.closest('[aria-busy="true"]'))).toBeNull();
    await expect(page.locator('[aria-busy="true"]').first()).toBeAttached();
    await expect(master(page)).toHaveCount(0);
    await expectNoA11yViolations(page);
    release();
    await expect(master(page)).toBeVisible();
  });

  test('profile error: the error card with «Încearcă din nou», which recovers', async ({ page }) => {
    const errors = collectConsoleErrors(page, { ignore: EXPECTED_CONSOLE });
    let fail = true;
    await page.route(PROFILE, (r) => {
      if (r.request().method() !== 'GET') return r.fallback();
      if (fail) return r.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ data: null, error: { status: 503, name: 'ServiceUnavailableError', message: 'down' } }) });
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(profileJson) });
    });
    await open(page, { width: 1280 });
    const retry = page.getByRole('button', { name: 'Încearcă din nou' });
    await expect(retry).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('heading', { level: 1, name: 'Notificări' })).toBeVisible();
    await expect(master(page)).toHaveCount(0);
    await expectNoA11yViolations(page);
    fail = false;
    await retry.click();
    await expect(master(page)).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('c1 back: returns to the page that opened it, else the fallback', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await signIn(page.context(), jwt);
    await page.goto('/notificari');
    await page.goto(PATH);
    await expect(master(page)).toBeVisible();
    await page.getByRole('button', { name: 'Înapoi' }).click();
    await expect(page).toHaveURL(/\/notificari$/);

    // Opened directly (no same-origin history): Setări once it ships, Acasă until then — a page that exists.
    const fresh = await page.context().newPage();
    await fresh.setViewportSize({ width: 375, height: 900 });
    await fresh.goto(PATH);
    await expect(master(fresh)).toBeVisible();
    await fresh.getByRole('button', { name: 'Înapoi' }).click();
    await expect(fresh).toHaveURL(/\/(setari)?$/);
    await expect(fresh.getByRole('heading', { level: 1 })).toBeVisible();
  });
});
