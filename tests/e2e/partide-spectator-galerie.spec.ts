import { expect, test, type Page, type Route } from '@playwright/test';
import { expectNoA11yViolations } from './helpers/a11y';
import { collectConsoleErrors } from './helpers/console';

/*
 * partide.spectator-galerie (/partide/[id]/galerie, T1) — «Galeria partidei».
 * fish: features/partide/screens/SessionGalleryScreen.tsx, components/community/{MasonryPhotoList,
 * MemberAvatars}.tsx, components/CatchLightboxFooter.tsx.
 *
 * Data:
 *  - MOCKED partide: ids starting with `e2e-` are never read by the server in development
 *    (_spectator/load.ts), so the BROWSER's GET /feed/community/sessions/:id and
 *    …/:id/catches?photos=1 answer here (page.route): photo pages (30 + 2), empty, 404, 500, slow.
 *    Read-only: the gallery never writes, and never touches Firestore.
 *  - REAL: one ended public partidă of the local CMS (the server prerender: the first page of photos
 *    and the header in the HTML, JSON-LD, share card) and an unknown id (the not-found state, noindex).
 */

test.use({ timezoneId: 'Europe/Bucharest' });

const NOW = new Date('2026-10-07T12:00:00.000Z');
const MANY = 'e2e-gal-many';
const EMPTY = 'e2e-gal-empty';
const GONE = 'e2e-gal-gone';
const FAILS = 'e2e-gal-fails';
const SLOW = 'e2e-gal-slow';
const SOLO = 'e2e-gal-solo';
const REAL = process.env.E2E_PARTIDA_ID ?? 'perfseedfq3otnzlrafuws4b';
const UNKNOWN = 'zzunknownpartida000000001';
const WIDTHS = [375, 768, 1280, 1440, 1920] as const;
const EXPECTED_CONSOLE = [/Failed to load resource: the server responded with a status of (401|404|500)/];

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEUlEQVR4nGM4YWODFTEMLQkAZZlQAVIPr1MAAAAASUVORK5CYII=',
  'base64',
);
const PHOTO = (n: string) => `https://e2e-photos.invalid/${n}.png`;
const at = (minutesAgo: number) => new Date(NOW.getTime() - minutesAgo * 60_000).toISOString();

const SPECIES = ['Crap', 'Somn', null, 'Caras', 'Știucă'];
/** 32 photo catches, newest first; 12:00Z − 30 min = 14:30 in Bucharest. */
const PHOTOS = Array.from({ length: 32 }, (_, i) => ({
  clientId: `p-${i + 1}`,
  species: SPECIES[i % SPECIES.length],
  weightKg: i === 2 ? null : Math.round((3.4 + i * 0.37) * 100) / 100,
  photoUrl: PHOTO(`full-${i + 1}`),
  photoGridUrl: PHOTO(`grid-${i + 1}`),
  photoThumbUrl: PHOTO(`thumb-${i + 1}`),
  occurredAt: at(30 + i * 7),
  width: i % 3 === 0 ? 900 : 1200,
  height: i % 3 === 0 ? 1200 : 900,
}));

const MEMBERS = [
  { uid: 'e2e-a1', name: 'Ion Pescar', avatarUrl: null },
  { uid: 'e2e-a2', name: 'Dan', avatarUrl: null },
  { uid: 'e2e-a3', name: 'Mihai', avatarUrl: null },
];

function detail(id: string, patch: Record<string, unknown> = {}) {
  return {
    documentId: id,
    startedAt: at(300),
    endedAt: at(20),
    venueName: 'Balta Mock',
    venueType: 'lake',
    publicWaterCode: null,
    locality: 'Giurgiu',
    lakeId: 'e2e-lake-1',
    imageUrl: PHOTO('venue'),
    venueImageUrl: PHOTO('venue'),
    members: MEMBERS,
    catchCount: 40,
    maxKg: 14.87,
    durationMs: 4.6 * 3_600_000,
    catches: PHOTOS.slice(0, 10),
    photos: PHOTOS.slice(0, 12),
    weighedCatches: [],
    maxCatch: PHOTOS[0],
    photoCount: 32,
    hasMoreCatches: true,
    anglerStats: null,
    ...patch,
  };
}

const FIXTURES: Record<string, { detail: ReturnType<typeof detail>; photos: typeof PHOTOS }> = {
  [MANY]: { detail: detail(MANY), photos: PHOTOS },
  [EMPTY]: { detail: detail(EMPTY, { photos: [], photoCount: 0, catches: [], maxCatch: null, catchCount: 0 }), photos: [] },
  [FAILS]: { detail: detail(FAILS), photos: PHOTOS },
  [SLOW]: { detail: detail(SLOW), photos: PHOTOS },
  [SOLO]: {
    detail: detail(SOLO, { members: [MEMBERS[0]], photos: PHOTOS.slice(0, 1), photoCount: 1 }),
    photos: PHOTOS.slice(0, 1),
  },
};

type Calls = { session: number; pages: (string | null)[] };

/** The browser's CMS reads of a mocked partidă; `photoStatuses` is a queue of statuses for the photo pages. */
async function mockCms(page: Page, { photoStatuses = [] as number[], photoDelayMs = 0 } = {}): Promise<Calls> {
  const calls: Calls = { session: 0, pages: [] };
  const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  await page.route('https://e2e-photos.invalid/**', r => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
  await page.route(/\/feed\/community\/sessions\/(e2e-[^/?]+)(\?.*)?$/, route => {
    const id = /sessions\/(e2e-[^/?]+)/.exec(route.request().url())![1];
    calls.session += 1;
    const f = FIXTURES[id];
    return f ? json(route, { data: f.detail }) : json(route, { error: { status: 404 } }, 404);
  });
  await page.route(/\/feed\/community\/sessions\/(e2e-[^/?]+)\/catches(\?.*)?$/, async route => {
    const url = new URL(route.request().url());
    const id = /sessions\/(e2e-[^/?]+)\/catches/.exec(url.pathname)![1];
    expect(url.searchParams.get('photos'), 'photos only').toBe('1');
    expect(url.searchParams.get('pageSize'), '30 a page').toBe('30');
    const cursor = url.searchParams.get('cursor');
    calls.pages.push(cursor);
    if (photoDelayMs) await new Promise(r => setTimeout(r, photoDelayMs));
    const status = photoStatuses.length ? photoStatuses.shift()! : 200;
    if (status !== 200) return json(route, { error: { status, message: 'mock' } }, status);
    const f = FIXTURES[id];
    if (!f) return json(route, { error: { status: 404 } }, 404);
    const start = cursor ? Number(cursor) : 0;
    const data = f.photos.slice(start, start + 30);
    const next = start + 30 < f.photos.length ? String(start + 30) : null;
    return json(route, { data, meta: { pagination: { pageSize: 30, total: f.photos.length }, nextCursor: next } });
  });
  return calls;
}

async function open(page: Page, id: string, width = 1280) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(`/partide/${id}/galerie`);
}

const grid = (page: Page) => page.getByTestId('gallery-grid');
const tiles = (page: Page) => grid(page).getByRole('button', { name: /^Deschide fotografia/ });

/* ------------------------------------------------------------------------------------------------
 * c1 + c2 — the header and the masonry, every width
 * ---------------------------------------------------------------------------------------------- */

for (const width of WIDTHS) {
  test(`partide.spectator-galerie.c1 c2 at ${width}: «Galerie», faces + «Ion Pescar, Dan și Mihai · 32 de fotografii», close, 30 tiles then the next page — axe clean`, async ({ page }) => {
    const errors = collectConsoleErrors(page, { ignore: EXPECTED_CONSOLE });
    const calls = await mockCms(page);
    await open(page, MANY, width);
    await expect(page.getByRole('heading', { level: 1, name: 'Galerie' })).toBeVisible();
    const subtitle = page.getByTestId('gallery-subtitle');
    await expect(subtitle).toHaveText('Ion Pescar, Dan și Mihai · 32 de fotografii');
    // fish MemberAvatars: the faces beside the names (initials, three at most), decorative.
    const faces = page.getByTestId('gallery-faces');
    await expect(faces.locator('[aria-hidden="true"]').first()).toHaveText('IPDAMI');
    // fish GalleryScreenHeader: a round ✕ on the RIGHT of the title (where the Lightbox's ✕ is), not
    // a ← on the left.
    const close = page.getByRole('button', { name: 'Închide galeria' });
    await expect(close).toBeVisible();
    await expect(close.locator('svg')).toHaveCount(1);
    const closeBox = (await close.boundingBox())!;
    const titleBox = (await page.getByRole('heading', { level: 1, name: 'Galerie' }).boundingBox())!;
    expect(closeBox.x, 'the ✕ sits right of the title').toBeGreaterThan(titleBox.x + titleBox.width - 1);
    const bodyBox = (await page.getByTestId('gallery-body').boundingBox())!;
    expect(Math.abs(closeBox.x + closeBox.width - (bodyBox.x + bodyBox.width)), 'flush with the content\'s right edge').toBeLessThan(2);
    expect(await close.evaluate(el => parseFloat(getComputedStyle(el).borderRadius)), 'round').toBeGreaterThanOrEqual(closeBox.width / 2 - 1);
    // c2: the first page — 30 tiles (on a tall wide screen the footer is in view at once and the next
    // page follows straight away), the masonry placed (two columns on a phone, more as it widens).
    await expect.poll(() => tiles(page).count()).toBeGreaterThanOrEqual(30);
    expect(calls.pages[0]).toBeNull();
    await expect(grid(page)).toHaveAttribute('data-columns', width < 768 ? '2' : /^[3-9]$/);
    await expect(tiles(page).first()).toHaveAccessibleName('Deschide fotografia: Crap · 3,4 kg');
    await expect(tiles(page).nth(2)).toHaveAccessibleName('Deschide fotografia'); // no species, no kg
    // Units never run into the number (rule 10): the tile's kg is its own element.
    await expect(tiles(page).first()).toContainText('3,4');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expectNoA11yViolations(page);
    // Loading more at the end (fish onEndReached): the next cursor, 32 tiles, the order kept.
    await page.getByTestId('gallery-body').evaluate(el => el.scrollIntoView({ block: 'end' }));
    await page.mouse.wheel(0, 4000);
    await expect(tiles(page)).toHaveCount(32);
    expect(calls.pages).toEqual([null, '30']);
    await expect(tiles(page).last()).toHaveAccessibleName(/^Deschide fotografia: Somn · 14,87 kg$/);
    expect(errors).toEqual([]);
  });
}

test('partide.spectator-galerie.c1 one angler, one photo: «Ion Pescar · 1 fotografie»', async ({ page }) => {
  await mockCms(page);
  await open(page, SOLO, 375);
  await expect(page.getByTestId('gallery-subtitle')).toHaveText('Ion Pescar · 1 fotografie');
  await expect(tiles(page)).toHaveCount(1);
});

test('partide.spectator-galerie.c1 the close control: back to the partidă (the page before), else /partide/[id]', async ({ page }) => {
  await mockCms(page);
  // Opened directly (a shared link): no page of ours before → the partidă.
  await open(page, MANY, 1280);
  await page.getByRole('button', { name: 'Închide galeria' }).click();
  await expect(page).toHaveURL(new RegExp(`/partide/${MANY}$`));
  await expect(page.getByTestId('partida-spectator')).toBeVisible();
  // The breadcrumb band from 768: Partide › Partidă la Balta Mock › Galerie.
  await page.goto(`/partide/${MANY}/galerie`);
  await expect(page.getByRole('link', { name: 'Partidă la Balta Mock' })).toHaveAttribute('href', `/partide/${MANY}`);
});

/* ------------------------------------------------------------------------------------------------
 * The way in — the spectator hero (rule 1: Airbnb's «Show all photos»)
 * ---------------------------------------------------------------------------------------------- */

test('partide.spectator-galerie way in from 768: «Vezi toate fotografiile (32)» on the partidă → the gallery; ✕ returns', async ({ page }) => {
  await mockCms(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/partide/${MANY}`);
  const all = page.getByRole('link', { name: 'Vezi toate fotografiile (32)' });
  await expect(all).toBeVisible();
  await expect(all).toHaveAttribute('href', `/partide/${MANY}/galerie`);
  // From 768 the grid tiles keep the lightbox.
  await expect(page.getByRole('button', { name: 'Deschide fotografia 1 din 12' })).toBeVisible();
  await all.click();
  await expect(page).toHaveURL(new RegExp(`/partide/${MANY}/galerie$`));
  await expect(tiles(page)).toHaveCount(30);
  await page.getByRole('button', { name: 'Închide galeria' }).click();
  await expect(page).toHaveURL(new RegExp(`/partide/${MANY}$`));
});

test('partide.spectator-galerie way in on a phone: the photo count pill (fish openGallery) → the gallery', async ({ page }) => {
  await mockCms(page);
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto(`/partide/${MANY}`);
  const pill = page.getByTestId('partida-photo-count');
  await expect(pill).toHaveText('32');
  await expect(pill).toHaveAccessibleName('Galerie: 32 de fotografii');
  await expect(page.getByRole('link', { name: /Vezi toate fotografiile/ })).toBeHidden();
  await pill.click();
  await expect(page).toHaveURL(new RegExp(`/partide/${MANY}/galerie$`));
});

/* ------------------------------------------------------------------------------------------------
 * c2 — the lightbox with fish's catch footer
 * ---------------------------------------------------------------------------------------------- */

test('partide.spectator-galerie.c2 a photo opens the lightbox: big kg, «specie · ora», the roster; ← → page; the last loaded asks for the next page', async ({ page }) => {
  // No console errors around the lightbox (React's DOM-nesting warnings — a <div> inside a <p> — are errors).
  const errors = collectConsoleErrors(page, { ignore: EXPECTED_CONSOLE });
  const calls = await mockCms(page);
  await open(page, MANY, 1280);
  await tiles(page).nth(1).click();
  const dialog = page.getByTestId('lightbox');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Galerie · 2 din 32');
  const footer = page.getByTestId('gallery-lightbox-footer');
  // p-2: Somn, 3,77 kg, 12:00Z − 37 min = 14:23 Bucharest.
  await expect(footer).toContainText('3,77');
  await expect(footer.locator('.t-heading')).toHaveText('kg');
  await expect(footer).toContainText('Somn · 14:23');
  await expect(footer).toContainText('Ion Pescar, Dan și Mihai');
  await expect(dialog.locator('img').first()).toHaveAttribute('src', /full-2\.png/);
  await page.keyboard.press('ArrowLeft');
  await expect(dialog).toContainText('Galerie · 1 din 32');
  await expect(footer).toContainText('Crap · 14:30');
  // A catch with no kg and no species: no kg block, the hour only.
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(dialog).toContainText('Galerie · 3 din 32');
  await expect(footer.locator('.t-display')).toHaveCount(0);
  await expect(footer).toContainText('14:16');
  await expectNoA11yViolations(page);
  // Paging to the 30th (the last loaded) asks for the next page; → then goes on to 31.
  for (let i = 3; i < 30; i++) await page.keyboard.press('ArrowRight');
  await expect(dialog).toContainText('Galerie · 30 din 32');
  await expect.poll(() => calls.pages).toEqual([null, '30']);
  await expect(tiles(page)).toHaveCount(32);
  await page.keyboard.press('ArrowRight');
  await expect(dialog).toContainText('Galerie · 31 din 32');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  expect(errors).toEqual([]);
});

/* ------------------------------------------------------------------------------------------------
 * c3 — empty, loading, failures
 * ---------------------------------------------------------------------------------------------- */

for (const width of [375, 1280] as const) {
  test(`partide.spectator-galerie.c3 empty at ${width}: «Nicio fotografie încă.», «0 fotografii», the way back`, async ({ page }) => {
    const errors = collectConsoleErrors(page, { ignore: EXPECTED_CONSOLE });
    await mockCms(page);
    await open(page, EMPTY, width);
    await expect(page.getByTestId('gallery-empty')).toBeVisible();
    await expect(page.getByTestId('gallery-empty')).toContainText('Nicio fotografie încă.');
    await expect(page.getByTestId('gallery-subtitle')).toHaveText('Ion Pescar, Dan și Mihai · 0 fotografii');
    await expect(page.getByRole('link', { name: 'Înapoi la partidă' })).toHaveAttribute('href', `/partide/${EMPTY}`);
    await expect(page.getByTestId('gallery-grid')).toHaveCount(0);
    await expectNoA11yViolations(page);
    expect(errors).toEqual([]);
  });
}

test('partide.spectator-galerie.c3 loading: the masonry skeleton (and the subtitle shimmer) until the first page lands', async ({ page }) => {
  await mockCms(page, { photoDelayMs: 1500 });
  await open(page, SLOW, 1280);
  await expect(page.getByTestId('masonry-skeleton')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: 'Galerie' })).toBeVisible();
  await expect(tiles(page)).toHaveCount(30);
  await expect(page.getByTestId('masonry-skeleton')).toHaveCount(0);
});

test('partide.spectator-galerie.c3 a failed first read: an error card with a retry — never an empty gallery (rule 4)', async ({ page }) => {
  const errors = collectConsoleErrors(page, { ignore: EXPECTED_CONSOLE });
  await mockCms(page, { photoStatuses: [500] });
  await open(page, FAILS, 1280);
  await expect(page.getByText('Nu am putut încărca fotografiile.')).toBeVisible();
  await expect(page.getByTestId('gallery-empty')).toHaveCount(0);
  await page.getByRole('button', { name: 'Încearcă din nou' }).click();
  await expect(tiles(page)).toHaveCount(30);
  expect(errors).toEqual([]);
});

test('partide.spectator-galerie not found: a private / unknown partidă (the CMS 404) — the partidă\'s not-found state, nothing leaks', async ({ page }) => {
  await mockCms(page);
  await open(page, GONE, 1280);
  await expect(page.getByRole('heading', { level: 1, name: 'Partida nu a fost găsită.' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Vezi partidele' })).toHaveAttribute('href', '/partide');
  await expect(page.getByText('Balta Mock')).toHaveCount(0);
  await expect(page.getByTestId('gallery-grid')).toHaveCount(0);
});

test('partide.spectator-galerie not found on the server (a real unknown id): soft not-found, noindex, no photo read', async ({ page }) => {
  const res = await page.goto(`/partide/${UNKNOWN}/galerie`);
  expect(res?.status()).toBe(200);
  await expect(page.getByTestId('partida-not-found')).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
});

/* ------------------------------------------------------------------------------------------------
 * c4 — coming back refetches the partidă
 * ---------------------------------------------------------------------------------------------- */

async function hideAndShow(page: Page) {
  await page.evaluate(() => {
    const set = (v: DocumentVisibilityState) => Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => v });
    set('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    set('visible');
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

test('partide.spectator-galerie.c4 the tab coming back (visibilitychange) refetches the partidă — once per return, with the loaded photo page (fish\'s prefix invalidation)', async ({ page }) => {
  const calls = await mockCms(page);
  await open(page, MANY, 1280);
  await expect(tiles(page)).toHaveCount(30);
  await expect.poll(() => calls.session).toBe(1);
  const pages = calls.pages.length;
  await hideAndShow(page);
  await expect.poll(() => calls.session).toBe(2);
  await hideAndShow(page);
  await expect.poll(() => calls.session).toBe(3);
  // Settled: one read per return (fish refetchCommunitySessionOnFocus) — no second read from
  // TanStack's own focus refetch — and, as in fish, the photo page under the same key prefix.
  await page.waitForTimeout(500);
  expect(calls.session).toBe(3);
  expect(calls.pages.length).toBe(pages + 2);
  await expect(tiles(page)).toHaveCount(30);
});

/* ------------------------------------------------------------------------------------------------
 * The real partidă — static HTML, SEO
 * ---------------------------------------------------------------------------------------------- */

test('partide.spectator-galerie the server prerender: the header and the first photos in the HTML, ImageGallery JSON-LD, share card', async ({ page, request }) => {
  const api = await request.get(`http://localhost:1337/api/feed/community/sessions/${REAL}/catches?pageSize=30&photos=1`);
  test.skip(!api.ok(), 'local CMS has no public partidă with photos');
  const body = (await api.json()) as { data: unknown[]; meta: { pagination: { total: number } } };
  const res = await request.get(`/partide/${REAL}/galerie`);
  expect(res.status()).toBe(200);
  const html = await res.text();
  expect(html).toContain('Galerie');
  expect((html.match(/aria-label="Deschide fotografia/g) ?? []).length).toBe(body.data.length);
  const ld = [...html.matchAll(/<script type="application\/ld\+json">([^<]*)<\/script>/g)].flatMap(m => JSON.parse(m[1]) as { '@type': string; image?: unknown[] }[]);
  const gallery = ld.find(x => x['@type'] === 'ImageGallery');
  expect(gallery?.image).toHaveLength(body.data.length);
  expect(ld.some(x => x['@type'] === 'BreadcrumbList')).toBe(true);
  await page.goto(`/partide/${REAL}/galerie`);
  const og = await page.locator('meta[property="og:image"]').getAttribute('content');
  expect(og).toMatch(/\/galerie\/opengraph-image/);
  const img = await request.get(new URL(og!).pathname + new URL(og!).search);
  expect(img.headers()['content-type']).toBe('image/png');
  await expect(page.getByTestId('gallery-subtitle')).toContainText(`${body.meta.pagination.total}`);
});
