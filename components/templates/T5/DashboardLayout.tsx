import type { ReactNode } from 'react';
import { cn } from '@/components/ui/cn';
import { StickyColumn } from './StickyColumn';
import { dashboardTracks } from './tracks';

export interface DashboardLayoutProps {
  /** Centre column: the work (KPI tiles, today's list, charts, tables). */
  main: ReactNode;
  /** Left column from 1280: context and filters (quick actions, period, the lake). */
  context?: ReactNode;
  /** Right column from 1280: «ce mă așteaptă» — what needs me next, the details. */
  aside?: ReactNode;
  /**
   * The phone/tablet composition (<1280), in the fish screen's own order. When the order of the
   * blocks on a phone interleaves the three columns (it usually does: fish puts the alert before
   * the list and the tiles after it), pass that order here: the columns then render only from
   * 1280 and this only below it — the hidden one is `display: none`, out of the accessibility
   * tree, so the DOM order always matches the visual order (focus order, WCAG 2.4.3).
   * Omitted: below 1280 the columns simply stack (context → main → aside) in one DOM.
   *
   * Both compositions are MOUNTED (one is display:none), so a block placed in both exists twice.
   * A stateful client block (a chart's window or metric, a form) must not keep its own state then:
   * lift it to the page and pass it to both copies, or crossing 1280 (rotating a tablet, resizing)
   * shows a copy on another choice. Radio groups need a per-instance name (useId), or the two
   * copies form one group and the visible one loses its checked radio.
   */
  stacked?: ReactNode;
  /**
   * Without `stacked`, what the side columns do below 1280: `stack` (default) — context, main,
   * aside in one column; `hidden` — only the main column shows, for a page whose main column
   * already carries, below 1280, the side blocks it needs in its own order (Acasă). Prefer this
   * to `stacked`: the big blocks (rails, lists) then exist once, and only the small side cards a
   * phone shows inside the main column are written twice.
   */
  sidesBelowXl?: 'stack' | 'hidden';
  /**
   * Where the left (context) column starts: `xl` (default) — three columns from 1280; `2xl` — at
   * 1280 centre · right only (the context column is display:none; the page repeats its blocks at
   * the top of the right column, 2xl:hidden) and three columns from 1440. For a centre made of
   * rails or grids that would drop to two cards in 1280's 608 (Acasă): it gets 872 there instead.
   */
  contextFrom?: 'xl' | '2xl';
  contextLabel?: string;
  asideLabel?: string;
  className?: string;
}

/**
 * T5 body. From 1280 (ROADMAP §4): three columns (from 1440 with `contextFrom="2xl"`) — context · content · «ce mă așteaptă» — the
 * side columns sticky under the top bar, the centre fluid up to the shell's 1680. Below 1280 one
 * column: the `stacked` composition when given, else the columns in a row.
 */
export function DashboardLayout({
  main,
  context,
  aside,
  stacked,
  sidesBelowXl = 'stack',
  contextFrom = 'xl',
  contextLabel = 'Scurtături',
  asideLabel = 'Ce mă așteaptă',
  className,
}: DashboardLayoutProps) {
  const tracks = dashboardTracks(Boolean(context), Boolean(aside), contextFrom);
  const sides = sidesBelowXl === 'hidden' ? 'max-xl:hidden' : undefined;
  // `2xl`: the context column is out of the layout (and the accessibility tree) at 1280 too.
  const contextSides = contextFrom === '2xl' ? (sidesBelowXl === 'hidden' ? 'max-2xl:hidden' : 'xl:max-2xl:hidden') : sides;
  const columns = (
    <>
      {context ? (
        <StickyColumn as="aside" label={contextLabel} className={contextSides}>
          {context}
        </StickyColumn>
      ) : null}
      {/* A size container: a block lays itself out by the room this column has (a pair of cards
          side by side only once the column is wide enough), not by the window. */}
      <div className="@container flex min-w-0 flex-col gap-4 md:gap-5 xl:gap-6">{main}</div>
      {aside ? (
        <StickyColumn as="aside" label={asideLabel} className={sides}>
          {aside}
        </StickyColumn>
      ) : null}
    </>
  );

  if (stacked) {
    return (
      <>
        <div className={cn('flex flex-col gap-4 md:gap-5 xl:hidden', className)}>{stacked}</div>
        <div className={cn('hidden items-start gap-6 xl:grid', tracks, className)}>{columns}</div>
      </>
    );
  }
  return (
    <div className={cn('flex flex-col gap-4 md:gap-5 xl:grid xl:items-start xl:gap-6', tracks, className)}>
      {columns}
    </div>
  );
}
