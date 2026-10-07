import { FishIcon } from '@/components/icons/brand';
import { BentoArt } from '@/components/ui/BentoTile';
import { cn } from '@/components/ui/cn';
import { InlineNumber, SignatureNumber } from '@/components/ui/SignatureNumber';
import { fmtKg, type WeightSegment } from '@/core/partide';

/*
 * «TOTAL CÂNTĂRIT» — fish comunitate/[id].tsx unified results card (parity partide.spectator.c6):
 * the total weighed kg (or «—» when nothing was weighed), a segmented bar of the top three species
 * by kg + «altele», their legend and «medie X kg». The signature navy bento tile (owner rule 19);
 * the unit is its own smaller word (rule 10). The bar is decorative: the legend says the same.
 */

/** fish SEGMENT_OPACITIES [1, .62, .34, .2] on the tile's lavender. */
const SEGMENT_TONES = ['bg-lavender', 'bg-lavender/60', 'bg-lavender/35', 'bg-lavender/20'];

export function WeightSegmentsBar({ segments, className }: { segments: WeightSegment[]; className?: string }) {
  if (segments.length === 0) return null;
  return (
    <div aria-hidden className={cn('flex h-2 gap-0.75 overflow-hidden rounded-full', className)}>
      {segments.map((s, i) => (
        <span key={s.key} className={cn('h-full basis-0', SEGMENT_TONES[i] ?? SEGMENT_TONES[3])} style={{ flexGrow: s.fraction }} />
      ))}
    </div>
  );
}

export function TotalWeighedCard({
  totalKg,
  segments,
  avgKg,
  className,
}: {
  totalKg: number | null;
  segments: WeightSegment[];
  avgKg: number | null;
  className?: string;
}) {
  const legend = segments.slice(0, 3);
  return (
    <section
      aria-labelledby="partida-total"
      data-testid="partida-total"
      className={cn(
        'relative isolate flex flex-col gap-4 overflow-hidden rounded-bento bg-linear-160 from-navy from-30% to-bento-navy-2 p-5 text-lavender-2 md:p-6',
        className,
      )}
    >
      <BentoArt>
        <FishIcon />
      </BentoArt>
      <h2 id="partida-total" className="t-label tracking-[0.4px] uppercase">
        Total cântărit
      </h2>
      {totalKg != null ? (
        <SignatureNumber size="tile" tone="lavender" unitTone="lavender" value={fmtKg(totalKg)} unit="kg" />
      ) : (
        // Nothing weighed: «—», never a misleading «0 kg» (fish).
        <p className="t-num-64 text-lavender">
          <span aria-hidden>—</span>
          <span className="sr-only">Nicio captură cântărită</span>
        </p>
      )}
      {segments.length > 0 ? (
        <div className="flex flex-col gap-2.5">
          <WeightSegmentsBar segments={segments} />
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <ul aria-label="Pe specii" className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              {legend.map((s, i) => (
                <li key={s.key} className="flex items-center gap-1.5 t-caption">
                  <span aria-hidden className={cn('size-2 shrink-0 rounded-badge', SEGMENT_TONES[i])} />
                  {s.key === '__rest__' ? (
                    'altele'
                  ) : (
                    <span>
                      {s.key}{' '}
                      <InlineNumber value={fmtKg(s.weightKg)} unit="kg" valueClassName="t-label text-lavender" unitClassName="text-lavender-2" />
                    </span>
                  )}
                </li>
              ))}
            </ul>
            {avgKg != null ? (
              <p className="ml-auto t-caption">
                medie{' '}
                <InlineNumber value={fmtKg(Math.round(avgKg * 10) / 10)} unit="kg" valueClassName="t-label text-lavender" unitClassName="text-lavender-2" />
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
