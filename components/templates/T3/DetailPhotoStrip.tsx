'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * The photo hero's list. Focusable only while it actually scrolls (the phone carousel with 2+
 * photos), so a keyboard can still move it (axe scrollable-region-focusable) — and never a dead Tab
 * stop where the mosaic shows every tile it has (from 768, `overflow-hidden`).
 */
export function DetailPhotoStrip({ label, className, children }: { label: string; className: string; children: ReactNode }) {
  const ref = useRef<HTMLUListElement>(null);
  const [scrolls, setScrolls] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => {
      const next = getComputedStyle(el).overflowX !== 'hidden' && el.scrollWidth > el.clientWidth + 1;
      setScrolls(prev => (prev === next ? prev : next));
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <ul ref={ref} aria-label={label} tabIndex={scrolls ? 0 : undefined} className={className}>
      {children}
    </ul>
  );
}
