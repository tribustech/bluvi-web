import { mkdirSync } from 'node:fs';
import { expect, test, type Page, type Request } from '@playwright/test';
import { expectNoA11yViolations } from './helpers/a11y';
import { BASE_URL } from './helpers/base-url';
import { collectConsoleErrors } from './helpers/console';
import { qaJwt, signIn } from './helpers/session';

/*
 * Cântar — «Istoric modificări» (parity organizer.scale-revisions c1–c5; fish
 * app/(app)/scale/[competitionId]/revisions.tsx + components/scale/RevisionCard.tsx).
 *
 * READS ONLY. The weighing is the local CMS's own (a finished weighing reopened once, with a reason,
 * and closed with one catch added); a state the local data does not have (two rounds with removed
 * catches, no log, a failure, a slow CMS) is served by page.route on the log's read. Every request
 * to the browser's CMS edge is watched: a single non-GET fails the spec.
 */

test.describe.configure({ timeout: 180_000, retries: 1 });

const COMPETITION = process.env.E2E_REVISIONS_COMPETITION ?? 'k5c9427518736c92684018b9'; // [CHAT24] Calitate
const STAND = process.env.E2E_REVISIONS_STAND ?? 'ka4117a88d2869844e5900b4'; // Sector A, Stand A1
const WEIGHING = process.env.E2E_REVISIONS_WEIGHING ?? 'zedwz6t4y7behggplzlraatf'; // 1 round: «test modificare», +Crap 9,900 kg
/** Another stand of the same competition (Sector B, Stand B1): the weighing is not its own. */
const OTHER_STAND = process.env.E2E_REVISIONS_OTHER_STAND ?? 'k83a979b9e780e65262ef573';

const URL_PATH = `/concursuri/${COMPETITION}/cantar/${STAND}/${WEIGHING}/modificari`;
const LOGS = '/api/cms/weighing-logs';
const PHONE = { width: 375, height: 812 };
const WIDTHS = [375, 1280, 1440, 1920];

let jwt = '';
test.beforeAll(async ({ request }) => {
  jwt = await qaJwt(request);
  mkdirSync('.shots', { recursive: true });
});

const path = (url: string) => new URL(url).pathname;
const isCms = (r: Request) => path(r.url()).startsWith('/api/cms/');
type Watch = { writes: string[]; reads: string[] };
const logReads = (w: Watch) => w.reads.filter((r) => r === LOGS).length;

async function open(page: Page, setup?: (page: Page) => Promise<unknown>, to = URL_PATH) {
  await signIn(page.context(), jwt);
  const watch: Watch = { writes: [], reads: [] };
  page.on('request', (r) => {
    if (!isCms(r)) return;
    if (r.method() !== 'GET') watch.writes.push(`${r.method()} ${path(r.url())}`);
    else watch.reads.push(path(r.url()));
  });
  const errors = collectConsoleErrors(page, {
    // The deliberate 500s this spec serves are logged by the browser as failed resources.
    ignore: /Failed to load resource: the server responded with a status of 500/,
  });
  if (setup) await setup(page);
  await page.goto(to);
  return { watch, errors };
}

const author = { id: 146, documentId: 'pnn9hirv7cnsevhwljusv55c', username: 'Andrew' };
const weighing = { id: 1, documentId: WEIGHING };
const log = (id: number, sessionId: number, action: 'reopen' | 'closed', createdAt: string, state: object) => ({
  id,
  documentId: `log-${id}`,
  createdAt,
  updatedAt: createdAt,
  sessionId,
  action,
  author,
  state,
  weighing,
});
/** Two rounds (the local weighing x9yz…, which has no competition): a swap, then two removals. */
const TWO_ROUNDS = [
  log(1, 1, 'reopen', '2026-03-27T09:43:57.527Z', { reason: 'Am adăugat greșit', catches: [] }),
  log(2, 1, 'closed', '2026-03-27T09:44:54.732Z', {
    added: [{ type: 'Crap Oglindă', weight: 7.775, catchId: 'a' }],
    removed: [{ type: 'Crap Oglindă', weight: 7.75, catchId: 'b' }],
    unmodified: [{ type: 'Crap', weight: 10.5, catchId: 'c' }],
  }),
  log(3, 2, 'reopen', '2026-03-27T09:45:03.380Z', { reason: 'Captura nu era a standului', catches: [] }),
  log(4, 2, 'closed', '2026-03-27T09:45:13.363Z', {
    added: [],
    removed: [
      { type: 'Crap', weight: 10.5, catchId: 'c' },
      { type: 'Amur', weight: 4, catchId: 'd' },
    ],
    unmodified: [],
  }),
];
const page1 = (data: unknown[]) => ({ data, meta: { pagination: { page: 1, pageSize: 100, pageCount: 1, total: data.length } } });
const serveLogs = (page: Page, data: unknown[]) =>
  page.route((url) => url.pathname === LOGS, (route) => route.fulfill({ json: page1(data) }));

/** Loaded: a round or the empty line. One reload if the shared dev server's Fast Refresh stranded the load. */
async function loaded(page: Page) {
  const body = page.getByTestId('revisions-list').or(page.getByTestId('revisions-empty'));
  const ok = await body.waitFor({ timeout: 15_000 }).then(
    () => true,
    () => false,
  );
  if (!ok) await page.reload();
  await expect(body).toBeVisible({ timeout: 30_000 });
}

async function shoot(page: Page, name: string) {
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(150);
    await page.screenshot({ path: `.shots/cantar-modificari-${name}-${width}.png`, fullPage: true });
  }
  await page.setViewportSize(PHONE);
}

const noWrites = (watch: Watch) => expect(watch.writes, 'no writes from the change log').toEqual([]);

test('signed out → sign-in with the return path', async ({ request }) => {
  const res = await request.get(`${BASE_URL}${URL_PATH}`, { maxRedirects: 0 });
  expect(res.status()).toBe(307);
  expect(res.headers().location).toContain(`/intra?next=${encodeURIComponent(URL_PATH)}`);
});

test('organizer.scale-revisions.c1 — «Istoric modificări», loading, then the log; noindex; back to the weighing', async ({ page }) => {
  await page.setViewportSize(PHONE);
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  const { watch, errors } = await open(page, (p) =>
    p.route(
      (url) => url.pathname === LOGS,
      async (route) => {
        await gate;
        await route.continue();
      },
    ),
  );
  await expect(page.getByRole('heading', { level: 1, name: 'Istoric modificări' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('status').filter({ hasText: 'Se încarcă modificările…' })).toBeAttached();
  await expect(page.getByTestId('revisions-skeleton')).toBeVisible();
  await expect(page.locator('section[aria-busy="true"]')).toBeVisible();
  await shoot(page, 'loading');
  release();
  await loaded(page);
  await expect(page.locator('section[aria-busy="true"]')).toHaveCount(0);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await expect(page.getByRole('link', { name: 'Înapoi la cântar' })).toHaveAttribute(
    'href',
    `/concursuri/${COMPETITION}/cantar/${STAND}/${WEIGHING}`,
  );
  // The log's read asks for this weighing, oldest first, with the author.
  const req = await page.evaluate(() => performance.getEntriesByType('resource').map((e) => e.name).find((n) => n.includes('/api/cms/weighing-logs')));
  const q = decodeURIComponent(req ?? '');
  expect(q).toContain(`filters[weighing][documentId]=${WEIGHING}`);
  expect(q).toContain('sort[0]=createdAt:asc');
  noWrites(watch);
  expect(errors).toEqual([]);
});

test('organizer.scale-revisions.c1 — an error offers «Încearcă din nou», which refetches the log', async ({ page }) => {
  await page.setViewportSize(PHONE);
  let fail = true;
  const { watch, errors } = await open(page, (p) =>
    p.route(
      (url) => url.pathname === LOGS,
      (route) => (fail ? route.fulfill({ status: 500, json: { error: { status: 500, message: 'boom' } } }) : route.continue()),
    ),
  );
  const alert = page.getByRole('alert');
  await expect(alert.getByRole('heading', { name: 'Serverul nu răspunde' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('heading', { level: 1, name: 'Istoric modificări' })).toBeVisible();
  await shoot(page, 'error');
  await expectNoA11yViolations(page);
  fail = false;
  const before = logReads(watch);
  await page.getByRole('button', { name: 'Încearcă din nou' }).click();
  await loaded(page);
  expect(logReads(watch)).toBeGreaterThan(before);
  await expect(page.getByRole('heading', { level: 2, name: 'Modificarea 1 [de Andrew]' })).toBeVisible();
  noWrites(watch);
  expect(errors).toEqual([]);
});

test('organizer.scale-revisions.c1 — the log is refetched every time the page opens (staleTime 0)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const { watch } = await open(page);
  await loaded(page);
  expect(logReads(watch)).toBe(1);
  // Away in the app (client navigation through the top bar), then back: the query cache survives,
  // the log is read again. The marker proves no full page load happened in between.
  await page.evaluate(() => ((window as unknown as { __stay: number }).__stay = 1));
  await page.getByRole('navigation', { name: 'Navigare principală' }).first().getByRole('link', { name: 'Competiții' }).click();
  await expect(page).toHaveURL(/\/concursuri$/);
  await page.goBack();
  await loaded(page);
  await expect.poll(() => logReads(watch)).toBe(2);
  expect(await page.evaluate(() => (window as unknown as { __stay?: number }).__stay)).toBe(1);
  noWrites(watch);
});

test('organizer.scale-revisions.c2–c4 — the local weighing: one round, its reason, times and the catch added', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const { watch, errors } = await open(page);
  await loaded(page);
  const cards = page.getByTestId('revision-card');
  await expect(cards).toHaveCount(1);
  const card = cards.first();
  await expect(card.getByRole('heading', { level: 2 })).toHaveText('Modificarea 1 [de Andrew]');
  await expect(card.getByTestId('revision-reason')).toHaveText('Motiv: test modificare');
  await expect(card.getByTestId('revision-reopen')).toContainText('Redeschis la 10.09.2026, 10:31');
  await expect(card.getByTestId('revision-closed')).toContainText('Închis la 10.09.2026, 10:31');
  await expect(card.getByTestId('revision-added')).toHaveText(/Adăugat:\s*• Crap 9,900 kg/);
  await expect(card.getByTestId('revision-removed')).toHaveCount(0);
  // The stand, in the header (every width) and the aside's subject card (≥1280).
  await expect(page.getByTestId('revisions-stand-hint')).toHaveText('Sector A, Stand A1');
  await expect(page.getByRole('complementary').getByText('Sector A, Stand A1')).toBeVisible();
  await expect(page.getByTestId('revisions-count')).toHaveText(/1\s*modificare/);
  await shoot(page, 'local');
  await expectNoA11yViolations(page);
  noWrites(watch);
  expect(errors).toEqual([]);
});

test('organizer.scale-revisions.c2–c4 — two rounds: one card each, «Adăugat:» green and «Șters:» red as «• specie X kg»', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const { watch, errors } = await open(page, (p) => serveLogs(p, TWO_ROUNDS));
  await loaded(page);
  const cards = page.getByTestId('revision-card');
  await expect(cards).toHaveCount(2);
  await expect(page.getByRole('heading', { level: 2, name: /^Modificarea / })).toHaveText(['Modificarea 1 [de Andrew]', 'Modificarea 2 [de Andrew]']);
  const [one, two] = [cards.nth(0), cards.nth(1)];
  // c3: the reopen (reason, then «Redeschis la …») before the close («Închis la …»), Bucharest time.
  await expect(one.getByTestId('revision-reason')).toHaveText('Motiv: Am adăugat greșit');
  await expect(one.getByTestId('revision-reopen')).toContainText('Redeschis la 27.03.2026, 11:43');
  await expect(one.getByTestId('revision-closed')).toContainText('Închis la 27.03.2026, 11:44');
  await expect(two.getByTestId('revision-reopen')).toContainText('Redeschis la 27.03.2026, 11:45');
  // c4: added and removed as the weighing screen lists them («x,xxx kg», unit spaced — owner rule 10);
  // the unmodified catch is not listed.
  await expect(one.getByTestId('revision-added').getByRole('listitem')).toHaveText(['• Crap Oglindă 7,775 kg']);
  await expect(one.getByTestId('revision-removed').getByRole('listitem')).toHaveText(['• Crap Oglindă 7,750 kg']);
  await expect(one).not.toContainText('10,500 kg');
  await expect(two.getByTestId('revision-added')).toHaveCount(0);
  await expect(two.getByTestId('revision-removed').getByRole('listitem')).toHaveText(['• Crap 10,500 kg', '• Amur 4,000 kg']);
  await expect(one.getByTestId('revision-added')).toContainText('Adăugat:');
  await expect(two.getByTestId('revision-removed')).toContainText('Șters:');
  // Green and red: the status tokens.
  const colour = (testId: string) => one.getByTestId(testId).evaluate((el) => getComputedStyle(el).color);
  const token = (name: string) =>
    page.evaluate((n) => {
      const probe = document.createElement('span');
      probe.style.color = `var(${n})`;
      document.body.append(probe);
      const c = getComputedStyle(probe).color;
      probe.remove();
      return c;
    }, name);
  expect(await colour('revision-added')).toBe(await token('--color-status-success-fg'));
  expect(await colour('revision-removed')).toBe(await token('--color-status-danger-fg'));
  // The summary adds it up.
  await expect(page.getByTestId('revisions-count')).toHaveText(/2\s*modificări/);
  await expect(page.getByTestId('revisions-added')).toHaveText('1');
  await expect(page.getByTestId('revisions-removed')).toHaveText('3');
  await expect(page.getByText(/capot/i)).toHaveCount(0);
  await shoot(page, 'two-rounds');
  await expectNoA11yViolations(page);
  noWrites(watch);
  expect(errors).toEqual([]);
});

test('organizer.scale-revisions.c5 — no log: «Nu există modificări pentru acest cântar.»; refresh refetches', async ({ page }) => {
  await page.setViewportSize(PHONE);
  let data: unknown[] = [];
  const { watch, errors } = await open(page, (p) =>
    p.route((url) => url.pathname === LOGS, (route) => route.fulfill({ json: page1(data) })),
  );
  await loaded(page);
  await expect(page.getByTestId('revisions-empty')).toHaveText('Nu există modificări pentru acest cântar.');
  await expect(page.getByTestId('revision-card')).toHaveCount(0);
  // No round, no «Rezumat» of zeros (≥1280); the stand card stays.
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.getByTestId('revisions-count')).toHaveCount(0);
  await expect(page.getByRole('complementary').getByText('Sector A, Stand A1')).toBeVisible();
  await page.setViewportSize(PHONE);
  await shoot(page, 'empty');
  await expectNoA11yViolations(page);
  // fish pull-to-refresh: the header's refresh refetches the log, and a new round shows up.
  data = TWO_ROUNDS.slice(0, 2);
  const before = logReads(watch);
  await page.getByRole('button', { name: 'Reîmprospătează' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Datele au fost actualizate.' })).toBeAttached();
  expect(logReads(watch)).toBeGreaterThan(before);
  await expect(page.getByTestId('revision-card')).toHaveCount(1);
  await expect(page.getByTestId('revisions-empty')).toHaveCount(0);
  await shoot(page, 'refreshed');
  noWrites(watch);
  expect(errors).toEqual([]);
});

test('organizer.scale-revisions — a link whose stand is not the weighing\'s shows no stand (owner rule 4)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const weighingRead = `/api/cms/feed/weighings/${WEIGHING}`;
  const { watch, errors } = await open(page, undefined, `/concursuri/${COMPETITION}/cantar/${OTHER_STAND}/${WEIGHING}/modificari`);
  await loaded(page);
  // The weighing (stand A1) has been read, so the page knows the link's stand (B1) is not its stand.
  await expect.poll(() => watch.reads.includes(weighingRead), { timeout: 30_000 }).toBe(true);
  await expect(page.getByTestId('revision-card')).toHaveCount(1);
  await expect(page.getByTestId('revisions-count')).toHaveText(/1\s*modificare/);
  await expect(page.getByTestId('revisions-stand-hint')).toHaveCount(0);
  await expect(page.getByText(/Stand (A1|B1)/)).toHaveCount(0);
  await shoot(page, 'stand-mismatch');
  noWrites(watch);
  expect(errors).toEqual([]);
});
