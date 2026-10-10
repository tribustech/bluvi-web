'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import type { ColumnDefinition, RankingResponse } from '@/core/competitions';
import { EMPTY_STAND, cellNumber, formatPlain, isNoCatch, isPodium, readCell, type RankingRowData } from '@/components/ranking';
import { formatRankingWeight, kindOf } from '@/components/ranking/rankingColumns';
import { RankingLegend } from '@/components/ranking/RankingLegend';
import { InlineNumber } from '@/components/ui/SignatureNumber';
import { COLUMN_STICKY_TOP_BELOW_TABS } from '@/components/templates/T3/metrics';
import { sectorFill } from '@/components/ranking/sector';
import { RANKING_HEAD } from '@/components/ranking/tableHead';
import { formatCount } from '@/core/realtime/chat/format';
import { CompetitionRankingTable } from './CompetitionRankingTable';
import { SegmentedControl } from '@/components/forms/SegmentedControl';
import { Select } from '@/components/forms/Select';
import { TextInput } from '@/components/forms/TextInput';
import { ChoiceChips, type Choice } from '@/components/templates/T1';
import { QueryRetry } from './QueryRetry';
import { EmptyState, ErrorState } from '@/components/surfaces/StateCard';
import { cn } from '@/components/ui/cn';
import { MobileRanking } from './MobileRanking';
import { PRESSABLE_ROWS } from './rowPress';
import { FullViewButtons, RANKING_TOOLBAR, useRankingPerson, useRankingRowPress } from './rankingShell';
import { isOfflineEmpty, OfflineState } from './offline';
import { isTableRankingType, matchesRankingSearch, rowSector, sectorLetters, sectorsOf, type RankingTableData } from './ranking';
import {
  EMBEDDED_TABLE,
  GENERAL_TABLE_LAYOUT,
  RANKING_TABLE_FIXES,
  STATIC_PINS_LAYOUT,
  STICKY_HEAD_PAGE,
  decidingKey,
  rankingPinKeys,
  useTablePins,
} from './tableFixes';

type Mode = 'general' | 'sectors';

/** From 768: the viewport minus the 64px bar, the 44px route tabs and some air (shell RANK_SCROLL_CAP). */
const TABLE_SCROLL_CAP = 'calc(100dvh - var(--spacing) * 32)';

const ALL_SECTORS = 'toate';

/** More sectors than this (up to 24, A–X): one compact «Sector» select instead of a row of chips. */
const SELECT_SECTORS_FROM = 12;

/**
 * Clasament view. Mobile: fish's ScrollableTable (MobileRanking → FishTable: the Stand frozen,
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
  sortNonce = 0,
}: {
  /** Bumped by every Sortare pick (the bar): the phone table starts over in that order. */
  sortNonce?: number;
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
      {/* fish: the table 20px under the view chips (marginBottom 12 + the ScrollView's gap 8). */}
      <div className="mt-1 md:hidden">
        {/* Every Sortare pick (the bar) starts the table over, scrolled back to its left edge. */}
        <MobileRanking key={sortNonce} columns={table.columns} rows={table.rows} onRowPress={onRowPress} />
      </div>
      <DesktopRanking table={placeTable} currentUserStandId={currentUserStandId} onFullView={onFullView} onRowPress={onRowPress} />
    </>
  );
}

/**
 * A pressable row of the screen's own tables (feeder, club ranking) marks the pointer and the focus
 * on its cells, as the standard table (tableFixes RANKING_TABLE_FIXES): their cells paint their own
 * fills, so a row background never showed.
 */
const CUSTOM_ROW_CUE =
  '[&_tbody_tr[data-pressable]>*]:transition-[filter] [&_tbody_tr[data-pressable]>*]:duration-(--duration-fast) [&_tbody_tr[data-pressable]:hover>*]:brightness-90 [&_tbody_tr[data-pressable]:focus-visible>*]:brightness-90';

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
    <div ref={host} className={cn(PRESSABLE_ROWS, CUSTOM_ROW_CUE)}>
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
  // fish's columns at every width (parity clasament c7–c13): a table wider than its card scrolls
  // sideways with the Stand pinned at the left and the deciding columns at the right (tableFixes).
  const columns = table.columns;
  const pinRight = useMemo(() => rankingPinKeys(columns, table.rows), [columns, table.rows]);
  const letters = useMemo(() => sectorLetters(table.rows), [table.rows]);
  const multiSector = sectors.length > 1;

  const rows = useMemo(
    () => table.rows.filter(r => (!picked || rowSector(r) === picked) && matchesRankingSearch(r, search)),
    [table.rows, picked, search],
  );

  const generalRef = useRef<HTMLDivElement>(null);
  const pins = useTablePins(generalRef, columns, mode === 'general' ? rows.length : 0, table.rows);

  // The legend names only what this ranking's cells draw (the same module under the phone table).
  const legend = <RankingLegend columns={columns} rows={table.rows} />;

  const sectorChoices: Choice<string>[] = [
    { value: ALL_SECTORS, label: 'Toate' },
    ...sectors.map(s => {
      const fill = sectorFill(letters.get(s) ?? s, 'var(--color-muted)');
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
          data-pinned={pins.wide ? pins.pinned : undefined}
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
                pinRight={pinRight}
                multiSector={multiSector}
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
                const fill = sectorFill(letters.get(s) ?? s, sectorRows[0].backgroundColor);
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
                      multiSector={multiSector}
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
      <SideColumnLayout aside={<RankingSide table={table} onPress={onRowPress ? pressStand : undefined} />}>{card}</SideColumnLayout>
      {person.popover}
    </section>
  );
}

/** The side column's narrowest useful width (spacing 72, 288px) and the gap before it (24px). */
const SIDE_MIN = 288;
const SIDE_GAP = 24;

/**
 * ROADMAP §4b.16 (full-width desktop, like Facebook): the table stays compact (as wide as its
 * columns) and, from 1280, ALL the width it leaves goes to a sticky side column — a bento stack
 * (RankingSide), never dead space beside a 763px table on a 1440 / 1920 screen. The column only
 * shows when the leftover is wide enough for it (measured: the table keeps its own width, it is
 * never squeezed into a sideways scroll to make room), it is viewport-high (sticky under the tabs,
 * its own scroll when the stack is taller), and it steps aside while the angler panel is docked
 * (opened below 1024 or by `?pescar=`: AnglerStats, the same column's job).
 */
function SideColumnLayout({ aside, children }: { aside: ReactNode; children: ReactNode }) {
  const wrap = useRef<HTMLDivElement>(null);
  const main = useRef<HTMLDivElement>(null);
  const side = useRef<HTMLDivElement>(null);
  const [room, setRoom] = useState(false);
  // The stack taller than the viewport-high column: more below → the column's bottom fades out, so
  // a cut row never reads as the last one (the column scrolls on its own; the fade says so).
  const [more, setMore] = useState(false);
  useEffect(() => {
    const el = side.current;
    if (!room || !el) return;
    const update = () => setMore(el.scrollHeight - el.scrollTop - el.clientHeight > 1);
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => {
      el.removeEventListener('scroll', update);
      ro.disconnect();
    };
  }, [room]);
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
          ref={side}
          data-ranking-side-column=""
          data-more={more || undefined}
          className={cn(
            // Every pixel the table leaves (flex-1, no cap): the stack lays out by the column's width.
            '@container sticky max-h-[calc(100dvh-var(--spacing)*36)] min-w-0 flex-1 self-start overflow-y-auto rounded-bento',
            COLUMN_STICKY_TOP_BELOW_TABS,
            'data-more:[mask-image:linear-gradient(to_bottom,#000_calc(100%-4rem),transparent)]',
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

type SideValue = { value: string; unit?: string; note?: string };

/** A side tile lists at most this many sectors; the rest behind «Vezi încă N sectoare». */
const SIDE_ROWS = 8;

/** The side tiles' «more» line: the hidden sectors, counted, or back to the short list. */
function SideMore({ hidden, open, onToggle, controls }: { hidden: number; open: boolean; onToggle: () => void; controls: string }) {
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={controls}
      onClick={onToggle}
      data-ranking-side-more=""
      className="flex min-h-11 w-full items-center justify-center t-label text-accent-ink transition-colors duration-(--duration-fast) hover:bg-soft-fill focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-solid focus-visible:outline-accent"
    >
      {open ? 'Arată mai puține' : `Vezi încă ${formatCount(hidden, 'sector', 'sectoare')}`}
    </button>
  );
}

/**
 * The value a row was ranked on, for the side column: the ranking's main value (Cantitate,
 * Calitate, Medie — rankingColumns mainValueKey), else the points total; bestOfTiers: the Best N
 * the row won its place at (its green cell). Unknown: nothing (ROADMAP §4b.4 — never a bare «–»).
 */
function sideValue(row: RankingRowData, columns: ReadonlyArray<ColumnDefinition>): SideValue | null {
  const tierWin = columns.find(c => /^tier\d+$/.test(c.key) && readCell(row[c.key]).isTierWin);
  const key = tierWin?.key ?? decidingKey(columns.filter(c => !/^tier\d+$/.test(c.key)));
  if (!key || cellNumber(row[key]) === null) return null;
  const weight = kindOf(key) === 'weight' || kindOf(key) === 'tier';
  return {
    value: weight ? formatRankingWeight(row[key]) : formatPlain(row[key]),
    unit: weight ? 'kg' : undefined,
    note: tierWin?.title,
  };
}

/**
 * The side column on the ranking (live and completed alike), an Apple-style bento stack laid out by
 * the column's width (one column of tiles, two side by side from 672px): who leads (one line per
 * sector; one sector: the podium) and the sectors side by side (their kg and catches, a bar per
 * sector in its colour). Only from what the ranking already holds (the competition's totals, its
 * biggest catch and its last weighing are the strip above the view); a tile without its data is left
 * out (§4b.4). Nobody with a catch yet: no column.
 */
function RankingSide({ table, onPress }: { table: RankingTableData; onPress?: (standId: string, anchor: HTMLElement) => void }) {
  const letters = useMemo(() => sectorLetters(table.rows), [table.rows]);
  if (!table.rows.some(r => r.participant !== EMPTY_STAND && !isNoCatch(r) && r.generalPosition > 0)) return null;
  return (
    <div className="grid gap-4 @2xl:grid-cols-2 @2xl:items-start">
      <SectorLeaders table={table} letters={letters} onPress={onPress} />
      <SectorTotals table={table} letters={letters} />
    </div>
  );
}

/**
 * Who leads: one line per sector (its colour dot, the leader, the value they lead on); one sector:
 * the podium — the places 1–3 with a catch (isPodium), or, when none qualifies, «În frunte» with the
 * best three. A line opens that angler as a row does (the popover from 1024, rule 17).
 */
function SectorLeaders({
  table,
  letters,
  onPress,
}: {
  table: RankingTableData;
  letters: Map<string, string>;
  onPress?: (standId: string, anchor: HTMLElement) => void;
}) {
  const sectors = useMemo(() => sectorsOf(table.rows), [table.rows]);
  const scored = table.rows.filter(r => r.participant !== EMPTY_STAND && !isNoCatch(r) && Number.isFinite(r.generalPosition) && r.generalPosition > 0);
  const byPlace = [...scored].sort((a, b) => a.generalPosition - b.generalPosition);
  const perSector = sectors.length > 1;
  const podium = byPlace.filter(r => isPodium(r.generalPosition, isNoCatch(r)));
  const lines: { label: string; sector: string; row: RankingRowData }[] = perSector
    ? sectors.flatMap(s => {
        const inSector = byPlace.filter(r => rowSector(r) === s);
        const lead = inSector.find(r => r.sectorPosition === 1) ?? inSector[0];
        return lead ? [{ label: `Sector ${s}`, sector: s, row: lead }] : [];
      })
    : (podium.length ? podium : byPlace.slice(0, 3)).map(r => ({ label: `Locul ${r.generalPosition}`, sector: rowSector(r), row: r }));
  const [all, setAll] = useState(false);
  if (!lines.length) return null;
  const shown = all ? lines : lines.slice(0, SIDE_ROWS);
  const heading = perSector ? 'Lideri pe sectoare' : podium.length ? 'Podium' : 'În frunte';
  // One value column for every line (bestOfTiers: each line names its own Best N instead).
  const key = decidingKey(table.columns.filter(c => !/^tier\d+$/.test(c.key)));
  const title = key ? table.columns.find(c => c.key === key)?.title : undefined;
  return (
    <section aria-labelledby="ranking-side-title" data-ranking-side="" className="min-w-0 overflow-hidden rounded-bento bg-surface shadow-e0">
      <header className="flex items-baseline justify-between gap-3 border-b border-hairline px-4.5 py-3.5">
        <h3 id="ranking-side-title" className="t-heading">
          {heading}
        </h3>
        {title ? <span className="t-caption text-muted">{title}</span> : null}
      </header>
      <ul id="ranking-side-leaders">
        {shown.map(({ label, sector, row }) => {
          const fill = sectorFill(letters.get(sector) ?? sector, row.backgroundColor);
          const v = sideValue(row, table.columns);
          const body = (
            <>
              <span aria-hidden className={cn('size-2.5 shrink-0 rounded-full', fill.className)} style={fill.style} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="t-caption text-muted">
                  {label}
                  {v?.note ? ` · ${v.note}` : null}
                </span>
                <span className="truncate t-body-strong text-ink">{row.participant}</span>
              </span>
              {v ? <InlineNumber value={v.value} unit={v.unit} valueClassName="t-label text-ink" /> : null}
            </>
          );
          const line = 'flex w-full items-center gap-3 px-4.5 py-2.5 text-left';
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
      {lines.length > SIDE_ROWS ? (
        <div className="border-t border-hairline">
          <SideMore hidden={lines.length - SIDE_ROWS} open={all} onToggle={() => setAll(v => !v)} controls="ranking-side-leaders" />
        </div>
      ) : null}
    </section>
  );
}

/**
 * The sectors side by side (more than one sector): each sector's kg (a ranking with a Cantitate
 * column) and its catches, a bar in the sector's colour against the strongest sector. Neither known:
 * no tile.
 */
function SectorTotals({ table, letters }: { table: RankingTableData; letters: Map<string, string> }) {
  const [all, setAll] = useState(false);
  const sectors = sectorsOf(table.rows);
  if (sectors.length < 2) return null;
  const hasKg = table.columns.some(c => c.key === 'quantity');
  const totals = sectors.map(s => {
    const rows = table.rows.filter(r => rowSector(r) === s);
    const kg = hasKg ? rows.reduce((sum, r) => sum + (cellNumber(r.quantity) ?? 0), 0) : null;
    const counted = rows.filter(r => typeof r.catchCount === 'number');
    const catches = counted.length ? counted.reduce((sum, r) => sum + (r.catchCount ?? 0), 0) : null;
    return { sector: s, kg, catches };
  });
  const measure = (t: (typeof totals)[number]) => t.kg ?? t.catches ?? 0;
  const max = Math.max(0, ...totals.map(measure));
  if (!max) return null;
  // A sector without a catch says so once («Fără capturi», as the table's «–»), never «0 capturi
  // 0,000 kg» (§4b.11); those sectors go last, after the ones with something to compare.
  const isEmpty = (t: (typeof totals)[number]) => !t.catches && !t.kg;
  const ordered = [...totals.filter(t => !isEmpty(t)), ...totals.filter(isEmpty)];
  return (
    <section aria-labelledby="ranking-sectors-title" data-ranking-sectors="" className="min-w-0 overflow-hidden rounded-bento bg-surface p-4.5 shadow-e0">
      <h3 id="ranking-sectors-title" className="t-heading">
        Pe sectoare
      </h3>
      <ul id="ranking-side-sectors" className="mt-3 flex flex-col gap-3">
        {(all ? ordered : ordered.slice(0, SIDE_ROWS)).map(t => {
          const fill = sectorFill(letters.get(t.sector) ?? t.sector, 'var(--color-muted)');
          const empty = isEmpty(t);
          return (
            <li key={t.sector} data-empty={empty || undefined} className="flex flex-col gap-1.5">
              <span className="flex items-baseline gap-2">
                <span className={cn('t-label', empty ? 'text-muted' : 'text-ink')}>Sector {t.sector}</span>
                <span className="ml-auto flex items-baseline gap-3">
                  {empty ? (
                    <span className="t-caption text-muted">Fără capturi</span>
                  ) : (
                    <>
                      {t.catches !== null ? <span className="t-caption text-muted">{formatCount(t.catches, 'captură', 'capturi')}</span> : null}
                      {t.kg !== null ? <InlineNumber value={formatRankingWeight(t.kg)} unit="kg" valueClassName="t-label text-ink" /> : null}
                    </>
                  )}
                </span>
              </span>
              <span aria-hidden className="h-1.5 overflow-hidden rounded-full bg-soft-fill">
                {empty ? null : (
                  <span className={cn('block h-full rounded-full', fill.className)} style={{ ...fill.style, width: `${(measure(t) / max) * 100}%` }} />
                )}
              </span>
            </li>
          );
        })}
      </ul>
      {ordered.length > SIDE_ROWS ? (
        <div className="-mx-4.5 -mb-4.5 mt-3 border-t border-hairline">
          <SideMore hidden={ordered.length - SIDE_ROWS} open={all} onToggle={() => setAll(v => !v)} controls="ranking-side-sectors" />
        </div>
      ) : null}
    </section>
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
