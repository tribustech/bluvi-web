import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('firebase/firestore', async orig => (await import('../__tests__/fakeFirestore')).fakeFirestoreModule(await orig()));

import { Timestamp } from 'firebase/firestore';
import type { ChatAuth } from '../firebase';
import { docSnap, fs, querySnap } from '../__tests__/fakeFirestore';
import {
  buildOutboxEntry,
  canDeleteChatMessage,
  deleteChatMessage,
  editChatMessage,
  newChatMessageId,
  sendChatMessage,
} from './messages';
import { createReadMarker, subscribeReactions, subscribeReceipts, toggleReaction } from './receipts';
import { acknowledgeRules, hasAcknowledgedRules, needsRulesAcknowledgement, subscribeChatMeta } from './status';
import { createTypingWriter, subscribeTypingNames, typingLabel, TYPING_IDLE_MS, TYPING_MIN_VISIBLE_MS } from './typing';
import { chatBadgeOf, formatUnread, subscribeCompetitionChatBadge, subscribeRoomUnreadCount } from './unread';
import type { ChatListMessage, ChatReaction } from './types';

const CHAT_DB = { name: 'staging' };
const ctx = { db: { name: '(default)' }, chatDb: CHAT_DB, auth: { currentUser: { uid: 'me' } } } as never;
const auth: ChatAuth = { ensure: vi.fn(async () => true), withRetry: op => op() };
const room = { competitionId: 'c1', roomId: 'general' as const };
const msg = (id: string, ms: number, senderId = 'u2', extra: Partial<ChatListMessage> = {}) =>
  ({ id, senderId, senderName: senderId, senderAvatar: null, text: id, type: 'text', createdAt: Timestamp.fromMillis(ms), ...extra }) as ChatListMessage;
const flush = () => new Promise(resolve => setTimeout(resolve, 0));

beforeEach(() => {
  fs.reset();
  vi.clearAllMocks();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('messages (fish useChatSend)', () => {
  it('edits in place with editedAt = server time', async () => {
    await editChatMessage(ctx, auth, { ...room, messageId: 'm1', text: 'nou' });
    const [ref, data] = fs.updateDoc.mock.calls[0] as unknown as [{ path: string; db: unknown }, unknown];
    expect(ref).toMatchObject({ path: 'competitions/c1/chats/general/messages/m1', db: CHAT_DB });
    expect(data).toEqual({ text: 'nou', editedAt: 'SERVER_TS' });
  });

  it('refuses to edit without Firebase auth', async () => {
    await expect(editChatMessage(ctx, { ...auth, ensure: async () => false }, { ...room, messageId: 'm1', text: 'x' })).rejects.toThrow(
      /autentifica/
    );
    expect(fs.updateDoc).not.toHaveBeenCalled();
  });

  it('soft-deletes as the Firebase user; others only for moderators; never a pending bubble', async () => {
    expect(canDeleteChatMessage(msg('m', 1, 'u2'), 'me', false)).toBe(false);
    expect(canDeleteChatMessage(msg('m', 1, 'u2'), 'me', true)).toBe(true);
    expect(canDeleteChatMessage(msg('m', 1, 'me', { pending: true }), 'me', true)).toBe(false);

    await expect(deleteChatMessage(ctx, auth, { ...room, message: msg('m1', 1, 'me'), currentUserId: 'me', canDeleteAnyMessage: false })).resolves.toBe(true);
    expect(fs.updateDoc.mock.calls[0][1]).toEqual({ deletedAt: 'SERVER_TS', deletedBy: 'me', text: '' });
  });

  it('builds the outbox row fish enqueues and skips an empty send', async () => {
    expect(newChatMessageId(ctx, room)).toMatch(/^auto-/);
    const entry = buildOutboxEntry({
      ...room,
      messageId: 'x1',
      senderId: 'me',
      senderName: 'Eu',
      senderAvatar: null,
      text: 'salut',
      replyToMessage: msg('r1', 1, 'u2', { text: 'q' }),
      senderRole: 'participant',
      attachments: [{ id: 'a1', localUri: 'blob:1', name: 'a.jpg', mime: 'image/jpeg', width: 1, height: 2 }],
      nowMs: 42,
    });
    expect(entry.message).toMatchObject({ id: 'x1', status: 'queued', attempts: 0, createdAt: 42, senderRole: 'participant' });
    expect(JSON.parse(entry.message.replyTo!)).toMatchObject({ messageId: 'r1', text: 'q' });
    expect(entry.attachments[0]).toMatchObject({ messageId: 'x1', position: 0, uploaded: null });

    const outbox = { enqueue: vi.fn(async () => undefined) };
    await expect(sendChatMessage(outbox, { ...entry, message: { ...entry.message, text: '' }, attachments: [] })).resolves.toBe(false);
    await expect(sendChatMessage(outbox, entry)).resolves.toBe(true);
    expect(outbox.enqueue).toHaveBeenCalledTimes(1);
  });
});

describe('receipts + reactions', () => {
  it('freezes my own lastReadAt from the first snapshot as the unread boundary', () => {
    const onData = vi.fn();
    subscribeReceipts(ctx, { ...room, currentUserId: 'me' }, onData);
    const [listener] = fs.on('competitions/c1/chats/general/receipts');
    listener.next(querySnap([['me', { userId: 'me', lastReadAt: Timestamp.fromMillis(100) }]]));
    listener.next(querySnap([['me', { userId: 'me', lastReadAt: Timestamp.fromMillis(900) }]]));
    expect(onData.mock.calls[1][0].unreadAfter.toMillis()).toBe(100);
    expect(onData.mock.calls[1][0].receipts[0].lastReadAt.toMillis()).toBe(900);
    listener.error?.(new Error('x'));
    expect(onData).toHaveBeenLastCalledWith({ receipts: [], unreadAfter: null });
  });

  it('markRead writes a merge receipt once per newer message and never for pending ones', async () => {
    const markRead = createReadMarker(ctx, { ...room, userName: 'Eu', isLocked: false });
    markRead(msg('m2', 200));
    markRead(msg('m1', 100));
    markRead(msg('p', 300, 'me', { pending: true }));
    expect(fs.setDoc).toHaveBeenCalledTimes(1);
    const [ref, data, options] = fs.setDoc.mock.calls[0] as unknown as [{ path: string }, Record<string, unknown>, unknown];
    expect(ref.path).toBe('competitions/c1/chats/general/receipts/me');
    expect(data).toEqual({ userId: 'me', userName: 'Eu', lastReadMessageId: 'm2', lastReadAt: 'SERVER_TS', updatedAt: 'SERVER_TS' });
    expect(options).toEqual({ merge: true });
  });

  it('toggles a reaction: same emoji deletes, another writes', async () => {
    const mine = { id: 'm1_me', messageId: 'm1', userId: 'me', userName: 'Eu', emoji: '👍' } as ChatReaction;
    await toggleReaction(ctx, auth, { ...room, messageId: 'm1', emoji: '👍', currentUserId: 'me', userName: 'Eu', reactions: [mine] });
    expect((fs.deleteDoc.mock.calls[0][0] as { path: string }).path).toBe('competitions/c1/chats/general/reactions/m1_me');
    await toggleReaction(ctx, auth, { ...room, messageId: 'm1', emoji: '❤️', currentUserId: 'me', userName: 'Eu', reactions: [mine] });
    expect(fs.setDoc.mock.calls[0][1]).toEqual({ messageId: 'm1', userId: 'me', userName: 'Eu', emoji: '❤️', updatedAt: 'SERVER_TS' });
    await toggleReaction(ctx, auth, { ...room, messageId: 'm1', emoji: '❤️', currentUserId: 'me', userName: 'Eu', reactions: [], readOnly: true });
    expect(fs.setDoc).toHaveBeenCalledTimes(1);
  });

  it('reactions listener maps docs and resets on error', () => {
    const onData = vi.fn();
    subscribeReactions(ctx, room, onData);
    const [listener] = fs.on('competitions/c1/chats/general/reactions');
    listener.next(querySnap([['m1_u2', { messageId: 'm1', userId: 'u2', userName: 'Ana', emoji: '👍' }]]));
    expect(onData.mock.calls[0][0][0]).toMatchObject({ id: 'm1_u2', emoji: '👍' });
    listener.error?.(new Error('x'));
    expect(onData).toHaveBeenLastCalledWith([]);
  });
});

describe('typing', () => {
  it('throttles "typing" writes and clears after the idle delay', async () => {
    vi.useFakeTimers();
    let t = 10_000;
    const writer = createTypingWriter(ctx, { ...room, userName: 'Eu', isLocked: false }, () => t);
    writer.onTypingChange(true);
    t += 1000;
    writer.onTypingChange(true);
    expect(fs.setDoc).toHaveBeenCalledTimes(1);
    expect(fs.setDoc.mock.calls[0][1]).toMatchObject({ userId: 'me', isTyping: true });
    vi.advanceTimersByTime(TYPING_IDLE_MS);
    expect(fs.setDoc).toHaveBeenCalledTimes(2);
    expect(fs.setDoc.mock.calls[1][1]).toMatchObject({ isTyping: false });
    writer.dispose();
    expect(fs.setDoc).toHaveBeenCalledTimes(3);
  });

  it('shows other typers at once and holds the row for its minimum time', () => {
    vi.useFakeTimers();
    let t = 100_000;
    const onNames = vi.fn();
    subscribeTypingNames(ctx, { ...room, currentUserId: 'me' }, onNames, () => t);
    const [listener] = fs.on('competitions/c1/chats/general/typing');
    listener.next(
      querySnap([
        ['u2', { userId: 'u2', userName: 'Ana', isTyping: true, updatedAt: Timestamp.fromMillis(t - 100) }],
        ['me', { userId: 'me', userName: 'Eu', isTyping: true, updatedAt: Timestamp.fromMillis(t) }],
        ['u3', { userId: 'u3', userName: 'Vechi', isTyping: true, updatedAt: Timestamp.fromMillis(t - 60_000) }],
      ])
    );
    expect(onNames).toHaveBeenLastCalledWith(['Ana']);
    t += 200;
    listener.next(querySnap([]));
    expect(onNames).toHaveBeenLastCalledWith(['Ana']);
    vi.advanceTimersByTime(TYPING_MIN_VISIBLE_MS);
    expect(onNames).toHaveBeenLastCalledWith([]);
  });

  it('labels one, two and many typers', () => {
    expect(typingLabel([])).toBeNull();
    expect(typingLabel(['Ana'])).toBe('Ana scrie...');
    expect(typingLabel(['Ana', 'Ion'])).toBe('Ana și Ion scriu...');
    expect(typingLabel(['Ana', 'Ion', 'Dan'])).toBe('Ana și încă 2 scriu...');
  });
});

describe('unread badge', () => {
  it('counts only when the newest message is someone else’s and newer than my receipt, capped', async () => {
    fs.getCountFromServer.mockResolvedValue({ data: () => ({ count: 250 }) });
    const onCount = vi.fn();
    subscribeRoomUnreadCount(ctx, { ...room, uid: 'me' }, onCount);
    const [newest] = fs.on('competitions/c1/chats/general/messages');
    const [receipt] = fs.on('competitions/c1/chats/general/receipts/me');
    receipt.next(docSnap({ lastReadAt: Timestamp.fromMillis(100) }));
    newest.next(querySnap([['m9', { senderId: 'me', createdAt: Timestamp.fromMillis(500) }]]));
    expect(onCount).toHaveBeenLastCalledWith(0);
    newest.next(querySnap([['m10', { senderId: 'u2', createdAt: Timestamp.fromMillis(600) }]]));
    await flush();
    expect(onCount).toHaveBeenLastCalledWith(100);
    const q = fs.getCountFromServer.mock.calls[0][0] as unknown as { constraints: { type: string; value: Timestamp }[] };
    expect(q.constraints[0]).toMatchObject({ type: 'where' });
    expect(q.constraints[0].value.toMillis()).toBe(100);
    expect(formatUnread(100)).toBe('99+');
  });

  it('falls back to one unread when the aggregate count fails', async () => {
    fs.getCountFromServer.mockRejectedValue(new Error('x'));
    const onCount = vi.fn();
    subscribeRoomUnreadCount(ctx, { ...room, uid: 'me' }, onCount);
    fs.on('competitions/c1/chats/general/messages')[0].next(querySnap([['m', { senderId: 'u2', createdAt: Timestamp.fromMillis(5) }]]));
    await flush();
    expect(onCount).toHaveBeenLastCalledWith(1);
  });

  it('badge: "Nou" when no room was ever opened, the count otherwise', () => {
    expect(chatBadgeOf({ general: 0, participants: 0 }, null)).toBeNull();
    expect(chatBadgeOf({ general: 3, participants: 0 }, { general: false, participants: false })).toEqual({ text: 'Nou', tone: 'info' });
    expect(chatBadgeOf({ general: 3, participants: 2 }, { general: true, participants: false })).toEqual({ text: '5', tone: 'alert' });
    expect(chatBadgeOf({ general: 3, participants: 0 }, null)).toEqual({ text: '3', tone: 'alert' });
  });

  it('competition badge listens to Participanți only for members', async () => {
    subscribeCompetitionChatBadge(ctx, auth, { competitionId: 'c1', profileDocumentId: 'me', isMember: false }, vi.fn());
    await flush();
    expect(fs.listeners.some(l => l.ref.path.includes('/participants/'))).toBe(false);
    expect(fs.listeners.some(l => l.ref.path === 'competitions/c1/chats/general/receipts/me')).toBe(true);
  });
});

describe('chat meta + rules consent', () => {
  it('waits for auth, then maps closesAt; retries once on a listener error', async () => {
    const onMeta = vi.fn();
    subscribeChatMeta(ctx, auth, 'c1', onMeta);
    await flush();
    const [first] = fs.on('competitions/c1/meta/chat');
    first.next(docSnap({ closesAt: Timestamp.fromMillis(5000), reason: 'cancelled' }));
    expect(onMeta).toHaveBeenLastCalledWith({ closesAtMs: 5000, reason: 'cancelled' }, true);

    first.error?.({ code: 'permission-denied' });
    await flush();
    expect(first.unsub).toHaveBeenCalled();
    const second = fs.on('competitions/c1/meta/chat')[1];
    second.error?.({ code: 'permission-denied' });
    expect(onMeta).toHaveBeenLastCalledWith(null, true);
    expect(fs.on('competitions/c1/meta/chat')).toHaveLength(2);
  });

  it('asks for the rules only when the consent doc is missing, and remembers the acknowledgement', async () => {
    fs.getDoc.mockResolvedValueOnce(docSnap(undefined));
    await expect(needsRulesAcknowledgement(ctx, auth, 'u-consent')).resolves.toBe(true);
    await acknowledgeRules(ctx, 'u-consent');
    expect(fs.setDoc.mock.calls[0][1]).toEqual({ acceptedAt: 'SERVER_TS' });
    expect((fs.setDoc.mock.calls[0][0] as { path: string }).path).toBe('users/u-consent/chatConsent/rules');
    expect(hasAcknowledgedRules('u-consent')).toBe(true);
    await expect(needsRulesAcknowledgement(ctx, auth, 'u-consent')).resolves.toBe(false);

    fs.getDoc.mockRejectedValueOnce(new Error('offline'));
    await expect(needsRulesAcknowledgement(ctx, auth, 'u-other')).resolves.toBe(false);
  });
});
