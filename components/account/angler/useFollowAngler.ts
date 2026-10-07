'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { usePathname, useRouter } from 'next/navigation';
import { useMemo } from 'react';
import { useViewerState } from '@/app/(site)/_shell/viewer-context';
import { userOf } from '@/app/(site)/_shell/viewer-state';
import { anglersKeys, followAnglerMutation } from '@/core/social';
import { createBrowserTransport } from '@/lib/client/transport';
import { routes } from '@/lib/routes';

/**
 * Follow / unfollow an angler — fish services/mutations/useFollowAngler.ts behind fish
 * components/profile/FollowButton.tsx (parity account.angler-profile c10–c13, account.b.guest-follow).
 * Shared API (later batches — connections, suggested anglers — import it; keep it stable):
 *
 *   const { toggle, isPending } = useFollowAngler(documentId, { signedIn });
 *   <FollowButton following={isFollowedByMe} pending={isPending} onToggle={toggle} … />
 *
 *  - `toggle(next)`: `next` true follows, false unfollows. The cache work is core's
 *    followAnglerMutation: optimistic isFollowedByMe + followers ±1 (never below 0) on the profile,
 *    the row flipped in every loaded connections / search / suggestion list, all rolled back on an
 *    error; then the profile, its followers, the viewer's own profile + following refetch (the
 *    viewer's id from the shell session, never only from a cached GET /user/profile).
 *  - Guest (`signedIn: false`, account.b.guest-follow): the button is shown, but a press REPLACES
 *    this page with sign-in, this page as the way back (routes.signIn(current path + query)) —
 *    after signing in the history holds the page once, so back leaves it — instead of following — and `onPressed` (fish's analytics hook) never fires for that press.
 *  - `onPressed`: called right after a real follow / unfollow is triggered (fish FollowButton
 *    `onPressed`), never on the sign-in redirect.
 * fish shows no toast on a failed follow (the rollback is the feedback); neither does the web.
 */
export function useFollowAngler(documentId: string, { signedIn, onPressed }: { signedIn: boolean; onPressed?: () => void }) {
  const qc = useQueryClient();
  const t = useMemo(() => createBrowserTransport(), []);
  // The viewer's own id comes from the shell session: core's onSettled only knows it when
  // GET /user/profile happens to be cached (fish's tabs layout always loads it; no web page under
  // /pescari does), so the own header's «N urmărește» and own following list went stale (c13).
  const viewerId = userOf(useViewerState())?.documentId ?? null;
  const base = followAnglerMutation(t, qc);
  const mutation = useMutation({
    ...base,
    onSettled: (...args: Parameters<NonNullable<typeof base.onSettled>>) => {
      void base.onSettled?.(...args);
      if (viewerId) {
        qc.invalidateQueries({ queryKey: anglersKeys.profile(viewerId), exact: true });
        qc.invalidateQueries({ queryKey: anglersKeys.following(viewerId) });
      }
    },
  });
  const router = useRouter();
  const pathname = usePathname() ?? routes.angler(documentId);

  const toggle = (next: boolean) => {
    if (!signedIn) {
      const search = typeof window === 'undefined' ? '' : window.location.search;
      // replace, not push: sign-in returns with router.replace(next), so a push left the profile
      // twice in history and «Înapoi» after signing in landed on the same profile (c35).
      router.replace(routes.signIn(`${pathname}${search}`));
      return;
    }
    mutation.mutate({ documentId, follow: next });
    onPressed?.();
  };

  return { toggle, isPending: mutation.isPending };
}
