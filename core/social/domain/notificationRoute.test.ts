import { describe, expect, it } from 'vitest';
import { NotificationTypes, type NotificationResponse } from '../schemas';
import {
  getRedirectLocationForNotification as route,
  getRouteForNotificationItem,
  getRouteForNotificationPayload,
  type NotificationData,
  type NotificationRoute,
} from './notificationRoute';

const T = NotificationTypes;
const C = 'comp-1';
const weighing = { competitionId: C, sectorName: 'Sector A & B', standName: 'A 10/2', standId: 'stand-1', weighingId: 'w-1' };

/**
 * Every notification type: the payload the CMS sends → the route (fish path in the comment), and the
 * payload with its id missing → null. Adding a type to `NotificationTypes` without a row fails the
 * completeness test below.
 */
const CASES: { type: string; data: Omit<NotificationData, 'type'>; expected: NotificationRoute | null; nullWithout?: (keyof NotificationData)[] }[] = [
  // /competitions/:id
  ...[
    T.COMPETITION_NEW_REGISTRATION_USER,
    T.COMPETITION_NEW_REGISTRATION_TEAM,
    T.COMPETITION_NEW_REJECTION_TEAM,
    T.COMPETITION_NEW_REJECTION_USER,
    T.COMPETITION_PENDING_USER,
    T.COMPETITION_REGISTRATION_MODIFIED_PARTICIPANT,
    T.COMPETITION_START,
    T.FOLLOW_COMPETITION_START,
  ].map(type => ({ type, data: { competitionId: C }, expected: { kind: 'competition', params: { competitionId: C } } as NotificationRoute, nullWithout: ['competitionId' as const] })),
  // /competitions/:id?activeTabId=clasament
  ...[T.COMPETITION_END, T.COMPETITION_ROUND_END, T.FOLLOW_COMPETITION_END, T.FOLLOW_COMPETITION_PODIUM].map(type => ({
    type,
    data: { competitionId: C },
    expected: { kind: 'competition', params: { competitionId: C, activeTabId: 'clasament' } } as NotificationRoute,
    nullWithout: ['competitionId' as const],
  })),
  // /competitions/:id?activeTabId=participanti&participantsFilter=pending
  {
    type: T.COMPETITION_NEW_REGISTRATION_ORGANIZER,
    data: { competitionId: C },
    expected: { kind: 'competition', params: { competitionId: C, activeTabId: 'participanti', participantsFilter: 'pending' } },
    nullWithout: ['competitionId'],
  },
  // /competitions/:id?activeTabId=participanti
  ...[
    T.COMPETITION_PARTICIPANTS_ALLOCATION,
    T.COMPETITION_ROUND_START,
    T.COMPETITION_NEW_CANCELLATION_ORGANIZER,
    T.COMPETITION_REGISTRATION_MODIFIED_ORGANIZER,
    T.FOLLOW_COMPETITION_REGISTERED,
    T.FOLLOW_COMPETITION_DIGEST,
  ].map(type => ({
    type,
    data: { competitionId: C },
    expected: { kind: 'competition', params: { competitionId: C, activeTabId: 'participanti' } } as NotificationRoute,
    nullWithout: ['competitionId' as const],
  })),
  // /competitions/:id?openWeighingSheet=1&sectorName=…&standName=…&standId=…&weighingId=…
  ...[T.COMPETITION_WEIGHING_END, T.COMPETITION_WEIGHING_MODIFIED].map(type => ({
    type,
    data: { ...weighing, scaleNumber: '2' },
    expected: { kind: 'competitionWeighing', params: weighing } as NotificationRoute,
    nullWithout: ['competitionId', 'sectorName', 'standName', 'standId', 'weighingId'] as (keyof NotificationData)[],
  })),
  // /competitions/:id?activeTabId=extracantare
  {
    type: T.COMPETITION_EXTRA_WEIGHT_REQUEST,
    data: { competitionId: C },
    expected: { kind: 'competition', params: { competitionId: C, activeTabId: 'extracantare' } },
    nullWithout: ['competitionId'],
  },
  // /competitions/:id/chat?tab=participants&name=…
  {
    type: T.CHAT_MESSAGE,
    data: { competitionId: C, tab: 'participants', competitionName: 'Cupa Bluvi & Prietenii' },
    expected: { kind: 'competitionChat', params: { competitionId: C, tab: 'participants', name: 'Cupa Bluvi & Prietenii' } },
    nullWithout: ['competitionId'],
  },
  // /(app)/penalties/:id
  { type: T.PENALTY, data: { competitionId: C }, expected: { kind: 'penalties', params: { competitionId: C } }, nullWithout: ['competitionId'] },
  // /polls/current
  ...[T.POLL_OPENED, T.POLL_CLOSED, T.POLL_SUGGESTION_APPROVED].map(type => ({ type, data: {}, expected: { kind: 'currentPoll', params: {} } as NotificationRoute })),
  // /news/:id
  { type: T.NEWS, data: { newsId: 'news-1' }, expected: { kind: 'news', params: { newsId: 'news-1' } }, nullWithout: ['newsId'] },
  // /(app)/(tabs)/lakes
  { type: T.NEW_LAKES, data: {}, expected: { kind: 'lakesTab', params: {} } },
  // /anglers/:documentId
  { type: T.NEW_FOLLOWER, data: { followerDocumentId: 'angler-1' }, expected: { kind: 'angler', params: { documentId: 'angler-1' } }, nullWithout: ['followerDocumentId'] },
  // /(app)/partide/join/:code
  { type: T.PARTIDA_INVITE, data: { partidaCode: 'C2GFMK' }, expected: { kind: 'partidaJoin', params: { code: 'C2GFMK' } }, nullWithout: ['partidaCode'] },
  // /(app)/partide/:clientId
  ...[T.PARTIDA_FINISHED, T.PARTIDA_AUTO_CLOSE_WARN].map(type => ({
    type,
    data: { sessionId: 'client-1' },
    expected: { kind: 'partida', params: { sessionId: 'client-1' } } as NotificationRoute,
    nullWithout: ['sessionId' as const],
  })),
  // /(app)/partide/comunitate/:documentId
  ...[T.PARTIDA_CATCH, T.PARTIDA_FINISHED_FOLLOWED, T.FOLLOW_PARTIDA_START, T.FOLLOW_PARTIDA_FIRST_CATCH].map(type => ({
    type,
    data: { sessionDocumentId: 'S1' },
    expected: { kind: 'communitySession', params: { sessionDocumentId: 'S1' } } as NotificationRoute,
    nullWithout: ['sessionDocumentId' as const],
  })),
  // /(app)/partide/comunitate/capturi/:documentId
  ...[T.FOLLOW_RECORD_PERSONAL, T.FOLLOW_RECORD_LAKE].map(type => ({
    type,
    data: { sessionDocumentId: 'S1' },
    expected: { kind: 'communityCatches', params: { sessionDocumentId: 'S1' } } as NotificationRoute,
    nullWithout: ['sessionDocumentId' as const],
  })),
  // tap only opens the app
  { type: T.SCHEDULED_NOTIFICATION, data: {}, expected: null },
  // /organizer (listed under Anulate)
  { type: T.COMPETITION_AUTO_CANCELLED_ORGANIZER, data: { competitionId: C }, expected: { kind: 'organizerDashboard', params: {} } },
  // nowhere to go: the cancelled competition is hidden from "My competitions"
  { type: T.COMPETITION_CANCELLED_USER, data: { competitionId: C }, expected: null },
  // /bookings/:id
  ...[
    T.BOOKING_REQUEST_RECEIVED_ANGLER,
    T.BOOKING_CONFIRMED_ANGLER,
    T.BOOKING_REJECTED_ANGLER,
    T.BOOKING_CANCELLED_ANGLER,
    T.BOOKING_REMINDER_ANGLER,
    T.BOOKING_NO_SHOW_ANGLER,
    T.BOOKING_WALK_IN_ANGLER,
  ].map(type => ({ type, data: { bookingId: 'bk_1' }, expected: { kind: 'booking', params: { bookingId: 'bk_1' } } as NotificationRoute, nullWithout: ['bookingId' as const] })),
  // /operator/:lakeId/bookings?status=…
  ...[T.BOOKING_NEW_REQUEST_OPERATOR, T.BOOKING_PENDING_NUDGE_OPERATOR].map(type => ({
    type,
    data: { lakeId: 'lake_42' },
    expected: { kind: 'operatorBookings', params: { lakeId: 'lake_42', status: 'pending' } } as NotificationRoute,
    nullWithout: ['lakeId' as const],
  })),
  { type: T.BOOKING_AUTO_REJECTED_OPERATOR, data: { lakeId: 'lake_42' }, expected: { kind: 'operatorBookings', params: { lakeId: 'lake_42', status: 'rejected' } }, nullWithout: ['lakeId'] },
  { type: T.BOOKING_CANCELLED_OPERATOR, data: { lakeId: 'lake_42' }, expected: { kind: 'operatorBookings', params: { lakeId: 'lake_42', status: 'cancelled' } }, nullWithout: ['lakeId'] },
  // single new competition → detail; digest → Competiții tab
  { type: T.NEW_COMPETITIONS, data: { competitionId: 'c1' }, expected: { kind: 'competition', params: { competitionId: 'c1' } } },
  { type: T.COMPETITIONS_DIGEST, data: {}, expected: { kind: 'competitionsTab', params: {} } },
  // /lakes/:id/reviews
  { type: T.FOLLOW_LAKE_REVIEW, data: { lakeId: 'l1' }, expected: { kind: 'lakeReviews', params: { lakeId: 'l1' } }, nullWithout: ['lakeId'] },
];

describe('getRedirectLocationForNotification', () => {
  it('has a case for every notification type', () => {
    const covered = new Set(CASES.map(c => c.type));
    expect(Object.values(NotificationTypes).filter(t => !covered.has(t))).toEqual([]);
  });

  it.each(CASES)('$type', ({ type, data, expected, nullWithout }) => {
    expect(route({ ...data, type })).toEqual(expected);
    for (const key of nullWithout ?? []) {
      expect(route({ ...data, type, [key]: undefined })).toBeNull();
      expect(route({ ...data, type, [key]: '' })).toBeNull();
    }
  });

  it('chat falls back to the CMS `chatRoom` alias, then to general, and omits a missing name', () => {
    expect(route({ type: T.CHAT_MESSAGE, competitionId: 'abc', chatRoom: 'general' })).toEqual({ kind: 'competitionChat', params: { competitionId: 'abc', tab: 'general' } });
    expect(route({ type: T.CHAT_MESSAGE, competitionId: 'abc' })).toEqual({ kind: 'competitionChat', params: { competitionId: 'abc', tab: 'general' } });
  });

  it('a digest single without competitionId goes to the Competiții tab', () => {
    expect(route({ type: T.NEW_COMPETITIONS })).toEqual({ kind: 'competitionsTab', params: {} });
  });

  it('unknown and empty types route nowhere', () => {
    expect(route({ type: 'something-nobody-implemented' })).toBeNull();
    expect(route({ type: 'specific-push-notification' })).toBeNull();
    expect(route({ type: '' })).toBeNull();
  });
});

describe('payload forwarding (fish getRedirectURL + inbox NotificationItem)', () => {
  const weighingPayload = { type: T.COMPETITION_WEIGHING_MODIFIED, competitionId: C, sectorName: 'A', standName: '1', standId: 's', weighihngId: 'w-typo', scaleNumber: '2' };

  it('accepts the CMS `weighihngId` typo', () => {
    expect(getRouteForNotificationPayload(weighingPayload)).toEqual({
      kind: 'competitionWeighing',
      params: { competitionId: C, sectorName: 'A', standName: '1', standId: 's', weighingId: 'w-typo' },
    });
  });

  it('forwards the whole payload, so the once-dropped fields still route', () => {
    expect(getRouteForNotificationPayload({ type: T.NEW_FOLLOWER, followerDocumentId: 'a1' })).toEqual({ kind: 'angler', params: { documentId: 'a1' } });
    expect(getRouteForNotificationPayload({ type: T.PARTIDA_INVITE, partidaCode: 'X' })).toEqual({ kind: 'partidaJoin', params: { code: 'X' } });
  });

  it('an extra unknown key cannot change the route; non-string values are ignored', () => {
    const base = { type: T.COMPETITION_START, competitionId: C };
    expect(getRouteForNotificationPayload({ ...base, somethingNew: 'x', sessionId: 'unrelated', newsId: 7 })).toEqual(getRouteForNotificationPayload(base));
    expect(getRouteForNotificationPayload({ type: T.NEWS, newsId: 7 })).toBeNull();
    expect(getRouteForNotificationPayload({})).toBeNull();
  });

  const item = (type: string, data: Record<string, unknown>): NotificationResponse => ({
    id: 1,
    documentId: 'nu',
    read: false,
    readAt: null,
    notification: { id: 2, documentId: 'n', title: '', body: '', sentAt: '', type, data },
  });

  it('inbox rows agree with the tray, and the row type wins over a `type` inside data', () => {
    const { type, ...data } = weighingPayload;
    expect(getRouteForNotificationItem(item(type, data))).toEqual(getRouteForNotificationPayload(weighingPayload));
    const r = getRouteForNotificationItem(item(T.COMPETITION_START, { competitionId: C, type: T.NEWS, newsId: 'news-9' }));
    expect(r).toEqual({ kind: 'competition', params: { competitionId: C } });
  });
});
