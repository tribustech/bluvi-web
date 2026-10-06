import type { ReactNode } from 'react';
import { SHELL_GUTTERS } from '@/components/nav/shell';
import { cn } from '@/components/ui/cn';
import { LIST_GUTTER } from './ListBody';
import { TRACK_GAP, TRACKS } from '../tracks';

/**
 * T1 «Listă cu filtre» — the page frame (ROADMAP §4). Used by Concursuri, Știri, Pescari,
 * Notificări, Rezervări, Sondaje.
 *
 * Regions, top to bottom on a phone (the fish order: title → tabs → search row → list):
 *   header   — ListHeader (title, count, actions) and ListTabs, full width.
 *   filters  — the filter column. ≥1280 only, sticky, live-apply (nothing to confirm on a desk).
 *              Below 1280 the same content opens in FiltersSurface (Sheet / Dialog) from the
 *              toolbar's FilterButton, so the caller renders it twice — inline here, in the
 *              surface there — and keeps one state.
 *   children — the content column, in this order: ListToolbar → ActiveFilters (right under the
 *              «Filtre» button that produced them, never cut off from it by the results) → hero →
 *              ListSummary → the body → ListFooter.
 *   aside    — the right column ("ce mă așteaptă", your registrations, a CTA). Docked from 1280
 *              (ROADMAP §4: three columns from 1280). Below 1280 it is NOT dropped: it renders
 *              inline under the content (`asideInline="end"`, the default), or the caller places it
 *              itself (`asideInline={false}`, e.g. right after a hero) and ListPage only docks it.
 *              Pass `undefined` / `null` only once every source has SETTLED empty — never an empty
 *              fragment (an empty column, an empty landmark). While its sources load pass
 *              <AsideSkeleton />, so the three-column frame is there from the first paint and
 *              nothing reflows when the data lands.
 *   actions  — StickyActions: the primary action pinned above the phone's thumb (<768).
 *
 * Widths (owner decision 2026-10-04): full width with the shell gutters, the content column grows;
 * the card grid inside it auto-fills (ListGrid) so a wide screen gets more columns, never wider
 * cards. The side columns are the shared template tracks (../tracks.ts): filters 240 → 256 from
 * 1440, aside 320 → 360, 24 gaps — so the centre holds two 240px cards (ListGrid min="sm") at
 * 1280 (608) and at 1440 (712), three once it reaches 752 (a ~1480 window). A poster list whose pages would end on a lone card at
 * 1280 (two columns in the 608 centre) takes `asideFrom="2xl"`: the aside docks from 1440 only, on
 * the late 320 track (TRACKS.*ThenRight), so the centre is 952 at 1280 and 752 at 1440 — three
 * posters at both, a wider screen never shows fewer columns.
 */
/** The aside's inline grid below the dock: two blocks share a row from 768, a lone block spans it. */
export const ASIDE_INLINE = 'grid gap-4 md:grid-cols-2 md:[&>:only-child]:col-span-2';

export function ListPage({
  header,
  filters,
  filtersLabel = 'Filtre',
  aside,
  asideLabel,
  asideFrom = 'xl',
  asideInline = 'end',
  asideBusy = false,
  actions,
  children,
  className,
}: {
  header: ReactNode;
  /** Desktop filter column (≥1280). Omit for lists without filters (notifications). */
  filters?: ReactNode;
  /** Accessible name of the filter column landmark. */
  filtersLabel?: string;
  /** Right column. undefined / null when empty (see above). */
  aside?: ReactNode;
  /** Accessible name of the aside landmark («Ce urmează», «Înscrierile tale»). */
  asideLabel?: string;
  /** Breakpoint from which the aside is docked: 1280 (default) or, opt-in, 1440. */
  asideFrom?: 'xl' | '2xl';
  /** Below the dock breakpoint: render the aside under the content ('end'), or not (the caller places it). */
  asideInline?: 'end' | false;
  /** The aside is an AsideSkeleton while its sources load (aria-busy on the landmark). */
  asideBusy?: boolean;
  /** StickyActions (phone). */
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const hasFilters = Boolean(filters);
  const hasAside = aside !== undefined && aside !== null && aside !== false;
  const xl = asideFrom === 'xl';

  return (
    <div className={cn(SHELL_GUTTERS, 'pt-4 pb-10 md:pt-6 xl:pt-8 xl:pb-16', Boolean(actions) && 'pb-28 md:pb-10', className)}>
      {header}
      <div
        className={cn(
          'mt-4 md:mt-5 xl:mt-6',
          'xl:grid xl:items-start',
          // ONE filter track and ONE gap whatever the aside does: the column never changes width when
          // the aside lands, empties or retries, so the centre and its cards never reflow sideways. A
          // pending aside is a skeleton (AsideSkeleton), never undefined, for the same reason.
          // The shared template tracks (../tracks.ts: 240 / 256 · 1fr · 320 / 360, 24 apart).
          (hasFilters || hasAside) && TRACK_GAP,
          hasFilters && hasAside && xl && TRACKS.three,
          hasFilters && hasAside && !xl && TRACKS.leftMainThenRight,
          hasFilters && !hasAside && TRACKS.leftMain,
          !hasFilters && hasAside && xl && TRACKS.mainRight,
          !hasFilters && hasAside && !xl && TRACKS.mainThenRight,
        )}
      >
        {hasFilters ? (
          <aside
            aria-label={filtersLabel}
            // A flex column capped at the viewport: FilterColumn scrolls its sections INSIDE the card,
            // so the card's padding and radius always show (never sliced mid-row by the sticky clip).
            className="hidden xl:sticky xl:top-22 xl:flex xl:max-h-[calc(100dvh-(--spacing(28)))] xl:flex-col"
          >
            {filters}
          </aside>
        ) : null}
        <div className={cn('flex min-w-0 flex-col', LIST_GUTTER)}>{children}</div>
        {hasAside ? (
          <aside
            aria-label={asideLabel}
            aria-busy={asideBusy || undefined}
            className={cn(
              // Below the dock: inline under the content, two blocks side by side from 768 — a lone
              // block spans the row (no empty half-row next to it).
              asideInline === 'end' ? cn('mt-8', ASIDE_INLINE) : 'hidden',
              // Docked: stacked blocks keep the page's 16px step whether or not they also render inline.
              xl
                ? 'xl:sticky xl:top-22 xl:mt-0 xl:flex xl:flex-col xl:gap-4'
                : cn(
                    '2xl:sticky 2xl:top-22 2xl:mt-0 2xl:flex 2xl:flex-col 2xl:gap-4',
                    // 1280–1439: under the content, in the content's column, not under the filters.
                    hasFilters && 'xl:col-start-2 2xl:col-start-auto',
                  ),
            )}
          >
            {aside}
          </aside>
        ) : null}
      </div>
      {actions}
    </div>
  );
}
