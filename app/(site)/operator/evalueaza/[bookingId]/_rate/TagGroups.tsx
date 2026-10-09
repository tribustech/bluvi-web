'use client';

import { CheckIcon } from '@heroicons/react/20/solid';
import { groupsForRating, reviewTagLabel, type ReviewTag } from '@/core/social';
import { cn } from '@/components/ui/cn';

/**
 * fish TagChip + the tags card (operator.evalueaza-pescar.c6): at five stars only «A mers bine»,
 * below five «Nu a mers» too — a four-star stay had both. Each chip is a toggle button
 * (aria-pressed). Picked chips fill — praise green, faults red — because an outline-only selected
 * state is hard to read at arm's length; a check mark says «picked» without the colour too.
 */
export function TagGroups({
  stars,
  tags,
  onToggle,
  disabled = false,
}: {
  stars: number;
  tags: ReviewTag[];
  onToggle: (tag: ReviewTag) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-5">
      {groupsForRating(stars).map((group) => {
        const id = `etichete-${group.polarity}`;
        return (
          <div key={group.polarity} role="group" aria-labelledby={id} className="flex flex-col gap-2.5" data-testid={`tags-${group.polarity}`}>
            <h3 id={id} className="t-body-strong text-ink">
              {group.label}
            </h3>
            <ul className="flex flex-wrap gap-2">
              {group.tags.map((tag) => {
                const on = tags.includes(tag);
                return (
                  <li key={tag}>
                    <button
                      type="button"
                      aria-pressed={on}
                      disabled={disabled}
                      onClick={() => onToggle(tag)}
                      className={cn(
                        't-caption xl:t-body-strong inline-flex h-10 items-center gap-1.5 rounded-full border px-3.5 font-bold transition-[background-color,border-color,color] duration-(--duration-fast) ease-fast',
                        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50',
                        on
                          ? group.polarity === 'positive'
                            ? 'border-success bg-success text-on-accent'
                            : 'border-live bg-live text-on-accent'
                          : 'border-hairline bg-surface text-ink-2 hover:bg-soft-fill',
                      )}
                    >
                      {on ? <CheckIcon aria-hidden className="-ml-0.5 size-4" /> : null}
                      {reviewTagLabel(tag) ?? tag}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
