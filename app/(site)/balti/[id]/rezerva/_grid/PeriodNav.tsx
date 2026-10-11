'use client';

import type { ReactNode } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { cn } from '@/components/ui/cn';
import { buttonClass } from '@/components/ui/Button';

/*
 * The desktop grid's period navigation (≥768, owner 2026-10-11: «câte o săptămână cu butoane
 * față/spate … și perioada între»): in the header's right side, next to the lake's name — 44px round
 * ‹ › with an accent edge (spent: a faint, flat disc), the period between them at title size, then
 * «Azi» as an outline button (the page holding today). The period is a polite live region, so a page
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
    <div data-testid="period-nav" className="flex items-center gap-2 lg:gap-3">
      <StepButton label={`${unit} anterioară`} disabled={prevDisabled} onClick={onPrev}>
        <ChevronLeftIcon />
      </StepButton>
      <p
        data-testid="period-label"
        aria-live="polite"
        aria-atomic="true"
        className="t-title2 min-w-44 text-center whitespace-nowrap text-ink tabular-nums lg:min-w-56"
      >
        {label}
      </p>
      <StepButton label={`${unit} următoare`} disabled={nextDisabled} onClick={onNext}>
        <ChevronRightIcon />
      </StepButton>
      <button
        type="button"
        onClick={onToday}
        aria-label="Mergi la ziua de azi"
        className={buttonClass({ variant: 'outline', size: 'compact', className: 'ms-1 h-11 px-4 lg:ms-2' })}
      >
        Azi
      </button>
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
        'flex size-11 shrink-0 items-center justify-center rounded-full border-2 [&>svg]:size-5 [&>svg]:stroke-2',
        'transition-[background-color,border-color,opacity] duration-(--duration-fast) ease-fast',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        disabled
          ? 'cursor-default border-hairline bg-page text-faint'
          : 'cursor-pointer border-accent bg-surface text-accent-ink hover:bg-accent-tint active:opacity-60',
      )}
    >
      {children}
    </button>
  );
}
