'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { ChatBubbleOvalLeftIcon, ChevronDownIcon, ChevronUpIcon, PaperAirplaneIcon, XMarkIcon } from '@heroicons/react/24/solid';
import type { CompetitionWithMyStatus } from '@/core/competitions';
import { chat, createChatAuth, type RealtimeContext, type ChatAuth } from '@/core/realtime';
import type { UserStatuteForCompetition } from '@/core/social';
import { plural } from '@/components/cards/format';
import { Avatar } from '@/components/ui/Avatar';
import { buttonClass } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { useBreakpoint } from '@/components/surfaces/useBreakpoint';
import { useModalDialog } from '@/components/surfaces/useModalDialog';
import { getCustomToken, getRealtimeContext } from '@/lib/client/firebase';
import type { Viewer } from '@/lib/server/viewer';

/*
 * The competition chat (fish features/chat), General room, as a docked window on desktop (design)
 * and a full-screen dialog from the bar's «Chat» on the phone. Reads/writes go through
 * core/realtime/chat with the web's Firebase app (lib/client/firebase.ts). Without the
 * NEXT_PUBLIC_FIREBASE_* config (local) it renders «Chat indisponibil» and never touches Firebase.
 *
 * Kept to the room itself: no replies, reactions, attachments, Participanți room or moderation yet.
 */

const CHAT_AVAILABLE = Boolean(
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY && process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID && process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
);

type PanelProps = {
  competition: CompetitionWithMyStatus;
  viewer: Viewer | null;
  statute: UserStatuteForCompetition | undefined;
  signIn: string;
};

/** fish useCompetitionChatBadge: unread count across the rooms this account reads, or «Nou». */
export function useChatBadge(
  competitionId: string,
  viewer: Viewer | null,
  statute: UserStatuteForCompetition | undefined,
): chat.ChatBadge {
  const [badge, setBadge] = useState<chat.ChatBadge>(null);
  const isMember = chat.chatMembershipOf(statute).canUseParticipantsChat;
  const uid = viewer?.documentId ?? null;
  useEffect(() => {
    if (!CHAT_AVAILABLE || !uid) return;
    const ctx = getRealtimeContext();
    const auth = createChatAuth(ctx, uid, getCustomToken);
    return chat.subscribeCompetitionChatBadge(ctx, auth, { competitionId, profileDocumentId: uid, isMember }, setBadge);
  }, [competitionId, uid, isMember]);
  return CHAT_AVAILABLE && uid ? badge : null;
}

function participantsLine(competition: CompetitionWithMyStatus): string {
  const n = competition.registrations.filter(r => r.registrationStatus === 'registered').length;
  return plural(n, 'pescar', 'pescari');
}

/** Desktop (≥768): docked bottom-right, collapsible. Open by default from 1280. */
export function ChatDock(props: PanelProps & { badge: chat.ChatBadge }) {
  const breakpoint = useBreakpoint();
  const [toggled, setToggled] = useState<boolean | null>(null);
  const open = toggled ?? breakpoint === 'desktop';
  const { competition, badge } = props;
  const subtitle = !CHAT_AVAILABLE
    ? 'Chat indisponibil'
    : [participantsLine(competition), badge && badge.text !== 'Nou' ? `${badge.text} mesaje noi` : null].filter(Boolean).join(' · ');

  return (
    <aside
      aria-label="Chat concurs"
      className="fixed right-6 bottom-6 z-30 hidden w-[360px] overflow-hidden rounded-[18px] bg-surface shadow-e2 md:block xl:right-8 xl:bottom-8"
    >
      <button
        type="button"
        aria-expanded={open}
        disabled={!CHAT_AVAILABLE}
        onClick={() => setToggled(!open)}
        className="flex w-full items-center gap-2.5 border-b border-hairline px-3.5 py-3 text-left disabled:cursor-not-allowed"
      >
        <span
          className={cn(
            'flex size-8 shrink-0 items-center justify-center rounded-control text-on-accent',
            CHAT_AVAILABLE ? 'bg-sector-g' : 'bg-faint',
          )}
        >
          <ChatBubbleOvalLeftIcon aria-hidden className="size-[17px]" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block t-body-strong font-extrabold">Chat concurs</span>
          <span className="block truncate t-micro text-muted">{subtitle}</span>
        </span>
        {badge ? (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-live px-1.5 t-micro-strong text-on-accent">
            {badge.text}
          </span>
        ) : null}
        {CHAT_AVAILABLE ? (
          open ? (
            <ChevronDownIcon aria-hidden className="size-[18px] text-muted" />
          ) : (
            <ChevronUpIcon aria-hidden className="size-[18px] text-muted" />
          )
        ) : null}
      </button>
      {CHAT_AVAILABLE && open ? <PanelBody {...props} className="h-80" /> : null}
    </aside>
  );
}

/** Phone: the bar's «Chat» opens the room full screen. */
export function MobileChatDialog({ open, onClose, ...props }: PanelProps & { open: boolean; onClose: () => void }) {
  const dialog = useModalDialog(open, onClose);
  return (
    <dialog
      {...dialog}
      aria-label="Chat concurs"
      className="m-0 h-dvh max-h-none w-full max-w-none bg-surface p-0 text-ink backdrop:bg-scrim open:flex open:flex-col"
    >
      <div className="flex items-center gap-2.5 border-b border-hairline px-3.5 py-3">
        <span className="flex size-8 items-center justify-center rounded-control bg-sector-g text-on-accent">
          <ChatBubbleOvalLeftIcon aria-hidden className="size-[17px]" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block t-body-strong">Chat concurs</span>
          <span className="block truncate t-micro text-muted">
            {CHAT_AVAILABLE ? participantsLine(props.competition) : 'Chat indisponibil'}
          </span>
        </span>
        <button type="button" onClick={onClose} aria-label="Închide" className="flex size-10 items-center justify-center rounded-control hover:bg-soft-fill">
          <XMarkIcon aria-hidden className="size-5" />
        </button>
      </div>
      {open ? (
        CHAT_AVAILABLE ? (
          <PanelBody {...props} className="min-h-0 flex-1" />
        ) : (
          <p className="p-6 text-center t-body text-muted">Chat indisponibil</p>
        )
      ) : null}
    </dialog>
  );
}

function PanelBody({ className, ...props }: PanelProps & { className?: string }) {
  if (!props.viewer) {
    return (
      <div className={cn('flex flex-col items-center justify-center gap-3 p-6 text-center', className)}>
        <p className="t-body text-ink-2">Intră în cont pentru a scrie în chat.</p>
        <Link href={props.signIn} className={buttonClass({ variant: 'secondary', size: 'compact' })}>
          Intră în cont
        </Link>
      </div>
    );
  }
  return <LiveRoom {...props} viewer={props.viewer} className={className} />;
}

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

function LiveRoom({
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
  useEffect(() => {
    cacheRef.current = chat.createEmptyRoomCache();
    return chat.subscribeChatRoom(ctx, auth, { competitionId, roomId: 'general' }, {
      getCache: () => cacheRef.current,
      onCache: next => {
        cacheRef.current = next;
        setCache(next);
      },
      onError: (_error, kind) => setError(chat.CHAT_ROOM_ERRORS[kind]),
    });
  }, [ctx, auth, competitionId]);

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
      {error ? (
        <p role="alert" className="bg-status-danger-bg px-3.5 py-2 t-caption text-status-danger-fg">
          {error}
        </p>
      ) : null}
      <ol ref={listRef} aria-label="Mesaje" aria-live="polite" className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-3.5 py-3">
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
                    <span className="t-label font-extrabold">{m.senderName}</span>
                    <span className="t-micro text-faint">{m.createdAt?.toDate ? chat.formatTime24(m.createdAt.toDate()) : ''}</span>
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
        <form onSubmit={e => void send(e)} className="flex items-center gap-2 px-3.5 pt-1 pb-3.5">
          <label className="min-w-0 flex-1">
            <span className="sr-only">Mesaj</span>
            <input
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Scrie un mesaj…"
              disabled={consent !== 'ok'}
              className="h-10 w-full rounded-full bg-soft-fill px-3.5 t-body text-ink outline-none placeholder:text-muted focus-visible:outline-2 focus-visible:outline-accent"
            />
          </label>
          <button
            type="submit"
            aria-label="Trimite"
            disabled={!text.trim() || consent !== 'ok'}
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent disabled:opacity-40"
          >
            <PaperAirplaneIcon aria-hidden className="size-4.5" />
          </button>
        </form>
      )}
    </div>
  );
}
