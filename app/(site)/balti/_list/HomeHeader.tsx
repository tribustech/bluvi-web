'use client';

import { ArrowPathRoundedSquareIcon, ChevronDownIcon, ListBulletIcon, MagnifyingGlassIcon, MapIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { UNDER_BAR_TOP } from '@/components/nav/shell';
import { FishOutlineIcon } from '@/components/nav/brand';
import { CONTROL_H, FilterButton } from '@/components/templates/T1';
import { T2_EXPANDED } from '@/components/templates/T2';
import { buttonClass } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { routes } from '@/lib/routes';
import { WaterKindSwitch } from './WaterKindSwitch';

/*
 * The Bălți home's search header — one designed unit (owner rule 6, ROADMAP §4b, 2026-10-06): the
 * Bălți / Ape publice switch (fish's SegmentedToggle; the h1 is for screen readers), the search pill
 * (fish LakesSearchBubble, lakes.home.c4) taking the rest of the row, «Filtre» (c5), and from 768
 * the map as the row's primary action — «Arată harta», filled accent, icon and label (never a small
 * tool lost at the end). The group spans the content width, so no dead band opens after it. On a
 * phone the floating «Arată harta» carries the map (c23); fish hides the map entry at
 * totalLakesCount 0 (lakes.home.s10), so does the web.
 *
 * Right under it, attached, the icon categories (rule 5: Airbnb's row; each one filters the grid
 * below in place — HomeGrid CategoryBar). The map page shows the same search row (LakesSearchRow) in
 * the same place, its toggle reading «Arată lista», with its quick chips in the categories' slot.
 *
 * Sticky under the top bar (c27), on the shell's under-bar offset (UNDER_BAR_TOP, on the bar's own
 * timing: up to the edge when the phone's top bar slides away). Once stuck it gets its edge — a
 * hairline — and a fade into the rows that scroll under it. On a phone only the search + «Filtre»
 * row sticks: the Bălți / Ape publice switch sits above it and scrolls away with the page (the
 * stuck block stays one control high, ≈ 64px of an 812px screen). Without handlers (the first
 * paint) the controls are inert.
 */
/**
 * The view toggle: one width for «Arată harta» and «Arată lista», so list ↔ map moves nothing. From
 * 768 to 1023 it is the icon alone (its name stays for screen readers and in the tooltip): the
 * search pill keeps most of that row (rule 6 — never the row's smallest control).
 */
const TOGGLE = 'gap-2 max-md:hidden max-lg:aspect-square max-lg:px-0 lg:min-w-40';

/** A segment of the search pill: a flat button inside the shell, soft-fill on hover. */
const SEGMENT = cn(
  'flex cursor-pointer items-center rounded-[calc(var(--radius-control)-3px)] text-left',
  'transition-[background-color,opacity] duration-(--duration-fast) ease-fast hover:bg-soft-fill active:opacity-80',
  'focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent',
);

/**
 * The search row both Bălți views share (owner rules 6 and 7): the Bălți / Ape publice switch, the
 * search pill («where», then from 1024 «Specie» and «Regim» — imobiliare.ro's selects), «Filtre»
 * after the selects, and from 768 the view toggle in the row's primary slot: «Arată harta» on the
 * list, «Arată lista» on the map. One anatomy, one place: going list ↔ map moves nothing.
 */
export function LakesSearchRow({
  ready,
  view,
  onSearch,
  searchLabel = 'Deschide căutarea pentru bălți',
  summary = null,
  searchRef,
  onSection,
  sectionExpanded = null,
  sectionValues,
  onFilters,
  filtersExpanded = false,
  filterCount = 0,
  showToggle = false,
  switcherHrefs,
  phoneSwitch = true,
}: {
  /** Handlers attached: until then the controls are inert (the server paint). */
  ready: boolean;
  /** The page the row sits on: its toggle leads to the other view. */
  view: 'list' | 'map';
  onSearch?: () => void;
  /** Accessible name of the «where» segment. */
  searchLabel?: string;
  /** The committed search («Giurgiu», «În jurul meu · 50km»); null → the placeholder. */
  summary?: string | null;
  searchRef?: RefObject<HTMLButtonElement | null>;
  /** «Specie» / «Regim» in the pill (from 1024): open that filter section. */
  onSection?: (section: 'fish' | 'regime') => void;
  sectionExpanded?: 'fish' | 'regime' | null;
  /** The committed choice per select («Crap +1»): shown in place of the question, tinted. */
  sectionValues?: { fish?: string | null; regime?: string | null };
  onFilters?: () => void;
  filtersExpanded?: boolean;
  /** Active filters (the «Filtre» badge). */
  filterCount?: number;
  /** The view toggle (from 768). The list hides «Arată harta» while it has no lakes (c23). */
  showToggle?: boolean;
  switcherHrefs?: Partial<Record<'balti' | 'ape', string>>;
  /** The switch in the row on a phone too; off when the page shows it above the sticky row (HomeHeader). */
  phoneSwitch?: boolean;
}) {
  const select = (key: 'fish' | 'regime', label: string, icon: ReactNode) => {
    const value = sectionValues?.[key] ?? null;
    return (
      <>
        <span aria-hidden className="my-2 w-px shrink-0 bg-hairline max-lg:hidden" />
        <button
          type="button"
          onClick={() => onSection?.(key)}
          aria-haspopup="dialog"
          aria-expanded={sectionExpanded === key}
          aria-label={value ? `${label}: ${value}` : undefined}
          className={cn(SEGMENT, 'gap-2 px-3 max-lg:hidden xl:min-w-40', value && 'bg-accent-tint hover:bg-accent-tint')}
        >
          <span aria-hidden className="flex shrink-0 text-accent-ink [&>svg]:size-5">
            {icon}
          </span>
          <span className={cn('max-w-36 flex-1 truncate t-body-strong', value ? 'text-accent-ink' : 'text-ink')}>{value ?? label}</span>
          <ChevronDownIcon aria-hidden className="size-4 shrink-0 stroke-2 text-muted" />
        </button>
      </>
    );
  };
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center">
      <div className={cn('flex justify-center md:justify-start', !phoneSwitch && 'max-md:hidden')}>
        <WaterKindSwitch current="balti" hrefs={switcherHrefs} />
      </div>
      <div inert={!ready} className="flex min-w-0 items-center gap-3 md:flex-1">
        {/* The search pill (owner rule 6 — imobiliare.ro's bar): one shell holding «where»
            (fish LakesSearchBubble, lakes.home.c4 — the search layer) and, from 1024, «what»:
            the species and the regime, each opening its own filter section. No price select: no
            endpoint filters by price (rule 4). It takes the rest of the row. */}
        <div
          className={cn(
            CONTROL_H,
            'flex min-w-0 flex-1 items-stretch rounded-control md:min-w-72 bg-surface p-0.75 shadow-e1 outline-1 -outline-offset-1 outline-hairline',
          )}
        >
          <button
            ref={searchRef}
            type="button"
            onClick={() => onSearch?.()}
            aria-label={searchLabel}
            aria-haspopup="dialog"
            className={cn(SEGMENT, 'min-w-0 flex-1 gap-2.5 pl-3')}
          >
            <MagnifyingGlassIcon aria-hidden className="size-5 shrink-0 text-muted" />
            <span className={cn('min-w-0 flex-1 truncate t-body', summary ? 'text-ink' : 'text-muted')}>
              {summary ?? 'Caută bălți, lacuri...'}
            </span>
          </button>
          {/* Rendered on the first paint too (inert until hydrated): the pill keeps its shape. */}
          {select('fish', 'Specie', <FishOutlineIcon />)}
          {select('regime', 'Regim', <ArrowPathRoundedSquareIcon />)}
        </div>
        {/* «Filtre» after the selects (imobiliare.ro): everything else. */}
        <FilterButton
          count={filterCount}
          desktopHidden={false}
          expanded={filtersExpanded}
          onClick={() => onFilters?.()}
          className={T2_EXPANDED}
        />
        {showToggle ? (
          view === 'list' ? (
            // The map is the row's primary action (rule 6): filled accent, icon and label.
            <Link href={routes.lakesMap()} title="Arată harta" className={buttonClass({ variant: 'primary', className: TOGGLE })}>
              <MapIcon aria-hidden className="size-5 stroke-2" />
              <span className="max-lg:sr-only">Arată harta</span>
            </Link>
          ) : (
            // The way back to the grid, in the same slot (secondary: the map is the destination
            // the list promotes, the list is the way home). Drops the map's query (c2).
            <Link href={routes.lakes()} title="Arată lista" className={buttonClass({ variant: 'secondary', className: TOGGLE })}>
              <ListBulletIcon aria-hidden className="size-5 stroke-2" />
              <span className="max-lg:sr-only">Arată lista</span>
            </Link>
          )
        ) : null}
      </div>
    </div>
  );
}

export function HomeHeader({
  onSearch,
  onSection,
  sectionExpanded = null,
  onFilters,
  filtersExpanded = false,
  showMap = false,
  searchRef,
  categories = null,
}: {
  onSearch?: () => void;
  onFilters?: () => void;
  /** «Specie» / «Regim» in the pill (from 1024): open that filter section. */
  onSection?: (section: 'fish' | 'regime') => void;
  sectionExpanded?: 'fish' | 'regime' | null;
  filtersExpanded?: boolean;
  /** «Arată harta» (from 768): only when the page has lakes. Off on the first paint without data. */
  showMap?: boolean;
  /** The search pill: the search dialog opens over it (SearchLayer `anchorRef`). */
  searchRef?: RefObject<HTMLButtonElement | null>;
  /** The icon category row under the header (HomeGrid CategoryBar). */
  categories?: ReactNode;
}) {
  const ready = Boolean(onSearch && onFilters);
  const sentinel = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  // Marked once a render with handlers has committed and its effects ran: the controls answer clicks
  // (e2e waits on it — «no inert» alone can show before then). Not React state: a DOM mark only.
  useEffect(() => {
    if (ready) bar.current?.setAttribute('data-hydrated', '');
  }, [ready]);
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    // Stuck = the bar has left its place in the flow (the zero-height sentinel just above it).
    let frame = 0;
    const measure = () => {
      frame = 0;
      const s = sentinel.current?.getBoundingClientRect().top;
      const b = bar.current?.getBoundingClientRect().top;
      if (s == null || b == null) return;
      setStuck(b - s > 1);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  return (
    <>
      <h1 className="sr-only">Bălți de pescuit</h1>
      {/* Phone: the switch scrolls away; the sticky block below holds the search row only. */}
      <div className="flex justify-center pt-3 md:hidden">
        <WaterKindSwitch current="balti" />
      </div>
      <div ref={sentinel} aria-hidden />
      <div
        ref={bar}
        data-stuck={stuck || undefined}
        data-list-chrome=""
        className={cn(
          'sticky z-sticky -mx-4 border-b border-transparent bg-page px-4 pt-3 pb-2 md:-mx-6 md:px-6 md:pt-5 md:pb-3 xl:-mx-8 xl:px-8',
          UNDER_BAR_TOP,
          'data-stuck:border-hairline',
          "after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-5 after:bg-linear-to-b after:from-page after:to-transparent after:opacity-0 after:content-[''] data-stuck:after:opacity-100 md:after:h-8",
        )}
      >
        <LakesSearchRow
          phoneSwitch={false}
          ready={ready}
          view="list"
          searchRef={searchRef}
          onSearch={onSearch}
          onSection={onSection}
          sectionExpanded={sectionExpanded}
          onFilters={onFilters}
          filtersExpanded={filtersExpanded}
          showToggle={showMap}
        />
      </div>
      {categories ? <div className="pt-1">{categories}</div> : null}
    </>
  );
}
