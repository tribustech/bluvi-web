'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { EmptyState, ErrorState } from '@/components/surfaces/StateCard';
import { ResponsiveSurface } from '@/components/surfaces/ResponsiveSurface';
import type { SurfaceIntent } from '@/components/surfaces/rule';
import { Button } from '@/components/ui/Button';
import { bookingKeys, bookingQuery, type BookingDTO } from '@/core/booking';
import { isApiError } from '@/core/transport';
import { createBrowserTransport } from '@/lib/client/transport';
import type { OperatorBookingActions } from '../actions/useOperatorBookingActions';
import { BookingDetailActions, BookingDetailBody } from './BookingDetailBody';
import { BookingDetailSkeleton } from './BookingDetailSkeleton';
import { bookingDetailModel, isBookingOfLake, rateAnglerHref } from './model';

type Props = {
  lakeId: string;
  lakeName?: string | null;
  /** The open booking (?rezervare=, useBookingDetailParam); null = closed. */
  bookingId: string | null;
  /**
   * The row's booking when opened from the inbox or the calendar grid (c2): painted at once and
   * revalidated. Ignored unless it is the booking asked for.
   */
  seed?: BookingDTO | null;
  onClose: () => void;
  /** The page's useOperatorBookingActions (operator.actiuni-rezervare): the same dialogs as the list. */
  actions: Pick<OperatorBookingActions, 'actingId' | 'accept' | 'reject' | 'cancel'>;
  /**
   * `info` (default): a dialog from 768 — the panel. `context`: at ≥1280 a docked SidePanel (the
   * page renders this component in its panel column, next to the list or the grid) — the inbox and
   * the calendar, where the operator compares neighbouring bookings and stands (rule.ts). The page
   * owning the column passes it; below 1280 both are the same sheet / dialog.
   */
  intent?: Extract<SurfaceIntent, 'info' | 'context'>;
  /** Classes for the docked panel (intent `context` at ≥1280). */
  panelClassName?: string;
};

/** The read failed for good on a 4xx: deleted, a foreign id, not this owner's (403/404). */
const isGone = (e: unknown) => isApiError(e) && e.status >= 400 && e.status < 500;

/**
 * operator.detaliu-rezervare — fish features/operator/OperatorBookingSheet.tsx + BookingDetailSheet.tsx.
 * One detail for the panel («Azi la baltă»), the inbox and the calendar, so the three never disagree.
 * A sheet on the phone, a dialog from 768 (modal: Esc, the backdrop and the X close it, focus stays
 * inside). Opened on an id it fetches GET /feed/bookings/{id} behind a skeleton (c1); opened with the
 * row's booking it paints that at once and revalidates (c2). A booking that is gone, foreign or of
 * another lake (a shared or reloaded ?rezervare= link) settles on «Rezervarea nu mai există…»; a
 * 5xx / network failure on the inline error with a retry — never an endless skeleton (c14). Everything it can do goes through the
 * page's actions hook, so accepting here asks the same confirmation as in the list (c11).
 */
export function BookingDetailDialog({ lakeId, lakeName, bookingId, seed, onClose, actions, intent = 'info', panelClassName }: Props) {
  const router = useRouter();
  const qc = useQueryClient();
  // Per-owner data: always through the proxy with the session cookie, never the CDN.
  const t = useMemo(() => createBrowserTransport({ direct: false }), []);

  // c2 — fish seeds the detail cache from the row before the sheet opens. Seeded here, before the
  // query below subscribes, and marked stale (updatedAt 0) so that subscription revalidates it at
  // once. Once per open: a later render must not overwrite what the revalidation brought.
  const [seededFor, setSeededFor] = useState<string | null>(null);
  if (!bookingId && seededFor) setSeededFor(null);
  else if (bookingId && seed && seed.documentId === bookingId && seededFor !== bookingId) {
    setSeededFor(bookingId);
    qc.setQueryData(bookingKeys.detail(bookingId), seed, { updatedAt: 0 });
  }

  // The clock the action gates read («has the stay ended?»), taken when this booking is opened — the
  // dialog stays mounted while closed, so a mount-time clock would be hours old on a dashboard left
  // open overnight (fish reads Date.now() at render). Reset in the same render-time branch style as
  // seededFor; never read while closed (no clock in a prerender).
  const [opened, setOpened] = useState<{ id: string; at: number } | null>(null);
  if (!bookingId && opened) setOpened(null);
  // Read once per open and kept in state, so re-renders stay stable (what the purity rule guards).
  // eslint-disable-next-line react-hooks/purity
  else if (bookingId && opened?.id !== bookingId) setOpened({ id: bookingId, at: Date.now() });

  const { data, dataUpdatedAt, error, isError, isFetching, refetch } = useQuery(bookingQuery(t, bookingId ?? ''));
  const nowMs = Math.max(opened?.id === bookingId ? opened.at : 0, dataUpdatedAt);
  // c1 — the booking shown must be the one asked for (never one fetched for a previous id); c14 —
  // and it must be this lake's (the endpoint also answers the angler and any other owned lake).
  const booking = isBookingOfLake(data, bookingId, lakeId) ? data : null;
  const forThisId = !!data && data.documentId === bookingId;
  // c14 — settled with nothing to show for this page: a 4xx, or a booking that is not this lake's.
  const gone = !booking && ((isError && isGone(error)) || forThisId);
  // c14 — a 5xx / network failure with nothing to show: the inline error with a retry.
  const failed = !booking && !gone && isError;
  const model = useMemo(() => (booking ? bookingDetailModel(booking, nowMs) : null), [booking, nowMs]);

  /** Close, then leave (the profile, the rate screen): Back returns to the page without the dialog. */
  const leaveTo = (href: string) => {
    onClose();
    router.push(href);
  };

  // No phone and nothing to do: no footer at all (an empty pinned bar would be a dead hairline).
  const footer =
    booking && model && (model.phone || model.actions !== 'none') ? (
      <BookingDetailActions
        booking={booking}
        model={model}
        lakeId={lakeId}
        lakeName={lakeName}
        acting={actions.actingId === booking.documentId}
        onAccept={() => {
          // fish: the detail is dismissed and the accept confirmation presented in its place.
          onClose();
          actions.accept(booking);
        }}
        onReject={() => actions.reject(booking)}
        onCancel={() => actions.cancel(booking)}
        onRate={() => leaveTo(rateAnglerHref(booking))}
      />
    ) : null;

  return (
    <ResponsiveSurface
      open={!!bookingId}
      onClose={onClose}
      intent={intent}
      panelClassName={panelClassName}
      title="Detalii rezervare"
      sheetSnap={0.9}
      pinnedActions
      actions={footer}
    >
      {booking && model ? (
        <BookingDetailBody key={booking.documentId} booking={booking} model={model} onNavigate={leaveTo} />
      ) : gone ? (
        <div data-testid="booking-detail-gone" className="flex flex-col gap-3">
          <EmptyState title="Rezervarea nu mai există sau nu e a acestei bălți." />
          <Button variant="secondary" onClick={onClose}>
            Închide
          </Button>
        </div>
      ) : failed ? (
        <ErrorState
          title="Nu am putut încărca rezervarea."
          description="Verifică conexiunea și încearcă din nou."
          action={
            <Button
              variant="secondary"
              size="compact"
              aria-disabled={isFetching || undefined}
              aria-busy={isFetching || undefined}
              onClick={() => {
                if (!isFetching) void refetch();
              }}
            >
              {isFetching ? 'Se încarcă…' : 'Încearcă din nou'}
            </Button>
          }
        />
      ) : bookingId ? (
        <BookingDetailSkeleton />
      ) : null}
    </ResponsiveSurface>
  );
}
