import { describe, expect, it } from 'vitest';
import { roomFromParam, tabParamOf } from '../_live/lastTab';
import { isActiveChatRoom, setActiveChatRoom } from '../_live/activeRoom';
import { closedNoticeText } from './ClosedNotice';
import { chatFactsOf } from './facts';
import { muteCopy } from './MuteDialog';
import { roomAccessibleName } from './RoomTabs';

/* participant.chat — the frame's pure rules (the e2e concurs-chat.spec.ts proves them on the page). */

describe('room param (c5)', () => {
  it('reads fish and web values; anything else is no room', () => {
    expect(roomFromParam('participanti')).toBe('participants');
    expect(roomFromParam('participants')).toBe('participants');
    expect(roomFromParam('general')).toBe('general');
    expect(roomFromParam('x')).toBeNull();
    expect(roomFromParam(undefined)).toBeNull();
    expect(tabParamOf('participants')).toBe('participanti');
    expect(tabParamOf('general')).toBe('general');
  });
});

describe('tab accessible name (c7)', () => {
  it('names the room, the mute and the unread count (99+), never the open room’s count', () => {
    expect(roomAccessibleName('general', true, 3, false)).toBe('General, notificări oprite, 3 mesaje noi');
    expect(roomAccessibleName('general', false, 250, false)).toBe('General, 99+ mesaje noi');
    expect(roomAccessibleName('participants', false, 4, true)).toBe('Participanți');
    expect(roomAccessibleName('participants', false, 0, false)).toBe('Participanți');
  });
});

describe('mute copy (c9)', () => {
  it('names the room and the other one', () => {
    expect(muteCopy('general', false, true)).toEqual({
      title: 'Oprește notificările',
      room: 'Chat general',
      body: 'Ceilalți nu văd asta. Primești în continuare notificări pentru Chat participanți.',
      action: 'Oprește',
    });
    expect(muteCopy('general', false, false).body).toBe('Ceilalți nu văd asta.');
    expect(muteCopy('participants', true, true)).toMatchObject({
      title: 'Pornește notificările',
      body: 'Vei primi din nou notificări pentru mesajele noi din Chat participanți.',
      action: 'Pornește',
    });
  });
});

describe('closed notice (c40)', () => {
  const now = new Date(2026, 9, 8, 12, 0);
  it('today, yesterday, a day, or no time', () => {
    expect(closedNoticeText(new Date(2026, 9, 8, 9, 0).getTime(), now)).toBe('Chat-ul s-a închis astăzi.');
    expect(closedNoticeText(new Date(2026, 9, 7, 9, 0).getTime(), now)).toBe('Chat-ul s-a închis ieri.');
    expect(closedNoticeText(new Date(2026, 9, 3, 9, 0).getTime(), now)).toBe('Chat-ul s-a închis pe sâmbătă, 3 oct.');
    expect(closedNoticeText(new Date(2026, 8, 30, 9, 0).getTime(), now)).toBe('Chat-ul s-a închis pe miercuri, 30 sept.');
    expect(closedNoticeText(null, now)).toBe('Chat-ul s-a închis.');
  });
});

describe('open room (b.chat-open-room-push)', () => {
  it('matches the CHAT_MESSAGE room (default general) of the competition on screen only', () => {
    setActiveChatRoom({ competitionId: 'c1', roomId: 'participants' });
    expect(isActiveChatRoom('c1', 'participants')).toBe(true);
    expect(isActiveChatRoom('c1', undefined)).toBe(false);
    expect(isActiveChatRoom('c2', 'participants')).toBe(false);
    setActiveChatRoom(null);
    expect(isActiveChatRoom('c1', 'participants')).toBe(false);
  });
});

describe('server facts (c1, c2)', () => {
  it('banner renditions, counts', () => {
    const facts = chatFactsOf({
      documentId: 'c1',
      name: 'Cupa',
      banner: { id: 1, url: '/o.jpg', blurhash: null, width: 1200, height: 800, formats: { large: { url: '/l.jpg' }, medium: null, small: { url: '/s.jpg' } } },
      competitionStatus: 'started',
      startDate: '2026-10-10T05:00:00.000Z',
      endDate: '2026-10-11T12:00:00.000Z',
      lake: null,
      author: { id: 1, documentId: 'a1', username: 'Org', phone: null },
      viewers: 24,
      registrations: [{ registrationStatus: 'registered' }, { registrationStatus: 'pending' }] as never,
    });
    expect(facts).toMatchObject({ bannerThumb: '/s.jpg', bannerLarge: '/l.jpg', viewers: 24, registered: 1, authorId: 'a1', lakeName: null });
  });
});
