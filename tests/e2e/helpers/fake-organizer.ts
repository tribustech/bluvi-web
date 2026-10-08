import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test as base, expect, type APIRequestContext, type BrowserContext, type Page, type Route } from '@playwright/test';
import { CMS, qaJwt, signIn } from './session';

/*
 * The shared harness of every M6 organizer spec (docs/parity/areas/organizer.yml).
 *
 * CRITICAL — the LOCAL CMS runs with a real Firebase service account and real e-mail: an organizer
 * WRITE (delete a draft, cancel / start / end a competition, start / end a weighing, add a catch, a
 * penalty, an allocation, a registration decision) sends pushes and e-mails to REAL people. So:
 *  - `guardCmsWrites(page)` (installed automatically by `test` from this module) aborts EVERY
 *    non-GET request to /api/cms/** and to the CMS itself that the spec did not route-mock first,
 *    and the test FAILS at teardown if one was attempted. Reads (GET) go to the local CMS.
 *  - `organizer.mockWrite(method, path, respond)` is the only way a write reaches a handler: it
 *    records `{ method, path, query, body }` (assert them) and answers with your fixture.
 *  Register mocks AFTER the guard (the fixture does it first): Playwright runs the newest route first.
 *
 * Roles: the QA account (tests/qa-user.ts) is an Organizer on the local CMS — `qaRole()` checks it
 * (the server reads the role with the session cookie, which no browser route can mock). When it is
 * not, `requireOrganizerQa()` skips with the reason; `mockViewerRole(page, 'Organizer')` only
 * changes what the BROWSER's /users/me reads answer (client-side role checks).
 * A signed-in viewer WITHOUT the role (organizer.b.role-gate): `anglerJwt()` — a dedicated local
 * test user (e2e-angler@bluvi.test, role Authenticated), created on first use with the LOCAL
 * full-access API token (E2E_CMS_ADMIN_TOKEN, git-ignored .env.local) and a random password that is
 * never stored: the JWT is cached on disk for an hour, then the password is rotated and it signs in
 * again. Creating a user sends nothing (no confirmation mail: the admin route).
 *
 * Fixtures below are shaped from the real local CMS DTOs (GET /competitions/organizer/dashboard,
 * /my-competitions, /stat-details, 2026-10-08).
 */

export type RecordedWrite = { method: string; path: string; query: string; body: unknown };

export type OrganizerHarness = {
  /** Non-GET requests the guard blocked (the test fails at teardown when this is not empty). */
  blocked: RecordedWrite[];
  /** Writes that reached a mock, in order. */
  writes: RecordedWrite[];
  /**
   * Route-mock one write: `path` is the CMS path after /api/cms (a string = exact path, or a RegExp
   * on it). `respond` answers it (status, json, an optional delay).
   */
  mockWrite: (
    method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    path: string | RegExp,
    respond: { status?: number; json?: unknown; delayMs?: number } | ((w: RecordedWrite) => { status?: number; json?: unknown; delayMs?: number }),
  ) => Promise<void>;
};

const PROXY = '/api/cms';

function parseBody(raw: string | null): unknown {
  if (raw == null || raw === '') return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function recordOf(route: Route): RecordedWrite {
  const req = route.request();
  const url = new URL(req.url());
  const path = url.pathname.startsWith(PROXY) ? url.pathname.slice(PROXY.length) : url.pathname;
  return { method: req.method(), path, query: url.search, body: parseBody(req.postData()) };
}

/** Installs the write guard on `page` (see above). Prefer `test` from this module, which does it for you. */
export async function guardCmsWrites(page: Page): Promise<OrganizerHarness> {
  const blocked: RecordedWrite[] = [];
  const writes: RecordedWrite[] = [];
  const block = async (route: Route) => {
    if (route.request().method() === 'GET' || route.request().method() === 'HEAD' || route.request().method() === 'OPTIONS') return route.fallback();
    blocked.push(recordOf(route));
    return route.abort('blockedbyclient');
  };
  await page.route(`**${PROXY}/**`, block);
  // The browser never writes to the CMS directly, but if anything ever did, it is stopped too.
  await page.route(`${CMS.replace(/\/api$/, '')}/**`, block);

  const mockWrite: OrganizerHarness['mockWrite'] = async (method, path, respond) => {
    await page.route(`**${PROXY}/**`, async (route) => {
      const w = recordOf(route);
      const hit = w.method === method && (typeof path === 'string' ? w.path === path : path.test(w.path));
      if (!hit) return route.fallback();
      writes.push(w);
      const r = typeof respond === 'function' ? respond(w) : respond;
      if (r.delayMs) await new Promise((res) => setTimeout(res, r.delayMs));
      return route.fulfill({ status: r.status ?? 200, contentType: 'application/json', body: JSON.stringify(r.json ?? {}) });
    });
  };
  return { blocked, writes, mockWrite };
}

/** `test` with the guard as an auto fixture: every spec of the M6 area imports this one. */
export const test = base.extend<{ organizer: OrganizerHarness }>({
  organizer: [
    async ({ page }, use) => {
      const harness = await guardCmsWrites(page);
      await use(harness);
      expect(harness.blocked, `un-mocked CMS writes were attempted (a real organizer write sends pushes / e-mails):\n${JSON.stringify(harness.blocked, null, 2)}`).toEqual([]);
    },
    { auto: true },
  ],
});
export { expect };

/* ------------------------------------------------------------------ */
/* Sessions and roles                                                  */
/* ------------------------------------------------------------------ */

/** The QA account's users-permissions role on the local CMS («Organizer», «Authenticated», …). */
export async function qaRole(request: APIRequestContext): Promise<string | null> {
  const jwt = await qaJwt(request);
  const res = await request.get(`${CMS}/users/me?populate[role][fields][0]=name`, { headers: { Authorization: `Bearer ${jwt}` } });
  if (!res.ok()) return null;
  return ((await res.json()) as { role?: { name?: string } }).role?.name ?? null;
}

/** Signs the QA Organizer in; skips the test (with the reason) when the account lost the role. */
export async function signInOrganizer(context: BrowserContext, request: APIRequestContext): Promise<string> {
  const role = await qaRole(request);
  test.skip(role !== 'Organizer', `the QA account's role is «${role}», not Organizer — the server gate reads it from the CMS (cannot be route-mocked)`);
  const jwt = await qaJwt(request);
  await signIn(context, jwt);
  return jwt;
}

/** Client-side only: the browser's /users/me reads answer with `role` (the server gate is unaffected). */
export async function mockViewerRole(page: Page, role: 'Organizer' | 'Authenticated') {
  await page.route(/\/api\/cms\/users\/me(\?|$)/, async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    const res = await route.fetch();
    const json = (await res.json()) as Record<string, unknown>;
    return route.fulfill({ response: res, json: { ...json, role: { id: role === 'Organizer' ? 3 : 1, name: role } } });
  });
}

const ANGLER_EMAIL = 'e2e-angler@bluvi.test';
const ANGLER_CACHE = join(process.cwd(), 'node_modules/.cache/bluvi-e2e/angler-jwt.json');
const TTL_MS = 60 * 60 * 1000;

/**
 * A JWT of a signed-in viewer who is NOT an organizer (role Authenticated), for the role gates.
 * Null (the caller skips) when E2E_CMS_ADMIN_TOKEN is not set.
 */
export async function anglerJwt(request: APIRequestContext): Promise<string | null> {
  try {
    const cached = JSON.parse(readFileSync(ANGLER_CACHE, 'utf8')) as { jwt: string; at: number; cms: string };
    if (cached.cms === CMS && Date.now() - cached.at < TTL_MS && cached.jwt) return cached.jwt;
  } catch {
    // No cache yet.
  }
  const token = process.env.E2E_CMS_ADMIN_TOKEN;
  if (!token) return null;
  const admin = { Authorization: `Bearer ${token}` };
  const password = `E2e-${randomBytes(12).toString('base64url')}`;
  const found = await request.get(`${CMS}/users?filters[email][$eq]=${encodeURIComponent(ANGLER_EMAIL)}&populate[role][fields][0]=name`, { headers: admin });
  if (!found.ok()) throw new Error(`users lookup failed: HTTP ${found.status()} ${await found.text()}`);
  const users = (await found.json()) as { id: number; role?: { name?: string } }[];
  if (users.length === 0) {
    const created = await request.post(`${CMS}/users`, {
      headers: admin,
      data: { username: 'E2E Pescar', email: ANGLER_EMAIL, password, confirmed: true, blocked: false, role: 1 },
    });
    if (!created.ok()) throw new Error(`creating ${ANGLER_EMAIL} failed: HTTP ${created.status()} ${await created.text()}`);
  } else {
    if (users[0].role?.name === 'Organizer') throw new Error(`${ANGLER_EMAIL} has the Organizer role — it must stay a plain angler`);
    const updated = await request.put(`${CMS}/users/${users[0].id}`, { headers: admin, data: { password } });
    if (!updated.ok()) throw new Error(`rotating ${ANGLER_EMAIL}'s password failed: HTTP ${updated.status()} ${await updated.text()}`);
  }
  const auth = await request.post(`${CMS}/auth/local`, { data: { identifier: ANGLER_EMAIL, password } });
  if (!auth.ok()) throw new Error(`${ANGLER_EMAIL} sign-in failed: HTTP ${auth.status()} ${await auth.text()}`);
  const jwt = (await auth.json()).jwt as string;
  mkdirSync(dirname(ANGLER_CACHE), { recursive: true });
  writeFileSync(ANGLER_CACHE, JSON.stringify({ jwt, at: Date.now(), cms: CMS }));
  return jwt;
}

/* ------------------------------------------------------------------ */
/* Read mocks + fixtures (real DTO shapes)                             */
/* ------------------------------------------------------------------ */

type Json = Record<string, unknown>;

/**
 * Route-mock one GET (`path` after /api/cms, exact or RegExp on path; `query` must be contained in
 * the request's query when given). `respond` may be a function of the URL (pagination).
 */
export async function mockRead(
  page: Page,
  path: string | RegExp,
  respond: { status?: number; json?: unknown; delayMs?: number } | ((url: URL) => { status?: number; json?: unknown; delayMs?: number }),
) {
  await page.route(`**${PROXY}/**`, async (route) => {
    const req = route.request();
    if (req.method() !== 'GET') return route.fallback();
    const url = new URL(req.url());
    const p = url.pathname.slice(PROXY.length);
    if (!(typeof path === 'string' ? p === path : path.test(p))) return route.fallback();
    const r = typeof respond === 'function' ? respond(url) : respond;
    if (r.delayMs) await new Promise((res) => setTimeout(res, r.delayMs));
    return route.fulfill({ status: r.status ?? 200, contentType: 'application/json', body: JSON.stringify(r.json ?? {}) });
  });
}

export const paginated = <T>(data: T[], { page = 1, pageSize = 10, total = data.length }: { page?: number; pageSize?: number; total?: number } = {}) => ({
  data,
  meta: { pagination: { page, pageSize, total, pageCount: Math.max(1, Math.ceil(total / pageSize)) } },
});

export function dashboardFixture(over: Json = {}) {
  return {
    data: {
      totalOrganized: 12,
      pendingRegistrations: 0,
      activeCompetitions: 2,
      emptySpots: 4,
      fillRate: 87,
      draftsCount: 0,
      byStatus: { completed: 10, notStarted: 2 },
      ...over,
    },
  };
}

/** A real S3 image (the local Chita Lake photo) with its formats. */
export const S3_IMAGE = {
  id: 50,
  documentId: 'fdgbkmjcbskmjbygatuubxf0',
  url: 'https://fir-intins-strapi.s3.eu-central-1.amazonaws.com/Pexels_Photo_247600_1b3160e366.jpeg',
  formats: {
    small: { url: 'https://fir-intins-strapi.s3.eu-central-1.amazonaws.com/small_Pexels_Photo_247600_1b3160e366.jpeg', width: 500, height: 315 },
    thumbnail: { url: 'https://fir-intins-strapi.s3.eu-central-1.amazonaws.com/thumbnail_Pexels_Photo_247600_1b3160e366.jpeg', width: 245, height: 155 },
  },
  blurhash: 'LxBXsMtSVqjYyGo#s+oMR;Rjxuog',
};

const LAKE = { id: 212, documentId: 's84u55lo4n9z0emngozttt6e', name: 'Chita Lake', images: [S3_IMAGE] };

const registration = (i: number, status: 'registered' | 'pending' | 'rejected') => ({
  id: 9000 + i,
  documentId: `reg${i}`,
  registrationStatus: status,
  teamName: null,
  guestName: `Pescar ${i}`,
  participants: [],
});

/** A `/competitions/organizer/my-competitions` row (DraftCompetition). */
export function competitionFixture(over: Json & { documentId: string; competitionStatus: string }) {
  const start = new Date(Date.now() + 3 * 86_400_000);
  start.setUTCHours(5, 0, 0, 0);
  const end = new Date(start.getTime() + 30 * 3_600_000);
  return {
    id: Math.floor(Math.random() * 100_000),
    name: `Cupa ${over.documentId}`,
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    registrationDeadline: start.toISOString(),
    competitionType: 'single',
    rankingType: 'quantity',
    registerFee: null,
    participantsLimit: 20,
    teamParticipants: null,
    bestOfFishCount: null,
    bestOfTierSizes: null,
    draftMeta: null,
    lake: LAKE,
    banner: null,
    registrations: [registration(1, 'registered'), registration(2, 'registered'), registration(3, 'pending')],
    viewers: 7,
    createdAt: '2026-10-03T21:01:54.261Z',
    ...over,
  };
}

/** A draft row: `completedSteps` drives «Pas N/5». */
export function draftFixture(over: Json & { documentId: string }, completedSteps: number[] = [1, 2]) {
  return competitionFixture({
    competitionStatus: 'draft',
    registrations: [],
    draftMeta: { sectors: [], standAllocations: {}, sponsorIds: [], fishSpeciesIds: [], completedSteps },
    ...over,
  });
}

/** A `/competitions/organizer/stat-details` row. */
export function statDetailFixture(i: number, over: Json = {}) {
  return {
    documentId: `sd${i}`,
    competition: {
      documentId: `sd${i}`,
      name: `Concurs statistic ${i}`,
      startDate: '2026-10-10T06:00:00.000Z',
      endDate: '2026-10-11T14:00:00.000Z',
      participantsLimit: 20,
      participantsRegistered: 12,
      competitionStatus: 'notStarted',
    },
    pendingRegistrationsCount: 2,
    emptySpotsCount: 8,
    fillRate: 60,
    ...over,
  };
}
