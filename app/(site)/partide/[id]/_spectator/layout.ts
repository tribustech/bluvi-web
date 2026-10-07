import { SUMMARY_TRACKS } from '@/components/templates/T3/DetailBody';

/*
 * The partidă body's columns, shared by the page and its skeleton — T3's Airbnb detail layout
 * (DetailBody `layout="summary"`, owner rule 1): phone one column (white blocks on the grey page,
 * no gutters), 768 cards in the 24px gutters, from 1024 two columns — the content left and a
 * 360 / 400 summary column right (the three tiles, «Pescari», the venue), sticky under the bar.
 * Not DetailBody itself: its summary column sticks under the bar AND a section chip row this page
 * does not have (it would hang 58px low).
 */

export const BODY_GRID = [
  'flex flex-1 flex-col gap-2 pt-2 pb-8 md:gap-4 md:px-6 md:pt-6 md:pb-12 min-[1024px]:items-start xl:px-8 xl:pt-8',
  SUMMARY_TRACKS,
].join(' ');

export const MAIN_COLUMN = 'flex min-w-0 flex-col gap-2 md:gap-4 xl:gap-5';

export const SIDE_COLUMN = 'flex min-w-0 flex-col gap-4 xl:gap-5';

/** Sticky from 1024, under the 64px bar + 24 (the class stands in until useStickyTop measures). */
export const SIDE_STICKY = 'min-[1024px]:sticky min-[1024px]:top-[calc(--spacing(22)_+_var(--shell-banner-h,0px))] min-[1024px]:self-start';
