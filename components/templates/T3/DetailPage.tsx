import type { ReactNode } from 'react';
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
  className?: string;
  children: ReactNode;
};

/**
 * The white band at the top (header, photos, route tabs). Its surface and hairline run edge to
 * edge under the full-width top bar; its content stays in the shell column. A flex column, so a
 * child can move itself with `order`: the photo hero comes first in the DOM (it leads on the
 * phone, Tab order included) and takes `md:order-1` to sit under the title from 768.
 */
export function DetailBand({ hairline = true, className, children }: DetailBandProps) {
  return (
    <div className={cn('flex flex-col', FULL_BLEED_SURFACE, hairline && FULL_BLEED_HAIRLINE, className)}>
      {children}
    </div>
  );
}
