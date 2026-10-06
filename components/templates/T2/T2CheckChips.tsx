'use client';

import type { ReactNode } from 'react';
import { cn } from '@/components/ui/cn';
import { RING_SELECTED_CHECKED } from '../rings';

/**
 * Multiple choice as pills over native checkboxes — the checkbox twin of T1 ChoiceChips (same
 * look: soft-fill at rest, accent tint + accent ink + the 2px selected ring, ../rings.ts, when checked), for the
 * filter panel's multi-select sections (Regim, Facilități, Pești). Lives inside a FilterSection,
 * whose legend names the group.
 * TODO(kit): promote with ChoiceChips to components/forms (this task may only touch T2).
 */
export function T2CheckChips<V extends { id: string; name: string }>({
  options,
  selected,
  onToggle,
  leading,
}: {
  options: ReadonlyArray<V>;
  selected: ReadonlyArray<V>;
  onToggle: (option: V) => void;
  leading?: (option: V) => ReactNode;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const checked = selected.some((s) => s.id === o.id);
        const icon = leading?.(o);
        return (
          <label
            key={o.id}
            className={cn(
              'flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3.5 t-label whitespace-nowrap',
              'transition-[background-color,color,box-shadow] duration-(--duration-fast) ease-select',
              'has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent',
              'bg-soft-fill text-ink-2 hover:text-ink',
              'has-checked:bg-accent-tint has-checked:text-accent-ink', RING_SELECTED_CHECKED,
            )}
          >
            <input type="checkbox" checked={checked} onChange={() => onToggle(o)} className="sr-only" />
            {icon ? (
              <span aria-hidden className="flex items-center [&>svg]:size-3.5">
                {icon}
              </span>
            ) : null}
            {o.name}
          </label>
        );
      })}
    </div>
  );
}
