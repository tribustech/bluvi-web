import { expect, test, type Page, type Route } from '@playwright/test';
import { installFakeLive, type FakeLiveDoc, type FakeRodDoc } from '../e2e/helpers/fake-live';
import { CMS, qaJwt, signIn } from '../e2e/helpers/session';
import { DEFAULT_MASKS, stabilize } from './capture';

/*
 * Partidă · Lansete (partide.partida-lansete): every state at 375 / 1280 / 1440 / 1920. Per-user and
 * live, so — like partida.visual.spec.ts — the data is the e2e's: the shared Firestore fake (no
 * request may reach Firebase), route-mocked CMS reads and writes (nothing is written anywhere), a
 * fixed clock, the real QA session. The countdowns carry data-visual-mask. The config runs with
 * reduced motion, so the outcome takeover is captured static. «not-live» (open on another device, the
 * CMS detail, no pointer to it) is captured at 375 only. Baselines are committed only once the
 * owner approves them (README.md).
 */

const NOW = new Date('2026-10-07T12:00:00.000Z');
const T = NOW.getTime();
const iso = (ms: number) => new Date(ms).toISOString();
const LIVE = { documentId: 'e2e-vl-live', clientId: 'e2e-vlc-live' };
const WIDTHS = [375, 1280, 1440, 1920] as const;
const HEIGHT: Record<number, number> = { 375: 812, 1280: 800, 1440: 900, 1920: 1080 };
let selfId = '';
let jwt = '';

test.beforeAll(async ({ request }) => {
  jwt = await qaJwt(request);
  const me = await request.get(`${CMS}/user/profile`, { headers: { authorization: `Bearer ${jwt}` } });
  selfId = (await me.json()).documentId as string;
});

const member = (uid: string, name: string) => ({ uid, name, avatar: null, joinedAt: iso(T - 130 * 60_000) });
const rods: FakeRodDoc[] = [
  { clientId: 'r1', index: 1, label: 'L1', color: '#F43F5E', bait: 'Boilies 20mm Scopex', lane: 'left', distance: 60, durationMs: 1_800_000, alarmSound: 'tone-1', runtimePhase: 'idle' as const },
  { clientId: 'r2', index: 2, label: 'L2', color: '#22C55E', bait: '', lane: 'center', distance: 70, durationMs: 1_800_000, alarmSound: 'tone-2', runtimePhase: 'fishing' as const, runtimeEndsAt: iso(T + 750_000) },
  { clientId: 'r3', index: 3, label: 'L3', color: '#6366F1', bait: 'Porumb', lane: 'right', distance: 85, durationMs: 1_200_000, alarmSound: 'tone-3', runtimePhase: 'fishing' as const, runtimeEndsAt: iso(T - 133_000) },
  { clientId: 'r4', index: 4, label: 'L4', color: '#FACC15', bait: 'Viermi', lane: 'center', distance: 45, castLat: 44.4325, castLng: 26.1236, durationMs: null, alarmSound: null, runtimePhase: 'idle' as const },
];
const liveDoc = (empty = false): FakeLiveDoc => ({
  startedAt: iso(T - 134 * 60_000),
  status: 'active',
  venueType: 'lake',
  lakeName: 'Balta Mock',
  standName: '7',
  anchorLat: 44.4321,
  anchorLong: 26.1234,
  hostUid: selfId,
  joinCode: 'K7M2QX',
  visibleOnProfile: true,
  members: [member(selfId, 'Eu Pescar'), member('e2e-angler-2', 'Ana Crap')],
  rods: empty ? [] : rods,
  catches: empty
    ? []
    : [
        { clientId: 'ev-1', outcome: 'capture', occurredAt: iso(T - 100 * 60_000), rodIndex: 1, weightKg: 2.4, species: 'Crap' },
        { clientId: 'ev-2', outcome: 'capture', occurredAt: iso(T - 60 * 60_000), rodIndex: 1, weightKg: 8.69, species: 'Crap' },
        { clientId: 'ev-3', outcome: 'lost', occurredAt: iso(T - 40 * 60_000), rodIndex: 1 },
      ],
  rev: 3,
});

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

type State = 'board' | 'provisional' | 'empty' | 'takeover-lost' | 'takeover-blank' | 'stop-dialog' | 'offline' | 'not-live';

/** Open on another device, not followed live here: the CMS detail, no pointer to it. */
const ELSEWHERE = { documentId: 'e2e-vl-open', clientId: 'e2e-vlc-open' };
const dtoRod = (r: FakeRodDoc) => ({ index: r.index, label: r.label, color: r.color, bait: r.bait, baitType: null, baitSize: null, baitFlavor: null, lane: r.lane, distance: r.distance, castLat: r.castLat ?? null, castLng: r.castLng ?? null, durationMs: r.durationMs ?? null, alarmSound: r.alarmSound ?? null, runtimePhase: r.runtimePhase, runtimeEndsAt: r.runtimeEndsAt ?? null });
function openElsewhere() {
  const item = {
    documentId: ELSEWHERE.documentId, clientId: ELSEWHERE.clientId, clientUpdatedAt: null, venueType: 'lake', lakeId: 'e2e-lake-1', lakeName: 'Balta Mock', lakeImageUrl: null,
    publicWaterCode: null, publicWaterName: null, manualVenueName: null, standId: null, standName: '7', locality: 'Ilfov', anchorLat: 44.4321, anchorLong: 26.1234, anchorName: null,
    startedAt: iso(T - 134 * 60_000), endedAt: null, plannedDurationMs: 8 * 3_600_000, notes: null, visibleOnProfile: true, status: 'active', targetSpecies: [], hostUid: selfId,
  };
  return { item, detail: { ...item, joinCode: 'K7M2QX', rods: rods.map(dtoRod), members: [member(selfId, 'Eu Pescar')], events: [] } };
}

async function setup(page: Page, state: State) {
  const fake = await installFakeLive(page);
  await fake.seed({ docs: { [LIVE.clientId]: liveDoc(state === 'empty') } });
  await page.route('**/api/cms/feed/session-follows/mine', r => json(r, { data: { sessionDocumentIds: [] } }));
  const elsewhere = state === 'not-live' ? openElsewhere() : null;
  await page.route('**/api/cms/feed/sessions/active', r =>
    r.fulfill({ status: 200, contentType: 'application/json', headers: state === 'provisional' ? {} : { date: NOW.toUTCString() }, body: JSON.stringify({ data: elsewhere ? null : { ...LIVE, firestoreId: LIVE.clientId } }) }),
  );
  await page.route(/\/api\/cms\/feed\/sessions\/mine(\?.*)?$/, r =>
    json(r, elsewhere ? { data: [{ ...elsewhere.item, captures: 0, recordKg: null, totalKg: null }], meta: { page: 1, pageSize: 100, total: 1 } } : { data: [], meta: { page: 1, pageSize: 100, total: 0 } }),
  );
  if (elsewhere) await page.route(new RegExp(`/api/cms/feed/sessions/${ELSEWHERE.documentId}(\\?.*)?$`), r => json(r, { data: elsewhere.detail }));
  await page.route(/\/feed\/community\/sessions\/e2e-[^/?]+(\?.*)?$/, r => json(r, { data: null, error: { status: 404 } }, 404));
  // Outcome writes never answer: the takeover is what is captured, not a later snapshot.
  await page.route(/\/api\/cms\/feed\/sessions\/e2e-[^/]+\/(events|rods\/\d+\/(cast|stop))$/, () => undefined);
  return fake;
}

async function act(page: Page, state: State) {
  const card = (i: number) => page.locator(`[data-testid="rod-card"][data-rod="${i}"]`);
  switch (state) {
    case 'takeover-lost':
      await card(1).getByRole('button', { name: 'Scăpat' }).click();
      await expect(card(1).getByTestId('rod-takeover')).toBeVisible();
      break;
    case 'takeover-blank':
      await card(4).getByRole('button', { name: 'Fără trăsătură' }).click();
      await expect(card(4).getByTestId('rod-takeover')).toBeVisible();
      break;
    case 'stop-dialog':
      await card(2).getByRole('button', { name: 'Oprește cronometrul' }).click();
      await expect(page.getByTestId('stop-rod-label')).toBeVisible();
      break;
    case 'offline':
      await page.context().setOffline(true);
      await expect(page.getByTestId('partida-reconnecting')).toBeVisible();
      break;
    default:
  }
}

const STATES: State[] = ['board', 'provisional', 'empty', 'takeover-lost', 'takeover-blank', 'stop-dialog', 'offline', 'not-live'];

for (const state of STATES) {
  // The non-live board differs from the live one only by its caption and the missing controls: the phone is enough.
  for (const width of state === 'not-live' ? ([375] as const) : WIDTHS) {
    test(`partida-lansete · ${state} · ${width}px`, async ({ page, context }) => {
      await signIn(context, jwt);
      const fake = await setup(page, state);
      await page.setViewportSize({ width, height: HEIGHT[width] });
      await page.clock.install({ time: NOW });
      await page.goto(`/partide/${state === 'not-live' ? ELSEWHERE.documentId : LIVE.documentId}?tab=lansete`);
      await expect(page.getByTestId(state === 'empty' ? 'lansete-empty' : state === 'not-live' ? 'lansete-not-live' : 'lansete-board')).toBeVisible();
      await stabilize(page);
      await act(page, state);
      // The dialog covers the viewport: capture what the angler sees.
      await expect(page).toHaveScreenshot(`partida-lansete-${state}-${width}.png`, { fullPage: state !== 'stop-dialog', mask: DEFAULT_MASKS.map(s => page.locator(s)) });
      if (state === 'offline') await context.setOffline(false);
      expect(fake.attempts).toEqual([]);
    });
  }
}
