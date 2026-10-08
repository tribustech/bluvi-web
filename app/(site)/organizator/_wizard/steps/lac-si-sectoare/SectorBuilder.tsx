'use client';

import { useState } from 'react';
import { MinusIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { sectorFill, sectorInk } from '@/components/ranking/sector';
import { Dialog } from '@/components/surfaces/Dialog';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { addSector, parseMinFish, removalNeedsConfirm, removeSector, setMinFish, stepMinFish, type SectorConfig } from './model';

/*
 * fish components/SectorBuilder.tsx (organizer.step-lake-sectors c9–c11, c13): «Sectoare (n)» +
 * «Adaugă sector» up to the maximum; quality-based types get a row per sector with the
 * «Nr. minim pești» − / input / + stepper, the others a wrap of sector chips. Every sector carries
 * its letter on the sector's solid colour (components/ranking/sector.ts), in the AA ink for it.
 */

type Props = {
  sectors: readonly SectorConfig[];
  onChange: (sectors: SectorConfig[]) => void;
  maxSectors: number;
  showMinFishNumber: boolean;
  disabled?: boolean;
};

export function SectorBadge({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  const fill = sectorFill(name, 'var(--color-rank-no-sector)');
  return (
    <span
      aria-hidden
      style={fill.style}
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full t-label',
        size === 'md' ? 'size-8' : 'size-7',
        fill.className,
        sectorInk(name, 'solid'),
      )}
    >
      {name}
    </span>
  );
}

const KEY =
  'relative flex shrink-0 cursor-pointer items-center justify-center transition-[background-color,color,opacity] duration-(--duration-fast) ease-fast active:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

/** − / + : white keys on the soft-fill stepper (QuantityStepper's look, 36px). */
const stepBtn = cn(
  KEY,
  'size-9 rounded-control bg-surface text-accent-ink shadow-e0 hover:bg-accent-tint [&>svg]:size-4',
  'disabled:cursor-not-allowed disabled:text-faint disabled:hover:bg-surface disabled:active:opacity-100',
);

/**
 * A stepper row: narrow = «badge name trash» over «· label stepper»; from @sm (384px) one line,
 * «badge name/label stepper trash» (fish SectorBuilder).
 */
const ROW_GRID = cn(
  'grid items-center gap-x-3 gap-y-2',
  "grid-cols-[auto_minmax(0,1fr)_auto] [grid-template-areas:'badge_name_trash'_'._label_stepper']",
  "@sm:grid-cols-[auto_minmax(0,1fr)_auto_auto] @sm:gap-y-0 @sm:[grid-template-areas:'badge_name_stepper_trash'_'badge_label_stepper_trash']",
);

const trashBtn = (round: boolean) =>
  cn(
    KEY,
    'text-status-danger-fg hover:bg-status-danger-bg disabled:cursor-not-allowed disabled:opacity-50',
    round ? 'size-8 rounded-full [&>svg]:size-4' : 'size-9 rounded-control [&>svg]:size-5',
  );

export function SectorBuilder({ sectors, onChange, maxSectors, showMinFishNumber, disabled = false }: Props) {
  const [confirm, setConfirm] = useState<number | null>(null);
  const asking = confirm != null ? sectors[confirm] : undefined;

  const askRemove = (index: number) => {
    if (removalNeedsConfirm(sectors[index], showMinFishNumber)) setConfirm(index);
    else onChange(removeSector(sectors, index));
  };
  const canRemove = sectors.length > 1;

  return (
    <div className="@container flex flex-col gap-3" data-testid="sector-builder">
      <div className="flex min-h-10 items-center justify-between gap-3">
        <h3 className="t-body-strong text-ink" data-testid="sector-count">
          Sectoare ({sectors.length})
        </h3>
        {sectors.length < maxSectors ? (
          <button
            type="button"
            onClick={() => onChange(addSector(sectors, maxSectors))}
            disabled={disabled}
            data-testid="sector-builder-add"
            className={cn(
              't-button-compact -mr-2 inline-flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-control px-2 text-accent-ink [&>svg]:size-5',
              'transition-colors duration-(--duration-fast) hover:bg-accent-tint focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50',
            )}
          >
            <PlusIcon aria-hidden />
            Adaugă sector
          </button>
        ) : null}
      </div>

      {sectors.length === 0 ? (
        <p className="t-body-strong rounded-control bg-soft-fill px-4 py-6 text-center text-muted" data-testid="sector-empty">
          Niciun sector adăugat. Adaugă cel puțin un sector.
        </p>
      ) : showMinFishNumber ? (
        <ul aria-label="Sectoare" className="grid gap-2 @2xl:grid-cols-2">
          {sectors.map((sector, index) => (
            <li key={sector.name} className="@container rounded-control bg-surface p-3 shadow-e0" data-testid={`sector-row-${sector.name}`}>
              {/* Narrow (a phone, the half column at 1440): name + trash, then «Nr. minim pești» + the
                  stepper under it. From 384px wide: one line, as fish. */}
              <div className={ROW_GRID}>
                <span className="[grid-area:badge]">
                  <SectorBadge name={sector.name} />
                </span>
                <span className="t-body truncate text-ink [grid-area:name] @sm:self-end">Sector {sector.name}</span>
                <span className="t-caption whitespace-nowrap text-muted [grid-area:label] @sm:self-start">Nr. minim pești</span>
                <div className="flex shrink-0 items-center gap-1 justify-self-end rounded-control bg-soft-fill p-1 [grid-area:stepper]">
                  <button
                    type="button"
                    className={stepBtn}
                    aria-label={`Mai puțini pești, sector ${sector.name}`}
                    disabled={disabled || sector.minFishNumber <= 0}
                    onClick={() => onChange(stepMinFish(sectors, index, -1))}
                  >
                    <MinusIcon aria-hidden />
                  </button>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="off"
                    value={sector.minFishNumber === 0 ? '' : String(sector.minFishNumber)}
                    onChange={e => onChange(setMinFish(sectors, index, parseMinFish(e.currentTarget.value)))}
                    disabled={disabled}
                    aria-label={`Nr. minim pești, sector ${sector.name}`}
                    aria-invalid={sector.minFishNumber < 1 || undefined}
                    className={cn(
                      't-body-strong h-9 w-12 rounded-control bg-surface text-center text-ink tabular-nums outline-none placeholder:text-muted',
                      'focus-visible:outline-2 focus-visible:outline-accent',
                      sector.minFishNumber < 1 && 'ring-2 ring-live ring-inset',
                    )}
                  />
                  <button
                    type="button"
                    className={stepBtn}
                    aria-label={`Mai mulți pești, sector ${sector.name}`}
                    disabled={disabled}
                    onClick={() => onChange(stepMinFish(sectors, index, 1))}
                  >
                    <PlusIcon aria-hidden />
                  </button>
                </div>
                {canRemove ? (
                  <button
                    type="button"
                    className={cn(trashBtn(false), 'justify-self-end [grid-area:trash]')}
                    aria-label={`Șterge sectorul ${sector.name}`}
                    disabled={disabled}
                    onClick={() => askRemove(index)}
                  >
                    <TrashIcon aria-hidden />
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <ul aria-label="Sectoare" className="flex flex-wrap gap-2">
          {sectors.map((sector, index) => (
            <li
              key={sector.name}
              className={cn(
                'flex min-h-11 items-center gap-2 rounded-full bg-surface py-1.5 pl-1.5 shadow-e0',
                canRemove ? 'pr-1' : 'pr-4',
              )}
              data-testid={`sector-row-${sector.name}`}
            >
              <SectorBadge name={sector.name} size="sm" />
              <span className="t-body text-ink">Sector {sector.name}</span>
              {canRemove ? (
                <button
                  type="button"
                  className={trashBtn(true)}
                  aria-label={`Șterge sectorul ${sector.name}`}
                  disabled={disabled}
                  onClick={() => askRemove(index)}
                >
                  <TrashIcon aria-hidden />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={asking != null}
        onClose={() => setConfirm(null)}
        alert
        title="Ștergi sectorul?"
        description={
          asking ? `Sectorul ${asking.name} are nr. minim pești modificat (${asking.minFishNumber}). Sigur vrei să-l ștergi?` : undefined
        }
        actions={
          <>
            <Button variant="secondary" onClick={() => setConfirm(null)}>
              Anulează
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (confirm != null) onChange(removeSector(sectors, confirm));
                setConfirm(null);
              }}
            >
              Șterge
            </Button>
          </>
        }
      />
    </div>
  );
}
