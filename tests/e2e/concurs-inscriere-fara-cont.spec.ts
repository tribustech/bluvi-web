import { expect, test, type Page, type Route } from '@playwright/test';
import { getCompetition, type CompetitionDetail } from '../../core/competitions';
import { createTestTransport } from '../transport';
import { expectNoA11yViolations as scan } from './helpers/a11y';
import { BASE_URL as BASE } from './helpers/base-url';
import { collectConsoleErrors } from './helpers/console';
import { qaJwt, signIn } from './helpers/session';

/*
 * Participanți fără cont — /concursuri/[id]/inscriere/fara-cont (parity participant.register-guests
 * c1–c14; c15, the organizer's entry points, comes with M6).
 *
 * No real writes: a guest added for real is a registered entry on a shared local competition. The
 * competition, the my-status overlay and the viewer's statute are fixtures served by page.route at
 * the browser's CMS edge (/api/cms), and every POST / PUT /registrations/guests is answered here —
 * the spec asserts its body. Firestore is not touched by this screen.
 */

test.describe.configure({ timeout: 180_000 });

const PHONE = { width: 375, height: 812 };
const TABLET = { width: 768, height: 1024 };
const LAPTOP = { width: 1280, height: 900 };
const WIDE = { width: 1440, height: 900 };

const TEMPLATE = process.env.E2E_REGISTER_SINGLE ?? 'pby1ovhq0xevex2byx16md28';

let jwt = '';
let base: CompetitionDetail;

test.beforeAll(async ({ request }) => {
  jwt = await qaJwt(request);
  base = await getCompetition(createTestTransport(), TEMPLATE);
});

type Reg = CompetitionDetail['registrations'][number];
const future = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();

const guestReg = (over: Partial<Reg> & { documentId: string }): Reg => ({
  id: 7100,
  registrationStatus: 'registered',
  teamName: null,
  guestName: 'Ion Pop',
  stand: null,
  club: null,
  author: null,
  participants: [],
  ...over,
});

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
    author: { id: 1, documentId: 'org-e2e', username: 'Organizator e2e', phone: null },
    registrations: [],
    ...over,
  };
}

const team = (id: string, over: Partial<CompetitionDetail> = {}) => fixture(id, { competitionType: 'team', teamParticipants: 3, ...over });

const at = (path: string) => (url: URL) => url.pathname === `/api${path}` || url.pathname === `/api/cms${path}`;
const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });

type Write = { method: string; path: string; body: unknown };

async function setup(
  page: Page,
  s: {
    competition: CompetitionDetail;
    statute?: 'author' | 'participant' | 'referee' | null;
    /** The competition read's status, per call (default 200). */
    competitionStatus?: (n: number) => number;
    holdCompetition?: boolean;
    write?: (w: Write, route: Route) => Promise<void> | void;
  },
) {
  const id = s.competition.documentId;
  const writes: Write[] = [];
  let reads = 0;
  let release: () => void = () => {};
  const held = s.holdCompetition ? new Promise<void>(r => (release = r)) : Promise.resolve();
  await page.route(at(`/feed/competitions/${id}`), async route => {
    reads += 1;
    await held;
    const code = s.competitionStatus?.(reads) ?? 200;
    if (code !== 200) return json(route, { error: { status: code, message: 'x' } }, code);
    return json(route, { data: s.competition });
  });
  await page.route(at(`/feed/competitions/${id}/my-status`), route => json(route, { data: { isFollowing: false, userRegistrationStatus: null } }));
  await page.route(at(`/user/profile/competition/${id}/statute`), route =>
    json(route, { userRole: s.statute === undefined ? 'author' : s.statute }),
  );
  await page.route(
    url => /\/api(\/cms)?\/registrations(\/|$)/.test(url.pathname),
    async route => {
      const req = route.request();
      const w: Write = { method: req.method(), path: new URL(req.url()).pathname.replace(/^\/api(\/cms)?/, ''), body: req.postDataJSON?.() ?? null };
      writes.push(w);
      if (s.write) return s.write(w, route);
      return json(route, { id: 7999, documentId: 'reg-guest-new' });
    },
  );
  return { writes, reads: () => reads, release };
}

const formPath = (id: string, q = '') => `/concursuri/${id}/inscriere/fara-cont${q}`;
const ADD_TITLE = 'Adaugă participanți fără cont';
const EDIT_TITLE = 'Editează participanți';

async function go(page: Page, path: string, viewport = PHONE) {
  await page.setViewportSize(viewport);
  await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 120_000 });
}

async function ready(page: Page, title = ADD_TITLE) {
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId('guests-skeleton')).toHaveCount(0, { timeout: 60_000 });
  await expect(submit(page)).toBeVisible({ timeout: 30_000 });
}

/** The form's «Pescar» field (the top bar's search is also labelled with a «pescari»). */
const pescar = (page: Page) => page.getByRole('textbox', { name: 'Pescar', exact: true });
const submit = (page: Page) => page.getByTestId('guests-submit').locator('visible=true').first();

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
  return collectConsoleErrors(page, { ignore: /Failed to load resource|ERR_|net::|status of (400|403|404|500)/ });
}

/* ============================================================================================== */

test('signed out: 307 to /intra?next= with the edit query kept', async ({ request }) => {
  for (const path of [formPath('abc'), formPath('abc', '?inscriere=r1&doarEchipa=1')]) {
    const res = await request.get(`${BASE}${path}`, { maxRedirects: 0 });
    expect(res.status()).toBe(307);
    expect(res.headers().location).toBe(`/intra?next=${encodeURIComponent(path)}`);
  }
});

test('participant.register-guests.c1 — loading skeleton, then an error with a retry that refetches the competition', async ({ page, context }) => {
  await signIn(context, jwt);
  const c = fixture('fx-g-err');
  let failing = true;
  const s = await setup(page, { competition: c, holdCompetition: true, competitionStatus: () => (failing ? 500 : 200) });
  await go(page, formPath(c.documentId));
  await expect(page.getByTestId('guests-skeleton').first()).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole('status').filter({ hasText: 'Se încarcă formularul…' })).toBeAttached();
  s.release();
  const retry = page.getByTestId('guests-retry');
  await expect(retry).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('alert').filter({ hasText: 'A apărut o eroare, te rugăm să încerci mai târziu' })).toBeVisible();
  await expectNoA11yViolations(page);
  const before = s.reads();
  failing = false;
  await retry.focus();
  await page.keyboard.press('Enter');
  await ready(page);
  expect(s.reads()).toBeGreaterThan(before);
});

test('participant.register-guests.c1 — a missing competition says so', async ({ page, context }) => {
  await signIn(context, jwt);
  const c = fixture('fx-g-404');
  await setup(page, { competition: c, competitionStatus: () => 404 });
  await go(page, formPath(c.documentId));
  await expect(page.getByRole('heading', { name: 'Concursul nu a fost găsit' })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId('guests-submit')).toHaveCount(0);
});

test('organizer only: a viewer who does not author the competition is sent back to its page', async ({ page, context }) => {
  await signIn(context, jwt);
  for (const statute of ['participant', null] as const) {
    const c = fixture(`fx-g-na-${statute ?? 'none'}`);
    const s = await setup(page, { competition: c, statute });
    await go(page, formPath(c.documentId));
    await page.waitForURL(`${BASE}/concursuri/${c.documentId}`, { timeout: 60_000 });
    expect(s.writes).toEqual([]);
  }
});

test('participant.register-guests.c2 c3 c4 — single competition, add mode: title, notice, «Pescar», «Finalizează»', async ({ page, context }) => {
  const errors = consoleErrors(page);
  await signIn(context, jwt);
  const c = fixture('fx-g-single');
  await setup(page, { competition: c });
  for (const vp of [PHONE, TABLET, LAPTOP, WIDE]) {
    await go(page, formPath(c.documentId), vp);
    await ready(page);
    await expect(submit(page)).toHaveText('Finalizează');
    const notice = page.getByTestId('guests-notice');
    await expect(notice.getByRole('heading', { name: 'Observații importante' })).toHaveText('⚠️ Observații importante');
    await expect(notice.getByRole('listitem').nth(0)).toHaveText(
      'Pescarul adăugat aici va fi înregistrat automat cu statusul „Aprobat” în lista de participanți.',
    );
    await expect(notice.getByRole('listitem').nth(1)).toHaveText(
      'Dacă pescarul dorește să participe folosind contul personal Bluvi®, poți folosi butonul „Elimină” din pagina de participanți pentru a elimina participantul adăugat manual înainte să înceapă concursul.',
    );
    const field = pescar(page);
    await expect(field).toHaveAttribute('placeholder', 'Introdu numele pescarului');
    await expect(page.getByText('Poți scrie numele pescarului așa cum vrei să apară în clasament')).toBeVisible();
    await expect(page.getByLabel('Numele echipei')).toHaveCount(0);
    await expect(page.getByTestId('guest-add')).toHaveCount(0);
    // The summary card with the CTA from 1024, the bar below it.
    if (vp.width >= 1024) await expect(page.getByTestId('guests-summary')).toBeVisible();
    else await expect(page.getByTestId('guests-summary-compact')).toBeVisible();
    await expectNoA11yViolations(page);
  }
  expect(errors).toEqual([]);
});

test('participant.register-guests.c6 c11 — validation, typing rules, then POST {competitionId, guestName, teamName}; toast and back', async ({ page, context }) => {
  await signIn(context, jwt);
  const c = fixture('fx-g-add');
  const s = await setup(page, { competition: c });
  // A page before this one, so «back» has somewhere to go.
  await go(page, '/');
  await page.evaluate(path => location.assign(path), formPath(c.documentId));
  await ready(page);

  await submit(page).click();
  const field = pescar(page);
  await expect(page.getByText('Acest câmp este obligatoriu').first()).toBeVisible();
  await expect(field).toHaveAttribute('aria-invalid', 'true');
  expect(s.writes).toEqual([]);

  await field.fill('Ion!');
  await expect(page.getByText('Numele poate conține doar litere, cifre și cratime').first()).toBeVisible();
  await field.fill('');
  await field.pressSequentially('   Ștefan    Țăran-2 ');
  await expect(field).toHaveValue('Ștefan Țăran-2 ');
  await expect(page.getByText('Numele poate conține doar litere, cifre și cratime')).toHaveCount(0);
  await expectNoA11yViolations(page);

  // Keyboard: Enter in the field submits the form.
  // (The success toast is asserted where back stays in the app; here back reloads «/».)
  await field.press('Enter');
  await expect.poll(() => s.writes.length).toBe(1);
  expect(s.writes[0]).toEqual({
    method: 'POST',
    path: '/registrations/guests',
    body: { data: { competitionId: c.documentId, guestName: 'Ștefan Țăran-2', teamName: '' } },
  });
  await page.waitForURL(`${BASE}/`, { timeout: 60_000 });
});

test('participant.register-guests.c11 — opened straight from a link: back falls back to the participants page', async ({ page, context }) => {
  await signIn(context, jwt);
  const c = fixture('fx-g-fallback');
  await setup(page, { competition: c });
  await go(page, formPath(c.documentId), LAPTOP);
  await ready(page);
  await pescar(page).fill('Ion Pop');
  await submit(page).click();
  await expect(page.getByText('Înregistrarea a fost adăugată cu succes!')).toBeVisible();
  await page.waitForURL(`${BASE}/concursuri/${c.documentId}/participanti`, { timeout: 60_000 });
});

test('participant.register-guests.c11 — a refused write: the error toast, the form stays', async ({ page, context }) => {
  await signIn(context, jwt);
  const c = fixture('fx-g-refused');
  const s = await setup(page, {
    competition: c,
    write: (_w, route) =>
      json(route, { data: null, error: { status: 400, name: 'BadRequestError', message: 'Competition participants limit reached', details: { bluCode: 'REGISTRATION:COMPETITION_PARTICIPANTS_LIMIT_REACHED' } } }, 400),
  });
  await go(page, formPath(c.documentId));
  await ready(page);
  await pescar(page).fill('Ion Pop');
  await submit(page).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Concursul a atins numărul maxim de participanți.' })).toBeVisible();
  expect(s.writes).toHaveLength(1);
  await expect(pescar(page)).toHaveValue('Ion Pop');
  await expect(submit(page)).toBeEnabled();
});

test('participant.register-guests.c11 — a refused write (500 with a bluCode): the toast in Romanian with diacritics', async ({ page, context }) => {
  await signIn(context, jwt);
  const c = fixture('fx-g-refused-500');
  const s = await setup(page, {
    competition: c,
    write: (_w, route) =>
      json(
        route,
        {
          data: null,
          error: {
            status: 500,
            name: 'InternalServerError',
            message: 'A aparut o eroare la inregistrarea invitatilor. Daca problema persista, contactati echipa de suport.',
            details: { bluCode: 'REGISTRATION:REGISTER_GUESTS_ERROR' },
          },
        },
        500,
      ),
  });
  await go(page, formPath(c.documentId));
  await ready(page);
  await pescar(page).fill('Ion Pop');
  await submit(page).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'A apărut o eroare la adăugarea participanților. Dacă problema persistă, contactează echipa de suport.' }),
  ).toBeVisible();
  await expect(page.getByText('A aparut o eroare', { exact: false })).toHaveCount(0);
  expect(s.writes).toHaveLength(1);
  await expect(pescar(page)).toHaveValue('Ion Pop');
  await expect(submit(page)).toBeEnabled();
});

test('participant.register-guests.c3 c5 c7 — team, add mode: members, add / remove, team size caption, team name rules', async ({ page, context }) => {
  const errors = consoleErrors(page);
  await signIn(context, jwt);
  const c = team('fx-g-team', { teamParticipants: 3 });
  const s = await setup(page, { competition: c });
  await go(page, formPath(c.documentId), LAPTOP);
  await ready(page);
  const notice = page.getByTestId('guests-notice');
  await expect(notice.getByRole('listitem').nth(0)).toHaveText(
    'Echipa adăugată aici va fi înregistrată automat cu statusul „Aprobat” în lista de participanți.',
  );
  await expect(notice.getByRole('listitem').nth(1)).toHaveText(
    'Dacă un membru al echipei dorește să participe folosind contul personal Bluvi®, poți folosi butonul „Elimină” din pagina de participanți pentru a elimina echipa adăugată manual înainte să înceapă concursul.',
  );
  await expect(page.getByText('Maxim 3 participanți/echipă')).toBeVisible();
  await expect(page.getByLabel('Participant 1')).toHaveAttribute('placeholder', 'Introdu numele pescarului');
  // One field: no remove control.
  await expect(page.getByRole('button', { name: /Elimină participantul/ })).toHaveCount(0);

  // Keyboard: «Adaugă participant» adds a field and focuses it.
  const add = page.getByTestId('guest-add');
  await add.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Participant 2')).toBeFocused();
  await expect(page.getByRole('button', { name: /Elimină participantul/ })).toHaveCount(2);
  await add.click();
  await expect(page.getByLabel('Participant 3')).toBeVisible();
  // At the team size, no more adding.
  await expect(page.getByTestId('guest-add')).toHaveCount(0);

  await page.getByLabel('Participant 1').fill('Ion Pop');
  await page.getByLabel('Participant 2').fill('De șters');
  await page.getByLabel('Participant 3').fill('Ana Maria');
  await page.getByRole('button', { name: 'Elimină participantul 2' }).click();
  await expect(page.getByLabel('Participant 2')).toHaveValue('Ana Maria');
  await expect(page.getByLabel('Participant 3')).toHaveCount(0);
  await expect(page.getByTestId('guest-add')).toBeVisible();

  const teamName = page.getByLabel('Numele echipei');
  await expect(page.getByText('Numele echipei este opțional')).toBeVisible();
  await teamName.fill('a'.repeat(31));
  await submit(page).click();
  await expect(page.getByText('Numele echipei poate conține maximum 30 de caractere.').first()).toBeVisible();
  await teamName.fill('Crapii #1');
  await expect(page.getByText('Numele echipei poate conține doar litere, cifre și cratime').first()).toBeVisible();
  expect(s.writes).toEqual([]);
  await expectNoA11yViolations(page);

  await teamName.fill('Crapii de Snagov');
  await submit(page).click();
  await expect.poll(() => s.writes.length).toBe(1);
  expect(s.writes[0]).toEqual({
    method: 'POST',
    path: '/registrations/guests',
    body: { data: { competitionId: c.documentId, guestName: 'Ion Pop, Ana Maria', teamName: 'Crapii de Snagov' } },
  });
  expect(errors).toEqual([]);
});

test('participant.register-guests.c6 — the error summary lists each invalid member and focuses it', async ({ page, context }) => {
  await signIn(context, jwt);
  const c = team('fx-g-summary', { teamParticipants: 2 });
  await setup(page, { competition: c });
  await go(page, formPath(c.documentId));
  await ready(page);
  await page.getByTestId('guest-add').click();
  await page.getByLabel('Participant 1').fill('Ion');
  await submit(page).click();
  const summary = page.getByRole('link', { name: /Participant 2/ });
  await expect(summary).toBeVisible();
  await summary.click();
  await expect(page.getByLabel('Participant 2')).toBeFocused();
  await expectNoA11yViolations(page);
});

test('participant.register-guests.c2 c8 c12 — edit a team entry: prefilled from the registration, PUT {guestName, teamName}', async ({ page, context }) => {
  const errors = consoleErrors(page);
  await signIn(context, jwt);
  const reg = guestReg({ documentId: 'reg-g-team', guestName: 'Ion Pop, Ana Maria', teamName: 'Crapii' });
  const c = team('fx-g-edit', { registrations: [reg] });
  const s = await setup(page, { competition: c });
  await go(page, formPath(c.documentId, `?inscriere=${reg.documentId}`), WIDE);
  await ready(page, EDIT_TITLE);
  await expect(submit(page)).toHaveText('Salvează');
  await expect(page.getByTestId('guests-notice')).toHaveCount(0);
  await expect(page.getByLabel('Participant 1')).toHaveValue('Ion Pop');
  await expect(page.getByLabel('Participant 2')).toHaveValue('Ana Maria');
  await expect(page.getByLabel('Numele echipei')).toHaveValue('Crapii');
  // Survives a reload (fish passed these in the URL; the web reads the entry).
  await page.reload({ waitUntil: 'domcontentloaded' });
  await ready(page, EDIT_TITLE);
  await expect(page.getByLabel('Participant 2')).toHaveValue('Ana Maria');
  await expectNoA11yViolations(page);

  await page.getByLabel('Participant 2').fill('Ana Maria Pop');
  await page.getByLabel('Numele echipei').fill('');
  await submit(page).click();
  await expect(page.getByText('Înregistrarea a fost actualizată cu succes!')).toBeVisible();
  expect(s.writes).toEqual([
    { method: 'PUT', path: `/registrations/guests/${reg.documentId}`, body: { data: { guestName: 'Ion Pop, Ana Maria Pop', teamName: '' } } },
  ]);
  expect(errors).toEqual([]);
});

test('participant.register-guests.c8 c12 — edit a single entry; a refused update keeps the form with the error toast', async ({ page, context }) => {
  await signIn(context, jwt);
  const reg = guestReg({ documentId: 'reg-g-single', guestName: 'Ion Pop' });
  const c = fixture('fx-g-edit-single', { registrations: [reg] });
  let refuse = true;
  const s = await setup(page, {
    competition: c,
    write: (_w, route) =>
      refuse
        ? json(route, { data: null, error: { status: 500, name: 'InternalServerError', message: 'A aparut o eroare la actualizarea inregistrarii. Daca problema persista, contactati echipa de suport.', details: { bluCode: 'REGISTRATION:UPDATE_GUEST_ERROR' } } }, 500)
        : json(route, { id: 1, documentId: reg.documentId }),
  });
  await go(page, formPath(c.documentId, `?inscriere=${reg.documentId}`), TABLET);
  await ready(page, EDIT_TITLE);
  await expect(pescar(page)).toHaveValue('Ion Pop');
  await pescar(page).fill('Ion Popescu');
  await submit(page).click();
  await expect(page.getByRole('alert').filter({ hasText: 'A apărut o eroare la actualizarea înscrierii. Dacă problema persistă, contactează echipa de suport.' })).toBeVisible();
  await expect(page.getByText('A aparut o eroare', { exact: false })).toHaveCount(0);
  await expect(pescar(page)).toHaveValue('Ion Popescu');
  refuse = false;
  await submit(page).click();
  await expect(page.getByText('Înregistrarea a fost actualizată cu succes!')).toBeVisible();
  expect(s.writes.map(w => w.body)).toEqual([
    { data: { guestName: 'Ion Popescu', teamName: '' } },
    { data: { guestName: 'Ion Popescu', teamName: '' } },
  ]);
});

test('participant.register-guests.c9 — doarEchipa: only the team name, guestName not sent', async ({ page, context }) => {
  await signIn(context, jwt);
  const reg = guestReg({ documentId: 'reg-g-members', guestName: 'Ion Pop, Ana Maria', teamName: 'Crapii' });
  const c = team('fx-g-members', { registrations: [reg] });
  const s = await setup(page, { competition: c });
  await go(page, formPath(c.documentId, `?inscriere=${reg.documentId}&doarEchipa=1`));
  await ready(page, EDIT_TITLE);
  await expect(page.getByLabel(/Participant \d/)).toHaveCount(0);
  await expect(page.getByTestId('guest-add')).toHaveCount(0);
  await page.getByLabel('Numele echipei').fill('Crapii Noi');
  await submit(page).click();
  await expect.poll(() => s.writes.length).toBe(1);
  expect(s.writes[0]).toEqual({ method: 'PUT', path: `/registrations/guests/${reg.documentId}`, body: { data: { teamName: 'Crapii Noi' } } });
});

test('participant.register-guests.c9 — doarEchipa on a single competition is the normal edit (no empty form, no {teamName:\'\'} write)', async ({ page, context }) => {
  await signIn(context, jwt);
  const reg = guestReg({ documentId: 'reg-g-single-members', guestName: 'Ion Pop' });
  const c = fixture('fx-g-single-members', { registrations: [reg] });
  const s = await setup(page, { competition: c });
  await go(page, formPath(c.documentId, `?inscriere=${reg.documentId}&doarEchipa=1`));
  await ready(page, EDIT_TITLE);
  await expect(pescar(page)).toHaveValue('Ion Pop');
  await expect(page.getByLabel('Numele echipei')).toHaveCount(0);
  await pescar(page).fill('Ion Popescu');
  await submit(page).click();
  await expect.poll(() => s.writes.length).toBe(1);
  expect(s.writes[0]).toEqual({
    method: 'PUT',
    path: `/registrations/guests/${reg.documentId}`,
    body: { data: { guestName: 'Ion Popescu', teamName: '' } },
  });
});

test('edit: an entry that is gone, or one with accounts on it (doarEchipa too), says so instead of a form', async ({ page, context }) => {
  await signIn(context, jwt);
  const account = guestReg({ documentId: 'reg-acc', guestName: null, participants: [{ id: 1, documentId: 'u1', username: 'pescar', avatar: null }] });
  const c = team('fx-g-gone', { registrations: [account] });
  await setup(page, { competition: c });
  await go(page, formPath(c.documentId, '?inscriere=nu-exista'));
  await expect(page.getByRole('heading', { name: 'Înscrierea nu a fost găsită' })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole('link', { name: 'Vezi participanții' })).toHaveAttribute('href', `/concursuri/${c.documentId}/participanti`);
  await go(page, formPath(c.documentId, '?inscriere=reg-acc'));
  await expect(page.getByRole('heading', { name: 'Înscrierea are participanți cu cont' })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole('link', { name: 'Editează înscrierea' })).toHaveAttribute(
    'href',
    `/concursuri/${c.documentId}/inscriere?organizator=1&inscriere=reg-acc`,
  );
  await expect(page.getByTestId('guests-submit')).toHaveCount(0);
  // doarEchipa does not open an account entry here either: same gate, same link.
  await go(page, formPath(c.documentId, '?inscriere=reg-acc&doarEchipa=1'));
  await expect(page.getByRole('heading', { name: 'Înscrierea are participanți cu cont' })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole('link', { name: 'Editează înscrierea' })).toHaveAttribute(
    'href',
    `/concursuri/${c.documentId}/inscriere?organizator=1&inscriere=reg-acc`,
  );
  await expect(page.getByTestId('guests-submit')).toHaveCount(0);
});

test('rule 4: no add form after the start or when the competition is full', async ({ page, context }) => {
  await signIn(context, jwt);
  const started = fixture('fx-g-started', { competitionStatus: 'started' });
  await setup(page, { competition: started });
  await go(page, formPath(started.documentId));
  await expect(page.getByTestId('guests-unavailable')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText('Participanții fără cont pot fi adăugați doar înainte de începerea concursului.')).toBeVisible();
  const full = fixture('fx-g-full', { participantsLimit: 1, registrations: [guestReg({ documentId: 'r-full' })] });
  await setup(page, { competition: full });
  await go(page, formPath(full.documentId));
  await expect(page.getByRole('heading', { name: 'Concursul este complet' })).toBeVisible({ timeout: 60_000 });
  await expectNoA11yViolations(page);
});

test('participant.register-guests.c14 — unsaved changes: leaving asks first; «Renunță» leaves', async ({ page, context }) => {
  await signIn(context, jwt);
  const c = fixture('fx-g-dirty');
  const s = await setup(page, { competition: c });
  await go(page, formPath(c.documentId), LAPTOP);
  await ready(page);
  await pescar(page).fill('Ion');
  await page.getByRole('link', { name: 'Înapoi la concurs' }).click();
  const guard = page.getByRole('alertdialog', { name: 'Renunți la modificări?' });
  await expect(guard).toBeVisible();
  await expectNoA11yViolations(page);
  await guard.getByRole('button', { name: 'Continuă editarea' }).click();
  await expect(pescar(page)).toHaveValue('Ion');
  await page.getByRole('link', { name: 'Înapoi la concurs' }).click();
  await page.getByRole('alertdialog', { name: 'Renunți la modificări?' }).getByRole('button', { name: 'Renunță' }).click();
  await page.waitForURL(`${BASE}/concursuri/${c.documentId}`, { timeout: 60_000 });
  expect(s.writes).toEqual([]);
});

test('participant.register-guests.c14 — the browser’s own prompt on unload while dirty', async ({ page, context }) => {
  await signIn(context, jwt);
  const c = fixture('fx-g-unload');
  await setup(page, { competition: c });
  await go(page, formPath(c.documentId));
  await ready(page);
  await pescar(page).fill('Ion');
  const prompt = new Promise<string>(resolve => page.once('dialog', d => (resolve(d.type()), void d.dismiss())));
  await page.close({ runBeforeUnload: true });
  expect(await prompt).toBe('beforeunload');
});
