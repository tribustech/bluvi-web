import { collectConsoleErrors } from './helpers/console';
import { expect, test, type Page, type Route } from '@playwright/test';
import { card, page as cardsPage, PIXEL } from './competitions-list.fixtures';
import { expectNoA11yViolations } from './helpers/a11y';
import { qaJwt, signIn } from './helpers/session';

/*
 * Concursuri from 1024 in «Listă» — each tab's own layout (owner-approved prototype A2, ROADMAP §4b,
 * parity docs/parity/areas/competitions-list.yml competitions-list.index c30–c36, states s20–s23):
 * Viitoare = an agenda grouped by time with faces and a capacity bar; Live = the live hub; Rezultate
 * = compact winner rows that expand inline (feeder in points); Ale mele = my registrations led by my
 * status. Below 1024 (and in «Afiș», and in results mode) the cards of competitions-list.spec.ts.
 * Local CMS on :1337 (live, upcoming and finished competitions, feeder ones among them).
 */

const DESKTOP = { width: 1280, height: 900 };
const WIDE = { width: 1440, height: 900 };
const CARDS = { width: 1000, height: 900 };

const RANKING = /\/competitions\/[^/]+\/ranking(\?|$)/;
const FOLLOWED = /\/feed\/my-competition-cards\?.*scope=followed/;
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const WEIGHINGS = /\/competitions\/[^/]+\/weighing-statistics/;

let jwt = '';
test.describe.configure({ timeout: 90_000 });
test.use({ trace: 'off' });
test.beforeAll(async ({ request }) => {
  jwt = await qaJwt(request);
});

const list = (page: Page) => page.locator('#concursuri-lista');
const desktop = (page: Page) => list(page).locator('[data-desktop-tab]');

async function open(page: Page, path = '/concursuri') {
  await page.addInitScript(() => {
    try {
      localStorage.removeItem('COMPETITION_CARD_DENSITY_V1');
    } catch {
      // storage blocked: the default (Listă) anyway
    }
  });
  await page.goto(path);
  await expect(page.getByRole('heading', { level: 1, name: 'Concursuri' })).toBeVisible();
  await expect(page.locator('#concursuri-lista-titlu')).toBeVisible();
}

/** The rows rise in once (a staggered fade): axe reads the settled colours. */
async function settled(page: Page) {
  await page.waitForFunction(() =>
    document.getAnimations().every((a) => a.playState !== 'running' || a.effect?.getComputedTiming().iterations === Infinity),
  );
}

test.describe('signed out', () => {
  test('competitions-list.index.c30 competitions-list.index.c36 competitions-list.index.s20 — Viitoare: the agenda by time, faces and places; cards again below 1024 and in Afiș', async ({ page }) => {
    const errors = collectConsoleErrors(page, { ignore: /Failed to load resource/ });
    await page.setViewportSize(DESKTOP);
    await open(page);
    const view = desktop(page);
    await expect(view).toHaveAttribute('data-desktop-tab', 'notStarted');
    // Grouped by time: this week / next week / a month (a start already passed comes last).
    const groups = view.getByRole('heading', { level: 3 });
    await expect(groups.first()).toHaveText(/^(Săptămâna asta|Săptămâna viitoare|Ianuarie|Februarie|Martie|Aprilie|Mai|Iunie|Iulie|August|Septembrie|Octombrie|Noiembrie|Decembrie|Fără dată)/);
    const row = view.locator('[data-row]').first();
    await expect(row).toBeVisible();
    // ONE link per row, named by the competition, opening it (cards.c1): the CTA opens the same page,
    // so it is drawn, not a second link (no second tab stop).
    await expect(row.getByRole('link')).toHaveCount(1);
    await expect(row.getByRole('link')).toHaveAttribute('href', /^\/concursuri\/[^/?]+$/);
    // Places: «N/M unit» with the bar's honest label, «1 pescar» / «24 de pescari», «N în așteptare»,
    // or «Fii primul înscris».
    await expect(view.getByText(/^\d+\/\d+ (pescari|echipe)$|^1 (pescar|echipă)$|^\d+ (de )?(pescari|echipe)$|^\d+ în așteptare$|^Fii primul înscris$/).first()).toBeVisible();
    // Never «1 pescari» / «1 echipe» anywhere in the agenda (core cardCopy agreement).
    await expect(view.getByText(/(^|\D)1 (pescari|echipe)\b/)).toHaveCount(0);
    await expect(view.getByText(/locuri libere$|loc liber$|^Ultim|^Complet$|^Fără limită de locuri$/).first()).toBeVisible();
    // The followers pill keeps its job (cards.c5).
    await expect(view.getByRole('button', { name: /^\d+ urmăritor(i)?$/ }).first()).toBeVisible();
    // No aside beside the rows: they take the width.
    await expect(page.getByRole('complementary', { name: 'Ce se întâmplă acum' })).toHaveCount(0);
    // The bento stays above (c28).
    await expect(page.getByRole('region', { name: 'Pulsul concursurilor' })).toBeVisible();
    await settled(page);
    await expectNoA11yViolations(page);

    // Below 1024: fish's cards.
    await page.setViewportSize(CARDS);
    await expect(view).toBeHidden();
    await expect(list(page).locator('article').first()).toBeVisible();
    // Afiș at 1280: the posters, not the agenda.
    await page.setViewportSize(DESKTOP);
    await page.getByRole('group', { name: 'Afișare' }).getByText('Afiș', { exact: true }).click();
    await expect(view).toHaveCount(0);
    await expect(list(page).getByRole('button', { name: /^Vezi imaginea pentru / }).first()).toBeVisible();
    await page.getByRole('group', { name: 'Afișare' }).getByText('Listă', { exact: true }).click();
    await expect(view).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('competitions-list.index.c31 competitions-list.index.c32 competitions-list.index.s21 — Live: the hub (hero, top five, moments, weighings, heaviest fish, other live), its reads re-read with the list', async ({ page }) => {
    const errors = collectConsoleErrors(page, { ignore: /Failed to load resource/ });
    await page.clock.install();
    const rankingReads: string[] = [];
    page.on('request', (r) => {
      if (RANKING.test(r.url())) rankingReads.push(r.url());
    });
    await page.setViewportSize(WIDE);
    await open(page, '/concursuri?status=started');
    const view = desktop(page);
    await expect(view).toHaveAttribute('data-desktop-tab', 'started');
    await expect(view.getByText('În prim-plan')).toBeVisible();
    // Signature numbers.
    await expect(view.getByText('kg cântărite', { exact: true })).toBeVisible();
    await expect(view.getByText('capturi', { exact: true }).first()).toBeVisible();
    // The ranking now: up to five rows, with places.
    await expect(view.getByText('Clasament acum')).toBeVisible();
    await expect(view.getByRole('heading', { level: 3, name: /Momente cheie/ })).toBeVisible();
    await expect(view.getByRole('heading', { level: 3, name: 'Cântăriri recente' })).toBeVisible();
    await expect(view.getByText('Cei mai grei pești acum')).toBeVisible();
    await expect(view.getByRole('heading', { level: 3, name: /^Tot live acum/ })).toBeVisible();
    // Hero links: the ranking and the weighings of that competition.
    await expect(view.getByRole('link', { name: 'Clasament live' }).first()).toHaveAttribute('href', /\/concursuri\/[^/]+\/clasament$/);
    // c32: the list and the hub's reads poll together, every 60s (fish LIVE_POLL_MS).
    await expect.poll(() => rankingReads.length).toBeGreaterThan(0);
    const first = rankingReads.length;
    const listPoll = page.waitForRequest((r) => /\/feed\/competition-cards\?/.test(r.url()) && r.url().includes('status=started'));
    await page.clock.runFor(61_000);
    await listPoll;
    await expect.poll(() => rankingReads.length).toBeGreaterThan(first);
    await settled(page);
    await expectNoA11yViolations(page);
    expect(errors).toEqual([]);
  });

  test('competitions-list.index.c31 — rule 4: while the rankings read the hub shows bones, never «nothing weighed»; a failed ranking hides its block', async ({ page }) => {
    const errors = collectConsoleErrors(page, { ignore: /Failed to load resource/ });
    // Hold every ranking: the hub must not claim anything about the catches meanwhile.
    let release: () => void = () => {};
    const held = new Promise<void>((r) => (release = r));
    let fail = false;
    await page.route(RANKING, async (r) => {
      if (fail) return json(r, { error: { status: 500, message: 'down' } }, 500);
      await held;
      await r.continue();
    });
    await page.setViewportSize(WIDE);
    await open(page, '/concursuri?status=started');
    const view = desktop(page);
    await expect(view.getByText('În prim-plan')).toBeVisible();
    await expect(view.locator('[aria-busy="true"]').first()).toBeVisible();
    await expect(view.getByText(/Încă nicio captură/)).toHaveCount(0);
    // No «0 capturi» nobody counted: a number from the card, a bone, or «–».
    release();
    await expect(view.locator('[aria-busy="true"]')).toHaveCount(0);

    // A failing ranking: its «Clasament acum» block goes, the hero stays.
    fail = true;
    await page.reload();
    await expect(view.getByText('În prim-plan')).toBeVisible();
    await expect.poll(async () => view.getByText('Clasament acum').count(), { timeout: 30_000 }).toBe(0);
    await expect(view.getByText(/Încă nicio captură/)).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('competitions-list.index.c33 competitions-list.index.c34 competitions-list.index.s22 — Rezultate: one winner per row; feeder in points; the row expands inline (podium, figures, places 4–8); arrows move between rows', async ({ page }) => {
    const errors = collectConsoleErrors(page, { ignore: /Failed to load resource/ });
    const rankingReads: string[] = [];
    page.on('request', (r) => {
      if (RANKING.test(r.url())) rankingReads.push(r.url());
    });
    await page.setViewportSize(DESKTOP);
    await open(page, '/concursuri?status=completed');
    const view = desktop(page);
    await expect(view).toHaveAttribute('data-desktop-tab', 'completed');
    // Month headers.
    await expect(view.getByRole('heading', { level: 3 }).first()).toHaveText(/\d{4}/);
    // c8 fan-out: no ranking read per row of the page — only the rows hovered, focused or opened.
    await page.waitForTimeout(1500);
    expect(rankingReads.length).toBeLessThanOrEqual(1);
    // Feeder ranks by points: its winner reads points, never kg (fish FeederRankingTable) — once
    // the row is hovered, its ranking is read.
    const feeder = view.locator('li').filter({ has: page.getByRole('button', { name: 'SIM3 Cupa C&B Ed 8', exact: true }) });
    await feeder.hover();
    await expect(feeder.getByText(/^\d+(,\d)? (de )?punct(e)?$/)).toBeVisible();
    await expect(feeder.getByText(/kg total/)).toHaveCount(0);
    // Expand inline.
    const toggle = feeder.getByRole('button', { name: 'SIM3 Cupa C&B Ed 8', exact: true });
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const panel = page.getByRole('region', { name: 'Rezultate SIM3 Cupa C&B Ed 8' });
    await expect(panel.getByText(/^Podium/)).toBeVisible();
    await expect(panel.getByText('În cifre')).toBeVisible();
    await expect(panel.getByText(/^\d+(,\d)? p$/).first()).toBeVisible();
    await expect(panel.getByRole('link', { name: /Clasamentul complet/ })).toHaveAttribute('href', /\/clasament$/);
    // §5: zero axe violations with a row open (podium on navy, the stat bento).
    await settled(page);
    await expectNoA11yViolations(page);
    // One open at a time; the second press closes it.
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    // A kg competition says kg (a non-feeder row with a weighed winner, once hovered).
    const kgRow = view.locator('li').filter({ has: page.getByRole('button', { name: 'TEST Card · Individual', exact: true }) });
    await kgRow.hover();
    await expect(kgRow.getByText(/ kg( total| · )/).first()).toBeVisible();
    // ↓ moves to the next row (roving tabindex).
    await toggle.focus();
    await page.keyboard.press('ArrowDown');
    await expect(toggle).not.toBeFocused();
    await expect(view.locator('button[aria-expanded]:focus')).toHaveCount(1);
    await settled(page);
    await expectNoA11yViolations(page);
    expect(errors).toEqual([]);
  });

  test('competitions-list.index.c31 — «Momente cheie» opens on its first moment (scrollLeft 0, «prev» disabled); the arrows page it by keyboard', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await open(page, '/concursuri?status=started');
    const view = desktop(page);
    const rail = view.locator('section[aria-labelledby="live-moments"] ul');
    await expect(rail).toBeVisible({ timeout: 30_000 });
    // The local CMS has more moments than fit at 1280: the rail overflows to the right only.
    await expect(rail).toHaveAttribute('data-next', 'true', { timeout: 30_000 });
    await settled(page);
    // Give late moments time to arrive: the rail must still be at its start (it used to re-snap to its end).
    await page.waitForTimeout(1500);
    expect(await rail.evaluate((el) => el.scrollLeft)).toBe(0);
    await expect(rail).toHaveAttribute('data-prev', 'false');
    const prev = view.getByRole('button', { name: 'Momentele anterioare' });
    const next = view.getByRole('button', { name: 'Următoarele momente' });
    await expect(prev).toBeDisabled();
    await expect(next).toBeEnabled();
    // Keyboard: Enter on «next» pages forward; «prev» wakes up and pages back to the start.
    await next.focus();
    await page.keyboard.press('Enter');
    await expect.poll(() => rail.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
    await expect(prev).toBeEnabled();
    await prev.focus();
    await page.keyboard.press('Enter');
    await expect.poll(() => rail.evaluate((el) => el.scrollLeft)).toBe(0);
    await expect(prev).toBeDisabled();
  });

  test('competitions-list.index.c31 — below 1024 the Live tab is the cards and the hub’s extra reads never start', async ({ page }) => {
    const extra: string[] = [];
    page.on('request', (r) => {
      if (RANKING.test(r.url()) || WEIGHINGS.test(r.url())) extra.push(r.url());
    });
    await page.setViewportSize(CARDS);
    await open(page, '/concursuri?status=started');
    await expect(list(page).locator('article').first()).toBeVisible();
    await page.waitForTimeout(1500);
    expect(extra).toEqual([]);
  });
});

test.describe('signed in', () => {
  test.beforeEach(async ({ context }) => {
    await signIn(context, jwt);
  });

  test('competitions-list.index.c33 — Rezultate keeps a tab stop when a refetch drops the focused row; «Clasament» is never a hidden click target', async ({ page }) => {
    const none = { capturedAt: '2026-09-20T10:00:00.000Z', hasCatches: false, catchCount: 0, totalKg: null, biggestFishKg: null, podium: [] };
    const done = (id: string, name: string, day: string, over: Record<string, unknown> = {}) =>
      card(id, { name, status: 'completed', startDate: `${day}T05:00:00.000Z`, endDate: `${day}T13:00:00.000Z`, dateLabel: '', results: none, joinedCount: 1, ...over });
    const a = done('fx-res-a', 'FX Rezultat A', '2026-09-20', { format: { kind: 'team', teamSize: 2, unit: 'echipe' } });
    const b = done('fx-res-b', 'FX Rezultat B', '2026-09-13');
    await page.route(/\/uploads\/fixture\.jpg/, (r) => r.fulfill({ body: PIXEL, contentType: 'image/png' }));
    await page.route(RANKING, (r) => json(r, { error: { status: 404, message: 'fixture' } }, 404));
    // A filter leaves the tab view for results mode (the cards), so what changes the rows under the
    // same mounted Results is a refetch: the next read (the first page came with the HTML) no longer
    // has the row that held the tab stop.
    await page.route(/\/feed\/competition-cards\?.*status=completed/, (r) => json(r, cardsPage([a, b], { counts: { notStarted: 0, started: 0, completed: 2 } })));
    await page.setViewportSize(DESKTOP);
    await open(page, '/concursuri?status=completed');
    const view = desktop(page);
    await expect(view).toHaveAttribute('data-desktop-tab', 'completed');
    const first = view.locator('button[aria-expanded]').first();
    await expect(first).toHaveAttribute('tabindex', '0');
    const firstName = (await first.textContent()) ?? '';
    await page.getByRole('button', { name: 'Reîmprospătează' }).click();
    const rowA = view.getByRole('button', { name: 'FX Rezultat A', exact: true });
    await expect(rowA).toBeVisible();
    await expect(view.getByRole('button', { name: firstName, exact: true })).toHaveCount(0);
    // Agreement: one team is «echipă», one angler «pescar» (never «1 echipe» / «1 pescari»).
    await expect(view.getByText(/^1 (pescari|echipe)$/)).toHaveCount(0);
    await expect(view.locator('li').filter({ has: page.getByRole('button', { name: 'FX Rezultat A', exact: true }) }).getByText('echipă', { exact: true })).toBeVisible();
    // The tab stop moved to the first row still in the list.
    await expect(rowA).toHaveAttribute('tabindex', '0');
    // Tab from the status tabs reaches the list (a row button), never skips it.
    await page.getByRole('tablist', { name: 'Stare concursuri' }).getByRole('tab', { selected: true }).focus();
    let inList = false;
    for (let i = 0; i < 30 && !inList; i++) {
      await page.keyboard.press('Tab');
      inList = await page.evaluate(() => !!document.activeElement?.closest('[data-desktop-tab]'));
    }
    expect(inList).toBe(true);
    await expect(rowA).toBeFocused();
    // «Clasament» hidden (row neither hovered, focused by keyboard nor open) takes no clicks.
    await page.mouse.move(0, 0);
    await rowA.blur();
    const action = view.locator('li').filter({ has: page.getByRole('button', { name: 'FX Rezultat B', exact: true }) }).getByRole('link', { name: 'Clasament', exact: true });
    await expect(action).toHaveCSS('opacity', '0');
    await expect(action).toHaveCSS('pointer-events', 'none');
  });

  test('competitions-list.index.c35 competitions-list.index.s23 — Ale mele: my registrations led by my real status, never sample rows', async ({ page }) => {
    const errors = collectConsoleErrors(page, { ignore: /Failed to load resource/ });
    await page.setViewportSize(DESKTOP);
    await open(page, '/concursuri?scope=registered');
    const view = desktop(page);
    await expect(view).toHaveAttribute('data-desktop-tab', 'mine');
    const rows = view.locator('[data-row]');
    await expect(rows.first()).toBeVisible();
    // The QA user's registration: a status pill once /my-status answers, and the next step.
    await expect(rows.first().getByText(/^(Înscris|În așteptare|Respins|Anulat|LIVE)$/).first()).toBeVisible();
    await expect(rows.first().getByText(/^(Acum|Rezultat|Pasul următor|Înscriere)$/)).toBeVisible();
    await expect(view.getByText('Exemplu')).toHaveCount(0);
    await settled(page);
    await expectNoA11yViolations(page);
    expect(errors).toEqual([]);
  });

  test('competitions-list.index.c30 — Viitoare: a not-started competition whose start passed is never «Săptămâna asta»; the tabs carry the counts as badges', async ({ page }) => {
    const errors = collectConsoleErrors(page, { ignore: /Failed to load resource/ });
    await page.route(/\/uploads\/fixture\.jpg/, (r) => r.fulfill({ body: PIXEL, contentType: 'image/png' }));
    const day = 86_400_000;
    const iso = (ms: number) => new Date(ms).toISOString();
    const stale = card('fx-stale', { name: 'FX Data trecută', startDate: iso(Date.now() - 8 * day), endDate: iso(Date.now() - 8 * day + 8 * 3_600_000) });
    const soon = card('fx-soon', { name: 'FX Curând', startDate: iso(Date.now() + 3_600_000), endDate: iso(Date.now() + 5 * 3_600_000) });
    // Nobody confirmed, one applied: «1 în așteptare», never «Fii primul înscris» beside it.
    const pending = card('fx-pending', { name: 'FX Doar în așteptare', joinedCount: 0, pendingCount: 1, startDate: iso(Date.now() + 4 * 3_600_000), endDate: iso(Date.now() + 6 * 3_600_000) });
    // One angler, no capacity: «1 pescar».
    const one = card('fx-one', { name: 'FX Un pescar', joinedCount: 1, capacity: null, placesLeft: null, startDate: iso(Date.now() + 5 * 3_600_000), endDate: iso(Date.now() + 7 * 3_600_000) });
    await page.route(FOLLOWED, (r) => json(r, cardsPage([stale, soon, pending, one], { counts: { notStarted: 2, started: 0, completed: 7 } })));
    await page.setViewportSize(DESKTOP);
    await open(page);
    await page.getByRole('button', { name: 'Concursuri urmărite' }).click();
    const view = desktop(page);
    const past = view.locator('section').filter({ has: page.getByRole('heading', { level: 3, name: /^Data de start a trecut/ }) });
    await expect(past.getByRole('link', { name: 'FX Data trecută' })).toBeVisible();
    // LAST in the agenda (what is ahead leads), with no sentence explaining the data, and no
    // register promise for a start that is gone: «Vezi», drawn on the row's one link.
    await expect(view.getByRole('heading', { level: 3 }).last()).toHaveText(/^Data de start a trecut/);
    await expect(view.getByText(/Figurează încă/)).toHaveCount(0);
    const staleRow = past.locator('[data-row]').filter({ hasText: 'FX Data trecută' });
    await expect(staleRow.getByText('Vezi', { exact: true })).toBeVisible();
    await expect(staleRow.getByText('Înscrie-te', { exact: true })).toHaveCount(0);
    await expect(staleRow.getByRole('link')).toHaveCount(1);
    const pendingRow = view.locator('[data-row]').filter({ hasText: 'FX Doar în așteptare' });
    await expect(pendingRow.getByText('1 în așteptare', { exact: true })).toHaveCount(1);
    await expect(pendingRow.getByText('Fii primul înscris')).toHaveCount(0);
    const oneRow = view.locator('[data-row]').filter({ hasText: 'FX Un pescar' });
    await expect(oneRow.getByText('1 pescar', { exact: true })).toBeVisible();
    const week = view.locator('section').filter({ has: page.getByRole('heading', { level: 3, name: /^Săptămâna asta/ }) });
    await expect(week.getByRole('link', { name: 'FX Data trecută' })).toHaveCount(0);
    await expect(week.getByRole('link', { name: 'FX Curând' })).toBeVisible();
    // §4b.20: the list's counts as badges (a zero is never drawn).
    const tabs = page.getByRole('tablist', { name: 'Stare concursuri' });
    await expect(tabs.getByRole('tab', { name: 'Viitoare, 2' })).toHaveAttribute('aria-selected', 'true');
    await expect(tabs.getByRole('tab', { name: 'Rezultate, 7' })).toBeVisible();
    await expect(tabs.getByRole('tab', { name: 'Live', exact: true })).toBeVisible();
    await settled(page);
    await expectNoA11yViolations(page);
    expect(errors).toEqual([]);
  });
});
