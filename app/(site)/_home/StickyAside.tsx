'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

/** Below the 64px desktop header, with the page's 24px breathing room. */
const TOP = 88;
const BOTTOM = 24;

/**
 * The desktop right column, «lipită la scroll» (design). A column shorter than the window sticks
 * under the header; a taller one sticks by its bottom edge instead (negative top), so every card
 * stays reachable with the page's own scroll — no nested scroller.
 */
export function StickyAside({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const [top, setTop] = useState(TOP);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setTop(Math.min(TOP, window.innerHeight - el.offsetHeight - BOTTOM));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener('resize', update);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
    };
  }, []);

  return (
    <aside ref={ref} aria-label={label} style={{ top }} className={`sticky ${className ?? ''}`}>
      {children}
    </aside>
  );
}
