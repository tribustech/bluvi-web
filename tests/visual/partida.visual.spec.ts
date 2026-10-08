import { expect, test, type Page, type Route } from '@playwright/test';
import { installFakeLive, type FakeLiveDoc } from '../e2e/helpers/fake-live';
import { CMS, qaJwt, signIn } from '../e2e/helpers/session';
import { DEFAULT_MASKS, stabilize, VISUAL_WIDTHS } from './capture';

/*
 * Partidă · member view (partide.partida): every whole-page state at 375 / 768 / 1280 / 1440. The
 * member view is per-user and live, so — unlike captureRoute's real-data routes — the data is the
 * e2e's: the shared Firestore fake (no request may reach Firebase) and route-mocked CMS reads, a
 * fixed clock, the real QA session (its documentId is the owner). Read-only (owner 2026-10-08):
 * the recap, the summary and the app hand-over — no tab strip.
 * Baselines are committed only once the owner approves them (README.md).
 */

const NOW = new Date('2026-10-07T12:00:00.000Z');
const at = (min: number) => new Date(NOW.getTime() - min * 60_000).toISOString();
const LIVE = { documentId: 'e2e-v-live', clientId: 'e2e-vc-live' };
const ENDED = { documentId: 'e2e-v-ended', clientId: 'e2e-vc-ended' };
let selfId = '';
let jwt = '';

test.beforeAll(async ({ request }) => {
  jwt = await qaJwt(request);
  const me = await request.get(`${CMS}/user/profile`, { headers: { authorization: `Bearer ${jwt}` } });
  selfId = (await me.json()).documentId as string;
});

const member = (uid: string, name: string) => ({ uid, name, avatar: null, joinedAt: at(130) });
const liveDoc = (): FakeLiveDoc => ({
  startedAt: at(134),
  status: 'active',
  venueType: 'lake',
  lakeName: 'Balta Mock',
  standName: '7',
  locality: 'Giurgiu',
  anchorLat: 44.4321,
  anchorLong: 26.1234,
  hostUid: selfId,
  joinCode: 'K7M2QX',
  visibleOnProfile: true,
  members: [member(selfId, 'Eu Pescar'), member('e2e-angler-2', 'Ana Crap')],
  rods: [{ clientId: 'r1', index: 1, label: 'L1', runtimePhase: 'idle' }, { clientId: 'r2', index: 2, label: 'L2', runtimePhase: 'idle' }],
  catches: [
    { clientId: 'e1', outcome: 'capture', occurredAt: at(100), weightKg: 2.4, species: 'Crap' },
    { clientId: 'e2', outcome: 'capture', occurredAt: at(60), weightKg: 8.69, species: 'Somn' },
  ],
});
const item = {
  documentId: ENDED.documentId,
  clientId: ENDED.clientId,
  clientUpdatedAt: null,
  venueType: 'lake',
  lakeId: 'l',
  lakeName: 'Lacul Istoric',
  lakeImageUrl: null,
  publicWaterCode: null,
  publicWaterName: null,
  manualVenueName: null,
  standId: null,
  standName: null,
  locality: 'Ilfov',
  anchorLat: 44.5,
  anchorLong: 26.2,
  anchorName: null,
  startedAt: at(26 * 60),
  endedAt: at(20 * 60),
  plannedDurationMs: null,
  notes: null,
  visibleOnProfile: true,
  status: 'finished',
  targetSpecies: [],
  hostUid: 'x',
  captures: 0,
  recordKg: null,
  totalKg: null,
};

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

type State = 'live' | 'ended' | 'preparing' | 'download-failed' | 'not-found';

async function setup(page: Page, state: State) {
  const fake = await installFakeLive(page);
  await fake.seed({ docs: state === 'live' ? { [LIVE.clientId]: liveDoc() } : {} });
  await page.route(/\/feed\/community\/sessions\/e2e-/, r => json(r, { error: { status: 404 } }, 404));
  await page.route('**/api/cms/feed/sessions/active', r => json(r, { data: state === 'live' || state === 'preparing' ? { ...LIVE, firestoreId: LIVE.clientId } : null }));
  await page.route(/\/api\/cms\/feed\/sessions\/mine/, r => json(r, { data: state === 'live' || state === 'preparing' ? [] : [item], meta: { page: 1, pageSize: 100, total: 1 } }));
  await page.route(/\/api\/cms\/feed\/sessions\/e2e-v-ended$/, r => {
    if (state === 'not-found') return json(r, { error: { status: 404, details: { bluCode: 'PARTIDA:NOT_FOUND' } } }, 404);
    if (state === 'download-failed') return json(r, { error: { status: 500 } }, 500);
    const { captures: _c, recordKg: _r, totalKg: _t, ...base } = item;
    void [_c, _r, _t];
    return json(r, { data: { ...base, joinCode: 'ARH1VE', rods: [], members: [member(selfId, 'Eu Pescar')], events: [] } });
  });
  return fake;
}

const STATES = ['live', 'ended', 'preparing', 'download-failed', 'not-found'] as const;

for (const state of STATES) {
  for (const width of VISUAL_WIDTHS) {
    test(`partida-member · ${state} · ${width}px`, async ({ page, context }) => {
      await signIn(context, jwt);
      const fake = await setup(page, state);
      await page.setViewportSize({ width, height: 900 });
      await page.clock.install({ time: NOW });
      await page.goto(`/partide/${state === 'live' || state === 'preparing' ? LIVE.documentId : ENDED.documentId}`);
      const marker = { live: 'partida-member-view', ended: 'partida-member-view', preparing: 'partida-preparing', 'download-failed': 'partida-download-failed', 'not-found': 'partida-member-not-found' }[state];
      if (state === 'download-failed') await page.clock.runFor(10_000);
      await expect(page.getByTestId(marker)).toBeVisible();
      await stabilize(page);
      await expect(page).toHaveScreenshot(`partida-member-${state}-${width}.png`, { fullPage: true, mask: DEFAULT_MASKS.map(s => page.locator(s)) });
      expect(fake.attempts).toEqual([]);
    });
  }
}
