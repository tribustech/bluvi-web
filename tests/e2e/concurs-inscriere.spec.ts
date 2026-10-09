import { type Page, type Route } from '@playwright/test';
import { expect, test } from './helpers/fake-chat';
import { getCompetition, type CompetitionDetail } from '../../core/competitions';
import { getProfile, type Profile } from '../../core/social';
import { createTestTransport } from '../transport';
import { expectNoA11yViolations as scan } from './helpers/a11y';
import { BASE_URL as BASE } from './helpers/base-url';
import { collectConsoleErrors } from './helpers/console';
import { findCompetition, registrationOpen } from './helpers/fixtures';
import { cleanupTestCompetitions, competitionExists, createTestCompetition, registrationsOf, userByName } from './helpers/real-registration';
import { qaJwt, signIn } from './helpers/session';

/*
 * Înscriere — /concursuri/[id]/inscriere (parity docs/parity/areas/participant.yml participant.register
 * c1–c22, T4 one step), plus its entry on the competition page (competition-page.bara-actiuni.c4,
 * participant.b.register-entry, participant.b.register-entry-disabled).
 *
 * Writes. Every write here is answered by page.route at the browser's CMS edge (/api/cms or the CMS
 * origin) with fixture competitions, and the spec asserts its method, path and body: team entries
 * (adding teammates pushes to their real accounts), updates, the organizer mode, leave and every
 * error. The ONE real write path here (the QA user registers to a notStarted SINGLE competition it
 * does not author, sees it on the CMS, then leaves it) runs by default since 2026-10-08 (the local
 * CMS has no push tokens and Postmark runs on its test token); E2E_REAL_REGISTRATION=0 skips it. It
 * uses its own throwaway competition (helpers/real-registration), deleted with its registrations in
 * a finally. The other real paths (team, edit, guests, waiting list) are concurs-inscriere-real.spec.ts.
 * Firestore is not touched by this screen.
 */

test.describe.configure({ timeout: 180_000 });

const PHONE = { width: 375, height: 812 };
const TABLET = { width: 768, height: 1024 };
const LAPTOP = { width: 1280, height: 900 };
const WIDE = { width: 1440, height: 900 };

/** A notStarted SINGLE competition with open registration that the QA user does not author. */
const REAL_SINGLE = process.env.E2E_REGISTER_SINGLE ?? 'pby1ovhq0xevex2byx16md28';
const REAL_WRITE = process.env.E2E_REAL_REGISTRATION !== '0';

let jwt = '';
let qa: Profile;
let base: CompetitionDetail;
let single: CompetitionDetail | null = null;

test.beforeAll(async ({ request }) => {
  jwt = await qaJwt(request);
  qa = await getProfile(createTestTransport(jwt));
  single = await findCompetition({
    pinned: REAL_SINGLE,
    status: 'notStarted',
    matches: (c, now) => c.competitionType === 'single' && registrationOpen(c, now) && c.author?.documentId !== qa.documentId,
  });
  base = single ?? (await getCompetition(createTestTransport(), REAL_SINGLE));
});

/* ============================================================================================== */
/* Fixtures and mocks                                                                             */
/* ============================================================================================== */

type Reg = CompetitionDetail['registrations'][number];
const person = (documentId: string, username: string, id = 900) => ({
  id,
  documentId,
  username,
  avatar: null,
});
const regOf = (over: Partial<Reg> & { documentId: string }): Reg => ({
  id: 7001,
  registrationStatus: 'pending',
  teamName: null,
  guestName: null,
  stand: null,
  club: null,
  author: { id: qa.id, documentId: qa.documentId, username: qa.username },
  participants: [person(qa.documentId, qa.username, qa.id)],
  ...over,
});

const future = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();

function fixture(id: string, over: Partial<CompetitionDetail> = {}): CompetitionDetail {
  return {
    ...base,
    documentId: id,
    name: `Cupa e2e ${id}`,
    competitionStatus: 'notStarted',
    competitionType: 'single',
    teamParticipants: null,
    participantsLimit: 30,
    startDate: future(10),
    endDate: future(11),
    registrationDeadline: future(9),
    author: {
      id: 1,
      documentId: 'org-e2e',
      username: 'Organizator e2e',
      phone: null,
    },
    registrations: [],
    ...over,
  };
}

/** The browser's read of a CMS path, direct (public GETs) or through the same-origin proxy. */
const at = (path: string) => (url: URL) => url.pathname === `/api${path}` || url.pathname === `/api/cms${path}`;
const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({
    status,
    contentType: 'application/json',
    headers: { 'access-control-allow-origin': '*' },
    body: JSON.stringify(body),
  });

const users = (from: number, n: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: 5000 + from + i,
    documentId: `u-e2e-${from + i}`,
    username: `Pescar ${from + i}`,
    email: `p${from + i}@e2e.test`,
    provider: 'local',
    isProfileComplete: true,
    phone: null,
    hasRequestedOrganizerRole: false,
    avatar: null,
  }));
const userPage = (page: number, pageCount: number, rows: ReturnType<typeof users>) => ({
  data: rows,
  meta: {
    pagination: {
      page,
      pageSize: 20,
      pageCount,
      total: rows.length + (pageCount - 1) * 20,
    },
  },
});

type Write = { method: string; path: string; body: unknown; at: number };

type Setup = {
  competition: CompetitionDetail;
  profile?: Partial<Profile>;
  statute?: 'author' | 'participant' | null;
  /** /user/all: (search, page) → body or a status. Default: two pages of fixtures. */
  users?: (search: string, page: number, route: Route) => Promise<void> | void;
  /** Answers for the writes; default success. */
  write?: (w: Write, route: Route) => Promise<void> | void;
  /** Holds the competition read until the returned function is called. */
  holdCompetition?: boolean;
  /** What the competition read answers now (default: `competition`, fixed). */
  serve?: () => CompetitionDetail;
  /** my-status's userRegistrationStatus (default: derived from the served registrations). */
  myStatus?: () => string | null;
  /** The statute read's HTTP status (default 200). */
  statuteStatus?: () => number;
};

async function setup(page: Page, s: Setup) {
  const id = s.competition.documentId;
  const writes: Write[] = [];
  const reads: { path: string; at: number }[] = [];
  let release: () => void = () => {};
  const held = s.holdCompetition ? new Promise<void>(r => (release = r)) : Promise.resolve();
  await page.route(at(`/feed/competitions/${id}`), async route => {
    reads.push({ path: 'competition', at: Date.now() });
    await held;
    await json(route, { data: s.serve?.() ?? s.competition });
  });
  await page.route(at(`/feed/competitions/${id}/my-status`), route => {
    const mine = s.competition.registrations.find(r => r.participants.some(p => p.documentId === qa.documentId));
    return json(route, {
      data: {
        isFollowing: false,
        userRegistrationStatus: s.myStatus ? s.myStatus() : (mine?.registrationStatus ?? null),
      },
    });
  });
  await page.route(at(`/user/profile/competition/${id}/statute`), route => {
    const code = s.statuteStatus?.() ?? 200;
    if (code !== 200) return json(route, { error: { status: code, message: 'x' } }, code);
    return json(route, { userRole: s.statute ?? null });
  });
  if (s.profile) {
    const profile = { ...qa, ...s.profile };
    await page.route(at('/user/profile'), route => json(route, profile));
  }
  await page.route(at('/user/all'), async route => {
    const url = new URL(route.request().url());
    const search = url.searchParams.get('search') ?? '';
    const n = Number(url.searchParams.get('page') ?? '1');
    if (s.users) return s.users(search, n, route);
    if (search)
      return json(
        route,
        userPage(
          1,
          1,
          users(0, 20).filter(u => u.username.toLowerCase().includes(search.toLowerCase())),
        ),
      );
    return json(route, n === 1 ? userPage(1, 2, users(0, 20)) : userPage(2, 2, users(20, 3)));
  });
  // Every registration write is answered here: nothing reaches the CMS.
  await page.route(
    url => /\/api(\/cms)?\/registrations(\/|$)/.test(url.pathname),
    async route => {
      const req = route.request();
      const url = new URL(req.url());
      const w: Write = {
        method: req.method(),
        path: url.pathname.replace(/^\/api(\/cms)?/, ''),
        body: req.postDataJSON?.() ?? null,
        at: Date.now(),
      };
      writes.push(w);
      if (s.write) return s.write(w, route);
      if (w.method === 'PATCH')
        return route.fulfill({
          status: 204,
          headers: { 'access-control-allow-origin': '*' },
        });
      return json(route, { data: { id: 7999, documentId: 'reg-e2e-new' } });
    },
  );
  return { writes, reads, release };
}

const formPath = (id: string, q = '') => `/concursuri/${id}/inscriere${q}`;

async function go(page: Page, path: string, viewport = PHONE) {
  await page.setViewportSize(viewport);
  await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await expect(page.getByRole('heading', { level: 1, name: 'Înscriere' })).toBeVisible({ timeout: 60_000 });
}

async function ready(page: Page) {
  await expect(page.getByTestId('registration-skeleton')).toHaveCount(0, {
    timeout: 60_000,
  });
  await expect(visible(page.getByTestId('registration-submit')).or(visible(page.getByTestId('registration-locked')))).toBeVisible({
    timeout: 30_000,
  });
}

const visible = (l: ReturnType<Page['getByTestId']>) => l.locator('visible=true').first();
const submit = (page: Page) => visible(page.getByTestId('registration-submit'));
const status = (page: Page) => page.getByTestId('registration-status');

/** Analytics events the page dispatches (lib/analytics.ts → «bluvi:analytics»). */
async function watchAnalytics(page: Page) {
  await page.addInitScript(() => {
    const list: unknown[] = [];
    (window as unknown as { __events: unknown[] }).__events = list;
    window.addEventListener('bluvi:analytics', e => list.push((e as CustomEvent).detail));
  });
  return () =>
    page.evaluate(
      () =>
        (
          window as unknown as {
            __events: { name: string; params: Record<string, unknown> }[];
          }
        ).__events,
    );
}

/**
 * axe after every running transition has ended: a dialog fades in (opacity), and a scan mid-fade
 * reads blended colours as low contrast. Infinite animations (the busy spinner) are not waited for.
 */
async function expectNoA11yViolations(page: Page) {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter(a => a.effect?.getComputedTiming().iterations !== Infinity)
        .map(a => a.finished.catch(() => {})),
    ),
  );
  await scan(page);
}

function consoleErrors(page: Page) {
  // The mocked failures (a 400 / 500 the page answers with its own state) are logged by the browser.
  return collectConsoleErrors(page, {
    ignore: /Failed to load resource|ERR_|net::|status of (400|404|500)/,
  });
}

/* ============================================================================================== */
/* Signed out (c2) and loading (c1)                                                               */
/* ============================================================================================== */

test('participant.register.c2 participant.b.register-entry — no session cookie: 307 to /intra?next= with the mode kept', async ({
  request,
}) => {
  for (const path of [formPath('abc'), formPath('abc', '?organizator=1&inscriere=r1')]) {
    const res = await request.get(`${BASE}${path}`, { maxRedirects: 0 });
    expect(res.status()).toBe(307);
    expect(res.headers().location).toBe(`/intra?next=${encodeURIComponent(path)}`);
  }
});

test('participant.register.c2 — a dead session cookie: fish’s gate, «Intră în cont» back to this page', async ({ page, context }) => {
  const errors = consoleErrors(page);
  await signIn(context, 'not-a-valid-jwt');
  const path = formPath(base.documentId, '?organizator=1&inscriere=r1');
  for (const vp of [PHONE, LAPTOP]) {
    await go(page, path, vp);
    const gate = page.getByTestId('registration-signed-out');
    await expect(gate.getByRole('heading', { name: 'Înscrie-te la competiție' })).toBeVisible();
    await expect(
      gate.getByText(
        'Autentifică-te pentru a putea participa la competiție. După ce te conectezi, revino aici pentru a-ți finaliza înscrierea.',
      ),
    ).toBeVisible();
    await expect(gate.locator('svg')).toBeVisible();
    await expect(gate.getByRole('link', { name: 'Intră în cont' })).toHaveAttribute('href', `/intra?next=${encodeURIComponent(path)}`);
    await expect(page.getByTestId('registration-submit')).toHaveCount(0);
    await expectNoA11yViolations(page);
  }
  expect(errors).toEqual([]);
});

test('participant.register.c1 — while the competition loads: the page skeleton, then the form', async ({ page, context }) => {
  await signIn(context, jwt);
  const c = fixture('fx-loading');
  const { release } = await setup(page, {
    competition: c,
    holdCompetition: true,
  });
  await go(page, formPath(c.documentId));
  await expect(page.getByTestId('registration-skeleton').first()).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Se încarcă înscrierea…' })).toBeAttached();
  await expect(page.getByTestId('registration-username')).toHaveCount(0);
  await expectNoA11yViolations(page);
  release();
  await ready(page);
  await expect(page.getByTestId('registration-username')).toHaveValue(qa.username);
});

/* ============================================================================================== */
/* New registration                                                                               */
/* ============================================================================================== */

test('participant.register.c3 participant.register.c4 participant.register.c5 participant.register.c12 participant.register.c14 participant.register.c15 participant.register.c16 — new, single, phone on the profile: POST with phone null, status dialog, back to the competition', async ({
  page,
  context,
}) => {
  const errors = consoleErrors(page);
  const events = await watchAnalytics(page);
  await signIn(context, jwt);
  const c = fixture('fx-single', {
    // c3: a cancelled / rejected entry of the viewer is not «theirs»; someone else's pending one neither.
    registrations: [
      regOf({ documentId: 'r-cancelled', registrationStatus: 'cancelled' }),
      regOf({
        documentId: 'r-other',
        author: { id: 2, documentId: 'x', username: 'X' },
        participants: [person('x', 'X')],
      }),
    ],
  });
  let answer: () => void = () => {};
  const answered = new Promise<void>(r => (answer = r));
  const { writes, reads } = await setup(page, {
    competition: c,
    profile: { phone: '0712345678' },
    write: async (_w, route) => {
      await answered;
      await json(route, { data: { id: 7999, documentId: 'reg-e2e-new' } });
    },
  });
  await go(page, formPath(c.documentId));
  await ready(page);
  // c4 — the username, read-only; c5 — the phone from the profile, read-only.
  await expect(page.getByLabel('Nume utilizator*')).toHaveValue(qa.username);
  await expect(page.getByLabel('Nume utilizator*')).toHaveAttribute('readonly', '');
  const phone = page.getByLabel('Număr de telefon*');
  await expect(phone).toHaveValue('0712345678');
  await expect(phone).toHaveAttribute('readonly', '');
  // Read-only fields do not look editable: no fill, a hairline and a lock.
  for (const field of [page.getByLabel('Nume utilizator*'), phone]) {
    const shell = field.locator('..');
    await expect(shell).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await expect(shell.locator('svg')).toHaveCount(1);
  }
  // single: no team block; c12 — «Finalizează».
  await expect(page.getByLabel('Numele echipei')).toHaveCount(0);
  await expect(page.getByTestId('add-teammates')).toHaveCount(0);
  await expect(submit(page)).toHaveText('Finalizează');
  await expect(page.getByTestId('registration-leave')).toHaveCount(0);
  await expectNoA11yViolations(page);

  // Keyboard: the form's controls in order, then the CTA submits.
  await page.getByLabel('Nume utilizator*').focus();
  await page.keyboard.press('Tab');
  await expect(phone).toBeFocused();
  await submit(page).focus();
  await page.keyboard.press('Enter');

  // c16 — pending: «Înscriere în curs...», not dismissable.
  await expect(status(page)).toHaveAttribute('data-phase', 'pending');
  await expect(status(page)).toContainText('Înscriere în curs...');
  await page.keyboard.press('Escape');
  await expect(status(page)).toBeVisible();
  await expectNoA11yViolations(page);
  const readsBefore = reads.length;
  answer();
  // c14 — POST /registrations, the viewer last, phone null (the profile has one).
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0]).toMatchObject({
    method: 'POST',
    path: '/registrations',
    body: {
      data: {
        competition: c.documentId,
        teamName: '',
        registrationStatus: '',
        participants: [qa.documentId],
        phone: null,
      },
    },
  });
  // c16 — success copy; c15 — analytics, the competition re-read.
  await expect(status(page)).toHaveAttribute('data-phase', 'success');
  for (const line of [
    'Felicitări!',
    'Solicitarea ta a fost înregistrată cu succes.',
    'Vei fi contactat în cel mai scurt timp pentru confirmarea locului.',
  ]) {
    await expect(status(page)).toContainText(line);
  }
  expect(await events()).toContainEqual({
    name: 'competition_registration_created',
    params: { competition_id: c.documentId, participants: 1 },
  });
  await expect.poll(() => reads.length).toBeGreaterThan(readsBefore);
  // c16 — closes itself after 3 s and returns to the competition.
  const t0 = Date.now();
  await page.waitForURL(`${BASE}/concursuri/${c.documentId}`, {
    timeout: 15_000,
  });
  expect(Date.now() - t0).toBeGreaterThan(1500);
  expect(errors).toEqual([]);
});

test('participant.register.c5 — phone missing on the profile: required, 7–15 characters, sent with the POST', async ({ page, context }) => {
  await signIn(context, jwt);
  const c = fixture('fx-phone');
  const { writes } = await setup(page, {
    competition: c,
    profile: { phone: null },
  });
  await go(page, formPath(c.documentId), TABLET);
  await ready(page);
  const phone = page.getByLabel('Număr de telefon*');
  await expect(phone).toHaveValue('');
  await expect(phone).not.toHaveAttribute('readonly', '');
  await submit(page).click();
  await expect(page.getByText('Acest câmp este obligatoriu').first()).toBeVisible();
  // The error summary takes focus and links to the field.
  await expect(page.getByRole('group', { name: 'Un câmp trebuie corectat' })).toBeFocused();
  await expect(phone).toHaveAttribute('aria-invalid', 'true');
  await expectNoA11yViolations(page);
  await phone.fill('123456');
  await expect(page.getByText('Numărul de telefon trebuie să conțină minim 7 și maximum 15 caractere').first()).toBeVisible();
  await phone.fill('1'.repeat(16));
  await expect(page.getByText('Numărul de telefon trebuie să conțină minim 7 și maximum 15 caractere').first()).toBeVisible();
  expect(writes).toHaveLength(0);
  await phone.fill('0712345678');
  await submit(page).click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0].body).toMatchObject({
    data: { phone: '0712345678', participants: [qa.documentId] },
  });
  await expect(status(page)).toHaveAttribute('data-phase', 'success');
});

test('participant.register.c6 participant.register.c7 participant.register.c8 participant.register.c9 participant.register.c10 participant.register.c13 participant.register.c14 — new team: name, the picker and its states, max size, zero-teammates confirm, POST', async ({
  page,
  context,
}) => {
  const errors = consoleErrors(page);
  await signIn(context, jwt);
  const c = fixture('fx-team', {
    competitionType: 'team',
    teamParticipants: 3,
  });
  let mode: 'hold' | 'ok' = 'hold';
  let holdRelease: () => void = () => {};
  const hold = new Promise<void>(r => (holdRelease = r));
  let page2Release: () => void = () => {};
  const page2 = new Promise<void>(r => (page2Release = r));
  const { writes } = await setup(page, {
    competition: c,
    users: async (search, n, route) => {
      if (mode === 'hold') await hold;
      if (search === 'eroare') return json(route, { error: { status: 400, message: 'x' } }, 400);
      if (search === 'nimeni') return json(route, userPage(1, 1, []));
      if (n === 2) {
        await page2;
        return json(route, userPage(2, 2, users(20, 3)));
      }
      return json(route, userPage(1, 2, users(0, 20)));
    },
  });
  await go(page, formPath(c.documentId));
  await ready(page);

  // c6 — the team name: optional, helper, at most 30 (on submit).
  const teamName = page.getByLabel('Numele echipei');
  await expect(teamName).toHaveAttribute('placeholder', 'Introdu numele echipei');
  await expect(page.getByText('Numele echipei este opțional și poate fi adăugat ulterior')).toBeVisible();
  // c7 — «Coechipieri» and the caption with the team size.
  await expect(page.getByRole('heading', { name: 'Coechipieri' })).toBeVisible();
  await expect(
    page.getByText(
      'Această competiție permite înscrierea unui număr maxim de 3 participanți/echipă. Vă rugăm să adăugați un număr maxim de 2 coechipieri.',
    ),
  ).toBeVisible();

  // c9 — the picker: loading, then rows (avatar, name, #tag), keyboard in and out.
  const add = page.getByTestId('add-teammates');
  await add.focus();
  await page.keyboard.press('Enter');
  const picker = page.getByTestId('teammate-picker');
  await expect(picker.getByRole('status').filter({ hasText: 'Se încarcă...' })).toBeVisible();
  const search = picker.getByPlaceholder('Introdu numele');
  await expect(search).toBeVisible();
  await expectNoA11yViolations(page);
  mode = 'ok';
  holdRelease();
  const options = page.getByTestId('teammate-options').getByRole('button');
  await expect(options).toHaveCount(20);
  await expect(options.first()).toContainText('Pescar 0');
  await expect(options.first()).toContainText('#Pescar 05000');
  // Next page: «Se încarcă...» at the end while it loads.
  await options.last().scrollIntoViewIfNeeded();
  await expect(picker.getByText('Se încarcă...')).toBeVisible();
  page2Release();
  await expect(options).toHaveCount(23);
  await expectNoA11yViolations(page);
  // Pick with the keyboard: closes, the teammate is listed (c10).
  await options.first().focus();
  await page.keyboard.press('Enter');
  await expect(picker).toHaveCount(0);
  const chosen = page.getByTestId('teammates').getByRole('listitem');
  await expect(chosen).toHaveText(['Pescar 0']);
  // Reopen: the chosen one is disabled and dimmed; closing clears the search.
  await add.click();
  await expect(options.first()).toBeDisabled();
  await expect(options.first()).toHaveAccessibleName('Pescar 0, adăugat deja');
  await search.fill('nimeni');
  await expect(picker.getByText('Nu s-au găsit rezultate')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(picker).toHaveCount(0);
  await add.click();
  await expect(picker.getByPlaceholder('Introdu numele')).toHaveValue('');
  await expect(options.nth(1)).toBeEnabled();
  await options.nth(1).click();
  await expect(chosen).toHaveText(['Pescar 0', 'Pescar 1']);
  // c8 — 2 teammates + the viewer = 3: «Adaugă coechipieri» disabled.
  await expect(add).toBeDisabled();
  await expectNoA11yViolations(page);

  // The picker's error state (a search the CMS refuses).
  await chosen.nth(1).getByRole('button', { name: 'Elimină pe Pescar 1' }).click();
  await expect(add).toBeEnabled();
  await add.click();
  await picker.getByPlaceholder('Introdu numele').fill('eroare');
  await expect(picker.getByRole('alert').filter({ hasText: 'Eroare la încărcarea datelor' })).toBeVisible();
  await expectNoA11yViolations(page);
  await page.keyboard.press('Escape');

  // c6 — 31 characters refused on submit.
  await teamName.fill('x'.repeat(31));
  await submit(page).click();
  await expect(page.getByText('Numele echipei poate conține maximum 30 de caractere.').first()).toBeVisible();
  expect(writes).toHaveLength(0);
  await teamName.fill('Crapii de Snagov');

  // c13 — zero teammates: the non-dismissable question; «Închide» cancels, «Sunt sigur» submits.
  await chosen.first().getByRole('button', { name: 'Elimină pe Pescar 0' }).click();
  await expect(chosen).toHaveCount(0);
  await submit(page).click();
  const confirm = page.getByRole('alertdialog', {
    name: 'Echipă fără coechipieri',
  });
  await expect(confirm).toBeVisible();
  await expect(confirm).toContainText('Nu ați adăugat niciun coechipier. Sunteți sigur că doriți să înregistrați echipa fără coechipieri?');
  await page.keyboard.press('Escape');
  await expect(confirm).toBeVisible();
  await expectNoA11yViolations(page);
  await confirm.getByRole('button', { name: 'Închide' }).click();
  await expect(confirm).toBeHidden();
  expect(writes).toHaveLength(0);
  // With a teammate back, the POST lists them before the viewer.
  await add.click();
  await options.nth(2).click();
  await submit(page).click();
  await expect(confirm).toBeHidden();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0]).toMatchObject({
    method: 'POST',
    path: '/registrations',
    body: {
      data: {
        competition: c.documentId,
        teamName: 'Crapii de Snagov',
        participants: ['u-e2e-2', qa.documentId],
      },
    },
  });
  expect(errors).toEqual([]);
});

test('participant.register.c13 — «Sunt sigur» continues the submit with the viewer alone', async ({ page, context }) => {
  await signIn(context, jwt);
  const c = fixture('fx-team-empty', {
    competitionType: 'team',
    teamParticipants: 2,
  });
  const { writes } = await setup(page, { competition: c });
  await go(page, formPath(c.documentId), LAPTOP);
  await ready(page);
  await submit(page).click();
  const confirm = page.getByRole('alertdialog', {
    name: 'Echipă fără coechipieri',
  });
  await confirm.getByRole('button', { name: 'Sunt sigur' }).click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0].body).toMatchObject({
    data: { participants: [qa.documentId], teamName: '' },
  });
});

test('participant.register.c16 — create refused: the server’s message and «Închide» back to the form', async ({ page, context }) => {
  await signIn(context, jwt);
  const c = fixture('fx-create-error');
  await setup(page, {
    competition: c,
    write: (_w, route) =>
      json(
        route,
        {
          error: {
            status: 400,
            message: 'Numarul maxim de participanti a fost atins.',
            details: { bluCode: 'REGISTRATION:PARTICIPANTS_LIMIT_EXCEEDED' },
          },
        },
        400,
      ),
  });
  await go(page, formPath(c.documentId), WIDE);
  await ready(page);
  await submit(page).click();
  await expect(status(page)).toHaveAttribute('data-phase', 'error');
  await expect(status(page).getByRole('alert')).toHaveText('Numarul maxim de participanti a fost atins.');
  await expectNoA11yViolations(page);
  await page.getByRole('alertdialog').getByRole('button', { name: 'Închide' }).click();
  await expect(status(page)).toBeHidden();
  await expect(submit(page)).toBeEnabled();
  await expect(page).toHaveURL(`${BASE}${formPath(c.documentId)}`);
});

/* ============================================================================================== */
/* Existing registration                                                                          */
/* ============================================================================================== */

const pendingTeam = (id: string, over: Partial<CompetitionDetail> = {}, reg: Partial<Reg> = {}) =>
  fixture(id, {
    competitionType: 'team',
    teamParticipants: 3,
    registrations: [
      regOf({
        documentId: 'r-mine',
        teamName: 'Echipa veche',
        participants: [person(qa.documentId, qa.username, qa.id), person('mate-1', 'Coleg Unu', 901)],
        ...reg,
      }),
    ],
    ...over,
  });

test('participant.register.c3 participant.register.c11 participant.register.c12 participant.register.c17 participant.register.c18 — pending team: seeded, save only when changed, PUT, refetch after the purge', async ({
  page,
  context,
}) => {
  const errors = consoleErrors(page);
  const events = await watchAnalytics(page);
  await signIn(context, jwt);
  const c = pendingTeam('fx-pending');
  const { writes, reads } = await setup(page, { competition: c });
  await go(page, formPath(c.documentId), LAPTOP);
  await ready(page);
  // c11 — seeded: teammates minus the viewer, the team name; no phone field on an existing entry (c5).
  await expect(page.getByLabel('Numele echipei')).toHaveValue('Echipa veche');
  await expect(page.getByTestId('teammates').getByRole('listitem')).toHaveText(['Coleg Unu']);
  await expect(page.getByLabel('Număr de telefon*')).toHaveCount(0);
  // c12 — «Salvează modificările» disabled until a change, «Părăsește concursul» for a pending entry.
  await expect(submit(page)).toHaveText('Salvează modificările');
  await expect(submit(page)).toBeDisabled();
  await expect(visible(page.getByTestId('registration-leave'))).toHaveText('Părăsește concursul');
  await expect(page.getByTestId('registration-summary')).toContainText('Echipe · max 3/echipă');
  await expectNoA11yViolations(page);
  await page.getByLabel('Numele echipei').fill('Echipa nouă');
  await expect(submit(page)).toBeEnabled();
  await submit(page).click();
  await expect(status(page)).toContainText(/Modificare în curs...|Felicitări!/);
  // c17 — PUT /registrations/{id}: teammates, then the viewer.
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0]).toMatchObject({
    method: 'PUT',
    path: '/registrations/r-mine',
    body: {
      data: {
        competition: c.documentId,
        participants: ['mate-1', qa.documentId],
        teamName: 'Echipa nouă',
      },
    },
  });
  // c18 — «Felicitări!» / the update copy; analytics; the competition re-read ~2 s after the write.
  await expect(status(page)).toHaveAttribute('data-phase', 'success');
  await expect(status(page)).toContainText('Înregistrarea ta a fost modificată cu succes.');
  expect(await events()).toContainEqual({
    name: 'competition_registration_updated',
    params: { competition_id: c.documentId, participants: 2 },
  });
  const after = writes[0].at;
  await expect.poll(() => reads.filter(r => r.at > after).length, { timeout: 10_000 }).toBeGreaterThan(0);
  expect(reads.find(r => r.at > after)!.at - after).toBeGreaterThan(1500);
  await page.waitForURL(`${BASE}/concursuri/${c.documentId}`, {
    timeout: 15_000,
  });
  expect(errors).toEqual([]);
});

test('participant.register.c11 — re-seeded from fresher server data while untouched, kept once edited', async ({ page, context }) => {
  await signIn(context, jwt);
  let served = pendingTeam('fx-reseed');
  const { reads } = await setup(page, {
    competition: served,
    serve: () => served,
    // A refused leave: its onSettled invalidates the competitions, so the competition is read again.
    write: (_w, route) =>
      json(
        route,
        {
          error: {
            status: 400,
            message: 'Nu mai poți modifica cererea.',
            details: { bluCode: 'REGISTRATION:NOT_PENDING' },
          },
        },
        400,
      ),
  });
  await go(page, formPath(served.documentId), PHONE);
  await ready(page);
  const teamName = page.getByLabel('Numele echipei');
  const refetch = async () => {
    const before = reads.length;
    await visible(page.getByTestId('registration-leave')).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Părăsește concursul' }).click();
    await expect(page.getByText('Nu mai poți modifica cererea.').first()).toBeVisible();
    await expect.poll(() => reads.length).toBeGreaterThan(before);
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
  };
  await expect(teamName).toHaveValue('Echipa veche');
  // Untouched: the server's newer copy (another device saved) replaces the seed.
  served = pendingTeam(
    'fx-reseed',
    {},
    {
      teamName: 'Din server',
      participants: [person(qa.documentId, qa.username, qa.id), person('mate-2', 'Coleg Doi', 902)],
    },
  );
  await refetch();
  await expect(teamName).toHaveValue('Din server');
  await expect(page.getByTestId('teammates').getByRole('listitem')).toHaveText(['Coleg Doi']);
  await expect(submit(page)).toBeDisabled();
  // Edited: the user's values stay.
  await teamName.fill('A mea');
  served = pendingTeam('fx-reseed', {}, { teamName: 'Iar din server' });
  await refetch();
  await expect(teamName).toHaveValue('A mea');
});

test('participant.register.c12 — approved team, notStarted: save, no leave; after the start: only the text', async ({ page, context }) => {
  await signIn(context, jwt);
  const approved = pendingTeam('fx-approved', {}, { registrationStatus: 'registered' });
  await setup(page, { competition: approved });
  await go(page, formPath(approved.documentId));
  await ready(page);
  await expect(submit(page)).toHaveText('Salvează modificările');
  await expect(page.getByTestId('registration-leave')).toHaveCount(0);

  const started = pendingTeam('fx-started', { competitionStatus: 'started' }, { registrationStatus: 'registered' });
  await setup(page, { competition: started });
  for (const vp of [PHONE, LAPTOP]) {
    await go(page, formPath(started.documentId), vp);
    await ready(page);
    await expect(visible(page.getByTestId('registration-locked'))).toHaveText('Nu poți face modificări. Contactează organizatorul.');
    await expect(page.getByTestId('registration-submit')).toHaveCount(0);
    await expect(page.getByTestId('registration-leave')).toHaveCount(0);
    // Read-only throughout: no add button, no team-name helper, no limit caption; the team as rows.
    await expect(page.getByTestId('add-teammates')).toHaveCount(0);
    await expect(page.getByText('Numele echipei este opțional și poate fi adăugat ulterior')).toHaveCount(0);
    await expect(page.getByText(/Vă rugăm să adăugați un număr maxim/)).toHaveCount(0);
    await expect(page.getByLabel('Numele echipei')).toHaveAttribute('readonly', '');
    await expect(page.getByTestId('teammates').getByRole('listitem')).toHaveText(['Coleg Unu']);
    await expect(page.getByTestId('teammates').getByRole('button')).toHaveCount(0);
    await expectNoA11yViolations(page);
  }
});

test('participant.register.c19 — leave: the question, PATCH …/leave, «Ai părăsit competiția.», back to the competition; a refusal is a toast', async ({
  page,
  context,
}) => {
  const errors = consoleErrors(page);
  await signIn(context, jwt);
  const c = fixture('fx-leave', {
    registrations: [regOf({ documentId: 'r-leave' })],
  });
  let refuse = true;
  const { writes } = await setup(page, {
    competition: c,
    write: (w, route) =>
      refuse
        ? json(
            route,
            {
              error: {
                status: 400,
                message: 'Termenul de înregistrare a expirat.',
                details: {
                  bluCode: 'REGISTRATION:REGISTRATION_DEADLINE_EXPIRED',
                },
              },
            },
            400,
          )
        : route.fulfill({
            status: 204,
            headers: { 'access-control-allow-origin': '*' },
          }),
  });
  await go(page, formPath(c.documentId));
  await ready(page);
  const leave = visible(page.getByTestId('registration-leave'));
  await leave.click();
  const ask = page.getByRole('alertdialog', {
    name: 'Ești sigur că dorești să părăsești concursul?',
  });
  await expect(ask).toBeVisible();
  await expectNoA11yViolations(page);
  await ask.getByRole('button', { name: 'Închide' }).click();
  await expect(ask).toBeHidden();
  expect(writes).toHaveLength(0);
  // Refused: the message as a toast, the page stays.
  await leave.click();
  await ask.getByRole('button', { name: 'Părăsește concursul' }).click();
  await expect(page.getByText('Termenul de înregistrare a expirat.')).toBeVisible();
  expect(writes[0]).toMatchObject({
    method: 'PATCH',
    path: '/registrations/r-leave/leave',
  });
  await expect(page).toHaveURL(`${BASE}${formPath(c.documentId)}`);
  // Accepted.
  refuse = false;
  await leave.click();
  await ask.getByRole('button', { name: 'Părăsește concursul' }).click();
  await expect(status(page)).toContainText('Ai părăsit competiția.');
  await page.waitForURL(`${BASE}/concursuri/${c.documentId}`, {
    timeout: 15_000,
  });
  expect(writes).toHaveLength(2);
  expect(errors).toEqual([]);
});

test('participant.register.c3 participant.register.c4 participant.register.c17 participant.register.c21 — organizer mode: another team’s entry, the author’s name, save after the start, never leave', async ({
  page,
  context,
}) => {
  await signIn(context, jwt);
  const captain = person('cap-1', 'Căpitan Echipă', 950);
  const c = fixture('fx-organizer', {
    competitionType: 'team',
    teamParticipants: 4,
    competitionStatus: 'started',
    author: {
      id: qa.id,
      documentId: qa.documentId,
      username: qa.username,
      phone: null,
    },
    registrations: [
      regOf({
        documentId: 'r-team',
        registrationStatus: 'registered',
        teamName: 'Somnii',
        author: {
          id: captain.id,
          documentId: captain.documentId,
          username: captain.username,
        },
        participants: [captain, person('m-1', 'Membru Unu', 951)],
      }),
    ],
  });
  const { writes } = await setup(page, { competition: c, statute: 'author' });
  await go(page, formPath(c.documentId, '?organizator=1&inscriere=r-team'), LAPTOP);
  await ready(page);
  await expect(page.getByLabel('Nume utilizator*')).toHaveValue('Căpitan Echipă');
  await expect(page.getByTestId('teammates').getByRole('listitem')).toHaveText(['Membru Unu']);
  await expect(page.getByTestId('registration-leave')).toHaveCount(0);
  await expect(page.getByTestId('registration-locked')).toHaveCount(0);
  await expectNoA11yViolations(page);
  await page.getByLabel('Numele echipei').fill('Somnii 2');
  await submit(page).click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0]).toMatchObject({
    method: 'PUT',
    path: '/registrations/r-team',
    body: {
      data: {
        competition: c.documentId,
        participants: ['m-1', 'cap-1'],
        teamName: 'Somnii 2',
      },
    },
  });
  await expect(status(page)).toHaveAttribute('data-phase', 'success');
});

test('participant.register.c3 — ?organizator=1 from someone who does not author the competition: their own (new) registration', async ({
  page,
  context,
}) => {
  await signIn(context, jwt);
  const c = fixture('fx-not-organizer', {
    registrations: [
      regOf({
        documentId: 'r-x',
        author: { id: 3, documentId: 'y', username: 'Y' },
        participants: [person('y', 'Y')],
      }),
    ],
  });
  await setup(page, { competition: c, statute: 'participant' });
  await go(page, formPath(c.documentId, '?organizator=1&inscriere=r-x'));
  await ready(page);
  await expect(page.getByLabel('Nume utilizator*')).toHaveValue(qa.username);
  await expect(submit(page)).toHaveText('Finalizează');
});

test('participant.register.c20 — unsaved changes: back asks first (in-app and on unload); «Renunță» leaves', async ({ page, context }) => {
  await signIn(context, jwt);
  const c = pendingTeam('fx-dirty');
  await setup(page, { competition: c });
  await go(page, formPath(c.documentId), LAPTOP);
  await ready(page);
  await page.getByLabel('Numele echipei').fill('Altă echipă');
  await page.getByRole('link', { name: 'Înapoi la concurs' }).click();
  const guard = page.getByRole('alertdialog', {
    name: 'Renunți la modificări?',
  });
  await expect(guard).toBeVisible();
  await expectNoA11yViolations(page);
  await guard.getByRole('button', { name: 'Continuă editarea' }).click();
  await expect(page.getByLabel('Numele echipei')).toHaveValue('Altă echipă');
  // The browser's own prompt on unload.
  const prompt = new Promise<string>(resolve => page.once('dialog', d => (resolve(d.type()), void d.dismiss())));
  await page.close({ runBeforeUnload: true });
  expect(await prompt).toBe('beforeunload');
});

test('participant.register.c20 — «Renunță» follows the back control', async ({ page, context }) => {
  await signIn(context, jwt);
  const c = pendingTeam('fx-dirty-2');
  await setup(page, { competition: c });
  await go(page, formPath(c.documentId));
  await ready(page);
  await page.getByLabel('Numele echipei').fill('Altă echipă');
  await page.getByRole('link', { name: 'Înapoi la concurs' }).click();
  await page.getByRole('alertdialog', { name: 'Renunți la modificări?' }).getByRole('button', { name: 'Renunță' }).click();
  await page.waitForURL(`${BASE}/concursuri/${c.documentId}`);
});

test('participant.register.c22 — leaving the page drops the user search: back on it, the picker reads again', async ({ page, context }) => {
  await signIn(context, jwt);
  const c = fixture('fx-cache', {
    competitionType: 'team',
    teamParticipants: 3,
  });
  let calls = 0;
  let gate: Promise<void> = Promise.resolve();
  await setup(page, {
    competition: c,
    users: async (_s, _n, route) => {
      calls++;
      await gate;
      return json(route, userPage(1, 1, users(0, 3)));
    },
  });
  await go(page, formPath(c.documentId));
  await ready(page);
  await page.getByTestId('add-teammates').click();
  await expect(page.getByTestId('teammate-options').getByRole('button')).toHaveCount(3);
  await page.keyboard.press('Escape');
  // Leave in-app (the back control → the competition), then come back with the browser's Back.
  await page.getByRole('link', { name: 'Înapoi la concurs' }).click();
  await page.waitForURL(`${BASE}/concursuri/${c.documentId}`);
  let open: () => void = () => {};
  gate = new Promise<void>(r => (open = r));
  await page.goBack();
  await ready(page);
  await page.getByTestId('add-teammates').click();
  // No cached rows: the picker is loading again (a kept cache would show the 3 rows at once).
  await expect(page.getByTestId('teammate-picker').getByRole('status').filter({ hasText: 'Se încarcă...' })).toBeVisible();
  open();
  await expect(page.getByTestId('teammate-options').getByRole('button')).toHaveCount(3);
  expect(calls).toBe(2);
});

/* ============================================================================================== */
/* The entry on the competition page                                                              */
/* ============================================================================================== */

test('competition-page.bara-actiuni.c4 participant.b.register-entry — single (or already registered): «Înscrie-te» opens the form; a new team entry goes through the disclaimer', async ({
  page,
  context,
}) => {
  test.skip(!single, 'no notStarted single competition with open registration (not authored by the QA user) locally');
  await signIn(context, jwt);
  // The viewer has no entry here (my-status null, the real competition otherwise).
  await page.route(at(`/feed/competitions/${single!.documentId}/my-status`), route =>
    json(route, {
      data: { isFollowing: false, userRegistrationStatus: null },
    }),
  );
  await page.setViewportSize(PHONE);
  await page.goto(`/concursuri/${single!.documentId}`, {
    waitUntil: 'domcontentloaded',
    timeout: 120_000,
  });
  const bar = page.getByRole('link', { name: 'Înscrie-te' }).locator('visible=true').first();
  await expect(bar).toHaveAttribute('href', `/concursuri/${single!.documentId}/inscriere`, { timeout: 60_000 });
  await expect(page.getByText('Înscrierea continuă în aplicația Bluvi.')).toHaveCount(0);
  await page.setViewportSize(LAPTOP);
  const header = page.getByRole('link', { name: 'Înscrie-te' }).locator('visible=true').first();
  await expect(header).toHaveAttribute('href', `/concursuri/${single!.documentId}/inscriere`);
  await header.click();
  await page.waitForURL(`${BASE}/concursuri/${single!.documentId}/inscriere`);
  await ready(page);
  await expect(page.getByLabel('Nume utilizator*')).toHaveValue(qa.username);

  const team = await findCompetition({
    status: 'notStarted',
    matches: (c, now) => c.competitionType === 'team' && registrationOpen(c, now) && c.author?.documentId !== qa.documentId,
  });
  test.skip(!team, 'no notStarted team competition with open registration locally');
  for (const [status, href] of [
    [null, `/concursuri/${team!.documentId}/inscriere/echipa`],
    ['pending', `/concursuri/${team!.documentId}/inscriere`],
  ] as const) {
    await page.unroute(at(`/feed/competitions/${team!.documentId}/my-status`));
    await page.route(at(`/feed/competitions/${team!.documentId}/my-status`), route =>
      json(route, {
        data: { isFollowing: false, userRegistrationStatus: status },
      }),
    );
    if (status === 'pending') {
      // A pending entry the viewer authored (so the action stays offered).
      await page.route(at(`/feed/competitions/${team!.documentId}`), route =>
        json(route, {
          data: {
            ...team,
            registrations: [...team!.registrations, regOf({ documentId: 'r-e2e-pending' })],
          },
        }),
      );
    }
    await page.goto(`/concursuri/${team!.documentId}`, {
      waitUntil: 'domcontentloaded',
      timeout: 120_000,
    });
    await expect(
      page
        .getByRole('link', {
          name: status ? 'Modifică înscrierea' : 'Înscrie-te',
        })
        .locator('visible=true')
        .first(),
    ).toHaveAttribute('href', href, {
      timeout: 60_000,
    });
  }
});

test('participant.b.register-entry-disabled — rejected: «Înscrie-te» disabled with fish’s reason, no link to the form', async ({
  page,
  context,
}) => {
  test.skip(!single, 'no notStarted single competition with open registration locally');
  await signIn(context, jwt);
  await page.route(at(`/feed/competitions/${single!.documentId}/my-status`), route =>
    json(route, {
      data: { isFollowing: false, userRegistrationStatus: 'rejected' },
    }),
  );
  await page.setViewportSize(PHONE);
  await page.goto(`/concursuri/${single!.documentId}`, {
    waitUntil: 'domcontentloaded',
    timeout: 120_000,
  });
  await expect(
    page.getByText('Cererea ta de a te înscrie în această competiție a fost respinsă.').locator('visible=true').first(),
  ).toBeVisible({ timeout: 60_000 });
  await expect(page.locator(`a[href^="/concursuri/${single!.documentId}/inscriere"]`)).toHaveCount(0);
});

/* ============================================================================================== */
/* Review fixes: statute failure, stale edge copy, direct URL in a disabled state, the anchor      */
/* ============================================================================================== */

test('participant.register.c3 — organizer link, the statute read fails: the error state with a retry, never the organizer’s own new form', async ({
  page,
  context,
}) => {
  await signIn(context, jwt);
  const captain = person('cap-2', 'Căpitan Doi', 960);
  const c = fixture('fx-statute-500', {
    competitionType: 'team',
    teamParticipants: 3,
    author: { id: qa.id, documentId: qa.documentId, username: qa.username, phone: null },
    registrations: [
      regOf({
        documentId: 'r-cap',
        author: { id: captain.id, documentId: captain.documentId, username: captain.username },
        participants: [captain],
      }),
    ],
  });
  let code = 500;
  const { writes } = await setup(page, { competition: c, statute: 'author', statuteStatus: () => code });
  await go(page, formPath(c.documentId, '?organizator=1&inscriere=r-cap'), LAPTOP);
  const retry = page.getByTestId('registration-retry');
  await expect(retry).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText('A apărut o eroare, te rugăm să încerci mai târziu')).toBeVisible();
  await expect(page.getByTestId('registration-submit')).toHaveCount(0);
  await expect(page.getByText('Finalizează')).toHaveCount(0);
  await expectNoA11yViolations(page);
  // The retry reads the statute again: now the organizer mode.
  code = 200;
  await retry.click();
  await ready(page);
  await expect(page.getByTestId('organizer-mode')).toBeVisible();
  await expect(page.getByLabel('Nume utilizator*')).toHaveValue('Căpitan Doi');
  expect(writes).toHaveLength(0);
});

test('participant.register.c3 — the edge copy predates the write (my-status pending, no entry yet): the skeleton until it does, never a new form', async ({
  page,
  context,
}) => {
  await signIn(context, jwt);
  const before = fixture('fx-stale-create', { registrations: [] });
  const after = fixture('fx-stale-create', { registrations: [regOf({ documentId: 'r-new' })] });
  let served = before;
  const { reads } = await setup(page, { competition: before, serve: () => served, myStatus: () => 'pending' });
  await go(page, formPath(before.documentId));
  await expect(page.getByTestId('registration-skeleton').first()).toBeVisible();
  await expect.poll(() => reads.length, { timeout: 15_000 }).toBeGreaterThan(1);
  await expect(page.getByTestId('registration-submit')).toHaveCount(0);
  served = after;
  await ready(page);
  await expect(submit(page)).toHaveText('Salvează modificările');
  await expect(visible(page.getByTestId('registration-leave'))).toBeVisible();
});

test('participant.register.c3 — the edge copy predates a leave (my-status empty, the entry still listed): the skeleton, then the new form', async ({
  page,
  context,
}) => {
  await signIn(context, jwt);
  const before = fixture('fx-stale-leave', { registrations: [regOf({ documentId: 'r-left' })] });
  let served = before;
  await setup(page, { competition: before, serve: () => served, myStatus: () => null });
  await go(page, formPath(before.documentId));
  await expect(page.getByTestId('registration-skeleton').first()).toBeVisible();
  await expect(page.getByTestId('registration-leave')).toHaveCount(0);
  served = fixture('fx-stale-leave', { registrations: [] });
  await ready(page);
  await expect(submit(page)).toHaveText('Finalizează');
  await expect(page.getByTestId('registration-leave')).toHaveCount(0);
});

test('participant.b.register-entry-disabled — the form’s URL opened directly: rejected, non-author of a pending team, deadline passed → a gate with fish’s reason', async ({
  page,
  context,
}) => {
  await signIn(context, jwt);
  const gate = page.getByTestId('registration-unavailable');
  const cases: { c: CompetitionDetail; myStatus?: string; reason: string }[] = [
    {
      c: fixture('fx-rejected', {
        registrations: [regOf({ documentId: 'r-rej', registrationStatus: 'rejected' })],
      }),
      myStatus: 'rejected',
      reason: 'Cererea ta de a te înscrie în această competiție a fost respinsă.',
    },
    {
      c: pendingTeam('fx-not-author', {}, {
        author: { id: 3, documentId: 'cap-3', username: 'Alt Căpitan' },
        participants: [person('cap-3', 'Alt Căpitan', 903), person(qa.documentId, qa.username, qa.id)],
      }),
      reason: 'Nu poți face modificări pentru că nu ești autorul înscrierii.',
    },
    {
      c: fixture('fx-deadline', { registrationDeadline: new Date(Date.now() - 3_600_000).toISOString() }),
      reason: 'Termenul pentru înscriere a expirat',
    },
  ];
  for (const { c, myStatus, reason } of cases) {
    const { writes } = await setup(page, { competition: c, ...(myStatus ? { myStatus: () => myStatus } : {}) });
    await go(page, formPath(c.documentId));
    await expect(gate).toBeVisible({ timeout: 60_000 });
    await expect(gate).toContainText(reason);
    await expect(gate.getByRole('link', { name: 'Înapoi la concurs' })).toHaveAttribute('href', `/concursuri/${c.documentId}`);
    await expect(page.getByTestId('registration-submit')).toHaveCount(0);
    await expect(page.getByTestId('registration-leave')).toHaveCount(0);
    await expectNoA11yViolations(page);
    expect(writes).toHaveLength(0);
  }
  // The viewer's own pending entry past the deadline stays readable, locked with the reason.
  const own = pendingTeam('fx-own-late', { registrationDeadline: new Date(Date.now() - 3_600_000).toISOString() });
  await setup(page, { competition: own });
  await go(page, formPath(own.documentId));
  await ready(page);
  await expect(visible(page.getByTestId('registration-locked'))).toHaveText('Termenul pentru înscriere a expirat');
  await expect(page.getByTestId('registration-leave')).toHaveCount(0);
});

test('participant.register.c9 — the picker lists the viewer disabled as «tu» (no duplicate participant)', async ({ page, context }) => {
  await signIn(context, jwt);
  const c = fixture('fx-anchor', { competitionType: 'team', teamParticipants: 3 });
  const me = { ...users(0, 1)[0], id: qa.id, documentId: qa.documentId, username: qa.username };
  await setup(page, {
    competition: c,
    users: (_s, _n, route) => json(route, userPage(1, 1, [me, ...users(1, 2)])),
  });
  await go(page, formPath(c.documentId));
  await ready(page);
  await page.getByTestId('add-teammates').click();
  const options = page.getByTestId('teammate-options').getByRole('button');
  await expect(options).toHaveCount(3);
  await expect(options.first()).toBeDisabled();
  await expect(options.first()).toHaveAccessibleName(`${qa.username}, tu`);
  await expect(options.first().getByTestId('teammate-anchor')).toHaveText('tu');
  await expect(options.nth(1)).toBeEnabled();
  await expectNoA11yViolations(page);
});

/* ============================================================================================== */
/* The real write (opt-in)                                                                         */
/* ============================================================================================== */

test('participant.register.c14 participant.register.c19 — REAL write on the local CMS: register, see it on the CMS, leave', async ({
  page,
  context,
}) => {
  test.skip(!REAL_WRITE, 'E2E_REAL_REGISTRATION=0');
  const organizer = await userByName('Audit Organizator');
  const id = await createTestCompetition({ label: 'individual', author: organizer.documentId, competitionType: 'single' });
  try {
    await signIn(context, jwt);
    await go(page, formPath(id));
    await ready(page);
    await submit(page).click();
    await expect(status(page)).toHaveAttribute('data-phase', 'success', {
      timeout: 30_000,
    });
    await page.waitForURL(`${BASE}/concursuri/${id}`, { timeout: 15_000 });
    let regs = await registrationsOf(id);
    expect(regs).toHaveLength(1);
    expect(regs[0]).toMatchObject({ registrationStatus: 'pending', author: { documentId: qa.documentId } });
    expect(regs[0].participants.map(p => p.documentId)).toEqual([qa.documentId]);
    await go(page, formPath(id));
    await ready(page);
    await visible(page.getByTestId('registration-leave')).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Părăsește concursul' }).click();
    await expect(status(page)).toContainText('Ai părăsit competiția.', {
      timeout: 30_000,
    });
    await page.waitForURL(`${BASE}/concursuri/${id}`, { timeout: 15_000 });
    regs = await registrationsOf(id);
    expect(regs.map(r => r.registrationStatus)).toEqual(['cancelled']);
  } finally {
    await cleanupTestCompetitions();
  }
  expect(await competitionExists(id)).toBe(false);
});

/* ============================================================================================== */
/* Screenshots (review page): every state at the four widths                                       */
/* ============================================================================================== */

test('screenshots — new single, new team, pending, locked, organizer, dialogs at 375 / 768 / 1280 / 1440', async ({ page, context }) => {
  test.skip(!process.env.E2E_SHOTS, 'set E2E_SHOTS=1 to write .shots/inscriere-*.png');
  await signIn(context, jwt);
  const states: [string, CompetitionDetail, string, Partial<Setup>?][] = [
    ['nou-individual', fixture('fx-s1', { banner: base.banner }), ''],
    ['nou-echipe', fixture('fx-s2', { competitionType: 'team', teamParticipants: 3 }), '', { profile: { phone: null } }],
    ['in-asteptare', pendingTeam('fx-s3'), ''],
    ['blocat', pendingTeam('fx-s4', { competitionStatus: 'started' }, { registrationStatus: 'registered' }), ''],
  ];
  for (const [name, c, q, extra] of states) {
    await setup(page, { competition: c, ...extra });
    for (const vp of [PHONE, TABLET, LAPTOP, WIDE, { width: 1920, height: 1080 }]) {
      await go(page, formPath(c.documentId, q), vp);
      await ready(page);
      await page.waitForTimeout(300);
      await page.screenshot({
        path: `.shots/inscriere-${name}-${vp.width}.png`,
        fullPage: true,
      });
    }
  }
  // Overlays: the picker, the zero-teammates question, the success dialog.
  const team = fixture('fx-s6', {
    competitionType: 'team',
    teamParticipants: 3,
  });
  await setup(page, {
    competition: team,
    profile: { phone: '0712345678' },
    write: async (_w, route) => {
      await new Promise(r => setTimeout(r, 60_000));
      await route.abort();
    },
  });
  for (const vp of [PHONE, LAPTOP]) {
    await go(page, formPath(team.documentId), vp);
    await ready(page);
    await page.getByTestId('add-teammates').click();
    await expect(page.getByTestId('teammate-options').getByRole('button').first()).toBeVisible();
    await page.waitForTimeout(400);
    await page.screenshot({
      path: `.shots/inscriere-coechipieri-${vp.width}.png`,
    });
    await page.keyboard.press('Escape');
    await submit(page).click();
    await page.waitForTimeout(400);
    await page.screenshot({
      path: `.shots/inscriere-fara-coechipieri-${vp.width}.png`,
    });
    await page.getByRole('button', { name: 'Sunt sigur' }).click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `.shots/inscriere-in-curs-${vp.width}.png` });
  }
  await signIn(context, 'dead');
  for (const vp of [PHONE, LAPTOP]) {
    await go(page, formPath('fx-s5'), vp);
    await page.screenshot({
      path: `.shots/inscriere-deconectat-${vp.width}.png`,
      fullPage: true,
    });
  }
});
