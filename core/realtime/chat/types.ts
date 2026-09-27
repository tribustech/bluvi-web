import type { FieldValue, Timestamp } from 'firebase/firestore';
import type { OutboxStatus } from './outbox/types';

/** fish `models/chat.type.ts` — the Firestore document shapes the app and the web share. */
export const CHAT_ROOM_IDS = ['general', 'participants'] as const;

export type ChatRoomId = (typeof CHAT_ROOM_IDS)[number];
export type ChatMessageType = 'text' | 'system';
/** Stamped by the sender from its statute in the competition; shown as a chip in the general room. */
export type ChatSenderRole = 'participant' | 'organizer' | 'referee';

export type ChatAttachment = {
  id: string;
  url: string;
  thumbnailUrl: string;
  width?: number;
  height?: number;
  mime?: string;
  name?: string;
  blurhash?: string;
};

export type ChatPendingAttachment = {
  id: string;
  uri: string;
  name: string;
  mime?: string;
  width?: number;
  height?: number;
};

export type ChatReplyTo = {
  messageId: string;
  senderId: string;
  senderName: string;
  text: string;
  hasAttachments?: boolean;
};

/** Deep-link target carried by a system message. */
export type ChatSystemLink = { kind: string; id?: string; params?: Record<string, string> };

export type ChatMessage = {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar: string | null;
  text: string;
  attachments?: ChatAttachment[];
  replyTo?: ChatReplyTo;
  createdAt: Timestamp;
  editedAt?: Timestamp;
  type: ChatMessageType;
  senderRole?: ChatSenderRole;
  /** System messages only (`type: 'system'`): which catalog event produced it, e.g. `competition:start`. */
  event?: string;
  /** System messages only: optional tappable deep link. */
  link?: ChatSystemLink;
  /** System messages only: structured fields behind the copy, e.g. podium `{ place, team }` (CMS ≥ 2026-09-25). */
  data?: Record<string, string | number>;
  /** Soft delete: the doc stays as a placeholder ("Acest mesaj a fost șters"); the CMS purges the files. */
  deletedAt?: Timestamp;
  deletedBy?: string;
};

export type ChatMessageWrite = Omit<ChatMessage, 'id' | 'createdAt'> & {
  createdAt: FieldValue;
};

export type ChatParticipantMirror = {
  joinedAt: Timestamp;
};

export type ChatReaction = {
  id: string;
  messageId: string;
  userId: string;
  userName: string;
  emoji: string;
  updatedAt: Timestamp;
};

export type ChatReadReceipt = {
  id: string;
  userId: string;
  userName: string;
  lastReadMessageId: string;
  lastReadAt: Timestamp;
  updatedAt: Timestamp;
};

export type ChatReceiptStatus = 'sent' | 'delivered' | 'read';

// ── fish `features/chat/domain/types.ts` (data-side types; UI layout/measure types stay in the app) ──

export type ChatReactionSummary = {
  emoji: string;
  count: number;
  reactedByMe: boolean;
  /** Who reacted with this emoji, in reaction order. */
  users: { userId: string; userName: string }[];
};
export type ChatListMessage = ChatMessage & {
  pending?: boolean;
  reactions?: ChatReactionSummary[];
  receiptStatus?: ChatReceiptStatus;
  outbox?: { status: OutboxStatus; lastError?: string | null };
};

export type ChatGroupPosition = 'single' | 'first' | 'middle' | 'last';
export type ChatMessageItem = ChatListMessage & { groupPosition: ChatGroupPosition };
export type DateSeparatorItem = { id: string; type: 'date-separator'; label: string };
export type NewMessagesSeparatorItem = { id: 'new-messages'; type: 'new-messages-separator' };
/** A run of routine system events (weighings, sign-ups) folded into one row; expanded, it lists them inside. */
export type SystemGroupItem = {
  id: string;
  type: 'system-group';
  messages: ChatListMessage[];
  expanded: boolean;
};
export type ChatListItem = ChatMessageItem | DateSeparatorItem | NewMessagesSeparatorItem | SystemGroupItem;
