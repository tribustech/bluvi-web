'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useInfiniteQuery } from '@tanstack/react-query';
import { ChevronRightIcon } from '@heroicons/react/24/outline';
import { Tag } from '@/components/cards/parts';
import { ResponsiveSurface } from '@/components/surfaces/ResponsiveSurface';
import { pickSurface } from '@/components/surfaces/rule';
import { useBreakpoint } from '@/components/surfaces/useBreakpoint';
import { ListError, ListFooter } from '@/components/templates/T1';
import { UNDER_BAR_TOP_MD } from '@/components/nav/shell';
import { cn } from '@/components/ui/cn';
import { flattenPages, organizerStatDetailsInfiniteQuery, type OrganizerStatKey } from '@/core/organizer';
import type { Transport } from '@/core/transport';
import { formatCount } from '@/core/realtime/chat/format';
import { routes } from '@/lib/routes';
import { dateRangeLabel, participantsLine, STAT_DETAIL, STAT_DETAILS_PAGE_SIZE, statDetailValue, STATUS_BADGE } from './model';
import { STAT_DOT, STAT_SOLID } from './stats';

/**
 * organizer.panel c8–c11 — fish StatDetailSheet: the competitions behind one KPI, 5 a page
 * (infinite), each row opening its competition. The kit's surface rule: a bottom sheet on a phone,
 * a dialog on a tablet, and from 1280 a side panel docked at the window's right edge under the top
 * bar and the offline banner. While it is docked the page reserves its width (DOCKED_PAGE_PAD on
 * DashboardPage), so nothing on the page sits under it. Escape / «Închide» close it.
 */
export function StatDetailPanel({ t, statKey, onClose }: { t: Transport; statKey: OrganizerStatKey; onClose: () => void }) {
  const copy = STAT_DETAIL[statKey];
  const q = useInfiniteQuery(organizerStatDetailsInfiniteQuery(t, statKey, { isOrganizer: true, pageSize: STAT_DETAILS_PAGE_SIZE }));
  const rows = useMemo(() => flattenPages(q.data) ?? [], [q.data]);
  const total = q.data?.pages[0]?.meta.pagination.total;
  const breakpoint = useBreakpoint();

  const subtitle = (
    <span className="flex items-center gap-2">
      <span aria-hidden data-testid="stat-dot" className={cn('size-2.5 shrink-0 rounded-full', STAT_DOT[copy.tone])} />
      {total !== undefined ? formatCount(total, 'competiție', 'competiții') : 'Se încarcă…'}
    </span>
  );

  let body: ReactNode;
  if (q.isPending) body = <RowsSkeleton />;
  else if (q.isError && !q.data)
    body = <ListError title="Nu am putut încărca lista." onRetry={() => void q.refetch()} retrying={q.isFetching} attempt={q.errorUpdateCount} />;
  else if (rows.length === 0) body = <p className="t-body py-8 text-center text-muted">{copy.emptyMessage}</p>;
  else
    body = (
      <>
        <ul className="flex flex-col" aria-label={copy.title}>
          {rows.map((item) => {
            const c = item.competition;
            const badge = STATUS_BADGE[c.competitionStatus];
            const dates = dateRangeLabel(c.startDate, c.endDate);
            return (
              <li key={item.documentId} className="border-b border-hairline last:border-b-0">
                <Link
                  href={routes.competition(c.documentId)}
                  onClick={onClose}
                  className="group -mx-2 flex min-h-16 items-center gap-3 rounded-control px-2 py-2.5 outline-none hover:bg-soft-fill focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="t-body-strong truncate text-ink">{c.name}</span>
                    <span className="flex flex-wrap items-center gap-1.5">
                      {dates ? <span className="t-micro text-muted">{dates}</span> : null}
                      {badge ? <Tag tone={badge.tone}>{badge.label}</Tag> : null}
                    </span>
                    <span className="t-micro text-ink-2">{participantsLine(c.participantsRegistered, c.participantsLimit)}</span>
                  </span>
                  <span className={cn('shrink-0 rounded-badge px-2 py-1 t-micro-strong whitespace-nowrap', STAT_SOLID[copy.tone])}>{statDetailValue(statKey, item)}</span>
                  <ChevronRightIcon aria-hidden className="size-4 shrink-0 text-muted" />
                </Link>
              </li>
            );
          })}
        </ul>
        <ListFooter
          hasMore={Boolean(q.hasNextPage)}
          loadingMore={q.isFetchingNextPage}
          onLoadMore={() => void q.fetchNextPage()}
          error={q.isFetchNextPageError}
          spinner
          moreLabel="Mai multe"
          errorLabel="Nu am putut încărca mai multe."
        />
      </>
    );

  const surface = (
    <ResponsiveSurface open intent="context" title={copy.title} subtitle={subtitle} onClose={onClose} panelClassName="h-full" sheetSnap={0.5}>
      <div data-testid="stat-detail" data-stat={statKey}>
        {body}
      </div>
    </ResponsiveSurface>
  );
  if (pickSurface('context', breakpoint) !== 'panel') return surface;
  return createPortal(<DockedPanel onClose={onClose}>{surface}</DockedPanel>, document.body);
}

/**
 * The page's end padding while the panel is docked: the panel (SidePanel, 420) plus the 32 gutter,
 * minus the space <main> already leaves beside the SHELL_MAX column (436) — never under the gutter.
 */
export const DOCKED_PAGE_PAD = 'xl:pe-[max(--spacing(8),calc(420px_+_--spacing(8)_-_max(0px,(100vw_-_--spacing(436))/2)))]';

/** ≥1280: fixed at the right edge under the top bar + banner; focus moves into it, Escape closes (SidePanel). */
function DockedPanel({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const back = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    ref.current?.querySelector<HTMLElement>('button[aria-label="Închide"]')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (back?.isConnected) back.focus();
    };
  }, [onClose]);
  return (
    <div ref={ref} data-testid="stat-dock" className={cn('fixed right-0 bottom-0 z-overlay flex', UNDER_BAR_TOP_MD)}>
      {children}
    </div>
  );
}

/** c10 — five row bones while the first page loads. */
function RowsSkeleton() {
  return (
    <div role="status" aria-label="Se încarcă…" data-testid="stat-detail-skeleton">
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} aria-hidden className="flex items-center gap-3 border-b border-hairline py-3 last:border-b-0">
          <span className="flex flex-1 flex-col gap-2">
            <span className="h-3.5 w-3/5 animate-shimmer rounded-full" />
            <span className="h-2.5 w-2/5 animate-shimmer rounded-full" />
            <span className="h-2.5 w-1/4 animate-shimmer rounded-full" />
          </span>
          <span className="h-6 w-20 animate-shimmer rounded-badge" />
        </div>
      ))}
    </div>
  );
}
