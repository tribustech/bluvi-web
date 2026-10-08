import { mkdirSync } from 'node:fs';
import { expect, test, type APIRequestContext, type Page, type Request, type Route } from '@playwright/test';
import { expectNoA11yViolations } from './helpers/a11y';
import { collectConsoleErrors } from './helpers/console';
import { BASE_URL } from './helpers/base-url';
import { CMS, qaJwt, signIn } from './helpers/session';

/*
 * operator.rezervari (c1–c27) + operator.b.status-param, operator.b.focus-param — the operator's
 * bookings inbox /operator/[lakeId]/rezervari (fish app/(app)/operator/[lakeId]/bookings.tsx).
 *
 * REAL reads of the local Chita Lake (the QA user owns it) for every bucket / sub and its next page;
 * REAL accept / reject from the cards on pending requests the QA user makes on Chita (as the B1
 * actions spec), each operator-cancelled in afterEach. States the local data cannot hold on demand
 * (empty lists, a failed first / next page, a stale request, a turnover, rich card content, ?focus)
 * are route fixtures of GET /api/cms/feed/bookings/lake/{id}.
 * operator.b.notification-routes is pinned in tests/unit/notification-href.test.ts (the map) — the
 * landing tabs of its three statuses are the deep-link tests here.
 */

const LAKE = 's84u55lo4n9z0emngozttt6e'; // local Chita Lake
const PATH = `/operator/${LAKE}/rezervari`;
const SHOTS = '.shots/operator-rezervari';
const WIDTHS = [375, 1280, 1440, 1920] as const;
const INBOX = new RegExp(`/api/cms/feed/bookings/lake/${LAKE}`);
// Mocked failures are real 5xx answers; the browser logs each failed resource.
const EXPECTED_CONSOLE = [/Failed to load resource: the server responded with a status of (403|500|503)/];

let jwt: string;
const created: string[] = [];
const auth = () => ({ Authorization: `Bearer ${jwt}` });

test.beforeAll(async ({ request }) => {
  jwt = await qaJwt(request);
  mkdirSync(SHOTS, { recursive: true });
});

test.afterEach(async ({ request }) => {
  while (created.length) {
    const id = created.pop()!;
    const res = await request.get(`${CMS}/feed/bookings/${id}`, {
      headers: auth(),
    });
    const status = res.ok() ? ((await res.json()) as { data: { bookingStatus: string } }).data.bookingStatus : null;
    if (status === 'pending' || status === 'confirmed') {
      const c = await request.patch(`${CMS}/feed/bookings/${id}/operator-cancel`, { headers: auth(), data: { reason: 'Test e2e — curățenie automată.' } });
      expect(c.ok(), `cleanup of ${id}`).toBe(true);
    }
  }
});

/* ------------------------------------------------------------------------------------------------
 * Helpers
 * -------------------------------------------------------------------------------------------- */

const H = 3_600_000;
function at(days: number, hour: number) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  d.setHours(hour);
  return d.toISOString();
}
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

type Avail = {
  stands: { documentId: string; name: string }[];
  bookings: { standDocumentId: string; start: string; end: string }[];
  blocks: { standDocumentId: string | null; start: string; end: string }[];
};

/** A free 06–18 slot on Chita in days 42–70 (clear of the other specs' days). */
async function freeSlot(request: APIRequestContext) {
  const overlaps = (a: { start: string; end: string }, s: number, e: number) => Date.parse(a.start) < e && Date.parse(a.end) > s;
  for (let day = 42; day <= 70; day++) {
    const s = at(day, 6);
    const e = at(day, 18);
    const from = new Date(s);
    from.setDate(from.getDate() - 1);
    const to = new Date(s);
    to.setDate(to.getDate() + 2);
    const res = await request.get(`${CMS}/feed/lakes/${LAKE}/availability`, {
      params: { from: ymd(from), to: ymd(to) },
    });
    const av = ((await res.json()) as { data: Avail }).data;
    const [S, E] = [Date.parse(s), Date.parse(e)];
    for (const st of [...av.stands].reverse()) {
      const busy =
        av.bookings.some((b) => b.standDocumentId === st.documentId && overlaps(b, S - H, E + H)) ||
        av.blocks.some((b) => (b.standDocumentId === null || b.standDocumentId === st.documentId) && overlaps(b, S, E));
      if (!busy) return { stand: st.documentId, standName: st.name, start: s, end: e };
    }
  }
  throw new Error('no free slot on Chita in days 42–70');
}

/** A pending request the QA user makes on their own lake. */
async function pendingRequest(request: APIRequestContext) {
  const s = await freeSlot(request);
  const res = await request.post(`${CMS}/feed/bookings`, {
    headers: auth(),
    data: {
      data: {
        lake: LAKE,
        stand: s.stand,
        startDate: s.start,
        endDate: s.end,
        extras: [],
        contactFullname: 'Sim QA',
        contactPhone: '+40712345678',
      },
    },
  });
  expect(res.ok(), await res.text()).toBe(true);
  const b = (
    (await res.json()) as {
      data: { documentId: string; bookingStatus: string };
    }
  ).data;
  created.push(b.documentId);
  expect(b.bookingStatus).toBe('pending');
  return { ...b, slot: s };
}

async function go(page: Page, query = '') {
  await signIn(page.context(), jwt);
  await page.goto(`${PATH}${query}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Administrare rezervări' })).toBeVisible({ timeout: 45_000 });
}

/** Every inbox GET, parsed (bucket, sub, page). */
function inboxGets(page: Page) {
  const seen: {
    bucket: string | null;
    sub: string | null;
    page: string | null;
  }[] = [];
  page.on('request', (r: Request) => {
    if (r.method() !== 'GET' || !INBOX.test(r.url())) return;
    const u = new URL(r.url());
    seen.push({
      bucket: u.searchParams.get('bucket'),
      sub: u.searchParams.get('sub'),
      page: u.searchParams.get('page'),
    });
  });
  return seen;
}

const tab = (page: Page, name: string) => page.getByRole('tab', { name: new RegExp(`^${name}`) });
const chip = (page: Page, name: string) => page.getByTestId('inbox-subs').getByRole('button', { name, exact: true });
const rowOf = (page: Page, id: string) => page.locator(`[data-testid="inbox-row"][data-booking="${id}"]`);
const settledList = (page: Page) => expect(page.getByTestId('inbox-skeleton')).toHaveCount(0);

/* --- fixtures ------------------------------------------------------------------------------- */

const iso = (ms: number) => new Date(ms).toISOString();
function fake(id: string, over: Record<string, unknown> = {}) {
  const now = Date.now();
  return {
    documentId: id,
    code: `BK-${id.toUpperCase()}`,
    startDate: iso(now + 48 * H),
    endDate: iso(now + 60 * H),
    bookingStatus: 'confirmed',
    priceTotal: 330,
    depositAmount: 0,
    paymentStatus: 'none',
    contactPhone: '+40700000002',
    contactFullname: 'Andrei Ionescu',
    noShow: false,
    createdAt: iso(now - 30 * 60_000),
    lake: {
      documentId: LAKE,
      name: 'Chita Lake',
      contactPhone: null,
      minCancelNoticeHours: 24,
      checkoutBufferMinutes: 0,
      thumbUrl: null,
      locality: 'Giurgiu',
    },
    stand: { documentId: `stand-${id}`, name: 'A10' },
    ...over,
  };
}
const json = (r: Route, body: unknown, status = 200) =>
  r.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
const page1 = (data: unknown[], pendingCount = 0, page = 1, pageSize = 20) => ({
  data,
  meta: { pendingCount, page, pageSize },
});

/** Replaces the inbox read: `answer(bucket, sub, page)` → body | status number | 'hold'. */
async function mockInbox(page: Page, answer: (q: { bucket: string; sub: string | null; page: number }) => unknown | number | Promise<unknown>) {
  await page.route(INBOX, async (r) => {
    const u = new URL(r.request().url());
    const out = await answer({
      bucket: u.searchParams.get('bucket')!,
      sub: u.searchParams.get('sub'),
      page: Number(u.searchParams.get('page')),
    });
    if (typeof out === 'number') return json(r, { data: null, error: { status: out, name: 'Error', message: 'x' } }, out);
    return json(r, out);
  });
}

async function mockReputation(page: Page, byUser: Record<string, { avgStars: number | null; noShowCount: number }>) {
  await page.route('**/feed/users/*/reputation', (r: Route) => {
    const id = decodeURIComponent(new URL(r.request().url()).pathname.split('/').slice(-2)[0]);
    const rep = byUser[id];
    if (!rep) return r.fallback();
    return r.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({
        data: {
          avgStars: rep.avgStars,
          ratingCount: 3,
          noShowCount: rep.noShowCount,
          areas: { rules: null, cleanliness: null, behavior: null },
          reviews: [],
        },
      }),
    });
  });
}

/** Waits out running enter transitions (the docked panel slides in; axe reads mid-fade colours). */
const settled = (page: Page) =>
  expect.poll(() => page.evaluate(() => document.getAnimations().every((a) => a.playState !== 'running' || a.effect?.getComputedTiming().iterations === Infinity))).toBe(true);

async function shots(page: Page, name: string, widths: readonly number[] = WIDTHS) {
  const size = page.viewportSize();
  for (const w of widths) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.waitForTimeout(250);
    await settled(page);
    await page.mouse.move(0, 0);
    await page.screenshot({
      path: `${SHOTS}/${name}-${w}.png`,
      fullPage: true,
    });
  }
  if (size) await page.setViewportSize(size);
}

/* ================================================================================================
 * Gate, header, chrome
 * ============================================================================================== */

test.describe('operator.rezervari (local CMS)', () => {
  test('b.role-gating: signed out → /intra with the whole return path', async ({ page }) => {
    await page.goto(`${PATH}?status=pending&focus=x`);
    await expect(page).toHaveURL(/\/intra\?next=/);
    const next = new URL(page.url()).searchParams.get('next');
    expect(next).toBe(`${PATH}?status=pending&focus=x`);
  });

  test('c1 c2 c27: header, calendar button, icon tabs looking like tabs, keyboard, pinned chrome, axe', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await go(page);
    await settledList(page);
    // c1
    await expect(page.getByText('Chita Lake', { exact: true }).filter({ visible: true }).first()).toBeVisible();
    const cal = page.getByRole('link', { name: 'Calendarul bălții' });
    await expect(cal).toHaveAttribute('href', `/operator/${LAKE}/calendar`);
    await expect(page.getByRole('button', { name: 'Înapoi' })).toBeVisible();
    // c2 — order, icons
    const tabs = page.getByRole('tablist', { name: 'Rezervări' }).getByRole('tab');
    await expect(tabs).toHaveText([/De aprobat/, /Confirmate/, /Nefinalizate/, /Toate/]);
    for (let i = 0; i < 4; i++) await expect(tabs.nth(i).locator('svg')).toHaveCount(1);
    await expect(tab(page, 'Confirmate')).toHaveAttribute('aria-selected', 'true');
    // keyboard: roving focus, arrows switch tabs
    await tab(page, 'Confirmate').focus();
    await page.keyboard.press('ArrowRight');
    await expect(tab(page, 'Nefinalizate')).toHaveAttribute('aria-selected', 'true');
    await expect(tab(page, 'Nefinalizate')).toBeFocused();
    await page.keyboard.press('End');
    await expect(tab(page, 'Toate')).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Home');
    await expect(tab(page, 'De aprobat')).toHaveAttribute('aria-selected', 'true');
    await expect(page).toHaveURL(/status=pending/);
    // c27 — scrolled: the chrome is pinned right under the 64px bar, the title gone
    await tab(page, 'Nefinalizate').click();
    await chip(page, 'Anulate').click();
    await settledList(page);
    await page.mouse.wheel(0, 1500);
    await expect.poll(() => page.getByTestId('inbox-chrome').evaluate((el) => Math.round(el.getBoundingClientRect().top))).toBe(64);
    await expect(page.getByRole('heading', { level: 1 })).not.toBeInViewport();
    await expectNoA11yViolations(page);
    expect(errors).toEqual([]);
  });

  test('c27 phone: tab row scrolls sideways (cut, focusable), chrome follows the bar to the top edge', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await go(page, '?status=all');
    await settledList(page);
    const row = page.getByRole('tablist', { name: 'Rezervări' });
    expect(await row.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
    // ?status=all: the selected (last) tab was scrolled into view
    await expect(tab(page, 'Toate')).toBeInViewport({ ratio: 0.9 });
    await page.mouse.wheel(0, 1200);
    await page.waitForTimeout(600);
    const top = await page.getByTestId('inbox-chrome').evaluate((el) => Math.round(el.getBoundingClientRect().top));
    // Pinned under the bar (56) or at the edge with the bar concealed (0) — never in between.
    expect([0, 56]).toContain(top);
    await expectNoA11yViolations(page);
  });

  /* ==============================================================================================
   * Deep links and real reads
   * ============================================================================================ */

  const LINKS: [string, string, string | null, RegExp | null][] = [
    ['?status=pending', 'De aprobat', null, /status=pending/],
    ['?status=cancelled', 'Nefinalizate', 'Anulate', /status=cancelled/],
    ['?status=rejected', 'Nefinalizate', 'Cereri neacceptate', /status=rejected/],
    ['?status=toreview', 'Confirmate', 'De evaluat', /status=toreview/],
    ['?status=all', 'Toate', null, /status=all/],
    ['?status=junk', 'Confirmate', 'Azi', null],
    ['', 'Confirmate', 'Azi', null],
  ];
  for (const [query, tabName, chipName, url] of LINKS) {
    test(`c6 b.status-param: «${query || '(none)'}» → ${tabName}${chipName ? ` · ${chipName}` : ''}`, async ({ page }) => {
      const gets = inboxGets(page);
      await go(page, query);
      await expect(tab(page, tabName)).toHaveAttribute('aria-selected', 'true');
      if (chipName) await expect(chip(page, chipName)).toHaveAttribute('aria-pressed', 'true');
      else await expect(page.getByTestId('inbox-subs')).toHaveCount(0);
      await settledList(page);
      const expected = {
        'De aprobat': ['pending', null],
        Toate: ['all', null],
        Confirmate: ['confirmed', chipName === 'Azi' ? 'today' : 'toreview'],
        Nefinalizate: ['unfinished', chipName === 'Anulate' ? 'cancelled' : 'rejected'],
      }[tabName]!;
      expect(gets[0]).toEqual({
        bucket: expected[0],
        sub: expected[1],
        page: '1',
      });
      // The URL keeps the vocabulary; junk and the default leave a clean URL.
      if (url) await expect(page).toHaveURL(url);
      else await expect.poll(() => new URL(page.url()).search).toBe('');
    });
  }

  test('c4 c5 c7 c8 c12: every bucket / sub reads the real list; subs remembered per tab; next page; scroll to top', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    const gets = inboxGets(page);
    await go(page);
    await settledList(page);
    // c4 chips per bucket, default sub
    await expect(page.getByTestId('inbox-subs').getByRole('button')).toHaveText(['Toate', 'Azi', 'Viitoare', 'Trecute', 'De evaluat']);
    const cases: [string, string | null, string, string | null][] = [
      ['Confirmate', 'Toate', 'confirmed', null],
      ['Confirmate', 'Viitoare', 'confirmed', 'upcoming'],
      ['Confirmate', 'Trecute', 'confirmed', 'past'],
      ['Confirmate', 'De evaluat', 'confirmed', 'toreview'],
      ['Nefinalizate', 'Toate', 'unfinished', null],
      ['Nefinalizate', 'Cereri neacceptate', 'unfinished', 'rejected'],
      ['Nefinalizate', 'Neprezentări', 'unfinished', 'noshow'],
      ['Nefinalizate', 'Anulate', 'unfinished', 'cancelled'],
      ['Toate', null, 'all', null],
      ['De aprobat', null, 'pending', null],
    ];
    for (const [t, c, bucket, sub] of cases) {
      await tab(page, t).click();
      if (c) await chip(page, c).click();
      else await expect(page.getByTestId('inbox-subs')).toHaveCount(0);
      await settledList(page);
      await expect.poll(() => gets.some((g) => g.bucket === bucket && g.sub === sub && g.page === '1')).toBe(true);
      // c12 — rows or the dedicated empty copy, never both
      const empty = await page.getByTestId('inbox-empty').count();
      if (empty) await expect(page.getByTestId('inbox-empty')).toBeVisible();
      else await expect(page.getByTestId('inbox-row').first()).toBeVisible();
    }
    // c5 — back to Nefinalizate: it is still on Anulate; Confirmate still on De evaluat
    await tab(page, 'Nefinalizate').click();
    await expect(chip(page, 'Anulate')).toHaveAttribute('aria-pressed', 'true');
    await tab(page, 'Confirmate').click();
    await expect(chip(page, 'De evaluat')).toHaveAttribute('aria-pressed', 'true');
    // c8 — Anulate holds more than 20 locally: a next page (pageSize 20)
    await tab(page, 'Nefinalizate').click();
    await settledList(page);
    await expect(page.getByTestId('inbox-row')).toHaveCount(20);
    await page.getByRole('button', { name: 'Mai multe' }).click();
    await expect.poll(() => gets.some((g) => g.sub === 'cancelled' && g.page === '2')).toBe(true);
    await expect.poll(() => page.getByTestId('inbox-row').count()).toBeGreaterThan(20);
    // c7 — a sub change goes back to the top
    await page.evaluate(() => window.scrollTo(0, 2000));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(300);
    await chip(page, 'Neprezentări').click();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    await page.evaluate(() => window.scrollTo(0, 600));
    await tab(page, 'Toate').click();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    expect(errors).toEqual([]);
  });

  /* ==============================================================================================
   * Real writes from the cards
   * ============================================================================================ */

  test('c3 c23 c25 c24 + operator.actiuni-rezervare.c14: accept a real request from its card', async ({ page, request: api }) => {
    const errors = collectConsoleErrors(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    const b = await pendingRequest(api);
    const meta = await api.get(`${CMS}/feed/bookings/lake/${LAKE}`, {
      headers: auth(),
      params: { bucket: 'pending', page: 1, pageSize: 20 },
    });
    const pendingCount = ((await meta.json()) as { meta: { pendingCount: number } }).meta.pendingCount;
    expect(pendingCount).toBeGreaterThan(0);

    await go(page, '?status=pending');
    const row = rowOf(page, b.documentId);
    await expect(row).toBeVisible();
    // c3 — the badge is the first page's pendingCount
    await expect(tab(page, 'De aprobat')).toHaveAccessibleName(`De aprobat, ${pendingCount}`);
    // c23 — Sună + Refuză + Acceptă on the card
    await expect(row.getByRole('link', { name: 'Sună pe Sim QA' })).toHaveAttribute('href', 'tel:+40712345678');
    await expect(row.getByRole('button', { name: 'Refuză' })).toBeVisible();
    // c16 — a fresh request's age
    await expect(row.getByTestId('inbox-age')).toHaveText(/^acum (câteva secunde|\d+ min)$/);

    // c24 — the card opens the detail (docked side panel at 1280), seeded: no skeleton
    await row.getByRole('button', { name: /^Sim QA, / }).click();
    const panel = page.locator('aside', {
      has: page.getByRole('heading', { name: 'Detalii rezervare' }),
    });
    await expect(panel).toBeVisible();
    await expect(panel.getByTestId('booking-detail')).toHaveAttribute('data-booking', b.documentId);
    await expect(page).toHaveURL(new RegExp(`rezervare=${b.documentId}`));
    await expect(page).toHaveURL(/status=pending/);
    await expect(row).toBeInViewport(); // the list stays in view beside it
    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);

    // c25 — the accept from the card: confirmation, then the card's buttons disabled while the PATCH runs
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    await page.route(/\/api\/cms\/feed\/bookings\/[^/]+\/accept$/, async (r) => {
      await gate;
      await r.fallback();
    });
    await row.getByRole('button', { name: 'Acceptă' }).click();
    await page.locator('dialog[open]').getByRole('button', { name: 'Confirmă' }).click();
    await expect(row.getByRole('button', { name: 'Acceptă' })).toBeDisabled();
    await expect(row.getByRole('button', { name: 'Refuză' })).toBeDisabled();
    release();
    await expect(page.getByText('Rezervare confirmată', { exact: true })).toBeVisible();
    // the list refetches: the request leaves De aprobat
    await expect(rowOf(page, b.documentId)).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('c23: reject a real request from its card (phone: the detail is a sheet)', async ({ page, request: api }) => {
    const errors = collectConsoleErrors(page);
    await page.setViewportSize({ width: 375, height: 800 });
    const b = await pendingRequest(api);
    await go(page, '?status=pending');
    const row = rowOf(page, b.documentId);
    await expect(row).toBeVisible();
    await row.getByRole('button', { name: 'Refuză' }).click();
    const dlg = page.locator('dialog[open]');
    await dlg.getByRole('textbox', { name: 'Motivul refuzului' }).fill('Standul e rezervat telefonic.');
    await dlg.getByRole('button', { name: 'Da, respinge' }).click();
    await expect(page.getByText('Rezervare respinsă', { exact: true })).toBeVisible();
    await expect(rowOf(page, b.documentId)).toHaveCount(0);
    // It now sits in Nefinalizate · Cereri neacceptate with its reason (c22)
    await tab(page, 'Nefinalizate').click();
    await chip(page, 'Cereri neacceptate').click();
    const rejected = rowOf(page, b.documentId);
    await expect(rejected).toBeVisible();
    await expect(rejected).toHaveAttribute('data-quiet', 'true');
    await expect(rejected.getByTestId('inbox-reason')).toContainText('Motiv refuz: Standul e rezervat telefonic.');
    // c24 on the phone: the sheet
    await rejected.getByRole('button', { name: /^Sim QA, / }).click();
    await expect(page.locator('dialog[open]').getByTestId('booking-detail')).toBeVisible();
    expect(errors).toEqual([]);
  });

  /* ==============================================================================================
   * Fixture states
   * ============================================================================================ */

  test('c15 c17 c18 c19 c20 c21 c22 c16: the card says everything fish does', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    const now = Date.now();
    const long = 'Am anulat pentru că lacul a fost închis o zi pentru lucrări la mal și la drumul de acces, ne cerem scuze pentru deranj.';
    const rows = [
      fake('p1', {
        bookingStatus: 'pending',
        createdAt: iso(now - (6 * H + 5 * 60_000)),
        angler: {
          documentId: 'ang-1',
          username: 'andrei.ionescu',
          avatar: null,
        },
        notes: 'Vin cu doi copii [Refuz operator] nu',
        basis: {
          durationHours: 12,
          rowLabel: null,
          composedFrom: [12],
          tourPrice: 250,
          extras: [
            {
              key: 'boat',
              label: 'Barcă',
              unit: 'perStay',
              unitPrice: 50,
              quantity: 1,
              total: 50,
            },
          ],
        },
      }),
      fake('p2', {
        bookingStatus: 'pending',
        createdAt: iso(now - 40 * 60_000),
        contactFullname: undefined,
        priceTotal: 1250,
      }),
      fake('l1', {
        startDate: iso(now - 3 * H - 5 * 60_000),
        endDate: iso(now + 9 * H - 5 * 60_000),
        paymentStatus: 'depositPaid',
        contactFullname: 'Live Pescar',
      }),
      fake('c1', {
        bookingStatus: 'cancelled',
        cancelledBy: 'angler',
        cancelReason: long,
        contactFullname: 'Ana Anulată',
      }),
      fake('n1', {
        noShow: true,
        noShowComment: 'Nu a răspuns la telefon',
        contactFullname: 'Nu Venit',
      }),
      fake('pd', {
        paymentStatus: 'paidInFull',
        contactFullname: 'Plătit Tot',
      }),
    ];
    await mockInbox(page, () => page1(rows, 2));
    await mockReputation(page, { 'ang-1': { avgStars: 4.62, noShowCount: 2 } });
    await page.setViewportSize({ width: 375, height: 900 });
    await go(page, '?status=all');
    const p1 = rowOf(page, 'p1');
    // c15 name, rating pill, no-show pill
    await expect(p1.getByRole('button', { name: /^andrei\.ionescu, / })).toBeVisible();
    await expect(p1.getByTestId('angler-rating-badge')).toContainText('4,6');
    await expect(p1.getByTestId('no-show-pill')).toHaveText('2 neprezentări');
    await expect(rowOf(page, 'p2').getByRole('button', { name: /^Pescar, / })).toBeVisible();
    // c16 stale age in red, fresh one muted
    await expect(p1.getByTestId('inbox-age')).toHaveText(/^acum 6 h [45] min$/);
    await expect(p1.getByTestId('inbox-age')).toHaveAttribute('data-stale', 'true');
    await expect(rowOf(page, 'p2').getByTestId('inbox-age')).toHaveText(/^acum (39|40) min$/);
    await expect(rowOf(page, 'p2').getByTestId('inbox-age')).not.toHaveAttribute('data-stale', 'true');
    // c17 stand + extras
    await expect(p1.getByText('Standul A10')).toBeVisible();
    await expect(p1.getByText('Barcă', { exact: true })).toBeVisible();
    // c18 period · hours; live → progress
    await expect(p1.getByTestId('inbox-period')).toHaveText(/ → .* · 12h$/);
    await expect(rowOf(page, 'l1').getByTestId('inbox-progress')).toContainText('3h din 12h');
    await expect(rowOf(page, 'l1').getByTestId('inbox-period')).not.toHaveText(/· 12h$/);
    // c19 price with the unit apart; status pill vs money pill
    await expect(rowOf(page, 'p2').getByTestId('inbox-price')).toHaveText('1.250 lei');
    await expect(p1.getByText('În așteptare')).toBeVisible();
    await expect(rowOf(page, 'l1').getByTestId('inbox-money')).toHaveText('Avans');
    await expect(rowOf(page, 'pd').getByTestId('inbox-money')).toHaveText('Plătit');
    await expect(rowOf(page, 'n1').getByText('Nu a venit')).toBeVisible();
    await expect(rowOf(page, 'c1').getByText('Anulată de pescar')).toBeVisible();
    // c20 quiet cards
    await expect(rowOf(page, 'c1')).toHaveAttribute('data-quiet', 'true');
    await expect(rowOf(page, 'n1')).toHaveAttribute('data-quiet', 'true');
    await expect(rowOf(page, 'pd')).not.toHaveAttribute('data-quiet', 'true');
    // c21 note one line, operator part stripped
    await expect(p1.getByTestId('inbox-note')).toHaveText('„Vin cu doi copii”');
    await expect(rowOf(page, 'p2').getByTestId('inbox-note')).toHaveCount(0);
    // c22 reason clamp + toggle; no-show note
    const reason = rowOf(page, 'c1').getByTestId('inbox-reason');
    await expect(reason).toContainText(`Motiv anulare: ${long}`);
    const toggle = reason.getByRole('button', { name: 'vezi mai mult' });
    const clamped = await reason.locator('p').evaluate((el) => el.scrollHeight > el.clientHeight + 1);
    expect(clamped).toBe(true);
    await toggle.click();
    await expect(reason.getByRole('button', { name: 'vezi mai puțin' })).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('dialog[open]')).toHaveCount(0); // the toggle never opens the detail
    await expect(rowOf(page, 'n1').getByTestId('inbox-reason')).toHaveText('Neprezentare: Nu a răspuns la telefon');
    // c23 — Toate keeps actions in the detail only
    await expect(page.getByTestId('inbox-actions')).toHaveCount(0);
    await expectNoA11yViolations(page);
    await shots(page, 'cards');
    expect(errors).toEqual([]);
  });

  test('c14: Confirmate · Azi grouped by stand, turnover card with in/out badges and a thread', async ({ page }) => {
    const now = new Date();
    const day = (h: number) => {
      const d = new Date(now);
      d.setHours(h, 0, 0, 0);
      return d.toISOString();
    };
    const tomorrow = (h: number) => {
      const d = new Date(now);
      d.setDate(d.getDate() + 1);
      d.setHours(h, 0, 0, 0);
      return d.toISOString();
    };
    const yesterday = (h: number) => {
      const d = new Date(now);
      d.setDate(d.getDate() - 1);
      d.setHours(h, 0, 0, 0);
      return d.toISOString();
    };
    const st = (name: string) => ({ documentId: `st-${name}`, name });
    const rows = [
      fake('in10', {
        stand: st('10'),
        startDate: day(23),
        endDate: tomorrow(11),
        contactFullname: 'Vine Seara',
      }),
      fake('out10', {
        stand: st('10'),
        startDate: yesterday(18),
        endDate: new Date(new Date(day(22)).getTime() + 30 * 60_000).toISOString(),
        contactFullname: 'Pleacă Azi',
      }),
      fake('s9', {
        stand: st('9'),
        startDate: yesterday(6),
        endDate: tomorrow(6),
        contactFullname: 'Stă Mult',
      }),
    ];
    const gets: string[] = [];
    await mockInbox(page, (q) => {
      gets.push(`${q.bucket}:${q.sub}`);
      return page1(rows);
    });
    await page.setViewportSize({ width: 1280, height: 900 });
    await go(page);
    await expect(page.getByTestId('inbox-turnover')).toHaveCount(1);
    // natural order: 9 before 10; the 10s fold into one group ordered by start
    const order = await page.locator('[data-item]').evaluateAll((els) => els.map((e) => e.getAttribute('data-item')));
    expect(order).toEqual(['s9', 't-out10']);
    const tv = page.getByTestId('inbox-turnover');
    await expect(tv).toHaveAttribute('aria-label', 'Standul 10: schimb de tură azi');
    await expect(tv.getByTestId('inbox-row')).toHaveCount(2);
    await expect(tv.getByTestId('inbox-thread')).toHaveCount(1);
    await expect(rowOf(page, 'out10').getByTestId('inbox-turnover-badge')).toHaveAttribute('data-kind', 'leaves');
    await expect(rowOf(page, 'in10').getByTestId('inbox-turnover-badge')).toHaveAttribute('data-kind', 'arrives');
    await expect(rowOf(page, 'in10').getByTestId('inbox-period')).toHaveText(/^(vine 23:00 · 12h|a venit 23:00 → .+)$/);
    await expect(rowOf(page, 'out10').getByTestId('inbox-period')).toHaveText(/^(pleacă|a plecat) 22:30$/);
    // a lone stand keeps its period line
    await expect(rowOf(page, 's9').getByTestId('inbox-turnover-badge')).toHaveCount(0);
    // other lists: server order, no grouping
    await chip(page, 'Viitoare').click();
    await expect(page.getByTestId('inbox-turnover')).toHaveCount(0);
    await chip(page, 'Azi').click();
    await expect(page.getByTestId('inbox-turnover')).toHaveCount(1);
    await expectNoA11yViolations(page);
    await shots(page, 'turnover');
  });

  test('c12: the empty copy of every bucket / sub', async ({ page }) => {
    await mockInbox(page, () => page1([]));
    await page.setViewportSize({ width: 1280, height: 900 });
    await go(page);
    const expectEmpty = (text: string) => expect(page.getByTestId('inbox-empty')).toContainText(text);
    await expectEmpty('Nicio rezervare azi.');
    await chip(page, 'Toate').click();
    await expectEmpty('Nicio rezervare confirmată.');
    await chip(page, 'Viitoare').click();
    await expectEmpty('Nicio rezervare viitoare.');
    await chip(page, 'Trecute').click();
    await expectEmpty('Nicio rezervare încheiată.');
    await chip(page, 'De evaluat').click();
    await expectEmpty('Nimic de evaluat.');
    await tab(page, 'De aprobat').click();
    await expectEmpty('Nimic de aprobat.');
    // c3 — no badge at 0
    await expect(tab(page, 'De aprobat')).toHaveAccessibleName('De aprobat');
    await tab(page, 'Nefinalizate').click();
    await expectEmpty('Nimic nefinalizat.');
    await chip(page, 'Cereri neacceptate').click();
    await expectEmpty('Nicio cerere neacceptată.');
    await chip(page, 'Anulate').click();
    await expectEmpty('Nicio anulare.');
    await chip(page, 'Neprezentări').click();
    await expectEmpty('Nicio neprezentare.');
    await tab(page, 'Toate').click();
    await expectEmpty('Nicio rezervare.');
    await expectNoA11yViolations(page);
    await shots(page, 'empty');
  });

  test('c9 c3: an uncached tab is the skeleton (never the old rows, no badge yet); a cached tab paints at once and revalidates', async ({ page }) => {
    let holdPending = true;
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const gets: string[] = [];
    await mockInbox(page, async (q) => {
      gets.push(q.bucket);
      if (q.bucket === 'pending' && holdPending) await gate;
      return q.bucket === 'pending' ? page1([fake('pp', { bookingStatus: 'pending' })], 4) : page1([fake('cc')], 4);
    });
    await page.setViewportSize({ width: 1280, height: 900 });
    await go(page);
    await expect(rowOf(page, 'cc')).toBeVisible();
    // the badge comes from the current list's first page
    await expect(tab(page, 'De aprobat')).toHaveAccessibleName('De aprobat, 4');
    await tab(page, 'De aprobat').click();
    await expect(page.getByTestId('inbox-skeleton')).toBeVisible();
    await expect(rowOf(page, 'cc')).toHaveCount(0);
    await expect(tab(page, 'De aprobat')).toHaveAccessibleName('De aprobat');
    await shots(page, 'skeleton', [375, 1280]);
    release();
    holdPending = false;
    await expect(rowOf(page, 'pp')).toBeVisible();
    // back to Confirmate: cached → at once, no skeleton, and a revalidating GET
    const before = gets.filter((b) => b === 'confirmed').length;
    await tab(page, 'Confirmate').click();
    await expect(rowOf(page, 'cc')).toBeVisible({ timeout: 1000 });
    await expect.poll(() => gets.filter((b) => b === 'confirmed').length).toBeGreaterThan(before);
  });

  test('c10: a failed first page → the inline error (no sign-out), retry reloads; a 403 reads «Nu ai acces»', async ({ page }) => {
    const errors = collectConsoleErrors(page, { ignore: EXPECTED_CONSOLE });
    let fail: number | null = 503;
    await mockInbox(page, () => (fail ? fail : page1([fake('ok1')])));
    await page.setViewportSize({ width: 375, height: 900 });
    await go(page);
    await expect(page.getByText('Nu am putut încărca rezervările.')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Verifică conexiunea și încearcă din nou.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Deconectează-te' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Înapoi' })).toHaveCount(1);
    await expectNoA11yViolations(page);
    await shots(page, 'error');
    fail = null;
    await page.getByRole('button', { name: 'Încearcă din nou' }).click();
    await expect(rowOf(page, 'ok1')).toBeVisible();
    // 403: not this owner's lake
    fail = 403;
    await tab(page, 'Toate').click();
    await expect(page.getByText('Nu ai acces')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('c11 c8: next page loads near the bottom with a spinner; its failure keeps the rows and retries', async ({ page }) => {
    const errors = collectConsoleErrors(page, { ignore: EXPECTED_CONSOLE });
    const first = Array.from({ length: 20 }, (_, i) => fake(`r${i}`, { contactFullname: `Pescar ${i}` }));
    let page2: 'fail' | 'hold' | 'ok' = 'fail';
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    await mockInbox(page, async (q) => {
      if (q.page === 1) return page1(first);
      if (page2 === 'fail') return 500;
      if (page2 === 'hold') await gate;
      return page1([fake('last', { contactFullname: 'Ultimul' })], 0, 2);
    });
    await page.setViewportSize({ width: 1280, height: 900 });
    await go(page, '?status=all');
    await expect(page.getByTestId('inbox-row')).toHaveCount(20);
    // scrolling near the bottom fetches page 2 by itself; it fails
    await page.getByTestId('inbox-footer').scrollIntoViewIfNeeded();
    await expect(page.getByText('Nu am putut încărca mai multe.')).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByTestId('inbox-row')).toHaveCount(20);
    await shots(page, 'next-page-error', [375, 1280]);
    page2 = 'hold';
    await page.getByTestId('inbox-footer').getByRole('button', { name: 'Încearcă din nou' }).click();
    await expect(page.getByTestId('inbox-footer-spinner')).toBeVisible();
    release();
    await expect(rowOf(page, 'last')).toBeVisible();
    // a short page is the last: the footer is gone
    await expect(page.getByTestId('inbox-footer')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('c13 b.refresh: «Reîmprospătează» and window focus refetch the current list', async ({ page }) => {
    let n = 0;
    await mockInbox(page, () => {
      n += 1;
      return page1([fake('x', { contactFullname: `Citire ${n}` })]);
    });
    await go(page);
    await expect(page.getByText('Citire 1')).toBeVisible();
    await page.getByRole('button', { name: 'Reîmprospătează' }).click();
    await expect(page.getByText('Citire 2')).toBeVisible();
    await page.evaluate(() => window.dispatchEvent(new Event('visibilitychange')));
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect.poll(() => n).toBeGreaterThan(2);
  });

  test('c26 b.focus-param: ?focus scrolls that booking under the chrome, once', async ({ page }) => {
    const rows = Array.from({ length: 40 }, (_, i) => fake(`f${i}`, { contactFullname: `Pescar ${i}` }));
    let n = 0;
    await mockInbox(page, () => {
      n += 1;
      return page1(rows);
    });
    await page.setViewportSize({ width: 1280, height: 800 });
    await go(page, '?status=all&focus=f21');
    const target = rowOf(page, 'f21');
    await expect(target).toBeInViewport();
    const chromeBottom = await page.getByTestId('inbox-chrome').evaluate((el) => el.getBoundingClientRect().bottom);
    const top = await target.evaluate((el) => el.getBoundingClientRect().top);
    expect(top).toBeGreaterThanOrEqual(chromeBottom - 1);
    expect(top - chromeBottom).toBeLessThan(40);
    await expect(page).toHaveURL(/focus=f21/);
    // once only: scroll away and refetch — it stays where the operator put it
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.getByRole('button', { name: 'Reîmprospătează' }).click();
    await expect.poll(() => n).toBeGreaterThan(1);
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });

  test('c26: ?focus on the first booking only reveals the header', async ({ page }) => {
    await mockInbox(page, () => page1(Array.from({ length: 15 }, (_, i) => fake(`g${i}`))));
    await page.setViewportSize({ width: 1280, height: 800 });
    await go(page, '?status=all&focus=g0');
    await expect(rowOf(page, 'g0')).toBeVisible();
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    await expect(page.getByRole('heading', { level: 1 })).toBeInViewport();
  });

  test('c23 c24 desktop table: rows with columns, actions column in De aprobat, side panel docked; screenshots', async ({ page }) => {
    const now = Date.now();
    const pending = [
      fake('a1', {
        bookingStatus: 'pending',
        createdAt: iso(now - 7 * H),
        angler: { documentId: 'ang-a', username: 'mihai.pescar', avatar: null },
        notes: 'Ajung pe la 7',
      }),
      fake('a2', {
        bookingStatus: 'pending',
        createdAt: iso(now - 20 * 60_000),
        contactFullname: 'Ion Vasile',
      }),
    ];
    const review = [
      fake('r1', {
        startDate: iso(now - 30 * H),
        endDate: iso(now - 18 * H),
        contactFullname: 'De Evaluat',
      }),
    ];
    await mockInbox(page, (q) => (q.bucket === 'pending' ? page1(pending, 2) : q.sub === 'toreview' ? page1(review, 2) : page1([fake('z1')], 2)));
    await mockReputation(page, { 'ang-a': { avgStars: 3.8, noShowCount: 1 } });
    await page.route(/\/api\/cms\/feed\/bookings\/(a1|a2|r1|z1)$/, (r) => {
      const id = new URL(r.request().url()).pathname.split('/').pop()!;
      return json(r, {
        data: [...pending, ...review].find((x) => x.documentId === id) ?? fake(id),
      });
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await go(page, '?status=pending');
    await expect(page.getByTestId('inbox-head')).toBeVisible();
    await expect(page.getByTestId('inbox-head')).toContainText('Acțiuni');
    // one row per booking, cells on one line: name, stand and period share a baseline band
    const a1 = rowOf(page, 'a1');
    const [nameBox, periodBox, actionsBox] = await Promise.all([
      a1.getByRole('button', { name: /^mihai\.pescar, / }).boundingBox(),
      a1.getByTestId('inbox-period').boundingBox(),
      a1.getByTestId('inbox-actions').boundingBox(),
    ]);
    expect(Math.abs(nameBox!.y + nameBox!.height / 2 - (periodBox!.y + periodBox!.height / 2))).toBeLessThan(14);
    expect(actionsBox!.x).toBeGreaterThan(periodBox!.x);
    await shots(page, 'pending');
    // c23 De evaluat: Evaluează pescarul → the rate screen
    await tab(page, 'Confirmate').click();
    await chip(page, 'De evaluat').click();
    await expect(rowOf(page, 'r1').getByRole('button', { name: 'Evaluează pescarul' })).toBeVisible();
    await shots(page, 'toreview', [375, 1440]);
    await rowOf(page, 'r1').getByRole('button', { name: 'Evaluează pescarul' }).click();
    await expect(page).toHaveURL(/\/operator\/evalueaza\/r1\?/);
    await page.goBack();
    // c24 docked panel beside the table, screenshots with it open
    await go(page, '?status=pending');
    await rowOf(page, 'a1')
      .getByRole('button', { name: /^mihai\.pescar, / })
      .click();
    const panel = page.locator('aside', {
      has: page.getByRole('heading', { name: 'Detalii rezervare' }),
    });
    await expect(panel).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Detalii rezervare' })).toBeFocused();
    await settled(page);
    await expectNoA11yViolations(page);
    await shots(page, 'detail-open', [1280, 1440, 1920]);
    // Acceptă from the panel closes it and asks for the confirmation (operator.detaliu-rezervare.c11)
    await panel.getByRole('button', { name: 'Acceptă' }).click();
    await expect(panel).toHaveCount(0);
    await expect(page.locator('dialog[open]').getByRole('heading', { name: 'Accepți rezervarea?' })).toBeVisible();
  });

  test('c9 first paint (no ?status → Confirmate · Azi): the fallback draws the caption and the chip row — the list does not jump', async ({ page, browser }) => {
    // The fallback as the server streams it: without JS it stays in its hidden streamed segment —
    // show that segment alone and measure the list skeleton against the title.
    const noJs = await browser.newContext({
      javaScriptEnabled: false,
      viewport: { width: 1280, height: 900 },
    });
    await signIn(noJs, jwt);
    const fb = await noJs.newPage();
    await fb.goto(PATH);
    await expect(fb.getByTestId('inbox-fallback-subs')).toHaveAttribute('data-chips', '5');
    const fallbackGap = await fb.evaluate(() => {
      const seg = document.querySelector('[data-testid="inbox-fallback-subs"]')!.closest('div[hidden]') as HTMLElement;
      document.body.replaceChildren(seg);
      seg.hidden = false;
      const caption = seg.querySelector('h1')!.parentElement!.textContent ?? '';
      if (!caption.includes('Se încarcă')) throw new Error('no caption bone');
      return seg.querySelector('[data-testid="inbox-skeleton"]')!.getBoundingClientRect().top - seg.querySelector('h1')!.getBoundingClientRect().top;
    });
    await noJs.close();
    // … and the mounted screen, its first page held: the list skeleton sits where the fallback's did.
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    await mockInbox(page, async () => {
      await gate;
      return page1([]);
    });
    await page.setViewportSize({ width: 1280, height: 900 });
    await go(page);
    await expect(page.getByTestId('inbox-subs')).toBeVisible();
    await expect(page.getByTestId('inbox-skeleton')).toBeVisible();
    const realGap = (await page.getByTestId('inbox-skeleton').boundingBox())!.y - (await page.getByRole('heading', { level: 1 }).boundingBox())!.y;
    expect(Math.abs(fallbackGap - realGap)).toBeLessThanOrEqual(1);
    release();
  });

  test('c24 1265 (1280 minus a classic scrollbar): the docked detail keeps the table, the period breaks only at its arrow, the open row is marked', async ({ playwright }) => {
    // Headless Chromium hides scrollbars: a browser of its own lets the classic one back in.
    const browser = await playwright.chromium.launch({
      ignoreDefaultArgs: ['--hide-scrollbars'],
    });
    const context = await browser.newContext({
      baseURL: BASE_URL,
      viewport: { width: 1280, height: 900 },
    });
    const page = await context.newPage();
    const now = Date.now();
    // near-identical rows: same angler, same stand, same period — only the selection tells them apart
    const rows = ['s1', 's2', 's3'].map((id) =>
      fake(id, {
        contactFullname: 'Pescar',
        startDate: iso(now + 24 * H + 50 * 60_000),
        endDate: iso(now + 36 * H + 50 * 60_000),
      }),
    );
    await mockInbox(page, () => page1(rows));
    await page.route(/\/api\/cms\/feed\/bookings\/(s1|s2|s3)$/, (r) =>
      json(r, {
        data: rows.find((x) => r.request().url().endsWith(`/${x.documentId}`)),
      }),
    );
    // A 1280 window with a classic (space-taking) 15px scrollbar — Windows / Linux Chrome, macOS «always
    // show»: the media queries still read 1280 (docked), the layout gets 1265.
    await go(page);
    await page.addStyleTag({
      content: 'html{overflow-y:scroll}::-webkit-scrollbar{width:15px;height:15px;background:#eee}',
    });
    await expect.poll(() => page.evaluate(() => document.documentElement.clientWidth)).toBe(1265);
    expect(await page.evaluate(() => matchMedia('(min-width: 1280px)').matches)).toBe(true);
    await expect(page.getByTestId('inbox-head')).toBeVisible();
    await rowOf(page, 's2')
      .getByRole('button', { name: /^Pescar, / })
      .click();
    const panel = page.locator('aside', {
      has: page.getByRole('heading', { name: 'Detalii rezervare' }),
    });
    await expect(panel).toBeVisible();
    await settled(page);
    // still the table (head shown, rows stacked in one column), with room to spare over the 768 threshold
    await expect(page.getByTestId('inbox-head')).toBeVisible();
    const listBox = (await page.getByTestId('inbox-list').boundingBox())!;
    expect(listBox.width).toBeGreaterThanOrEqual(800);
    const [b1, b2] = await Promise.all([rowOf(page, 's1').boundingBox(), rowOf(page, 's2').boundingBox()]);
    expect(Math.abs(b1!.x - b2!.x)).toBeLessThan(1);
    expect(b2!.y).toBeGreaterThan(b1!.y + b1!.height - 2);
    // the period: each end on one line (at most two lines, a break only after the arrow)
    const ends = rowOf(page, 's2').getByTestId('inbox-period').locator('span');
    await expect(ends).toHaveCount(2);
    for (const box of await Promise.all([ends.nth(0).boundingBox(), ends.nth(1).boundingBox()])) expect(box!.height).toBeLessThanOrEqual(17);
    await expect(ends.nth(0)).toHaveText(/→$/);
    // master–detail: the open row is marked — and stays marked with the mouse elsewhere
    await page.mouse.move(0, 0);
    await expect(rowOf(page, 's2')).toHaveAttribute('data-selected', 'true');
    await expect(rowOf(page, 's2').getByRole('button', { name: /^Pescar, / })).toHaveAttribute('aria-current', 'true');
    await expect(rowOf(page, 's1')).not.toHaveAttribute('data-selected');
    await expect(rowOf(page, 's1').getByRole('button', { name: /^Pescar, / })).not.toHaveAttribute('aria-current');
    const bg = (id: string) => rowOf(page, id).evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(await bg('s2')).not.toBe(await bg('s1'));
    await page.screenshot({
      path: `${SHOTS}/detail-open-1265.png`,
      fullPage: true,
    });
    // another row moves the mark
    await rowOf(page, 's3')
      .getByRole('button', { name: /^Pescar, / })
      .click();
    await expect(rowOf(page, 's3')).toHaveAttribute('data-selected', 'true');
    await expect(rowOf(page, 's2')).not.toHaveAttribute('data-selected');
    await browser.close();
  });
});
