'use client';

import { ResponsiveSurface } from '@/components/surfaces/ResponsiveSurface';
import { cn } from '@/components/ui/cn';
import type { StandOption } from './model';

/*
 * The stand picker of an empty slot (organizer.sectors c6; fish components/Select.tsx opened with
 * label «Sector X»): every lake stand in the lake's order; a stand already placed in any slot is
 * disabled. Choosing one fills the slot and closes. Phone: the kit sheet; from 768 the kit dialog
 * (`info`: the «Închide» X, Escape and the scrim close it, focus returns to the slot).
 * The stands are a grid of buttons (a lake can have ~200 stands: a grid is scanned, a list scrolled).
 */

type Props = {
  open: boolean;
  sectorName: string | null;
  slotNumber: number | null;
  options: StandOption[];
  onPick: (standId: string) => void;
  onClose: () => void;
};

export function StandPickerDialog({ open, sectorName, slotNumber, options, onPick, onClose }: Props) {
  const free = options.filter((o) => !o.disabled).length;
  return (
    <ResponsiveSurface
      open={open}
      onClose={onClose}
      intent="info"
      title={sectorName ? `Sector ${sectorName}` : 'Sector'}
      subtitle={slotNumber ? `Alege standul pentru locul ${slotNumber}` : undefined}
      pinnedActions
      sheetSnap="fit"
    >
      {options.length === 0 ? (
        <p className="t-body text-ink-2" data-testid="stand-picker-empty">
          Lacul nu are standuri.
        </p>
      ) : (
        <div className="flex flex-col gap-3" data-testid="stand-picker">
          {free === 0 ? <p className="t-caption text-muted">Toate standurile lacului sunt deja plasate pe sectoare.</p> : null}
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(--spacing(16),1fr))] gap-2 pt-1 pb-1">
            {options.map((o) => (
              <li key={o.standId}>
                <button
                  type="button"
                  disabled={o.disabled}
                  onClick={() => onPick(o.standId)}
                  aria-label={o.disabled ? `Standul ${o.name}, deja plasat` : `Standul ${o.name}`}
                  data-testid={`stand-option-${o.name}`}
                  className={cn(
                    't-body-strong flex h-12 w-full items-center justify-center rounded-control border px-2 tabular-nums xl:h-11',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                    o.disabled
                      ? 'cursor-not-allowed border-transparent bg-soft-fill text-muted line-through'
                      : 'border-hairline bg-surface text-ink hover:border-accent hover:bg-accent-tint',
                  )}
                >
                  <span className="min-w-0 truncate">{o.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </ResponsiveSurface>
  );
}
