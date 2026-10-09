'use client';

import { cn } from '@/components/ui/cn';
import { MODE_OPTIONS, type AnglerMode } from './model';

/*
 * «Cont Bluvi» / «Fără cont» — fish review.tsx ModeToggle (c5): a two-way pill toggle on the soft
 * fill, the chosen half a raised surface. A segmented control that reads as one (owner rule 20):
 * one track, a strong selected state (surface + shadow + ink, the other muted), hover and keyboard
 * focus. Sized to its two labels from 768 (≤ 384 px, two equal segments), full width on a phone.
 * Native radios (arrow keys move the choice, a group name for assistive tech); the card's
 * own title («Date pescar») names it on screen, the legend only for screen readers.
 */
export function AnglerModeSwitch({
  value,
  onChange,
  disabled = false,
}: {
  value: AnglerMode;
  onChange: (mode: AnglerMode) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset className="min-w-0 md:max-w-sm" disabled={disabled} data-testid="walkin-mode">
      <legend className="sr-only">Pentru cine este rezervarea</legend>
      <div className="grid h-11 grid-cols-2 rounded-control bg-soft-fill p-[3px]">
        {MODE_OPTIONS.map((o) => (
          <label
            key={o.value}
            data-testid={`walkin-mode-${o.value}`}
            className={cn(
              't-control flex cursor-pointer items-center justify-center rounded-[calc(var(--radius-control)-3px)] text-ink-2',
              'transition-[background-color,color,box-shadow] duration-(--duration-fast) ease-select',
              'hover:text-ink has-checked:bg-surface has-checked:text-accent-ink has-checked:shadow-e1',
              'has-focus-visible:outline-2 has-focus-visible:outline-offset-1 has-focus-visible:outline-accent',
              'has-disabled:cursor-not-allowed',
            )}
          >
            <input
              type="radio"
              name="walkin-mode"
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              className="sr-only"
            />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
