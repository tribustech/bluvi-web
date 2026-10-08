import { expect, test, type Page, type Route } from '@playwright/test';
import { expectNoA11yViolations } from './helpers/a11y';
import { collectConsoleErrors } from './helpers/console';
import { qaJwt, signIn } from './helpers/session';
import { booking } from './rezervari.fixtures';

/*
 * operator.detaliu-rezervare (c1–c13) + operator.b.reputation, operator.b.analytics. fish:
 * features/operator/{BookingDetailSheet,OperatorBookingSheet,AnglerRatingBadge}.tsx.
 *
 * Harness: /dev/operator (app/dev/operator) — the QA user's owned lake (Chita on the LOCAL CMS) and its
 * bookings, openable by id (?rezervare=, the panel's way) or with the row as seed (the inbox's way).
 * Real reads: GET /feed/bookings/{id} of Chita's own bookings and the angler reputation. States the
 * DB does not hold are route mocks of the browser's calls (/api/cms/feed/bookings/{id},
 * /feed/users/{id}/reputation, the harness list /api/cms/feed/bookings/lake/{id}). No writes: the
 * action buttons only open operator.actiuni-rezervare's dialogs, which are dismissed.
 */

const WIDTHS = [375, 1280, 1440, 1920] as const;
const H = 3_600_000;
const rel = (h: number) => new Date(Date.now() + h * H).toISOString();
/** Mocked failures / aborted tel: navigations are not the page's defect. */
const EXPECTED_CONSOLE = [/Failed to load resource/];

/** Chita (local CMS): a completed walk-in, no account, not rated → «Evaluează pescarul». */
const REAL_WALK_IN = 'e2cgl6wld8e7h4rygu7ly9li';

let jwt: string;
let realAccountId: string | null = null;
/** The QA user's owned lake (Chita): mocked bookings carry it, so the c14 lake guard accepts them. */
let lakeId = 'lake-chita';
test.beforeAll(async ({ request }) => {
  jwt = await qaJwt(request);
  // One real booking with an angler account (any status), for the real reputation read.
  const lakes = await request.get('http://localhost:1337/api/feed/owned-lakes', { headers: { Authorization: `Bearer ${jwt}` } });
  lakeId = (await lakes.json()).data?.[0]?.documentId ?? lakeId;
  const list = await request.get(`http://localhost:1337/api/feed/bookings/lake/${lakeId}?bucket=all&page=1&pageSize=50`, {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  const rows = ((await list.json()).data ?? []) as { documentId: string; angler?: { documentId: string } }[];
  realAccountId = rows.find((r) => r.angler)?.documentId ?? null;
});

test.beforeEach(async ({ context }) => {
  await signIn(context, jwt);
});

type Over = Record<string, unknown>;
const ACCOUNT = { documentId: 'u-ion', username: 'ion.pescarul', avatar: null };
const B = (id: string, over: Over = {}) => booking(id, { startDate: rel(48), endDate: rel(60), angler: ACCOUNT, createdAt: rel(-30), ...over });
const PAST = { startDate: rel(-40), endDate: rel(-28) };

const S = {
  pending: B('m-pending', {
    bookingStatus: 'pending',
    notes: 'Vin cu fiul meu, am vrea un stand umbrit.',
    priceTotal: 230,
    basis: {
      durationHours: 12,
      rowLabel: null,
      composedFrom: [12],
      tourPrice: 150,
      extras: [
        { key: 'boat', label: 'Barcă', unit: 'perStay', unitPrice: 30, quantity: 1, total: 30 },
        { key: 'cabin', label: 'Cabană', unit: 'perNight', unitPrice: 25, quantity: 2, total: 50 },
      ],
    },
  }),
  confirmed: B('m-confirmed', { amountPaid: 50, paymentStatus: 'depositPaid' }),
  paid: B('m-paid', { amountPaid: 150, paymentStatus: 'paidInFull', basis: undefined }),
  rateable: B('m-rate', { ...PAST, angler: { documentId: 'u-ana', username: 'ana', avatar: null } }),
  rejected: B('m-rejected', { bookingStatus: 'rejected', cancelReason: 'Standul nu este disponibil.', notes: 'Aș vrea pontonul. [Refuz operator] Standul nu este disponibil.' }),
  cancelled: B('m-cancelled', { bookingStatus: 'cancelled', cancelledBy: 'operator', cancelReason: 'Lucrări la baltă.', notes: '[Anulare operator] Lucrări la baltă.', contactPhone: '' }),
  noShow: B('m-noshow', { ...PAST, noShow: true, noShowComment: 'A sunat la 5 dimineața că nu mai vine.' }),
  noShowDefault: B('m-noshow-default', { ...PAST, noShow: true, noShowComment: 'Pescarul nu s-a prezentat.' }),
  reviewed: B('m-reviewed', { ...PAST, reviewedByOperator: true }),
  walkIn: B('m-walkin', { angler: undefined, contactFullname: 'Gheorghe Ionescu' }),
} as const;
const BY_ID: Record<string, unknown> = Object.fromEntries(Object.values(S).map((b) => [b.documentId, b]));

type Reply = { body?: unknown; delayMs?: number; status?: number; hang?: boolean };

/** A mocked booking re-homed on the harness lake (fixtures say 'lake-chita'; the real id differs). */
function onLake(b: unknown, id = lakeId) {
  const row = b as { lake?: Record<string, unknown> };
  return row.lake ? { ...row, lake: { ...row.lake, documentId: id } } : row;
}

/** GET /api/cms/feed/bookings/{id} for the mocked ids (`over` per id); real ids fall through to the CMS. */
async function mockDetails(page: Page, over: Record<string, Reply> = {}) {
  const calls: string[] = [];
  await page.route('**/api/cms/feed/bookings/*', async (r: Route) => {
    const id = decodeURIComponent(new URL(r.request().url()).pathname.split('/').pop() ?? '');
    if (r.request().method() !== 'GET' || (!BY_ID[id] && !over[id])) return r.fallback();
    calls.push(id);
    const o = over[id] ?? {};
    if (o.hang) return; // never answered: the read stays in flight
    if (o.delayMs) await new Promise((res) => setTimeout(res, o.delayMs));
    if (o.status && o.status >= 400) {
      return r.fulfill({ status: o.status, contentType: 'application/json', body: JSON.stringify({ data: null, error: { status: o.status, name: 'Error', message: 'x' } }) });
    }
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: onLake(o.body ?? BY_ID[id]) }) });
  });
  return calls;
}

/** GET …/feed/users/{id}/reputation (direct or proxied) for the mocked anglers. */
async function mockReputation(page: Page, byUser: Record<string, { avgStars: number | null; noShowCount: number; delayMs?: number }>) {
  await page.route('**/feed/users/*/reputation', async (r: Route) => {
    const id = decodeURIComponent(new URL(r.request().url()).pathname.split('/').slice(-2)[0]);
    const rep = byUser[id];
    if (!rep) return r.fallback();
    if (rep.delayMs) await new Promise((res) => setTimeout(res, rep.delayMs));
    return r.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({
        data: { avgStars: rep.avgStars, ratingCount: rep.avgStars == null ? 0 : 3, noShowCount: rep.noShowCount, areas: { rules: null, cleanliness: null, behavior: null }, reviews: [] },
      }),
    });
  });
}

/** The harness list replaced by `rows` (the seed path). */
async function mockList(page: Page, rows: unknown[]) {
  await page.route('**/api/cms/feed/bookings/lake/**', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: rows.map((x) => onLake(x)), meta: { pendingCount: 0, page: 1, pageSize: 50 } }) }),
  );
}

const dialog = (page: Page) => page.locator('dialog[open]').filter({ has: page.getByRole('heading', { name: 'Detalii rezervare' }) });
const body = (page: Page) => dialog(page).getByTestId('booking-detail');
/** The opening transition (opacity / scale) is over: axe must not measure a half-faded button. */
async function settled(page: Page) {
  await expect(dialog(page)).toHaveCSS('opacity', '1');
  // The phone sheet slides up (translate, --duration-slow): let it dock before a capture.
  await page.waitForTimeout(500);
}
const open = (page: Page, id: string) => page.goto(`/dev/operator?rezervare=${encodeURIComponent(id)}`);

test.describe('operator.detaliu-rezervare', () => {
  test('c1 real GET by id behind the skeleton; c3 real header; c9 rate variant; c13 Esc clears the id', async ({ page }) => {
    const errors = collectConsoleErrors(page, { ignore: EXPECTED_CONSOLE });
    // Hold the real read so the skeleton is observable, then let it through to the CMS.
    let release!: () => void;
    const held = new Promise<void>((res) => (release = res));
    await page.route(`**/api/cms/feed/bookings/${REAL_WALK_IN}`, async (r) => {
      await held;
      await r.fallback();
    });
    const real = page.waitForResponse((r) => r.url().includes(`/api/cms/feed/bookings/${REAL_WALK_IN}`) && r.status() === 200);
    await open(page, REAL_WALK_IN);
    await expect(dialog(page).getByTestId('booking-detail-skeleton')).toBeVisible();
    await expect(body(page)).toHaveCount(0);
    release();
    await real;
    await expect(body(page)).toHaveAttribute('data-booking', REAL_WALK_IN);
    await expect(dialog(page).getByTestId('booking-detail-skeleton')).toHaveCount(0);
    // c4: walk-in without account — the name is no link.
    await expect(body(page).getByTestId('booking-detail-angler')).toHaveText('Ion Popescu 0722 111 222');
    await expect(body(page).locator('a[href^="/pescari/"]')).toHaveCount(0);
    await expect(body(page)).toContainText('Standul 2');
    await expect(body(page).getByTestId('booking-detail-period')).toHaveText(/ → .* · 12h$/);
    await expect(body(page).getByTestId('booking-detail-price')).toHaveText('50 lei');
    await expect(body(page)).toContainText('Încheiată');
    await expect(body(page).getByTestId('booking-detail-request')).toContainText('BK-934A3A40');
    await expect(dialog(page).getByTestId('booking-detail-actions')).toHaveAttribute('data-variant', 'rate');
    await expect(dialog(page).getByRole('button', { name: 'Evaluează pescarul' })).toBeVisible();
    await expect(dialog(page).getByRole('link', { name: 'Sună' })).toHaveAttribute('href', 'tel:0722111222');
    await settled(page);
    await expectNoA11yViolations(page);
    await page.keyboard.press('Escape');
    await expect(dialog(page)).toHaveCount(0);
    await expect(page).not.toHaveURL(/rezervare=/);
    expect(errors).toEqual([]);
  });

  test('b.reputation real: an angler with no rating gets no pill, never an empty one', async ({ page }) => {
    test.skip(!realAccountId, 'no Chita booking with an angler account on the local CMS');
    const rep = page.waitForResponse((r) => /\/feed\/users\/[^/]+\/reputation/.test(r.url()));
    await open(page, realAccountId!);
    await expect(body(page)).toBeVisible();
    const data = (await (await rep).json()).data as { avgStars: number | null; noShowCount: number };
    if (data.avgStars == null) await expect(body(page).getByTestId('angler-rating-badge')).toHaveCount(0);
    else await expect(body(page).getByTestId('angler-rating-badge')).toContainText(data.avgStars.toFixed(1).replace('.', ','));
    if (data.noShowCount === 0) await expect(body(page).getByTestId('no-show-pill')).toHaveCount(0);
    // c4: an account → the name links to the profile.
    await expect(body(page).getByRole('link').first()).toHaveAttribute('href', /^\/pescari\//);
  });

  test('c1 stale id: reopening on another booking never shows the previous one', async ({ page }) => {
    await mockDetails(page, { [S.confirmed.documentId]: { delayMs: 1500 } });
    await open(page, S.pending.documentId);
    await expect(body(page)).toHaveAttribute('data-booking', S.pending.documentId);
    await page.keyboard.press('Escape');
    await expect(dialog(page)).toHaveCount(0);
    // Open B by id (the panel's way: replaceState in the page) while A is still cached.
    await page.evaluate((id) => window.history.replaceState(null, '', `/dev/operator?rezervare=${id}`), S.confirmed.documentId);
    await expect(dialog(page).getByTestId('booking-detail-skeleton')).toBeVisible();
    await expect(dialog(page)).not.toContainText('ion.pescarul Standul');
    await expect(dialog(page).locator(`[data-booking="${S.pending.documentId}"]`)).toHaveCount(0);
    await expect(body(page)).toHaveAttribute('data-booking', S.confirmed.documentId);
  });

  test('c2 opened from a row: painted at once from the seed, then revalidated', async ({ page }) => {
    const seed = B('m-seed', { bookingStatus: 'pending', priceTotal: 120 });
    await mockList(page, [seed]);
    const calls = await mockDetails(page, { 'm-seed': { delayMs: 2000, body: { ...seed, bookingStatus: 'confirmed', priceTotal: 140 } } });
    await page.goto('/dev/operator');
    await page.getByRole('button', { name: 'Deschide BK-M-SEED din rând' }).click();
    // No skeleton: the row's booking at once.
    await expect(body(page).getByTestId('booking-detail-price')).toHaveText('120 lei', { timeout: 1500 });
    await expect(dialog(page).getByTestId('booking-detail-skeleton')).toHaveCount(0);
    await expect(page).toHaveURL(/rezervare=m-seed/);
    // The background revalidation lands.
    await expect(body(page).getByTestId('booking-detail-price')).toHaveText('140 lei');
    await expect(body(page)).toContainText('Confirmată');
    expect(calls).toContain('m-seed');
  });

  test('c3 + b.reputation: rating pill «4,6» and «2 neprezentări» only once the reputation has loaded', async ({ page }) => {
    await mockDetails(page);
    await mockReputation(page, { 'u-ion': { avgStars: 4.62, noShowCount: 2, delayMs: 1500 }, 'u-ana': { avgStars: null, noShowCount: 20 } });
    await open(page, S.pending.documentId);
    await expect(body(page)).toBeVisible();
    // Before the reputation lands: nothing (never an empty or zero rating).
    await expect(body(page).getByTestId('angler-rating-badge')).toHaveCount(0);
    await expect(body(page).getByTestId('no-show-pill')).toHaveCount(0);
    await expect(body(page).getByTestId('angler-rating-badge')).toHaveText('Evaluat cu 4,6 din 5');
    await expect(body(page).getByTestId('no-show-pill')).toHaveText('2 neprezentări');
    // Header as the card: stand + green extras, period with hours, price, status pill.
    await expect(body(page)).toContainText('Standul 5');
    await expect(body(page).getByText('Barcă', { exact: true }).first()).toBeVisible();
    await expect(body(page).getByTestId('booking-detail-price')).toHaveText('230 lei');
    await expect(body(page)).toContainText('În așteptare');
    // No rating at all → no pill; 20 no-shows → «20 de neprezentări» (formatCount).
    await open(page, S.rateable.documentId);
    await expect(body(page).getByTestId('no-show-pill')).toHaveText('20 de neprezentări');
    await expect(body(page).getByTestId('angler-rating-badge')).toHaveCount(0);
  });

  test('c4 the angler opens /pescari/[id] and closes the dialog; Back returns without it', async ({ page }) => {
    await mockDetails(page);
    await page.goto('/dev/operator');
    // Hydrated (the lake name is a client read): Next's history patch is installed.
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Operator · Chita Lake');
    await page.evaluate((id) => window.history.replaceState(null, '', `/dev/operator?rezervare=${id}`), S.confirmed.documentId);
    await expect(body(page)).toBeVisible();
    const name = body(page).getByTestId('booking-detail-angler');
    await expect(name).toHaveAttribute('href', '/pescari/u-ion');
    await name.click();
    await expect(page).toHaveURL(/\/pescari\/u-ion$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/dev\/operator$/);
    await expect(dialog(page)).toHaveCount(0);
    // Walk-in without account: plain name, no link.
    await open(page, S.walkIn.documentId);
    await expect(body(page).getByTestId('booking-detail-angler')).toHaveText('Gheorghe Ionescu');
    await expect(body(page).locator('a[href^="/pescari/"]')).toHaveCount(0);
  });

  test('c5 c6 c7 c8 blocks: basis, payment (unpaid / partly / fully paid), request, note / reason / no-show', async ({ page }) => {
    await mockDetails(page);
    await open(page, S.pending.documentId);
    const basis = body(page).getByTestId('booking-detail-basis');
    await expect(basis).toContainText('Tur 12h150 lei');
    await expect(basis).toContainText('Barcă30 lei');
    await expect(basis).toContainText('Cabană × 250 lei');
    await expect(basis).toContainText('Total230 lei');
    await expect(body(page).getByTestId('booking-detail-payment')).toHaveText(/StareNumerar\s*Rest de plată230 lei/);
    const req = body(page).getByTestId('booking-detail-request');
    await expect(req).toContainText('CodBK-M-PENDING');
    await expect(req).toContainText(/Cerută[A-ZȘȚ][a-zăâîșț] \d{1,2} [a-z]{3}, \d{2}:\d{2}/);
    await expect(req).toContainText('Telefon+40700000000');
    await expect(body(page).getByTestId('booking-detail-note')).toContainText('„Vin cu fiul meu, am vrea un stand umbrit.”');

    await open(page, S.confirmed.documentId);
    await expect(body(page).getByTestId('booking-detail-payment')).toHaveText(/StareAvans\s*Încasat50 lei\s*Rest de plată100 lei/);

    await open(page, S.paid.documentId);
    await expect(body(page).getByTestId('booking-detail-basis')).toHaveCount(0);
    await expect(body(page).getByTestId('booking-detail-payment')).toHaveText(/StarePlătit\s*Încasat150 lei$/);

    await open(page, S.rejected.documentId);
    await expect(body(page).getByTestId('booking-detail-note')).toContainText('„Aș vrea pontonul.”');
    await expect(body(page).getByTestId('booking-detail-reason')).toHaveText(/Motiv refuz\s*Standul nu este disponibil\./);
    await expect(body(page)).toContainText('Respinsă');

    await open(page, S.cancelled.documentId);
    await expect(body(page).getByTestId('booking-detail-note')).toHaveCount(0);
    await expect(body(page).getByTestId('booking-detail-reason')).toHaveText(/Motiv anulare\s*Lucrări la baltă\./);
    await expect(body(page)).toContainText('Anulată de tine');
    await expect(body(page).getByTestId('booking-detail-request')).not.toContainText('Telefon');
    // Nothing is owed on a cancelled stay: no «Rest de plată» (deliberate improvement on fish).
    await expect(body(page).getByTestId('booking-detail-payment')).toHaveText(/StareNumerar$/);
    await expect(body(page).getByTestId('booking-detail-payment')).not.toContainText('Rest de plată');

    await open(page, S.noShow.documentId);
    await expect(body(page).getByTestId('booking-detail-no-show')).toHaveText(/Neprezentare\s*A sunat la 5 dimineața că nu mai vine\./);
    await expect(body(page)).toContainText('Nu a venit');
    await open(page, S.noShowDefault.documentId);
    await expect(body(page)).toBeVisible();
    await expect(body(page).getByTestId('booking-detail-no-show')).toHaveCount(0);
    await expect(body(page)).not.toContainText('capot');
  });

  test('c9 every action-row variant', async ({ page }) => {
    await mockDetails(page);
    const actions = () => dialog(page).getByTestId('booking-detail-actions');
    await open(page, S.pending.documentId);
    await expect(actions()).toHaveAttribute('data-variant', 'pending');
    await expect(actions().locator('a, button')).toHaveText(['', 'Refuză', 'Acceptă']);
    await expect(actions().locator('a').first()).toHaveAccessibleName('Sună');

    await open(page, S.confirmed.documentId);
    await expect(actions()).toHaveAttribute('data-variant', 'cancel');
    await expect(actions().getByRole('button')).toHaveText(['Anulează rezervarea']);

    await open(page, S.rateable.documentId);
    await expect(actions()).toHaveAttribute('data-variant', 'rate');
    await expect(actions().getByRole('button')).toHaveText(['Evaluează pescarul']);

    // No-show / reviewed / dead: only «Sună» (phone) or nothing at all (no phone).
    for (const id of [S.noShow.documentId, S.reviewed.documentId, S.rejected.documentId]) {
      await open(page, id);
      await expect(actions()).toHaveAttribute('data-variant', 'none');
      await expect(actions().getByRole('button')).toHaveCount(0);
      await expect(actions().getByRole('link', { name: 'Sună' })).toBeVisible();
    }
    await open(page, S.cancelled.documentId);
    await expect(body(page)).toBeVisible();
    await expect(actions()).toHaveCount(0);
  });

  test('c10 + b.analytics: «Sună» is a tel: link and logs contact_pressed', async ({ page }) => {
    await mockDetails(page);
    await open(page, S.confirmed.documentId);
    await page.evaluate(() => {
      const w = window as unknown as { __events: unknown[] };
      w.__events = [];
      window.addEventListener('bluvi:analytics', (e) => w.__events.push((e as CustomEvent).detail));
      // Keep the page: the tel: navigation itself is the browser's (after React's handler ran).
      document.addEventListener('click', (e) => {
        if ((e.target as Element).closest('a[href^="tel:"]')) e.preventDefault();
      });
    });
    const call = dialog(page).getByRole('link', { name: 'Sună' });
    await expect(call).toHaveAttribute('href', 'tel:+40700000000');
    await call.click();
    const events = await page.evaluate(() => (window as unknown as { __events: unknown[] }).__events);
    expect(events).toEqual([{ name: 'contact_pressed', params: { contact_type: 'Operator guest contact', lake_id: lakeId, lake_name: 'Chita Lake' } }]);
  });

  test('c11 Acceptă closes the detail and opens the confirmation; Refuză / Anulează open their reason dialogs', async ({ page }) => {
    await mockDetails(page);
    await open(page, S.pending.documentId);
    await dialog(page).getByRole('button', { name: 'Acceptă' }).click();
    await expect(page.getByRole('dialog', { name: 'Accepți rezervarea?' }).or(page.getByRole('alertdialog', { name: 'Accepți rezervarea?' }))).toBeVisible();
    await expect(dialog(page)).toHaveCount(0);
    await expect(page).not.toHaveURL(/rezervare=/);
    await page.getByRole('button', { name: 'Renunță' }).click();

    await open(page, S.pending.documentId);
    await dialog(page).getByRole('button', { name: 'Refuză' }).click();
    const reject = page.getByRole('alertdialog', { name: 'Respinge rezervarea' }).or(page.getByRole('dialog', { name: 'Respinge rezervarea' }));
    await expect(reject).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(reject).toHaveCount(0);

    await open(page, S.confirmed.documentId);
    await dialog(page).getByRole('button', { name: 'Anulează rezervarea' }).click();
    const cancel = page.getByRole('alertdialog', { name: 'Anulează rezervarea' }).or(page.getByRole('dialog', { name: 'Anulează rezervarea' }));
    await expect(cancel).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(cancel).toHaveCount(0);
  });

  test('c12 «Evaluează pescarul» closes the detail and opens the rate screen with angler, stand and period', async ({ page }) => {
    await mockDetails(page);
    await page.goto('/dev/operator');
    // Hydrated (the lake name is a client read): Next's history patch is installed.
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Operator · Chita Lake');
    await page.evaluate((id) => window.history.replaceState(null, '', `/dev/operator?rezervare=${id}`), S.rateable.documentId);
    await dialog(page).getByRole('button', { name: 'Evaluează pescarul' }).click();
    await expect(page).toHaveURL(/\/operator\/evalueaza\/m-rate\?/);
    const u = new URL(page.url());
    expect(u.searchParams.get('anglerName')).toBe('ana');
    expect(u.searchParams.get('anglerId')).toBe('u-ana');
    expect(u.searchParams.get('standName')).toBe('5');
    expect(u.searchParams.get('startDate')).toBe(S.rateable.startDate);
    expect(u.searchParams.get('endDate')).toBe(S.rateable.endDate);
    await page.goBack();
    await expect(page).toHaveURL(/\/dev\/operator$/);
    await expect(dialog(page)).toHaveCount(0);
  });

  test('c13 backdrop, the X and Esc close; reopen on another booking at once; focus stays in the dialog', async ({ page }) => {
    await mockDetails(page);
    await mockList(page, [S.pending, S.confirmed]);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/dev/operator');
    await page.getByRole('button', { name: 'Deschide BK-M-PENDING după id' }).click();
    await expect(body(page)).toHaveAttribute('data-booking', 'm-pending');
    // Keyboard trap: Tab never reaches the page behind.
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab');
      const inside = await page.evaluate(() => {
        const a = document.activeElement;
        return !a || a === document.body || !!a.closest('dialog[open]');
      });
      expect(inside).toBe(true);
    }
    // Backdrop (outside the dialog box).
    await page.mouse.click(10, 10);
    await expect(dialog(page)).toHaveCount(0);
    await expect(page).not.toHaveURL(/rezervare=/);
    await page.getByRole('button', { name: 'Deschide BK-M-CONFIRMED din rând' }).click();
    await expect(body(page)).toHaveAttribute('data-booking', 'm-confirmed');
    await dialog(page).getByRole('button', { name: 'Închide' }).click();
    await expect(dialog(page)).toHaveCount(0);
    await page.getByRole('button', { name: 'Deschide BK-M-PENDING după id' }).click();
    await expect(body(page)).toHaveAttribute('data-booking', 'm-pending');
    await page.keyboard.press('Escape');
    await expect(dialog(page)).toHaveCount(0);
    await expect(page).toHaveURL(/\/dev\/operator$/);
  });

  test('c14 a 404 settles on «Rezervarea nu mai există…» with «Închide»; a 500 on the inline error, and the retry recovers', async ({ page }) => {
    const errors = collectConsoleErrors(page, { ignore: EXPECTED_CONSOLE });
    await mockDetails(page, { 'm-gone': { status: 404 } });
    await open(page, 'm-gone');
    const gone = dialog(page).getByTestId('booking-detail-gone');
    await expect(gone).toContainText('Rezervarea nu mai există sau nu e a acestei bălți.');
    await expect(dialog(page).getByTestId('booking-detail-skeleton')).toHaveCount(0);
    await expect(dialog(page).getByTestId('booking-detail-actions')).toHaveCount(0);
    await settled(page);
    await expectNoA11yViolations(page);
    await gone.getByRole('button', { name: 'Închide' }).click();
    await expect(dialog(page)).toHaveCount(0);
    await expect(page).not.toHaveURL(/rezervare=/);

    // 500: the client retries twice, then the inline error; «Încearcă din nou» reads again.
    let fail = true;
    await page.route('**/api/cms/feed/bookings/m-flaky', (r) =>
      fail
        ? r.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ data: null, error: { status: 500, name: 'Error', message: 'x' } }) })
        : r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: onLake(B('m-flaky')) }) }),
    );
    await open(page, 'm-flaky');
    const err = dialog(page).getByRole('alert');
    await expect(err).toContainText('Nu am putut încărca rezervarea.', { timeout: 20_000 });
    await expect(dialog(page).getByTestId('booking-detail-skeleton')).toHaveCount(0);
    await settled(page);
    await expectNoA11yViolations(page);
    fail = false;
    await err.getByRole('button', { name: 'Încearcă din nou' }).click();
    await expect(body(page)).toHaveAttribute('data-booking', 'm-flaky');
    expect(errors).toEqual([]);
  });

  test('c14 a booking of another lake (or the viewer\'s own angler booking) is never shown with this lake\'s actions', async ({ page }) => {
    // On another lake the QA user may also own (or the viewer's own angler booking): same endpoint.
    await page.route('**/api/cms/feed/bookings/m-foreign', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: onLake({ ...S.pending, documentId: 'm-foreign' }, 'lake-other') }) }),
    );
    await open(page, 'm-foreign');
    await expect(dialog(page).getByTestId('booking-detail-gone')).toContainText('Rezervarea nu mai există sau nu e a acestei bălți.');
    await expect(body(page)).toHaveCount(0);
    await expect(dialog(page).getByRole('button', { name: 'Acceptă' })).toHaveCount(0);
    await expect(dialog(page).getByRole('button', { name: 'Refuză' })).toHaveCount(0);
  });

  test('c9 the action clock is taken at open: page mounted, the stay ends, then opened → «Evaluează», not «Anulează»', async ({ page }) => {
    // Ends one hour from now; the detail read never answers, so only the seed (updatedAt 0) is shown.
    const seed = B('m-clock', { startDate: rel(-11), endDate: rel(1) });
    await page.clock.install();
    await mockList(page, [seed]);
    await mockDetails(page, { 'm-clock': { hang: true } });
    await page.goto('/dev/operator');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Operator · Chita Lake');
    // The dashboard stays open; three hours pass (no timers fired, only the wall clock).
    await page.clock.setSystemTime(Date.now() + 3 * H);
    await page.getByRole('button', { name: 'Deschide BK-M-CLOCK din rând' }).click();
    await expect(dialog(page).getByTestId('booking-detail-actions')).toHaveAttribute('data-variant', 'rate');
    await expect(dialog(page).getByRole('button', { name: 'Evaluează pescarul' })).toBeVisible();
    await expect(dialog(page).getByRole('button', { name: 'Anulează rezervarea' })).toHaveCount(0);
  });

  for (const width of WIDTHS) {
    test(`every state renders at ${width} (axe, no console errors)`, async ({ page }) => {
      test.setTimeout(150_000);
      const errors = collectConsoleErrors(page, { ignore: EXPECTED_CONSOLE });
      await page.setViewportSize({ width, height: 900 });
      await mockDetails(page);
      await mockReputation(page, { 'u-ion': { avgStars: 4.6, noShowCount: 2 } });
      for (const id of [S.pending.documentId, S.cancelled.documentId, S.noShow.documentId, S.walkIn.documentId]) {
        await open(page, id);
        await expect(body(page)).toBeVisible();
        if (id === S.pending.documentId) await expect(body(page).getByTestId('angler-rating-badge')).toBeVisible();
        // No horizontal scroll inside the surface.
        const overflow = await dialog(page).evaluate((d) => d.scrollWidth - d.clientWidth);
        expect(overflow).toBeLessThanOrEqual(0);
        await settled(page);
        await page.screenshot({ path: test.info().outputPath(`${id}-${width}.png`) });
      }
      await open(page, S.pending.documentId);
      await expect(body(page)).toBeVisible();
      await settled(page);
      await expectNoA11yViolations(page);
      expect(errors).toEqual([]);
    });
  }
});
