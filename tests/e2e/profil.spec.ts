import { expect, test, type Page } from '@playwright/test';
import { expectNoA11yViolations } from './helpers/a11y';
import { collectConsoleErrors } from './helpers/console';
import { CMS, qaJwt, signIn } from './helpers/session';
import { ON_WEB } from '@/lib/routes';

/*
 * account.own-profile (/profil, T3 — AnglerProfileView mode="own") + account.b.profile-entry.
 * fish: app/(app)/(tabs)/profile.tsx, (tabs)/_layout.tsx (the Profil tab's avatar), components/
 * profile/AnglerProfileScreen.tsx, ProfileHeader.tsx, ProfileSkeleton.tsx, errors/RouteErrorBoundary.
 * Every account.angler-profile state (c2–c37) is proved on /pescari/[id] (pescar.spec.ts) on the
 * SAME view; here: what differs in own mode, the gate, the route's loading and error boundaries.
 *
 * Data: the local QA user against the LOCAL CMS. The one real write (c6) edits the QA user's own
 * bio through /setari/profil and writes the original username, phone and bio back in afterEach
 * (read in beforeAll). Nothing else is written; Firestore is never touched by this page.
 */

const PATH = '/profil';
const WIDTHS = [375, 1280, 1440, 1920] as const;
/** Failed requests the specs provoke on purpose (mocked errors) are logged by the browser. */
const EXPECTED_CONSOLE = [/Failed to load resource: the server responded with a status of (401|404|500)/];

type Original = { documentId: string; username: string; phone: string | null; bio: string | null };
let jwt: string;
let me: Original;
let realPatched = false;

test.beforeAll(async ({ request }) => {
  jwt = await qaJwt(request);
  const res = await request.get(`${CMS}/user/profile`, { headers: { authorization: `Bearer ${jwt}` } });
  expect(res.ok(), 'QA profile read').toBe(true);
  const p = await res.json();
  me = { documentId: p.documentId, username: p.username, phone: p.phone ?? null, bio: p.bio ?? null };
});

test.afterEach(async ({ request }) => {
  if (!realPatched) return;
  realPatched = false;
  const res = await request.patch(`${CMS}/user/profile`, {
    headers: { authorization: `Bearer ${jwt}` },
    data: { username: me.username, phone: me.phone, bio: me.bio },
  });
  expect(res.status(), 'QA profile restored').toBeLessThan(300);
  const after = await (await request.get(`${CMS}/user/profile`, { headers: { authorization: `Bearer ${jwt}` } })).json();
  expect(after.bio ?? null, 'bio restored').toBe(me.bio);
});

async function open(page: Page, { width = 375, path = PATH }: { width?: number; path?: string } = {}) {
  await page.setViewportSize({ width, height: 900 });
  await signIn(page.context(), jwt);
  await page.goto(path);
}

/** The own header has landed (its h1 is the QA user's name). */
async function loaded(page: Page) {
  await expect(page.getByTestId('profile-header')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('heading', { level: 1, name: me.username })).toBeVisible();
}

/** The own header answered by the LOCAL CMS with `patch` applied (the QA user's real data may change). */
async function patchHeader(page: Page, patch: (data: Record<string, unknown>) => void) {
  await page.route(headerUrl(me.documentId), async r => {
    const res = await r.fetch();
    const body = await res.json();
    patch(body.data);
    await r.fulfill({ response: res, json: body });
  });
}

/** Empty catches / sessions lists (the right column stays short). */
async function emptyLists(page: Page) {
  await page.route(new RegExp(`/feed/anglers/${me.documentId}/(catches|sessions)`), r =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        r.request().url().includes('/catches')
          ? { data: [], meta: { pagination: { pageSize: 20, total: 0 }, nextCursor: null } }
          : { data: [], meta: { pagination: { page: 1, pageSize: 10, pageCount: 0, total: 0 } } },
      ),
    }),
  );
}

const tab = (page: Page, name: string) => page.getByRole('tab', { name: new RegExp(`^${name}(, \\d+)?$`) });
const cog = (page: Page) => page.getByTestId('profile-settings-button').filter({ visible: true });
/** The top bar's account trigger (the avatar). */
const account = (page: Page) => page.getByRole('banner').getByRole('button', { name: /^Contul meu, / }).filter({ visible: true });
const headerUrl = (id: string) => new RegExp(`/api/cms/feed/anglers/${id}(\\?.*)?$`);

/* ------------------------------------------------------------------------------------------------
 * Signed out
 * ---------------------------------------------------------------------------------------------- */

test.describe('signed out', () => {
  test('c1 account.b.signed-out-gate: /profil is a real 307 to /intra?next=/profil (the tab kept); the page never renders', async ({ request }) => {
    const res = await request.get(PATH, { maxRedirects: 0 });
    expect(res.status()).toBe(307);
    expect(res.headers().location).toMatch(/\/intra\?next=%2Fprofil$/);
    const tabbed = await request.get(`${PATH}?tab=sesiuni`, { maxRedirects: 0 });
    expect(tabbed.status()).toBe(307);
    expect(tabbed.headers().location).toMatch(/\/intra\?next=%2Fprofil%3Ftab%3Dsesiuni$/);
  });

  test('c1: a dead session cookie also lands on /intra?next=/profil (requireViewer), never on a blank profile', async ({ page }) => {
    await signIn(page.context(), 'e2e-dead-token');
    await page.goto(PATH);
    await expect(page).toHaveURL(/\/intra\?next=%2Fprofil$/);
    await expect(page.getByTestId('angler-profile')).toHaveCount(0);
  });

  test('account.b.profile-entry signed out: the top bar offers «Intră», no avatar; the Home card says «Conectează-te» → /intra (c8)', async ({ page }) => {
    for (const width of [375, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      const banner = page.getByRole('banner');
      await expect(banner.getByRole('link', { name: 'Intră', exact: true }).filter({ visible: true })).toHaveAttribute('href', /^\/intra/);
      await expect(account(page)).toHaveCount(0);
    }
    await page.setViewportSize({ width: 375, height: 900 });
    await expect(page.getByRole('main').getByRole('link', { name: 'Conectează-te', exact: true }).filter({ visible: true })).toHaveAttribute('href', '/intra');
  });
});

/* ------------------------------------------------------------------------------------------------
 * Signed in — own mode
 * ---------------------------------------------------------------------------------------------- */

test.describe('signed in', () => {
  test('c2 c3 c4: the viewer\'s own profile — cog → /setari top right (only once /setari exists), no back, no follow, «Editează profilul»; noindex; axe at 4 widths', async ({ page }) => {
    const errors = collectConsoleErrors(page, { ignore: EXPECTED_CONSOLE });
    const headerRead = page.waitForRequest(r => headerUrl(me.documentId).test(r.url()));
    await open(page);
    await headerRead; // c2: the angler profile of profile.documentId
    await loaded(page);
    const view = page.getByTestId('angler-profile');
    await expect(view).toHaveAttribute('data-mode', 'own');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    await expect(page).toHaveTitle(/Profilul meu/);

    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      if (ON_WEB.settings) {
        // c3: one visible cog (the header row's below 1280, the tab bar's end from 1280), top right.
        await expect(cog(page)).toHaveCount(1);
        await expect(cog(page)).toHaveAttribute('href', '/setari');
        await expect(cog(page)).toHaveAccessibleName('Setări');
        const box = (await cog(page).boundingBox())!;
        // Top right: its right edge is the tab bar's (the content's right edge; centred from ~1680).
        const bar = (await page.getByRole('tablist').locator('..').boundingBox())!;
        expect(bar.x + bar.width - (box.x + box.width), `cog at the right edge (${width})`).toBeLessThanOrEqual(40);
        const tabs = (await page.getByRole('tablist').boundingBox())!;
        expect(box.y, `cog above the list (${width})`).toBeLessThanOrEqual(tabs.y + tabs.height);
      } else {
        // /setari is not on the web yet (account.settings): no cog to the catch-all 404.
        await expect(page.getByTestId('profile-settings-button')).toHaveCount(0);
        await expect(page.locator('a[href="/setari"]')).toHaveCount(0);
      }
      // c3: no back control; c4: no follow button.
      await expect(page.getByRole('button', { name: 'Înapoi', exact: true }).filter({ visible: true })).toHaveCount(0);
      await expect(page.getByRole('link', { name: 'Înapoi', exact: true }).filter({ visible: true })).toHaveCount(0);
      await expect(page.getByTestId('follow-slot')).toHaveCount(0);
      await expect(page.getByRole('button', { name: /^Urmărește/ })).toHaveCount(0);
      await expect(page.getByRole('link', { name: 'Editează profilul' }).filter({ visible: true })).toHaveAttribute('href', '/setari/profil');
      await expectNoA11yViolations(page);
    }
    expect(errors).toEqual([]);
  });

  test('c3: the cog and the account menus\' «Setări» rows lead to a real page, never the 404 (hidden while /setari is not on the web)', async ({ page }) => {
    await open(page);
    await loaded(page);
    if (!ON_WEB.settings) {
      await expect(page.getByTestId('profile-settings-button')).toHaveCount(0);
      // Neither the avatar menu (≥768) nor the phone menu offers a dead «Setări».
      for (const width of [375, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        const menu = width < 768 ? page.getByRole('banner').getByRole('button', { name: 'Meniu', exact: true }).filter({ visible: true }) : account(page);
        await menu.click();
        await expect(page.getByRole('menuitem', { name: 'Profil' }).or(page.getByRole('link', { name: 'Profil', exact: true })).filter({ visible: true }).first()).toBeVisible();
        await expect(page.getByRole('menuitem', { name: 'Setări', exact: true })).toHaveCount(0);
        await expect(page.getByRole('link', { name: 'Setări', exact: true }).filter({ visible: true })).toHaveCount(0);
        await page.keyboard.press('Escape');
      }
      return;
    }
    await cog(page).click();
    await expect(page).toHaveURL(/\/setari$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Pagina nu există' })).toHaveCount(0);
  });

  test('c2: tab switching — the URL follows, a reload keeps the tab, only the selected list is read; keyboard arrows', async ({ page }) => {
    const errors = collectConsoleErrors(page, { ignore: EXPECTED_CONSOLE });
    const lists: string[] = [];
    page.on('request', r => {
      const m = r.url().match(new RegExp(`/feed/anglers/${me.documentId}/(catches|sessions|competitions)`));
      if (m) lists.push(m[1]);
    });
    await open(page, { width: 1280 });
    await loaded(page);
    await expect(tab(page, 'Capturi')).toHaveAttribute('aria-selected', 'true');
    await page.waitForLoadState('networkidle');
    // Capturi's first page came with the HTML (server prefetch): the browser reads no list yet.
    expect(lists).toEqual([]);

    await tab(page, 'Concursuri').click();
    await expect(page).toHaveURL(/\/profil\?tab=concursuri$/);
    await expect(page.getByTestId('panel-concursuri')).toBeVisible();
    await expect(page.getByTestId('competition-card').or(page.getByTestId('tab-empty')).first()).toBeVisible();
    expect(lists).toContain('competitions');
    expect(lists).not.toContain('sessions');

    await page.reload();
    await loaded(page);
    await expect(tab(page, 'Concursuri')).toHaveAttribute('aria-selected', 'true');

    // Keyboard: the tabs are a real tablist (arrows move, Enter selects).
    await tab(page, 'Concursuri').focus();
    await page.keyboard.press('ArrowLeft');
    await expect(tab(page, 'Partide')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(tab(page, 'Partide')).toHaveAttribute('aria-selected', 'true');
    await expect(page).toHaveURL(/\/profil\?tab=sesiuni$/);
    await expect(page.getByTestId('session-card').or(page.getByTestId('tab-empty')).first()).toBeVisible();
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/profil$/);
    expect(errors).toEqual([]);
  });

  for (const width of [375, 1280]) {
    test(`c4 loading (${width}): the own skeleton — no follow pill, the edit button's bone, «Profilul meu» — and the tab bar does not move when the header lands`, async ({ page }) => {
      let release!: () => void;
      const gate = new Promise<void>(r => (release = r));
      await page.route(headerUrl(me.documentId), async r => {
        await gate;
        await r.fallback();
      });
      await open(page, { width });
      const skeleton = page.getByTestId('profile-header-skeleton').filter({ visible: true });
      await expect(skeleton).toHaveCount(1);
      await expect(page.getByTestId('follow-skeleton')).toHaveCount(0);
      await expect(skeleton.getByTestId('edit-skeleton')).toBeVisible();
      // The page's heading is the own one while the header is pending (the streamed shell's too).
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Profilul meu');
      await expect(page.getByRole('complementary', { name: 'Despre mine' })).toBeAttached();
      if (ON_WEB.settings) await expect(cog(page)).toBeVisible();
      await expect(page.getByRole('button', { name: 'Înapoi', exact: true })).toHaveCount(0);
      const before = (await page.getByRole('tablist').boundingBox())!.y;
      release();
      await loaded(page);
      await expect(page.getByTestId('profile-header-skeleton')).toHaveCount(0);
      const after = (await page.getByRole('tablist').boundingBox())!.y;
      expect(Math.abs(after - before), `tab bar y ${before} → ${after}`).toBeLessThanOrEqual(2);
    });
  }

  test('c4: the header fails → the own page keeps «Profilul meu» / «Despre mine» (never another angler\'s title)', async ({ page }) => {
    await page.route(headerUrl(me.documentId), r => r.fulfill({ status: 500, contentType: 'application/json', body: '{}' }));
    await open(page);
    await expect(page.getByRole('button', { name: 'Încearcă din nou' }).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Profilul meu');
    await expect(page.getByRole('complementary', { name: 'Despre mine' })).toBeAttached();
  });

  test('c2 empty tabs: a catch without a photo is named, never «Nicio captură încă»; ≥768 the empty tab is a state card', async ({ page }) => {
    // Mocked header (1 catch, no sessions) and empty lists: the QA user's real counts may change.
    await page.route(headerUrl(me.documentId), async r => {
      const res = await r.fetch();
      const body = await res.json();
      body.data.counts = { ...body.data.counts, catches: 1, sessions: 0 };
      await r.fulfill({ response: res, json: body });
    });
    await page.route(new RegExp(`/feed/anglers/${me.documentId}/(catches|sessions)`), r =>
      r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          r.request().url().includes('/catches')
            ? { data: [], meta: { pagination: { pageSize: 20, total: 0 }, nextCursor: null } }
            : { data: [], meta: { pagination: { page: 1, pageSize: 10, pageCount: 0, total: 0 } } },
        ),
      }),
    );
    // Opened on Concursuri (the server prefetches that tab only), so Capturi and Partide are read
    // in the browser when selected — the mocks above answer them.
    await open(page, { width: 375, path: `${PATH}?tab=concursuri` });
    await loaded(page);
    await tab(page, 'Capturi').click();
    await expect(page.getByTestId('tab-empty')).toHaveText('Nicio captură cu fotografie');
    await expect(page.getByTestId('tab-empty-line')).toHaveText('1 captură fără fotografie. Aici apar doar capturile cu fotografie.');
    await expect(page.getByText('Nicio captură încă')).toHaveCount(0);
    for (const width of [375, 1280, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      const card = page.getByTestId('tab-empty-state');
      const bg = await card.evaluate(el => getComputedStyle(el).backgroundColor);
      if (width >= 768) {
        expect(bg, `card at ${width}`).not.toBe('rgba(0, 0, 0, 0)');
        await expect(card.locator('svg').first()).toBeVisible();
      }
      if (width >= 1280) {
        // One alignment in the column: the card's edges are the tab bar's (never a centred 720 card).
        const [c, bar] = await Promise.all([card.boundingBox(), page.getByRole('tablist').locator('..').boundingBox()]);
        expect(Math.abs(c!.x - bar!.x), `left edges at ${width}`).toBeLessThanOrEqual(1);
        expect(Math.abs(c!.x + c!.width - (bar!.x + bar!.width)), `right edges at ${width}`).toBeLessThanOrEqual(1);
      }
      if (width < 768) {
        expect(bg, 'no card on the phone').toBe('rgba(0, 0, 0, 0)');
      }
      await page.screenshot({ path: `test-results/profil-empty-capturi-${width}.png` });
    }
    await tab(page, 'Partide').click();
    await expect(page.getByTestId('tab-empty')).toHaveText('Nicio partidă publică încă');
    await expect(page.getByTestId('tab-empty-line')).toHaveText('Partidele le pornești din aplicația Bluvi; aici apar cele publice.');
    await page.screenshot({ path: 'test-results/profil-empty-sesiuni-1920.png' });
  });

  test('≥1280 the identity card is never capped or scrolled inside: a tall card (long name, 3-line bio, podiums) scrolls with the page; the podium is its own bento tile; «Partide» names one count', async ({ page }) => {
    const errors = collectConsoleErrors(page, { ignore: EXPECTED_CONSOLE });
    await patchHeader(page, d => {
      d.username = 'Alexandru-Constantin Popescu-Vlădescu';
      d.bio = 'Pescar de crap de peste douăzeci de ani, pe Snagov, Cernica și Bascov. Feeder iarna, crap vara, somn noaptea. #crap #feeder_2026 #Snagov\nConcursuri de club și naționale, organizator la două ediții ale Cupei de primăvară.\nCaut parteneri pentru echipă.';
      d.podium = { first: 12, second: 7, third: 3 };
      d.counts = { ...(d.counts as object), sessions: 120, competitions: 44 };
    });
    await emptyLists(page);
    await open(page, { width: 1440, path: PATH });
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(page.getByTestId('profile-header')).toBeVisible({ timeout: 20_000 });
    const aside = page.getByRole('complementary', { name: 'Despre mine' });
    const podium = page.getByTestId('podium-tile');
    await expect(podium).toBeVisible();
    await expect(podium.getByRole('listitem')).toHaveCount(3);
    await expect(podium).toContainText('12');
    await expect(page.getByTestId('trophy-row').filter({ visible: true })).toHaveCount(0);
    // Nothing scrolls inside the card: no height cap, no inner scroll area.
    const m = await aside.evaluate(el => ({ sh: el.scrollHeight, ch: el.clientHeight, oy: getComputedStyle(el).overflowY, mh: getComputedStyle(el).maxHeight }));
    expect(m.sh, `scrollHeight ${m.sh} vs clientHeight ${m.ch}`).toBe(m.ch);
    expect(m.oy).toBe('visible');
    expect(m.mh).toBe('none');
    // The card's last tile is reachable: scrolled to the end, the whole card is inside the viewport.
    const concursuri = page.getByTestId('stat-bento').locator(':scope > div').last();
    await expect(concursuri).toContainText('44');
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect.poll(async () => {
      const b = (await aside.boundingBox())!;
      return b.y + b.height;
    }, { message: 'the card bottom inside the 900px viewport' }).toBeLessThanOrEqual(900);
    // One name for one concept: the tab says «Partide» (the badge capped, the full figure spoken).
    await expect(page.getByRole('tab', { name: 'Partide, 120' })).toBeVisible();
    await expect(page.getByRole('tab', { name: /^Sesiuni/ })).toHaveCount(0);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: 'test-results/profil-tall-card-1440x900.png' });
    await expectNoA11yViolations(page);
    expect(errors).toEqual([]);
  });

  for (const width of [375, 768]) {
    test(`phone/tablet (${width}): no header row of one lone refresh chip — it sits in the header band's top-right corner, the avatar right under the bar`, async ({ page }) => {
      test.skip(ON_WEB.settings, 'with /setari the row holds refresh + the cog');
      await open(page, { width });
      await loaded(page);
      const row = page.getByTestId('profile-header-row');
      expect(await row.evaluate(el => getComputedStyle(el).position)).toBe('absolute');
      const aside = (await page.getByRole('complementary', { name: 'Despre mine' }).boundingBox())!;
      const chip = (await row.getByRole('button', { name: 'Reîmprospătează' }).boundingBox())!;
      // Inside the white band, top right.
      expect(chip.y).toBeGreaterThanOrEqual(aside.y);
      expect(chip.y + chip.height).toBeLessThanOrEqual(aside.y + 64);
      expect(aside.x + aside.width - (chip.x + chip.width)).toBeLessThanOrEqual(24);
      const avatar = (await page.getByTestId('profile-header').locator('div').first().boundingBox())!;
      expect(avatar.y - aside.y, 'avatar under the bar, no empty toolbar above it').toBeLessThanOrEqual(20);
      // The chip never covers the avatar.
      expect(chip.x).toBeGreaterThan(avatar.x + avatar.width);
      await page.screenshot({ path: `test-results/profil-header-${width}.png`, fullPage: false });
    });
  }

  test('loading: the streamed shell is the own-mode skeleton (chips right, no back, no follow pill) at 4 widths', async ({ page, request }) => {
    // The document streams the route skeleton (loading.tsx / the page's Suspense fallback) first,
    // then the profile in hidden segments («<div hidden id="S:…">») that React swaps in. The dev
    // server cannot be slowed from the browser (the session gate is a server read, and a held RSC
    // request keeps the old page), so the loading state is rendered from the real HTML cut where the
    // streamed segments begin, with scripts blocked: exactly what a visitor sees until they land.
    const res = await request.get(PATH, { headers: { cookie: `bluvi_session=${jwt}` } });
    expect(res.status()).toBe(200);
    const html = await res.text();
    const cut = html.indexOf('<div hidden id="S:');
    expect(cut, 'the profile streams after the shell').toBeGreaterThan(0);
    const shell = html.slice(0, cut);
    expect(shell).toContain('data-testid="profile-fallback" data-mode="own"');
    expect(shell).not.toContain('follow-skeleton');
    expect(shell).not.toContain('data-testid="angler-profile"');
    await page.route('**/_next/static/**/*.js', r => r.abort());
    await page.route(new RegExp(`${PATH}$`), r => r.fulfill({ status: 200, contentType: 'text/html', body: `${shell}</body></html>` }));
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(PATH);
      const fallback = page.getByTestId('profile-fallback').filter({ visible: true }).first();
      await expect(fallback).toBeVisible();
      await expect(fallback).toHaveAttribute('aria-label', 'Se încarcă profilul');
      await expect(fallback.getByTestId('profile-header-skeleton').filter({ visible: true })).toHaveCount(1);
      await expect(page.getByRole('button', { name: 'Înapoi', exact: true })).toHaveCount(0);
    }
  });

  test('c5 account.b.profile-entry: the avatar thumb opens the account menu → Profil; ring + «current» on /profil only', async ({ page }) => {
    for (const width of [375, 1440]) {
      await open(page, { width, path: '/' });
      const trigger = account(page);
      await expect(trigger).toBeVisible();
      // The thumb: the user's photo, or the Bluvi mark without one (global.shell.c6).
      await expect(trigger.locator('img, svg').first()).toBeVisible();
      const thumb = trigger.locator('[data-account-avatar]');
      expect(await thumb.evaluate(el => getComputedStyle(el).boxShadow), `no ring off /profil (${width})`).toBe('none');
      await expect(trigger).not.toHaveAccessibleName(/pagina curentă/);
      await trigger.click();
      await page.getByRole('menuitem', { name: 'Profil' }).click();
      await expect(page).toHaveURL(/\/profil$/);
      await loaded(page);
      const onProfile = account(page);
      // fish: the Profil tab's avatar gets the indigo ring when focused (_layout.tsx:117-121) — on the
      // thumb itself, never on the whole trigger (that would read as the focus ring).
      const onThumb = onProfile.locator('[data-account-avatar]');
      await expect.poll(() => onThumb.evaluate(el => getComputedStyle(el).boxShadow), { message: `ring on /profil (${width})` }).not.toBe('none');
      expect(await onProfile.evaluate(el => getComputedStyle(el).boxShadow), `no ring on the trigger (${width})`).toBe('none');
      const t = (await onProfile.boundingBox())!;
      const a = (await onThumb.boundingBox())!;
      expect(a.width, 'the 32px thumb').toBe(32);
      await page.screenshot({ path: `test-results/profil-c5-ring-${width}.png`, clip: { x: Math.max(0, t.x - 24), y: 0, width: t.width + 48, height: t.y + t.height + 12 } });
      await expect(onProfile).toHaveAccessibleName(/pagina curentă e în acest meniu$/);
      await onProfile.click();
      await expect(page.getByRole('menuitem', { name: 'Profil' })).toHaveAttribute('aria-current', 'page');
      await page.keyboard.press('Escape');
    }
  });

  test('c8: the Home profile card opens /profil when signed in', async ({ page }) => {
    await open(page, { path: '/' });
    const title = page.getByRole('heading', { level: 1 }).filter({ visible: true });
    await expect(title.getByRole('link')).toHaveAttribute('href', '/profil');
    await title.getByRole('link').click();
    await expect(page).toHaveURL(/\/profil$/);
    await loaded(page);
  });

  test('c6: a bio saved in Editează profilul shows on /profil without a reload (every angler query invalidated)', async ({ page }) => {
    const errors = collectConsoleErrors(page, { ignore: EXPECTED_CONSOLE });
    await open(page);
    await loaded(page);
    // The page is never reloaded: a marker on window would not survive a document load.
    await page.evaluate(() => ((window as unknown as { __e2eNoReload: boolean }).__e2eNoReload = true));
    const next = `E2E bio ${Date.now()} #profil`;
    await page.getByRole('link', { name: 'Editează profilul' }).filter({ visible: true }).click();
    await expect(page).toHaveURL(/\/setari\/profil$/);
    const bio = page.getByLabel('Biografie');
    await expect(bio).toBeEditable({ timeout: 20_000 });
    await bio.fill(next);
    realPatched = true;
    await page.getByRole('button', { name: 'Finalizează' }).filter({ visible: true }).click();
    await expect(page).toHaveURL(/\/profil$/);
    await expect(page.getByTestId('bio').filter({ visible: true })).toContainText(next.replace(' #profil', ''));
    await expect(page.getByTestId('bio').filter({ visible: true })).toContainText('#profil');
    expect(await page.evaluate(() => (window as unknown as { __e2eNoReload?: boolean }).__e2eNoReload)).toBe(true);
    expect(errors).toEqual([]);
  });

  test('c7: the page throws while rendering → the route error with «Încearcă din nou»; the top bar keeps working; the retry recovers', async ({ page }) => {
    // The throw: the reputation read answers a sentinel average and the header's `toFixed` on it is
    // made to throw (only for that value, only while the flag is up) — a render error inside the
    // profile, as a broken CMS contract or a bug would raise. Errors React logs for the caught
    // throw are expected here.
    const errors = collectConsoleErrors(page, { ignore: [...EXPECTED_CONSOLE, /e2e render throw/, /The above error occurred/, /error boundary/i] });
    await page.addInitScript(() => {
      const w = window as unknown as { __e2eThrow: boolean };
      w.__e2eThrow = true;
      const original = Number.prototype.toFixed;
      Number.prototype.toFixed = function (this: number, digits?: number) {
        if (w.__e2eThrow && Number(this) === 4.321) throw new Error('e2e render throw');
        return original.call(this, digits);
      };
    });
    await page.route(new RegExp(`/feed/users/${me.documentId}/reputation`), r =>
      r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { avgStars: 4.321, ratingCount: 1, noShowCount: 0, areas: { rules: null, cleanliness: null, behavior: null }, reviews: [] } }),
      }),
    );
    for (const width of WIDTHS) {
      await open(page, { width });
      const alert = page.getByRole('alert').filter({ hasText: 'Ceva n-a mers' });
      await expect(alert).toBeVisible({ timeout: 20_000 });
      await expect(alert).toContainText('A apărut o problemă neașteptată pe acest ecran.');
      await expect(alert).not.toContainText('e2e render throw');
      await expect(page.getByRole('heading', { level: 1, name: 'Profilul meu' })).toBeAttached();
      await expect(page.getByTestId('angler-profile')).toHaveCount(0);
      await expectNoA11yViolations(page, { exclude: ['nextjs-portal'] });
    }
    // The rest of the app keeps working: the top bar is there and navigates.
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(account(page)).toBeVisible();
    // The retry re-renders the page; with the fault gone it recovers in place.
    await page.evaluate(() => ((window as unknown as { __e2eThrow: boolean }).__e2eThrow = false));
    await page.getByRole('button', { name: 'Încearcă din nou' }).click();
    await loaded(page);
    await expect(page.getByRole('alert').filter({ hasText: 'Ceva n-a mers' })).toHaveCount(0);
    await page.getByRole('banner').getByRole('link', { name: 'Bălți', exact: true }).filter({ visible: true }).click();
    await expect(page).toHaveURL(/\/balti$/);
    expect(errors).toEqual([]);
  });
});
