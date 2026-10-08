import type { QueryClient } from '@tanstack/react-query';
import { mutationOptions } from '../shared';
import type { Transport } from '../transport';
import { followSession, getSession, unfollowSession } from './api';
import { accessConfirmationFromError, type AccessConfirmation } from './domain/sessionAccess';
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

// ── membership ──────────────────────────────────────────────────────────────

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
