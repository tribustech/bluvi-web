'use client';

import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { cn } from '@/components/ui/cn';

/**
 * The fish horizontal FlatList of the Acasă rails: bleeds to the screen edge (the page padding is
 * cancelled and given back as scroll padding), snaps per card, and asks for the next page when the
 * end comes near (fish `onEndReachedThreshold={0.7}`). Labelled as a list for screen readers.
 * With a mouse (fine pointer) previous/next arrows page through it — the scrollbar is hidden, so
 * without them a mouse has no visible way sideways; touch keeps the swipe only.
 */
export function HorizontalRail({
  label,
  children,
  onEndReached,
  footer,
  className,
}: {
  /** Accessible name of the list, e.g. «Concursuri live». */
  label: string;
  children: ReactNode;
  onEndReached?: () => void;
  /** Extra item after the cards (the next-page skeleton). */
  footer?: ReactNode;
  className?: string;
}) {
  const scroller = useRef<HTMLUListElement>(null);
  const listId = useId();
  const sentinel = useRef<HTMLLIElement>(null);
  const onEnd = useRef(onEndReached);
  useEffect(() => {
    onEnd.current = onEndReached;
  }, [onEndReached]);

  useEffect(() => {
    const root = scroller.current;
    const target = sentinel.current;
    if (!root || !target || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && onEnd.current?.(), {
      root,
      // ≈ fish's 0.7 threshold: start loading most of a viewport before the end.
      rootMargin: '0px 70% 0px 0px',
    });
    io.observe(target);
    return () => io.disconnect();
  }, []);

  return (
    <div className="relative">
      <ul
        ref={scroller}
        id={listId}
        aria-label={label}
        className={cn(
          '-mx-5 flex snap-x snap-mandatory scroll-px-5 gap-2.5 overflow-x-auto overscroll-x-contain px-5 pt-1 pb-4 md:-mx-6 md:scroll-px-6 md:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          className
        )}
      >
        {children}
        {footer ? <li className="shrink-0 snap-start">{footer}</li> : null}
        <li ref={sentinel} aria-hidden className="w-px shrink-0" />
      </ul>
      <RailArrows scroller={scroller} controls={listId} label={label} className="top-[calc(50%-6px)]" />
    </div>
  );
}

/**
 * Previous / next for a horizontal scroller, fine pointers only (`pointer-fine:`). Each press moves
 * one visible page; the scroller's snap then settles on a card edge. An arrow hides at its end.
 */
export function RailArrows({
  scroller,
  controls,
  label,
  className,
}: {
  scroller: RefObject<HTMLElement | null>;
  /** id of the scroller, for aria-controls. */
  controls: string;
  /** The list's name, for the buttons' names («Concursuri live: înapoi»). */
  label: string;
  /** Vertical placement of both arrows (they are centred on this line). */
  className?: string;
}) {
  const [edges, setEdges] = useState({ prev: false, next: false });

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const measure = () => {
      const max = el.scrollWidth - el.clientWidth;
      const next = { prev: el.scrollLeft > 4, next: el.scrollLeft < max - 4 };
      setEdges((cur) => (cur.prev === next.prev && cur.next === next.next ? cur : next));
    };
    el.addEventListener('scroll', measure, { passive: true });
    // Also the first measure: a ResizeObserver reports the size it starts observing.
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    // Cards arrive with the next page: the scroll width grows without a resize.
    const mo = new MutationObserver(measure);
    mo.observe(el, { childList: true });
    return () => {
      el.removeEventListener('scroll', measure);
      ro.disconnect();
      mo.disconnect();
    };
  }, [scroller]);

  const page = (dir: -1 | 1) => {
    const el = scroller.current;
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollBy({ left: dir * Math.max(el.clientWidth * 0.85, 160), behavior: reduce ? 'auto' : 'smooth' });
  };

  const button =
    'absolute z-10 hidden size-9 -translate-y-1/2 items-center justify-center rounded-full bg-surface text-ink shadow-e2 transition-opacity duration-(--duration-fast) ease-fast hover:bg-soft-fill pointer-fine:flex';
  return (
    <>
      <button
        type="button"
        aria-controls={controls}
        aria-label={`${label}: înapoi`}
        onClick={() => page(-1)}
        tabIndex={edges.prev ? 0 : -1}
        aria-hidden={!edges.prev}
        className={cn(button, '-left-2', className, !edges.prev && 'pointer-events-none opacity-0')}
      >
        <ChevronLeftIcon aria-hidden className="size-5 stroke-2" />
      </button>
      <button
        type="button"
        aria-controls={controls}
        aria-label={`${label}: înainte`}
        onClick={() => page(1)}
        tabIndex={edges.next ? 0 : -1}
        aria-hidden={!edges.next}
        className={cn(button, '-right-2', className, !edges.next && 'pointer-events-none opacity-0')}
      >
        <ChevronRightIcon aria-hidden className="size-5 stroke-2" />
      </button>
    </>
  );
}

/** One card slot in a rail: fixed width, snaps, stretches to the tallest card. */
export function RailItem({ width, children }: { width: 160 | 200 | 225; children: ReactNode }) {
  return (
    <li className={cn('flex shrink-0 snap-start', width === 160 ? 'w-40' : width === 200 ? 'w-50' : 'w-[225px]')}>
      <div className="w-full">{children}</div>
    </li>
  );
}

/** Grey card placeholder (fish moti Skeleton in the rails). */
export function CardSkeleton({ width, height }: { width: 160 | 200 | 225; height: number }) {
  return (
    <div
      aria-hidden
      style={{ height }}
      className={cn('shrink-0 rounded-card bg-soft-fill animate-shimmer', width === 160 ? 'w-40' : width === 200 ? 'w-50' : 'w-[225px]')}
    />
  );
}
