import { expect, test, type Page, type Request, type Route } from '@playwright/test';
import { expectNoA11yViolations } from './helpers/a11y';
import { collectConsoleErrors } from './helpers/console';
import { CMS, qaJwt, signIn } from './helpers/session';

/*
 * account.notification-preferences (/setari/notificari/concursuri, T1 + the shared preferences
 * panel in `edit` mode). fish: app/(app)/notification-preferences.tsx,
 * features/notifications/components/FollowNotificationsSheet.tsx, PreferenceGroupRow.tsx,
 * features/notifications/domain/preferenceState.ts.
 *
 * Data:
 * - GET /feed/followed-competitions answers 403 on the LOCAL CMS (grant missing locally, written in
 *   docs/private/cms-patches/M2-grants.md), so the LIST is route-mocked in every test: the real
 *   started competition «[AUDIT27] Start maine» (REAL), whose preferences are read and written on
 *   the local CMS, plus fakes whose preferences are mocked too.
 * - Writes, local CMS only, as the QA user: beforeAll follows REAL (unless already followed) and
 *   seeds its mutedTypes with one key outside the catalog (the chat bell's room key) to prove the
 *   PUT keeps it; afterAll writes the original mutedTypes back and unfollows again if it followed.
 * - Every error path is mocked.
 */

const PATH = '/setari/notificari/concursuri';
const LIST = '**/api/cms/feed/followed-competitions';
const REAL = process.env.E2E_COMPETITION_LIVE_EMPTY ?? 'uql25w776iris1wqnsc20wyg';
const EXTRA = 'chat:message:participants';
const PHONE = { width: 375, height: 812 };
const DESKTOP = { width: 1440, height: 900 };
const SAVE_FAILED = 'Nu am putut salva preferințele. Te rugăm să încerci din nou.';
const LOAD_FAILED = 'Nu am putut încărca notificările. Le poți seta mai târziu din Setări.';
const FOOTNOTE = 'Poți schimba oricând din clopoțelul din chat sau din Setări → Notificări.';
/** Failed requests the specs provoke on purpose (mocked 5xx) are logged by the browser. */
const EXPECTED_CONSOLE = [/Failed to load resource: the server responded with a status of 500/];

/** A 36px-friendly banner thumb (8×8 PNG) served for the fake banner URL. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEUlEQVR4nGM4YWODFTEMLQkAZZlQAVIPr1MAAAAASUVORK5CYII=',
  'base64',
);
const BANNER = 'https://fir-intins-strapi.s3.eu-central-1.amazonaws.com/e2e_thumb_banner.png';

type Prefs = { groups: { key: string; label: string; types: { key: string; label: string; muted: boolean }[] }[]; extraMuted?: string[] };

let jwt = '';
let realName = '';
let originalMuted: string[] = [];
let followedHere = false;
let catalog: Prefs;

const auth = () => ({ authorization: `Bearer ${jwt}` });
const mutedOf = (p: Prefs) => [...p.groups.flatMap(g => g.types.filter(t => t.muted).map(t => t.key)), ...(p.extraMuted ?? [])];
const catalogKeys = () => catalog.groups.flatMap(g => g.types.map(t => t.key));

test.describe.configure({ mode: 'serial', timeout: 120_000 });

test.beforeAll(async ({ request }) => {
  jwt = await qaJwt(request);
  const comp = await request.get(`${CMS}/feed/competitions/${REAL}`);
  expect(comp.ok(), `competition ${REAL} exists in the local CMS`).toBe(true);
  realName = (await comp.json()).data.name;
  const status = await request.get(`${CMS}/feed/competitions/${REAL}/my-status`, { headers: auth() });
  if (!(await status.json()).data?.isFollowing) {
    const res = await request.post(`${CMS}/competitions/${REAL}/follow`, { headers: auth(), data: { follow: true } });
    expect(res.ok(), 'QA follows the competition').toBe(true);
    followedHere = true;
  }
  const prefs = await request.get(`${CMS}/feed/competitions/${REAL}/notification-preferences`, { headers: auth() });
  expect(prefs.ok(), 'preferences readable on the local CMS').toBe(true);
  const json = (await prefs.json()) as Prefs;
  originalMuted = mutedOf(json);
  catalog = { groups: json.groups.map(g => ({ ...g, types: g.types.map(t => ({ ...t, muted: false })) })), extraMuted: [] };
  await putReal(request, [EXTRA]);
});

test.afterAll(async ({ request }) => {
  await putReal(request, originalMuted);
  if (followedHere) {
    const res = await request.post(`${CMS}/competitions/${REAL}/follow`, { headers: auth(), data: { follow: false } });
    expect(res.ok(), 'QA unfollows again').toBe(true);
  }
});

async function putReal(request: import('@playwright/test').APIRequestContext, mutedTypes: string[]) {
  const res = await request.put(`${CMS}/feed/competitions/${REAL}/notification-preferences`, { headers: auth(), data: { mutedTypes } });
  expect(res.ok(), 'preferences written').toBe(true);
  return (await res.json()) as Prefs;
}

async function readReal(request: import('@playwright/test').APIRequestContext) {
  const res = await request.get(`${CMS}/feed/competitions/${REAL}/notification-preferences`, { headers: auth() });
  return (await res.json()) as Prefs;
}

type Item = { documentId: string; name: string; bannerThumbUrl: string | null; competitionStatus: 'notStarted' | 'started'; mutedCount: number };
const fakeBanner = (): Item => ({ documentId: 'e2efakebanner0000000000a', name: 'Cupa Lacului Verde 2026', bannerThumbUrl: BANNER, competitionStatus: 'notStarted', mutedCount: 2 });
const fakeOne = (): Item => ({ documentId: 'e2efakeone00000000000000', name: 'Memorial Ionescu', bannerThumbUrl: null, competitionStatus: 'started', mutedCount: 1 });

/**
 * The followed list. REAL's mutedCount follows what the CMS holds (catalog keys only, as the CMS
 * counts), so a save is visible in the refetched row; `items` returns the rest.
 */
async function mockList(page: Page, request: import('@playwright/test').APIRequestContext, extra: () => Item[] = () => [fakeBanner(), fakeOne()], includeReal = true) {
  const calls: Request[] = [];
  await page.route(LIST, async route => {
    calls.push(route.request());
    const real = includeReal ? await readReal(request) : null;
    const items: Item[] = real
      ? [
          {
            documentId: REAL,
            name: realName,
            bannerThumbUrl: null,
            competitionStatus: 'started',
            mutedCount: real.groups.flatMap(g => g.types).filter(t => t.muted).length,
          },
          ...extra(),
        ]
      : extra();
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: items }) });
  });
  await page.route(BANNER, r => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
  return calls;
}

/** The fakes' preferences (GET answers `prefs`, PUT echoes the body through the catalog). */
async function mockFakePrefs(page: Page, prefs: (id: string) => Prefs) {
  const puts: Request[] = [];
  await page.route(/\/api\/cms\/feed\/competitions\/e2efake[^/]+\/notification-preferences$/, async (route: Route) => {
    const id = route.request().url().split('/').at(-2)!;
    if (route.request().method() === 'PUT') {
      puts.push(route.request());
      const muted = new Set((route.request().postDataJSON() as { mutedTypes: string[] }).mutedTypes);
      const keys = new Set(catalogKeys());
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          groups: catalog.groups.map(g => ({ ...g, types: g.types.map(t => ({ ...t, muted: muted.has(t.key) })) })),
          extraMuted: [...muted].filter(k => !keys.has(k)),
        }),
      });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(prefs(id)) });
  });
  return puts;
}

/** The catalog with `muted` keys muted. */
function prefsWith(muted: string[], extraMuted: string[] = []): Prefs {
  return { groups: catalog.groups.map(g => ({ ...g, types: g.types.map(t => ({ ...t, muted: muted.includes(t.key) })) })), extraMuted };
}

function track(page: Page, pattern: RegExp, method?: string) {
  const seen: Request[] = [];
  page.on('request', r => {
    if (pattern.test(r.url()) && (!method || r.method() === method)) seen.push(r);
  });
  return seen;
}

/** The panel's entrance (opacity / translate) has finished: axe reads the colours at rest. */
const settled = (page: Page) =>
  page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter(a => a.effect?.getTiming().iterations !== Infinity)
        .map(a => a.finished.catch(() => undefined)),
    ),
  );

const row = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const panel = (page: Page) => page.getByRole('dialog', { name: 'Ce notificări vrei?' });

async function openPage(page: Page, viewport = DESKTOP) {
  await page.setViewportSize(viewport);
  await page.goto(PATH);
  await expect(page.getByRole('heading', { level: 1, name: 'Concursuri urmărite' })).toBeVisible();
}

test('signed out → /intra with the return path (account.b.signed-out-gate)', async ({ page }) => {
  await page.goto(PATH);
  await expect(page).toHaveURL(/\/intra\?next=%2Fsetari%2Fnotificari%2Fconcursuri$/);
});

test('c1 c2 — back + «Concursuri urmărite»; a centred spinner while the list loads', async ({ page, context, request }) => {
  const errors = collectConsoleErrors(page);
  await signIn(context, jwt);
  const calls = await mockList(page, request);
  // Registered after the mock, so it runs first (Playwright: the last route wins) and holds it.
  let release!: () => void;
  const held = new Promise<void>(r => (release = r));
  await page.route(LIST, async route => {
    await held;
    await route.fallback();
  });
  await openPage(page);
  await expect(page.getByRole('button', { name: 'Înapoi' })).toBeVisible();
  const spinner = page.getByTestId('followed-loading');
  await expect(spinner).toBeVisible();
  await expect(spinner).toHaveAttribute('role', 'status');
  // Centred in the content column.
  const box = (await spinner.locator('span').first().boundingBox())!;
  const col = (await page.locator('main').boundingBox())!;
  expect(Math.abs(box.x + box.width / 2 - (col.x + col.width / 2))).toBeLessThan(40);
  release();
  await expect(row(page, realName)).toBeVisible();
  await expect(spinner).toHaveCount(0);
  expect(calls.length).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('c3 — no followed competitions: «Nu urmărești niciun concurs în desfășurare.»', async ({ page, context, request }) => {
  await signIn(context, jwt);
  await mockList(page, request, () => [], false);
  await openPage(page, PHONE);
  await expect(page.getByText('Nu urmărești niciun concurs în desfășurare.')).toBeVisible();
  await expect(page.getByTestId('followed-row')).toHaveCount(0);
  await expectNoA11yViolations(page);
});

test('list error: the T1 error card with a retry, never the empty copy (owner rule 4)', async ({ page, context, request }) => {
  collectConsoleErrors(page, { ignore: EXPECTED_CONSOLE });
  await signIn(context, jwt);
  await mockList(page, request);
  let fail = true;
  await page.route(LIST, route => (fail ? route.fulfill({ status: 500, body: '{}' }) : route.fallback()));
  await openPage(page);
  await expect(page.getByRole('alert').getByText('Nu am putut încărca concursurile urmărite')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('Nu urmărești niciun concurs în desfășurare.')).toHaveCount(0);
  fail = false;
  await page.getByRole('button', { name: 'Încearcă din nou' }).click();
  await expect(row(page, realName)).toBeVisible();
});

test('c4 — thumb or letters-only initials, bold one-line name, the summary (red when muted), a chevron', async ({ page, context, request }) => {
  await signIn(context, jwt);
  await mockList(page, request);
  await openPage(page);
  const rows = page.getByTestId('followed-row');
  await expect(rows).toHaveCount(3);

  // REAL: no banner → initials of the letters only («[AUDIT27] Start maine» → «AS») on the accent.
  const real = row(page, realName);
  const initials = real.getByTestId('followed-initials');
  await expect(initials).toHaveText('AS');
  const ib = (await initials.boundingBox())!;
  expect(Math.round(ib.width)).toBe(36);
  expect(Math.round(ib.height)).toBe(36);
  expect(await initials.evaluate(e => getComputedStyle(e).borderRadius)).not.toBe('0px');
  await expect(real.getByTestId('followed-summary')).toHaveText('Toate notificările pornite');

  // A banner thumb: a 36px circle with the photo.
  const banner = row(page, 'Cupa Lacului Verde 2026');
  const img = banner.locator('img');
  await expect(img).toHaveAttribute('src', BANNER);
  const tb = (await img.boundingBox())!;
  expect(Math.round(tb.width)).toBe(36);
  await expect(banner.getByTestId('followed-summary')).toHaveText('2 tipuri oprite');
  await expect(row(page, 'Memorial Ionescu').getByTestId('followed-summary')).toHaveText('1 tip oprit');

  // Red when some types are muted, the muted grey otherwise.
  const red = await banner.getByTestId('followed-summary').evaluate(e => getComputedStyle(e).color);
  const grey = await real.getByTestId('followed-summary').evaluate(e => getComputedStyle(e).color);
  expect(red).not.toBe(grey);
  const [r, g] = red.match(/\d+/g)!.map(Number);
  expect(r).toBeGreaterThan(g + 60);

  // The name: bold, one line (cut with an ellipsis).
  const name = banner.locator('span.truncate');
  expect(Number(await name.evaluate(e => getComputedStyle(e).fontWeight))).toBeGreaterThanOrEqual(600);
  expect(await name.evaluate(e => getComputedStyle(e).whiteSpace)).toBe('nowrap');
  await expect(banner.locator('svg').last()).toBeVisible();
  // The summary is the row's description.
  await expect(banner).toHaveAccessibleDescription('2 tipuri oprite');
});

test('desktop: a dense grid of row-cards — never one stretched row (1280, 1440, 1920)', async ({ page, context, request }) => {
  await signIn(context, jwt);
  await mockList(page, request, () => [fakeBanner(), fakeOne(), { ...fakeOne(), documentId: 'e2efakeone00000000000002', name: 'Trofeul Toamnei' }]);
  for (const width of [1280, 1440, 1920]) {
    await openPage(page, { width, height: 900 });
    const rows = page.getByTestId('followed-row');
    await expect(rows).toHaveCount(4);
    const boxes = await rows.evaluateAll(els => els.map(e => e.getBoundingClientRect()).map(r => ({ y: Math.round(r.y), w: r.width })));
    expect(boxes[0].w).toBeLessThan(560);
    expect(boxes[1].y).toBe(boxes[0].y);
  }
});

test('c5 c6 — a row opens a fresh «Ce notificări vrei?» panel for that competition; its preferences load only while open', async ({ page, context, request }) => {
  await signIn(context, jwt);
  await mockList(page, request);
  await mockFakePrefs(page, () => prefsWith([]));
  const gets = track(page, /\/api\/cms\/feed\/competitions\/[^/]+\/notification-preferences$/, 'GET');
  await openPage(page);
  await expect(row(page, realName)).toBeVisible();
  await page.waitForTimeout(500);
  expect(gets).toHaveLength(0);

  await row(page, realName).click();
  const p = panel(page);
  await expect(p).toBeVisible();
  await expect(p.getByText(realName)).toBeVisible();
  await expect(p.getByRole('switch', { name: catalog.groups[0].label, exact: true })).toBeVisible();
  expect(gets.map(r => r.url())).toEqual([expect.stringContaining(`/feed/competitions/${REAL}/notification-preferences`)]);

  // An edit, then another competition: a fresh panel with that competition's own state.
  await p.getByRole('switch', { name: catalog.groups[0].label, exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(p).toBeHidden();
  await row(page, 'Memorial Ionescu').click();
  await expect(panel(page).getByText('Memorial Ionescu')).toBeVisible();
  await expect(panel(page).getByRole('switch', { name: catalog.groups[0].label, exact: true })).toBeChecked();
  expect(gets.at(-1)!.url()).toContain('/feed/competitions/e2efakeone00000000000000/notification-preferences');
});

test('c7 — four skeleton rows announced «Se încarcă notificările»; on error fish\'s copy', async ({ page, context, request }) => {
  collectConsoleErrors(page, { ignore: EXPECTED_CONSOLE });
  await signIn(context, jwt);
  await mockList(page, request);
  let release!: () => void;
  const held = new Promise<void>(r => (release = r));
  await page.route(/\/feed\/competitions\/e2efakeone[^/]+\/notification-preferences$/, async route => {
    await held;
    await route.fulfill({ status: 500, body: '{}' });
  });
  await openPage(page, PHONE);
  await row(page, 'Memorial Ionescu').click();
  const loading = page.getByRole('status', { name: 'Se încarcă notificările' });
  await expect(loading).toBeVisible();
  await expect(loading.locator('span')).toHaveCount(4);
  // «Salvează» is busy while the groups have not loaded (c11).
  await expect(panel(page).getByRole('button', { name: 'Salvează' })).toHaveAttribute('aria-busy', 'true');
  release();
  await expect(panel(page).getByText(LOAD_FAILED)).toBeVisible({ timeout: 20_000 });
  await panel(page).getByRole('button', { name: 'Închide' }).last().click();
  await expect(panel(page)).toBeHidden();
});

test('c8 c9 — group rows: «Desfășoară / Restrânge {grup}», «parțial», the group switch toggles all, types on = not muted', async ({ page, context, request }) => {
  await signIn(context, jwt);
  await mockList(page, request);
  const group = catalog.groups.find(g => g.types.length > 1)!;
  const [first, ...rest] = group.types;
  await mockFakePrefs(page, () => prefsWith([first.key]));
  await openPage(page);
  await row(page, 'Memorial Ionescu').click();
  const p = panel(page);
  const groupSwitch = p.getByRole('switch', { name: group.label, exact: true });
  await expect(groupSwitch).toBeChecked();
  await expect(groupSwitch).toHaveAccessibleDescription('parțial');
  // Every group has the disclosure (a one-type group too, as in fish).
  for (const g of catalog.groups) await expect(p.getByRole('button', { name: `Desfășoară ${g.label}` })).toBeVisible();

  await p.getByRole('button', { name: `Desfășoară ${group.label}` }).click();
  await expect(p.getByRole('button', { name: `Restrânge ${group.label}` })).toHaveAttribute('aria-expanded', 'true');
  await expect(p.getByRole('switch', { name: first.label, exact: true })).not.toBeChecked();
  for (const t of rest) await expect(p.getByRole('switch', { name: t.label, exact: true })).toBeChecked();

  // The group switch turns every type off, then on.
  await groupSwitch.click();
  await expect(groupSwitch).not.toBeChecked();
  for (const t of group.types) await expect(p.getByRole('switch', { name: t.label, exact: true })).not.toBeChecked();
  await expect(p.getByText('parțial')).toHaveCount(0);
  await groupSwitch.click();
  for (const t of group.types) await expect(p.getByRole('switch', { name: t.label, exact: true })).toBeChecked();
  // One type off → «parțial», still on.
  await p.getByRole('switch', { name: rest[0].label, exact: true }).click();
  await expect(groupSwitch).toBeChecked();
  await expect(groupSwitch).toHaveAccessibleDescription('parțial');
  await p.getByRole('button', { name: `Restrânge ${group.label}` }).click();
  await expect(p.getByRole('switch', { name: rest[0].label, exact: true })).toBeHidden();
});

test('c10 c16 — edits stay local; Escape and «Închide» discard them; a backdrop click does not close', async ({ page, context, request }) => {
  await signIn(context, jwt);
  await mockList(page, request);
  const puts = await mockFakePrefs(page, () => prefsWith([]));
  for (const viewport of [DESKTOP, PHONE]) {
    await openPage(page, viewport);
    await row(page, 'Memorial Ionescu').click();
    const p = panel(page);
    const sw = p.getByRole('switch', { name: catalog.groups[0].label, exact: true });
    await sw.click();
    await expect(sw).not.toBeChecked();
    // The backdrop / scrim: a click there keeps the panel open.
    await page.mouse.click(5, 5);
    await expect(p).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(p).toBeHidden();
    await row(page, 'Memorial Ionescu').click();
    await expect(sw).toBeChecked();
    await sw.click();
    await p.getByRole('button', { name: 'Închide' }).first().click();
    await expect(p).toBeHidden();
    await row(page, 'Memorial Ionescu').click();
    await expect(sw).toBeChecked();
    await page.keyboard.press('Escape');
  }
  expect(puts).toHaveLength(0);
});

test('c11 c12 c13 c15 — «Salvează» pinned and busy; the PUT keeps extraMuted; success closes and the list refetches (real local CMS)', async ({ page, context, request }) => {
  const errors = collectConsoleErrors(page);
  await signIn(context, jwt);
  const listCalls = await mockList(page, request);
  const puts = track(page, new RegExp(`/api/cms/feed/competitions/${REAL}/notification-preferences$`), 'PUT');
  let release!: () => void;
  const held = new Promise<void>(r => (release = r));
  await page.route(new RegExp(`/api/cms/feed/competitions/${REAL}/notification-preferences$`), async route => {
    if (route.request().method() === 'PUT') await held;
    await route.fallback();
  });
  await openPage(page, PHONE);
  await expect(row(page, realName).getByTestId('followed-summary')).toHaveText('Toate notificările pornite');
  await row(page, realName).click();
  const p = panel(page);
  await expect(p.getByText(FOOTNOTE)).toBeVisible();
  const group = catalog.groups[0];
  await p.getByRole('switch', { name: group.label, exact: true }).click();

  // Pinned: the button sits at the bottom of the sheet, outside the scrolling body.
  const save = p.getByRole('button', { name: 'Salvează' });
  const sb = (await save.boundingBox())!;
  expect(sb.y + sb.height).toBeGreaterThan(PHONE.height - 100);
  const before = listCalls.length;
  await save.click();
  await expect(save).toHaveAttribute('aria-busy', 'true');
  release();
  await expect(p).toBeHidden();

  expect(puts).toHaveLength(1);
  const body = puts[0].postDataJSON() as { mutedTypes: string[] };
  expect(body.mutedTypes.sort()).toEqual([...group.types.map(t => t.key), EXTRA].sort());
  const stored = await readReal(request);
  expect(stored.extraMuted).toEqual([EXTRA]);
  expect(stored.groups[0].types.every(t => t.muted)).toBe(true);
  await expect.poll(() => listCalls.length).toBeGreaterThan(before);
  const n = group.types.length;
  await expect(row(page, realName).getByTestId('followed-summary')).toHaveText(n === 1 ? '1 tip oprit' : `${n} tipuri oprite`);

  // Reopened: the server's state (and the restore for the next tests).
  await row(page, realName).click();
  await expect(p.getByRole('switch', { name: group.label, exact: true })).not.toBeChecked();
  await p.getByRole('switch', { name: group.label, exact: true }).click();
  await p.getByRole('button', { name: 'Salvează' }).click();
  await expect(p).toBeHidden();
  expect((await readReal(request)).extraMuted).toEqual([EXTRA]);
  expect(errors).toEqual([]);
});

test('c14 — a failed save rolls back, toasts and stays open', async ({ page, context, request }) => {
  collectConsoleErrors(page, { ignore: EXPECTED_CONSOLE });
  await signIn(context, jwt);
  await mockList(page, request);
  await page.route(/\/api\/cms\/feed\/competitions\/e2efakeone[^/]+\/notification-preferences$/, route =>
    route.request().method() === 'PUT'
      ? route.fulfill({ status: 500, body: '{}' })
      : route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(prefsWith([])) }),
  );
  await openPage(page);
  await row(page, 'Memorial Ionescu').click();
  const p = panel(page);
  const sw = p.getByRole('switch', { name: catalog.groups[0].label, exact: true });
  await sw.click();
  await p.getByRole('button', { name: 'Salvează' }).click();
  await expect(page.getByRole('alert').getByText(SAVE_FAILED)).toBeVisible();
  await expect(p).toBeVisible();
  await expect(sw).not.toBeChecked();
  // The cache was rolled back: reopened, the server's state (all on).
  await page.keyboard.press('Escape');
  await row(page, 'Memorial Ionescu').click();
  await expect(sw).toBeChecked();
});

test('c10 — an untouched draft follows a fresher answer: a stale cache, then the refetch with a mute set on the phone', async ({ page, context, request }) => {
  await page.clock.install();
  await signIn(context, jwt);
  await mockList(page, request);
  const key = catalog.groups[0].types[0].key;
  const room = 'chat:message:general';
  let phone = false;
  let release!: () => void;
  const held = new Promise<void>(r => (release = r));
  const gets: number[] = [];
  const puts: Request[] = [];
  await page.route(/\/api\/cms\/feed\/competitions\/e2efakeone[^/]+\/notification-preferences$/, async route => {
    if (route.request().method() === 'PUT') {
      puts.push(route.request());
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(prefsWith([key], [room])) });
    }
    gets.push(Date.now());
    if (phone) await held;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(phone ? prefsWith([key], [room]) : prefsWith([])) });
  });
  await openPage(page);
  await row(page, 'Memorial Ionescu').click();
  const p = panel(page);
  const sw = p.getByRole('switch', { name: catalog.groups[0].label, exact: true });
  await expect(sw).toBeChecked();
  await expect(sw).not.toHaveAccessibleDescription('parțial');
  await page.keyboard.press('Escape');
  await expect(p).toBeHidden();

  // The angler mutes a type and a chat room from the phone; the cache goes stale (staleTime 60 s).
  phone = true;
  await page.clock.fastForward('01:05');
  await row(page, 'Memorial Ionescu').click();
  // The stale cache shows first, while the refetch is held …
  await expect(sw).toBeChecked();
  await expect.poll(() => gets.length).toBe(2);
  await expect(sw).not.toHaveAccessibleDescription('parțial');
  release();
  // … then the refetch replaces the untouched draft.
  const types = catalog.groups[0].types;
  if (types.length > 1) await expect(sw).toHaveAccessibleDescription('parțial');
  else await expect(sw).not.toBeChecked();
  // «Salvează» untouched PUTs the fresh list: the phone's mutes survive.
  await p.getByRole('button', { name: 'Salvează' }).click();
  await expect(p).toBeHidden();
  expect(puts).toHaveLength(1);
  expect((puts[0].postDataJSON() as { mutedTypes: string[] }).mutedTypes.sort()).toEqual([key, room].sort());
});

test('c10 — a touched draft is not overwritten by a later answer', async ({ page, context, request }) => {
  await page.clock.install();
  await signIn(context, jwt);
  await mockList(page, request);
  let phone = false;
  let release!: () => void;
  const held = new Promise<void>(r => (release = r));
  let gets = 0;
  await page.route(/\/api\/cms\/feed\/competitions\/e2efakeone[^/]+\/notification-preferences$/, async route => {
    gets++;
    if (phone) await held;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(phone ? prefsWith(catalogKeys()) : prefsWith([])) });
  });
  await openPage(page);
  await row(page, 'Memorial Ionescu').click();
  const p = panel(page);
  const last = catalog.groups.at(-1)!;
  const sw0 = p.getByRole('switch', { name: catalog.groups[0].label, exact: true });
  await expect(sw0).toBeChecked();
  await page.keyboard.press('Escape');
  phone = true;
  await page.clock.fastForward('01:05');
  await row(page, 'Memorial Ionescu').click();
  await expect.poll(() => gets).toBe(2);
  await sw0.click();
  await expect(sw0).not.toBeChecked();
  release();
  await page.waitForResponse(r => /e2efakeone[^/]+\/notification-preferences$/.test(r.url()));
  // The angler's draft stays: the untouched last group still shows on.
  if (catalog.groups.length > 1) await expect(p.getByRole('switch', { name: last.label, exact: true })).toBeChecked();
  await expect(sw0).not.toBeChecked();
  await page.keyboard.press('Escape');
});

test('c14 — while the save is in flight Escape and «Închide» do nothing; the failure toasts with the panel open', async ({ page, context, request }) => {
  collectConsoleErrors(page, { ignore: EXPECTED_CONSOLE });
  await signIn(context, jwt);
  await mockList(page, request);
  let release!: () => void;
  let held = Promise.resolve();
  await page.route(/\/api\/cms\/feed\/competitions\/e2efakeone[^/]+\/notification-preferences$/, async route => {
    if (route.request().method() === 'PUT') {
      await held;
      return route.fulfill({ status: 500, body: '{}' });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(prefsWith([])) });
  });
  for (const viewport of [DESKTOP, PHONE]) {
    await openPage(page, viewport);
    await row(page, 'Memorial Ionescu').click();
    const p = panel(page);
    const sw = p.getByRole('switch', { name: catalog.groups[0].label, exact: true });
    await sw.click();
    held = new Promise<void>(r => (release = r));
    const save = p.getByRole('button', { name: 'Salvează' });
    await save.click();
    await expect(save).toHaveAttribute('aria-busy', 'true');
    await page.keyboard.press('Escape');
    await p.getByRole('button', { name: 'Închide' }).first().click();
    await expect(p).toBeVisible();
    release();
    await expect(page.getByRole('alert').getByText(SAVE_FAILED)).toBeVisible();
    await expect(p).toBeVisible();
    await expect(sw).not.toBeChecked();
    // Idle again: Escape closes, and the reopen shows the server's state.
    await page.keyboard.press('Escape');
    await expect(p).toBeHidden();
    await row(page, 'Memorial Ionescu').click();
    await expect(sw).toBeChecked();
    await page.keyboard.press('Escape');
  }
});

test('a11y — axe 0 at 375/768/1280/1440 with the panel closed and open; keyboard path through the switches and «Salvează»', async ({ page, context, request }) => {
  await signIn(context, jwt);
  await mockList(page, request);
  const puts = await mockFakePrefs(page, () => prefsWith([]));
  for (const width of [375, 768, 1280, 1440]) {
    await openPage(page, { width, height: 900 });
    await expect(page.getByTestId('followed-row')).toHaveCount(3);
    await expectNoA11yViolations(page);
    await row(page, 'Memorial Ionescu').click();
    await expect(panel(page).getByRole('switch').first()).toBeVisible();
    await settled(page);
    await expectNoA11yViolations(page);
    await page.keyboard.press('Escape');
  }

  // Keyboard only: focus the row, Enter opens, Tab reaches the group switch, Space flips it, then
  // «Salvează» saves with Enter.
  await openPage(page, DESKTOP);
  await row(page, 'Memorial Ionescu').focus();
  await page.keyboard.press('Enter');
  const p = panel(page);
  await expect(p).toBeVisible();
  const first = p.getByRole('switch', { name: catalog.groups[0].label, exact: true });
  for (let i = 0; i < 6 && !(await first.evaluate(e => e === document.activeElement)); i++) await page.keyboard.press('Tab');
  await expect(first).toBeFocused();
  await page.keyboard.press('Space');
  await expect(first).not.toBeChecked();
  const save = p.getByRole('button', { name: 'Salvează' });
  for (let i = 0; i < 30 && !(await save.evaluate(e => e === document.activeElement)); i++) await page.keyboard.press('Tab');
  await expect(save).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(p).toBeHidden();
  expect(puts).toHaveLength(1);
  // Focus returns to the row that opened it.
  await expect(row(page, 'Memorial Ionescu')).toBeFocused();
});
