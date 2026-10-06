'use client';

import { StarIcon } from '@heroicons/react/20/solid';
import Image from 'next/image';
import { useQuery } from '@tanstack/react-query';
import { PhoneIcon } from '@heroicons/react/24/outline';
import { useMemo, useState } from 'react';
import { formatDecimal, Pill } from '@/components/cards';
import { Dialog } from '@/components/surfaces/Dialog';
import { T2MapCard } from '@/components/templates/T2';
import { buttonClass } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { buildMapUrls, getLakeLocationSubtitle, lakeQuery, type LakeMapLeaf, type LegacyLake } from '@/core/lakes';
import { createBrowserTransport } from '@/lib/client/transport';
import { routes } from '@/lib/routes';
import { blurDataUrl } from '@/lib/blurhash';
import { SplitIcon } from './icons';
import { LakeRowCard, LakeRowCardSkeleton } from './LakeRowCard';
import { track } from './analytics';
import type { LakeImageSrc } from './lakeImage';

/*
 * The results map's two lake cards:
 * - ResultLakeCard — fish components/NewLakeCardWithCarouselHeader.tsx (lakes.results-map.c16) as
 *   the owner's horizontal list card (rule 7, LakeRowCard): the photos with a gallery, name +
 *   rating, the price when known, place + distance, key facts, tags and the actions;
 * - PinLakeCard — fish LakeMapPinCard (c12): up to 3 photos (grey block without), distance, close,
 *   «Direcții», name, «★ 4.50 (N)», the place.
 * fish swipes the photos in a carousel; the web lays the (at most) three out at once — the first
 * large, the others stacked beside it — so nothing hides behind a gesture a mouse does not have.
 */


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

/** A lake page read for the card's extras: cached like the lake page's own (edge + 10 min here). */
const DETAIL_STALE_MS = 10 * 60 * 1000;

const plainName = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

/**
 * The results list's card: the horizontal LakeRowCard (owner rule 7) fed from the in-bbox lake,
 * plus what only the lake's page has (/feed/lakes/:id, read per card and edge-cached): its depth
 * (the «adâncime» fact) and its phone numbers (fish LakeContactSection — «Sună»). Both appear once
 * known, never guessed (rule 4). The price comes from the page's price index (LakesMap: every
 * lake of the map read, kept once known — in-bbox carries none); while that read is in flight the
 * price line holds a bone, a lake without a price has no price line.
 */
export function ResultLakeCard({
  lake,
  distanceLabel,
  photos,
  price,
  priceLoading = false,
}: {
  lake: LegacyLake;
  distanceLabel: string | null;
  photos: LakeImageSrc[];
  price?: { min?: number | null; max?: number | null } | null;
  /** The price index is still being read (and has none for this lake yet). */
  priceLoading?: boolean;
}) {
  const t = useMemo(() => createBrowserTransport(), []);
  const detail = useQuery({ ...lakeQuery(t, lake.documentId), staleTime: DETAIL_STALE_MS, gcTime: DETAIL_STALE_MS });
  const phones = (detail.data?.contact ?? []).filter((c): c is typeof c & { phone: string } => Boolean(c.phone?.trim()));
  const depth = detail.data?.depth ?? null;
  const [directions, setDirections] = useState(false);
  const [call, setCall] = useState(false);
  const location = getLakeLocationSubtitle(lake, { includeAddress: false });
  const reviews = lake.reviewsMeta && lake.reviewsMeta.count > 0 ? lake.reviewsMeta : null;
  const facilities = (lake.facility ?? []).map((f) => plainName(f.name));
  const species = [...new Set((lake.fishSpecies ?? []).flatMap((s) => (s.fish?.Name ? [s.fish.Name] : [])))];
  const coordinate = lake.coordinates ? { latitude: Number(lake.coordinates.lat), longitude: Number(lake.coordinates.long) } : null;
  const tags = [
    lake.bookingEnabled ? 'Rezervare online' : null,
    lake.regime ?? null,
    facilities.some((f) => /nocturn|noapte/.test(f)) ? 'Pescuit noaptea' : null,
    facilities.some((f) => /caban|casut|cazare/.test(f)) ? 'Cazare' : null,
  ].filter(Boolean) as string[];
  return (
    <>
      <LakeRowCard
        href={routes.lake(lake.documentId)}
        name={lake.name}
        rating={reviews ? { overall: reviews.overall ?? 0, count: reviews.count } : null}
        location={location}
        distanceLabel={distanceLabel}
        photos={photos}
        priceMin={price?.min}
        priceMax={price?.max}
        priceLoading={priceLoading && !price}
        surface={lake.surface}
        stands={lake.numberOfSeats}
        depth={depth}
        species={species}
        tags={tags}
        facilities={lake.facility ?? []}
        bookHref={lake.bookingEnabled ? routes.lakeBooking(lake.documentId) : null}
        onCall={phones.length ? () => setCall(true) : null}
        onDirections={coordinate ? () => setDirections(true) : null}
      />
      {coordinate ? <DirectionsDialog open={directions} onClose={() => setDirections(false)} name={lake.name} coordinate={coordinate} /> : null}
      {phones.length ? <CallDialog open={call} onClose={() => setCall(false)} name={lake.name} contacts={phones} /> : null}
    </>
  );
}

/** fish LakeContactSection's phone rows: each number, with its label, as a tel: link. */
function CallDialog({
  open,
  onClose,
  name,
  contacts,
}: {
  open: boolean;
  onClose: () => void;
  name: string;
  contacts: { id: number; header: string | null; name: string | null; phone: string }[];
}) {
  return (
    <Dialog open={open} onClose={onClose} title="Sună" subtitle={name} closeButton>
      <ul className="flex flex-col gap-2 pt-2">
        {contacts.map((c) => (
          <li key={c.id}>
            <a
              href={`tel:${c.phone.replace(/\s+/g, '')}`}
              className={cn(
                'flex min-h-14 items-center justify-between gap-3 rounded-control border border-hairline px-4 py-2.5',
                'transition-[background-color,opacity] duration-(--duration-fast) ease-fast hover:bg-soft-fill active:opacity-80',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
              )}
            >
              <span className="flex min-w-0 flex-col">
                <span className="t-caption text-muted">{c.header || 'Telefon'}</span>
                <span className="truncate t-body-strong text-ink">{c.name ? `${c.name} · ${c.phone}` : c.phone}</span>
              </span>
              <PhoneIcon aria-hidden className="size-5 shrink-0 stroke-2 text-accent-ink" />
            </a>
          </li>
        ))}
      </ul>
    </Dialog>
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

/** fish LakesListSkeleton variant «results»: one horizontal card per row (LakeRowCard's bones). */
export function ResultCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <ul aria-hidden className="flex flex-col gap-3">
      {Array.from({ length: count }, (_, i) => (
        <li key={i}>
          <LakeRowCardSkeleton />
        </li>
      ))}
    </ul>
  );
}
