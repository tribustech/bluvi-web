'use client';

import { ChevronLeftIcon, ChevronRightIcon, MapPinIcon, Squares2X2Icon, UserGroupIcon } from '@heroicons/react/24/outline';
import { StarIcon } from '@heroicons/react/20/solid';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { CardTitle, formatDecimal, formatInt } from '@/components/cards';
import { FishOutlineIcon } from '@/components/nav/brand';
import { buttonClass } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { blurDataUrl } from '@/lib/blurhash';
import type { LakeImageSrc } from './lakeImage';
import { SplitIcon } from './icons';

/*
 * The map view's list card (owner rule 7, ROADMAP §4b, refinement 2026-10-06 — imobiliare.ro): one
 * card per row, horizontal.
 * - Left: the photo (4:3, rounded) with gallery arrows and a «1 / N» counter.
 * - Right: the name and «★ 4,8 (12)», the signature number «de la 120 RON / tură» (only when the
 *   price is known — rule 4: never a made-up or empty price), the place and the distance, an icon
 *   row of key facts (suprafață, standuri, specii — each only when known), the tags (Rezervare
 *   online, the regime, facilities like Cazare) and the actions: «Rezervă» (primary) when booking is
 *   on, «Direcții» when the lake has coordinates. fish has no phone number in the list payload, so
 *   there is no «Sună» here.
 * The same card in the desktop list column and the phone's bottom sheet (narrower photo there).
 * The whole card is one link (the name's stretched link); the arrows and actions sit above it.
 */

export type LakeRowCardProps = {
  href: string;
  name: string;
  rating?: { overall: number; count: number } | null;
  location?: string | null;
  distanceLabel?: string | null;
  photos: LakeImageSrc[];
  priceMin?: number | null;
  priceMax?: number | null;
  /** Hectares. */
  surface?: number | null;
  stands?: number | null;
  speciesCount?: number;
  tags?: string[];
  /** «Rezervă»: the lake books in the app. */
  bookHref?: string | null;
  /** «Direcții» opens the directions dialog. */
  onDirections?: (() => void) | null;
  /** Selected on the map (T2ListItem draws the outline). */
  className?: string;
};

export function formatPrice(min?: number | null, max?: number | null): string | null {
  if (min != null && max != null && max !== min) return `${formatInt(min)}–${formatInt(max)}`;
  const one = min ?? max;
  return one != null ? formatInt(one) : null;
}

export function LakeRowCard({
  href,
  name,
  rating,
  location,
  distanceLabel,
  photos,
  priceMin,
  priceMax,
  surface,
  stands,
  speciesCount = 0,
  tags = [],
  bookHref,
  onDirections,
  className,
}: LakeRowCardProps) {
  const price = formatPrice(priceMin, priceMax);
  const ranged = priceMin != null && priceMax != null && priceMax !== priceMin;
  const facts = [
    surface != null && surface > 0 ? { icon: <Squares2X2Icon />, text: `${formatDecimal(surface, 0, 1)} ha`, sr: 'Suprafață' } : null,
    stands != null && stands > 0 ? { icon: <UserGroupIcon />, text: `${formatInt(stands)} standuri`, sr: null } : null,
    speciesCount > 0 ? { icon: <FishOutlineIcon />, text: speciesCount === 1 ? '1 specie' : `${speciesCount} specii`, sr: null } : null,
  ].filter(Boolean) as { icon: React.ReactNode; text: string; sr: string | null }[];

  return (
    <article
      data-lake-row-card=""
      className={cn(
        'group relative flex gap-3 rounded-card bg-surface p-2.5 shadow-[var(--shadow-e1),var(--shadow-e0)] md:gap-4 md:p-3',
        'transition-shadow duration-(--duration-fast) ease-fast hover:shadow-[var(--shadow-e2),var(--shadow-e0)] focus-within:shadow-[var(--shadow-e2),var(--shadow-e0)]',
        className,
      )}
    >
      <Gallery photos={photos} name={name} className="w-30 self-start sm:w-40 md:w-[42%] md:max-w-60" />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-start gap-2">
          <CardTitle href={href} className="line-clamp-2 min-w-0 flex-1 t-heading text-ink">
            {name}
          </CardTitle>
          {rating && rating.count > 0 ? (
            <p className="flex shrink-0 items-center gap-0.5 t-label text-ink">
              <StarIcon aria-hidden className="size-4 text-rating" />
              <span className="sr-only">Rating </span>
              {formatDecimal(rating.overall, 2, 2)}
              <span className="text-muted">
                {' '}
                ({rating.count}
                <span className="sr-only"> recenzii</span>)
              </span>
            </p>
          ) : null}
        </div>
        {price ? (
          <p className="flex items-baseline gap-1">
            {ranged ? null : <span className="t-caption text-muted">de la</span>}
            <span className="t-stat text-ink">{price}</span>
            <span className="t-caption text-muted">RON / tură</span>
          </p>
        ) : null}
        {location || distanceLabel ? (
          <p className="flex min-w-0 items-center gap-1 t-body text-ink-2">
            <MapPinIcon aria-hidden className="size-4 shrink-0 text-muted" />
            <span className="truncate">
              {location}
              {location && distanceLabel ? ' · ' : null}
              {distanceLabel ? (
                <span className="whitespace-nowrap">
                  <span className="sr-only">La </span>
                  {distanceLabel}
                </span>
              ) : null}
            </span>
          </p>
        ) : null}
        {facts.length ? (
          <ul aria-label="Pe scurt" className="flex flex-wrap gap-x-3 gap-y-1">
            {facts.map((f) => (
              <li key={f.text} className="flex items-center gap-1 t-caption text-ink-2 [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-accent-ink">
                {f.icon}
                {f.sr ? <span className="sr-only">{f.sr}: </span> : null}
                {f.text}
              </li>
            ))}
          </ul>
        ) : null}
        {tags.length ? (
          <ul aria-label="Etichete" className="flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <li key={t} className="inline-flex h-6 items-center rounded-full bg-accent-tint px-2 t-micro-strong text-accent-ink">
                {t}
              </li>
            ))}
          </ul>
        ) : null}
        {bookHref || onDirections ? (
          // Above the stretched link (z-above), so each action is its own target.
          <div className="relative z-above mt-auto flex flex-wrap gap-2 pt-1">
            {bookHref ? (
              <Link href={bookHref} className={buttonClass({ variant: 'primary', size: 'compact' })}>
                Rezervă
              </Link>
            ) : null}
            {onDirections ? (
              <button
                type="button"
                onClick={onDirections}
                aria-haspopup="dialog"
                className={buttonClass({ variant: 'secondary', size: 'compact', className: 'gap-1.5' })}
              >
                <SplitIcon className="size-4" />
                Direcții
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}

/** The card photo with its gallery: arrows (above the card link) and the «1 / N» counter. */
function Gallery({ photos, name, className }: { photos: LakeImageSrc[]; name: string; className?: string }) {
  const [i, setI] = useState(0);
  const n = photos.length;
  const photo = photos[Math.min(i, Math.max(0, n - 1))];
  const step = (d: number) => setI((v) => (v + d + n) % n);
  const arrow = 'absolute top-1/2 z-above flex size-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-surface text-ink shadow-e1 transition-opacity duration-(--duration-fast) ease-fast hover:bg-surface focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-accent md:opacity-0 md:group-hover:opacity-100';
  return (
    <div className={cn('relative aspect-4/3 shrink-0 overflow-hidden rounded-avatar bg-soft-fill md:rounded-control', className)}>
      {photo ? (
        <Image
          key={photo.src}
          src={photo.src}
          alt=""
          fill
          sizes="(min-width: 1280px) 240px, (min-width: 768px) 200px, 160px"
          className="object-cover"
          {...(photo.blurhash ? { placeholder: 'blur' as const, blurDataURL: blurDataUrl(photo.blurhash) } : {})}
        />
      ) : null}
      {n > 1 ? (
        <>
          <button type="button" onClick={() => step(-1)} aria-label={`${name}: fotografia anterioară`} className={cn(arrow, 'left-1.5')}>
            <ChevronLeftIcon aria-hidden className="size-4 stroke-2" />
          </button>
          <button type="button" onClick={() => step(1)} aria-label={`${name}: fotografia următoare`} className={cn(arrow, 'right-1.5')}>
            <ChevronRightIcon aria-hidden className="size-4 stroke-2" />
          </button>
          <span className="absolute right-1.5 bottom-1.5 rounded-full bg-photo-scrim px-1.5 t-micro-strong text-on-photo-scrim tabular-nums">
            <span className="sr-only">Fotografia </span>
            {i + 1} / {n}
          </span>
        </>
      ) : null}
    </div>
  );
}

/** The card's bones (same box: photo left, four text lines right). */
export function LakeRowCardSkeleton() {
  return (
    <div aria-hidden className="flex gap-3 rounded-card bg-surface p-2.5 shadow-[var(--shadow-e1),var(--shadow-e0)] md:gap-4 md:p-3">
      <span className="block aspect-4/3 w-30 shrink-0 animate-shimmer rounded-avatar sm:w-40 md:w-[42%] md:max-w-60 md:rounded-control" />
      <span className="flex flex-1 flex-col gap-2 pt-1">
        <span className="h-4 w-2/3 rounded-full bg-soft-fill" />
        <span className="h-5 w-1/3 rounded-full bg-soft-fill" />
        <span className="h-3.5 w-1/2 rounded-full bg-soft-fill" />
        <span className="h-3 w-3/4 rounded-full bg-soft-fill" />
      </span>
    </div>
  );
}
