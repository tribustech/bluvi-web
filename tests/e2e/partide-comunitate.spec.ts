import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { PARTIDE_PAGES_ON_WEB, partideHrefs } from '@/lib/partide-pages';
import { routes } from '@/lib/routes';
import { expectNoA11yViolations } from './helpers/a11y';
import { collectConsoleErrors } from './helpers/console';
import { CMS, qaJwt, signIn } from './helpers/session';
import {
  activeSession,
  ACTIVE_ID,
  FINISHED_ROW,
  LEADERBOARD,
  mockActivePartida,
  mockCommunity,
  OVERVIEW_EMPTY,
  OVERVIEW_LIVE,
  servePhotos,
  partideFaultsAvailable,
  setPartideNoPrefetch,
  type CommunityMock,
} from './partide-comunitate.fixtures';

/*
 * Partide · Comunitate (/partide) — parity docs/parity/areas/partide.yml partide.comunitate c1–c28,
 * behaviours partide.b.refetch-intervals (overview), partide.b.signin-gating (hub part),
 * partide.b.active-dock-global. fish: app/(app)/(tabs)/partide.tsx, scenes/AcasaScene.tsx.
 *
 * The local CMS has no live partidă and no record, so the community reads are served with
 * page.route (the page's dev-only `noprefetch` switch leaves them to the browser). The signed-in
 * viewer's live partidă is mocked at /api/cms/feed/sessions/* — no session is created, nothing is
 * written anywhere, no Firestore. Links to M4 pages that ship later are asserted through
 * lib/partide-pages, so the spec stays right when their flags flip.
 */

test.setTimeout(120_000);

const PHONE = { width: 375, height: 812 };
const DESKTOP = { width: 1440, height: 900 };

// The noprefetch switch is a per-context cookie (dev only): nothing global on the shared server.
test.beforeAll(async ({ request }) => {
  test.skip(!(await partideFaultsAvailable(request)), 'needs next dev (the noprefetch switch is dev-only)');
});
test.beforeEach(async ({ context }) => {
  await setPartideNoPrefetch(context);
});

async function open(page: Page, mock: CommunityMock, viewport = PHONE) {
  await page.setViewportSize(viewport);
  await servePhotos(page);
  const m = await mockCommunity(page, mock);
  await page.goto(routes.partide());
  return m;
}

const visible = (page: Page, testId: string) => page.getByTestId(testId).locator('visible=true');

async function qaUid(jwt: string, request: Page['request']) {
  const me = await (await request.get(`${CMS}/users/me`, { headers: { authorization: `Bearer ${jwt}` } })).json();
  return me.documentId as string;
}

async function signedIn(context: BrowserContext, page: Page) {
  const jwt = await qaJwt(page.request);
  await signIn(context, jwt);
  return qaUid(jwt, page.request);
}

test('c1 c2 c3 c4 c6 c12 — chrome, tabs, hero and quick nav for a guest', async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await open(page, { overview: OVERVIEW_EMPTY, history: [] });
  await expect(page.getByRole('heading', { level: 1, name: 'Partide' })).toBeVisible();

  // c1 — «Începe» only with the start flow on the web (a guest through sign-in).
  const start = partideHrefs.start();
  if (start) await expect(page.getByTestId('start-pill')).toHaveAttribute('href', routes.signIn(start));
  else await expect(page.getByTestId('start-pill')).toHaveCount(0);

  // c2/c3 — the tab bar, Comunitate open on a fresh /partide. A tab whose page is off is left out
  // (never inert), and with «Comunitate» alone there is no bar at all.
  const tabs = page.getByRole('navigation', { name: 'Partide' });
  const tabHrefs = [
    ['tab-exploreaza', partideHrefs.explore()],
    ['tab-ale-mele', partideHrefs.mine()],
  ] as const;
  if (tabHrefs.some(([, href]) => href)) {
    await expect(tabs.getByRole('link', { name: 'Comunitate' })).toHaveAttribute('aria-current', 'page');
    for (const [id, href] of tabHrefs) {
      if (href) await expect(page.getByTestId(id)).toHaveAttribute('href', href);
      else await expect(page.getByTestId(id)).toHaveCount(0);
    }
  } else {
    await expect(tabs).toHaveCount(0);
  }

  // c4 — the hero for a guest, only with something to offer (start or join on the web).
  const hero = page.getByRole('region', { name: 'Ești la pescuit?' }).locator('visible=true');
  const join = partideHrefs.join();
  if (start || join) {
    await expect(hero).toBeVisible();
    await expect(hero).toContainText('Capturi, lansete și cronometre — totul notat într-o singură partidă.');
    const startLink = hero.getByRole('link', { name: 'Începe o partidă' });
    const joinLink = hero.getByRole('link', { name: 'Intră cu cod' });
    if (start) await expect(startLink).toHaveAttribute('href', routes.signIn(start));
    else await expect(startLink).toHaveCount(0);
    if (join) await expect(joinLink).toHaveAttribute('href', routes.signIn(join));
    else await expect(joinLink).toHaveCount(0);
  } else {
    await expect(page.getByRole('region', { name: 'Ești la pescuit?' })).toHaveCount(0);
  }

  // c6 — Statistici, Clasamente, Pescari (a guest's Pescari through sign-in); a tile whose page is
  // off is left out, and with none on there is no row.
  const quick = [
    ['Statistici', partideHrefs.stats()],
    ['Clasamente', partideHrefs.ranking()],
    ['Pescari', partideHrefs.anglersSearch() ? routes.signIn(partideHrefs.anglersSearch() as string) : null],
  ] as const;
  if (quick.some(([, href]) => href)) {
    const nav = visible(page, 'quick-nav-row');
    for (const [label, href] of quick) {
      const tile = nav.getByTestId(`quick-${label}`);
      if (href) await expect(tile).toHaveAttribute('href', href);
      else await expect(tile).toHaveCount(0);
    }
  } else {
    await expect(page.getByTestId('quick-nav-row')).toHaveCount(0);
    await expect(page.getByTestId('quick-nav-list')).toHaveCount(0);
  }

  // c12 — «Vezi toate» and the Explorează banner go to the Explorează tab (only once it is on).
  const explore = partideHrefs.explore();
  if (explore) {
    await expect(page.getByRole('link', { name: 'Vezi toate partidele în Explorează' }).locator('visible=true')).toHaveAttribute('href', explore);
    await expect(visible(page, 'explore-cta')).toHaveAttribute('href', explore);
  } else {
    await expect(page.getByTestId('explore-cta')).toHaveCount(0);
    await expect(page.getByText('Vezi toate', { exact: true })).toHaveCount(0);
  }

  // c2 — re-selecting the open tab scrolls back to the top (while there is a tab bar).
  if (tabHrefs.some(([, href]) => href)) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    const tab = tabs.getByRole('link', { name: 'Comunitate' });
    await tab.evaluate(el => (el as HTMLElement).click());
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    await expect(page).toHaveURL(/\/partide$/);
  }

  await expectNoA11yViolations(page);
  expect(errors).toEqual([]);
});

test('c9 c13 c14 c15 c16 c7 c8 c18 c19 c20 c21 — live overview: catches rail, solo / duel / leaderboard, records, venues', async ({ page }) => {
  const errors = collectConsoleErrors(page);
  const { hits } = await open(page, { overview: OVERVIEW_LIVE, history: [FINISHED_ROW] }, DESKTOP);

  // c9 — «În direct», and live and finished never together.
  await expect(page.getByRole('heading', { name: 'În direct' })).toBeVisible();
  await expect(page.getByTestId('history-card')).toHaveCount(0);
  // c10 — with something live the history is never requested.
  expect(hits.history).toBe(0);

  // c7/c8 — the rail: three cards (a clientId repeated across sessions still renders both).
  const rail = page.getByTestId('catches-rail');
  await expect(rail.getByTestId('catch-card')).toHaveCount(3);
  const first = rail.getByTestId('catch-card').nth(0);
  await expect(first).toContainText('6,4');
  await expect(first).toContainText('kg');
  await expect(first).toContainText('Crap');
  await expect(first).toContainText('Balta Solo');
  await expect(first).toContainText('acum 18m');
  const unweighed = rail.getByTestId('catch-card').nth(1);
  await expect(unweighed).toContainText('Captură');
  await expect(unweighed).not.toContainText('kg');
  await expect(unweighed).not.toContainText('0,0');
  const catchHref = partideHrefs.partida('solo-1');
  if (catchHref) await expect(first.getByRole('link')).toHaveAttribute('href', catchHref);
  else await expect(first.getByRole('link')).toHaveCount(0);

  // c13 — solo.
  const solo = page.getByTestId('venue-card-solo');
  await expect(solo.getByTestId('card-ribbon')).toHaveText('Live');
  await expect(solo.getByRole('heading', { name: 'Ion Popescu' })).toBeVisible();
  await expect(solo).toContainText('Balta Solo');
  await expect(solo).toContainText('Stand 7');
  const strip = solo.getByTestId('stat-strip');
  await expect(strip).toContainText('3');
  await expect(strip).toContainText('capturi');
  await expect(strip).toContainText('12,5');
  await expect(strip).toContainText('kg total');
  await expect(strip).toContainText('2h 05m');
  await expect(strip).toContainText('de pescuit');
  await expect(solo.getByTestId('photo-strip').locator('li')).toHaveCount(3);
  await expect(solo.getByTestId('photo-strip')).toContainText('+2');
  await expect(solo).toContainText('Ultima captură acum 18 min');
  if (partideHrefs.partida('solo-1')) {
    await expect(solo.getByRole('link', { name: 'Ion Popescu' })).toHaveAttribute('href', partideHrefs.partida('solo-1') as string);
    await expect(solo).toContainText('Vezi partida');
  } else await expect(solo.getByRole('link')).toHaveCount(0);

  // c14/c16 — duel: venue header, the count line, the leader; the shell → the water's partide page.
  const duel = page.getByTestId('venue-card-duel');
  await expect(duel.getByTestId('card-ribbon')).toHaveText('Duel live');
  await expect(duel).toContainText('București · 2 partide în duel');
  await expect(duel.getByTestId('duel-side')).toHaveCount(2);
  await expect(duel.getByTestId('duel-side').nth(0)).toContainText('(conduce)');
  await expect(duel.getByTestId('duel-side').nth(1)).not.toContainText('(conduce)');
  await expect(duel.getByTestId('duel-side').nth(1)).toContainText('Ana Pop și Radu Ionescu');
  await expect(duel.getByTestId('duel-delta')).toContainText('+5,5');
  await expect(duel.getByRole('link', { name: 'Lacul Tineretului' })).toHaveAttribute('href', routes.publicWaterPartide('L:RO10_01.025_L3'));
  await expect(duel).toContainText('Vezi duelul');

  // c15/c16 — leaderboard: one row per partidă, ranked; the shell → the lake's partide page.
  const board = page.getByTestId('venue-card-leaderboard');
  await expect(board).toContainText('Ilfov · 4 standuri în întrecere');
  await expect(board.getByTestId('leaderboard-row')).toHaveCount(4);
  await expect(board.getByTestId('leaderboard-row').nth(0)).toContainText('Stand 3');
  await expect(board.getByTestId('leaderboard-row').nth(0)).toContainText('31,4');
  await expect(board.getByTestId('leaderboard-row').nth(3)).toContainText('1 pescar');
  await expect(board.getByRole('link', { name: 'Lacul Mare' })).toHaveAttribute('href', routes.lakePartide('board-lake'));
  await expect(board).toContainText('Vezi partidele');
  // A guest has no «self» row.
  await expect(board.locator('[data-self]')).toHaveCount(0);

  // c18–c20 — the 2×2: AZI record, SĂPTĂMÂNA invitation, LUNA record, Statistici.
  const records = visible(page, 'records-grid');
  await expect(records.locator('li')).toHaveCount(4);
  const today = records.getByTestId('record-today');
  await expect(today).toContainText('AZI');
  await expect(today).toContainText('9,0');
  await expect(today).toContainText('Amur');
  const recHref = partideHrefs.partida('lb-1');
  if (recHref) await expect(today).toHaveAttribute('href', recHref);
  else await expect(today).not.toHaveAttribute('href', /.*/);
  const month = records.getByTestId('record-month');
  await expect(month).toContainText('LUNA');
  await expect(month).toContainText('21,35');
  await expect(month).toContainText('Captură');
  // No sessionDocumentId → never interactive.
  await expect(month).not.toHaveAttribute('href', /.*/);
  const week = records.getByTestId('record-invite-week');
  await expect(week).toContainText('Recordul săptămânii te așteaptă');
  if (partideHrefs.start()) await expect(week).toHaveAttribute('href', partideHrefs.start() as string);
  const stats = records.getByTestId('record-stats');
  await expect(stats).toContainText('Statistici comunitate');
  if (partideHrefs.stats()) await expect(stats).toHaveAttribute('href', partideHrefs.stats() as string);

  // c21 — the top 2 venues; only a lake is a link.
  const venues = visible(page, 'popular-venues').getByTestId('popular-venue');
  await expect(venues).toHaveCount(2);
  await expect(venues.nth(0)).toContainText('1 live');
  await expect(venues.nth(0)).toContainText('Giurgiu · 24 de partide');
  await expect(venues.nth(0)).toHaveAttribute('href', routes.lake('solo-lake'));
  await expect(venues.nth(1)).toContainText('1 partidă');
  await expect(venues.nth(1)).not.toContainText('live');
  await expect(venues.nth(1)).not.toHaveAttribute('href', /.*/);

  await expectNoA11yViolations(page);
  expect(errors).toEqual([]);
});

test('c15 — signed in, the viewer\'s own leaderboard row is marked', async ({ page, context }) => {
  const uid = await signedIn(context, page);
  await mockActivePartida(page, null);
  const overview = {
    ...OVERVIEW_LIVE,
    activeVenues: [{ ...LEADERBOARD, sessions: LEADERBOARD.sessions.map(s => ({ ...s, members: s.members.map(m => (m.uid === 'VIEWER' ? { ...m, uid } : m)) })) }],
  };
  await open(page, { overview, history: [] });
  const rows = page.getByTestId('venue-card-leaderboard').getByTestId('leaderboard-row');
  await expect(rows.nth(2)).toHaveAttribute('data-self', 'true');
  await expect(rows.nth(2)).toContainText('(partida ta)');
  await expect(page.locator('[data-self]')).toHaveCount(1);
});

test('c9 c10 c17 c25 — nothing live: skeleton until the history answers, then «Ultimele partide» (3 of them)', async ({ page }) => {
  const { hits, state } = await open(page, { overview: OVERVIEW_EMPTY, history: [FINISHED_ROW, { ...FINISHED_ROW, documentId: 'fin-2' }, { ...FINISHED_ROW, documentId: 'fin-3' }, { ...FINISHED_ROW, documentId: 'fin-4' }], delayMs: 1500 });
  // c25/c10 — the skeleton, never the empty prose, while overview and history are pending.
  await expect(page.getByTestId('comunitate-skeleton').first()).toBeAttached();
  await expect(page.getByText('Se încarcă partidele comunității…').first()).toBeAttached();
  await expect(page.getByText('Nicio partidă publică activă acum.')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Ultimele partide' })).toBeVisible();
  expect(hits.overview).toBe(1);
  expect(hits.history).toBe(1);
  state.delayMs = 0;
  await expect(page.getByText('Nicio partidă publică activă acum.')).toHaveCount(0);
  const cards = page.getByTestId('history-card');
  await expect(cards).toHaveCount(3);
  // c17 — the finished card.
  const card = cards.nth(0);
  await expect(card.getByTestId('card-ribbon')).toHaveText('Încheiată');
  await expect(card.getByRole('heading', { name: 'Gheorghe Ilie' })).toBeVisible();
  await expect(card).toContainText('Balta Solo');
  await expect(card).toContainText('Stand 2');
  await expect(card).toContainText('1');
  await expect(card).toContainText('captură');
  await expect(card).toContainText('4,25');
  await expect(card).toContainText('durată');
  await expect(card).toContainText('11h 30m');
  await expect(card).toContainText('26 IUL · 06:40 – 18:10');
  const href = partideHrefs.partida('fin-1');
  if (href) {
    await expect(card.getByRole('link', { name: 'Gheorghe Ilie' })).toHaveAttribute('href', href);
    await expect(card).toContainText('Vezi rezumatul');
  } else await expect(card.getByRole('link')).toHaveCount(0);
  // The rail and the venues are hidden when empty; the records are always 4 tiles (invitations).
  await expect(page.getByTestId('catches-rail')).toHaveCount(0);
  await expect(page.getByTestId('popular-venues')).toHaveCount(0);
  const records = visible(page, 'records-grid');
  await expect(records.getByTestId('record-invite-today')).toContainText('Recordul de azi te așteaptă');
  await expect(records.getByTestId('record-invite-week')).toContainText('Recordul săptămânii te așteaptă');
  await expect(records.getByTestId('record-invite-month')).toContainText('Recordul lunii te așteaptă');
});

test('c11 — empty: «Partide active» and the tutorial captions', async ({ page }) => {
  await open(page, { overview: OVERVIEW_EMPTY, history: [] });
  await expect(page.getByRole('heading', { name: 'Partide active' })).toBeVisible();
  await expect(page.getByTestId('empty-section')).toContainText('O partidă poate fi solo sau cu 2-3 pescari împreună.');
  await expect(page.getByTestId('empty-section')).toContainText('Nicio partidă publică activă acum.');
  await expectNoA11yViolations(page);
});

test('overview error — rendered as empty sections (no retry, no error card)', async ({ page }) => {
  collectConsoleErrors(page);
  const { hits } = await open(page, { overview: 'error', history: [] });
  await expect(page.getByRole('heading', { name: 'Partide active' })).toBeVisible();
  await expect(visible(page, 'records-grid').locator('li')).toHaveCount(4);
  await expect(page.getByTestId('catches-rail')).toHaveCount(0);
  await page.waitForTimeout(1500);
  expect(hits.overview).toBe(1);
});

test('c22 c23 b.refetch-intervals — the overview polls every 60s without retrying; relative times tick on one clock', async ({ page }) => {
  await page.clock.install();
  const { hits, state } = await open(page, { overview: OVERVIEW_LIVE, history: [] });
  const firstCard = page.getByTestId('catch-card').nth(0);
  await expect(firstCard).toContainText('acum 18m');
  const start = hits.overview;
  await page.clock.runFor(55_000);
  expect(hits.overview).toBe(start);
  // c22 — every label moved on together.
  await expect(firstCard).toContainText('acum 19m');
  await expect(page.getByTestId('catch-card').nth(2)).toContainText('acum 1z');
  await page.clock.runFor(6_000);
  await expect.poll(() => hits.overview).toBe(start + 1);
  // A failed poll is one request (retry false) and the last data stays.
  state.overview = 'error';
  await page.clock.runFor(60_000);
  await expect.poll(() => hits.overview).toBe(start + 2);
  await page.clock.runFor(20_000);
  expect(hits.overview).toBe(start + 2);
  await expect(page.getByTestId('venue-card-solo')).toBeVisible();
});

test('c24 — «Reîmprospătează» refetches the own partide and every community query', async ({ page, context }) => {
  await signedIn(context, page);
  const own = await mockActivePartida(page, null);
  const { hits } = await open(page, { overview: OVERVIEW_EMPTY, history: [FINISHED_ROW] });
  await expect(page.getByRole('heading', { name: 'Ultimele partide' })).toBeVisible();
  const before = { ...hits, mine: own.mine };
  await page.getByRole('button', { name: 'Reîmprospătează' }).locator('visible=true').click();
  await expect.poll(() => hits.overview).toBe(before.overview + 1);
  await expect.poll(() => hits.history).toBe(before.history + 1);
  await expect.poll(() => own.mine).toBeGreaterThan(before.mine);
  await expect(page.getByRole('status').filter({ hasText: 'Actualizat' }).first()).toBeAttached();
});

test('c5 c26 c27 c28 b.active-dock-global — a live partidă: no hero, no «Începe», the dock', async ({ page, context }) => {
  await signedIn(context, page);
  await mockActivePartida(
    page,
    activeSession({
      rods: [
        { index: 0, color: '#22c55e', phase: 'fishing', endsInMs: 754_000 },
        { index: 1, color: '#f97316', phase: 'ready', endsInMs: -5_000 },
      ],
    }),
  );
  await open(page, { overview: OVERVIEW_EMPTY, history: [] });
  const dock = page.getByTestId('partida-activa-dock');
  await expect(dock).toBeVisible();
  // c5/c1 — no hero, no start pill.
  await expect(page.getByRole('region', { name: 'Ești la pescuit?' })).toHaveCount(0);
  await expect(page.getByTestId('start-pill')).toHaveCount(0);
  // c26 — ACTIVĂ, the venue, the stats line, «Captură», the rod chips; the bar opens the partidă
  // only once that page is on the web (lib/partide-pages) — else the venue is plain text.
  await expect(dock).toContainText('ACTIVĂ');
  const partida = partideHrefs.partida(ACTIVE_ID);
  await expect(dock).toContainText('Balta Mea');
  if (partida) await expect(dock.getByRole('link', { name: 'Balta Mea' })).toHaveAttribute('href', partida);
  else await expect(dock.getByRole('link', { name: 'Balta Mea' })).toHaveCount(0);
  await expect(dock).toContainText('4 capturi · 1 scăpat · 9,4 kg max');
  // c27 — the countdown on the server-sampled clock, «expirat» for the elapsed rod.
  const chips = dock.getByRole('list', { name: 'Lansete' }).locator('li');
  await expect(chips).toHaveCount(2);
  await expect(chips.nth(0)).not.toContainText('sincronizare');
  await expect(chips.nth(0)).toContainText(/\d/);
  await expect(chips.nth(1)).toContainText('expirat');
  // c28 — «Captură» → the capture flow once on the web, else the partidă (when that is on), else
  // left out; offline → the toast.
  const captureHref = partideHrefs.capture(ACTIVE_ID) ?? partida;
  const capture = dock.getByRole('link', { name: 'Captură' });
  if (captureHref) {
    await expect(capture).toHaveAttribute('href', captureHref);
    await context.setOffline(true);
    await capture.click();
    await expect(page.getByRole('alert').filter({ hasText: 'Fără conexiune. Reconectare…' })).toBeVisible();
    await expect(page).toHaveURL(/\/partide$/);
    await context.setOffline(false);
  } else {
    await expect(capture).toHaveCount(0);
  }
  // Nothing in the dock points at a page that is off.
  if (!partida) await expect(dock.locator(`a[href="${routes.partida(ACTIVE_ID)}"]`)).toHaveCount(0);

  // From 1280 the partidă's card (the left column, or the centre when that column has nothing).
  await page.setViewportSize(DESKTOP);
  const card = page.getByTestId('partida-activa-card');
  await expect(card).toBeVisible();
  await expect(page.getByTestId('partida-activa-dock')).toBeHidden();
  if (partida) await expect(card.getByRole('link', { name: 'Deschide partida' })).toHaveAttribute('href', partida);
  else await expect(card.getByRole('link', { name: 'Deschide partida' })).toHaveCount(0);
  if (captureHref) await expect(card.getByRole('link', { name: 'Captură' })).toHaveAttribute('href', captureHref);
  else await expect(card.getByRole('link', { name: 'Captură' })).toHaveCount(0);
  await expectNoA11yViolations(page);
});

test('c4 — signed in without a live partidă: the hero (no sign-in detour)', async ({ page, context }) => {
  await signedIn(context, page);
  await mockActivePartida(page, null);
  await open(page, { overview: OVERVIEW_EMPTY, history: [] });
  const hero = page.getByRole('region', { name: 'Ești la pescuit?' }).locator('visible=true');
  const start = partideHrefs.start();
  const join = partideHrefs.join();
  if (start || join) {
    await expect(hero).toBeVisible();
    if (start) await expect(hero.getByRole('link', { name: 'Începe o partidă' })).toHaveAttribute('href', start);
    if (join) await expect(hero.getByRole('link', { name: 'Intră cu cod' })).toHaveAttribute('href', join);
  } else {
    await expect(page.getByRole('heading', { name: 'Ultimele capturi' }).or(page.getByTestId('empty-section')).first()).toBeVisible();
    await expect(page.getByRole('region', { name: 'Ești la pescuit?' })).toHaveCount(0);
  }
  const anglers = partideHrefs.anglersSearch();
  const tile = page.getByTestId('quick-Pescari').locator('visible=true');
  if (anglers) await expect(tile).toHaveAttribute('href', anglers);
  else await expect(page.getByTestId('quick-Pescari')).toHaveCount(0);
  await expect(page.getByTestId('partida-activa-dock')).toHaveCount(0);
});

test('flags — every hub link to a later M4 page follows lib/partide-pages', () => {
  // A guard for this spec's own assumptions: the switches are booleans, and an off page has no href.
  for (const [page, on] of Object.entries(PARTIDE_PAGES_ON_WEB)) {
    expect(typeof on, page).toBe('boolean');
  }
  if (!PARTIDE_PAGES_ON_WEB.explore) expect(partideHrefs.explore()).toBeNull();
  if (!PARTIDE_PAGES_ON_WEB.anglersSearch) expect(partideHrefs.anglersSearch()).toBeNull();
});
