import type { ReactNode } from 'react';
import { SHELL_GUTTERS, SHELL_MAX } from '@/components/nav/shell';
import { T4Header, type T4Back } from '@/components/templates/T4';
import { cn } from '@/components/ui/cn';

/*
 * The grid step's page frame (T4). T4Frame lays a step out on the PAGE's scroll (sticky header,
 * sticky action bar); the grid needs the opposite — a bounded box whose one scroller owns both
 * axes, so its day header can stay pinned to the grid's top edge at every scroll position (owner
 * rule 3) while the stand names stay pinned left. So this frame is the viewport under the top bar,
 * as tall as it is, with the T4 parts in it:
 *   T4Header (back · lake name · «Azi») and the legend — folded away on a phone while a selection
 *   exists (fish BookingGridStep, a 220ms height + opacity fold, c5) and kept from 1024, where the
 *   screen has the room (web_note);
 *   the grid, full width of its column (ROADMAP §4), and from 1024 the right summary column (owner
 *   rule 1);
 *   below 1024 the selection panel docked under the grid, in the flow: the grid gives it its height.
 * The page itself never scrolls, so the phone's top bar never conceals and nothing can float.
 */

/** The viewport under the site bar (56 / 64 from 768) and the offline banner while it shows. */
export const FRAME_H =
  'h-[calc(100dvh-var(--spacing)*14-var(--shell-banner-h,0px))] md:h-[calc(100dvh-var(--spacing)*16-var(--shell-banner-h,0px))]';

export const BOOKING_TITLE_ID = 'rezerva-title';

type Props = {
  title: string;
  back: T4Back;
  /** «Azi» (only with a grid). */
  trailing?: ReactNode;
  /** The legend row under the header (only with a grid). */
  legend?: ReactNode;
  /** Fold the header and the legend away (below 1024 only — the caller decides — while a selection is up). */
  collapsed?: boolean;
  /** From 1024: the right column (the summary card). */
  aside?: ReactNode;
  /** Below 1024: the selection panel, docked under the grid. */
  dock?: ReactNode;
  busy?: boolean;
  children: ReactNode;
};

export function BookingFrame({ title, back, trailing, legend, collapsed = false, aside, dock, busy = false, children }: Props) {
  return (
    <div className={cn('flex flex-col bg-page', FRAME_H)}>
      <div
        data-testid="booking-header"
        data-collapsed={collapsed || undefined}
        inert={collapsed}
        className={cn(
          'grid shrink-0 transition-[grid-template-rows,opacity] duration-[220ms] ease-medium motion-reduce:transition-none',
          collapsed ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100',
        )}
      >
        <div className="min-h-0 overflow-y-clip">
          <T4Header title={title} titleId={BOOKING_TITLE_ID} eyebrow="Rezervă un stand" back={back} trailing={trailing} />
          {legend ? <div className={cn('mx-auto w-full pt-3', SHELL_MAX, SHELL_GUTTERS)}>{legend}</div> : null}
        </div>
      </div>
      <div className={cn('mx-auto flex min-h-0 w-full flex-1 gap-6 pt-3 pb-3 md:pb-4 lg:pb-6', SHELL_MAX, SHELL_GUTTERS)}>
        <section aria-labelledby={BOOKING_TITLE_ID} aria-busy={busy || undefined} className="flex min-h-0 min-w-0 flex-1 flex-col">
          {children}
        </section>
        {aside ? <div className="hidden w-90 shrink-0 flex-col lg:flex">{aside}</div> : null}
      </div>
      {dock}
    </div>
  );
}
