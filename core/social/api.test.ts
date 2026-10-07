import { describe, expect, it } from 'vitest';
import { createFakeTransport } from '@/tests/transport';
import { QueryClient } from '@tanstack/react-query';
import { ApiError, isApiError } from '../transport';
import {
  createAnglerReview,
  deleteProfile,
  enableDisableNotifications,
  followAngler,
  getAnglerCatches,
  getAnglerCompetitions,
  getAnglerFollowers,
  getAnglerFollowing,
  getAnglerProfile,
  getAnglerSessions,
  getFirebaseToken,
  getMyWidgetNotification,
  getNotificationsForLoggedUser,
  getPaginatedUsers,
  getProfile,
  getStatistics,
  getSuggestedAnglers,
  getSuggestedHome,
  getUnreadNotificationsForLoggedInUser,
  getUserReputation,
  getUSerStatuteForCompetition,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  postUserStatisticsBatch,
  registerWidgetNotification,
  requestOrganizerRole,
  searchAnglers,
  sendFeedback,
  unfollowAngler,
  updateProfile,
  uploadMedia,
  uploadMediaAndAttachToEntity,
} from './api';
import { registerWidgetNotificationMutation } from './mutations';
import { myWidgetNotificationQuery, widgetNotificationKeys } from './queries';

const pagination = { page: 1, pageSize: 3, pageCount: 1, total: 1 };
const anglerProfile = {
  id: 513,
  documentId: 'u1',
  username: 'Sim QA',
  avatarUrl: null,
  bio: null,
  memberSince: '2026-09-01T13:58:32.409Z',
  counts: { followers: 0, following: 1, catches: 1, sessions: 0, competitions: 1 },
  biggestCatch: { kg: 5.2, source: 'competition' },
  podium: { first: 1, second: 0, third: 0 },
  isFollowedByMe: false,
  isSelf: true,
};
const listItem = { documentId: 'a1', username: 'Andrew', avatarUrl: null, isFollowedByMe: true };
const listPage = { data: [listItem], meta: { pagination } };
const session = {
  documentId: 's1',
  venueName: 'Chita Lake',
  locality: 'Giurgiu',
  standName: null,
  photoUrl: null,
  startedAt: '2026-09-22T07:24:13.212Z',
  endedAt: '2026-09-23T19:30:00.375Z',
  durationMs: 129947163,
  isActive: false,
  catches: 0,
  totalKg: null,
  maxKg: null,
  isPersonalRecord: false,
  photos: [],
  photoCount: 0,
};
const catchPage = {
  data: [{ key: 'c1', source: 'partida', photoUrl: 'x.jpg', weightKg: null, species: null, venueName: null, date: '2026-07-01', competitionName: null, competitionDocumentId: null }],
  meta: { pagination: { pageSize: 30, total: 90 }, nextCursor: 'CURSOR2' },
};
const historyPage = {
  data: [
    {
      competition: { documentId: 'c1', name: 'Cupa', startDate: null, endDate: null, imageUrl: null, lakeName: null, competitionType: 'single', rankingType: 'quantity' },
      placement: 1,
    },
  ],
  meta: { pagination },
};
const profile = {
  id: 513,
  documentId: 'u1',
  email: 'sim-qa@bluvi.test',
  username: 'Sim QA',
  phone: '+40712345678',
  bio: null,
  createdAt: '2026-09-01T13:58:32.409Z',
  provider: 'local',
  isProfileComplete: true,
  hasRequestedOrganizerRole: false,
  notificationsEnabled: true,
  avatar: { id: 2480, documentId: 'av', url: 'https://x/a.jpg', formats: null },
  role: { id: 1, documentId: 'r', name: 'Authenticated' },
};
const notificationRow = {
  id: 30553,
  documentId: 'nu1',
  read: false,
  readAt: null,
  notification: { id: 7831, documentId: 'n1', title: 't', body: 'b', sentAt: '2026-09-26T14:06:51.105Z', data: { type: 'competition:end', competitionId: 'c1' }, type: 'competition:end' },
};
const review = { stars: 4, comment: null, authorName: 'Op', lakeName: 'Chita', createdAt: '2026-09-01', rulesScore: null, cleanlinessScore: null, behaviorScore: null, tags: ['clean'] };

describe('anglers api (ported from fish services/api/__tests__/anglers.test.ts)', () => {
  it('getAnglerProfile unwraps data', async () => {
    const { transport, calls } = createFakeTransport([{ data: anglerProfile }]);
    const p = await getAnglerProfile(transport, 'u1');
    expect(calls[0]).toMatchObject({ method: 'GET', path: '/feed/anglers/u1', auth: 'required' });
    expect(p.documentId).toBe('u1');
  });

  it('getAnglerCompetitions builds query params, dropping empty filters', async () => {
    const { transport, calls } = createFakeTransport([historyPage, historyPage]);
    await getAnglerCompetitions(transport, 'u1', { page: 2, pageSize: 10, filter: 'podium', year: 2025 });
    expect(calls[0]).toMatchObject({ path: '/feed/anglers/u1/competitions', query: { page: 2, pageSize: 10, filter: 'podium', year: 2025 }, auth: 'none' });
    await getAnglerCompetitions(transport, 'u1', { page: 1, pageSize: 10 });
    expect(calls[1].query).toEqual({ page: 1, pageSize: 10 });
  });

  it('getAnglerCatches sends the cursor when it has one and returns the page payload', async () => {
    const { transport, calls } = createFakeTransport([catchPage]);
    const res = await getAnglerCatches(transport, 'u1', { cursor: 'CURSOR1', pageSize: 30 });
    expect(calls[0]).toMatchObject({ path: '/feed/anglers/u1/catches', query: { pageSize: 30, cursor: 'CURSOR1' }, auth: 'none' });
    expect(res).toEqual(catchPage);
  });

  it('getAnglerCatches OMITS the cursor param on the first page', async () => {
    // Sending `cursor: null` would serialise as an empty param; the first page must ask for no cursor.
    const { transport, calls } = createFakeTransport([{ data: [], meta: { pagination: { pageSize: 20, total: 0 }, nextCursor: null } }]);
    await getAnglerCatches(transport, 'u1', { cursor: null, pageSize: 20 });
    expect(calls[0].query).toEqual({ pageSize: 20 });
  });

  it('followAngler / unfollowAngler post and return the counts payload', async () => {
    const { transport, calls } = createFakeTransport([
      { following: true, followersCount: 3 },
      { following: false, followersCount: 2 },
    ]);
    await expect(followAngler(transport, 'u1')).resolves.toEqual({ following: true, followersCount: 3 });
    expect(calls[0]).toMatchObject({ method: 'POST', path: '/feed/anglers/u1/follow', auth: 'required' });
    await expect(unfollowAngler(transport, 'u1')).resolves.toEqual({ following: false, followersCount: 2 });
    expect(calls[1]).toMatchObject({ method: 'POST', path: '/feed/anglers/u1/unfollow' });
  });

  it('lists followers, following, sessions, search, suggested and the Home rail', async () => {
    const suggested = { data: { friendsOfFollows: [{ ...listItem, subline: 'Urmărit de X' }], recentlyActive: listPage } };
    const home = {
      data: [{ documentId: 'k2', username: 'Andrei', avatarUrl: null, isFollowedByMe: false, stats: { competitions: 1, podiums: 1, sessions: 0, catches: 7, recordKg: 9.9, followers: 0 } }],
      meta: { pagination },
    };
    const { transport, calls } = createFakeTransport([listPage, listPage, { data: [session], meta: { pagination } }, listPage, suggested, home]);
    await getAnglerFollowers(transport, 'u1', { page: 1, pageSize: 3 });
    await getAnglerFollowing(transport, 'u1', { page: 1, pageSize: 3 });
    await getAnglerSessions(transport, 'u1', { page: 1, pageSize: 3 });
    await searchAnglers(transport, 'an', { page: 1, pageSize: 3 });
    await expect(getSuggestedAnglers(transport, { page: 1, pageSize: 3 })).resolves.toEqual(suggested.data);
    await expect(getSuggestedHome(transport, { page: 1, pageSize: 3 })).resolves.toEqual(home);
    expect(calls.map(c => [c.path, c.query, c.auth])).toEqual([
      ['/feed/anglers/u1/followers', { page: 1, pageSize: 3 }, 'required'],
      ['/feed/anglers/u1/following', { page: 1, pageSize: 3 }, 'required'],
      ['/feed/anglers/u1/sessions', { page: 1, pageSize: 3 }, 'none'],
      ['/feed/anglers/search', { q: 'an', page: 1, pageSize: 3 }, 'required'],
      ['/feed/anglers/suggested', { page: 1, pageSize: 3 }, 'required'],
      ['/feed/anglers/suggested-home', { page: 1, pageSize: 3 }, 'required'],
    ]);
  });

  it('rejects a response that breaks the contract', async () => {
    const { transport } = createFakeTransport([{ data: { documentId: 'u1' } }]);
    const err = await getAnglerProfile(transport, 'u1').catch(e => e);
    expect(isApiError(err) && err.code).toBe('INVALID_RESPONSE');
  });
});

describe('profile + users api', () => {
  it('reads the profile, statistics and statute', async () => {
    const { transport, calls } = createFakeTransport([
      profile,
      { data: { catches: 1, biggestCatchKg: 5.2, competitions: 1 } },
      { userRole: 'participant', isReferee: false, isParticipant: true },
    ]);
    await expect(getProfile(transport)).resolves.toEqual(profile);
    await expect(getStatistics(transport)).resolves.toEqual({ catches: 1, biggestCatchKg: 5.2, competitions: 1 });
    await expect(getUSerStatuteForCompetition(transport, 'c1')).resolves.toMatchObject({ userRole: 'participant' });
    expect(calls.map(c => [c.method, c.path, c.auth])).toEqual([
      ['GET', '/user/profile', 'required'],
      ['GET', '/user/statitics', 'required'],
      ['GET', '/user/profile/competition/c1/statute', 'required'],
    ]);
  });

  it('writes the profile (204), deletes it and requests the organizer role', async () => {
    const { transport, calls } = createFakeTransport([null, { message: 'ok' }, { id: 1, documentId: 'u1', email: 'x' }]);
    await expect(updateProfile(transport, { bio: 'x' })).resolves.toBeUndefined();
    await deleteProfile(transport);
    // Only the identity survives the schema (the answer is the updated user).
    await expect(requestOrganizerRole(transport, 'vreau')).resolves.toEqual({ id: 1, documentId: 'u1' });
    expect(calls.map(c => [c.method, c.path, c.body])).toEqual([
      ['PATCH', '/user/profile', { bio: 'x' }],
      ['DELETE', '/user/profile', undefined],
      ['POST', '/user/organizer-request', { message: 'vreau' }],
    ]);
  });

  it('postUserStatisticsBatch accepts the record under data or at top level, else {}', async () => {
    const stats = { u1: { catches: 1, biggestCatchKg: null, competitions: 0 } };
    const { transport, calls } = createFakeTransport([{ data: stats }, stats, 'nope']);
    await expect(postUserStatisticsBatch(transport, ['u1'])).resolves.toEqual(stats);
    await expect(postUserStatisticsBatch(transport, ['u1'])).resolves.toEqual(stats);
    await expect(postUserStatisticsBatch(transport, ['u1'])).resolves.toEqual({});
    expect(calls[0]).toMatchObject({ method: 'POST', path: '/user/statistics/batch', body: { documentIds: ['u1'] } });
  });

  it('getPaginatedUsers keeps the hand-built query and encodes the search', async () => {
    const users = {
      data: [{ id: 274, documentId: 'm5', username: 'Andrei', email: 'a@b.c', provider: 'local', phone: null, isProfileComplete: true, hasRequestedOrganizerRole: false, avatar: null }],
      meta: { pagination },
    };
    const { transport, calls } = createFakeTransport([users]);
    await expect(getPaginatedUsers(transport, { page: 2, pageSize: 5, search: 'a&b' })).resolves.toEqual(users);
    expect(calls[0]).toMatchObject({ path: '/user/all?page=2&pageSize=5&search=a%26b', auth: 'required' });
  });
});

describe('notifications api', () => {
  it('reads the inbox with Strapi bracket pagination and the unread count', async () => {
    const page = { data: [notificationRow], meta: { pagination } };
    const { transport, calls } = createFakeTransport([page, { count: 22 }]);
    await expect(getNotificationsForLoggedUser(transport, { page: 2, pageSize: 5 })).resolves.toEqual(page);
    expect(calls[0]).toMatchObject({ path: '/notification-users', query: { pagination: { page: 2, pageSize: 5 } }, auth: 'required' });
    await expect(getUnreadNotificationsForLoggedInUser(transport)).resolves.toEqual({ count: 22 });
    expect(calls[1].path).toBe('/notification-users/unread');
  });

  it('defaults the page to 1 and the size to 20', async () => {
    const { transport, calls } = createFakeTransport([{ data: [], meta: { pagination } }]);
    await getNotificationsForLoggedUser(transport, {});
    expect(calls[0].query).toEqual({ pagination: { page: 1, pageSize: 20 } });
  });

  it('marks read, marks all read and toggles push', async () => {
    const { transport, calls } = createFakeTransport([{ success: true }, { data: { message: 'Nu există notificări necitite' } }, { success: true }]);
    await markNotificationAsRead(transport, 'n1');
    await markAllNotificationsAsRead(transport);
    await enableDisableNotifications(transport, false);
    expect(calls.map(c => [c.method, c.path, c.body])).toEqual([
      ['POST', '/notification-users/n1/mark-as-read', undefined],
      ['POST', '/notification-users/mark-all-as-read', undefined],
      ['PATCH', '/notifications/enable-disable-pns', { enabled: false }],
    ]);
  });
});

describe('feedback, reviews, reputation', () => {
  it('sends feedback wrapped in data', async () => {
    const { transport, calls } = createFakeTransport([{ data: { id: 1, documentId: 'f1', rating: 5 }, meta: {} }]);
    const fb = { rating: 5, feedback: 'bun', category: 'ui' as const, metadata: { v: '2' } };
    await sendFeedback(transport, fb);
    expect(calls[0]).toMatchObject({ method: 'POST', path: '/feedbacks', body: { data: fb }, auth: 'required' });
  });

  it('creates an angler review and reads a reputation', async () => {
    const reputation = { avgStars: 4, ratingCount: 1, noShowCount: 0, areas: { rules: null, cleanliness: null, behavior: null }, reviews: [review] };
    const { transport, calls } = createFakeTransport([{ data: review }, { data: reputation }]);
    await expect(createAnglerReview(transport, { booking: 'b1', stars: 4, tags: ['clean'] })).resolves.toEqual(review);
    expect(calls[0]).toMatchObject({ method: 'POST', path: '/feed/angler-reviews', body: { data: { booking: 'b1', stars: 4, tags: ['clean'] } } });
    await expect(getUserReputation(transport, 'u1')).resolves.toEqual(reputation);
    expect(calls[1]).toMatchObject({ method: 'GET', path: '/feed/users/u1/reputation', auth: 'none' });
  });
});

describe('media upload', () => {
  const uploaded = [{ id: 9, documentId: 'm9', name: 'a.jpg', url: 'https://x/a.jpg', mime: 'image/jpeg', formats: null }];

  it('uploadMedia posts the files as FormData with status=published', async () => {
    const { transport, calls } = createFakeTransport([uploaded]);
    const blob = new Blob(['x'], { type: 'image/jpeg' });
    await expect(uploadMedia(transport, { files: [{ filename: 'p.jpg', blob }, { filename: '', blob }] })).resolves.toEqual(uploaded);
    const body = calls[0].body as FormData;
    expect(calls[0]).toMatchObject({ method: 'POST', path: '/upload', auth: 'required' });
    expect(body.getAll('files').map(f => (f as File).name)).toEqual(['p.jpg', 'image.jpg']);
    expect(body.get('status')).toBe('published');
    expect(body.get('ref')).toBeNull();
  });

  it('uploadMediaAndAttachToEntity adds ref, refId and field', async () => {
    const { transport, calls } = createFakeTransport([uploaded]);
    await uploadMediaAndAttachToEntity(transport, {
      files: [{ filename: 'c.jpg', blob: new Blob(['x']) }],
      id: 42,
      ref: 'api::catch.catch',
      field: 'media',
    });
    const body = calls[0].body as FormData;
    expect([body.get('ref'), body.get('refId'), body.get('field'), body.get('status')]).toEqual(['api::catch.catch', '42', 'media', 'published']);
  });
});

describe('getFirebaseToken (ported from fish firebase-token.test.ts)', () => {
  it('GETs /feed/firebase-token and returns the token', async () => {
    const { transport, calls } = createFakeTransport([{ firebaseToken: 'custom-token-123' }]);
    await expect(getFirebaseToken(transport)).resolves.toBe('custom-token-123');
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ method: 'GET', path: '/feed/firebase-token', auth: 'required' });
  });

  it('returns null when the response has no token', async () => {
    const { transport } = createFakeTransport([{}]);
    await expect(getFirebaseToken(transport)).resolves.toBeNull();
  });

  it('returns null when firebaseToken is null', async () => {
    const { transport } = createFakeTransport([{ firebaseToken: null }]);
    await expect(getFirebaseToken(transport)).resolves.toBeNull();
  });
});

describe('widget notifications (fish services/api/widgetNotification.ts)', () => {
  const mine = { feature: 'weather', registered: true, registeredAt: '2026-10-01T08:00:00.000Z' };

  it('getMyWidgetNotification GETs /feed/widget-notifications/mine?feature= with the session', async () => {
    const { transport, calls } = createFakeTransport([{ data: mine }]);
    await expect(getMyWidgetNotification(transport, 'weather')).resolves.toEqual(mine);
    expect(calls[0]).toMatchObject({ method: 'GET', path: '/feed/widget-notifications/mine', query: { feature: 'weather' }, auth: 'required' });
  });

  it('getMyWidgetNotification maps a 401 to «not registered», as fish does', async () => {
    const { transport } = createFakeTransport(() => {
      throw new ApiError({ message: 'Unauthorized', status: 401, code: 'HTTP' });
    });
    await expect(getMyWidgetNotification(transport, 'moonPhases')).resolves.toEqual({ feature: 'moonPhases', registered: false, registeredAt: null });
  });

  it('getMyWidgetNotification rethrows any other failure', async () => {
    const { transport } = createFakeTransport(() => {
      throw new ApiError({ message: 'x', status: 500, code: 'HTTP' });
    });
    await expect(getMyWidgetNotification(transport, 'weather')).rejects.toSatisfy(e => isApiError(e) && e.status === 500);
  });

  it('rejects a feature outside the strict enum', async () => {
    const { transport } = createFakeTransport([{ data: { ...mine, feature: 'tides' } }]);
    await expect(getMyWidgetNotification(transport, 'weather')).rejects.toSatisfy(e => isApiError(e) && e.code === 'INVALID_RESPONSE');
  });

  it('registerWidgetNotification POSTs {data:{feature}} and parses the answer', async () => {
    const created = { documentId: 'w1', feature: 'jurnalPartide', registeredAt: null, created: true };
    const { transport, calls } = createFakeTransport([{ data: created }]);
    await expect(registerWidgetNotification(transport, 'jurnalPartide')).resolves.toEqual(created);
    expect(calls[0]).toMatchObject({ method: 'POST', path: '/feed/widget-notifications', body: { data: { feature: 'jurnalPartide' } }, auth: 'required' });
  });

  it('the query keeps fish\'s key, staleTime and session gate', () => {
    const { transport } = createFakeTransport();
    expect(widgetNotificationKeys.mine('weather')).toEqual(['widget-notification', 'mine', 'weather']);
    const q = myWidgetNotificationQuery(transport, 'weather', { isAuthenticated: false });
    expect(q.queryKey).toEqual(['widget-notification', 'mine', 'weather']);
    expect(q.staleTime).toBe(5 * 60 * 1000);
    expect(q.enabled).toBe(false);
    expect(myWidgetNotificationQuery(transport, 'weather').enabled).toBe(true);
  });

  it('the mutation invalidates that feature\'s «mine» only', async () => {
    const qc = new QueryClient();
    qc.setQueryData(widgetNotificationKeys.mine('weather'), mine);
    qc.setQueryData(widgetNotificationKeys.mine('moonPhases'), { ...mine, feature: 'moonPhases' });
    const { transport } = createFakeTransport([{ data: { documentId: 'w1', feature: 'weather', registeredAt: null, created: false } }]);
    await qc.getMutationCache().build(qc, registerWidgetNotificationMutation(transport, qc, 'weather')).execute(undefined);
    expect(qc.getQueryState(widgetNotificationKeys.mine('weather'))?.isInvalidated).toBe(true);
    expect(qc.getQueryState(widgetNotificationKeys.mine('moonPhases'))?.isInvalidated).toBe(false);
  });
});
