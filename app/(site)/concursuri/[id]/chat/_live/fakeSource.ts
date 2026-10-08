'use client';

import { Timestamp } from 'firebase/firestore';
// Pure modules only (no Firestore calls): the reducer, the badge rule, the typing rule, the paths,
// the outbox worker (its Firestore I/O is injected below).
import { chatBadgeOf, UNREAD_BADGE_CAP } from '@/core/realtime/chat/unread';
import { applyLatestSnapshot, appendOlderPage, CHAT_PAGE_SIZE, type ChatCursor, type ChatRoomCache } from '@/core/realtime/chat/room';
import { TYPING_IDLE_MS, TYPING_MIN_VISIBLE_MS, TYPING_STALE_MS, typingNamesOf } from '@/core/realtime/chat/typing';
import { hasLoadedUnreadBoundary } from '@/core/realtime/chat/transforms';
import { canDeleteChatMessage } from '@/core/realtime/chat/messages';
import {
  chatMessagePath,
  chatMessagesPath,
  chatMetaPath,
  chatReactionUserPath,
  chatReactionsPath,
  chatReceiptsPath,
  chatReceiptUserPath,
  chatRulesConsentPath,
  chatTypingPath,
  chatTypingUserPath,
} from '@/core/realtime/chat/paths';
import { createOutboxWorker } from '@/core/realtime/chat/outbox/worker';
import type { ChatListMessage, ChatReaction, ChatReadReceipt } from '@/core/realtime/chat/types';
import type { RealtimeContext } from '@/core/realtime';
import { corePure } from './corePure';
import type { ChatSource, FakeChat, FakeChatFailure, FakeChatMessageDoc, FakeChatRoom, FakeTime, RoomId, RoomRef } from './source';

/*
 * The e2e Firestore fake behind the ChatSource seam (see ./source.ts). Development and tests only:
 * ./source.ts imports this module only when NODE_ENV !== 'production' and a test set
 * `window.__BLUVI_FAKE_CHAT__` (tests/e2e/helpers/fake-chat.ts). It never loads the Firebase app,
 * Auth or a Firestore instance — `Timestamp` is the SDK's plain value class.
 *
 * Reads come from the seeded rooms; `push` / `setMeta` / `fail` (installed here on the global)
 * notify the open listeners like onSnapshot would (asynchronously). Every write is RECORDED in
 * `fake.writes` with its Firestore path and applied to the fake doc, so the page sees its own
 * echo: messages (via the REAL core outbox worker, whose Firestore I/O is injected), edits,
 * deletes, reactions, receipts, typing, the rules consent and uploads.
 */

const toMs = (t: FakeTime): number => (typeof t === 'number' ? t : Date.parse(t));
const ts = (t: FakeTime | null | undefined): Timestamp | undefined => (t === null || t === undefined ? undefined : Timestamp.fromMillis(toMs(t)));

/** A ChatMessage as toChatMessage builds it from a doc. */
function toMessage(d: FakeChatMessageDoc): ChatListMessage {
  return {
    id: d.id,
    senderId: d.senderId,
    senderName: d.senderName,
    senderAvatar: d.senderAvatar ?? null,
    text: d.text,
    attachments: d.attachments ?? [],
    replyTo: d.replyTo,
    // A local echo has no server time yet (toMillis absent → 0 in core).
    createdAt: (ts(d.createdAt) ?? null) as unknown as Timestamp,
    editedAt: ts(d.editedAt),
    type: d.type ?? 'text',
    senderRole: d.senderRole,
    event: d.event,
    link: d.link,
    deletedAt: ts(d.deletedAt),
    deletedBy: d.deletedBy,
  };
}

const timeOf = (d: FakeChatMessageDoc) => (d.createdAt === null ? Number.MAX_SAFE_INTEGER : toMs(d.createdAt));
/** The room's docs newest first (a pending local echo sorts on top, as Firestore's latency compensation). */
const newestFirst = (room: FakeChatRoom) => room.messages.slice().sort((a, b) => timeOf(b) - timeOf(a));

type Cursor = { offset: number };
const cursorOf = (offset: number) => ({ offset }) as unknown as ChatCursor;
const offsetOf = (cursor: ChatCursor | null) => (cursor as unknown as Cursor | null)?.offset ?? 0;

const defer = (fn: () => void) => setTimeout(fn, 0);

function error(code: string) {
  return Object.assign(new Error(code), { code });
}

/** JSON-safe copy of a write's data (FieldValue sentinels → «serverTimestamp»). */
function plain(value: unknown): unknown {
  if (value === null || value === undefined) return value ?? null;
  if (Array.isArray(value)) return value.map(plain);
  if (typeof value === 'object') {
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) return 'serverTimestamp';
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, plain(v)]));
  }
  return value;
}

export function createFakeChatSource(fake: FakeChat, uid: string): ChatSource {
  fake.writes ??= [];
  fake.listened ??= [];
  fake.failures ??= {};
  fake.listenerErrors ??= {};
  for (const id of ['general', 'participants'] as const) {
    const seeded: Partial<FakeChatRoom> = fake.rooms[id] ?? {};
    fake.rooms[id] = { messages: [], reactions: [], receipts: [], typing: [], unread: 0, seen: true, ...seeded };
  }

  // ── listeners ──────────────────────────────────────────────────────────
  type Listener = { path: string; onChange: () => void; onError: (code: string) => void };
  const listeners = new Set<Listener>();
  const listen = (path: string, onChange: () => void, onError: (code: string) => void): (() => void) => {
    fake.listened.push(path);
    const l = { path, onChange, onError };
    listeners.add(l);
    const code = fake.listenerErrors[path];
    defer(() => {
      if (!listeners.has(l)) return;
      if (code) onError(code);
      else onChange();
    });
    return () => void listeners.delete(l);
  };
  const notify = (prefix: string) => {
    defer(() => {
      for (const l of [...listeners]) if (l.path.startsWith(prefix) || prefix.startsWith(l.path)) l.onChange();
    });
  };

  fake.push = (roomId, patch) => {
    const room = fake.rooms[roomId];
    Object.assign(room, patch);
    notify(`competitions/`);
  };
  fake.setMeta = meta => {
    fake.meta = meta;
    notify('competitions/');
  };
  fake.fail = (path, code = 'permission-denied') => {
    for (const l of [...listeners]) if (l.path.startsWith(path)) l.onError(code);
  };

  // ── writes ─────────────────────────────────────────────────────────────
  const failureFor = (path: string, data?: Record<string, unknown>): FakeChatFailure | null => {
    for (const [prefix, failure] of Object.entries(fake.failures)) {
      if (!path.startsWith(prefix)) continue;
      if (failure.ifField && !(data && failure.ifField in data)) continue;
      if (failure.times !== undefined) {
        if (failure.times <= 0) continue;
        failure.times -= 1;
      }
      return failure;
    }
    return null;
  };
  /** Records the write, then rejects with the injected failure (the attempt is on the record too). */
  const write = async (op: 'set' | 'update' | 'delete' | 'upload', path: string, data?: Record<string, unknown>) => {
    fake.writes.push({ op, path, data: data ? (plain(data) as Record<string, unknown>) : undefined, at: Date.now() });
    const failure = failureFor(path, data);
    if (failure) throw error(failure.code);
  };

  const roomOfPath = (path: string): { competitionId: string; roomId: RoomId } | null => {
    const m = /^competitions\/([^/]+)\/chats\/(general|participants)\//.exec(path);
    return m ? { competitionId: m[1], roomId: m[2] as RoomId } : null;
  };

  // The signed-in Firebase user is always this profile in the fake (fake.auth 'fail' → ensure false).
  const ctx = {
    db: {},
    chatDb: {},
    auth: { currentUser: { uid }, authStateReady: async () => {} },
  } as unknown as RealtimeContext;
  const ensure = async () => fake.auth !== 'fail';

  // ── room messages ──────────────────────────────────────────────────────
  const latest = (roomId: RoomId) => {
    const docs = newestFirst(fake.rooms[roomId]).slice(0, CHAT_PAGE_SIZE);
    return { messages: docs.map(toMessage), lastDoc: docs.length ? cursorOf(docs.length) : null, docCount: docs.length };
  };
  const olderPage = (roomId: RoomId, cursor: ChatCursor) => {
    const all = newestFirst(fake.rooms[roomId]);
    const start = offsetOf(cursor);
    const docs = all.slice(start, start + CHAT_PAGE_SIZE);
    return { messages: docs.map(toMessage), lastDoc: docs.length ? cursorOf(start + docs.length) : cursor, hasMore: docs.length === CHAT_PAGE_SIZE };
  };

  const source: ChatSource = {
    kind: 'fake',
    pure: corePure,
    ensure,
    subscribeRoom(room, { getCache, onCache, onError }) {
      let cancelled = false;
      let unsub: (() => void) | undefined;
      void ensure().then(ok => {
        if (cancelled) return;
        if (!ok) return onError(error('unauthenticated'), 'auth');
        let first = true;
        unsub = listen(
          chatMessagesPath(room.competitionId, room.roomId),
          () => {
            const snap = latest(room.roomId);
            onCache(applyLatestSnapshot(getCache(), { ...snap, fromCache: first ? (fake.fromCache ?? false) : false }));
            first = false;
          },
          code => onError(error(code), 'load'),
        );
      });
      return () => {
        cancelled = true;
        unsub?.();
      };
    },
    async loadMore(room, cache) {
      if (!cache.lastDoc || !cache.hasMore) return cache;
      return appendOlderPage(cache, olderPage(room.roomId, cache.lastDoc));
    },
    async loadUntil(room, cache, messageId, onPage) {
      let current = cache;
      const ids = new Set([...cache.messages, ...cache.olderMessages].map(m => m.id));
      while (current.lastDoc && current.hasMore && !ids.has(messageId)) {
        const page = olderPage(room.roomId, current.lastDoc);
        page.messages.forEach(m => ids.add(m.id));
        current = appendOlderPage(current, page);
        onPage?.(current);
      }
      return { cache: current, found: ids.has(messageId) };
    },
    async loadUnreadBoundary(room, cache, unreadAfterMs, isCancelled) {
      let cursor = cache.lastDoc;
      let hasMore = cache.hasMore;
      const fetched: ChatListMessage[] = [];
      while (cursor && hasMore && !isCancelled() && !hasLoadedUnreadBoundary([...cache.messages, ...cache.olderMessages, ...fetched], unreadAfterMs)) {
        const page = olderPage(room.roomId, cursor);
        fetched.push(...page.messages);
        cursor = page.lastDoc;
        hasMore = page.hasMore;
      }
      if (isCancelled()) return null;
      return appendOlderPage(cache, { messages: fetched, lastDoc: cursor, hasMore }, true);
    },

    // ── receipts / reactions ─────────────────────────────────────────────
    subscribeReceipts(room, onData) {
      let frozen: Timestamp | null | undefined;
      const read = (): ChatReadReceipt[] =>
        fake.rooms[room.roomId].receipts.map(r => ({
          id: r.userId,
          userId: r.userId,
          userName: r.userName ?? '',
          lastReadMessageId: r.lastReadMessageId ?? '',
          lastReadAt: ts(r.lastReadAt) as Timestamp,
          updatedAt: (ts(r.updatedAt) ?? ts(r.lastReadAt)) as Timestamp,
        }));
      return listen(
        chatReceiptsPath(room.competitionId, room.roomId),
        () => {
          const receipts = read();
          if (frozen === undefined) frozen = receipts.find(r => r.userId === room.currentUserId)?.lastReadAt ?? null;
          onData({ receipts, unreadAfter: frozen });
        },
        () => onData({ receipts: [], unreadAfter: null }),
      );
    },
    createReadMarker({ competitionId, roomId, userName, isLocked }) {
      let last = 0;
      return message => {
        const time = message.createdAt?.toMillis?.() ?? 0;
        if (!competitionId || !userName || isLocked || message.pending || !time || time <= last) return;
        last = time;
        const path = chatReceiptUserPath(competitionId, roomId, uid);
        void write('set', path, { userId: uid, userName, lastReadMessageId: message.id, lastReadAt: 'serverTimestamp', updatedAt: 'serverTimestamp' })
          .then(() => {
            const room = fake.rooms[roomId];
            const now = Date.now();
            room.receipts = [...room.receipts.filter(r => r.userId !== uid), { userId: uid, userName, lastReadMessageId: message.id, lastReadAt: now, updatedAt: now }];
            // The room's own unread count follows the receipt (core recounts on the receipt listener).
            room.unread = 0;
            room.seen = true;
            notify('competitions/');
          })
          .catch(() => {});
      };
    },
    subscribeReactions(room, onData) {
      const read = (): ChatReaction[] =>
        fake.rooms[room.roomId].reactions.map(r => ({
          id: `${r.messageId}_${r.userId}`,
          messageId: r.messageId,
          userId: r.userId,
          userName: r.userName,
          emoji: r.emoji,
          updatedAt: (ts(r.updatedAt) ?? Timestamp.fromMillis(0)) as Timestamp,
        }));
      return listen(chatReactionsPath(room.competitionId, room.roomId), () => onData(read()), () => onData([]));
    },
    async toggleReaction({ competitionId, roomId, messageId, emoji, currentUserId, userName, reactions, readOnly = false }) {
      if (!competitionId || !userName || !currentUserId || readOnly) return;
      const path = chatReactionUserPath(competitionId, roomId, messageId, currentUserId);
      const existing = reactions.find(r => r.messageId === messageId && r.userId === currentUserId);
      const room = fake.rooms[roomId];
      if (existing?.emoji === emoji) {
        await write('delete', path);
        room.reactions = room.reactions.filter(r => !(r.messageId === messageId && r.userId === currentUserId));
      } else {
        await write('set', path, { messageId, userId: currentUserId, userName, emoji, updatedAt: 'serverTimestamp' });
        room.reactions = [...room.reactions.filter(r => !(r.messageId === messageId && r.userId === currentUserId)), { messageId, userId: currentUserId, userName, emoji, updatedAt: Date.now() }];
      }
      notify(chatReactionsPath(competitionId, roomId));
    },

    // ── typing ───────────────────────────────────────────────────────────
    subscribeTypingNames(room, onNames) {
      // core subscribeTypingNames' timing: shown at once, held TYPING_MIN_VISIBLE_MS, cleared after TYPING_STALE_MS.
      let shownAt = 0;
      let hold: ReturnType<typeof setTimeout> | null = null;
      let stale: ReturnType<typeof setTimeout> | null = null;
      const clear = () => {
        shownAt = 0;
        onNames([]);
      };
      const stamped = new WeakMap<object, number>();
      const unsub = listen(
        chatTypingPath(room.competitionId, room.roomId),
        () => {
          const t = Date.now();
          const docs = fake.rooms[room.roomId].typing.map(d => {
            if (d.updatedAt === undefined && !stamped.has(d)) stamped.set(d, t);
            return { ...d, updatedAt: Timestamp.fromMillis(d.updatedAt !== undefined ? toMs(d.updatedAt) : (stamped.get(d) ?? t)) };
          });
          const names = typingNamesOf(docs, room.currentUserId, t);
          if (hold) clearTimeout(hold);
          if (names.length) {
            shownAt = shownAt || t;
            onNames(names);
          } else {
            const left = shownAt ? TYPING_MIN_VISIBLE_MS - (t - shownAt) : 0;
            if (left > 0) hold = setTimeout(clear, left);
            else clear();
          }
          if (stale) clearTimeout(stale);
          if (names.length) stale = setTimeout(clear, TYPING_STALE_MS);
        },
        () => onNames([]),
      );
      return () => {
        if (hold) clearTimeout(hold);
        if (stale) clearTimeout(stale);
        unsub();
      };
    },
    createTypingWriter({ competitionId, roomId, userName, isLocked }) {
      // core createTypingWriter's rule, writing to the fake: at most every 2.5 s, cleared after 5 s idle.
      let idle: ReturnType<typeof setTimeout> | null = null;
      let lastWrite = 0;
      const put = (isTyping: boolean) => {
        if (!competitionId || !userName || isLocked) return;
        void write('set', chatTypingUserPath(competitionId, roomId, uid), { userId: uid, userName, isTyping, updatedAt: 'serverTimestamp' }).catch(() => {});
      };
      const clearIdle = () => {
        if (idle) clearTimeout(idle);
        idle = null;
      };
      return {
        onTypingChange(isTyping) {
          clearIdle();
          if (!isTyping) {
            lastWrite = 0;
            put(false);
            return;
          }
          const t = Date.now();
          if (t - lastWrite > 2500) {
            lastWrite = t;
            put(true);
          }
          idle = setTimeout(() => {
            lastWrite = 0;
            put(false);
          }, TYPING_IDLE_MS);
        },
        dispose() {
          clearIdle();
          put(false);
        },
      };
    },

    // ── meta, consent ────────────────────────────────────────────────────
    subscribeMeta(competitionId, onMeta) {
      let cancelled = false;
      let unsub: (() => void) | undefined;
      void ensure().then(ok => {
        if (cancelled) return;
        if (!ok) return onMeta(null, true);
        unsub = listen(
          chatMetaPath(competitionId),
          () => {
            const meta = fake.meta;
            if (meta === 'unreadable') return onMeta(null, true);
            onMeta(meta ? { closesAtMs: toMs(meta.closesAt), reason: meta.reason ?? 'completed' } : null, true);
          },
          () => onMeta(null, true),
        );
      });
      return () => {
        cancelled = true;
        unsub?.();
      };
    },
    async needsRules() {
      if (!(await ensure())) return false;
      return fake.consent === 'absent';
    },
    async acknowledgeRules() {
      await write('set', chatRulesConsentPath(uid), { acceptedAt: 'serverTimestamp' });
      fake.consent = 'present';
    },

    // ── unread / badge ───────────────────────────────────────────────────
    subscribeRoomUnread(room, onCount) {
      return listen(
        `${chatMessagesPath(room.competitionId, room.roomId)}#unread`,
        () => onCount(Math.min(fake.rooms[room.roomId].unread, UNREAD_BADGE_CAP + 1)),
        () => onCount(0),
      );
    },
    subscribeBadge({ competitionId, isMember }, onBadge) {
      let cancelled = false;
      let unsub: (() => void) | undefined;
      void ensure().then(ok => {
        if (cancelled || !ok) return;
        unsub = listen(
          `competitions/${competitionId}/chats#badge`,
          () => {
            const g = fake.rooms.general;
            const p = fake.rooms.participants;
            const counts = { general: Math.min(g.unread, UNREAD_BADGE_CAP + 1), participants: isMember ? Math.min(p.unread, UNREAD_BADGE_CAP + 1) : 0 };
            onBadge(chatBadgeOf(counts, { general: g.seen, participants: isMember ? p.seen : false }));
          },
          () => onBadge(null),
        );
      });
      return () => {
        cancelled = true;
        unsub?.();
      };
    },

    // ── sends, edits, deletes ────────────────────────────────────────────
    newMessageId: () => `fake-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    createOutbox({ storage, uploader, apiBase, releaseFiles }) {
      return createOutboxWorker({
        ctx,
        storage,
        apiBase,
        releaseFiles,
        // Recorded before the page's own /upload call (route-mocked by the spec).
        uploader: async attachment => {
          await write('upload', '/upload', { name: attachment.name, mime: attachment.mime, messageId: attachment.messageId });
          return uploader(attachment);
        },
        // No token in the fake: the worker's re-sign-in is a no-op and the uid stays this profile.
        getCustomToken: async () => null,
        isOffline: () => navigator.onLine === false,
        io: {
          async readClosesAtMs() {
            const meta = fake.meta;
            if (meta === 'unreadable') throw error('permission-denied');
            return meta ? toMs(meta.closesAt) : null;
          },
          async exists(path) {
            const where = roomOfPath(path);
            const id = path.split('/').pop();
            return !!where && fake.rooms[where.roomId].messages.some(m => m.id === id && m.createdAt !== null);
          },
          async write(path, payload) {
            await write('set', path, payload);
            const where = roomOfPath(path);
            if (!where) return;
            const p = payload as Partial<FakeChatMessageDoc>;
            const room = fake.rooms[where.roomId];
            const id = path.split('/').pop() as string;
            room.messages = [
              ...room.messages.filter(m => m.id !== id),
              {
                id,
                senderId: p.senderId as string,
                senderName: p.senderName as string,
                senderAvatar: p.senderAvatar ?? null,
                text: p.text ?? '',
                createdAt: Date.now(),
                type: 'text',
                senderRole: p.senderRole,
                attachments: p.attachments,
                replyTo: p.replyTo,
              },
            ];
            notify(chatMessagesPath(where.competitionId, where.roomId));
          },
        },
      });
    },
    async editMessage({ competitionId, roomId, messageId, text }) {
      const path = chatMessagePath(competitionId, roomId, messageId);
      await write('update', path, { text, editedAt: 'serverTimestamp' });
      const room = fake.rooms[roomId];
      room.messages = room.messages.map(m => (m.id === messageId ? { ...m, text, editedAt: Date.now() } : m));
      notify(chatMessagesPath(competitionId, roomId));
    },
    async deleteMessage({ competitionId, roomId, message, canDeleteAnyMessage }) {
      if (!competitionId || !canDeleteChatMessage(message, uid, canDeleteAnyMessage)) return false;
      const path = chatMessagePath(competitionId, roomId, message.id);
      await write('update', path, { deletedAt: 'serverTimestamp', deletedBy: uid, text: '' });
      const room = fake.rooms[roomId];
      room.messages = room.messages.map(m => (m.id === message.id ? { ...m, text: '', deletedAt: Date.now(), deletedBy: uid } : m));
      notify(chatMessagesPath(competitionId, roomId));
      return true;
    },
  };
  return source;
}

export type { RoomRef, ChatRoomCache };
