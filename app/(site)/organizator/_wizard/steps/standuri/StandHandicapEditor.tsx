'use client';

import { useId, useState } from 'react';
import { MinusIcon, PlusIcon } from '@heroicons/react/24/outline';
import { SettingsSwitch } from '@/components/account/settings/SwitchRow';
import { Dialog } from '@/components/surfaces/Dialog';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import {
  HANDICAP_STEP,
  clearStandHandicaps,
  handicappedStandCount,
  setStandHandicap,
  standHandicap,
} from '@/core/organizer/domain/standHandicaps';
import type { SectorConfig } from '../lac-si-sectoare/model';

/*
 * fish components/StandHandicapEditor.tsx — «Handicap pe stand»: only a percentage of a stand's kg
 * counts in the ranking. Off by default; on, every stand of the selected sector gets a − / N% / +
 * stepper (10% steps) starting at 100%, and only handicapped stands are stored. Turning it off with
 * values set asks first.
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

export function StandHandicapEditor({ sector, stands, onChange, disabled = false }: Props) {
  const [enabled, setEnabled] = useState(handicappedStandCount(sector) > 0);
  const [confirmOff, setConfirmOff] = useState(false);
  const titleId = useId();
  const helperId = useId();

  const toggle = (next: boolean) => {
    if (next || handicappedStandCount(sector) === 0) setEnabled(next);
    else setConfirmOff(true);
  };

  return (
    <section className="flex flex-col gap-3 rounded-card bg-surface p-4 shadow-e0" data-testid={`stand-handicap-editor-${sector.name}`}>
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <h3 id={titleId} className="t-body-strong text-ink">
            Handicap pe stand
          </h3>
          <p id={helperId} className="t-caption text-muted">
            Doar un procent din cantitatea standului intră în clasament.
          </p>
        </div>
        <SettingsSwitch checked={enabled} onChange={toggle} disabled={disabled} labelledBy={titleId} describedBy={helperId} />
      </div>

      {/* A worked example, so organizers see what the option does before turning it on. */}
      <div className="flex flex-col gap-0.5 rounded-control bg-accent-tint px-3 py-2.5" data-testid="stand-handicap-example">
        <p className="t-caption font-bold text-accent-ink">Exemplu</p>
        <p className="t-caption text-ink-2">
          Standul A3 are handicap 50% și prinde 20 kg. În clasament intră 10 kg, iar pescarul vede și kg prinse. Calitatea și peștele cel mai mare
          nu se schimbă.
        </p>
      </div>

      {enabled ? (
        stands.length === 0 ? (
          <p className="t-caption text-muted">Alocă standuri sectorului {sector.name} ca să le setezi handicapul.</p>
        ) : (
          <>
            <p className="t-caption text-muted">
              Implicit 100%. Coboară doar standurile cu handicap.
            </p>
            <ul aria-label={`Handicapul standurilor, sector ${sector.name}`} className="grid gap-1.5 @xl:grid-cols-2">
              {stands.map((stand) => {
                const value = standHandicap(sector, stand.documentId);
                const differs = value < 100;
                // From an odd value the stepper snaps to the 10% grid.
                const rest = value % HANDICAP_STEP;
                const down = rest === 0 ? value - HANDICAP_STEP : value - rest;
                const up = rest === 0 ? value + HANDICAP_STEP : value + HANDICAP_STEP - rest;
                const label = `${sector.name}${stand.name}`;
                return (
                  <li
                    key={stand.documentId}
                    data-testid={`stand-handicap-row-${stand.name}`}
                    className={cn('flex items-center justify-between gap-3 rounded-control px-3 py-1.5', differs ? 'bg-accent-tint' : 'bg-soft-fill')}
                  >
                    <span className={cn('t-body-strong tabular-nums', differs ? 'text-accent-ink' : 'text-ink')}>{label}</span>
                    <span className="flex items-center gap-2">
                      <button
                        type="button"
                        className={stepBtn}
                        aria-label={`Handicap mai mare, standul ${label}`}
                        disabled={disabled || value <= HANDICAP_STEP}
                        onClick={() => onChange(setStandHandicap(sector, stand.documentId, down))}
                      >
                        <MinusIcon aria-hidden />
                      </button>
                      <output aria-live="polite" className={cn('t-body-strong w-16 text-center tabular-nums', differs ? 'text-accent-ink' : 'text-ink')}>
                        {value}%
                      </output>
                      <button
                        type="button"
                        className={stepBtn}
                        aria-label={`Handicap mai mic, standul ${label}`}
                        disabled={disabled || value >= 100}
                        onClick={() => onChange(setStandHandicap(sector, stand.documentId, up))}
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
        title="Renunți la handicap?"
        description={`Toate standurile din sectorul ${sector.name} revin la 100% din cantitate.`}
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
                onChange(clearStandHandicaps(sector));
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
