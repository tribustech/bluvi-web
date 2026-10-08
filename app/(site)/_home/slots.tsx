import { cache, Suspense, type ReactNode } from 'react';
import { HydrationBoundary } from '@tanstack/react-query';
import { currentPollQuery } from '@/core/competitions';
import { suggestedAnglersHomeInfiniteQuery } from '@/core/social';
import { SuggestedHomeHydration } from '@/components/account/suggestions/SuggestedHomeHydration';
import { partideHrefs } from '@/lib/partide-pages';
import { ActivePartidaCard, ActivePartidaDock } from './ActivePartida';
import {
  getHomeSession,
  getHomeViewer,
  loadActivePartida,
  loadActiveWeighing,
  loadMyBookingsCount,
  loadMyLiveCompetition,
  loadOrganizerDashboard,
  loadOwnedLakes,
  prefetchTracked,
} from './data';
import { LateLiveCompetition, LateOrganizerBanner, LateOwnedLakesCard } from './LateBlocks';
import { MyLiveCompetition } from './MyLiveCompetition';
import { OrganizerBanner, OrganizerBannerSkeleton } from './OrganizerBanner';
import { OwnedLakesCard, OwnedLakesCardSkeleton } from './OwnedLakesCard';
import { PartidaCta } from './PartidaCta';
import { PollCard } from './PollCard';
import { SuggestedAnglers } from './SuggestedAnglers';
import { BookingsBadge } from './Widgets';

/*
 * The per-user slots of Acasă. Each awaits the session, so page.tsx renders them behind a
 * <Suspense>: the public page around them stays in the static shell and these stream in.
 */

/**
 * Holds its children until the session is read, so page.tsx can reveal a whole column at once:
 * every per-user block inside without a boundary of its own (role-gated cards, poll,
 * suggestions) is part of the same reveal, and nothing painted below them is pushed down later.
 */
export async function AfterSession({ children, unknown }: { children: ReactNode; unknown?: ReactNode }) {
  const session = await getHomeSession();
  // A session that could not be read: what the column shows instead (never its signed-out version).
  if (session === 'unknown' && unknown !== undefined) return unknown;
  return children;
}

/**
 * Renders its children only for a KNOWN signed-out visitor (fish `!isAuthenticated ? … : null`):
 * an unknown session (a cookie whose read failed) is never shown guest blocks.
 */
export async function SignedOutOnly({ children }: { children: ReactNode }) {
  return (await getHomeSession()) === null ? children : null;
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
      <OrganizerBannerLoaded layout={layout} />
    </Suspense>
  );
}

/**
 * The banner once its stats are read. A 4xx (no stats): nothing — owner rule 4 and fish
 * (OrganizerBanner.tsx:61 `if (!stats) return null`). No answer in time: the browser takes over
 * (LateOrganizerBanner: the skeleton stays until it answers).
 */
export async function OrganizerBannerLoaded({ layout }: { layout: 'mobile' | 'desktop' }) {
  const stats = await loadOrganizerDashboard();
  if (stats === 'failed') return <LateOrganizerBanner layout={layout} />;
  return stats ? <OrganizerBanner stats={stats} layout={layout} /> : null;
}

export async function OperatorSlot({ layout }: { layout: 'mobile' | 'desktop' }) {
  const viewer = await getHomeViewer();
  // Owner rule 4 (ROADMAP §4b): when we don't know, we don't show. A failed owned-lakes read hides
  // the card, as fish does (OwnedLakesCard.tsx:64 `if (!ownsLakes || !stats) return null`); the top
  // bar's Administrare keeps its own retry (SiteTopBar onAdminRetry).
  if (viewer?.ownedLakesFailed || !viewer?.ownedLakes.length) return null;
  return (
    <Suspense fallback={<OwnedLakesCardSkeleton layout={layout} />}>
      <OwnedLakesLoaded layout={layout} />
    </Suspense>
  );
}

/** «Balta mea» once its stats are read: as OrganizerBannerLoaded (4xx: nothing; no answer: the browser reads). */
export async function OwnedLakesLoaded({ layout }: { layout: 'mobile' | 'desktop' }) {
  const owned = await loadOwnedLakes();
  if (!owned) return null;
  if (owned.stats === 'failed') return <LateOwnedLakesCard lakes={owned.lakes} layout={layout} />;
  return owned.stats ? <OwnedLakesCard lakes={owned.lakes} stats={owned.stats} layout={layout} /> : null;
}

/**
 * fish: the «Ești la pescuit?» hero is hidden while a partidă is live (the dock owns that entry).
 * An unknown session renders nothing (no guest offer to someone who may be signed in).
 */
export async function PartidaCtaSlot({ layout, className }: { layout: 'mobile' | 'desktop'; className?: string }) {
  const session = await getHomeSession();
  if (session === 'unknown') return null;
  // Signed in, the hero is offered only on a CONFIRMED «no live partidă» (data.ts loadActivePartida,
  // home.acasa.s-partida-failed). A probe with no answer ('failed') shows nothing — owner rule 4
  // (ROADMAP §4b): someone fishing right now must not be offered a new partidă instead of their dock.
  const active = session ? await loadActivePartida() : null;
  if (active !== null) return null;
  return <PartidaCta layout={layout} className={className} />;
}

export async function BookingsBadgeSlot() {
  return <BookingsBadge count={await loadMyBookingsCount()} />;
}

// One prefetch per request (React cache), wherever the block is mounted. Bounded like every
// per-user read (data.ts READ_BUDGET_MS) — but a read with no answer in time does not hide the
// block: it mounts without data and its query finishes in the browser (`transient`).
const pollState = cache(() => prefetchTracked((t) => [currentPollQuery(t)]));
const suggestedState = cache(() => prefetchTracked((t) => [suggestedAnglersHomeInfiniteQuery(t, { isAuthenticated: true })]));

/**
 * fish PollCard — for everyone (fish shows it to guests; their taps go to sign-in). The poll is
 * personalised (`myVoteOptionId`), so it is read here, at request time with the session when there
 * is one (`auth: 'optional'`), never in the public cached scope. Where the CMS refuses guests (the
 * local DB has no Public grant) the prefetch is skipped and the card renders nothing.
 */
export async function PollSlot({ layout }: { layout: 'mobile' | 'desktop' }) {
  const session = await getHomeSession();
  // Unknown: neither the guest card (its taps go to sign-in) nor a vote that may not be the viewer's.
  if (session === 'unknown') return null;
  const signedIn = !!session;
  const { state, transient } = await pollState();
  // The CMS refused the read (e.g. no Public grant): don't mount the card, or its query refetches
  // the refused endpoint from the browser. No answer in time (or a 5xx): mount it, so the poll
  // still arrives — read in the browser, as fish's query (no deadline) fills it in.
  if (state.queries.length === 0 && !transient) return null;
  return (
    <HydrationBoundary state={state}>
      <PollCard layout={layout} signedIn={signedIn} />
    </HydrationBoundary>
  );
}

/**
 * fish `{isAuthenticated && <SuggestedAnglersRail />}`. As PollSlot: when the server read failed the
 * rail is not mounted — otherwise it would fetch from the browser after the reveal and insert a
 * ~300px rail above lakes, sponsors and news (a layout shift), from an endpoint just refused.
 */
export async function SuggestedAnglersSlot() {
  if (!(await getHomeViewer())) return null;
  const { state, transient } = await suggestedState();
  // Refused: nothing. No answer in time: the rail reads in the browser (fish SuggestedAnglersRail
  // fills in when its query answers) rather than vanishing for the life of the page.
  if (state.queries.length === 0 && !transient) return null;
  // Hydrated only into an empty browser cache: a Home visit never replaces the pool the tab already
  // holds (fish: one read per launch; account.suggested c13).
  return (
    <SuggestedHomeHydration state={state}>
      <SuggestedAnglers />
    </SuggestedHomeHydration>
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
  if (partida && partida !== 'failed') return <ActivePartidaDock session={partida} href={partideHrefs.partida(partida.documentId)} />;
  // From 1280 the right column carries it (RightColumnLiveSlot).
  // Owner rule 4 (ROADMAP §4b): only a CONFIRMED live competition shows the sheet (fish
  // DashboardSheet index -1 without one). A read with no answer ('failed') is read again in the
  // browser (LateLiveCompetition): nothing until it confirms, then the dock — sticky at the column's
  // end, so arriving late pushes nothing.
  if (live === 'failed') return <LateLiveCompetition layout="dock" />;
  if (!live) return null;
  const weighings = await loadActiveWeighing(live.competition.documentId);
  return <MyLiveCompetition live={live} weighings={weighings} layout="dock" />;
}

/** Desktop right column, top: the live partidă, else my live competition (same precedence). */
export async function RightColumnLiveSlot() {
  if (!(await getHomeViewer())) return null;
  const [partida, live] = await Promise.all([loadActivePartida(), loadMyLiveCompetition()]);
  if (partida && partida !== 'failed') return <ActivePartidaCard session={partida} href={partideHrefs.partida(partida.documentId)} />;
  // 'failed': RightColumnLateLiveSlot reads it in the browser, at the column's end.
  if (!live || live === 'failed') return null;
  return <MyLiveCompetition live={live} weighings={await loadActiveWeighing(live.competition.documentId)} layout="card" />;
}

/**
 * Desktop right column, LAST block: my live competition when the server read got no answer — the
 * browser reads it (LateLiveCompetition) and the card lands at the end of the column, under the
 * tools, so nothing already painted moves. Not when a live partidă took the top slot.
 */
export async function RightColumnLateLiveSlot() {
  if (!(await getHomeViewer())) return null;
  const [partida, live] = await Promise.all([loadActivePartida(), loadMyLiveCompetition()]);
  if (partida && partida !== 'failed') return null;
  return live === 'failed' ? <LateLiveCompetition layout="card" /> : null;
}
