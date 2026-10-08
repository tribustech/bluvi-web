import { expect, test, type Page, type Route } from '@playwright/test';
import { installFakeLive, type FakeLiveDoc } from '../e2e/helpers/fake-live';
import { CMS, qaJwt, signIn } from '../e2e/helpers/session';
import { DEFAULT_MASKS, stabilize } from './capture';

/*
 * Partidă · «Statistici» tab (partide.partida-statistici): every state at 375 / 768 / 1280 / 1440 /
 * 1920. Per-user and live, so — like partida-jurnal.visual.spec.ts — the data is the e2e's: the
 * shared Firestore fake (no request may reach Firebase), route-mocked CMS reads (the own list and
 * the same-lake details), a fixed clock and time zone, the real QA session.
 * Baselines are committed only once the owner approves them (README.md).
 */

test.use({ timezoneId: 'Europe/Bucharest' });

const NOW = new Date('2026-10-07T12:00:00.000Z');
const at = (min: number) => new Date(NOW.getTime() - min * 60_000).toISOString();
const LIVE = { documentId: 'e2e-vs-live', clientId: 'e2e-vsc-live' };
const LAKE = 'vs-lake';
const WIDTHS = [375, 768, 1280, 1440, 1920] as const;
let selfId = '';
let jwt = '';

test.beforeAll(async ({ request }) => {
  jwt = await qaJwt(request);
  const me = await request.get(`${CMS}/user/profile`, { headers: { authorization: `Bearer ${jwt}` } });
  selfId = (await me.json()).documentId as string;
});

const ROD = { 1: '#6366F1', 2: '#F97316', 3: '#10B981' } as const;
const CATCHES: FakeLiveDoc['catches'] = [
  { clientId: 'e1', outcome: 'capture', occurredAt: at(160), rodIndex: 1, rodColor: ROD[1], weightKg: 2.4, species: 'Crap', bait: 'Boilies' },
  { clientId: 'e2', outcome: 'capture', occurredAt: at(130), rodIndex: 2, rodColor: ROD[2], weightKg: 8.69, species: 'Somn', bait: 'Porumb' },
  { clientId: 'e3', outcome: 'lost', occurredAt: at(100), rodIndex: 1, rodColor: ROD[1], bait: 'Porumb' },
  { clientId: 'e4', outcome: 'blank', occurredAt: at(70), rodIndex: 2, rodColor: ROD[2] },
  { clientId: 'e5', outcome: 'capture', occurredAt: at(40), rodIndex: null, weightKg: null, species: 'Caras' },
  { clientId: 'e6', outcome: 'capture', occurredAt: at(20), rodIndex: 1, rodColor: ROD[1], weightKg: 1.25, species: 'Crap', bait: 'Boilies' },
];

const doc = (catches: FakeLiveDoc['catches'], rods = true): FakeLiveDoc => ({
  startedAt: at(180),
  status: 'active',
  venueType: 'lake',
  lakeId: LAKE,
  lakeName: 'Balta Mock',
  standName: '7',
  locality: 'Giurgiu',
  anchorLat: 44.4321,
  anchorLong: 26.1234,
  hostUid: selfId,
  joinCode: null,
  visibleOnProfile: true,
  members: [{ uid: selfId, name: 'Eu Pescar', avatar: null, joinedAt: at(170) }],
  rods: rods
    ? [
        { clientId: 'r1', index: 1, label: 'L1', color: ROD[1], runtimePhase: 'idle' },
        { clientId: 'r2', index: 2, label: 'L2', color: ROD[2], runtimePhase: 'idle' },
        { clientId: 'r3', index: 3, label: 'L3', color: ROD[3], runtimePhase: 'idle' },
      ]
    : [],
  catches,
  markers: [],
});

const row = (documentId: string, clientId: string, startedAt: string) => ({
  documentId,
  clientId,
  clientUpdatedAt: null,
  venueType: 'lake',
  lakeId: LAKE,
  lakeName: 'Balta Mock',
  lakeImageUrl: null,
  publicWaterCode: null,
  publicWaterName: null,
  manualVenueName: null,
  standId: null,
  standName: null,
  locality: 'Giurgiu',
  anchorLat: 44.4321,
  anchorLong: 26.1234,
  anchorName: null,
  startedAt,
  endedAt: startedAt,
  plannedDurationMs: null,
  notes: null,
  visibleOnProfile: true,
  status: 'finished',
  targetSpecies: [],
  hostUid: 'someone',
  captures: 0,
  recordKg: null,
  totalKg: null,
});
let id = 1;
const ev = (occurredAt: string, patch: Record<string, unknown>) => ({
  id: id++, documentId: `d${id}`, clientId: `c${id}`, clientUpdatedAt: null, outcome: 'capture', rodIndex: null, rodLabel: null, rodColor: null,
  bait: null, baitType: null, baitSize: null, baitFlavor: null, lane: null, distance: null, lat: null, lng: null, weightKg: null,
  weightEstimated: false, species: null, speciesId: null, photoUrl: null, photoThumbUrl: null, notes: null, occurredAt, photoTagUids: [], ...patch,
});
const SIBLING = row('e2e-vs-a', 'e2e-vsc-a', '2026-10-06T02:00:00.000Z');
const SIBLING_EVENTS = [
  ev('2026-10-06T03:10:00.000Z', { bait: 'Pop-up', distance: 72, weightKg: 5 }),
  ev('2026-10-06T03:40:00.000Z', { bait: 'Pop-up', distance: 72, weightKg: 6 }),
  ev('2026-10-06T03:50:00.000Z', { bait: 'Pop-up', distance: 72, weightKg: 7 }),
];

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

// The loading skeleton is asserted in the e2e (stabilize waits for the network to settle).
type State = 'partida' | 'balta' | 'empty-partida' | 'empty-balta' | 'no-rods' | 'error';

async function setup(page: Page, state: State) {
  const fake = await installFakeLive(page);
  const empty = state === 'empty-partida' || state === 'empty-balta';
  await fake.seed({ docs: { [LIVE.clientId]: doc(empty ? [] : CATCHES, state !== 'no-rods') } });
  await page.route(/tiles\.openfreemap\.org|arcgisonline\.com/, r => r.abort());
  await page.route(/\/feed\/community\//, r => json(r, { error: { status: 404 } }, 404));
  await page.route('**/api/cms/feed/session-follows/mine', r => json(r, { data: { sessionDocumentIds: [] } }));
  await page.route('**/api/cms/feed/sessions/active', r => json(r, { data: { ...LIVE, firestoreId: LIVE.clientId } }));
  const mine = empty ? [] : [SIBLING];
  await page.route(/\/api\/cms\/feed\/sessions\/mine/, r => json(r, { data: mine, meta: { page: 1, pageSize: 100, total: mine.length } }));
  await page.route(/\/api\/cms\/feed\/sessions\/e2e-vs-[a-z]+$/, async r => {
    if (!r.request().url().endsWith(SIBLING.documentId)) return json(r, { error: { status: 404 } }, 404);
    if (state === 'error') return json(r, { error: { status: 500 } }, 500);
    return json(r, { data: { ...SIBLING, joinCode: null, rods: [], members: [], events: SIBLING_EVENTS } });
  });
  return fake;
}

for (const state of ['partida', 'balta', 'empty-partida', 'empty-balta', 'no-rods', 'error'] as const) {
  for (const width of state === 'partida' || state === 'balta' ? WIDTHS : ([375, 1280] as const)) {
    test(`partida-statistici · ${state} · ${width}px`, async ({ page, context }) => {
      test.setTimeout(60_000);
      await signIn(context, jwt);
      const fake = await setup(page, state);
      await page.setViewportSize({ width, height: 900 });
      await page.clock.install({ time: NOW });
      await page.goto(`/partide/${LIVE.documentId}?tab=statistici`);
      await expect(page.getByTestId('partida-stats')).toBeVisible();
      if (state !== 'partida' && state !== 'empty-partida' && state !== 'no-rods') {
        await page.getByTestId('stats-scope').locator('label', { hasText: 'Toate partidele' }).click();
        const ready = { balta: 'stats-tiles', 'empty-balta': 'stats-empty-balta', error: 'stats-error' }[state];
        await expect(page.getByTestId(ready)).toBeVisible({ timeout: 15_000 });
      }
      await stabilize(page);
      await expect(page).toHaveScreenshot(`partida-statistici-${state}-${width}.png`, { fullPage: true, mask: DEFAULT_MASKS.map(s => page.locator(s)) });
      expect(fake.attempts).toEqual([]);
    });
  }
}
