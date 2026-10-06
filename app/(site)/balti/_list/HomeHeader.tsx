'use client';

import { MagnifyingGlassIcon, MapIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { FilterButton, FOCUS_RING, pageToolClass, SEARCH_SHELL } from '@/components/templates/T1';
import { T2_EXPANDED } from '@/components/templates/T2';
import { T4_HEADER_TOP } from '@/components/templates/T4/T4Frame';
import { cn } from '@/components/ui/cn';
import { routes } from '@/lib/routes';
import { WaterKindSwitch } from './WaterKindSwitch';

/*
 * The Bălți home's top: the Bălți / Ape publice switch (fish's SegmentedToggle; it names the page,
 * the h1 is for screen readers at every width), then the search bubble (fish LakesSearchBubble,
 * lakes.home.c4) growing from the left up to the reading measure, then «Filtre» (c5) + «Hartă» right
 * after it. The toolbar spans the whole page, above the rows and the docked filter panel, so opening
 * the panel never moves the button that opened it (ROADMAP §4). The map
 * page has its own T2 toolbar (back link, title, chips): the two are different bars, not one bar
 * that stays put. «Hartă» shows from 768 when there are lakes to map (fish hides the map entry at
 * totalLakesCount 0, lakes.home.s10); on a phone the floating «Vezi bălțile pe hartă» carries it (c23).
 *
 * Sticky under the top bar (c27), on the templates' one sticky offset (T4_HEADER_TOP: up to the
 * edge when the phone's top bar slides away). Once stuck it gets its edge — a hairline — and a
 * fade into the rows that scroll under it. Without handlers (the first paint) the controls are inert.
 */
export function HomeHeader({
  onSearch,
  onFilters,
  filtersExpanded = false,
  showMap = false,
  searchRef,
}: {
  onSearch?: () => void;
  onFilters?: () => void;
  filtersExpanded?: boolean;
  /** «Hartă» (from 768): only when a row has lakes. Off on the first paint without data. */
  showMap?: boolean;
  /** The search pill: the search dialog opens over it (SearchLayer `anchorRef`). */
  searchRef?: RefObject<HTMLButtonElement | null>;
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
        className={cn(
          'sticky z-sticky -mx-4 border-b border-transparent bg-page px-4 pt-3 pb-2 md:-mx-6 md:px-6 md:pt-5 md:pb-3 xl:-mx-8 xl:px-8',
          T4_HEADER_TOP.shell,
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
                + hairline, like the switch and «Filtre» — the map-floating shadow-e2 halo is for the
                map, not the page ground. TODO(kit): an `elevation` pass-through on T2SearchPill. */}
            <button
              ref={searchRef}
              type="button"
              onClick={() => onSearch?.()}
              aria-label="Deschide căutarea pentru bălți"
              aria-haspopup="dialog"
              className={cn(
                SEARCH_SHELL,
                'min-w-0 flex-1 cursor-pointer gap-2.5 pl-3.5 text-left md:max-w-120 xl:max-w-180',
                'transition-[background-color,opacity] duration-(--duration-fast) ease-fast hover:bg-soft-fill! active:opacity-80',
                FOCUS_RING,
              )}
            >
              <MagnifyingGlassIcon aria-hidden className="size-5 shrink-0 text-muted" />
              <span className="min-w-0 flex-1 truncate t-body text-muted">Caută bălți, lacuri...</span>
            </button>
            {/* Right after the pill (not pushed to the far edge): nothing moves when the docked
                filter panel opens, and no dead band opens between the pill and the buttons. Only the
                expanded «Filtre» is tinted (T2_EXPANDED); «Hartă» is the same surface tool. */}
            <div className="flex shrink-0 items-center gap-3">
              <FilterButton desktopHidden={false} expanded={filtersExpanded} onClick={() => onFilters?.()} className={T2_EXPANDED} />
              {showMap ? (
                <Link href={routes.lakesMap()} className={cn(pageToolClass({ iconOnly: false }), 'max-md:hidden')}>
                  <MapIcon aria-hidden />
                  Hartă
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
