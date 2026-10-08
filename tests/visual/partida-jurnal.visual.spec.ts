import { expect, test, type Page, type Route } from '@playwright/test';
import { installFakeLive, type FakeLiveDoc } from '../e2e/helpers/fake-live';
import { CMS, qaJwt, signIn } from '../e2e/helpers/session';
import { DEFAULT_MASKS, stabilize } from './capture';

/*
 * Partidă · «Jurnal» tab (partide.partida-jurnal): every state at 375 / 768 / 1280 / 1440 / 1920.
 * Per-user and live, so — like partida.visual.spec.ts — the data is the e2e's: the shared Firestore
 * fake (no request may reach Firebase), route-mocked CMS reads, a fixed clock and time zone, the
 * real QA session. Map tiles are blocked (the map shows its navy ground, the pins and markers).
 * Baselines are committed only once the owner approves them (README.md).
 */

test.use({ timezoneId: 'Europe/Bucharest' });

const NOW = new Date('2026-10-07T12:00:00.000Z');
const at = (min: number) => new Date(NOW.getTime() - min * 60_000).toISOString();
const LIVE = { documentId: 'e2e-vj-live', clientId: 'e2e-vjc-live' };
const WIDTHS = [375, 768, 1280, 1440, 1920] as const;
let selfId = '';
let jwt = '';

test.beforeAll(async ({ request }) => {
  jwt = await qaJwt(request);
  const me = await request.get(`${CMS}/user/profile`, { headers: { authorization: `Bearer ${jwt}` } });
  selfId = (await me.json()).documentId as string;
});

const ROD = { 1: '#6366F1', 2: '#F97316' } as const;
const doc = (catches: FakeLiveDoc['catches'], markers: unknown[] = []): FakeLiveDoc => ({
  startedAt: at(180),
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
  members: [{ uid: selfId, name: 'Eu Pescar', avatar: null, joinedAt: at(170) }],
  rods: [
    { clientId: 'r1', index: 1, label: 'L1', color: ROD[1], runtimePhase: 'idle' },
    { clientId: 'r2', index: 2, label: 'L2', color: ROD[2], runtimePhase: 'idle' },
  ],
  catches,
  markers,
});
const CATCHES: FakeLiveDoc['catches'] = [
  { clientId: 'e1', outcome: 'capture', occurredAt: at(160), rodIndex: 1, rodColor: ROD[1], weightKg: 2.4, species: 'Crap', lane: 'center', distance: 60, bait: 'Boilies', lat: 44.4323, lng: 26.1236 },
  { clientId: 'e2', outcome: 'capture', occurredAt: at(130), rodIndex: 2, rodColor: ROD[2], weightKg: 8.69, weightEstimated: true, species: 'Somn', lat: 44.4318, lng: 26.123 },
  { clientId: 'e3', outcome: 'lost', occurredAt: at(100), rodIndex: 1, rodColor: ROD[1], lane: 'left', distance: 40, bait: 'Porumb', lat: 44.4325, lng: 26.124 },
  { clientId: 'e4', outcome: 'blank', occurredAt: at(70), rodIndex: 2, rodColor: ROD[2] },
  { clientId: 'e5', outcome: 'capture', occurredAt: at(40), rodIndex: null, weightKg: null, species: 'Caras', notes: 'lângă stuf' },
];
const MARKERS = [{ clientId: 'mk-1', type: 'hardSpot', lat: 44.4324, lng: 26.1238, label: null, scope: 'anchor', venueType: 'lake' }];

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

type State = 'live' | 'empty' | 'filtered-empty' | 'map' | 'share';

async function setup(page: Page, state: State) {
  const fake = await installFakeLive(page);
  await fake.seed({ docs: { [LIVE.clientId]: doc(state === 'empty' ? [] : CATCHES, MARKERS) } });
  await page.route(/tiles\.openfreemap\.org|arcgisonline\.com/, r => r.abort());
  await page.route(/\/feed\/community\/sessions\/e2e-/, r => json(r, { error: { status: 404 } }, 404));
  await page.route('**/api/cms/feed/session-follows/mine', r => json(r, { data: { sessionDocumentIds: [] } }));
  await page.route('**/api/cms/feed/sessions/active', r => json(r, { data: { ...LIVE, firestoreId: LIVE.clientId } }));
  await page.route(/\/api\/cms\/feed\/sessions\/mine/, r => json(r, { data: [], meta: { page: 1, pageSize: 100, total: 0 } }));
  return fake;
}

for (const state of ['live', 'empty', 'filtered-empty', 'map', 'share'] as const) {
  for (const width of state === 'map' || state === 'share' ? ([375, 1280] as const) : WIDTHS) {
    test(`partida-jurnal · ${state} · ${width}px`, async ({ page, context }) => {
      await signIn(context, jwt);
      const fake = await setup(page, state);
      await page.setViewportSize({ width, height: 900 });
      await page.clock.install({ time: NOW });
      await page.goto(`/partide/${LIVE.documentId}?tab=jurnal`);
      await expect(page.getByTestId('jurnal')).toBeVisible();
      if (state === 'filtered-empty') {
        // L2 ∧ Scăpate: nothing.
        await page.getByTestId('jurnal-filters').getByRole('button', { name: 'L2', exact: true }).click();
        await page.getByTestId('jurnal-filters').getByRole('button', { name: 'Scăpate' }).click();
      }
      // The map: a dialog below 1280; at 1280 the side panel starts closed (it opens by itself only from 1440).
      if (state === 'map') await page.getByTestId('jurnal-map-button').filter({ visible: true }).click();
      if (state === 'share') await page.locator('[data-testid="jurnal-row"][data-client-id="e1"] button').click();
      await stabilize(page);
      await expect(page).toHaveScreenshot(`partida-jurnal-${state}-${width}.png`, { fullPage: state !== 'map' && state !== 'share', mask: [...DEFAULT_MASKS.map(s => page.locator(s)), page.locator('.maplibregl-canvas')] });
      expect(fake.attempts).toEqual([]);
    });
  }
}
