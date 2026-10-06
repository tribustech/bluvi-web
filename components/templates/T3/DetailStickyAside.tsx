'use client';

import { useRef, type ReactNode } from 'react';
import { useStickyTop } from '../T5/StickyColumn';

/** The sticky tab band under the top bar (DetailBand `sticky`, 44px): spacing 11. */
const TAB_BAND_STEPS = 11;

/**
 * DetailBody's sticky right column: T5 StickyColumn's rule (useStickyTop) — under the bar (and the
 * tab band, `belowTabs`) while it fits the window, by its bottom edge when it is taller, so its
 * last card and every link in it stay reachable while it is stuck. The class's `top` stands in
 * until mount.
 */
export function DetailStickyAside({
  label,
  belowTabs,
  className,
  children,
}: {
  label: string;
  belowTabs: boolean;
  className: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  const top = useStickyTop(ref, belowTabs ? TAB_BAND_STEPS : 0);
  return (
    <aside ref={ref} aria-label={label} style={top == null ? undefined : { top }} className={className}>
      {children}
    </aside>
  );
}
