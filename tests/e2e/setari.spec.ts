import { expect, test, type Page } from '@playwright/test';
import { expectNoA11yViolations } from './helpers/a11y';
import { collectConsoleErrors } from './helpers/console';
import { CMS, qaJwt, signIn } from './helpers/session';

/*
 * account.settings (/setari) — fish app/(app)/settings.tsx, OrganizerRoleRequestSheet.tsx,
 * Contact.tsx + ContactSheet.tsx, AuthContext.tsx signOut, useDeleteProfile, useRequestOrganizerRole.
 *
 * Data: the local QA user against the LOCAL CMS; the profile read is real unless a test mocks it
 * (organizer states, phone, placeholders). WRITES are never real: POST /user/organizer-request and
 * DELETE /user/profile are route-mocked (the QA user is never flagged or anonymised). Sign-out is
 * real (it only drops the web's cookie; the JWT is stateless) and each test signs in again with the
 * QA user's token (tests/qa-user.ts via helpers/session). No Firestore.
 */

const PATH = '/setari';
const PROFILE = '**/api/cms/user/profile';
const ORGANIZER_REQUEST = '**/api/cms/user/organizer-request';
const WIDTHS = [375, 768, 1280, 1440, 1920] as const;
const AXE_WIDTHS = [375, 768, 1280, 1440] as const;
const EXPECTED_CONSOLE = [/Failed to load resource: the server responded with a status of (401|500|503)/];

let jwt: string;
let profileJson: Record<string, unknown>;

test.beforeAll(async ({ request }) => {
  jwt = await qaJwt(request);
  const res = await request.get(`${CMS}/user/profile`, { headers: { authorization: `Bearer ${jwt}` } });
  expect(res.ok(), 'QA profile read').toBe(true);
  profileJson = await res.json();
});

const role = (name: string) => ({ id: 1, documentId: 'role-doc', name });

/** GET /user/profile answers the real profile plus `patch` (a function: re-read on every GET). */
async function mockProfile(page: Page, patch: Record<string, unknown> | (() => Record<string, unknown>)) {
  let gets = 0;
  await page.route(PROFILE, (r) => {
    if (r.request().method() !== 'GET') return r.fallback();
    gets += 1;
    const p = typeof patch === 'function' ? patch() : patch;
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...profileJson, ...p }) });
  });
  return { gets: () => gets };
}

async function open(page: Page, { width = 375, signedIn = true }: { width?: number; signedIn?: boolean } = {}) {
  await page.setViewportSize({ width, height: 900 });
  if (signedIn) await signIn(page.context(), jwt);
  await page.goto(PATH);
}

const h1 = (page: Page) => page.getByRole('heading', { level: 1, name: 'Setări' });
const loaded = (page: Page) => expect(page.getByTestId('settings-profile-card')).toBeVisible();
const organizerRow = (page: Page) => page.getByTestId('organizer-row');
const toastText = (page: Page, text: string) => page.getByText(text, { exact: true });
/** axe after every transition has finished (a dialog's fade-in reads as low contrast mid-way). */
async function axe(page: Page) {
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'));
  await expectNoA11yViolations(page);
}
const sessionCookie = async (page: Page) => (await page.context().cookies()).find((c) => c.name === 'bluvi_session');

test.describe('account.settings — signed out', () => {
  test('signed out: a real 307 to /intra?next=%2Fsetari; in a browser, and with a dead cookie, sign-in with the return path', async ({ page, request }) => {
    const res = await request.get(PATH, { maxRedirects: 0 });
    expect(res.status()).toBe(307);
    const loc = new URL(res.headers().location, 'http://x');
    expect(loc.pathname + loc.search).toBe('/intra?next=%2Fsetari');
    await open(page, { signedIn: false });
    await expect(page).toHaveURL(/\/intra\?next=%2Fsetari$/);
    await page.context().addCookies([{ name: 'bluvi_session', value: 'dead-token', url: page.url() }]);
    await page.goto(PATH);
    await expect(page).toHaveURL(/\/intra\?next=%2Fsetari$/);
  });
});

test.describe('account.settings', () => {
  test('c2 c3 c4 c14 c15 c16 — header, cards, facts, legal links; three columns from 1280; axe at every width', async ({ page }) => {
    const errors = collectConsoleErrors(page, { ignore: EXPECTED_CONSOLE });
    await mockProfile(page, {
      phone: '0712345678',
      createdAt: '2025-11-05T10:00:00.000Z',
      provider: 'google',
      role: role('Authenticated'),
      hasRequestedOrganizerRole: false,
    });
    await open(page);
    await loaded(page);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      // c2
      await expect(h1(page)).toBeVisible();
      await expect(page.getByRole('button', { name: 'Înapoi' })).toBeVisible();
      await expect(page.getByRole('navigation', { name: 'Cale de navigare' })).toHaveCount(0);
      // c3: the card → edit profile; username + email.
      const card = page.getByTestId('settings-profile-card');
      await expect(card).toHaveAttribute('href', '/setari/profil');
      await expect(card).toContainText(String(profileJson.username));
      await expect(card).toContainText(String(profileJson.email));
      // c4
      await expect(page.getByRole('main').getByRole('link', { name: 'Notificări', exact: true })).toHaveAttribute('href', '/setari/notificari');
      // c13: /rezervari is M3 (ON_WEB.myBookings false) — no row to the 404.
      await expect(page.getByText('Rezervările mele')).toHaveCount(0);
      await expect(page.locator('a[href="/rezervari"]')).toHaveCount(0);
      // c14: the own reputation block.
      await expect(page.getByTestId('reputation').getByRole('heading', { level: 2, name: 'Reputație' })).toBeVisible();
      // c15
      const info = page.getByTestId('settings-info');
      await expect(page.getByRole('heading', { level: 2, name: 'Informații' })).toBeVisible();
      await expect(info.locator('div', { hasText: 'Email' })).toContainText(String(profileJson.email));
      await expect(info.locator('div', { hasText: 'Telefon' })).toContainText('0712 345 678');
      await expect(info.locator('div', { hasText: 'Activ de la' })).toContainText('05 noi 2025');
      await expect(info.locator('div', { hasText: 'Autentificat cu' })).toContainText('Google');
      // c16: Termly in a new tab; «Setări de confidențialitate» waits for the M8 consent banner.
      const terms = page.getByRole('link', { name: /^Termeni și condiții/ });
      await expect(terms).toHaveAttribute('href', /termly\.io.*14bbf816/);
      await expect(terms).toHaveAttribute('target', '_blank');
      const privacy = page.getByRole('link', { name: /^Politica de confidențialitate/ });
      await expect(privacy).toHaveAttribute('href', /termly\.io.*958c9787/);
      await expect(privacy).toHaveAttribute('target', '_blank');
      await expect(page.getByText('Setări de confidențialitate')).toHaveCount(0);
      // c17, c18, c19 entry points.
      await expect(page.getByRole('button', { name: 'Contactează-ne' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Deconectare' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Șterge contul' })).toBeVisible();

      // Layout: phone/tablet one column in fish's order; from 1280 three columns side by side —
      // left profile + INFORMAȚII, centre actions + Reputație (the widest), right legal → leave —
      // filling the shell: the right column and «Reîmprospătează» end on the top bar's content edge.
      const box = async (id: string) => (await page.getByTestId(id).boundingBox())!;
      const profileCard = await box('settings-profile-card');
      const actions = await box('settings-actions');
      const rep = await box('reputation');
      const infoBox = await box('settings-info');
      const legal = await box('settings-legal');
      if (width < 1280) {
        expect(profileCard.y).toBeLessThan(actions.y);
        expect(actions.y).toBeLessThan(rep.y);
        expect(rep.y).toBeLessThan(infoBox.y);
        expect(infoBox.y).toBeLessThan(legal.y);
        expect(profileCard.width).toBeLessThanOrEqual(720);
        expect(Math.abs(profileCard.x - actions.x)).toBeLessThan(2);
      } else {
        expect(profileCard.x + profileCard.width).toBeLessThan(actions.x);
        expect(actions.x + actions.width).toBeLessThan(legal.x);
        expect(Math.abs(profileCard.y - actions.y)).toBeLessThan(2);
        expect(Math.abs(actions.y - legal.y)).toBeLessThan(2);
        // INFORMAȚII under the profile card, Reputație under the actions card, in the wide centre.
        expect(Math.abs(infoBox.x - profileCard.x)).toBeLessThan(2);
        expect(infoBox.y).toBeGreaterThan(profileCard.y);
        expect(Math.abs(rep.x - actions.x)).toBeLessThan(26);
        expect(rep.y).toBeGreaterThan(actions.y);
        expect(actions.width).toBeGreaterThan(legal.width);
        // The shell's content edge: the window less 32 gutters, the shell capped at 1744 and centred.
        const edge = (width + Math.min(width, 1744)) / 2 - 32;
        expect(Math.abs(legal.x + legal.width - edge)).toBeLessThan(2);
        const refresh = (await page.getByRole('button', { name: 'Reîmprospătează' }).filter({ visible: true }).boundingBox())!;
        // The ghost button's 12px padding hangs past the edge (DashboardRefresh md:-mr-3): its label ends on it.
        expect(Math.abs(refresh.x + refresh.width - 12 - edge)).toBeLessThan(2);
        const avatar = (await page.getByRole('banner').getByRole('button', { name: /^Contul meu, / }).filter({ visible: true }).boundingBox())!;
        expect(Math.abs(avatar.x + avatar.width - edge)).toBeLessThan(2);
      }
      await page.screenshot({ path: `test-results/setari-${width}.png`, fullPage: true });
      if ((AXE_WIDTHS as readonly number[]).includes(width)) await axe(page);
    }
    expect(errors).toEqual([]);
  });

  test('c14 layout — an angler with reviews: Reputație in the wide centre column at 1280/1440/1920, never squeezed into a side column', async ({ page }) => {
    const review = (i: number) => ({
      stars: 5 - (i % 2),
      comment: i % 2 ? null : 'Respectă regulamentul, lasă standul curat și vine la ora stabilită.',
      authorName: `Operator ${i + 1}`,
      lakeName: 'Balta Test',
      createdAt: `2026-0${9 - i}-01T10:00:00.000Z`,
      rulesScore: null,
      cleanlinessScore: null,
      behaviorScore: null,
      tags: ['respectsRules'],
    });
    await page.route(/\/feed\/users\/[^/]+\/reputation/, (r) =>
      r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: { avgStars: 4.5, ratingCount: 4, noShowCount: 0, areas: { rules: 5, cleanliness: 4, behavior: 5 }, reviews: [0, 1, 2, 3].map(review) },
        }),
      }),
    );
    await open(page, { width: 1280 });
    await loaded(page);
    await expect(page.getByText('Operator 1')).toBeVisible();
    for (const width of [1280, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      const rep = (await page.getByTestId('reputation').boundingBox())!;
      const actions = (await page.getByTestId('settings-actions').boundingBox())!;
      const legal = (await page.getByTestId('settings-legal').boundingBox())!;
      expect(rep.x).toBeGreaterThan(actions.x);
      expect(rep.x + rep.width).toBeLessThan(legal.x);
      expect(rep.width).toBeGreaterThan(480);
      await page.screenshot({ path: `test-results/setari-reviews-${width}.png`, fullPage: true });
    }
  });

  test('c3 c15 — fallbacks: «Nume de utilizator» and «-» everywhere a value is missing', async ({ page }) => {
    await mockProfile(page, { username: '', email: '', phone: null, createdAt: undefined, provider: null, avatar: null });
    await open(page, { width: 1280 });
    await loaded(page);
    await expect(page.getByTestId('settings-profile-card')).toContainText('Nume de utilizator');
    await expect(page.getByTestId('settings-profile-card')).toContainText('-');
    const values = page.getByTestId('settings-info').locator('dd');
    await expect(values).toHaveText(['-', '-', '-', '-']);
  });

  test('c3 + account.edit-profile.c17 — the profile card opens «Editează profilul»; keyboard path', async ({ page }) => {
    await open(page, { width: 1280 });
    await loaded(page);
    // Keyboard: back → refresh → profile card (the first card, as on screen).
    await page.getByRole('button', { name: 'Înapoi' }).focus();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Reîmprospătează' }).filter({ visible: true })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByTestId('settings-profile-card')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('main').getByRole('link', { name: 'Notificări', exact: true })).toBeFocused();
    await page.getByTestId('settings-profile-card').focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/setari\/profil$/);
  });

  test('c4 — «Notificări» opens /setari/notificari, whose back returns to Setări', async ({ page }) => {
    await open(page, { width: 375 });
    await loaded(page);
    await page.getByRole('main').getByRole('link', { name: 'Notificări', exact: true }).click();
    await expect(page).toHaveURL(/\/setari\/notificari$/);
    await page.getByRole('button', { name: 'Înapoi' }).click();
    await expect(page).toHaveURL(/\/setari$/);
    await expect(h1(page)).toBeVisible();
  });

  test('c1 loading — the full skeleton (busy, announced) until the profile lands', async ({ page }) => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    await page.route(PROFILE, async (r) => {
      await gate;
      await r.fallback();
    });
    await open(page, { width: 1280 });
    await expect(page.getByTestId('settings-skeleton').filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: 'Se încarcă setările…' })).toBeAttached();
    await expect(h1(page)).toBeVisible();
    release();
    await loaded(page);
    await expect(page.getByTestId('settings-skeleton')).toHaveCount(0);
  });

  test('c1 error — the error card with a retry and no back control; the retry recovers', async ({ page }) => {
    const errors = collectConsoleErrors(page, { ignore: EXPECTED_CONSOLE });
    let fail = true;
    await page.route(PROFILE, (r) =>
      fail && r.request().method() === 'GET' ? r.fulfill({ status: 500, contentType: 'application/json', body: '{}' }) : r.fallback(),
    );
    await open(page, { width: 375 });
    await expect(page.getByRole('button', { name: 'Încearcă din nou' })).toBeVisible({ timeout: 30_000 });
    await expect(h1(page)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Înapoi' })).toHaveCount(0);
    await axe(page);
    fail = false;
    await page.getByRole('button', { name: 'Încearcă din nou' }).click();
    await loaded(page);
    expect(errors).toEqual([]);
  });

  test('c20 — «Reîmprospătează» refetches the profile', async ({ page }) => {
    const m = await mockProfile(page, {});
    await open(page, { width: 1440 });
    await loaded(page);
    const before = m.gets();
    await page.getByRole('button', { name: 'Reîmprospătează' }).filter({ visible: true }).click();
    await expect.poll(() => m.gets()).toBeGreaterThan(before);
    await expect(page.getByRole('status').filter({ hasText: 'Actualizat' })).toBeAttached();
  });

  test('c5 c6 c7 — the organizer row by state: «Devino organizator» / «Cerere organizator · În așteptare» / «Organizator»', async ({ page }) => {
    let state: Record<string, unknown> = { role: role('Authenticated'), hasRequestedOrganizerRole: false };
    await mockProfile(page, () => state);
    await open(page, { width: 375 });
    await loaded(page);
    // c5: a button with a chevron.
    await expect(page.getByRole('button', { name: 'Devino organizator' })).toBeVisible();
    // c6
    state = { role: role('Authenticated'), hasRequestedOrganizerRole: true };
    await page.reload();
    await loaded(page);
    await expect(organizerRow(page)).toHaveAttribute('data-state', 'pending');
    await expect(organizerRow(page)).toContainText('Cerere organizator');
    await expect(organizerRow(page)).toContainText('În așteptare');
    await expect(page.getByRole('button', { name: /organizator/i })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /organizator/i })).toHaveCount(0);
    // c7: role Organizer wins, yellow star, not activatable.
    state = { role: role('Organizer'), hasRequestedOrganizerRole: true };
    await page.reload();
    await loaded(page);
    await expect(organizerRow(page)).toHaveAttribute('data-state', 'organizer');
    await expect(organizerRow(page)).toHaveText('Organizator');
    expect(await organizerRow(page).locator('span').first().evaluate((el) => getComputedStyle(el).color)).toBe('rgb(251, 191, 36)');
    await expect(page.getByRole('button', { name: /organizator/i })).toHaveCount(0);
  });

  test('c8 + account.edit-profile.c17 — no phone: the alert, «Închide», then «Editează profil» → /setari/profil; axe on the dialog', async ({ page }) => {
    await mockProfile(page, { role: role('Authenticated'), hasRequestedOrganizerRole: false, phone: null });
    await open(page, { width: 375 });
    await loaded(page);
    const dialog = page.getByRole('alertdialog', { name: 'Nu poți trimite cererea pentru a deveni organizator fără număr de telefon' });
    for (const width of AXE_WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      await page.getByRole('button', { name: 'Devino organizator' }).click();
      await expect(dialog).toBeVisible();
      await expect(dialog).toContainText('Te rugăm să adaugi un număr de telefon în profilul tău pentru a putea trimite cererea');
      await axe(page);
      await dialog.getByRole('button', { name: 'Închide' }).click();
      await expect(dialog).toBeHidden();
      await expect(page.getByRole('button', { name: 'Devino organizator' })).toBeFocused();
    }
    await page.getByRole('button', { name: 'Devino organizator' }).click();
    await dialog.getByRole('link', { name: 'Editează profil' }).click();
    await expect(page).toHaveURL(/\/setari\/profil$/);
  });

  test('c9 c10 c11 c12 — the request panel: validation, trimmed POST (mocked), success toast, refetch → pending; close resets', async ({ page }) => {
    const errors = collectConsoleErrors(page, { ignore: EXPECTED_CONSOLE });
    let requested = false;
    const m = await mockProfile(page, () => ({ role: role('Authenticated'), hasRequestedOrganizerRole: requested, phone: '0712345678' }));
    const posts: unknown[] = [];
    await page.route(ORGANIZER_REQUEST, async (r) => {
      posts.push(r.request().postDataJSON());
      await new Promise((res) => setTimeout(res, 400));
      requested = true;
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 1, documentId: 'organizer-request-doc' }) });
    });
    await open(page, { width: 375 });
    await loaded(page);
    const panelName = 'Devino organizator';
    const panel = page.getByRole('dialog', { name: panelName });

    // c9 at every axe width (sheet on the phone, dialog from 768).
    for (const width of AXE_WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      await page.getByRole('button', { name: 'Devino organizator' }).click();
      await expect(panel).toBeVisible();
      await expect(panel).toContainText('După trimiterea cererii, echipa Bluvi te va contacta');
      const field = panel.getByRole('textbox', { name: 'Mesaj' });
      await expect(field).toHaveAttribute('placeholder', 'Spune-ne despre experiența ta și ce competiții vrei să organizezi...');
      await expect(field).toHaveAttribute('maxlength', '1000');
      await expect(page.getByRole('button', { name: 'Trimite cerere' })).toBeVisible();
      await axe(page);
      // c12: typed, closed, reopened → empty.
      await field.fill('ceva');
      await page.getByRole('button', { name: 'Închide' }).filter({ visible: true }).first().click();
      await expect(panel).toBeHidden();
      await page.getByRole('button', { name: 'Devino organizator' }).click();
      await expect(panel.getByRole('textbox', { name: 'Mesaj' })).toHaveValue('');
      await page.keyboard.press('Escape');
      await expect(panel).toBeHidden();
    }

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByRole('button', { name: 'Devino organizator' }).click();
    const field = panel.getByRole('textbox', { name: 'Mesaj' });
    // c10: empty, then whitespace only → the error, nothing sent.
    await page.getByRole('button', { name: 'Trimite cerere' }).click();
    await expect(panel.getByText('Te rugăm să adaugi un mesaj înainte de a trimite cererea')).toBeVisible();
    await expect(field).toHaveAttribute('aria-invalid', 'true');
    await field.fill('   \n  ');
    await page.getByRole('button', { name: 'Trimite cerere' }).click();
    await expect(panel.getByText('Te rugăm să adaugi un mesaj înainte de a trimite cererea')).toBeVisible();
    expect(posts).toEqual([]);
    await axe(page);

    // c11: keyboard submit; trimmed body; busy; toast; closed; profile refetched → pending row.
    const getsBefore = m.gets();
    await field.fill('  Organizez concursuri la Chita.  ');
    await page.getByRole('button', { name: 'Trimite cerere' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Se trimite…' })).toHaveAttribute('aria-busy', 'true');
    await expect(toastText(page, 'Solicitarea ta a fost trimisă cu succes')).toBeVisible();
    await expect(panel).toBeHidden();
    expect(posts).toEqual([{ message: 'Organizez concursuri la Chita.' }]);
    await expect.poll(() => m.gets()).toBeGreaterThan(getsBefore);
    await expect(organizerRow(page)).toHaveAttribute('data-state', 'pending');
    await expect(organizerRow(page)).toContainText('În așteptare');
    // The «Devino organizator» button the panel returned focus to is gone: focus lands on the
    // pending row, never on <body>.
    await expect(organizerRow(page)).toBeFocused();
    await expect(organizerRow(page)).toHaveAttribute('tabindex', '-1');
    expect(errors).toEqual([]);
  });

  test('c11 failure — a danger toast, the panel stays with the message', async ({ page }) => {
    await mockProfile(page, { role: role('Authenticated'), hasRequestedOrganizerRole: false, phone: '0712345678' });
    await page.route(ORGANIZER_REQUEST, (r) => r.fulfill({ status: 500, contentType: 'application/json', body: '{}' }));
    await open(page, { width: 768 });
    await loaded(page);
    await page.getByRole('button', { name: 'Devino organizator' }).click();
    const panel = page.getByRole('dialog', { name: 'Devino organizator' });
    await panel.getByRole('textbox', { name: 'Mesaj' }).fill('Salut');
    await page.getByRole('button', { name: 'Trimite cerere' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Nu am putut trimite cererea. Încearcă din nou.' })).toBeVisible();
    await expect(panel).toBeVisible();
    await expect(panel.getByRole('textbox', { name: 'Mesaj' })).toHaveValue('Salut');
  });

  test('c17 — «Contactează-ne»: the «Contact» panel, fish copy, tel: (logs contact_pressed) and mailto:; axe', async ({ page }) => {
    await open(page, { width: 375 });
    await loaded(page);
    await page.evaluate(() => {
      const w = window as unknown as { __events: unknown[] };
      w.__events = [];
      window.addEventListener('bluvi:analytics', (e) => w.__events.push((e as CustomEvent).detail));
    });
    for (const width of AXE_WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      await page.getByRole('button', { name: 'Contactează-ne' }).click();
      const panel = page.getByRole(width < 768 ? 'dialog' : 'alertdialog', { name: 'Contact' });
      await expect(panel).toBeVisible();
      await expect(panel).toContainText('Ai nevoie de ajutor sau ai întrebări? Suntem aici pentru tine!');
      await expect(panel.getByRole('link', { name: '+40 733 017 091' })).toHaveAttribute('href', 'tel:+40733017091');
      await expect(panel.getByRole('link', { name: /@wearetribus\.com$/ })).toHaveAttribute('href', /^mailto:.+@wearetribus\.com$/);
      await axe(page);
      if (width === 375) {
        // Do not follow tel: — just fire the click handler.
        await panel.getByRole('link', { name: '+40 733 017 091' }).evaluate((a) => {
          a.addEventListener('click', (e) => e.preventDefault(), { once: true });
          (a as HTMLAnchorElement).click();
        });
        const events = await page.evaluate(() => (window as unknown as { __events: unknown[] }).__events);
        expect(events).toContainEqual({ name: 'contact_pressed', params: { contact_type: 'Bluvi support contact' } });
      }
      await page.keyboard.press('Escape');
      await expect(panel).toBeHidden();
    }
  });

  test('c18 account.b.sign-out — «Deconectare» confirm: «Închide» keeps the session; «Deconectare» drops it and lands on /intra signed out', async ({ page }) => {
    const errors = collectConsoleErrors(page, { ignore: EXPECTED_CONSOLE });
    await open(page, { width: 375 });
    await loaded(page);
    const dialog = page.getByRole('alertdialog', { name: 'Ești sigur că dorești să te deconectezi?' });
    for (const width of AXE_WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      await page.getByRole('button', { name: 'Deconectare' }).click();
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole('button', { name: 'Închide' })).toBeFocused();
      await axe(page);
      await dialog.getByRole('button', { name: 'Închide' }).click();
      await expect(dialog).toBeHidden();
    }
    expect(await sessionCookie(page)).toBeTruthy();
    const logout = page.waitForRequest((r) => r.url().endsWith('/api/auth/logout') && r.method() === 'POST');
    await page.getByRole('button', { name: 'Deconectare' }).click();
    await dialog.getByRole('button', { name: 'Deconectare' }).click();
    await logout;
    await expect(page).toHaveURL(/\/intra$/);
    expect(await sessionCookie(page)).toBeUndefined();
    await expect(page.getByRole('banner').getByRole('button', { name: /^Contul meu, / })).toHaveCount(0);
    // Never the «session expired» flow for a sign-out the user asked for.
    await expect(page.getByText('Sesiunea ta a expirat. Te rugăm să te autentifici din nou.')).toHaveCount(0);
    // Signed in again with the QA user: back to Setări.
    await signIn(page.context(), jwt);
    await page.goto(PATH);
    await loaded(page);
    expect(errors).toEqual([]);
  });

  test('account.b.sign-out — a failing logout changes nothing (still signed in, still on Setări) and says «A apărut o problemă…»; a retry signs out', async ({ page }) => {
    await open(page, { width: 1280 });
    await loaded(page);
    await page.route('**/api/auth/logout', (r) => r.fulfill({ status: 500, body: '' }));
    await page.getByRole('button', { name: 'Deconectare' }).click();
    const dialog = page.getByRole('alertdialog', { name: 'Ești sigur că dorești să te deconectezi?' });
    await dialog.getByRole('button', { name: 'Deconectare' }).click();
    await expect(page.getByText('A apărut o problemă. Te rugăm să încerci mai târziu.')).toBeVisible();
    // The cookie is still there, so nothing moved: same URL, the cards, the top bar's avatar, and the
    // confirm usable again.
    await expect(page).toHaveURL(/\/setari$/);
    expect(await sessionCookie(page)).toBeTruthy();
    await expect(page.getByTestId('settings-profile-card')).toBeVisible();
    await expect(page.getByTestId('settings-info')).toBeVisible();
    await expect(page.getByRole('banner').getByRole('button', { name: /^Contul meu, / }).filter({ visible: true })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Deconectare' })).not.toHaveAttribute('aria-disabled', 'true');
    // Still a live session: the profile reads fine.
    const res = await page.request.get('/api/cms/user/profile');
    expect(res.ok()).toBe(true);
    await page.unroute('**/api/auth/logout');
    await dialog.getByRole('button', { name: 'Deconectare' }).click();
    await expect(page).toHaveURL(/\/intra$/);
    expect(await sessionCookie(page)).toBeUndefined();
  });

  test('account.b.sign-out — the top bar\'s «Ieși din cont» is the same sign-out (the gate then asks to sign in again)', async ({ page }) => {
    await open(page, { width: 1440 });
    await loaded(page);
    await page.getByRole('banner').getByRole('button', { name: /^Contul meu, / }).filter({ visible: true }).click();
    // ON_WEB.settings: the account menu offers Setări.
    await expect(page.getByRole('menuitem', { name: 'Setări', exact: true })).toBeVisible();
    await page.getByRole('menuitem', { name: 'Ieși din cont' }).click();
    await expect(page).toHaveURL(/\/intra\?next=%2Fsetari$/);
    expect(await sessionCookie(page)).toBeUndefined();
    await expect(page.getByText('Sesiunea ta a expirat. Te rugăm să te autentifici din nou.')).toHaveCount(0);
  });

  test('c19 account.b.profile-cache — «Șterge contul»: confirm, DELETE /user/profile (mocked), then signed out on /intra; axe on the dialog', async ({ page }) => {
    const errors = collectConsoleErrors(page, { ignore: EXPECTED_CONSOLE });
    const deletes: string[] = [];
    await page.route(PROFILE, (r) => {
      if (r.request().method() !== 'DELETE') return r.fallback();
      deletes.push(r.request().url());
      return r.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });
    await open(page, { width: 375 });
    await loaded(page);
    const del = page.getByRole('button', { name: 'Șterge contul' });
    const dialog = page.getByRole('alertdialog', { name: 'Ești sigur că îți dorești să ștergi contul?' });
    for (const width of AXE_WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      await del.click();
      await expect(dialog).toBeVisible();
      await expect(dialog).toContainText('Această acțiune este ireversibilă');
      await axe(page);
      await dialog.getByRole('button', { name: 'Închide' }).click();
      await expect(dialog).toBeHidden();
    }
    expect(deletes).toEqual([]);
    await del.click();
    await dialog.getByRole('button', { name: 'Ștergere' }).click();
    await expect(page).toHaveURL(/\/intra$/);
    expect(deletes).toHaveLength(1);
    expect(await sessionCookie(page)).toBeUndefined();
    await expect(page.getByText('Sesiunea ta a expirat. Te rugăm să te autentifici din nou.')).toHaveCount(0);
    // The QA account is untouched (the DELETE never reached the CMS).
    const check = await page.request.get(`${CMS}/user/profile`, { headers: { authorization: `Bearer ${jwt}` } });
    expect(check.ok()).toBe(true);
    expect((await check.json()).email).toBe(profileJson.email);
    expect(errors).toEqual([]);
  });

  test('c19 failure — a failed DELETE keeps the session and the dialog, and says so', async ({ page }) => {
    await page.route(PROFILE, (r) =>
      r.request().method() === 'DELETE' ? r.fulfill({ status: 500, contentType: 'application/json', body: '{}' }) : r.fallback(),
    );
    await open(page, { width: 1280 });
    await loaded(page);
    await page.getByRole('button', { name: 'Șterge contul' }).click();
    const dialog = page.getByRole('alertdialog', { name: 'Ești sigur că îți dorești să ștergi contul?' });
    await dialog.getByRole('button', { name: 'Ștergere' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Nu am putut șterge contul. Încearcă din nou.' })).toBeVisible();
    await expect(page).toHaveURL(/\/setari$/);
    await expect(dialog).toBeVisible();
    expect(await sessionCookie(page)).toBeTruthy();
  });
});
