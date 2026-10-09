'use client';

import { cn } from '@/components/ui/cn';
import { RING_SELECTED, RING_SELECTED_CHECKED } from '@/components/templates/rings';

/*
 * The form's chips — T6 ChoiceChips' look (surface + e0 at rest, soft-fill on hover; picked =
 * accent-tint, accent-ink and the 2px inset accent ring), 48 / 40 from 1280. A radio chip (one of
 * many: hours, reason) or a toggle chip (scope: «Tot lacul» + the stands, multi-select).
 */

const BASE =
  't-body-strong inline-flex h-12 min-w-12 items-center justify-center rounded-control bg-surface text-ink shadow-e0 tabular-nums transition-[background-color,color,box-shadow] duration-(--duration-fast) ease-select xl:h-10 xl:min-w-10';
const ENABLED = 'cursor-pointer hover:bg-soft-fill';
const OFF = 'cursor-not-allowed opacity-50';

/** A label wrapping a visually hidden native radio (arrows move the choice, one tab stop). */
export function radioChipClass(disabled?: boolean, compact?: boolean) {
  return cn(
    BASE,
    compact ? 'px-3' : 'px-4',
    'has-checked:bg-accent-tint has-checked:text-accent-ink has-checked:hover:bg-accent-tint',
    RING_SELECTED_CHECKED,
    'has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent',
    disabled ? OFF : ENABLED,
  );
}

/** A toggle button (aria-pressed). */
export function toggleChipClass(pressed: boolean, disabled?: boolean) {
  return cn(
    BASE,
    'px-4',
    'outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
    pressed && cn('bg-accent-tint text-accent-ink hover:bg-accent-tint', RING_SELECTED),
    disabled ? OFF : ENABLED,
  );
}

type RadioChipsProps<V extends string> = {
  name: string;
  options: { value: V; label: string }[];
  value: V;
  onChange: (value: V) => void;
  disabled?: boolean;
  /** The group's accessible name: a visible label element's id… */
  labelledBy?: string;
  /** …or a label string. */
  label?: string;
  testId?: string;
  /** 12px sides (hours: two groups side by side on a phone). */
  compact?: boolean;
};

/** One of many as chips (native radios in a radiogroup). */
export function RadioChips<V extends string>({ name, options, value, onChange, disabled, labelledBy, label, testId, compact }: RadioChipsProps<V>) {
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} aria-label={labelledBy ? undefined : label} className="flex flex-wrap gap-2" data-testid={testId}>
      {options.map((o) => (
        <label key={o.value} className={radioChipClass(disabled, compact)}>
          <input
            type="radio"
            name={name}
            value={o.value}
            checked={value === o.value}
            disabled={disabled}
            onChange={() => onChange(o.value)}
            className="sr-only"
          />
          {o.label}
        </label>
      ))}
    </div>
  );
}
