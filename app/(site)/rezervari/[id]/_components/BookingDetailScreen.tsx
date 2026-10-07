'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BookingRow, bookingCardModel, CancelBookingDialog } from '@/components/booking';
import { useNowTick } from '@/components/account/angler/SessionHistoryCard';
import { DetailActionBar, DetailBackButton, DetailError } from '@/components/templates/T3';
import { DetailStickyAside } from '@/components/templates/T3/DetailStickyAside';
import { Button } from '@/components/ui/Button';
import { bookingQuery, type BookingDTO } from '@/core/booking';
import { myLakeReviewQuery } from '@/core/lakes';
import { isApiError } from '@/core/transport';
import { createBrowserTransport } from '@/lib/client/transport';
import { routes } from '@/lib/routes';
import { ActionsCard, bookingActionButtons } from './ActionsCard';
import { ASIDE, BODY, BookingDetailSkeleton, BookingFrame, MAIN, MAIN_COL } from './frame';
import { MessageCard } from './MessageCard';
import { bookingDetailModel } from './model';
import { PriceBreakdownCard } from './PriceBreakdownCard';
import { RebookCard } from './RebookCard';
import { RequestTimeline } from './RequestTimeline';

/**
 * /rezervari/[id] — booking.rezervare (T3 without tabs), fish app/(app)/bookings/[id].tsx. Rendered
 * only for a signed-in viewer (the page's requireViewer gate); the booking is per user, read in the
 * browser through /api/cms (core bookingQuery, GET /feed/bookings/{id}: the angler's own, or a lake
 * owner's).
 *
 *  - c1 «Rezervare» with back; loading → the page's skeleton; any failure (network, 5xx, 404, 403 —
 *    not this account's) → the error card with «Încearcă din nou» (fish ErrorScreen + refetch).
 *  - c2 the list's card, inert, with the full dead reason and the pending warning.
 *  - c3–c5 the actions: the phone's bottom bar below 1024, the sticky action card from 1024.
 *  - c6–c9 the cancel dialog (components/booking/CancelBookingDialog): success → «Rezervare anulată»
 *    and back (to /rezervari when the page was opened directly — a notification link).
 *  - c10 rebook, c11 «Cum s-a calculat», c12 «Parcursul cererii», c13 «Mesajul tău».
 */
export function BookingDetailScreen({ id, viewerId }: { id: string; viewerId: string }) {
  const t = useMemo(() => createBrowserTransport(), []);
  const q = useQuery(bookingQuery(t, id));
  const now = useNowTick();

  if (q.isPending || now === null) return <BookingDetailSkeleton />;
  if (q.isError || !q.data) return <LoadError error={q.error} onRetry={() => void q.refetch()} />;
  return <Loaded booking={q.data} nowMs={now} viewerId={viewerId} />;
}

/** fish's back after a cancel; a page opened directly (a notification) has nothing behind it: /rezervari. */
function useBackOrBookings() {
  const router = useRouter();
  return useCallback(() => {
    const nav = (window as unknown as { navigation?: { canGoBack?: boolean } }).navigation;
    let inSite = false;
    if (nav && typeof nav.canGoBack === 'boolean') inSite = nav.canGoBack;
    else {
      try {
        inSite = Boolean(document.referrer) && new URL(document.referrer).origin === window.location.origin;
      } catch {
        inSite = false;
      }
    }
    if (inSite) router.back();
    else router.replace(routes.myBookings());
  }, [router]);
}

function Loaded({ booking, nowMs, viewerId }: { booking: BookingDTO; nowMs: number; viewerId: string }) {
  const t = useMemo(() => createBrowserTransport(), []);
  const m = bookingDetailModel(booking, nowMs);
  // The booking card's own «dead» flag (cancelled, rejected, no-show): the action card recedes with it.
  const quiet = bookingCardModel(booking, nowMs).quiet;
  const lakeId = booking.lake?.documentId ?? '';
  // c3 — read only when the stay could be reviewed; offered only once the read SETTLED with no review
  // (rule 4: a loading or failed read shows nothing).
  const review = useQuery({ ...myLakeReviewQuery(t, lakeId, viewerId), enabled: m.reviewable && !!lakeId });
  const canReview = m.reviewable && review.isSuccess && !review.data;

  const back = useBackOrBookings();
  const [cancelOpen, setCancelOpen] = useState(false);
  // The button that opened the dialog (the bar's or the card's): the focus goes back to it.
  const [trigger, setTrigger] = useState<HTMLElement | null>(null);
  const openCancel = useCallback((el: HTMLElement) => {
    setTrigger(el);
    setCancelOpen(true);
  }, []);
  const closeCancel = useCallback(() => {
    setCancelOpen(false);
    // The dialog unmounts on close (no native focus return): give the focus back by hand.
    requestAnimationFrame(() => {
      if (trigger?.isConnected) trigger.focus();
    });
  }, [trigger]);

  const phoneButtons = bookingActionButtons({ booking, model: m, canReview, onCancel: openCancel });
  const lake = booking.lake;

  return (
    <BookingFrame
      meta={
        lake
          ? [
              <Link key="lake" href={routes.lake(lake.documentId)} className="text-ink-2 underline-offset-2 hover:underline">
                {lake.name}
              </Link>,
              lake.locality ? <span key="loc">{lake.locality}</span> : null,
            ]
          : undefined
      }
    >
      <div className={BODY} data-testid="booking-detail">
        <div className={MAIN}>
          {/* Track 1 from 1280: the booking card, then «Cum s-a calculat». */}
          <div className={MAIN_COL}>
            <BookingRow
              booking={booking}
              nowMs={nowMs}
              clampReason={false}
              actions={
                // c5 below 1024 (fish: inside the card, under the buttons); from 1024 the action card says it.
                m.noticeLine ? <p className="t-caption text-muted min-[1024px]:hidden">{m.noticeLine}</p> : null
              }
            />
            {m.rebook ? (
              <RebookCard lakeId={m.rebook.lakeId} lakeName={m.rebook.lakeName} bookingId={booking.documentId} className="min-[1024px]:hidden" />
            ) : null}
            {m.basis ? <PriceBreakdownCard basis={m.basis} total={booking.priceTotal} /> : null}
          </div>
          {/* Track 2 from 1280: «Parcursul cererii», then «Mesajul tău». */}
          <div className={MAIN_COL}>
            <RequestTimeline steps={m.timeline} />
            {m.note ? <MessageCard note={m.note} /> : null}
          </div>
        </div>
        <DetailStickyAside label="Acțiuni rezervare" offsetSteps={0} className={ASIDE}>
          <ActionsCard booking={booking} model={m} quiet={quiet} canReview={canReview} onCancel={openCancel} />
        </DetailStickyAside>
      </div>
      {phoneButtons ? (
        <DetailActionBar label="Acțiuni rezervare" hideFrom="summary">
          {phoneButtons}
        </DetailActionBar>
      ) : null}
      <CancelBookingDialog booking={booking} open={cancelOpen} onClose={closeCancel} onCancelled={back} />
    </BookingFrame>
  );
}

/**
 * c1 — fish ErrorScreen + refetch: the page's frame with the error card. A booking that is not there
 * or not this account's (404 / 403) says so; anything else is a failed read. «Încearcă din nou»
 * reads again — with no booking yet, that is the loading state (the skeleton), as fish's isLoading.
 */
function LoadError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const missing = isApiError(error) && (error.status === 404 || error.status === 403);
  return (
    <div data-testid="booking-error">
      <DetailError
        heading={missing ? 'Rezervarea nu a fost găsită' : 'Rezervarea nu a putut fi încărcată'}
        description={missing ? 'Nu am găsit această rezervare în contul tău.' : 'Verifică conexiunea și încearcă din nou.'}
        back={<DetailBackButton fallbackHref={routes.myBookings()} ground="page" label="Înapoi la rezervări" />}
        action={
          <>
            <Button variant="secondary" onClick={onRetry}>
              Încearcă din nou
            </Button>
            <Link href={routes.myBookings()} className="t-body-strong text-accent-ink underline-offset-2 hover:underline">
              Rezervările mele
            </Link>
          </>
        }
      />
    </div>
  );
}
