'use client';

import { useMemo } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { selectCompetitionCards, type CompetitionCard } from '@/core/competitions';
import { createBrowserTransport } from '@/lib/client/transport';
import { COMPETITION_CARD_HEIGHT, CompetitionFeatureCard, CompetitionRailCard } from './CompetitionRailCard';
import { TrophyIcon } from '@heroicons/react/24/outline';
import { plural } from '@/components/cards/format';
import { CardSkeleton, HorizontalRail, RailEndCard, RailItem, RailRetryItem, useRailRead, HOME_RAIL_BLEED } from './HorizontalRail';
import { RailEmpty, RailError, RailSection, RailSkeleton } from './RailSection';
import { homeLinks } from './links';
import { liveCardsQuery, SIGNED_OUT, upcomingCardsQuery } from './queries';
import { LiveDot } from '@/components/templates/LiveDot';
import { cn } from '@/components/ui/cn';

/**
 * fish (tabs)/index.tsx competitions block + CompetitionCardsRail.tsx: the live rail while
 * anything is live (or still loading); otherwise «Concursuri viitoare»; neither → nothing.
 * A horizontal rail at every width (ROADMAP §4: more cards as the screen grows, never wider ones):
 * swipe on touch, arrows with a mouse, the next page loads near the end (skeleton card meanwhile).
 *
 * TanStack reads the current time while building query state, so this must render inside a
 * <Suspense> (page.tsx); its fallback is the same CompetitionsView from the server's first page.
 */
export function CompetitionsSection() {
  const t = useMemo(() => createBrowserTransport(), []);
  const live = useInfiniteQuery(liveCardsQuery(t));
  const upcoming = useInfiniteQuery(upcomingCardsQuery(t));
  const liveRead = useRailRead(live);
  const upcomingRead = useRailRead(upcoming);
  const liveCards = selectCompetitionCards(live.data && { ...live.data, pages: liveRead.pages ?? [] }, { scope: 'all' }, SIGNED_OUT);
  const upcomingCards = selectCompetitionCards(upcoming.data && { ...upcoming.data, pages: upcomingRead.pages ?? [] }, { scope: 'all' }, SIGNED_OUT);

  const rail = chooseRail(
    { ...live, count: liveCards.competitions.length },
    { ...upcoming, count: upcomingCards.competitions.length }
  );
  if (!rail) return null;

  const isLive = rail === 'live';
  const q = isLive ? live : upcoming;
  const cards = isLive ? liveCards : upcomingCards;
  return (
    <CompetitionsView
      isLive={isLive}
      competitions={cards.competitions}
      total={cards.total}
      status={railStatus(q, cards.competitions.length)}
      onRetry={() => q.refetch()}
      retrying={q.isFetching}
      onEndReached={() => {
        if (q.hasNextPage && !q.isFetchingNextPage && !q.isFetchNextPageError) void q.fetchNextPage();
      }}
      fetchingNext={(isLive ? liveRead : upcomingRead).fetchingNext}
      nextError={(isLive ? liveRead : upcomingRead).nextError}
      onRetryNext={() => void q.fetchNextPage()}
    />
  );
}

/** The phone's rail of a short, fully loaded list (fish: the rail at every count). */
function CompetitionsRail({ label, competitions, isLive, total }: { label: string; competitions: CompetitionCard[]; isLive: boolean; total: number }) {
  return (
    <HorizontalRail className={HOME_RAIL_BLEED} label={label} width={224}>
      {competitions.map((c, i) => (
        <RailItem key={c.documentId} width={224}>
          <CompetitionRailCard competition={c} eager={i === 0} />
        </RailItem>
      ))}
      <RailEndCard
        href={homeLinks.competitions(isLive ? 'started' : 'notStarted')}
        label={isLive ? 'Vezi toate concursurile live' : 'Vezi toate concursurile'}
        caption={total ? plural(total, 'concurs', 'concursuri') : undefined}
        icon={<TrophyIcon />}
        heightClass={COMPETITION_CARD_HEIGHT}
      />
    </HorizontalRail>
  );
}

type RailRead = { isLoading: boolean; isError: boolean; count: number };

/**
 * fish: live while anything is live (or still loading), else upcoming, else nothing. A failed read
 * is a reason to show its rail — with its error and retry (fish c25) — never to fall through to
 * «Concursuri viitoare» while live competitions may exist, or to nothing.
 */
export function chooseRail(live: RailRead, upcoming: RailRead): 'live' | 'upcoming' | null {
  if (live.isLoading || live.isError || live.count > 0) return 'live';
  if (upcoming.isLoading || upcoming.isError || upcoming.count > 0) return 'upcoming';
  return null;
}

/** Which state the chosen rail shows. A failed refetch that still has cards keeps showing them. */
export function railStatus(q: { isLoading: boolean; isError: boolean }, count: number): 'loading' | 'error' | 'ready' {
  if (q.isLoading) return 'loading';
  return q.isError && count === 0 ? 'error' : 'ready';
}

/** The markup of the section, from data alone (no query, no clock): also the prerendered fallback. */
export function CompetitionsView({
  isLive,
  competitions,
  total,
  status,
  onRetry,
  retrying = false,
  onEndReached,
  fetchingNext = false,
  nextError = false,
  onRetryNext,
}: {
  isLive: boolean;
  competitions: CompetitionCard[];
  total: number;
  status: 'loading' | 'error' | 'ready';
  onRetry?: () => void;
  retrying?: boolean;
  onEndReached?: () => void;
  fetchingNext?: boolean;
  /** The next page failed: its slot offers the retry. */
  nextError?: boolean;
  onRetryNext?: () => void;
}) {
  const label = isLive ? 'Concursuri live' : 'Concursuri viitoare';
  const title = `${label}${total ? ` (${total})` : ''}`;
  // One competition in all: from 768 it is shown across the column (CompetitionFeatureCard), not as
  // a lone rail card beside «Vezi toate». The phone keeps fish's rail.
  const single = status === 'ready' && competitions.length === 1 && (total || 1) === 1 && !fetchingNext && !nextError;
  // Two to four in all, every one loaded: from 768 they share the column as equal cards (owner
  // 2026-10-13, «Acasă într-o coloană»: no «Vezi toate» tile left alone in an empty track; the
  // header's link is the way on). Two side by side are the wide feature card; three or four the
  // rail card. More, or a next page to read: the rail.
  const few = status === 'ready' && competitions.length >= 2 && competitions.length <= 4 && (total || competitions.length) === competitions.length && !fetchingNext && !nextError;

  return (
    <RailSection
      title={title}
      leading={isLive ? <LiveDot /> : undefined}
      href={homeLinks.competitions(isLive ? 'started' : 'notStarted')}
    >
      {status === 'loading' ? (
        <RailSkeleton label="Se încarcă concursurile" width={224} heightClass={COMPETITION_CARD_HEIGHT} />
      ) : status === 'error' ? (
        <RailError onRetry={onRetry} retrying={retrying} />
      ) : competitions.length === 0 ? (
        <RailEmpty>Momentan nu este disponibil niciun concurs.</RailEmpty>
      ) : single ? (
        <>
          <div className="md:hidden">
            <HorizontalRail className={HOME_RAIL_BLEED} label={label} width={224}>
              <RailItem width={224}>
                <CompetitionRailCard competition={competitions[0]} eager />
              </RailItem>
            </HorizontalRail>
          </div>
          <div className="max-md:hidden">
            <CompetitionFeatureCard competition={competitions[0]} />
          </div>
        </>
      ) : few ? (
        <>
          <div className="md:hidden">
            <CompetitionsRail label={label} competitions={competitions} isLive={isLive} total={total} />
          </div>
          <ul
            aria-label={label}
            className={cn(
              'grid gap-5 max-md:hidden xl:gap-6',
              competitions.length === 2 ? 'grid-cols-2' : competitions.length === 3 ? 'grid-cols-3' : 'grid-cols-2 xl:grid-cols-4',
            )}
          >
            {competitions.map((c, i) => (
              <li key={c.documentId} className="flex min-w-0 [&>*]:flex-1">
                {competitions.length === 2 ? <CompetitionFeatureCard competition={c} compact /> : <CompetitionRailCard competition={c} eager={i === 0} />}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <HorizontalRail
              className={HOME_RAIL_BLEED}
          label={label}
          width={224}
          onEndReached={onEndReached}
          footer={
            // A retry keeps its slot (and the focus) while it runs; a first next page shows a bone.
            nextError && onRetryNext ? (
              <RailRetryItem width={224} heightClass={COMPETITION_CARD_HEIGHT} onRetry={onRetryNext} retrying={fetchingNext} />
            ) : fetchingNext ? (
              <CardSkeleton width={224} heightClass={COMPETITION_CARD_HEIGHT} />
            ) : null
          }
        >
          {competitions.map((c, i) => (
            <RailItem key={c.documentId} width={224}>
              {/* The rail is the first block of the body at every width: its first poster is the
                  page's LCP candidate, so it loads eagerly at high priority. */}
              <CompetitionRailCard competition={c} eager={i === 0} />
            </RailItem>
          ))}
          {/* From 768 the rail ends on «Vezi toate» (a short rail never leaves an empty track). */}
          {!fetchingNext && !nextError ? (
            <RailEndCard
              href={homeLinks.competitions(isLive ? 'started' : 'notStarted')}
              label={isLive ? 'Vezi toate concursurile live' : 'Vezi toate concursurile'}
              caption={total ? plural(total, 'concurs', 'concursuri') : undefined}
              icon={<TrophyIcon />}
              heightClass={COMPETITION_CARD_HEIGHT}
            />
          ) : null}
        </HorizontalRail>
      )}
    </RailSection>
  );
}
