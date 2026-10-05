import { sectorFill } from '@/components/ranking/sector';
import { cn } from '@/components/ui/cn';
import { standLabel } from './stand';

/**
 * The competition's one stand mark: the sector's dot and the stand label («● A1») — Fundații §01
 * (a sector colour is only ever the dot or the 4px edge, never a fill under text). Used wherever a
 * stand is named beside a person or a number: the navy biggest-catch tile, the weighing tile, Toți
 * peștii, the weighing cards. A round grey disc would read as a second avatar.
 * TODO(kit): export it from components/ranking (StandBadge) for the lake and partide rankings.
 */
export function StandMark({
  sector,
  stand,
  tone = 'surface',
  className,
}: {
  sector: string;
  stand: string;
  /** `navy`: on the navy tile (lavender ink). */
  tone?: 'surface' | 'navy';
  className?: string;
}) {
  const fill = sectorFill(sector, 'var(--color-muted)');
  return (
    <span className={cn('inline-flex shrink-0 items-center gap-1.5 t-label whitespace-nowrap', tone === 'navy' ? 'text-lavender' : 'text-ink', className)}>
      <span aria-hidden className={cn('size-2 shrink-0 rounded-full', fill.className)} style={fill.style} />
      <span className="sr-only">Stand </span>
      {standLabel(sector, stand)}
    </span>
  );
}
