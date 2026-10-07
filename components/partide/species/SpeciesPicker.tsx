'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckIcon } from '@heroicons/react/24/outline';
import { fishesQuery } from '@/core/lakes';
import { resolveDefaultTargets, sameSpecies, sortCatalog, toCatalogFish, type CatalogFish, type TargetSpecies } from '@/core/partide';
import { ResponsiveSurface } from '@/components/surfaces/ResponsiveSurface';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { createBrowserTransport } from '@/lib/client/transport';

/*
 * «Specii țintă» — the fish-species multi-select (fish features/partide/components/SpeciesPickerSheet.tsx),
 * shared by the capture flow («Mai mult»), the partidă's Setări and Începe. Rows are the CMS fish
 * catalog (GET /fishes, sorted by competitionPriority — fish useFishCatalog); while it is unknown or
 * empty, the four fallback names. The current targets are checked and listed first. «Salvează» hands
 * back the selection (deduped by `sameSpecies`: a fallback-era null-id entry and its catalog twin are
 * one fish). With `includeAltele` (capture only) a pinned «Altele» row logs THIS capture as «Altele»
 * and leaves the targets alone.
 *
 * A bottom sheet on the phone, a dialog from 768 (ResponsiveSurface «info»): the list scrolls, the
 * «Salvează» stays pinned.
 */

/** Fallback rows carry a synthetic `name:<name>` id — mapped back to `id: null` for sameSpecies. */
const asTarget = (f: CatalogFish): TargetSpecies => ({ id: f.id.startsWith('name:') ? null : f.id, name: f.name });

export function SpeciesPicker({
  open,
  initial,
  includeAltele = false,
  onSave,
  onPickAltele,
  onClose,
}: {
  open: boolean;
  /** The current targets — checked and listed first, in order. */
  initial: TargetSpecies[];
  includeAltele?: boolean;
  onSave: (targets: TargetSpecies[]) => void;
  onPickAltele?: () => void;
  onClose: () => void;
}) {
  // Mounted per opening, so the selection is seeded from `initial` each time (fish re-seeds on open).
  return open ? <PickerBody initial={initial} includeAltele={includeAltele} onSave={onSave} onPickAltele={onPickAltele} onClose={onClose} /> : null;
}

function PickerBody({
  initial,
  includeAltele,
  onSave,
  onPickAltele,
  onClose,
}: {
  initial: TargetSpecies[];
  includeAltele: boolean;
  onSave: (targets: TargetSpecies[]) => void;
  onPickAltele?: () => void;
  onClose: () => void;
}) {
  const t = useMemo(() => createBrowserTransport(), []);
  const fishes = useQuery(fishesQuery(t));
  const [selected, setSelected] = useState<TargetSpecies[]>(initial);

  const rows = useMemo((): CatalogFish[] => {
    const catalog = fishes.data?.length ? sortCatalog(fishes.data.map(toCatalogFish)) : [];
    const base: CatalogFish[] = catalog.length
      ? catalog
      : resolveDefaultTargets([]).map(f => ({ id: f.id ?? `name:${f.name}`, name: f.name, priority: null, defaultRank: null }));
    const first = base.filter(f => initial.some(s => sameSpecies(s, asTarget(f))));
    const rest = base.filter(f => !initial.some(s => sameSpecies(s, asTarget(f))));
    return [...first, ...rest];
  }, [fishes.data, initial]);

  const isSelected = (f: CatalogFish) => selected.some(s => sameSpecies(s, asTarget(f)));
  const toggle = (f: CatalogFish) => {
    const target = asTarget(f);
    setSelected(prev => (prev.some(s => sameSpecies(s, target)) ? prev.filter(s => !sameSpecies(s, target)) : [...prev, target]));
  };

  return (
    <ResponsiveSurface
      open
      onClose={onClose}
      intent="info"
      title="Specii țintă"
      sheetSnap={0.9}
      pinnedActions
      actions={
        <Button
          type="button"
          block
          className="md:w-auto"
          data-testid="species-picker-save"
          onClick={() => {
            // Defensive: never emit two entries considered the same species.
            onSave(selected.filter((s, i) => selected.findIndex(o => sameSpecies(o, s)) === i));
            onClose();
          }}
        >
          Salvează
        </Button>
      }
    >
      <div data-testid="species-picker" className="flex flex-col gap-1">
        <ul aria-label="Specii" className="flex flex-col gap-1">
          {rows.map(f => {
            const checked = isSelected(f);
            return (
              <li key={f.id}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={checked}
                  onClick={() => toggle(f)}
                  className={cn(
                    'flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-control px-3.5 text-left transition-colors duration-(--duration-fast)',
                    checked ? 'bg-accent-tint text-ink' : 'text-ink hover:bg-soft-fill',
                  )}
                >
                  <span className={cn('min-w-0 flex-1 truncate', checked ? 't-body-strong' : 't-body')}>{f.name}</span>
                  {checked ? <CheckIcon aria-hidden className="size-5 shrink-0 stroke-[2.4] text-accent" /> : null}
                </button>
              </li>
            );
          })}
        </ul>
        {includeAltele && onPickAltele ? (
          <div className="mt-2 border-t border-hairline pt-2">
            <button
              type="button"
              onClick={() => {
                onPickAltele();
                onClose();
              }}
              className="flex min-h-12 w-full cursor-pointer items-center rounded-control px-3.5 text-left t-body-strong text-ink-2 hover:bg-soft-fill"
            >
              Altele
            </button>
          </div>
        ) : null}
      </div>
    </ResponsiveSurface>
  );
}
