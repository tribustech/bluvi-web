import { StarIcon } from '@heroicons/react/20/solid';
import Image from 'next/image';
import { CardShell, CardTitle, formatDecimal, Pill } from '@/components/cards';
import { cn } from '@/components/ui/cn';
import { getLakeLocationSubtitle, type LakeHomeSectionLake } from '@/core/lakes';
import { routes } from '@/lib/routes';
import { facilityIcon } from '@/app/(site)/_home/facilityIcon';
import { blurDataUrl } from '@/lib/blurhash';
import { FishOutlineIcon } from '@/components/nav/brand';
import { lakeImage } from './lakeImage';

/*
 * fish components/MiniatureLakeCard.tsx as the Bălți home configures it
 * (lakesHomeCardPresentation, lakes.home.c14/c15):
 * - default: the first photo over its blurhash, a white «★ 4.5» pill on the photo only when the
 *   lake has reviews, the dark distance pill on the nearby row, the name, the county/city line, up
 *   to 4 facility icons then «+N», and the fishing regime;
 * - compact («Vizualizate recent»): narrower, the photo, name and place only.
 * Every card of a variant has one height (TILE_HEIGHT), so the cards of a rail end together and the
 * skeleton matches them; the hairline + facilities + regime block sits on the card foot. The name
 * takes up to 2 lines (fish allows 4) and the height is sized for that, so no line is squeezed:
 * the name and the place never shrink below their line box (descenders, the comma under ș/ț).
 */

const MAX_FACILITIES = 4;

/**
 * Card heights per variant, sized for a 2-line name (the t-* steps grow from 1280). Default: photo
 * 116 + padding 20 + name 2×20 (2×22) + place 20 (22) + gaps 8 + foot (hairline, facilities 24,
 * regime) ≈ 49 (51). Compact: photo 106 + padding 20 + name + place + gap. Shared with the skeleton.
 */
export const TILE_HEIGHT = { default: 'h-64 xl:h-66', compact: 'h-48 xl:h-50' } as const;

export function LakeTile({
  lake,
  variant = 'default',
  distanceLabel,
}: {
  lake: LakeHomeSectionLake;
  variant?: 'default' | 'compact';
  /** «7.4 km» on the nearby row. */
  distanceLabel?: string | null;
}) {
  const compact = variant === 'compact';
  const image = lakeImage(lake);
  const location = getLakeLocationSubtitle(
    { county: lake.county ?? null, countyRef: lake.countyRef ?? null, cityRef: lake.cityRef ?? null },
    { includeAddress: false },
  );
  const reviews = lake.reviewsMeta && lake.reviewsMeta.count > 0 ? lake.reviewsMeta : null;
  const facilities = lake.facility ?? [];
  const shown = facilities.slice(0, MAX_FACILITIES);
  const more = facilities.length - shown.length;

  return (
    <CardShell elevated interactive className={TILE_HEIGHT[variant]}>
      <div className={cn('relative shrink-0 overflow-hidden bg-soft-fill', compact ? 'h-26.5' : 'h-29')}>
        {image ? (
          <Image
            src={image.src}
            alt=""
            fill
            sizes="(min-width: 768px) 240px, 200px"
            className="object-cover"
            {...(image.blurhash ? { placeholder: 'blur' as const, blurDataURL: blurDataUrl(image.blurhash) } : {})}
          />
        ) : null}
        {distanceLabel ? (
          <Pill tone="scrim" className="absolute top-2 left-2">
            <span className="sr-only">La </span>
            {distanceLabel}
          </Pill>
        ) : null}
        {reviews ? (
          <Pill tone="light" className="absolute top-2 right-2 shadow-e1">
            <StarIcon aria-hidden className="size-3.5 text-rating" />
            <span className="sr-only">Rating </span>
            {formatDecimal(reviews.overall ?? 0, 1, 1)}
          </Pill>
        ) : null}
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-1 p-2.5">
        <CardTitle href={routes.lake(lake.documentId)} className="line-clamp-2 shrink-0 t-body-strong text-ink">
          {lake.name}
        </CardTitle>
        <p className="line-clamp-1 min-h-[1lh] shrink-0 t-body text-ink-2">{location}</p>
        {compact ? null : (
          // Pinned to the card foot: with or without facilities the regime ends on the same line
          // across a rail (the card's height is TILE_HEIGHT), and no empty row is reserved.
          <div className="mt-auto flex shrink-0 flex-col gap-1 border-t border-hairline pt-1">
            {shown.length ? <FacilityIcons shown={shown} more={more} /> : null}
            {lake.regime ? <Regime regime={lake.regime} /> : null}
          </div>
        )}
      </div>
    </CardShell>
  );
}

function FacilityIcons({ shown, more, className }: { shown: NonNullable<LakeHomeSectionLake['facility']>; more: number; className?: string }) {
  return (
    <ul className={cn('flex h-6 items-center gap-1', className)} aria-label="Facilități">
      {shown.map((f) => {
        const Icon = facilityIcon(f.name);
        return (
          <li key={f.id} title={f.name} className="flex size-5.5 items-center justify-center rounded-full bg-soft-fill text-accent-ink">
            <Icon aria-hidden className="size-3.5" />
            <span className="sr-only">{f.name}</span>
          </li>
        );
      })}
      {more > 0 ? (
        <li className="flex h-5.5 min-w-5.5 items-center justify-center rounded-full bg-soft-fill px-1 t-micro-strong text-ink-2">
          +{more}
          <span className="sr-only"> facilități</span>
        </li>
      ) : null}
    </ul>
  );
}

function Regime({ regime }: { regime: string }) {
  return (
    <p className="flex min-h-[1lh] items-center gap-1 t-caption text-ink-2">
      <FishOutlineIcon className="size-4 shrink-0 text-accent-ink" />
      <span className="sr-only">Regim: </span>
      <span className="truncate">{regime}</span>
    </p>
  );
}
