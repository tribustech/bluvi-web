import { expect, test, type Page, type Route } from '@playwright/test';
import { fakeRaffle, SESSION_ID, type FakeRaffleOptions } from '../e2e/helpers/fake-raffle';
import { qaJwt, signIn } from '../e2e/helpers/session';
import { DEFAULT_MASKS, stabilize, VISUAL_WIDTHS } from './capture';

/*
 * participant.raffle-status (/tombola/sansele-mele «Șansele mele», T6) — one baseline per state ×
 * width (ROADMAP §9.5) at 375 / 768 / 1280 / 1440 / 1920. Every raffle read is a route mock
 * (e2e/helpers/fake-raffle.ts + a participation layer here, registered later so it answers first);
 * nothing is written: the only state that presses something («type-failed», «type-unsaved») has
 * its join answered by the mock. The viewer is the QA user (the gate needs a real session). The
 * clock is fixed 2 d 2 h 30 min before the session's end; the countdown also carries
 * data-visual-mask. Baselines are committed only once the owner approves them (README.md).
 */

const PATH = '/tombola/sansele-mele';
const WIDTHS = [...VISUAL_WIDTHS, 1920] as const;
const HEIGHT: Record<number, number> = { 375: 812, 768: 1024, 1280: 800, 1440: 900, 1920: 1080 };
const NOW = new Date('2026-12-29T18:29:30.000Z');
const RECEIPT_URL = 'https://bluvi-staging.s3.eu-central-1.amazonaws.com/e2e-sansele-mele-bon.png';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

type Part = { entriesCount?: number; receiptUploaded?: boolean; receiptImageUrl?: string | null };

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

async function participation(page: Page, part: Part, joinFails = false) {
  const dto = {
    joined: true,
    entriesCount: 1,
    typeKey: 'crap',
    receiptUploaded: false,
    receiptImageUrl: null,
    ...part,
    receiptUnderVerification: Boolean(part.receiptUploaded),
    canChangeType: true,
    sessionDocumentId: SESSION_ID,
  };
  await page.route('**/api/cms/raffle-sessions/**', async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname.replace(/^\/api\/cms/, '');
    if (path === '/raffle-sessions/participation' && req.method() === 'GET') return json(route, { data: dto });
    if (path === `/raffle-sessions/${SESSION_ID}/join` && req.method() === 'POST') {
      if (joinFails) return json(route, { data: null, error: { status: 500, name: 'Error', message: 'mock', details: {} } }, 500);
      return json(route, { data: dto });
    }
    return route.fallback();
  });
  await page.route(RECEIPT_URL, (route) => route.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
}

const prizesHeading = (page: Page) => page.getByRole('heading', { level: 2, name: 'Premii pe care le poți câștiga' });
const tile = (page: Page, name: string) => page.getByTestId('raffle-types').locator('label').filter({ hasText: new RegExp(`^${name}`) });

interface State {
  name: string;
  raffle?: FakeRaffleOptions;
  part?: Part;
  joinFails?: boolean;
  /** The participation is not mocked (load error / loading hold /active). */
  noParticipation?: boolean;
  prepare?: (page: Page) => Promise<void>;
  ready: (page: Page) => Promise<void>;
}

const STATES: State[] = [
  { name: 'running', ready: (page) => expect(prizesHeading(page)).toBeVisible() },
  {
    name: 'receipt',
    part: { entriesCount: 3, receiptUploaded: true, receiptImageUrl: RECEIPT_URL },
    ready: (page) => expect(page.getByTestId('receipt-card-image')).toBeVisible(),
  },
  {
    name: 'deadline',
    raffle: { session: 'closed' },
    part: { entriesCount: 3, receiptUploaded: true, receiptImageUrl: RECEIPT_URL },
    ready: (page) => expect(page.getByTestId('raffle-type-locked')).toBeVisible(),
  },
  {
    name: 'ended',
    raffle: { session: 'ended-winners' },
    part: { entriesCount: 3, receiptUploaded: true },
    ready: (page) => expect(page.getByTestId('raffle-ended')).toBeVisible(),
  },
  {
    name: 'static-prizes',
    raffle: { noPrizes: true },
    ready: (page) => expect(page.getByTestId('raffle-prizes')).toHaveAttribute('data-source', 'static'),
  },
  {
    name: 'type-unsaved',
    ready: async (page) => {
      await expect(prizesHeading(page)).toBeVisible();
      await page.getByRole('radio', { name: 'Crap', exact: true }).focus();
      await page.keyboard.press('ArrowRight');
      await expect(page.getByTestId('raffle-type-unsaved')).toBeVisible();
    },
  },
  {
    name: 'type-failed',
    joinFails: true,
    ready: async (page) => {
      await expect(prizesHeading(page)).toBeVisible();
      await tile(page, 'Răpitor').click();
      await expect(page.getByTestId('raffle-type-error')).not.toBeEmpty();
    },
  },
  {
    name: 'error',
    raffle: { session: 'error' },
    noParticipation: true,
    ready: (page) => expect(page.getByRole('button', { name: 'Încearcă din nou' })).toBeVisible({ timeout: 30_000 }),
  },
  {
    name: 'loading',
    noParticipation: true,
    prepare: async (page) => {
      await page.route('**/api/cms/raffle-sessions/active', () => new Promise(() => {}));
    },
    ready: (page) => expect(page.locator('[aria-busy="true"]').first()).toBeAttached(),
  },
];

let jwt: string;
test.beforeAll(async ({ request }) => {
  jwt = await qaJwt(request);
});

test.describe(`tombola-sansele-mele · ${PATH}`, () => {
  for (const state of STATES) {
    for (const width of WIDTHS) {
      test(`${state.name} · ${width}px`, async ({ page, context, baseURL }) => {
        await page.setViewportSize({ width, height: HEIGHT[width] });
        // stabilize() waits for networkidle, which a held request never reaches: bound the wait.
        page.setDefaultNavigationTimeout(8_000);
        await page.clock.setFixedTime(NOW);
        await signIn(context, jwt, baseURL);
        await fakeRaffle(page, state.raffle ?? {});
        if (!state.noParticipation) await participation(page, state.part ?? {}, state.joinFails);
        if (state.prepare) await state.prepare(page);
        await page.goto(PATH, { waitUntil: 'domcontentloaded' });
        await state.ready(page);
        await stabilize(page);
        await page.mouse.move(0, 0);
        await expect(page).toHaveScreenshot(`tombola-sansele-mele-${state.name}-${width}.png`, {
          fullPage: true,
          mask: DEFAULT_MASKS.map((s) => page.locator(s)),
        });
      });
    }
  }
});
