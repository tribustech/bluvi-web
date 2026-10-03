'use client';

import { useMemo } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { selectCompetitionCards, type CompetitionCard } from '@/core/competitions';
import { createBrowserTransport } from '@/lib/client/transport';
import { Button } from '@/components/ui/Button';
import { CompetitionRailCard } from './CompetitionRailCard';
import { CardSkeleton, HorizontalRail, RailItem } from './HorizontalRail';
import { SeeAllTitle } from './SeeAllTitle';
import { homeLinks } from './links';
import { liveCardsQuery, SIGNED_OUT, upcomingCardsQuery } from './queries';

const SKELETON_HEIGHT = 300;

/**
 * fish (tabs)/index.tsx competitions block + CompetitionCardsRail.tsx: the live rail while
 * anything is live (or still loading); otherwise «Concursuri viitoare»; neither → nothing.
 * Mobile/tablet: horizontal rail with paging. Desktop main column: the first three as a grid.
 *
 * TanStack reads the current time while building query state, so this must render inside a
 * <Suspense> (page.tsx); its fallback is the same CompetitionsView from the server's first page.
 */
export function CompetitionsSection({ layout }: { layout: 'rail' | 'grid' }) {
  const t = useMemo(() => createBrowserTransport(), []);
  const live = useInfiniteQuery(liveCardsQuery(t));
  const upcoming = useInfiniteQuery(upcomingCardsQuery(t));
  const liveCards = selectCompetitionCards(live.data, { scope: 'all' }, SIGNED_OUT);
  const upcomingCards = selectCompetitionCards(upcoming.data, { scope: 'all' }, SIGNED_OUT);

  const hasLive = live.isLoading || liveCards.competitions.length > 0;
  const hasUpcoming = upcoming.isLoading || upcomingCards.competitions.length > 0;
  if (!hasLive && !hasUpcoming) return null;

  const isLive = hasLive;
  const q = isLive ? live : upcoming;
  const cards = isLive ? liveCards : upcomingCards;
  return (
    <CompetitionsView
      layout={layout}
      isLive={isLive}
      competitions={cards.competitions}
      total={cards.total}
      status={q.isLoading ? 'loading' : q.isError && cards.competitions.length === 0 ? 'error' : 'ready'}
      onRetry={() => q.refetch()}
      onEndReached={() => {
        if (q.hasNextPage && !q.isFetchingNextPage) void q.fetchNextPage();
      }}
      fetchingNext={q.isFetchingNextPage}
    />
  );
}

/** The markup of the section, from data alone (no query, no clock): also the prerendered fallback. */
export function CompetitionsView({
  layout,
  isLive,
  competitions,
  total,
  status,
  onRetry,
  onEndReached,
  fetchingNext = false,
}: {
  layout: 'rail' | 'grid';
  isLive: boolean;
  competitions: CompetitionCard[];
  total: number;
  status: 'loading' | 'error' | 'ready';
  onRetry?: () => void;
  onEndReached?: () => void;
  fetchingNext?: boolean;
}) {
  const title = `${isLive ? 'Concursuri live' : 'Concursuri viitoare'}${total ? ` (${total})` : ''}`;
  const id = `${isLive ? 'acasa-concursuri-live' : 'acasa-concursuri-viitoare'}-${layout}`;

  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <SeeAllTitle
        id={id}
        title={title}
        href={homeLinks.competitions(isLive ? 'started' : 'notStarted')}
        leading={
          isLive && layout === 'grid' ? <span aria-hidden className="size-[7px] shrink-0 rounded-full bg-live animate-live" /> : undefined
        }
      />
      {status === 'loading' ? (
        <CompetitionsSkeleton layout={layout} />
      ) : status === 'error' ? (
        <div className="flex flex-col gap-2.5">
          <p className="t-body">A apărut o eroare la încărcarea datelor.</p>
          <Button block onClick={onRetry}>
            Încearcă din nou
          </Button>
        </div>
      ) : layout === 'grid' ? (
        // Two across until the main column is wide enough for three rail-width cards (1440).
        <ul className="grid grid-cols-2 gap-3.5 2xl:grid-cols-3" aria-label={isLive ? 'Concursuri live' : 'Concursuri viitoare'}>
          {competitions.slice(0, 3).map((c, i) => (
            <li key={c.documentId} className={i === 2 ? 'hidden min-w-0 2xl:block' : 'min-w-0'}>
              <CompetitionRailCard competition={c} variant="grid" />
            </li>
          ))}
        </ul>
      ) : (
        <HorizontalRail
          label={isLive ? 'Concursuri live' : 'Concursuri viitoare'}
          onEndReached={onEndReached}
          footer={fetchingNext ? <CardSkeleton width={225} height={SKELETON_HEIGHT} /> : null}
        >
          {competitions.map((c) => (
            <RailItem key={c.documentId} width={225}>
              <CompetitionRailCard competition={c} />
            </RailItem>
          ))}
        </HorizontalRail>
      )}
    </section>
  );
}

function CompetitionsSkeleton({ layout }: { layout: 'rail' | 'grid' }) {
  return layout === 'grid' ? (
    <div className="grid grid-cols-2 gap-3.5 2xl:grid-cols-3" role="status" aria-label="Se încarcă concursurile">
      {[0, 1, 2].map((i) => (
        <div key={i} className={`h-[300px] rounded-card bg-soft-fill animate-shimmer ${i === 2 ? 'hidden 2xl:block' : ''}`} />
      ))}
    </div>
  ) : (
    <div className="-mx-5 flex gap-2.5 overflow-hidden px-5 pt-1 pb-4 md:-mx-6 md:px-6" role="status" aria-label="Se încarcă concursurile">
      {[0, 1, 2].map((i) => (
        <CardSkeleton key={i} width={225} height={SKELETON_HEIGHT} />
      ))}
    </div>
  );
}
