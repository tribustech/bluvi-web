import type { ReactNode } from 'react';
import { AdjustmentsHorizontalIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { cn } from '@/components/ui/cn';
import { COLUMN_CARD } from './ColumnCard';
import { AsideSkeleton } from './ListAside';
import { LIST_GUTTER, ListSummary } from './ListBody';
import { ListHeader } from './ListHeader';
import { ListPage } from './ListPage';
import { ListSkeleton } from './ListStates';
import { filterButtonClass, PAGE_RULE, SEARCH_SHELL } from './toolbarStyles';

/*
 * A whole T1 page while the server reads — a route's Suspense fallback. Built from the real pieces
 * (ListPage, ListHeader, ListSummary, ListSkeleton, the toolbar's own classes), so every region is
 * where the loaded page puts it: the docked filter column and aside from 1280, the 48 / 40 toolbar
 * with its filter button below 1280, the summary's real title over the list. When the stream
 * resolves, the content fills in place instead of moving in. Server-safe (no hooks, no handlers).
 */

/** The ListTabs row while the tabs load: same height, same rule (PAGE_RULE), `count` label-width bars. */
export function TabsSkeleton({ count = 3 }: { count?: number }) {
  const widths = ['w-16', 'w-10', 'w-18', 'w-14', 'w-12'];
  return (
    <div aria-hidden className={cn('flex min-h-11 items-end gap-6 border-b pb-3 md:gap-7', PAGE_RULE)}>
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className={cn('h-3.5 animate-shimmer rounded-full', widths[i % widths.length])} />
      ))}
    </div>
  );
}

/**
 * FilterColumn's shape: the real «Filtre» header row, then `sections` (rows per section) of
 * legend + list rows; `switchRow` adds the yes/no row on top (Concursuri «Locuri libere»).
 */
export function FilterColumnSkeleton({
  title = 'Filtre',
  sections = [5, 3],
  switchRow = false,
}: {
  title?: string;
  sections?: number[];
  switchRow?: boolean;
}) {
  return (
    <div aria-hidden className={cn('flex flex-col gap-5', COLUMN_CARD)}>
      <div className="flex min-h-9 items-center justify-between gap-2">
        <p className="t-heading text-ink">{title}</p>
        <span className="t-button-compact text-faint">Resetează</span>
      </div>
      {switchRow ? (
        <div className="flex items-center gap-3">
          <span className="flex flex-1 flex-col gap-1.5">
            <span className="h-3.5 w-24 rounded-full bg-soft-fill" />
            <span className="h-3 w-40 rounded-full bg-soft-fill" />
          </span>
          <span className="h-7 w-12 animate-shimmer rounded-full" />
        </div>
      ) : null}
      {sections.map((rows, s) => (
        <div key={s} className="flex flex-col gap-0.5">
          <span className="mb-2.5 h-3 w-20 rounded-full bg-soft-fill" />
          {Array.from({ length: rows }, (_, r) => (
            <span key={r} className="flex h-10 items-center">
              <span className={cn('h-3.5 rounded-full bg-soft-fill', r % 2 ? 'w-[55%]' : 'w-[70%]')} />
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

/** The ListToolbar row, inert: the search shell with its placeholder and, below 1280, the filter button. */
export function ToolbarSkeleton({ placeholder, filterButton = true }: { placeholder: string; filterButton?: boolean }) {
  return (
    <div aria-hidden className="flex items-center gap-2.5">
      <div className={cn(SEARCH_SHELL, 'min-w-0 flex-1')}>
        <MagnifyingGlassIcon className="size-5 shrink-0 text-muted" />
        <span className="min-w-0 flex-1 truncate t-body text-muted">{placeholder}</span>
      </div>
      {filterButton ? (
        <span className={cn(filterButtonClass(), 'pointer-events-none xl:hidden')}>
          <AdjustmentsHorizontalIcon />
          <span className="hidden md:inline">Filtre</span>
        </span>
      ) : null}
    </div>
  );
}

export function ListPageSkeleton({
  title,
  header,
  tabs = 3,
  filters,
  aside = 0,
  asideFrom = 'xl',
  searchPlaceholder,
  hero,
  summaryTitle,
  summary,
  list,
  label = 'Se încarcă…',
}: {
  title: ReactNode;
  /**
   * The whole header, when the page opens in another mode than browse (results mode: the back
   * square, «Rezultate pentru …» and the reserved band) — the fallback must be the frame the page
   * will open in, never the default one swapped out when the stream resolves. Overrides title/tabs.
   */
  header?: ReactNode;
  /** Tab count (0: the list has no tabs). */
  tabs?: number;
  /** The docked column's skeleton (FilterColumnSkeleton); omit for lists without filters. */
  filters?: ReactNode;
  /** Aside blocks held from the dock breakpoint (0: the page has no aside). */
  aside?: number;
  /** The page's ListPage `asideFrom`, so the skeleton docks the aside where the page will. */
  asideFrom?: 'xl' | '2xl';
  /** Omit for lists without a search row. */
  searchPlaceholder?: string;
  /** The hero's skeleton, when the page opens on one (PulseHeroSkeleton). */
  hero?: ReactNode;
  /** The summary's real title («Alege următorul start»), with the count line shimmering. */
  summaryTitle: ReactNode;
  /** The whole summary row, when the page's is not the title + shimmering count (results mode). */
  summary?: ReactNode;
  /** The list's skeleton; default the cards grid (ListSkeleton min="sm"). */
  list?: ReactNode;
  label?: string;
}) {
  return (
    <ListPage
      header={header ?? <ListHeader title={title} below={tabs > 0 ? <TabsSkeleton count={tabs} /> : undefined} />}
      filters={filters}
      aside={aside > 0 ? <AsideSkeleton blocks={aside} /> : undefined}
      asideFrom={asideFrom}
      asideInline={false}
      asideBusy={aside > 0}
    >
      {searchPlaceholder ? <ToolbarSkeleton placeholder={searchPlaceholder} filterButton={Boolean(filters)} /> : null}
      {hero}
      <div className={cn('flex flex-col', LIST_GUTTER)}>
        {summary ?? <ListSummary title={summaryTitle} loading />}
        {list ?? <ListSkeleton variant="cards" min="sm" count={6} label={label} />}
      </div>
    </ListPage>
  );
}
