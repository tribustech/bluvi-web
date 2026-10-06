'use client';

import { useMemo, useRef, useState, type ReactNode } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import { StarIcon } from '@heroicons/react/20/solid';
import type { ColumnDefinition, RankingResponse } from '@/core/competitions';
import { CapotChip, Tag } from '@/components/cards/parts';
import { RankingTable, readCell, tiedIndices } from '@/components/ranking';
import { parseStand, sectorFill } from '@/components/ranking/sector';
import { SegmentedControl } from '@/components/forms/SegmentedControl';
import { Select } from '@/components/forms/Select';
import { useBreakpoint } from '@/components/surfaces/useBreakpoint';
import { TextInput } from '@/components/forms/TextInput';
import { ChoiceChips, type Choice } from '@/components/templates/T1';
import { PRESENCE_ICON } from '@/components/templates/T3';
import { QueryRetry } from './QueryRetry';
import { EmptyState, ErrorState } from '@/components/surfaces/StateCard';
import { cn } from '@/components/ui/cn';
import { MobileRanking } from './MobileRanking';
import { PRESSABLE_ROWS, useRowPress } from './rowPress';
import { FullViewButtons, RANKING_TOOLBAR } from './rankingShell';
import { isOfflineEmpty, OfflineState } from './offline';
import { isTableRankingType, matchesRankingSearch, rowSector, sectorsOf, type RankingTableData } from './ranking';
import {
  EMBEDDED_TABLE,
  GENERAL_TABLE_LAYOUT,
  RANKING_TABLE_FIXES,
  STATIC_PINS_LAYOUT,
  STICKY_HEAD_PAGE,
  numericShare,
  useTablePins,
} from './tableFixes';

type Mode = 'general' | 'sectors';

const ALL_SECTORS = 'toate';

/** More sectors than this (up to 24, A–X): one compact «Sector» select instead of a row of chips. */
const SELECT_SECTORS_FROM = 12;

/** One catch per column (catch1…catchN): the per-catch detail, not a deciding total. */
const isCatchColumn = (c: ColumnDefinition) => /^catch\d+$/.test(c.key);

/**
 * Clasament view. Mobile: the kit RankingRow list (stand order unless Sortare says otherwise).
 * Desktop (design): every column, every angler, General / Pe sectoare, a sector filter A–X and a
 * search by angler or stand, on the kit RankingTable — its column headers are the sort (from 768
 * there is no second sort control; the phone keeps «Sortare» in the action bar).
 */
export function RankingView({
  query,
  table,
  placeTable,
  currentUserStandId,
  custom,
  onFullView,
  rankingType,
  onRowPress,
}: {
  /** A row pressed: its stand id (the angler stats open; parity statistici-pescar.c1). */
  onRowPress?: (standId: string) => void;
  query: UseQueryResult<RankingResponse>;
  /** The competition core's ranking type (known before the ranking lands): the skeleton's shape. */
  rankingType?: string | null;
  /** From 768: «Clasament complet» (every column on the whole screen), in the table's toolbar. */
  onFullView: () => void;
  /** A ranking type with its own table (feeder legs, the club rankings): drawn by the screen. */
  custom: ReactNode;
  table: RankingTableData | null;
  placeTable: RankingTableData | null;
  currentUserStandId: string | null;
}) {
  if (isOfflineEmpty(query)) return <OfflineState onRetry={() => void query.refetch()} />;
  if (query.isPending && query.fetchStatus !== 'idle') return <RankingSkeleton kind={rankingSkeletonKind(rankingType)} />;
  if (query.isError && !query.data) {
    // fish: the error screen without a back button; its retry refetches the ranking (parity clasament.c26).
    // The page's retry contract: busy while it runs, «Tot nu s-a putut încărca.» when it fails again.
    return (
      <ErrorState
        title="Clasamentul nu a putut fi încărcat."
        description="Ceva nu a mers bine, vă rugăm să încercați din nou mai târziu."
        action={<QueryRetry fetching={query.isFetching} failed onRetry={() => void query.refetch()} size="compact" />}
      />
    );
  }
  if (query.data && !isTableRankingType(query.data.metadata.rankingType)) {
    // fish: NationalChampionshipRanking for nationalChampionship / fipsed, FeederRankingTable for feeder legs.
    return custom;
  }
  if (!table || !placeTable) {
    // fish: «Nu există date de afișat»
    return <EmptyState title="Nu există date de afișat" />;
  }

  return (
    <>
      <div className="md:hidden">
        <MobileRanking columns={table.columns} rows={table.rows} currentUserStandId={currentUserStandId} onRowPress={onRowPress} />
      </div>
      <DesktopRanking table={placeTable} currentUserStandId={currentUserStandId} onFullView={onFullView} onRowPress={onRowPress} />
    </>
  );
}

function DesktopRanking({
  table,
  currentUserStandId,
  onFullView,
  onRowPress,
}: {
  table: RankingTableData;
  currentUserStandId: string | null;
  onFullView: () => void;
  onRowPress?: (standId: string) => void;
}) {
  // The kit table sorts its own rows: a row is known by its stand cell's spoken name
  // («Sector A, stand 12», RankingTable), mapped back to the row's stand id.
  const section = useRef<HTMLElement>(null);
  const standBySpoken = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of table.rows) {
      const { sector, stand } = parseStand(r.position);
      if (r.standId) m.set(`Sector ${sector}, stand ${stand}`, r.standId);
    }
    return m;
  }, [table.rows]);
  useRowPress<HTMLTableRowElement>(
    section,
    'tbody tr',
    row => {
      const spoken = [...row.querySelectorAll('td .sr-only')].map(el => el.textContent ?? '').find(t => t.startsWith('Sector '));
      return spoken ? (standBySpoken.get(spoken) ?? null) : null;
    },
    onRowPress,
  );
  const [mode, setMode] = useState<Mode>('general');
  const [sector, setSector] = useState<string>(ALL_SECTORS);
  const [search, setSearch] = useState('');
  const sectors = useMemo(() => sectorsOf(table.rows), [table.rows]);
  const selectSectors = sectors.length > SELECT_SECTORS_FROM;
  const picked = sector === ALL_SECTORS ? null : sector;
  // 768–1279: the per-catch columns leave the inline table (Loc, Stand, Pescar and the deciding
  // totals fill the width); every column is still in «Clasament complet». Server render and 1280+:
  // the whole table.
  const compact = useBreakpoint() === 'tablet';
  const hidesCatches = compact && table.columns.some(isCatchColumn);
  const columns = useMemo(
    () => (hidesCatches ? table.columns.filter(c => !isCatchColumn(c)) : table.columns),
    [hidesCatches, table.columns],
  );

  const rows = useMemo(
    () => table.rows.filter(r => (!picked || rowSector(r) === picked) && matchesRankingSearch(r, search)),
    [table.rows, picked, search],
  );

  const generalRef = useRef<HTMLDivElement>(null);
  const pins = useTablePins(generalRef, columns, mode === 'general' ? rows.length : 0);

  // The legend names only what the visible columns draw.
  const shownKeys = columns.map(c => c.key);
  const anyShownCell = (test: (cell: ReturnType<typeof readCell>) => boolean) =>
    table.rows.some(r => shownKeys.some(k => test(readCell(r[k]))));
  const hasPenalty = table.rows.some(r => (r.penalties?.length ?? 0) > 0);
  const hasSplit = anyShownCell(c => c.isSplit);
  const hasTie = useMemo(() => tiedIndices(table.rows).size > 0, [table.rows]);
  // Quantity rankings never flag a cell (fish createQuantityRow): no star on screen, no legend entry.
  const hasBiggest = anyShownCell(c => c.isBiggest);
  const legend = (
    <Legend hasBiggest={hasBiggest} hasSplit={hasSplit} hasPenalty={hasPenalty} hasTie={hasTie} catchesHidden={hidesCatches} />
  );

  const sectorChoices: Choice<string>[] = [
    { value: ALL_SECTORS, label: 'Toate' },
    ...sectors.map(s => {
      const fill = sectorFill(s, 'var(--color-muted)');
      return {
        value: s,
        label: s,
        // The sector's dot (Fundații §01: a sector colour is only ever the 4px edge and the dot).
        leading: <span className={cn('size-2 rounded-full', fill.className)} style={fill.style} />,
      };
    }),
  ];

  const sectorOptions = [{ value: ALL_SECTORS, label: 'Toate sectoarele' }, ...sectors.map(s => ({ value: s, label: `Sector ${s}` }))];
  const sectorSelect = (className: string) => (
    <Select
      label="Sector"
      value={sector}
      onChange={e => setSector(e.target.value)}
      options={sectorOptions}
      className={cn('shrink-0 [&>label]:sr-only', className)}
    />
  );

  // The table's own controls: one band. 768–1279 (one row): Afișare, the sector select, the search
  // taking the rest, the full-screen icon. From 1280: the sector chips (a select past 12 sectors)
  // and the labelled «Clasament complet».
  const toolbar = (
    <div className={RANKING_TOOLBAR}>
      <SegmentedControl<Mode>
        label="Afișare"
        name="ranking-mode"
        value={mode}
        onChange={setMode}
        options={[
          { value: 'general', label: 'General' },
          { value: 'sectors', label: 'Pe sectoare' },
        ]}
        className="w-55 shrink-0 [&_legend]:sr-only"
      />
      {sectorSelect(cn('w-44', !selectSectors && 'xl:hidden', selectSectors && 'xl:w-50'))}
      {!selectSectors ? (
        <div className="min-w-0 flex-1 max-xl:hidden">
          <ChoiceChips name="ranking-sector" label="Filtru sector" options={sectorChoices} value={sector} onChange={setSector} />
        </div>
      ) : (
        <span className="flex-1 max-xl:hidden" />
      )}
      <TextInput
        type="search"
        label="Caută pescar sau stand"
        placeholder="Caută pescar sau stand"
        value={search}
        onChange={e => setSearch(e.target.value)}
        autoComplete="off"
        enterKeyHint="search"
        className="min-w-0 flex-1 [&>label]:sr-only xl:w-60 xl:flex-none xl:shrink-0"
      />
      <FullViewButtons onPress={onFullView} />
    </div>
  );

  const empty = <EmptyState title="Niciun pescar sau stand nu se potrivește căutării." />;

  return (
    <section ref={section} aria-label="Clasament" className={cn('hidden flex-col gap-4 md:flex', RANKING_TABLE_FIXES, PRESSABLE_ROWS)}>
      {mode === 'general' ? (
        // One card: the toolbar is its header band, then the table at its full height (no box
        // scrolling inside the page) and the legend as its footer row. The card clips (not hides)
        // its corners, so the header row can stick to the page; the kit table drops its own radius
        // and shadow inside it.
        <div
          ref={generalRef}
          data-wide={pins.wide}
          data-fade={pins.fade}
          data-static-pins={pins.staticCount}
          style={{ ...numericShare(columns), ...pins.style }}
          className={cn(
            'overflow-clip rounded-card bg-surface shadow-e0',
            EMBEDDED_TABLE,
            GENERAL_TABLE_LAYOUT,
            STATIC_PINS_LAYOUT,
            STICKY_HEAD_PAGE,
          )}
        >
          <div className="border-b border-hairline">{toolbar}</div>
          {rows.length === 0 ? (
            <div className="p-4">{empty}</div>
          ) : (
            <>
              <RankingTable
                caption="Clasament general"
                columns={columns}
                rows={rows}
                currentUserStandId={currentUserStandId}
                maxHeight="none"
              />
              {legend}
            </>
          )}
        </div>
      ) : (
        <>
          <div className="rounded-card bg-surface shadow-e0">{toolbar}</div>
          {rows.length === 0
            ? empty
            : (picked ? [picked] : sectors).map(s => {
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
                      columns={columns}
                      rows={sectorRows}
                      currentUserStandId={currentUserStandId}
                      maxHeight="none"
                    />
                  </section>
                );
              })}
          {rows.length > 0 ? <div className="rounded-card bg-surface shadow-e0">{legend}</div> : null}
        </>
      )}
    </section>
  );
}

/**
 * Design legend (table card footer). Each key is the very element the cells draw: the star, the
 * cell's «SPLIT» mark, the penalty Tag, the capot chip, the tied place.
 */
function Legend({
  hasBiggest,
  hasSplit,
  hasPenalty,
  hasTie,
  catchesHidden,
}: {
  hasBiggest: boolean;
  hasSplit: boolean;
  hasPenalty: boolean;
  hasTie: boolean;
  /** 768–1279: the per-catch columns are only in «Clasament complet». */
  catchesHidden: boolean;
}) {
  return (
    <ul
      aria-label="Legendă"
      className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-hairline px-5 py-3.5 t-caption text-muted first:border-t-0"
    >
      {hasBiggest ? (
        <li className="flex items-center gap-1.5">
          <StarIcon aria-hidden className={cn(PRESENCE_ICON.meta, 'text-rating')} />
          C.M.M.C a concursului
        </li>
      ) : null}
      {hasSplit ? (
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="t-micro text-muted">
            SPLIT
          </span>
          puncte împărțite la egalitate în sector
        </li>
      ) : null}
      {hasPenalty ? (
        <li className="flex items-center gap-1.5">
          <span aria-hidden>
            <Tag tone="yellow" size="sm">
              −kg
            </Tag>
          </span>
          penalizare aplicată
        </li>
      ) : null}
      <li className="flex items-center gap-1.5">
        <span aria-hidden>
          <CapotChip size="sm" />
        </span>
        fără captură
      </li>
      {hasTie ? (
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="t-label text-ink tabular-nums">
            =4
          </span>
          egalitate la loc
        </li>
      ) : null}
      {catchesHidden ? <li>Capturile, una câte una: în Clasament complet</li> : null}
    </ul>
  );
}

/** Which ranking is coming: the shared table, feeder legs, or a club ranking (nationalChampionship / fipsed). */
export type RankingSkeletonKind = 'table' | 'feeder' | 'nc';

export function rankingSkeletonKind(rankingType: string | null | undefined): RankingSkeletonKind {
  if (rankingType === 'feederRounds') return 'feeder';
  if (rankingType === 'nationalChampionship' || rankingType === 'fipsed') return 'nc';
  return 'table';
}

/**
 * Loading, shaped like what lands, by ranking type (the competition core says which before the
 * ranking arrives). Announced once.
 *  - `table`: on the phone the RankingRow list (edge, pill, two lines, value), from 768 the table card
 *    (its toolbar band, 40px header, 52px rows);
 *  - `feeder` / `nc`: one card at every width — its band of controls (the leg chips + «?», or the
 *    sector pills + Ordine from 768; the full-screen icon 768–1279, «Clasament complet» from 1280),
 *    then the header (feeder: two rows, 72px; nc: 40px) and 52px rows.
 */
export function RankingSkeleton({ kind = 'table' }: { kind?: RankingSkeletonKind }) {
  if (kind !== 'table') {
    const feeder = kind === 'feeder';
    return (
      <div role="status" aria-label="Se încarcă clasamentul">
        <span aria-hidden className="block overflow-hidden rounded-card bg-surface shadow-e0">
          <span className={RANKING_TOOLBAR}>
            <span className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
              {(feeder ? ['w-20', 'w-22', 'w-22'] : ['w-20', 'w-24', 'w-24', 'w-24']).map((w, i) => (
                <span key={i} className={cn('h-9 shrink-0 animate-shimmer rounded-full', w)} />
              ))}
              {feeder ? <span className="size-12 shrink-0 animate-shimmer rounded-control xl:size-10" /> : null}
            </span>
            {feeder ? null : <span className="h-11 w-80 shrink-0 animate-shimmer rounded-control max-md:hidden" />}
            <span className="size-11 shrink-0 animate-shimmer rounded-control max-md:hidden xl:h-10 xl:w-48" />
          </span>
          <span className={cn('block border-t border-hairline bg-page', feeder ? 'h-18' : 'h-10')} />
          {Array.from({ length: 8 }, (_, i) => (
            <span key={i} className="flex h-13 items-center gap-4 border-t border-hairline px-3">
              <span className="h-3 w-6 shrink-0 animate-shimmer rounded-full" />
              <span className="h-3 w-32 animate-shimmer rounded-full" />
              <span className="ml-auto h-3 w-12 animate-shimmer rounded-full" />
              <span className="h-3 w-12 animate-shimmer rounded-full max-md:hidden" />
            </span>
          ))}
        </span>
      </div>
    );
  }
  return (
    <div role="status" aria-label="Se încarcă clasamentul">
      <ul aria-hidden className="-mx-4 border-y border-hairline md:hidden">
        {Array.from({ length: 8 }, (_, i) => (
          <li
            key={i}
            className="grid grid-cols-[4px_44px_minmax(0,1fr)_auto] items-center gap-2.5 border-b border-hairline py-3 pr-3.5 last:border-b-0"
          >
            <span className="h-10 bg-soft-fill" />
            <span className="size-9 animate-shimmer rounded-control" />
            <span className="flex flex-col gap-2">
              <span className="h-3 w-3/5 animate-shimmer rounded-full" />
              <span className="h-2.5 w-2/5 animate-shimmer rounded-full" />
            </span>
            <span className="h-5 w-12 animate-shimmer rounded-full" />
          </li>
        ))}
      </ul>
      <div aria-hidden className="overflow-hidden rounded-card bg-surface shadow-e0 max-md:hidden">
        {/* The toolbar band (Afișare, sector, search, full screen), then the header row and the rows. */}
        <span className="flex items-center gap-3 border-b border-hairline px-3 py-2.5">
          <span className="h-11 w-55 shrink-0 animate-shimmer rounded-control" />
          <span className="h-11 w-44 shrink-0 animate-shimmer rounded-control xl:hidden" />
          <span className="flex min-w-0 flex-1 gap-2 overflow-hidden max-xl:hidden">
            {['w-16', 'w-12', 'w-12', 'w-12', 'w-12'].map((w, i) => (
              <span key={i} className={cn('h-9 shrink-0 animate-shimmer rounded-full', w)} />
            ))}
          </span>
          <span className="h-11 min-w-0 flex-1 animate-shimmer rounded-control xl:w-60 xl:flex-none" />
          <span className="size-11 shrink-0 animate-shimmer rounded-control xl:h-10 xl:w-48" />
        </span>
        <span className="block h-10.25 border-b border-hairline" />
        {Array.from({ length: 8 }, (_, i) => (
          <span key={i} className={cn('flex h-13 items-center gap-4 px-5', i > 0 && 'border-t border-hairline')}>
            <span className="h-3 w-6 animate-shimmer rounded-full" />
            <span className="h-3 w-10 animate-shimmer rounded-full" />
            <span className="h-3 w-40 animate-shimmer rounded-full" />
            <span className="ml-auto h-3 w-16 animate-shimmer rounded-full" />
          </span>
        ))}
      </div>
    </div>
  );
}
