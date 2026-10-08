'use client';

import { ResponsiveSurface } from '@/components/surfaces/ResponsiveSurface';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { PERF_LEVELS, type PerfKey } from './model';

/** The level colours (fish #16A34A / #3B82F6 / #737373 / #EF4444) as the status pairs (AA on surface). */
export const PERF_TEXT: Record<PerfKey, string> = {
  top: 'text-status-success-fg',
  good: 'text-status-info-fg',
  mid: 'text-status-neutral-fg',
  low: 'text-status-danger-fg',
};

export const PERF_DOT: Record<PerfKey, string> = {
  top: 'bg-status-success-fg',
  good: 'bg-status-info-fg',
  mid: 'bg-status-neutral-fg',
  low: 'bg-status-danger-fg',
};

/**
 * c7 «Performanța standurilor» (fish StandAllocator's bottom sheet): a sheet on a phone, a dialog
 * from 768. Copy is fish's, word for word.
 */
export function PerformanceExplanation({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <ResponsiveSurface
      open={open}
      onClose={onClose}
      intent="info"
      title="Performanța standurilor"
      sheetSnap="fit"
      actions={
        <Button onClick={onClose} block>
          Am înțeles
        </Button>
      }
    >
      <div className="flex flex-col gap-4" data-testid="stand-performance-explanation">
        <p className="t-body-strong text-ink-2">
          Te ajutăm să creezi sectoare echilibrate oferindu-ți statistici despre performanța fiecărui stand.
        </p>
        <p className="t-body text-ink-2">
          Fiecare stand primește un scor bazat pe greutatea medie totală a capturilor din competițiile anterioare desfășurate pe
          acest lac. Cu cât greutatea medie este mai mare, cu atât standul este considerat mai productiv.
        </p>
        <div className="flex flex-col gap-2">
          <h3 className="t-body-strong text-ink">Niveluri:</h3>
          <ul className="flex flex-col gap-2" aria-label="Niveluri">
            {PERF_LEVELS.map((level) => (
              <li key={level.key} className="flex items-center gap-2">
                <span aria-hidden className={cn('size-2.5 shrink-0 rounded-full', PERF_DOT[level.key])} />
                <span className={cn('t-body-strong', PERF_TEXT[level.key])}>{level.text}</span>
                <span className="t-caption text-muted">— {level.hint}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="t-caption italic text-muted">
          Scorurile se actualizează automat la finalul fiecărei competiții. Standurile fără competiții anterioare nu au scor.
        </p>
      </div>
    </ResponsiveSurface>
  );
}
