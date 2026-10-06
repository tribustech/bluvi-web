'use client';

import { useId, type ReactNode } from 'react';
import { cn } from '@/components/ui/cn';

/** One tab of the strip: its value, its label, and an optional leading mark (a sector's dot). */
export type RankingTab<V extends string> = { value: V; label: string; leading?: ReactNode };

/**
 * The tab strip a ranking card carries in its band (ROADMAP §4b.20): the feeder's General | Manșa
 * 1 … N, the National Championship's General | Sector A … — one segmented container, never loose
 * text on the page.
 *
 *  - the container: the soft-fill track with a hairline, so it reads as one control on the card's
 *    surface (and on the page grey);
 *  - the selected tab: filled accent, on-accent ink, lifted (a sector's dot gets an on-accent ring
 *    so it stays visible on the indigo);
 *  - hover: the unselected tab takes the surface; focus: the accent ring (keyboard only);
 *  - native radios (a radiogroup named by `label`): the arrow keys move the selection.
 *
 * Wider than its box it scrolls sideways on one line (the scrollbar hidden), never wraps.
 */
export function RankingTabs<V extends string>({
  name,
  label,
  options,
  value,
  onChange,
  className,
}: {
  name: string;
  label: string;
  options: RankingTab<V>[];
  value: V;
  onChange: (value: V) => void;
  className?: string;
}) {
  const uid = useId();
  return (
    <div
      role="radiogroup"
      aria-label={label}
      data-ranking-tabs=""
      className={cn(
        'flex max-w-full min-w-0 gap-1 overflow-x-auto rounded-full bg-soft-fill p-1 ring-1 ring-hairline ring-inset',
        '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className,
      )}
    >
      {options.map(o => (
        <label
          key={o.value}
          className={cn(
            'group/tab flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3.5 t-label whitespace-nowrap text-ink-2',
            'transition-[background-color,color,box-shadow] duration-(--duration-fast) ease-select',
            'hover:bg-surface hover:text-ink',
            // No fade into the selected state: a mid-transition indigo under white text is under AA.
            'has-checked:bg-accent has-checked:text-on-accent has-checked:shadow-e1 has-checked:transition-none has-checked:hover:bg-accent has-checked:hover:text-on-accent',
            'has-focus-visible:outline-2 has-focus-visible:-outline-offset-2 has-focus-visible:outline-solid has-focus-visible:outline-accent',
            'has-checked:has-focus-visible:outline-on-accent',
          )}
        >
          <input
            type="radio"
            name={`${name}-${uid}`}
            value={o.value}
            checked={value === o.value}
            onChange={() => onChange(o.value)}
            className="sr-only"
          />
          {o.leading ? (
            <span aria-hidden className="flex items-center rounded-full group-has-checked/tab:ring-2 group-has-checked/tab:ring-on-accent">
              {o.leading}
            </span>
          ) : null}
          <span>{o.label}</span>
        </label>
      ))}
    </div>
  );
}
