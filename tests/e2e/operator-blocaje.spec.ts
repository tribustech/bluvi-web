import { mkdirSync } from 'node:fs';
import { expect, test, type Locator, type Page, type Route } from '@playwright/test';
import { createBlock, deleteBlock, getBlocks, type AvailabilityBlockDTO } from '@/core/booking';
import { createTestTransport } from '../transport';
import { expectNoA11yViolations } from './helpers/a11y';
import { collectConsoleErrors } from './helpers/console';
import { CMS, qaJwt, signIn } from './helpers/session';

/*
 * operator.blocaje (/operator/[lakeId]/blocaje, «Blocaje și închideri», T1) c1–c12. fish:
 * app/(app)/operator/[lakeId]/blocks.tsx, features/operator/BlockRow.tsx, blockListModel.ts.
 *
 * REAL: the QA user owns Chita on the LOCAL CMS. beforeAll POSTs (core createBlock) one single-stand
 * block and one 2-stand group far in the future, tagged with this run's note; the test deletes both
 * through the UI (sequential DELETEs, spinner, toasts) and afterAll deletes any leftover with the
 * tag through the API. Every other state (past, legacy offlineReservation, every reason, period
 * formats, empty, loading, error, failed delete) is a route fixture of the browser's proxy call
 * /api/cms/feed/availability-blocks, on a fixed device clock (Fri 9 Oct 2026 14:00, Bucharest).
 */

const WIDTHS = [375, 1280, 1440, 1920] as const;
const SHOTS = '.shots/operator-blocaje';
const EXPECTED_CONSOLE = [/Failed to load resource: the server responded with a status of (403|404|500)/];
const LIST = /\/api\/cms\/feed\/availability-blocks\?/;
const ONE = /\/api\/cms\/feed\/availability-blocks\/[^/?]+$/;

const NOW = new Date('2026-10-09T14:00:00+03:00');
test.use({ timezoneId: 'Europe/Bucharest', locale: 'ro-RO' });

const TAG = `e2e-blocaje ${Date.now().toString(36)}`;
let jwt: string;
let lakeId: string;
let stands: Record<string, string>;
let single: AvailabilityBlockDTO;
let group: AvailabilityBlockDTO[];

async function cleanup() {
  const t = createTestTransport(jwt);
  const left = (await getBlocks(t, lakeId)).filter((b) => b.note?.startsWith('e2e-blocaje'));
  for (const b of left) await deleteBlock(t, b.documentId).catch(() => undefined);
}

test.beforeAll(async ({ request }) => {
  jwt = await qaJwt(request);
  mkdirSync(SHOTS, { recursive: true });
  const owned = await request.get(`${CMS}/feed/owned-lakes`, { headers: { Authorization: `Bearer ${jwt}` } });
  expect(owned.ok()).toBe(true);
  lakeId = ((await owned.json()).data as { documentId: string }[])[0]!.documentId;
  const av = await request.get(`${CMS}/feed/lakes/${lakeId}/availability?from=2027-03-01&to=2027-03-03`);
  stands = Object.fromEntries(((await av.json()).data.stands as { documentId: string; name: string }[]).map((s) => [s.name, s.documentId]));
  await cleanup();
  const t = createTestTransport(jwt);
  // Same day on stand 3: «Vi 12 mar · 06:00–18:00».
  single = await createBlock(t, {
    lake: lakeId,
    stand: stands['3'],
    startDate: '2027-03-12T06:00:00+02:00',
    endDate: '2027-03-12T18:00:00+02:00',
    reason: 'maintenance',
    note: `${TAG} single`,
  });
  // Whole days on stands 10 and 2 (one save = one row, natural order «2, 10»): «Vi 19 – Du 21 mar».
  group = [];
  for (const s of ['10', '2']) {
    group.push(
      await createBlock(t, {
        lake: lakeId,
        stand: stands[s],
        startDate: '2027-03-19T00:00:00+02:00',
        endDate: '2027-03-22T00:00:00+02:00',
        reason: 'competition',
        note: `${TAG} grup`,
      }),
    );
  }
});

test.afterAll(async () => {
  if (jwt && lakeId) await cleanup();
});

/* ---------------------------------------------------------------------------------------------
 * Fixtures
 * ------------------------------------------------------------------------------------------- */

const at = (d: string, hm: string) => `2026-${d}T${hm}:00+03:00`;
let seq = 0;
const fx = (over: Omit<Partial<AvailabilityBlockDTO>, 'stand'> & { stand?: string }): AvailabilityBlockDTO => {
  const id = `fx-${++seq}`;
  const { stand, ...rest } = over;
  return {
    documentId: id,
    startDate: at('10-10', '06:00'),
    endDate: at('10-10', '18:00'),
    reason: 'closure',
    standKey: stand ? `st-${stand}` : null,
    ...(stand ? { stand: { documentId: `st-${stand}`, name: stand } } : {}),
    ...rest,
  } as AvailabilityBlockDTO;
};

/** Every reason, every period format, the legacy phone booking, a long note, two finished blocks. */
function richFixture(): AvailabilityBlockDTO[] {
  return [
    // c7 same day.
    fx({ reason: 'competition', startDate: at('10-10', '06:00'), endDate: at('10-10', '18:00'), note: 'Cupa Toamnei' }),
    // c7 otherwise (crosses midnight, not whole days) + c6 legacy offlineReservation with contact.
    fx({
      reason: 'offlineReservation',
      stand: '4',
      startDate: at('10-16', '18:00'),
      endDate: at('10-18', '06:00'),
      contactName: 'Ion Popescu',
      contactPhone: '0722 123 456',
      note: 'A sunat vineri, vine cu doi prieteni și are nevoie de loc pentru cort și pentru barcă; plătește la poartă cash, fără avans, și vrea standul de lângă dig dacă se poate',
    }),
    // c7 whole days across months: last INCLUDED day, both months.
    fx({ reason: 'maintenance', stand: '12', startDate: '2026-10-30T00:00:00+02:00', endDate: '2026-11-02T00:00:00+02:00' }),
    fx({ reason: 'maintenance', stand: '9', startDate: '2026-10-30T00:00:00+02:00', endDate: '2026-11-02T00:00:00+02:00' }),
    fx({ reason: 'maintenance', stand: '11', startDate: '2026-10-30T00:00:00+02:00', endDate: '2026-11-02T00:00:00+02:00' }),
    // Next month section; «Altele».
    fx({ reason: 'other', startDate: '2026-11-14T00:00:00+02:00', endDate: '2026-11-16T00:00:00+02:00', note: 'Pescuit închis pentru pești de primăvară' }),
    // c5 past (ended before NOW): newest first once shown.
    fx({ documentId: 'past-old', reason: 'closure', startDate: at('08-01', '06:00'), endDate: at('08-01', '18:00') }),
    fx({ documentId: 'past-new', reason: 'closure', stand: '1', startDate: at('10-01', '06:00'), endDate: at('10-01', '18:00') }),
  ];
}

type Reply = { status?: number; body?: unknown; delayMs?: number };
async function mockList(page: Page, reply: (call: number) => Reply) {
  let calls = 0;
  await page.route(LIST, async (r: Route) => {
    if (r.request().method() !== 'GET') return r.fallback();
    calls += 1;
    const { status = 200, body, delayMs } = reply(calls);
    if (delayMs) await new Promise((res) => setTimeout(res, delayMs));
    await r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  });
  return { count: () => calls };
}
const ok = (data: AvailabilityBlockDTO[]): Reply => ({ body: { data } });
const fail = (status: number, message = 'x', bluCode?: string): Reply => ({
  status,
  body: { data: null, error: { status, name: 'Error', message, details: bluCode ? { bluCode } : {} } },
});

const page$ = () => `/operator/${lakeId}/blocaje`;
const visible = (l: Locator) => l.filter({ visible: true });
const heading = (page: Page) => page.getByRole('heading', { level: 1 });
const rows = (page: Page) => page.getByTestId('block-row');
const rowOf = (page: Page, id: string) => page.locator(`[data-testid="block-row"][data-block*="${id}"]`);
const sections = (page: Page) => page.getByTestId('blocks-section');
/** How many grid columns the month cards sit in (c4). */
const columns = (page: Page) =>
  sections(page)
    .first()
    .evaluate((el) => {
      const cols = getComputedStyle(el.parentElement!).gridTemplateColumns;
      return cols === 'none' ? 1 : cols.split(' ').length;
    });
async function expectColumns(page: Page, perWidth: Record<number, number>) {
  for (const [w, n] of Object.entries(perWidth)) {
    await page.setViewportSize({ width: Number(w), height: 900 });
    await expect.poll(() => columns(page), { message: `columns at ${w}` }).toBe(n);
  }
}
/** The site toast's text (role=status for success, role=alert for a failure). */
const toast = (page: Page) => page.locator('.z-toast p');

async function open(page: Page, width = 1280) {
  await page.clock.setFixedTime(NOW);
  await page.setViewportSize({ width, height: 900 });
  await page.goto(page$());
}

async function shoot(page: Page, name: string, widths: readonly number[] = WIDTHS) {
  for (const w of widths) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${SHOTS}/${name}-${w}.png`, fullPage: true });
  }
}

/* ---------------------------------------------------------------------------------------------
 * Signed out
 * ------------------------------------------------------------------------------------------- */

test.describe('signed out', () => {
  test('role-gating: a signed-out visitor goes to /intra and back', async ({ page }) => {
    await page.goto('/operator/s84u55lo4n9z0emngozttt6e/blocaje');
    await expect(page).toHaveURL(/\/intra\?next=%2Foperator%2Fs84u55lo4n9z0emngozttt6e%2Fblocaje$/);
  });
});

/* ---------------------------------------------------------------------------------------------
 * Signed in
 * ------------------------------------------------------------------------------------------- */

test.describe('signed in', () => {
  test.beforeEach(async ({ context }) => {
    await signIn(context, jwt);
  });

  test('REAL c1 c2 c3 c4 c6 c7 c8 c9 c10 c12: the seeded blocks, deleted through the UI one DELETE after another', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    const req = page.waitForRequest((r) => LIST.test(r.url()));
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(page$());
    // c2: one GET, the lake as the only parameter, through the per-owner proxy.
    const url = new URL((await req).url());
    expect(url.pathname).toBe('/api/cms/feed/availability-blocks');
    expect([...url.searchParams.entries()]).toEqual([['lakeId', lakeId]]);

    // c1: header.
    await expect(heading(page)).toHaveText('Blocaje și închideri');
    const add = page.getByRole('link', { name: 'Adaugă blocaj' });
    await expect(add).toHaveAttribute('href', `/operator/${lakeId}/blocaje/nou`);
    const look = await add.evaluate((el) => {
      const s = getComputedStyle(el);
      return { radius: s.borderRadius, w: el.getBoundingClientRect().width, h: el.getBoundingClientRect().height, bg: s.backgroundColor };
    });
    expect(look.w).toBe(look.h);
    expect(parseFloat(look.radius)).toBeGreaterThanOrEqual(look.w / 2);
    expect(look.bg).not.toBe('rgba(0, 0, 0, 0)');
    await expect(page.getByRole('button', { name: 'Înapoi' }).first()).toBeVisible();

    // c3 c4 c6 c7 c8: the single and the group, under «Martie 2027».
    const one = rowOf(page, single.documentId);
    const grp = rowOf(page, group[0]!.documentId);
    await expect(one).toBeVisible({ timeout: 30_000 });
    await expect(one.getByTestId('block-period')).toHaveText('Vi 12 mar · 06:00–18:00');
    await expect(one.getByTestId('block-meta')).toHaveText('Întreținere · Standul 3');
    await expect(one.getByTestId('block-extra')).toHaveText(`${TAG} single`);
    await expect(grp).toHaveCount(1);
    expect((await grp.getAttribute('data-block'))!.split(',').sort()).toEqual(group.map((b) => b.documentId).sort());
    await expect(grp.getByTestId('block-period')).toHaveText('Vi 19 – Du 21 mar');
    await expect(grp.getByTestId('block-meta')).toHaveText('Concurs · Standurile 2, 10');
    const march = sections(page).filter({ has: page.getByRole('heading', { name: 'Martie 2027' }) });
    await expect(march.getByTestId('block-row').filter({ hasText: TAG })).toHaveCount(2);
    // ordered by start: the single (12 Mar) before the group (19 Mar).
    const order = await march.getByTestId('block-row').filter({ hasText: TAG }).evaluateAll((els) => els.map((e) => e.getAttribute('data-block')));
    expect(order[0]).toBe(single.documentId);
    expect(await march.getByRole('heading', { name: 'Martie 2027' }).evaluate((el) => getComputedStyle(el).textTransform)).toBe('uppercase');

    await expectNoA11yViolations(page);
    await shoot(page, 'real');
    await page.setViewportSize({ width: 1280, height: 900 });

    // c9: the group's confirm; «Înapoi» deletes nothing.
    const deletes: { id: string; start: number; end: number }[] = [];
    await page.route(ONE, async (r) => {
      if (r.request().method() !== 'DELETE') return r.fallback();
      const start = Date.now();
      await new Promise((res) => setTimeout(res, 700));
      const resp = await r.fetch();
      deletes.push({ id: new URL(r.request().url()).pathname.split('/').pop()!, start, end: Date.now() });
      await r.fulfill({ response: resp });
    });
    await grp.getByRole('button', { name: 'Șterge blocajul' }).click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading')).toHaveText('Șterge 2 blocaje?');
    await expect(dialog).toContainText('Standurile 2, 10 — se deblochează toate.');
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${SHOTS}/confirm-group-1280.png` });
    await dialog.getByRole('button', { name: 'Înapoi' }).click();
    await expect(dialog).toBeHidden();
    expect(deletes).toEqual([]);

    // From here the list GET (the mutation's invalidation) is slow, as on staging / ngrok: the
    // deleted row must be gone from the cache when the toast shows, not come back until the GET lands.
    let slowList = false;
    await page.route(LIST, async (r) => {
      if (r.request().method() !== 'GET' || !slowList) return r.fallback();
      await new Promise((res) => setTimeout(res, 4000));
      await r.fallback();
    });
    slowList = true;

    // c10: confirm → spinner on the row, two DELETEs one after another, «2 blocaje șterse».
    await grp.getByRole('button', { name: 'Șterge blocajul' }).click();
    await dialog.getByRole('button', { name: 'Șterge' }).click();
    await expect(grp.getByTestId('block-deleting')).toBeVisible();
    await expect(grp).toHaveAttribute('aria-busy', 'true');
    await page.screenshot({ path: `${SHOTS}/deleting-1280.png` });
    await expect(toast(page)).toHaveText('2 blocaje șterse', { timeout: 15_000 });
    // Gone at once (well inside the 4 s GET), never back with a live trash.
    await expect(grp).toHaveCount(0, { timeout: 500 });
    expect(deletes.map((d) => d.id).sort()).toEqual(group.map((b) => b.documentId).sort());
    expect(deletes[1]!.start).toBeGreaterThanOrEqual(deletes[0]!.end);
    // Focus is not lost to the page when the row goes.
    await expect(heading(page)).toBeFocused();

    // c9 c10 single, by keyboard: Tab to the trash, Enter, then «Șterge».
    await one.getByRole('button', { name: 'Șterge blocajul' }).focus();
    await page.keyboard.press('Enter');
    await expect(dialog.getByRole('heading')).toHaveText('Șterge blocajul?');
    await expect(dialog).toContainText('Această acțiune nu poate fi anulată.');
    // Escape is «Înapoi»; focus goes back to the trash.
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(one.getByRole('button', { name: 'Șterge blocajul' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Șterge' }).click();
    await expect(toast(page)).toHaveText('Blocaj șters', { timeout: 15_000 });
    await expect(one).toHaveCount(0, { timeout: 500 });
    // …and the slow refetch that lands later does not bring anything back.
    await page.waitForTimeout(4500);
    await expect(grp).toHaveCount(0);
    await expect(one).toHaveCount(0);

    // The CMS agrees: nothing of this run is left.
    const left = (await getBlocks(createTestTransport(jwt), lakeId)).filter((b) => b.note?.startsWith(TAG));
    expect(left).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('c2: first load shows the skeleton under the real header', async ({ page }) => {
    await mockList(page, () => ({ ...ok(richFixture()), delayMs: 2500 }));
    await open(page, 375);
    await expect(page.getByTestId('blocks-loading').filter({ visible: true })).toBeVisible();
    await expect(heading(page)).toHaveText('Blocaje și închideri');
    await page.screenshot({ path: `${SHOTS}/loading-375.png`, fullPage: true });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.screenshot({ path: `${SHOTS}/loading-1280.png`, fullPage: true });
    await expect(rows(page).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('blocks-loading')).toHaveCount(0);
  });

  test('c2: a failed read is the shared error state; retry loads the list', async ({ page }) => {
    const errors = collectConsoleErrors(page, { ignore: EXPECTED_CONSOLE });
    let failing = true;
    const calls = await mockList(page, () => (failing ? fail(500) : ok(richFixture())));
    await open(page);
    const retry = page.getByRole('button', { name: 'Încearcă din nou' });
    await expect(retry).toBeVisible({ timeout: 30_000 });
    await expect(heading(page)).toHaveText('Blocaje și înch​ideri'.replace('​', ''));
    await expectNoA11yViolations(page);
    await shoot(page, 'error');
    await page.setViewportSize({ width: 1280, height: 900 });
    failing = false;
    const n = calls.count();
    await retry.click();
    await expect(rows(page).first()).toBeVisible({ timeout: 15_000 });
    expect(calls.count()).toBeGreaterThan(n);
    expect(errors).toEqual([]);
  });

  test('c2: another owner’s lake (403) reads «Nu ai acces»', async ({ page }) => {
    const errors = collectConsoleErrors(page, { ignore: EXPECTED_CONSOLE });
    await mockList(page, () => fail(403, 'Forbidden'));
    await open(page);
    await expect(page.getByText('Nu ai acces')).toBeVisible({ timeout: 30_000 });
    expect(errors).toEqual([]);
  });

  test('c3 c4 c6 c7 c8: every reason, its tint, the period formats, scope, the legacy contact line', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await mockList(page, () => ok(richFixture()));
    await open(page);
    await expect(rows(page).first()).toBeVisible({ timeout: 30_000 });
    // c4: upcoming only, by start month, captions uppercase.
    await expect(sections(page).getByRole('heading')).toHaveText(['Octombrie 2026', 'Noiembrie 2026']);
    const periods = await sections(page).first().getByTestId('block-period').allTextContents();
    // c3: start order; c7 the three formats.
    expect(periods).toEqual(['Sâ 10 oct · 06:00–18:00', 'Vi 16 oct 18:00 – Du 18 oct 06:00', 'Vi 30 oct – Du 1 noi']);
    const metas = await sections(page).first().getByTestId('block-meta').allTextContents();
    // c3 c8: the three-stand save is one row, natural order.
    expect(metas).toEqual(['Concurs · Tot lacul', 'Rezervare telefonică · Standul 4', 'Întreținere · Standurile 9, 11, 12']);
    await expect(sections(page).nth(1).getByTestId('block-meta')).toHaveText(['Altele · Tot lacul']);
    // c6: the legacy phone booking's contact — note line, two lines at most.
    const legacy = rows(page).filter({ hasText: 'Rezervare telefonică' });
    const extra = legacy.getByTestId('block-extra');
    await expect(extra).toContainText('Ion Popescu · 0722 123 456 — A sunat vineri');
    const clamp = await extra.evaluate((el) => {
      const s = getComputedStyle(el);
      return { clamp: s.webkitLineClamp, lines: Math.round(el.getBoundingClientRect().height / parseFloat(s.lineHeight)) };
    });
    expect(clamp.clamp).toBe('2');
    expect(clamp.lines).toBeLessThanOrEqual(2);
    // c6: the reason tints — five distinct dot colours, each on its own tinted square.
    const dots = await page.getByTestId('block-row').evaluateAll((els) =>
      els.map((e) => {
        const sq = e.querySelector('[data-testid="block-tint"]')!;
        return { reason: e.getAttribute('data-reason'), dot: getComputedStyle(sq.firstElementChild!).backgroundColor, bg: getComputedStyle(sq).backgroundColor };
      }),
    );
    const byReason = new Map(dots.map((d) => [d.reason, d]));
    expect([...byReason.keys()].sort()).toEqual(['competition', 'maintenance', 'offlineReservation', 'other']);
    expect(new Set([...byReason.values()].map((d) => d.dot)).size).toBe(4);
    for (const d of byReason.values()) expect(d.bg).not.toBe(d.dot);
    // c9: every trash is «Șterge blocajul»; its description says which block (WCAG 2.4.6).
    const group3 = rows(page).filter({ hasText: 'Standurile 9, 11, 12' });
    await expect(group3.getByRole('button', { name: 'Șterge blocajul' })).toHaveAccessibleDescription('Vi 30 oct – Du 1 noi Întreținere · Standurile 9, 11, 12');
    await expect(rows(page).filter({ hasText: 'Cupa Toamnei' }).getByRole('button', { name: 'Șterge blocajul' })).toHaveAccessibleDescription(
      'Sâ 10 oct · 06:00–18:00 Concurs · Tot lacul',
    );
    // c5: the past stays hidden.
    await expect(rows(page)).toHaveCount(4);
    await expectNoA11yViolations(page);
    await shoot(page, 'rich');
    // c4: two months fill the width — one column on the phone, two cards side by side up to 1920.
    await expectColumns(page, { 375: 1, 1280: 2, 1440: 2, 1920: 2 });
    expect(errors).toEqual([]);
  });

  test('c5: «Afișează trecutul (2)» reveals «Trecut» last, newest first, dimmed, and moves focus there', async ({ page }) => {
    await mockList(page, () => ok(richFixture()));
    await open(page);
    const show = page.getByRole('button', { name: 'Afișează trecutul (2)' });
    await expect(show).toBeVisible({ timeout: 30_000 });
    await show.focus();
    await page.keyboard.press('Enter');
    await expect(show).toHaveCount(0);
    const past = sections(page).last();
    await expect(past.getByRole('heading')).toHaveText('Trecut');
    await expect(past.getByRole('heading')).toBeFocused();
    expect(await past.getByTestId('block-row').evaluateAll((els) => els.map((e) => e.getAttribute('data-block')))).toEqual(['past-new', 'past-old']);
    // c6 closure tint is there now too.
    await expect(past.locator('[data-reason="closure"]')).toHaveCount(2);
    // Dimmed: the tint fades, the period steps down from ink to muted (AA contrast kept).
    const look = (l: Locator) =>
      l.evaluate((el) => ({
        tint: Number(getComputedStyle(el.querySelector('[data-testid="block-tint"]')!).opacity),
        period: getComputedStyle(el.querySelector('[data-testid="block-period"]')!).color,
      }));
    const was = await look(past.getByTestId('block-row').first());
    const now = await look(sections(page).first().getByTestId('block-row').first());
    expect(was.tint).toBeLessThan(0.7);
    expect(now.tint).toBe(1);
    expect(was.period).not.toBe(now.period);
    await expectNoA11yViolations(page);
    await shoot(page, 'past');
    // c4: three cards — two columns to 1440, three at 1920.
    await expectColumns(page, { 375: 1, 1280: 2, 1440: 2, 1920: 3 });
  });

  test('c11: no block at all is the empty state; only finished ones: empty + the past link', async ({ page }) => {
    let data: AvailabilityBlockDTO[] = [];
    await mockList(page, () => ok(data));
    await open(page);
    const empty = page.getByTestId('blocks-empty');
    await expect(empty).toBeVisible({ timeout: 30_000 });
    await expect(empty).toContainText('Niciun blocaj.');
    await expect(empty).toContainText('Apasă + pentru a închide lacul sau standuri într-o perioadă.');
    await expect(page.getByTestId('blocks-show-past')).toHaveCount(0);
    await expectNoA11yViolations(page);
    await shoot(page, 'empty');
    data = richFixture().filter((b) => b.documentId.startsWith('past-'));
    await page.getByRole('button', { name: 'Reîmprospătează' }).filter({ visible: true }).click();
    await expect(page.getByRole('button', { name: 'Afișează trecutul (2)' })).toBeVisible();
    await expect(empty).toBeVisible();
  });

  test('c10: a failed delete says why (server message, else the fallback) and keeps the row', async ({ page }) => {
    const errors = collectConsoleErrors(page, { ignore: EXPECTED_CONSOLE });
    await mockList(page, () => ok(richFixture()));
    let reply: Reply = fail(500);
    await page.route(ONE, async (r) => {
      if (r.request().method() !== 'DELETE') return r.fallback();
      await r.fulfill({ status: reply.status, contentType: 'application/json', body: JSON.stringify(reply.body) });
    });
    await open(page, 375);
    const row = rows(page).filter({ hasText: 'Cupa Toamnei' });
    await row.getByRole('button', { name: 'Șterge blocajul' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Șterge' }).click();
    await expect(toast(page)).toHaveText('Nu am putut șterge blocajul.');
    await expect(row).toBeVisible();
    await expect(row.getByTestId('block-deleting')).toHaveCount(0);
    await page.screenshot({ path: `${SHOTS}/delete-failed-375.png` });
    reply = fail(404, 'Blocajul nu mai există.', 'BLOCK_NOT_FOUND');
    await row.getByRole('button', { name: 'Șterge blocajul' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Șterge' }).click();
    await expect(toast(page)).toHaveText('Blocajul nu mai există.');
    expect(errors).toEqual([]);
  });

  test('c10: a group whose second DELETE fails says how many were deleted and keeps the rest', async ({ page }) => {
    const errors = collectConsoleErrors(page, { ignore: EXPECTED_CONSOLE });
    // The list follows the DELETEs (a block gone on the server is gone from the next GET).
    const gone = new Set<string>();
    const data = richFixture();
    await mockList(page, () => ok(data.filter((b) => !gone.has(b.documentId))));
    const deletes: string[] = [];
    await page.route(ONE, async (r) => {
      if (r.request().method() !== 'DELETE') return r.fallback();
      const id = new URL(r.request().url()).pathname.split('/').pop()!;
      deletes.push(id);
      if (deletes.length === 2) return r.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify(fail(500).body) });
      gone.add(id);
      await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { documentId: id } }) });
    });
    await open(page);
    const row = rows(page).filter({ hasText: 'Întreținere' });
    await expect(row.getByTestId('block-meta')).toHaveText('Întreținere · Standurile 9, 11, 12', { timeout: 30_000 });
    await row.getByRole('button', { name: 'Șterge blocajul' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Șterge' }).click();
    await expect(toast(page)).toHaveText('1 din 3 blocaje șterse. Nu am putut șterge blocajul.', { timeout: 15_000 });
    // Two DELETEs, the third never sent; the row now lists only the two stands still blocked.
    expect(deletes).toHaveLength(2);
    await expect(row).toHaveCount(1);
    await expect(row.getByTestId('block-meta')).not.toHaveText('Întreținere · Standurile 9, 11, 12');
    await expect(row.getByTestId('block-meta')).toHaveText(/^Întreținere · Standurile \d+, \d+$/);
    await expect(row.getByTestId('block-deleting')).toHaveCount(0);
    await page.screenshot({ path: `${SHOTS}/delete-partial-1280.png` });
    expect(errors).toEqual([]);
  });

  test('c12: the refresh control and a window focus refetch the blocks; no polling', async ({ page }) => {
    const calls = await mockList(page, () => ok(richFixture()));
    await open(page);
    await expect(rows(page).first()).toBeVisible({ timeout: 30_000 });
    await expect.poll(() => calls.count()).toBe(1);
    await page.waitForTimeout(2000);
    expect(calls.count()).toBe(1);
    await visible(page.getByRole('button', { name: 'Reîmprospătează' })).click();
    await expect.poll(() => calls.count()).toBe(2);
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      const set = (v: string) => Object.defineProperty(document, 'visibilityState', { value: v, configurable: true });
      set('hidden');
      document.dispatchEvent(new Event('visibilitychange', { bubbles: true }));
      set('visible');
      document.dispatchEvent(new Event('visibilitychange', { bubbles: true }));
    });
    await expect.poll(() => calls.count()).toBe(3);
  });
});
