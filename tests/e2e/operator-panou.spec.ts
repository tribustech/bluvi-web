import { mkdirSync } from 'node:fs';
import { expect, test, type Locator, type Page, type Route } from '@playwright/test';
import { expectNoA11yViolations } from './helpers/a11y';
import { collectConsoleErrors } from './helpers/console';
import { CMS, qaJwt, signIn } from './helpers/session';

/*
 * operator.panou (/operator/[lakeId], «Panoul bălții», T5) c1–c32 + operator.b.refresh. fish:
 * app/(app)/operator/[lakeId]/index.tsx, features/operator/dashboard/LakeTrendCard.tsx.
 *
 * Data: the QA user owns Chita on the LOCAL CMS. The loaded state is the REAL GET
 * /feed/lakes/{chita}/operator-stats?window=week (and the real owned-lakes read for the name). Every
 * other state (a busy day, requests, turnover, competition, failures, a slow read, another owner's
 * lake) is a route mock of the browser's proxy call /api/cms/feed/lakes/{id}/operator-stats, on a
 * fixed device clock (Friday 9 Oct 2026, 14:00, Europe/Bucharest) so phases and labels hold. The
 * booking detail opens on a REAL Chita booking (read only). No writes.
 */

const WIDTHS = [375, 1280, 1440, 1920] as const;
const SHOTS = '.shots/operator-panou';
/** Failed requests the specs provoke on purpose (mocked 403 / 500s) are logged by the browser. */
const EXPECTED_CONSOLE = [/Failed to load resource: the server responded with a status of (403|500)/];
const STATS = /\/api\/cms\/feed\/lakes\/[^/]+\/operator-stats(\?|$)/;
/** A Chita booking that exists on the local CMS (operator-detaliu-rezervare.spec.ts): the detail reads it. */
const REAL_BOOKING = 'e2cgl6wld8e7h4rygu7ly9li';

/** Friday 9 Oct 2026, 14:00 on the operator's (device) clock. */
const NOW = new Date('2026-10-09T14:00:00+03:00');
test.use({ timezoneId: 'Europe/Bucharest', locale: 'ro-RO' });

let jwt: string;
let chita: { documentId: string; name: string };
let real: { occupancyNow?: { booked: number; total: number }; pending: number; days?: unknown[] };

test.beforeAll(async ({ request }) => {
  jwt = await qaJwt(request);
  mkdirSync(SHOTS, { recursive: true });
  const res = await request.get(`${CMS}/feed/owned-lakes`, { headers: { Authorization: `Bearer ${jwt}` } });
  expect(res.ok()).toBe(true);
  chita = ((await res.json()).data as { documentId: string; name: string }[])[0]!;
  const s = await request.get(`${CMS}/feed/lakes/${chita.documentId}/operator-stats?window=week`, { headers: { Authorization: `Bearer ${jwt}` } });
  expect(s.ok()).toBe(true);
  real = (await s.json()).data;
});

/* ---------------------------------------------------------------------------------------------
 * Fixtures (Bucharest wall clock, +03:00 in October)
 * ------------------------------------------------------------------------------------------- */

const t = (day: number, hm: string) => `2026-10-${String(day).padStart(2, '0')}T${hm}:00+03:00`;
type Row = Record<string, unknown>;
const row = (over: Row): Row => ({
  standName: '1',
  anglerName: 'Pescar Test',
  anglerAvatar: null,
  startDate: t(9, '06:00'),
  endDate: t(10, '06:00'),
  bookingStatus: 'confirmed',
  priceTotal: 150,
  noShow: false,
  code: null,
  documentId: null,
  balanceDue: 0,
  ...over,
});

const TODAY = [
  // c15 c16 c17: live, cash at the gate, opens the (real) detail.
  row({ standName: '1', anglerName: 'Andrei Ionescu', startDate: t(9, '06:00'), endDate: t(10, '06:00'), priceTotal: 300, balanceDue: 300, documentId: REAL_BOOKING, code: 'A1' }),
  // next, paid.
  row({ standName: '2', anglerName: 'Bogdan Pop', startDate: t(9, '18:00'), endDate: t(10, '06:00'), priceTotal: 150, balanceDue: 0, code: 'B2', documentId: 'b-next' }),
  // c18: a turnover stand — one left at 12:00, the next arrives at 16:00.
  row({ standName: '3', anglerName: 'Cristi Marin', startDate: t(8, '12:00'), endDate: t(9, '12:00'), priceTotal: 200, balanceDue: 0, code: 'C3a', documentId: 'b-left' }),
  row({ standName: '3', anglerName: 'Dan Stoica', startDate: t(9, '16:00'), endDate: t(10, '16:00'), priceTotal: 250, balanceDue: 250, code: 'C3b', documentId: 'b-arrives' }),
  // c16: a finished day stay, free (no money column), no documentId (not interactive).
  row({ standName: '9', anglerName: 'Emil Radu', startDate: t(9, '06:00'), endDate: t(9, '12:00'), priceTotal: 0, code: 'E9' }),
  // c16 c17: a no-show, dimmed, «N-a venit».
  row({ standName: '10', anglerName: 'Florin Vasile', startDate: t(9, '06:00'), endDate: t(9, '18:00'), priceTotal: 120, balanceDue: 120, noShow: true, code: 'F10', documentId: 'b-noshow' }),
  // c13: the sixth stand, beyond «Vezi toate».
  row({ standName: '12', anglerName: 'Gelu Tudor', startDate: t(7, '18:00'), endDate: t(11, '18:00'), priceTotal: 800, balanceDue: 0, code: 'G12', documentId: 'b-stays' }),
  // c12: a pending request is never on the lake.
  row({ standName: '4', anglerName: 'Ion Cerere', bookingStatus: 'pending', code: 'P4', documentId: 'b-pending' }),
];

const WEEK_DAYS = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11'].map((date, i) => ({
  date,
  booked: [2, 3, 1, 5, 4, 8, 6][i],
  total: 21,
  cash: [300, 450, 150, 900, 550, 1300, 700][i],
  bookings: [2, 3, 1, 5, 4, 8, 6][i],
}));
const MONTH_DAYS = Array.from({ length: 31 }, (_, i) => ({ date: `2026-10-${String(i + 1).padStart(2, '0')}`, booked: (i * 7) % 12, total: 21, cash: ((i * 13) % 9) * 100, bookings: (i * 7) % 12 }));
const YEAR_DAYS = Array.from({ length: 12 }, (_, i) => ({ date: `2026-${String(i + 1).padStart(2, '0')}`, booked: 0, total: 21, cash: i * 1000, bookings: i === 9 ? 1 : i * 3 }));
const DAYS = { week: WEEK_DAYS, month: MONTH_DAYS, year: YEAR_DAYS } as const;
const TOTALS = {
  week: { cash: 4350, bookings: 29, occupancyAvgPct: 20 },
  month: { cash: 12500, bookings: 1, occupancyAvgPct: 12 },
  year: { cash: 66000, bookings: 150, occupancyAvgPct: 9 },
} as const;

type Window = keyof typeof DAYS;

function busy(window: Window = 'week', over: Row = {}): Row {
  return {
    // The trailing 7 local days ending TODAY (its last entry is today).
    occupancyByDay: [3, 4, 5, 6, 7, 8, 9].map((d, i) => ({ date: `2026-10-0${d}`, booked: [1, 0, 2, 3, 1, 5, 4][i], total: 21 })),
    occupancyNow: { booked: 4, total: 21 },
    pending: 3,
    today: TODAY,
    cancelledLast24h: 2,
    deIncasatAzi: 550,
    deIncasat7z: 1250,
    oldestPending: { anglerName: 'Mihai Popescu', standName: '7', waitingMinutes: 125 },
    pendingFeedback: 1,
    todayCompetition: { documentId: 'comp-toamna', name: 'Cupa Toamnei', startDate: t(9, '07:00'), endDate: t(11, '15:00') },
    days: DAYS[window],
    windowTotals: TOTALS[window],
    ...over,
  };
}

type Reply = { status?: number; body?: unknown; delayMs?: number };

/** Mocks the browser's operator-stats read; `reply(window, call)`. Returns the requested windows, in order. */
async function mockStats(page: Page, reply: (window: Window, call: number) => Reply) {
  const calls: Window[] = [];
  await page.route(STATS, async (r: Route) => {
    const w = (new URL(r.request().url()).searchParams.get('window') ?? 'week') as Window;
    calls.push(w);
    const { status = 200, body, delayMs } = reply(w, calls.length);
    if (delayMs) await new Promise((res) => setTimeout(res, delayMs));
    await r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body ?? { data: busy(w) }) });
  });
  return calls;
}
const ok = (body: Row): Reply => ({ body: { data: body } });
const fail = (status: number): Reply => ({ status, body: { data: null, error: { status, name: 'Error', message: 'x' } } });

const panel = () => `/operator/${chita.documentId}`;
const visible = (l: Locator) => l.filter({ visible: true });
const heading = (page: Page) => page.getByRole('heading', { level: 1 });
const quickNav = (page: Page) => visible(page.getByRole('navigation', { name: 'Scurtături bălții' }));
const todayCard = (page: Page) => visible(page.locator('section').filter({ has: page.getByRole('heading', { name: 'Azi la baltă' }) }));
const trendCard = (page: Page) => visible(page.locator('section').filter({ has: page.getByRole('heading', { name: 'Cum merge balta' }) }));
const tiles = (page: Page) => visible(page.getByRole('group', { name: 'Azi, pe scurt' }));
const rows = (page: Page) => todayCard(page).getByTestId('today-row');
const rowOf = (page: Page, name: string) => rows(page).filter({ hasText: name });

async function openPanel(page: Page, path = panel()) {
  await page.clock.setFixedTime(NOW);
  await page.goto(path);
  await expect(todayCard(page)).toBeVisible({ timeout: 30_000 });
}

async function shoot(page: Page, name: string, widths: readonly number[] = WIDTHS) {
  for (const w of widths) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${SHOTS}/${name}-${w}.png`, fullPage: true });
  }
}

/* ---------------------------------------------------------------------------------------------
 * Signed out
 * ------------------------------------------------------------------------------------------- */

test.describe('signed out', () => {
  test('operator.b.role-gating: the panel sends a signed-out visitor to /intra and back', async ({ page }) => {
    await page.goto('/operator/s84u55lo4n9z0emngozttt6e');
    await expect(page).toHaveURL(/\/intra\?next=%2Foperator%2Fs84u55lo4n9z0emngozttt6e$/);
  });
});

/* ---------------------------------------------------------------------------------------------
 * Signed in
 * ------------------------------------------------------------------------------------------- */

test.describe('signed in', () => {
  test.beforeEach(async ({ context }) => {
    await signIn(context, jwt);
  });

  test('c1 c2 c22 c25 real: the REAL operator-stats of Chita (window=week) under its name and today', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    const req = page.waitForRequest((r) => STATS.test(r.url()));
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(panel());
    // c2: one parameter, the window, «week» first.
    const url = new URL((await req).url());
    expect(url.pathname).toBe(`/api/cms/feed/lakes/${chita.documentId}/operator-stats`);
    expect([...url.searchParams.keys()]).toEqual(['window']);
    expect(url.searchParams.get('window')).toBe('week');
    // c1: the owned lake's name, «Azi, {weekday d MMM}» on the device clock.
    await expect(heading(page)).toHaveText(chita.name);
    const now = new Date();
    const wd = ['duminică', 'luni', 'marți', 'miercuri', 'joi', 'vineri', 'sâmbătă'][now.getDay()];
    const mo = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'noi', 'dec'][now.getMonth()];
    await expect(page.getByText(`Azi, ${wd} ${now.getDate()} ${mo}`, { exact: true })).toBeVisible();
    await expect(todayCard(page)).toBeVisible();
    // c22: the real figure, «acum» when the CMS sends occupancyNow.
    const occ = real.occupancyNow!;
    await expect(tiles(page).getByTestId('occupancy-tile-label')).toHaveText('Standuri ocupate acum');
    await expect(tiles(page).getByTestId('occupancy-tile-value')).toHaveText(`${occ.booked}/${occ.total}`);
    // c25: the card shows when the window has points.
    await expect(trendCard(page)).toHaveCount(real.days && real.days.length > 0 ? 1 : 0);
    await expectNoA11yViolations(page);
    await shoot(page, 'real');
    expect(errors).toEqual([]);
  });

  test('c3: first load — header + spinner, no quick actions until data', async ({ page }) => {
    await mockStats(page, () => ({ ...ok(busy()), delayMs: 2500 }));
    await page.clock.setFixedTime(NOW);
    await page.setViewportSize({ width: 375, height: 900 });
    await page.goto(panel());
    await expect(page.getByTestId('operator-panel-loading').filter({ visible: true })).toBeVisible();
    await expect(heading(page)).toHaveText(chita.name);
    await expect(page.getByRole('navigation', { name: 'Scurtături bălții' })).toHaveCount(0);
    await page.screenshot({ path: `${SHOTS}/loading-375.png`, fullPage: true });
    await expect(todayCard(page)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('operator-panel-loading')).toHaveCount(0);
    await expect(quickNav(page)).toBeVisible();
  });

  test('c4: error with no data → the header stays and the shared error state retries', async ({ page }) => {
    const errors = collectConsoleErrors(page, { ignore: EXPECTED_CONSOLE });
    let failing = true;
    const calls = await mockStats(page, (w) => (failing ? fail(500) : ok(busy(w))));
    await page.clock.setFixedTime(NOW);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(panel());
    const retry = page.getByRole('button', { name: 'Încearcă din nou' });
    await expect(retry).toBeVisible({ timeout: 30_000 });
    await expect(heading(page)).toHaveText(chita.name);
    await expect(page.getByRole('navigation', { name: 'Scurtături bălții' })).toHaveCount(0);
    await expectNoA11yViolations(page);
    await shoot(page, 'error');
    failing = false;
    const before = calls.length;
    await retry.click();
    await expect(todayCard(page)).toBeVisible();
    expect(calls.length).toBeGreaterThan(before);
    expect(errors).toEqual([]);
  });

  test('c4 non-owner: a lake the viewer does not own (the CMS refuses, 403) → «Nu ai acces», title «Balta»', async ({ page }) => {
    const errors = collectConsoleErrors(page, { ignore: EXPECTED_CONSOLE });
    await mockStats(page, () => fail(403));
    await page.clock.setFixedTime(NOW);
    await page.setViewportSize({ width: 375, height: 900 });
    await page.goto('/operator/lake-altcuiva');
    await expect(page.getByText('Nu ai acces', { exact: false }).first()).toBeVisible({ timeout: 30_000 });
    await expect(heading(page)).toHaveText('Balta');
    await expect(page.getByRole('navigation', { name: 'Scurtături bălții' })).toHaveCount(0);
    await expectNoA11yViolations(page);
    await shoot(page, 'refused', [375, 1280]);
    expect(errors).toEqual([]);
  });

  test('c5 b.refresh: the refresh control and a window focus refetch the current window; no polling', async ({ page }) => {
    const calls = await mockStats(page, (w) => ok(busy(w)));
    await page.setViewportSize({ width: 1280, height: 900 });
    await openPanel(page);
    await expect.poll(() => calls.length).toBe(1);
    // No polling: nothing more on its own.
    await page.waitForTimeout(3000);
    expect(calls).toEqual(['week']);
    await visible(page.getByRole('button', { name: 'Reîmprospătează' })).click();
    await expect.poll(() => calls.length).toBe(2);
    expect(calls[1]).toBe('week');
    // The chart's window, when it is another one.
    await trendCard(page).getByRole('tab', { name: 'Luna' }).click();
    await expect.poll(() => calls.at(-1)).toBe('month');
    const n = calls.length;
    await visible(page.getByRole('button', { name: 'Reîmprospătează' })).click();
    await expect.poll(() => calls.length).toBe(n + 1);
    expect(calls.at(-1)).toBe('month');
    // Let that refetch settle (a focus during a fetch is folded into it).
    await expect(visible(page.getByRole('button', { name: 'Reîmprospătează' }))).not.toHaveAttribute('aria-disabled', 'true');
    await page.waitForTimeout(500);
    // Window focus (the tab comes back to the foreground).
    await page.evaluate(() => {
      const set = (v: string) => Object.defineProperty(document, 'visibilityState', { value: v, configurable: true });
      set('hidden');
      document.dispatchEvent(new Event('visibilitychange', { bubbles: true }));
      set('visible');
      document.dispatchEvent(new Event('visibilitychange', { bubbles: true }));
    });
    await expect.poll(() => calls.length).toBe(n + 2);
    expect(calls.at(-1)).toBe('month');
  });

  test('c4: a failed refetch keeps the figures on screen and says so', async ({ page }) => {
    const errors = collectConsoleErrors(page, { ignore: EXPECTED_CONSOLE });
    let failing = false;
    await mockStats(page, (w) => (failing ? fail(500) : ok(busy(w))));
    await page.setViewportSize({ width: 375, height: 900 });
    await openPanel(page);
    failing = true;
    await visible(page.getByRole('button', { name: 'Reîmprospătează' })).click();
    await expect(page.getByText('Nu s-a putut actualiza. Cifrele de pe ecran sunt cele de dinainte.')).toBeVisible({ timeout: 30_000 });
    await expect(rowOf(page, 'Andrei Ionescu')).toBeVisible();
    await expect(tiles(page).getByTestId('occupancy-tile-value')).toHaveText('4/21');
    expect(errors).toEqual([]);
  });

  test('c6 c8 c9: quick actions in order with the pending badge, the alert with the oldest request', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await mockStats(page, (w) => ok(busy(w)));
    await page.setViewportSize({ width: 375, height: 900 });
    await openPanel(page);
    const links = quickNav(page).getByRole('link');
    await expect(links).toHaveText([/Calendar/, /Rezervări/, /Blocaje/]);
    await expect(links.nth(0)).toHaveAttribute('href', `/operator/${chita.documentId}/calendar`);
    await expect(links.nth(1)).toHaveAttribute('href', `/operator/${chita.documentId}/rezervari?status=pending`);
    await expect(links.nth(1)).toContainText('3 cereri în așteptare');
    // c6: fish's solid red pill with white digits (OperatorQuickAction $red6), ≥ 18px, a surface ring.
    const badge = links.nth(1).locator('[data-tone]');
    await expect(badge).toHaveText('3');
    await expect(badge).toHaveAttribute('data-tone', 'alert');
    await expect(badge).toHaveCSS('background-color', 'rgb(225, 29, 72)');
    await expect(badge).toHaveCSS('color', 'rgb(255, 255, 255)');
    expect((await badge.boundingBox())!.height).toBeGreaterThanOrEqual(18);
    await expect(links.nth(2)).toHaveAttribute('href', `/operator/${chita.documentId}/blocaje`);
    // c8 / c9
    await expect(page.getByText('3 cereri așteaptă răspuns', { exact: true }).filter({ visible: true })).toBeVisible();
    await expect(page.getByText('Mihai Popescu · standul 7 · de 2 ore', { exact: true }).filter({ visible: true })).toBeVisible();
    const answer = visible(page.getByRole('link', { name: 'Răspunde la cererile în așteptare' }));
    await expect(answer).toHaveAttribute('href', `/operator/${chita.documentId}/rezervari?status=pending`);
    await expectNoA11yViolations(page);
    await shoot(page, 'busy');
    expect(errors).toEqual([]);
  });

  test('c6 c8 c9: one request (singular), no oldestPending; none → no badge, no alert, plain link; 120 → «99+»', async ({ page }) => {
    let body = busy('week', { pending: 1, oldestPending: null });
    await mockStats(page, () => ok(body));
    await page.setViewportSize({ width: 375, height: 900 });
    await openPanel(page);
    await expect(visible(page.getByText('1 cerere așteaptă răspuns', { exact: true }))).toBeVisible();
    await expect(visible(page.getByText('Nu sunt confirmate până le răspunzi', { exact: true }))).toBeVisible();
    await expect(quickNav(page).getByRole('link', { name: /Rezervări/ })).toContainText('1 cerere în așteptare');
    await shoot(page, 'one-pending', [375, 1280]);

    body = busy('week', { pending: 120 });
    await page.reload();
    await expect(todayCard(page)).toBeVisible({ timeout: 30_000 });
    await expect(visible(page.getByText('120 de cereri așteaptă răspuns', { exact: true }))).toBeVisible();
    await expect(quickNav(page).getByText('99+', { exact: true })).toBeVisible();

    body = busy('week', { pending: 0, oldestPending: null });
    await page.reload();
    await expect(todayCard(page)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/așteaptă răspuns/)).toHaveCount(0);
    const res = quickNav(page).getByRole('link', { name: /Rezervări/ });
    await expect(res).toHaveAttribute('href', `/operator/${chita.documentId}/rezervari`);
    await expect(res).not.toContainText('în așteptare');
    await shoot(page, 'no-pending', [375, 1280]);
  });

  test('c7: the quick actions stay reachable — pinned to the top edge while scrolling, never floating', async ({ page }) => {
    await mockStats(page, (w) => ok(busy(w)));
    await page.setViewportSize({ width: 375, height: 700 });
    await openPanel(page);
    const nav = quickNav(page);
    const { y: restY, height: restH } = (await nav.boundingBox())!;
    await page.mouse.wheel(0, 900);
    await expect(nav).toHaveAttribute('data-stuck', 'true');
    // Attached: right under the top bar (or at the top edge while the phone bar is hidden) — no gap,
    // once the bar's own slide has settled.
    const gap = async () => {
      const b = (await nav.boundingBox())!;
      const bar = await page.locator('header').first().boundingBox();
      const barBottom = bar && bar.y + bar.height > 0 ? bar.y + bar.height : 0;
      return Math.abs(b.y - barBottom);
    };
    await expect.poll(gap).toBeLessThanOrEqual(1);
    const box = (await nav.boundingBox())!;
    expect(box.y).toBeLessThan(restY);
    // Full-bleed while pinned (edge to edge).
    expect(box.x).toBeLessThanOrEqual(0.5);
    expect(box.width).toBeGreaterThanOrEqual(374);
    // Compact once pinned (fish pinProgress / labelOpacity): icon tiles only, ~56px — not the ~90px
    // card, which would cover a fifth of a 375×667 phone. The labels stay the links' names; the
    // badge stays.
    await expect(nav).toHaveAttribute('data-compact', 'true');
    expect(box.height).toBeLessThanOrEqual(60);
    expect(restH).toBeGreaterThan(box.height + 20);
    await expect(nav.getByText('Calendar', { exact: true })).toHaveCSS('position', 'absolute');
    await expect(nav.getByRole('link', { name: /Rezervări/ }).locator('[data-tone]')).toBeVisible();
    // The page under it does not jump: the height given up is kept as margin.
    expect(await nav.evaluate((el) => (el as HTMLElement).offsetHeight + parseFloat(getComputedStyle(el).marginBottom))).toBeCloseTo(restH, 0);
    await page.screenshot({ path: `${SHOTS}/pinned-375.png` });
    // Still one tap away.
    await nav.getByRole('link', { name: /Blocaje/ }).click();
    await expect(page).toHaveURL(new RegExp(`/operator/${chita.documentId}/blocaje`));
  });

  test('c10 c11 c12 c13 c15 c16 c17 c18: «Azi la baltă» on a busy day', async ({ page }) => {
    await mockStats(page, (w) => ok(busy(w)));
    await page.setViewportSize({ width: 375, height: 900 });
    await openPanel(page);
    const card = todayCard(page);
    // c10: 2 arrive (Bogdan 18:00, Dan 16:00) + Emil/Florin started today too → arrivals; Andrei arrived today; Cristi leaves; Gelu stays.
    await expect(card.getByText('5 vin · 1 stă · 1 pleacă', { exact: true })).toBeVisible();
    // c11
    const comp = card.getByRole('link', { name: /Cupa Toamnei/ });
    await expect(comp).toHaveAttribute('href', '/concursuri/comp-toamna');
    await expect(comp).toContainText('Concurs · Vineri, 9 oct 07:00 – Duminică, 11 oct 15:00');
    // c12 c13: stands in natural order (9 before 10), pending excluded, five stands, then «Vezi toate».
    await expect(rows(page)).toHaveText([/Andrei Ionescu/, /Bogdan Pop/, /Cristi Marin/, /Dan Stoica/, /Emil Radu/, /Florin Vasile/]);
    await expect(card.getByText('Ion Cerere')).toHaveCount(0);
    await expect(card.getByText('Gelu Tudor')).toHaveCount(0);
    const all = card.getByRole('link', { name: 'Vezi toate (6 standuri)' });
    await expect(all).toHaveAttribute('href', `/operator/${chita.documentId}/rezervari`);
    // c15 c16 c17: the live row.
    const live = rowOf(page, 'Andrei Ionescu');
    await expect(live).toHaveAttribute('data-phase', 'live');
    await expect(live).toContainText('Standul 1');
    await expect(live).toContainText('Vi 06:00 → Sâ 06:00');
    await expect(live.getByRole('progressbar', { name: 'Sejur' })).toHaveAttribute('aria-valuetext', '8h din 24h');
    await expect(live.getByTestId('money')).toHaveText(/300 lei\s*Numerar/);
    await expect(rowOf(page, 'Bogdan Pop').getByTestId('money')).toHaveText(/150 lei\s*Plătit/);
    // c17 fish chip colours: «Numerar» green (chipAppearance payment), «Plătit» indigo (stand), «N-a venit» danger.
    await expect(live.getByText('Numerar', { exact: true })).toHaveCSS('color', 'rgb(21, 128, 61)');
    await expect(rowOf(page, 'Bogdan Pop').getByText('Plătit', { exact: true })).toHaveCSS('background-color', 'rgb(240, 243, 253)');
    await expect(rowOf(page, 'Bogdan Pop').getByText('Plătit', { exact: true })).toHaveCSS('color', 'rgb(67, 56, 202)');
    const noShow = rowOf(page, 'Florin Vasile');
    await expect(noShow).toHaveAttribute('data-dimmed', 'true');
    await expect(noShow.getByTestId('money')).toHaveText(/120 lei\s*N-a venit/);
    const done = rowOf(page, 'Emil Radu');
    await expect(done).toHaveAttribute('data-dimmed', 'true');
    await expect(done.getByTestId('money')).toHaveCount(0);
    await expect(live).not.toHaveAttribute('data-dimmed', 'true');
    // c18: one turnover block, time order, in / out marks, moment labels.
    const turnover = visible(card.getByTestId('today-turnover'));
    await expect(turnover).toHaveCount(1);
    await expect(turnover.getByTestId('today-row')).toHaveText([/Cristi Marin/, /Dan Stoica/]);
    await expect(turnover.getByTestId('today-row').nth(0)).toContainText(/Standul 3\s*a plecat 12:00/);
    await expect(turnover.getByTestId('today-row').nth(1)).toContainText(/Standul 3\s*vine 16:00 · 24h/);
    await expect(turnover.locator('[data-move]')).toHaveCount(2);
    await expect(turnover.locator('[data-move]').nth(0)).toHaveAttribute('data-move', 'out');
    await expect(turnover.locator('[data-move]').nth(1)).toHaveAttribute('data-move', 'in');
    await all.click();
    await expect(page).toHaveURL(new RegExp(`/operator/${chita.documentId}/rezervari$`));
  });

  test('c18 moment labels: «a venit … pleacă», «a venit … a plecat», «a venit → Wd», «pleacă»', async ({ page }) => {
    const today = [
      row({ standName: '5', anglerName: 'A Unu', startDate: t(9, '06:00'), endDate: t(9, '18:00'), code: 'a1' }),
      row({ standName: '5', anglerName: 'B Doi', startDate: t(9, '18:30'), endDate: t(10, '06:00'), code: 'a2' }),
      row({ standName: '6', anglerName: 'C Trei', startDate: t(9, '06:00'), endDate: t(9, '12:00'), code: 'a3' }),
      row({ standName: '6', anglerName: 'D Patru', startDate: t(9, '12:30'), endDate: t(10, '12:00'), code: 'a4' }),
      row({ standName: '7', anglerName: 'E Cinci', startDate: t(8, '18:00'), endDate: t(9, '17:00'), code: 'a5' }),
      row({ standName: '7', anglerName: 'F Șase', startDate: t(9, '17:30'), endDate: t(10, '17:00'), code: 'a6' }),
    ];
    await mockStats(page, (w) => ok(busy(w, { today, todayCompetition: null })));
    await page.setViewportSize({ width: 375, height: 900 });
    await openPanel(page);
    await expect(rowOf(page, 'A Unu')).toContainText('a venit 06:00 · pleacă 18:00');
    await expect(rowOf(page, 'B Doi')).toContainText('vine 18:30 · 12h');
    await expect(rowOf(page, 'C Trei')).toContainText('a venit 06:00 · a plecat 12:00');
    await expect(rowOf(page, 'D Patru')).toContainText('a venit 12:30 → Sâ 12:00');
    await expect(rowOf(page, 'E Cinci')).toContainText('pleacă 17:00');
    await expect(rowOf(page, 'A Unu').getByRole('progressbar')).toHaveAttribute('aria-valuetext', '8h din 12h');
    await shoot(page, 'turnover', [375, 1440]);
  });

  test('c14: empty days — «Nicio rezervare azi.» and, with a competition, «Nicio rezervare în afara concursului.»; c24 «Nicio sosire azi»', async ({ page }) => {
    let body = busy('week', { today: [], todayCompetition: null, pending: 0, cancelledLast24h: 0, pendingFeedback: 0, deIncasatAzi: 0, deIncasat7z: 0 });
    await mockStats(page, () => ok(body));
    await page.setViewportSize({ width: 375, height: 900 });
    await openPanel(page);
    await expect(todayCard(page).getByText('Nicio rezervare azi.', { exact: true })).toBeVisible();
    // c10: no band when the day is empty.
    await expect(todayCard(page).locator('p.t-caption')).toHaveCount(0);
    // c20 c21: both counts 0 → no card.
    await expect(page.getByText(/anulat|de evaluat/)).toHaveCount(0);
    await expect(tiles(page).getByTestId('cash-tile-caption')).toHaveText('Nicio sosire azi');
    await shoot(page, 'empty', [375, 1280, 1920]);
    body = { ...body, todayCompetition: { documentId: 'comp-toamna', name: 'Cupa Toamnei', startDate: t(9, '07:00'), endDate: t(9, '15:00') } };
    await page.reload();
    await expect(todayCard(page).getByText('Nicio rezervare în afara concursului.', { exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(todayCard(page).getByRole('link', { name: /Cupa Toamnei/ })).toContainText('Concurs · Vineri, 9 oct · 07:00–15:00');
  });

  test('c19: a row with a documentId opens the booking detail (?rezervare=); one without is not interactive', async ({ page }) => {
    const errors = collectConsoleErrors(page, { ignore: EXPECTED_CONSOLE });
    await mockStats(page, (w) => ok(busy(w)));
    await page.setViewportSize({ width: 1280, height: 900 });
    await openPanel(page);
    await expect(rowOf(page, 'Emil Radu').getByRole('button')).toHaveCount(0);
    await rowOf(page, 'Andrei Ionescu').getByRole('button', { name: 'Andrei Ionescu, standul 1' }).click();
    await expect(page).toHaveURL(new RegExp(`\\?rezervare=${REAL_BOOKING}$`));
    const dialog = page.locator('dialog[open]').filter({ has: page.getByRole('heading', { name: 'Detalii rezervare' }) });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByTestId('booking-detail')).toBeVisible({ timeout: 30_000 });
    await expect(dialog).toHaveCSS('opacity', '1');
    // The page behind the modal is inert (under the backdrop): the dialog is what can be used.
    await expectNoA11yViolations(page, { include: 'dialog[open]' });
    await shoot(page, 'detail', [375, 1280]);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`/operator/${chita.documentId}$`));
    // Keyboard: the row's name is a button in the tab order.
    await rowOf(page, 'Bogdan Pop').getByRole('button').focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\?rezervare=b-next$/);
    expect(errors.filter((e) => !/404/.test(e))).toEqual([]);
  });

  test('c20 c21: drop-outs and reviews (each alone, both, plural)', async ({ page }) => {
    let body = busy('week', { cancelledLast24h: 1, pendingFeedback: 0 });
    await mockStats(page, () => ok(body));
    await page.setViewportSize({ width: 375, height: 900 });
    await openPanel(page);
    const card = visible(page.getByRole('list', { name: 'De urmărit' }));
    await expect(card.getByText('1 rezervare anulată de un pescar', { exact: true })).toBeVisible();
    await expect(card.getByText('în ultimele 24 de ore · standurile sunt din nou libere', { exact: true })).toBeVisible();
    await expect(card.getByRole('link', { name: 'Vezi rezervările anulate' })).toHaveAttribute('href', `/operator/${chita.documentId}/rezervari?status=cancelled`);
    await expect(card.getByText(/de evaluat/)).toHaveCount(0);
    body = busy('week', { cancelledLast24h: 0, pendingFeedback: 1 });
    await page.reload();
    await expect(visible(page.getByText('1 partidă de evaluat', { exact: true }))).toBeVisible({ timeout: 30_000 });
    await expect(visible(page.getByRole('link', { name: 'Vezi partidele de evaluat' }))).toHaveAttribute('href', `/operator/${chita.documentId}/rezervari?status=toreview`);
    await expect(page.getByText(/anulat/)).toHaveCount(0);
    body = busy('week', { cancelledLast24h: 3, pendingFeedback: 4 });
    await page.reload();
    await expect(visible(page.getByText('3 rezervări anulate de pescari', { exact: true }))).toBeVisible({ timeout: 30_000 });
    await expect(visible(page.getByText('4 partide de evaluat', { exact: true }))).toBeVisible();
    await expect(visible(page.getByText('încheiate fără notă', { exact: true }))).toBeVisible();
  });

  test('c22 c23 c24: the tiles — acum vs azi, server cash vs client sum, the sub-line variants', async ({ page }) => {
    let body = busy();
    await mockStats(page, () => ok(body));
    await page.setViewportSize({ width: 375, height: 900 });
    await openPanel(page);
    const g = tiles(page);
    await expect(g.getByTestId('occupancy-tile-label')).toHaveText('Standuri ocupate acum');
    await expect(g.getByTestId('occupancy-tile-value')).toHaveText('4/21');
    await expect(g.getByTestId('cash-tile-label')).toHaveText('De încasat azi, la sosire');
    // Rule 10: the unit is its own element, after a space.
    await expect(g.getByTestId('cash-tile-value').locator('[data-number]')).toHaveText('550');
    await expect(g.getByTestId('cash-tile-value').locator('[data-unit]')).toHaveText(' lei');
    await expect(g.getByTestId('cash-tile-caption')).toHaveText('Următoarele 7 zile: 1.250 lei (azi inclus)');
    // Older CMS: no occupancyNow → today's day count «azi»; no deIncasatAzi → today's confirmed arrivals.
    body = busy('week', { occupancyNow: undefined, deIncasatAzi: undefined, deIncasat7z: undefined });
    await page.reload();
    await expect(g.getByTestId('occupancy-tile-label')).toHaveText('Standuri ocupate azi', { timeout: 30_000 });
    await expect(g.getByTestId('occupancy-tile-value')).toHaveText('4/21');
    // Arrivals today, confirmed, not no-show: Andrei 300 + Bogdan 150 + Dan 250 + Emil 0 = 700 (Florin no-show, Cristi arrived yesterday).
    await expect(g.getByTestId('cash-tile-value').locator('[data-number]')).toHaveText('700');
    await expect(g.getByTestId('cash-tile-caption')).toHaveText('');
    body = busy('week', { deIncasatAzi: 0, deIncasat7z: 0 });
    await page.reload();
    await expect(g.getByTestId('cash-tile-caption')).toHaveText('Totul e achitat', { timeout: 30_000 });
    body = busy('week', { occupancyNow: undefined, occupancyByDay: [] });
    await page.reload();
    await expect(g.getByTestId('occupancy-tile-value')).toHaveText('0/0', { timeout: 30_000 });
  });

  test('c25 c26 c28 c30: window tabs refetch only the chart (dimmed meanwhile); labels and summary per window', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    const calls = await mockStats(page, (w) => ({ ...ok(busy(w)), delayMs: w === 'week' ? 0 : 1500 }));
    await page.setViewportSize({ width: 375, height: 900 });
    await openPanel(page);
    const card = trendCard(page);
    await expect(card.getByRole('tab')).toHaveText(['Săptămâna', 'Luna', 'Anul', 'Ocupare', 'Încasări']);
    await expect(card.getByRole('tab', { name: 'Săptămâna' })).toHaveAttribute('aria-selected', 'true');
    await expect(card.getByRole('tab', { name: 'Ocupare' })).toHaveAttribute('aria-selected', 'true');
    // c28 week: day initials from the keys (Mon 5 … Sun 11).
    await expect(card.getByTestId('trend-x')).toHaveText(['L', 'M', 'M', 'J', 'V', 'S', 'D']);
    await expect(card.getByTestId('trend-summary')).toHaveText('Săptămâna asta · 20% ocupare medie · 4.350 lei · 29 de rezervări');
    // c26: Luna — the request carries the new window only; the chart dims; nothing above it moves.
    await card.getByRole('tab', { name: 'Luna' }).click();
    await expect(card.getByRole('tab', { name: 'Luna' })).toHaveAttribute('aria-selected', 'true');
    await expect(card.getByTestId('trend-chart')).toHaveAttribute('data-busy', 'true');
    await expect(card.getByTestId('trend-chart')).toHaveCSS('opacity', '0.5');
    await expect(rowOf(page, 'Andrei Ionescu')).toBeVisible();
    await expect(tiles(page).getByTestId('occupancy-tile-value')).toHaveText('4/21');
    await expect(card.getByTestId('trend-x')).toHaveText(['L', 'M', 'M', 'J', 'V', 'S', 'D']);
    await page.screenshot({ path: `${SHOTS}/trend-switching-375.png`, fullPage: true });
    await expect(card.getByTestId('trend-chart')).not.toHaveAttribute('data-busy', 'true');
    expect(calls).toEqual(['week', 'month']);
    // c28 month: every 5th day plus the last.
    await expect(card.getByTestId('trend-x')).toHaveText(['1', '6', '11', '16', '21', '26', '31']);
    await expect(card.getByTestId('trend-summary')).toHaveText('Luna asta · 12% ocupare medie · 12.500 lei · 1 rezervare');
    // c27: 31 points → no dots (only the scrubbed one).
    await expect(card.getByTestId('trend-dot')).toHaveCount(0);
    // c28 year: month short names.
    await card.getByRole('tab', { name: 'Anul' }).click();
    await expect(card.getByTestId('trend-x')).toHaveText(['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'noi', 'dec'], { timeout: 30_000 });
    await expect(card.getByTestId('trend-summary')).toHaveText('Anul acesta · 9% ocupare medie · 66.000 lei · 150 de rezervări');
    await expect(card.getByTestId('trend-dot')).toHaveCount(12);
    // Keyboard: the tabs are a tablist (← → move and select).
    await card.getByRole('tab', { name: 'Anul' }).focus();
    await page.keyboard.press('ArrowLeft');
    await expect(card.getByRole('tab', { name: 'Luna' })).toHaveAttribute('aria-selected', 'true');
    await expect(card.getByRole('tab', { name: 'Luna' })).toBeFocused();
    await expect(card.getByTestId('trend-chart')).not.toHaveAttribute('data-busy', 'true', { timeout: 30_000 });
    await expectNoA11yViolations(page);
    expect(errors).toEqual([]);
  });

  test('c25: no points in the window → no trend card', async ({ page }) => {
    await mockStats(page, () => ok(busy('week', { days: [] })));
    await page.setViewportSize({ width: 1280, height: 900 });
    await openPanel(page);
    await expect(page.getByRole('heading', { name: 'Cum merge balta' })).toHaveCount(0);
    await shoot(page, 'no-trend', [375, 1280]);
  });

  test('c27: occupancy scaled to the stands, cash to its busiest day; whole labels; dots up to 12', async ({ page }) => {
    await mockStats(page, (w) => ok(busy(w)));
    await page.setViewportSize({ width: 1440, height: 900 });
    await openPanel(page);
    const card = trendCard(page);
    // 21 stands → three nice sections up to 24 (fish yAxisScale), never the busiest day (8).
    await expect(card.getByTestId('trend-y')).toHaveText(['0', '8', '16', '24']);
    await expect(card.getByTestId('trend-dot')).toHaveCount(7);
    await card.getByRole('tab', { name: 'Încasări' }).click();
    await expect(card.getByRole('tab', { name: 'Încasări' })).toHaveAttribute('aria-selected', 'true');
    await expect(card.getByTestId('trend-y')).toHaveText(['0', '500', '1.000', '1.500']);
    await shoot(page, 'trend-cash', [1440]);
  });

  test('c29: keyboard and pointer scrub name the day in the header without scrolling the page', async ({ page }) => {
    await mockStats(page, (w) => ok(busy(w)));
    await page.setViewportSize({ width: 375, height: 700 });
    await openPanel(page);
    const card = trendCard(page);
    const slider = card.getByRole('slider');
    await slider.scrollIntoViewIfNeeded();
    const y0 = await page.evaluate(() => window.scrollY);
    await slider.focus();
    // From «today» (Friday 9).
    await page.keyboard.press('ArrowRight');
    await expect(card.getByTestId('trend-scrub')).toHaveText('vineri 9 oct · 4/21 · 550 lei');
    await expect(slider).toHaveAttribute('aria-valuetext', 'vineri 9 oct · 4/21 · 550 lei');
    await page.keyboard.press('ArrowRight');
    await expect(card.getByTestId('trend-scrub')).toHaveText('sâmbătă 10 oct · 8/21 · 1.300 lei');
    await page.keyboard.press('Home');
    await expect(card.getByTestId('trend-scrub')).toHaveText('luni 5 oct · 2/21 · 300 lei');
    await page.keyboard.press('End');
    await expect(card.getByTestId('trend-scrub')).toHaveText('duminică 11 oct · 6/21 · 700 lei');
    expect(await page.evaluate(() => window.scrollY)).toBe(y0);
    await page.screenshot({ path: `${SHOTS}/scrub-375.png` });
    // Pointer: the bucket under the pointer.
    const box = (await slider.boundingBox())!;
    await page.mouse.move(box.x + 1, box.y + box.height / 2);
    await expect(card.getByTestId('trend-scrub')).toHaveText('luni 5 oct · 2/21 · 300 lei');
    expect(await page.evaluate(() => window.scrollY)).toBe(y0);
    await page.mouse.move(0, 0);
    await expect(card.getByTestId('trend-scrub')).toHaveText('Săptămâna asta');
    // Touch: a finger that lands on the chart and then scrolls the page vertically lets go of the day
    // (the browser cancels the pointer for the pan); a tap lets go of it when the finger lifts.
    const touch = async (type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel', dx: number, dy = 0) =>
      slider.evaluate(
        (el, a) => {
          const r = el.getBoundingClientRect();
          el.dispatchEvent(
            new PointerEvent(a.type, { bubbles: true, cancelable: true, pointerType: 'touch', pointerId: 7, isPrimary: true, buttons: a.type === 'pointerup' || a.type === 'pointercancel' ? 0 : 1, clientX: r.left + a.dx, clientY: r.top + r.height / 2 + a.dy }),
          );
        },
        { type, dx, dy },
      );
    await touch('pointerdown', box.width - 1);
    await expect(card.getByTestId('trend-scrub')).toHaveText('duminică 11 oct · 6/21 · 700 lei');
    await touch('pointercancel', box.width - 1, -40);
    await expect(card.getByTestId('trend-scrub')).toHaveText('Săptămâna asta');
    await touch('pointerdown', 1);
    await touch('pointermove', box.width - 1);
    await expect(card.getByTestId('trend-scrub')).toHaveText('duminică 11 oct · 6/21 · 700 lei');
    await touch('pointerup', box.width - 1);
    await expect(card.getByTestId('trend-scrub')).toHaveText('Săptămâna asta');
    // A real touch swipe up from the chart (CDP touch input): the page scrolls, the caption stays at rest.
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
    const sb = (await slider.boundingBox())!;
    const tx = sb.x + sb.width / 2;
    const ty = sb.y + sb.height / 2;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: tx, y: ty }] });
    for (let i = 1; i <= 8; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: tx, y: ty - i * 25 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(card.getByTestId('trend-scrub')).toHaveText('Săptămâna asta');
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: false });
    await cdp.detach();
    // Year buckets name the bookings.
    await card.getByRole('tab', { name: 'Anul' }).click();
    await expect(card.getByTestId('trend-x')).toHaveCount(12, { timeout: 30_000 });
    await slider.focus();
    await page.keyboard.press('End');
    await expect(card.getByTestId('trend-scrub')).toHaveText('Decembrie · 33 de rezervări · 11.000 lei');
  });

  test('c31: phone order — quick actions, alert, Azi la baltă, drop-outs, tiles, trend', async ({ page }) => {
    await mockStats(page, (w) => ok(busy(w)));
    for (const width of [375, 1024]) {
      await page.setViewportSize({ width, height: 900 });
      await openPanel(page);
      const ys = await Promise.all(
        [
          quickNav(page),
          visible(page.getByText('3 cereri așteaptă răspuns', { exact: true })),
          visible(page.getByRole('heading', { name: 'Azi la baltă' })),
          visible(page.getByRole('list', { name: 'De urmărit' })),
          tiles(page),
          visible(page.getByRole('heading', { name: 'Cum merge balta' })),
        ].map(async (l) => (await l.boundingBox())!.y),
      );
      expect(ys).toEqual([...ys].sort((a, b) => a - b));
    }
  });

  test('≥1280 three columns: left shortcuts + alert, centre today + drop-outs + trend, right the tiles', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await mockStats(page, (w) => ok(busy(w)));
    for (const width of [1280, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      await openPanel(page);
      const left = visible(page.getByRole('complementary', { name: 'Scurtături și cereri' }));
      const right = visible(page.getByRole('complementary', { name: 'Cifrele bălții' }));
      await expect(left.getByRole('navigation', { name: 'Scurtături bălții' })).toBeVisible();
      await expect(left.getByText('3 cereri așteaptă răspuns')).toBeVisible();
      await expect(right.getByRole('group', { name: 'Azi, pe scurt' })).toBeVisible();
      // The trend is the centre's (the card that gains from width), not squeezed in the rail.
      await expect(right.getByRole('heading', { name: 'Cum merge balta' })).toHaveCount(0);
      const l = (await left.boundingBox())!;
      const c = (await todayCard(page).boundingBox())!;
      const r = (await right.boundingBox())!;
      const tr = (await trendCard(page).boundingBox())!;
      expect(l.x + l.width).toBeLessThan(c.x);
      expect(c.x + c.width).toBeLessThan(r.x);
      expect(tr.x + tr.width).toBeLessThan(r.x);
      expect(tr.width).toBeGreaterThan(r.width);
      // The tiles' labels read on one line in the rail (stacked, full rail width).
      for (const id of ['occupancy-tile-label', 'cash-tile-label']) {
        const lbl = visible(right.getByTestId(id));
        const lh = parseFloat(await lbl.evaluate((el) => getComputedStyle(el).lineHeight));
        expect((await lbl.boundingBox())!.height).toBeLessThan(lh * 1.5);
      }
      // A row reads as one unit: the sum sits near the name, never ~600px away.
      const andrei = rowOf(page, 'Andrei Ionescu');
      const nameBox = (await andrei.getByText('Andrei Ionescu', { exact: true }).boundingBox())!;
      const moneyBox = (await andrei.getByTestId('money').boundingBox())!;
      expect(moneyBox.x - nameBox.x).toBeLessThan(520);
      // From a ~900px centre (1920): today beside drop-outs + trend.
      if (width === 1920) expect(tr.x).toBeGreaterThan(c.x + c.width);
      await expectNoA11yViolations(page);
    }
    await shoot(page, 'busy-desktop', [1280, 1440, 1920]);
    expect(errors).toEqual([]);
  });

  test('c32 + b.single-lake: Back returns to the previous page; a cold panel goes to Acasă', async ({ page }) => {
    await mockStats(page, (w) => ok(busy(w)));
    await page.setViewportSize({ width: 1280, height: 900 });
    await openPanel(page);
    await visible(page.getByRole('button', { name: 'Înapoi' })).click();
    await expect(page).toHaveURL(/\/$/, { timeout: 30_000 });
    await page.goto('/concursuri');
    await page.goto(panel());
    await expect(todayCard(page)).toBeVisible({ timeout: 30_000 });
    await visible(page.getByRole('button', { name: 'Înapoi' })).click();
    await expect(page).toHaveURL(/\/concursuri/);
  });
});

test.describe('another time zone', () => {
  test.use({ timezoneId: 'America/Los_Angeles' });
  test.beforeEach(async ({ context }) => {
    await signIn(context, jwt);
  });

  test('c28 b.local-day: bucket keys are labels — no timezone shift west of UTC', async ({ page }) => {
    await mockStats(page, (w) => ok(busy(w)));
    await page.setViewportSize({ width: 375, height: 900 });
    await page.clock.setFixedTime(NOW);
    await page.goto(panel());
    const card = trendCard(page);
    await expect(card.getByTestId('trend-x')).toHaveText(['L', 'M', 'M', 'J', 'V', 'S', 'D'], { timeout: 30_000 });
    await card.getByRole('slider').focus();
    await page.keyboard.press('Home');
    await expect(card.getByTestId('trend-scrub')).toHaveText('luni 5 oct · 2/21 · 300 lei');
  });
});
