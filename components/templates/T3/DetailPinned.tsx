'use client';

import { useRef, type ReactNode } from 'react';
import { UNDER_BAR_TOP_MD } from '@/components/nav/shell';
import { cn } from '@/components/ui/cn';
import { usePinnedFollowingBar } from './followBar';
import { FULL_BLEED_HAIRLINE, FULL_BLEED_SURFACE, PINNED_TOP_PHONE } from './metrics';

/*
 * The one pinned anatomy of a T3 page on the phone (fish VenuePinnedNav): once the header has
 * scrolled away, a mini title row (46: title, a meta line, a share chip) pins above the page's
 * navigation (the lake's section chips, the competition's route tabs). The bar hides on scroll down
 * and the pinned rows follow it to the top edge (STICKY_TOP: the bar's own `top` transition), so the detail screens look
 * like one app and the pinned strip is always a header, never a bare row hanging in the air.
 *
 * The mini row overlaps the header's last 46px while the header is visible (invisible, inert,
 * click-through) and fades in once the band pins, so the page never jumps when it appears.
 */

/** Phone mini row (fish PINNED_MINI_HEIGHT 46). Hidden from assistive tech: it repeats the h1. */
export function DetailPinnedTitle({
  pinned,
  start,
  title,
  badge,
  meta,
  end,
}: {
  pinned: boolean;
  /**
   * Left: the back chip (fish VenuePinnedNav `leftAccessory={<BackButton/>}`). Once the header has
   * scrolled away and the phone bar is concealed, it is the only way back on screen (lakes c12).
   */
  start?: ReactNode;
  title: string;
  /**
   * On the title line, after the name: a state pill (the competition's LIVE / Viitor / …). A 26px
   * pill under the title would not fit the 46px row (it touched the tabs), so states go here.
   */
  badge?: ReactNode;
  /** Under the title, a text line: «★ 4,33 · 1 recenzie». */
  meta?: ReactNode;
  /** Right: a share chip. */
  end?: ReactNode;
}) {
  return (
    <div
      data-t3="pinned-mini"
      aria-hidden={!pinned}
      inert={!pinned}
      className={cn(
        'flex h-11.5 items-center gap-3 px-4 transition-opacity duration-(--duration-fast) md:hidden',
        pinned ? 'pointer-events-auto opacity-100' : 'opacity-0',
      )}
    >
      {start}
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate t-body-strong">{title}</span>
          {badge}
        </span>
        {meta ? <span className="flex items-center gap-1 t-label text-muted">{meta}</span> : null}
      </div>
      {end}
    </div>
  );
}

/**
 * A band of route tabs that pins: on the phone under the bar with the mini title row above it
 * (following the bar to the edge), from 768 under the 64px bar (which never hides). It casts the
 * stack's shadow once pinned (the bar above drops its own: shell BAR_SHADOW).
 */
export function DetailPinnedBand({
  start,
  title,
  badge,
  meta,
  end,
  children,
  className,
}: {
  /** The mini row's back chip (DetailPinnedTitle `start`). */
  start?: ReactNode;
  title: string;
  badge?: ReactNode;
  meta?: ReactNode;
  end?: ReactNode;
  /** The navigation (DetailTabs). */
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const pinned = usePinnedFollowingBar(ref);
  return (
    <div
      ref={ref}
      data-t3="pinned-band"
      data-pinned={pinned || undefined}
      className={cn(
        'sticky z-sticky flex flex-col',
        FULL_BLEED_SURFACE,
        FULL_BLEED_HAIRLINE,
        PINNED_TOP_PHONE,
        UNDER_BAR_TOP_MD,
        // Phone: the band rises over the header's last 46px (the mini row's place), click-through
        // and without its surface until it pins, so the header under it stays visible and usable.
        'max-md:pointer-events-none max-md:-mt-11.5 max-md:before:opacity-0 max-md:data-pinned:before:opacity-100',
        // The shadow from the full-bleed surface: it spans the screen like the band, not the column.
        'data-pinned:before:shadow-e1',
        className,
      )}
    >
      <DetailPinnedTitle pinned={pinned} start={start} title={title} badge={badge} meta={meta} end={end} />
      <div className="pointer-events-auto bg-surface md:bg-transparent">{children}</div>
    </div>
  );
}
