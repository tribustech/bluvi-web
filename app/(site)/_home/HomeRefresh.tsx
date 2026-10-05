'use client';

import { useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { notificationsKeys } from '@/core/social';
import { DashboardRefresh, type RefreshResult } from '@/components/templates/T5';
import { createBrowserTransport } from '@/lib/client/transport';
import { useSiteToast } from '../_shell/Toast';
import { homeLakesQuery, homeNewsQuery, homeSponsorsQuery, liveCardsQuery, upcomingCardsQuery } from './queries';

/**
 * fish (tabs)/index.tsx `handleRefetchAll` (pull-to-refresh), for the web: the browser queries Acasă
 * shows are refetched — exactly those (both competition rails, the home lakes, news and sponsors),
 * never every cached lakes / news entry another screen left behind (lake details, map clusters,
 * the search palette…) — the notifications are invalidated (active only), and the server blocks are
 * re-rendered (`router.refresh`: profile, organiser stats, the operator card and its stats, the
 * bookings count, the raffle). The suggested-anglers rail is left alone on purpose (fish: a refresh
 * must never reshuffle it — SuggestedAnglers pins its order).
 *
 * A failed refetch keeps its data on screen, so it is SAID, visibly: a toast (the spinner stopping
 * over unchanged data would read as success), and 'reported' so the control does not announce it a
 * second time.
 */
export function useHomeRefresh(): () => Promise<RefreshResult> {
  const refetch = useHomeRefetch();
  const toast = useSiteToast();
  return useCallback(async () => {
    if (await refetch()) return true;
    toast('Nu am putut actualiza. Încearcă din nou.', 'danger');
    return 'reported';
  }, [refetch, toast]);
}

/**
 * The refetch alone, without feedback (the full-page error card is its own feedback). The server
 * blocks are re-rendered (`router.refresh`) only when the public reads came back: when they failed
 * the CMS is down, and a server re-render could only lose what is on screen (the poll and raffle
 * would vanish, the organiser and operator stats turn into errors) — the screen keeps its data.
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

/** The header control (from 768). */
export function HomeRefresh() {
  const refresh = useHomeRefresh();
  return <DashboardRefresh onRefresh={refresh} />;
}
