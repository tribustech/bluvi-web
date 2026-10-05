'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
// The ✕ is an action: 24 outline at 16 (Fundații §05 — solid is only for presence marks).
import { XMarkIcon } from '@heroicons/react/24/outline';
import { cn } from '@/components/ui/cn';
import { FOCUS_RING, PILL_H } from './toolbarStyles';

/** The phone scroller's edge fades: 24px dissolve on each side that can still scroll. */
const FADE = {
  end: 'max-md:[mask-image:linear-gradient(to_right,black_calc(100%-(--spacing(6))),transparent)]',
  start: 'max-md:[mask-image:linear-gradient(to_right,transparent,black_--spacing(6))]',
  both: 'max-md:[mask-image:linear-gradient(to_right,transparent,black_--spacing(6),black_calc(100%-(--spacing(6))),transparent)]',
} as const;

export type ActiveFilter = {
  key: string;
  /** The choice, not the question: «Weekendul acesta», not «Perioadă». */
  label: string;
  /**
   * Only the LIVE dot (LiveDot) — the one state the system marks this way. No category glyphs: the
   * label is the choice, and the system has no 16 glyph set for them.
   */
  leading?: ReactNode;
  onClear: () => void;
};

/**
 * What is narrowing the list right now, and nothing else — fish CompetitionFilterChips. A chip
 * appears only once a choice is made, says the choice, and its ✕ undoes that one choice. Nothing
 * chosen → nothing rendered. «Șterge tot» only past two chips: with one or two, clearing them one by
 * one is the same number of taps.
 *
 * Tint, not fill (accent-tint + accent-ink, 7.5:1 — the selected filter rows' look): the chips rank
 * BELOW the content they narrow; three saturated pills were the loudest thing on the page. With the
 * filter column docked (≥1280) the column already shows every choice — pass `className="xl:hidden"`.
 *
 * Phone: one line that scrolls sideways (bleeds to the screen edge, fading on the side that still
 * scrolls), with «Șterge tot» pinned at its end, outside the scroller, so it is never off-screen.
 * From 768 the chips and «Șterge tot» wrap as one row.
 *
 * Focus: a ✕ removes the very chip that has focus. Focus then moves to the next chip, else the
 * previous one, else the first of `fallbackFocusIds` that exists (the list's h2, the page h1) —
 * never back to <body>. «Șterge tot» goes straight to the fallback.
 */
export function ActiveFilters({
  filters,
  onClearAll,
  label = 'Filtre active',
  fallbackFocusIds = [],
  className,
}: {
  filters: ActiveFilter[];
  onClearAll?: () => void;
  label?: string;
  /** Where focus goes when no chip is left to take it — first id found wins (tabIndex=-1 headings). */
  fallbackFocusIds?: string[];
  className?: string;
}) {
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const scroller = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: false, end: false });
  const hasChips = filters.length > 0;
  useEffect(() => {
    const row = scroller.current;
    if (!row) return;
    const check = () => {
      const start = row.scrollLeft > 1;
      const end = row.scrollLeft + row.clientWidth < row.scrollWidth - 1;
      setEdges((e) => (e.start === start && e.end === end ? e : { start, end }));
    };
    check();
    row.addEventListener('scroll', check, { passive: true });
    const ro = new ResizeObserver(check);
    ro.observe(row);
    for (const child of Array.from(row.children)) ro.observe(child);
    return () => {
      row.removeEventListener('scroll', check);
      ro.disconnect();
    };
  }, [hasChips, filters.length]);
  // The chip key to focus after the next render, or '' for the fallback; null = nothing pending.
  const pending = useRef<string | null>(null);
  const fallback = useRef(fallbackFocusIds);
  useEffect(() => {
    fallback.current = fallbackFocusIds;
  });
  useEffect(() => {
    const target = pending.current;
    if (target === null) return;
    pending.current = null;
    const chip = target ? buttons.current.get(target) : undefined;
    if (chip) return chip.focus();
    for (const id of fallback.current) {
      const el = document.getElementById(id);
      if (el) return el.focus();
    }
  });

  if (filters.length === 0) return null;
  const clearAll = onClearAll && filters.length > 2;
  return (
    <div
      role="group"
      aria-label={label}
      className={cn('-mx-4 flex items-center gap-2 md:mx-0 md:flex-wrap', clearAll ? 'pr-4 md:pr-0' : null, className)}
    >
      <div
        ref={scroller}
        className={cn(
          'flex min-w-0 flex-1 gap-2 overflow-x-auto py-0.5 pl-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:contents',
          clearAll ? null : 'pr-4',
          edges.start && edges.end ? FADE.both : edges.end ? FADE.end : edges.start ? FADE.start : null,
        )}
      >
        {filters.map((f, i) => (
          <button
            key={f.key}
            ref={(el) => {
              if (el) buttons.current.set(f.key, el);
              else buttons.current.delete(f.key);
            }}
            type="button"
            onClick={() => {
              pending.current = filters[i + 1]?.key ?? filters[i - 1]?.key ?? '';
              f.onClear();
            }}
            aria-label={`${f.label}, elimină filtrul`}
            className={cn(
              PILL_H,
              'flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-accent-tint pr-2.5 pl-3 t-label whitespace-nowrap text-accent-ink',
              'transition-[background-color,opacity] duration-(--duration-fast) ease-fast hover:bg-accent-tint-2 active:opacity-80',
              FOCUS_RING,
            )}
          >
            {f.leading ? (
              <span aria-hidden className="flex items-center">
                {f.leading}
              </span>
            ) : null}
            {f.label}
            <XMarkIcon aria-hidden className="size-4" />
          </button>
        ))}
      </div>
      {clearAll ? (
        <button
          type="button"
          onClick={() => {
            pending.current = '';
            onClearAll();
          }}
          aria-label="Șterge toate filtrele"
          className={cn(
            PILL_H,
            'flex shrink-0 cursor-pointer items-center rounded-full bg-surface px-3 t-label whitespace-nowrap text-ink-2 shadow-e0 hover:bg-soft-fill',
            'transition-[background-color,opacity] duration-(--duration-fast) ease-fast active:opacity-80',
            FOCUS_RING,
          )}
        >
          Șterge tot
        </button>
      ) : null}
    </div>
  );
}
