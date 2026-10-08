import { expect, test, type APIRequestContext, type Page, type Route } from '@playwright/test';
import { expectNoA11yViolations } from './helpers/a11y';
import { BASE_URL } from './helpers/base-url';
import { collectConsoleErrors } from './helpers/console';
import { CMS, qaJwt, signIn } from './helpers/session';

/*
 * booking.rezerva-confirmare (/balti/[id]/rezerva/confirmare, T4) — fish app/(app)/book-lake/[lakeId]/
 * review.tsx + BookingReview / BookingConfirmSheet / QuoteUnavailable — plus booking.b.server-priced,
 * b.write-invalidation (create) and b.double-submit-guard.
 *
 * Data: the QA user on the LOCAL Chita Lake (offline, manual — a request lake; its real stands come
 * from the live availability). Other lake shapes (instant, deposit, full, a regulation PDF, a
 * cancellation policy) through the dev-only reshape cookie (page.tsx, per browser context). The quote
 * is route-mocked where a state needs it (refused, failed, slow, a rate name, extras). The create is
 * route-mocked for every error branch and for the request-body checks; the profile PATCH is ALWAYS
 * mocked (the QA phone is never changed). Exactly ONE real create on the local CMS (the happy path),
 * cancelled in `finally` with the QA JWT.
 */

process.env.TZ = 'Europe/Bucharest';
test.use({ timezoneId: 'Europe/Bucharest', locale: 'ro-RO' });

const LAKE = 's84u55lo4n9z0emngozttt6e';
const STAND = 'abj3tnsn3n759y8fob88ie92'; // stand «1»
const GRID = `/balti/${LAKE}/rezerva`;
const PATH = `${GRID}/confirmare`;
const QUOTE = /\/api\/cms\/feed\/lakes\/[^/]+\/quote/;
const AVAIL = /\/api\/cms\/feed\/lakes\/[^/]+\/availability/;
const CREATE = /\/api\/cms\/feed\/bookings$/;
const PROFILE = /\/api\/cms\/user\/profile$/;
const MINE = /\/api\/cms\/feed\/bookings\/mine\?/;
const SHOTS = '.shots/rezerva-confirmare';
const WIDTHS = [375, 1280, 1440, 1920] as const;
const RESHAPE = 'bluvi-e2e-booking-lake';
/** The mocked 4xx / 5xx answers are logged by the browser. */
const EXPECTED_CONSOLE = [/Failed to load resource: the server responded with a status of (400|409|500)/];

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
function iso(d: Date): string {
  const off = -d.getTimezoneOffset();
  const s = off >= 0 ? '+' : '-';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00${s}${pad(Math.floor(Math.abs(off) / 60))}:${pad(Math.abs(off) % 60)}`;
}
const at = (offset: number, hour: number) => iso(dayAt(offset, hour));
const periodText = (offset: number) => {
  const d = dayAt(offset);
  return `${WD[d.getDay()]}, ${d.getDate()} ${MO[d.getMonth()]} · 06:00–18:00`;
};

const sel = (day = 3, stand = STAND) => ({
  stand,
  start: at(day, 6),
  end: at(day, 18),
});
const query = (s = sel(), extras: string[] = []) =>
  new URLSearchParams([['stand', s.stand], ['start', s.start], ['end', s.end], ...extras.map(e => ['extra', e])]).toString();

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });

type Basis = {
  durationHours: number;
  rowLabel: string | null;
  composedFrom: number[];
  tourPrice: number;
  extras: unknown[];
};
const priced = (total = 300, basis: Partial<Basis> = {}) => ({
  data: {
    total,
    basis: {
      durationHours: 12,
      rowLabel: 'Tur 12h',
      composedFrom: [12],
      tourPrice: total,
      extras: [],
      ...basis,
    },
    refusal: null,
  },
});

async function mockQuote(page: Page, answer: (n: number) => unknown | Promise<unknown> = () => priced()) {
  let n = 0;
  await page.route(QUOTE, async route => {
    n += 1;
    const a = await answer(n);
    if (a === 500) return json(route, { error: { status: 500, message: 'boom' } }, 500);
    return json(route, a);
  });
  return () => n;
}

/** The create, mocked: records the bodies; `answer` gives [status, body]. */
async function mockCreate(page: Page, answer: (n: number) => [number, unknown] | Promise<[number, unknown]>) {
  const bodies: Record<string, unknown>[] = [];
  await page.route(CREATE, async route => {
    if (route.request().method() !== 'POST') return route.fallback();
    bodies.push((route.request().postDataJSON() as { data: Record<string, unknown> }).data);
    const [status, body] = await answer(bodies.length);
    return json(route, body, status);
  });
  return bodies;
}
const refusal = (bluCode: string, message: string, status = 400, details: Record<string, unknown> = {}) =>
  [
    status,
    {
      data: null,
      error: {
        status,
        name: 'BadRequestError',
        message,
        details: { bluCode, ...details },
      },
    },
  ] as [number, unknown];
const booking = (code: string) => ({
  data: {
    documentId: 'e2ebooking1',
    code,
    startDate: at(3, 6),
    endDate: at(3, 18),
    bookingStatus: 'pending',
    priceTotal: 300,
    depositAmount: 0,
    paymentStatus: 'unpaid',
    contactPhone: '0712345678',
  },
});

/** The profile PATCH, always mocked; returns the bodies. */
async function mockProfileWrite(page: Page) {
  const writes: unknown[] = [];
  await page.route(PROFILE, async route => {
    const m = route.request().method();
    if (m === 'GET') return route.fallback();
    writes.push(route.request().postDataJSON());
    return route.fulfill({ status: 204, body: '' });
  });
  return writes;
}

let jwt: string;
test.beforeAll(async ({ request }) => {
  jwt = await qaJwt(request);
});

async function open(page: Page, q = query(), lake?: Record<string, unknown>) {
  await signIn(page.context(), jwt);
  if (lake) {
    await page.context().addCookies([
      {
        name: RESHAPE,
        value: encodeURIComponent(JSON.stringify(lake)),
        domain: new URL(BASE_URL).hostname,
        path: '/',
      },
    ]);
  }
  await page.goto(`${PATH}?${q}`);
}
const h1 = (page: Page) => page.getByRole('heading', { level: 1, name: 'Confirmă rezervarea' });
const cta = (page: Page) => page.getByTestId('booking-submit');
const surface = (page: Page) => page.locator('dialog[open]');
const confirmBtn = (page: Page) => page.getByTestId('booking-confirm-submit');
const toast = (page: Page, text: string | RegExp) => page.getByText(text);

async function ready(page: Page) {
  await expect(h1(page)).toBeVisible();
  await expect(page.getByTestId('review-summary')).toBeVisible();
  await expect(cta(page)).not.toHaveAttribute('aria-disabled', 'true');
}
/** The profile prefill has landed (name and phone). */
async function prefilled(page: Page) {
  await expect(page.getByLabel('Nume și prenume')).not.toHaveValue('');
  await expect(page.getByLabel('Număr telefon')).not.toHaveValue('');
}
async function openConfirm(page: Page) {
  await ready(page);
  await prefilled(page);
  await cta(page).click();
  await expect(surface(page)).toBeVisible();
}

/** A client-side navigation (Next's router, same document) — what a <Link> does. */
async function clientPush(page: Page, href: string) {
  await page.evaluate(h => (window as unknown as { next: { router: { push: (h: string) => void } } }).next.router.push(h), href);
}
/** A click on the site header's «Bălți» link, the way the browser dispatches it (the modal makes it inert to the pointer). */
async function clickHeaderLink(page: Page) {
  const found = await page.evaluate(() => {
    const a = document.querySelector<HTMLAnchorElement>('header a[href="/balti"]');
    a?.click();
    return !!a;
  });
  expect(found).toBe(true);
}

async function shot(page: Page, name: string) {
  await page.waitForTimeout(400);
  await page.screenshot({
    path: `${SHOTS}/${name}-${page.viewportSize()?.width}.png`,
    fullPage: true,
  });
}

/* ------------------------------------------------------------------------------------------------
 * Signed out / guards
 * ---------------------------------------------------------------------------------------------- */

test.describe('signed out', () => {
  test('booking.b.sign-in-gate: a real 307 to /intra, returning to this step with its selection', async ({ request }) => {
    const res = await request.get(`${BASE_URL}${PATH}?${query()}`, {
      maxRedirects: 0,
    });
    expect(res.status()).toBe(307);
    const loc = new URL(res.headers().location, BASE_URL);
    expect(loc.pathname).toBe('/intra');
    const next = new URL(loc.searchParams.get('next')!, BASE_URL);
    expect(next.pathname).toBe(PATH);
    expect(next.searchParams.get('stand')).toBe(STAND);
  });
});

test.describe('signed in', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test('c1: no selection, or a stand the lake does not have → the grid, before the step renders', async ({ page }) => {
    await mockQuote(page);
    await signIn(page.context(), jwt);
    let reviewSeen = false;
    page.on('framenavigated', () => undefined);
    await page.goto(PATH);
    await expect(page).toHaveURL(new RegExp(`${GRID}$`));
    reviewSeen = await page.getByTestId('review-summary').isVisible();
    expect(reviewSeen).toBe(false);

    await page.goto(`${PATH}?${query(sel(3, 'nosuchstand'))}`);
    await expect(page).toHaveURL(new RegExp(`${GRID}$`));
    await expect(page.getByTestId('review-summary')).toHaveCount(0);

    // Booking turned off since: the grid too.
    await page.route(AVAIL, async route => {
      const res = await route.fetch();
      const body = (await res.json()) as { data: Record<string, unknown> };
      return json(route, { data: { ...body.data, bookingEnabled: false } });
    });
    await page.goto(`${PATH}?${query()}`);
    await expect(page).toHaveURL(new RegExp(`${GRID}$`));
  });

  test('c1: an unknown lake is a 404', async ({ page }) => {
    await signIn(page.context(), jwt);
    const res = await page.goto(`/balti/nosuchlake123/rezerva/confirmare?${query()}`);
    await expect(page.getByText(/nu există|nu a fost găsit|404/i).first()).toBeVisible();
    expect(res).not.toBeNull();
  });

  /* ----------------------------------------------------------------------------------------------
   * No price (c3)
   * -------------------------------------------------------------------------------------------- */

  test('c3: quoting → «Se calculează prețul…»; refused → the server sentence; failed → retry; no CTA; «Înapoi la selecție»', async ({
    page,
  }) => {
    const errors = collectConsoleErrors(page, { ignore: EXPECTED_CONSOLE });
    let release: () => void = () => undefined;
    const gate = new Promise<void>(r => (release = r));
    let mode: 'slow' | 'refused' | 'failed' | 'ok' = 'slow';
    await mockQuote(page, async () => {
      if (mode === 'slow') {
        await gate;
        return priced();
      }
      if (mode === 'refused')
        return {
          data: {
            total: null,
            basis: null,
            refusal: {
              code: 'END_TIME',
              message: 'Balta nu permite plecarea la 06:00.',
            },
          },
        };
      if (mode === 'failed') return 500;
      return priced();
    });
    await open(page);
    await expect(page.getByTestId('quote-pending')).toHaveText('Se calculează prețul…');
    await expect(cta(page)).toHaveCount(0);
    await expect(page.getByTestId('quote-unavailable-back')).toBeVisible();
    for (const w of WIDTHS) {
      await page.setViewportSize({ width: w, height: 900 });
      await shot(page, 'quoting');
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    release();
    await ready(page);

    mode = 'refused';
    await page.reload();
    await expect(page.getByRole('alert').filter({ hasText: 'Balta nu permite plecarea la 06:00.' })).toBeVisible();
    await expect(page.getByText('Alege alt interval sau alt stand.')).toBeVisible();
    await expect(page.getByTestId('quote-unavailable-retry')).toHaveCount(0);
    await expect(cta(page)).toHaveCount(0);
    await expectNoA11yViolations(page);
    for (const w of WIDTHS) {
      await page.setViewportSize({ width: w, height: 900 });
      await shot(page, 'refused');
    }
    await page.setViewportSize({ width: 1440, height: 900 });

    mode = 'failed';
    await page.reload();
    await expect(page.getByText('Nu am putut calcula prețul pentru acest interval.')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Verifică legătura la internet și încearcă din nou.')).toBeVisible();
    await expect(cta(page)).toHaveCount(0);
    for (const w of WIDTHS) {
      await page.setViewportSize({ width: w, height: 900 });
      await shot(page, 'failed');
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    mode = 'ok';
    await page.getByTestId('quote-unavailable-retry').click();
    await ready(page);

    // «Înapoi la selecție» → the grid without the selection.
    mode = 'refused';
    await page.reload();
    await page.getByTestId('quote-unavailable-back').click();
    await expect(page).toHaveURL(new RegExp(`${GRID}$`));
    expect(errors).toEqual([]);
  });

  /* ----------------------------------------------------------------------------------------------
   * Priced (c4–c13, b.server-priced)
   * -------------------------------------------------------------------------------------------- */

  test('c4 c5 c6 c7 c8 / b.server-priced: summary, chips, period, the server breakdown, the request notice (all widths)', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await mockQuote(page, () =>
      priced(650, {
        rowLabel: 'Pachet weekend redus',
        tourPrice: 500,
        extras: [
          {
            key: 'cabana150',
            label: 'Cabana',
            unit: 'perNight',
            unitPrice: 75,
            quantity: 2,
            total: 150,
          },
        ],
      })
    );
    await open(page, query(sel(3), ['cabana150']));
    await ready(page);
    const card = page.getByTestId('review-summary');
    await expect(card.getByTestId('stand-badge')).toHaveText('1');
    await expect(card.getByRole('heading', { name: 'Chita Lake' })).toBeVisible();
    await expect(card.getByText('Test', { exact: true })).toBeVisible();
    await expect(card.locator('[data-chip]')).toHaveText(['Standul 1', '12h zi', 'Numerar']);
    await expect(page.getByTestId('review-period')).toHaveText(periodText(3));
    await expect(page.getByTestId('review-rate')).toHaveText('Pachet weekend redus');
    // From 1280 the money is in the right column.
    const aside = page.getByTestId('review-aside');
    await expect(aside).toContainText('Pachet weekend redus');
    await expect(aside).toContainText('500 lei');
    await expect(aside).toContainText('Cabana × 2');
    await expect(aside).toContainText('150 lei');
    await expect(aside).toContainText('Total');
    await expect(aside).toContainText('se plătește la fața locului');
    await expect(aside).toContainText('650 lei');
    await expect(page.getByTestId('review-money')).toBeHidden();
    await expect(page.getByText('Este o cerere, nu o rezervare confirmată')).toBeVisible();
    await expect(page.getByText('Administratorul lacului o acceptă sau o refuză.')).toBeVisible();
    await expectNoA11yViolations(page);
    for (const w of WIDTHS) {
      await page.setViewportSize({ width: w, height: 900 });
      await shot(page, 'priced-request');
    }
    // Below 1280 the card carries the money.
    await page.setViewportSize({ width: 375, height: 800 });
    await expect(page.getByTestId('review-money')).toBeVisible();
    await expect(page.getByTestId('review-money')).toContainText('650 lei');
    await expectNoA11yViolations(page);
    expect(errors).toEqual([]);
  });

  test('c5 c6: a rate named after its length adds nothing — no pill, the row says «12h»', async ({ page }) => {
    await mockQuote(page, () => priced(300, { rowLabel: 'Tur 12h' }));
    await open(page);
    await ready(page);
    await expect(page.getByTestId('review-rate')).toHaveCount(0);
    await expect(page.getByTestId('review-aside')).toContainText('12h');
    await expect(page.getByTestId('review-aside')).not.toContainText('Tur 12h');
  });

  test('c7 c8: payment modes — deposit, full (instant), offline', async ({ page }) => {
    await mockQuote(page, () => priced(333));
    await open(page, query(), {
      paymentMode: 'deposit',
      depositPercent: 30,
      confirmationMode: 'instant',
    });
    await ready(page);
    const aside = page.getByTestId('review-aside');
    await expect(aside).toContainText('Avans de plată');
    await expect(aside).toContainText('30% din 333 lei');
    await expect(aside).toContainText('99,9 lei');
    await expect(page.getByText('Este o cerere, nu o rezervare confirmată')).toHaveCount(0);
    await expect(page.getByTestId('review-summary').locator('[data-chip]')).toHaveText(['Standul 1', '12h zi']);
    for (const w of WIDTHS) {
      await page.setViewportSize({ width: w, height: 900 });
      await shot(page, 'priced-deposit');
    }
    await page.setViewportSize({ width: 1440, height: 900 });

    await open(page, query(), {
      paymentMode: 'full',
      confirmationMode: 'instant',
    });
    await ready(page);
    await expect(aside).toContainText('De plată acum');
    await expect(aside).toContainText('333 lei');
    await expect(aside).not.toContainText('fața locului');
  });

  test('c9 c10 c11 c12 c13: the contact form — prefill (also late, never over typed text), the phone filter, validation, focus', async ({
    page,
  }) => {
    const errors = collectConsoleErrors(page);
    await mockQuote(page);
    await mockProfileWrite(page);
    // The profile answers late, after the user has typed a name.
    let releaseProfile: () => void = () => undefined;
    const profileGate = new Promise<void>(r => (releaseProfile = r));
    let profile: { username: string; phone: string | null } | null = null;
    await page.route(PROFILE, async route => {
      if (route.request().method() !== 'GET') return route.fallback();
      await profileGate;
      const res = await route.fetch();
      const body = (await res.json()) as Record<string, unknown>;
      profile = {
        username: body.username as string,
        phone: (body.phone as string | null) ?? null,
      };
      return route.fulfill({
        response: res,
        json: { ...body, phone: '0711222333' },
      });
    });
    await open(page);
    await ready(page);
    const name = page.getByLabel('Nume și prenume');
    const phone = page.getByLabel('Număr telefon');
    const notes = page.getByLabel('Detalii adiționale');
    await expect(name).toHaveAttribute('placeholder', 'Numele tău');
    await expect(phone).toHaveAttribute('placeholder', '07XX XXX XXX');
    await expect(phone).toHaveAttribute('type', 'tel');
    await expect(notes).toHaveAttribute('placeholder', 'Detalii adiționale, ora estimată de sosire, etc.');
    await expect(name).toHaveValue('');
    await name.fill('Ana Pescar');
    releaseProfile();
    await expect(phone).toHaveValue('0711222333');
    await expect(name).toHaveValue('Ana Pescar');
    expect(profile).not.toBeNull();

    // c11: digits and one leading + only.
    await phone.fill('');
    await phone.pressSequentially('+40 (712) 345-678a');
    await expect(phone).toHaveValue('+40712345678');

    // c12 c13: everything wrong → the summary, focus on the first invalid field (name).
    await name.fill('   ');
    await phone.fill('');
    await notes.fill('x'.repeat(1001));
    await cta(page).click();
    await expect(page.getByText('3 câmpuri trebuie corectate')).toBeVisible();
    await expect(page.getByText('Acest câmp este obligatoriu')).toHaveCount(2); // summary + field
    await expect(page.getByText('Adaugă un număr de telefon.').first()).toBeVisible();
    await expect(page.getByText('Ai voie maxim 1000 de caractere').first()).toBeVisible();
    await expect(name).toBeFocused();
    await expect(surface(page)).toHaveCount(0);
    for (const w of WIDTHS) {
      await page.setViewportSize({ width: w, height: 900 });
      await shot(page, 'validation');
    }
    await page.setViewportSize({ width: 375, height: 740 });
    await expectNoA11yViolations(page);
    // Phone is next: a short number.
    await name.fill('Ana');
    await phone.fill('0712');
    await expect(page.getByText('Numărul de telefon trebuie să aibă între 7 și 15 cifre').first()).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 0));
    await cta(page).click();
    await expect(phone).toBeFocused();
    await expect(phone).toBeInViewport();
    await phone.fill('0712345678');
    await notes.fill('Ajung la 7.');
    await cta(page).click();
    await expect(surface(page)).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('c26: the CTA is pinned to the bottom edge on a phone and rides above an on-screen keyboard', async ({ page }) => {
    await mockQuote(page);
    await page.setViewportSize({ width: 375, height: 740 });
    await open(page);
    await ready(page);
    const box = await cta(page).boundingBox();
    expect(box!.y + box!.height).toBeGreaterThan(740 - 90);
    // The keyboard inset the page writes from VisualViewport lifts the bar (useKeyboardInset).
    await page.evaluate(() => document.documentElement.style.setProperty('--review-kb-inset', '300px'));
    const lifted = await cta(page).boundingBox();
    expect(lifted!.y + lifted!.height).toBeLessThan(740 - 300 + 10);
  });

  /* ----------------------------------------------------------------------------------------------
   * The confirmation (c14–c17) + keyboard
   * -------------------------------------------------------------------------------------------- */

  test('c14 c17: request lake — terms in order, «Trimite cererea», no cancellation row (cash on site); keyboard: trap, Escape, focus returns', async ({
    page,
  }) => {
    const errors = collectConsoleErrors(page);
    await mockQuote(page, () => priced(300));
    await open(page);
    await ready(page);
    await prefilled(page);
    await cta(page).focus();
    await page.keyboard.press('Enter');
    const s = surface(page);
    await expect(s).toBeVisible();
    await expect(s.getByRole('heading', { name: 'Confirmă rezervarea' })).toBeVisible();
    await expect(s).toContainText('Chita Lake · Standul 1');
    const terms = s.getByTestId('booking-confirm-terms').locator('li');
    await expect(terms).toHaveText([
      periodText(3),
      '300 lei, se plătesc la fața locului',
      'Este o cerere, nu o confirmare. Administratorul o acceptă sau o refuză.',
    ]);
    // One after another: increasing delays.
    const delays = await terms.evaluateAll(els => els.map(e => getComputedStyle(e).transitionDelay));
    expect(delays).toEqual(['0.08s', '0.14s', '0.2s']);
    await expect(s.getByTestId('booking-confirm-regulation')).toHaveCount(0);
    await expect(confirmBtn(page)).toHaveText('Trimite cererea');
    await expect(s.getByRole('button', { name: 'Înapoi' })).toBeVisible();
    await expect(s.getByText('Prin continuare confirmi că ai citit și accepți regulamentul bălții.')).toBeVisible();
    await page.waitForTimeout(800); // the rows' entrance
    await expectNoA11yViolations(page);
    // Focus trap (native modal <dialog>): Tab never reaches the page behind — inside the surface, or
    // out to the browser's own UI (document.body) and back in.
    let inside = 0;
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Tab');
      const where = await page.evaluate(() =>
        document.activeElement?.closest('dialog[open]') ? 'inside' : document.activeElement === document.body ? 'chrome' : 'page'
      );
      expect(where).not.toBe('page');
      if (where === 'inside') inside += 1;
    }
    expect(inside).toBeGreaterThan(4);
    await s.getByRole('button', { name: 'Înapoi' }).focus();
    await page.keyboard.press('Escape');
    await expect(s).toHaveCount(0);
    await expect(cta(page)).toBeFocused();
    // «Înapoi» closes too.
    await cta(page).click();
    await surface(page).getByRole('button', { name: 'Înapoi' }).click();
    await expect(surface(page)).toHaveCount(0);
    for (const w of WIDTHS) {
      await page.setViewportSize({ width: w, height: 900 });
      await cta(page).click();
      await expect(surface(page)).toBeVisible();
      await shot(page, 'confirm-request');
      await page.keyboard.press('Escape');
      await expect(surface(page)).toHaveCount(0);
    }
    await page.setViewportSize({ width: 375, height: 800 });
    await cta(page).click();
    await page.waitForTimeout(800);
    await expectNoA11yViolations(page); // the phone's sheet
    expect(errors).toEqual([]);
  });

  test('c14 c15 c16 c17: instant deposit lake — «Rezervă», the cancellation row, the regulation PDF in a new tab', async ({ page }) => {
    await mockQuote(page, () => priced(300));
    await open(page, query(), {
      paymentMode: 'deposit',
      depositPercent: 30,
      confirmationMode: 'instant',
      regulationUrl: 'https://example.com/regulament.pdf',
      cancellationPolicy: { type: 'refundable', refundWindowHours: 48 },
    });
    await openConfirm(page);
    const s = surface(page);
    await expect(s.getByTestId('booking-confirm-terms').locator('li')).toHaveText([
      periodText(3),
      'Avans 30% din 300 lei, restul la fața locului',
      'Rezervarea se confirmă imediat.',
      'Anulare cu rambursare dacă anulezi cu cel puțin 48 ore înainte.',
    ]);
    const reg = s.getByTestId('booking-confirm-regulation');
    await expect(reg).toContainText('Deschide regulamentul (PDF)');
    await expect(reg).toHaveAttribute('href', 'https://example.com/regulament.pdf');
    await expect(reg).toHaveAttribute('target', '_blank');
    await expect(confirmBtn(page)).toHaveText('Rezervă');
    await page.waitForTimeout(800); // the rows' entrance
    await expectNoA11yViolations(page);
    for (const w of WIDTHS) {
      await page.setViewportSize({ width: w, height: 900 });
      await shot(page, 'confirm-instant');
    }
  });

  test('c15: the other policies; full payment collects up front too', async ({ page }) => {
    await mockQuote(page, () => priced(300));
    const cases: [Record<string, unknown>, string][] = [
      [{ type: 'refundable', refundWindowHours: 0 }, 'Anulare cu rambursare.'],
      [{ type: 'nonRefundable', refundWindowHours: 0 }, 'Avansul nu se restituie.'],
      [{ type: 'rescheduleOnly', refundWindowHours: 24 }, 'Reprogramare posibilă dacă anunți cu cel puțin 24 ore înainte.'],
      [{ type: 'rescheduleOnly', refundWindowHours: 0 }, 'Reprogramare (fără rambursare în numerar).'],
      [{ type: 'other', refundWindowHours: 0 }, 'Contactează administratorul lacului pentru detalii despre anulare.'],
    ];
    for (const [policy, text] of cases) {
      await open(page, query(), {
        paymentMode: 'full',
        confirmationMode: 'instant',
        cancellationPolicy: policy,
      });
      await openConfirm(page);
      const terms = surface(page).getByTestId('booking-confirm-terms').locator('li');
      await expect(terms.nth(1)).toHaveText('300 lei, se plătesc acum');
      await expect(terms.nth(3)).toHaveText(text);
    }
    await open(page, query(), {
      paymentMode: 'full',
      confirmationMode: 'instant',
      cancellationPolicy: null,
    });
    await openConfirm(page);
    await expect(surface(page).getByTestId('booking-confirm-terms').locator('li').nth(3)).toHaveText(
      'Contactează administratorul lacului pentru detalii despre anulare.'
    );
  });

  /* ----------------------------------------------------------------------------------------------
   * The submit (c18–c24, b.double-submit-guard), mocked
   * -------------------------------------------------------------------------------------------- */

  test('c18 c19 c20 / b.double-submit-guard: the body, the phone write-back only when changed, back and links frozen, success leaves the flow for good', async ({
    page,
  }) => {
    const errors = collectConsoleErrors(page);
    await mockQuote(page, () => priced(320));
    const writes = await mockProfileWrite(page);
    let release: () => void = () => undefined;
    const gate = new Promise<void>(r => (release = r));
    const bodies = await mockCreate(page, async () => {
      await gate;
      return [200, booking('BK7Q2')];
    });
    // Entered from the lake page, in the same document: success traverses back there.
    await signIn(page.context(), jwt);
    await page.goto(`/balti/${LAKE}`);
    await clientPush(page, `${PATH}?${query(sel(3), [])}`);
    await ready(page);
    await prefilled(page);
    const phone = page.getByLabel('Număr telefon');
    await expect(phone).not.toHaveValue('');
    const original = await phone.inputValue();
    await page.getByLabel('Nume și prenume').fill('  Ana Pescar ');
    await page.getByLabel('Detalii adiționale').fill('Ajung la 7.');
    await cta(page).click();
    await confirmBtn(page).click();
    // In flight: spinner, frozen.
    await expect(confirmBtn(page)).toHaveAttribute('aria-busy', 'true');
    await expect(cta(page)).toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByRole('button', { name: 'Înapoi', exact: true }).first()).toHaveAttribute('aria-disabled', 'true');
    await confirmBtn(page).click({ force: true });
    await page.keyboard.press('Escape');
    await expect(surface(page)).toBeVisible();
    // Neither a site-header link (a Next <Link> push) nor the browser's Back leaves the review.
    await clickHeaderLink(page);
    await page.evaluate(() => history.back());
    await page.waitForTimeout(500);
    await expect(page).toHaveURL(new RegExp(`${PATH}\\?`));
    await expect(surface(page)).toBeVisible();
    expect(bodies).toHaveLength(1);
    expect(bodies[0]).toEqual({
      lake: LAKE,
      stand: STAND,
      startDate: sel(3).start,
      endDate: sel(3).end,
      extras: [],
      notes: 'Ajung la 7.',
      contactFullname: 'Ana Pescar',
      contactPhone: original,
      expectedTotal: 320,
    });
    expect(writes).toEqual([]); // phone unchanged → no profile write
    release();
    await expect(toast(page, 'Cererea a fost trimisă! Cod: BK7Q2. Vei fi notificat când este confirmată.')).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/balti/${LAKE}$`));
    expect(bodies).toHaveLength(1);
    // The review's entry was sealed on the way out: Forward lands on the bare grid, never on a
    // priced review with a live CTA (fish dismisses the flow).
    await page.goForward();
    await expect(page).toHaveURL(`${BASE_URL}${GRID}`);
    await expect(page.getByTestId('booking-submit')).toHaveCount(0);
    await expect(h1(page)).toHaveCount(0);
    expect(bodies).toHaveLength(1);
    expect(errors).toEqual([]);
  });

  test('b.double-submit-guard: without the Navigation API, the browser Back is undone while sending (sentinel entry)', async ({ page }) => {
    await page.addInitScript(() =>
      Object.defineProperty(window, 'navigation', {
        value: undefined,
        configurable: true,
      })
    );
    await mockQuote(page, () => priced(300));
    await mockProfileWrite(page);
    let release: () => void = () => undefined;
    const gate = new Promise<void>(r => (release = r));
    const bodies = await mockCreate(page, async () => {
      await gate;
      return [200, booking('BKNONAV')];
    });
    await signIn(page.context(), jwt);
    await page.goto(`/balti/${LAKE}`);
    await clientPush(page, `${PATH}?${query()}`);
    await openConfirm(page);
    await confirmBtn(page).click();
    await expect(confirmBtn(page)).toHaveAttribute('aria-busy', 'true');
    await page.evaluate(() => history.back());
    await page.waitForTimeout(500);
    await expect(page).toHaveURL(new RegExp(`${PATH}\\?`));
    await expect(surface(page)).toBeVisible();
    await clickHeaderLink(page);
    await page.waitForTimeout(300);
    await expect(page).toHaveURL(new RegExp(`${PATH}\\?`));
    release();
    await expect(toast(page, 'Cererea a fost trimisă! Cod: BKNONAV. Vei fi notificat când este confirmată.')).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/balti/${LAKE}$`));
    expect(bodies).toHaveLength(1);
  });

  test("c1: a tour the live availability no longer has free (here: the angler's own) → the grid, «Intervalul ales nu mai e liber.»", async ({
    page,
  }) => {
    await mockQuote(page, () => priced(300));
    const s = sel(3);
    // The live read, with this very tour booked.
    await page.route(AVAIL, async route => {
      const res = await route.fetch();
      const body = (await res.json()) as { data: Avail };
      body.data.bookings = [...body.data.bookings, { standDocumentId: s.stand, start: s.start, end: s.end }];
      return route.fulfill({ response: res, json: body });
    });
    await open(page, query(s));
    await expect(toast(page, 'Intervalul ales nu mai e liber.')).toBeVisible();
    await expect(page).toHaveURL(`${BASE_URL}${GRID}`);
    await expect(page.getByTestId('booking-submit')).toHaveCount(0);
  });

  test('c19 c20: a changed phone is written back (fire-and-forget); instant lake, no code; no entry in history → the lake page', async ({
    page,
  }) => {
    await mockQuote(page, () => priced(300));
    const writes = await mockProfileWrite(page);
    const bodies = await mockCreate(page, () => [200, { data: { ...booking('').data, code: '' } }]);
    await open(page, query(), {
      paymentMode: 'deposit',
      depositPercent: 30,
      confirmationMode: 'instant',
    });
    await ready(page);
    await prefilled(page);
    await page.getByLabel('Număr telefon').fill('0799888777');
    await cta(page).click();
    await confirmBtn(page).click();
    await expect(toast(page, /^Rezervare confirmată!$/)).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/balti/${LAKE}$`));
    expect(writes).toEqual([{ phone: '0799888777' }]);
    expect(bodies[0].contactPhone).toBe('0799888777');
    // c25: no payment UI anywhere.
    await expect(page.getByText(/plat[ăa] online|card/i)).toHaveCount(0);
  });

  test('c25: a client secret in the answer is ignored — no payment sheet, the plain success', async ({ page }) => {
    await mockQuote(page, () => priced(300));
    await mockProfileWrite(page);
    await mockCreate(page, () => [200, { ...booking('PAY1'), payment: { clientSecret: 'pi_secret_x' } }]);
    await open(page, query(), {
      paymentMode: 'full',
      confirmationMode: 'instant',
    });
    await openConfirm(page);
    await confirmBtn(page).click();
    await expect(toast(page, 'Rezervare confirmată! Cod: PAY1.')).toBeVisible();
    await expect(page.locator('iframe[src*="stripe"]')).toHaveCount(0);
  });

  test('c22 / b.server-priced: 409 PRICE_CHANGED with and without the fresh total → stay, the quote is read again', async ({ page }) => {
    const errors = collectConsoleErrors(page, { ignore: EXPECTED_CONSOLE });
    let total = 300;
    const quotes = await mockQuote(page, () => priced(total));
    await mockProfileWrite(page);
    let withFigure = true;
    const bodies = await mockCreate(page, () =>
      refusal('PRICE_CHANGED', 'Prețul s-a actualizat. Verifică noul total și confirmă din nou.', 409, withFigure ? { priceTotal: 360 } : {})
    );
    await open(page);
    await openConfirm(page);
    total = 360;
    const before = quotes();
    await confirmBtn(page).click();
    await expect(surface(page)).toHaveCount(0);
    await expect(
      page.getByRole('alert').filter({
        hasText: 'Prețul s-a actualizat la 360 lei. Verifică și confirmă din nou.',
      })
    ).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`${PATH}\\?`));
    await expect.poll(quotes).toBeGreaterThan(before);
    await expect(page.getByTestId('review-aside')).toContainText('360 lei');
    expect(bodies[0].expectedTotal).toBe(300);
    // Confirming again sends the fresh figure.
    withFigure = false;
    await cta(page).click();
    await confirmBtn(page).click();
    expect(bodies[1].expectedTotal).toBe(360);
    await expect(
      page.getByRole('alert').filter({
        hasText: 'Prețul s-a actualizat. Verifică noul total și confirmă din nou.',
      })
    ).toBeVisible();
    expect(errors).toEqual([]);
  });

  for (const [code, text] of [
    ['STAND_TAKEN', 'Standul tocmai a fost rezervat. Am actualizat intervalele — alege altul.'],
    ['STAND_BLOCKED', 'Intervalul nu mai este disponibil. Am actualizat intervalele — alege altul.'],
  ] as const) {
    test(`c23: ${code} → the grid without the selection, the availability read again`, async ({ page }) => {
      await mockQuote(page, () => priced(300));
      await mockProfileWrite(page);
      await mockCreate(page, () => refusal(code, 'Fraza serverului.'));
      let availReads = 0;
      await page.route(AVAIL, route => {
        availReads += 1;
        return route.fallback();
      });
      // Through the grid: lake → bare grid → grid with the selection (pushed by the grid) → review.
      await signIn(page.context(), jwt);
      await page.goto(`/balti/${LAKE}`);
      await page.goto(GRID);
      await page.goto(`${GRID}?${query()}`);
      await page.goto(`${PATH}?${query()}`);
      await openConfirm(page);
      const reads = availReads;
      await confirmBtn(page).click();
      await expect(page.getByRole('alert').filter({ hasText: text })).toBeVisible();
      await expect(page).toHaveURL(new RegExp(`${GRID}$`));
      await expect.poll(() => availReads).toBeGreaterThan(reads);
    });
  }

  test('c24: the other codes — mapped copy, a server sentence, an unknown failure', async ({ page }) => {
    const errors = collectConsoleErrors(page, { ignore: EXPECTED_CONSOLE });
    await mockQuote(page, () => priced(300));
    await mockProfileWrite(page);
    const cases: [[number, unknown], string][] = [
      [refusal('NAME_REQUIRED', 'x'), 'Adaugă numele pentru rezervare.'],
      [refusal('PHONE_REQUIRED', 'x'), 'Adaugă un număr de telefon.'],
      [refusal('INVALID_DURATION', 'x'), 'Durata selectată nu este validă.'],
      [refusal('INVALID_SLOT_ALIGNMENT', 'x'), 'Intervalul ales nu începe la o oră de start validă.'],
      [refusal('END_TIME_NOT_ALLOWED', 'x'), 'Balta nu acceptă rezervări care se încheie la ora aceasta. Alege alt interval.'],
      [refusal('START_IN_PAST', 'x'), 'Nu poți rezerva un interval din trecut.'],
      [refusal('BOOKING_DISABLED', 'x'), 'Rezervările nu sunt active pentru acest lac.'],
      [refusal('PAYMENTS_NOT_CONFIGURED', 'x'), 'Plățile online nu sunt disponibile momentan.'],
      [
        refusal('ANGLER_BOOKING_QUOTA', 'Ai deja numărul maxim de rezervări active la această baltă.'),
        'Ai deja numărul maxim de rezervări active la această baltă.',
      ],
      [
        [
          500,
          {
            data: null,
            error: {
              status: 500,
              name: 'InternalServerError',
              message: 'Internal Server Error',
            },
          },
        ],
        'A apărut o eroare. Încearcă din nou.',
      ],
    ];
    let i = 0;
    await mockCreate(page, () => cases[i][0]);
    await open(page);
    await ready(page);
    await prefilled(page);
    for (i = 0; i < cases.length; i++) {
      await cta(page).click();
      await confirmBtn(page).click();
      await expect(surface(page)).toHaveCount(0);
      await expect(page.getByRole('alert').filter({ hasText: cases[i][1] })).toBeVisible();
      await expect(page).toHaveURL(new RegExp(`${PATH}\\?`));
    }
    expect(errors).toEqual([]);
  });

  test('c2: back walks one step — the grid for a tour without extras, the extras step with', async ({ page }) => {
    await mockQuote(page);
    await signIn(page.context(), jwt);
    // Without a flow entry before it: the grid, with the selection kept.
    await page.goto(`${PATH}?${query()}`);
    await ready(page);
    await page.getByRole('button', { name: 'Înapoi', exact: true }).first().click();
    await expect(page).toHaveURL(`${BASE_URL}${GRID}?${query()}`);
    // A night tour on a cabin stand (stand 7 adds «cabana150» to a night): the extras step.
    const night = {
      stand: 'f7fvts8a4rei4mgquzgg6o6b',
      start: at(3, 18),
      end: at(4, 6),
    };
    await page.goto(`${PATH}?${query(night, ['cabana150'])}`);
    await ready(page);
    await page.getByRole('button', { name: 'Înapoi', exact: true }).first().click();
    await expect(page).toHaveURL(new RegExp(`${GRID}/extra\\?`));
    // Through the grid (one document): Back is a pop of the pushed step, never a pushed copy.
    await page.goto(`${GRID}?${query()}`);
    await page.getByTestId('selection-continue').click();
    await expect(page).toHaveURL(new RegExp(`${PATH}\\?`));
    await ready(page);
    const index = () =>
      page.evaluate(
        () =>
          (
            window as unknown as {
              navigation: { currentEntry: { index: number } };
            }
          ).navigation.currentEntry.index
      );
    const at0 = await index();
    await page.getByRole('button', { name: 'Înapoi', exact: true }).first().click();
    await expect(page).toHaveURL(`${BASE_URL}${GRID}?${query()}`);
    expect(await index()).toBe(at0 - 1);
  });

  /* ----------------------------------------------------------------------------------------------
   * The one real create (LOCAL CMS), cancelled in finally
   * -------------------------------------------------------------------------------------------- */

  test('c18 c20 c21 / b.write-invalidation: ONE real request on the local Chita, cancelled after', async ({ page, request }) => {
    await mockProfileWrite(page);
    // A slot past the lead time and inside the horizon, on a stand free that day (live availability).
    const s = await freeSlot(request);
    test.skip(!s, 'no free 06–18 slot on Chita in the next two weeks');
    let created: string | null = null;
    /** The my-bookings reads through the proxy, with whether the create had already answered. */
    const mine: { afterCreate: boolean; body: string }[] = [];
    page.on('response', async res => {
      if (CREATE.test(res.url()) && res.request().method() === 'POST' && res.ok()) {
        created = ((await res.json()) as { data: { documentId: string } }).data.documentId;
      } else if (MINE.test(res.url()) && res.request().method() === 'GET') {
        const afterCreate = created !== null;
        mine.push({ afterCreate, body: await res.text().catch(() => '') });
      }
    });
    try {
      // Entered from «Rezervări» (its list is now in this document's cache, fresh for a minute), the
      // review reached client-side: success traverses back to the list in the same document.
      await signIn(page.context(), jwt);
      await page.goto('/rezervari');
      await expect.poll(() => mine.length).toBeGreaterThan(0);
      await clientPush(page, `${PATH}?${query(s!)}`);
      await ready(page);
      await prefilled(page);
      await cta(page).click();
      await confirmBtn(page).click();
      const t = page.getByText(/^Cererea a fost trimisă! Cod: [A-Z0-9-]+\. Vei fi notificat când este confirmată\.$/);
      await expect(t).toBeVisible({ timeout: 30_000 });
      await expect(page).toHaveURL(`${BASE_URL}/rezervari`);
      await expect.poll(() => created).not.toBeNull();
      // b.write-invalidation, from the client cache: the list is well inside its 60s staleTime, so it
      // is read again on the remount only because the create invalidated ['bookings'] — and the read
      // shows the new booking: in its rows, or — when the local CMS holds a full first page of later
      // stays (other specs' cancelled / rejected requests sort above it) — in the page's pending count.
      const pendingOf = (body: string) => {
        try {
          return (JSON.parse(body) as { meta?: { pendingCount?: number } }).meta?.pendingCount ?? 0;
        } catch {
          return 0;
        }
      };
      const before = Math.max(0, ...mine.filter(m => !m.afterCreate).map(m => pendingOf(m.body)));
      await expect
        .poll(() => mine.some(m => m.afterCreate && (m.body.includes(created!) || pendingOf(m.body) > before)), { timeout: 15_000 })
        .toBe(true);
      // And the slot is now taken in the live availability (the CMS side).
      const after = await availability(request, s!.start);
      expect(after.bookings.some(b => b.standDocumentId === s!.stand && Date.parse(b.start) === Date.parse(s!.start))).toBe(true);
    } finally {
      if (created) {
        const res = await request.patch(`${CMS}/feed/bookings/${created}/cancel`, {
          headers: { Authorization: `Bearer ${jwt}` },
          data: { reason: 'Test e2e — anulare automată.' },
        });
        expect(res.ok()).toBe(true);
        const check = await request.get(`${CMS}/feed/bookings/${created}`, {
          headers: { Authorization: `Bearer ${jwt}` },
        });
        expect(((await check.json()) as { data: { bookingStatus: string } }).data.bookingStatus).toBe('cancelled');
      }
    }
  });
});

type Avail = {
  stands: { documentId: string; name: string }[];
  bookings: { standDocumentId: string; start: string; end: string }[];
  blocks: { standDocumentId: string | null; start: string; end: string }[];
};
async function availability(request: APIRequestContext, fromIso: string): Promise<Avail> {
  const from = new Date(fromIso);
  from.setDate(from.getDate() - 1);
  const to = new Date(fromIso);
  to.setDate(to.getDate() + 2);
  const res = await request.get(`${CMS}/feed/lakes/${LAKE}/availability`, {
    params: { from: iso(from), to: iso(to) },
  });
  return ((await res.json()) as { data: Avail }).data;
}
async function freeSlot(request: APIRequestContext) {
  const overlaps = (a: { start: string; end: string }, s: number, e: number) => Date.parse(a.start) < e && Date.parse(a.end) > s;
  for (let day = 4; day <= 14; day++) {
    const s = at(day, 6);
    const e = at(day, 18);
    const av = await availability(request, s);
    const [S, E] = [Date.parse(s), Date.parse(e)];
    // Not the first stands: other specs may look at them.
    for (const st of [...av.stands].reverse()) {
      const busy =
        av.bookings.some(b => b.standDocumentId === st.documentId && overlaps(b, S - 3_600_000, E + 3_600_000)) ||
        av.blocks.some(b => (b.standDocumentId === null || b.standDocumentId === st.documentId) && overlaps(b, S, E));
      if (!busy) return { stand: st.documentId, start: s, end: e };
    }
  }
  return null;
}
