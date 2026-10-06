'use client';

import Link from 'next/link';
import { useInfiniteQuery } from '@tanstack/react-query';
import { PhotoIcon } from '@heroicons/react/24/outline';
import { useMemo, useState } from 'react';
import { ChoiceChips, ListEmpty, ListFooter, ListHeader, ListPage } from '@/components/templates/T1';
import { Button, buttonClass } from '@/components/ui/Button';
import {
  buildGalleryCatchItems,
  buildGalleryPhotoItems,
  GALLERY_FILTERS,
  galleryCountLabel,
  galleryItemsFor,
  type FeedLakeImage,
  type GalleryFilter,
  type GalleryItem,
} from '@/core/lakes';
import { communityVenueCatchesInfiniteQuery } from '@/core/partide';
import { createBrowserTransport } from '@/lib/client/transport';
import { routes } from '@/lib/routes';
import { blurDataUrl } from '@/lib/blurhash';
import { CatchTile, catchLabel } from '../_sub/CatchTile';
import { Lightbox, type LightboxItem } from '@/components/surfaces/Lightbox';
import { BrokenPhoto, DEFAULT_RATIO, failedBeforeHydration, MasonryGrid, MasonrySkeleton, tileRatio } from '../_sub/Masonry';
import { ChipStrip, firstReadFailed, SUB_TITLE_ID, SubListError, SubRetryFocus } from '../_sub/states';
import { useBack } from '../_sub/useBack';

/*
 * Galerie — fish app/(app)/lakes/[lakeId]/gallery.tsx (parity lakes.gallery): the lake's own photos
 * and every community catch photographed there, in one masonry, on T1's ListPage (no filter column,
 * no aside — the header → content step is the sibling subpages').
 *  - c1 «Galerie», «{baltă} · N fotografii» (the lake's photos + the server's catch total), the
 *    family's dismiss control (ListHeader's back square, «Închide galeria»);
 *  - c2 the three filters (Toate first), one line that scrolls when it does not fit, on a surface
 *    strip (the page ground swallows soft-fill chips);
 *  - c3 «Toate» alternates photo / catch, then the rest of the longer list (core interleave) — so
 *    while the catches are still on their way «Toate» is the skeleton, never a photos-only grid
 *    whose tiles all move when the catches are interleaved;
 *  - c4 masonry, lake photos at 4:3 over their blurhash, catches at their own ratio within the tile
 *    band; catches without a photo are skipped (core buildGalleryCatchItems);
 *  - c5 a catch tile: the kit catch signature (navy chip, lavender kg), the species, the angler;
 *  - c6 the empty copy per filter; c7 catches 20 a page, half a viewport early, spinner footer,
 *    «Foto baltă» never pages; c8 the lightbox from the activated tile.
 * The first catches page comes with the HTML (page.tsx prefetch); the browser takes the same query
 * over (core communityVenueCatchesInfiniteQuery: staleTime 60s, no retry — fish).
 */

const PHOTO_TILE =
  'group relative block w-full cursor-pointer overflow-hidden rounded-card bg-soft-fill focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

export function GalleryScreen({ lakeId, lakeName, images }: { lakeId: string; lakeName: string; images: FeedLakeImage[] }) {
  const t = useMemo(() => createBrowserTransport(), []);
  const q = useInfiniteQuery(communityVenueCatchesInfiniteQuery(t, { kind: 'lake', id: lakeId }));
  const [filter, setFilter] = useState<GalleryFilter>('toate');
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [broken, setBroken] = useState<ReadonlySet<string>>(() => new Set());
  const back = useBack(routes.lake(lakeId));
  const markBroken = (key: string) => setBroken(prev => (prev.has(key) ? prev : new Set(prev).add(key)));

  const photos = useMemo(() => buildGalleryPhotoItems(images), [images]);
  const catches = useMemo(() => buildGalleryCatchItems(q.data?.pages.flatMap(p => p.data) ?? []), [q.data]);
  const catchesTotal = q.data?.pages[0]?.meta.pagination.total ?? catches.length;
  const total = photos.length + catchesTotal;

  const pages = filter !== 'foto';
  const firstFailed = firstReadFailed(q) && pages;
  const pending = q.isPending && pages && !firstFailed;
  // «Toate» interleaves: until the catches are here it is the skeleton (never photos that move).
  const items = useMemo(() => (pending ? [] : galleryItemsFor(filter, photos, catches)), [pending, filter, photos, catches]);
  const loadMore = () => {
    // «Foto baltă» is the lake's own image set — fully client-side, nothing to page (fish).
    if (filter === 'foto' || !q.hasNextPage || q.isFetchingNextPage) return;
    void q.fetchNextPage();
  };

  const lightboxItems = useMemo<LightboxItem[]>(
    () =>
      items.map(item =>
        item.kind === 'photo'
          ? { key: item.key, src: item.fullUri, preview: item.uri, alt: `Fotografie de la ${lakeName}` }
          : {
              key: item.key,
              src: item.uri,
              preview: item.gridUri,
              alt: catchLabel(item),
              catch: { weightKg: item.weightKg, species: item.species, occurredAt: item.occurredAt, anglerName: item.anglerName },
            },
      ),
    [items, lakeName],
  );
  const found = openKey ? items.findIndex(i => i.key === openKey) : -1;
  const lightboxTotal = filter === 'foto' ? photos.length : filter === 'capturi' ? catchesTotal : total;

  const emptyTitle = filter === 'capturi' ? 'Nicio captură cu poză la această baltă încă.' : 'Nicio fotografie încă.';
  // The count only once it is true: the photos alone on «Foto baltă», photos + every catch once the
  // catches are read — never a photos-only count that jumps, nor one over a failed read.
  const count = filter === 'foto' ? galleryCountLabel(photos.length) : q.data ? galleryCountLabel(total) : null;
  // On «Toate» a failed catches read still shows the lake's photos above its error card.
  const shown = firstFailed && filter === 'toate' ? photos : items;

  const header = (
    <ListHeader
      title="Galerie"
      titleId={SUB_TITLE_ID}
      description={<span data-testid="gallery-subtitle">{[lakeName, count].filter(Boolean).join(' · ')}</span>}
      back={{ label: 'Închide galeria', onClick: back }}
    />
  );

  return (
    <ListPage header={header}>
      <ChipStrip scroll testId="gallery-filters">
        <ChoiceChips name="galerie-filtru" label="Arată" options={GALLERY_FILTERS.map(f => ({ value: f.id, label: f.label }))} value={filter} onChange={setFilter} />
      </ChipStrip>
      <section aria-label="Fotografii" aria-busy={pending || q.isFetchingNextPage || undefined} className="flex flex-col gap-4">
        {/* After a successful list retry the content takes focus — mounted fresh with each read
            (keyed), so a retry that lands while photos were already on screen still hands focus over. */}
        {q.data ? <SubRetryFocus key={q.dataUpdatedAt} /> : null}
        {shown.length ? (
          <MasonryGrid
            items={shown}
            ratioOf={i => (broken.has(i.key) ? DEFAULT_RATIO : tileRatio(i.aspectRatio))}
            keyOf={i => i.key}
            label={GALLERY_FILTERS.find(f => f.id === filter)?.label ?? 'Fotografii'}
            testId="gallery-grid"
          >
            {item =>
              item.kind === 'photo' ? (
                <PhotoTile item={item} lakeName={lakeName} broken={broken.has(item.key)} onBroken={() => markBroken(item.key)} onOpen={() => setOpenKey(item.key)} />
              ) : (
                <CatchTile
                  c={{ src: item.gridUri, ratio: item.aspectRatio, weightKg: item.weightKg, species: item.species, anglerName: item.anglerName }}
                  variant="full"
                  broken={broken.has(item.key)}
                  onBroken={() => markBroken(item.key)}
                  onOpen={() => setOpenKey(item.key)}
                  label={`Deschide: ${catchLabel(item)}`}
                />
              )
            }
          </MasonryGrid>
        ) : pending ? (
          <MasonrySkeleton />
        ) : firstFailed ? null : (
          <div data-testid="gallery-empty">
            <ListEmpty
              icon={<PhotoIcon aria-hidden className="size-12" />}
              title={emptyTitle}
              action={
                filter === 'capturi' && photos.length ? (
                  <Button variant="secondary" onClick={() => setFilter('foto')}>
                    Vezi fotografiile bălții
                  </Button>
                ) : (
                  <Link href={routes.lake(lakeId)} className={buttonClass({ variant: 'secondary' })}>
                    Înapoi la baltă
                  </Link>
                )
              }
            />
          </div>
        )}
        {firstFailed ? (
          <SubListError
            testId="gallery-catches-error"
            title="Nu am putut încărca capturile comunității."
            onRetry={() => void q.refetch()}
            retrying={q.isFetching}
            attempt={q.errorUpdateCount}
          />
        ) : null}
        {pages && q.data ? (
          <ListFooter
            hasMore={!!q.hasNextPage}
            loadingMore={q.isFetchingNextPage}
            error={q.isFetchNextPageError}
            onLoadMore={loadMore}
            errorLabel="Nu am putut încărca mai multe fotografii."
          />
        ) : null}
      </section>
      <Lightbox
        items={lightboxItems}
        index={found >= 0 ? found : null}
        onIndex={i => setOpenKey(i == null ? null : (items[i]?.key ?? null))}
        total={lightboxTotal}
        label="Galerie"
        onEndReached={filter !== 'foto' ? loadMore : undefined}
        fetchingMore={q.isFetchingNextPage}
        moreFailed={q.isFetchNextPageError}
        onRetryMore={loadMore}
      />
    </ListPage>
  );
}

/** A lake photo: 4:3 over its blurhash (c4); a failed one is the muted glyph. */
function PhotoTile({
  item,
  lakeName,
  broken,
  onBroken,
  onOpen,
}: {
  item: Extract<GalleryItem, { kind: 'photo' }>;
  lakeName: string;
  broken: boolean;
  onBroken: () => void;
  onOpen: () => void;
}) {
  const blur = blurDataUrl(item.blurhash);
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Deschide fotografia bălții ${lakeName}`}
      className={PHOTO_TILE}
      style={{ aspectRatio: String(broken ? DEFAULT_RATIO : tileRatio(item.aspectRatio)), ...(blur && !broken ? { backgroundImage: `url("${blur}")`, backgroundSize: 'cover' } : {}) }}
      data-kind="photo"
      data-broken={broken || undefined}
    >
      {broken ? (
        <BrokenPhoto />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- CMS renditions, already sized for the grid.
        <img src={item.uri} alt="" loading="lazy" ref={failedBeforeHydration(onBroken)} onError={onBroken} className="size-full object-cover transition-transform duration-(--duration-slow) group-hover:scale-[1.02]" />
      )}
    </button>
  );
}
