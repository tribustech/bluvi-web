import { mkdirSync } from 'node:fs';
import { expect, test, type Page, type Request, type Route } from '@playwright/test';
import { getLakeAvailability, lookupAnglerByPhone, operatorCancelBooking, type LakeAvailability } from '@/core/booking';
import { createTestTransport } from '../transport';
import { expectNoA11yViolations } from './helpers/a11y';
import { BASE_URL } from './helpers/base-url';
import { collectConsoleErrors } from './helpers/console';
import { qaJwt, signIn } from './helpers/session';

/*
 * operator.calendar-confirmare (/operator/[lakeId]/calendar/confirmare, T4) — step 3 of the walk-in,
 * fish app/(app)/operator/[lakeId]/walk-in/review.tsx + AnglerAccountPicker / AnglerMatchSheet /
 * AnglerReputationLine / QuoteUnavailable / useCreateWalkInBooking.
 *
 * REAL reads and writes on the LOCAL Chita Lake, which the QA user owns (owner 2026-10-08: local
 * writes are safe): three real walk-ins (guest, account picked by username, guest linked by the QA
 * user's own phone) on far-future free 06–18 slots (days 50+), each operator-cancelled in afterEach.
 * Route mocks only where the local DB cannot answer on demand: the quote states (held / refused /
 * failed), a held search, a rated reputation, the refusal codes, a held create (back blocked).
 */

process.env.TZ = 'Europe/Bucharest';
test.use({ timezoneId: 'Europe/Bucharest', locale: 'ro-RO' });

const LAKE = 's84u55lo4n9z0emngozttt6e'; // local Chita Lake
const CAL = `/operator/${LAKE}/calendar`;
const PATH = `${CAL}/confirmare`;
const QUOTE = /\/api\/cms\/feed\/lakes\/[^/]+\/quote/;
const AVAIL = /\/api\/cms\/feed\/lakes\/[^/]+\/availability/;
const WALK_IN = /\/api\/cms\/feed\/bookings\/walk-in$/;
const LOOKUP = /\/api\/cms\/feed\/bookings\/lookup-angler/;
const SEARCH = /\/api\/cms\/feed\/anglers\/search/;
const REPUTATION = /\/api\/cms\/feed\/users\/[^/]+\/reputation/;
const LAKE_STATS = new RegExp(`/api/cms/feed/lakes/${LAKE}/operator-stats`);
const SHOTS = '.shots/operator-calendar-confirmare';
const WIDTHS = [375, 1280, 1440, 1920] as const;
const QA_PHONE = '+40712345678';
const QA_NAME = 'Sim QA';
const EXPECTED_CONSOLE = [/Failed to load resource: the server responded with a status of (400|403|409|500)/];

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
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

type Slot = { stand: string; name: string; day: number; start: string; end: string };
const query = (s: Slot) => new URLSearchParams([['stand', s.stand], ['start', s.start], ['end', s.end]]).toString();
const url = (s: Slot) => `${PATH}?${query(s)}`;

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const refusal = (bluCode: string | null, message: string, status = 400): [number, unknown] => [
  status,
  { data: null, error: { status, name: 'Error', message, details: bluCode ? { bluCode } : {} } },
];
const fakeBooking = (s: Slot, code = 'E2EWALK') => ({
  data: {
    documentId: 'e2ewalkin1',
    code,
    startDate: s.start,
    endDate: s.end,
    bookingStatus: 'confirmed',
    priceTotal: 50,
    depositAmount: 0,
    paymentStatus: 'unpaid',
    contactPhone: '0700000009',
  },
});

let jwt: string;
let qaId: string;
const slots: Slot[] = [];
/** Real walk-ins made by the current test, cancelled after it. */
let created: string[] = [];

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
  const me = await request.get(`${process.env.E2E_CMS_URL ?? 'http://localhost:1337/api'}/users/me`, { headers: { Authorization: `Bearer ${jwt}` } });
  const profile = (await me.json()) as { documentId: string; phone: string; username: string };
  qaId = profile.documentId;
  expect(profile.username).toBe(QA_NAME);
  expect(profile.phone, 'the QA user keeps its phone (the match test types it)').toBe(QA_PHONE);
  // Contract: the owner lookup really hits the QA account for its own phone (c11's premise).
  const hit = await lookupAnglerByPhone(t, LAKE, QA_PHONE);
  expect(hit).toMatchObject({ matched: true, user: { documentId: qaId, username: QA_NAME } });
  const avail = await getLakeAvailability(t, LAKE, { from: ymd(dayAt(48)), to: ymd(dayAt(100)) });
  expect(avail.slotStartTimes).toEqual(['06:00', '18:00']);
  const plain = avail.stands.filter((s) => s.extras.length === 0);
  // Free 06–18 day slots, one per day, rotating stands, far from every other spec's days.
  for (let day = 50, i = 0; day <= 100 && slots.length < 6; day++, i++) {
    const s = dayAt(day, 6).getTime() - 3_600_000;
    const e = dayAt(day, 18).getTime() + 3_600_000;
    const st = [...plain.slice(i % plain.length), ...plain.slice(0, i % plain.length)].find((x) => !busy(avail, x.documentId, s, e));
    if (st) slots.push({ stand: st.documentId, name: st.name, day, start: iso(dayAt(day, 6)), end: iso(dayAt(day, 18)) });
  }
  expect(slots.length).toBe(6);
  mkdirSync(SHOTS, { recursive: true });
});

test.afterEach(async () => {
  const t = createTestTransport(jwt);
  for (const id of created) await operatorCancelBooking(t, id, 'Test e2e — curățenie automată.').catch(() => undefined);
  created = [];
});

/* ------------------------------------------------------------------------------------------------
 * Page helpers
 * ---------------------------------------------------------------------------------------------- */

async function open(page: Page, s: Slot) {
  await signIn(page.context(), jwt);
  await page.goto(url(s));
  await expect(page.getByRole('heading', { level: 1, name: 'Confirmă rezervarea' })).toBeVisible({ timeout: 45_000 });
}
/** Open and wait for the real price (the CTA only exists then). */
async function openPriced(page: Page, s: Slot) {
  await open(page, s);
  await expect(submit(page)).toBeVisible({ timeout: 30_000 });
}
const submit = (page: Page) => page.getByTestId('walkin-submit');
const toast = (page: Page, text: string) => page.getByText(text, { exact: true }).first();
const guest = async (page: Page) => {
  await page.getByTestId('walkin-mode-guest').click();
  await expect(page.getByTestId('walkin-contact-name')).toBeVisible();
};
/** Records the walk-in POST bodies and the ids of the real ones (cancelled in afterEach). */
function walkIns(page: Page) {
  const bodies: Record<string, unknown>[] = [];
  page.on('request', (r: Request) => {
    if (r.method() === 'POST' && WALK_IN.test(r.url())) bodies.push((r.postDataJSON() as { data: Record<string, unknown> }).data);
  });
  page.on('response', async (r) => {
    if (r.request().method() !== 'POST' || !WALK_IN.test(r.url()) || !r.ok()) return;
    const id = ((await r.json().catch(() => null)) as { data?: { documentId?: string } } | null)?.data?.documentId;
    if (id && id !== 'e2ewalkin1') created.push(id);
  });
  return bodies;
}
function count(page: Page, re: RegExp, method = 'GET') {
  const hits: number[] = [];
  page.on('request', (r) => {
    if (r.method() === method && re.test(r.url())) hits.push(Date.now());
  });
  return hits;
}
async function shot(page: Page, name: string) {
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SHOTS}/${name}-${page.viewportSize()?.width}.png`, fullPage: true });
}
/** A client-side navigation (the same QueryClient), as a click on an in-app link. */
async function push(page: Page, href: string) {
  await page.evaluate((h) => (window as unknown as { next: { router: { push: (h: string) => void } } }).next.router.push(h), href);
}

/* ------------------------------------------------------------------------------------------------
 * c1 — the guard
 * ---------------------------------------------------------------------------------------------- */

test.describe('operator.calendar-confirmare', () => {
  test('c1: no selection → the calendar; signed out → /intra with the step; unknown stand → the calendar', async ({ page, request }) => {
    const out = await request.get(`${BASE_URL}${url(slots[0])}`, { maxRedirects: 0 });
    expect(out.status()).toBe(307);
    const next = new URL(out.headers().location, BASE_URL);
    expect(next.pathname).toBe('/intra');
    expect(next.searchParams.get('next')).toContain(`${PATH}?stand=${slots[0].stand}`);

    // No (or half a) selection: sent to the calendar before the step renders (a streamed redirect).
    await signIn(page.context(), jwt);
    await page.goto(PATH);
    await expect(page).toHaveURL(`${BASE_URL}${CAL}`, { timeout: 45_000 });
    await page.goto(`${PATH}?stand=${slots[0].stand}`);
    await expect(page).toHaveURL(`${BASE_URL}${CAL}`, { timeout: 45_000 });
    await page.goto(url({ ...slots[0], stand: 'nuexistastandul' }));
    await expect(page).toHaveURL(`${BASE_URL}${CAL}`, { timeout: 45_000 });
  });

  /* ----------------------------------------------------------------------------------------------
   * c2, c3 — title, back, the quote states
   * -------------------------------------------------------------------------------------------- */

  test('c3: quoting, refused (the lake\'s sentence), failed (retry) — never a submit; «Înapoi la selecție» → the calendar', async ({ page }) => {
    collectConsoleErrors(page, { ignore: EXPECTED_CONSOLE });
    let mode: 'hold' | 'refuse' | 'fail' | 'real' = 'hold';
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const bodies: { walkIn?: boolean }[] = [];
    await page.route(QUOTE, async (route) => {
      bodies.push((route.request().postDataJSON() as { data: { walkIn?: boolean } }).data);
      if (mode === 'hold') await gate;
      if (mode === 'refuse' || mode === 'hold') return json(route, { data: { total: null, basis: null, refusal: { code: 'X', message: 'Balta e închisă în ziua aleasă.' } } });
      if (mode === 'fail') return json(route, { error: { status: 500, message: 'boom' } }, 500);
      return route.fallback();
    });
    await open(page, slots[0]);
    await expect(page.getByTestId('quote-pending')).toHaveText('Se calculează prețul…');
    await expect(submit(page)).toHaveCount(0);
    expect(bodies[0]?.walkIn).toBe(true);
    await shot(page, 'quote-pending');
    mode = 'refuse';
    release();
    await expect(page.getByText('Balta e închisă în ziua aleasă.')).toBeVisible();
    await expect(page.getByText('Alege alt interval sau alt stand.')).toBeVisible();
    await expect(page.getByTestId('quote-unavailable-retry')).toHaveCount(0);
    await expect(submit(page)).toHaveCount(0);

    mode = 'fail';
    await page.reload();
    await expect(page.getByText('Nu am putut calcula prețul pentru acest interval.')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Verifică legătura la internet și încearcă din nou.')).toBeVisible();
    await expect(submit(page)).toHaveCount(0);
    await shot(page, 'quote-failed');
    await expectNoA11yViolations(page);
    mode = 'real';
    await page.getByTestId('quote-unavailable-retry').click();
    await expect(submit(page)).toBeVisible({ timeout: 30_000 });

    mode = 'fail';
    await page.reload();
    await page.getByTestId('quote-unavailable-back').click();
    await expect(page).toHaveURL(`${BASE_URL}${CAL}`);
  });

  test('c2 c4 c5 c15 c16: title, the summary without the request notice, «Cont Bluvi» by default, the auto-confirm note, the CTA; Back → the calendar with the selection', async ({ page }) => {
    const s = slots[0];
    await openPriced(page, s);
    await expect(page.locator('header').getByText('Chita Lake')).toBeVisible();
    const summary = page.getByTestId('review-summary');
    await expect(summary.getByTestId('stand-badge')).toHaveText(s.name);
    await expect(summary.getByTestId('review-money')).toContainText('lei');
    // Chita is a request lake for anglers (manual / offline): the walk-in never says so.
    await expect(page.getByText('Este o cerere, nu o rezervare confirmată')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Date pescar' })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Cont Bluvi' })).toBeChecked();
    await expect(page.getByRole('radio', { name: 'Fără cont' })).not.toBeChecked();
    await expect(page.getByTestId('walkin-auto-confirm')).toHaveText('Rezervarea va fi confirmată automat și plătită cash la fața locului.');
    await expect(submit(page)).toHaveText('Adaugă rezervarea');
    await page.getByRole('button', { name: 'Înapoi' }).first().click();
    await expect(page).toHaveURL(new RegExp(`${CAL}\\?stand=${s.stand}&start=`));
  });

  test('c16: phone — the CTA rides at the bottom edge above the form; desktop ≥1024 — the summary column on the right, sticky', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 760 });
    await openPriced(page, slots[0]);
    const bar = await submit(page).boundingBox();
    expect(bar!.y + bar!.height).toBeGreaterThan(760 - 90);
    expect(bar!.y + bar!.height).toBeLessThanOrEqual(760);
    await page.setViewportSize({ width: 1024, height: 800 });
    await page.waitForTimeout(300);
    const form = await page.getByRole('region', { name: 'Date pescar' }).boundingBox();
    const sum = await page.getByTestId('review-summary').boundingBox();
    expect(sum!.x).toBeGreaterThan(form!.x + form!.width);
    expect(Math.abs(sum!.y - form!.y)).toBeLessThan(4);
    const cta = await submit(page).boundingBox();
    expect(cta!.x).toBeGreaterThan(form!.x + form!.width);
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(300);
    const after = await page.getByTestId('review-summary').boundingBox();
    expect(after!.y).toBeGreaterThan(60);
  });

  /* ----------------------------------------------------------------------------------------------
   * c6 c7 c8 — the account picker (a REAL walk-in on the QA account)
   * -------------------------------------------------------------------------------------------- */

  test('c6: hint, searching, nothing found, results (avatar, username, subline), max 8', async ({ page }) => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const searches: string[] = [];
    await page.route(SEARCH, async (route) => {
      const q = new URL(route.request().url()).searchParams.get('q') ?? '';
      searches.push(q);
      if (q === 'zz') {
        await gate;
        return json(route, { data: [], meta: { pagination: { page: 1, pageSize: 20, pageCount: 0, total: 0 } } });
      }
      if (q === 'pe') {
        const data = Array.from({ length: 12 }, (_, i) => ({ documentId: `p${i}`, username: `pescar${i}`, avatarUrl: null, isFollowedByMe: false, subline: `${i} urmăritori` }));
        return json(route, { data, meta: { pagination: { page: 1, pageSize: 20, pageCount: 1, total: 12 } } });
      }
      return route.fallback();
    });
    await openPriced(page, slots[0]);
    const field = page.getByTestId('walkin-account-search');
    await expect(field).toHaveAttribute('placeholder', 'Nume de utilizator');
    await expect(page.getByTestId('walkin-account-hint')).toHaveText('Scrie cel puțin 2 litere din numele de utilizator.');
    await field.fill('z');
    await page.waitForTimeout(500);
    await expect(page.getByTestId('walkin-account-hint')).toBeVisible();
    expect(searches).toEqual([]);
    await field.fill('zz');
    await expect(page.getByTestId('walkin-account-searching')).toBeVisible();
    release();
    await expect(page.getByTestId('walkin-account-empty')).toHaveText('Niciun cont găsit. Treci pe „Fără cont” dacă pescarul nu are aplicația.');
    await field.fill('pe');
    const results = page.getByTestId('walkin-account-results').getByRole('button');
    await expect(results).toHaveCount(8);
    await expect(results.first()).toContainText('pescar0');
    await expect(results.first()).toContainText('0 urmăritori');
    // Debounced: the typing in between never asked for «p» alone, nor once per keystroke.
    expect(searches.filter((q) => q.length < 2)).toEqual([]);
    await shot(page, 'account-results');
    await expectNoA11yViolations(page);
  });

  test('c7: a rated angler shows «★ 4,5 · 3 evaluări» and the no-shows; «Schimbă» clears the pick and the search', async ({ page }) => {
    await page.route(REPUTATION, (route) =>
      json(route, { data: { avgStars: 4.5, ratingCount: 3, noShowCount: 2, areas: { rules: null, cleanliness: null, behavior: null }, reviews: [] } }),
    );
    await openPriced(page, slots[0]);
    await page.getByTestId('walkin-account-search').fill('Sim Q');
    await page.getByTestId(`walkin-account-${QA_NAME}`).click();
    const card = page.getByTestId('walkin-selected-account');
    await expect(card).toContainText(QA_NAME);
    await expect(card.getByTestId('reputation-line')).toContainText('4,5');
    await expect(card.getByTestId('reputation-line')).toContainText('· 3 evaluări');
    await expect(card.getByTestId('reputation-no-shows')).toHaveText('2 neprezentări');
    await shot(page, 'account-selected');
    await card.getByTestId('walkin-clear-account').click();
    await expect(card).toHaveCount(0);
    await expect(page.getByTestId('walkin-account-search')).toHaveValue('');
    await expect(page.getByTestId('walkin-account-hint')).toBeVisible();
  });

  test('c8 c17 c19 (REAL): without an account it toasts and sends nothing; the QA account by username → {angler, notes} only, the toast with the code, out of the flow', async ({ page }) => {
    const bodies = walkIns(page);
    const s = slots[1];
    const reads = count(page, AVAIL);
    await openPriced(page, s);
    await submit(page).click();
    await expect(toast(page, 'Alege un cont sau treci pe „Fără cont”.')).toBeVisible();
    expect(bodies).toHaveLength(0);
    await page.getByTestId('walkin-account-search').fill('Sim Q');
    await page.getByTestId(`walkin-account-${QA_NAME}`).click();
    await expect(page.getByTestId('walkin-selected-account').getByText('Fără evaluări încă')).toBeVisible();
    await page.getByTestId('walkin-notes').fill('  Test e2e cont  ');
    const before = reads.length;
    await submit(page).click();
    await expect(page.getByText(/^Rezervare adăugată! Cod: [A-Z0-9-]+\.$/).first()).toBeVisible({ timeout: 20_000 });
    expect(bodies).toEqual([{ lake: LAKE, stand: s.stand, startDate: s.start, endDate: s.end, extras: [], angler: qaId, notes: 'Test e2e cont' }]);
    expect(created).toHaveLength(1);
    // Out of the whole flow: no history in this tab → the lake's panel.
    await expect(page).toHaveURL(`${BASE_URL}/operator/${LAKE}`);
    // c19: the availability (under ['bookings']) was read again after the create.
    expect(reads.length).toBeGreaterThan(before);
  });

  /* ----------------------------------------------------------------------------------------------
   * c9 c10 c14 — guest fields, the lookup on blur only
   * -------------------------------------------------------------------------------------------- */

  test('c9 c10 c14: guest fields — required, digits and one leading +, 7–15 digits; the lookup only on leaving the field; notes ≤ 1000 in both modes', async ({ page }) => {
    const lookups: string[] = [];
    page.on('request', (r) => {
      if (LOOKUP.test(r.url())) lookups.push(new URL(r.url()).searchParams.get('phone') ?? '');
    });
    const bodies = walkIns(page);
    await openPriced(page, slots[0]);
    // Notes in account mode (with a pick, so the cap is what refuses).
    await page.getByTestId('walkin-account-search').fill('Sim Q');
    await page.getByTestId(`walkin-account-${QA_NAME}`).click();
    await page.getByTestId('walkin-notes').fill('x'.repeat(1001));
    await submit(page).click();
    await expect(page.getByText('Ai voie maxim 1000 de caractere').first()).toBeVisible();
    expect(bodies).toHaveLength(0);
    await page.getByTestId('walkin-notes').fill('');

    await guest(page);
    const name = page.getByTestId('walkin-contact-name');
    const phone = page.getByTestId('walkin-contact-phone');
    await expect(name).toHaveAttribute('placeholder', 'Numele pescarului');
    await expect(phone).toHaveAttribute('placeholder', '07XX XXX XXX');
    await expect(phone).toHaveAttribute('inputmode', 'tel');
    await expect(page.getByTestId('walkin-notes')).toHaveAttribute('placeholder', 'Detalii adiționale, ora estimată de sosire, etc.');
    await submit(page).click();
    await expect(page.getByText('Acest câmp este obligatoriu').first()).toBeVisible();
    await expect(page.getByText('Adaugă un număr de telefon.').first()).toBeVisible();
    await expect(name).toBeFocused();
    expect(bodies).toHaveLength(0);
    await phone.pressSequentially('+40 (7) 12-ab+3');
    await expect(phone).toHaveValue('+407123');
    await expect(page.getByText('Numărul de telefon trebuie să aibă între 7 și 15 cifre').first()).toBeVisible();
    await phone.fill('');
    await phone.pressSequentially('0700000009');
    await page.waitForTimeout(400);
    expect(lookups, 'never per keystroke').toEqual([]);
    await name.click();
    await expect.poll(() => lookups).toEqual(['0700000009']);
    // Left again with the same number: cached (5 min), not asked again.
    await phone.click();
    await name.click();
    await page.waitForTimeout(400);
    expect(lookups).toEqual(['0700000009']);
    await page.getByTestId('walkin-notes').fill('x'.repeat(1001));
    await submit(page).click();
    await expect(page.getByText('Ai voie maxim 1000 de caractere').first()).toBeVisible();
    expect(bodies).toHaveLength(0);
    await shot(page, 'guest-errors');
  });

  /* ----------------------------------------------------------------------------------------------
   * c11 c12 c13 — the phone match (REAL: the QA user's own number)
   * -------------------------------------------------------------------------------------------- */

  test('c11 c12 c13 (REAL): the QA phone matches → «Cont Bluvi găsit»; link / skip / Escape; the banner and «Schimbă»; a new number drops the link; linked guest body', async ({ page }) => {
    const bodies = walkIns(page);
    const s = slots[2];
    await openPriced(page, s);
    await guest(page);
    await page.getByTestId('walkin-contact-name').fill('Pescar la poartă');
    const phone = page.getByTestId('walkin-contact-phone');
    // c13: a submit straight from the field (no blur first) opens the dialog instead of booking.
    await phone.fill(QA_PHONE);
    await submit(page).click();
    const dialog = page.getByRole('alertdialog').or(page.getByRole('dialog')).filter({ hasText: 'Cont Bluvi găsit' });
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    expect(bodies).toHaveLength(0);
    await expect(dialog).toContainText('Numărul introdus aparține unui cont existent. Legăm rezervarea de acest cont?');
    await expect(dialog.getByTestId('angler-match-phone')).toHaveText(QA_PHONE);
    await expect(dialog).toContainText(QA_NAME);
    await expect(dialog.getByText('Fără evaluări încă')).toBeVisible();
    // Let the dialog's entry transition finish: axe mid-fade reads the washed-out colours.
    await page.evaluate(() =>
      Promise.all(document.getAnimations().filter((a) => a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished))
    );
    await shot(page, 'match-dialog');
    await expectNoA11yViolations(page);
    // Escape = not linking.
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    const banner = page.getByTestId('walkin-match-banner');
    await expect(banner).toContainText('Rezervare separată, fără cont');
    // Not asked again for the same number.
    await phone.click();
    await page.getByTestId('walkin-contact-name').click();
    await page.waitForTimeout(500);
    await expect(dialog).toHaveCount(0);
    // «Schimbă» asks again → link.
    await banner.getByTestId('walkin-match-change').click();
    await dialog.getByTestId('angler-match-link').click();
    await expect(banner).toContainText('Rezervarea se leagă de acest cont');
    await expect(banner).toContainText(QA_NAME);
    await shot(page, 'match-linked');
    // A new number drops the link; the old number again is undecided again.
    await phone.fill('0700000009');
    await expect(banner).toHaveCount(0);
    await phone.fill(QA_PHONE);
    await page.getByTestId('walkin-contact-name').click();
    await expect(dialog).toBeVisible();
    await dialog.getByTestId('angler-match-skip').click();
    await expect(banner).toContainText('Rezervare separată, fără cont');
    await banner.getByTestId('walkin-match-change').click();
    await dialog.getByTestId('angler-match-link').click();
    await submit(page).click();
    await expect(page.getByText(/^Rezervare adăugată! Cod: /).first()).toBeVisible({ timeout: 20_000 });
    expect(bodies).toEqual([
      { lake: LAKE, stand: s.stand, startDate: s.start, endDate: s.end, extras: [], contactFullname: 'Pescar la poartă', contactPhone: QA_PHONE, notes: '', angler: qaId },
    ]);
    expect(created).toHaveLength(1);
  });

  /* ----------------------------------------------------------------------------------------------
   * c17 c19 — a guest walk-in (REAL) from Acasă via the panel: out of the flow, stats re-read
   * -------------------------------------------------------------------------------------------- */

  test('c17 c19 (REAL): guest walk-in from the panel → body, toast, back on the panel (the whole flow left); the lake\'s stats are read again', async ({ page }) => {
    const bodies = walkIns(page);
    const s = slots[3];
    const lakeStats = count(page, LAKE_STATS);
    const reads = count(page, AVAIL);
    await signIn(page.context(), jwt);
    await page.goto(`/operator/${LAKE}`);
    await expect.poll(() => lakeStats.length, { timeout: 45_000 }).toBeGreaterThan(0);
    await page.waitForTimeout(500);
    // In-app navigation (same QueryClient): the panel's stats stay cached (fresh for 60 s) under the flow.
    await push(page, url(s));
    await expect(submit(page)).toBeVisible({ timeout: 45_000 });
    await guest(page);
    await page.getByTestId('walkin-contact-name').fill('  Walk-in E2E  ');
    await page.getByTestId('walkin-contact-phone').fill('0700000009');
    await page.getByTestId('walkin-notes').fill('Sosește la 6');
    const lake0 = lakeStats.length;
    const avail0 = reads.length;
    await submit(page).click();
    await expect(page.getByText(/^Rezervare adăugată! Cod: [A-Z0-9-]+\.$/).first()).toBeVisible({ timeout: 20_000 });
    expect(bodies).toEqual([
      { lake: LAKE, stand: s.stand, startDate: s.start, endDate: s.end, extras: [], contactFullname: 'Walk-in E2E', contactPhone: '0700000009', notes: 'Sosește la 6' },
    ]);
    expect(created).toHaveLength(1);
    // The whole flow is left: back on the panel it was entered from, not one step back.
    await expect(page).toHaveURL(`${BASE_URL}/operator/${LAKE}`);
    // c19: within the stats' 60 s freshness, only the invalidation makes the panel read them again;
    // the availability (['bookings']) was read again too.
    await expect.poll(() => lakeStats.length, { timeout: 20_000 }).toBeGreaterThan(lake0);
    expect(reads.length).toBeGreaterThan(avail0);
  });

  /* ----------------------------------------------------------------------------------------------
   * c2 (frozen back), c16 (busy), c18 (codes)
   * -------------------------------------------------------------------------------------------- */

  test('c2 c16: while the submit runs the CTA is busy and Back (header, browser) is frozen; success leaves', async ({ page }) => {
    const s = slots[4];
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    await page.route(LOOKUP, (route) => json(route, { data: { matched: false, user: null } }));
    await page.route(WALK_IN, async (route) => {
      await gate;
      return json(route, fakeBooking(s));
    });
    await signIn(page.context(), jwt);
    await page.goto(CAL);
    await page.waitForLoadState('domcontentloaded');
    await push(page, url(s));
    await expect(submit(page)).toBeVisible({ timeout: 45_000 });
    await guest(page);
    await page.getByTestId('walkin-contact-name').fill('Frozen E2E');
    await page.getByTestId('walkin-contact-phone').fill('0700000009');
    await submit(page).click();
    await expect(submit(page)).toHaveAttribute('aria-busy', 'true');
    await expect(submit(page)).toHaveAttribute('aria-disabled', 'true');
    const headerBack = page.locator('header').getByRole('button', { name: 'Înapoi' });
    await expect(headerBack).toHaveAttribute('aria-disabled', 'true');
    await headerBack.click({ force: true });
    await page.evaluate(() => history.back());
    await page.waitForTimeout(400);
    expect(page.url()).toContain('/calendar/confirmare?');
    await shot(page, 'submitting');
    release();
    await expect(toast(page, 'Rezervare adăugată! Cod: E2EWALK.')).toBeVisible();
    await expect(page).not.toHaveURL(/confirmare/);
  });

  test('c2 c13: while the submit awaits the phone lookup everything is frozen (fields, switch, both Backs, the browser\'s); what is sent is what was shown', async ({ page }) => {
    const s = slots[4];
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    let lookups = 0;
    await page.route(LOOKUP, async (route) => {
      lookups++;
      await gate;
      return json(route, { data: { matched: false, user: null } });
    });
    await page.route(WALK_IN, (route) => json(route, fakeBooking(s, 'E2ELOOK')));
    const bodies = walkIns(page);
    await signIn(page.context(), jwt);
    await page.goto(CAL);
    await page.waitForLoadState('domcontentloaded');
    await push(page, url(s));
    await expect(submit(page)).toBeVisible({ timeout: 45_000 });
    await guest(page);
    const name = page.getByTestId('walkin-contact-name');
    const phone = page.getByTestId('walkin-contact-phone');
    await name.fill('Lookup E2E');
    await phone.fill('0700000019');
    // Straight from the phone to the CTA: the submit itself arms the lookup and waits on it.
    await submit(page).click();
    await expect.poll(() => lookups).toBeGreaterThan(0);
    await expect(submit(page)).toHaveAttribute('aria-busy', 'true');
    await expect(submit(page)).toHaveAttribute('aria-disabled', 'true');
    await expect(page.locator('header').getByRole('button', { name: 'Înapoi' })).toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByRole('button', { name: 'Înapoi', exact: true }).last()).toBeDisabled();
    await expect(page.getByRole('radio', { name: 'Cont Bluvi' })).toBeDisabled();
    await expect(name).not.toBeEditable();
    await expect(phone).not.toBeEditable();
    await expect(page.getByTestId('walkin-notes')).not.toBeEditable();
    await page.getByRole('button', { name: 'Înapoi', exact: true }).last().click({ force: true });
    await page.evaluate(() => history.back());
    await page.waitForTimeout(400);
    expect(page.url()).toContain('/calendar/confirmare?');
    await expect(name).toHaveValue('Lookup E2E');
    expect(bodies).toHaveLength(0);
    await shot(page, 'checking');
    release();
    await expect(toast(page, 'Rezervare adăugată! Cod: E2ELOOK.')).toBeVisible();
    expect(bodies).toHaveLength(1);
    expect(bodies[0]).toMatchObject({ contactFullname: 'Lookup E2E', contactPhone: '0700000019' });
    await expect(page).not.toHaveURL(/confirmare/);
  });

  test('c4 c15 (web over fish): a deposit lake still reads as a cash walk-in — «Numerar», «Total · se plătește la fața locului»; a lake the public read does not know keeps its owned name, no redirect', async ({ page, request }) => {
    const fault = (faults: string[]) => request.post(`${BASE_URL}/balti/${LAKE}/e2e-fault`, { data: { faults } });
    try {
      await fault(['deposit']);
      await openPriced(page, slots[0]);
      const summary = page.getByTestId('review-summary');
      await expect(summary.locator('[data-chip="payment"]')).toHaveText('Numerar');
      await expect(summary.getByTestId('review-money')).toContainText('se plătește la fața locului');
      await expect(page.getByText('Avans de plată')).toHaveCount(0);
      await expect(page.getByText('De plată acum')).toHaveCount(0);
      await expect(page.getByTestId('walkin-auto-confirm')).toHaveText('Rezervarea va fi confirmată automat și plătită cash la fața locului.');
      await fault(['lake-404']);
      await page.reload();
      await expect(page.getByRole('heading', { level: 1, name: 'Confirmă rezervarea' })).toBeVisible({ timeout: 45_000 });
      await expect(submit(page)).toBeVisible({ timeout: 30_000 });
      await fault([]);
      expect(page.url()).toContain('/calendar/confirmare?');
      await expect(page.locator('header').getByText('Chita Lake')).toBeVisible();
      await expect(page.getByTestId('review-summary').getByRole('heading', { name: 'Chita Lake' })).toBeVisible();
    } finally {
      await fault([]);
    }
  });

  test('c18: every refusal code toasts fish\'s copy and the review stays', async ({ page }) => {
    collectConsoleErrors(page, { ignore: EXPECTED_CONSOLE });
    const answers: [number, unknown][] = [
      refusal('STAND_TAKEN', 'x', 409),
      refusal('NAME_REQUIRED', 'x'),
      refusal('PHONE_REQUIRED', 'x'),
      refusal('PHONE_MISMATCH', 'x'),
      refusal('ANGLER_NOT_FOUND', 'x'),
      refusal('WINDOW_ENDED', 'x'),
      refusal('INVALID_DURATION', 'x'),
      refusal('INVALID_SLOT_ALIGNMENT', 'x'),
      refusal('BOOKING_DISABLED', 'x'),
      refusal(null, 'Forbidden', 403),
      refusal('SOME_NEW_RULE', 'Regula nouă a bălții.'),
      refusal(null, 'boom', 500),
    ];
    const copy = [
      'Standul tocmai a fost rezervat. Alege altul.',
      'Adaugă numele pescarului.',
      'Adaugă un număr de telefon.',
      'Numărul nu corespunde contului selectat. Reîncearcă.',
      'Contul selectat nu mai există. Alege altul.',
      'Intervalul ales s-a încheiat deja.',
      'Durata selectată nu este validă.',
      'Intervalul ales nu începe la o oră de start validă.',
      'Rezervările nu sunt active pentru acest lac.',
      'Nu ai dreptul să adaugi rezervări pentru acest lac.',
      'Regula nouă a bălții.',
      'A apărut o eroare. Încearcă din nou.',
    ];
    let n = 0;
    await page.route(LOOKUP, (route) => json(route, { data: { matched: false, user: null } }));
    await page.route(WALK_IN, (route) => {
      const [status, body] = answers[n++];
      return json(route, body, status);
    });
    await openPriced(page, slots[5]);
    await guest(page);
    await page.getByTestId('walkin-contact-name').fill('Erori E2E');
    await page.getByTestId('walkin-contact-phone').fill('0700000009');
    for (let i = 0; i < answers.length; i++) {
      await expect(submit(page)).not.toHaveAttribute('aria-busy', 'true');
      await submit(page).click();
      await expect(toast(page, copy[i])).toBeVisible();
      await expect(page).toHaveURL(/calendar\/confirmare\?/);
    }
    expect(n).toBe(answers.length);
  });

  /* ----------------------------------------------------------------------------------------------
   * Keyboard, states at every width
   * -------------------------------------------------------------------------------------------- */

  test('keyboard: arrows switch the mode, Tab reaches the search, a result is picked with Enter, then the CTA', async ({ page }) => {
    await openPriced(page, slots[0]);
    await page.getByRole('radio', { name: 'Cont Bluvi' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('radio', { name: 'Fără cont' })).toBeChecked();
    await page.keyboard.press('Tab');
    await expect(page.getByTestId('walkin-contact-name')).toBeFocused();
    await page.getByRole('radio', { name: 'Fără cont' }).focus();
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByRole('radio', { name: 'Cont Bluvi' })).toBeChecked();
    await page.keyboard.press('Tab');
    await expect(page.getByTestId('walkin-account-search')).toBeFocused();
    await page.keyboard.type('Sim Q');
    await expect(page.getByTestId(`walkin-account-${QA_NAME}`)).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(page.getByTestId(`walkin-account-${QA_NAME}`)).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('walkin-selected-account')).toBeVisible();
    await page.getByTestId('walkin-notes').focus();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Înapoi', exact: true }).last()).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(submit(page)).toBeFocused();
  });

  for (const w of WIDTHS) {
    test(`states at ${w}: account, guest with a linked match, axe`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: w < 768 ? 812 : 900 });
      await page.route(LOOKUP, (route) => json(route, { data: { matched: true, user: { documentId: qaId, username: QA_NAME, avatar: null } } }));
      await openPriced(page, slots[0]);
      if (w >= 1280) {
        // Desktop: the controls are sized to what they hold, not the column (≈ 940 / 1250 px).
        const sw = await page.getByTestId('walkin-mode').boundingBox();
        const field = await page.getByTestId('walkin-account-search').boundingBox();
        expect(sw!.width).toBeLessThanOrEqual(384);
        expect(field!.width).toBeLessThanOrEqual(576);
      }
      await shot(page, 'account');
      await expectNoA11yViolations(page);
      await guest(page);
      await page.getByTestId('walkin-contact-name').fill('Ion Popescu');
      await page.getByTestId('walkin-contact-phone').fill('0712000000');
      await page.getByTestId('walkin-contact-name').click();
      await page.getByTestId('angler-match-link').click();
      await expect(page.getByTestId('walkin-match-banner')).toBeVisible();
      await shot(page, 'guest-linked');
      await expectNoA11yViolations(page);
    });
  }
});
