'use client';

import { ArrowsUpDownIcon, ChevronLeftIcon, ChevronRightIcon, MapPinIcon, PhoneIcon, PhotoIcon, Squares2X2Icon, UserGroupIcon } from '@heroicons/react/24/outline';
import { StarIcon } from '@heroicons/react/20/solid';
import Image from 'next/image';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { CardTitle, formatDecimal, formatInt } from '@/components/cards';
import { FishOutlineIcon } from '@/components/nav/brand';
import { buttonClass } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { blurDataUrl } from '@/lib/blurhash';
import type { LakeImageSrc } from './lakeImage';
import { SplitIcon } from './icons';
import { FacilityIcons } from './LakeTile';

/** The facilities row of the card: more room than the grid tile's 4. */
const MAX_ROW_FACILITIES = 6;

/*
 * The map view's list card (owner rule 7, ROADMAP §4b, refinement 2026-10-06 — imobiliare.ro): one
 * card per row, horizontal, in four bands:
 * - the title row: the name and «★ 4,83 (2)», over a hairline;
 * - the photo on the left, flush with the card's edges (4:3), with gallery arrows and «1 / N»;
 * - on the right: the signature number «de la 120 RON / tură» (only when the price is known — rule
 *   4: never a made-up or empty price), the place and the distance, an icon row of key facts
 *   (suprafață, standuri, adâncime, specii — each only when known), the tags (Rezervare online, the regime, Pescuit noaptea, Cazare);
 * - the actions row: «Sună» when the lake has a phone number (fish LakeContactSection), «Direcții» when the lake has coordinates, «Rezervă» (primary, last) when the
 *   lake books in the app. fish has no chat or WhatsApp for a lake: no «Mesaj».
 * The same card in the desktop list column and the phone's bottom sheet (a grid: the actions move
 * under the photo row in a narrow card, beside the photo from a 512px-wide card). The whole card is one
 * link (the name's stretched link); the arrows and actions sit above it.
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
  /** The price is still being read: a neutral bone holds its line (rule 4), so nothing jumps. */
  priceLoading?: boolean;
  /** Hectares. */
  surface?: number | null;
  stands?: number | null;
  /** Metres, from the lake page (min / max). */
  depth?: { min: number | null; max: number | null } | null;
  /** The species' names (the facts row names the first two). */
  species?: string[];
  /** Only a count (the demo's lakes without names). Ignored when `species` is given. */
  speciesCount?: number;
  tags?: string[];
  /** The lake's facilities: a glyph row (up to 6, then «+N»), each named for screen readers. */
  facilities?: { id: number; name: string }[];
  /** «Rezervă»: the lake books in the app. */
  bookHref?: string | null;
  /** «Sună» opens the lake's phone numbers. */
  onCall?: (() => void) | null;
  /** «Direcții» opens the directions dialog. */
  onDirections?: (() => void) | null;
  /** Selected on the map (T2ListItem draws the outline). */
  className?: string;
};

/** «45», «45–90» (RON). */
export function formatPrice(min?: number | null, max?: number | null): string | null {
  if (min != null && max != null && max !== min) return `${formatInt(min)}–${formatInt(max)}`;
  const one = min ?? max;
  return one != null ? formatInt(one) : null;
}

/** «1,5–4 m», «până la 4 m», «de la 2 m». */
function depthText(depth: { min: number | null; max: number | null } | null | undefined): string | null {
  if (!depth) return null;
  const n = (v: number) => formatDecimal(v, 0, 1);
  const { min, max } = depth;
  if (min != null && max != null) return min === max ? `${n(max)} m` : `${n(min)}–${n(max)} m`;
  if (max != null) return `până la ${n(max)} m`;
  if (min != null) return `de la ${n(min)} m`;
  return null;
}

/** The facts row's species: «Crap, Somn +3». */
function speciesText(names: string[]): string {
  const shown = names.slice(0, 2).join(', ');
  return names.length > 2 ? `${shown} +${names.length - 2}` : shown;
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
  priceLoading = false,
  surface,
  stands,
  depth,
  species,
  speciesCount = 0,
  tags = [],
  facilities = [],
  bookHref,
  onCall,
  onDirections,
  className,
}: LakeRowCardProps) {
  // The signature number is the lowest price («de la»): the range belongs to the lake page.
  const from = priceMin ?? priceMax ?? null;
  const nSpecies = species ? species.length : speciesCount;
  const facts = [
    surface != null && surface > 0 ? { icon: <Squares2X2Icon />, text: `${formatDecimal(surface, 0, 1)} ha`, sr: 'Suprafață' } : null,
    stands != null && stands > 0 ? { icon: <UserGroupIcon />, text: `${formatInt(stands)} standuri`, sr: null } : null,
    depthText(depth) ? { icon: <ArrowsUpDownIcon />, text: depthText(depth)!, sr: 'Adâncime' } : null,
    nSpecies > 0
      ? {
          icon: <FishOutlineIcon />,
          text: species?.length ? speciesText(species) : nSpecies === 1 ? '1 specie' : `${nSpecies} specii`,
          sr: species?.length ? 'Specii' : null,
        }
      : null,
  ].filter(Boolean) as { icon: ReactNode; text: string; sr: string | null }[];
  const hasActions = Boolean(bookHref || onCall || onDirections);

  return (
    <article
      data-lake-row-card=""
      className={cn(
        // Sized by its own width (a container), not the window: the list column is ~335px at 768
        // and ~900px at 1920, the phone sheet ~343px.
        'group @container relative overflow-hidden rounded-card bg-surface shadow-[var(--shadow-e1),var(--shadow-e0)]',
        'transition-shadow duration-(--duration-fast) ease-fast hover:shadow-[var(--shadow-e2),var(--shadow-e0)] focus-within:shadow-[var(--shadow-e2),var(--shadow-e0)]',
        className,
      )}
    >
      <div
        className={cn(
          // The photo grows with the column (a wide list is not a 288px photo beside an empty band).
          // From a 512px card the info and the actions share the right column; the actions' row
          // takes the slack and they sit at its foot (imobiliare.ro): their baseline is the photo's
          // bottom edge, never a blank strip under the buttons when the photo is the taller side.
          'grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] @lg:grid-cols-[minmax(0,clamp(12rem,40%,24rem))_minmax(0,1fr)] @lg:grid-rows-[auto_auto_1fr]',
          "[grid-template-areas:'title_title'_'photo_info'_'actions_actions'] @lg:[grid-template-areas:'title_title'_'photo_info'_'photo_actions']",
        )}
      >
      {/* The title row. */}
      <div className="flex min-w-0 items-start gap-3 border-b border-hairline px-3 py-2.5 [grid-area:title] md:px-4 md:py-3">
        <CardTitle href={href} className="line-clamp-2 min-w-0 flex-1 t-heading text-ink">
          {name}
        </CardTitle>
        {rating && rating.count > 0 ? (
          <p className="flex shrink-0 items-center gap-0.5 pt-0.5 t-label text-ink">
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

      <Gallery photos={photos} name={name} className="[grid-area:photo]" />

      {/* The right: the price, the place, the facts, the tags. */}
      <div data-row-info="" className="flex min-w-0 flex-col gap-1.5 p-3 [grid-area:info] md:gap-2 md:px-4">
        {from != null ? (
          <p className="flex flex-wrap items-baseline gap-x-1.5 text-ink">
            <span className="t-caption text-muted">de la</span>
            <span className="t-display tabular-nums tracking-tight">{formatInt(from)}</span>
            <span className="t-body-strong text-ink-2">RON / tură</span>
          </p>
        ) : priceLoading ? (
          // The price line's box (t-display), a bone in it: the line the price will take.
          <p aria-hidden className="flex items-center t-display">
            <span className="h-[0.75lh] w-28 animate-shimmer rounded-full" />
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
          <ul aria-label="Pe scurt" className="flex flex-wrap gap-x-3.5 gap-y-1">
            {facts.map((f) => (
              <li key={f.text} className="flex min-w-0 items-center gap-1 t-caption text-ink-2 [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-accent-ink">
                {f.icon}
                {f.sr ? <span className="sr-only">{f.sr}: </span> : null}
                <span className="truncate">{f.text}</span>
              </li>
            ))}
          </ul>
        ) : null}
        {facilities.length ? (
          <FacilityIcons shown={facilities.slice(0, MAX_ROW_FACILITIES)} more={Math.max(0, facilities.length - MAX_ROW_FACILITIES)} />
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
      </div>

      {/* The actions row, above the stretched link (z-above) so each one is its own target. */}
      {hasActions ? (
        <div className="relative z-above flex flex-wrap items-end justify-end gap-2 border-t border-hairline px-3 py-2.5 [grid-area:actions] @lg:self-end @lg:border-t-0 @lg:px-4 @lg:pt-1 @lg:pb-3">
          {onCall ? (
            <button type="button" onClick={onCall} aria-haspopup="dialog" className={buttonClass({ variant: 'secondary', size: 'compact', className: 'gap-1.5' })}>
              <PhoneIcon aria-hidden className="size-4 stroke-2" />
              Sună
            </button>
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
          {bookHref ? (
            <Link href={bookHref} className={buttonClass({ variant: 'primary', size: 'compact' })}>
              Rezervă
            </Link>
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
  const arrow =
    'absolute top-1/2 z-above flex size-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-surface text-ink shadow-e1 transition-opacity duration-(--duration-fast) ease-fast hover:bg-surface focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-accent md:opacity-0 md:group-hover:opacity-100';
  return (
    // Flush with the card (its corner rounds it): a 4:3 floor, taller when the right side is.
    <div className={cn('relative min-h-full self-stretch overflow-hidden bg-soft-fill', className)}>
      <div className="aspect-4/3" />
      {photo ? (
        <Image
          key={photo.src}
          src={photo.src}
          alt=""
          fill
          sizes="(min-width: 1280px) 384px, (min-width: 768px) 260px, 150px"
          className="object-cover"
          {...(photo.blurhash ? { placeholder: 'blur' as const, blurDataURL: blurDataUrl(photo.blurhash) } : {})}
        />
      ) : null}
      {n > 1 ? (
        <>
          <button type="button" onClick={() => step(-1)} aria-label={`${name}: fotografia anterioară`} className={cn(arrow, 'left-2')}>
            <ChevronLeftIcon aria-hidden className="size-4 stroke-2" />
          </button>
          <button type="button" onClick={() => step(1)} aria-label={`${name}: fotografia următoare`} className={cn(arrow, 'right-2')}>
            <ChevronRightIcon aria-hidden className="size-4 stroke-2" />
          </button>
        </>
      ) : null}
      {n > 1 ? (
        <span className="absolute right-2 bottom-2 flex items-center gap-1 rounded-full bg-photo-scrim px-2 py-0.5 t-micro-strong text-on-photo-scrim tabular-nums">
          <PhotoIcon aria-hidden className="size-3.5 stroke-2" />
          <span className="sr-only">Fotografia </span>
          {i + 1} / {n}
        </span>
      ) : null}
    </div>
  );
}

/** The card's bones (same bands: the title row, the photo left, the text lines right). */
export function LakeRowCardSkeleton() {
  return (
    <div aria-hidden className="overflow-hidden rounded-card bg-surface shadow-[var(--shadow-e1),var(--shadow-e0)]">
      <span className="flex border-b border-hairline px-3 py-3.5 md:px-4">
        <span className="h-4 w-1/2 rounded-full bg-soft-fill" />
      </span>
      <span className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <span className="block aspect-4/3 animate-shimmer" />
        <span className="flex flex-col gap-2.5 p-3 md:px-4">
          <span className="h-6 w-2/5 rounded-full bg-soft-fill" />
          <span className="h-3.5 w-1/2 rounded-full bg-soft-fill" />
          <span className="h-3 w-3/4 rounded-full bg-soft-fill" />
          <span className="h-5 w-1/3 rounded-full bg-soft-fill" />
        </span>
      </span>
    </div>
  );
}
