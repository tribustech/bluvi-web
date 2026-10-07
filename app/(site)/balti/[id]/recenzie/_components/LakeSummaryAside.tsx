import Image from 'next/image';
import Link from 'next/link';
import { MapPinIcon, PhotoIcon } from '@heroicons/react/24/outline';
import { formatReviewsCount } from '@/core/lakes';
import { cn } from '@/components/ui/cn';
import { routes } from '@/lib/routes';
import { RatingStars, ratingText } from '../../_components/RatingStars';

/** What the form shows of the lake it reviews (page.tsx reads it from the cached public lake). */
export type LakeSummary = {
  documentId: string;
  name: string;
  /** fish LakeHero's order: medium → original → small. */
  photo: string | null;
  location: string | null;
  /** null: no review yet — no rating row (never «0 din 5»). */
  rating: { overall: number; count: number } | null;
};

/**
 * The right column from 1280 (T4Frame `aside`): the lake being reviewed, Airbnb's «listing card»
 * beside the review form — photo 4:3, the name (a link back to the lake), the location line and the
 * lake's current rating. Below 1280 the header's eyebrow carries the name instead.
 */
export function LakeSummaryAside({ lake }: { lake: LakeSummary }) {
  return (
    <section aria-label="Balta evaluată" className="flex flex-col overflow-hidden rounded-card bg-surface shadow-e0" data-testid="review-lake-summary">
      <div className="relative aspect-4/3 w-full bg-soft-fill">
        {lake.photo ? (
          <Image src={lake.photo} alt="" fill sizes="360px" className="object-cover" />
        ) : (
          <span aria-hidden className="flex size-full items-center justify-center text-faint">
            <PhotoIcon className="size-10" />
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1.5 p-5 xl:p-6">
        <p className="t-eyebrow text-muted uppercase">Recenzia ta pentru</p>
        <h2 className="t-title2 text-ink">
          <Link href={routes.lake(lake.documentId)} className={cn('rounded-control hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent')}>
            {lake.name}
          </Link>
        </h2>
        {lake.location ? (
          <p className="t-body flex items-start gap-1.5 text-muted">
            <MapPinIcon aria-hidden className="mt-0.5 size-5 shrink-0" />
            <span className="min-w-0">{lake.location}</span>
          </p>
        ) : null}
        {lake.rating ? (
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1" data-testid="review-lake-rating">
            <RatingStars value={lake.rating.overall} size="sm" />
            <span className="t-body-strong text-ink tabular-nums">{ratingText(lake.rating.overall)}</span>
            <span aria-hidden className="text-faint">
              ·
            </span>
            <span className="t-body text-muted">{formatReviewsCount(lake.rating.count)}</span>
          </p>
        ) : null}
      </div>
    </section>
  );
}

/** The aside's grey shape while the screen loads (photo, eyebrow, name, location). */
export function LakeSummaryAsideSkeleton() {
  return (
    <div aria-hidden className="flex flex-col overflow-hidden rounded-card bg-surface shadow-e0">
      <span className="aspect-4/3 w-full animate-shimmer" />
      <span className="flex flex-col gap-2.5 p-5 xl:p-6">
        <span className="h-3 w-28 animate-shimmer rounded-full" />
        <span className="h-5 w-44 animate-shimmer rounded-full" />
        <span className="h-4 w-56 max-w-full animate-shimmer rounded-full" />
      </span>
    </div>
  );
}
