import type { ReactNode } from 'react';
import { UNDER_BAR_TOP_MD } from '@/components/nav/shell';
import { cn } from '@/components/ui/cn';
import { FULL_BLEED_HAIRLINE, FULL_BLEED_SURFACE } from './metrics';

/*
 * T3 «Detail with tabs» (ROADMAP §4) — the page frame. Used by: competition, lake, angler profile,
 * partidă, public water.
 *
 *   <DetailPage>
 *     <DetailBand>            white, full bleed: <DetailHeader> (+ <DetailPhotoHero>) (+ <DetailTabs>)
 *     <DetailSectionNav>      sticky chip nav for single-scroll pages (lake), phone + tablet
 *     <DetailBody left aside> grey ground: <DetailSection>s in the centre, context left, details right
 *     <DetailActionBar>       phone: the fixed bottom actions
 *   </DetailPage>
 *
 * Phone (375) is the fish screen: a white header, white section blocks 8px apart on the grey
 * ground (fish VENUE_DETAIL_BG), nothing in gutters. From 768 the sections become cards inside the
 * 24px gutters; from 1280 the body is three columns (left: context / section index, centre:
 * content, right: «ce mă așteaptă» / details), as the roadmap's width decision asks.
 *
 * Data-loading contract (a route built on T3; the demo app/dev/templates/t3 does exactly this):
 *  - the main read (the lake, the competition) is BOUNDED (the demo: 8s): a hung CMS ends in
 *    <DetailError> + «Încearcă din nou», never in an endless skeleton;
 *  - a 404 from the main read is `notFound()` → <DetailNotFound> from the route's not-found file
 *    (call it before any Suspense boundary for a real 404 status); only network / 5xx / timeout
 *    errors get the retryable <DetailError>;
 *  - secondary sections are settled one by one, each bounded, each with its own ErrorState; what
 *    is derived from a failed read (a tab count, a «20 / 20») disappears with it;
 *  - the session read is tri-state (signed in · signed out · unknown when it timed out): sign-in
 *    prompts only for a viewer known to be signed out; «unknown» hides account-dependent actions.
 */

export type DetailPageProps = {
  /**
   * The phone ground: `page` (grey, white section blocks on it — lake, public water) or `surface`
   * (all white — the competition screen, a profile). From 768 the ground is always the page grey.
   */
  phoneGround?: 'page' | 'surface';
  className?: string;
  children: ReactNode;
};

/**
 * A sticky tab band: under the 64px top bar from 768 (above the page's content, below the bar's
 * menus; the bar comes first in the DOM, so at the same z-index it stays on top).
 */
const DETAIL_TABS_STICKY = cn('md:sticky md:z-sticky', UNDER_BAR_TOP_MD);

/** The page frame. It must be the parent of the sticky nav, so the nav sticks for the whole page. */
export function DetailPage({ phoneGround = 'page', className, children }: DetailPageProps) {
  return (
    <div className={cn('relative flex min-h-dvh flex-col', phoneGround === 'surface' && 'max-md:bg-surface', className)}>
      {children}
    </div>
  );
}

export type DetailBandProps = {
  /** Hairline under the band (off when a nav right below draws its own). */
  hairline?: boolean;
  /**
   * From 768 the band sticks under the top bar (64) — for a band holding only <DetailTabs>, so the
   * route tabs stay in reach under a long table (parity competition-page.shell.c19). Not on the
   * phone, where the top bar hides on scroll down and the tabs are part of the header.
   */
  sticky?: boolean;
  className?: string;
  children: ReactNode;
};

/**
 * The white band at the top (header, photos, route tabs). Its surface and hairline run edge to
 * edge under the full-width top bar; its content stays in the shell column. A flex column, so a
 * child can move itself with `order`: the photo hero comes after the header in the DOM (title →
 * photos from 768) and takes `max-md:-order-1` to lead on the phone (DetailPhotoHero).
 */
export function DetailBand({ hairline = true, sticky = false, className, children }: DetailBandProps) {
  return (
    <div
      className={cn('flex flex-col', FULL_BLEED_SURFACE, hairline && FULL_BLEED_HAIRLINE, sticky && DETAIL_TABS_STICKY, className)}
    >
      {children}
    </div>
  );
}
