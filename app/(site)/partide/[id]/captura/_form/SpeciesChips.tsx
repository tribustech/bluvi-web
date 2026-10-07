'use client';

import { PlusIcon } from '@heroicons/react/24/outline';
import { sameSpecies, speciesKey, type TargetSpecies } from '@/core/partide';
import { cn } from '@/components/ui/cn';

/*
 * «CE AI PRINS?» (parity partide.captura.c3; fish captura.tsx species carousel): the partidă's target
 * species (or the catalog defaults) as single-select chips, then «Mai mult» (the species picker).
 * A selected species that is not among them — «Altele» (logged from the picker for this capture
 * only) or an edited catch whose species is no longer a target — shows as its own selected chip
 * after them, so the selection is never invisible. Phone: one row that scrolls sideways to the screen edge with an end
 * fade; from 768 the chips wrap.
 */

const CHIP =
  'flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-4 t-body-strong whitespace-nowrap transition-colors duration-(--duration-fast)';

export function SpeciesChips({ targets, selected, onSelect, onMore }: { targets: TargetSpecies[]; selected: TargetSpecies; onSelect: (t: TargetSpecies) => void; onMore: () => void }) {
  const chips = targets.some(t => sameSpecies(t, selected)) ? targets : [...targets, selected];
  return (
    <div className="relative -mx-4 md:mx-0">
      <div
        role="group"
        aria-labelledby="capture-species-label"
        data-testid="species-chips"
        className="flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:flex-wrap md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {chips.map(t => {
          const active = sameSpecies(t, selected);
          return (
            <button
              key={speciesKey(t)}
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(t)}
              className={cn(CHIP, active ? 'border-accent bg-accent text-on-accent' : 'border-hairline bg-surface text-ink hover:bg-soft-fill')}
            >
              {t.name}
            </button>
          );
        })}
        <button type="button" onClick={onMore} className={cn(CHIP, 'border-hairline bg-surface text-accent-ink hover:bg-soft-fill')}>
          <PlusIcon aria-hidden className="size-3.5 stroke-[2.4]" />
          Mai mult
        </button>
      </div>
      {/* The end fade: chips run past the right edge on the phone. */}
      <span aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-linear-to-r from-transparent to-page md:hidden" />
    </div>
  );
}
