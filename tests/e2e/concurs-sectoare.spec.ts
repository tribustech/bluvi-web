import { mkdirSync } from 'node:fs';
import { expect, test, type Page, type Request, type Route } from '@playwright/test';
import { expectNoA11yViolations } from './helpers/a11y';
import { BASE_URL } from './helpers/base-url';
import { collectConsoleErrors } from './helpers/console';
import { qaJwt, signIn } from './helpers/session';

/*
 * «Alocarea standurilor pe sectoare» (parity organizer.sectors c1–c8; fish
 * app/(app)/configure/sectors/[competitionId].tsx).
 *
 * READS hit the local CMS: «SIM3 Cupa C&B Ed 8», notStarted, authored by the QA user, 4 sectors
 * (C, A, B, D in the CMS's order) of 5 stands, 20 participants, Chita Lake's 21 stands. A state the
 * local data does not have (started, unknown limit, a failure, another viewer) is made by editing
 * the real response in page.route.
 * WRITES NEVER reach the CMS (an allocation pushes to real devices): the POST is fulfilled here and
 * its exact body asserted; every non-GET to the browser's CMS edge is recorded and must be one of
 * the mocked ones.
 */

test.describe.configure({ timeout: 180_000, retries: 1 });

const ID = process.env.E2E_SECTORS ?? 'a6xjl65ooe9eadrtvvqj9hn1';
const PHONE = { width: 375, height: 812 };
const WIDTHS = [375, 1280, 1440, 1920];
const TITLE = 'Alocarea standurilor pe sectoare';

let jwt = '';
test.beforeAll(async ({ request }) => {
  jwt = await qaJwt(request);
  mkdirSync('.shots', { recursive: true });
});

const path = (url: string) => new URL(url).pathname;
const isCms = (r: Request) => path(r.url()).startsWith('/api/cms/');
const competitionPath = `/api/cms/feed/competitions/${ID}`;
const statutePath = `/api/cms/user/profile/competition/${ID}/statute`;
const allocatePath = `/api/cms/competitions/${ID}/allocate-stands-to-sectors`;

type Sector = { documentId: string; name: string; stands: { documentId: string; name: string }[] };
type Competition = { competitionStatus: string; participantsLimit: number | null; sectors: Sector[]; lake: { stands: { documentId: string; name: string }[] } };
type Watch = { writes: string[]; reads: string[] };
type Posted = { body: unknown }[];

/** The real competition, read once (the expectations follow the local data, not hard-coded ids). */
let real: Competition;
test.beforeAll(async ({ request }) => {
  const res = await request.get(`${process.env.E2E_CMS_URL ?? 'http://localhost:1337/api'}/feed/competitions/${ID}`);
  expect(res.ok()).toBe(true);
  const json = await res.json();
  real = (json.data ?? json) as Competition;
  expect(real.competitionStatus, 'the fixture competition must be notStarted').toBe('notStarted');
  expect(real.sectors.length).toBeGreaterThanOrEqual(2);
});

async function open(page: Page, setup?: (page: Page) => Promise<unknown>, at = `/concursuri/${ID}/sectoare`) {
  await signIn(page.context(), jwt);
  const watch: Watch = { writes: [], reads: [] };
  page.on('request', (r) => {
    if (!isCms(r)) return;
    if (r.method() !== 'GET') watch.writes.push(`${r.method()} ${path(r.url())}`);
    else watch.reads.push(path(r.url()));
  });
  const errors = collectConsoleErrors(page, { ignore: /Failed to load resource: the server responded with a status of (500|400)/ });
  if (setup) await setup(page);
  await page.goto(at);
  return { watch, errors };
}

/** Edits the real competition read on its way to the page. */
async function edit(page: Page, change: (c: Competition) => Competition) {
  await page.route(
    (url) => url.pathname === competitionPath,
    async (route: Route) => {
      const res = await route.fetch();
      const json = await res.json();
      const body = json.data ? { ...json, data: change(json.data) } : change(json);
      await route.fulfill({ response: res, json: body });
    },
  );
}

/** The allocation POST, answered here (never the CMS): records each body. */
async function mockSave(page: Page, answer: (route: Route) => Promise<void>) {
  const posted: Posted = [];
  await page.route(
    (url) => url.pathname === allocatePath,
    async (route) => {
      expect(route.request().method()).toBe('POST');
      posted.push({ body: route.request().postDataJSON() });
      await answer(route);
    },
  );
  return posted;
}

const ok = (route: Route) =>
  route.fulfill({ json: { data: { id: 1, documentId: ID, name: 'SIM3', competitionStatus: 'notStarted' } } });

async function loaded(page: Page) {
  const first = page.getByRole('heading', { level: 2, name: `Sector ${real.sectors[0].name}` });
  const seen = await first.waitFor({ timeout: 12_000 }).then(
    () => true,
    () => false,
  );
  // The shared dev server's Fast Refresh (other agents' edits) can strand a load: one reload.
  if (!seen) await page.reload();
  await expect(first).toBeVisible({ timeout: 30_000 });
}

async function shoot(page: Page, name: string) {
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    // A surface swaps (sheet ↔ dialog) on a resize and fades in: let it settle.
    await page.waitForTimeout(450);
    await page.screenshot({ path: `.shots/sectoare-${name}-${width}.png`, fullPage: true });
  }
  await page.setViewportSize(PHONE);
}

/**
 * The way an organizer gets here (fish OrganizerSheetItems / RankingActionBar «Organizare»): the
 * competition page's «Organizare» (phone: the bar's tile; from 768: the header button) opens the
 * organizer menu, whose «Alocă standuri pe sectoare» opens this page.
 */
async function viaOrganizerMenu(page: Page) {
  const phone = (page.viewportSize()?.width ?? 0) < 768;
  const trigger = phone
    ? page.getByRole('button', { name: 'Acțiuni organizator' })
    : page.getByRole('button', { name: 'Organizare', exact: true });
  await expect(trigger).toBeVisible({ timeout: 30_000 });
  await trigger.click();
  const menu = page.getByRole('dialog', { name: 'Organizare' });
  await expect(menu).toBeVisible();
  const link = menu.getByRole('link', { name: 'Alocă standuri pe sectoare' });
  await expect(link).toHaveAttribute('href', `/concursuri/${ID}/sectoare`);
  await link.click();
  await expect(page).toHaveURL(new RegExp(`/concursuri/${ID}/sectoare$`));
}

const slot = (page: Page, sector: string, n: number) => page.getByTestId(`slot-${sector}-${n}`);
const onlyWrites = (watch: Watch, allowed: string[]) => expect(watch.writes, 'only the mocked allocation POST').toEqual(allowed);

test('signed out → sign-in with the return path', async ({ request }) => {
  const res = await request.get(`${BASE_URL}/concursuri/${ID}/sectoare`, { maxRedirects: 0 });
  expect(res.status()).toBe(307);
  expect(res.headers().location).toContain(`/intra?next=${encodeURIComponent(`/concursuri/${ID}/sectoare`)}`);
});

test('organizer.sectors.c1/c2/c4 — loading, then the title and the info lines; noindex', async ({ page }) => {
  await page.setViewportSize(PHONE);
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  const { watch, errors } = await open(page, (p) =>
    p.route(
      (url) => url.pathname === competitionPath,
      async (route) => {
        await gate;
        await route.continue();
      },
    ),
  );
  await expect(page.getByRole('heading', { level: 1, name: TITLE })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Se încarcă sectoarele…' })).toBeAttached();
  await expect(page.locator('section[aria-busy="true"]')).toBeVisible();
  await shoot(page, 'loading');
  release();
  await loaded(page);
  await expect(page.locator('section[aria-busy="true"]')).toHaveCount(0);
  const info = page.getByTestId('sectors-info');
  await expect(info).toContainText(`Nr. sectoare:${real.sectors.length}`);
  const perSector = Math.ceil((real.participantsLimit ?? 0) / real.sectors.length) || 1;
  await expect(info).toContainText(`Nr. max standuri per sector:${perSector}`);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await expect(page.getByRole('link', { name: 'Înapoi la concurs' })).toHaveAttribute('href', `/concursuri/${ID}`);
  await expect(page.getByTestId('sectors-locked')).toHaveCount(0);
  await shoot(page, 'loaded');
  await expectNoA11yViolations(page);
  onlyWrites(watch, []);
  expect(errors).toEqual([]);
});

test('organizer.sectors.c1 — an error offers «Încearcă din nou», which refetches the competition', async ({ page }) => {
  await page.setViewportSize(PHONE);
  let fail = true;
  const { watch, errors } = await open(page, (p) =>
    p.route(
      (url) => url.pathname === competitionPath,
      (route) => (fail ? route.fulfill({ status: 500, json: { error: { status: 500, message: 'boom' } } }) : route.continue()),
    ),
  );
  const gate = page.getByRole('alert');
  await expect(gate.getByRole('heading', { name: 'Serverul nu răspunde' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('heading', { level: 1, name: TITLE })).toBeVisible();
  await shoot(page, 'error');
  await expectNoA11yViolations(page);
  fail = false;
  const before = watch.reads.filter((r) => r === competitionPath).length;
  await page.getByRole('button', { name: 'Încearcă din nou' }).click();
  await loaded(page);
  expect(watch.reads.filter((r) => r === competitionPath).length).toBeGreaterThan(before);
  onlyWrites(watch, []);
  expect(errors).toEqual([]);
});

test('organizer.sectors.c4 — «Nr. max standuri per sector» is 1 when the limit is unknown', async ({ page }) => {
  await page.setViewportSize(PHONE);
  const { watch } = await open(page, (p) =>
    edit(p, (c) => ({ ...c, participantsLimit: null, sectors: c.sectors.map((s) => ({ ...s, stands: [] })) })),
  );
  await loaded(page);
  await expect(page.getByTestId('sectors-info')).toContainText('Nr. max standuri per sector:1');
  for (const s of real.sectors) {
    await expect(page.getByTestId(`sector-${s.name}`).getByRole('button')).toHaveCount(1);
    await expect(slot(page, s.name, 1)).toHaveText('-');
  }
  onlyWrites(watch, []);
});

test('organizer.sectors.c5 — «Sector X» in the competition order, slots prefilled in order', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const { watch } = await open(page);
  await loaded(page);
  const headings = page.getByRole('heading', { level: 2, name: /^Sector / });
  await expect(headings).toHaveText(real.sectors.map((s) => `Sector ${s.name}`));
  const perSector = Math.ceil((real.participantsLimit ?? 0) / real.sectors.length) || 1;
  for (const s of real.sectors) {
    const slots = page.getByTestId(`sector-${s.name}`).getByRole('button');
    await expect(slots).toHaveCount(Math.max(perSector, s.stands.length));
    for (let i = 0; i < perSector; i++) {
      await expect(slot(page, s.name, i + 1)).toHaveText(s.stands[i]?.name ?? '-');
    }
  }
  // From 768 the sectors are columns side by side (owner: desktop-first, sector colour accents).
  const a = await page.getByTestId(`sector-${real.sectors[0].name}`).boundingBox();
  const b = await page.getByTestId(`sector-${real.sectors[1].name}`).boundingBox();
  expect(a && b && Math.abs(a.y - b.y) < 2 && b.x > a.x + a.width).toBe(true);
  onlyWrites(watch, []);
});

test('organizer.sectors.c6/c7 — a filled slot empties; an empty one opens «Sector X» with placed stands disabled', async ({ page }) => {
  await page.setViewportSize(PHONE);
  const { watch, errors } = await open(page);
  await loaded(page);
  const s = real.sectors[0];
  const first = slot(page, s.name, 1);
  await expect(first).toHaveText(s.stands[0].name);
  // c7: activating a filled slot empties it.
  await first.click();
  await expect(first).toHaveText('-');
  // c7: the red ✕ badge empties too.
  const second = slot(page, s.name, 2);
  await second.locator('span[aria-hidden]').click();
  await expect(second).toHaveText('-');
  // c6: the empty slot opens the picker labelled «Sector X».
  await first.click();
  const picker = page.getByRole('dialog', { name: `Sector ${s.name}` });
  await expect(picker).toBeVisible();
  await expect(picker.getByRole('button', { name: /^Standul / })).toHaveCount(real.lake.stands.length);
  // Placed anywhere (another sector's first stand) → disabled; the two just emptied → enabled.
  const other = real.sectors[1].stands[0];
  await expect(picker.getByTestId(`stand-option-${other.name}`)).toBeDisabled();
  await expect(picker.getByTestId(`stand-option-${s.stands[0].name}`)).toBeEnabled();
  await expect(picker.getByTestId(`stand-option-${s.stands[1].name}`)).toBeEnabled();
  await shoot(page, 'picker');
  await expectNoA11yViolations(page);
  await picker.getByTestId(`stand-option-${s.stands[1].name}`).click();
  await expect(picker).toBeHidden();
  await expect(first).toHaveText(s.stands[1].name);
  // Escape closes without a choice.
  await second.click();
  await expect(page.getByRole('dialog', { name: `Sector ${s.name}` })).toBeVisible();
  await expect(page.getByRole('dialog', { name: `Sector ${s.name}` }).getByTestId(`stand-option-${s.stands[1].name}`)).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(second).toHaveText('-');
  onlyWrites(watch, []);
  expect(errors).toEqual([]);
});

test('organizer.sectors.c3 — started: the red dashed banner, inert slots, no «Salvează»', async ({ page }) => {
  await page.setViewportSize(PHONE);
  const { watch, errors } = await open(page, (p) => edit(p, (c) => ({ ...c, competitionStatus: 'started' })));
  await loaded(page);
  const banner = page.getByTestId('sectors-locked');
  await expect(banner).toHaveText('Competiția a început deja! Alocarea standurilor nu mai poate fi modificată!');
  await expect(banner).toHaveCSS('border-top-style', 'dashed');
  for (const s of real.sectors) for (const b of await page.getByTestId(`sector-${s.name}`).getByRole('button').all()) await expect(b).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Salvează' })).toHaveCount(0);
  // No ✕ badge on a read-only slot.
  await expect(slot(page, real.sectors[0].name, 1).locator('span[aria-hidden]')).toHaveCount(0);
  await shoot(page, 'locked');
  await expectNoA11yViolations(page);
  onlyWrites(watch, []);
  expect(errors).toEqual([]);
});

test('organizer.sectors.c8 — reached from the competition page; «Salvează» POSTs every sector in slot order, spinner, toast, back (no history entry) + refetch', async ({ page }) => {
  await page.setViewportSize(PHONE);
  let release!: () => void;
  const hold = new Promise<void>((r) => (release = r));
  let posted: Posted = [];
  // One more slot than the fullest sector has stands: every sector gets an empty slot after its
  // stands, so the pick below always has a deterministic target.
  const perSector = Math.max(...real.sectors.map((x) => x.stands.length)) + 1;
  const limit = perSector * real.sectors.length;
  const { watch, errors } = await open(
    page,
    async (p) => {
      await edit(p, (c) => ({ ...c, participantsLimit: limit }));
      posted = await mockSave(p, async (route) => {
        await hold;
        await ok(route);
      });
    },
    `/concursuri/${ID}`,
  );
  await viaOrganizerMenu(page);
  await loaded(page);
  await expect(page.getByTestId('sectors-info')).toContainText(`Nr. max standuri per sector:${perSector}`);
  const [s0, s1] = real.sectors;
  // Empty the first sector's first slot, then pick that stand into the second sector's first free slot.
  await slot(page, s0.name, 1).click();
  await expect(slot(page, s0.name, 1)).toHaveText('-');
  const target = slot(page, s1.name, s1.stands.length + 1);
  await expect(target).toHaveText('-');
  await target.click();
  await page.getByRole('dialog', { name: `Sector ${s1.name}` }).getByTestId(`stand-option-${s0.stands[0].name}`).click();
  await expect(target).toHaveText(s0.stands[0].name);
  await expect(page.getByTestId('sectors-filled')).toBeVisible();
  const save = page.getByRole('button', { name: 'Salvează' });
  await save.click();
  // Pending: spinner + busy, the slots inert, a second click sends nothing.
  await expect(save).toHaveAttribute('aria-busy', 'true');
  await expect(save).toBeDisabled();
  await expect(slot(page, s0.name, 2)).toBeDisabled();
  await shoot(page, 'saving');
  const readsBefore = watch.reads.filter((r) => r === competitionPath).length;
  release();
  await expect(page.getByText('Standurile au fost alocate cu succes!')).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/concursuri/${ID}$`));
  const expected: Record<string, string[]> = Object.fromEntries(real.sectors.map((s) => [s.documentId, s.stands.map((x) => x.documentId)]));
  expected[s0.documentId] = s0.stands.slice(1).map((x) => x.documentId);
  // The picked stand is appended to s1's array: the slot order is kept.
  expected[s1.documentId] = [...s1.stands.map((x) => x.documentId), s0.stands[0].documentId];
  expect(posted).toEqual([{ body: { allocations: expected } }]);
  // The competition is refetched after the save.
  await expect.poll(() => watch.reads.filter((r) => r === competitionPath).length).toBeGreaterThan(readsBefore);
  // The editor left no history entry behind (fish router.back()): Back never returns to it.
  await page.goBack();
  await page.waitForLoadState('domcontentloaded');
  expect(path(page.url())).not.toMatch(/\/sectoare$/);
  onlyWrites(watch, [`POST ${allocatePath}`]);
  expect(errors).toEqual([]);
});

test('organizer menu from 768 — the header «Organizare» lists «Alocă standuri pe sectoare» before the start', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const { watch } = await open(page, undefined, `/concursuri/${ID}`);
  await viaOrganizerMenu(page);
  await loaded(page);
  onlyWrites(watch, []);
});

test('organizer.sectors.c8 — an error toasts the server message and keeps the edits', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  let posted: Posted = [];
  const { watch } = await open(page, async (p) => {
    // 1st: a CMS error with its own message (bluCode); 2nd: an unexplained 500 → the generic message
    // (the transport keeps only bluCode messages, like fish services/api/api.ts).
    posted = await mockSave(p, (route) =>
      posted.length === 1
        ? route.fulfill({
            status: 400,
            json: { data: null, error: { status: 400, name: 'BadRequestError', message: 'Standul 3 este deja alocat.', details: { bluCode: 'STAND_TAKEN' } } },
          })
        : route.fulfill({ status: 500, json: { data: null, error: { status: 500, name: 'InternalServerError', message: 'Internal Server Error' } } }),
    );
  });
  await loaded(page);
  const s0 = real.sectors[0];
  await slot(page, s0.name, 1).click();
  await page.getByRole('button', { name: 'Salvează' }).click();
  await expect(page.getByText('Standul 3 este deja alocat.')).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/concursuri/${ID}/sectoare$`));
  await expect(slot(page, s0.name, 1)).toHaveText('-');
  await expect(page.getByRole('button', { name: 'Salvează' })).toBeEnabled();
  await page.getByRole('button', { name: 'Salvează' }).click();
  await expect(page.getByText('A apărut o eroare necunoscută. Te rugăm să reîncerci mai târziu.')).toBeVisible();
  expect(posted).toHaveLength(2);
  onlyWrites(watch, [`POST ${allocatePath}`, `POST ${allocatePath}`]);
});

test('organizer.sectors.c2 — leaving with unsaved changes asks «Renunți la modificări?»', async ({ page }) => {
  await page.setViewportSize(PHONE);
  const { watch } = await open(page);
  await loaded(page);
  // Untouched: back leaves at once.
  await page.getByRole('link', { name: 'Înapoi la concurs' }).click();
  await expect(page).toHaveURL(new RegExp(`/concursuri/${ID}$`));
  await page.goto(`/concursuri/${ID}/sectoare`);
  await loaded(page);
  await slot(page, real.sectors[0].name, 1).click();
  await page.getByRole('link', { name: 'Înapoi la concurs' }).click();
  const guard = page.getByRole('alertdialog', { name: 'Renunți la modificări?' });
  await expect(guard).toBeVisible();
  await guard.getByRole('button', { name: 'Continuă editarea' }).click();
  await expect(guard).toBeHidden();
  await expect(page).toHaveURL(new RegExp(`/concursuri/${ID}/sectoare$`));
  await expect(slot(page, real.sectors[0].name, 1)).toHaveText('-');
  await page.getByRole('link', { name: 'Înapoi la concurs' }).click();
  await page.getByRole('alertdialog', { name: 'Renunți la modificări?' }).getByRole('button', { name: 'Renunță' }).click();
  await expect(page).toHaveURL(new RegExp(`/concursuri/${ID}$`));
  onlyWrites(watch, []);
});

test('not the author → the neutral gate, no slots', async ({ page }) => {
  await page.setViewportSize(PHONE);
  const { watch } = await open(page, (p) => p.route((url) => url.pathname === statutePath, (route) => route.fulfill({ json: { userRole: 'participant' } })));
  await expect(page.getByRole('heading', { name: 'Doar pentru organizatorul concursului' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('heading', { level: 2, name: /^Sector / })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Salvează' })).toHaveCount(0);
  await shoot(page, 'denied');
  onlyWrites(watch, []);
});
