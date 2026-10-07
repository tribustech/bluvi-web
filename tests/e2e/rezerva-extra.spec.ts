import { expect, test, type APIRequestContext, type Page, type Route } from '@playwright/test';
import { expectNoA11yViolations } from './helpers/a11y';
import { BASE_URL } from './helpers/base-url';
import { collectConsoleErrors } from './helpers/console';
import { CMS, qaJwt, signIn } from './helpers/session';

/*
 * booking.rezerva-extra (/balti/[id]/rezerva/extra, T4) — fish app/(app)/book-lake/[lakeId]/extras.tsx
 * + features/lakes/booking/{ExtrasStep,offeredExtras,nights}.ts + services/queries/useBookingQuote.ts.
 *
 * Data: the QA user, signed in, on the LOCAL Chita Lake. The availability is the real one (read in the
 * browser through /api/cms): the spec finds a stand that sells an extra and is free for a tour that
 * crosses two nights (as the T4 demo's seedSelection does). The priced state uses the real quote
 * (POST /feed/lakes/:id/quote reads, it never writes); only the in-flight, refused and failed states,
 * and the cache check (c6), route-mock it. One test adds a per-stay extra to the real availability
 * (Chita sells none). NO writes: «Continuă» only navigates (the confirmation step is another screen).
 */

process.env.TZ = 'Europe/Bucharest';
test.use({ timezoneId: 'Europe/Bucharest', locale: 'ro-RO' });

const LAKE = 's84u55lo4n9z0emngozttt6e';
const GRID = `/balti/${LAKE}/rezerva`;
const PATH = `${GRID}/extra`;
const REVIEW = `${GRID}/confirmare`;
const AVAIL = /\/api\/cms\/feed\/lakes\/[^/]+\/availability/;
const QUOTE = /\/api\/cms\/feed\/lakes\/[^/]+\/quote/;
const SHOTS = '.shots/rezerva-extra';
const WIDTHS = [375, 1280, 1440, 1920] as const;
/** The mocked 500s (failed state) are logged by the browser. */
const EXPECTED_CONSOLE = [/Failed to load resource: the server responded with a status of 500/];

/* ------------------------------------------------------------------------------------------------
 * Time (Europe/Bucharest wall clock, like the step)
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
 * The real availability: a stand with an extra, free for day +3 18:00 → day +5 18:00 (2 nights)
 * ---------------------------------------------------------------------------------------------- */

type Extra = { key: string; label: string; price: number; unit: 'perNight' | 'perStay' };
type Stand = { documentId: string; name: string; extras: string[] };
type Interval = { standDocumentId: string | null; start: string; end: string };
type Sel = { stand: string; start: string; end: string };
type Pick = { sel: Sel; day: Sel; plain: Sel; standName: string; extra: Extra };

async function findTour(request: APIRequestContext): Promise<Pick> {
  for (let first = 3; first < 40; first += 2) {
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
    const extra = av.extras.find((e) => e.key === stand.extras[0])!;
    return {
      sel: { stand: stand.documentId, start, end },
      day: { stand: stand.documentId, start: at(first, 6), end: at(first, 18) },
      plain: { stand: plain.documentId, start, end },
      standName: stand.name,
      extra,
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
 * Quote mocks
 * ---------------------------------------------------------------------------------------------- */

type QuoteBody = { stand: string; startDate: string; endDate: string; extras: string[]; walkIn: boolean };
const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const priced = (
  tour: number,
  extras: { key: string; label: string; total: number; quantity: number; unitPrice: number }[] = [],
  durationHours = 48
) => ({
  data: {
    total: tour + extras.reduce((s, e) => s + e.total, 0),
    basis: { durationHours, rowLabel: null, composedFrom: [24, 24], tourPrice: tour, extras: extras.map((e) => ({ ...e, unit: 'perNight' })) },
    refusal: null,
  },
});
const refused = { data: { total: null, basis: null, refusal: { code: 'EXTRA_UNAVAILABLE', message: 'Cabana nu e disponibilă în această perioadă.' } } };

/** Records every quote body; `answer` may delay, refuse or fail (500). Without it the real CMS answers. */
async function watchQuote(page: Page, answer?: (body: QuoteBody, n: number) => Promise<unknown> | unknown) {
  const bodies: QuoteBody[] = [];
  await page.route(QUOTE, async (route) => {
    const body = (route.request().postDataJSON() as { data: QuoteBody }).data;
    bodies.push(body);
    if (!answer) return route.continue();
    const a = await answer(body, bodies.length);
    if (a === 500) return json(route, { error: { status: 500, message: 'boom' } }, 500);
    return json(route, a);
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
});

async function open(page: Page, query: string) {
  await signIn(page.context(), jwt);
  await page.goto(`${PATH}${query}`);
}
const card = (page: Page) => page.getByRole('checkbox', { name: new RegExp(tour.extra.label) });
/** The card itself (the native checkbox is visually hidden under its marker): what a pointer clicks. */
const cardBox = (page: Page) => page.locator('label').filter({ has: card(page) });
const cont = (page: Page) => page.getByTestId('extras-continue');
/** The visible money line: the summary's from 1280, the bar's below. */
const total = (page: Page) =>
  page.locator('section[aria-label="Rezumat"]:visible, [data-testid="extras-bar-total"]:visible').first();
const lei = (n: number) => new Intl.NumberFormat('ro-RO').format(n);

/** axe once the CTA's colour transition (held → live, 150ms) has finished: never a mid-fade sample. */
async function axe(page: Page) {
  await page.waitForTimeout(400);
  await expectNoA11yViolations(page);
}

async function shot(page: Page, name: string) {
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${SHOTS}/${name}-${page.viewportSize()?.width}.png`, fullPage: true });
}
async function shots(page: Page, name: string) {
  for (const w of WIDTHS) {
    await page.setViewportSize({ width: w, height: w < 768 ? 812 : 900 });
    await shot(page, name);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
}

/* ------------------------------------------------------------------------------------------------
 * Signed out
 * ---------------------------------------------------------------------------------------------- */

test.describe('signed out', () => {
  test('booking.b.sign-in-gate: a real 307 to /intra, returning here with the selection and the extras', async ({ request }) => {
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
 * Signed in
 * ---------------------------------------------------------------------------------------------- */

test.describe('signed in', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test('c1: without a valid selection, or with a stand the lake does not have, the step goes to the bare grid', async ({ page }) => {
    await signIn(page.context(), jwt);
    await page.goto(PATH);
    await page.waitForURL((u) => u.pathname === GRID && !u.search);
    await page.goto(`${PATH}?stand=${tour.sel.stand}&start=nope&end=${encodeURIComponent(tour.sel.end)}`);
    await page.waitForURL((u) => u.pathname === GRID && !u.searchParams.get('stand'));
    await page.goto(`${PATH}${q({ ...tour.sel, stand: 'e2e-gone-stand' }, [tour.extra.key])}`);
    await page.waitForURL((u) => u.pathname === GRID && !u.searchParams.get('stand'));
  });

  test('c2: a tour the stand has nothing to add to goes back to the grid with the selection kept', async ({ page }) => {
    // A stand without extras.
    await open(page, q(tour.plain, [tour.extra.key]));
    await page.waitForURL((u) => u.pathname === GRID && u.searchParams.get('stand') === tour.plain.stand);
    const u1 = new URL(page.url());
    expect(Date.parse(u1.searchParams.get('start')!)).toBe(Date.parse(tour.plain.start));
    expect(u1.searchParams.getAll('extra')).toEqual([]);
    // A day tour (no night) on a stand that only sells a per-night extra (Chita: cabins).
    expect(tour.extra.unit).toBe('perNight');
    await page.goto(`${PATH}${q(tour.day)}`);
    await page.waitForURL((u) => u.pathname === GRID && u.searchParams.get('stand') === tour.day.stand);
    expect(Date.parse(new URL(page.url()).searchParams.get('end')!)).toBe(Date.parse(tour.day.end));
  });

  test('c3 c4 c5 c7: heading, the card (keyboard), price × nights, the real quote, Continuă → review; axe; shots', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    const bodies = await watchQuote(page);
    await open(page, q(tour.sel));
    // c3
    await expect(page.getByRole('heading', { level: 1, name: 'Extra' })).toBeVisible();
    await expect(page.getByTestId('extras-subtitle')).toHaveText('Poți adăuga la rezervare, dacă vrei.');
    await expect(page).toHaveTitle(/Extra/);
    // c4: one card per offered extra, checkbox semantics, unchecked.
    await expect(page.getByRole('checkbox')).toHaveCount(1);
    await expect(card(page)).not.toBeChecked();
    // A lone extra spans the column from 768 (never half of it beside an empty band).
    const listW = (await page.getByTestId('extras-list').boundingBox())!.width;
    expect((await cardBox(page).boundingBox())!.width).toBeGreaterThan(listW - 2);
    const label = page.locator('label').filter({ has: card(page) });
    // c5: 2 nights → price × 2, the note with the plural.
    await expect(label).toContainText(`+${lei(tour.extra.price * 2)} lei`);
    await expect(label).toContainText(`${lei(tour.extra.price)} lei/noapte · 2 nopți`);
    // The bare tour, priced by the real CMS; Continuă enabled.
    await expect(cont(page)).not.toHaveAttribute('aria-disabled', 'true');
    const bare = Number((await total(page).locator('.t-display:visible').innerText()).replace(/\D/g, ''));
    expect(bare).toBeGreaterThan(0);
    expect(bodies.at(-1)!.extras).toEqual([]);
    await expect(page.locator('section[aria-label="Rezumat"]')).toContainText(`Standul${tour.standName}`);
    await axe(page);
    await shots(page, 'none-selected');

    // c4 c6: Space on the focused checkbox toggles it; the quote is asked again with the extra.
    await card(page).focus();
    await page.keyboard.press('Space');
    await expect(card(page)).toBeChecked();
    await expect.poll(() => bodies.at(-1)?.extras).toEqual([tour.extra.key]);
    await expect(total(page)).toContainText(`${lei(bare + tour.extra.price * 2)} lei`);
    await expect(page.locator('section[aria-label="Rezumat"]')).toContainText(tour.extra.label);
    await expect(cont(page)).not.toHaveAttribute('aria-disabled', 'true');
    expect(new URL(page.url()).searchParams.getAll('extra')).toEqual([tour.extra.key]);
    await axe(page);
    await shots(page, 'priced-per-night');

    // The review step is another screen (built in parallel): its console is not this page's.
    expect(errors).toEqual([]);
    // c7: Continuă (keyboard) → the review with the selection and the extras.
    await cont(page).focus();
    await page.keyboard.press('Enter');
    await page.waitForURL((u) => u.pathname === REVIEW);
    const u = new URL(page.url());
    expect(u.searchParams.get('stand')).toBe(tour.sel.stand);
    expect(u.searchParams.getAll('extra')).toEqual([tour.extra.key]);
  });

  test('c6: a reload keeps the chosen extras; a URL key the tour cannot have is dropped', async ({ page }) => {
    await watchQuote(page);
    await open(page, q(tour.sel, [tour.extra.key, 'zzz-not-sold']));
    await expect(card(page)).toBeChecked();
    await expect.poll(() => new URL(page.url()).searchParams.getAll('extra')).toEqual([tour.extra.key]);
    await page.reload();
    await expect(card(page)).toBeChecked();
    await expect(cont(page)).not.toHaveAttribute('aria-disabled', 'true');
    // Unchecking writes the URL too (replace: no history entry per toggle).
    const len = await page.evaluate(() => history.length);
    await cardBox(page).click();
    await expect.poll(() => new URL(page.url()).searchParams.getAll('extra')).toEqual([]);
    expect(await page.evaluate(() => history.length)).toBe(len);
  });

  test('c6 c7: every toggle re-quotes; toggling back shows the cached answer at once, held while it is re-read', async ({ page }) => {
    let release: () => void = () => {};
    let gate: Promise<void> | null = null;
    const bodies = await watchQuote(page, async (body) => {
      if (gate && body.extras.length === 0) await gate;
      return body.extras.length
        ? priced(200, [{ key: tour.extra.key, label: tour.extra.label, total: 300, quantity: 2, unitPrice: 150 }])
        : priced(200);
    });
    await open(page, q(tour.sel));
    await expect(total(page)).toContainText('200 lei');
    await cardBox(page).click();
    await expect(total(page)).toContainText('500 lei');
    // Toggle back while the bare tour's re-read hangs: its cached 200 is there at once, Continuă held.
    gate = new Promise((r) => (release = r));
    await cardBox(page).click();
    await expect(total(page)).toContainText('200 lei');
    await expect(total(page)).toContainText('Calculăm prețul…');
    await expect(cont(page)).toHaveAttribute('aria-disabled', 'true');
    await cont(page).dispatchEvent('click');
    await page.waitForTimeout(200);
    expect(new URL(page.url()).pathname).toBe(PATH);
    release();
    await expect(cont(page)).not.toHaveAttribute('aria-disabled', 'true');
    expect(bodies.map((b) => b.extras.join(','))).toEqual(['', tour.extra.key, '']);
  });

  test('states: re-quote in flight, refused, failed (+ retry) — Continuă held; shots', async ({ page }) => {
    const errors = collectConsoleErrors(page, { ignore: EXPECTED_CONSOLE });
    let mode: 'hang' | 'refuse' | 'fail' | 'ok' = 'ok';
    let release: () => void = () => {};
    await watchQuote(page, async (body) => {
      if (body.extras.length === 0) return priced(200);
      if (mode === 'hang') await new Promise<void>((r) => (release = r));
      if (mode === 'refuse') return refused;
      if (mode === 'fail') return 500;
      return priced(200, [{ key: tour.extra.key, label: tour.extra.label, total: 300, quantity: 2, unitPrice: 150 }]);
    });
    await open(page, q(tour.sel));
    await expect(total(page)).toContainText('200 lei');

    // In flight: «Calculăm prețul…», Continuă held. The summary keeps the last answer's receipt,
    // dimmed and aria-busy, so the card does not shrink and grow back (no layout shift).
    const summary = page.locator('section[aria-label="Rezumat"]');
    await expect(summary).toContainText('Tur 48h');
    const before = (await summary.boundingBox())!.height;
    const ctaY = (await cont(page).boundingBox())!.y;
    mode = 'hang';
    await cardBox(page).click();
    await expect(total(page)).toContainText('Calculăm prețul…');
    await expect(cont(page)).toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByTestId('extras-price-rows')).toHaveAttribute('aria-busy', 'true');
    await expect(page.getByTestId('extras-price-rows')).toHaveCSS('opacity', '0.5');
    await expect(summary).toContainText('Tur 48h');
    expect((await summary.boundingBox())!.height).toBe(before);
    expect((await cont(page).boundingBox())!.y).toBe(ctaY);
    // Below 1280 the bar's line has no figure while quoting (never the other list's price there).
    await page.setViewportSize({ width: 375, height: 812 });
    await expect(page.getByTestId('extras-bar-total')).toContainText('Calculăm prețul…');
    await expect(page.getByTestId('extras-bar-total')).not.toContainText('200 lei');
    await page.setViewportSize({ width: 1440, height: 900 });
    await shots(page, 'requote-in-flight');
    release();
    await cardBox(page).click(); // back to the bare tour (cached)
    await expect(cont(page)).not.toHaveAttribute('aria-disabled', 'true');

    // Refused by the ticked extra: the server's sentence, untick it as the way on, the card marked,
    // «Indisponibil» as the total's reason (the lake refused no price). Continuă held.
    mode = 'refuse';
    await page.goto(`${PATH}${q(tour.sel, [tour.extra.key])}`);
    await expect(page.getByRole('alert').filter({ hasText: 'Cabana nu e disponibilă în această perioadă.' })).toContainText(
      'Debifează extra-ul sau alege alt interval.'
    );
    await expect(cont(page)).toHaveAttribute('aria-disabled', 'true');
    await expect(total(page)).toContainText('Indisponibil');
    await expect(total(page)).not.toContainText('refuzat');
    await expect(card(page)).toHaveAttribute('aria-invalid', 'true');
    await axe(page);
    await shots(page, 'refused');

    // Failed: fish's copy and a retry that asks again.
    mode = 'fail';
    await page.reload();
    const alert = page.getByRole('alert').filter({ hasText: 'Nu am putut calcula prețul pentru acest interval.' });
    await expect(alert).toContainText('Verifică legătura la internet și încearcă din nou.', { timeout: 20_000 });
    await expect(cont(page)).toHaveAttribute('aria-disabled', 'true');
    await axe(page);
    await shots(page, 'failed');
    mode = 'ok';
    await alert.getByRole('button', { name: 'Încearcă din nou' }).click();
    await expect(total(page)).toContainText('500 lei');
    await expect(cont(page)).not.toHaveAttribute('aria-disabled', 'true');
    expect(errors).toEqual([]);
  });

  test('c5: a per-stay extra shows its flat price and no note', async ({ page }) => {
    await page.route(AVAIL, async (route) => {
      const res = await route.fetch();
      const body = await res.json();
      body.data.extras.push({ key: 'e2esaltea', label: 'Saltea', price: 40, unit: 'perStay' });
      for (const s of body.data.stands) if (s.documentId === tour.sel.stand) s.extras.push('e2esaltea');
      await route.fulfill({ response: res, json: body });
    });
    await watchQuote(page, () => priced(200));
    await open(page, q(tour.sel));
    const stay = page.locator('label').filter({ has: page.getByRole('checkbox', { name: /Saltea/ }) });
    await expect(stay).toContainText('+40 lei');
    await expect(stay).not.toContainText('noapte');
    await expect(page.getByRole('checkbox')).toHaveCount(2);
  });

  test('c8: back returns to the grid with the selection kept and the extras reset', async ({ page }) => {
    await watchQuote(page, (b) => (b.extras.length ? priced(500) : priced(200)));
    await signIn(page.context(), jwt);
    // Came from the grid: the header's back steps back onto the grid's own entry.
    await page.goto(`${GRID}${q(tour.sel)}`);
    await page.goto(`${PATH}${q(tour.sel)}`);
    await cardBox(page).click();
    await expect.poll(() => new URL(page.url()).searchParams.getAll('extra')).toEqual([tour.extra.key]);
    await page.getByRole('button', { name: 'Înapoi la selecție' }).click();
    await page.waitForURL((u) => u.pathname === GRID);
    let u = new URL(page.url());
    expect(u.searchParams.get('stand')).toBe(tour.sel.stand);
    expect(u.searchParams.getAll('extra')).toEqual([]);
    // Opened directly (a shared link): back replaces it with the grid, selection kept.
    await page.goto(`${PATH}${q(tour.sel, [tour.extra.key])}`);
    await expect(card(page)).toBeChecked();
    await page.getByRole('button', { name: 'Înapoi', exact: true }).click();
    await page.waitForURL((u2) => u2.pathname === GRID);
    u = new URL(page.url());
    expect(u.searchParams.get('stand')).toBe(tour.sel.stand);
    expect(u.searchParams.getAll('extra')).toEqual([]);
  });
});

/* ------------------------------------------------------------------------------------------------
 * A visitor outside Romania: the period and the zi/noapte hour read the LAKE's clock
 * ---------------------------------------------------------------------------------------------- */

test.describe('visitor in another time zone', () => {
  test.use({ timezoneId: 'Europe/London' });

  test('the period and «Tur 12h noapte» are on the lake clock (Europe/Bucharest), as the nights are', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    // 12:00 Bucharest = 10:00 London: the browser's hour would flip the label to «zi».
    const sel = { ...tour.sel, start: tour.sel.start.replace('T18:00', 'T12:00') };
    expect(sel.start).toContain('T12:00');
    await watchQuote(page, () => priced(200, [], 12));
    await open(page, q(sel));
    const summary = page.locator('section[aria-label="Rezumat"]');
    await expect(summary).toContainText('Tur 12h noapte');
    await expect(summary).toContainText('12:00');
    await expect(summary).toContainText('18:00');
    await expect(summary).not.toContainText('10:00');
    await expect(summary).not.toContainText('16:00');
    // The nights note agrees with the dates shown (2 lake-local midnights).
    await expect(page.locator('label').filter({ has: card(page) })).toContainText('2 nopți');
    // Below 1280 the context line says the same.
    await page.setViewportSize({ width: 375, height: 812 });
    await expect(page.getByTestId('extras-context')).toContainText('12:00');
    await expect(page.getByTestId('extras-context')).toContainText('18:00');
    await expect(page.getByTestId('extras-context')).not.toContainText('16:00');
  });
});
