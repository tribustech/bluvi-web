import { mkdirSync } from 'node:fs';
import { expect, test, type Page, type Request, type Route } from '@playwright/test';
import { expectNoA11yViolations } from './helpers/a11y';
import { BASE_URL } from './helpers/base-url';
import { collectConsoleErrors } from './helpers/console';
import { CMS, qaJwt, signIn } from './helpers/session';

/*
 * «Istoric cântăriri» — one stand's weighings (parity organizer.scale-history c1–c11; fish
 * app/(app)/scale/[competitionId]/history.tsx, components/scale/CantarItem.tsx,
 * components/StartCantarSheet.tsx).
 *
 * READS hit the local CMS. WRITES NEVER DO: starting and deleting a weighing push to real devices,
 * so every non-GET to the browser's CMS edge is aborted by a catch-all route, and the two writes this
 * page can make (POST /weighings/start, DELETE /weighings/:id) are answered by page.route with the
 * method, path and body asserted. A state the local data does not have (author / referee statute,
 * an open or empty weighing, a feeder leg, a failure) is made by editing or replacing a read.
 */

test.describe.configure({ timeout: 180_000, retries: 1 });

const STARTED = process.env.E2E_SCALE_STARTED ?? 'kee49a3e64b3f636b4b60daa'; // [CHAT25] started, individual
const STARTED_STAND = process.env.E2E_SCALE_STARTED_STAND ?? 'k2e3916d1d9a5ef6ec639458'; // 3 weighings
const GUESTS = process.env.E2E_SCALE_GUESTS ?? 'i8kzbi5k51vmbyq75dmyez3d'; // Andrew 1: completed
const GUESTS_STAND = process.env.E2E_SCALE_GUESTS_STAND ?? 'mxai2v2orwupnoxu9vxn5iph'; // 6 weighings, one extra
const TEAM = process.env.E2E_SCALE_TEAM ?? 'g5l98otx5ypg6wttowra9yww';
const NC = process.env.E2E_SCALE_NC ?? 'z7rvhm55ziyr0tbblqwjp39q';

const PHONE = { width: 375, height: 812 };
const DESKTOP = { width: 1440, height: 900 };
const WIDTHS = [375, 1280, 1440, 1920];

let jwt = '';
test.beforeAll(async ({ request }) => {
  jwt = await qaJwt(request);
  mkdirSync('.shots', { recursive: true });
});

const path = (url: string) => new URL(url).pathname;
const isCms = (r: Request) => path(r.url()).startsWith('/api/cms/');
const page_ = (id: string, stand: string) => `/concursuri/${id}/cantar/${stand}`;
const competitionPath = (id: string) => `/api/cms/feed/competitions/${id}`;
const allocationsPath = (id: string) => `/api/cms/competitions/${id}/allocated-participants`;
const statutePath = (id: string) => `/api/cms/user/profile/competition/${id}/statute`;
const BY_STAND = '/api/cms/feed/weighings/by-stand';

type Weighing = {
  id: number;
  documentId: string;
  weighingType: 'normal' | 'extra';
  weighingStatus: 'started' | 'finished';
  startDate: string | null;
  endDate: string | null;
  catches: { weight: number }[];
};
type Watch = { writes: string[]; reads: string[] };

/** fish CantarItem `dd.MM, HH:mm`, in Bucharest. */
function ddmm(iso: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Bucharest', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date(iso))
      .map((x) => [x.type, x.value]),
  );
  return `${p.day}.${p.month}, ${p.hour}:${p.minute}`;
}
const kg = (n: number) => n.toFixed(3).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d),)/g, '.');

/**
 * Signs in, aborts every CMS write that no test route answers (registered first: later routes win),
 * watches the CMS edge and the console.
 */
async function open(page: Page, id: string, stand: string, setup?: (page: Page) => Promise<unknown>) {
  await signIn(page.context(), jwt);
  await page.route(
    (url) => url.pathname.startsWith('/api/cms/'),
    (route) => (route.request().method() === 'GET' ? route.fallback() : route.abort()),
  );
  const watch: Watch = { writes: [], reads: [] };
  page.on('request', (r) => {
    if (!isCms(r)) return;
    if (r.method() !== 'GET') watch.writes.push(`${r.method()} ${path(r.url())}`);
    else watch.reads.push(path(r.url()) + new URL(r.url()).search);
  });
  const errors = collectConsoleErrors(page, {
    // Deliberate failures this spec serves (500/400 on a read or a mocked write) are logged as failed resources.
    ignore: /Failed to load resource: the server responded with a status of (500|400)/,
  });
  if (setup) await setup(page);
  await page.goto(page_(id, stand));
  return { watch, errors };
}

const count = (watch: Watch, prefix: string) => watch.reads.filter((r) => r.startsWith(prefix)).length;

const statute = (page: Page, id: string, userRole: 'author' | 'referee' | 'participant' | null) =>
  page.route(
    (url) => url.pathname === statutePath(id),
    (route) => route.fulfill({ json: { userRole, isReferee: userRole === 'referee', isParticipant: userRole === 'participant' } }),
  );

/**
 * Replaces the stand's weighings (every request to by-stand), and the side panel's read of one of
 * them (/feed/weighings/:id, from 1280) with the same made-up weighing.
 */
async function weighings(page: Page, list: Weighing[] | (() => Weighing[])) {
  const current = () => (typeof list === 'function' ? list() : list);
  await page.route(
    (url) => url.pathname === BY_STAND,
    (route) => route.fulfill({ json: { data: current() } }),
  );
  await page.route(
    (url) => url.pathname.startsWith('/api/cms/feed/weighings/') && url.pathname !== BY_STAND,
    (route) => {
      const w = current().find((x) => route.request().url().endsWith(`/${x.documentId}`));
      if (!w) return route.fallback();
      return route.fulfill({
        json: {
          ...w,
          numberOfRevisions: 0,
          catches: w.catches.map((c, i) => ({ id: i + 1, documentId: `${w.documentId}-c${i}`, weight: c.weight, fishType: { Name: 'Crap' }, media: [] })),
          refereeSignature: null,
          witnessSignature: null,
          competition: { rankingType: 'quantity' },
          stand: { sectorDrawPosition: null },
        },
      });
    },
  );
}

/** Edits the real competition read on its way to the page. */
async function editCompetition(page: Page, id: string, change: (c: Record<string, unknown>) => Record<string, unknown>) {
  await page.route(
    (url) => url.pathname === competitionPath(id),
    async (route: Route) => {
      const res = await route.fetch();
      const body = (await res.json()) as { data: Record<string, unknown> };
      await route.fulfill({ response: res, json: { ...body, data: change(body.data) } });
    },
  );
}

const W = (over: Partial<Weighing>): Weighing => ({
  id: 1,
  documentId: 'w-1',
  weighingType: 'normal',
  weighingStatus: 'finished',
  startDate: '2026-09-27T04:42:00.000Z',
  endDate: '2026-09-27T05:10:00.000Z',
  catches: [{ weight: 5.25 }, { weight: 7.2 }],
  ...over,
});
const OPEN_EMPTY = W({ id: 2, documentId: 'w-open', weighingType: 'extra', weighingStatus: 'started', endDate: null, catches: [] });

/** The page is loaded (one reload if the shared dev server's Fast Refresh stranded it). */
async function loaded(page: Page) {
  const title = page.getByTestId('stand-title').or(page.getByTestId('stand-missing'));
  const ok = await title.first().waitFor({ timeout: 15_000 }).then(
    () => true,
    () => false,
  );
  if (!ok) await page.reload();
  await expect(title.first()).toBeVisible({ timeout: 30_000 });
}

async function shoot(page: Page, name: string) {
  const size = page.viewportSize();
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(200);
    await page.screenshot({ path: `.shots/cantar-istoric-${name}-${width}.png`, fullPage: true });
  }
  if (size) await page.setViewportSize(size);
}

const visible = (page: Page, testId: string) => page.locator(`[data-testid="${testId}"]:visible`);
const noWrites = (watch: Watch) => expect(watch.writes, 'no real organizer writes').toEqual([]);

test('signed out → sign-in with the return path (organizer.b.signed-out-gate)', async ({ request }) => {
  const res = await request.get(`${BASE_URL}${page_(STARTED, STARTED_STAND)}`, { maxRedirects: 0 });
  expect(res.status()).toBe(307);
  expect(res.headers().location).toContain(`/intra?next=${encodeURIComponent(page_(STARTED, STARTED_STAND))}`);
});

test('organizer.scale-history.c1 — «Istoric cântăriri», loading, then the stand; noindex', async ({ page }) => {
  await page.setViewportSize(PHONE);
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  const { watch, errors } = await open(page, STARTED, STARTED_STAND, (p) =>
    p.route(
      (url) => url.pathname === BY_STAND,
      async (route) => {
        await gate;
        await route.fallback();
      },
    ),
  );
  await expect(page.getByRole('heading', { level: 1, name: 'Istoric cântăriri' })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Se încarcă cântările standului…' })).toBeAttached();
  await expect(page.locator('section[aria-busy="true"]')).toBeVisible();
  await shoot(page, 'loading');
  release();
  await loaded(page);
  await expect(page.locator('section[aria-busy="true"]')).toHaveCount(0);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await expect(page.getByRole('link', { name: 'Înapoi la standuri' })).toHaveAttribute('href', `/concursuri/${STARTED}/cantar`);
  noWrites(watch);
  expect(errors).toEqual([]);
});

test('organizer.scale-history.c1 — an error offers «Încearcă din nou», which refetches the weighings, allocations, statute and competition', async ({ page }) => {
  await page.setViewportSize(PHONE);
  let fail = true;
  const { watch, errors } = await open(page, STARTED, STARTED_STAND, (p) =>
    p.route(
      (url) => url.pathname === BY_STAND,
      (route) => (fail ? route.fulfill({ status: 500, json: { error: { status: 500, message: 'boom' } } }) : route.fallback()),
    ),
  );
  await expect(page.getByRole('alert').getByRole('heading', { name: 'Serverul nu răspunde' })).toBeVisible({ timeout: 30_000 });
  await shoot(page, 'error');
  await expectNoA11yViolations(page);
  fail = false;
  const before = {
    w: count(watch, BY_STAND),
    a: count(watch, allocationsPath(STARTED)),
    s: count(watch, statutePath(STARTED)),
    c: count(watch, competitionPath(STARTED)),
  };
  await page.getByRole('button', { name: 'Încearcă din nou' }).click();
  await loaded(page);
  expect(count(watch, BY_STAND)).toBeGreaterThan(before.w);
  expect(count(watch, allocationsPath(STARTED))).toBeGreaterThan(before.a);
  expect(count(watch, statutePath(STARTED))).toBeGreaterThan(before.s);
  expect(count(watch, competitionPath(STARTED))).toBeGreaterThan(before.c);
  noWrites(watch);
  expect(errors).toEqual([]);
});

test('organizer.scale-history.c2 — «Sector X, Stand N (T kg)» and the participants as bullets (real data)', async ({ page, request }) => {
  const comp = (await (await request.get(`${CMS}/feed/competitions/${STARTED}`)).json()).data as { sectors: { name: string; stands: { documentId: string; name: string }[] }[] };
  const sector = comp.sectors.find((s) => s.stands.some((st) => st.documentId === STARTED_STAND))!;
  const stand = sector.stands.find((st) => st.documentId === STARTED_STAND)!;
  const list = (await (await request.get(`${CMS}/feed/weighings/by-stand?competitionId=${STARTED}&standId=${STARTED_STAND}`)).json()).data as Weighing[];
  const total = list.reduce((n, w) => n + w.catches.reduce((a, c) => a + c.weight, 0), 0);
  const alloc = (await (await request.get(`${CMS}/competitions/${STARTED}/allocated-participants`, { headers: { Authorization: `Bearer ${jwt}` } })).json()).data[STARTED_STAND];
  await page.setViewportSize(PHONE);
  const { watch } = await open(page, STARTED, STARTED_STAND);
  await loaded(page);
  await expect(page.getByTestId('stand-title')).toHaveText(new RegExp(`^Sector ${sector.name}, Stand ${stand.name}\\s\\(${kg(total)}\\s+kg\\)$`));
  for (const p of alloc.participants as { name: string }[]) await expect(page.getByRole('listitem').filter({ hasText: p.name }).first()).toBeVisible();
  noWrites(watch);
});

test('organizer.scale-history.c2 — national championship: the national stand label and the club', async ({ page, request }) => {
  const allocs = (await (await request.get(`${CMS}/competitions/${NC}/allocated-participants`, { headers: { Authorization: `Bearer ${jwt}` } })).json()).data as Record<string, { clubName?: string; sectorDrawPosition: number | null; sectorName: string } | null>;
  const [standId, alloc] = Object.entries(allocs).find(([, a]) => a?.clubName)!;
  await page.setViewportSize(DESKTOP);
  const { watch } = await open(page, NC, standId);
  await loaded(page);
  const letter = alloc!.sectorName.trim().slice(-1);
  await expect(page.getByTestId('stand-title')).toHaveText(new RegExp(`^Stand ${letter}\\d+(\\(\\d+\\))?\\s\\(`));
  await expect(page.getByText(alloc!.clubName!, { exact: true })).toBeVisible();
  await shoot(page, 'nc');
  noWrites(watch);
});

test('organizer.scale-history.c2 — a team: «Echipa <nume>»', async ({ page, request }) => {
  const allocs = (await (await request.get(`${CMS}/competitions/${TEAM}/allocated-participants`, { headers: { Authorization: `Bearer ${jwt}` } })).json()).data as Record<string, { teamName: string } | null>;
  const [standId, alloc] = Object.entries(allocs).find(([, a]) => a?.teamName)!;
  await page.setViewportSize(PHONE);
  const { watch } = await open(page, TEAM, standId);
  await loaded(page);
  await expect(page.getByText(`Echipa ${alloc!.teamName}`, { exact: true })).toBeVisible();
  noWrites(watch);
});

test('organizer.scale-history.c3 — feeder: the weighings and the total are the current leg’s (round in the read)', async ({ page }) => {
  await page.setViewportSize(PHONE);
  const { watch } = await open(page, STARTED, STARTED_STAND, async (p) => {
    await editCompetition(p, STARTED, (c) => ({ ...c, rankingType: 'feederRounds', currentRound: 2, roundsCount: 3, roundStatus: 'running' }));
    await p.route(
      (url) => url.pathname === BY_STAND,
      (route) => {
        const round = new URL(route.request().url()).searchParams.get('round');
        return route.fulfill({ json: { data: round === '2' ? [W({ catches: [{ weight: 3.5 }] })] : [W({}), W({ documentId: 'w-x' })] } });
      },
    );
  });
  await loaded(page);
  const stand = watch.reads.filter((r) => r.startsWith(BY_STAND));
  expect(stand.length).toBeGreaterThan(0);
  for (const r of stand) expect(r).toContain('round=2');
  await expect(page.getByTestId('stand-title')).toContainText('(3,500');
  await expect(page.locator('main li[data-testid^="weighing-"]:visible')).toHaveCount(1);
  await expect(page.getByText(/^Manșa 2 este în desfășurare/)).toBeVisible();
  noWrites(watch);
});

test('organizer.scale-history.c4 c5 — cards: «Cântar N (Extra)», badge, «Total: x,xxx kg», «Capturi: n», start → end; a card opens the weighing', async ({ page, request }) => {
  const list = (await (await request.get(`${CMS}/feed/weighings/by-stand?competitionId=${GUESTS}&standId=${GUESTS_STAND}`)).json()).data as Weighing[];
  const i = list.findIndex((w) => w.weighingType === 'extra');
  expect(i, 'the stand has an extra weighing').toBeGreaterThanOrEqual(0);
  const extra = list[i];
  await page.setViewportSize(PHONE);
  const { watch, errors } = await open(page, GUESTS, GUESTS_STAND);
  await loaded(page);
  const cards = page.locator('main li[data-testid^="weighing-"]:visible');
  await expect(cards).toHaveCount(list.length);
  const card = cards.nth(i);
  await expect(card).toContainText(`Cântar ${i + 1} (Extra)`);
  await expect(card).toContainText('Terminat');
  await expect(card).toContainText(new RegExp(`Total:\\s*${kg(extra.catches.reduce((a, c) => a + c.weight, 0))}\\s*kg`));
  await expect(card).toContainText(`Capturi: ${extra.catches.length}`);
  await expect(card).toContainText(ddmm(extra.startDate!));
  await expect(card).toContainText(ddmm(extra.endDate!));
  await shoot(page, 'read-only');
  await expectNoA11yViolations(page);
  // c5 — the card opens the weighing (organizer.scale-weighing), once on a double click.
  const href = `/concursuri/${GUESTS}/cantar/${GUESTS_STAND}/${extra.documentId}`;
  await expect(card.getByRole('link')).toHaveAttribute('href', href);
  await card.getByRole('link').click();
  await page.waitForURL(`**${href}`);
  noWrites(watch);
  expect(errors).toEqual([]);
});

test('organizer.scale-history.c4 c5 — from 1280: a table with every column and the selected weighing in the side panel (owner rule 14)', async ({ page, request }) => {
  const list = (await (await request.get(`${CMS}/feed/weighings/by-stand?competitionId=${GUESTS}&standId=${GUESTS_STAND}`)).json()).data as Weighing[];
  await page.setViewportSize(DESKTOP);
  const { watch, errors } = await open(page, GUESTS, GUESTS_STAND);
  await loaded(page);
  const table = page.getByTestId('weighing-table');
  await expect(table).toBeVisible();
  for (const h of ['Cântar', 'Început', 'Sfârșit', 'Capturi', 'Kg', 'Stare']) await expect(table.getByRole('columnheader', { name: h, exact: true })).toBeVisible();
  await expect(table.locator('tbody tr')).toHaveCount(list.length);
  // The stand at a glance beside it.
  const extras = list.filter((w) => w.weighingType === 'extra').length;
  await expect(page.getByTestId('stand-summary')).toContainText(new RegExp(`Cântare${list.length}${extras ? `\\s*\\(${extras} extra\\)` : ''}Capturi`));
  await expect(page.getByTestId('stand-summary')).toContainText(String(list.reduce((n, w) => n + w.catches.length, 0)));
  // The panel opens on the latest weighing; a row click selects another.
  const panel = page.getByTestId('weighing-panel');
  await expect(page.getByRole('heading', { name: `Cântar ${list.length}`, exact: true })).toBeVisible();
  await table.locator('tbody tr').first().locator('td').nth(3).click();
  await expect(page.getByRole('heading', { name: 'Cântar 1', exact: true })).toBeVisible();
  await expect(panel.getByRole('listitem')).toHaveCount(Math.min(list[0].catches.length, 5));
  // The selected row's fill is not the «Terminat» chip's: the status stays readable on it.
  const selectedRow = table.locator('tbody tr[data-selected]');
  const fills = await selectedRow.evaluate((tr) => {
    const badge = [...tr.querySelectorAll('span')].find((s) => s.textContent === 'Terminat' || s.textContent === 'În curs')!;
    return [getComputedStyle(tr).backgroundColor, getComputedStyle(badge).backgroundColor];
  });
  expect(fills[0]).not.toBe(fills[1]);
  await expect(panel.getByRole('link', { name: 'Deschide cântarul' })).toHaveAttribute('href', `/concursuri/${GUESTS}/cantar/${GUESTS_STAND}/${list[0].documentId}`);
  await shoot(page, 'desktop');
  await expectNoA11yViolations(page);
  await table.getByRole('link', { name: 'Cântar 2', exact: true }).click();
  await page.waitForURL(`**/cantar/${GUESTS_STAND}/${list[1].documentId}`);
  noWrites(watch);
  expect(errors).toEqual([]);
});

for (const [label, role, status, allowed] of [
  ['an angler on a started competition', null, 'started', false],
  ['the author before the start', 'author', 'notStarted', false],
  ['the author after the end', 'author', 'completed', false],
  ['a referee while it runs', 'referee', 'started', true],
  ['the author while it runs', 'author', 'started', true],
] as const) {
  test(`organizer.scale-history.c6 c4 — ${label}: actions ${allowed ? 'offered' : 'hidden'}`, async ({ page }) => {
    await page.setViewportSize(PHONE);
    const { watch } = await open(page, STARTED, STARTED_STAND, async (p) => {
      await statute(p, STARTED, role);
      await editCompetition(p, STARTED, (c) => ({ ...c, competitionStatus: status }));
      await weighings(p, [W({}), OPEN_EMPTY]);
    });
    await loaded(page);
    const open_ = page.locator('main li[data-testid="weighing-w-open"]');
    await expect(open_).toContainText('Cântar 2 (Extra)');
    await expect(open_).toContainText('În curs');
    await expect(open_.getByText('În curs')).toHaveCount(2);
    await expect(page.getByRole('button', { name: 'Start cântar nou' })).toHaveCount(allowed ? 1 : 0);
    await expect(visible(page, 'delete-w-open')).toHaveCount(allowed ? 1 : 0);
    // A weighing with catches is never deletable.
    await expect(page.locator('[data-testid="delete-w-1"]')).toHaveCount(0);
    if (allowed && role === 'author') await shoot(page, 'actions');
    noWrites(watch);
  });
}

test('organizer.scale-history.c7 — ✕ → confirm («Renunță» / «Șterge») → DELETE (mocked) → toast → the weighings are read again', async ({ page }) => {
  await page.setViewportSize(PHONE);
  let list = [W({}), OPEN_EMPTY];
  const deletes: string[] = [];
  const { watch, errors } = await open(page, STARTED, STARTED_STAND, async (p) => {
    await statute(p, STARTED, 'author');
    await weighings(p, () => list);
    await p.route(
      (url) => url.pathname.startsWith('/api/cms/weighings/') && !url.pathname.endsWith('/start'),
      async (route) => {
        expect(route.request().method()).toBe('DELETE');
        deletes.push(path(route.request().url()));
        list = [W({})];
        await route.fulfill({ json: { data: { documentId: 'w-open', deletedCatches: 0 } } });
      },
    );
  });
  await loaded(page);
  // «Renunță» closes without a request.
  await visible(page, 'delete-w-open').click();
  const dialog = page.getByRole('alertdialog', { name: 'Ești sigur că vrei să ștergi acest cântar?' });
  await expect(dialog).toBeVisible();
  await shoot(page, 'delete-confirm');
  await expectNoA11yViolations(page);
  await dialog.getByRole('button', { name: 'Renunță' }).click();
  await expect(dialog).toBeHidden();
  expect(deletes).toEqual([]);
  const before = count(watch, BY_STAND);
  await visible(page, 'delete-w-open').click();
  await dialog.getByRole('button', { name: 'Șterge' }).click();
  await expect(page.getByText('Cântarul a fost șters cu succes.')).toBeVisible();
  expect(deletes).toEqual(['/api/cms/weighings/w-open']);
  await expect(page.locator('main li[data-testid="weighing-w-open"]')).toHaveCount(0);
  expect(count(watch, BY_STAND)).toBeGreaterThan(before);
  expect(errors).toEqual([]);
});

test('organizer.scale-history.c7 — a refused delete toasts the CMS’s message', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const { watch } = await open(page, STARTED, STARTED_STAND, async (p) => {
    await statute(p, STARTED, 'referee');
    await weighings(p, [W({}), OPEN_EMPTY]);
    await p.route(
      (url) => url.pathname === '/api/cms/weighings/w-open',
      (route) => route.fulfill({ status: 400, json: { data: null, error: { status: 400, name: 'ApplicationError', message: 'Cântarul are capturi.', details: { bluCode: 'WEIGHING_HAS_CATCHES' } } } }),
    );
  });
  await loaded(page);
  // From 1280 the table's ✕ (and the panel's «Șterge cântarul» for the open one).
  await expect(page.getByRole('heading', { name: 'Cântar 2 (Extra)', exact: true })).toBeVisible();
  await page.getByTestId('weighing-panel').getByRole('button', { name: 'Șterge cântarul' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Șterge' }).click();
  await expect(page.getByText('Cântarul are capturi.')).toBeVisible();
  expect(watch.writes).toEqual(['DELETE /api/cms/weighings/w-open']);
});

test('organizer.scale-history.c8 — no weighings: «Nu s-a efectuat nicio cântărire.»', async ({ page }) => {
  await page.setViewportSize(PHONE);
  const { watch } = await open(page, STARTED, STARTED_STAND, (p) => weighings(p, []));
  await loaded(page);
  await expect(page.getByTestId('weighings-empty')).toHaveText('Nu s-a efectuat nicio cântărire.');
  await expect(page.getByTestId('stand-title')).toContainText('(0,000');
  await shoot(page, 'empty');
  noWrites(watch);
});

test('organizer.scale-history.c9 c10 — «Start cântar nou»: the confirmation, «Anulează», then an extra weighing (POST mocked) opens', async ({ page, request }) => {
  const comp = (await (await request.get(`${CMS}/feed/competitions/${STARTED}`)).json()).data as { sectors: { name: string; stands: { documentId: string; name: string }[] }[] };
  const sector = comp.sectors.find((s) => s.stands.some((st) => st.documentId === STARTED_STAND))!;
  const stand = sector.stands.find((st) => st.documentId === STARTED_STAND)!;
  await page.setViewportSize(PHONE);
  let release!: () => void;
  const slow = new Promise<void>((r) => (release = r));
  const bodies: unknown[] = [];
  const { watch, errors } = await open(page, STARTED, STARTED_STAND, async (p) => {
    await statute(p, STARTED, 'author');
    await weighings(p, [W({})]);
    await p.route(
      (url) => url.pathname === '/api/cms/weighings/start',
      async (route) => {
        expect(route.request().method()).toBe('POST');
        bodies.push(route.request().postDataJSON());
        await slow;
        await route.fulfill({ json: { id: 99, documentId: 'w-new', weighingStatus: 'started', weighingType: 'extra', startDate: new Date().toISOString() } });
      },
    );
  });
  await loaded(page);
  await page.getByRole('button', { name: 'Start cântar nou' }).click();
  const dialog = page.getByRole('dialog', { name: 'Ești sigur că vrei să începi un nou cântar?' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(`Sector: ${sector.name}, standul: ${stand.name}`);
  const box = dialog.getByRole('checkbox', { name: 'Marchează ca extra cântar' });
  await expect(box).not.toBeChecked();
  await shoot(page, 'start-dialog');
  await expectNoA11yViolations(page);
  await dialog.getByRole('button', { name: 'Anulează' }).click();
  await expect(dialog).toBeHidden();
  expect(bodies).toEqual([]);
  // Again, as an extra weighing.
  await page.getByRole('button', { name: 'Start cântar nou' }).click();
  await box.check();
  await dialog.getByRole('button', { name: 'Începe cântarul' }).click();
  // Spinner, and no second start possible.
  await expect(dialog.getByRole('status')).toHaveText('Se pornește cântarul…');
  await expect(dialog.getByRole('button', { name: 'Începe cântarul' })).toHaveCount(0);
  expect(errors).toEqual([]);
  release();
  // The new weighing opens (organizer.scale-weighing; its reads of the mocked id are that page's).
  await page.waitForURL(`**/concursuri/${STARTED}/cantar/${STARTED_STAND}/w-new`);
  expect(bodies).toEqual([{ data: { stand: STARTED_STAND, competition: STARTED, weighingType: 'extra' } }]);
  expect(watch.writes).toEqual(['POST /api/cms/weighings/start']);
});

test('organizer.scale-history.c9 — after a start, Back returns to the history with the dialog closed and «Start cântar nou» usable', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const bodies: unknown[] = [];
  const { watch } = await open(page, STARTED, STARTED_STAND, async (p) => {
    await statute(p, STARTED, 'author');
    await weighings(p, [W({})]);
    await p.route(
      (url) => url.pathname === '/api/cms/weighings/start',
      async (route) => {
        expect(route.request().method()).toBe('POST');
        bodies.push(route.request().postDataJSON());
        await route.fulfill({ json: { id: 99, documentId: 'w-new', weighingStatus: 'started', weighingType: 'normal', startDate: new Date().toISOString() } });
      },
    );
  });
  await loaded(page);
  await page.getByRole('button', { name: 'Start cântar nou' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Începe cântarul' }).click();
  await page.waitForURL(`**/concursuri/${STARTED}/cantar/${STARTED_STAND}/w-new`);
  expect(bodies).toEqual([{ data: { stand: STARTED_STAND, competition: STARTED, weighingType: 'normal' } }]);
  await page.goBack();
  await page.waitForURL(new RegExp(`/cantar/${STARTED_STAND}$`));
  await expect(page.getByTestId('stand-title')).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('Se pornește cântarul…')).toHaveCount(0);
  const cta = page.getByRole('button', { name: 'Start cântar nou' });
  await expect(cta).toBeEnabled();
  // Usable: it opens a fresh confirmation (no stale spinner).
  await cta.click();
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Începe cântarul' })).toBeVisible();
  expect(watch.writes).toEqual(['POST /api/cms/weighings/start']);
});

test('organizer.scale-history.c5 — a weighing with many catches: the panel lists 5 and «+N capturi»; «Start cântar nou» stays on screen at 1280×800', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const many = Array.from({ length: 12 }, (_, i) => ({ weight: 1 + i / 10 }));
  const { watch } = await open(page, STARTED, STARTED_STAND, async (p) => {
    await statute(p, STARTED, 'referee');
    await weighings(p, [W({}), W({ id: 2, documentId: 'w-big', weighingStatus: 'started', endDate: null, catches: many })]);
  });
  await loaded(page);
  const panel = page.getByTestId('weighing-panel');
  await expect(page.getByRole('heading', { name: 'Cântar 2', exact: true })).toBeVisible();
  await expect(panel.getByRole('listitem')).toHaveCount(5);
  await expect(page.getByTestId('weighing-panel-more')).toHaveText('+7 capturi');
  await page.screenshot({ path: '.shots/cantar-istoric-many-catches-1280.png' });
  await expect(page.getByRole('button', { name: 'Start cântar nou' })).toBeInViewport({ ratio: 1 });
  noWrites(watch);
});

test('organizer.scale-history.c10 — a refused start shows the error with «Închide»', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const { watch } = await open(page, STARTED, STARTED_STAND, async (p) => {
    await statute(p, STARTED, 'author');
    await weighings(p, [W({})]);
    await p.route(
      (url) => url.pathname === '/api/cms/weighings/start',
      (route) => route.fulfill({ status: 400, json: { data: null, error: { status: 400, name: 'ApplicationError', message: 'Există deja un cântar în curs pe acest stand.', details: { bluCode: 'WEIGHING_IN_PROGRESS' } } } }),
    );
  });
  await loaded(page);
  await page.getByRole('button', { name: 'Start cântar nou' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Începe cântarul' }).click();
  const err = page.getByRole('dialog');
  await expect(err.getByRole('alert')).toHaveText('Există deja un cântar în curs pe acest stand.');
  await shoot(page, 'start-error');
  await err.getByRole('button', { name: 'Închide' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(watch.writes).toEqual(['POST /api/cms/weighings/start']);
  await expect(page).toHaveURL(new RegExp(`/cantar/${STARTED_STAND}$`));
});

test('organizer.scale-history.c11 — the refresh action refetches the weighings, allocations, statute and competition', async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  const { watch, errors } = await open(page, STARTED, STARTED_STAND);
  await loaded(page);
  const before = {
    w: count(watch, BY_STAND),
    a: count(watch, allocationsPath(STARTED)),
    s: count(watch, statutePath(STARTED)),
    c: count(watch, competitionPath(STARTED)),
  };
  await page.getByRole('button', { name: 'Reîmprospătează' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Datele au fost actualizate.' })).toBeAttached();
  expect(count(watch, BY_STAND)).toBeGreaterThan(before.w);
  expect(count(watch, allocationsPath(STARTED))).toBeGreaterThan(before.a);
  expect(count(watch, statutePath(STARTED))).toBeGreaterThan(before.s);
  expect(count(watch, competitionPath(STARTED))).toBeGreaterThan(before.c);
  noWrites(watch);
  expect(errors).toEqual([]);
});

test('a stand outside the competition says so, never «Sector undefined»', async ({ page }) => {
  await page.setViewportSize(PHONE);
  const { watch } = await open(page, STARTED, 'nu-exista-stand');
  await loaded(page);
  await expect(page.getByTestId('stand-missing')).toContainText('Standul nu face parte din acest concurs.');
  await expect(page.getByRole('link', { name: 'Alege alt stand' })).toHaveAttribute('href', `/concursuri/${STARTED}/cantar`);
  noWrites(watch);
});
