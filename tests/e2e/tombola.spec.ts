import { mkdirSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { expectNoA11yViolations } from './helpers/a11y';
import { collectConsoleErrors } from './helpers/console';
import { fakeRaffle, SESSION_ID, type FakeRaffleOptions } from './helpers/fake-raffle';
import { qaJwt, signIn } from './helpers/session';

/*
 * participant.raffle-intro — /tombola «Tragere la sorți» (T6; fish app/(app)/raffle/index.tsx).
 *
 * NOTHING is written anywhere: a raffle join is irreversible (no leave endpoint), so the session,
 * the participation, the join, the receipt upload and the profile phone PATCH are route-mocked
 * (helpers/fake-raffle.ts) and their bodies asserted. The viewer is the real QA account (cookie);
 * its profile GET is real (phone optionally blanked by the fake).
 */

const SHOTS = '.shots/tombola';
mkdirSync(SHOTS, { recursive: true });

// 1×1 PNG.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

let jwt = '';
test.beforeAll(async ({ request }) => {
  jwt = await qaJwt(request);
});

async function open(page: Page, opts: FakeRaffleOptions = {}, width = 1280) {
  await page.setViewportSize({ width, height: width < 768 ? 812 : 900 });
  await signIn(page.context(), jwt);
  const fake = await fakeRaffle(page, opts);
  await page.goto('/tombola');
  return fake;
}

async function ready(page: Page) {
  await expect(page.getByRole('heading', { level: 2, name: 'Premii', exact: true })).toBeVisible();
}

const cta = (page: Page) => page.getByRole('button', { name: /Intră în tragerea la sorți|Se înscrie/ });
/** Let the dialog's entrance transition finish (axe reads mid-fade colours otherwise). */
async function settle(page: Page) {
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))));
}

/** The type tile is a label around a visually hidden radio: click the tile, as a user does. */
async function pickType(page: Page, label: string) {
  await page.locator('label').filter({ has: page.getByRole('radio', { name: new RegExp(label) }) }).click();
  await expect(page.getByRole('radio', { name: new RegExp(label) })).toBeChecked();
}
const errors = (page: Page) => page.getByTestId('raffle-errors');
const regulation = (page: Page) => page.getByRole('checkbox', { name: 'Am citit regulamentul tombolei' });

test.describe('participant.raffle-intro', () => {
  test('signed out → sign-in with the way back (proxy 307)', async ({ page }) => {
    await page.goto('/tombola');
    await expect(page).toHaveURL(/\/intra\?next=%2Ftombola$/);
  });

  test('participant.b.raffle-entry — Acasă guest CTA returns to /tombola after sign-in', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    const link = page.getByRole('link', { name: 'Intră ca să participi' }).filter({ visible: true });
    if ((await link.count()) === 0) test.skip(true, 'no active raffle session on the local CMS');
    await expect(link.first()).toHaveAttribute('href', '/intra?next=%2Ftombola');
  });

  test('participant.raffle-intro.c1 — redirects after the data', async ({ page }) => {
    await open(page, { session: 'none' });
    await expect(page).toHaveURL(/\/$/);
    await page.unrouteAll({ behavior: 'ignoreErrors' });

    await fakeRaffle(page, { joined: true });
    await page.goto('/tombola');
    await expect(page).toHaveURL(/\/$/);
    await page.unrouteAll({ behavior: 'ignoreErrors' });

    await fakeRaffle(page, { session: 'ended-winners' });
    await page.goto('/tombola');
    await expect(page).toHaveURL(/\/tombola\/castigatori$/);
    await page.unrouteAll({ behavior: 'ignoreErrors' });

    await fakeRaffle(page, { session: 'ended-empty' });
    await page.goto('/tombola');
    await expect(page).toHaveURL(/\/$/);
  });

  test('a failed read shows a retry gate, never the form', async ({ page }) => {
    await open(page, { session: 'error' });
    await expect(page.getByRole('alert').getByText('Nu am putut încărca tombola')).toBeVisible({ timeout: 25_000 });
    await expect(cta(page)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Încearcă din nou' })).toBeVisible();
  });

  test('participant.raffle-intro.c2–c8 c10 b.raffle-data — content, prizes, badges; noindex', async ({ page }) => {
    const consoleErrors = collectConsoleErrors(page);
    const fake = await open(page);
    await ready(page);
    expect(fake.reads.active).toBeGreaterThan(0);
    expect(fake.reads.participation).toBeGreaterThan(0);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    // c2
    await expect(page.getByRole('heading', { level: 1, name: 'Tragere la sorți' })).toBeVisible();
    await expect(page.locator('main img').first()).toBeVisible();
    // c3
    await expect(page.getByRole('heading', { name: /^Participă la tragerea la sorți pentru șansa/ })).toBeVisible();
    await expect(page.getByText(/^Alătură-te competiției noastre/)).toBeVisible();
    // c4
    const types = page.getByRole('group', { name: 'Alege tipul premiilor' });
    await expect(types.getByText(/^Selectează secțiunea în care vrei să intri/)).toBeVisible();
    await expect(types.getByRole('radio')).toHaveCount(3);
    await expect(types.getByText('4 înscriși')).toBeVisible();
    await expect(types.getByText('1 înscris', { exact: true })).toBeVisible();
    // c5 c6: session prizes, all expanded
    const prizes = page.getByTestId('raffle-prizes');
    await expect(prizes).toHaveAttribute('data-source', 'session');
    await expect(prizes.getByText('Kit Crap E2E')).toBeVisible();
    await expect(prizes.getByText('Mulinetă și geantă · 900 LEI × 1')).toBeVisible();
    await expect(prizes.getByText('2 ×')).toBeVisible();
    await expect(prizes.getByText('Senzor 10kg', { exact: true })).toBeVisible();
    await expect(prizes.getByText('4 înscriși')).toBeVisible();
    const kit = prizes.getByRole('button', { name: '2 produse' });
    await expect(kit).toHaveAttribute('aria-expanded', 'true');
    await expect(prizes.getByText('Mulinetă E2E')).toBeVisible();
    await expect(prizes.getByText('Frână față')).toBeVisible();
    await expect(prizes.getByText('Sac E2E')).toBeVisible(); // legacy subItems
    await kit.click();
    await expect(kit).toHaveAttribute('aria-expanded', 'false');
    await expect(prizes.getByText('Mulinetă E2E')).toBeHidden();
    // badge in the CMS colour, readable text (#FFC107 → black)
    const feeder = prizes.getByText('Feeder', { exact: true });
    await expect(feeder).toHaveCSS('background-color', 'rgb(255, 193, 7)');
    await expect(feeder).toHaveCSS('color', 'rgb(0, 0, 0)');
    await expect(prizes.getByText('Crap', { exact: true })).toHaveCSS('background-color', 'rgb(0, 0, 255)');
    // c7
    const how = page.getByRole('region', { name: 'Cum funcționează' });
    await expect(how.getByRole('listitem')).toHaveText([
      /Înscrie-te în tragerea la sorți prin aplicație/,
      /Primești automat 1 șansă de câștig/,
      /Cumpără de minim 150 lei de la PescarMania, înscrie bonul fiscal și primești 2 șanse în plus la tragerea la sorți\./,
    ]);
    // c8
    await expect(page.getByRole('region', { name: 'Bonus pentru clienți' })).toContainText('PescarMania');
    // c10
    await expect(page.getByText('Dacă câștigi, vom verifica bonul fiscal. Dacă bonul nu este corect sau este duplicat, vei fi descalificat.')).toBeVisible();
    await expectNoA11yViolations(page);
    expect(consoleErrors).toEqual([]);
  });

  test('participant.raffle-intro.c5 — static prizes when the session has none', async ({ page }) => {
    await open(page, { noPrizes: true });
    await ready(page);
    const prizes = page.getByTestId('raffle-prizes');
    await expect(prizes).toHaveAttribute('data-source', 'static');
    await expect(prizes.getByText('Echipament premium de pescuit')).toBeVisible();
    await expect(prizes.getByText('500 LEI × 2')).toBeVisible();
    await expect(prizes.getByText('Merchandise Bluvi')).toBeVisible();
    await expect(prizes.getByText('Premii speciale expoziție')).toBeVisible();
  });

  test('participant.raffle-intro.c5 — static prizes without session types: labels with diacritics', async ({ page }) => {
    await open(page, { noPrizes: true, session: 'no-types' });
    await ready(page);
    const prizes = page.getByTestId('raffle-prizes');
    await expect(prizes.getByText('Răpitor', { exact: true })).toBeVisible();
    await expect(prizes.getByText('Crap', { exact: true })).toBeVisible();
    await expect(prizes.getByText('rapitor', { exact: true })).toHaveCount(0);
  });

  test('participant.raffle-intro.c9 — receipt picker: one image input, preview, remove', async ({ page }) => {
    await open(page);
    await ready(page);
    const section = page.getByRole('region', { name: 'Adaugă bon fiscal PescarMania' });
    await expect(section.getByRole('button', { name: 'Din galerie' })).toBeVisible();
    // Desktop (fine pointer): no camera button.
    await expect(section.getByRole('button', { name: 'Fotografiază' })).toHaveCount(0);
    await expect(page.getByTestId('receipt-gallery')).toHaveAttribute('accept', 'image/*');
    await expect(page.getByTestId('receipt-camera')).toHaveAttribute('capture', 'environment');
    await page.getByTestId('receipt-gallery').setInputFiles({ name: 'bon.png', mimeType: 'image/png', buffer: PNG });
    await expect(page.getByRole('img', { name: 'Bonul fiscal ales' })).toBeVisible();
    await section.getByRole('button', { name: 'Elimină imaginea' }).click();
    await expect(page.getByRole('img', { name: 'Bonul fiscal ales' })).toHaveCount(0);
    await expect(section.getByRole('button', { name: 'Din galerie' })).toBeVisible();
  });

  test('participant.raffle-intro.c9 — touch screens get «Fotografiază» too', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });
    const page = await ctx.newPage();
    await signIn(ctx, jwt);
    await fakeRaffle(page);
    await page.goto('/tombola');
    await ready(page);
    const section = page.getByRole('region', { name: 'Adaugă bon fiscal PescarMania' });
    await expect(section.getByRole('button', { name: 'Fotografiază' })).toBeVisible();
    await expect(section.getByRole('button', { name: 'Din galerie' })).toBeVisible();
    await ctx.close();
  });

  test('participant.raffle-intro.c11 — regulation checkbox (label toggles) and dialog', async ({ page }) => {
    await open(page);
    await ready(page);
    await expect(regulation(page)).not.toBeChecked();
    await page.getByText('Am citit regulamentul tombolei').click();
    await expect(regulation(page)).toBeChecked();
    await page.getByText('Am citit regulamentul tombolei').click();
    await expect(regulation(page)).not.toBeChecked();

    await page.getByRole('button', { name: 'Vezi regulament' }).click();
    const dialog = page.getByRole('dialog', { name: 'Regulament E2E' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Înscriere E2E' })).toBeVisible();
    await expect(dialog.getByText('Echipa verifică bonul fiscal.')).toBeVisible();
    await settle(page);
    await expectNoA11yViolations(page);
    // The footer «Închide» (the dialog's X is labelled the same).
    await dialog.getByText('Închide', { exact: true }).click();
    await expect(dialog).toBeHidden();
  });

  test('participant.raffle-intro.c11 — no regulationTitle: no visible title', async ({ page }) => {
    await open(page, { regulationTitle: null }, 375);
    await ready(page);
    await page.getByRole('button', { name: 'Vezi regulament' }).click();
    const reg = page.getByTestId('raffle-regulation');
    await expect(reg.getByText('Înscriere E2E')).toBeVisible();
    await expect(page.getByText('Regulament E2E')).toHaveCount(0);
  });

  test('participant.raffle-intro.c12 — validation order and the «Erori» card', async ({ page }) => {
    const fake = await open(page);
    await ready(page);
    await cta(page).click();
    await expect(errors(page)).toBeVisible();
    await expect(errors(page)).toContainText('Erori');
    await expect(errors(page)).toContainText('Te rugăm să accepți regulamentul tombolei (bifează că ai citit regulamentul).');
    await expect(errors(page)).toBeFocused();
    await regulation(page).check();
    await cta(page).click();
    await expect(errors(page)).toContainText('Te rugăm să alegi tipul premiilor (Crap, Feeder sau Răpitor).');
    // Picking a type clears the error, and the summary follows.
    await pickType(page, 'Feeder');
    await expect(errors(page)).toBeHidden();
    await expect(page.getByTestId('summary-type')).toHaveText('Feeder');
    expect(fake.joins).toEqual([]);
  });

  test('participant.raffle-intro.c12 — phone: the error and the checkbox + CTA in view together', async ({ page }) => {
    await open(page, {}, 375);
    await ready(page);
    await cta(page).click();
    await expect(errors(page)).toBeFocused();
    await expect(errors(page)).toBeInViewport();
    await expect(regulation(page)).toBeInViewport();
    await expect(cta(page)).toBeInViewport();
  });

  test('participant.raffle-intro.c12 — registration closed comes before the type', async ({ page }) => {
    const fake = await open(page, { session: 'closed' });
    await ready(page);
    await regulation(page).check();
    await cta(page).click();
    await expect(errors(page)).toContainText('Înscrierile pentru tombolă nu mai sunt deschise.');
    expect(fake.joins).toEqual([]);
  });

  test('participant.raffle-intro.c12 — a session without types can never be joined', async ({ page }) => {
    const fake = await open(page, { session: 'no-types' });
    await ready(page);
    await expect(page.getByRole('group', { name: 'Alege tipul premiilor' })).toHaveCount(0);
    await expect(page.getByTestId('raffle-no-types')).toHaveText('Înscrierile nu sunt încă disponibile.');
    await regulation(page).check();
    await cta(page).click();
    await expect(errors(page)).toContainText('Te rugăm să alegi tipul premiilor (Crap, Feeder sau Răpitor).');
    expect(fake.joins).toEqual([]);
  });

  test('participant.raffle-intro.c13 — no phone: the phone dialog, saved, then join again', async ({ page }) => {
    const fake = await open(page, { noPhone: true }, 375);
    await ready(page);
    await regulation(page).check();
    await pickType(page, 'Crap');
    await cta(page).click();
    const dialog = page.getByRole('alertdialog', { name: 'Completează numărul de telefon' }).or(page.getByRole('dialog', { name: 'Completează numărul de telefon' }));
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Avem nevoie de numărul tău de telefon pentru a te contacta dacă câștigi.')).toBeVisible();
    const field = dialog.getByRole('textbox', { name: 'Număr de telefon' });
    await expect(field).toHaveAttribute('placeholder', '07xxxxxxxx');
    await dialog.getByRole('button', { name: 'Salvează' }).click();
    await expect(dialog.getByText('Introdu numărul de telefon')).toBeVisible();
    await field.fill('0712');
    await expect(dialog.getByText('Minim 7 caractere')).toBeVisible();
    await settle(page);
    await expectNoA11yViolations(page);
    await field.fill('0712345678');
    await dialog.getByRole('button', { name: 'Salvează' }).click();
    await expect(page.getByText('Număr salvat.')).toBeVisible();
    await expect(dialog).toBeHidden();
    expect(fake.profileWrites).toEqual([{ phone: '0712345678' }]);
    expect(fake.joins).toEqual([]); // fish: the user presses again
    await cta(page).click();
    await expect(page).toHaveURL(/\/tombola\/confirmare$/);
    expect(fake.joins).toEqual([{ typeKey: 'crap' }]);
  });

  test('participant.raffle-intro.c13 — a failed phone save toasts and keeps the dialog', async ({ page }) => {
    await open(page, { noPhone: true });
    await page.route('**/api/cms/user/profile', (route) =>
      route.request().method() === 'PATCH'
        ? route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ data: null, error: { status: 500, name: 'Error', message: 'Eroare la salvare.' } }) })
        : route.fallback(),
    );
    await ready(page);
    await regulation(page).check();
    await pickType(page, 'Crap');
    await cta(page).click();
    const dialog = page.getByRole('alertdialog', { name: 'Completează numărul de telefon' }).or(page.getByRole('dialog', { name: 'Completează numărul de telefon' }));
    await dialog.getByRole('textbox', { name: 'Număr de telefon' }).fill('0712345678');
    await dialog.getByRole('button', { name: 'Salvează' }).click();
    await expect(page.getByText('Eroare la salvare.')).toBeVisible();
    await expect(dialog).toBeVisible();
  });

  test('participant.raffle-intro.c14 c15 — join {typeKey}, multipart receipt, busy, confirmation; invalidations', async ({ page }) => {
    const fake = await open(page, { delayMs: 600 });
    await ready(page);
    await regulation(page).check();
    await pickType(page, 'Feeder');
    await page.getByTestId('receipt-gallery').setInputFiles({ name: 'bon.png', mimeType: 'image/png', buffer: PNG });
    await expect(page.getByRole('img', { name: 'Bonul fiscal ales' })).toBeVisible();
    const before = { ...fake.reads };
    await cta(page).click();
    await expect(cta(page)).toHaveAttribute('aria-busy', 'true');
    await expect(page).toHaveURL(/\/tombola\/confirmare$/);
    expect(fake.joins).toEqual([{ typeKey: 'feeder' }]);
    expect(fake.receipts).toHaveLength(1);
    expect(fake.receipts[0].contentType).toMatch(/^multipart\/form-data; boundary=/);
    expect(fake.receipts[0].body).toMatch(/name="files"; filename="bon\.(jpg|png)"/);
    // c15: join + upload invalidate the session and the participation (refetched while active).
    await expect.poll(() => fake.reads.participation).toBeGreaterThan(before.participation);
    expect(fake.reads.active).toBeGreaterThan(before.active);
  });

  test('participant.raffle-intro.c14 — a failed join shows the message', async ({ page }) => {
    const fake = await open(page, { joinStatus: 500 });
    await ready(page);
    await regulation(page).check();
    await pickType(page, 'Crap');
    await cta(page).click();
    await expect(errors(page)).toContainText('Nu am putut finaliza înscrierea. Te rugăm să încerci din nou.');
    await expect(page).toHaveURL(/\/tombola$/);
    expect(fake.joins).toHaveLength(1);
    expect(fake.receipts).toHaveLength(0);
  });

  test('participant.raffle-intro.c14 — a failed receipt upload: «Ești înscris, dar bonul…» over the confirmation', async ({ page }) => {
    const fake = await open(page, { receiptStatus: 500 });
    await ready(page);
    await regulation(page).check();
    await pickType(page, 'Crap');
    await page.getByTestId('receipt-gallery').setInputFiles({ name: 'bon.png', mimeType: 'image/png', buffer: PNG });
    await cta(page).click();
    // The join went through: a toast that says so (never «try again») and the confirmation, where a receipt is added.
    await expect(page.getByText('Ești înscris, dar bonul nu a putut fi încărcat. Îl poți adăuga de aici.')).toBeVisible();
    await expect(page.getByText('Nu am putut finaliza înscrierea. Te rugăm să încerci din nou.')).toHaveCount(0);
    await expect(page).toHaveURL(/\/tombola\/confirmare$/);
    expect(fake.joins).toEqual([{ typeKey: 'crap' }]);
    expect(fake.receipts).toHaveLength(1);
  });

  test('keyboard — types by arrows, checkbox by Space, CTA by Enter', async ({ page }) => {
    const fake = await open(page);
    await ready(page);
    await page.getByRole('radio', { name: /Crap/ }).focus();
    await page.keyboard.press('Space');
    await expect(page.getByRole('radio', { name: /Crap/ })).toBeChecked();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('radio', { name: /Feeder/ })).toBeChecked();
    await regulation(page).focus();
    await page.keyboard.press('Space');
    await expect(regulation(page)).toBeChecked();
    await page.keyboard.press('Tab'); // «Vezi regulament»
    await expect(page.getByRole('button', { name: 'Vezi regulament' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(cta(page)).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/tombola\/confirmare$/);
    expect(fake.joins).toEqual([{ typeKey: 'feeder' }]);
  });

  test('screenshots + axe at every width', async ({ page }) => {
    for (const width of [375, 768, 1280, 1440, 1920]) {
      await page.unrouteAll({ behavior: 'ignoreErrors' });
      await open(page, {}, width);
      await ready(page);
      await page.screenshot({ path: `${SHOTS}/intro-${width}.png`, fullPage: true });
      if (width === 375 || width === 1280) await expectNoA11yViolations(page);
      // the error card state
      await cta(page).click();
      await expect(errors(page)).toBeVisible();
      await page.screenshot({ path: `${SHOTS}/errors-${width}.png`, fullPage: width < 1024 ? false : true });
    }
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await open(page, { noPrizes: true, session: 'no-types' }, 375);
    await ready(page);
    await page.screenshot({ path: `${SHOTS}/static-no-types-375.png`, fullPage: true });
    expect(SESSION_ID).toBeTruthy();
  });
});
