'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { liveCompetitionQuery } from '@/core/competitions';
import { ownedLakesStatsQuery } from '@/core/lakes';
import { activeWeighingQuery, organizerDashboardQuery } from '@/core/organizer';
import { createBrowserTransport } from '@/lib/client/transport';
import { MyLiveCompetition } from './MyLiveCompetition';
import { OrganizerBanner, OrganizerBannerSkeleton } from './OrganizerBanner';
import { OwnedLakesCard, OwnedLakesCardSkeleton } from './OwnedLakesCard';

/*
 * The browser takeover of the per-user blocks whose server read got NO answer within its budget
 * (data.ts attempt() → 'failed': a timeout or a 5xx, never a 4xx). As PollSlot / SuggestedAnglersSlot
 * (prefetchTracked `transient`): the block mounts without data and its query (fish's own hook, with
 * the app QueryClient's retries) runs in the browser, instead of the block vanishing for the life of
 * the page. Owner rule 4 (ROADMAP §4b): nothing readable shows until the read CONFIRMS the block —
 * never «we could not check» copy; a read that fails again leaves nothing.
 */

/**
 * «Concursul meu» (fish DashboardSheet). Renders nothing until the CMS confirms a live competition,
 * then the phone dock / the right-column card. Mounted where arriving late pushes nothing: the dock
 * is sticky at the end of the stacked column, the card is the right column's last block.
 */
export function LateLiveCompetition({ layout }: { layout: 'dock' | 'card' }) {
  const t = useMemo(() => createBrowserTransport(), []);
  const { data: live } = useQuery(liveCompetitionQuery(t, { isAuthenticated: true }));
  const competitionId = live?.competition.documentId ?? '';
  // The «Cântar în curs» line joins when its read answers (the dock grows upwards from the edge).
  const { data: weighings } = useQuery(activeWeighingQuery(t, competitionId, { isAuthenticated: !!live }));
  const filtered = useMemo(
    // fish `useLiveCompetitionWithNewExtraScales` (as data.ts loadMyLiveCompetition).
    () => (live ? { ...live, 'extra-scales': live['extra-scales'].filter((s) => s.extraStatus === 'new') } : null),
    [live]
  );
  if (!filtered) return null;
  return <MyLiveCompetition live={filtered} weighings={weighings ?? []} layout={layout} />;
}

/**
 * The organiser banner. The session already named the viewer an organiser, so the banner's
 * same-height skeleton holds its place while the browser reads (nothing below moves when it lands);
 * no answer again: nothing (the top bar still opens the panel).
 */
export function LateOrganizerBanner({ layout }: { layout: 'mobile' | 'desktop' }) {
  const t = useMemo(() => createBrowserTransport(), []);
  const { data, isPending } = useQuery(organizerDashboardQuery(t, { isOrganizer: true }));
  if (isPending) return <OrganizerBannerSkeleton />;
  return data ? <OrganizerBanner stats={data} layout={layout} /> : null;
}

/** «Balta mea» — as the organiser banner: its skeleton while the browser reads, then the card or nothing. */
export function LateOwnedLakesCard({ lakes, layout }: { lakes: { documentId: string; name: string }[]; layout: 'mobile' | 'desktop' }) {
  const t = useMemo(() => createBrowserTransport(), []);
  const { data, isPending } = useQuery(ownedLakesStatsQuery(t));
  if (isPending) return <OwnedLakesCardSkeleton layout={layout} />;
  return data ? <OwnedLakesCard lakes={lakes} stats={data} layout={layout} /> : null;
}
