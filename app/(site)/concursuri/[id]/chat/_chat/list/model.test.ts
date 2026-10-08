import { describe, expect, it } from 'vitest';
import type { chat } from '@/core/realtime';
import { canDeleteChatMessage } from '@/core/realtime/chat/messages';
import {
  actionsFor,
  clampZoom,
  menuPlacement,
  nextHiddenAnchor,
  shouldLoadOlder,
  viewerTitle,
  bubbleShape,
  canDeleteMessage,
  deletedCopy,
  messagesForRoom,
  myReaction,
  originalsById,
  photoLayout,
  pillCount,
  reactorName,
  readTarget,
  replyQuoteText,
  roleLabel,
  systemTarget,
  tickOf,
} from './model';

/* participant.chat — the message list's pure rules (c12–c24, c27, c31, c33–c39). */

const at = (ms: number) => ({ toMillis: () => ms, toDate: () => new Date(ms) }) as unknown as chat.ChatListMessage['createdAt'];
const msg = (over: Partial<chat.ChatListMessage> = {}): chat.ChatListMessage => ({
  id: 'm1',
  senderId: 'u-ion',
  senderName: 'Ion',
  senderAvatar: null,
  text: 'Salut',
  createdAt: at(1_000),
  type: 'text',
  ...over,
});
const ME = 'me';

describe('groups (c16)', () => {
  it('names and avatars only the first message of others’ groups', () => {
    expect(bubbleShape('single', false)).toEqual({ isFirst: true, isLast: true, showName: true, avatar: 'avatar' });
    expect(bubbleShape('first', false)).toEqual({ isFirst: true, isLast: false, showName: true, avatar: 'avatar' });
    expect(bubbleShape('middle', false)).toEqual({ isFirst: false, isLast: false, showName: false, avatar: 'spacer' });
    expect(bubbleShape('last', false)).toEqual({ isFirst: false, isLast: true, showName: false, avatar: 'spacer' });
    expect(bubbleShape('single', true)).toEqual({ isFirst: true, isLast: true, showName: false, avatar: 'none' });
  });
  it('role label only in General', () => {
    expect(roleLabel('participant', 'general')).toBe('Participant');
    expect(roleLabel('organizer', 'general')).toBe('Organizator');
    expect(roleLabel('referee', 'general')).toBe('Arbitru');
    expect(roleLabel('organizer', 'participants')).toBeNull();
    expect(roleLabel(undefined, 'general')).toBeNull();
  });
});

describe('ticks (c17)', () => {
  it('✓ pending, ✓✓ delivered / read, nothing on others’ bubbles', () => {
    expect(tickOf(msg({ pending: true, receiptStatus: 'read' }), true)).toBe('sent');
    expect(tickOf(msg({ receiptStatus: 'delivered' }), true)).toBe('delivered');
    expect(tickOf(msg({ receiptStatus: 'read' }), true)).toBe('read');
    expect(tickOf(msg({ receiptStatus: 'read' }), false)).toBeNull();
    expect(tickOf(msg(), true)).toBeNull();
  });
});

describe('deleted (c18) and quotes (c19)', () => {
  it('deleted by the sender / by a moderator', () => {
    expect(deletedCopy({ senderId: 'a', deletedBy: 'a' })).toBe('Acest mesaj a fost șters');
    expect(deletedCopy({ senderId: 'a', deletedBy: undefined })).toBe('Acest mesaj a fost șters');
    expect(deletedCopy({ senderId: 'a', deletedBy: 'org' })).toBe('Acest mesaj a fost șters de organizator');
  });
  it('the quote: deleted → «Mesaj șters», edited → the current text, else snapshot / Imagine / Mesaj', () => {
    const replyTo = { messageId: 'o', senderId: 'a', senderName: 'Ana', text: 'vechi' };
    const originals = originalsById([msg({ id: 'o', text: 'nou (editat)' }), msg({ id: 'd', deletedAt: at(5) })]);
    expect(replyQuoteText(replyTo, originals.get('o'))).toEqual({ text: 'nou (editat)', deleted: false });
    expect(replyQuoteText({ ...replyTo, messageId: 'd' }, originals.get('d'))).toEqual({ text: 'Mesaj șters', deleted: true });
    expect(replyQuoteText(replyTo, undefined)).toEqual({ text: 'vechi', deleted: false });
    expect(replyQuoteText({ ...replyTo, text: '', hasAttachments: true }, undefined).text).toBe('Imagine');
    expect(replyQuoteText({ ...replyTo, text: '' }, undefined).text).toBe('Mesaj');
  });
});

describe('photos (c20)', () => {
  it('one photo: 260 wide, ratio clamped between 3:4 and 16:10 (4:3 without a size)', () => {
    expect(photoLayout([{ width: 1000, height: 1000 }])?.tiles[0]).toEqual({ index: 0, width: 260, height: 260, overflow: 0 });
    expect(photoLayout([{ width: 400, height: 2000 }])?.tiles[0].height).toBe(Math.round(260 / 0.75));
    expect(photoLayout([{ width: 3000, height: 500 }])?.tiles[0].height).toBe(Math.round(260 / 1.6));
    expect(photoLayout([{}])?.tiles[0].height).toBe(195);
    expect(photoLayout([])).toBeNull();
  });
  it('2–4 photos: square tiles; more: 4 tiles with «+{n-3}» on the 4th', () => {
    const two = photoLayout([{}, {}])!;
    expect(two.kind).toBe('grid');
    expect(two.tiles).toEqual([
      { index: 0, width: 129, height: 129, overflow: 0 },
      { index: 1, width: 129, height: 129, overflow: 0 },
    ]);
    expect(photoLayout([{}, {}, {}, {}])!.tiles.map(t => t.overflow)).toEqual([0, 0, 0, 0]);
    const seven = photoLayout(Array.from({ length: 7 }, () => ({})))!;
    expect(seven.tiles).toHaveLength(4);
    expect(seven.tiles[3].overflow).toBe(4);
  });
});

describe('actions (c23, c24, c27, c31)', () => {
  const opts = { currentUserId: ME, canDeleteAnyMessage: false, closed: false };
  it('mine: reply, copy, edit, delete and the reaction bar', () => {
    expect(actionsFor(msg({ senderId: ME }), opts)).toEqual({ mode: 'message', react: true, reply: true, copy: true, edit: true, delete: true });
  });
  it('others’: no edit, no delete unless I am the author', () => {
    expect(actionsFor(msg(), opts)).toEqual({ mode: 'message', react: true, reply: true, copy: true, edit: false, delete: false });
    expect(actionsFor(msg(), { ...opts, canDeleteAnyMessage: true })).toMatchObject({ delete: true, edit: false });
  });
  it('a photo without text: no copy, no edit', () => {
    expect(actionsFor(msg({ senderId: ME, text: '' }), opts)).toMatchObject({ copy: false, edit: false, delete: true });
  });
  it('no menu on system, pending, deleted rows or in a closed chat', () => {
    expect(actionsFor(msg({ type: 'system' }), opts).mode).toBe('none');
    expect(actionsFor(msg({ senderId: ME, pending: true, outbox: { status: 'uploading' } }), opts).mode).toBe('none');
    expect(actionsFor(msg({ deletedAt: at(9) }), opts).mode).toBe('none');
    expect(actionsFor(msg(), { ...opts, closed: true }).mode).toBe('none');
  });
  it('a failed send: only Reîncearcă / Șterge, even once the chat closed', () => {
    const failed = msg({ senderId: ME, pending: true, outbox: { status: 'failed' } });
    expect(actionsFor(failed, opts)).toEqual({ mode: 'outbox' });
    expect(actionsFor(failed, { ...opts, closed: true })).toEqual({ mode: 'outbox' });
  });
  it('the delete guard is core’s', () => {
    for (const m of [msg(), msg({ senderId: ME }), msg({ senderId: ME, pending: true })]) {
      for (const any of [true, false]) expect(canDeleteMessage(m, ME, any)).toBe(canDeleteChatMessage(m, ME, any));
    }
  });
  it('my reaction and the reactors’ names', () => {
    expect(myReaction(msg({ reactions: [{ emoji: '👍', count: 1, reactedByMe: false, users: [] }, { emoji: '😂', count: 2, reactedByMe: true, users: [] }] }))).toBe('😂');
    expect(myReaction(msg())).toBeUndefined();
    expect(reactorName({ userId: ME, userName: 'Andrei' }, ME)).toBe('Andrei (eu)');
    expect(reactorName({ userId: 'x', userName: 'Ana' }, ME)).toBe('Ana');
  });
});

describe('pill (c35), rooms (c36), links (c37)', () => {
  it('count caps at 99+', () => {
    expect(pillCount(0)).toBeNull();
    expect(pillCount(7)).toBe('7');
    expect(pillCount(99)).toBe('99');
    expect(pillCount(100)).toBe('99+');
  });
  it('Participanți hides competition events, keeps the closing ones', () => {
    const list = [msg({ id: 'a' }), msg({ id: 's', type: 'system', event: 'competition:start' }), msg({ id: 'c', type: 'system', event: 'chat:closing' })];
    expect(messagesForRoom(list, 'participants').map(m => m.id)).toEqual(['a', 'c']);
    expect(messagesForRoom(list, 'general').map(m => m.id)).toEqual(['a', 's', 'c']);
  });
  it('ranking / participants / penalties / weighing; broken links lead nowhere', () => {
    expect(systemTarget({ kind: 'ranking' }, 'c1')).toEqual({ kind: 'href', href: '/concursuri/c1/clasament' });
    expect(systemTarget({ kind: 'allocation' }, 'c1')).toEqual({ kind: 'href', href: '/concursuri/c1/participanti' });
    expect(systemTarget({ kind: 'registrations' }, 'c1')).toEqual({ kind: 'href', href: '/concursuri/c1/participanti' });
    expect(systemTarget({ kind: 'weighing', id: 'w1', params: { standId: 's1', standName: 'A7', sectorName: 'A' } }, 'c1')).toEqual({
      kind: 'weighing',
      weighingId: 'w1',
      standId: 's1',
      standName: 'A7',
      sectorName: 'A',
    });
    expect(systemTarget({ kind: 'weighing', id: 'w1', params: { standId: 's1' } }, 'c1')).toBeNull();
    expect(systemTarget({ kind: 'penalties' }, 'c1')).toEqual({ kind: 'href', href: '/concursuri/c1/penalizari' });
    expect(systemTarget({ kind: 'nope' }, 'c1')).toBeNull();
    expect(systemTarget(undefined, 'c1')).toBeNull();
  });
});

describe('read receipts (c33)', () => {
  it('the newest delivered row seen; pending rows never', () => {
    const a = msg({ id: 'a', createdAt: at(10) });
    const b = msg({ id: 'b', createdAt: at(30), senderId: ME });
    const p = msg({ id: 'p', pending: true, createdAt: at(50) });
    expect(readTarget([a, b, p], 'p', p)?.id).toBe('b');
    expect(readTarget([p], 'p', p)).toBeNull();
  });
  it('reaching the newest shown row reads what the room hides after it', () => {
    const shown = msg({ id: 'shown', createdAt: at(10) });
    const hidden = msg({ id: 'hidden', type: 'system', event: 'competition:start', createdAt: at(20) });
    expect(readTarget([shown], 'shown', hidden)?.id).toBe('hidden');
    expect(readTarget([shown], 'other', hidden)?.id).toBe('shown');
  });
});

describe('scrolling (c12, c35)', () => {
  it('asks for older messages 1.5 screens before the top, once, while there are any', () => {
    expect(shouldLoadOlder({ distanceToTop: 1100, viewport: 800, hasMore: true, isLoadingMore: false })).toBe(true);
    expect(shouldLoadOlder({ distanceToTop: 1300, viewport: 800, hasMore: true, isLoadingMore: false })).toBe(false);
    expect(shouldLoadOlder({ distanceToTop: 0, viewport: 800, hasMore: false, isLoadingMore: false })).toBe(false);
    expect(shouldLoadOlder({ distanceToTop: 0, viewport: 800, hasMore: true, isLoadingMore: true })).toBe(false);
  });
  it('holds others’ new messages while far from the end, from the newest shown before', () => {
    const base = { anchor: null, previousNewestId: 'a', newestId: 'b', newestIsMine: false, farFromEnd: true };
    expect(nextHiddenAnchor(base)).toBe('a');
    expect(nextHiddenAnchor({ ...base, anchor: 'a', previousNewestId: 'b', newestId: 'c' })).toBe('a');
    expect(nextHiddenAnchor({ ...base, farFromEnd: false })).toBeNull();
    expect(nextHiddenAnchor({ ...base, anchor: 'a', newestIsMine: true })).toBeNull();
    expect(nextHiddenAnchor({ ...base, previousNewestId: undefined })).toBeNull();
    expect(nextHiddenAnchor({ ...base, anchor: 'x', newestId: 'a' })).toBe('x');
  });
});

describe('menu placement (c23)', () => {
  const vp = { width: 1280, height: 800 };
  const menu = { width: 304, height: 240 };
  it('under the bubble, aligned with its outer edge', () => {
    expect(menuPlacement({ top: 100, left: 400, width: 200, height: 40 }, menu, vp, false)).toEqual({ top: 148, left: 400 });
    expect(menuPlacement({ top: 100, left: 400, width: 200, height: 40 }, menu, vp, true)).toEqual({ top: 148, left: 296 });
  });
  it('above it near the bottom; clamped into the viewport', () => {
    expect(menuPlacement({ top: 700, left: 400, width: 200, height: 40 }, menu, vp, false)).toEqual({ top: 452, left: 400 });
    expect(menuPlacement({ top: 100, left: 1200, width: 60, height: 600 }, menu, vp, false)).toEqual({ top: 552, left: 968 });
  });
});

describe('viewer (c21)', () => {
  it('zoom between 1× and 4×; «(eu)» on my photos', () => {
    expect(clampZoom(0.5)).toBe(1);
    expect(clampZoom(2.345)).toBe(2.35);
    expect(clampZoom(9)).toBe(4);
    expect(viewerTitle({ senderName: 'Ana', isMine: true })).toBe('Ana (eu)');
    expect(viewerTitle({ senderName: 'Ion', isMine: false })).toBe('Ion');
  });
});
