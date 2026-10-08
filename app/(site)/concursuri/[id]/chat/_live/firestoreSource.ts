'use client';

import { chat, createChatAuth } from '@/core/realtime';
import { getCustomToken, getRealtimeContext } from '@/lib/client/firebase';
import { corePure } from './corePure';
import type { ChatSource } from './source';

/*
 * The real ChatSource: core/realtime/chat over the web's Firebase app (lib/client/firebase.ts),
 * signed in with the CMS-minted custom token (uid = the profile documentId, b.chat-realtime).
 * Loaded only by ./source.ts loadChatSource, after hydration, so the Firestore + Auth SDK is a
 * chunk of its own. Chat reads and writes go to the environment's chat database (`ctx.chatDb`,
 * core chatDatabaseId) — never the `(default)` Partide collections.
 */
export function createFirestoreChatSource(uid: string): ChatSource {
  const ctx = getRealtimeContext();
  const auth = createChatAuth(ctx, uid, getCustomToken);
  return {
    kind: 'firestore',
    pure: corePure,
    ensure: () => auth.ensure().catch(() => false),
    subscribeRoom: (room, handlers) => chat.subscribeChatRoom(ctx, auth, room, handlers),
    loadMore: (room, cache) => chat.loadMoreMessages(ctx, auth, room, cache),
    loadUntil: (room, cache, messageId, onPage) => chat.loadUntilMessage(ctx, auth, room, cache, messageId, onPage),
    loadUnreadBoundary: (room, cache, unreadAfterMs, isCancelled) => chat.loadUnreadBoundary(ctx, auth, room, cache, unreadAfterMs, isCancelled),
    subscribeReceipts: (room, onData) => {
      // The receipts rules need a signed-in user: listen once auth is there.
      let unsub: (() => void) | undefined;
      let cancelled = false;
      void auth
        .ensure()
        .catch(() => false)
        .then(ok => {
          if (cancelled) return;
          if (!ok) return onData({ receipts: [], unreadAfter: null });
          unsub = chat.subscribeReceipts(ctx, room, onData);
        });
      return () => {
        cancelled = true;
        unsub?.();
      };
    },
    createReadMarker: room => chat.createReadMarker(ctx, room),
    subscribeReactions: (room, onData) => {
      let unsub: (() => void) | undefined;
      let cancelled = false;
      void auth
        .ensure()
        .catch(() => false)
        .then(ok => {
          if (cancelled) return;
          if (!ok) return onData([]);
          unsub = chat.subscribeReactions(ctx, room, onData);
        });
      return () => {
        cancelled = true;
        unsub?.();
      };
    },
    toggleReaction: args => chat.toggleReaction(ctx, auth, args),
    subscribeTypingNames: (room, onNames) => {
      let unsub: (() => void) | undefined;
      let cancelled = false;
      void auth
        .ensure()
        .catch(() => false)
        .then(ok => {
          if (cancelled || !ok) return;
          unsub = chat.subscribeTypingNames(ctx, room, onNames);
        });
      return () => {
        cancelled = true;
        unsub?.();
      };
    },
    createTypingWriter: room => chat.createTypingWriter(ctx, room),
    subscribeMeta: (competitionId, onMeta) => chat.subscribeChatMeta(ctx, auth, competitionId, onMeta),
    needsRules: () => chat.needsRulesAcknowledgement(ctx, auth, uid),
    acknowledgeRules: () => chat.acknowledgeRules(ctx, uid),
    subscribeRoomUnread: (room, onCount) => {
      let unsub: (() => void) | undefined;
      let cancelled = false;
      void auth
        .ensure()
        .catch(() => false)
        .then(ok => {
          if (cancelled || !ok) return;
          unsub = chat.subscribeRoomUnreadCount(ctx, { ...room, uid }, onCount);
        });
      return () => {
        cancelled = true;
        unsub?.();
      };
    },
    subscribeBadge: (args, onBadge) => chat.subscribeCompetitionChatBadge(ctx, auth, { ...args, profileDocumentId: uid }, onBadge),
    newMessageId: room => chat.newChatMessageId(ctx, room),
    createOutbox: ({ storage, uploader, apiBase, releaseFiles }) =>
      chat.createOutboxWorker({
        ctx,
        storage,
        uploader,
        getCustomToken,
        apiBase,
        releaseFiles,
        isOffline: () => typeof navigator !== 'undefined' && navigator.onLine === false,
      }),
    editMessage: args => chat.editChatMessage(ctx, auth, args),
    deleteMessage: ({ message, canDeleteAnyMessage, ...room }) =>
      chat.deleteChatMessage(ctx, auth, { ...room, message, currentUserId: uid, canDeleteAnyMessage }),
  };
}
