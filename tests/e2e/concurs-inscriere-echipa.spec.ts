import { type BrowserContext, type Page, type Route } from '@playwright/test';
import { expect, test } from './helpers/fake-chat';
import { expectNoA11yViolations } from './helpers/a11y';
import { BASE_URL as BASE } from './helpers/base-url';
import { collectConsoleErrors as watchConsole } from './helpers/console';
import { CMS, qaJwt, signIn } from './helpers/session';

/*
 * «Câteva lucruri de menționat» — /concursuri/[id]/inscriere/echipa (parity
 * docs/parity/areas/participant.yml participant.team-disclaimer, T4 single step).
 *
 * No writes: the page only reads. The competition is a real one of the local CMS (its core read
 * once in beforeAll), served to the browser through page.route so each test decides what the
 * viewer is looking at: a team or a single competition, the viewer's /my-status (no entry,
 * pending, approved, rejected), a passed deadline, a reached limit, a cancelled competition.
 * Signed in as the QA user (the server gate reads /users/me for real; an unreadable cookie makes
 * that read fail for the «session unknown» state).
 *
 * Competition (override with E2E_TEAM_COMPETITION): «Cupa Bluvi — Etapa 3», a team competition.
 */

test.describe.configure({ timeout: 120_000 });

const ID = process.env.E2E_TEAM_COMPETITION ?? 'u9kd3xs4n91j2ktah78ke73q';
const PATH = `/concursuri/${ID}/inscriere/echipa`;
const REGISTER = `/concursuri/${ID}/inscriere`;
const PHONE = { width: 375, height: 812 };
const TABLET = { width: 768, height: 1024 };
const LAPTOP = { width: 1280, height: 900 };
const WIDE = { width: 1440, height: 900 };
const SHOTS = process.env.E2E_SHOTS_DIR;

let jwt = '';
let core: Record<string, unknown> = {};

test.beforeAll(async ({ request }) => {
  const res = await request.get(`${CMS}/feed/competitions/${ID}`);
  expect(res.ok(), `competition ${ID} exists in the local CMS`).toBeTruthy();
  core = (await res.json()).data;
  jwt = await qaJwt(request);
});

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });

/** The browser's read of a CMS path (direct or through the same-origin proxy). */
const cms = (path: string) => (url: URL) => url.pathname.endsWith(`/api${path}`) || url.pathname.endsWith(`/api/cms${path}`);

type Scenario = {
  type?: 'team' | 'single';
  status?: 'pending' | 'registered' | 'rejected' | null;
  /** The core read fails with this HTTP status. */
  fail?: number;
  /** Fields over the open competition (a passed deadline, a reached limit, a status). */
  competition?: Record<string, unknown>;
};

/** One approved entry by someone else: with `participantsLimit: 1` the competition is full. */
const OTHER_APPROVED = {
  id: 1,
  documentId: 'e2e-other-approved',
  registrationStatus: 'registered',
  teamName: 'Echipa e2e',
  guestName: null,
  stand: null,
  club: null,
  author: { id: 1, documentId: 'e2e-other-author', username: 'Alt pescar' },
  participants: [],
};

/** The competition as the browser reads it: notStarted, open, no approved entries (never full). */
async function mock(page: Page, { type = 'team', status = null, fail, competition = {} }: Scenario = {}) {
  await page.route(cms(`/feed/competitions/${ID}`), (route) =>
    fail
      ? json(route, { data: null, error: { status: fail, name: 'Error', message: 'mock' } }, fail)
      : json(route, {
          data: {
            ...core,
            competitionType: type,
            teamParticipants: type === 'team' ? 3 : 1,
            competitionStatus: 'notStarted',
            registrationDeadline: '2099-01-01T00:00:00.000Z',
            participantsLimit: 30,
            registrations: [],
            ...competition,
          },
        }),
  );
  await page.route(cms(`/feed/competitions/${ID}/my-status`), (route) =>
    json(route, { data: { isFollowing: false, userRegistrationStatus: status } }),
  );
}

async function open(page: Page, context: BrowserContext, viewport = PHONE, scenario: Scenario = {}) {
  await signIn(context, jwt, BASE);
  await mock(page, scenario);
  await page.setViewportSize(viewport);
  await page.goto(PATH, { waitUntil: 'domcontentloaded', timeout: 90_000 });
}

const continueLink = (page: Page) => page.getByRole('link', { name: 'Am înțeles' });
const settle = (page: Page) => page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  await settle(page);
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
}

/* ============================================================================================== */

test('participant.team-disclaimer — signed out: 307 to /intra?next= this page', async ({ page }) => {
  await page.goto(PATH, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await expect(page).toHaveURL(`${BASE}/intra?next=${encodeURIComponent(PATH)}`, { timeout: 60_000 });
});

test('participant.team-disclaimer — a dead session cookie: the sign-in gate back to this page', async ({ page, context }) => {
  await context.addCookies([{ name: 'bluvi_session', value: 'dead-e2e-token', domain: new URL(BASE).hostname, path: '/', httpOnly: true, sameSite: 'Lax' }]);
  await page.setViewportSize(PHONE);
  await page.goto(PATH, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await expect(page.getByRole('heading', { level: 2, name: 'Sesiunea ta a expirat' })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole('link', { name: 'Intră în cont' })).toHaveAttribute('href', `/intra?next=${encodeURIComponent(PATH)}`);
  await expect(page.getByRole('link', { name: 'Înapoi la concurs' })).toHaveAttribute('href', `/concursuri/${ID}`);
  await expect(continueLink(page)).toHaveCount(0);
  await shot(page, 'dead-375');
});

test('participant.team-disclaimer.c1 participant.team-disclaimer.c2 participant.team-disclaimer.c3 participant.team-disclaimer.c4 — team competition, new entry: the copy, at every width', async ({ page, context }) => {
  const errors = watchConsole(page);
  await open(page, context, PHONE);

  // c1 — back control, illustration, title (h1), the competition's name over it.
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Câteva lucruri de menționat', { timeout: 60_000 });
  const title = page.locator('header').filter({ has: page.getByRole('heading', { level: 1 }) });
  await expect(title.getByText(String(core.name), { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Înapoi' })).toBeVisible();
  await expect(page.locator('main svg[viewBox="0 0 320 200"]')).toBeVisible();

  // c2 — the intro, «echipe» emphasised by weight as well as colour.
  const intro = page.getByText('Acesta este un concurs pe echipe, astfel vă rugăm să luați în considerare următoarele:');
  await expect(intro).toBeVisible();
  const echipe = intro.locator('strong', { hasText: 'echipe' });
  await expect(echipe).toHaveText('echipe');
  expect(Number(await echipe.evaluate((el) => getComputedStyle(el).fontWeight))).toBeGreaterThanOrEqual(600);
  const introColor = await intro.evaluate((el) => getComputedStyle(el).color);
  expect(await echipe.evaluate((el) => getComputedStyle(el).color)).not.toBe(introColor);

  // c3 — «Înscrierea în concurs».
  const signup = page.getByRole('region', { name: 'Înscrierea în concurs' });
  await expect(signup.getByRole('heading', { level: 2 })).toHaveText('Înscrierea în concurs');
  await expect(signup.locator('p')).toHaveText(
    'Doar o singură persoană din echipă trebuie să facă înregistrarea în concurs și să adauge toți coechipierii. Aceștia vor fi înregistrați și notificați automat.',
  );
  await expect(signup.locator('strong')).toHaveText('o singură persoană din echipă');

  // c4 — «Modificări», the last sentence emphasised (fish copy, see b.disclaimer-copy-mismatch).
  const changes = page.getByRole('region', { name: 'Modificări' });
  await expect(changes.getByRole('heading', { level: 2 })).toHaveText('Modificări');
  await expect(changes.locator('p')).toHaveText(
    'Datele înscrierii pot fi modificate doar până când organizatorul competiției acceptă înscrierea. După ce înscrierea a fost aprobată, nicio modificare nu mai este permisă.',
  );
  await expect(changes.locator('strong')).toHaveText('nicio modificare nu mai este permisă.');

  // Phone: one CTA, in the bar on the bottom edge.
  await expect(continueLink(page)).toHaveCount(1);
  const bar = await continueLink(page).boundingBox();
  expect(bar && bar.y + bar.height).toBeGreaterThan(PHONE.height - 100);
  await expectNoA11yViolations(page);
  await shot(page, 'team-375');

  // c3/c4: fish's DisclaimerItem accent — a 2px outline in the accent, an accent-filled disc.
  for (const card of [signup, changes]) {
    const style = await card.evaluate((el) => {
      const cs = getComputedStyle(el);
      const disc = el.querySelector('span[aria-hidden]');
      return { width: cs.borderTopWidth, border: cs.borderTopColor, disc: disc ? getComputedStyle(disc).backgroundColor : '' };
    });
    expect(style.width).toBe('2px');
    expect(style.disc).toBe(style.border);
  }

  // From 768 one axis with the header; from 1280 the column under the title text, the facts on the
  // right with the CTA docked under them (no centred island, no caption summary under the title).
  const h1 = page.getByRole('heading', { level: 1 });
  const facts = page.getByRole('region', { name: 'Despre concurs' });
  for (const [vp, name] of [
    [TABLET, '768'],
    [{ width: 1024, height: 900 }, '1024'],
    [LAPTOP, '1280'],
    [WIDE, '1440'],
    [{ width: 1920, height: 1000 }, '1920'],
  ] as const) {
    await page.setViewportSize(vp);
    await expect(continueLink(page)).toHaveCount(1);
    const a = (await signup.boundingBox())!;
    const b = (await changes.boundingBox())!;
    const t = (await h1.boundingBox())!;
    const back = (await page.getByRole('button', { name: 'Înapoi' }).boundingBox())!;
    if (vp.width >= 1024) expect(Math.abs(a.y - b.y), `${name}: cards side by side`).toBeLessThan(2);
    else expect(b.y, `${name}: cards stacked`).toBeGreaterThan(a.y + a.height);
    if (vp.width >= 1280) {
      expect(Math.abs(a.x - t.x), `${name}: the column starts under the title text`).toBeLessThan(2);
      await expect(facts).toBeVisible();
      await expect(facts.getByText('până la 3 pescari')).toBeVisible();
      const f = (await facts.boundingBox())!;
      expect(f.x, `${name}: the facts right of the cards`).toBeGreaterThan(b.x + b.width);
      const cta = (await continueLink(page).boundingBox())!;
      expect(cta.y, `${name}: the CTA docked under the facts`).toBeGreaterThan(f.y + f.height - 1);
      expect(cta.x).toBeGreaterThanOrEqual(f.x - 1);
      // The page fills the shell: the facts end near the right edge (no empty band).
      expect(vp.width - (f.x + f.width), `${name}: no empty band on the right`).toBeLessThan(vp.width >= 1920 ? 140 : 60);
    } else {
      expect(Math.abs(a.x - back.x), `${name}: the cards on the header's left edge`).toBeLessThan(2);
      await expect(facts).toBeHidden();
      // The bar on the bottom edge.
      const cta = (await continueLink(page).boundingBox())!;
      expect(cta.y + cta.height).toBeGreaterThan(vp.height - 100);
    }
    await expect(title.getByText(/pescari pe echipă/)).toHaveCount(0);
    await expectNoA11yViolations(page);
    await shot(page, `team-${name}`);
  }
  expect(errors).toEqual([]);
});

test('participant.team-disclaimer.c5 — «Am înțeles» opens the registration form, once on a double click', async ({ page, context }) => {
  await open(page, context, PHONE);
  await expect(continueLink(page)).toHaveAttribute('href', REGISTER, { timeout: 60_000 });
  await continueLink(page).dblclick();
  await page.waitForURL(`${BASE}${REGISTER}`, { timeout: 60_000 });
  // One navigation: Back returns to the disclaimer, not to a second copy of the form.
  await page.goBack();
  await expect(page).toHaveURL(`${BASE}${PATH}`, { timeout: 30_000 });
});

test('participant.team-disclaimer.c5 — keyboard: Tab reaches «Am înțeles», Enter opens the form (1280)', async ({ page, context }) => {
  await open(page, context, LAPTOP);
  await expect(continueLink(page)).toBeVisible({ timeout: 60_000 });
  // Hydrated and settled: a Tab pressed before hydration is lost when React takes over the DOM.
  await settle(page);
  let found = false;
  for (let i = 0; i < 40 && !found; i++) {
    await page.keyboard.press('Tab');
    found = await page.evaluate(() => document.activeElement?.textContent?.trim() === 'Am înțeles');
  }
  expect(found, '«Am înțeles» is in the tab order').toBe(true);
  // The keyboard focus is visible on it.
  expect(await page.evaluate(() => document.activeElement?.matches(':focus-visible'))).toBe(true);
  await page.keyboard.press('Enter');
  await page.waitForURL(`${BASE}${REGISTER}`, { timeout: 60_000 });
});

test('participant.team-disclaimer.c1 — back with no page before: the competition', async ({ page, context }) => {
  await open(page, context, PHONE);
  await page.getByRole('button', { name: 'Înapoi' }).click({ timeout: 60_000 });
  await page.waitForURL(`${BASE}/concursuri/${ID}`, { timeout: 60_000 });
});

for (const [label, scenario] of [
  ['a single competition', { type: 'single' }],
  ['a viewer with a pending entry', { type: 'team', status: 'pending' }],
  ['a viewer with an approved entry', { type: 'team', status: 'registered' }],
] as const) {
  test(`participant.team-disclaimer.c6 — ${label}: replaced by the registration form, the copy never shown`, async ({ page, context }) => {
    let shown = false;
    await page.exposeFunction('__disclaimerShown', () => {
      shown = true;
    });
    await page.addInitScript(() => {
      new MutationObserver(() => {
        if (document.body?.innerText.includes('o singură persoană din echipă')) (window as unknown as { __disclaimerShown: () => void }).__disclaimerShown();
      }).observe(document, { subtree: true, childList: true, characterData: true });
    });
    await open(page, context, PHONE, scenario);
    await page.waitForURL(`${BASE}${REGISTER}`, { timeout: 60_000 });
    expect(shown, 'the disclaimer copy never rendered').toBe(false);
  });
}

test('participant.team-disclaimer — the competition cannot be read: an error with a retry; unknown: not found', async ({ page, context }) => {
  await open(page, context, PHONE, { fail: 500 });
  await expect(page.getByRole('alert').getByRole('heading', { name: 'Concursul nu a putut fi încărcat' })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole('button', { name: 'Încearcă din nou' })).toBeVisible();
  await expect(continueLink(page)).toHaveCount(0);
  await expectNoA11yViolations(page);
  await shot(page, 'error-375');

  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await mock(page, { fail: 404 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Concursul nu există' })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole('link', { name: 'Vezi competițiile' })).toHaveAttribute('href', '/concursuri');
  await expect(continueLink(page)).toHaveCount(0);
  await expectNoA11yViolations(page);
  await shot(page, 'not-found-375');
});

/** A session cookie the server cannot send as a bearer (invalid header byte): /users/me throws → «unknown». */
const UNREADABLE_SESSION = '%C8%99abc';

test('participant.team-disclaimer — session unknown (the CMS did not answer /users/me): «Serverul nu răspunde» + retry, never signed out', async ({ page, context }) => {
  await context.addCookies([{ name: 'bluvi_session', value: UNREADABLE_SESSION, domain: new URL(BASE).hostname, path: '/', httpOnly: true, sameSite: 'Lax' }]);
  await page.setViewportSize(PHONE);
  await page.goto(PATH, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await expect(page).toHaveURL(`${BASE}${PATH}`);
  const alert = page.getByRole('alert').filter({ has: page.getByRole('heading', { name: 'Serverul nu răspunde' }) });
  await expect(alert).toBeVisible({ timeout: 60_000 });
  await expect(alert.getByRole('button', { name: 'Încearcă din nou' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Câteva lucruri de menționat');
  await expect(continueLink(page)).toHaveCount(0);
  await expect(page.getByRole('main').getByRole('link', { name: 'Intră în cont' })).toHaveCount(0);
  await expectNoA11yViolations(page);
  await shot(page, 'unknown-375');
});

/* c6 — the viewer cannot register: the reason and the way back, never the copy or «Am înțeles». */
for (const [label, scenario, reason, name] of [
  ['a rejected viewer', { status: 'rejected' }, 'Cererea ta de a te înscrie în această competiție a fost respinsă.', 'rejected'],
  ['the deadline passed', { competition: { registrationDeadline: '2020-01-01T00:00:00.000Z' } }, 'Termenul pentru înscriere a expirat', 'deadline'],
  ['the limit reached', { competition: { participantsLimit: 1, registrations: [OTHER_APPROVED] } }, 'Numărul maxim de participanți a fost atins', 'full'],
  ['a cancelled competition', { competition: { competitionStatus: 'cancelled' } }, 'Concursul a fost anulat.', 'cancelled'],
] as const) {
  test(`participant.team-disclaimer.c6 — ${label}: the reason and the way back, no copy, no form`, async ({ page, context }) => {
    let shown = false;
    await page.exposeFunction('__disclaimerShown', () => {
      shown = true;
    });
    await page.addInitScript(() => {
      new MutationObserver(() => {
        if (document.body?.innerText.includes('o singură persoană din echipă')) (window as unknown as { __disclaimerShown: () => void }).__disclaimerShown();
      }).observe(document, { subtree: true, childList: true, characterData: true });
    });
    await open(page, context, PHONE, scenario as Scenario);
    await expect(page.getByRole('heading', { level: 2, name: 'Înscrierea nu este disponibilă' })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText(reason)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Înapoi la concurs' })).toHaveAttribute('href', `/concursuri/${ID}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Câteva lucruri de menționat');
    await expect(continueLink(page)).toHaveCount(0);
    await settle(page);
    await expect(page).toHaveURL(`${BASE}${PATH}`);
    expect(shown, 'the disclaimer copy never rendered').toBe(false);
    await expectNoA11yViolations(page);
    await shot(page, `closed-${name}-375`);
    if (name === 'rejected') {
      await page.setViewportSize(WIDE);
      await expectNoA11yViolations(page);
      await shot(page, 'closed-rejected-1440');
    }
  });
}
