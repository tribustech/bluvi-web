import Image from 'next/image';
import { StarIcon } from '@heroicons/react/20/solid';
import { getLakeLocationSubtitle, type LakeCard } from '@/core/lakes';
import { CardShell, CardTitle, formatDecimal, Pill } from '@/components/cards';
import { routes } from '@/lib/routes';
import { facilityIcon } from './facilityIcon';

// fish lakesHomeCardPresentation: four facility icons, then «+N».
const MAX_FACILITIES = 4;

/**
 * The card's height per breakpoint (photo 100 + name + place + the facilities row; the
 * type steps grow from 1280). Its rail skeleton uses the same class, so they cannot disagree.
 */
export const LAKE_CARD_HEIGHT = 'h-48 xl:h-49';

/**
 * fish components/MiniatureLakeCard.tsx as Acasă configures it (lakesHomeCardPresentation: the
 * rating as a badge on the photo, only when the lake has reviews; facilities as icons only, at most
 * four, then «+N»; no regime, no species). The kit LakeCard has no facilities row and shows price
 * instead, so the home variant is composed here from the kit shell and its photo Pill.
 */
export function HomeLakeCard({ lake }: { lake: LakeCard }) {
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
    // A fixed rhythm instead of stretching to the rail's tallest card, the same three lines on every
    // card: the name (full width), the place, and the facilities row (kept at its height when a
    // lake lists none, so every card in the rail has the same height).
    <CardShell elevated interactive className={LAKE_CARD_HEIGHT}>
      <div className="relative h-25 shrink-0 overflow-hidden bg-soft-fill">
        {src ? <Image src={src} alt="" fill sizes="(min-width: 768px) 272px, 200px" className="object-cover" /> : null}
        {hasReviews ? (
          // fish: the white rating badge, top-right on the photo.
          <Pill tone="light" className="absolute top-2 right-2 shadow-e1">
            <StarIcon aria-hidden className="size-3.5 text-rating" />
            <span className="sr-only">Rating </span>
            {formatDecimal(lake.reviewsMeta!.overall ?? 0, 1, 1)}
          </Pill>
        ) : null}
      </div>
      <div className="flex flex-col gap-1 p-2.5">
        <CardTitle href={routes.lake(lake.documentId)} className="line-clamp-1 t-body-strong text-ink">
          {lake.name}
        </CardTitle>
        <p className="line-clamp-1 min-h-[1lh] t-body text-ink-2">{location}</p>
        <div className="flex h-6 items-center">
          {facilities.length > 0 ? (
            <ul className="flex items-center gap-1" aria-label="Facilități">
              {facilities.map((f) => {
                const Icon = facilityIcon(f.name);
                return (
                  <li key={f.id} className="flex size-6 items-center justify-center text-accent-ink" title={f.name}>
                    <Icon aria-hidden className="size-6" />
                    <span className="sr-only">{f.name}</span>
                  </li>
                );
              })}
              {more > 0 ? (
                <li className="flex h-6 min-w-6 items-center justify-center t-micro-strong text-ink-2">
                  +{more}
                  <span className="sr-only"> facilități</span>
                </li>
              ) : null}
            </ul>
          ) : null}
        </div>
      </div>
    </CardShell>
  );
}
