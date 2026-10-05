'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { ChatBubbleOvalLeftIcon, PaperAirplaneIcon, XMarkIcon } from '@heroicons/react/24/outline';
import type { CompetitionWithMyStatus } from '@/core/competitions';
import { chat, createChatAuth, type RealtimeContext, type ChatAuth } from '@/core/realtime';
import type { UserStatuteForCompetition } from '@/core/social';
import { plural } from '@/components/cards/format';
import { Avatar } from '@/components/ui/Avatar';
import { Button, buttonClass } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { IconButton } from '@/components/nav/IconButton';
import { Sheet } from '@/components/surfaces/Sheet';
import { TextInput } from '@/components/forms/TextInput';
import { CountBadge } from '@/components/templates/T5';
import { getCustomToken, getRealtimeContext } from '@/lib/client/firebase';
import type { Viewer } from '@/lib/server/viewer';

/*
 * The competition chat (fish features/chat), General room: from 768 the header's «Chat» action
 * (ChatHeaderButton, beside Urmărește / Distribuie, with the unread count) opens the room as a
 * popover docked bottom-right — nothing floats over the full-width ranking while it is closed; on
 * the phone the bar's «Chat» opens it in the kit Sheet. Reads/writes go through
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

/**
 * The unread count on the chat's launcher (from 768) and on the phone bar's Chat tile: one spec,
 * the T5 CountBadge (h-4.5, ring-2 surface, the «în așteptare» pair — the live red only ever means
 * LIVE). fish's «Nou» (chat never opened) is a word, which CountBadge does not take: it gets the
 * same look. TODO(kit): CountBadge in components/ui with a text label, then drop COUNT_BADGE_LOOK.
 * Decorative: the control's own name says the count.
 */
const COUNT_BADGE_LOOK =
  'flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-status-pending-bg px-1.25 t-micro-strong text-status-pending-fg tabular-nums ring-2 ring-surface';

export function ChatCountBadge({ badge, className }: { badge: chat.ChatBadge; className?: string }) {
  if (!badge) return null;
  if (badge.text === 'Nou') {
    return (
      <span aria-hidden className={cn(COUNT_BADGE_LOOK, className)}>
        Nou
      </span>
    );
  }
  // «99+» (core's cap) stays «99+».
  const n = Number.parseInt(badge.text, 10);
  return <CountBadge count={badge.text.endsWith('+') ? 100 : n} className={className} />;
}

function participantsLine(competition: CompetitionWithMyStatus): string {
  const n = competition.registrations.filter(r => r.registrationStatus === 'registered').length;
  return plural(n, 'pescar', 'pescari');
}

/**
 * The send button: a filled icon-only control on the kit's primary spec (accent fill, on-accent
 * icon, shadow-button, radius control), as tall as the kit field beside it (44). TODO(kit): a
 * `filled` IconButton in components/ui, then use it here.
 */
const FILLED_ICON_BUTTON =
  'relative flex shrink-0 cursor-pointer items-center justify-center rounded-control bg-accent text-on-accent shadow-button transition-[filter,opacity] duration-(--duration-fast) ease-fast hover:brightness-95 active:opacity-80 [&>svg]:size-6 disabled:cursor-not-allowed disabled:bg-accent-disabled disabled:text-on-accent-disabled disabled:shadow-none disabled:hover:brightness-100';

/** The id of the header's chat button: the popover hands focus back to it when it closes. */
export const CHAT_BUTTON_ID = 'concurs-chat';

/**
 * From 768, signed in: the header's «Chat» action (the kit secondary Button, icon-only below 1280
 * like the share button beside it, labelled from 1280), the unread count on its corner. It toggles
 * the popover (ChatDock).
 */
export function ChatHeaderButton({ badge, open, onToggle }: { badge: chat.ChatBadge; open: boolean; onToggle: () => void }) {
  const name = badge ? (badge.text === 'Nou' ? 'Chat concurs, mesaje noi' : `Chat concurs, ${badge.text} mesaje necitite`) : 'Chat concurs';
  return (
    <Button
      id={CHAT_BUTTON_ID}
      variant="secondary"
      icon={<ChatBubbleOvalLeftIcon />}
      aria-expanded={open}
      aria-label={name}
      title="Chat concurs"
      onClick={onToggle}
      className="relative max-xl:w-12 max-xl:px-0"
    >
      <span className="max-xl:sr-only">Chat</span>
      <ChatCountBadge badge={badge} className="absolute -top-1.5 -right-1.5" />
    </Button>
  );
}

/**
 * From 768: the open room, a popover docked bottom-right (radius card, e2) — over the table only
 * while the reader is using it. Escape or its close button closes it and focus goes back to the
 * header's «Chat».
 */
export function ChatDock({ open, onClose, ...props }: PanelProps & { badge: chat.ChatBadge; open: boolean; onClose: () => void }) {
  const { competition, badge } = props;
  if (!open) return null;
  const subtitle = !CHAT_AVAILABLE
    ? 'Chat indisponibil'
    : [participantsLine(competition), badge && badge.text !== 'Nou' ? `${badge.text} mesaje noi` : null].filter(Boolean).join(' · ');
  const close = () => {
    onClose();
    document.getElementById(CHAT_BUTTON_ID)?.focus();
  };
  return (
    <section
      aria-label="Chat concurs"
      onKeyDown={e => {
        if (e.key === 'Escape') close();
      }}
      className="fixed right-6 bottom-6 z-overlay hidden w-90 flex-col overflow-hidden rounded-card bg-surface shadow-e2 md:flex xl:right-8 xl:bottom-8"
    >
      <ChatHeader subtitle={subtitle} onClose={close} />
      {CHAT_AVAILABLE ? <PanelBody {...props} className="h-80" /> : <p className="p-6 text-center t-body text-muted">Chat indisponibil</p>}
    </section>
  );
}

/** The room's title row: the chat mark, «Chat concurs», who is in it, and close. */
function ChatHeader({ subtitle, onClose }: { subtitle: string; onClose: () => void }) {
  return (
    <div className="flex items-center gap-2.5 border-b border-hairline py-1 pr-1 pl-3.5">
      <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-control bg-accent-tint text-accent-ink">
        <ChatBubbleOvalLeftIcon className="size-6" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block t-body-strong">Chat concurs</span>
        <span className="block truncate t-caption text-muted">{subtitle}</span>
      </span>
      <IconButton aria-label="Închide chatul" onClick={onClose} size="size-10">
        <XMarkIcon aria-hidden />
      </IconButton>
    </div>
  );
}

/** Phone: the bar's «Chat» opens the room in the kit Sheet (90% high; drag, scrim or Escape close it). */
export function MobileChatSheet({ open, onClose, ...props }: PanelProps & { open: boolean; onClose: () => void }) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Chat concurs"
      subtitle={CHAT_AVAILABLE ? participantsLine(props.competition) : 'Chat indisponibil'}
      initialSnap={0.9}
    >
      {open ? (
        CHAT_AVAILABLE ? (
          // The Sheet pads its body (20px sides, 16 bottom); the room runs edge to edge and scrolls itself.
          <PanelBody {...props} className="-mx-5 -mb-4 h-[calc(100%+--spacing(4))]" />
        ) : (
          <p className="p-6 text-center t-body text-muted">Chat indisponibil</p>
        )
      ) : null}
    </Sheet>
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
