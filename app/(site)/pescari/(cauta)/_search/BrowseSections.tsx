'use client';

import { UsersIcon } from '@heroicons/react/24/outline';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useId, useMemo } from 'react';
import { ListEmpty, ListError, ListFooter } from '@/components/templates/T1';
import { dedupeByKey, suggestedAnglersInfiniteQuery } from '@/core/social';
import type { Transport } from '@/core/transport';
import { AnglerListSkeleton, AnglerRow, anglerList } from './AnglerRow';

export const SECTION_TITLE = 't-heading text-ink';

/** fish's heading over the browse list; drawn over the skeleton too, so it never pops in. */
const RECENT_TITLE = 'Activi recent';

/**
 * Browse mode while page 1 loads (here, loading.tsx and the page's Suspense): fish's ListHeader
 * always draws «Activi recent» above the seven skeleton rows (pescari.tsx:155-162,173-176), the
 * same way ResultsList keeps «Rezultate» over its own.
 */
export function BrowseSkeleton() {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-3" data-testid="recent-section">
      <h2 id={titleId} className={SECTION_TITLE}>
        {RECENT_TITLE}
      </h2>
      <AnglerListSkeleton />
    </section>
  );
}

/**
 * Browse mode (no search, or fewer than 2 characters) — partide.pescari c3, fish pescari.tsx:55-69,
 * 128-161, data from core suggestedAnglersInfiniteQuery (GET /feed/anglers/suggested, pageSize 20;
 * staleTime 5 min, no focus refetch: page 1's friends-of-follows is a weighted-random sample the
 * server rotates per request, and it must not reshuffle under the reader).
 *  - «Urmăriți de prietenii tăi»: page 1's friendsOfFollows, only when there are any;
 *  - «Activi recent»: every loaded page's recentlyActive, deduplicated by documentId (the first
 *    kept) and without anyone already in the section above — no angler appears twice;
 *  - the next page of «Activi recent» as the footer nears the viewport, after the reader's first
 *    scroll (each page is a server query; on a wide screen the first page fills the view at once),
 *    with «Mai multe» as the keyboard path.
 * States: «Activi recent» over the skeleton while page 1 loads (c5, BrowseSkeleton), an error card with a retry, and fish's
 * «Niciun pescar găsit.» when nobody is recently active.
 */
export function BrowseSections({ t, viewerId }: { t: Transport; viewerId: string }) {
  const q = useInfiniteQuery(suggestedAnglersInfiniteQuery(t));
  const fofTitle = useId();
  const recentTitle = useId();

  const friendsOfFollows = useMemo(() => q.data?.pages[0]?.friendsOfFollows ?? [], [q.data]);
  const recentlyActive = useMemo(() => {
    const fof = new Set(friendsOfFollows.map((a) => a.documentId));
    return dedupeByKey(
      (q.data?.pages ?? []).flatMap((p) => p.recentlyActive.data),
      (a) => a.documentId,
    ).filter((a) => !fof.has(a.documentId));
  }, [q.data, friendsOfFollows]);

  if (q.isPending) return <BrowseSkeleton />;
  if (q.isError && !q.data) {
    return (
      <ListError
        title="Nu am putut încărca pescarii."
        onRetry={() => void q.refetch()}
        retrying={q.isFetching}
        attempt={q.errorUpdateCount}
      />
    );
  }

  return (
    <div className="flex flex-col gap-8 md:gap-10">
      {friendsOfFollows.length > 0 ? (
        <section aria-labelledby={fofTitle} className="flex flex-col gap-3" data-testid="fof-section">
          <h2 id={fofTitle} className={SECTION_TITLE}>
            Urmăriți de prietenii tăi
          </h2>
          <ul aria-labelledby={fofTitle} className={anglerList('grouped')}>
            {friendsOfFollows.map((a) => (
              <AnglerRow key={a.documentId} item={a} isSelf={a.documentId === viewerId} look="grouped" />
            ))}
          </ul>
        </section>
      ) : null}
      <section aria-labelledby={recentTitle} className="flex flex-col gap-3" data-testid="recent-section">
        <h2 id={recentTitle} className={SECTION_TITLE}>
          {RECENT_TITLE}
        </h2>
        {recentlyActive.length > 0 ? (
          <ul aria-labelledby={recentTitle} className={anglerList('separate')}>
            {recentlyActive.map((a) => (
              <AnglerRow key={a.documentId} item={a} isSelf={a.documentId === viewerId} look="separate" />
            ))}
          </ul>
        ) : q.hasNextPage ? null : (
          <ListEmpty title="Niciun pescar găsit." icon={<UsersIcon aria-hidden className="size-12 stroke-[1.5]" />} />
        )}
        <ListFooter
          hasMore={!!q.hasNextPage}
          loadingMore={q.isFetchingNextPage}
          onLoadMore={() => void q.fetchNextPage()}
          error={q.isFetchNextPageError}
          errorLabel="Nu am putut încărca mai mulți pescari."
          moreLabel="Mai mulți pescari"
          spinner
          armOnScroll={recentlyActive.length > 0}
        />
      </section>
    </div>
  );
}
