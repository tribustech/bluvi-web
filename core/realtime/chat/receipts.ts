/**
 * fish `features/chat/hooks/useChatReceipts.ts` + `useChatReactions.ts` without React.
 *
 * Read receipts for a room: subscribe to the room's receipt docs, freeze the current user's own
 * `lastReadAt` as the unread boundary for this room mount, and mark messages read as they become
 * visible (debounced by message time so re-renders don't re-write the same receipt). Own messages
 * advance the receipt too: the unread counts are "created after my lastReadAt", so a message I sent
 * must not come back as unread once I leave the room.
 */
import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc, type Timestamp, type Unsubscribe } from 'firebase/firestore';
import type { ChatAuth, RealtimeContext } from '../firebase';
import { chatReactionsPath, chatReactionUserPath, chatReceiptsPath, chatReceiptUserPath } from './paths';
import { toChatReaction, toChatReadReceipt } from './transforms';
import type { ChatListMessage, ChatReaction, ChatReadReceipt, ChatRoomId } from './types';

type RoomArgs = { competitionId: string; roomId: ChatRoomId };

/**
 * Receipts listener. `unreadAfter` is frozen from the FIRST snapshot's own receipt for the life of
 * this subscription (a new subscription = a new room mount = a new boundary). Errors reset to empty,
 * as fish does.
 */
export function subscribeReceipts(
  ctx: RealtimeContext,
  { competitionId, roomId, currentUserId }: RoomArgs & { currentUserId?: string },
  onData: (state: { receipts: ChatReadReceipt[]; unreadAfter: Timestamp | null }) => void
): Unsubscribe {
  let frozenUnreadAfter: Timestamp | null | undefined;
  return onSnapshot(
    collection(ctx.chatDb, chatReceiptsPath(competitionId, roomId)),
    snapshot => {
      const receipts = snapshot.docs.map(d => toChatReadReceipt(d));
      if (frozenUnreadAfter === undefined) {
        frozenUnreadAfter = receipts.find(receipt => receipt.userId === currentUserId)?.lastReadAt ?? null;
      }
      onData({ receipts, unreadAfter: frozenUnreadAfter });
    },
    () => onData({ receipts: [], unreadAfter: null })
  );
}

/**
 * fish `markRead`, as a closure that remembers the newest message time it already wrote (reset by
 * creating a new marker per room mount). Fire-and-forget: write failures are swallowed.
 */
export function createReadMarker(
  ctx: RealtimeContext,
  { competitionId, roomId, userName, isLocked }: RoomArgs & { userName?: string; isLocked: boolean }
) {
  let lastReadMessageTime = 0;
  return (message: ChatListMessage): void => {
    const firebaseUserId = ctx.auth.currentUser?.uid;
    const messageTime = message.createdAt?.toMillis?.() ?? 0;
    if (
      !competitionId ||
      !userName ||
      !firebaseUserId ||
      isLocked ||
      message.pending ||
      !messageTime ||
      messageTime <= lastReadMessageTime
    ) {
      return;
    }

    lastReadMessageTime = messageTime;
    setDoc(
      doc(ctx.chatDb, chatReceiptUserPath(competitionId, roomId, firebaseUserId)),
      {
        userId: firebaseUserId,
        userName,
        lastReadMessageId: message.id,
        lastReadAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    ).catch(() => {});
  };
}

// ── reactions (fish useChatReactions) ─────────────────────────────────────────

/**
 * Emoji reactions listener. The caller gates it with `isLocked` (a room the user cannot read at
 * all — no point paying for a listener nobody can render); a closed chat keeps it running, it just
 * can't take new reactions (`readOnly` gates `toggleReaction` only).
 */
export function subscribeReactions(
  ctx: RealtimeContext,
  { competitionId, roomId }: RoomArgs,
  onData: (reactions: ChatReaction[]) => void
): Unsubscribe {
  return onSnapshot(
    collection(ctx.chatDb, chatReactionsPath(competitionId, roomId)),
    snapshot => onData(snapshot.docs.map(d => toChatReaction(d))),
    () => onData([])
  );
}

export const REACTION_ERROR = 'Reacția nu a putut fi salvată.';

/** Toggles the current user's reaction on a message: write-if-different, delete-if-same. */
export async function toggleReaction(
  ctx: RealtimeContext,
  auth: ChatAuth,
  {
    competitionId,
    roomId,
    messageId,
    emoji,
    currentUserId,
    userName,
    reactions,
    readOnly = false,
  }: RoomArgs & {
    messageId: string;
    emoji: string;
    currentUserId?: string;
    userName?: string;
    reactions: ChatReaction[];
    readOnly?: boolean;
  }
): Promise<void> {
  if (!competitionId || !userName || !currentUserId || readOnly) return;

  const reactionPath = chatReactionUserPath(competitionId, roomId, messageId, currentUserId);
  const existingReaction = reactions.find(reaction => reaction.messageId === messageId && reaction.userId === currentUserId);

  if (existingReaction?.emoji === emoji) {
    await auth.withRetry(() => deleteDoc(doc(ctx.chatDb, reactionPath)));
    return;
  }

  await auth.withRetry(() =>
    setDoc(
      doc(ctx.chatDb, reactionPath),
      { messageId, userId: currentUserId, userName, emoji, updatedAt: serverTimestamp() },
      { merge: true }
    )
  );
}
