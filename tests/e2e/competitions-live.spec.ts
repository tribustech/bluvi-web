import { collectConsoleErrors } from './helpers/console';
import { expect, test, type APIRequestContext, type Page, type Route } from '@playwright/test';
import { PIXEL } from './competitions-list.fixtures';
import { expectNoA11yViolations } from './helpers/a11y';
import { CMS, qaJwt, signIn } from './helpers/session';

/*
 * Concursuri › Live (/concursuri/live) — the owner-approved prototype app/dev/hub Live.tsx
 * (2026-10-06), parity docs/parity/areas/competitions-list.yml competitions-list.live c16–c24 and
 * competitions-list.index c31 / c32: «Cântăriri recente» (GET /feed/recent-weighings), «Concursul
 * tău», fish's poster cards in a stable order, the single-live view, nothing live, the signed-out
 * blur. Local CMS on :1337: three live competitions; the QA user is registered in none of them.
 * The local CMS may not have /feed/recent-weighings yet (it is on CMS staging): every test that
 * needs it serves it with page.route. The shared live list is re-read through «Reîmprospătează»
 * when a test narrows it (the server prefetched the real one).
 */

const PHONE = { width: 375, height: 812 };
const TABLET = { width: 1000, height: 900 };
const WIDE = { width: 1440, height: 900 };
const HUGE = { width: 1920, height: 1000 };

const RECENT = /\/feed\/recent-weighings(\?|$)/;
const RANKING = /\/competitions\/[^/]+\/ranking(\?|$)/;
const MY_LIVE = /\/feed\/my-competition-cards\?(?=.*scope=registered)(?=.*status=started)/;
const PUBLIC_LIVE = /\/feed\/competition-cards\?(?=.*status=started)/;

type Card = { documentId: string; name: string; startDate: string | null };
type Weighing = Record<string, unknown> & { weighingDocumentId: string; competition: { documentId: string; name: string; posterUrl: string | null } };

let jwt = '';
let live: Card[] = [];
let me = { id: 0, documentId: '', username: '' };
test.describe.configure({ timeout: 90_000 });
test.use({ trace: 'off' });
test.beforeAll(async ({ request }) => {
  jwt = await qaJwt(request);
  live = await liveCards(request);
  me = await (await request.get(`${CMS}/users/me`, { headers: { Authorization: `Bearer ${jwt}` } })).json();
});

async function liveCards(request: APIRequestContext): Promise<Card[]> {
  const res = await request.get(`${CMS}/feed/competition-cards?status=started&page=1&pageSize=20`);
  return ((await res.json()) as { data: Card[] }).data;
}

/** The stable order (competitions-list.live c19): by start time, then by name. */
const byStart = (cards: Card[]) =>
  [...cards].sort((a, b) => (Date.parse(a.startDate ?? '') || Infinity) - (Date.parse(b.startDate ?? '') || Infinity) || a.name.localeCompare(b.name, 'ro'));

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const list = (page: Page) => page.locator('#concursuri-lista');
const cardIds = (page: Page) => list(page).locator('[data-live-card]').evaluateAll((els) => els.map((e) => e.getAttribute('data-live-card')));
const strip = (page: Page) => page.getByRole('region', { name: 'Cântăriri recente' });
const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

function weighing(id: string, comp: Card, over: Record<string, unknown> = {}): Weighing {
  return {
    weighingDocumentId: id,
    endAt: minutesAgo(3),
    weighingType: 'normal',
    competition: { documentId: comp.documentId, name: comp.name, posterUrl: 'http://localhost:1337/uploads/fixture.jpg?poster' },
    standLabel: 'Sector A, Stand 4',
    angler: { displayName: `Pescar ${id}`, avatarUrl: `http://localhost:1337/uploads/fixture.jpg?a-${id}`, isTeam: false },
    catchCount: 2,
    totalKg: 12.45,
    ...over,
  };
}

const DETAIL = (id: string) => ({
  id: 1,
  documentId: id,
  weighingType: 'normal',
  weighingStatus: 'finished',
  startDate: minutesAgo(4),
  endDate: minutesAgo(3),
  numberOfRevisions: 0,
  catches: [
    { id: 1, documentId: 'c1', weight: 7.2, fishType: { Name: 'Crap' }, media: [] },
    { id: 2, documentId: 'c2', weight: 5.25, fishType: { Name: 'Crap' }, media: [] },
  ],
  refereeSignature: null,
  witnessSignature: null,
  competition: { rankingType: 'quantity' },
  stand: { sectorDrawPosition: null },
});

/** Serves /feed/recent-weighings from `state.items` (read per request) and counts the reads. */
async function mockRecent(page: Page, state: { items: Weighing[] | null; reads: number }) {
  await page.route(/\/uploads\/fixture\.jpg/, (r) => r.fulfill({ body: PIXEL, contentType: 'image/png' }));
  await page.route(RECENT, (r) => {
    state.reads += 1;
    return state.items ? json(r, { data: state.items }) : json(r, { error: { status: 404, name: 'NotFoundError', message: 'Not Found' } }, 404);
  });
  await page.route(/\/feed\/weighings\/[^/?]+$/, (r) => json(r, DETAIL(new URL(r.request().url()).pathname.split('/').pop()!)));
}

/** The live list narrowed to `keep` (the real cards, optionally edited), re-read through «Reîmprospătează». */
async function narrowLive(page: Page, keep: (c: Card) => boolean, edit: (c: Card) => Card = (c) => c) {
  await page.route(PUBLIC_LIVE, async (r) => {
    const res = await r.fetch();
    const body = (await res.json()) as { data: Card[]; meta: { pagination: Record<string, number>; counts: Record<string, number> } };
    const data = body.data.filter(keep).map(edit);
    await json(r, { data, meta: { pagination: { ...body.meta.pagination, total: data.length, pageCount: data.length ? 1 : 0 }, counts: { ...body.meta.counts, started: data.length } } });
  });
  await page.getByRole('button', { name: 'Reîmprospătează' }).click();
  await expect(page.getByRole('button', { name: 'Reîmprospătează' })).not.toHaveAttribute('aria-disabled');
}

async function open(page: Page) {
  await page.goto('/concursuri/live');
  await expect(page.getByRole('heading', { level: 1, name: 'Concursuri' })).toBeVisible();
  await expect(page.locator('#concursuri-lista-titlu')).toBeVisible();
}

async function settled(page: Page) {
  await page.waitForFunction(() =>
    document.getAnimations().every((a) => a.playState !== 'running' || a.effect?.getComputedTiming().iterations === Infinity),
  );
}

const columns = (page: Page) =>
  list(page)
    .locator('ul:has([data-live-card])')
    .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);

/* ================================================================== */

test.describe('signed out', () => {
  test('competitions-list.live.c19 competitions-list.live.c20 competitions-list.live.c24 competitions-list.index.c31 competitions-list.live.s8 — poster cards in a stable order; the strip and hero blurred over fake data; nothing per-user read', async ({ page }) => {
    const errors = collectConsoleErrors(page, { ignore: /Failed to load resource/ });
    const reads: string[] = [];
    page.on('request', (r) => {
      if (RECENT.test(r.url()) || RANKING.test(r.url()) || /my-competition-cards/.test(r.url())) reads.push(r.url());
    });
    await page.setViewportSize(WIDE);
    await open(page);
    expect(live.length).toBeGreaterThan(1);
    // c19: by start time (mine first only when signed in), fish's poster cards, whole-card links.
    await expect.poll(() => cardIds(page)).toEqual(byStart(live).map((c) => c.documentId));
    const first = list(page).locator('[data-live-card]').first();
    await expect(first.getByRole('link', { name: byStart(live)[0].name, exact: true })).toHaveAttribute('href', `/concursuri/${byStart(live)[0].documentId}`);
    await expect(first.getByText('LIVE', { exact: true })).toBeVisible();
    // c19: 3 columns from 1280, 2 from 768, 1 on the phone, 4 from 1800.
    expect(await columns(page)).toBe(3);
    // c20: the gate — one call to action to sign in (back here), the blurred copy inert and hidden from AT.
    const cta = page.getByRole('link', { name: 'Intră în cont ca să vezi cântăririle live' });
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute('href', /concursuri%2Flive|concursuri\/live/);
    await expect(page.locator('[inert]').getByText('Cântăriri recente')).toHaveCount(1);
    await expect(page.locator('[inert]').getByText('Concursul tău')).toHaveCount(1);
    await expect(strip(page)).toHaveCount(0);
    // c31: none of the old hub.
    await expect(page.getByText(/Momente cheie|Cei mai grei pești|Ritmul cântăririlor/)).toHaveCount(0);
    await page.waitForTimeout(1500);
    expect(reads).toEqual([]);
    await settled(page);
    await expectNoA11yViolations(page);

    await page.setViewportSize(TABLET);
    await expect.poll(() => columns(page)).toBe(2);
    await page.setViewportSize(PHONE);
    await expect.poll(() => columns(page)).toBe(1);
    await expect(cta).toBeVisible();
    await expectNoA11yViolations(page);
    expect(errors).toEqual([]);
  });

  test('competitions-list.live.c21 competitions-list.live.s10 — one live competition, signed out: its view, the leaderboard blurred', async ({ page }) => {
    await page.setViewportSize(WIDE);
    await open(page);
    const only = byStart(live)[0];
    await narrowLive(page, (c) => c.documentId === only.documentId);
    const view = page.getByRole('region', { name: only.name });
    await expect(view.getByRole('heading', { level: 2 }).getByRole('link', { name: only.name })).toHaveAttribute('href', `/concursuri/${only.documentId}`);
    await expect(view.getByRole('link', { name: 'Intră în cont ca să vezi clasamentul live' })).toBeVisible();
    await expect(view.getByRole('link', { name: 'Vezi clasamentul', exact: true })).toHaveAttribute('href', `/concursuri/${only.documentId}/clasament`);
    await expect(list(page).locator('[data-live-card]')).toHaveCount(0);
    await settled(page);
    await expectNoA11yViolations(page);
  });

  test('competitions-list.live.c22 competitions-list.live.s11 — nothing live: «Niciun concurs live acum», the next start, the way to Viitoare', async ({ page }) => {
    await page.setViewportSize(WIDE);
    await open(page);
    await narrowLive(page, () => false);
    await expect(list(page).getByRole('heading', { name: 'Niciun concurs live acum' })).toBeVisible();
    await expect(list(page).getByText(/^Următorul, .+, începe pe .+\.$/)).toBeVisible();
    await expect(list(page).getByRole('link', { name: 'Vezi concursurile viitoare' })).toHaveAttribute('href', '/concursuri/viitoare');
    await expect(page.getByRole('link', { name: 'Intră în cont ca să vezi cântăririle live' })).toHaveCount(0);
  });
});

test.describe('signed in', () => {
  test.beforeEach(async ({ context }) => {
    await signIn(context, jwt);
  });

  test('competitions-list.live.c16 competitions-list.live.c17 competitions-list.live.s7 competitions-list.live.s12 — the strip: newest first, photo else poster, copy; an item opens its weighing (popover, sheet on the phone)', async ({ page }) => {
    const errors = collectConsoleErrors(page, { ignore: /Failed to load resource/ });
    const [a, b] = byStart(live);
    const state = {
      reads: 0,
      items: [
        weighing('w-old', a, { endAt: minutesAgo(40), catchCount: 0, totalKg: 0, angler: null, standLabel: 'Sector B, Stand 9' }),
        weighing('w-new', a, { endAt: minutesAgo(1) }),
        weighing('w-poster', b, { endAt: minutesAgo(12), catchCount: 20, totalKg: 31.2, angler: { displayName: 'Fără Poză', avatarUrl: null, isTeam: false } }),
      ],
    };
    await mockRecent(page, state);
    await page.setViewportSize(WIDE);
    await open(page);
    const items = strip(page).getByRole('listitem');
    await expect(items).toHaveCount(3);
    // Newest first; «N pești · X kg» with Romanian agreement; an empty weighing says so.
    await expect(items.nth(0)).toContainText('Pescar w-new');
    await expect(items.nth(0)).toContainText('2 pești · 12,45 kg');
    await expect(items.nth(0)).toContainText(/acum 1 min$/);
    await expect(items.nth(1)).toContainText('20 de pești · 31,2 kg');
    await expect(items.nth(2)).toContainText('Sector B, Stand 9');
    await expect(items.nth(2)).toContainText('Fără capturi');
    // The angler's photo, else the poster.
    await expect(items.nth(0).locator('img')).toHaveAttribute('src', /a-w-new/);
    await expect(items.nth(1).locator('img')).toHaveAttribute('src', /poster/);

    // c17: a popover beside the item; Escape closes it and focus returns.
    const item = items.nth(0).getByRole('button');
    await item.click();
    const dialog = page.getByRole('dialog', { name: 'Detaliu cântar' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Crap')).toBeVisible();
    await expect(dialog.getByRole('link', { name: 'Vezi concursul' })).toHaveAttribute('href', `/concursuri/${a.documentId}`);
    await expect(dialog.getByRole('link', { name: 'Toate cântarele' })).toHaveAttribute('href', new RegExp(`/concursuri/${a.documentId}/`));
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(item).toBeFocused();
    await settled(page);
    await expectNoA11yViolations(page);

    // The phone: fish's bottom sheet.
    await page.setViewportSize(PHONE);
    await item.scrollIntoViewIfNeeded();
    await item.click();
    await expect(page.getByRole('dialog', { name: /Detaliu cântar/ })).toBeVisible();
    await expect(page.getByRole('dialog', { name: /Detaliu cântar/ }).getByRole('link', { name: 'Vezi concursul' })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('competitions-list.live.c16 competitions-list.live.s9 — the endpoint answers 404 (a CMS without it): no strip, one read, never retried nor polled', async ({ page }) => {
    await page.clock.install();
    const state = { reads: 0, items: null as Weighing[] | null };
    await mockRecent(page, state);
    await page.setViewportSize(WIDE);
    await open(page);
    await expect.poll(() => state.reads).toBeGreaterThan(0);
    await page.waitForTimeout(2500);
    expect(state.reads).toBe(1);
    // Two 30s ticks later: still the one read (the interval stops on a 404).
    await page.clock.runFor(65_000);
    await page.waitForTimeout(500);
    expect(state.reads).toBe(1);
    await expect(strip(page)).toHaveCount(0);
    await expect(page.getByText('Se încarcă cântăririle recente…')).toHaveCount(0);
    await expect(list(page).locator('[data-live-card]').first()).toBeVisible();
  });

  test('competitions-list.live.c19 competitions-list.live.c23 competitions-list.index.c32 — every 30s while visible: a new weighing slides in, its card washes in place, the order never changes; a hidden page reads nothing', async ({ page }) => {
    await page.clock.install();
    const [a, b] = byStart(live);
    const state = { reads: 0, items: [weighing('w1', a, { endAt: minutesAgo(8) })] };
    await mockRecent(page, state);
    await page.setViewportSize(WIDE);
    await open(page);
    await expect(strip(page).getByRole('listitem')).toHaveCount(1);
    const order = await cardIds(page);
    await expect(list(page).locator('[data-flash]')).toHaveCount(0);

    // The last card gets a weighing: it washes where it stands; nothing moves.
    state.items = [weighing('w2', b, { endAt: minutesAgo(0) }), ...state.items];
    const before = state.reads;
    await page.clock.runFor(31_000);
    await expect.poll(() => state.reads).toBeGreaterThan(before);
    await expect(strip(page).getByRole('listitem')).toHaveCount(2);
    await expect(strip(page).getByRole('listitem').first()).toContainText('Pescar w2');
    await expect(list(page).locator(`[data-live-card="${b.documentId}"] [data-flash]`)).toHaveCount(1);
    expect(await cardIds(page)).toEqual(order);
    // No toast (fish has none).
    await expect(page.getByRole('status').filter({ hasText: /Lider nou|Cântărire nouă/ })).toHaveCount(0);

    // Hidden: no read at all (TanStack pauses the intervals in a background tab).
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    const hiddenAt = state.reads;
    const listReads: string[] = [];
    page.on('request', (r) => {
      if (PUBLIC_LIVE.test(r.url())) listReads.push(r.url());
    });
    await page.clock.runFor(125_000);
    await page.waitForTimeout(500);
    expect(state.reads).toBe(hiddenAt);
    expect(listReads).toEqual([]);
  });

  test('competitions-list.live.c18 competitions-list.live.c19 competitions-list.live.s7 — registered in a live competition: «Concursul tău» from my row (by identity) and my card first', async ({ page }) => {
    const errors = collectConsoleErrors(page, { ignore: /Failed to load resource/ });
    const sorted = byStart(live);
    // Mine: a live competition with weighed rows that does NOT start first — it must then lead the cards.
    let mine: Card | undefined;
    let row: { registrationId: string; generalPosition: number; sectorName: string | null; standName: string | null; catchCount: number } | undefined;
    for (const c of sorted.slice(1)) {
      const ranking = (await (await page.request.get(`${CMS}/competitions/${c.documentId}/ranking`)).json()) as { rankings: NonNullable<typeof row>[] };
      const weighed = ranking.rankings.filter((r) => r.catchCount > 0 && r.registrationId).sort((x, y) => x.generalPosition - y.generalPosition);
      if (weighed.length > 1) {
        mine = c;
        row = weighed[1];
        break;
      }
    }
    test.skip(!mine || !row, 'no local live competition (other than the first) has two weighed rows');
    if (!mine || !row) return;
    const myCard = (await (await page.request.get(`${CMS}/feed/competition-cards?status=started&page=1&pageSize=20`)).json()).data.find((c: Card) => c.documentId === mine.documentId);
    await page.route(MY_LIVE, (r) => json(r, { data: [myCard], meta: { pagination: { page: 1, pageSize: 20, pageCount: 1, total: 1 }, counts: { notStarted: 0, started: 1, completed: 0 } } }));
    // My registration: the QA user on that row (identity — never matched by the display name).
    await page.route(new RegExp(`/competitions/${mine.documentId}/registrations`), async (r) => {
      const regs = (await (await r.fetch()).json()) as { documentId: string; participants?: unknown[] }[];
      for (const reg of regs) if (reg.documentId === row.registrationId) reg.participants = [me];
      await json(r, regs);
    });
    await mockRecent(page, { reads: 0, items: [] });
    await page.setViewportSize(WIDE);
    await open(page);
    const hero = page.getByRole('region', { name: 'Concursul tău' });
    await expect(hero).toBeVisible();
    await expect(hero).toContainText(mine.name);
    if (row.standName) await expect(hero).toContainText(`Stand ${row.standName}`);
    if (row.catchCount > 0) {
      await expect(hero.getByText('Locul tău general')).toBeVisible();
      await expect(hero).toContainText(`${row.generalPosition}/`);
    }
    await expect(hero.getByText(/până la lider|Ești pe primul loc/)).toBeVisible();
    await expect(hero.getByRole('link', { name: 'Deschide concursul' })).toHaveAttribute('href', `/concursuri/${mine.documentId}`);
    // c19: mine first, then by start time.
    await expect.poll(() => cardIds(page)).toEqual([mine.documentId, ...sorted.filter((c) => c !== mine).map((c) => c.documentId)]);
    // An empty strip is not drawn.
    await expect(strip(page)).toHaveCount(0);
    await settled(page);
    await expectNoA11yViolations(page);
    await page.setViewportSize(PHONE);
    await expect(hero).toBeVisible();
    await expectNoA11yViolations(page);
    expect(errors).toEqual([]);
  });

  test('competitions-list.live.c21 competitions-list.live.s10 — one live competition: leader, top five, figures, its own weighings; no strip, no grid', async ({ page }) => {
    const only = byStart(live).find((c) => c.name.includes('CHAT25')) ?? byStart(live)[0];
    await mockRecent(page, { reads: 0, items: [weighing('solo', only, { endAt: minutesAgo(2) })] });
    await page.setViewportSize(WIDE);
    await open(page);
    await narrowLive(page, (c) => c.documentId === only.documentId);
    const view = page.getByRole('region', { name: only.name });
    await expect(view.getByText(/Live · start/).first()).toBeVisible();
    await expect(view.getByText(/Lider · /).first()).toBeVisible();
    await expect(view.getByRole('list', { name: 'Clasament acum' }).getByRole('listitem')).not.toHaveCount(0);
    await expect(view.getByText('Capturi', { exact: true })).toBeVisible();
    await expect(view.getByRole('region', { name: 'Cântăriri recente' }).getByRole('button', { name: /Pescar solo/ })).toBeVisible();
    await expect(strip(page)).toHaveCount(1); // only the view's own
    await expect(list(page).locator('[data-live-card]')).toHaveCount(0);
    await view.getByRole('button', { name: /Pescar solo/ }).click();
    await expect(page.getByRole('dialog', { name: 'Detaliu cântar' })).toBeVisible();
    await page.keyboard.press('Escape');
    await settled(page);
    await expectNoA11yViolations(page);
    await page.setViewportSize(PHONE);
    // No horizontal overflow on the phone.
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test('competitions-list.live.c18 competitions-list.live.c21 — one live competition that is mine: «Concursul tău» over its view; the leaderboard shows the podium photos', async ({ page }) => {
    const errors = collectConsoleErrors(page, { ignore: /Failed to load resource/ });
    // A live competition with two weighed rows: I am the second, the leader has a photo on the card's podium.
    type Row = { registrationId: string; generalPosition: number; catchCount: number; standName: string | null; participant?: { username: string } | null; teamName?: string | null; clubName?: string | null };
    let only: Card | undefined;
    let leader: Row | undefined;
    let row: Row | undefined;
    for (const c of byStart(live)) {
      const ranking = (await (await page.request.get(`${CMS}/competitions/${c.documentId}/ranking`)).json()) as { rankings: Row[] };
      const weighed = ranking.rankings.filter((r) => r.catchCount > 0 && r.registrationId).sort((x, y) => x.generalPosition - y.generalPosition);
      if (weighed.length > 1 && weighed[0].participant?.username && !weighed[0].teamName && !weighed[0].clubName) {
        only = c;
        [leader, row] = weighed;
        break;
      }
    }
    test.skip(!only || !leader || !row, 'no local live competition has two weighed rows led by a single angler');
    if (!only || !leader || !row) return;
    const leaderName = leader.participant!.username;
    const withPodium = (c: Card) =>
      c.documentId === only.documentId
        ? ({
            ...c,
            results: {
              ...((c as Record<string, unknown>).results as Record<string, unknown>),
              podium: [{ position: 1, tied: false, displayName: leaderName, standName: null, clubName: null, avatarUrls: ['http://localhost:1337/uploads/fixture.jpg?leader'] }],
            },
          } as Card)
        : c;
    const myCard = withPodium((await liveCards(page.request)).find((c) => c.documentId === only.documentId)!);
    await page.route(MY_LIVE, (r) => json(r, { data: [myCard], meta: { pagination: { page: 1, pageSize: 20, pageCount: 1, total: 1 }, counts: { notStarted: 0, started: 1, completed: 0 } } }));
    await page.route(new RegExp(`/competitions/${only.documentId}/registrations`), async (r) => {
      const regs = (await (await r.fetch()).json()) as { documentId: string; participants?: unknown[] }[];
      for (const reg of regs) if (reg.documentId === row.registrationId) reg.participants = [me];
      await json(r, regs);
    });
    await mockRecent(page, { reads: 0, items: [] });
    await page.setViewportSize(WIDE);
    await open(page);
    await narrowLive(page, (c) => c.documentId === only.documentId, withPodium);
    const view = page.getByRole('region', { name: only.name });
    await expect(view).toBeVisible();
    await expect(list(page).locator('[data-live-card]')).toHaveCount(0);
    // My standing: place over the field, the gap to the leader, the way in.
    const hero = page.getByRole('region', { name: 'Concursul tău' });
    await expect(hero).toBeVisible();
    await expect(hero).toContainText(only.name);
    await expect(hero.getByText('Locul tău general')).toBeVisible();
    await expect(hero).toContainText(`${row.generalPosition}/`);
    await expect(hero.getByText(/până la lider/)).toBeVisible();
    await expect(hero.getByRole('link', { name: 'Deschide concursul' })).toHaveAttribute('href', `/concursuri/${only.documentId}`);
    // The hero leads the view.
    const [heroBox, viewBox] = [await hero.boundingBox(), await view.boundingBox()];
    expect(heroBox!.y).toBeLessThan(viewBox!.y);
    // §4b.13: the leader's photo from the card's podium, on the chip and on the first row.
    await expect(view.getByText(/Lider · /).first().locator('img')).toHaveAttribute('src', /leader/);
    await expect(view.getByRole('list', { name: 'Clasament acum' }).getByRole('listitem').first().locator('img')).toHaveAttribute('src', /leader/);
    // LCP: the view's poster loads eagerly.
    await expect(view.locator('img[fetchpriority="high"]').first()).toBeAttached();
    await settled(page);
    await expectNoA11yViolations(page);
    await page.setViewportSize(PHONE);
    await expect(hero).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  });

  test('competitions-list.live.c19 — four columns from 1800', async ({ page }) => {
    await mockRecent(page, { reads: 0, items: [] });
    await page.setViewportSize(HUGE);
    await open(page);
    expect(await columns(page)).toBe(4);
  });
});
