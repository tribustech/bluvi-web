'use client';

import type { ReactNode } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { cn } from '@/components/ui/cn';
import { TodayButton } from './Legend';

/*
 * The desktop grid's period navigation (≥768, owner 2026-10-11: «câte o săptămână cu butoane
 * față/spate pe mijloc sus și perioada între»): centred over the grid, ‹ «11 – 17 oct 2026» ›, and
 * «Azi» at the right end (the page holding today). The period is a polite live region, so a page
 * turn is announced. The buttons name the step: «Săptămâna …» for a 7-day page, «Perioada …» when the
 * width holds fewer days. A spent direction is aria-disabled (focus stays on it), never removed.
 */

type Props = {
  label: string;
  days: number;
  prevDisabled: boolean;
  nextDisabled: boolean;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
};

export function PeriodNav({ label, days, prevDisabled, nextDisabled, onPrev, onNext, onToday }: Props) {
  const unit = days === 7 ? 'Săptămâna' : 'Perioada';
  return (
    <div data-testid="period-nav" className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3 pb-3">
      <span />
      <div className="flex items-center gap-2">
        <StepButton label={`${unit} anterioară`} disabled={prevDisabled} onClick={onPrev}>
          <ChevronLeftIcon />
        </StepButton>
        <p data-testid="period-label" aria-live="polite" aria-atomic="true" className="t-heading min-w-52 text-center whitespace-nowrap text-ink tabular-nums">
          {label}
        </p>
        <StepButton label={`${unit} următoare`} disabled={nextDisabled} onClick={onNext}>
          <ChevronRightIcon />
        </StepButton>
      </div>
      <div className="flex justify-end">
        <TodayButton onClick={onToday} />
      </div>
    </div>
  );
}

function StepButton({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-disabled={disabled || undefined}
      onClick={disabled ? undefined : onClick}
      className={cn(
        'flex size-9 shrink-0 items-center justify-center rounded-full border border-hairline bg-surface text-ink [&>svg]:size-4.5',
        'transition-[background-color,opacity] duration-(--duration-fast) ease-fast',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        disabled ? 'cursor-default opacity-40' : 'cursor-pointer hover:bg-soft-fill active:opacity-60',
      )}
    >
      {children}
    </button>
  );
}
