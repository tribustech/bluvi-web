'use client';

import { PhotoIcon } from '@heroicons/react/24/outline';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { SetBreadcrumb } from '@/app/(site)/_shell/SiteHeader';
// The lake gallery's masonry and catch tile, read-only (their TODO(kit): a Masonry in components/ui).
import { CatchTile } from '@/app/(site)/balti/[id]/_sub/CatchTile';
import { DEFAULT_RATIO, MasonryGrid, MasonrySkeleton, tileRatio } from '@/app/(site)/balti/[id]/_sub/Masonry';
import type { Crumb } from '@/components/nav/Breadcrumbs';
import { ICON_BUTTON_SIZE } from '@/components/nav/IconButton';
import { useBack } from '@/components/nav/useBack';
import { CatchLightbox } from '@/components/partide/CatchLightbox';
import { ListEmpty, ListError, ListFooter, ListHeader, ListPage } from '@/components/templates/T1';
import { cn } from '@/components/ui/cn';
import { myCatchesInfiniteQuery } from '@/core/partide';
import { createBrowserTransport } from '@/lib/client/transport';
import { routes } from '@/lib/routes';
import { catchesSubtitle, catchRatio, catchTileLabel, dedupeCatches } from './view';

/*
 * /partide/capturile-mele — «Capturile mele»: fish app/(app)/partide/capturi.tsx →
 * features/partide/screens/MyCatchesGalleryScreen.tsx (parity partide.capturile-mele c1–c4), T1's
 * ListPage with no filters and no aside, behind the page's requireViewer gate.
 *
 * Every catch of mine that has a photo, behind Ale mele's «Vezi tot» rail card. Deliberately NOT
 * the profile's «Capturi» grid: that one reads the public feed and drops catches from partide taken
 * off the profile (visibleOnProfile false), so sending an angler there from their own journal would
 * hide their own fish. Same query as the rail (core myCatchesInfiniteQuery —
 * /feed/sessions/mine/catches, per user, read in the browser through /api/cms), so arriving from Ale
 * mele renders from cache.
 *  - c1 «Capturile mele», «{total} captură/capturi» once there is one, the close control (useBack:
 *    the previous page of this tab, else Ale mele — fish router.back());
 *  - c2 the masonry (fish MasonryPhotoList: two columns on a phone; here ~220px auto-fill tracks as
 *    the page widens, owner rule 5), deduplicated by key, the next page half a screen early, a
 *    spinner footer (fish's ActivityIndicator) — each tile the catch signature (CatchTile caption:
 *    navy chip + lavender kg, then the species; fish photoCaption «specie · kg»);
 *  - c3 the masonry skeleton while loading; «Nicio captură cu fotografie încă.» when empty; a
 *    failed first read is an error card with a retry, never an empty gallery (owner rule 4);
 *  - c4 a tile opens the lightbox (components/partide/CatchLightbox: CatchDetailFooter, the next
 *    page at the end), whose share opens the composed Bluvi card with the venue and, for a
 *    competition catch, the competition's name.
 */

export const TITLE = 'Capturile mele';

/** «Partide › Ale mele › Capturile mele» on the ≥768 band. */
export const TRAIL: Crumb[] = [
  { label: 'Partide', href: routes.partide() },
  { label: 'Ale mele', href: routes.partideMine() },
  { label: TITLE },
];

const CLOSE_LABEL = 'Închide capturile';

export function CapturileMeleScreen() {
  const t = useMemo(() => createBrowserTransport(), []);
  const q = useInfiniteQuery(myCatchesInfiniteQuery(t));
  const back = useBack(routes.partideMine());
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [broken, setBroken] = useState<ReadonlySet<string>>(() => new Set());
  const markBroken = (key: string) => setBroken(prev => (prev.has(key) ? prev : new Set(prev).add(key)));

  const catches = useMemo(() => dedupeCatches(q.data?.pages), [q.data]);
  const total = q.data?.pages[0]?.meta.pagination.total ?? catches.length;
  const subtitle = catchesSubtitle(total, catches.length);

  const loadMore = () => {
    if (!q.hasNextPage || q.isFetchingNextPage) return;
    void q.fetchNextPage();
  };

  const firstFailed = q.isError && !q.data;

  let body;
  if (q.isPending) body = <MasonrySkeleton label="Se încarcă capturile…" />;
  else if (firstFailed)
    body = (
      <ListError
        title="Capturile nu s-au putut încărca."
        onRetry={() => void q.refetch()}
        retrying={q.isFetching}
        attempt={q.errorUpdateCount}
      />
    );
  else if (catches.length === 0)
    body = (
      <div data-testid="my-catches-empty">
        <ListEmpty icon={<PhotoIcon aria-hidden className="size-12" />} title="Nicio captură cu fotografie încă." />
      </div>
    );
  else
    body = (
      <>
        <MasonryGrid
          items={catches}
          ratioOf={c => (broken.has(c.key) ? DEFAULT_RATIO : tileRatio(catchRatio(c)))}
          keyOf={c => c.key}
          label="Capturile mele"
          testId="my-catches-grid"
          skeletonLabel="Se încarcă capturile…"
        >
          {(c, i) => (
            <CatchTile
              c={{ src: c.photoGridUrl || c.photoUrl, ratio: catchRatio(c) ?? DEFAULT_RATIO, weightKg: c.weightKg, species: c.species, anglerName: null }}
              variant="caption"
              broken={broken.has(c.key)}
              onBroken={() => markBroken(c.key)}
              onOpen={() => setLightbox(i)}
              label={catchTileLabel(c)}
              kind={c.source === 'competition' ? 'competition' : 'partida'}
            />
          )}
        </MasonryGrid>
        <ListFooter
          hasMore={!!q.hasNextPage}
          loadingMore={q.isFetchingNextPage}
          error={q.isFetchNextPageError}
          onLoadMore={loadMore}
          spinner
          errorLabel="Nu am putut încărca mai multe capturi."
        />
      </>
    );

  return (
    <>
      <SetBreadcrumb trail={TRAIL} />
      <ListPage
        header={
          <ListHeader
            title={TITLE}
            description={subtitle ? <span data-testid="my-catches-subtitle">{subtitle}</span> : undefined}
            back={{ label: CLOSE_LABEL, onClick: back }}
          />
        }
      >
        <section aria-label="Fotografii" aria-busy={q.isPending || q.isFetchingNextPage || undefined} data-testid="my-catches-body">
          {body}
        </section>
      </ListPage>
      <CatchLightbox
        catches={catches}
        total={total}
        index={lightbox}
        onIndex={setLightbox}
        onEndReached={loadMore}
        fetchingMore={q.isFetchingNextPage}
        moreFailed={q.isFetchNextPageError}
        onRetryMore={() => void q.fetchNextPage()}
      />
    </>
  );
}

/**
 * The whole page while the gate reads the session (loading.tsx and the page's Suspense fallback):
 * the real title, the close control's place and the masonry skeleton.
 */
export function CapturileMelePageLoading() {
  return (
    <>
      <SetBreadcrumb trail={TRAIL} />
      <ListPage
        header={
          <div className="flex min-h-12 items-center gap-3 xl:min-h-10">
            <span aria-hidden className={cn(ICON_BUTTON_SIZE, 'shrink-0 rounded-control bg-surface shadow-e0')} />
            <h1 className="min-w-0 flex-1 t-title1 text-ink">{TITLE}</h1>
          </div>
        }
      >
        <MasonrySkeleton label="Se încarcă capturile…" />
      </ListPage>
    </>
  );
}
