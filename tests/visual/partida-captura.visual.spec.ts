import path from 'node:path';
import { expect, test, type Page, type Route } from '@playwright/test';
import { installFakeLive, type FakeLiveDoc } from '../e2e/helpers/fake-live';
import { CMS, qaJwt, signIn } from '../e2e/helpers/session';
import { DEFAULT_MASKS, stabilize } from './capture';

/*
 * Captură nouă / Editează captura (partide.captura): every state at 375 / 1280 / 1440 / 1920. The
 * page is per-user and live, so — like partida.visual.spec.ts — the data is the e2e's: the shared
 * Firestore fake (no request may reach Firebase), route-mocked CMS reads and writes (nothing is
 * written anywhere), a fixed clock, the real QA session. Baselines are committed only once the
 * owner approves them (README.md).
 */

const NOW = new Date('2026-10-07T12:00:00.000Z');
const at = (min: number) => new Date(NOW.getTime() - min * 60_000).toISOString();
const LIVE = { documentId: 'e2e-vcap-live', clientId: 'e2e-vcapc-live' };
const FIXTURE = path.join(__dirname, '../fixtures/partide/catch-quadrants.jpg');
const WIDTHS = [375, 1280, 1440, 1920] as const;
const HEIGHT: Record<number, number> = { 375: 812, 1280: 800, 1440: 900, 1920: 1080 };
let selfId = '';
let jwt = '';

test.beforeAll(async ({ request }) => {
  jwt = await qaJwt(request);
  const me = await request.get(`${CMS}/user/profile`, { headers: { authorization: `Bearer ${jwt}` } });
  selfId = (await me.json()).documentId as string;
});

const member = (uid: string, name: string) => ({ uid, name, avatar: null, joinedAt: at(130) });
const liveDoc = (catches: FakeLiveDoc['catches'] = []): FakeLiveDoc => ({
  startedAt: at(134),
  status: 'active',
  venueType: 'lake',
  lakeName: 'Balta Mock',
  standName: '7',
  anchorLat: 44.4321,
  anchorLong: 26.1234,
  hostUid: selfId,
  visibleOnProfile: true,
  members: [member(selfId, 'Eu Pescar'), member('e2e-angler-2', 'Ana Crap')],
  targetSpecies: [
    { documentId: 'f-crap', name: 'Crap' },
    { documentId: 'f-somn', name: 'Somn' },
    { documentId: 'f-caras', name: 'Caras' },
    { documentId: 'f-stiuca', name: 'Știucă' },
  ],
  rods: [
    { clientId: 'r1', index: 1, label: 'L1', color: '#F43F5E', bait: 'Boilies 20mm Scopex', lane: 'left', distance: 60, runtimePhase: 'idle' },
    { clientId: 'r2', index: 2, label: 'L2', color: '#22C55E', bait: 'Porumb', lane: 'center', distance: 70, castLat: 44.43273, castLng: 26.1234, runtimePhase: 'idle' },
  ],
  catches: [
    { clientId: 'ev-photo', outcome: 'capture', occurredAt: at(60), rodIndex: 1, weightKg: 8.69, weightEstimated: true, species: 'Somn', speciesId: 'f-somn', bait: 'Viermi', photoUrl: 'https://e2e-photos.invalid/somn.jpg' },
    ...(catches ?? []),
  ],
  rev: 3,
});

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

type State = 'not-found' | 'loading' | 'new' | 'from-rod' | 'weight-entering' | 'weight-set' | 'photo-chosen' | 'edit' | 'saving' | 'save-error' | 'offline' | 'spam-guard';

async function setup(page: Page, state: State) {
  const fake = await installFakeLive(page);
  const recent = new Date(NOW.getTime() - 12_000).toISOString();
  await fake.seed({ docs: state === 'loading' ? {} : { [LIVE.clientId]: liveDoc(state === 'spam-guard' ? [{ clientId: 'ev-r', outcome: 'capture', occurredAt: recent, rodIndex: null, weightKg: 1, species: 'Crap' }] : []) } });
  await page.route('https://e2e-photos.invalid/**', r => r.fulfill({ status: 200, contentType: 'image/jpeg', path: FIXTURE }));
  await page.route('**/api/cms/feed/sessions/active', r => json(r, { data: state === 'not-found' ? null : { ...LIVE, firestoreId: LIVE.clientId } }));
  await page.route(/\/fishes(\?.*)?$/, r => json(r, { data: [] }));
  await page.route(/\/api\/cms\/feed\/sessions\/e2e-[^/]+\/events$/, async r => {
    if (state === 'saving') return; // never answers: the curtain stays up
    return json(r, { data: null, error: { status: 400, name: 'Error', message: 'mock', details: {} } }, 400);
  });
  return fake;
}

const TARGET: Record<State, { query?: string; marker: string }> = {
  'not-found': { marker: 'capture-not-found' },
  loading: { marker: 'capture-skeleton' },
  new: { marker: 'capture-form' },
  'from-rod': { query: '?lanseta=2', marker: 'capture-form' },
  'weight-entering': { marker: 'capture-form' },
  'weight-set': { marker: 'capture-form' },
  'photo-chosen': { marker: 'capture-form' },
  edit: { query: '?editare=ev-photo', marker: 'capture-form' },
  saving: { marker: 'capture-form' },
  'save-error': { marker: 'capture-form' },
  offline: { marker: 'capture-form' },
  'spam-guard': { marker: 'capture-spam-guard' },
};

async function act(page: Page, state: State) {
  switch (state) {
    case 'weight-entering':
      await page.getByTestId('weight-add').click();
      await page.keyboard.type('12,5');
      break;
    case 'weight-set':
      await page.getByTestId('weight-add').click();
      await page.keyboard.type('12,35');
      await page.getByTestId('weight-keypad').getByRole('button', { name: 'Gata' }).click();
      await page.getByRole('radio', { name: 'Estimată' }).click();
      break;
    case 'photo-chosen':
      await page.getByTestId('photo-input').setInputFiles(FIXTURE);
      await page.getByTestId('photo-preview-done').click();
      await expect(page.getByTestId('detail-photo-thumb')).toBeVisible();
      break;
    case 'saving':
      await page.getByTestId('capture-save').click();
      await page.clock.runFor(1500);
      await expect(page.getByTestId('save-curtain')).toHaveAttribute('data-phase', 'shown');
      break;
    case 'save-error':
      await page.getByTestId('capture-save').click();
      await expect(page.getByTestId('capture-save-error')).toBeVisible();
      await expect(page.getByTestId('save-curtain')).toHaveCount(0);
      break;
    case 'offline':
      await page.context().setOffline(true);
      await page.getByTestId('capture-save').click();
      await expect(page.getByTestId('capture-save-error')).toBeVisible();
      break;
    default:
  }
}

const STATES = Object.keys(TARGET) as State[];

for (const state of STATES) {
  for (const width of WIDTHS) {
    test(`partida-captura · ${state} · ${width}px`, async ({ page, context }) => {
      await signIn(context, jwt);
      const fake = await setup(page, state);
      await page.setViewportSize({ width, height: HEIGHT[width] });
      await page.clock.install({ time: NOW });
      await page.goto(`/partide/${LIVE.documentId}/captura${TARGET[state].query ?? ''}`);
      await expect(page.getByTestId(TARGET[state].marker).first()).toBeVisible();
      await stabilize(page);
      await act(page, state);
      // The curtain and the dialogs cover the viewport: capture what the angler sees.
      const fullPage = !['saving', 'spam-guard'].includes(state);
      await expect(page).toHaveScreenshot(`partida-captura-${state}-${width}.png`, { fullPage, mask: DEFAULT_MASKS.map(s => page.locator(s)) });
      if (state === 'offline') await context.setOffline(false);
      expect(fake.attempts).toEqual([]);
    });
  }
}
