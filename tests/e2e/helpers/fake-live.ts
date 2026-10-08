import { test as base, expect, type Page } from '@playwright/test';

/*
 * The shared Firestore fake for every partidă spec (M4 hard rule: the Firebase project is ONE for
 * all environments and the Partide sessions are live in production — no test may touch it).
 *
 *  (a) `window.__BLUVI_FAKE_LIVE__` is set before any page script runs (addInitScript). The live
 *      layer (app/(site)/partide/_live/source.ts) honours it only when NODE_ENV !== 'production'
 *      and then serves the subscription from it — never loading the Firebase SDK. Its docs are
 *      projection documents in Firestore's own shape (meta flat + `catches` + `markers`), mapped by
 *      the same core mapper as the real listener.
 *  (b) Every request to Firebase's hosts (Firestore, Auth, installations) and to /api/firebase-token
 *      is aborted and recorded; the fixture FAILS the test if one was attempted.
 *
 * Use it through `test` from this module (an auto fixture), or `installFakeLive(page)` by hand:
 *
 *   import { test, expect } from './helpers/fake-live';
 *   test('…', async ({ page, fakeLive }) => {
 *     await fakeLive.seed({ docs: { 'client-1': liveDoc() }, allTabs: true });
 *     await page.goto('/partide/doc-1');
 *     await fakeLive.push('client-1', { ...liveDoc(), warnedAt: '…' });   // a new snapshot
 *     await fakeLive.fail('client-1');                                    // permission-denied
 *   });
 *
 * CMS writes (finish, leave, kick, rotate, delete, extend, feedback, patch) are the spec's to
 * route-mock — this helper only guarantees the Firestore half.
 */

export type FakeCatchDoc = {
  clientId: string;
  outcome: 'capture' | 'lost' | 'blank';
  occurredAt: string;
  rodIndex?: number | null;
  weightKg?: number | null;
  species?: string | null;
  photoUrl?: string | null;
  photoThumbUrl?: string | null;
  [k: string]: unknown;
};

export type FakeRodDoc = { clientId: string; index: number; label?: string | null; color?: string | null; runtimePhase?: 'idle' | 'fishing' | 'ready' | null; runtimeEndsAt?: string | null; [k: string]: unknown };

/** A projection document (core/realtime/partide/mappers FirestoreSessionMeta + catches + markers). */
export type FakeLiveDoc = {
  startedAt: string;
  endedAt?: string | null;
  status?: 'active' | 'finished' | 'abandoned' | null;
  venueType?: 'lake' | 'publicWater' | 'pin';
  lakeId?: string | null;
  lakeName?: string | null;
  publicWaterCode?: string | null;
  publicWaterName?: string | null;
  manualVenueName?: string | null;
  standName?: string | null;
  locality?: string | null;
  anchorLat?: number | null;
  anchorLong?: number | null;
  anchorName?: string | null;
  warnedAt?: string | null;
  autoCloseAt?: string | null;
  plannedDurationMs?: number | null;
  visibleOnProfile?: boolean | null;
  hostUid?: string | null;
  joinCode?: string | null;
  members?: { uid: string; name: string | null; avatar: string | null; joinedAt: string }[] | null;
  rods?: FakeRodDoc[] | null;
  catches?: FakeCatchDoc[];
  markers?: unknown[];
  rev?: number | null;
  [k: string]: unknown;
};

export type FakeLiveInit = {
  docs?: Record<string, FakeLiveDoc>;
  /** Session ids whose listener fails at once with this code (`permission-denied`). */
  errors?: Record<string, string>;
  fromCache?: boolean;
  /** Render every member-view tab, shipped or not (the frame's own tests). */
  allTabs?: boolean;
};

const FIREBASE_HOSTS = /^https:\/\/([a-z0-9-]+\.)*(firestore\.googleapis\.com|identitytoolkit\.googleapis\.com|securetoken\.googleapis\.com|firebaseinstallations\.googleapis\.com|firebase\.googleapis\.com|firebaselogging-pa\.googleapis\.com)\//;

export type FakeLiveHandle = {
  /** Every Firebase request the page attempted (all aborted). */
  attempts: string[];
  /** Merge docs / errors / flags into the fake before the next navigation (and on every later one). */
  seed(init: FakeLiveInit): Promise<void>;
  /** Push a new projection snapshot to the page's listeners of `sessionId`. */
  push(sessionId: string, doc: FakeLiveDoc, fromCache?: boolean): Promise<void>;
  /** Fail the page's listeners of `sessionId` (default `permission-denied`). */
  fail(sessionId: string, code?: string): Promise<void>;
  /** The session ids the page subscribed to, in order. */
  subscribed(): Promise<string[]>;
  /** Every marker write the page made (the Jurnal map's only Firestore write, recorded by the fake). */
  markerWrites(): Promise<{ op: 'set' | 'delete'; sessionId: string; clientId: string; data?: Record<string, unknown> }[]>;
};

export async function installFakeLive(page: Page): Promise<FakeLiveHandle> {
  const attempts: string[] = [];
  await page.route(FIREBASE_HOSTS, route => {
    attempts.push(route.request().url());
    return route.abort('blockedbyclient');
  });
  await page.route('**/api/firebase-token', route => {
    attempts.push(route.request().url());
    return route.abort('blockedbyclient');
  });
  await page.addInitScript(() => {
    (window as unknown as { __BLUVI_FAKE_LIVE__: unknown }).__BLUVI_FAKE_LIVE__ = { docs: {}, errors: {} };
  });
  return {
    attempts,
    async seed(init) {
      await page.addInitScript(i => {
        const fake = (window as unknown as { __BLUVI_FAKE_LIVE__: { docs: Record<string, unknown>; errors: Record<string, string> } & Record<string, unknown> }).__BLUVI_FAKE_LIVE__;
        Object.assign(fake.docs, i.docs ?? {});
        Object.assign(fake.errors, i.errors ?? {});
        if (i.fromCache !== undefined) fake.fromCache = i.fromCache;
        if (i.allTabs !== undefined) fake.allTabs = i.allTabs;
      }, init);
    },
    async push(sessionId, doc, fromCache = false) {
      await page.waitForFunction(() => typeof (window as unknown as { __BLUVI_FAKE_LIVE__?: { push?: unknown } }).__BLUVI_FAKE_LIVE__?.push === 'function');
      await page.evaluate(
        ([id, d, c]) => (window as unknown as { __BLUVI_FAKE_LIVE__: { push: (a: string, b: unknown, c: boolean) => void } }).__BLUVI_FAKE_LIVE__.push(id, d, c),
        [sessionId, doc, fromCache] as const,
      );
    },
    async fail(sessionId, code = 'permission-denied') {
      await page.waitForFunction(() => typeof (window as unknown as { __BLUVI_FAKE_LIVE__?: { fail?: unknown } }).__BLUVI_FAKE_LIVE__?.fail === 'function');
      await page.evaluate(([id, c]) => (window as unknown as { __BLUVI_FAKE_LIVE__: { fail: (a: string, b: string) => void } }).__BLUVI_FAKE_LIVE__.fail(id, c), [sessionId, code] as const);
    },
    subscribed: () => page.evaluate(() => (window as unknown as { __BLUVI_FAKE_LIVE__?: { subscribed?: string[] } }).__BLUVI_FAKE_LIVE__?.subscribed ?? []),
    markerWrites: () =>
      page.evaluate(
        () =>
          (window as unknown as { __BLUVI_FAKE_LIVE__?: { markerWrites?: { op: 'set' | 'delete'; sessionId: string; clientId: string; data?: Record<string, unknown> }[] } }).__BLUVI_FAKE_LIVE__
            ?.markerWrites ?? [],
      ),
  };
}

/** `test` with the fake installed on every page, failing any test that let a Firebase request out. */
export const test = base.extend<{ fakeLive: FakeLiveHandle }>({
  fakeLive: [
    async ({ page }, use) => {
      const handle = await installFakeLive(page);
      await use(handle);
      expect(handle.attempts, 'no request may reach Firebase (shared project, Partide is live in production)').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
