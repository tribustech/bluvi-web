'use client';

import { memo } from 'react';
import { TrophyIcon } from '@heroicons/react/16/solid';
import { T4Spinner } from '@/components/templates/T4';
import { cn } from '@/components/ui/cn';
import { CELL_H, HEADER_H, PINNED_W, type GridRun } from './model';

/*
 * One run of a stand row — fish GridBand.tsx: an absolutely positioned band on the proportional
 * time axis (a slot, a merged block, the selected run). Every band answers a tap, so none is
 * `disabled` (c18: a taken band is a no-op that still takes focus); its state is in its name.
 *
 * Looks (c13): free is white and silent; booked and blocked share one red «indisponibil»; the
 * selection is one indigo pill (c21); a free slot inside the lead time is yellow (c15); a started
 * slot is past — neutral, dashed (c14). Rounded bands touching edge to edge would leave notches,
 * so each is inset by 1.5px (fish BAND_INSET): the gutter is intentional.
 */

const INSET = 1.5;

function look(run: GridRun): string {
  if (run.selected) return 'z-above border-2 border-accent-ink bg-accent text-on-accent shadow-glow';
  if (run.isPast) return 'border border-dashed border-faint bg-page text-muted';
  if (run.status === 'available' && run.tooSoon) return 'border border-yellow-5 bg-status-warning-bg text-status-warning-fg hover:brightness-97';
  if (run.status === 'available') return 'border border-hairline bg-surface text-ink hover:border-accent hover:bg-accent-tint';
  return 'border border-status-danger-line bg-status-danger-bg text-status-danger-fg';
}

/**
 * A booked band the operator's grid is acting on (operator.calendar): `open` — its booking is the
 * one in the detail (a ring, aria-current); `busy` — its booking is being looked up (a spinner,
 * aria-busy). Undefined on every other band, so marking one never re-renders the rest (memo).
 */
export type BandMark = 'open' | 'busy';

type Props = {
  run: GridRun;
  mark?: BandMark;
  standId: string;
  /** Roving tab stop: the one band of the grid that is in the tab order. */
  tabbable: boolean;
  onPress: (standId: string, run: GridRun) => void;
};

export const GridBand = memo(function GridBand({ run, standId, tabbable, onPress, mark }: Props) {
  const competition = run.block?.reason === 'competition' && !run.label;
  return (
    <button
      type="button"
      data-band
      data-stand={standId}
      data-first={run.firstCell}
      data-last={run.lastCell}
      data-status={run.isPast ? 'past' : run.selected ? 'selected' : run.status === 'available' && run.tooSoon ? 'too-soon' : run.status}
      aria-label={run.ariaLabel}
      aria-pressed={run.selected}
      aria-current={mark === 'open' ? 'true' : undefined}
      aria-busy={mark === 'busy' ? 'true' : undefined}
      data-active={mark === 'open' ? '' : undefined}
      tabIndex={tabbable ? 0 : -1}
      onClick={() => onPress(standId, run)}
      style={{
        left: run.leftPx + INSET,
        width: Math.max(0, run.widthPx - INSET * 2),
        top: INSET,
        height: CELL_H - 1 - INSET * 2,
        scrollMarginLeft: PINNED_W + 8,
        scrollMarginTop: HEADER_H + 8,
        scrollMarginRight: 32,
      }}
      className={cn(
        'absolute flex cursor-pointer items-center justify-center overflow-hidden rounded-md px-1 text-center',
        'transition-[background-color,border-color,filter] duration-(--duration-fast) ease-fast',
        'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent active:opacity-80',
        look(run),
        mark === 'open' && 'z-above ring-2 ring-accent-ink ring-offset-1 ring-offset-surface',
      )}
    >
      {mark === 'busy' ? <T4Spinner className="size-3.5 shrink-0" /> : null}
      {competition ? <TrophyIcon aria-hidden className={cn('size-3.5 shrink-0', run.isPast ? 'text-faint' : 'text-status-danger-fg')} /> : null}
      {run.label && mark !== 'busy' ? <span className="t-micro-strong line-clamp-2 min-w-0">{run.label}</span> : null}
    </button>
  );
});
