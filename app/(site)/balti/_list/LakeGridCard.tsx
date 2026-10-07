import Image from 'next/image';
import { CardTitle, Pill } from '@/components/cards';
import { cn } from '@/components/ui/cn';
import { getLakeLocationSubtitle, type LakeHomeSectionLake } from '@/core/lakes';
import { routes } from '@/lib/routes';
import { blurDataUrl } from '@/lib/blurhash';
import { lakeImage } from './lakeImage';
import { FacilityIcons, MAX_FACILITIES } from './LakeTile';
import { RatingInline } from './RatingInline';

/*
 * The Bălți grid card (owner rule 5, ROADMAP §4b, 2026-10-06): Airbnb's listing card — a 4:3
 * photo with rounded corners, the text right under it, no card box and no empty footer band. The
 * whole card is one link (the name's stretched link). Line 1: the name and, when the lake has
 * reviews, «★ 4,8 (2)» on the right (RatingInline, shared with LakeRowCard); line 2: county / city;
 * line 3: up to 4 facility glyphs and «+N» (fish MiniatureLakeCard, lakes.home.c14 — LakeTile's
 * row); line 4: the regime and, when the lake books in the app, «Rezervare online» in the accent —
 * on its own line and never truncated (the booking signal is the last thing to cut: a long regime
 * gives way first). The distance pill sits on the photo when the lake is in the nearby set.
 */

export function LakeGridCard({
  lake,
  distanceLabel,
  priority = false,
}: {
  lake: LakeHomeSectionLake;
  distanceLabel?: string | null;
  /** The first row of the grid: the browser loads those photos first (LCP). */
  priority?: boolean;
}) {
  const image = lakeImage(lake);
  const location = getLakeLocationSubtitle(
    { county: lake.county ?? null, countyRef: lake.countyRef ?? null, cityRef: lake.cityRef ?? null },
    { includeAddress: false },
  );
  const reviews = lake.reviewsMeta && lake.reviewsMeta.count > 0 ? lake.reviewsMeta : null;
  const bookable = 'bookingEnabled' in lake && lake.bookingEnabled === true;
  const facilities = lake.facility ?? [];
  const shown = facilities.slice(0, MAX_FACILITIES);

  return (
    <article className="group relative flex min-w-0 flex-col gap-2.5">
      <div className="relative aspect-4/3 overflow-hidden rounded-card bg-soft-fill">
        {image ? (
          <Image
            src={image.src}
            alt=""
            fill
            priority={priority}
            sizes="(min-width: 1280px) 300px, (min-width: 768px) 33vw, 50vw"
            className="object-cover transition-transform duration-(--duration-medium) ease-slow group-hover:scale-[1.03] motion-reduce:transition-none"
            {...(image.blurhash ? { placeholder: 'blur' as const, blurDataURL: blurDataUrl(image.blurhash) } : {})}
          />
        ) : null}
        {distanceLabel ? (
          <Pill tone="scrim" className="absolute top-2.5 left-2.5">
            <span className="sr-only">La </span>
            {distanceLabel}
          </Pill>
        ) : null}
      </div>
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="flex min-w-0 items-start gap-2">
          <CardTitle href={routes.lake(lake.documentId)} className="line-clamp-1 min-w-0 flex-1 t-body-strong text-ink">
            {lake.name}
          </CardTitle>
          {reviews ? <RatingInline overall={reviews.overall ?? 0} count={reviews.count} className="t-body" /> : null}
        </div>
        <p className="line-clamp-1 t-body text-ink-2">{location}</p>
        {shown.length ? <FacilityIcons shown={shown} more={facilities.length - shown.length} className="pt-0.5" /> : null}
        {lake.regime || bookable ? (
          <p className="flex min-w-0 items-baseline gap-1 t-caption text-muted">
            {lake.regime ? <span className="min-w-0 truncate">{lake.regime}</span> : null}
            {lake.regime && bookable ? <span aria-hidden>·</span> : null}
            {bookable ? <span className="shrink-0 text-accent-ink">Rezervare online</span> : null}
          </p>
        ) : null}
      </div>
    </article>
  );
}

/** The card's bones, on the same box (photo 4:3, then the three text lines at their line heights). */
export function LakeGridCardSkeleton({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn('flex flex-col gap-2.5', className)}>
      <div className="aspect-4/3 animate-shimmer rounded-card" />
      <div className="flex flex-col gap-0.5">
        <div className="flex h-[1lh] items-center t-body-strong">
          <span className="h-4 w-3/4 animate-shimmer rounded-full" />
        </div>
        <div className="flex h-[1lh] items-center t-body">
          <span className="h-3.5 w-1/2 animate-shimmer rounded-full" />
        </div>
        <div className="flex h-6 items-center pt-0.5">
          <span className="h-5 w-1/3 animate-shimmer rounded-full" />
        </div>
        <div className="flex h-[1lh] items-center t-caption">
          <span className="h-3 w-2/5 animate-shimmer rounded-full" />
        </div>
      </div>
    </div>
  );
}

/**
 * The grid: auto-fill tracks — more columns as the screen grows, never wider cards (ROADMAP §4).
 * 768–1023 tracks from 13rem, so a tablet gets 3 columns (rule 5: a dense grid); 15rem from 1024.
 */
export const LAKE_GRID = 'grid grid-cols-[repeat(auto-fill,minmax(min(100%,10rem),1fr))] gap-x-3 gap-y-6 md:grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] lg:grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] md:gap-x-6 md:gap-y-8';

