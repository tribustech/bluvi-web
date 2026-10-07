import { expect, test, type Page, type Route } from '@playwright/test';
import { CMS, qaJwt, signIn } from '../e2e/helpers/session';
import { DEFAULT_MASKS, stabilize } from './capture';

/*
 * account.edit-profile (/setari/profil, T6) — one baseline per state × width (ROADMAP §9).
 * GET /user/profile is route-mocked with a made-up profile so the pixels never depend on the QA
 * user's live values; DiceBear is mocked (one fixed SVG), so the saved and the generated avatar are
 * stable. Writes never leave the browser: the upload and the PATCH are answered by the mock or held.
 * The top bar's account button (the server-read Viewer: the real QA name and avatar) is masked.
 */

const PATH = '/setari/profil';
const PROFILE = '**/api/cms/user/profile';
const UPLOAD = '**/api/cms/upload';
const WIDTHS = [375, 768, 1280, 1440] as const;
const HEIGHT: Record<number, number> = { 375: 812, 768: 1024, 1280: 800, 1440: 900 };

const AVATAR_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" fill="#3b82f6"/><circle cx="32" cy="28" r="14" fill="#ffd6c0"/></svg>';

/** The visible fields, laid over the QA user's real GET /user/profile (the schema's shape). */
const FIXED = {
  username: 'Andrei Popescu',
  email: 'andrei@example.invalid',
  provider: 'google',
  phone: '0722123456',
  bio: 'Pescar la crap de 12 ani, mai ales pe Snagov și Dunăre. #crap #feeder',
};
let PROFILE_BODY: Record<string, unknown>;

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const never = () => new Promise<void>(() => {});

const username = (page: Page) => page.getByLabel('Nume utilizator*');
const bio = (page: Page) => page.getByLabel('Biografie');
const phone = (page: Page) => page.getByLabel('Telefon (opțional)');
const submit = (page: Page) => page.getByRole('button', { name: 'Finalizează' }).filter({ visible: true });

interface State {
  name: string;
  profile?: (route: Route) => Promise<void> | void;
  ready: (page: Page) => Promise<void>;
  after?: (page: Page) => Promise<void>;
  /** Viewport only (a dialog over the page). */
  viewport?: boolean;
}

const loaded = (page: Page) => expect(username(page)).toHaveValue(FIXED.username);

const STATES: State[] = [
  {
    name: 'loading',
    profile: () => never(),
    ready: (page) => expect(page.getByTestId('edit-profile-skeleton').filter({ visible: true })).toHaveCount(1),
  },
  {
    name: 'error',
    profile: (r) => json(r, { data: null, error: { status: 503, name: 'ServiceUnavailableError', message: 'boom' } }, 503),
    ready: (page) => expect(page.getByRole('button', { name: 'Încearcă din nou' })).toBeVisible({ timeout: 30_000 }),
  },
  { name: 'pristine', ready: loaded },
  {
    name: 'generated-avatar',
    profile: (r) => json(r, { ...PROFILE_BODY, avatar: null, bio: null, phone: null }),
    ready: (page) => expect(submit(page)).toBeEnabled(),
  },
  {
    name: 'dirty',
    ready: loaded,
    after: async (page) => {
      await bio(page).fill('Feeder pe Snagov, crap pe Dunăre. Concursuri FIPS din 2019. #feeder');
      await expect(submit(page)).toBeEnabled();
    },
  },
  {
    name: 'validation',
    ready: loaded,
    after: async (page) => {
      await username(page).fill('ab');
      await phone(page).fill('12345');
      await submit(page).click();
      await expect(page.getByText('Numele de utilizator trebuie să conțină minim 3 caractere')).toBeVisible();
      await page.mouse.move(0, 0);
    },
  },
  {
    name: 'server-error',
    ready: loaded,
    after: async (page) => {
      await page.route(PROFILE, (r) =>
        r.request().method() === 'PATCH'
          ? json(r, { data: null, error: { status: 400, name: 'BadRequestError', message: 'Numele de utilizator este deja folosit', details: { bluCode: 'USERNAME_ALREADY_IN_USE' } } }, 400)
          : r.fallback(),
      );
      await username(page).fill('pescar_ocupat');
      await submit(page).click();
      await expect(username(page)).toHaveAttribute('aria-invalid', 'true');
      await page.mouse.move(0, 0);
    },
    // The toast sits fixed over the page: capture what the user sees.
    viewport: true,
  },
  {
    name: 'saving',
    ready: loaded,
    after: async (page) => {
      await page.route(UPLOAD, () => never());
      await page.getByRole('button', { name: 'Regenerează avatar' }).click();
      await submit(page).click();
      await expect(submit(page)).toHaveAttribute('aria-busy', 'true');
      await page.mouse.move(0, 0);
    },
  },
  {
    name: 'leave-guard',
    ready: loaded,
    after: async (page) => {
      await bio(page).fill('O biografie nouă, nesalvată.');
      await page.getByRole('button', { name: 'Înapoi' }).click();
      await expect(page.getByRole('alertdialog', { name: 'Renunți la modificări?' })).toBeVisible();
      await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'));
    },
    viewport: true,
  },
];

let jwt: string;
test.beforeAll(async ({ request }) => {
  jwt = await qaJwt(request);
  const res = await request.get(`${CMS}/user/profile`, { headers: { authorization: `Bearer ${jwt}` } });
  expect(res.ok(), 'QA profile read').toBe(true);
  const real = (await res.json()) as Record<string, unknown>;
  const avatar = real.avatar as Record<string, unknown> | null;
  PROFILE_BODY = {
    ...real,
    ...FIXED,
    // A saved avatar whose image is the mocked DiceBear SVG (never the QA user's S3 file).
    avatar: { ...(avatar ?? { id: 1, documentId: 'e2eavatar', name: 'avatar.jpg' }), url: 'https://api.dicebear.com/9.x/personas/svg?seed=visual-fixed', formats: null },
  };
});

test.describe(`setari-profil · ${PATH}`, () => {
  for (const state of STATES) {
    for (const width of WIDTHS) {
      test(`${state.name} · ${width}px`, async ({ page, context, baseURL }) => {
        await page.setViewportSize({ width, height: HEIGHT[width] });
        page.setDefaultNavigationTimeout(8_000);
        await signIn(context, jwt, baseURL);
        await page.route('https://api.dicebear.com/**', (r) =>
          r.fulfill({ status: 200, contentType: 'image/svg+xml', headers: { 'access-control-allow-origin': '*' }, body: AVATAR_SVG }),
        );
        await page.route(PROFILE, (r) => {
          if (r.request().method() !== 'GET') return r.fallback();
          return state.profile ? state.profile(r) : json(r, PROFILE_BODY);
        });
        await page.goto(PATH, { waitUntil: 'domcontentloaded' });
        await state.ready(page);
        await stabilize(page);
        await state.after?.(page);
        // Focusing the first invalid field scrolls; a full-page capture starts from the top.
        if (!state.viewport) await page.evaluate(() => window.scrollTo(0, 0));
        await expect(page).toHaveScreenshot(`setari-profil-${state.name}-${width}.png`, {
          // At 375 the sticky «Finalizează» bar belongs to the viewport: a full-page capture pins it
          // mid-page over a ground band that a phone never shows.
          fullPage: !state.viewport && width !== 375,
          // The server-read Viewer (QA name/avatar) and the live unread-notifications dot.
          mask: [
            ...DEFAULT_MASKS.map((s) => page.locator(s)),
            page.getByRole('button', { name: /^Contul meu/ }),
            page.getByRole('link', { name: /^Notificări/ }),
          ],
        });
      });
    }
  }
});
