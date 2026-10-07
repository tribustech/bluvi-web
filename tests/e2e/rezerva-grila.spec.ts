import { expect, test, type Page, type Route } from '@playwright/test';
import { expectNoA11yViolations } from './helpers/a11y';
import { BASE_URL } from './helpers/base-url';
import { collectConsoleErrors } from './helpers/console';
import { qaJwt, signIn } from './helpers/session';

/*
 * booking.rezerva-grila (/balti/[id]/rezerva, T4) — fish app/(app)/book-lake/[lakeId]/index.tsx +
 * features/lakes/booking/* — plus booking.b.flow-state, b.live-availability, b.lead-time, b.timezone.
 *
 * Data: the QA user, signed in, on the LOCAL Chita Lake (its name, its offline payment mode and its
 * empty contact list come from the real `/feed/lakes/:id`; the dev-only fault switch adds a phone for
 * c16). The availability and the quote are read in the BROWSER through /api/cms, so they are route-
 * mocked here: every state is built relative to today (Europe/Bucharest), which the local DB cannot
 * offer on demand (a booking with initials, a labelled block, a competition, a refusal, a failure).
 * NO writes: the page never books (Continuă only navigates; its targets ship in M3-B2, so only the
 * URL is asserted). LAKE_ON_WEB.booking is still off: the URL is opened directly.
 */

process.env.TZ = 'Europe/Bucharest';
test.use({ timezoneId: 'Europe/Bucharest', locale: 'ro-RO' });

const LAKE = 's84u55lo4n9z0emngozttt6e';
const PATH = `/balti/${LAKE}/rezerva`;
const AVAIL = /\/api\/cms\/feed\/lakes\/[^/]+\/availability/;
const QUOTE = /\/api\/cms\/feed\/lakes\/[^/]+\/quote/;
const COMPETITION = 'k7pdveb49ynob26xjyx4gyy0';
const SHOTS = '.shots/rezerva-grila';
const WIDTHS = [375, 1280, 1440, 1920] as const;
/** The mocked 500s (error states) are logged by the browser. */
const EXPECTED_CONSOLE = [/Failed to load resource: the server responded with a status of 500/];

/* ------------------------------------------------------------------------------------------------
 * Time helpers (Europe/Bucharest wall clock, like the grid)
 * ---------------------------------------------------------------------------------------------- */

const pad = (n: number) => String(n).padStart(2, '0');
const WD = ['Duminică', 'Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă'];
const WD_SHORT = ['Du', 'Lu', 'Ma', 'Mi', 'Jo', 'Vi', 'Sâ'];
const MO = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'noi', 'dec'];
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
/** «Sâmbătă 10 oct» — the day pill. */
const pill = (offset: number) => {
  const d = dayAt(offset);
  return `${WD[d.getDay()]} ${d.getDate()} ${MO[d.getMonth()]}`;
};
/** «Sâmbătă, 10 oct · 06:00» — formatBookingPoint. */
const point = (d: Date) => `${WD[d.getDay()]}, ${d.getDate()} ${MO[d.getMonth()]} · ${pad(d.getHours())}:${pad(d.getMinutes())}`;
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* ------------------------------------------------------------------------------------------------
 * Availability fixture: 14 stands, the cases on days +3 … +5 (always past the 48h lead used here)
 *   stand 1: free; a lake-wide competition on day +5 (06:00 → day +6 06:00)
 *   stand 2: has the per-night cabin extra
 *   stand 3: booked day +3 06–18 by «AP» and day +8 06–18 by «MC»
 *   stand 4: a plain maintenance block day +3 06:00 → day +4 06:00 (nothing to say)
 *   stand 5: a labelled block day +3 06–18 «Reparăm pontonul»
 *   stand 6: booked AND blocked on day +3 06–18 (the block wins)
 * ---------------------------------------------------------------------------------------------- */

type Fixture = {
  bookingEnabled?: boolean;
  stands?: number;
  leadHours?: number | undefined;
  incrementHours?: number;
  slotStartTimes?: string[];
  checkoutBufferMinutes?: number;
};
const standId = (n: number) => `e2estand${pad(n)}`;
function availability(from: string, to: string, f: Fixture = {}) {
  const n = f.stands ?? 14;
  const body: Record<string, unknown> = {
    lakeId: LAKE,
    bookingEnabled: f.bookingEnabled ?? true,
    incrementHours: f.incrementHours ?? 12,
    checkoutBufferMinutes: f.checkoutBufferMinutes ?? 30,
    slotStartTimes: f.slotStartTimes ?? ['06:00', '18:00'],
    forbiddenEndTimes: [],
    minDurationHours: 12,
    timezone: 'Europe/Bucharest',
    stands: Array.from({ length: n }, (_, i) => ({
      documentId: standId(i + 1),
      name: String(i + 1),
      coordinates: null,
      extras: i + 1 === 2 ? ['cabana'] : [],
    })),
    extras: [{ key: 'cabana', label: 'Cabană', price: 150, unit: 'perNight' }],
    bookings: [
      { standDocumentId: standId(3), start: at(3, 6), end: at(3, 18), initials: 'AP' },
      { standDocumentId: standId(3), start: at(8, 6), end: at(8, 18), initials: 'MC' },
      { standDocumentId: standId(6), start: at(3, 6), end: at(3, 18), initials: 'ZZ' },
    ],
    blocks: [
      { standDocumentId: standId(4), start: at(3, 6), end: at(4, 6), reason: 'maintenance', label: null, competitionId: null },
      { standDocumentId: standId(5), start: at(3, 6), end: at(3, 18), reason: 'other', label: 'Reparăm pontonul', competitionId: null },
      { standDocumentId: standId(6), start: at(3, 6), end: at(3, 18), reason: 'closure', label: 'Închis', competitionId: null },
      { standDocumentId: null, start: at(5, 6), end: at(6, 6), reason: 'competition', label: 'Cupa Bluvi', competitionId: COMPETITION },
    ],
    window: { from, to },
  };
  if (f.leadHours !== undefined) body.leadHours = f.leadHours;
  return body;
}

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

type AvailOpts = Fixture & {
  /** Answer page `i` (0 = the current month) with this instead. */
  page?: (i: number, route: Route, from: string, to: string) => Promise<void> | void;
};
/** Mocks the availability; returns the requested windows (`from`) in order. */
async function mockAvailability(page: Page, opts: AvailOpts = { leadHours: 48 }) {
  const seen: string[] = [];
  const firsts: string[] = [];
  await page.route(AVAIL, async (route) => {
    const url = new URL(route.request().url());
    const from = url.searchParams.get('from') ?? '';
    let to = url.searchParams.get('to') ?? '';
    seen.push(from);
    if (!firsts.includes(from)) firsts.push(from);
    const i = firsts.indexOf(from);
    // The current month's page always reaches 12 days ahead, so the cases exist on any date.
    if (i === 0 && Date.parse(to) < dayAt(12).getTime()) to = iso(dayAt(12));
    if (opts.page) return opts.page(i, route, from, to);
    return json(route, { data: availability(from, to, opts) });
  });
  return seen;
}

const priced = (total = 300, rowLabel: string | null = 'Tur 12h') => ({
  data: { total, basis: { durationHours: 12, rowLabel, composedFrom: [12], tourPrice: total, extras: [] }, refusal: null },
});
const refused = { data: { total: null, basis: null, refusal: { code: 'END_TIME', message: 'Balta nu permite plecarea la 06:00.' } } };

/** Mocks the quote; returns the request bodies. */
async function mockQuote(page: Page, answer: (body: QuoteBody, n: number) => Promise<unknown> | unknown = () => priced()) {
  const bodies: QuoteBody[] = [];
  await page.route(QUOTE, async (route) => {
    const body = route.request().postDataJSON() as { data: QuoteBody };
    bodies.push(body.data);
    const a = await answer(body.data, bodies.length);
    if (a === 500) return json(route, { error: { status: 500, message: 'boom' } }, 500);
    return json(route, a);
  });
  return bodies;
}
type QuoteBody = { stand: string; startDate: string; endDate: string; extras: string[]; walkIn: boolean };

/* ------------------------------------------------------------------------------------------------
 * Page helpers
 * ---------------------------------------------------------------------------------------------- */

let jwt: string;
test.beforeAll(async ({ request }) => {
  jwt = await qaJwt(request);
});

async function open(page: Page, query = '') {
  await signIn(page.context(), jwt);
  await page.goto(`${PATH}${query}`);
}
const grid = (page: Page) => page.getByTestId('availability-grid');
const scroller = (page: Page) => grid(page).locator('> div').first();
/** A band by stand name, day offset and interval («06–18»): its accessible name starts with them. */
const band = (page: Page, stand: number, day: number, interval: string) =>
  grid(page).getByRole('button', { name: new RegExp(`^${stand}, ${esc(pill(day))} ${esc(interval)}(,|$)`) });
/** The run that starts on that day for the stand (a block, a booking), whatever its interval. */
const runOn = (page: Page, stand: number, day: number) =>
  grid(page).getByRole('button', { name: new RegExp(`^${stand}, ${esc(pill(day))} `) }).first();
const dayPill = (page: Page, day: number) => grid(page).getByRole('button', { name: `${pill(day)}, selectează toată ziua` });
const panel = (page: Page) => page.locator('[data-testid="selection-panel"], [data-testid="selection-card"]').filter({ has: page.getByTestId('selection-start') });
const alertToast = (page: Page, text: string) => page.getByRole('alert').filter({ hasText: text });

async function scrollGridTo(page: Page, x?: number, y?: number) {
  await scroller(page).evaluate(
    (el, { x, y }) => {
      if (x !== undefined) el.scrollLeft = x;
      if (y !== undefined) el.scrollTop = y;
      el.dispatchEvent(new Event('scroll'));
    },
    { x, y }
  );
}

async function shot(page: Page, name: string) {
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${SHOTS}/${name}-${page.viewportSize()?.width}.png` });
}

/* ------------------------------------------------------------------------------------------------
 * Signed out
 * ---------------------------------------------------------------------------------------------- */

test.describe('signed out', () => {
  test('c1 / booking.b.sign-in-gate: a real 307 to /intra, returning here with the selection', async ({ request }) => {
    const q = `?stand=s1&start=${encodeURIComponent(at(3, 6))}&end=${encodeURIComponent(at(3, 18))}`;
    const res = await request.get(`${BASE_URL}${PATH}${q}`, { maxRedirects: 0 });
    expect(res.status()).toBe(307);
    const loc = new URL(res.headers().location, BASE_URL);
    expect(loc.pathname).toBe('/intra');
    const next = loc.searchParams.get('next')!;
    expect(next.startsWith(PATH)).toBe(true);
    expect(new URL(next, BASE_URL).searchParams.get('stand')).toBe('s1');
  });
});

/* ------------------------------------------------------------------------------------------------
 * Signed in
 * ---------------------------------------------------------------------------------------------- */

test.describe('signed in', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      const w = window as unknown as { __events: { name: string; params: Record<string, unknown> }[] };
      w.__events = [];
      window.addEventListener('bluvi:analytics', (e) => w.__events.push((e as CustomEvent).detail));
    });
  });

  test('c3 c4 c8 c10 c11 c13 c25 c38: header, legend, frozen «Stand» column, day pills, slot chips, the looks', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await mockAvailability(page);
    await mockQuote(page);
    await open(page);
    // c3: back, the lake's name (from the cached lake), «Azi».
    await expect(page.getByRole('heading', { level: 1, name: 'Chita Lake' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Înapoi' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Mergi la ziua de azi' })).toHaveText('Azi');
    // c4: the legend.
    const legend = page.getByRole('list', { name: 'Legendă' });
    for (const l of ['Liber', 'Indisponibil', 'Doar telefonic', 'Cabană']) await expect(legend).toContainText(l);
    await expect(grid(page)).toBeVisible();
    // c8: the first column is yesterday; c10: day pills «Sâmbătă 15 aug», a frozen «Stand» column.
    const pills = grid(page).locator('button[data-day]');
    await expect(pills.first()).toHaveAttribute('aria-label', `${pill(-1)}, selectează toată ziua`);
    await expect(dayPill(page, 3)).toHaveText(pill(3));
    await expect(grid(page).getByText('Stand', { exact: true })).toBeVisible();
    await expect(grid(page).locator('[data-row]')).toHaveCount(14);
    // The cabin mark only on the stand with extras.
    await expect(grid(page).getByRole('group', { name: 'Stand 2, cu cabană' }).getByTestId('stand-extras-mark')).toHaveCount(1);
    await expect(grid(page).getByTestId('stand-extras-mark')).toHaveCount(1);
    // c11: «06–18» with a sun, «18–06» with a moon.
    const chips = grid(page).locator('[data-chip]');
    await expect(chips.filter({ hasText: '06–18' }).first().locator('[data-glyph="sun"]')).toHaveCount(1);
    await expect(chips.filter({ hasText: '18–06' }).first().locator('[data-glyph="moon"]')).toHaveCount(1);
    // c13: booked shows initials; blocked/booked are one red look; a competition carries a trophy and is one run.
    await expect(band(page, 3, 3, '06–18')).toHaveText('AP');
    await expect(band(page, 3, 3, '06–18')).toHaveAttribute('data-status', 'booked');
    const comp = grid(page).locator(`button[data-stand="${standId(1)}"][data-status="blocked"]`);
    await expect(comp).toHaveCount(1);
    await expect(comp.locator('svg')).toHaveCount(1);
    // c12: a block on that stand wins over its booking.
    await expect(band(page, 6, 3, '06–18')).toHaveAttribute('data-status', 'blocked');
    await expect(band(page, 6, 3, '06–18')).toHaveAttribute('aria-label', `6, ${pill(3)} 06–18, indisponibil, Închis`);
    await expect(grid(page).locator(`button[data-stand="${standId(6)}"][data-status="booked"]`)).toHaveCount(0);
    // c25: accessible names and the selected state; past and lead-time cells say what they are.
    await expect(band(page, 1, 3, '06–18')).toHaveAttribute('aria-label', `1, ${pill(3)} 06–18, disponibil`);
    await expect(band(page, 1, 3, '06–18')).toHaveAttribute('aria-pressed', 'false');
    await expect(band(page, 1, -1, '06–18')).toHaveAttribute('aria-label', `1, ${pill(-1)} 06–18, trecut`);
    await expect(band(page, 1, 1, '06–18')).toHaveAttribute('aria-label', `1, ${pill(1)} 06–18, disponibil, doar telefonic`);
    await expect(band(page, 1, 1, '06–18')).toHaveAttribute('data-status', 'too-soon');
    // c38: no viewer chip.
    await expect(page.getByText(/privesc acum/)).toHaveCount(0);
    // c23: the right-edge fade is always there; no chevron without a selection.
    await expect(grid(page).getByTestId('grid-edge-hint')).not.toHaveAttribute('data-visible', /.*/);
    await expectNoA11yViolations(page);
    expect(errors).toEqual([]);
  });

  test('c11: a 24h slot reads «24h · 06:00 → 06:00», no glyph; the sun / moon drop on a narrow column', async ({ page }) => {
    await mockAvailability(page, { leadHours: 48, incrementHours: 24, slotStartTimes: ['06:00'] });
    await mockQuote(page);
    await open(page);
    const chip = grid(page).locator('[data-chip]').filter({ hasText: '24h · 06:00 → 06:00' }).first();
    await expect(chip).toBeVisible();
    await expect(chip.locator('[data-glyph]')).toHaveCount(0);
  });

  test('owner rule 3 / c10: the day header stays on the grid\'s top edge and the stand column on its left, at every scroll position', async ({ page }) => {
    for (const w of [375, 1440]) {
      await page.setViewportSize({ width: w, height: 700 });
      await mockAvailability(page);
      await mockQuote(page);
      await open(page);
      await expect(grid(page)).toBeVisible();
      const box = (await scroller(page).boundingBox())!;
      for (const [x, y] of [[0, 0], [400, 200], [1200, 500], [2000, 9999]] as const) {
        await scrollGridTo(page, x, y);
        const header = (await grid(page).locator('button[data-day]').first().evaluate((el) => el.parentElement!.parentElement!.getBoundingClientRect().top))!;
        expect(Math.abs(header - box.y), `header top at scroll ${x},${y} (${w})`).toBeLessThanOrEqual(1);
        const name = (await grid(page).locator('[data-row] > div:first-child').first().boundingBox());
        if (name) expect(Math.abs(name.x - box.x), `stand column left at ${x},${y} (${w})`).toBeLessThanOrEqual(1);
      }
      await page.unrouteAll({ behavior: 'ignoreErrors' });
    }
  });

  test('c6 c7 c9 / booking.b.live-availability: month pages through /api/cms, re-read on mount and on focus, the next month near the end', async ({ page }) => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const seen = await mockAvailability(page, {
      leadHours: 48,
      page: async (i, route, from, to) => {
        if (i === 1) await gate;
        return json(route, { data: availability(from, to, { leadHours: 48 }) });
      },
    });
    await mockQuote(page);
    await open(page);
    await expect(grid(page)).toBeVisible();
    // c6: page 0 is the current calendar month (lake zone = here).
    const now = new Date();
    expect(seen[0]).toBe(iso(new Date(now.getFullYear(), now.getMonth(), 1)));
    // Never in the HTML: the server render carries no availability.
    const html = await (await page.request.get(`${BASE_URL}${PATH}`, { headers: { cookie: `bluvi_session=${jwt}` } })).text();
    expect(html).not.toContain('slotStartTimes');
    // c7: back on the window → read again.
    const before = seen.length;
    // react-query's focus manager listens for `visibilitychange` on window.
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      window.dispatchEvent(new Event('visibilitychange'));
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      window.dispatchEvent(new Event('visibilitychange'));
    });
    await expect.poll(() => seen.length).toBeGreaterThan(before);
    // c9: near the end → the next month, with a placeholder column and a spinner until it lands.
    await scrollGridTo(page, 1e6);
    await expect(grid(page).getByTestId('grid-next-placeholder')).toBeVisible();
    await expect(grid(page).getByTestId('grid-next-spinner')).toBeVisible();
    // The incoming column sits past the loaded end: one more scroll brings it into view.
    await scrollGridTo(page, 1e6);
    await expect(grid(page).getByTestId('grid-next-spinner')).toBeInViewport();
    await shot(page, 'next-month-loading');
    const nextMonth = iso(new Date(now.getFullYear(), now.getMonth() + 1, 1));
    expect(seen).toContain(nextMonth);
    const width = await scroller(page).evaluate((el) => el.scrollWidth);
    release();
    await expect(grid(page).getByTestId('grid-next-placeholder')).toHaveCount(0);
    await expect.poll(() => scroller(page).evaluate((el) => el.scrollWidth)).toBeGreaterThan(width);
    // c7: a fresh mount (a return from a later step) reads again.
    const n = seen.length;
    await page.reload();
    await expect(grid(page)).toBeVisible();
    expect(seen.length).toBeGreaterThan(n);
  });

  test('c14 c15 c16 / booking.b.lead-time: past → toast; inside the lead time → «Rezervare din scurt», call only with a phone', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await mockAvailability(page);
    await mockQuote(page);
    await open(page);
    await band(page, 1, -1, '06–18').click();
    await expect(alertToast(page, 'Interval trecut — alege o zi viitoare.')).toBeVisible();
    await expect(panel(page)).toHaveCount(0);
    await band(page, 1, 1, '06–18').click();
    const dialog = page.getByRole('dialog', { name: 'Rezervare din scurt' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(
      'Rezervările care încep în mai puțin de 48 de ore nu se pot face din aplicație — administratorul are nevoie de timp să confirme. Sună-l direct pentru un loc pe termen scurt.'
    );
    // Chita has no contact phone locally: no call.
    await expect(dialog.getByRole('link', { name: 'Sună administratorul' })).toHaveCount(0);
    await shot(page, 'too-soon');
    await expectNoA11yViolations(page);
    await dialog.getByRole('button', { name: 'Am înțeles' }).click();
    await expect(dialog).toBeHidden();
    await expect(panel(page)).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('c16: with a lake phone, «Sună administratorul» is a tel: link that logs contact_pressed; the lead defaults to 24h', async ({ page }) => {
    const fault = (faults: string[]) => page.request.post(`${BASE_URL}/balti/${LAKE}/e2e-fault`, { data: { faults } });
    expect((await fault(['with-phone'])).ok()).toBeTruthy();
    try {
      // No leadHours from the backend → 24 (BOOKING_LEAD_HOURS).
      await mockAvailability(page, { leadHours: undefined });
      await mockQuote(page);
      await open(page);
      // Today's evening slot is inside 24h whatever the hour (it starts within 24h, or has started).
      const soon = grid(page).locator(`button[data-stand="${standId(1)}"][data-status="too-soon"]`).first();
      await soon.click();
      const dialog = page.getByRole('dialog', { name: 'Rezervare din scurt' });
      await expect(dialog).toContainText('mai puțin de 24 de ore');
      const call = dialog.getByRole('link', { name: 'Sună administratorul' });
      await expect(call).toHaveAttribute('href', 'tel:0700 000 000');
      await page.evaluate(() =>
        document.addEventListener('click', (e) => (e.target as Element).closest('a[href^="tel:"]') && e.preventDefault(), true)
      );
      await call.click();
      const events = await page.evaluate(() => (window as unknown as { __events: { name: string; params: Record<string, unknown> }[] }).__events);
      expect(events).toContainEqual({
        name: 'contact_pressed',
        params: { contact_type: 'Lake too soon contact', lake_id: LAKE, lake_name: 'Chita Lake' },
      });
    } finally {
      await fault([]);
    }
  });

  test('c17 c18: a competition / a labelled block explain themselves; booked and plain blocks say nothing', async ({ page }) => {
    await mockAvailability(page);
    await mockQuote(page);
    await open(page);
    // c18: booked, plain block → nothing opens, nothing is selected.
    await band(page, 3, 3, '06–18').click();
    await runOn(page, 4, 3).click();
    await expect(runOn(page, 4, 3)).toHaveAttribute('data-status', 'blocked');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(panel(page)).toHaveCount(0);
    await expect(page.getByRole('alert').filter({ hasText: /\S/ })).toHaveCount(0);
    // c17: a labelled operator block.
    await runOn(page, 5, 3).click();
    let dialog = page.getByRole('dialog', { name: 'Reparăm pontonul' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(`Indisponibil între ${dayAt(3).getDate()} ${MO[dayAt(3).getMonth()]}, 06:00 și ${dayAt(3).getDate()} ${MO[dayAt(3).getMonth()]}, 18:00.`);
    await expect(dialog.getByRole('link', { name: 'Vezi concursul' })).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Am înțeles' }).click();
    await expect(dialog).toBeHidden();
    // c17: the competition — trophy, «Concurs», the whole-lake sentence, «Vezi concursul».
    await grid(page).locator(`button[data-stand="${standId(2)}"][data-status="blocked"]`).click();
    dialog = page.getByRole('dialog', { name: 'Cupa Bluvi' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Concurs');
    const d5 = dayAt(5);
    const d6 = dayAt(6);
    await expect(dialog).toContainText(
      `Balta e rezervată integral pentru concurs, toate standurile, între ${d5.getDate()} ${MO[d5.getMonth()]}, 06:00 și ${d6.getDate()} ${MO[d6.getMonth()]}, 06:00.`
    );
    await shot(page, 'competition-block');
    await expectNoA11yViolations(page);
    await dialog.getByRole('link', { name: 'Vezi concursul' }).click();
    await expect(page).toHaveURL(new RegExp(`/concursuri/${COMPETITION}$`));
  });

  test('c19 c21 c36: one stand, one contiguous run — extend, collapse, toggle off, restart; the run is one indigo pill', async ({ page }) => {
    await mockAvailability(page);
    await mockQuote(page);
    await open(page);
    const selected = grid(page).locator('button[data-status="selected"]');
    await band(page, 1, 3, '06–18').click();
    await expect(selected).toHaveCount(1);
    await expect(selected).toHaveText('06–18');
    await expect(selected).toHaveAttribute('aria-pressed', 'true');
    await expect(panel(page).getByRole('heading', { name: 'Stand 1' })).toBeVisible();
    // Extend forward over a free run: one pill, the day-aware label.
    await band(page, 1, 4, '06–18').click();
    await expect(selected).toHaveCount(1);
    const d3 = dayAt(3);
    const d4 = dayAt(4, 18);
    await expect(selected).toHaveText(`${WD_SHORT[d3.getDay()]} 06:00 – ${WD_SHORT[d4.getDay()]} 18:00`);
    await expect(panel(page).getByTestId('selection-end')).toContainText(point(new Date(d4.getTime() - 30 * 60_000)));
    // Inside a multi-cell run → collapses to the tapped (first) cell; the same single cell again → off.
    await selected.click();
    await expect(selected).toHaveText('06–18');
    await selected.click();
    await expect(selected).toHaveCount(0);
    await expect(panel(page)).toHaveCount(0);
    // Another stand restarts there (c36: the panel follows live, without closing).
    await band(page, 1, 3, '18–06').click();
    await expect(panel(page).getByRole('heading', { name: 'Stand 1' })).toBeVisible();
    await band(page, 2, 3, '18–06').click();
    await expect(panel(page).getByRole('heading', { name: 'Stand 2' })).toBeVisible();
    await expect(grid(page).locator(`button[data-stand="${standId(1)}"][data-status="selected"]`)).toHaveCount(0);
    // A gap (stand 3 is booked day +8 06–18) → restart at the tapped cell.
    await scrollGridTo(page, 6 * 180);
    await band(page, 3, 7, '18–06').click();
    await band(page, 3, 8, '18–06').click();
    await expect(selected).toHaveCount(1);
    await expect(selected).toHaveText('18–06');
    await expect(panel(page).getByTestId('selection-start')).toHaveText(point(dayAt(8, 18)));
    // Tapping an unavailable cell is a no-op for the selection.
    await band(page, 3, 8, '06–18').click();
    await expect(panel(page).getByTestId('selection-start')).toHaveText(point(dayAt(8, 18)));
  });

  test('c20: the day pill selects the whole day on the selected stand; each refusal says why', async ({ page }) => {
    await mockAvailability(page);
    await mockQuote(page);
    await open(page);
    await scrollGridTo(page, 0);
    await dayPill(page, 3).click();
    await expect(alertToast(page, 'Selectează mai întâi un stand.')).toBeVisible();
    await band(page, 1, 4, '06–18').click();
    await dayPill(page, -1).click();
    await expect(alertToast(page, 'Ziua a trecut — alege o zi viitoare.')).toBeVisible();
    // Today: its morning slot has started — unless the run is before 06:00, when the day is simply taken (inside the lead).
    await dayPill(page, 0).click();
    await expect(
      alertToast(page, new Date().getHours() >= 6 ? 'Ziua a început deja — alege o zi viitoare.' : 'Ziua nu e liberă integral la standul ales.')
    ).toBeVisible();
    // A taken cell that day on the selected stand.
    await band(page, 3, 4, '06–18').click();
    await dayPill(page, 3).click();
    await expect(alertToast(page, 'Ziua nu e liberă integral la standul ales.')).toBeVisible();
    // A free day: both slots as one pill.
    await dayPill(page, 4).click();
    const selected = grid(page).locator('button[data-status="selected"]');
    await expect(selected).toHaveCount(1);
    await expect(panel(page).getByTestId('selection-start')).toHaveText(point(dayAt(4, 6)));
    await expect(panel(page).getByTestId('selection-duration')).toHaveText('24h');
  });

  test('c28–c30 c33 c34 / booking.b.timezone: the panel — stand, timeline with the checkout buffer, the server price, duration, rate name, the note', async ({ page }) => {
    let slow: Promise<void> | null = null;
    let open1!: () => void;
    const bodies = await mockQuote(page, async (b) => {
      if (slow) await slow;
      return b.stand === standId(2) && b.startDate.includes('T18:00') ? priced(450, 'Pachet noapte') : priced(300, 'Tur 12h');
    });
    await mockAvailability(page);
    await open(page);
    slow = new Promise((r) => (open1 = r));
    await band(page, 1, 3, '06–18').click();
    const p = panel(page);
    // c29: spinner + «se calculează» while the first price loads; Continuă held.
    await expect(p.getByTestId('selection-quoting')).toContainText('se calculează');
    await expect(p.getByTestId('selection-continue')).toHaveAttribute('aria-disabled', 'true');
    open1();
    slow = null;
    // c28: «Stand 1», start, end minus the lake's 30 min buffer.
    await expect(p.getByRole('heading', { name: 'Stand 1' })).toBeVisible();
    await expect(p.getByTestId('selection-start')).toHaveText(point(dayAt(3, 6)));
    await expect(p.getByTestId('selection-end')).toHaveText(point(new Date(dayAt(3, 18).getTime() - 30 * 60_000)));
    // c30: «300 lei» (the unit its own element), «12h zi», no pill for «Tur 12h».
    await expect(p.getByTestId('selection-price')).toHaveText(/^300\s+lei$/);
    await expect(p.getByTestId('selection-price').locator('span')).toHaveCount(2);
    await expect(p.getByTestId('selection-duration')).toHaveText('12h zi');
    await expect(p.getByTestId('selection-rate')).toHaveCount(0);
    // c33: Chita is paid on site; a day tour on a cabin stand gets no extras (c34: per night only).
    await expect(p.getByTestId('selection-note')).toHaveText('Plata se face la fața locului.');
    await expect(p.getByTestId('selection-continue')).not.toHaveAttribute('aria-disabled', /.*/);
    expect(bodies[0]).toEqual({ stand: standId(1), startDate: at(3, 6), endDate: at(3, 18), extras: [], walkIn: false });
    await shot(page, 'selection-priced');
    await expectNoA11yViolations(page);
    // c29: a newer answer in flight dims the previous price instead of hiding it.
    slow = new Promise((r) => (open1 = r));
    await band(page, 2, 3, '18–06').click();
    await expect(p.getByTestId('selection-price')).toHaveAttribute('data-stale', 'true');
    await expect(p.getByTestId('selection-price')).toHaveText(/^300/);
    open1();
    slow = null;
    // c30: a night tour, a rate row with its own name; c33/c34: a night on the cabin stand → extras next.
    await expect(p.getByTestId('selection-price')).toHaveText(/^450\s+lei$/);
    await expect(p.getByTestId('selection-price')).not.toHaveAttribute('data-stale', /.*/);
    await expect(p.getByTestId('selection-duration')).toHaveText('12h noapte');
    await expect(p.getByTestId('selection-rate')).toHaveText('Pachet noapte');
    await expect(p.getByTestId('selection-note')).toHaveText('Poți adăuga extra la pasul următor.');
    // The same cabin stand by day: per-night extras are not offered.
    await band(page, 2, 7, '06–18').click();
    await expect(p.getByTestId('selection-duration')).toHaveText('12h zi');
    await expect(p.getByTestId('selection-note')).toHaveText('Plata se face la fața locului.');
  });

  test('c31 c32: a refusal shows «—», the server\'s sentence and holds Continuă; a failed quote offers a retry', async ({ page }) => {
    const errors = collectConsoleErrors(page, { ignore: EXPECTED_CONSOLE });
    let fail = true;
    const bodies = await mockQuote(page, (b) => (b.stand === standId(7) ? refused : fail ? 500 : priced()));
    await mockAvailability(page);
    await open(page);
    await band(page, 7, 3, '18–06').click();
    const p = panel(page);
    await expect(p.getByTestId('selection-no-price')).toHaveText('—');
    await expect(p.getByTestId('selection-refusal')).toHaveText('Balta nu permite plecarea la 06:00.');
    await expect(p.getByTestId('selection-continue')).toHaveAttribute('aria-disabled', 'true');
    // Held: a click does nothing (aria-disabled — it stays focusable).
    await p.getByTestId('selection-continue').click({ force: true });
    await expect(page).toHaveURL(new RegExp(`${PATH}\\?`));
    await shot(page, 'selection-refused');
    await expectNoA11yViolations(page);
    await band(page, 8, 3, '18–06').click();
    await expect(p.getByTestId('selection-quote-failed')).toHaveText('Nu am putut calcula prețul', { timeout: 20_000 });
    await expect(p.getByTestId('selection-continue')).toHaveAttribute('aria-disabled', 'true');
    await shot(page, 'selection-failed');
    await expectNoA11yViolations(page);
    fail = false;
    const n = bodies.length;
    await p.getByRole('button', { name: 'Încearcă din nou' }).click();
    await expect(p.getByTestId('selection-price')).toHaveText(/^300/);
    expect(bodies.length).toBeGreaterThan(n);
    expect(errors).toEqual([]);
  });

  test('c35 / booking.b.flow-state: Anulează clears; Continuă goes to the review, or to the extras step when the stand adds something', async ({ page }) => {
    await mockAvailability(page);
    await mockQuote(page);
    await open(page);
    await band(page, 1, 3, '06–18').click();
    await expect(page).toHaveURL(new RegExp(`stand=${standId(1)}`));
    await panel(page).getByRole('button', { name: 'Anulează' }).click();
    await expect(panel(page)).toHaveCount(0);
    await expect(grid(page).locator('button[data-status="selected"]')).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`${PATH}$`));
    // A day tour on a plain stand → straight to the review.
    await band(page, 1, 3, '06–18').click();
    await expect(panel(page).getByTestId('selection-price')).toBeVisible();
    await panel(page).getByTestId('selection-continue').click();
    await expect(page).toHaveURL(
      `${BASE_URL}${PATH}/confirmare?${new URLSearchParams([['stand', standId(1)], ['start', at(3, 6)], ['end', at(3, 18)]])}`
    );
    // Back re-seeds the grid on its day (c24), extras reset.
    await page.goBack();
    await expect(panel(page).getByRole('heading', { name: 'Stand 1' })).toBeVisible();
    // A night on the cabin stand → the extras step.
    await band(page, 2, 3, '18–06').click();
    await expect(panel(page).getByTestId('selection-price')).toBeVisible();
    await panel(page).getByTestId('selection-continue').click();
    await expect(page).toHaveURL(
      `${BASE_URL}${PATH}/extra?${new URLSearchParams([['stand', standId(2)], ['start', at(3, 18)], ['end', at(4, 6)]])}`
    );
  });

  test('c24: a reload (or a link from a later step, extras dropped) re-seeds the selection and opens on its day', async ({ page }) => {
    await mockAvailability(page);
    await mockQuote(page);
    const sel = new URLSearchParams([['stand', standId(4)], ['start', at(9, 6)], ['end', at(9, 18)], ['extra', 'cabana']]);
    await open(page, `?${sel}`);
    const selected = grid(page).locator('button[data-status="selected"]');
    await expect(selected).toHaveCount(1);
    await expect(panel(page).getByRole('heading', { name: 'Stand 4' })).toBeVisible();
    await expect(page).not.toHaveURL(/extra=/);
    // Opened on its day: the selected band is in the grid's viewport.
    const g = (await scroller(page).boundingBox())!;
    const s = (await selected.boundingBox())!;
    expect(s.x).toBeGreaterThanOrEqual(g.x);
    expect(s.x + s.width).toBeLessThanOrEqual(g.x + g.width);
    // A selection that is not a free run any more is dropped, not guessed.
    await page.goto(`${PATH}?${new URLSearchParams([['stand', standId(3)], ['start', at(3, 6)], ['end', at(3, 18)]])}`);
    await expect(grid(page)).toBeVisible();
    await expect(panel(page)).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`${PATH}$`));
  });

  test('c37: Back first clears the selection, the next Back leaves the flow (header back and browser back)', async ({ page }) => {
    await mockAvailability(page);
    await mockQuote(page);
    await signIn(page.context(), jwt);
    await page.goto(`/balti/${LAKE}`);
    await page.goto(PATH);
    await band(page, 1, 3, '06–18').click();
    await expect(panel(page)).toBeVisible();
    await page.getByRole('button', { name: 'Anulează selecția' }).click();
    await expect(panel(page)).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`${PATH}$`));
    // Browser Back after a selection: the selection goes first.
    await band(page, 1, 4, '06–18').click();
    await expect(panel(page)).toBeVisible();
    await page.goBack();
    await expect(panel(page)).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`${PATH}$`));
    await page.getByRole('button', { name: 'Înapoi' }).click();
    await expect(page).toHaveURL(new RegExp(`/balti/${LAKE}$`));
  });

  test('c37 after a later step: Back from /confirmare lands on the selection; Anulează then «Înapoi» leaves in one press each', async ({ page }) => {
    await mockAvailability(page);
    await mockQuote(page);
    await signIn(page.context(), jwt);
    await page.goto(`/balti/${LAKE}`);
    await page.goto(PATH);
    await band(page, 1, 3, '06–18').click();
    await expect(panel(page).getByTestId('selection-price')).toBeVisible();
    await panel(page).getByTestId('selection-continue').click();
    await expect(page).toHaveURL(new RegExp(`${PATH}/confirmare\\?`));
    // Back: a new mount on the entry the first selection pushed.
    await page.goBack();
    await expect(panel(page).getByRole('heading', { name: 'Stand 1' })).toBeVisible();
    await panel(page).getByRole('button', { name: 'Anulează' }).click();
    await expect(panel(page)).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`${PATH}$`));
    await page.getByRole('button', { name: 'Înapoi' }).click();
    await expect(page).toHaveURL(new RegExp(`/balti/${LAKE}$`));
    // The same with the header's «Anulează selecția» and the browser's Back.
    await page.goto(PATH);
    await band(page, 1, 4, '06–18').click();
    await expect(panel(page).getByTestId('selection-price')).toBeVisible();
    await panel(page).getByTestId('selection-continue').click();
    await expect(page).toHaveURL(new RegExp(`${PATH}/confirmare\\?`));
    await page.goBack();
    await expect(panel(page)).toBeVisible();
    await page.getByRole('button', { name: 'Anulează selecția' }).click();
    await expect(panel(page)).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`${PATH}$`));
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`/balti/${LAKE}$`));
  });

  test('booking.b.live-availability: a re-read that finds the selection taken clears it and says so', async ({ page }) => {
    let taken = false;
    const seen = await mockAvailability(page, {
      page: (_i, route, from, to) => {
        const body = availability(from, to, { leadHours: 48 });
        if (taken) (body.bookings as unknown[]).push({ standDocumentId: standId(1), start: at(7, 6), end: at(7, 18), initials: 'XY' });
        return json(route, { data: body });
      },
    });
    await mockQuote(page);
    await open(page);
    await band(page, 1, 7, '06–18').click();
    await expect(panel(page).getByTestId('selection-price')).toBeVisible();
    taken = true;
    const before = seen.length;
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      window.dispatchEvent(new Event('visibilitychange'));
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      window.dispatchEvent(new Event('visibilitychange'));
    });
    await expect.poll(() => seen.length).toBeGreaterThan(before);
    await expect(alertToast(page, 'Intervalul ales nu mai e liber.')).toBeVisible();
    await expect(panel(page)).toHaveCount(0);
    await expect(grid(page).locator('button[data-status="selected"]')).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`${PATH}$`));
    await expect(runOn(page, 1, 7)).toHaveAttribute('data-status', 'booked');
  });

  test('c33 / owner rule 4: a deposit lake states no amount until the server prices the tour', async ({ page }) => {
    const errors = collectConsoleErrors(page, { ignore: EXPECTED_CONSOLE });
    const fault = (faults: string[]) => page.request.post(`${BASE_URL}/balti/${LAKE}/e2e-fault`, { data: { faults } });
    expect((await fault(['deposit-30'])).ok()).toBeTruthy();
    try {
      let slow: Promise<void> | null = null;
      let release!: () => void;
      await mockQuote(page, async (b) => {
        if (slow) await slow;
        return b.stand === standId(7) ? refused : b.stand === standId(8) ? 500 : priced(300);
      });
      await mockAvailability(page);
      await open(page);
      const p = panel(page);
      // Quoting: no «Avans 30%: 0 lei» next to the spinner.
      slow = new Promise((r) => (release = r));
      await band(page, 1, 3, '06–18').click();
      await expect(p.getByTestId('selection-quoting')).toBeVisible();
      await expect(p.getByTestId('selection-note')).toHaveCount(0);
      release();
      slow = null;
      await expect(p.getByTestId('selection-price')).toHaveText(/^300\s+lei$/);
      await expect(p.getByTestId('selection-note')).toHaveText('Avans 30%: 90 lei');
      // Refused («—»): no amount.
      await band(page, 7, 3, '18–06').click();
      await expect(p.getByTestId('selection-no-price')).toHaveText('—');
      await expect(p.getByTestId('selection-note')).toHaveCount(0);
      // Failed: no amount.
      await band(page, 8, 3, '18–06').click();
      await expect(p.getByTestId('selection-quote-failed')).toBeVisible({ timeout: 20_000 });
      await expect(p.getByTestId('selection-note')).toHaveCount(0);
      expect(errors).toEqual([]);
    } finally {
      await fault([]);
    }
  });

  test('c5 c22 c23: phone — the header folds away while a selection is up, the row is centred above the docked panel, the edge chevron', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 760 });
    await mockAvailability(page);
    await mockQuote(page);
    await open(page);
    const header = page.getByTestId('booking-header');
    await expect(header).not.toHaveAttribute('data-collapsed', /.*/);
    // Stand 8, low on a phone: scroll it into view, select.
    await scrollGridTo(page, 3 * 120 - 60, 9999);
    await band(page, 8, 3, '06–18').click();
    await expect(header).toHaveAttribute('data-collapsed', 'true');
    await expect.poll(async () => (await header.boundingBox())?.height ?? 0).toBeLessThan(1);
    const dock = page.getByTestId('selection-panel');
    await expect(dock).toBeVisible();
    // c22: the grid ends above the panel and the selected row sits in the middle of the visible rows.
    const g = (await scroller(page).boundingBox())!;
    const d = (await dock.boundingBox())!;
    expect(g.y + g.height).toBeLessThanOrEqual(d.y + 1);
    await expect
      .poll(async () => {
        const row = (await grid(page).locator(`[data-row="${standId(8)}"]`).boundingBox())!;
        const mid = g.y + 68 + (g.height - 68) / 2;
        return Math.abs(row.y + row.height / 2 - mid);
      })
      .toBeLessThan(30);
    await shot(page, 'phone-selection');
    await expectNoA11yViolations(page);
    // c23: «Azi» is folded away with the header; scroll back towards today: the selection runs off the right edge.
    await scrollGridTo(page, 0);
    await expect(grid(page).getByTestId('grid-edge-hint')).toHaveAttribute('data-visible', 'true');
    await scrollGridTo(page, 3 * 120);
    await expect(grid(page).getByTestId('grid-edge-hint')).not.toHaveAttribute('data-visible', /.*/);
    // Cleared → the header comes back.
    await page.getByRole('button', { name: 'Anulează', exact: true }).click();
    await expect(header).not.toHaveAttribute('data-collapsed', /.*/);
    await expect.poll(async () => (await header.boundingBox())?.height ?? 0).toBeGreaterThan(40);
  });

  test('c5 (web): from 1024 the header stays with a selection and the panel is the right summary card', async ({ page }) => {
    await mockAvailability(page);
    await mockQuote(page);
    await open(page);
    await expect(page.getByTestId('selection-empty')).toContainText('Alege un interval liber');
    await band(page, 1, 3, '06–18').click();
    await expect(page.getByTestId('booking-header')).not.toHaveAttribute('data-collapsed', /.*/);
    await expect(page.getByTestId('selection-card').getByRole('heading', { name: 'Stand 1' })).toBeVisible();
    await expect(page.getByTestId('selection-panel')).toHaveCount(0);
    // The card sits right of the grid.
    const g = (await grid(page).boundingBox())!;
    const c = (await page.getByTestId('selection-card').boundingBox())!;
    expect(c.x).toBeGreaterThan(g.x + g.width);
  });

  test('c3 «Azi» + keyboard path: Tab into the grid, arrows move, Enter selects, focus stays on the selection', async ({ page }) => {
    await mockAvailability(page);
    await mockQuote(page);
    await open(page);
    await scrollGridTo(page, 4000);
    await page.getByRole('button', { name: 'Mergi la ziua de azi' }).click();
    await expect.poll(() => scroller(page).evaluate((el) => el.scrollLeft)).toBe(180);
    // The day pills are one tab stop (today), the bands another.
    await page.getByRole('button', { name: 'Mergi la ziua de azi' }).focus();
    await page.keyboard.press('Tab');
    await expect(page.locator(':focus')).toHaveAttribute('aria-label', `${pill(0)}, selectează toată ziua`);
    await page.keyboard.press('ArrowRight');
    await expect(page.locator(':focus')).toHaveAttribute('aria-label', `${pill(1)}, selectează toată ziua`);
    await page.keyboard.press('Tab');
    const focused = page.locator(':focus');
    await expect(focused).toHaveAttribute('data-band', 'true');
    await expect(focused).toHaveAttribute('data-stand', standId(1));
    // First future band of stand 1 is today's evening or tomorrow; walk right to day +3 06–18.
    for (let i = 0; i < 12; i++) {
      const label = await focused.getAttribute('aria-label');
      if (label?.startsWith(`1, ${pill(3)} 06–18`)) break;
      await page.keyboard.press('ArrowRight');
    }
    await expect(focused).toHaveAttribute('aria-label', `1, ${pill(3)} 06–18, disponibil`);
    await page.keyboard.press('ArrowDown');
    await expect(focused).toHaveAttribute('aria-label', `2, ${pill(3)} 06–18, disponibil`);
    await page.keyboard.press('Enter');
    await expect(panel(page).getByRole('heading', { name: 'Stand 2' })).toBeVisible();
    await expect(page.locator(':focus')).toHaveAttribute('data-status', 'selected');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Space');
    await expect(grid(page).locator('button[data-status="selected"]')).toHaveText(new RegExp(`^${WD_SHORT[dayAt(3).getDay()]} 06:00`));
  });

  test('c26 c27: booking off, no stands, the skeleton, a failed read with «Încearcă din nou»', async ({ page }) => {
    const errors = collectConsoleErrors(page, { ignore: EXPECTED_CONSOLE });
    await mockAvailability(page, { leadHours: 48, bookingEnabled: false });
    await open(page);
    await expect(page.getByRole('heading', { name: 'Rezervările nu sunt disponibile' })).toBeVisible();
    await expect(page.getByText('Acest lac nu acceptă deocamdată rezervări online.')).toBeVisible();
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await mockAvailability(page, { leadHours: 48, stands: 0 });
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Nicio disponibilitate' })).toBeVisible();
    await expect(page.getByText('Nu există standuri sau intervale disponibile pentru această perioadă.')).toBeVisible();
    // Skeleton while the first page loads, then the error with a retry.
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    let ok = false;
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    await mockAvailability(page, {
      leadHours: 48,
      page: async (_i, route, from, to) => {
        await gate;
        return ok ? json(route, { data: availability(from, to, { leadHours: 48 }) }) : json(route, { error: { status: 500 } }, 500);
      },
    });
    await page.reload();
    await expect(page.getByTestId('availability-skeleton')).toHaveCount(1);
    await expect(page.getByTestId('availability-skeleton')).toBeVisible();
    release();
    await expect(page.getByRole('alert').filter({ hasText: 'A apărut o eroare la încărcarea disponibilității.' })).toBeVisible({ timeout: 20_000 });
    ok = true;
    await page.getByTestId('availability-retry').click();
    await expect(grid(page)).toBeVisible();
    expect(errors).toEqual([]);
  });

  /* ----------------------------------------------------------------------------------------------
   * Every state at 375 / 1280 / 1440 / 1920: screenshots for the review + axe
   * -------------------------------------------------------------------------------------------- */

  for (const w of WIDTHS) {
    test(`states at ${w}: grid, selection, refusal, failure, too soon, block, booking off, empty, error, skeleton`, async ({ page }) => {
      test.setTimeout(180_000);
      await page.setViewportSize({ width: w, height: w < 768 ? 812 : 900 });
      const errors = collectConsoleErrors(page, { ignore: EXPECTED_CONSOLE });
      await mockQuote(page, (b) => (b.stand === standId(7) ? refused : b.stand === standId(8) ? 500 : priced(300, 'Pachet weekend')));
      await mockAvailability(page);
      await open(page);
      await expect(grid(page)).toBeVisible();
      await shot(page, 'grid');
      await expectNoA11yViolations(page);
      await band(page, 1, 3, '06–18').click();
      await expect(panel(page).getByTestId('selection-price')).toBeVisible();
      await shot(page, 'selection');
      await expectNoA11yViolations(page);
      await band(page, 7, 3, '18–06').click();
      await expect(panel(page).getByTestId('selection-refusal')).toBeVisible();
      await shot(page, 'refusal');
      await band(page, 8, 3, '18–06').click();
      await expect(panel(page).getByTestId('selection-quote-failed')).toBeVisible({ timeout: 20_000 });
      await shot(page, 'quote-failed');
      await panel(page).getByRole('button', { name: 'Anulează' }).click();
      await expect(panel(page)).toHaveCount(0);
      await band(page, 1, 1, '06–18').click();
      await expect(page.getByRole('dialog', { name: 'Rezervare din scurt' })).toBeVisible();
      await shot(page, 'too-soon');
      await page.getByRole('button', { name: 'Am înțeles' }).click();
      await runOn(page, 5, 3).click();
      await expect(page.getByRole('dialog', { name: 'Reparăm pontonul' })).toBeVisible();
      await shot(page, 'block');
      await page.getByRole('button', { name: 'Am înțeles' }).click();

      await page.unrouteAll({ behavior: 'ignoreErrors' });
      await mockAvailability(page, { leadHours: 48, bookingEnabled: false });
      await page.reload();
      await expect(page.getByRole('heading', { name: 'Rezervările nu sunt disponibile' })).toBeVisible();
      await shot(page, 'booking-off');
      await expectNoA11yViolations(page);

      await page.unrouteAll({ behavior: 'ignoreErrors' });
      await mockAvailability(page, { leadHours: 48, stands: 0 });
      await page.reload();
      await expect(page.getByRole('heading', { name: 'Nicio disponibilitate' })).toBeVisible();
      await shot(page, 'empty');

      await page.unrouteAll({ behavior: 'ignoreErrors' });
      let release!: () => void;
      const gate = new Promise<void>((r) => (release = r));
      await mockAvailability(page, {
        page: async (_i, route) => {
          await gate;
          return json(route, { error: { status: 500 } }, 500);
        },
      });
      await page.reload();
      // While the page streams, the route's fallback and the screen's own skeleton briefly coexist.
      await expect(page.getByTestId('availability-skeleton')).toHaveCount(1);
      await expect(page.getByTestId('availability-skeleton')).toBeVisible();
      await shot(page, 'skeleton');
      await expectNoA11yViolations(page);
      release();
      await expect(page.getByTestId('availability-retry')).toBeVisible({ timeout: 20_000 });
      await shot(page, 'error');
      await expectNoA11yViolations(page);
      expect(errors).toEqual([]);
    });
  }
});

/* ------------------------------------------------------------------------------------------------
 * booking.b.timezone abroad: a browser in Europe/London, a lake in Europe/Bucharest
 * ---------------------------------------------------------------------------------------------- */

test.describe('signed in, browser in Europe/London', () => {
  test.use({ timezoneId: 'Europe/London' });

  /** «04–16»: the lake's 06–18 read on the London clock (what the grid shows today — pinned). */
  const london = (d: Date) => new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone: 'Europe/London' }).format(d);

  test('b.timezone: slots are the lake\'s instants, shown on the browser\'s clock, with the «ora României» hint', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const bodies = await mockQuote(page);
    await mockAvailability(page);
    await open(page);
    await expect(grid(page)).toBeVisible();
    // The hint says the clock differs (2 h all year: EET/EEST vs GMT/BST).
    await expect(page.getByTestId('zone-hint')).toHaveText('Orele sunt afișate după ceasul tău, cu 2 ore în urma orei României.');
    // The lake's 06–18 tour on day +3 reads «04–16» here.
    const label = `${london(dayAt(3, 6))}–${london(dayAt(3, 18))}`;
    expect(label).toBe('04–16');
    await band(page, 1, 3, label).click();
    await expect(panel(page).getByTestId('selection-price')).toBeVisible();
    // …but the instants are the lake's: the quote and the URL carry 06:00 / 18:00 Bucharest.
    expect(bodies[0]).toMatchObject({ stand: standId(1), startDate: at(3, 6), endDate: at(3, 18) });
    await expect(page).toHaveURL(new RegExp(`start=${esc(encodeURIComponent(at(3, 6)))}`));
    // «Continuă» fades from held to primary (--duration-fast): scan once it has settled.
    await expect(panel(page).getByTestId('selection-continue')).not.toHaveAttribute('aria-disabled', /.*/);
    await page.waitForTimeout(300);
    await expectNoA11yViolations(page);
  });
});
