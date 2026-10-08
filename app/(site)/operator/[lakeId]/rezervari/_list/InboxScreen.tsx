'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useInfiniteQuery } from '@tanstack/react-query';
import { ArrowPathIcon, CalendarIcon, InboxIcon } from '@heroicons/react/24/outline';
import { useNowTick } from '@/components/account/angler/SessionHistoryCard';
import { BookingDetailDialog, rateAnglerHref, useBookingDetailParam } from '@/components/operator';
import { useOperatorBookingActions } from '@/components/operator/actions/useOperatorBookingActions';
import { useBreakpoint } from '@/components/surfaces/useBreakpoint';
import { FOCUS_RING, ListEmpty, ListError, pageToolClass, useListUrlState } from '@/components/templates/T1';
import { cn } from '@/components/ui/cn';
import { BUCKET_LABELS, emptyCopy, lakeBookingsInfiniteQuery, type BookingDTO, type OperatorBucket, type OperatorSub } from '@/core/booking';
import { isApiError } from '@/core/transport';
import { routes } from '@/lib/routes';
import { useSiteToast } from '../../../../_shell/Toast';
import { OperatorErrorState } from '../../../_shared/OperatorErrorState';
import { OperatorFrame, OperatorTitleSkeleton, operatorTrail } from '../../../_shared/OperatorFrame';
import { useOperatorTransport } from '../../../_shared/useOperatorTransport';
import { useOwnedLakeName } from '../../../_shared/useOwnedLakeName';
import { BucketTabs, InboxChrome } from './BucketTabs';
import { INBOX_TITLE, InboxSkeleton, PANEL_ID } from './frame';
import { DOCKED_PANEL, LIST_CONTAINER, LIST_ITEMS, LIST_SURFACE, rowGrid } from './layout';
import { ListFooter } from './ListFooter';
import { focusIndex, inboxItems, inboxUrlValues, itemKey, listHasCardActions, parseInboxPlace, pendingBadge, subOf, type InboxItem } from './model';
import { OperatorBookingRow, type RowHandlers } from './OperatorBookingRow';
import { SubFilterRow } from './SubFilterRow';
import { TurnoverCard } from './TurnoverCard';

/**
 * /operator/[lakeId]/rezervari — operator.rezervari (T1), fish app/(app)/operator/[lakeId]/bookings.tsx.
 *
 *  - c1 header: back (the panel when there is no in-app history), «Administrare rezervări» over the
 *    lake's name, the refresh control (c13) and the round «Calendarul bălții» button → the calendar.
 *  - c2–c5, c27 the pinned chrome: the four bucket tabs (icons, the «De aprobat» badge from the
 *    FIRST page's pendingCount, never 0) and the sub chips of Confirmate / Nefinalizate, each tab
 *    remembering its sub while the page is open.
 *  - c6 / operator.b.status-param — the starting tab from ?status= (fish bucketFromLegacyStatus);
 *    the place is mirrored back into the URL (history.replaceState, which Next's router follows —
 *    no server round trip), so a reload or Back returns to the same list.
 *  - c7 a tab / sub change goes back to the top, where the title shows again.
 *  - c8, c11 one infinite query per (bucket, sub), 20 a page; the next page as the footer nears the
 *    viewport or on «Mai multe»; its failure keeps the rows and offers a retry in the footer.
 *  - c9 an uncached tab is the skeleton (never the previous tab's rows); a cached one paints at once
 *    and revalidates (staleTime 0: also on window focus — operator.b.refresh).
 *  - c10 a failed first page: the inline error with a retry, no sign-out (a 403 — not this owner's
 *    lake — reads «Nu ai acces»).
 *  - c12 an empty list says what is empty, per bucket and sub.
 *  - c14 Confirmate · Azi grouped by stand, the turnover cards.
 *  - c15–c23, c25 the rows (./OperatorBookingRow); c24 a row opens the booking detail (seeded with the
 *    row): a sheet on the phone, a dialog 768–1279, a side panel docked beside the list from 1280.
 *  - c26 / operator.b.focus-param — ?focus= scrolls that booking under the chrome once it is loaded.
 */
export function InboxScreen({
  lakeId,
  initialStatus,
  initialFiltru,
  focus,
}: {
  lakeId: string;
  initialStatus?: string;
  initialFiltru?: string;
  focus?: string;
}) {
  const t = useOperatorTransport();
  const router = useRouter();
  const toast = useSiteToast();
  const lakeName = useOwnedLakeName(lakeId);
  const now = useNowTick();
  const desktop = useBreakpoint() === 'desktop';

  // c5, c6 — the tab and the sub each tab was left on, seeded from the link.
  const [initial] = useState(() => parseInboxPlace(initialStatus, initialFiltru));
  const [bucket, setBucket] = useState<OperatorBucket>(initial.bucket);
  const [subByBucket, setSubByBucket] = useState<Partial<Record<OperatorBucket, OperatorSub | undefined>>>({ [initial.bucket]: initial.sub });
  const sub = subOf(bucket, subByBucket);
  const place = useMemo(() => ({ bucket, sub }), [bucket, sub]);
  useListUrlState(inboxUrlValues(place));

  // c8, c9, c13 — per owner, never cached anywhere but here; stale at once, so a cached tab
  // revalidates when it comes back and the list refreshes when the window regains focus.
  const list = useInfiniteQuery({
    ...lakeBookingsInfiniteQuery(t, lakeId, bucket, sub),
    staleTime: 0,
  });
  const rows = useMemo(() => list.data?.pages.flatMap((p) => p.data) ?? [], [list.data]);
  const items = useMemo(() => inboxItems(rows, place), [rows, place]);
  // c3 — read off the FIRST page: the badge must not depend on how far the operator scrolled.
  const badge = pendingBadge(list.data?.pages[0]?.pendingCount);
  const cardActions = listHasCardActions(place);

  const actions = useOperatorBookingActions({ lakeId, lakeName });
  const detail = useBookingDetailParam();
  const [seed, setSeed] = useState<BookingDTO | null>(null);

  // The control that opened the detail, so focus returns to it once the detail closes.
  const opener = useRef<HTMLElement | null>(null);
  const handlers = useMemo<RowHandlers>(
    () => ({
      onOpen: (b) => {
        opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        setSeed(b);
        detail.open(b.documentId);
      },
      onAccept: (b) => actions.accept(b),
      onReject: (b) => actions.reject(b),
      onRate: (b) => router.push(rateAnglerHref(b)),
    }),
    // detail.open / the action openers are stable callbacks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [detail.open, actions.accept, actions.reject, router],
  );
  const open = !!detail.bookingId;
  const docked = open && desktop;
  // The docked panel is not modal: move focus into it (its heading) so Escape and Tab work at once,
  // and give it back to the row when it closes.
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!docked) return;
    const heading = panelRef.current?.querySelector<HTMLElement>('aside header h2');
    if (heading) {
      heading.tabIndex = -1;
      heading.classList.add('outline-none');
      heading.focus({ preventScroll: true });
    }
  }, [docked, detail.bookingId]);
  useEffect(() => {
    if (open) return;
    const el = opener.current;
    opener.current = null;
    if (el?.isConnected && (document.activeElement === document.body || !document.activeElement)) el.focus({ preventScroll: true });
  }, [open]);

  // c13 — the refresh control (fish pull-to-refresh).
  const [refreshing, setRefreshing] = useState(false);
  const refresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    const r = await list.refetch();
    setRefreshing(false);
    if (r.isError && r.data) toast('Nu am putut încărca rezervările.', 'danger');
  }, [list, refreshing, toast]);

  // c7 — back to the top of a different list, the title row in view again.
  const toTop = () => window.scrollTo({ top: 0 });
  const onBucket = (b: OperatorBucket) => {
    if (b === bucket) return;
    setBucket(b);
    toTop();
  };
  const onSub = (s: OperatorSub | undefined) => {
    if (s === sub) return;
    setSubByBucket((prev) => ({ ...prev, [bucket]: s }));
    toTop();
  };

  // c26 — bring ?focus= on screen once it is in the loaded rows; once only (a refetch never yanks
  // the list back). At the top it only shows the header (scrolling would hide the card under it).
  const focusDone = useRef(false);
  const listReady = now !== null && !list.isPending;
  useEffect(() => {
    if (!focus || focusDone.current || !listReady) return;
    const index = focusIndex(items, focus);
    if (index < 0) return;
    focusDone.current = true;
    if (index === 0) {
      window.scrollTo({ top: 0 });
      return;
    }
    const el = document.querySelector<HTMLElement>(`[data-item="${CSS.escape(itemKey(items[index]))}"]`);
    const chrome = document.querySelector<HTMLElement>('[data-testid="inbox-chrome"]');
    if (!el) return;
    const stick = chrome ? (parseFloat(getComputedStyle(chrome).top) || 0) + chrome.offsetHeight : 0;
    window.scrollTo({
      top: el.getBoundingClientRect().top + window.scrollY - stick - 12,
    });
  }, [focus, items, listReady]);

  const loaded = list.data !== undefined;
  const failed = list.isError && !loaded;
  const forbidden = failed && isApiError(list.error) && list.error.status === 403;
  const next = routes.operatorBookings(lakeId);

  let body;
  if (list.isPending || now === null) {
    body = <InboxSkeleton />;
  } else if (failed) {
    body = forbidden ? (
      <OperatorErrorState error={list.error} onRetry={() => void list.refetch()} retrying={list.isFetching} attempt={list.errorUpdateCount} next={next} />
    ) : (
      // fish InlineErrorState: no second back, no sign-out — a list that failed is not a session problem.
      <ListError
        title="Nu am putut încărca rezervările."
        description="Verifică conexiunea și încearcă din nou."
        onRetry={() => void list.refetch()}
        retrying={list.isFetching}
        attempt={Math.max(1, list.errorUpdateCount)}
      />
    );
  } else if (items.length === 0) {
    body = (
      <div data-testid="inbox-empty">
        <ListEmpty title={emptyCopy(bucket, sub)} icon={<InboxIcon aria-hidden className="size-12 text-muted" strokeWidth={1.5} />} />
      </div>
    );
  } else {
    body = (
      <>
        <InboxList
          items={items}
          nowMs={now}
          cardActions={cardActions}
          actingId={actions.actingId}
          selectedId={detail.bookingId ?? null}
          lakeId={lakeId}
          lakeName={lakeName}
          handlers={handlers}
          label={BUCKET_LABELS[bucket]}
        />
        <ListFooter
          hasMore={Boolean(list.hasNextPage)}
          loadingMore={list.isFetchingNextPage}
          error={list.isFetchNextPageError}
          onLoadMore={() => {
            if (!list.isFetchingNextPage) void list.fetchNextPage();
          }}
        />
      </>
    );
  }

  return (
    <OperatorFrame
      title={INBOX_TITLE}
      caption={lakeName ?? <OperatorTitleSkeleton className="h-3 w-28" />}
      back={{ fallbackHref: routes.operator(lakeId) }}
      trail={operatorTrail({ label: lakeName ?? 'Balta', href: routes.operator(lakeId) }, { label: 'Rezervări' })}
      trailing={
        <>
          <button type="button" onClick={() => void refresh()} aria-busy={refreshing || undefined} data-testid="inbox-refresh" className={pageToolClass()}>
            <ArrowPathIcon aria-hidden className={cn(refreshing && 'animate-spin motion-reduce:animate-none')} />
            <span className="sr-only md:not-sr-only">Reîmprospătează</span>
          </button>
          {/* fish: the round indigo calendar button — the same reservations on stand × time (c1). */}
          <Link
            href={routes.operatorCalendar(lakeId)}
            aria-label="Calendarul bălții"
            title="Calendarul bălții"
            data-testid="inbox-calendar"
            className={cn(
              'flex size-12 shrink-0 items-center justify-center rounded-full bg-accent-tint text-accent-ink transition-colors duration-(--duration-fast) ease-fast hover:bg-accent-tint-2 xl:size-10',
              FOCUS_RING,
            )}
          >
            <CalendarIcon aria-hidden className="size-5" strokeWidth={2} />
          </Link>
        </>
      }
    >
      <InboxChrome>
        <BucketTabs bucket={bucket} pendingCount={badge} onBucket={onBucket} />
        <SubFilterRow bucket={bucket} sub={sub} onSub={onSub} />
      </InboxChrome>
      <div className={cn('min-w-0', docked && 'xl:grid xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start xl:gap-6')}>
        <section
          id={PANEL_ID}
          role="tabpanel"
          aria-labelledby={`${PANEL_ID}-tab-${bucket}`}
          aria-busy={list.isPending || undefined}
          data-bucket={bucket}
          data-sub={sub ?? ''}
          className="min-w-0"
        >
          {body}
        </section>
        <div ref={panelRef} className="contents">
          <BookingDetailDialog
            lakeId={lakeId}
            lakeName={lakeName}
            bookingId={detail.bookingId}
            seed={seed}
            onClose={detail.close}
            actions={actions}
            intent="context"
            panelClassName={DOCKED_PANEL}
          />
        </div>
      </div>
      {actions.dialogs}
    </OperatorFrame>
  );
}

/** The rows, laid out by the list's own width (./layout.ts); the column head from 768 of list. */
function InboxList({
  items,
  nowMs,
  cardActions,
  actingId,
  selectedId,
  lakeId,
  lakeName,
  handlers,
  label,
}: {
  items: InboxItem[];
  nowMs: number;
  cardActions: boolean;
  actingId: string | null;
  /** The booking the detail shows (c24): marked in the list (master–detail). */
  selectedId: string | null;
  lakeId: string;
  lakeName?: string | null;
  handlers: RowHandlers;
  label: string;
}) {
  return (
    <div className={LIST_CONTAINER}>
      <div className={LIST_SURFACE}>
        <div
          aria-hidden
          data-testid="inbox-head"
          className={cn('hidden border-b border-hairline bg-soft-fill px-4 py-2.5 t-label text-muted @3xl:grid', rowGrid(cardActions))}
        >
          <span className="[grid-area:name]">Pescar</span>
          <span className="[grid-area:stand]">Stand</span>
          <span className="[grid-area:period]">Perioadă</span>
          <span className="text-right [grid-area:price]">
            Sumă<span className="@5xl:hidden"> · stare</span>
          </span>
          <span className="hidden [grid-area:pill] @5xl:block">Stare</span>
          {cardActions ? <span className="hidden text-right [grid-area:acts] @5xl:block">Acțiuni</span> : null}
        </div>
        <ul aria-label={label} data-testid="inbox-list" className={LIST_ITEMS}>
          {items.map((it) => (
            <li key={itemKey(it)} data-item={itemKey(it)} className="min-w-0">
              {it.kind === 'turnover' ? (
                <TurnoverCard
                  bookings={it.bookings}
                  nowMs={nowMs}
                  actingId={actingId}
                  selectedId={selectedId}
                  lakeId={lakeId}
                  lakeName={lakeName}
                  handlers={handlers}
                />
              ) : (
                <OperatorBookingRow
                  booking={it.booking}
                  nowMs={nowMs}
                  cardActions={cardActions}
                  withActions={cardActions}
                  acting={actingId === it.booking.documentId}
                  selected={selectedId === it.booking.documentId}
                  lakeId={lakeId}
                  lakeName={lakeName}
                  handlers={handlers}
                />
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
