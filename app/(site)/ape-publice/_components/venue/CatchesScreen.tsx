'use client';

import Link from 'next/link';
import { CameraIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { iconButtonClass } from '@/components/nav/IconButton';
import { FilterColumn, FilterColumnSkeleton, FOCUS_RING, ListEmpty, ListError, ListFooter, ListPage } from '@/components/templates/T1';
import { buttonClass } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { communityVenueCatchesInfiniteQuery, type CommunityVenueRef } from '@/core/partide';
import { createBrowserTransport } from '@/lib/client/transport';
import { routes } from '@/lib/routes';
import { CatchGrid, MasonrySkeleton, galleryTileSrc } from '../detail/catches';
import { EmptyIcon, VenueHeader, WaterPages, useBack } from './bits';

/*
 * Capturi — fish app/(app)/public-waters/[id]/capturi.tsx → VenueCatchesGalleryScreen (parity
 * public-waters.capturi): every catch photographed on the water, by everyone, attribution per photo.
 *  - c2 «Capturi», «<apă> · N capturi» (the server total, «· 0 capturi» included, once it answered),
 *    the close ✕ on the right (back) — the family's header (VenueHeader) with the ✕ in place of the
 *    back square, no refresh (fish has none here);
 *  - c3 the masonry skeleton (the real grid's columns), the empty state card with a way to the
 *    water's partide;
 *  - c4 the masonry (grid → thumb → full), «<specie> · X kg», pages of 20 near the end;
 *  - c5 the lightbox with its footer; c6 `?foto=<clientId>` opens it once on that catch;
 *  - c7 the same query as the water page's grid and the partide rail (arriving from them is a
 *    cache hit). fish presents it as a sheet over the previous page; the web makes it a page whose
 *    ✕ goes back to where the user came from.
 * The masonry and the lightbox are the water page's (../detail/catches.tsx). The frame is T1 ListPage
 * (its gutters and rhythm), the water's pages in its left column from 1280.
 */

const catchesLabel = (n: number) => `${n} ${n === 1 ? 'captură' : 'capturi'}`;

export function CatchesScreen({ code, waterKey, waterName }: { code: string; waterKey: string; waterName: string }) {
  const t = useMemo(() => createBrowserTransport(), []);
  const venue = useMemo<CommunityVenueRef>(() => ({ kind: 'water', code }), [code]);
  const q = useInfiniteQuery(communityVenueCatchesInfiniteQuery(t, venue));
  const catches = useMemo(() => q.data?.pages.flatMap((p) => p.data) ?? [], [q.data]);
  const total = q.data?.pages[0]?.meta.pagination.total ?? catches.length;
  const loadMore = () => {
    if (q.hasNextPage && !q.isFetchingNextPage && !q.isFetchNextPageError) void q.fetchNextPage();
  };
  const subtitle = [waterName, q.isPending || !q.data ? null : catchesLabel(total)].filter(Boolean).join(' · ');

  return (
    <ListPage header={<CatchesHeader subtitle={subtitle} backHref={routes.publicWater(waterKey)} />} filters={<CatchesColumn waterKey={waterKey} />} filtersLabel="Paginile apei">
      <section aria-label="Capturi cu fotografie" aria-busy={q.isPending || q.isFetchingNextPage || undefined}>
        {!q.data && (q.isError || q.errorUpdateCount > 0) ? (
          <div data-testid="catches-error">
            <ListError title="Nu am putut încărca capturile." onRetry={() => void q.refetch()} retrying={q.isFetching} attempt={q.errorUpdateCount} />
          </div>
        ) : (
          <CatchGrid
            catches={catches}
            status={q.status}
            total={total}
            waterName={waterName}
            shareable={false}
            empty={
              <div data-testid="catches-empty">
                <ListEmpty
                  title="Nicio captură cu fotografie încă."
                  icon={
                    <EmptyIcon>
                      <CameraIcon aria-hidden />
                    </EmptyIcon>
                  }
                  action={
                    <Link href={routes.publicWaterPartide(waterKey)} className={buttonClass({ variant: 'secondary' })}>
                      Vezi partidele de pe apă
                    </Link>
                  }
                />
              </div>
            }
            onEndReached={loadMore}
            fetchingMore={q.isFetchingNextPage}
            moreFailed={q.isFetchNextPageError}
            onRetryMore={() => void q.fetchNextPage()}
            tileSrc={galleryTileSrc}
            faces
          />
        )}
        {q.data && catches.length ? (
          <ListFooter
            hasMore={!!q.hasNextPage}
            loadingMore={q.isFetchingNextPage}
            error={q.isFetchNextPageError}
            onLoadMore={() => void q.fetchNextPage()}
            shown={catches.length}
            total={total}
            noun="capturi"
            errorLabel="Nu am putut încărca mai multe capturi."
          />
        ) : null}
      </section>
    </ListPage>
  );
}

/** The left column from 1280: the water's pages (every sibling's «Pe această apă»). */
function CatchesColumn({ waterKey }: { waterKey: string }) {
  return (
    <FilterColumn title="Capturi">
      <WaterPages waterKey={waterKey} current="capturi" />
    </FilterColumn>
  );
}

/**
 * fish GalleryScreenHeader: the title, «<apă> · N capturi» and the close ✕ on the RIGHT — where the
 * lightbox keeps its own ✕, so the dismiss control never jumps sides. The ✕ rests on surface +
 * hairline (the header sits on the page ground, where a soft-fill chip vanishes).
 */
export function CatchesHeader({ subtitle, backHref }: { subtitle: string | null; backHref: string }) {
  return (
    <VenueHeader
      title="Capturi"
      refresh={false}
      backHref={backHref}
      end={<CloseButton backHref={backHref} />}
      description={
        subtitle ? (
          <span className="block truncate" data-testid="gallery-subtitle">
            {subtitle}
          </span>
        ) : (
          <span aria-hidden className="mt-1.5 block h-3 w-44 animate-shimmer rounded-full" />
        )
      }
    />
  );
}

function CloseButton({ backHref }: { backHref: string }) {
  const back = useBack(backHref);
  return (
    <button type="button" onClick={back} aria-label="Închide capturile" className={iconButtonClass({ className: cn('rounded-full bg-surface shadow-e0 hover:bg-soft-fill', FOCUS_RING) })}>
      <XMarkIcon aria-hidden />
    </button>
  );
}

/** The gallery's first load (fish GalleryMasonrySkeleton, c3): the real header, the real grid's columns. */
export function CatchesFallback({ subtitle, backHref }: { subtitle: string | null; backHref: string }) {
  return (
    <div aria-busy>
      <ListPage header={<CatchesHeader subtitle={subtitle} backHref={backHref} />} filters={<FilterColumnSkeleton title="Capturi" sections={[4]} />}>
        <div role="status" data-testid="catches-skeleton">
          <span className="sr-only">Se încarcă capturile…</span>
          <MasonrySkeleton />
        </div>
      </ListPage>
    </div>
  );
}
