import { devices, expect, test, webkit, type Browser, type Page, type Route } from '@playwright/test';
import { qaUser } from '../qa-user';
import { expectNoA11yViolations } from './helpers/a11y';
import { BASE_URL } from './helpers/base-url';
import { collectConsoleErrors } from './helpers/console';
import { qaJwt } from './helpers/session';

/*
 * account.sign-in (/intra?next=…, T6) + account.b.sign-in-redirect. fish: app/sign-in.tsx,
 * features/onboarding/useWelcomeSignIn.ts, contexts/auth/AuthContext.tsx.
 *
 * Provider SDKs are route-mocked (Google Identity Services and the Facebook JS SDK are replaced by
 * small stubs), and so is POST /api/auth/{google,facebook} — no provider or CMS social route is ever
 * called. Successful sign-ins use the local QA user: one test goes through the real /api/auth/local
 * (→ the LOCAL CMS); the others mock /api/auth/local and set the session cookie to the cached QA JWT
 * themselves, because the CMS rate-limits /auth/local. Nothing is written anywhere: sign-in reads
 * only. Firebase: Identity Toolkit is mocked (the custom-token exchange), Firestore is aborted and
 * asserted untouched.
 */

const PATH = '/intra';
const WIDTHS = [375, 768, 1280, 1440, 1920] as const;
const GENERIC = 'Autentificarea nu a reușit. Te rugăm să încerci din nou.';
const NO_EMAIL =
  'Facebook nu ne-a dat adresa ta de email. Permite accesul la email în fereastra Facebook sau intră cu Google ori Apple.';
const LINK_ERROR = 'Nu am putut deschide pagina. Încearcă din nou.';
const TERMS = 'https://app.termly.io/policy-viewer/policy.html?policyUUID=14bbf816-7403-4ab1-87e9-0d0dcdd4175a';
const PRIVACY = 'https://app.termly.io/policy-viewer/policy.html?policyUUID=958c9787-3e75-4040-990d-cb6bf2c8b3e3';
const APPLE_CONFIGURED = Boolean(process.env.NEXT_PUBLIC_APPLE_SERVICES_ID);
/** Responses the specs provoke on purpose (mocked 4xx/5xx) are logged by the browser. */
const EXPECTED_CONSOLE = [/Failed to load resource: the server responded with a status of (400|500)/];

/**
 * GIS stub: requestCode answers with a code, a closed popup when window.__gsi === 'cancel', or
 * holds the popup open until window.__gsiRelease() when window.__gsi === 'hold'.
 */
const GSI_STUB = `window.google = { accounts: { oauth2: { initCodeClient: function (cfg) { return { requestCode: function () {
  var answer = function () { if (window.__gsi === 'cancel') cfg.error_callback({ type: 'popup_closed' }); else cfg.callback({ code: 'e2e-code' }); };
  if (window.__gsi === 'hold') window.__gsiRelease = function () { window.__gsi = undefined; answer(); };
  else setTimeout(answer, 0);
} }; } } } };`;
/** Facebook SDK stub: FB.login answers window.__fb (default: a token with the email scope granted); options land in window.__fbOpts. */
const FB_STUB = `window.FB = { init: function () {}, login: function (cb, opts) {
  (window.__fbOpts = window.__fbOpts || []).push(opts);
  cb(window.__fb || { status: 'connected', authResponse: { accessToken: 'e2e-fb-token', grantedScopes: 'public_profile,email' } });
} }; if (window.fbAsyncInit) window.fbAsyncInit();`;

let jwt: string;

test.beforeAll(async ({ request }) => {
  jwt = await qaJwt(request);
});

test.beforeEach(async ({ page }) => {
  await page.route('https://accounts.google.com/gsi/client', (r) => r.fulfill({ contentType: 'application/javascript', body: GSI_STUB }));
  await page.route('https://connect.facebook.net/**', (r) => r.fulfill({ contentType: 'application/javascript', body: FB_STUB }));
  await page.route('https://appleid.cdn-apple.com/**', (r) => r.abort());
  // No Firestore traffic from sign-in, ever (shared project).
  await page.route(/firestore\.googleapis\.com/, (r) => r.abort());
  await page.addInitScript(() => {
    const w = window as unknown as { __events: unknown[] };
    w.__events = [];
    window.addEventListener('bluvi:analytics', (e) => w.__events.push((e as CustomEvent).detail));
  });
});

const screen = (page: Page) => page.getByRole('region', { name: 'Hai la pescuit.' });
const providerButton = (page: Page, name: string) => screen(page).getByRole('button', { name: new RegExp(`^Continuă cu ${name}`) });
const alertSlot = (page: Page) => screen(page).getByRole('alert');

/** /api/auth/local answered without the CMS: the QA JWT becomes the session cookie, as the real route does. */
async function mockLocalAuth(page: Page, { firebaseToken = null as string | null } = {}) {
  await page.route('**/api/auth/local', async (route) => {
    await page.context().addCookies([{ name: 'bluvi_session', value: jwt, url: BASE_URL, httpOnly: true, sameSite: 'Lax' }]);
    await route.fulfill({ json: { user: { id: 1 }, firebaseToken } });
  });
}

async function signInLocal(page: Page) {
  const { identifier, password } = qaUser();
  await page.locator('input[name=identifier]').fill(identifier);
  await page.locator('input[name=password]').fill(password);
  await screen(page).getByRole('button', { name: 'Intră', exact: true }).click();
}

async function sessionCookie(page: Page) {
  return (await page.context().cookies()).find((c) => c.name === 'bluvi_session');
}

/*
 * Firebase Auth as the web persists it (IndexedDB, firebase/auth's default for getAuth). A persisted
 * user is seeded the way the SDK writes one, so a sign-out has someone to sign out; the reload the
 * SDK does on restore is aborted (a network failure keeps the user, as offline would). Nothing
 * reaches Firebase: Identity Toolkit and the token service are aborted, Firestore already is.
 */
const FIREBASE_USER_KEY = `firebase:authUser:${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}:[DEFAULT]`;

async function seedFirebaseUser(page: Page) {
  await page.route(/identitytoolkit\.googleapis\.com|securetoken\.googleapis\.com/, (r) => r.abort());
  await page.evaluate(
    ({ key, apiKey }) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('firebaseLocalStorageDb', 1);
        open.onupgradeneeded = () => open.result.createObjectStore('firebaseLocalStorage', { keyPath: 'fbase_key' });
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const tx = open.result.transaction('firebaseLocalStorage', 'readwrite');
          tx.objectStore('firebaseLocalStorage').put({
            fbase_key: key,
            value: {
              uid: 'e2e-previous-angler',
              emailVerified: false,
              isAnonymous: false,
              providerData: [],
              stsTokenManager: { refreshToken: 'e2e-refresh', accessToken: 'e2e-access', expirationTime: Date.now() + 3_600_000 },
              createdAt: String(Date.now()),
              lastLoginAt: String(Date.now()),
              apiKey,
              appName: '[DEFAULT]',
            },
          });
          tx.oncomplete = () => {
            open.result.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    { key: FIREBASE_USER_KEY, apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY }
  );
}

/** The Firebase users this browser still holds (keys of the SDK's IndexedDB store). */
async function firebaseUsers(page: Page): Promise<string[]> {
  return page.evaluate(
    () =>
      new Promise<string[]>((resolve) => {
        const open = indexedDB.open('firebaseLocalStorageDb');
        open.onerror = () => resolve([]);
        open.onsuccess = () => {
          const db = open.result;
          if (!db.objectStoreNames.contains('firebaseLocalStorage')) {
            db.close();
            return resolve([]);
          }
          const req = db.transaction('firebaseLocalStorage').objectStore('firebaseLocalStorage').getAllKeys();
          req.onsuccess = () => {
            db.close();
            resolve((req.result as string[]).filter((k) => k.startsWith('firebase:authUser:')));
          };
          req.onerror = () => resolve([]);
        };
      })
  );
}

/**
 * Older Safari and Firefox have no Navigation API: «back» then rests on the in-app history the
 * root providers keep (lib/client/in-app-history.ts). The WebKit run takes that path on purpose.
 */
async function withoutNavigationApi(page: Page) {
  await page.addInitScript(() => {
    try {
      Object.defineProperty(window, 'navigation', { value: undefined, configurable: true });
    } catch {
      // Not configurable here: the API stays (the assertions still hold through it).
    }
  });
}

async function backdropStates(page: Page) {
  return page.locator('[data-backdrop]').evaluate((el) => el.getAnimations().map((a) => a.playState));
}

test('account.sign-in.c1 c2 c3 c19 — idle: copy, providers in order with marks, legal caption + 44px links; axe at 5 widths', async ({ page }) => {
  const errors = collectConsoleErrors(page);
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(PATH);
    const s = screen(page);
    await expect(s.getByText('MAI APROAPE DE CE IUBEȘTI', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Hai la pescuit.');
    await expect(s.getByText('Locurile tale. Capturile tale. Comunitatea ta.', { exact: true })).toBeVisible();

    // c2 + c3: Apple only when configured (absent, never disabled), then Google, then Facebook.
    const names = await s.locator('[data-provider]').evaluateAll((els) => els.map((e) => e.getAttribute('data-provider')));
    expect(names).toEqual(APPLE_CONFIGURED ? ['apple', 'google', 'facebook'] : ['google', 'facebook']);
    if (!APPLE_CONFIGURED) await expect(s.getByRole('button', { name: /Apple/ })).toHaveCount(0);
    for (const p of ['Google', 'Facebook']) {
      const b = providerButton(page, p);
      await expect(b).toBeEnabled();
      await expect(b.locator('svg')).toHaveCount(1);
    }

    // c19
    await expect(
      s.getByText('Continuând, accepți Termenii și condițiile. Află cum îți prelucrăm datele în Politica de confidențialitate.', { exact: true })
    ).toBeVisible();
    for (const [name, href] of [
      ['Termeni și condiții', TERMS],
      ['Confidențialitate', PRIVACY],
    ] as const) {
      const link = s.getByRole('link', { name, exact: true });
      await expect(link).toHaveAttribute('href', href);
      expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    await expect(s.getByRole('button', { name: 'Explorează fără cont' })).toBeEnabled();
    await expect(alertSlot(page)).toHaveText('');
    // No horizontal scroll at any width.
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expectNoA11yViolations(page);
  }
  expect(errors).toEqual([]);
});

test('account.sign-in.c4 c5 c8 c9 c22 — pending: one spinner, everything disabled, a second press sends nothing, backdrop paused; failure → generic alert, cleared on retry', async ({ page }) => {
  const errors = collectConsoleErrors(page, { ignore: EXPECTED_CONSOLE });
  let calls = 0;
  let release: () => void = () => undefined;
  await page.route('**/api/auth/google', async (route: Route) => {
    calls += 1;
    await new Promise<void>((r) => (release = r));
    await route.fulfill({ status: 500, json: { error: { status: 500, name: 'InternalServerError', message: 'boom' } } });
  });
  await page.goto(PATH);
  await expect.poll(() => backdropStates(page)).toEqual(['running']);

  // c5: two presses in the same tick (before React can disable the button) → one request.
  await providerButton(page, 'Google').evaluate((b: HTMLButtonElement) => {
    b.click();
    b.click();
  });
  const google = providerButton(page, 'Google');
  await expect(google).toHaveAttribute('aria-busy', 'true');
  await expect(google.locator('[data-spinner]')).toHaveCount(1);
  await expect(google).toBeDisabled();
  await expect(providerButton(page, 'Facebook')).toBeDisabled();
  await expect(providerButton(page, 'Facebook')).not.toHaveAttribute('aria-busy', 'true');
  await expect(providerButton(page, 'Facebook').locator('[data-spinner]')).toHaveCount(0);
  await expect(screen(page).getByRole('button', { name: 'Explorează fără cont' })).toBeDisabled();
  await expect(screen(page).getByRole('button', { name: 'Intră', exact: true })).toBeDisabled();
  // c22: the camera push stops while pending.
  await expect.poll(() => backdropStates(page)).toEqual(['paused']);
  await page.waitForTimeout(400);
  expect(calls).toBe(1);

  // c8 + c9: the generic error, in the alert slot under the buttons.
  release();
  await expect(alertSlot(page)).toHaveText(GENERIC);
  const alertBox = (await alertSlot(page).boundingBox())!;
  const fbBox = (await providerButton(page, 'Facebook').boundingBox())!;
  expect(alertBox.y).toBeGreaterThan(fbBox.y + fbBox.height);
  await expect(google).toBeEnabled();
  await expect.poll(() => backdropStates(page)).toEqual(['running']);

  // c9: a new attempt clears it at once.
  await google.click();
  await expect(google).toHaveAttribute('aria-busy', 'true');
  await expect(alertSlot(page)).toHaveText('');
  // The second request must be held by the route before it is released (aria-busy comes first).
  await expect.poll(() => calls).toBe(2);
  release();
  await expect(alertSlot(page)).toHaveText(GENERIC);
  expect(errors).toEqual([]);
});

test('account.sign-in.c6 — a cancelled provider popup is silent and back to idle', async ({ page }) => {
  const errors = collectConsoleErrors(page);
  let calls = 0;
  await page.route('**/api/auth/google', (r) => {
    calls += 1;
    return r.abort();
  });
  await page.goto(PATH);
  await page.evaluate(() => ((window as unknown as { __gsi: string }).__gsi = 'cancel'));
  await providerButton(page, 'Google').click();
  await expect(providerButton(page, 'Google')).toBeEnabled();
  await expect(providerButton(page, 'Google')).not.toHaveAttribute('aria-busy', 'true');
  await expect(alertSlot(page)).toHaveText('');
  expect(calls).toBe(0);
  await expect(page).toHaveURL(/\/intra$/);
  expect(errors).toEqual([]);
});

test('account.sign-in.c7 c11 — Facebook without email: CMS bluCode AUTH:EMAIL_REQUIRED, and the declined email permission', async ({ page }) => {
  const errors = collectConsoleErrors(page, { ignore: EXPECTED_CONSOLE });
  let calls = 0;
  await page.route('**/api/auth/facebook', (r) => {
    calls += 1;
    return r.fulfill({
      status: 400,
      json: { error: { status: 400, name: 'ApplicationError', message: 'Email required', details: { bluCode: 'AUTH:EMAIL_REQUIRED' } } },
    });
  });
  await page.goto(PATH);
  const fbOpts = () => page.evaluate(() => (window as unknown as { __fbOpts?: { auth_type?: string }[] }).__fbOpts ?? []);
  await providerButton(page, 'Facebook').click();
  await expect(alertSlot(page)).toHaveText(NO_EMAIL);
  expect(calls).toBe(1);
  // c7: the retry the copy asks for re-requests the declined email permission (FB auth_type rerequest).
  expect((await fbOpts())[0].auth_type).toBeUndefined();

  // The user unticked «email» in the Facebook dialog: same copy, nothing sent to the CMS.
  await page.evaluate(() => {
    (window as unknown as { __fb: unknown }).__fb = { status: 'connected', authResponse: { accessToken: 't', grantedScopes: 'public_profile' } };
  });
  await providerButton(page, 'Facebook').click();
  await expect(alertSlot(page)).toHaveText(NO_EMAIL);
  expect(calls).toBe(1);
  expect((await fbOpts())[1]).toMatchObject({ scope: 'public_profile,email', auth_type: 'rerequest' });

  // A cancelled Facebook dialog (no authResponse) is silent (c6).
  await page.evaluate(() => {
    (window as unknown as { __fb: unknown }).__fb = { status: 'unknown', authResponse: null };
  });
  await providerButton(page, 'Facebook').click();
  await expect(alertSlot(page)).toHaveText('');
  expect(errors).toEqual([]);
});

test('account.sign-in.c15 — the profile read fails after sign-in: generic error, the half-made session is dropped (cookie and Firebase)', async ({ page }) => {
  // The seeded user's restore reload is aborted on purpose (seedFirebaseUser).
  const errors = collectConsoleErrors(page, { ignore: [...EXPECTED_CONSOLE, /net::ERR_FAILED/] });
  await mockLocalAuth(page, { firebaseToken: 'e2e-custom-token' });
  await page.route('**/api/cms/user/profile', (r) => r.fulfill({ status: 500, json: { error: { status: 500, message: 'boom' } } }));
  const exchanges: string[] = [];
  page.on('request', (r) => {
    if (/signInWithCustomToken/.test(r.url())) exchanges.push(r.url());
  });
  const logout = page.waitForRequest((r) => r.url().endsWith('/api/auth/logout') && r.method() === 'POST');
  await page.goto(`${PATH}?next=%2Fstiri`);
  // Someone signed in to Firebase on this browser before (fish signs Firebase out with the cookie).
  await seedFirebaseUser(page);
  expect(await firebaseUsers(page)).toEqual([FIREBASE_USER_KEY]);
  await signInLocal(page);
  await logout;
  await expect(alertSlot(page)).toHaveText(GENERIC);
  await expect(page).toHaveURL(/\/intra\?next=%2Fstiri$/);
  expect(await sessionCookie(page)).toBeUndefined();
  await expect(providerButton(page, 'Google')).toBeEnabled();
  expect((await page.evaluate(() => (window as unknown as { __events: { name: string }[] }).__events)).map((e) => e.name)).not.toContain('sign_in');
  // A failed sign-in never bridges Firebase, and leaves no Firebase user behind.
  await expect.poll(() => firebaseUsers(page)).toEqual([]);
  expect(exchanges).toEqual([]);
  expect(errors).toEqual([]);
});

test('account.sign-in.c16 account.b.sign-in-redirect — an incomplete profile goes to /profil/completeaza (replace) before any next', async ({ page }) => {
  await mockLocalAuth(page);
  await page.route('**/api/cms/user/profile', async (route) => {
    const res = await route.fetch();
    await route.fulfill({ response: res, json: { ...(await res.json()), isProfileComplete: false } });
  });
  await page.goto('/stiri');
  await page.goto(`${PATH}?next=%2Fbalti`);
  await signInLocal(page);
  await expect(page).toHaveURL(/\/profil\/completeaza$/);
  // replace: Back skips sign-in.
  await page.goBack();
  await expect(page).toHaveURL(/\/stiri$/);
});

test('account.sign-in.c17 c21 account.b.sign-in-redirect — real local sign-in honours a safe next; sign_in is logged and a throwing gtag never blocks', async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await page.addInitScript(() => {
    (window as unknown as { gtag: () => void }).gtag = () => {
      throw new Error('gtag down');
    };
  });
  await page.goto(`${PATH}?next=${encodeURIComponent('/stiri?x=1')}`);
  await signInLocal(page);
  await expect(page).toHaveURL(/\/stiri\?x=1$/);
  expect(await sessionCookie(page)).toBeDefined();
  const events = await page.evaluate(() => (window as unknown as { __events: { name: string; params: unknown }[] }).__events);
  expect(events).toContainEqual({ name: 'sign_in', params: { sign_in_method: 'local' } });
  // Signed in: the top bar no longer offers «Intră».
  await expect(page.getByRole('banner').getByRole('link', { name: 'Intră', exact: true })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('account.sign-in.c17 account.b.sign-in-redirect — unsafe next is ignored: back to the previous page, else home', async ({ page }, testInfo) => {
  if (testInfo.project.name.startsWith('webkit')) await withoutNavigationApi(page);
  await mockLocalAuth(page);
  for (const unsafe of ['//evil.example/x', '/\\evil.example', 'https://evil.example', '/stiri x', '/intra']) {
    await page.goto('/stiri');
    await page.goto(`${PATH}?next=${encodeURIComponent(unsafe)}`);
    await signInLocal(page);
    await expect(page, `next=${unsafe}`).toHaveURL(/\/stiri$/);
    await page.context().clearCookies();
  }
  // No history of ours (a fresh tab): home.
  const fresh = await page.context().newPage();
  await fresh.route('**/api/auth/local', async (route) => {
    await page.context().addCookies([{ name: 'bluvi_session', value: jwt, url: BASE_URL, httpOnly: true, sameSite: 'Lax' }]);
    await route.fulfill({ json: { user: { id: 1 }, firebaseToken: null } });
  });
  await fresh.goto(`${PATH}?next=${encodeURIComponent('//evil.example')}`);
  await signInLocal(fresh);
  await expect(fresh).toHaveURL(`${BASE_URL}/`);
  await fresh.close();
});

test('account.sign-in.c13 — the returned firebaseToken bridges Firebase Auth in the background; its failure does not fail sign-in; no Firestore', async ({ page }) => {
  let firestore = 0;
  await page.route(/firestore\.googleapis\.com/, (r) => {
    firestore += 1;
    return r.abort();
  });
  await page.route(/identitytoolkit\.googleapis\.com/, (r) =>
    r.fulfill({ status: 400, json: { error: { code: 400, message: 'INVALID_CUSTOM_TOKEN' } } })
  );
  await mockLocalAuth(page, { firebaseToken: 'e2e-custom-token' });
  await page.goto(`${PATH}?next=%2Fstiri`);
  const exchange = page.waitForRequest((r) => /identitytoolkit\.googleapis\.com\/.*signInWithCustomToken/.test(r.url()));
  await signInLocal(page);
  expect((await exchange).postData()).toContain('e2e-custom-token');
  await expect(page).toHaveURL(/\/stiri$/);
  expect(firestore).toBe(0);
});

const POINTER_KEY = '@bluvi/partide/activeSessionId';
const POINTER_OWNER_KEY = '@bluvi/partide/activeSessionOwner';
const stored = (page: Page, key: string) => page.evaluate((k) => localStorage.getItem(k), key);

test('account.sign-in.c14 — after the sign-in the active-partidă probe runs once (after the Firebase bridge) and restores the live pointer; no Firestore', async ({ page, request }) => {
  const me = await request.get(`${process.env.E2E_CMS_URL ?? 'http://localhost:1337/api'}/user/profile`, { headers: { authorization: `Bearer ${jwt}` } });
  const selfId = (await me.json()).documentId as string;
  let firestore = 0;
  await page.route(/firestore\.googleapis\.com/, (r) => {
    firestore += 1;
    return r.abort();
  });
  let probes = 0;
  await page.route('**/api/cms/feed/sessions/active', (r) => {
    probes += 1;
    return r.fulfill({ json: { data: { documentId: 'e2e-probe-doc', clientId: 'e2e-probe-client', firestoreId: 'e2e-probe-client' } } });
  });
  await mockLocalAuth(page);
  await page.goto(`${PATH}?next=%2Fstiri`);
  expect(await stored(page, POINTER_KEY)).toBeNull();
  await signInLocal(page);
  await expect(page).toHaveURL(/\/stiri$/);
  // fish probeActiveSessionAfterSignIn: the pointer (two ids) for this account, fire-and-forget.
  await expect.poll(() => stored(page, POINTER_KEY)).toBe(JSON.stringify({ sessionId: 'e2e-probe-client', documentId: 'e2e-probe-doc' }));
  expect(await stored(page, POINTER_OWNER_KEY)).toBe(selfId);
  expect(probes).toBe(1);
  expect(firestore).toBe(0);
});

test('account.sign-in.c14 — no live partidă stores nothing; a failed probe never fails or delays the sign-in', async ({ page }) => {
  let answer: 'none' | 'fail' = 'none';
  await page.route('**/api/cms/feed/sessions/active', (r) =>
    answer === 'none' ? r.fulfill({ json: { data: null } }) : r.fulfill({ status: 500, json: { data: null, error: { status: 500, message: 'x' } } })
  );
  await mockLocalAuth(page);
  for (const mode of ['none', 'fail'] as const) {
    answer = mode;
    await page.context().clearCookies();
    await page.goto(`${PATH}?next=%2Fstiri`);
    const probe = page.waitForRequest('**/api/cms/feed/sessions/active');
    await signInLocal(page);
    await expect(page).toHaveURL(/\/stiri$/);
    await probe;
    await page.waitForTimeout(300);
    expect(await stored(page, POINTER_KEY)).toBeNull();
    expect(await stored(page, POINTER_OWNER_KEY)).toBeNull();
  }
});

test('account.sign-in.c18 — «Explorează fără cont» goes back when there is history, else home', async ({ page }, testInfo) => {
  if (testInfo.project.name.startsWith('webkit')) await withoutNavigationApi(page);
  await page.goto('/stiri');
  await page.goto(PATH);
  await screen(page).getByRole('button', { name: 'Explorează fără cont' }).click();
  await expect(page).toHaveURL(/\/stiri$/);
  // Hydrated (the in-app history tracker stamped this entry) before leaving for another site.
  await expect.poll(() => page.evaluate(() => Boolean((history.state as { __bluviNav?: unknown } | null)?.__bluviNav))).toBe(true);

  await page.goto('about:blank');
  await page.goto(PATH);
  await screen(page).getByRole('button', { name: 'Explorează fără cont' }).click();
  await expect(page).toHaveURL(`${BASE_URL}/`);
});

test('account.sign-in.c18 c17 — without the Navigation API: landed from a search engine, soft-navigated to /intra, «back» stays in the app', async ({ page }) => {
  await withoutNavigationApi(page);
  await mockLocalAuth(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  const intra = () => page.getByRole('banner').getByRole('link', { name: 'Intră', exact: true });

  // c18: the referrer is Google's (set once, at the hard load); the history before /intra is ours.
  await page.goto('/stiri', { referer: 'https://www.google.com/' });
  await intra().click();
  await expect(page).toHaveURL(/\/intra\?next=%2Fstiri$/);
  expect(await page.evaluate(() => document.referrer)).toBe('https://www.google.com/');
  await screen(page).getByRole('button', { name: 'Explorează fără cont' }).click();
  await expect(page).toHaveURL(/\/stiri$/);

  // c17: a sign-in without a usable next goes back the same way.
  await page.goto('/stiri', { referer: 'https://www.facebook.com/' });
  await intra().click();
  await expect(page).toHaveURL(/\/intra\?next=%2Fstiri$/);
  await page.evaluate(() => history.replaceState(history.state, '', '/intra?next=%2F%2Fevil.example'));
  await signInLocal(page);
  await expect(page).toHaveURL(/\/stiri$/);
});

test('account.sign-in.c20 — a legal link the browser refuses to open shows the link error in the alert slot', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __opened: string[]; __refuse: boolean };
    w.__opened = [];
    window.open = ((url?: string | URL) => {
      w.__opened.push(String(url));
      return w.__refuse ? null : ({ opener: window } as unknown as Window);
    }) as typeof window.open;
  });
  await page.goto(PATH);
  await screen(page).getByRole('link', { name: 'Termeni și condiții' }).click();
  await expect(alertSlot(page)).toHaveText('');
  expect(await page.evaluate(() => (window as unknown as { __opened: string[] }).__opened)).toEqual([TERMS]);

  await page.evaluate(() => ((window as unknown as { __refuse: boolean }).__refuse = true));
  await screen(page).getByRole('link', { name: 'Confidențialitate' }).click();
  await expect(alertSlot(page)).toHaveText(LINK_ERROR);
  await expect(page).toHaveURL(/\/intra$/);
});

test('account.sign-in.c22 c4 — reduced motion: the backdrop never moves, the pending spinner keeps turning', async ({ page }) => {
  let release: () => void = () => undefined;
  await page.route('**/api/auth/google', async (route: Route) => {
    await new Promise<void>((r) => (release = r));
    await route.fulfill({ status: 500, json: { error: { status: 500, name: 'InternalServerError', message: 'boom' } } });
  });
  collectConsoleErrors(page, { ignore: EXPECTED_CONSOLE });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(PATH);
  await expect(page.locator('[data-backdrop] img')).toBeVisible();
  await page.waitForTimeout(300);
  expect(await backdropStates(page)).toEqual([]);

  // The global reduced-motion clamp (120ms × 1) must not freeze the only progress cue.
  await providerButton(page, 'Google').click();
  const spinner = providerButton(page, 'Google').locator('[data-spinner]');
  await expect(spinner).toHaveCount(1);
  await page.waitForTimeout(600);
  const spins = await spinner.evaluate((el) =>
    el.getAnimations().map((a) => ({ state: a.playState, iterations: a.effect?.getComputedTiming().iterations }))
  );
  expect(spins).toEqual([{ state: 'running', iterations: Infinity }]);
  expect(await spinner.evaluate((el) => getComputedStyle(el).transform)).not.toBe('none');
  release();
  await expect(alertSlot(page)).toHaveText(GENERIC);
});

test('account.sign-in.c4 — the provider SDKs are loaded before the first tap (popup inside the user gesture)', async ({ page }) => {
  const gsi = page.waitForRequest('https://accounts.google.com/gsi/client');
  const fb = page.waitForRequest((r) => r.url().startsWith('https://connect.facebook.net/'));
  await page.goto(PATH);
  // No hover, focus or click: idle after first paint is enough.
  await Promise.all([gsi, fb]);
});

/**
 * Stubs that record how the provider was reached: inside the tap's click dispatch (window.event),
 * with transient user activation, and whether the popup (window.open) was granted a window.
 */
const PROBE = `function __probe(name) {
  // Read before window.open, which consumes the transient activation.
  var active = navigator.userActivation ? navigator.userActivation.isActive : null;
  var event = window.event ? window.event.type : null;
  var w = window.open('about:blank', 'bluvi-' + name, 'popup,width=400,height=600');
  (window.__calls = window.__calls || []).push({ name: name, event: event, active: active, popup: !!w });
  if (w) w.close();
}`;
const GSI_PROBE = `${PROBE} window.google = { accounts: { oauth2: { initCodeClient: function (cfg) { return { requestCode: function () {
  __probe('google'); cfg.error_callback({ type: 'popup_closed' }); } }; } } } };`;
const FB_PROBE = `${PROBE} window.FB = { init: function () {}, login: function (cb) { __probe('facebook'); cb({ status: 'unknown', authResponse: null }); } };
if (window.fbAsyncInit) window.fbAsyncInit();`;

async function coldTapProbe(browser: Browser, phone: Parameters<Browser['newContext']>[0]) {
  for (const provider of ['Google', 'Facebook'] as const) {
    const context = await browser.newContext({ ...phone, baseURL: BASE_URL });
    await context.route('https://accounts.google.com/gsi/client', (r) => r.fulfill({ contentType: 'application/javascript', body: GSI_PROBE }));
    await context.route('https://connect.facebook.net/**', (r) => r.fulfill({ contentType: 'application/javascript', body: FB_PROBE }));
    await context.route(/firestore\.googleapis\.com/, (r) => r.abort());
    let posted = 0;
    await context.route('**/api/auth/**', (r) => {
      posted += 1;
      return r.abort();
    });
    const page = await context.newPage();
    const errors = collectConsoleErrors(page);
    // Fresh tab, nothing cached: the SDKs arrive only through the idle preload after first paint.
    const sdk = page.waitForRequest(provider === 'Google' ? 'https://accounts.google.com/gsi/client' : /connect\.facebook\.net/);
    await page.goto(PATH);
    await sdk;
    const box = (await providerButton(page, provider).boundingBox())!;
    // A real touch tap: no hover, no focus warm-up before it.
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await expect.poll(() => page.evaluate(() => (window as unknown as { __calls?: unknown[] }).__calls ?? [])).toEqual([
      { name: provider.toLowerCase(), event: 'click', active: true, popup: true },
    ]);
    // The probe answers «closed»: silent, back to idle (c6), nothing sent.
    await expect(providerButton(page, provider)).toBeEnabled();
    await expect(alertSlot(page)).toHaveText('');
    expect(posted).toBe(0);
    expect(errors).toEqual([]);
    await context.close();
  }
}

test('account.sign-in.c24 — cold first tap on a phone (Chromium, touch): the provider window opens inside the tap (click dispatch, user activation, popup granted)', async ({ browser }) => {
  await coldTapProbe(browser, { viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });
});

test('account.sign-in.c24 — cold first tap on an iPhone (WebKit): the provider window opens inside the tap', async () => {
  const safari = await webkit.launch();
  try {
    const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = devices['iPhone 13'];
    const iphone = { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch };
    await coldTapProbe(safari, iphone);

    // Control: the probe does catch a popup opened outside the tap. An SDK still downloading at
    // the tap (held here) puts the network between the gesture and window.open.
    const context = await safari.newContext({ ...iphone, baseURL: BASE_URL });
    let releaseSdk: () => void = () => undefined;
    await context.route('https://accounts.google.com/gsi/client', async (r) => {
      await new Promise<void>((done) => (releaseSdk = done));
      await r.fulfill({ contentType: 'application/javascript', body: GSI_PROBE });
    });
    await context.route('https://connect.facebook.net/**', (r) => r.abort());
    const page = await context.newPage();
    const held = page.waitForRequest('https://accounts.google.com/gsi/client');
    await page.goto(PATH);
    await held;
    const box = (await providerButton(page, 'Google').boundingBox())!;
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(1500);
    releaseSdk();
    await expect
      .poll(() => page.evaluate(() => ((window as unknown as { __calls?: { event: string | null }[] }).__calls ?? []).map((c) => c.event === 'click')))
      .toEqual([false]);
    await context.close();
  } finally {
    await safari.close();
  }
});

test('account.sign-in.c23 — leaving /intra while a provider is pending never navigates later; the session is kept', async ({ page }) => {
  await page.route('**/api/auth/google', async (route) => {
    await page.context().addCookies([{ name: 'bluvi_session', value: jwt, url: BASE_URL, httpOnly: true, sameSite: 'Lax' }]);
    await route.fulfill({ json: { user: { id: 1 }, firebaseToken: null } });
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/stiri');
  // A client-side navigation, so Back stays in the same document (the attempt keeps running).
  await page.getByRole('banner').getByRole('link', { name: 'Intră', exact: true }).click();
  await expect(page).toHaveURL(/\/intra\?next=%2Fstiri$/);
  await page.evaluate(() => ((window as unknown as { __gsi: string }).__gsi = 'hold'));
  await providerButton(page, 'Google').click();
  await expect(providerButton(page, 'Google')).toHaveAttribute('aria-busy', 'true');
  await page.goBack();
  await expect(page).toHaveURL(/\/stiri$/);
  const profile = page.waitForResponse((r) => r.url().includes('/api/cms/') || r.url().includes('/stiri'));
  await page.evaluate(() => (window as unknown as { __gsiRelease: () => void }).__gsiRelease());
  await profile.catch(() => undefined);
  await expect.poll(() => sessionCookie(page)).toBeDefined();
  await page.waitForTimeout(1500);
  await expect(page).toHaveURL(/\/stiri$/);
  // Re-rendered signed in where the user is: the top bar no longer offers «Intră».
  await expect(page.getByRole('banner').getByRole('link', { name: 'Intră', exact: true })).toHaveCount(0);
});

const SESSION_EXPIRED = 'Sesiunea ta a expirat. Te rugăm să te autentifici din nou.';

/** Signed in on `path`, but every /api/cms read from the browser answers «dead session» (needs ≥2 reads). */
async function killSessionOn(page: Page, path: string, burst = 2) {
  const DEAD = { error: { status: 401, name: 'UnauthorizedError', message: 'Missing or invalid credentials', details: {} } };
  const seen = { dead: 0, logouts: 0 };
  await page.context().addCookies([{ name: 'bluvi_session', value: jwt, url: BASE_URL, httpOnly: true, sameSite: 'Lax' }]);
  await page.addInitScript(() => {
    const w = window as unknown as { __toIntra: string[] };
    w.__toIntra = [];
    for (const k of ['pushState', 'replaceState'] as const) {
      const orig = history[k].bind(history);
      history[k] = (data: unknown, unused: string, url?: string | URL | null) => {
        if (url && String(url).includes('/intra')) w.__toIntra.push(String(url));
        return orig(data, unused, url);
      };
    }
  });
  await page.route('**/api/auth/logout', async (route) => {
    seen.logouts += 1;
    await page.context().clearCookies();
    await route.fulfill({ json: { ok: true } });
  });
  // The server renders the page signed in (the cookie is valid); every per-user read the browser
  // makes answers «dead session», as when the CMS revokes the JWT between render and fetch.
  // The first two answers are held and released together: a real burst, whatever the fetch timing.
  const held: Route[] = [];
  await page.route('**/api/cms/**', async (route) => {
    seen.dead += 1;
    if (seen.dead > burst) return route.fulfill({ status: 401, json: DEAD });
    held.push(route);
    if (held.length === burst) await Promise.all(held.map((r) => r.fulfill({ status: 401, json: DEAD })));
  });
  await page.goto(path);
  return seen;
}

test('global.b.session-expired account.b.session-expired — a burst of dead-session 401s: one logout, one toast, one redirect, Firebase signed out', async ({ page }) => {
  collectConsoleErrors(page, { ignore: [/status of 401/] });
  // The dead angler's Firebase session, persisted on this browser (fish signs it out with the cookie).
  await page.goto(PATH);
  await seedFirebaseUser(page);
  expect(await firebaseUsers(page)).toEqual([FIREBASE_USER_KEY]);
  // Notificări reads the list and the unread count from the browser: the burst.
  const seen = await killSessionOn(page, '/notificari');
  await expect(page).toHaveURL(/\/intra\?next=%2Fnotificari$/);
  await expect(page.getByRole('alert').filter({ hasText: SESSION_EXPIRED })).toBeVisible();
  await page.waitForTimeout(1500);
  expect(seen.dead).toBeGreaterThanOrEqual(2);
  expect(seen.logouts).toBe(1);
  expect(await page.evaluate(() => (window as unknown as { __toIntra: string[] }).__toIntra)).toEqual(['/intra?next=%2Fnotificari']);
  await expect(page.getByText(SESSION_EXPIRED)).toHaveCount(1);
  expect(await sessionCookie(page)).toBeUndefined();
  // The shared top bar re-rendered signed out (no notifications bell).
  await expect(page.getByRole('banner').getByRole('link', { name: /^Notificări/ })).toHaveCount(0);
  // The next person on this browser is not Firestore-authenticated as the dead angler.
  await expect.poll(() => firebaseUsers(page)).toEqual([]);
});

test('global.b.session-expired — from a public page the redirect carries the page as next', async ({ page }) => {
  collectConsoleErrors(page, { ignore: [/status of 401/] });
  // /stiri has one browser read (the top bar's unread count): no hold.
  const seen = await killSessionOn(page, '/stiri?x=1', 1);
  await expect(page).toHaveURL(/\/intra\?next=%2Fstiri%3Fx%3D1$/);
  await expect(page.getByRole('alert').filter({ hasText: SESSION_EXPIRED })).toBeVisible();
  expect(seen.logouts).toBe(1);
});

test('account.sign-in keyboard path — Tab reaches every control in order; Enter starts a provider', async ({ page }) => {
  let calls = 0;
  await page.route('**/api/auth/google', (r) => {
    calls += 1;
    return r.fulfill({ status: 400, json: { error: { status: 400, name: 'ApplicationError', message: 'x' } } });
  });
  collectConsoleErrors(page, { ignore: EXPECTED_CONSOLE });
  await page.goto(PATH);
  const order: string[] = [];
  for (let i = 0; i < 40 && order.at(-1) !== 'Confidențialitate'; i++) {
    await page.keyboard.press('Tab');
    const name = await page.evaluate(() => {
      const a = document.activeElement as HTMLElement | null;
      if (!a?.closest('section[aria-labelledby="intra-titlu"]')) return null;
      return a.getAttribute('name') ?? a.textContent?.trim() ?? null;
    });
    if (name) order.push(name);
  }
  expect(order).toEqual([
    ...(APPLE_CONFIGURED ? ['Continuă cu Apple'] : []),
    'Continuă cu Google',
    'Continuă cu Facebook',
    'identifier',
    'password',
    'Intră',
    'Explorează fără cont',
    'Termeni și condiții',
    'Confidențialitate',
  ]);
  await providerButton(page, 'Google').focus();
  await page.keyboard.press('Enter');
  await expect(alertSlot(page)).toHaveText(GENERIC);
  // Focus never left the pressed button: the next Enter retries from where the user was.
  await expect(providerButton(page, 'Google')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect.poll(() => calls).toBe(2);
});
