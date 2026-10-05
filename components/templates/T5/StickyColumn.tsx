'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/components/ui/cn';

/** The page's breathing room under the top bar and above the window's bottom edge: spacing 6. */
const AIR_STEPS = 6;

/** spacing(n) in px, read from the --spacing token (so the offsets follow the scale). */
function spacing(n: number): number {
  const unit = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--spacing')) || 4;
  return unit * n;
}

/**
 * The sticky offset: the shell's top bar (the document's first <header>, measured — never a copy of
 * its height) plus the breathing room. Before mount the class `xl:top-22` (bar h-16 + 6) stands in.
 */
function topOffset(): number {
  const bar = document.querySelector<HTMLElement>('header')?.offsetHeight ?? 0;
  return bar + spacing(AIR_STEPS);
}

/**
 * A desktop side column «lipită la scroll» (the Acasă right column, StickyAside). A column shorter
 * than the window sticks under the top bar; a taller one sticks by its bottom edge instead
 * (negative top), so every card stays reachable with the page's own scroll — no nested scroller.
 * Sticky only from 1280 (below it the columns are stacked).
 */
export function StickyColumn({
  as: Tag = 'aside',
  label,
  className,
  children,
}: {
  as?: 'aside' | 'div' | 'nav';
  /** Accessible name of the landmark («Ce mă așteaptă», «Scurtături»). */
  label?: string;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  const [top, setTop] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setTop(Math.min(topOffset(), window.innerHeight - el.offsetHeight - spacing(AIR_STEPS)));
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
    <Tag
      ref={ref as never}
      aria-label={label}
      style={top == null ? undefined : { top }}
      className={cn('flex min-w-0 flex-col gap-4 xl:sticky xl:top-22 xl:gap-5 xl:self-start', className)}
    >
      {children}
    </Tag>
  );
}
