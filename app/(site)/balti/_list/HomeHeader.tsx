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
 * (fish LakesSearchBubble, lakes.home.c4) taking the rest of the row, «Filtre» (c5). The map is the
 * floating «Arată harta» pill at every width (c23; owner 2026-10-13, from 768 too — Airbnb's map
 * pill — so the search takes the whole row); fish hides the map entry at totalLakesCount 0
 * (lakes.home.s10), so does the web. The group spans the content width, so no dead band opens.
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
    const open = sectionExpanded === key;
    return (
      <>
        <span aria-hidden className="my-3 w-px shrink-0 bg-hairline max-lg:hidden" />
        <button
          type="button"
          data-pill-segment={key}
          onClick={() => onSection?.(key)}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={value ? `${label}: ${value}` : label}
          className={cn(SEGMENT, 'min-w-36 gap-2.5 px-5 max-lg:hidden xl:min-w-44', open && 'bg-surface shadow-e2 hover:bg-surface')}
        >
          <span aria-hidden className={cn('flex shrink-0 [&>svg]:size-5', value ? 'text-accent-ink' : 'text-muted')}>
            {icon}
          </span>
          {/* Airbnb's two-line segment: what it is, then the choice (or «Oricare»). */}
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="t-label text-ink">{label}</span>
            <span className={cn('max-w-36 truncate t-body', value ? 'text-accent-ink' : 'text-muted')}>{value ?? 'Oricare'}</span>
          </span>
          <ChevronDownIcon aria-hidden className={cn('size-4 shrink-0 stroke-2 text-muted transition-transform duration-(--duration-fast)', open && 'rotate-180')} />
        </button>
      </>
    );
  };
  return (
    // From 768 three tracks, as the top bar (owner 2026-10-13): the Bălți / Ape publice switch on the
    // left, the search pill centred (at most 860 — never a bar across the whole page), «Filtre» on the
    // right. On a phone the switch above, the pill and «Filtre» in one row (fish).
    <div className="flex flex-col gap-3 md:grid md:grid-cols-[minmax(max-content,1fr)_minmax(0,860px)_minmax(max-content,1fr)] md:items-center md:gap-4">
      <div className={cn('flex justify-center md:justify-start', !phoneSwitch && 'max-md:hidden')}>
        <WaterKindSwitch current="balti" hrefs={switcherHrefs} />
      </div>
      <div inert={!ready} className="flex min-w-0 items-center gap-3 md:contents">
        {/* The search pill (owner rule 6): one shell holding «where» (fish LakesSearchBubble,
            lakes.home.c4 — the search layer) and, from 1024, «what»: the species and the regime,
            each opening its own panel under its segment. No price select: no endpoint filters by
            price (rule 4). From 768 the segments are two lines high (label over value). */}
        <div
          className={cn(
            CONTROL_H,
            'flex min-w-0 flex-1 items-stretch rounded-full bg-surface p-0.75 shadow-e1 outline-1 -outline-offset-1 outline-hairline md:h-16 md:p-1.5 md:shadow-e2 xl:h-16',
            '[&>button]:rounded-full',
          )}
        >
          <button
            ref={searchRef}
            type="button"
            data-pill-segment="where"
            onClick={() => onSearch?.()}
            aria-label={searchLabel}
            aria-haspopup="dialog"
            className={cn(SEGMENT, 'min-w-0 flex-1 gap-2.5 pl-3 md:pl-5')}
          >
            <MagnifyingGlassIcon aria-hidden className="size-5 shrink-0 text-muted md:hidden" />
            <span className={cn('min-w-0 flex-1 truncate t-body md:hidden', summary ? 'text-ink' : 'text-muted')}>
              {summary ?? 'Caută bălți, lacuri...'}
            </span>
            <span className="flex min-w-0 flex-1 flex-col max-md:hidden">
              <span className="t-label text-ink">Unde?</span>
              <span className={cn('truncate t-body', summary ? 'text-ink' : 'text-muted')}>{summary ?? 'Baltă, localitate sau județ'}</span>
            </span>
          </button>
          {/* Rendered on the first paint too (inert until hydrated): the pill keeps its shape. */}
          {select('fish', 'Specie', <FishOutlineIcon />)}
          {select('regime', 'Regim', <ArrowPathRoundedSquareIcon />)}
          {/* From 768 the pill ends on the round accent search (the «where» segment's twin for the
              pointer — the segment itself is the control for keyboard and screen readers). */}
          <button
            type="button"
            tabIndex={-1}
            aria-hidden
            onClick={() => onSearch?.()}
            className="ml-1 flex aspect-square shrink-0 cursor-pointer items-center justify-center rounded-full bg-accent text-on-accent transition-colors duration-(--duration-fast) hover:bg-accent-ink max-md:hidden"
          >
            <MagnifyingGlassIcon className="size-5 stroke-2" />
          </button>
        </div>
        <div className="flex items-center gap-3 md:justify-self-end">
          {/* «Filtre»: everything else, in the side panel from 768. */}
          <FilterButton
            count={filterCount}
            desktopHidden={false}
            expanded={filtersExpanded}
            onClick={() => onFilters?.()}
            // Phone: fish's round white filter button with the indigo glyph (the filled «on» stays
            // while filters are active).
            className={cn(T2_EXPANDED, 'rounded-full! max-md:shadow-e1! md:h-12! xl:h-12!', filterCount === 0 && 'max-md:text-accent-ink!')}
          />
          {showToggle ? (
            view === 'list' ? (
              <Link href={routes.lakesMap()} title="Arată harta" className={buttonClass({ variant: 'primary', className: TOGGLE })}>
                <MapIcon aria-hidden className="size-5 stroke-2" />
                <span className="max-lg:sr-only">Arată harta</span>
              </Link>
            ) : (
              <Link href={routes.lakes()} title="Arată lista" className={buttonClass({ variant: 'secondary', className: TOGGLE })}>
                <ListBulletIcon aria-hidden className="size-5 stroke-2" />
                <span className="max-lg:sr-only">Arată lista</span>
              </Link>
            )
          ) : null}
        </div>
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
  searchRef,
  categories = null,
}: {
  onSearch?: () => void;
  onFilters?: () => void;
  /** «Specie» / «Regim» in the pill (from 1024): open that filter section. */
  onSection?: (section: 'fish' | 'regime') => void;
  sectionExpanded?: 'fish' | 'regime' | null;
  filtersExpanded?: boolean;
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
          // The map is the floating «Arată harta» at every width (LakesHome, owner 2026-10-13).
          showToggle={false}
        />
      </div>
      {categories ? <div className="pt-1">{categories}</div> : null}
    </>
  );
}
