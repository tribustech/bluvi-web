import { mkdirSync } from 'node:fs';
import { expect, test, type Page, type Route } from '@playwright/test';
import { expectNoA11yViolations } from './helpers/a11y';
import { collectConsoleErrors } from './helpers/console';
import { fakeRaffle, SESSION_ID, type FakeRaffleOptions } from './helpers/fake-raffle';
import { qaJwt, signIn } from './helpers/session';

/*
 * participant.raffle-status — /tombola/sansele-mele «Șansele mele» (T6; fish
 * app/(app)/raffle/status.tsx, an orphan there).
 *
 * Writes nothing anywhere. The active session comes from helpers/fake-raffle.ts (read-only here);
 * the participation, the (re-)join, the receipt upload and delete are answered by a stateful layer
 * of this spec on top of it (registered later, so it runs first): a join records its body and sets
 * the type, an upload adds 2 chances and the image, a delete takes them back.
 * The «running» session ends 2026-12-31T21:00Z (fake-raffle); the clock is pinned before it.
 */

const SHOTS = '.shots/tombola-sansele-mele';
mkdirSync(SHOTS, { recursive: true });

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const RECEIPT_URL = 'https://bluvi-staging.s3.eu-central-1.amazonaws.com/e2e-sansele-mele-bon.png';
/** 2 days, 2 hours, 30 minutes (and 30 s) before fake-raffle's end. */
const NOW = new Date('2026-12-29T18:29:30.000Z');
/** 1 day, 1 hour, 1 minute (and 30 s) before it: every countdown label in the singular. */
const NOW_ONES = new Date('2026-12-30T19:58:30.000Z');

type Participation = { joined: boolean; entriesCount: number; typeKey: string | null; receiptUploaded: boolean; receiptImageUrl: string | null };
type Opts = FakeRaffleOptions & { part?: Partial<Participation>; joinFail?: boolean; joinDelayMs?: number; failReads?: boolean };
type Rec = { joins: unknown[]; uploads: number; deletes: number; part: Participation };

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const fail = (route: Route, status: number) => json(route, { data: null, error: { status, name: 'Error', message: 'mock failure', details: {} } }, status);

async function fakeParticipation(page: Page, o: Opts): Promise<Rec> {
  const rec: Rec = {
    joins: [],
    uploads: 0,
    deletes: 0,
    part: { joined: true, entriesCount: 1, typeKey: 'crap', receiptUploaded: false, receiptImageUrl: null, ...o.part },
  };
  const dto = () => ({ ...rec.part, receiptUnderVerification: rec.part.receiptUploaded, canChangeType: true, sessionDocumentId: SESSION_ID });
  await page.route('**/api/cms/raffle-sessions/**', async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname.replace(/^\/api\/cms/, '');
    if (path === '/raffle-sessions/participation' && req.method() === 'GET') {
      if (o.failReads) return fail(route, 500);
      return json(route, { data: dto() });
    }
    if (path === `/raffle-sessions/${SESSION_ID}/join` && req.method() === 'POST') {
      rec.joins.push(req.postDataJSON());
      if (o.joinDelayMs) await new Promise((r) => setTimeout(r, o.joinDelayMs));
      if (o.joinFail) return fail(route, 500);
      rec.part = { ...rec.part, typeKey: (req.postDataJSON() as { typeKey: string }).typeKey };
      return json(route, { data: dto() });
    }
    if (path === `/raffle-sessions/${SESSION_ID}/receipt` && req.method() === 'POST') {
      rec.uploads++;
      if (!rec.part.receiptUploaded) rec.part.entriesCount += 2;
      rec.part = { ...rec.part, receiptUploaded: true, receiptImageUrl: RECEIPT_URL };
      return json(route, { data: { url: RECEIPT_URL, fileId: 1, participation: dto() } });
    }
    if (path === `/raffle-sessions/${SESSION_ID}/receipt` && req.method() === 'DELETE') {
      rec.deletes++;
      rec.part = { ...rec.part, receiptUploaded: false, receiptImageUrl: null, entriesCount: Math.max(1, rec.part.entriesCount - 2) };
      return json(route, { data: dto() });
    }
    return route.fallback();
  });
  await page.route(RECEIPT_URL, (route) => route.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
  return rec;
}

let jwt = '';
test.beforeAll(async ({ request }) => {
  jwt = await qaJwt(request);
});

async function open(page: Page, o: Opts = {}, width = 1280, now = NOW) {
  await page.setViewportSize({ width, height: width < 768 ? 812 : 900 });
  await page.clock.setFixedTime(now);
  await signIn(page.context(), jwt);
  const fake = await fakeRaffle(page, o);
  const rec = await fakeParticipation(page, o);
  await page.goto('/tombola/sansele-mele');
  await expect(page.getByRole('heading', { level: 2, name: 'Premii pe care le poți câștiga' })).toBeVisible();
  return { fake, rec };
}

/** A countdown cell: its figure, its visible label, and the whole cell's text (with the sr phrase). */
const cell = (page: Page, id: 'days' | 'hours' | 'minutes') => {
  const li = page.getByTestId(`raffle-countdown-${id}`);
  return { value: li.locator('[data-value]'), label: li.locator('[data-label]'), spoken: li.locator('.sr-only') };
};
const TYPES_BODY = 'Poți schimba tipul (Crap, Feeder sau Răpitor) până la termenul limită stabilit în timpul tombolei.';

const radio = (page: Page, name: string) => page.getByRole('radio', { name, exact: true });
/** The tile by its title (while a change runs the busy word joins the radio's name, so not by role). */
const tile = (page: Page, name: string) => page.getByTestId('raffle-types').locator('label').filter({ hasText: new RegExp(`^${name}`) });

async function shots(page: Page, state: string, widths = [375, 768, 1280, 1440, 1920]) {
  for (const w of widths) {
    await page.setViewportSize({ width: w, height: w < 768 ? 812 : 900 });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `${SHOTS}/${state}-${w}.png`, fullPage: true });
  }
}

test.describe('participant.raffle-status', () => {
  test('signed out → sign-in with the way back (proxy 307)', async ({ page }) => {
    await page.goto('/tombola/sansele-mele');
    await expect(page).toHaveURL(/\/intra\?next=%2Ftombola%2Fsansele-mele$/);
  });

  test('c1 — reachable by URL only: title, noindex; no link to it on home or the confirmation', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await open(page);
    await expect(page).toHaveTitle(/[ȘŞ]ansele mele/);
    await expect(page.getByRole('heading', { level: 1, name: /[ȘŞ]ansele mele/ })).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    await page.goto('/tombola/confirmare');
    await expect(page.getByRole('heading', { level: 2, name: 'Premii', exact: true })).toBeVisible();
    await expect(page.locator('a[href*="/tombola/sansele-mele"]')).toHaveCount(0);
    await page.goto('/');
    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator('a[href*="/tombola/sansele-mele"]')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('c2 c3 — running, no receipt: hero, breakdown 1 / 0 / 1, countdown at render (static); axe', async ({ page }) => {
    await open(page, { part: { entriesCount: 1 } });
    const hero = page.getByTestId('raffle-hero');
    await expect(hero.getByText('ȘANSELE TALE TOTALE')).toBeVisible();
    await expect(page.getByTestId('raffle-chances')).toHaveText('1');
    await expect(hero.locator('[data-unit]')).toHaveText(/^\s*șansă de câștig$/);
    await expect(page.getByTestId('raffle-with-receipt')).toHaveCount(0);
    await expect(page.getByTestId('raffle-entry')).toContainText('Intrare');
    await expect(page.getByTestId('raffle-entry')).toContainText('1');
    await expect(page.getByTestId('raffle-bonus')).toContainText('Bonus');
    await expect(page.getByTestId('raffle-bonus')).toContainText('0');
    await expect(page.getByTestId('raffle-total')).toContainText('Total');
    await expect(page.getByTestId('raffle-total')).toContainText('1');

    const cd = page.getByTestId('raffle-countdown');
    await expect(cd.getByRole('heading', { name: 'Câștigătorul anunțat în:' })).toBeVisible();
    await expect(cell(page, 'days').value).toHaveText('2');
    await expect(cell(page, 'days').label).toHaveText('Zile');
    await expect(cell(page, 'hours').value).toHaveText('2');
    await expect(cell(page, 'hours').label).toHaveText('Ore');
    await expect(cell(page, 'minutes').value).toHaveText('30');
    await expect(cell(page, 'minutes').label).toHaveText('Minute');
    await expect(cell(page, 'minutes').spoken).toHaveText('30 de minute');
    // fish does not tick: two minutes later the page still says what it said when it rendered.
    await page.clock.setFixedTime(new Date(NOW.getTime() + 2 * 60_000));
    await page.waitForTimeout(1500);
    await expect(cell(page, 'minutes').value).toHaveText('30');
    await expect(page.getByTestId('raffle-ended')).toHaveCount(0);
    await expectNoA11yViolations(page);
    await shots(page, 'running');
  });

  test('c3 — 1 day, 1 hour, 1 minute left: every label in the singular (owner rule: plurals)', async ({ page }) => {
    await open(page, {}, 375, NOW_ONES);
    for (const [id, label, spoken] of [
      ['days', 'Zi', '1 zi'],
      ['hours', 'Oră', '1 oră'],
      ['minutes', 'Minut', '1 minut'],
    ] as const) {
      await expect(cell(page, id).value).toHaveText('1');
      await expect(cell(page, id).label).toHaveText(label);
      await expect(cell(page, id).spoken).toHaveText(spoken);
    }
    await expect(page.getByTestId('raffle-countdown')).not.toContainText(/Zile|Ore|Minute/);
    await shots(page, 'countdown-singular');
  });

  test('c2 — with a receipt: «Total șanse cu bon: 3 șanse», bonus 2, total 3', async ({ page }) => {
    await open(page, { part: { entriesCount: 3, receiptUploaded: true, receiptImageUrl: RECEIPT_URL } });
    await expect(page.getByTestId('raffle-chances')).toHaveText('3');
    await expect(page.getByTestId('raffle-hero').locator('[data-unit]')).toHaveText(/^\s*șanse de câștig$/);
    await expect(page.getByTestId('raffle-with-receipt')).toHaveText('Total șanse cu bon: 3 șanse');
    await expect(page.getByTestId('raffle-bonus')).toContainText('2');
    await expect(page.getByTestId('raffle-total')).toContainText('3');
  });

  test('c4 — ended: «Tragerea s-a încheiat.», no countdown, no receipt card; other types off; axe', async ({ page }) => {
    await open(page, { session: 'ended-winners', part: { receiptUploaded: true, entriesCount: 3 } });
    await expect(page.getByTestId('raffle-ended')).toHaveText('Tragerea s-a încheiat.');
    await expect(page.getByTestId('raffle-countdown')).toHaveCount(0);
    await expect(page.getByTestId('receipt-card')).toHaveCount(0);
    await expect(page.getByTestId('receipt-upload-card')).toHaveCount(0);
    await expect(radio(page, 'Crap')).toBeChecked();
    await expect(radio(page, 'Feeder')).toBeDisabled();
    await expect(radio(page, 'Răpitor')).toBeDisabled();
    // Rule 4: nothing says the type can still change — the ended lock line instead of the body.
    await expect(page.getByTestId('raffle-type-locked')).toHaveText('Tragerea s-a încheiat: tipul nu mai poate fi schimbat.');
    await expect(page.getByTestId('raffle-type-body')).toHaveCount(0);
    await expect(page.getByText(TYPES_BODY)).toHaveCount(0);
    await expectNoA11yViolations(page);
    await shots(page, 'ended');
  });

  test('c5 — type change: POST join {typeKey}, busy on the chosen tile, then it is the type', async ({ page }) => {
    const { rec } = await open(page, { joinDelayMs: 1200 });
    await expect(page.getByRole('group', { name: 'Tipul premiilor alese' })).toBeVisible();
    await expect(page.getByTestId('raffle-type-body')).toHaveText(TYPES_BODY);
    await expect(page.getByTestId('raffle-type-locked')).toHaveCount(0);
    await expect(radio(page, 'Crap')).toBeChecked();
    await tile(page, 'Feeder').click();
    // Busy: the spinner sits on the tile just chosen, every tile holds still meanwhile.
    await expect(tile(page, 'Feeder').getByTestId('raffle-type-busy')).toBeVisible();
    await expect(tile(page, 'Crap').getByTestId('raffle-type-busy')).toHaveCount(0);
    await expect(radio(page, 'Răpitor')).toBeDisabled();
    await expect(page.getByRole('group', { name: 'Tipul premiilor alese' })).toHaveAttribute('aria-busy', 'true');
    await expect(page.getByTestId('raffle-type-busy')).toHaveCount(0);
    expect(rec.joins).toEqual([{ typeKey: 'feeder' }]);
    await expect(radio(page, 'Feeder')).toBeChecked();
    await expect(radio(page, 'Crap')).not.toBeChecked();
    await expect(radio(page, 'Răpitor')).toBeEnabled();
    await expect(page.getByTestId('raffle-type-error')).toBeEmpty();
    // Picking the type already chosen does nothing.
    await tile(page, 'Feeder').click();
    await page.waitForTimeout(300);
    expect(rec.joins).toHaveLength(1);
    await expect(page.getByTestId('raffle-type-unsaved')).toHaveCount(0);
  });

  test('c5 — keyboard: arrows only pick (no write); Space / Enter / «Schimbă în …» commit; Escape drops the pick', async ({ page }) => {
    const { rec } = await open(page);
    await radio(page, 'Crap').focus();
    // Listening to the options sends nothing.
    await page.keyboard.press('ArrowRight');
    await expect(radio(page, 'Feeder')).toBeChecked();
    await expect(radio(page, 'Feeder')).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(radio(page, 'Răpitor')).toBeChecked();
    await page.keyboard.press('ArrowLeft');
    await expect(radio(page, 'Feeder')).toBeChecked();
    await page.waitForTimeout(300);
    expect(rec.joins).toEqual([]);
    const unsaved = page.getByTestId('raffle-type-unsaved');
    await expect(unsaved).toContainText('Tipul tău rămâne Crap până confirmi.');
    await expect(unsaved.getByRole('button', { name: 'Schimbă în Feeder' })).toBeVisible();
    await expectNoA11yViolations(page);
    await shots(page, 'type-unsaved');

    // Space commits the pick.
    await page.keyboard.press('Space');
    await expect.poll(() => rec.joins).toEqual([{ typeKey: 'feeder' }]);
    await expect(unsaved).toHaveCount(0);
    await expect(radio(page, 'Feeder')).toBeChecked();
    await expect(radio(page, 'Feeder')).toBeFocused();

    // Escape drops an unconfirmed pick: back to the saved type, nothing sent.
    await page.keyboard.press('ArrowRight');
    await expect(radio(page, 'Răpitor')).toBeChecked();
    await page.keyboard.press('Escape');
    await expect(radio(page, 'Feeder')).toBeChecked();
    await expect(unsaved).toHaveCount(0);

    // Enter commits too.
    await radio(page, 'Feeder').focus();
    await page.keyboard.press('ArrowRight');
    await expect(radio(page, 'Răpitor')).toBeChecked();
    await page.keyboard.press('Enter');
    await expect.poll(() => rec.joins).toEqual([{ typeKey: 'feeder' }, { typeKey: 'rapitor' }]);
    await expect(radio(page, 'Răpitor')).toBeChecked();

    // Arrowing back to the saved type is no change: nothing to confirm, nothing sent.
    await radio(page, 'Răpitor').focus();
    await page.keyboard.press('ArrowLeft');
    await expect(unsaved).toBeVisible();
    await page.keyboard.press('ArrowRight');
    await expect(unsaved).toHaveCount(0);

    // The confirm button commits the pick it names.
    await page.keyboard.press('ArrowLeft');
    await unsaved.getByRole('button', { name: 'Schimbă în Feeder' }).click();
    await expect.poll(() => rec.joins).toHaveLength(3);
    expect(rec.joins[2]).toEqual({ typeKey: 'feeder' });
    await expect(radio(page, 'Feeder')).toBeChecked();
    await expect(unsaved).toHaveCount(0);
  });

  test('c5 — a failed change says so and keeps the old type', async ({ page }) => {
    const { rec } = await open(page, { joinFail: true });
    await tile(page, 'Răpitor').click();
    await expect(page.getByTestId('raffle-type-error')).toHaveText('Nu am putut schimba tipul. Te rugăm să încerci din nou.');
    expect(rec.joins).toEqual([{ typeKey: 'rapitor' }]);
    await expect(radio(page, 'Crap')).toBeChecked();
    await expect(radio(page, 'Răpitor')).not.toBeChecked();
    await expectNoA11yViolations(page);
    await shots(page, 'type-failed');
  });

  test('c5 c7 — after the deadline: other types off with the hint; replace / delete off with the hint', async ({ page }) => {
    const { rec } = await open(page, { session: 'closed', part: { receiptUploaded: true, receiptImageUrl: RECEIPT_URL, entriesCount: 3 } });
    await expect(radio(page, 'Crap')).toBeChecked();
    await expect(radio(page, 'Feeder')).toBeDisabled();
    await expect(radio(page, 'Răpitor')).toBeDisabled();
    await tile(page, 'Feeder').click({ force: true });
    await page.waitForTimeout(300);
    expect(rec.joins).toEqual([]);
    // Rule 4: the lock line replaces the body (the body is no longer true).
    await expect(page.getByTestId('raffle-type-locked')).toHaveText('Termenul limită a trecut: tipul nu mai poate fi schimbat.');
    await expect(page.getByTestId('raffle-type-body')).toHaveCount(0);
    await expect(page.getByText(TYPES_BODY)).toHaveCount(0);
    // A keyboard press on the chosen type sends nothing either.
    await radio(page, 'Crap').focus();
    await page.keyboard.press('Space');
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(300);
    expect(rec.joins).toEqual([]);
    await expect(page.getByTestId('raffle-countdown')).toBeVisible();
    const card = page.getByTestId('receipt-card');
    await expect(card.getByRole('heading', { name: 'Bonul tău încărcat' })).toBeVisible();
    await expect(card.getByTestId('receipt-cutoff')).toHaveText('Nu mai poți modifica bonul după termenul limită.');
    await expect(card.getByRole('button', { name: 'Înlocuiește bonul' })).toBeDisabled();
    await expect(card.getByRole('button', { name: 'Șterge bonul' })).toBeDisabled();
    await expectNoA11yViolations(page);
    await shots(page, 'deadline');
  });

  test('c6 — session prizes: closed at first, one expanded at a time', async ({ page }) => {
    await open(page);
    const prizes = page.getByTestId('raffle-prizes');
    await expect(prizes).toHaveAttribute('data-source', 'session');
    await expect(prizes.getByText('Kit Crap E2E')).toBeVisible();
    await expect(prizes.getByText('Nadă E2E')).toBeVisible();
    const first = prizes.getByRole('button', { name: '2 produse' });
    const second = prizes.getByRole('button', { name: '1 produs' });
    await expect(first).toHaveAttribute('aria-expanded', 'false');
    await expect(second).toHaveAttribute('aria-expanded', 'false');
    await expect(prizes.getByText('Mulinetă E2E')).toBeHidden();
    await first.click();
    await expect(first).toHaveAttribute('aria-expanded', 'true');
    await expect(prizes.getByText('Mulinetă E2E')).toBeVisible();
    await second.click();
    await expect(second).toHaveAttribute('aria-expanded', 'true');
    await expect(first).toHaveAttribute('aria-expanded', 'false');
    await expect(prizes.getByText('Mulinetă E2E')).toBeHidden();
    await expect(prizes.getByText('Sac E2E')).toBeVisible();
    await second.click();
    await expect(second).toHaveAttribute('aria-expanded', 'false');
  });

  test('c6 — without session prizes: the three static prizes with their descriptions', async ({ page }) => {
    await open(page, { noPrizes: true });
    const prizes = page.getByTestId('raffle-prizes');
    await expect(prizes).toHaveAttribute('data-source', 'static');
    await expect(prizes.getByRole('listitem')).toHaveCount(3);
    await expect(prizes.getByText('Echipament premium de pescuit')).toBeVisible();
    await expect(prizes.getByText('Lansete, mulinete și accesorii de pescuit de înaltă calitate')).toBeVisible();
    await expect(prizes.getByText('Merchandise Bluvi')).toBeVisible();
    await expect(prizes.getByText('Tricouri, șepci și alte produse oficiale Bluvi')).toBeVisible();
    await expect(prizes.getByText('Premii speciale expoziție')).toBeVisible();
    await expect(prizes.getByText('Premii exclusive disponibile doar la Bluvi Expo')).toBeVisible();
    await expectNoA11yViolations(page);
    await shots(page, 'static-prizes');
  });

  test('c7 — no receipt: «Bon fiscal PescarMania (min. 150 lei)» → «Încarcă bon fiscal» opens the add dialog; upload refreshes the chances', async ({ page }) => {
    const { rec } = await open(page);
    const card = page.getByTestId('receipt-upload-card');
    await expect(card.getByRole('heading', { name: 'Bon fiscal PescarMania (min. 150 lei)' })).toBeVisible();
    await expect(card.getByTestId('receipt-upload-final')).toHaveCount(0);
    await card.getByRole('button', { name: 'Încarcă bon fiscal' }).click();
    const dialog = page.getByRole('dialog', { name: 'Adaugă bon fiscal' });
    await expect(dialog).toBeVisible();
    await page.getByTestId('receipt-upload-gallery').setInputFiles({ name: 'bon.png', mimeType: 'image/png', buffer: PNG });
    await expect(dialog).toBeHidden();
    expect(rec.uploads).toBe(1);
    await expect(page.getByTestId('raffle-chances')).toHaveText('3');
    await expect(page.getByTestId('raffle-bonus')).toContainText('2');
    await expect(page.getByTestId('receipt-card')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Bonul tău încărcat' })).toBeFocused();
  });

  test('c7 — with a receipt: preview, «Înlocuiește bonul» (replace dialog), «Șterge bonul» → the add card', async ({ page }) => {
    const { rec } = await open(page, { part: { receiptUploaded: true, receiptImageUrl: RECEIPT_URL, entriesCount: 3 } });
    const card = page.getByTestId('receipt-card');
    await expect(card.getByRole('heading', { name: 'Bonul tău încărcat' })).toBeVisible();
    await expect(card.getByTestId('receipt-card-image')).toBeVisible();
    await expect(card.getByTestId('receipt-cutoff')).toHaveCount(0);
    await expect(page.getByTestId('receipt-upload-card')).toHaveCount(0);
    await expectNoA11yViolations(page);
    await shots(page, 'receipt');

    await card.getByRole('button', { name: 'Înlocuiește bonul' }).click();
    await expect(page.getByRole('dialog', { name: 'Înlocuiește bonul fiscal' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await card.getByRole('button', { name: 'Șterge bonul' }).click();
    await expect(page.getByTestId('receipt-upload-card')).toBeVisible();
    expect(rec.deletes).toBe(1);
    await expect(page.getByTestId('raffle-chances')).toHaveText('1');
    await expect(page.getByRole('heading', { name: 'Bon fiscal PescarMania (min. 150 lei)' })).toBeFocused();
  });

  test('c7 — receipt without an image URL: the fallback line', async ({ page }) => {
    await open(page, { part: { receiptUploaded: true, receiptImageUrl: null, entriesCount: 3 } });
    await expect(page.getByTestId('receipt-card-fallback')).toHaveText('Bon încărcat. Poți înlocui sau șterge până la termenul limită.');
  });

  test('c5 c7 — after the deadline, no receipt: the add card still uploads and says the bon is final', async ({ page }) => {
    await open(page, { session: 'closed' });
    const card = page.getByTestId('receipt-upload-card');
    await expect(card.getByTestId('receipt-upload-final')).toBeVisible();
    await expect(card.getByRole('button', { name: 'Încarcă bon fiscal' })).toBeEnabled();
  });

  test('c8 — «Înapoi acasă» replaces the page with home; keyboard', async ({ page }) => {
    await open(page);
    const back = page.getByRole('button', { name: 'Înapoi acasă' });
    await back.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/$/);
    await page.goBack();
    await expect(page).not.toHaveURL(/sansele-mele/);
  });

  test('not joined → the intro (/tombola); no session → home (via the intro)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await signIn(page.context(), jwt);
    await fakeRaffle(page);
    await fakeParticipation(page, { part: { joined: false, entriesCount: 0, typeKey: null } });
    await page.goto('/tombola/sansele-mele');
    await expect(page).toHaveURL(/\/tombola$/);
    await expect(page.getByTestId('raffle-chances')).toHaveCount(0);

    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await fakeRaffle(page, { session: 'none' });
    await page.goto('/tombola/sansele-mele');
    await expect(page).toHaveURL(/\/$/);
  });

  test('loading → skeleton (nothing about chances); load error → retry gate', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await signIn(page.context(), jwt);
    await fakeRaffle(page, { session: 'error' });
    await page.goto('/tombola/sansele-mele');
    await expect(page.getByRole('heading', { name: 'Nu am putut încărca tombola' })).toBeVisible();
    await expect(page.getByTestId('raffle-chances')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Încearcă din nou' })).toBeVisible();
    await expectNoA11yViolations(page);
    await shots(page, 'error');

    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await page.route('**/api/cms/raffle-sessions/active', () => new Promise(() => {}));
    await page.goto('/tombola/sansele-mele');
    await expect(page.locator('[aria-busy="true"]').first()).toBeAttached();
    await expect(page.getByTestId('raffle-chances')).toHaveCount(0);
    await shots(page, 'loading');
  });
});
