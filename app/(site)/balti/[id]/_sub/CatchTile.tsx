'use client';

import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/components/ui/cn';
import { fmtKg } from '@/core/partide';
import { BrokenPhoto, failedBeforeHydration, tileRatio } from './Masonry';

/*
 * One community catch photo in a masonry (galerie «Capturi comunitate» / «Toate», capturi) — the
 * photo-only face of the kit CatchCard (Fundații §07 card · captură): the weight on the NAVY chip in
 * the lavender signature number (t-num-26, «kg» in lavender-2), never a white number on a scrim.
 *  - `full` (galerie, fish gallery tile): the chip, the species, then the angler's avatar + name;
 *  - `caption` (capturi, fish VenueCatchesGalleryScreen `photoCaption`): the chip and the species
 *    only — the attribution is the lightbox's.
 * The catch weight is the catch format (fmtKg: 1–3 decimals, as CatchCard's formatDecimal(…,1,3)),
 * never the rankings' two decimals.
 *
 * A photo that failed (a rendition that 404s): the tile is 4:3 (the screen reports it to the
 * masonry, which re-flows the column) and the lines sit on a SOLID surface band (ink on surface) —
 * no gradient over a pale fill.
 * TODO(kit): a `CatchTile` in components/cards (with ape-publice's CatchGrid tile) — outside this
 * task's scope.
 */

export type CatchTileData = {
  src: string;
  /** width / height of the photo (clamped here to the tile band). */
  ratio: number;
  weightKg: number | null;
  species: string | null;
  anglerName: string | null;
  anglerAvatarUrl?: string | null;
};

const TILE =
  'group relative block w-full cursor-pointer overflow-hidden rounded-card bg-soft-fill focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

/** «Captură Crap, 3,25 kg — Andrei» (the tile's and the lightbox's name). */
export function catchLabel(c: Pick<CatchTileData, 'species' | 'weightKg' | 'anglerName'>): string {
  const what = [c.species, c.weightKg != null ? `${fmtKg(c.weightKg)} kg` : null].filter(Boolean).join(', ');
  return `Captură${what ? ` ${what}` : ''} — ${c.anglerName ?? 'Pescar'}`;
}

/** The weight chip: the CatchCard signature (navy, lavender t-num-26, «kg» lavender-2). */
function WeightChip({ kg }: { kg: number }) {
  return (
    <span className="flex shrink-0 items-baseline gap-0.75 rounded-avatar bg-navy px-2.5 py-1.5">
      <span className="t-num-26 text-lavender">{fmtKg(kg)}</span>
      <span className="t-label text-lavender-2">kg</span>
    </span>
  );
}

export function CatchTile({
  c,
  variant,
  broken,
  onBroken,
  onOpen,
  label,
  kind = 'catch',
}: {
  c: CatchTileData;
  variant: 'full' | 'caption';
  broken: boolean;
  onBroken: () => void;
  onOpen: () => void;
  /** The button's accessible name (it opens the lightbox on this catch). */
  label: string;
  /** `data-kind` (the gallery mixes lake photos and catches). */
  kind?: string;
}) {
  const name = c.anglerName ?? 'Pescar';
  const hasLines = c.weightKg != null || !!c.species || variant === 'full';
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={label}
      className={cn(TILE, broken && 'flex flex-col')}
      style={{ aspectRatio: String(broken ? 4 / 3 : tileRatio(c.ratio)) }}
      data-kind={kind}
      data-broken={broken || undefined}
    >
      {broken ? (
        <BrokenPhoto className="min-h-0 flex-1" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- CMS renditions, already sized for the grid.
        <img src={c.src} alt="" loading="lazy" ref={failedBeforeHydration(onBroken)} onError={onBroken} className="size-full object-cover transition-transform duration-(--duration-slow) group-hover:scale-[1.02]" />
      )}
      {hasLines ? (
        <span
          aria-hidden
          className={cn(
            'flex flex-col gap-1.5 px-2.5 pb-2.5 text-left',
            broken
              ? 'shrink-0 bg-surface pt-2.5 text-ink'
              : // The lines sit on the scrim's full 60% ink (4.68:1 for white on a white photo), never on its fade.
                'absolute inset-x-0 bottom-0 bg-linear-to-t from-photo-scrim via-photo-scrim to-transparent pt-8 text-on-photo-scrim',
          )}
        >
          {c.weightKg != null || c.species ? (
            <span className="flex min-w-0 items-center gap-2">
              {c.weightKg != null ? <WeightChip kg={c.weightKg} /> : null}
              {c.species ? <span className="min-w-0 truncate t-label">{c.species}</span> : null}
            </span>
          ) : null}
          {variant === 'full' ? (
            <span className="flex min-w-0 items-center gap-1.5">
              <Avatar name={name} src={c.anglerAvatarUrl ?? undefined} size={24} ring />
              <span className="truncate t-label">{name}</span>
            </span>
          ) : null}
        </span>
      ) : null}
    </button>
  );
}
