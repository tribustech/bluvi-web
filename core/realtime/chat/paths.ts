import type { ChatRoomId } from './types';

/**
 * fish `features/chat/domain/chatPaths.ts`. Environment isolation is by DATABASE, not by path
 * (see `chatDatabaseId` / `RealtimeContext.chatDb` in `../firebase.ts`): every environment uses
 * these same document paths.
 */
const COMPETITIONS_COLLECTION = 'competitions';
const CHATS_COLLECTION = 'chats';
const MESSAGES_COLLECTION = 'messages';
const TYPING_COLLECTION = 'typing';
const REACTIONS_COLLECTION = 'reactions';
const RECEIPTS_COLLECTION = 'receipts';
const PARTICIPANTS_COLLECTION = 'participants';
const ORGANIZERS_COLLECTION = 'organizers';
const USERS_COLLECTION = 'users';

export function chatMessagesPath(competitionId: string, roomId: ChatRoomId) {
  return `${COMPETITIONS_COLLECTION}/${competitionId}/${CHATS_COLLECTION}/${roomId}/${MESSAGES_COLLECTION}`;
}

export function chatMessagePath(competitionId: string, roomId: ChatRoomId, messageId: string) {
  return `${chatMessagesPath(competitionId, roomId)}/${messageId}`;
}

export function chatTypingPath(competitionId: string, roomId: ChatRoomId) {
  return `${COMPETITIONS_COLLECTION}/${competitionId}/${CHATS_COLLECTION}/${roomId}/${TYPING_COLLECTION}`;
}

export function chatTypingUserPath(competitionId: string, roomId: ChatRoomId, userDocumentId: string) {
  return `${chatTypingPath(competitionId, roomId)}/${userDocumentId}`;
}

export function chatReactionsPath(competitionId: string, roomId: ChatRoomId) {
  return `${COMPETITIONS_COLLECTION}/${competitionId}/${CHATS_COLLECTION}/${roomId}/${REACTIONS_COLLECTION}`;
}

export function chatReceiptsPath(competitionId: string, roomId: ChatRoomId) {
  return `${COMPETITIONS_COLLECTION}/${competitionId}/${CHATS_COLLECTION}/${roomId}/${RECEIPTS_COLLECTION}`;
}

export function chatReceiptUserPath(competitionId: string, roomId: ChatRoomId, userDocumentId: string) {
  return `${chatReceiptsPath(competitionId, roomId)}/${userDocumentId}`;
}

/** §3 closing gate: written by the CMS only, read by every signed-in client. */
export function chatMetaPath(competitionId: string) {
  return `${COMPETITIONS_COLLECTION}/${competitionId}/meta/chat`;
}

export function chatReactionUserPath(
  competitionId: string,
  roomId: ChatRoomId,
  messageId: string,
  userDocumentId: string
) {
  return `${chatReactionsPath(competitionId, roomId)}/${messageId}_${userDocumentId}`;
}

export function chatParticipantPath(competitionId: string, userDocumentId: string) {
  return `${COMPETITIONS_COLLECTION}/${competitionId}/${PARTICIPANTS_COLLECTION}/${userDocumentId}`;
}

export function chatOrganizerPath(competitionId: string, userDocumentId: string) {
  return `${COMPETITIONS_COLLECTION}/${competitionId}/${ORGANIZERS_COLLECTION}/${userDocumentId}`;
}

/** One doc per account: the chat rules acknowledgement (`acceptedAt`), asked once, on any device. */
export function chatRulesConsentPath(userDocumentId: string) {
  return `${USERS_COLLECTION}/${userDocumentId}/chatConsent/rules`;
}
