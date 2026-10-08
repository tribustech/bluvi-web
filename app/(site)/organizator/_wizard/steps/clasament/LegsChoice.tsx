'use client';

import { useId } from 'react';
import { cn } from '@/components/ui/cn';
import { LEG_OPTIONS, legLabel } from './model';

/**
 * fish «Număr de manșe» (c9): exclusive choices «1 manșă» / «2 manșe» / «3 manșe», 2 when nothing
 * is set (fish `(value || '2')`). The kit's segmented look (native radios, arrow keys); the group is
 * named by the block header above it (`labelledBy`).
 */
export function LegsChoice({ value, disabled, labelledBy, onChange }: { value: string | undefined; disabled: boolean; labelledBy: string; onChange: (count: string) => void }) {
  const name = `manse-${useId()}`;
  const current = value || '2';
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className="grid h-11 grid-cols-3 rounded-control bg-soft-fill p-[3px] md:max-w-sm" data-testid="clasament-manse">
      {LEG_OPTIONS.map(count => (
        <label
          key={count}
          className={cn(
            'flex cursor-pointer items-center justify-center rounded-[calc(var(--radius-control)-3px)] t-control text-ink-2 whitespace-nowrap',
            'transition-[background-color,color,box-shadow] duration-(--duration-fast) ease-select',
            'has-checked:bg-surface has-checked:text-accent-ink has-checked:shadow-e1',
            'has-focus-visible:outline-2 has-focus-visible:outline-offset-1 has-focus-visible:outline-accent',
            disabled && 'cursor-not-allowed opacity-50',
          )}
        >
          <input type="radio" name={name} value={count} checked={current === count} disabled={disabled} onChange={() => onChange(count)} className="sr-only" />
          {legLabel(count)}
        </label>
      ))}
    </div>
  );
}
