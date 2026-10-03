'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import { ArrowsUpDownIcon, ExclamationTriangleIcon, MagnifyingGlassIcon, StarIcon } from '@heroicons/react/20/solid';
import type { RankingResponse } from '@/core/competitions';
import { RankingTable, readCell, tiedIndices } from '@/components/ranking';
import { sectorFill } from '@/components/ranking/sector';
import { SegmentedControl } from '@/components/forms/SegmentedControl';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState, LoadingRow } from '@/components/surfaces/StateCard';
import { cn } from '@/components/ui/cn';
import { MobileRankingGrid } from './MobileRankingGrid';
import {
  isTableRankingType,
  matchesRankingSearch,
  rowSector,
  sectorsOf,
  type RankingSort,
  type RankingTableData,
} from './ranking';

type Mode = 'general' | 'sectors';

/**
 * Clasament view. Mobile: fish's table (stand order unless Sortare says otherwise). Desktop
 * (design): every column, every angler, General / Pe sectoare, a sector filter A–X and a search
 * by angler or stand, on the kit RankingTable (sortable headers, place order by default).
 */
export function RankingView({
  query,
  table,
  placeTable,
  currentUserStandId,
}: {
  query: UseQueryResult<RankingResponse>;
  table: RankingTableData | null;
  placeTable: RankingTableData | null;
  currentUserStandId: string | null;
}) {
  if (query.isPending && query.fetchStatus !== 'idle') {
    return (
      <div className="flex flex-col gap-2">
        <LoadingRow label="Se încarcă clasamentul…" />
        <LoadingRow />
      </div>
    );
  }
  if (query.isError && !query.data) {
    return (
      <ErrorState
        title="Ceva nu a mers bine, vă rugăm să încercați din nou mai târziu."
        action={
          <Button size="compact" variant="secondary" onClick={() => void query.refetch()}>
            Reîncearcă
          </Button>
        }
      />
    );
  }
  if (query.data && !isTableRankingType(query.data.metadata.rankingType)) {
    // fish has a separate club ranking for nationalChampionship / fipsed (NationalChampionshipRanking).
    return <EmptyState title="Clasamentul pe cluburi nu este încă disponibil pe web." />;
  }
  if (!table || !placeTable) {
    // fish: «Nu există date de afișat»
    return <EmptyState title="Nu există date de afișat" />;
  }

  return (
    <>
      <div className="md:hidden">
        <MobileRankingGrid columns={table.columns} rows={table.rows} caption="Clasament" />
      </div>
      <DesktopRanking table={placeTable} currentUserStandId={currentUserStandId} />
    </>
  );
}

function DesktopRanking({ table, currentUserStandId }: { table: RankingTableData; currentUserStandId: string | null }) {
  const [mode, setMode] = useState<Mode>('general');
  const [sector, setSector] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  // Design «Poziția în clasament» / «Stand»: the bar's sort (mobile: the Sortare tile).
  const [sortBy, setSortBy] = useState<RankingSort>('position');
  const sectors = useMemo(() => sectorsOf(table.rows), [table.rows]);
  const sectionRef = useRef<HTMLElement>(null);
  const manySectors = sectors.length > 8;


  const rows = useMemo(
    () => table.rows.filter(r => (!sector || rowSector(r) === sector) && matchesRankingSearch(r, search)),
    [table.rows, sector, search],
  );
  // The kit RankingTable owns its sort (no controlled prop yet): the bar drives it through the
  // table's own header buttons, Loc (1st column) or Stand (2nd), ascending. Re-applied whenever
  // a table remounts (mode, sector, search).
  useEffect(() => {
    const nth = sortBy === 'position' ? 1 : 2;
    sectionRef.current?.querySelectorAll<HTMLTableCellElement>(`thead th:nth-child(${nth})`).forEach(th => {
      if (th.getAttribute('aria-sort') !== 'ascending') th.querySelector('button')?.click();
    });
  }, [sortBy, mode, sector, search, rows.length]);
  const hasPenalty = table.rows.some(r => (r.penalties?.length ?? 0) > 0);
  const hasSplit = table.rows.some(r => Object.values(r).some(v => typeof v === 'object' && v !== null && 'isSplit' in v && v.isSplit));
  const hasTie = useMemo(() => tiedIndices(table.rows).size > 0, [table.rows]);
  // Quantity rankings never flag a cell (fish createQuantityRow): no star on screen, no legend entry.
  const hasBiggest = table.rows.some(r => Object.values(r).some(v => readCell(v).isBiggest));
  const legend = <Legend hasBiggest={hasBiggest} hasSplit={hasSplit} hasPenalty={hasPenalty} hasTie={hasTie} />;

  return (
    <section ref={sectionRef} aria-label="Clasament" className="hidden flex-col gap-4.5 md:flex">
      <div className="flex flex-wrap items-center gap-3 rounded-card bg-surface px-3 py-2.5 shadow-e0">
        <SegmentedControl<Mode>
          label="Afișare"
          name="ranking-mode"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'general', label: 'General' },
            { value: 'sectors', label: 'Pe sectoare' },
          ]}
          className="w-[220px] shrink-0 [&_legend]:sr-only"
        />
        <span aria-hidden className={cn('h-6 w-px shrink-0 bg-hairline', manySectors && 'hidden')} />
        {/*
         * Up to 24 sectors (A–X): the chips wrap rather than scroll out of sight. With many sectors
         * they take a full row under the controls (wrapping between them would stack 4 lines).
         */}
        <div
          role="group"
          aria-label="Filtru sector"
          className={cn('flex min-w-0 flex-1 flex-wrap gap-1.5 py-0.5', manySectors && 'order-last basis-full')}
        >
          <SectorChip label="Toate" selected={sector === null} onClick={() => setSector(null)} />
          {sectors.map(s => (
            <SectorChip key={s} label={s} sector={s} selected={sector === s} onClick={() => setSector(sector === s ? null : s)} />
          ))}
        </div>
        <button
          type="button"
          onClick={() => setSortBy(sortBy === 'position' ? 'stand' : 'position')}
          aria-label={`Sortare clasament: ${sortBy === 'position' ? 'după poziția în clasament' : 'după stand'}. Schimbă sortarea.`}
          className="ml-auto flex h-9.5 shrink-0 items-center gap-1.5 rounded-control bg-soft-fill px-3 t-control whitespace-nowrap text-ink transition-colors duration-(--duration-fast) hover:bg-hairline"
        >
          <ArrowsUpDownIcon aria-hidden className="size-[15px] text-accent" />
          {sortBy === 'position' ? 'Poziția în clasament' : 'Stand'}
        </button>
        {/* Below xl the search takes its own row, so the sector chips get the full width. */}
        <label className="flex h-10 w-[220px] shrink-0 items-center md:max-xl:order-last md:max-xl:w-full md:max-xl:basis-full gap-2 rounded-control bg-soft-fill px-3">
          <MagnifyingGlassIcon aria-hidden className="size-4 shrink-0 text-muted" />
          <span className="sr-only">Caută pescar sau stand</span>
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Caută pescar sau stand"
            className="h-full min-w-0 flex-1 bg-transparent t-body text-ink outline-none placeholder:text-muted"
          />
        </label>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="Niciun pescar sau stand nu se potrivește căutării." />
      ) : mode === 'general' ? (
        // Design: the whole table in the page flow, the legend as the card's footer row. The kit
        // table is its own card; inside this one it drops its radius and shadow.
        <div className="overflow-hidden rounded-card bg-surface shadow-e0 [&>[role=region]]:rounded-none [&>[role=region]]:shadow-none">
          <RankingTable
            caption="Clasament general"
            columns={table.columns}
            rows={rows}
            currentUserStandId={currentUserStandId}
            maxHeight="none"
          />
          {legend}
        </div>
      ) : (
        (sector ? [sector] : sectors).map(s => {
          const sectorRows = rows.filter(r => rowSector(r) === s);
          if (!sectorRows.length) return null;
          const fill = sectorFill(s, sectorRows[0].backgroundColor);
          return (
            <section key={s} aria-labelledby={`sector-${s}`} className="flex flex-col gap-2">
              <h2 id={`sector-${s}`} className="flex items-center gap-2 t-title2">
                <span aria-hidden className={cn('size-2.5 rounded-full', fill.className)} style={fill.style} />
                Sector {s}
              </h2>
              <RankingTable
                caption={`Clasament sector ${s}`}
                columns={table.columns}
                rows={sectorRows}
                currentUserStandId={currentUserStandId}
                maxHeight="none"
              />
            </section>
          );
        })
      )}

      {mode === 'sectors' && rows.length > 0 ? (
        <div className="rounded-card bg-surface shadow-e0">{legend}</div>
      ) : null}
    </section>
  );
}

/** Design legend (table card footer). The tie entry only when the ranking has ties. */
function Legend({
  hasBiggest,
  hasSplit,
  hasPenalty,
  hasTie,
}: {
  hasBiggest: boolean;
  hasSplit: boolean;
  hasPenalty: boolean;
  hasTie: boolean;
}) {
  return (
    <ul
      aria-label="Legendă"
      className="flex flex-wrap items-center gap-x-4.5 gap-y-2 border-t border-hairline px-4.5 py-3.5 t-caption text-muted first:border-t-0"
    >
      {hasBiggest ? (
        <li className="flex items-center gap-1.5">
          <StarIcon aria-hidden className="size-3.5 text-rating" />
          C.M.M.C a concursului
        </li>
      ) : null}
      {hasSplit ? (
        <li className="flex items-center gap-1.5">
          <span className="t-micro-strong text-accent">SPLIT</span>
          puncte împărțite la egalitate în sector
        </li>
      ) : null}
      {hasPenalty ? (
        <li className="flex items-center gap-1.5">
          <ExclamationTriangleIcon aria-hidden className="size-3.5 text-yellow-5" />
          penalizare aplicată
        </li>
      ) : null}
      <li>„–” = fără captură (capot)</li>
      {hasTie ? <li>„=” egalitate la loc</li> : null}
    </ul>
  );
}

function SectorChip({
  label,
  sector,
  selected,
  onClick,
}: {
  label: string;
  sector?: string;
  selected: boolean;
  onClick: () => void;
}) {
  const fill = sector ? sectorFill(sector, 'var(--color-muted)') : null;
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={sector ? `Sector ${sector}` : 'Toate sectoarele'}
      onClick={onClick}
      className={cn(
        'flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 t-control transition-colors duration-(--duration-fast)',
        selected ? 'bg-accent text-on-accent' : 'bg-soft-fill text-ink hover:bg-hairline',
      )}
    >
      <span
        aria-hidden
        className={cn('size-2 rounded-full', selected ? 'bg-on-accent' : fill?.className)}
        style={selected ? undefined : fill?.style}
      />
      {label}
    </button>
  );
}
