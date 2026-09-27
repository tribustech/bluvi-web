/**
 * Small pure chat rules, one fish file each (`features/chat/domain/*`): send fallback, membership,
 * closing gate, conversation start, hidden-newest split, reactions summary, room window, gallery.
 */
import type { ChatAttachment, ChatListMessage, ChatMessageWrite, ChatReaction, ChatReactionSummary, ChatSenderRole } from './types';

// ── sendFallback.ts ───────────────────────────────────────────────────────────

/** The role chip is verified by the rules against the membership mirror. When the mirror has not
 * caught up (new competition, registration just accepted) the message must still go — without the chip. */
export function shouldRetryWithoutRole(error: unknown, payload: Pick<ChatMessageWrite, 'senderRole'>): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  const denied = code === 'firestore/permission-denied' || code === 'permission-denied';
  return denied && !!payload.senderRole;
}

export function withoutSenderRole<T extends Record<string, unknown>>(payload: T): Omit<T, 'senderRole'> {
  const { senderRole: _dropped, ...rest } = payload;
  void _dropped;
  return rest;
}

// ── membership.ts ────────────────────────────────────────────────────────────

/** fish `services/api/profile.ts#UserStatuteForCompetition` — minimal local shape. */
export type UserStatuteForCompetition = {
  userRole: 'author' | 'referee' | 'participant' | string | null;
  /** Additive flags (CMS 2026-09-20): `userRole` keeps its author > referee > participant
   * precedence, so a referee who is also on a registered team is only visible through these. */
  isParticipant?: boolean;
  isReferee?: boolean;
};

export type ChatMembership = {
  /** The author or a referee: in the `organizers` mirror, so the rules give them every room. */
  isOrganizerSide: boolean;
  /** May open and write the Participanți room. */
  canUseParticipantsChat: boolean;
  /** Role chip a message from this user carries: `organizer` for the author, `referee` for a
   * referee (even one who is also on a team), `participant` otherwise; undefined for a follower. */
  senderRole: ChatSenderRole | undefined;
};

/**
 * What the chat may show for a user, from the competition statute.
 *
 * `userRole` alone was the gate and it hid the Participanți room from a referee who was ALSO on
 * a registered team: the statute answers `referee` first (the scale needs that precedence), so
 * the participant half of him was invisible to the chat (Cupa VITEZA, 2026-09-20). Referees now
 * count as organizer-side — they sit in the `organizers` mirror the rules and the push fan-out
 * read — and the additive `isParticipant` flag is honoured whatever `userRole` says.
 */
export function chatMembershipOf(statute: UserStatuteForCompetition | undefined | null): ChatMembership {
  if (!statute) return { isOrganizerSide: false, canUseParticipantsChat: false, senderRole: undefined };
  const isOrganizerSide = statute.userRole === 'author' || statute.userRole === 'referee';
  const isParticipant = statute.userRole === 'participant' || statute.isParticipant === true;
  return {
    isOrganizerSide,
    canUseParticipantsChat: isOrganizerSide || isParticipant,
    senderRole:
      statute.userRole === 'author'
        ? 'organizer'
        : statute.userRole === 'referee'
          ? 'referee'
          : isParticipant
            ? 'participant'
            : undefined,
  };
}

// ── chatClosing.ts ───────────────────────────────────────────────────────────

export const CHAT_CLOSE_DELAY_MS = 24 * 60 * 60 * 1000;

export type ChatMeta = { closesAtMs: number; reason: 'completed' | 'cancelled' | string } | null;

/**
 * §3 gate. The meta doc (written by the CMS at end/cancel) wins; without one, a cancelled
 * competition is closed and a completed one closes a day after its endDate (competitions that
 * ended before this shipped never get a meta doc). Unknown until the listener answered.
 */
export function resolveChatClosing({
  meta,
  metaLoaded,
  competitionStatus,
  endDate,
  nowMs,
}: {
  meta: ChatMeta;
  metaLoaded: boolean;
  competitionStatus?: string | null;
  endDate?: string | null;
  nowMs: number;
}): { closesAtMs: number | null; isClosed: boolean } {
  if (!metaLoaded) return { closesAtMs: null, isClosed: false };
  if (meta) return { closesAtMs: meta.closesAtMs, isClosed: nowMs >= meta.closesAtMs };
  if (competitionStatus === 'cancelled') return { closesAtMs: nowMs, isClosed: true };
  if (competitionStatus === 'completed' && endDate) {
    const endMs = Date.parse(endDate);
    if (!Number.isNaN(endMs)) {
      const closesAtMs = endMs + CHAT_CLOSE_DELAY_MS;
      return { closesAtMs, isClosed: nowMs >= closesAtMs };
    }
  }
  return { closesAtMs: null, isClosed: false };
}

/** fish `useChatStatus`: flip exactly at closesAt while the screen is open (max one timer, capped to 24h + margin). */
export function closingTimerDelayMs(resolved: { closesAtMs: number | null; isClosed: boolean }, nowMs: number): number | null {
  if (resolved.isClosed || resolved.closesAtMs == null) return null;
  return Math.min(Math.max(resolved.closesAtMs - nowMs, 0) + 250, 2_147_000_000);
}

// ── conversationStart.ts ─────────────────────────────────────────────────────

/**
 * "Acesta este începutul conversației." — the header at the very top of the room, shown only
 * once the whole history is loaded (the first page came back shorter than the page size, or
 * every older page has been paginated in).
 *
 * Not while loading (nothing is on screen yet) and not for an empty room: the empty state
 * already says the same thing, with a way to break the ice.
 */
export function shouldShowConversationStart({
  messageCount,
  hasMore,
  isLoading,
}: {
  messageCount: number;
  hasMore: boolean;
  isLoading: boolean;
}): boolean {
  if (isLoading) return false;
  if (hasMore) return false;
  return messageCount > 0;
}

// ── hiddenNewest.ts ──────────────────────────────────────────────────────────

/**
 * A reader who scrolled up must not have new rows appended under them. Instead of freezing a copy
 * of the list (which goes stale as older pages load), remember the newest id at the moment hiding
 * started and render from it onward; whatever is newer is the hidden count for the pill.
 */
export function splitHiddenNewest(
  messages: ChatListMessage[],
  anchorId: string | null
): { visible: ChatListMessage[]; hiddenCount: number } {
  if (!anchorId) return { visible: messages, hiddenCount: 0 };
  const index = messages.findIndex(message => message.id === anchorId);
  if (index <= 0) return { visible: messages, hiddenCount: 0 };
  return { visible: messages.slice(index), hiddenCount: index };
}

// ── reactionSummary.ts ───────────────────────────────────────────────────────

/** One pill per emoji, in first-seen order, with who reacted (for the "cine a reacționat" sheet). */
export function summarizeReactions(reactions: ChatReaction[], currentUserId: string | undefined): ChatReactionSummary[] {
  const byEmoji = new Map<string, ChatReactionSummary>();
  for (const reaction of reactions) {
    let summary = byEmoji.get(reaction.emoji);
    if (!summary) {
      summary = { emoji: reaction.emoji, count: 0, reactedByMe: false, users: [] };
      byEmoji.set(reaction.emoji, summary);
    }
    summary.count += 1;
    if (reaction.userId === currentUserId) summary.reactedByMe = true;
    summary.users.push({ userId: reaction.userId, userName: reaction.userName });
  }
  return [...byEmoji.values()];
}

// ── roomWindow.ts ────────────────────────────────────────────────────────────

const timeOf = (message: ChatListMessage) => message.createdAt?.toMillis?.() ?? 0;

/**
 * The live query is a sliding window of the latest N docs. A new message pushes the oldest one
 * out of it; that doc is not in any older page either (pages start after the cursor taken from
 * the FIRST snapshot), so it would vanish from the list. This finds those evictions.
 */
export function evictedFromWindow(previous: ChatListMessage[], next: ChatListMessage[]): ChatListMessage[] {
  if (!previous.length) return [];
  const nextIds = new Set(next.map(message => message.id));
  return previous.filter(message => timeOf(message) > 0 && !nextIds.has(message.id));
}

/** Evicted docs join the head of the older pages, newest first, never twice. */
export function prependEvicted(evicted: ChatListMessage[], older: ChatListMessage[]): ChatListMessage[] {
  const olderIds = new Set(older.map(message => message.id));
  const fresh = evicted.filter(message => !olderIds.has(message.id));
  if (!fresh.length) return older;
  fresh.sort((a, b) => timeOf(b) - timeOf(a));
  return [...fresh, ...older];
}

// ── roomGallery.ts ───────────────────────────────────────────────────────────

export type RoomGalleryMeta = { senderName: string; isMine: boolean; sentAt: string };

export type RoomGallery = {
  /** Every photo in the room, oldest first, in the order the bubbles show them. */
  attachments: ChatAttachment[];
  /** Who sent `attachments[i]` and when — what the viewer chrome shows per page. */
  meta: RoomGalleryMeta[];
};

/**
 * Flattens the room's photos so the viewer can page through all of them, not only the tapped
 * message's. `messages` is the list as the room holds it (newest first); deleted and still-pending
 * messages are skipped — their files are gone or not uploaded yet.
 */
export function buildRoomGallery(
  messages: ChatListMessage[],
  currentUserId: string | undefined,
  formatTime: (message: ChatListMessage) => string
): RoomGallery {
  const attachments: ChatAttachment[] = [];
  const meta: RoomGalleryMeta[] = [];
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.deletedAt || message.pending || !message.attachments?.length) continue;
    const entry = { senderName: message.senderName, isMine: message.senderId === currentUserId, sentAt: formatTime(message) };
    for (const attachment of message.attachments) {
      attachments.push(attachment);
      meta.push(entry);
    }
  }
  return { attachments, meta };
}

export function galleryIndexOf(gallery: RoomGallery, attachmentId: string) {
  return gallery.attachments.findIndex(attachment => attachment.id === attachmentId);
}
