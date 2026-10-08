import { expect, test, type Page, type Route } from '@playwright/test';
import { installFakeLive, type FakeLiveDoc } from '../e2e/helpers/fake-live';
import { CMS, qaJwt, signIn } from '../e2e/helpers/session';
import { DEFAULT_MASKS, stabilize } from './capture';

/*
 * Partidă · «Setări» tab (partide.partida-setari): every state at 375 / 1280 / 1440 / 1920. The tab
 * is per-user and live, so the data is the e2e's: the shared Firestore fake (no request may reach
 * Firebase), route-mocked CMS reads (pointer, own list, ended detail, the lake with or without
 * stands — the local CMS's Chita Lake DTO reshaped), a fixed clock and time zone, the real QA
 * session (its documentId is the owner). `allTabs` renders the tab whether or not its switch in
 * lib/partide-pages is on. Baselines are committed only once the owner approves them (README.md).
 */

const NOW = new Date('2026-10-07T12:00:00.000Z');
const at = (min: number) => new Date(NOW.getTime() - min * 60_000).toISOString();
const LIVE = { documentId: 'e2e-vs-live', clientId: 'e2e-vsc-live' };
const ENDED = { documentId: 'e2e-vs-ended', clientId: 'e2e-vsc-ended' };
const LAKE = 'e2e-vs-lake';
const WIDTHS = [375, 1280, 1440, 1920] as const;
let selfId = '';
let jwt = '';
let lakeDto: Record<string, unknown> = {};

test.use({ timezoneId: 'Europe/Bucharest', locale: 'ro-RO' });

test.beforeAll(async ({ request }) => {
  jwt = await qaJwt(request);
  const me = await request.get(`${CMS}/user/profile`, { headers: { authorization: `Bearer ${jwt}` } });
  selfId = (await me.json()).documentId as string;
  lakeDto = (await (await request.get(`${CMS}/feed/lakes/s84u55lo4n9z0emngozttt6e`)).json()).data;
});

const member = (uid: string, name: string | null) => ({ uid, name, avatar: null, joinedAt: at(130) });
const STANDS = [{ documentId: 'st-2', name: 'Stand 2', coordinates: { lat: '44.55', long: '26.25' } }];

const liveDoc = (patch: Partial<FakeLiveDoc> = {}): FakeLiveDoc => ({
  startedAt: at(134),
  status: 'active',
  venueType: 'lake',
  lakeId: LAKE,
  lakeName: 'Balta Mock',
  locality: 'Giurgiu',
  anchorLat: 44.4321,
  anchorLong: 26.1234,
  plannedDurationMs: 8 * 3_600_000,
  visibleOnProfile: true,
  targetSpecies: [{ documentId: null, name: 'Crap' }],
  hostUid: selfId,
  joinCode: 'K7M2QX',
  members: [member(selfId, 'Eu Pescar'), member('e2e-angler-2', 'Ana Crap')],
  rods: [{ clientId: 'r1', index: 1, label: 'L1', runtimePhase: 'idle' }],
  catches: [{ clientId: 'e1', outcome: 'capture', occurredAt: at(60), weightKg: 2.4, species: 'Crap' }],
  ...patch,
});

const endedItem = {
  documentId: ENDED.documentId,
  clientId: ENDED.clientId,
  clientUpdatedAt: null,
  venueType: 'lake',
  lakeId: LAKE,
  lakeName: 'Lacul Istoric',
  lakeImageUrl: null,
  publicWaterCode: null,
  publicWaterName: null,
  manualVenueName: null,
  standId: 'st-2',
  standName: 'A9',
  locality: 'Ilfov',
  anchorLat: 44.5,
  anchorLong: 26.2,
  anchorName: 'Lângă ponton',
  startedAt: at(26 * 60),
  endedAt: at(20 * 60 - 12),
  plannedDurationMs: 6 * 3_600_000,
  notes: null,
  visibleOnProfile: false,
  status: 'finished',
  targetSpecies: [{ documentId: null, name: 'Crap' }, { documentId: null, name: 'Somn' }],
  hostUid: 'x',
  captures: 0,
  recordKg: null,
  totalKg: null,
};

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

type State = 'owner-coop-live' | 'member-live' | 'solo-no-stands' | 'ended' | 'offline';
const STATES: State[] = ['owner-coop-live', 'member-live', 'solo-no-stands', 'ended', 'offline'];

async function setup(page: Page, state: State) {
  const doc =
    state === 'member-live'
      ? liveDoc({ hostUid: 'e2e-host', members: [member('e2e-host', 'Mihai'), member(selfId, 'Eu Pescar')] })
      : state === 'solo-no-stands'
        ? liveDoc({ joinCode: null, members: [member(selfId, 'Eu Pescar')] })
        : liveDoc();
  const live = state !== 'ended';
  const fake = await installFakeLive(page);
  await fake.seed({ docs: live ? { [LIVE.clientId]: doc } : {}, allTabs: true });
  await page.route(/tiles\.openfreemap\.org|arcgisonline\.com/, r => r.abort());
  await page.route(/\/feed\/community\/sessions\/e2e-/, r => json(r, { error: { status: 404 } }, 404));
  await page.route('**/api/cms/feed/session-follows/mine', r => json(r, { data: { sessionDocumentIds: [] } }));
  await page.route(new RegExp(`/feed/lakes/${LAKE}(\\?.*)?$`), r => json(r, { data: { ...lakeDto, documentId: LAKE, stands: state === 'solo-no-stands' ? [] : STANDS } }));
  await page.route('**/api/cms/feed/sessions/active', r => json(r, { data: live ? { ...LIVE, firestoreId: LIVE.clientId } : null }));
  await page.route(/\/api\/cms\/feed\/sessions\/mine/, r => json(r, { data: live ? [] : [endedItem], meta: { page: 1, pageSize: 100, total: live ? 0 : 1 } }));
  await page.route(new RegExp(`/api/cms/feed/sessions/${ENDED.documentId}$`), r => {
    const { captures: _c, recordKg: _r, totalKg: _t, ...base } = endedItem;
    void [_c, _r, _t];
    return json(r, { data: { ...base, joinCode: 'ARH1VE', rods: [], members: [member('x', 'Mihai'), member(selfId, 'Eu Pescar')], events: [] } });
  });
  return fake;
}

for (const state of STATES) {
  for (const width of WIDTHS) {
    test(`partida-setari · ${state} · ${width}px`, async ({ page, context }) => {
      await signIn(context, jwt);
      const fake = await setup(page, state);
      await page.setViewportSize({ width, height: 900 });
      await page.clock.install({ time: NOW });
      await page.goto(`/partide/${state === 'ended' ? ENDED.documentId : LIVE.documentId}?tab=setari`);
      await expect(page.getByTestId('partida-setari')).toBeVisible();
      if (state === 'offline') {
        await context.setOffline(true);
        await expect(page.getByTestId('setari-sync')).toContainText('Offline');
      }
      if (state === 'owner-coop-live' || state === 'member-live') await expect(page.getByTestId('setari-edit-stand')).toBeVisible();
      await stabilize(page);
      await expect(page).toHaveScreenshot(`partida-setari-${state}-${width}.png`, { fullPage: true, mask: DEFAULT_MASKS.map(s => page.locator(s)) });
      expect(fake.attempts).toEqual([]);
    });
  }
}
