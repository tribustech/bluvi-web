import { FishIcon } from '@/components/icons/brand';
import { cn } from '@/components/ui/cn';
import { InlineNumber } from '@/components/ui/SignatureNumber';
import { fmtKg, thumbSource, type CommunitySessionDetailCatchDTO } from '@/core/partide';
import { clockRo } from './format';
import { SafeImg } from './SafeImg';

/*
 * One catch of a partidă — fish comunitate/[id].tsx CatchRow (parity partide.spectator.c11): the
 * thumbnail (or the fish on the indigo tint), the species («Captură» without one), the time, and
 * the kg at the right — in indigo for the partidă's biggest catch. A row with a photo is a button
 * that opens the lightbox on it (`onOpen`); one without is plain text.
 */

export function CatchThumb({ item, size = 'row' }: { item: Pick<CommunitySessionDetailCatchDTO, 'photoUrl' | 'photoThumbUrl'>; size?: 'row' | 'large' }) {
  const src = item.photoUrl ? thumbSource(item) : null;
  const box = size === 'row' ? 'size-11 rounded-control' : 'size-18 rounded-card';
  const fish = (
    <span aria-hidden className={cn('flex shrink-0 items-center justify-center bg-accent-tint text-accent', box)}>
      <FishIcon className={size === 'row' ? 'size-5.5 opacity-70' : 'size-7 opacity-70'} />
    </span>
  );
  // A thumbnail the CMS already sized (thumbnail variant): a plain <img>, lazily loaded.
  return src ? <SafeImg src={src} className={cn('shrink-0 bg-soft-fill object-cover', box)} fallback={fish} /> : fish;
}

export function CatchRow({ item, isMax, onOpen }: { item: CommunitySessionDetailCatchDTO; isMax: boolean; onOpen?: () => void }) {
  const species = item.species ?? 'Captură';
  const time = clockRo(item.occurredAt);
  const body = (
    <>
      <CatchThumb item={item} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
        <span className="truncate t-body-strong text-ink">{species}</span>
        <span className="t-caption text-muted tabular-nums">{time}</span>
      </span>
      {item.weightKg != null ? (
        <InlineNumber
          value={fmtKg(item.weightKg)}
          unit="kg"
          className="shrink-0"
          valueClassName={cn('t-body-strong tabular-nums', isMax ? 'text-accent-ink' : 'text-ink')}
          unitClassName={isMax ? 'text-accent-ink' : 'text-muted'}
        />
      ) : null}
    </>
  );
  const row = 'flex w-full items-center gap-3 px-4 py-2.75 md:px-5 xl:px-6';
  return (
    <li data-testid="partida-catch" data-max={isMax || undefined}>
      {onOpen ? (
        <button
          type="button"
          aria-haspopup="dialog"
          aria-label={`${species}${item.weightKg != null ? `, ${fmtKg(item.weightKg)} kg` : ''}, ${time} — vezi fotografia`}
          onClick={onOpen}
          className={cn(
            row,
            'cursor-pointer transition-colors duration-(--duration-fast) ease-fast hover:bg-page focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent',
          )}
        >
          {body}
        </button>
      ) : (
        <div className={row}>{body}</div>
      )}
    </li>
  );
}
