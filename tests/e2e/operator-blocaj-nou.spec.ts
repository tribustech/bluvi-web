import { mkdirSync } from 'node:fs';
import { expect, test, type Page, type Route } from '@playwright/test';
import { deleteBlock, getLakeAvailability, getOwnedLakes, type LakeAvailability } from '@/core/booking';
import { getLakes } from '@/core/lakes';
import { createTestTransport } from '../transport';
import { expectNoA11yViolations } from './helpers/a11y';
import { BASE_URL } from './helpers/base-url';
import { collectConsoleErrors } from './helpers/console';
import { qaJwt, signIn } from './helpers/session';

/*
 * operator.blocaj-nou (/operator/[lakeId]/blocaje/nou, T6) — «Adaugă blocaj», fish
 * app/(app)/operator/[lakeId]/blocks.tsx (add mode) + features/operator/CreateBlockForm.tsx /
 * BlockCalendar.tsx, and operator.b.local-day (the calendar's day keys are device-local).
 *
 * REAL reads and writes on the LOCAL Chita Lake, which the QA user owns (owner 2026-10-08: local
 * writes are safe). The saves go to far-future months (20+ months ahead: no booking there, and the
 * paging spinner shows on the way), every created block is collected from the POST responses and
 * deleted through core deleteBlock in afterEach. Route mocks only for what the DB cannot give on
 * demand: a refused second POST (c18), a held POST (c15), a held / failed availability page (c6,
 * error state), and the America/Los_Angeles save of b.local-day (answered without a write).
 */

process.env.TZ = 'Europe/Bucharest';
test.use({ timezoneId: 'Europe/Bucharest', locale: 'ro-RO' });

const LAKE = 's84u55lo4n9z0emngozttt6e'; // local Chita Lake
const PATH = `/operator/${LAKE}/blocaje/nou`;
const LIST_PATH = `/operator/${LAKE}/blocaje`;
const AVAIL = /\/api\/cms\/feed\/lakes\/[^/]+\/availability/;
const POST_BLOCK = /\/api\/cms\/feed\/availability-blocks(\?|$)/;
const SHOTS = '.shots/operator-blocaj-nou';
const WIDTHS = [375, 1280, 1440, 1920] as const;
// The blocks list (operator.blocaje) ships in the same batch: until it lands, Anulează / Back / the
// close of a save may meet a 404 there — not this screen's defect.
const LIST_404 = /status of 404/;

const MONTHS = ['Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie', 'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie'];
const WD = ['Duminică', 'Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă'];
const MO = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'noi', 'dec'];
const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/** Local day `day` of the month `offset` months from now. */
const dayIn = (offset: number, day: number, hour = 0) => {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth() + offset, day, hour);
};
const keyIn = (offset: number, day: number) => ymd(dayIn(offset, day));
const monthTitle = (offset: number) => {
  const d = dayIn(offset, 1);
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};
/** fish dayLabel: «Vineri, 5 sep». */
const label = (d: Date) => `${WD[d.getDay()]}, ${d.getDate()} ${MO[d.getMonth()]}`;
const todayKey = () => ymd(new Date());
const addDays = (key: string, n: number) => {
  const [y, m, d] = key.split('-').map(Number);
  return ymd(new Date(y, m - 1, d + n));
};

let jwt: string;
let avail: LakeAvailability;
/** Blocks this test created (from the POST responses) — deleted in afterEach. */
let created: string[] = [];

test.beforeAll(async ({ request }) => {
  test.setTimeout(60_000);
  jwt = await qaJwt(request);
  avail = await getLakeAvailability(createTestTransport(jwt), LAKE);
  expect(avail.slotStartTimes).toEqual(['06:00', '18:00']);
  expect(avail.stands.length).toBeGreaterThan(2);
  mkdirSync(SHOTS, { recursive: true });
});

test.afterEach(async () => {
  const t = createTestTransport(jwt);
  for (const id of created) await deleteBlock(t, id).catch(() => undefined);
  created = [];
});

/* ------------------------------------------------------------------------------------------------
 * Page helpers
 * ---------------------------------------------------------------------------------------------- */

async function open(page: Page) {
  await signIn(page.context(), jwt);
  await page.goto(PATH);
  // The shared dev server may compile the route on the first visit.
  await expect(grid(page)).toBeVisible({ timeout: 45_000 });
}
const grid = (page: Page) => page.getByTestId('block-calendar-grid');
const title = (page: Page) => page.getByTestId('block-calendar-title');
const day = (page: Page, key: string) => grid(page).locator(`[data-day="${key}"]`);
const scope = (page: Page) => page.getByTestId('block-scope');
const selection = (page: Page) => page.getByTestId('block-selection');
const saveClose = (page: Page) => page.getByRole('button', { name: 'Salvează și închide' });
const saveAdd = (page: Page) => page.getByRole('button', { name: 'Salvează și adaugă altul' });
const cancel = (page: Page) => page.getByRole('button', { name: 'Anulează' });
const radio = (page: Page, group: string, name: string) => page.getByTestId(group).getByRole('radio', { name, exact: true });
const pickHour = async (page: Page, group: 'block-start-hours' | 'block-end-hours', t: string) => {
  await page.getByTestId(group).locator('label').filter({ hasText: t }).click();
};

/** › until the month `offset` is on screen (each step pages the availability in). */
async function goMonth(page: Page, offset: number) {
  const next = page.getByRole('button', { name: 'Luna următoare' });
  for (let i = 0; i < offset; i++) await next.click();
  await expect(title(page)).toHaveText(monthTitle(offset));
  await expect(page.getByTestId('block-calendar-spinner')).toHaveCount(0, { timeout: 20_000 });
}

type Body = { lake: string; stand?: string; startDate: string; endDate: string; reason: string; note?: string };
/** Records the POST bodies and the created ids (for afterEach). */
function recordPosts(page: Page) {
  const bodies: Body[] = [];
  page.on('request', (r) => {
    if (r.method() === 'POST' && POST_BLOCK.test(r.url())) bodies.push((r.postDataJSON() as { data: Body }).data);
  });
  page.on('response', async (r) => {
    if (r.request().method() !== 'POST' || !POST_BLOCK.test(r.url()) || !r.ok()) return;
    const json = (await r.json().catch(() => null)) as { data?: { documentId?: string } } | null;
    if (json?.data?.documentId) created.push(json.data.documentId);
  });
  return bodies;
}

async function shot(page: Page, name: string) {
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SHOTS}/${name}-${page.viewportSize()?.width}.png`, fullPage: true });
}

/* ------------------------------------------------------------------------------------------------
 * Signed out
 * ---------------------------------------------------------------------------------------------- */

test('signed out: a real 307 to /intra, coming back to the form', async ({ request }) => {
  const res = await request.get(`${BASE_URL}${PATH}`, { maxRedirects: 0 });
  expect(res.status()).toBe(307);
  const loc = new URL(res.headers().location, BASE_URL);
  expect(loc.pathname).toBe('/intra');
  expect(new URL(loc.searchParams.get('next')!, BASE_URL).pathname).toBe(PATH);
});

/* ------------------------------------------------------------------------------------------------
 * Signed in
 * ---------------------------------------------------------------------------------------------- */

test.describe('signed in', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test('c1 c2 c3 c4 c9 c11 c15: header, scope chips from the first page, the calendar, hours, reasons, buttons; Back and Anulează → the list', async ({ page }) => {
    const errors = collectConsoleErrors(page, { ignore: LIST_404 });
    await open(page);
    await expect(page.getByRole('heading', { level: 1, name: 'Adaugă blocaj' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'Adaugă blocaj' }).locator('..')).toContainText('Chita Lake');
    // c1: Back is a link to the blocks list.
    await expect(page.getByRole('link', { name: 'Înapoi la blocaje' })).toHaveAttribute('href', LIST_PATH);

    // c2 c3: «Tot lacul» + one chip per stand of the first availability page, in its order.
    const chips = scope(page).getByRole('button');
    await expect(chips).toHaveText(['Tot lacul', ...avail.stands.map((s) => s.name)]);
    const all = scope(page).getByRole('button', { name: 'Tot lacul' });
    await expect(all).toHaveAttribute('aria-pressed', 'true');
    const [s1, s2] = avail.stands;
    await scope(page).getByRole('button', { name: `Standul ${s1.name}`, exact: true }).click();
    await scope(page).getByRole('button', { name: `Standul ${s2.name}`, exact: true }).click();
    await expect(all).toHaveAttribute('aria-pressed', 'false');
    await expect(scope(page).getByRole('button', { name: `Standul ${s1.name}`, exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('block-summary')).toContainText(`Standurile ${s1.name}, ${s2.name}`);
    await expect(page.getByText('Se adaugă 2 blocaje, câte unul pe stand.')).toBeVisible();
    // A second tap unpicks; «Tot lacul» clears every stand.
    await scope(page).getByRole('button', { name: `Standul ${s2.name}`, exact: true }).click();
    await expect(page.getByTestId('block-summary')).toContainText(`Standul ${s1.name}`);
    await all.click();
    await expect(all).toHaveAttribute('aria-pressed', 'true');
    await expect(scope(page).locator('[aria-pressed="true"]')).toHaveCount(1);

    // c4: Monday-first header, today's month, ‹ off on it, › on.
    await expect(grid(page).getByRole('columnheader')).toHaveText(['Lu', 'Ma', 'Mi', 'Jo', 'Vi', 'Sâ', 'Du']);
    await expect(title(page)).toHaveText(monthTitle(0));
    await expect(page.getByRole('button', { name: 'Luna anterioară' })).toBeDisabled();
    await page.getByRole('button', { name: 'Luna următoare' }).click();
    await expect(title(page)).toHaveText(monthTitle(1));
    await expect(page.getByRole('button', { name: 'Luna anterioară' })).toBeEnabled();
    await page.getByRole('button', { name: 'Luna anterioară' }).click();
    await expect(title(page)).toHaveText(monthTitle(0));
    // The 1st sits under its weekday (Monday-first).
    const first = dayIn(0, 1);
    const firstCell = grid(page).getByRole('row').nth(1).locator('[role=gridcell]').nth((first.getDay() + 6) % 7);
    await expect(firstCell.locator('button')).toHaveText('1');

    // c9: 00:00 + tour starts / tour starts + 24:00, defaults 00:00 → 24:00.
    await expect(page.getByTestId('block-start-hours').getByRole('radio')).toHaveCount(3);
    await expect(page.getByTestId('block-start-hours').locator('label')).toHaveText(['00:00', '06:00', '18:00']);
    await expect(page.getByTestId('block-end-hours').locator('label')).toHaveText(['06:00', '18:00', '24:00']);
    await expect(radio(page, 'block-start-hours', '00:00')).toBeChecked();
    await expect(radio(page, 'block-end-hours', '24:00')).toBeChecked();

    // c11: four reasons, Închidere by default, no «Rezervare telefonică».
    await expect(page.getByTestId('block-reasons').locator('label')).toHaveText(['Concurs', 'Închidere', 'Întreținere', 'Altele']);
    await expect(radio(page, 'block-reasons', 'Închidere')).toBeChecked();
    await expect(page.getByText('Rezervare telefonică')).toHaveCount(0);

    // c12: the note field.
    const note = page.getByLabel('Notă (opțional)');
    await expect(note).toHaveAttribute('placeholder', 'Detalii suplimentare');

    // c15: the three buttons.
    await expect(saveClose(page)).toBeEnabled();
    await expect(saveAdd(page)).toBeEnabled();
    await expect(cancel(page)).toBeEnabled();
    await expectNoA11yViolations(page);
    for (const w of WIDTHS) {
      await page.setViewportSize({ width: w, height: 900 });
      await shot(page, 'empty');
    }
    await page.setViewportSize({ width: 1440, height: 900 });

    // c1: «Anulează» → the list.
    await cancel(page).click();
    await expect(page).toHaveURL(`${BASE_URL}${LIST_PATH}`, { timeout: 45_000 });
    expect(errors).toEqual([]);
  });

  test('c1: Back → the list', async ({ page }) => {
    await open(page);
    await page.getByRole('link', { name: 'Înapoi la blocaje' }).click();
    await expect(page).toHaveURL(`${BASE_URL}${LIST_PATH}`, { timeout: 45_000 });
  });

  test('c5 c7 c8 c10 b.local-day: colours, range picking, the summary line and «Blocat:»', async ({ page }) => {
    await open(page);
    const today = todayKey();
    // c5: today is pickable, yesterday (when in this month) is past: grey and off.
    await expect(day(page, today)).toHaveAttribute('aria-current', 'date');
    if (addDays(today, -1).slice(0, 7) === today.slice(0, 7)) {
      const y = day(page, addDays(today, -1));
      await expect(y).toHaveAttribute('data-status', 'past');
      await expect(y).toHaveAttribute('aria-disabled', 'true');
      await y.click({ force: true });
      await expect(selection(page)).toHaveText('Apasă ziua de început, apoi ziua de sfârșit.');
    }
    // Future days of a loaded month are green or red, never unknown.
    const statuses = await grid(page).locator('[data-day]').evaluateAll((els) =>
      els.map((e) => [e.getAttribute('data-day')!, e.getAttribute('data-status')!] as const),
    );
    for (const [k, s] of statuses) {
      if (k < today) expect(s).toBe('past');
      else expect(['free', 'busy']).toContain(s);
    }
    await expect(page.getByRole('list', { name: 'Legendă' })).toHaveText(/Liber\s*Ocupat/);

    // c7 c8 in a far month (no data there: all green).
    await goMonth(page, 20);
    const k = (d: number) => keyIn(20, d);
    await expect(day(page, k(10))).toHaveAttribute('data-status', 'free');
    await expect(selection(page)).toHaveText('Apasă ziua de început, apoi ziua de sfârșit.');
    await day(page, k(10)).click();
    await expect(selection(page)).toHaveText(`${label(dayIn(20, 10))} → apasă ziua de sfârșit (aceeași zi = o singură zi)`);
    await expect(day(page, k(10))).toHaveAttribute('data-status', 'selected');
    await expect(day(page, k(10)).locator('..')).toHaveAttribute('aria-selected', 'true');
    // fish: the first tap alone already asks for the end (validated on every period change).
    await expect(page.getByTestId('block-date-error')).toHaveText('Apasă și ziua de sfârșit (aceeași zi pentru o singură zi).');
    // A tap before the start restarts there.
    await day(page, k(8)).click();
    await expect(selection(page)).toHaveText(`${label(dayIn(20, 8))} → apasă ziua de sfârșit (aceeași zi = o singură zi)`);
    // The same day = one day.
    await day(page, k(8)).click();
    await expect(selection(page)).toHaveText(`${label(dayIn(20, 8))} → ${label(dayIn(20, 8))} · 1 zi`);
    await expect(page.getByTestId('block-interval')).toHaveText(`Blocat: ${label(dayIn(20, 8))} 00:00 – ${label(dayIn(20, 9))} 00:00`);
    await expect(page.getByTestId('block-date-error')).toHaveCount(0);
    // After a complete range a tap restarts; a later tap closes a multi-day range.
    await day(page, k(3)).click();
    await day(page, k(26)).click();
    await expect(selection(page)).toHaveText(`${label(dayIn(20, 3))} → ${label(dayIn(20, 26))} · 24 de zile`);
    await expect(grid(page).locator('[data-status="selected"]')).toHaveCount(24);
    // c9 c10: 06:00 on the start day → 18:00 on the end day.
    await pickHour(page, 'block-start-hours', '06:00');
    await pickHour(page, 'block-end-hours', '18:00');
    await expect(page.getByTestId('block-interval')).toHaveText(`Blocat: ${label(dayIn(20, 3))} 06:00 – ${label(dayIn(20, 26))} 18:00`);
    // b.local-day: the summary card says the same device-local period.
    await expect(page.getByTestId('block-summary')).toContainText(`${label(dayIn(20, 3))} 06:00 – ${label(dayIn(20, 26))} 18:00`);
    await expect(page.getByTestId('block-summary')).toContainText('24 de zile');
    await expectNoA11yViolations(page);
    for (const w of WIDTHS) {
      await page.setViewportSize({ width: w, height: 900 });
      await shot(page, 'range');
    }
  });

  test('c6: a month not loaded yet pages the availability in, with a spinner beside its name; its days stay neutral meanwhile', async ({ page }) => {
    await open(page);
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    await page.route(AVAIL, async (r: Route) => {
      await gate;
      await r.fallback();
    });
    await page.getByRole('button', { name: 'Luna următoare' }).click();
    await expect(title(page)).toHaveText(monthTitle(1));
    const spinner = page.getByTestId('block-calendar-spinner');
    await expect(spinner).toBeVisible();
    await expect(spinner).toHaveText('Se încarcă luna…');
    await expect(grid(page)).toHaveAttribute('aria-busy', 'true');
    // Rule 4: never a green it may not be.
    await expect(day(page, keyIn(1, 15))).toHaveAttribute('data-status', 'unknown');
    await page.setViewportSize({ width: 375, height: 800 });
    await page.getByTestId('block-calendar').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${SHOTS}/month-loading-375.png` });
    await page.setViewportSize({ width: 1440, height: 900 });
    await expectNoA11yViolations(page);
    release();
    await expect(spinner).toHaveCount(0);
    await expect(day(page, keyIn(1, 15))).toHaveAttribute('data-status', /free|busy/);
    // A failed month page: neutral days, a retry line.
    await page.unroute(AVAIL);
    let fail = true;
    await page.route(AVAIL, async (r: Route) => (fail ? r.fulfill({ status: 500, body: '{}' }) : r.fallback()));
    await page.getByRole('button', { name: 'Luna următoare' }).click();
    await expect(page.getByText(`Nu am putut încărca ocuparea pentru ${monthTitle(2).toLowerCase()}.`)).toBeVisible({ timeout: 20_000 });
    await expect(day(page, keyIn(2, 15))).toHaveAttribute('data-status', 'unknown');
    fail = false;
    await page.getByRole('button', { name: 'Reîncearcă' }).click();
    await expect(day(page, keyIn(2, 15))).toHaveAttribute('data-status', /free|busy/);
  });

  test('c16 c17 c19: a whole-lake block (Salvează și adaugă altul) then a 2-stand block (Salvează și închide), real writes', async ({ page }) => {
    const bodies = recordPosts(page);
    await open(page);
    await goMonth(page, 21);
    const k = (d: number) => keyIn(21, d);
    await page.getByLabel('Notă (opțional)').fill('  Test e2e blocaj nou  ');
    await page.getByTestId('block-reasons').locator('label').filter({ hasText: 'Întreținere' }).click();
    await day(page, k(10)).click();
    await day(page, k(11)).click();
    await saveAdd(page).click();
    await expect(page.getByText('Blocaj adăugat', { exact: true })).toBeVisible();
    // c16: one whole-lake POST, device-local midnights, trimmed note.
    expect(bodies).toEqual([
      {
        lake: LAKE,
        startDate: dayIn(21, 10).toISOString(),
        endDate: dayIn(21, 12).toISOString(),
        reason: 'maintenance',
        note: 'Test e2e blocaj nou',
      },
    ]);
    // c17: the period resets (range and hours), scope / reason / note stay.
    await expect(selection(page)).toHaveText('Apasă ziua de început, apoi ziua de sfârșit.');
    await expect(page.getByTestId('block-interval')).toHaveCount(0);
    await expect(radio(page, 'block-start-hours', '00:00')).toBeChecked();
    await expect(radio(page, 'block-end-hours', '24:00')).toBeChecked();
    await expect(radio(page, 'block-reasons', 'Întreținere')).toBeChecked();
    await expect(page.getByLabel('Notă (opțional)')).toHaveValue('  Test e2e blocaj nou  ');
    await expect(page).toHaveURL(`${BASE_URL}${PATH}`);
    // c19 + c5: the availability is refetched — the blocked days turn red.
    await expect(day(page, k(10))).toHaveAttribute('data-status', 'busy', { timeout: 20_000 });
    await expect(day(page, k(11))).toHaveAttribute('data-status', 'busy');
    await expect(day(page, k(12))).toHaveAttribute('data-status', 'free');
    await shot(page, 'after-save-add');

    // c16 c17: two stands, in pick order, 06:00 → 18:00, then the list.
    const [a, b] = [avail.stands[2], avail.stands[1]];
    await scope(page).getByRole('button', { name: `Standul ${a.name}`, exact: true }).click();
    await scope(page).getByRole('button', { name: `Standul ${b.name}`, exact: true }).click();
    await day(page, k(20)).click();
    await day(page, k(21)).click();
    await pickHour(page, 'block-start-hours', '06:00');
    await pickHour(page, 'block-end-hours', '18:00');
    await saveClose(page).click();
    await expect(page.getByText('2 blocaje adăugate', { exact: true })).toBeVisible();
    await expect(page).toHaveURL(`${BASE_URL}${LIST_PATH}`, { timeout: 45_000 });
    const base = { lake: LAKE, startDate: dayIn(21, 20, 6).toISOString(), endDate: dayIn(21, 21, 18).toISOString(), reason: 'maintenance', note: 'Test e2e blocaj nou' };
    expect(bodies.slice(1)).toEqual([
      { ...base, stand: a.documentId },
      { ...base, stand: b.documentId },
    ]);
    await expect.poll(() => created.length).toBe(3);
  });

  test('c13 c14 c12: validation under the calendar, a rejected save toasts the first field and brings the calendar into view', async ({ page }) => {
    const bodies = recordPosts(page);
    await page.setViewportSize({ width: 375, height: 760 });
    await open(page);
    const calendar = page.getByTestId('block-calendar');
    // Nothing picked: «Alege data de început.» — the calendar comes back into view.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(calendar).not.toBeInViewport();
    await saveClose(page).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Alege data de început.' }).first()).toBeVisible();
    await expect(page.getByTestId('block-date-error')).toHaveText('Alege data de început.');
    await expect(calendar).toBeInViewport();
    await shot(page, 'error-empty');
    await expectNoA11yViolations(page);

    // A start only: the toast asks for the end day.
    await goMonth(page, 20);
    await day(page, keyIn(20, 5)).click();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await saveAdd(page).click();
    await expect(page.getByText('Apasă și ziua de sfârșit (aceeași zi pentru o singură zi).').first()).toBeVisible();
    await expect(page.getByTestId('block-date-error')).toHaveText('Apasă și ziua de sfârșit (aceeași zi pentru o singură zi).');
    await expect(calendar).toBeInViewport();

    // One day, 18:00 → 06:00: end before start.
    await day(page, keyIn(20, 5)).click();
    await pickHour(page, 'block-start-hours', '18:00');
    await pickHour(page, 'block-end-hours', '06:00');
    await expect(page.getByTestId('block-date-error')).toHaveText('Data de sfârșit trebuie să fie după data de început.');
    await pickHour(page, 'block-end-hours', '24:00');
    await expect(page.getByTestId('block-date-error')).toHaveCount(0);

    // c12: a 501-character note.
    await page.getByLabel('Notă (opțional)').fill('x'.repeat(501));
    await saveClose(page).click();
    await expect(page.getByText('Nota poate avea cel mult 500 de caractere.').first()).toBeVisible();
    await expect(page.getByLabel('Notă (opțional)')).toHaveAttribute('aria-invalid', 'true');
    await page.getByLabel('Notă (opțional)').fill('x'.repeat(500));
    await expect(page.getByLabel('Notă (opțional)')).not.toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByText('500 / 500')).toBeVisible();

    // In the past: today 00:00 → 06:00 once 06:00 has gone by.
    if (new Date().getHours() >= 6) {
      await open(page);
      await day(page, todayKey()).click();
      await day(page, todayKey()).click();
      await pickHour(page, 'block-start-hours', '00:00');
      await pickHour(page, 'block-end-hours', '06:00');
      await expect(page.getByTestId('block-date-error')).toHaveText('Perioada trebuie să fie în viitor.');
      await saveClose(page).click();
      await expect(page.getByText('Perioada trebuie să fie în viitor.')).toHaveCount(2);
      await shot(page, 'error-past');
    }
    expect(bodies).toEqual([]);
  });

  test('c15 c18: buttons off while saving; a refused second stand keeps the first, toast «1 din 2 blocaje adăugate.»; a refusal without a code → fallback', async ({ page }) => {
    const bodies = recordPosts(page);
    await open(page);
    await goMonth(page, 22);
    const [a, b] = avail.stands;
    await scope(page).getByRole('button', { name: `Standul ${a.name}`, exact: true }).click();
    await scope(page).getByRole('button', { name: `Standul ${b.name}`, exact: true }).click();
    await day(page, keyIn(22, 14)).click();
    await day(page, keyIn(22, 14)).click();

    let n = 0;
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    await page.route(POST_BLOCK, async (r: Route) => {
      n += 1;
      if (n === 1) return r.fallback(); // the first stand: a REAL write
      await gate; // c15: the second is held…
      return r.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: { status: 400, message: 'Intervalul se suprapune cu o rezervare.', details: { bluCode: 'BLOCK_CONFLICTS_BOOKING' } } }),
      });
    });
    await saveClose(page).click();
    await expect.poll(() => n).toBe(2);
    await expect(saveClose(page)).toBeDisabled();
    await expect(saveAdd(page)).toBeDisabled();
    await expect(cancel(page)).toBeDisabled();
    await expect(saveClose(page)).toHaveAttribute('aria-busy', 'true');
    await expect(scope(page).getByRole('button').first()).toBeDisabled();
    await shot(page, 'saving');
    release();
    await expect(
      page.getByText('1 din 2 blocaje adăugate. Intervalul se suprapune cu o rezervare. Am păstrat doar standurile rămase.', { exact: true }),
    ).toBeVisible();
    await expect(page).toHaveURL(`${BASE_URL}${PATH}`);
    await expect(saveClose(page)).toBeEnabled();
    expect(bodies.map((x) => x.stand)).toEqual([a.documentId, b.documentId]);
    await expect.poll(() => created.length).toBe(1);
    // The saved stand left the selection; the failed one stays picked.
    await expect(scope(page).getByRole('button', { name: `Standul ${a.name}`, exact: true })).toHaveAttribute('aria-pressed', 'false');
    await expect(scope(page).getByRole('button', { name: `Standul ${b.name}`, exact: true })).toHaveAttribute('aria-pressed', 'true');
    await shot(page, 'partial-failure');

    // A retry POSTs only the stand that failed (never a duplicate of the saved one).
    await saveClose(page).click();
    await expect.poll(() => bodies.length).toBe(3);
    expect(bodies[2].stand).toBe(b.documentId);
    await expect(page.getByText('Intervalul se suprapune cu o rezervare.', { exact: true })).toBeVisible();
    expect(created).toHaveLength(1);

    // No code: the server's sentence is not shown — fish's fallback.
    await page.unroute(POST_BLOCK);
    await page.route(POST_BLOCK, (r: Route) => r.fulfill({ status: 500, contentType: 'application/json', body: '{"error":{"status":500,"message":"boom"}}' }));
    await scope(page).getByRole('button', { name: 'Tot lacul' }).click();
    await saveClose(page).click();
    await expect(page.getByText('Nu am putut adăuga blocajul.', { exact: true })).toBeVisible();
    await expect(page).toHaveURL(`${BASE_URL}${PATH}`);
  });

  test('c0 role-gating: a lake the viewer does not own shows «Nu ai acces» instead of the form, and sends no POST', async ({ page }) => {
    const t = createTestTransport(jwt);
    const owned = new Set((await getOwnedLakes(t)).map((l) => l.documentId));
    const foreign = (await getLakes(t, { pageSize: 50 })).data.find((l) => !owned.has(l.documentId));
    expect(foreign, 'a local lake the QA user does not own').toBeTruthy();
    const posts: string[] = [];
    page.on('request', (r) => {
      if (r.method() === 'POST' && POST_BLOCK.test(r.url())) posts.push(r.url());
    });
    await signIn(page.context(), jwt);
    await page.goto(`/operator/${foreign!.documentId}/blocaje/nou`);
    await expect(page.getByText('Nu ai acces', { exact: true })).toBeVisible({ timeout: 45_000 });
    await expect(grid(page)).toHaveCount(0);
    await expect(scope(page)).toHaveCount(0);
    await expect(saveClose(page)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Deconectează-te' })).toHaveCount(0);
    await shot(page, 'not-owned');
    await expectNoA11yViolations(page);
    expect(posts).toEqual([]);
  });

  test('keyboard: the calendar is one tab stop, arrows / PageDown move, Enter picks', async ({ page }) => {
    await open(page);
    const today = todayKey();
    await day(page, today).focus();
    await expect(day(page, today)).toHaveAttribute('tabindex', '0');
    await expect(grid(page).locator('[tabindex="0"]')).toHaveCount(1);
    await page.keyboard.press('ArrowRight');
    await expect(day(page, addDays(today, 1))).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(day(page, addDays(today, 8))).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(day(page, addDays(today, 8)).locator('..')).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('PageDown');
    await expect(title(page)).toHaveText(monthTitle(addDays(today, 8).slice(0, 7) === today.slice(0, 7) ? 1 : 2));
    await expect(grid(page).locator(':focus')).toHaveCount(1);
    await page.keyboard.press(' ');
    await expect(selection(page)).toContainText(' · ');
    // PageUp never goes before this month.
    for (let i = 0; i < 4; i++) await page.keyboard.press('PageUp');
    await expect(title(page)).toHaveText(monthTitle(0));
  });

  test('loading and error: the first page held shows the skeleton; a failed one the error state with retry', async ({ page }) => {
    let mode: 'hold' | 'fail' | 'pass' = 'hold';
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    await signIn(page.context(), jwt);
    await page.route(AVAIL, async (r: Route) => {
      if (mode === 'hold') await gate;
      if (mode === 'fail') return r.fulfill({ status: 500, contentType: 'application/json', body: '{"error":{"status":500,"message":"x"}}' });
      return r.fallback();
    });
    await page.goto(PATH);
    await expect(page.getByRole('heading', { level: 1, name: 'Adaugă blocaj' })).toBeVisible({ timeout: 45_000 });
    await expect(page.getByText('Se încarcă calendarul bălții…')).toBeAttached();
    await expect(saveClose(page)).toBeDisabled();
    for (const w of WIDTHS) {
      await page.setViewportSize({ width: w, height: 900 });
      await shot(page, 'loading');
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await expectNoA11yViolations(page);
    mode = 'fail';
    release();
    await expect(page.getByRole('button', { name: 'Încearcă din nou' })).toBeVisible({ timeout: 30_000 });
    for (const w of WIDTHS) {
      await page.setViewportSize({ width: w, height: 900 });
      await shot(page, 'error');
    }
    await expectNoA11yViolations(page);
    mode = 'pass';
    await page.getByRole('button', { name: 'Încearcă din nou' }).click();
    await expect(grid(page)).toBeVisible({ timeout: 20_000 });
  });
});

test.describe('another time zone', () => {
  test.use({ timezoneId: 'America/Los_Angeles' });

  test('b.local-day: a day picked in Los Angeles is that day\'s local midnight there (never a UTC day key)', async ({ page }) => {
    const errors = collectConsoleErrors(page, { ignore: LIST_404 });
    const bodies: Body[] = [];
    await page.setViewportSize({ width: 1440, height: 900 });
    await signIn(page.context(), jwt);
    await page.route(POST_BLOCK, async (r: Route) => {
      const body = (r.request().postDataJSON() as { data: Body }).data;
      bodies.push(body);
      // Answered without a write (this zone's block would be a real one otherwise).
      await r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { documentId: 'fake', startDate: body.startDate, endDate: body.endDate, reason: body.reason, standKey: null } }),
      });
    });
    await page.goto(PATH);
    await expect(grid(page)).toBeVisible({ timeout: 45_000 });
    await goMonth(page, 20);
    // The browser's own day keys (LA): the 9th of the month on screen.
    const key = await page.evaluate(() => {
      const t = new Date();
      const d = new Date(t.getFullYear(), t.getMonth() + 20, 9);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-09`;
    });
    await day(page, key).click();
    await day(page, key).click();
    const expected = await page.evaluate((k) => {
      const [y, m, d] = k.split('-').map(Number);
      return { start: new Date(y, m - 1, d).toISOString(), end: new Date(y, m - 1, d + 1).toISOString(), wd: new Date(y, m - 1, d).getDay() };
    }, key);
    await expect(page.getByTestId('block-interval')).toContainText(`Blocat: ${WD[expected.wd]}, 9 `);
    await saveClose(page).click();
    await expect(page).toHaveURL(`${BASE_URL}${LIST_PATH}`, { timeout: 45_000 });
    expect(bodies).toEqual([{ lake: LAKE, startDate: expected.start, endDate: expected.end, reason: 'closure' }]);
    // LA midnight is 07:00 or 08:00 UTC — the same calendar day, not the previous one.
    expect(expected.start.slice(0, 10)).toBe(key);
    expect(errors).toEqual([]);
  });
});
