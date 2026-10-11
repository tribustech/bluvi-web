'use client';

import type { NcGeneralSort, NcSectorSort } from '@/core/competitions';
import { sectorFill } from '@/components/ranking/sector';
import { RankingTabs, type RankingTab } from '@/components/ranking/RankingTabs';
import { SegmentedControl } from '@/components/forms/SegmentedControl';
import { cn } from '@/components/ui/cn';

/*
 * National Championship / FIPSed: the desktop ranking card's band (NcSectorPills: General and every
 * sector; NcSortControl: the order) and the view / sort state fish NationalChampionshipRanking keeps.
 * The tables themselves are fish's at every width (FishNc.tsx; owner 2026-10-11).
 */

export type NcView = 'general' | string;
export type NcSort = NcGeneralSort | NcSectorSort;

/** fish handleSelectSectorView: keep the sort when the new view offers it, else position. */
export function ncSortFor(view: NcView, sort: NcSort): NcSort {
  const options: NcSort[] = view === 'general' ? ['club', 'position'] : ['stand', 'position'];
  return options.includes(sort) ? sort : 'position';
}

export const NC_SORT_LABEL: Record<NcSort, string> = { club: 'Club', stand: 'Stand', position: 'Poziția în clasament' };


/** The tab strip (kit RankingTabs): General plus every sector of the competition, each with its colour dot. */
export function NcSectorPills({
  sectors,
  value,
  onChange,
}: {
  sectors: { documentId: string; name: string }[];
  value: NcView;
  onChange: (v: NcView) => void;
}) {
  const options: RankingTab<string>[] = [
    { value: 'general', label: 'General' },
    ...sectors.map(s => {
      const fill = sectorFill(s.name, 'var(--color-muted)');
      return {
        value: s.documentId,
        label: `Sector ${s.name}`,
        leading: <span className={cn('size-2 rounded-full', fill.className)} style={fill.style} />,
      };
    }),
  ];
  // One segmented strip (ROADMAP §4b.20): the selected view filled accent, the rest on the track.
  return <RankingTabs name="nc-sector" label="Clasament pe" options={options} value={value} onChange={onChange} />;
}

/** From 768 the order is chosen here (the phone keeps «Sortare» in the action bar, as fish). */
export function NcSortControl({ view, value, onChange }: { view: NcView; value: NcSort; onChange: (s: NcSort) => void }) {
  const options = (view === 'general' ? (['club', 'position'] as const) : (['stand', 'position'] as const)).map(v => ({
    value: v as NcSort,
    label: NC_SORT_LABEL[v],
  }));
  return (
    <SegmentedControl<NcSort>
      label="Ordine"
      name="nc-sort"
      value={value}
      onChange={onChange}
      options={options}
      className="w-80 shrink-0 [&_legend]:sr-only"
    />
  );
}
