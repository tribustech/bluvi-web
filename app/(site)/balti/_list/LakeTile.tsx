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
 * The card is as tall as its content (owner rule 5: no empty footer space): the hairline +
 * facilities + regime block sits right under the place line, never pushed to a fixed-height foot,
 * so a card without facilities or with a one-line name is simply shorter and a rail's row height
 * varies. The name takes up to 2 lines (fish allows 4).
 *
 * LakeTileRow: the same lake as one compact row (thumbnail, text beside it) — a phone section too
 * short to fill a rail (rule 5: no near-empty rails).
 */

export const MAX_FACILITIES = 4;

/**
 * The skeleton's height per variant (the cards size to their content): a one-line name with the
 * facilities and the regime. Default: photo 116 + padding 20 + name 20 (22) + place 20 (22) + gaps
 * 8 + foot (hairline, facilities 24, regime) ≈ 49 (51). Compact: photo 106 + padding 20 + name + place + gap.
 */
export const TILE_HEIGHT = { default: 'h-59 xl:h-61', compact: 'h-43 xl:h-45' } as const;

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
    <CardShell elevated interactive>
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
      <div className="flex flex-col gap-1 p-2.5">
        <CardTitle href={routes.lake(lake.documentId)} className="line-clamp-2 shrink-0 t-body-strong text-ink">
          {lake.name}
        </CardTitle>
        <p className="line-clamp-1 min-h-[1lh] shrink-0 t-body text-ink-2">{location}</p>
        {compact ? null : (
          // Right under the place line (rule 5): no band reserved for a missing facilities row.
          <div className="flex shrink-0 flex-col gap-1 border-t border-hairline pt-1">
            {shown.length ? <FacilityIcons shown={shown} more={more} /> : null}
            {lake.regime ? <Regime regime={lake.regime} /> : null}
          </div>
        )}
      </div>
    </CardShell>
  );
}

/**
 * A lake as one compact row (rule 5: a phone section too short to fill a rail is not a rail): the
 * thumbnail, then the name with «★ 4,5», the place (with the distance on the nearby row) and — in
 * the default variant — the facility glyphs and the regime. The whole row is the name's link.
 */
export function LakeTileRow({
  lake,
  variant = 'default',
  distanceLabel,
}: {
  lake: LakeHomeSectionLake;
  variant?: 'default' | 'compact';
  distanceLabel?: string | null;
}) {
  const image = lakeImage(lake);
  const location = getLakeLocationSubtitle(
    { county: lake.county ?? null, countyRef: lake.countyRef ?? null, cityRef: lake.cityRef ?? null },
    { includeAddress: false },
  );
  const reviews = lake.reviewsMeta && lake.reviewsMeta.count > 0 ? lake.reviewsMeta : null;
  const facilities = lake.facility ?? [];
  const shown = facilities.slice(0, MAX_FACILITIES);
  const foot = variant === 'default' && (shown.length > 0 || Boolean(lake.regime));
  return (
    <article
      className={cn(
        'relative flex items-center gap-3 overflow-hidden rounded-card bg-surface p-2 pr-3 shadow-[var(--shadow-e1),var(--shadow-e0)]',
        'transition-shadow duration-(--duration-fast) ease-fast hover:shadow-[var(--shadow-e2),var(--shadow-e0)] focus-within:shadow-[var(--shadow-e2),var(--shadow-e0)]',
      )}
    >
      <div className="relative aspect-4/3 w-24 shrink-0 overflow-hidden rounded-control bg-soft-fill">
        {image ? (
          <Image
            src={image.src}
            alt=""
            fill
            sizes="96px"
            className="object-cover"
            {...(image.blurhash ? { placeholder: 'blur' as const, blurDataURL: blurDataUrl(image.blurhash) } : {})}
          />
        ) : null}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex min-w-0 items-start gap-2">
          <CardTitle href={routes.lake(lake.documentId)} className="line-clamp-1 min-w-0 flex-1 t-body-strong text-ink">
            {lake.name}
          </CardTitle>
          {reviews ? (
            <p className="flex shrink-0 items-center gap-0.5 t-caption text-ink">
              <StarIcon aria-hidden className="size-3.5 text-rating" />
              <span className="sr-only">Rating </span>
              {formatDecimal(reviews.overall ?? 0, 1, 1)}
            </p>
          ) : null}
        </div>
        <p className="line-clamp-1 t-caption text-ink-2">
          {distanceLabel ? (
            <span className="font-semibold text-ink">
              <span className="sr-only">La </span>
              {distanceLabel}
              {location ? ' · ' : null}
            </span>
          ) : null}
          {location}
        </p>
        {foot ? (
          <div className="flex min-w-0 items-center gap-2 pt-0.5">
            {shown.length ? <FacilityIcons shown={shown} more={facilities.length - shown.length} className="shrink-0" /> : null}
            {lake.regime ? <Regime regime={lake.regime} /> : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}

/** Up to MAX_FACILITIES facility glyphs then «+N» (lakes.home.c14) — the tile and the grid card. */
export function FacilityIcons({ shown, more, className }: { shown: NonNullable<LakeHomeSectionLake['facility']>; more: number; className?: string }) {
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
    <p className="flex min-h-[1lh] min-w-0 items-center gap-1 t-caption text-ink-2">
      <FishOutlineIcon className="size-4 shrink-0 text-accent-ink" />
      <span className="sr-only">Regim: </span>
      <span className="truncate">{regime}</span>
    </p>
  );
}
