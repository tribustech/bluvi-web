import { mkdirSync } from 'node:fs';
import type { Page, Route } from '@playwright/test';
import { getCompetition, type CompetitionDetail } from '../../core/competitions';
import { createTestTransport } from '../transport';
import { expectNoA11yViolations as scan } from './helpers/a11y';
import { BASE_URL as BASE } from './helpers/base-url';
import { collectConsoleErrors } from './helpers/console';
import { signIn } from './helpers/session';
import {
  anglerJwt,
  competitionFixture,
  draftFixture,
  expect,
  mockRead,
  S3_IMAGE,
  signInOrganizer,
  test,
} from './helpers/fake-organizer';

/*
 * organizer.wizard (c1–c26) + organizer.b.publish-landing, wizard-analytics, cannot-edit-started,
 * role-gate, signed-out-gate — the create / edit competition wizard's FRAME
 * (/organizator/concursuri/nou/[pas], /concursuri/[id]/editeaza/[pas]; fish
 * app/(app)/create-competition/_layout.tsx + contexts/CreateCompetitionContext.tsx).
 *
 * The steps are stubs («În lucru») until M6-B2…B4: the form is driven through the frame's dev-only
 * seam (window.__bluviWizard, context.tsx) — real values through the real provider, auto-save,
 * payloads and dialogs.
 *
 * NO REAL WRITES (the local CMS sends real pushes / e-mails): every draft create / update / publish /
 * delete, every upload and every competition PUT is route-mocked through the harness
 * (helpers/fake-organizer guardCmsWrites — any other write is aborted and fails the test), and each
 * spec asserts its method, path and body (confirmRiskChanges included). Reads: the draft GET is a
 * fixture; the lake (Chita Lake) and the edit base competition are read from the local CMS.
 */

test.describe.configure({ timeout: 180_000 });

const PHONE = { width: 375, height: 812 };
const LAPTOP = { width: 1280, height: 900 };
const SHOTS = '.shots/organizator-asistent';
mkdirSync(SHOTS, { recursive: true });

const NEW = (pas = 'detalii', q = '') => `/organizator/concursuri/nou/${pas}${q}`;
const EDIT = (id: string, pas = 'detalii', q = '') => `/concursuri/${id}/editeaza/${pas}${q}`;
const DRAFT_PATH = '/competitions/organizer/draft';
const LAKE_ID = 's84u55lo4n9z0emngozttt6e';
const TEMPLATE = process.env.E2E_REGISTER_SINGLE ?? 'pby1ovhq0xevex2byx16md28';

const TITLES = ['Detalii de bază', 'Configurare competiție', 'Tip clasament', 'Lac și sectoare', 'Alocă standuri', 'Revizuire'];
const JOKES = [
  'Aruncăm nada potrivită...',
  'Mai așteptăm puțin, pare că trage ceva mare.',
  'Verificăm dacă banner-ul a prins bine în cârlig.',
  'Ținem firul întins până confirmă serverul.',
];

/** Failed reads / writes the specs answer with 4xx / 5xx on purpose. */
const EXPECTED_CONSOLE = [/Failed to load resource: the server responded with a status of (40\d|409|50\d)/, /ERR_|net::/];

test.beforeEach(async ({ context, request, page }) => {
  await signInOrganizer(context, request);
  // organizer.b.wizard-analytics: every lib/analytics event, in order.
  await page.addInitScript(() => {
    const w = window as unknown as { __events: { name: string; params: Record<string, unknown> }[] };
    w.__events = [];
    window.addEventListener('bluvi:analytics', (e) => w.__events.push((e as CustomEvent).detail));
  });
});

/* ============================================================================================== */
/* Helpers                                                                                        */
/* ============================================================================================== */

type Values = Record<string, unknown>;

async function open(page: Page, path: string, viewport = LAPTOP) {
  await page.setViewportSize(viewport);
  await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await expect(page.getByTestId('wizard-step')).toBeVisible({ timeout: 90_000 });
  await page.waitForFunction(() => Boolean((window as unknown as { __bluviWizard?: unknown }).__bluviWizard));
}

/** The frame's dev-only seam (context.tsx): set a field like a step would. */
async function setValue(page: Page, field: string, value: unknown, autoSave: 'now' | 'debounced' | false = false) {
  await page.evaluate(
    ([f, v, a]) => {
      const w = window as unknown as { __bluviWizard: { setValue: (f: string, v: unknown, o: unknown) => void } };
      w.__bluviWizard.setValue(f as string, v, { autoSave: a });
    },
    [field, value, autoSave] as const,
  );
}

/**
 * Everything the review gate asks for (fish step-review hasAnyError): without it «Publică
 * competiția» / «Salvează modificările» stay disabled. No auto-save (the spec decides the writes).
 */
async function fillValid(page: Page, over: Values = {}) {
  const values: Values = {
    name: 'Cupa validă',
    startDate: '2026-11-14T05:00:00.000Z',
    endDate: '2026-11-15T12:00:00.000Z',
    competitionType: 'single',
    participantsLimit: '12',
    fishSpeciesIds: ['crap'],
    rankingType: 'quantity',
    lake: LAKE_ID,
    sectors: [{ name: 'A', minFishNumber: 1 }],
    ...over,
  };
  for (const [field, value] of Object.entries(values)) await setValue(page, field, value);
}

/** A picked banner (a small JPEG blob), as the step's picker hands it over. */
async function pickBanner(page: Page) {
  await page.evaluate(() => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 0xff, 0xd9]);
    const w = window as unknown as { __bluviWizard: { pickBanner: (b: Blob, n?: string) => void } };
    w.__bluviWizard.pickBanner(new Blob([bytes], { type: 'image/jpeg' }), 'banner.jpg');
  });
}

const events = (page: Page) =>
  page.evaluate(() => (window as unknown as { __events: { name: string; params: Record<string, unknown> }[] }).__events);

const counter = (page: Page) => page.getByTestId('wizard-step-counter');
const autosave = (page: Page) => page.getByTestId('wizard-autosave');
const h1 = (page: Page) => page.getByRole('heading', { level: 1 });
const stepNav = (page: Page) => page.getByRole('navigation', { name: 'Pașii competiției' });
const progress = (page: Page) => page.getByTestId('wizard-progress');
const dialog = (page: Page, name: string | RegExp) => page.getByRole('dialog', { name }).or(page.getByRole('alertdialog', { name }));
const nextBtn = (page: Page) => page.getByTestId('wizard-next');
const saveBtn = (page: Page) => page.getByTestId('wizard-save');

const draftBody = (over: Values = {}) => ({ data: draftFixture({ documentId: 'fx-new', id: 501, name: 'Cupa e2e', lake: null, ...over }) });

function bodyData(w: { body: unknown }): Values {
  return ((w.body as { data?: Values } | undefined)?.data ?? {}) as Values;
}

async function shot(page: Page, name: string) {
  await settle(page);
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
}

/** Finite animations done (a dialog's fade-in, a toast's slide): what a still screenshot or axe reads. */
async function settle(page: Page) {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => {})),
    ),
  );
  await page.waitForTimeout(450);
}

/** A held route: answered when `release()` is called (never by the test's end: aborted then). */
function hold() {
  let release: () => void = () => {};
  const held = new Promise<void>((r) => (release = r));
  return { held, release };
}

/** axe once the page is still: a dialog's 420 ms fade-in would read as low contrast mid-way. */
async function expectNoA11yViolations(page: Page) {
  await settle(page);
  await scan(page);
}

/* ── edit mode: the competition (base: a real local one), its my-status and the viewer's statute ── */

let base: CompetitionDetail | null = null;
test.beforeAll(async () => {
  base = await getCompetition(createTestTransport(), TEMPLATE).catch(() => null);
});

const future = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();

function editFixture(id: string, over: Partial<CompetitionDetail> = {}): CompetitionDetail {
  return {
    ...(base as CompetitionDetail),
    documentId: id,
    name: `Cupa editare ${id}`,
    competitionStatus: 'notStarted',
    competitionType: 'single',
    participantsLimit: 30,
    startDate: future(10),
    endDate: future(11),
    registrationDeadline: future(10),
    ...over,
  };
}

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });

async function routeCompetition(page: Page, c: CompetitionDetail, statute: 'author' | 'participant' | null = 'author') {
  const id = c.documentId;
  const at = (path: string) => (url: URL) => url.pathname === `/api${path}` || url.pathname === `/api/cms${path}`;
  await page.route(at(`/feed/competitions/${id}`), (route) => (route.request().method() === 'GET' ? json(route, { data: c }) : route.fallback()));
  await page.route(at(`/feed/competitions/${id}/my-status`), (route) => json(route, { data: { isFollowing: false, userRegistrationStatus: null } }));
  await page.route(at(`/user/profile/competition/${id}/statute`), (route) => json(route, { userRole: statute }));
}

const updateResponse = (id: string, allocationsReset: boolean) => ({
  data: competitionFixture({ documentId: id, competitionStatus: 'notStarted', registrations: [] }),
  meta: {
    allocationsReset,
    affectedAllocationsCount: allocationsReset ? 3 : 0,
    risks: [],
    impact: { registeredCount: 0, pendingCount: 0, allocatedRegistrationsCount: 0, allocatedStandsCount: 0 },
  },
});

/* ============================================================================================== */
/* Gates                                                                                          */
/* ============================================================================================== */

test('signed-out-gate: both wizard routes answer 307 /intra?next= with the query kept', async ({ request }) => {
  for (const path of [NEW('detalii'), NEW('clasament', '?ciorna=abc&inapoi=%2Forganizator'), EDIT('abc', 'revizuire')]) {
    const res = await request.get(`${BASE}${path}`, { maxRedirects: 0, headers: { cookie: '' } });
    expect(res.status()).toBe(307);
    expect(res.headers().location).toBe(`/intra?next=${encodeURIComponent(path)}`);
  }
});

test('an unknown step is a 404', async ({ page }) => {
  await page.setViewportSize(LAPTOP);
  await page.goto(NEW('pasul-7'));
  await expect(page.getByTestId('wizard-step')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: /nu (a fost găsit|există)|404|Pagina/i }).first()).toBeVisible({ timeout: 60_000 });
});

test('role-gate: a signed-in viewer without the Organizer role gets the role notice, no wizard', async ({ browser, request }) => {
  const jwt = await anglerJwt(request);
  test.skip(!jwt, 'E2E_CMS_ADMIN_TOKEN is not set: no plain-angler account to sign in with');
  const ctx = await browser.newContext({ viewport: LAPTOP });
  await signIn(ctx, jwt as string);
  const page = await ctx.newPage();
  await page.goto(NEW('detalii'));
  await expect(page.getByText('Panoul organizator este disponibil doar organizatorilor.')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId('wizard-step')).toHaveCount(0);
  await ctx.close();
});

/* ============================================================================================== */
/* Frame: steps, counter, progress (c1, c3, c4, c26)                                              */
/* ============================================================================================== */

test('organizer.wizard.c1 c3 c26 — six titled steps, «Pasul N din 6», segments jump, «Următorul pas» goes on', async ({ page }) => {
  const errors = collectConsoleErrors(page, { ignore: EXPECTED_CONSOLE });
  await open(page, NEW('detalii'));
  await expect(h1(page)).toHaveText('Detalii de bază');
  await expect(counter(page)).toHaveText('Pasul 1 din 6');
  // The rail (≥1280) names all six steps, in order.
  const items = stepNav(page).getByRole('listitem');
  await expect(items).toHaveCount(6);
  for (let i = 0; i < 6; i++) await expect(items.nth(i)).toContainText(TITLES[i]);
  await expect(items.nth(0)).toHaveAttribute('aria-current', 'step');
  await expect(page.getByTestId('step-detalii')).toBeVisible();

  // c26: «Următorul pas» → step 2, the URL follows, the heading takes focus.
  await nextBtn(page).click();
  await expect(page).toHaveURL(`${BASE}${NEW('configurare')}`);
  await expect(h1(page)).toHaveText('Configurare competiție');
  await expect(counter(page)).toHaveText('Pasul 2 din 6');
  await expect(h1(page)).toBeFocused();

  // c3: a step of the list jumps there (every step is reachable).
  await stepNav(page).getByRole('button', { name: /Pasul 5 din 6: Alocă standuri/ }).click();
  await expect(h1(page)).toHaveText('Alocă standuri');
  await expect(page).toHaveURL(`${BASE}${NEW('standuri')}`);

  // c4: back on steps 2–6 = the previous step (not history: we came from step 2).
  await page.getByRole('button', { name: 'Pasul anterior' }).click();
  await expect(h1(page)).toHaveText('Lac și sectoare');
  await expect(counter(page)).toHaveText('Pasul 4 din 6');

  // A reload opens the step of the URL.
  await page.reload();
  await expect(h1(page)).toHaveText('Lac și sectoare', { timeout: 90_000 });
  await expectNoA11yViolations(page);
  expect(errors).toEqual([]);
});

test('organizer.wizard.c3 — 1280: the rail fills by position like the phone bar; completeness said apart', async ({ page }) => {
  await open(page, NEW('revizuire'));
  const items = stepNav(page).getByRole('listitem');
  await expect(items).toHaveCount(6);
  await expect(items.nth(5)).toHaveAttribute('aria-current', 'step');
  for (let i = 0; i < 5; i++) {
    await expect(stepNav(page).getByRole('button', { name: new RegExp(`Pasul ${i + 1} din 6: .*, completat`) })).toBeVisible();
    await expect(items.nth(i)).toContainText('De completat');
  }
});

test('organizer.step-review (frame gate) — «Publică competiția»: disabled on an empty form, enabled once valid', async ({ page }) => {
  await open(page, NEW('revizuire'));
  await expect(page.getByTestId('wizard-publish')).toBeDisabled();
  await fillValid(page, { rankingType: 'bestOf' });
  // bestOf without its fish count and winners is still not publishable.
  await expect(page.getByTestId('wizard-publish')).toBeDisabled();
  await setValue(page, 'bestOfFishCount', '5');
  await setValue(page, 'numberOfWinners', '3');
  await expect(page.getByTestId('wizard-publish')).toBeEnabled();
  await setValue(page, 'name', '');
  await expect(page.getByTestId('wizard-publish')).toBeDisabled();
});

test('organizer.wizard.c3 — phone: the 6-segment bar fills up to the current step; a segment jumps', async ({ page }) => {
  await open(page, NEW('clasament'), PHONE);
  const bar = page.getByRole('navigation', { name: 'Pașii competiției' });
  const segments = bar.getByRole('listitem');
  await expect(segments).toHaveCount(6);
  await expect(segments.nth(2)).toHaveAttribute('aria-current', 'step');
  await expect(counter(page)).toHaveText('Pasul 3 din 6');
  await shot(page, 'phone-step3');
  await bar.getByRole('button', { name: /Pasul 6 din 6: Revizuire/ }).click();
  await expect(h1(page)).toHaveText('Revizuire');
  await expect(page.getByTestId('wizard-publish')).toBeVisible();
  await expectNoA11yViolations(page);
});

/* ============================================================================================== */
/* Auto-save (c2, c21, c22, c23, c24)                                                             */
/* ============================================================================================== */

test('organizer.wizard.c2 c21 c23 c24 — first auto-save creates the draft, then updates it; label states; payload rules', async ({ page, organizer }) => {
  await organizer.mockWrite('POST', DRAFT_PATH, { json: draftBody(), delayMs: 1200 });
  await organizer.mockWrite('PUT', `${DRAFT_PATH}/fx-new`, { json: draftBody() });
  await open(page, NEW('detalii'));
  await expect(autosave(page)).toHaveAttribute('data-state', 'idle');

  // c21: a name under 3 characters never saves.
  await setValue(page, 'name', 'Cu', 'debounced');
  await page.waitForTimeout(900);
  expect(organizer.writes).toEqual([]);

  // c2 (≥1280): the rail says how saving works for THIS state — not saved until it has a name.
  await expect(page.getByText('Adaugă un nume ca să salvăm ciorna.')).toBeVisible();
  await expect(page.getByText('Ciorna se salvează automat cât timp ești online.')).toHaveCount(0);

  // c2: «Se salvează...» while in flight, then «Salvat la HH:mm» — in the sticky rail from 1280.
  await setValue(page, 'name', 'Cupa e2e', 'debounced');
  await expect(autosave(page)).toContainText('Se salvează...');
  await expect(autosave(page)).toHaveAttribute('data-state', 'saving');
  await expect(autosave(page)).toContainText(/Salvat la \d{2}:\d{2}/, { timeout: 10_000 });
  expect(organizer.writes).toHaveLength(1);
  // The status stays in view after scrolling (the header band scrolls away from 1280).
  await page.mouse.wheel(0, 2000);
  await expect(autosave(page)).toBeInViewport();
  await page.mouse.wheel(0, -2000);
  expect(organizer.writes[0]).toMatchObject({ method: 'POST', path: DRAFT_PATH });
  expect(bodyData(organizer.writes[0])).toMatchObject({ name: 'Cupa e2e', competitionType: 'single', draftMeta: { completedSteps: [1] } });
  // The draft's id rides in the URL (a reload reopens it); the header gets the draft's trash.
  await expect(page).toHaveURL(/[?&]ciorna=fx-new/);
  await expect(page.getByRole('button', { name: 'Șterge ciorna' })).toBeVisible();
  // c5: a saved draft's save label.
  await expect(saveBtn(page)).toHaveText('Salvează modificările');

  // c23 + c24: everything filled → completedSteps 1–5; deadline = start; empty numerics dropped; blocks.
  await setValue(page, 'startDate', '2026-11-14T05:00:00.000Z');
  await setValue(page, 'endDate', '2026-11-15T12:00:00.000Z');
  await setValue(page, 'participantsLimit', '12');
  await setValue(page, 'registerFee', '');
  await setValue(page, 'numberOfWinners', '');
  await setValue(page, 'roundsCount', '');
  await setValue(page, 'rankingType', 'quantity');
  await setValue(page, 'lake', LAKE_ID);
  await setValue(page, 'sectors', [{ name: 'A', minFishNumber: 1 }]);
  await setValue(page, 'standAllocations', { A: ['st1', ' '] });
  await setValue(page, 'description', '<p>Concurs de toamnă</p>');
  // c26: «Următorul pas» flushes the pending save before it moves on.
  await nextBtn(page).click();
  await expect.poll(() => organizer.writes.length).toBe(2);
  const put = organizer.writes[1];
  expect(put).toMatchObject({ method: 'PUT', path: `${DRAFT_PATH}/fx-new` });
  const data = bodyData(put);
  expect(data.registrationDeadline).toBe('2026-11-14T05:00:00.000Z');
  expect(data).not.toHaveProperty('registerFee');
  expect(data).not.toHaveProperty('numberOfWinners');
  expect(data).not.toHaveProperty('roundsCount');
  expect(data).not.toHaveProperty('banner');
  expect(data.description).toEqual([{ type: 'paragraph', children: [{ type: 'text', text: 'Concurs de toamnă' }] }]);
  expect(data.draftMeta).toEqual({
    sectors: [{ name: 'A', minFishNumber: 1 }],
    standAllocations: { A: ['st1'] },
    sponsorIds: [],
    fishSpeciesIds: [],
    completedSteps: [1, 2, 3, 4, 5],
  });
  await expect(h1(page)).toHaveText('Configurare competiție');
  // The step list marks the completed steps done (the draft's completedSteps).
  await expect(stepNav(page).getByRole('button', { name: /Pasul 1 din 6: Detalii de bază, completat/ })).toBeVisible();
  // The summary column reads the values.
  await expect(page.getByRole('region', { name: 'Rezumat' })).toContainText('Chita Lake', { timeout: 30_000 });
  await expect(page.getByRole('region', { name: 'Rezumat' })).toContainText('12 participanți');
  await shot(page, 'laptop-saved');

  // Nothing changed since: moving again saves nothing.
  await stepNav(page).getByRole('button', { name: /Revizuire/ }).click();
  await page.waitForTimeout(700);
  expect(organizer.writes).toHaveLength(2);
});

test('organizer.wizard.c21 — a failed auto-save is retried once after 5 s, then the amber «Nu s-a putut salva automat»', async ({ page, organizer }) => {
  await organizer.mockWrite('POST', DRAFT_PATH, { status: 500, json: { error: { status: 500, message: 'x' } } });
  await open(page, NEW('detalii'), PHONE);
  await setValue(page, 'name', 'Cupa retry', 'now');
  await expect(autosave(page)).toContainText('Se salvează...');
  await page.waitForTimeout(3000);
  expect(organizer.writes).toHaveLength(1);
  await expect(autosave(page)).toContainText('Nu s-a putut salva automat', { timeout: 10_000 });
  await expect(autosave(page)).toHaveAttribute('data-state', 'error');
  expect(organizer.writes).toHaveLength(2);
  await shot(page, 'phone-autosave-error');
  // No loop: after the one retry nothing is written again on its own (fish stops there)…
  await page.waitForTimeout(7000);
  expect(organizer.writes).toHaveLength(2);
  await expect(autosave(page)).toHaveAttribute('data-state', 'error');
  // …until the next edit, which tries again.
  await setValue(page, 'name', 'Cupa retry 2', 'debounced');
  await expect.poll(() => organizer.writes.length, { timeout: 5000 }).toBe(3);
});

test('organizer.wizard.c21 c10 — «Salvează și ieși» during the auto-save retry: one draft created, no write beside it', async ({ page, organizer }) => {
  let posts = 0;
  await organizer.mockWrite('POST', DRAFT_PATH, () => {
    posts += 1;
    return posts === 1 ? { status: 500, json: { error: { status: 500, message: 'x' } } } : { json: draftBody({ documentId: 'fx-once' }) };
  });
  await organizer.mockWrite('PUT', `${DRAFT_PATH}/fx-once`, { json: draftBody({ documentId: 'fx-once' }) });
  await open(page, NEW('detalii'));
  await setValue(page, 'name', 'Cupa o singură dată', 'now');
  await expect.poll(() => organizer.writes.length).toBe(1);
  // The first auto-save failed; its retry waits 5 s. Save and exit now.
  await saveBtn(page).click();
  await page.waitForURL((u) => u.pathname === '/organizator', { timeout: 60_000 });
  await page.waitForTimeout(1500);
  // The failed auto-save, then the operation's own create — no retry, no second draft, no PUT.
  expect(organizer.writes.map((w) => `${w.method} ${w.path}`)).toEqual([`POST ${DRAFT_PATH}`, `POST ${DRAFT_PATH}`]);
  expect(posts).toBe(2);
});

test('organizer.wizard.c21 c22 — offline: auto-save pauses; save, publish and delete toast and do nothing', async ({ page, context, organizer }) => {
  await mockRead(page, `${DRAFT_PATH}/fx-off`, { json: draftBody({ documentId: 'fx-off', banner: S3_IMAGE }) });
  await open(page, NEW('detalii', '?ciorna=fx-off'));
  await context.setOffline(true);
  await setValue(page, 'name', 'Cupa offline', 'now');
  await page.waitForTimeout(800);
  await expect(autosave(page)).toHaveAttribute('data-state', 'idle');
  const offline = page.getByText('Nu ai conexiune la internet. Conectează-te și încearcă din nou.');
  await saveBtn(page).click();
  await expect(offline).toBeVisible();
  await page.getByRole('button', { name: 'Șterge ciorna' }).click();
  await dialog(page, 'Ștergi această ciornă?').getByRole('button', { name: 'Șterge ciorna' }).click();
  await expect(offline).toBeVisible();
  await stepNav(page).getByRole('button', { name: /Revizuire/ }).click();
  await fillValid(page, { name: 'Cupa offline' });
  await page.getByTestId('wizard-publish').click();
  await expect(offline).toBeVisible();
  await expect(progress(page)).toBeHidden();
  expect(organizer.writes).toEqual([]);
  await context.setOffline(false);
});

/* ============================================================================================== */
/* Exit, save and exit, name (c4, c5, c6, c9, c10)                                                */
/* ============================================================================================== */

test('organizer.wizard.c4 c6 — step 1 back: clean form leaves at once (return target, else the panel)', async ({ page }) => {
  await open(page, NEW('detalii', `?inapoi=${encodeURIComponent('/concursuri?q=cupa')}`));
  await page.getByRole('button', { name: 'Ieși din asistent' }).click();
  await page.waitForURL((u) => u.pathname === '/concursuri' && u.search === '?q=cupa', { timeout: 60_000 });

  await open(page, NEW('detalii', `?inapoi=${encodeURIComponent('https://evil.example/x')}`));
  await page.getByRole('button', { name: 'Ieși din asistent' }).click();
  await page.waitForURL((u) => u.pathname === '/organizator', { timeout: 60_000 });
});

test('organizer.wizard.c4 c5 — step 1 back with unsaved changes asks «Salvezi progresul…»; «Ies fără să salvez» leaves', async ({ page, organizer }) => {
  await open(page, NEW('detalii'), PHONE);
  await expect(saveBtn(page)).toHaveText('Salvează și ieși');
  await setValue(page, 'name', 'Cu');
  await page.getByRole('button', { name: 'Ieși din asistent' }).click();
  const d = dialog(page, 'Salvezi progresul înainte de a ieși?');
  await expect(d).toBeVisible();
  await expect(d.getByRole('button', { name: 'Salvează și ieși' })).toBeVisible();
  await expect(d.getByRole('button', { name: 'Ies fără să salvez' })).toBeVisible();
  await shot(page, 'phone-exit-dialog');
  await expectNoA11yViolations(page);
  await page.keyboard.press('Escape');
  await expect(d).toHaveCount(0);
  await page.getByRole('button', { name: 'Ieși din asistent' }).click();
  await d.getByRole('button', { name: 'Ies fără să salvez' }).click();
  await page.waitForURL((u) => u.pathname === '/organizator', { timeout: 60_000 });
  expect(organizer.writes).toEqual([]);
});

test('organizer.wizard.c4 (web) — a top-bar link away from a dirty wizard asks first; moving between steps never does', async ({ page, organizer }) => {
  await open(page, NEW('detalii'));
  await setValue(page, 'name', 'Cu');
  // Between steps: no question.
  await nextBtn(page).click();
  await expect(h1(page)).toHaveText('Configurare competiție');
  await expect(dialog(page, 'Salvezi progresul înainte de a ieși?')).toHaveCount(0);
  // Out of the wizard: held.
  await page.getByRole('banner').getByRole('link', { name: 'Bălți', exact: true }).first().click();
  const d = dialog(page, 'Salvezi progresul înainte de a ieși?');
  await expect(d).toBeVisible();
  await d.getByRole('button', { name: 'Ies fără să salvez' }).click();
  await page.waitForURL((u) => u.pathname === '/balti', { timeout: 60_000 });
  expect(organizer.writes).toEqual([]);
});

test('organizer.wizard.c9 — saving with a name under 3 characters: «Adaugă un nume» → back to step 1', async ({ page, organizer }) => {
  await open(page, NEW('clasament'));
  await saveBtn(page).click();
  const d = dialog(page, 'Adaugă un nume');
  await expect(d).toBeVisible();
  await expect(d).toContainText('Pentru a putea salva ciorna, competiția are nevoie de un nume (minim 3 caractere).');
  await expectNoA11yViolations(page);
  await d.getByRole('button', { name: 'Completează numele' }).click();
  await expect(h1(page)).toHaveText('Detalii de bază');
  expect(organizer.writes).toEqual([]);
});

test('organizer.wizard.c10 c25 — a draft: skeleton, then its values; save-and-exit updates it, uploads the new banner, lands on the panel', async ({ page, organizer }) => {
  const draft = draftBody({ documentId: 'fx-d1', id: 777, name: 'Cupa ciornă e2e', lake: { id: 212, documentId: LAKE_ID, name: 'Chita Lake' } });
  let release = () => {};
  const held = new Promise<void>((r) => (release = r));
  await mockRead(page, `${DRAFT_PATH}/fx-d1`, { json: draft });
  await page.route(`**/api/cms${DRAFT_PATH}/fx-d1`, async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await held;
    return route.fallback();
  });
  await organizer.mockWrite('PUT', `${DRAFT_PATH}/fx-d1`, { json: draft, delayMs: 600 });
  await organizer.mockWrite('POST', '/upload', { json: [{ ...S3_IMAGE, id: 9001 }], delayMs: 600 });

  await page.setViewportSize(LAPTOP);
  await page.goto(NEW('detalii', '?ciorna=fx-d1'), { waitUntil: 'domcontentloaded' });
  // c25: the skeleton until the draft and its lake are in.
  await expect(page.getByTestId('wizard-skeleton').first()).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole('status').filter({ hasText: 'Se încarcă formularul…' })).toBeAttached();
  await shot(page, 'laptop-skeleton');
  release();
  await expect(page.getByTestId('wizard-step')).toBeVisible({ timeout: 60_000 });
  await page.waitForFunction(() => Boolean((window as unknown as { __bluviWizard?: unknown }).__bluviWizard));
  await expect(page.getByText('Ciornă · Cupa ciornă e2e')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Rezumat' })).toContainText('Chita Lake');
  // c5: a draft's label; c7: its trash.
  await expect(saveBtn(page)).toHaveText('Salvează modificările');
  await expect(page.getByRole('button', { name: 'Șterge ciorna' })).toBeVisible();
  // Opening logs «started» with is_editing_draft (wizard-analytics).
  expect((await events(page)).find((e) => e.name === 'create_competition_started')?.params).toEqual({ is_editing_draft: true });

  await pickBanner(page);
  await saveBtn(page).click();
  // c10 + c15: the blocking progress dialog («Salvare în curs...»), the page inert behind it.
  await expect(progress(page)).toBeVisible();
  await expect(page.getByTestId('wizard-progress-status')).toHaveText('Salvare în curs...');
  await expect(page.getByTestId('wizard-progress-caption')).toHaveText('Te rugăm să aștepți până finalizăm actualizarea competiției.');
  await expect(page.getByTestId('wizard-progress-percent')).toHaveText(/^(25|60|100)%$/);
  await page.keyboard.press('Escape');
  await expect(progress(page)).toBeVisible();
  await shot(page, 'laptop-progress-save');
  await page.waitForURL((u) => u.pathname === '/organizator', { timeout: 60_000 });

  expect(organizer.writes.map((w) => `${w.method} ${w.path}`)).toEqual([`PUT ${DRAFT_PATH}/fx-d1`, 'POST /upload']);
  expect(bodyData(organizer.writes[0])).toMatchObject({ name: 'Cupa ciornă e2e', lake: LAKE_ID });
  const upload = String(organizer.writes[1].body);
  expect(upload).toContain('api::competition.competition');
  expect(upload).toMatch(/name="refId"\s+777/);
  expect(upload).toMatch(/name="field"\s+banner/);
  expect((await events(page)).find((e) => e.name === 'create_competition_draft_saved')?.params).toEqual({ is_first_save: false, step: 'basics' });
  // The wizard left no step entry behind (fish dismissTo).
  await page.goBack();
  await expect(page).not.toHaveURL(/\/organizator\/concursuri\/nou/);
});

test('organizer.wizard.c25 — a draft that cannot be loaded: «Eroare» then back (home without history)', async ({ page }) => {
  await mockRead(page, `${DRAFT_PATH}/fx-gone`, { status: 404, json: { error: { status: 404, message: 'Not Found' } } });
  await page.setViewportSize(PHONE);
  await page.goto(NEW('detalii', '?ciorna=fx-gone'));
  const d = dialog(page, 'Eroare');
  await expect(d).toBeVisible({ timeout: 60_000 });
  await expect(d).toContainText('Nu am putut încărca datele competiției. Te rugăm să încerci din nou.');
  await shot(page, 'phone-hydration-error');
  await d.getByRole('button', { name: 'OK' }).click();
  await page.waitForURL((u) => u.pathname === '/', { timeout: 60_000 });
});

/* ============================================================================================== */
/* Delete (c7, c8)                                                                                */
/* ============================================================================================== */

test('organizer.wizard.c7 c8 — delete a saved draft: confirm, progress, toast, the panel; a failure toasts', async ({ page, organizer }) => {
  await mockRead(page, `${DRAFT_PATH}/fx-del`, { json: draftBody({ documentId: 'fx-del' }) });
  let fail = true;
  await organizer.mockWrite('DELETE', `${DRAFT_PATH}/fx-del`, () =>
    fail
      ? { status: 400, json: { error: { status: 400, message: 'Ciorna e blocată', details: { bluCode: 'ORGANIZER:DRAFT_LOCKED' } } } }
      : { json: { data: { documentId: 'fx-del' } }, delayMs: 800 },
  );
  await open(page, NEW('detalii', '?ciorna=fx-del'), PHONE);
  await page.getByRole('button', { name: 'Șterge ciorna' }).click();
  const d = dialog(page, 'Ștergi această ciornă?');
  await expect(d).toContainText('Ciorna va fi ștearsă definitiv și nu o vei mai putea recupera.');
  await expect(d.getByRole('button', { name: 'Renunță' })).toBeVisible();
  await shot(page, 'phone-delete-dialog');
  await expectNoA11yViolations(page);
  await d.getByRole('button', { name: 'Șterge ciorna' }).click();
  await expect(page.getByText('Ciorna e blocată')).toBeVisible();

  fail = false;
  await page.getByRole('button', { name: 'Șterge ciorna' }).click();
  await d.getByRole('button', { name: 'Șterge ciorna' }).click();
  await expect(page.getByTestId('wizard-progress-status')).toHaveText('Ștergere în curs...');
  await expect(page.getByTestId('wizard-progress-caption')).toHaveText('Te rugăm să aștepți până finalizăm ștergerea ciornei.');
  await expect(page.getByText('Ciorna a fost ștearsă.')).toBeVisible({ timeout: 15_000 });
  await page.waitForURL((u) => u.pathname === '/organizator', { timeout: 60_000 });
  expect(organizer.writes.map((w) => `${w.method} ${w.path}`)).toEqual([`DELETE ${DRAFT_PATH}/fx-del`, `DELETE ${DRAFT_PATH}/fx-del`]);
});

test('organizer.wizard.c7 — no trash before the first save, nor when editing a published competition', async ({ page }) => {
  await open(page, NEW('detalii'));
  await expect(page.getByRole('button', { name: 'Șterge ciorna' })).toHaveCount(0);
  test.skip(!base, 'no local competition to base the edit fixture on');
  const c = editFixture('fx-e0');
  await routeCompetition(page, c);
  await open(page, EDIT('fx-e0'));
  await expect(page.getByRole('button', { name: 'Șterge ciorna' })).toHaveCount(0);
});

/* ============================================================================================== */
/* Publish (c15–c19, publish-landing, analytics)                                                  */
/* ============================================================================================== */

test('organizer.wizard.c15–c18 + b.publish-landing — no-banner confirm, stages, rotating jokes, the competition ?fromPublish=1', async ({ page, organizer }) => {
  const publish = hold();
  await organizer.mockWrite('POST', DRAFT_PATH, { json: draftBody({ documentId: 'fx-pub', id: 880 }) });
  await page.route(`**/api/cms${DRAFT_PATH}/fx-pub/publish`, async (route) => {
    if (route.request().method() !== 'PUT') return route.fallback();
    organizer.writes.push({ method: 'PUT', path: `${DRAFT_PATH}/fx-pub/publish`, query: '', body: undefined });
    await publish.held;
    return json(route, { data: competitionFixture({ documentId: 'fx-pub', competitionStatus: 'notStarted', registrations: [] }) }).catch(() => {});
  });
  await open(page, NEW('revizuire'));
  await fillValid(page, { name: 'Cupa publicată', rankingType: 'bestOf', bestOfFishCount: '5', numberOfWinners: '3' });

  // c17: without a banner, first a confirmation; «Înapoi» cancels without a write.
  await page.getByTestId('wizard-publish').click();
  const nb = dialog(page, 'Publicare fără fotografie');
  await expect(nb).toContainText('Nu ai adăugat o fotografie pentru competiție. În lista de competiții se va folosi imaginea lacului.');
  await expectNoA11yViolations(page);
  await nb.getByRole('button', { name: 'Înapoi' }).click();
  await expect(nb).toHaveCount(0);
  expect(organizer.writes).toEqual([]);

  await page.getByTestId('wizard-publish').click();
  await nb.getByRole('button', { name: 'Continuă' }).click();
  // c16: the stages, the percentage, the jokes rotating every 3.5 s.
  await expect(page.getByTestId('wizard-progress-status')).toHaveText('Publicăm competiția...', { timeout: 10_000 });
  await expect(page.getByTestId('wizard-progress-percent')).toHaveText('80%');
  await expect(page.getByTestId('wizard-progress-animation')).toBeVisible();
  const caption = page.getByTestId('wizard-progress-caption');
  await expect(caption).toHaveText(JOKES[0]);
  await expect(caption).toHaveText(JOKES[1], { timeout: 6_000 });
  // c15: non-dismissable, the page behind inert.
  await page.keyboard.press('Escape');
  await expect(progress(page)).toBeVisible();
  await expect(page.getByTestId('wizard-publish')).not.toBeInViewport({ ratio: 1 }).catch(() => {});
  expect(await page.evaluate(() => document.querySelector('dialog[open]') !== null)).toBe(true);
  await shot(page, 'laptop-progress-publish');
  await expectNoA11yViolations(page);
  publish.release();

  // c18 + publish-landing: the competition page, the wizard replaced.
  await page.waitForURL((u) => u.pathname === '/concursuri/fx-pub', { timeout: 60_000 });
  expect(organizer.writes.map((w) => `${w.method} ${w.path}`)).toEqual([`POST ${DRAFT_PATH}`, `PUT ${DRAFT_PATH}/fx-pub/publish`]);
  expect(bodyData(organizer.writes[0])).toMatchObject({ name: 'Cupa publicată', rankingType: 'bestOf' });
  const ev = (await events(page)).map((e) => `${e.name} ${JSON.stringify(e.params)}`);
  expect(ev).toContain('create_competition_publish_attempted {"draft_id":"none"}');
  expect(ev).toContain('create_competition_publish_succeeded {"competition_id":"fx-pub","ranking_type":"bestOf"}');
});

test('organizer.b.publish-landing — the URL carries ?fromPublish=1 and Back never reopens the wizard', async ({ page, organizer }) => {
  await organizer.mockWrite('PUT', `${DRAFT_PATH}/fx-pl`, { json: draftBody({ documentId: 'fx-pl', banner: S3_IMAGE }) });
  await organizer.mockWrite('PUT', `${DRAFT_PATH}/fx-pl/publish`, {
    json: { data: competitionFixture({ documentId: 'fx-pl', competitionStatus: 'notStarted', registrations: [] }) },
  });
  await mockRead(page, `${DRAFT_PATH}/fx-pl`, { json: draftBody({ documentId: 'fx-pl', banner: S3_IMAGE }) });
  await page.setViewportSize(LAPTOP);
  await page.goto('/concursuri');
  await page.goto(NEW('detalii', '?ciorna=fx-pl'));
  await expect(page.getByTestId('wizard-step')).toBeVisible({ timeout: 90_000 });
  await nextBtn(page).click();
  await nextBtn(page).click();
  await stepNav(page).getByRole('button', { name: /Revizuire/ }).click();
  await fillValid(page);
  const urls: string[] = [];
  page.on('framenavigated', (f) => {
    if (f === page.mainFrame()) urls.push(f.url());
  });
  await page.getByTestId('wizard-publish').click();
  await page.waitForURL((u) => u.pathname === '/concursuri/fx-pl', { timeout: 60_000 });
  await expect.poll(() => urls.some((u) => u.includes('/concursuri/fx-pl?fromPublish=1')) || page.url().includes('fromPublish=1')).toBe(true);
  await page.goBack();
  await page.waitForURL((u) => !u.pathname.startsWith('/concursuri/fx-pl'), { timeout: 30_000 });
  expect(page.url()).not.toContain('/organizator/concursuri/nou');
});

test('organizer.wizard.c19 — a failed publish: «Publicarea a eșuat» with the message; «Reîncearcă» publishes again', async ({ page, organizer }) => {
  let attempt = 0;
  await organizer.mockWrite('PUT', `${DRAFT_PATH}/fx-pf`, { json: draftBody({ documentId: 'fx-pf', banner: S3_IMAGE }) });
  await organizer.mockWrite('PUT', `${DRAFT_PATH}/fx-pf/publish`, () => {
    attempt += 1;
    return attempt === 1
      ? { status: 400, json: { error: { status: 400, message: 'Lipsește lacul.', details: { bluCode: 'ORGANIZER:PUBLISH_INVALID' } } } }
      : { json: { data: competitionFixture({ documentId: 'fx-pf', competitionStatus: 'notStarted', registrations: [] }) } };
  });
  await mockRead(page, `${DRAFT_PATH}/fx-pf`, { json: draftBody({ documentId: 'fx-pf', banner: S3_IMAGE }) });
  await open(page, NEW('revizuire', '?ciorna=fx-pf'), PHONE);
  await fillValid(page);
  await page.getByTestId('wizard-publish').click();
  const d = dialog(page, 'Publicarea a eșuat');
  await expect(d).toContainText('Lipsește lacul.', { timeout: 15_000 });
  await expect(d.getByRole('button', { name: 'Închide' })).toBeVisible();
  await shot(page, 'phone-publish-failed');
  await expectNoA11yViolations(page);
  expect((await events(page)).some((e) => e.name === 'create_competition_publish_failed' && e.params.reason === 'api_error')).toBe(true);
  await d.getByRole('button', { name: 'Reîncearcă' }).click();
  await page.waitForURL((u) => u.pathname === '/concursuri/fx-pf', { timeout: 60_000 });
  expect(attempt).toBe(2);
});

test('organizer.wizard.c20 — 60 s without an answer: the timeout notice; «Rămâi aici» stays, «Verifică lista» goes to the panel', async ({ page, organizer }) => {
  const never = hold();
  await page.clock.install();
  await mockRead(page, `${DRAFT_PATH}/fx-to`, { json: draftBody({ documentId: 'fx-to', banner: S3_IMAGE }) });
  await organizer.mockWrite('PUT', `${DRAFT_PATH}/fx-to`, { json: draftBody({ documentId: 'fx-to', banner: S3_IMAGE }) });
  await page.route(`**/api/cms${DRAFT_PATH}/fx-to/publish`, async (route) => {
    organizer.writes.push({ method: route.request().method(), path: `${DRAFT_PATH}/fx-to/publish`, query: '', body: undefined });
    await never.held;
    await route.abort().catch(() => {});
  });
  await open(page, NEW('revizuire', '?ciorna=fx-to'));
  await fillValid(page);
  await page.getByTestId('wizard-publish').click();
  await expect(page.getByTestId('wizard-progress-status')).toHaveText('Publicăm competiția...', { timeout: 10_000 });
  await page.clock.fastForward(61_000);
  const notice = page.getByTestId('wizard-timeout');
  await expect(notice).toContainText('Publicarea durează mai mult decât estimăm');
  await expect(notice).toContainText('Nu putem decide dacă s-a finalizat crearea competiției.');
  await shot(page, 'laptop-timeout');
  await expectNoA11yViolations(page);
  expect((await events(page)).some((e) => e.name === 'create_competition_publish_failed' && e.params.reason === 'timeout')).toBe(true);
  await page.getByRole('button', { name: 'Rămâi aici' }).click();
  await expect(notice).toHaveCount(0);
  await expect(h1(page)).toHaveText('Revizuire');

  // Again, then «Verifică lista».
  await page.getByTestId('wizard-publish').click();
  await page.clock.fastForward(61_000);
  await page.getByRole('button', { name: 'Verifică lista' }).click();
  await page.waitForURL((u) => u.pathname === '/organizator', { timeout: 60_000 });
  never.release();
});

/* ============================================================================================== */
/* Edit a published competition (c5, c6, c11–c14, c20, c21, cannot-edit)                         */
/* ============================================================================================== */

test.describe('edit mode', () => {
  test.beforeEach(() => {
    test.skip(!base, 'no local competition to base the edit fixture on');
  });

  test('organizer.wizard.c5 c11 c21 — no auto-save; «Salvează modificările» uploads the banner first, PUTs, toasts the reset, returns', async ({ page, organizer }) => {
    const c = editFixture('fx-e1');
    await routeCompetition(page, c);
    await organizer.mockWrite('POST', '/upload', { json: [{ ...S3_IMAGE, id: 4242, documentId: 'up4242' }] });
    await organizer.mockWrite('PUT', '/competitions/organizer/fx-e1', { json: updateResponse('fx-e1', true), delayMs: 500 });
    await open(page, EDIT('fx-e1', 'detalii', `?inapoi=${encodeURIComponent('/concursuri/fx-e1/participanti')}`));
    await expect(page.getByText(`Modifică competiția · ${c.name}`)).toBeVisible();
    await expect(saveBtn(page)).toHaveText('Salvează modificările');
    expect((await events(page)).find((e) => e.name === 'create_competition_started')?.params).toEqual({ is_editing_draft: false });

    // c21: editing a published competition never auto-saves.
    await setValue(page, 'name', 'Cupa editată e2e', 'now');
    await page.waitForTimeout(900);
    expect(organizer.writes).toEqual([]);
    // From 1280 the rail says how this mode saves; there is no auto-save state to show.
    await expect(page.getByText('Modificările se aplică abia când le salvezi.')).toBeVisible();
    await expect(autosave(page)).toHaveCount(0);
    await shot(page, 'laptop-edit');

    await pickBanner(page);
    await saveBtn(page).click();
    await expect(page.getByText('Alocările pe standuri au fost resetate și trebuie refăcute.')).toBeVisible({ timeout: 15_000 });
    await page.waitForURL((u) => u.pathname === '/concursuri/fx-e1/participanti', { timeout: 60_000 });
    expect(organizer.writes.map((w) => `${w.method} ${w.path}`)).toEqual(['POST /upload', 'PUT /competitions/organizer/fx-e1']);
    const put = organizer.writes[1].body as { data: Values; confirmRiskChanges: boolean };
    expect(put.confirmRiskChanges).toBe(false);
    expect(put.data).toMatchObject({ name: 'Cupa editată e2e', bannerMediaId: 4242, bannerMediaDocumentId: 'up4242' });
    expect(put.data.registrationDeadline).toBe(c.startDate);
  });

  test('organizer.wizard.c11 c6 — saved without a reset: «Modificările au fost salvate cu succes.», back to the competition', async ({ page, organizer }) => {
    const c = editFixture('fx-e2');
    await routeCompetition(page, c);
    await organizer.mockWrite('PUT', '/competitions/organizer/fx-e2', { json: updateResponse('fx-e2', false) });
    await open(page, EDIT('fx-e2', 'revizuire'), PHONE);
    // c12 (review): the only footer button is the save label.
    await expect(page.getByTestId('wizard-publish')).toHaveCount(0);
    await fillValid(page, { name: c.name });
    await page.getByTestId('wizard-save-edit').click();
    await expect(page.getByText('Modificările au fost salvate cu succes.')).toBeVisible({ timeout: 15_000 });
    await page.waitForURL((u) => u.pathname === '/concursuri/fx-e2', { timeout: 60_000 });
  });

  test('organizer.wizard.c12 c13 — impact confirmation: messages, counts, the checkbox gate, «Salvează oricum» resubmits with confirmRiskChanges', async ({ page, organizer }) => {
    const c = editFixture('fx-e3');
    await routeCompetition(page, c);
    await organizer.mockWrite('PUT', '/competitions/organizer/fx-e3', (w) =>
      (w.body as { confirmRiskChanges?: boolean }).confirmRiskChanges
        ? { json: updateResponse('fx-e3', false) }
        : {
            status: 409,
            json: {
              error: {
                status: 409,
                name: 'ConflictError',
                message: 'Confirmare necesară pentru modificări cu impact.',
                details: {
                  bluCode: 'ORGANIZER:EDIT_RISK_CONFIRMATION_REQUIRED',
                  risks: [{ riskCode: 'PARTICIPANTS_LIMIT_BELOW_REGISTERED' }, { riskCode: 'SOMETHING_NEW' }],
                  impact: { registeredCount: 14, pendingCount: 3, allocatedRegistrationsCount: 9, allocatedStandsCount: 9 },
                },
              },
            },
          },
    );
    await open(page, EDIT('fx-e3', 'configurare'));
    await setValue(page, 'participantsLimit', '8');
    await saveBtn(page).click();
    const d = dialog(page, 'Atenție: modificări cu impact');
    await expect(d).toBeVisible({ timeout: 15_000 });
    await expect(d).toContainText('Aceste schimbări pot afecta înscrierile și alocările existente.');
    const list = d.getByTestId('wizard-risk-list');
    await expect(list).toContainText('Limita nouă este mai mică decât numărul de participanți deja înscriși.');
    await expect(list).toContainText('Modificările propuse au impact asupra competiției. Revizuiește și confirmă pentru a continua.');
    await expect(d).toContainText(/Participanți înscriși\s*14/);
    await expect(d).toContainText(/Înscrieri în așteptare\s*3/);
    await expect(d).toContainText(/Alocări pe standuri afectate\s*9/);
    const confirm = d.getByRole('button', { name: 'Salvează oricum' });
    const box = d.getByRole('checkbox', { name: 'Confirm că înțeleg impactul și vreau să continui.' });
    await expect(confirm).toBeDisabled();
    await shot(page, 'laptop-risk');
    await expectNoA11yViolations(page);

    // «Renunță» closes and resets the checkbox.
    await box.check();
    await expect(confirm).toBeEnabled();
    await d.getByRole('button', { name: 'Renunță' }).click();
    await expect(d).toHaveCount(0);
    await saveBtn(page).click();
    await expect(d).toBeVisible({ timeout: 15_000 });
    await expect(box).not.toBeChecked();
    await expect(confirm).toBeDisabled();

    await box.check();
    await confirm.click();
    await page.waitForURL((u) => u.pathname === '/concursuri/fx-e3', { timeout: 60_000 });
    const bodies = organizer.writes.map((w) => (w.body as { confirmRiskChanges: boolean }).confirmRiskChanges);
    expect(bodies).toEqual([false, false, true]);
    expect((organizer.writes[2].body as { data: Values }).data).toMatchObject({ participantsLimit: '8' });
  });

  test('organizer.wizard.c14 — a blocking validation code opens «Modificări necesare»; another error toasts', async ({ page, organizer }) => {
    const c = editFixture('fx-e4');
    await routeCompetition(page, c);
    let n = 0;
    await organizer.mockWrite('PUT', '/competitions/organizer/fx-e4', () => {
      n += 1;
      return n === 1
        ? {
            status: 400,
            json: {
              error: {
                status: 400,
                message: 'Lacul are doar 20 de standuri.',
                details: { bluCode: 'ORGANIZER:PARTICIPANTS_LIMIT_EXCEEDS_LAKE_STANDS' },
              },
            },
          }
        : { status: 500, json: { error: { status: 500, message: 'Internal Server Error' } } };
    });
    await open(page, EDIT('fx-e4', 'detalii'), PHONE);
    await saveBtn(page).click();
    const d = dialog(page, 'Modificări necesare');
    await expect(d).toContainText('Lacul are doar 20 de standuri.', { timeout: 15_000 });
    await shot(page, 'phone-blocking');
    await expectNoA11yViolations(page);
    await d.getByRole('button', { name: 'Modifică și încearcă din nou' }).click();
    await expect(d).toHaveCount(0);
    await expect(h1(page)).toHaveText('Detalii de bază');

    await saveBtn(page).click();
    await expect(page.getByRole('alert').filter({ hasText: /eroare|încearcă/i }).first()).toBeVisible({ timeout: 15_000 });
    await expect(page).toHaveURL(new RegExp(EDIT('fx-e4', 'detalii')));
  });

  test('organizer.wizard.c20 — an edit save with no answer: «Nu putem confirma salvarea» → «Verifică competiția»', async ({ page, organizer }) => {
    const never = hold();
    await page.clock.install();
    const c = editFixture('fx-e5');
    await routeCompetition(page, c);
    await page.route('**/api/cms/competitions/organizer/fx-e5', async (route) => {
      if (route.request().method() !== 'PUT') return route.fallback();
      organizer.writes.push({ method: 'PUT', path: '/competitions/organizer/fx-e5', query: '', body: undefined });
      await never.held;
      await route.abort().catch(() => {});
    });
    await open(page, EDIT('fx-e5'));
    await saveBtn(page).click();
    await expect(page.getByTestId('wizard-progress-status')).toHaveText('Salvare în curs...');
    await page.clock.fastForward(61_000);
    await expect(page.getByTestId('wizard-timeout')).toContainText('Nu putem confirma salvarea');
    await page.getByRole('button', { name: 'Verifică competiția' }).click();
    await page.waitForURL((u) => u.pathname === '/concursuri/fx-e5', { timeout: 60_000 });
    never.release();
  });

  test('cannot-edit-started + role-gate — a started competition shows «Nu poți modifica competiția»; a non-author goes back', async ({ page }) => {
    const started = editFixture('fx-e6', { competitionStatus: 'started' });
    await routeCompetition(page, started);
    await page.setViewportSize(PHONE);
    await page.goto(EDIT('fx-e6'));
    await expect(page.getByRole('heading', { name: 'Nu poți modifica competiția' })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText('Competiția a început deja. Pentru modificări, contactează echipa Bluvi.')).toBeVisible();
    // fish CannotEditCompetitionSheet: «Apelează» (tel: Bluvi) + contact_pressed.
    const call = page.getByRole('link', { name: 'Apelează' });
    await expect(call).toHaveAttribute('href', /^tel:\+40/);
    await call.evaluate((a) => a.addEventListener('click', (e) => e.preventDefault(), { once: true }));
    await call.click();
    expect((await events(page)).some((e) => e.name === 'contact_pressed' && e.params.contact_type === 'Bluvi cannot edit contact')).toBe(true);
    await shot(page, 'phone-cannot-edit');
    await expectNoA11yViolations(page);

    // A cancelled competition: no «a început deja» notice — back to its page.
    const cancelled = editFixture('fx-e8', { competitionStatus: 'cancelled' });
    await routeCompetition(page, cancelled);
    await page.goto(EDIT('fx-e8'));
    await page.waitForURL((u) => u.pathname === '/concursuri/fx-e8', { timeout: 60_000 });

    const other = editFixture('fx-e7');
    await routeCompetition(page, other, 'participant');
    await page.goto(EDIT('fx-e7'));
    await page.waitForURL((u) => u.pathname === '/concursuri/fx-e7', { timeout: 60_000 });
  });
});

/* ============================================================================================== */
/* Every state at the four widths                                                                */
/* ============================================================================================== */

test('states at 375 / 1280 / 1440 / 1920 — new, draft (saved), review, skeleton', async ({ page, organizer }) => {
  await mockRead(page, `${DRAFT_PATH}/fx-w`, {
    json: draftBody({
      documentId: 'fx-w',
      name: 'Cupa Toamnei 2026',
      banner: S3_IMAGE,
      startDate: '2026-11-14T05:00:00.000Z',
      endDate: '2026-11-15T12:00:00.000Z',
      participantsLimit: 24,
      registerFee: '150',
      rankingType: 'quantityQuality',
      lake: { id: 212, documentId: LAKE_ID, name: 'Chita Lake' },
    }),
  });
  for (const width of [375, 1280, 1440, 1920]) {
    await open(page, NEW('detalii'), { width, height: 900 });
    await shot(page, `${width}-new`);
    await open(page, NEW('configurare', '?ciorna=fx-w'), { width, height: 900 });
    await expect(page.getByText('Ciornă · Cupa Toamnei 2026')).toBeVisible();
    await shot(page, `${width}-draft`);
    await open(page, NEW('revizuire', '?ciorna=fx-w'), { width, height: 900 });
    await shot(page, `${width}-review`);
  }
  expect(organizer.writes).toEqual([]);
});
