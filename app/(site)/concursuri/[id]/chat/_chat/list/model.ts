import type { chat } from '@/core/realtime';
import { hasSystemLink, isVisibleInRoom } from '@/core/realtime/chat/systemMessages';
import { routes } from '@/lib/routes';

/*
 * The message list's pure decisions (participant.chat c12–c24, c27, c31, c33–c39; fish
 * features/chat/components/MessageList.tsx, MessageBubble.tsx, actions/*, domain/attachmentLayout.ts).
 * No React, no DOM: model.test.ts covers every branch; the e2e (concurs-chat-mesaje.spec.ts) proves
 * them on the page.
 */

type Message = chat.ChatListMessage;

/** c35: scrolled further than this from the end, incoming messages are held and the pill shows. */
export const SCROLL_TO_END_THRESHOLD = 120;
/** c12: the next older page is asked for this many screens before the top (fish onStartReachedThreshold). */
export const LOAD_MORE_SCREENS = 1.5;
/** c33: a row at least this visible for READ_VISIBLE_MS counts as read (fish viewabilityConfig). */
export const READ_RATIO = 0.5;
export const READ_VISIBLE_MS = 250;
/** c15: the floating day chip lingers this long after the last scroll. */
export const FLOATING_CHIP_LINGER_MS = 900;
/** c19: the jumped-to bubble flashes for this long. */
export const HIGHLIGHT_MS = 1500;
/** Long-press on touch (fish delayLongPress ≈ 350–500 ms). */
export const LONG_PRESS_MS = 450;

/* ------------------------------------------------------------------ */
/* Rooms                                                               */
/* ------------------------------------------------------------------ */

/** c36: competition events live in General; Participanți shows only the room's own closing events. */
export function messagesForRoom(messages: Message[], roomId: chat.ChatRoomId): Message[] {
  return messages.filter(m => isVisibleInRoom(m, roomId));
}

/** c12: the line under «Acesta este începutul conversației.» */
export const ROOM_AUDIENCE: Record<chat.ChatRoomId, string> = {
  general: 'Mesajele se văd de către urmăritorii concursului.',
  participants: 'Mesajele se văd de către participanți și organizatori.',
};

/** c14: the empty room's line. */
export const EMPTY_ROOM_SUBTITLE: Record<chat.ChatRoomId, string> = {
  general: 'Fii primul care le scrie urmăritorilor concursului.',
  participants: 'Fii primul care scrie participanților.',
};

/* ------------------------------------------------------------------ */
/* Groups (c16)                                                        */
/* ------------------------------------------------------------------ */

export type BubbleShape = {
  isFirst: boolean;
  isLast: boolean;
  /** Others' first message of a group: the sender's name (and role in General) on top. */
  showName: boolean;
  /** What sits left of an incoming bubble: the avatar (first of a group), a spacer, nothing (mine). */
  avatar: 'avatar' | 'spacer' | 'none';
};

export function bubbleShape(position: chat.ChatGroupPosition, isMine: boolean): BubbleShape {
  const isFirst = position === 'first' || position === 'single';
  const isLast = position === 'last' || position === 'single';
  return { isFirst, isLast, showName: !isMine && isFirst, avatar: isMine ? 'none' : isFirst ? 'avatar' : 'spacer' };
}

const ROLE_LABELS: Record<chat.ChatSenderRole, string> = { participant: 'Participant', organizer: 'Organizator', referee: 'Arbitru' };

/** c16: the role line under the name — General only. */
export function roleLabel(role: chat.ChatSenderRole | undefined, roomId: chat.ChatRoomId): string | null {
  if (roomId !== 'general' || !role) return null;
  return ROLE_LABELS[role] ?? null;
}

/* ------------------------------------------------------------------ */
/* Ticks, deleted, reply (c17–c19)                                     */
/* ------------------------------------------------------------------ */

export type Tick = 'sent' | 'delivered' | 'read';
export const TICK_LABEL: Record<Tick, string> = { sent: 'Trimis', delivered: 'Livrat', read: 'Citit' };

/** c17: ✓ while pending, ✓✓ delivered, blue ✓✓ read by every other known reader — mine only. */
export function tickOf(message: Message, isMine: boolean): Tick | null {
  if (!isMine) return null;
  if (message.pending) return 'sent';
  return message.receiptStatus ?? null;
}

/** c18: who deleted it decides the copy (deletedBy ≠ sender = a moderator). */
export function deletedCopy(message: Pick<Message, 'deletedBy' | 'senderId'>): string {
  return message.deletedBy && message.deletedBy !== message.senderId ? 'Acest mesaj a fost șters de organizator' : 'Acest mesaj a fost șters';
}

/**
 * c19: the quote's line — «Mesaj șters» once the original is gone, else the original's current text
 * (its edit), else the snapshot taken at send time, «Imagine» for a photo, «Mesaj».
 */
export function replyQuoteText(replyTo: chat.ChatReplyTo, original: { text?: string; deleted: boolean } | undefined): { text: string; deleted: boolean } {
  if (original?.deleted) return { text: 'Mesaj șters', deleted: true };
  return { text: original?.text || replyTo.text || (replyTo.hasAttachments ? 'Imagine' : 'Mesaj'), deleted: false };
}

/** The loaded messages by id, as the quotes read them (deleted ones keep no text). */
export function originalsById(messages: Message[]): Map<string, { text?: string; deleted: boolean }> {
  const map = new Map<string, { text?: string; deleted: boolean }>();
  for (const m of messages) map.set(m.id, m.deletedAt ? { deleted: true } : { text: m.text || undefined, deleted: false });
  return map;
}

/* ------------------------------------------------------------------ */
/* Photos (c20; fish domain/attachmentLayout.ts)                        */
/* ------------------------------------------------------------------ */

export const ATTACHMENT_WIDTH = 260;
export const ATTACHMENT_MIN_RATIO = 0.75;
export const ATTACHMENT_MAX_RATIO = 1.6;
export const GRID_GAP = 2;
const FALLBACK_RATIO = 4 / 3;
/** At most this many tiles; the last one carries «+{n-3}» when there are more. */
export const MAX_TILES = 4;

export type PhotoTile = { index: number; width: number; height: number; overflow: number };
export type PhotoLayout = { kind: 'single' | 'grid'; width: number; tiles: PhotoTile[] };

/** One photo fills 260 wide at its own ratio (clamped 3:4 … 16:10); 2–4 a square two-column grid; more: 4 tiles, «+{n-3}» on the 4th. */
export function photoLayout(attachments: { width?: number; height?: number }[]): PhotoLayout | null {
  const count = attachments.length;
  if (!count) return null;
  if (count === 1) {
    const a = attachments[0];
    const ratio = a.width && a.height ? a.width / a.height : FALLBACK_RATIO;
    const clamped = Math.min(ATTACHMENT_MAX_RATIO, Math.max(ATTACHMENT_MIN_RATIO, ratio));
    return { kind: 'single', width: ATTACHMENT_WIDTH, tiles: [{ index: 0, width: ATTACHMENT_WIDTH, height: Math.round(ATTACHMENT_WIDTH / clamped), overflow: 0 }] };
  }
  const side = Math.floor((ATTACHMENT_WIDTH - GRID_GAP) / 2);
  const hidden = count > MAX_TILES ? count - (MAX_TILES - 1) : 0;
  return {
    kind: 'grid',
    width: ATTACHMENT_WIDTH,
    tiles: attachments.slice(0, MAX_TILES).map((_, index) => ({ index, width: side, height: side, overflow: index === MAX_TILES - 1 ? hidden : 0 })),
  };
}

/* ------------------------------------------------------------------ */
/* Actions (c23, c24, c27, c31)                                        */
/* ------------------------------------------------------------------ */

export type MessageActions =
  | { mode: 'none' }
  /** A failed send: only «Reîncearcă» and «Șterge» (discards it locally) — even in a closed chat. */
  | { mode: 'outbox' }
  | { mode: 'message'; react: boolean; reply: boolean; copy: boolean; edit: boolean; delete: boolean };

export const REACTION_EMOJIS = ['\u{1F44D}', '\u{2764}\u{FE0F}', '\u{1F602}', '\u{1F62E}', '\u{1F622}', '\u{1F64F}'] as const;

/** core canDeleteChatMessage (messages.ts loads the Firestore SDK, so the rule is mirrored here; the test pins them together). */
export function canDeleteMessage(message: Message, currentUserId: string | undefined, canDeleteAnyMessage: boolean): boolean {
  if (message.pending) return false;
  return message.senderId === currentUserId || canDeleteAnyMessage;
}

/**
 * fish ChatScreen.handleMessageLongPress + ChatOverlayHost: no menu on system rows, deleted rows,
 * pending rows or in a closed chat — a failed send excepted (its way out may be exactly the closing).
 */
export function actionsFor(
  message: Message,
  { currentUserId, canDeleteAnyMessage, closed }: { currentUserId: string; canDeleteAnyMessage: boolean; closed: boolean },
): MessageActions {
  if (message.type === 'system') return { mode: 'none' };
  if (message.outbox?.status === 'failed') return { mode: 'outbox' };
  if (message.pending || closed || message.deletedAt) return { mode: 'none' };
  const mine = message.senderId === currentUserId;
  return {
    mode: 'message',
    react: true,
    reply: true,
    copy: !!message.text,
    edit: mine && !!message.text,
    delete: canDeleteMessage(message, currentUserId, canDeleteAnyMessage),
  };
}

/** The emoji I reacted with (highlighted in the bar; choosing it again removes it). */
export function myReaction(message: Message): string | undefined {
  return message.reactions?.find(r => r.reactedByMe)?.emoji;
}

/** c22: «{nume} (eu)» for me. */
export function reactorName(user: { userId: string; userName: string }, currentUserId: string): string {
  return user.userId === currentUserId ? `${user.userName} (eu)` : user.userName;
}

/* ------------------------------------------------------------------ */
/* Scroll-to-end pill (c35)                                            */
/* ------------------------------------------------------------------ */

/** The red count on the pill: none at 0, «99+» past 99. */
export function pillCount(hidden: number): string | null {
  if (hidden <= 0) return null;
  return hidden > 99 ? '99+' : String(hidden);
}

/* ------------------------------------------------------------------ */
/* System links (c37)                                                  */
/* ------------------------------------------------------------------ */

export type SystemTarget =
  | { kind: 'href'; href: string }
  | { kind: 'weighing'; weighingId: string; standId: string; standName: string; sectorName: string }
  | null;
export type OpenWeighingTarget = Extract<SystemTarget, { kind: 'weighing' }>;

/**
 * Where a linked event leads on the web: ranking → Clasament; allocation / registrations →
 * Participanți; penalties → the penalties hub (fish systemMessages.ts:96-97, since M6-B6); a weighing
 * (id + standId + standName) → its detail over the chat.
 */
export function systemTarget(link: chat.ChatSystemLink | undefined, competitionId: string): SystemTarget {
  if (!link || !hasSystemLink(link)) return null;
  switch (link.kind) {
    case 'ranking':
      return { kind: 'href', href: routes.competitionRanking(competitionId) };
    case 'allocation':
    case 'registrations':
      return { kind: 'href', href: routes.competitionParticipants(competitionId) };
    case 'penalties':
      return { kind: 'href', href: routes.competitionPenalties(competitionId) };
    case 'weighing': {
      const { standId, standName, sectorName } = link.params ?? {};
      return { kind: 'weighing', weighingId: link.id as string, standId: standId as string, standName: standName as string, sectorName: sectorName ?? '' };
    }
    default:
      return null;
  }
}

/* ------------------------------------------------------------------ */
/* Read receipts (c33)                                                 */
/* ------------------------------------------------------------------ */

const timeOf = (m: Message) => m.createdAt?.toMillis?.() ?? 0;

/**
 * Of the rows seen (≥ 50% for 250 ms), the one my receipt advances to: the newest non-pending one —
 * or, once that is the newest shown, the room's true newest when the room hides it (older CMS
 * builds posted events to Participanți too), so its unread badge can clear.
 */
export function readTarget(seen: Message[], newestShownId: string | undefined, newestOfRoom: Message | undefined): Message | null {
  const delivered = seen.filter(m => !m.pending && timeOf(m) > 0);
  if (!delivered.length) return null;
  const newest = delivered.reduce((a, b) => (timeOf(b) > timeOf(a) ? b : a));
  if (newestOfRoom && newest.id === newestShownId && newestOfRoom.id !== newestShownId && !newestOfRoom.pending) return newestOfRoom;
  return newest;
}

/* ------------------------------------------------------------------ */
/* Scrolling (c12, c35)                                                */
/* ------------------------------------------------------------------ */

/** c12: ask for the next older page once the top is less than 1.5 screens away. */
export function shouldLoadOlder({
  distanceToTop,
  viewport,
  hasMore,
  isLoadingMore,
}: {
  distanceToTop: number;
  viewport: number;
  hasMore: boolean;
  isLoadingMore: boolean;
}): boolean {
  return hasMore && !isLoadingMore && viewport > 0 && distanceToTop < viewport * LOAD_MORE_SCREENS;
}

/**
 * c35 (fish MessageList's hidden anchor): a new newest message from someone else, while the reader
 * is more than 120 px from the end, is held back — the list renders from the newest it showed before
 * (core splitHiddenNewest) and the pill counts the rest. An older anchor is kept while more arrive;
 * my own send, or a reader back at the end, shows everything.
 */
export function nextHiddenAnchor({
  anchor,
  previousNewestId,
  newestId,
  newestIsMine,
  farFromEnd,
}: {
  anchor: string | null;
  previousNewestId: string | undefined;
  newestId: string | undefined;
  newestIsMine: boolean;
  farFromEnd: boolean;
}): string | null {
  if (!newestId || previousNewestId === newestId) return anchor;
  if (newestIsMine || !farFromEnd) return null;
  // The room's first data: nothing was on screen to hold back from.
  if (!previousNewestId) return anchor;
  return anchor ?? previousNewestId;
}

/* ------------------------------------------------------------------ */
/* The desktop menu's place (c23; fish domain/overlayPlacement.ts)      */
/* ------------------------------------------------------------------ */

export type Rect = { top: number; left: number; width: number; height: number };

/**
 * Where the anchored actions menu goes: under the bubble when it fits, else above it, else clamped
 * into the viewport; aligned with the bubble's outer edge (mine: right, others: left), 8 px margins.
 */
export function menuPlacement(anchor: Rect, menu: { width: number; height: number }, viewport: { width: number; height: number }, isMine: boolean, gap = 8): { top: number; left: number } {
  const margin = 8;
  const below = anchor.top + anchor.height + gap;
  const above = anchor.top - gap - menu.height;
  let top = below + menu.height <= viewport.height - margin ? below : above >= margin ? above : viewport.height - margin - menu.height;
  top = Math.max(margin, top);
  const preferred = isMine ? anchor.left + anchor.width - menu.width : anchor.left;
  const left = Math.min(Math.max(margin, preferred), Math.max(margin, viewport.width - margin - menu.width));
  return { top: Math.round(top), left: Math.round(left) };
}

/* ------------------------------------------------------------------ */
/* Viewer (c21)                                                        */
/* ------------------------------------------------------------------ */

export const VIEWER_MAX_ZOOM = 4;
/** Dragged down further than this (px) at 1×, the viewer closes (fish's dismiss pan). */
export const VIEWER_DISMISS_PX = 120;

export function clampZoom(scale: number): number {
  return Math.min(VIEWER_MAX_ZOOM, Math.max(1, Math.round(scale * 100) / 100));
}

/** The viewer's title: the sender, «{nume} (eu)» for my photos. */
export function viewerTitle(meta: { senderName: string; isMine: boolean }): string {
  return meta.isMine ? `${meta.senderName} (eu)` : meta.senderName;
}
