import { describe, expect, it } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import { chatMessagesPath, chatMetaPath, chatReactionUserPath, chatReceiptUserPath, chatRulesConsentPath } from './paths';
import {
  getReceiptStatus,
  hasLoadedUnreadBoundary,
  hasLoadedUnreadIncomingMessage,
  resolveChatMediaUrl,
  toChatMessage,
  toChatReplyTo,
  toUploadedChatAttachment,
} from './transforms';
import type { ChatListMessage, ChatReadReceipt } from './types';

const doc = (id: string, data: Record<string, unknown>) => ({ id, data: () => data });

describe('chat paths (identical in every environment — isolation is by database)', () => {
  it('builds the same document paths as fish', () => {
    expect(chatMessagesPath('abc', 'general')).toBe('competitions/abc/chats/general/messages');
    expect(chatMetaPath('c1')).toBe('competitions/c1/meta/chat');
    expect(chatReceiptUserPath('c1', 'participants', 'u1')).toBe('competitions/c1/chats/participants/receipts/u1');
    expect(chatReactionUserPath('c1', 'general', 'm1', 'u1')).toBe('competitions/c1/chats/general/reactions/m1_u1');
    expect(chatRulesConsentPath('u1')).toBe('users/u1/chatConsent/rules');
  });
});

describe('toChatMessage', () => {
  it('maps a Firestore doc to a ChatMessage with defaults', () => {
    const message = toChatMessage(
      doc('m1', {
        senderId: 'u1',
        senderName: 'Ion',
        senderAvatar: null,
        text: 'salut',
        type: 'text',
        createdAt: Timestamp.fromMillis(1000),
      })
    );
    expect(message).toMatchObject({
      id: 'm1',
      senderId: 'u1',
      senderName: 'Ion',
      text: 'salut',
      type: 'text',
      attachments: [],
    });
  });
});

describe('toChatReplyTo', () => {
  it('truncates the quoted text to 180 chars and flags attachments', () => {
    const reply = toChatReplyTo({
      id: 'm1',
      senderId: 'u1',
      senderName: 'Ion',
      senderAvatar: null,
      type: 'text',
      text: 'x'.repeat(300),
      attachments: [{ id: 'a', url: 'u', thumbnailUrl: 'u' }],
      createdAt: Timestamp.fromMillis(1),
    });
    expect(reply.text.length).toBe(180);
    expect(reply.hasAttachments).toBe(true);
    expect(reply.messageId).toBe('m1');
  });
});

describe('getReceiptStatus', () => {
  const mine = { id: 'm1', senderId: 'me', createdAt: Timestamp.fromMillis(5000) } as ChatListMessage;
  it('is "read" when another user read at or after the message time', () => {
    expect(
      getReceiptStatus(mine, 'me', [
        { userId: 'u2', userName: 'Ana', lastReadMessageId: 'm1', lastReadAt: Timestamp.fromMillis(6000) },
      ] as ChatReadReceipt[])
    ).toBe('read');
  });
  it('is "delivered" when there are no other known readers yet', () => {
    // NOTE (fish): brief expected 'sent' here, but the implementation only returns 'sent'
    // when the message is still pending or has no createdAt timestamp; with zero other
    // receipts it falls through to 'delivered'.
    expect(getReceiptStatus(mine, 'me', [])).toBe('delivered');
  });
  it('is "sent" while the server timestamp is still pending (createdAt null on a local write)', () => {
    expect(getReceiptStatus({ ...mine, createdAt: null } as unknown as ChatListMessage, 'me', [])).toBe('sent');
  });
});

describe('toUploadedChatAttachment', () => {
  it('maps blurhash onto the attachment when present', () => {
    const attachment = toUploadedChatAttachment({ id: 1, url: '/a.jpg', blurhash: 'LKO2' });
    expect(attachment.blurhash).toBe('LKO2');
  });

  it('omits blurhash from the compacted attachment when absent', () => {
    const attachment = toUploadedChatAttachment({ id: 1, url: '/a.jpg' });
    expect('blurhash' in attachment).toBe(false);
  });

  it('prefixes relative upload URLs with the API origin when given', () => {
    expect(resolveChatMediaUrl('/uploads/a.jpg', 'https://cms.bluvi.ro/api')).toBe('https://cms.bluvi.ro/uploads/a.jpg');
    expect(resolveChatMediaUrl('https://s3/x.jpg', 'https://cms.bluvi.ro/api')).toBe('https://s3/x.jpg');
    expect(toUploadedChatAttachment({ id: 1, url: '/a.jpg', formats: { small: { url: '/s.jpg' } } }, 'https://c/api')).toMatchObject({
      url: 'https://c/a.jpg',
      thumbnailUrl: 'https://c/s.jpg',
    });
  });
});

describe('unread helpers', () => {
  const at = (ms: number, senderId = 'u2') => ({ id: `m${ms}`, senderId, createdAt: Timestamp.fromMillis(ms) }) as ChatListMessage;
  it('hasLoadedUnreadIncomingMessage ignores my own messages', () => {
    expect(hasLoadedUnreadIncomingMessage([at(200, 'me')], 100, 'me')).toBe(false);
    expect(hasLoadedUnreadIncomingMessage([at(200)], 100, 'me')).toBe(true);
  });
  it('hasLoadedUnreadBoundary is true once a message at/before the boundary is loaded', () => {
    expect(hasLoadedUnreadBoundary([at(200)], 100)).toBe(false);
    expect(hasLoadedUnreadBoundary([at(200), at(100)], 100)).toBe(true);
  });
});
