import Image from 'next/image';
import { StarIcon } from '@heroicons/react/20/solid';
import { getLakeLocationSubtitle, type LakeCard } from '@/core/lakes';
import { CardShell, CardTitle, formatDecimal } from '@/components/cards';
import { cn } from '@/components/ui/cn';
import { routes } from '@/lib/routes';
import { facilityIcon } from './facilityIcon';

const MAX_FACILITIES = 4;

/**
 * fish components/MiniatureLakeCard.tsx as Acasă configures it (facilities as icons only, at most
 * four, then «+N»; no regime, no species). The kit LakeCard has no facilities row and shows price
 * instead, so the home variant is composed here from the kit shell.
 */
export function HomeLakeCard({ lake, variant = 'rail' }: { lake: LakeCard; variant?: 'rail' | 'grid' }) {
  const image = lake.images[0];
  const src = image ? (image.mediumUrl ?? image.url) : null;
  const location = getLakeLocationSubtitle(
    { county: lake.county, countyRef: lake.countyRef ?? null, cityRef: lake.cityRef ?? null },
    { includeAddress: false }
  );
  const hasReviews = !!lake.reviewsMeta && lake.reviewsMeta.count > 0;
  const facilities = lake.facility.slice(0, MAX_FACILITIES);
  const more = lake.facility.length - facilities.length;

  return (
    <CardShell elevated interactive className="h-full">
      <div className={cn('relative shrink-0 overflow-hidden bg-soft-fill', variant === 'grid' ? 'h-[130px]' : 'h-[100px] rounded-control')}>
        {src ? <Image src={src} alt="" fill sizes="(min-width: 1280px) 260px, 200px" className="object-cover" /> : null}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-2.5 xl:p-3">
        <div className="flex items-start gap-1">
          <CardTitle href={routes.lake(lake.documentId)} className="min-w-0 flex-1 t-body-strong text-ink">
            {lake.name}
          </CardTitle>
          {hasReviews ? (
            <p className="flex shrink-0 items-center gap-0.5 t-label text-ink">
              <StarIcon aria-hidden className="size-3.5 text-rating" />
              <span className="sr-only">Rating </span>
              {formatDecimal(lake.reviewsMeta!.overall ?? 0, 1, 1)}
            </p>
          ) : null}
        </div>
        {location ? <p className="t-body text-ink-2 xl:t-caption">{location}</p> : null}
        {facilities.length > 0 ? (
          <ul className="mt-auto flex items-center gap-1 pt-0.5" aria-label="Facilități">
            {facilities.map((f) => {
              const Icon = facilityIcon(f.name);
              return (
                <li key={f.id} className="flex size-5 items-center justify-center text-accent-ink" title={f.name}>
                  <Icon aria-hidden className="size-[13px] stroke-[1.8]" />
                  <span className="sr-only">{f.name}</span>
                </li>
              );
            })}
            {more > 0 ? (
              <li className="flex h-5 min-w-5 items-center justify-center t-micro-strong text-ink-2">
                +{more}
                <span className="sr-only"> facilități</span>
              </li>
            ) : null}
          </ul>
        ) : null}
      </div>
    </CardShell>
  );
}
