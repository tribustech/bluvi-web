import { expect, test, type Page, type Route } from '@playwright/test';
import { installFakeLive, type FakeCatchDoc, type FakeLiveDoc } from '../e2e/helpers/fake-live';
import { CMS, qaJwt, signIn } from '../e2e/helpers/session';
import { DEFAULT_MASKS, stabilize } from './capture';

/*
 * Partidă · «Galerie» tab (partide.partida-galerie): every state at 375 / 768 / 1280 / 1440 / 1920.
 * Per-user and live, so — like partida-jurnal.visual.spec.ts — the data is the e2e's: the shared
 * Firestore fake (no request may reach Firebase), route-mocked CMS reads, same-origin SVG photos
 * served by the test (a thumb for the grid, the original for the lightbox and the GIF), a fixed
 * clock and time zone, the real QA session. The GIF progress state is a SLOW export (the originals
 * answer after 10 s, inside the export's 15 s photo deadline — a photo that never answers is a
 * failed photo, not a frozen «0/N»: e2e «c4 a photo that never answers»). Baselines are committed
 * only once the owner approves them (README.md).
 */

test.use({ timezoneId: 'Europe/Bucharest' });

const NOW = new Date('2026-10-07T12:00:00.000Z');
const at = (min: number) => new Date(NOW.getTime() - min * 60_000).toISOString();
const LIVE = { documentId: 'e2e-vg-live', clientId: 'e2e-vgc-live' };
const WIDTHS = [375, 768, 1280, 1440, 1920] as const;
let selfId = '';
let jwt = '';

test.beforeAll(async ({ request }) => {
  jwt = await qaJwt(request);
  const me = await request.get(`${CMS}/user/profile`, { headers: { authorization: `Bearer ${jwt}` } });
  selfId = (await me.json()).documentId as string;
});

const PHOTOS: Record<string, { w: number; h: number; fill: string }> = {
  p1: { w: 1200, h: 900, fill: '#2F6F4F' },
  p2: { w: 900, h: 1200, fill: '#3B5BA5' },
  p3: { w: 1000, h: 1000, fill: '#A5683B' },
  p4: { w: 1600, h: 900, fill: '#6A3BA5' },
  p5: { w: 800, h: 1000, fill: '#A53B5B' },
};
const photo = (n: string) => `/__e2e-galerie/${n}.svg`;
const PHOTO_CATCHES: FakeCatchDoc[] = [
  { clientId: 'g1', outcome: 'capture', occurredAt: at(200), rodIndex: 1, weightKg: 2.4, species: 'Crap', photoUrl: photo('p1'), photoThumbUrl: photo('p1-t') },
  { clientId: 'g2', outcome: 'capture', occurredAt: at(160), rodIndex: 2, weightKg: 8.69, species: 'Somn', photoUrl: photo('p2'), photoThumbUrl: photo('p2-t') },
  { clientId: 'g3', outcome: 'capture', occurredAt: at(120), rodIndex: null, weightKg: null, species: 'Caras', photoUrl: photo('p3'), photoThumbUrl: photo('p3-t') },
  { clientId: 'g4', outcome: 'capture', occurredAt: at(60), rodIndex: 1, weightKg: 12.345, species: null, photoUrl: photo('p4'), photoThumbUrl: photo('p4-t') },
  { clientId: 'g5', outcome: 'capture', occurredAt: at(20), rodIndex: 2, weightKg: 1.25, species: 'Plătică', photoUrl: photo('p5'), photoThumbUrl: photo('p5-t') },
];
const NO_PHOTO: FakeCatchDoc[] = [{ clientId: 'n1', outcome: 'capture', occurredAt: at(190), rodIndex: 1, weightKg: 4.1, species: 'Crap' }];

const doc = (catches: FakeLiveDoc['catches']): FakeLiveDoc => ({
  startedAt: at(240),
  status: 'active',
  venueType: 'lake',
  lakeId: 'l1',
  lakeName: 'Balta Mock',
  standName: '7',
  locality: 'Giurgiu',
  anchorLat: 44.4321,
  anchorLong: 26.1234,
  hostUid: selfId,
  joinCode: 'K7M2QX',
  visibleOnProfile: true,
  members: [{ uid: selfId, name: 'Eu Pescar', avatar: null, joinedAt: at(230) }],
  rods: [],
  catches,
  markers: [],
});

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

type State = 'photos' | 'one' | 'empty' | 'lightbox' | 'gif-progress';

async function setup(page: Page, state: State) {
  const fake = await installFakeLive(page);
  const catches = state === 'empty' ? NO_PHOTO : state === 'one' ? [...NO_PHOTO, PHOTO_CATCHES[0]] : [...NO_PHOTO, ...PHOTO_CATCHES];
  await fake.seed({ docs: { [LIVE.clientId]: doc(catches) } });
  let hold = false;
  await page.route('**/__e2e-galerie/*.svg', async route => {
    const [, name, thumb] = /\/(p\d)(-t)?\.svg/.exec(route.request().url()) ?? [];
    const p = PHOTOS[name];
    if (!p) return route.fulfill({ status: 404 });
    // gif-progress: once the export starts, its loads of the originals (the grid shows the thumbs)
    // answer slowly — the progress shows «0/5» for the shot.
    if (hold && !thumb) await new Promise(r => setTimeout(r, 10_000));
    return route
      .fulfill({
        status: 200,
        contentType: 'image/svg+xml',
        headers: { 'cache-control': 'no-store' },
        body: `<svg xmlns="http://www.w3.org/2000/svg" width="${p.w}" height="${p.h}"><rect width="100%" height="100%" fill="${p.fill}"/><circle cx="${p.w / 2}" cy="${p.h / 2}" r="${Math.min(p.w, p.h) / 4}" fill="#F2C94C"/></svg>`,
      })
      .catch(() => undefined); // the page may be gone once the shot is taken
  });
  await page.route(/\/feed\/community\/sessions\/e2e-/, r => json(r, { error: { status: 404 } }, 404));
  await page.route('**/api/cms/feed/session-follows/mine', r => json(r, { data: { sessionDocumentIds: [] } }));
  await page.route('**/api/cms/feed/sessions/active', r => json(r, { data: { ...LIVE, firestoreId: LIVE.clientId } }));
  await page.route(/\/api\/cms\/feed\/sessions\/mine/, r => json(r, { data: [], meta: { page: 1, pageSize: 100, total: 0 } }));
  return { fake, holdPhotos: () => (hold = true) };
}

for (const state of ['photos', 'one', 'empty', 'lightbox', 'gif-progress'] as const) {
  for (const width of state === 'lightbox' || state === 'gif-progress' ? ([375, 1280] as const) : WIDTHS) {
    test(`partida-galerie · ${state} · ${width}px`, async ({ page, context }) => {
      await signIn(context, jwt);
      const { fake, holdPhotos } = await setup(page, state);
      await page.setViewportSize({ width, height: 900 });
      await page.clock.install({ time: NOW });
      await page.goto(`/partide/${LIVE.documentId}?tab=galerie`);
      await expect(page.getByTestId(state === 'empty' ? 'galerie-empty' : 'galerie')).toBeVisible();
      if (state !== 'empty') await expect(page.getByTestId('galerie-grid')).toHaveAttribute('data-columns', /\d/);
      if (state === 'lightbox') {
        await page.getByTestId('galerie-grid').getByRole('button').nth(3).click();
        await expect(page.getByTestId('lightbox')).toBeVisible();
      }
      if (state === 'gif-progress') {
        await stabilize(page);
        holdPhotos();
        await page.getByTestId('galerie-gif').filter({ visible: true }).click();
        await expect(page.getByTestId('galerie-gif').filter({ visible: true })).toHaveText('0/5');
      }
      await stabilize(page);
      await expect(page).toHaveScreenshot(`partida-galerie-${state}-${width}.png`, { fullPage: state !== 'lightbox', mask: DEFAULT_MASKS.map(s => page.locator(s)) });
      expect(fake.attempts).toEqual([]);
    });
  }
}
