import { MapPinIcon } from '@heroicons/react/20/solid';
import { CardPhoto, CardShell, CardTitle } from './CardShell';
import { formatInt, plural } from './format';
import { Eyebrow, Pill, Tag, type PillTone, type TagTone } from './parts';

export type CompetitionCardProps = {
  title: string;
  /** Preformatted range, e.g. "Sâm, 27 - Dum, 28 sept" — shown in caps. */
  dateLabel: string;
  lakeName: string;
  imageSrc: string;
  imageBlurDataURL?: string;
  href?: string;
  /** Live competitions get the LIVE pill; other states pass a status pill instead. */
  live?: boolean;
  status?: { label: string; tone: Exclude<PillTone, 'live' | 'scrim' | 'light'> };
  /** "412 urmăresc" on the photo. */
  followersCount?: number;
  registeredCount: number;
  capacity?: number | null;
  /** Attribute badges: competition type, criterion ("Individual", "Cantitate"). */
  badges?: ReadonlyArray<{ label: string; tone: TagTone }>;
};

/** Fundații §07 card · concurs. */
export function CompetitionCard({
  title,
  dateLabel,
  lakeName,
  imageSrc,
  imageBlurDataURL,
  href,
  live = false,
  status,
  followersCount,
  registeredCount,
  capacity,
  badges = [],
}: CompetitionCardProps) {
  const anglers =
    capacity != null ? `${formatInt(registeredCount)}/${formatInt(capacity)} pescari` : plural(registeredCount, 'pescar', 'pescari');

  return (
    <CardShell elevated interactive={!!href}>
      <CardPhoto src={imageSrc} alt="" blurDataURL={imageBlurDataURL}>
        <div className="absolute top-2.5 left-2.5 flex gap-1.5">
          {live && <Pill tone="live">LIVE</Pill>}
          {!live && status && <Pill tone={status.tone}>{status.label}</Pill>}
          {followersCount != null && followersCount > 0 && (
            <Pill tone="scrim">{formatInt(followersCount)} urmăresc</Pill>
          )}
        </div>
      </CardPhoto>
      <div className="flex flex-col gap-1.5 p-3">
        <Eyebrow>{dateLabel}</Eyebrow>
        <CardTitle href={href} className="t-heading text-ink">
          {title}
        </CardTitle>
        <p className="flex min-w-0 items-center gap-1 t-label text-accent-ink">
          <MapPinIcon aria-hidden className="size-3 shrink-0 text-accent" />
          <span className="truncate">{lakeName}</span>
        </p>
        <div className="my-0.5 h-px bg-hairline" />
        <div className="flex items-center justify-between gap-2">
          <p className="t-label whitespace-nowrap text-ink-2">{anglers}</p>
          {badges.length > 0 && (
            <div className="flex gap-1">
              {badges.map(b => (
                <Tag key={b.label} tone={b.tone}>
                  {b.label}
                </Tag>
              ))}
            </div>
          )}
        </div>
      </div>
    </CardShell>
  );
}
