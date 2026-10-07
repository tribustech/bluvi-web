'use client';

import type { MouseEvent, ReactNode } from 'react';
import { MEDAL, isMedalPlace, RANKING_HEAD } from '@/components/ranking';
import { cn } from '@/components/ui/cn';

/*
 * The one table look of the three rankings (owner rules 12 and 16): a card holding a real <table>,
 * the coloured header band (RANKING_HEAD, fish's indigo2 header), hairlines between rows, number
 * columns sized to their figures (`w-px`, nowrap) and the name column taking what is left. The
 * table is as wide as its card; the card's width is capped by the screen (RankingScreen), so the
 * figures never drift across a 1440+ screen.
 */

export const TABLE_CARD = 'overflow-hidden rounded-card bg-surface shadow-e0';

/** A header cell: the coloured band, the column label. `num`: a right-aligned, content-sized figure column. */
export function Th({ children, num, className }: { children: ReactNode; num?: boolean; className?: string }) {
  return (
    <th scope="col" className={cn(RANKING_HEAD, 'h-10 px-3 t-label whitespace-nowrap first:pl-4 last:pr-4', num ? 'w-px text-right' : 'text-left', className)}>
      {children}
    </th>
  );
}

/** A body cell: the row's height, a hairline on top. */
export function Td({ children, num, className }: { children?: ReactNode; num?: boolean; className?: string }) {
  return (
    <td className={cn('h-14 border-t border-hairline px-3 first:pl-4 last:pr-4', num ? 'w-px text-right whitespace-nowrap tabular-nums' : '', className)}>
      {children}
    </td>
  );
}

/** The place column. Medal places (1–3) on the medal chip (the navy digit, AA on every medal); 4+ muted. */
export function PlaceCell({ rank }: { rank: number }) {
  const medal = isMedalPlace(rank);
  return (
    <td className="h-14 w-px border-t border-hairline pr-1 pl-4 text-center">
      <span
        className={cn('inline-flex size-7 items-center justify-center rounded-full tabular-nums', medal ? cn('t-label', MEDAL[rank]) : 't-body-strong text-muted')}
        data-testid="rank"
        data-medal={medal ? rank : undefined}
      >
        <span className="sr-only">Locul </span>
        {rank}
      </span>
    </td>
  );
}

/**
 * A row that opens what its main link opens: a press anywhere on the row clicks the row's link
 * (the link itself is the keyboard path and what a reader announces). Text being selected is left
 * alone.
 */
export function rowClick(e: MouseEvent<HTMLTableRowElement>) {
  const target = e.target as HTMLElement;
  if (target.closest('a, button')) return;
  if (window.getSelection()?.toString()) return;
  e.currentTarget.querySelector<HTMLAnchorElement>('a[data-row-link]')?.click();
}

/** The row's main link look: the name, underlined on hover, the kit focus ring. */
export const ROW_LINK =
  'rounded-control outline-hidden hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-accent';

/** The quiet line inside the card when a ranking has no rows (fish caption gray5, centred). */
export function TableNote({ children, testId }: { children: ReactNode; testId: string }) {
  return (
    <div className={TABLE_CARD}>
      <p className="px-6 py-6 text-center t-body text-muted" data-testid={testId}>
        {children}
      </p>
    </div>
  );
}

/** The table's grey shape while the first period loads. */
export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div aria-hidden className={TABLE_CARD}>
      <div className={cn(RANKING_HEAD, 'h-10')} />
      <ul className="divide-y divide-hairline">
        {Array.from({ length: rows }, (_, i) => (
          <li key={i} className="flex h-14 items-center gap-3 px-4">
            <span className="size-7 shrink-0 animate-shimmer rounded-full" />
            <span className="size-8 shrink-0 animate-shimmer rounded-full max-md:hidden" />
            <span className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span className="h-3.5 w-[45%] animate-shimmer rounded-full" />
              <span className="h-3 w-[30%] animate-shimmer rounded-full md:hidden" />
            </span>
            <span className="h-3.5 w-14 shrink-0 animate-shimmer rounded-full" />
          </li>
        ))}
      </ul>
    </div>
  );
}
