import { mkdirSync } from 'node:fs';
import { expect, test, type Page, type Request, type Route } from '@playwright/test';
import {
  createBlock,
  createWalkInBooking,
  deleteBlock,
  getLakeAvailability,
  operatorCancelBooking,
  type LakeAvailability,
} from '@/core/booking';
import { createTestTransport } from '../transport';
import { expectNoA11yViolations } from './helpers/a11y';
import { BASE_URL } from './helpers/base-url';
import { collectConsoleErrors } from './helpers/console';
import { qaJwt, signIn } from './helpers/session';

/*
 * operator.calendar (/operator/[lakeId]/calendar, T4) — the lake's calendar and step 1 of the walk-in
 * (fish app/(app)/operator/[lakeId]/walk-in/{_layout,index}.tsx), plus operator.b.walk-in-shared-flow:
 * the angler's grid (booking.rezerva-grila, whose suite runs unchanged) in walk-in mode.
 *
 * REAL reads and writes on the LOCAL Chita Lake, which the QA user owns (owner 2026-10-08: local
 * writes are safe). beforeAll makes, through core (createWalkInBooking / createBlock):
 *  - a guest walk-in «Calendar E2E» on a free 06–18 slot (days 2–9, a stand without extras) — the
 *    booked band c6 opens;
 *  - a labelled block «Test e2e calendar» on another free 06–18 slot — the blocked band c5 taps;
 * and afterAll operator-cancels the walk-in and deletes the block. The in-progress slot (c3) is the
 * real current Chita slot (06–18 / 18–06) on a stand free right now. Route mocks only for what the
 * local DB cannot give on demand: a held / empty / refused bookings list (c6 loading, unmatched,
 * non-owner), a failed availability (c10).
 */

process.env.TZ = 'Europe/Bucharest';
test.use({ timezoneId: 'Europe/Bucharest', locale: 'ro-RO' });

const LAKE = 's84u55lo4n9z0emngozttt6e'; // local Chita Lake
const PATH = `/operator/${LAKE}/calendar`;
const AVAIL = /\/api\/cms\/feed\/lakes\/[^/]+\/availability/;
const QUOTE = /\/api\/cms\/feed\/lakes\/[^/]+\/quote/;
const LIST = new RegExp(`/api/cms/feed/bookings/lake/${LAKE}`);
const SHOTS = '.shots/operator-calendar';
const WIDTHS = [375, 1280, 1440, 1920] as const;
const EXPECTED_CONSOLE = [/Failed to load resource: the server responded with a status of (403|500)/];

/* ------------------------------------------------------------------------------------------------
 * Time (Europe/Bucharest wall clock, like the grid)
 * ---------------------------------------------------------------------------------------------- */

const pad = (n: number) => String(n).padStart(2, '0');
const WD = ['Duminică', 'Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă'];
const MO = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'noi', 'dec'];
function dayAt(offset: number, hour = 0): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  d.setHours(hour);
  return d;
}
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const pill = (offset: number) => {
  const d = dayAt(offset);
  return `${WD[d.getDay()]} ${d.getDate()} ${MO[d.getMonth()]}`;
};
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The Chita slot running now: [day offset of its start, start hour, «06–18» | «18–06»]. */
function currentSlot(): { day: number; startH: number; label: string; start: Date; end: Date } {
  const h = new Date().getHours();
  if (h < 6) return { day: -1, startH: 18, label: '18–06', start: dayAt(-1, 18), end: dayAt(0, 6) };
  if (h < 18) return { day: 0, startH: 6, label: '06–18', start: dayAt(0, 6), end: dayAt(0, 18) };
  return { day: 0, startH: 18, label: '18–06', start: dayAt(0, 18), end: dayAt(1, 6) };
}

/* ------------------------------------------------------------------------------------------------
 * Real fixtures on Chita
 * ---------------------------------------------------------------------------------------------- */

type Fx = {
  avail: LakeAvailability;
  inProgress: { stand: string; name: string };
  plain: { stand: string; name: string }; // no extras: Continuă → review
  cabin: { stand: string; name: string }; // per-night extras: a night → extras
  walkIn: { id: string; stand: string; name: string; day: number };
  block: { id: string; stand: string; name: string; day: number };
};
let jwt: string;
let fx: Fx;

const overlaps = (a: { start: string; end: string }, s: number, e: number) => Date.parse(a.start) < e && Date.parse(a.end) > s;
function busy(av: LakeAvailability, stand: string, s: number, e: number) {
  return (
    av.bookings.some((b) => b.standDocumentId === stand && overlaps(b, s, e)) ||
    av.blocks.some((b) => (b.standDocumentId === null || b.standDocumentId === stand) && overlaps(b, s, e))
  );
}

test.beforeAll(async ({ request }) => {
  test.setTimeout(90_000);
  jwt = await qaJwt(request);
  const t = createTestTransport(jwt);
  const avail = await getLakeAvailability(t, LAKE, { from: ymd(dayAt(-1)), to: ymd(dayAt(12)) });
  expect(avail.slotStartTimes).toEqual(['06:00', '18:00']);
  const cur = currentSlot();
  const plainStands = avail.stands.filter((s) => s.extras.length === 0);
  const cabin = avail.stands.find((s) => s.extras.length > 0)!;
  const inProgress = plainStands.find((s) => !busy(avail, s.documentId, cur.start.getTime(), cur.end.getTime()))!;
  expect(inProgress, 'a stand free right now').toBeTruthy();
  // Two free 06–18 day slots on days 2–9, high stands first, away from the in-progress stand.
  const picks: { stand: (typeof avail.stands)[number]; day: number }[] = [];
  for (let day = 2; day <= 9 && picks.length < 2; day++) {
    const s = dayAt(day, 6).getTime() - 3_600_000;
    const e = dayAt(day, 18).getTime() + 3_600_000;
    for (const st of [...plainStands].reverse()) {
      if (st.documentId === inProgress.documentId || picks.some((p) => p.stand.documentId === st.documentId)) continue;
      if (busy(avail, st.documentId, s, e)) continue;
      picks.push({ stand: st, day });
      break;
    }
  }
  expect(picks).toHaveLength(2);
  const [w, b] = picks;
  const walk = await createWalkInBooking(t, {
    lake: LAKE,
    stand: w.stand.documentId,
    startDate: dayAt(w.day, 6).toISOString(),
    endDate: dayAt(w.day, 18).toISOString(),
    extras: [],
    contactFullname: 'Calendar E2E',
    contactPhone: '+40700000002',
  });
  const block = await createBlock(t, {
    lake: LAKE,
    stand: b.stand.documentId,
    startDate: dayAt(b.day, 6).toISOString(),
    endDate: dayAt(b.day, 18).toISOString(),
    reason: 'other',
    note: 'Test e2e calendar',
  });
  fx = {
    avail,
    inProgress: { stand: inProgress.documentId, name: inProgress.name },
    plain: { stand: inProgress.documentId, name: inProgress.name },
    cabin: { stand: cabin.documentId, name: cabin.name },
    walkIn: { id: walk.documentId, stand: w.stand.documentId, name: w.stand.name, day: w.day },
    block: { id: block.documentId, stand: b.stand.documentId, name: b.stand.name, day: b.day },
  };
  mkdirSync(SHOTS, { recursive: true });
});

test.afterAll(async () => {
  if (!fx) return;
  const t = createTestTransport(jwt);
  await operatorCancelBooking(t, fx.walkIn.id, 'Test e2e — curățenie automată.').catch(() => undefined);
  await deleteBlock(t, fx.block.id).catch(() => undefined);
});

/* ------------------------------------------------------------------------------------------------
 * Page helpers
 * ---------------------------------------------------------------------------------------------- */

async function open(page: Page, query = '') {
  await signIn(page.context(), jwt);
  await page.goto(`${PATH}${query}`);
  // The shared dev server may compile the route on the first visit.
  await expect(grid(page)).toBeVisible({ timeout: 45_000 });
}
const grid = (page: Page) => page.getByTestId('availability-grid');
const scroller = (page: Page) => grid(page).locator('> div').first();
const band = (page: Page, stand: string, day: number, interval: string) =>
  grid(page).getByRole('button', { name: new RegExp(`^${esc(stand)}, ${esc(pill(day))} ${esc(interval)}(,|$)`) });
const panel = (page: Page) =>
  page.locator('[data-testid="selection-panel"], [data-testid="selection-card"]').filter({ has: page.getByTestId('selection-start') });
const detail = (page: Page) => page.getByTestId('booking-detail');
/** Any surface the booking detail could open in (sheet / dialog / docked panel). */
const anySurface = (page: Page) => page.locator('dialog[open], aside[aria-labelledby]');

async function scrollGridTo(page: Page, x?: number) {
  await scroller(page).evaluate((el, x) => {
    if (x !== undefined) el.scrollLeft = x;
    el.dispatchEvent(new Event('scroll'));
  }, x);
}
async function shot(page: Page, name: string) {
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SHOTS}/${name}-${page.viewportSize()?.width}.png` });
}
/** Records the quote request bodies. */
function quotes(page: Page) {
  const bodies: { walkIn: boolean; stand: string; startDate: string }[] = [];
  page.on('request', (r: Request) => {
    if (r.method() === 'POST' && QUOTE.test(r.url())) bodies.push((r.postDataJSON() as { data: (typeof bodies)[number] }).data);
  });
  return bodies;
}
/** Holds the matching GET until `release()`. */
async function hold(page: Page, re: RegExp) {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  await page.route(re, async (r: Route) => {
    if (r.request().method() === 'GET') await gate;
    await r.fallback();
  });
  return () => release();
}

/* ------------------------------------------------------------------------------------------------
 * Signed out
 * ---------------------------------------------------------------------------------------------- */

test('signed out: a real 307 to /intra, coming back to the calendar with the selection', async ({ request }) => {
  const q = `?stand=s1&start=${encodeURIComponent('2026-10-10T06:00:00+03:00')}&end=${encodeURIComponent('2026-10-10T18:00:00+03:00')}`;
  const res = await request.get(`${BASE_URL}${PATH}${q}`, { maxRedirects: 0 });
  expect(res.status()).toBe(307);
  const loc = new URL(res.headers().location, BASE_URL);
  expect(loc.pathname).toBe('/intra');
  const next = new URL(loc.searchParams.get('next')!, BASE_URL);
  expect(next.pathname).toBe(PATH);
  expect(next.searchParams.get('stand')).toBe('s1');
});

/* ------------------------------------------------------------------------------------------------
 * Signed in
 * ---------------------------------------------------------------------------------------------- */

test.describe('signed in', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test('c1 c4: the lake\'s name as title, the legend without «Doar telefonic», no yellow band; c5: a blocked band opens nothing', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await open(page);
    await expect(page.getByRole('heading', { level: 1, name: 'Chita Lake' })).toBeVisible();
    await expect(page.getByText('Calendar · adaugă la poartă')).toBeVisible();
    const legend = page.getByRole('list', { name: 'Legendă' });
    await expect(legend).toContainText('Liber');
    await expect(legend).toContainText('Indisponibil');
    await expect(legend).toContainText('Cabană');
    await expect(legend).not.toContainText('Doar telefonic');
    // Chita's lead is 24h: tomorrow's day slot is free and white for the operator, never yellow.
    await expect(grid(page).locator('button[data-status="too-soon"]')).toHaveCount(0);
    await expect(band(page, fx.inProgress.name, 1, '06–18')).toHaveAttribute('data-status', /available|booked|blocked/);
    // c5: the block is labelled («Test e2e calendar») — the angler's grid would explain it; here nothing.
    const blocked = band(page, fx.block.name, fx.block.day, '06–18');
    await expect(blocked).toHaveAttribute('data-status', 'blocked');
    await blocked.click();
    await page.waitForTimeout(600);
    await expect(page.locator('dialog[open]')).toHaveCount(0);
    await expect(panel(page)).toHaveCount(0);
    await expect(page.getByTestId('selection-empty')).toBeVisible();
    await expectNoA11yViolations(page);
    expect(errors).toEqual([]);
  });

  test('c3 c7: the slot running now is selectable until it ends, and its quote is a walk-in', async ({ page }) => {
    const bodies = quotes(page);
    await open(page);
    const cur = currentSlot();
    const b = band(page, fx.inProgress.name, cur.day, cur.label);
    await expect(b).toHaveAttribute('data-status', 'available');
    await b.click();
    const selected = grid(page).locator('button[data-status="selected"]');
    await expect(selected).toHaveCount(1);
    await expect(selected).toHaveAttribute('data-stand', fx.inProgress.stand);
    await expect(panel(page).getByRole('heading', { name: `Stand ${fx.inProgress.name}` })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`stand=${fx.inProgress.stand}`));
    // The real CMS quote, asked as a walk-in (no end-time rule) — never refused for having started.
    await expect.poll(() => bodies.length).toBeGreaterThan(0);
    expect(bodies.every((q) => q.walkIn === true)).toBe(true);
    expect(Date.parse(bodies[0].startDate)).toBe(cur.start.getTime());
    await expect(panel(page).getByTestId('selection-price')).toBeVisible({ timeout: 20_000 });
    await expect(panel(page).getByTestId('selection-refusal')).toHaveCount(0);
    // Priced and not refused: Continuă is held only for the steps still to ship (c9), said in the note.
    await expect(page.getByTestId('selection-continue-held')).toBeVisible();
  });

  test('c9 (held): Continuă never leads into a 404 — held with an honest note until the extras / review steps ship', async ({ page }) => {
    await open(page);
    const cur = currentSlot();
    await band(page, fx.plain.name, cur.day, cur.label).click();
    await expect(panel(page).getByTestId('selection-price')).toBeVisible({ timeout: 20_000 });
    const cont = page.getByTestId('selection-continue');
    await expect(cont).toHaveAttribute('aria-disabled', 'true');
    const note = page.getByTestId('selection-continue-held');
    await expect(note).toHaveText('Adăugarea la poartă se finalizează deocamdată din aplicația Bluvi.');
    await expect(cont).toHaveAccessibleDescription('Adăugarea la poartă se finalizează deocamdată din aplicația Bluvi.');
    const before = page.url();
    await cont.click({ force: true });
    await page.waitForTimeout(600);
    expect(page.url()).toBe(before);
    await expect(grid(page)).toBeVisible();
    await shot(page, 'continue-held');
    await expectNoA11yViolations(page);
  });

  // Re-enable when operator.calendar-extra / -confirmare ship (walkInFlow drops continueHeld): the
  // destination must RENDER its step, not only change the URL.
  test.fixme('c9: Continuă → …/calendar/confirmare («Confirmă rezervarea») for a stand with nothing to add, …/calendar/extra («Extra») for a night on a cabin stand', async ({ page }) => {
    await open(page);
    const cur = currentSlot();
    await band(page, fx.plain.name, cur.day, cur.label).click();
    await expect(panel(page).getByTestId('selection-price')).toBeVisible({ timeout: 20_000 });
    await page.getByTestId('selection-continue').click();
    await expect(page).toHaveURL(new RegExp(`^${esc(`${BASE_URL}${PATH}/confirmare?`)}stand=${fx.plain.stand}&start=`));
    await expect(page.getByRole('heading', { level: 1, name: 'Confirmă rezervarea' })).toBeVisible({ timeout: 45_000 });
    const r = new URL(page.url());
    expect(Date.parse(r.searchParams.get('start')!)).toBe(cur.start.getTime());
    expect(Date.parse(r.searchParams.get('end')!)).toBe(cur.end.getTime());
    expect(r.searchParams.getAll('extra')).toEqual([]);
    await open(page);
    const night = band(page, fx.cabin.name, 3, '18–06');
    await expect(night).toHaveAttribute('data-status', 'available');
    await night.click();
    await expect(panel(page).getByTestId('selection-price')).toBeVisible({ timeout: 20_000 });
    await page.getByTestId('selection-continue').click();
    await expect(page).toHaveURL(new RegExp(`^${esc(`${BASE_URL}${PATH}/extra?`)}stand=${fx.cabin.stand}&start=`));
    await expect(page.getByRole('heading', { level: 1, name: 'Extra' })).toBeVisible({ timeout: 45_000 });
  });

  test('c6: a booked band opens the operator booking detail (seeded from the list); busy while the list loads, opened when it lands; the open band is marked', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    const releaseList = await hold(page, LIST);
    // The detail's own GET is held too: what paints is the list row (the seed).
    const releaseDetail = await hold(page, new RegExp(`/api/cms/feed/bookings/${fx.walkIn.id}(\\?|$)`));
    await open(page);
    const booked = band(page, fx.walkIn.name, fx.walkIn.day, '06–18');
    await expect(booked).toHaveAttribute('data-status', 'booked');
    // The list is still loading: never «not found» — the band says it is busy, nothing opens yet…
    await booked.click();
    await expect(booked).toHaveAttribute('aria-busy', 'true');
    await page.waitForTimeout(600);
    await expect(anySurface(page)).toHaveCount(0);
    await expect(page).not.toHaveURL(/rezervare=/);
    // …and the tap is answered once the list lands.
    const listed = page.waitForResponse(LIST);
    releaseList();
    await listed;
    await expect(page).toHaveURL(new RegExp(`rezervare=${fx.walkIn.id}`));
    await expect(booked).not.toHaveAttribute('aria-busy', 'true');
    // The band whose booking is open is marked (ring + aria-current), no other.
    await expect(booked).toHaveAttribute('aria-current', 'true');
    await expect(grid(page).locator('button[aria-current="true"]')).toHaveCount(1);
    // From 1280 the detail docks in the right column, next to the grid (the grid stays usable).
    const docked = page.locator('aside[aria-labelledby]').filter({ has: page.getByRole('heading', { name: 'Detalii rezervare' }) });
    await expect(docked).toBeVisible();
    await expect(detail(page)).toHaveAttribute('data-booking', fx.walkIn.id);
    await expect(page.getByTestId('booking-detail-angler')).toHaveText('Calendar E2E');
    await expect(page.getByTestId('selection-empty')).toHaveCount(0);
    const g = (await grid(page).boundingBox())!;
    const d = (await docked.boundingBox())!;
    expect(d.x).toBeGreaterThanOrEqual(g.x + g.width);
    releaseDetail();
    await shot(page, 'detail-docked');
    await expectNoA11yViolations(page);
    // Closed with its X: the summary card is back, the URL loses ?rezervare.
    await docked.getByRole('button', { name: 'Închide' }).click();
    await expect(docked).toHaveCount(0);
    await expect(page).not.toHaveURL(/rezervare=/);
    await expect(page.getByTestId('selection-empty')).toBeVisible();
    await expect(grid(page).locator('button[aria-current="true"]')).toHaveCount(0);
    // A reload with ?rezervare= reopens it (by id).
    await booked.click();
    await expect(page).toHaveURL(/rezervare=/);
    await page.reload();
    await expect(page.getByTestId('booking-detail-angler')).toHaveText('Calendar E2E', { timeout: 20_000 });
    // Marked again once the list has the booking (by id, no seed).
    await expect(booked).toHaveAttribute('aria-current', 'true');
    expect(errors).toEqual([]);
  });

  test('c6 + c37: a selection and an open booking share the URL — the compact selection stays over the docked detail; reload, then Back clears the selection first', async ({ page }) => {
    await open(page);
    const cur = currentSlot();
    // The bare grid is the first entry; the first selection pushes its own.
    await band(page, fx.inProgress.name, cur.day, cur.label).click();
    await expect(page).toHaveURL(new RegExp(`stand=${fx.inProgress.stand}`));
    // Open a booking to compare: the selection survives (URL, pill, compact card with its actions).
    const booked = band(page, fx.walkIn.name, fx.walkIn.day, '06–18');
    await booked.click();
    await expect(page).toHaveURL(new RegExp(`rezervare=${fx.walkIn.id}`));
    await expect(page).toHaveURL(new RegExp(`stand=${fx.inProgress.stand}`));
    await expect(page.getByTestId('booking-detail-angler')).toHaveText('Calendar E2E');
    const summary = page.getByTestId('selection-summary');
    await expect(summary.getByRole('heading', { name: `Stand ${fx.inProgress.name}` })).toBeVisible();
    await expect(summary.getByRole('button', { name: 'Anulează' })).toBeVisible();
    await expect(summary.getByTestId('selection-summary-continue')).toHaveAttribute('aria-disabled', 'true');
    await expect(grid(page).locator('button[data-status="selected"]')).toHaveCount(1);
    await shot(page, 'selection-and-detail');
    await expectNoA11yViolations(page);
    // Selecting another cell keeps the open booking (the grid writes only its own keys).
    const other = grid(page).locator(`button[data-band][data-status="available"]:not([data-stand="${fx.inProgress.stand}"])`).first();
    const otherStand = (await other.getAttribute('data-stand'))!;
    await other.click();
    await expect(page).toHaveURL(new RegExp(`stand=${otherStand}.*rezervare=${fx.walkIn.id}`));
    await expect(page.getByTestId('booking-detail-angler')).toHaveText('Calendar E2E');
    // Reload: the selection's entry keeps its mark, so «Anulează selecția» steps BACK onto the bare
    // grid (a traversal: Forward returns to the selection) instead of replacing.
    await page.reload();
    await expect(grid(page)).toBeVisible({ timeout: 45_000 });
    await expect(page.getByTestId('booking-detail-angler')).toHaveText('Calendar E2E', { timeout: 20_000 });
    await page.getByRole('button', { name: 'Anulează selecția' }).click();
    await expect(page).toHaveURL(`${BASE_URL}${PATH}`);
    await expect(grid(page).locator('button[data-status="selected"]')).toHaveCount(0);
    await page.goForward();
    await expect(page).toHaveURL(new RegExp(`stand=${otherStand}.*rezervare=${fx.walkIn.id}`));
    await expect(grid(page).locator('button[data-status="selected"]')).toHaveCount(1);
    // The browser's Back clears the selection first, too.
    await page.goBack();
    await expect(page).toHaveURL(`${BASE_URL}${PATH}`);
    await expect(grid(page).locator('button[data-status="selected"]')).toHaveCount(0);
  });

  test('c6: the booking is on a later page of the list (latest-first) — read on to it, busy meanwhile', async ({ page }) => {
    // Page 1: a full page of bookings that all start after the tapped stay (none on its stand); page 2:
    // the stay. Rows are clones of the real walk-in row (the list's real shape), dated weeks ahead.
    type Row = Record<string, unknown> & { documentId: string };
    let walkRow: Row | null = null;
    let pageSize = 20;
    let page2Hits = 0;
    let releasePage2!: () => void;
    const gate2 = new Promise<void>((r) => (releasePage2 = r));
    await page.route(LIST, async (r) => {
      const url = new URL(r.request().url());
      if (Number(url.searchParams.get('page') ?? '1') <= 1) {
        const real = await r.fetch();
        const body = (await real.json()) as { data: Row[]; meta: Record<string, unknown> };
        // The real walk-in row, wherever the real list has it.
        for (let n = 1; n <= 30 && !walkRow; n++) {
          const u = new URL(url);
          u.searchParams.set('page', String(n));
          const rows = n === 1 ? body.data : ((await (await r.fetch({ url: u.toString() })).json()) as { data: Row[] }).data;
          walkRow = rows.find((b) => b.documentId === fx.walkIn.id) ?? null;
          if (!rows.length) break;
        }
        expect(walkRow, 'the e2e walk-in is on the real list').toBeTruthy();
        pageSize = Number(url.searchParams.get('pageSize') ?? pageSize);
        const later = Array.from({ length: pageSize }, (_, i) => ({
          ...walkRow!,
          documentId: `later${i}`,
          code: `LATER${i}`,
          startDate: dayAt(40 - i, 6).toISOString(),
          endDate: dayAt(40 - i, 18).toISOString(),
          stand: { documentId: fx.inProgress.stand, name: fx.inProgress.name },
        }));
        return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...body, data: later }) });
      }
      page2Hits++;
      await gate2;
      return r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [walkRow], meta: { page: 2, pageSize, pendingCount: 0 } }),
      });
    });
    const listed = page.waitForResponse(LIST);
    await open(page);
    await listed;
    const booked = band(page, fx.walkIn.name, fx.walkIn.day, '06–18');
    await booked.click();
    await expect.poll(() => page2Hits).toBe(1);
    await expect(booked).toHaveAttribute('aria-busy', 'true');
    await expect(anySurface(page)).toHaveCount(0);
    releasePage2();
    await expect(page).toHaveURL(new RegExp(`rezervare=${fx.walkIn.id}`));
    await expect(page.getByTestId('booking-detail-angler')).toHaveText('Calendar E2E');
    await expect(booked).toHaveAttribute('aria-current', 'true');
  });

  test('c6: below 1280 the detail is a dialog (768+) / a sheet (phone)', async ({ page }) => {
    for (const w of [1024, 375]) {
      await page.setViewportSize({ width: w, height: w < 768 ? 812 : 900 });
      await open(page);
      await band(page, fx.walkIn.name, fx.walkIn.day, '06–18').click();
      const surface = page.locator('dialog[open]');
      await expect(surface).toBeVisible();
      await expect(surface.getByTestId('booking-detail-angler')).toHaveText('Calendar E2E');
      await shot(page, 'detail');
      await expectNoA11yViolations(page);
      await page.keyboard.press('Escape');
      await expect(surface).toHaveCount(0);
      await expect(page).not.toHaveURL(/rezervare=/);
    }
  });

  test('c6: a booked band no booking of the list matches opens nothing, and says so', async ({ page }) => {
    await page.route(LIST, (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [], meta: { page: 1, pageSize: 20, pendingCount: 0 } }) })
    );
    const listed = page.waitForResponse(LIST);
    await open(page);
    await listed;
    const booked = band(page, fx.walkIn.name, fx.walkIn.day, '06–18');
    await expect(booked).toHaveAttribute('data-status', 'booked');
    await booked.click();
    await expect(page.getByText('Nu am găsit rezervarea — deschide Rezervări.')).toBeVisible();
    await expect(booked).not.toHaveAttribute('aria-busy', 'true');
    await expect(anySurface(page)).toHaveCount(0);
    await expect(page).not.toHaveURL(/rezervare=/);
  });

  test('operator.b.role-gating: the CMS refuses the lake\'s bookings (not this owner) → «Nu ai acces», no grid', async ({ page }) => {
    const errors = collectConsoleErrors(page, { ignore: EXPECTED_CONSOLE });
    await page.route(LIST, (r) =>
      r.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ data: null, error: { status: 403, name: 'ForbiddenError', message: 'Forbidden' } }) })
    );
    await signIn(page.context(), jwt);
    await page.goto(PATH);
    const alert = page.getByRole('alert').filter({ hasText: 'Nu ai acces' });
    await expect(alert).toBeVisible({ timeout: 45_000 });
    await expect(alert).toContainText('Contul tău nu are drepturi pentru aceste date.');
    await expect(alert.getByRole('button', { name: 'Încearcă din nou' })).toBeVisible();
    await expect(grid(page)).toHaveCount(0);
    await shot(page, 'forbidden');
    await expectNoA11yViolations(page);
    expect(errors).toEqual([]);
  });

  test('c8 c10: re-read on mount and on focus; the next month at the end; skeleton, then the error with «Încearcă din nou»', async ({ page }) => {
    const errors = collectConsoleErrors(page, { ignore: EXPECTED_CONSOLE });
    const froms: string[] = [];
    page.on('request', (r) => {
      if (r.method() === 'GET' && AVAIL.test(r.url())) froms.push(new URL(r.url()).searchParams.get('from') ?? '');
    });
    await open(page);
    const now = new Date();
    expect(froms[0]).toContain(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`);
    const before = froms.length;
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      window.dispatchEvent(new Event('visibilitychange'));
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      window.dispatchEvent(new Event('visibilitychange'));
    });
    await expect.poll(() => froms.length).toBeGreaterThan(before);
    // The next month near the end of the grid.
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    await scrollGridTo(page, 1e6);
    await expect.poll(() => froms.some((f) => f.startsWith(ymd(next)))).toBe(true);
    // A fresh mount (a return from a later step) reads again.
    const n = froms.length;
    await page.reload();
    await expect(grid(page)).toBeVisible();
    expect(froms.length).toBeGreaterThan(n);
    // Skeleton while the first page loads, then the failure with a retry.
    let ok = false;
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    await page.route(AVAIL, async (r) => {
      await gate;
      if (ok) return r.fallback();
      return r.fulfill({ status: 500, contentType: 'application/json', body: '{"error":{"status":500}}' });
    });
    await page.reload();
    await expect(page.getByTestId('availability-skeleton')).toHaveCount(1);
    await expect(page.getByRole('list', { name: 'Legendă' })).not.toContainText('Doar telefonic');
    await shot(page, 'skeleton');
    release();
    await expect(page.getByRole('alert').filter({ hasText: 'A apărut o eroare la încărcarea disponibilității.' })).toBeVisible({ timeout: 20_000 });
    await shot(page, 'error');
    await expectNoA11yViolations(page);
    ok = true;
    await page.getByTestId('availability-retry').click();
    await expect(grid(page)).toBeVisible({ timeout: 20_000 });
    expect(errors).toEqual([]);
  });

  test('c2 c11: Acasă «Calendar» opens it; Back first clears a selection, then leaves the flow (to the panel without history)', async ({ page }) => {
    await signIn(page.context(), jwt);
    await page.goto('/');
    // Acasă's «Bălțile mele» card: «Calendar» (and «Vezi grila» on a day with nothing tomorrow).
    const link = page.getByRole('link', { name: 'Calendar', exact: true }).and(page.locator(`a[href="${PATH}"]`)).first();
    await expect(link).toBeVisible({ timeout: 45_000 });
    await link.click();
    await expect(grid(page)).toBeVisible({ timeout: 45_000 });
    await expect(page).toHaveURL(new RegExp(`${esc(PATH)}$`));
    const cur = currentSlot();
    await band(page, fx.inProgress.name, cur.day, cur.label).click();
    await expect(panel(page)).toBeVisible();
    await page.getByRole('button', { name: 'Anulează selecția' }).click();
    await expect(panel(page)).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`${esc(PATH)}$`));
    await page.getByRole('button', { name: 'Înapoi' }).click();
    await expect(page).toHaveURL(`${BASE_URL}/`);
    // Opened straight (no history in this tab): Back goes to the lake's panel.
    const p2 = await page.context().newPage();
    await p2.goto(PATH);
    await expect(grid(p2)).toBeVisible({ timeout: 45_000 });
    await p2.getByRole('button', { name: 'Înapoi' }).click();
    await expect(p2).toHaveURL(`${BASE_URL}/operator/${LAKE}`);
    await p2.close();
  });

  test('keyboard: Tab into the grid, arrows move, Enter selects the slot running now', async ({ page }) => {
    await open(page);
    const cur = currentSlot();
    const target = band(page, fx.inProgress.name, cur.day, cur.label);
    await target.focus();
    await page.keyboard.press('Enter');
    await expect(grid(page).locator('button[data-status="selected"]')).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(grid(page).locator('button[data-status="selected"]')).not.toBeFocused();
    await page.keyboard.press('Enter');
    await expect(grid(page).locator('button[data-status="selected"]')).toHaveCount(1);
  });

  /* ----------------------------------------------------------------------------------------------
   * Every state at 375 / 1280 / 1440 / 1920
   * -------------------------------------------------------------------------------------------- */

  for (const w of WIDTHS) {
    test(`states at ${w}: grid, in-progress selection, booking detail`, async ({ page }) => {
      test.setTimeout(120_000);
      await page.setViewportSize({ width: w, height: w < 768 ? 812 : 900 });
      const errors = collectConsoleErrors(page);
      const listed = page.waitForResponse(LIST);
      await open(page);
      await listed;
      await shot(page, 'grid');
      await expectNoA11yViolations(page);
      const cur = currentSlot();
      await band(page, fx.inProgress.name, cur.day, cur.label).click();
      await expect(panel(page).getByTestId('selection-price')).toBeVisible({ timeout: 20_000 });
      await shot(page, 'selection');
      await expectNoA11yViolations(page);
      await panel(page).getByRole('button', { name: 'Anulează' }).click();
      await expect(panel(page)).toHaveCount(0);
      await band(page, fx.walkIn.name, fx.walkIn.day, '06–18').click();
      await expect(page.getByTestId('booking-detail-angler')).toHaveText('Calendar E2E');
      await shot(page, 'detail');
      expect(errors).toEqual([]);
    });
  }
});
