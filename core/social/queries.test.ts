import { describe, expect, it } from 'vitest';
import { createFakeTransport } from '@/tests/transport';
import {
  anglerCatchesInfiniteQuery,
  anglerCompetitionsInfiniteQuery,
  anglerFollowersInfiniteQuery,
  anglerFollowingInfiniteQuery,
  anglerLookupQuery,
  anglerProfileQuery,
  anglerSearchInfiniteQuery,
  anglerSessionsInfiniteQuery,
  anglersKeys,
  notificationsForLoggedUserInfiniteQuery,
  notificationsKeys,
  paginatedUsersInfiniteQuery,
  profileKeys,
  profileQuery,
  profileStatisticsQuery,
  reputationKeys,
  suggestedAnglersHomeInfiniteQuery,
  suggestedAnglersInfiniteQuery,
  unreadNotificationsCountQuery,
  userReputationQuery,
  usersKeys,
} from './queries';

const { transport } = createFakeTransport();
const page = (p: number, pageCount: number) => ({ data: [], meta: { pagination: { page: p, pageSize: 20, pageCount, total: 40 } } });

describe('query keys keep the fish shapes', () => {
  it('anglers', () => {
    expect(anglersKeys.all).toEqual(['anglers']);
    expect(anglersKeys.profile('u')).toEqual(['anglers', 'u']);
    expect(anglersKeys.followers('u')).toEqual(['anglers', 'u', 'followers']);
    expect(anglersKeys.following('u')).toEqual(['anglers', 'u', 'following']);
    expect(anglersKeys.sessions('u')).toEqual(['anglers', 'u', 'sessions']);
    expect(anglersKeys.catches('u')).toEqual(['anglers', 'u', 'catches']);
    expect(anglersKeys.competitions('u')).toEqual(['anglers', 'u', 'competitions', 'all', 'all']);
    expect(anglersKeys.competitions('u', 'podium', 2025)).toEqual(['anglers', 'u', 'competitions', 'podium', 2025]);
    expect(anglersKeys.search('ion')).toEqual(['anglers', 'search', 'ion']);
    expect(anglersKeys.suggested).toEqual(['anglers', 'suggested']);
    expect(anglersKeys.suggestedHome).toEqual(['anglers', 'suggested-home']);
  });

  it('profile, users, notifications, reputation', () => {
    expect(profileKeys).toEqual({ my: ['my-profile'], statistics: ['profile-statistics'] });
    expect(usersKeys.paginatedWithParams('a', 1, 20)).toEqual(['users', 'paginated', 'a', 1, 20]);
    expect(notificationsKeys).toEqual({
      all: ['notifications'],
      allForLoggedUser: ['notifications', 'all', 'for-logged-user'],
      unread: ['notifications', 'unread'],
    });
    expect(reputationKeys.byUser('u')).toEqual(['reputation', 'u']);
  });
});

describe('query factories', () => {
  it('use the placeholder keys and stay disabled without an id or a session', () => {
    expect(anglerProfileQuery(transport, undefined)).toMatchObject({ queryKey: ['anglers', 'none'], enabled: false });
    expect(anglerProfileQuery(transport, 'u', { isAuthenticated: false }).enabled).toBe(false);
    expect(anglerProfileQuery(transport, 'u')).toMatchObject({ queryKey: ['anglers', 'u'], enabled: true });
    expect(anglerFollowersInfiniteQuery(transport, undefined).queryKey).toEqual(['anglers', 'none', 'followers']);
    expect(anglerFollowingInfiniteQuery(transport, 'u').queryKey).toEqual(['anglers', 'u', 'following']);
    expect(anglerSessionsInfiniteQuery(transport, undefined).queryKey).toEqual(['anglers', 'none', 'sessions']);
    expect(anglerCatchesInfiniteQuery(transport, undefined).queryKey).toEqual(['anglers', 'none', 'catches']);
    expect(anglerCompetitionsInfiniteQuery(transport, undefined).queryKey).toEqual(['anglers', 'none', 'competitions']);
  });

  it('search needs 2 trimmed chars', () => {
    expect(anglerSearchInfiniteQuery(transport, ' i ')).toMatchObject({ queryKey: ['anglers', 'search', 'i'], enabled: false });
    expect(anglerSearchInfiniteQuery(transport, ' io ')).toMatchObject({ queryKey: ['anglers', 'search', 'io'], enabled: true });
  });

  it('offset lists page until pageCount; suggested pages off recentlyActive', () => {
    const q = anglerFollowersInfiniteQuery(transport, 'u');
    expect(q.getNextPageParam(page(1, 2), [], 1, [])).toBe(2);
    expect(q.getNextPageParam(page(2, 2), [], 2, [])).toBeUndefined();
    const s = suggestedAnglersInfiniteQuery(transport);
    expect(s).toMatchObject({ queryKey: ['anglers', 'suggested'], staleTime: 300_000, refetchOnWindowFocus: false });
    expect(s.getNextPageParam({ friendsOfFollows: [], recentlyActive: page(1, 3) }, [], 1, [])).toBe(2);
  });

  it('catches page by cursor, ending on null', () => {
    const q = anglerCatchesInfiniteQuery(transport, 'u');
    expect(q.initialPageParam).toBeNull();
    const cursorPage = (nextCursor: string | null) => ({ data: [], meta: { pagination: { pageSize: 20, total: 1 }, nextCursor } });
    expect(q.getNextPageParam(cursorPage('C2'), [], null, [])).toBe('C2');
    expect(q.getNextPageParam(cursorPage(null), [], null, [])).toBeUndefined();
  });

  it('competitions keep the previous data while filters change', () => {
    const q = anglerCompetitionsInfiniteQuery(transport, 'u', { filter: 'team', year: 2024 });
    expect(q.queryKey).toEqual(['anglers', 'u', 'competitions', 'team', 2024]);
    const prev = { pages: [], pageParams: [] };
    expect((q.placeholderData as (p: unknown) => unknown)(prev)).toBe(prev);
  });

  it('the Home rail carries its one-request-per-launch policy', () => {
    expect(suggestedAnglersHomeInfiniteQuery(transport)).toMatchObject({
      queryKey: ['anglers', 'suggested-home'],
      staleTime: 6 * 60 * 60_000,
      gcTime: 24 * 60 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      retry: false,
    });
  });

  it('angler lookup is armed, owner-lake-bound and needs 7 digits', () => {
    expect(anglerLookupQuery(transport, 'lake', '0712 345', true)).toMatchObject({
      queryKey: ['bookings', 'angler-lookup', 'lake', '0712 345'],
      enabled: true,
      retry: false,
      staleTime: 300_000,
    });
    expect(anglerLookupQuery(transport, 'lake', '071234', true).enabled).toBe(false);
    expect(anglerLookupQuery(transport, 'lake', '0712345', false).enabled).toBe(false);
    expect(anglerLookupQuery(transport, '', '0712345', true).enabled).toBe(false);
  });

  it('profile, statistics, reputation, users, notifications', () => {
    expect(profileQuery(transport, { isAuthenticated: false })).toMatchObject({ queryKey: ['my-profile'], enabled: false, staleTime: 86_400_000, gcTime: 86_400_000 });
    expect(profileStatisticsQuery(transport)).toMatchObject({ queryKey: ['profile-statistics'], retry: 1 });
    expect(userReputationQuery(transport)).toMatchObject({ queryKey: ['reputation', ''], enabled: false });
    expect(userReputationQuery(transport, 'u').enabled).toBe(true);
    expect(paginatedUsersInfiniteQuery(transport).queryKey).toEqual(['users', 'paginated', '', 1, 20]);
    expect(notificationsForLoggedUserInfiniteQuery(transport).queryKey).toEqual(['notifications', 'all', 'for-logged-user']);
    const unread = unreadNotificationsCountQuery(transport);
    expect(unread).toMatchObject({ queryKey: ['notifications', 'unread'], staleTime: Infinity });
    expect(unread.select!({ count: 4 })).toBe(4);
  });

  it('queryFns call through to the api', async () => {
    const fake = createFakeTransport([{ count: 3 }]);
    const q = unreadNotificationsCountQuery(fake.transport);
    await expect((q.queryFn as () => Promise<unknown>)()).resolves.toEqual({ count: 3 });
    expect(fake.calls[0].path).toBe('/notification-users/unread');
  });
});
