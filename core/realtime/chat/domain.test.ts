import { describe, expect, it } from 'vitest';
import {
  buildRoomGallery,
  CHAT_CLOSE_DELAY_MS,
  chatMembershipOf,
  evictedFromWindow,
  galleryIndexOf,
  prependEvicted,
  resolveChatClosing,
  shouldRetryWithoutRole,
  shouldShowConversationStart,
  splitHiddenNewest,
  summarizeReactions,
  withoutSenderRole,
} from './domain';
import type { ChatListMessage, ChatReaction } from './types';

// ── fish __tests__/sendFallback.test.ts ──
{
describe('shouldRetryWithoutRole', () => {
  it('retries only a permission-denied create that carried a role', () => {
    expect(shouldRetryWithoutRole({ code: 'firestore/permission-denied' }, { senderRole: 'organizer' })).toBe(true);
    expect(shouldRetryWithoutRole({ code: 'permission-denied' }, { senderRole: 'participant' })).toBe(true);
    expect(shouldRetryWithoutRole({ code: 'firestore/permission-denied' }, {})).toBe(false);
    expect(shouldRetryWithoutRole({ code: 'unavailable' }, { senderRole: 'organizer' })).toBe(false);
    expect(shouldRetryWithoutRole(new Error('network'), { senderRole: 'organizer' })).toBe(false);
  });
});

describe('withoutSenderRole', () => {
  it('drops only senderRole', () => {
    expect(withoutSenderRole({ text: 'a', senderRole: 'organizer', type: 'text' })).toEqual({ text: 'a', type: 'text' });
    expect('senderRole' in withoutSenderRole({ text: 'a' })).toBe(false);
  });
});
}

// ── fish __tests__/membership.test.ts ──
{
describe('chatMembershipOf', () => {
  it('gives a plain follower General only, with no role chip', () => {
    expect(chatMembershipOf({ userRole: null })).toEqual({
      isOrganizerSide: false,
      canUseParticipantsChat: false,
      senderRole: undefined,
    });
    expect(chatMembershipOf(undefined)).toEqual({
      isOrganizerSide: false,
      canUseParticipantsChat: false,
      senderRole: undefined,
    });
  });

  it('treats the author as organizer-side', () => {
    expect(chatMembershipOf({ userRole: 'author' })).toEqual({
      isOrganizerSide: true,
      canUseParticipantsChat: true,
      senderRole: 'organizer',
    });
  });

  it('treats a referee as organizer-side with his own chip: he sees the Participanți room', () => {
    expect(chatMembershipOf({ userRole: 'referee', isReferee: true, isParticipant: false })).toEqual({
      isOrganizerSide: true,
      canUseParticipantsChat: true,
      senderRole: 'referee',
    });
  });

  it('keeps the Participanți room for a referee who is also a registered participant', () => {
    // The statute answers `referee` first; the flag is what says he is on a team too.
    expect(chatMembershipOf({ userRole: 'referee', isReferee: true, isParticipant: true })).toEqual({
      isOrganizerSide: true,
      canUseParticipantsChat: true,
      senderRole: 'referee',
    });
  });

  it('honours the participant flag whatever userRole says (older statute shapes stay valid)', () => {
    expect(chatMembershipOf({ userRole: 'participant' })).toEqual({
      isOrganizerSide: false,
      canUseParticipantsChat: true,
      senderRole: 'participant',
    });
    expect(chatMembershipOf({ userRole: null, isParticipant: true })).toEqual({
      isOrganizerSide: false,
      canUseParticipantsChat: true,
      senderRole: 'participant',
    });
  });
});
}

// ── fish __tests__/chatClosing.test.ts ──
{
const now = Date.parse('2026-07-02T10:00:00Z');

describe('resolveChatClosing', () => {
  it('is open while no meta doc exists and the competition is live', () => {
    expect(resolveChatClosing({ meta: null, metaLoaded: true, competitionStatus: 'started', endDate: null, nowMs: now })).toEqual({
      closesAtMs: null,
      isClosed: false,
    });
  });
  it('follows the meta doc', () => {
    expect(resolveChatClosing({ meta: { closesAtMs: now + 1000, reason: 'completed' }, metaLoaded: true, nowMs: now })).toEqual({
      closesAtMs: now + 1000,
      isClosed: false,
    });
    expect(resolveChatClosing({ meta: { closesAtMs: now - 1, reason: 'completed' }, metaLoaded: true, nowMs: now })).toEqual({
      closesAtMs: now - 1,
      isClosed: true,
    });
  });
  it('closes a cancelled competition without a meta doc', () => {
    expect(resolveChatClosing({ meta: null, metaLoaded: true, competitionStatus: 'cancelled', nowMs: now }).isClosed).toBe(true);
  });
  it('closes a competition completed more than a day ago without a meta doc (pre-release competitions)', () => {
    const endDate = new Date(now - CHAT_CLOSE_DELAY_MS - 60_000).toISOString();
    expect(resolveChatClosing({ meta: null, metaLoaded: true, competitionStatus: 'completed', endDate, nowMs: now })).toEqual({
      closesAtMs: Date.parse(endDate) + CHAT_CLOSE_DELAY_MS,
      isClosed: true,
    });
    const recent = new Date(now - 60_000).toISOString();
    expect(resolveChatClosing({ meta: null, metaLoaded: true, competitionStatus: 'completed', endDate: recent, nowMs: now }).isClosed).toBe(false);
  });
  it('stays open until the meta listener has answered', () => {
    expect(resolveChatClosing({ meta: null, metaLoaded: false, competitionStatus: 'cancelled', nowMs: now }).isClosed).toBe(false);
  });
});
}

// ── fish __tests__/conversationStart.test.ts ──
{
describe('shouldShowConversationStart', () => {
  it('shows the header once the whole history is loaded', () => {
    expect(shouldShowConversationStart({ messageCount: 12, hasMore: false, isLoading: false })).toBe(true);
  });

  it('stays hidden while older pages are still available', () => {
    expect(shouldShowConversationStart({ messageCount: 50, hasMore: true, isLoading: false })).toBe(false);
  });

  it('stays hidden while the room is loading', () => {
    expect(shouldShowConversationStart({ messageCount: 12, hasMore: false, isLoading: true })).toBe(false);
    // Loading wins even when the count and the cursor would otherwise allow it.
    expect(shouldShowConversationStart({ messageCount: 0, hasMore: true, isLoading: true })).toBe(false);
  });

  it('stays hidden for an empty room — the empty state covers that', () => {
    expect(shouldShowConversationStart({ messageCount: 0, hasMore: false, isLoading: false })).toBe(false);
  });

  it('shows for a single-message room', () => {
    expect(shouldShowConversationStart({ messageCount: 1, hasMore: false, isLoading: false })).toBe(true);
  });
});
}

// ── fish __tests__/hiddenNewest.test.ts ──
{
const msg = (id: string): ChatListMessage =>
  ({ id, senderId: 'u', senderName: 'u', senderAvatar: null, text: id, type: 'text' }) as ChatListMessage;
const list = [msg('m5'), msg('m4'), msg('m3'), msg('m2'), msg('m1')]; // newest first

describe('splitHiddenNewest', () => {
  it('hides nothing without an anchor and returns the same array', () => {
    const out = splitHiddenNewest(list, null);
    expect(out.visible).toBe(list);
    expect(out.hiddenCount).toBe(0);
  });

  it('shows the anchor and everything older, counts what is newer', () => {
    const out = splitHiddenNewest(list, 'm3');
    expect(out.visible.map(m => m.id)).toEqual(['m3', 'm2', 'm1']);
    expect(out.hiddenCount).toBe(2);
  });

  it('hides nothing when the anchor is the newest message', () => {
    const out = splitHiddenNewest(list, 'm5');
    expect(out.visible).toBe(list);
    expect(out.hiddenCount).toBe(0);
  });

  it('reveals everything when the anchor is gone', () => {
    const out = splitHiddenNewest(list, 'zzz');
    expect(out.visible).toBe(list);
    expect(out.hiddenCount).toBe(0);
  });

  it('keeps older pages appended while hidden', () => {
    const grown = [...list, msg('m0')];
    expect(splitHiddenNewest(grown, 'm3').visible.map(m => m.id)).toEqual(['m3', 'm2', 'm1', 'm0']);
  });
});
}

// ── fish __tests__/reactionSummary.test.ts ──
{
const r = (userId: string, userName: string, emoji: string): ChatReaction =>
  ({ id: `${userId}-${emoji}`, messageId: 'm', userId, userName, emoji, updatedAt: {} as ChatReaction['updatedAt'] });

describe('summarizeReactions', () => {
  it('groups by emoji in first-seen order and lists who reacted', () => {
    const out = summarizeReactions([r('u1', 'Ana', '👍'), r('u2', 'Bogdan', '❤️'), r('me', 'Eu', '👍')], 'me');
    expect(out).toEqual([
      { emoji: '👍', count: 2, reactedByMe: true, users: [{ userId: 'u1', userName: 'Ana' }, { userId: 'me', userName: 'Eu' }] },
      { emoji: '❤️', count: 1, reactedByMe: false, users: [{ userId: 'u2', userName: 'Bogdan' }] },
    ]);
  });
  it('returns an empty list for no reactions', () => {
    expect(summarizeReactions([], 'me')).toEqual([]);
  });
});
}

// ── fish __tests__/roomWindow.test.ts ──
{
const msg = (id: string, ms: number | null): ChatListMessage =>
  ({
    id,
    senderId: 'u',
    senderName: 'u',
    senderAvatar: null,
    text: id,
    type: 'text',
    createdAt: ms == null ? (undefined as unknown as ChatListMessage['createdAt']) : { toMillis: () => ms, toDate: () => new Date(ms) },
  }) as ChatListMessage;

describe('evictedFromWindow', () => {
  it('returns the hydrated messages that left the window', () => {
    const prev = [msg('m52', 52), msg('m51', 51)];
    const next = [msg('m53', 53), msg('m52', 52)];
    expect(evictedFromWindow(prev, next).map(m => m.id)).toEqual(['m51']);
  });

  it('ignores unhydrated (pending local) docs and an empty previous window', () => {
    expect(evictedFromWindow([msg('p', null)], [])).toEqual([]);
    expect(evictedFromWindow([], [msg('m1', 1)])).toEqual([]);
  });
});

describe('prependEvicted', () => {
  it('puts evicted docs before the older pages, newest first, without duplicates', () => {
    const older = [msg('m50', 50), msg('m49', 49)];
    const out = prependEvicted([msg('m51', 51), msg('m52', 52)], older);
    expect(out.map(m => m.id)).toEqual(['m52', 'm51', 'm50', 'm49']);
  });

  it('drops evicted docs already present in older and returns the same array when nothing changes', () => {
    const older = [msg('m50', 50)];
    expect(prependEvicted([msg('m50', 50)], older)).toBe(older);
    expect(prependEvicted([], older)).toBe(older);
  });
});
}

// ── fish __tests__/roomGallery.test.ts ──
{
const att = (id: string) => ({ id, url: `https://x/${id}.jpg`, thumbnailUrl: `https://x/${id}-t.jpg` });
const msg = (partial: Partial<ChatListMessage> & { id: string }): ChatListMessage =>
  ({ senderId: 'u1', senderName: 'Ana', type: 'text', createdAt: { toDate: () => new Date(0) }, ...partial }) as ChatListMessage;

describe('buildRoomGallery', () => {
  it('flattens photos oldest first, in bubble order, with per-photo sender meta', () => {
    const messages = [
      msg({ id: 'm3', senderId: 'me', senderName: 'Eu', attachments: [att('c')] }),
      msg({ id: 'm2', text: 'no photos' }),
      msg({ id: 'm1', attachments: [att('a'), att('b')] }),
    ];
    const gallery = buildRoomGallery(messages, 'me', m => `t-${m.id}`);
    expect(gallery.attachments.map(a => a.id)).toEqual(['a', 'b', 'c']);
    expect(gallery.meta).toEqual([
      { senderName: 'Ana', isMine: false, sentAt: 't-m1' },
      { senderName: 'Ana', isMine: false, sentAt: 't-m1' },
      { senderName: 'Eu', isMine: true, sentAt: 't-m3' },
    ]);
    expect(galleryIndexOf(gallery, 'c')).toBe(2);
  });
  it('skips deleted and pending messages', () => {
    const messages = [
      msg({ id: 'p', pending: true, attachments: [att('p1')] }),
      msg({ id: 'd', deletedAt: {} as ChatListMessage['deletedAt'], attachments: [att('d1')] }),
      msg({ id: 'k', attachments: [att('k1')] }),
    ];
    expect(buildRoomGallery(messages, 'me', () => '').attachments.map(a => a.id)).toEqual(['k1']);
  });
});
}
