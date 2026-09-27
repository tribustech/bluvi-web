import { describe, expect, it } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import {
  buildChatListItems,
  collapseSystemRuns,
  hasUnreadMessage,
  isMessageItem,
  latestLeaderMessageId,
  messagesOfItem,
  podiumPlaceOf,
  systemGroupBreakdown,
} from './listItems';
import type { ChatListMessage } from './types';

const T0 = new Date(2026, 8, 8, 10, 0, 0).getTime();
const msg = (id: string, senderId: string, offsetMs: number, extra: Partial<ChatListMessage> = {}): ChatListMessage =>
  ({
    id,
    senderId,
    senderName: senderId,
    senderAvatar: null,
    text: id,
    type: 'text',
    createdAt: Timestamp.fromMillis(T0 + offsetMs),
    ...extra,
  }) as ChatListMessage;
const positions = (items: ReturnType<typeof buildChatListItems>) =>
  items.filter(isMessageItem).map(m => `${m.id}:${m.groupPosition}`);
const base = { unreadAfterMs: 0, unreadBoundaryLoaded: false, now: new Date(T0 + 60_000) };

describe('buildChatListItems grouping', () => {
  it('groups consecutive same-sender messages within 5 minutes', () => {
    const items = buildChatListItems([msg('a', 'u1', 0), msg('b', 'u1', 60_000), msg('c', 'u1', 120_000)], base);
    expect(positions(items)).toEqual(['a:first', 'b:middle', 'c:last']);
  });
  it('a lone message is single', () => {
    expect(positions(buildChatListItems([msg('a', 'u1', 0)], base))).toEqual(['a:single']);
  });
  it('sender change breaks the group', () => {
    const items = buildChatListItems([msg('a', 'u1', 0), msg('b', 'u2', 1000), msg('c', 'u2', 2000)], base);
    expect(positions(items)).toEqual(['a:single', 'b:first', 'c:last']);
  });
  it('a gap over 5 minutes breaks the group', () => {
    const items = buildChatListItems([msg('a', 'u1', 0), msg('b', 'u1', 5 * 60_000 + 1)], base);
    expect(positions(items)).toEqual(['a:single', 'b:single']);
  });
  it('a date separator breaks the group', () => {
    const items = buildChatListItems([msg('a', 'u1', -10 * 60 * 60_000 - 1), msg('b', 'u1', 0)], {
      ...base,
      now: new Date(T0),
    });
    // a is on the previous day (23:59:59), b at 10:00 — different day keys → separator → no group
    expect(positions(items)).toEqual(['a:single', 'b:single']);
    expect(items.filter(i => i.type === 'date-separator')).toHaveLength(2);
  });
  it('the "Mesaje noi" separator breaks the group and sits after the date chip', () => {
    const items = buildChatListItems([msg('a', 'u2', 0), msg('b', 'u2', 1000)], {
      unreadAfterMs: T0 + 500,
      unreadBoundaryLoaded: true,
      currentUserId: 'me',
      now: base.now,
    });
    // Message items keep the underlying ChatMessage's own `type` ('text' here) — they have no
    // separator-style discriminant to fall back from, so `?? 'message'` never fires for them.
    expect(items.map(i => i.type ?? 'message')).toEqual(['date-separator', 'text', 'new-messages-separator', 'text']);
    expect(positions(items)).toEqual(['a:single', 'b:single']);
  });
  it('a pending message (no createdAt) groups with the previous own message', () => {
    const pending = { ...msg('p', 'me', 0), createdAt: undefined as unknown as ChatListMessage['createdAt'], pending: true };
    const items = buildChatListItems([msg('a', 'me', 0), pending], base);
    expect(positions(items)).toEqual(['a:first', 'p:last']);
  });
  it('system messages are single and break groups', () => {
    const items = buildChatListItems(
      [msg('a', 'u1', 0), msg('s', 'u1', 1000, { type: 'system' }), msg('b', 'u1', 2000)],
      base
    );
    expect(positions(items)).toEqual(['a:single', 's:single', 'b:single']);
  });
});

describe('hasUnreadMessage', () => {
  it('true when the newest message is newer than my receipt and not mine', () => {
    expect(hasUnreadMessage({ createdAtMs: 10, senderId: 'u2' }, 5, 'me')).toBe(true);
  });
  it('false for own message, read message or empty room', () => {
    expect(hasUnreadMessage({ createdAtMs: 10, senderId: 'me' }, 5, 'me')).toBe(false);
    expect(hasUnreadMessage({ createdAtMs: 10, senderId: 'u2' }, 10, 'me')).toBe(false);
    expect(hasUnreadMessage(null, 0, 'me')).toBe(false);
  });
  it('true when never read anything (lastReadAt 0) and someone wrote', () => {
    expect(hasUnreadMessage({ createdAtMs: 10, senderId: 'u2' }, 0, 'me')).toBe(true);
  });
});

describe('collapseSystemRuns', () => {
  const sys = (id: string, event: string, offsetMs: number) => msg(id, 'system', offsetMs, { type: 'system', event });
  const shape = (items: ReturnType<typeof collapseSystemRuns>) =>
    items.map(i => (i.type === 'system-group' ? `group(${i.messages.map(m => m.id).join(',')})` : i.id));
  const build = (messages: ChatListMessage[], expanded: string[] = [], opts = base) =>
    collapseSystemRuns(buildChatListItems(messages, opts), new Set(expanded));

  it('folds two or more consecutive routine events into one group', () => {
    const items = build([
      msg('a', 'u1', 0),
      sys('w1', 'competition:weighing-end', 1000),
      sys('w2', 'competition:weighing-end', 2000),
      sys('r1', 'registration:registered', 3000),
      msg('b', 'u1', 4000),
    ]);
    expect(shape(items)).toEqual([expect.stringMatching(/^date-/), 'a', 'group(w1,w2,r1)', 'b']);
  });
  it('a lone routine event stays a plain row', () => {
    const items = build([msg('a', 'u1', 0), sys('w1', 'competition:weighing-end', 1000), msg('b', 'u1', 2000)]);
    expect(shape(items).slice(1)).toEqual(['a', 'w1', 'b']);
  });
  it('important events never fold and break the run', () => {
    const items = build([
      sys('w1', 'competition:weighing-end', 0),
      sys('w2', 'competition:weighing-end', 1000),
      sys('end', 'competition:end', 2000),
      sys('alloc', 'competition:participants-allocation', 3000),
      sys('pen', 'competition:penalty', 5000),
      sys('x', 'competition:something-new', 6000),
      sys('w3', 'competition:weighing-end', 7000),
    ]);
    expect(shape(items).slice(1)).toEqual(['group(w1,w2)', 'end', 'alloc', 'pen', 'x', 'w3']);
  });
  it('the "Mesaje noi" divider splits a run', () => {
    const items = build(
      [
        sys('w1', 'competition:weighing-end', 0),
        sys('w2', 'competition:weighing-end', 1000),
        sys('w3', 'competition:weighing-end', 2000),
      ],
      [],
      { unreadAfterMs: T0 + 1500, unreadBoundaryLoaded: true, currentUserId: 'me', now: base.now } as typeof base
    );
    expect(shape(items).slice(1)).toEqual(['group(w1,w2)', 'new-messages', 'w3']);
  });
  it('an expanded group stays one row that carries its events', () => {
    const items = build(
      [sys('w1', 'competition:weighing-end', 0), sys('w2', 'competition:weighing-end', 1000)],
      ['system-group-w1']
    );
    expect(shape(items).slice(1)).toEqual(['group(w1,w2)']);
    const group = items[1];
    expect(group.type === 'system-group' && group.expanded).toBe(true);
    expect(messagesOfItem(group).map(m => m.id)).toEqual(['w1', 'w2']);
  });
  it('a collapsed group stands for all its messages', () => {
    const items = build([sys('w1', 'competition:weighing-end', 0), sys('w2', 'competition:weighing-end', 1000)]);
    expect(messagesOfItem(items[1]).map(m => m.id)).toEqual(['w1', 'w2']);
    expect(isMessageItem(items[1])).toBe(false);
  });
});

describe('systemGroupBreakdown', () => {
  it('counts per family, biggest first, with Romanian plurals', () => {
    const e = (event: string) => ({ event }) as ChatListMessage;
    expect(
      systemGroupBreakdown([
        e('registration:registered'),
        e('competition:weighing-end'),
        e('competition:weighing-end'),
        e('registration:cancelled'),
        e('registration:registered'),
        e('competition:weighing-end'),
      ])
    ).toBe('3 cântăriri · 2 înscrieri · 1 retragere');
  });
});

describe('podium leader', () => {
  const podium = (id: string, place: number, offsetMs: number, verb = 'urcă') =>
    msg(id, 'system', offsetMs, {
      type: 'system',
      event: 'competition:podium',
      text: `🥇 A1 · Andrei Popescu ${verb} pe locul ${place} cu 12,450 kg.`,
    });
  const weighing = (id: string, offsetMs: number) =>
    msg(id, 'system', offsetMs, { type: 'system', event: 'competition:weighing-end' });

  it('reads the place from both copy generations', () => {
    expect(podiumPlaceOf(podium('a', 1, 0))).toBe(1);
    expect(podiumPlaceOf(podium('a', 3, 0, 'trece'))).toBe(3);
    expect(podiumPlaceOf({ event: 'competition:podium', text: 'fără loc' })).toBeNull();
    expect(podiumPlaceOf({ event: 'competition:weighing-end', text: 'locul 1' })).toBeNull();
  });
  it('only the newest leader change stays out of the groups', () => {
    const messages = [
      weighing('w1', 0),
      podium('lead-old', 1, 1000),
      podium('second', 2, 2000),
      weighing('w2', 3000),
      podium('lead-new', 1, 4000),
      podium('third', 3, 5000),
      weighing('w3', 6000),
    ];
    const leaderId = latestLeaderMessageId(messages);
    expect(leaderId).toBe('lead-new');
    const items = collapseSystemRuns(buildChatListItems(messages, base), new Set(), leaderId);
    const shape = items.map(i => (i.type === 'system-group' ? `group(${i.messages.map(m => m.id).join(',')})` : i.id));
    expect(shape.slice(1)).toEqual(['group(w1,lead-old,second,w2)', 'lead-new', 'group(third,w3)']);
  });
  it('a deleted leader message does not count', () => {
    expect(latestLeaderMessageId([podium('a', 1, 0), { ...podium('b', 1, 1000), deletedAt: {} as ChatListMessage['deletedAt'] }])).toBe('a');
  });
  it('breakdown names podium moves', () => {
    expect(systemGroupBreakdown([podium('a', 2, 0), podium('b', 3, 0), weighing('w', 0)])).toBe(
      '2 schimbări pe podium · 1 cântărire'
    );
  });
});
