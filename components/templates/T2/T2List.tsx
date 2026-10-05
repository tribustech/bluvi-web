'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '@/components/ui/cn';
import { listGridClass } from '@/components/templates/T1';
import { useT2Frame } from './context';

/*
 * The list side of T2: heading row, the grid of items, one item, and the loading skeleton.
 * Items stay page components (LakeCard, a public-water row…); T2ListItem only adds the link to
 * the map — hover / focus highlights the pin, a selected pin outlines and reveals its item.
 *
 * Selection colour: accent on both halves — the selected pin is the accent badge, larger, with an
 * accent halo (T2MapPin); its item gets a 2px accent outline on its edge (a token utility, not a raw shadow; the focus ring sits 2px outside it).
 *
 * Announcements: the count is spoken by T2Layout's one live region (`announcement`), not here —
 * the header and the skeleton are silent so a first load or a pan says one thing once.
 */

/**
 * «12 bălți în această zonă» — centred on a phone (fish sheet header), left from 768 where it
 * heads a column. The T1 ListSummary «quiet» look (t-body-strong ink-2, the count is the title).
 * The <h2> is always there (the region keeps its heading for screen readers):
 * - `loading` (first load): its text is «Se încarcă rezultatele» for screen readers only, with the
 *   caption-height shimmer beside it, in a line box of the title's height so nothing moves;
 * - `stale` (refreshing after a pan): the last title stays, muted — no shimmer blinking on every pan.
 * Not ListSummary itself: it carries its own aria-live, and T2 speaks through T2Layout's one region.
 */
export function T2ListHeader({
  title,
  loading = false,
  stale = false,
  trailing,
}: {
  title: string;
  loading?: boolean;
  stale?: boolean;
  /** Right side from 768 (sort). */
  trailing?: ReactNode;
}) {
  return (
    <div className="flex min-h-8 items-center justify-center gap-3 md:justify-between">
      <h2
        tabIndex={-1}
        className={cn(
          't-body-strong outline-none transition-colors duration-(--duration-fast) ease-fast',
          stale ? 'text-muted' : 'text-ink-2',
        )}
      >
        {loading ? (
          <>
            <span className="sr-only">Se încarcă rezultatele</span>
            <span aria-hidden className="inline-block h-3 w-36 animate-shimmer rounded-full align-middle" />
          </>
        ) : (
          title
        )}
      </h2>
      {trailing ? <div className="hidden shrink-0 md:flex">{trailing}</div> : null}
    </div>
  );
}

/**
 * The T1 card grid (listGridClass): one column on a phone and in the 360px tablet column; from 1280
 * the cards auto-fill (min 280px) — more columns as the list grows, never wider cards.
 * `stale`: refreshing after a pan — the cards fade (they are still the last answer, still usable).
 */
export function T2List({ children, label, stale = false }: { children: ReactNode; label?: string; stale?: boolean }) {
  return (
    <ul
      aria-label={label}
      aria-busy={stale || undefined}
      className={cn(listGridClass('md'), 'transition-opacity duration-(--duration-fast) ease-fast', stale && 'opacity-60')}
    >
      {children}
    </ul>
  );
}

export function T2ListItem({
  id,
  selected = false,
  onHighlight,
  children,
}: {
  id: string;
  selected?: boolean;
  /** Called with the id on hover / focus and with null when it leaves (highlights the pin). */
  onHighlight?: (id: string | null) => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLLIElement>(null);
  const { split } = useT2Frame();
  // A pin selected on the map brings its item into view in the list column (from 768; on a phone
  // the pin card replaces the sheet). Only the list scrolls — scrollIntoView would also scroll the
  // page and the clipped template around it.
  useEffect(() => {
    const el = ref.current;
    const scroller = el?.closest<HTMLElement>('[data-t2-scroll]');
    if (!selected || !split || !el || !scroller) return;
    const item = el.getBoundingClientRect();
    const view = scroller.getBoundingClientRect();
    const margin = 16;
    const delta =
      item.top < view.top + margin ? item.top - view.top - margin : item.bottom > view.bottom - margin ? item.bottom - view.bottom + margin : 0;
    if (delta) scroller.scrollBy({ top: delta, behavior: 'smooth' });
  }, [selected, split]);
  return (
    <li
      ref={ref}
      data-t2-id={id}
      onMouseEnter={() => onHighlight?.(id)}
      onMouseLeave={() => onHighlight?.(null)}
      onFocus={() => onHighlight?.(id)}
      onBlur={() => onHighlight?.(null)}
      // The card fills its grid cell, so cards in one row end together (content stays top-aligned).
      className={cn(
        'flex flex-col rounded-card *:flex-1',
        selected && 'outline-2 outline-accent',
      )}
    >
      {children}
    </li>
  );
}

/**
 * Card skeletons while the first page loads, in the shape of the card they stand in for — LakeCard
 * (Fundații §07 card · baltă): the 132px photo band shimmering, then in the card's 12px padding and
 * 6px rhythm a t-heading line (title), a t-caption line (place · species) and, with `stat`, the
 * t-stat price line. Each bar sits in a line box of its text step, so the skeleton is the card's
 * height and nothing moves when the cards land (§5 CLS). Same grid as T2List.
 * Silent: T2Layout's live region says «Se încarcă rezultatele» once.
 * TODO(kit): LakeCardSkeleton in components/cards (this task may only touch T2).
 */
export function T2ListSkeleton({ count = 4, stat = false }: { count?: number; stat?: boolean }) {
  return (
    <ul aria-hidden className={listGridClass('md')}>
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="flex flex-col overflow-hidden rounded-card bg-surface shadow-[var(--shadow-e1),var(--shadow-e0)]">
          <span className="block h-33 shrink-0 animate-shimmer" />
          <span className="flex flex-col gap-1.5 p-3">
            <span className="block t-heading">
              <span className="inline-block h-4 w-[70%] rounded-full bg-soft-fill align-middle" />
            </span>
            <span className="block t-caption">
              <span className="inline-block h-3 w-1/2 rounded-full bg-soft-fill align-middle" />
            </span>
            {stat ? (
              <span className="block pt-0.5 t-stat">
                <span className="inline-block h-5 w-24 rounded-full bg-soft-fill align-middle" />
              </span>
            ) : null}
          </span>
        </li>
      ))}
    </ul>
  );
}
