'use client';

import type { chat } from '@/core/realtime';
import { OUTBOX_STORAGE_KEY } from '@/core/realtime/chat/outbox/storage';

/*
 * Where the chat outbox lives between page loads (participant.b.chat-outbox, global.b.chat-outbox;
 * fish: SQLite + copied files). IndexedDB first: it survives reloads and stores the photo Blobs a
 * queued message carries (OutboxAttachmentRow.file). Without it (private mode in some browsers,
 * blocked storage) localStorage, which can only hold the JSON — a reload then keeps the text rows
 * and drops their photos' bytes (the worker fails such a row with the upload error, Reîncearcă /
 * Șterge). Last resort: memory for this page only.
 */

const DB_NAME = 'bluvi-chat';
const STORE = 'kv';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbStorage(dbPromise: Promise<IDBDatabase>): chat.OutboxStorage {
  const run = <T>(mode: IDBTransactionMode, op: (store: IDBObjectStore) => IDBRequest<T>) =>
    dbPromise.then(
      db =>
        new Promise<T>((resolve, reject) => {
          const tx = db.transaction(STORE, mode);
          const req = op(tx.objectStore(STORE));
          tx.oncomplete = () => resolve(req.result);
          tx.onerror = () => reject(tx.error);
          tx.onabort = () => reject(tx.error);
        }),
    );
  return {
    get: key => run('readonly', s => s.get(key)),
    set: async (key, value) => void (await run('readwrite', s => s.put(value, key))),
    remove: async key => void (await run('readwrite', s => s.delete(key))),
  };
}

/** JSON in localStorage: drops the Blobs (`file`), keeps everything else. */
function localStorageStorage(): chat.OutboxStorage {
  return {
    async get(key) {
      const raw = window.localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as unknown) : undefined;
    },
    async set(key, value) {
      window.localStorage.setItem(key, JSON.stringify(value, (k, v) => (k === 'file' ? undefined : v)));
    },
    async remove(key) {
      window.localStorage.removeItem(key);
    },
  };
}

function memoryStorage(): chat.OutboxStorage {
  const data = new Map<string, unknown>();
  return { get: async k => data.get(k), set: async (k, v) => void data.set(k, v), remove: async k => void data.delete(k) };
}

let storage: chat.OutboxStorage | null = null;

/**
 * One storage per page. Each call goes to IndexedDB; if IndexedDB fails (or never opens) the
 * storage falls back for good, so the worker never sees an error from the store itself.
 */
export function outboxStorage(): chat.OutboxStorage {
  if (storage) return storage;
  let primary: chat.OutboxStorage | null = null;
  try {
    if (typeof indexedDB !== 'undefined') primary = idbStorage(openDb());
  } catch {
    primary = null;
  }
  let fallback: chat.OutboxStorage | null = null;
  const fallbackStore = () => {
    if (fallback) return fallback;
    try {
      window.localStorage.setItem('bluvi:probe', '1');
      window.localStorage.removeItem('bluvi:probe');
      fallback = localStorageStorage();
    } catch {
      fallback = memoryStorage();
    }
    return fallback;
  };
  const via = <T>(op: (s: chat.OutboxStorage) => Promise<T>): Promise<T> => {
    if (!primary) return op(fallbackStore());
    return op(primary).catch(() => {
      primary = null;
      return op(fallbackStore());
    });
  };
  storage = {
    get: key => via(s => s.get(key)),
    set: (key, value) => via(s => s.set(key, value)),
    remove: key => via(s => s.remove(key)),
  };
  return storage;
}

/**
 * Sign-out (fish AuthContext → discardAllOutbox): every queued / failed send on this browser is
 * the account's that is signing out — drop the rows (IndexedDB and the localStorage fallback) so
 * nothing carries over to whoever signs in next. Never throws; the open connection, if any, is
 * reused (deleting the database would block on it).
 */
export async function clearChatOutbox(): Promise<void> {
  try {
    await outboxStorage().remove(OUTBOX_STORAGE_KEY);
  } catch {
    // Storage unreadable: nothing persisted either.
  }
  try {
    window.localStorage.removeItem(OUTBOX_STORAGE_KEY);
  } catch {
    // Blocked storage.
  }
}
