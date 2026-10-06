'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ChatBubbleOvalLeftIcon, XMarkIcon } from '@heroicons/react/24/outline';
import type { CompetitionWithMyStatus } from '@/core/competitions';
import type { chat } from '@/core/realtime';
// The pure membership rule, not the `chat` barrel: the barrel pulls in the Firestore SDK.
import { chatMembershipOf } from '@/core/realtime/chat/domain';
import type { UserStatuteForCompetition } from '@/core/social';
import { plural } from '@/components/cards/format';
import { Button, buttonClass } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { IconButton } from '@/components/nav/IconButton';
import { Sheet } from '@/components/surfaces/Sheet';
import { CountBadge } from '@/components/templates/T5';
import type { Viewer } from '@/lib/server/viewer';

/*
 * The competition chat (fish features/chat), General room: from 768 the header's «Chat» action
 * (ChatHeaderButton, beside Urmărește / Distribuie, with the unread count) opens the room as a
 * popover docked bottom-right — nothing floats over the full-width ranking while it is closed; on
 * the phone the bar's «Chat» opens it in the kit Sheet. Reads/writes go through
 * core/realtime/chat with the web's Firebase app (lib/client/firebase.ts). Without the
 * NEXT_PUBLIC_FIREBASE_* config (local) it renders «Chat indisponibil» and never touches Firebase.
 *
 * Firebase is never in the page's bundle: the open room (ChatRoom.tsx) is a next/dynamic import
 * fetched when a signed-in viewer opens the chat, and the unread badge imports the SDK inside its
 * effect, after hydration. In the main bundle its ~200 KB were downloaded before the first paint
 * of every competition page (Lighthouse LCP), chat or no chat.
 *
 * Kept to the room itself: no replies, reactions, attachments, Participanți room or moderation yet.
 */

const CHAT_AVAILABLE = Boolean(
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY && process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID && process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
);

export type PanelProps = {
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
  const isMember = chatMembershipOf(statute).canUseParticipantsChat;
  const uid = viewer?.documentId ?? null;
  useEffect(() => {
    if (!CHAT_AVAILABLE || !uid) return;
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;
    void Promise.all([import('@/core/realtime'), import('@/lib/client/firebase')]).then(
      ([{ chat: realtime, createChatAuth }, { getCustomToken, getRealtimeContext }]) => {
        if (cancelled) return;
        const ctx = getRealtimeContext();
        const auth = createChatAuth(ctx, uid, getCustomToken);
        unsubscribe = realtime.subscribeCompetitionChatBadge(ctx, auth, { competitionId, profileDocumentId: uid, isMember }, setBadge);
      },
      // The SDK chunk did not load (offline): no badge, as when the room cannot be read.
      () => {},
    );
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
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

/** ChatHeaderButton's place while the session is read: its footprint (48 icon / 40-tall «Chat» from 1280). */
export function ChatHeaderPlaceholder() {
  return <span aria-hidden className="block h-12 w-12 shrink-0 animate-shimmer rounded-control xl:h-10 xl:w-24" />;
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

/** The open room, fetched on first open (see the file's header); its own «Se încarcă…» until then. */
const LiveRoom = dynamic(() => import('./ChatRoom').then(m => m.LiveRoom), {
  ssr: false,
  loading: () => (
    <p role="status" className="px-3.5 py-3 t-caption text-muted">
      Se încarcă…
    </p>
  ),
});

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
  // The frame keeps the room's size while its module loads (the loading line inside it).
  return (
    <div className={cn('flex flex-col', className)}>
      <LiveRoom {...props} viewer={props.viewer} className="min-h-0 flex-1" />
    </div>
  );
}

