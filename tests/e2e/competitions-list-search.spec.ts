import { expect, test, type BrowserContext, type Page, type Route } from '@playwright/test';
import { periodOptions } from '../../core/competitions/domain/competitionPeriods';
import { expectNoA11yViolations } from './helpers/a11y';
import { qaJwt, signIn } from './helpers/session';
import { card, page as cardsPage } from './competitions-list.fixtures';

/*
 * Concursuri — search dialog, filters dialog and results mode: parity docs/parity/areas/
 * competitions-list.yml, screens competitions-list.search, competitions-list.filters and
 * competitions-list.results. Each test names the criterion (<screen-id>.c<n>) and state
 * (<screen-id>.s<n>, the n-th entry of the screen's `states`) ids it covers.
 *
 * Local CMS on :1337: the default suggestions are «Bălți cu concursuri» (Balta Roveng first, Chita
 * Lake…) and «Organizatori»; «chita» answers Chita Lake (14 competitions) and one competition. The
 * suggestions and every list read after the first paint are browser requests, so page.route can
 * shape the states the data lacks. The county list (/lakes/explore/suggestions) is answered by a
 * fixture: the local CMS has no Public grant for it (a guest gets 403 there).
 */

const PHONE = { width: 375, height: 812 };
const TABLET = { width: 768, height: 1000 };
const DESKTOP = { width: 1280, height: 900 };

const SUGGESTIONS = /\/feed\/competition-suggestions(\?|$)/;
const PUBLIC = /\/feed\/competition-cards\?/;
const FOLLOWED = /\/feed\/my-competition-cards\?.*scope=followed/;
const COUNTIES = /\/lakes\/explore\/suggestions\?/;
const CHITA = 's84u55lo4n9z0emngozttt6e';

test.describe.configure({ timeout: 120_000 });
// Other units run Playwright against the same tree: no trace artifacts to collide over.
test.use({ trace: 'off' });

/** The results chrome's back square (an empty state also offers «Înapoi la concursuri», as text). */
// Two placements (the sticky band below 1280, the centre column from 1280): the one on screen.
const backButton = (page: Page) => page.locator('[aria-label="Înapoi la concursuri"]:visible');

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

function consoleErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  return errors;
}

async function captureEvents(context: BrowserContext) {
  await context.addInitScript(() => {
    const w = window as unknown as { __events: unknown[]; gtag: (...a: unknown[]) => void };
    w.__events = [];
    w.gtag = (_cmd, name, params) => w.__events.push({ name, params });
  });
}
const events = (page: Page) => page.evaluate(() => (window as unknown as { __events: { name: string; params: Record<string, unknown> }[] }).__events);

async function open(page: Page, path = '/concursuri') {
  await page.goto(path);
  await expect(page.getByRole('heading', { level: 1, name: 'Concursuri' })).toBeAttached();
  await expect(page.locator('#concursuri-lista-titlu')).toBeVisible();
}

const searchPill = (page: Page) => page.getByRole('button', { name: 'Caută un concurs, o baltă sau un organizator' });
const dialog = (page: Page) => page.getByRole('dialog');
const searchField = (page: Page) => dialog(page).getByRole('combobox', { name: 'Caută un concurs, o baltă sau un organizator' });
/** A suggestion row — an option of the dialog's listbox (the ⌘K palette's combobox model). */
const option = (page: Page, name: string | RegExp) => dialog(page).getByRole('option', { name });
const groupTitles = (page: Page) => dialog(page).locator('[role="listbox"] [role="group"] > p');
const list = (page: Page) => page.locator('#concursuri-lista');
const heading = (page: Page) => page.locator('#concursuri-lista-titlu');

async function openSearch(page: Page) {
  await searchPill(page).click();
  await expect(dialog(page).getByRole('heading', { name: 'Caută în Concursuri' })).toBeVisible();
  await expect(searchField(page)).toBeFocused();
}

/** Picks a lake through the dialog — the results list is then a browser request (mockable). */
async function searchChita(page: Page) {
  await openSearch(page);
  await searchField(page).fill('chita');
  await option(page, /^Chita Lake\. Baltă/).click();
  await expect(heading(page)).toHaveText('Rezultate pentru „Chita Lake”');
}

async function openFiltersDialog(page: Page) {
  await page.getByRole('button', { name: /^Filtre(, \d+ active)?$/ }).first().click();
  await expect(dialog(page).getByRole('heading', { name: 'Filtre', exact: true })).toBeVisible();
}

const countyPage = (suggestions: { type: string; title: string; countyId?: string }[], page: number, pageCount: number) => ({
  data: {
    suggestions: suggestions.map((s, i) => ({ id: `${s.type}-${i}-${page}`, subtitle: '3 bălți', icon: s.type === 'nearby' ? 'location' : s.type, color: '#fff', ...s })),
  },
  meta: {
    query: '',
    normalizedTokens: [],
    countsByType: { nearby: 1, county: 42, city: 10, lake: 100 },
    pagination: { page, pageSize: 20, pageCount, total: 40 },
  },
});

test.describe('competitions-list.search', () => {
  test('competitions-list.search.c1 competitions-list.search.c2 competitions-list.search.c3 competitions-list.search.c6 competitions-list.search.c7 competitions-list.search.s1 — opens from the pill, focused; the server groups as sent; closing changes nothing', async ({ page }) => {
    const errors = consoleErrors(page);
    await page.setViewportSize(PHONE);
    await open(page);
    const before = page.url();
    await openSearch(page);
    // Full screen on the phone (fish Modal).
    const box = await dialog(page).boundingBox();
    expect(box?.width).toBe(PHONE.width);
    expect(box?.height).toBeGreaterThanOrEqual(PHONE.height - 1);
    await expect(searchField(page)).toHaveAttribute('placeholder', 'Concurs, baltă sau organizator');
    // c6: the groups in the server's order and titles; c7: one tinted tile per kind, «{title}. {subtitle}».
    await expect(groupTitles(page)).toHaveText(['Bălți cu concursuri', 'Organizatori']);
    await expect(dialog(page).getByRole('group', { name: 'Organizatori' })).toBeVisible();
    const lake = option(page, 'Balta Roveng. Baltă · 18 concursuri');
    await expect(lake).toBeVisible();
    await expect(lake).toHaveAttribute('data-kind', 'lake');
    await expect(option(page, /^Sim QA\. Organizator · \d+ concursuri$/)).toHaveAttribute('data-kind', 'organizer');
    // The opening fade settled (axe would read the colours mid-transition).
    await expect(dialog(page)).toHaveCSS('opacity', '1');
    await page.waitForTimeout(400);
    await expectNoA11yViolations(page);
    // c2: «Închide» returns to the tab unchanged — typing never filters the list behind.
    await searchField(page).fill('roveng');
    await dialog(page).getByRole('button', { name: 'Închide' }).click();
    await expect(dialog(page)).toBeHidden();
    expect(page.url()).toBe(before);
    await expect(page.getByRole('tab', { name: 'Viitoare' })).toHaveAttribute('aria-selected', 'true');
    // Reopened, it starts fresh.
    await openSearch(page);
    await expect(searchField(page)).toHaveValue('');
    await page.keyboard.press('Escape');
    await expect(dialog(page)).toBeHidden();
    expect(errors).toEqual([]);
  });

  test('competitions-list.search.c4 competitions-list.search.c5 competitions-list.search.s3 competitions-list.search.s4 competitions-list.search.s5 — debounced 260ms, no q when empty, cached; the loading border; skeleton only before any group', async ({ page }) => {
    await page.setViewportSize(TABLET);
    const asked: string[] = [];
    const askedAt: number[] = [];
    let hold: Promise<void> | null = null;
    await page.route(SUGGESTIONS, async (r) => {
      asked.push(r.request().url());
      askedAt.push(Date.now());
      if (hold) await hold;
      await r.continue();
    });
    let release!: () => void;
    hold = new Promise<void>((res) => (release = res));
    await open(page);
    await searchPill(page).click();
    // s4: the first load with no groups yet → skeleton rows, never an empty message.
    await expect(dialog(page).locator('[data-skeleton-row]').first()).toBeVisible();
    await expect(dialog(page).locator('[data-loading]')).toHaveCount(1);
    release();
    hold = null;
    await expect(dialog(page).getByRole('group', { name: 'Bălți cu concursuri' })).toBeVisible();
    expect(new URL(asked[0]).search).toBe('');
    await expect(dialog(page).locator('[data-loading]')).toHaveCount(0);
    // s3: typing debounces — nothing is asked before 260ms, and the previous groups stay meanwhile.
    asked.length = 0;
    askedAt.length = 0;
    hold = new Promise<void>((res) => (release = res));
    await searchField(page).pressSequentially('chi', { delay: 40 });
    const typedAt = Date.now();
    await expect(dialog(page).locator('[data-loading]')).toHaveCount(1);
    await expect(dialog(page).getByRole('group', { name: 'Bălți cu concursuri' })).toBeVisible();
    await expect.poll(() => asked.length).toBe(1);
    // One request for the whole word, asked no sooner than the debounce after the last key.
    expect(askedAt[0] - typedAt).toBeGreaterThanOrEqual(200);
    expect(new URL(asked[0]).searchParams.get('q')).toBe('chi');
    await expect(dialog(page).getByRole('group', { name: 'Bălți cu concursuri' })).toBeVisible();
    await expect(dialog(page).locator('[data-loading]')).toHaveCount(1);
    release();
    hold = null;
    // s5: a typed term with suggestions.
    await expect(option(page, /^Chita Lake\. Baltă/)).toBeVisible();
    await expect(dialog(page).locator('[data-loading]')).toHaveCount(0);
    // Cached 60s: the same term again asks nothing.
    await searchField(page).fill('');
    await searchField(page).fill('chi');
    await page.waitForTimeout(600);
    expect(asked.length).toBe(1);
  });

  test('competitions-list.search.c3 competitions-list.search.c10 competitions-list.search.c11 competitions-list.search.c14 competitions-list.search.s6 competitions-list.results.c11 competitions-list.results.s3 — free text: Enter commits the trimmed term, never an empty one; nothing suggested says so', async ({ page, context }) => {
    await captureEvents(context);
    await page.route(SUGGESTIONS, (r) => (new URL(r.request().url()).searchParams.get('q') ? json(r, { data: { groups: [{ title: 'Bălți', items: [] }] } }) : r.continue()));
    await page.setViewportSize(PHONE);
    await open(page);
    await openSearch(page);
    // Empty: Enter does nothing.
    await searchField(page).press('Enter');
    await expect(dialog(page)).toBeVisible();
    await searchField(page).fill('  cupa xyz  ');
    // c10: the free-text row first.
    await expect(option(page, 'Caută „cupa xyz”. În nume, bălți și organizatori')).toBeVisible();
    // c11: groups with no items are dropped and the empty line says what to do.
    await expect(dialog(page).getByText('Nu am găsit sugestii. Poți căuta textul liber de mai sus.')).toBeVisible();
    await expect(dialog(page).getByRole('group', { name: 'Bălți', exact: true })).toHaveCount(0);
    // Only the settled outcome is announced (one live region), never each keystroke.
    await expect(dialog(page).getByRole('status')).toHaveText('Nu am găsit sugestii.');
    await expectNoA11yViolations(page);
    const asked = page.waitForRequest((r) => PUBLIC.test(r.url()) && r.url().includes('q=cupa'));
    await searchField(page).press('Enter');
    const req = await asked;
    await expect(dialog(page)).toBeHidden();
    // results.c11: q, and no status (every state).
    const params = new URL(req.url()).searchParams;
    expect(params.get('q')).toBe('cupa xyz');
    expect(params.has('status')).toBe(false);
    await expect(page).toHaveURL(/q=cupa\+xyz/);
    await expect(heading(page)).toHaveText('Rezultate pentru „cupa xyz”');
    // c14: the pick type only — never the typed text.
    expect(await events(page)).toContainEqual({ name: 'competitions_search_committed', params: { type: 'text' } });
    expect(JSON.stringify(await events(page))).not.toContain('cupa');
  });

  test('competitions-list.search.c9 competitions-list.search.c12 competitions-list.search.c13 competitions-list.search.s2 competitions-list.results.c1 competitions-list.results.c2 competitions-list.results.c10 competitions-list.results.c11 competitions-list.results.s1 competitions-list.results.s2 competitions-list.results.s6 — a lake / organizer pick commits by documentId; the picks become recents', async ({ page, context }) => {
    await captureEvents(context);
    await page.addInitScript(() => {
      if (!sessionStorage.getItem('recents-reset')) {
        localStorage.removeItem('recentCompetitionSearches');
        sessionStorage.setItem('recents-reset', '1');
      }
    });
    await page.setViewportSize(DESKTOP);
    await open(page);
    // Come from Live, so leaving results has somewhere to return to (results.c2 / c5).
    await page.getByRole('tab', { name: 'Live' }).click();
    const asked = page.waitForRequest((r) => PUBLIC.test(r.url()) && r.url().includes(`lakeId=${CHITA}`));
    await searchChita(page);
    const params = new URL((await asked).url()).searchParams;
    expect(params.get('lakeId')).toBe(CHITA);
    expect(params.has('status')).toBe(false);
    expect(params.has('q')).toBe(false);
    await expect(page).toHaveURL(new RegExp(`lakeId=${CHITA}.*label=Chita\\+Lake|label=Chita\\+Lake.*lakeId=${CHITA}`));
    // results.c10: every state shown → «N concursuri»; results.s6: no chips after a fresh search.
    await expect(list(page).locator('p[aria-hidden]').getByText(/^\d+ (de )?concursuri$/)).toBeVisible();
    await expect(page.getByRole('group', { name: 'Filtre active' })).toHaveCount(0);
    await expect(page.getByRole('tab')).toHaveCount(0);
    expect(await events(page)).toContainEqual({ name: 'competitions_search_committed', params: { type: 'lake' } });

    // results.c4: the label reopens the search; search.c12 / c13: the pick is a recent now.
    await page.getByRole('button', { name: 'Chita Lake. Schimbă căutarea' }).click();
    await expect(searchField(page)).toBeFocused();
    await expect(dialog(page).getByRole('group', { name: 'Căutări recente' })).toBeVisible();
    const recent = dialog(page).locator('[data-kind="recent"]');
    await expect(recent).toHaveCount(1);
    await expect(recent).toHaveAccessibleName('Chita Lake. Baltă · 14 concursuri');
    // An organizer pick: by documentId, its name as the label; it joins the recents, newest first.
    const orgReq = page.waitForRequest((r) => PUBLIC.test(r.url()) && r.url().includes('organizerId='));
    await option(page, /^Sim QA\. Organizator/).click();
    expect(new URL((await orgReq).url()).searchParams.get('organizerId')).toBe('pducvrkstdjrtzop6isewt1u');
    await expect(heading(page)).toHaveText('Rezultate pentru „Sim QA”');
    // results.c5: back clears the search and returns to the tab from before (Live), focus on the h1.
    await backButton(page).click();
    await expect(page.getByRole('tab', { name: 'Live' })).toHaveAttribute('aria-selected', 'true');
    await expect(page).not.toHaveURL(/lakeId|organizerId|label/);
    await expect(page.getByRole('heading', { level: 1, name: 'Concursuri' })).toBeFocused();
    // Recents survive a reload (per browser), newest first.
    await page.reload();
    await openSearch(page);
    await expect(dialog(page).locator('[data-kind="recent"]')).toHaveText([/Sim QA/, /Chita Lake/]);
    // A typed term hides the recents; a recent pick behaves like the suggestion.
    await searchField(page).fill('x');
    await expect(dialog(page).getByRole('group', { name: 'Căutări recente' })).toHaveCount(0);
    await searchField(page).fill('');
    await dialog(page).locator('[data-kind="recent"]').nth(1).click();
    await expect(heading(page)).toHaveText('Rezultate pentru „Chita Lake”');
    // «Șterge tot» clears them.
    await page.getByRole('button', { name: 'Chita Lake. Schimbă căutarea' }).click();
    await dialog(page).getByRole('button', { name: 'Șterge tot' }).click();
    await expect(dialog(page).getByRole('group', { name: 'Căutări recente' })).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('recentCompetitionSearches'))).toBeNull();
    await page.keyboard.press('Escape');
    await expect(dialog(page)).toBeHidden();
  });

  test('competitions-list.search.c8 — a competition pick closes the dialog and opens that competition', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await open(page);
    await openSearch(page);
    await searchField(page).fill('chita');
    const pick = dialog(page).locator('[data-kind="competition"]').first();
    await expect(pick).toBeVisible();
    await pick.click();
    await expect(page).toHaveURL(/\/concursuri\/vmeg5vk0zucz7ravibmh3per$/);
  });

  test('competitions-list.search.s7 — a failed request: no suggestions, the free-text row still commits', async ({ page }) => {
    await page.route(SUGGESTIONS, (r) => json(r, { error: { status: 503, message: 'down' } }, 503));
    await page.setViewportSize(PHONE);
    await open(page);
    await openSearch(page);
    await expect(dialog(page).locator('p:not(.sr-only)', { hasText: 'Sugestiile nu s-au încărcat.' })).toBeVisible({ timeout: 30_000 });
    await expect(dialog(page).getByRole('button', { name: 'Încearcă din nou' })).toBeVisible();
    await searchField(page).fill('roveng');
    const row = option(page, 'Caută „roveng”. În nume, bălți și organizatori');
    await expect(row).toBeVisible();
    await row.click();
    await expect(heading(page)).toHaveText('Rezultate pentru „roveng”');
  });
});

test.describe('competitions-list.filters', () => {
  test('competitions-list.filters.c1 competitions-list.filters.c2 competitions-list.filters.c3 competitions-list.filters.c6 competitions-list.filters.c7 competitions-list.filters.c10 competitions-list.filters.c13 competitions-list.filters.c14 competitions-list.filters.s1 competitions-list.filters.s2 competitions-list.filters.s3 — the sheet: sections, presets from today, a live count, Resetează; closing discards the draft', async ({ page }) => {
    const errors = consoleErrors(page);
    await page.setViewportSize(PHONE);
    await open(page);
    await openFiltersDialog(page);
    const d = dialog(page);
    await expect(d.getByRole('button', { name: 'Închide' })).toBeVisible();
    // c3: STARE pills, the committed status (Viitoare) chosen.
    const stare = d.getByRole('group', { name: 'Stare' });
    await expect(stare.getByRole('radio')).toHaveCount(4);
    await expect(stare.getByRole('radio', { name: 'Viitoare' })).toBeChecked();
    for (const n of ['Orice stare', 'Live', 'Încheiate']) await expect(stare.getByRole('radio', { name: n })).toBeVisible();
    // c6 / c7: Viitoare's presets, built from today (the weekend carries its dates).
    const expected = periodOptions(new Date(), 'notStarted').map((p) => p.label.replace(' · ', ' · '));
    await expect(d.getByRole('group', { name: 'Perioadă' }).getByRole('radio')).toHaveCount(expected.length);
    for (const label of expected) await expect(d.getByRole('group', { name: 'Perioadă' }).getByText(label, { exact: true })).toBeAttached();
    expect(expected[2]).toMatch(/^Weekendul acesta · \d{1,2}( \w+\.)?–\d{1,2} \w+\.?$/);
    // c10: format.
    for (const n of ['Orice format', 'Individual', 'Echipe']) await expect(d.getByRole('group', { name: 'Format' }).getByRole('radio', { name: n })).toBeAttached();
    // c13: the count of the committed set, then of the draft (s3: known → «N concursuri»).
    const apply = d.getByRole('button', { name: /^Arată/ });
    await expect(apply).toHaveText(/^Arată \d+ (de )?concursuri$/);
    // c14 / s1: nothing active → Resetează disabled.
    const reset = d.getByRole('button', { name: 'Resetează' });
    await expect(reset).toBeDisabled();
    // s2: an active draft.
    await d.getByRole('group', { name: 'Format' }).getByText('Echipe', { exact: true }).click();
    await expect(reset).toBeEnabled();
    await expect(apply).toHaveText(/^Arată (1 concurs|\d+ (de )?concursuri)$/);
    await expectNoA11yViolations(page);
    await reset.click();
    await expect(d.getByRole('group', { name: 'Format' }).getByRole('radio', { name: 'Orice format' })).toBeChecked();
    await expect(reset).toBeDisabled();
    // c1 / c2: closing without applying discards the draft; the next opening starts from what is committed.
    await d.getByRole('group', { name: 'Format' }).getByText('Individual', { exact: true }).click();
    await d.getByRole('button', { name: 'Închide' }).click();
    await expect(dialog(page)).toBeHidden();
    await expect(page).not.toHaveURL(/format=/);
    await openFiltersDialog(page);
    await expect(dialog(page).getByRole('group', { name: 'Format' }).getByRole('radio', { name: 'Orice format' })).toBeChecked();
    expect(errors).toEqual([]);
  });

  test('competitions-list.filters.c13 competitions-list.filters.s3 — «Arată concursurile» until the count is known; «1 concurs» singular', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await open(page);
    let release!: () => void;
    const gate = new Promise<void>((res) => (release = res));
    await page.route(PUBLIC, async (r) => {
      if (!r.request().url().includes('format=team')) return r.continue();
      await gate;
      await json(r, cardsPage([card('fx-one')], { total: 1 }));
    });
    await openFiltersDialog(page);
    await dialog(page).getByRole('group', { name: 'Format' }).getByText('Echipe', { exact: true }).click();
    await expect(dialog(page).getByRole('button', { name: 'Arată concursurile' })).toBeVisible();
    release();
    await expect(dialog(page).getByRole('button', { name: 'Arată 1 concurs' })).toBeVisible();
  });

  test('competitions-list.filters.c4 competitions-list.filters.c5 competitions-list.filters.c15 competitions-list.filters.c16 competitions-list.filters.s4 competitions-list.filters.s7 competitions-list.results.c7 — STARE strands a period; Locuri libere only on a committed Viitoare; apply commits both and logs', async ({ page, context }) => {
    await captureEvents(context);
    await page.setViewportSize(PHONE);
    await open(page);
    await openFiltersDialog(page);
    const d = dialog(page);
    // s4: Viitoare committed → «Locuri libere» shown.
    await expect(d.getByRole('switch', { name: 'Locuri libere' })).toBeVisible();
    await expect(d.getByText('Doar concursurile care mai au locuri')).toBeVisible();
    await d.getByText('Următoarele 7 zile', { exact: true }).click();
    // c4 / s7: Încheiate cannot describe the next 7 days → «Oricând».
    await d.getByRole('group', { name: 'Stare' }).getByText('Încheiate', { exact: true }).click();
    await expect(d.getByRole('group', { name: 'Perioadă' }).getByRole('radio', { name: 'Oricând' })).toBeChecked();
    await expect(d.getByRole('group', { name: 'Perioadă' }).getByText('Următoarele 7 zile', { exact: true })).toHaveCount(0);
    // c6: Încheiate looks back (Oricând, this month, the two before); Live / Orice stare mix both.
    const presets = (st: 'completed' | 'started') => periodOptions(new Date(), st).map((p) => p.label);
    await expect(d.getByRole('group', { name: 'Perioadă' }).getByRole('radio')).toHaveCount(presets('completed').length);
    for (const label of presets('completed')) await expect(d.getByRole('group', { name: 'Perioadă' }).getByText(label, { exact: true })).toBeAttached();
    // Live accepts any period.
    await d.getByRole('group', { name: 'Stare' }).getByText('Live', { exact: true }).click();
    await expect(d.getByRole('group', { name: 'Perioadă' }).getByRole('radio')).toHaveCount(presets('started').length);
    for (const label of presets('started')) await expect(d.getByRole('group', { name: 'Perioadă' }).getByText(label, { exact: true })).toBeAttached();
    await d.getByText('Următoarele 7 zile', { exact: true }).click();
    await d.getByRole('group', { name: 'Stare' }).getByText('Orice stare', { exact: true }).click();
    await expect(d.getByRole('group', { name: 'Perioadă' }).getByRole('radio', { name: 'Următoarele 7 zile' })).toBeChecked();
    await d.getByRole('group', { name: 'Stare' }).getByText('Viitoare', { exact: true }).click();
    // The draft's preview asks for this exact list; applying then reuses it.
    const asked = page.waitForRequest((r) => PUBLIC.test(r.url()) && r.url().includes('availableOnly=true') && r.url().includes('period=next7'));
    await d.getByRole('switch', { name: 'Locuri libere' }).check();
    await d.getByRole('button', { name: /^Arată/ }).click();
    await expect(dialog(page)).toBeHidden();
    const params = new URL((await asked).url()).searchParams;
    expect(params.get('status')).toBe('notStarted');
    await expect(page).toHaveURL(/availableOnly=true/);
    await expect(page).toHaveURL(/period=next7/);
    await expect(page).toHaveURL(/status=notStarted/);
    // c15: one event with fish's payload; any active filter → results mode.
    expect(await events(page)).toContainEqual({
      name: 'competitions_filters_applied',
      params: { period: 'next7', format: 'all', available_only: true, county_id: 'none', county_name: 'none' },
    });
    await expect(heading(page)).toHaveText('Concursuri filtrate');
    // The toolbar's «Filtre» is gone with the mode change: the list's heading takes focus.
    await expect(heading(page)).toBeFocused();
    // results.c7: status, Locuri libere, period — in that order.
    await expect(page.getByRole('group', { name: 'Filtre active' }).getByRole('button')).toHaveText(['Viitoare', 'Locuri libere', 'Următoarele 7 zile', 'Șterge tot']);
    // c5: the status chip removed → the committed status is no longer Viitoare: the switch hides,
    // its value is kept (the chip stays).
    await page.getByRole('button', { name: 'Viitoare. Apasă pentru a renunța la acest filtru' }).click();
    await openFiltersDialog(page);
    await expect(dialog(page).getByRole('switch', { name: 'Locuri libere' })).toHaveCount(0);
    await dialog(page).getByRole('button', { name: 'Închide' }).click();
    await expect(page.getByRole('button', { name: 'Locuri libere. Apasă pentru a renunța la acest filtru' })).toBeVisible();
    // c16: one filter set for the page — leaving results and changing tab keeps nothing per tab.
    await backButton(page).click();
    await page.getByRole('tab', { name: 'Rezultate' }).click();
    await expect(page).not.toHaveURL(/period=|availableOnly=/);
  });

  test('competitions-list.filters.c8 competitions-list.filters.c9 competitions-list.filters.s6 competitions-list.results.c9 — the calendar: hints, bounds, a range stored in order', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await open(page);
    await openFiltersDialog(page);
    await dialog(page).getByRole('button', { name: 'Alege perioada din calendar' }).click();
    const d = dialog(page);
    await expect(d.getByRole('heading', { name: 'Perioadă', exact: true })).toBeVisible();
    await expect(d.getByRole('button', { name: 'Înapoi la filtre' })).toBeVisible();
    // filters.c9 + focus: the instruction line takes focus with the switch (never <body>).
    await expect(d.locator('[data-range-line]')).toHaveText('Apasă prima zi, apoi ultima.');
    await expect(d.locator('[data-range-line]')).toBeFocused();
    const now = new Date();
    const month = new Intl.DateTimeFormat('ro-RO', { month: 'long', year: 'numeric' }).format(now);
    await expect(d.getByText(month.charAt(0).toUpperCase() + month.slice(1), { exact: true })).toBeVisible();
    // Monday first.
    await expect(d.locator('abbr')).toHaveText(['Lu', 'Ma', 'Mi', 'Jo', 'Vi', 'Sâ', 'Du']);
    await expect(d.getByRole('button', { name: 'Luna anterioară' })).toBeDisabled();
    const gata = d.getByRole('button', { name: /^Aplică/ });
    await expect(gata).toBeDisabled();
    if (now.getDate() > 1) await expect(d.locator('[data-day]').first()).toBeDisabled();
    // Next month: pick the 12th, then the 10th (restarts), then the 14th.
    await d.getByRole('button', { name: 'Luna următoare' }).click();
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const key = (day: number) => `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    await d.locator(`[data-day="${key(12)}"]`).click();
    await expect(d.getByText('Acum alege ultima zi.')).toBeVisible();
    await expect(gata).toBeDisabled();
    await d.locator(`[data-day="${key(10)}"]`).click();
    await d.locator(`[data-day="${key(14)}"]`).click();
    const short = new Intl.DateTimeFormat('ro-RO', { month: 'short' }).format(next).replace(/\.$/, '');
    await expect(d.locator('[data-range-line]')).toHaveText(new RegExp(`^10–14 ${short}`));
    // The confirm echoes the choice.
    await expect(gata).toHaveText(new RegExp(`^Aplică 10–14 ${short}`));
    await expect(d.locator(`[data-day="${key(12)}"]`)).toHaveAttribute('aria-pressed', 'true');
    // «Gata» enabled — its fill settled (axe would read the colour mid-transition).
    await expect(gata).toHaveCSS('background-color', 'rgb(98, 101, 241)');
    await expectNoA11yViolations(page);
    // Next disabled after 24 months.
    for (let i = 1; i < 24; i++) await d.getByRole('button', { name: 'Luna următoare' }).click();
    await expect(d.getByRole('button', { name: 'Luna următoare' })).toBeDisabled();
    await gata.click();
    // c8: the row now carries the range, highlighted; focus is back on it.
    const row = d.getByRole('button', { name: /^Perioadă aleasă: 10–14 / });
    await expect(row).toBeVisible();
    await expect(row).toBeFocused();
    await d.getByRole('button', { name: /^Arată/ }).click();
    await expect(page).toHaveURL(new RegExp(`period=${key(10)}\\.\\.${key(14)}`));
    // results.c9: the chip says the range.
    // (Applied from Viitoare: the state is committed with it — fish onApply → changeStatus.)
    await expect(page.getByRole('group', { name: 'Filtre active' }).getByRole('button')).toHaveText(['Viitoare', new RegExp(`^10–14 ${short}`)]);
  });

  test('competitions-list.filters.c11 competitions-list.filters.c12 competitions-list.filters.s5 competitions-list.results.c7 — Județ: paged until a city appears, Romanian order, diacritic-insensitive search', async ({ page }) => {
    const pages: number[] = [];
    await page.route(COUNTIES, (r) => {
      const p = Number(new URL(r.request().url()).searchParams.get('page'));
      pages.push(p);
      if (p === 1) return json(r, countyPage([{ type: 'nearby', title: 'În jurul meu' }, { type: 'county', title: 'Vâlcea', countyId: 'c-vl' }, { type: 'county', title: 'Argeș', countyId: 'c-ag' }], 1, 5));
      return json(r, countyPage([{ type: 'county', title: 'Brașov', countyId: 'c-bv' }, { type: 'city', title: 'Pitești' }], 2, 5));
    });
    await page.setViewportSize(PHONE);
    await open(page);
    await openFiltersDialog(page);
    await dialog(page).getByRole('button', { name: 'Județ: toate județele' }).click();
    const d = dialog(page);
    await expect(d.getByRole('heading', { name: 'Județ', exact: true })).toBeVisible();
    // The kit's single-choice rows (radios), the county field focused with the switch.
    const field = d.getByRole('textbox', { name: 'Caută un județ' });
    await expect(field).toBeFocused();
    const group = d.getByRole('radiogroup', { name: 'Județe' });
    const rows = group.locator('label');
    await expect(rows).toHaveText(['Toate județele', 'Argeș', 'Brașov', 'Vâlcea']);
    expect(pages).toEqual([1, 2]);
    await expect(group.getByRole('radio', { name: 'Toate județele' })).toBeChecked();
    await field.fill('VALC');
    await expect(rows).toHaveText(['Toate județele', 'Vâlcea']);
    await field.fill('zzz');
    await expect(d.getByText('Niciun județ găsit.')).toBeVisible();
    await expectNoA11yViolations(page);
    await field.fill('arg');
    // The draft's preview asks for the county's list; applying reuses it.
    const asked = page.waitForRequest((r) => PUBLIC.test(r.url()) && r.url().includes('countyId=c-ag'));
    await group.getByText('Argeș', { exact: true }).click();
    await expect(d.getByRole('heading', { name: 'Filtre', exact: true })).toBeVisible();
    await expect(d.getByRole('button', { name: 'Județ: Argeș' })).toBeVisible();
    // Back on «Filtre», focus returns to the row that opened the view.
    await expect(d.getByRole('button', { name: 'Județ: Argeș' })).toBeFocused();
    // Keyboard: the arrows only move the choice; Enter picks it.
    await d.getByRole('button', { name: 'Județ: Argeș' }).click();
    await expect(field).toBeFocused();
    await page.keyboard.press('Tab');
    await page.keyboard.press('ArrowDown');
    await expect(d.getByRole('heading', { name: 'Județ', exact: true })).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(d.getByRole('button', { name: /^Județ: (Brașov|Vâlcea)$/ })).toBeFocused();
    await d.getByRole('button', { name: /^Județ:/ }).click();
    await group.getByText('Argeș', { exact: true }).click();
    await d.getByRole('button', { name: /^Arată/ }).click();
    await asked;
    await expect(page).toHaveURL(/countyId=c-ag/);
    await expect(page.getByRole('button', { name: 'Argeș. Apasă pentru a renunța la acest filtru' })).toBeVisible();
    // A reload keeps the county's name on its chip.
    await page.reload();
    await expect(page.getByRole('button', { name: 'Argeș. Apasă pentru a renunța la acest filtru' })).toBeVisible();
  });

  test('competitions-list.filters.s5 — «Se încarcă județele…» while the list loads', async ({ page }) => {
    let release!: () => void;
    const gate = new Promise<void>((res) => (release = res));
    await page.route(COUNTIES, async (r) => {
      await gate;
      await json(r, countyPage([{ type: 'county', title: 'Ilfov', countyId: 'c-if' }, { type: 'lake', title: 'Chita' }], 1, 1));
    });
    await page.setViewportSize(PHONE);
    await open(page);
    await openFiltersDialog(page);
    await dialog(page).getByRole('button', { name: 'Județ: toate județele' }).click();
    await expect(dialog(page).getByText('Se încarcă județele…')).toBeVisible();
    release();
    await expect(dialog(page).getByRole('radio', { name: 'Ilfov' })).toBeAttached();
  });

  test('competitions-list.filters.c11 competitions-list.filters.c9 — ≥1280 the docked column opens Județ and the calendar on their own; a pick applies at once', async ({ page }) => {
    await page.route(COUNTIES, (r) => json(r, countyPage([{ type: 'county', title: 'Ilfov', countyId: 'c-if' }, { type: 'lake', title: 'Chita' }], 1, 1)));
    await page.setViewportSize(DESKTOP);
    await open(page);
    const column = page.getByRole('complementary', { name: 'Filtre concursuri' });
    await column.getByRole('button', { name: 'Județ: toate județele' }).click();
    await expect(dialog(page).getByRole('heading', { name: 'Județ', exact: true })).toBeVisible();
    await expect(dialog(page).getByRole('button', { name: 'Înapoi la filtre' })).toHaveCount(0);
    await dialog(page).getByRole('radiogroup', { name: 'Județe' }).getByText('Ilfov', { exact: true }).click();
    await expect(dialog(page)).toBeHidden();
    await expect(page).toHaveURL(/countyId=c-if/);
    await expect(heading(page)).toHaveText('Concursuri filtrate');
    await expect(column.getByRole('button', { name: 'Județ: Ilfov' })).toBeVisible();
    await column.getByRole('button', { name: 'Alege perioada din calendar' }).click();
    await expect(dialog(page).getByRole('heading', { name: 'Perioadă', exact: true })).toBeVisible();
    await dialog(page).getByRole('button', { name: 'Renunță' }).click();
    await expect(dialog(page)).toBeHidden();
    await expectNoA11yViolations(page);
  });

  test('competitions-list.results.c6 — applying filters on Urmărite keeps Urmărite to return to', async ({ page, context, request }) => {
    await signIn(context, await qaJwt(request));
    await page.setViewportSize(PHONE);
    await open(page);
    await page.getByRole('button', { name: 'Concursuri urmărite' }).click();
    await expect(page.locator('#concursuri-lista-titlu')).toHaveText('Urmărite');
    await openFiltersDialog(page);
    const asked = page.waitForRequest((r) => FOLLOWED.test(r.url()) && r.url().includes('format=single'));
    await dialog(page).getByRole('group', { name: 'Format' }).getByText('Individual', { exact: true }).click();
    await dialog(page).getByRole('button', { name: /^Arată/ }).click();
    await asked;
    await expect(page).toHaveURL(/scope=followed/);
    await backButton(page).click();
    await expect(page.locator('#concursuri-lista-titlu')).toHaveText('Urmărite');
    await expect(page.getByRole('button', { name: 'Toate concursurile' })).toHaveAttribute('aria-pressed', 'true');
  });
});

test.describe('competitions-list.results', () => {
  test('competitions-list.results.c3 competitions-list.results.c4 competitions-list.results.c13 competitions-list.results.c14 competitions-list.results.s4 competitions-list.results.s9 — the results chrome; filters only: the label opens the filters; no bento; always from the top', async ({ page }) => {
    const errors = consoleErrors(page);
    await page.setViewportSize(PHONE);
    await open(page);
    await page.mouse.wheel(0, 1600);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(500);
    await page.getByRole('button', { name: 'Caută concursuri' }).click();
    await searchField(page).fill('chita');
    await option(page, /^Chita Lake\. Baltă/).click();
    // c13: results open at the top.
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    // c3: back square + pill (label, filters circle); the title row, eye, search row and tabs are gone.
    await expect(backButton(page)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Chita Lake. Schimbă căutarea' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Concursuri urmărite' })).toHaveCount(0);
    await expect(searchPill(page)).toHaveCount(0);
    await expect(page.getByRole('tablist')).toHaveCount(0);
    // c14: no bento.
    await expect(page.getByRole('region', { name: /Puls/i })).toHaveCount(0);
    await expect(page.getByRole('group', { name: 'Afișare' })).toBeVisible();
    await expectNoA11yViolations(page);
    // c4: the filters circle opens the filters.
    await page.getByRole('button', { name: 'Filtre', exact: true }).click();
    await expect(dialog(page).getByRole('heading', { name: 'Filtre', exact: true })).toBeVisible();
    await dialog(page).getByRole('group', { name: 'Format' }).getByText('Echipe', { exact: true }).click();
    await dialog(page).getByRole('button', { name: /^Arată/ }).click();
    await expect(page.getByRole('button', { name: 'Filtre, 1 active' })).toBeVisible();
    // s4: filters only — back, then a filter from the browse row: the label reads «Concursuri filtrate»
    // and opens the filters, not the search.
    await backButton(page).click();
    await openFiltersDialog(page);
    await dialog(page).getByRole('group', { name: 'Format' }).getByText('Echipe', { exact: true }).click();
    await dialog(page).getByRole('button', { name: /^Arată/ }).click();
    await expect(heading(page)).toHaveText('Concursuri filtrate');
    await page.getByRole('button', { name: 'Concursuri filtrate. Schimbă căutarea' }).click();
    await expect(dialog(page).getByRole('heading', { name: 'Filtre', exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('competitions-list.results.c7 competitions-list.results.c8 competitions-list.results.c9 competitions-list.results.s5 competitions-list.results.s7 — chips in order, each removes its own choice, «Șterge tot» past two', async ({ page, context }) => {
    await captureEvents(context);
    await page.setViewportSize(TABLET);
    const month = periodOptions(new Date(), 'all')[3];
    await open(page, `/concursuri?status=started&period=${month.value}&format=team&countyId=c-if&countyName=Ilfov`);
    const rail = page.getByRole('group', { name: 'Filtre active' });
    // c7 order: status (Live with its dot), county, period, format; c9: «{Lună} {an}».
    await expect(rail.getByRole('button')).toHaveText(['Live', 'Ilfov', month.label, 'Echipe', 'Șterge tot']);
    await expect(rail.getByRole('button', { name: 'Live. Apasă pentru a renunța la acest filtru' })).toBeVisible();
    await expect(heading(page)).toHaveText('Concursuri filtrate');
    // s5: narrowed to a state → the count agrees with it (none found: no «0» count, the empty state says it).
    await expect(
      list(page)
        .locator('p[aria-hidden]')
        .getByText(/^(1 concurs în desfășurare|\d+ (de )?concursuri în desfășurare)$/)
        .or(list(page).getByText('Niciun concurs cu aceste filtre', { exact: true })),
    ).toBeVisible();
    await expectNoA11yViolations(page);
    // Each chip removes just its choice (status → every state); focus moves to the next chip.
    await rail.getByRole('button', { name: 'Ilfov. Apasă pentru a renunța la acest filtru' }).click();
    await expect(rail.getByRole('button')).toHaveText(['Live', month.label, 'Echipe', 'Șterge tot']);
    await expect(rail.getByRole('button', { name: `${month.label}. Apasă pentru a renunța la acest filtru` })).toBeFocused();
    await rail.getByRole('button', { name: 'Live. Apasă pentru a renunța la acest filtru' }).click();
    await expect(rail.getByRole('button')).toHaveText([month.label, 'Echipe']);
    await expect(page).not.toHaveURL(/status=/);
    // c8: two chips → no «Șterge tot».
    await expect(rail.getByRole('button', { name: 'Șterge toate filtrele' })).toHaveCount(0);
    await rail.getByRole('button', { name: 'Echipe. Apasă pentru a renunța la acest filtru' }).click();
    await rail.getByRole('button', { name: `${month.label}. Apasă pentru a renunța la acest filtru` }).click();
    // Nothing narrowing → back to the tabs; the rail is gone, so the list's heading takes focus.
    await expect(page.getByRole('tablist')).toBeVisible();
    await expect(heading(page)).toBeFocused();
    // fish CompetitionFilterChips: a chip ✕ logs nothing (only «Arată …» does).
    expect((await events(page)).filter((e) => e.name === 'competitions_filters_applied')).toEqual([]);
  });

  test('competitions-list.results.c8 competitions-list.results.c9 — «Șterge tot» clears every filter and the status; preset chip labels', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await open(page, '/concursuri?q=cupa&status=notStarted&period=weekend&availableOnly=true&format=single');
    const rail = page.getByRole('group', { name: 'Filtre active' });
    await expect(rail.getByRole('button')).toHaveText(['Viitoare', 'Locuri libere', 'Weekendul acesta', 'Individual', 'Șterge tot']);
    await rail.getByRole('button', { name: 'Șterge toate filtrele' }).click();
    await expect(rail).toHaveCount(0);
    // The search stays: every state for «cupa».
    await expect(heading(page)).toHaveText('Rezultate pentru „cupa”');
    await expect(page).not.toHaveURL(/status=|period=|availableOnly=|format=/);
    await expect(heading(page)).toBeFocused();
    await open(page, '/concursuri?period=next7');
    await expect(page.getByRole('group', { name: 'Filtre active' }).getByRole('button')).toHaveText(['Următoarele 7 zile']);
  });

  test('competitions-list.results.c10 competitions-list.results.c12 competitions-list.results.s8 — empty: search, search + state, filters only', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await open(page);
    await page.route(PUBLIC, (r) => (r.request().url().includes('q=') || r.request().url().includes('format=team') ? json(r, cardsPage([], { total: 0, counts: { notStarted: 0, started: 0, completed: 0 } })) : r.continue()));
    await openSearch(page);
    await searchField(page).fill('nimic');
    await searchField(page).press('Enter');
    // The heading already names the question: a short title, no «0» count, no tabs named.
    await expect(heading(page)).toHaveText('Rezultate pentru „nimic”');
    await expect(list(page).getByText('Niciun rezultat', { exact: true })).toBeVisible();
    await expect(list(page).getByText('Încearcă altă stare sau caută altceva.')).toBeVisible();
    await expect(list(page).locator('p[aria-hidden]').getByText('0 concursuri', { exact: true })).toHaveCount(0);
    await expectNoA11yViolations(page);
    await page.getByRole('button', { name: 'Filtre', exact: true }).click();
    await dialog(page).getByRole('group', { name: 'Stare' }).getByText('Încheiate', { exact: true }).click();
    await dialog(page).getByRole('button', { name: /^Arată/ }).click();
    await expect(list(page).getByText('Niciun concurs încheiat', { exact: true })).toBeVisible();
    await backButton(page).click();
    await openFiltersDialog(page);
    await dialog(page).getByRole('group', { name: 'Format' }).getByText('Echipe', { exact: true }).click();
    await dialog(page).getByRole('button', { name: /^Arată/ }).click();
    await expect(list(page).getByText('Niciun concurs cu aceste filtre')).toBeVisible();
    await expect(list(page).getByText('Încearcă altă stare sau elimină câteva filtre.')).toBeVisible();
  });

  test('competitions-list.results.c10 competitions-list.results.s9 — «1 concurs»; a failed results list shows the error card', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await open(page);
    let fail = false;
    await page.route(PUBLIC, (r) => {
      if (!r.request().url().includes('q=')) return r.continue();
      return fail ? json(r, { error: { status: 503, message: 'down' } }, 503) : json(r, cardsPage([card('fx-one', { name: 'FX Unul' })], { total: 1 }));
    });
    await openSearch(page);
    await searchField(page).fill('unul');
    await searchField(page).press('Enter');
    await expect(list(page).locator('p[aria-hidden]').getByText('1 concurs', { exact: true })).toBeVisible();
    fail = true;
    await page.getByRole('button', { name: 'unul. Schimbă căutarea' }).click();
    await searchField(page).fill('altul');
    await searchField(page).press('Enter');
    await expect(list(page).getByRole('alert')).toBeVisible({ timeout: 30_000 });
  });
});

test.describe('competitions-list keyboard, focus and results chrome', () => {
  test('competitions-list.search.c3 competitions-list.search.c9 — a combobox: the arrows move the active option, Enter picks it; one Escape closes', async ({ page }) => {
    await page.setViewportSize(TABLET);
    await open(page);
    await openSearch(page);
    await searchField(page).fill('chita');
    await expect(option(page, /^Chita Lake\. Baltă/)).toBeVisible();
    await expect(searchField(page)).toHaveAttribute('aria-expanded', 'true');
    // Nothing active until an arrow: Enter would commit the text.
    await expect(dialog(page).locator('[role="option"][aria-selected="true"]')).toHaveCount(0);
    await page.keyboard.press('ArrowDown');
    const first = dialog(page).getByRole('option').first();
    await expect(first).toHaveAttribute('aria-selected', 'true');
    await expect(searchField(page)).toHaveAttribute('aria-activedescendant', (await first.getAttribute('id'))!);
    await page.keyboard.press('ArrowDown');
    await expect(option(page, /^Chita Lake\. Baltă/)).toHaveAttribute('aria-selected', 'true');
    // Focus never leaves the field.
    await expect(searchField(page)).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(heading(page)).toHaveText('Rezultate pentru „Chita Lake”');
    // A text field, not a search field: one Escape closes the dialog even with text typed.
    await page.getByRole('button', { name: 'Chita Lake. Schimbă căutarea' }).click();
    await searchField(page).fill('chi');
    await page.keyboard.press('Escape');
    await expect(dialog(page)).toBeHidden();
  });

  test('competitions-list.results.c5 competitions-list.results.c2 — back clears search and filters and restores the scope and status from before', async ({ page, context, request }) => {
    await signIn(context, await qaJwt(request));
    await page.setViewportSize(PHONE);
    await open(page);
    await page.getByRole('button', { name: 'Concursuri urmărite' }).click();
    await page.getByRole('tab', { name: 'Live' }).click();
    await expect(page.getByRole('tab', { name: 'Live' })).toHaveAttribute('aria-selected', 'true');
    await openSearch(page);
    await searchField(page).fill('cupa');
    await searchField(page).press('Enter');
    await expect(heading(page)).toHaveText('Rezultate pentru „cupa”');
    await expect(heading(page)).toBeFocused();
    await page.getByRole('button', { name: 'Filtre', exact: true }).click();
    await dialog(page).getByRole('group', { name: 'Format' }).getByText('Echipe', { exact: true }).click();
    await dialog(page).getByRole('button', { name: /^Arată/ }).click();
    await expect(page).toHaveURL(/format=team/);
    await backButton(page).click();
    await expect(page.getByRole('tab', { name: 'Live' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('button', { name: 'Toate concursurile' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page).toHaveURL(/scope=followed/);
    await expect(page).not.toHaveURL(/[?&](q|period|format)=/);
    await expect(page.getByRole('heading', { level: 1, name: 'Concursuri' })).toBeFocused();
  });

  test('competitions-list.results.s9 competitions-list.results.c14 — a new question shows bones while it reads, never the previous list', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await open(page);
    const firstCard = (await list(page).locator('li').first().innerText()).split('\n').find((l) => l.length > 6)!;
    let release!: () => void;
    const gate = new Promise<void>((res) => (release = res));
    await page.route(PUBLIC, async (r) => {
      if (!r.request().url().includes('q=abc')) return r.continue();
      await gate;
      await json(r, cardsPage([card('fx-abc', { name: 'FX Răspuns abc' })], { total: 1 }));
    });
    await openSearch(page);
    await searchField(page).fill('abc');
    await searchField(page).press('Enter');
    await expect(heading(page)).toHaveText('Rezultate pentru „abc”');
    await expect(list(page).getByText('Se încarcă concursurile…')).toBeAttached();
    await expect(list(page)).not.toContainText(firstCard);
    release();
    await expect(list(page).getByText('FX Răspuns abc')).toBeVisible();
  });

  test('competitions-list.filters.c3 competitions-list.filters.c13 competitions-list.filters.c15 — «Orice stare» applied opens «Toate concursurile», the count the button promised; a state applied logs', async ({ page, context }) => {
    await captureEvents(context);
    await page.setViewportSize(PHONE);
    await open(page);
    await openFiltersDialog(page);
    await dialog(page).getByRole('group', { name: 'Stare' }).getByText('Orice stare', { exact: true }).click();
    const apply = dialog(page).getByRole('button', { name: /^Arată \d+/ });
    await expect(apply).toBeVisible();
    const promised = (await apply.innerText()).replace(/^Arată /, '');
    await apply.click();
    await expect(heading(page)).toHaveText('Toate concursurile');
    await expect(page).toHaveURL(/status=all/);
    await expect(page.locator('[role="tab"][aria-selected="true"]')).toHaveCount(0);
    await expect(list(page).locator('p[aria-hidden]').getByText(promised, { exact: true })).toBeVisible();
    // A reload keeps it.
    await page.reload();
    await expect(heading(page)).toHaveText('Toate concursurile');
    // A state applied from the dialog logs competitions_status_changed (fish onApply → changeStatus).
    await openFiltersDialog(page);
    await dialog(page).getByRole('group', { name: 'Stare' }).getByText('Live', { exact: true }).click();
    await dialog(page).getByRole('button', { name: /^Arată/ }).click();
    await expect(page.getByRole('tab', { name: 'Live' })).toHaveAttribute('aria-selected', 'true');
    expect(await events(page)).toContainEqual({ name: 'competitions_status_changed', params: { status: 'started', scope: 'all' } });
  });

  test('competitions-list.results.c14 competitions-list.results.c3 — ≥1280: the chrome in the centre column, no rail, no circle, no aside; Reîmprospătează re-reads the list', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await open(page, `/concursuri?lakeId=${CHITA}&label=Chita+Lake&format=team`);
    // The row sits inside the centre column (right of the docked filters), not over all three.
    const column = page.getByRole('complementary', { name: 'Filtre concursuri' });
    const colBox = (await column.boundingBox())!;
    const backBox = (await backButton(page).boundingBox())!;
    expect(backBox.x).toBeGreaterThan(colBox.x + colBox.width);
    await expect(page.getByRole('group', { name: 'Filtre active' })).toBeHidden();
    await expect(page.getByRole('button', { name: /^Filtre(, \d+ active)?$/ })).toHaveCount(0);
    await expect(page.getByRole('complementary', { name: 'Ce se întâmplă acum' })).toHaveCount(0);
    // The square back and the pill share one height.
    const pill = page.getByRole('button', { name: 'Chita Lake. Schimbă căutarea' });
    expect(Math.round(backBox.width)).toBe(Math.round(backBox.height));
    const asked = page.waitForRequest((r) => PUBLIC.test(r.url()) && r.url().includes(`lakeId=${CHITA}`));
    await page.getByRole('button', { name: 'Reîmprospătează' }).click();
    await asked;
    await expect(pill).toBeVisible();
    // Filters only: the label focuses the docked column instead of opening a dialog.
    await open(page, '/concursuri?format=team');
    await page.getByRole('button', { name: 'Concursuri filtrate. Schimbă căutarea' }).click();
    await expect(dialog(page)).toBeHidden();
    await expect(column.getByRole('radio', { name: 'Orice stare' })).toBeFocused();
  });

  test('competitions-list.results.c14 — results narrowed to Live poll every 60s, as the Live tab', async ({ page }) => {
    await page.clock.install();
    await page.setViewportSize(PHONE);
    await open(page);
    let polls = 0;
    page.on('request', (r) => {
      if (PUBLIC.test(r.url()) && r.url().includes('q=cupa') && r.url().includes('status=started')) polls++;
    });
    await openSearch(page);
    await searchField(page).fill('cupa');
    await searchField(page).press('Enter');
    await page.getByRole('button', { name: 'Filtre', exact: true }).click();
    await dialog(page).getByRole('group', { name: 'Stare' }).getByText('Live', { exact: true }).click();
    await dialog(page).getByRole('button', { name: /^Arată/ }).click();
    await expect.poll(() => polls).toBeGreaterThanOrEqual(1);
    const before = polls;
    await page.clock.runFor(61_000);
    await expect.poll(() => polls).toBeGreaterThan(before);
  });

  test('competitions-list.results.c6 — filtered «Urmărite» says so; signed out, the gate returns to the same filtered list', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await open(page, '/concursuri?scope=followed&format=single');
    await expect(page.getByRole('button', { name: 'Urmărite · filtrate. Schimbă căutarea' })).toBeVisible();
    const href = await list(page).getByRole('link', { name: 'Intră în cont' }).getAttribute('href');
    const next = decodeURIComponent(href ?? '');
    expect(next).toContain('scope=followed');
    expect(next).toContain('format=single');
  });

  test('competitions-list.filters.c5 competitions-list.filters.c13 — «Locuri libere»: no count promised; a page emptied by it pages on', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await open(page);
    await page.route(PUBLIC, (r) => {
      const url = new URL(r.request().url());
      if (url.searchParams.get('availableOnly') !== 'true') return r.continue();
      // The CMS filters each page locally but counts the unfiltered set.
      if (url.searchParams.get('page') === '2') return json(r, cardsPage([card('fx-free', { name: 'FX Cu locuri' })], { total: 41, page: 2, pageCount: 2 }));
      return json(r, cardsPage([], { total: 41, page: 1, pageCount: 2 }));
    });
    await openFiltersDialog(page);
    await dialog(page).getByRole('switch', { name: 'Locuri libere' }).check();
    await expect(dialog(page).getByRole('button', { name: 'Arată concursurile' })).toBeVisible();
    await page.waitForTimeout(500);
    await expect(dialog(page).getByRole('button', { name: 'Arată concursurile' })).toBeVisible();
    await dialog(page).getByRole('button', { name: 'Arată concursurile' }).click();
    await expect(list(page).getByText('FX Cu locuri')).toBeVisible();
    await expect(list(page)).not.toContainText('41');
    await expect(list(page).locator('p[aria-hidden]').getByText('1 concurs viitor', { exact: true })).toBeVisible();
  });
});


test.describe('competitions-list batch 2 review fixes', () => {
  test('competitions-list.search.c5 competitions-list.search.s4 — after a term with no suggestions, typing on never swaps the line for skeleton rows', async ({ page }) => {
    await page.setViewportSize(TABLET);
    await open(page);
    await openSearch(page);
    await expect(dialog(page).getByRole('group', { name: 'Bălți cu concursuri' })).toBeVisible();
    await searchField(page).fill('zzzzqq');
    const line = dialog(page).getByText('Nu am găsit sugestii. Poți căuta textul liber de mai sus.');
    await expect(line).toBeVisible();
    // Any skeleton row painted from here on is recorded, however briefly.
    await page.evaluate(() => {
      const w = window as unknown as { __bones: number };
      w.__bones = 0;
      new MutationObserver(() => {
        if (document.querySelector('dialog[open] [data-skeleton-row]')) w.__bones++;
      }).observe(document.body, { subtree: true, childList: true });
    });
    await searchField(page).pressSequentially('qzx', { delay: 120 });
    await expect(dialog(page).locator('[data-loading]')).toHaveCount(0);
    await expect(line).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __bones: number }).__bones)).toBe(0);
  });

  test('competitions-list.search.s7 — a failed read with an empty term is announced', async ({ page }) => {
    await page.route(SUGGESTIONS, (r) => json(r, { error: { status: 503, message: 'down' } }, 503));
    await page.setViewportSize(PHONE);
    await open(page);
    await openSearch(page);
    await expect(dialog(page).locator('p:not(.sr-only)', { hasText: 'Sugestiile nu s-au încărcat.' })).toBeVisible({ timeout: 30_000 });
    await expect(dialog(page).locator('p[role="status"].sr-only')).toHaveText('Sugestiile nu s-au încărcat.');
  });

  test('competitions-list.search.c1 — from 768 the search dialog hugs a short answer (top-anchored, the field never moves)', async ({ page }) => {
    await page.setViewportSize(TABLET);
    await open(page);
    await openSearch(page);
    await expect(dialog(page).getByRole('group', { name: 'Bălți cu concursuri' })).toBeVisible();
    // After the opening scale-in.
    await page.waitForTimeout(500);
    const fieldTop = (await searchField(page).boundingBox())!.y;
    await searchField(page).fill('chita');
    await expect(option(page, /^Chita Lake\. Baltă/)).toBeVisible();
    await expect(dialog(page).locator('[data-loading]')).toHaveCount(0);
    const box = (await page.locator('dialog[open]').boundingBox())!;
    expect(box.height).toBeLessThan(560);
    expect(box.height).toBeGreaterThanOrEqual(320);
    expect((await searchField(page).boundingBox())!.y).toBe(fieldTop);
  });

  test('competitions-list.filters.c11 competitions-list.filters.c12 competitions-list.filters.s5 — a later county page that fails stops paging and says the list is partial', async ({ page }) => {
    const asked: number[] = [];
    await page.route(COUNTIES, (r) => {
      const p = Number(new URL(r.request().url()).searchParams.get('page'));
      asked.push(p);
      if (p === 1) return json(r, countyPage([{ type: 'county', title: 'Argeș', countyId: 'c-ag' }, { type: 'county', title: 'Bihor', countyId: 'c-bh' }], 1, 3));
      return json(r, { error: { status: 503, message: 'down' } }, 503);
    });
    await page.setViewportSize(PHONE);
    await open(page);
    await openFiltersDialog(page);
    await dialog(page).getByRole('button', { name: 'Județ: toate județele' }).click();
    const d = dialog(page);
    const rows = d.getByRole('radiogroup', { name: 'Județe' }).locator('label');
    await expect(rows).toHaveText(['Toate județele', 'Argeș', 'Bihor']);
    // The picker has no «Resetează / Arată …» footer under it.
    await expect(d.getByRole('button', { name: /^Arată/ })).toHaveCount(0);
    await expect(d.getByText('Unele județe nu s-au încărcat.')).toBeVisible({ timeout: 20_000 });
    const settled = asked.filter((p) => p === 2).length;
    // One fetchNextPage and its retries, then nothing more.
    expect(settled).toBeLessThanOrEqual(3);
    await page.waitForTimeout(4000);
    expect(asked.filter((p) => p === 2).length).toBe(settled);
    // A term matching nothing loaded: the partial notice, never «Se încarcă» nor «Niciun județ găsit».
    await d.getByRole('textbox', { name: 'Caută un județ' }).fill('Cluj');
    await expect(d.getByText('Unele județe nu s-au încărcat.')).toBeVisible();
    await expect(d.getByText('Se încarcă județele…')).toHaveCount(0);
    await expect(d.getByText('Niciun județ găsit.')).toHaveCount(0);
  });

  test('competitions-list.filters.c11 competitions-list.filters.c12 — unmocked: the local CMS lists the counties', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await open(page);
    await openFiltersDialog(page);
    await dialog(page).getByRole('button', { name: 'Județ: toate județele' }).click();
    const radios = dialog(page).getByRole('radiogroup', { name: 'Județe' }).getByRole('radio');
    await expect.poll(() => radios.count(), { timeout: 20_000 }).toBeGreaterThan(1);
  });

  test('competitions-list.results.c3 competitions-list.filters.c3 — ≥1280 entering results from the docked column keeps the column where it was; the header band says the answer', async ({ page }) => {
    for (const width of [1280, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await open(page);
      const column = page.getByRole('complementary', { name: 'Filtre concursuri' });
      const before = (await column.boundingBox())!.y;
      await column.getByText('Echipe', { exact: true }).click();
      await expect(page).toHaveURL(/format=team/);
      await expect(page.getByRole('button', { name: 'Concursuri filtrate. Schimbă căutarea' }).first()).toBeVisible();
      expect((await column.boundingBox())!.y).toBe(before);
      // The visible h1 stays, over a band with the count.
      await expect(page.getByRole('heading', { level: 1, name: 'Concursuri' })).toBeVisible();
      await expect(page.locator('header [aria-hidden]', { hasText: /concurs/ }).first()).toBeVisible();
    }
  });

  test('competitions-list.cards.c13 competitions-list.results.c10 — a results row mixing a podium and upcoming cards: each card hugs its content', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await open(page, '/concursuri?format=team');
    const items = list(page).locator('ul > li');
    await expect(items.first()).toBeVisible();
    const boxes = await items.evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return { top: Math.round(r.top), height: r.height, podium: Boolean(el.querySelector('ol[aria-label^="Podium"]')) };
      }),
    );
    const rows = new Map<number, typeof boxes>();
    for (const b of boxes) rows.set(b.top, [...(rows.get(b.top) ?? []), b]);
    const mixed = [...rows.values()].filter((r) => r.some((b) => b.podium) && r.some((b) => !b.podium));
    expect(mixed.length).toBeGreaterThan(0);
    for (const row of mixed) {
      const tallest = Math.max(...row.filter((b) => b.podium).map((b) => b.height));
      for (const b of row.filter((x) => !x.podium)) expect(b.height).toBeLessThan(tallest - 40);
    }
  });
});
