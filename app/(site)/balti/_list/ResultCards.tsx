'use client';

import { StarIcon } from '@heroicons/react/20/solid';
import Image from 'next/image';
import { useState } from 'react';
import { CardShell, CardTitle, formatDecimal, Pill } from '@/components/cards';
import { Dialog } from '@/components/surfaces/Dialog';
import { listGridClass } from '@/components/templates/T1';
import { T2MapCard } from '@/components/templates/T2';
import { buttonClass } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { buildMapUrls, getLakeLocationSubtitle, type LakeMapLeaf, type LegacyLake } from '@/core/lakes';
import { routes } from '@/lib/routes';
import { facilityIcon } from '@/app/(site)/_home/facilityIcon';
import { blurDataUrl } from '@/lib/blurhash';
import { FishOutlineIcon } from '@/components/nav/brand';
import { SplitIcon } from './icons';
import { track } from './analytics';
import type { LakeImageSrc } from './lakeImage';

/*
 * The results map's two lake cards:
 * - ResultLakeCard — fish components/NewLakeCardWithCarouselHeader.tsx (lakes.results-map.c16):
 *   up to 3 photos, the distance pill, name + rating, the place, «Facilități» and «Pești de prins»
 *   (5 each, as fish) and the regime;
 * - PinLakeCard — fish LakeMapPinCard (c12): up to 3 photos (grey block without), distance, close,
 *   «Direcții», name, «★ 4.50 (N)», the place.
 * fish swipes the photos in a carousel; the web lays the (at most) three out at once — the first
 * large, the others stacked beside it — so nothing hides behind a gesture a mouse does not have.
 */

/** fish LakeFacilities / LakeFishSpecies: up to 5 each, under their labels. */
const MAX_FACILITIES = 5;
const MAX_SPECIES = 5;

/**
 * Up to three photos: one fills the band; two split it; three = one large + two stacked. `sizes`
 * is the band's rendered width (the only photo fills it); the large tile of a mosaic is 2/3 of it
 * (`mosaicSizes`), the side tiles ≤160px.
 */
export function PhotoMosaic({
  photos,
  heightClass,
  sizes,
  mosaicSizes,
  children,
}: {
  photos: LakeImageSrc[];
  heightClass: string;
  sizes: string;
  mosaicSizes: string;
  children?: React.ReactNode;
}) {
  if (!photos.length) return <div className={cn('relative shrink-0 bg-soft-fill', heightClass)}>{children}</div>;
  const [first, ...rest] = photos;
  const img = (p: LakeImageSrc, s: string) => (
    <Image
      src={p.src}
      alt=""
      fill
      sizes={s}
      className="object-cover"
      {...(p.blurhash ? { placeholder: 'blur' as const, blurDataURL: blurDataUrl(p.blurhash) } : {})}
    />
  );
  return (
    <div className={cn('relative grid shrink-0 gap-0.5 overflow-hidden bg-soft-fill', heightClass, rest.length ? 'grid-cols-[2fr_1fr] grid-rows-2' : 'grid-cols-1')}>
      <div className="relative row-span-2">{img(first, rest.length ? mosaicSizes : sizes)}</div>
      {rest.map((p) => (
        <div key={p.src} className={cn('relative', rest.length === 1 && 'row-span-2')}>
          {img(p, '160px')}
        </div>
      ))}
      {children}
    </div>
  );
}

function Rating({ overall, count, withCount = false }: { overall: number; count: number; withCount?: boolean }) {
  return (
    <p className="flex shrink-0 items-center gap-0.75 t-control text-ink">
      <StarIcon aria-hidden className="size-3.5 text-rating" />
      <span className="sr-only">Rating </span>
      {formatDecimal(overall, withCount ? 2 : 1, withCount ? 2 : 1)}
      {withCount ? (
        <span className="text-muted">
          {' '}
          ({count}
          <span className="sr-only"> recenzii</span>)
        </span>
      ) : null}
    </p>
  );
}

export function ResultLakeCard({ lake, distanceLabel, photos }: { lake: LegacyLake; distanceLabel: string | null; photos: LakeImageSrc[] }) {
  const location = getLakeLocationSubtitle(lake, { includeAddress: false });
  const reviews = lake.reviewsMeta && lake.reviewsMeta.count > 0 ? lake.reviewsMeta : null;
  const facilities = lake.facility ?? [];
  const species = (lake.fishSpecies ?? []).flatMap((s) => (s.fish?.Name ? [s.fish.Name] : []));
  return (
    <CardShell elevated interactive>
      {/* The T2 list column: one card ≈92vw on a phone, ≤320px from 768, ≤400px (two columns) from 1280. */}
      <PhotoMosaic
        photos={photos}
        heightClass="h-36 xl:h-40"
        sizes="(min-width: 1280px) 400px, (min-width: 768px) 320px, 92vw"
        mosaicSizes="(min-width: 1280px) 270px, (min-width: 768px) 215px, 62vw"
      >
        {distanceLabel ? (
          <Pill tone="scrim" className="absolute top-2.5 left-2.5">
            <span className="sr-only">La </span>
            {distanceLabel}
          </Pill>
        ) : null}
      </PhotoMosaic>
      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-start justify-between gap-2">
            <CardTitle href={routes.lake(lake.documentId)} className="line-clamp-2 min-w-0 t-heading text-ink">
              {lake.name}
            </CardTitle>
            {/* fish LakeRating size large: «★ 4,80 (12)». */}
            {reviews ? <Rating overall={reviews.overall ?? 0} count={reviews.count} withCount /> : null}
          </div>
          {location ? <p className="line-clamp-1 t-body text-ink-2">{location}</p> : null}
        </div>
        {facilities.length || species.length || lake.regime ? (
          // On the card foot: cards side by side in a row end their strips on one line.
          <div className="mt-auto flex flex-col gap-2 border-t border-hairline pt-2">
            {facilities.length ? (
              <div className="flex flex-col gap-1">
                <p aria-hidden className="t-caption text-muted">Facilități</p>
                <ul aria-label="Facilități" className="flex flex-wrap gap-x-3 gap-y-1">
                  {facilities.slice(0, MAX_FACILITIES).map((f) => {
                    const Icon = facilityIcon(f.name);
                    return (
                      <li key={f.id} className="flex items-center gap-1 t-caption text-ink-2">
                        <Icon aria-hidden className="size-4 shrink-0 text-accent-ink" />
                        {f.name}
                      </li>
                    );
                  })}
                  {facilities.length > MAX_FACILITIES ? (
                    <li className="t-caption text-muted">
                      +{facilities.length - MAX_FACILITIES}
                      <span className="sr-only"> facilități</span>
                    </li>
                  ) : null}
                </ul>
              </div>
            ) : null}
            {species.length ? (
              <div className="flex flex-col gap-1">
                <p aria-hidden className="t-caption text-muted">Pești de prins</p>
                <ul aria-label="Pești de prins" className="flex flex-wrap gap-1.5">
                  {species.slice(0, MAX_SPECIES).map((name) => (
                    <li key={name} className="inline-flex h-6 items-center rounded-full bg-accent-tint px-2 t-micro-strong text-accent-ink">
                      {name}
                    </li>
                  ))}
                  {species.length > MAX_SPECIES ? (
                    <li className="inline-flex h-6 items-center rounded-full bg-accent-tint px-2 t-micro-strong text-accent-ink">
                      +{species.length - MAX_SPECIES}
                      <span className="sr-only"> specii</span>
                    </li>
                  ) : null}
                </ul>
              </div>
            ) : null}
            {lake.regime ? (
              <p className="flex items-center gap-1 t-caption text-ink-2">
                <FishOutlineIcon className="size-4 shrink-0 text-accent-ink" />
                <span className="sr-only">Regim: </span>
                {lake.regime}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </CardShell>
  );
}

/** fish NavigationSheet (c13): Google Maps, Waze, Apple Maps to the lake's coordinates. */
export function DirectionsDialog({
  open,
  onClose,
  name,
  coordinate,
}: {
  open: boolean;
  onClose: () => void;
  name: string;
  coordinate: { latitude: number; longitude: number };
}) {
  const urls = buildMapUrls({ lat: String(coordinate.latitude), long: String(coordinate.longitude) });
  const apps = urls
    ? [
        { label: 'Google Maps', href: urls.google },
        { label: 'Waze', href: urls.waze },
        { label: 'Apple Maps', href: urls.apple },
      ]
    : [];
  return (
    <Dialog open={open} onClose={onClose} title="Direcții" subtitle={name} closeButton>
      <ul className="flex flex-col gap-2 pt-2">
        {apps.map((a) => (
          <li key={a.label}>
            <a href={a.href} target="_blank" rel="noreferrer" onClick={onClose} className={buttonClass({ variant: 'secondary', block: true })}>
              Deschide în {a.label}
              <span className="sr-only"> (se deschide într-o filă nouă)</span>
            </a>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}

export function PinLakeCard({
  lake,
  photos,
  distanceLabel,
  onClose,
  returnFocusTo,
}: {
  lake: LakeMapLeaf;
  photos: LakeImageSrc[];
  distanceLabel: string | null;
  onClose: () => void;
  returnFocusTo: () => HTMLElement | null;
}) {
  const [directions, setDirections] = useState(false);
  const reviews = lake.reviewsMeta && lake.reviewsMeta.count > 0 ? lake.reviewsMeta : null;
  const location = getLakeLocationSubtitle(lake);
  return (
    // fish LakeMapPinCard analytics (lakes.results-map.c25): the card's link opened → view_page.
    <div
      className="contents"
      onClick={(e) => {
        if ((e.target as Element).closest(`a[href="${routes.lake(lake.documentId)}"]`)) {
          track('lakes_map_results_pin_card_view_page', { lake_id: lake.documentId });
        }
      }}
    >
      <T2MapCard
        title={lake.name}
        href={routes.lake(lake.documentId)}
        onClose={() => {
          track('lakes_map_results_pin_card_dismiss', { lake_id: lake.documentId });
          onClose();
        }}
        returnFocusTo={returnFocusTo}
        media={
          <PhotoMosaic
            photos={photos}
            heightClass="h-33 xl:h-36"
            sizes="(min-width: 1280px) 380px, 92vw"
            mosaicSizes="(min-width: 1280px) 255px, 62vw"
          >
            {distanceLabel ? (
              <Pill tone="light" className="absolute top-2.5 left-2.5 shadow-e1">
                <span className="sr-only">La </span>
                {distanceLabel}
              </Pill>
            ) : null}
          </PhotoMosaic>
        }
        titleAside={reviews ? <Rating overall={reviews.overall ?? 0} count={reviews.count} withCount /> : null}
        meta={location ? <span className="truncate">{location}</span> : null}
        actions={
          <button
            type="button"
            onClick={() => {
              track('lakes_pin_card_open_maps', { lake_id: lake.documentId });
              setDirections(true);
            }}
            aria-haspopup="dialog"
            className={buttonClass({ variant: 'secondary', size: 'compact', className: 'gap-1.5' })}
          >
            <SplitIcon className="size-4" />
            Direcții
          </button>
        }
      />
      <DirectionsDialog open={directions} onClose={() => setDirections(false)} name={lake.name} coordinate={lake.coordinate} />
    </div>
  );
}

/** fish LakesListSkeleton variant «results»: card bones in ResultLakeCard's shape. */
export function ResultCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <ul aria-hidden className={listGridClass('md')}>
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="flex flex-col overflow-hidden rounded-card bg-surface shadow-[var(--shadow-e1),var(--shadow-e0)]">
          <span className="block h-36 animate-shimmer xl:h-40" />
          <span className="flex flex-col gap-2 p-3.5">
            <span className="h-4 w-2/3 rounded-full bg-soft-fill" />
            <span className="h-3.5 w-1/3 rounded-full bg-soft-fill" />
            <span className="mt-1 h-3 w-3/4 rounded-full bg-soft-fill" />
          </span>
        </li>
      ))}
    </ul>
  );
}
