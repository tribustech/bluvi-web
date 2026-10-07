import type { ReactNode } from 'react';
import { DetailBackButton, DetailBand, DetailHeader, DetailPage } from '@/components/templates/T3';
import { SUMMARY_TRACKS } from '@/components/templates/T3/DetailBody';
import { cn } from '@/components/ui/cn';
import { routes } from '@/lib/routes';

/*
 * The booking page's frame (T3 without the tab bar, owner rule 1): the white band with the header
 * («Rezervare», back on the phone; the breadcrumb band from 768 is the shell's), then the body —
 * one column below 1024, from 1024 the content on the left and the sticky action card on the right
 * (the summary layout's tracks: 360, 400 from 1440). From 1280 the left column is itself two
 * columns of cards — the booking card and «Cum s-a calculat» in the first, «Parcursul cererii» and
 * «Mesajul tău» in the second, each a stack of its own (no hole under a shorter card) — so no card
 * is stretched across the whole column (rule 16: ~600px at 1920, never 1100+).
 */

export const BODY = cn(
  'flex flex-1 flex-col gap-4 px-4 pt-4 pb-8 md:px-6 md:pt-6 md:pb-12 xl:px-8 xl:pt-8',
  SUMMARY_TRACKS,
  'min-[1024px]:items-start',
);

/** The left column: one stack below 1280; from 1280 two tracks, each a MAIN_COL stack. */
export const MAIN = 'flex min-w-0 flex-col gap-4 xl:grid xl:grid-cols-2 xl:items-start xl:gap-5';

/**
 * One track of MAIN. Below 1280 it is `display: contents` (its cards join MAIN's single stack, in
 * DOM order — the phone's order); from 1280 a column stack of its own.
 */
export const MAIN_COL = 'contents xl:flex xl:min-w-0 xl:flex-col xl:gap-5';

/** The right column (from 1024): sticky under the top bar + 24. */
export const ASIDE = 'flex min-w-0 flex-col gap-4 max-[1024px]:hidden min-[1024px]:sticky min-[1024px]:self-start min-[1024px]:top-[calc(--spacing(22)_+_var(--shell-banner-h,0px))]';

export function BookingFrame({ meta, children }: { meta?: ReactNode[]; children: ReactNode }) {
  return (
    <DetailPage>
      <DetailBand>
        <DetailHeader
          title="Rezervare"
          meta={meta}
          phoneStart={<DetailBackButton fallbackHref={routes.myBookings()} label="Înapoi la rezervări" />}
          className="max-md:items-center"
        />
      </DetailBand>
      {children}
    </DetailPage>
  );
}

const BONE = 'animate-shimmer';

function Line({ className }: { className: string }) {
  return (
    <span aria-hidden className={cn('relative block max-w-full', className)}>
      &nbsp;
      <span className={cn('absolute inset-x-0 top-1/2 h-[0.62em] -translate-y-1/2 rounded-full', BONE)} />
    </span>
  );
}

function CardBone({ lines = 3, testId }: { lines?: number; testId?: string }) {
  return (
    <span data-testid={testId} className="flex flex-col gap-3 rounded-card bg-surface p-4 shadow-e1 md:p-5 xl:p-6">
      <Line className="w-36 t-heading" />
      {Array.from({ length: lines }, (_, i) => (
        <Line key={i} className={cn('t-body', ['w-full', 'w-[80%]', 'w-[60%]', 'w-[70%]'][i % 4])} />
      ))}
    </span>
  );
}

/**
 * Loading (c1): the page's own shape in grey — the header, the booking card, two cards, and the
 * action card from 1024 — so nothing moves when the booking lands. Also the route's Suspense
 * fallback while the session gate runs.
 */
export function BookingDetailSkeleton() {
  return (
    <div aria-busy="true" data-testid="booking-skeleton">
      <p role="status" className="sr-only">
        Se încarcă rezervarea…
      </p>
      <BookingFrame meta={[<Line key="m" className="w-32 t-caption" />]}>
        <div aria-hidden className={BODY}>
          <div className={MAIN}>
            <span className={MAIN_COL}>
              {/* The booking card: thumb, name + price, stand, period, pill. */}
              <span className="flex gap-3 rounded-card bg-surface p-4 shadow-e1">
                <span className={cn('size-10 shrink-0 rounded-avatar md:size-12', BONE)} />
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <Line className="w-[55%] t-body-strong" />
                  <Line className="w-20 t-caption" />
                  <Line className="w-[80%] t-caption" />
                  <Line className="w-24 t-caption" />
                </span>
              </span>
              <CardBone lines={3} />
            </span>
            <span className={MAIN_COL}>
              <CardBone lines={4} />
            </span>
          </div>
          <div className={ASIDE}>
            <span className="flex flex-col gap-4 rounded-card bg-surface p-6 shadow-e2">
              <Line className="w-28 t-num-40" />
              <Line className="w-[60%] t-body" />
              <span className={cn('h-12 rounded-control xl:h-10', BONE)} />
              <span className={cn('h-12 rounded-control xl:h-10', BONE)} />
            </span>
          </div>
        </div>
      </BookingFrame>
    </div>
  );
}
