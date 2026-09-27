import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('firebase/firestore', async orig => (await import('../__tests__/fakeFirestore')).fakeFirestoreModule(await orig()));

import { Timestamp } from 'firebase/firestore';
import type { ChatAuth } from '../firebase';
import { fs, querySnap } from '../__tests__/fakeFirestore';
import {
  appendOlderPage,
  applyCachedMessages,
  applyLatestSnapshot,
  CHAT_PAGE_SIZE,
  createEmptyRoomCache,
  fetchOlderMessagesPage,
  isUnreadBoundaryLoaded,
  loadUnreadBoundary,
  loadUntilMessage,
  mergeDisplayedMessages,
  needsUnreadBoundaryBackfill,
  subscribeChatRoom,
  type ChatCursor,
  type ChatRoomCache,
} from './room';
import type { ChatListMessage, ChatReaction } from './types';

const DEFAULT_DB = { name: '(default)' };
const CHAT_DB = { name: 'staging' };
const ctx = { db: DEFAULT_DB, chatDb: CHAT_DB, auth: { currentUser: { uid: 'me' } } } as never;
const auth: ChatAuth = { ensure: vi.fn(async () => true), withRetry: op => op() };
const args = { competitionId: 'c1', roomId: 'general' as const };
const PATH = 'competitions/c1/chats/general/messages';

const msg = (id: string, ms: number, senderId = 'u2'): ChatListMessage =>
  ({ id, senderId, senderName: senderId, senderAvatar: null, text: id, type: 'text', attachments: [], createdAt: Timestamp.fromMillis(ms) }) as ChatListMessage;
const cursor = (id: string) => ({ id }) as unknown as ChatCursor;
const docsOf = (n: number, fromMs: number): [string, Record<string, unknown>][] =>
  Array.from({ length: n }, (_, i) => [`m${fromMs - i}`, { senderId: 'u2', text: 't', type: 'text', createdAt: Timestamp.fromMillis(fromMs - i) }]);

beforeEach(() => {
  fs.reset();
  vi.clearAllMocks();
});

describe('applyLatestSnapshot — the pagination cursor', () => {
  it('waits for a trusted snapshot: a partial cache snapshot keeps hasMore and no cursor', () => {
    const partial = applyLatestSnapshot(createEmptyRoomCache(), { messages: [msg('a', 2)], lastDoc: cursor('a'), docCount: 1, fromCache: true });
    expect(partial).toMatchObject({ isLoaded: true, lastDoc: null, hasMore: true, cursorConfirmed: false });

    const server = applyLatestSnapshot(partial, { messages: [msg('a', 2), msg('b', 1)], lastDoc: cursor('b'), docCount: 2, fromCache: false });
    expect(server).toMatchObject({ cursorConfirmed: true, hasMore: false });
    expect(server.lastDoc).toEqual(cursor('b'));
  });

  it('takes the cursor ONCE: later snapshots do not move it', () => {
    const first = applyLatestSnapshot(createEmptyRoomCache(), { messages: [msg('b', 1)], lastDoc: cursor('b'), docCount: CHAT_PAGE_SIZE, fromCache: true });
    expect(first.lastDoc).toEqual(cursor('b'));
    expect(first.hasMore).toBe(true);
    const later = applyLatestSnapshot(first, { messages: [msg('c', 3), msg('b', 1)], lastDoc: cursor('x'), docCount: 2, fromCache: false });
    expect(later.lastDoc).toEqual(cursor('b'));
    expect(later.hasMore).toBe(true);
  });

  it('moves messages that slid out of the window to the head of the older pages', () => {
    const cache = { ...createEmptyRoomCache(), messages: [msg('m2', 2), msg('m1', 1)], isLoaded: true, cursorConfirmed: true };
    const next = applyLatestSnapshot(cache, { messages: [msg('m3', 3), msg('m2', 2)], lastDoc: null, docCount: 2, fromCache: false });
    expect(next.olderMessages.map(m => m.id)).toEqual(['m1']);
  });

  it('a cache paint never overrides a loaded room', () => {
    const loaded = { ...createEmptyRoomCache(), isLoaded: true };
    expect(applyCachedMessages(loaded, [msg('a', 1)])).toBe(loaded);
    expect(applyCachedMessages(createEmptyRoomCache(), [msg('a', 1)]).messages.map(m => m.id)).toEqual(['a']);
  });
});

describe('mergeDisplayedMessages', () => {
  it('shows pending bubbles first, drops the unhydrated echo of a pending send, attaches reactions + receipts', () => {
    const pending = { ...msg('p1', 10, 'me'), pending: true };
    const echo = { ...msg('p1', 0, 'me'), createdAt: null } as unknown as ChatListMessage;
    const reaction = { id: 'r', messageId: 'm1', userId: 'u2', userName: 'Ana', emoji: '👍', updatedAt: Timestamp.fromMillis(1) } as ChatReaction;
    const out = mergeDisplayedMessages({
      messages: [echo, msg('m2', 2, 'me'), msg('m1', 1)],
      olderMessages: [msg('m1', 1)],
      pendingMessages: [pending],
      reactions: [reaction],
      receipts: [],
      currentUserId: 'me',
    });
    expect(out.map(m => m.id)).toEqual(['p1', 'm2', 'm1']);
    expect(out[0].receiptStatus).toBe('sent');
    expect(out[1].receiptStatus).toBe('delivered');
    expect(out[2].reactions).toEqual([{ emoji: '👍', count: 1, reactedByMe: false, users: [{ userId: 'u2', userName: 'Ana' }] }]);
  });
});

describe('unread boundary', () => {
  const base = (over: Partial<ChatRoomCache> = {}): ChatRoomCache => ({ ...createEmptyRoomCache(), isLoaded: true, lastDoc: cursor('m5'), ...over });

  it('needs a backfill while unread messages are loaded but the boundary is not', () => {
    const cache = base({ messages: [msg('m6', 600), msg('m5', 500)] });
    expect(needsUnreadBoundaryBackfill(cache, 100, 'me')).toBe(true);
    expect(isUnreadBoundaryLoaded(cache, 100, 'me')).toBe(false);
    expect(isUnreadBoundaryLoaded({ ...cache, hasMore: false }, 100, 'me')).toBe(true);
  });

  it('pages back until the boundary is loaded and dedupes', async () => {
    fs.getDocs
      .mockResolvedValueOnce(querySnap(docsOf(CHAT_PAGE_SIZE, 499)))
      .mockResolvedValueOnce(querySnap([['m50', { senderId: 'u2', createdAt: Timestamp.fromMillis(50) }]]));
    const cache = base({ messages: [msg('m600', 600), msg('m500', 500)] });
    const next = await loadUnreadBoundary(ctx, auth, args, cache, 100);
    expect(fs.getDocs).toHaveBeenCalledTimes(2);
    const q = fs.getDocs.mock.calls[0][0] as unknown as { path: string; constraints: { type: string }[] };
    expect(q.path).toBe(PATH);
    expect(q.constraints.map(c => c.type)).toEqual(['orderBy', 'startAfter', 'limit']);
    expect(next?.olderMessages).toHaveLength(CHAT_PAGE_SIZE + 1);
    expect(next?.hasMore).toBe(false);
  });

  it('returns null when cancelled', async () => {
    fs.getDocs.mockResolvedValue(querySnap(docsOf(CHAT_PAGE_SIZE, 499)));
    let calls = 0;
    const out = await loadUnreadBoundary(ctx, auth, args, base({ messages: [msg('m600', 600)] }), 100, () => ++calls > 1);
    expect(out).toBeNull();
  });
});

describe('older pages', () => {
  it('fetchOlderMessagesPage refuses without Firebase auth', async () => {
    await expect(fetchOlderMessagesPage(ctx, { ...auth, ensure: async () => false }, args, cursor('x'))).rejects.toThrow(/not ready/);
    expect(fs.getDocs).not.toHaveBeenCalled();
  });

  it('keeps the old cursor on an empty page', async () => {
    fs.getDocs.mockResolvedValue(querySnap([]));
    const page = await fetchOlderMessagesPage(ctx, auth, args, cursor('x'));
    expect(page).toMatchObject({ messages: [], hasMore: false, lastDoc: cursor('x') });
  });

  it('loadUntilMessage pages until the replied-to message is found', async () => {
    fs.getDocs
      .mockResolvedValueOnce(querySnap(docsOf(CHAT_PAGE_SIZE, 499)))
      .mockResolvedValueOnce(querySnap(docsOf(3, 449)));
    const onPage = vi.fn();
    const { found, cache } = await loadUntilMessage(ctx, auth, args, { ...createEmptyRoomCache(), lastDoc: cursor('c') }, 'm448', onPage);
    expect(found).toBe(true);
    expect(onPage).toHaveBeenCalledTimes(2);
    expect(cache.olderMessages).toHaveLength(CHAT_PAGE_SIZE + 3);
  });

  it('appendOlderPage without dedupe appends as fish load-more does', () => {
    const cache = { ...createEmptyRoomCache(), olderMessages: [msg('a', 1)] };
    expect(appendOlderPage(cache, { messages: [msg('a', 1)], lastDoc: null, hasMore: false }).olderMessages).toHaveLength(2);
    expect(appendOlderPage(cache, { messages: [msg('a', 1)], lastDoc: null, hasMore: false }, true).olderMessages).toHaveLength(1);
  });
});

describe('subscribeChatRoom', () => {
  it('paints the cache, then subscribes on the chat database and reduces snapshots', async () => {
    fs.getDocsFromCache.mockResolvedValue(querySnap([['m1', { senderId: 'u2', createdAt: Timestamp.fromMillis(1) }]]));
    let cache = createEmptyRoomCache();
    const onCache = vi.fn((next: ChatRoomCache) => {
      cache = next;
    });
    const onError = vi.fn();
    const unsubscribe = subscribeChatRoom(ctx, auth, args, { getCache: () => cache, onCache, onError });
    await vi.waitFor(() => expect(fs.on(PATH)).toHaveLength(1));
    expect(cache.messages.map(m => m.id)).toEqual(['m1']);
    expect(cache.isLoaded).toBe(false);
    // Chat never touches the (default) database outside production.
    expect(fs.on(PATH)[0].ref.db).toBe(CHAT_DB);
    expect((fs.getDocsFromCache.mock.calls[0][0] as { db: unknown }).db).toBe(CHAT_DB);

    fs.on(PATH)[0].next(querySnap([['m2', { senderId: 'u2', createdAt: Timestamp.fromMillis(2) }]], false));
    expect(cache).toMatchObject({ isLoaded: true, cursorConfirmed: true, hasMore: false });
    unsubscribe();
    expect(fs.on(PATH)[0].unsub).toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it('reports an auth error and never subscribes when Firebase is not signed in', async () => {
    const onError = vi.fn();
    subscribeChatRoom(ctx, { ...auth, ensure: async () => false }, args, { getCache: createEmptyRoomCache, onCache: vi.fn(), onError });
    await vi.waitFor(() => expect(onError).toHaveBeenCalledWith(expect.any(Error), 'auth'));
    expect(fs.listeners).toHaveLength(0);
  });

  it('forwards a listener error as a load error', async () => {
    const onError = vi.fn();
    subscribeChatRoom(ctx, auth, args, { getCache: createEmptyRoomCache, onCache: vi.fn(), onError });
    await vi.waitFor(() => expect(fs.on(PATH)).toHaveLength(1));
    fs.on(PATH)[0].error?.({ code: 'permission-denied' });
    expect(onError).toHaveBeenCalledWith({ code: 'permission-denied' }, 'load');
  });
});
