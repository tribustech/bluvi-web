'use client';

import { useInfiniteQuery, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BookingDetailDialog, useBookingDetailParam } from '@/components/operator';
import { useOperatorBookingActions } from '@/components/operator/actions/useOperatorBookingActions';
import { useBreakpoint } from '@/components/surfaces/useBreakpoint';
import { bookingQuery, lakeBookingsInfiniteQuery, type BookingDTO, type LakeBookingsPage } from '@/core/booking';
import { isApiError } from '@/core/transport';
import { routes } from '@/lib/routes';
import { useSiteToast } from '@/app/(site)/_shell/Toast';
import type { GridMark } from '@/app/(site)/balti/[id]/rezerva/_grid/AvailabilityGrid';
import { BookingFrame } from '@/app/(site)/balti/[id]/rezerva/_grid/BookingFrame';
import { BookingGridScreen, type BookedCell, type GridLake } from '@/app/(site)/balti/[id]/rezerva/_grid/BookingGridScreen';
import { OperatorErrorState } from '../../../_shared/OperatorErrorState';
import { useOperatorTransport } from '../../../_shared/useOperatorTransport';
import { findBookingForCell, holdsStand, MAX_EXTRA_PAGES, mayBeOnLaterPage } from './findBookingForCell';
import { walkInFlow } from './flowConfig';

/*
 * operator.calendar — /operator/[lakeId]/calendar: the lake's calendar AND step 1 of the walk-in
 * (fish app/(app)/operator/[lakeId]/walk-in/index.tsx). It is the angler's grid (BookingGridScreen)
 * in walk-in mode (flowConfig.ts), plus what only the operator has:
 *
 *  - c6: a booked band opens the booking it stands for in the operator booking detail
 *    (components/operator BookingDetailDialog, seeded with the list row so it paints at once). The
 *    identity is a client-side join against the lake's own bookings (bucket «all», findBookingForCell)
 *    — the availability is anonymous by design. The list is latest-first, so a lake booked far ahead
 *    keeps the coming days on later pages: the activation reads on until the list passes the booked
 *    interval's own start (the availability's, carried by BookedCell — mayBeOnLaterPage), fish reads
 *    one page only. While a lookup runs — the list's first page still loading included (never read an
 *    empty list as «not found»; fish swallows that tap, the web keeps it and answers once the list
 *    lands) — the band shows it is busy (spinner, aria-busy); a definitive miss says so in a toast.
 *    The lookup runs only when a booked band is activated, never per cell, and the grid does not
 *    re-render when the list lands (BookingGridScreen reads the handler through a ref). The band
 *    whose booking is open carries a ring (aria-current) while ?rezervare= is that booking.
 *    The open booking lives in ?rezervare= (useBookingDetailParam), as on the panel and the inbox.
 *    From 1280 the detail docks in the right column, next to the grid (SidePanel, intent `context`):
 *    the operator compares neighbouring stands with it open; below, a dialog (768+) or a sheet.
 *  - operator.b.role-gating: the CMS owner-gates the bookings list; its 403 (not this owner's lake)
 *    or 401 (a dead session) replaces the grid with OperatorErrorState. Any other failure of the list
 *    leaves the grid working (booked bands then open nothing).
 *  - The detail acts through useOperatorBookingActions (accept / reject / cancel / no-show): every
 *    write invalidates ['bookings'], which re-reads the availability under the grid.
 */
type LakeBookingsData = InfiniteData<LakeBookingsPage, unknown>;

export function WalkInGridScreen({ lake, next }: { lake: GridLake; next: string }) {
  const lakeId = lake.documentId;
  const config = useMemo(() => walkInFlow(lakeId), [lakeId]);
  const t = useOperatorTransport();
  const toast = useSiteToast();
  const bookings = useInfiniteQuery({
    ...lakeBookingsInfiniteQuery(t, lakeId, 'all'),
    // The join must agree with the grid, which is re-read on every mount (c8).
    refetchOnMount: 'always',
  });
  // The query's latest state for the activation handler (read on a tap, never a render dependency).
  const live = useRef(bookings);
  useEffect(() => {
    live.current = bookings;
  });
  /** The latest activation: an earlier one still reading pages gives up when another lands. */
  const tap = useRef(0);
  /** The band being looked up (busy mark), null when no lookup runs. */
  const [busy, setBusy] = useState<BookedCell | null>(null);

  const { bookingId, open, close } = useBookingDetailParam();
  const [seed, setSeed] = useState<BookingDTO | null>(null);
  const actions = useOperatorBookingActions({ lakeId, lakeName: lake.name });

  const miss = useCallback(() => toast('Nu am găsit rezervarea — deschide Rezervări.', 'danger'), [toast]);
  /** The lookup ended without a booking: the band stops being busy and the toast says so. */
  const giveUp = useCallback(() => {
    setBusy(null);
    miss();
  }, [miss]);

  const qc = useQueryClient();
  const listOptions = useMemo(() => lakeBookingsInfiniteQuery(t, lakeId, 'all'), [t, lakeId]);

  const onBookedCell = useCallback(
    async (cell: BookedCell) => {
      const id = ++tap.current;
      setBusy(cell);
      // The list's first page: in hand, or awaited (the in-flight read is joined, never restarted) —
      // never an empty list read as «not found».
      let data: LakeBookingsData;
      try {
        data = live.current.data ?? (await qc.ensureInfiniteQueryData(listOptions));
      } catch {
        if (id === tap.current) giveUp();
        return;
      }
      for (let extra = 0; ; extra++) {
        if (id !== tap.current) return;
        const rows = data.pages.flatMap((p) => p.data);
        const hit = findBookingForCell(rows, cell);
        const last = data.pages[data.pages.length - 1];
        // The query's own rule (lakeBookingsInfiniteQuery getNextPageParam): a full page has a next one.
        const more = !!last && last.data.length >= last.pageSize;
        const canRead = extra < MAX_EXTRA_PAGES && more && mayBeOnLaterPage(rows, cell);
        // A cancelled / rejected row is only a fallback: the band is drawn for a live one, read on for it.
        if (hit && (holdsStand(hit) || !canRead)) {
          setBusy(null);
          setSeed(hit);
          open(hit.documentId);
          return;
        }
        if (!canRead) return giveUp();
        const r = await live.current.fetchNextPage();
        if (id !== tap.current) return;
        if (!r.data || r.isError) return giveUp();
        data = r.data;
      }
    },
    [qc, listOptions, open, giveUp]
  );

  const onClose = useCallback(() => {
    setSeed(null);
    close();
  }, [close]);

  // The open booking's band: its stand and bounds, from the seed, a loaded row, or the detail's own
  // read (a reload by id: the dialog fetches it — this only reads that cache entry, never a request).
  const detailRead = useQuery({ ...bookingQuery(t, bookingId ?? ''), enabled: false });
  const openRow = useMemo(() => {
    if (!bookingId) return null;
    if (seed?.documentId === bookingId) return seed;
    if (detailRead.data?.documentId === bookingId) return detailRead.data;
    for (const p of bookings.data?.pages ?? []) for (const b of p.data) if (b.documentId === bookingId) return b;
    return null;
  }, [bookingId, seed, detailRead.data, bookings.data]);
  const mark = useMemo<GridMark | null>(() => {
    if (busy) return { stand: busy.standDocumentId, startISO: busy.startISO, endISO: busy.endISO, kind: 'busy' };
    const standId = openRow?.stand?.documentId;
    return openRow && standId ? { stand: standId, startISO: openRow.startDate, endISO: openRow.endDate, kind: 'open' } : null;
  }, [busy, openRow]);

  const docked = useBreakpoint() === 'desktop';
  const title = lake.name || config.titleFallback;

  const err = bookings.error;
  if (!bookings.data && isApiError(err) && (err.status === 401 || err.status === 403)) {
    return (
      <BookingFrame title={title} eyebrow={config.eyebrow} back={{ href: routes.operator(lakeId), label: 'Înapoi' }}>
        <OperatorErrorState
          error={err}
          next={next}
          focusOnMount
          onRetry={() => void bookings.refetch()}
          retrying={bookings.isFetching}
          attempt={bookings.errorUpdateCount}
        />
      </BookingFrame>
    );
  }

  const detail = (
    <BookingDetailDialog
      lakeId={lakeId}
      lakeName={lake.name}
      bookingId={bookingId}
      seed={seed}
      onClose={onClose}
      actions={actions}
      intent="context"
      panelClassName="h-full w-full overflow-hidden rounded-card"
    />
  );

  return (
    <BookingGridScreen lake={lake} config={config} onBookedCell={onBookedCell} mark={mark} detail={docked && bookingId ? detail : undefined}>
      {docked ? null : detail}
      {actions.dialogs}
    </BookingGridScreen>
  );
}
