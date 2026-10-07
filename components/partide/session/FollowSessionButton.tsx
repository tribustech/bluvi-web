'use client';

import { useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BellAlertIcon, BellIcon } from '@heroicons/react/24/outline';
import { useSiteToast } from '@/app/(site)/_shell/Toast';
import { useViewerState } from '@/app/(site)/_shell/viewer-context';
import { isUnknownViewer, userOf } from '@/app/(site)/_shell/viewer-state';
import { cn } from '@/components/ui/cn';
import { followSessionMutation, sessionFollowsQuery, unfollowSessionMutation } from '@/core/partide';
import { profileQuery, toggleNotificationsMutation } from '@/core/social';
import { createBrowserTransport } from '@/lib/client/transport';
import { routes } from '@/lib/routes';
import { BellIntroDialog, type BellIntroVariant } from './BellIntroDialog';

/*
 * The bell for one partidă — fish FollowSessionButton (parity partide.spectator.c4, c5): «notify me
 * on every catch in this partidă», distinct from following a person (a bell, never a user icon).
 *  - The follow state is core sessionFollowsQuery (GET /feed/session-follows/mine, signed in only);
 *    follow / unfollow are core's optimistic mutations (rolled back on an error, refetched after).
 *    Success toasts «Vei primi notificări pentru capturile din această partidă.» / «Notificări
 *    dezactivate.»; a failure «Nu am putut actualiza notificările. Încearcă din nou.» (fish).
 *  - Signed out: shown; a press REPLACES this page with sign-in, the page as the way back (the
 *    web's guest follow, as useFollowAngler). Session unknown: not shown (owner rule 4).
 *  - Two gates before a follow, in fish's order (an unfollow never gates): the profile's Bluvi
 *    notifications off → the `reenable` dialog («Activează și urmărește» turns them on — core
 *    toggleNotificationsMutation, the /setari/notificari switch — and follows); else the first-ever
 *    follow (a per-browser flag, fish's AsyncStorage PARTIDE_BELL_INTRO_SEEN_V1) → the `intro`
 *    dialog. Closing either marks the intro seen; the two never chain.
 *  - fish's third gate (the OS denied push → NotificationsOffSheet) has no web equivalent: the web
 *    has no push yet (ROADMAP §3), so it is left out.
 * `look`: `photo` — fish's `hero` glass pill over the phone hero; `header` — the button in the
 * title row from 768. Must render under the shell's Suspense (it reads the session).
 */

export const BELL_INTRO_SEEN_KEY = 'bluvi.partide.bellIntroSeen.v1';

function introSeen(): boolean {
  try {
    return window.localStorage.getItem(BELL_INTRO_SEEN_KEY) === 'true';
  } catch {
    return false;
  }
}

function markIntroSeen() {
  try {
    window.localStorage.setItem(BELL_INTRO_SEEN_KEY, 'true');
  } catch {
    // Storage blocked: the intro shows again next time — harmless.
  }
}

const FAILED = 'Nu am putut actualiza notificările. Încearcă din nou.';

export function FollowSessionButton({ sessionDocumentId, look, className }: { sessionDocumentId: string; look: 'photo' | 'header'; className?: string }) {
  const viewer = useViewerState();
  const signedIn = !!userOf(viewer);
  const t = useMemo(() => createBrowserTransport(), []);
  const qc = useQueryClient();
  const toast = useSiteToast();
  const router = useRouter();
  const pathname = usePathname() ?? routes.partida(sessionDocumentId);
  const [dialog, setDialog] = useState<BellIntroVariant | null>(null);

  const follows = useQuery(sessionFollowsQuery(t, signedIn));
  const profile = useQuery(profileQuery(t, { isAuthenticated: signedIn }));
  const following = signedIn && (follows.data ?? []).includes(sessionDocumentId);

  const followBase = followSessionMutation(t, qc);
  const follow = useMutation({
    ...followBase,
    onSuccess: () => toast('Vei primi notificări pentru capturile din această partidă.', 'success'),
    onError: (...args: Parameters<NonNullable<typeof followBase.onError>>) => {
      followBase.onError?.(...args);
      toast(FAILED, 'danger');
    },
  });
  const unfollowBase = unfollowSessionMutation(t, qc);
  const unfollow = useMutation({
    ...unfollowBase,
    onSuccess: () => toast('Notificări dezactivate.', 'success'),
    onError: (...args: Parameters<NonNullable<typeof unfollowBase.onError>>) => {
      unfollowBase.onError?.(...args);
      toast(FAILED, 'danger');
    },
  });
  const notifications = useMutation(toggleNotificationsMutation(t, qc));
  const pending = follow.isPending || unfollow.isPending;

  // Session unknown (the read failed or timed out): neither «Urmărește» nor a sign-in prompt.
  if (isUnknownViewer(viewer)) return null;

  const press = () => {
    if (pending) return;
    if (!signedIn) {
      const search = window.location.search;
      router.replace(routes.signIn(`${pathname}${search}`));
      return;
    }
    if (following) {
      unfollow.mutate(sessionDocumentId);
      return;
    }
    if (profile.data?.notificationsEnabled === false) {
      setDialog('reenable');
      return;
    }
    if (!introSeen()) {
      setDialog('intro');
      return;
    }
    follow.mutate(sessionDocumentId);
  };

  const close = () => {
    markIntroSeen();
    setDialog(null);
  };
  const confirm = () => {
    if (dialog === 'reenable') notifications.mutate(true);
    close();
    follow.mutate(sessionDocumentId);
  };

  const label = following ? 'Notificări active' : 'Urmărește';
  const Icon = following ? BellAlertIcon : BellIcon;
  return (
    <>
      <button
        type="button"
        data-testid="follow-session-button"
        data-following={following}
        aria-label={following ? 'Notificări active pentru această partidă — apasă ca să le oprești' : 'Urmărește partida — notificări pentru fiecare captură'}
        aria-disabled={pending || undefined}
        aria-busy={pending || undefined}
        onClick={press}
        className={cn(
          'inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap transition-[background-color,filter,opacity] duration-(--duration-fast) ease-fast active:opacity-80 aria-disabled:cursor-default aria-disabled:opacity-60 [&>svg]:shrink-0',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
          look === 'photo'
            ? cn('h-10 rounded-full px-3.5 t-label [&>svg]:size-4.5', following ? 'bg-surface text-accent-ink' : 'bg-photo-scrim text-on-photo-scrim hover:brightness-125')
            : cn(
                'h-12 rounded-control px-5 t-body-strong xl:h-10 [&>svg]:size-5',
                following ? 'bg-accent-tint-2 text-accent-ink hover:brightness-95' : 'bg-accent text-on-accent shadow-button hover:brightness-95',
              ),
          className,
        )}
      >
        <Icon aria-hidden />
        {label}
      </button>
      <BellIntroDialog variant={dialog} onConfirm={confirm} onClose={close} />
    </>
  );
}
