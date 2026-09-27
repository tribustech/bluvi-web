/**
 * fish `features/chat/hooks/useChatSend.ts` without React: every new send is enqueued into the
 * outbox (instant pending bubble, upload + Firestore write happen in the background worker).
 * Edits update the existing doc in place; delete is a soft delete (the UI confirms inline).
 */
import { collection, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import type { ChatAuth, RealtimeContext } from '../firebase';
import type { OutboxWorker } from './outbox/worker';
import type { OutboxAttachmentRow, OutboxEntry } from './outbox/types';
import { chatMessagePath, chatMessagesPath } from './paths';
import { toChatReplyTo } from './transforms';
import type { ChatListMessage, ChatRoomId, ChatSenderRole } from './types';

export const CHAT_SEND_ERRORS = {
  auth: 'Nu am putut autentifica chat-ul. Te rugăm să încerci din nou.',
  edit: 'Mesajul nu a putut fi editat.',
  delete: 'Mesajul nu a putut fi șters.',
  prepare: 'Mesajul nu a putut fi pregătit pentru trimitere.',
} as const;

type RoomArgs = { competitionId: string; roomId: ChatRoomId };

/** A fresh auto-id for a new message (fish: `doc(collection(db, messagesPath)).id`) — no network. */
export function newChatMessageId(ctx: RealtimeContext, { competitionId, roomId }: RoomArgs): string {
  return doc(collection(ctx.chatDb, chatMessagesPath(competitionId, roomId))).id;
}

/**
 * The outbox row for a send. The caller has already prepared the attachments (fish compresses and
 * copies them into the outbox dir; the web resizes the Blob and keeps it on the row as `file`).
 */
export function buildOutboxEntry({
  messageId,
  competitionId,
  roomId,
  senderId,
  senderName,
  senderAvatar,
  text,
  replyToMessage,
  senderRole,
  attachments,
  nowMs,
}: RoomArgs & {
  messageId: string;
  senderId: string;
  /** fish: `profile.username`. */
  senderName: string;
  /** fish: `profile.avatar?.url ?? null`. */
  senderAvatar: string | null;
  text: string;
  replyToMessage: ChatListMessage | null;
  senderRole?: ChatSenderRole;
  attachments: Omit<OutboxAttachmentRow, 'messageId' | 'position' | 'uploaded'>[];
  nowMs: number;
}): OutboxEntry {
  const replyTo = replyToMessage ? toChatReplyTo(replyToMessage) : null;
  return {
    message: {
      id: messageId,
      competitionId,
      roomId,
      senderId,
      senderName,
      senderAvatar,
      text,
      replyTo: replyTo ? JSON.stringify(replyTo) : null,
      senderRole: senderRole ?? null,
      createdAt: nowMs,
      status: 'queued',
      attempts: 0,
      lastError: null,
      nextAttemptAt: 0,
    },
    attachments: attachments.map((attachment, position) => ({ ...attachment, messageId, position, uploaded: null })),
  };
}

/**
 * fish `send` (new message branch). Resolves false when there is nothing to send. The bubble
 * appears the instant the send is tapped: enqueueing is local work, so the room's outbox read
 * shows it before any network call runs. Rejects when the row could not be stored — the UI then
 * restores the composer (fish: attachments + reply) and shows `CHAT_SEND_ERRORS.prepare`.
 */
export async function sendChatMessage(
  outbox: Pick<OutboxWorker, 'enqueue'>,
  entry: OutboxEntry
): Promise<boolean> {
  if (!entry.message.text && entry.attachments.length === 0) return false;
  await outbox.enqueue(entry);
  return true;
}

/** fish `send` (edit branch). Throws `CHAT_SEND_ERRORS.auth` when Firebase auth is not ready. */
export async function editChatMessage(
  ctx: RealtimeContext,
  auth: ChatAuth,
  { competitionId, roomId, messageId, text }: RoomArgs & { messageId: string; text: string }
): Promise<void> {
  if (!(await auth.ensure())) throw new Error(CHAT_SEND_ERRORS.auth);
  await auth.withRetry(() =>
    updateDoc(doc(ctx.chatDb, chatMessagePath(competitionId, roomId, messageId)), {
      text,
      editedAt: serverTimestamp(),
    })
  );
}

/** fish `deleteMessage` guard: never a pending bubble; others' messages only for moderators. */
export function canDeleteChatMessage(message: ChatListMessage, currentUserId: string | undefined, canDeleteAnyMessage: boolean) {
  if (message.pending) return false;
  return message.senderId === currentUserId || canDeleteAnyMessage;
}

/**
 * fish `deleteMessage`. Soft delete: the doc stays as a placeholder, the text goes, and the CMS
 * listener purges the attachment files. Resolves false when the guard refuses.
 */
export async function deleteChatMessage(
  ctx: RealtimeContext,
  auth: ChatAuth,
  {
    competitionId,
    roomId,
    message,
    currentUserId,
    canDeleteAnyMessage,
  }: RoomArgs & { message: ChatListMessage; currentUserId?: string; canDeleteAnyMessage: boolean }
): Promise<boolean> {
  if (!competitionId || !canDeleteChatMessage(message, currentUserId, canDeleteAnyMessage)) return false;
  await auth.ensure();
  const firebaseUserId = ctx.auth.currentUser?.uid;
  if (!firebaseUserId) throw new Error('chat: no Firebase user for delete');
  await auth.withRetry(() =>
    updateDoc(doc(ctx.chatDb, chatMessagePath(competitionId, roomId, message.id)), {
      deletedAt: serverTimestamp(),
      deletedBy: firebaseUserId,
      text: '',
    })
  );
  return true;
}
