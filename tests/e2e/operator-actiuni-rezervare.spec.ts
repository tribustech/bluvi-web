import { mkdirSync } from 'node:fs';
import { expect, test, type APIRequestContext, type Page, type Request, type Route } from '@playwright/test';
import { expectNoA11yViolations } from './helpers/a11y';
import { collectConsoleErrors } from './helpers/console';
import { CMS, qaJwt, signIn } from './helpers/session';

/*
 * operator.actiuni-rezervare — accept / reject / cancel / no-show dialogs (components/operator/actions),
 * driven through the dev harness /dev/operator/actions?ids=… (each booking with its action row, all
 * acting through useOperatorBookingActions, as the inbox / panel / detail do).
 *
 * REAL writes on the LOCAL CMS (owner 2026-10-08: push tokens removed, Postmark on its test token).
 * The QA user owns the local Chita Lake:
 *  - accept / reject act on a real pending request the QA user makes on Chita (POST /feed/bookings —
 *    the CMS lets an owner request their own lake);
 *  - cancel / no-show act on a real walk-in for a guest without an account (POST
 *    /feed/bookings/walk-in), so no real angler's reputation is touched.
 * Every test cleans up in afterEach: whatever it created that is still pending / confirmed is
 * operator-cancelled (reject is terminal; a no-show stays `confirmed` and is cancelled after, which
 * frees the stand). Server refusals (c11) and the extras / no-stand variants of c2 are route mocks on
 * fake booking ids.
 */

const LAKE = 's84u55lo4n9z0emngozttt6e'; // local Chita Lake
const QA_USER = 'pducvrkstdjrtzop6isewt1u'; // the QA account's documentId (reputation read, c13)
const HARNESS = '/dev/operator/actions';
const SHOTS = '.shots/operator-actiuni-rezervare';
const WIDTHS = [375, 1280, 1440, 1920] as const;
// The refusals are real 4xx answers from the proxy (mocked); the browser logs each failed resource.
const EXPECTED_CONSOLE = [/Failed to load resource: the server responded with a status of (400|403|409|500)/];

const surface = (page: Page) => page.locator('dialog[open]');
/** Waits out the open surface's enter transition (axe reads mid-fade colours otherwise). */
const settled = (page: Page) =>
  expect
    .poll(() =>
      page.evaluate(() => {
        const d = document.querySelector('dialog[open]');
        if (!d) return true;
        return d.getAnimations({ subtree: true }).every((a) => a.playState !== 'running' || a.effect?.getComputedTiming().iterations === Infinity);
      })
    )
    .toBe(true);
const axe = async (page: Page) => {
  await settled(page);
  await expectNoA11yViolations(page);
};
const toast = (page: Page, text: string) => page.getByText(text, { exact: true });
/**
 * A reason dialog's inline refusal (c11): its text, in the viewport, and actually on top at its
 * centre (a site toast under the modal's ::backdrop passes toBeVisible while dimmed and inert).
 */
async function expectRefusal(page: Page, testId: string, text: string) {
  const line = surface(page).getByTestId(`${testId}-refusal`);
  await expect(line).toHaveText(text);
  await expect(line).toBeInViewport();
  const onTop = await line.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!hit && el.contains(hit);
  });
  expect(onTop, `${testId} refusal is painted on top`).toBe(true);
  await expect(surface(page).getByRole('alert')).toContainText(text);
}
const statusOf = (page: Page, id: string) => page.getByTestId(`status-${id}`);
const row = (page: Page, id: string) => page.getByTestId(`row-${id}`);

let jwt: string;
const created: string[] = [];

test.beforeAll(async ({ request }) => {
  jwt = await qaJwt(request);
});

test.afterEach(async ({ request }) => {
  // Leave Chita as we found it: everything still live is operator-cancelled (terminal ones refuse
  // with INVALID_STATUS, which is fine).
  while (created.length) {
    const id = created.pop()!;
    const res = await request.get(`${CMS}/feed/bookings/${id}`, { headers: auth() });
    const status = res.ok() ? ((await res.json()) as { data: { bookingStatus: string } }).data.bookingStatus : null;
    if (status === 'pending' || status === 'confirmed') {
      const c = await request.patch(`${CMS}/feed/bookings/${id}/operator-cancel`, {
        headers: auth(),
        data: { reason: 'Test e2e — curățenie automată.' },
      });
      expect(c.ok(), `cleanup of ${id}`).toBe(true);
    }
  }
});

const auth = () => ({ Authorization: `Bearer ${jwt}` });

/* ------------------------------------------------------------------------------------------------
 * Real bookings on Chita
 * -------------------------------------------------------------------------------------------- */

/** Local midnight + `days` + `hour`, as ISO (Chita's tours are 06–18 local). */
function at(days: number, hour: number) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  d.setHours(hour);
  return d.toISOString();
}

type Avail = {
  stands: { documentId: string; name: string }[];
  bookings: { standDocumentId: string; start: string; end: string }[];
  blocks: { standDocumentId: string | null; start: string; end: string }[];
};

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * A free 06–18 slot on Chita, far from the other specs' days (they look at day 3–14): days 16–40,
 * the highest stands first, one hour of margin around every booking.
 */
async function freeSlot(request: APIRequestContext, skip: Set<string> = new Set()) {
  const overlaps = (a: { start: string; end: string }, s: number, e: number) => Date.parse(a.start) < e && Date.parse(a.end) > s;
  for (let day = 16; day <= 40; day++) {
    const s = at(day, 6);
    const e = at(day, 18);
    const from = new Date(s);
    from.setDate(from.getDate() - 1);
    const to = new Date(s);
    to.setDate(to.getDate() + 2);
    const res = await request.get(`${CMS}/feed/lakes/${LAKE}/availability`, { params: { from: ymd(from), to: ymd(to) } });
    const av = ((await res.json()) as { data: Avail }).data;
    const [S, E] = [Date.parse(s), Date.parse(e)];
    for (const st of [...av.stands].reverse()) {
      if (skip.has(`${st.documentId}@${day}`)) continue;
      const busy =
        av.bookings.some((b) => b.standDocumentId === st.documentId && overlaps(b, S - 3_600_000, E + 3_600_000)) ||
        av.blocks.some((b) => (b.standDocumentId === null || b.standDocumentId === st.documentId) && overlaps(b, S, E));
      if (!busy) return { stand: st.documentId, standName: st.name, start: s, end: e, key: `${st.documentId}@${day}` };
    }
  }
  throw new Error('no free 06–18 slot on Chita in days 16–40');
}

type Created = { documentId: string; bookingStatus: string; contactFullname?: string; stand?: { name: string }; priceTotal: number };

/** A guest walk-in (confirmed, no account). */
async function walkIn(request: APIRequestContext, name = 'Oaspete E2E') {
  const s = await freeSlot(request);
  const res = await request.post(`${CMS}/feed/bookings/walk-in`, {
    headers: auth(),
    data: { data: { lake: LAKE, stand: s.stand, startDate: s.start, endDate: s.end, extras: [], contactFullname: name, contactPhone: '+40700000001' } },
  });
  expect(res.ok(), await res.text()).toBe(true);
  const b = ((await res.json()) as { data: Created }).data;
  created.push(b.documentId);
  expect(b.bookingStatus).toBe('confirmed');
  return { ...b, slot: s };
}

/** A pending request the QA user makes on their own lake. */
async function pendingRequest(request: APIRequestContext) {
  const s = await freeSlot(request);
  const res = await request.post(`${CMS}/feed/bookings`, {
    headers: auth(),
    data: { data: { lake: LAKE, stand: s.stand, startDate: s.start, endDate: s.end, extras: [], contactFullname: 'Sim QA', contactPhone: '+40712345678' } },
  });
  expect(res.ok(), await res.text()).toBe(true);
  const b = ((await res.json()) as { data: Created }).data;
  created.push(b.documentId);
  expect(b.bookingStatus).toBe('pending');
  return { ...b, slot: s };
}

async function open(page: Page, ids: string[], extra = '') {
  await signIn(page.context(), jwt);
  await page.goto(`${HARNESS}?ids=${ids.join(',')}${extra}`);
  // The shared dev server may compile the harness on first visit.
  for (const id of ids) await expect(row(page, id)).toBeVisible({ timeout: 45_000 });
}

/** Counts GET requests whose URL matches. */
function countGets(page: Page, re: RegExp) {
  const c = { n: 0 };
  page.on('request', (r: Request) => {
    if (r.method() === 'GET' && re.test(r.url())) c.n += 1;
  });
  return c;
}
const STATS = new RegExp(`/api/cms/feed/lakes/${LAKE}/operator-stats`);

/** Holds the matching write until `release()`; records its body. */
async function holdWrite(page: Page, re: RegExp) {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  const seen: { body: unknown; method: string }[] = [];
  await page.route(re, async (r: Route) => {
    seen.push({ method: r.request().method(), body: r.request().postDataJSON() });
    await gate;
    await r.fallback();
  });
  return { release: () => release(), seen };
}

/* ------------------------------------------------------------------------------------------------
 * Mocked bookings (fake ids) — refusals, the extras / no-stand variants, the screenshots
 * -------------------------------------------------------------------------------------------- */

function fake(id: string, over: Record<string, unknown> = {}) {
  return {
    documentId: id,
    code: `BK-${id.toUpperCase()}`,
    startDate: at(20, 6),
    endDate: at(20, 18),
    bookingStatus: 'pending',
    priceTotal: 330,
    depositAmount: 0,
    paymentStatus: 'none',
    contactPhone: '+40700000002',
    contactFullname: 'Andrei Ionescu',
    noShow: false,
    paymentMode: 'offline',
    basis: {
      durationHours: 12,
      rowLabel: null,
      composedFrom: [12],
      tourPrice: 250,
      extras: [
        { key: 'boat', label: 'Barcă', unit: 'perStay', unitPrice: 50, quantity: 1, total: 50 },
        { key: 'cabana', label: 'Cabană', unit: 'perNight', unitPrice: 30, quantity: 1, total: 30 },
      ],
    },
    lake: { documentId: LAKE, name: 'Chita Lake', contactPhone: null, minCancelNoticeHours: 24, checkoutBufferMinutes: 0, thumbUrl: null, locality: 'Giurgiu' },
    stand: { documentId: `stand-${id}`, name: 'A10' },
    angler: { documentId: `angler-${id}`, username: 'andrei.ionescu', avatar: null },
    ...over,
  };
}

const json = (r: Route, body: unknown, status = 200) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const refusal = (bluCode: string | null, message: string, status = 400) => ({
  data: null,
  error: { status, name: 'ApplicationError', message, details: bluCode ? { bluCode } : {} },
});

/** GET /api/cms/feed/bookings/{id} for the fake ids. */
async function mockBookings(page: Page, rows: ReturnType<typeof fake>[]) {
  const byId = new Map(rows.map((b) => [b.documentId, b]));
  await page.route(/\/api\/cms\/feed\/bookings\/[^/?]+$/, (r) => {
    const id = new URL(r.request().url()).pathname.split('/').pop()!;
    const b = byId.get(id);
    return b && r.request().method() === 'GET' ? json(r, { data: b }) : r.fallback();
  });
}

/* ================================================================================================
 * Accept (real)
 * ============================================================================================== */

test.describe('operator.actiuni-rezervare (local CMS)', () => {
  test('c1 c2 c3 c13 b.write-invalidation b.double-submit: accept a real request', async ({ page, request: api }) => {
    const errors = collectConsoleErrors(page);
    const b = await pendingRequest(api);
    const stats = countGets(page, STATS);
    await open(page, [b.documentId]);
    await expect(page.getByTestId('harness-stats')).toContainText('De aprobat');

    // c1: Acceptă never acts directly — the confirmation opens.
    const accepts: string[] = [];
    page.on('request', (r) => r.method() === 'PATCH' && r.url().endsWith('/accept') && accepts.push(r.url()));
    await row(page, b.documentId).getByRole('button', { name: 'Acceptă' }).click();
    const dlg = surface(page);
    await expect(dlg.getByRole('heading', { name: 'Accepți rezervarea?' })).toBeVisible();
    await expect(dlg).toHaveAttribute('role', 'alertdialog');
    await expect(dlg.getByText('Pescarul primește notificare, iar standul se blochează pentru acest interval.')).toBeVisible();
    // c2: badge, name, period, Stand row, no Extra row (none booked), the total.
    await expect(dlg.getByTestId('accept-stand-badge')).toHaveText(b.slot.standName);
    await expect(dlg.getByText('Sim QA', { exact: true })).toBeVisible();
    await expect(dlg.getByText(/→/)).toBeVisible();
    await expect(dlg.locator('dt', { hasText: 'Stand' })).toBeVisible();
    await expect(dlg.locator('dd', { hasText: b.slot.standName })).toBeVisible();
    await expect(dlg.locator('dt', { hasText: 'Extra' })).toHaveCount(0);
    await expect(dlg.getByText('Încasezi', { exact: true })).toBeVisible();
    await expect(dlg.getByText('la fața locului', { exact: true })).toBeVisible();
    await expect(dlg.getByText(String(b.priceTotal), { exact: true })).toBeVisible();
    await expect(dlg.getByText('lei', { exact: true })).toBeVisible();
    // c3: Renunță closes without a write.
    await dlg.getByRole('button', { name: 'Renunță' }).click();
    await expect(surface(page)).toHaveCount(0);
    expect(accepts).toHaveLength(0);

    // c3 + b.double-submit: Confirmă closes the dialog, the row's buttons are disabled while the PATCH runs.
    const statsBefore = stats.n;
    const hold = await holdWrite(page, /\/api\/cms\/feed\/bookings\/[^/]+\/accept$/);
    await row(page, b.documentId).getByRole('button', { name: 'Acceptă' }).click();
    await surface(page).getByRole('button', { name: 'Confirmă' }).click();
    await expect(surface(page)).toHaveCount(0);
    await expect.poll(() => hold.seen.length).toBe(1);
    expect(hold.seen[0].method).toBe('PATCH');
    await expect(row(page, b.documentId).getByRole('button', { name: 'Acceptă' })).toBeDisabled();
    await expect(row(page, b.documentId).getByRole('button', { name: 'Refuză' })).toBeDisabled();
    hold.release();
    await expect(toast(page, 'Rezervare confirmată')).toBeVisible();
    // c13 / b.write-invalidation: the booking (['bookings']) and the stats (['operator-stats']) refetch.
    await expect(statusOf(page, b.documentId)).toHaveText('confirmed');
    await expect.poll(() => stats.n).toBeGreaterThan(statsBefore);
    expect(accepts).toHaveLength(1);
    expect(errors).toEqual([]);
  });

  /* ==============================================================================================
   * Reject (real)
   * ============================================================================================ */

  test('c4 c5 c6 c12 c13: reject a real request with a reason', async ({ page, request: api }) => {
    const errors = collectConsoleErrors(page);
    const b = await pendingRequest(api);
    const stats = countGets(page, STATS);
    await open(page, [b.documentId]);
    const rejectBtn = row(page, b.documentId).getByRole('button', { name: 'Refuză' });

    await rejectBtn.click();
    const dlg = surface(page);
    // c4
    await expect(dlg.getByRole('heading', { name: 'Respinge rezervarea' })).toBeVisible();
    await expect(dlg.getByText('Această acțiune este definitivă. Spune-ne motivul — îl trimitem celeilalte părți.')).toBeVisible();
    const field = dlg.getByRole('textbox', { name: 'Motivul refuzului' });
    await expect(field).toHaveAttribute('placeholder', 'Motivul refuzului...');
    await expect(dlg.getByRole('button', { name: 'Înapoi' })).toBeVisible();
    const confirm = dlg.getByRole('button', { name: 'Da, respinge' });
    // c5: empty → red field + the line; focus goes to the field.
    await confirm.click();
    await expect(dlg.getByText('Motivul este obligatoriu (minim 5 caractere).')).toBeVisible();
    await expect(field).toHaveAttribute('aria-invalid', 'true');
    await expect(field).toBeFocused();
    await field.fill('   abcd   ');
    await confirm.click();
    await expect(dlg.getByText('Motivul este obligatoriu (minim 5 caractere).')).toBeVisible();
    // c12: closing resets text and error.
    await dlg.getByRole('button', { name: 'Înapoi' }).click();
    await expect(surface(page)).toHaveCount(0);
    await rejectBtn.click();
    await expect(surface(page).getByRole('textbox', { name: 'Motivul refuzului' })).toHaveValue('');
    await expect(surface(page).getByText('Motivul este obligatoriu (minim 5 caractere).')).toHaveCount(0);

    // c12: while the PATCH runs the confirm is busy and both buttons are disabled; Escape does not close.
    const statsBefore = stats.n;
    const hold = await holdWrite(page, /\/api\/cms\/feed\/bookings\/[^/]+\/reject$/);
    await surface(page).getByRole('textbox', { name: 'Motivul refuzului' }).fill('  Standul e rezervat telefonic.  ');
    await surface(page).getByRole('button', { name: 'Da, respinge' }).click();
    await expect.poll(() => hold.seen.length).toBe(1);
    expect(hold.seen[0]).toEqual({ method: 'PATCH', body: { reason: 'Standul e rezervat telefonic.' } });
    await expect(surface(page).getByRole('button', { name: 'Da, respinge' })).toBeDisabled();
    await expect(surface(page).getByRole('button', { name: 'Da, respinge' })).toHaveAttribute('aria-busy', 'true');
    await expect(surface(page).getByRole('button', { name: 'Înapoi' })).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(surface(page)).toHaveCount(1);
    await expect(rejectBtn).toBeDisabled(); // b.double-submit: actingId
    hold.release();
    // c6
    await expect(toast(page, 'Rezervare respinsă')).toBeVisible();
    await expect(surface(page)).toHaveCount(0);
    await expect(statusOf(page, b.documentId)).toHaveText('rejected');
    await expect.poll(() => stats.n).toBeGreaterThan(statsBefore);
    expect(errors).toEqual([]);
  });

  /* ==============================================================================================
   * Cancel (real walk-in)
   * ============================================================================================ */

  test('c7 c8 c10 c12 c13: the reason list, prefill, labels and a real operator cancel', async ({ page, request: api }) => {
    const errors = collectConsoleErrors(page);
    const b = await walkIn(api);
    const stats = countGets(page, STATS);
    await open(page, [b.documentId]);
    const cancelBtn = row(page, b.documentId).getByRole('button', { name: 'Anulează rezervarea' });
    await cancelBtn.click();
    const dlg = surface(page);
    await expect(dlg.getByRole('heading', { name: 'Anulează rezervarea' })).toBeVisible();
    // c7: six reasons, none picked.
    const group = dlg.getByRole('group', { name: 'Alege motivul' });
    const radios = group.getByRole('radio');
    await expect(radios).toHaveCount(6);
    const labels = ['Pescarul nu s-a prezentat', 'Pescarul a anunțat telefonic', 'Condiții meteo', 'Lucrări sau închidere', 'Standul nu e disponibil', 'Alt motiv'];
    for (const [i, l] of labels.entries()) {
      await expect(radios.nth(i)).toHaveAccessibleName(l);
      await expect(radios.nth(i)).not.toBeChecked();
    }
    const text = dlg.getByRole('textbox', { name: 'Mesajul pentru pescar' });
    // c8: no pick → «Alege un motiv din listă.»; default label «Da, anulează»; focus to the list.
    await dlg.getByRole('button', { name: 'Da, anulează' }).click();
    await expect(dlg.getByText('Alege un motiv din listă.')).toBeVisible();
    await expect(radios.first()).toBeFocused();
    // c7: a pick prefills the editable text.
    await dlg.getByText('Condiții meteo', { exact: true }).click();
    await expect(text).toHaveValue('Condiții meteo nefavorabile.');
    await expect(dlg.getByText('Alege un motiv din listă.')).toHaveCount(0);
    // c8: «Da, marchează» only while the no-show is picked.
    await dlg.getByText('Pescarul nu s-a prezentat', { exact: true }).click();
    await expect(text).toHaveValue('Pescarul nu s-a prezentat.');
    await expect(dlg.getByRole('button', { name: 'Da, marchează' })).toBeVisible();
    // Keyboard: arrows move the pick (native radios).
    await radios.first().focus();
    await page.keyboard.press('ArrowDown');
    await expect(radios.nth(1)).toBeChecked();
    await expect(text).toHaveValue('Pescarul a anunțat telefonic că nu mai vine.');
    await expect(dlg.getByRole('button', { name: 'Da, anulează' })).toBeVisible();
    // «Alt motiv» leaves the text empty: the length rule applies.
    await dlg.getByText('Alt motiv', { exact: true }).click();
    await expect(text).toHaveValue('');
    await dlg.getByRole('button', { name: 'Da, anulează' }).click();
    await expect(dlg.getByText('Motivul este obligatoriu (minim 5 caractere).')).toBeVisible();
    await expect(text).toBeFocused();
    // c12: closing resets the pick, the text and the error.
    await dlg.getByRole('button', { name: 'Înapoi' }).click();
    await expect(surface(page)).toHaveCount(0);
    await cancelBtn.click();
    await expect(surface(page).getByRole('radio', { checked: true })).toHaveCount(0);
    await expect(surface(page).getByRole('textbox', { name: 'Mesajul pentru pescar' })).toHaveValue('');
    await expect(surface(page).getByText('Motivul este obligatoriu (minim 5 caractere).')).toHaveCount(0);

    // c10: an edited prefill is what is sent, to /operator-cancel.
    const statsBefore = stats.n;
    const hold = await holdWrite(page, /\/api\/cms\/feed\/bookings\/[^/]+\/(operator-cancel|no-show)$/);
    await surface(page).getByText('Lucrări sau închidere', { exact: true }).click();
    await surface(page).getByRole('textbox', { name: 'Mesajul pentru pescar' }).fill('Lucrări la baltă. Revenim în weekend.');
    await surface(page).getByRole('button', { name: 'Da, anulează' }).click();
    await expect.poll(() => hold.seen.length).toBe(1);
    await expect(surface(page).getByRole('button', { name: 'Da, anulează' })).toBeDisabled();
    await expect(surface(page).getByRole('button', { name: 'Înapoi' })).toBeDisabled();
    await expect(surface(page).getByRole('radio').first()).toBeDisabled();
    hold.release();
    expect(hold.seen[0]).toEqual({ method: 'PATCH', body: { reason: 'Lucrări la baltă. Revenim în weekend.' } });
    await expect(toast(page, 'Rezervare anulată')).toBeVisible();
    await expect(surface(page)).toHaveCount(0);
    await expect(statusOf(page, b.documentId)).toHaveText('cancelled');
    await expect.poll(() => stats.n).toBeGreaterThan(statsBefore);
    expect(errors).toEqual([]);
  });

  /* ==============================================================================================
   * No-show (real walk-in)
   * ============================================================================================ */

  test('c9 c13: «Pescarul nu s-a prezentat» POSTs /no-show, stays confirmed, refetches reputation', async ({ page, request: api }) => {
    const errors = collectConsoleErrors(page);
    const b = await walkIn(api);
    const stats = countGets(page, STATS);
    // Public read (auth none): straight to the CMS, not through /api/cms.
    const rep = countGets(page, new RegExp(`/feed/users/${QA_USER}/reputation`));
    const cancels: string[] = [];
    page.on('request', (r) => r.url().endsWith('/operator-cancel') && cancels.push(r.url()));
    await open(page, [b.documentId], `&rep=${QA_USER}`);
    await expect(page.getByTestId('harness-stats')).toContainText('reputație încărcată');
    await row(page, b.documentId).getByRole('button', { name: 'Anulează rezervarea' }).click();
    await surface(page).getByText('Pescarul nu s-a prezentat', { exact: true }).click();
    const [statsBefore, repBefore] = [stats.n, rep.n];
    const post = page.waitForRequest((r) => r.method() === 'POST' && r.url().endsWith(`/feed/bookings/${b.documentId}/no-show`));
    await surface(page).getByRole('button', { name: 'Da, marchează' }).click();
    expect((await post).postDataJSON()).toEqual({ data: { comment: 'Pescarul nu s-a prezentat.' } });
    await expect(toast(page, 'Neprezentare înregistrată')).toBeVisible();
    await expect(surface(page)).toHaveCount(0);
    // Not a cancellation: no /operator-cancel, the booking stays confirmed with noShow.
    await expect(statusOf(page, b.documentId)).toHaveText('noShow');
    const check = await api.get(`${CMS}/feed/bookings/${b.documentId}`, { headers: auth() });
    expect(((await check.json()) as { data: { bookingStatus: string; noShow: boolean } }).data).toMatchObject({ bookingStatus: 'confirmed', noShow: true });
    expect(cancels).toHaveLength(0);
    // c13: bookings + stats + reputation.
    await expect.poll(() => stats.n).toBeGreaterThan(statsBefore);
    await expect.poll(() => rep.n).toBeGreaterThan(repBefore);
    // No further action on a no-show (no cancel button, fish bookingActionGates).
    await expect(row(page, b.documentId).getByRole('button')).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});

/* ================================================================================================
 * Mocked: c2 variants, refusals (c11), a11y, keyboard, screenshots
 * ============================================================================================== */

test.describe('operator.actiuni-rezervare (mocked rows)', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page.context(), jwt);
  });

  test('c2: extras joined, no stand → no badge and no Stand row; amount spaced from «lei»', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    const withExtras = fake('fx1');
    const noStand = fake('fx2', { stand: undefined, basis: undefined, angler: undefined, contactFullname: 'Maria Pop', priceTotal: 1250 });
    await mockBookings(page, [withExtras, noStand]);
    await page.goto(`${HARNESS}?ids=fx1,fx2`);
    await row(page, 'fx1').getByRole('button', { name: 'Acceptă' }).click();
    let dlg = surface(page);
    await expect(dlg.getByTestId('accept-stand-badge')).toHaveText('A10');
    await expect(dlg.getByText('andrei.ionescu', { exact: true })).toBeVisible();
    await expect(dlg.locator('dd', { hasText: 'Barcă, Cabană' })).toBeVisible();
    await expect(dlg.getByText('330', { exact: true })).toBeVisible();
    await dlg.getByRole('button', { name: 'Renunță' }).click();
    await row(page, 'fx2').getByRole('button', { name: 'Acceptă' }).click();
    dlg = surface(page);
    await expect(dlg.getByText('Maria Pop', { exact: true })).toBeVisible();
    await expect(dlg.getByTestId('accept-stand-badge')).toHaveCount(0);
    await expect(dlg.locator('dt')).toHaveCount(0);
    await expect(dlg.getByText('1.250', { exact: true })).toBeVisible();
    // Escape answers «Renunță» (the alert dialog has no X).
    await page.keyboard.press('Escape');
    await expect(surface(page)).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('c11: refusals by bluCode — accept toasted, reason dialogs inline and open with their text', async ({ page }) => {
    const errors = collectConsoleErrors(page, { ignore: EXPECTED_CONSOLE });
    const p = fake('fp1');
    const c = fake('fc1', { bookingStatus: 'confirmed' });
    await mockBookings(page, [p, c]);
    const answers: Record<string, ReturnType<typeof refusal>> = {};
    let status = 409;
    await page.route(/\/api\/cms\/feed\/bookings\/(fp1|fc1)\/(accept|reject|operator-cancel|no-show)$/, (r) => {
      const action = new URL(r.request().url()).pathname.split('/').pop()!;
      return json(r, answers[action], status);
    });
    await page.goto(`${HARNESS}?ids=fp1,fc1`);

    // Accept → STAND_TAKEN.
    answers.accept = refusal('STAND_TAKEN', 'Standul tocmai a fost rezervat. Alege altul.');
    await row(page, 'fp1').getByRole('button', { name: 'Acceptă' }).click();
    await surface(page).getByRole('button', { name: 'Confirmă' }).click();
    await expect(toast(page, 'Standul are deja o rezervare confirmată pe acel interval.')).toBeVisible();
    await expect(row(page, 'fp1').getByRole('button', { name: 'Acceptă' })).toBeEnabled();

    // Reject → INVALID_STATUS: the dialog stays open, text kept, the refusal inline (not a toast
    // under the modal's backdrop).
    status = 400;
    answers.reject = refusal('INVALID_STATUS', 'Status invalid.');
    await row(page, 'fp1').getByRole('button', { name: 'Refuză' }).click();
    await surface(page).getByRole('textbox').fill('Nu mai avem locuri.');
    await surface(page).getByRole('button', { name: 'Da, respinge' }).click();
    await expectRefusal(page, 'reject-dialog', 'Rezervarea nu mai poate fi modificată.');
    await expect(toast(page, 'Rezervarea nu mai poate fi modificată.')).toHaveCount(1); // inline only
    await expect(surface(page).getByRole('textbox')).toHaveValue('Nu mai avem locuri.');
    await expect(surface(page).getByRole('button', { name: 'Da, respinge' })).toBeEnabled();
    // An edit drops it.
    await surface(page).getByRole('textbox').fill('Nu mai avem locuri libere.');
    await expect(surface(page).getByTestId('reject-dialog-refusal')).toHaveCount(0);
    // Reject → REJECT_REASON_REQUIRED.
    answers.reject = refusal('REJECT_REASON_REQUIRED', 'Motiv lipsă.');
    await surface(page).getByRole('button', { name: 'Da, respinge' }).click();
    await expectRefusal(page, 'reject-dialog', 'Motivul este obligatoriu (minim 5 caractere).');
    await surface(page).getByRole('button', { name: 'Înapoi' }).click();

    // Cancel → CANCEL_REASON_REQUIRED (checked at the desktop dialog too, where the toast used to
    // sit over the dialog's top edge under the backdrop).
    for (const width of [375, 1280]) {
      await page.setViewportSize({ width, height: width < 768 ? 812 : 900 });
      answers['operator-cancel'] = refusal('CANCEL_REASON_REQUIRED', 'Motiv lipsă.');
      await row(page, 'fc1').getByRole('button', { name: 'Anulează rezervarea' }).click();
      await expect(surface(page).getByTestId('cancel-dialog-refusal')).toHaveCount(0); // a reopen starts clean
      await surface(page).getByText('Condiții meteo', { exact: true }).click();
      await surface(page).getByRole('button', { name: 'Da, anulează' }).click();
      await expectRefusal(page, 'cancel-dialog', 'Motivul este obligatoriu (minim 5 caractere).');
      // Unmapped code → the server's own sentence.
      answers['operator-cancel'] = refusal('LAKE_CLOSED', 'Lacul este închis în această perioadă.');
      await surface(page).getByRole('button', { name: 'Da, anulează' }).click();
      await expectRefusal(page, 'cancel-dialog', 'Lacul este închis în această perioadă.');
      // No-show → NOSHOW_COMMENT_REQUIRED (unmapped): its sentence.
      answers['no-show'] = refusal('NOSHOW_COMMENT_REQUIRED', 'Adaugă un comentariu.');
      await surface(page).getByText('Pescarul nu s-a prezentat', { exact: true }).click();
      await surface(page).getByRole('button', { name: 'Da, marchează' }).click();
      await expectRefusal(page, 'cancel-dialog', 'Adaugă un comentariu.');
      // No bluCode (a 500): the transport's generic line, as fish's axios interceptor.
      status = 500;
      answers['no-show'] = refusal(null, 'Internal Server Error', 500);
      await surface(page).getByRole('button', { name: 'Da, marchează' }).click();
      await expectRefusal(page, 'cancel-dialog', 'A apărut o eroare necunoscută. Te rugăm să reîncerci mai târziu.');
      await expect(surface(page)).toHaveCount(1);
      status = 400;
      await surface(page).getByRole('button', { name: 'Înapoi' }).click();
      await expect(surface(page)).toHaveCount(0);
    }
    expect(errors).toEqual([]);
  });

  test('b.double-submit across bookings: while A\'s write runs, B\'s confirms are busy, not dead', async ({ page }) => {
    const errors = collectConsoleErrors(page, { ignore: EXPECTED_CONSOLE });
    const a = fake('fa1');
    const b = fake('fb1');
    const c = fake('fc2', { bookingStatus: 'confirmed' });
    await mockBookings(page, [a, b, c]);
    // A's accept is held, then refused (no data to fake); B's and C's writes are counted.
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const writes: string[] = [];
    await page.route(/\/api\/cms\/feed\/bookings\/(fa1|fb1|fc2)\/(accept|reject|operator-cancel|no-show)$/, async (r) => {
      const path = new URL(r.request().url()).pathname;
      writes.push(path);
      if (path.includes('/fa1/')) await gate;
      return json(r, refusal('INVALID_STATUS', 'Status invalid.'), 400);
    });
    await page.goto(`${HARNESS}?ids=fa1,fb1,fc2`);
    await expect(row(page, 'fc2')).toBeVisible();
    await row(page, 'fa1').getByRole('button', { name: 'Acceptă' }).click();
    await surface(page).getByRole('button', { name: 'Confirmă' }).click();
    await expect(surface(page)).toHaveCount(0);
    await expect.poll(() => writes.length).toBe(1);

    // B's reject: the confirm is busy (spinner, disabled), not an enabled button that does nothing.
    await row(page, 'fb1').getByRole('button', { name: 'Refuză' }).click();
    await surface(page).getByRole('textbox').fill('Nu mai avem locuri.');
    const rejectConfirm = surface(page).getByTestId('reject-dialog-confirm');
    await expect(rejectConfirm).toBeDisabled();
    await expect(rejectConfirm).toHaveAttribute('aria-busy', 'true');
    // Only B's confirm waits: its text stays editable and «Înapoi» works (A's write is not B's).
    await expect(surface(page).getByRole('textbox')).toHaveValue('Nu mai avem locuri.');
    await expect(surface(page).getByRole('button', { name: 'Înapoi' })).toBeEnabled();
    // When A settles, B's confirm comes alive and acts.
    release();
    await expect(toast(page, 'Rezervarea nu mai poate fi modificată.')).toBeVisible(); // A's refusal (accept: toast)
    await expect(rejectConfirm).toBeEnabled();
    await rejectConfirm.click();
    await expect.poll(() => writes).toContain('/api/cms/feed/bookings/fb1/reject');
    await expectRefusal(page, 'reject-dialog', 'Rezervarea nu mai poate fi modificată.');
    await surface(page).getByRole('button', { name: 'Înapoi' }).click();
    await expect(surface(page)).toHaveCount(0);
    expect(writes).toHaveLength(2);
    expect(errors).toEqual([]);
  });

  test('b.double-submit across bookings: B\'s accept and cancel confirms are busy while A\'s write runs', async ({ page }) => {
    const errors = collectConsoleErrors(page, { ignore: EXPECTED_CONSOLE });
    await mockBookings(page, [fake('fa2'), fake('fb2'), fake('fc3', { bookingStatus: 'confirmed' })]);
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    await page.route(/\/api\/cms\/feed\/bookings\/fa2\/accept$/, async (r) => {
      await gate;
      return json(r, refusal('INVALID_STATUS', 'Status invalid.'), 400);
    });
    await page.goto(`${HARNESS}?ids=fa2,fb2,fc3`);
    await expect(row(page, 'fc3')).toBeVisible();
    await row(page, 'fa2').getByRole('button', { name: 'Acceptă' }).click();
    await surface(page).getByRole('button', { name: 'Confirmă' }).click();
    await expect(surface(page)).toHaveCount(0);
    await row(page, 'fb2').getByRole('button', { name: 'Acceptă' }).click();
    await expect(surface(page).getByTestId('accept-confirm')).toBeDisabled();
    await expect(surface(page).getByTestId('accept-confirm')).toHaveAttribute('aria-busy', 'true');
    await surface(page).getByRole('button', { name: 'Renunță' }).click();
    await expect(surface(page)).toHaveCount(0);
    await row(page, 'fc3').getByRole('button', { name: 'Anulează rezervarea' }).click();
    await expect(surface(page).getByTestId('cancel-dialog-confirm')).toBeDisabled();
    await expect(surface(page).getByTestId('cancel-dialog-confirm')).toHaveAttribute('aria-busy', 'true');
    release();
    await expect(surface(page).getByTestId('cancel-dialog-confirm')).toBeEnabled();
    await expect(surface(page).getByTestId('cancel-dialog-confirm')).not.toHaveAttribute('aria-busy');
    expect(errors).toEqual([]);
  });

  test('a11y + keyboard: each dialog at 375 and 1280 (axe), Tab/Enter to open, Escape back to the trigger', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await mockBookings(page, [fake('fk1'), fake('fk2', { bookingStatus: 'confirmed' })]);
    for (const width of [375, 1280]) {
      await page.setViewportSize({ width, height: width < 768 ? 812 : 900 });
      await page.goto(`${HARNESS}?ids=fk1,fk2`);
      await expect(row(page, 'fk2')).toBeVisible();
      await axe(page);
      // Keyboard: focus Refuză, Enter opens, focus is inside, Escape closes and returns focus.
      const refuza = row(page, 'fk1').getByRole('button', { name: 'Refuză' });
      await refuza.focus();
      await page.keyboard.press('Enter');
      await expect(surface(page)).toBeVisible();
      await expect.poll(() => page.evaluate(() => !!document.activeElement?.closest('dialog[open]'))).toBe(true);
      await axe(page);
      await page.keyboard.press('Escape');
      await expect(surface(page)).toHaveCount(0);
      await expect(refuza).toBeFocused();
      // Accept and cancel dialogs.
      await row(page, 'fk1').getByRole('button', { name: 'Acceptă' }).click();
      await axe(page);
      await page.keyboard.press('Escape');
      await row(page, 'fk2').getByRole('button', { name: 'Anulează rezervarea' }).click();
      await surface(page).getByRole('button', { name: 'Da, anulează' }).click();
      await expect(surface(page).getByText('Alege un motiv din listă.')).toBeVisible();
      // The sheet fits its content: the pick error, the first reason and the message are on screen.
      await expect(surface(page).getByText('Alege un motiv din listă.')).toBeInViewport();
      await expect(surface(page).getByRole('radio').first().locator('xpath=..')).toBeInViewport();
      await expect(surface(page).getByRole('textbox', { name: 'Mesajul pentru pescar' })).toBeInViewport();
      await axe(page);
      // Tab reaches the list, Space picks.
      await surface(page).getByRole('radio').first().focus();
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('ArrowDown');
      await expect(surface(page).getByRole('radio', { name: 'Condiții meteo' })).toBeChecked();
      await axe(page);
      await page.keyboard.press('Escape');
      await expect(surface(page)).toHaveCount(0);
    }
    expect(errors).toEqual([]);
  });

  test('screenshots: every state at 375 / 1280 / 1440 / 1920', async ({ page }) => {
    mkdirSync(SHOTS, { recursive: true });
    await mockBookings(page, [fake('fs1'), fake('fs2', { bookingStatus: 'confirmed', contactFullname: 'Mihai Stan', angler: undefined, stand: { documentId: 's7', name: '7' }, basis: undefined })]);
    // The writes hang while the submitting state is captured, then are dropped (a hung request holds
    // one of the browser's six connections to the host).
    const hung: Route[] = [];
    await page.route(/\/api\/cms\/feed\/bookings\/fs\d\/(reject|operator-cancel)$/, (r) => {
      hung.push(r);
    });
    const drop = async () => {
      for (const r of hung.splice(0)) await r.abort().catch(() => undefined);
    };
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: width < 768 ? 812 : 900 });
      await page.goto(`${HARNESS}?ids=fs1,fs2`);
      await expect(row(page, 'fs2')).toBeVisible();
      const shot = async (name: string) => {
        await settled(page);
        await page.screenshot({ path: `${SHOTS}/${name}-${width}.png` });
      };
      const settle = () => settled(page);

      await row(page, 'fs1').getByRole('button', { name: 'Acceptă' }).click();
      await settle();
      await shot('accept');
      await page.keyboard.press('Escape');

      await row(page, 'fs1').getByRole('button', { name: 'Refuză' }).click();
      await settle();
      await shot('reject-empty');
      await surface(page).getByRole('button', { name: 'Da, respinge' }).click();
      await shot('reject-too-short');
      await surface(page).getByRole('textbox').fill('Standul e ocupat de un concurs local.');
      await shot('reject-valid');
      await surface(page).getByRole('button', { name: 'Da, respinge' }).click();
      await settle();
      await shot('reject-submitting');
      await drop();
      await page.reload();
      await expect(row(page, 'fs2')).toBeVisible();

      await row(page, 'fs2').getByRole('button', { name: 'Anulează rezervarea' }).click();
      await settle();
      await shot('cancel-not-picked');
      await surface(page).getByRole('button', { name: 'Da, anulează' }).click();
      await shot('cancel-pick-required');
      await surface(page).getByText('Pescarul nu s-a prezentat', { exact: true }).click();
      await shot('cancel-no-show');
      await surface(page).getByText('Condiții meteo', { exact: true }).click();
      await surface(page).getByRole('textbox').fill('Condiții meteo nefavorabile. Vânt puternic anunțat sâmbătă.');
      await shot('cancel-edited');
      await surface(page).getByRole('button', { name: 'Da, anulează' }).click();
      await settle();
      await shot('cancel-submitting');
      await drop();
    }
  });
});
