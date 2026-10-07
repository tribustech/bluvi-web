import { expect, test, type Page, type Route } from '@playwright/test';
import { qaJwt, signIn } from '../e2e/helpers/session';
import { DEFAULT_MASKS, stabilize, VISUAL_WIDTHS } from './capture';

/*
 * account.notifications (/notificari, T1) — one baseline per state × width (ROADMAP §9). Every
 * state is a route mock of the browser's /api/cms/notification-users* calls (list, unread count),
 * so the pixels never depend on the QA user's real notifications; nothing is written (no state
 * presses a row or «Citește tot»). The viewer is the QA user (the gate needs a real session).
 * The sent time is a <time> (masked by DEFAULT_MASKS); the clock is fixed anyway.
 */

const PATH = '/notificari';
const HEIGHT: Record<number, number> = { 375: 812, 768: 1024, 1280: 800, 1440: 900, 1920: 1080 };
/** The states also captured at 1920 (the list + summary group centred in the shell column). */
const AT_1920 = new Set(['list', 'empty']);
const NOW = new Date('2026-10-07T12:00:00+03:00');

type Row = { id: string; read: boolean; title: string; body?: string; type: string; data?: Record<string, unknown>; sentAt?: string };

const MIXED: Row[] = [
  { id: 'n-news', read: false, title: 'Știre nouă: calendarul concursurilor 2027', body: 'Am publicat calendarul complet al concursurilor de anul viitor.', type: 'news', data: { newsId: 'stire-1' } },
  { id: 'n-follow', read: false, title: 'Ai un urmăritor nou', body: 'Andrei Popescu a început să te urmărească.', type: 'user:new-follower', data: { followerDocumentId: 'pescar-1' } },
  { id: 'n-booking', read: false, title: 'Rezervare confirmată', body: 'Rezervarea ta la Lacul Chița pentru 12 octombrie a fost confirmată.', type: 'booking:confirmed-angler', data: { bookingId: 'b1' } },
  { id: 'n-end', read: true, title: 'Concurs încheiat', body: 'Cupa Toamnei s-a încheiat. Vezi clasamentul final.', type: 'competition:end', data: { competitionId: 'c1' } },
  { id: 'n-sched', read: true, title: 'Mesaj de la Bluvi', body: 'Weekend frumos și fir întins!', type: 'scheduled-notification' },
  { id: 'n-lakes', read: true, title: 'Bălți noi în apropiere', body: 'Am adăugat 3 bălți noi în județul tău.', type: 'lake:new-lakes', sentAt: '2025-12-28T10:00:00.000Z' },
];
const ALL_READ = MIXED.map((r) => ({ ...r, read: true }));
const TEN = Array.from({ length: 10 }, (_, i) => ({
  id: `p1-${i}`,
  read: i > 1,
  title: i % 2 ? 'Bălți noi în apropiere' : 'Concurs încheiat',
  body: i % 2 ? 'Am adăugat bălți noi în județul tău.' : 'Vezi clasamentul final.',
  type: i % 2 ? 'lake:new-lakes' : 'competition:end',
  data: i % 2 ? {} : { competitionId: `c${i}` },
}));
const TAIL = [{ id: 'p2-0', read: true, title: 'Mesaj de la Bluvi', body: 'Weekend frumos și fir întins!', type: 'scheduled-notification' }];

function body(rows: Row[], page = 1, pageCount = 1, total = rows.length) {
  return JSON.stringify({
    data: rows.map((r, i) => ({
      id: 1000 + page * 100 + i,
      documentId: `row-${r.id}`,
      read: r.read,
      readAt: r.read ? '2026-10-01T10:00:00.000Z' : null,
      notification: {
        id: 2000 + page * 100 + i,
        documentId: r.id,
        title: r.title,
        body: r.body ?? 'Detalii',
        sentAt: r.sentAt ?? '2026-10-06T18:31:59.032Z',
        data: { type: r.type, ...(r.data ?? {}) },
        type: r.type,
      },
    })),
    meta: { pagination: { page, pageSize: 10, pageCount, total } },
  });
}

const never = () => new Promise<never>(() => {});

/** list(page) → a body or a status; unread → the top bar's count. */
async function mock(page: Page, list: (p: number) => string | number | Promise<string | number>, unread: number) {
  await page.route(/\/api\/cms\/notification-users(\/|\?|$)/, async (r: Route) => {
    const url = new URL(r.request().url());
    const json = (b: string, status = 200) => r.fulfill({ status, contentType: 'application/json', body: b });
    if (url.pathname.endsWith('/unread')) return json(JSON.stringify({ count: unread }));
    if (r.request().method() === 'GET' && url.pathname.endsWith('/notification-users')) {
      const out = await list(Number(url.searchParams.get('pagination[page]') ?? '1'));
      return typeof out === 'number' ? json(JSON.stringify({ data: null, error: { status: out, message: 'x' } }), out) : json(out);
    }
    return r.abort();
  });
}

const rows = (page: Page) => page.getByRole('list', { name: 'Notificări' }).locator(':scope > li');

interface State {
  name: string;
  mock: (page: Page) => Promise<void>;
  ready: (page: Page) => Promise<void>;
}

/** Bring the footer into view so its observer (or, on keyboards, its button) asks for page 2. */
async function askNextPage(page: Page) {
  await expect(rows(page)).toHaveCount(10);
  await page.getByText(/10 din 11 notificări/).scrollIntoViewIfNeeded();
  const more = page.getByRole('button', { name: 'Încarcă mai multe' });
  if (await more.isVisible().catch(() => false)) await more.click();
}

const STATES: State[] = [
  {
    name: 'loading',
    mock: (page) => mock(page, () => never(), 3),
    ready: (page) => expect(page.getByRole('status').filter({ hasText: 'Se încarcă notificările…' })).toBeAttached(),
  },
  {
    name: 'list',
    mock: (page) => mock(page, () => body(MIXED), 3),
    ready: (page) => expect(rows(page)).toHaveCount(MIXED.length),
  },
  {
    name: 'all-read',
    mock: (page) => mock(page, () => body(ALL_READ), 0),
    ready: async (page) => {
      await expect(rows(page)).toHaveCount(ALL_READ.length);
      await expect(page.getByRole('button', { name: 'Citește tot' })).toHaveCount(0);
    },
  },
  {
    name: 'empty',
    mock: (page) => mock(page, () => body([]), 0),
    ready: (page) => expect(page.getByText('Nu există notificări')).toBeVisible(),
  },
  {
    name: 'error',
    mock: (page) => mock(page, () => 500, 3),
    ready: (page) => expect(page.getByRole('button', { name: 'Încearcă din nou' })).toBeVisible({ timeout: 30_000 }),
  },
  {
    // A 401 without the CMS's dead-session message: no global sign-out (that is only SESSION_DEAD,
    // which keeps the skeleton and redirects), so this card is what the visitor sees and keeps.
    name: 'dead-session',
    mock: (page) => mock(page, () => 401, 0),
    ready: (page) => expect(page.getByRole('button', { name: 'Deconectează-te' })).toBeVisible({ timeout: 30_000 }),
  },
  {
    // Page 2 never answers: the footer stays «Se încarcă…».
    name: 'next-page',
    mock: (page) => mock(page, (p) => (p === 1 ? body(TEN, 1, 2, 11) : never()), 2),
    ready: async (page) => {
      await askNextPage(page);
      await expect(page.getByText('Se încarcă…').last()).toBeVisible();
    },
  },
  {
    name: 'next-page-failed',
    mock: (page) => mock(page, (p) => (p === 1 ? body(TEN, 1, 2, 11) : 500), 2),
    ready: async (page) => {
      await askNextPage(page);
      await expect(page.getByText('Nu am putut încărca mai multe notificări.')).toBeVisible({ timeout: 30_000 });
    },
  },
  {
    name: 'end',
    mock: (page) => mock(page, (p) => (p === 1 ? body(TEN, 1, 2, 11) : body(TAIL, 2, 2, 11)), 2),
    ready: async (page) => {
      // Page 2 answers at once, so the list may already hold 11 rows when it first shows.
      await expect(rows(page).first()).toBeVisible();
      if ((await rows(page).count()) < 11) await askNextPage(page);
      await expect(rows(page)).toHaveCount(11);
      await expect(page.getByText('Ai ajuns la finalul listei.')).toBeVisible();
    },
  },
];

let jwt: string;
test.beforeAll(async ({ request }) => {
  jwt = await qaJwt(request);
});

test.describe(`notificari · ${PATH}`, () => {
  for (const state of STATES) {
    for (const width of [...VISUAL_WIDTHS, ...(AT_1920.has(state.name) ? [1920] : [])]) {
      test(`${state.name} · ${width}px`, async ({ page, context, baseURL }) => {
        await page.setViewportSize({ width, height: HEIGHT[width] });
        // stabilize() waits for networkidle, which a held request never reaches: bound the wait.
        page.setDefaultNavigationTimeout(8_000);
        await page.clock.setFixedTime(NOW);
        await signIn(context, jwt, baseURL);
        await state.mock(page);
        await page.goto(PATH, { waitUntil: 'domcontentloaded' });
        await state.ready(page);
        await stabilize(page);
        await page.mouse.move(0, 0);
        await expect(page).toHaveScreenshot(`notificari-${state.name}-${width}.png`, {
          fullPage: true,
          mask: DEFAULT_MASKS.map((s) => page.locator(s)),
        });
      });
    }
  }
});
