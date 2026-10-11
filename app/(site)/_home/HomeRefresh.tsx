'use client';

import { useCallback, useEffect, useMemo, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { notificationsKeys } from '@/core/social';
import { Button } from '@/components/ui/Button';
import { createBrowserTransport } from '@/lib/client/transport';
import { homeLakesQuery, homeNewsQuery, homeSponsorsQuery, liveCardsQuery, upcomingCardsQuery } from './queries';

/**
 * fish (tabs)/index.tsx `handleRefetchAll`, for the web: the browser queries Acasă shows are
 * refetched — exactly those (both competition rails, the home lakes, news and sponsors), never every
 * cached lakes / news entry another screen left behind — the notifications are invalidated (active
 * only), and the server blocks are re-rendered (`router.refresh`: session, profile, organiser
 * stats, the operator card, the bookings count). The suggested-anglers rail is left alone on
 * purpose (fish: a refresh must never reshuffle it — SuggestedAnglers pins its order). No manual
 * refresh control calls it (removed by the owner 2026-10-11): HomeFocusRefresh, the error card's
 * retry and HomeRetry (the session read failed) do. Without feedback of its own. The server
 * blocks are re-rendered (`router.refresh`) only when the public reads came back: when they failed
 * the CMS is down, and a server re-render could only lose what is on screen (the poll would
 * vanish, the organiser and operator stats turn into errors) — the screen keeps its data.
 */
export function useHomeRefetch(): () => Promise<boolean> {
  const qc = useQueryClient();
  const router = useRouter();
  const t = useMemo(() => createBrowserTransport(), []);
  return useCallback(async () => {
    const ok = await refetchHome(qc, t);
    if (ok) router.refresh();
    return ok;
  }, [qc, router, t]);
}

async function refetchHome(qc: QueryClient, t: ReturnType<typeof createBrowserTransport>): Promise<boolean> {
  const keys = [liveCardsQuery(t), upcomingCardsQuery(t), homeLakesQuery(t), homeNewsQuery(t), homeSponsorsQuery(t)].map((q) => q.queryKey);
  const results = await Promise.allSettled([
    ...keys.map((queryKey) => qc.refetchQueries({ queryKey, exact: true })),
    qc.invalidateQueries({ queryKey: notificationsKeys.all }),
  ]);
  // Judged on Acasă's own reads only: an unrelated cached query in error says nothing about them.
  const failed = keys.some((queryKey) => qc.getQueryState(queryKey)?.status === 'error');
  return !failed && results.every((r) => r.status === 'fulfilled');
}

/**
 * The retry when the session could not be read (ProfileCard's NeutralProfileCard, HomeHeader): the
 * same compact secondary «Încearcă din nou» as the other error retries, busy while it re-reads. A
 * re-render re-reads the session; it is the only retry Acasă draws over a working page.
 */
export function HomeRetry() {
  const refetch = useHomeRefetch();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="secondary"
      size="compact"
      aria-busy={pending || undefined}
      aria-disabled={pending || undefined}
      onClick={() => {
        if (!pending) start(async () => void (await refetch()));
      }}
    >
      {pending ? 'Se încarcă…' : 'Încearcă din nou'}
    </Button>
  );
}

/** A tab that comes back after this long re-reads Acasă (the competition page's rule). */
const REFRESH_ON_RETURN_MS = 30_000;

/**
 * fish (tabs)/index.tsx useFocusEffect: when Acasă regains focus it invalidates the live rail and
 * the «concursul meu» extra scales. On the web: when the tab becomes visible again (or the window
 * comes back to the front) after REFRESH_ON_RETURN_MS, the same refetch as the error retries —
 * the rails and the server blocks (my live competition, its weighing line, the partidă dock) —
 * quietly (no toast: nobody asked). A client navigation back to / mounts this anew, and the router
 * re-renders the server blocks on its own; the throttle starts at mount. Renders nothing; mounted
 * once by page.tsx.
 */
export function HomeFocusRefresh() {
  const refetch = useHomeRefetch();
  useEffect(() => {
    let last = Date.now();
    const onReturn = () => {
      if (document.visibilityState !== 'visible' || Date.now() - last < REFRESH_ON_RETURN_MS) return;
      last = Date.now();
      void refetch();
    };
    document.addEventListener('visibilitychange', onReturn);
    window.addEventListener('focus', onReturn);
    return () => {
      document.removeEventListener('visibilitychange', onReturn);
      window.removeEventListener('focus', onReturn);
    };
  }, [refetch]);
  return null;
}
