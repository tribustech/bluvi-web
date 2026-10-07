import { cn } from '@/components/ui/cn';

/*
 * The profile page's frame — class strings shared by AnglerProfileView (client) and the route
 * fallbacks (AnglerProfileFallback, server-rendered by loading.tsx and the page's Suspense) so the
 * streamed shape and the real page sit on the same lines at every width (parity
 * account.angler-profile c3, c31).
 *
 * No 'use client' here on purpose: a constant exported from a client module becomes a
 * client-reference stub when a server component imports it, and the class string never lands.
 */

/** Phone / tablet: one column. ≥1280: the identity card left, the tabs and the list right. */
export const PROFILE_GRID = cn(
  'relative flex flex-col xl:grid xl:items-start xl:gap-x-6 xl:px-8',
  'xl:grid-cols-[--spacing(90)_minmax(0,1fr)] 2xl:grid-cols-[--spacing(100)_minmax(0,1fr)]',
);

/** Phone / tablet: fish's header row (back · refresh · settings) on the white band; none from 1280. */
export const HEADER_ROW = 'flex items-center gap-2 xl:hidden';
export const HEADER_ROW_BAND = 'min-h-14 bg-surface px-4 pt-2 md:px-6';

/**
 * Own mode below 1280 (fish AnglerProfileScreen's floating top row): no band — the ghost actions
 * (refresh, then the cog) float in the header band's top-right corner, over the avatar's top padding,
 * their glyphs on the band's 20 / 24px gutter. The identity card then starts with `pt-4`.
 */
export const OWN_ACTIONS = 'absolute top-2 right-2 z-above flex items-center xl:hidden md:right-3';

/** The own actions' ghost icon button (44px hit area, no fill until hovered). */
export const GHOST_ICON =
  'relative flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full transition-[background-color,color,opacity] duration-(--duration-fast) ease-fast hover:bg-soft-fill active:opacity-60';

/**
 * ≥1280 the identity card's sticky top: T3 COLUMN_STICKY_TOP (88px under the bar) while the card
 * fits; a taller card (--aside-h) gets a negative top, so it scrolls with the page until its bottom
 * is 24px above the viewport's and pins there — all of it is always reachable, nothing scrolls inside.
 */
const STICKY_CARD_TOP =
  'xl:top-[min(calc(--spacing(22)_+_var(--shell-banner-h,0px)),calc(100dvh_-_var(--aside-h,0px)_-_--spacing(6)))]';

/** The identity card (the header band below 1280). `pt-1` under the chip row; `pt-4` with no row. */
export const ASIDE = cn('bg-surface px-5 pb-5 md:px-6', 'xl:sticky xl:mt-4 xl:rounded-card xl:p-6 xl:shadow-e0', STICKY_CARD_TOP);

/** The right column: the tab bar, then the selected tab's panel. */
export const COLUMN = 'flex min-w-0 flex-col xl:mt-4';

/** Rule 20: the tab switcher is one container — the white band below 1280, a white card from 1280. */
export const TAB_BAR = 'flex items-end gap-2 bg-surface md:px-6 xl:rounded-card xl:px-5 xl:pt-1.5 xl:shadow-e0';

/** ListTabs' extra classes in the bar (equal tabs on the phone; no rule under them in the card). */
export const TAB_ROW = 'min-w-0 flex-1 max-md:gap-0 max-md:*:flex-1 max-md:*:justify-center max-md:*:pt-2.5 xl:flex-none xl:border-b-0';

/** ≥1280 the refresh (and settings) chips at the tab bar's end. */
export const TAB_BAR_END = 'flex items-center gap-2 self-center pb-1 max-xl:hidden';

/** The selected tab's panel. */
export const PANEL = 'flex flex-col md:px-6 md:pt-4 xl:px-0';

/** The Capturi grid's columns, shared with the tab skeleton so the bones sit where the tiles land. */
export const CATCH_GRID = 'grid grid-cols-3 gap-0.5 md:grid-cols-[repeat(auto-fill,minmax(--spacing(40),1fr))] md:gap-1.5';
