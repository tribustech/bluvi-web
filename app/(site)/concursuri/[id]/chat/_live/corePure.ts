import { CHAT_SEND_ERRORS, buildOutboxEntry, sendChatMessage } from '@/core/realtime/chat/messages';
import { REACTION_ERROR } from '@/core/realtime/chat/receipts';
import {
  CHAT_ROOM_ERRORS,
  createEmptyRoomCache,
  isUnreadBoundaryLoaded,
  mergeDisplayedMessages,
  needsUnreadBoundaryBackfill,
} from '@/core/realtime/chat/room';
import { RULES_CONSENT_ERROR } from '@/core/realtime/chat/status';
import { typingLabel } from '@/core/realtime/chat/typing';

/*
 * The pure helpers of core/realtime/chat that live in modules which ALSO import the Firestore SDK
 * (room.ts, messages.ts, receipts.ts, status.ts). Importing them from the page's hooks would put
 * the SDK in the route's first chunk, so each ChatSource carries them (`source.pure`) from its own
 * on-demand chunk. Modules without the SDK (domain, format, listItems, transforms, paths…) are
 * imported directly.
 */
export const corePure = {
  createEmptyRoomCache,
  mergeDisplayedMessages,
  isUnreadBoundaryLoaded,
  needsUnreadBoundaryBackfill,
  buildOutboxEntry,
  sendChatMessage,
  CHAT_ROOM_ERRORS,
  CHAT_SEND_ERRORS,
  REACTION_ERROR,
  RULES_CONSENT_ERROR,
  typingLabel,
};

export type CorePure = typeof corePure;
