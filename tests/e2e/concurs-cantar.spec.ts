import { existsSync, mkdirSync } from 'node:fs';
import { expect, test, type Page, type Request, type Route } from '@playwright/test';
import { expectNoA11yViolations } from './helpers/a11y';
import { BASE_URL } from './helpers/base-url';
import { collectConsoleErrors } from './helpers/console';
import { qaJwt, signIn } from './helpers/session';

/*
 * Cântar — «Alege standul» (parity organizer.scale c1–c5; fish app/(app)/scale/[competitionId]/index.tsx).
 *
 * READS ONLY. The competitions are the local CMS's own (a started individual competition, a team
 * one, an individual one with guests, and the national championship with three free stands); a
 * state the local data does not have (a draw position, a sector order, a failure, a slow CMS) is
 * made by editing the real response in page.route. Every request to the browser's CMS edge is
 * watched: a single non-GET fails the spec (organizer writes push to real devices).
 */

// One retry: the shared dev server's Fast Refresh (other agents' edits) can strand a load (see loaded()).
test.describe.configure({ timeout: 180_000, retries: 1 });

const STARTED = process.env.E2E_SCALE_STARTED ?? 'kee49a3e64b3f636b4b60daa'; // [CHAT25] individual, started, 24 stands
const TEAM = process.env.E2E_SCALE_TEAM ?? 'g5l98otx5ypg6wttowra9yww'; // TEST Card · Echipă: «Nada Grea»
const GUESTS = process.env.E2E_SCALE_GUESTS ?? 'i8kzbi5k51vmbyq75dmyez3d'; // Andrew 1: individual, guests
const NC = process.env.E2E_SCALE_NC ?? 'z7rvhm55ziyr0tbblqwjp39q'; // CN Test: clubs, 3 free stands

const PHONE = { width: 375, height: 812 };
/** The stand page (organizer.scale-history) — c5's navigation is only checked once it exists. */
const STAND_PAGE_SHIPPED = existsSync('app/(site)/concursuri/[id]/cantar/[standId]/page.tsx');
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

type Watch = { writes: string[]; reads: string[] };

/** Signs in, watches the CMS edge (no writes, ever) and the console. */
async function open(page: Page, id: string, setup?: (page: Page) => Promise<unknown>) {
  await signIn(page.context(), jwt);
  const watch: Watch = { writes: [], reads: [] };
  page.on('request', (r) => {
    if (!isCms(r)) return;
    if (r.method() !== 'GET') watch.writes.push(`${r.method()} ${path(r.url())}`);
    else watch.reads.push(path(r.url()));
  });
  const errors = collectConsoleErrors(page, {
    // The deliberate failures this spec serves (500 on a read) are logged by the browser as failed resources.
    ignore: /Failed to load resource: the server responded with a status of 500/,
  });
  if (setup) await setup(page);
  await page.goto(`/concursuri/${id}/cantar`);
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

const statute = (page: Page, id: string, userRole: 'author' | 'referee' | 'participant' | null) =>
  page.route(
    (url) => url.pathname === statutePath(id),
    (route) => route.fulfill({ json: { userRole } }),
  );

/**
 * The stands are on screen. On the shared dev server a Fast Refresh fired by another agent's edit can
 * remount the page's providers mid-load and leave it on the skeleton with every read answered
 * (observed 2026-10-08: all five /api/cms reads 200 within 1 s, «[Fast Refresh] rebuilding», no
 * further request). A production build has no Fast Refresh: one reload, then the real assertion.
 */
async function loaded(page: Page) {
  const sector = page.getByRole('heading', { level: 2, name: /^Sector / }).first();
  const ok = await sector.waitFor({ timeout: 12_000 }).then(
    () => true,
    () => false,
  );
  if (!ok) await page.reload();
  await expect(sector).toBeVisible({ timeout: 30_000 });
}

async function shoot(page: Page, name: string) {
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(150);
    await page.screenshot({ path: `.shots/cantar-${name}-${width}.png`, fullPage: true });
  }
  await page.setViewportSize(PHONE);
}

const noWrites = (watch: Watch) => expect(watch.writes, 'no organizer writes from the scale').toEqual([]);

test('signed out → sign-in with the return path (organizer.b.signed-out-gate)', async ({ request }) => {
  const res = await request.get(`${BASE_URL}/concursuri/${STARTED}/cantar`, { maxRedirects: 0 });
  expect(res.status()).toBe(307);
  expect(res.headers().location).toContain(`/intra?next=${encodeURIComponent(`/concursuri/${STARTED}/cantar`)}`);
});

test('organizer.scale.c1 — «Alege standul», loading, then the stands; noindex', async ({ page }) => {
  await page.setViewportSize(PHONE);
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  const { watch, errors } = await open(page, STARTED, async (p) => {
    await p.route(
      (url) => url.pathname === allocationsPath(STARTED),
      async (route) => {
        await gate;
        await route.continue();
      },
    );
  });
  await expect(page.getByRole('heading', { level: 1, name: 'Alege standul' })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Se încarcă standurile…' })).toBeAttached();
  await expect(page.locator('section[aria-busy="true"]')).toBeVisible();
  await shoot(page, 'loading');
  // The skeleton draws the loaded grid (same track, same tile height): nothing moves when it lands.
  await page.setViewportSize({ width: 1280, height: 900 });
  const grid = (testId: string) =>
    page.getByTestId(testId).evaluate((el) => {
      const tile = el.querySelector('ul > li > *, div > div > span.rounded-card') as HTMLElement | null;
      return { columns: getComputedStyle(el).gridTemplateColumns.split(' ').length, tileMin: tile ? getComputedStyle(tile).minHeight : null };
    });
  const skeleton = await grid('scale-skeleton');
  release();
  await loaded(page);
  await expect(page.locator('section[aria-busy="true"]')).toHaveCount(0);
  const real = await grid('stand-groups');
  expect(skeleton).toEqual(real);
  await page.setViewportSize(PHONE);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  // The competition is the eyebrow; back goes to the competition page.
  await expect(page.getByRole('link', { name: 'Înapoi la concurs' })).toHaveAttribute('href', `/concursuri/${STARTED}`);
  noWrites(watch);
  expect(errors).toEqual([]);
});

test('organizer.scale.c1 — an error offers «Încearcă din nou», which refetches the competition and the allocations', async ({ page }) => {
  await page.setViewportSize(PHONE);
  let fail = true;
  let release!: () => void;
  const slow = new Promise<void>((r) => (release = r));
  const { watch, errors } = await open(page, STARTED, async (p) => {
    await p.route(
      (url) => url.pathname === allocationsPath(STARTED),
      async (route) => {
        if (fail) return route.fulfill({ status: 500, json: { error: { status: 500, message: 'boom' } } });
        await slow;
        return route.continue();
      },
    );
  });
  const gate = page.getByRole('alert');
  await expect(gate.getByRole('heading', { name: 'Serverul nu răspunde' })).toBeVisible({ timeout: 30_000 });
  await shoot(page, 'error');
  await expectNoA11yViolations(page);
  fail = false;
  const before = { competition: watch.reads.filter((r) => r === competitionPath(STARTED)).length, alloc: watch.reads.filter((r) => r === allocationsPath(STARTED)).length };
  const allocBefore = watch.reads.filter((r) => r === allocationsPath(STARTED)).length;
  // A double click fires one round of refetches, not two.
  await page.getByRole('button', { name: 'Încearcă din nou' }).dblclick();
  // While it runs the gate gives way to the busy skeleton, announced once (fish ErrorScreen → loading):
  // react-query puts a never-loaded query back to pending on refetch.
  await expect(page.locator('section[aria-busy="true"]')).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Se încarcă standurile…' })).toBeAttached();
  await expect(page.getByRole('button', { name: 'Încearcă din nou' })).toHaveCount(0);
  await page.waitForTimeout(500);
  expect(watch.reads.filter((r) => r === allocationsPath(STARTED)).length).toBe(allocBefore + 1);
  release();
  await loaded(page);
  expect(watch.reads.filter((r) => r === competitionPath(STARTED)).length).toBeGreaterThan(before.competition);
  expect(watch.reads.filter((r) => r === allocationsPath(STARTED)).length).toBeGreaterThan(before.alloc);
  noWrites(watch);
  expect(errors).toEqual([]);
});

test('organizer.scale.c1 — an unknown competition is «Nu am găsit datele», not an empty picker', async ({ page }) => {
  await page.setViewportSize(PHONE);
  const { watch } = await open(page, 'nu-exista-e2e-cantar');
  await expect(page.getByRole('alert').getByRole('heading', { name: 'Nu am găsit datele' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('heading', { level: 2, name: /^Sector / })).toHaveCount(0);
  noWrites(watch);
});

test('organizer.scale.c2 — «Sector X» groups in the competition’s own sector order', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  type Body = { sectors: { name: string }[]; data?: { sectors: { name: string }[] } };
  let order: string[] = [];
  const { watch, errors } = await open(page, STARTED, async (p) => {
    await edit<Body>(p, competitionPath(STARTED), (body) => {
      const doc = body.data ?? body;
      // Reversed: the page must follow the competition, not sort by name.
      doc.sectors = [...doc.sectors].reverse();
      order = doc.sectors.map((s) => `Sector ${s.name}`);
      return body;
    });
  });
  await loaded(page);
  expect(order.length).toBeGreaterThan(1);
  const headings = page.locator('main').getByRole('heading', { level: 2, name: /^Sector / });
  await expect(headings).toHaveText(order);
  // Desktop: a multi-column grid of tiles, not the phone list stretched (rule 14).
  const columns = await page.getByTestId('stand-groups').evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
  expect(columns).toBeGreaterThanOrEqual(3);
  // This field is 24 sectors of one stand: they pack side by side, not one row each.
  const [a, b] = await Promise.all([headings.nth(0).boundingBox(), headings.nth(1).boundingBox()]);
  expect(a && b && Math.abs(a.y - b.y) < 2 && b.x > a.x).toBe(true);
  // The aside's jump list has the same order.
  await expect(page.getByRole('navigation', { name: 'Sectoare' }).getByRole('link')).toHaveText(order.map((s) => new RegExp(`^${s}`)));
  noWrites(watch);
  expect(errors).toEqual([]);
});

test('organizer.scale.c3 — individual: «Stand N» and the participants; an author on a started competition gets the weighing tone', async ({ page }) => {
  await page.setViewportSize(PHONE);
  const { watch, errors } = await open(page, STARTED, (p) => statute(p, STARTED, 'author'));
  await loaded(page);
  await expect(page.getByText('Alege standul pe care îl cântărești.')).toBeVisible();
  const first = page.locator('main a[data-testid^="stand-"]').first();
  await expect(first).toContainText(/^Stand \S+/);
  await expect(first).toContainText('Andrei Popescu');
  await expect(first).toHaveClass(/bg-accent-tint/);
  await shoot(page, 'started-author');
  await expectNoA11yViolations(page);
  noWrites(watch);
  expect(errors).toEqual([]);
});

test('organizer.scale.c3 — a participant reads the same list, neutral (no weighing promise)', async ({ page }) => {
  await page.setViewportSize(PHONE);
  const { watch } = await open(page, STARTED, (p) => statute(p, STARTED, 'participant'));
  await loaded(page);
  await expect(page.getByText('Alege un stand ca să vezi cântăririle lui.')).toBeVisible();
  await expect(page.locator('main a[data-testid^="stand-"]').first()).toHaveClass(/bg-soft-fill/);
  noWrites(watch);
});

test('a closed feeder leg promises no weighing: neutral tiles and «se redeschide la pornirea manșei 2»', async ({ page }) => {
  await page.setViewportSize(PHONE);
  type Body = Record<string, unknown> & { data?: Record<string, unknown> };
  const { watch, errors } = await open(page, STARTED, async (p) => {
    await statute(p, STARTED, 'author');
    await edit<Body>(p, competitionPath(STARTED), (body) => {
      const doc = body.data ?? body;
      Object.assign(doc, { rankingType: 'feederRounds', roundsCount: 2, currentRound: 1, roundStatus: 'closed' });
      return body;
    });
  });
  await loaded(page);
  await expect(page.getByText('Manșa 1 este încheiată: cântarul se redeschide la pornirea manșei 2.')).toBeVisible();
  await expect(page.getByText('Alege standul pe care îl cântărești.')).toHaveCount(0);
  await expect(page.locator('main a[data-testid^="stand-"]').first()).toHaveClass(/bg-soft-fill/);
  noWrites(watch);
  expect(errors).toEqual([]);
});

test('organizer.scale.c3 — team: «<echipă>:» bold, then the members', async ({ page }) => {
  await page.setViewportSize(PHONE);
  const { watch, errors } = await open(page, TEAM);
  await loaded(page);
  const tile = page.locator('main a[data-testid^="stand-"]').filter({ hasText: 'Nada Grea' });
  await expect(tile).toContainText('Nada Grea: Andrei Popescu, Mihai Ionescu');
  await expect(tile.locator('.font-bold')).toHaveText('Nada Grea:');
  await shoot(page, 'team');
  await expectNoA11yViolations(page);
  noWrites(watch);
  expect(errors).toEqual([]);
});

test('organizer.scale.c3 — guests: the guest name', async ({ page }) => {
  await page.setViewportSize(PHONE);
  type Alloc = { data: Record<string, { guestName: string } | null> };
  let guest = '';
  const { watch } = await open(page, GUESTS, async (p) => {
    await edit<Alloc>(p, allocationsPath(GUESTS), (body) => {
      guest = Object.values(body.data).find((a) => a?.guestName)?.guestName ?? '';
      return body;
    });
  });
  await loaded(page);
  expect(guest).not.toBe('');
  await expect(page.locator('main a[data-testid^="stand-"]').filter({ hasText: guest }).first()).toBeVisible();
  noWrites(watch);
});

test('organizer.scale.c4 — national championship: the club under the stand label, and the national format with the draw position', async ({ page }) => {
  await page.setViewportSize(PHONE);
  type Alloc = { data: Record<string, { sectorDrawPosition: number | null; clubName?: string } | null> };
  let drawn = '';
  const { watch, errors } = await open(page, NC, async (p) => {
    await edit<Alloc>(p, allocationsPath(NC), (body) => {
      // The local CN has no draw yet: give the first allocated stand position 2.
      const [standId, alloc] = Object.entries(body.data).find(([, a]) => a) ?? [];
      if (standId && alloc) {
        alloc.sectorDrawPosition = 2;
        drawn = standId;
      }
      return body;
    });
  });
  await loaded(page);
  const tile = page.getByTestId(`stand-${drawn}`);
  await expect(tile).toContainText(/^Stand A2\(\d+\)/);
  await expect(page.locator('main a[data-testid^="stand-"]').filter({ hasText: 'Stand A1' }).first()).toBeVisible();
  // The club is its own line (accent label) under the stand label.
  const club = page.locator('main a[data-testid^="stand-"] .text-accent-ink').first();
  await expect(club).toHaveText(/\S/);
  await shoot(page, 'nc');
  await expectNoA11yViolations(page);
  noWrites(watch);
  expect(errors).toEqual([]);
});

test('organizer.scale.c5 — unallocated stands are dimmed and inert; an allocated stand links to its weighings', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const { watch } = await open(page, NC);
  await loaded(page);
  const free = page.locator('main [data-testid^="stand-"][data-allocated="false"]');
  await expect(free).toHaveCount(3);
  for (const el of await free.all()) {
    await expect(el).toHaveAttribute('aria-disabled', 'true');
    expect(await el.evaluate((n) => n.tagName)).toBe('DIV');
    await expect(el).toContainText('-');
  }
  await expect(free.first()).not.toHaveAttribute('href');
  await expect(page.getByText('7 standuri · 1 nealocat').first()).toBeVisible();
  const tile = page.locator('main a[data-testid^="stand-"]').first();
  const standId = (await tile.getAttribute('data-testid'))!.replace('stand-', '');
  await expect(tile).toHaveAttribute('href', `/concursuri/${NC}/cantar/${standId}`);
  noWrites(watch);
});

test('organizer.scale.c5 — an allocated stand opens its weighing history, once (double click)', async ({ page }) => {
  // The target is organizer.scale-history (next batch): until its page exists the link 404s, so the
  // navigation is not claimed (c5 stays partial in the parity inventory).
  test.fixme(!STAND_PAGE_SHIPPED, 'organizer.scale-history (/concursuri/[id]/cantar/[standId]) is not built yet');
  await page.setViewportSize({ width: 1280, height: 900 });
  const { watch } = await open(page, NC);
  await loaded(page);
  const tile = page.locator('main a[data-testid^="stand-"]').first();
  const standId = (await tile.getAttribute('data-testid'))!.replace('stand-', '');
  // organizer.b.navigation-guard: a double click opens the stand once (one history entry pushed).
  await page.evaluate(() => {
    const w = window as unknown as { __pushes: string[] };
    w.__pushes = [];
    const push = history.pushState.bind(history);
    history.pushState = (data, unused, url) => {
      w.__pushes.push(String(url));
      push(data, unused, url);
    };
  });
  await tile.dblclick();
  await page.waitForURL(`**/concursuri/${NC}/cantar/${standId}`);
  // The real stand page, not a not-found page on the right URL.
  await expect(page.getByRole('heading', { level: 1, name: /^Istoric cânt/ })).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(1500);
  const pushes = await page.evaluate(() => (window as unknown as { __pushes: string[] }).__pushes);
  expect(pushes.filter((u) => u.includes(`/cantar/${standId}`))).toHaveLength(1);
  noWrites(watch);
});

test('find-as-you-type and the refresh action (fish pull-to-refresh)', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1000 });
  const { watch, errors } = await open(page, NC);
  await loaded(page);
  await shoot(page, 'nc-desktop');
  const search = page.getByRole('searchbox', { name: 'Caută stand, pescar, echipă sau club' });
  await search.fill('ardeal');
  await expect(page.getByText(/^(\d+ standuri găsite|1 stand găsit)$/)).toBeVisible();
  const tiles = page.locator('main [data-testid^="stand-"]');
  for (const t of await tiles.all()) await expect(t).toContainText('Ardealul');
  // The aside follows the search: «Căutare: …», and only sectors with matches are links — each to a
  // heading that is on the page; the others are dimmed and inert.
  await page.setViewportSize({ width: 1920, height: 1000 });
  await expect(page.getByTestId('scale-filter-count')).toHaveText(/^Căutare: (\d+ standuri găsite|1 stand găsit)$/);
  const jumps = page.getByRole('navigation', { name: 'Sectoare' }).getByRole('link');
  expect(await jumps.count()).toBeGreaterThan(0);
  for (const a of await jumps.all()) {
    const target = (await a.getAttribute('href'))!.slice(1);
    await expect(page.locator(`[id="${target}"]`)).toHaveCount(1);
  }
  const inert = page.getByRole('navigation', { name: 'Sectoare' }).locator('[aria-disabled="true"]');
  for (const el of await inert.all()) await expect(el).toContainText(/0\/\d+/);
  await shoot(page, 'filtered');
  await search.fill('zzzz-nimic');
  await expect(page.getByTestId('scale-no-results')).toContainText('Nu există niciun stand sau pescar pentru «zzzz-nimic».');
  await shoot(page, 'no-results');
  await search.fill('');
  await expect(page.getByTestId('scale-filter-count')).toHaveCount(0);

  const before = watch.reads.filter((r) => r === allocationsPath(NC)).length;
  const beforeC = watch.reads.filter((r) => r === competitionPath(NC)).length;
  await page.getByRole('button', { name: 'Reîmprospătează' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Datele au fost actualizate.' })).toBeAttached();
  expect(watch.reads.filter((r) => r === allocationsPath(NC)).length).toBeGreaterThan(before);
  expect(watch.reads.filter((r) => r === competitionPath(NC)).length).toBeGreaterThan(beforeC);
  await expectNoA11yViolations(page);
  noWrites(watch);
  expect(errors).toEqual([]);
});
