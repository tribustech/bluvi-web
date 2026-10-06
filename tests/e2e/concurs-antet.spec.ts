import { collectConsoleErrors } from './helpers/console';
import { expectNoA11yViolations } from './helpers/a11y';
import { qaJwt, signIn } from './helpers/session';
import { expect, test, type BrowserContext, type Page, type Route } from '@playwright/test';

/*
 * Concurs · the page frame around the tabs — parity docs/parity/areas/competition-page.yml:
 * shell (sticky tab strip, the active-weighing banner and its weighing detail, the weighing link)
 * and bara-actiuni (the «Acțiuni» sheet of the route tabs other than Clasament).
 *
 * Per-viewer states the local data does not have (a weighing in progress, a registered participant
 * of a live competition, a referee) are answered through the same-origin proxy (/api/cms/…,
 * page.route): the page and its rules are real, the CMS is never written. Override the ids with
 * E2E_* when the local data moves.
 */

const QA_DOC = 'pducvrkstdjrtzop6isewt1u';

const ID = {
  /** started, quantity, 24 sectors × 1 stand (a long page). */
  live: process.env.E2E_COMPETITION_LIVE ?? 'kee49a3e64b3f636b4b60daa',
  /** completed quantity, 114 weighings. */
  rich: process.env.E2E_STATS_RICH ?? 'i8kzbi5k51vmbyq75dmyez3d',
  /** completed nationalChampionship; one of its weighings and that weighing's stand. */
  nc: process.env.E2E_STATS_NC ?? 'z7rvhm55ziyr0tbblqwjp39q',
  ncWeighing: process.env.E2E_STATS_NC_WEIGHING ?? 'fuqluwe496abmszwt4yh6ao4',
  ncStand: process.env.E2E_STATS_NC_STAND ?? 'ahs6zl0lu3dqj5jy9ep8bu7d',
};

const PHONE = { width: 375, height: 812 };
const DESKTOP = { width: 1440, height: 900 };

test.describe.configure({ timeout: 120_000 });

let jwt = '';
test.beforeAll(async ({ request }) => {
  jwt = await qaJwt(request);
});

async function open(page: Page, path: string, viewport = PHONE) {
  await page.setViewportSize(viewport);
  // A 403 the local CMS answers for a grant it lacks is the browser's own network log line.
  const errors = collectConsoleErrors(page, { ignore: /Failed to load resource/ });
  const res = await page.goto(path, { waitUntil: 'domcontentloaded' });
  expect(res?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 45_000 });
  // Wait for React to own the page (a press before hydration does nothing).
  await page.waitForFunction(() => Object.keys(document.querySelector('h1') ?? {}).some(k => k.startsWith('__react')), null, { timeout: 60_000 });
  return errors;
}

const settle = (page: Page) => page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
const tabsNav = (page: Page) => page.getByRole('navigation', { name: 'Secțiunile concursului' });
const bar = (page: Page) => page.getByRole('region', { name: 'Bara de acțiuni' });

async function mockMyStatus(context: BrowserContext, id: string, userRegistrationStatus: string | null) {
  await context.route(`**/api/cms/feed/competitions/${id}/my-status`, (route: Route) =>
    route.fulfill({ json: { data: { isFollowing: false, userRegistrationStatus } } }),
  );
}

async function mockStatute(context: BrowserContext, userRole: 'author' | 'referee' | 'participant' | null) {
  await context.route(/\/user\/profile\/competition\/[^/]+\/statute/, route => route.fulfill({ json: { userRole } }));
}

/* ------------------------------------------------------------------ */
/* shell.c19 — the tab strip stays in reach                            */
/* ------------------------------------------------------------------ */

test('competition-page.shell.c19 — from 768 the tab strip sticks under the top bar for the whole page', async ({ page }) => {
  const errors = await open(page, `/concursuri/${ID.live}`, DESKTOP);
  await page.mouse.wheel(0, 2000);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(1000);
  await expect.poll(async () => Math.round((await tabsNav(page).boundingBox())?.y ?? -1)).toBe(64);
  await expect(tabsNav(page).getByRole('link', { name: /^Informații/ })).toBeInViewport();
  expect(errors).toEqual([]);
});

test('competition-page.shell.c19 — phone: the strip follows the top bar up on scroll down and comes back with it on scroll up', async ({ page }) => {
  const errors = await open(page, `/concursuri/${ID.live}`);
  await settle(page);
  await page.mouse.move(180, 500);
  for (let i = 0; i < 6; i++) await page.mouse.wheel(0, 300);
  // The bar slides away: the pinned band (the T3 mini title row over the strip) moves up to the
  // top edge — no gap above it (owner rule 3) — and the strip stays on screen right under the row.
  const band = page.locator('[data-t3="pinned-band"]');
  const top = async () => Math.round((await band.boundingBox())?.y ?? -1);
  await expect.poll(top).toBe(0);
  await expect(tabsNav(page).getByRole('link', { name: /^Clasament/ })).toBeInViewport();
  const navY = Math.round((await tabsNav(page).boundingBox())?.y ?? -1);
  expect(navY).toBeGreaterThanOrEqual(0);
  expect(navY).toBeLessThanOrEqual(46);
  // Scrolling up brings the bar back; the band sits under it (56).
  await page.mouse.wheel(0, -200);
  await expect.poll(top).toBe(56);
  await expect(page.locator('header').first()).toBeInViewport();
  await expectNoA11yViolations(page);
  expect(errors).toEqual([]);
});

/* ------------------------------------------------------------------ */
/* shell.c23 c24 c25 — the active-weighing banner                      */
/* ------------------------------------------------------------------ */

type Active = {
  weighingDocumentId: string;
  weighingType: 'normal' | 'extra';
  stand: { id: number; documentId: string; name: string; sectors: { id: number; documentId: string; name: string }[]; sectorDrawPosition?: number | null };
};

const ncWeighing = (over: Partial<Active> = {}): Active => ({
  weighingDocumentId: ID.ncWeighing,
  weighingType: 'normal',
  stand: { id: 1, documentId: ID.ncStand, name: '12', sectors: [{ id: 1, documentId: 'sector-a', name: 'A' }], sectorDrawPosition: 3 },
  ...over,
});

async function mockActive(context: BrowserContext, id: string, list: Active[]) {
  await context.route(`**/api/cms/competitions/${id}/active-weighing`, route => route.fulfill({ json: list }));
}

test('competition-page.shell.c23 competition-page.shell.c25 — signed in, one weighing in progress: «Cântar în curs pe standul A3(12).» (National Championship draw label); pressing it opens that weighing', async ({
  page,
  context,
}) => {
  await signIn(context, jwt);
  await mockActive(context, ID.nc, [ncWeighing()]);
  const errors = await open(page, `/concursuri/${ID.nc}`);
  const banner = bar(page).getByRole('button', { name: 'Cântar în curs pe standul A3(12).' });
  await expect(banner).toBeVisible({ timeout: 30_000 });
  await banner.click();
  await expect(page).toHaveURL(new RegExp(`/concursuri/${ID.nc}/cantare\\?cantar=${ID.ncWeighing}&stand=${ID.ncStand}$`));
  const detail = page.getByRole('dialog', { name: 'Detaliu cântar' });
  await expect(detail).toBeVisible();
  await expect(detail.getByText(/Total: /)).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(800);
  await expectNoA11yViolations(page);
  expect(errors).toEqual([]);
});

test('competition-page.shell.c23 — signed out: no banner (the active weighing is never read)', async ({ page, context }) => {
  let reads = 0;
  await context.route(`**/api/cms/competitions/${ID.nc}/active-weighing`, route => {
    reads++;
    return route.fulfill({ json: [ncWeighing()] });
  });
  await open(page, `/concursuri/${ID.nc}`);
  await settle(page);
  await expect(page.getByRole('button', { name: /în curs pe standul/ })).toHaveCount(0);
  expect(reads).toBe(0);
});

test('competition-page.shell.c24 competition-page.shell.c25 — several weighings: «Cântare în curs pe standurile …»; the list has one entry per weighing, each opening its weighing; one without a sector does nothing', async ({
  page,
  context,
}) => {
  await signIn(context, jwt);
  await mockActive(context, ID.nc, [
    ncWeighing(),
    ncWeighing({
      weighingDocumentId: 'extra-e2e',
      weighingType: 'extra',
      stand: { id: 2, documentId: 'stand-b', name: '4', sectors: [{ id: 2, documentId: 'sector-b', name: 'B' }], sectorDrawPosition: null },
    }),
    ncWeighing({ weighingDocumentId: 'no-sector-e2e', stand: { id: 3, documentId: 'stand-x', name: '9', sectors: [], sectorDrawPosition: null } }),
  ]);
  const errors = await open(page, `/concursuri/${ID.nc}`);
  const banner = bar(page).getByRole('button', { name: 'Cântare în curs pe standurile A3(12), B4, 9.' });
  await expect(banner).toBeVisible({ timeout: 30_000 });
  await banner.click();
  const list = page.getByRole('dialog', { name: 'Cântare în curs' });
  await expect(list.getByRole('listitem')).toHaveText(
    ['Vezi cântarul live pe standul A3(12)', 'Vezi extra-cântarul live pe standul B4', 'Vezi cântarul live pe standul 9'].map(t => new RegExp(t.replace(/[()]/g, '\\$&'))),
    { useInnerText: true },
  );
  await page.waitForTimeout(800);
  await expectNoA11yViolations(page);

  // Without a sector: the list closes, nothing opens (fish handlePressActiveWeighing).
  await list.getByRole('button', { name: 'Vezi cântarul live pe standul 9' }).click();
  await expect(list).toBeHidden();
  await expect(page).toHaveURL(new RegExp(`/concursuri/${ID.nc}$`));

  await banner.click();
  await list.getByRole('button', { name: 'Vezi cântarul live pe standul A3(12)' }).click();
  await expect(page).toHaveURL(new RegExp(`cantar=${ID.ncWeighing}&stand=${ID.ncStand}$`));
  await expect(page.getByRole('dialog', { name: 'Detaliu cântar' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('competition-page.shell.c25 — from another route tab the banner opens the weighing on the Cântare view', async ({ page, context }) => {
  await signIn(context, jwt);
  await mockActive(context, ID.nc, [ncWeighing()]);
  await open(page, `/concursuri/${ID.nc}/regulament`);
  await bar(page).getByRole('button', { name: 'Cântar în curs pe standul A3(12).' }).click();
  await expect(page).toHaveURL(new RegExp(`/concursuri/${ID.nc}/cantare\\?cantar=${ID.ncWeighing}&stand=${ID.ncStand}$`), { timeout: 30_000 });
  await expect(page.getByRole('dialog', { name: 'Detaliu cântar' })).toBeVisible({ timeout: 30_000 });
});

/* ------------------------------------------------------------------ */
/* shell.c26 — the weighing link (fish openWeighingSheet)              */
/* ------------------------------------------------------------------ */

test('competition-page.shell.c26 competition-page.b.notif-weighing — a weighing link without its stand opens nothing; with it, the detail opens once, and closing removes the params', async ({ page }) => {
  await open(page, `/concursuri/${ID.nc}/cantare?cantar=${ID.ncWeighing}`, DESKTOP);
  await settle(page);
  await expect(page.getByRole('dialog', { name: 'Detaliu cântar' })).toHaveCount(0);

  await open(page, `/concursuri/${ID.nc}/cantare?cantar=${ID.ncWeighing}&stand=${ID.ncStand}`, DESKTOP);
  const detail = page.getByRole('dialog', { name: 'Detaliu cântar' }).or(page.getByRole('complementary', { name: 'Detaliu cântar' }));
  await expect(detail.first()).toBeVisible({ timeout: 30_000 });
  await detail.first().getByRole('button', { name: 'Închide' }).click();
  await expect(page).not.toHaveURL(/cantar=|stand=/);
});

/* ------------------------------------------------------------------ */
/* bara-actiuni.c11 – c14 — the «Acțiuni» sheet of the other tabs       */
/* ------------------------------------------------------------------ */

const actionsTile = (page: Page) => bar(page).getByRole('button', { name: 'Acțiuni concurs' });
const sheet = (page: Page) => page.getByRole('dialog', { name: 'Acțiuni' });

test('competition-page.bara-actiuni.c11 competition-page.shell.c28 — a guest on Informații: «Acțiuni» offers only sign-in, back to this tab', async ({ page }) => {
  const errors = await open(page, `/concursuri/${ID.live}/informatii`);
  await actionsTile(page).click();
  const s = sheet(page);
  await expect(s).toBeVisible();
  const signInLink = s.getByRole('link', { name: 'Autentifică-te pentru a putea participa la competiție' });
  await expect(signInLink).toHaveAttribute('href', `/intra?next=${encodeURIComponent(`/concursuri/${ID.live}/informatii`)}`);
  await expect(s.getByRole('link')).toHaveCount(1);
  await expect(s.getByRole('button', { name: /Înscrie-te|Solicită/ })).toHaveCount(0);
  await page.waitForTimeout(800);
  await expectNoA11yViolations(page);
  expect(errors).toEqual([]);
});

test('competition-page.shell.c28 — on Clasament there is no «Acțiuni» tile (the ranking tiles are the bar)', async ({ page }) => {
  await open(page, `/concursuri/${ID.live}`);
  await expect(bar(page).getByRole('button', { name: 'Tot ecranul' }).or(bar(page).getByRole('button', { name: 'Vezi clasamentul pe tot ecranul' }))).toBeVisible();
  await expect(actionsTile(page)).toHaveCount(0);
});

test('competition-page.bara-actiuni.c12 competition-page.bara-actiuni.c13 — signed in on Regulament after the end: «Înscrie-te» closed with fish\'s reason, «Vezi cântarele din concurs» opens the Cântare view', async ({
  page,
  context,
}) => {
  await signIn(context, jwt);
  await mockMyStatus(context, ID.rich, null);
  await mockStatute(context, null);
  const errors = await open(page, `/concursuri/${ID.rich}/regulament`);
  await settle(page);
  await actionsTile(page).click();
  const s = sheet(page);
  const register = s.getByRole('button', { name: /Înscrie-te/ });
  await expect(register).toBeVisible();
  await expect(register).toHaveAttribute('aria-disabled', 'true');
  // fish NormalUserSheetItems: the reason for whichever rule closes it (a full competition, else the deadline).
  await expect(register).toContainText(/Termenul pentru înscriere a expirat|Numărul maxim de participanți a fost atins/);
  await page.waitForTimeout(800);
  await expectNoA11yViolations(page);
  await s.getByRole('link', { name: 'Vezi cântarele din concurs' }).click();
  await expect(page).toHaveURL(new RegExp(`/concursuri/${ID.rich}/cantare$`), { timeout: 30_000 });
  await expect(page.getByRole('heading', { name: /^Sector / }).first()).toBeVisible({ timeout: 30_000 });
  expect(errors).toEqual([]);
});

test('competition-page.bara-actiuni.c14 — a registered participant while it runs: «Solicită extra cântar» sends (busy line), toasts, closes; then «Șterge solicitarea de extra cântar»', async ({
  page,
  context,
}) => {
  await signIn(context, jwt);
  await mockMyStatus(context, ID.live, 'registered');
  await mockStatute(context, 'participant');
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
  let release: () => void = () => {};
  const held = new Promise<void>(r => (release = r));
  await context.route(`**/api/cms/competitions/${ID.live}/request-extra`, async route => {
    const method = route.request().method();
    state.writes.push(method);
    if (method === 'POST') await held;
    state.requested = method === 'POST';
    return route.fulfill({ json: { documentId: 'extra-e2e', extraStatus: method === 'POST' ? 'new' : 'cancelled' } });
  });
  const errors = await open(page, `/concursuri/${ID.live}/participanti`);
  await settle(page);
  await actionsTile(page).click();
  const s = sheet(page);
  const reads = state.listReads;
  await s.getByRole('button', { name: /Solicită extra cântar/ }).click();
  // fish: no question in the sheet; while it is sent the item says so and does nothing.
  const busy = s.getByRole('button', { name: /Solicită extra cântar/ });
  await expect(busy).toContainText('Se înregistrează cererea...');
  await expect(busy).toHaveAttribute('aria-disabled', 'true');
  release();
  await expect(page.getByText('Cererea a fost trimisă cu succes')).toBeVisible();
  await expect(s).toBeHidden();
  expect(state.writes).toEqual(['POST']);
  await expect.poll(() => state.listReads).toBeGreaterThan(reads);

  await actionsTile(page).click();
  await sheet(page).getByRole('button', { name: /Șterge solicitarea de extra cântar/ }).click();
  await expect(page.getByText('Cererea a fost ștearsă cu succes')).toBeVisible();
  await expect(sheet(page)).toBeHidden();
  expect(state.writes).toEqual(['POST', 'DELETE']);
  expect(errors).toEqual([]);
});

test('competition-page.bara-actiuni.c11 web — a referee: the organiser sheets are M6; the web offers «Vezi cântarele din concurs»', async ({ page, context }) => {
  await signIn(context, jwt);
  await mockStatute(context, 'referee');
  await open(page, `/concursuri/${ID.live}/informatii`);
  await settle(page);
  await actionsTile(page).click();
  const s = sheet(page);
  await expect(s.getByRole('link', { name: 'Vezi cântarele din concurs' })).toBeVisible();
  await expect(s.getByRole('button', { name: /Înscrie-te|Solicită/ })).toHaveCount(0);
});

/* ------------------------------------------------------------------ */
/* cantar-detaliu.c6 — catches a refresh brings in                     */
/* ------------------------------------------------------------------ */

const OPEN = {
  /** completed quality competition holding a weighing still in progress (stand A1), no catches. */
  competition: process.env.E2E_STATS_OPEN ?? '0dab75714142e797e26304aa',
  weighing: process.env.E2E_STATS_OPEN_WEIGHING ?? 'f0f9de2bbe2b58acd8038a58',
  stand: process.env.E2E_STATS_OPEN_STAND ?? '5d8e24df4ec6b06a5a002082',
};

test('competition-page.cantar-detaliu.c6 — a catch that arrives in a refresh is marked new for 5 s, then reads as the others', async ({ page }) => {
  let withCatch = false;
  await page.route(new RegExp(`/feed/weighings/${OPEN.weighing}(\\?|$)`), async route => {
    const res = await route.fetch();
    const json = await res.json();
    const body = json.data ?? json;
    if (withCatch) body.catches = [...(body.catches ?? []), { id: 999_001, documentId: 'catch-e2e-new', weight: 4.25, fishType: { Name: 'Crap' }, media: [] }];
    return route.fulfill({ response: res, json });
  });
  const errors = await open(page, `/concursuri/${OPEN.competition}/cantare?cantar=${OPEN.weighing}&stand=${OPEN.stand}`);
  const detail = page.getByRole('dialog', { name: 'Detaliu cântar' });
  await expect(detail.getByText('Acest cântar nu conține nicio captură.')).toBeVisible({ timeout: 30_000 });
  withCatch = true;
  await detail.getByRole('button', { name: 'Actualizează' }).click();
  const row = detail.locator('[data-new]');
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('Crap');
  await expect(row).toContainText('(nouă)');
  // After 5 s it is one of the catches, unmarked.
  await expect(row).toHaveCount(0, { timeout: 8000 });
  await expect(detail.getByText(/Crap/)).toBeVisible();
  expect(errors).toEqual([]);
});
