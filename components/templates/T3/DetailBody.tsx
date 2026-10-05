import type { ReactNode } from 'react';
import { cn } from '@/components/ui/cn';
import { COLUMN_STICKY_TOP, SECTION_SCROLL_MARGIN } from './metrics';

/*
 * T3 body — the content under the band.
 *  - Phone: one column, no gutters: white section blocks 8px apart on the grey ground (fish
 *    VenueSection `marginBottom: 8`).
 *  - 768–1279: one column of cards inside the 24px gutters, 16px apart.
 *  - ≥1280: three columns — left 240/256 (context, filters or the section index, sticky),
 *    centre (content), right 360/384 (details, «ce mă așteaptă»). Without `left` the centre takes
 *    its room; without `aside` too, the centre is full width (tables, maps).
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
  /** Keep the right column in view while the centre scrolls (only when it is shorter than the screen). */
  asideSticky?: boolean;
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
  className,
  children,
}: DetailBodyProps) {
  const cols = left
    ? aside
      ? 'xl:grid-cols-[--spacing(60)_minmax(0,1fr)_--spacing(90)] 2xl:grid-cols-[--spacing(64)_minmax(0,1fr)_--spacing(96)]'
      : 'xl:grid-cols-[--spacing(60)_minmax(0,1fr)] 2xl:grid-cols-[--spacing(64)_minmax(0,1fr)]'
    : aside
      ? 'xl:grid-cols-[minmax(0,1fr)_--spacing(90)] 2xl:grid-cols-[minmax(0,1fr)_--spacing(96)]'
      : '';
  return (
    <div
      data-t3="body"
      className={cn(
        'flex flex-1 flex-col gap-2 pt-2 pb-8 md:gap-4 md:px-6 md:pt-6 md:pb-12 xl:grid xl:items-start xl:gap-8 xl:px-8 xl:pt-8',
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
        <aside
          aria-label={asideLabel}
          className={cn(
            'flex min-w-0 flex-col gap-2 md:gap-4 xl:gap-5',
            asideBelowXl === 'start' && 'max-xl:order-first',
            asideBelowXl === 'hidden' && 'max-xl:hidden',
            asideSticky && cn('xl:sticky', COLUMN_STICKY_TOP),
          )}
        >
          {aside}
        </aside>
      ) : null}
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
