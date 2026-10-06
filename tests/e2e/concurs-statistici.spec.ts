import { collectConsoleErrors } from './helpers/console';
import { expectNoA11yViolations } from './helpers/a11y';
import { qaJwt, signIn } from './helpers/session';
import { expect, test, type Page } from '@playwright/test';

/*
 * Concurs · the Clasament views and their surfaces — parity docs/parity/areas/competition-page.yml:
 * cantare, cantar-detaliu, statistici, toti-pestii, statistici-pescar, cronologie (M1 batch 3).
 * Local CMS on :1337; override the ids with E2E_STATS_* when the local data moves.
 */

const ID = {
  /** completed nationalChampionship, 3 sectors; stand A1's weighing was reopened once (a revision). */
  nc: process.env.E2E_STATS_NC ?? 'z7rvhm55ziyr0tbblqwjp39q',
  ncWeighing: process.env.E2E_STATS_NC_WEIGHING ?? 'fuqluwe496abmszwt4yh6ao4',
  ncStand: process.env.E2E_STATS_NC_STAND ?? 'ahs6zl0lu3dqj5jy9ep8bu7d',
  /** completed quantity, 114 weighings over 3 days (9 sessions with extras), 389 catches, no timeline snapshot. */
  rich: process.env.E2E_STATS_RICH ?? 'i8kzbi5k51vmbyq75dmyez3d',
  /** its registration with a Bluvi account (A1) and a guest one («Lala», A7). */
  richAngler: process.env.E2E_STATS_RICH_ANGLER ?? 'tx2r8udyq17bg8qubli055ru',
  richGuest: process.env.E2E_STATS_RICH_GUEST ?? 'r79jk8gw83ze85c9z2df3zsw',
  /** started quantity, 24 sectors × 1 stand, a timeline snapshot. */
  live: process.env.E2E_STATS_LIVE ?? 'kee49a3e64b3f636b4b60daa',
  /** completed quality competition holding a weighing still in progress (stand A1). */
  openWeighing: process.env.E2E_STATS_OPEN ?? '0dab75714142e797e26304aa',
  openWeighingId: process.env.E2E_STATS_OPEN_WEIGHING ?? 'f0f9de2bbe2b58acd8038a58',
  openStand: process.env.E2E_STATS_OPEN_STAND ?? '5d8e24df4ec6b06a5a002082',
  /** completed feeder team: crews entered without Bluvi accounts. */
  feederTeam: process.env.E2E_STATS_FEEDER ?? 'rg340d4r4gnwf2mbyhxvasnr',
  /** completed, one angler, not one catch and not one weighing. */
  noCatch: process.env.E2E_STATS_NO_CATCH ?? 'cij4qvadptzehubw4jwa2e8g',
  /** notStarted, the QA user's own. */
  upcoming: process.env.E2E_STATS_UPCOMING ?? 'a6xjl65ooe9eadrtvvqj9hn1',
};

const PHONE = { width: 375, height: 812 };
/** Below 1280 Cântare keeps the stand cards (the table is the ≥1280 layout, owner rule 14). */
const TABLET = { width: 1279, height: 900 };
const DESKTOP = { width: 1440, height: 900 };
/** The narrowest table: with the detail docked beside it. */
const LAPTOP = { width: 1280, height: 900 };
const WIDE = { width: 1920, height: 1080 };

test.describe.configure({ timeout: 120_000 });

async function open(page: Page, path: string, viewport = DESKTOP) {
  await page.setViewportSize(viewport);
  // A 403 the local CMS answers for a grant it lacks is the browser's own network log line.
  const errors = collectConsoleErrors(page, { ignore: /Failed to load resource/ });
  const res = await page.goto(path, { waitUntil: 'domcontentloaded' });
  expect(res?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 45_000 });
  // Wait for React to own the page (a press before hydration does nothing).
  await page.waitForFunction(() => !!document.querySelector('h1') && Object.keys(document.querySelector('h1')!).some(k => k.startsWith('__react')), null, {
    timeout: 60_000,
  });
  return errors;
}

/** Presses until it takes (a press before hydration does nothing). */
async function press(page: Page, locator: ReturnType<Page['locator']>, done: () => Promise<void>) {
  await expect(async () => {
    await locator.click();
    await done();
  }).toPass({ timeout: 60_000 });
}

/** The panel / sheet slides in: let it settle before axe reads the colours. */
const settle = (page: Page) => page.waitForTimeout(800);

async function signedIn(page: Page) {
  await signIn(page.context(), await qaJwt(page.request));
}

/* ------------------------------------------------------------------ */
/* Cântare + weighing detail                                           */
/* ------------------------------------------------------------------ */

test('competition-page.cantare.c1 c3 c4 c5 c6 competition-page.cantare.s1 s2 s5 — below 1280: NC stand cards, one open at a time, its weighings', async ({ page }) => {
  await signedIn(page);
  await open(page, `/concursuri/${ID.nc}/cantare`, TABLET);
  // c1: one section per sector, one card per stand; c3: «Stand A1» (NC draw label without a draw).
  await expect(page.getByRole('heading', { name: 'Sector A', level: 2 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Sector C', level: 2 })).toBeVisible();
  const stand = page.getByRole('button', { name: /^Stand A1 / });
  await expect(stand).toContainText('Cici');
  // c4: the closed card's total and counts from the summary, at the competition's precision (the
  // national championship prints three decimals, as its summary tiles).
  await expect(stand).toContainText('34,700 kg');
  await expect(page.getByText('Cântare:').first()).toBeVisible();
  await expect(page.getByText('Extra-cântare:').first()).toBeVisible();
  // c5: open one stand, then another: only one open at a time.
  await stand.click();
  await expect(stand).toHaveAttribute('aria-expanded', 'true');
  const a4 = page.getByRole('button', { name: /^Stand A4 / });
  await a4.click();
  await expect(stand).toHaveAttribute('aria-expanded', 'false');
  await stand.click();
  // c6: the weighing item.
  const item = page.getByRole('button', { name: /Cântar 1/ });
  await expect(item).toContainText('Terminat');
  await expect(item).toContainText('Total:');
  await expect(item).toContainText('Capturi:');
  // c7: below 1280 the detail is a dialog over the page.
  await item.click();
  await expect(page.getByRole('dialog', { name: 'Detaliu cântar' })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`cantar=${ID.ncWeighing}&stand=${ID.ncStand}`));
});

test('competition-page.cantare.c1 c3 c4 c7 competition-page.cantar-detaliu.c1 c2 c3 c4 c7 c8 c9 c10 competition-page.cantar-detaliu.s2 s3 s5 — from 1280: every weighing in one table (owner rule 14), a row opens the docked detail, its history', async ({ page }) => {
  await signedIn(page);
  const errors = await open(page, `/concursuri/${ID.nc}/cantare`);
  const table = page.getByRole('table', { name: /Cântarele concursului/ });
  // Every column visible, on the coloured header row.
  for (const col of ['Stand', 'Pescar', 'Cântar', 'Interval', 'Capturi', 'Kg', 'Stare']) await expect(table.getByRole('columnheader', { name: col, exact: true })).toBeVisible();
  const header = table.getByRole('columnheader', { name: 'Stand', exact: true });
  expect(await header.evaluate(el => getComputedStyle(el).backgroundColor)).not.toBe(await page.evaluate(() => getComputedStyle(document.body).backgroundColor));
  // c1: the sectors as row groups; no stand cards.
  await expect(table.getByRole('columnheader', { name: /^Sector A/ })).toBeVisible();
  await expect(table.getByRole('columnheader', { name: /^Sector C/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Stand A1 / })).toHaveCount(0);
  // c3 / c4: the stand, its angler and kg («kg» apart from the number; one weighing: no «Total stand» line), the weighing's cells.
  const row = table.getByRole('row').filter({ has: page.getByRole('rowheader', { name: /Stand A1$/ }) });
  await expect(row).toContainText('Cici');
  await expect(row).toContainText(/34,700\s*kg/);
  await expect(row).not.toContainText('Total');
  await expect(row).toContainText('Terminat');
  // c7 / cantar-detaliu.c1: the row's «Cântar 1» opens the detail docked beside the table.
  const item = row.getByRole('button', { name: 'Cântar 1' });
  await item.click();
  const panel = page.getByRole('complementary', { name: 'Detaliu cântar' });
  await expect(panel).toBeVisible();
  await expect(item).toHaveAttribute('aria-current', 'true');
  await expect(page).toHaveURL(new RegExp(`cantar=${ID.ncWeighing}&stand=${ID.ncStand}`));
  // c2: the stand label, its participant.
  await expect(panel.getByText('Stand A1', { exact: true })).toBeVisible();
  await expect(panel.getByRole('listitem').filter({ hasText: 'Cici' })).toBeVisible();
  // c3: a single weighing.
  await expect(panel.getByText('Cântar 1 / 1')).toBeVisible();
  // c4 / c7: total, state, the catches «N. specie: kg».
  await expect(panel.getByText(/Total: 34,700 kg/)).toBeVisible();
  await expect(panel.getByText('Terminat')).toBeVisible();
  await expect(panel.getByRole('listitem').filter({ hasText: /^1\.\s*Caras: / })).toBeVisible();
  // c8: the revision line and «Vezi istoric» (finished).
  await expect(panel.getByRole('button', { name: 'Acest cântar a avut o modificare.' })).toBeVisible();
  await settle(page);
  await expectNoA11yViolations(page);
  // c9: the history, read only now; back to the weighing.
  const revisions = page.waitForRequest(r => r.url().includes('/weighing-logs'));
  await panel.getByRole('button', { name: 'Vezi istoric' }).click();
  await revisions;
  await expect(panel.getByRole('heading', { name: 'Istoric modificări' })).toBeVisible();
  await expect(panel.getByText(/Modificarea 1 \[de /)).toBeVisible();
  await expect(panel.getByText(/Redeschis la/)).toBeVisible();
  await panel.getByRole('button', { name: 'Înapoi la cântar' }).click();
  await expect(panel.getByText('Cântar 1 / 1')).toBeVisible();
  // Back from the history, focus returns to the control that opened it (never <body>).
  await expect(panel.getByRole('button', { name: 'Vezi istoric' })).toBeFocused();
  // c10: closing removes the params.
  await panel.getByRole('button', { name: 'Închide' }).click();
  await expect(panel).toBeHidden();
  await expect(page).not.toHaveURL(/cantar=/);
  expect(errors).toEqual([]);
});

test('competition-page.cantare.c2 c5 — from 1280, signed in: only the stands the summary lists are read; «Cronologic» puts the newest weighing first', async ({ page }) => {
  await signedIn(page);
  const byStand: string[] = [];
  page.on('request', r => {
    if (r.url().includes('/feed/weighings/by-stand')) byStand.push(r.url());
  });
  await open(page, `/concursuri/${ID.live}/cantare`);
  const table = page.getByRole('table', { name: /Cântarele concursului/ });
  await expect(table.getByText('Niciun cântar încă').first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/· 24 standuri$/)).toBeVisible();
  expect(byStand.length).toBeLessThan(24);
  // The timeline: the starts read newest first.
  await page.getByRole('button', { name: 'Cronologic' }).click();
  await expect(page.getByRole('button', { name: 'Cronologic' })).toHaveAttribute('aria-pressed', 'true');
  await open(page, `/concursuri/${ID.rich}/cantare`);
  await page.getByRole('button', { name: 'Cronologic' }).click();
  const rich = page.getByRole('table', { name: /ordine cronologică/ });
  // A timeline row is named by its place in the competition («#114» the newest), not «Cântar 1» of its stand.
  await expect(rich.getByRole('button', { name: /^Cântarul #\d+$/ }).first()).toBeVisible({ timeout: 30_000 });
  await expect(rich.getByRole('button', { name: /^Cântar \d+$/ })).toHaveCount(0);
  await expect(page.getByText(/^114 cântare/)).toBeVisible({ timeout: 30_000 });
  const starts = await rich.locator('tbody tr td:nth-child(4)').allInnerTexts();
  const key = (t: string) => {
    const m = t.match(/^(\d\d)\.(\d\d), (\d\d):(\d\d)/);
    return m ? `${m[2]}${m[1]}${m[3]}${m[4]}` : '';
  };
  const keys = starts.map(key).filter(Boolean);
  expect(keys.length).toBeGreaterThan(100);
  expect([...keys].sort().reverse()).toEqual(keys);
  await expect(rich.getByRole('button', { name: 'Cântarul #114' })).toBeVisible();
});

test('competition-page.cantare.c1 c7 — 1280 with the detail docked: every column stays in the table’s box (no sideways scroll); the open row is marked on every cell', async ({ page }) => {
  await signedIn(page);
  await open(page, `/concursuri/${ID.nc}/cantare`, LAPTOP);
  const table = page.getByRole('table', { name: /Cântarele concursului/ });
  const row = table.getByRole('row').filter({ has: page.getByRole('rowheader', { name: /Stand A1$/ }) });
  const panel = page.getByRole('complementary', { name: 'Detaliu cântar' });
  await press(page, row.getByRole('button', { name: 'Cântar 1' }), () => expect(panel).toBeVisible({ timeout: 3000 }));
  await settle(page);
  const box = page.locator('[data-weighings-scroll]');
  const { scrollWidth, clientWidth } = await box.evaluate(el => ({ scrollWidth: el.scrollWidth, clientWidth: el.clientWidth }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  for (const col of ['Capturi', 'Kg', 'Stare']) await expect(table.getByRole('columnheader', { name: col, exact: true })).toBeInViewport();
  // The interval on two lines (the day, then the hours).
  const lines = await row
    .locator('td')
    .nth(2)
    .evaluate(el => [...el.children].map(c => ({ h: c.getBoundingClientRect().height, lh: parseFloat(getComputedStyle(c).lineHeight) })));
  expect(lines).toHaveLength(2);
  for (const { h, lh } of lines) expect(h).toBeLessThan(lh * 1.5);
  // A one-weighing stand: the stand and angler cells take the mark too (not only from Cântar on).
  const bg = (l: ReturnType<Page['locator']>) => l.evaluate(el => getComputedStyle(el).backgroundColor);
  const marked = await bg(row.locator('td').nth(1));
  expect(await bg(row.getByRole('rowheader'))).toBe(marked);
  expect(await bg(row.locator('td').first())).toBe(marked);
});

test('competition-page.cantare.c1 c7 — 1440 at rest: the side column is there before any press (Rezumat cântare: the counts, the latest weighing); a press replaces it with the detail, closing brings it back; 1280 keeps it for the press', async ({ page }) => {
  await signedIn(page);
  await open(page, `/concursuri/${ID.nc}/cantare`);
  const rest = page.getByRole('complementary', { name: 'Rezumat cântare' });
  await expect(rest).toBeVisible();
  await expect(rest.getByText('Cântare', { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(rest.getByRole('button', { name: /Stand A\d/ }).first()).toBeVisible();
  // The kg apart from its number (owner rule 10).
  await expect(rest.getByText('kg', { exact: true }).first()).toBeVisible();
  const restBox = (await rest.boundingBox())!;
  const table = page.getByRole('table', { name: /Cântarele concursului/ });
  const tableWidth = (await table.boundingBox())!.width;
  // Pressing the latest weighing opens its detail in the same column: the table does not move.
  await rest.getByRole('button', { name: /Stand A\d/ }).last().click();
  const panel = page.getByRole('complementary', { name: 'Detaliu cântar' });
  await expect(panel).toBeVisible();
  await expect(rest).toBeHidden();
  const panelBox = (await panel.boundingBox())!;
  expect(Math.abs(panelBox.x - restBox.x)).toBeLessThan(2);
  expect(Math.abs((await table.boundingBox())!.width - tableWidth)).toBeLessThan(2);
  await settle(page);
  await expectNoA11yViolations(page);
  await panel.getByRole('button', { name: 'Închide' }).click();
  await expect(rest).toBeVisible();
  // 1280: the table needs the width; the column comes with a press only.
  await page.setViewportSize(LAPTOP);
  await expect(rest).toBeHidden();
});

test('competition-page.cantare.c1 — 1920 with the detail docked: the interval stays on one line and the angler column stops at 28rem (the numbers stay near the names)', async ({ page }) => {
  await signedIn(page);
  await open(page, `/concursuri/${ID.nc}/cantare`, WIDE);
  const table = page.getByRole('table', { name: /Cântarele concursului/ });
  const row = table.getByRole('row').filter({ has: page.getByRole('rowheader', { name: /Stand A1$/ }) });
  const panel = page.getByRole('complementary', { name: 'Detaliu cântar' });
  await press(page, row.getByRole('button', { name: 'Cântar 1' }), () => expect(panel).toBeVisible({ timeout: 3000 }));
  await settle(page);
  const interval = row.locator('td').nth(2);
  // One line: no day / hours blocks, and the text's boxes all on one line.
  await expect(interval.locator('> span.block')).toHaveCount(0);
  const lines = await interval.evaluate(el => {
    const range = document.createRange();
    range.selectNodeContents(el);
    return new Set([...range.getClientRects()].filter(r => r.width > 1 && r.height > 1).map(r => Math.round(r.bottom))).size;
  });
  expect(lines).toBe(1);
  const pescar = (await table.getByRole('columnheader', { name: 'Pescar', exact: true }).boundingBox())!;
  const box = (await table.boundingBox())!;
  // Capped (448px, plus its share of what is left), never the whole leftover width.
  expect(pescar.width).toBeLessThan(box.width * 0.5);
});

test('competition-page.cantare.c1 c2 — a sector per stand (24 × 1): one table without sector rows; the stands without a weighing are one row of chips; signed out the stands are read a few at a time', async ({ page }) => {
  let inFlight = 0;
  let peak = 0;
  const done = (url: string) => {
    if (url.includes('/feed/weighings/by-stand')) inFlight--;
  };
  page.on('request', r => {
    if (!r.url().includes('/feed/weighings/by-stand')) return;
    inFlight++;
    peak = Math.max(peak, inFlight);
  });
  page.on('requestfinished', r => done(r.url()));
  page.on('requestfailed', r => done(r.url()));
  await open(page, `/concursuri/${ID.live}/cantare`);
  const table = page.getByRole('table', { name: /Cântarele concursului/ });
  await expect(page.getByText(/^\d+ cântare? · 24 standuri$/)).toBeVisible({ timeout: 45_000 });
  await expect(table.getByRole('columnheader', { name: /^Sector / })).toHaveCount(0);
  const empty = table.getByRole('list', { name: /fără cântar/ });
  await expect(empty).toHaveCount(1);
  const weighed = await table.getByRole('rowheader').count();
  await expect(empty.getByRole('listitem')).toHaveCount(24 - weighed);
  expect(peak).toBeLessThanOrEqual(4);
  await expectNoA11yViolations(page);
});

test('competition-page.cantare.c1 c5 — feeder from 1280: the caption names the leg, «Manșa N» switches it; a guest crew’s members line only when it says more; Cronologic keeps the open weighing in view', async ({ page }) => {
  await signedIn(page);
  await open(page, `/concursuri/${ID.feederTeam}/cantare`);
  const table = page.getByRole('table', { name: /Cântarele concursului/ });
  await expect(page.getByText(/^Manșa 2 · \d+ cântare · 20 standuri$/)).toBeVisible({ timeout: 45_000 });
  // «Florin Varjan si Petrisor M» / «Florin Varjan si Petrisor Muraru»: the crew once.
  const crew = table.getByRole('row').filter({ has: page.getByRole('rowheader', { name: /Stand 1$/ }) });
  await expect(crew.getByText(/Florin Varjan/)).toHaveCount(1);
  // A team competition: the column is «Echipă», as on Participanți.
  await expect(table.getByRole('columnheader', { name: 'Echipă', exact: true })).toBeVisible();
  await expect(table.getByRole('columnheader', { name: 'Pescar', exact: true })).toHaveCount(0);
  // The CMS lists the sectors A, D, C, B and their stands out of order: the table sorts both (as Participanți).
  const sectors = await table.getByRole('columnheader', { name: /^Sector / }).allInnerTexts();
  expect(sectors.map(t => t.slice(0, 8))).toEqual([...sectors.map(t => t.slice(0, 8))].sort());
  const stands = (await table.getByRole('rowheader').allInnerTexts()).map(t => Number(t.match(/\d+/)?.[0]));
  expect(stands).toEqual([...stands].sort((a, b) => a - b));
  await page.getByRole('group', { name: 'Manșa cântarelor' }).getByRole('button', { name: 'Manșa 1' }).click();
  await expect(page.getByText(/^Manșa 1 · \d+ cântare · 20 standuri$/)).toBeVisible({ timeout: 45_000 });
  // Open the last stand's weighing, then switch to the timeline: the row stays on screen.
  const last = table.getByRole('button', { name: /^Cântar \d+$/ }).last();
  await last.scrollIntoViewIfNeeded();
  await last.click();
  await page.getByRole('button', { name: 'Cronologic' }).click();
  await expect(table.locator('tr[data-selected]')).toBeInViewport();
});

test('competition-page.cantar-detaliu.c9 competition-page.cantar-detaliu.s5 — signed out the history read is refused: «Eroare la încărcarea modificărilor.»', async ({ page }) => {
  await open(page, `/concursuri/${ID.nc}/cantare?cantar=${ID.ncWeighing}&stand=${ID.ncStand}`);
  // A link opens the detail after the first paint: from 1280 over the page (a dialog), so the
  // stands column never narrows by itself.
  const panel = page.getByRole('dialog', { name: 'Detaliu cântar' });
  await panel.getByRole('button', { name: 'Vezi istoric' }).click();
  await expect(panel.getByText('Eroare la încărcarea modificărilor.')).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Încearcă din nou' })).toBeVisible();
});

test('competition-page.cantar-detaliu.c10 — switching view with the detail open drops ?cantar / ?stand; back on Cântare nothing reopens', async ({ page }) => {
  await signedIn(page);
  await open(page, `/concursuri/${ID.nc}/cantare`);
  const item = page.getByRole('row').filter({ has: page.getByRole('rowheader', { name: /Stand A1$/ }) }).getByRole('button', { name: 'Cântar 1' });
  const panel = page.getByRole('complementary', { name: 'Detaliu cântar' });
  await press(page, item, () => expect(panel).toBeVisible({ timeout: 3000 }));
  await expect(page).toHaveURL(/cantar=/);
  await page.getByRole('tab', { name: /^Statistici/ }).click();
  await expect(page).toHaveURL(new RegExp(`/concursuri/${ID.nc}/statistici$`));
  await page.getByRole('tab', { name: /^Cântare/ }).click();
  await expect(page.getByRole('table', { name: /Cântarele concursului/ }).getByRole('columnheader', { name: /^Sector A/ })).toBeVisible();
  await page.waitForTimeout(500);
  await expect(page.getByRole('complementary', { name: 'Detaliu cântar' })).toBeHidden();
  await expect(page).not.toHaveURL(/cantar=|stand=/);
});

test('competition-page.cantare.c4 — signed in, a stand with no weighing yet reads «Cântare: 0 / Extra-cântare: 0»', async ({ page }) => {
  await signedIn(page);
  await open(page, `/concursuri/${ID.live}/cantare`, TABLET);
  const cards = page.locator('[id^="stand-"]');
  await expect(cards.first()).toBeVisible({ timeout: 30_000 });
  // Every card has its counts line once the summary has answered (none is left without it).
  await expect.poll(async () => (await cards.allInnerTexts()).every(text => /Cântare: \d+/.test(text) && /Extra-cântare: \d+/.test(text)), { timeout: 30_000 }).toBe(true);
  await expect(cards.filter({ hasText: 'Cântare: 0' }).first()).toBeVisible();
});

test('competition-page.cantare.c4 competition-page.cantare.s2 — signed out: one note above the sectors, not a line on every card', async ({ page }) => {
  await open(page, `/concursuri/${ID.rich}/cantare`, PHONE);
  await expect(page.getByText('Deschide un stand ca să vezi cântarele lui.')).toHaveCount(1);
  await expect(page.getByText('Deschide standul pentru cântare')).toHaveCount(0);
});

test('competition-page.cantare.c1 competition-page.cantare.s1 — 375: every stand card fits the screen (a long allocation line truncates)', async ({ page }) => {
  await signedIn(page);
  await open(page, `/concursuri/${ID.rich}/cantare`, PHONE);
  const cards = page.locator('[id^="stand-"]');
  await expect(cards.first()).toBeVisible({ timeout: 30_000 });
  const overflow = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('[id^="stand-"]')].filter(el => el.getBoundingClientRect().right > window.innerWidth + 0.5).map(el => el.id),
  );
  expect(overflow).toEqual([]);
});

test('competition-page.cantare.s2 — signed in: the signed-out note never shows while the session is read', async ({ page }) => {
  await signedIn(page);
  await page.addInitScript(() => {
    const w = window as unknown as { __sawNote?: boolean };
    w.__sawNote = false;
    new MutationObserver(() => {
      if (document.body?.textContent?.includes('Deschide un stand ca să vezi cântarele lui.')) w.__sawNote = true;
    }).observe(document, { subtree: true, childList: true, characterData: true });
  });
  await open(page, `/concursuri/${ID.rich}/cantare`, PHONE);
  const cards = page.locator('[id^="stand-"]');
  await expect.poll(async () => (await cards.allInnerTexts()).every(text => /Cântare: \d+/.test(text)), { timeout: 30_000 }).toBe(true);
  expect(await page.evaluate(() => (window as unknown as { __sawNote?: boolean }).__sawNote)).toBe(false);
});

test('competition-page.cantare.c5 — 1279: an open stand stays in its cell (selected); its weighings open as a row after its row, no card moves', async ({ page }) => {
  await signedIn(page);
  await open(page, `/concursuri/${ID.rich}/cantare`, TABLET);
  const sector = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Sector A', level: 2 }) });
  const cards = sector.locator('[id^="stand-"]');
  await expect.poll(async () => (await cards.allInnerTexts()).every(text => /Cântare: \d+/.test(text)), { timeout: 30_000 }).toBe(true);
  const second = cards.nth(1);
  const third = cards.nth(2);
  const [before2, before3] = [await second.boundingBox(), await third.boundingBox()];
  await second.getByRole('button').first().click();
  await expect(second.getByRole('button').first()).toHaveAttribute('aria-expanded', 'true');
  const panel = sector.getByRole('region', { name: /^Cântarele standului/ });
  await expect(panel.getByRole('button', { name: /Cântar 1/ })).toBeVisible({ timeout: 30_000 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await second.scrollIntoViewIfNeeded();
  const [after2, after3, panelBox] = [await second.boundingBox(), await third.boundingBox(), await panel.boundingBox()];
  // Same size and same place in the row (relative to each other: the page may have scrolled).
  expect(Math.round(after2!.width)).toBe(Math.round(before2!.width));
  expect(Math.round(after3!.x - after2!.x)).toBe(Math.round(before3!.x - before2!.x));
  expect(Math.round(after3!.y - after2!.y)).toBe(Math.round(before3!.y - before2!.y));
  // The panel spans the row, below the open card.
  expect(panelBox!.y).toBeGreaterThan(after2!.y + after2!.height);
  expect(panelBox!.width).toBeGreaterThan(after2!.width * 2);
});

test('competition-page.cantar-detaliu.s2 competition-page.b.notif-weighing — a link to a weighing that no longer exists: «Cântarul nu mai există.», no dead-end retry', async ({ page }) => {
  await signedIn(page);
  await open(page, `/concursuri/${ID.nc}/cantare?cantar=nu0exista0cantar0e2e0000&stand=${ID.ncStand}`);
  const surface = page.getByRole('dialog', { name: 'Detaliu cântar' });
  await expect(surface.getByText('Cântarul nu mai există.')).toBeVisible({ timeout: 45_000 });
  await expect(surface.getByRole('button', { name: 'Încearcă din nou' })).toHaveCount(0);
  await surface.getByRole('button', { name: 'Închide' }).click();
  await expect(page).not.toHaveURL(/cantar=/);
});

test('competition-page.cantar-detaliu.c1 c5 competition-page.cantar-detaliu.s2 competition-page.b.notif-weighing — a link opens the detail; in progress: «Se actualizează în m:ss» counts down, «Actualizează» re-reads', async ({ page }) => {
  await open(page, `/concursuri/${ID.openWeighing}/cantare?cantar=${ID.openWeighingId}&stand=${ID.openStand}`, PHONE);
  // Phone: the bottom sheet (a modal dialog).
  const sheet = page.getByRole('dialog', { name: 'Detaliu cântar' });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText('În curs', { exact: true })).toBeVisible();
  const countdown = sheet.getByText(/Se actualizează în \d:\d\d/);
  await expect(countdown).toBeVisible();
  const first = await countdown.textContent();
  await expect(countdown).not.toHaveText(first!, { timeout: 3000 });
  const reread = page.waitForRequest(r => r.url().includes(`/feed/weighings/${ID.openWeighingId}`));
  await sheet.getByRole('button', { name: 'Actualizează' }).click();
  await reread;
  await expect(countdown).toHaveText(/Se actualizează în (1:00|0:5\d)/);
  await settle(page);
  await expectNoA11yViolations(page);
});

test('competition-page.cantare.c2 competition-page.cantare.s1 — the summary is read only on the Cântare view', async ({ page }) => {
  await signedIn(page);
  const summaries: string[] = [];
  page.on('request', r => {
    if (r.url().includes('/weighings-summary')) summaries.push(r.url());
  });
  await open(page, `/concursuri/${ID.nc}`);
  await page.waitForTimeout(1500);
  expect(summaries).toEqual([]);
  await press(page, page.getByRole('tab', { name: /Cântare/ }), () => expect.poll(() => summaries.length, { timeout: 3000 }).toBeGreaterThan(0));
  // No per-stand read until a stand is opened.
  expect(summaries.every(u => !u.includes('by-stand'))).toBe(true);
});

test('competition-page.cantare.c8 — the phone action bar «Cântare» tile opens the view', async ({ page }) => {
  await signedIn(page);
  await open(page, `/concursuri/${ID.live}`, PHONE);
  await press(page, page.getByRole('region', { name: 'Bara de acțiuni' }).getByRole('button', { name: 'Vezi cântarele din concurs' }), () =>
    expect(page).toHaveURL(new RegExp(`/concursuri/${ID.live}/cantare`), { timeout: 3000 }),
  );
  await expect(page.getByRole('heading', { name: 'Sector A', level: 2 })).toBeVisible();
});

/* ------------------------------------------------------------------ */
/* Statistici                                                          */
/* ------------------------------------------------------------------ */

test('competition-page.statistici.c1 competition-page.statistici.s1 — signed out: the sign-in prompt', async ({ page }) => {
  await open(page, `/concursuri/${ID.rich}/statistici`);
  await expect(page.getByText('Trebuie să fii autentificat pentru a vedea statisticile.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Intră în cont' })).toHaveAttribute('href', /statistici/);
});

test('competition-page.statistici.c2 c3 c5 c6 c7 c8 c10 c11 c12 c13 c16 competition-page.statistici.s2 s7 — sessions, Top capturi, sector donut, thresholds', async ({ page }) => {
  await signedIn(page);
  const reads: string[] = [];
  page.on('request', r => {
    if (/best-n|catch-threshold|weighing-statistics/.test(r.url())) reads.push(r.url());
  });
  const errors = await open(page, `/concursuri/${ID.rich}`, PHONE);
  // c2: nothing statistics-only before the view (the weighing statistics are the phone's? no: from 768 only).
  expect(reads.filter(u => /best-n|catch-threshold/.test(u))).toEqual([]);
  // c16: the bar's Statistici tile.
  await press(page, page.getByRole('region', { name: 'Bara de acțiuni' }).getByRole('button', { name: 'Statistici' }), () =>
    expect(page).toHaveURL(/\/statistici$/, { timeout: 3000 }),
  );
  // c3: the summary as a bento (owner rule 9; phone): the navy biggest catch and the quantity tile
  // across, the small «Capturi» fact and the stand facts — never the word «capot» (rule 11).
  const summary = page.getByRole('list', { name: 'Rezumat' });
  await expect(summary.getByText('Cea mai mare captură')).toBeVisible();
  await expect(summary.getByText('Capturi', { exact: true })).toBeVisible();
  await expect(summary.getByText('Cantitate totală')).toBeVisible();
  await expect(summary.getByText('Standuri cu pește')).toBeVisible();
  await expect(summary.getByText('Fără capturi')).toBeVisible();
  await expect(summary).not.toContainText(/capot/i);
  // Rule 10: the unit is its own spaced element («2.961,0 kg», never «2.961,0kg»).
  await expect(summary.getByRole('listitem').nth(1)).toContainText(/\d,\d\s+kg/);
  const tiles = await summary.getByRole('listitem').evaluateAll(els => els.map(e => Math.round(e.getBoundingClientRect().width)));
  expect(new Set(tiles).size).toBeGreaterThan(1);
  // c5–c8: sessions.
  const sessions = page.getByRole('region', { name: 'Sesiuni de cântărire' });
  await expect(sessions.getByText('Cronologia cântăririlor și cantitatea totală per sesiune.')).toBeVisible();
  await expect(sessions.getByText(/^Cântar 1 – (Dimineață|Seară)$/)).toBeVisible();
  await expect(sessions.getByText('Extra-cântar').first()).toBeVisible();
  await expect(sessions.getByRole('listitem')).toHaveCount(4);
  const more = sessions.getByRole('button', { name: /Vezi toate cântarele \(\d+ ascunse\)/ });
  await more.click();
  await expect(sessions.getByRole('button', { name: 'Restrânge' })).toBeVisible();
  expect(await sessions.getByRole('listitem').count()).toBeGreaterThan(4);
  await expect(sessions.getByText('Total: 389 capturi')).toBeVisible();
  // Weights: the Romanian grouping («2.961,0 kg», never «2961,0»), at the competition's precision.
  await expect(sessions.getByText(/^\d{1,3}(\.\d{3})*,\d+\s+kg$/).last()).toBeVisible();
  // c10 / c11: Top capturi → Best 3 ranking.
  const tops = page.getByRole('region', { name: 'Top capturi (Best 3 / 5 / 7)' });
  await expect(tops.getByRole('button')).toHaveCount(3);
  await tops.getByRole('button').first().click();
  const best = page.getByRole('dialog', { name: 'Best 3 - Clasament' });
  await expect(best.getByRole('columnheader')).toHaveText(['Stand', 'Participant(e) / Echipă', 'Primele capturi (kg)', 'Medie']);
  await page.keyboard.press('Escape');
  // c12: the sector donut + legend; c13: the thresholds table.
  const donut = page.getByRole('region', { name: 'Cantitate pe sector (kg)' });
  await expect(donut.getByRole('img')).toHaveAttribute('aria-label', /Sector A [\d.]+,\d+\s+kg/);
  await expect(donut.getByText(/^Sector A · [\d.]+,\d+\s+kg$/)).toBeVisible();
  const thresholds = page.getByRole('region', { name: 'Capturi', exact: true });
  await expect(thresholds.getByRole('columnheader')).toHaveText(['Sector', '10+', '15+', '20+', '25+', '30+']);
  await expect(thresholds.getByRole('rowheader', { name: 'General' })).toBeVisible();
  expect(reads.some(u => u.includes('best-n'))).toBe(true);
  await expectNoA11yViolations(page);
  expect(errors).toEqual([]);
});

test('competition-page.statistici.c4 competition-page.statistici.s2 — a weighing-statistics re-read that fails keeps the sessions and offers «Reîncearcă»', async ({ page }) => {
  // The server prefetches the weighing statistics with the page, so in the browser a failure can
  // only be a re-read (the Statistici chip): what was read stays, with the retry. The no-data
  // branch (the message + «Încearcă din nou») is the same BlockError the other blocks use.
  await signedIn(page);
  let fail = true;
  await page.route('**/weighing-statistics', route => (fail ? route.fulfill({ status: 500, body: '{}' }) : route.continue()));
  await open(page, `/concursuri/${ID.rich}`);
  await press(page, page.getByRole('tab', { name: /Statistici/ }), () =>
    expect(page.getByText(/Date posibil neactualizate/)).toBeVisible({ timeout: 8000 }),
  );
  await expect(page.getByRole('region', { name: 'Sesiuni de cântărire' })).toBeVisible();
  fail = false;
  await page.getByRole('button', { name: 'Reîncearcă' }).click();
  await expect(page.getByText(/Date posibil neactualizate/)).toBeHidden();
});

test('competition-page.statistici.c14 c15 competition-page.statistici.s6 s8 — National Championship: Penalizări, newest first, 3 then all; a referee revokes one', async ({ page }) => {
  await signedIn(page);
  const penalties = Array.from({ length: 5 }, (_, i) => ({
    documentId: `pen${i}`,
    action: i === 0 ? 'ELIMINATE' : i === 1 ? 'DEDUCT_TOTAL_WEIGHT' : 'WARNING',
    value: i === 1 ? 2.5 : null,
    reason: `Motiv ${i}`,
    createdAt: new Date(Date.UTC(2026, 4, 9, 10 + i)).toISOString(),
    author: { id: 1, username: 'Arbitru' },
  }));
  await page.route(`**/competitions/${ID.nc}/ranking`, async route => {
    const res = await route.fetch();
    const body = await res.json();
    body.rankings[0].teams[0].penalties = penalties;
    await route.fulfill({ response: res, json: body });
  });
  await page.route(`**/user/profile/competition/*/statute`, route => route.fulfill({ json: { userRole: 'referee' } }));
  let deleted = '';
  await page.route('**/penalties/*', route => {
    if (route.request().method() !== 'DELETE') return route.continue();
    deleted = route.request().url();
    return route.fulfill({ status: 204 });
  });
  await open(page, `/concursuri/${ID.nc}`);
  // The Statistici chip re-reads the ranking (through the route above).
  const card = page.getByRole('region', { name: 'Penalizări' });
  await press(page, page.getByRole('tab', { name: /Statistici/ }), () => expect(card).toBeVisible({ timeout: 5000 }));
  await expect(card.getByRole('listitem')).toHaveCount(3);
  await expect(card.getByRole('listitem').first()).toContainText('Avertisment');
  await expect(card.getByRole('listitem').first()).toContainText('Motiv 4');
  await card.getByRole('button', { name: 'Vezi toate penalizările (2 ascunse)' }).click();
  await expect(card.getByRole('listitem')).toHaveCount(5);
  await expect(card.getByText('Penalizare greutate · 2,5 kg')).toBeVisible();
  await expect(card.getByText('Eliminare')).toBeVisible();
  await card.getByRole('button', { name: 'Ascunde' }).click();
  // c15: revoke.
  const reread = page.waitForRequest(r => r.url().endsWith(`/competitions/${ID.nc}/ranking`));
  await card.getByRole('button', { name: 'Revocă' }).first().click();
  const ask = page.getByRole('alertdialog', { name: 'Revocă penalizarea?' });
  await expect(ask.getByText('Acțiunea va elimina penalizarea din clasament.')).toBeVisible();
  await ask.getByRole('button', { name: 'Revocă' }).click();
  await reread;
  expect(deleted).toContain('/penalties/pen4');
});

test('competition-page.statistici.c9 competition-page.cronologie.c3 c6 competition-page.cronologie.s4 — the stand timeline card: top 6, «Vezi toate (24 standuri)», expand to the page', async ({ page }) => {
  await signedIn(page);
  await open(page, `/concursuri/${ID.live}/statistici`);
  const card = page.getByRole('region', { name: 'Cronologia standurilor' });
  await expect(card.getByText('Trage timpul de mai jos pentru a vedea evoluția scorurilor.')).toBeVisible();
  await expect(card.getByRole('list').last().getByRole('button')).toHaveCount(6);
  await expect(card.getByRole('link', { name: 'Vezi toate (24 standuri) →' })).toHaveAttribute('href', `/concursuri/${ID.live}/statistici/cronologie`);
  await card.getByRole('link', { name: 'Deschide cronologia standurilor pe toată pagina' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Cronologia standurilor' })).toBeVisible();
});

test('competition-page.statistici.c3 c9 competition-page.cronologie.c3 competition-page.statistici.s2 — no snapshot (204) after the competition: «Cronologia nu este disponibilă…» is the sessions card\'s footer, not a card of filler', async ({ page }) => {
  await signedIn(page);
  await open(page, `/concursuri/${ID.rich}/statistici`);
  const sessions = page.getByRole('region', { name: 'Sesiuni de cântărire' });
  await expect(sessions.getByText('Cronologia nu este disponibilă pentru acest concurs.')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('region', { name: 'Cronologia standurilor' })).toHaveCount(0);
  // Completed: never «… încă» beside 9 sessions.
  await expect(page.getByText('Nu există cântăriri înregistrate încă.')).toHaveCount(0);
});

for (const [kind, id] of [
  ['feeder', ID.feederTeam],
  ['national championship', ID.nc],
] as const) {
  test(`competition-page.statistici.c3 — ${kind} at 1440: a bento (navy 2×2, quantity 2×1, small facts), a lone fact keeps a tile\'s width, the strip steps aside`, async ({ page }) => {
    await signedIn(page);
    await open(page, `/concursuri/${id}/statistici`);
    const summary = page.getByRole('list', { name: 'Rezumat' });
    const perCatch = summary.getByRole('listitem').filter({ hasText: 'Medie pe captură' });
    await expect(perCatch).toBeVisible({ timeout: 30_000 });
    expect((await perCatch.boundingBox())!.width).toBeLessThan(400);
    // Rule 9: tiles of different sizes — the navy one is wider and taller than a fact.
    const navy = await summary.getByRole('listitem').filter({ hasText: 'Cea mai mare captură' }).boundingBox();
    const fact = (await perCatch.boundingBox())!;
    expect(navy!.width).toBeGreaterThan(fact.width * 1.8);
    expect(navy!.height).toBeGreaterThan(fact.height * 1.8);
    // The same numbers are never twice on screen: the strip over the views is hidden here.
    await expect(page.getByRole('group', { name: 'Concursul pe scurt' })).toBeHidden();
    await expect(summary).not.toContainText(/capot/i);
    // 768–1279: the strip holds the headline numbers; the lone fact still keeps a tile's width.
    await page.setViewportSize({ width: 1024, height: 900 });
    await expect(page.getByRole('group', { name: 'Concursul pe scurt' })).toBeVisible();
    expect((await perCatch.boundingBox())!.width).toBeLessThan(400);
  });
}

test('competition-page.statistici.c3 — live at 1440: the weighing tile is a bento tile (the strip steps aside, its «Ultimul cântar» / «Cântar în curs» does not go with it); one precision, units apart', async ({ page }) => {
  await signedIn(page);
  await open(page, `/concursuri/${ID.live}/statistici`);
  const summary = page.getByRole('list', { name: 'Rezumat' });
  const weighing = summary.getByRole('listitem').filter({ hasText: /Ultimul cântar|Cântar în curs|Extra-cântar în curs|Cântare în curs/ });
  await expect(weighing).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('group', { name: 'Concursul pe scurt' })).toBeHidden();
  await weighing.getByRole('button', { name: 'Toate cântarele' }).click();
  await expect(page).toHaveURL(/\/cantare$/);
  await page.goBack();
  // Rule 9: a fact stays a small tile (one of six tracks), the headline tiles span two.
  const fact = await summary.getByRole('listitem').filter({ hasText: 'Medie pe captură' }).boundingBox();
  expect(fact!.width).toBeLessThan(270);
  // Rule 10 / one precision: the session total, the donut legend — figure, then «kg» apart.
  const sessions = page.getByRole('region', { name: 'Sesiuni de cântărire' });
  await expect(sessions.getByText(/^Total: \d+ capturi$/)).toBeVisible();
  const donut = page.getByRole('region', { name: 'Cantitate pe sector (kg)' });
  // The sector rows carry the quantity after the weight penalties: the card says so.
  await expect(donut.getByText(/după penalizările de greutate/)).toBeVisible();
  const legendUnit = donut.getByRole('listitem').first().locator('span').last();
  await expect(legendUnit).toHaveText(/^\s*kg$/);
});

test('competition-page.statistici.c3 c10 c12 — 1440, not one catch nor weighing: the summary line and one empty state, no Top capturi of «-», no ring of 0', async ({ page }) => {
  await signedIn(page);
  await open(page, `/concursuri/${ID.noCatch}/statistici`);
  await expect(page.getByText('Nu există statistici pentru acest concurs')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/Nicio captură înregistrată/).first()).toBeVisible();
  await expect(page.getByRole('region', { name: 'Top capturi (Best 3 / 5 / 7)' })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Cantitate pe sector (kg)' })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Cronologia standurilor' })).toHaveCount(0);
});

for (const width of [320, 375]) {
  test(`competition-page.statistici.c3 — ${width}: a three-decimal «Cantitate totală» fits its tile (the unit never runs past it)`, async ({ page }) => {
    await signedIn(page);
    await open(page, `/concursuri/${ID.feederTeam}/statistici`, { width, height: 800 });
    const tile = page.getByRole('list', { name: 'Rezumat' }).getByRole('listitem').filter({ hasText: 'Cantitate totală' });
    await expect(tile).toContainText(/\d,\d{3}\s+kg/, { timeout: 30_000 });
    const fits = await tile.evaluate(li => {
      const box = li.firstElementChild as HTMLElement;
      return box.scrollWidth <= box.clientWidth && li.getBoundingClientRect().right <= window.innerWidth;
    });
    expect(fits).toBe(true);
  });
}

test('competition-page.statistici.c6 c13 — live, 24 sectors: no table of zeros, the donut legend in columns keeps its card short, the last odd card takes the row', async ({ page }) => {
  await signedIn(page);
  await open(page, `/concursuri/${ID.live}/statistici`);
  const donut = page.getByRole('region', { name: 'Cantitate pe sector (kg)' });
  await expect(donut).toBeVisible({ timeout: 30_000 });
  // c13: every threshold count is 0 → no «Capturi» table.
  await expect(page.getByRole('region', { name: 'Capturi', exact: true })).toHaveCount(0);
  expect((await donut.boundingBox())!.height).toBeLessThan(420);
});

test('competition-page.statistici.c11 c13 — the thresholds and Best N tables have a coloured header band (owner rule 12)', async ({ page }) => {
  await signedIn(page);
  await open(page, `/concursuri/${ID.rich}/statistici`);
  const thresholds = page.getByRole('region', { name: 'Capturi', exact: true });
  const head = thresholds.getByRole('columnheader').first();
  await expect(head).toBeVisible({ timeout: 30_000 });
  const bg = await head.evaluate(th => getComputedStyle(th).backgroundColor);
  expect(bg).not.toBe('rgba(0, 0, 0, 0)');
  await page.getByRole('region', { name: 'Top capturi (Best 3 / 5 / 7)' }).getByRole('button').first().click();
  const best = page.getByRole('dialog', { name: 'Best 3 - Clasament' });
  const bestBg = await best.getByRole('columnheader').first().evaluate(th => getComputedStyle(th).backgroundColor);
  expect(bestBg).toBe(bg);
});

test('competition-page.cronologie.s2 competition-page.statistici.s2 — offline with nothing cached: the timeline card says so with its retry, never bones for ever', async ({ page }) => {
  await signedIn(page);
  await open(page, `/concursuri/${ID.live}`);
  await page.context().setOffline(true);
  try {
    await page.getByRole('tab', { name: /Statistici/ }).click();
    const card = page.getByRole('region', { name: 'Cronologia standurilor' });
    await expect(card.getByText('Ești offline. Conținutul se va încărca când revine conexiunea.')).toBeVisible({ timeout: 30_000 });
    await expect(card.getByRole('button', { name: 'Încearcă din nou' })).toBeVisible();
    await expect(card.getByRole('status', { name: 'Se încarcă cronologia standurilor' })).toHaveCount(0);
  } finally {
    await page.context().setOffline(false);
  }
});

test('competition-page.cronologie.c1 c4 c5 c7 c8 c9 competition-page.cronologie.s5 s6 — the page: every stand, chips, slider, play, focus readout', async ({ page }) => {
  await signedIn(page);
  const errors = await open(page, `/concursuri/${ID.live}/statistici/cronologie`);
  // From 768 the breadcrumb is the way back (the back chip is the phone's).
  await expect(page.getByRole('button', { name: 'Înapoi la statistici' })).toBeHidden();
  const rows = page.getByRole('list', { name: /Standurile după/ }).getByRole('button');
  await expect(rows).toHaveCount(24);
  // c4: sector chips (Toate first) and metric chips, the default metric checked.
  const sectors = page.getByRole('radiogroup', { name: 'Sector' });
  await expect(sectors.getByRole('radio', { name: 'Toate' })).toBeChecked();
  await expect(page.getByRole('radiogroup', { name: 'Indicator' }).getByRole('radio', { name: 'Cantitate' })).toBeChecked();
  // c5: ranked; the row label «A1» (the stand name carries its sector), «x,xxx kg» (fish: three
  // decimals; the ro-RO grouping), or «—» (named «fără valoare»).
  await expect(rows.first()).toHaveAccessibleName(/^Locul \d+: Sector A, standul A1, (\d{1,3}(\.\d{3})*,\d{3} kg|fără valoare)$/);
  // c5: a stand with no value yet reads «—» (fish formatMetricValue).
  // (23 of the 24 stands have no catch yet.)
  await expect(page.getByRole('button', { name: /fără valoare$/ }).first()).toContainText('—');
  await expect(rows.first()).toContainText(/^A1/);
  await expect(rows.first()).not.toContainText('A/A1');
  await expect(page.getByRole('button', { name: /^Locul 1: / })).toBeVisible();
  // c7: the slider starts at the latest event; its labels.
  const slider = page.getByRole('slider', { name: 'Momentul din concurs' });
  const end = await slider.getAttribute('max');
  // c8: play from the end rewinds to the start and moves; dragging pauses.
  await page.getByRole('button', { name: 'Redă evoluția' }).click();
  await expect(page.getByRole('button', { name: 'Pauză' })).toBeVisible();
  await page.waitForTimeout(600);
  expect(Number(await slider.inputValue())).toBeLessThan(Number(end));
  await slider.focus();
  await page.keyboard.press('End');
  await expect(page.getByRole('button', { name: 'Redă evoluția' })).toBeVisible();
  // c9: a stand focused: the readout; pressed again clears.
  await rows.first().click();
  await expect(rows.first()).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Sector A, Standul A1')).toBeVisible();
  await expect(page.getByText('ULTIMA CÂNTĂRIRE')).toBeVisible();
  await page.getByRole('button', { name: 'Închide' }).click();
  await expect(page.getByText('Sector A, Standul A1')).toBeHidden();
  // A sector chip: «A1» without the sector. A focus on a stand the sector does not hold is dropped
  // (no greyed chart with no readout).
  await rows.first().click();
  await expect(page.getByText('ULTIMA CÂNTĂRIRE')).toBeVisible();
  await sectors.getByText('Sector B', { exact: true }).click();
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toHaveAccessibleName(/^Locul 1: Standul B1, /);
  await expect(page.locator('[aria-pressed="true"]')).toHaveCount(0);
  await rows.first().click();
  await expect(rows.first()).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Închide' })).toBeVisible();
  await expectNoA11yViolations(page);
  expect(errors).toEqual([]);
});

test('competition-page.cronologie.c2 competition-page.cronologie.s1 — notStarted: no chart, nothing read', async ({ page }) => {
  await signedIn(page);
  const reads: string[] = [];
  page.on('request', r => {
    if (r.url().includes('timeline-snapshot')) reads.push(r.url());
  });
  await open(page, `/concursuri/${ID.upcoming}/statistici/cronologie`);
  await expect(page.getByText('Cronologia apare după primul cântar.')).toBeVisible();
  expect(reads).toEqual([]);
});

test('competition-page.cronologie.c3 competition-page.cronologie.s2 — error: «Nu s-a putut încărca cronologia.» + retry', async ({ page }) => {
  await signedIn(page);
  await page.route('**/timeline-snapshot', route => route.fulfill({ status: 500, body: '{}' }));
  await open(page, `/concursuri/${ID.live}/statistici/cronologie`, PHONE);
  await expect(page.getByText('Nu s-a putut încărca cronologia.')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('button', { name: 'Încearcă din nou' })).toBeVisible();
});

/* ------------------------------------------------------------------ */
/* Toți peștii                                                         */
/* ------------------------------------------------------------------ */

test('competition-page.toti-pestii.c1 c2 c3 c4 c5 c7 competition-page.toti-pestii.s4 s5 s6 — sorts, stand / sector filter, rows, paging', async ({ page }) => {
  const reads: string[] = [];
  page.on('request', r => {
    if (r.url().includes('/catches')) reads.push(r.url());
  });
  const errors = await open(page, `/concursuri/${ID.rich}/capturi`, PHONE);
  const sorts = page.getByRole('radiogroup', { name: 'Sortare capturi' });
  await expect(sorts.locator('label')).toHaveText(['Cei mai mari', 'Cei mai mici', 'Pe stand', 'Pe sector']);
  await expect(sorts.getByRole('radio', { name: 'Cei mai mari' })).toBeChecked();
  const list = page.locator('ul').filter({ hasText: / kg/ }).first();
  await expect(list.getByRole('listitem')).toHaveCount(20, { timeout: 30_000 });
  // c5: the stand badge, weight + species, the competitor.
  await expect(list.getByRole('listitem').first()).toContainText(/Stand [A-Z]\d+/);
  await expect(list.getByRole('listitem').first()).toContainText(' kg');
  // c3: the next page loads near the end (and «Încarcă mai mult» stays as the explicit way).
  await expect(page.getByRole('button', { name: 'Încarcă mai mult' })).toBeVisible();
  await page.getByRole('button', { name: 'Încarcă mai mult' }).scrollIntoViewIfNeeded();
  await expect.poll(() => list.getByRole('listitem').count()).toBeGreaterThan(20);
  // c4: no duplicates across pages.
  const ids = await list.getByRole('listitem').allInnerTexts();
  expect(ids.length).toBeGreaterThan(20);
  // c2: Pe sector → sector chips, the first picked, filtered on the server.
  await sorts.getByText('Pe sector').click();
  const filter = page.getByRole('radiogroup', { name: 'Sector' });
  await expect(filter.getByRole('radio', { name: 'A' })).toBeChecked();
  await expect.poll(() => reads.some(u => u.includes('sectorName=A'))).toBe(true);
  await sorts.getByText('Pe stand').click();
  const stands = page.getByRole('radiogroup', { name: 'Stand' });
  await expect(stands.locator('label').first()).toHaveText('A1');
  await expect.poll(() => reads.some(u => u.includes('standKey=A1'))).toBe(true);
  // c7: fresh 5 minutes — coming back to «Cei mai mari» does not re-read page 1.
  const before = reads.filter(u => u.includes('sort=weight_desc') && u.includes('page=1')).length;
  await sorts.getByText('Cei mai mari').click();
  await page.waitForTimeout(800);
  expect(reads.filter(u => u.includes('sort=weight_desc') && u.includes('page=1')).length).toBe(before);
  await expectNoA11yViolations(page);
  expect(errors).toEqual([]);
});

test('competition-page.toti-pestii.c2 c4 competition-page.toti-pestii.s5 s6 — stands named with their sector: the chip reads «A1», the filter sends the CMS key «AA1»; a catch repeated across pages shows once', async ({ page }) => {
  const reads: string[] = [];
  let first: unknown = null;
  await page.route('**/catches?**', async route => {
    const url = route.request().url();
    reads.push(url);
    const res = await route.fetch();
    const body = await res.json();
    if (url.includes('sort=weight_desc') && url.includes('page=1&')) first = body.data[0];
    // c4: page 2 repeats page 1's first catch (a catch landed between the two reads).
    if (url.includes('sort=weight_desc') && url.includes('page=2&') && first) body.data = [first, ...body.data];
    await route.fulfill({ response: res, json: body });
  });
  await open(page, `/concursuri/${ID.live}/capturi`, PHONE);
  const list = page.locator('ul').filter({ hasText: / kg/ }).first();
  await expect(list.getByRole('listitem')).toHaveCount(20, { timeout: 30_000 });
  await page.getByRole('button', { name: 'Încarcă mai mult' }).scrollIntoViewIfNeeded();
  await expect.poll(() => reads.some(u => u.includes('page=2&'))).toBe(true);
  await expect.poll(() => list.getByRole('listitem').count()).toBeGreaterThan(20);
  const texts = await list.getByRole('listitem').allInnerTexts();
  const head = texts[0];
  expect(texts.filter(t => t === head)).toHaveLength(1);
  const sorts = page.getByRole('radiogroup', { name: 'Sortare capturi' });
  await sorts.getByText('Pe stand').click();
  const stands = page.getByRole('radiogroup', { name: 'Stand' });
  await expect(stands.locator('label').first()).toHaveText('A1');
  await expect(stands.getByRole('radio', { name: 'A1', exact: true })).toBeChecked();
  await expect.poll(() => reads.some(u => u.includes('standKey=AA1'))).toBe(true);
  await stands.getByText('B1', { exact: true }).click();
  await expect.poll(() => reads.some(u => u.includes('standKey=BB1'))).toBe(true);
  await page.unrouteAll({ behavior: 'ignoreErrors' });
});

test('competition-page.toti-pestii.c6 competition-page.toti-pestii.s2 — a failed read: the error and its retry', async ({ page }) => {
  let fail = true;
  await page.route('**/catches?**', route => (fail ? route.fulfill({ status: 500, body: '{}' }) : route.continue()));
  await open(page, `/concursuri/${ID.rich}`);
  await page.getByRole('tab', { name: /Toți peștii/ }).click();
  await expect(page.getByText('Nu s-au putut încărca capturile.')).toBeVisible({ timeout: 30_000 });
  fail = false;
  await page.getByRole('button', { name: 'Încearcă din nou' }).click();
  await expect(page.getByText(/^\d[\d,]* kg$/).first()).toBeVisible();
});

/* ------------------------------------------------------------------ */
/* Statistici pescar                                                   */
/* ------------------------------------------------------------------ */

test('competition-page.statistici-pescar.c1 c3 c4 c7 competition-page.statistici-pescar.s2 s3 s6 — a row pressed opens the angler; an account: three stats; a guest: the note', async ({ page }) => {
  await signedIn(page);
  const batches: string[] = [];
  page.on('request', r => {
    if (r.url().includes('statistics') && r.method() === 'POST') batches.push(r.url());
  });
  const errors = await open(page, `/concursuri/${ID.rich}`);
  // c1: the desktop table row (keyboard: Enter).
  const row = page.locator('tbody tr').filter({ hasText: 'Lala' }).first();
  await expect(row).toHaveAttribute('data-pressable', '', { timeout: 30_000 });
  await row.focus();
  await page.keyboard.press('Enter');
  const panel = page.getByRole('complementary', { name: 'Statistici pescar' });
  await expect(panel).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`pescar=${ID.richGuest}`));
  // c4: a guest.
  await expect(panel.getByText('Invitat · statistici indisponibile')).toBeVisible();
  await expect(panel.getByText('Pescarul nu are cont Bluvi.')).toBeVisible();
  await panel.getByRole('button', { name: 'Închide' }).click();
  await expect(page).not.toHaveURL(/pescar=/);
  // c3 / c7: a link to an angler with an account: name, «Sector A · Standul 1», the three stats. A
  // link opens after the first paint: from 1280 over the page, so the ranking never narrows.
  await page.goto(`/concursuri/${ID.rich}?pescar=${ID.richAngler}`);
  const linked = page.getByRole('dialog', { name: 'Statistici pescar' });
  await expect(linked.getByText(/^Sector A · Standul 1$/)).toBeVisible({ timeout: 45_000 });
  await expect(linked.getByText('Capturi', { exact: true })).toBeVisible();
  await expect(linked.getByText('C.M.M.C', { exact: true })).toBeVisible();
  await expect(linked.getByText('Competiții', { exact: true })).toBeVisible();
  await expect.poll(() => batches.length).toBeGreaterThan(0);
  await settle(page);
  await expectNoA11yViolations(page);
  expect(errors).toEqual([]);
});

test('competition-page.statistici-pescar.c3 c7 — a failed stats batch says so, with a retry (never «–» passed off as data)', async ({ page }) => {
  await signedIn(page);
  let fail = true;
  await page.route(/statistics/, route => (fail && route.request().method() === 'POST' ? route.fulfill({ status: 500, body: '{}' }) : route.continue()));
  await open(page, `/concursuri/${ID.rich}?pescar=${ID.richAngler}`);
  const panel = page.getByRole('dialog', { name: 'Statistici pescar' });
  await expect(panel.getByText('Statisticile nu au putut fi încărcate.')).toBeVisible({ timeout: 30_000 });
  fail = false;
  await panel.getByRole('button', { name: 'Încearcă din nou' }).click();
  await expect(panel.getByText('Statisticile nu au putut fi încărcate.')).toBeHidden();
});

test('competition-page.statistici-pescar.c2 competition-page.statistici-pescar.s1 — signed out: the sign-in prompt, «Continuă ca vizitator» closes', async ({ page }) => {
  await open(page, `/concursuri/${ID.rich}`, PHONE);
  const first = page.getByRole('list', { name: 'Clasament' }).getByRole('listitem').first();
  await expect(first).toHaveAttribute('data-pressable', '', { timeout: 30_000 });
  await first.click();
  const sheet = page.getByRole('dialog', { name: 'Statistici pescar' });
  await expect(sheet.getByText('Statistici pentru pescari')).toBeVisible();
  await expect(sheet.getByText('Intră în cont ca să vezi capturile și recordurile fiecărui pescar din concurs.')).toBeVisible();
  await expect(sheet.getByRole('link', { name: 'Intră în cont' })).toBeVisible();
  await sheet.getByRole('button', { name: 'Continuă ca vizitator' }).click();
  await expect(sheet).toBeHidden();
});

test('competition-page.statistici-pescar.c5 c6 competition-page.statistici-pescar.s5 — a team entered without accounts: the team header and «Statistici indisponibile»', async ({ page }) => {
  await signedIn(page);
  await open(page, `/concursuri/${ID.feederTeam}`);
  await expect(page.locator('tr[data-registration]').first()).toHaveAttribute('data-pressable', '', { timeout: 30_000 });
  await page.locator('tr[data-registration]').first().click();
  const panel = page.getByRole('complementary', { name: 'Statistici pescar' });
  await expect(panel.getByText('Statistici indisponibile', { exact: true })).toBeVisible();
  await expect(panel.getByText('Participanții au fost adăugați fără cont Bluvi.')).toBeVisible();
});
