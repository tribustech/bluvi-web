'use client';

import { cn } from '@/components/ui/cn';
import { SCOPE_SEGS, type StatsScope } from './model';

/*
 * fish StatisticiScene ScopeToggle (c1): «Această partidă» / «Toate partidele». A control that
 * looks like one (owner rule 20): one track, the chosen half a filled accent, hover and keyboard
 * focus on the others. Native radios (arrow keys move the choice, a screen reader hears «1 of 2»),
 * the kit SegmentedControl's anatomy without its visible legend (the tab title already names it).
 */
export function ScopeToggle({ scope, onChange }: { scope: StatsScope; onChange: (s: StatsScope) => void }) {
  return (
    <fieldset data-testid="stats-scope" className="min-w-0">
      <legend className="sr-only">Statistici pentru</legend>
      <div className="grid h-11 grid-cols-2 rounded-control border border-hairline bg-surface p-0.75 md:w-96">
        {SCOPE_SEGS.map(s => (
          <label
            key={s.key}
            className={cn(
              'flex cursor-pointer items-center justify-center rounded-[calc(var(--radius-control)-3px)] px-2 t-body-strong whitespace-nowrap',
              'transition-[background-color,color] duration-(--duration-fast) ease-select',
              'text-ink-2 hover:bg-soft-fill hover:text-ink',
              'has-checked:bg-accent has-checked:text-on-accent has-checked:hover:bg-accent has-checked:hover:text-on-accent',
              'has-focus-visible:outline-2 has-focus-visible:outline-offset-1 has-focus-visible:outline-accent',
            )}
          >
            <input
              type="radio"
              name="partida-stats-scope"
              value={s.key}
              checked={scope === s.key}
              onChange={() => onChange(s.key)}
              className="sr-only"
            />
            {s.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
