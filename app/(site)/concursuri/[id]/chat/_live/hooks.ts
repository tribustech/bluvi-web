'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Timestamp } from 'firebase/firestore';
import {
  competitionNotificationPreferencesQuery,
  mutedTypesOf,
  toggleType,
  updateCompetitionNotificationPreferencesMutation,
} from '@/core/competitions';
import type { chat } from '@/core/realtime';
// Pure modules (no Firestore SDK): safe in the route's first chunk.
import { closingTimerDelayMs, resolveChatClosing, type ChatMeta } from '@/core/realtime/chat/domain';
import { hasLoadedUnreadBoundary, hasLoadedUnreadIncomingMessage } from '@/core/realtime/chat/transforms';
import { parseUploadResponse, UploadError } from '@/core/realtime/chat/outbox/uploader';
import { appHeaders } from '@/core/transport';
import { useSiteToast } from '@/app/(site)/_shell/Toast';
import { pageTransport } from '../../_components/transport';
import { outboxStorage } from './outboxStorage';
import { chatAvailable, loadChatSource, type ChatOutbox, type ChatSource, type RoomId, type RoomRef } from './source';

/*
 * The chat's React layer over the ChatSource seam (./source.ts) — fish features/chat/hooks, one
 * hook each: useChatRoom (+ the per-room cache), useReactions, useReceipts, useTypingNames,
 * useTypingWriter, useChatStatus, useRulesConsent, useRoomUnread, useChatBadge, useChatPrefs and
 * the outbox (usePageOutbox / useOutboxRows / sendMessage). Errors become fish's toasts here
 * (useSiteToast), the copy from core.
 *
 * Nothing here imports a module that loads the Firestore SDK: the source arrives after hydration
 * (loadChatSource), with core's SDK-sharing pure helpers on `source.pure`.
 */

type ChatRoomCache = chat.ChatRoomCache;
type ChatListMessage = chat.ChatListMessage;

const EMPTY_CACHE: ChatRoomCache = {
  messages: [],
  olderMessages: [],
  lastDoc: null,
  hasMore: true,
  isLoaded: false,
  cursorConfirmed: false,
};

/** core CHAT_ROOM_ERRORS.load, for the one case the source itself never arrived (its chunk failed). */
const LOAD_FAILED = 'Nu am putut încărca chat-ul. Te rugăm să încerci din nou.';

/* ------------------------------------------------------------------ */
/* Source                                                              */
/* ------------------------------------------------------------------ */

/**
 * The ChatSource for the signed-in profile, once its chunk is in (null before, and when the chat
 * cannot run in this build: no Firebase config and no e2e fake). A chunk that failed shows fish's
 * load toast once.
 */
export function useChatSource(uid: string | null): ChatSource | null {
  const [source, setSource] = useState<{ uid: string; source: ChatSource } | null>(null);
  const toast = useSiteToast();
  useEffect(() => {
    if (!uid || !chatAvailable()) return;
    let alive = true;
    const load = () =>
      loadChatSource(uid).then(
        s => {
          if (!alive) return;
          window.removeEventListener('online', load);
          setSource({ uid, source: s });
        },
        () => {
          if (!alive) return;
          toast(LOAD_FAILED, 'danger');
          // The chunk did not arrive (offline): try again when the network is back.
          window.addEventListener('online', load, { once: true });
        },
      );
    void load();
    return () => {
      alive = false;
      window.removeEventListener('online', load);
    };
  }, [uid, toast]);
  return source && source.uid === uid ? source.source : null;
}

/* ------------------------------------------------------------------ */
/* Room                                                                */
/* ------------------------------------------------------------------ */

/**
 * The per-room caches (fish roomCacheRef): kept for the life of the page, keyed by competition and
 * room, so a room switch restores the list instantly instead of re-reading it.
 */
export function useRoomCache() {
  const caches = useRef(new Map<string, ChatRoomCache>());
  return useMemo(
    () => ({
      get: (room: RoomRef) => caches.current.get(`${room.competitionId}:${room.roomId}`) ?? EMPTY_CACHE,
      set: (room: RoomRef, cache: ChatRoomCache) => void caches.current.set(`${room.competitionId}:${room.roomId}`, cache),
    }),
    [],
  );
}
export type RoomCacheStore = ReturnType<typeof useRoomCache>;

export type ChatRoomState = {
  /** Newest first: pending outbox bubbles, then live + older pages, with reactions and receipt ticks. */
  messages: ChatListMessage[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  /** The «Mesaje noi» divider can be placed (c34). */
  unreadBoundaryLoaded: boolean;
  loadMore: () => Promise<void>;
  /** Reply jump (c19): pages back until the message is loaded, then asks the list to scroll to it. */
  jumpToMessage: (messageId: string) => Promise<void>;
  scrollToMessageId: string | null;
  onScrollToMessageHandled: () => void;
};

/**
 * fish useChatRoom: the newest 50 live, older pages on demand, the unread-boundary backfill, the
 * reply jump, merged with the outbox rows, reactions and receipts.
 */
export function useChatRoom({
  source,
  store,
  room,
  currentUserId,
  isLocked,
  reactions,
  receipts,
  unreadAfter,
  pendingMessages,
}: {
  source: ChatSource | null;
  store: RoomCacheStore;
  room: RoomRef;
  currentUserId: string;
  isLocked: boolean;
  reactions: chat.ChatReaction[];
  receipts: chat.ChatReadReceipt[];
  unreadAfter: Timestamp | null;
  pendingMessages: ChatListMessage[];
}): ChatRoomState {
  const toast = useSiteToast();
  const { competitionId, roomId } = room;
  const roomRef = useMemo(() => ({ competitionId, roomId }), [competitionId, roomId]);
  const [cache, setCacheState] = useState<{ key: string; cache: ChatRoomCache }>(() => ({ key: `${competitionId}:${roomId}`, cache: store.get(roomRef) }));
  const key = `${competitionId}:${roomId}`;
  // A room / competition change reads the target's own cache at once (never a frame of the other).
  const current = cache.key === key ? cache.cache : store.get(roomRef);
  const setCache = useCallback(
    (next: ChatRoomCache) => {
      store.set(roomRef, next);
      setCacheState({ key: `${roomRef.competitionId}:${roomRef.roomId}`, cache: next });
    },
    [store, roomRef],
  );
  // The room whose listener failed (c42): it stops «loading» (the toast says why).
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const errored = failedKey === key;

  useEffect(() => {
    if (!source || isLocked) return;
    return source.subscribeRoom(roomRef, {
      getCache: () => store.get(roomRef),
      onCache: next => setCache(next),
      onError: (_error, kind) => {
        setFailedKey(`${roomRef.competitionId}:${roomRef.roomId}`);
        toast(source.pure.CHAT_ROOM_ERRORS[kind], 'danger');
      },
    });
  }, [source, isLocked, roomRef, store, setCache, toast]);

  // fish's unread-boundary backfill: unread history that starts before the loaded window.
  const unreadAfterMs = unreadAfter?.toMillis?.() ?? 0;
  const backfilling = useRef(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  useEffect(() => {
    if (!source || isLocked || !current.isLoaded || isLoadingMore || backfilling.current) return;
    if (!source.pure.needsUnreadBoundaryBackfill(current, unreadAfterMs, currentUserId)) return;
    let cancelled = false;
    backfilling.current = true;
    source
      .loadUnreadBoundary(roomRef, current, unreadAfterMs, () => cancelled)
      .then(next => {
        if (next && !cancelled) setCache(next);
      })
      .catch(() => !cancelled && toast(source.pure.CHAT_ROOM_ERRORS.unreadBoundary, 'danger'))
      .finally(() => {
        backfilling.current = false;
      });
    return () => {
      cancelled = true;
      backfilling.current = false;
    };
  }, [source, isLocked, current, unreadAfterMs, currentUserId, isLoadingMore, roomRef, setCache, toast]);

  const loadMore = useCallback(async () => {
    const latest = store.get(roomRef);
    if (!source || isLocked || isLoadingMore || backfilling.current || !latest.lastDoc || !latest.hasMore) return;
    setIsLoadingMore(true);
    try {
      setCache(await source.loadMore(roomRef, latest));
    } catch {
      toast(source.pure.CHAT_ROOM_ERRORS.older, 'danger');
    } finally {
      setIsLoadingMore(false);
    }
  }, [source, isLocked, isLoadingMore, roomRef, store, setCache, toast]);

  const [scrollToMessageId, setScrollToMessageId] = useState<string | null>(null);
  const jumping = useRef(false);
  const jumpToMessage = useCallback(
    async (messageId: string) => {
      if (!source || isLocked) return;
      const latest = store.get(roomRef);
      if ([...latest.messages, ...latest.olderMessages].some(m => m.id === messageId)) {
        setScrollToMessageId(messageId);
        return;
      }
      if (jumping.current) return;
      jumping.current = true;
      try {
        const { cache: next, found } = await source.loadUntil(roomRef, latest, messageId, setCache);
        setCache(next);
        if (found) setScrollToMessageId(messageId);
        else toast(source.pure.CHAT_ROOM_ERRORS.replyNotFound, 'danger');
      } catch {
        toast(source.pure.CHAT_ROOM_ERRORS.replyLoad, 'danger');
      } finally {
        jumping.current = false;
      }
    },
    [source, isLocked, roomRef, store, setCache, toast],
  );

  const messages = useMemo(
    () =>
      source
        ? source.pure.mergeDisplayedMessages({
            messages: current.messages,
            olderMessages: current.olderMessages,
            pendingMessages,
            reactions,
            receipts,
            currentUserId,
          })
        : pendingMessages,
    [source, current.messages, current.olderMessages, pendingMessages, reactions, receipts, currentUserId],
  );

  const unreadBoundaryLoaded = useMemo(() => {
    if (!unreadAfterMs) return false;
    const loaded = [...current.messages, ...current.olderMessages];
    if (!hasLoadedUnreadIncomingMessage(loaded, unreadAfterMs, currentUserId)) return false;
    return hasLoadedUnreadBoundary(loaded, unreadAfterMs) || !current.hasMore;
  }, [current, unreadAfterMs, currentUserId]);

  return {
    messages,
    // Loading until the first snapshot (or a failure); a locked room has nothing to load.
    isLoading: !isLocked && !current.isLoaded && !errored && current.messages.length === 0,
    isLoadingMore,
    hasMore: current.hasMore,
    unreadBoundaryLoaded,
    loadMore,
    jumpToMessage,
    scrollToMessageId,
    onScrollToMessageHandled: useCallback(() => setScrollToMessageId(null), []),
  };
}

/** Everything one room needs to render and stay live (fish useChatRoomBundle). */
export type RoomBundle = {
  room: ChatRoomState;
  reactions: chat.ChatReaction[];
  toggleReaction: (messageId: string, emoji: string) => Promise<void>;
  receipts: chat.ChatReadReceipt[];
  unreadAfter: Timestamp | null;
  /** Advances my receipt (only for the room on screen while the page is visible — the caller's rule). */
  markRead: (message: ChatListMessage) => void;
};

/**
 * fish useChatRoomBundle: the page mounts one per room, so a room switch is instant; a room the
 * viewer cannot read (`isLocked`) keeps every listener idle.
 */
export function useRoomBundle({
  source,
  store,
  outbox,
  competitionId,
  roomId,
  currentUserId,
  userName,
  isLocked,
  readOnly,
}: {
  source: ChatSource | null;
  store: RoomCacheStore;
  outbox: ChatOutbox | null;
  competitionId: string;
  roomId: RoomId;
  currentUserId: string;
  userName: string;
  isLocked: boolean;
  /** A closed chat: reactions still show, none can be added. */
  readOnly: boolean;
}): RoomBundle {
  const room = useMemo(() => ({ competitionId, roomId }), [competitionId, roomId]);
  const reactionState = useReactions({ source, room, currentUserId, userName, isLocked, readOnly });
  const receiptState = useReceipts({ source, room, currentUserId, userName, isLocked });
  const pending = useOutboxRows(outbox, room, currentUserId);
  const roomState = useChatRoom({
    source,
    store,
    room,
    currentUserId,
    isLocked,
    reactions: reactionState.reactions,
    receipts: receiptState.receipts,
    unreadAfter: receiptState.unreadAfter,
    pendingMessages: pending,
  });
  return {
    room: roomState,
    reactions: reactionState.reactions,
    toggleReaction: reactionState.toggle,
    receipts: receiptState.receipts,
    unreadAfter: receiptState.unreadAfter,
    markRead: receiptState.markRead,
  };
}

/* ------------------------------------------------------------------ */
/* Receipts, reactions                                                 */
/* ------------------------------------------------------------------ */

/** fish useChatReceipts: the room's receipts, my frozen boundary, and markRead (advances my receipt). */
export function useReceipts({
  source,
  room,
  currentUserId,
  userName,
  isLocked,
}: {
  source: ChatSource | null;
  room: RoomRef;
  currentUserId: string;
  userName: string;
  isLocked: boolean;
}) {
  const { competitionId, roomId } = room;
  const [state, setState] = useState<{ key: string; receipts: chat.ChatReadReceipt[]; unreadAfter: Timestamp | null }>({
    key: '',
    receipts: [],
    unreadAfter: null,
  });
  const key = `${competitionId}:${roomId}:${isLocked}`;
  useEffect(() => {
    if (!source || isLocked) return;
    return source.subscribeReceipts({ competitionId, roomId, currentUserId }, s => setState({ key, ...s }));
  }, [source, competitionId, roomId, currentUserId, isLocked, key]);
  const markRead = useMemo(
    () => (source ? source.createReadMarker({ competitionId, roomId, userName, isLocked }) : () => {}),
    [source, competitionId, roomId, userName, isLocked],
  );
  const live = state.key === key;
  return { receipts: live ? state.receipts : NONE_RECEIPTS, unreadAfter: live ? state.unreadAfter : null, markRead };
}
const NONE_RECEIPTS: chat.ChatReadReceipt[] = [];
const NONE_REACTIONS: chat.ChatReaction[] = [];

/** fish useChatReactions: the subscription survives a closed chat (`readOnly` only blocks toggling). */
export function useReactions({
  source,
  room,
  currentUserId,
  userName,
  isLocked,
  readOnly,
}: {
  source: ChatSource | null;
  room: RoomRef;
  currentUserId: string;
  userName: string;
  isLocked: boolean;
  readOnly: boolean;
}) {
  const toast = useSiteToast();
  const { competitionId, roomId } = room;
  const [state, setState] = useState<{ key: string; reactions: chat.ChatReaction[] }>({ key: '', reactions: [] });
  const key = `${competitionId}:${roomId}:${isLocked}`;
  useEffect(() => {
    if (!source || isLocked) return;
    return source.subscribeReactions({ competitionId, roomId }, reactions => setState({ key, reactions }));
  }, [source, competitionId, roomId, isLocked, key]);
  const reactions = state.key === key ? state.reactions : NONE_REACTIONS;
  const toggle = useCallback(
    async (messageId: string, emoji: string) => {
      if (!source) return;
      try {
        await source.toggleReaction({ competitionId, roomId, messageId, emoji, currentUserId, userName, reactions, readOnly });
      } catch {
        toast(source.pure.REACTION_ERROR, 'danger');
      }
    },
    [source, competitionId, roomId, currentUserId, userName, reactions, readOnly, toast],
  );
  return { reactions, toggle };
}

/* ------------------------------------------------------------------ */
/* Typing                                                              */
/* ------------------------------------------------------------------ */

/** fish useChatTyping (read side): «{A} scrie...» for the room on screen, or null. */
export function useTypingNames({ source, room, currentUserId, isLocked }: { source: ChatSource | null; room: RoomRef; currentUserId: string; isLocked: boolean }) {
  const { competitionId, roomId } = room;
  const [state, setState] = useState<{ key: string; names: string[] }>({ key: '', names: [] });
  const key = `${competitionId}:${roomId}`;
  useEffect(() => {
    if (!source || isLocked) return;
    return source.subscribeTypingNames({ competitionId, roomId, currentUserId }, names => setState({ key, names }));
  }, [source, competitionId, roomId, currentUserId, isLocked, key]);
  const names = state.key === key && !isLocked ? state.names : [];
  return source ? source.pure.typingLabel(names) : null;
}

/** fish useChatTyping (write side): marks me typing in the room on screen; cleared on room change / leave. */
export function useTypingWriter({ source, room, userName, isLocked }: { source: ChatSource | null; room: RoomRef; userName: string; isLocked: boolean }) {
  const { competitionId, roomId } = room;
  const writer = useMemo(
    () => (source && !isLocked ? source.createTypingWriter({ competitionId, roomId, userName, isLocked }) : null),
    [source, competitionId, roomId, userName, isLocked],
  );
  useEffect(() => () => writer?.dispose(), [writer]);
  return useCallback((isTyping: boolean) => writer?.onTypingChange(isTyping), [writer]);
}

/* ------------------------------------------------------------------ */
/* Closing, rules                                                      */
/* ------------------------------------------------------------------ */

/**
 * fish useChatStatus (c40): the meta doc decides; without one, cancelled = closed and completed =
 * closed a day after its end. Flips live at closesAt (one timer). Unknown (not loaded) = open.
 */
export function useChatStatus({
  source,
  competitionId,
  competitionStatus,
  endDate,
}: {
  source: ChatSource | null;
  competitionId: string;
  competitionStatus?: string | null;
  endDate?: string | null;
}): { isClosed: boolean; closesAtMs: number | null } {
  const [meta, setMeta] = useState<{ key: string; meta: ChatMeta; loaded: boolean }>({ key: '', meta: null, loaded: false });
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!source) return;
    return source.subscribeMeta(competitionId, (m, loaded) => {
      setMeta({ key: competitionId, meta: m, loaded });
      setNowMs(Date.now());
    });
  }, [source, competitionId]);
  const current = meta.key === competitionId ? meta : { meta: null, loaded: false };
  const resolved = useMemo(
    () => resolveChatClosing({ meta: current.meta, metaLoaded: current.loaded, competitionStatus, endDate, nowMs }),
    [current.meta, current.loaded, competitionStatus, endDate, nowMs],
  );
  useEffect(() => {
    const delay = closingTimerDelayMs(resolved, Date.now());
    if (delay === null) return;
    const timer = setTimeout(() => setNowMs(Date.now()), delay);
    return () => clearTimeout(timer);
  }, [resolved]);
  return resolved;
}

/** fish useChatRulesConsent (c11): asked once per account; an unreadable doc asks nothing. */
export function useRulesConsent({ source, uid }: { source: ChatSource | null; uid: string }) {
  const toast = useSiteToast();
  const [pendingFor, setPendingFor] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!source) return;
    let cancelled = false;
    source.needsRules().then(
      needs => {
        if (!cancelled && needs) setPendingFor(uid);
      },
      () => {},
    );
    return () => {
      cancelled = true;
    };
  }, [source, uid]);
  const acknowledge = useCallback(async () => {
    if (!source || saving) return;
    setSaving(true);
    try {
      await source.acknowledgeRules();
      setPendingFor(null);
    } catch {
      toast(source.pure.RULES_CONSENT_ERROR, 'danger');
    } finally {
      setSaving(false);
    }
  }, [source, saving, toast]);
  return { needsAcknowledgement: pendingFor === uid, saving, acknowledge };
}

/* ------------------------------------------------------------------ */
/* Unread, badge                                                       */
/* ------------------------------------------------------------------ */

/** fish useRoomUnreadBadge: unread messages in a room (the one NOT on screen), 0 while disabled. */
export function useRoomUnread({ source, room, enabled }: { source: ChatSource | null; room: RoomRef; enabled: boolean }): number {
  const { competitionId, roomId } = room;
  const [state, setState] = useState<{ key: string; count: number }>({ key: '', count: 0 });
  const key = `${competitionId}:${roomId}`;
  useEffect(() => {
    if (!source || !enabled) return;
    return source.subscribeRoomUnread({ competitionId, roomId }, count => setState({ key, count }));
  }, [source, enabled, competitionId, roomId, key]);
  return enabled && state.key === key ? state.count : 0;
}

/**
 * fish useCompetitionChatBadge (participant.b.chat-badge): total unread across the readable rooms,
 * «Nou» when the chat was never opened, nothing at 0. The competition page's chat entry uses it;
 * the SDK is fetched after hydration (loadChatSource), never in that page's first chunk.
 */
export function useChatBadge(competitionId: string, uid: string | null, isMember: boolean): chat.ChatBadge {
  const source = useChatSource(uid);
  const [state, setState] = useState<{ key: string; badge: chat.ChatBadge }>({ key: '', badge: null });
  const key = `${competitionId}:${uid}:${isMember}`;
  useEffect(() => {
    if (!source) return;
    return source.subscribeBadge({ competitionId, isMember }, badge => setState({ key, badge }));
  }, [source, competitionId, isMember, key]);
  return source && state.key === key ? state.badge : null;
}

/* ------------------------------------------------------------------ */
/* Preferences (mute)                                                  */
/* ------------------------------------------------------------------ */

export const CHAT_ROOM_PREFERENCE_KEY: Record<RoomId, string> = {
  general: 'chat:message:general',
  participants: 'chat:message:participants',
};
export const CHAT_ROOM_LABELS: Record<RoomId, string> = { general: 'Chat general', participants: 'Chat participanți' };

/**
 * fish useChatPrefs (c9–c10): a room's mute is its key in the competition's notification
 * preferences (PUT mutedTypes), one source with the follow panel and Setări.
 */
export function useChatPrefs({ competitionId, roomId, enabled }: { competitionId: string; roomId: RoomId; enabled: boolean }) {
  const t = useMemo(() => pageTransport(), []);
  const qc = useQueryClient();
  const toast = useSiteToast();
  const { data, isPending } = useQuery(competitionNotificationPreferencesQuery(t, competitionId, enabled));
  const update = useMutation(updateCompetitionNotificationPreferencesMutation(t, qc, competitionId));
  const muted = useMemo(() => (data ? mutedTypesOf(data) : []), [data]);
  const mutedRooms = useMemo<Record<RoomId, boolean>>(
    () => ({ general: muted.includes(CHAT_ROOM_PREFERENCE_KEY.general), participants: muted.includes(CHAT_ROOM_PREFERENCE_KEY.participants) }),
    [muted],
  );
  const isMuted = mutedRooms[roomId];
  const toggle = useCallback(async () => {
    if (!competitionId || update.isPending) return;
    const nextMuted = !isMuted;
    try {
      await update.mutateAsync(toggleType(muted, CHAT_ROOM_PREFERENCE_KEY[roomId], !nextMuted));
      const room = CHAT_ROOM_LABELS[roomId];
      toast(nextMuted ? `Notificările pentru ${room} au fost oprite.` : `Notificările pentru ${room} au fost pornite.`, 'success');
    } catch {
      toast('Nu am putut salva preferința de notificări.', 'danger');
    }
  }, [competitionId, isMuted, muted, roomId, update, toast]);
  return { isMuted, mutedRooms, isLoaded: enabled && !isPending, isSaving: update.isPending, toggle };
}

/* ------------------------------------------------------------------ */
/* Outbox                                                              */
/* ------------------------------------------------------------------ */

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? '0.0.0';
const CMS_API = process.env.NEXT_PUBLIC_CMS_URL ?? '';

/** fish uploader: the photo's bytes to Strapi /upload (field `files`, status published), via the proxy. */
async function uploadAttachment(attachment: chat.OutboxAttachmentRow): Promise<chat.UploadedFile> {
  const blob = attachment.file;
  // A row restored from localStorage (no IndexedDB) lost its bytes: fatal, Reîncearcă cannot help.
  if (!(blob instanceof Blob)) throw new UploadError('Poza nu mai este disponibilă. Șterge mesajul și trimite-l din nou.', 413);
  const form = new FormData();
  form.append('files', blob, attachment.name || 'image.jpg');
  form.append('status', 'published');
  const res = await fetch('/api/cms/upload', { method: 'POST', body: form, credentials: 'same-origin', headers: appHeaders(APP_VERSION) });
  return parseUploadResponse(res.status, await res.text());
}

/** Object URLs the page made for queued photos (revoked once their row is gone). */
const objectUrls = new Map<string, string[]>();

const outboxes = new WeakMap<ChatSource, ChatOutbox>();

/**
 * One outbox worker per source per page (fish: one module worker). Rows restored from IndexedDB get
 * fresh object URLs for their photos (the old ones died with the previous page) before the first
 * drain. Drained now, when the network comes back and when the tab returns (global.b.chat-outbox).
 */
export function usePageOutbox(source: ChatSource | null, uid: string): ChatOutbox | null {
  const outbox = useMemo(() => {
    if (!source) return null;
    const existing = outboxes.get(source);
    if (existing) return existing;
    const created = source.createOutbox({
      storage: outboxStorage(),
      uploader: uploadAttachment,
      apiBase: CMS_API,
      releaseFiles: messageId => {
        const ids = messageId === null ? [...objectUrls.keys()] : [messageId];
        for (const id of ids) {
          for (const url of objectUrls.get(id) ?? []) URL.revokeObjectURL(url);
          objectUrls.delete(id);
        }
      },
    });
    outboxes.set(source, created);
    return created;
  }, [source]);

  useEffect(() => {
    if (!outbox) return;
    let alive = true;
    void (async () => {
      try {
        for (const entry of await outbox.repo.listAll()) {
          // Another account's rows (left by a sign-out that kept the browser's storage, a shared
          // computer): never sent as this viewer, never shown — dropped before the first drain
          // (fish discardAllOutbox on sign-out; the web's sign-out calls clearChatOutbox).
          if (entry.message.senderId !== uid) {
            await outbox.discard(entry.message.id);
            continue;
          }
          if (objectUrls.has(entry.message.id) || !entry.attachments.some(a => a.file instanceof Blob)) continue;
          const urls: string[] = [];
          const attachments = entry.attachments.map(a => {
            if (!(a.file instanceof Blob)) return a;
            const url = URL.createObjectURL(a.file);
            urls.push(url);
            return { ...a, localUri: url };
          });
          objectUrls.set(entry.message.id, urls);
          await outbox.repo.insert({ ...entry, attachments });
        }
      } catch {
        // Storage unreadable: the worker reports per row.
      }
      if (alive) outbox.run();
    })();
    const kick = () => outbox.run();
    const onVisible = () => document.visibilityState === 'visible' && outbox.run();
    window.addEventListener('online', kick);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      window.removeEventListener('online', kick);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [outbox, uid]);
  return outbox;
}

/** fish useOutbox: the room's queued / failed sends as pending bubbles (newest first). */
export function useOutboxRows(outbox: ChatOutbox | null, room: RoomRef, currentUserId: string): ChatListMessage[] {
  const { competitionId, roomId } = room;
  const [rows, setRows] = useState<{ key: string; rows: ChatListMessage[] }>({ key: '', rows: [] });
  const key = `${competitionId}:${roomId}`;
  useEffect(() => {
    if (!outbox) return;
    let alive = true;
    const read = () =>
      void outbox.roomMessages(competitionId, roomId, currentUserId).then(
        r => alive && setRows({ key, rows: r }),
        () => {},
      );
    read();
    const unsub = outbox.subscribe(read);
    return () => {
      alive = false;
      unsub();
    };
  }, [outbox, competitionId, roomId, currentUserId, key]);
  return rows.key === key ? rows.rows : NONE_MESSAGES;
}
const NONE_MESSAGES: ChatListMessage[] = [];

/** A photo the composer holds before sending (slice 3 fills it; the pipeline takes it as is). */
export type ComposerAttachment = { id: string; file: Blob; name: string; mime: string; width?: number; height?: number; previewUrl: string };

/**
 * The compression hook point (c30, fish compressChatPhoto): long edge ≤ 1280 px, JPEG 0.8, the
 * original kept when the re-encode would not be smaller. Returns the attachment unchanged when the
 * browser cannot decode it (the CMS then gets the original).
 */
export async function compressChatPhoto(a: ComposerAttachment): Promise<ComposerAttachment> {
  try {
    const bitmap = await createImageBitmap(a.file, { imageOrientation: 'from-image' });
    try {
      const long = Math.max(bitmap.width, bitmap.height);
      const k = long > 1280 ? 1280 / long : 1;
      const width = Math.round(bitmap.width * k);
      const height = Math.round(bitmap.height * k);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d')?.drawImage(bitmap, 0, 0, width, height);
      const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/jpeg', 0.8));
      if (!blob || blob.size >= a.file.size) return { ...a, width: a.width ?? bitmap.width, height: a.height ?? bitmap.height };
      return { ...a, file: blob, width, height, mime: 'image/jpeg', name: a.name.replace(/\.[^.]+$/, '') + '.jpg' };
    } finally {
      bitmap.close();
    }
  } catch {
    return a;
  }
}

/**
 * fish useChatSend (new message branch, c30): compress, store the row (the bubble shows at once),
 * kick the worker. Rejects when the row could not be stored — the caller restores the composer and
 * toasts CHAT_SEND_ERRORS.prepare.
 */
export async function enqueueMessage({
  source,
  outbox,
  room,
  sender,
  text,
  replyToMessage,
  senderRole,
  attachments,
}: {
  source: ChatSource;
  outbox: ChatOutbox;
  room: RoomRef;
  sender: { id: string; name: string; avatar: string | null };
  text: string;
  replyToMessage: ChatListMessage | null;
  senderRole?: chat.ChatSenderRole;
  attachments: ComposerAttachment[];
}): Promise<boolean> {
  const prepared = await Promise.all(attachments.map(compressChatPhoto));
  const messageId = source.newMessageId(room);
  const urls = prepared.map(a => URL.createObjectURL(a.file));
  objectUrls.set(messageId, urls);
  const entry = source.pure.buildOutboxEntry({
    ...room,
    messageId,
    senderId: sender.id,
    senderName: sender.name,
    senderAvatar: sender.avatar,
    text,
    replyToMessage,
    senderRole,
    attachments: prepared.map((a, i) => ({ id: a.id, localUri: urls[i], name: a.name, mime: a.mime, width: a.width ?? null, height: a.height ?? null, file: a.file })),
    nowMs: Date.now(),
  });
  try {
    return await source.pure.sendChatMessage(outbox, entry);
  } catch (e) {
    for (const url of urls) URL.revokeObjectURL(url);
    objectUrls.delete(messageId);
    throw e;
  }
}

/* ------------------------------------------------------------------ */
/* Misc                                                                */
/* ------------------------------------------------------------------ */

const subscribeVisibility = (cb: () => void) => {
  document.addEventListener('visibilitychange', cb);
  window.addEventListener('focus', cb);
  window.addEventListener('blur', cb);
  return () => {
    document.removeEventListener('visibilitychange', cb);
    window.removeEventListener('focus', cb);
    window.removeEventListener('blur', cb);
  };
};

/** fish useFocusEffect's «this screen is the focused one»: the tab is visible. */
export function usePageVisible(): boolean {
  return useSyncExternalStore(
    subscribeVisibility,
    () => document.visibilityState === 'visible',
    () => true,
  );
}
