import type { InfiniteData, QueryClient, QueryKey } from '@tanstack/react-query';
import { mutationOptions } from '../shared';
import type { Transport } from '../transport';
import {
  createAnglerReview,
  deleteProfile,
  enableDisableNotifications,
  followAngler,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  registerWidgetNotification,
  sendFeedback,
  unfollowAngler,
  updateProfile,
  uploadMedia,
  type MediaFile,
} from './api';
import { anglersKeys, notificationsKeys, profileKeys, reputationKeys, socialForeignKeys, widgetNotificationKeys } from './queries';
import type {
  AnglerListItem,
  AnglerProfile,
  AnglersPage,
  CreateAnglerReviewInput,
  FeatureKey,
  Feedback,
  NotificationResponse,
  Profile,
  SuggestedAnglersPage,
  UpdateProfileRequest,
} from './schemas';

// ── useFollowAngler: pure cache helpers ─────────────────────────────────────────────────────────────

export function applyFollowToProfile(profile: AnglerProfile, follow: boolean): AnglerProfile {
  return {
    ...profile,
    isFollowedByMe: follow,
    counts: {
      ...profile.counts,
      followers: Math.max(0, profile.counts.followers + (follow ? 1 : -1)),
    },
  };
}

export function isConnectionListKey(queryKey: readonly unknown[]): boolean {
  return queryKey[2] === 'followers' || queryKey[2] === 'following';
}

export function applyFollowToConnectionPages<T extends { documentId: string; isFollowedByMe: boolean }>(
  pages: AnglersPage<T>[],
  documentId: string,
  follow: boolean
): AnglersPage<T>[] {
  return pages.map(page => ({
    ...page,
    data: page.data.map(item => (item.documentId === documentId ? { ...item, isFollowedByMe: follow } : item)),
  }));
}

/** Discovery search results (`['anglers','search',q]`) share the connections-list page shape, so
 * `applyFollowToConnectionPages` patches them too. */
export function isSearchListKey(queryKey: readonly unknown[]): boolean {
  return queryKey[0] === 'anglers' && queryKey[1] === 'search';
}

export function isSuggestedKey(queryKey: readonly unknown[]): boolean {
  return queryKey[0] === 'anglers' && queryKey[1] === 'suggested';
}

/** Home rail (`['anglers','suggested-home']`) — a plain `AnglersPage<SuggestedAngler>`, patched like a
 * connections list. It is the ONE discovery cache that IS marked stale after a follow
 * (refetchType 'none' — see onSettled). */
export function isSuggestedHomeKey(queryKey: readonly unknown[]): boolean {
  return queryKey[0] === 'anglers' && queryKey[1] === 'suggested-home';
}

/** Flips `isFollowedByMe` in BOTH sections of a suggested page. Patch only: the FoF sample is a
 * weighted-random draw that must stay stable for the visit, so this must never be paired with an
 * invalidation of the suggested key. */
export function applyFollowToSuggestedPages(
  pages: SuggestedAnglersPage[],
  documentId: string,
  follow: boolean
): SuggestedAnglersPage[] {
  const flip = (item: AnglerListItem) => (item.documentId === documentId ? { ...item, isFollowedByMe: follow } : item);
  return pages.map(page => ({
    friendsOfFollows: page.friendsOfFollows.map(flip),
    recentlyActive: { ...page.recentlyActive, data: page.recentlyActive.data.map(flip) },
  }));
}

type ListPage = AnglersPage<{ documentId: string; isFollowedByMe: boolean }>;
export type FollowAnglerVariables = { documentId: string; follow: boolean };
export type FollowAnglerContext = {
  previousProfile: AnglerProfile | undefined;
  previousLists: [QueryKey, InfiniteData<ListPage> | undefined][];
  previousSuggested: [QueryKey, InfiniteData<SuggestedAnglersPage> | undefined][];
};

/** fish `useFollowAngler` (default export) — optimistic follow/unfollow across every angler cache. */
export function followAnglerMutation(t: Transport, qc: QueryClient) {
  return mutationOptions<Awaited<ReturnType<typeof followAngler>>, Error, FollowAnglerVariables, FollowAnglerContext>({
    mutationFn: ({ documentId, follow }) => (follow ? followAngler(t, documentId) : unfollowAngler(t, documentId)),

    onMutate: async ({ documentId, follow }) => {
      await qc.cancelQueries({ queryKey: anglersKeys.all });

      const profileKey = anglersKeys.profile(documentId);
      const previousProfile = qc.getQueryData<AnglerProfile>(profileKey);
      if (previousProfile) {
        qc.setQueryData(profileKey, applyFollowToProfile(previousProfile, follow));
      }

      // Flip the row in any loaded connections list (any owner's followers/following), discovery
      // search page or Home rail — all share the AnglersPage shape. Scoped by key: sessions and
      // competitions caches share the ['anglers', id, ...] prefix but hold a different page shape.
      const listEntries = qc.getQueriesData<InfiniteData<ListPage>>({
        queryKey: anglersKeys.all,
        predicate: q => isConnectionListKey(q.queryKey) || isSearchListKey(q.queryKey) || isSuggestedHomeKey(q.queryKey),
      });
      const previousLists = listEntries.filter(([, d]) => d?.pages);
      for (const [key, data] of previousLists) {
        qc.setQueryData(key, { ...data!, pages: applyFollowToConnectionPages(data!.pages, documentId, follow) });
      }

      // Flip the row in the suggested/discovery cache too (both sections). Patch only — never
      // invalidated, see applyFollowToSuggestedPages.
      const suggestedEntries = qc.getQueriesData<InfiniteData<SuggestedAnglersPage>>({
        queryKey: anglersKeys.all,
        predicate: q => isSuggestedKey(q.queryKey),
      });
      const previousSuggested = suggestedEntries.filter(([, d]) => d?.pages);
      for (const [key, data] of previousSuggested) {
        qc.setQueryData(key, { ...data!, pages: applyFollowToSuggestedPages(data!.pages, documentId, follow) });
      }

      return { previousProfile, previousLists, previousSuggested };
    },

    onError: (_err, { documentId }, context) => {
      if (context?.previousProfile) {
        qc.setQueryData(anglersKeys.profile(documentId), context.previousProfile);
      }
      for (const [key, data] of context?.previousLists ?? []) qc.setQueryData(key, data);
      for (const [key, data] of context?.previousSuggested ?? []) qc.setQueryData(key, data);
    },

    onSettled: (_data, _err, { documentId }) => {
      qc.invalidateQueries({ queryKey: anglersKeys.profile(documentId) });
      qc.invalidateQueries({ queryKey: anglersKeys.followers(documentId) });
      // The viewer's own `counts.following` and following list changed too — `exact: true` on the
      // profile key so it doesn't cascade into the sessions/catches/competitions caches sharing
      // the ['anglers', id] prefix.
      const myDocumentId = qc.getQueryData<Profile>(profileKeys.my)?.documentId;
      if (myDocumentId) {
        qc.invalidateQueries({ queryKey: anglersKeys.profile(myDocumentId), exact: true });
        qc.invalidateQueries({ queryKey: anglersKeys.following(myDocumentId) });
      }
      // Home rail: the followed card stays visible (patched above); mark the pool stale so the NEXT
      // cold start reshuffles it, but never refetch now — that would swap the cards under the thumb.
      qc.invalidateQueries({ queryKey: anglersKeys.suggestedHome, refetchType: 'none' });
    },
  });
}

// ── profile ─────────────────────────────────────────────────────────────────────────────────────────

/** fish `useUpdateProfile` */
export function updateProfileMutation(t: Transport, qc: QueryClient) {
  return mutationOptions({
    mutationFn: (profile: UpdateProfileRequest) => updateProfile(t, profile),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: profileKeys.my });
      // The own-profile screen renders off the anglers query, NOT my-profile — so edits (bio, name,
      // avatar) stayed stale until a manual refresh. Prefix-invalidate every anglers query.
      qc.invalidateQueries({ queryKey: anglersKeys.all });
    },
  });
}

/**
 * fish `useDeleteProfile`. fish first deletes the stored push-token document id from AsyncStorage
 * (native push registration) — no web equivalent; the session cookie is cleared by the auth route.
 */
export function deleteProfileMutation(t: Transport, qc: QueryClient) {
  return mutationOptions({
    mutationFn: async () => {
      await deleteProfile(t);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: profileKeys.my });
    },
  });
}

/**
 * fish `useUploadProfilePicture`. No invalidation: it is never used without a following
 * `updateProfileMutation` (which sets `avatar` to the uploaded id and invalidates the profile).
 */
export function uploadProfilePictureMutation(t: Transport) {
  return mutationOptions({
    mutationFn: ({ files }: { files: MediaFile[] }) => uploadMedia(t, { files }),
  });
}

// ── notifications ───────────────────────────────────────────────────────────────────────────────────

/** fish `useMarkNotificationAsRead` */
export function markNotificationAsReadMutation(t: Transport, qc: QueryClient) {
  return mutationOptions({
    mutationFn: (notificationId: string) => markNotificationAsRead(t, notificationId),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: notificationsKeys.all });
    },
  });
}

type NotificationPages = { pages: { data: NotificationResponse[] }[] };

/** Pure optimistic step of `useMarkAllNotificationsAsRead`: every loaded row becomes read. */
export function markAllReadInPages<T extends NotificationPages>(data: T): T {
  return { ...data, pages: data.pages.map(page => ({ ...page, data: page.data.map(n => ({ ...n, read: true })) })) };
}

/**
 * fish `useMarkAllNotificationsAsRead`. fish shows an error toast on failure (UI concern) and does
 * not roll back — the `onSettled` invalidation refetches the truth either way.
 */
export function markAllNotificationsAsReadMutation(t: Transport, qc: QueryClient) {
  const key = notificationsKeys.allForLoggedUser;
  return mutationOptions({
    mutationFn: () => markAllNotificationsAsRead(t),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: key });
      const previousData = qc.getQueryData<NotificationPages>(key) ?? { pages: [] };
      qc.setQueryData(key, markAllReadInPages(previousData));
      return { previousData };
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: notificationsKeys.all });
    },
  });
}

/** fish `useToggleNotifications` — optimistic `notificationsEnabled` on the cached profile. */
export function toggleNotificationsMutation(t: Transport, qc: QueryClient) {
  return mutationOptions({
    mutationFn: (enabled: boolean) => enableDisableNotifications(t, enabled),
    onMutate: async (enabled: boolean) => {
      // Cancel outgoing refetches so they don't overwrite the optimistic update.
      await qc.cancelQueries({ queryKey: profileKeys.my });
      const previousProfile = qc.getQueryData<Profile>(profileKeys.my);
      qc.setQueryData<Profile>(profileKeys.my, old => (old ? { ...old, notificationsEnabled: enabled } : old));
      return { previousProfile };
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: profileKeys.my });
    },
  });
}

// ── feedback / angler reviews ───────────────────────────────────────────────────────────────────────

/** fish `useSendFeedback` */
export function sendFeedbackMutation(t: Transport) {
  return mutationOptions({
    mutationFn: (feedback: Feedback) => sendFeedback(t, feedback),
  });
}

/** fish `useCreateAnglerReview` */
export function createAnglerReviewMutation(t: Transport, qc: QueryClient) {
  return mutationOptions({
    mutationFn: (input: CreateAnglerReviewInput) => createAnglerReview(t, input),
    onSuccess: () => {
      // The angler's aggregate reputation changed; the input keys off the booking, not the angler's
      // id, so invalidate the family.
      qc.invalidateQueries({ queryKey: reputationKeys.all });
      // The operator inbox's "De evaluat" sub is keyed on review absence.
      qc.invalidateQueries({ queryKey: socialForeignKeys.bookingsAll });
      // Home counts the same queue in `pendingFeedback`; every per-lake dashboard window moves too.
      qc.invalidateQueries({ queryKey: socialForeignKeys.operatorStatsAll });
    },
  });
}

/** fish `useRegisterWidgetNotification`. fish's error toast («Nu am putut salva…») is the UI's. */
export function registerWidgetNotificationMutation(t: Transport, qc: QueryClient, feature: FeatureKey) {
  return mutationOptions({
    mutationFn: () => registerWidgetNotification(t, feature),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: widgetNotificationKeys.mine(feature) });
    },
  });
}
