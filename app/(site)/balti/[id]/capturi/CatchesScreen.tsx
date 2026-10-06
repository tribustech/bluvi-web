'use client';

import Link from 'next/link';
import { useInfiniteQuery } from '@tanstack/react-query';
import { CameraIcon } from '@heroicons/react/24/outline';
import { useMemo, useState, useSyncExternalStore } from 'react';
import { ListEmpty, ListFooter, ListHeader, ListPage } from '@/components/templates/T1';
import { buttonClass } from '@/components/ui/Button';
import { communityVenueCatchesInfiniteQuery, fmtKg, type LakeCatchDTO } from '@/core/partide';
import { createBrowserTransport } from '@/lib/client/transport';
import { routes } from '@/lib/routes';
import { Lightbox, type LightboxItem } from '@/components/surfaces/Lightbox';
import { CatchTile } from '../_sub/CatchTile';
import { DEFAULT_RATIO, MasonryGrid, MasonrySkeleton, tileRatio } from '../_sub/Masonry';
import { firstReadFailed, SUB_TITLE_ID, SubListError, SubRetryFocus } from '../_sub/states';
import { useBack } from '../_sub/useBack';

/*
 * Capturi — fish app/(app)/lakes/[lakeId]/capturi.tsx → VenueCatchesGalleryScreen (parity
 * lakes.catches): every catch photographed at the lake, by everyone, attribution per photo.
 *  - c1 «Capturi», «{baltă} · N capturi» («1 captură»), the family's dismiss control (ListHeader's
 *    back square, «Închide capturile»); on T1's ListPage (no filters, no aside);
 *  - c2 the masonry (grid → thumb → original); each tile is the shared CatchTile `caption` (the
 *    catch signature: navy chip + lavender kg, then the species);
 *  - c3 the masonry skeleton while loading, «Nicio captură cu fotografie încă.» when empty (a
 *    camera, a way back to the lake — and no «0 capturi» over it);
 *  - c4 `?foto=<clientId>` opens the lightbox ONCE on that catch as soon as it is loaded;
 *  - c5 the lightbox with the original photo and the footer; c6 pages of 20 on scroll + footer.
 * Same query as the lake's catches rail (core communityVenueCatchesInfiniteQuery), first page
 * prefetched with the HTML.
 */

const FOTO_PARAM = 'foto';
const noSubscribe = () => () => {};
const readFoto = () => {
  try {
    return new URLSearchParams(window.location.search).get(FOTO_PARAM);
  } catch {
    return null;
  }
};

const gridSrc = (c: LakeCatchDTO) => (c.photoGridUrl || c.photoThumbUrl || c.photoUrl) as string;
const fullSrc = (c: LakeCatchDTO) => (c.photoUrl || c.photoGridUrl) as string;

/** fish photoCaption: «{specie} · X kg», only what is known; null when neither is. */
export function photoCaption(c: Pick<LakeCatchDTO, 'species' | 'weightKg'>): string | null {
  if (!c.species && c.weightKg == null) return null;
  return [c.species, c.weightKg != null ? `${fmtKg(c.weightKg)} kg` : null].filter(Boolean).join(' · ');
}

export function catchesCountLabel(total: number): string {
  return `${total} ${total === 1 ? 'captură' : 'capturi'}`;
}

export function CatchesScreen({ lakeId, lakeName }: { lakeId: string; lakeName: string }) {
  const t = useMemo(() => createBrowserTransport(), []);
  const q = useInfiniteQuery(communityVenueCatchesInfiniteQuery(t, { kind: 'lake', id: lakeId }));
  const catches = useMemo(() => (q.data?.pages ?? []).flatMap(p => p.data).filter(c => gridSrc(c)), [q.data]);
  const total = q.data?.pages[0]?.meta.pagination.total ?? catches.length;
  const failed = firstReadFailed(q);
  const back = useBack(routes.lake(lakeId));
  const [broken, setBroken] = useState<ReadonlySet<string>>(() => new Set());

  // The open photo by id (it stays the same photo when the next page lands). Until the user opens
  // or closes one, `?foto=` opens that catch — once, as soon as its page is here (fish
  // `openedInitial`); a catch that is not in the list opens nothing.
  const foto = useSyncExternalStore(noSubscribe, readFoto, () => null);
  const [openId, setOpenId] = useState<string | null | undefined>(undefined);
  const shownId = openId === undefined ? foto : openId;
  const found = shownId ? catches.findIndex(c => c.clientId === shownId) : -1;
  // fish resolves `?foto=` on the first render that has catches, once: a catch that is not on the
  // first page never pops the lightbox open later, under a scroll that loaded its page.
  if (openId === undefined && foto && q.data && found < 0) setOpenId(null);

  const loadMore = () => {
    if (!q.hasNextPage || q.isFetchingNextPage) return;
    void q.fetchNextPage();
  };
  const lightboxItems = useMemo<LightboxItem[]>(
    () =>
      catches.map(c => ({
        key: c.clientId,
        src: fullSrc(c),
        preview: gridSrc(c),
        alt: photoCaption(c) ?? 'Captură',
        catch: { weightKg: c.weightKg, species: c.species, occurredAt: c.occurredAt, anglerName: c.angler.name, angler: c.angler },
      })),
    [catches],
  );

  const header = (
    <ListHeader
      title="Capturi"
      titleId={SUB_TITLE_ID}
      // The count only once the catches are read: never «0 capturi» over a failed read — and not
      // over the empty card either, which already says there is none.
      description={<span data-testid="gallery-subtitle">{[lakeName, q.data && total > 0 ? catchesCountLabel(total) : null].filter(Boolean).join(' · ')}</span>}
      back={{ label: 'Închide capturile', onClick: back }}
    />
  );

  return (
    <ListPage header={header}>
      <section aria-label="Capturi cu fotografie" aria-busy={q.isPending || q.isFetchingNextPage || undefined} className="flex flex-col gap-4">
        {failed ? (
          <SubListError
            testId="catches-error"
            title="Nu am putut încărca capturile."
            onRetry={() => void q.refetch()}
            retrying={q.isFetching}
            attempt={q.errorUpdateCount}
          />
        ) : q.isPending ? (
          <MasonrySkeleton label="Se încarcă capturile…" />
        ) : catches.length ? (
          <>
            <SubRetryFocus key={q.dataUpdatedAt} />
            <MasonryGrid
              items={catches}
              ratioOf={c => (broken.has(c.clientId) ? DEFAULT_RATIO : tileRatio(ratioOf(c)))}
              keyOf={c => c.clientId}
              label="Capturi"
              testId="catches-grid"
              skeletonLabel="Se încarcă capturile…"
            >
              {c => (
                <CatchTile
                  c={{ src: gridSrc(c), ratio: ratioOf(c), weightKg: c.weightKg, species: c.species, anglerName: c.angler.name }}
                  variant="caption"
                  broken={broken.has(c.clientId)}
                  onBroken={() => setBroken(prev => (prev.has(c.clientId) ? prev : new Set(prev).add(c.clientId)))}
                  onOpen={() => setOpenId(c.clientId)}
                  label={`Deschide fotografia${photoCaption(c) ? `: ${photoCaption(c)}` : ''} — ${c.angler.name ?? 'Pescar'}`}
                />
              )}
            </MasonryGrid>
          </>
        ) : (
          <div data-testid="catches-empty">
            <SubRetryFocus key={q.dataUpdatedAt} />
            <ListEmpty
              icon={<CameraIcon aria-hidden className="size-12" />}
              title="Nicio captură cu fotografie încă."
              description="Capturile fotografiate de pescari la această baltă apar aici."
              action={
                <Link href={routes.lake(lakeId)} className={buttonClass({ variant: 'secondary' })}>
                  Înapoi la baltă
                </Link>
              }
            />
          </div>
        )}
        {q.data ? (
          <ListFooter
            hasMore={!!q.hasNextPage}
            loadingMore={q.isFetchingNextPage}
            error={q.isFetchNextPageError}
            onLoadMore={loadMore}
            errorLabel="Nu am putut încărca mai multe capturi."
          />
        ) : null}
      </section>
      <Lightbox
        items={lightboxItems}
        index={found >= 0 ? found : null}
        onIndex={i => setOpenId(i == null ? null : (catches[i]?.clientId ?? null))}
        total={total}
        label="Capturi"
        onEndReached={loadMore}
        fetchingMore={q.isFetchingNextPage}
        moreFailed={q.isFetchNextPageError}
        onRetryMore={loadMore}
      />
    </ListPage>
  );
}

/** The photo's own ratio (width / height), 4:3 when unknown. */
const ratioOf = (c: LakeCatchDTO) => (c.photoWidth && c.photoHeight ? c.photoWidth / c.photoHeight : DEFAULT_RATIO);
