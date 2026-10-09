import { mkdirSync } from 'node:fs';
import { expect, test, type APIRequestContext, type Page, type Route } from '@playwright/test';
import { getOwnedLakes } from '@/core/booking';
import { getLakes } from '@/core/lakes';
import { createTestTransport } from '../transport';
import { expectNoA11yViolations } from './helpers/a11y';
import { BASE_URL } from './helpers/base-url';
import { collectConsoleErrors } from './helpers/console';
import { CMS, qaJwt, signIn } from './helpers/session';

/*
 * operator.calendar-extra (/operator/[lakeId]/calendar/extra, T4) — step 2 of the walk-in, fish
 * app/(app)/operator/[lakeId]/walk-in/extras.tsx: the angler's extras step (booking.rezerva-extra,
 * whose suite runs unchanged) mounted with the walk-in FlowConfig.
 *
 * Data: the QA user, signed in, owner of the LOCAL Chita Lake. The availability and the quote are the
 * real ones (read through /api/cms; the quote POST never writes): the spec finds a stand that sells
 * an extra (Chita's cabins, per night) free for a two-night tour, and asserts every quote body says
 * `walkIn: true`. Only the in-flight / refused states route-mock the quote. Role-gating uses a real
 * local lake the QA user does not own. NO writes: «Continuă»
 * only navigates (the confirmation step is operator.calendar-confirmare).
 */

process.env.TZ = 'Europe/Bucharest';
test.use({ timezoneId: 'Europe/Bucharest', locale: 'ro-RO' });

const LAKE = 's84u55lo4n9z0emngozttt6e'; // local Chita Lake
const GRID = `/operator/${LAKE}/calendar`;
const PATH = `${GRID}/extra`;
const REVIEW = `${GRID}/confirmare`;
const QUOTE = /\/api\/cms\/feed\/lakes\/[^/]+\/quote/;
const SHOTS = '.shots/operator-calendar-extra';
const WIDTHS = [375, 1280, 1440, 1920] as const;

/* ------------------------------------------------------------------------------------------------
 * Time (Europe/Bucharest wall clock)
 * ---------------------------------------------------------------------------------------------- */

const pad = (n: number) => String(n).padStart(2, '0');
function dayAt(offset: number, hour = 0): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  d.setHours(hour);
  return d;
}
function iso(d: Date): string {
  const off = -d.getTimezoneOffset();
  const s = off >= 0 ? '+' : '-';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00${s}${pad(Math.floor(Math.abs(off) / 60))}:${pad(Math.abs(off) % 60)}`;
}
const at = (offset: number, hour: number) => iso(dayAt(offset, hour));

/* ------------------------------------------------------------------------------------------------
 * The real availability: a stand with an extra, free for a two-night tour
 * ---------------------------------------------------------------------------------------------- */

type Extra = { key: string; label: string; price: number; unit: 'perNight' | 'perStay' };
type Stand = { documentId: string; name: string; extras: string[] };
type Interval = { standDocumentId: string | null; start: string; end: string };
type Sel = { stand: string; start: string; end: string };
type Pick = { sel: Sel; plain: Sel; standName: string; extra: Extra };

async function findTour(request: APIRequestContext): Promise<Pick> {
  // Days 4+ (another walk of the calendar suite books days 2–9 06–18 on plain stands only).
  for (let first = 4; first < 40; first += 2) {
    const start = at(first, 18);
    const end = at(first + 2, 18);
    const res = await request.get(`${CMS}/feed/lakes/${LAKE}/availability`, {
      params: { from: iso(dayAt(first - 1)), to: iso(dayAt(first + 4)) },
    });
    expect(res.ok(), 'local Chita availability').toBe(true);
    const av = (await res.json()).data as { stands: Stand[]; extras: Extra[]; bookings: Interval[]; blocks: Interval[] };
    const busy = (id: string) =>
      [...av.bookings, ...av.blocks].some(
        (b) => (b.standDocumentId === id || b.standDocumentId === null) && Date.parse(b.start) < Date.parse(end) && Date.parse(b.end) > Date.parse(start)
      );
    const stand = av.stands.find((s) => s.extras.length > 0 && !busy(s.documentId));
    const plain = av.stands.find((s) => s.extras.length === 0 && !busy(s.documentId));
    if (!stand || !plain) continue;
    return {
      sel: { stand: stand.documentId, start, end },
      plain: { stand: plain.documentId, start, end },
      standName: stand.name,
      extra: av.extras.find((e) => e.key === stand.extras[0])!,
    };
  }
  throw new Error('No free Chita stand with an extra in the next 40 days (local DB)');
}

const q = (sel: Sel, extras: string[] = []) => {
  const p = new URLSearchParams([
    ['stand', sel.stand],
    ['start', sel.start],
    ['end', sel.end],
  ]);
  for (const e of extras) p.append('extra', e);
  return `?${p}`;
};

/* ------------------------------------------------------------------------------------------------
 * Quote watch / mocks
 * ---------------------------------------------------------------------------------------------- */

type QuoteBody = { stand: string; startDate: string; endDate: string; extras: string[]; walkIn: boolean };
const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const priced = (tour: number, extras: { key: string; label: string; total: number; quantity: number; unitPrice: number }[] = []) => ({
  data: {
    total: tour + extras.reduce((s, e) => s + e.total, 0),
    basis: { durationHours: 48, rowLabel: null, composedFrom: [24, 24], tourPrice: tour, extras: extras.map((e) => ({ ...e, unit: 'perNight' })) },
    refusal: null,
  },
});
const refused = { data: { total: null, basis: null, refusal: { code: 'EXTRA_UNAVAILABLE', message: 'Cabana nu e disponibilă în această perioadă.' } } };

/** Records every quote body; `answer` may delay or refuse. Without it the real CMS answers. */
async function watchQuote(page: Page, answer?: (body: QuoteBody) => Promise<unknown> | unknown) {
  const bodies: QuoteBody[] = [];
  await page.route(QUOTE, async (route) => {
    const body = (route.request().postDataJSON() as { data: QuoteBody }).data;
    bodies.push(body);
    if (!answer) return route.continue();
    return json(route, await answer(body));
  });
  return bodies;
}

/* ------------------------------------------------------------------------------------------------
 * Page helpers
 * ---------------------------------------------------------------------------------------------- */

let jwt: string;
let tour: Pick;
test.beforeAll(async ({ request }) => {
  jwt = await qaJwt(request);
  tour = await findTour(request);
  mkdirSync(SHOTS, { recursive: true });
});

async function open(page: Page, query: string) {
  await signIn(page.context(), jwt);
  await page.goto(`${PATH}${query}`);
}
const card = (page: Page) => page.getByRole('checkbox', { name: new RegExp(tour.extra.label) });
const cardBox = (page: Page) => page.locator('label').filter({ has: card(page) });
const cont = (page: Page) => page.getByTestId('extras-continue');
const total = (page: Page) =>
  page.locator('section[aria-label="Rezumat"]:visible, [data-testid="extras-bar-total"]:visible').first();
const lei = (n: number) => new Intl.NumberFormat('ro-RO').format(n);

async function axe(page: Page) {
  await page.waitForTimeout(400);
  await expectNoA11yViolations(page);
}
async function shots(page: Page, name: string) {
  for (const w of WIDTHS) {
    await page.setViewportSize({ width: w, height: w < 768 ? 812 : 900 });
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${SHOTS}/${name}-${w}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
}

/* ------------------------------------------------------------------------------------------------
 * Signed out
 * ---------------------------------------------------------------------------------------------- */

test.describe('signed out', () => {
  test('operator.b.role-gating: a real 307 to /intra, returning here with the selection and the extras', async ({ request }) => {
    const res = await request.get(`${BASE_URL}${PATH}${q(tour.sel, [tour.extra.key])}`, { maxRedirects: 0 });
    expect(res.status()).toBe(307);
    const loc = new URL(res.headers().location, BASE_URL);
    expect(loc.pathname).toBe('/intra');
    const next = new URL(loc.searchParams.get('next')!, BASE_URL);
    expect(next.pathname).toBe(PATH);
    expect(next.searchParams.get('stand')).toBe(tour.sel.stand);
    expect(next.searchParams.getAll('extra')).toEqual([tour.extra.key]);
  });
});

/* ------------------------------------------------------------------------------------------------
 * Signed in (the lake's owner)
 * ---------------------------------------------------------------------------------------------- */

test.describe('signed in', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test('c1: a bare URL, a broken selection or a gone stand → the bare calendar; nothing to add → the calendar, selection kept', async ({ page }) => {
    await signIn(page.context(), jwt);
    // Direct link without a selection: the server redirects (no step is ever painted).
    await page.goto(PATH);
    await page.waitForURL((u) => u.pathname === GRID && !u.search, { timeout: 45_000 });
    await page.goto(`${PATH}?stand=${tour.sel.stand}&start=nope&end=${encodeURIComponent(tour.sel.end)}`);
    await page.waitForURL((u) => u.pathname === GRID && !u.searchParams.get('stand'));
    // A stand the lake does not have (judged against the live availability).
    await page.goto(`${PATH}${q({ ...tour.sel, stand: 'e2e-gone-stand' }, [tour.extra.key])}`);
    await page.waitForURL((u) => u.pathname === GRID && !u.searchParams.get('stand'));
    // A stand with nothing to add to this tour: the calendar with the selection kept, no extras.
    await page.goto(`${PATH}${q(tour.plain, [tour.extra.key])}`);
    await page.waitForURL((u) => u.pathname === GRID && u.searchParams.get('stand') === tour.plain.stand);
    expect(new URL(page.url()).searchParams.getAll('extra')).toEqual([]);
  });

  test('c2 c3: «Extra», the card, price × nights, real walk-in quotes on every toggle, Continuă → confirmare; axe; shots', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    const bodies = await watchQuote(page);
    await open(page, q(tour.sel));
    await expect(page.getByRole('heading', { level: 1, name: 'Extra' })).toBeVisible({ timeout: 45_000 });
    await expect(page.getByTestId('extras-subtitle')).toHaveText('Poți adăuga la rezervare, dacă vrei.');
    await expect(page).toHaveTitle(/Extra/);
    // The extras list (booking.rezerva-extra c4) and per-night pricing (c5): 2 nights.
    await expect(page.getByRole('checkbox')).toHaveCount(1);
    await expect(card(page)).not.toBeChecked();
    expect(tour.extra.unit).toBe('perNight');
    await expect(cardBox(page)).toContainText(`+${lei(tour.extra.price * 2)} lei`);
    await expect(cardBox(page)).toContainText(`${lei(tour.extra.price)} lei/noapte · 2 nopți`);
    // The bare tour, priced by the real CMS as a walk-in.
    await expect(cont(page)).not.toHaveAttribute('aria-disabled', 'true');
    const bare = Number((await total(page).locator('.t-display:visible').innerText()).replace(/\D/g, ''));
    expect(bare).toBeGreaterThan(0);
    expect(bodies.length).toBeGreaterThan(0);
    expect(bodies.at(-1)).toMatchObject({ stand: tour.sel.stand, extras: [], walkIn: true });
    await expect(page.locator('section[aria-label="Rezumat"]')).toContainText(`Standul${tour.standName}`);
    await axe(page);
    await shots(page, 'none-selected');

    // c6 (inherited): the toggle re-quotes with the extra, still a walk-in.
    await card(page).focus();
    await page.keyboard.press('Space');
    await expect(card(page)).toBeChecked();
    await expect.poll(() => bodies.at(-1)?.extras).toEqual([tour.extra.key]);
    expect(bodies.every((b) => b.walkIn === true)).toBe(true);
    await expect(total(page)).toContainText(`${lei(bare + tour.extra.price * 2)} lei`);
    await expect(page.locator('section[aria-label="Rezumat"]')).toContainText(tour.extra.label);
    expect(new URL(page.url()).pathname).toBe(PATH);
    expect(new URL(page.url()).searchParams.getAll('extra')).toEqual([tour.extra.key]);
    await expect(cont(page)).not.toHaveAttribute('aria-disabled', 'true');
    await axe(page);
    await shots(page, 'priced-per-night');
    expect(errors).toEqual([]);

    // c3: Continuă (keyboard) → the walk-in's confirmation with the selection and the extras.
    await cont(page).focus();
    await page.keyboard.press('Enter');
    await page.waitForURL((u) => u.pathname === REVIEW);
    const u = new URL(page.url());
    expect(u.searchParams.get('stand')).toBe(tour.sel.stand);
    expect(Date.parse(u.searchParams.get('start')!)).toBe(Date.parse(tour.sel.start));
    expect(u.searchParams.getAll('extra')).toEqual([tour.extra.key]);
  });

  test('c3: Continuă held while re-quoting and when refused; shots', async ({ page }) => {
    let mode: 'hang' | 'refuse' | 'ok' = 'ok';
    let release: () => void = () => {};
    const bodies = await watchQuote(page, async (body) => {
      if (body.extras.length === 0) return priced(200);
      if (mode === 'hang') await new Promise<void>((r) => (release = r));
      if (mode === 'refuse') return refused;
      return priced(200, [{ key: tour.extra.key, label: tour.extra.label, total: 300, quantity: 2, unitPrice: 150 }]);
    });
    await open(page, q(tour.sel));
    await expect(total(page)).toContainText('200 lei', { timeout: 45_000 });
    await expect(cont(page)).not.toHaveAttribute('aria-disabled', 'true');

    // Re-quoting: «Calculăm prețul…», Continuă held — a click goes nowhere.
    mode = 'hang';
    await cardBox(page).click();
    await expect(total(page)).toContainText('Calculăm prețul…');
    await expect(cont(page)).toHaveAttribute('aria-disabled', 'true');
    await cont(page).dispatchEvent('click');
    await page.waitForTimeout(200);
    expect(new URL(page.url()).pathname).toBe(PATH);
    await shots(page, 'requote-in-flight');
    release();
    await expect(total(page)).toContainText('500 lei');
    await expect(cont(page)).not.toHaveAttribute('aria-disabled', 'true');

    // Refused (no priced quote): the server's sentence, Continuă held.
    mode = 'refuse';
    await page.goto(`${PATH}${q(tour.sel, [tour.extra.key])}`);
    await expect(page.getByRole('alert').filter({ hasText: 'Cabana nu e disponibilă în această perioadă.' })).toBeVisible();
    await expect(cont(page)).toHaveAttribute('aria-disabled', 'true');
    await expect(total(page)).toContainText('Indisponibil');
    await axe(page);
    await shots(page, 'refused');
    expect(bodies.every((b) => b.walkIn === true)).toBe(true);
  });

  test('c4: from the calendar (Continuă), Back pops onto the calendar\'s entry — same document, no new history entry; selection kept, extras cleared', async ({ page }) => {
    await watchQuote(page, (b) => (b.extras.length ? priced(500) : priced(200)));
    await signIn(page.context(), jwt);
    // The real path: the calendar with the cabin tour selected, its own «Continuă» (operator.calendar.c9).
    await page.goto(`${GRID}${q(tour.sel)}`);
    await expect(page.getByTestId('availability-grid')).toBeVisible({ timeout: 45_000 });
    const calendarUrl = page.url();
    await expect(page.getByTestId('selection-continue')).not.toHaveAttribute('aria-disabled', 'true', { timeout: 20_000 });
    // A marker on this document: a full load (a replace into a new document, a reload) would drop it.
    await page.evaluate(() => ((window as unknown as { __e2eDoc?: string }).__e2eDoc = 'calendar'));
    const lengthOnCalendar = await page.evaluate(() => history.length);
    await page.getByTestId('selection-continue').click();
    await page.waitForURL((u) => u.pathname === PATH);
    await expect(page.getByRole('heading', { level: 1, name: 'Extra' })).toBeVisible({ timeout: 45_000 });
    expect(await page.evaluate(() => history.length)).toBe(lengthOnCalendar + 1);
    await cardBox(page).click();
    await expect.poll(() => new URL(page.url()).searchParams.getAll('extra')).toEqual([tour.extra.key]);
    // Header back: a pop (history.go), not a replace — the history keeps one calendar entry.
    await page.getByRole('button', { name: 'Înapoi la selecție' }).click();
    await page.waitForURL((u) => u.pathname === GRID);
    expect(page.url()).toBe(calendarUrl);
    const u = new URL(page.url());
    expect(u.searchParams.get('stand')).toBe(tour.sel.stand);
    expect(u.searchParams.getAll('extra')).toEqual([]);
    await expect(page.getByTestId('availability-grid')).toBeVisible();
    expect(await page.evaluate(() => history.length)).toBe(lengthOnCalendar + 1);
    expect(await page.evaluate(() => (window as unknown as { __e2eDoc?: string }).__e2eDoc)).toBe('calendar');
    // Forward is still the extras step (a pop leaves the entry after it; a replace would not).
    await page.goForward();
    await page.waitForURL((u2) => u2.pathname === PATH);
  });

  test('c4: opened directly (a shared link), Back opens the calendar in its place — selection kept, extras cleared, no new history entry', async ({ page }) => {
    await watchQuote(page, (b) => (b.extras.length ? priced(500) : priced(200)));
    await signIn(page.context(), jwt);
    await page.goto(`${PATH}${q(tour.sel, [tour.extra.key])}`);
    await expect(card(page)).toBeChecked({ timeout: 45_000 });
    const length = await page.evaluate(() => history.length);
    await page.getByRole('button', { name: 'Înapoi', exact: true }).click();
    await page.waitForURL((u) => u.pathname === GRID);
    const u = new URL(page.url());
    expect(u.searchParams.get('stand')).toBe(tour.sel.stand);
    expect(Date.parse(u.searchParams.get('end')!)).toBe(Date.parse(tour.sel.end));
    expect(u.searchParams.getAll('extra')).toEqual([]);
    await expect(page.getByTestId('availability-grid')).toBeVisible({ timeout: 45_000 });
    expect(await page.evaluate(() => history.length)).toBe(length);
  });

  test('operator.b.role-gating: signed in but not the lake\'s owner → «Nu ai acces» in the step\'s frame; no extras, no Continuă, no quote', async ({ page }) => {
    const t = createTestTransport(jwt);
    const owned = new Set((await getOwnedLakes(t)).map((l) => l.documentId));
    const foreign = (await getLakes(t, { pageSize: 50 })).data.find((l) => !owned.has(l.documentId));
    expect(foreign, 'a local lake the QA user does not own').toBeTruthy();
    const errors = collectConsoleErrors(page);
    const bodies = await watchQuote(page, () => priced(200));
    await signIn(page.context(), jwt);
    await page.goto(`/operator/${foreign!.documentId}/calendar/extra${q(tour.sel, [tour.extra.key])}`);
    await expect(page.getByText('Nu ai acces', { exact: true })).toBeVisible({ timeout: 45_000 });
    await expect(page.getByRole('heading', { level: 1, name: 'Extra' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Înapoi la calendar' })).toHaveAttribute('href', `/operator/${foreign!.documentId}/calendar`);
    await expect(page.getByRole('checkbox')).toHaveCount(0);
    await expect(cont(page)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Deconectează-te' })).toHaveCount(0);
    await page.waitForTimeout(600);
    expect(bodies).toEqual([]);
    await axe(page);
    await shots(page, 'not-owned');
    expect(errors).toEqual([]);
  });
});
