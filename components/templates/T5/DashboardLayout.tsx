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
  contextLabel?: string;
  asideLabel?: string;
  className?: string;
}

/**
 * T5 body. From 1280 (ROADMAP §4): three columns — context · content · «ce mă așteaptă» — the
 * side columns sticky under the top bar, the centre fluid up to the shell's 1680. Below 1280 one
 * column: the `stacked` composition when given, else the columns in a row.
 */
export function DashboardLayout({
  main,
  context,
  aside,
  stacked,
  contextLabel = 'Scurtături',
  asideLabel = 'Ce mă așteaptă',
  className,
}: DashboardLayoutProps) {
  const tracks = dashboardTracks(Boolean(context), Boolean(aside));
  const columns = (
    <>
      {context ? (
        <StickyColumn as="aside" label={contextLabel}>
          {context}
        </StickyColumn>
      ) : null}
      <div className="flex min-w-0 flex-col gap-4 md:gap-5 xl:gap-6">{main}</div>
      {aside ? (
        <StickyColumn as="aside" label={asideLabel}>
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
