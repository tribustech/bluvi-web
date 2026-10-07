import { expect, test, type Page, type Route } from '@playwright/test';
import { CMS, qaJwt, signIn } from '../e2e/helpers/session';
import { DEFAULT_MASKS, stabilize } from './capture';

/*
 * partide.pescari (/pescari) — one baseline per state × width (ROADMAP §9). Every state is
 * route-mocked (/api/cms/feed/anglers/suggested and /search) so the pixels never depend on the
 * local DB: loading, browse (friends-of-follows + recently active, the viewer's own row, a followed
 * one), nobody active, results with the next-page footer, no results, and a failed search.
 * The viewer is the QA user (the gate needs a real session). Nothing is written anywhere.
 */

const WIDTHS = [375, 1280, 1440, 1920] as const;
const HEIGHT: Record<number, number> = { 375: 812, 1280: 800, 1440: 900, 1920: 1080 };
const SUGGESTED = /\/api\/cms\/feed\/anglers\/suggested(\?|$)/;
const SEARCH = /\/api\/cms\/feed\/anglers\/search/;

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const never = () => new Promise<void>(() => {});

const NAMES = [
  'Andrei Popescu', 'mihai_crap', 'Ioana Dumitrescu', 'Radu', 'Cristian Stănescu', 'Elena Mureșan', 'florin.feeder',
  'Alexandru Constantinescu-Vlădescu', 'George Ionescu', 'Bogdan', 'Ștefan Pătrașcu', 'Ana Maria Rusu', 'vlad_pescarul',
  'Daniel Toma', 'Sorin Bălan', 'Marius Tudor', 'Paul Neagu', 'Cătălin Ene', 'Liviu Oprea', 'Tudor Marin',
];
const SUBLINES = ['Partidă acum 2 zile · Balta Chita', '12 urmăritori', 'Partidă acum 14 zile · Lacul Snagov', 'Niciun urmăritor încă'];

const angler = (n: number, extra: Record<string, unknown> = {}) => ({
  documentId: `e2evispesc${String(n).padStart(14, '0')}`,
  username: NAMES[(n - 1) % NAMES.length],
  avatarUrl: null,
  isFollowedByMe: n % 5 === 0,
  subline: SUBLINES[(n - 1) % SUBLINES.length],
  ...extra,
});
const page_ = (data: unknown[], page: number, pageCount: number, total: number) => ({ data, meta: { pagination: { page, pageSize: 20, pageCount, total } } });
const EMPTY = page_([], 1, 0, 0);

const rows = (page: Page) => page.locator('[data-testid="angler-row"]:visible');

interface State {
  name: string;
  query?: string;
  mock: (page: Page, ctx: { self: { documentId: string; username: string } }) => Promise<void>;
  ready: (page: Page) => Promise<void>;
}

const browse = (selfRow: { documentId: string; username: string }) => ({
  friendsOfFollows: [
    angler(1, { subline: 'Urmărit de Ioana Dumitrescu' }),
    angler(2, { subline: 'Urmărit de Radu și încă 3' }),
    angler(3, { subline: 'Urmărit de Bogdan' }),
  ],
  recentlyActive: page_(
    [
      ...Array.from({ length: 4 }, (_, i) => angler(i + 4)),
      { documentId: selfRow.documentId, username: 'Contul QA', avatarUrl: null, isFollowedByMe: false, subline: 'Partidă acum 1 zi · Balta Chita' },
      ...Array.from({ length: 9 }, (_, i) => angler(i + 8)),
    ],
    1,
    1,
    14,
  ),
});

const STATES: State[] = [
  {
    name: 'loading',
    mock: async (page) => {
      await page.route(SUGGESTED, () => never());
    },
    ready: async (page) => {
      await expect(page.getByRole('button', { name: 'Înapoi' })).toBeVisible();
      await expect(page.locator('[data-testid="anglers-skeleton"]:visible')).toHaveCount(1);
    },
  },
  {
    name: 'browse',
    mock: async (page, { self }) => {
      await page.route(SUGGESTED, (r) => json(r, { data: browse(self) }));
    },
    ready: (page) => expect(rows(page)).toHaveCount(17),
  },
  {
    name: 'browse-empty',
    mock: async (page) => {
      await page.route(SUGGESTED, (r) => json(r, { data: { friendsOfFollows: [], recentlyActive: EMPTY } }));
    },
    ready: (page) => expect(page.getByText('Niciun pescar găsit.')).toBeVisible(),
  },
  {
    // Page 2 never answers; the footer reads «20 din 34 de pescari».
    name: 'results',
    query: '?q=pesc',
    mock: async (page, { self }) => {
      await page.route(SUGGESTED, (r) => json(r, { data: browse(self) }));
      await page.route(SEARCH, (r) => {
        const p = Number(new URL(r.request().url()).searchParams.get('page') ?? 1);
        return p === 1 ? json(r, page_(Array.from({ length: 20 }, (_, i) => angler(i + 1)), 1, 2, 34)) : never();
      });
    },
    ready: async (page) => {
      await expect(rows(page)).toHaveCount(20);
      await expect(page.getByText('20 din 34 de pescari')).toBeVisible();
    },
  },
  {
    name: 'no-results',
    query: '?q=zzz',
    mock: async (page, { self }) => {
      await page.route(SUGGESTED, (r) => json(r, { data: browse(self) }));
      await page.route(SEARCH, (r) => json(r, EMPTY));
    },
    ready: (page) => expect(page.getByText('Niciun pescar găsit.')).toBeVisible(),
  },
  {
    name: 'error',
    query: '?q=eroare',
    mock: async (page, { self }) => {
      await page.route(SUGGESTED, (r) => json(r, { data: browse(self) }));
      await page.route(SEARCH, (r) => json(r, { error: { status: 500, message: 'boom' } }, 500));
    },
    ready: (page) => expect(page.getByRole('button', { name: 'Încearcă din nou' })).toBeVisible({ timeout: 30_000 }),
  },
];

let jwt: string;
let self: { documentId: string; username: string };

test.beforeAll(async ({ request }) => {
  jwt = await qaJwt(request);
  const me = await request.get(`${CMS}/user/profile`, { headers: { authorization: `Bearer ${jwt}` } });
  expect(me.ok(), 'QA profile read').toBe(true);
  const body = await me.json();
  self = { documentId: body.documentId, username: body.username };
});

test.describe('pescari-cauta · /pescari', () => {
  for (const state of STATES) {
    for (const width of WIDTHS) {
      test(`${state.name} · ${width}px`, async ({ page, context, baseURL }) => {
        await page.setViewportSize({ width, height: HEIGHT[width] });
        // stabilize() waits for networkidle, which a held request never reaches: bound the wait.
        page.setDefaultNavigationTimeout(8_000);
        await signIn(context, jwt, baseURL);
        await state.mock(page, { self });
        await page.goto(`/pescari${state.query ?? ''}`, { waitUntil: 'domcontentloaded' });
        await state.ready(page);
        await stabilize(page);
        await page.mouse.move(0, 0);
        await expect(page).toHaveScreenshot(`pescari-cauta-${state.name}-${width}.png`, {
          fullPage: true,
          mask: DEFAULT_MASKS.map((s) => page.locator(s)),
        });
      });
    }
  }
});
