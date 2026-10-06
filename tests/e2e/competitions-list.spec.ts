import { collectConsoleErrors } from './helpers/console';
import { expect, test, type BrowserContext, type Page, type Route } from '@playwright/test';
import { expectNoA11yViolations } from './helpers/a11y';
import { qaJwt, signIn } from './helpers/session';
import { card, page as cardsPage, PIXEL, STATE_CARDS } from './competitions-list.fixtures';

/*
 * Concursuri (/concursuri, template T1) — parity inventory docs/parity/areas/competitions-list.yml,
 * screens competitions-list.index, competitions-list.cards and competitions-list.pulse. Each test
 * names, in full, the criterion (<screen-id>.c<n>) and state (<screen-id>.s<n>, the n-th entry of
 * the screen's `states`) ids it covers — /web-drift counts only full ids. Local CMS on :1337: 9 upcoming, 3 live, 28 completed competitions; the QA user follows one
 * live competition and has one finished registration.
 *
 * Card states the local data lacks are served by page.route on the «Urmărite» list (never
 * prefetched by the server without ?scope=followed, so the browser asks for it); the shared lists
 * are re-read through «Reîmprospătează» when a test mocks them.
 */

const DESKTOP = { width: 1280, height: 900 };
const WIDE = { width: 1440, height: 900 };
const PHONE = { width: 375, height: 812 };

const FOLLOWED = /\/feed\/my-competition-cards\?.*scope=followed/;
const REGISTERED = /\/feed\/my-competition-cards\?(?!.*status=).*scope=registered/;
const PUBLIC = /\/feed\/competition-cards\?/;

let jwt = '';
test.describe.configure({ timeout: 90_000 });
// Other units run Playwright against the same tree: no trace artifacts to collide over.
test.use({ trace: 'off' });
test.beforeAll(async ({ request }) => {
  jwt = await qaJwt(request);
});

function consoleErrors(page: Page) {
  return collectConsoleErrors(page, { ignore: /Failed to load resource/ });
}

/** Analytics: window.gtag captured (GA4 lands in M8; the call sites are already fish's). */
async function captureEvents(context: BrowserContext) {
  await context.addInitScript(() => {
    const w = window as unknown as { __events: unknown[]; gtag: (...a: unknown[]) => void };
    w.__events = [];
    w.gtag = (_cmd, name, params) => w.__events.push({ name, params });
  });
}
const events = (page: Page) => page.evaluate(() => (window as unknown as { __events: { name: string; params: Record<string, unknown> }[] }).__events);

async function fixtureImages(page: Page) {
  await page.route(/\/uploads\/fixture\.jpg/, (r) => r.fulfill({ body: PIXEL, contentType: 'image/png' }));
}

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

const tab = (page: Page, name: string | RegExp) => page.getByRole('tab', { name });
const list = (page: Page) => page.locator('#concursuri-lista');
const cardLink = (page: Page, name: string) => list(page).getByRole('link', { name, exact: true });

/**
 * The person tile (pulse.c16–c18): a competition person links to its ranking; an angler person is
 * plain text while the web has no angler profile (M2) — never a link to /pescari or /intra.
 */
async function expectPersonTile(bento: ReturnType<Page['getByRole']>) {
  const tile = bento.getByRole('link', { name: /^[A-ZĂÂÎȘȚ1 ]+: .+/ });
  if (await tile.count()) {
    expect((await tile.getAttribute('href')) ?? '').toMatch(/^\/concursuri\/[^/]+(\/clasament)?$/);
  } else {
    await expect(bento.locator('.t-title2').first()).toBeVisible();
  }
  for (const href of await bento.locator('a').evaluateAll((as) => as.map((a) => a.getAttribute('href') ?? ''))) {
    expect(href).not.toMatch(/\/pescari\/|^\/intra/);
  }
}

async function open(page: Page, path = '/concursuri') {
  await page.goto(path);
  await expect(page.getByRole('heading', { level: 1, name: 'Concursuri' })).toBeVisible();
  await expect(page.locator('#concursuri-lista-titlu')).toBeVisible();
}

/* ================================================================== */
/* Signed out                                                          */
/* ================================================================== */

test.describe('signed out', () => {
  test('competitions-list.index.c1 competitions-list.index.c2 competitions-list.index.c10 competitions-list.index.c11 competitions-list.index.c15 competitions-list.index.c28 competitions-list.index.s1 competitions-list.index.s9 — title, tabs, heading, count; public endpoint; bento on Viitoare', async ({ page }) => {
    const errors = consoleErrors(page);
    const personal: string[] = [];
    page.on('request', (r) => {
      if (/my-competition-cards/.test(r.url())) personal.push(r.url());
    });
    await page.setViewportSize(DESKTOP);
    await open(page);
    const tabs = page.getByRole('tablist', { name: 'Stare concursuri' }).getByRole('tab');
    await expect(tabs).toHaveText(['Viitoare', 'Live', 'Rezultate']);
    await expect(tab(page, 'Viitoare')).toHaveAttribute('aria-selected', 'true');
    // c4: no «Ale mele» tab signed out.
    await expect(tab(page, /Ale mele/)).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 2, name: 'Alege următorul start' })).toBeVisible();
    await expect(list(page).getByText(/^\d+ (de )?concursuri viitoare$|^1 concurs viitor$/).first()).toBeVisible();
    await expect(page.getByRole('region', { name: 'Pulsul concursurilor' })).toBeVisible();
    // c15: scope all never touches the per-user endpoint.
    expect(personal).toEqual([]);
    // c2: the active underline is accent (a 2px bar under the label).
    const underline = await tab(page, 'Viitoare').evaluate((el) => getComputedStyle(el, '::after').height);
    expect(parseFloat(underline)).toBeGreaterThanOrEqual(2);
    await expectNoA11yViolations(page);
    expect(errors).toEqual([]);
  });

  test('competitions-list.index.c1 competitions-list.index.s17 — phone: the title and tabs are a sticky chrome with a fade under it; it follows the top bar up', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await open(page);
    const chrome = page.locator('header').filter({ has: page.getByRole('heading', { level: 1, name: 'Concursuri' }) }).locator('..');
    await expect(chrome).toHaveCSS('position', 'sticky');
    const fade = await chrome.evaluate((el) => getComputedStyle(el, '::after').backgroundImage);
    expect(fade).toContain('linear-gradient');
    // At rest: in the flow, under the 56px top bar.
    expect((await chrome.boundingBox())!.y).toBeGreaterThanOrEqual(56);
    await page.mouse.move(180, 500);
    for (let i = 0; i < 5; i++) await page.mouse.wheel(0, 300);
    await expect(page.getByRole('heading', { level: 1, name: 'Concursuri' })).toBeInViewport();
    await expect(tab(page, 'Live')).toBeInViewport();
    // The bar slid away: the chrome follows it to the edge, so nothing scrolls past above the title.
    await expect(page.locator('header').and(page.locator('[data-concealed]'))).toHaveCount(1);
    await expect.poll(async () => Math.round((await chrome.boundingBox())!.y)).toBe(0);
  });

  test('competitions-list.index.c3 competitions-list.index.c5 competitions-list.index.c10 competitions-list.index.c11 competitions-list.index.c18 competitions-list.index.c28 competitions-list.index.s10 competitions-list.index.s11 — Live and Rezultate tabs; the event; Live polls every 60s', async ({ page, context }) => {
    await captureEvents(context);
    await page.clock.install();
    await page.setViewportSize(DESKTOP);
    await open(page);
    // c3: three live competitions locally → the dot leads the Live tab.
    await expect(tab(page, 'Live').locator('.animate-live')).toHaveCount(1);
    await tab(page, 'Live').click();
    await expect(page.getByRole('heading', { level: 2, name: 'Live acum' })).toBeVisible();
    await expect(list(page).getByText(/^\d+ (de )?concursuri în desfășurare$|^1 concurs în desfășurare$/).first()).toBeVisible();
    // c28: no bento off Viitoare.
    await expect(page.getByRole('region', { name: 'Pulsul concursurilor' })).toHaveCount(0);
    expect(await events(page)).toContainEqual({ name: 'competitions_status_changed', params: { status: 'started', scope: 'all' } });
    // c18: the live list re-reads on its own every minute.
    const polled = page.waitForRequest((r) => PUBLIC.test(r.url()) && r.url().includes('status=started'), { timeout: 10_000 });
    await page.clock.runFor(61_000);
    await polled;
    await tab(page, 'Rezultate').click();
    await expect(page.getByRole('heading', { level: 2, name: 'După ultima cântărire' })).toBeVisible();
    await expect(list(page).getByText(/concursuri încheiate$|1 concurs încheiat$/).first()).toBeVisible();
    // c18: Rezultate never polls.
    let polledCompleted = false;
    page.on('request', (r) => {
      if (PUBLIC.test(r.url()) && r.url().includes('status=started')) polledCompleted = true;
    });
    await page.clock.runFor(61_000);
    expect(polledCompleted).toBe(false);
  });

  test('competitions-list.index.c21 competitions-list.index.s1 — Urmărite signed out: the sign-in prompt, no request', async ({ page }) => {
    const personal: string[] = [];
    page.on('request', (r) => {
      if (/my-competition-cards/.test(r.url())) personal.push(r.url());
    });
    await page.setViewportSize(DESKTOP);
    await open(page);
    const eye = page.getByRole('button', { name: 'Concursuri urmărite' });
    await expect(eye).toHaveAttribute('aria-pressed', 'false');
    await eye.click();
    await expect(page.getByRole('button', { name: 'Toate concursurile' })).toHaveAttribute('aria-pressed', 'true');
    await expect(list(page).getByText('Intră în cont ca să vezi concursurile tale.')).toBeVisible();
    const cta = list(page).getByRole('link', { name: 'Intră în cont' });
    await expect(cta).toHaveAttribute('href', /^\/intra\?next=/);
    expect(personal).toEqual([]);
    await expectNoA11yViolations(page);
  });

  test('competitions-list.index.c27 competitions-list.index.s16 — ?status= opens that tab; anything else is ignored', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await open(page, '/concursuri?status=started');
    await expect(tab(page, 'Live')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('heading', { level: 2, name: 'Live acum' })).toBeVisible();
    await open(page, '/concursuri?status=completed');
    await expect(tab(page, 'Rezultate')).toHaveAttribute('aria-selected', 'true');
    await open(page, '/concursuri?status=bogus');
    await expect(tab(page, 'Viitoare')).toHaveAttribute('aria-selected', 'true');
    // The top bar's «Competiții» (no params) always opens Viitoare: the param never snaps back.
    await open(page, '/concursuri');
    await expect(tab(page, 'Viitoare')).toHaveAttribute('aria-selected', 'true');
  });

  test('competitions-list.index.c8 competitions-list.index.c9 competitions-list.index.s17 competitions-list.search.c1 — search row and filters; phone stand-ins fade in once it scrolls under the chrome', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await open(page);
    // The search pill opens the search dialog (search.c1): typing there never filters this list.
    const search = page.getByRole('button', { name: 'Caută un concurs, o baltă sau un organizator' });
    await expect(search).toBeVisible();
    await expect(search).toContainText('Concurs, baltă sau organizator');
    const rowFilters = page.locator('[aria-expanded]').filter({ hasText: '' }).and(page.getByRole('button', { name: 'Filtre', exact: true }));
    await expect(rowFilters).toBeVisible();
    // At the top the stand-ins are inert: never interactive together with the row they replace.
    const standIn = page.getByRole('button', { name: 'Caută concursuri' });
    await expect(standIn).toBeHidden();
    // The phone's title row holds three tools at a time: refresh at the top, the two stand-ins once tucked.
    await expect(page.getByRole('button', { name: 'Reîmprospătează' })).toBeVisible();
    await page.mouse.wheel(0, 900);
    await expect(standIn).toBeVisible();
    const inert = () => standIn.evaluate((el) => el.closest('[inert]') !== null);
    expect(await inert()).toBe(false);
    await expect(standIn).toHaveCSS('opacity', '1');
    await expect(page.getByRole('button', { name: 'Reîmprospătează' })).toBeHidden();
    // The title is never cut by the tools.
    expect(await page.getByRole('heading', { level: 1 }).evaluate((h) => h.scrollWidth <= h.clientWidth)).toBe(true);
    // search.c1: the header magnifier opens the search too.
    await standIn.click();
    await expect(page.getByRole('dialog').getByRole('combobox', { name: 'Caută un concurs, o baltă sau un organizator' })).toBeFocused();
    await page.getByRole('dialog').getByRole('button', { name: 'Închide' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    await page.mouse.wheel(0, 900);
    await expect(standIn).toBeVisible();
    await page.locator('header').getByRole('button', { name: 'Filtre', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('competitions-list.index.c13 competitions-list.index.c14 competitions-list.index.s15 — Listă / Afiș: one value, persisted (storage + cookie), compact by default; wider gap in Afiș', async ({ page, context }) => {
    await page.setViewportSize(DESKTOP);
    // Cleared once (the init script runs on the reload below too).
    await page.addInitScript(() => {
      if (!sessionStorage.getItem('density-reset')) {
        localStorage.removeItem('COMPETITION_CARD_DENSITY_V1');
        sessionStorage.setItem('density-reset', '1');
      }
    });
    await open(page);
    const toggle = page.getByRole('group', { name: 'Afișare' });
    await expect(toggle.getByRole('radio', { name: 'Listă' })).toBeChecked();
    const grid = list(page).locator('ul').first();
    await expect(grid).toHaveCSS('row-gap', '10px');
    // Clicking the active segment does nothing.
    await toggle.getByText('Listă', { exact: true }).click();
    await expect(toggle.getByRole('radio', { name: 'Listă' })).toBeChecked();
    await toggle.getByText('Afiș', { exact: true }).click();
    await expect(toggle.getByRole('radio', { name: 'Afiș' })).toBeChecked();
    await expect(grid).toHaveCSS('row-gap', '16px');
    expect(await page.evaluate(() => localStorage.getItem('COMPETITION_CARD_DENSITY_V1'))).toBe('expanded');
    // Mirrored into a cookie, so the server renders the next visit in Afiș (no re-layout).
    expect((await context.cookies()).find((c) => c.name === 'bluvi_competition_density')?.value).toBe('expanded');
    const html = await (await page.request.get('/concursuri')).text();
    // The Afiș poster frame (its own-ratio aspect) is in the server HTML, not swapped in after hydration.
    expect(html).toContain('aspect-(--poster-ratio)');
    await page.reload();
    await expect(page.getByRole('group', { name: 'Afișare' }).getByRole('radio', { name: 'Afiș' })).toBeChecked();
    // c10 (cards): the expanded poster is a full-width frame at its own ratio.
    const poster = list(page).getByRole('button', { name: /^Vezi imaginea pentru / }).first();
    await expect(poster).toBeVisible();
    await page.evaluate(() => localStorage.removeItem('COMPETITION_CARD_DENSITY_V1'));
    await context.clearCookies({ name: 'bluvi_competition_density' });
  });

  test('competitions-list.index.c13 competitions-list.index.s15 — blocked storage: the toggle still switches for the visit; labels at every width', async ({ page }) => {
    await page.addInitScript(() => {
      const fail = () => {
        throw new DOMException('blocked', 'SecurityError');
      };
      Storage.prototype.getItem = fail;
      Storage.prototype.setItem = fail;
    });
    await page.setViewportSize(PHONE);
    await open(page);
    const toggle = page.getByRole('group', { name: 'Afișare' });
    // fish: icon AND label, also on the phone.
    await expect(toggle.getByText('Listă', { exact: true })).toBeVisible();
    await expect(toggle.getByText('Afiș', { exact: true })).toBeVisible();
    await toggle.getByText('Afiș', { exact: true }).click();
    await expect(toggle.getByRole('radio', { name: 'Afiș' })).toBeChecked();
    await expect(list(page).locator('ul').first()).toHaveCSS('row-gap', '16px');
    await toggle.getByText('Listă', { exact: true }).click();
    await expect(toggle.getByRole('radio', { name: 'Listă' })).toBeChecked();
    await expect(list(page).locator('ul').first()).toHaveCSS('row-gap', '10px');
  });

  test('competitions-list.index.c16 competitions-list.index.s6 — Rezultate loads page 2 near the end, with the footer', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await open(page, '/concursuri?status=completed');
    const items = list(page).locator('ul').first().locator(':scope > li');
    await expect(items).toHaveCount(20);
    const next = page.waitForRequest((r) => PUBLIC.test(r.url()) && r.url().includes('status=completed') && r.url().includes('page=2'));
    const footer = page.getByText(/^20 din \d+ concursuri$/);
    const total = Number((await footer.textContent())!.match(/din (\d+)/)![1]);
    await footer.scrollIntoViewIfNeeded();
    await next;
    await expect(items).toHaveCount(Math.min(total, 40));
  });

  test('competitions-list.index.c20 — each list keeps its scroll offset; a new one starts at the top (phone: the tabs stay on screen)', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await open(page, '/concursuri?status=completed');
    await page.evaluate(() => window.scrollTo(0, 1600));
    await page.waitForTimeout(300);
    const at = await page.evaluate(() => window.scrollY);
    expect(at).toBeGreaterThan(1000);
    await tab(page, 'Live').click();
    await expect(page.getByRole('heading', { level: 2, name: 'Live acum' })).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    await tab(page, 'Rezultate').click();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(at);
  });

  test('competitions-list.index.c25 competitions-list.cards.c1 competitions-list.cards.c7 competitions-list.cards.c8 — the card is one link named by the competition', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await open(page);
    const link = cardLink(page, 'SIM3 Cupa C&B Ed 8');
    await expect(link).toHaveAttribute('href', '/concursuri/a6xjl65ooe9eadrtvvqj9hn1');
    const item = list(page).locator('article').filter({ has: page.getByRole('link', { name: 'SIM3 Cupa C&B Ed 8', exact: true }) });
    await expect(item.getByText('Chita Lake')).toBeVisible();
    await expect(item.getByText('Cantitate')).toBeVisible();
    await expect(item.getByText('Echipe', { exact: true })).toBeVisible();
    // Clicking anywhere on the card (not the poster or the pill) opens it.
    await item.scrollIntoViewIfNeeded();
    const box = await item.boundingBox();
    await page.mouse.click(box!.x + box!.width - 20, box!.y + box!.height - 12);
    await expect(page).toHaveURL(/\/concursuri\/a6xjl65ooe9eadrtvvqj9hn1/);
  });

  test('competitions-list.cards.c2 competitions-list.cards.c3 competitions-list.cards.c4 competitions-list.index.c26 competitions-list.index.s18 — poster button, LIVE date line, the photo viewer', async ({ page }) => {
    const errors = consoleErrors(page);
    await page.setViewportSize(DESKTOP);
    await page.addInitScript(() => localStorage.removeItem('COMPETITION_CARD_DENSITY_V1'));
    await open(page, '/concursuri?status=started');
    const name = '[CHAT25] Test chat v2 — Cantitate';
    const item = list(page).locator('article').filter({ has: page.getByRole('link', { name, exact: true }) });
    await expect(item.getByText(/^LIVE · /)).toBeVisible();
    // c2: a competition with a banner shows the banner (small), not the lake.
    const thumb = item.getByRole('button', { name: `Vezi imaginea pentru ${name}` });
    const src = await thumb.locator('img').getAttribute('src');
    const core = await (await page.request.get('http://localhost:1337/api/feed/competition-cards?status=started&page=1&pageSize=20')).json();
    const dto = core.data.find((c: { name: string }) => c.name === name);
    expect(decodeURIComponent(src ?? '')).toContain(dto.banner.smallUrl ?? dto.banner.url);
    await thumb.click();
    const viewer = page.getByRole('dialog', { name });
    await expect(viewer).toBeVisible();
    await expect(viewer.getByRole('img', { name: `Afișul concursului ${name}` })).toHaveAttribute('src', dto.banner.url);
    await expect(viewer.getByText(dto.dateLabel, { exact: true })).toBeVisible();
    await expect(viewer.getByText(/kg/).first()).toBeVisible();
    // axe reads colours mid fade-in otherwise (a half-opaque chip measures below AA).
    await viewer.evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)));
    await expectNoA11yViolations(page);
    await page.keyboard.press('Escape');
    await expect(viewer).toBeHidden();
    await expect(page).toHaveURL(/\/concursuri\?status=started$/);
    await thumb.click();
    await page.getByRole('dialog', { name }).getByRole('button', { name: 'Vezi concursul' }).click();
    await expect(page).toHaveURL(new RegExp(`/concursuri/${dto.documentId}`));
    expect(errors).toEqual([]);
  });

  test('competitions-list.cards.c5 competitions-list.cards.c6 competitions-list.cards.s10 — the followers pill opens the followers list: docked panel from 1280, dialog below', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await open(page, '/concursuri?status=started');
    const item = list(page).locator('article').filter({ has: page.getByRole('link', { name: '[CHAT25] Test chat v2 — Cantitate', exact: true }) });
    const pill = item.getByRole('button', { name: /^\d+ urmăritor(i)?$/ });
    await pill.click();
    // Fundații §07: an angler list browsed beside the page is «context» → the side panel at 1280.
    const panel = page.getByRole('complementary', { name: 'Urmăritori' });
    await expect(panel).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Închide' })).toBeFocused();
    await expect(panel.getByText(/^\d+ urmăresc$/)).toBeVisible();
    // The angler profile is M2: until it ships the rows are the people (avatar + name), never a 404 link.
    await expect(panel.getByRole('listitem').first()).toBeVisible();
    await expect(panel.locator('a[href^="/pescari/"]')).toHaveCount(0);
    await page.waitForTimeout(600); // the panel's slide-in, so axe reads the settled colours
    await expectNoA11yViolations(page);
    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
    await expect(pill).toBeFocused();
    // The pill is not the card: the page did not navigate.
    await expect(page).toHaveURL(/\/concursuri\?status=started$/);
    // Tablet: a dialog.
    await page.setViewportSize({ width: 768, height: 1024 });
    await pill.click();
    await expect(page.getByRole('dialog', { name: 'Urmăritori' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Urmăritori' })).toBeHidden();
  });

  /* ------------------------------ pulse ------------------------------ */

  test('competitions-list.pulse.c1 competitions-list.pulse.c4 competitions-list.pulse.c7 competitions-list.pulse.c9 competitions-list.pulse.c10 competitions-list.pulse.c11 competitions-list.pulse.c12 competitions-list.pulse.c15 competitions-list.pulse.c24 competitions-list.pulse.s3 — the live stack: chips, pill, the biggest catch, dots, impression', async ({ page, context }) => {
    await captureEvents(context);
    await page.setViewportSize(DESKTOP);
    await open(page);
    const bento = page.getByRole('region', { name: 'Pulsul concursurilor' });
    const live = (await (await page.request.get('http://localhost:1337/api/feed/competition-cards?status=started&page=1&pageSize=20')).json()).meta.pagination.total;
    test.skip(live < 2, 'needs two or more live competitions locally');
    const pages = Math.min(6, live);
    const heroes = bento.getByRole('link', { name: /\. Vezi clasamentul$/ });
    await expect(heroes).toHaveCount(pages);
    await expect(bento.getByText('LIVE', { exact: true }).first()).toBeVisible();
    await expect(bento.getByText(/^\d+ (de )?capturi$|^Fără capturi$|^1 captură$/).first()).toBeVisible();
    await expect(bento.getByText(/^(CEA MAI MARE CAPTURĂ|DE PE BALTĂ)$/).first()).toBeVisible();
    await expect(bento.getByText(/în concurs · /).first()).toBeVisible();
    // c8: the dots are decoration.
    await expect(bento.locator('[aria-hidden="true"] > .rounded-full.bg-navy:visible')).toHaveCount(pages);
    // From 768 the dots ride inside the card: the hero ends level with the tiles.
    const heroBottom = await bento.locator('.snap-x').evaluate((el) => el.getBoundingClientRect().bottom);
    const tileBottom = await bento.getByRole('button', { name: /concursuri live$/ }).evaluate((el) => el.closest('.rounded-bento')!.getBoundingClientRect().bottom);
    expect(Math.abs(heroBottom - tileBottom)).toBeLessThanOrEqual(1);
    const ev = await events(page);
    expect(ev.filter((e) => e.name === 'competitions_hero_impression')).toHaveLength(1);
    await heroes.first().click();
    await expect(page).toHaveURL(/\/concursuri\/[a-z0-9]+$/);
    expect((await events(page)).some((e) => e.name === 'competitions_hero_pressed')).toBe(true);
  });

  test('competitions-list.pulse.c8 — the stack advances every 5s; a resting pointer pauses it; the first touch stops it', async ({ page }) => {
    await page.clock.install();
    await page.setViewportSize(DESKTOP);
    await open(page);
    const scroller = page.getByRole('region', { name: 'Pulsul concursurilor' }).locator('.snap-x');
    expect(await scroller.evaluate((el) => el.scrollLeft)).toBe(0);
    // A mouse resting on the stack pauses it: the card never changes under the cursor.
    await scroller.hover();
    await page.clock.runFor(11_000);
    expect(await scroller.evaluate((el) => el.scrollLeft)).toBe(0);
    // Leaving resumes it (paused, not stopped).
    await page.mouse.move(5, 5);
    await page.clock.runFor(5_100);
    await expect.poll(() => scroller.evaluate((el) => el.scrollLeft)).toBeGreaterThan(100);
    await page.clock.runFor(2_000);
    await page.waitForTimeout(800);
    await scroller.dispatchEvent('pointerdown');
    const at = await scroller.evaluate((el) => el.scrollLeft);
    await page.clock.runFor(11_000);
    expect(await scroller.evaluate((el) => el.scrollLeft)).toBe(at);
  });

  test('competitions-list.pulse.c6 competitions-list.pulse.c16 competitions-list.pulse.c17 competitions-list.pulse.c18 competitions-list.pulse.c19 competitions-list.pulse.c20 competitions-list.pulse.c22 competitions-list.pulse.s8 competitions-list.pulse.s9 competitions-list.pulse.s10 competitions-list.pulse.s11 — person, count, invite (signed out)', async ({ page, context }) => {
    const featured: string[] = [];
    page.on('request', (r) => {
      if (r.url().includes('/feed/featured-competition')) featured.push(r.url());
    });
    await captureEvents(context);
    await page.setViewportSize(DESKTOP);
    await open(page);
    const bento = page.getByRole('region', { name: 'Pulsul concursurilor' });
    await expect(bento.getByRole('button', { name: /concursuri live$/ })).toBeVisible();
    // The server draws a new person per request. The angler profile is M2: until it ships the tile
    // never links to /pescari (a 404) — a competition person opens its ranking, an angler is text.
    await expectPersonTile(bento);
    // c6: something is live → no featured request.
    expect(featured).toEqual([]);
    const count = bento.getByRole('button', { name: /^\d+ concursuri live$/ });
    await expect(count).toBeVisible();
    await expect(count).toHaveText(/^concurs(uri)? live$/);
    // Rule 4b-4: we don't know what a visitor follows, so signed out there is no invite at all
    // (not a sign-in variant of it) — at every width.
    await expect(bento.getByText(/Nu urmărești|Urmărește unul|Unul e LIVE acum/)).toHaveCount(0);
    await count.click();
    await expect(tab(page, 'Live')).toHaveAttribute('aria-selected', 'true');
    expect((await events(page)).some((e) => e.name === 'competitions_count_tile_pressed')).toBe(true);
    await page.setViewportSize(PHONE);
    await tab(page, 'Viitoare').click();
    await expect(bento.getByRole('button', { name: /^\d+ concursuri live$/ })).toBeVisible();
    await expect(page.getByText(/Nu urmărești|Urmărește unul|Unul e LIVE acum/)).toHaveCount(0);
  });

  test('competitions-list.pulse.c25 competitions-list.pulse.c8 competitions-list.pulse.s12 — reduced motion: the live dots do not pulse, the stack never auto-advances (the arrows still move it)', async ({ page }) => {
    await page.clock.install();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize(DESKTOP);
    await open(page);
    const dot = tab(page, 'Live').locator('.animate-live');
    await expect(dot).toHaveCSS('animation-iteration-count', '1');
    const bento = page.getByRole('region', { name: 'Pulsul concursurilor' });
    const scroller = bento.locator('.snap-x');
    await page.mouse.move(5, 5);
    await page.clock.runFor(16_000);
    expect(await scroller.evaluate((el) => el.scrollLeft)).toBe(0);
    await bento.getByRole('button', { name: 'Concursul următor' }).click();
    await expect.poll(() => scroller.evaluate((el) => el.scrollLeft)).toBeGreaterThan(100);
  });

  test('competitions-list.index.c17 competitions-list.index.s7 competitions-list.pulse.c23 — «Reîmprospătează» re-reads the list, the person and every card list', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await open(page);
    const person = page.waitForRequest((r) => r.url().includes('/feed/pulse-person'));
    const cards = page.waitForRequest((r) => PUBLIC.test(r.url()) && r.url().includes('status=notStarted'));
    const live = page.waitForRequest((r) => PUBLIC.test(r.url()) && r.url().includes('status=started'));
    const button = page.getByRole('button', { name: /Reîmprospătează|Se actualizează/ });
    await button.click();
    await Promise.all([person, cards, live]);
    await expect(page.getByRole('button', { name: 'Reîmprospătează' })).not.toHaveAttribute('aria-disabled');
    // A tab switch never shows the refresh spinner.
    await tab(page, 'Rezultate').click();
    await expect(page.getByRole('button', { name: 'Reîmprospătează' })).not.toHaveAttribute('aria-disabled');
  });

  test('competitions-list.index.s9 competitions-list.pulse.s3 — phone, tablet and wide layouts pass axe', async ({ page }) => {
    for (const size of [PHONE, { width: 768, height: 1024 }, WIDE]) {
      await page.setViewportSize(size);
      await open(page);
      await expect(page.getByRole('region', { name: 'Pulsul concursurilor' })).toBeVisible();
      await expectNoA11yViolations(page);
    }
  });
});

/* ================================================================== */
/* Signed in                                                           */
/* ================================================================== */

test.describe('signed in', () => {
  test.beforeEach(async ({ context, page }) => {
    await signIn(context, jwt);
    await fixtureImages(page);
  });

  test('competitions-list.index.c4 competitions-list.index.c6 competitions-list.index.c10 competitions-list.index.c11 competitions-list.index.s12 competitions-list.index.s13 — «Ale mele»: finished-only has no number; the mixed list asks for no status', async ({ page, context }) => {
    await captureEvents(context);
    await page.setViewportSize(DESKTOP);
    await open(page);
    const mine = tab(page, 'Ale mele');
    await expect(mine).toBeVisible();
    await expect(mine).toHaveAccessibleName('Ale mele');
    await mine.click();
    await expect(mine).toHaveAttribute('aria-selected', 'true');
    for (const s of ['Viitoare', 'Live', 'Rezultate']) await expect(tab(page, s)).toHaveAttribute('aria-selected', 'false');
    await expect(page.getByRole('heading', { level: 2, name: 'Înscrierile mele' })).toBeVisible();
    await expect(list(page).getByText(/^1 concurs$|^\d+ (de )?concursuri$/).first()).toBeVisible();
    expect(await events(page)).toContainEqual({ name: 'competitions_scope_changed', params: { scope: 'registered' } });
    // c5: a status tab leaves «Ale mele».
    await tab(page, 'Live').click();
    await expect(mine).toHaveAttribute('aria-selected', 'false');
    await expect(page.getByRole('heading', { level: 2, name: 'Live acum' })).toBeVisible();
  });

  test('competitions-list.index.c5 competitions-list.index.c27 competitions-list.index.s14 — filters keep «Urmărite» (and a reload keeps it); filtering from «Ale mele» leaves it', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await open(page);
    // The filter bar's Format chip: a popover of radios, applied as picked (owner rule 2: no column).
    const bar = page.getByRole('group', { name: 'Filtre concursuri' });
    const format = async (choice: string) => {
      await bar.getByRole('button', { name: /^Format/ }).click();
      await page.getByRole('dialog', { name: 'Format' }).getByText(choice, { exact: true }).click();
      await expect(page.getByRole('dialog', { name: 'Format' })).toBeHidden();
    };
    await page.getByRole('button', { name: 'Concursuri urmărite' }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'Urmărite' })).toBeVisible();
    const followedAsked = page.waitForResponse((r) => FOLLOWED.test(r.url()) && r.url().includes('format=single'));
    await format('Individual');
    await followedAsked;
    await expect(page).toHaveURL(/scope=followed/);
    await expect(page).toHaveURL(/format=single/);
    await expect(list(page)).not.toHaveAttribute('aria-busy');
    await expect(page.getByText('Se caută…')).toHaveCount(0);
    const shown = await list(page).innerText();
    // A reload (or a back, a shared link) returns to the same filtered followed list, not all competitions.
    await page.reload();
    await expect(page).toHaveURL(/scope=followed/);
    await expect(page.getByText('Se caută…')).toHaveCount(0);
    await expect.poll(() => list(page).innerText()).toBe(shown);
    // Clearing the filters goes back to «Urmărite».
    await format('Orice format');
    await expect(page.getByRole('heading', { level: 2, name: 'Urmărite' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Toate concursurile' })).toHaveAttribute('aria-pressed', 'true');
    // From «Ale mele», a filter is a status change: it leaves «Ale mele» (fish changeStatus).
    await page.getByRole('button', { name: 'Toate concursurile' }).click();
    await tab(page, /^Ale mele/).click();
    await expect(page.getByRole('heading', { level: 2, name: 'Înscrierile mele' })).toBeVisible();
    await format('Individual');
    await expect(page).toHaveURL(/format=single/);
    await expect(page).not.toHaveURL(/scope=/);
    await format('Orice format');
    await expect(tab(page, /^Ale mele/)).toHaveAttribute('aria-selected', 'false');
  });

  test('competitions-list.index.c4 — the badge counts upcoming + live registrations, «99+» above 99', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await open(page);
    let ahead = { notStarted: 2, started: 1, completed: 4 };
    await page.route(REGISTERED, (r) => json(r, cardsPage([card('fx-mine')], { counts: ahead, total: 7 })));
    await page.getByRole('button', { name: 'Reîmprospătează' }).click();
    await expect(tab(page, 'Ale mele, 3')).toBeVisible();
    await expect(tab(page, 'Ale mele, 3')).toContainText('3');
    ahead = { notStarted: 100, started: 20, completed: 0 };
    await page.getByRole('button', { name: 'Reîmprospătează' }).click();
    await expect(tab(page, 'Ale mele, 120')).toContainText('99+');
  });

  test('competitions-list.index.c7 competitions-list.index.c10 competitions-list.index.c12 competitions-list.index.c15 competitions-list.index.c19 competitions-list.index.c23 competitions-list.index.s14 — Urmărite: per-user endpoint, page size 20, previous list kept, count skeleton', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await open(page);
    let release!: () => void;
    const gate = new Promise<void>((res) => (release = res));
    const asked: string[] = [];
    await page.route(FOLLOWED, async (r) => {
      asked.push(r.request().url());
      await gate;
      await json(r, cardsPage([STATE_CARDS.liveCatches]));
    });
    const before = cardLink(page, 'SIM3 Cupa C&B Ed 8');
    await expect(before).toBeVisible();
    await page.getByRole('button', { name: 'Concursuri urmărite' }).click();
    await expect(page.getByRole('button', { name: 'Toate concursurile' })).toHaveAttribute('aria-pressed', 'true');
    // c19: the previous list stays while the new one loads; c12: the count is a skeleton, never «0».
    await expect(before).toBeVisible();
    await expect(list(page)).toHaveAttribute('aria-busy', 'true');
    await expect(list(page).getByText(/^0 concursuri/)).toHaveCount(0);
    release();
    await expect(page.getByRole('heading', { level: 2, name: 'Urmărite' })).toBeVisible();
    await expect(cardLink(page, 'FX Live cu capturi')).toBeVisible();
    // c15: the default values are left out of the query string.
    const url = new URL(asked[0]);
    expect(url.pathname).toMatch(/\/feed\/my-competition-cards$/);
    expect(Object.fromEntries(url.searchParams)).toEqual({ status: 'notStarted', page: '1', pageSize: '20', scope: 'followed' });
  });

  test('competitions-list.index.c24 competitions-list.index.s5 — Urmărite with nothing followed', async ({ page }) => {
    await page.route(FOLLOWED, (r) => json(r, cardsPage([], { total: 0 })));
    await page.setViewportSize(DESKTOP);
    await open(page);
    await page.getByRole('button', { name: 'Concursuri urmărite' }).click();
    await expect(list(page).getByText('Niciun concurs urmărit aici')).toBeVisible();
    await expect(page.getByText('Salvează concursurile care te interesează sau verifică celelalte taburi.')).toBeVisible();
    await expectNoA11yViolations(page);
  });

  test('competitions-list.index.c22 competitions-list.index.s3 — a failed list shows the error card; «Încearcă din nou» re-reads', async ({ page }) => {
    let fail = true;
    await page.route(FOLLOWED, (r) => (fail ? json(r, { error: { status: 503, message: 'down' } }, 503) : json(r, cardsPage([STATE_CARDS.upcomingPending]))));
    await page.setViewportSize(DESKTOP);
    await open(page);
    await page.getByRole('button', { name: 'Concursuri urmărite' }).click();
    const alert = list(page).getByRole('alert');
    await expect(alert.getByText('Serverul nu răspunde')).toBeVisible();
    await expect(alert.getByRole('button', { name: 'Deconectează-te' })).toHaveCount(0);
    await expectNoA11yViolations(page);
    fail = false;
    await alert.getByRole('button', { name: 'Încearcă din nou' }).click();
    await expect(cardLink(page, 'FX Viitor cu așteptare')).toBeVisible();
    // ROADMAP §4b-8: focus lands on the list's heading (never <body>), and a heading shows no ring.
    const focused = page.locator('h2:focus');
    await expect(focused).toHaveCount(1);
    await expect(focused).toHaveCSS('outline-style', 'none');
  });

  test('competitions-list.index.c22 — a dead session offers «Deconectează-te»', async ({ page }) => {
    await page.route(FOLLOWED, (r) => json(r, { error: { status: 401, message: 'Unauthorized' } }, 401));
    await page.setViewportSize(DESKTOP);
    await open(page);
    await page.getByRole('button', { name: 'Concursuri urmărite' }).click();
    await expect(list(page).getByRole('alert').getByText('Sesiunea a expirat')).toBeVisible();
    await expect(list(page).getByRole('button', { name: 'Deconectează-te' })).toBeVisible();
  });

  test('competitions-list.index.c3 — the Live dot follows the current list’s counts.started', async ({ page }) => {
    await page.route(FOLLOWED, (r) => json(r, cardsPage([STATE_CARDS.upcomingPending], { counts: { notStarted: 1, started: 0, completed: 0 } })));
    await page.setViewportSize(DESKTOP);
    await open(page);
    await expect(tab(page, 'Live').locator('.animate-live')).toHaveCount(1);
    await page.getByRole('button', { name: 'Concursuri urmărite' }).click();
    await expect(cardLink(page, 'FX Viitor cu așteptare')).toBeVisible();
    await expect(tab(page, 'Live').locator('.animate-live')).toHaveCount(0);
  });

  test('competitions-list.pulse.c18 — signed in, the person never opens the (M2) angler profile, nor sign-in', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await open(page);
    const bento = page.getByRole('region', { name: 'Pulsul concursurilor' });
    await expect(bento.getByRole('button', { name: /concursuri live$/ })).toBeVisible();
    await expectPersonTile(bento);
  });

  test('competitions-list.cards.c9 competitions-list.cards.c13 competitions-list.cards.c14 competitions-list.cards.c15 competitions-list.cards.c16 competitions-list.cards.c17 competitions-list.cards.s1 competitions-list.cards.s2 competitions-list.cards.s3 competitions-list.cards.s6 competitions-list.cards.s7 competitions-list.cards.s8 competitions-list.cards.s9 — every footer and chip state (Listă); footers line up across a row', async ({ page }) => {
    const errors = consoleErrors(page);
    await page.route(FOLLOWED, (r) => json(r, cardsPage(Object.values(STATE_CARDS))));
    await page.addInitScript(() => localStorage.removeItem('COMPETITION_CARD_DENSITY_V1'));
    await page.setViewportSize(WIDE);
    await open(page);
    await page.getByRole('button', { name: 'Concursuri urmărite' }).click();
    const item = (name: string) => list(page).locator('article').filter({ has: page.getByRole('link', { name, exact: true }) });
    await expect(item('FX Viitor cu așteptare')).toBeVisible();
    // c13
    await expect(item('FX Viitor cu așteptare').getByText('9/10 pescari')).toBeVisible();
    await expect(item('FX Viitor cu așteptare').getByText('2 în așteptare')).toBeVisible();
    await expect(item('FX Viitor cu așteptare').getByText('1 loc liber', { exact: true })).toBeVisible();
    await expect(item('FX Viitor fără limită').getByText('24 de echipe')).toBeVisible();
    await expect(item('FX Viitor complet').getByText(/loc(uri)? liber/)).toHaveCount(0);
    // c14 / c15
    await expect(item('FX Live fără statistici').getByText('Statisticile nu sunt disponibile.')).toBeVisible();
    await expect(item('FX Live fără capturi').getByText('Încă nu sunt capturi înregistrate.')).toBeVisible();
    const liveStats = item('FX Live cu capturi');
    await expect(liveStats.getByText('24 de pescari în concurs')).toBeVisible();
    await expect(liveStats.getByText('capturi', { exact: true })).toBeVisible();
    await expect(liveStats.getByText('23', { exact: true })).toBeVisible();
    await expect(liveStats.getByText('1.024,3')).toBeVisible();
    await expect(liveStats.getByText('7,647')).toBeVisible();
    await expect(liveStats.getByText('cântărite')).toBeVisible();
    await expect(liveStats.getByText('CMMC')).toBeVisible();
    await expect(item('FX Live fără total').getByText('cântărite')).toHaveCount(0);
    await expect(item('FX Live fără total').getByText('CMMC')).toHaveCount(0);
    // c9
    await expect(item('FX Feeder pe manșe').getByText('Feeder · Manșa 1/2')).toBeVisible();
    // A single-leg feeder has no leg to name (fish ea89c087).
    await expect(item('FX Feeder o manșă').getByText('Feeder', { exact: true })).toBeVisible();
    await expect(item('FX Feeder o manșă').getByText(/Manșa/)).toHaveCount(0);
    // c17
    await expect(item('FX Încheiat fără rezultate').getByText('Rezultatele nu sunt disponibile.')).toBeVisible();
    await expect(item('FX Încheiat fără capturi').getByText('Fără capturi înregistrate.')).toBeVisible();
    await expect(item('FX Încheiat fără podium').getByText('Deschide concursul pentru clasament.')).toBeVisible();
    // c16: sorted by place, club · stand, ties, cups 1–3, the first row tinted.
    const podium = item('FX Încheiat cu podium').getByRole('list', { name: /^Podium / }).getByRole('listitem');
    await expect(podium).toHaveCount(4);
    await expect(podium.nth(0)).toContainText('Echipa Unu');
    await expect(podium.nth(0)).toContainText('Stand 3');
    await expect(podium.nth(0)).toHaveClass(/bg-badge-yellow-bg/);
    await expect(podium.nth(1)).toContainText('CS Crap · Stand 7');
    await expect(podium.nth(2)).toContainText('La egalitate');
    await expect(podium.nth(0).getByRole('img', { name: 'Locul 1' })).toBeVisible();
    await expect(podium.nth(3).getByRole('img', { name: 'Locul 3' })).toBeVisible();
    // A guest without a photo gets an initials disc.
    await expect(podium.nth(2).getByText('IO', { exact: true })).toBeVisible();
    // c3: no poster → a plain grey square (no button).
    await expect(item('FX Live fără afiș').getByRole('button', { name: /^Vezi imaginea/ })).toHaveCount(0);
    // Every footer note sits under the same hairline as the stat footers.
    await expect(item('FX Live fără capturi').getByText('Încă nu sunt capturi înregistrate.')).toHaveCSS('border-top-width', '1px');
    // Cards of one grid row share their footer line (subgrid), whatever their footers hold.
    const footerTop = (name: string) => item(name).evaluate((a) => Math.round(a.children[1].getBoundingClientRect().top));
    const rowTop = (name: string) => item(name).evaluate((a) => Math.round(a.getBoundingClientRect().top));
    expect(await rowTop('FX Viitor fără limită')).toBe(await rowTop('FX Viitor cu așteptare'));
    expect(await footerTop('FX Viitor fără limită')).toBe(await footerTop('FX Viitor cu așteptare'));
    await expectNoA11yViolations(page);
    expect(errors).toEqual([]);
  });

  test('competitions-list.cards.c10 competitions-list.cards.c11 competitions-list.cards.c12 competitions-list.cards.s1 competitions-list.cards.s4 competitions-list.cards.s5 — Afiș: phone poster at the DTO ratio, clamped extremes, at every width (never cropped to a shared frame); chips inline without a poster', async ({ page }) => {
    await page.route(FOLLOWED, (r) => json(r, cardsPage(Object.values(STATE_CARDS))));
    await page.addInitScript(() => localStorage.setItem('COMPETITION_CARD_DENSITY_V1', 'expanded'));
    await page.setViewportSize(PHONE);
    await open(page);
    await page.getByRole('button', { name: 'Concursuri urmărite' }).click();
    const item = (name: string) => list(page).locator('article').filter({ has: page.getByRole('link', { name, exact: true }) });
    await expect(item('FX Afiș lat')).toBeVisible();
    const ratio = async (name: string) =>
      item(name)
        .getByRole('button', { name: `Vezi imaginea pentru ${name}` })
        .evaluate((el) => {
          const r = el.parentElement!.getBoundingClientRect();
          return r.width / r.height;
        });
    expect(await ratio('FX Afiș lat')).toBeCloseTo(1600 / 900, 1);
    // 200×1000 (0.2) is clamped to 0.55 and shown whole.
    expect(await ratio('FX Afiș foarte înalt')).toBeCloseTo(0.55, 1);
    await expect(item('FX Afiș foarte înalt').locator('img')).toHaveCSS('object-fit', 'contain');
    // From 768 the cards share rows, but each poster keeps its own (clamped) ratio: the whole poster
    // is this density's point, so no shared cropped frame; the cards hug their own height.
    await page.setViewportSize(WIDE);
    expect(await ratio('FX Afiș lat')).toBeCloseTo(1600 / 900, 1);
    expect(await ratio('FX Afiș foarte înalt')).toBeCloseTo(0.55, 1);
    await expect(item('FX Afiș foarte înalt').locator('img')).toHaveCSS('object-fit', 'contain');
    await expect(item('FX Afiș lat').locator('img')).toHaveCSS('object-fit', 'cover');
    // c11: LIVE + followers over the poster; without one, inline.
    await expect(item('FX Live cu capturi').getByText('LIVE', { exact: true })).toBeVisible();
    await expect(item('FX Live fără afiș').getByText('LIVE', { exact: true })).toBeVisible();
    await expect(item('FX Live fără afiș').getByRole('button', { name: /urmăritor/ })).toBeVisible();
    // c12: «DATE · HOURS», the name, lake · organizer.
    await expect(item('FX Viitor cu așteptare').getByText('20 oct · 08:00–16:00')).toBeVisible();
    await expect(item('FX Viitor cu așteptare').getByText('organizator_fx')).toBeVisible();
    await expectNoA11yViolations(page);
  });

  test('competitions-list.cards.c18 competitions-list.index.c26 — the photo caption: chips, entrants and the catch figures', async ({ page }) => {
    await page.route(FOLLOWED, (r) => json(r, cardsPage([STATE_CARDS.liveFeeder, STATE_CARDS.upcomingNoCapacity, STATE_CARDS.upcomingPending])));
    await page.addInitScript(() => localStorage.removeItem('COMPETITION_CARD_DENSITY_V1'));
    await page.setViewportSize(DESKTOP);
    await open(page);
    await page.getByRole('button', { name: 'Concursuri urmărite' }).click();
    await list(page).getByRole('button', { name: 'Vezi imaginea pentru FX Feeder pe manșe' }).click();
    let viewer = page.getByRole('dialog', { name: 'FX Feeder pe manșe' });
    await expect(viewer.getByText('LIVE · 20 oct')).toBeVisible();
    await expect(viewer.getByText('Feeder · Manșa 1/2')).toBeVisible();
    await expect(viewer.getByText('Individual')).toBeVisible();
    await expect(viewer.getByText('6 pescari')).toBeVisible();
    await expect(viewer.getByText('1.024,3 kg')).toBeVisible();
    await page.getByRole('button', { name: 'Închide imaginea' }).click();
    await list(page).getByRole('button', { name: 'Vezi imaginea pentru FX Viitor fără limită' }).click();
    viewer = page.getByRole('dialog', { name: 'FX Viitor fără limită' });
    await expect(viewer.getByText('Echipe de 3')).toBeVisible();
    await expect(viewer.getByText('24 echipe')).toBeVisible();
    await page.keyboard.press('Escape');
    await list(page).getByRole('button', { name: 'Vezi imaginea pentru FX Viitor cu așteptare' }).click();
    await expect(page.getByRole('dialog', { name: 'FX Viitor cu așteptare' }).getByText('9/10 pescari')).toBeVisible();
  });

  test('competitions-list.index.s12 — phone signed in passes axe with «Ale mele»', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await open(page);
    await expect(tab(page, 'Ale mele')).toBeVisible();
    await expectNoA11yViolations(page);
  });
});

/* ================================================================== */
/* Mocked lists: pulse states, list states the local data lacks       */
/* ================================================================== */

type MockCard = ReturnType<typeof card>;
const DAY = 86_400_000;
const inDays = (d: number) => new Date(Date.now() + d * DAY).toISOString();
const podiumRow = (over: Record<string, unknown> = {}) => ({ position: 1, displayName: 'Ana Pop', tied: false, standName: null, clubName: null, avatarUrls: [], ...over });
const caught = (podium: unknown[] = []) => ({ capturedAt: inDays(-1), hasCatches: true, catchCount: 12, totalKg: 84.5, biggestFishKg: 6.2, podium });

/** A pulse fixture card: no organizer, so no local person is drawn unless a test wants one. */
const pc = (id: string, over: Record<string, unknown> = {}) =>
  card(id, { name: `FX ${id}`, organizer: null, startDate: inDays(3), endDate: inDays(3), banner: null, lake: null, viewers: 0, ...over });

type PulseMock = { live?: MockCard[]; upcoming?: MockCard[]; completed?: MockCard[]; mine?: MockCard[]; person?: unknown; featured?: MockCard | null };

/**
 * Serves the bento's sources from `state` (read on every request, so a test can change it between
 * reads): the three public card lists by status, «Ale mele», the person and the featured draw.
 */
async function mockPulse(page: Page, state: PulseMock, gates: { person?: Promise<void>; featured?: Promise<void> } = {}) {
  await page.route(PUBLIC, (r) => {
    const status = new URL(r.request().url()).searchParams.get('status');
    const cards = status === 'started' ? state.live : status === 'notStarted' ? state.upcoming : status === 'completed' ? state.completed : undefined;
    if (!cards) return r.fallback();
    const counts = { notStarted: state.upcoming?.length ?? 0, started: state.live?.length ?? 0, completed: state.completed?.length ?? 0 };
    return json(r, cardsPage(cards, { counts, total: cards.length }));
  });
  if (state.mine) await page.route(REGISTERED, (r) => json(r, cardsPage(state.mine ?? [])));
  await page.route(/\/feed\/pulse-person/, async (r) => {
    await gates.person;
    await json(r, { data: state.person ?? null });
  });
  await page.route(/\/feed\/featured-competition/, async (r) => {
    await gates.featured;
    await json(r, { data: state.featured ?? null });
  });
}

/**
 * Opens on Live (no bento: the server reads no person / featured), re-reads every card list from
 * the mocks («Reîmprospătează»), then shows Viitoare — the bento picks from the mocked lists, and
 * its person / featured reads go to the mocks too.
 */
async function openPulse(page: Page) {
  await open(page, '/concursuri?status=started');
  await page.getByRole('button', { name: 'Reîmprospătează' }).click();
  await expect(page.getByRole('button', { name: 'Reîmprospătează' })).not.toHaveAttribute('aria-disabled');
  await tab(page, 'Viitoare').click();
  return page.getByRole('region', { name: 'Pulsul concursurilor' });
}

const heroLinks = (bento: ReturnType<Page['getByRole']>) => bento.getByRole('link', { name: /\. Vezi (clasamentul|concursul|rezultatele)$/ });

test.describe('pulse states (mocked lists)', () => {
  test.beforeEach(async ({ page }) => {
    await fixtureImages(page);
  });

  test('competitions-list.pulse.s1 competitions-list.pulse.c2 competitions-list.pulse.s6 — loading: hero and two equal tile skeletons; the tiles reveal together', async ({ page }) => {
    let releasePerson!: () => void;
    let releaseFeatured!: () => void;
    const person = new Promise<void>((r) => (releasePerson = r));
    const featured = new Promise<void>((r) => (releaseFeatured = r));
    await page.setViewportSize(DESKTOP);
    await mockPulse(page, { live: [], upcoming: [pc('soon', { name: 'FX Curând', organizer: { documentId: 'o1', username: 'org_fx', avatarUrl: null } })], completed: [] }, { person, featured });
    const bento = await openPulse(page);
    // Nothing live → the featured draw is waited for (the hero is decided once), the person too.
    await expect(bento).toHaveAttribute('aria-busy', 'true');
    const skeletons = bento.locator('.animate-shimmer.rounded-bento');
    await expect(skeletons).toHaveCount(3);
    const [a, b] = await Promise.all([skeletons.nth(1).boundingBox(), skeletons.nth(2).boundingBox()]);
    expect(Math.round(a!.width)).toBe(Math.round(b!.width));
    expect(Math.round(a!.height)).toBe(Math.round(b!.height));
    releasePerson();
    // Person + count land together (the local moment: the organizer of the upcoming one).
    await expect(bento.getByRole('button', { name: /concursuri încep în 7 zile$/ })).toBeVisible();
    await expect(bento.getByRole('link', { name: /^ORGANIZATOR|^[A-ZĂÂÎȘȚ ]+: org_fx/ })).toBeVisible();
    await expect(skeletons).toHaveCount(1);
    // The featured draw answers empty: the local discovery pick (ÎN CURÂND) takes the hero.
    releaseFeatured();
    await expect(heroLinks(bento)).toHaveCount(1);
    await expect(bento.getByText('ÎN CURÂND', { exact: true })).toBeVisible();
    await expect(bento).not.toHaveAttribute('aria-busy');
  });

  test('competitions-list.pulse.s6 competitions-list.pulse.c6 — nothing live: a featured competition takes the hero as RECOMANDAT', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await mockPulse(page, { live: [], upcoming: [pc('a')], completed: [], featured: pc('promo', { name: 'FX Promovat', joinedCount: 3 }) });
    const bento = await openPulse(page);
    await expect(heroLinks(bento)).toHaveText('FX Promovat');
    await expect(bento.getByText('RECOMANDAT', { exact: true })).toBeVisible();
  });

  test('competitions-list.pulse.s2 competitions-list.pulse.c1 competitions-list.index.s4 — no hero once everything settled: no bento; the empty Descoperă list', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await mockPulse(page, { live: [], upcoming: [], completed: [] });
    await openPulse(page);
    await expect(list(page).getByText('Niciun concurs găsit')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Pulsul concursurilor' })).toHaveCount(0);
  });

  test('competitions-list.pulse.s7 competitions-list.pulse.c4 competitions-list.pulse.c14 — nothing upcoming: the latest results card, over an empty list', async ({ page }) => {
    const state: PulseMock = {
      live: [],
      upcoming: [],
      completed: [pc('old', { status: 'completed', endDate: inDays(-9), results: caught([podiumRow({ displayName: 'Vechi' })]) }), pc('rez', { name: 'FX Rezultate', status: 'completed', endDate: inDays(-1), results: caught([podiumRow()]) })],
    };
    await page.setViewportSize(DESKTOP);
    await mockPulse(page, state);
    const bento = await openPulse(page);
    // The list below is empty; the bento stands on its own sources (fish renders it regardless).
    await expect(list(page).getByText('Niciun concurs găsit')).toBeVisible();
    await expect(heroLinks(bento)).toHaveCount(1);
    await expect(bento.getByRole('link', { name: 'FX Rezultate. Vezi rezultatele' })).toBeVisible();
    // The hero card (the person tile may name the same winner).
    const hero = bento.locator('article');
    await expect(hero.getByText('REZULTATE', { exact: true })).toBeVisible();
    await expect(hero.getByText('CÂȘTIGĂTOR', { exact: true })).toBeVisible();
    await expect(hero.getByText('Ana Pop', { exact: true })).toBeVisible();
    await expect(hero.getByText('84,5 kg cântărite')).toBeVisible();
    // A team: ECHIPA CÂȘTIGĂTOARE; a tie for first: LOCUL 1 LA EGALITATE.
    state.completed = [pc('rez', { name: 'FX Rezultate', status: 'completed', endDate: inDays(-1), format: { kind: 'team', teamSize: 2, unit: 'echipe' }, results: caught([podiumRow({ displayName: 'Echipa Alfa' })]) })];
    await page.getByRole('button', { name: 'Reîmprospătează' }).click();
    await expect(hero.getByText('ECHIPA CÂȘTIGĂTOARE', { exact: true })).toBeVisible();
    await expect(hero.getByText('Echipa Alfa', { exact: true })).toBeVisible();
    state.completed = [pc('rez', { name: 'FX Rezultate', status: 'completed', endDate: inDays(-1), results: caught([podiumRow({ tied: true })]) })];
    await page.getByRole('button', { name: 'Reîmprospătează' }).click();
    await expect(hero.getByText('LOCUL 1 LA EGALITATE', { exact: true })).toBeVisible();
  });

  test('competitions-list.pulse.c13 — the upcoming hero: ÎNSCRIȘI, / capacity, places left or complet, pending', async ({ page }) => {
    const state: PulseMock = { live: [], completed: [], upcoming: [pc('up', { name: 'FX Viitor', joinedCount: 6, capacity: 10, placesLeft: 4, pendingCount: 2, dateLabel: '8 oct' })] };
    await page.setViewportSize(DESKTOP);
    await mockPulse(page, state);
    const bento = await openPulse(page);
    await expect(bento.getByRole('link', { name: 'FX Viitor. Vezi concursul' })).toBeVisible();
    await expect(bento.getByText('PESCARI ÎNSCRIȘI', { exact: true })).toBeVisible();
    await expect(bento.getByText('/ 10', { exact: true })).toBeVisible();
    await expect(bento.getByText('8 oct · 4 locuri libere · 2 în așteptare')).toBeVisible();
    state.upcoming = [pc('up', { name: 'FX Viitor', joinedCount: 10, capacity: 10, placesLeft: 0, pendingCount: 0, dateLabel: '8 oct' })];
    await page.getByRole('button', { name: 'Reîmprospătează' }).click();
    await expect(bento.getByText('8 oct · complet')).toBeVisible();
  });

  test('competitions-list.pulse.c21 competitions-list.pulse.s8 — no person at all: the count tile takes the whole row (phone)', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await mockPulse(page, { live: [pc('live1', { name: 'FX Live singur', status: 'started', results: null })], upcoming: [], completed: [] });
    const bento = await openPulse(page);
    const count = bento.getByRole('button', { name: '1 concursuri live' });
    await expect(count).toBeVisible();
    await expect(bento.getByRole('link', { name: /^[A-ZĂÂÎȘȚ1 ]+: / })).toHaveCount(0);
    const tile = await count.evaluate((el) => el.closest('.rounded-bento')!.getBoundingClientRect().width);
    const row = await bento.evaluate((el) => el.getBoundingClientRect().width);
    expect(Math.abs(tile - row)).toBeLessThanOrEqual(1);
  });

  test('competitions-list.pulse.c5 — the pick is frozen: a re-read upcoming list does not swap the hero; a refresh does', async ({ page }) => {
    await page.clock.install();
    const state: PulseMock = { live: [], completed: [], upcoming: [pc('a', { name: 'FX Primul', joinedCount: 5 })] };
    await page.setViewportSize(DESKTOP);
    await mockPulse(page, state);
    const bento = await openPulse(page);
    await expect(heroLinks(bento)).toHaveText('FX Primul');
    // A busier start appears; the list re-reads on its own (stale after 5 min, back on the tab)…
    state.upcoming = [pc('a', { name: 'FX Primul', joinedCount: 5 }), pc('b', { name: 'FX Al doilea', joinedCount: 9 })];
    await page.clock.fastForward(301_000);
    const reread = page.waitForResponse((r) => PUBLIC.test(r.url()) && r.url().includes('status=notStarted'));
    await tab(page, 'Rezultate').click();
    await tab(page, 'Viitoare').click();
    await reread;
    await expect(cardLink(page, 'FX Al doilea')).toBeVisible();
    // …but the live set did not change, so the hero stays.
    await expect(heroLinks(bento)).toHaveText('FX Primul');
    await page.getByRole('button', { name: 'Reîmprospătează' }).click();
    await expect(heroLinks(bento)).toHaveText('FX Al doilea');
  });

  test('competitions-list.pulse.c7 competitions-list.pulse.c8 — from 768: arrows move the stack; the peeking page shows only its photo', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await mockPulse(page, {
      live: [pc('l1', { name: 'FX Live 1', status: 'started' }), pc('l2', { name: 'FX Live 2', status: 'started' }), pc('l3', { name: 'FX Live 3', status: 'started' })],
      upcoming: [],
      completed: [],
    });
    const bento = await openPulse(page);
    await expect(heroLinks(bento)).toHaveCount(3);
    const scroller = bento.locator('.snap-x');
    // The second page's copy is hidden while it only peeks.
    const second = heroLinks(bento).nth(1);
    await expect(second.locator('xpath=ancestor::div[contains(@class,"text-on-photo-scrim")][1]')).toHaveCSS('opacity', '0');
    await bento.getByRole('button', { name: 'Concursul următor' }).click();
    await expect.poll(() => scroller.evaluate((el) => el.scrollLeft)).toBeGreaterThan(100);
    await expect(second.locator('xpath=ancestor::div[contains(@class,"text-on-photo-scrim")][1]')).toHaveCSS('opacity', '1');
    await bento.getByRole('button', { name: 'Concursul anterior' }).click();
    await expect.poll(() => scroller.evaluate((el) => el.scrollLeft)).toBe(0);
  });
});

test.describe('pulse states (mocked lists, signed in)', () => {
  test.beforeEach(async ({ context, page }) => {
    await signIn(context, jwt);
    await fixtureImages(page);
    // The invite needs the followed-live answer; nothing followed here.
    await page.route(/\/feed\/my-competition-cards\?.*scope=followed/, (r) => json(r, cardsPage([], { total: 0 })));
  });

  test('competitions-list.pulse.s4 — my own live competition leads the stack', async ({ page }) => {
    const mineLive = pc('mylive', { name: 'FX Al meu live', status: 'started' });
    await page.setViewportSize(DESKTOP);
    await mockPulse(page, {
      live: [pc('l1', { name: 'FX Live 1', status: 'started' }), mineLive, pc('l3', { name: 'FX Live 3', status: 'started' })],
      upcoming: [],
      completed: [],
      mine: [mineLive],
    });
    const bento = await openPulse(page);
    await expect(heroLinks(bento)).toHaveCount(3);
    await expect(heroLinks(bento).first()).toHaveText('FX Al meu live');
    await expect(bento.getByText('CONCURSUL TĂU · LIVE', { exact: true })).toBeVisible();
  });

  test('competitions-list.pulse.s5 competitions-list.pulse.c3 — my start within two days leads; the live ones follow; stale and live starts leave the upcoming list', async ({ page }) => {
    const mineSoon = pc('mysoon', { name: 'FX Al meu mâine', startDate: inDays(1) });
    const state: PulseMock = {
      live: [pc('l1', { name: 'FX Live 1', status: 'started' }), pc('l2', { name: 'FX Live 2', status: 'started' })],
      // l1 also in the (older) upcoming page: live wins, it is never in the stack twice.
      upcoming: [pc('l1', { name: 'FX Live 1' }), mineSoon],
      completed: [],
      mine: [mineSoon],
    };
    await page.setViewportSize(DESKTOP);
    await mockPulse(page, state);
    const bento = await openPulse(page);
    await expect(heroLinks(bento)).toHaveCount(3);
    await expect(heroLinks(bento).first()).toHaveText('FX Al meu mâine');
    await expect(bento.getByText('CONCURSUL TĂU', { exact: true })).toBeVisible();
    await expect(bento.getByRole('link', { name: 'FX Live 1. Vezi clasamentul' })).toHaveCount(1);
    // c3: a start more than a day past is dropped; my registrations are merged in.
    state.live = [];
    state.upcoming = [pc('stale', { name: 'FX Nepornit', startDate: inDays(-2) }), pc('u1', { startDate: inDays(5) })];
    state.mine = [pc('m1', { name: 'FX Înscris', startDate: inDays(4) })];
    await page.getByRole('button', { name: 'Reîmprospătează' }).click();
    await expect(bento.getByRole('button', { name: '2 concursuri încep în 7 zile' })).toBeVisible();
  });

  test('competitions-list.pulse.c22 — signed in and following nothing live: the invite opens Live', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await mockPulse(page, { live: [pc('l1', { name: 'FX Live 1', status: 'started' }), pc('l2', { name: 'FX Live 2', status: 'started' })], upcoming: [], completed: [] });
    const bento = await openPulse(page);
    const invite = bento.getByRole('button', { name: 'Nu urmărești niciun concurs live. Vezi concursurile live.' });
    await expect(invite.getByText(/sunt LIVE acum\. Urmărește unul|Unul e LIVE acum/)).toBeVisible();
    await invite.click();
    await expect(tab(page, 'Live')).toHaveAttribute('aria-selected', 'true');
  });

  test('competitions-list.pulse.c22 competitions-list.pulse.s10 — the invite waits for the followed-live answer and stays out when it fails', async ({ page }) => {
    await page.unroute(/\/feed\/my-competition-cards\?.*scope=followed/);
    await page.route(/\/feed\/my-competition-cards\?.*scope=followed/, (r) => json(r, { error: { status: 400, message: 'bad' } }, 400));
    await page.setViewportSize(DESKTOP);
    await mockPulse(page, { live: [pc('l1', { name: 'FX Live 1', status: 'started' })], upcoming: [], completed: [] });
    const bento = await openPulse(page);
    await expect(bento.getByRole('button', { name: '1 concursuri live' })).toBeVisible();
    await expect(bento.getByRole('button', { name: /^Nu urmărești niciun concurs live/ })).toHaveCount(0);
  });
});

test.describe('list states (mocked)', () => {
  test.beforeEach(async ({ context, page }) => {
    await signIn(context, jwt);
    await fixtureImages(page);
  });

  test('competitions-list.index.s8 competitions-list.index.c19 — a tab switch keeps the previous list with the busy bar; never the refresh spinner', async ({ page }) => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    await page.route(FOLLOWED, async (r) => {
      const status = new URL(r.request().url()).searchParams.get('status');
      if (status === 'completed') {
        await gate;
        return json(r, cardsPage([STATE_CARDS.donePodium]));
      }
      return json(r, cardsPage([STATE_CARDS.upcomingPending]));
    });
    await page.setViewportSize(DESKTOP);
    await open(page);
    await page.getByRole('button', { name: 'Concursuri urmărite' }).click();
    await expect(cardLink(page, 'FX Viitor cu așteptare')).toBeVisible();
    await tab(page, 'Rezultate').click();
    await expect(tab(page, 'Rezultate')).toHaveAttribute('aria-selected', 'true');
    await expect(cardLink(page, 'FX Viitor cu așteptare')).toBeVisible();
    await expect(list(page)).toHaveAttribute('aria-busy', 'true');
    await expect(list(page).locator('span.h-0\\.5.bg-accent')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reîmprospătează' })).not.toHaveAttribute('aria-disabled');
    release();
    await expect(cardLink(page, 'FX Încheiat cu podium')).toBeVisible();
    await expect(cardLink(page, 'FX Viitor cu așteptare')).toHaveCount(0);
    await expect(list(page)).not.toHaveAttribute('aria-busy');
  });

  test('competitions-list.index.s19 competitions-list.index.c29 — a card that crashes the render: the retry card; «Încearcă din nou» re-reads', async ({ page }) => {
    let crash = true;
    // A card whose figure the (patched) formatter cannot render: the card throws while rendering.
    await page.addInitScript(() => {
      const toFixed = Number.prototype.toFixed;
      Number.prototype.toFixed = function (this: number, digits?: number) {
        if (Number(this) === 4242.4) throw new Error('fixture: unrenderable figure');
        return toFixed.call(this, digits);
      };
    });
    const broken = { ...STATE_CARDS.liveCatches, documentId: 'fx-crash', name: 'FX Card stricat', results: { ...(STATE_CARDS.liveCatches.results as object), totalKg: 4242.4 } };
    await page.route(FOLLOWED, (r) => json(r, cardsPage(crash ? [broken] : [STATE_CARDS.upcomingPending])));
    await page.setViewportSize(DESKTOP);
    await open(page);
    await page.getByRole('button', { name: 'Concursuri urmărite' }).click();
    const alert = page.getByRole('alert').filter({ hasText: 'Concursurile nu s-au putut afișa' });
    await expect(alert).toBeVisible();
    const retry = alert.getByRole('button', { name: 'Încearcă din nou' });
    await expect(retry).toBeFocused();
    // The top bar keeps working.
    await expect(page.getByRole('link', { name: 'Acasă' }).first()).toBeVisible();
    crash = false;
    await retry.click();
    await expect(alert).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 1, name: 'Concursuri' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Urmărite' })).toBeVisible();
  });

  test('competitions-list.index.s2 competitions-list.index.c23 — the first page loading: the static shell is mode-neutral, card bones in the list grid', async ({ browser }) => {
    // The prerendered shell is what the stream paints first, for EVERY /concursuri URL: with script
    // off the stream's swap never runs, so it stays on screen to be inspected. It names no mode — no
    // tabs, no bento, no summary title — so a results or filtered link never first paints the index
    // frame (the inner fallback, which knows the place, commits to one).
    const context = await browser.newContext({ javaScriptEnabled: false, viewport: DESKTOP });
    const page = await context.newPage();
    for (const path of ['/concursuri', '/concursuri?q=cupa', '/concursuri?format=team&period=next7&status=notStarted']) {
      await page.goto(path);
      const loading = page.getByRole('status').filter({ hasText: 'Se încarcă concursurile…' }).first();
      await expect(loading).toBeVisible();
      // c23: six bones, the compact card's shape (thumb + face footer), in the list's grid.
      await expect(loading.locator('article')).toHaveCount(6);
      await expect(loading.locator('article').first().locator('.size-19')).toHaveCount(1);
      await expect(page.getByRole('heading', { level: 1, name: 'Concursuri' })).toBeAttached();
      await expect(page.getByRole('heading', { level: 2, name: 'Alege următorul start' })).toHaveCount(0);
      await expect(page.getByRole('heading', { level: 2, name: /^Rezultate pentru|^Concursuri filtrate/ })).toHaveCount(0);
      await expect(page.getByText(/^0 concursuri/)).toHaveCount(0);
    }
    await context.close();
  });

  test('competitions-list.index.c17 competitions-list.index.c18 competitions-list.index.s7 — a failed re-read keeps the cards, marked; «Încearcă din nou» clears it', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await open(page, '/concursuri?status=completed');
    const first = list(page).locator('article').first();
    await expect(first).toBeVisible();
    await page.route(PUBLIC, (r) => (r.request().url().includes('status=completed') ? json(r, { error: { status: 400, message: 'bad' } }, 400) : r.fallback()));
    await page.getByRole('button', { name: 'Reîmprospătează' }).click();
    const notice = list(page).getByText('Nu am putut actualiza lista.');
    await expect(notice).toBeVisible();
    await expect(first).toBeVisible();
    await expect(notice.locator('xpath=ancestor::*[@aria-live="polite"][1]')).toHaveCount(1);
    await page.unroute(PUBLIC);
    await list(page).getByRole('button', { name: 'Încearcă din nou' }).click();
    await expect(notice).toHaveCount(0);
  });

  test('competitions-list.index.c26 competitions-list.index.s18 competitions-list.cards.c18 — the viewer draws the thumbnail first; a failed original keeps it, with a message', async ({ page }) => {
    await page.route(/\/uploads\/fixture\.jpg\?o/, (r) => r.fulfill({ status: 404, body: '' }));
    await page.route(FOLLOWED, (r) => json(r, cardsPage([STATE_CARDS.upcomingPending])));
    await page.addInitScript(() => localStorage.removeItem('COMPETITION_CARD_DENSITY_V1'));
    await page.setViewportSize(DESKTOP);
    await open(page);
    await page.getByRole('button', { name: 'Concursuri urmărite' }).click();
    await list(page).getByRole('button', { name: 'Vezi imaginea pentru FX Viitor cu așteptare' }).click();
    const viewer = page.getByRole('dialog', { name: 'FX Viitor cu așteptare' });
    await expect(viewer.getByText('Imaginea nu a putut fi încărcată')).toBeVisible();
    const thumb = viewer.getByRole('img', { name: 'Afișul concursului FX Viitor cu așteptare' });
    await expect(thumb).toHaveAttribute('src', /fixture\.jpg\?s/);
    await expect(viewer.getByRole('button', { name: 'Vezi concursul' })).toBeVisible();
  });
});

test.describe('another timezone', () => {
  test.use({ timezoneId: 'America/Los_Angeles' });

  test('competitions-list.cards.c19 — the card shows the server’s labels; nothing is formatted in the browser’s timezone', async ({ page, context }) => {
    await signIn(context, jwt);
    await fixtureImages(page);
    await page.route(FOLLOWED, (r) => json(r, cardsPage([STATE_CARDS.upcomingPending, STATE_CARDS.liveCatches])));
    await page.addInitScript(() => localStorage.setItem('COMPETITION_CARD_DENSITY_V1', 'expanded'));
    await page.setViewportSize(DESKTOP);
    await open(page);
    await page.getByRole('button', { name: 'Concursuri urmărite' }).click();
    const item = (name: string) => list(page).locator('article').filter({ has: page.getByRole('link', { name, exact: true }) });
    // 05:00Z is 22:00 the day before in Los Angeles: the card still says the server's Bucharest labels.
    await expect(item('FX Viitor cu așteptare').getByText('20 oct · 08:00–16:00')).toBeVisible();
    await expect(item('FX Live cu capturi').getByText('1.024,3')).toBeVisible();
    await expect(item('FX Live cu capturi').getByText('7,647')).toBeVisible();
  });
});
