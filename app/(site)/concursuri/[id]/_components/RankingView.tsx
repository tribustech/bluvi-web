'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import type { ColumnDefinition, RankingResponse } from '@/core/competitions';
import { formatPlain, isNoCatch, mainValueKey, readCell, tiedIndices, type RankingRowData } from '@/components/ranking';
import { formatRankingWeight } from '@/components/ranking/rankingColumns';
import { InlineNumber } from '@/components/ui/SignatureNumber';
import { COLUMN_STICKY_TOP_BELOW_TABS } from '@/components/templates/T3/metrics';
import { sectorFill } from '@/components/ranking/sector';
import { RANKING_HEAD } from '@/components/ranking/tableHead';
import { CompetitionRankingTable, PenaltyMarker } from './CompetitionRankingTable';
import { SegmentedControl } from '@/components/forms/SegmentedControl';
import { Select } from '@/components/forms/Select';
import { useBreakpoint } from '@/components/surfaces/useBreakpoint';
import { TextInput } from '@/components/forms/TextInput';
import { ChoiceChips, type Choice } from '@/components/templates/T1';
import { QueryRetry } from './QueryRetry';
import { EmptyState, ErrorState } from '@/components/surfaces/StateCard';
import { cn } from '@/components/ui/cn';
import { MobileRanking } from './MobileRanking';
import { PRESSABLE_ROWS } from './rowPress';
import { FullViewButtons, RANKING_TOOLBAR, useRankingPerson, useRankingRowPress } from './rankingShell';
import { isOfflineEmpty, OfflineState } from './offline';
import { isTableRankingType, matchesRankingSearch, rowSector, sectorsOf, type RankingTableData } from './ranking';
import {
  EMBEDDED_TABLE,
  GENERAL_TABLE_LAYOUT,
  RANKING_TABLE_FIXES,
  STATIC_PINS_LAYOUT,
  STICKY_HEAD_PAGE,
  useTablePins,
} from './tableFixes';

type Mode = 'general' | 'sectors';

/** From 768: the viewport minus the 64px bar, the 44px route tabs and some air (shell RANK_SCROLL_CAP). */
const TABLE_SCROLL_CAP = 'calc(100dvh - var(--spacing) * 32)';

const ALL_SECTORS = 'toate';

/** More sectors than this (up to 24, A–X): one compact «Sector» select instead of a row of chips. */
const SELECT_SECTORS_FROM = 12;

/** One catch per column (catch1…catchN): the per-catch detail, not a deciding total. */
const isCatchColumn = (c: ColumnDefinition) => /^catch\d+$/.test(c.key);

/**
 * Clasament view. Mobile: fish's ScrollableTable (MobileRanking: the kit table, the Stand pinned,
 * the columns scrolling sideways; stand order unless Sortare says otherwise), also in «Tot ecranul». Desktop (design): every column, every angler, General / Pe
 * sectoare, a sector filter A–X and a search by angler or stand, on CompetitionRankingTable (fish's
 * columns, stand order first as fish) — its column headers are the sort (from 768 there is no
 * second sort control: «Poziție generală» is fish's Sortare → Poziția în clasament; the phone keeps
 * «Sortare» in the action bar).
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
    return <CustomRanking onRowPress={onRowPress}>{custom}</CustomRanking>;
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

/**
 * The rankings the screen draws (feeder legs, the club rankings): their rows pressed open the person.
 * From 1024 the popover anchored to the row (rule 17), whatever the table — the feeder's
 * `data-registration` rows, the club ranking's `data-stand-id` + `data-registration` rows. Below,
 * the angler sheet: a club ranking row through `onRowPress` (its stand); a feeder row is the
 * screen's own (its section's row press, by registration: an entrant changes stand every leg).
 */
function CustomRanking({ onRowPress, children }: { onRowPress?: (standId: string) => void; children: ReactNode }) {
  const host = useRef<HTMLDivElement>(null);
  const person = useRankingPerson();
  useRankingRowPress(host, 'tbody tr[data-registration], tbody tr[data-stand-id]', row => {
    const { registration, standId } = row.dataset;
    if (person.open(row, { registrationId: registration, standId })) return true;
    if (standId && onRowPress) {
      onRowPress(standId);
      return true;
    }
    return false;
  });
  return (
    <div ref={host} className={PRESSABLE_ROWS}>
      {children}
      {person.popover}
    </div>
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
  // The table sorts its own rows: a row is known by its stand id (data-stand-id).
  const section = useRef<HTMLElement>(null);
  // From 1024 the person's popover anchored to the row (ROADMAP §4b.17); 768–1023 the angler sheet.
  const person = useRankingPerson();
  const pressStand = (standId: string, anchor: HTMLElement) => {
    if (person.open(anchor, { standId })) return true;
    if (!onRowPress) return false;
    onRowPress(standId);
    return true;
  };
  useRankingRowPress(section, 'tbody tr[data-stand-id]', row => pressStand(row.dataset.standId!, row));
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
  const hasPenalty = table.rows.some(r => (r.penalties?.length ?? 0) > 0 && !r.penalties?.some(p => p.action === 'ELIMINATE'));
  const hasEliminated = table.rows.some(r => r.penalties?.some(p => p.action === 'ELIMINATE'));
  const hasSplit = anyShownCell(c => c.isSplit);
  const hasTie = useMemo(() => tiedIndices(table.rows).size > 0, [table.rows]);
  // Quantity rankings never flag a cell (fish createQuantityRow): no gold cell, no legend entry.
  const hasBiggest = anyShownCell(c => c.isBiggest);
  const legend = (
    <Legend hasBiggest={hasBiggest} hasSplit={hasSplit} hasPenalty={hasPenalty} hasEliminated={hasEliminated} hasTie={hasTie} catchesHidden={hidesCatches} />
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

  // The table's own controls: one band, two groups — what is shown (Afișare, the sector: a select
  // 768–1279 or past 12 sectors, the chips from 1280) and the search with «Clasament complet» (the
  // full-screen icon 768–1279, the labelled button from 1280).
  // The band never sets the card's width (ROADMAP §4b.16): `contain: inline-size` gives it no width
  // of its own, so the card (and the column of sector tables) is as wide as the table; when the
  // table is narrower than the controls, the second group wraps under the first.
  const toolbar = (
    <div className={cn(RANKING_TOOLBAR, 'flex-wrap [contain:inline-size]')}>
      <div className="flex max-w-full min-w-0 flex-[1_1_auto] items-center gap-3">
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
        ) : null}
      </div>
      <div className="flex min-w-0 flex-[1_1_--spacing(80)] items-center justify-end gap-3">
        <TextInput
          type="search"
          label="Caută pescar sau stand"
          placeholder="Caută pescar sau stand"
          value={search}
          onChange={e => setSearch(e.target.value)}
          autoComplete="off"
          enterKeyHint="search"
          className="min-w-0 flex-1 [&>label]:sr-only"
        />
        <FullViewButtons onPress={onFullView} />
      </div>
    </div>
  );

  const empty = <EmptyState title="Niciun pescar sau stand nu se potrivește căutării." />;

  const card = mode === 'general' ? (
        // One card: the toolbar is its header band, then the table at its full height (no box
        // scrolling inside the page) and the legend as its footer row. The card clips (not hides)
        // its corners, so the header row can stick to the page; the kit table drops its own radius
        // and shadow inside it.
        <div
          ref={generalRef}
          data-wide={pins.wide}
          data-fade={pins.fade}
          data-static-pins={pins.staticCount}
          style={pins.style}
          className={cn(
            // As wide as the table (or its band of controls), never the whole column: the numbers
            // stay beside the names at 1440+ (ROADMAP §4b.16); what is left is margin.
            // No rows: nothing sizes the card, so it takes the column (the search's empty state).
            rows.length === 0 ? 'w-full' : 'w-fit max-w-full',
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
              <CompetitionRankingTable
                caption="Clasament general"
                columns={columns}
                rows={rows}
                currentUserStandId={currentUserStandId}
                // Fits: full height, the header follows the page (STICKY_HEAD_PAGE). Wider: it
                // scrolls in its own viewport-high region, where the header sticks at its top
                // (ROADMAP §4b.12) instead of leaving with the page.
                maxHeight={pins.wide ? TABLE_SCROLL_CAP : 'none'}
              />
              {legend}
            </>
          )}
        </div>
      ) : (
        // One column as wide as the widest sector table: the band of controls on top spans it, and
        // every sector table stretches to it — the number columns are fixed tracks (kit WIDTH), so
        // only the name track takes the few pixels between sectors and the columns line up down the
        // page (§4b.16: the stretch is at most the difference between the longest names).
        <div className={cn('flex max-w-full flex-col gap-4', rows.length === 0 ? 'w-full' : 'w-fit', '[&_[role=region]]:w-full')}>
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
                    <CompetitionRankingTable
                      caption={`Clasament sector ${s}`}
                      columns={columns}
                      rows={sectorRows}
                      currentUserStandId={currentUserStandId}
                      // A long sector scrolls in a viewport-high region: its header stays in view.
                      maxHeight={TABLE_SCROLL_CAP}
                    />
                  </section>
                );
              })}
          {rows.length > 0 ? <div className="rounded-card bg-surface shadow-e0">{legend}</div> : null}
        </div>
      );

  return (
    <section ref={section} aria-label="Clasament" className={cn('hidden md:block', RANKING_TABLE_FIXES, PRESSABLE_ROWS)}>
      <SideColumnLayout aside={<SectorLeaders table={table} onPress={onRowPress ? pressStand : undefined} />}>{card}</SideColumnLayout>
      {person.popover}
    </section>
  );
}

/** The side column's narrowest useful width (spacing 72, 288px) and the gap before it (24px). */
const SIDE_MIN = 288;
const SIDE_GAP = 24;

/**
 * ROADMAP §4b.16: the table stays compact (as wide as its columns) and, from 1280, the width it
 * leaves goes to a sticky side column — never dead space beside a 763px table on a 1920 screen.
 * The column only shows when the leftover is wide enough for it (measured: the table keeps its own
 * width, it is never squeezed into a sideways scroll to make room), and it steps aside while the
 * angler panel is docked (opened below 1024 or by `?pescar=`: AnglerStats, the same column's job).
 */
function SideColumnLayout({ aside, children }: { aside: ReactNode; children: ReactNode }) {
  const wrap = useRef<HTMLDivElement>(null);
  const main = useRef<HTMLDivElement>(null);
  const [room, setRoom] = useState(false);
  useEffect(() => {
    const box = wrap.current;
    const content = main.current;
    if (!box || !content) return;
    const measure = () => {
      const desktop = window.matchMedia('(min-width: 1280px)').matches;
      setRoom(desktop && box.clientWidth - content.offsetWidth - SIDE_GAP >= SIDE_MIN);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    ro.observe(content);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={wrap} className="flex items-start gap-6">
      <div ref={main} className={cn('flex max-w-full min-w-0 flex-col gap-4', room && 'shrink-0')}>
        {children}
      </div>
      {room ? (
        <div
          className={cn(
            'sticky max-h-[calc(100dvh-var(--spacing)*36)] max-w-96 min-w-0 flex-1 self-start overflow-y-auto rounded-card',
            COLUMN_STICKY_TOP_BELOW_TABS,
            // The angler panel docked beside the view (AnglerStats → ContextSurface → SidePanel).
            'in-[.flex:has(>.contents>aside)]:hidden',
          )}
        >
          {aside}
        </div>
      ) : null}
    </div>
  );
}

/** A row's main value (kg for a quantity ranking, else the ranking's own points), «–» without one. */
function mainValue(row: RankingRowData, key: string | undefined): { value: string; unit?: string } {
  if (!key) return { value: '–' };
  return key === 'quantity' ? { value: formatRankingWeight(row[key]), unit: 'kg' } : { value: formatPlain(row[key]) };
}

/**
 * The side column on the ranking (live and completed alike): who leads each sector — one line per
 * sector, its colour dot, the leader and their main value; one sector: the podium. A line opens that
 * angler as a row does (the popover from 1024, rule 17). Nobody with a catch yet: no column (ROADMAP §4b.4).
 */
function SectorLeaders({ table, onPress }: { table: RankingTableData; onPress?: (standId: string, anchor: HTMLElement) => void }) {
  const key = useMemo(() => mainValueKey(table.columns), [table.columns]);
  const title = table.columns.find(c => c.key === key)?.title;
  const sectors = useMemo(() => sectorsOf(table.rows), [table.rows]);
  const scored = table.rows.filter(r => !isNoCatch(r) && Number.isFinite(r.generalPosition) && r.generalPosition > 0);
  const byPlace = [...scored].sort((a, b) => a.generalPosition - b.generalPosition);
  const perSector = sectors.length > 1;
  const lines: { label: string; sector: string; row: RankingRowData }[] = perSector
    ? sectors.flatMap(s => {
        const inSector = byPlace.filter(r => rowSector(r) === s);
        const lead = inSector.find(r => r.sectorPosition === 1) ?? inSector[0];
        return lead ? [{ label: `Sector ${s}`, sector: s, row: lead }] : [];
      })
    : byPlace.slice(0, 3).map(r => ({ label: `Locul ${r.generalPosition}`, sector: rowSector(r), row: r }));
  if (!lines.length) return null;
  const heading = perSector ? 'Lideri pe sectoare' : 'Podium';
  return (
    <section aria-labelledby="ranking-side-title" data-ranking-side="" className="rounded-card bg-surface shadow-e0">
      <header className="flex items-baseline justify-between gap-3 border-b border-hairline px-4 py-3">
        <h3 id="ranking-side-title" className="t-heading">
          {heading}
        </h3>
        {title ? <span className="t-caption text-muted">{title}</span> : null}
      </header>
      <ul>
        {lines.map(({ label, sector, row }) => {
          const fill = sectorFill(sector, row.backgroundColor);
          const v = mainValue(row, key);
          const body = (
            <>
              <span aria-hidden className={cn('size-2.5 shrink-0 rounded-full', fill.className)} style={fill.style} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="t-caption text-muted">{label}</span>
                <span className="truncate t-body-strong text-ink">{row.participant}</span>
              </span>
              <InlineNumber value={v.value} unit={v.unit} valueClassName="t-label text-ink" />
            </>
          );
          const line = 'flex w-full items-center gap-3 px-4 py-2.5 text-left';
          return (
            <li key={`${label}-${row.standId ?? row.position}`} className="border-t border-hairline first:border-t-0">
              {onPress && row.standId ? (
                <button
                  type="button"
                  onClick={e => onPress(row.standId!, e.currentTarget)}
                  className={cn(
                    line,
                    'transition-colors duration-(--duration-fast) hover:bg-soft-fill focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-solid focus-visible:outline-accent',
                  )}
                >
                  {body}
                </button>
              ) : (
                <div className={line}>{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * Design legend (table card footer). Each key is the very element the cells draw: the gold
 * biggest-catch cell, the cell's «SPLIT» mark, the penalty marker, the no-catch «–», the tied place.
 */
function Legend({
  hasBiggest,
  hasSplit,
  hasPenalty,
  hasEliminated,
  hasTie,
  catchesHidden,
}: {
  hasBiggest: boolean;
  hasSplit: boolean;
  hasPenalty: boolean;
  hasEliminated: boolean;
  hasTie: boolean;
  /** 768–1279: the per-catch columns are only in «Clasament complet». */
  catchesHidden: boolean;
}) {
  return (
    <ul
      aria-label="Legendă"
      // Like the band: the legend wraps to the table's width, never widens the card.
      className="flex flex-wrap [contain:inline-size] items-center gap-x-5 gap-y-2 border-t border-hairline px-5 py-3.5 t-caption text-muted first:border-t-0"
    >
      {hasBiggest ? (
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="size-3.5 rounded-[4px] bg-medal-gold" />
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
          <span aria-hidden className="flex">
            <PenaltyMarker eliminated={false} label="Echipa are penalizări" />
          </span>
          penalizare aplicată
        </li>
      ) : null}
      {hasEliminated ? (
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="flex">
            <PenaltyMarker eliminated label="Echipa este eliminată" />
          </span>
          eliminat
        </li>
      ) : null}
      <li className="flex items-center gap-1.5">
        <span aria-hidden className="t-label text-ink">
          –
        </span>
        fără capturi
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
 *  - `table`: on the phone the table (MobileRanking: the header band, the Stand cell and its edge,
 *    the name, a number), from 768 the table card
 *    (its toolbar band, 44px header, 48px rows), about as wide as the compact table;
 *  - `feeder` / `nc`: one card at every width — its band of controls (the leg chips + «?», or the
 *    sector pills + Ordine from 768; the full-screen icon 768–1279, «Clasament complet» from 1280),
 *    then the header (feeder: the grey head and the Total band, 64px; nc: the indigo band, 48px)
 *    and 48px rows.
 */
export function RankingSkeleton({ kind = 'table' }: { kind?: RankingSkeletonKind }) {
  if (kind !== 'table') {
    const feeder = kind === 'feeder';
    return (
      <div role="status" aria-label="Se încarcă clasamentul">
        {/* As wide as the compact table it stands for (ROADMAP §4b.16). */}
        <span aria-hidden className={cn('block w-full overflow-hidden rounded-card bg-surface shadow-e0', feeder ? 'max-w-210' : 'max-w-320')}>
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
          {/* The header row as it lands: feeder's grey Loc · name head, then the Total group and
              one group per leg in fish's colours (the solid 32px group row over its 10% tint, the
              2px rule opening each group: two legs from 1024, one 768–1023, Total alone on the
              phone, as many as the width shows before the table scrolls); the club table's indigo
              band (48px, two-line titles). */}
          {feeder ? (
            <span className="flex h-16 border-t border-rank-line bg-rank-plain-head">
              <span className="min-w-0 flex-1" />
              {(
                [
                  ['w-34 border-rank-total', 'bg-rank-total', 'bg-rank-total-tint'],
                  ['w-48 border-rank-leg-1 max-md:hidden', 'bg-rank-leg-1', 'bg-rank-leg-1-tint'],
                  ['w-48 border-rank-leg-2 max-lg:hidden', 'bg-rank-leg-2', 'bg-rank-leg-2-tint'],
                ] as const
              ).map(([box, head, sub]) => (
                <span key={head} className={cn('flex shrink-0 flex-col border-l-2', box)}>
                  <span className={cn('h-8', head)} />
                  <span className={cn('h-8', sub)} />
                </span>
              ))}
            </span>
          ) : (
            <span className={cn('block h-12 border-t border-hairline', RANKING_HEAD)} />
          )}
          {Array.from({ length: 8 }, (_, i) => (
            <span key={i} className={cn('flex h-12 items-center gap-4 border-t border-rank-line px-3', feeder && i % 2 === 1 && 'bg-rank-zebra')}>
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
      {/* The phone's table (MobileRanking): the indigo header row, then 48px rows — the white Stand
          cell with its 4px edge, the name, the first numbers before the table scrolls sideways. */}
      <span aria-hidden className="block overflow-hidden rounded-card bg-surface shadow-e0 md:hidden">
        <span className={cn('block h-11.25', RANKING_HEAD)} />
        {Array.from({ length: 8 }, (_, i) => (
          <span key={i} className="flex h-12 items-center border-t border-rank-line">
            <span className="relative flex h-full w-19 shrink-0 items-center pl-[18px]">
              <span className="absolute inset-y-0 left-0 w-1 bg-soft-fill" />
              <span className="h-3 w-7 animate-shimmer rounded-full" />
            </span>
            <span className="flex h-full min-w-0 flex-1 items-center border-l border-rank-line pl-2.5">
              <span className="h-3 w-3/4 animate-shimmer rounded-full" />
            </span>
            <span className="flex h-full w-21 shrink-0 items-center justify-end border-l border-rank-line pr-2.5">
              <span className="h-3 w-12 animate-shimmer rounded-full" />
            </span>
          </span>
        ))}
      </span>
      <div aria-hidden className="w-full max-w-240 overflow-hidden rounded-card bg-surface shadow-e0 max-md:hidden">
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
        {/* The header row (44px, two-line titles) and the 48px rows of the compact table. */}
        <span className={cn('block h-11.25 border-b border-hairline', RANKING_HEAD)} />
        {Array.from({ length: 8 }, (_, i) => (
          <span key={i} className={cn('flex h-12 items-center gap-4 px-5', i > 0 && 'border-t border-rank-line')}>
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
