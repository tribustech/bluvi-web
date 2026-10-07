import type { ReactNode } from 'react';
import { cn } from '@/components/ui/cn';

/*
 * T3 sticky actions — the phone's bottom bar (fish RankingActionBar on the competition, the
 * booking CTA on a lake). Fixed to the bottom with the safe-area inset; a spacer of the same
 * height keeps the last section above it. From 768 the actions live in the header (`actions`) or
 * the right column, so the bar is phone only unless `tablet` is set.
 *
 * `summary` is the context on the left («Chita Lake · 4,33 ★», a price); `children` the buttons.
 */

export type DetailActionBarProps = {
  summary?: ReactNode;
  /** Above the bar: a banner (fish ActiveWeighingBanner) or a status line. */
  above?: ReactNode;
  /** Also show on 768–1279. */
  tablet?: boolean;
  /**
   * Where the bar leaves, overriding `tablet`: `summary` = from 1024, the summary layout's
   * breakpoint (DetailBody layout="summary": its sticky card takes the actions from there).
   */
  hideFrom?: 'summary';
  label?: string;
  /** While the page keeps the bar away (slid off, e.g. until the hero's own CTA has scrolled by). */
  inert?: boolean;
  className?: string;
  children: ReactNode;
};

export function DetailActionBar({ summary, above, tablet = false, hideFrom, label = 'Acțiuni', inert, className, children }: DetailActionBarProps) {
  const hide = hideFrom === 'summary' ? 'min-[1024px]:hidden' : tablet ? 'xl:hidden' : 'md:hidden';
  return (
    <>
      {/* Room for the bar (72 + the inset), so the page ends above it. */}
      <div
        aria-hidden
        className={cn(above ? 'h-[calc(--spacing(30)+env(safe-area-inset-bottom))]' : 'h-[calc(--spacing(18)+env(safe-area-inset-bottom))]', hide)}
      />
      <div role="region" aria-label={label} data-t3="actionbar" inert={inert || undefined} className={cn('fixed inset-x-0 bottom-0 z-sticky', hide, className)}>
        {above}
        <div className="flex min-h-18 items-center gap-3 border-t border-hairline bg-surface px-4 pt-3 pb-[max(--spacing(3),env(safe-area-inset-bottom))] shadow-tabbar md:px-6">
          {summary ? <div className="min-w-0 flex-1">{summary}</div> : null}
          <div className={cn('flex items-center gap-2', summary ? 'shrink-0' : 'flex-1 [&>*]:flex-1')}>{children}</div>
        </div>
      </div>
    </>
  );
}
