'use client';

import { cn } from '@/components/ui/cn';
import type { JurnalFilter, LocalRod, OutcomeFilter } from '@/core/partide';

/*
 * fish JurnalScene FilterChips (parity partide.partida-jurnal.c1): «Capturi», «Scăpate», «Fără
 * trăsătură» and one «L{n}» per rod — each a toggle (multi-select), the two axes combined (core
 * filterEvents). An «on» rod chip is filled with the rod's colour, an «off» one carries it as a dot.
 * One horizontal row (owner rule 2) that scrolls sideways on a narrow phone.
 */

export const OUTCOME_CHIPS: { key: OutcomeFilter; label: string }[] = [
  { key: 'capture', label: 'Capturi' },
  { key: 'lost', label: 'Scăpate' },
  { key: 'blank', label: 'Fără trăsătură' },
];

const CHIP =
  'flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border-[1.5px] px-3 t-label whitespace-nowrap transition-colors duration-(--duration-fast) ease-fast focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

export function FilterChips({
  filter,
  rods,
  onToggleOutcome,
  onToggleRod,
}: {
  filter: JurnalFilter;
  rods: LocalRod[];
  onToggleOutcome: (o: OutcomeFilter) => void;
  onToggleRod: (index: number) => void;
}) {
  return (
    <div role="group" aria-label="Filtrează jurnalul" data-testid="jurnal-filters" className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0 [&::-webkit-scrollbar]:hidden">
      {OUTCOME_CHIPS.map(c => {
        const on = filter.outcomes.includes(c.key);
        return (
          <button
            key={c.key}
            type="button"
            aria-pressed={on}
            onClick={() => onToggleOutcome(c.key)}
            className={cn(CHIP, on ? 'border-accent bg-accent text-on-accent' : 'border-hairline bg-surface text-ink-2 hover:bg-soft-fill')}
          >
            {c.label}
          </button>
        );
      })}
      {rods.length ? <span aria-hidden className="mx-0.5 my-2 w-px shrink-0 bg-hairline" /> : null}
      {rods.map(rod => {
        const on = filter.rodIndexes.includes(rod.index);
        const color = rod.color || 'var(--color-indigo-5)';
        return (
          <button
            key={rod.index}
            type="button"
            aria-pressed={on}
            data-testid={`jurnal-filter-rod-${rod.index}`}
            onClick={() => onToggleRod(rod.index)}
            style={on ? { backgroundColor: color, borderColor: color } : undefined}
            className={cn(CHIP, on ? 'text-on-photo-scrim' : 'border-hairline bg-surface text-ink-2 hover:bg-soft-fill')}
          >
            <span aria-hidden className={cn('size-2 rounded-full', on && 'bg-on-photo-scrim')} style={on ? undefined : { backgroundColor: color }} />L{rod.index}
          </button>
        );
      })}
    </div>
  );
}
