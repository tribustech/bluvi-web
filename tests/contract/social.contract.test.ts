import { describe, expect, it } from 'vitest';
import {
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
  markNotificationAsRead,
  postUserStatisticsBatch,
  searchAnglers,
  unfollowAngler,
  FEATURE_KEYS,
  type AnglerListItem,
} from '@/core/social';
import { isApiError } from '@/core/transport';
import { contractContext, expectDenied } from './context';

const { guest, user, userDocumentId } = contractContext();

/** The QA user plus the anglers they follow: people with real history on the local DB. */
async function knownAnglers(): Promise<string[]> {
  const following = await getAnglerFollowing(user, userDocumentId, { page: 1, pageSize: 5 });
  return [userDocumentId, ...following.data.map(a => a.documentId)];
}

describe('anglers — public tab lists (auth: false)', () => {
  it('sessions, competitions and catches parse as guest and as user', async () => {
    const ids = await knownAnglers();
    let sessions = 0;
    let competitions = 0;
    let catches = 0;
    for (const t of [guest, user]) {
      for (const id of ids) {
        const s = await getAnglerSessions(t, id, { page: 1, pageSize: 10 });
        expect(s.meta.pagination.page).toBe(1);
        sessions += s.data.length;

        const c = await getAnglerCompetitions(t, id, { page: 1, pageSize: 10 });
        competitions += c.data.length;
        await getAnglerCompetitions(t, id, { page: 1, pageSize: 10, filter: 'podium' });

        const first = await getAnglerCatches(t, id, { pageSize: 2 });
        catches += first.data.length;
        if (first.meta.nextCursor) {
          const second = await getAnglerCatches(t, id, { cursor: first.meta.nextCursor, pageSize: 2 });
          expect(second.data.map(x => x.key)).not.toContain(first.data[0].key);
        }
      }
    }
    // The local DB has history for these anglers; an empty sweep would prove nothing.
    expect(sessions).toBeGreaterThan(0);
    expect(competitions).toBeGreaterThan(0);
    expect(catches).toBeGreaterThan(0);
  });
});

describe('anglers — per-viewer routes', () => {
  it('profile header, followers and following as user; denied as guest', async () => {
    for (const id of await knownAnglers()) {
      const p = await getAnglerProfile(user, id);
      expect(p.documentId).toBe(id);
      expect(p.isSelf).toBe(id === userDocumentId);
      await getAnglerFollowers(user, id, { page: 1, pageSize: 5 });
      await getAnglerFollowing(user, id, { page: 1, pageSize: 5 });
    }
    await expectDenied(getAnglerProfile(guest, userDocumentId));
    await expectDenied(getAnglerFollowers(guest, userDocumentId, { page: 1, pageSize: 5 }));
    await expectDenied(getAnglerFollowing(guest, userDocumentId, { page: 1, pageSize: 5 }));
  });

  it('search and the Home rail as user; denied as guest', async () => {
    const found = await searchAnglers(user, 'an', { page: 1, pageSize: 10 });
    expect(found.data.length).toBeGreaterThan(0);
    const home = await getSuggestedHome(user, { page: 1, pageSize: 10 });
    expect(home.meta.pagination.page).toBe(1);
    await expectDenied(searchAnglers(guest, 'an', { page: 1, pageSize: 10 }));
    await expectDenied(getSuggestedHome(guest, { page: 1, pageSize: 10 }));
  });

  it('suggested (discovery) as user; denied as guest', async ctx => {
    await expectDenied(getSuggestedAnglers(guest, { page: 1, pageSize: 10 }));
    try {
      const s = await getSuggestedAnglers(user, { page: 1, pageSize: 10 });
      expect(s.recentlyActive.meta.pagination.page).toBe(1);
    } catch (e) {
      // Local CMS: the Authenticated role has no `api::follow.follow.suggested` grant, so even the
      // signed-in user gets 403. Nothing to validate until the grant is applied.
      if (isApiError(e) && e.status === 403) return ctx.skip();
      throw e;
    }
  });

  it('follow → unfollow round trip restores the original state', async () => {
    const found = await searchAnglers(user, 'an', { page: 1, pageSize: 25 });
    const target = found.data.find((a: AnglerListItem) => !a.isFollowedByMe && a.documentId !== userDocumentId);
    expect(target, 'a not-yet-followed angler to round-trip on').toBeDefined();
    const id = target!.documentId;
    const before = await getAnglerProfile(user, id);
    try {
      const followed = await followAngler(user, id);
      expect(followed.following).toBe(true);
      expect(followed.followersCount).toBe(before.counts.followers + 1);
    } finally {
      const unfollowed = await unfollowAngler(user, id);
      expect(unfollowed.following).toBe(false);
    }
    const after = await getAnglerProfile(user, id);
    expect(after.isFollowedByMe).toBe(false);
    expect(after.counts.followers).toBe(before.counts.followers);
    await expectDenied(followAngler(guest, id));
    await expectDenied(unfollowAngler(guest, id));
  });

});

describe('profile + users', () => {
  it('own profile, statistics, stats batch and users list as user; denied as guest', async () => {
    const profile = await getProfile(user);
    expect(profile.documentId).toBe(userDocumentId);
    await getStatistics(user);
    const ids = await knownAnglers();
    const batch = await postUserStatisticsBatch(user, ids);
    expect(Object.keys(batch)).toContain(userDocumentId);
    const users = await getPaginatedUsers(user, { page: 1, pageSize: 5, search: '' });
    expect(users.data.length).toBeGreaterThan(0);
    await getPaginatedUsers(user, { page: 1, pageSize: 5, search: 'an' });

    await expectDenied(getProfile(guest));
    await expectDenied(getStatistics(guest));
    await expectDenied(postUserStatisticsBatch(guest, ids));
    await expectDenied(getPaginatedUsers(guest, { page: 1, pageSize: 5 }));
  });

  it('statute for a competition the user took part in; denied as guest', async () => {
    const history = await getAnglerCompetitions(user, userDocumentId, { page: 1, pageSize: 1 });
    const competitionId = history.data[0]?.competition.documentId;
    expect(competitionId, 'QA user has a competition in their history').toBeDefined();
    const statute = await getUSerStatuteForCompetition(user, competitionId!);
    expect(statute.userRole).not.toBeUndefined();
    await expectDenied(getUSerStatuteForCompetition(guest, competitionId!));
  });

  it('firebase token as user; denied as guest', async () => {
    const token = await getFirebaseToken(user);
    expect(token === null || typeof token === 'string').toBe(true);
    await expectDenied(getFirebaseToken(guest));
  });
});

describe('widget notifications — GET mine only (the POST is a write)', () => {
  it('parses as user for every feature; a guest gets fish\'s 401 mapping «not registered»', async () => {
    for (const feature of FEATURE_KEYS) {
      const mine = await getMyWidgetNotification(user, feature);
      expect(mine.feature).toBe(feature);
      expect(await getMyWidgetNotification(guest, feature)).toEqual({ feature, registered: false, registeredAt: null });
    }
  });
});

describe('reputation (public)', () => {
  it('parses as guest and as user', async () => {
    for (const t of [guest, user]) {
      for (const id of await knownAnglers()) {
        const r = await getUserReputation(t, id);
        expect(r.ratingCount).toBe(r.reviews.length);
      }
    }
  });
});

describe('notifications', () => {
  it('inbox pages and unread count as user; denied as guest', async () => {
    const first = await getNotificationsForLoggedUser(user, { page: 1, pageSize: 20 });
    expect(first.meta.pagination.page).toBe(1);
    if (first.meta.pagination.pageCount > 1) {
      const second = await getNotificationsForLoggedUser(user, { page: 2, pageSize: 20 });
      expect(second.meta.pagination.page).toBe(2);
    }
    const unread = await getUnreadNotificationsForLoggedInUser(user);
    expect(unread.count).toBeGreaterThanOrEqual(0);
    // The Public role IS granted `notification-user.find` locally, so the guest reaches the
    // controller, which refuses with 404 "Must be authenticated" (ctx.notFound) instead of 401/403.
    const guestInbox = await getNotificationsForLoggedUser(guest, { page: 1, pageSize: 20 }).catch(e => e);
    expect(isApiError(guestInbox) && [guestInbox.status, guestInbox.message]).toEqual([404, 'Must be authenticated']);
    await expectDenied(getUnreadNotificationsForLoggedInUser(guest));
  });

  it('mark-as-read on an ALREADY-read notification (idempotent); denied as guest', async ctx => {
    const all = await getNotificationsForLoggedUser(user, { page: 1, pageSize: 100 });
    const read = all.data.find(n => n.read);
    await expectDenied(markNotificationAsRead(guest, read?.notification.documentId ?? 'x'));
    // Local QA inbox has only unread rows; marking one would change state, so there is nothing
    // idempotent to exercise until a read row exists.
    if (!read) return ctx.skip();
    const unreadBefore = (await getUnreadNotificationsForLoggedInUser(user)).count;
    await expect(markNotificationAsRead(user, read.notification.documentId)).resolves.toEqual({ success: true });
    expect((await getUnreadNotificationsForLoggedInUser(user)).count).toBe(unreadBefore);
  });
});
