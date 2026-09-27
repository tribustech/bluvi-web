/**
 * fish `features/chat/hooks/useChatRoom.ts`, split into Firestore calls + pure reducers.
 *
 * Room messages: subscribe to the latest page, paginate older messages (manual load-more,
 * automatic unread-boundary backfill, and reply-jump backfill), and merge pending + server +
 * reactions + receipts into the list the screen renders. The per-room cache (`ChatRoomCache`) is
 * owned by the caller so switching tabs restores state instantly instead of re-fetching.
 */
import {
  collection,
  getDocs,
  getDocsFromCache,
  limit,
  onSnapshot,
  orderBy,
  query,
  startAfter,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import type { ChatAuth, RealtimeContext } from '../firebase';
import { evictedFromWindow, prependEvicted, summarizeReactions } from './domain';
import { chatMessagesPath } from './paths';
import { getReceiptStatus, hasLoadedUnreadBoundary, hasLoadedUnreadIncomingMessage, toChatMessage } from './transforms';
import type { ChatListMessage, ChatReaction, ChatReadReceipt, ChatRoomId } from './types';

export const CHAT_PAGE_SIZE = 50;

/** The Romanian toasts fish shows for each failure; the UI decides whether to show them. */
export const CHAT_ROOM_ERRORS = {
  auth: 'Nu am putut autentifica chat-ul. Te rugăm să încerci din nou.',
  load: 'Nu am putut încărca chat-ul. Te rugăm să încerci din nou.',
  unreadBoundary: 'Nu am putut încărca mesajele noi necitite.',
  older: 'Nu am putut încărca mesajele mai vechi.',
  replyNotFound: 'Nu am găsit mesajul la care s-a răspuns.',
  replyLoad: 'Nu am putut încărca mesajul la care s-a răspuns.',
} as const;

/** Opaque pagination cursor (the last doc snapshot of a page). */
export type ChatCursor = QueryDocumentSnapshot;

export type RoomArgs = { competitionId: string; roomId: ChatRoomId };

export type ChatRoomCache = {
  messages: ChatListMessage[];
  olderMessages: ChatListMessage[];
  lastDoc: ChatCursor | null;
  hasMore: boolean;
  isLoaded: boolean;
  /** The pagination cursor/`hasMore` came from a server-confirmed (or full) page, not from a partial
   * offline cache — see `applyLatestSnapshot`. */
  cursorConfirmed: boolean;
};

export const createEmptyRoomCache = (): ChatRoomCache => ({
  messages: [],
  olderMessages: [],
  lastDoc: null,
  hasMore: true,
  isLoaded: false,
  cursorConfirmed: false,
});

export type LatestSnapshot = {
  messages: ChatListMessage[];
  lastDoc: ChatCursor | null;
  docCount: number;
  fromCache: boolean;
};

export type OlderPage = { messages: ChatListMessage[]; lastDoc: ChatCursor; hasMore: boolean };

const latestQuery = (ctx: RealtimeContext, { competitionId, roomId }: RoomArgs) =>
  query(collection(ctx.chatDb, chatMessagesPath(competitionId, roomId)), orderBy('createdAt', 'desc'), limit(CHAT_PAGE_SIZE));

// ── Firestore ──────────────────────────────────────────────────────────────────

/**
 * Paint the last page from Firestore's own local cache while the live query is still being set
 * up. Opening a room the user has read before otherwise waits on THREE serial steps before a
 * single bubble exists: the profile query, the Firebase custom-token mint inside
 * `ensureChatFirebaseAuth`, and the first snapshot. A cache read is local and needs no auth, so it
 * lands in the first frames; the snapshot replaces it in place. Nothing else is derived from it —
 * `isLoaded` stays false, so the pagination cursor and `hasMore` are still taken from the first
 * server snapshot.
 * Firestore does not drop its cache on sign-out, so on a shared device the previous account's page
 * can flash for one beat before the snapshot replaces it. Accepted: General is readable by every
 * signed-in user anyway, and Participanți never reaches this path (`isLocked` holds until the
 * statute confirms membership).
 *
 * Web: with the SDK's default memory cache this only finds what this tab already loaded; it is
 * useful across page loads only when the app opts into `persistentLocalCache`. Resolves `[]` when
 * nothing is cached (or persistence is unavailable): the live subscription is the only path.
 */
export async function readCachedLatestMessages(ctx: RealtimeContext, args: RoomArgs): Promise<ChatListMessage[]> {
  try {
    const snapshot = await getDocsFromCache(latestQuery(ctx, args));
    return snapshot.docs.map(doc => toChatMessage(doc));
  } catch {
    return [];
  }
}

/** Live listener on the latest `CHAT_PAGE_SIZE` messages (newest first). */
export function subscribeLatestMessages(
  ctx: RealtimeContext,
  args: RoomArgs,
  onData: (snapshot: LatestSnapshot) => void,
  onError: (error: unknown) => void
): Unsubscribe {
  return onSnapshot(
    latestQuery(ctx, args),
    snapshot => {
      onData({
        messages: snapshot.docs.map(doc => toChatMessage(doc)),
        lastDoc: snapshot.docs[snapshot.docs.length - 1] ?? null,
        docCount: snapshot.docs.length,
        fromCache: snapshot.metadata.fromCache,
      });
    },
    onError
  );
}

/** fish `fetchOlderMessagesPage`: the page after `cursor`, with auth ensured + retried once. */
export async function fetchOlderMessagesPage(
  ctx: RealtimeContext,
  auth: ChatAuth,
  { competitionId, roomId }: RoomArgs,
  cursor: ChatCursor
): Promise<OlderPage> {
  const isFirebaseReady = await auth.ensure();
  if (!isFirebaseReady) throw new Error('Firebase auth is not ready.');

  const snapshot = await auth.withRetry(() =>
    getDocs(
      query(
        collection(ctx.chatDb, chatMessagesPath(competitionId, roomId)),
        orderBy('createdAt', 'desc'),
        startAfter(cursor),
        limit(CHAT_PAGE_SIZE)
      )
    )
  );

  return {
    messages: snapshot.docs.map(doc => toChatMessage(doc)),
    lastDoc: snapshot.docs[snapshot.docs.length - 1] ?? cursor,
    hasMore: snapshot.docs.length === CHAT_PAGE_SIZE,
  };
}

/**
 * The whole room lifecycle fish runs in its two effects: optional cache paint, auth, live
 * listener — every change reduced into the caller-owned cache and reported via `onCache`.
 * `getCache` reads the caller's current cache (so a tab switch that kept it keeps its pages).
 * Returns an unsubscribe that also cancels a pending auth/cache step.
 */
export function subscribeChatRoom(
  ctx: RealtimeContext,
  auth: ChatAuth,
  args: RoomArgs,
  {
    getCache,
    onCache,
    onError,
  }: {
    getCache: () => ChatRoomCache;
    onCache: (cache: ChatRoomCache) => void;
    /** `kind` picks the fish toast: `auth` (not signed in / mint failed) or `load` (listener error). */
    onError: (error: unknown, kind: 'auth' | 'load') => void;
  }
): Unsubscribe {
  let cancelled = false;
  let unsubscribe: Unsubscribe | undefined;

  if (!getCache().isLoaded) {
    void readCachedLatestMessages(ctx, args).then(messages => {
      if (cancelled || !messages.length) return;
      const next = applyCachedMessages(getCache(), messages);
      if (next !== getCache()) onCache(next);
    });
  }

  auth
    .ensure()
    .then(isFirebaseReady => {
      if (cancelled) return;
      if (!isFirebaseReady) {
        onError(new Error('chat: Firebase auth is not ready'), 'auth');
        return;
      }
      unsubscribe = subscribeLatestMessages(
        ctx,
        args,
        snapshot => onCache(applyLatestSnapshot(getCache(), snapshot)),
        error => onError(error, 'load')
      );
    })
    .catch(error => {
      if (!cancelled) onError(error, 'auth');
    });

  return () => {
    cancelled = true;
    unsubscribe?.();
  };
}

// ── Pure reducers ──────────────────────────────────────────────────────────────

/** The cache paint: ignored once the live snapshot won the race. */
export function applyCachedMessages(cache: ChatRoomCache, messages: ChatListMessage[]): ChatRoomCache {
  if (cache.isLoaded || !messages.length) return cache;
  return { ...cache, messages };
}

export function applyLatestSnapshot(cache: ChatRoomCache, snapshot: LatestSnapshot): ChatRoomCache {
  const nextMessages = snapshot.messages;
  // Docs that slid out of the window (new messages arrived, here or while another tab
  // was open) move to the head of the older pages so the list has no hole.
  const evicted = evictedFromWindow(cache.messages, nextMessages);
  const nextOlder = prependEvicted(evicted, cache.olderMessages);
  // The pagination cursor is taken ONCE, from the first snapshot that can be trusted for
  // it; later snapshots must not move it or the pages already fetched would no longer
  // line up with the window. With persistence on, the very first snapshot often comes
  // from the local cache with only the docs this device happened to have — fewer than a
  // page — and that used to mark the room as having no history at all: no cursor, and
  // `hasMore` false for the rest of the visit. Until a server snapshot (or a full page)
  // arrives, the cursor stays null (pagination waits) and `hasMore` stays true.
  const cursorConfirmed = cache.cursorConfirmed || !snapshot.fromCache || snapshot.docCount === CHAT_PAGE_SIZE;
  const takeCursor = !cache.cursorConfirmed && cursorConfirmed;
  return {
    ...cache,
    messages: nextMessages,
    olderMessages: nextOlder,
    lastDoc: takeCursor ? snapshot.lastDoc : cache.lastDoc,
    hasMore: takeCursor ? snapshot.docCount === CHAT_PAGE_SIZE : cache.hasMore,
    isLoaded: true,
    cursorConfirmed,
  };
}

/**
 * Appends a fetched older page. `dedupe` = the unread-boundary backfill, which filters ids the list
 * already holds; load-more and reply-jump append as-is (as fish does).
 */
export function appendOlderPage(cache: ChatRoomCache, page: Omit<OlderPage, 'lastDoc'> & { lastDoc: ChatCursor | null }, dedupe = false): ChatRoomCache {
  const prevIds = dedupe ? new Set(cache.olderMessages.map(message => message.id)) : null;
  const fresh = prevIds ? page.messages.filter(message => !prevIds.has(message.id)) : page.messages;
  return { ...cache, olderMessages: [...cache.olderMessages, ...fresh], lastDoc: page.lastDoc, hasMore: page.hasMore };
}

/** fish `displayedMessages`: pending outbox bubbles first, then live + older, with reactions and receipts. */
export function mergeDisplayedMessages({
  messages,
  olderMessages,
  pendingMessages,
  reactions,
  receipts,
  currentUserId,
}: {
  messages: ChatListMessage[];
  olderMessages: ChatListMessage[];
  pendingMessages: ChatListMessage[];
  reactions: ChatReaction[];
  receipts: ChatReadReceipt[];
  currentUserId?: string;
}): ChatListMessage[] {
  const reactionsByMessageId = reactions.reduce<Record<string, ChatReaction[]>>((acc, reaction) => {
    acc[reaction.messageId] = acc[reaction.messageId] ?? [];
    acc[reaction.messageId].push(reaction);
    return acc;
  }, {});

  const withReactions = (message: ChatListMessage): ChatListMessage => ({
    ...message,
    receiptStatus: getReceiptStatus(message, currentUserId, receipts),
    reactions: summarizeReactions(reactionsByMessageId[message.id] ?? [], currentUserId),
  });

  const pendingIds = new Set(pendingMessages.map(message => message.id));
  const seenIds = new Set<string>();
  const persistedMessages = [...messages, ...olderMessages]
    .filter(message => {
      if (seenIds.has(message.id)) return false;
      seenIds.add(message.id);
      // A local write echo (server timestamp still null) of a message the outbox still shows.
      if (pendingIds.has(message.id) && !message.createdAt?.toMillis?.()) return false;
      return true;
    })
    .map(withReactions);
  if (!pendingMessages.length) return persistedMessages;
  const messageIds = new Set(persistedMessages.map(message => message.id));
  return [...pendingMessages.filter(message => !messageIds.has(message.id)).map(withReactions), ...persistedMessages];
}

/** fish `unreadBoundaryLoaded`: whether the "Mesaje noi" divider can be placed. */
export function isUnreadBoundaryLoaded(cache: ChatRoomCache, unreadAfterMs: number, currentUserId?: string): boolean {
  if (!currentUserId || !unreadAfterMs) return false;
  const loadedMessages = [...cache.messages, ...cache.olderMessages];
  if (!hasLoadedUnreadIncomingMessage(loadedMessages, unreadAfterMs, currentUserId)) return false;
  return hasLoadedUnreadBoundary(loadedMessages, unreadAfterMs) || !cache.hasMore;
}

/** Guard of fish's backfill effect: there are unread messages but the boundary is not loaded yet. */
export function needsUnreadBoundaryBackfill(cache: ChatRoomCache, unreadAfterMs: number, currentUserId?: string): boolean {
  if (!currentUserId || !unreadAfterMs || !cache.lastDoc || !cache.hasMore) return false;
  const loadedMessages = [...cache.messages, ...cache.olderMessages];
  return (
    hasLoadedUnreadIncomingMessage(loadedMessages, unreadAfterMs, currentUserId) &&
    !hasLoadedUnreadBoundary(loadedMessages, unreadAfterMs)
  );
}

// ── Multi-page loads ───────────────────────────────────────────────────────────

/**
 * fish `loadUnreadBoundary`: pages back until a message at/before the reader's receipt is loaded
 * (or history ends). Resolves the new cache, or null when cancelled mid-way.
 */
export async function loadUnreadBoundary(
  ctx: RealtimeContext,
  auth: ChatAuth,
  args: RoomArgs,
  cache: ChatRoomCache,
  unreadAfterMs: number,
  isCancelled: () => boolean = () => false
): Promise<ChatRoomCache | null> {
  let cursor = cache.lastDoc;
  let hasMore = cache.hasMore;
  const fetched: ChatListMessage[] = [];
  while (
    cursor &&
    hasMore &&
    !isCancelled() &&
    !hasLoadedUnreadBoundary([...cache.messages, ...cache.olderMessages, ...fetched], unreadAfterMs)
  ) {
    const page = await fetchOlderMessagesPage(ctx, auth, args, cursor);
    fetched.push(...page.messages);
    cursor = page.lastDoc;
    hasMore = page.hasMore;
  }
  if (isCancelled()) return null;
  return appendOlderPage(cache, { messages: fetched, lastDoc: cursor, hasMore }, true);
}

/** fish `loadMore`: one older page, or the cache unchanged when there is nothing to load. */
export async function loadMoreMessages(ctx: RealtimeContext, auth: ChatAuth, args: RoomArgs, cache: ChatRoomCache): Promise<ChatRoomCache> {
  if (!cache.lastDoc || !cache.hasMore) return cache;
  const page = await fetchOlderMessagesPage(ctx, auth, args, cache.lastDoc);
  return appendOlderPage(cache, page);
}

/**
 * fish `jumpToMessage` (reply jump): pages back until `messageId` is loaded. `onPage` reports each
 * intermediate cache so the list grows while it searches. `found: false` = fish's
 * "Nu am găsit mesajul la care s-a răspuns." toast.
 */
export async function loadUntilMessage(
  ctx: RealtimeContext,
  auth: ChatAuth,
  args: RoomArgs,
  cache: ChatRoomCache,
  messageId: string,
  onPage?: (cache: ChatRoomCache) => void
): Promise<{ cache: ChatRoomCache; found: boolean }> {
  let current = cache;
  const loadedIds = new Set([...cache.messages, ...cache.olderMessages].map(message => message.id));
  while (current.lastDoc && current.hasMore && !loadedIds.has(messageId)) {
    const page = await fetchOlderMessagesPage(ctx, auth, args, current.lastDoc);
    page.messages.forEach(message => loadedIds.add(message.id));
    current = appendOlderPage(current, page);
    onPage?.(current);
  }
  return { cache: current, found: loadedIds.has(messageId) };
}
