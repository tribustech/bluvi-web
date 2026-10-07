import { expect, test, type Page, type Route } from '@playwright/test';
import { qaJwt, signIn } from '../e2e/helpers/session';
import { DEFAULT_MASKS, stabilize } from './capture';

/*
 * account.angler-profile (/pescari/[id]) — one baseline per state × width (ROADMAP §9). Every state
 * is route-mocked on a made-up angler so the pixels never depend on the local DB, and the clock is
 * fixed (the live session's «Începută acum», the month headers). Nothing is written: the follow
 * POST of «follow-pending» is held by the mock. Signed out the public tabs are read on the server
 * (no page.route there): the made-up id answers [] — the guest state of an angler the browser
 * cannot read, «Intră în cont ca să vezi profilul». The selected tab's first page is prefetched on
 * the server too (where the made-up id answers []), so a signed-in state lands on another tab and
 * picks its own in the browser, where the mocks answer.
 */

const MOCK = 'e2evisualangler000000001';
const PATH = `/pescari/${MOCK}`;
const WIDTHS = [375, 768, 1280, 1440] as const;
const HEIGHT: Record<number, number> = { 375: 812, 768: 1024, 1280: 800, 1440: 900 };
const NOW = new Date('2026-10-07T12:00:00+03:00');

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const never = () => new Promise<void>(() => {});

/** A catch photo: a calm two-stop gradient per catch (water tones), never a network image. */
const HUES = [[24, 78, 99], [38, 102, 76], [70, 92, 120], [92, 74, 52], [28, 60, 88], [60, 110, 96]];
function photoSvg(n: number) {
  const [r, g, b] = HUES[n % HUES.length];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="rgb(${r},${g},${b})"/><stop offset="1" stop-color="rgb(${r + 90},${g + 90},${b + 90})"/></linearGradient></defs><rect width="400" height="400" fill="url(#g)"/></svg>`;
}
const PHOTO = (n: number) => `https://e2e-photos.invalid/catch-${n}.svg`;

function header(patch: Record<string, unknown> = {}) {
  return {
    id: 999003,
    documentId: MOCK,
    username: 'Pescar Vizual',
    avatarUrl: null,
    bio: 'Crap și somn pe #Snagov, noaptea. #feeder_2026',
    memberSince: '2025-03-01T10:00:00.000Z',
    counts: { followers: 25, following: 12, catches: 25, sessions: 2, competitions: 4 },
    biggestCatch: { kg: 12.44, source: 'competition' },
    podium: { first: 1, second: 2, third: 0 },
    isFollowedByMe: false,
    isSelf: false,
    ...patch,
  };
}

const REPUTATION = {
  avgStars: 4.6,
  ratingCount: 2,
  noShowCount: 1,
  areas: { rules: 5, cleanliness: 4, behavior: 5 },
  reviews: [
    { stars: 5, comment: 'Totul curat, a respectat regulile bălții.', authorName: 'Operator Unu', lakeName: 'Balta Test', createdAt: '2026-09-01T10:00:00.000Z', rulesScore: 5, cleanlinessScore: 4, behaviorScore: 5 },
    { stars: 4, comment: null, authorName: 'Operator Doi', lakeName: null, createdAt: '2026-08-01T10:00:00.000Z', rulesScore: null, cleanlinessScore: null, behaviorScore: null, tags: ['respectsRules'] },
  ],
};

function catchItem(n: number) {
  return {
    key: `c-${n}`,
    source: n === 1 ? 'competition' : 'partida',
    photoUrl: PHOTO(n),
    photoGridUrl: PHOTO(n),
    blurhash: null,
    weightKg: n === 1 ? 12.44 : 2 + n / 10,
    species: n === 1 ? 'Crap' : 'Caras',
    venueName: 'Balta Mock',
    date: '2025-09-05T08:00:00.000Z',
    competitionName: n === 1 ? 'Cupa Mock' : null,
    competitionDocumentId: n === 1 ? 'cmp-mock' : null,
  };
}
// 20 with a photo of the header's 25 catches: the grid says «Doar capturile cu fotografie: 20 din 25».
const CATCHES = { data: Array.from({ length: 20 }, (_, i) => catchItem(i + 1)), meta: { pagination: { pageSize: 20, total: 20 }, nextCursor: null } };

const SESSIONS = {
  data: [
    {
      documentId: 'ses-live', venueName: null, photoUrl: null, startedAt: new Date(NOW.getTime() - 2 * 3600_000).toISOString(), durationMs: 0, isActive: true,
      catches: 1, totalKg: 3.2, maxKg: 3.2, isPersonalRecord: false, locality: 'Snagov', standName: 'Stand 4', endedAt: null, photos: [], photoCount: 0,
    },
    {
      documentId: 'ses-done', venueName: 'Balta Mock', photoUrl: null, startedAt: '2025-08-10T06:00:00.000Z', durationMs: 5 * 3600_000, isActive: false,
      catches: 20, totalKg: 41.6, maxKg: 6.2, isPersonalRecord: false, locality: 'Ilfov', standName: null, endedAt: '2025-08-10T11:00:00.000Z',
      photos: [1, 2, 3].map(n => ({ url: PHOTO(n), thumbUrl: PHOTO(n), weightKg: 2 + n })), photoCount: 5,
    },
  ],
  meta: { pagination: { page: 1, pageSize: 10, pageCount: 1, total: 2 } },
};

const COMPETITIONS = {
  data: [
    { competition: { documentId: 'cmp-1', name: 'Cupa de toamnă', startDate: '2025-09-05T06:00:00.000Z', endDate: '2025-09-07T14:00:00.000Z', imageUrl: null, lakeName: 'Balta Mock', competitionType: 'single', rankingType: 'cantitate' }, placement: 1 },
    { competition: { documentId: 'cmp-2', name: 'Maratonul echipelor de la Lacul Mock, ediția a doua', startDate: '2025-09-30T06:00:00.000Z', endDate: '2025-10-02T14:00:00.000Z', imageUrl: null, lakeName: 'Lacul Mock', competitionType: 'team', rankingType: 'cantitate' }, placement: 2 },
    { competition: { documentId: 'cmp-3', name: 'Feeder de primăvară', startDate: '2025-04-10T06:00:00.000Z', endDate: '2025-04-10T14:00:00.000Z', imageUrl: null, lakeName: null, competitionType: 'single', rankingType: 'cantitate' }, placement: 7 },
    { competition: { documentId: 'cmp-4', name: 'Concurs fără clasament', startDate: null, endDate: null, imageUrl: null, lakeName: 'Balta Mock', competitionType: 'single', rankingType: 'cantitate' }, placement: null },
  ],
  meta: { pagination: { page: 1, pageSize: 20, pageCount: 1, total: 4 } },
};
const EMPTY_PAGE = { data: [], meta: { pagination: { page: 1, pageSize: 20, pageCount: 0, total: 0 } } };
const EMPTY_CATCHES = { data: [], meta: { pagination: { pageSize: 20, total: 0 }, nextCursor: null } };

type Lists = { profile?: (r: Route) => unknown; catches?: (r: Route) => unknown; sessions?: (r: Route) => unknown; competitions?: (r: Route) => unknown };

async function mockAngler(page: Page, { profile = header(), reputation = REPUTATION as unknown, lists = {} as Lists } = {}) {
  await page.route('https://e2e-photos.invalid/**', r => {
    const n = Number(/catch-(\d+)/.exec(r.request().url())?.[1] ?? 0);
    return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: photoSvg(n) });
  });
  await page.route(new RegExp(`/feed/anglers/${MOCK}(\\?.*)?$`), r => (lists.profile ? lists.profile(r) : json(r, { data: profile })));
  await page.route(new RegExp(`/feed/users/${MOCK}/reputation`), r => json(r, { data: reputation }));
  await page.route(new RegExp(`/feed/anglers/${MOCK}/catches`), r => (lists.catches ? lists.catches(r) : json(r, CATCHES)));
  await page.route(new RegExp(`/feed/anglers/${MOCK}/sessions`), r => (lists.sessions ? lists.sessions(r) : json(r, SESSIONS)));
  await page.route(new RegExp(`/feed/anglers/${MOCK}/competitions`), r => (lists.competitions ? lists.competitions(r) : json(r, COMPETITIONS)));
}

type Tab = 'Capturi' | 'Partide' | 'Concursuri';

interface State {
  name: string;
  /** The tab captured (Capturi by default). */
  tab?: Tab;
  signedOut?: boolean;
  mock: (page: Page) => Promise<void>;
  ready: (page: Page) => Promise<void>;
  after?: (page: Page) => Promise<void>;
  /** The capture is the viewport (an open dialog), not the full page. */
  viewport?: boolean;
}

const header$ = (page: Page) => expect(page.getByTestId('profile-name').locator('visible=true')).toBeVisible();
const tiles = (page: Page, n: number) => expect(page.getByTestId('catch-tile').locator('visible=true')).toHaveCount(n);

const STATES: State[] = [
  {
    name: 'signed-out',
    signedOut: true,
    mock: page => mockAngler(page),
    ready: page => expect(page.getByText('Intră în cont ca să vezi profilul').first()).toBeVisible(),
  },
  {
    name: 'loading',
    mock: page => mockAngler(page, { lists: { profile: () => never(), catches: () => never() } }),
    ready: page => expect(page.getByTestId('profile-header-skeleton').first()).toBeVisible(),
  },
  {
    name: 'capturi',
    mock: page => mockAngler(page),
    ready: async page => {
      await header$(page);
      await tiles(page, 20);
    },
  },
  {
    name: 'followed',
    mock: page => mockAngler(page, { profile: header({ isFollowedByMe: true, counts: { followers: 26, following: 12, catches: 25, sessions: 2, competitions: 4 } }) }),
    ready: async page => {
      await header$(page);
      await tiles(page, 20);
    },
  },
  {
    // c38: the own documentId — «Editează profilul» in the follow button's place.
    name: 'own',
    mock: page => mockAngler(page, { profile: header({ isSelf: true }) }),
    ready: async page => {
      await header$(page);
      await tiles(page, 20);
    },
  },
  {
    name: 'follow-pending',
    mock: async page => {
      await mockAngler(page);
      await page.route(new RegExp(`/feed/anglers/${MOCK}/follow$`), () => never());
    },
    ready: async page => {
      await header$(page);
      await tiles(page, 20);
    },
    after: async page => {
      await page.getByRole('button', { name: /Urmărește/ }).locator('visible=true').click();
      await expect(page.getByRole('button', { name: /Urmăresc/ }).locator('visible=true')).toHaveAttribute('aria-busy', 'true');
      await page.mouse.move(0, 0);
    },
  },
  {
    name: 'sesiuni',
    tab: 'Partide',
    mock: page => mockAngler(page),
    ready: async page => {
      await header$(page);
      await expect(page.getByTestId('session-card')).toHaveCount(2);
    },
  },
  {
    name: 'concursuri',
    tab: 'Concursuri',
    mock: page => mockAngler(page),
    ready: async page => {
      await header$(page);
      await expect(page.getByTestId('competition-card')).toHaveCount(4);
    },
  },
  {
    name: 'empty',
    mock: page =>
      mockAngler(page, {
        profile: header({ bio: null, podium: { first: 0, second: 0, third: 0 }, biggestCatch: null, counts: { followers: 0, following: 0, catches: 0, sessions: 0, competitions: 0 } }),
        reputation: { avgStars: null, ratingCount: 0, noShowCount: 0, areas: { rules: null, cleanliness: null, behavior: null }, reviews: [] },
        lists: { catches: r => json(r, EMPTY_CATCHES), sessions: r => json(r, EMPTY_PAGE), competitions: r => json(r, EMPTY_PAGE) },
      }),
    ready: page => expect(page.getByText('Nicio captură încă').first()).toBeVisible(),
  },
  {
    name: 'header-error',
    mock: page => mockAngler(page, { lists: { profile: r => json(r, { error: { status: 500, message: 'boom' } }, 500) } }),
    ready: page => expect(page.getByRole('button', { name: /Încearcă din nou|Reîncearcă/ }).first()).toBeVisible({ timeout: 30_000 }),
  },
  {
    name: 'not-found',
    mock: page => mockAngler(page, { lists: { profile: r => json(r, { data: null, error: { status: 404, name: 'NotFoundError', message: 'Not Found' } }, 404) } }),
    ready: page => expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 30_000 }),
  },
  {
    name: 'lightbox',
    viewport: true,
    mock: page => mockAngler(page),
    ready: async page => {
      await header$(page);
      await tiles(page, 20);
    },
    after: async page => {
      await page.getByTestId('catch-tile').locator('visible=true').first().click();
      await expect(page.getByTestId('catch-footer')).toBeVisible();
    },
  },
  {
    name: 'reputation',
    viewport: true,
    mock: page => mockAngler(page),
    ready: header$,
    after: async page => {
      await page.getByTestId('profile-rating-pill').locator('visible=true').click();
      await expect(page.getByRole('dialog', { name: 'Reputație' })).toBeVisible();
      await expect(page.getByText('Operator Unu')).toBeVisible();
    },
  },
];

let jwt: string;

test.beforeAll(async ({ request }) => {
  jwt = await qaJwt(request);
});

test.describe(`pescar · ${PATH}`, () => {
  for (const state of STATES) {
    for (const width of WIDTHS) {
      test(`${state.name} · ${width}px`, async ({ page, context, baseURL }) => {
        await page.setViewportSize({ width, height: HEIGHT[width] });
        page.setDefaultNavigationTimeout(8_000);
        await page.clock.setFixedTime(NOW);
        if (!state.signedOut) await signIn(context, jwt, baseURL);
        await state.mock(page);
        const tab = state.tab ?? 'Capturi';
        if (state.signedOut || state.name === 'not-found') {
          await page.goto(PATH, { waitUntil: 'domcontentloaded' });
        } else {
          // Land on another tab (its server prefetch is the made-up id's []), then pick this one.
          await page.goto(`${PATH}?tab=${tab === 'Concursuri' ? 'sesiuni' : 'concursuri'}`, { waitUntil: 'domcontentloaded' });
          const target = page.getByRole('tab', { name: new RegExp(`^${tab}(, \\d+)?$`) });
          await expect(target).toBeVisible({ timeout: 30_000 });
          // A press before hydration does nothing: press until the tab is the selected one.
          await expect(async () => {
            await target.click();
            await expect(target).toHaveAttribute('aria-selected', 'true', { timeout: 1_000 });
          }).toPass({ timeout: 30_000 });
        }
        await state.ready(page);
        await stabilize(page);
        await state.after?.(page);
        await expect(page).toHaveScreenshot(`pescar-${state.name}-${width}.png`, {
          fullPage: !state.viewport,
          mask: DEFAULT_MASKS.map(s => page.locator(s)),
        });
      });
    }
  }
});
