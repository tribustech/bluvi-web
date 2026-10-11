import type { ReactNode } from 'react';
import { SHELL_GUTTERS, SHELL_MAX, UNDER_BAR_TOP_MD } from '@/components/nav/shell';
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
 *
 * Phone (<768, ROADMAP §4b rule 25 — fish book-lake/[lakeId]/index.tsx, screen for screen): there is
 * no site bar, so the frame is the whole viewport; the ground is white (fish ScrollScreen
 * backgroundColor="white"), the grid card runs edge to edge (fish `marginHorizontal={-20}`, radius 12)
 * and reaches down to the home indicator (fish reserves `insets.bottom` under the rows).
 */

/**
 * Phone: exactly the viewport (no site bar — rule 25 — less the offline banner while it shows); the
 * grid scrolls inside it. From 768 (owner 2026-10-11, «no scroll inside scroll»): at least the
 * viewport under the 64px site bar, growing with the grid — the PAGE scrolls, the grid's day header
 * pins under the site bar and the selection bar to the viewport's bottom.
 */
export const FRAME_H =
  'h-[calc(100dvh-var(--shell-banner-h,0px))] md:h-auto md:min-h-[calc(100dvh-var(--spacing)*16-var(--shell-banner-h,0px))]';

/**
 * The grid card (the grid and its skeleton): edge to edge on a phone, radius 12 (fish AvailabilityGrid
 * card: `marginHorizontal={-20}`, borderRadius 12, a hairline); a card in the column from 768.
 */
export const GRID_CARD = 'rounded-xl border border-hairline bg-surface max-md:-mx-4 md:rounded-card';

export const BOOKING_TITLE_ID = 'rezerva-title';

type Props = {
  /** The lake's name; undefined while it is unknown — a title skeleton, never a placeholder name that then swaps (rule 4). */
  title: string | undefined;
  /** Over the title (the flow's FlowConfig.eyebrow). */
  eyebrow?: string;
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

export function BookingFrame({ title, eyebrow = 'Rezervă un stand', back, trailing, legend, collapsed = false, aside, dock, busy = false, children }: Props) {
  return (
    <div className={cn('flex flex-col bg-surface md:bg-page', FRAME_H)}>
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
          <T4Header title={title ?? <TitleSkeleton />} titleId={BOOKING_TITLE_ID} eyebrow={eyebrow} back={back} trailing={trailing} />
          {legend ? <div className={cn('mx-auto w-full pt-3', SHELL_MAX, SHELL_GUTTERS)}>{legend}</div> : null}
        </div>
      </div>
      <div
        className={cn(
          'mx-auto flex min-h-0 w-full flex-1 gap-6 pt-3 md:pb-4 lg:pb-6',
          // Phone: the grid ends above the home indicator; with the panel docked under it, the panel
          // carries the safe area (fish bottomReserved: the sheet's height, else insets.bottom).
          dock ? 'pb-3' : 'pb-[max(--spacing(3),env(safe-area-inset-bottom))]',
          SHELL_MAX,
          SHELL_GUTTERS,
        )}
      >
        <section aria-labelledby={BOOKING_TITLE_ID} aria-busy={busy || undefined} className="flex min-h-0 min-w-0 flex-1 flex-col">
          {children}
        </section>
        {aside ? (
          // The page scrolls from 768: the docked column pins under the site bar, a viewport tall.
          <div
            className={cn(
              'sticky hidden h-[calc(100dvh-var(--spacing)*22-var(--shell-banner-h,0px))] w-90 shrink-0 flex-col self-start lg:flex',
              UNDER_BAR_TOP_MD,
            )}
          >
            {aside}
          </div>
        ) : null}
      </div>
      {dock}
    </div>
  );
}

function TitleSkeleton() {
  return (
    <>
      <span className="sr-only">Se încarcă…</span>
      <span aria-hidden data-testid="booking-title-skeleton" className="inline-block h-6 w-48 max-w-full animate-shimmer rounded-full align-middle" />
    </>
  );
}
