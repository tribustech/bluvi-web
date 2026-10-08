import type { Page, Route } from '@playwright/test';
import { routes } from '@/lib/routes';
import { captureRoute } from './capture';

/*
 * «Galeria partidei» (/partide/[id]/galerie, partide.spectator-galerie): every state at 375 / 768 /
 * 1280 / 1440 / 1920 — 32 photos (30 + the next page), one photo, none, a failed first read, the
 * lightbox, a private partidă (not found). Signed out, on route-mocked CMS reads of `e2e-` partide
 * (never read by the server in development), photos as SVGs served by the test in
 * mixed ratios so the masonry staggers. Nothing is written anywhere. The skeleton is asserted by
 * the e2e (c3): a screenshot waits for the network to settle.
 */

const WIDTHS = [375, 768, 1280, 1440, 1920] as const;
const NOW = new Date('2026-10-07T12:00:00.000Z');
const at = (min: number) => new Date(NOW.getTime() - min * 60_000).toISOString();

const FILLS = ['#2F6F4F', '#3B5BA5', '#A5683B', '#6A3BA5', '#A53B5B', '#3B8EA5'];
const DIMS: [number, number][] = [
  [1200, 900],
  [900, 1200],
  [1000, 1000],
  [1600, 900],
  [800, 1000],
];
const svg = (n: number) => {
  const [w, h] = DIMS[n % DIMS.length];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="100%" height="100%" fill="${FILLS[n % FILLS.length]}"/><circle cx="${w / 2}" cy="${h / 2}" r="${Math.min(w, h) / 4}" fill="#ffffff" fill-opacity="0.25"/></svg>`;
};
const PHOTO = (kind: 'grid' | 'full', n: number) => `https://e2e-photos.invalid/${kind}-${n}.svg`;

const SPECIES = ['Crap', 'Somn', null, 'Caras', 'Știucă', 'Plătică'];
const photos = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    clientId: `p-${i}`,
    species: SPECIES[i % SPECIES.length],
    weightKg: i % 6 === 2 ? null : Math.round((2.4 + i * 0.73) * 100) / 100,
    photoUrl: PHOTO('full', i),
    photoGridUrl: PHOTO('grid', i),
    photoThumbUrl: null,
    occurredAt: at(20 + i * 9),
    width: DIMS[i % DIMS.length][0],
    height: DIMS[i % DIMS.length][1],
  }));

const MEMBERS = [
  { uid: 'e2e-a1', name: 'Ion Pescar', avatarUrl: null },
  { uid: 'e2e-a2', name: 'Dan', avatarUrl: null },
  { uid: 'e2e-a3', name: 'Mihai', avatarUrl: null },
];

function detail(id: string, list: ReturnType<typeof photos>, members = MEMBERS) {
  return {
    documentId: id,
    startedAt: at(320),
    endedAt: at(15),
    venueName: 'Balta Mock',
    venueType: 'lake',
    publicWaterCode: null,
    locality: 'Giurgiu',
    lakeId: 'e2e-lake-1',
    imageUrl: null,
    venueImageUrl: null,
    members,
    catchCount: list.length,
    maxKg: null,
    durationMs: 5 * 3_600_000,
    catches: list.slice(0, 10),
    photos: list.slice(0, 12),
    weighedCatches: [],
    maxCatch: null,
    photoCount: list.length,
    hasMoreCatches: list.length > 10,
    anglerStats: null,
  };
}

/** The partidă `id` with `count` photos (`photoStatus` ≠ 200: the photo pages fail; `gone`: the CMS 404). */
function mock(count: number, { photoStatus = 200, gone = false, solo = false } = {}) {
  return async (page: Page) => {
    const list = photos(count);
    const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    await page.route('https://e2e-photos.invalid/**', route => {
      const n = Number(/-(\d+)\.svg$/.exec(route.request().url())?.[1] ?? 0);
      return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: svg(n) });
    });
    await page.route(/\/feed\/community\/sessions\/(e2e-[^/?]+)(\?.*)?$/, route => {
      const id = /sessions\/(e2e-[^/?]+)/.exec(route.request().url())![1];
      if (gone) return json(route, { error: { status: 404 } }, 404);
      return json(route, { data: detail(id, list, solo ? MEMBERS.slice(0, 1) : MEMBERS) });
    });
    await page.route(/\/feed\/community\/sessions\/(e2e-[^/?]+)\/catches(\?.*)?$/, route => {
      if (gone) return json(route, { error: { status: 404 } }, 404);
      if (photoStatus !== 200) return json(route, { error: { status: photoStatus } }, photoStatus);
      const cursor = new URL(route.request().url()).searchParams.get('cursor');
      const start = cursor ? Number(cursor) : 0;
      const next = start + 30 < list.length ? String(start + 30) : null;
      return json(route, { data: list.slice(start, start + 30), meta: { pagination: { pageSize: 30, total: list.length }, nextCursor: next } });
    });
  };
}

async function openLightbox(page: Page) {
  await page.getByTestId('gallery-grid').getByRole('button').nth(1).click();
  await page.getByRole('dialog', { name: /^Galerie · 2 din/ }).waitFor();
}

const route = (id: string) => routes.partidaGallery(id);

captureRoute({ name: 'partide-spectator-galerie', path: route('e2e-vg-many'), widths: WIDTHS, states: [{ name: 'photos', prepare: mock(32) }] });
captureRoute({ name: 'partide-spectator-galerie', path: route('e2e-vg-one'), widths: WIDTHS, states: [{ name: 'one', prepare: mock(1, { solo: true }) }] });
captureRoute({ name: 'partide-spectator-galerie', path: route('e2e-vg-empty'), widths: WIDTHS, states: [{ name: 'empty', prepare: mock(0) }] });
captureRoute({
  name: 'partide-spectator-galerie',
  path: route('e2e-vg-error'),
  widths: WIDTHS,
  states: [
    {
      name: 'error',
      prepare: mock(32, { photoStatus: 500 }),
      setup: async page => {
        await page.getByText('Nu am putut încărca fotografiile.').waitFor({ timeout: 45_000 });
      },
    },
  ],
});
captureRoute({
  name: 'partide-spectator-galerie',
  path: route('e2e-vg-many'),
  widths: WIDTHS,
  states: [{ name: 'lightbox', fullPage: false, prepare: mock(32), setup: openLightbox }],
});
captureRoute({ name: 'partide-spectator-galerie', path: route('e2e-vg-gone'), widths: WIDTHS, states: [{ name: 'not-found', prepare: mock(0, { gone: true }) }] });
