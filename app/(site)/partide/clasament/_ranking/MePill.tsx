'use client';

import { cn } from '@/components/ui/cn';
import { fmtKg, isWeighed, type StatsPeriod } from '@/core/partide';
import { formatCount } from '@/core/realtime/chat/format';
import { PERIOD_PHRASE } from './place';

/*
 * fish MePill (partide.clasament c7): on «Pescari», a signed-in viewer present in the ranking reads
 * «Ești pe locul {rank} din {total} {perioadă} — {kg} kg» beside the indigo «EU» disc. The caller
 * computes it in the browser from the shell session (owner rule 4: no pill while the session is
 * unknown, signed out or not ranked). The weight keeps its unit apart (rule 10); nothing weighed:
 * no weight clause (never «— 0 kg»). `period` is the period the figures belong to (useShownPeriod).
 */
export function MePill({ rank, total, period, kg, className }: { rank: number; total: number; period: StatsPeriod; kg: number; className?: string }) {
  return (
    <div className={cn('flex items-center gap-2.5 rounded-card bg-accent-tint px-3 py-2.5 inset-ring inset-ring-accent-tint-2', className)} data-testid="me-pill">
      <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-ink t-micro-strong text-on-accent">
        EU
      </span>
      <p className="t-label text-ink">
        Ești pe locul {rank} din {formatCount(total, 'pescar', 'pescari')} {PERIOD_PHRASE[period]}
        {isWeighed(kg) ? (
          <>
            {' — '}
            <span className="whitespace-nowrap">
              <span className="tabular-nums">{fmtKg(kg)}</span>
              <span className="ml-1 t-micro text-muted">kg</span>
            </span>
          </>
        ) : null}
      </p>
    </div>
  );
}
