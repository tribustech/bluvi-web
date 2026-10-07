'use client';

import { BarsArrowDownIcon, MapPinIcon } from '@heroicons/react/24/outline';
import { FishIcon } from '@/components/icons/brand';
import { FilterBar, FilterChipButton, FilterChipToggle } from '@/components/templates/T1';
import { hasFilters, venueChipLabel, type HistoryFilters } from './view';

/*
 * fish istoric.tsx's chip row (parity partide.istoric.c1) as the T1 horizontal filter bar (owner
 * rule 2): «Greutate» (the sort toggle), the venue chip («Baltă» / the venue / «{n} bălți», opening
 * the multi-select) and «Cu capturi». The phone line scrolls sideways; «Resetează» (T1) clears all.
 */
export function HistoryFilterBar({
  filters,
  onChange,
  onOpenVenues,
  venuesOpen,
  disabled = false,
}: {
  filters: HistoryFilters;
  onChange: (next: HistoryFilters) => void;
  onOpenVenues: () => void;
  venuesOpen: boolean;
  /** While the first list is read: the chips are shown, inert (nothing to filter yet). */
  disabled?: boolean;
}) {
  return (
    <div inert={disabled || undefined} className={disabled ? 'opacity-60' : undefined} data-testid="history-filters">
      <FilterBar label="Filtre istoric" onReset={() => onChange({ byWeight: false, venues: [], withCaptures: false })} canReset={hasFilters(filters)}>
        <FilterChipToggle
          label="Greutate"
          pressed={filters.byWeight}
          onChange={byWeight => onChange({ ...filters, byWeight })}
          leading={<BarsArrowDownIcon />}
        />
        <FilterChipButton
          label="Baltă"
          value={venueChipLabel(filters.venues)}
          onClick={onOpenVenues}
          expanded={venuesOpen}
          leading={<MapPinIcon />}
        />
        <FilterChipToggle
          label="Cu capturi"
          pressed={filters.withCaptures}
          onChange={withCaptures => onChange({ ...filters, withCaptures })}
          leading={<FishIcon />}
        />
      </FilterBar>
    </div>
  );
}
