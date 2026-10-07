import { expect, test, type Page, type Request, type Route } from '@playwright/test';
import { expectNoA11yViolations } from './helpers/a11y';
import { collectConsoleErrors } from './helpers/console';
import { CMS, qaJwt, signIn } from './helpers/session';

/*
 * account.edit-profile (/setari/profil, T6) + account.b.signed-out-gate (mechanism) +
 * account.b.profile-cache (the screen's read). fish: app/(app)/edit-profile.tsx,
 * components/EditProfileScreen.tsx.
 *
 * Data: the local QA user against the LOCAL CMS. The profile read is real unless a test mocks it.
 * Writes:
 * - every avatar change is route-mocked end to end (POST /upload AND the PATCH): the CMS deletes
 *   the previous avatar file when a PATCH carries `avatar`, so a real one could not be undone, and
 *   uploads land in a shared S3 bucket;
 * - the one real PATCH (c11/c12/c15/c16) changes text fields only and the original username, phone
 *   and bio are written back in afterEach (read in beforeAll).
 * DiceBear is mocked (a small SVG with CORS), so the generated avatar never needs the network.
 */

const PATH = '/setari/profil';
const PROFILE = '**/api/cms/user/profile';
const UPLOAD = '**/api/cms/upload';
const WIDTHS = [375, 1280, 1440, 1920] as const;
const SAVED_TOAST = 'Profilul a fost actualizat cu succes';
const GENERIC = 'A apărut o eroare necunoscută. Te rugăm să reîncerci mai târziu.';
/** Failed requests the specs provoke on purpose (mocked 4xx/5xx) are logged by the browser. */
const EXPECTED_CONSOLE = [/Failed to load resource: the server responded with a status of (400|500|503)/];

type Original = { id: number; documentId: string; username: string; phone: string | null; bio: string | null; provider: string | null };
let jwt: string;
let original: Original;
let profileJson: Record<string, unknown>;
let realPatched = false;

const AVATAR_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" fill="#3b82f6"/><circle cx="32" cy="28" r="14" fill="#ffd6c0"/></svg>';
/** An 8×8 PNG (the picked photo). */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEUlEQVR4nGM4YWODFTEMLQkAZZlQAVIPr1MAAAAASUVORK5CYII=',
  'base64',
);

test.beforeAll(async ({ request }) => {
  jwt = await qaJwt(request);
  const res = await request.get(`${CMS}/user/profile`, { headers: { authorization: `Bearer ${jwt}` } });
  expect(res.ok(), 'QA profile read').toBe(true);
  profileJson = await res.json();
  original = {
    id: profileJson.id as number,
    documentId: profileJson.documentId as string,
    username: profileJson.username as string,
    phone: (profileJson.phone as string | null) ?? null,
    bio: (profileJson.bio as string | null) ?? null,
    provider: (profileJson.provider as string | null) ?? null,
  };
});

test.afterEach(async ({ request }) => {
  if (!realPatched) return;
  realPatched = false;
  const res = await request.patch(`${CMS}/user/profile`, {
    headers: { authorization: `Bearer ${jwt}` },
    data: { username: original.username, phone: original.phone, bio: original.bio },
  });
  expect(res.status(), 'QA profile restored').toBeLessThan(300);
});

async function mockDicebear(page: Page) {
  await page.route('https://api.dicebear.com/**', (r) =>
    r.fulfill({ status: 200, contentType: 'image/svg+xml', headers: { 'access-control-allow-origin': '*' }, body: AVATAR_SVG }),
  );
}

/** Answers GET /user/profile with the real profile plus `patch` (other methods fall through). */
async function mockProfile(page: Page, patch: Record<string, unknown>) {
  await page.route(PROFILE, (r) =>
    r.request().method() === 'GET'
      ? r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...profileJson, ...patch }) })
      : r.fallback(),
  );
}

/** Mocks PATCH /user/profile: records the bodies, answers `answer` (default 204). */
async function mockPatch(page: Page, answer?: (route: Route) => Promise<void>) {
  const bodies: Record<string, unknown>[] = [];
  await page.route(PROFILE, async (r) => {
    if (r.request().method() !== 'PATCH') return r.fallback();
    bodies.push(r.request().postDataJSON() as Record<string, unknown>);
    if (answer) return answer(r);
    return r.fulfill({ status: 204, body: '' });
  });
  return bodies;
}

const bluError = (bluCode: string, message: string) => (r: Route) =>
  r.fulfill({
    status: 400,
    contentType: 'application/json',
    body: JSON.stringify({ data: null, error: { status: 400, name: 'BadRequestError', message, details: { bluCode } } }),
  });

async function open(page: Page, { width = 375, signedIn = true }: { width?: number; signedIn?: boolean } = {}) {
  await page.setViewportSize({ width, height: 900 });
  if (signedIn) await signIn(page.context(), jwt);
  await mockDicebear(page);
  await page.goto(PATH);
}

const username = (page: Page) => page.getByLabel('Nume utilizator*');
const phone = (page: Page) => page.getByLabel('Telefon (opțional)');
const bio = (page: Page) => page.getByLabel('Biografie');
/** The visible «Finalizează» (the bar below 1280, docked under the preview from 1280). */
const submit = (page: Page) => page.getByRole('button', { name: 'Finalizează' }).filter({ visible: true });
const avatarImg = (page: Page) => page.getByRole('button', { name: 'Schimbă fotografia de profil' }).locator('img');
const LEAVE = 'Renunți la modificări?';
/** c8: the provider as the row names it (profile-form providerLabel). */
const PROVIDER_NAMES: Record<string, string> = { google: 'Google', facebook: 'Facebook', apple: 'Apple', local: 'Email' };
const providerName = (p: string | null) => (p ? (PROVIDER_NAMES[p] ?? p) : '-');
/** The viewer's own public profile (the «Editează profilul» entry point; a history pop returns there). */
const ownProfile = () => `/pescari/${original.documentId}`;
const ownProfileUrl = () => new RegExp(`/pescari/${original.documentId}$`);
async function onOwnProfile(page: Page) {
  await expect(page).toHaveURL(ownProfileUrl());
  // The page renders (never a 404): the profile header names the QA angler.
  await expect(page.getByTestId('profile-name')).toHaveText(original.username);
}
/** c17: the exit without usable history is Setări (fish dismisses edit profile back to Settings). */
async function onSettings(page: Page) {
  await expect(page).toHaveURL(/\/setari$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Setări' })).toBeVisible();
}

async function loaded(page: Page) {
  await expect(username(page)).toHaveValue(/.+/);
}

test.describe('account.b.signed-out-gate', () => {
  test('signed out: a real 307 to /intra?next=%2Fsetari%2Fprofil (no cookie, proxy fast path)', async ({ request }) => {
    const res = await request.get(PATH, { maxRedirects: 0 });
    expect(res.status()).toBe(307);
    expect(new URL(res.headers().location, 'http://x').pathname + new URL(res.headers().location, 'http://x').search).toBe(
      '/intra?next=%2Fsetari%2Fprofil',
    );
  });

  test('signed out in a browser lands on sign-in with the return path; a dead session too (requireViewer)', async ({ page }) => {
    await open(page, { signedIn: false });
    await expect(page).toHaveURL(/\/intra\?next=%2Fsetari%2Fprofil$/);
    // The sign-in screen rendered (its copy is account.sign-in's, asserted in intra.spec.ts).
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // A cookie the CMS refuses passes the proxy (it only checks presence): the page gate decides.
    await page.context().addCookies([{ name: 'bluvi_session', value: 'dead-token', url: page.url() }]);
    await page.goto(PATH);
    await expect(page).toHaveURL(/\/intra\?next=%2Fsetari%2Fprofil$/);
  });
});

test.describe('account.edit-profile', () => {
  test('c1 c3 c4 c8 c9 — title, back, avatar block, fields, provider, pristine submit', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await open(page);
    await expect(page.getByRole('heading', { level: 1, name: 'Editează profilul' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Înapoi' })).toBeVisible();
    await loaded(page);

    // c3: a 150px circle with the camera badge.
    const box = await page.getByRole('button', { name: 'Schimbă fotografia de profil' }).boundingBox();
    expect(Math.round(box!.width)).toBe(150);
    expect(Math.round(box!.height)).toBe(150);
    const radius = await avatarImg(page).evaluate((el) => Number.parseFloat(getComputedStyle(el).borderTopLeftRadius));
    expect(radius).toBeGreaterThanOrEqual(75);
    await expect(page.locator('button[aria-label="Schimbă fotografia de profil"] svg')).toBeVisible();
    // c4 copy.
    await expect(page.getByRole('button', { name: 'Regenerează avatar' })).toBeVisible();
    await expect(page.getByText('sau', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Încarcă fotografie' })).toBeVisible();

    // Fields prefilled from GET /user/profile.
    await expect(username(page)).toHaveValue(original.username);
    await expect(phone(page)).toHaveValue(original.phone ?? '');
    await expect(bio(page)).toHaveValue(original.bio ?? '');
    // c7: 3 lines, at most 200, with the counter.
    await expect(bio(page)).toHaveAttribute('rows', '3');
    // fish maxLength 200: the native cap (maxlength) stops input at 200.
    await expect(bio(page)).toHaveAttribute('maxlength', '200');
    await bio(page).fill('x'.repeat(250));
    await expect(bio(page)).toHaveValue('x'.repeat(200));
    await expect(page.getByText('200 / 200')).toBeVisible();
    // At the cap a keystroke in the middle is refused (fish), never kept at the cost of the last character.
    await bio(page).fill(`${'a'.repeat(100)}${'z'.repeat(100)}`);
    await bio(page).evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(100, 100));
    await page.keyboard.type('Y');
    await expect(bio(page)).toHaveValue(`${'a'.repeat(100)}${'z'.repeat(100)}`);
    await bio(page).fill(original.bio ?? '');
    await expect(page.getByText(`${(original.bio ?? '').length} / 200`)).toBeVisible();
    // c8: a read-only row, the provider named («local» is «Email», never the raw CMS id).
    await expect(page.getByTestId('profile-provider')).toHaveText(`Autentificat cu ${providerName(original.provider)}`);
    await expect(page.getByTestId('profile-provider')).not.toContainText('local');

    // c9: pristine → disabled; a change enables it; typing the value back disables it again.
    await expect(submit(page)).toBeDisabled();
    await username(page).fill(`${original.username}x`);
    await expect(submit(page)).toBeEnabled();
    await username(page).fill(original.username);
    await expect(submit(page)).toBeDisabled();
    expect(errors).toEqual([]);
  });

  test('c1 back: returns to the page that opened it, else Setări (c17)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await signIn(page.context(), jwt);
    await mockDicebear(page);
    await page.goto('/');
    await page.goto(PATH);
    await loaded(page);
    await page.getByRole('button', { name: 'Înapoi' }).click();
    await expect(page).toHaveURL(/\/$/);

    // Opened directly (no same-origin history): Setări, fish's entry point.
    const fresh = await page.context().newPage();
    await mockDicebear(fresh);
    await fresh.goto(PATH);
    await expect(username(fresh)).toHaveValue(/.+/);
    await fresh.getByRole('button', { name: 'Înapoi' }).click();
    await onSettings(fresh);

    // c15 the same way: a save without history lands there too, toast over Setări.
    const third = await page.context().newPage();
    await mockDicebear(third);
    const patches = await mockPatch(third);
    await third.goto(PATH);
    await loaded(third);
    await bio(third).fill(`${original.bio ?? ''} e2e`.slice(0, 200));
    await submit(third).click();
    await expect(third.getByRole('status').filter({ hasText: SAVED_TOAST })).toBeVisible();
    await onSettings(third);
    expect(patches).toHaveLength(1);
  });

  test('c1 entry point: «Editează profilul» on the own profile opens the screen, back returns there', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await signIn(page.context(), jwt);
    await mockDicebear(page);
    await page.goto(ownProfile());
    await page.getByRole('link', { name: 'Editează profilul' }).click();
    await expect(page).toHaveURL(new RegExp(`${PATH}$`));
    await loaded(page);
    await page.getByRole('button', { name: 'Înapoi' }).click();
    await onOwnProfile(page);
  });

  test('c17 entry points from Setări: the profile card, and «Editează profil» in the no-phone organizer alert; back and a save return to Setări', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 900 });
    await signIn(page.context(), jwt);
    await mockDicebear(page);
    const patches = await mockPatch(page);

    // 1. The profile card (fish settings.tsx:116).
    await page.goto('/setari');
    await page.getByTestId('settings-profile-card').click();
    await expect(page).toHaveURL(new RegExp(`${PATH}$`));
    await expect(page.getByRole('heading', { level: 1, name: 'Editează profilul' })).toBeVisible();
    await loaded(page);
    await page.getByRole('button', { name: 'Înapoi' }).click();
    await onSettings(page);
    // A save opened from the card closes back to Setări, toast on top.
    await page.getByTestId('settings-profile-card').click();
    await loaded(page);
    await bio(page).fill(`${original.bio ?? ''} e2e`.slice(0, 200));
    await submit(page).click();
    await expect(page.getByRole('status').filter({ hasText: SAVED_TOAST })).toBeVisible();
    await onSettings(page);
    expect(patches).toHaveLength(1);

    // 2. The organizer-request alert of an angler without a phone (fish settings.tsx:174).
    await mockProfile(page, { role: { id: 1, documentId: 'role-doc', name: 'Authenticated' }, hasRequestedOrganizerRole: false, phone: null });
    await page.goto('/setari');
    await page.getByRole('button', { name: 'Devino organizator' }).click();
    const alert = page.getByRole('alertdialog', { name: 'Nu poți trimite cererea pentru a deveni organizator fără număr de telefon' });
    await alert.getByRole('link', { name: 'Editează profil' }).click();
    await expect(page).toHaveURL(new RegExp(`${PATH}$`));
    await expect(page.getByRole('heading', { level: 1, name: 'Editează profilul' })).toBeVisible();
    await loaded(page);
    await expect(phone(page)).toHaveValue('');
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await page.getByRole('button', { name: 'Înapoi' }).click();
    await onSettings(page);
  });

  test('leave guard: unsaved edits ask «Renunți la modificări?» on back, on an in-app link and on closing the tab', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await signIn(page.context(), jwt);
    await mockDicebear(page);
    await page.goto('/');
    await page.goto(PATH);
    await loaded(page);

    // Pristine: back leaves without asking.
    await page.getByRole('button', { name: 'Înapoi' }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.goto(PATH);
    await loaded(page);

    await bio(page).fill('ciornă nesalvată');
    const dialog = page.getByRole('alertdialog', { name: LEAVE });
    await page.getByRole('button', { name: 'Înapoi' }).click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Continuă editarea' }).click();
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(new RegExp(`${PATH}$`));
    await expect(bio(page)).toHaveValue('ciornă nesalvată');

    // A top-bar link is held too.
    await page.getByRole('banner').getByRole('link', { name: 'Bălți' }).first().click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Continuă editarea' }).click();
    await expect(page).toHaveURL(new RegExp(`${PATH}$`));

    // Closing the tab: the browser's own prompt (beforeunload).
    let unloadAsked = false;
    page.once('dialog', async (d) => {
      unloadAsked = d.type() === 'beforeunload';
      await d.dismiss();
    });
    await page.close({ runBeforeUnload: true });
    await expect.poll(() => unloadAsked).toBe(true);
  });

  test('leave guard: «Renunță» follows the held link', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 900 });
    await signIn(page.context(), jwt);
    await mockDicebear(page);
    await page.goto('/');
    await page.goto(PATH);
    await loaded(page);
    await page.getByRole('button', { name: 'Regenerează avatar' }).click();
    await page.getByRole('button', { name: 'Înapoi' }).click();
    const dialog = page.getByRole('alertdialog', { name: LEAVE });
    await expect(dialog).toBeVisible();
    // The dialog's entry transition must end before axe reads its colours.
    await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));
    await expectNoA11yViolations(page);
    await dialog.getByRole('button', { name: 'Renunță' }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test('≥1280 preview «Așa te văd ceilalți»: live from the form, with «Vezi profilul public»', async ({ page }) => {
    await open(page, { width: 1440 });
    await loaded(page);
    const preview = page.getByRole('region', { name: 'Așa te văd ceilalți' });
    await expect(preview).toBeVisible();
    await expect(preview.getByTestId('profile-preview-name')).toHaveText(original.username);
    await username(page).fill('Nume Nou');
    await bio(page).fill('Crap la #feeder');
    await expect(preview.getByTestId('profile-preview-name')).toHaveText('Nume Nou');
    await expect(preview.getByText('Crap la #feeder')).toBeVisible();
    await expect(preview.getByRole('link', { name: 'Vezi profilul public' })).toHaveAttribute('href', ownProfile());
    // Header and task share one left edge (the title sits over the form).
    const h1 = await page.getByRole('heading', { level: 1, name: 'Editează profilul' }).boundingBox();
    const card = await page.getByRole('region', { name: 'Editează profilul' }).boundingBox();
    expect(Math.abs(h1!.x - card!.x)).toBeLessThan(80);
    // Preview and CTA are one card: the docked «Finalizează» starts where the preview card ends.
    const previewBox = await preview.boundingBox();
    const actionsBox = await page.getByTestId('edit-profile-actions').locator('> div').boundingBox();
    expect(Math.abs(previewBox!.y + previewBox!.height - actionsBox!.y)).toBeLessThanOrEqual(1.5);
    expect(Math.abs(previewBox!.width - actionsBox!.width)).toBeLessThanOrEqual(1);
    // Below 1280 the preview is not shown.
    await page.setViewportSize({ width: 1024, height: 900 });
    await expect(preview).toBeHidden();
  });

  for (const width of [1280, 1440, 1920]) {
    test(`≥1280 at ${width}: avatar column | fields capped at 576 (two up on a wide card), never the phone form stretched`, async ({ page }) => {
      await open(page, { width });
      await loaded(page);
      const avatar = (await page.getByRole('button', { name: 'Schimbă fotografia de profil' }).boundingBox())!;
      const user = (await username(page).boundingBox())!;
      const phoneBox = (await phone(page).boundingBox())!;
      const bioBox = (await bio(page).boundingBox())!;
      // Fields capped (the input sits inside its 2px-bordered shell). On a wide card (≥1024 inner,
      // 1920) username | phone go two up and the bio spans both, to the card's inner edge.
      const twoUp = Math.abs(user.y - phoneBox.y) <= 2;
      expect(twoUp).toBe(width >= 1920);
      for (const b of twoUp ? [user, phoneBox] : [user, phoneBox, bioBox]) expect(b.width).toBeLessThanOrEqual(576);
      expect(Math.abs(user.x - bioBox.x)).toBeLessThanOrEqual(2);
      if (twoUp) {
        expect(phoneBox.x).toBeGreaterThan(user.x + user.width);
        expect(Math.abs(bioBox.x + bioBox.width - (phoneBox.x + phoneBox.width))).toBeLessThanOrEqual(2);
      }
      // The card is filled: the field column ends near the card's inner edge (24px padding).
      const card = (await page.locator('section[aria-labelledby]').filter({ has: username(page) }).boundingBox())!;
      expect(card.x + card.width - (bioBox.x + bioBox.width)).toBeLessThanOrEqual(width >= 1920 ? 40 : 120);
      // The avatar block is a left column, top-aligned with the fields.
      expect(avatar.x + avatar.width).toBeLessThan(user.x);
      const label = (await page.getByText('Nume utilizator*', { exact: true }).boundingBox())!;
      expect(Math.abs(avatar.y - label.y)).toBeLessThanOrEqual(4);
      // The provider row closes the field column.
      const provider = (await page.getByTestId('profile-provider').boundingBox())!;
      expect(Math.abs(provider.x - user.x)).toBeLessThanOrEqual(16);
      expect(provider.y).toBeGreaterThan(bioBox.y + bioBox.height);
    });
  }

  for (const width of [320, 375]) {
    test(`avatar actions at ${width}: never wrapped inside a button`, async ({ page }) => {
      await open(page, { width });
      await loaded(page);
      for (const name of ['Regenerează avatar', 'Încarcă fotografie']) {
        const b = (await page.getByRole('button', { name }).boundingBox())!;
        expect(b.height).toBeLessThanOrEqual(48);
        const lines = await page.getByRole('button', { name }).evaluate((el) => {
          const r = document.createRange();
          r.selectNodeContents(el);
          return new Set([...r.getClientRects()].map((c) => Math.round(c.top))).size;
        });
        expect(lines).toBe(1);
      }
      await expect(page.getByText('sau', { exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    });
  }

  test('<768: the white form reaches the «Finalizează» bar (no ground band)', async ({ page }) => {
    await open(page, { width: 375 });
    await loaded(page);
    const card = await page.getByRole('region', { name: 'Editează profilul' }).boundingBox();
    const bar = await submit(page).evaluate((el) => el.closest('div.sticky')!.getBoundingClientRect().toJSON());
    expect(Math.abs(card!.y + card!.height - bar.y)).toBeLessThanOrEqual(1);
  });

  test('c2 loading: the whole form in grey, then the form', async ({ page }) => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    await page.route(PROFILE, async (r) => {
      if (r.request().method() !== 'GET') return r.fallback();
      await gate;
      await r.fallback();
    });
    await open(page);
    // While the document streams, the route's loading boundary and the gate's fallback can both be
    // in the DOM (the later one still hidden): exactly one skeleton is ever visible.
    const skeleton = page.getByTestId('edit-profile-skeleton').filter({ visible: true });
    await expect(skeleton).toHaveCount(1);
    await expect(skeleton).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: 'Se încarcă profilul…' })).toBeAttached();
    await expect(page.getByRole('heading', { level: 1, name: 'Editează profilul' })).toBeVisible();
    await expect(submit(page)).toBeDisabled();
    release();
    await loaded(page);
    await expect(page.getByTestId('edit-profile-skeleton')).toHaveCount(0);
  });

  test('c2 error: describeError copy (never the raw message), «Încearcă din nou» refetches', async ({ page }) => {
    const errors = collectConsoleErrors(page, { ignore: EXPECTED_CONSOLE });
    let fail = true;
    let gets = 0;
    await page.route(PROFILE, (r) => {
      if (r.request().method() !== 'GET') return r.fallback();
      gets += 1;
      return fail ? r.fulfill({ status: 500, contentType: 'application/json', body: '{"error":{"status":500}}' }) : r.fallback();
    });
    await open(page);
    const alert = page.getByRole('alert').filter({ hasText: 'Serverul nu răspunde' });
    await expect(alert).toBeVisible({ timeout: 20_000 });
    await expect(alert).toContainText('Lucrăm la asta. Încearcă din nou în câteva minute.');
    await expect(alert).not.toContainText(GENERIC);
    await expect(alert.getByRole('button', { name: 'Deconectează-te' })).toHaveCount(0);
    await expectNoA11yViolations(page);
    fail = false;
    const before = gets;
    await page.getByRole('button', { name: 'Încearcă din nou' }).click();
    await loaded(page);
    expect(gets).toBeGreaterThan(before);
    expect(errors).toEqual([]);
  });

  test('c2 error 401: «Sesiunea a expirat», no retry, «Deconectează-te»', async ({ page }) => {
    const errors = collectConsoleErrors(page, { ignore: [/status of 401/] });
    await page.route(PROFILE, (r) =>
      r.request().method() === 'GET'
        ? r.fulfill({ status: 401, contentType: 'application/json', body: '{"error":{"status":401,"name":"UnauthorizedError","message":"Unauthorized"}}' })
        : r.fallback(),
    );
    await open(page);
    const alert = page.getByRole('alert').filter({ hasText: 'Sesiunea a expirat' });
    await expect(alert).toBeVisible({ timeout: 20_000 });
    await expect(alert).toContainText('Autentifică-te din nou ca să continui.');
    await expect(alert).not.toContainText('Unauthorized');
    await expect(alert.getByRole('button', { name: 'Încearcă din nou' })).toHaveCount(0);
    await expect(alert.getByRole('button', { name: 'Deconectează-te' })).toBeVisible();
    await expectNoA11yViolations(page);
    expect(errors).toEqual([]);
  });

  test('c3 c4 avatar: the circle and «Încarcă fotografie» open the picker; a photo and «Regenerează avatar» change it', async ({ page }) => {
    await open(page);
    await loaded(page);
    const remoteSrc = await avatarImg(page).getAttribute('src');
    expect(remoteSrc).toMatch(/^https:\/\//);

    const [chooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByRole('button', { name: 'Schimbă fotografia de profil' }).click(),
    ]);
    expect(chooser.isMultiple()).toBe(false);
    await chooser.setFiles({ name: 'poza.png', mimeType: 'image/png', buffer: PNG });
    await expect(avatarImg(page)).toHaveAttribute('data-avatar-kind', 'file');
    await expect(avatarImg(page)).toHaveAttribute('src', /^blob:/);
    await expect(submit(page)).toBeEnabled();

    const [again] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Încarcă fotografie' }).click()]);
    await again.setFiles([]);

    await page.getByRole('button', { name: 'Regenerează avatar' }).click();
    await expect(avatarImg(page)).toHaveAttribute('data-avatar-kind', 'generated');
    const first = await avatarImg(page).getAttribute('src');
    expect(first).toMatch(/^https:\/\/api\.dicebear\.com\/9\.x\/personas\/svg\?seed=/);
    await page.getByRole('button', { name: 'Regenerează avatar' }).click();
    await expect(avatarImg(page)).not.toHaveAttribute('src', first!);
  });

  test('c5 c6 c7 validation: username length, phone format and sanitising, bio length', async ({ page }) => {
    // A stored bio over 200 (the field itself stops typing at 200): only the schema can refuse it.
    await mockProfile(page, { bio: 'b'.repeat(250) });
    const patches = await mockPatch(page);
    await open(page);
    await loaded(page);

    await username(page).fill('ab');
    await phone(page).fill('07a1-2 3');
    await expect(phone(page)).toHaveValue('07123');
    await submit(page).click();
    await expect(page.getByText('Numele de utilizator trebuie să conțină minim 3 caractere')).toBeVisible();
    await expect(page.getByText('Numărul de telefon trebuie să aibă între 7 și 15 cifre')).toBeVisible();
    await expect(page.getByText('Biografia poate conține maximum 200 de caractere')).toBeVisible();
    await expect(username(page)).toBeFocused();
    await expect(username(page)).toHaveAttribute('aria-invalid', 'true');

    // Live after the first submit.
    await username(page).fill('a'.repeat(21));
    await expect(page.getByText('Numele de utilizator poate conține maximum 20 de caractere')).toBeVisible();
    await username(page).fill('Sim QA');
    await expect(page.getByText(/Numele de utilizator/)).toHaveCount(0);
    await phone(page).fill('++40 712 345 678');
    await expect(phone(page)).toHaveValue('+40712345678');
    await expect(page.getByText('Numărul de telefon trebuie să aibă între 7 și 15 cifre')).toHaveCount(0);
    await phone(page).fill('');
    await expect(page.getByText('Numărul de telefon trebuie să aibă între 7 și 15 cifre')).toHaveCount(0);
    expect(patches).toEqual([]);
    await expectNoA11yViolations(page);
  });

  test('c7 a stored bio over 200: Backspace removes one character, typing is refused', async ({ page }) => {
    const stored = `${'b'.repeat(240)}0123456789`;
    await mockProfile(page, { bio: stored });
    await open(page);
    await loaded(page);
    await expect(bio(page)).toHaveValue(stored);
    await bio(page).focus();
    await bio(page).evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(el.value.length, el.value.length));
    await page.keyboard.press('Backspace');
    await expect(bio(page)).toHaveValue(stored.slice(0, -1));
    await page.keyboard.type('x');
    await expect(bio(page)).toHaveValue(stored.slice(0, -1));
    await expect(page.getByText('249 / 200')).toBeVisible();
  });

  test('c18 without a saved avatar: a generated one counts as a change — enabled on load, uploaded before the PATCH', async ({ page }) => {
    const order: string[] = [];
    await mockProfile(page, { avatar: null });
    await page.route(UPLOAD, async (r) => {
      order.push('upload');
      await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: 777, url: 'https://example.test/g.jpg' }]) });
    });
    const patches = await mockPatch(page, async (r) => {
      order.push('patch');
      await r.fulfill({ status: 204, body: '' });
    });
    await open(page);
    await loaded(page);
    await expect(avatarImg(page)).toHaveAttribute('data-avatar-kind', 'generated');
    await expect(avatarImg(page)).toHaveAttribute('src', /^https:\/\/api\.dicebear\.com\/9\.x\/personas\/svg\?seed=/);
    // Untouched, yet «Finalizează» is on (fish setValue(..., { shouldDirty: true })).
    await expect(submit(page)).toBeEnabled();
    await submit(page).click();
    await expect(page.getByRole('status').filter({ hasText: SAVED_TOAST })).toBeVisible();
    expect(order).toEqual(['upload', 'patch']);
    expect(patches).toEqual([{ avatar: 777, username: original.username, phone: original.phone, bio: original.bio }]);
  });

  test('c13 c14 server bluCodes go on their field and every failure toasts', async ({ page }) => {
    const errors = collectConsoleErrors(page, { ignore: EXPECTED_CONSOLE });
    const cases = [
      ['USERNAME_ALREADY_IN_USE', 'Numele de utilizator este deja folosit. Gaseste unul mai potrivit pentru tine', username],
      ['PHONE_NUMBER_ALREADY_IN_USE', 'Numărul de telefon este deja folosit, sigur l-ai scris corect?', phone],
      ['UPDATE_PROFILE:BIO_TOO_LONG', 'Biografia poate conține maximum 200 de caractere.', bio],
    ] as const;
    let answer: (r: Route) => Promise<void> = bluError(cases[0][0], cases[0][1]);
    const patches = await mockPatch(page, (r) => answer(r));
    await open(page);
    await loaded(page);
    for (const [code, message, field] of cases) {
      answer = bluError(code, message);
      await bio(page).fill(`bio ${code}`);
      await submit(page).click();
      const fieldError = page.locator('p[role="alert"]').filter({ hasText: message });
      await expect(fieldError).toBeVisible();
      await expect(field(page)).toHaveAttribute('aria-invalid', 'true');
      await expect(field(page)).toBeFocused();
      // c14: the toast too (role=alert, the danger tone).
      await expect(page.getByRole('alert').filter({ hasText: message }).filter({ has: page.getByRole('button', { name: 'Închide mesajul' }) })).toBeVisible();
      await page.getByRole('button', { name: 'Închide mesajul' }).click();
      // Editing the field clears the server's message.
      await field(page).fill(code === 'PHONE_NUMBER_ALREADY_IN_USE' ? '0712345678' : `edited ${code}`.slice(0, 18));
      await expect(fieldError).toHaveCount(0);
    }
    expect(patches).toHaveLength(3);

    // c14: a failure without a bluCode — only the toast, with the generic message.
    answer = (r) => r.fulfill({ status: 500, contentType: 'application/json', body: '{"error":{"status":500,"message":"boom"}}' });
    await submit(page).click();
    await expect(page.getByRole('alert').filter({ hasText: GENERIC })).toBeVisible();
    await expect(page.locator('[aria-invalid="true"]')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('c9 c10 c15 avatar changed: uploading + saving, upload (profile_id_{id}_{ts}.jpg) then PATCH {avatar, username, phone, bio}', async ({ page }) => {
    const uploads: { body: string; type: string }[] = [];
    let releaseUpload!: () => void;
    const uploadGate = new Promise<void>((r) => (releaseUpload = r));
    await page.route(UPLOAD, async (r) => {
      uploads.push({ body: r.request().postDataBuffer()?.toString('latin1') ?? '', type: r.request().headers()['content-type'] ?? '' });
      await uploadGate;
      await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: 987654, url: 'https://example.test/a.jpg' }]) });
    });
    let releasePatch!: () => void;
    const patchGate = new Promise<void>((r) => (releasePatch = r));
    const patches = await mockPatch(page, async (r) => {
      await patchGate;
      await r.fulfill({ status: 204, body: '' });
    });
    await page.setViewportSize({ width: 1280, height: 900 });
    await signIn(page.context(), jwt);
    await mockDicebear(page);
    await page.goto('/');
    await page.goto(PATH);
    await loaded(page);

    await page.getByRole('button', { name: 'Regenerează avatar' }).click();
    await submit(page).click();
    // Uploading: the CTA spins and is off, the phase is announced.
    await expect(submit(page)).toBeDisabled();
    await expect(submit(page)).toHaveAttribute('aria-busy', 'true');
    await expect(page.getByRole('status').filter({ hasText: 'Se încarcă fotografia…' })).toBeAttached();
    releaseUpload();
    await expect(page.getByRole('status').filter({ hasText: 'Se salvează profilul…' })).toBeAttached();
    await expect(submit(page)).toHaveAttribute('aria-busy', 'true');
    releasePatch();

    // c15: closes (back to the page that opened it) with the success toast.
    await expect(page.getByRole('status').filter({ hasText: SAVED_TOAST })).toBeVisible();
    await expect(page).toHaveURL(/\/$/);

    expect(uploads).toHaveLength(1);
    expect(uploads[0].type).toMatch(/^multipart\/form-data/);
    expect(uploads[0].body).toMatch(new RegExp(`filename="profile_id_${original.id}_\\d{13}\\.jpg"`));
    expect(uploads[0].body).toContain('Content-Type: image/jpeg');
    expect(uploads[0].body).toMatch(/name="status"\r\n\r\npublished/);
    expect(patches).toEqual([{ avatar: 987654, username: original.username, phone: original.phone, bio: original.bio }]);
  });

  test('c10 a picked photo is uploaded as the JPEG avatar', async ({ page }) => {
    const uploads: string[] = [];
    await page.route(UPLOAD, async (r) => {
      uploads.push(r.request().postDataBuffer()?.toString('latin1') ?? '');
      await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: 4242, url: 'https://example.test/b.jpg' }]) });
    });
    const patches = await mockPatch(page);
    await open(page);
    await loaded(page);
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Încarcă fotografie' }).click()]);
    await chooser.setFiles({ name: 'poza.png', mimeType: 'image/png', buffer: PNG });
    await expect(avatarImg(page)).toHaveAttribute('data-avatar-kind', 'file');
    await submit(page).click();
    await expect(page.getByRole('status').filter({ hasText: SAVED_TOAST })).toBeVisible();
    expect(uploads).toHaveLength(1);
    expect(uploads[0]).toMatch(new RegExp(`filename="profile_id_${original.id}_\\d{13}\\.jpg"\r\nContent-Type: image/jpeg\r\n\r\n\\xff\\xd8`));
    expect(patches[0]).toMatchObject({ avatar: 4242 });
  });

  test('c14 a failed upload toasts and sends no PATCH', async ({ page }) => {
    const errors = collectConsoleErrors(page, { ignore: EXPECTED_CONSOLE });
    await page.route(UPLOAD, (r) => r.fulfill({ status: 500, contentType: 'application/json', body: '{"error":{"status":500}}' }));
    const patches = await mockPatch(page);
    await open(page);
    await loaded(page);
    await page.getByRole('button', { name: 'Regenerează avatar' }).click();
    await submit(page).click();
    await expect(page.getByRole('alert').filter({ hasText: GENERIC })).toBeVisible();
    await expect(submit(page)).toBeEnabled();
    expect(patches).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('c11 c12 c15 c16 real save without an avatar: PATCH {username, phone: null, bio: null}, toast, back, top bar follows', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    const sent: Request[] = [];
    page.on('request', (r) => {
      if (r.method() === 'PATCH' && r.url().endsWith('/api/cms/user/profile')) sent.push(r);
    });
    await page.setViewportSize({ width: 1280, height: 900 });
    await signIn(page.context(), jwt);
    await mockDicebear(page);
    await page.goto('/');
    await expect(page.getByRole('button', { name: `Contul meu, ${original.username}` })).toBeVisible();
    await page.goto(PATH);
    await loaded(page);

    const renamed = `${original.username.slice(0, 14)} e2e`;
    realPatched = true;
    await username(page).fill(renamed);
    await phone(page).fill('');
    await bio(page).fill('   ');
    // Enter in a text field submits the form (implicit submission; in the textarea it is a newline).
    await username(page).press('Enter');

    await expect(page.getByRole('status').filter({ hasText: SAVED_TOAST })).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
    expect(sent).toHaveLength(1);
    expect(sent[0].postDataJSON()).toEqual({ username: renamed, phone: null, bio: null });
    // c16: the server Viewer was re-read (router.refresh): the top bar names the new username.
    await expect(page.getByRole('button', { name: `Contul meu, ${renamed}` })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('account.b.profile-cache: one GET /user/profile per visit, not refetched on focus within 24h', async ({ page }) => {
    let gets = 0;
    await page.route(PROFILE, (r) => {
      if (r.request().method() === 'GET') gets += 1;
      return r.fallback();
    });
    await open(page);
    await loaded(page);
    // One read (React Query may retry a failed one on a loaded machine: never more than the retries).
    expect(gets).toBeGreaterThanOrEqual(1);
    const afterLoad = gets;
    await page.evaluate(() => {
      window.dispatchEvent(new Event('visibilitychange'));
      window.dispatchEvent(new Event('focus'));
    });
    await page.waitForTimeout(500);
    // Fresh for 24h: focus does not refetch.
    expect(gets).toBe(afterLoad);
  });
});

test.describe('account.edit-profile — a11y and keyboard', () => {
  for (const width of WIDTHS) {
    test(`axe and the keyboard path at ${width}`, async ({ page }) => {
      const errors = collectConsoleErrors(page);
      await open(page, { width });
      await loaded(page);
      await expectNoA11yViolations(page);

      // Back · avatar · Regenerează · Încarcă · username · phone · bio · (Finalizează once enabled).
      await page.getByRole('button', { name: 'Înapoi' }).focus();
      const order = [
        page.getByRole('button', { name: 'Schimbă fotografia de profil' }),
        page.getByRole('button', { name: 'Regenerează avatar' }),
        page.getByRole('button', { name: 'Încarcă fotografie' }),
        username(page),
        phone(page),
        bio(page),
      ];
      for (const el of order) {
        await page.keyboard.press('Tab');
        await expect(el).toBeFocused();
      }
      // Space on «Regenerează avatar» changes the avatar and enables «Finalizează», next in the tab order.
      await page.getByRole('button', { name: 'Regenerează avatar' }).focus();
      await page.keyboard.press('Space');
      await expect(avatarImg(page)).toHaveAttribute('data-avatar-kind', 'generated');
      await bio(page).focus();
      await page.keyboard.press('Tab');
      // ≥1280 the preview's «Vezi profilul public» comes first (the aside, then the CTA docked under it).
      if (width >= 1280) {
        await expect(page.getByRole('link', { name: 'Vezi profilul public' })).toBeFocused();
        await page.keyboard.press('Tab');
      }
      await expect(submit(page)).toBeFocused();
      // Enter on the avatar opens the picker.
      const chooser = page.waitForEvent('filechooser');
      await page.getByRole('button', { name: 'Schimbă fotografia de profil' }).focus();
      await page.keyboard.press('Enter');
      await chooser;
      // The CTA's enable transition (150ms) must end before axe reads its colours.
      await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));
      await expectNoA11yViolations(page);
      expect(errors).toEqual([]);
    });
  }
});
