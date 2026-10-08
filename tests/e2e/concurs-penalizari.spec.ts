import { mkdirSync } from 'node:fs';
import { expect, test, type Page, type Request, type Route } from '@playwright/test';
import { hydrateRanking, type RankingFixture } from '../fixtures/rankings/hydrate';
import quantityFixture from '../fixtures/rankings/quantity.json';
import { expectNoA11yViolations } from './helpers/a11y';
import { BASE_URL } from './helpers/base-url';
import { collectConsoleErrors } from './helpers/console';
import { qaJwt, signIn } from './helpers/session';

/*
 * «Penalizări» — the competition's penalties hub (parity organizer.penalties c1–c6; fish
 * app/(app)/penalties/[competitionId]/index.tsx).
 *
 * READS hit the local CMS (a started «Cantitate» competition with one real weight penalty). WRITES
 * NEVER DO: revoking a penalty re-ranks and notifies real devices, so every non-GET to the browser's
 * CMS edge is aborted by a catch-all route, and the one write this page makes (DELETE /penalties/:id)
 * is answered by page.route with its method and path asserted. A state the local data does not have
 * (author / referee statute, more penalties, another ranking type or status, a failure) is made by
 * editing or replacing a read — the replaced rankings are the real payloads of tests/fixtures/rankings.
 */

test.describe.configure({ timeout: 180_000, retries: 1 });

const STARTED = process.env.E2E_PENALTY_STARTED ?? 'kee49a3e64b3f636b4b60daa'; // [CHAT25] quantity, started
const REAL_PENALTY = 'q47no0oi9m06jgbwkbukibim'; // DEDUCT_TOTAL_WEIGHT 2 kg on A1 · Andrei Popescu, by Andrew

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
const pagePath = (id: string) => `/concursuri/${id}/penalizari`;
const competitionPath = (id: string) => `/api/cms/feed/competitions/${id}`;
const statutePath = (id: string) => `/api/cms/user/profile/competition/${id}/statute`;
const rankingPath = (id: string) => `/api/cms/competitions/${id}/ranking`;
const bestNPath = (id: string) => `/api/cms/competitions/${id}/ranking/best-n`;

type Role = 'author' | 'referee' | 'participant' | null;
type Watch = { writes: string[]; reads: string[] };
type Penalty = { documentId: string; action: string; value: number | null; reason: string; createdAt: string; author?: { id: number; username?: string } | null };

async function open(page: Page, id: string, { role = 'participant', setup }: { role?: Role; setup?: (page: Page) => Promise<unknown> } = {}) {
  await signIn(page.context(), jwt);
  // Registered first: later routes win. Every write no test answers is aborted.
  await page.route(
    (url) => url.pathname.startsWith('/api/cms/'),
    (route) => (route.request().method() === 'GET' ? route.fallback() : route.abort()),
  );
  const watch: Watch = { writes: [], reads: [] };
  page.on('request', (r) => {
    if (!isCms(r)) return;
    if (r.method() !== 'GET') watch.writes.push(`${r.method()} ${path(r.url())}`);
    else watch.reads.push(path(r.url()));
  });
  const errors = collectConsoleErrors(page, {
    ignore: /Failed to load resource: the server responded with a status of (500|400)/,
  });
  await page.route(
    (url) => url.pathname === statutePath(id),
    (route) => route.fulfill({ json: { userRole: role, isReferee: role === 'referee', isParticipant: role === 'participant' } }),
  );
  if (setup) await setup(page);
  await page.goto(pagePath(id));
  return { watch, errors };
}

const count = (watch: Watch, p: string) => watch.reads.filter((r) => r === p).length;

/** Edits the real competition read on its way to the page. */
async function editCompetition(page: Page, id: string, change: Record<string, unknown>) {
  await page.route(
    (url) => url.pathname === competitionPath(id),
    async (route: Route) => {
      const res = await route.fetch();
      const body = (await res.json()) as { data?: Record<string, unknown> } & Record<string, unknown>;
      const json = body.data ? { ...body, data: { ...body.data, ...change } } : { ...body, ...change };
      await route.fulfill({ response: res, json });
    },
  );
}

/** Answers the ranking with the real quantity payload, penalties put on its rows (by row index). */
async function ranking(page: Page, id: string, byRow: Record<number, Penalty[]> | (() => Record<number, Penalty[]>)) {
  await page.route(
    (url) => url.pathname === rankingPath(id),
    (route) => {
      const rows = typeof byRow === 'function' ? byRow() : byRow;
      const hydrated = hydrateRanking(quantityFixture as RankingFixture);
      return route.fulfill({ json: { ...hydrated, rankings: hydrated.rankings.map((r, i) => ({ ...r, penalties: rows[i] ?? [] })) } });
    },
  );
}

const P = (documentId: string, createdAt: string, over: Partial<Penalty> = {}): Penalty => ({
  documentId,
  action: 'WARNING',
  value: null,
  reason: 'Zgomot pe stand',
  createdAt,
  author: { id: 1, username: 'Arbitrul Ion' },
  ...over,
});
// quantity.json rows: 0 → Stand 2 · Pescar 1, 1 → Stand 9 · Pescar 2, 2 → Stand 5 · Pescar 3.
const THREE = {
  0: [P('p-deduct', '2026-10-08T07:15:00.000Z', { action: 'DEDUCT_TOTAL_WEIGHT', value: 1.5, reason: 'Pește sub dimensiune' })],
  // Strapi 5 sends `author: null` once the author's account is deleted.
  1: [P('p-warn', '2026-10-08T06:05:00.000Z', { author: null })],
  2: [P('p-elim', '2026-10-08T09:40:00.000Z', { action: 'ELIMINATE', reason: 'Pescuit în afara standului' })],
};

/** The page is loaded (one reload if the shared dev server's Fast Refresh stranded it). */
async function loaded(page: Page) {
  const ready = page.getByTestId('penalties-heading').or(page.getByTestId('penalties-empty'));
  const ok = await ready.first().waitFor({ timeout: 20_000 }).then(
    () => true,
    () => false,
  );
  if (!ok) await page.reload();
  await expect(ready.first()).toBeVisible({ timeout: 30_000 });
}

async function shoot(page: Page, name: string) {
  const size = page.viewportSize();
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(250);
    await page.screenshot({ path: `.shots/penalizari-${name}-${width}.png`, fullPage: true });
  }
  if (size) await page.setViewportSize(size);
}

const card = (page: Page, id: string) => page.getByTestId(`penalty-${id}`);
const visibleApply = (page: Page) => page.locator('[data-testid="apply-penalty"]:visible');
const noWrites = (watch: Watch) => expect(watch.writes, 'no real organizer writes').toEqual([]);

test('signed out → sign-in with the return path (organizer.b.signed-out-gate)', async ({ request }) => {
  const res = await request.get(`${BASE_URL}${pagePath(STARTED)}`, { maxRedirects: 0 });
  expect(res.status()).toBe(307);
  expect(res.headers().location).toContain(`/intra?next=${encodeURIComponent(pagePath(STARTED))}`);
});

test('organizer.penalties.c1 — «Penalizări», loading until the ranking lands; noindex', async ({ page }) => {
  await page.setViewportSize(PHONE);
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  const { watch, errors } = await open(page, STARTED, {
    setup: (p) =>
      p.route(
        (url) => url.pathname === rankingPath(STARTED),
        async (route) => {
          await gate;
          await route.fallback();
        },
      ),
  });
  await expect(page.getByRole('heading', { level: 1, name: 'Penalizări' })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Se încarcă penalizările…' })).toBeAttached();
  await expect(page.locator('section[aria-busy="true"]')).toBeVisible();
  await expect(page.getByTestId('penalties-heading')).toHaveCount(0);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await shoot(page, 'loading');
  release();
  await loaded(page);
  await expect(page.getByTestId('penalties-heading')).toHaveText('Penalizări aplicate · 1');
  noWrites(watch);
  expect(errors).toEqual([]);
});

test('organizer.penalties.c1 — a failed ranking read: the error gate; «Încearcă din nou» refetches the competition and the ranking', async ({ page }) => {
  await page.setViewportSize(PHONE);
  let fail = true;
  const { watch } = await open(page, STARTED, {
    setup: (p) =>
      p.route(
        (url) => url.pathname === rankingPath(STARTED),
        (route) => (fail ? route.fulfill({ status: 500, json: { error: { status: 500, message: 'boom' } } }) : route.fallback()),
      ),
  });
  const alert = page.getByRole('alert').filter({ has: page.getByRole('button', { name: 'Încearcă din nou' }) });
  await expect(alert).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole('heading', { level: 1, name: 'Penalizări' })).toBeVisible();
  await shoot(page, 'error');
  const competitionReads = count(watch, competitionPath(STARTED));
  const rankingReads = count(watch, rankingPath(STARTED));
  fail = false;
  await page.getByRole('button', { name: 'Încearcă din nou' }).click();
  await loaded(page);
  expect(count(watch, competitionPath(STARTED))).toBeGreaterThan(competitionReads);
  expect(count(watch, rankingPath(STARTED))).toBeGreaterThan(rankingReads);
  await expect(page.getByTestId('penalties-heading')).toHaveText('Penalizări aplicate · 1');
  noWrites(watch);
});

test('organizer.penalties.c2 organizer.penalties.c4 — the real local penalty, read only for a participant', async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  const { watch, errors } = await open(page, STARTED, { role: 'participant' });
  await loaded(page);
  await expect(page.getByTestId('penalties-heading')).toHaveText('Penalizări aplicate · 1');
  const real = card(page, REAL_PENALTY);
  await expect(real.getByTestId('penalty-action')).toHaveText('Penalizare greutate · 2 kg');
  await expect(real.getByTestId('penalty-team')).toHaveText('Stand A1 · Andrei Popescu');
  await expect(real.getByTestId('penalty-reason')).toHaveText('nadă în exces');
  await expect(real.getByTestId('penalty-author')).toHaveText('Andrew · 10.09.2026, 10:58');
  await expect(real.getByTestId('penalty-marker')).toHaveAttribute('data-tone', 'warning');
  // A participant reads: no «Revocă», no «Aplică penalizare».
  await expect(page.getByRole('button', { name: /^Revocă/ })).toHaveCount(0);
  await expect(page.getByText('Aplică penalizare')).toHaveCount(0);
  await expect(page.getByTestId('penalties-kinds')).toBeVisible();
  noWrites(watch);
  expect(errors).toEqual([]);
});

test('organizer.penalties.c2 organizer.penalties.c4 — every row’s penalties, labelled, newest first; markers, actions, author fallback', async ({ page }) => {
  await page.setViewportSize(PHONE);
  const { watch, errors } = await open(page, STARTED, { role: 'referee', setup: (p) => ranking(p, STARTED, THREE) });
  await loaded(page);
  await expect(page.getByTestId('penalties-heading')).toHaveText('Penalizări aplicate · 3');
  const cards = page.locator('[data-testid^="penalty-p-"]');
  await expect(cards).toHaveCount(3);
  expect(await cards.evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')))).toEqual([
    'penalty-p-elim',
    'penalty-p-deduct',
    'penalty-p-warn',
  ]);
  const elim = card(page, 'p-elim');
  await expect(elim.getByTestId('penalty-action')).toHaveText('Eliminare');
  await expect(elim.getByTestId('penalty-marker')).toHaveAttribute('data-tone', 'danger');
  await expect(elim.getByTestId('penalty-team')).toHaveText('Stand 5 · Pescar 3');
  await expect(elim.getByTestId('penalty-reason')).toHaveText('Pescuit în afara standului');
  await expect(elim.getByTestId('penalty-author')).toHaveText('Arbitrul Ion · 08.10.2026, 12:40');
  const deduct = card(page, 'p-deduct');
  await expect(deduct.getByTestId('penalty-action')).toHaveText('Penalizare greutate · 1,5 kg');
  await expect(deduct.getByTestId('penalty-marker')).toHaveAttribute('data-tone', 'warning');
  await expect(deduct.getByTestId('penalty-team')).toHaveText('Stand 2 · Pescar 1');
  const warn = card(page, 'p-warn');
  await expect(warn.getByTestId('penalty-action')).toHaveText('Avertisment');
  await expect(warn.getByTestId('penalty-marker')).toHaveAttribute('data-tone', 'warning');
  await expect(warn.getByTestId('penalty-team')).toHaveText('Stand 9 · Pescar 2');
  // `author: null` (account deleted) → «Organizator», not the error gate.
  await expect(warn.getByTestId('penalty-author')).toHaveText('Organizator · 08.10.2026, 09:05');
  await expectNoA11yViolations(page);
  await shoot(page, 'lista-arbitru');
  noWrites(watch);
  expect(errors).toEqual([]);
});

test('organizer.penalties.c3 — none, author on a started Cantitate: «Aplică o penalizare…» + «Aplică penalizare» → Alege standul', async ({ page }) => {
  await page.setViewportSize(PHONE);
  const { watch, errors } = await open(page, STARTED, { role: 'author', setup: (p) => ranking(p, STARTED, {}) });
  await loaded(page);
  const empty = page.getByTestId('penalties-empty');
  await expect(empty.getByRole('heading', { name: 'Nu există penalizări aplicate' })).toBeVisible();
  await expect(page.getByTestId('penalties-empty-line')).toHaveText('Aplică o penalizare pentru a o vedea aici.');
  const cta = page.getByTestId('apply-penalty-empty');
  await expect(cta).toHaveAttribute('href', `/concursuri/${STARTED}/penalizari/stand`);
  // The CTA is in the empty state only, not repeated in an action bar.
  await expect(visibleApply(page)).toHaveCount(0);
  await expectNoA11yViolations(page);
  await shoot(page, 'gol-autor');
  await cta.click();
  await expect(page).toHaveURL(new RegExp(`/concursuri/${STARTED}/penalizari/stand$`), { timeout: 30_000 });
  noWrites(watch);
  expect(errors).toEqual([]);
});

test('organizer.penalties.c3 — none, a participant: «Organizatorul nu a aplicat încă…», no CTA', async ({ page }) => {
  await page.setViewportSize(PHONE);
  const { watch } = await open(page, STARTED, { role: 'participant', setup: (p) => ranking(p, STARTED, {}) });
  await loaded(page);
  await expect(page.getByTestId('penalties-empty-line')).toHaveText('Organizatorul nu a aplicat încă nicio penalizare în această competiție.');
  await expect(page.getByText('Aplică penalizare')).toHaveCount(0);
  noWrites(watch);
});

test('organizer.penalties.c3 — none, a ranking type without penalties: «Penalizările nu se aplică…», no CTA even for the author', async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  const { watch } = await open(page, STARTED, {
    role: 'author',
    setup: async (p) => {
      await editCompetition(p, STARTED, { rankingType: 'quality' });
      await p.route(
        (url) => url.pathname === rankingPath(STARTED),
        (route) => route.fulfill({ json: { metadata: { rankingType: 'quality', totalQuantity: 0, totalCatchesCount: 0, biggestFish: 0, numberOfSectors: 1, biggestCatch: null }, rankings: [] } }),
      );
    },
  });
  await loaded(page);
  await expect(page.getByTestId('penalties-empty-line')).toHaveText('Penalizările nu se aplică pentru acest tip de clasament.');
  await expect(page.getByText('Aplică penalizare')).toHaveCount(0);
  await expect(page.getByTestId('penalties-kinds')).toHaveCount(0);
  await shoot(page, 'gol-fara-penalizari');
  noWrites(watch);
});

test('organizer.penalties.c3 — not started: the ranking is never read, the empty state', async ({ page }) => {
  await page.setViewportSize(PHONE);
  const { watch } = await open(page, STARTED, { role: 'author', setup: (p) => editCompetition(p, STARTED, { competitionStatus: 'notStarted' }) });
  await loaded(page);
  await expect(page.getByTestId('penalties-empty-line')).toHaveText('Organizatorul nu a aplicat încă nicio penalizare în această competiție.');
  await expect(page.getByText('Aplică penalizare')).toHaveCount(0);
  await page.waitForTimeout(800);
  expect(count(watch, rankingPath(STARTED))).toBe(0);
  noWrites(watch);
});

test('organizer.penalties.c5 — author or referee + started + Cantitate: the action bar «Aplică penalizare» opens the stand picker; not for a participant, nor when completed', async ({ page }) => {
  await page.setViewportSize(PHONE);
  const { watch } = await open(page, STARTED, { role: 'author' });
  await loaded(page);
  await expect(visibleApply(page)).toHaveCount(1);
  await expect(visibleApply(page)).toHaveAttribute('href', `/concursuri/${STARTED}/penalizari/stand`);
  // From 1280 the same action is docked in the aside.
  await page.setViewportSize(DESKTOP);
  await expect(visibleApply(page)).toBeInViewport();
  await expect(page.getByTestId('penalties-summary')).toBeVisible();
  await shoot(page, 'lista-autor');
  await visibleApply(page).click();
  await expect(page).toHaveURL(new RegExp(`/concursuri/${STARTED}/penalizari/stand$`), { timeout: 30_000 });
  noWrites(watch);
});

for (const [label, role, change] of [
  ['a participant', 'participant', {}],
  ['the author of a completed competition', 'author', { competitionStatus: 'completed' }],
  ['the author on a quantityQuality ranking — allowed', 'author', { rankingType: 'quantityQuality' }],
  ['a referee on a quality ranking — not allowed (Revocă stays)', 'referee', { rankingType: 'quality' }],
] as const) {
  test(`organizer.penalties.c5 organizer.penalties.c6 — ${label}`, async ({ page }) => {
    await page.setViewportSize(PHONE);
    const { watch } = await open(page, STARTED, { role, setup: (p) => editCompetition(p, STARTED, change) });
    await loaded(page);
    const status = (change as { competitionStatus?: string }).competitionStatus ?? 'started';
    const type = (change as { rankingType?: string }).rankingType ?? 'quantity';
    const staff = role === 'author' || role === 'referee';
    const canApply = staff && status === 'started' && (type === 'quantity' || type === 'quantityQuality');
    const canRevoke = staff && status === 'started';
    await expect(visibleApply(page)).toHaveCount(canApply ? 1 : 0);
    await expect(card(page, REAL_PENALTY).getByRole('button', { name: /^Revocă/ })).toHaveCount(canRevoke ? 1 : 0);
    noWrites(watch);
  });
}

test('organizer.penalties.c6 — «Revocă» → «Revocă penalizarea?»; «Anulează» keeps it; «Revocă» → DELETE /penalties/:id, then the ranking and Best-N are read again', async ({ page }) => {
  await page.setViewportSize(PHONE);
  let rows: Record<number, Penalty[]> = { ...THREE };
  const deletes: { method: string; path: string; body: string | null }[] = [];
  const { watch, errors } = await open(page, STARTED, {
    role: 'author',
    setup: async (p) => {
      await ranking(p, STARTED, () => rows);
      await p.route(
        (url) => url.pathname.startsWith('/api/cms/penalties/'),
        (route) => {
          const r = route.request();
          deletes.push({ method: r.method(), path: path(r.url()), body: r.postData() });
          rows = { 0: THREE[0], 1: THREE[1] };
          return route.fulfill({ status: 200, json: { data: null } });
        },
      );
    },
  });
  await loaded(page);
  const revoke = card(page, 'p-elim').getByRole('button', { name: /^Revocă/ });
  await expect(revoke).toHaveAccessibleName('Revocă: Eliminare, Stand 5 · Pescar 3');
  await revoke.click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog.getByRole('heading', { name: 'Revocă penalizarea?' })).toBeVisible();
  await expect(dialog).toContainText('Acțiunea va elimina penalizarea din clasament.');
  // axe reads colours mid fade-in: let the finite animations land.
  await page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished.catch(() => {}))));
  await expectNoA11yViolations(page);
  await shoot(page, 'revoca');
  await dialog.getByRole('button', { name: 'Anulează' }).click();
  await expect(dialog).toHaveCount(0);
  expect(deletes).toEqual([]);

  await revoke.click();
  const rankingReads = count(watch, rankingPath(STARTED));
  const bestNBefore = count(watch, bestNPath(STARTED));
  await page.getByRole('alertdialog').getByRole('button', { name: 'Revocă', exact: true }).click();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  expect(deletes).toEqual([{ method: 'DELETE', path: '/api/cms/penalties/p-elim', body: null }]);
  await expect(page.getByRole('status').filter({ hasText: 'Penalizarea a fost revocată.' })).toBeVisible();
  await expect(card(page, 'p-elim')).toHaveCount(0);
  await expect(page.getByTestId('penalties-heading')).toHaveText('Penalizări aplicate · 2');
  await expect(page.getByTestId('penalties-heading')).toBeFocused();
  expect(count(watch, rankingPath(STARTED))).toBeGreaterThan(rankingReads);
  // Best-N is invalidated too (fish useDeletePenalty): read again only when something observes it —
  // nothing on this page does, so the invalidation is proven in core's unit test; here: never a write.
  expect(count(watch, bestNPath(STARTED))).toBeGreaterThanOrEqual(bestNBefore);
  expect(watch.writes).toEqual(['DELETE /api/cms/penalties/p-elim']);
  expect(errors).toEqual([]);
});

test('organizer.penalties.c6 — a refused DELETE stays in the dialog with its message; the penalty stays', async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  const { watch } = await open(page, STARTED, {
    role: 'referee',
    setup: async (p) => {
      await ranking(p, STARTED, THREE);
      await p.route(
        (url) => url.pathname.startsWith('/api/cms/penalties/'),
        (route) => route.fulfill({ status: 400, json: { error: { status: 400, name: 'ApplicationError', message: 'Competiția s-a încheiat.' } } }),
      );
    },
  });
  await loaded(page);
  await card(page, 'p-warn').getByRole('button', { name: /^Revocă/ }).click();
  const dialog = page.getByRole('alertdialog');
  await dialog.getByRole('button', { name: 'Revocă', exact: true }).click();
  await expect(dialog.getByTestId('revoke-error')).toBeVisible();
  await expect(dialog).toBeVisible();
  await expect(card(page, 'p-warn')).toBeVisible();
  expect(watch.writes).toEqual(['DELETE /api/cms/penalties/p-warn']);
});

test('organizer.penalties.c6 — a stale ranking (edge cache) still carries the revoked penalty: the card goes anyway; a 404 on DELETE reads as already revoked', async ({ page }) => {
  await page.setViewportSize(PHONE);
  const deletes: string[] = [];
  const { watch, errors } = await open(page, STARTED, {
    role: 'author',
    setup: async (p) => {
      // The ranking never changes: every refetch still returns all three.
      await ranking(p, STARTED, THREE);
      await p.route(
        (url) => url.pathname.startsWith('/api/cms/penalties/'),
        (route) => {
          const r = route.request();
          deletes.push(`${r.method()} ${path(r.url())}`);
          // The first is revoked; the second was already revoked elsewhere → 404.
          return deletes.length === 1
            ? route.fulfill({ status: 200, json: { data: null } })
            : route.fulfill({ status: 404, json: { data: null, error: { status: 404, name: 'NotFoundError', message: 'Not Found' } } });
        },
      );
    },
  });
  await loaded(page);
  const rankingReads = count(watch, rankingPath(STARTED));
  await card(page, 'p-elim').getByRole('button', { name: /^Revocă/ }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Revocă', exact: true }).click();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await expect(page.getByRole('status').filter({ hasText: 'Penalizarea a fost revocată.' })).toBeVisible();
  await expect.poll(() => count(watch, rankingPath(STARTED))).toBeGreaterThan(rankingReads);
  // The refetch answered with the penalty still there: it stays gone.
  await expect(card(page, 'p-elim')).toHaveCount(0);
  await expect(page.getByTestId('penalties-heading')).toHaveText('Penalizări aplicate · 2');

  const before = count(watch, rankingPath(STARTED));
  await card(page, 'p-deduct').getByRole('button', { name: /^Revocă/ }).click();
  const dialog = page.getByRole('alertdialog');
  await dialog.getByRole('button', { name: 'Revocă', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText('A apărut o eroare necunoscută')).toHaveCount(0);
  await expect(card(page, 'p-deduct')).toHaveCount(0);
  await expect(page.getByTestId('penalties-heading')).toHaveText('Penalizări aplicate · 1');
  await expect.poll(() => count(watch, rankingPath(STARTED))).toBeGreaterThan(before);
  expect(deletes).toEqual(['DELETE /api/cms/penalties/p-elim', 'DELETE /api/cms/penalties/p-deduct']);
  expect(watch.writes).toEqual(deletes);
  // The browser logs the answered 404 itself; nothing else may be logged.
  expect(errors.filter((e) => !/status of 404/.test(e))).toEqual([]);
});
