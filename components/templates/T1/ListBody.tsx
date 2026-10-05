import type { ReactNode } from 'react';
import { cn } from '@/components/ui/cn';

/**
 * The heading row over the list — fish: «Alege următorul start» / «Live acum» + the count caption,
 * with the density toggle at the right end of the SAME row (it costs no vertical space), centred
 * on the title block whether or not the count line is there.
 *
 * `variant="quiet"`: in results mode the page h1 already says what was asked, so the count is a
 * quiet strong line (the h2 the list is labelled by), not a second title.
 *
 * While the list is loading — first page, or a tab / filter switch showing the previous list — the
 * count is a skeleton in the caption's own line box (no height change when the number lands), never
 * a stale or zero number. The number is announced from ONE always-mounted polite region that stays
 * empty while loading, so only the real count is spoken, including the first one.
 */
export function ListSummary({
  title,
  count,
  loading = false,
  variant = 'title',
  titleHiddenFrom,
  end,
  busy = false,
  id,
  className,
}: {
  title: ReactNode;
  /** «12 concursuri viitoare». Omit when there is nothing to count (empty, error, gate). */
  count?: ReactNode;
  loading?: boolean;
  variant?: 'title' | 'quiet';
  /**
   * From this breakpoint the whole row is visually hidden — the heading stays the region's name,
   * spoken and focusable — when the page shows the same words elsewhere (ListHeader's reserved band
   * shows the results count). The row then takes no space (no 56px strip over the list) and `end`
   * is not drawn: pass the same control to ListHeader `reserveEnd`, which shows it from 1280.
   */
  titleHiddenFrom?: 'xl';
  /** ViewToggle, a sort Select — only when there is data to switch. */
  end?: ReactNode;
  /**
   * The list under this heading is being replaced (a tab / filter switch over the previous rows): a
   * 2px accent bar pulses in the gap under the row — the wait is shown here, never by dimming the
   * rows' text (dimmed text fails AA). Drawn outside the row's box: nothing moves.
   */
  busy?: boolean;
  /** id of the h2 — the list region is labelled by it. */
  id?: string;
  className?: string;
}) {
  const quiet = variant === 'quiet';
  return (
    <div className={cn('relative flex items-center justify-between gap-3', titleHiddenFrom === 'xl' && 'xl:sr-only', className)}>
      <div className="min-w-0 flex-1">
        <h2 id={id} tabIndex={-1} className={cn(quiet ? 't-body-strong text-ink-2' : 't-title2 text-ink', 'outline-none')}>
          {title}
        </h2>
        {loading ? (
          <p aria-hidden className="t-caption mt-0.5">
            <span className="inline-block h-3 w-36 animate-shimmer rounded-full align-middle" />
          </p>
        ) : count ? (
          <p aria-hidden className="t-caption mt-0.5 text-muted">
            {count}
          </p>
        ) : null}
        <p aria-live="polite" className="sr-only">
          {/* Quiet (results) mode: the title IS the count. */}
          {loading ? '' : (count ?? (quiet ? title : null))}
        </p>
      </div>
      {end ? <div className={cn('flex shrink-0 items-center gap-2', titleHiddenFrom === 'xl' && 'xl:hidden')}>{end}</div> : null}
      {busy ? <span aria-hidden className="absolute inset-x-0 -bottom-2.5 h-0.5 animate-live rounded-full bg-accent" /> : null}
    </div>
  );
}

/**
 * ListGrid's column template per card minimum — shared with ListSkeleton so the skeleton has the
 * grid's exact columns (sm 240 · md 280 · lg 340; one column below 768). Nothing narrower than 240:
 * the kit poster card's footer (count + two badges) clips under ~230.
 */
export const LIST_GRID_COLS = {
  sm: 'md:grid-cols-[repeat(auto-fill,minmax(--spacing(60),1fr))]',
  md: 'md:grid-cols-[repeat(auto-fill,minmax(--spacing(70),1fr))]',
  lg: 'md:grid-cols-[repeat(auto-fill,minmax(--spacing(85),1fr))]',
} as const;

/**
 * The content column's ONE gutter (16): between the grid's cards, between the bento's tiles above
 * them, and between the column's stacked regions (ListPage) — so the vertical channels continue
 * from the hero into the cards. Share it, never restate it.
 */
export const LIST_GUTTER = 'gap-4';

/** The grid itself: ListGrid and the cards skeleton. */
export function listGridClass(min: keyof typeof LIST_GRID_COLS = 'md') {
  return cn('grid grid-cols-1', LIST_GUTTER, LIST_GRID_COLS[min]);
}

/**
 * Cards that auto-fill the content column (ROADMAP §4: more columns as the screen grows, never
 * wider cards). `min` is the narrowest a card may get before a column is dropped; one column below
 * 768 whatever it is.
 */
export function ListGrid({
  children,
  min = 'md',
  label,
  labelledBy,
  id,
  className,
}: {
  children: ReactNode;
  /** sm 240 · md 280 · lg 340 — the card's minimum width. */
  min?: keyof typeof LIST_GRID_COLS;
  label?: string;
  labelledBy?: string;
  id?: string;
  className?: string;
}) {
  return (
    <ul
      id={id}
      aria-label={label}
      aria-labelledby={labelledBy}
      className={cn(listGridClass(min), className)}
    >
      {children}
    </ul>
  );
}

/**
 * Dense rows on one surface, hairlines between (notifications, bookings, the «Listă» density).
 *
 * The rows are a size CONTAINER: a row lays its cells out as table columns by the LIST's width,
 * not the viewport's — from `@3xl` (768px of list), where four columns have room. At 1280 the
 * centre between the two docked columns is narrower than that, so it keeps the stacked phone row;
 * a wide centre (1440+, or a page without side columns) gets the table. Rows prefix their
 * table-only classes with `@3xl:`; the head (here and in ListSkeleton) shows from ROWS_HEAD — one
 * breakpoint, so the three never disagree.
 */
/** Container breakpoint of ListRows' table layout — prefix the row's table-only classes with it. */
export const ROWS_HEAD = '@3xl:block';

export function ListRows({
  children,
  label,
  labelledBy,
  id,
  head,
  className,
}: {
  children: ReactNode;
  label?: string;
  labelledBy?: string;
  id?: string;
  /** Column captions, shown in table layout (aria-hidden: each row names its own cells). */
  head?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('@container overflow-hidden rounded-card bg-surface shadow-e0', className)}>
      {head ? (
        <div aria-hidden className={cn('hidden border-b border-hairline px-4 py-2.5 t-label text-muted', ROWS_HEAD)}>
          {head}
        </div>
      ) : null}
      <ul id={id} aria-label={label} aria-labelledby={labelledBy} className="divide-y divide-hairline">
        {children}
      </ul>
    </div>
  );
}

/**
 * The list region: busy while a tab/filter change loads over the old rows. With ListTabs in button
 * mode pass `tabpanel` (the region is then the tabs' panel, labelled by the active tab).
 *
 * Busy never dims text (60% opacity took every label under AA and left the controls interactive at
 * that contrast): only the pictures fade, aria-busy says it to assistive tech, and the summary's
 * busy bar (ListSummary `busy`) shows the wait.
 */
export function ListRegion({
  id,
  labelledBy,
  tabpanel = false,
  busy = false,
  children,
  className,
}: {
  id?: string;
  labelledBy?: string;
  tabpanel?: boolean;
  busy?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      role={tabpanel ? 'tabpanel' : undefined}
      aria-labelledby={labelledBy}
      aria-busy={busy || undefined}
      className={cn(
        'flex flex-col',
        LIST_GUTTER,
        '[&_img]:transition-opacity [&_img]:duration-(--duration-fast) [&_img]:ease-fast',
        // The previous list stays (fish keepPreviousData); its photos fade so a slow switch reads as one.
        busy && '[&_img]:opacity-60',
        className,
      )}
    >
      {children}
    </section>
  );
}
