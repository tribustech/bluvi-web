import type { QueryClient } from '@tanstack/react-query';
import { mutationOptions } from '../shared';
import type { Transport } from '../transport';
import {
  deleteSession,
  finishSession,
  followSession,
  getSession,
  joinSession,
  kickSessionMember,
  leaveSession,
  rotateSessionJoinCode,
  unfollowSession,
} from './api';
import {
  accessConfirmationFromError,
  bluCodeOf,
  decorateLeaveError,
  isAmbiguousLeaveError,
  isRevoked,
  type AccessConfirmation,
} from './domain/sessionAccess';
import { anglersKeys, profileKeys } from '../social/queries';
import { communityKeys, partideKeys } from './queries';

// ── session follows ─────────────────────────────────────────────────────────

export type FollowsRollbackContext = { previous?: string[] };

/** Optimistically flips one session in the follows list. */
export function applySessionFollow(old: string[] | undefined, documentId: string, follow: boolean): string[] {
  const ids = old ?? [];
  if (follow) return ids.includes(documentId) ? ids : [...ids, documentId];
  return ids.filter(id => id !== documentId);
}

/**
 * fish `community/hooks.ts#rollbackSessionFollows` — roll back to whatever `onMutate` snapshotted.
 *
 * MUST check membership (`'previous' in context`), not truthiness: when the follows query has never
 * succeeded the snapshot IS `undefined`, and that must be restored too. An `undefined` snapshot
 * needs `removeQueries`, NOT `setQueryData` — `setQueryData(key, undefined)` is a no-op by design
 * and would leave the phantom optimistic entry in place.
 */
export function rollbackSessionFollows(queryClient: QueryClient, context?: FollowsRollbackContext): void {
  if (!context || !('previous' in context)) return;
  if (context.previous === undefined) {
    queryClient.removeQueries({ queryKey: communityKeys.sessionFollows });
    return;
  }
  queryClient.setQueryData(communityKeys.sessionFollows, context.previous);
}

function sessionFollowMutation(t: Transport, qc: QueryClient, follow: boolean) {
  return mutationOptions({
    mutationFn: (documentId: string) => (follow ? followSession(t, documentId) : unfollowSession(t, documentId)),
    onMutate: async (documentId: string): Promise<FollowsRollbackContext> => {
      await qc.cancelQueries({ queryKey: communityKeys.sessionFollows });
      // Snapshot whatever is in cache RIGHT NOW — including `undefined`.
      const previous = qc.getQueryData<string[]>(communityKeys.sessionFollows);
      qc.setQueryData<string[]>(communityKeys.sessionFollows, old => applySessionFollow(old, documentId, follow));
      return { previous };
    },
    onError: (_err, _documentId, context) => {
      rollbackSessionFollows(qc, context);
      // fish: error toast «Nu am putut actualiza notificările. Încearcă din nou.»
    },
    // fish onSuccess: success toast; on follow also `ensureBellNotificationPermission()` and the
    // caller's `onFollowPermissionDenied` — UI concerns.
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: communityKeys.sessionFollows });
    },
  });
}

/** fish `useSessionFollows().follow` — optimistic, rolled back on error, re-fetched on settle. Auth-gated by the caller. */
export function followSessionMutation(t: Transport, qc: QueryClient) {
  return sessionFollowMutation(t, qc, true);
}

/** fish `useSessionFollows().unfollow` */
export function unfollowSessionMutation(t: Transport, qc: QueryClient) {
  return sessionFollowMutation(t, qc, false);
}

/**
 * fish `community/hooks.ts#refetchCommunitySessionOnFocus` — the focus leg of the live
 * session-detail freshness floor. No-op on an empty id.
 */
export function refetchCommunitySessionOnFocus(queryClient: QueryClient, documentId: string): void {
  if (!documentId) return;
  void queryClient.invalidateQueries({ queryKey: communityKeys.session(documentId) });
}

// ── community refresh after a write ─────────────────────────────────────────

/**
 * How long to wait before refetching the community surfaces after a write. The CMS purges the edge
 * through a coalescing, rate-limited queue; these `/feed/community/*` responses are `auth: false`,
 * so the edge entry is SHARED — a refetch that beats the purge re-caches the pre-write body for
 * every user for the rest of its TTL. fish `hooks.ts#COMMUNITY_PURGE_GRACE_MS`.
 */
export const COMMUNITY_PURGE_GRACE_MS = 2000;

type Schedule = (fn: () => void, ms: number) => unknown;

/**
 * fish `hooks.ts#useInvalidateCommunityAfterCatch` — after a catch write lands: my own list now
 * (per-user, never edge-cached), the whole `['community']` subtree after the purge grace.
 */
export function invalidateCommunityAfterCatch(qc: QueryClient, schedule: Schedule = setTimeout): void {
  void qc.invalidateQueries({ queryKey: partideKeys.mine });
  schedule(() => {
    void qc.invalidateQueries({ queryKey: communityKeys.all });
  }, COMMUNITY_PURGE_GRACE_MS);
}

// ── membership ──────────────────────────────────────────────────────────────

/** fish `hooks.ts#invalidateMembershipCaches` */
export async function invalidateMembershipCaches(
  qc: QueryClient,
  documentId: string,
  currentUserDocumentId: string | null,
  affectedUserDocumentId?: string
): Promise<void> {
  const userIds = [...new Set([currentUserDocumentId, affectedUserDocumentId].filter((id): id is string => !!id))];
  await Promise.all([
    qc.invalidateQueries({ queryKey: partideKeys.mine }),
    qc.invalidateQueries({ queryKey: partideKeys.detail(documentId), exact: true }),
    qc.invalidateQueries({ queryKey: profileKeys.statistics }),
    qc.invalidateQueries({ queryKey: communityKeys.all }),
    qc.invalidateQueries({ queryKey: communityKeys.sessionFollows }),
    ...userIds.flatMap(userDocumentId => [
      qc.invalidateQueries({ queryKey: anglersKeys.profile(userDocumentId) }),
      qc.invalidateQueries({ queryKey: anglersKeys.sessions(userDocumentId) }),
      qc.invalidateQueries({ queryKey: anglersKeys.catches(userDocumentId) }),
    ]),
  ]);
}

/**
 * The cache half of fish `sessionAccess.ts#cleanupSessionAccess` (revoked access / left / deleted
 * active partidă). Its device half — cancel rod alarms, clear the active-session pointer and live
 * state, navigate to the Partide tab — is the app's, and runs only after this resolves.
 */
export async function invalidateSessionAccessCaches(
  qc: QueryClient,
  documentId: string,
  currentUserDocumentId: string | null
): Promise<void> {
  const userInvalidations = currentUserDocumentId
    ? [
        qc.invalidateQueries({ queryKey: anglersKeys.profile(currentUserDocumentId) }),
        qc.invalidateQueries({ queryKey: anglersKeys.sessions(currentUserDocumentId) }),
        qc.invalidateQueries({ queryKey: anglersKeys.catches(currentUserDocumentId) }),
      ]
    : [qc.invalidateQueries({ queryKey: anglersKeys.all })];
  await Promise.all([
    qc.invalidateQueries({ queryKey: partideKeys.mine }),
    Promise.resolve().then(() => qc.removeQueries({ queryKey: partideKeys.detail(documentId), exact: true })),
    qc.invalidateQueries({ queryKey: profileKeys.statistics }),
    ...userInvalidations,
    qc.invalidateQueries({ queryKey: communityKeys.all }),
    qc.invalidateQueries({ queryKey: communityKeys.sessionFollows }),
  ]);
}

/**
 * fish `sessionAccess.ts#confirmSessionAccess` — probe private REST for THIS session; only the
 * CMS's own PARTIDA bluCodes count as revoked (see `accessConfirmationFromError`).
 */
export async function confirmSessionAccess(t: Transport, documentId: string): Promise<AccessConfirmation> {
  try {
    await getSession(t, documentId);
    return 'valid';
  } catch (error) {
    return accessConfirmationFromError(error);
  }
}

export type MembershipVars = {
  /** Strapi documentId of the session (fish resolved it from the active pointer or an override). */
  documentId: string;
  currentUserDocumentId: string | null;
};

/**
 * fish `useLeavePartida` — voluntarily leave. A lost leave response (network/5xx) or an explicit
 * NOT_MEMBER (the deterministic answer to retrying a completed leave) is reconciled only after
 * private REST confirms this member no longer has access; otherwise the error is rethrown
 * decorated `{ retryable: true, accessConfirmation }`. On success the caller runs the device
 * cleanup (pointer, alarms, navigation).
 */
export function leavePartidaMutation(t: Transport, qc: QueryClient) {
  return mutationOptions({
    mutationFn: async ({ documentId, currentUserDocumentId }: MembershipVars): Promise<{ outcome: 'left' }> => {
      const cleanup = () => invalidateSessionAccessCaches(qc, documentId, currentUserDocumentId);
      try {
        await leaveSession(t, documentId);
        await cleanup();
        return { outcome: 'left' };
      } catch (error) {
        if (!isAmbiguousLeaveError(error) && bluCodeOf(error) !== 'PARTIDA:NOT_MEMBER') throw error;
        const confirmation = await confirmSessionAccess(t, documentId);
        if (isRevoked(confirmation)) {
          await cleanup();
          return { outcome: 'left' };
        }
        throw decorateLeaveError(error, confirmation);
      }
    },
  });
}

/**
 * fish `useDeletePartida` — owner-only permanent delete. When the deleted partidă is the one live
 * on this device (`wasActive`) it takes the full revoked-access cleanup; a history delete only
 * invalidates membership caches and drops the detail. fish then navigated to the Partide tab.
 */
export function deletePartidaMutation(t: Transport, qc: QueryClient) {
  return mutationOptions({
    mutationFn: async ({ documentId, currentUserDocumentId, wasActive }: MembershipVars & { wasActive: boolean }) => {
      await deleteSession(t, documentId);
      if (wasActive) {
        await invalidateSessionAccessCaches(qc, documentId, currentUserDocumentId);
        return;
      }
      await invalidateMembershipCaches(qc, documentId, currentUserDocumentId);
      qc.removeQueries({ queryKey: partideKeys.detail(documentId), exact: true });
    },
  });
}

/** fish `useKickPartidaMember` — owner-only; never runs local cleanup (the owner stays a member). */
export function kickPartidaMemberMutation(t: Transport, qc: QueryClient) {
  return mutationOptions({
    mutationFn: async ({ documentId, currentUserDocumentId, targetDocumentId }: MembershipVars & { targetDocumentId: string }) => {
      const result = await kickSessionMember(t, documentId, targetDocumentId);
      await invalidateMembershipCaches(qc, documentId, currentUserDocumentId, targetDocumentId);
      return result;
    },
  });
}

/** fish `useRotatePartidaJoinCode` — owner-only; the projection stays the sole writer of the live code. */
export function rotatePartidaJoinCodeMutation(t: Transport, qc: QueryClient) {
  return mutationOptions({
    mutationFn: async ({ documentId, currentUserDocumentId }: MembershipVars) => {
      const result = await rotateSessionJoinCode(t, documentId);
      await invalidateMembershipCaches(qc, documentId, currentUserDocumentId);
      return result;
    },
  });
}

/**
 * fish `useJoinPartida` — uppercases + trims the code; a `PARTIDA:*` rejection propagates for the
 * UI (`domain/partidaJoinError.ts`). fish then persisted the active-session pointer — device state.
 */
export function joinPartidaMutation(t: Transport) {
  return mutationOptions({
    mutationFn: (code: string) => joinSession(t, code.trim().toUpperCase()),
  });
}

/**
 * The server half of fish `useEndPartida`: archive FIRST, and only once the server confirmed it
 * refresh «Ale mele» now and the community after the purge grace (a finished partidă must leave
 * ÎN DIRECT). fish's local half (force-stop rods, recap from local events, drop the pointer only
 * on success, error toast «Nu am putut încheia partida. Mai încearcă o dată.») stays with the app.
 */
export function finishPartidaMutation(t: Transport, qc: QueryClient, schedule: Schedule = setTimeout) {
  return mutationOptions({
    mutationFn: (documentId: string) => finishSession(t, documentId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: partideKeys.mine });
      schedule(() => {
        void qc.invalidateQueries({ queryKey: communityKeys.all });
      }, COMMUNITY_PURGE_GRACE_MS);
    },
  });
}
