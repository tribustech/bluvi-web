import { mkdirSync } from 'node:fs';
import { expect, test, type Page, type Route } from '@playwright/test';
import { expectNoA11yViolations } from './helpers/a11y';
import { collectConsoleErrors } from './helpers/console';
import { fakeRaffle, SESSION_ID, type FakeRaffleOptions } from './helpers/fake-raffle';
import { CMS, qaJwt, signIn } from './helpers/session';

/*
 * participant.raffle-confirmation — /tombola/confirmare «Confirmare participare» (T6; fish
 * app/(app)/raffle/confirmation.tsx).
 *
 * The mocked specs write nothing anywhere. The active session comes from helpers/fake-raffle.ts (read-only
 * here); the participation, the receipt upload and the receipt delete are answered by a stateful
 * layer of this spec on top of it (registered later, so it runs first; everything else falls back
 * to fake-raffle): an upload adds 2 chances and the image, a delete takes them back (min 1), as the
 * CMS does — so the invalidations' refetch is visible in the chances tile (c11). The receipt image
 * is an S3 URL answered here with a PNG. They cover the failure and edge states.
 *
 * «local CMS» (the last describe) runs the real round trip on the LOCAL CMS (:1337) through the
 * /api/cms proxy, unmocked: join as the QA user, upload a PNG (multipart field `files`), 3 chances,
 * delete, 1 chance — then removes the participation and the uploaded file (E2E_STRAPI_API_TOKEN, a
 * LOCAL full-access token in .env.local). Skipped when the QA user is already in the local session.
 */

const SHOTS = '.shots/tombola-confirmare';
mkdirSync(SHOTS, { recursive: true });

// 1×1 PNG.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const RECEIPT_URL = 'https://bluvi-staging.s3.eu-central-1.amazonaws.com/e2e-confirmare-bon.png';

type Participation = {
  joined: boolean;
  entriesCount: number;
  typeKey: string | null;
  receiptUploaded: boolean;
  receiptImageUrl: string | null;
};

type Opts = FakeRaffleOptions & {
  part?: Partial<Participation>;
  uploadStatus?: number;
  deleteStatus?: number;
  /** Hold the receipt POST / DELETE answers this long (busy states). */
  writeDelayMs?: number;
};

type Rec = {
  uploads: { contentType: string; body: string }[];
  deletes: number;
  reads: { participation: number };
  part: Participation;
  /** Set mid-test: every participation GET answers 500 from then on (a failed background refetch). */
  failReads: boolean;
};

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const fail = (route: Route, status: number) => json(route, { data: null, error: { status, name: 'Error', message: 'mock failure', details: {} } }, status);

async function fakeParticipation(page: Page, o: Opts): Promise<Rec> {
  const rec: Rec = {
    uploads: [],
    deletes: 0,
    reads: { participation: 0 },
    part: { joined: true, entriesCount: 1, typeKey: 'crap', receiptUploaded: false, receiptImageUrl: null, ...o.part },
    failReads: false,
  };
  const dto = () => ({ ...rec.part, receiptUnderVerification: rec.part.receiptUploaded, canChangeType: true, sessionDocumentId: SESSION_ID });
  const hold = () => (o.writeDelayMs ? new Promise((r) => setTimeout(r, o.writeDelayMs)) : Promise.resolve());

  await page.route('**/api/cms/raffle-sessions/**', async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname.replace(/^\/api\/cms/, '');
    if (path === '/raffle-sessions/participation' && req.method() === 'GET') {
      rec.reads.participation++;
      if (rec.failReads) return fail(route, 500);
      return json(route, { data: dto() });
    }
    if (path === `/raffle-sessions/${SESSION_ID}/receipt` && req.method() === 'POST') {
      rec.uploads.push({ contentType: req.headers()['content-type'] ?? '', body: req.postDataBuffer()?.toString('latin1') ?? '' });
      await hold();
      if ((o.uploadStatus ?? 200) !== 200) return fail(route, o.uploadStatus!);
      if (!rec.part.receiptUploaded) rec.part.entriesCount += 2;
      rec.part = { ...rec.part, receiptUploaded: true, receiptImageUrl: RECEIPT_URL };
      return json(route, { data: { url: RECEIPT_URL, fileId: 1, participation: dto() } });
    }
    if (path === `/raffle-sessions/${SESSION_ID}/receipt` && req.method() === 'DELETE') {
      rec.deletes++;
      await hold();
      if ((o.deleteStatus ?? 200) !== 200) return fail(route, o.deleteStatus!);
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

async function open(page: Page, o: Opts = {}, width = 1280) {
  await page.setViewportSize({ width, height: width < 768 ? 812 : 900 });
  await signIn(page.context(), jwt);
  const fake = await fakeRaffle(page, o);
  const rec = await fakeParticipation(page, o);
  await page.goto('/tombola/confirmare');
  await expect(page.getByRole('heading', { level: 2, name: 'Premii', exact: true })).toBeVisible();
  return { fake, rec };
}

const chances = (page: Page) => page.getByTestId('raffle-chances');
const uploadCard = (page: Page) => page.getByTestId('receipt-upload-card');
const receiptCard = (page: Page) => page.getByTestId('receipt-card');
const replaceBtn = (page: Page) => page.getByRole('button', { name: 'Înlocuiește bonul' });
const deleteBtn = (page: Page) => page.getByRole('button', { name: 'Șterge bonul' });
const dialog = (page: Page, name: string) => page.getByRole('dialog', { name });

/** Web Animations running on the confetti pieces. */
const confettiAnimations = () =>
  document.getAnimations().filter((a) => ((a.effect as KeyframeEffect | null)?.target as Element | null)?.closest('[data-testid="raffle-confetti"]')).length;

async function settle(page: Page) {
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))));
}

test.describe('participant.raffle-confirmation', () => {
  test('signed out → sign-in with the way back (proxy 307)', async ({ page }) => {
    await page.goto('/tombola/confirmare');
    await expect(page).toHaveURL(/\/intra\?next=%2Ftombola%2Fconfirmare$/);
  });

  test('c1 — title, noindex; back and «Închide» both go home', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await open(page);
    await expect(page).toHaveTitle(/Confirmare participare/);
    await expect(page.getByRole('heading', { level: 1, name: 'Confirmare participare' })).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    await expect(page.getByRole('link', { name: 'Înapoi acasă' })).toHaveAttribute('href', '/');
    const close = page.getByRole('link', { name: 'Închide' });
    await expect(close).toHaveAttribute('href', '/');
    await close.click();
    await expect(page).toHaveURL(/\/$/);
    expect(errors).toEqual([]);
  });

  test('c2 c3 — celebration, heading with / without the category, chances with the right noun', async ({ page }) => {
    await open(page, { part: { typeKey: 'crap', entriesCount: 1 } });
    await expect(page.getByTestId('raffle-celebration')).toBeVisible();
    await expect(page.getByTestId('raffle-confetti')).toBeAttached();
    expect(await page.evaluate(confettiAnimations)).toBeGreaterThan(0);
    await expect(page.getByTestId('raffle-heading')).toHaveText('Ești înscris în tragerea la sorți pentru categoria Crap!');
    await expect(page.getByText('Mult succes! Îți ținem pumnii!')).toBeVisible();
    await expect(page.getByText('ȘANSELE TALE ACTUALE')).toBeVisible();
    await expect(chances(page)).toHaveText('1');
    await expect(page.locator('[data-unit]').filter({ hasText: 'șansă' })).toBeVisible();

    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await open(page, { part: { typeKey: null, entriesCount: 3 } });
    await expect(page.getByTestId('raffle-heading')).toHaveText('Ești înscris în tragerea la sorți!');
    await expect(chances(page)).toHaveText('3');
    await expect(page.locator('[data-unit]').filter({ hasText: /^\s*șanse$/ })).toBeVisible();

    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await open(page, { part: { entriesCount: 21 } });
    await expect(page.locator('[data-unit]').filter({ hasText: 'de șanse' })).toBeVisible();
  });

  test('c2 — prefers-reduced-motion: the confetti does not move', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page);
    await expect(page.locator('[data-testid="raffle-confetti"] [data-piece]')).toHaveCount(28);
    const running = await page.evaluate(confettiAnimations);
    expect(running).toBe(0);
  });

  test('not joined → the intro (/tombola); no «Ești înscris», no upload (web; fish shows 0 chances)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await signIn(page.context(), jwt);
    await fakeRaffle(page);
    await fakeParticipation(page, { part: { joined: false, entriesCount: 0, typeKey: null } });
    await page.goto('/tombola/confirmare');
    await expect(page).toHaveURL(/\/tombola$/);
    await expect(page.getByTestId('raffle-heading')).toHaveCount(0);
    await expect(uploadCard(page)).toHaveCount(0);
  });

  test('no session at all → the intro, which sends the viewer home; no static prizes for a raffle that does not exist', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await signIn(page.context(), jwt);
    await fakeRaffle(page, { session: 'none' });
    await page.goto('/tombola/confirmare');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId('raffle-prizes')).toHaveCount(0);
  });

  test('c4 — «Premii»: session prizes, every row expanded; static fallback', async ({ page }) => {
    await open(page);
    const list = page.getByTestId('raffle-prizes');
    await expect(list).toHaveAttribute('data-source', 'session');
    await expect(list.getByText('Kit Crap E2E')).toBeVisible();
    await expect(list.getByRole('button', { name: /2 produse/ })).toHaveAttribute('aria-expanded', 'true');
    await expect(list.getByText('Mulinetă E2E')).toBeVisible();
    await list.getByRole('button', { name: /2 produse/ }).click();
    await expect(list.getByText('Mulinetă E2E')).toBeHidden();

    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await open(page, { noPrizes: true });
    await expect(page.getByTestId('raffle-prizes')).toHaveAttribute('data-source', 'static');
    await expect(page.getByText('Echipament premium de pescuit')).toBeVisible();
  });

  test('c5 c10 — no receipt: the bonus card; upload (first) posts multipart, closes, chances refresh (c11)', async ({ page }) => {
    const { fake, rec } = await open(page, { writeDelayMs: 500 });
    const card = uploadCard(page);
    await expect(card.getByRole('heading', { name: 'Mărește-ți șansele de câștig!' })).toBeVisible();
    await expect(card).toContainText('Cumpără de minim 150 lei de la PescarMania');
    await expect(page.getByTestId('receipt-bonus')).toContainText('+2');
    await expect(page.getByTestId('receipt-bonus')).toContainText('Șanse bonus pentru încărcarea bonului fiscal');
    await expect(receiptCard(page)).toHaveCount(0);

    await card.getByRole('button', { name: 'Încarcă bonul fiscal' }).click();
    const d = dialog(page, 'Încarcă bonul fiscal');
    await expect(d).toBeVisible();
    await settle(page);
    await expect(d.getByText('Instrucțiuni')).toBeVisible();
    await expect(d.getByText(/vei fi descalificat/)).toBeVisible();
    await expect(d.getByText('Alege o metodă de încărcare')).toBeVisible();
    await expect(d.getByText('Sfaturi pentru o fotografie bună')).toBeVisible();
    await expect(d.getByText('Bonul tău încărcat')).toHaveCount(0);
    await expectNoA11yViolations(page);

    const before = { active: fake.reads.active, participation: rec.reads.participation };
    await page.getByTestId('receipt-upload-gallery').setInputFiles({ name: 'bon.png', mimeType: 'image/png', buffer: PNG });
    await expect(d.getByRole('button', { name: 'Încarcă din galerie' })).toHaveAttribute('aria-busy', 'true');
    await expect(d).toBeHidden();
    expect(rec.uploads).toHaveLength(1);
    expect(rec.uploads[0].contentType).toMatch(/^multipart\/form-data; boundary=/);
    expect(rec.uploads[0].body).toMatch(/name="files"; filename="bon\.(jpg|png)"/);
    // c11: the session and the participation are refetched; the new chances and the receipt show.
    await expect(chances(page)).toHaveText('3');
    await expect(receiptCard(page)).toBeVisible();
    await expect(page.getByTestId('receipt-card-image')).toBeVisible();
    expect(rec.reads.participation).toBeGreaterThan(before.participation);
    expect(fake.reads.active).toBeGreaterThan(before.active);
    // Focus lands on the new card's heading (the button that opened the dialog is gone).
    await expect(receiptCard(page).getByRole('heading', { name: 'Mărește-ți șansele de câștig!' })).toBeFocused();
  });

  test('c10 — a failed upload keeps the dialog open with the error', async ({ page }) => {
    const { rec } = await open(page, { uploadStatus: 500 });
    await uploadCard(page).getByRole('button', { name: 'Încarcă bonul fiscal' }).click();
    const d = dialog(page, 'Încarcă bonul fiscal');
    await page.getByTestId('receipt-upload-gallery').setInputFiles({ name: 'bon.png', mimeType: 'image/png', buffer: PNG });
    await expect(page.getByTestId('receipt-upload-error')).toHaveText('Nu am putut încărca bonul. Te rugăm să încerci din nou.');
    await expect(d).toBeVisible();
    expect(rec.uploads).toHaveLength(1);
    await expect(chances(page)).toHaveText('1');
  });

  test('c6 — with a receipt (image): the card, replace (dialog replace + preview) posts multipart', async ({ page }) => {
    const { rec } = await open(page, { part: { receiptUploaded: true, receiptImageUrl: RECEIPT_URL, entriesCount: 3 } });
    const card = receiptCard(page);
    await expect(card.getByRole('heading', { name: 'Mărește-ți șansele de câștig!' })).toBeVisible();
    await expect(card.getByText('Bonul tău încărcat')).toBeVisible();
    await expect(card.getByText('Ai 2 șanse de câștig în plus pentru că ai adăugat bonul.')).toBeVisible();
    await expect(page.getByTestId('receipt-card-image')).toBeVisible();
    await expect(page.getByTestId('receipt-card-image')).toHaveAttribute('src', RECEIPT_URL);
    await expect(page.getByTestId('receipt-cutoff')).toHaveCount(0);
    await expect(uploadCard(page)).toHaveCount(0);
    await expect(replaceBtn(page)).toBeEnabled();
    await expect(deleteBtn(page)).toBeEnabled();

    await replaceBtn(page).click();
    const d = dialog(page, 'Înlocuiește bonul fiscal');
    await expect(d).toBeVisible();
    await expect(d.getByText('Bonul tău încărcat')).toBeVisible();
    await expect(d.getByText('Înlocuiește cu o nouă fotografie mai jos.')).toBeVisible();
    await page.getByTestId('receipt-upload-gallery').setInputFiles({ name: 'bon.png', mimeType: 'image/png', buffer: PNG });
    await expect(d).toBeHidden();
    expect(rec.uploads).toHaveLength(1);
    expect(rec.uploads[0].contentType).toMatch(/^multipart\/form-data; boundary=/);
    await expect(chances(page)).toHaveText('3');
  });

  test('c6 — with a receipt and no image URL: the fallback line', async ({ page }) => {
    await open(page, { part: { receiptUploaded: true, receiptImageUrl: null, entriesCount: 3 } });
    await expect(page.getByTestId('receipt-card-fallback')).toHaveText('Bon încărcat. Poți înlocui sau șterge până la termenul limită.');
    await expect(page.getByTestId('receipt-card-image')).toHaveCount(0);
  });

  test('c8 c11 — «Șterge bonul»: DELETE, busy, then the upload card and the chances drop', async ({ page }) => {
    const { rec } = await open(page, { part: { receiptUploaded: true, receiptImageUrl: RECEIPT_URL, entriesCount: 3 }, writeDelayMs: 600 });
    await expect(chances(page)).toHaveText('3');
    await deleteBtn(page).click();
    await expect(deleteBtn(page)).toHaveAttribute('aria-busy', 'true');
    await expect(deleteBtn(page)).toBeDisabled();
    await expect(uploadCard(page)).toBeVisible();
    expect(rec.deletes).toBe(1);
    await expect(chances(page)).toHaveText('1');
    await expect(receiptCard(page)).toHaveCount(0);
    await expect(uploadCard(page).getByRole('heading', { name: 'Mărește-ți șansele de câștig!' })).toBeFocused();
  });

  test('c8 — a failed delete says so (fish is silent) and keeps the receipt', async ({ page }) => {
    const { rec } = await open(page, { part: { receiptUploaded: true, receiptImageUrl: RECEIPT_URL, entriesCount: 3 }, deleteStatus: 500 });
    await deleteBtn(page).click();
    await expect(page.getByTestId('receipt-card-error')).toHaveText('Nu am putut șterge bonul. Te rugăm să încerci din nou.');
    await expect(page.getByRole('alert').filter({ hasText: 'Nu am putut șterge bonul' })).toBeVisible();
    await expect(receiptCard(page)).toBeVisible();
    await expect(deleteBtn(page)).toBeEnabled();
    await expect(chances(page)).toHaveText('3');
    expect(rec.deletes).toBe(1);

    // The message never outlives the next attempt: opening the dialog clears it, and a successful
    // replace leaves no «Nu am putut șterge bonul» under the fresh receipt.
    await replaceBtn(page).click();
    const d = dialog(page, 'Înlocuiește bonul fiscal');
    await expect(d).toBeVisible();
    await expect(page.getByTestId('receipt-card-error')).toHaveText('');
    await page.getByTestId('receipt-upload-gallery').setInputFiles({ name: 'bon.png', mimeType: 'image/png', buffer: PNG });
    await expect(d).toBeHidden();
    expect(rec.uploads).toHaveLength(1);
    await expect(receiptCard(page)).toBeVisible();
    await expect(page.getByTestId('receipt-card-error')).toHaveText('');
    await expect(page.getByRole('alert').filter({ hasText: 'Nu am putut șterge bonul' })).toHaveCount(0);
  });

  test('a failed refetch after a successful delete keeps the content and says so inline; retry brings it up to date', async ({ page }) => {
    test.setTimeout(90_000);
    const { rec } = await open(page, { part: { receiptUploaded: true, receiptImageUrl: RECEIPT_URL, entriesCount: 3 } });
    await expect(chances(page)).toHaveText('3');
    rec.failReads = true;
    await deleteBtn(page).click();
    // TanStack retries a 5xx twice, then the participation query is in error over cached data.
    await expect(page.getByTestId('raffle-refresh-error')).toHaveText(/Nu am putut actualiza tombola/, { timeout: 30_000 });
    expect(rec.deletes).toBe(1);
    await expect(page.getByRole('heading', { name: 'Nu am putut încărca tombola' })).toHaveCount(0);
    await expect(chances(page)).toBeVisible();
    await expect(page.getByTestId('raffle-prizes')).toBeVisible();
    await expect(page.getByTestId('raffle-celebration')).toBeVisible();
    await settle(page);
    await page.screenshot({ path: `${SHOTS}/refresh-error-1280.png`, fullPage: true });
    await page.setViewportSize({ width: 375, height: 812 });
    await page.screenshot({ path: `${SHOTS}/refresh-error-375.png`, fullPage: true });
    await expectNoA11yViolations(page);

    rec.failReads = false;
    await page.getByTestId('raffle-refresh-error').getByRole('button', { name: 'Încearcă din nou' }).click();
    await expect(page.getByTestId('raffle-refresh-error')).toHaveCount(0);
    await expect(chances(page)).toHaveText('1');
    await expect(uploadCard(page)).toBeVisible();
  });

  test('c5 c7 — registration closed, no receipt yet: the first upload stays open (fish, CMS) and says it is final', async ({ page }) => {
    const { rec } = await open(page, { session: 'closed' });
    const card = uploadCard(page);
    await expect(page.getByTestId('receipt-upload-final')).toHaveText(
      'Înscrierile s-au închis: după ce îl încarci, bonul nu mai poate fi înlocuit sau șters.',
    );
    await card.getByRole('button', { name: 'Încarcă bonul fiscal' }).click();
    const d = dialog(page, 'Încarcă bonul fiscal');
    await page.getByTestId('receipt-upload-gallery').setInputFiles({ name: 'bon.png', mimeType: 'image/png', buffer: PNG });
    await expect(d).toBeHidden();
    expect(rec.uploads).toHaveLength(1);
    // Once uploaded it is locked like any receipt after the deadline (c7).
    await expect(page.getByTestId('receipt-cutoff')).toHaveText('Nu mai poți modifica bonul după termenul limită.');
    await expect(replaceBtn(page)).toBeDisabled();
    await expect(deleteBtn(page)).toBeDisabled();
  });

  test('c5 — registration open: no «final» hint on the upload card', async ({ page }) => {
    await open(page);
    await expect(uploadCard(page)).toBeVisible();
    await expect(page.getByTestId('receipt-upload-final')).toHaveCount(0);
  });

  test('c7 — after the deadline (registration closed): replace and delete disabled, with the hint', async ({ page }) => {
    const { rec } = await open(page, { session: 'closed', part: { receiptUploaded: true, receiptImageUrl: RECEIPT_URL, entriesCount: 3 } });
    await expect(page.getByTestId('receipt-cutoff')).toHaveText('Nu mai poți modifica bonul după termenul limită.');
    await expect(replaceBtn(page)).toBeDisabled();
    await expect(deleteBtn(page)).toBeDisabled();
    await deleteBtn(page).click({ force: true });
    expect(rec.deletes).toBe(0);
  });

  test('c9 — ended with winners: «Vezi câștigători», no receipt cards', async ({ page }) => {
    await open(page, { session: 'ended-winners', part: { receiptUploaded: true, receiptImageUrl: RECEIPT_URL, entriesCount: 3 } });
    await expect(page.getByRole('link', { name: 'Vezi câștigători' })).toHaveAttribute('href', '/tombola/castigatori');
    await expect(receiptCard(page)).toHaveCount(0);
    await expect(uploadCard(page)).toHaveCount(0);
    await expect(chances(page)).toHaveText('3');
  });

  test('c9 — ended without winners: no winners link, no receipt cards, «Închide» stays', async ({ page }) => {
    await open(page, { session: 'ended-empty' });
    await expect(page.getByRole('link', { name: 'Vezi câștigători' })).toHaveCount(0);
    await expect(uploadCard(page)).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Închide' })).toBeVisible();
  });

  test('load error: the retry gate, never «0 șanse»', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await signIn(page.context(), jwt);
    await fakeRaffle(page, { session: 'error' });
    await page.goto('/tombola/confirmare');
    await expect(page.getByRole('heading', { name: 'Nu am putut încărca tombola' })).toBeVisible();
    await expect(chances(page)).toHaveCount(0);
  });

  test('keyboard — upload card → dialog → Escape; receipt actions by Tab + Enter', async ({ page }) => {
    const { rec } = await open(page, { part: { receiptUploaded: true, receiptImageUrl: RECEIPT_URL, entriesCount: 3 } });
    await replaceBtn(page).focus();
    await page.keyboard.press('Enter');
    const d = dialog(page, 'Înlocuiește bonul fiscal');
    await expect(d).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(d).toBeHidden();
    await replaceBtn(page).focus();
    await page.keyboard.press('Tab');
    await expect(deleteBtn(page)).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(uploadCard(page)).toBeVisible();
    expect(rec.deletes).toBe(1);
    await page.keyboard.press('Tab');
    await expect(uploadCard(page).getByRole('button', { name: 'Încarcă bonul fiscal' })).toBeFocused();
  });

  test('screenshots + axe at every width, every state', async ({ page }) => {
    test.setTimeout(240_000);
    const states: [string, Opts][] = [
      ['no-receipt', {}],
      ['receipt', { part: { receiptUploaded: true, receiptImageUrl: RECEIPT_URL, entriesCount: 3 } }],
      ['receipt-no-image', { part: { receiptUploaded: true, receiptImageUrl: null, entriesCount: 3 } }],
      ['locked', { session: 'closed', part: { receiptUploaded: true, receiptImageUrl: RECEIPT_URL, entriesCount: 3 } }],
      ['ended-winners', { session: 'ended-winners', part: { entriesCount: 21 } }],
      ['ended-empty', { session: 'ended-empty' }],
      ['locked-no-receipt', { session: 'closed' }],
    ];
    for (const width of [375, 768, 1280, 1440, 1920]) {
      for (const [name, o] of states) {
        await page.unrouteAll({ behavior: 'ignoreErrors' });
        await open(page, o, width);
        await settle(page);
        await page.screenshot({ path: `${SHOTS}/${name}-${width}.png`, fullPage: true });
        if ((width === 375 || width === 1280) && (name === 'no-receipt' || name === 'receipt' || name === 'ended-winners' || name === 'locked')) {
          await expectNoA11yViolations(page);
        }
      }
    }
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await open(page, { part: { receiptUploaded: true, receiptImageUrl: RECEIPT_URL, entriesCount: 3 } }, 375);
    await replaceBtn(page).click();
    await settle(page);
    await page.screenshot({ path: `${SHOTS}/dialog-replace-375.png` });
  });
});

/*
 * The real round trip on the LOCAL CMS (ROADMAP §5: parity against the local CMS). Nothing is
 * mocked: the proxy's multipart, the CMS's `files` field, the 1 → 3 → 1 arithmetic (upload sets
 * max(prev, 3); delete takes 2, min 1) and the DELETE answer's shape are the CMS's own. Writes only
 * to :1337, and removes what it wrote.
 */
test.describe('participant.raffle-confirmation — local CMS', () => {
  const TOKEN = process.env.E2E_STRAPI_API_TOKEN ?? '';

  test('join → upload a PNG → 3 chances → delete → 1 chance (then cleaned up)', async ({ page, request }) => {
    test.setTimeout(120_000);
    expect(new URL(CMS).hostname, 'local CMS only').toMatch(/^(localhost|127\.0\.0\.1)$/);
    expect(TOKEN, 'Set E2E_STRAPI_API_TOKEN (LOCAL Strapi full-access API token) in .env.local').toBeTruthy();
    const user = { Authorization: `Bearer ${jwt}` };
    const admin = { Authorization: `Bearer ${TOKEN}` };

    const active = await (await request.get(`${CMS}/raffle-sessions/active`)).json();
    const session = active?.data?.session as { documentId: string; types?: { key: string }[] } | undefined;
    test.skip(!session || !active.data.isRegistrationOpen || !session.types?.length, 'no open raffle session on the local CMS');
    const sessionId = session!.documentId;
    const before = await (await request.get(`${CMS}/raffle-sessions/participation`, { headers: user })).json();
    test.skip(before?.data?.joined === true, 'the QA user is already in the local session — not touching it');
    const me = await (await request.get(`${CMS}/users/me`, { headers: user })).json();

    // Not joined: the CMS refuses a receipt (why the web shows no upload card then).
    const refused = await request.post(`${CMS}/raffle-sessions/${sessionId}/receipt`, {
      headers: user,
      multipart: { files: { name: 'bon.png', mimeType: 'image/png', buffer: PNG } },
    });
    expect(refused.status()).toBe(400);
    expect(await refused.text()).toContain('Trebuie să te înscrii la tombolă înainte de a încărca bonul fiscal.');

    const fileIds: number[] = [];
    try {
      const join = await request.post(`${CMS}/raffle-sessions/${sessionId}/join`, { headers: user, data: { typeKey: session!.types![0].key } });
      expect(join.ok(), await join.text()).toBe(true);

      await page.setViewportSize({ width: 1280, height: 900 });
      await signIn(page.context(), jwt);
      await page.goto('/tombola/confirmare');
      await expect(chances(page)).toHaveText('1');

      await uploadCard(page).getByRole('button', { name: 'Încarcă bonul fiscal' }).click();
      const d = dialog(page, 'Încarcă bonul fiscal');
      await expect(d).toBeVisible();
      const posted = page.waitForResponse((r) => r.url().endsWith(`/api/cms/raffle-sessions/${sessionId}/receipt`) && r.request().method() === 'POST');
      await page.getByTestId('receipt-upload-gallery').setInputFiles({ name: 'bon.png', mimeType: 'image/png', buffer: PNG });
      const up = await posted;
      expect(up.request().headers()['content-type']).toMatch(/^multipart\/form-data; boundary=/);
      // A 200 is the CMS reading the file (getFirstFile; a missing one answers 400 «Lipsește fișierul.»).
      expect(up.status(), await up.text()).toBe(200);
      const upBody = await up.json();
      if (typeof upBody?.data?.fileId === 'number') fileIds.push(upBody.data.fileId);
      expect(upBody.data).toMatchObject({ participation: { joined: true, entriesCount: 3, receiptUploaded: true } });
      await expect(d).toBeHidden();
      await expect(chances(page)).toHaveText('3');
      await expect(receiptCard(page)).toBeVisible();

      const deleted = page.waitForResponse((r) => r.url().endsWith(`/api/cms/raffle-sessions/${sessionId}/receipt`) && r.request().method() === 'DELETE');
      await deleteBtn(page).click();
      const del = await deleted;
      expect(del.status()).toBe(200);
      expect((await del.json()).data).toMatchObject({ joined: true, entriesCount: 1, receiptUploaded: false, receiptImageUrl: null, sessionDocumentId: sessionId });
      await expect(uploadCard(page)).toBeVisible();
      await expect(chances(page)).toHaveText('1');
    } finally {
      // Leave the session: the participation (no leave endpoint → the admin token), then the file.
      const q = new URLSearchParams({
        'filters[user][id][$eq]': String(me.id),
        'filters[session][documentId][$eq]': sessionId,
        populate: 'receipt',
      });
      const rows = (await (await request.get(`${CMS}/raffle-participations?${q}`, { headers: admin })).json())?.data ?? [];
      for (const row of rows as { documentId: string; receipt?: { id: number } | null }[]) {
        if (row.receipt?.id) fileIds.push(row.receipt.id);
        const gone = await request.delete(`${CMS}/raffle-participations/${row.documentId}`, { headers: admin });
        expect(gone.ok(), `cleanup participation ${row.documentId}`).toBe(true);
      }
      for (const id of new Set(fileIds)) {
        const gone = await request.delete(`${CMS}/upload/files/${id}`, { headers: admin });
        expect([200, 204, 404], `cleanup file ${id}`).toContain(gone.status());
      }
      const after = await (await request.get(`${CMS}/raffle-sessions/participation`, { headers: user })).json();
      expect(after?.data?.joined, 'the QA user left the local session').toBe(false);
    }
  });
});
