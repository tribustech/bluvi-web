'use client';

import { useSyncExternalStore } from 'react';
import { ChatBubbleOvalLeftIcon } from '@heroicons/react/24/outline';
import type { chat } from '@/core/realtime';
// The pure membership rule, not the `chat` barrel: the barrel pulls in the Firestore SDK.
import { chatMembershipOf } from '@/core/realtime/chat/domain';
import type { UserStatuteForCompetition } from '@/core/social';
import { ButtonLink } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { CountBadge } from '@/components/templates/T5';
import { routes } from '@/lib/routes';
import type { Viewer } from '@/lib/server/viewer';
import { useChatBadge as useLiveChatBadge } from '../chat/_live/hooks';
import { CHAT_FROM_KEY, getLastChatTab, tabParamOf } from '../chat/_live/lastTab';

/*
 * The competition page's way into the chat (participant.b.chat-entry, b.chat-badge): signed in
 * only, the header's «Chat» (from 768) and the phone bar's Chat tile are LINKS to the chat page
 * (/concursuri/[id]/chat, ./chat/page.tsx), opening the room last used in this competition
 * (`chat:lastTab:{id}`, fish lastTab.ts), with the unread count on their corner.
 *
 * Firebase is never in this page's bundle: the badge's source (chat/_live/source.ts) is a chunk
 * fetched after hydration, and only for a signed-in viewer (LCP, the old ChatPanel's lesson).
 */

/** fish useCompetitionChatBadge: unread count across the rooms this account reads, or «Nou». */
export function useChatBadge(competitionId: string, viewer: Viewer | null, statute: UserStatuteForCompetition | undefined): chat.ChatBadge {
  return useLiveChatBadge(competitionId, viewer?.documentId ?? null, chatMembershipOf(statute).canUseParticipantsChat);
}

const noSubscribe = () => () => {};

/**
 * The chat link for this competition: the last room used here (localStorage, read after
 * hydration — the server HTML links the plain chat, which picks the room itself).
 */
export function useChatHref(competitionId: string): string {
  return useSyncExternalStore(
    noSubscribe,
    () => {
      const last = getLastChatTab(competitionId);
      return routes.competitionChat(competitionId, last ? tabParamOf(last) : undefined);
    },
    () => routes.competitionChat(competitionId),
  );
}

/** Marks that the chat was opened from this competition (the chat's Back returns here, c41). */
export function markChatFromCompetition(competitionId: string) {
  try {
    window.sessionStorage.setItem(CHAT_FROM_KEY, competitionId);
  } catch {
    // Storage blocked: the chat's Back replaces with the competition page instead.
  }
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

/** The chat entry's accessible name, with the badge said in words (shared by the header and the bar). */
export function chatEntryLabel(badge: chat.ChatBadge, base = 'Chat concurs'): string {
  if (!badge) return base;
  return badge.text === 'Nou' ? `${base}, mesaje noi` : `${base}, ${badge.text} mesaje necitite`;
}

/** The id of the header's chat link. */
export const CHAT_BUTTON_ID = 'concurs-chat';

/**
 * From 768, signed in: the header's «Chat» (the kit secondary button look, icon-only below 1280
 * like the share button beside it, labelled from 1280), the unread count on its corner. A link to
 * the chat page.
 */
export function ChatHeaderButton({ competitionId, badge }: { competitionId: string; badge: chat.ChatBadge }) {
  const href = useChatHref(competitionId);
  return (
    <ButtonLink
      id={CHAT_BUTTON_ID}
      href={href}
      variant="secondary"
      icon={<ChatBubbleOvalLeftIcon />}
      aria-label={chatEntryLabel(badge)}
      title="Chat concurs"
      onClick={() => markChatFromCompetition(competitionId)}
      className="relative max-xl:w-12 max-xl:px-0"
    >
      <span className="max-xl:sr-only">Chat</span>
      <ChatCountBadge badge={badge} className="absolute -top-1.5 -right-1.5" />
    </ButtonLink>
  );
}

/** ChatHeaderButton's place while the session is read: its footprint (48 icon / 40-tall «Chat» from 1280). */
export function ChatHeaderPlaceholder() {
  return <span aria-hidden className="block h-12 w-12 shrink-0 animate-shimmer rounded-control xl:h-10 xl:w-24" />;
}
