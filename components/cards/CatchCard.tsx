import { CardPhoto, CardShell, CardTitle } from './CardShell';
import { formatDecimal } from './format';

export type CatchCardProps = {
  weightKg: number;
  species: string;
  anglerName: string;
  /** "Stand 12" — omitted outside competitions. */
  standLabel?: string | null;
  /** "04:37" */
  timeLabel: string;
  imageSrc: string;
  imageAlt?: string;
  imageBlurDataURL?: string;
  href?: string;
};

/** Fundații §07 card · captură — the weight sits on a navy chip, the signature number in lavender. */
export function CatchCard({
  weightKg,
  species,
  anglerName,
  standLabel,
  timeLabel,
  imageSrc,
  imageAlt,
  imageBlurDataURL,
  href,
}: CatchCardProps) {
  const weight = formatDecimal(weightKg, 1, 3);
  return (
    <CardShell interactive={!!href}>
      <CardPhoto src={imageSrc} alt={imageAlt ?? `${species}, ${weight} kg`} blurDataURL={imageBlurDataURL}>
        <p className="absolute bottom-2.5 left-2.5 flex items-baseline gap-[3px] rounded-avatar bg-navy px-2.5 py-1.5">
          <span className="t-num-26 text-lavender">
            {weight}
          </span>
          <span className="t-label text-lavender-2">kg</span>
        </p>
      </CardPhoto>
      <div className="flex flex-col gap-1 p-3">
        <CardTitle href={href} className="t-body-strong text-ink">
          {species}
        </CardTitle>
        <p className="t-caption text-muted">{[anglerName, standLabel, timeLabel].filter(Boolean).join(' · ')}</p>
      </div>
    </CardShell>
  );
}
