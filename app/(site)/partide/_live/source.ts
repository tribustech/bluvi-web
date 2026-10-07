'use client';

import type * as partide from './partideCore';

/*
 * Where the live partidă comes from: Firestore (the CMS-rebuilt projection, `(default)` database,
 * core/realtime/partide subscribeSession), or — in development and tests only — an in-memory fake.
 *
 * The web only READS Firestore here. Every write goes through the CMS /feed/sessions/* (the
 * PartideControlPlane in ./controlPlane.ts); fish writes only the `markers` subcollection to
 * Firestore, which is the Jurnal batch's concern, not this layer's.
 *
 * E2E SEAM (hard rule: no test may touch the shared Firebase project). tests/e2e/helpers/fake-live.ts
 * sets `window.__BLUVI_FAKE_LIVE__` before the page loads; when NODE_ENV !== 'production' this module
 * then serves the subscription from that object (the docs it carries, pushed snapshots, injected
 * listener errors) and never loads the Firebase SDK — modelled on core/realtime/__tests__/fakeFirestore.ts.
 * A production build ignores the global entirely.
 */

type Assembled = partide.AssembledSession;
type Meta = partide.SnapshotMeta;

/** One projection document, the shape `sessions/{id}` has in Firestore (meta flat + catches + markers). */
export type FakeLiveDoc = partide.FirestoreSessionMeta & {
  catches?: partide.FirestoreCatchDoc[];
  markers?: partide.FirestoreMarkerDoc[];
};

export type FakeLive = {
  /** The projection per session id (clientId === firestoreId). Absent → the doc does not exist (no snapshot). */
  docs: Record<string, FakeLiveDoc | undefined>;
  /** Session ids whose listener fails at once with this Firestore error code (e.g. `permission-denied`). */
  errors?: Record<string, string | undefined>;
  /** The first snapshot is from the offline cache (`fromCache: true`). */
  fromCache?: boolean;
  /** Every tab of the member view, shipped or not (the frame's tests; never in production). */
  allTabs?: boolean;
  /** Written by the provider: the session ids subscribed so far, in order. */
  subscribed?: string[];
  /** Installed by the provider: push a new projection to the listeners of `sessionId`. */
  push?: (sessionId: string, doc: FakeLiveDoc, fromCache?: boolean) => void;
  /** Installed by the provider: fail the listeners of `sessionId` with `code`. */
  fail?: (sessionId: string, code?: string) => void;
};

declare global {
  interface Window {
    __BLUVI_FAKE_LIVE__?: FakeLive;
  }
}

export type LiveSource = {
  kind: 'firestore' | 'fake';
  /**
   * Follow one session. `serverNow` derives the rod phases at read time (core sessionRepo). Resolves
   * the unsubscribe; for Firestore, after making sure Firebase is signed in as `uid`.
   */
  subscribe(
    sessionId: string,
    uid: string,
    onData: (assembled: Assembled, meta: Meta) => void,
    onError: (err: Error) => void,
    serverNow: () => number,
  ): Promise<() => void>;
};

/** The fake, when this is not a production build and a test installed it. */
export function fakeLive(): FakeLive | null {
  if (process.env.NODE_ENV === 'production' || typeof window === 'undefined') return null;
  return window.__BLUVI_FAKE_LIVE__ ?? null;
}

function fakeSource(fake: FakeLive): LiveSource {
  const listeners = new Map<string, Set<{ onData: (a: Assembled, m: Meta) => void; onError: (e: Error) => void; serverNow: () => number }>>();
  const deliver = async (sessionId: string, doc: FakeLiveDoc, fromCache: boolean) => {
    const { firestoreSessionToLocal } = await import('@/core/realtime/partide/mappers');
    for (const l of listeners.get(sessionId) ?? []) {
      l.onData(firestoreSessionToLocal(sessionId, doc, doc.catches ?? [], doc.markers ?? [], l.serverNow()), { fromCache });
    }
  };
  fake.push = (sessionId, doc, fromCache = false) => {
    fake.docs[sessionId] = doc;
    void deliver(sessionId, doc, fromCache);
  };
  fake.fail = (sessionId, code = 'permission-denied') => {
    for (const l of listeners.get(sessionId) ?? []) l.onError(Object.assign(new Error(code), { code }));
  };
  return {
    kind: 'fake',
    async subscribe(sessionId, _uid, onData, onError, serverNow) {
      (fake.subscribed ??= []).push(sessionId);
      const entry = { onData, onError, serverNow };
      const set = listeners.get(sessionId) ?? new Set();
      set.add(entry);
      listeners.set(sessionId, set);
      const code = fake.errors?.[sessionId];
      if (code) {
        // Like onSnapshot: the error arrives asynchronously, after the subscription returned.
        setTimeout(() => onError(Object.assign(new Error(code), { code })), 0);
      } else {
        const doc = fake.docs[sessionId];
        if (doc) setTimeout(() => void deliver(sessionId, doc, fake.fromCache ?? false), 0);
      }
      return () => {
        set.delete(entry);
      };
    },
  };
}

const firestoreSource: LiveSource = {
  kind: 'firestore',
  async subscribe(sessionId, uid, onData, onError, serverNow) {
    // Loaded on the first live need only: pages without a live partidă never load Firebase.
    const [{ getRealtimeContext, getCustomToken }, { ensureSignedIn, partide }] = await Promise.all([
      import('@/lib/client/firebase'),
      import('@/core/realtime'),
    ]);
    const ctx = getRealtimeContext();
    // Firestore rules key on the Firebase uid (= the Strapi documentId). A failed sign-in is not
    // fatal: the listener then fails with permission-denied, which the provider confirms over REST.
    await ensureSignedIn(ctx, uid, getCustomToken).catch(() => false);
    return partide.subscribeSession(ctx, sessionId, onData, onError, serverNow);
  },
};

let cached: LiveSource | null = null;

/** The source for this tab: the e2e fake when installed (never in production), else Firestore. */
export function liveSource(): LiveSource {
  const fake = fakeLive();
  if (fake) return (cached = cached?.kind === 'fake' ? cached : fakeSource(fake));
  return firestoreSource;
}
