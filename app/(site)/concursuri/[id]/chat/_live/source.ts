'use client';

import type { Timestamp } from 'firebase/firestore';
import type { chat } from '@/core/realtime';
import type { CorePure } from './corePure';

/*
 * THE seam between the chat page and Firestore (participant.chat, b.chat-realtime).
 *
 * core/realtime/chat imports `firebase/firestore` directly, so the page never calls it: every
 * read, listener and write goes through a ChatSource. Two implementations, both loaded on demand
 * (the Firebase SDK is ~200 KB and must stay out of the competition page's and the chat route's
 * first chunk — ChatPanel's old header comment, Lighthouse):
 *  - `firestore` (./firestoreSource.ts): core/realtime/chat over lib/client/firebase — the
 *    environment's chat database (`chatDb`), the CMS-minted custom token (uid = profile documentId).
 *  - `fake` (./fakeSource.ts): only when this is NOT a production build and a test installed
 *    `window.__BLUVI_FAKE_CHAT__` (tests/e2e/helpers/fake-chat.ts). It serves seeded rooms, pushed
 *    snapshots and injected failures, records every write, and never loads Firebase. The ONE
 *    Firebase project is shared by every environment: no test may read or write it.
 *
 * Both run the same core pure logic (room reducer, outbox worker, receipt status, typing labels,
 * badge rule); only the I/O differs. A production build drops the fake (dead branch on NODE_ENV).
 */

export type RoomId = chat.ChatRoomId;
export type Unsub = () => void;
export type RoomRef = { competitionId: string; roomId: RoomId };

/** What a room listener reports: the reduced cache, or which toast fish shows (c42). */
export type RoomHandlers = {
  getCache: () => chat.ChatRoomCache;
  onCache: (cache: chat.ChatRoomCache) => void;
  onError: (error: unknown, kind: 'auth' | 'load') => void;
};

export type TypingWriter = { onTypingChange: (isTyping: boolean) => void; dispose: () => void };

/** The outbox as the page uses it (core createOutboxWorker's surface). */
export type ChatOutbox = Pick<
  chat.OutboxWorker,
  'run' | 'subscribe' | 'enqueue' | 'roomMessages' | 'retry' | 'discard' | 'discardAll' | 'dispose' | 'flush' | 'repo'
>;

/** The pieces of the page the outbox needs: persistent storage (IndexedDB) and the /upload call. */
export type OutboxDeps = {
  storage: chat.OutboxStorage;
  uploader: chat.OutboxUploader;
  /** The CMS API URL whose origin prefixes relative upload URLs. */
  apiBase?: string;
  releaseFiles?: (messageId: string | null) => void;
};

export interface ChatSource {
  kind: 'firestore' | 'fake';
  /** core's pure helpers that share a module with the SDK (./corePure.ts). */
  pure: CorePure;
  /** fish ensureChatFirebaseAuth: Firebase signed in as this profile (mints a custom token if needed). */
  ensure(): Promise<boolean>;
  /** The newest 50 messages of a room, live, reduced into the caller-owned cache (core subscribeChatRoom). */
  subscribeRoom(room: RoomRef, handlers: RoomHandlers): Unsub;
  /** One older page (core loadMoreMessages). */
  loadMore(room: RoomRef, cache: chat.ChatRoomCache): Promise<chat.ChatRoomCache>;
  /** Pages back until `messageId` is loaded (core loadUntilMessage; reply jump). */
  loadUntil(
    room: RoomRef,
    cache: chat.ChatRoomCache,
    messageId: string,
    onPage?: (cache: chat.ChatRoomCache) => void,
  ): Promise<{ cache: chat.ChatRoomCache; found: boolean }>;
  /** Pages back until the unread boundary is loaded (core loadUnreadBoundary). */
  loadUnreadBoundary(
    room: RoomRef,
    cache: chat.ChatRoomCache,
    unreadAfterMs: number,
    isCancelled: () => boolean,
  ): Promise<chat.ChatRoomCache | null>;
  /** The room's receipts; `unreadAfter` frozen from the first snapshot (core subscribeReceipts). */
  subscribeReceipts(
    room: RoomRef & { currentUserId: string },
    onData: (state: { receipts: chat.ChatReadReceipt[]; unreadAfter: Timestamp | null }) => void,
  ): Unsub;
  /** core createReadMarker: advances my receipt (fire-and-forget, deduped by message time). */
  createReadMarker(room: RoomRef & { userName?: string; isLocked: boolean }): (message: chat.ChatListMessage) => void;
  subscribeReactions(room: RoomRef, onData: (reactions: chat.ChatReaction[]) => void): Unsub;
  /** core toggleReaction (rejects on failure: the caller toasts REACTION_ERROR). */
  toggleReaction(args: Parameters<typeof chat.toggleReaction>[2]): Promise<void>;
  /** core subscribeTypingNames: who else types in this room (fish's hold / stale timing). */
  subscribeTypingNames(room: RoomRef & { currentUserId: string }, onNames: (names: string[]) => void): Unsub;
  /** core createTypingWriter: marks me typing (throttled, auto-cleared). */
  createTypingWriter(room: RoomRef & { userName?: string; isLocked: boolean }): TypingWriter;
  /** core subscribeChatMeta: the closing gate's meta doc. */
  subscribeMeta(competitionId: string, onMeta: (meta: chat.ChatMeta, loaded: boolean) => void): Unsub;
  /** core needsRulesAcknowledgement (an unreadable doc → false). */
  needsRules(): Promise<boolean>;
  /** core acknowledgeRules (rejects on failure). */
  acknowledgeRules(): Promise<void>;
  /** core subscribeRoomUnreadCount (capped at 100: «99+»). */
  subscribeRoomUnread(room: RoomRef, onCount: (count: number) => void): Unsub;
  /** core subscribeCompetitionChatBadge. */
  subscribeBadge(args: { competitionId: string; isMember: boolean }, onBadge: (badge: chat.ChatBadge) => void): Unsub;
  /** A fresh message id (no network). */
  newMessageId(room: RoomRef): string;
  /** The outbox worker (core createOutboxWorker), one per source. */
  createOutbox(deps: OutboxDeps): ChatOutbox;
  /** core editChatMessage (rejects on failure). */
  editMessage(room: RoomRef & { messageId: string; text: string }): Promise<void>;
  /** core deleteChatMessage (rejects on failure; false when the guard refuses). */
  deleteMessage(room: RoomRef & { message: chat.ChatListMessage; canDeleteAnyMessage: boolean }): Promise<boolean>;
}

/* ------------------------------------------------------------------ */
/* The e2e fake's global (tests/e2e/helpers/fake-chat.ts)              */
/* ------------------------------------------------------------------ */

/** A time in a seed: ISO string or epoch ms. */
export type FakeTime = string | number;

export type FakeChatMessageDoc = {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string | null;
  text: string;
  /** null = a local write echo (server time not set yet). */
  createdAt: FakeTime | null;
  type?: 'text' | 'system';
  senderRole?: 'participant' | 'organizer' | 'referee';
  event?: string;
  link?: { kind: string; id?: string; params?: Record<string, string> };
  data?: Record<string, string | number>;
  attachments?: { id: string; url: string; thumbnailUrl: string; width?: number; height?: number; blurhash?: string }[];
  replyTo?: { messageId: string; senderId: string; senderName: string; text: string; hasAttachments?: boolean };
  editedAt?: FakeTime;
  deletedAt?: FakeTime;
  deletedBy?: string;
};
export type FakeChatReactionDoc = { messageId: string; userId: string; userName: string; emoji: string; updatedAt?: FakeTime };
export type FakeChatReceiptDoc = { userId: string; userName?: string; lastReadMessageId?: string; lastReadAt: FakeTime; updatedAt?: FakeTime };
/** `updatedAt` defaults to the moment the doc reaches the page (a fresh «is typing»). */
export type FakeChatTypingDoc = { userId: string; userName: string; isTyping: boolean; updatedAt?: FakeTime };

export type FakeChatRoom = {
  messages: FakeChatMessageDoc[];
  reactions: FakeChatReactionDoc[];
  receipts: FakeChatReceiptDoc[];
  typing: FakeChatTypingDoc[];
  /** What subscribeRoomUnreadCount reports for this room (newer than my receipt, not mine). */
  unread: number;
  /** I have a receipt in this room (the badge's «Nou» rule: none in any readable room = never opened). */
  seen: boolean;
};

/** A write failure: the next writes to a path starting with `path` reject with `code`. */
export type FakeChatFailure = {
  code: string;
  /** How many writes fail (default: all). */
  times?: number;
  /** Only writes whose data carries this key fail (the role-chip fallback: `senderRole`). */
  ifField?: string;
};

export type FakeChatWrite = {
  op: 'set' | 'update' | 'delete' | 'upload';
  path: string;
  data?: Record<string, unknown>;
  /** The page clock when it was made (ms). */
  at: number;
};

export type FakeChat = {
  rooms: Record<RoomId, FakeChatRoom>;
  /** The meta doc (`closesAt`), none (null), or a listener that fails (`unreadable`). */
  meta: { closesAt: FakeTime; reason?: string } | null | 'unreadable';
  /** The rules consent doc. */
  consent: 'present' | 'absent' | 'unreadable';
  /** `fail`: Firebase sign-in fails (ensure() → false: the auth toast, c42). */
  auth: 'ok' | 'fail';
  /** Listener paths that fail at once with this code (the load toast, c42). */
  listenerErrors: Record<string, string>;
  /** Write failures by path prefix (see FakeChatFailure). */
  failures: Record<string, FakeChatFailure>;
  /** The first room snapshot comes from the cache. */
  fromCache?: boolean;
  /** Recorded by the source: every write the page made, in order. */
  writes: FakeChatWrite[];
  /** Recorded by the source: every listener path the page opened, in order. */
  listened: string[];
  /** Installed by the source: merge `patch` into a room and notify its listeners. */
  push?: (roomId: RoomId, patch: Partial<FakeChatRoom>) => void;
  /** Installed by the source: replace the meta doc and notify. */
  setMeta?: (meta: FakeChat['meta']) => void;
  /** Installed by the source: fail the live listeners under `path` now. */
  fail?: (path: string, code?: string) => void;
};

declare global {
  interface Window {
    __BLUVI_FAKE_CHAT__?: FakeChat;
  }
}

/** The fake, when this is not a production build and a test installed it. */
export function fakeChat(): FakeChat | null {
  if (process.env.NODE_ENV === 'production' || typeof window === 'undefined') return null;
  return window.__BLUVI_FAKE_CHAT__ ?? null;
}

const sources = new Map<string, Promise<ChatSource>>();

/**
 * The source for this account (one per uid per page: listeners, auth and the outbox are shared by
 * every hook). The modules are fetched here, after hydration — never in the route's first chunk.
 */
export function loadChatSource(uid: string): Promise<ChatSource> {
  const existing = sources.get(uid);
  if (existing) return existing;
  const fake = fakeChat();
  const created =
    process.env.NODE_ENV !== 'production' && fake
      ? import('./fakeSource').then(m => m.createFakeChatSource(fake, uid))
      : import('./firestoreSource').then(m => m.createFirestoreChatSource(uid));
  // A chunk that failed to load (offline) is not cached: the next mount tries again.
  created.catch(() => sources.delete(uid));
  sources.set(uid, created);
  return created;
}

/** Firebase configured for this build (NEXT_PUBLIC_FIREBASE_*): without it the chat cannot run. */
export const CHAT_CONFIGURED = Boolean(
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY && process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID && process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
);

/** Whether the chat can run here: Firebase configured, or the e2e fake installed. */
export function chatAvailable(): boolean {
  return CHAT_CONFIGURED || fakeChat() !== null;
}
