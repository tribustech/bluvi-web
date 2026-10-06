import { cache, Suspense, type ReactNode } from 'react';
import { HydrationBoundary } from '@tanstack/react-query';
import { DashboardSection } from '@/components/templates/T5';
import { currentPollQuery } from '@/core/competitions';
import { suggestedAnglersHomeInfiniteQuery } from '@/core/social';
import { ActivePartidaCard, ActivePartidaDock } from './ActivePartida';
import { getHomeSession, getHomeViewer, loadActivePartida, loadActiveWeighing, loadMyBookingsCount, loadMyLiveCompetition, loadRaffle, prefetchTracked } from './data';
import { MyLiveCompetition } from './MyLiveCompetition';
import { OrganizerBanner, OrganizerBannerSkeleton } from './OrganizerBanner';
import { OwnedLakesCard, OwnedLakesCardSkeleton } from './OwnedLakesCard';
import { PartidaCta } from './PartidaCta';
import { PollCard } from './PollCard';
import { RaffleCard } from './RaffleCard';
import { RetryRefresh } from './RetryRefresh';
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
      <OrganizerBanner layout={layout} />
    </Suspense>
  );
}

export async function OperatorSlot({ layout }: { layout: 'mobile' | 'desktop' }) {
  const viewer = await getHomeViewer();
  // «Not an operator» and «could not check» never look the same: the operator's card place keeps a
  // retry (the top bar's Administrare keeps its own, SiteTopBar onAdminRetry) — inside the card the
  // block always is (T5 card, «Balta mea»), so the column keeps its rhythm of cards.
  if (viewer?.ownedLakesFailed) {
    return (
      <DashboardSection variant="card" title="Balta mea">
        <RetryRefresh message="Nu am putut încărca bălțile tale." />
      </DashboardSection>
    );
  }
  if (!viewer?.ownedLakes.length) return null;
  return (
    <Suspense fallback={<OwnedLakesCardSkeleton layout={layout} />}>
      <OwnedLakesCard layout={layout} />
    </Suspense>
  );
}

/**
 * fish: the «Ești la pescuit?» hero is hidden while a partidă is live (the dock owns that entry).
 * An unknown session renders nothing (no guest offer to someone who may be signed in).
 */
export async function PartidaCtaSlot({ layout, className }: { layout: 'mobile' | 'desktop'; className?: string }) {
  const session = await getHomeSession();
  if (session === 'unknown') return null;
  // Hidden only on a CONFIRMED live partidă (the dock owns that entry). A probe with no answer
  // ('failed') keeps the hero, as fish shows it whenever no partidă is known to be live — the
  // start flow itself finds a running one.
  const active = session ? await loadActivePartida() : null;
  if (active !== null && active !== 'failed') return null;
  return <PartidaCta signedIn={!!session} layout={layout} className={className} />;
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

/** fish RaffleDashboardCard: between the poll and the suggested anglers, only while a session runs. */
export async function RaffleSlot() {
  // Unknown: the guest card would ask a signed-in viewer to sign in.
  if ((await getHomeSession()) === 'unknown') return null;
  const raffle = await loadRaffle();
  if (!raffle) return null;
  return <RaffleCard raffle={raffle.state} signedIn={raffle.signedIn} participationFailed={raffle.participationFailed} />;
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
  if (partida && partida !== 'failed') return <ActivePartidaDock session={partida} />;
  // From 1280 the right column carries it (RightColumnLiveSlot).
  if (live === 'failed') return <LiveCompetitionRetryDock />;
  if (!live) return null;
  const weighings = await loadActiveWeighing(live.competition.documentId);
  return <MyLiveCompetition live={live} weighings={weighings} layout="dock" />;
}

/** Desktop right column, top: the live partidă, else my live competition (same precedence). */
export async function RightColumnLiveSlot() {
  if (!(await getHomeViewer())) return null;
  const [partida, live] = await Promise.all([loadActivePartida(), loadMyLiveCompetition()]);
  if (partida && partida !== 'failed') return <ActivePartidaCard session={partida} />;
  if (live === 'failed') return <LiveCompetitionRetry />;
  if (!live) return null;
  return <MyLiveCompetition live={live} weighings={await loadActiveWeighing(live.competition.documentId)} layout="card" />;
}

/**
 * «Am I in a live competition?» could not be answered (no answer in the budget, or a 5xx): never
 * folded into «no» — a participant would lose «concursul meu» without a word. The block keeps its
 * place as a T5 card with a retry (as OperatorSlot), in the right column and at the stacked
 * column's end.
 */
/**
 * Below 1280, the same retry in the dock's form (MyLiveCompetition layout="dock": sticky at the
 * bottom edge, the indigo sheet) — never a plain block at the end of a 4000px column, below the
 * fold, which is what a participant would lose. xl:hidden: from 1280 the right column has it.
 */
function LiveCompetitionRetryDock() {
  return (
    <section
      aria-labelledby="acasa-concursul-meu-retry"
      className="sticky bottom-0 z-sticky -mx-4 -mb-8 flex flex-col gap-1.5 rounded-t-bento bg-accent px-5 pt-5 pb-[max(--spacing(5),env(safe-area-inset-bottom))] text-on-accent shadow-tabbar md:-mx-6 md:-mb-10 xl:hidden"
    >
      <h2 id="acasa-concursul-meu-retry" className="t-caption">
        CONCURSUL MEU
      </h2>
      <RetryRefresh tone="accent" message="Nu am putut verifica dacă ești într-un concurs live." />
    </section>
  );
}

function LiveCompetitionRetry() {
  return (
    <DashboardSection variant="card" title="Concursul meu">
      <RetryRefresh message="Nu am putut verifica dacă ești într-un concurs live." />
    </DashboardSection>
  );
}
