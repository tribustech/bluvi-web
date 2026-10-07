import { expect, test, type Page, type Route } from '@playwright/test';
import { expectNoA11yViolations } from './helpers/a11y';
import { collectConsoleErrors } from './helpers/console';
import { qaJwt, signIn } from './helpers/session';
import { booking } from './rezervari.fixtures';

/*
 * booking.rezervare (/rezervari/[id], T3 without tabs) + booking.b.notification-routes,
 * booking.rezervarile-mele c20 / c22 (the cancel dialog). fish: app/(app)/bookings/[id].tsx,
 * features/bookings/{MyBookingRow,CancelBookingSheet}.tsx, features/bookings/ui/*.
 *
 * Data: the local QA user against the LOCAL CMS. One unmocked read of a real booking (skipped when
 * the QA user has none); every state is a route mock of the browser's proxy calls
 * (/api/cms/feed/bookings/{id}, /feed/reviews/mine, PATCH /feed/bookings/{id}/cancel). No writes:
 * the real create → cancel round trip lives in the confirmation spec (booking.rezerva-confirmare).
 */

const WIDTHS = [375, 1280, 1440, 1920] as const;
const H = 3_600_000;
/** Mocked failures on purpose: the browser logs the failed resource. */
const EXPECTED_CONSOLE = [/Failed to load resource: the server responded with a status of (40[034]|50\d)/];

let jwt: string;
test.beforeAll(async ({ request }) => {
  jwt = await qaJwt(request);
});

/** Hours from now, as ISO. */
const rel = (h: number) => new Date(Date.now() + h * H).toISOString();
const LAKE = booking('x').lake;
type Over = Record<string, unknown>;
/** A booking three days out (the cancel window open) unless overridden. */
const B = (id: string, over: Over = {}) => booking(id, { startDate: rel(72), endDate: rel(84), ...over });
const PAST = { startDate: rel(-40), endDate: rel(-28) };

const S = {
  pending: B('pending', { bookingStatus: 'pending', notes: 'Vin cu fiul meu, am vrea un stand umbrit.' }),
  open: B('open'),
  closed: B('closed', { startDate: rel(5), endDate: rel(17) }),
  closed1: B('closed1', { startDate: rel(0.5), endDate: rel(12), lake: { ...LAKE, minCancelNoticeHours: 1 } }),
  live: B('live', { startDate: rel(-3.5), endDate: rel(8.5) }),
  completed: B('completed', { bookingStatus: 'completed', ...PAST }),
  endedConfirmed: B('ended', { ...PAST }),
  cancelledMe: B('cancme', { bookingStatus: 'cancelled', cancelledBy: 'angler', cancelReason: 'Nu mai pot ajunge, s-a schimbat programul.' }),
  cancelledLake: B('canclake', {
    bookingStatus: 'cancelled',
    cancelledBy: 'operator',
    cancelReason:
      'Lucrări la baltă. Am golit parțial lacul pentru igienizare și nu putem primi pescari în perioada asta, ne pare rău, vă așteptăm cu drag după ce terminăm lucrările de la mal și de la standuri.',
    notes: 'Aș vrea standul de lângă pontonul mare. [Anulare operator] Lucrări la baltă.',
  }),
  cancelledAuto: B('cancauto', { bookingStatus: 'cancelled', cancelledBy: 'system', cancelReason: 'Cererea a expirat.' }),
  rejected: B('rejected', { bookingStatus: 'rejected', cancelReason: 'Standul nu este disponibil pe acest interval.', notes: '[Refuz operator] Standul nu este disponibil.' }),
  noShow: B('noshow', { ...PAST, noShow: true, noShowComment: 'A sunat la 5 dimineața că nu mai vine.' }),
  noPhone: B('nophone', { lake: { ...LAKE, contactPhone: null } }),
  noBasis: B('nobasis', { basis: undefined }),
  composed: B('composed', {
    priceTotal: 430,
    depositAmount: 200,
    basis: {
      durationHours: 24,
      rowLabel: null,
      composedFrom: [12, 12],
      tourPrice: 200,
      extras: [
        { key: 'boat', label: 'Barcă', unit: 'perStay', unitPrice: 30, quantity: 1, total: 30 },
        { key: 'cabin', label: 'Cabană', unit: 'perNight', unitPrice: 100, quantity: 2, total: 200 },
      ],
    },
  }),
} as const;

type Reply = { status?: number; body?: unknown; delayMs?: number };

/**
 * Routes GET /api/cms/feed/bookings/{id} (not /mine, not /to-review); `fn` answers per call.
 * A failure carries the CMS's error body.
 */
async function mockBooking(page: Page, fn: (id: string, n: number) => Reply | unknown) {
  const calls: string[] = [];
  await page.route('**/api/cms/feed/bookings/*', async (r: Route) => {
    const url = new URL(r.request().url());
    const id = decodeURIComponent(url.pathname.split('/').pop() ?? '');
    if (r.request().method() !== 'GET' || id === 'mine' || id === 'to-review') return r.fallback();
    calls.push(id);
    const raw = fn(id, calls.length);
    const out: Reply = raw && typeof raw === 'object' && ('status' in raw || 'body' in raw || 'delayMs' in raw) ? (raw as Reply) : { body: { data: raw } };
    if (out.delayMs) await new Promise((res) => setTimeout(res, out.delayMs));
    const status = out.status ?? 200;
    const body = status >= 400 ? { data: null, error: { status, name: 'Error', message: status === 404 ? 'Not Found' : 'Forbidden' } } : out.body;
    return r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  });
  return calls;
}

/** GET /feed/reviews/mine?lakeId= — the viewer's review of the lake (null = none), or a status. */
async function mockMyReview(page: Page, review: unknown | number) {
  const calls = { n: 0 };
  await page.route('**/api/cms/feed/reviews/mine**', async (r: Route) => {
    calls.n += 1;
    if (typeof review === 'number') {
      return r.fulfill({ status: review, contentType: 'application/json', body: JSON.stringify({ data: null, error: { status: review, message: 'x' } }) });
    }
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: review }) });
  });
  return calls;
}

type CancelCall = { id: string; body: unknown };
/** PATCH /feed/bookings/{id}/cancel — `fn` answers (default: the booking, cancelled by the angler). */
async function mockCancel(page: Page, fn: (call: CancelCall) => Reply) {
  const calls: CancelCall[] = [];
  await page.route('**/api/cms/feed/bookings/*/cancel', async (r: Route) => {
    if (r.request().method() !== 'PATCH') return r.fallback();
    const id = decodeURIComponent(new URL(r.request().url()).pathname.split('/').slice(-2)[0]);
    const call = { id, body: r.request().postDataJSON() };
    calls.push(call);
    const out = fn(call);
    if (out.delayMs) await new Promise((res) => setTimeout(res, out.delayMs));
    return r.fulfill({ status: out.status ?? 200, contentType: 'application/json', body: JSON.stringify(out.body) });
  });
  return calls;
}

async function collectAnalytics(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as { __events: unknown[] }).__events = [];
    window.addEventListener('bluvi:analytics', (e) => (window as unknown as { __events: unknown[] }).__events.push((e as CustomEvent).detail));
  });
  return () => page.evaluate(() => (window as unknown as { __events: { name: string; params: Record<string, unknown> }[] }).__events);
}

async function open(page: Page, id: string, width = 375) {
  await page.setViewportSize({ width, height: 900 });
  await signIn(page.context(), jwt);
  await page.goto(`/rezervari/${id}`);
}

/** Opens a mocked booking (review read: none) and waits for its card. */
async function show(page: Page, b: { documentId: string }, width = 375, review: unknown | number = null) {
  await mockBooking(page, () => b);
  await mockMyReview(page, review);
  await open(page, b.documentId, width);
  await expect(card(page)).toBeVisible();
}

const h1 = (p: Page) => p.getByRole('heading', { level: 1, name: 'Rezervare' });
const detail = (p: Page) => p.getByTestId('booking-detail');
const card = (p: Page) => detail(p).locator('[data-booking]');
/** The action surface for the width: the phone bar below 1024, the sticky card from 1024. */
const actions = (p: Page, width: number) => (width < 1024 ? p.getByRole('region', { name: 'Acțiuni rezervare' }) : p.getByTestId('booking-actions-card'));
const dialog = (p: Page) => p.locator('dialog[open]');
/** The surface's entry transition has finished (axe reads mid-fade colours otherwise). */
const settled = (l: ReturnType<typeof dialog>) => l.evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)));

test.describe('booking.rezervare', () => {
  test('c14 b.sign-in-gate: signed out → 307 /intra?next=/rezervari/{id}; legacy /bookings links redirect (308)', async ({ request, page }) => {
    const res = await request.get('/rezervari/bk_123', { maxRedirects: 0 });
    expect(res.status()).toBe(307);
    expect(res.headers().location).toMatch(/\/intra\?next=%2Frezervari%2Fbk_123$/);
    const legacy = await request.get('/bookings/bk_123', { maxRedirects: 0 });
    expect(legacy.status()).toBe(308);
    expect(legacy.headers().location).toMatch(/\/rezervari\/bk_123$/);
    const list = await request.get('/bookings', { maxRedirects: 0 });
    expect(list.status()).toBe(308);
    expect(list.headers().location).toMatch(/\/rezervari$/);
    await page.goto('/bookings/bk_123');
    await expect(page).toHaveURL(/\/intra\?next=%2Frezervari%2Fbk_123$/);
  });

  test('real booking (unmocked): GET /feed/bookings/{id} through /api/cms, the card, noindex; axe at 4 widths', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await signIn(page.context(), jwt);
    const mine = await page.request.get('/api/cms/feed/bookings/mine?bucket=all&page=1&pageSize=20');
    const rows = ((await mine.json()) as { data: { documentId: string; lake?: { name: string } }[] }).data ?? [];
    test.skip(rows.length === 0, 'the QA user has no booking on the local CMS');
    const real = rows[0];
    const read = page.waitForRequest((r) => r.url().endsWith(`/api/cms/feed/bookings/${real.documentId}`) && r.method() === 'GET');
    await open(page, real.documentId);
    await read;
    await expect(h1(page)).toBeVisible();
    await expect(card(page)).toHaveAttribute('data-booking', real.documentId);
    if (real.lake?.name) await expect(card(page)).toContainText(real.lake.name);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      await expect(h1(page)).toBeVisible();
      await expectNoA11yViolations(page);
    }
    expect(errors).toEqual([]);
  });

  test('c1 «Rezervare» + back; 5xx → error card; «Încearcă din nou» → the skeleton, then the booking', async ({ page }) => {
    const errors = collectConsoleErrors(page, { ignore: EXPECTED_CONSOLE });
    // The first read and its two automatic 5xx retries fail; the manual retry answers (slowly).
    let failing = true;
    const calls = await mockBooking(page, () => (failing ? { status: 500 } : { delayMs: 1500, body: { data: S.open } }));
    await mockMyReview(page, null);
    await open(page, 'open');
    // The client retries a 5xx twice (never a 4xx), then the error card.
    await expect(page.getByTestId('booking-error')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'Rezervarea nu a putut fi încărcată' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Înapoi la rezervări' })).toBeVisible();
    await expect(page.getByTestId('booking-error').getByRole('link', { name: 'Rezervările mele' })).toHaveAttribute('href', '/rezervari');
    await expectNoA11yViolations(page);
    const before = calls.length;
    failing = false;
    await page.getByRole('button', { name: 'Încearcă din nou' }).click();
    // fish: a refetch with no data is the loading state again (the skeleton), then the booking.
    await expect(page.getByTestId('booking-skeleton').first()).toBeVisible();
    await expect(card(page)).toBeVisible();
    expect(calls.length).toBeGreaterThan(before);
    await expect(h1(page)).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('c1 first load shows the page skeleton (no card) until the booking answers', async ({ page }) => {
    await mockBooking(page, () => ({ delayMs: 2500, body: { data: S.open } }));
    await mockMyReview(page, null);
    await open(page, 'open', 1280);
    await expect(page.getByTestId('booking-skeleton').first()).toBeVisible();
    await expect(card(page)).toHaveCount(0);
    await expect(card(page)).toBeVisible();
    await expect(page.getByTestId('booking-skeleton')).toHaveCount(0);
  });

  test('c1 not found (404) and not mine (403) → «Rezervarea nu a fost găsită» with retry, no sign-out; an impossible id → 404 page', async ({ page }) => {
    const errors = collectConsoleErrors(page, { ignore: EXPECTED_CONSOLE });
    for (const status of [404, 403]) {
      await page.unrouteAll();
      const calls = await mockBooking(page, () => ({ status }));
      await open(page, `missing${status}`);
      await expect(page.getByRole('heading', { level: 1, name: 'Rezervarea nu a fost găsită' })).toBeVisible();
      await expect(page.getByText('Nu am găsit această rezervare în contul tău.')).toBeVisible();
      // A 4xx is never retried on its own (one call), and the session stays (no sign-in form).
      expect(calls).toEqual([`missing${status}`]);
      await page.getByRole('button', { name: 'Încearcă din nou' }).click();
      await expect.poll(() => calls.length).toBe(2);
      await expect(page).toHaveURL(new RegExp(`/rezervari/missing${status}$`));
    }
    await page.unrouteAll();
    await page.goto('/rezervari/nu%20e%20un%20id');
    await expect(page.getByRole('heading', { level: 1, name: 'Rezervarea nu a fost găsită' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Rezervările mele' })).toHaveAttribute('href', '/rezervari');
    expect(errors).toEqual([]);
  });

  test('c2 the list card, inert: lake, stand, extras, period, price, pill; the dead reason in full; the pending warning', async ({ page }) => {
    await show(page, S.cancelledLake);
    const c = card(page);
    await expect(c).toContainText('Chita Lake');
    await expect(c).toContainText('Standul 5');
    await expect(c).toContainText(/\p{L}{2} \d+ \p{L}+ \d\d:\d\d → \p{L}{2} \d+ \p{L}+ \d\d:\d\d · 12h/u);
    await expect(c).toContainText('150 lei');
    await expect(c.locator('[data-tone]')).toHaveText('Anulată de baltă');
    await expect(c).toHaveAttribute('data-quiet', '');
    // Inert: the card is not a link and holds none.
    expect(await c.evaluate((el) => el.tagName)).toBe('DIV');
    await expect(c.locator('a')).toHaveCount(0);
    // The dead reason in full (no clamp), unlike the list.
    const reason = c.getByTestId('booking-dead-reason');
    await expect(reason).toHaveText((S.cancelledLake as unknown as { cancelReason: string }).cancelReason);
    await expect(reason).not.toHaveClass(/line-clamp/);

    await page.unrouteAll();
    await show(page, S.pending);
    await expect(card(page)).toContainText('Locul nu e al tău până confirmă administratorul. Primești notificare.');
    await expect(card(page).locator('[data-tone]')).toHaveText('În așteptare');

    await page.unrouteAll();
    await show(page, S.live);
    await expect(card(page).getByTestId('booking-progress')).toContainText('3h din 12h');
    await expect(page.locator('body')).not.toContainText(/capot/i);
  });

  test('c3 «Lasă o recenzie» (yellow, star) — ended confirmed / completed, no review yet → the review form with the booking', async ({ page }) => {
    for (const b of [S.completed, S.endedConfirmed]) {
      await page.unrouteAll();
      const reads = await mockMyReview(page, null);
      await mockBooking(page, () => b);
      await open(page, b.documentId);
      const review = actions(page, 375).getByRole('link', { name: 'Lasă o recenzie' });
      await expect(review).toHaveAttribute('href', `/balti/lake-chita/recenzie?rezervare=${b.documentId}`);
      await expect(review).toHaveClass(/bg-rating/);
      await expect(review.locator('svg')).toHaveCount(1);
      expect(reads.n).toBeGreaterThan(0);
    }
    // From 1024 the action card holds it.
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(actions(page, 1280).getByRole('link', { name: 'Lasă o recenzie' })).toBeVisible();
    await actions(page, 1280).getByRole('link', { name: 'Lasă o recenzie' }).click();
    await expect(page).toHaveURL(/\/balti\/lake-chita\/recenzie\?rezervare=ended$/);
  });

  test('c3 no «Lasă o recenzie»: own review exists / review read failed (rule 4) / no-show / not ended / cancelled', async ({ page }) => {
    const errors = collectConsoleErrors(page, { ignore: EXPECTED_CONSOLE });
    const cases: [unknown, unknown | number][] = [
      [S.completed, { documentId: 'r1', note: 5, comment: 'Super', author: { documentId: 'me' } }],
      [S.completed, 500],
      [S.noShow, null],
      [S.open, null],
      [S.cancelledMe, null],
    ];
    for (const [b, review] of cases) {
      await page.unrouteAll();
      await mockBooking(page, () => b);
      const reads = await mockMyReview(page, review);
      await open(page, (b as { documentId: string }).documentId, 1280);
      await expect(card(page)).toBeVisible();
      if (b === S.completed) await expect.poll(() => reads.n).toBeGreaterThan(0);
      await page.waitForTimeout(300);
      await expect(page.getByRole('link', { name: 'Lasă o recenzie' })).toHaveCount(0);
      // The read is only made for a stay that could be reviewed (fish enables it on `completed`).
      if (b === S.open || b === S.cancelledMe || b === S.noShow) expect(reads.n).toBe(0);
    }
    expect(errors).toEqual([]);
  });

  test('c4 the call: «Sună la baltă» (window open / live) or «Sună pentru anulare» (window closed, not started); tel: + contact_pressed; none without a phone or when not cancellable', async ({ page }) => {
    const events = await collectAnalytics(page);
    const cases: [unknown, string | null][] = [
      [S.open, 'Sună la baltă'],
      [S.pending, 'Sună la baltă'],
      [S.closed, 'Sună pentru anulare'],
      [S.live, 'Sună la baltă'],
      [S.noPhone, null],
      [S.completed, null],
      [S.cancelledMe, null],
    ];
    for (const width of [375, 1280]) {
      for (const [b, label] of cases) {
        await page.unrouteAll();
        await mockBooking(page, () => b);
        await mockMyReview(page, { documentId: 'r', author: { documentId: 'me' } });
        await open(page, (b as { documentId: string }).documentId, width);
        await expect(card(page)).toBeVisible();
        const call = page.getByTestId('booking-call').filter({ visible: true });
        if (!label) {
          await expect(call).toHaveCount(0);
          continue;
        }
        await expect(call).toHaveText(label);
        await expect(call).toHaveAttribute('href', 'tel:0712345678');
        await expect(actions(page, width).getByTestId('booking-call')).toBeVisible();
        // From 1024 the number itself is printed under the call (a desktop's tel: may do nothing, and
        // with the window closed the call is the only way to cancel); the phone dials, no caption.
        const number = page.getByTestId('booking-call-number').filter({ visible: true });
        if (width >= 1024) await expect(number).toHaveText('Telefon baltă: 0712 345 678');
        else await expect(number).toHaveCount(0);
      }
    }
    // The press logs fish's event (the tel: navigation itself is the OS's).
    await page.unrouteAll();
    await mockBooking(page, () => S.open);
    await mockMyReview(page, null);
    await page.route('tel:*', (r) => r.abort());
    await open(page, 'open', 1280);
    await page.getByTestId('booking-call').filter({ visible: true }).evaluate((a: HTMLAnchorElement) => {
      a.addEventListener('click', (e) => e.preventDefault(), { once: true });
      a.click();
    });
    const ev = (await events()).find((e) => e.name === 'contact_pressed');
    expect(ev?.params).toEqual({ contact_type: 'Booking lake contact', lake_id: 'lake-chita', lake_name: 'Chita Lake' });
  });

  test('c5 «Anulează» only with the window open; closed → «Anulările cu mai puțin de {h} oră|ore …» (formatCount)', async ({ page }) => {
    for (const width of [375, 1280]) {
      await page.unrouteAll();
      await show(page, S.open, width);
      await expect(actions(page, width).getByRole('button', { name: 'Anulează' })).toBeVisible();
      await expect(page.getByText(/se fac telefonic/)).toHaveCount(0);

      await page.unrouteAll();
      await show(page, S.closed, width);
      await expect(page.getByRole('button', { name: 'Anulează' })).toHaveCount(0);
      await expect(page.getByText('Anulările cu mai puțin de 24 de ore înainte de început se fac telefonic.').filter({ visible: true })).toHaveCount(1);

      await page.unrouteAll();
      await show(page, S.closed1, width);
      await expect(page.getByText('Anulările cu mai puțin de 1 oră înainte de început se fac telefonic.').filter({ visible: true })).toHaveCount(1);

      // Live: no cancel (the stay has started), the line still says why.
      await page.unrouteAll();
      await show(page, S.live, width);
      await expect(page.getByRole('button', { name: 'Anulează' })).toHaveCount(0);
    }
    // Not cancellable at all (ended / dead): no line, no button.
    await page.unrouteAll();
    await show(page, S.completed, 1280);
    await expect(page.getByText(/se fac telefonic/)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Anulează' })).toHaveCount(0);
  });

  test('c6 c7 cancel dialog: title, text + deposit warning, reason required (≥ 5 trimmed), reset on close, focus returns to «Anulează»; axe', async ({ page }) => {
    for (const width of [375, 1280]) {
      await page.unrouteAll();
      await show(page, S.composed, width);
      const trigger = actions(page, width).getByRole('button', { name: 'Anulează' });
      await trigger.click();
      const d = dialog(page);
      await expect(d).toBeVisible();
      await expect(d.getByRole('heading', { name: 'Anulează rezervarea' })).toBeVisible();
      await expect(d).toContainText('Această acțiune este definitivă. Spune-ne motivul — îl trimitem celeilalte părți.');
      await expect(d).toContainText('Avansul de 200 lei poate să nu fie restituit, conform politicii lacului.');
      const field = d.getByRole('textbox', { name: 'Motivul anulării' });
      await expect(field).toHaveAttribute('placeholder', 'Motivul anulării...');
      await settled(d);
      await expectNoA11yViolations(page);
      // c7 — too short (trimmed) → the red error after a confirm attempt; nothing is sent.
      await field.fill('   abc   ');
      await d.getByRole('button', { name: 'Da, anulează' }).click();
      await expect(d.getByText('Motivul este obligatoriu (minim 5 caractere).')).toBeVisible();
      await expect(field).toHaveAttribute('aria-invalid', 'true');
      await expectNoA11yViolations(page);
      // «Înapoi» closes; the focus returns to the trigger; a reopen starts clean.
      await d.getByRole('button', { name: 'Înapoi' }).click();
      await expect(dialog(page)).toHaveCount(0);
      await expect(trigger).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(dialog(page)).toBeVisible();
      await expect(dialog(page).getByRole('textbox', { name: 'Motivul anulării' })).toHaveValue('');
      await expect(dialog(page).getByText('Motivul este obligatoriu (minim 5 caractere).')).toHaveCount(0);
      // Escape closes too, focus back on the trigger.
      await page.keyboard.press('Escape');
      await expect(dialog(page)).toHaveCount(0);
      await expect(trigger).toBeFocused();
    }
    // No deposit → no warning.
    await page.unrouteAll();
    await show(page, S.open, 1280);
    await actions(page, 1280).getByRole('button', { name: 'Anulează' }).click();
    await expect(dialog(page)).not.toContainText('Avansul');
  });

  test('c8 c9 rezervarile-mele.c22: confirm sends the trimmed reason (busy, «Înapoi» disabled) → toast «Rezervare anulată», back to the list, which refetches', async ({ page }) => {
    // Opened from the list, as fish: success goes back there.
    let cancelled = false;
    await page.route('**/api/cms/feed/bookings/mine**', (r) =>
      r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [cancelled ? { ...S.open, bookingStatus: 'cancelled', cancelledBy: 'angler' } : S.open], meta: { pendingCount: 0, page: 1, pageSize: 20 } }),
      }),
    );
    await page.route('**/api/cms/feed/bookings/to-review', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"data":[]}' }));
    const mineCalls: string[] = [];
    page.on('request', (r) => {
      if (r.url().includes('/api/cms/feed/bookings/mine')) mineCalls.push(r.url());
    });
    await mockBooking(page, () => S.open);
    await mockMyReview(page, null);
    const calls = await mockCancel(page, () => {
      cancelled = true;
      return { delayMs: 800, body: { data: { ...S.open, bookingStatus: 'cancelled', cancelledBy: 'angler' } } };
    });
    await page.setViewportSize({ width: 375, height: 900 });
    await signIn(page.context(), jwt);
    await page.goto('/rezervari');
    // c20 — the row opens the booking.
    await page.locator('a[data-booking="open"]').click();
    await expect(page).toHaveURL(/\/rezervari\/open$/);
    const before = mineCalls.length;
    await actions(page, 375).getByRole('button', { name: 'Anulează' }).click();
    const d = dialog(page);
    await d.getByRole('textbox', { name: 'Motivul anulării' }).fill('  Mi s-a îmbolnăvit copilul.  ');
    await d.getByRole('button', { name: 'Da, anulează' }).click();
    // In flight: the confirm is busy, «Înapoi» disabled.
    await expect(d.getByRole('button', { name: 'Se anulează…' })).toHaveAttribute('aria-busy', 'true');
    await expect(d.getByRole('button', { name: 'Înapoi' })).toBeDisabled();
    await expect(page.getByText('Rezervare anulată')).toBeVisible();
    expect(calls).toEqual([{ id: 'open', body: { reason: 'Mi s-a îmbolnăvit copilul.' } }]);
    await expect(page).toHaveURL(/\/rezervari$/);
    // c9 — every bookings query was invalidated: the list reads again and shows the new state.
    await expect.poll(() => mineCalls.length).toBeGreaterThan(before);
    // (The detail page may stay mounted, hidden, in the router's cache: the list's link is the row.)
    await expect(page.locator('a[data-booking="open"] [data-tone]')).toHaveText('Anulată de tine');
  });

  test('c8 opened directly (a notification): success → /rezervari', async ({ page }) => {
    await mockBooking(page, () => S.pending);
    await mockMyReview(page, null);
    await mockCancel(page, () => ({ body: { data: { ...S.pending, bookingStatus: 'cancelled', cancelledBy: 'angler' } } }));
    await show(page, S.pending, 1280);
    await actions(page, 1280).getByRole('button', { name: 'Anulează' }).click();
    await dialog(page).getByRole('textbox', { name: 'Motivul anulării' }).fill('Nu mai pot ajunge.');
    await dialog(page).getByRole('button', { name: 'Da, anulează' }).click();
    await expect(page.getByText('Rezervare anulată')).toBeVisible();
    await expect(page).toHaveURL(/\/rezervari$/);
  });

  test('c8 rezervarile-mele.c22 failure: the server sentence, or the fallback for a bare code; the dialog stays', async ({ page }) => {
    const errors = collectConsoleErrors(page, { ignore: [/Failed to load resource: the server responded with a status of 400/] });
    const replies: Reply[] = [
      { status: 400, body: { data: null, error: { status: 400, name: 'ApplicationError', message: 'Anularea nu mai este posibilă cu mai puțin de 24 de ore înainte.', details: { bluCode: 'CANCEL_NOTICE_TOO_SHORT' } } } },
      { status: 400, body: { data: null, error: { status: 400, name: 'ApplicationError', message: 'INVALID_STATUS', details: { bluCode: 'INVALID_STATUS' } } } },
    ];
    let i = 0;
    const calls = await mockCancel(page, () => replies[i++]);
    await show(page, S.open, 1280);
    await actions(page, 1280).getByRole('button', { name: 'Anulează' }).click();
    const d = dialog(page);
    await d.getByRole('textbox', { name: 'Motivul anulării' }).fill('Plec din țară.');
    await d.getByRole('button', { name: 'Da, anulează' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Anularea nu mai este posibilă cu mai puțin de 24 de ore înainte.' })).toBeVisible();
    await expect(d).toBeVisible();
    await expect(d.getByRole('button', { name: 'Da, anulează' })).toBeVisible();
    await d.getByRole('button', { name: 'Da, anulează' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Nu am putut anula rezervarea. Încearcă din nou.' })).toBeVisible();
    await expect(page.getByText('INVALID_STATUS')).toHaveCount(0);
    expect(calls).toHaveLength(2);
    await expect(page).toHaveURL(/\/rezervari\/open$/);
    expect(errors).toEqual([]);
  });

  test('c10 rebook: cancelled / rejected / ended → «Mergi din nou la {lake}?» + «Rezervă din nou» → the grid (rebook_button_pressed); none on a live or future booking', async ({ page }) => {
    const events = await collectAnalytics(page);
    for (const b of [S.cancelledMe, S.cancelledAuto, S.rejected, S.noShow, S.completed]) {
      for (const width of [375, 1280]) {
        await page.unrouteAll();
        await show(page, b, width);
        const rebook = page.getByTestId('rebook').filter({ visible: true });
        await expect(rebook).toHaveCount(1);
        await expect(rebook).toContainText('Mergi din nou la Chita Lake?');
        await expect(rebook.getByRole('link', { name: 'Rezervă din nou' })).toHaveAttribute('href', '/balti/lake-chita/rezerva');
        // From 1024 it is part of the action card.
        if (width >= 1024) await expect(actions(page, width).getByTestId('rebook')).toBeVisible();
      }
    }
    for (const b of [S.open, S.pending, S.live]) {
      await page.unrouteAll();
      await show(page, b, 1280);
      await expect(page.getByTestId('rebook')).toHaveCount(0);
    }
    await page.unrouteAll();
    await show(page, S.rejected, 375);
    await page.getByRole('link', { name: 'Rezervă din nou' }).click();
    await expect(page).toHaveURL(/\/balti\/lake-chita\/rezerva/);
    const ev = (await events()).find((e) => e.name === 'rebook_button_pressed');
    expect(ev?.params).toEqual({ lake_id: 'lake-chita', booking_id: 'rejected' });
  });

  test('c11 «Cum s-a calculat»: tour, extras (× qty), Total, «Tura s-a compus din 12h + 12h.»; no card without a basis', async ({ page }) => {
    await show(page, S.composed, 1280);
    const p = page.getByTestId('price-breakdown');
    await expect(p.getByRole('heading', { name: 'Cum s-a calculat' })).toBeVisible();
    await expect(p).toContainText('Prețurile de la momentul rezervării.');
    const rows = p.locator('dl > div');
    await expect(rows).toHaveText([/^24h\s*200 lei$/, /^Barcă\s*30 lei$/, /^Cabană × 2\s*200 lei$/, /^Total\s*430 lei$/]);
    await expect(p).toContainText('Tura s-a compus din 12h + 12h.');

    await page.unrouteAll();
    await show(page, S.open, 1280);
    await expect(page.getByTestId('price-breakdown')).not.toContainText('Tura s-a compus');

    await page.unrouteAll();
    await show(page, S.noBasis, 1280);
    await expect(page.getByTestId('price-breakdown')).toHaveCount(0);
  });

  test('c12 «Parcursul cererii»: the angler timeline per status, the end date minus the buffer, no other timestamps', async ({ page }) => {
    const states = async () => page.getByTestId('request-timeline').locator('li').evaluateAll((li) => li.map((l) => `${l.getAttribute('data-step')}:${l.getAttribute('data-state')}`));
    await show(page, S.pending, 1280);
    expect(await states()).toEqual(['sent:done', 'waiting:current', 'confirmed:future', 'ended:future']);
    const t = page.getByTestId('request-timeline');
    await expect(t).toContainText('Așteaptă răspunsul lacului');
    await expect(t.locator('li').nth(0)).toHaveText(/^Cerere trimisă, finalizat$/);
    await expect(t.locator('li').nth(3)).toContainText(/după \d+ \w+, \d\d:\d\d/);

    await page.unrouteAll();
    await show(page, S.open, 1280);
    expect(await states()).toEqual(['sent:done', 'waiting:done', 'confirmed:current', 'ended:future']);
    await page.unrouteAll();
    await show(page, S.completed, 1280);
    expect(await states()).toEqual(['sent:done', 'waiting:done', 'confirmed:done', 'ended:done']);
    await page.unrouteAll();
    await show(page, S.rejected, 1280);
    expect(await states()).toEqual(['sent:done', 'rejected:current']);
    await expect(page.getByTestId('request-timeline')).toContainText(/Respinsă.*după \d+ \w+, \d\d:\d\d/);
    await page.unrouteAll();
    await show(page, S.cancelledMe, 1280);
    expect(await states()).toEqual(['sent:done', 'cancelled:current']);

    // End minus the checkout buffer (30 min): 18:00 → 17:30.
    const end = new Date();
    end.setDate(end.getDate() + 3);
    end.setHours(18, 0, 0, 0);
    const start = new Date(end.getTime() - 12 * H);
    await page.unrouteAll();
    await show(page, B('buffer', { startDate: start.toISOString(), endDate: end.toISOString(), lake: { ...LAKE, checkoutBufferMinutes: 30 } }), 1280);
    await expect(page.getByTestId('request-timeline')).toContainText(/după \d+ \w+, 17:30/);
  });

  test('c13 «Mesajul tău»: the angler’s own note in „…”, the operator part stripped; hidden when empty', async ({ page }) => {
    await show(page, S.pending, 1280);
    await expect(page.getByTestId('booking-note')).toContainText('„Vin cu fiul meu, am vrea un stand umbrit.”');
    await page.unrouteAll();
    await show(page, S.cancelledLake, 1280);
    await expect(page.getByTestId('booking-note')).toHaveText(/Mesajul tău\s*„Aș vrea standul de lângă pontonul mare\.”/);
    await page.unrouteAll();
    await show(page, S.rejected, 1280);
    await expect(page.getByTestId('booking-note')).toHaveCount(0);
    await page.unrouteAll();
    await show(page, S.open, 1280);
    await expect(page.getByTestId('booking-note')).toHaveCount(0);
  });

  test('c14 b.notification-routes: a booking notification row in /notificari opens /rezervari/{bookingId}', async ({ page }) => {
    await page.route(/\/api\/cms\/notification-users(\/|\?|$)/, async (r: Route) => {
      const url = new URL(r.request().url());
      if (url.pathname.endsWith('/unread')) return r.fulfill({ status: 200, contentType: 'application/json', body: '{"count":0}' });
      if (r.request().method() === 'GET' && url.pathname.endsWith('/notification-users')) {
        return r.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: [
              {
                id: 1,
                documentId: 'row-1',
                read: true,
                readAt: '2026-10-01T10:00:00.000Z',
                notification: { id: 2, documentId: 'n1', title: 'Rezervare confirmată', body: 'Chita Lake te așteaptă.', sentAt: '2026-10-03T18:31:59.032Z', type: 'booking:confirmed-angler', data: { type: 'booking:confirmed-angler', bookingId: 'open' } },
              },
            ],
            meta: { pagination: { page: 1, pageSize: 10, pageCount: 1, total: 1 } },
          }),
        });
      }
      return r.fallback();
    });
    await mockBooking(page, () => S.open);
    await mockMyReview(page, null);
    await page.setViewportSize({ width: 375, height: 900 });
    await signIn(page.context(), jwt);
    await page.goto('/notificari');
    const link = page.getByRole('list', { name: 'Notificări' }).getByRole('link', { name: /Rezervare confirmată/ });
    await expect(link).toHaveAttribute('href', '/rezervari/open');
    await link.click();
    await expect(page).toHaveURL(/\/rezervari\/open$/);
    await expect(card(page)).toHaveAttribute('data-booking', 'open');
  });

  test('layout: one column + the bottom bar below 1024; from 1024 two columns with the sticky action card (no bar); axe for every state at 375 / 1280 / 1440 / 1920', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await show(page, S.open, 375);
    const bar = page.getByRole('region', { name: 'Acțiuni rezervare' });
    await expect(bar).toBeVisible();
    await expect(bar.getByRole('button', { name: 'Anulează' })).toBeVisible();
    await expect(page.getByTestId('booking-actions-card')).toBeHidden();
    for (const width of [1280, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(bar).toBeHidden();
      const aside = page.getByTestId('booking-actions-card');
      await expect(aside).toBeVisible();
      const a = await aside.boundingBox();
      const c = await card(page).boundingBox();
      expect(a!.x).toBeGreaterThan(c!.x + c!.width);
      // Sticky: after a scroll the card is still in view under the bar.
      await page.evaluate(() => window.scrollTo(0, 400));
      await expect.poll(async () => (await aside.boundingBox())!.y).toBeGreaterThan(60);
      await page.evaluate(() => window.scrollTo(0, 0));
      // Rule 16: from 1280 the booking card is one of two tracks (never stretched across the column),
      // «Parcursul cererii» beside it, «Cum s-a calculat» under it.
      const timeline = await page.getByTestId('request-timeline').boundingBox();
      const price = await page.getByTestId('price-breakdown').boundingBox();
      expect(c!.width).toBeLessThanOrEqual(720);
      expect(timeline!.x).toBeGreaterThan(c!.x + c!.width);
      expect(timeline!.y).toBeLessThan(c!.y + c!.height);
      expect(price!.y).toBeGreaterThan(c!.y + c!.height);
      expect(Math.abs(price!.x - c!.x)).toBeLessThan(2);
    }
    // A live booking's action card leads with the total.
    await expect(page.getByTestId('booking-actions-card')).toContainText('Total');
    // Dead (cancelled, rejected, no-show): nothing is owed — no price headline, no «Total»; the card
    // leads with the status pill and the rebook block (the booking card beside it recedes too).
    for (const [b, pill] of [
      [S.cancelledMe, 'Anulată'],
      [S.rejected, 'Respinsă'],
      [S.noShow, 'Nu a venit'],
    ] as const) {
      await page.unrouteAll();
      await show(page, b, 1280);
      const aside = page.getByTestId('booking-actions-card');
      await expect(aside).toHaveAttribute('data-quiet', '');
      await expect(card(page)).toHaveAttribute('data-quiet', '');
      await expect(aside).not.toContainText('Total');
      await expect(aside).not.toContainText('150');
      await expect(aside.locator('.t-num-40')).toHaveCount(0);
      await expect(aside.locator(':scope > *').first()).toContainText(pill);
      await expect(aside.getByTestId('rebook')).toBeVisible();
    }
    // Every state, every width: zero axe violations.
    for (const b of Object.values(S)) {
      await page.unrouteAll();
      await show(page, b, 375, null);
      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: 900 });
        await expectNoA11yViolations(page);
      }
    }
    expect(errors).toEqual([]);
  });

  test('keyboard: Tab reaches back, the lake link and every action in order (1280)', async ({ page }) => {
    await show(page, S.open, 1280);
    const names: string[] = [];
    for (let i = 0; i < 40 && !names.includes('Anulează'); i++) {
      await page.keyboard.press('Tab');
      names.push(await page.evaluate(() => (document.activeElement as HTMLElement | null)?.innerText?.trim() || (document.activeElement?.getAttribute('aria-label') ?? '')));
    }
    const callAt = names.indexOf('Sună la baltă');
    expect(callAt).toBeGreaterThan(-1);
    expect(names.indexOf('Anulează')).toBeGreaterThan(callAt);
  });

  test('screens (SHOTS=1): every state at 375 / 1280 / 1440 / 1920 → .shots/rezervare-*', async ({ page }) => {
    test.skip(!process.env.SHOTS, 'screenshots on demand');
    test.setTimeout(240_000);
    const states: Record<string, unknown> = { ...S };
    for (const [name, b] of Object.entries(states)) {
      await page.unrouteAll();
      await show(page, b as { documentId: string }, 375, null);
      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: 900 });
        await page.waitForTimeout(250);
        await page.screenshot({ path: `.shots/rezervare-${name}-${width}.png`, fullPage: true });
      }
    }
    await page.unrouteAll();
    await mockBooking(page, () => ({ status: 500 }));
    await open(page, 'err', 1280);
    await expect(page.getByTestId('booking-error')).toBeVisible();
    await page.screenshot({ path: '.shots/rezervare-error-1280.png', fullPage: true });
    await page.setViewportSize({ width: 375, height: 900 });
    await page.screenshot({ path: '.shots/rezervare-error-375.png', fullPage: true });
    await page.unrouteAll();
    await mockBooking(page, () => ({ delayMs: 60_000, body: { data: S.open } }));
    await open(page, 'load', 1280);
    await page.screenshot({ path: '.shots/rezervare-loading-1280.png', fullPage: true });
    await page.setViewportSize({ width: 375, height: 900 });
    await page.screenshot({ path: '.shots/rezervare-loading-375.png', fullPage: true });
    await page.unrouteAll();
    await show(page, S.composed, 375);
    await actions(page, 375).getByRole('button', { name: 'Anulează' }).click();
    await dialog(page).getByRole('button', { name: 'Da, anulează' }).click();
    await settled(dialog(page));
    await page.screenshot({ path: '.shots/rezervare-dialog-invalid-375.png' });
    await page.unrouteAll();
    await show(page, S.composed, 1280);
    await actions(page, 1280).getByRole('button', { name: 'Anulează' }).click();
    await dialog(page).getByRole('button', { name: 'Da, anulează' }).click();
    await settled(dialog(page));
    await page.screenshot({ path: '.shots/rezervare-dialog-invalid-1280.png' });
  });
});
