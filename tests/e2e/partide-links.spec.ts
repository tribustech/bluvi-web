import { mkdirSync } from 'node:fs';
import type { Page, Route } from '@playwright/test';
import { NotificationTypes } from '../../core/social';
import { expectNoA11yViolations } from './helpers/a11y';
import { BASE_URL } from './helpers/base-url';
import { expect, test, type FakeLiveDoc } from './helpers/fake-live';
import { CMS, qaJwt, signIn } from './helpers/session';

/*
 * partide.links (M4-B3): every partidă link across the site now that /partide/[id] is on
 * (lib/routes ON_WEB.partida), the fish share link's 308 and the client-id resolver.
 *
 *  - partide.b.deep-link-spectate: /partide/comunitate/[id] (fish's share link,
 *    features/partide/helpers/deepLinks.ts) → 308 → /partide/[id].
 *  - partide.b.notif-finished-autoclose: /partide/sesiune/[clientId] (PARTIDA_FINISHED,
 *    PARTIDA_AUTO_CLOSE_WARN carry the CLIENT id) → the live pointer, then the own list
 *    (core findMineListItem) → /partide/[documentId]; a loaded list without it → Ale mele; a failed
 *    read / unknown session / stalled probe → the partidă error card. Signed out → /intra.
 *  - the own row → the member view, from every area that links a partidă: the lake page's live
 *    rows (lakes.detail.c22), the public water's (public-waters.detaliu.c21), the own profile's
 *    session cards (account.angler-profile.c25 on /profil, account.own-profile.c2).
 *
 * Firestore is never reached (helpers/fake-live: the projection is an in-page fake, every Firebase
 * request aborted and failing the test). CMS: the live layer's per-user reads are route-mocked
 * (no session is created anywhere); the public pages read the LOCAL CMS.
 */

const SHOTS = '.shots/partide-links';
mkdirSync(SHOTS, { recursive: true });

const NOW = new Date();
const at = (minutesAgo: number) => new Date(NOW.getTime() - minutesAgo * 60_000).toISOString();

const LIVE = { documentId: 'e2e-l-live', clientId: 'e2e-lc-live' };
const ENDED = { documentId: 'e2e-l-ended', clientId: 'e2e-lc-ended' };
const CHITA = process.env.E2E_LAKE_CHITA ?? 's84u55lo4n9z0emngozttt6e';
const TIN = { id: 328, code: 'L:RO10_01.025_L3' };

let jwt = '';
let selfId = '';

test.beforeAll(async ({ request }) => {
  jwt = await qaJwt(request);
  const me = await request.get(`${CMS}/user/profile`, { headers: { authorization: `Bearer ${jwt}` } });
  expect(me.ok(), 'QA profile read').toBe(true);
  selfId = (await me.json()).documentId as string;
});

/* ------------------------------------------------------------------------------------------------
 * Fixtures (the shapes of tests/e2e/partida.spec.ts)
 * ---------------------------------------------------------------------------------------------- */

const member = (uid: string, name: string | null) => ({ uid, name, avatar: null, joinedAt: at(130) });

function liveDoc(patch: Partial<FakeLiveDoc> = {}): FakeLiveDoc {
  return {
    startedAt: at(134),
    endedAt: null,
    status: 'active',
    venueType: 'lake',
    lakeId: CHITA,
    lakeName: 'Balta Mock',
    standName: '7',
    locality: 'Giurgiu',
    anchorLat: 44.4321,
    anchorLong: 26.1234,
    anchorName: null,
    warnedAt: null,
    autoCloseAt: null,
    plannedDurationMs: 8 * 3_600_000,
    visibleOnProfile: true,
    hostUid: selfId,
    joinCode: 'K7M2QX',
    members: [member(selfId, 'Eu Pescar')],
    rods: [],
    catches: [],
    rev: 1,
    ...patch,
  };
}

type ListItem = Record<string, unknown> & { documentId: string; clientId: string };

function listItem(ids: { documentId: string; clientId: string }): ListItem {
  return {
    documentId: ids.documentId,
    clientId: ids.clientId,
    clientUpdatedAt: null,
    venueType: 'lake',
    lakeId: CHITA,
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
    plannedDurationMs: 6 * 3_600_000,
    notes: null,
    visibleOnProfile: true,
    status: 'finished',
    targetSpecies: [],
    hostUid: selfId,
    captures: 0,
    recordKg: null,
    totalKg: null,
  };
}

function detailOf(item: ListItem) {
  const { captures: _c, recordKg: _r, totalKg: _t, ...base } = item;
  void _c;
  void _r;
  void _t;
  return { ...base, joinCode: 'ARH1VE', rods: [], members: [member(selfId, 'Eu Pescar')], events: [] };
}

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

/** The live layer's per-user CMS reads: the active pointer, the own list, the own details. */
async function mockOwn(
  page: Page,
  { active = null as null | { documentId: string; clientId: string }, mine = [] as ListItem[] | number } = {},
) {
  const calls = { active: 0, mine: 0 };
  await page.route('**/api/cms/feed/session-follows/mine', route => json(route, { data: { sessionDocumentIds: [] } }));
  await page.route('**/api/cms/feed/sessions/active', route => {
    calls.active += 1;
    return json(route, { data: active ? { documentId: active.documentId, clientId: active.clientId, firestoreId: active.clientId } : null });
  });
  await page.route(/\/api\/cms\/feed\/sessions\/mine(\?.*)?$/, route => {
    calls.mine += 1;
    if (typeof mine === 'number') return json(route, { data: null, error: { status: mine, name: 'Error', message: 'mock' } }, mine);
    return json(route, { data: mine, meta: { page: 1, pageSize: 100, total: mine.length } });
  });
  await page.route(/\/api\/cms\/feed\/sessions\/(e2e-[^/?]+)(\?.*)?$/, route => {
    const id = /sessions\/(e2e-[^/?]+)/.exec(route.request().url())![1];
    const item = typeof mine === 'number' ? undefined : mine.find(m => m.documentId === id);
    return item ? json(route, { data: detailOf(item) }) : json(route, { data: null, error: { status: 404, name: 'NotFoundError', message: 'mock' } }, 404);
  });
  await page.route(/\/feed\/community\/sessions\/(e2e-[^/?]+)(\?.*)?$/, route => json(route, { data: null, error: { status: 404, name: 'NotFoundError', message: 'mock' } }, 404));
  return calls;
}

const memberView = (page: Page) => page.getByTestId('partida-member-view');

/* ------------------------------------------------------------------------------------------------
 * partide.b.deep-link-spectate
 * ---------------------------------------------------------------------------------------------- */

test.describe('partide.b.deep-link-spectate', () => {
  test('partide.b.deep-link-spectate — fish\'s share link /partide/comunitate/[id] is a 308 to /partide/[id], which renders the partidă', async ({ page, request, context }) => {
    const res = await request.get(`${BASE_URL}/partide/comunitate/abc123?x=1`, { maxRedirects: 0 });
    expect(res.status()).toBe(308);
    expect(new URL(res.headers().location, BASE_URL).pathname).toBe('/partide/abc123');
    // A real public partidă of the local CMS: the share link lands on its page, signed out.
    const sessions = (await (await request.get(`${CMS}/feed/community/history?page=1&pageSize=1`)).json()).data as { documentId: string }[];
    test.skip(!sessions.length, 'no public partidă in the local CMS');
    await context.clearCookies();
    await page.goto(`/partide/comunitate/${sessions[0].documentId}`);
    await expect(page).toHaveURL(new RegExp(`/partide/${sessions[0].documentId}$`));
    await expect(page.getByTestId('partida-spectator')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });
});

/* ------------------------------------------------------------------------------------------------
 * partide.b.notif-finished-autoclose — /partide/sesiune/[clientId]
 * ---------------------------------------------------------------------------------------------- */

test.describe('partide.b.notif-finished-autoclose', () => {
  test.beforeEach(async ({ context }) => {
    await signIn(context, jwt);
  });

  test('partide.b.notif-finished-autoclose — the live pointer names the client id → /partide/[documentId], the member view (replace: Back skips the hop)', async ({ page, fakeLive }) => {
    await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc() } });
    await mockOwn(page, { active: LIVE });
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/stiri');
    await page.goto(`/partide/sesiune/${LIVE.clientId}`);
    await expect(page).toHaveURL(new RegExp(`/partide/${LIVE.documentId}$`));
    await expect(memberView(page)).toBeVisible();
    await expect(page.locator('meta[name="robots"][content="noindex"]')).toHaveCount(1);
    await page.goBack();
    await expect(page).toHaveURL(/\/stiri$/);
  });

  test('partide.b.notif-finished-autoclose — no pointer, the own list has the client id → /partide/[documentId] (member view)', async ({ page }) => {
    await mockOwn(page, { active: null, mine: [listItem(ENDED)] });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/partide/sesiune/${ENDED.clientId}`);
    await expect(page).toHaveURL(new RegExp(`/partide/${ENDED.documentId}$`));
    await expect(memberView(page)).toBeVisible();
    await expect(page.getByTestId('partida-title')).toHaveText('Lacul Istoric');
  });

  test('partide.b.notif-finished-autoclose — unresolvable (not live, the own list LOADED without it) → Ale mele', async ({ page }) => {
    await mockOwn(page, { active: null, mine: [listItem(ENDED)] });
    await page.setViewportSize({ width: 1280, height: 900 });
    // Meanwhile: the partidă page's skeleton, never a «not found».
    const shell = await (await page.request.get(`/partide/sesiune/e2e-unknown`)).text();
    expect(shell).not.toContain('partida-not-found');
    await page.goto('/partide/sesiune/e2e-unknown');
    await expect(page).toHaveURL(/\/partide\/ale-mele$/);
  });

  test('partide.b.notif-finished-autoclose — a failed own list is «unknown», never «not mine»: the URL stays, the error card, «Reîncearcă» reads the list again and resolves', async ({ page }) => {
    await mockOwn(page, { active: null, mine: [listItem(ENDED)] });
    let fail = true;
    let reads = 0;
    await page.unroute(/\/api\/cms\/feed\/sessions\/mine(\?.*)?$/);
    await page.route(/\/api\/cms\/feed\/sessions\/mine(\?.*)?$/, route => {
      reads += 1;
      if (fail) return json(route, { data: null, error: { status: 500, name: 'Error', message: 'mock' } }, 500);
      return json(route, { data: [listItem({ documentId: ENDED.documentId, clientId: 'e2e-failed-list' })], meta: { page: 1, pageSize: 100, total: 1 } });
    });
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/partide/sesiune/e2e-failed-list');
    const card = page.getByTestId('partida-error');
    await expect(card).toBeVisible({ timeout: 30_000 });
    await expect(card).toContainText('Nu am putut încărca partida.');
    await expect(page).toHaveURL(/\/partide\/sesiune\/e2e-failed-list$/);
    expect(reads).toBe(2); // the first read + its one retry
    fail = false;
    await card.getByRole('button', { name: 'Reîncearcă' }).click();
    await expect(page).toHaveURL(new RegExp(`/partide/${ENDED.documentId}$`));
    await expect(memberView(page)).toBeVisible();
  });

  test('partide.b.notif-finished-autoclose — the session cannot be read (/users/me fails): the partidă error card with «Reîncearcă», never an endless skeleton nor a sign-in', async ({ page, context }) => {
    await context.clearCookies();
    const { hostname } = new URL(BASE_URL);
    // A cookie the CMS cannot read: the session is «unknown» (owner rule 4), not signed out.
    await context.addCookies([{ name: 'bluvi_session', value: '%C8%99abc', domain: hostname, path: '/', sameSite: 'Lax' }]);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`/partide/sesiune/${LIVE.clientId}`);
    const card = page.getByTestId('partida-error');
    await expect(card).toBeVisible({ timeout: 30_000 });
    await expect(card).toContainText('Nu am putut încărca partida.');
    await expect(card.getByRole('button', { name: 'Reîncearcă' })).toBeVisible();
    await expect(page.getByTestId('partida-session-resolver')).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`/partide/sesiune/${LIVE.clientId}$`));
  });

  test('partide.b.notif-finished-autoclose — the pointer probe never answers: past the deadline the error card, not a skeleton forever', async ({ page }) => {
    test.slow();
    await mockOwn(page, { active: null, mine: [listItem(ENDED)] });
    await page.unroute('**/api/cms/feed/sessions/active');
    await page.route('**/api/cms/feed/sessions/active', () => new Promise<void>(() => {}));
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/partide/sesiune/e2e-stalled');
    await expect(page.getByTestId('partida-session-resolver')).toBeVisible();
    await expect(page.getByTestId('partida-error')).toBeVisible({ timeout: 40_000 });
    await expect(page).toHaveURL(/\/partide\/sesiune\/e2e-stalled$/);
  });

  test('partide.b.notif-finished-autoclose — signed out: a 307 to sign-in that returns to the resolver', async ({ request, page, context }) => {
    await context.clearCookies();
    const res = await request.get(`${BASE_URL}/partide/sesiune/${LIVE.clientId}`, { maxRedirects: 0, headers: { cookie: '' } });
    expect(res.status()).toBe(307);
    expect(res.headers().location).toBe(`/intra?next=${encodeURIComponent(`/partide/sesiune/${LIVE.clientId}`)}`);
    await page.goto(`/partide/sesiune/${LIVE.clientId}`);
    await expect(page).toHaveURL(/\/intra\?next=/);
  });

  test('partide.b.notif-finished-autoclose partide.b.notif-community — a PARTIDA_FINISHED row on /notificari lands on the member view; a PARTIDA_CATCH row links /partide/[documentId]', async ({ page, fakeLive }) => {
    await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc() } });
    await mockOwn(page, { active: LIVE });
    const rows = [
      { type: NotificationTypes.PARTIDA_FINISHED, data: { sessionId: LIVE.clientId }, title: 'Partida s-a încheiat' },
      { type: NotificationTypes.PARTIDA_CATCH, data: { sessionDocumentId: 'e2e-community-1' }, title: 'Captură nouă' },
    ];
    await page.route(/\/api\/cms\/notification-users(\/|\?|$)/, route => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith('/unread')) return json(route, { count: 2 });
      if (route.request().method() === 'POST') return json(route, { message: 'ok' });
      return json(route, {
        data: rows.map((r, i) => ({
          id: 9000 + i,
          documentId: `row-e2e-${i}`,
          read: false,
          readAt: null,
          notification: { id: 9100 + i, documentId: `n-e2e-${i}`, title: r.title, body: 'Detalii', sentAt: at(5 + i), data: { type: r.type, ...r.data }, type: r.type },
        })),
        meta: { pagination: { page: 1, pageSize: 10, pageCount: 1, total: rows.length } },
      });
    });
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/notificari');
    const list = page.getByRole('list', { name: 'Notificări' });
    await expect(list.getByRole('link', { name: /Captură nouă/ })).toHaveAttribute('href', '/partide/e2e-community-1');
    const finished = list.getByRole('link', { name: /Partida s-a încheiat/ });
    await expect(finished).toHaveAttribute('href', `/partide/sesiune/${LIVE.clientId}`);
    await finished.click();
    await expect(page).toHaveURL(new RegExp(`/partide/${LIVE.documentId}$`));
    await expect(memberView(page)).toBeVisible();
  });
});

/* ------------------------------------------------------------------------------------------------
 * The own row → the member view, from every area that links a partidă
 * ---------------------------------------------------------------------------------------------- */

test.describe('own partidă → member view', () => {
  test.beforeEach(async ({ context }) => {
    await signIn(context, jwt);
  });

  test('lakes.detail.c22 — the viewer\'s own live row on the lake page opens their partidă as a member', async ({ page, fakeLive }) => {
    await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc() } });
    await mockOwn(page, { active: LIVE });
    // The lake's community section is read in the browser (the server read faulted): it lists the
    // viewer's own live partidă.
    const fault = (faults: string[]) => page.request.post(`${BASE_URL}/balti/${CHITA}/e2e-fault`, { data: { faults } });
    expect((await fault(['community'])).ok()).toBe(true);
    try {
      await page.route('**/feed/community/lakes/*', route =>
        json(route, {
          data: {
            stats: { activeNow: 1, catchesThisMonth: 0, recordKg: null },
            activeSessions: [{ documentId: LIVE.documentId, startedAt: at(134), members: [{ uid: selfId, name: 'Eu Pescar', avatarUrl: null }], catchCount: 0, maxKg: null, totalKg: null, standName: '7' }],
            monthlyActivity: [{ month: 'OCT', count: 1 }],
          },
        }),
      );
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(`/balti/${CHITA}`);
      const row = page.getByTestId(`live-row-${LIVE.documentId}`);
      await expect(row).toHaveAttribute('href', `/partide/${LIVE.documentId}`, { timeout: 30_000 });
      await expect(row).toContainText('(partida ta)');
      await row.click();
      await expect(page).toHaveURL(new RegExp(`/partide/${LIVE.documentId}$`));
      await expect(memberView(page)).toBeVisible();
    } finally {
      await fault([]);
    }
  });

  test('public-waters.detaliu.c21 public-waters.partide.c11 — the viewer\'s own live row on a public water opens their partidă as a member', async ({ page, fakeLive }) => {
    await fakeLive.seed({ docs: { [LIVE.clientId]: liveDoc({ venueType: 'publicWater', lakeId: null, publicWaterCode: TIN.code, publicWaterName: 'Tineretului' }) } });
    await mockOwn(page, { active: LIVE });
    await page.route(`**/feed/community/waters/${encodeURIComponent(TIN.code)}`, route =>
      json(route, {
        data: {
          stats: { activeNow: 1, catchesThisMonth: 0, recordKg: null },
          activeSessions: [{ documentId: LIVE.documentId, startedAt: at(134), members: [{ uid: selfId, name: 'Eu', avatarUrl: null }], catchCount: 0, maxKg: null, totalKg: null }],
          monthlyActivity: [{ month: 'OCT', count: 1 }],
          speciesCounts: [],
        },
      }),
    );
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`/ape-publice/${TIN.id}`);
    const row = page.getByTestId(`live-row-${LIVE.documentId}`);
    await expect(row).toContainText('(partida ta)');
    await expect(row).toHaveAttribute('href', `/partide/${LIVE.documentId}`);
    await row.click();
    await expect(page).toHaveURL(new RegExp(`/partide/${LIVE.documentId}$`));
    await expect(memberView(page)).toBeVisible();
  });

  test('account.angler-profile.c24 account.angler-profile.c25 account.own-profile.c2 — the own profile\'s session cards: «Vezi rezumatul», the card opens the own partidă as a member', async ({ page }) => {
    await mockOwn(page, { active: null, mine: [listItem(ENDED)] });
    await page.route(new RegExp(`/feed/anglers/${selfId}/sessions`), route =>
      json(route, {
        data: [
          {
            documentId: ENDED.documentId,
            venueName: 'Lacul Istoric',
            photoUrl: null,
            startedAt: at(26 * 60),
            endedAt: at(20 * 60),
            durationMs: 6 * 3_600_000,
            isActive: false,
            catches: 2,
            totalKg: 7.3,
            maxKg: 5.1,
            isPersonalRecord: false,
            locality: 'Ilfov',
            standName: null,
            photos: [],
            photoCount: 0,
          },
        ],
        meta: { pagination: { page: 1, pageSize: 10, pageCount: 1, total: 1 } },
      }),
    );
    for (const width of [375, 1280, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/profil?tab=concursuri');
      await page.getByRole('tab', { name: /^Partide(, \d+)?$/ }).click();
      const card = page.getByTestId('session-card').first();
      await expect(card).toContainText('Vezi rezumatul');
      await expect(card.getByRole('link')).toHaveAttribute('href', `/partide/${ENDED.documentId}`);
      await page.screenshot({ path: `${SHOTS}/profil-partide-${width}.png` });
      if (width === 1280) await expectNoA11yViolations(page);
    }
    await page.getByTestId('session-card').first().getByRole('link').click();
    await expect(page).toHaveURL(new RegExp(`/partide/${ENDED.documentId}$`));
    await expect(memberView(page)).toBeVisible();
  });
});
