import type { ReactNode } from 'react';
import { cn } from '@/components/ui/cn';
import { TRACK_GAP, TRACKS } from '../tracks';
import { CHIP_ROW_STEPS, DetailStickyAside, TAB_BAND_STEPS } from './DetailStickyAside';
import { COLUMN_STICKY_TOP, COLUMN_STICKY_TOP_BELOW_TABS, SECTION_SCROLL_MARGIN } from './metrics';

/*
 * T3 body — the content under the band.
 *  - Phone: one column, no gutters: white section blocks 8px apart on the grey ground (fish
 *    VenueSection `marginBottom: 8`).
 *  - 768–1279: one column of cards inside the 24px gutters, 16px apart.
 *  - ≥1280: three columns on the shared template tracks (../tracks.ts) — left 240/256 (context,
 *    filters or the section index, sticky), centre (content), right 320/360 (details, «ce mă
 *    așteaptă»), 24 apart. Without `left` the centre takes its room; without `aside` too, the
 *    centre is full width — the layout for a table or a map (ROADMAP §4: they take all the width).
 *  - `asideFrom="2xl"`: the right column only joins from 1440 (--breakpoint-2xl), on the late 320
 *    track (../tracks.ts TRACKS.*ThenRight) — for a centre that needs the 1280 row; never a table.
 *  - `layout="summary"` — the Airbnb detail page (owner rule 1, ROADMAP §4b; lake, public water):
 *    no left column; from 1024 two columns, the content left and a 360 / 400 summary column right
 *    (<DetailSummaryCard>: price, the main action, contact, key facts), 48 apart, sticky under the
 *    bar AND the section chip row, which stays at every width on such a page (DetailSectionNav
 *    `hideFromXl={false}`) — so section anchors clear bar + chips from 1280 too.
 */

export type DetailBodyProps = {
  /** ≥1280 only: the left column (sticky). Below 1280 it is not rendered — put its content elsewhere. */
  left?: ReactNode;
  /** Name of the left column's <aside>. */
  leftLabel?: string;
  /** The right column. */
  aside?: ReactNode;
  /** Name of the right column's <aside>. */
  asideLabel?: string;
  /**
   * Below 1280, where the right column goes: before the content, after it (default), or nowhere
   * (when the phone shows the same things inside the sections, as fish does).
   */
  asideBelowXl?: 'start' | 'end' | 'hidden';
  /**
   * Keep the right column in view while the centre scrolls: under the top bar, or `below-tabs` —
   * under the bar and a sticky tab band (DetailBand `sticky`, 64 + 44) — so it never slides under
   * the tabs. A column taller than the window sticks by its bottom edge instead (T5 StickyColumn's
   * rule), so its last card is always reachable.
   */
  asideSticky?: boolean | 'below-tabs';
  /**
   * From which width the right column is a column: `xl` (default), or `2xl` (1440) for a centre
   * that needs the whole 1280 row (a poster grid) — below 1440 the aside then follows
   * `asideBelowXl`. A table never takes a right column (ROADMAP §4): leave `aside` out.
   */
  asideFrom?: 'xl' | '2xl';
  /** `columns` (default): the three-column body from 1280. `summary`: content + summary card from 1024. */
  layout?: 'columns' | 'summary';
  className?: string;
  /** The centre: <DetailSection>s. */
  children: ReactNode;
};

export function DetailBody({
  left,
  leftLabel = 'Context',
  aside,
  asideLabel = 'Detalii',
  asideBelowXl = 'end',
  asideSticky = false,
  asideFrom = 'xl',
  layout = 'columns',
  className,
  children,
}: DetailBodyProps) {
  if (layout === 'summary') {
    return (
      <SummaryBody aside={aside} asideLabel={asideLabel} asideBelowXl={asideBelowXl} asideSticky={!!asideSticky} className={className}>
        {children}
      </SummaryBody>
    );
  }
  const late = asideFrom === '2xl';
  const cols = left
    ? aside
      ? late
        ? TRACKS.leftMainThenRight
        : TRACKS.three
      : TRACKS.leftMain
    : aside
      ? late
        ? TRACKS.mainThenRight
        : TRACKS.mainRight
      : '';
  const asideClass = cn(
    'flex min-w-0 flex-col gap-2 md:gap-4 xl:gap-5',
    asideBelowXl === 'start' && (late ? 'max-2xl:order-first' : 'max-xl:order-first'),
    asideBelowXl === 'hidden' && (late ? 'max-2xl:hidden' : 'max-xl:hidden'),
  );
  return (
    <div
      data-t3="body"
      className={cn(
        'flex flex-1 flex-col gap-2 pt-2 pb-8 md:gap-4 md:px-6 md:pt-6 md:pb-12 xl:grid xl:items-start xl:px-8 xl:pt-8',
        TRACK_GAP,
        cols,
        className,
      )}
    >
      {left ? (
        <aside aria-label={leftLabel} className={cn('flex flex-col gap-4 max-xl:hidden xl:sticky', COLUMN_STICKY_TOP)}>
          {left}
        </aside>
      ) : null}
      <div className="flex min-w-0 flex-col gap-2 md:gap-4 xl:gap-5">{children}</div>
      {aside ? (
        asideSticky ? (
          <DetailStickyAside
            label={asideLabel}
            offsetSteps={asideSticky === 'below-tabs' ? TAB_BAND_STEPS : 0}
            className={cn(asideClass, late ? '2xl:sticky 2xl:self-start' : 'xl:sticky xl:self-start', asideSticky === 'below-tabs' ? COLUMN_STICKY_TOP_BELOW_TABS : COLUMN_STICKY_TOP)}
          >
            {aside}
          </DetailStickyAside>
        ) : (
          <aside aria-label={asideLabel} className={asideClass}>
            {aside}
          </aside>
        )
      ) : null}
    </div>
  );
}

/** The summary column from 1024 (360, 400 from 1440) and the gutter between it and the content. */
export const SUMMARY_TRACKS = 'min-[1024px]:grid min-[1024px]:grid-cols-[minmax(0,1fr)_--spacing(90)] min-[1024px]:gap-x-8 xl:gap-x-12 2xl:grid-cols-[minmax(0,1fr)_--spacing(100)]';

/**
 * Section anchors (and the scroll spy) with the chip row pinned at every width: md's 64 + 58 + 12
 * from 1280 too. A descendant selector, so it outranks the sections' own `xl:scroll-mt-22`.
 */
const SUMMARY_ANCHORS = 'xl:[&_section[id]]:scroll-mt-34';

function SummaryBody({
  aside,
  asideLabel,
  asideBelowXl,
  asideSticky,
  className,
  children,
}: {
  aside?: ReactNode;
  asideLabel: string;
  asideBelowXl: 'start' | 'end' | 'hidden';
  asideSticky: boolean;
  className?: string;
  children: ReactNode;
}) {
  const asideClass = cn(
    'flex min-w-0 flex-col gap-2 md:gap-4',
    asideBelowXl === 'start' && 'max-[1024px]:order-first',
    asideBelowXl === 'hidden' && 'max-[1024px]:hidden',
  );
  return (
    <div
      data-t3="body"
      data-layout="summary"
      className={cn(
        'flex flex-1 flex-col gap-2 pt-2 pb-8 md:gap-4 md:px-6 md:pt-6 md:pb-12 min-[1024px]:items-start xl:px-8 xl:pt-8',
        SUMMARY_TRACKS,
        SUMMARY_ANCHORS,
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-2 md:gap-4 xl:gap-5">{children}</div>
      {aside ? (
        asideSticky ? (
          // Before mount: bar 64 + chips 58 + 24 = 146 (top-36.5); then measured (useStickyTop).
          <DetailStickyAside label={asideLabel} offsetSteps={CHIP_ROW_STEPS} className={cn(asideClass, 'min-[1024px]:sticky min-[1024px]:top-36.5 min-[1024px]:self-start')}>
            {aside}
          </DetailStickyAside>
        ) : (
          <aside aria-label={asideLabel} className={asideClass}>
            {aside}
          </aside>
        )
      ) : null}
    </div>
  );
}

/**
 * The summary card (owner rule 1, Airbnb's booking card) for <DetailBody layout="summary">: a
 * raised white card — the headline (a price «de la 45 RON / tură», or the thing's kind), its status
 * badges, the main action(s) at full width, a footnote, then the key facts / contact under a
 * hairline. One card, not a stack: the right column says «what it costs and how to go» at a glance.
 */
export function DetailSummaryCard({
  headline,
  badges,
  actions,
  footnote,
  children,
  className,
}: {
  headline?: ReactNode;
  badges?: ReactNode;
  actions?: ReactNode;
  footnote?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    // No landmark of its own: it is the content of <DetailBody>'s labelled <aside> (`asideLabel`).
    <div data-t3="summary" className={cn('flex flex-col gap-4 bg-surface px-4 py-5 md:rounded-card md:p-6 md:shadow-e2', className)}>
      {headline ? <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">{headline}</div> : null}
      {badges ? <div className="flex flex-wrap items-center gap-1.5">{badges}</div> : null}
      {actions ? <div className="flex flex-col gap-2">{actions}</div> : null}
      {footnote ? <p className="t-caption text-muted">{footnote}</p> : null}
      {children ? <div className="flex flex-col gap-4 border-t border-hairline pt-4">{children}</div> : null}
    </div>
  );
}

/**
 * The sub-heading inside a section («Acțiuni rapide», «Caracteristici», «Live», «Administrator»):
 * one step below the section title (t-title2), the same at every width — pages use this, never
 * pick a step of their own.
 */
export const H3_CLASS = 't-heading text-ink';

export type DetailSectionProps = {
  /** Anchor for the section nav. */
  id?: string;
  title?: ReactNode;
  /** Right of the title: «Vezi toate», a filter. */
  action?: ReactNode;
  /** Under the title, muted. */
  description?: ReactNode;
  /**
   * `card` (default): white block on the phone, card from 768 (fish VenueSection).
   * `plain`: no surface — for content that is already cards (a rail, a stat grid).
   */
  tone?: 'card' | 'plain';
  /** Title element: h2 (default) in the centre, h3 inside a column card. */
  as?: 'h2' | 'h3';
  className?: string;
  children: ReactNode;
};

/** One content block. With a `title` it is a labelled region (a landmark a screen reader can list). */
export function DetailSection({ id, title, action, description, tone = 'card', as: H = 'h2', className, children }: DetailSectionProps) {
  const titleId = id && title ? `${id}-titlu` : undefined;
  return (
    <section
      id={id}
      aria-labelledby={titleId}
      className={cn(
        'outline-none',
        id && SECTION_SCROLL_MARGIN,
        // Phone: the shell gutter (16) at the sides; from 768 the card's own 20 / 24 padding.
        tone === 'card' ? 'bg-surface px-4 py-5 md:rounded-card md:p-5 md:shadow-e0 xl:p-6' : 'px-4 py-3 md:p-0',
        className,
      )}
    >
      {title || action ? (
        // With a description the action stays on the title's line (top); without one it centres on it.
        <div className={cn('mb-3 flex gap-3 xl:mb-4', description ? 'items-start' : 'items-center')}>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            {title ? (
              // title2 (17 → 20) is Fundații's section-title step at every width; t-heading stays for
              // the h3s inside a section («Acțiuni rapide», «Caracteristici»), one step below.
              <H id={titleId} className="t-title2">
                {title}
              </H>
            ) : null}
            {description ? <p className="t-caption text-muted">{description}</p> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/**
 * A card for the side columns (≥1280) — and, below 1280, a section block like the others. `as`:
 * h3 (default) for the right column, which follows the centre's h2s; h2 for the left column,
 * which comes first in the DOM (an h3 right after the h1 skips a level).
 */
export function DetailAsideCard({
  title,
  action,
  as = 'h3',
  className,
  children,
}: {
  title?: ReactNode;
  action?: ReactNode;
  as?: 'h2' | 'h3';
  className?: string;
  children: ReactNode;
}) {
  return (
    <DetailSection title={title} action={action} as={as} className={className}>
      {children}
    </DetailSection>
  );
}
