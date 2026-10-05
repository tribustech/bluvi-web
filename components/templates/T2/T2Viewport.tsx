'use client';

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/components/ui/cn';

/**
 * Fills the window from wherever it starts down to the bottom edge, so a T2 page never scrolls as a
 * whole (the list and the map scroll / pan on their own). What sits above it varies — the top bar
 * (56 / 64), the breadcrumb band from 768, a page notice — so the offset is measured. The
 * server-rendered first guess is the shell chrome a T2 page has: the bar on a phone (56), bar +
 * breadcrumb band from 768 (64 + 40 = 104; a map screen is always below its section, so the band is
 * there), so bottom-anchored floats (pin card, «Vezi lista») do not jump when the measure lands.
 * TODO(shell): expose the chrome height as a CSS variable (--shell-chrome) and drop the constants.
 */
export function T2Viewport({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [top, setTop] = useState<number | null>(null);

  useLayoutEffect(() => {
    const measure = () => {
      const el = ref.current;
      if (!el) return;
      setTop(Math.round(el.getBoundingClientRect().top + window.scrollY));
    };
    measure();
    // Anything above that grows or shrinks (crumbs streaming in, a banner) changes the document.
    const ro = new ResizeObserver(measure);
    ro.observe(document.body);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  return (
    <div
      ref={ref}
      style={top === null ? undefined : { height: `calc(100dvh - ${top}px)` }}
      className={cn(
        'flex flex-col',
        top === null && 'h-[calc(100dvh-var(--spacing)*14)] md:h-[calc(100dvh-var(--spacing)*26)]',
        className,
      )}
    >
      {children}
    </div>
  );
}
