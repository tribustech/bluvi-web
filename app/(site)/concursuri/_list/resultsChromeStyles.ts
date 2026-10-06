import { FOCUS_RING, SEARCH_SHELL } from '@/components/templates/T1/toolbarStyles';
import { iconButtonClass } from '@/components/nav/IconButton';
import { cn } from '@/components/ui/cn';

/*
 * The results chrome's class lists (competitions-list.results.c3), in a module with no 'use client'
 * so the page's Suspense frame (page.tsx, a Server Component) and the live ResultsChrome draw the
 * same boxes — the frame can never drift from the chrome that replaces it.
 */

/**
 * The back square: T1 ListHeader's own back control, built from the same recipe (the kit icon button
 * — 48, 40 from 1280, ink-2 glyph, soft-fill hover, opacity press — resting on surface + hairline on
 * the page ground), so «Înapoi» looks the same here and on every T1 results header.
 * TODO(kit): import T1's exported LIST_BACK once toolbarStyles.ts exports it (outside this screen).
 */
export const RESULTS_BACK = iconButtonClass({ className: cn('bg-surface shadow-e0 hover:bg-soft-fill', FOCUS_RING) });

/**
 * Around DashboardRefresh in the results row: below 768 its icon square takes RESULTS_BACK's framing
 * (surface + hairline, ink-2 glyph), so the pill sits between two tools of one look; from 768 the
 * labelled ghost tool as everywhere. TODO(kit): a DashboardRefresh ground / className prop (T5).
 */
export const RESULTS_REFRESH = cn(
  'contents',
  'max-md:[&>button:first-of-type]:bg-surface max-md:[&>button:first-of-type]:text-ink-2 max-md:[&>button:first-of-type]:shadow-e0',
  'max-md:[&>button:first-of-type:hover]:bg-soft-fill max-md:[&>button:first-of-type:hover]:text-ink',
);

/**
 * The pill that stands in for the search field: the field's own shell (SEARCH_SHELL — radius-control,
 * the hairline outline, the toolbar height, hover soft-fill), so the search control keeps its shape
 * when the screen enters results mode. `circle`: room on the right for the filters circle.
 */
export function resultsPillClass(circle: boolean) {
  return cn(SEARCH_SHELL, 'min-w-0 flex-1 gap-2 pl-0 hover:bg-soft-fill!', circle ? 'pr-1.5' : 'pr-0');
}

/** The label button inside the pill (the field's text area); the kit press is opacity .8. */
export const RESULTS_LABEL = cn(
  'flex h-full min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-control pl-3.5 text-left active:opacity-80',
  FOCUS_RING,
);

/** The filters circle inside the pill (below 1280 only — the docked column takes over from there). */
export function resultsCircleClass(active: boolean) {
  return cn(
    'relative flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full [&>svg]:size-5',
    'transition-[background-color,filter,opacity] duration-(--duration-fast) ease-fast active:opacity-80',
    active ? 'bg-accent-ink text-on-accent hover:brightness-95' : 'bg-accent-tint text-accent-ink hover:bg-accent-tint-2',
    FOCUS_RING,
  );
}

/** One row: back square, pill, trailing tools. */
export const RESULTS_ROW = 'flex items-center gap-2.5';

/** Below 1280 the chrome is a sticky stack: the row, then the chip rail. */
export const RESULTS_STACK = 'flex flex-col gap-3 pb-1';
