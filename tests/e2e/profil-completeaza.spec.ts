import { expect, test, type Locator, type Page, type Route } from '@playwright/test';
import { expectNoA11yViolations } from './helpers/a11y';
import { collectConsoleErrors } from './helpers/console';
import { CMS, qaJwt, signIn } from './helpers/session';

/*
 * account.complete-profile (/profil/completeaza, T6) + home.acasa.c57 / account.b.complete-profile-gate
 * (Acasă's non-dismissable «Completează profilul»). fish: app/(app)/complete-profile.tsx,
 * components/CompleteProfileSheet.tsx, components/EditProfileScreen.tsx.
 *
 * Data: the local QA user against the LOCAL CMS. Every write is route-mocked (PATCH /user/profile,
 * POST /upload): the QA user is never made incomplete on the CMS — an incomplete profile is a mocked
 * GET. DiceBear is mocked (a small SVG with CORS).
 */

const PATH = '/profil/completeaza';
const PROFILE = '**/api/cms/user/profile';
const UPLOAD = '**/api/cms/upload';
const WIDTHS = [375, 1280, 1440, 1920] as const;
const TITLE = 'Completează profilul';
const EDIT_TOAST = 'Profilul a fost actualizat cu succes';
const GENERIC = 'A apărut o eroare necunoscută. Te rugăm să reîncerci mai târziu.';
const EXPECTED_CONSOLE = [/Failed to load resource: the server responded with a status of (400|500)/];
const AVATAR_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" fill="#3b82f6"/><circle cx="32" cy="28" r="14" fill="#ffd6c0"/></svg>';

let jwt: string;
let profileJson: Record<string, unknown>;
let original: { id: number; username: string; phone: string | null; bio: string | null };

test.beforeAll(async ({ request }) => {
  jwt = await qaJwt(request);
  const res = await request.get(`${CMS}/user/profile`, { headers: { authorization: `Bearer ${jwt}` } });
  expect(res.ok(), 'QA profile read').toBe(true);
  profileJson = await res.json();
  original = {
    id: profileJson.id as number,
    username: profileJson.username as string,
    phone: (profileJson.phone as string | null) ?? null,
    bio: (profileJson.bio as string | null) ?? null,
  };
});

async function mockDicebear(page: Page) {
  await page.route('https://api.dicebear.com/**', (r) =>
    r.fulfill({ status: 200, contentType: 'image/svg+xml', headers: { 'access-control-allow-origin': '*' }, body: AVATAR_SVG }),
  );
}

/**
 * Answers GET /user/profile with the real profile plus `state.patch` (read on every call, so a test
 * can make it complete after the save). Records when each GET was answered.
 */
async function mockProfile(page: Page, patch: Record<string, unknown>) {
  const state = { patch, answeredAt: [] as number[], onAnswer: undefined as undefined | (() => Promise<void>) };
  await page.route(PROFILE, async (r) => {
    if (r.request().method() !== 'GET') return r.fallback();
    await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...profileJson, ...state.patch }) });
    state.answeredAt.push(Date.now());
    await state.onAnswer?.();
  });
  return state;
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

async function open(page: Page, { width = 375, signedIn = true, path = PATH }: { width?: number; signedIn?: boolean; path?: string } = {}) {
  await page.setViewportSize({ width, height: 900 });
  if (signedIn) await signIn(page.context(), jwt);
  await mockDicebear(page);
  await page.goto(path);
}

const username = (s: Page | Locator) => s.getByLabel('Nume utilizator*');
const phone = (s: Page | Locator) => s.getByLabel('Telefon (opțional)');
const bio = (s: Page | Locator) => s.getByLabel('Biografie');
const submit = (s: Page | Locator) => s.getByRole('button', { name: 'Finalizează' }).filter({ visible: true });
const avatarImg = (s: Page | Locator) => s.getByRole('button', { name: 'Schimbă fotografia de profil' }).locator('img');
const loaded = (page: Page) => expect(username(page)).toHaveValue(/.+/);

test.describe('account.complete-profile — gate', () => {
  test('signed out: a real 307 to /intra?next=%2Fprofil%2Fcompleteaza; in a browser, sign-in with the return path', async ({ request, page }) => {
    const res = await request.get(PATH, { maxRedirects: 0 });
    expect(res.status()).toBe(307);
    const loc = new URL(res.headers().location, 'http://x');
    expect(loc.pathname + loc.search).toBe('/intra?next=%2Fprofil%2Fcompleteaza');

    await open(page, { signedIn: false });
    await expect(page).toHaveURL(/\/intra\?next=%2Fprofil%2Fcompleteaza$/);
    // A cookie the CMS refuses passes the proxy: requireViewer redirects.
    await page.context().addCookies([{ name: 'bluvi_session', value: 'dead-token', url: page.url() }]);
    await page.goto(PATH);
    await expect(page).toHaveURL(/\/intra\?next=%2Fprofil%2Fcompleteaza$/);
  });
});

test.describe('account.complete-profile', () => {
  test('c1 c2 — titled «Completează profilul», no back control, prefilled, «Finalizează» enabled untouched (a complete profile too)', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await open(page);
    await expect(page).toHaveTitle(new RegExp(TITLE));
    await expect(page.getByRole('heading', { level: 1, name: TITLE })).toBeVisible();
    await loaded(page);
    await expect(page.getByRole('button', { name: 'Înapoi' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Înapoi' })).toHaveCount(0);
    // No breadcrumb either (a way back by another name).
    await expect(page.getByRole('navigation', { name: 'Cale de navigare' })).toHaveCount(0);
    await expect(username(page)).toHaveValue(original.username);
    await expect(phone(page)).toHaveValue(original.phone ?? '');
    await expect(bio(page)).toHaveValue(original.bio ?? '');
    // Saved avatar kept as is (not a change).
    await expect(avatarImg(page)).not.toHaveAttribute('data-avatar-kind', 'generated');
    await expect(submit(page)).toBeEnabled();
    expect(errors).toEqual([]);
  });

  test('c2 c3 — pristine submit: PATCH {username, phone, bio}, replace to Acasă, no toast, Back does not return to the form', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    const patches = await mockPatch(page);
    let uploads = 0;
    await page.route(UPLOAD, (r) => {
      uploads += 1;
      return r.fulfill({ status: 500, body: '' });
    });
    await page.setViewportSize({ width: 1280, height: 900 });
    await signIn(page.context(), jwt);
    await mockDicebear(page);
    await page.goto('/');
    await page.goto(PATH);
    await loaded(page);
    await submit(page).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('status').filter({ hasText: EDIT_TOAST })).toHaveCount(0);
    await expect(page.getByRole('alert').filter({ hasText: EDIT_TOAST })).toHaveCount(0);
    expect(patches).toEqual([{ username: original.username, phone: original.phone, bio: original.bio }]);
    expect(uploads).toBe(0);
    // replace: one step back is the page before the form, never the form.
    await page.goBack();
    await expect(page).not.toHaveURL(new RegExp(`${PATH}$`));
    expect(errors).toEqual([]);
  });

  test('c4 no saved avatar: a generated DiceBear avatar, marked changed — uploaded (profile_id_{id}_{ts}.jpg) before the PATCH; uploading + saving states', async ({ page }) => {
    await mockProfile(page, { avatar: null });
    const order: string[] = [];
    const uploads: string[] = [];
    let releaseUpload!: () => void;
    const uploadGate = new Promise<void>((r) => (releaseUpload = r));
    await page.route(UPLOAD, async (r) => {
      order.push('upload');
      uploads.push(r.request().postDataBuffer()?.toString('latin1') ?? '');
      await uploadGate;
      await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: 777, url: 'https://example.test/g.jpg' }]) });
    });
    let releasePatch!: () => void;
    const patchGate = new Promise<void>((r) => (releasePatch = r));
    const patches = await mockPatch(page, async (r) => {
      order.push('patch');
      await patchGate;
      await r.fulfill({ status: 204, body: '' });
    });
    await open(page);
    await loaded(page);
    await expect(avatarImg(page)).toHaveAttribute('data-avatar-kind', 'generated');
    await expect(avatarImg(page)).toHaveAttribute('src', /^https:\/\/api\.dicebear\.com\/9\.x\/personas\/svg\?seed=/);
    await expect(submit(page)).toBeEnabled();
    await submit(page).click();
    await expect(submit(page)).toBeDisabled();
    await expect(submit(page)).toHaveAttribute('aria-busy', 'true');
    await expect(page.getByRole('status').filter({ hasText: 'Se încarcă fotografia…' })).toBeAttached();
    releaseUpload();
    await expect(page.getByRole('status').filter({ hasText: 'Se salvează profilul…' })).toBeAttached();
    releasePatch();
    await expect(page).toHaveURL(/\/$/);
    expect(order).toEqual(['upload', 'patch']);
    expect(uploads[0]).toMatch(new RegExp(`filename="profile_id_${original.id}_\\d{13}\\.jpg"`));
    expect(patches).toEqual([{ avatar: 777, username: original.username, phone: original.phone, bio: original.bio }]);
  });

  test('loading: the whole form in grey under the title, «Finalizează» off, then the form', async ({ page }) => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    await page.route(PROFILE, async (r) => {
      if (r.request().method() !== 'GET') return r.fallback();
      await gate;
      await r.fallback();
    });
    await open(page);
    const skeleton = page.getByTestId('edit-profile-skeleton').filter({ visible: true });
    await expect(skeleton).toHaveCount(1);
    await expect(page.getByRole('status').filter({ hasText: 'Se încarcă profilul…' })).toBeAttached();
    await expect(page.getByRole('heading', { level: 1, name: TITLE })).toBeVisible();
    await expect(submit(page)).toBeDisabled();
    release();
    await loaded(page);
    await expect(page.getByTestId('edit-profile-skeleton')).toHaveCount(0);
  });

  test('profile error: fish ErrorScreen copy, «Încearcă din nou» refetches', async ({ page }) => {
    const errors = collectConsoleErrors(page, { ignore: EXPECTED_CONSOLE });
    let fail = true;
    await page.route(PROFILE, (r) => {
      if (r.request().method() !== 'GET') return r.fallback();
      return fail ? r.fulfill({ status: 500, contentType: 'application/json', body: '{"error":{"status":500}}' }) : r.fallback();
    });
    await open(page);
    const alert = page.getByRole('alert').filter({ hasText: 'Serverul nu răspunde' });
    await expect(alert).toBeVisible({ timeout: 20_000 });
    await expect(alert).toContainText('Lucrăm la asta. Încearcă din nou în câteva minute.');
    await expect(page.getByRole('heading', { level: 1, name: TITLE })).toBeVisible();
    await expectNoA11yViolations(page);
    fail = false;
    await page.getByRole('button', { name: 'Încearcă din nou' }).click();
    await loaded(page);
    expect(errors).toEqual([]);
  });

  test('c5 validation: username length, phone format, bio length — nothing sent', async ({ page }) => {
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
    await username(page).fill('a'.repeat(21));
    await expect(page.getByText('Numele de utilizator poate conține maximum 20 de caractere')).toBeVisible();
    expect(patches).toEqual([]);
    await expectNoA11yViolations(page);
  });

  test('c5 server bluCodes go on their field and toast; a failure without one toasts the generic copy', async ({ page }) => {
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
      await submit(page).click();
      await expect(page.locator('p[role="alert"]').filter({ hasText: message })).toBeVisible();
      await expect(field(page)).toHaveAttribute('aria-invalid', 'true');
      await expect(field(page)).toBeFocused();
      await expect(page.getByRole('alert').filter({ hasText: message }).filter({ has: page.getByRole('button', { name: 'Închide mesajul' }) })).toBeVisible();
      await page.getByRole('button', { name: 'Închide mesajul' }).click();
      await field(page).fill(code === 'PHONE_NUMBER_ALREADY_IN_USE' ? '0712345678' : `edited ${code}`.slice(0, 18));
    }
    expect(patches).toHaveLength(3);
    answer = (r) => r.fulfill({ status: 500, contentType: 'application/json', body: '{"error":{"status":500,"message":"boom"}}' });
    await submit(page).click();
    await expect(page.getByRole('alert').filter({ hasText: GENERIC })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`${PATH}$`));
    expect(errors).toEqual([]);
  });
});

test.describe('account.complete-profile — a11y and keyboard', () => {
  for (const width of WIDTHS) {
    test(`axe and the keyboard path at ${width}`, async ({ page }) => {
      const errors = collectConsoleErrors(page);
      await open(page, { width });
      await loaded(page);
      await expectNoA11yViolations(page);
      await page.getByRole('button', { name: 'Schimbă fotografia de profil' }).focus();
      for (const el of [page.getByRole('button', { name: 'Regenerează avatar' }), page.getByRole('button', { name: 'Încarcă fotografie' }), username(page), phone(page), bio(page)]) {
        await page.keyboard.press('Tab');
        await expect(el).toBeFocused();
      }
      await page.keyboard.press('Tab');
      if (width >= 1280) {
        await expect(page.getByRole('link', { name: 'Vezi profilul public' })).toBeFocused();
        await page.keyboard.press('Tab');
      }
      await expect(submit(page)).toBeFocused();
      expect(errors).toEqual([]);
    });
  }
});

/* ------------------------------------------------------------------------------------------------
 * Acasă: home.acasa.c57 / account.b.complete-profile-gate
 * ---------------------------------------------------------------------------------------------- */

/** The open sheet (<768) or dialog (≥768), by its name. */
const sheet = (page: Page) =>
  page.getByRole('dialog', { name: TITLE }).or(page.getByRole('alertdialog', { name: TITLE }));

async function settle(page: Page) {
  // Only the modal's own entry transitions: Acasă behind it has infinite ones (shimmer, live dots).
  await page.evaluate(() => Promise.all((document.querySelector('dialog[open]')?.getAnimations({ subtree: true }) ?? []).map((a) => a.finished)));
}

test.describe('home.acasa.c57 — «Completează profilul» on Acasă', () => {
  test.describe.configure({ timeout: 120_000 });

  for (const width of [375, 1280]) {
    test(`incomplete (isProfileComplete false) at ${width}: opens ~1.1s after the profile, cannot be dismissed, focus stays in it, submit closes it`, async ({ page }) => {
      const state = await mockProfile(page, { isProfileComplete: false });
      const patches = await mockPatch(page, async (r) => {
        // The CMS sets isProfileComplete on every PATCH (profile controller): the refetch is complete.
        state.patch = { isProfileComplete: true };
        await r.fulfill({ status: 204, body: '' });
      });
      await open(page, { width, path: '/' });
      const dialog = sheet(page);
      await expect(dialog).toBeVisible({ timeout: 45_000 });
      const shownAt = Date.now();
      expect(state.answeredAt.length).toBeGreaterThan(0);
      // Not before 1.1s after the profile was known (minus Playwright's polling slack).
      expect(shownAt - state.answeredAt[0]).toBeGreaterThanOrEqual(1000);
      await settle(page);
      // The first focus is the title (announced first, no ring), never the handle or the avatar.
      await expect(dialog.getByRole('heading', { name: TITLE })).toBeFocused();
      expect(await dialog.getByRole('heading', { name: TITLE }).evaluate((h) => getComputedStyle(h).outlineStyle)).toBe('none');

      // No close control.
      await expect(dialog.getByRole('button', { name: /Închide/ })).toHaveCount(0);
      // Escape (twice: Chrome's close-watcher closes on a second unactivated Escape) does nothing.
      await page.keyboard.press('Escape');
      await page.keyboard.press('Escape');
      await expect(dialog).toBeVisible();
      // The backdrop does nothing.
      await page.mouse.click(5, 5);
      await expect(dialog).toBeVisible();
      if (width < 768) {
        // One 90% snap (fish): no handle button to collapse it, and dragging the header does nothing.
        await expect(dialog.getByRole('button', { name: /Restrânge|Extinde/ })).toHaveCount(0);
        const panelHeight = () => dialog.locator('> div').evaluate((el) => el.getBoundingClientRect().height);
        expect(await panelHeight()).toBeCloseTo(900 * 0.9, -1);
        const box = (await dialog.getByRole('heading', { name: TITLE }).boundingBox())!;
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width / 2, 880, { steps: 8 });
        await page.mouse.up();
        await expect(dialog).toBeVisible();
        expect(await panelHeight()).toBeCloseTo(900 * 0.9, -1);
      }
      // Focus is trapped: Tab never leaves the modal.
      await username(dialog).focus();
      for (let i = 0; i < 12; i += 1) {
        await page.keyboard.press('Tab');
        const inside = await page.evaluate(() => {
          const a = document.activeElement;
          return !a || a === document.body || Boolean(a.closest('dialog[open]'));
        });
        expect(inside).toBe(true);
      }
      // Prefilled, «Finalizează» enabled untouched.
      await expect(username(dialog)).toHaveValue(original.username);
      await expect(submit(dialog)).toBeEnabled();
      await expectNoA11yViolations(page);

      await submit(dialog).click();
      await expect(dialog).toBeHidden();
      await expect(page).toHaveURL(/\/$/);
      expect(patches).toEqual([{ username: original.username, phone: original.phone, bio: original.bio }]);
      // It does not come back.
      await page.waitForTimeout(2000);
      await expect(dialog).toBeHidden();
    });
  }

  test('username «null null» opens it; a failed save shows in it (the toast is under the modal)', async ({ page }) => {
    await mockProfile(page, { username: 'null null', isProfileComplete: true });
    await mockPatch(page, bluError('USERNAME_ALREADY_IN_USE', 'Numele de utilizator este deja folosit. Gaseste unul mai potrivit pentru tine'));
    await open(page, { width: 768, path: '/' });
    const dialog = sheet(page);
    await expect(dialog).toBeVisible({ timeout: 45_000 });
    await expect(username(dialog)).toHaveValue('null null');
    await username(dialog).fill('Sim QA nou');
    await submit(dialog).click();
    await expect(dialog.locator('p[role="alert"]').filter({ hasText: 'Numele de utilizator este deja folosit' })).toBeVisible();
    await expect(dialog.getByRole('alert').filter({ hasText: 'Numele de utilizator este deja folosit' }).first()).toBeVisible();
    await expect(dialog).toBeVisible();
    await settle(page);
    await expectNoA11yViolations(page);
  });

  test('username «null null», pristine «Finalizează»: the save leaves it incomplete, so it opens again ~1.1s after the refetch (fish)', async ({ page }) => {
    const state = await mockProfile(page, { username: 'null null', isProfileComplete: false });
    const patches = await mockPatch(page, async (r) => {
      // The CMS sets isProfileComplete on every PATCH; the username stays «null null».
      state.patch = { username: 'null null', isProfileComplete: true };
      await r.fulfill({ status: 204, body: '' });
    });
    await open(page, { width: 375, path: '/' });
    const dialog = sheet(page);
    await expect(dialog).toBeVisible({ timeout: 45_000 });
    await settle(page);
    const before = state.answeredAt.length;
    await submit(dialog).click();
    await expect(dialog).toBeHidden();
    expect(patches).toEqual([{ username: 'null null', phone: original.phone, bio: original.bio }]);
    // The update mutation refetches the profile; still incomplete → back 1.1s after that answer.
    await expect.poll(() => state.answeredAt.length, { timeout: 10_000 }).toBeGreaterThan(before);
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    const back = Date.now();
    expect(back - state.answeredAt[before]).toBeGreaterThanOrEqual(1000);
    await expect(username(dialog)).toHaveValue('null null');
  });

  for (const width of [1440, 1920]) {
    test(`axe on the open dialog at ${width}`, async ({ page }) => {
      await mockProfile(page, { username: '', isProfileComplete: false });
      await open(page, { width, path: '/' });
      const dialog = sheet(page);
      await expect(dialog).toBeVisible({ timeout: 45_000 });
      await settle(page);
      await expectNoA11yViolations(page);
    });
  }

  test('a complete profile: no sheet', async ({ page }) => {
    const state = await mockProfile(page, { isProfileComplete: true });
    await open(page, { width: 375, path: '/' });
    await expect.poll(() => state.answeredAt.length, { timeout: 45_000 }).toBeGreaterThan(0);
    await page.waitForTimeout(2500);
    await expect(sheet(page)).toHaveCount(0);
  });

  test('a guest: no sheet, the profile is never read', async ({ page }) => {
    let gets = 0;
    await page.route(PROFILE, (r) => {
      gets += 1;
      return r.fallback();
    });
    await open(page, { width: 375, path: '/', signedIn: false });
    await page.waitForLoadState('load');
    await page.waitForTimeout(2500);
    await expect(sheet(page)).toHaveCount(0);
    expect(gets).toBe(0);
  });

  test('offline: no sheet; back online it opens', async ({ page, context }) => {
    const state = await mockProfile(page, { isProfileComplete: false });
    // Offline right after the profile answers (inside the 1.1s window).
    state.onAnswer = async () => {
      state.onAnswer = undefined;
      await context.setOffline(true);
    };
    await open(page, { width: 375, path: '/' });
    await expect.poll(() => state.answeredAt.length, { timeout: 45_000 }).toBeGreaterThan(0);
    expect(await page.evaluate(() => navigator.onLine)).toBe(false);
    await page.waitForTimeout(2500);
    await expect(sheet(page)).toHaveCount(0);
    await context.setOffline(false);
    await expect(sheet(page)).toBeVisible({ timeout: 5000 });
  });
});
