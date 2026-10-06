'use client';

import { useRef, type ReactNode } from 'react';
import { useStickyTop } from '../T5/StickyColumn';

/** The sticky tab band under the top bar (DetailBand `sticky`, 44px): spacing 11. */
export const TAB_BAND_STEPS = 11;

/** The sticky section chip row under the top bar (DetailSectionNav, 58px): spacing 14.5. */
export const CHIP_ROW_STEPS = 14.5;

/**
 * DetailBody's sticky right column: T5 StickyColumn's rule (useStickyTop) — under the bar (and
 * whatever else is pinned under it, `offsetSteps`: the tab band, the chip row) while it fits the window, by its bottom edge when it is taller, so its
 * last card and every link in it stay reachable while it is stuck. The class's `top` stands in
 * until mount.
 */
export function DetailStickyAside({
  label,
  offsetSteps,
  className,
  children,
}: {
  label: string;
  offsetSteps: number;
  className: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  const top = useStickyTop(ref, offsetSteps);
  return (
    <aside ref={ref} aria-label={label} style={top == null ? undefined : { top }} className={className}>
      {children}
    </aside>
  );
}
