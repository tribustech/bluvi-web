'use client';

import { useId, useState } from 'react';
import { MinusIcon, PlusIcon } from '@heroicons/react/24/outline';
import { SettingsSwitch } from '@/components/account/settings/SwitchRow';
import { Dialog } from '@/components/surfaces/Dialog';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { clearStandGrids, setStandGrid, standGrid, valuedStandCount } from '@/core/organizer/domain/standFishNumbers';
import type { SectorConfig } from '../lac-si-sectoare/model';

/*
 * fish components/StandGridEditor.tsx — «Standuri valorice»: a stand can have its own grid (how
 * many of its heaviest fish count for quality). Off by default; on, every stand of the selected
 * sector gets a − / N / + stepper starting at the sector's grid, and only stands that differ are
 * stored. Turning it off with values set asks first.
 */

type Props = {
  sector: SectorConfig;
  /** The stands allocated to this sector, in display order. */
  stands: readonly { documentId: string; name: string }[];
  onChange: (sector: SectorConfig) => void;
  disabled?: boolean;
};

const stepBtn = cn(
  'relative flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-control bg-surface text-accent-ink shadow-e0 hover:bg-accent-tint [&>svg]:size-4',
  'transition-[background-color,color,opacity] duration-(--duration-fast) ease-fast active:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
  'disabled:cursor-not-allowed disabled:text-faint disabled:hover:bg-surface disabled:active:opacity-100',
);

const fishLabel = (n: number) => `${n} ${n === 1 ? 'pește' : 'pești'}`;

export function StandGridEditor({ sector, stands, onChange, disabled = false }: Props) {
  const [enabled, setEnabled] = useState(valuedStandCount(sector) > 0);
  const [confirmOff, setConfirmOff] = useState(false);
  const titleId = useId();
  const helperId = useId();

  const toggle = (next: boolean) => {
    if (next || valuedStandCount(sector) === 0) setEnabled(next);
    else setConfirmOff(true);
  };

  return (
    <section className="flex flex-col gap-3 rounded-card bg-surface p-4 shadow-e0" data-testid={`stand-grid-editor-${sector.name}`}>
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <h3 id={titleId} className="t-body-strong text-ink">
            Standuri valorice
          </h3>
          <p id={helperId} className="t-caption text-muted">
            Un stand poate avea propria grilă la calitate.
          </p>
        </div>
        <SettingsSwitch checked={enabled} onChange={toggle} disabled={disabled} labelledBy={titleId} describedBy={helperId} />
      </div>

      {enabled ? (
        stands.length === 0 ? (
          <p className="t-caption text-muted">Alocă standuri sectorului {sector.name} ca să le setezi grila.</p>
        ) : (
          <>
            <p className="t-caption text-muted">
              Implicit {fishLabel(sector.minFishNumber)} (grila sectorului). Schimbă doar standurile care diferă.
            </p>
            <ul aria-label={`Grila standurilor, sector ${sector.name}`} className="grid gap-1.5 @xl:grid-cols-2">
              {stands.map((stand) => {
                const value = standGrid(sector, stand.documentId);
                const differs = value !== sector.minFishNumber;
                const label = `${sector.name}${stand.name}`;
                return (
                  <li
                    key={stand.documentId}
                    data-testid={`stand-grid-row-${stand.name}`}
                    className={cn('flex items-center justify-between gap-3 rounded-control px-3 py-1.5', differs ? 'bg-accent-tint' : 'bg-soft-fill')}
                  >
                    <span className={cn('t-body-strong tabular-nums', differs ? 'text-accent-ink' : 'text-ink')}>{label}</span>
                    <span className="flex items-center gap-2">
                      <button
                        type="button"
                        className={stepBtn}
                        aria-label={`Mai puțini pești, standul ${label}`}
                        disabled={disabled || value <= 1}
                        onClick={() => onChange(setStandGrid(sector, stand.documentId, value - 1))}
                      >
                        <MinusIcon aria-hidden />
                      </button>
                      <output aria-live="polite" className={cn('t-body-strong w-16 text-center tabular-nums', differs ? 'text-accent-ink' : 'text-ink')}>
                        {fishLabel(value)}
                      </output>
                      <button
                        type="button"
                        className={stepBtn}
                        aria-label={`Mai mulți pești, standul ${label}`}
                        disabled={disabled}
                        onClick={() => onChange(setStandGrid(sector, stand.documentId, value + 1))}
                      >
                        <PlusIcon aria-hidden />
                      </button>
                    </span>
                  </li>
                );
              })}
            </ul>
          </>
        )
      ) : null}

      <Dialog
        open={confirmOff}
        onClose={() => setConfirmOff(false)}
        alert
        title="Renunți la standurile valorice?"
        description={`Toate standurile din sectorul ${sector.name} revin la ${fishLabel(sector.minFishNumber)}.`}
        actions={
          <>
            <Button variant="secondary" onClick={() => setConfirmOff(false)}>
              Anulează
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setConfirmOff(false);
                setEnabled(false);
                onChange(clearStandGrids(sector));
              }}
            >
              Renunță
            </Button>
          </>
        }
      />
    </section>
  );
}
