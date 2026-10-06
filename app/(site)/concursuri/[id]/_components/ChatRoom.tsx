'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { PaperAirplaneIcon } from '@heroicons/react/24/outline';
import { chat, createChatAuth, type RealtimeContext, type ChatAuth } from '@/core/realtime';
import { Avatar } from '@/components/ui/Avatar';
import { buttonClass } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { TextInput } from '@/components/forms/TextInput';
import { getCustomToken, getRealtimeContext } from '@/lib/client/firebase';
import type { Viewer } from '@/lib/server/viewer';
import type { PanelProps } from './ChatPanel';

/*
 * The open General room (ChatPanel.tsx is the launcher, badge and frame): everything that touches
 * Firebase. Its own module, loaded only when a signed-in viewer opens the chat (ChatPanel's
 * `LiveRoom` is a next/dynamic import of this file): the Firestore + Auth SDK is ~200 KB of
 * compressed JavaScript, and in the competition page's main bundle it was downloaded before the
 * page's first paint on every visit (Lighthouse LCP), chat or no chat.
 */

/**
 * The send button: a filled icon-only control on the kit's primary spec (accent fill, on-accent
 * icon, shadow-button, radius control), as tall as the kit field beside it (44). TODO(kit): a
 * `filled` IconButton in components/ui, then use it here.
 */
const FILLED_ICON_BUTTON =
  'relative flex shrink-0 cursor-pointer items-center justify-center rounded-control bg-accent text-on-accent shadow-button transition-[filter,opacity] duration-(--duration-fast) ease-fast hover:brightness-95 active:opacity-80 [&>svg]:size-6 disabled:cursor-not-allowed disabled:bg-accent-disabled disabled:text-on-accent-disabled disabled:shadow-none disabled:hover:brightness-100';

/** A JSON-in-localStorage outbox store (text-only messages, so nothing binary is kept). */
function localOutboxStorage(): chat.OutboxStorage {
  return {
    async get(key) {
      try {
        const raw = window.localStorage.getItem(key);
        return raw ? (JSON.parse(raw) as unknown) : undefined;
      } catch {
        return undefined;
      }
    },
    async set(key, value) {
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
      } catch {
        // Storage full / blocked: the send still runs from memory this session.
      }
    },
    async remove(key) {
      try {
        window.localStorage.removeItem(key);
      } catch {
        // ignore
      }
    },
  };
}

export function LiveRoom({
  competition,
  viewer,
  statute,
  className,
}: PanelProps & { viewer: Viewer; className?: string }) {
  const competitionId = competition.documentId;
  const uid = viewer.documentId;
  const ctx = useMemo<RealtimeContext>(() => getRealtimeContext(), []);
  const auth = useMemo<ChatAuth>(() => createChatAuth(ctx, uid, getCustomToken), [ctx, uid]);
  const membership = chat.chatMembershipOf(statute);

  const [cache, setCache] = useState<chat.ChatRoomCache>(chat.createEmptyRoomCache);
  const cacheRef = useRef(cache);
  const [error, setError] = useState<string | null>(null);
  // «Încearcă din nou» re-subscribes the room.
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    cacheRef.current = chat.createEmptyRoomCache();
    return chat.subscribeChatRoom(ctx, auth, { competitionId, roomId: 'general' }, {
      getCache: () => cacheRef.current,
      onCache: next => {
        cacheRef.current = next;
        setCache(next);
        // The room answered again: whatever failed before is over.
        setError(null);
      },
      onError: (_error, kind) => setError(chat.CHAT_ROOM_ERRORS[kind]),
    });
  }, [ctx, auth, competitionId, attempt]);

  // Sends go through the outbox like fish: the bubble shows at once, the worker writes it.
  const worker = useMemo(
    () =>
      chat.createOutboxWorker({
        ctx,
        storage: localOutboxStorage(),
        uploader: async () => {
          throw new chat.UploadError('Pozele nu se pot trimite încă de pe web.', 400);
        },
        getCustomToken,
        isOffline: () => !navigator.onLine,
      }),
    [ctx],
  );
  const [pending, setPending] = useState<chat.ChatListMessage[]>([]);
  useEffect(() => {
    let alive = true;
    const refresh = () =>
      void worker.roomMessages(competitionId, 'general', uid).then(rows => {
        if (alive) setPending(rows);
      });
    refresh();
    const unsubscribe = worker.subscribe(refresh);
    worker.run();
    return () => {
      alive = false;
      unsubscribe();
      worker.dispose();
    };
  }, [worker, competitionId, uid]);

  // fish useChatRulesConsent: the rules are acknowledged once per account, before the first message.
  const [consent, setConsent] = useState<'unknown' | 'needed' | 'ok'>('unknown');
  useEffect(() => {
    let cancelled = false;
    auth
      .ensure()
      .then(ok => (ok ? getDoc(doc(ctx.chatDb, chat.chatRulesConsentPath(uid))) : null))
      .then(snapshot => {
        if (!cancelled) setConsent(snapshot && !snapshot.exists() ? 'needed' : 'ok');
      })
      // Unreadable (offline, rules): do not block the chat behind rules we cannot record.
      .catch(() => !cancelled && setConsent('ok'));
    return () => {
      cancelled = true;
    };
  }, [auth, ctx, uid]);

  const messages = useMemo(
    () =>
      chat
        .mergeDisplayedMessages({
          messages: cache.messages,
          olderMessages: cache.olderMessages,
          pendingMessages: pending,
          reactions: [],
          receipts: [],
          currentUserId: uid,
        })
        .slice()
        .reverse(),
    [cache.messages, cache.olderMessages, pending, uid],
  );

  const listRef = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages.length]);

  // Screen readers hear only a NEW incoming message (not the history on open, not their own).
  const [announcement, setAnnouncement] = useState('');
  const lastSeen = useRef<string | null>(null);
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!cache.isLoaded || !last) return;
    const before = lastSeen.current;
    lastSeen.current = last.id;
    if (before === null || before === last.id || last.senderId === uid || last.type === 'system') return;
    setAnnouncement(`Mesaj nou de la ${last.senderName}`);
  }, [messages, cache.isLoaded, uid]);

  const [text, setText] = useState('');
  const send = async (e: FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    const args = { competitionId, roomId: 'general' as const };
    const entry = chat.buildOutboxEntry({
      ...args,
      messageId: chat.newChatMessageId(ctx, args),
      senderId: uid,
      senderName: viewer.username,
      senderAvatar: viewer.avatarUrl,
      text: body,
      replyToMessage: null,
      senderRole: membership.senderRole,
      attachments: [],
      nowMs: Date.now(),
    });
    try {
      if (await chat.sendChatMessage(worker, entry)) setText('');
    } catch {
      setError(chat.CHAT_SEND_ERRORS.prepare);
    }
  };

  const acknowledge = async () => {
    try {
      await setDoc(doc(ctx.chatDb, chat.chatRulesConsentPath(uid)), { acceptedAt: serverTimestamp() });
      setConsent('ok');
    } catch {
      setError('Nu am putut salva confirmarea. Te rugăm să încerci din nou.');
    }
  };

  return (
    <div className={cn('flex flex-col', className)}>
      <p role="status" className="sr-only">
        {announcement}
      </p>
      {error ? (
        <div role="alert" className="flex items-center gap-2 bg-status-danger-bg py-1 pr-1 pl-3.5 t-caption text-status-danger-fg">
          <span className="min-w-0 flex-1 py-1">{error}</span>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setAttempt(a => a + 1);
            }}
            className={buttonClass({ variant: 'danger', size: 'compact' })}
          >
            Încearcă din nou
          </button>
        </div>
      ) : null}
      <ol ref={listRef} tabIndex={0} aria-label="Mesaje" className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-3.5 py-3">
        {!cache.isLoaded && messages.length === 0 ? (
          <li className="t-caption text-muted">Se încarcă…</li>
        ) : messages.length === 0 ? (
          <li className="t-caption text-muted">Niciun mesaj încă.</li>
        ) : (
          messages.map(m =>
            m.type === 'system' ? (
              <li key={m.id} className="self-center rounded-full bg-soft-fill px-3 py-1 text-center t-micro text-ink-2">
                {m.text}
              </li>
            ) : (
              <li key={m.id} className={cn('flex items-start gap-2', m.pending && 'opacity-60')}>
                <Avatar name={m.senderName} src={m.senderAvatar} size={24} />
                <div className="min-w-0 flex-1">
                  <p className="flex items-baseline gap-1.5">
                    <span className="t-label">{m.senderName}</span>
                    <span className="t-micro text-muted">{m.createdAt?.toDate ? chat.formatTime24(m.createdAt.toDate()) : ''}</span>
                  </p>
                  <p className="t-body break-words text-ink">{m.deletedAt ? 'Acest mesaj a fost șters' : m.text}</p>
                </div>
              </li>
            ),
          )
        )}
      </ol>
      {consent === 'needed' ? (
        <div className="flex flex-col gap-2 border-t border-hairline p-3.5">
          <p className="t-body-strong">Reguli de bun-simț</p>
          <ul className="flex list-disc flex-col gap-1 pl-4 t-caption text-ink-2">
            <li>Fără injurii, jigniri sau limbaj vulgar.</li>
            <li>Fără spam, reclame sau mesaje repetate.</li>
            <li>Fără hărțuire; respect față de participanți și organizatori.</li>
            <li>Discuții despre concurs și pescuit — nimic ilegal sau ofensator.</li>
          </ul>
          <button type="button" onClick={() => void acknowledge()} className={buttonClass({ size: 'compact', block: true })}>
            Am înțeles
          </button>
        </div>
      ) : (
        <form onSubmit={e => void send(e)} className="flex items-end gap-2 px-3.5 pt-1 pb-3.5">
          <TextInput
            label="Mesaj"
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Scrie un mesaj…"
            autoComplete="off"
            enterKeyHint="send"
            disabled={consent !== 'ok'}
            className="min-w-0 flex-1 [&>label]:sr-only"
          />
          <button type="submit" aria-label="Trimite" disabled={!text.trim() || consent !== 'ok'} className={cn(FILLED_ICON_BUTTON, 'size-11')}>
            <PaperAirplaneIcon aria-hidden />
          </button>
        </form>
      )}
    </div>
  );
}
