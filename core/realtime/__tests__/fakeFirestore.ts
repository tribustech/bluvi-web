/**
 * Test-only stand-in for the `firebase/firestore` modular API. Refs are plain `{ path }` tokens,
 * writes/reads are `vi.fn`s the test drives, and `onSnapshot` records its callbacks so a test can
 * push snapshots. `Timestamp` stays the real class (pure, no app needed). Nothing here can reach
 * a real Firebase project: there is no app, no network, no credentials.
 *
 * Usage in a test file:
 *   vi.mock('firebase/firestore', async orig => (await import('../__tests__/fakeFirestore')).fakeFirestoreModule(await orig()));
 *   import { fs, querySnap, docSnap } from '../__tests__/fakeFirestore';
 */
import { vi } from 'vitest';

export type FakeRef = { kind: 'doc' | 'collection' | 'query'; path: string; db?: unknown; id?: string; constraints?: unknown[] };
export type Listener = {
  ref: FakeRef;
  options?: { includeMetadataChanges?: boolean };
  next: (snap: unknown) => void;
  error?: (err: unknown) => void;
  unsub: ReturnType<typeof vi.fn>;
};

let autoId = 0;

export const fs = {
  listeners: [] as Listener[],
  setDoc: vi.fn<(ref: FakeRef, data: unknown, options?: unknown) => Promise<undefined>>(),
  updateDoc: vi.fn<(ref: FakeRef, data: unknown) => Promise<undefined>>(),
  deleteDoc: vi.fn<(ref: FakeRef) => Promise<undefined>>(),
  getDoc: vi.fn<(ref: FakeRef) => Promise<unknown>>(),
  getDocs: vi.fn<(ref: FakeRef) => Promise<unknown>>(),
  getDocsFromCache: vi.fn<(ref: FakeRef) => Promise<unknown>>(),
  getCountFromServer: vi.fn<(ref: FakeRef) => Promise<unknown>>(),
  /** Restores the default answers; call in `beforeEach`. */
  reset() {
    this.listeners.length = 0;
    autoId = 0;
    for (const fn of [this.setDoc, this.updateDoc, this.deleteDoc, this.getDoc, this.getDocs, this.getDocsFromCache, this.getCountFromServer]) {
      fn.mockReset();
    }
    this.setDoc.mockResolvedValue(undefined);
    this.updateDoc.mockResolvedValue(undefined);
    this.deleteDoc.mockResolvedValue(undefined);
    this.getDoc.mockResolvedValue(docSnap(undefined));
    this.getDocs.mockResolvedValue(querySnap([]));
    this.getDocsFromCache.mockResolvedValue(querySnap([]));
    this.getCountFromServer.mockResolvedValue({ data: () => ({ count: 0 }) });
  },
  /** Listeners attached to exactly this path (collection, query or doc). */
  on(path: string) {
    return this.listeners.filter(listener => listener.ref.path === path);
  },
};

const join = (segments: string[]) => segments.join('/');

export function fakeFirestoreModule(actual: Record<string, unknown>) {
  return {
    Timestamp: actual.Timestamp,
    doc: (parent: FakeRef | object, ...segments: string[]) => {
      const ref = parent as FakeRef;
      if (ref.kind === 'collection' && segments.length === 0) {
        const id = `auto-${++autoId}`;
        return { kind: 'doc', path: `${ref.path}/${id}`, db: ref.db, id } satisfies FakeRef;
      }
      const base = ref.kind ? [ref.path] : [];
      const path = join([...base, ...segments]);
      return { kind: 'doc', path, db: ref.kind ? ref.db : parent, id: path.split('/').pop() } satisfies FakeRef;
    },
    collection: (db: unknown, ...segments: string[]) => ({ kind: 'collection', path: join(segments), db }) satisfies FakeRef,
    query: (ref: FakeRef, ...constraints: unknown[]) => ({ kind: 'query', path: ref.path, db: ref.db, constraints }) satisfies FakeRef,
    orderBy: (field: string, direction?: string) => ({ type: 'orderBy', field, direction }),
    limit: (n: number) => ({ type: 'limit', n }),
    startAfter: (cursor: unknown) => ({ type: 'startAfter', cursor }),
    where: (field: string, op: string, value: unknown) => ({ type: 'where', field, op, value }),
    serverTimestamp: () => 'SERVER_TS',
    onSnapshot: (ref: FakeRef, a: unknown, b?: unknown, c?: unknown) => {
      const unsub = vi.fn();
      const withOptions = typeof a !== 'function';
      fs.listeners.push({
        ref,
        options: withOptions ? (a as Listener['options']) : undefined,
        next: (withOptions ? b : a) as Listener['next'],
        error: (withOptions ? c : b) as Listener['error'],
        unsub,
      });
      return unsub;
    },
    setDoc: (...args: Parameters<typeof fs.setDoc>) => fs.setDoc(...args),
    updateDoc: (...args: Parameters<typeof fs.updateDoc>) => fs.updateDoc(...args),
    deleteDoc: (...args: Parameters<typeof fs.deleteDoc>) => fs.deleteDoc(...args),
    getDoc: (...args: Parameters<typeof fs.getDoc>) => fs.getDoc(...args),
    getDocs: (...args: Parameters<typeof fs.getDocs>) => fs.getDocs(...args),
    getDocsFromCache: (...args: Parameters<typeof fs.getDocsFromCache>) => fs.getDocsFromCache(...args),
    getCountFromServer: (...args: Parameters<typeof fs.getCountFromServer>) => fs.getCountFromServer(...args),
  };
}

/** A query snapshot: `docs` as `[id, data]` pairs. */
export function querySnap(docs: [string, Record<string, unknown>][], fromCache = false) {
  return {
    docs: docs.map(([id, data]) => ({ id, data: () => data })),
    metadata: { fromCache, hasPendingWrites: false },
  };
}

/** A single-document snapshot; `undefined` data = the doc does not exist. */
export function docSnap(data: Record<string, unknown> | undefined, fromCache = false) {
  return { exists: () => data !== undefined, data: () => data, metadata: { fromCache, hasPendingWrites: false } };
}
