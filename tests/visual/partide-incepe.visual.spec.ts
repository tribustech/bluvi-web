import type { Page, Route } from '@playwright/test';
import { CMS } from '../e2e/helpers/session';
import { captureRoute } from './capture';

/*
 * Partide · «Începe o partidă» (/partide/incepe, T4, partide.incepe), signed in as the QA user.
 * Nothing is written and nothing reaches Firebase: the pointer probe answers «no partidă», the own
 * list is empty, the lakes index and the fish catalog are fixed, the satellite / map tiles are
 * blocked (the preview keeps its navy ground). States: the venue step with the location never asked
 * (permission card + «Sugestii»), the venue step with a position (Bucharest: «Aproape de tine»),
 * step 2 for a lake with stands (dimmed preview, the large preview on the right from 1280), step 2
 * for a public water (?apa=).
 */

const json = (route: Route, body: unknown) =>
  route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });

const LAKE = 'e2e-vinc-lake';
const INDEX = [
  { documentId: 'e2e-vinc-1', name: 'Balta Simplă', locality: 'Snagov, Ilfov', lat: 44.47, lng: 26.12, thumb: null },
  { documentId: LAKE, name: 'Balta cu Standuri', locality: 'Snagov, Ilfov', lat: 44.6, lng: 26.3, thumb: null },
];
const FISHES = ['Crap', 'Caras', 'Amur', 'Biban', 'Plătică', 'Somn', 'Știucă'].map((Name, i) => ({
  id: i + 1,
  documentId: `fish-${i + 1}`,
  Name,
  competitionPriority: i < 2 ? i + 1 : null,
  partidaDefaultRank: null,
}));

async function base(page: Page) {
  await page.route(/tiles\.openfreemap\.org|arcgisonline\.com/, r => r.abort());
  await page.route('**/api/cms/feed/sessions/active', r => json(r, { data: null }));
  await page.route(/\/api\/cms\/feed\/sessions\/mine(\?.*)?$/, r => json(r, { data: [], meta: { page: 1, pageSize: 100, total: 0 } }));
  await page.route(/\/feed\/lakes\/index(\?.*)?$/, r => json(r, { data: INDEX }));
  await page.route(/\/fishes(\?.*)?$/, r => json(r, { data: FISHES, meta: {} }));
  const lake = (await (await page.request.get(`${CMS}/feed/lakes/s84u55lo4n9z0emngozttt6e`)).json()).data;
  await page.route(new RegExp(`/feed/lakes/${LAKE}(\\?.*)?$`), r =>
    json(r, {
      data: {
        ...lake,
        documentId: LAKE,
        name: 'Balta cu Standuri',
        countyRef: { documentId: 'c', name: 'Ilfov' },
        cityRef: { documentId: 'd', name: 'Snagov' },
        coordinates: { lat: '44.60000', long: '26.30000' },
        stands: [{ documentId: 'st-2', name: 'Stand 2', coordinates: { lat: '44.55', long: '26.25' } }],
      },
    }),
  );
  // The random suggestions are shuffled per visit: one fixed lake.
  await page.route(/\/feed\/lakes\/search(\?.*)?$/, r => json(r, { data: [], meta: { pagination: { page: 1, pageSize: 10, pageCount: 0, total: 0 } } }));
}

async function located(page: Page) {
  await page.context().grantPermissions(['geolocation']);
  await page.context().setGeolocation({ latitude: 44.43, longitude: 26.1 });
  await base(page);
}

const settled = (testId: string) => async (page: Page) => {
  await page.getByTestId(testId).first().waitFor();
};

captureRoute({
  name: 'partide-incepe',
  path: '/partide/incepe',
  widths: [375, 768, 1280, 1440, 1920],
  states: [
    { name: 'venue-never-asked', signedIn: true, prepare: base, setup: settled('location-permission-card') },
    { name: 'venue-nearby', signedIn: true, prepare: located, setup: settled('venue-section-nearby') },
  ],
});

captureRoute({
  name: 'partide-incepe-lake',
  path: `/partide/incepe?balta=${LAKE}`,
  widths: [375, 768, 1280, 1440, 1920],
  states: [{ name: 'detail-stands', signedIn: true, prepare: located, setup: settled('start-detail') }],
});

captureRoute({
  name: 'partide-incepe-water',
  path: `/partide/incepe?apa=${encodeURIComponent('L:RO10_01.025_L3')}`,
  widths: [375, 1280, 1920],
  states: [{ name: 'detail-water', signedIn: true, prepare: located, setup: settled('start-detail') }],
});
