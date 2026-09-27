// A real QueryClient is allowed in tests (core/README.md → Tests); the lint rule guards runtime code.
import { MutationObserver, QueryClient, type InfiniteData } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { createFakeTransport } from '@/tests/transport';
import {
  applyFollowToConnectionPages,
  applyFollowToProfile,
  applyFollowToSuggestedPages,
  createAnglerReviewMutation,
  deleteProfileMutation,
  followAnglerMutation,
  isConnectionListKey,
  isSearchListKey,
  isSuggestedHomeKey,
  isSuggestedKey,
  markAllNotificationsAsReadMutation,
  markAllReadInPages,
  markNotificationAsReadMutation,
  toggleNotificationsMutation,
  updateProfileMutation,
} from './mutations';
import { anglersKeys, notificationsKeys, profileKeys } from './queries';
import type { AnglerProfile, AnglersPage, SuggestedAngler, SuggestedAnglersPage } from './schemas';

const pagination = { page: 1, pageSize: 10, pageCount: 1, total: 1 };
const profile: AnglerProfile = {
  id: 1,
  documentId: 'u1',
  username: 'ana',
  avatarUrl: null,
  bio: null,
  memberSince: '2026-01-01',
  counts: { followers: 10, following: 3, catches: 0, sessions: 0, competitions: 0 },
  biggestCatch: null,
  podium: { first: 0, second: 0, third: 0 },
  isFollowedByMe: false,
  isSelf: false,
};

// ── ported from fish services/mutations/__tests__/useFollowAngler.helpers.test.ts ─────────────────

describe('applyFollowToProfile', () => {
  it('increments followers and flips the flag on follow', () => {
    const next = applyFollowToProfile(profile, true);
    expect(next.isFollowedByMe).toBe(true);
    expect(next.counts.followers).toBe(11);
  });
  it('decrements without going below zero on unfollow', () => {
    const next = applyFollowToProfile({ ...profile, counts: { ...profile.counts, followers: 0 } }, false);
    expect(next.counts.followers).toBe(0);
  });
});

describe('applyFollowToConnectionPages', () => {
  it('flips isFollowedByMe on the matching row across pages', () => {
    const pages = [
      { data: [{ documentId: 'u1', isFollowedByMe: false }], meta: { pagination } },
      { data: [{ documentId: 'u2', isFollowedByMe: false }], meta: { pagination } },
    ];
    const next = applyFollowToConnectionPages(pages, 'u2', true);
    expect(next[0].data[0].isFollowedByMe).toBe(false);
    expect(next[1].data[0].isFollowedByMe).toBe(true);
  });
  it('flips a SuggestedAngler row too (same page shape)', () => {
    const row: SuggestedAngler = {
      documentId: 'd1', username: 'ana', avatarUrl: null, isFollowedByMe: false,
      stats: { competitions: 0, podiums: 0, sessions: 0, catches: 0, recordKg: null, followers: 0 },
    };
    const out = applyFollowToConnectionPages([{ data: [row], meta: { pagination } }], 'd1', true);
    expect(out[0].data[0].isFollowedByMe).toBe(true);
    expect(out[0].data[0].stats).toBe(row.stats);
  });
});

describe('key predicates', () => {
  it('isConnectionListKey matches followers/following only', () => {
    expect(isConnectionListKey(['anglers', 'u1', 'followers'])).toBe(true);
    expect(isConnectionListKey(['anglers', 'u1', 'following'])).toBe(true);
    expect(isConnectionListKey(['anglers', 'u1', 'sessions'])).toBe(false);
    expect(isConnectionListKey(['anglers', 'u1', 'competitions', 'all', 'all'])).toBe(false);
    expect(isConnectionListKey(['anglers', 'u1'])).toBe(false);
  });
  it('isSearchListKey / isSuggestedKey / isSuggestedHomeKey', () => {
    expect(isSearchListKey(['anglers', 'search', 'ion'])).toBe(true);
    expect(isSearchListKey(['anglers', 'suggested'])).toBe(false);
    expect(isSearchListKey(['anglers', 'u1', 'followers'])).toBe(false);
    expect(isSuggestedKey(['anglers', 'suggested'])).toBe(true);
    expect(isSuggestedKey(['anglers', 'search', 'ion'])).toBe(false);
    expect(isSuggestedHomeKey(['anglers', 'suggested-home'])).toBe(true);
    expect(isSuggestedHomeKey(['anglers', 'suggested'])).toBe(false);
    expect(isSuggestedHomeKey(['anglers', 'x', 'followers'])).toBe(false);
  });
});

describe('applyFollowToSuggestedPages', () => {
  const item = (documentId: string) => ({ documentId, username: documentId, avatarUrl: null, isFollowedByMe: false });
  const pages: SuggestedAnglersPage[] = [
    { friendsOfFollows: [item('fof1')], recentlyActive: { data: [item('ra1')], meta: { pagination } } },
    { friendsOfFollows: [], recentlyActive: { data: [item('ra2')], meta: { pagination } } },
  ];
  it('flips isFollowedByMe in the friendsOfFollows section', () => {
    expect(applyFollowToSuggestedPages(pages, 'fof1', true)[0].friendsOfFollows[0].isFollowedByMe).toBe(true);
  });
  it('flips isFollowedByMe in the recentlyActive section, across pages', () => {
    const next = applyFollowToSuggestedPages(pages, 'ra2', true);
    expect(next[0].recentlyActive.data[0].isFollowedByMe).toBe(false);
    expect(next[1].recentlyActive.data[0].isFollowedByMe).toBe(true);
  });
  it('leaves non-matching rows untouched', () => {
    expect(applyFollowToSuggestedPages(pages, 'nonexistent', true)).toEqual(pages);
  });
});

// ── the mutation wiring, against a real QueryClient ─────────────────────────────────────────────────

function infinite<T>(pages: T[]): InfiniteData<T> {
  return { pages, pageParams: pages.map((_, i) => i + 1) };
}
const listRow = (documentId: string, isFollowedByMe = false) => ({ documentId, username: documentId, avatarUrl: null, isFollowedByMe });

function seededClient() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  qc.setQueryData(profileKeys.my, { documentId: 'me' });
  qc.setQueryData(anglersKeys.profile('u1'), profile);
  qc.setQueryData(anglersKeys.followers('owner'), infinite([{ data: [listRow('u1')], meta: { pagination } }]));
  qc.setQueryData(anglersKeys.search('an'), infinite([{ data: [listRow('u1'), listRow('u2')], meta: { pagination } }]));
  qc.setQueryData(
    anglersKeys.suggestedHome,
    infinite([{ data: [{ ...listRow('u1'), stats: { competitions: 0, podiums: 0, sessions: 0, catches: 0, recordKg: null, followers: 0 } }], meta: { pagination } }])
  );
  qc.setQueryData(
    anglersKeys.suggested,
    infinite([{ friendsOfFollows: [listRow('u1')], recentlyActive: { data: [listRow('u1')], meta: { pagination } } }])
  );
  // Same ['anglers', id] prefix, different shape — must never be touched by the list patch.
  const sessions = infinite([{ data: [{ documentId: 's1' }], meta: { pagination } }]);
  qc.setQueryData(anglersKeys.sessions('u1'), sessions);
  return { qc, sessions };
}

function followed(qc: QueryClient, documentId: string): boolean[] {
  const flags: boolean[] = [];
  flags.push(qc.getQueryData<AnglerProfile>(anglersKeys.profile(documentId))!.isFollowedByMe);
  for (const key of [anglersKeys.followers('owner'), anglersKeys.search('an'), anglersKeys.suggestedHome]) {
    const d = qc.getQueryData<InfiniteData<AnglersPage<{ documentId: string; isFollowedByMe: boolean }>>>(key)!;
    flags.push(d.pages[0].data.find(r => r.documentId === documentId)!.isFollowedByMe);
  }
  const s = qc.getQueryData<InfiniteData<SuggestedAnglersPage>>(anglersKeys.suggested)!;
  flags.push(s.pages[0].friendsOfFollows[0].isFollowedByMe, s.pages[0].recentlyActive.data[0].isFollowedByMe);
  return flags;
}

describe('followAnglerMutation', () => {
  it('patches every angler cache optimistically, then invalidates the right keys', async () => {
    const { qc, sessions } = seededClient();
    let release!: (v: unknown) => void;
    const { transport, calls } = createFakeTransport(() => ({ following: true, followersCount: 11 }));
    const gated = { request: async <T,>(req: Parameters<typeof transport.request>[0]) => {
      await new Promise(r => (release = r));
      return transport.request<T>(req);
    } };
    const invalidate = vi.spyOn(qc, 'invalidateQueries');
    const observer = new MutationObserver(qc, followAnglerMutation(gated, qc));

    const done = observer.mutate({ documentId: 'u1', follow: true });
    await vi.waitFor(() => expect(followed(qc, 'u1')).toEqual([true, true, true, true, true, true]));
    expect(qc.getQueryData<AnglerProfile>(anglersKeys.profile('u1'))!.counts.followers).toBe(11);
    // u2 in the search page and the sessions cache are untouched.
    expect(qc.getQueryData<InfiniteData<AnglersPage<{ isFollowedByMe: boolean }>>>(anglersKeys.search('an'))!.pages[0].data[1].isFollowedByMe).toBe(false);
    expect(qc.getQueryData(anglersKeys.sessions('u1'))).toBe(sessions);

    release(undefined);
    await done;
    expect(calls[0]).toMatchObject({ method: 'POST', path: '/feed/anglers/u1/follow' });
    expect(invalidate.mock.calls.map(c => c[0])).toEqual([
      { queryKey: ['anglers', 'u1'] },
      { queryKey: ['anglers', 'u1', 'followers'] },
      { queryKey: ['anglers', 'me'], exact: true },
      { queryKey: ['anglers', 'me', 'following'] },
      { queryKey: ['anglers', 'suggested-home'], refetchType: 'none' },
    ]);
  });

  it('unfollow posts to /unfollow and skips the viewer keys when no profile is cached', async () => {
    const { qc } = seededClient();
    qc.removeQueries({ queryKey: profileKeys.my });
    const { transport, calls } = createFakeTransport([{ following: false, followersCount: 9 }]);
    const invalidate = vi.spyOn(qc, 'invalidateQueries');
    await new MutationObserver(qc, followAnglerMutation(transport, qc)).mutate({ documentId: 'u1', follow: false });
    expect(calls[0].path).toBe('/feed/anglers/u1/unfollow');
    expect(invalidate).toHaveBeenCalledTimes(3);
  });

  it('rolls every patched cache back on error', async () => {
    const { qc } = seededClient();
    const before = followed(qc, 'u1');
    const failing = { request: async () => { throw new Error('boom'); } };
    const observer = new MutationObserver(qc, followAnglerMutation(failing, qc));
    await expect(observer.mutate({ documentId: 'u1', follow: true })).rejects.toThrow('boom');
    expect(followed(qc, 'u1')).toEqual(before);
    expect(qc.getQueryData(anglersKeys.profile('u1'))).toEqual(profile);
  });
});

describe('other mutations', () => {
  it('updateProfile invalidates my-profile and every anglers query', async () => {
    const qc = new QueryClient();
    const invalidate = vi.spyOn(qc, 'invalidateQueries');
    const { transport, calls } = createFakeTransport([null]);
    await new MutationObserver(qc, updateProfileMutation(transport, qc)).mutate({ bio: 'x' });
    expect(calls[0]).toMatchObject({ method: 'PATCH', path: '/user/profile' });
    expect(invalidate.mock.calls.map(c => c[0])).toEqual([{ queryKey: ['my-profile'] }, { queryKey: ['anglers'] }]);
  });

  it('deleteProfile invalidates my-profile', async () => {
    const qc = new QueryClient();
    const invalidate = vi.spyOn(qc, 'invalidateQueries');
    const { transport, calls } = createFakeTransport([{ message: 'ok' }]);
    await new MutationObserver(qc, deleteProfileMutation(transport, qc)).mutate();
    expect(calls[0].method).toBe('DELETE');
    expect(invalidate.mock.calls.map(c => c[0])).toEqual([{ queryKey: ['my-profile'] }]);
  });

  it('markNotificationAsRead invalidates the notifications family', async () => {
    const qc = new QueryClient();
    const invalidate = vi.spyOn(qc, 'invalidateQueries');
    const { transport, calls } = createFakeTransport([{ success: true }]);
    await new MutationObserver(qc, markNotificationAsReadMutation(transport, qc)).mutate('n1');
    expect(calls[0].path).toBe('/notification-users/n1/mark-as-read');
    expect(invalidate.mock.calls.map(c => c[0])).toEqual([{ queryKey: ['notifications'] }]);
  });

  it('markAllNotificationsAsRead flips every loaded row, then invalidates', async () => {
    const row = (read: boolean) => ({ id: 1, documentId: 'x', read, readAt: null, notification: { id: 1, documentId: 'n', title: '', body: '', sentAt: '', data: {}, type: 'news' } });
    expect(markAllReadInPages({ pages: [{ data: [row(false), row(true)] }] }).pages[0].data.map(r => r.read)).toEqual([true, true]);

    const qc = new QueryClient();
    qc.setQueryData(notificationsKeys.allForLoggedUser, infinite([{ data: [row(false)], meta: { pagination } }]));
    const invalidate = vi.spyOn(qc, 'invalidateQueries');
    const { transport } = createFakeTransport([{ data: { message: 'ok' } }]);
    await new MutationObserver(qc, markAllNotificationsAsReadMutation(transport, qc)).mutate();
    const data = qc.getQueryData<InfiniteData<{ data: { read: boolean }[] }>>(notificationsKeys.allForLoggedUser)!;
    expect(data.pages[0].data[0].read).toBe(true);
    expect(data.pageParams).toEqual([1]);
    expect(invalidate.mock.calls.map(c => c[0])).toEqual([{ queryKey: ['notifications'] }]);
  });

  it('toggleNotifications writes notificationsEnabled optimistically', async () => {
    const qc = new QueryClient();
    qc.setQueryData(profileKeys.my, { documentId: 'me', notificationsEnabled: true });
    const { transport, calls } = createFakeTransport([{ success: true }]);
    await new MutationObserver(qc, toggleNotificationsMutation(transport, qc)).mutate(false);
    expect(qc.getQueryData(profileKeys.my)).toEqual({ documentId: 'me', notificationsEnabled: false });
    expect(calls[0]).toMatchObject({ method: 'PATCH', body: { enabled: false } });
  });

  it('createAnglerReview invalidates reputation, bookings and operator stats', async () => {
    const qc = new QueryClient();
    const invalidate = vi.spyOn(qc, 'invalidateQueries');
    const review = { stars: 5, comment: null, authorName: null, lakeName: null, createdAt: '2026-09-01', rulesScore: null, cleanlinessScore: null, behaviorScore: null, tags: [] };
    const { transport } = createFakeTransport([{ data: review }]);
    await new MutationObserver(qc, createAnglerReviewMutation(transport, qc)).mutate({ booking: 'b1', stars: 5 });
    expect(invalidate.mock.calls.map(c => c[0])).toEqual([
      { queryKey: ['reputation'] },
      { queryKey: ['bookings'] },
      { queryKey: ['operator-stats'] },
    ]);
  });
});
