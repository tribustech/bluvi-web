import type { ReactNode } from 'react';
import { cn } from '@/components/ui/cn';

/*
 * From 1280, Bălți and Noutăți are a dense grid, not a rail (owner rule 5, ROADMAP §4b: at most two
 * rails per page — Acasă keeps Concursuri and Pescari de urmărit — and no sparse carousels). The
 * grid auto-fills tracks of at least the card's width (more cards as the column grows, never wider
 * ones, ROADMAP §4) and is capped to whole rows: the main column is a size container, so its
 * container steps know how many tracks fit (n × width + (n − 1) × 14 ≤ column) and hide every card
 * past `rows` × n — the last row is always full. «Vezi toate» in the section header is the way on.
 * Below 1280 the sections keep their rail (a phone swipes; HorizontalRail).
 *
 * Literal class strings (Tailwind reads them): `@min-[a]:@max-[b]` is a ≤ column < b.
 */
const CAPS = {
  /** Lakes: 200px tracks, two rows. */
  lakes:
    '@max-[414px]:[&>li:nth-child(n+3)]:hidden @min-[414px]:@max-[628px]:[&>li:nth-child(n+5)]:hidden @min-[628px]:@max-[842px]:[&>li:nth-child(n+7)]:hidden ' +
    '@min-[842px]:@max-[1056px]:[&>li:nth-child(n+9)]:hidden @min-[1056px]:@max-[1270px]:[&>li:nth-child(n+11)]:hidden @min-[1270px]:[&>li:nth-child(n+13)]:hidden',
  /** News: 224px tracks, one row (each card is a 330px banner card). */
  news:
    '@max-[462px]:[&>li:nth-child(n+2)]:hidden @min-[462px]:@max-[700px]:[&>li:nth-child(n+3)]:hidden @min-[700px]:@max-[938px]:[&>li:nth-child(n+4)]:hidden ' +
    '@min-[938px]:@max-[1176px]:[&>li:nth-child(n+5)]:hidden @min-[1176px]:@max-[1414px]:[&>li:nth-child(n+6)]:hidden @min-[1414px]:[&>li:nth-child(n+7)]:hidden',
} as const;

const TRACKS = {
  lakes: 'grid-cols-[repeat(auto-fill,minmax(--spacing(50),1fr))]',
  news: 'grid-cols-[repeat(auto-fill,minmax(--spacing(56),1fr))]',
} as const;

export type HomeGridKind = keyof typeof CAPS;

export function homeGridClass(kind: HomeGridKind) {
  return cn('grid gap-3.5', TRACKS[kind], CAPS[kind]);
}

/** The grid itself: one list, labelled like the rail it stands in for. */
export function HomeGrid({ kind, label, children, className }: { kind: HomeGridKind; label: string; children: ReactNode; className?: string }) {
  return (
    <ul aria-label={label} className={cn(homeGridClass(kind), className)}>
      {children}
    </ul>
  );
}

/** Its loading state: enough bones for the widest column; the caps keep the rows the cards will take. */
export function HomeGridSkeleton({ kind, heightClass, className }: { kind: HomeGridKind; heightClass: string; className?: string }) {
  return (
    <ul aria-hidden className={cn(homeGridClass(kind), className)}>
      {Array.from({ length: 12 }, (_, i) => (
        <li key={i} className={cn('rounded-card bg-soft-fill animate-shimmer', heightClass)} />
      ))}
    </ul>
  );
}
