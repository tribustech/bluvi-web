import { mkdirSync } from 'node:fs';
import { expect, test, type Page, type Route } from '@playwright/test';
import { expectNoA11yViolations } from './helpers/a11y';
import { collectConsoleErrors } from './helpers/console';
import { CMS, qaJwt, signIn } from './helpers/session';

/*
 * participant.polls-past — /sondaje/anterioare, «Sondaje anterioare» (T1; fish
 * app/(app)/polls/past.tsx, components/PollOption.tsx, services/queries/usePollsPast.ts).
 *
 * The real local CMS is read as a guest and signed in (c5, c8); the signed-in read is proven
 * personalised with a vote of the QA user's seeded on a closed LOCAL poll (an admin API token from
 * .env.local, E2E_CMS_ADMIN_TOKEN) and deleted at the end — the only write. Pages 1–2, my vote on
 * the mocks, the empty list, long words, the grid, a slow first page and failures are route mocks
 * of GET /api/cms/polls/past.
 */

const SHOTS = '.shots/sondaje-anterioare';
mkdirSync(SHOTS, { recursive: true });
const WIDTHS = [375, 768, 1280, 1440, 1920] as const;
const EXPECTED_CONSOLE = [/Failed to load resource: the server responded with a status of 500/];

/** Seeds the c8 vote on the LOCAL CMS only (git-ignored .env.local; never a staging/prod token). */
const ADMIN_TOKEN = process.env.E2E_CMS_ADMIN_TOKEN ?? '';

let jwt = '';
test.beforeAll(async ({ request }) => {
  jwt = await qaJwt(request);
});

type Option = { id: number; documentId: string; title: string; description: string | null; order: number; votesCount: number; suggestedBy: { id: number; name: string } | null };
type Poll = {
  id: number;
  documentId: string;
  title: string;
  description: string | null;
  closesAt: string | null;
  closedAt?: string | null;
  votingClosed: boolean;
  totalVotes: number;
  myVoteOptionId: number | null;
  options: Option[];
};

/** API order ≠ vote order on purpose: the web keeps the CMS order (c4). */
function pastPoll(n: number, over: Partial<Poll> = {}): Poll {
  const base = n * 10;
  return {
    id: n,
    documentId: `e2e-past-${n}`,
    title: `Sondajul de test ${n}`,
    description: null,
    closesAt: '2026-07-20T20:00:00.000Z',
    closedAt: null,
    votingClosed: true,
    totalVotes: 21,
    myVoteOptionId: null,
    options: [
      { id: base + 1, documentId: `o${base + 1}`, title: `Somn ${n}`, description: null, order: 1, votesCount: 4, suggestedBy: null },
      { id: base + 2, documentId: `o${base + 2}`, title: `Crap ${n}`, description: null, order: 2, votesCount: 16, suggestedBy: null },
      { id: base + 3, documentId: `o${base + 3}`, title: `Caras ${n}`, description: null, order: 3, votesCount: 1, suggestedBy: null },
    ],
    ...over,
  };
}

/** The first card: a description, closedAt wins over closesAt, my vote on the second option. */
const FIRST = pastPoll(1, {
  title: 'Ce specie vrei la concursul de toamnă?',
  description: 'Câștigătoarea a devenit tema concursului de toamnă.',
  closedAt: '2026-06-01T20:00:00.000Z',
  myVoteOptionId: 12,
});
/** 12 polls: page 1 = 10, page 2 = 2; the last one has no date at all. */
const ALL = [FIRST, ...Array.from({ length: 10 }, (_, i) => pastPoll(i + 2)), pastPoll(12, { closesAt: null, closedAt: null, totalVotes: 1, options: [{ id: 121, documentId: 'o121', title: 'Știucă', description: null, order: 1, votesCount: 1, suggestedBy: null }] })];

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

type MockOpts = { polls?: Poll[]; delayMs?: number; page2DelayMs?: number; failFirst?: number; failPage2?: boolean };

/** GET /api/cms/polls/past?page&pageSize: the requested slice. Returns the requests seen. */
async function mockPast(page: Page, opts: MockOpts = {}) {
  const polls = opts.polls ?? ALL;
  const seen: { page: number; pageSize: number }[] = [];
  let failures = opts.failFirst ?? 0;
  await page.route('**/api/cms/polls/past?*', async (route) => {
    const url = new URL(route.request().url());
    const p = Number(url.searchParams.get('page'));
    const size = Number(url.searchParams.get('pageSize'));
    seen.push({ page: p, pageSize: size });
    if (failures > 0) {
      failures -= 1;
      return json(route, { data: null, error: { status: 500, message: 'x' } }, 500);
    }
    if (p === 2 && opts.failPage2) return json(route, { data: null, error: { status: 500, message: 'x' } }, 500);
    const delay = p === 2 ? opts.page2DelayMs : opts.delayMs;
    if (delay) await new Promise((r) => setTimeout(r, delay));
    const data = polls.slice((p - 1) * size, p * size);
    return json(route, { data, meta: { pagination: { page: p, pageSize: size, pageCount: Math.max(1, Math.ceil(polls.length / size)), total: polls.length } } });
  });
  return seen;
}

async function collectAnalytics(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as { __events: unknown[] }).__events = [];
    window.addEventListener('bluvi:analytics', (e) => (window as unknown as { __events: unknown[] }).__events.push((e as CustomEvent).detail));
  });
  return () => page.evaluate(() => (window as unknown as { __events: { name: string; params?: Record<string, unknown> }[] }).__events);
}

async function open(page: Page, { width = 375, signedIn = false }: { width?: number; signedIn?: boolean } = {}) {
  await page.setViewportSize({ width, height: width < 768 ? 812 : 900 });
  if (signedIn) await signIn(page.context(), jwt);
  await page.goto('/sondaje/anterioare');
}

const h1 = (page: Page) => page.getByRole('heading', { level: 1, name: 'Sondaje anterioare' });
const cards = (page: Page) => page.locator('[data-past-poll]');
const card = (page: Page, title: string) => page.getByRole('article', { name: title });
const rows = (page: Page, title: string) => card(page, title).getByRole('list', { name: 'Rezultate' }).locator(':scope > li');
const refresh = (page: Page) => page.getByTestId('past-polls-refresh');

const boxes = (page: Page) => cards(page).evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON() as DOMRect));

/** Masonry: in every column each card starts 16px (±1) under the one above it — no row holes. */
async function expectNoHoles(page: Page, label: string) {
  const byCol = new Map<number, DOMRect[]>();
  for (const b of await boxes(page)) byCol.set(Math.round(b.x), [...(byCol.get(Math.round(b.x)) ?? []), b]);
  for (const col of byCol.values()) {
    col.sort((a, b) => a.y - b.y);
    for (let i = 1; i < col.length; i++) {
      const gap = col[i].y - (col[i - 1].y + col[i - 1].height);
      expect(gap, label).toBeGreaterThanOrEqual(15);
      expect(gap, label).toBeLessThanOrEqual(17.5);
    }
  }
}

async function shot(page: Page, name: string) {
  await page.waitForTimeout(700); // my vote's bar grows
  await page.screenshot({ path: `${SHOTS}/${name}-${page.viewportSize()!.width}.png`, fullPage: true });
}

test.describe('participant.polls-past', () => {
  test('c8 c5 — a guest opens it without a redirect and reads the real local CMS (no vote of their own)', async ({ page, request }) => {
    const errors = collectConsoleErrors(page);
    const real = await request.get(`${CMS}/polls/past?page=1&pageSize=10`);
    expect(real.status()).toBe(200);
    const body = (await real.json()) as { data: Poll[] };
    const req = page.waitForRequest((r) => r.url().includes('/api/cms/polls/past?') && r.method() === 'GET');
    const res = await page.goto('/sondaje/anterioare');
    expect(res?.status()).toBe(200);
    expect(new URL(page.url()).pathname).toBe('/sondaje/anterioare');
    const url = new URL((await req).url());
    expect(url.searchParams.get('page')).toBe('1');
    expect(url.searchParams.get('pageSize')).toBe('10');
    await expect(h1(page)).toBeVisible();
    if (body.data.length === 0) {
      await expect(page.getByText('Niciun sondaj încheiat')).toBeVisible();
    } else {
      await expect(cards(page)).toHaveCount(body.data.length);
      await expect(card(page, body.data[0].title)).toBeVisible();
      // A guest has no vote: no row says «votul tău».
      await expect(page.getByText(', votul tău')).toHaveCount(0);
    }
    expect(errors).toEqual([]);
  });

  test('c8 c5 — signed in, the read is personalised through /api/cms: my seeded vote on the real local CMS', async ({ page, request }) => {
    // The session must reach the CMS through /api/cms: a vote of the QA user's is seeded on a closed
    // local poll (LOCAL CMS only, an admin API token from .env.local; a poll-vote row has no lifecycle
    // or notification) and removed at the end. A Public answer would have no «votul tău».
    test.skip(!ADMIN_TOKEN, 'E2E_CMS_ADMIN_TOKEN (local CMS API token) is not set in .env.local');
    const errors = collectConsoleErrors(page);
    const admin = { Authorization: `Bearer ${ADMIN_TOKEN}` };
    const me = (await (await request.get(`${CMS}/users/me`, { headers: { Authorization: `Bearer ${jwt}` } })).json()) as { id: number };
    const guest = (await (await request.get(`${CMS}/polls/past?page=1&pageSize=10`)).json()) as { data: Poll[] };
    const target = guest.data.find((p) => p.options.length > 1);
    test.skip(!target, 'the local CMS has no closed poll with two options');
    const option = target!.options[1];
    const before = (await (await request.get(`${CMS}/poll-votes?filters[user][id][$eq]=${me.id}&filters[poll][documentId][$eq]=${target!.documentId}`, { headers: admin })).json()) as { data: unknown[] };
    expect(before.data, 'the QA user already has a vote on this poll').toEqual([]);
    const created = await request.post(`${CMS}/poll-votes`, { headers: admin, data: { data: { user: me.id, poll: target!.documentId, option: option.documentId } } });
    expect(created.status(), await created.text()).toBe(201);
    const vote = ((await created.json()) as { data: { documentId: string } }).data.documentId;
    try {
      const res = page.waitForResponse((r) => r.url().includes('/api/cms/polls/past?') && r.request().method() === 'GET');
      await open(page, { width: 1280, signedIn: true });
      expect((await res).status()).toBe(200);
      const mine = card(page, target!.title).locator(`[data-poll-option="${option.id}"]`);
      await expect(mine.getByText(', votul tău')).toHaveCount(1);
      await expect(mine).toHaveClass(/border-indigo-4/);
      await expect(page.getByText(', votul tău')).toHaveCount(1);
      // The same poll for a guest: counted, but nobody's vote.
      await page.context().clearCookies();
      await page.reload();
      await expect(card(page, target!.title).locator(`[data-poll-option="${option.id}"]`)).toContainText('1 vot');
      await expect(page.getByText(', votul tău')).toHaveCount(0);
    } finally {
      const del = await request.delete(`${CMS}/poll-votes/${vote}`, { headers: admin });
      expect(del.status()).toBe(204);
    }
    expect(errors).toEqual([]);
  });

  test('c1 — header: back and «Sondaje anterioare»; back goes home when nothing is behind, else back', async ({ page }) => {
    await mockPast(page);
    await open(page);
    await expect(h1(page)).toBeVisible();
    const back = page.getByRole('button', { name: 'Înapoi' });
    await expect(back).toBeVisible();
    // No breadcrumb band: the header's back control owns the way back.
    await back.click();
    await expect(page).toHaveURL((u) => u.pathname === '/');
    // From /sondaje: back returns there.
    await page.goto('/sondaje');
    await page.getByRole('link', { name: /Sondaje anterioare/ }).first().click();
    await expect(h1(page)).toBeVisible();
    await page.getByRole('button', { name: 'Înapoi' }).click();
    await expect(page).toHaveURL((u) => u.pathname === '/sondaje');
  });

  test('c2 — while loading, a centred spinner under the header', async ({ page }) => {
    await mockPast(page, { delayMs: 2500 });
    await open(page, { width: 1280 });
    await expect(h1(page)).toBeVisible();
    const spinner = page.getByTestId('past-polls-loading');
    await expect(spinner).toBeVisible();
    await expect(spinner).toHaveAttribute('role', 'status');
    await expect(spinner).toContainText('Se încarcă sondajele…');
    const box = (await spinner.boundingBox())!;
    const dot = (await spinner.locator('span[aria-hidden]').boundingBox())!;
    expect(Math.abs(dot.x + dot.width / 2 - (box.x + box.width / 2))).toBeLessThanOrEqual(1);
    for (const w of WIDTHS) {
      await page.setViewportSize({ width: w, height: w < 768 ? 812 : 900 });
      await page.screenshot({ path: `${SHOTS}/loading-${w}.png`, fullPage: true });
    }
    await expect(cards(page)).toHaveCount(10);
    await expect(spinner).toHaveCount(0);
  });

  test('c3 — empty: «Niciun sondaj încheiat» and its body', async ({ page }) => {
    await mockPast(page, { polls: [] });
    await open(page);
    await expect(page.getByText('Niciun sondaj încheiat')).toBeVisible();
    await expect(page.getByText('Pe măsură ce sondajele se închid, vor apărea aici cu rezultatele finale.')).toBeVisible();
    await expect(cards(page)).toHaveCount(0);
    await expectNoA11yViolations(page);
    for (const w of WIDTHS) {
      await page.setViewportSize({ width: w, height: w < 768 ? 812 : 900 });
      await shot(page, 'empty');
    }
  });

  test('c4 — card: title, «Închis · date · votes», description, read-only options in API order, my vote', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await mockPast(page);
    await open(page);
    const first = card(page, FIRST.title);
    await expect(first.getByRole('heading', { level: 2, name: FIRST.title })).toBeVisible();
    // closedAt (1 June) wins over closesAt (20 July).
    await expect(first.locator('[data-past-poll-facts]')).toHaveText('Închis · 1 iunie 2026 · 21 de voturi');
    await expect(first.getByText('Câștigătoarea a devenit tema concursului de toamnă.')).toBeVisible();
    // API order (Somn 4, Crap 16, Caras 1), not sorted by votes.
    await expect(rows(page, FIRST.title)).toHaveCount(3);
    await expect(rows(page, FIRST.title).nth(0)).toContainText('Somn 1');
    await expect(rows(page, FIRST.title).nth(1)).toContainText('Crap 1');
    await expect(rows(page, FIRST.title).nth(2)).toContainText('Caras 1');
    // Share and count per option.
    await expect(rows(page, FIRST.title).nth(0)).toContainText('19%');
    await expect(rows(page, FIRST.title).nth(0)).toContainText('4 voturi');
    await expect(rows(page, FIRST.title).nth(1)).toContainText('76%');
    await expect(rows(page, FIRST.title).nth(1)).toContainText('16 voturi');
    await expect(rows(page, FIRST.title).nth(2)).toContainText('5%');
    await expect(rows(page, FIRST.title).nth(2)).toContainText('1 vot');
    // My vote: highlighted (border + bar) and said in words; read-only: no control, no aria-pressed.
    const mine = first.locator('[data-poll-option="12"]');
    await expect(mine).toHaveClass(/border-indigo-4/);
    await expect(mine.locator('[data-poll-bar]')).toHaveCount(1);
    await expect(mine.getByText(', votul tău')).toHaveCount(1);
    await expect(first.locator('[data-poll-option="11"]')).not.toHaveClass(/border-indigo-4/);
    await expect(first.locator('button, a, [aria-pressed]')).toHaveCount(0);
    // closesAt when closedAt is null; a single vote; no description.
    await expect(card(page, 'Sondajul de test 2').locator('[data-past-poll-facts]')).toHaveText('Închis · 20 iulie 2026 · 21 de voturi');
    await expect(card(page, 'Sondajul de test 2').locator('p.t-body')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('c4 — no date at all: the date is left out (page 2)', async ({ page }) => {
    await mockPast(page);
    await open(page, { width: 1440 });
    await page.getByRole('button', { name: 'Încarcă mai multe' }).click();
    await expect(card(page, 'Sondajul de test 12').locator('[data-past-poll-facts]')).toHaveText('Închis · 1 vot');
  });

  test('c5 — the next page loads near the end with a spinner footer; the button is the keyboard path', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    const seen = await mockPast(page, { page2DelayMs: 1500 });
    await open(page);
    await expect(cards(page)).toHaveCount(10);
    expect(seen).toEqual([{ page: 1, pageSize: 10 }]);
    await expect(page.getByText('10 din 12 sondaje')).toBeVisible();
    // Scrolling to the end loads page 2, with the footer's spinner.
    await page.getByRole('button', { name: 'Încarcă mai multe' }).scrollIntoViewIfNeeded();
    await expect(page.getByTestId('list-footer-spinner')).toBeVisible();
    await page.mouse.wheel(0, 200);
    for (const w of [375, 1280]) {
      await page.setViewportSize({ width: w, height: w < 768 ? 812 : 900 });
      await page.screenshot({ path: `${SHOTS}/next-page-${w}.png` });
    }
    await expect(cards(page)).toHaveCount(12);
    expect(seen).toEqual([
      { page: 1, pageSize: 10 },
      { page: 2, pageSize: 10 },
    ]);
    // The end: no footer button left.
    await expect(page.getByRole('button', { name: 'Încarcă mai multe' })).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('c5 — keyboard: Tab reaches back, Reîncarcă and «Încarcă mai multe»; Enter loads page 2', async ({ page }) => {
    const seen = await mockPast(page);
    await open(page, { width: 1280 });
    await expect(cards(page)).toHaveCount(10);
    await page.locator('body').focus();
    await h1(page).focus();
    await page.keyboard.press('Shift+Tab');
    await expect(page.getByRole('button', { name: 'Înapoi' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(refresh(page)).toBeFocused();
    // The cards are results: nothing focusable between the header and the footer.
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Încarcă mai multe' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(cards(page)).toHaveCount(12);
    expect(seen.map((s) => s.page)).toEqual([1, 2]);
  });

  test('c5 — a failed next page says so and offers «Reîncearcă»', async ({ page }) => {
    await mockPast(page, { failPage2: true });
    await open(page, { width: 1280 });
    await expect(cards(page)).toHaveCount(10);
    await page.getByRole('button', { name: 'Încarcă mai multe' }).click();
    await expect(page.getByText('Nu am putut încărca mai multe sondaje.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reîncearcă' })).toBeVisible();
    await expect(cards(page)).toHaveCount(10);
  });

  test('c6 — «Reîncarcă» reloads the list (every loaded page), busy while it runs', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    const seen = await mockPast(page);
    await open(page, { width: 1280 });
    await expect(cards(page)).toHaveCount(10);
    await expect(refresh(page)).toHaveText('Reîncarcă');
    // Slow the refetch down to see the busy state.
    await page.unroute('**/api/cms/polls/past?*');
    const again: number[] = [];
    await page.route('**/api/cms/polls/past?*', async (route) => {
      const p = Number(new URL(route.request().url()).searchParams.get('page'));
      again.push(p);
      await new Promise((r) => setTimeout(r, 800));
      const changed = ALL.map((x, i) => (i === 0 ? { ...x, title: 'Titlu reîncărcat' } : x));
      return json(route, { data: changed.slice((p - 1) * 10, p * 10), meta: { pagination: { page: p, pageSize: 10, pageCount: 2, total: 12 } } });
    });
    await refresh(page).click();
    await expect(refresh(page)).toHaveAttribute('aria-busy', 'true');
    await expect(refresh(page)).toContainText('Se reîncarcă…');
    await expect(page.locator('section[aria-busy="true"]')).toHaveCount(1);
    await expect(card(page, 'Titlu reîncărcat')).toBeVisible();
    await expect(refresh(page)).not.toHaveAttribute('aria-busy', 'true');
    await expect(page.getByRole('status').filter({ hasText: 'Sondajele au fost reîncărcate.' })).toHaveCount(1);
    expect(again).toEqual([1]);
    expect(seen.length).toBe(1);
    expect(errors).toEqual([]);
  });

  test('c6 — a failed «Reîncarcă» says so visibly and keeps the cards', async ({ page }) => {
    const errors = collectConsoleErrors(page, { ignore: EXPECTED_CONSOLE });
    await mockPast(page);
    await open(page, { width: 1280 });
    await expect(cards(page)).toHaveCount(10);
    await page.unroute('**/api/cms/polls/past?*');
    await page.route('**/api/cms/polls/past?*', (route) => json(route, { data: null, error: { status: 500, message: 'x' } }, 500));
    await refresh(page).click();
    const alert = page.getByRole('alert').filter({ hasText: 'Nu am putut reîncărca sondajele. Încearcă din nou.' });
    await expect(alert).toBeVisible({ timeout: 30_000 });
    await expect(cards(page)).toHaveCount(10);
    await expect(card(page, FIRST.title)).toBeVisible();
    // Not announced a second time as a success.
    await expect(page.getByRole('status').filter({ hasText: 'Sondajele au fost reîncărcate.' })).toHaveCount(0);
    for (const w of [375, 1280]) {
      await page.setViewportSize({ width: w, height: w < 768 ? 812 : 900 });
      await page.screenshot({ path: `${SHOTS}/refresh-failed-${w}.png` });
    }
    expect(errors).toEqual([]);
  });

  test('first page failed — error with a retry that recovers', async ({ page }) => {
    const errors = collectConsoleErrors(page, { ignore: EXPECTED_CONSOLE });
    // TanStack retries a failed query (3 retries by default in the site's client or not): fail enough.
    await mockPast(page, { failFirst: 10 });
    await open(page, { width: 1280 });
    const alert = page.getByRole('alert').filter({ hasText: 'Nu am putut încărca sondajele.' });
    await expect(alert).toBeVisible({ timeout: 30_000 });
    for (const w of WIDTHS) {
      await page.setViewportSize({ width: w, height: w < 768 ? 812 : 900 });
      await page.screenshot({ path: `${SHOTS}/error-${w}.png`, fullPage: true });
    }
    await page.unroute('**/api/cms/polls/past?*');
    await mockPast(page);
    await page.getByRole('button', { name: 'Încearcă din nou' }).click();
    await expect(cards(page)).toHaveCount(10);
    expect(errors).toEqual([]);
  });

  test('c7 — poll_past_view once per visit', async ({ page }) => {
    const events = await collectAnalytics(page);
    await mockPast(page);
    await open(page, { width: 1280 });
    await expect(cards(page)).toHaveCount(10);
    await refresh(page).click();
    await page.getByRole('button', { name: 'Încarcă mai multe' }).click();
    await expect(cards(page)).toHaveCount(12);
    const views = (await events()).filter((e) => e.name === 'poll_past_view');
    expect(views).toHaveLength(1);
  });

  test('grid — one column on a phone, 2–3 columns from 768, cards never wider than ~560', async ({ page }) => {
    await mockPast(page);
    const expected: Record<number, number> = { 375: 1, 768: 2, 1024: 2, 1280: 3, 1440: 3, 1920: 3 };
    await open(page);
    await expect(cards(page)).toHaveCount(10);
    for (const [w, cols] of Object.entries(expected)) {
      await page.setViewportSize({ width: Number(w), height: 900 });
      await page.waitForTimeout(100);
      const xs = new Set<number>();
      for (const box of await boxes(page)) {
        xs.add(Math.round(box.x));
        if (Number(w) >= 768) expect(box.width).toBeLessThanOrEqual(560);
      }
      expect(xs.size, `${w}px`).toBe(cols);
    }
  });

  for (const n of [1, 2]) {
    test(`grid — ${n} closed poll${n > 1 ? 's' : ''}: ${n} centred column${n > 1 ? 's' : ''}, never a third of an empty page`, async ({ page }) => {
      await mockPast(page, { polls: ALL.slice(0, n) });
      await open(page);
      await expect(cards(page)).toHaveCount(n);
      for (const w of [375, 768, 1280, 1440, 1920]) {
        await page.setViewportSize({ width: w, height: 900 });
        await page.waitForTimeout(100);
        const list = (await page.getByTestId('past-polls').boundingBox())!;
        const bs = await boxes(page);
        expect(new Set(bs.map((b) => Math.round(b.x))).size, `${w}px`).toBe(w < 768 ? 1 : n);
        if (w >= 768) {
          for (const b of bs) expect(b.width).toBeLessThanOrEqual(560);
          // Centred: as much room on the left of the first card as on the right of the last.
          const left = bs[0].x - list.x;
          const right = list.x + list.width - (bs.at(-1)!.x + bs.at(-1)!.width);
          expect(Math.abs(left - right), `${w}px`).toBeLessThanOrEqual(2);
        }
      }
      await page.setViewportSize({ width: 1440, height: 900 });
      await shot(page, `grid-${n}`);
    });
  }

  test('grid — masonry: a long poll beside short ones leaves no hole; the next page adds below', async ({ page }) => {
    const tall = pastPoll(2, {
      title: 'Sondajul lung',
      description: 'Șase opțiuni și o descriere: cardul e mult mai înalt decât vecinii lui.',
      options: Array.from({ length: 6 }, (_, i) => ({ id: 200 + i, documentId: `o${200 + i}`, title: `Opțiunea ${i + 1}`, description: null, order: i + 1, votesCount: 3, suggestedBy: null })),
      totalVotes: 18,
    });
    await mockPast(page, { polls: [ALL[0], tall, ...ALL.slice(2)] });
    for (const w of [768, 1280, 1440, 1920]) {
      await page.setViewportSize({ width: w, height: 900 });
      if (w === 768) {
        await page.goto('/sondaje/anterioare');
        await expect(cards(page)).toHaveCount(10);
      }
      await page.waitForTimeout(150);
      await expectNoHoles(page, `${w}px`);
    }
    await shot(page, 'masonry');
    // Page 2: the cards already there do not move.
    const before = await boxes(page);
    await page.getByRole('button', { name: 'Încarcă mai multe' }).click();
    await expect(cards(page)).toHaveCount(12);
    const after = (await boxes(page)).slice(0, 10);
    for (let i = 0; i < 10; i++) {
      expect(Math.round(after[i].x)).toBe(Math.round(before[i].x));
      expect(Math.abs(after[i].y - before[i].y)).toBeLessThanOrEqual(1);
    }
    await expectNoHoles(page, 'page 2');
  });

  test('c4 — a word longer than the card breaks inside it (title, description, option)', async ({ page }) => {
    const word = 'Pescarii-de-la-balta-mare-din-Ilfov-si-prietenii-lor-din-2026'; // 60+ characters, no break point
    const long = pastPoll(1, {
      title: word,
      description: `https://bluvi.ro/${word}`,
      options: [
        { id: 11, documentId: 'o11', title: word, description: word, order: 1, votesCount: 1, suggestedBy: { id: 5, name: 'Ion Popescu' } },
        { id: 12, documentId: 'o12', title: 'Crap', description: null, order: 2, votesCount: 20, suggestedBy: null },
      ],
    });
    await mockPast(page, { polls: [long, ...ALL.slice(1, 3)] });
    for (const w of [375, 1440]) {
      await page.setViewportSize({ width: w, height: w < 768 ? 812 : 900 });
      if (w === 375) {
        await page.goto('/sondaje/anterioare');
        await expect(cards(page)).toHaveCount(3);
      }
      await page.waitForTimeout(150);
      const over = await cards(page).evaluateAll((els) =>
        els.flatMap((el) => [el, ...el.querySelectorAll<HTMLElement>('[data-poll-option], h2, p')].filter((e) => e.scrollWidth > e.clientWidth + 0.5).map((e) => `${e.tagName} ${e.scrollWidth}>${e.clientWidth}`)),
      );
      expect(over, `${w}px`).toEqual([]);
      // The option's text never runs under its share column: «1 vot» stays clear.
      const row = card(page, word).locator('[data-poll-option="11"]');
      const share = (await row.getByText('1 vot', { exact: true }).boundingBox())!;
      for (const t of await row.getByText(word, { exact: true }).all()) {
        const b = (await t.boundingBox())!;
        expect(b.x + b.width, `${w}px`).toBeLessThanOrEqual(share.x + 0.5);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(w);
      await shot(page, 'long-word');
    }
  });

  test('a11y + shots — list (guest and signed-in mock with my vote) at every width', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await mockPast(page);
    await open(page);
    await expect(cards(page)).toHaveCount(10);
    await expectNoA11yViolations(page);
    for (const w of WIDTHS) {
      await page.setViewportSize({ width: w, height: w < 768 ? 812 : 900 });
      await shot(page, 'list');
    }
    await page.setViewportSize({ width: 1280, height: 900 });
    await expectNoA11yViolations(page);
    expect(errors).toEqual([]);
  });

  test('seo — static public shell: title, canonical, OG image, BreadcrumbList, indexable, in the sitemap', async ({ page, request }) => {
    const res = await request.get('/sondaje/anterioare');
    expect(res.status()).toBe(200);
    const html = await res.text();
    expect(html).toContain('<link rel="canonical" href="');
    expect(html).toMatch(/rel="canonical" href="[^"]*\/sondaje\/anterioare"/);
    expect(html).not.toMatch(/name="robots" content="[^"]*noindex/);
    expect(html).toMatch(/property="og:image" content="[^"]*\/sondaje\/anterioare\/opengraph-image/);
    expect(html).toContain('"@type":"BreadcrumbList"');
    // The polls are never in the server HTML (personalised: read in the browser).
    expect(html).not.toContain('data-past-poll=');
    await page.goto('/sondaje/anterioare');
    await expect(page).toHaveTitle(/Sondaje anterioare/);
    const og = await request.get(html.match(/property="og:image" content="([^"]+)"/)![1].replace(/^https?:\/\/[^/]+/, ''));
    expect(og.status()).toBe(200);
    expect(og.headers()['content-type']).toBe('image/png');
    // In a sitemap the index lists (the static list pages').
    const index = await (await request.get('/sitemap.xml')).text();
    const maps = [...index.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
    let listed = false;
    for (const m of maps) {
      const xml = await (await request.get(m, { timeout: 120_000 })).text();
      if (/<loc>[^<]*\/sondaje\/anterioare<\/loc>/.test(xml)) {
        listed = true;
        break;
      }
    }
    expect(listed).toBe(true);
  });
});
