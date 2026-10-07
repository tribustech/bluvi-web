import { expect, test, type Page, type Route } from '@playwright/test';
import { expectNoA11yViolations } from './helpers/a11y';
import { collectConsoleErrors } from './helpers/console';
import { CMS, qaJwt, signIn } from './helpers/session';

/*
 * account.connections (/pescari/[id]/conexiuni, T1) — fish app/(app)/anglers/[documentId]/connections.tsx.
 *
 * Data: the local QA user against the LOCAL CMS.
 *  - REAL: Andrew R (ANDREW_R — follows four anglers, among them cristian_Test, whom the QA user does
 *    not follow: TARGET, the one angler a test really follows, unfollowed again in afterEach and
 *    re-checked through the API); Andrew (ANDREW — the QA user follows him, so the QA user's own row
 *    is in his followers).
 *  - MOCKED: a made-up id (MOCK) whose header and lists are route-mocked for the states the local
 *    DB lacks (empty lists, a 25-row two-page list with a repeat across pages, a slow first page, a
 *    failed one). Both lists are read in the browser (/api/cms), so a browser route answers them.
 * Firestore is never touched by this page.
 */

const ANDREW_R = 'vsfh2zhq9fkie6njt0ciok5u';
const ANDREW = 'pnn9hirv7cnsevhwljusv55c';
const TARGET = 'g93wkk4cuqs8fghhls3a8cqr';
const MOCK = 'e2emockconnections000001';
const AXE_WIDTHS = [375, 768, 1280, 1440, 1920] as const;
/** Failed requests the specs provoke on purpose (a mocked 500) are logged by the browser. */
const EXPECTED_CONSOLE = [/Failed to load resource: the server responded with a status of 500/];

let jwt: string;
let selfId: string;
let followed = false;

const auth = () => ({ authorization: `Bearer ${jwt}` });

test.beforeAll(async ({ request }) => {
  jwt = await qaJwt(request);
  const me = await request.get(`${CMS}/user/profile`, { headers: auth() });
  expect(me.ok(), 'QA profile read').toBe(true);
  selfId = (await me.json()).documentId as string;
});

test.afterEach(async ({ request }) => {
  if (!followed) return;
  followed = false;
  await request.post(`${CMS}/feed/anglers/${TARGET}/unfollow`, { headers: auth() });
  const after = await request.get(`${CMS}/feed/anglers/${TARGET}`, { headers: auth() });
  expect((await after.json()).data.isFollowedByMe, 'follow undone').toBe(false);
});

/* ------------------------------------------------------------------------------------------------
 * Mocked angler
 * ---------------------------------------------------------------------------------------------- */

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

function header(counts: { followers: number; following: number }) {
  return {
    id: 999002,
    documentId: MOCK,
    username: 'Pescar Conexiuni',
    avatarUrl: null,
    bio: null,
    memberSince: '2025-03-01T10:00:00.000Z',
    counts: { ...counts, catches: 0, sessions: 0, competitions: 0 },
    biggestCatch: null,
    podium: { first: 0, second: 0, third: 0 },
    isFollowedByMe: false,
    isSelf: false,
  };
}

const row = (n: number) => ({ documentId: `e2econn${String(n).padStart(17, '0')}`, username: `Pescar ${n}`, avatarUrl: null, isFollowedByMe: n % 3 === 0 });
const page1 = () => ({ data: Array.from({ length: 20 }, (_, i) => row(i + 1)), meta: { pagination: { page: 1, pageSize: 20, pageCount: 2, total: 25 } } });
/** Page 2 repeats row 20 (a follow between the two fetches shifted the offset): shown once (c10). */
const page2 = () => ({ data: [20, 21, 22, 23, 24, 25].map(row), meta: { pagination: { page: 2, pageSize: 20, pageCount: 2, total: 25 } } });
const EMPTY = { data: [], meta: { pagination: { page: 1, pageSize: 20, pageCount: 0, total: 0 } } };

type ListMock = (route: Route, page: number) => Promise<void> | void;

/** The mocked angler's header and lists; returns the list requests seen. */
async function mockAngler(
  page: Page,
  {
    counts = { followers: 25, following: 0 },
    followers = (r, p) => json(r, p === 2 ? page2() : page1()),
    following = r => json(r, EMPTY),
  }: { counts?: { followers: number; following: number }; followers?: ListMock; following?: ListMock } = {},
) {
  const seen = { followers: [] as string[], following: [] as string[] };
  await page.route(new RegExp(`/feed/anglers/${MOCK}(\\?.*)?$`), r => json(r, { data: header(counts) }));
  await page.route(new RegExp(`/feed/users/${MOCK}/reputation`), r => json(r, { data: null }));
  for (const kind of ['followers', 'following'] as const) {
    await page.route(new RegExp(`/feed/anglers/${MOCK}/${kind}`), r => {
      seen[kind].push(r.request().url());
      const p = Number(new URL(r.request().url()).searchParams.get('page') ?? 1);
      return (kind === 'followers' ? followers : following)(r, p);
    });
  }
  return seen;
}

const tab = (page: Page, name: 'Urmăritori' | 'Urmărește') => page.getByRole('tab', { name: new RegExp(`^${name}(, \\d+)?$`) });
/*
 * Visible-only: Next keeps the previous route mounted but hidden (<Activity>) after a client
 * navigation, so a profile visited before is still in the DOM with the same test ids.
 */
const rows = (page: Page) => page.locator('[data-testid="connection-row"]:visible');
const rowOf = (page: Page, id: string) => page.locator(`[data-testid="connection-row"][data-id="${id}"]:visible`);
const byTestId = (page: Page, id: string) => page.locator(`[data-testid="${id}"]:visible`);

/* ------------------------------------------------------------------------------------------------
 * c1 — signed out
 * ---------------------------------------------------------------------------------------------- */

test.describe('signed out', () => {
  test('c1: no cookie → a real 307 to /intra with this page (and its tab) as the way back', async ({ request }) => {
    const res = await request.get(`/pescari/${ANDREW_R}/conexiuni?tab=urmareste`, { maxRedirects: 0 });
    expect(res.status()).toBe(307);
    expect(res.headers().location).toContain(`/intra?next=${encodeURIComponent(`/pescari/${ANDREW_R}/conexiuni?tab=urmareste`)}`);
  });

  test('c1: a dead session cookie → sign-in (requireViewer), the tab kept in next', async ({ page }) => {
    await signIn(page.context(), 'e2e-dead-session-token');
    await page.goto(`/pescari/${ANDREW_R}/conexiuni?tab=following`);
    await expect(page).toHaveURL(new RegExp(`/intra\\?next=${encodeURIComponent(`/pescari/${ANDREW_R}/conexiuni?tab=following`).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
  });
});

/* ------------------------------------------------------------------------------------------------
 * Signed in
 * ---------------------------------------------------------------------------------------------- */

test.describe('signed in', () => {
  test.beforeEach(async ({ page }) => signIn(page.context(), jwt));

  test('c2 c3 c4: header, tabs from ?tab=, only the selected list requested, URL follows the tab by replace, keyboard', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 }); // the footer stays out of auto-load range
    const errors = collectConsoleErrors(page);
    const seen = await mockAngler(page, { counts: { followers: 25, following: 0 } });
    await page.goto(`/pescari/${MOCK}/conexiuni?tab=following`);

    // c2
    await expect(page.getByRole('heading', { level: 1, name: 'Conexiuni' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Înapoi' })).toBeVisible();
    await expect(page.getByTestId('connections-owner')).toHaveText('Pescar Conexiuni');

    // c3: fish's ?tab=following opens Urmărește; the tab bar is a tablist with a count badge.
    await expect(tab(page, 'Urmărește')).toHaveAttribute('aria-selected', 'true');
    await expect(tab(page, 'Urmăritori')).toHaveAttribute('aria-selected', 'false');
    await expect(page.getByRole('tab', { name: 'Urmăritori, 25' })).toBeVisible();
    await expect(page.getByText('Nu urmărește pe nimeni încă')).toBeVisible();

    // c4: only the selected list was asked for, page-numbered, pageSize 20.
    expect(seen.followers).toEqual([]);
    expect(seen.following).toHaveLength(1);
    const q = new URL(seen.following[0]).searchParams;
    expect([q.get('page'), q.get('pageSize')]).toEqual(['1', '20']);

    // Keyboard: focus the selected tab, ← selects Urmăritori — URL replaced (no new history entry).
    const historyLength = await page.evaluate(() => history.length);
    await tab(page, 'Urmărește').focus();
    await page.keyboard.press('ArrowLeft');
    await expect(tab(page, 'Urmăritori')).toHaveAttribute('aria-selected', 'true');
    await expect(tab(page, 'Urmăritori')).toBeFocused();
    await expect(page).toHaveURL(new RegExp(`/pescari/${MOCK}/conexiuni$`));
    await expect(rows(page)).toHaveCount(20);
    expect(seen.followers.length).toBeGreaterThan(0);
    await page.keyboard.press('ArrowRight');
    await expect(tab(page, 'Urmărește')).toHaveAttribute('aria-selected', 'true');
    await expect(page).toHaveURL(new RegExp(`/pescari/${MOCK}/conexiuni\\?tab=urmareste$`));
    expect(await page.evaluate(() => history.length)).toBe(historyLength);
    expect(errors).toEqual([]);
  });

  test('c7: while the first page loads, seven skeleton rows', async ({ page }) => {
    let release!: () => void;
    const held = new Promise<void>(res => (release = res));
    await mockAngler(page, {
      followers: async (r, p) => {
        await held;
        await json(r, p === 2 ? page2() : page1());
      },
    });
    await page.goto(`/pescari/${MOCK}/conexiuni`);
    await expect(page.getByRole('button', { name: 'Înapoi' })).toBeVisible(); // the client list, not the gate's fallback
    const skeleton = page.getByTestId('connections-skeleton');
    await expect(skeleton).toBeVisible();
    await expect(skeleton.locator('li')).toHaveCount(7);
    await expect(skeleton).toContainText('Se încarcă');
    release();
    await expect(skeleton).toHaveCount(0);
    await expect(rows(page).first()).toBeVisible();
  });

  test('c8: the empty copy per tab', async ({ page }) => {
    await mockAngler(page, { counts: { followers: 0, following: 0 }, followers: r => json(r, EMPTY) });
    await page.goto(`/pescari/${MOCK}/conexiuni`);
    await expect(page.getByText('Niciun urmăritor încă')).toBeVisible();
    await expect(rows(page)).toHaveCount(0);
    // Zero is never a badge.
    await expect(page.getByRole('tab', { name: 'Urmăritori' })).toHaveText('Urmăritori');
    await tab(page, 'Urmărește').click();
    await expect(page.getByText('Nu urmărește pe nimeni încă')).toBeVisible();
    await expectNoA11yViolations(page);
  });

  test('error: the T1 error card, «Încearcă din nou» reloads the list', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 }); // the footer stays out of auto-load range
    const errors = collectConsoleErrors(page, { ignore: EXPECTED_CONSOLE });
    let fail = true;
    await mockAngler(page, {
      followers: (r, p) => (fail ? json(r, { error: { status: 500, message: 'boom' } }, 500) : json(r, p === 2 ? page2() : page1())),
    });
    await page.goto(`/pescari/${MOCK}/conexiuni`);
    await expect(page.getByText('Nu am putut încărca urmăritorii')).toBeVisible({ timeout: 30_000 }); // after core's retries
    fail = false;
    await page.getByRole('button', { name: 'Încearcă din nou' }).click();
    await expect(rows(page)).toHaveCount(20);
    expect(errors).toEqual([]);
  });

  test('c9 c10: the next page loads near the end (spinner footer), a repeat across pages is shown once', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    let release!: () => void;
    const held = new Promise<void>(res => (release = res));
    const seen = await mockAngler(page, {
      followers: async (r, p) => {
        if (p === 2) await held;
        await json(r, p === 2 ? page2() : page1());
      },
    });
    await page.goto(`/pescari/${MOCK}/conexiuni`);
    await expect(rows(page)).toHaveCount(20);
    await expect(page.getByText('20 din 25 de urmăritori')).toBeVisible();
    // c5: no photo → the initials on a 40px disc.
    const initials = rows(page).first().locator('> :first-child');
    await expect(initials).toHaveText('P1');
    expect(Math.round((await initials.boundingBox())!.width)).toBe(40);

    // Scrolling to the end asks for page 2; the footer button says a page is on its way.
    await page.getByRole('button', { name: 'Încarcă mai multe' }).scrollIntoViewIfNeeded();
    const more = page.getByRole('button', { name: 'Se încarcă…' });
    await expect(more).toBeVisible();
    await expect(more).toHaveAttribute('aria-busy', 'true');
    expect(new URL(seen.followers.at(-1)!).searchParams.get('page')).toBe('2');
    release();

    // 20 + 6 − the repeat of row 20 = 25 unique rows, in order, and the footer is gone.
    await expect(rows(page)).toHaveCount(25);
    const ids = await rows(page).evaluateAll(els => els.map(e => e.getAttribute('data-id')));
    expect(new Set(ids).size).toBe(25);
    expect(ids.at(-1)).toBe(row(25).documentId);
    await expect(page.getByRole('button', { name: /Încarcă mai multe|Se încarcă/ })).toHaveCount(0);
  });

  test('c9: the footer button is the keyboard path to the next page', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await mockAngler(page);
    await page.goto(`/pescari/${MOCK}/conexiuni`);
    await expect(rows(page)).toHaveCount(20);
    const more = page.getByRole('button', { name: 'Încarcă mai multe' });
    await more.focus();
    await page.keyboard.press('Enter');
    await expect(rows(page)).toHaveCount(25);
  });

  test('c5 c6: 40px avatar with initials, one-line name, the own row has no button; the row opens the profile', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await page.goto(`/pescari/${ANDREW}/conexiuni`);
    const own = rowOf(page, selfId);
    const other = rowOf(page, ANDREW_R);
    await expect(own).toBeVisible();
    await expect(own.getByRole('button')).toHaveCount(0);
    await expect(other.getByRole('button', { name: /^(Urmărește pe Andrew R|Urmăresc pe Andrew R — apasă ca să nu mai urmărești)$/ })).toBeVisible();

    // Avatar: 40px (a photo here; the initials fallback is checked on the mocked rows, c9).
    const avatar = other.locator('> :first-child');
    const box = await avatar.boundingBox();
    expect([Math.round(box!.width), Math.round(box!.height)]).toEqual([40, 40]);
    // The name stays on one line.
    const name = other.getByRole('link', { name: 'Andrew R' });
    expect(await name.evaluate(el => getComputedStyle(el).whiteSpace)).toBe('nowrap');

    // c6: activating the row (anywhere on the card but the button) opens the angler's profile.
    const card = await other.boundingBox();
    await page.mouse.click(card!.x + card!.width * 0.45, card!.y + card!.height / 2);
    await expect(page).toHaveURL(new RegExp(`/pescari/${ANDREW_R}$`));
    await expect(byTestId(page, 'profile-header')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('c11: following from a row flips it at once; the profiles involved show the new counts', async ({ page, request }) => {
    const errors = collectConsoleErrors(page);
    const read = async (id: string) => (await (await request.get(`${CMS}/feed/anglers/${id}`, { headers: auth() })).json()).data;
    const target = await read(TARGET);
    expect(target.isFollowedByMe, 'precondition: the QA user does not follow cristian_Test').toBe(false);
    const selfBefore = (await read(selfId)).counts.following as number;

    // From Andrew R's profile, «N urmărește» opens his following tab (ON_WEB.connections).
    await page.goto(`/pescari/${ANDREW_R}`);
    await byTestId(page, 'following-count').click();
    await expect(page).toHaveURL(new RegExp(`/pescari/${ANDREW_R}/conexiuni\\?tab=urmareste$`));
    const button = rowOf(page, TARGET).getByRole('button');
    await expect(button).toHaveText('Urmărește');

    // Hold the POST: the row has already flipped (optimistic) and the button waits.
    let release!: () => void;
    const held = new Promise<void>(res => (release = res));
    await page.route(new RegExp(`/feed/anglers/${TARGET}/follow$`), async r => {
      await held;
      await r.fallback();
    });
    followed = true;
    const posted = page.waitForResponse(r => r.url().endsWith(`/feed/anglers/${TARGET}/follow`) && r.request().method() === 'POST');
    await button.click();
    await expect(button).toHaveText('Urmăresc');
    await expect(button).toHaveAccessibleName(/^Urmăresc pe /);
    await expect(button).toHaveAttribute('aria-disabled', 'true');
    await expect(page).toHaveURL(new RegExp(`/pescari/${ANDREW_R}/conexiuni\\?tab=urmareste$`)); // the button never navigates
    release();
    expect((await posted).ok()).toBe(true);
    await expect(button).not.toHaveAttribute('aria-disabled');

    // The followed angler's profile: one more follower, «Urmăresc».
    await rowOf(page, TARGET).getByRole('link').click();
    await expect(page).toHaveURL(new RegExp(`/pescari/${TARGET}$`));
    await expect(byTestId(page, 'followers-count')).toContainText(String(target.counts.followers + 1));
    await expect(byTestId(page, 'follow-slot').getByRole('button')).toHaveText('Urmăresc');

    // Back on the list the row still says «Urmăresc».
    await page.goBack();
    await expect(rowOf(page, TARGET).getByRole('button')).toHaveText('Urmăresc');

    // The viewer's own profile: one more «urmărește».
    await page.goto(`/pescari/${selfId}`);
    await expect(byTestId(page, 'following-count')).toContainText(String(selfBefore + 1));
    expect(errors).toEqual([]);
  });

  test('c2: back returns to the page that opened it', async ({ page }) => {
    await page.goto(`/pescari/${ANDREW_R}`);
    await byTestId(page, 'followers-count').click();
    await expect(page).toHaveURL(new RegExp(`/pescari/${ANDREW_R}/conexiuni\\?tab=urmaritori$`));
    await expect(tab(page, 'Urmăritori')).toHaveAttribute('aria-selected', 'true');
    await page.getByRole('button', { name: 'Înapoi' }).click();
    await expect(page).toHaveURL(new RegExp(`/pescari/${ANDREW_R}$`));
  });

  test('c2: a direct visit (another site before it) — «Înapoi» lands on the profile, not off Bluvi', async ({ page }) => {
    await page.goto('about:blank');
    await page.goto(`/pescari/${ANDREW_R}/conexiuni`);
    await expect(rows(page).first()).toBeVisible();
    await page.getByRole('button', { name: 'Înapoi' }).click();
    await expect(page).toHaveURL(new RegExp(`/pescari/${ANDREW_R}$`));
    await expect(byTestId(page, 'profile-header')).toBeVisible();
  });

  test('header: the owner as an identity line (24px avatar, the name a link to the profile)', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(`/pescari/${ANDREW_R}/conexiuni`);
    const owner = page.getByTestId('connections-owner');
    await expect(owner).toHaveText('Andrew R');
    await expect(owner).toHaveAttribute('href', `/pescari/${ANDREW_R}`);
    await expect(owner).toHaveAttribute('title', 'Andrew R');
    const avatar = owner.locator('xpath=preceding-sibling::*[1]');
    expect(Math.round((await avatar.boundingBox())!.width)).toBe(24);
    await owner.click();
    await expect(page).toHaveURL(new RegExp(`/pescari/${ANDREW_R}$`));
  });

  for (const width of [375, 1280] as const) {
    test(`header @${width}: the owner line keeps its box while the profile loads — the tabs never move`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await mockAngler(page);
      let release!: () => void;
      const held = new Promise<void>(res => (release = res));
      await page.route(new RegExp(`/feed/anglers/${MOCK}(\\?.*)?$`), async r => {
        await held;
        await json(r, { data: header({ followers: 25, following: 0 }) });
      });
      await page.goto(`/pescari/${MOCK}/conexiuni`);
      await expect(rows(page).first()).toBeVisible(); // 1280 also auto-loads page 2
      const placeholder = byTestId(page, 'connections-owner-pending');
      await expect(placeholder).toBeVisible();
      const tabsBefore = (await page.getByRole('tablist').boundingBox())!.y;
      const rowBefore = (await rows(page).first().boundingBox())!.y;
      release();
      await expect(page.getByTestId('connections-owner')).toHaveText('Pescar Conexiuni');
      await expect(placeholder).toHaveCount(0);
      expect((await page.getByRole('tablist').boundingBox())!.y).toBe(tabsBefore);
      expect((await rows(page).first().boundingBox())!.y).toBe(rowBefore);
    });
  }

  test('profile 500: the band names the page «Conexiuni» (root «Acasă»), the rows still list, no owner line, no badges', async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    const errors = collectConsoleErrors(page, { ignore: EXPECTED_CONSOLE });
    await mockAngler(page);
    await page.route(new RegExp(`/feed/anglers/${MOCK}(\\?.*)?$`), r => json(r, { error: { status: 500, message: 'boom' } }, 500));
    await page.goto(`/pescari/${MOCK}/conexiuni`);
    const band = page.getByRole('navigation', { name: 'Cale de navigare' });
    // Pending: the same root as the named trail, «Conexiuni» already the current page.
    await expect(band.getByRole('link', { name: 'Acasă' })).toBeVisible();
    await expect(band.locator('[aria-current="page"]')).toHaveText('Conexiuni');
    await expect(rows(page).first()).toBeVisible(); // 1280 also auto-loads page 2
    // After core's retries and past the band's 3s naming deadline: still «Acasă / Conexiuni».
    await expect(byTestId(page, 'connections-owner-pending')).toHaveCount(0, { timeout: 30_000 });
    await page.waitForTimeout(3_500);
    await expect(band.locator('[aria-current="page"]')).toHaveText('Conexiuni');
    await expect(band).not.toContainText('Pescari');
    await expect(rows(page).first()).toBeVisible(); // 1280 also auto-loads page 2
    await expect(page.getByTestId('connections-owner')).toHaveCount(0);
    await expect(tab(page, 'Urmăritori')).toHaveText('Urmăritori');
    await expect(tab(page, 'Urmărește')).toHaveText('Urmărește');
    expect(errors).toEqual([]);
  });

  test('a follow pressed before the owner\'s profile answered: the owner line still arrives', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await mockAngler(page);
    // Every write is mocked: the rows are made-up anglers, nothing reaches the CMS.
    const posts: string[] = [];
    await page.route(/\/feed\/anglers\/e2econn\d+\/(follow|unfollow)$/, r => {
      posts.push(r.request().url());
      return json(r, { following: r.request().url().endsWith('/follow'), followersCount: 1 });
    });
    let release!: () => void;
    const held = new Promise<void>(res => (release = res));
    let headerRequests = 0;
    await page.route(new RegExp(`/feed/anglers/${MOCK}(\\?.*)?$`), async r => {
      headerRequests += 1;
      await held;
      await json(r, { data: header({ followers: 25, following: 0 }) }).catch(() => {});
    });
    await page.goto(`/pescari/${MOCK}/conexiuni`);
    const first = rowOf(page, row(1).documentId);
    const button = first.getByRole('button');
    await expect(button).toHaveText('Urmărește');
    const posted = page.waitForResponse(r => r.url().endsWith(`/feed/anglers/${row(1).documentId}/follow`));
    await button.click();
    await posted;
    await expect(button).toHaveText('Urmăresc');
    // The follow cancelled the in-flight owner profile; the page asked for it again.
    await expect.poll(() => headerRequests).toBeGreaterThanOrEqual(2);
    release();
    await expect(page.getByTestId('connections-owner')).toHaveText('Pescar Conexiuni');
    await expect(page.getByRole('tab', { name: 'Urmăritori, 25' })).toBeVisible();
    expect(posts).toHaveLength(1);
  });

  test('big counts: ro-RO grouping in the footer and the tab names, the capped badge carries the full figure', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await mockAngler(page, {
      counts: { followers: 1234, following: 0 },
      followers: r => json(r, { ...page1(), meta: { pagination: { page: 1, pageSize: 20, pageCount: 62, total: 1234 } } }),
    });
    await page.goto(`/pescari/${MOCK}/conexiuni`);
    await expect(page.getByText('20 din 1.234 de urmăritori')).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Urmăritori, 1.234' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Urmăritori, 1.234' }).getByText('99+')).toHaveAttribute('title', '1.234');
  });

  test('phone rows: the compact follow button leaves the name most of a 320 row; a cut name has its title', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    const long = 'Mihai_Crapologul_Extrem_De_Lung';
    await mockAngler(page, {
      followers: r => json(r, { ...page1(), data: [{ ...row(1), username: long }, ...page1().data.slice(1)] }),
    });
    await page.goto(`/pescari/${MOCK}/conexiuni`);
    const first = rows(page).first();
    const name = first.getByRole('link', { name: long });
    await expect(name).toHaveAttribute('title', long);
    const button = first.getByRole('button');
    // fish's row button (13pt, icon): one 124px width, not the profile's 144px+ — the name gets
    // ~86px of the 288px card instead of ~55px.
    const [nameBox, buttonBox] = await Promise.all([name.boundingBox(), button.boundingBox()]);
    expect(Math.round(buttonBox!.width)).toBe(124);
    expect(nameBox!.width).toBeGreaterThanOrEqual(80);
    expect(await button.evaluate(el => getComputedStyle(el).fontSize)).toBe('13px');
    // Both labels keep one width.
    const followRow = rows(page).nth(2); // row 3: already followed
    expect(Math.round((await followRow.getByRole('button').boundingBox())!.width)).toBe(Math.round(buttonBox!.width));
  });

  test('noindex', async ({ page }) => {
    await page.goto(`/pescari/${ANDREW_R}/conexiuni`);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  });

  for (const width of AXE_WIDTHS) {
    test(`axe @${width}: the list (phone list / ≥768 grid of row-cards)`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/pescari/${ANDREW_R}/conexiuni?tab=urmareste`);
      await expect(rows(page).first()).toBeVisible();
      // Layout: one column on a phone, several from 768 — never one stretched row.
      const tops = await rows(page).evaluateAll(els => els.slice(0, 3).map(e => Math.round(e.getBoundingClientRect().top)));
      if (width < 768) expect(new Set(tops).size).toBe(tops.length);
      else expect(tops[0]).toBe(tops[1]);
      await expectNoA11yViolations(page);
    });
  }
});
