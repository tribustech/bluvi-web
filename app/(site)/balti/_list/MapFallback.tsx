'use client';

import { FilterButton } from '@/components/templates/T1';
import {
  T2BackLink,
  T2FilterChip,
  T2Layout,
  T2ListHeader,
  T2Map,
  T2SearchPill,
  T2Toolbar,
} from '@/components/templates/T2';
import { EMPTY_LAKE_FILTERS, getLakeFilterChips } from '@/core/lakes';
import { routes } from '@/lib/routes';
import { CHIP_ICONS } from './FiltersPanel';
import { ResultCardsSkeleton } from './ResultCards';

/*
 * The results map before its URL is read (the route's Suspense fallback): the same T2 frame with a
 * disabled toolbar, the list skeleton and the map's chrome without a MapLibre instance (fish c18:
 * a results skeleton until the first list page). Nothing moves when LakesMap replaces it.
 */
const noop = () => {};

export function MapFallback() {
  return (
    <T2Layout
      toolbar={
        <T2Toolbar
          title="Hartă bălți"
          disabled
          leading={<T2BackLink href={routes.lakes()} label="Înapoi la Bălți" />}
          search={<T2SearchPill summary="Caută bălți, lacuri..." placeholder searchLabel="Caută bălți, lacuri" onSearch={noop} />}
          filtersButton={<FilterButton desktopHidden={false} onClick={noop} className="max-md:shadow-e2!" />}
          filters={getLakeFilterChips(EMPTY_LAKE_FILTERS).map((chip) => (
            <T2FilterChip key={chip.key} label={chip.label} icon={CHIP_ICONS[chip.key]} kind={chip.key === 'booking' ? 'toggle' : 'menu'} onClick={noop} />
          ))}
        />
      }
      listLabel="Rezultate"
      listHeader={<T2ListHeader title="" loading />}
      list={<ResultCardsSkeleton />}
      busy
      map={
        <T2Map
          label="Hartă bălți"
          points={[]}
          pointLabel={() => ''}
          placeholder
          veil={<div aria-hidden className="size-full animate-shimmer opacity-80 md:opacity-40" />}
        />
      }
      announcement="Se încarcă rezultatele"
      sheetSnap="half"
      onSheetSnapChange={noop}
      showListLabel="Vezi lista"
    />
  );
}
