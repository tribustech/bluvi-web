'use client';

import { useId } from 'react';
import { cn } from '@/components/ui/cn';

/*
 * fish components/profile/FilterChips.tsx — one row of single-choice chips (the Concursuri tab has
 * two independent rows: kind and year; parity account.angler-profile c26). fish's look: the chosen
 * chip filled accent with white text, the others white with a hairline. A native radio group
 * (arrow keys move the choice, Tab leaves the row), named by `label`. The row scrolls sideways on a
 * phone (the fish ScrollView), wraps from 768.
 */

export type ChipOption<V extends string> = { value: V; label: string };

export function FilterChips<V extends string>({
  options,
  selected,
  onSelect,
  label,
  className,
}: {
  options: ChipOption<V>[];
  selected: V;
  onSelect: (value: V) => void;
  /** The group's accessible name («Tip concurs», «An»). */
  label: string;
  className?: string;
}) {
  const name = useId();
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        'flex gap-2 overflow-x-auto px-4 py-0.5 [scrollbar-width:none] md:flex-wrap md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden',
        className,
      )}
    >
      {options.map(o => {
        const checked = o.value === selected;
        return (
          <label
            key={o.value}
            className={cn(
              'flex h-9 shrink-0 cursor-pointer items-center rounded-full px-3.5 t-label whitespace-nowrap select-none',
              'transition-[background-color,color] duration-(--duration-fast) ease-fast',
              'has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-solid has-focus-visible:outline-accent',
              checked ? 'bg-accent text-on-accent' : 'bg-surface text-ink shadow-e0 hover:bg-soft-fill',
            )}
          >
            <input type="radio" name={name} value={o.value} checked={checked} onChange={() => onSelect(o.value)} className="sr-only" />
            {o.label}
          </label>
        );
      })}
    </div>
  );
}
