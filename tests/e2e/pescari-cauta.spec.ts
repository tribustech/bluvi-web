import { expect, test, type Page, type Route } from '@playwright/test';
import { expectNoA11yViolations } from './helpers/a11y';
import { collectConsoleErrors } from './helpers/console';
import { CMS, qaJwt, signIn } from './helpers/session';

/*
 * partide.pescari (/pescari, T1) — fish app/(app)/partide/pescari.tsx, ConnectionRow.tsx,
 * useAnglerDiscovery.ts.
 *
 * Data: the local QA user against the LOCAL CMS.
 *  - REAL: GET /feed/anglers/search (the keyboard path, the «Dumitrescu» anglers of the local seed),
 *    the QA user's own profile (the «own row» and the /pescari/[id] check).
 *  - MOCKED (browser route; the page reads through /api/cms): /feed/anglers/search and /suggested
 *    for the request-count, empty, no-results, paging and self-row states.
 * No follow is pressed here (the row's FollowButton is the kit's, covered by account specs); nothing
 * is written anywhere. Firestore is never touched by this page.
 */

const SEARCH = /\/api\/cms\/feed\/anglers\/search/;
const SUGGESTED = /\/api\/cms\/feed\/anglers\/suggested(\?|$)/;
const AXE_WIDTHS = [375, 1280, 1440, 1920] as const;

let jwt: string;
let self: { documentId: string; username: string };

test.beforeAll(async ({ request }) => {
  jwt = await qaJwt(request);
  const me = await request.get(`${CMS}/user/profile`, { headers: { authorization: `Bearer ${jwt}` } });
  expect(me.ok(), 'QA profile read').toBe(true);
  const body = await me.json();
  self = { documentId: body.documentId, username: body.username };
});

const angler = (n: number, extra: Record<string, unknown> = {}) => ({
  documentId: `e2epesc${String(n).padStart(17, '0')}`,
  username: `Pescar Căutat ${n}`,
  avatarUrl: null,
  isFollowedByMe: false,
  subline: `${n} urmăritori`,
  ...extra,
});
const idOf = (n: number) => angler(n).documentId;
const page_ = (data: unknown[], page: number, pageCount: number, total: number) => ({
  data,
  meta: { pagination: { page, pageSize: 20, pageCount, total } },
});
const EMPTY_PAGE = page_([], 1, 0, 0);
const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

async function mockSuggested(page: Page, body: unknown | ((r: Route) => Promise<void> | void)) {
  const seen: string[] = [];
  await page.route(SUGGESTED, (r) => {
    seen.push(r.request().url());
    return typeof body === 'function' ? (body as (r: Route) => void)(r) : json(r, { data: body });
  });
  return seen;
}
async function mockSearch(page: Page, handler: (r: Route, q: string, p: number) => Promise<void> | void) {
  const seen: string[] = [];
  await page.route(SEARCH, (r) => {
    const u = new URL(r.request().url());
    seen.push(u.searchParams.get('q') ?? '');
    return handler(r, u.searchParams.get('q') ?? '', Number(u.searchParams.get('page') ?? 1));
  });
  return seen;
}

/* Visible-only: Next keeps a previous route mounted but hidden (<Activity>) after a client navigation. */
const rows = (page: Page) => page.locator('[data-testid="angler-row"]:visible');
const rowOf = (page: Page, id: string) => page.locator(`[data-testid="angler-row"][data-id="${id}"]:visible`);
const heading = (page: Page) => page.getByRole('heading', { level: 1, name: 'Pescari' });
const field = (page: Page) => page.getByRole('searchbox', { name: 'Caută pescari' });

/* ------------------------------------------------------------------------------------------------
 * c1 — signed out
 * ---------------------------------------------------------------------------------------------- */

test.describe('signed out', () => {
  test('c1: no cookie → a real 307 to /intra with this page (and its term) as the way back', async ({ request }) => {
    const res = await request.get('/pescari', { maxRedirects: 0 });
    expect(res.status()).toBe(307);
    expect(res.headers().location).toContain(`/intra?next=${encodeURIComponent('/pescari')}`);
    const withQ = await request.get('/pescari?q=Dum', { maxRedirects: 0 });
    expect(withQ.status()).toBe(307);
    expect(withQ.headers().location).toContain(`/intra?next=${encodeURIComponent('/pescari?q=Dum')}`);
  });

  test('c1: a dead session cookie → sign-in (requireViewer)', async ({ page }) => {
    await signIn(page.context(), 'e2e-dead-session-token');
    await page.goto('/pescari');
    await expect(page).toHaveURL(new RegExp(`/intra\\?next=${encodeURIComponent('/pescari')}$`));
  });
});

/* ------------------------------------------------------------------------------------------------
 * Signed in
 * ---------------------------------------------------------------------------------------------- */

test.describe('signed in', () => {
  test.beforeEach(async ({ page }) => signIn(page.context(), jwt));

  test('the static /pescari index does not shadow /pescari/[id] or /pescari/sugerati', async ({ page }) => {
    await page.goto(`/pescari/${self.documentId}`);
    await expect(page.getByRole('heading', { level: 1, name: self.username })).toBeVisible();
    await page.goto('/pescari/sugerati');
    await expect(page.getByRole('heading', { level: 1, name: 'Sugestii pentru tine' })).toBeVisible();
    await page.goto('/pescari');
    await expect(heading(page)).toBeVisible();
  });

  test('c2 c5: header, «Caută pescari» field, «Activi recent» over 7 skeleton entries while the first page loads; noindex', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    await mockSuggested(page, async (r: Route) => {
      await gate;
      return json(r, { data: { friendsOfFollows: [], recentlyActive: page_([angler(1)], 1, 1, 1) } });
    });
    await page.goto('/pescari');
    await expect(heading(page)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Înapoi' })).toBeVisible();
    await expect(field(page)).toBeVisible();
    await expect(field(page)).toHaveAttribute('placeholder', 'Caută pescari');
    const skeleton = page.locator('[data-testid="anglers-skeleton"]:visible');
    await expect(skeleton).toHaveCount(1);
    await expect(skeleton.locator('li:visible')).toHaveCount(7);
    // fish's ListHeader draws «Activi recent» over the skeleton: the heading never pops in.
    await expect(page.getByRole('heading', { level: 2, name: 'Activi recent' })).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    release();
    await expect(rows(page)).toHaveCount(1);
    await expect(skeleton).toHaveCount(0);
  });

  test('c2: debounced 300 ms, from 2 characters, one request per settled term; the term in the URL survives a reload', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await mockSuggested(page, { friendsOfFollows: [], recentlyActive: page_([angler(50)], 1, 1, 1) });
    const seen = await mockSearch(page, (r, q) => json(r, page_([angler(1, { username: `Rezultat ${q}` })], 1, 1, 1)));
    await page.goto('/pescari');
    await expect(rows(page)).toHaveCount(1);

    // One character: no search, browse mode stays.
    await field(page).pressSequentially('D');
    await page.waitForTimeout(700);
    expect(seen).toEqual([]);
    await expect(page.getByRole('heading', { level: 2, name: 'Activi recent' })).toBeVisible();

    // Typing on at 60 ms a key: a single request, for the settled term.
    await field(page).pressSequentially('umitr', { delay: 60 });
    await expect(page.getByRole('heading', { level: 2, name: /^Rezultate/ })).toBeVisible();
    await expect(rowOf(page, idOf(1))).toContainText('Rezultat Dumitr');
    await page.waitForTimeout(600);
    expect(seen).toEqual(['Dumitr']);
    await expect(page).toHaveURL(/\/pescari\?q=Dumitr$/);

    // Reload: the field and the results come back from ?q=.
    await page.reload();
    await expect(field(page)).toHaveValue('Dumitr');
    await expect(rowOf(page, idOf(1))).toContainText('Rezultat Dumitr');

    // Escape clears (focus stays in the field), back to browse; the URL is clean again.
    await field(page).focus();
    await page.keyboard.press('Escape');
    await expect(field(page)).toHaveValue('');
    await expect(field(page)).toBeFocused();
    await expect(page.getByRole('heading', { level: 2, name: 'Activi recent' })).toBeVisible();
    await expect(page).toHaveURL(/\/pescari$/);
  });

  test('c3 c5: «Urmăriți de prietenii tăi» above «Activi recent» (no one twice); own row marked «Tu» without follow; rows open /pescari/[id]', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const errors = collectConsoleErrors(page);
    await mockSuggested(page, {
      friendsOfFollows: [angler(1, { subline: 'Urmărit de Andrei' }), angler(2, { subline: 'Urmărit de Ioana și încă 2' })],
      recentlyActive: page_(
        [angler(2), angler(3), { documentId: self.documentId, username: self.username, avatarUrl: null, isFollowedByMe: false, subline: 'Partidă acum 2 zile' }, angler(3)],
        1,
        1,
        4,
      ),
    });
    await page.goto('/pescari');
    const fof = page.getByTestId('fof-section');
    const recent = page.getByTestId('recent-section');
    await expect(fof.getByRole('heading', { level: 2, name: 'Urmăriți de prietenii tăi' })).toBeVisible();
    await expect(recent.getByRole('heading', { level: 2, name: 'Activi recent' })).toBeVisible();
    // Order: the FoF section comes first.
    const [fofBox, recentBox] = [await fof.boundingBox(), await recent.boundingBox()];
    expect(fofBox!.y).toBeLessThan(recentBox!.y);
    await expect(fof.locator('[data-testid="angler-row"]')).toHaveCount(2);
    // Angler 2 is in FoF, so not in «Activi recent»; angler 3 repeated once.
    await expect(recent.locator('[data-testid="angler-row"]')).toHaveCount(2);
    await expect(recent.locator(`[data-id="${idOf(2)}"]`)).toHaveCount(0);
    // Subline verbatim.
    await expect(rowOf(page, idOf(2))).toContainText('Urmărit de Ioana și încă 2');
    // Own row: «Tu», no follow; others have the follow button.
    const own = rowOf(page, self.documentId);
    await expect(own).toContainText('Tu');
    await expect(own.getByRole('button')).toHaveCount(0);
    await expect(rowOf(page, idOf(1)).getByRole('button', { name: `Urmărește pe ${angler(1).username}` })).toBeVisible();
    // Row link → the angler profile.
    await expect(rowOf(page, idOf(1)).getByRole('link', { name: angler(1).username })).toHaveAttribute('href', `/pescari/${idOf(1)}`);
    await rowOf(page, self.documentId).getByRole('link').click();
    await expect(page).toHaveURL(new RegExp(`/pescari/${self.documentId}$`));
    expect(errors).toEqual([]);
  });

  test('c3 c5: nobody recently active → «Niciun pescar găsit.»', async ({ page }) => {
    await mockSuggested(page, { friendsOfFollows: [], recentlyActive: EMPTY_PAGE });
    await page.goto('/pescari');
    await expect(page.getByText('Niciun pescar găsit.')).toBeVisible();
    await expect(page.getByTestId('fof-section')).toHaveCount(0);
  });

  test('c4 c5: «Rezultate {total}», deduplicated, infinite scroll; no results → «Niciun pescar găsit.»', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await mockSuggested(page, { friendsOfFollows: [], recentlyActive: EMPTY_PAGE });
    await mockSearch(page, (r, q, p) => {
      if (q === 'Nimeni') return json(r, EMPTY_PAGE);
      if (p === 1) return json(r, page_(Array.from({ length: 20 }, (_, i) => angler(i + 1)), 1, 2, 23));
      // Page 2 repeats angler 20 (the list moved between the two reads): shown once.
      return json(r, page_([angler(20), angler(21), angler(22), angler(23)], 2, 2, 23));
    });
    await page.goto('/pescari?q=Pescar');
    await expect(field(page)).toHaveValue('Pescar');
    await expect(page.getByRole('heading', { level: 2, name: 'Rezultate 23' })).toBeVisible();
    await expect(page.getByTestId('results-total')).toHaveText('23');
    await expect(rows(page)).toHaveCount(20);
    await expect(page.getByText('20 din 23 de pescari')).toBeVisible();
    // Infinite scroll: reaching the end loads page 2.
    await page.mouse.wheel(0, 20_000);
    await expect(rows(page)).toHaveCount(23);
    await expect(rowOf(page, idOf(20))).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Mai mulți pescari' })).toHaveCount(0);

    await field(page).fill('Nimeni');
    await expect(page.getByText('Niciun pescar găsit.')).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Rezultate 0' })).toBeVisible();
  });

  test('c4: a failed search shows the error card; «Încearcă din nou» searches again', async ({ page }) => {
    await mockSuggested(page, { friendsOfFollows: [], recentlyActive: EMPTY_PAGE });
    let fail = true;
    await mockSearch(page, (r) => (fail ? json(r, { error: { status: 500 } }, 500) : json(r, page_([angler(1)], 1, 1, 1))));
    await page.goto('/pescari?q=Eroare');
    await expect(page.getByText('Nu am putut căuta pescarii.')).toBeVisible({ timeout: 30_000 });
    fail = false;
    await page.getByRole('button', { name: 'Încearcă din nou' }).click();
    await expect(rows(page)).toHaveCount(1);
  });

  test('keyboard: type a name, Tab to the first result, Enter opens the profile; back keeps the term (real local search)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/pescari');
    await expect(heading(page)).toBeVisible();
    await field(page).focus();
    await page.keyboard.type('Dumitrescu');
    await expect(page.getByRole('heading', { level: 2, name: /^Rezultate \d+/ })).toBeVisible({ timeout: 15_000 });
    // Field → ✕ (clear) → the first result's link.
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Șterge căutarea' })).toBeFocused();
    await page.keyboard.press('Tab');
    const first = rows(page).first().getByRole('link');
    await expect(first).toBeFocused();
    const href = await first.getAttribute('href');
    expect(href).toMatch(/^\/pescari\/[^/?]+$/);
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(new RegExp(`${href}$`));
    await page.goBack();
    await expect(page).toHaveURL(/\/pescari\?q=Dumitrescu$/);
    await expect(field(page)).toHaveValue('Dumitrescu');
    await expect(rows(page).first()).toBeVisible();
  });

  for (const width of AXE_WIDTHS) {
    test(`a11y: browse and results at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await mockSuggested(page, {
        friendsOfFollows: [angler(1)],
        recentlyActive: page_([angler(2), angler(3, { isFollowedByMe: true }), { documentId: self.documentId, username: self.username, avatarUrl: null, isFollowedByMe: false, subline: null }], 1, 1, 3),
      });
      await mockSearch(page, (r) => json(r, page_([angler(4), angler(5)], 1, 1, 2)));
      await page.goto('/pescari');
      await expect(rows(page)).toHaveCount(4);
      await expectNoA11yViolations(page);
      await field(page).fill('Pescar');
      await expect(page.getByRole('heading', { level: 2, name: 'Rezultate 2' })).toBeVisible();
      await expectNoA11yViolations(page);
    });
  }
});
