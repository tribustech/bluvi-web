'use client';

import { useEffect, useMemo } from 'react';
import { useInfiniteQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import type { LakeCard, LakeCardListResponse } from '@/core/lakes';
import { createBrowserTransport } from '@/lib/client/transport';
import { routes } from '@/lib/routes';
import { HomeLakeCard, LAKE_CARD_HEIGHT } from './HomeLakeCard';
import { CardSkeleton, HorizontalRail, RailItem, RailRetryItem, useRailRead } from './HorizontalRail';
import { RailEmpty, RailSection, RailSkeleton } from './RailSection';
import { homeLakesQuery } from './queries';


/**
 * fish (tabs)/index.tsx «Bălți (N)» + its horizontal FlatList of MiniatureLakeCard (pages of 10,
 * more on scroll; three skeletons while loading). Empty: «Momentan nu este disponibilă nicio baltă.»
 * Rendered inside a <Suspense> whose fallback is LakesView from the server's first page (TanStack
 * reads the clock while prerendering).
 */
export function LakesSection({ initial }: { initial?: { pages: LakeCardListResponse[] } | null }) {
  const t = useMemo(() => createBrowserTransport(), []);
  // The page's prefetch reaches this query through the page's HydrationBoundary — unless the key
  // already exists in the cache when the boundary renders: the top bar's search palette builds
  // ['lakes'] (lakesInfiniteQuery with an empty term) before the page, so TanStack defers the
  // hydration to an effect and the server would render an empty rail the browser then contradicts
  // (hydration mismatch). The server's first page, passed in, stands in until the cache has it.
  // TODO(shell): give the palette's empty-term read its own key and drop `initial`.
  const placeholder = useMemo<InfiniteData<LakeCardListResponse, number> | undefined>(
    () => (initial ? { pages: initial.pages, pageParams: initial.pages.map((_, i) => i + 1) } : undefined),
    [initial],
  );
  const q = useInfiniteQuery({ ...homeLakesQuery(t), placeholderData: (prev) => prev ?? placeholder });
  // Placeholder data is not query data: if the browser read then failed, the cache would hold an
  // error with nothing in it and HomeErrorGate would replace a page that has lakes painted. So the
  // server's page is also SEEDED into the cache (marked stale: updatedAt 0, so it never beats a
  // real read — the deferred hydration or the browser fetch overwrites it).
  const qc = useQueryClient();
  useEffect(() => {
    if (!placeholder) return;
    const key = homeLakesQuery(t).queryKey;
    if (qc.getQueryData(key) === undefined) qc.setQueryData(key, placeholder, { updatedAt: 0 });
  }, [qc, t, placeholder]);
  const read = useRailRead(q);
  const lakes = useMemo(() => read.pages?.flatMap((p) => p.data) ?? [], [read.pages]);
  return (
    <LakesView
      lakes={lakes}
      total={read.pages?.[0]?.meta.pagination.total}
      loading={q.isLoading}
      onEndReached={() => {
        if (q.hasNextPage && !q.isFetchingNextPage && !q.isFetchNextPageError) void q.fetchNextPage();
      }}
      fetchingNext={read.fetchingNext}
      nextError={read.nextError}
      onRetryNext={() => void q.fetchNextPage()}
    />
  );
}

/**
 * The markup of the section, from data alone (no query, no clock): also the prerendered fallback.
 * A failed first read has no state of its own here: it replaces the whole page (HomeErrorGate).
 */
export function LakesView({
  lakes,
  total,
  loading,
  onEndReached,
  fetchingNext = false,
  nextError = false,
  onRetryNext,
}: {
  lakes: LakeCard[];
  total: number | undefined;
  loading: boolean;
  onEndReached?: () => void;
  fetchingNext?: boolean;
  /** The next page failed: its slot offers the retry. */
  nextError?: boolean;
  onRetryNext?: () => void;
}) {
  return (
    <RailSection title={`Bălți${total ? ` (${total})` : ''}`} href={routes.lakes()}>
      {loading ? (
        <RailSkeleton label="Se încarcă bălțile" width={200} heightClass={LAKE_CARD_HEIGHT} />
      ) : lakes.length === 0 ? (
        <RailEmpty>Momentan nu este disponibilă nicio baltă.</RailEmpty>
      ) : (
        <HorizontalRail
          label="Bălți"
          width={200}
          onEndReached={onEndReached}
          footer={
            // A retry keeps its slot (and the focus) while it runs; a first next page shows a bone.
            nextError && onRetryNext ? (
              <RailRetryItem width={200} heightClass={LAKE_CARD_HEIGHT} onRetry={onRetryNext} retrying={fetchingNext} />
            ) : fetchingNext ? (
              <CardSkeleton width={200} heightClass={LAKE_CARD_HEIGHT} />
            ) : null
          }
        >
          {lakes.map((lake) => (
            <RailItem key={lake.documentId} width={200}>
              <HomeLakeCard lake={lake} />
            </RailItem>
          ))}
        </HorizontalRail>
      )}
    </RailSection>
  );
}
