import { mkdirSync } from 'node:fs';
import type { Locator, Page, Request, Route } from '@playwright/test';
import { expectNoA11yViolations } from './helpers/a11y';
import { BASE_URL } from './helpers/base-url';
import { collectConsoleErrors } from './helpers/console';
import { S3_IMAGE, expect, test, type OrganizerHarness, type RecordedWrite } from './helpers/fake-organizer';
import { CMS, qaJwt, signIn } from './helpers/session';

/*
 * Cântar — one weighing (parity organizer.scale-weighing c1–c21; fish app/(app)/scale/[competitionId]/add.tsx,
 * AddCatchSheet, SignatureSheet, DisplaySignaturesSheet, ReopenWeighingSheet).
 *
 * READS hit the local CMS: «Andrew 1» (individual, guests), stand nk68… (Sector A) and its 2nd weighing
 * (finished, three Crap catches); the competition has two species (Crap, Crap Oglinda). The NC «CN Test»
 * supplies the national label + club. A state the local data does not have (an open weighing, a role,
 * revisions, signatures, no catches, a failure) is made by editing the real read in page.route — the
 * statute is served per test.
 * WRITES NEVER reach the CMS (add catch, delete, media, signatures, end, reopen push to real people):
 * the `test` of helpers/fake-organizer aborts and fails on any un-mocked non-GET; every write here is
 * route-mocked and its method, path and body asserted.
 */

test.describe.configure({ timeout: 180_000, retries: 1 });

const C = process.env.E2E_WEIGHING_COMPETITION ?? 'i8kzbi5k51vmbyq75dmyez3d';
const S = process.env.E2E_WEIGHING_STAND ?? 'nk68e93zjbs6sme020znr4pi';
const W = process.env.E2E_WEIGHING ?? 'wtfhthttpn0v4thz59c4yo6n';
const NC = process.env.E2E_SCALE_NC ?? 'z7rvhm55ziyr0tbblqwjp39q';

const PHONE = { width: 375, height: 812 };
const WIDTHS = [375, 1280, 1440, 1920];
const PAGE = `/concursuri/${C}/cantar/${S}/${W}`;
const HISTORY = `/concursuri/${C}/cantar/${S}`;
const REVISIONS = `${PAGE}/modificari`;

/**
 * Signatures as fish uploads them (SignatureSheet + helpers/saveSvgToFile): an SVG, black stroke on a
 * TRANSPARENT background. Served from a fake host (route-fulfilled in `open`).
 */
const SIG_HOST = 'https://e2e-signatures.test';
const SIG_REFEREE = `${SIG_HOST}/refereeSignature.svg`;
const SIG_WITNESS = `${SIG_HOST}/witnessSignature.svg`;
const SIG_SVG = (d: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="350" height="350" viewBox="0 0 350 350"><path d="${d}" stroke="#000000" stroke-width="2.5" fill="none" stroke-linecap="round"/></svg>`;

const weighingPath = (id: string) => `/api/cms/feed/weighings/${id}`;
const statutePath = (id: string) => `/api/cms/user/profile/competition/${id}/statute`;
const allocationsPath = (id: string) => `/api/cms/competitions/${id}/allocated-participants`;
const byStandPath = '/api/cms/feed/weighings/by-stand';
const competitionPath = (id: string) => `/api/cms/feed/competitions/${id}`;

type Catch = { id: number; documentId: string; weight: number; fishType: { Name: string } | null; media: { url: string }[] };
type Weighing = {
  id: number;
  documentId: string;
  weighingType: string;
  weighingStatus: 'started' | 'finished';
  numberOfRevisions: number;
  catches: Catch[];
  refereeSignature: { url: string } | null;
  witnessSignature: { url: string } | null;
};
type Species = { documentId: string; Name: string };
type Role = 'author' | 'referee' | 'participant' | null;

let jwt = '';
let real: Weighing;
let species: Species[];
let alloc: { participants: { name: string }[]; guestName: string; teamName: string; sectorName: string };
let place = 0;

test.beforeAll(async ({ request }) => {
  jwt = await qaJwt(request);
  mkdirSync('.shots', { recursive: true });
  const auth = { headers: { Authorization: `Bearer ${jwt}` } };
  real = (await (await request.get(`${CMS}/feed/weighings/${W}`)).json()) as Weighing;
  expect(real.weighingStatus, 'the fixture weighing must be finished').toBe('finished');
  expect(real.catches.length).toBeGreaterThanOrEqual(2);
  species = ((await (await request.get(`${CMS}/feed/competitions/${C}/fish-species`)).json()).data.fishSpecies ?? []) as Species[];
  expect(species.length, 'the fixture competition needs two species').toBeGreaterThanOrEqual(2);
  alloc = (await (await request.get(`${CMS}/competitions/${C}/allocated-participants`, auth)).json()).data[S];
  const list = (await (await request.get(`${CMS}/feed/weighings/by-stand?competitionId=${C}&standId=${S}`, auth)).json()).data as { documentId: string }[];
  place = list.findIndex((w) => w.documentId === W) + 1;
  expect(place).toBeGreaterThan(0);
});

// A refetch still in flight when a test ends must not fail it (its route handler's fetch is cut).
test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
});

const path = (url: string) => new URL(url).pathname;
const isCms = (r: Request) => path(r.url()).startsWith('/api/cms/');
const kg = (n: number) => n.toFixed(3).replace('.', ',');
const total = (catches: { weight: number }[]) => kg(catches.reduce((a, c) => a + c.weight, 0));

type Watch = { reads: string[] };
type Served = { status?: Weighing['weighingStatus']; revisions?: number; catches?: Catch[]; signatures?: boolean; fail?: boolean; hold?: Promise<void> };

/**
 * Signs in, serves the statute, edits the weighing read with `served` (a live object: a test changes
 * it to make the «server» answer differently on the next refetch), watches the CMS reads.
 */
async function open(page: Page, { role = 'referee', served = {}, at = PAGE, setup }: { role?: Role; served?: Served; at?: string; setup?: (p: Page) => Promise<unknown> } = {}) {
  await signIn(page.context(), jwt);
  const watch: Watch = { reads: [] };
  page.on('request', (r) => {
    if (isCms(r) && r.method() === 'GET') watch.reads.push(path(r.url()));
  });
  const errors = collectConsoleErrors(page, {
    // The failures this spec serves on purpose (500 / 400 on a read or a mocked write) are logged by the browser.
    ignore: /Failed to load resource: the server responded with a status of (500|400)/,
  });
  await page.route(
    (url) => url.pathname.startsWith('/api/cms/user/profile/competition/') && url.pathname.endsWith('/statute'),
    (route) => route.fulfill({ json: { userRole: role, isReferee: false, isParticipant: false } }),
  );
  await page.route(
    (url) => url.pathname === weighingPath(W),
    async (route: Route) => {
      if (served.hold) await served.hold;
      if (served.fail) return route.fulfill({ status: 500, json: { data: null, error: { status: 500, message: 'boom' } } });
      const res = await route.fetch();
      const body = (await res.json()) as Weighing;
      await route.fulfill({
        response: res,
        json: {
          ...body,
          weighingStatus: served.status ?? body.weighingStatus,
          numberOfRevisions: served.revisions ?? body.numberOfRevisions,
          catches: served.catches ?? body.catches,
          refereeSignature: served.signatures ? { url: SIG_REFEREE } : body.refereeSignature,
          witnessSignature: served.signatures ? { url: SIG_WITNESS } : body.witnessSignature,
        },
      });
    },
  );
  await page.route(`${SIG_HOST}/**`, (route) =>
    route.fulfill({
      contentType: 'image/svg+xml',
      body: SIG_SVG(route.request().url().includes('referee') ? 'M40 220 Q 110 60 180 200 T 320 160' : 'M30 150 C 90 260, 160 40, 320 210'),
    }),
  );
  if (setup) await setup(page);
  await page.goto(at);
  return { watch, errors };
}

const h1 = (page: Page) => page.getByRole('heading', { level: 1, name: /^Cântar/ });

/** Loaded (one reload if the shared dev server's Fast Refresh strands the first load, as concurs-cantar.spec). */
async function loaded(page: Page) {
  const table = page.getByTestId('catches').or(page.getByTestId('catches-empty'));
  const ok = await table.waitFor({ timeout: 15_000 }).then(
    () => true,
    () => false,
  );
  if (!ok) await page.reload();
  await expect(table).toBeVisible({ timeout: 30_000 });
}

async function shoot(page: Page, name: string, widths = WIDTHS) {
  const size = page.viewportSize() ?? PHONE;
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(200);
    await page.screenshot({ path: `.shots/cantarire-${name}-${width}.png`, fullPage: true });
  }
  await page.setViewportSize(size);
}

const actionBar = (page: Page) => page.getByRole('button', { name: 'Finalizează cântarul' });
const toast = (page: Page, text: string | RegExp) => page.getByText(text).first();
const cmsError = (status: number, message: string) => ({
  status,
  json: { data: null, error: { status, name: 'ApplicationError', message, details: { bluCode: 'E2E' } } },
});

/** A species chip's radio (exact: «Crap» vs «Crap Oglinda»). */
const radio = (scope: Locator, name: string) => scope.getByRole('radio', { name, exact: true });
/** Picks a species the way a person does: a click on its chip (the radio itself is sr-only). */
const pick = (scope: Locator, name: string) => scope.locator('label').getByText(name, { exact: true }).click();

/**
 * A write mock whose answer may wait (the harness's mockWrite does not await `respond`): recorded in
 * `organizer.writes` like the harness's own, registered after its guard so it runs first.
 */
async function mockWriteAsync(
  page: Page,
  organizer: OrganizerHarness,
  method: string,
  pathname: string,
  respond: (w: RecordedWrite) => Promise<{ status?: number; json?: unknown }> | { status?: number; json?: unknown },
) {
  await page.route('**/api/cms/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname.slice('/api/cms'.length);
    if (req.method() !== method || p !== pathname) return route.fallback();
    let body: unknown = req.postData() ?? undefined;
    try {
      body = body === undefined ? undefined : JSON.parse(body as string);
    } catch {
      /* multipart: kept as text */
    }
    const w: RecordedWrite = { method, path: p, query: url.search, body };
    organizer.writes.push(w);
    const r = await respond(w);
    return route.fulfill({ status: r.status ?? 200, contentType: 'application/json', body: JSON.stringify(r.json ?? {}) });
  });
}

/**
 * c19: serves the competition read with `over` (the local fixture is `completed`; a reopen is offered
 * only on a started one) and, when given, the stand's list edited by `stand`.
 */
async function serveCompetition(page: Page, over: Record<string, unknown>, stand?: (list: Record<string, unknown>[]) => Record<string, unknown>[]) {
  await page.route(
    (url) => url.pathname === competitionPath(C),
    async (route) => {
      const res = await route.fetch();
      const body = await res.json();
      await route.fulfill({ response: res, json: { ...body, data: { ...body.data, ...over } } });
    },
  );
  if (stand)
    await page.route(
      (url) => url.pathname === byStandPath,
      async (route) => {
        const res = await route.fetch();
        const body = await res.json();
        await route.fulfill({ response: res, json: { ...body, data: stand(body.data) } });
      },
    );
}

/** A PNG the file input accepts (1×1). */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);
const photo = (name: string) => ({ name, mimeType: 'image/png', buffer: PNG });

/** Draws a stroke on the open signature pad with the mouse (pointer events). */
async function sign(page: Page) {
  const pad = page.getByTestId('signature-pad');
  const box = (await pad.boundingBox())!;
  await page.mouse.move(box.x + 30, box.y + 40);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(box.x + 30 + i * 20, box.y + 40 + (i % 2) * 30);
  await page.mouse.up();
}

/* ------------------------------------------------------------------ */

test('signed out → sign-in with the return path (organizer.b.signed-out-gate)', async ({ request }) => {
  const res = await request.get(`${BASE_URL}${PAGE}`, { maxRedirects: 0 });
  expect(res.status()).toBe(307);
  expect(res.headers().location).toContain(`/intra?next=${encodeURIComponent(PAGE)}`);
});

test('organizer.scale-weighing.c1/c2/c4 — loading, then «Cântar N», «Total», the stand card, the catches newest first; noindex', async ({ page }) => {
  await page.setViewportSize(PHONE);
  let release!: () => void;
  const hold = new Promise<void>((r) => (release = r));
  const { errors } = await open(page, { role: 'participant', served: { hold } });
  await expect(page.locator('section[aria-busy="true"]')).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Se încarcă cântarul…' })).toBeAttached();
  await shoot(page, 'loading');
  release();
  await loaded(page);
  await expect(h1(page)).toHaveText(`Cântar ${place}`);
  await expect(page.getByTestId('weighing-total')).toHaveText(`Total: ${total(real.catches)} kg`);
  // c2: «Sector A, Stand N» + the angler(s) as bullets (fish BulletPoint).
  const card = page.locator('main').getByText(/^Sector \w+, Stand /).first();
  await expect(card).toHaveText(new RegExp(`^Sector ${alloc.sectorName}, Stand \\S+$`));
  for (const p of alloc.participants) await expect(page.getByRole('listitem').filter({ hasText: p.name }).first()).toBeVisible();
  // c4: the CMS's order (newest first), «n.», species, «x,xxx kg».
  const rows = page.getByTestId('catch-row');
  await expect(rows).toHaveCount(real.catches.length);
  for (const [i, c] of real.catches.entries()) {
    await expect(rows.nth(i)).toContainText(`${i + 1}.`);
    await expect(rows.nth(i)).toContainText(c.fishType?.Name ?? '');
    await expect(rows.nth(i)).toContainText(`${kg(c.weight)}kg`);
  }
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await expect(page.getByRole('link', { name: 'Înapoi la cântăriri' })).toHaveAttribute('href', HISTORY);
  // A participant on a finished weighing: «Vezi semnături» only (c17), no catch actions (c5).
  await expect(page.getByRole('button', { name: 'Vezi semnături' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Șterge captura/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Adaugă captură' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Redeschide cântarul' })).toHaveCount(0);
  await shoot(page, 'finished-participant');
  await expectNoA11yViolations(page);
  expect(errors).toEqual([]);
});

test('organizer.scale-weighing.c1 — an error offers «Încearcă din nou», which refetches the weighing', async ({ page }) => {
  await page.setViewportSize(PHONE);
  const served: Served = { fail: true };
  const { watch } = await open(page, { served });
  const gate = page.getByRole('alert');
  await expect(gate.getByRole('heading', { name: 'Serverul nu răspunde' })).toBeVisible({ timeout: 30_000 });
  await shoot(page, 'error');
  await expectNoA11yViolations(page);
  served.fail = false;
  const before = watch.reads.filter((r) => r === weighingPath(W)).length;
  await page.getByRole('button', { name: 'Încearcă din nou' }).click();
  await loaded(page);
  expect(watch.reads.filter((r) => r === weighingPath(W)).length).toBeGreaterThan(before);
});

test('organizer.scale-weighing.c2 — national championship: «Stand A1(N)» and the club; guests and teams', async ({ page, request }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const auth = { headers: { Authorization: `Bearer ${jwt}` } };
  const allocations = (await (await request.get(`${CMS}/competitions/${NC}/allocated-participants`, auth)).json()).data as Record<
    string,
    { clubName?: string; sectorName: string; participants: { name: string }[] } | null
  >;
  const summary = (await (await request.get(`${CMS}/competitions/${NC}/weighings-summary`, auth)).json()).data as { standId: string }[];
  const standId = summary.map((s) => s.standId).find((id) => allocations[id]?.clubName);
  test.skip(!standId, 'no NC stand with a club and a weighing in the local data');
  const list = (await (await request.get(`${CMS}/feed/weighings/by-stand?competitionId=${NC}&standId=${standId}`, auth)).json()).data as { documentId: string }[];
  const a = allocations[standId!]!;
  await signIn(page.context(), jwt);
  // The draw position is served (the local data has none): the national format shows it.
  await page.route(
    (url) => url.pathname === weighingPath(list[0].documentId),
    async (route) => {
      const res = await route.fetch();
      const body = await res.json();
      await route.fulfill({ response: res, json: { ...body, stand: { ...body.stand, sectorDrawPosition: 2 } } });
    },
  );
  await page.goto(`/concursuri/${NC}/cantar/${standId}/${list[0].documentId}`);
  await loaded(page);
  const aside = page.getByRole('complementary', { name: 'Detalii' });
  await expect(aside.getByText(new RegExp(`^Stand ${a.sectorName}2\\(\\S+\\)$`))).toBeVisible();
  await expect(aside.getByText(a.clubName!, { exact: true })).toBeVisible();
  await shoot(page, 'nc');

  // A guest stand (the guest as the bullet) on the guests competition.
  const guests = (await (await request.get(`${CMS}/competitions/${C}/allocated-participants`, auth)).json()).data as Record<string, { guestName: string } | null>;
  const guestStand = Object.entries(guests).find(([, v]) => v?.guestName)?.[0];
  if (guestStand) {
    await page.route(
      (url) => url.pathname === allocationsPath(C),
      async (route) => {
        const res = await route.fetch();
        const body = await res.json();
        await route.fulfill({ response: res, json: { data: { ...body.data, [S]: { ...body.data[guestStand], teamName: 'Crapii Veseli' } } } });
      },
    );
    await page.goto(PAGE);
    await loaded(page);
    await expect(aside.getByText('Echipa Crapii Veseli')).toBeVisible();
    await expect(aside.getByRole('listitem').filter({ hasText: guests[guestStand]!.guestName })).toBeVisible();
  }
});

test('organizer.scale-weighing.c3/c18 — revisions: the notice links to the history; finished → «Vezi istoric»', async ({ page }) => {
  await page.setViewportSize(PHONE);
  const served: Served = { revisions: 1 };
  await open(page, { role: 'participant', served });
  await loaded(page);
  const link = page.getByTestId('revisions-link');
  await expect(link).toHaveText('Acest cântar a avut o modificare.');
  await expect(link).toHaveAttribute('href', REVISIONS);
  await expect(page.getByRole('link', { name: 'Vezi istoric' })).toHaveAttribute('href', REVISIONS);
  served.revisions = 3;
  await page.getByTestId('management-refresh').click();
  await expect(link).toHaveText('Acest cântar a avut 3 modificări.');
  await shoot(page, 'revisions');
  // An open weighing with revisions keeps the notice, not «Vezi istoric» (fish: finished only).
  served.status = 'started';
  await page.getByTestId('management-refresh').click();
  await expect(page.getByRole('link', { name: 'Vezi istoric' })).toHaveCount(0);
  await expect(link).toBeVisible();
});

test('organizer.scale-weighing.c4 — no catches: «Acest cântar nu conține nicio captură.»', async ({ page }) => {
  await page.setViewportSize(PHONE);
  await open(page, { served: { status: 'started', catches: [] } });
  await loaded(page);
  await expect(page.getByTestId('catches-empty')).toHaveText('Acest cântar nu conține nicio captură.');
  await expect(page.getByTestId('weighing-total')).toHaveText('Total: 0,000 kg');
  await shoot(page, 'empty');
});

test('organizer.scale-weighing.c5 — actions only for author / referee while open', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const role: { value: Role } = { value: 'participant' };
  await signIn(page.context(), jwt);
  await page.route(
    (url) => url.pathname === statutePath(C),
    (route) => route.fulfill({ json: { userRole: role.value, isReferee: false, isParticipant: role.value === 'participant' } }),
  );
  await page.route(
    (url) => url.pathname === weighingPath(W),
    async (route) => {
      const res = await route.fetch();
      await route.fulfill({ response: res, json: { ...(await res.json()), weighingStatus: 'started' } });
    },
  );
  await page.goto(PAGE);
  await loaded(page);
  await expect(page.getByRole('button', { name: 'Adaugă captură' })).toHaveCount(0);
  await expect(actionBar(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Șterge captura/ })).toHaveCount(0);
  await shoot(page, 'open-read-only');
  for (const r of ['referee', 'author'] as const) {
    role.value = r;
    await page.reload();
    await loaded(page);
    await expect(page.getByRole('button', { name: 'Adaugă captură' })).toBeVisible();
    await expect(actionBar(page)).toBeVisible();
    await expect(page.getByRole('button', { name: /^Șterge captura/ })).toHaveCount(real.catches.length);
  }
  await shoot(page, 'open-actions');
  await expectNoA11yViolations(page);
});

test('organizer.scale-weighing.c6 — delete asks first; «Închide» keeps it; «Șterge» DELETEs, toasts, refetches', async ({ page, organizer }) => {
  await page.setViewportSize(PHONE);
  const served: Served = { status: 'started' };
  await organizer.mockWrite('DELETE', /^\/catches\/[^/]+$/, () =>
    organizer.writes.length === 1 ? { json: { data: { statusCode: 200, message: 'ok' } } } : cmsError(400, 'Captura nu mai există.'),
  );
  const { watch, errors } = await open(page, { served });
  await loaded(page);
  const first = real.catches[0];
  await page.getByRole('button', { name: `Șterge captura 1: ${first.fishType?.Name}, ${kg(first.weight)} kg` }).click();
  const dialog = page.getByRole('alertdialog', { name: 'Ești sigur că vrei să ștergi captura?' });
  await expect(dialog).toContainText('Această captură va fi eliminată și nu va mai putea fi recuperată.');
  await shoot(page, 'delete-confirm', [375, 1280]);
  await dialog.getByRole('button', { name: 'Închide' }).click();
  await expect(dialog).toBeHidden();
  expect(organizer.writes).toEqual([]);

  const weighingReads = watch.reads.filter((r) => r === weighingPath(W)).length;
  const standReads = watch.reads.filter((r) => r === byStandPath).length;
  served.catches = real.catches.slice(1);
  await page.getByRole('button', { name: /^Șterge captura 1:/ }).click();
  await dialog.getByRole('button', { name: 'Șterge' }).click();
  await expect(toast(page, 'Captură ștearsă cu succes!')).toBeVisible();
  expect(organizer.writes).toEqual([{ method: 'DELETE', path: `/catches/${first.documentId}`, query: '', body: undefined }]);
  await expect(page.getByTestId('catch-row')).toHaveCount(real.catches.length - 1);
  await expect.poll(() => watch.reads.filter((r) => r === weighingPath(W)).length).toBeGreaterThan(weighingReads);
  await expect.poll(() => watch.reads.filter((r) => r === byStandPath).length).toBeGreaterThan(standReads);

  // An error toasts the server's message.
  await page.getByRole('button', { name: /^Șterge captura 1:/ }).click();
  await dialog.getByRole('button', { name: 'Șterge' }).click();
  await expect(toast(page, 'Captura nu mai există.')).toBeVisible();
  expect(errors).toEqual([]);
});

test('organizer.scale-weighing.c7–c10 — the add-catch dialog: title + close, validation, «Pești» split, species chips + last used', async ({ page }) => {
  await page.setViewportSize(PHONE);
  await open(page, {
    served: { status: 'started' },
    setup: (p) => p.addInitScript(() => window.localStorage.removeItem('bluvi:lastFishSpeciesId')),
  });
  await loaded(page);
  // Keyboard: Tab to «Adaugă captură», Enter opens it on the weight field; Escape closes.
  await page.getByRole('button', { name: 'Adaugă captură' }).focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Adaugă captură' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('Greutate')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await page.getByRole('button', { name: 'Adaugă captură' }).click();
  await expect(dialog.getByRole('heading', { name: 'Adaugă captură' })).toBeVisible();
  // c10: the competition's species as chips.
  for (const s of species) await expect(radio(dialog, s.Name)).toBeVisible();
  await shoot(page, 'add-empty', [375, 1280]);
  // c8/c10: empty submit — weight and species required.
  await dialog.getByRole('button', { name: 'Finalizează' }).click();
  await expect(dialog.getByText('Acest câmp este obligatoriu')).toHaveCount(2);
  await shoot(page, 'add-errors', [375, 1280]);
  const weight = dialog.getByLabel('Greutate');
  await weight.fill('0');
  await expect(dialog.getByText('Greutatea trebuie să fie mai mare decât 0')).toBeVisible();
  await weight.fill('60,5');
  await expect(dialog.getByText(/Ai introdus o valoare prea mare ca să fie adevărată!/)).toBeVisible();
  await weight.fill('60');
  await expect(dialog.getByText(/Ai introdus o valoare prea mare/)).toHaveCount(0);
  // c9: quantity 1–20.
  const qty = dialog.getByLabel('Cantitate');
  await expect(qty).toHaveValue('1');
  await qty.fill('21');
  await expect(dialog.getByText('Max 20')).toBeVisible();
  await qty.fill('0');
  await expect(dialog.getByText('Cantitatea trebuie să fie mai mare ca 1')).toBeVisible();
  await qty.fill('3');
  await weight.fill('10,000');
  const split = dialog.getByTestId('add-catch-split');
  await expect(split.getByText('Pești')).toBeVisible();
  const parts = (await split.getByRole('listitem').allTextContents()).map((t) => Number(t.replace(/\s*kg$/, '').replace(',', '.')));
  expect(parts).toHaveLength(3);
  expect(parts.reduce((a, b) => a + b, 0)).toBeCloseTo(10, 3);
  for (const p of parts) expect(Math.round(p * 1000) % 25).toBe(0);
  // The 0.025 kg steps change the total: said under the split.
  await qty.fill('2');
  await weight.fill('4,26');
  await expect(dialog.getByTestId('add-catch-split-drift')).toHaveText('Pe pești, în pași de 0,025\u00a0kg: total 4,250\u00a0kg.');
  // Too little to split (parts of 0 kg): refused (deliberate break from fish).
  await qty.fill('20');
  await weight.fill('0,05');
  await expect(dialog.getByText('Greutatea este prea mică pentru 20 de pești')).toBeVisible();
  await weight.fill('10,000');
  await qty.fill('1');
  await expect(split).toHaveCount(0);
  await qty.fill('3');
  await pick(dialog, species[1].Name);
  await shoot(page, 'add-split', [375, 1280]);
  await expectNoA11yViolations(page);

  // c10: the last used species comes back on open (fish restoreLastFishSpecies).
  await page.evaluate((id) => window.localStorage.setItem('bluvi:lastFishSpeciesId', id), species[1].documentId);
  await dialog.getByRole('button', { name: 'Închide' }).click();
  await page.getByRole('button', { name: 'Adaugă captură' }).click();
  await expect(radio(dialog, species[1].Name)).toBeChecked();
  await expect(dialog.getByLabel('Greutate')).toHaveValue('');
  // A stored id the competition no longer has is ignored.
  await page.evaluate(() => window.localStorage.setItem('bluvi:lastFishSpeciesId', 'nu-exista'));
  await dialog.getByRole('button', { name: 'Închide' }).click();
  await page.getByRole('button', { name: 'Adaugă captură' }).click();
  for (const s of species) await expect(radio(dialog, s.Name)).not.toBeChecked();
});

test('organizer.scale-weighing.c11 — «Adaugă media»: camera or file, up to 3, each removable, off at 3', async ({ page }) => {
  await page.setViewportSize(PHONE);
  await open(page, { served: { status: 'started' } });
  await loaded(page);
  await page.getByRole('button', { name: 'Adaugă captură' }).click();
  const dialog = page.getByRole('dialog', { name: 'Adaugă captură' });
  const input = dialog.getByTestId('add-catch-file');
  // No `capture`: a phone offers the camera AND the gallery/files.
  await expect(input).toHaveAttribute('accept', 'image/*');
  await expect(input).not.toHaveAttribute('capture');
  await input.setInputFiles([photo('a.png'), photo('b.png')]);
  await expect(dialog.getByText('Fișiere media')).toBeVisible();
  await expect(dialog.getByText('(max. 3)')).toBeVisible();
  await input.setInputFiles([photo('c.png'), photo('d.png')]);
  await expect(dialog.getByTestId('add-catch-photos').getByRole('listitem')).toHaveCount(3);
  await expect(dialog.getByRole('button', { name: 'Adaugă media' })).toBeDisabled();
  await shoot(page, 'add-photos', [375, 1280]);
  await dialog.getByRole('button', { name: 'Elimină fotografia 2' }).click();
  await expect(dialog.getByTestId('add-catch-photos').getByRole('listitem')).toHaveCount(2);
  await expect(dialog.getByRole('button', { name: 'Adaugă media' })).toBeEnabled();
});

test('organizer.scale-weighing.c12/c13/c14 — «Finalizează»: optimistic rows, «Se adaugă captura...», finalize refused meanwhile, photos to the first catch, toast', async ({ page, organizer }) => {
  await page.setViewportSize(PHONE);
  const served: Served = { status: 'started' };
  let release!: () => void;
  const hold = new Promise<void>((r) => (release = r));
  const created = [{ id: 990001, documentId: 'e2ecatch1', weight: 4.25 }];
  await mockWriteAsync(page, organizer, 'POST', `/weighings/${W}/catch`, async () => {
    await hold;
    // The «server» now has the catch: the refetch after the write shows it.
    served.catches = [{ id: 990001, documentId: 'e2ecatch1', weight: 4.25, fishType: { Name: species[0].Name }, media: [{ url: S3_IMAGE.url }] }, ...real.catches];
    return { json: created };
  });
  await organizer.mockWrite('POST', '/upload', { json: [{ id: 77, url: S3_IMAGE.url }] });
  const { errors } = await open(page, { served });
  await loaded(page);
  await page.getByRole('button', { name: 'Adaugă captură' }).click();
  const dialog = page.getByRole('dialog', { name: 'Adaugă captură' });
  await dialog.getByLabel('Greutate').fill('4,25');
  await pick(dialog, species[0].Name);
  await dialog.getByTestId('add-catch-file').setInputFiles([photo('peste.png')]);
  await dialog.getByRole('button', { name: 'Finalizează' }).click();
  await expect(dialog.getByText('Se adaugă captura...')).toBeVisible();
  await shoot(page, 'add-submitting', [375, 1280]);
  // Behind it the row is already there (optimistic), without a delete.
  const optimistic = page.locator('[data-testid="catch-row"][data-optimistic]');
  await expect(optimistic).toHaveCount(1);
  await expect(optimistic).toContainText(species[0].Name);
  await expect(optimistic).toContainText('4,250kg');
  await expect(optimistic.getByRole('button')).toHaveCount(0);
  await expect(page.getByTestId('weighing-total')).toHaveText(`Total: ${kg(real.catches.reduce((a, c) => a + c.weight, 0) + 4.25)} kg`);
  // c14: the dialog can be closed while it adds (fish's sheet swipes away); «Finalizează cântarul» is
  // then busy and refuses while the catch is unconfirmed.
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(actionBar(page)).toHaveAttribute('aria-busy', 'true');
  await actionBar(page).click();
  await expect(toast(page, 'Așteaptă confirmarea capturilor înainte de a finaliza cântarul.')).toBeVisible();
  await expect(page.getByRole('dialog', { name: /Semnătură arbitru/ })).toHaveCount(0);
  await shoot(page, 'optimistic', [375, 1280]);
  release();
  await expect(toast(page, 'Captură adăugată cu succes!')).toBeVisible();
  await expect(page.locator('[data-testid="catch-row"][data-optimistic]')).toHaveCount(0);
  await expect(page.getByTestId('catch-row').first()).toContainText('4,250kg');
  await expect(actionBar(page)).not.toHaveAttribute('aria-busy', 'true');
  const [add, upload] = organizer.writes;
  expect(add).toMatchObject({ method: 'POST', path: `/weighings/${W}/catch`, body: [{ weight: 4.25, fishType: species[0].documentId }] });
  expect(upload.method).toBe('POST');
  expect(upload.path).toBe('/upload');
  const form = String(upload.body);
  expect(form).toContain('api::catch.catch');
  expect(form).toMatch(/name="refId"\r\n\r\n990001/);
  expect(form).toMatch(/name="field"\r\n\r\nmedia/);
  expect(form).toContain('filename="CatchID_990001_peste.png"');
  expect(organizer.writes).toHaveLength(2);
  expect(errors).toEqual([]);
});

test('organizer.scale-weighing.c12 — «Adaugă și continuă» keeps the species and resets weight, quantity, photos; split body', async ({ page, organizer }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await organizer.mockWrite('POST', `/weighings/${W}/catch`, (w) => ({
    json: (w.body as { weight: number }[]).map((c, i) => ({ id: 880000 + i, documentId: `e2e${i}`, weight: c.weight })),
    delayMs: 300,
  }));
  await open(page, { served: { status: 'started' } });
  await loaded(page);
  await page.getByRole('button', { name: 'Adaugă captură' }).click();
  const dialog = page.getByRole('dialog', { name: 'Adaugă captură' });
  await dialog.getByLabel('Greutate').fill('10');
  await dialog.getByLabel('Cantitate').fill('3');
  await pick(dialog, species[1].Name);
  await dialog.getByRole('button', { name: 'Adaugă și continuă' }).click();
  await expect(toast(page, 'Captură adăugată cu succes!')).toBeVisible();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('Greutate')).toHaveValue('');
  await expect(dialog.getByLabel('Cantitate')).toHaveValue('1');
  await expect(radio(dialog, species[1].Name)).toBeChecked();
  const body = organizer.writes[0].body as { weight: number; fishType: string }[];
  expect(body).toHaveLength(3);
  expect(body.every((c) => c.fishType === species[1].documentId)).toBe(true);
  expect(body.reduce((a, c) => a + c.weight, 0)).toBeCloseTo(10, 3);
  expect(await page.evaluate(() => window.localStorage.getItem('bluvi:lastFishSpeciesId'))).toBe(species[1].documentId);
});

test('organizer.scale-weighing.c13 — a failed add rolls the rows back (error toast); a failed photo upload toasts', async ({ page, organizer }) => {
  await page.setViewportSize(PHONE);
  await organizer.mockWrite('POST', `/weighings/${W}/catch`, () =>
    organizer.writes.length === 1 ? { ...cmsError(400, 'Cântarul este închis.'), delayMs: 400 } : { json: [{ id: 990002, documentId: 'e2ecatch2', weight: 3 }] },
  );
  await organizer.mockWrite('POST', '/upload', cmsError(500, 'upload failed'));
  const { errors } = await open(page, { served: { status: 'started' } });
  await loaded(page);
  await page.getByRole('button', { name: 'Adaugă captură' }).click();
  const dialog = page.getByRole('dialog', { name: 'Adaugă captură' });
  await dialog.getByLabel('Greutate').fill('3');
  await pick(dialog, species[0].Name);
  await dialog.getByRole('button', { name: 'Finalizează' }).click();
  await expect(page.locator('[data-testid="catch-row"][data-optimistic]')).toHaveCount(1);
  await expect(toast(page, 'Cântarul este închis.')).toBeVisible();
  await expect(page.locator('[data-testid="catch-row"][data-optimistic]')).toHaveCount(0);
  await expect(page.getByTestId('catch-row')).toHaveCount(real.catches.length);
  // The dialog stays open with the form (fish keeps the sheet on error).
  await expect(dialog.getByLabel('Greutate')).toBeVisible();
  await dialog.getByTestId('add-catch-file').setInputFiles([photo('x.png')]);
  await dialog.getByLabel('Greutate').fill('3');
  await dialog.getByRole('button', { name: 'Finalizează' }).click();
  await expect(toast(page, 'Captură adăugată, dar nu s-a putut adăuga media')).toBeVisible();
  await expect(dialog).toBeHidden();
  expect(organizer.writes.map((w) => `${w.method} ${w.path}`)).toEqual([`POST /weighings/${W}/catch`, `POST /weighings/${W}/catch`, 'POST /upload']);
  expect(errors).toEqual([]);
});

test('organizer.scale-weighing.c15/c16 — referee then witness signature, both PNGs uploaded, then the close: toast, back to the stand', async ({ page, organizer }) => {
  await page.setViewportSize(PHONE);
  await organizer.mockWrite('POST', '/upload', { json: [{ id: 1, url: S3_IMAGE.url }] });
  await organizer.mockWrite('POST', `/weighings/${W}/end`, () =>
    organizer.writes.filter((w) => w.path.endsWith('/end')).length === 1 ? cmsError(400, 'Semnăturile lipsesc.') : { json: { message: 'ok' } },
  );
  const { errors } = await open(page, { served: { status: 'started' } });
  await loaded(page);
  await actionBar(page).click();
  const referee = page.getByRole('dialog', { name: 'Semnătură arbitru ✍🏻' });
  await expect(referee).toBeVisible();
  const next = referee.getByRole('button', { name: 'Mai departe' });
  await expect(next).toBeDisabled();
  await expect(referee.getByText('Semnătura nu se poate introduce de la tastatură.', { exact: false })).toBeVisible();
  await sign(page);
  await expect(next).toBeEnabled();
  await referee.getByRole('button', { name: 'Resetează semnătura' }).click();
  await expect(next).toBeDisabled();
  await sign(page);
  await shoot(page, 'signature-referee', [375, 1280]);
  await expectNoA11yViolations(page);
  await next.click();
  const witness = page.getByRole('dialog', { name: 'Semnătură martor ✍🏻' });
  await expect(witness).toBeVisible();
  await expect(witness.getByRole('button', { name: 'Mai departe' })).toBeDisabled();
  await sign(page);
  await witness.getByRole('button', { name: 'Mai departe' }).click();
  // 1st try: the close fails → its message, still here.
  await expect(toast(page, 'Semnăturile lipsesc.')).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`${PAGE}$`));
  const [up1, up2, end] = organizer.writes;
  for (const w of [up1, up2]) expect(`${w.method} ${w.path}`).toBe('POST /upload');
  const forms = [String(up1.body), String(up2.body)];
  for (const field of ['refereeSignature', 'witnessSignature']) {
    const form = forms.find((f) => f.includes(`${field}-weighingDocumentId-${W}.png`))!;
    expect(form, field).toBeTruthy();
    expect(form).toContain('api::weighing.weighing');
    expect(form).toMatch(new RegExp(`name="refId"\\r\\n\\r\\n${real.id}`));
    expect(form).toMatch(new RegExp(`name="field"\\r\\n\\r\\n${field}`));
    expect(form).toContain('Content-Type: image/png');
  }
  expect(end).toMatchObject({ method: 'POST', path: `/weighings/${W}/end` });

  // 2nd try succeeds: toast, back to the stand's weighings.
  await actionBar(page).click();
  await sign(page);
  await page.getByRole('dialog', { name: 'Semnătură arbitru ✍🏻' }).getByRole('button', { name: 'Mai departe' }).click();
  // Sign only once the witness pad is up (a stroke during the hand-over can land nowhere).
  await expect(page.getByRole('dialog', { name: 'Semnătură martor ✍🏻' }).getByRole('button', { name: 'Mai departe' })).toBeDisabled();
  await sign(page);
  await page.getByRole('dialog', { name: 'Semnătură martor ✍🏻' }).getByRole('button', { name: 'Mai departe' }).click();
  await expect(toast(page, 'Cântarul a fost finalizat cu succes!')).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`${HISTORY}$`));
  expect(organizer.writes.map((w) => `${w.method} ${w.path}`)).toEqual([
    'POST /upload',
    'POST /upload',
    `POST /weighings/${W}/end`,
    'POST /upload',
    'POST /upload',
    `POST /weighings/${W}/end`,
  ]);
  expect(errors.filter((e) => !/404/.test(e))).toEqual([]);
});

test('organizer.scale-weighing.c17 — «Vezi semnături» for anyone with a role; none without one', async ({ page }) => {
  await page.setViewportSize(PHONE);
  await open(page, { role: 'participant', served: { signatures: true } });
  await loaded(page);
  await page.getByRole('button', { name: 'Vezi semnături' }).click();
  const dialog = page.getByRole('dialog', { name: 'Semnături' });
  const refereeImg = dialog.getByRole('img', { name: 'Semnătură arbitru' });
  await expect(refereeImg).toHaveAttribute('src', SIG_REFEREE);
  await expect(dialog.getByRole('img', { name: 'Semnătură martor' })).toHaveAttribute('src', SIG_WITNESS);
  await expect.poll(() => refereeImg.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth)).toBeGreaterThan(0);
  await shoot(page, 'signatures', [375, 1280]);
  await expectNoA11yViolations(page);
  // Dark mode: fish's transparent black strokes stay on a literal white plate (never the navy surface).
  await page.evaluate(() => (document.documentElement.dataset.theme = 'dark'));
  for (const name of ['Semnătură arbitru', 'Semnătură martor'])
    expect(await dialog.getByRole('img', { name }).evaluate((img) => getComputedStyle(img).backgroundColor)).toBe('rgb(255, 255, 255)');
  await shoot(page, 'signatures-dark', [375, 1280]);
  await page.evaluate(() => delete document.documentElement.dataset.theme);
  await dialog.getByRole('button', { name: 'Închide' }).click();
  await expect(dialog).toBeHidden();
});

test('organizer.scale-weighing.c17 — no role in the competition: no «Vezi semnături»', async ({ page }) => {
  await page.setViewportSize(PHONE);
  await open(page, { role: null, served: { signatures: true } });
  await loaded(page);
  await expect(page.getByRole('button', { name: 'Vezi semnături' })).toHaveCount(0);
  await expect(actionBar(page)).toHaveCount(0);
});

test('organizer.scale-weighing.c19/c20 — the author reopens with a reason: validation, pending, toast; a referee cannot', async ({ page, organizer }) => {
  await page.setViewportSize(PHONE);
  let release!: () => void;
  const hold = new Promise<void>((r) => (release = r));
  await mockWriteAsync(page, organizer, 'POST', `/weighings/${W}/reopen`, async () => {
    await hold;
    return { json: { message: 'ok' } };
  });
  const served: Served = {};
  const { watch, errors } = await open(page, { role: 'author', served, setup: (p) => serveCompetition(p, { competitionStatus: 'started' }) });
  await loaded(page);
  await page.getByRole('button', { name: 'Redeschide cântarul' }).click();
  const dialog = page.getByRole('alertdialog', { name: 'Ești sigur că vrei să redeschizi cântarul?' });
  await expect(dialog).toContainText('Modificările vor fi vizibile în istoricul concursului pentru toți participanții.');
  const reason = dialog.getByLabel('Te rugăm să indici motivul redeschiderii:');
  await expect(reason).toHaveAttribute('placeholder', 'Introduceți motivul…');
  await expect(reason).toBeFocused();
  await dialog.getByRole('button', { name: 'Redeschide cântarul' }).click();
  await expect(dialog.getByText('Acest câmp este obligatoriu')).toBeVisible();
  await reason.fill('x'.repeat(101));
  await expect(dialog.getByText('Motivul trebuie să fie mai scurt de 100 de caractere')).toBeVisible();
  await shoot(page, 'reopen-reason', [375, 1280]);
  await reason.fill('Captură cântărită greșit');
  await expectNoA11yViolations(page);
  const before = watch.reads.filter((r) => r === weighingPath(W)).length;
  served.status = 'started';
  await dialog.getByRole('button', { name: 'Redeschide cântarul' }).click();
  await expect(page.getByRole('dialog').getByText('Se redeschide cântarul…')).toBeVisible();
  await shoot(page, 'reopen-pending', [375]);
  release();
  await expect(toast(page, 'Cântarul a fost redeschis cu succes')).toBeVisible();
  expect(organizer.writes).toEqual([{ method: 'POST', path: `/weighings/${W}/reopen`, query: '', body: { data: { competitionId: C, reason: 'Captură cântărită greșit' } } }]);
  // c20: the weighing is refetched — open again, with its actions.
  await expect.poll(() => watch.reads.filter((r) => r === weighingPath(W)).length).toBeGreaterThan(before);
  await expect(page.getByRole('button', { name: 'Adaugă captură' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Redeschide cântarul' })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('organizer.scale-weighing.c20 — a failed reopen shows the message with «Închide»', async ({ page, organizer }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await organizer.mockWrite('POST', `/weighings/${W}/reopen`, cmsError(400, 'Există deja un cântar deschis pe acest stand.'));
  await open(page, { role: 'author', setup: (p) => serveCompetition(p, { competitionStatus: 'started' }) });
  await loaded(page);
  await page.getByRole('button', { name: 'Redeschide cântarul' }).click();
  await page.getByLabel('Te rugăm să indici motivul redeschiderii:').fill('Greșeală');
  await page.getByTestId('reopen-confirm').click();
  const dialog = page.getByRole('dialog', { name: 'Cântarul nu a fost redeschis' });
  await expect(dialog.getByRole('alert')).toHaveText('Există deja un cântar deschis pe acest stand.');
  await shoot(page, 'reopen-error', [375, 1280]);
  await dialog.getByRole('button', { name: 'Închide' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name: 'Redeschide cântarul' })).toBeVisible();
  // A referee does not get the action (fish: author only).
  await page.unroute((url) => url.pathname === statutePath(C));
  await page.route(
    (url) => url.pathname === statutePath(C),
    (route) => route.fulfill({ json: { userRole: 'referee', isReferee: true, isParticipant: false } }),
  );
  await page.reload();
  await loaded(page);
  await expect(page.getByRole('button', { name: 'Redeschide cântarul' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Vezi semnături' })).toBeVisible();
});

test('organizer.scale-weighing.c21 — the refresh action refetches the weighing, the allocations and the statute', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const { watch } = await open(page, { served: { status: 'started' } });
  await loaded(page);
  const count = (p: string) => watch.reads.filter((r) => r === p).length;
  const before = [count(weighingPath(W)), count(allocationsPath(C)), count(statutePath(C))];
  await page.getByTestId('management-refresh').click();
  await expect.poll(() => [count(weighingPath(W)), count(allocationsPath(C)), count(statutePath(C))].every((n, i) => n > before[i])).toBe(true);
});

test('organizer.scale-weighing.c19 — «Redeschide cântarul» only when the CMS can accept it (web deviation from fish)', async ({ page }) => {
  await page.setViewportSize(PHONE);
  const comp: { over: Record<string, unknown> } = { over: {} };
  const other: { open: boolean } = { open: false };
  await open(page, {
    role: 'author',
    setup: async (p) => {
      await p.route(
        (url) => url.pathname === competitionPath(C),
        async (route) => {
          const res = await route.fetch();
          const body = await res.json();
          await route.fulfill({ response: res, json: { ...body, data: { ...body.data, ...comp.over } } });
        },
      );
      await p.route(
        (url) => url.pathname === byStandPath,
        async (route) => {
          const res = await route.fetch();
          const body = await res.json();
          const extra = other.open
            ? [{ id: 990100, documentId: 'e2e-open-weighing', weighingType: 'normal', weighingStatus: 'started', startDate: null, endDate: null, catches: [] }]
            : [];
          await route.fulfill({ response: res, json: { ...body, data: [...body.data, ...extra] } });
        },
      );
    },
  });
  await loaded(page);
  const reopen = page.getByRole('button', { name: 'Redeschide cântarul' });
  // The local fixture's competition is completed: the CMS would refuse, so it is not offered.
  await expect(page.getByRole('button', { name: 'Vezi semnături' })).toBeVisible();
  await expect(reopen).toHaveCount(0);
  // Started, running leg, no other open weighing on the stand: offered.
  comp.over = { competitionStatus: 'started' };
  await page.reload();
  await loaded(page);
  await expect(reopen).toBeVisible();
  // Another weighing open on the stand: not offered.
  other.open = true;
  await page.reload();
  await loaded(page);
  await expect(page.getByRole('button', { name: 'Vezi semnături' })).toBeVisible();
  await expect(reopen).toHaveCount(0);
  // A closed leg (feeder on legs): not offered.
  other.open = false;
  comp.over = { competitionStatus: 'started', roundStatus: 'closed' };
  await page.reload();
  await loaded(page);
  await expect(page.getByRole('button', { name: 'Vezi semnături' })).toBeVisible();
  await expect(reopen).toHaveCount(0);
});

test('organizer.scale-weighing.c1 — a failed stand list keeps the weighing: «Cântar», the catches, no error gate', async ({ page }) => {
  await page.setViewportSize(PHONE);
  await open(page, {
    role: 'author',
    setup: async (p) => {
      await serveCompetition(p, { competitionStatus: 'started' });
      await p.route(
        (url) => url.pathname === byStandPath,
        (route) => route.fulfill({ status: 500, json: { data: null, error: { status: 500, message: 'boom' } } }),
      );
    },
  });
  await loaded(page);
  await expect(h1(page)).toHaveText('Cântar');
  await expect(page.getByTestId('catch-row')).toHaveCount(real.catches.length);
  await expect(page.getByRole('heading', { name: 'Serverul nu răspunde' })).toHaveCount(0);
  // The list unknown: a reopen cannot be known to succeed — not offered (owner rule 4).
  await expect(page.getByRole('button', { name: 'Vezi semnături' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Redeschide cântarul' })).toHaveCount(0);
  await shoot(page, 'stand-list-failed', [375]);
});

test('organizer.scale-weighing.c12/c14 — slow photo compression: one POST, the form never comes back, the close waits', async ({ page, organizer }) => {
  await page.setViewportSize(PHONE);
  const served: Served = { status: 'started' };
  let releaseUpload!: () => void;
  const uploadHold = new Promise<void>((r) => (releaseUpload = r));
  await mockWriteAsync(page, organizer, 'POST', `/weighings/${W}/catch`, () => {
    served.catches = [{ id: 990003, documentId: 'e2ecatch3', weight: 2.5, fishType: { Name: species[0].Name }, media: [] }, ...real.catches];
    return { json: [{ id: 990003, documentId: 'e2ecatch3', weight: 2.5 }] };
  });
  await mockWriteAsync(page, organizer, 'POST', '/upload', async () => {
    await uploadHold;
    return { json: [{ id: 78, url: S3_IMAGE.url }] };
  });
  const { errors } = await open(page, {
    served,
    // A phone compressing 5–12 MB photos: createImageBitmap (compressImage's first step) waits.
    setup: (p) =>
      p.addInitScript(() => {
        const w = window as unknown as { __releaseCompress: () => void; createImageBitmap: typeof createImageBitmap };
        const hold = new Promise<void>((r) => (w.__releaseCompress = r));
        const original = w.createImageBitmap.bind(window);
        w.createImageBitmap = (async (...args: Parameters<typeof createImageBitmap>) => {
          await hold;
          return original(...args);
        }) as typeof createImageBitmap;
      }),
  });
  await loaded(page);
  await page.getByRole('button', { name: 'Adaugă captură' }).click();
  const dialog = page.getByRole('dialog', { name: 'Adaugă captură' });
  await dialog.getByLabel('Greutate').fill('2,5');
  await pick(dialog, species[0].Name);
  await dialog.getByTestId('add-catch-file').setInputFiles([photo('mare.png'), photo('mare2.png')]);
  await dialog.getByRole('button', { name: 'Finalizează' }).dblclick();
  // Compressing: the spinner, never the filled form or its buttons; nothing written yet.
  const pendingView = dialog.getByTestId('add-catch-pending');
  await expect(pendingView).toBeVisible();
  await page.waitForTimeout(800);
  await expect(pendingView).toBeVisible();
  await expect(dialog.getByLabel('Greutate')).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Finalizează' })).toHaveCount(0);
  expect(organizer.writes).toEqual([]);
  // c14: the close waits for the whole chain.
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(actionBar(page)).toHaveAttribute('aria-busy', 'true');
  await page.evaluate(() => (window as unknown as { __releaseCompress: () => void }).__releaseCompress());
  // The catch is POSTed once; its photos are uploading: the close still waits, the dialog shows no form.
  await expect.poll(() => organizer.writes.map((w) => `${w.method} ${w.path}`)).toEqual([`POST /weighings/${W}/catch`, 'POST /upload']);
  await expect(actionBar(page)).toHaveAttribute('aria-busy', 'true');
  await page.getByRole('button', { name: 'Adaugă captură' }).click();
  await expect(dialog.getByTestId('add-catch-pending')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Finalizează' })).toHaveCount(0);
  releaseUpload();
  await expect(toast(page, 'Captură adăugată cu succes!')).toBeVisible();
  await expect(dialog).toBeHidden();
  await expect(actionBar(page)).not.toHaveAttribute('aria-busy', 'true');
  expect(organizer.writes.filter((w) => w.path === `/weighings/${W}/catch`)).toHaveLength(1);
  expect(organizer.writes[0].body).toEqual([{ weight: 2.5, fishType: species[0].documentId }]);
  expect(organizer.writes).toHaveLength(2);
  expect(errors).toEqual([]);
});

test('organizer.scale-weighing.c15/c16 — a double click on the witness «Mai departe» closes the weighing once', async ({ page, organizer }) => {
  await page.setViewportSize(PHONE);
  await organizer.mockWrite('POST', '/upload', { json: [{ id: 1, url: S3_IMAGE.url }], delayMs: 200 });
  await organizer.mockWrite('POST', `/weighings/${W}/end`, { json: { message: 'ok' }, delayMs: 200 });
  const { errors } = await open(page, { served: { status: 'started' } });
  await loaded(page);
  await actionBar(page).click();
  const referee = page.getByRole('dialog', { name: 'Semnătură arbitru ✍🏻' });
  await sign(page);
  await referee.getByRole('button', { name: 'Mai departe' }).dblclick();
  // The referee's double click lands one step only: the witness pad is fresh, its button off.
  const witness = page.getByRole('dialog', { name: 'Semnătură martor ✍🏻' });
  await expect(witness).toBeVisible();
  await expect(witness.getByRole('button', { name: 'Mai departe' })).toBeDisabled();
  await sign(page);
  await witness.getByRole('button', { name: 'Mai departe' }).dblclick();
  await expect(toast(page, 'Cântarul a fost finalizat cu succes!')).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`${HISTORY}$`));
  await page.waitForTimeout(500);
  expect(organizer.writes.map((w) => `${w.method} ${w.path}`)).toEqual(['POST /upload', 'POST /upload', `POST /weighings/${W}/end`]);
  const forms = organizer.writes.slice(0, 2).map((w) => String(w.body));
  expect(forms.some((f) => f.includes('refereeSignature-weighingDocumentId-'))).toBe(true);
  expect(forms.some((f) => f.includes('witnessSignature-weighingDocumentId-'))).toBe(true);
  expect(errors.filter((e) => !/404/.test(e))).toEqual([]);
});

test('organizer.scale-weighing.c15 — the signature PNG is a 700×700 square on white, whatever the pad (fish shows it `cover` at 200×200)', async ({ page, organizer }) => {
  await organizer.mockWrite('POST', '/upload', { json: [{ id: 1, url: S3_IMAGE.url }] });
  await organizer.mockWrite('POST', `/weighings/${W}/end`, { json: { message: 'ok' } });
  await page.setViewportSize({ width: 1280, height: 900 });
  await open(page, { served: { status: 'started' } });
  await loaded(page);
  // Capture the blobs the pad hands over (the upload body is multipart text).
  await page.evaluate(() => {
    const w = window as unknown as { __sigSizes: number[][] };
    w.__sigSizes = [];
    const original = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (this: HTMLCanvasElement, cb: BlobCallback, type?: string, q?: number) {
      if (type === 'image/png') w.__sigSizes.push([this.width, this.height]);
      return original.call(this, cb, type, q);
    };
  });
  await actionBar(page).click();
  const pad = page.getByTestId('signature-pad');
  const box = (await pad.boundingBox())!;
  expect(box.width).not.toBeCloseTo(box.height, 0);
  await sign(page);
  await page.getByRole('dialog', { name: 'Semnătură arbitru ✍🏻' }).getByRole('button', { name: 'Mai departe' }).click();
  // Sign only once the witness pad is up (a stroke during the hand-over can land nowhere).
  await expect(page.getByRole('dialog', { name: 'Semnătură martor ✍🏻' }).getByRole('button', { name: 'Mai departe' })).toBeDisabled();
  await sign(page);
  await page.getByRole('dialog', { name: 'Semnătură martor ✍🏻' }).getByRole('button', { name: 'Mai departe' }).click();
  await expect(toast(page, 'Cântarul a fost finalizat cu succes!')).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __sigSizes: number[][] }).__sigSizes)).toEqual([
    [700, 700],
    [700, 700],
  ]);
});

test('organizer.scale-weighing.c15 — phone: the signature flow fills the screen with a ~400px pad', async ({ page }) => {
  await page.setViewportSize(PHONE);
  await open(page, { served: { status: 'started' } });
  await loaded(page);
  await actionBar(page).click();
  const dialog = page.getByRole('dialog', { name: 'Semnătură arbitru ✍🏻' });
  await expect(dialog).toBeVisible();
  const d = (await dialog.boundingBox())!;
  expect(d.width).toBe(PHONE.width);
  expect(d.height).toBeGreaterThan(PHONE.height - 2);
  const pad = (await page.getByTestId('signature-pad').boundingBox())!;
  expect(pad.height).toBeGreaterThanOrEqual(396);
  await expect(dialog.getByText('Pasul 1 din 2')).toBeVisible();
  await sign(page);
  await page.waitForTimeout(600); // the surface's entry transition
  await shoot(page, 'signature-phone', [375]);
});
