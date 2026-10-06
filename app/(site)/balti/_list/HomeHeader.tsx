'use client';

import { MagnifyingGlassIcon, MapIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { UNDER_BAR_TOP } from '@/components/nav/shell';
import { FilterButton, FOCUS_RING, SEARCH_SHELL } from '@/components/templates/T1';
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
 * below in place — HomeGrid CategoryBar). The map page has its own T2 toolbar and chips.
 *
 * Sticky under the top bar (c27), on the shell's under-bar offset (UNDER_BAR_TOP, on the bar's own
 * timing: up to the edge when the phone's top bar slides away). Once stuck it gets its edge — a
 * hairline — and a fade into the rows that scroll under it. Without handlers (the first paint) the
 * controls are inert.
 */
export function HomeHeader({
  onSearch,
  onFilters,
  filtersExpanded = false,
  showMap = false,
  searchRef,
  categories = null,
}: {
  onSearch?: () => void;
  onFilters?: () => void;
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
        <h1 className="sr-only">Bălți de pescuit</h1>
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="flex justify-center md:justify-start">
            <WaterKindSwitch current="balti" />
          </div>
          <div inert={!ready} className="flex min-w-0 items-center gap-3 md:flex-1">
            {/* The search pill (T2SearchPill's look, lakes.home.c4) in the toolbar's one family: surface
                + hairline, like the switch and «Filtre». It takes the rest of the row: the switch,
                pill, «Filtre» and the map span the content width as one group. */}
            <button
              ref={searchRef}
              type="button"
              onClick={() => onSearch?.()}
              aria-label="Deschide căutarea pentru bălți"
              aria-haspopup="dialog"
              className={cn(
                SEARCH_SHELL,
                'min-w-0 flex-1 cursor-pointer gap-2.5 pl-3.5 text-left',
                'transition-[background-color,opacity] duration-(--duration-fast) ease-fast hover:bg-soft-fill! active:opacity-80',
                FOCUS_RING,
              )}
            >
              <MagnifyingGlassIcon aria-hidden className="size-5 shrink-0 text-muted" />
              <span className="min-w-0 flex-1 truncate t-body text-muted">Caută bălți, lacuri...</span>
            </button>
            <FilterButton desktopHidden={false} expanded={filtersExpanded} onClick={() => onFilters?.()} className={T2_EXPANDED} />
            {showMap ? (
              // The map is the row's primary action (rule 6): filled accent, icon and label.
              <Link href={routes.lakesMap()} className={buttonClass({ variant: 'primary', className: 'gap-2 max-md:hidden' })}>
                <MapIcon aria-hidden className="size-5 stroke-2" />
                Arată harta
              </Link>
            ) : null}
          </div>
        </div>
      </div>
      {categories ? <div className="pt-1">{categories}</div> : null}
    </>
  );
}
