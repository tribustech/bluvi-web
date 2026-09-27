/**
 * fish `features/chat/outbox/db.ts` (expo-sqlite) re-expressed over an injected key-value store.
 *
 * Chat outbox (spec §4): every send is a row here until its Firestore doc is written. Survives
 * leaving/reloading the page when the injected storage is persistent (web: IndexedDB, which can
 * also hold the attachment Blobs); the worker (worker.ts) drains it.
 */
import type { KeyValueStorage } from '../../storage';
import type { OutboxAttachmentRow, OutboxEntry, OutboxMessageRow } from './types';

/** Async key-value persistence the app provides (IndexedDB on the web, so attachment Blobs fit). */
export type OutboxStorage = KeyValueStorage;

/** fish `OUTBOX_DB_FILENAME` (`chat-outbox.v1.sqlite3`) → one storage key. */
export const OUTBOX_STORAGE_KEY = 'chat-outbox.v1';

export type OutboxMessagePatch = Partial<Pick<OutboxMessageRow, 'status' | 'attempts' | 'lastError' | 'nextAttemptAt'>>;

export interface OutboxRepo {
  insert(entry: OutboxEntry): Promise<void>;
  /** fish `listOutboxEntries`: one room's rows, oldest first. */
  listRoom(competitionId: string, roomId: string): Promise<OutboxEntry[]>;
  /** fish `listAllOutboxEntries`: every row, oldest first. */
  listAll(): Promise<OutboxEntry[]>;
  get(id: string): Promise<OutboxEntry | null>;
  updateMessage(id: string, patch: OutboxMessagePatch): Promise<void>;
  setAttachmentUploaded(attachmentId: string, uploadedJson: string): Promise<void>;
  delete(id: string): Promise<void>;
  /** Sign-out wipes the whole outbox: every row belongs to the account that just signed out, and
   * nothing here should carry over to whoever signs in next on this device. */
  clear(): Promise<void>;
}

const byCreatedAt = (a: OutboxEntry, b: OutboxEntry) => a.message.createdAt - b.message.createdAt;
const byPosition = (a: OutboxAttachmentRow, b: OutboxAttachmentRow) => a.position - b.position;

/** Copies so callers never mutate what is stored (SQLite rows were copies too). */
const clone = (entry: OutboxEntry): OutboxEntry => ({
  message: { ...entry.message },
  attachments: entry.attachments.map(attachment => ({ ...attachment })).sort(byPosition),
});

/**
 * Every write is read-modify-write of one value, serialized through a promise chain so two
 * overlapping updates (worker status + a user retry) cannot lose each other — the job SQLite's
 * transactions did in fish.
 */
export function createOutboxRepo(storage: OutboxStorage, key: string = OUTBOX_STORAGE_KEY): OutboxRepo {
  let chain: Promise<unknown> = Promise.resolve();

  const read = async (): Promise<OutboxEntry[]> => {
    const value = await storage.get(key);
    return Array.isArray(value) ? (value as OutboxEntry[]) : [];
  };

  const serial = <T>(op: () => Promise<T>): Promise<T> => {
    const run = chain.then(op, op);
    chain = run.catch(() => undefined);
    return run;
  };

  const mutate = (fn: (entries: OutboxEntry[]) => OutboxEntry[]) =>
    serial(async () => {
      const next = fn((await read()).map(clone));
      if (next.length) await storage.set(key, next);
      else await storage.remove(key);
    });

  return {
    insert: entry => mutate(entries => [...entries.filter(e => e.message.id !== entry.message.id), clone(entry)]),
    listRoom: (competitionId, roomId) =>
      serial(async () =>
        (await read())
          .filter(e => e.message.competitionId === competitionId && e.message.roomId === roomId)
          .sort(byCreatedAt)
          .map(clone)
      ),
    listAll: () => serial(async () => (await read()).sort(byCreatedAt).map(clone)),
    get: id =>
      serial(async () => {
        const entry = (await read()).find(e => e.message.id === id);
        return entry ? clone(entry) : null;
      }),
    updateMessage: (id, patch) => {
      if (Object.keys(patch).length === 0) return Promise.resolve();
      return mutate(entries =>
        entries.map(e => (e.message.id === id ? { ...e, message: { ...e.message, ...patch } } : e))
      );
    },
    setAttachmentUploaded: (attachmentId, uploadedJson) =>
      mutate(entries =>
        entries.map(e => ({
          ...e,
          attachments: e.attachments.map(a => (a.id === attachmentId ? { ...a, uploaded: uploadedJson } : a)),
        }))
      ),
    delete: id => mutate(entries => entries.filter(e => e.message.id !== id)),
    clear: () => serial(() => storage.remove(key)),
  };
}

/** In-memory storage: tests, and a fallback when no persistent store is available. */
export function createMemoryOutboxStorage(): OutboxStorage & { data: Map<string, unknown> } {
  const data = new Map<string, unknown>();
  return {
    data,
    get: async key => data.get(key),
    set: async (key, value) => void data.set(key, value),
    remove: async key => void data.delete(key),
  };
}
