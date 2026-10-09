import { expect, test, type Page, type Request, type Route } from '@playwright/test';
import { expectNoA11yViolations } from './helpers/a11y';
import { collectConsoleErrors } from './helpers/console';
import { BASE_URL } from './helpers/base-url';
import { CMS, qaJwt, signIn } from './helpers/session';

/*
 * account.angler-profile (/pescari/[id], T3) + account.b.guest-follow + account.b.deep-link-angler.
 * fish: app/(app)/anglers/[documentId]/index.tsx → components/profile/AnglerProfileScreen.tsx.
 *
 * Data: the local QA user against the LOCAL CMS.
 *  - REAL: Andrew R (ANDREW_R — sessions, competitions, a rating, no podium), Alexandru_Test (MANY —
 *    285 public sessions: real paging), the QA user's own id (SELF), qa_angler2_e2e (FOLLOW — the
 *    one profile a test really follows; unfollowed again in afterEach, verified through the API).
 *  - MOCKED: a made-up id (MOCK) whose header, reputation and tab lists are route-mocked, for the
 *    states the local DB lacks (podiums, bio with hashtags, a live session, a legacy review,
 *    a second page of catches, duplicates across pages). The selected tab's first page is read on
 *    the SERVER (cached public read) — a browser route cannot answer it — so mocked tabs are always
 *    reached by switching to them in the browser.
 * Firestore is never touched by this page.
 */

const ANDREW_R = 'vsfh2zhq9fkie6njt0ciok5u';
const MANY = 'yyo7xoeww34ifa9fj0p069jg';
const FOLLOW = 'yx3qnqgkbn80g7gwxbisiztv';
const MOCK = 'e2emockangler00000000001';
const UNKNOWN = 'e2eunknownangler000000001';
const AXE_WIDTHS = [375, 768, 1280, 1440] as const;
/** Failed requests the specs provoke on purpose (mocked 404/500) are logged by the browser. */
const EXPECTED_CONSOLE = [/Failed to load resource: the server responded with a status of (401|404|500)/];

let jwt: string;
let selfId: string;
let followed = false;

test.beforeAll(async ({ request }) => {
  jwt = await qaJwt(request);
  const me = await request.get(`${CMS}/user/profile`, { headers: { authorization: `Bearer ${jwt}` } });
  expect(me.ok(), 'QA profile read').toBe(true);
  selfId = (await me.json()).documentId as string;
});

test.afterEach(async ({ request }) => {
  if (!followed) return;
  followed = false;
  const headers = { authorization: `Bearer ${jwt}` };
  await request.post(`${CMS}/feed/anglers/${FOLLOW}/unfollow`, { headers });
  const after = await request.get(`${CMS}/feed/anglers/${FOLLOW}`, { headers });
  expect((await after.json()).data.isFollowedByMe, 'follow undone').toBe(false);
});

/* ------------------------------------------------------------------------------------------------
 * Fixtures for the mocked angler
 * ---------------------------------------------------------------------------------------------- */

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEUlEQVR4nGM4YWODFTEMLQkAZZlQAVIPr1MAAAAASUVORK5CYII=',
  'base64',
);
const PHOTO = (n: number) => `https://e2e-photos.invalid/catch-${n}.png`;

function header(patch: Record<string, unknown> = {}) {
  return {
    id: 999001,
    documentId: MOCK,
    username: 'Pescar Mock',
    avatarUrl: null,
    bio: 'Crap și somn pe #Snagov, noaptea. #feeder_2026',
    memberSince: '2025-03-01T10:00:00.000Z',
    counts: { followers: 3, following: 2, catches: 25, sessions: 2, competitions: 4 },
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
    // Legacy: three sub-scores → their exact mean (4,7), not the rounded stars.
    { stars: 5, comment: 'Totul curat.', authorName: 'Operator Unu', lakeName: 'Balta Test', createdAt: '2026-09-01T10:00:00.000Z', rulesScore: 5, cleanlinessScore: 4, behaviorScore: 5 },
    // An unknown tag key (a newer CMS) is dropped; the known one is labelled.
    { stars: 4, comment: null, authorName: 'Operator Doi', lakeName: null, createdAt: '2026-08-01T10:00:00.000Z', rulesScore: null, cleanlinessScore: null, behaviorScore: null, tags: ['respectsRules', 'e2eUnknownTag'] },
  ],
};
const NO_REPUTATION = { avgStars: null, ratingCount: 0, noShowCount: 0, areas: { rules: null, cleanliness: null, behavior: null }, reviews: [] };

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

/** Page 1: catches 1–20 (cursor «p2»); page 2: 21–25 plus a repeat of 20 (shown once, c34). */
function catchesPage(cursor: string | null) {
  const ids = cursor === 'p2' ? [20, 21, 22, 23, 24, 25] : Array.from({ length: 20 }, (_, i) => i + 1);
  return { data: ids.map(catchItem), meta: { pagination: { pageSize: 20, total: 25 }, nextCursor: cursor === 'p2' ? null : 'p2' } };
}

const now = Date.now();
const SESSIONS = {
  data: [
    {
      documentId: 'ses-live',
      venueName: null,
      photoUrl: null,
      startedAt: new Date(now - 2 * 3600_000).toISOString(),
      durationMs: 0,
      isActive: true,
      catches: 1,
      totalKg: 3.2,
      maxKg: 3.2,
      isPersonalRecord: false,
      locality: 'Snagov',
      standName: 'Stand 4',
      endedAt: null,
      photos: [],
      photoCount: 0,
    },
    {
      documentId: 'ses-done',
      venueName: 'Balta Mock',
      photoUrl: null,
      startedAt: '2025-08-10T06:00:00.000Z',
      durationMs: 5 * 3600_000,
      isActive: false,
      catches: 20,
      totalKg: null,
      maxKg: null,
      isPersonalRecord: false,
      locality: null,
      standName: null,
      // No endedAt (a session predating it): the footer's range is omitted, never a made-up one.
      endedAt: null,
      photos: [{ url: PHOTO(1), thumbUrl: PHOTO(1), weightKg: 2.1 }],
      photoCount: 1,
    },
  ],
  meta: { pagination: { page: 1, pageSize: 10, pageCount: 1, total: 2 } },
};

function competitions(filter: string | null) {
  const all = [
    { competition: { documentId: 'cmp-1', name: 'Cupa de toamnă', startDate: '2025-09-05T06:00:00.000Z', endDate: '2025-09-07T14:00:00.000Z', imageUrl: null, lakeName: 'Balta Mock', competitionType: 'single', rankingType: 'cantitate' }, placement: 1 },
    { competition: { documentId: 'cmp-2', name: 'Maratonul echipelor', startDate: '2025-09-30T06:00:00.000Z', endDate: '2025-10-02T14:00:00.000Z', imageUrl: null, lakeName: 'Lacul Mock', competitionType: 'team', rankingType: 'cantitate' }, placement: 2 },
    { competition: { documentId: 'cmp-3', name: 'Feeder de primăvară', startDate: '2025-04-10T06:00:00.000Z', endDate: '2025-04-10T14:00:00.000Z', imageUrl: null, lakeName: null, competitionType: 'single', rankingType: 'cantitate' }, placement: 7 },
    { competition: { documentId: 'cmp-4', name: 'Concurs fără clasament', startDate: null, endDate: null, imageUrl: null, lakeName: 'Balta Mock', competitionType: 'single', rankingType: 'cantitate' }, placement: null },
  ];
  const data = filter === 'team' ? all.filter(i => i.competition.competitionType === 'team') : filter === 'podium' ? [] : all;
  return { data, meta: { pagination: { page: 1, pageSize: 20, pageCount: data.length ? 1 : 0, total: data.length } } };
}

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

/** Everything the mocked angler's page reads in the browser. Returns the requests seen per list. */
async function mockAngler(page: Page, { profile = header(), reputation = REPUTATION as unknown, delayHeaderMs = 0 } = {}) {
  const seen = { profile: 0, catches: [] as string[], sessions: [] as string[], competitions: [] as string[] };
  await page.route('https://e2e-photos.invalid/**', r => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
  await page.route(new RegExp(`/feed/anglers/${MOCK}(\\?.*)?$`), async r => {
    seen.profile++;
    if (delayHeaderMs) await new Promise(res => setTimeout(res, delayHeaderMs));
    await json(r, { data: profile });
  });
  await page.route(new RegExp(`/feed/users/${MOCK}/reputation`), r => json(r, { data: reputation }));
  await page.route(new RegExp(`/feed/anglers/${MOCK}/catches`), r => {
    seen.catches.push(r.request().url());
    return json(r, catchesPage(new URL(r.request().url()).searchParams.get('cursor')));
  });
  await page.route(new RegExp(`/feed/anglers/${MOCK}/sessions`), r => {
    seen.sessions.push(r.request().url());
    return json(r, SESSIONS);
  });
  await page.route(new RegExp(`/feed/anglers/${MOCK}/competitions`), r => {
    seen.competitions.push(r.request().url());
    return json(r, competitions(new URL(r.request().url()).searchParams.get('filter')));
  });
  return seen;
}

async function asUser(page: Page) {
  await signIn(page.context(), jwt);
}

/** A tab by its label; signed in, Partide/Concursuri also speak their count badge («Concursuri, 4»). */
const tab = (page: Page, name: string) => page.getByRole('tab', { name: new RegExp(`^${name}(, \\d+)?$`) });
const GUEST_EMPTY = 'Intră în cont ca să vezi profilul';

/* ------------------------------------------------------------------------------------------------
 * Signed out (c1 web deviation, account.b.guest-follow)
 * ---------------------------------------------------------------------------------------------- */

test.describe('signed out', () => {
  test('c1: public tabs + one quiet sign-in row with one secondary CTA, no header, no count badges; noindex; the tab is in the server HTML', async ({ page, request }) => {
    const errors = collectConsoleErrors(page, { ignore: EXPECTED_CONSOLE });
    const html = await (await request.get(`/pescari/${ANDREW_R}?tab=concursuri`)).text();
    expect(html, 'the selected tab is in the server render').toContain('data-testid="competition-card"');

    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`/pescari/${ANDREW_R}?tab=concursuri`);
    const hint = page.getByTestId('guest-hint');
    await expect(hint).toContainText('Intră ca să vezi pescarul');
    // One CTA: the follow button (account.b.guest-follow) — no second «Intră în cont» doing the same —
    // in the secondary look (rule 18: one quiet hint), never the filled accent profile button.
    await expect(hint.getByRole('link')).toHaveCount(0);
    await expect(hint.getByRole('button')).toHaveCount(1);
    await expect(hint.getByRole('button')).toHaveClass(/bg-accent-tint-2/);
    await expect(hint.getByRole('button')).not.toHaveClass(/(^|\s)bg-accent(\s|$)/);
    // One line at 375, clear of the back / refresh chips above it.
    const line = (await hint.locator('p').boundingBox())!;
    expect(line.height, 'the hint fits one line at 375').toBeLessThan(30);
    const chips = (await page.getByRole('button', { name: 'Înapoi', exact: true }).boundingBox())!;
    const cta = (await hint.getByRole('button').boundingBox())!;
    expect(cta.y - (chips.y + chips.height), 'space under the chip row').toBeGreaterThanOrEqual(12);
    // Rule 4: no count badges for a guest (we do not know the totals).
    await expect(page.getByRole('tab', { name: 'Concursuri', exact: true })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Partide', exact: true })).toBeVisible();
    await expect(page.getByTestId('profile-header')).toHaveCount(0);
    await expect(page.getByTestId('competition-card').first()).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    await expect(page.locator('script[type="application/ld+json"]', { hasText: '"Person"' })).toHaveCount(0);

    // The hint is one compact row on a phone: the list starts above the fold at 375×812.
    const card = (await page.getByTestId('competition-card').first().boundingBox())!;
    expect(card.y, 'first card above the fold').toBeLessThan(812 - 80);
    // ≥1280 the hint's button is full width in the identity card, like the signed-in follow button.
    await page.setViewportSize({ width: 1440, height: 900 });
    const [aside, btn] = await Promise.all([page.getByRole('complementary').boundingBox(), hint.getByRole('button').boundingBox()]);
    expect(btn!.width).toBeGreaterThan(aside!.width - 2 * 24 - 2);

    for (const width of AXE_WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      await expectNoA11yViolations(page);
    }
    expect(errors).toEqual([]);
  });

  test('account.b.guest-follow: the follow button opens sign-in with this page as the way back; nothing is posted', async ({ page }) => {
    const posts: string[] = [];
    page.on('request', (r: Request) => {
      if (r.method() === 'POST' && /\/follow$/.test(r.url())) posts.push(r.url());
    });
    await page.goto(`/pescari/${ANDREW_R}?tab=sesiuni`);
    await page.getByTestId('guest-hint').getByRole('button', { name: /Urmărește/ }).click();
    await page.waitForURL(/\/intra\?/);
    expect(decodeURIComponent(page.url())).toContain(`next=/pescari/${ANDREW_R}?tab=sesiuni`);
    expect(posts).toEqual([]);
  });

  test('c35: guest → follow → sign in → back leaves the profile in one press', async ({ page }) => {
    // The sign-in route is answered in the browser (sets the session cookie): the local CMS rate
    // limits POST /auth/local, and the token is already cached.
    await page.route('**/api/auth/local', async r => {
      await signIn(page.context(), jwt);
      await json(r, { ok: true });
    });
    // The back control is the phone / tablet header's (from 1280 the breadcrumb is the way back).
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await page.goto(`/pescari/${ANDREW_R}`);
    await page.getByTestId('guest-hint').getByRole('button', { name: /Urmărește/ }).click();
    await page.waitForURL(/\/intra\?/);
    await page.getByLabel('Email').fill('qa@example.invalid');
    await page.getByLabel('Parolă').fill('x');
    await page.getByRole('button', { name: 'Intră', exact: true }).last().click();
    await page.waitForURL(new RegExp(`/pescari/${ANDREW_R}$`));
    await expect(page.getByTestId('profile-header')).toBeVisible();
    await page.getByRole('button', { name: 'Înapoi', exact: true }).click();
    await page.waitForURL(u => new URL(u).pathname === '/');
  });

  test('sitemap leaves angler profiles out until the public header exists', async ({ request }) => {
    const res = await request.get('/sitemap.xml');
    if (res.ok()) expect(await res.text()).not.toContain('/pescari/');
  });
});

/* ------------------------------------------------------------------------------------------------
 * Deep links (account.b.deep-link-angler)
 * ---------------------------------------------------------------------------------------------- */

test.describe('deep links', () => {
  test('legacy /anglers/<id> → 308 /pescari/<id>', async ({ request }) => {
    const res = await request.get(`/anglers/${ANDREW_R}`, { maxRedirects: 0 });
    expect(res.status()).toBe(308);
    expect(res.headers().location).toBe(`/pescari/${ANDREW_R}`);
  });

  test('fish /anglers/suggested and /anglers/<id>/connections?tab=… → the web pages, never an angler named «suggested»', async ({ request }) => {
    const cases: [string, string][] = [
      ['/anglers/suggested', '/pescari/sugerati'],
      [`/anglers/${ANDREW_R}/connections?tab=followers`, `/pescari/${ANDREW_R}/conexiuni?tab=urmaritori`],
      [`/anglers/${ANDREW_R}/connections?tab=following`, `/pescari/${ANDREW_R}/conexiuni?tab=urmareste`],
      [`/anglers/${ANDREW_R}/connections`, `/pescari/${ANDREW_R}/conexiuni`],
    ];
    for (const [from, to] of cases) {
      const res = await request.get(from, { maxRedirects: 0 });
      expect(res.status(), from).toBe(308);
      expect(res.headers().location, from).toBe(to);
    }
  });

  test('unknown id signed in → the not-found card, never a blank page', async ({ page }) => {
    const errors = collectConsoleErrors(page, { ignore: EXPECTED_CONSOLE });
    await asUser(page);
    await page.goto(`/pescari/${UNKNOWN}`);
    await expect(page.getByRole('heading', { name: 'Pescarul nu a fost găsit' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Mergi acasă' })).toBeVisible();
    await expectNoA11yViolations(page);
    expect(errors).toEqual([]);
  });

  test('unknown id signed out → the guest state, never a fake «Nicio captură încă» (the public lists answer [] for it too)', async ({ page }) => {
    await page.goto(`/pescari/${UNKNOWN}`);
    await expect(page.getByTestId('guest-hint')).toBeVisible();
    await expect(page.getByTestId('tab-empty')).toHaveText(GUEST_EMPTY);
    await tab(page, 'Partide').click();
    await expect(page.getByTestId('tab-empty')).toHaveText(GUEST_EMPTY);
    await expect(page.getByText(/încă$/)).toHaveCount(0);
  });
});

/* ------------------------------------------------------------------------------------------------
 * A real angler, signed in
 * ---------------------------------------------------------------------------------------------- */

test.describe('signed in — real data', () => {
  test.beforeEach(async ({ page }) => asUser(page));

  test('c2 c4–c9 c15 c16 c35: header, stats, default tab, only the selected tab requested, back control', async ({ page }) => {
    const errors = collectConsoleErrors(page, { ignore: EXPECTED_CONSOLE });
    const lists: string[] = [];
    page.on('request', r => {
      const m = r.url().match(new RegExp(`/feed/anglers/${ANDREW_R}/(catches|sessions|competitions)`));
      if (m) lists.push(m[1]);
    });
    const profileRead = page.waitForRequest(r => r.url().includes(`/api/cms/feed/anglers/${ANDREW_R}`) && !/\/(catches|sessions|competitions)/.test(r.url()));
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`/pescari/${ANDREW_R}`);
    await profileRead;

    await expect(page.getByRole('heading', { level: 1, name: 'Andrew R' })).toBeVisible();
    await expect(page.getByTestId('followers-count')).toHaveText(/^\d+ (de )?urmăritori?$/);
    await expect(page.getByTestId('following-count')).toContainText('urmărește');
    await expect(page.getByTestId('profile-rating-pill')).toContainText('5,0');
    await expect(page.getByTestId('trophy-row')).toHaveCount(0); // no podiums
    await expect(page.getByTestId('bio')).toHaveCount(0); // no bio
    const strip = page.getByTestId('stat-strip');
    await expect(strip).toContainText('Capturi');
    await expect(strip).toContainText('C.M.M.C');
    await expect(page.getByTestId('cmmc-value').first()).toHaveText(/^30,2\s+kg$/);
    await expect(page.getByTestId('cmmc-verified')).toHaveCount(0); // a partidă record
    await expect(page.getByRole('button', { name: 'Înapoi' })).toBeVisible();
    await expect(page.getByTestId('profile-settings-button')).toHaveCount(0);
    // The two header chips are twins on the white band (soft fill), not a white chip beside a grey one.
    const fill = (name: string) => page.getByRole('button', { name, exact: true }).first().evaluate(el => getComputedStyle(el).backgroundColor);
    expect(await fill('Înapoi')).toBe(await fill('Reîmprospătează'));

    await expect(tab(page, 'Capturi')).toHaveAttribute('aria-selected', 'true');
    await page.waitForLoadState('networkidle');
    expect(lists.filter(l => l !== 'catches'), 'only the selected tab is read').toEqual([]);

    // c15: the second tab is «Partide» (the web's name for fish's «Sesiuni»); the URL keeps ?tab=sesiuni.
    await expect(page.getByRole('tab', { name: /^Sesiuni/ })).toHaveCount(0);
    await tab(page, 'Partide').click();
    await expect(page).toHaveURL(new RegExp(`/pescari/${ANDREW_R}\\?tab=sesiuni$`));
    await expect(page.getByTestId('session-month').first()).toBeVisible();
    expect(lists).toContain('sessions');
    expect(lists).not.toContain('competitions');

    for (const width of AXE_WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      await expectNoA11yViolations(page);
    }
    expect(errors).toEqual([]);
  });

  test('c22 c32: Sesiuni in pages of 10 under month headers; the next page loads at the end', async ({ page }) => {
    const sizes: string[] = [];
    page.on('request', r => {
      if (r.url().includes(`/feed/anglers/${MANY}/sessions`)) sizes.push(new URL(r.url()).searchParams.get('pageSize') ?? '');
    });
    await page.goto(`/pescari/${MANY}?tab=sesiuni`);
    const cards = page.getByTestId('session-card');
    await expect(cards).toHaveCount(10); // the server's first page (pageSize 10)
    await expect(page.getByTestId('session-month').first().locator(':scope > h3')).toHaveText(/^[A-ZĂÂÎȘȚ]+ \d{4}$/);
    await page.getByRole('button', { name: 'Încarcă mai multe' }).click();
    await expect(cards).toHaveCount(20);
    expect(sizes.every(s => s === '10')).toBe(true);
  });

  test('c26 c27 c29 c30: Concursuri chips are independent, keep the previous cards while loading, empty copy, card opens the competition', async ({ page }) => {
    await page.goto(`/pescari/${ANDREW_R}?tab=concursuri`);
    const cards = page.getByTestId('competition-card');
    await expect(cards.first()).toBeVisible();
    const kind = page.getByRole('radiogroup', { name: 'Tip concurs' });
    const year = page.getByRole('radiogroup', { name: 'An' });
    await expect(kind.getByRole('radio')).toHaveCount(4);
    await expect(year.getByRole('radio', { name: 'Oricând' })).toBeChecked();

    // Echipe: slow the answer — the previous cards stay (dimmed) until it lands.
    await page.route(new RegExp(`/feed/anglers/${ANDREW_R}/competitions.*filter=team`), async r => {
      await new Promise(res => setTimeout(res, 800));
      await r.fallback();
    });
    await kind.getByText('Echipe').click();
    await expect(page.getByTestId('competitions')).toHaveAttribute('data-placeholder', 'true');
    // A filter emptied the list: say so — not «Niciun concurs încă» (the angler has others).
    await expect(page.getByTestId('tab-empty')).toHaveText('Niciun concurs pentru filtrele alese');
    await year.getByText(String(new Date().getFullYear() - 1)).click();
    await expect(kind.getByRole('radio', { name: 'Echipe' })).toBeChecked(); // the other row is kept

    await page.getByTestId('competition-filters-reset').click();
    await expect(kind.getByRole('radio', { name: 'Toate' })).toBeChecked();
    await expect(year.getByRole('radio', { name: 'Oricând' })).toBeChecked();
    const first = cards.first().getByRole('link');
    const href = await first.getAttribute('href');
    expect(href).toMatch(/^\/concursuri\/[^/]+$/);
    await first.click();
    await page.waitForURL(`**${href}`);
  });

  test('c33: Reîmprospătează refetches the header and the selected tab', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/pescari/${ANDREW_R}?tab=concursuri`);
    await expect(page.getByTestId('profile-header')).toBeVisible();
    const header = page.waitForRequest(r => new RegExp(`/feed/anglers/${ANDREW_R}(\\?|$)`).test(r.url()));
    const list = page.waitForRequest(r => r.url().includes(`/feed/anglers/${ANDREW_R}/competitions`));
    await page.getByRole('button', { name: 'Reîmprospătează' }).click();
    await Promise.all([header, list]);
  });

  test('c38: the own documentId — no follow, the back control, no settings cog', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`/pescari/${selfId}`);
    await expect(page.getByTestId('profile-header')).toBeVisible();
    await expect(page.getByTestId('follow-slot')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Înapoi' })).toBeVisible();
    await expect(page.getByTestId('profile-settings-button')).toHaveCount(0);
  });

  test('c10–c12: follow is optimistic, aria-disabled while pending, persists; unfollow posts /unfollow (afterEach double-checks)', async ({ page, request }) => {
    const errors = collectConsoleErrors(page, { ignore: EXPECTED_CONSOLE });
    await page.goto(`/pescari/${FOLLOW}`);
    const button = page.getByTestId('follow-slot').getByRole('button');
    await expect(button).toHaveText('Urmărește');
    const before = Number((await page.getByTestId('followers-count').innerText()).match(/\d+/)?.[0]);

    // Hold the POST: the button is busy (aria-disabled, keeps focus) and the count already moved (optimistic).
    let release!: () => void;
    const held = new Promise<void>(res => (release = res));
    await page.route(new RegExp(`/feed/anglers/${FOLLOW}/follow$`), async r => {
      await held;
      await r.fallback();
    });
    followed = true;
    const posted = page.waitForResponse(r => r.url().endsWith(`/feed/anglers/${FOLLOW}/follow`) && r.request().method() === 'POST');
    await button.click();
    await expect(button).toHaveAttribute('aria-disabled', 'true');
    await expect(button).toHaveText('Urmăresc');
    await expect(page.getByTestId('followers-count')).toContainText(String(before + 1));
    release();
    expect((await posted).ok()).toBe(true);
    await expect(button).not.toHaveAttribute('aria-disabled');

    await page.reload();
    await expect(page.getByTestId('follow-slot').getByRole('button')).toHaveText('Urmăresc');
    const check = await request.get(`${CMS}/feed/anglers/${FOLLOW}`, { headers: { authorization: `Bearer ${jwt}` } });
    expect((await check.json()).data.isFollowedByMe).toBe(true);

    // c11: unfollow posts /unfollow; the count goes back down.
    const unposted = page.waitForResponse(r => r.url().endsWith(`/feed/anglers/${FOLLOW}/unfollow`) && r.request().method() === 'POST');
    await page.getByTestId('follow-slot').getByRole('button').click();
    expect((await unposted).ok()).toBe(true);
    await expect(page.getByTestId('follow-slot').getByRole('button')).toHaveText('Urmărește');
    await expect(page.getByTestId('followers-count')).toContainText(String(before));
    expect(errors).toEqual([]);
  });

  test('c12: a failed follow is rolled back (count and label)', async ({ page }) => {
    await page.goto(`/pescari/${FOLLOW}`);
    const button = page.getByTestId('follow-slot').getByRole('button');
    await expect(button).toHaveText('Urmărește');
    const count = await page.getByTestId('followers-count').innerText();
    await page.route(new RegExp(`/feed/anglers/${FOLLOW}/follow$`), async r => {
      await new Promise(res => setTimeout(res, 300));
      await json(r, { error: { status: 500, message: 'boom' } }, 500);
    });
    await button.click();
    await expect(button).toHaveText('Urmăresc');
    await expect(button).toHaveText('Urmărește');
    await expect(page.getByTestId('followers-count')).toHaveText(count);
  });

  test('c13: own profile → follow another angler → back: the own «urmărește» count is refetched', async ({ page }) => {
    await page.goto(`/pescari/${selfId}`);
    const following = page.getByTestId('following-count');
    await expect(following).toBeVisible();
    const before = Number((await following.innerText()).match(/\d+/)?.[0]);
    // In-app navigation (the query cache survives; the own header is cached and fresh for 60s).
    await page.evaluate(id => (window as unknown as { next: { router: { push: (h: string) => void } } }).next.router.push(`/pescari/${id}`), FOLLOW);
    const button = page.getByTestId('follow-slot').getByRole('button');
    await expect(button).toHaveText('Urmărește');
    followed = true;
    const posted = page.waitForResponse(r => r.url().endsWith(`/feed/anglers/${FOLLOW}/follow`) && r.request().method() === 'POST');
    await button.click();
    expect((await posted).ok()).toBe(true);
    await page.goBack();
    // The router keeps the previous page mounted (hidden): read the visible one.
    await expect(page.getByTestId('following-count').filter({ visible: true })).toContainText(String(before + 1));
  });
});

/* ------------------------------------------------------------------------------------------------
 * The mocked angler: the states the local DB lacks
 * ---------------------------------------------------------------------------------------------- */

test.describe('signed in — real data: the partidă link', () => {
  test.beforeEach(async ({ page }) => asUser(page));

  test('c25 real data: a session card lands on the rendered partidă page (spectator view: not the viewer\'s)', async ({ page, request }) => {
    const sessions = (await (await request.get(`${CMS}/feed/anglers/${ANDREW_R}/sessions?page=1&pageSize=10`)).json()).data as { documentId: string }[];
    test.skip(!sessions.length, 'Andrew R has no public session in the local CMS');
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/pescari/${ANDREW_R}?tab=sesiuni`);
    const card = page.getByTestId('session-card').first();
    await expect(card.getByRole('link')).toHaveAttribute('href', `/partide/${sessions[0].documentId}`);
    await card.getByRole('link').click();
    await expect(page).toHaveURL(new RegExp(`/partide/${sessions[0].documentId}$`));
    await expect(page.getByTestId('partida-spectator')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });
});

test.describe('signed in — mocked states', () => {
  test.beforeEach(async ({ page }) => asUser(page));

  test('c3: the header skeleton (with the follow pill) until the profile lands; the tab bar does not move', async ({ page }) => {
    // No bio, no podium: the real header is exactly the skeleton's bones.
    await mockAngler(page, { delayHeaderMs: 2000, profile: header({ bio: null, podium: { first: 0, second: 0, third: 0 } }) });
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`/pescari/${MOCK}?tab=concursuri`);
    await expect(page.getByTestId('profile-header-skeleton').first()).toBeVisible();
    await expect(page.getByTestId('follow-skeleton').first()).toBeVisible();
    const before = (await page.getByRole('tablist').boundingBox())!.y;
    await expect(page.getByTestId('profile-header')).toBeVisible();
    await expect(page.getByTestId('profile-header-skeleton')).toHaveCount(0);
    const after = (await page.getByRole('tablist').boundingBox())!.y;
    expect(Math.abs(after - before), 'tab bar shift (px)').toBeLessThanOrEqual(4);
  });

  test('c3 c31: the streamed route fallback (JS off) — the Capturi bones have a size (12 / 16), no client-reference stub in the HTML', async ({ browser }) => {
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    try {
      const page = await ctx.newPage();
      for (const [width, bones] of [[375, 12], [1440, 16]] as const) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(`/pescari/${MOCK}`);
        // loading.tsx and the page's Suspense both stream one; the visible one is the screen.
        const fallback = page.locator('[data-testid=profile-fallback]:visible').first();
        await expect(fallback).toBeVisible();
        const grid = fallback.getByTestId('tab-skeleton-capturi');
        expect(await grid.getAttribute('class')).toMatch(/^grid grid-cols-3 /);
        expect((await grid.boundingBox())!.height).toBeGreaterThan(50);
        const sized = await grid.locator(':scope > span').evaluateAll(els =>
          els.filter(e => {
            const r = e.getBoundingClientRect();
            return r.width > 0 && r.height > 0;
          }).length,
        );
        expect(sized, `sized bones at ${width}`).toBe(bones);
        expect(await page.content()).not.toContain('Attempted to call');
      }
    } finally {
      await ctx.close();
    }
  });

  test('c3 c31: /pescari/[id]/conexiuni streams its own skeleton (JS off, signed in) — never the profile fallback', async ({ browser }) => {
    // The profile's page + loading.tsx live in the (profil) group, so they wrap /pescari/[id] only:
    // the connections page keeps ConnectionsSkeleton as its first paint (M8 follow-up).
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    try {
      await signIn(ctx, jwt);
      const page = await ctx.newPage();
      for (const width of [375, 1280]) {
        await page.setViewportSize({ width, height: 900 });
        const res = await page.goto(`/pescari/${MOCK}/conexiuni`);
        expect(res?.status(), 'no redirect to sign-in for a signed-in visitor').toBeLessThan(300);
        await expect(page).toHaveURL(new RegExp(`/pescari/${MOCK}/conexiuni$`));
        await expect(page.locator('[data-testid=connections-skeleton]:visible').first()).toBeVisible();
        await expect(page.getByTestId('profile-fallback')).toHaveCount(0);
        await expect(page.getByRole('heading', { level: 1, name: 'Profil de pescar' })).toHaveCount(0);
      }
    } finally {
      await ctx.close();
    }
  });

  test('the profile render throws → the profile error boundary: back control, h1 «Profil de pescar», «Serverul nu răspunde» + «Încearcă din nou»', async ({ page }) => {
    // Dev-only fault switch (_components/e2e-faults.ts): this context's server render of the profile throws.
    const { hostname } = new URL(BASE_URL);
    await page.context().addCookies([{ name: 'bluvi-e2e-pescar', value: 'throw', domain: hostname, path: '/' }]);
    for (const width of [375, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/pescari/${MOCK}`);
      await expect(page.getByTestId('profile-error')).toBeVisible();
      await expect(page.getByRole('heading', { level: 1, name: 'Profil de pescar' })).toBeAttached();
      await expect(page.getByText('Serverul nu răspunde')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Înapoi', exact: true })).toBeVisible();
      // focusOnMount: the retry has the focus.
      await expect(page.getByRole('button', { name: 'Încearcă din nou' })).toBeFocused();
      await expect(page.getByTestId('profile-fallback')).toHaveCount(0);
      await expectNoA11yViolations(page);
    }
  });

  test('c3 ≥1280: the route fallback and the landed page put the identity card and the tab bar on the same lines', async ({ browser, page }) => {
    await mockAngler(page, { profile: header({ bio: null, podium: { first: 0, second: 0, third: 0 } }) });
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    try {
      const streamed = await ctx.newPage();
      for (const width of [1280, 1440, 1920]) {
        await streamed.setViewportSize({ width, height: 900 });
        await streamed.goto(`/pescari/${MOCK}`);
        const fallback = streamed.locator('[data-testid=profile-fallback]:visible').first();
        await expect(fallback).toBeVisible();
        await expect(fallback.getByTestId('profile-header-row')).toBeHidden(); // no chip row from 1280
        const fAside = (await fallback.locator('div:has(> [data-testid=profile-header-skeleton])').boundingBox())!;
        const fBar = (await fallback.getByTestId('tab-bar-skeleton').boundingBox())!;
        const fTabs = (await fallback.getByTestId('tab-bar-skeleton').locator(':scope > div').first().boundingBox())!;
        expect(await fallback.getByTestId('tab-bar-skeleton').evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(255, 255, 255)');

        await page.setViewportSize({ width, height: 900 });
        await page.goto(`/pescari/${MOCK}`);
        await expect(page.getByTestId('profile-header')).toBeVisible();
        const aside = (await page.getByRole('complementary').boundingBox())!;
        const bar = (await page.getByRole('tablist').locator('..').boundingBox())!;
        const tabs = (await page.getByRole('tablist').boundingBox())!;
        expect(Math.abs(aside.y - fAside.y), `aside y at ${width}`).toBeLessThanOrEqual(2);
        expect(Math.abs(aside.x - fAside.x), `aside x at ${width}`).toBeLessThanOrEqual(2);
        expect(Math.abs(bar.y - fBar.y), `tab bar y at ${width}`).toBeLessThanOrEqual(2);
        expect(Math.abs(bar.height - fBar.height), `tab bar height at ${width}`).toBeLessThanOrEqual(2);
        expect(Math.abs(tabs.y - fTabs.y), `tablist y at ${width}`).toBeLessThanOrEqual(2);
      }
    } finally {
      await ctx.close();
    }
  });

  test('c35 c6: the breadcrumb is «Acasă / Profil de pescar» while the header is held and after it fails — never the URL-derived «Pescari»', async ({ page }) => {
    test.setTimeout(60_000);
    const errors = collectConsoleErrors(page, { ignore: EXPECTED_CONSOLE });
    await mockAngler(page, { delayHeaderMs: 4_500 });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/pescari/${MOCK}?tab=concursuri`);
    const band = page.getByRole('navigation', { name: 'Cale de navigare' });
    await expect(page.getByTestId('profile-header-skeleton').first()).toBeVisible();
    await expect(band.getByRole('link', { name: 'Acasă' })).toBeVisible();
    await expect(band.locator('[aria-current="page"]')).toHaveText('Profil de pescar');
    await page.waitForTimeout(3_500); // past the shell's naming deadline, header still held
    await expect(band).not.toContainText('Pescari');
    await expect(page.getByTestId('profile-header')).toBeVisible();
    await expect(band.locator('[aria-current="page"]')).toHaveText('Pescar Mock');

    // A failed header at 1440 (no back chip from 1280): the Acasă crumb is still the way back.
    await page.unroute(new RegExp(`/feed/anglers/${MOCK}(\\?.*)?$`));
    await page.route(new RegExp(`/feed/anglers/${MOCK}(\\?.*)?$`), r => json(r, { error: { status: 500, message: 'boom' } }, 500));
    await page.goto(`/pescari/${MOCK}?tab=concursuri`);
    await expect(page.getByText('Nu am putut încărca profilul.')).toBeVisible({ timeout: 30_000 });
    await expect(band.getByRole('link', { name: 'Acasă' })).toBeVisible();
    await expect(band.locator('[aria-current="page"]')).toHaveText('Profil de pescar');
    await expect(band).not.toContainText('Pescari');
    await band.getByRole('link', { name: 'Acasă' }).click();
    await expect(page).toHaveURL(/\/$/);
    expect(errors).toEqual([]);
  });

  test('c7: the followers count takes the right plural (1 urmăritor, 25 de urmăritori)', async ({ page }) => {
    await mockAngler(page, { profile: header({ counts: { followers: 1, following: 25, catches: 25, sessions: 2, competitions: 4 } }) });
    await page.goto(`/pescari/${MOCK}?tab=concursuri`);
    await expect(page.getByTestId('followers-count')).toHaveText('1 urmăritor');
    await expect(page.getByTestId('following-count')).toHaveText('25 urmărește');
    await page.unroute(new RegExp(`/feed/anglers/${MOCK}(\\?.*)?$`));
    await page.route(new RegExp(`/feed/anglers/${MOCK}(\\?.*)?$`), r => json(r, { data: header({ counts: { followers: 25, following: 2, catches: 25, sessions: 2, competitions: 4 } }) }));
    await page.reload();
    await expect(page.getByTestId('followers-count')).toHaveText('25 de urmăritori');
  });

  test('c7: «N urmăritori» opens the connections on Urmăritori, «N urmărește» on Urmărește (pointer and keyboard)', async ({ page }) => {
    await mockAngler(page, { profile: header({ counts: { followers: 3, following: 2, catches: 25, sessions: 2, competitions: 4 } }) });
    const empty = { data: [], meta: { pagination: { page: 1, pageSize: 20, pageCount: 0, total: 0 } } };
    await page.route(new RegExp(`/feed/anglers/${MOCK}/(followers|following)`), r => json(r, empty));
    for (const width of [375, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/pescari/${MOCK}?tab=concursuri`);
      const followers = page.getByTestId('followers-count').locator('visible=true');
      await expect(followers).toHaveText('3 urmăritori');
      // Both counts are real links (rule 17), each to its own tab.
      await expect(followers).toHaveAttribute('href', `/pescari/${MOCK}/conexiuni?tab=urmaritori`);
      await expect(page.getByTestId('following-count').locator('visible=true')).toHaveAttribute('href', `/pescari/${MOCK}/conexiuni?tab=urmareste`);
      await followers.click();
      await page.waitForURL(new RegExp(`/pescari/${MOCK}/conexiuni(\\?tab=urmaritori)?$`));
      await expect(page.getByRole('tab', { name: /^Urmăritori/ })).toHaveAttribute('aria-selected', 'true');
    }
    // Keyboard: Tab reaches «2 urmărește», Enter opens Urmărește.
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`/pescari/${MOCK}?tab=concursuri`);
    const following = page.getByTestId('following-count');
    await expect(following).toHaveText('2 urmărește');
    await following.focus();
    await expect(following).toBeFocused();
    await page.keyboard.press('Enter');
    await page.waitForURL(`**/pescari/${MOCK}/conexiuni?tab=urmareste`);
    await expect(page.getByRole('tab', { name: /^Urmărește/ })).toHaveAttribute('aria-selected', 'true');
  });

  test('c4 c6 c8 c9 c14: initials, podium tiers above zero, «–» record, verified badge, hashtags', async ({ page }) => {
    await mockAngler(page);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`/pescari/${MOCK}?tab=concursuri`);
    await expect(page.getByRole('heading', { level: 1, name: 'Pescar Mock' })).toBeVisible();
    await expect(page.getByTestId('avatar-initials')).toHaveText('PM');
    await expect(page.getByTestId('profile-avatar-button')).toHaveCount(0);
    const trophies = page.getByTestId('trophy-row').getByRole('listitem');
    await expect(trophies).toHaveCount(2); // 🥇 1, 🥈 2 — no 🥉 0
    await expect(page.getByTestId('cmmc-value').first()).toHaveText(/^12,4\s+kg$/);
    await expect(page.getByTestId('cmmc-verified').first()).toBeAttached();
    const bio = page.getByTestId('bio');
    await expect(bio).toContainText('Crap și somn pe');
    await expect(bio.locator('.text-accent-ink', { hasText: '#Snagov' })).toHaveCount(1);
    await expect(bio.locator('.text-accent-ink', { hasText: '#feeder_2026' })).toHaveCount(1);
    await expect(page.getByText(/capot/i)).toHaveCount(0);
  });

  test('c9 c5: no biggest catch → «–»; no ratings → no pill', async ({ page }) => {
    await mockAngler(page, { profile: header({ biggestCatch: null, podium: { first: 0, second: 0, third: 0 }, bio: null }), reputation: NO_REPUTATION });
    await page.goto(`/pescari/${MOCK}?tab=concursuri`);
    await expect(page.getByTestId('profile-header')).toBeVisible();
    await expect(page.getByTestId('cmmc-value').first()).toHaveText('–');
    await expect(page.getByTestId('trophy-row')).toHaveCount(0);
    await expect(page.getByTestId('bio')).toHaveCount(0);
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('profile-rating-pill')).toHaveCount(0);
  });

  test('c5 c36 c37: the rating pill opens «Reputație»: average, counts, no-shows, legacy mean, unknown tag dropped', async ({ page }) => {
    await mockAngler(page);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`/pescari/${MOCK}?tab=concursuri`);
    await page.getByTestId('profile-rating-pill').click();
    const dialog = page.getByRole('dialog', { name: 'Reputație' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByTestId('reputation-summary')).toContainText('4,6');
    await expect(dialog.getByTestId('reputation-summary')).toContainText(/2\s*evaluări/);
    await expect(dialog.getByTestId('reputation-no-shows')).toContainText(/1\s*neprezentare/);
    const reviews = dialog.getByTestId('reputation-review');
    await expect(reviews).toHaveCount(2);
    await expect(reviews.nth(0).getByTestId('review-score')).toHaveText('4,7');
    await expect(reviews.nth(0)).toContainText('Operator Unu · Balta Test');
    await expect(reviews.nth(1).getByRole('list', { name: 'Etichete' }).getByRole('listitem')).toHaveCount(1);
    await expect(reviews.nth(1)).toContainText('A respectat regulile');
    await expect(reviews.nth(1)).not.toContainText('e2eUnknownTag');
    await expectNoA11yViolations(page);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('c36: counts from 20 take «de» (formatCount): 25 de evaluări, 20 / de neprezentări', async ({ page }) => {
    await mockAngler(page, { reputation: { ...REPUTATION, ratingCount: 25, noShowCount: 20 } });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/pescari/${MOCK}?tab=concursuri`);
    await expect(page.getByTestId('reputation-summary-row')).toContainText('25 de evaluări');
    await page.getByTestId('reputation-summary-row').click();
    const dialog = page.getByRole('dialog', { name: 'Reputație' });
    await expect(dialog.getByTestId('reputation-summary')).toContainText('25 de evaluări');
    await expect(dialog.getByTestId('reputation-no-shows')).toHaveText(/^20\s*de neprezentări$/);
  });

  test('c17–c20 c31 c34: catch grid, lightbox footer, next page from the lightbox, duplicates shown once', async ({ page }) => {
    const errors = collectConsoleErrors(page, { ignore: EXPECTED_CONSOLE });
    // Hold the first catches answer to see the grid skeleton (c31).
    let release!: () => void;
    const held = new Promise<void>(res => (release = res));
    const seen = await mockAngler(page);
    await page.route(new RegExp(`/feed/anglers/${MOCK}/catches(?!.*cursor=)`), async r => {
      await held;
      await r.fallback();
    });
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`/pescari/${MOCK}?tab=concursuri`);
    await expect(page.getByTestId('profile-header')).toBeVisible();
    await tab(page, 'Capturi').click();
    await expect(page.getByTestId('tab-skeleton-capturi')).toBeVisible();
    release();

    const tiles = page.getByTestId('catch-tile');
    await expect(tiles).toHaveCount(20);
    expect(new URL(seen.catches[0]).searchParams.get('pageSize')).toBe('20');
    const grid = page.getByTestId('catch-grid');
    expect(await grid.evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length)).toBe(3);
    expect(await grid.evaluate(el => getComputedStyle(el).columnGap)).toBe('2px');

    await tiles.first().click();
    const box = page.getByTestId('lightbox');
    await expect(box).toBeVisible();
    await expect(page.getByTestId('catch-footer-title')).toContainText('12,4');
    await expect(page.getByTestId('catch-footer-title')).toContainText('Crap');
    await expect(page.getByTestId('catch-footer')).toContainText('Balta Mock');
    await expect(page.getByTestId('catch-footer-competition')).toHaveText('Cupa Mock');
    await expect(page.getByTestId('catch-footer')).toContainText('5 SEP 2025');
    // c21: one share action on the photo (its flow: «c21 …» below).
    await expect(box.getByRole('button', { name: 'Distribuie captura' })).toHaveCount(1);

    // Walk to the last loaded catch with the keyboard: the next page is asked for.
    for (let i = 0; i < 19; i++) await page.keyboard.press('ArrowRight');
    await expect.poll(() => seen.catches.some(u => new URL(u).searchParams.get('cursor') === 'p2')).toBe(true);
    await page.keyboard.press('Escape');
    await expect(box).toBeHidden();
    await expect(tiles).toHaveCount(25); // 20 + 6 with one repeat → 25 (c34)
    await expectNoA11yViolations(page);
    expect(errors).toEqual([]);
  });

  test('c21: «Distribuie captura» closes the lightbox and opens the catch share card (photo, kg, venue, species, competition)', async ({ page }) => {
    await mockAngler(page);
    for (const width of [375, 1280]) {
      await page.setViewportSize({ width, height: width < 768 ? 812 : 900 });
      await page.goto(`/pescari/${MOCK}?tab=concursuri`);
      await tab(page, 'Capturi').click();
      await page.getByTestId('catch-tile').first().click();
      const box = page.getByTestId('lightbox');
      await expect(box).toBeVisible();
      await box.getByRole('button', { name: 'Distribuie captura' }).click();
      // fish shareHandoff: the lightbox closes, the share card opens (a sheet on the phone, a dialog from 768).
      await expect(box).toBeHidden();
      const sheet = page.getByRole('dialog', { name: 'Distribuie captura' });
      await expect(sheet).toBeVisible();
      // The exact image that is shared, described: kg, the venue, the species, the competition.
      const image = sheet.getByRole('img', { name: /^Imaginea care se distribuie/ });
      await expect(image).toHaveAccessibleName(/12,4/);
      await expect(image).toHaveAccessibleName(/Balta Mock/);
      await expect(image).toHaveAccessibleName(/Crap/);
      await expect(image).toHaveAccessibleName(/Cupa Mock/);
      await expect(sheet.getByRole('button', { name: 'Distribuie', exact: true })).toBeEnabled();
      // The surface fades / slides in: let the entrance finish before axe reads colours.
      await page.waitForTimeout(500);
      await expectNoA11yViolations(page);
      await page.screenshot({ path: `.shots/partide-links/pescar-share-${width}.png` });
      await page.keyboard.press('Escape');
      await expect(sheet).toBeHidden();
    }
  });

  test('c22–c25 c30 c31: sessions — live card ticking with «Vezi partida», finished without endedAt with «Vezi rezumatul», each card opening /partide/[id]', async ({ page }) => {
    await mockAngler(page);
    await page.route(new RegExp(`/feed/anglers/${MOCK}/sessions`), async r => {
      await new Promise(res => setTimeout(res, 700));
      await r.fallback();
    });
    await page.clock.install();
    await page.goto(`/pescari/${MOCK}?tab=concursuri`);
    await tab(page, 'Partide').click();
    await expect(page.getByTestId('tab-skeleton-sesiuni')).toBeVisible();
    const cards = page.getByTestId('session-card');
    await expect(cards).toHaveCount(2);

    const live = cards.nth(0);
    await expect(live.getByTestId('session-live')).toContainText('Live');
    await expect(live).toContainText('Partidă'); // venue fallback
    await expect(live).toContainText('Snagov · Stand 4');
    await expect(live.getByTestId('session-stats')).toContainText(/captură\b/); // «1 captură» (formatCount)
    await expect(live.getByTestId('session-stats')).not.toContainText('capturi');
    await expect(live).toContainText('de pescuit');
    const footer = live.getByTestId('session-footer');
    await expect(footer).toContainText('Începută acum');
    // It keeps ticking (fish: a 30s interval).
    const first = await footer.innerText();
    await page.clock.fastForward('02:00');
    await expect(footer).not.toHaveText(first);
    // c24 / c25: the whole card opens the partidă (one stretched link), «Vezi partida» while live.
    await expect(live.getByRole('link')).toHaveCount(1);
    await expect(live.getByRole('link')).toHaveAttribute('href', '/partide/ses-live');
    await expect(live).toContainText('Vezi partida');

    const done = cards.nth(1);
    await expect(done).toContainText('Balta Mock');
    // «20» over «de capturi» (formatCount's «de» from 20); the figure is drawn first, the label first in the DOM.
    await expect(done.getByTestId('session-stats').locator('dt').first()).toHaveText('de capturi');
    await expect(done.getByTestId('session-stats').locator('dd').first()).toHaveText('20');
    await expect(done).toContainText('durată');
    await expect(done.getByTestId('session-stats')).toContainText('—');
    await expect(done.getByTestId('session-footer')).toHaveCount(0); // no endedAt → no range
    await expect(done).toContainText('Vezi rezumatul');
    await expect(done.getByRole('link')).toHaveAttribute('href', '/partide/ses-done');
    await expect(page.getByTestId('session-month').locator(':scope > h3')).toHaveText([/^[A-ZĂÂÎȘȚ]+ \d{4}$/, 'AUGUST 2025']);
    // c25: a press anywhere on the card (here its figures) lands on the partidă page — a made-up
    // id, so that page's own not-found state (the landing on a real one: «c25 real data»).
    await page.clock.resume();
    const figures = (await done.getByTestId('session-stats').boundingBox())!;
    await page.mouse.click(figures.x + figures.width / 2, figures.y + figures.height / 2);
    await expect(page).toHaveURL(/\/partide\/ses-done$/);
    await expect(page.getByTestId('partida-not-found')).toBeVisible({ timeout: 30_000 });
  });

  test('c26–c28 c31: competition cards — placement tones, ranges, placeholder, type tag; podium filter empty', async ({ page }) => {
    await mockAngler(page);
    await page.route(new RegExp(`/feed/anglers/${MOCK}/competitions`), async r => {
      await new Promise(res => setTimeout(res, 700));
      await r.fallback();
    });
    await page.goto(`/pescari/${MOCK}?tab=capturi`);
    await tab(page, 'Concursuri').click();
    await expect(page.getByTestId('tab-skeleton-concursuri')).toBeVisible();
    const cards = page.getByTestId('competition-card');
    await expect(cards).toHaveCount(4);
    await expect(cards.nth(0).getByTestId('placement')).toHaveAttribute('data-tone', 'gold');
    await expect(cards.nth(0)).toContainText('5–7 SEP 2025');
    await expect(cards.nth(0)).toContainText('Individual');
    await expect(cards.nth(0).getByTestId('competition-image')).toHaveAttribute('data-placeholder', 'true');
    await expect(cards.nth(1).getByTestId('placement')).toHaveAttribute('data-tone', 'grey');
    await expect(cards.nth(1)).toContainText('30 SEP – 2 OCT 2025');
    await expect(cards.nth(1)).toContainText('Echipe');
    await expect(cards.nth(2).getByTestId('placement')).toHaveAttribute('data-tone', 'accent');
    await expect(cards.nth(2)).toContainText('Locul 7');
    await expect(cards.nth(3).getByTestId('placement')).toHaveCount(0);
    await expect(cards.nth(0).getByRole('link')).toHaveAttribute('href', '/concursuri/cmp-1');

    await page.getByRole('radiogroup', { name: 'Tip concurs' }).getByText('Pe podium').click();
    await expect(page.getByTestId('tab-empty')).toHaveText('Niciun concurs pentru filtrele alese');
    await expect(page.getByTestId('competition-filters')).toBeVisible(); // the chips stay to undo it
  });

  test('c30: the three empty copies', async ({ page }) => {
    await page.route(new RegExp(`/feed/anglers/${MOCK}/(catches|sessions|competitions)`), r =>
      json(r, r.request().url().includes('/catches') ? { data: [], meta: { pagination: { pageSize: 20, total: 0 }, nextCursor: null } } : { data: [], meta: { pagination: { page: 1, pageSize: 10, pageCount: 0, total: 0 } } }),
    );
    await page.route(new RegExp(`/feed/anglers/${MOCK}(\\?.*)?$`), r =>
      json(r, { data: header({ counts: { followers: 0, following: 0, catches: 0, sessions: 0, competitions: 0 }, biggestCatch: null }) }),
    );
    await page.route(new RegExp(`/feed/users/${MOCK}/reputation`), r => json(r, { data: NO_REPUTATION }));
    await page.goto(`/pescari/${MOCK}`);
    await expect(page.getByTestId('tab-empty')).toHaveText('Nicio captură încă');
    await tab(page, 'Partide').click();
    await expect(page.getByTestId('tab-empty')).toHaveText('Nicio partidă publică încă');
    await tab(page, 'Concursuri').click();
    await expect(page.getByTestId('tab-empty')).toHaveText('Niciun concurs încă');
    // No competitions at all: no filter chips that could not help (rule 4).
    await expect(page.getByTestId('competition-filters')).toHaveCount(0);
  });

  test('c30: a guest on an angler with no competitions sees no chips either', async ({ browser }) => {
    const guest = await browser.newPage();
    await guest.route(new RegExp(`/feed/anglers/${MOCK}/(catches|sessions|competitions)`), r =>
      json(r, r.request().url().includes('/catches') ? { data: [], meta: { pagination: { pageSize: 20, total: 0 }, nextCursor: null } } : { data: [], meta: { pagination: { page: 1, pageSize: 10, pageCount: 0, total: 0 } } }),
    );
    await guest.goto(`/pescari/${MOCK}`);
    await tab(guest, 'Concursuri').click();
    await expect(guest.getByTestId('tab-empty')).toHaveText(GUEST_EMPTY);
    await expect(guest.getByTestId('competition-filters')).toHaveCount(0);
    await guest.close();
  });

  test('keyboard: tabs by arrow keys, chips by arrow keys, a catch by Enter', async ({ page }) => {
    await mockAngler(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/pescari/${MOCK}?tab=concursuri`);
    await expect(page.getByTestId('profile-header')).toBeVisible();
    await tab(page, 'Concursuri').focus();
    await page.keyboard.press('ArrowRight'); // wraps to Capturi
    await expect(tab(page, 'Capturi')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(tab(page, 'Capturi')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('catch-tile').first()).toBeVisible();
    await page.getByTestId('catch-tile').first().focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('lightbox')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('lightbox')).toBeHidden();

    await tab(page, 'Capturi').focus();
    await page.keyboard.press('ArrowLeft'); // wraps to Concursuri
    await page.keyboard.press('Enter');
    const kind = page.getByRole('radiogroup', { name: 'Tip concurs' });
    await kind.getByRole('radio', { name: 'Toate' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(kind.getByRole('radio', { name: 'Pe podium' })).toBeChecked();
  });

  test('≥1280: two columns — the sticky identity card with the bento stats and the reputation row', async ({ page }) => {
    await mockAngler(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/pescari/${MOCK}?tab=concursuri`);
    await expect(page.getByTestId('stat-bento')).toBeVisible();
    await expect(page.getByTestId('stat-strip')).toBeHidden();
    await expect(page.getByTestId('reputation-summary-row')).toBeVisible();
    const aside = page.getByRole('complementary', { name: 'Despre Pescar Mock' });
    expect(await aside.evaluate(el => getComputedStyle(el).position)).toBe('sticky');
    const [a, b] = await Promise.all([aside.boundingBox(), page.getByRole('tablist').boundingBox()]);
    expect(b!.x).toBeGreaterThan(a!.x + a!.width);
    await page.getByTestId('reputation-summary-row').click();
    await expect(page.getByRole('dialog', { name: 'Reputație' })).toBeVisible();
  });

  test('≥1280 rule 20 + rule 1: the tabs are one white card with count badges and the refresh chip; no back/refresh row; a compact record tile', async ({ page }) => {
    await mockAngler(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/pescari/${MOCK}?tab=concursuri`);
    await expect(page.getByTestId('profile-header')).toBeVisible();
    // Counts as badges where the header knows them (sessions 2, competitions 4); none on Capturi.
    await expect(page.getByRole('tab', { name: 'Partide, 2' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Concursuri, 4' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Capturi', exact: true })).toBeVisible();
    const bar = page.getByRole('tablist').locator('..');
    expect(await bar.evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(255, 255, 255)');
    await expect(bar.getByTestId('profile-refresh-chip')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Înapoi', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Reîmprospătează' })).toHaveCount(1);
    // The identity card and the tab card start together, right under the site header.
    const [aside, tabs] = await Promise.all([page.getByRole('complementary').boundingBox(), bar.boundingBox()]);
    expect(Math.abs(aside!.y - tabs!.y)).toBeLessThan(2);
    // The record tile is sized to its content, with the «weighed at a competition» fact in words.
    const tile = page.getByTestId('stat-bento').locator(':scope > div').first();
    expect((await tile.boundingBox())!.height).toBeLessThan(140);
    await expect(tile.getByTestId('cmmc-verified-bento')).toHaveText('Cântărită la concurs');
    await expectNoA11yViolations(page);
  });

  test('c17: the grid lists only catches with a photo — said under the tabs when the header counts more', async ({ page }) => {
    await mockAngler(page, { profile: header({ counts: { followers: 3, following: 2, catches: 57, sessions: 2, competitions: 4 } }) });
    await page.goto(`/pescari/${MOCK}?tab=concursuri`);
    await expect(page.getByTestId('profile-header')).toBeVisible();
    await tab(page, 'Capturi').click();
    await expect(page.getByTestId('catches-photo-note')).toHaveText('Doar capturile cu fotografie: 25 de fotografii din 57 de capturi');
    await expect(page.getByRole('tab', { name: 'Capturi', exact: true })).toBeVisible(); // never badged with 57
  });
});
