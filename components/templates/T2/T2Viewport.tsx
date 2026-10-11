'use client';

import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { lockViewport } from '@/components/surfaces/scrollLock';
import { cn } from '@/components/ui/cn';

/**
 * Fills the window from wherever it starts down to the bottom edge, so a T2 page never scrolls as a
 * whole (the list and the map scroll / pan on their own).
 *
 * Below 768 (owner 2026-10-10, iOS Safari): the phone has no top bar, so the frame is the window
 * itself — `fixed`, from the offline banner's edge (0 while online) to the bottom edge, under the
 * shell's bottom tab bar (T2Layout keeps its floats and the sheet above --tabbar-h). The document
 * then has nothing to scroll, and its viewport lock (scrollLock `lockViewport`: html[data-viewport-lock],
 * globals.css — held while this frame is mounted AND shown, released when it unmounts or its route is
 * hidden) also takes html / body's scroll and rubber-band away, like fish's map screen: the header can't be dragged, no band opens under
 * the tab bar whether Safari's toolbar is expanded or collapsed.
 *
 * From 768 what sits above it varies — the top bar (64), the breadcrumb band, a page notice — so
 * the offset is measured. The server-rendered first guess is bar + breadcrumb band (64 + 40 = 104;
 * a map screen is always below its section, so the band is there), so bottom-anchored floats do
 * not jump when the measure lands.
 * TODO(shell): expose the chrome height as a CSS variable (--shell-chrome) and drop the constants.
 */
export function T2Viewport({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [top, setTop] = useState<number | null>(null);

  // The document's scroll lock belongs to this mounted, shown frame (see scrollLock).
  useLayoutEffect(() => lockViewport(), []);

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
      data-viewport-frame=""
      style={top === null ? undefined : ({ '--t2-vp-top': `${top}px` } as CSSProperties)}
      className={cn(
        'flex flex-col',
        'max-md:fixed max-md:inset-x-0 max-md:top-(--shell-banner-h,0px) max-md:bottom-0',
        'md:h-[calc(100dvh-var(--t2-vp-top,calc(var(--spacing)*26)))]',
        className,
      )}
    >
      {children}
    </div>
  );
}
