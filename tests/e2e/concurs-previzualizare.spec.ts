import { collectConsoleErrors } from './helpers/console';
import { expectNoA11yViolations } from './helpers/a11y';
import { findCompetition, registrationOpen, startOf } from './helpers/fixtures';
import { CMS, qaJwt, signIn } from './helpers/session';
import { expect, test, type BrowserContext, type Locator, type Page, type Route } from '@playwright/test';

/*
 * Concurs before the start (competition-page.previzualizare) and the action bar for a guest, an
 * angler and a participant (competition-page.bara-actiuni) — parity
 * docs/parity/areas/competition-page.yml. Local CMS on :1337, QA user «Sim QA».
 *
 * Per-viewer states the local data does not have (a rejected entry, a registered participant of a
 * live competition) are made by answering the browser's own reads through the same-origin proxy
 * (/api/cms/…, page.route): the page and its rules are real, the CMS is never written.
 */

const QA_DOC = 'pducvrkstdjrtzop6isewt1u';

const ID = {
  /** notStarted, team of 2, 4 sectors × 5 stands, 20/20 registered; QA user is the author. */
  full: process.env.E2E_COMPETITION_UPCOMING_OWN ?? 'a6xjl65ooe9eadrtvvqj9hn1',
  /** notStarted, single, 0 registered, deadline ahead — re-picked in beforeAll once the deadline passes. */
  empty: process.env.E2E_COMPETITION_UPCOMING_EMPTY ?? 'ld4l9nzlczisz2yexad8fm6p',
  /** notStarted, no sectors — re-picked in beforeAll if the pinned one gets sectors or starts. */
  noSectors: process.env.E2E_COMPETITION_UPCOMING_NO_SECTORS ?? 'u9kd3xs4n91j2ktah78ke73q',
  /** notStarted past its start and its deadline (late start), 1 pending entry. */
  late: process.env.E2E_COMPETITION_UPCOMING_LATE ?? 'hpdy6luzzt36886wpsc95im8',
  /** started, quantity. */
  live: process.env.E2E_COMPETITION_LIVE ?? 'kee49a3e64b3f636b4b60daa',
};

const PHONE = { width: 375, height: 812 };
const DESKTOP = { width: 1440, height: 900 };

test.describe.configure({ timeout: 120_000 });

let jwt = '';
/** The empty competition's participant limit (its «0/N»). */
let emptyLimit = 0;
/** 24 h before the full competition's start: a clock the countdown runs on, whatever today is. */
let beforeFullStart = new Date();
const NO_EMPTY = 'no notStarted single competition with no entries and its registration open in the local CMS';
const NO_NO_SECTORS = 'no notStarted competition without sectors in the local CMS';

test.beforeAll(async ({ request }) => {
  jwt = await qaJwt(request);
  // The state these ids were pinned for moves with the clock (a deadline passes, a start is reached):
  // keep the pinned one while it still fits, else take another; '' = none locally (the tests skip).
  const empty = await findCompetition({
    pinned: ID.empty,
    status: 'notStarted',
    matches: (c, now) => c.competitionType === 'single' && c.registrations.length === 0 && registrationOpen(c, now) && startOf(c) > now,
  });
  ID.empty = empty?.documentId ?? '';
  emptyLimit = empty?.participantsLimit ?? 0;
  const noSectors = await findCompetition({ pinned: ID.noSectors, status: 'notStarted', matches: c => c.sectors.length === 0 });
  ID.noSectors = noSectors?.documentId ?? '';
  const full = await findCompetition({ pinned: ID.full, status: 'notStarted', matches: () => true });
  if (full) beforeFullStart = new Date(startOf(full) - 24 * 3600_000);
});

async function open(page: Page, id: string, viewport = PHONE) {
  await page.setViewportSize(viewport);
  const errors = collectConsoleErrors(page);
  const res = await page.goto(`/concursuri/${id}`, { waitUntil: 'domcontentloaded' });
  expect(res?.status()).toBe(200);
  // A cold dev compile can take a while on the first visit.
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 45_000 });
  return errors;
}

const visible = (l: Locator) => l.locator('visible=true').first();
const bar = (page: Page) => page.getByRole('region', { name: 'Bara de acțiuni' });
const settle = (page: Page) => page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});

/** The viewer's overlay on this competition (fish `userRegistrationStatus`), answered by the test. */
async function mockMyStatus(context: BrowserContext, id: string, userRegistrationStatus: string | null) {
  await context.route(`**/api/cms/feed/competitions/${id}/my-status`, (route: Route) =>
    route.fulfill({ json: { data: { isFollowing: false, userRegistrationStatus } } }),
  );
}

/* ------------------------------------------------------------------ */
/* competition-page.previzualizare                                     */
/* ------------------------------------------------------------------ */

test('competition-page.previzualizare.c1 competition-page.previzualizare.c5 competition-page.previzualizare.c14 — notStarted: the preview instead of the ranking, the notice, the closing line, then the bar', async ({ page }) => {
  const errors = await open(page, ID.full);
  await expect(page.getByRole('tablist', { name: 'Vederi clasament' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Competiția nu a început' })).toBeVisible();
  await expect(
    page.getByText(
      'Această competiție încă nu a început. Odată ce va începe, vei putea vedea clasamentul live, progresul participanților în timp real, statistici și multe altele. Revino la momentul potrivit pentru a urmări acțiunea!',
    ),
  ).toBeVisible();
  await expect(page.getByText('Revino când competiția începe pentru a vedea clasamentul live!')).toBeVisible();
  // Full (20/20): the bar's «Înscrie-te» is there, closed for a guest too (bara-actiuni.c5).
  await expect(bar(page).getByRole('button', { name: 'Înscrie-te' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('competition-page.previzualizare.c3 competition-page.previzualizare.s2 — the countdown: ZILE : ORE : MIN : SEC, two digits, ticking every second', async ({ page }) => {
  await page.clock.install({ time: beforeFullStart });
  await open(page, ID.full);
  const timer = visible(page.getByRole('timer'));
  await expect(timer).toBeVisible();
  await expect(visible(page.getByText('Competiția începe în'))).toBeVisible();
  const format = /^(\d\d)ZILE:(\d\d)ORE:(\d\d)MIN:(\d\d)SEC$/;
  await expect(timer).toHaveText(format);
  const seconds = async () => {
    const [, d, h, m, sec] = format.exec((await timer.innerText()).replace(/\s+/g, ''))!;
    return ((Number(d) * 24 + Number(h)) * 60 + Number(m)) * 60 + Number(sec);
  };
  const first = await seconds();
  await page.clock.runFor(2000);
  await expect.poll(seconds).toBe(first - 2);
});

test('competition-page.previzualizare.c4 — the competition is re-read under a minute and again at the start', async ({ page, request }) => {
  const start = Date.parse((await (await request.get(`${CMS}/feed/competitions/${ID.full}`)).json()).data.startDate);
  // 70 s before the start.
  await page.clock.install({ time: new Date(start - 70_000) });
  const core: string[] = [];
  page.on('request', r => {
    if (/\/api\/cms\/feed\/competitions\/[^/]+$/.test(r.url())) core.push(r.url());
  });
  await open(page, ID.full);
  await expect(visible(page.getByRole('timer'))).toBeVisible();
  const before = core.length;
  await page.clock.runFor(12_000); // 58 s left
  await expect.poll(() => core.length).toBeGreaterThan(before);
  const underMinute = core.length;
  await page.clock.runFor(60_000); // past the start
  await expect.poll(() => core.length).toBeGreaterThan(underMinute);
  // The ranking query is idle before the start (rankingsQuery is enabled from «started»): it is read
  // once the re-read competition says it has started.
});

test('competition-page.previzualizare.c3 competition-page.previzualizare.s2 web — past the start while still notStarted: «Start întârziat», what the page waits for, the scheduled time; the tile keeps its height', async ({
  page,
}) => {
  await open(page, ID.late, DESKTOP);
  const tile = page.getByRole('region', { name: 'Start întârziat' });
  await expect(tile).toBeVisible();
  await expect(tile.getByText('Așteptăm pornirea de către organizator')).toBeVisible();
  await expect(tile.getByText(/^Programat: /)).toBeVisible();
  await expect(tile.getByText('Competiția începe în')).toHaveCount(0);
  // The same height as the running countdown's tile (no shift when it flips).
  const late = (await tile.boundingBox())!.height;
  // The running countdown: a day before the full competition's start (the fixture's own start moves past).
  const running_ = await page.context().newPage();
  await running_.clock.install({ time: beforeFullStart });
  page = running_;
  await open(page, ID.full, DESKTOP);
  const running = (await page.getByRole('region', { name: 'Competiția începe în' }).boundingBox())!.height;
  expect(Math.abs(late - running)).toBeLessThanOrEqual(1);
});

test('competition-page.previzualizare.c6 competition-page.previzualizare.s6 web — from 1280 Detalii is the left column (three columns): label over value, each date on one line', async ({
  page,
}) => {
  for (const vp of [{ width: 1280, height: 900 }, DESKTOP]) {
    await open(page, ID.full, vp);
    const left = page.getByRole('complementary', { name: 'Detalii' });
    await expect(left).toBeVisible();
    await expect(left.locator('dt')).toHaveText(['Durată', 'Începe', 'Se termină', 'Tip clasament', 'Tip competiție']);
    await expect(left.locator('dd')).toHaveText(['24 de ore', 'mar, 6 oct 2026 · 00:01', 'mie, 7 oct 2026 · 00:01', 'Cantitate', 'Echipe de 2']);
    for (const cell of await left.locator('dt, dd').all()) {
      // One line each (label and value), the label above its value.
      const box = (await cell.boundingBox())!;
      expect(box.height).toBeLessThan(30);
    }
    const [dt, dd] = [(await left.locator('dt').nth(2).boundingBox())!, (await left.locator('dd').nth(2).boundingBox())!];
    expect(dd.y).toBeGreaterThan(dt.y + dt.height - 1);
    await expect(page.getByRole('complementary', { name: 'Ce mă așteaptă' })).toBeVisible();
  }
});

test('competition-page.previzualizare.c6 competition-page.previzualizare.c7 competition-page.previzualizare.c8 competition-page.previzualizare.c9 competition-page.previzualizare.s6 — Detalii: Durată, Începe, Se termină, Tip clasament, Tip competiție', async ({ page }) => {
  test.skip(!ID.empty, NO_EMPTY);
  await open(page, ID.full);
  const details = visible(page.getByRole('region', { name: 'Detalii' }).or(page.locator('section').filter({ has: page.getByRole('heading', { name: 'Detalii' }) })));
  const value = (label: string) => details.locator('dt', { hasText: label }).locator('xpath=following-sibling::dd[1]');
  await expect(value('Durată')).toHaveText('24 de ore');
  await expect(value('Începe')).toHaveText('mar, 6 oct 2026 · 00:01');
  await expect(value('Se termină')).toHaveText('mie, 7 oct 2026 · 00:01');
  await expect(value('Tip clasament')).toHaveText('Cantitate');
  await expect(value('Tip competiție')).toHaveText('Echipe de 2');
  // One idiom at every width: the kit DetailFacts list (no hand-rolled rows, no badges).
  await expect(details.locator('dl > div')).toHaveCount(5);
  // An individual competition.
  await open(page, ID.empty);
  const single = visible(page.locator('section').filter({ has: page.getByRole('heading', { name: 'Detalii' }) }));
  await expect(single.locator('dt', { hasText: 'Tip competiție' }).locator('xpath=following-sibling::dd[1]')).toHaveText('Individual');
});

test('competition-page.previzualizare.c11 competition-page.previzualizare.s3 competition-page.previzualizare.s4 — Înscrieri: approved/limit, «Progres înscrieri» capped at 100%, pending pill, first-to-register line', async ({ page }) => {
  test.skip(!ID.empty, NO_EMPTY);
  await open(page, ID.full);
  let card = visible(page.getByRole('region', { name: 'Înscrieri' }));
  await expect(card).toContainText('20/20');
  await expect(card).toContainText('Progres înscrieri 100%');
  await expect(card.getByRole('progressbar', { name: 'Progres înscrieri' })).toHaveAttribute('aria-valuenow', '20');
  // Full: the state says so, not only a full bar.
  await expect(card.getByText('Complet', { exact: true })).toBeVisible();

  await open(page, ID.empty);
  card = visible(page.getByRole('region', { name: 'Înscrieri' }));
  await expect(card).toContainText(`0/${emptyLimit}`);
  await expect(card).toContainText('Progres înscrieri 0%');
  await expect(card.getByText('Fii primul care se înscrie la această competiție!')).toBeVisible();

  await open(page, ID.late);
  card = visible(page.getByRole('region', { name: 'Înscrieri' }));
  await expect(card.getByText('1 în așteptare')).toBeVisible();
  // Someone is waiting for approval: not «be the first».
  await expect(card.getByText('Fii primul care se înscrie la această competiție!')).toHaveCount(0);
  // Phone: a flat white band like the sections around it (no grey tile inside it).
  const bg = await card.evaluate(el => getComputedStyle(el.firstElementChild as Element).backgroundColor);
  expect(bg).toBe('rgb(255, 255, 255)');
});

test('competition-page.previzualizare.c13 competition-page.previzualizare.s5 — sectors: «Sectoare: n · Standuri: m», one row per sector with its stands in order; none configured', async ({ page }) => {
  test.skip(!ID.noSectors, NO_NO_SECTORS);
  await open(page, ID.full);
  await expect(page.getByRole('heading', { name: 'Sectoare: 4 · Standuri: 20' })).toBeVisible();
  const a = page.getByRole('listitem').filter({ hasText: 'Sectorul A' });
  await expect(a).toContainText('5 standuri');
  await expect(a).toContainText('(1, 2, 3, 4, 5)');
  // A→Z, whatever order the CMS keeps them in.
  const order = await page.getByRole('listitem').filter({ hasText: /^Sectorul [A-Z]/ }).allInnerTexts();
  expect(order.map(t => t.slice(0, 10))).toEqual(['Sectorul A', 'Sectorul B', 'Sectorul C', 'Sectorul D']);

  await open(page, ID.noSectors);
  await expect(page.getByRole('heading', { name: 'Sectoare: – · Standuri: –' })).toBeVisible();
  await expect(page.getByText('Configurarea standurilor nu a fost finalizată încă')).toBeVisible();

  // A sector without stands: the heading's «–» said in words, never a bold «0 standuri».
  await open(page, ID.late);
  await expect(page.getByRole('heading', { name: 'Sectoare: 1 · Standuri: –' })).toBeVisible();
  const lone = page.getByRole('listitem').filter({ hasText: 'Sectorul A' });
  await expect(lone).toContainText('Fără standuri');
  await expect(lone).not.toContainText('0 standuri');
  // c9: a team competition before the start without a team size says «Echipe».
});

test('competition-page.previzualizare.c10 competition-page.previzualizare.c12 — «Vezi toate informațiile» / «Vezi toate înscrierile» open the tabs', async ({ page }) => {
  await open(page, ID.full);
  const info = page.getByRole('link', { name: 'Vezi toate informațiile' }).locator('visible=true').first();
  await expect(info).toHaveAttribute('href', `/concursuri/${ID.full}/informatii`);
  await expect(page.getByRole('link', { name: 'Vezi toate înscrierile' }).locator('visible=true').first()).toHaveAttribute('href', `/concursuri/${ID.full}/participanti`);
  await info.click();
  await expect(page).toHaveURL(new RegExp(`/concursuri/${ID.full}/informatii$`));
  await expect(page.getByRole('navigation', { name: 'Secțiunile concursului' }).locator('[aria-current="page"]')).toHaveText(/^Informații/);
});

test('competition-page.previzualizare.c15 — coming back to the tab after a while re-reads the competition, the ranking, the statute and the allocations', async ({ page, context }) => {
  await signIn(context, jwt);
  await page.clock.install({ time: beforeFullStart });
  await open(page, ID.full);
  await settle(page);
  const seen: string[] = [];
  page.on('request', r => seen.push(r.url()));
  await page.clock.runFor(31_000);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect.poll(() => seen.some(u => /\/feed\/competitions\/[^/]+(\/my-status)?$/.test(u))).toBe(true);
  await expect.poll(() => seen.some(u => /\/statute-for-competition|\/statute/.test(u))).toBe(true);
});

for (const vp of [PHONE, { width: 768, height: 1024 }, { width: 1280, height: 900 }, DESKTOP]) {
  for (const signedIn of [false, true]) {
    test(`competition-page.previzualizare.s3 · ${vp.width}px · ${signedIn ? 'signed in' : 'signed out'} — axe clean, no console errors`, async ({ page, context }) => {
      if (signedIn) await signIn(context, jwt);
      const errors = await open(page, ID.full, vp);
      await expect(visible(page.getByRole('heading', { name: 'Detalii' }))).toBeVisible();
      await settle(page);
      await expectNoA11yViolations(page);
      expect(errors).toEqual([]);
    });
  }
}

/* ------------------------------------------------------------------ */
/* competition-page.bara-actiuni                                       */
/* ------------------------------------------------------------------ */

test('competition-page.bara-actiuni.c1 competition-page.bara-actiuni.s1 competition-page.bara-actiuni.s2 — before the start, signed out: «Înscrie-te» leads to sign-in (phone bar and, from 768, the header)', async ({ page }) => {
  test.skip(!ID.empty, NO_EMPTY);
  await open(page, ID.empty);
  const link = bar(page).getByRole('link', { name: 'Înscrie-te' });
  await expect(link).toHaveAttribute('href', /\/autentificare|sign-in|intra/);
  await page.setViewportSize(DESKTOP);
  await expect(visible(page.getByRole('link', { name: 'Înscrie-te' }))).toBeVisible();
});

test('competition-page.bara-actiuni.c5 competition-page.bara-actiuni.s2 competition-page.bara-actiuni.s3 — signed out, full: «Înscrie-te» closed for a guest too (fish disabledInscrieTe), the reason visible on the phone and from 768', async ({
  page,
}) => {
  await open(page, ID.full);
  const button = bar(page).getByRole('button', { name: 'Înscrie-te' });
  await expect(button).toBeDisabled();
  await expect(button).toHaveAccessibleDescription('Numărul maxim de participanți a fost atins');
  await expect(bar(page).getByText('Numărul maxim de participanți a fost atins')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Înscrie-te' })).toHaveCount(0);
  await page.setViewportSize({ width: 1280, height: 900 });
  const header = visible(page.getByRole('button', { name: 'Înscrie-te' }));
  await expect(header).toBeDisabled();
  const reason = visible(page.getByText('Numărul maxim de participanți a fost atins'));
  await expect(reason).toBeVisible();
  await expect(header).toHaveAccessibleDescription('Numărul maxim de participanți a fost atins');
  // The reason sits centred under «Înscrie-te» (its slot), never under «Distribuie».
  const [b, r] = [(await header.boundingBox())!, (await reason.boundingBox())!];
  expect(Math.abs(b.x + b.width / 2 - (r.x + r.width / 2))).toBeLessThanOrEqual(2);
  expect(r.width).toBeLessThanOrEqual(b.width + 1);
  expect(r.y).toBeGreaterThanOrEqual(b.y + b.height);
});

test('competition-page.bara-actiuni.c5 competition-page.bara-actiuni.s3 — signed out, deadline passed: «Înscrie-te» closed, «Termenul pentru înscriere a expirat»', async ({ page }) => {
  await open(page, ID.late);
  const button = bar(page).getByRole('button', { name: 'Înscrie-te' });
  await expect(button).toBeDisabled();
  await expect(bar(page).getByText('Termenul pentru înscriere a expirat')).toBeVisible();
});

test('competition-page.bara-actiuni.c1 competition-page.bara-actiuni.c4 competition-page.bara-actiuni.s3 — signed in, the bar never offers the guest’s sign-in link (not even before the session lands)', async ({ page, context }) => {
  test.skip(!ID.empty, NO_EMPTY);
  await signIn(context, jwt);
  await mockMyStatus(context, ID.empty, null);
  // Every «Înscrie-te» link the page ever renders, from the first HTML on.
  await page.addInitScript(() => {
    const seen: string[] = [];
    (window as unknown as { __signInLinks: string[] }).__signInLinks = seen;
    const check = () =>
      document.querySelectorAll<HTMLAnchorElement>('a[href*="/intra"]').forEach(a => {
        if (/Înscrie-te|Modifică înscrierea/.test(a.textContent ?? '')) seen.push(a.href);
      });
    new MutationObserver(check).observe(document, { subtree: true, childList: true, attributes: true });
    document.addEventListener('DOMContentLoaded', check);
  });
  await open(page, ID.empty);
  await settle(page);
  await expect(bar(page).getByRole('link', { name: 'Înscrie-te' })).toHaveAttribute('href', /bluvi-app\.wearetribus\.com/);
  expect(await page.evaluate(() => (window as unknown as { __signInLinks: string[] }).__signInLinks)).toEqual([]);
});

test('competition-page.bara-actiuni.c4 competition-page.bara-actiuni.c5 competition-page.bara-actiuni.s3 — signed in, allowed: «Înscrie-te» continues in the app; the rules disable it with fish’s reason', async ({ page, context }) => {
  test.skip(!ID.empty, NO_EMPTY);
  await signIn(context, jwt);
  await mockMyStatus(context, ID.empty, null);
  await open(page, ID.empty);
  await settle(page);
  const offered = bar(page).getByRole('link', { name: 'Înscrie-te' });
  await expect(offered).toHaveAttribute('href', `https://bluvi-app.wearetribus.com/competitions/${ID.empty}`);
  await expect(bar(page).getByText('Înscrierea continuă în aplicația Bluvi.')).toBeVisible();
});

test('competition-page.bara-actiuni.c5 competition-page.bara-actiuni.c12 competition-page.bara-actiuni.s3 — rejected: «Înscrie-te» disabled, «Cererea ta … a fost respinsă.»', async ({ page, context }) => {
  test.skip(!ID.empty, NO_EMPTY);
  await signIn(context, jwt);
  await mockMyStatus(context, ID.empty, 'rejected');
  await open(page, ID.empty);
  await settle(page);
  const button = bar(page).getByRole('button', { name: 'Înscrie-te' });
  await expect(button).toBeDisabled();
  await expect(button).toHaveAccessibleDescription('Cererea ta de a te înscrie în această competiție a fost respinsă.');
});

test('competition-page.bara-actiuni.c5 competition-page.bara-actiuni.c12 competition-page.bara-actiuni.s3 — registered on a single competition: «Modifică înscrierea» disabled, «Nu se mai pot face modificări»', async ({ page, context }) => {
  test.skip(!ID.empty, NO_EMPTY);
  await signIn(context, jwt);
  await mockMyStatus(context, ID.empty, 'registered');
  await open(page, ID.empty);
  await settle(page);
  const button = bar(page).getByRole('button', { name: 'Modifică înscrierea' });
  await expect(button).toBeDisabled();
  await expect(button).toHaveAccessibleDescription('Nu se mai pot face modificări');
});

test('competition-page.bara-actiuni.c5 competition-page.bara-actiuni.c12 competition-page.bara-actiuni.s3 — limit reached: disabled, «Numărul maxim de participanți a fost atins» (header from 768 too)', async ({ page, context }) => {
  await signIn(context, jwt);
  await mockMyStatus(context, ID.full, null);
  await open(page, ID.full);
  await settle(page);
  const button = bar(page).getByRole('button', { name: 'Înscrie-te' });
  await expect(button).toBeDisabled();
  await expect(button).toHaveAccessibleDescription('Numărul maxim de participanți a fost atins');
  await page.setViewportSize({ width: 1280, height: 900 });
  const header = visible(page.getByRole('button', { name: 'Înscrie-te' }));
  await expect(header).toBeDisabled();
  await expect(header).toHaveAccessibleDescription('Numărul maxim de participanți a fost atins');
  // From 768 the reason is visible under the header's actions (no tooltip on a disabled control),
  // and the button stays focusable (aria-disabled), so a keyboard user reaches it and hears why.
  await expect(visible(page.getByText('Numărul maxim de participanți a fost atins'))).toBeVisible();
  await header.focus();
  await expect(header).toBeFocused();
});

test('competition-page.bara-actiuni.c5 competition-page.bara-actiuni.c12 competition-page.bara-actiuni.s3 — deadline passed: disabled, «Termenul pentru înscriere a expirat»', async ({ page, context }) => {
  await signIn(context, jwt);
  await mockMyStatus(context, ID.late, null);
  await open(page, ID.late);
  await settle(page);
  const button = bar(page).getByRole('button', { name: 'Înscrie-te' });
  await expect(button).toBeDisabled();
  await expect(button).toHaveAccessibleDescription('Termenul pentru înscriere a expirat');
});

test('competition-page.bara-actiuni.c2 competition-page.bara-actiuni.c3 competition-page.bara-actiuni.s1 — started, signed in: Tot ecranul, Chat (second), Cântare, Sortare, Statistici', async ({ page, context }) => {
  await signIn(context, jwt);
  await mockMyStatus(context, ID.live, null);
  await open(page, ID.live);
  await settle(page);
  const tiles = page.getByRole('navigation', { name: 'Acțiuni concurs' }).getByRole('button');
  await expect(tiles).toHaveCount(5);
  await expect(tiles.nth(0)).toHaveAccessibleName('Vezi clasamentul pe tot ecranul');
  await expect(tiles.nth(1)).toHaveAccessibleName(/^Chat competiție/);
  await expect(tiles.nth(2)).toHaveAccessibleName('Vezi cântarele din concurs');
  await expect(tiles.nth(3)).toHaveAccessibleName('Sortare clasament');
  await expect(tiles.nth(4)).toHaveAccessibleName('Statistici');
});

test('competition-page.bara-actiuni.c7 competition-page.bara-actiuni.s5 competition-page.bara-actiuni.s6 — Sortare: a submenu with «Înapoi»; a choice shows the Clasament view and confirms, the message goes on press', async ({ page }) => {
  await page.goto(`/concursuri/${ID.live}/cantare`);
  await page.setViewportSize(PHONE);
  await page.getByRole('button', { name: 'Sortare clasament' }).click();
  const menu = page.getByRole('navigation', { name: 'Sortare clasament' });
  await expect(menu.getByRole('button')).toHaveText(['Înapoi', 'Stand', 'Poziția în clasament']);
  await menu.getByRole('button', { name: 'Înapoi' }).click();
  await expect(page.getByRole('navigation', { name: 'Acțiuni concurs' })).toBeVisible();
  await page.getByRole('button', { name: 'Sortare clasament' }).click();
  await menu.getByRole('button', { name: 'Stand' }).click();
  const message = page.getByRole('button', { name: 'Sortarea clasamentului după stand a fost efectuată.' });
  await expect(message).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/concursuri/${ID.live}$`));
  await message.click();
  await expect(message).toBeHidden();
});

test('competition-page.bara-actiuni.c7 competition-page.bara-actiuni.s6 — Sortare by keyboard: opening moves focus to «Înapoi», Escape and «Înapoi» close it back onto «Sortare»', async ({ page }) => {
  await open(page, ID.live);
  // A key before hydration does nothing.
  await settle(page);
  const sortare = page.getByRole('button', { name: 'Sortare clasament' });
  const menu = page.getByRole('navigation', { name: 'Sortare clasament' });
  await expect(async () => {
    await sortare.focus();
    await page.keyboard.press('Enter');
    await expect(menu.getByRole('button', { name: 'Înapoi' })).toBeFocused({ timeout: 1000 });
  }).toPass({ timeout: 60_000 });
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(sortare).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(menu.getByRole('button', { name: 'Înapoi' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(menu).toHaveCount(0);
  await expect(sortare).toBeFocused();
});

test('competition-page.bara-actiuni.c7 competition-page.bara-actiuni.s5 — after a sort, a reader who has moved on is not pulled back to «Sortare» when the message goes', async ({
  page,
}) => {
  await open(page, ID.live);
  await settle(page);
  await page.getByRole('button', { name: 'Sortare clasament' }).click();
  await page.getByRole('navigation', { name: 'Sortare clasament' }).getByRole('button', { name: 'Stand' }).click();
  const message = page.getByRole('button', { name: 'Sortarea clasamentului după stand a fost efectuată.' });
  await expect(message).toBeFocused();
  // The reader moves on (out of the bar) before the message clears.
  const away = visible(page.getByRole('link', { name: /Înapoi|Acasă/ }).or(page.getByRole('button', { name: /Înapoi/ }))).first();
  await away.focus();
  await expect(message).toBeHidden({ timeout: 6000 });
  await expect(away).toBeFocused();
});

/** A registered participant of the live competition, with the extra-scale list held by the test. */
async function asParticipant(page: Page, context: BrowserContext) {
  await signIn(context, jwt);
  await mockMyStatus(context, ID.live, 'registered');
  const state = { requested: false, writes: [] as string[], listReads: 0 };
  await context.route(`**/api/cms/competitions/${ID.live}/extra-scale`, route => {
    state.listReads++;
    return route.fulfill({
      json: state.requested
        ? [
            {
              id: 1,
              documentId: 'extra-e2e',
              author: { id: 513, documentId: QA_DOC, username: 'Sim QA' },
              extraStatus: 'new',
              stand: { id: 1, documentId: 's1', name: '1', sectors: [{ id: 1, documentId: 'sa', name: 'A' }] },
            },
          ]
        : [],
    });
  });
  await context.route(`**/api/cms/competitions/${ID.live}/request-extra`, route => {
    const method = route.request().method();
    state.writes.push(method);
    state.requested = method === 'POST';
    return route.fulfill({ json: { documentId: 'extra-e2e', extraStatus: method === 'POST' ? 'new' : 'cancelled' } });
  });
  return state;
}

test('competition-page.bara-actiuni.c8 competition-page.bara-actiuni.c9 competition-page.bara-actiuni.s4 competition-page.bara-actiuni.s5 — Extra-Cântar: asked in the bar, sent, toasted, confirmed; then «Anulează extra» cancels it', async ({ page, context }) => {
  const state = await asParticipant(page, context);
  await open(page, ID.live);
  await settle(page);
  const tiles = page.getByRole('navigation', { name: 'Acțiuni concurs' });
  await tiles.getByRole('button', { name: 'Solicită extra cântar' }).click();
  const ask = page.getByRole('group', { name: 'Ești sigur că vrei să trimiți cererea de extra cântar?' });
  await expect(ask).toBeVisible();
  // «Anulează» leaves without sending.
  await ask.getByRole('button', { name: 'Anulează' }).click();
  expect(state.writes).toEqual([]);

  await tiles.getByRole('button', { name: 'Solicită extra cântar' }).click();
  const reads = state.listReads;
  await page.getByRole('group', { name: /trimiți cererea/ }).getByRole('button', { name: 'Confirmă' }).click();
  await expect(page.getByText('Cererea a fost trimisă cu succes')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cererea de extra cântar a fost trimisă.' })).toBeVisible();
  expect(state.writes).toEqual(['POST']);
  await expect.poll(() => state.listReads).toBeGreaterThan(reads);

  // c9: the viewer's «new» request in the list → the tile cancels.
  await page.getByRole('button', { name: 'Cererea de extra cântar a fost trimisă.' }).click();
  await tiles.getByRole('button', { name: 'Anulează cererea de extra cântar' }).click();
  await page.getByRole('group', { name: 'Ești sigur că vrei să anulezi cererea de extra cântar?' }).getByRole('button', { name: 'Confirmă' }).click();
  await expect(page.getByText('Cererea a fost ștearsă cu succes')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cererea de extra cântar a fost anulată.' })).toBeVisible();
  expect(state.writes).toEqual(['POST', 'DELETE']);
  await expectNoA11yViolations(page);
});

test('competition-page.bara-actiuni.c8 competition-page.bara-actiuni.s4 — a failed request toasts the error and leaves the tile as it was', async ({ page, context }) => {
  await asParticipant(page, context);
  await context.route(`**/api/cms/competitions/${ID.live}/request-extra`, route =>
    route.fulfill({ status: 400, json: { error: { status: 400, message: 'Ai deja o cerere activă.' } } }),
  );
  await open(page, ID.live);
  await settle(page);
  await page.getByRole('button', { name: 'Solicită extra cântar' }).click();
  await page.getByRole('button', { name: 'Confirmă' }).click();
  await expect(page.getByRole('alert').filter({ hasText: /./ }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Solicită extra cântar' })).toBeVisible();
});

test('competition-page.bara-actiuni.c8 competition-page.bara-actiuni.s4 competition-page.bara-actiuni.s5 — from 768 Extra-cântar is a header action that asks in a dialog; while sending it keeps focus, busy', async ({
  page,
  context,
}) => {
  const state = await asParticipant(page, context);
  // Hold the write a moment, so the busy state can be seen.
  let release: () => void = () => {};
  const held = new Promise<void>(r => (release = r));
  await context.route(`**/api/cms/competitions/${ID.live}/request-extra`, async route => {
    await held;
    await route.fallback();
  });
  await open(page, ID.live, DESKTOP);
  await settle(page);
  const trigger = visible(page.getByRole('button', { name: 'Extra-cântar' }));
  await trigger.click();
  const dialog = page.getByRole('alertdialog', { name: 'Extra cântar' });
  await expect(dialog).toContainText('Ești sigur că vrei să trimiți cererea de extra cântar?');
  await dialog.getByRole('button', { name: 'Confirmă' }).click();
  // Busy, not native-disabled: focus stays on the trigger (never dropped on <body>), and it says so.
  const busy = visible(page.getByRole('button', { name: 'Se înregistrează cererea...' }));
  await expect(busy).toBeFocused();
  await expect(busy).toHaveAttribute('aria-busy', 'true');
  await expect(busy).toHaveAttribute('aria-disabled', 'true');
  await expect(busy).not.toHaveAttribute('disabled');
  release();
  await expect(page.getByText('Cererea a fost trimisă cu succes')).toBeVisible();
  expect(state.writes).toEqual(['POST']);
  await expect(visible(page.getByRole('button', { name: 'Anulează extra-cântar' }))).toBeVisible();
});

test('competition-page.bara-actiuni.c2 competition-page.bara-actiuni.s1 — a viewer who is not a registered participant gets no Extra-Cântar', async ({ page, context }) => {
  await signIn(context, jwt);
  await mockMyStatus(context, ID.live, 'pending');
  await open(page, ID.live);
  await settle(page);
  await expect(page.getByRole('button', { name: 'Solicită extra cântar' })).toHaveCount(0);
});

test.fixme('competition-page.bara-actiuni.c10 — Penalizări opens the penalties page (M6, not on the web yet)', async () => {});
// competition-page.bara-actiuni c11 – c14 (the «Acțiuni» sheet of the other tabs): concurs-antet.spec.ts.
