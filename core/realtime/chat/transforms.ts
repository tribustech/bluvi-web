import type {
  ChatAttachment,
  ChatListMessage,
  ChatMessage,
  ChatPendingAttachment,
  ChatReaction,
  ChatReadReceipt,
  ChatReceiptStatus,
  ChatReplyTo,
} from './types';

/** fish `features/chat/domain/transforms.ts`. Structural doc snapshot, so tests need no SDK. */
export type DocLike = { id: string; data(): unknown };

export type UploadedFile = {
  id: string | number;
  documentId?: string;
  url: string;
  name?: string;
  mime?: string;
  width?: number;
  height?: number;
  blurhash?: string;
  formats?: { thumbnail?: { url: string }; small?: { url: string }; medium?: { url: string }; large?: { url: string } };
};

export function toPendingChatAttachment(attachment: ChatPendingAttachment): ChatAttachment {
  return compactChatAttachment({
    id: attachment.id,
    url: attachment.uri,
    thumbnailUrl: attachment.uri,
    width: attachment.width,
    height: attachment.height,
    mime: attachment.mime,
    name: attachment.name,
  });
}

/**
 * `apiBase` replaces fish's `EXPO_PUBLIC_API_URL` (core never reads env): the CMS API URL whose
 * origin prefixes relative upload URLs. Omitted = relative URLs stay relative.
 */
export function toUploadedChatAttachment(file: UploadedFile, apiBase = ''): ChatAttachment {
  const fullUrl = resolveChatMediaUrl(file.formats?.large?.url ?? file.url, apiBase);
  const thumbnailUrl = resolveChatMediaUrl(
    file.formats?.small?.url ?? file.formats?.thumbnail?.url ?? file.formats?.medium?.url ?? file.url,
    apiBase
  );

  return compactChatAttachment({
    id: file.documentId ?? String(file.id),
    url: fullUrl,
    thumbnailUrl,
    width: file.width,
    height: file.height,
    mime: file.mime,
    name: file.name,
    blurhash: file.blurhash,
  });
}

export function compactChatAttachment(attachment: ChatAttachment): ChatAttachment {
  return Object.fromEntries(
    Object.entries(attachment).filter(([, value]) => value !== undefined && value !== null)
  ) as ChatAttachment;
}

export function resolveChatMediaUrl(url: string | null | undefined, apiBase = '') {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  try {
    const origin = apiBase ? new URL(apiBase).origin : '';
    return origin ? `${origin}${url.startsWith('/') ? url : `/${url}`}` : url;
  } catch {
    return url;
  }
}

export function toChatMessage(doc: DocLike): ChatMessage {
  const data = doc.data() as Omit<ChatMessage, 'id'>;
  return {
    id: doc.id,
    senderId: data.senderId,
    senderName: data.senderName,
    senderAvatar: data.senderAvatar ?? null,
    text: data.text,
    attachments: data.attachments ?? [],
    replyTo: data.replyTo,
    createdAt: data.createdAt,
    editedAt: data.editedAt,
    type: data.type,
    senderRole: data.senderRole,
    event: data.event,
    link: data.link,
    // NOTE: fish does not copy the system-message `data` field here, so `podiumInfoOf` /
    // `systemPartsFor` fall back to parsing the copy. Kept identical to fish; flagged upstream.
    deletedAt: data.deletedAt,
    deletedBy: data.deletedBy,
  };
}

export function toChatReaction(doc: DocLike): ChatReaction {
  const data = doc.data() as Omit<ChatReaction, 'id'>;
  return {
    id: doc.id,
    messageId: data.messageId,
    userId: data.userId,
    userName: data.userName,
    emoji: data.emoji,
    updatedAt: data.updatedAt,
  };
}

export function toChatReplyTo(message: ChatListMessage): ChatReplyTo {
  return {
    messageId: message.id,
    senderId: message.senderId,
    senderName: message.senderName,
    text: message.text.slice(0, 180),
    hasAttachments: !!message.attachments?.length,
  };
}

export function toChatReadReceipt(doc: DocLike): ChatReadReceipt {
  const data = doc.data() as Omit<ChatReadReceipt, 'id'>;
  return {
    id: doc.id,
    userId: data.userId,
    userName: data.userName,
    lastReadMessageId: data.lastReadMessageId,
    lastReadAt: data.lastReadAt,
    updatedAt: data.updatedAt,
  };
}

export function getReceiptStatus(
  message: ChatListMessage,
  currentUserId: string | undefined,
  receipts: ChatReadReceipt[]
): ChatReceiptStatus | undefined {
  if (!currentUserId || message.senderId !== currentUserId) return undefined;
  if (message.pending) return 'sent';

  const messageTime = message.createdAt?.toMillis?.() ?? 0;
  if (!messageTime) return 'sent';

  const otherReceipts = receipts.filter(receipt => receipt.userId !== currentUserId);
  const allKnownReadersReadMessage =
    otherReceipts.length > 0 && otherReceipts.every(receipt => (receipt.lastReadAt?.toMillis?.() ?? 0) >= messageTime);

  return allKnownReadersReadMessage ? 'read' : 'delivered';
}

export function hasLoadedUnreadIncomingMessage(
  messages: ChatListMessage[],
  unreadAfterMs: number,
  currentUserId: string
) {
  return messages.some(message => {
    const messageTime = message.createdAt?.toMillis?.() ?? 0;
    return !message.pending && message.senderId !== currentUserId && messageTime > unreadAfterMs;
  });
}

export function hasLoadedUnreadBoundary(messages: ChatListMessage[], unreadAfterMs: number) {
  return messages.some(message => {
    const messageTime = message.createdAt?.toMillis?.() ?? 0;
    return !message.pending && messageTime > 0 && messageTime <= unreadAfterMs;
  });
}
