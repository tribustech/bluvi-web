'use client';

import { useMemo } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import type { LakeCard } from '@/core/lakes';
import { createBrowserTransport } from '@/lib/client/transport';
import { routes } from '@/lib/routes';
import { Button } from '@/components/ui/Button';
import { HomeLakeCard } from './HomeLakeCard';
import { CardSkeleton, HorizontalRail, RailItem } from './HorizontalRail';
import { SeeAllTitle } from './SeeAllTitle';
import { homeLakesQuery } from './queries';

const SKELETON_HEIGHT = 190;

/**
 * fish (tabs)/index.tsx «Bălți (N)» + its horizontal FlatList of MiniatureLakeCard (pages of 10,
 * more on scroll). Empty: «Momentan nu este disponibilă nicio baltă.» Desktop: the first lakes as a
 * grid, «Vezi pe hartă» (design). Rendered inside a <Suspense> whose fallback is LakesView from the
 * server's first page (TanStack reads the clock while prerendering).
 */
export function LakesSection({ layout }: { layout: 'rail' | 'grid' }) {
  const t = useMemo(() => createBrowserTransport(), []);
  const q = useInfiniteQuery(homeLakesQuery(t));
  const lakes = useMemo(() => q.data?.pages.flatMap((p) => p.data) ?? [], [q.data]);
  return (
    <LakesView
      layout={layout}
      lakes={lakes}
      total={q.data?.pages[0]?.meta.pagination.total}
      status={q.isLoading ? 'loading' : q.isError && lakes.length === 0 ? 'error' : 'ready'}
      onRetry={() => q.refetch()}
      onEndReached={() => {
        if (q.hasNextPage && !q.isFetchingNextPage) void q.fetchNextPage();
      }}
      fetchingNext={q.isFetchingNextPage}
    />
  );
}

/** The markup of the section, from data alone (no query, no clock): also the prerendered fallback. */
export function LakesView({
  layout,
  lakes,
  total,
  status,
  onRetry,
  onEndReached,
  fetchingNext = false,
}: {
  layout: 'rail' | 'grid';
  lakes: LakeCard[];
  total: number | undefined;
  status: 'loading' | 'error' | 'ready';
  onRetry?: () => void;
  onEndReached?: () => void;
  fetchingNext?: boolean;
}) {
  const title = `Bălți${total ? ` (${total})` : ''}`;

  return (
    <section aria-labelledby={`acasa-balti-${layout}`} className="flex flex-col gap-3">
      <SeeAllTitle
        id={`acasa-balti-${layout}`}
        title={title}
        href={routes.lakes()}
        linkLabel={layout === 'grid' ? 'Vezi pe hartă' : 'Vezi toate'}
      />
      {status === 'loading' ? (
        <div className="-mx-5 flex gap-2.5 overflow-hidden px-5 pb-4 md:-mx-6 md:px-6" role="status" aria-label="Se încarcă bălțile">
          {[0, 1, 2, 3].map((i) => (
            <CardSkeleton key={i} width={200} height={SKELETON_HEIGHT} />
          ))}
        </div>
      ) : status === 'error' ? (
        <div className="flex flex-col gap-2.5">
          <p className="t-body">A apărut o eroare la încărcarea datelor.</p>
          <Button block onClick={onRetry}>
            Încearcă din nou
          </Button>
        </div>
      ) : lakes.length === 0 ? (
        <p className="rounded-card bg-soft-fill p-4 t-body text-ink-2">Momentan nu este disponibilă nicio baltă.</p>
      ) : layout === 'grid' ? (
        // Three across until the main column fits four ~200px cards (1440, design); the fourth is hidden below.
        <ul className="grid grid-cols-3 gap-3.5 2xl:grid-cols-4" aria-label="Bălți">
          {lakes.slice(0, 4).map((lake, i) => (
            <li key={lake.documentId} className={i === 3 ? 'hidden min-w-0 2xl:block' : 'min-w-0'}>
              <HomeLakeCard lake={lake} variant="grid" />
            </li>
          ))}
        </ul>
      ) : (
        <HorizontalRail
          label="Bălți"
          onEndReached={onEndReached}
          footer={fetchingNext ? <CardSkeleton width={200} height={SKELETON_HEIGHT} /> : null}
        >
          {lakes.map((lake) => (
            <RailItem key={lake.documentId} width={200}>
              <HomeLakeCard lake={lake} />
            </RailItem>
          ))}
        </HorizontalRail>
      )}
    </section>
  );
}
