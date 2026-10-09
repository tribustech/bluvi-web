import type { ReactNode } from 'react';
import { SHELL_GUTTERS, SHELL_MAX } from '@/components/nav/shell';
import { cn } from '@/components/ui/cn';

/*
 * The walk-in review's page frame — T4 (T4Header over a form column, T4ActionBar), split from 1024
 * instead of T4Frame's 1280: the operator works on a laptop, and the calendar this step comes from
 * already docks its summary card on the right from 1024 (BookingFrame), so the review keeps that
 * column where the operator left it (Airbnb-like, owner rule 1).
 *
 *  - <1024: one column — the summary card first (CSS order; it holds no control), the form, the
 *    auto-confirm note, then the action bar pinned to the viewport's bottom edge (T4ActionBar,
 *    riding above the on-screen keyboard). DOM order is form → note → CTA, so Tab never reaches the
 *    CTA before the fields.
 *  - ≥1024: the form on the left (1fr); on the right a 360 / 400 column, sticky under the top bar
 *    (attached: it starts with the form's first card and never floats in a gap), holding the summary,
 *    the note and the CTA docked under them as a card. The header scrolls away from 1024 (it is
 *    sticky below), so the sticky column is the only thing pinned.
 * The column wrapper is `display: contents` below 1024, which is what lets its children take their
 * place in the single column.
 */

/** The page's scroll padding clears the sticky chrome for focus / find-in-page (T4Frame PAGE_CLEAR, split at 1024). */
const PAGE_CLEAR = cn(
  '[html:has(&)]:scroll-pt-48 md:[html:has(&)]:scroll-pt-56 lg:[html:has(&)]:scroll-pt-24',
  '[html:has(&)]:scroll-pb-32 lg:[html:has(&)]:scroll-pb-8',
);

/** The header's sticky band ends at 1024 here (T4Header is sticky until 1280 by default). */
export const HEADER_SPLIT = 'lg:relative lg:top-0';

/** T4ActionBar docked as a card under the summary from 1024 (its own rule starts at 1280). */
export const ACTIONS_SPLIT =
  'lg:static lg:mx-0 lg:mt-0 lg:rounded-card lg:border-t-0 lg:px-6 lg:py-4 lg:shadow-[var(--shadow-e1),var(--shadow-e0)]';

export function WalkInReviewFrame({
  header,
  summary,
  note,
  actions,
  busy = false,
  label,
  children,
}: {
  header: ReactNode;
  /** The booking under review (the stacked SummaryCard or its skeleton). */
  summary: ReactNode;
  /** The auto-confirm note under the summary. */
  note?: ReactNode;
  /** <T4ActionBar className={ACTIONS_SPLIT}>. */
  actions?: ReactNode;
  busy?: boolean;
  label: string;
  /** The form column. */
  children: ReactNode;
}) {
  return (
    <div className={cn('flex flex-col bg-page min-h-[calc(100dvh-var(--spacing)*14)] md:min-h-[calc(100dvh-var(--spacing)*16)]', PAGE_CLEAR)}>
      {header}
      <div
        className={cn(
          'mx-auto flex w-full flex-1 flex-col gap-4 pt-4 md:gap-5 md:pt-6',
          'lg:grid lg:grid-cols-[minmax(0,1fr)_--spacing(90)] lg:items-start lg:gap-6 lg:pt-8 2xl:grid-cols-[minmax(0,1fr)_--spacing(100)]',
          SHELL_MAX,
          SHELL_GUTTERS,
        )}
      >
        <section
          aria-label={label}
          aria-busy={busy || undefined}
          className={cn(
            'flex min-w-0 flex-col gap-4 md:gap-5 lg:col-start-1 lg:row-start-1 lg:pb-8',
            '[&_:is(a,button,input,textarea,[tabindex])]:scroll-mb-32 lg:[&_:is(a,button,input,textarea,[tabindex])]:scroll-mb-8',
          )}
        >
          {children}
        </section>
        <div className="contents lg:sticky lg:top-24 lg:col-start-2 lg:row-start-1 lg:flex lg:flex-col lg:gap-4 lg:pb-8">
          <div className="order-first lg:order-none">{summary}</div>
          {note}
          {/* Below 1024 the bar is the column's last item, pushed to the bottom edge on a short page. */}
          {actions ? <div className="contents lg:block">{actions}</div> : null}
        </div>
      </div>
    </div>
  );
}
