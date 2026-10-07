import { expect, test, type Page, type Route } from '@playwright/test';
import { expectNoA11yViolations } from './helpers/a11y';
import { collectConsoleErrors } from './helpers/console';
import { CMS, qaJwt, signIn } from './helpers/session';

/*
 * account.suggested (/pescari/sugerati, T1) — fish app/(app)/anglers/suggested.tsx, plus
 * account.b.suggestion-dismissals (the session store shared with the Home rail) and
 * account.b.suggested-rail («Vezi toate» → this page).
 *
 * Data: the local QA user against the LOCAL CMS.
 *  - REAL: GET /feed/anglers/suggested-home (granted locally), one real follow of the first
 *    unfollowed suggestion — unfollowed again in afterEach and re-checked through the API.
 *  - MOCKED (browser route; the page reads through /api/cms in the browser): the states the local
 *    pool cannot show on demand — slow first page, failure, empty, a two-page pool with a repeat
 *    across pages, a 1.284-follower angler and a «Pescar nou».
 * Firestore is never touched by this page.
 */

const AXE_WIDTHS = [375, 1280, 1440, 1920] as const;
const SUGGESTED = /\/feed\/anglers\/suggested-home/;
/** The mocked 500 (error state) is logged by the browser. */
const EXPECTED_CONSOLE = [/Failed to load resource: the server responded with a status of 500/];

let jwt: string;
let followedId: string | null = null;
const auth = () => ({ authorization: `Bearer ${jwt}` });

test.beforeAll(async ({ request }) => {
  jwt = await qaJwt(request);
});

test.afterEach(async ({ request }) => {
  if (!followedId) return;
  const id = followedId;
  followedId = null;
  const now = await request.get(`${CMS}/feed/anglers/${id}`, { headers: auth() });
  if ((await now.json()).data?.isFollowedByMe) await request.post(`${CMS}/feed/anglers/${id}/unfollow`, { headers: auth() });
  const after = await request.get(`${CMS}/feed/anglers/${id}`, { headers: auth() });
  expect((await after.json()).data.isFollowedByMe, 'follow undone').toBe(false);
});

/* ------------------------------------------------------------------------------------------------
 * Mocks
 * ---------------------------------------------------------------------------------------------- */

type Stats = { competitions: number; podiums: number; sessions: number; catches: number; recordKg: number | null; followers: number };
const zero: Stats = { competitions: 0, podiums: 0, sessions: 0, catches: 0, recordKg: null, followers: 0 };
const angler = (n: number, stats: Partial<Stats> = {}, username = `Pescar Sugerat ${n}`) => ({
  documentId: `e2esugg${String(n).padStart(17, '0')}`,
  username,
  avatarUrl: null,
  isFollowedByMe: false,
  stats: { ...zero, competitions: 2, ...stats },
});
const idOf = (n: number) => angler(n).documentId;

/** Page 1: the card-content cases first, then plain anglers. */
const PAGE1 = [
  angler(1, { podiums: 3, competitions: 12, recordKg: 8.4, sessions: 5, followers: 1284 }, 'Pescar Cu Podiumuri'),
  angler(2, { competitions: 1, podiums: 1, followers: 1 }, 'Pescar Un Podium'),
  angler(3, { competitions: 0, recordKg: 5.068, sessions: 1 }, 'Pescar Record'),
  angler(4, { competitions: 0 }, 'Pescar Fără Statistici'),
  // A long Romanian name (the local seed has «Valentin Dumitrescu», «Cristian Dumitrescu»).
  angler(5, {}, 'Valentin Dumitrescu'),
  ...[6, 7, 8, 9, 10].map((n) => angler(n)),
];
/** Page 2 repeats angler 10 (the server rotates the pool per fetch): shown once (c10). */
const PAGE2 = [10, 11, 12, 13].map((n) => angler(n));
const meta = (page: number, pageCount: number, total: number) => ({ pagination: { page, pageSize: 10, pageCount, total } });

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

/** Mocks suggested-home; returns the URLs requested. `page2Gate` holds page 2 until resolved. */
async function mockPool(page: Page, opts: { page1?: (r: Route) => Promise<void> | void; page2Gate?: Promise<void> } = {}) {
  const seen: string[] = [];
  await page.route(SUGGESTED, async (r) => {
    seen.push(r.request().url());
    const p = Number(new URL(r.request().url()).searchParams.get('page') ?? 1);
    if (p === 1) return opts.page1 ? opts.page1(r) : json(r, { data: PAGE1, meta: meta(1, 2, 14) });
    await opts.page2Gate;
    return json(r, { data: PAGE2, meta: meta(2, 2, 14) });
  });
  return seen;
}

/** The `bluvi:analytics` events the page dispatches (lib/analytics.ts). */
async function collectAnalytics(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __events: { name: string; params: Record<string, unknown> }[] };
    w.__events = [];
    window.addEventListener('bluvi:analytics', (e) => w.__events.push((e as CustomEvent).detail));
  });
  return () => page.evaluate(() => (window as unknown as { __events: { name: string; params: Record<string, unknown> }[] }).__events);
}

/* Visible-only: Next keeps a previous route mounted but hidden (<Activity>) after a client navigation. */
const cards = (page: Page) => page.locator('[data-testid="suggested-card"]:visible');
const cardOf = (page: Page, id: string) => page.locator(`[data-testid="suggested-card"][data-id="${id}"]:visible`);
const heading = (page: Page) => page.getByRole('heading', { level: 1, name: 'Sugestii pentru tine' });

/* ------------------------------------------------------------------------------------------------
 * c1 — signed out
 * ---------------------------------------------------------------------------------------------- */

test.describe('signed out', () => {
  test('c1: no cookie → a real 307 to /intra with this page as the way back', async ({ request }) => {
    const res = await request.get('/pescari/sugerati', { maxRedirects: 0 });
    expect(res.status()).toBe(307);
    expect(res.headers().location).toContain(`/intra?next=${encodeURIComponent('/pescari/sugerati')}`);
  });

  test('c1: a dead session cookie → sign-in (requireViewer)', async ({ page }) => {
    await signIn(page.context(), 'e2e-dead-session-token');
    await page.goto('/pescari/sugerati');
    await expect(page).toHaveURL(new RegExp(`/intra\\?next=${encodeURIComponent('/pescari/sugerati')}$`));
  });
});

/* ------------------------------------------------------------------------------------------------
 * Signed in
 * ---------------------------------------------------------------------------------------------- */

test.describe('signed in', () => {
  test.beforeEach(async ({ page }) => signIn(page.context(), jwt));

  test('static segment, c2 c3 c8: the page (not an angler «sugerati»), header without search, card skeletons, one pageSize-10 request, no refetch on focus', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const errors = collectConsoleErrors(page);
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const anglerReads: string[] = [];
    page.on('request', (r) => {
      if (/\/feed\/anglers\/sugerati/.test(r.url())) anglerReads.push(r.url());
    });
    // Page 2 held: the footer may auto-load it as soon as it nears the viewport (c10's own test).
    const seen = await mockPool(page, {
      page1: async (r) => {
        await gate;
        return json(r, { data: PAGE1, meta: meta(1, 2, 14) });
      },
      page2Gate: new Promise(() => {}),
    });
    await page.goto('/pescari/sugerati');
    await expect(heading(page)).toBeVisible();
    // c8: card skeletons (8 on a phone) in the grid while the first page loads, announced once.
    const skeleton = page.locator('[data-testid="suggested-skeleton"]:visible');
    await expect(skeleton).toHaveCount(1);
    await expect(skeleton.locator('li:visible')).toHaveCount(8);
    await expect(page.getByRole('status').filter({ hasText: 'Se încarcă sugestiile…' })).toBeAttached();
    release();
    await expect(cards(page)).toHaveCount(10);
    await expect(page.locator('[data-testid="suggested-skeleton"]:visible')).toHaveCount(0);

    // Static «sugerati» wins over /pescari/[id]: never read as an angler id.
    expect(anglerReads).toEqual([]);
    // c2: back control + h1; «Caută pescari» hidden until the /pescari search ships (M4, rule 4).
    await expect(page.getByRole('button', { name: 'Înapoi' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Caută pescari' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Caută pescari' })).toHaveCount(0);

    // c3: GET /feed/anglers/suggested-home?page=1&pageSize=10, once (later pages are the footer's).
    const firstPages = () => seen.filter((s) => new URL(s).searchParams.get('page') === '1');
    expect(firstPages()).toHaveLength(1);
    const u = new URL(firstPages()[0]);
    expect(u.searchParams.get('page')).toBe('1');
    expect(u.searchParams.get('pageSize')).toBe('10');
    // No refetch on focus / visibility (the web's global focus refetch is overridden).
    await page.evaluate(() => {
      window.dispatchEvent(new Event('focus'));
      document.dispatchEvent(new Event('visibilitychange'));
      window.dispatchEvent(new Event('online'));
    });
    await page.waitForTimeout(1_500);
    expect(firstPages()).toHaveLength(1);
    expect(errors).toEqual([]);
  });

  test('c4 c5: two per row on a phone, more from 768; card content (avatar 64, followers, stats, «Pescar nou», follow button)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await mockPool(page, { page2Gate: new Promise(() => {}) });
    await page.goto('/pescari/sugerati');
    await expect(cards(page)).toHaveCount(10);

    const tops = async () =>
      cards(page).evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
    const perRow = (ts: number[]) => ts.filter((t) => t === ts[0]).length;
    expect(perRow(await tops())).toBe(2);

    // c5 — 1.284 followers, podiums first then concursuri (plural), CMMC skipped as the third.
    const a = cardOf(page, idOf(1));
    await expect(a.getByRole('heading', { level: 2 })).toHaveText('Pescar Cu Podiumuri');
    await expect(a.getByTestId('suggested-followers')).toHaveText('1.284 urmăritori');
    await expect(a.getByTestId('suggested-stats')).toHaveText(/^3\s*podiumuri\s*12\s*concursuri$/);
    const avatar = await a.locator('[data-testid="suggested-stats"]').evaluate((el) => {
      const img = el.parentElement!.children[1] as HTMLElement;
      return Math.round(img.getBoundingClientRect().width);
    });
    expect(avatar).toBe(64);
    // Singulars.
    const b = cardOf(page, idOf(2));
    await expect(b.getByTestId('suggested-followers')).toHaveText('1 urmăritor');
    await expect(b.getByTestId('suggested-stats')).toHaveText(/^1\s*podium\s*1\s*concurs$/);
    // CMMC with its unit apart (rule 10), then partidă (singular); zero competitions skipped.
    const c = cardOf(page, idOf(3));
    await expect(c.getByTestId('suggested-followers')).toHaveText('fără urmăritori');
    await expect(c.getByTestId('suggested-stats')).toHaveText(/^5,1\s*kg\s*CMMC\s*1\s*partidă$/);
    // «Pescar nou».
    await expect(cardOf(page, idOf(4)).getByTestId('suggested-stats')).toHaveText('Pescar nou');
    // The username stays on one line.
    const nameBox = await cardOf(page, idOf(4)).getByRole('heading', { level: 2 }).evaluate((el) => getComputedStyle(el).whiteSpace);
    expect(nameBox).toBe('nowrap');
    // Full-width follow button.
    const widths = await a.evaluate((el) => {
      const btn = el.querySelector('button[aria-pressed]') as HTMLElement;
      const pad = parseFloat(getComputedStyle(el).paddingLeft) + parseFloat(getComputedStyle(el).paddingRight);
      return [Math.round(btn.getBoundingClientRect().width), Math.round(el.getBoundingClientRect().width - pad)];
    });
    expect(widths[0]).toBe(widths[1]);
    await expect(a.getByRole('button', { name: 'Urmărește pe Pescar Cu Podiumuri' })).toHaveText('Urmărește');

    // fish FollowButton size="small": 32px, no shadow; the dismiss X is a 14px glyph in a 40px target.
    const look = await a.evaluate((el) => {
      const btn = el.querySelector('button[aria-pressed]') as HTMLElement;
      const x = el.querySelector('button[data-dismiss]') as HTMLElement;
      return {
        button: Math.round(btn.getBoundingClientRect().height),
        shadow: getComputedStyle(btn).boxShadow,
        target: Math.round(x.getBoundingClientRect().width),
        glyph: Math.round(x.querySelector('svg')!.getBoundingClientRect().width),
      };
    });
    expect(look).toEqual({ button: 32, shadow: 'none', target: 40, glyph: 14 });

    for (const width of [768, 1280, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      const n = perRow(await tops());
      expect(n, `cards per row at ${width}`).toBeGreaterThanOrEqual(width >= 1280 ? 6 : 4);
    }
    // A long Romanian name is not cut at the main desktop width (176px column floor).
    await page.setViewportSize({ width: 1280, height: 900 });
    const cut = await cardOf(page, idOf(5)).getByTestId('suggested-name').evaluate((el) => {
      const h = el.parentElement as HTMLElement;
      return h.scrollWidth > h.clientWidth;
    });
    expect(cut, '«Valentin Dumitrescu» fits at 1280').toBe(false);
  });

  test('c6: activating the card outside its buttons opens /pescari/{id}', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await mockPool(page, { page2Gate: new Promise(() => {}) });
    await page.goto('/pescari/sugerati');
    const card = cardOf(page, idOf(1));
    await expect(card.getByRole('link')).toHaveAttribute('href', `/pescari/${idOf(1)}`);
    // A point on the card away from its name and buttons (beside the avatar): the stretched link
    // catches it.
    await card.click({ position: { x: 12, y: 80 } });
    await expect(page).toHaveURL(new RegExp(`/pescari/${idOf(1)}$`));
  });

  test('c9: a failed request reads «Nu am putut încărca sugestiile.» (no retry); an empty pool «Nu avem sugestii momentan.»', async ({ page }) => {
    const errors = collectConsoleErrors(page, { ignore: EXPECTED_CONSOLE });
    const seen = await mockPool(page, { page1: (r) => json(r, { error: { status: 500 } }, 500) });
    await page.goto('/pescari/sugerati');
    await expect(page.getByText('Nu am putut încărca sugestiile.')).toBeVisible();
    await page.waitForTimeout(1_000);
    expect(seen, 'retry: false').toHaveLength(1);
    await expect(cards(page)).toHaveCount(0);

    await page.unroute(SUGGESTED);
    await mockPool(page, { page1: (r) => json(r, { data: [], meta: meta(1, 0, 0) }) });
    await page.goto('/pescari/sugerati');
    await expect(page.getByText('Nu avem sugestii momentan.')).toBeVisible();
    await expect(page.getByText('Nu am putut încărca sugestiile.')).toHaveCount(0);
    await expectNoA11yViolations(page);
    expect(errors).toEqual([]);
  });

  test('c10: the next page loads near the end with a spinner; a card repeated across pages is shown once', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const seen = await mockPool(page, { page2Gate: gate });
    await page.goto('/pescari/sugerati');
    await expect(cards(page)).toHaveCount(10);
    const more = page.getByRole('button', { name: /^(Mai multe|Se încarcă…)$/ });
    await more.scrollIntoViewIfNeeded();
    await expect(page.getByTestId('list-footer-spinner')).toBeVisible();
    await expect(more).toHaveText('Se încarcă…');
    release();
    await expect(cards(page)).toHaveCount(13); // 10 + 4 − the repeat
    await expect(cardOf(page, idOf(10))).toHaveCount(1);
    expect(seen.map((s) => new URL(s).searchParams.get('page'))).toEqual(['1', '2']);
    // The last page: no footer button left.
    await expect(page.getByRole('button', { name: 'Mai multe' })).toHaveCount(0);
  });

  test('c10: the «Mai multe» button loads the next page (keyboard path)', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    // At 1920 the footer is in auto-load range at once: hold page 2, then check the button's states.
    await mockPool(page, { page2Gate: gate });
    await page.goto('/pescari/sugerati');
    await expect(cards(page)).toHaveCount(10);
    await expect(page.getByRole('button', { name: 'Se încarcă…' })).toBeVisible();
    release();
    await expect(cards(page)).toHaveCount(13);
  });

  test('c7 c12: dismiss removes the card, keeps focus, announces, and logs suggested_angler_dismiss (see_all)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const events = await collectAnalytics(page);
    await mockPool(page, { page2Gate: new Promise(() => {}) });
    await page.goto('/pescari/sugerati');
    await expect(cards(page)).toHaveCount(10);
    const dismiss = cardOf(page, idOf(2)).getByRole('button', { name: 'Ascunde sugestia: Pescar Un Podium' });
    await dismiss.focus();
    await page.keyboard.press('Enter');
    await expect(cardOf(page, idOf(2))).toHaveCount(0);
    await expect(cards(page)).toHaveCount(9);
    // Focus moved to the next card's «Ascunde sugestia».
    await expect(cardOf(page, idOf(3)).getByRole('button', { name: /^Ascunde sugestia: / })).toBeFocused();
    await expect(page.getByRole('status').filter({ hasText: 'Sugestie ascunsă.' })).toBeAttached();
    expect((await events()).filter((e) => e.name === 'suggested_angler_dismiss')).toEqual([
      { name: 'suggested_angler_dismiss', params: { source: 'see_all' } },
    ]);
    // In memory only: a reload brings it back (fish: it may reappear on the next load).
    await page.reload();
    await expect(cardOf(page, idOf(2))).toHaveCount(1);
  });

  test('account.b.suggested-rail + account.b.suggestion-dismissals: «Vezi toate» opens this page; dismissals are shared both ways for the session', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    const rail = page.locator('section:visible').filter({ has: page.getByRole('heading', { name: 'Pescari pe care îi poți urmări' }) });
    if ((await rail.count()) === 0) test.skip(true, 'fewer than 3 suggestions locally');
    const seeAll = rail.getByRole('link', { name: /^Vezi toate: / });
    await expect(seeAll).toHaveAttribute('href', '/pescari/sugerati');
    const railCards = rail.getByRole('article');
    expect(await railCards.count()).toBeGreaterThanOrEqual(4);
    const hrefOf = async (i: number) => (await railCards.nth(i).getByRole('link').first().getAttribute('href'))!;
    const a = (await hrefOf(0)).split('/').pop()!;
    const b = (await hrefOf(1)).split('/').pop()!;

    // Rail → page: A dismissed on Home is gone from the grid.
    await railCards.first().getByRole('button', { name: /^Ascunde sugestia: / }).click();
    await expect(rail.locator(`a[href="/pescari/${a}"]`)).toHaveCount(0);
    await seeAll.click();
    await expect(page).toHaveURL(/\/pescari\/sugerati$/);
    await expect(heading(page)).toBeVisible();
    await expect(cards(page).first()).toBeVisible();
    await expect(cardOf(page, a)).toHaveCount(0);
    await expect(cardOf(page, b)).toHaveCount(1);

    // Page → rail: B dismissed here is gone from the Home rail.
    await cardOf(page, b).getByRole('button', { name: /^Ascunde sugestia: / }).click();
    await expect(cardOf(page, b)).toHaveCount(0);
    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
    const railAgain = page.locator('section:visible').filter({ has: page.getByRole('heading', { name: 'Pescari pe care îi poți urmări' }) });
    if (await railAgain.count()) {
      await expect(railAgain.locator(`a[href="/pescari/${b}"]`)).toHaveCount(0);
      await expect(railAgain.locator(`a[href="/pescari/${a}"]`)).toHaveCount(0);
    }
  });

  test('c11 c12: following keeps the card with «Urmăresc», no refetch of the pool; follow logged (see_all), unfollow not', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const events = await collectAnalytics(page);
    const reads: string[] = [];
    page.on('request', (r) => {
      // Page 1 only: the footer may auto-load later pages; a refetch would ask page 1 again.
      if (SUGGESTED.test(r.url()) && r.method() === 'GET' && new URL(r.url()).searchParams.get('page') === '1') reads.push(r.url());
    });
    await page.goto('/pescari/sugerati');
    await expect(cards(page).first()).toBeVisible();
    const target = cards(page).filter({ has: page.getByRole('button', { name: /^Urmărește pe / }) }).first();
    const id = (await target.getAttribute('data-id'))!;
    const before = reads.length;
    followedId = id;
    const card = cardOf(page, id);
    await card.getByRole('button', { name: /^Urmărește pe / }).click();
    const following = card.getByRole('button', { name: /^Nu mai urmări pe / });
    await expect(following).toHaveText('Urmăresc');
    await expect(following).toHaveAttribute('aria-pressed', 'true');
    await expect(page).toHaveURL(/\/pescari\/sugerati$/);
    // Server side really followed.
    await expect
      .poll(async () => (await (await page.request.get(`${CMS}/feed/anglers/${id}`, { headers: auth() })).json()).data.isFollowedByMe)
      .toBe(true);
    await page.waitForTimeout(1_000);
    expect(reads.length, 'the pool is only marked stale').toBe(before);
    await expect(cardOf(page, id)).toHaveCount(1);
    expect((await events()).filter((e) => e.name === 'suggested_angler_follow')).toEqual([
      { name: 'suggested_angler_follow', params: { source: 'see_all' } },
    ]);
    // Unfollow: no second event.
    await following.click();
    await expect(card.getByRole('button', { name: /^Urmărește pe / })).toBeVisible();
    expect((await events()).filter((e) => e.name === 'suggested_angler_follow')).toHaveLength(1);
  });

  test('c13: leaving for Home and coming back through «Vezi toate» keeps the same cards, pages and follow, with no new suggested-home request', async ({ page }) => {
    // fish useSuggestedAnglersHome.ts:16-20: one read per launch, whatever screen asks. The Home
    // server render prefetches a fresh (server-rotated) page 1 on every visit; it must never replace
    // the pool this tab already holds.
    await page.setViewportSize({ width: 1280, height: 900 });
    // The browser's clock an hour behind the server's: the Home render's server read is then always
    // NEWER than the tab's (its stamp is cached for minutes, hydration.tsx hydrationTime, so with
    // real clocks it is only sometimes newer) — the case where a plain HydrationBoundary overwrote
    // the tab's pool.
    await page.clock.install({ time: Date.now() - 60 * 60_000 });
    const reads: string[] = [];
    page.on('request', (r) => {
      if (SUGGESTED.test(r.url()) && r.method() === 'GET') reads.push(r.url());
    });
    await page.goto('/pescari/sugerati');
    await expect(cards(page).first()).toBeVisible();
    // Let the footer auto-load whatever is in range, then freeze the picture.
    await page.waitForTimeout(1_500);
    const ids = () => cards(page).evaluateAll((els) => els.map((e) => e.getAttribute('data-id')));
    const target = cards(page).filter({ has: page.getByRole('button', { name: /^Urmărește pe / }) }).first();
    if ((await target.count()) === 0) test.skip(true, 'no unfollowed suggestion locally');
    const id = (await target.getAttribute('data-id'))!;
    followedId = id;
    await cardOf(page, id).getByRole('button', { name: /^Urmărește pe / }).click();
    await expect(cardOf(page, id).getByRole('button', { name: /^Nu mai urmări pe / })).toHaveAttribute('aria-pressed', 'true');
    await expect
      .poll(async () => (await (await page.request.get(`${CMS}/feed/anglers/${id}`, { headers: auth() })).json()).data.isFollowedByMe)
      .toBe(true);
    const before = await ids();
    const readsBefore = reads.length;

    // A client navigation to Home (the breadcrumb's «Acasă»), then the rail's «Vezi toate».
    await page.locator('a[href="/"]:visible').first().click();
    await expect(page).toHaveURL(/\/$/);
    const rail = page.locator('section:visible').filter({ has: page.getByRole('heading', { name: 'Pescari pe care îi poți urmări' }) });
    await expect(rail).toHaveCount(1);
    // The rail draws the same card as the page (fish's one SuggestedAnglerCard).
    await expect(rail.locator('[data-testid="suggested-card"]').first()).toBeVisible();
    await rail.getByRole('link', { name: /^Vezi toate: / }).first().click();
    await expect(page).toHaveURL(/\/pescari\/sugerati$/);
    await expect(heading(page)).toBeVisible();
    await expect(cards(page).first()).toBeVisible();

    // The footer may go on to the NEXT page (infinite scroll), never back to one already loaded.
    expect((await ids()).slice(0, before.length), 'same cards, same order, every loaded page kept').toEqual(before);
    await expect(cardOf(page, id).getByRole('button', { name: /^Nu mai urmări pe / })).toHaveText('Urmăresc');
    const pageOf = (u: string) => Number(new URL(u).searchParams.get('page'));
    const loaded = Math.max(...reads.slice(0, readsBefore).map(pageOf));
    expect(
      reads.slice(readsBefore).filter((u) => pageOf(u) <= loaded),
      'no suggested-home page read again (no reseeded page 1)',
    ).toEqual([]);
  });

  test('axe at 375 / 1280 / 1440 / 1920 (grid)', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await mockPool(page, { page2Gate: new Promise(() => {}) });
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/pescari/sugerati');
    await expect(cards(page)).toHaveCount(10);
    for (const width of AXE_WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      await expectNoA11yViolations(page);
    }
    expect(errors).toEqual([]);
  });
});
