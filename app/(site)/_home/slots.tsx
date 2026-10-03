import { cache, type ReactNode } from 'react';
import { HydrationBoundary } from '@tanstack/react-query';
import { currentPollQuery } from '@/core/competitions';
import { suggestedAnglersHomeInfiniteQuery } from '@/core/social';
import { prefetchState } from '@/lib/client/hydration';
import { createServerTransport } from '@/lib/server/transport';
import { ActivePartidaCard, ActivePartidaDock } from './ActivePartida';
import { getHomeViewer, loadActivePartida, loadActiveWeighing, loadMyBookingsCount, loadMyLiveCompetition, loadRaffle } from './data';
import { MyLiveCompetition } from './MyLiveCompetition';
import { PartidaCta } from './PartidaCta';
import { PollCard } from './PollCard';
import { RaffleCard } from './RaffleCard';
import { SuggestedAnglers } from './SuggestedAnglers';
import { BookingsBadge } from './Widgets';

/*
 * The per-user slots of Acasă. Each awaits the session, so page.tsx renders each inside its own
 * <Suspense>: the public page around them stays in the static shell and these stream in.
 */

/** Renders its children only for a signed-out visitor (fish `!isAuthenticated ? … : null`). */
export async function SignedOutOnly({ children }: { children: ReactNode }) {
  return (await getHomeViewer()) ? null : children;
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
const pollState = cache(() => prefetchState([currentPollQuery(createServerTransport())], []));
const suggestedState = cache(() =>
  prefetchState([suggestedAnglersHomeInfiniteQuery(createServerTransport(), { isAuthenticated: true })], [])
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

/** fish `{isAuthenticated && <SuggestedAnglersRail />}` */
export async function SuggestedAnglersSlot({ layout }: { layout: 'rail' | 'grid' }) {
  if (!(await getHomeViewer())) return null;
  return (
    <HydrationBoundary state={await suggestedState()}>
      <SuggestedAnglers layout={layout} />
    </HydrationBoundary>
  );
}

/**
 * fish: the live-partidă dock, else the «concursul meu» sheet — pinned above the tab bar. The
 * spacer keeps the page's last rows above it (fish getPaddingBottom: PARTIDA_DOCK_CLEARANCE, or
 * 79/161/218/275 by the number of extra-scale rows).
 */
export async function MobileDockSlot() {
  if (!(await getHomeViewer())) return null;
  const partida = await loadActivePartida();
  if (partida) {
    return (
      <>
        <div aria-hidden className="h-[92px]" />
        <ActivePartidaDock session={partida} />
      </>
    );
  }
  const live = await loadMyLiveCompetition();
  if (!live) return null;
  const weighings = await loadActiveWeighing(live.competition.documentId);
  const rows = live['extra-scales'].length;
  return (
    <>
      <div aria-hidden className={rows === 0 ? 'h-[79px]' : rows === 1 ? 'h-[161px]' : rows === 2 ? 'h-[218px]' : 'h-[275px]'} />
      {/* The weighing line adds one row to the dock. */}
      {weighings.length > 0 ? <div aria-hidden className="h-8" /> : null}
      <MyLiveCompetition live={live} weighings={weighings} layout="dock" />
    </>
  );
}

/** Desktop right column, top: the live partidă, else my live competition (same precedence). */
export async function RightColumnLiveSlot() {
  if (!(await getHomeViewer())) return null;
  const partida = await loadActivePartida();
  if (partida) return <ActivePartidaCard session={partida} />;
  const live = await loadMyLiveCompetition();
  if (!live) return null;
  return <MyLiveCompetition live={live} weighings={await loadActiveWeighing(live.competition.documentId)} layout="card" />;
}
