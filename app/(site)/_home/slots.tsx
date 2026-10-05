import { cache, Suspense, type ReactNode } from 'react';
import { HydrationBoundary } from '@tanstack/react-query';
import { currentPollQuery } from '@/core/competitions';
import { suggestedAnglersHomeInfiniteQuery } from '@/core/social';
import { prefetchState } from '@/lib/client/hydration';
import { ActivePartidaCard, ActivePartidaDock } from './ActivePartida';
import { boundedTransport, getHomeViewer, loadActivePartida, loadActiveWeighing, loadMyBookingsCount, loadMyLiveCompetition, loadRaffle } from './data';
import { MyLiveCompetition } from './MyLiveCompetition';
import { OrganizerBanner, OrganizerBannerSkeleton } from './OrganizerBanner';
import { OwnedLakesCard, OwnedLakesCardSkeleton } from './OwnedLakesCard';
import { PartidaCta } from './PartidaCta';
import { PollCard } from './PollCard';
import { RaffleCard } from './RaffleCard';
import { SuggestedAnglers } from './SuggestedAnglers';
import { BookingsBadge } from './Widgets';

/*
 * The per-user slots of Acasă. Each awaits the session, so page.tsx renders them behind a
 * <Suspense>: the public page around them stays in the static shell and these stream in.
 */

/**
 * Holds its children until the session is read, so page.tsx can reveal a whole column at once:
 * every per-user block inside without a boundary of its own (role-gated cards, poll, raffle,
 * suggestions) is part of the same reveal, and nothing painted below them is pushed down later.
 */
export async function AfterSession({ children }: { children: ReactNode }) {
  await getHomeViewer();
  return children;
}

/** Renders its children only for a signed-out visitor (fish `!isAuthenticated ? … : null`). */
export async function SignedOutOnly({ children }: { children: ReactNode }) {
  return (await getHomeViewer()) ? null : children;
}

/**
 * Role-gated blocks: the session says who is an organiser or a lake operator as soon as it is
 * read, long before their stats arrive — so those viewers get the block's skeleton in its place
 * within the session's reveal (AfterSession), the card replaces it at the same height, and
 * everyone else gets nothing.
 */
export async function OrganizerSlot({ layout }: { layout: 'mobile' | 'desktop' }) {
  if (!(await getHomeViewer())?.isOrganizer) return null;
  return (
    <Suspense fallback={<OrganizerBannerSkeleton />}>
      <OrganizerBanner layout={layout} />
    </Suspense>
  );
}

export async function OperatorSlot({ layout }: { layout: 'mobile' | 'desktop' }) {
  if (!(await getHomeViewer())?.ownedLakes.length) return null;
  return (
    <Suspense fallback={<OwnedLakesCardSkeleton layout={layout} />}>
      <OwnedLakesCard layout={layout} />
    </Suspense>
  );
}

/** fish: the «Ești la pescuit?» hero is hidden while a partidă is live (the dock owns that entry). */
export async function PartidaCtaSlot({ layout, className }: { layout: 'mobile' | 'desktop'; className?: string }) {
  const viewer = await getHomeViewer();
  if (viewer && (await loadActivePartida())) return null;
  return <PartidaCta signedIn={!!viewer} layout={layout} className={className} />;
}

export async function BookingsBadgeSlot() {
  return <BookingsBadge count={await loadMyBookingsCount()} />;
}

// One prefetch per request even though the mobile and desktop compositions both mount the block.
// Bounded like every per-user read (data.ts): a slow CMS hides the block instead of holding it.
const pollState = cache(() => prefetchState([currentPollQuery(boundedTransport())], []));
const suggestedState = cache(() =>
  prefetchState([suggestedAnglersHomeInfiniteQuery(boundedTransport(), { isAuthenticated: true })], [])
);

/**
 * fish PollCard — for everyone (fish shows it to guests; their taps go to sign-in). The poll is
 * personalised (`myVoteOptionId`), so it is read here, at request time with the session when there
 * is one (`auth: 'optional'`), never in the public cached scope. Where the CMS refuses guests (the
 * local DB has no Public grant) the prefetch is skipped and the card renders nothing.
 */
export async function PollSlot({ layout }: { layout: 'mobile' | 'desktop' }) {
  const signedIn = !!(await getHomeViewer());
  const state = await pollState();
  // The server read failed (e.g. no Public grant): don't mount the card, or its query refetches
  // the refused endpoint from the browser.
  if (state.queries.length === 0) return null;
  return (
    <HydrationBoundary state={state}>
      <PollCard layout={layout} signedIn={signedIn} />
    </HydrationBoundary>
  );
}

/** fish RaffleDashboardCard: between the poll and the suggested anglers, only while a session runs. */
export async function RaffleSlot() {
  const raffle = await loadRaffle();
  if (!raffle) return null;
  return <RaffleCard raffle={raffle.state} signedIn={raffle.signedIn} />;
}

/**
 * fish `{isAuthenticated && <SuggestedAnglersRail />}`. As PollSlot: when the server read failed the
 * rail is not mounted — otherwise it would fetch from the browser after the reveal and insert a
 * ~300px rail above lakes, sponsors and news (a layout shift), from an endpoint just refused.
 */
export async function SuggestedAnglersSlot() {
  if (!(await getHomeViewer())) return null;
  const state = await suggestedState();
  if (state.queries.length === 0) return null;
  return (
    <HydrationBoundary state={state}>
      <SuggestedAnglers />
    </HydrationBoundary>
  );
}

/**
 * fish: the live-partidă dock, else the «concursul meu» sheet — pinned to the bottom edge. The dock
 * is the stacked column's last block and sticks to the bottom while the page scrolls: it takes its
 * own real height at the end of the column, so the page's last rows always clear it (fish
 * getPaddingBottom) without a spacer guessing that height.
 */
export async function MobileDockSlot() {
  if (!(await getHomeViewer())) return null;
  // Both asked at once (the partidă wins when both answer): two round trips, not four in a row.
  const [partida, live] = await Promise.all([loadActivePartida(), loadMyLiveCompetition()]);
  if (partida) return <ActivePartidaDock session={partida} />;
  if (!live) return null;
  const weighings = await loadActiveWeighing(live.competition.documentId);
  return <MyLiveCompetition live={live} weighings={weighings} layout="dock" />;
}

/** Desktop right column, top: the live partidă, else my live competition (same precedence). */
export async function RightColumnLiveSlot() {
  if (!(await getHomeViewer())) return null;
  const [partida, live] = await Promise.all([loadActivePartida(), loadMyLiveCompetition()]);
  if (partida) return <ActivePartidaCard session={partida} />;
  if (!live) return null;
  return <MyLiveCompetition live={live} weighings={await loadActiveWeighing(live.competition.documentId)} layout="card" />;
}
