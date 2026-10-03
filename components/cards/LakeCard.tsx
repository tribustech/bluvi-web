import { StarIcon } from '@heroicons/react/20/solid';
import { CardPhoto, CardShell, CardTitle } from './CardShell';
import { formatDecimal, formatInt } from './format';
import { Pill } from './parts';

export type LakeCardProps = {
  name: string;
  /** "Cornu, Prahova" */
  locationLabel: string;
  species?: ReadonlyArray<string>;
  /** Average rating 0–5; null hides it (no reviews yet). */
  rating?: number | null;
  priceMin?: number | null;
  priceMax?: number | null;
  /** "RON / tură" */
  priceUnit?: string;
  onlineBooking?: boolean;
  imageSrc: string;
  imageBlurDataURL?: string;
  href?: string;
};

/** Fundații §07 card · baltă. */
export function LakeCard({
  name,
  locationLabel,
  species = [],
  rating,
  priceMin,
  priceMax,
  priceUnit = 'RON / tură',
  onlineBooking = false,
  imageSrc,
  imageBlurDataURL,
  href,
}: LakeCardProps) {
  const price =
    priceMin != null && priceMax != null && priceMax !== priceMin
      ? `${formatInt(priceMin)}–${formatInt(priceMax)}`
      : priceMin != null
        ? formatInt(priceMin)
        : priceMax != null
          ? formatInt(priceMax)
          : null;
  const subtitle = [locationLabel, species.join(', ')].filter(Boolean).join(' · ');

  return (
    <CardShell elevated interactive={!!href}>
      <CardPhoto src={imageSrc} alt="" blurDataURL={imageBlurDataURL}>
        {onlineBooking && (
          <Pill tone="light" className="absolute bottom-2.5 left-2.5">
            Rezervare online
          </Pill>
        )}
      </CardPhoto>
      <div className="flex flex-col gap-1.5 p-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle href={href} className="min-w-0 t-heading text-ink">
            {name}
          </CardTitle>
          {rating != null && (
            <p className="flex shrink-0 items-center gap-[3px] t-control text-ink">
              <StarIcon aria-hidden className="size-3.5 text-rating" />
              <span className="sr-only">Rating </span>
              {formatDecimal(rating, 1, 1)}
            </p>
          )}
        </div>
        {subtitle && <p className="t-caption text-muted">{subtitle}</p>}
        {price && (
          <p className="flex items-baseline gap-1 pt-0.5">
            <span className="t-stat text-ink">{price}</span>
            <span className="t-label text-muted">{priceUnit}</span>
          </p>
        )}
      </div>
    </CardShell>
  );
}
