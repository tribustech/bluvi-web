import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { getRouteForNotificationItem, NotificationTypes, type NotificationResponse } from '@/core/social';
import { NOTIFICATION_PAGES_ON_WEB, notificationHref } from '@/lib/notification-href';
import { ON_WEB } from '@/lib/routes';

/*
 * global.b.notification-routes-web: every notification type → its web page (or none), through the
 * same path the /notificari list takes (core getRouteForNotificationItem → notificationHref).
 */

const T = NotificationTypes;

function item(type: string, data: Record<string, unknown> = {}): NotificationResponse {
  return {
    id: 1,
    documentId: 'row1',
    read: false,
    readAt: null,
    notification: { id: 2, documentId: 'n1', title: 't', body: 'b', sentAt: '2026-10-01T10:00:00.000Z', data, type },
  };
}

const href = (type: string, data: Record<string, unknown> = {}) => {
  const route = getRouteForNotificationItem(item(type, data));
  return route ? notificationHref(route) : null;
};

const C = { competitionId: 'c1' };

describe('notificationHref — every type with its ids', () => {
  const cases: [string, Record<string, unknown>, string | null][] = [
    // → the competition
    [T.COMPETITION_NEW_REGISTRATION_USER, C, '/concursuri/c1'],
    [T.COMPETITION_NEW_REGISTRATION_TEAM, C, '/concursuri/c1'],
    [T.COMPETITION_NEW_REJECTION_TEAM, C, '/concursuri/c1'],
    [T.COMPETITION_NEW_REJECTION_USER, C, '/concursuri/c1'],
    [T.COMPETITION_PENDING_USER, C, '/concursuri/c1'],
    [T.COMPETITION_REGISTRATION_MODIFIED_PARTICIPANT, C, '/concursuri/c1'],
    [T.COMPETITION_START, C, '/concursuri/c1'],
    [T.FOLLOW_COMPETITION_START, C, '/concursuri/c1'],
    [T.NEW_COMPETITIONS, C, '/concursuri/c1'],
    // → its ranking
    [T.COMPETITION_END, C, '/concursuri/c1/clasament'],
    [T.COMPETITION_ROUND_END, C, '/concursuri/c1/clasament'],
    [T.FOLLOW_COMPETITION_END, C, '/concursuri/c1/clasament'],
    [T.FOLLOW_COMPETITION_PODIUM, C, '/concursuri/c1/clasament'],
    // → participants
    // fish opens it filtered to pending; the web's participants page has no such filter before M6.
    [
      T.COMPETITION_NEW_REGISTRATION_ORGANIZER,
      C,
      NOTIFICATION_PAGES_ON_WEB.organizerPendingFilter ? '/concursuri/c1/participanti?filtru=in-asteptare' : '/concursuri/c1/participanti',
    ],
    [T.COMPETITION_PARTICIPANTS_ALLOCATION, C, '/concursuri/c1/participanti'],
    [T.COMPETITION_ROUND_START, C, '/concursuri/c1/participanti'],
    [T.COMPETITION_NEW_CANCELLATION_ORGANIZER, C, '/concursuri/c1/participanti'],
    [T.COMPETITION_REGISTRATION_MODIFIED_ORGANIZER, C, '/concursuri/c1/participanti'],
    [T.FOLLOW_COMPETITION_REGISTERED, C, '/concursuri/c1/participanti'],
    [T.FOLLOW_COMPETITION_DIGEST, C, '/concursuri/c1/participanti'],
    // → a weighing (the CMS's legacy «weighihngId» spelling, as the local CMS sends it)
    [
      T.COMPETITION_WEIGHING_END,
      { ...C, sectorName: 'A', standName: '1', standId: 's1', weighihngId: 'w1' },
      '/concursuri/c1/cantare?cantar=w1&stand=s1',
    ],
    [
      T.COMPETITION_WEIGHING_MODIFIED,
      { ...C, sectorName: 'A', standName: '1', standId: 's1', weighingId: 'w2' },
      '/concursuri/c1/cantare?cantar=w2&stand=s1',
    ],
    [T.COMPETITION_EXTRA_WEIGHT_REQUEST, C, '/concursuri/c1/extra-cantare'],
    // → lists, news, lakes, anglers
    [T.NEW_COMPETITIONS, {}, '/concursuri'],
    [T.COMPETITIONS_DIGEST, {}, '/concursuri'],
    [T.NEWS, { newsId: 'n9' }, '/stiri/n9'],
    [T.NEW_LAKES, {}, '/balti'],
    [T.NEW_FOLLOWER, { followerDocumentId: 'u7' }, ON_WEB.angler ? '/pescari/u7' : null],
    [T.FOLLOW_LAKE_REVIEW, { lakeId: 'l3' }, '/balti/l3/recenzii'],
    // → pages not on the web yet: no link (each gate in NOTIFICATION_PAGES_ON_WEB / ON_WEB)
    [T.CHAT_MESSAGE, { ...C, tab: 'participants' }, null],
    [T.PENALTY, C, null],
    [T.POLL_OPENED, {}, null],
    [T.POLL_CLOSED, {}, null],
    [T.POLL_SUGGESTION_APPROVED, {}, null],
    [T.PARTIDA_INVITE, { partidaCode: 'ABC123' }, null],
    [T.PARTIDA_FINISHED, { sessionId: 'local-1' }, null],
    [T.PARTIDA_AUTO_CLOSE_WARN, { sessionId: 'local-1' }, null],
    [T.PARTIDA_CATCH, { sessionDocumentId: 'p1' }, ON_WEB.partida ? '/partide/p1' : null],
    [T.PARTIDA_FINISHED_FOLLOWED, { sessionDocumentId: 'p1' }, ON_WEB.partida ? '/partide/p1' : null],
    [T.FOLLOW_PARTIDA_START, { sessionDocumentId: 'p1' }, ON_WEB.partida ? '/partide/p1' : null],
    [T.FOLLOW_PARTIDA_FIRST_CATCH, { sessionDocumentId: 'p1' }, ON_WEB.partida ? '/partide/p1' : null],
    [T.FOLLOW_RECORD_PERSONAL, { sessionDocumentId: 'p1' }, null],
    [T.FOLLOW_RECORD_LAKE, { sessionDocumentId: 'p1' }, null],
    [T.COMPETITION_AUTO_CANCELLED_ORGANIZER, {}, null],
    [T.BOOKING_REQUEST_RECEIVED_ANGLER, { bookingId: 'b1' }, null],
    [T.BOOKING_CONFIRMED_ANGLER, { bookingId: 'b1' }, null],
    [T.BOOKING_REJECTED_ANGLER, { bookingId: 'b1' }, null],
    [T.BOOKING_CANCELLED_ANGLER, { bookingId: 'b1' }, null],
    [T.BOOKING_REMINDER_ANGLER, { bookingId: 'b1' }, null],
    [T.BOOKING_NO_SHOW_ANGLER, { bookingId: 'b1' }, null],
    [T.BOOKING_WALK_IN_ANGLER, { bookingId: 'b1' }, null],
    [T.BOOKING_NEW_REQUEST_OPERATOR, { lakeId: 'l1' }, null],
    [T.BOOKING_PENDING_NUDGE_OPERATOR, { lakeId: 'l1' }, null],
    [T.BOOKING_AUTO_REJECTED_OPERATOR, { lakeId: 'l1' }, null],
    [T.BOOKING_CANCELLED_OPERATOR, { lakeId: 'l1' }, null],
    // → never a route (fish)
    [T.SCHEDULED_NOTIFICATION, C, null],
    [T.COMPETITION_CANCELLED_USER, C, null],
    ['some:future-type', C, null],
  ];

  it.each(cases)('%s %j → %s', (type, data, expected) => {
    expect(href(type, data)).toBe(expected);
  });

  it('covers every known type', () => {
    const covered = new Set(cases.map(([type]) => type));
    expect(Object.values(T).filter((type) => !covered.has(type))).toEqual([]);
  });

  it('encodes ids', () => {
    expect(href(T.NEWS, { newsId: 'a/b c' })).toBe('/stiri/a%2Fb%20c');
  });

  it('the type outside `data` wins over a stray `type` inside it', () => {
    expect(href(T.NEWS, { type: T.NEW_LAKES, newsId: 'n1' })).toBe('/stiri/n1');
  });
});

describe('notificationHref — a missing required id means no link', () => {
  const missing: [string, Record<string, unknown>][] = [
    [T.COMPETITION_START, {}],
    [T.COMPETITION_END, {}],
    [T.COMPETITION_ROUND_END, {}],
    [T.COMPETITION_ROUND_START, {}],
    [T.COMPETITION_NEW_REGISTRATION_ORGANIZER, {}],
    [T.COMPETITION_PARTICIPANTS_ALLOCATION, {}],
    [T.COMPETITION_EXTRA_WEIGHT_REQUEST, {}],
    [T.FOLLOW_COMPETITION_REGISTERED, {}],
    [T.FOLLOW_COMPETITION_PODIUM, {}],
    // a weighing needs all four of sector, stand name, stand id and weighing id
    [T.COMPETITION_WEIGHING_END, { ...C, standName: '1', standId: 's1', weighingId: 'w1' }],
    [T.COMPETITION_WEIGHING_END, { ...C, sectorName: 'A', standId: 's1', weighingId: 'w1' }],
    [T.COMPETITION_WEIGHING_END, { ...C, sectorName: 'A', standName: '1', weighingId: 'w1' }],
    [T.COMPETITION_WEIGHING_END, { ...C, sectorName: 'A', standName: '1', standId: 's1' }],
    [T.COMPETITION_WEIGHING_MODIFIED, { sectorName: 'A', standName: '1', standId: 's1', weighingId: 'w1' }],
    [T.NEWS, {}],
    [T.NEW_FOLLOWER, {}],
    [T.FOLLOW_LAKE_REVIEW, {}],
    [T.CHAT_MESSAGE, {}],
    [T.PENALTY, {}],
    [T.PARTIDA_INVITE, {}],
    [T.PARTIDA_CATCH, {}],
    [T.FOLLOW_RECORD_LAKE, {}],
    [T.BOOKING_CONFIRMED_ANGLER, {}],
    [T.BOOKING_CANCELLED_OPERATOR, {}],
  ];
  it.each(missing)('%s %j → null', (type, data) => {
    expect(href(type, data)).toBeNull();
  });

  it('a non-string id is not an id (FCM data is string-only)', () => {
    expect(href(T.NEWS, { newsId: 42 })).toBeNull();
  });
});

describe('gates follow the pages that exist under app/(site)', () => {
  const site = path.resolve(__dirname, '../../app/(site)');
  const page = (rel: string) => existsSync(path.join(site, rel, 'page.tsx'));
  const pages: Record<Exclude<keyof typeof NOTIFICATION_PAGES_ON_WEB, 'organizerPendingFilter'>, string> = {
    competitionChat: 'concursuri/[id]/chat',
    penalties: 'concursuri/[id]/penalizari',
    polls: 'sondaje',
    partidaJoin: 'partide/intra/[code]',
    ownPartida: 'partide/[id]',
    communityCatches: 'partide/[id]/capturi',
    organizer: 'organizator',
    booking: 'rezervari/[id]',
    operatorBookings: 'operator/[lakeId]/rezervari',
  };
  it.each(Object.entries(pages))('%s ↔ %s', (gate, rel) => {
    // A page that lands while its gate is off: flip the gate and map the route in lib/notification-href.ts.
    expect(NOTIFICATION_PAGES_ON_WEB[gate as keyof typeof pages]).toBe(page(rel));
  });

  it('organizerPendingFilter ↔ the participants page reads `filtru`', () => {
    // A filter, not a page: on once any source under concursuri/[id]/participanti reads `filtru`.
    const dir = path.join(site, 'concursuri/[id]/participanti');
    const reads = (readdirSync(dir, { recursive: true }) as string[])
      .filter((f) => /\.tsx?$/.test(f))
      .some((f) => readFileSync(path.join(dir, f), 'utf8').includes('filtru'));
    expect(NOTIFICATION_PAGES_ON_WEB.organizerPendingFilter).toBe(reads);
  });

  it('the targets mapped today exist', () => {
    for (const rel of [
      'concursuri/[id]',
      'concursuri/[id]/clasament',
      'concursuri/[id]/participanti',
      'concursuri/[id]/cantare',
      'concursuri/[id]/extra-cantare',
      'concursuri',
      'stiri/[id]',
      'balti',
      'balti/[id]/recenzii',
    ]) {
      expect(page(rel), rel).toBe(true);
    }
    expect(ON_WEB.angler).toBe(page('pescari/[id]'));
  });
});
