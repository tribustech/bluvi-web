import { mkdirSync } from 'node:fs';
import { expect, test, type Page, type Route } from '@playwright/test';
import { expectNoA11yViolations } from './helpers/a11y';
import { collectConsoleErrors } from './helpers/console';
import { CMS, qaJwt, signIn } from './helpers/session';

/*
 * account.notifications (/notificari, T1) + account.b.unread-badge, account.b.notification-route-map,
 * global.b.notification-routes-web, global.push (web replacement). fish: app/(app)/notifications.tsx.
 *
 * Data: the local QA user against the LOCAL CMS. The real list is read as is; every other state is
 * a route mock of /api/cms/notification-users* (the browser's proxy calls). One real write: «c9
 * real» seeds a throwaway notification + notification-user for the QA user through the LOCAL
 * Strapi's REST API (E2E_STRAPI_API_TOKEN, .env.local; no push, no Firestore — those are sent by
 * other CMS services, not on create), marks it read through the page and deletes both rows after.
 * «Citește tot» is always mocked: there is no mark-unread API to undo it.
 */

const PATH = '/notificari';
const WIDTHS = [375, 1280, 1440, 1920] as const;
/** Failed requests the specs provoke on purpose (mocked 500s) are logged by the browser. */
const EXPECTED_CONSOLE = [/Failed to load resource: the server responded with a status of 500/];
const SHOTS = '.shots/notificari';

let jwt: string;
test.beforeAll(async ({ request }) => {
  jwt = await qaJwt(request);
  mkdirSync(SHOTS, { recursive: true });
});

type Row = { documentId: string; read: boolean; title: string; body?: string; sentAt?: string; type: string; data?: Record<string, unknown> };

function row(r: Row, i: number) {
  return {
    id: 1000 + i,
    documentId: `row-${r.documentId}`,
    read: r.read,
    readAt: r.read ? '2026-10-01T10:00:00.000Z' : null,
    notification: {
      id: 2000 + i,
      documentId: r.documentId,
      title: r.title,
      body: r.body ?? 'Detalii',
      sentAt: r.sentAt ?? '2026-10-03T18:31:59.032Z',
      data: { type: r.type, ...(r.data ?? {}) },
      type: r.type,
    },
  };
}

function pageBody(rows: Row[], page = 1, pageCount = 1, total = rows.length) {
  return JSON.stringify({
    data: rows.map((r, i) => row(r, i + page * 100)),
    meta: { pagination: { page, pageSize: 10, pageCount, total } },
  });
}

/** A body, a status (message 'x'), or a status with the CMS's message. */
type Failure = string | number | { status: number; message: string };

type Mock = {
  /** GET /notification-users: the body for a page, or a status. */
  list?: (page: number, call: number) => Failure | Promise<Failure>;
  unread?: () => number;
  markAll?: () => number;
  markOne?: () => number;
};

/** One handler for the proxy's /notification-users*; records every request. */
async function mock(page: Page, m: Mock) {
  const calls = { list: [] as URL[], markAll: 0, markOne: [] as string[], unread: 0 };
  await page.route(/\/api\/cms\/notification-users(\/|\?|$)/, async (r: Route) => {
    const url = new URL(r.request().url());
    const method = r.request().method();
    const json = (body: string, status = 200) => r.fulfill({ status, contentType: 'application/json', body });
    if (url.pathname.endsWith('/unread')) {
      calls.unread += 1;
      return m.unread ? json(JSON.stringify({ count: m.unread() })) : r.fallback();
    }
    if (url.pathname.endsWith('/mark-all-as-read') && method === 'POST') {
      calls.markAll += 1;
      if (!m.markAll) return r.fallback();
      const s = m.markAll();
      return json(s < 300 ? JSON.stringify({ message: 'ok' }) : JSON.stringify({ data: null, error: { status: s, message: 'Eroare server' } }), s);
    }
    const one = url.pathname.match(/notification-users\/([^/]+)\/mark-as-read$/);
    if (one && method === 'POST') {
      calls.markOne.push(one[1]);
      return m.markOne ? json(JSON.stringify({ message: 'ok' }), m.markOne()) : r.fallback();
    }
    if (method === 'GET' && url.pathname.endsWith('/notification-users')) {
      calls.list.push(url);
      if (!m.list) return r.fallback();
      const p = Number(url.searchParams.get('pagination[page]') ?? '1');
      const out = await m.list(p, calls.list.length);
      if (typeof out === 'string') return json(out);
      const [status, message] = typeof out === 'number' ? [out, 'x'] : [out.status, out.message];
      return json(JSON.stringify({ data: null, error: { status, message } }), status);
    }
    return r.fallback();
  });
  return calls;
}

async function collectAnalytics(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as { __events: unknown[] }).__events = [];
    window.addEventListener('bluvi:analytics', (e) => (window as unknown as { __events: unknown[] }).__events.push((e as CustomEvent).detail));
  });
  return () => page.evaluate(() => (window as unknown as { __events: { name: string; params: Record<string, unknown> }[] }).__events);
}

async function open(page: Page, width = 375) {
  await page.setViewportSize({ width, height: 900 });
  await signIn(page.context(), jwt);
  await page.goto(PATH);
}

const title = (page: Page) => page.getByRole('heading', { level: 1, name: 'Notificări' });
const list = (page: Page) => page.getByRole('list', { name: 'Notificări' });
const rows = (page: Page) => list(page).locator(':scope > li');
const markAll = (page: Page) => page.getByRole('button', { name: 'Citește tot' });
const bell = (page: Page) => page.getByRole('banner').getByRole('link', { name: /^Notificări/ }).first();

const MIXED: Row[] = [
  { documentId: 'n-news', read: false, title: 'Știre nouă', type: 'news', data: { newsId: 'stire-1' } },
  { documentId: 'n-follow', read: false, title: 'Ai un urmăritor nou', type: 'user:new-follower', data: { followerDocumentId: 'pescar-1' } },
  { documentId: 'n-sched', read: false, title: 'Mesaj de la Bluvi', type: 'scheduled-notification' },
  { documentId: 'n-booking', read: true, title: 'Rezervare confirmată', type: 'booking:confirmed-angler', data: { bookingId: 'b1' } },
  { documentId: 'n-old', read: true, title: 'Concurs încheiat', type: 'competition:end', data: { competitionId: 'c1' }, sentAt: '2025-12-28T10:00:00.000Z' },
];

test.describe('account.notifications', () => {
  test('c12 signed out → /intra?next=/notificari', async ({ page }) => {
    await page.goto(PATH);
    await expect(page).toHaveURL(/\/intra\?next=%2Fnotificari$/);
  });

  test('c5 real list: GET /notification-users, page 1, 10 a page; c2 header; axe at 4 widths', async ({ page, request }) => {
    const errors = collectConsoleErrors(page);
    const calls = await mock(page, {});
    const res = await request.get(`${CMS}/notification-users?pagination[page]=1&pagination[pageSize]=10`, {
      headers: { authorization: `Bearer ${jwt}` },
    });
    const real = (await res.json()) as { data: unknown[]; meta: { pagination: { pageCount: number } } };
    await open(page);
    await expect(title(page)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Înapoi' })).toBeVisible();
    if (real.data.length === 0) {
      await expect(page.getByText('Nu există notificări')).toBeVisible();
    } else {
      // The footer is in range at 900px, so page 2 may follow at once: page 1's rows are there at least.
      await expect.poll(() => rows(page).count()).toBeGreaterThanOrEqual(real.data.length);
    }
    const first = calls.list[0];
    expect(first.searchParams.get('pagination[page]')).toBe('1');
    expect(first.searchParams.get('pagination[pageSize]')).toBe('10');
    for (const w of WIDTHS) {
      await page.setViewportSize({ width: w, height: 900 });
      await expect(title(page)).toBeVisible();
      await page.screenshot({ path: `${SHOTS}/real-${w}.png`, fullPage: true });
      await expectNoA11yViolations(page);
    }
    expect(errors).toEqual([]);
  });

  test('c2 back without history goes home', async ({ page }) => {
    await mock(page, { list: () => pageBody(MIXED), unread: () => 3 });
    await open(page);
    await page.getByRole('button', { name: 'Înapoi' }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test('c1 loading: the rows skeleton while the first page loads', async ({ page }) => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    // The shell's CommandPalette input sometimes hydrates with a different caret-color style (not
    // this page's markup; seen in dev 2026-10-07): left to the shell's owner.
    const errors = collectConsoleErrors(page, { warnings: true, ignore: /A tree hydrated but some attributes/ });
    await mock(page, { list: async () => (await gate, pageBody(MIXED)), unread: () => 3 });
    await open(page);
    await expect(page.getByRole('status').filter({ hasText: 'Se încarcă notificările…' })).toBeAttached();
    for (const w of WIDTHS) {
      await page.setViewportSize({ width: w, height: 900 });
      await page.screenshot({ path: `${SHOTS}/loading-${w}.png` });
    }
    await expect(markAll(page)).toHaveCount(0);
    release();
    await expect(rows(page)).toHaveCount(MIXED.length);
    expect(errors).toEqual([]);
  });

  test('c1 error: the error card, «Încearcă din nou» refetches', async ({ page }) => {
    const errors = collectConsoleErrors(page, { ignore: EXPECTED_CONSOLE });
    let fail = true;
    const calls = await mock(page, { list: () => (fail ? 500 : pageBody(MIXED)), unread: () => 3 });
    await open(page);
    const alert = page.getByRole('alert').filter({ hasText: 'Serverul nu răspunde' });
    await expect(alert).toBeVisible({ timeout: 20_000 });
    for (const w of WIDTHS) {
      await page.setViewportSize({ width: w, height: 900 });
      await page.screenshot({ path: `${SHOTS}/error-${w}.png` });
      await expectNoA11yViolations(page);
    }
    fail = false;
    const before = calls.list.length;
    await page.getByRole('button', { name: 'Încearcă din nou' }).click();
    await expect(rows(page)).toHaveCount(MIXED.length);
    expect(calls.list.length).toBeGreaterThan(before);
    expect(errors).toEqual([]);
  });

  test('c10 empty: «Nu există notificări», no «Citește tot»', async ({ page }) => {
    await mock(page, { list: () => pageBody([]), unread: () => 0 });
    await open(page);
    await expect(page.getByText('Nu există notificări')).toBeVisible();
    await expect(markAll(page)).toHaveCount(0);
    // From 1440 the list and its summary are one group centred in the shell column (owner rule:
    // full-width layouts) — at 1920 the empty card sits in the middle, not glued to the left.
    await page.setViewportSize({ width: 1920, height: 900 });
    const head = (await page.getByRole('button', { name: 'Înapoi' }).boundingBox())!;
    const side = (await page.getByRole('complementary', { name: 'Rezumat' }).boundingBox())!;
    const left = head.x - ((1920 - 1744) / 2 + 32);
    const right = 1920 - (1920 - 1744) / 2 - 32 - (side.x + side.width);
    expect(left).toBeGreaterThan(200);
    expect(Math.abs(left - right)).toBeLessThanOrEqual(2);
    for (const w of WIDTHS) {
      await page.setViewportSize({ width: w, height: 900 });
      await page.screenshot({ path: `${SHOTS}/empty-${w}.png` });
      await expectNoA11yViolations(page);
    }
  });

  test('c6/c7 rows: mark, title, unread dot with its text, body, time (year when not this year); read rows dimmed', async ({ page }) => {
    await mock(page, { list: () => pageBody(MIXED), unread: () => 3 });
    await open(page, 1280);
    const news = rows(page).nth(0);
    await expect(news).toContainText('Știre nouă');
    await expect(news).toContainText('Detalii');
    await expect(news).toContainText('3 octombrie, ora 21:31');
    await expect(news.getByText('necitită')).toBeAttached();
    const old = rows(page).nth(4);
    await expect(old).toContainText('28 decembrie 2025, ora 12:00');
    await expect(old.getByText('necitită')).toHaveCount(0);
    await expect(old).toHaveAttribute('data-read', 'true');
    // Unread title bold, read title regular.
    const weight = (l: ReturnType<typeof rows>, text: string) => l.getByText(text).evaluate((e) => getComputedStyle(e).fontWeight);
    expect(Number(await weight(news, 'Știre nouă'))).toBeGreaterThanOrEqual(700);
    expect(Number(await weight(old, 'Concurs încheiat'))).toBeLessThan(700);
    // A read row is quieter without opacity: its title takes the unread body's ink-2, its body the
    // muted grey — still two levels (title ≠ body) and both different from an unread row's.
    const color = (l: ReturnType<typeof rows>, text: string) => l.getByText(text).evaluate((e) => getComputedStyle(e).color);
    expect(await color(old, 'Concurs încheiat')).not.toBe(await color(old, 'Detalii'));
    expect(await color(old, 'Concurs încheiat')).not.toBe(await color(news, 'Știre nouă'));
    expect(await color(old, 'Detalii')).not.toBe(await color(news, 'Detalii'));
    // The unread signal at every width is fish's dot right of the title — no background wash.
    const card = (l: ReturnType<typeof rows>) => l.locator(':scope > *');
    const style = (l: ReturnType<typeof rows>) =>
      card(l).evaluate((e) => ({ image: getComputedStyle(e).backgroundImage, bg: getComputedStyle(e).backgroundColor, shadow: getComputedStyle(e).boxShadow }));
    await expect(news.locator('[data-unread-dot]')).toBeVisible();
    await expect(old.locator('[data-unread-dot]')).toHaveCount(0);
    const newsRest = await style(news);
    const oldRest = await style(old);
    expect(newsRest.image).toBe('none');
    // From 768 a read card is flat (no hairline), an unread one keeps it.
    const visible = (shadow: string) => shadow.split(/,(?![^(]*\))/).filter((x) => x.trim() !== 'none' && !x.includes('rgba(0, 0, 0, 0)'));
    expect(visible(oldRest.shadow)).toEqual([]);
    expect(visible(newsRest.shadow)).not.toEqual([]);
    // Hover: an unread row's differs from its rest and from a read row's hover and rest.
    await card(news).hover();
    await expect.poll(async () => (await style(news)).bg).not.toBe(newsRest.bg);
    const newsHover = (await style(news)).bg;
    await card(old).hover();
    await expect.poll(async () => (await style(old)).bg).not.toBe(oldRest.bg);
    expect(newsHover).not.toBe((await style(old)).bg);
    expect(newsHover).not.toBe(oldRest.bg);
    await page.setViewportSize({ width: 375, height: 900 });
    await expect(news.locator('[data-unread-dot]')).toBeVisible();
  });

  test('c3/c4 + account.b.unread-badge: «Citește tot» reads everything, the top-bar dot goes, all read hides the button', async ({ page }) => {
    let unread = 3;
    let allRead = false;
    const calls = await mock(page, {
      list: () => pageBody(MIXED.map((r) => ({ ...r, read: allRead || r.read }))),
      unread: () => unread,
      markAll: () => {
        allRead = true;
        unread = 0;
        return 200;
      },
    });
    await open(page, 1280);
    await expect(bell(page)).toHaveAttribute('aria-label', 'Notificări, ai notificări noi');
    await expect(markAll(page)).toBeVisible();
    for (const w of WIDTHS) {
      await page.setViewportSize({ width: w, height: 900 });
      await page.screenshot({ path: `${SHOTS}/unread-${w}.png`, fullPage: true });
      await expectNoA11yViolations(page);
    }
    const listCalls = calls.list.length;
    await markAll(page).click();
    await expect(page.locator('[data-unread-dot]')).toHaveCount(0);
    await expect(markAll(page)).toHaveCount(0);
    await expect(title(page)).toBeFocused();
    expect(calls.markAll).toBe(1);
    await expect(bell(page)).toHaveAttribute('aria-label', 'Notificări');
    await expect.poll(() => calls.list.length).toBeGreaterThan(listCalls);
    for (const w of WIDTHS) {
      await page.setViewportSize({ width: w, height: 900 });
      await page.screenshot({ path: `${SHOTS}/all-read-${w}.png`, fullPage: true });
    }
  });

  test('c4 a failed «Citește tot» shows the error toast and the refetch brings the unread rows back', async ({ page }) => {
    const errors = collectConsoleErrors(page, { ignore: EXPECTED_CONSOLE });
    await mock(page, { list: () => pageBody(MIXED), unread: () => 3, markAll: () => 500 });
    await open(page);
    await markAll(page).click();
    await expect(page.getByRole('alert').filter({ hasText: /eroare/i })).toBeVisible();
    await expect(markAll(page)).toBeVisible();
    await expect(page.locator('[data-unread-dot]')).toHaveCount(3);
    expect(errors).toEqual([]);
  });

  test('c8 + global.b.notification-routes-web: rows with a page are links, the rest plain text', async ({ page }) => {
    await mock(page, { list: () => pageBody(MIXED), unread: () => 3 });
    await open(page, 1280);
    await expect(rows(page).nth(0).getByRole('link')).toHaveAttribute('href', '/stiri/stire-1');
    await expect(rows(page).nth(1).getByRole('link')).toHaveAttribute('href', '/pescari/pescar-1');
    await expect(rows(page).nth(4).getByRole('link')).toHaveAttribute('href', '/concursuri/c1/clasament');
    // SCHEDULED_NOTIFICATION never routes; a booking's page is M3: no link. Unread, it is a button
    // that only marks it read; read, it is plain text with no focus stop.
    await expect(rows(page).nth(2).getByRole('link')).toHaveCount(0);
    await expect(rows(page).nth(2).getByRole('button')).toHaveCount(1);
    await expect(rows(page).nth(3).getByRole('link')).toHaveCount(0);
    await expect(rows(page).nth(3).getByRole('button')).toHaveCount(0);
  });

  test('c8/c9/c13 activating an unread NEWS row marks it read, logs the event and opens the article', async ({ page }) => {
    const events = await collectAnalytics(page);
    const calls = await mock(page, { list: () => pageBody(MIXED), unread: () => 3, markOne: () => 200 });
    await open(page);
    await rows(page).nth(0).getByRole('link').click();
    await expect(page).toHaveURL(/\/stiri\/stire-1$/);
    await expect.poll(() => calls.markOne).toEqual(['n-news']);
    const ev = (await events()).find((e) => e.name === 'notification_clicked_from_list');
    expect(ev?.params).toEqual({
      notification_type: 'news',
      notification_documentId: 'n-news',
      notification_title: 'Știre nouă',
      redirect_url: '/stiri/stire-1',
    });
  });

  test('c8/c9 a NEW_FOLLOWER row opens the angler; a read row is not marked again', async ({ page }) => {
    const calls = await mock(page, {
      list: () => pageBody([{ ...MIXED[1], read: true }, MIXED[0]]),
      unread: () => 1,
      markOne: () => 200,
    });
    await open(page);
    await rows(page).nth(0).getByRole('link').click();
    await expect(page).toHaveURL(/\/pescari\/pescar-1$/);
    expect(calls.markOne).toEqual([]);
  });

  test('c11 next page: loads as the footer nears, page 2 is asked for, the end is said', async ({ page }) => {
    const p1 = Array.from({ length: 10 }, (_, i) => ({ documentId: `p1-${i}`, read: true, title: `Prima pagină ${i + 1}`, type: 'news', data: { newsId: `s${i}` } }));
    const p2 = Array.from({ length: 3 }, (_, i) => ({ documentId: `p2-${i}`, read: true, title: `A doua pagină ${i + 1}`, type: 'lake:new-lakes' }));
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const calls = await mock(page, {
      list: async (p) => (p === 1 ? pageBody(p1, 1, 2, 13) : (await gate, pageBody(p2, 2, 2, 13))),
      unread: () => 0,
    });
    await open(page);
    await expect(rows(page)).toHaveCount(10);
    await page.getByText('10 din 13 notificări').scrollIntoViewIfNeeded();
    // The footer is in range: page 2 is on its way, the button says so.
    await expect(page.getByRole('button', { name: 'Se încarcă…' })).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/next-page-375.png`, fullPage: true });
    release();
    await expect(rows(page)).toHaveCount(13);
    expect(calls.list.map((u) => u.searchParams.get('pagination[page]'))).toContain('2');
    await expect(page.getByText('Ai ajuns la finalul listei.')).toBeVisible();
    await expect(markAll(page)).toHaveCount(0);
  });

  test('c11 next page repeating the previous page\'s last row (a notification arrived in between): shown once', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    const p1 = Array.from({ length: 10 }, (_, i) => ({ documentId: `p1-${i}`, read: true, title: `Prima pagină ${i + 1}`, type: 'lake:new-lakes' }));
    const p2 = [p1[9], ...Array.from({ length: 3 }, (_, i) => ({ documentId: `p2-${i}`, read: true, title: `A doua pagină ${i + 1}`, type: 'lake:new-lakes' }))];
    // Same row documentId (`row-p1-9`) on both pages, as the CMS's offset paging returns it.
    await mock(page, { list: (p) => (p === 1 ? pageBody(p1, 1, 2, 14) : pageBody(p2, 2, 2, 14)), unread: () => 0 });
    await open(page);
    // At 900px the footer is in range at once: page 2 follows page 1 straight away.
    await page.getByText('Ai ajuns la finalul listei.').scrollIntoViewIfNeeded();
    await expect(page.getByText('Ai ajuns la finalul listei.')).toBeVisible();
    await expect(rows(page)).toHaveCount(13);
    await expect(rows(page).filter({ hasText: 'Prima pagină 10' })).toHaveCount(1);
    expect(errors).toEqual([]);
  });

  test('c11 «Reîmprospătează» refetches the list', async ({ page }) => {
    let title2 = 'Înainte';
    const calls = await mock(page, { list: () => pageBody([{ documentId: 'r1', read: true, title: title2, type: 'lake:new-lakes' }]), unread: () => 0 });
    await open(page);
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).first()).toContainText('Înainte');
    title2 = 'După';
    const before = calls.list.length;
    await page.getByRole('button', { name: 'Reîmprospătează' }).click();
    await expect(rows(page).first()).toContainText('După');
    expect(calls.list.length).toBeGreaterThan(before);
  });

  test('c8/c9 an unread row with no page (booking) is a button: marks it read, logs it, navigates nowhere', async ({ page }) => {
    const events = await collectAnalytics(page);
    const booking: Row = { documentId: 'n-book', read: false, title: 'Rezervare confirmată', type: 'booking:confirmed-angler', data: { bookingId: 'b1' } };
    let read = false;
    const calls = await mock(page, {
      list: () => pageBody([{ ...booking, read }]),
      unread: () => (read ? 0 : 1),
      markOne: () => ((read = true), 200),
    });
    await open(page);
    const button = rows(page).nth(0).getByRole('button');
    await expect(button).toBeVisible();
    // fish: no press feedback without a route (pressStyle opacity 1): no hover, no press fade.
    const look = () => button.evaluate((e) => `${getComputedStyle(e).backgroundColor} ${getComputedStyle(e).opacity}`);
    const rest = await look();
    await button.hover();
    await page.mouse.down();
    expect(await look()).toBe(rest);
    await page.mouse.up();
    await expect.poll(() => calls.markOne).toEqual(['n-book']);
    await expect(rows(page).nth(0)).toHaveAttribute('data-read', 'true');
    await expect(rows(page).nth(0).getByRole('button')).toHaveCount(0);
    await expect(page).toHaveURL(/\/notificari$/);
    await expect(bell(page)).toHaveAttribute('aria-label', 'Notificări');
    const ev = (await events()).find((e) => e.name === 'notification_clicked_from_list');
    expect(ev?.params).toEqual({
      notification_type: 'booking:confirmed-angler',
      notification_documentId: 'n-book',
      notification_title: 'Rezervare confirmată',
      redirect_url: 'none',
    });
  });

  test('c11 a failed next page keeps the loaded rows and says so in the footer; retrying loads it', async ({ page }) => {
    const errors = collectConsoleErrors(page, { ignore: EXPECTED_CONSOLE });
    const p1 = Array.from({ length: 10 }, (_, i) => ({ documentId: `p1-${i}`, read: i > 0, title: `Prima pagină ${i + 1}`, type: 'lake:new-lakes' }));
    const p2 = [{ documentId: 'p2-0', read: true, title: 'A doua pagină 1', type: 'lake:new-lakes' }];
    let fail = true;
    await mock(page, { list: (p) => (p === 1 ? pageBody(p1, 1, 2, 11) : fail ? 500 : pageBody(p2, 2, 2, 11)), unread: () => 1 });
    await open(page);
    await expect(rows(page)).toHaveCount(10);
    await page.getByText('10 din 11 notificări').scrollIntoViewIfNeeded();
    await expect(page.getByText('Nu am putut încărca mai multe notificări.')).toBeVisible({ timeout: 20_000 });
    await expect(rows(page)).toHaveCount(10);
    await expect(page.getByRole('alert').filter({ hasText: 'Serverul nu răspunde' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Reîmprospătează' })).toBeVisible();
    await expect(markAll(page)).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/next-page-error-375.png`, fullPage: true });
    fail = false;
    await page.getByRole('button', { name: /Încearcă din nou|Reîncearcă/ }).last().click();
    await expect(rows(page)).toHaveCount(11);
    expect(errors).toEqual([]);
  });

  test('c11 a failed «Reîmprospătează» keeps the rows and says so in a toast', async ({ page }) => {
    const errors = collectConsoleErrors(page, { ignore: EXPECTED_CONSOLE });
    let fail = false;
    await mock(page, { list: () => (fail ? 500 : pageBody(MIXED)), unread: () => 3 });
    await open(page);
    await expect(rows(page)).toHaveCount(MIXED.length);
    fail = true;
    await page.getByRole('button', { name: 'Reîmprospătează' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Nu am putut reîmprospăta notificările' })).toBeVisible({ timeout: 20_000 });
    await expect(rows(page)).toHaveCount(MIXED.length);
    expect(errors).toEqual([]);
  });

  test('c1 dead session (SESSION_DEAD): no sign-out card — the global handler toasts and sends to sign-in with the way back', async ({ page }) => {
    const errors = collectConsoleErrors(page, { ignore: [/status of 401/] });
    await mock(page, { list: () => ({ status: 401, message: 'Missing or invalid credentials' }), unread: () => 0 });
    await open(page);
    await expect(page).toHaveURL(/\/intra\?next=%2Fnotificari$/, { timeout: 20_000 });
    await expect(page.getByText('Sesiunea ta a expirat. Te rugăm să te autentifici din nou.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Deconectează-te' })).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('c1 error: another 401 (no dead-session message) offers «Deconectează-te», the site sign-out, to sign-in with the way back', async ({ page }) => {
    const errors = collectConsoleErrors(page, { ignore: [/status of 401/, ...EXPECTED_CONSOLE] });
    await mock(page, { list: () => 401, unread: () => 0 });
    await open(page);
    await expect(page.getByRole('alert').filter({ hasText: 'Sesiunea a expirat' })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: 'Încearcă din nou' })).toHaveCount(0);
    await page.screenshot({ path: `${SHOTS}/dead-session-375.png` });
    await expectNoA11yViolations(page);
    // A failed logout leaves the visitor signed in and says so (useSignOut's SIGN_OUT_FAILED toast).
    let logoutFails = true;
    await page.route('**/api/auth/logout', (r) => (logoutFails ? r.fulfill({ status: 500, body: '' }) : r.fallback()));
    await page.getByRole('button', { name: 'Deconectează-te' }).click();
    await expect(page.getByText('A apărut o problemă. Te rugăm să încerci mai târziu.')).toBeVisible();
    await expect(page).toHaveURL(/\/notificari$/);
    logoutFails = false;
    await page.getByRole('button', { name: 'Deconectează-te' }).click();
    await expect(page).toHaveURL(/\/intra\?next=%2Fnotificari$/, { timeout: 30_000 });
    expect(errors).toEqual([]);
  });

  test('wide screens: from 1280 a summary column with the unread count and «Citește tot»; one column below', async ({ page }) => {
    await mock(page, { list: () => pageBody(MIXED), unread: () => 18 });
    await open(page, 1440);
    const summary = page.getByRole('complementary', { name: 'Rezumat' });
    await expect(summary).toBeVisible();
    await expect(summary.getByTestId('notifications-unread-count')).toHaveText('18 necitite');
    await expect(summary.getByRole('button', { name: 'Citește tot' })).toBeVisible();
    await expect(markAll(page)).toHaveCount(1);
    for (const w of [1280, 1440, 1920]) {
      await page.setViewportSize({ width: w, height: 900 });
      await expect(summary).toBeVisible();
      // The list is a readable column (≤ 840), the title above it on the same edge, the summary right
      // after it (24 apart). 1280–1439 the pair starts at the shell's left gutter; from 1440 the pair
      // (840 + 24 + 360) is centred in the shell column (1680 + 2 × 32 gutters, itself centred).
      const box = (await list(page).boundingBox())!;
      const head = (await title(page).boundingBox())!;
      const side = (await summary.boundingBox())!;
      const shellLeft = Math.max(0, (w - 1744) / 2) + 32;
      const shellWidth = Math.min(w, 1744) - 64;
      const groupLeft = w >= 1440 ? shellLeft + (shellWidth - 1224) / 2 : shellLeft;
      expect(box.width).toBeLessThanOrEqual(840);
      expect(Math.abs(box.x - groupLeft)).toBeLessThanOrEqual(1);
      expect(head.x).toBeGreaterThanOrEqual(box.x - 1);
      expect(head.x).toBeLessThan(box.x + 80);
      expect(Math.abs(side.x - (box.x + box.width + 24))).toBeLessThanOrEqual(1);
      await page.screenshot({ path: `${SHOTS}/wide-${w}.png`, fullPage: true });
    }
    await page.setViewportSize({ width: 375, height: 900 });
    await expect(summary).toBeHidden();
    await expect(markAll(page)).toHaveCount(1);
    // The settings gear is a header tool only 768–1279 (☰ holds the row on a phone, the summary from
    // 1280): a fourth phone tool cut «Notificări» to «Notifică…» (seen in the 375 baseline).
    const gear = page.getByRole('main').getByRole('link', { name: 'Setări notificări' });
    await expect(gear).toBeHidden();
    const h1 = (await title(page).boundingBox())!;
    expect(await title(page).evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(true);
    expect(h1.width).toBeGreaterThan(0);
    await page.setViewportSize({ width: 1024, height: 900 });
    await expect(gear).toBeVisible();
    await page.setViewportSize({ width: 375, height: 900 });
    await expectNoA11yViolations(page);
  });

  test('c3 summary and «Citește tot» follow the loaded rows (fish): a count the list cannot back is never shown', async ({ page }) => {
    const allRead = MIXED.map((r) => ({ ...r, read: true }));
    let rowsNow: Row[] = allRead;
    let count = 2;
    let pages = 1;
    await mock(page, { list: (p) => (p === 1 ? pageBody(rowsNow, 1, pages) : new Promise<never>(() => {})), unread: () => count });
    await open(page, 1280);
    const summary = page.getByRole('complementary', { name: 'Rezumat' });
    const refresh = () => page.getByRole('button', { name: 'Reîmprospătează' }).click();
    // Every row loaded and read, the CMS still counts 2 (rows whose notification is gone): no number,
    // no «Citește tot» anywhere — the list is all read.
    await expect(rows(page)).toHaveCount(allRead.length);
    await expect(summary.getByText('Le-ai citit pe toate.')).toBeVisible();
    await expect(summary.getByText(/necitit/)).toHaveCount(0);
    await expect(markAll(page)).toHaveCount(0);
    await page.setViewportSize({ width: 375, height: 900 });
    await expect(markAll(page)).toHaveCount(0);
    // Three unread rows arrive, the count is still the old 2: it cannot back the list — no number
    // (rule 4), never «all read»; the button follows the rows. (A count that covers them, «18
    // necitite» over 3 unread rows, is shown: «wide screens…».)
    rowsNow = MIXED;
    await page.setViewportSize({ width: 1280, height: 900 });
    await refresh();
    await expect(page.locator('[data-unread-dot]')).toHaveCount(3);
    await expect(summary.getByTestId('notifications-unread-count')).toHaveCount(0);
    await expect(summary.getByRole('button', { name: 'Citește tot' })).toBeVisible();
    // All loaded rows read but a page left (it never answers): unknown — neither «all read» nor a
    // number nor the button.
    rowsNow = allRead;
    pages = 2;
    count = 5;
    await refresh();
    await expect(page.locator('[data-unread-dot]')).toHaveCount(0);
    await expect(summary.getByTestId('notifications-unread-count')).toHaveCount(0);
    await expect(markAll(page)).toHaveCount(0);
  });

  test('c10 + c3 an empty list with a dangling unread count says no number and offers no «Citește tot»', async ({ page }) => {
    await mock(page, { list: () => pageBody([]), unread: () => 1 });
    for (const w of [375, 1280]) {
      await open(page, w);
      await expect(page.getByText('Nu există notificări')).toBeVisible();
      await expect(markAll(page)).toHaveCount(0);
      await expect(page.getByText(/necitit/)).toHaveCount(0);
    }
    await expect(page.getByRole('complementary', { name: 'Rezumat' }).getByRole('link', { name: 'Setări notificări' })).toBeVisible();
  });

  test('wide screens: the empty list and a failed first load keep the summary track — the card never stretches or moves', async ({ page }) => {
    const errors = collectConsoleErrors(page, { ignore: EXPECTED_CONSOLE });
    let mode: 'list' | 'empty' | 'error' = 'list';
    await mock(page, { list: () => (mode === 'error' ? 500 : pageBody(mode === 'empty' ? [] : MIXED)), unread: () => 0 });
    const edges: Record<string, { x: number; width: number }> = {};
    for (const m of ['list', 'empty', 'error'] as const) {
      mode = m;
      await open(page, 1440);
      const target =
        m === 'list' ? list(page) : m === 'empty' ? page.getByText('Nu există notificări') : page.getByRole('alert').filter({ hasText: 'Serverul nu răspunde' });
      await expect(target).toBeVisible({ timeout: 20_000 });
      // The body column: the closest ancestor that is the list column (max 840).
      const col = await target.evaluate((e) => {
        let el: HTMLElement | null = e as HTMLElement;
        while (el && !el.className.toString().includes('xl:max-w-210')) el = el.parentElement;
        const r = el!.getBoundingClientRect();
        return { x: r.x, width: r.width };
      });
      edges[m] = col;
      if (m === 'empty') {
        // Nothing to sum up: no status line (the list says it), no button, the settings row.
        const summary = page.getByRole('complementary', { name: 'Rezumat' });
        await expect(summary.getByTestId('notifications-unread-count')).toHaveCount(0);
        await expect(summary.getByRole('button', { name: 'Citește tot' })).toHaveCount(0);
        await expect(summary.getByRole('link', { name: 'Setări notificări' })).toBeVisible();
      }
      await page.screenshot({ path: `${SHOTS}/wide-${m}-1440.png`, fullPage: true });
    }
    expect(edges.empty).toEqual(edges.list);
    expect(edges.error).toEqual(edges.list);
    expect(edges.list.width).toBeLessThanOrEqual(840);
    expect(errors).toEqual([]);
  });

  test('c9 real: a seeded unread row is marked read on the local CMS and opens its page; the seed is removed', async ({ page, request }) => {
    const token = process.env.E2E_STRAPI_API_TOKEN;
    // Never skipped: without the token the test fails and says why.
    expect(token, 'Set E2E_STRAPI_API_TOKEN (LOCAL Strapi full-access API token) in .env.local').toBeTruthy();
    expect(CMS, 'c9 real writes: only against the local CMS').toMatch(/^http:\/\/(localhost|127\.0\.0\.1):1337\//);
    const admin = { authorization: `Bearer ${token}` };
    const me = (await (await request.get(`${CMS}/users/me`, { headers: { authorization: `Bearer ${jwt}` } })).json()) as { id: number; documentId: string };
    const stamp = Date.now();
    const notification = await request.post(`${CMS}/notifications`, {
      headers: admin,
      data: {
        data: {
          title: `E2E c9 ${stamp}`,
          body: 'Rând de test, șters la final.',
          type: 'user:new-follower',
          sentAt: new Date().toISOString(),
          // The QA user's own profile: a page that exists on the web.
          data: { type: 'user:new-follower', followerDocumentId: me.documentId },
        },
      },
    });
    expect(notification.ok()).toBe(true);
    const notificationId = ((await notification.json()) as { data: { documentId: string } }).data.documentId;
    let rowId: string | undefined;
    try {
      const link = await request.post(`${CMS}/notification-users`, {
        headers: admin,
        data: { data: { user: me.id, notification: notificationId, read: false } },
      });
      expect(link.ok()).toBe(true);
      rowId = ((await link.json()) as { data: { documentId: string } }).data.documentId;

      const calls = await mock(page, {});
      await open(page, 1280);
      // The newest notification: page 1, found by its own title, never by an index.
      const target = rows(page).filter({ hasText: `E2E c9 ${stamp}` });
      await expect(target).toHaveCount(1);
      await expect(target).not.toHaveAttribute('data-read', 'true');
      const anchor = target.getByRole('link');
      await expect(anchor).toHaveAttribute('href', `/pescari/${me.documentId}`);
      const mark = page.waitForResponse((r) => r.url().includes(`/notification-users/${notificationId}/mark-as-read`));
      await anchor.click();
      expect((await mark).ok()).toBe(true);
      await expect(page).toHaveURL(new RegExp(`/pescari/${me.documentId}$`));
      expect(calls.markOne).toEqual([notificationId]);
      // The CMS has it read.
      const after = (await (await request.get(`${CMS}/notification-users/${rowId}`, { headers: admin })).json()) as { data: { read: boolean } };
      expect(after.data.read).toBe(true);
    } finally {
      if (rowId) expect((await request.delete(`${CMS}/notification-users/${rowId}`, { headers: admin })).ok()).toBe(true);
      expect((await request.delete(`${CMS}/notifications/${notificationId}`, { headers: admin })).ok()).toBe(true);
    }
  });
});
