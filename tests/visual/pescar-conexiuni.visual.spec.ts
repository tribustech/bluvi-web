import { expect, test, type Page, type Route } from '@playwright/test';
import { CMS, qaJwt, signIn } from '../e2e/helpers/session';
import { DEFAULT_MASKS, stabilize } from './capture';

/*
 * account.connections (/pescari/[id]/conexiuni) — one baseline per state × width (ROADMAP §9).
 * Every state is route-mocked on a made-up angler so the pixels never depend on the local DB:
 * loading, followers list, following list, empty per tab, error + retry card, the next-page
 * footer, the viewer's own row (no follow button) and a row just followed. The follow POST is
 * answered by the mock: nothing is written anywhere. The viewer is the QA user (the gate needs a
 * real session); its documentId is the «own row».
 */

const MOCK = 'e2emockconnections000001';
const PATH = `/pescari/${MOCK}/conexiuni`;
const WIDTHS = [375, 1280, 1440, 1920] as const;
const HEIGHT: Record<number, number> = { 375: 812, 1280: 800, 1440: 900, 1920: 1080 };

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const never = () => new Promise<void>(() => {});

const NAMES = [
  'Andrei Popescu', 'mihai_crap', 'Ioana Dumitrescu', 'Radu', 'Cristian Stănescu', 'Elena Mureșan', 'florin.feeder',
  'Alexandru Constantinescu-Vlădescu', 'George Ionescu', 'Bogdan', 'Ștefan Pătrașcu', 'Ana Maria Rusu', 'vlad_pescarul',
  'Daniel Toma', 'Sorin Bălan', 'Marius Tudor', 'Paul Neagu', 'Cătălin Ene', 'Liviu Oprea', 'Tudor Marin',
];

const row = (n: number) => ({
  documentId: `e2econn${String(n).padStart(17, '0')}`,
  username: NAMES[(n - 1) % NAMES.length],
  avatarUrl: null,
  isFollowedByMe: n % 3 === 0,
});
const list = (n: number, total = n, pageCount = 1) => ({
  data: Array.from({ length: n }, (_, i) => row(i + 1)),
  meta: { pagination: { page: 1, pageSize: 20, pageCount, total } },
});
const EMPTY = { data: [], meta: { pagination: { page: 1, pageSize: 20, pageCount: 0, total: 0 } } };

type ListMock = (route: Route, page: number) => Promise<void> | void;

async function mockAngler(
  page: Page,
  {
    counts = { followers: 12, following: 7 },
    followers = r => json(r, list(12)),
    following = r => json(r, list(7)),
  }: { counts?: { followers: number; following: number }; followers?: ListMock; following?: ListMock } = {},
) {
  await page.route(new RegExp(`/feed/anglers/${MOCK}(\\?.*)?$`), r =>
    json(r, {
      data: {
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
      },
    }),
  );
  await page.route(new RegExp(`/feed/users/${MOCK}/reputation`), r => json(r, { data: null }));
  for (const kind of ['followers', 'following'] as const) {
    await page.route(new RegExp(`/feed/anglers/${MOCK}/${kind}`), r => {
      const p = Number(new URL(r.request().url()).searchParams.get('page') ?? 1);
      return (kind === 'followers' ? followers : following)(r, p);
    });
  }
}

const rows = (page: Page) => page.locator('[data-testid="connection-row"]:visible');

interface State {
  name: string;
  query?: string;
  mock: (page: Page, ctx: { selfId: string }) => Promise<void>;
  ready: (page: Page) => Promise<void>;
  after?: (page: Page) => Promise<void>;
}

const STATES: State[] = [
  {
    name: 'loading',
    mock: page => mockAngler(page, { followers: () => never() }),
    ready: async page => {
      // The client list's skeleton, not the gate's fallback (which has no real «Înapoi»).
      await expect(page.getByRole('button', { name: 'Înapoi' })).toBeVisible();
      await expect(page.locator('[data-testid="connections-skeleton"]:visible')).toHaveCount(1);
      await expect(page.getByTestId('connections-owner')).toBeVisible();
    },
  },
  {
    name: 'followers',
    mock: page => mockAngler(page),
    ready: page => expect(rows(page)).toHaveCount(12),
  },
  {
    name: 'following',
    query: '?tab=urmareste',
    mock: page => mockAngler(page),
    ready: page => expect(rows(page)).toHaveCount(7),
  },
  {
    name: 'empty-followers',
    mock: page => mockAngler(page, { counts: { followers: 0, following: 0 }, followers: r => json(r, EMPTY) }),
    ready: page => expect(page.getByText('Niciun urmăritor încă')).toBeVisible(),
  },
  {
    name: 'empty-following',
    query: '?tab=urmareste',
    mock: page => mockAngler(page, { counts: { followers: 0, following: 0 }, following: r => json(r, EMPTY) }),
    ready: page => expect(page.getByText('Nu urmărește pe nimeni încă')).toBeVisible(),
  },
  {
    name: 'error',
    mock: page => mockAngler(page, { followers: r => json(r, { error: { status: 500, message: 'boom' } }, 500) }),
    ready: page => expect(page.getByRole('button', { name: 'Încearcă din nou' })).toBeVisible({ timeout: 30_000 }),
  },
  {
    // Page 2 never answers: the footer stays «Se încarcă…» at every width (the phone presses it).
    name: 'next-page',
    mock: page => mockAngler(page, { counts: { followers: 25, following: 7 }, followers: (r, p) => (p === 2 ? never() : json(r, list(20, 25, 2))) }),
    ready: async page => {
      await expect(rows(page)).toHaveCount(20);
      const more = page.getByRole('button', { name: 'Încarcă mai multe' });
      if (await more.isVisible()) await more.click();
      await expect(page.getByRole('button', { name: 'Se încarcă…' })).toBeVisible();
    },
  },
  {
    name: 'own-row',
    mock: (page, { selfId }) =>
      mockAngler(page, {
        followers: r => {
          const body = list(6);
          body.data[1] = { documentId: selfId, username: 'Contul QA', avatarUrl: null, isFollowedByMe: false };
          return json(r, body);
        },
      }),
    ready: page => expect(rows(page)).toHaveCount(6),
  },
  {
    name: 'followed-toggle',
    mock: async page => {
      await mockAngler(page, { followers: r => json(r, list(6)) });
      await page.route(/\/feed\/anglers\/e2econn\d+\/follow$/, r => json(r, { following: true, followersCount: 1 }));
    },
    ready: page => expect(rows(page)).toHaveCount(6),
    after: async page => {
      const first = rows(page).first();
      await first.getByRole('button', { name: /Urmărește/ }).click();
      await expect(first.getByRole('button', { name: /Urmăresc/ })).toBeVisible();
      await expect(first.getByRole('button', { name: /Urmăresc/ })).not.toHaveAttribute('aria-disabled', 'true');
      await page.mouse.move(0, 0);
    },
  },
];

let jwt: string;
let selfId: string;

test.beforeAll(async ({ request }) => {
  jwt = await qaJwt(request);
  const me = await request.get(`${CMS}/user/profile`, { headers: { authorization: `Bearer ${jwt}` } });
  expect(me.ok(), 'QA profile read').toBe(true);
  selfId = (await me.json()).documentId as string;
});

test.describe(`pescar-conexiuni · ${PATH}`, () => {
  for (const state of STATES) {
    for (const width of WIDTHS) {
      test(`${state.name} · ${width}px`, async ({ page, context, baseURL }) => {
        await page.setViewportSize({ width, height: HEIGHT[width] });
        // stabilize() waits for networkidle, which a held request never reaches: bound the wait.
        page.setDefaultNavigationTimeout(8_000);
        await signIn(context, jwt, baseURL);
        await state.mock(page, { selfId });
        await page.goto(`${PATH}${state.query ?? ''}`, { waitUntil: 'domcontentloaded' });
        await state.ready(page);
        await stabilize(page);
        await state.after?.(page);
        await expect(page).toHaveScreenshot(`pescar-conexiuni-${state.name}-${width}.png`, {
          fullPage: true,
          mask: DEFAULT_MASKS.map(s => page.locator(s)),
        });
      });
    }
  }
});
