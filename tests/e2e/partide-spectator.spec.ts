import { expect, test, type Page, type Route } from '@playwright/test';
import { expectNoA11yViolations } from './helpers/a11y';
import { collectConsoleErrors } from './helpers/console';
import { installFakeLive, type FakeLiveHandle } from './helpers/fake-live';
import { CMS, qaJwt, signIn } from './helpers/session';

/*
 * partide.spectator (/partide/[id], T3) + partide.b.private-partida.
 * fish: app/(app)/partide/comunitate/[id].tsx, components/community/FollowSessionButton.tsx,
 * BellIntroSheet.tsx, ActivityLineChart.tsx, community/{hooks,view,photoSources}.ts.
 *
 * Data:
 *  - MOCKED partide: ids starting with `e2e-` are never read by the server in development
 *    (_spectator/load.ts), so the BROWSER's GET /feed/community/sessions/:id answers them here
 *    (page.route) — live, ended, 404, 500, no photos, no catches, more catches than shown.
 *    Follow / unfollow, the follows list, the profile, the notification switch, the angler headers
 *    and the active-session read are mocked too: NO write reaches any CMS from this spec, and the
 *    page never touches Firestore (spectators read the CMS only).
 *  - REAL: one ended public partidă of the local CMS (server prerender, JSON-LD, share card) and an
 *    unknown id (the server's 404 → the not-found state, noindex).
 * A fixed clock (page.clock) makes the elapsed times and the 60 s poll deterministic.
 */

const NOW = new Date('2026-10-07T12:00:00.000Z');
const LIVE = 'e2e-live';
const ENDED = 'e2e-ended';
const BARE = 'e2e-bare';
const EMPTY = 'e2e-empty';
const MORE = 'e2e-more';
const SOLO = 'e2e-solo';
const GONE = 'e2e-gone';
const BROKEN = 'e2e-broken';
const REAL_ENDED = process.env.E2E_PARTIDA_ID ?? 'perfseedfq3otnzlrafuws4b';
const UNKNOWN = 'zzunknownpartida000000001';
const WIDTHS = [375, 768, 1280, 1440, 1920] as const;
/** Mocked 404 / 500 answers are logged by the browser. */
const EXPECTED_CONSOLE = [/Failed to load resource: the server responded with a status of (401|404|500)/];

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEUlEQVR4nGM4YWODFTEMLQkAZZlQAVIPr1MAAAAASUVORK5CYII=',
  'base64',
);
const PHOTO = (n: string) => `https://e2e-photos.invalid/${n}.png`;

let selfId = '';
let jwt = '';

test.beforeAll(async ({ request }) => {
  jwt = await qaJwt(request);
  const me = await request.get(`${CMS}/user/profile`, { headers: { authorization: `Bearer ${jwt}` } });
  expect(me.ok(), 'QA profile read').toBe(true);
  selfId = (await me.json()).documentId as string;
});

/* ------------------------------------------------------------------------------------------------
 * Fixtures
 * ---------------------------------------------------------------------------------------------- */

const at = (minutesAgo: number) => new Date(NOW.getTime() - minutesAgo * 60_000).toISOString();

function catchOf(n: number, species: string | null, kg: number | null, minutesAgo: number, photo = true) {
  return {
    clientId: `c-${n}`,
    species,
    weightKg: kg,
    photoUrl: photo ? PHOTO(`c-${n}`) : null,
    photoGridUrl: photo ? PHOTO(`c-${n}`) : null,
    photoThumbUrl: photo ? PHOTO(`c-${n}`) : null,
    occurredAt: at(minutesAgo),
    width: null,
    height: null,
  };
}

// Times in Bucharest (UTC+3 on 2026-10-07): 12:00Z − 120 min = 13:00.
const CATCHES = [
  catchOf(4, 'Crap', 3.4, 30), // 14:30
  catchOf(3, 'Somn', 8.69, 60, false), // 14:00 — the biggest, no photo
  catchOf(2, 'Caras', 1.24, 90), // 13:30
  catchOf(1, null, null, 110, false), // 13:10 — not weighed, no species
];

type Detail = Record<string, unknown> & { documentId: string };

function detail(id: string, patch: Partial<Detail> = {}): Detail {
  return {
    documentId: id,
    startedAt: at(134), // 2h14m before NOW
    endedAt: null,
    venueName: 'Balta Mock',
    venueType: 'lake',
    publicWaterCode: null,
    locality: 'Giurgiu',
    lakeId: 'e2e-lake-1',
    imageUrl: PHOTO('venue'),
    venueImageUrl: PHOTO('venue'),
    members: [
      { uid: 'e2e-angler-1', name: 'Ion Pescar', avatarUrl: null },
      { uid: 'e2e-angler-2', name: null, avatarUrl: null },
    ],
    catchCount: 4,
    maxKg: 8.69,
    durationMs: null,
    catches: CATCHES,
    photos: [CATCHES[0], CATCHES[2]],
    weighedCatches: [
      { t: at(90), kg: 1.24, species: 'Caras' },
      { t: at(60), kg: 8.69, species: 'Somn' },
      { t: at(30), kg: 3.4, species: 'Crap' },
    ],
    maxCatch: CATCHES[1],
    photoCount: 2,
    hasMoreCatches: false,
    anglerStats: null,
    ...patch,
  };
}

const ENDED_DETAIL = detail(ENDED, { endedAt: at(14), durationMs: 2 * 3_600_000 });

const FIXTURES: Record<string, Detail> = {
  [LIVE]: detail(LIVE),
  [ENDED]: ENDED_DETAIL,
  [BARE]: detail(BARE, { imageUrl: null, venueImageUrl: null, photos: [], photoCount: 0, catches: CATCHES.map(c => ({ ...c, photoUrl: null, photoGridUrl: null, photoThumbUrl: null })), maxCatch: { ...CATCHES[1] } }),
  [EMPTY]: detail(EMPTY, { catches: [], photos: [], weighedCatches: [], maxCatch: null, maxKg: null, catchCount: 0, photoCount: 0, imageUrl: null, venueImageUrl: PHOTO('venue') }),
  [MORE]: detail(MORE, { hasMoreCatches: true, catchCount: 27 }),
  [SOLO]: detail(SOLO, {
    members: [{ uid: 'e2e-angler-1', name: 'Ion Pescar', avatarUrl: null }],
    lakeId: null,
    venueType: 'publicWater',
    publicWaterCode: 'AG-07',
  }),
  [BROKEN]: detail(BROKEN),
};

type Calls = { session: number; follow: string[]; unfollow: string[]; notifications: unknown[]; active: number };

/**
 * Routes for one test: the partidă (a fixture, or `status` for every read of `id`), the per-user
 * reads (follows, profile, angler headers, active session) and the follow writes.
 */
async function mockCms(
  page: Page,
  {
    statuses = {},
    follows = [] as string[],
    notificationsEnabled = true,
    followStatus = 200,
    active = null as null | { documentId: string },
    activeDelayMs = 0,
  }: {
    statuses?: Record<string, number[]>;
    follows?: string[];
    notificationsEnabled?: boolean;
    followStatus?: number;
    active?: null | { documentId: string };
    activeDelayMs?: number;
  } = {},
): Promise<Calls> {
  const calls: Calls = { session: 0, follow: [], unfollow: [], notifications: [], active: 0 };
  const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  await page.route('https://e2e-photos.invalid/**', r => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
  await page.route(/\/feed\/community\/sessions\/(e2e-[^/?]+)(\?.*)?$/, route => {
    const id = /sessions\/(e2e-[^/?]+)/.exec(route.request().url())![1];
    calls.session += 1;
    const queue = statuses[id];
    if (queue?.length) {
      const status = queue.length > 1 ? queue.shift()! : queue[0];
      if (status !== 200) return json(route, { error: { status, message: 'mock' } }, status);
    }
    const body = FIXTURES[id];
    return body ? json(route, { data: body }) : json(route, { error: { status: 404 } }, 404);
  });
  await page.route('**/api/cms/feed/session-follows/mine', route => json(route, { data: { sessionDocumentIds: follows } }));
  await page.route(/\/api\/cms\/feed\/sessions\/[^/]+\/(follow|unfollow)$/, route => {
    const [, id, verb] = /sessions\/([^/]+)\/(follow|unfollow)$/.exec(route.request().url())!;
    if (verb === 'follow') calls.follow.push(id);
    else calls.unfollow.push(id);
    if (followStatus !== 200) return json(route, { error: { status: followStatus } }, followStatus);
    if (verb === 'follow') follows = [...follows, id];
    else follows = follows.filter(f => f !== id);
    return json(route, { data: { ok: true } });
  });
  await page.route('**/api/cms/feed/sessions/active', async route => {
    calls.active += 1;
    if (activeDelayMs) await new Promise(r => setTimeout(r, activeDelayMs));
    return json(route, { data: active ? { documentId: active.documentId, clientId: 'c', firestoreId: null } : null });
  });
  await page.route('**/api/cms/user/profile', route =>
    json(route, {
      id: 1,
      documentId: selfId,
      email: 'qa@bluvi.test',
      username: 'qa',
      phone: null,
      isProfileComplete: true,
      hasRequestedOrganizerRole: false,
      notificationsEnabled,
      avatar: null,
      role: { id: 1, documentId: 'r', name: 'Authenticated' },
    }),
  );
  await page.route('**/api/cms/notifications/enable-disable-pns', route => {
    calls.notifications.push(route.request().postDataJSON());
    return json(route, { success: true });
  });
  await page.route(/\/api\/cms\/feed\/anglers\/([^/?]+)$/, route => {
    const uid = /anglers\/([^/?]+)$/.exec(route.request().url())![1];
    const followers = uid === 'e2e-angler-1' ? 1 : 25;
    return json(route, {
      data: {
        id: 1,
        documentId: uid,
        username: uid,
        avatarUrl: null,
        bio: null,
        memberSince: '2025-01-01T00:00:00.000Z',
        counts: { followers, following: 0, catches: 0, sessions: 0, competitions: 0 },
        biggestCatch: null,
        podium: { first: 0, second: 0, third: 0 },
        isFollowedByMe: false,
        isSelf: uid === selfId,
      },
    });
  });
  return calls;
}

async function open(page: Page, id: string, width = 1280) {
  await page.setViewportSize({ width, height: 900 });
  await page.clock.install({ time: NOW });
  await page.goto(`/partide/${id}`);
}

const spectator = (page: Page) => page.getByTestId('partida-spectator');
const followButton = (page: Page) => page.getByTestId('follow-session-button').filter({ visible: true });

/* ------------------------------------------------------------------------------------------------
 * c2 — states
 * ---------------------------------------------------------------------------------------------- */

test('partide.spectator.c2 not found: the CMS 404 (unknown or private) — fish copy, the way to Partide, noindex', async ({ page }) => {
  const errors = collectConsoleErrors(page, { ignore: EXPECTED_CONSOLE });
  await mockCms(page);
  await open(page, GONE);
  await expect(page.getByRole('heading', { level: 1, name: 'Partida nu a fost găsită.' })).toBeVisible();
  await expect(page.getByText('Poate a fost ștearsă sau nu mai este vizibilă.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Vezi partidele' })).toHaveAttribute('href', '/partide');
  // partide.b.private-partida: nothing about the partidă leaks (no venue, no share).
  await expect(page.getByText('Balta Mock')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Distribuie/ })).toHaveCount(0);
  await expectNoA11yViolations(page);
  expect(errors).toEqual([]);
});

test('partide.spectator.c2 not found on the server (a real unknown id): rendered through the slot, noindex, no notFound()', async ({ page }) => {
  const res = await page.goto(`/partide/${UNKNOWN}`);
  expect(res?.status(), 'a soft not-found state, the route is not a 404 page').toBe(200);
  await expect(page.getByTestId('partida-not-found')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: 'Partida nu a fost găsită.' })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await expect(page).toHaveTitle(/Partida nu a fost găsită/);
});

test('partide.spectator.c2 error: «Nu am putut încărca partida.» + «Reîncearcă» reads it again', async ({ page }) => {
  const errors = collectConsoleErrors(page, { ignore: EXPECTED_CONSOLE });
  const calls = await mockCms(page, { statuses: { [ENDED]: [500, 200] } });
  await open(page, ENDED);
  await expect(page.getByRole('heading', { level: 1, name: 'Nu am putut încărca partida.' })).toBeVisible();
  await expect(page.getByText('Verifică conexiunea și reîncearcă.')).toBeVisible();
  await expectNoA11yViolations(page);
  await page.getByRole('button', { name: 'Reîncearcă' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Balta Mock' })).toBeVisible();
  expect(calls.session).toBe(2);
  expect(errors).toEqual([]);
});

test('partide.spectator b.private-partida a partidă that goes private: the refetch\'s 404 replaces the shown page with «not found»', async ({ page }) => {
  const errors = collectConsoleErrors(page, { ignore: EXPECTED_CONSOLE });
  // First read: the public partidă (as the server's cached copy would hydrate it); the next: 404.
  const calls = await mockCms(page, { statuses: { [LIVE]: [200, 404] } });
  await open(page, LIVE);
  await expect(page.getByRole('heading', { level: 1, name: 'Balta Mock' })).toBeVisible();
  await page.clock.runFor(61_000);
  await expect.poll(() => calls.session).toBe(2);
  await expect(page.getByRole('heading', { level: 1, name: 'Partida nu a fost găsită.' })).toBeVisible();
  await expect(page.getByText('Balta Mock')).toHaveCount(0);
  await expect(page.getByTestId('partida-spectator')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('partide.spectator b.private-partida a network blip keeps the shown partidă (fish)', async ({ page }) => {
  const calls = await mockCms(page, { statuses: { [LIVE]: [200, 500] } });
  await open(page, LIVE);
  await expect(page.getByRole('heading', { level: 1, name: 'Balta Mock' })).toBeVisible();
  await page.clock.runFor(61_000);
  await expect.poll(() => calls.session).toBe(2);
  await expect(page.getByRole('heading', { level: 1, name: 'Balta Mock' })).toBeVisible();
});

test('partide.spectator.c3 a broken hero photo: fish\'s fish on the indigo tint, never the broken-image glyph', async ({ page }) => {
  await mockCms(page);
  // Registered after mockCms: wins for this one photo.
  await page.route(PHOTO('c-2'), r => r.fulfill({ status: 404, contentType: 'text/plain', body: 'gone' }));
  await open(page, ENDED, 1280);
  const hero = page.locator('[data-t3="photo"]');
  await expect(hero.getByTestId('partida-photo-failed')).toHaveCount(1);
  await expect(hero.getByTestId('partida-photo-failed')).toBeVisible();
  // No <img> left in the hero that failed (naturalWidth 0 once complete).
  const broken = await hero.locator('img').evaluateAll(imgs => imgs.filter(i => (i as HTMLImageElement).complete && (i as HTMLImageElement).naturalWidth === 0).length);
  expect(broken).toBe(0);
});

/* ------------------------------------------------------------------------------------------------
 * c3, c6, c7, c9, c13 — the loaded page, every width
 * ---------------------------------------------------------------------------------------------- */

for (const width of WIDTHS) {
  test(`partide.spectator.c3 c6 c7 c13 ended partidă at ${width}: title row, photos, total, tiles, venue — axe clean`, async ({ page }) => {
    const errors = collectConsoleErrors(page, { ignore: EXPECTED_CONSOLE });
    await mockCms(page);
    await open(page, ENDED, width);
    const view = spectator(page);
    await expect(page.getByRole('heading', { level: 1, name: 'Balta Mock' })).toBeVisible();
    // c3: venue name → the lake page; «ÎNCHEIATĂ»; meta «Giurgiu · 7 OCT · 2 h» (unit apart, rule 10).
    await expect(page.getByTestId('partida-venue-link')).toHaveAttribute('href', '/balti/e2e-lake-1');
    await expect(page.getByTestId('partida-status')).toHaveText('ÎNCHEIATĂ');
    const header = page.locator('[data-t3="header"]');
    await expect(header).toContainText('Giurgiu');
    await expect(header).toContainText('7 OCT');
    await expect(header).toContainText('2\u00a0h');
    await expect(header).not.toContainText('2h');
    // c3: the photo count badge.
    await expect(view.getByTestId('partida-photo-count')).toHaveText('2');
    // c6: «TOTAL CÂNTĂRIT» 13,33 kg, the top species, «medie 4,4 kg».
    const total = view.getByTestId('partida-total');
    await expect(total).toContainText('Total cântărit');
    await expect(total).toContainText('13,33');
    await expect(total.getByRole('list', { name: 'Pe specii' }).getByRole('listitem')).toHaveCount(3);
    await expect(total).toContainText('Somn 8,69');
    await expect(total).toContainText('medie 4,4');
    // c7: the tiles (the visible set — the phone's or the summary column's).
    const tiles = view.getByTestId('partida-tiles').filter({ visible: true });
    await expect(tiles).toHaveCount(1);
    await expect(tiles.getByTestId('partida-tile-max')).toContainText('8,69');
    await expect(tiles.getByTestId('partida-tile-max')).toContainText('cea mai mare');
    await expect(tiles.getByTestId('partida-tile-count')).toContainText('4');
    await expect(tiles.getByTestId('partida-tile-duration')).toContainText('2');
    await expect(tiles.getByTestId('partida-tile-duration')).toContainText('durată');
    // c13: the venue card links to the lake, «Giurgiu · 7 OCT · 2 h».
    const venue = view.getByTestId('partida-venue').filter({ visible: true });
    await expect(venue).toHaveAttribute('href', '/balti/e2e-lake-1');
    expect(await venue.textContent()).toContain('Giurgiu · 7 OCT · 2\u00a0h');
    // Units never run into the number (rule 10): «8,69 kg» is two elements.
    await expect(tiles.getByTestId('partida-tile-max').locator('[data-unit]')).toHaveText(/kg/);
    // No horizontal scroll.
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expectNoA11yViolations(page);
    expect(errors).toEqual([]);
  });
}

test('partide.spectator.c3 c7 c14 live partidă: «ÎN DESFĂȘURARE», elapsed «de 2 h», polled every 60 s', async ({ page }) => {
  const calls = await mockCms(page);
  await open(page, LIVE);
  await expect(page.getByTestId('partida-status')).toHaveText('ÎN DESFĂȘURARE');
  expect(await page.getByTestId('partida-elapsed').textContent()).toBe('de 2\u00a0h');
  const tile = page.getByTestId('partida-tiles').filter({ visible: true }).getByTestId('partida-tile-duration');
  await expect(tile).toContainText('în desfășurare');
  await expect(tile.locator('[data-number]')).toHaveText('2');
  const first = calls.session;
  expect(first).toBe(1);
  await page.clock.runFor(61_000);
  await expect.poll(() => calls.session).toBe(2);
  await page.clock.runFor(61_000);
  await expect.poll(() => calls.session).toBe(3);
});

test('partide.spectator.c14 an ended partidă is not polled', async ({ page }) => {
  const calls = await mockCms(page);
  await open(page, ENDED);
  await expect(page.getByTestId('partida-status')).toHaveText('ÎNCHEIATĂ');
  await page.clock.runFor(3 * 61_000);
  await page.waitForTimeout(300);
  expect(calls.session).toBe(1);
});

test('partide.spectator.c3 c13 public water: the title and the venue card link to /ape-publice/<code>; one member → «Capturi»', async ({ page }) => {
  await mockCms(page);
  await open(page, SOLO);
  await expect(page.getByTestId('partida-venue-link')).toHaveAttribute('href', '/ape-publice/AG-07');
  await expect(spectator(page).getByTestId('partida-venue').filter({ visible: true })).toHaveAttribute('href', '/ape-publice/AG-07');
  await expect(page.getByRole('heading', { name: 'Capturi', exact: true })).toBeVisible();
});

test('partide.spectator.c3 no photo and no venue image: the fish placeholder on the phone, no photo badge', async ({ page }) => {
  await mockCms(page);
  await open(page, BARE, 375);
  await expect(page.getByRole('heading', { level: 1, name: 'Balta Mock' })).toBeVisible();
  await expect(page.getByTestId('partida-photo-count')).toHaveCount(0);
  await expect(page.locator('[data-t3="photo"]')).toHaveCount(0);
  // The back control and the bell sit on the placeholder.
  await expect(page.getByRole('button', { name: 'Înapoi' }).filter({ visible: true })).toBeVisible();
  await expect(followButton(page)).toBeVisible();
  // Rows without a photo are plain (no lightbox).
  await expect(page.getByTestId('partida-catch').getByRole('button')).toHaveCount(0);
  await expectNoA11yViolations(page);
});

test('partide.spectator.c6 c9 c10 c11 no catches: «—», no chart, no highlight, «Nicio captură încă.»', async ({ page }) => {
  await mockCms(page);
  await open(page, EMPTY);
  const view = spectator(page);
  await expect(view.getByTestId('partida-total')).toContainText('—');
  await expect(view.getByTestId('partida-total')).not.toContainText('kg');
  await expect(view.getByTestId('partida-evolution')).toHaveCount(0);
  await expect(view.getByTestId('partida-biggest')).toHaveCount(0);
  await expect(view.getByTestId('partida-catches')).toContainText('Nicio captură încă.');
  await expect(view.getByTestId('partida-tiles').filter({ visible: true }).getByTestId('partida-tile-max')).toContainText('—');
  // The venue image is the hero when there is no catch photo.
  await expect(page.locator('[data-t3="photo"] img')).toHaveCount(1);
});

/* ------------------------------------------------------------------------------------------------
 * c9 – c12 — chart, highlight, catches, lightbox
 * ---------------------------------------------------------------------------------------------- */

test('partide.spectator.c9 «Evoluția capturilor»: «cumulat · N kg», arrows name each catch', async ({ page }) => {
  await mockCms(page);
  await open(page, ENDED);
  const chart = page.getByTestId('partida-evolution');
  await expect(chart.getByRole('heading', { name: 'Evoluția capturilor' })).toBeVisible();
  const header = chart.getByTestId('partida-evolution-header');
  await expect(header).toHaveText(/cumulat · 13,33\s*kg/);
  await chart.getByRole('img').focus();
  await page.keyboard.press('Home');
  await expect(header).toHaveText('Caras · 1,24 kg · 13:30');
  await page.keyboard.press('ArrowRight');
  await expect(header).toHaveText('Somn · 8,69 kg · 14:00');
  await page.keyboard.press('Escape');
  await expect(header).toHaveText(/cumulat/);
});

test('partide.spectator.c10 c11 the biggest catch and the catch list: the max in indigo, photo rows open the captioned lightbox', async ({ page }) => {
  await mockCms(page);
  await open(page, ENDED);
  const view = spectator(page);
  // c10: no photo on the biggest catch → amber tile, not a button.
  const biggest = view.getByTestId('partida-biggest');
  await expect(biggest).toContainText('8,69');
  await expect(biggest).toContainText('Somn · 14:00');
  await expect(biggest.getByRole('button')).toHaveCount(0);
  // c11: «Capturile echipei» (2 members), 4 rows; «Captură» for the unnamed; the max highlighted.
  const list = view.getByTestId('partida-catches');
  await expect(list.getByRole('heading', { name: 'Capturile echipei' })).toBeVisible();
  const rows = list.getByTestId('partida-catch');
  await expect(rows).toHaveCount(4);
  await expect(rows.nth(0)).toContainText('Crap');
  await expect(rows.nth(0)).toContainText('14:30');
  await expect(rows.nth(3)).toContainText('Captură');
  await expect(list.locator('[data-max]')).toContainText('Somn');
  // A photo row opens the lightbox with «Crap · 3,4 kg · 14:30».
  await rows.nth(0).getByRole('button').click();
  const box = page.getByTestId('lightbox');
  await expect(box).toBeVisible();
  await expect(box.getByTestId('lightbox-footer')).toHaveText('Crap · 3,4 kg · 14:30');
  await page.keyboard.press('ArrowRight');
  await expect(box.getByTestId('lightbox-footer')).toHaveText('Caras · 1,24 kg · 13:30');
  await page.keyboard.press('Escape');
  await expect(box).toBeHidden();
  // The photo pill opens it too (before the gallery ships, B8).
  await view.getByTestId('partida-photo-count').click();
  await expect(box.getByTestId('lightbox-footer')).toHaveText('Crap · 3,4 kg · 14:30');
});

test('partide.spectator.c10 a biggest catch with a photo opens the lightbox on it', async ({ page }) => {
  await mockCms(page);
  FIXTURES[BROKEN] = detail(BROKEN, { maxCatch: CATCHES[0], maxKg: 3.4 });
  await open(page, BROKEN);
  await page.getByTestId('partida-biggest').getByRole('button').click();
  await expect(page.getByTestId('lightbox-footer')).toHaveText('Crap · 3,4 kg · 14:30');
});

test('partide.spectator.c12 more catches than shown: «Vezi toate» stays hidden until /partide/[id]/capturi ships (rule 4)', async ({ page }) => {
  await mockCms(page);
  await open(page, MORE);
  await expect(page.getByTestId('partida-catch')).toHaveCount(4);
  await expect(page.getByRole('link', { name: /Vezi toate/ })).toHaveCount(0);
});

/* ------------------------------------------------------------------------------------------------
 * c4, c5, c8 — follow the partidă, the anglers
 * ---------------------------------------------------------------------------------------------- */

test('partide.spectator.c4 signed out: «Urmărește» goes to sign-in with this page as the way back', async ({ page }) => {
  const calls = await mockCms(page);
  await open(page, ENDED);
  await followButton(page).click();
  await expect(page).toHaveURL(/\/intra\?next=%2Fpartide%2Fe2e-ended/);
  expect(calls.follow).toEqual([]);
});

test('partide.spectator.c8 signed out: members with names («Pescar» without one), no counts, no member follow (fish) — the bell is the one «Urmărește»', async ({ page }) => {
  await mockCms(page);
  await open(page, ENDED);
  const members = spectator(page).getByTestId('partida-members').filter({ visible: true });
  await expect(members.getByRole('heading', { name: /Pescari\s*2/ })).toBeVisible();
  const rows = members.getByTestId('partida-member');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(1)).toContainText('Pescar');
  await expect(members).not.toContainText('urmăritor');
  await expect(rows.nth(0).getByRole('link', { name: 'Ion Pescar' })).toHaveAttribute('href', '/pescari/e2e-angler-1');
  await expect(followButton(page)).toHaveCount(1);
  await expect(members.getByRole('button')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Urmărește/ }).filter({ visible: true })).toHaveCount(1);
});

test.describe('signed in', () => {
  // Signed in, /partide/* runs the live layer: the shared Firestore fake, so nothing can reach the
  // shared Firebase project (helpers/fake-live.ts); a test fails if a Firebase request was tried.
  let fake: FakeLiveHandle;
  test.beforeEach(async ({ context, page }) => {
    await signIn(context, jwt);
    fake = await installFakeLive(page);
  });
  test.afterEach(() => {
    expect(fake.attempts, 'no request may reach Firebase').toEqual([]);
  });

  test('partide.spectator.c4 c5 first follow: intro dialog → follow + toast; again → unfollow «Notificări dezactivate.»', async ({ page }) => {
    const calls = await mockCms(page);
    await open(page, ENDED);
    await page.evaluate(() => localStorage.removeItem('bluvi.partide.bellIntroSeen.v1'));
    const button = followButton(page);
    await expect(button).toHaveText('Urmărește');
    await button.click();
    const dialog = page.getByRole('dialog', { name: 'Notificări pentru această partidă' });
    await expect(dialog).toBeVisible();
    await expectNoA11yViolations(page);
    await dialog.getByRole('button', { name: 'Activează notificările' }).click();
    await expect(page.getByText('Vei primi notificări pentru capturile din această partidă.')).toBeVisible();
    await expect(button).toHaveText('Notificări active');
    expect(calls.follow).toEqual([ENDED]);
    // The intro is seen: the next follow goes straight through; an unfollow never gates.
    await button.click();
    await expect(page.getByText('Notificări dezactivate.')).toBeVisible();
    await expect(button).toHaveText('Urmărește');
    expect(calls.unfollow).toEqual([ENDED]);
    await button.click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect.poll(() => calls.follow.length).toBe(2);
  });

  test('partide.spectator.c5 «Nu acum» closes without following and retires the intro', async ({ page }) => {
    const calls = await mockCms(page);
    await open(page, ENDED);
    await page.evaluate(() => localStorage.removeItem('bluvi.partide.bellIntroSeen.v1'));
    await followButton(page).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Nu acum' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(calls.follow).toEqual([]);
    expect(await page.evaluate(() => localStorage.getItem('bluvi.partide.bellIntroSeen.v1'))).toBe('true');
  });

  test('partide.spectator.c5 notifications off in the profile: «Activează și urmărește» turns them on AND follows', async ({ page }) => {
    const calls = await mockCms(page, { notificationsEnabled: false });
    await open(page, ENDED, 375);
    await followButton(page).click();
    const dialog = page.getByRole('dialog', { name: 'Notificările Bluvi sunt dezactivate' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Activează și urmărește' }).click();
    await expect.poll(() => calls.notifications).toEqual([{ enabled: true }]);
    await expect.poll(() => calls.follow).toEqual([ENDED]);
    await expect(followButton(page)).toHaveText('Notificări active');
  });

  test('partide.spectator.c5 a failed follow rolls back with «Nu am putut actualiza notificările. Încearcă din nou.»', async ({ page }) => {
    await mockCms(page, { followStatus: 500 });
    await open(page, ENDED);
    await page.evaluate(() => localStorage.setItem('bluvi.partide.bellIntroSeen.v1', 'true'));
    await followButton(page).click();
    await expect(page.getByText('Nu am putut actualiza notificările. Încearcă din nou.')).toBeVisible();
    await expect(followButton(page)).toHaveText('Urmărește');
  });

  test('partide.spectator.c4 an already followed partidă shows «Notificări active»', async ({ page }) => {
    await mockCms(page, { follows: [ENDED] });
    await open(page, ENDED);
    await expect(followButton(page)).toHaveText('Notificări active');
  });

  test('partide.spectator.c8 members: «1 urmăritor» / «25 de urmăritori», no button on the viewer\'s own row', async ({ page }) => {
    FIXTURES[SOLO] = detail(SOLO, {
      members: [
        { uid: 'e2e-angler-1', name: 'Ion Pescar', avatarUrl: null },
        { uid: 'e2e-angler-2', name: 'Ana', avatarUrl: null },
        { uid: selfId, name: 'Eu', avatarUrl: null },
      ],
    });
    await mockCms(page);
    await open(page, SOLO);
    const rows = spectator(page).getByTestId('partida-members').filter({ visible: true }).getByTestId('partida-member');
    await expect(rows.nth(0)).toContainText('1 urmăritor');
    await expect(rows.nth(1)).toContainText('25 de urmăritori');
    await expect(rows.nth(0).getByRole('button', { name: /Urmărește pe Ion Pescar/ })).toBeVisible();
    await expect(rows.nth(2).getByRole('button')).toHaveCount(0);
    await expect(rows.nth(2)).toContainText('(tu)');
  });

  test('partide.spectator.c1 the viewer\'s active partidă is checked (the spectator view stays meanwhile); their own opens the member view', async ({ page }) => {
    // The pointer names this partidă; its live projection (the fake) is the member view's data.
    await fake.seed({ docs: { c: { startedAt: new Date(NOW.getTime() - 3_600_000).toISOString(), status: 'active', lakeName: 'Balta Mock', hostUid: selfId, members: [], rods: [], catches: [] } } });
    const calls = await mockCms(page, { active: { documentId: LIVE }, activeDelayMs: 1500 });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/partide/${LIVE}`);
    // Meanwhile: the public page (never a skeleton).
    await expect(page.getByRole('heading', { level: 1, name: 'Balta Mock' })).toBeVisible();
    await expect(page.getByTestId('partida-spectator')).toBeVisible();
    // Then the member view (partide.partida, M4-B2).
    await expect(page.getByTestId('partida-member-view')).toBeVisible();
    await expect(page.getByTestId('partida-spectator')).toHaveCount(0);
    expect(calls.active).toBeGreaterThanOrEqual(1);
    expect(await fake.subscribed()).toEqual(['c']);
  });

  test('partide.spectator.c1 someone else\'s partidă (or a failed check) renders the spectator view', async ({ page }) => {
    await mockCms(page, { active: { documentId: 'other' } });
    await open(page, ENDED);
    await expect(page.getByRole('heading', { level: 1, name: 'Balta Mock' })).toBeVisible();
    await expect(page.getByTestId('partida-spectator')).toBeVisible();
    await expect(page.getByTestId('partida-member-view')).toHaveCount(0);
  });
});

/* ------------------------------------------------------------------------------------------------
 * Rendering / SEO — a real ended partidă of the local CMS
 * ---------------------------------------------------------------------------------------------- */

test('partide.spectator SEO: prerendered content, SportsEvent JSON-LD with the venue as Place, a share card', async ({ page, request }) => {
  const html = await (await request.get(`/partide/${REAL_ENDED}`)).text();
  test.skip(html.includes('Partida nu a fost găsită'), `local partidă ${REAL_ENDED} is not public here`);
  const ld = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map(m => JSON.parse(m[1]));
  const event = ld.flat().find((x: { '@type'?: string }) => x['@type'] === 'SportsEvent');
  expect(event, 'SportsEvent JSON-LD').toBeTruthy();
  expect(event.location['@type']).toBe('Place');
  expect(event.startDate).toBeTruthy();
  expect(event.endDate).toBeTruthy();
  // The page itself is in the server HTML (the static shell), not a skeleton: the total and the catches.
  expect(html).toContain('Total cântărit');
  expect(html).toContain('data-testid="partida-catch"');
  await page.goto(`/partide/${REAL_ENDED}`);
  await expect(page.getByTestId('partida-total')).toBeVisible();
  const og = await page.locator('meta[property="og:image"]').getAttribute('content');
  expect(og).toContain(`/partide/${REAL_ENDED}/opengraph-image`);
  const img = await request.get(new URL(og!).pathname);
  expect(img.status()).toBe(200);
  expect(img.headers()['content-type']).toBe('image/png');
});
