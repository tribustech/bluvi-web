import { mkdirSync } from 'node:fs';
import { expect, test, type Page, type Request, type Route } from '@playwright/test';
import { expectNoA11yViolations } from './helpers/a11y';
import { BASE_URL } from './helpers/base-url';
import { collectConsoleErrors } from './helpers/console';
import { qaJwt, signIn } from './helpers/session';

/*
 * Penalizare — «Alege standul» (parity organizer.penalties-select-stand c1–c6; fish
 * app/(app)/penalties/[competitionId]/select-stand.tsx).
 *
 * READS ONLY. The competitions are the local CMS's own (a started «Cantitate» individual competition
 * with 24 sectors, and a team one); the viewer's statute and any state the local data does not have
 * (a guest, a stand without a registration id, a sector order, a status, a failure, a slow CMS) are
 * made by editing the real response in page.route. Every request to the browser's CMS edge is
 * watched: a single non-GET fails the spec (organizer writes push to real devices).
 */

test.describe.configure({ timeout: 180_000, retries: 1 });

const STARTED = process.env.E2E_PENALTY_STARTED ?? 'kee49a3e64b3f636b4b60daa'; // [CHAT25] quantity, started, 24 stands
const TEAM = process.env.E2E_PENALTY_TEAM ?? 'g5l98otx5ypg6wttowra9yww'; // TEST Card · Echipă: «Nada Grea» (completed → made started)

const PHONE = { width: 375, height: 812 };
const WIDTHS = [375, 1280, 1440, 1920];

let jwt = '';
test.beforeAll(async ({ request }) => {
  jwt = await qaJwt(request);
  mkdirSync('.shots', { recursive: true });
});

const path = (url: string) => new URL(url).pathname;
const isCms = (r: Request) => path(r.url()).startsWith('/api/cms/');
const competitionPath = (id: string) => `/api/cms/feed/competitions/${id}`;
const allocationsPath = (id: string) => `/api/cms/competitions/${id}/allocated-participants`;
const statutePath = (id: string) => `/api/cms/user/profile/competition/${id}/statute`;
const pagePath = (id: string) => `/concursuri/${id}/penalizari/stand`;

type Watch = { writes: string[]; reads: string[] };
type Doc = Record<string, unknown> & { sectors: { name: string; stands: { documentId: string; name: string }[] }[] };
type CompetitionBody = Doc & { data?: Doc };
/** The CMS sends '' (never null) for a missing team / guest / registration id. */
type Alloc = {
  registrationId: string;
  guestName: string;
  teamName: string;
  participants: { id: number; documentId: string; name: string }[];
} | null;
const person = (id: number, name: string) => ({ id, documentId: `e2e-person-${id}`, name });
type AllocBody = { data: Record<string, Alloc> };

async function open(
  page: Page,
  id: string,
  { role = 'author', setup }: { role?: 'author' | 'referee' | 'participant' | null; setup?: (page: Page) => Promise<unknown> } = {},
) {
  await signIn(page.context(), jwt);
  const watch: Watch = { writes: [], reads: [] };
  page.on('request', (r) => {
    if (!isCms(r)) return;
    if (r.method() !== 'GET') watch.writes.push(`${r.method()} ${path(r.url())}`);
    else watch.reads.push(path(r.url()));
  });
  const errors = collectConsoleErrors(page, {
    ignore: /Failed to load resource: the server responded with a status of (500|404)/,
  });
  await page.route(
    (url) => url.pathname === statutePath(id),
    (route) => route.fulfill({ json: { userRole: role } }),
  );
  if (setup) await setup(page);
  await page.goto(pagePath(id));
  return { watch, errors };
}

/** Edits a real CMS read on its way to the page. */
async function edit<T>(page: Page, pathname: string, change: (body: T) => T) {
  await page.route(
    (url) => url.pathname === pathname,
    async (route: Route) => {
      const res = await route.fetch();
      const body = (await res.json()) as T;
      await route.fulfill({ response: res, json: change(body) });
    },
  );
}

const editCompetition = (page: Page, id: string, change: (doc: Doc) => void) =>
  edit<CompetitionBody>(page, competitionPath(id), (body) => {
    change(body.data ?? body);
    return body;
  });

/** The stands are on screen (one reload if a shared-server Fast Refresh stranded the load). */
async function loaded(page: Page) {
  const sector = page.getByRole('heading', { level: 2, name: /^Sector / }).first();
  const ok = await sector.waitFor({ timeout: 12_000 }).then(
    () => true,
    () => false,
  );
  if (!ok) await page.reload();
  await expect(sector).toBeVisible({ timeout: 30_000 });
}

/** `ready` holds — after one reload if a shared-server Fast Refresh stranded the load (see loaded()). */
async function settle(page: Page, ready: (timeout: number) => Promise<unknown>) {
  const ok = await ready(12_000).then(
    () => true,
    () => false,
  );
  if (!ok) await page.reload();
  await ready(30_000);
}

async function shoot(page: Page, name: string) {
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(150);
    await page.screenshot({ path: `.shots/penalizari-stand-${name}-${width}.png`, fullPage: true });
  }
  await page.setViewportSize(PHONE);
}

const noWrites = (watch: Watch) => expect(watch.writes, 'no organizer writes from the stand picker').toEqual([]);
const tiles = (page: Page) => page.locator('main [data-testid^="stand-"][data-allocated]');

test('signed out → sign-in with the return path', async ({ request }) => {
  const res = await request.get(`${BASE_URL}${pagePath(STARTED)}`, { maxRedirects: 0 });
  expect(res.status()).toBe(307);
  expect(res.headers().location).toContain(`/intra?next=${encodeURIComponent(pagePath(STARTED))}`);
});

test('c1/c4 — «Alege standul» + hint; the loader holds until both reads are in; noindex; back to the hub', async ({ page }) => {
  await page.setViewportSize(PHONE);
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  const { watch, errors } = await open(page, STARTED, {
    setup: (p) =>
      p.route(
        (url) => url.pathname === allocationsPath(STARTED),
        async (route) => {
          await gate;
          await route.continue();
        },
      ),
  });
  await expect(page.getByRole('heading', { level: 1, name: 'Alege standul' })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Se încarcă standurile…' })).toBeAttached();
  await expect(page.locator('section[aria-busy="true"]')).toBeVisible();
  // The competition is in, the allocations are not: still the full loader, no stand yet.
  await expect.poll(() => watch.reads.includes(competitionPath(STARTED))).toBe(true);
  await page.waitForTimeout(800);
  await expect(page.getByRole('heading', { level: 2, name: /^Sector / })).toHaveCount(0);
  await shoot(page, 'loading');
  // The skeleton draws the loaded grid: nothing moves when the data lands.
  await page.setViewportSize({ width: 1280, height: 900 });
  const grid = (testId: string) =>
    page.getByTestId(testId).evaluate((el) => {
      const tile = el.querySelector('ul > li > *, div > div > span.rounded-card') as HTMLElement | null;
      return { columns: getComputedStyle(el).gridTemplateColumns.split(' ').length, tileMin: tile ? getComputedStyle(tile).minHeight : null };
    });
  const skeleton = await grid('penalty-stand-skeleton');
  release();
  await loaded(page);
  await expect(page.locator('section[aria-busy="true"]')).toHaveCount(0);
  expect(await grid('stand-groups')).toEqual(skeleton);
  await page.setViewportSize(PHONE);
  await expect(page.getByText('Alege standul echipei pe care vrei să o sancționezi.')).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await expect(page.getByRole('link', { name: 'Înapoi la penalizări' })).toHaveAttribute('href', `/concursuri/${STARTED}/penalizari`);
  noWrites(watch);
  expect(errors).toEqual([]);
});

for (const failing of ['competition', 'allocations'] as const) {
  test(`c4 — the ${failing} read failing → error; «Încearcă din nou» refetches both`, async ({ page }) => {
    await page.setViewportSize(PHONE);
    let fail = true;
    const target = failing === 'competition' ? competitionPath(STARTED) : allocationsPath(STARTED);
    const { watch, errors } = await open(page, STARTED, {
      setup: (p) =>
        p.route(
          (url) => url.pathname === target,
          (route) => (fail ? route.fulfill({ status: 500, json: { error: { status: 500, message: 'boom' } } }) : route.continue()),
        ),
    });
    const gate = page.getByRole('alert');
    await settle(page, (timeout) => expect(gate.getByRole('heading', { name: 'Serverul nu răspunde' })).toBeVisible({ timeout }));
    await expect(page.getByRole('heading', { level: 2, name: /^Sector / })).toHaveCount(0);
    if (failing === 'allocations') {
      await shoot(page, 'error');
      await expectNoA11yViolations(page);
    }
    fail = false;
    const count = (p: string) => watch.reads.filter((r) => r === p).length;
    const before = { c: count(competitionPath(STARTED)), a: count(allocationsPath(STARTED)) };
    await page.getByRole('button', { name: 'Încearcă din nou' }).click();
    await loaded(page);
    expect(count(competitionPath(STARTED))).toBeGreaterThan(before.c);
    expect(count(allocationsPath(STARTED))).toBeGreaterThan(before.a);
    noWrites(watch);
    expect(errors).toEqual([]);
  });
}

test('c4 — a missing competition is an error, not an empty picker', async ({ page }) => {
  await page.setViewportSize(PHONE);
  const { watch } = await open(page, 'nu-exista-e2e-penalizari');
  const notFound = page.getByRole('alert').getByRole('heading', { name: 'Nu am găsit datele' });
  await settle(page, (timeout) => expect(notFound).toBeVisible({ timeout }));
  await expect(page.getByRole('heading', { level: 2, name: /^Sector / })).toHaveCount(0);
  noWrites(watch);
});

test('c2/c5 — «Sector X» in the competition’s order, stands in the sector’s order; desktop is a multi-column grid', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  let order: string[] = [];
  let firstSectorStands: string[] = [];
  const { watch, errors } = await open(page, STARTED, {
    setup: (p) =>
      editCompetition(p, STARTED, (doc) => {
        // Reversed sectors, and the first sector given a second stand before its own: the page must
        // follow the competition, not sort by name.
        doc.sectors = [...doc.sectors].reverse();
        const [first, second] = doc.sectors;
        first.stands = [...second.stands, ...first.stands];
        doc.sectors = doc.sectors.filter((s) => s !== second);
        order = doc.sectors.map((s) => `Sector ${s.name}`);
        firstSectorStands = first.stands.map((s) => `Stand ${s.name}`);
      }),
  });
  await loaded(page);
  expect(order.length).toBeGreaterThan(1);
  await expect(page.locator('main').getByRole('heading', { level: 2, name: /^Sector / })).toHaveText(order);
  const first = page.locator('main ul[data-testid^="stand-group-"]').first();
  await expect(first.locator('[data-testid^="stand-"] .t-body-strong')).toHaveText(firstSectorStands);
  const columns = await page.getByTestId('stand-groups').evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
  expect(columns).toBeGreaterThanOrEqual(3);
  await shoot(page, 'individual');
  await expectNoA11yViolations(page);
  noWrites(watch);
  expect(errors).toEqual([]);
});

test('c2/c5 — individual: «Stand N», the participants joined «, », a guest by name, no bold team', async ({ page }) => {
  await page.setViewportSize(PHONE);
  const ids: string[] = [];
  const { watch, errors } = await open(page, STARTED, {
    setup: (p) =>
      edit<AllocBody>(p, allocationsPath(STARTED), (body) => {
        const allocated = Object.entries(body.data).filter(([, a]) => a);
        const [[pairId, pair], [guestId, guest]] = allocated;
        pair!.participants = [person(90001, 'Ion Pop'), person(90002, 'Vasile Ene')];
        pair!.guestName = '';
        pair!.teamName = 'Nu se arată';
        guest!.guestName = 'Oaspete Invitat';
        guest!.participants = [person(90003, 'Nu se arată')];
        ids.push(pairId, guestId);
        return body;
      }),
  });
  await loaded(page);
  const pair = page.getByTestId(`stand-${ids[0]}`);
  await expect(pair).toContainText(/^Stand \S+/);
  await expect(pair).toContainText('Ion Pop, Vasile Ene');
  await expect(pair).not.toContainText('Nu se arată');
  await expect(pair.locator('.font-bold')).toHaveCount(0);
  const guest = page.getByTestId(`stand-${ids[1]}`);
  await expect(guest).toContainText('Oaspete Invitat');
  await expect(guest).not.toContainText('Nu se arată');
  noWrites(watch);
  expect(errors).toEqual([]);
});

test('c2/c5 — team: «<echipă>:» bold, then the members', async ({ page }) => {
  await page.setViewportSize(PHONE);
  const { watch, errors } = await open(page, TEAM, {
    setup: (p) => editCompetition(p, TEAM, (doc) => Object.assign(doc, { competitionStatus: 'started' })),
  });
  await loaded(page);
  const tile = tiles(page).filter({ hasText: 'Nada Grea' });
  await expect(tile).toContainText('Nada Grea: Andrei Popescu, Mihai Ionescu');
  await expect(tile.locator('.font-bold')).toHaveText('Nada Grea:');
  await shoot(page, 'team');
  await expectNoA11yViolations(page);
  noWrites(watch);
  expect(errors).toEqual([]);
});

test('c5 — team allocation with an empty teamName: no bold prefix, no invented «Echipă» (fish :84)', async ({ page }) => {
  await page.setViewportSize(PHONE);
  let id = '';
  const { watch, errors } = await open(page, TEAM, {
    setup: async (p) => {
      await editCompetition(p, TEAM, (doc) => Object.assign(doc, { competitionStatus: 'started' }));
      await edit<AllocBody>(p, allocationsPath(TEAM), (body) => {
        const [[allocId, a]] = Object.entries(body.data).filter(([, x]) => x && x.teamName === 'Nada Grea');
        a!.teamName = '';
        a!.guestName = '';
        a!.participants = [person(90011, 'Ion Pop'), person(90012, 'Vasile Ene')];
        id = allocId;
        return body;
      });
    },
  });
  await loaded(page);
  const tile = page.getByTestId(`stand-${id}`);
  await expect(tile).toContainText('Ion Pop, Vasile Ene');
  await expect(tile).not.toContainText('Echipă');
  await expect(tile).not.toContainText(':');
  await expect(tile.locator('.font-bold')).toHaveCount(0);
  await expect(tile).toHaveAttribute('href', /\/penalizari\/aplica\?inscriere=/);
  noWrites(watch);
  expect(errors).toEqual([]);
});

for (const role of ['author', 'referee'] as const) {
  test(`no stands on any sector → the ${role}'s empty note`, async ({ page }) => {
    await page.setViewportSize(PHONE);
    const { watch, errors } = await open(page, STARTED, {
      role,
      setup: (p) =>
        editCompetition(p, STARTED, (doc) => {
          for (const s of doc.sectors) s.stands = [];
        }),
    });
    const note = page.getByTestId('penalty-stand-empty');
    await settle(page, (timeout) => expect(note).toBeVisible({ timeout }));
    await expect(page.getByRole('heading', { level: 2, name: /^Sector / })).toHaveCount(0);
    await expect(page.getByRole('searchbox')).toHaveCount(0);
    const link = note.getByRole('link', { name: 'Alocă standuri pe sectoare' });
    if (role === 'author') {
      await expect(note).toContainText('Concursul nu are încă standuri. Adaugă sectoarele și standurile din pagina sectoarelor.');
      await expect(link).toHaveAttribute('href', `/concursuri/${STARTED}/sectoare`);
      await shoot(page, 'empty');
    } else {
      await expect(note).toContainText('Concursul nu are încă standuri. Cere organizatorului să adauge sectoarele și standurile.');
      await expect(link).toHaveCount(0);
      await shoot(page, 'empty-referee');
    }
    await expectNoA11yViolations(page);
    noWrites(watch);
    expect(errors).toEqual([]);
  });
}

test('c3/c6 — «Nealocat» is dimmed and inert; allocated opens the apply form once; no registration id → nothing', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const ids = { free: '', noReg: '', target: '', reg: '' };
  let noRegName = '';
  const { watch, errors } = await open(page, STARTED, {
    setup: (p) =>
      edit<AllocBody>(p, allocationsPath(STARTED), (body) => {
        const allocated = Object.entries(body.data).filter(([, a]) => a);
        const [[freeId], [noRegId, noReg], [targetId, target]] = allocated;
        body.data[freeId] = null;
        noReg!.registrationId = '';
        noReg!.guestName = '';
        noReg!.participants = [person(90021, 'Fără Înscriere')];
        noRegName = 'Fără Înscriere';
        Object.assign(ids, { free: freeId, noReg: noRegId, target: targetId, reg: target!.registrationId });
        return body;
      }),
  });
  await loaded(page);
  // Unallocated: «Nealocat», dashed + dimmed, not a link or a button, not focusable.
  const free = page.getByTestId(`stand-${ids.free}`);
  await expect(free).toContainText('Nealocat');
  await expect(free).toHaveAttribute('aria-disabled', 'true');
  expect(await free.evaluate((n) => n.tagName)).toBe('DIV');
  await expect(free).toHaveClass(/outline-dashed/);
  await free.click();
  await page.waitForTimeout(400);
  expect(path(page.url())).toBe(pagePath(STARTED));
  // An allocation without a registration id: its occupant is shown, but drawn inert (dashed,
  // aria-disabled) with «Înscriere indisponibilă» — not a target, clicking does nothing.
  const noReg = page.getByTestId(`stand-${ids.noReg}`);
  expect(await noReg.evaluate((n) => n.tagName)).toBe('DIV');
  await expect(noReg).not.toHaveAttribute('href');
  await expect(noReg).toHaveAttribute('aria-disabled', 'true');
  await expect(noReg).toHaveClass(/outline-dashed/);
  await expect(noReg).toContainText(noRegName);
  await expect(noReg).not.toContainText('Nealocat');
  await expect(noReg.getByTestId('penalty-stand-unavailable')).toHaveText('Înscriere indisponibilă');
  await noReg.click();
  await page.waitForTimeout(400);
  expect(path(page.url())).toBe(pagePath(STARTED));
  await shoot(page, 'unallocated');
  // Allocated: a link to the apply form for its registration.
  const target = page.getByTestId(`stand-${ids.target}`);
  const href = `/concursuri/${STARTED}/penalizari/aplica?inscriere=${encodeURIComponent(ids.reg)}`;
  await expect(target).toHaveAttribute('href', href);
  // organizer.b.navigation-guard: a double click opens the form once (one history entry pushed).
  await page.evaluate(() => {
    const w = window as unknown as { __pushes: string[] };
    w.__pushes = [];
    const push = history.pushState.bind(history);
    history.pushState = (data, unused, url) => {
      w.__pushes.push(String(url));
      push(data, unused, url);
    };
  });
  await target.dblclick();
  await page.waitForURL((u) => u.pathname === `/concursuri/${STARTED}/penalizari/aplica` && u.searchParams.get('inscriere') === ids.reg);
  // The real apply form (organizer.penalties-apply), not a not-found page on the right URL.
  await expect(page.getByRole('heading', { level: 1, name: 'Aplică penalizare' })).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(1500);
  const pushes = await page.evaluate(() => (window as unknown as { __pushes: string[] }).__pushes);
  expect(pushes.filter((u) => u.includes('/penalizari/aplica'))).toHaveLength(1);
  noWrites(watch);
  expect(errors.filter((e) => !/404/.test(e))).toEqual([]);
});

for (const [label, change] of [
  ['a ranking type without penalties', { rankingType: 'quality' }],
  ['a competition that is not started', { competitionStatus: 'notStarted' }],
  ['a completed competition', { competitionStatus: 'completed' }],
] as const) {
  test(`${label} → back to the penalties hub (replace)`, async ({ page }) => {
    await page.setViewportSize(PHONE);
    const { watch } = await open(page, STARTED, {
      setup: (p) => editCompetition(p, STARTED, (doc) => Object.assign(doc, change)),
    });
    await settle(page, (timeout) => page.waitForURL((u) => u.pathname === `/concursuri/${STARTED}/penalizari`, { timeout }));
    // Replaced, not pushed: going back does not land on the picker again.
    expect(await page.evaluate(() => history.length)).toBeLessThanOrEqual(2);
    noWrites(watch);
  });
}

test('the gate: a participant gets «Doar pentru organizator și arbitri»; a referee gets the picker', async ({ page }) => {
  await page.setViewportSize(PHONE);
  const { watch } = await open(page, STARTED, { role: 'participant' });
  const denied = page.getByRole('heading', { name: 'Doar pentru organizator și arbitri' });
  await settle(page, (timeout) => expect(denied).toBeVisible({ timeout }));
  await expect(page.getByRole('heading', { level: 2, name: /^Sector / })).toHaveCount(0);
  await shoot(page, 'denied');
  noWrites(watch);
  await page.unroute((url) => url.pathname === statutePath(STARTED));
  await page.route(
    (url) => url.pathname === statutePath(STARTED),
    (route) => route.fulfill({ json: { userRole: 'referee' } }),
  );
  await page.reload();
  await loaded(page);
  noWrites(watch);
});

test('find-as-you-type and the refresh action', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1000 });
  let name = '';
  const { watch, errors } = await open(page, STARTED, {
    setup: (p) =>
      edit<AllocBody>(p, allocationsPath(STARTED), (body) => {
        const a = Object.values(body.data).find((x) => x && x.participants.length);
        name = a?.participants[0]?.name ?? '';
        return body;
      }),
  });
  await loaded(page);
  expect(name).not.toBe('');
  const search = page.getByRole('searchbox', { name: 'Caută stand, pescar sau echipă' });
  await search.fill(name.split(' ')[0]);
  for (const t of await tiles(page).all()) await expect(t).toContainText(name.split(' ')[0]);
  await search.fill('zzzz-nimic');
  await expect(page.getByTestId('penalty-stand-no-results')).toContainText('Nu există niciun stand sau pescar pentru «zzzz-nimic».');
  await shoot(page, 'no-results');
  await search.fill('');
  const count = (p: string) => watch.reads.filter((r) => r === p).length;
  const before = { c: count(competitionPath(STARTED)), a: count(allocationsPath(STARTED)) };
  await page.getByRole('button', { name: 'Reîmprospătează' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Datele au fost actualizate.' })).toBeAttached();
  expect(count(competitionPath(STARTED))).toBeGreaterThan(before.c);
  expect(count(allocationsPath(STARTED))).toBeGreaterThan(before.a);
  await expectNoA11yViolations(page);
  noWrites(watch);
  expect(errors).toEqual([]);
});
