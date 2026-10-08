import { mkdirSync } from 'node:fs';
import type { Page, Route } from '@playwright/test';
import { NotificationTypes } from '../../core/social';
import { qaUser } from '../qa-user';
import { expectNoA11yViolations } from './helpers/a11y';
import { BASE_URL } from './helpers/base-url';
import { expect, test, type FakeLiveDoc } from './helpers/fake-live';
import { CMS, qaJwt, signIn } from './helpers/session';

/*
 * partide.intra-cod (M4-B6): /partide/intra/[cod] — join a partidă with the code of an invite
 * (fish app/(app)/partide/join/[code].tsx), plus partide.b.deep-link-join (fish's invite link
 * /partide/join/{code} → 308 → here) and partide.b.notif-invite (PARTIDA_INVITE → here).
 *
 * No partidă is ever joined: POST /feed/sessions/join is route-mocked in every test (the local CMS
 * would really add the QA user to a session). Firestore is never reached (helpers/fake-live: the
 * projection is an in-page fake, every Firebase request aborted and failing the test); the live
 * layer's per-user reads (pointer probe, own list, the joined session) are route-mocked too.
 */

const SHOTS = '.shots/partide-intra-cod';
mkdirSync(SHOTS, { recursive: true });
const WIDTHS = [375, 1280, 1440, 1920] as const;

const CONFIRM_COPY = 'Vei apărea ca participant, iar capturile pe care le adaugi intră în această partidă.';
const CHECK_COPY = 'Verifică codul și încearcă din nou.';
const JOINED = { documentId: 'e2e-j-doc', firestoreId: 'e2e-j-fs' };

const NOW = new Date();
const at = (minutesAgo: number) => new Date(NOW.getTime() - minutesAgo * 60_000).toISOString();

let jwt = '';
let selfId = '';

test.beforeAll(async ({ request }) => {
  jwt = await qaJwt(request);
  const me = await request.get(`${CMS}/user/profile`, { headers: { authorization: `Bearer ${jwt}` } });
  expect(me.ok(), 'QA profile read').toBe(true);
  selfId = (await me.json()).documentId as string;
});

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const bluError = (route: Route, bluCode: string, status = 400) =>
  json(route, { data: null, error: { status, name: 'ApplicationError', message: bluCode, details: { bluCode } } }, status);

const member = (uid: string, name: string | null) => ({ uid, name, avatar: null, joinedAt: at(5) });

/** The CMS's join answer (sessionCreateJoinDTO): the joined session + its Firestore id. */
function joinedDTO() {
  return {
    documentId: JOINED.documentId,
    clientId: JOINED.firestoreId,
    firestoreId: JOINED.firestoreId,
    clientUpdatedAt: null,
    venueType: 'lake',
    lakeId: null,
    lakeName: 'Balta Prietenului',
    lakeImageUrl: null,
    publicWaterCode: null,
    publicWaterName: null,
    manualVenueName: null,
    standId: null,
    standName: '4',
    locality: 'Ilfov',
    anchorLat: 44.5,
    anchorLong: 26.2,
    anchorName: null,
    startedAt: at(60),
    endedAt: null,
    plannedDurationMs: 6 * 3_600_000,
    notes: null,
    visibleOnProfile: true,
    status: 'active',
    targetSpecies: [],
    hostUid: 'e2e-host',
    joinCode: 'ABC123',
    rods: [],
    members: [member('e2e-host', 'Gazda'), member(selfId, 'Eu Pescar')],
  };
}

function liveDoc(): FakeLiveDoc {
  return {
    startedAt: at(60),
    endedAt: null,
    status: 'active',
    venueType: 'lake',
    lakeId: null,
    lakeName: 'Balta Prietenului',
    standName: '4',
    locality: 'Ilfov',
    anchorLat: 44.5,
    anchorLong: 26.2,
    anchorName: null,
    warnedAt: null,
    autoCloseAt: null,
    plannedDurationMs: 6 * 3_600_000,
    visibleOnProfile: true,
    hostUid: 'e2e-host',
    joinCode: 'ABC123',
    members: [member('e2e-host', 'Gazda'), member(selfId, 'Eu Pescar')],
    rods: [],
    catches: [],
    rev: 1,
  };
}

/**
 * The per-user reads of the live layer (no pointer, an empty own list, the joined session's
 * detail) and the join itself, answered by `answer` (default: success after `delayMs`).
 */
async function mockCms(page: Page, { answer, delayMs = 0 }: { answer?: (route: Route, n: number) => Promise<void>; delayMs?: number } = {}) {
  const joins: { code: string }[] = [];
  let joined = false;
  await page.route('**/api/cms/feed/session-follows/mine', route => json(route, { data: { sessionDocumentIds: [] } }));
  await page.route('**/api/cms/feed/sessions/active', route =>
    json(route, { data: joined ? { documentId: JOINED.documentId, clientId: JOINED.firestoreId, firestoreId: JOINED.firestoreId } : null }),
  );
  await page.route(/\/api\/cms\/feed\/sessions\/mine(\?.*)?$/, route => json(route, { data: [], meta: { page: 1, pageSize: 100, total: 0 } }));
  await page.route('**/api/cms/feed/sessions/join', async route => {
    expect(route.request().method()).toBe('POST');
    joins.push((route.request().postDataJSON() as { data: { code: string } }).data);
    if (delayMs) await new Promise(r => setTimeout(r, delayMs));
    if (answer) return answer(route, joins.length);
    joined = true;
    return json(route, { data: joinedDTO() });
  });
  await page.route(new RegExp(`/api/cms/feed/sessions/${JOINED.documentId}(\\?.*)?$`), route => {
    const { firestoreId: _f, ...detail } = joinedDTO();
    void _f;
    return json(route, { data: { ...detail, events: [] } });
  });
  await page.route(/\/feed\/community\/sessions\/(e2e-[^/?]+)(\?.*)?$/, route => json(route, { data: null, error: { status: 404, name: 'NotFoundError', message: 'mock' } }, 404));
  return { joins, markJoined: () => (joined = true) };
}

const confirmStep = (page: Page) => page.getByTestId('partida-join-confirm-step');
const errorStep = (page: Page) => page.getByTestId('partida-join-error');
const joinButton = (page: Page) => page.getByRole('button', { name: 'Alătură-te', exact: true });

async function shots(page: Page, state: string) {
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: width < 768 ? 812 : 900 });
    await page.screenshot({ path: `${SHOTS}/${state}-${width}.png`, fullPage: true });
  }
}

/* ------------------------------------------------------------------------------------------------
 * Signed out — c1, partide.b.deep-link-join
 * ---------------------------------------------------------------------------------------------- */

test.describe('signed out', () => {
  test('partide.intra-cod.c1 — signed out, /partide/intra/[cod] is a 307 to sign-in that returns to it', async ({ request, page, context }) => {
    await context.clearCookies();
    const res = await request.get(`${BASE_URL}/partide/intra/ABC123`, { maxRedirects: 0, headers: { cookie: '' } });
    expect(res.status()).toBe(307);
    expect(res.headers().location).toBe(`/intra?next=${encodeURIComponent('/partide/intra/ABC123')}`);
    await page.goto('/partide/intra/ABC123');
    await expect(page).toHaveURL(/\/intra\?next=%2Fpartide%2Fintra%2FABC123$/);
  });

  test('partide.b.deep-link-join partide.intra-cod.c1 — fish\'s invite link /partide/join/[code] → 308 → /partide/intra/[cod] → sign-in → back to the confirmation', async ({ request, page, context }) => {
    await context.clearCookies();
    const res = await request.get(`${BASE_URL}/partide/join/ABC123`, { maxRedirects: 0, headers: { cookie: '' } });
    expect(res.status()).toBe(308);
    expect(new URL(res.headers().location, BASE_URL).pathname).toBe('/partide/intra/ABC123');

    const { joins } = await mockCms(page);
    // The sign-in route answered without the CMS: the QA JWT becomes the session cookie, as the
    // real route does (helpers of tests/e2e/intra.spec.ts) — no extra POST /auth/local.
    await page.route('**/api/auth/local', async route => {
      await page.context().addCookies([{ name: 'bluvi_session', value: jwt, url: BASE_URL, httpOnly: true, sameSite: 'Lax' }]);
      await route.fulfill({ json: { user: { id: 1 }, firebaseToken: null } });
    });
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/partide/join/ABC123');
    await expect(page).toHaveURL(/\/intra\?next=%2Fpartide%2Fintra%2FABC123$/);
    const { identifier, password } = qaUser();
    await page.locator('input[name=identifier]').fill(identifier);
    await page.locator('input[name=password]').fill(password);
    await page.getByRole('region', { name: 'Hai la pescuit.' }).getByRole('button', { name: 'Intră', exact: true }).click();
    await expect(page).toHaveURL(/\/partide\/intra\/ABC123$/);
    await expect(confirmStep(page)).toContainText('Intri în partida cu codul ABC123?');
    // Back from sign-in nothing was joined: the join waits for the press.
    expect(joins).toEqual([]);
  });
});

/* ------------------------------------------------------------------------------------------------
 * Signed in — c2…c5
 * ---------------------------------------------------------------------------------------------- */

test.describe('signed in', () => {
  test.beforeEach(async ({ context }) => {
    await signIn(context, jwt);
  });

  test('partide.intra-cod.c2 — the confirmation: question with the code, fish\'s consequence line, «Alătură-te» / «Nu acum»; nothing joins on open; noindex; axe; 4 widths', async ({ page }) => {
    const { joins } = await mockCms(page);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/partide/intra/ABC123');
    await expect(page.getByRole('heading', { level: 1, name: 'Alătură-te unei partide' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2 })).toHaveText('Intri în partida cu codul ABC123?');
    await expect(confirmStep(page)).toContainText(CONFIRM_COPY);
    await expect(joinButton(page)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Nu acum', exact: true })).toBeVisible();
    await expect(page.locator('meta[name="robots"][content^="noindex"]')).toHaveCount(1);
    await expectNoA11yViolations(page);
    await shots(page, 'confirm');
    expect(joins).toEqual([]);
  });

  test('partide.intra-cod.c3 — joining: spinner + «Te conectăm la partidă…», one request however often it is pressed (code trimmed + uppercased), success replaces the page with the partidă and sets the live pointer', async ({ page, fakeLive }) => {
    await fakeLive.seed({ docs: { [JOINED.firestoreId]: liveDoc() } });
    const { joins } = await mockCms(page, { delayMs: 2_500 });
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/stiri');
    await page.goto('/partide/intra/abc123');
    await expect(page.getByRole('heading', { level: 2 })).toHaveText('Intri în partida cu codul ABC123?');
    // A double activation in one go (the second lands before React re-renders).
    await joinButton(page).evaluate((b: HTMLButtonElement) => {
      b.click();
      b.click();
    });
    const joining = page.getByTestId('partida-join-joining');
    await expect(joining).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: 'Te conectăm la partidă…' })).toBeVisible();
    await expect(joinButton(page)).toHaveCount(0);
    await shots(page, 'joining');
    await expect(page).toHaveURL(new RegExp(`/partide/${JOINED.documentId}$`), { timeout: 20_000 });
    expect(joins).toEqual([{ code: 'ABC123' }]);
    const pointer = await page.evaluate(() => window.localStorage.getItem('@bluvi/partide/activeSessionId'));
    expect(JSON.parse(pointer ?? 'null')).toEqual({ sessionId: JOINED.firestoreId, documentId: JOINED.documentId });
    await expect(page.getByTestId('partida-member-view')).toBeVisible({ timeout: 20_000 });
    // replace: Back skips the join page.
    await page.goBack();
    await expect(page).toHaveURL(/\/stiri$/);
  });

  // [bluCode, status, message, retryable]: a final refusal (invalid / ended / full) offers only
  // «Înapoi» as fish does; «Reîncearcă» only where a second press can change the answer.
  const REFUSALS: [string, number, string, boolean][] = [
    ['PARTIDA:CODE_INVALID', 400, 'Cod invalid', false],
    ['PARTIDA:ENDED', 400, 'Partida s-a încheiat', false],
    ['PARTIDA:FULL', 400, 'Partida este plină', false],
    ['PARTIDA:ALREADY_ACTIVE', 409, 'Ai deja o partidă în desfășurare. Încheie-o înainte să intri în alta.', true],
  ];
  for (const [bluCode, status, message, retryable] of REFUSALS) {
    test(`partide.intra-cod.c4 — ${bluCode}: «${message}» + «${CHECK_COPY}» + «Înapoi»${retryable ? ' + «Reîncearcă»' : ', no «Reîncearcă»'}`, async ({ page }) => {
      await mockCms(page, { answer: route => bluError(route, bluCode, status) });
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto('/partide/intra/ZZZ999');
      await joinButton(page).click();
      const error = errorStep(page);
      await expect(error.getByRole('heading', { name: message })).toBeVisible();
      await expect(error.getByRole('alert')).toContainText(CHECK_COPY);
      await expect(error.getByRole('button', { name: 'Înapoi', exact: true })).toBeVisible();
      await expect(error.getByRole('button', { name: 'Reîncearcă', exact: true })).toHaveCount(retryable ? 1 : 0);
      // The pressed button is gone: focus lands on the outcome.
      await expect(error.getByRole('heading', { name: message })).toBeFocused();
      await expect(page).toHaveURL(/\/partide\/intra\/ZZZ999$/);
      if (bluCode === 'PARTIDA:ALREADY_ACTIVE') {
        await expectNoA11yViolations(page);
        await shots(page, 'error-already-active');
      }
    });
  }

  test('partide.intra-cod.c4 — a network / unknown failure shows the fallback; «Reîncearcă» joins again and lands on the partidă', async ({ page, fakeLive }) => {
    await fakeLive.seed({ docs: { [JOINED.firestoreId]: liveDoc() } });
    const cms = await mockCms(page, {
      answer: async (route, n) => {
        if (n === 1) return json(route, { data: null, error: { status: 500, name: 'InternalServerError', message: 'boom' } }, 500);
        cms.markJoined();
        return json(route, { data: joinedDTO() });
      },
    });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/partide/intra/ABC123');
    await joinButton(page).click();
    await expect(errorStep(page).getByRole('heading', { name: 'Ceva n-a mers. Încearcă din nou.' })).toBeVisible();
    await errorStep(page).getByRole('button', { name: 'Reîncearcă', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/partide/${JOINED.documentId}$`), { timeout: 20_000 });
    expect(cms.joins).toEqual([{ code: 'ABC123' }, { code: 'ABC123' }]);
  });

  test('partide.intra-cod.c2 — a long code (a forged / mistyped link) wraps inside its chip at 375: no sideways scroll, the copy stays on screen', async ({ page }) => {
    const { joins } = await mockCms(page);
    const long = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789ABCDEF';
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`/partide/intra/${long}`);
    await expect(page.getByRole('heading', { level: 2 })).toHaveText(`Intri în partida cu codul ${long}?`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBe(0);
    const copy = await confirmStep(page).getByText(CONFIRM_COPY).boundingBox();
    expect(copy && copy.x >= 0 && copy.x + copy.width <= 375).toBe(true);
    const chip = await page.getByRole('heading', { level: 2 }).locator('span').boundingBox();
    expect(chip && chip.x >= 0 && chip.x + chip.width <= 375).toBe(true);
    await page.screenshot({ path: `${SHOTS}/confirm-long-code-375.png`, fullPage: true });
    expect(joins).toEqual([]);
  });

  test('partide.intra-cod.c3 — leaving while the join is in flight: the join stands but the page does not pull the angler onto the partidă', async ({ page }) => {
    const { joins } = await mockCms(page, { delayMs: 2_000 });
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/stiri');
    await page.goto('/partide/intra/ABC123');
    await joinButton(page).click();
    await expect(page.getByTestId('partida-join-joining')).toBeVisible();
    await page.getByRole('button', { name: 'Înapoi', exact: true }).click();
    await expect(page).toHaveURL(/\/stiri$/);
    await expect.poll(() => joins.length).toBe(1);
    // The answer has landed (2 s) — and the angler is still where they went.
    await page.waitForTimeout(3_000);
    await expect(page).toHaveURL(/\/stiri$/);
  });

  test('partide.intra-cod.c4 — an empty code is «Cod invalid» at once, without a request and without «Reîncearcă»', async ({ page }) => {
    const { joins } = await mockCms(page);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/partide/intra/%20%20');
    const error = errorStep(page);
    await expect(error.getByRole('heading', { name: 'Cod invalid' })).toBeVisible();
    await expect(error).toContainText(CHECK_COPY);
    await expect(error.getByRole('button', { name: 'Înapoi', exact: true })).toBeVisible();
    await expect(error.getByRole('button', { name: 'Reîncearcă' })).toHaveCount(0);
    await expect(joinButton(page)).toHaveCount(0);
    await expectNoA11yViolations(page);
    await shots(page, 'error-empty');
    expect(joins).toEqual([]);
  });

  test('partide.intra-cod.c5 — «Nu acum» and «Înapoi» go back when there is history; opened directly they go to /partide; nothing is joined', async ({ page, context }) => {
    const { joins } = await mockCms(page, { answer: route => bluError(route, 'PARTIDA:CODE_INVALID') });
    await page.setViewportSize({ width: 375, height: 812 });
    // With history: back.
    await page.goto('/stiri');
    await page.goto('/partide/intra/ABC123');
    await page.getByRole('button', { name: 'Nu acum', exact: true }).click();
    await expect(page).toHaveURL(/\/stiri$/);
    // The error's «Înapoi», with history: back.
    await page.goto('/partide/intra/ABC123');
    await joinButton(page).click();
    await errorStep(page).getByRole('button', { name: 'Înapoi', exact: true }).click();
    await expect(page).toHaveURL(/\/stiri$/);
    // Opened directly in a new tab (no history): the Partide tab.
    const fresh = await context.newPage();
    await mockCms(fresh);
    await fresh.setViewportSize({ width: 1440, height: 900 });
    await fresh.goto('/partide/intra/ABC123');
    await fresh.getByRole('button', { name: 'Nu acum', exact: true }).click();
    await expect(fresh).toHaveURL(/\/partide$/);
    // The header's back chip (the confirm step's only «Înapoi»), opened directly: the Partide tab too.
    const direct = await context.newPage();
    await mockCms(direct);
    await direct.goto('/partide/intra/ABC123');
    await direct.getByRole('button', { name: 'Înapoi', exact: true }).click();
    await expect(direct).toHaveURL(/\/partide$/);
    expect(joins).toEqual([{ code: 'ABC123' }]); // the one refused press above, nothing else
  });

  test('partide.b.notif-invite — a PARTIDA_INVITE row on /notificari links /partide/intra/[cod]; without a code it is not a link', async ({ page }) => {
    const rows = [
      { type: NotificationTypes.PARTIDA_INVITE, data: { partidaCode: 'ABC123' }, title: 'Invitație la partidă' },
      { type: NotificationTypes.PARTIDA_INVITE, data: {}, title: 'Invitație fără cod' },
    ];
    await mockCms(page);
    await page.route(/\/api\/cms\/notification-users(\/|\?|$)/, route => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith('/unread')) return json(route, { count: 2 });
      if (route.request().method() === 'POST') return json(route, { message: 'ok' });
      return json(route, {
        data: rows.map((r, i) => ({
          id: 9300 + i,
          documentId: `row-inv-${i}`,
          read: false,
          readAt: null,
          notification: { id: 9400 + i, documentId: `n-inv-${i}`, title: r.title, body: 'Detalii', sentAt: at(5 + i), data: { type: r.type, ...r.data }, type: r.type },
        })),
        meta: { pagination: { page: 1, pageSize: 10, pageCount: 1, total: rows.length } },
      });
    });
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/notificari');
    const list = page.getByRole('list', { name: 'Notificări' });
    const invite = list.getByRole('link', { name: /Invitație la partidă/ });
    await expect(invite).toHaveAttribute('href', '/partide/intra/ABC123');
    await expect(list.getByText('Invitație fără cod')).toBeVisible();
    await expect(list.getByRole('link', { name: /Invitație fără cod/ })).toHaveCount(0);
    await invite.click();
    await expect(page).toHaveURL(/\/partide\/intra\/ABC123$/);
    await expect(confirmStep(page)).toBeVisible();
  });
});
