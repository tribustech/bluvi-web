import type { ReactNode } from 'react';
import { UNDER_BAR_TOP } from '@/components/nav/shell';
import { AsideSkeleton, ListHeader, ListPage, listGridClass, TabsSkeleton, type ListBack } from '@/components/templates/T1';
import { cn } from '@/components/ui/cn';
import { routes } from '@/lib/routes';

export const TITLE = 'Rezervările mele';
export const PANEL_ID = 'rezervari-lista';

/**
 * The pinned chrome (booking.rezervarile-mele.c1, owner rule 3): the title row scrolls away, the tab
 * row and the sub-filter chips stay pinned under the top bar — and follow it to the top edge when the
 * phone bar slides away (UNDER_BAR_TOP, the bar's own timing), so the band never floats. Full bleed
 * on the page ground, at every width (the same list behaves the same).
 */
export const CHROME = cn('sticky z-sticky -mx-4 mt-3 bg-page px-4 md:-mx-6 md:px-6 xl:-mx-8 xl:mt-4 xl:px-8', UNDER_BAR_TOP);

/** The cards: one column on the phone, auto-filling ≥ 340px columns from 768 (two at 1280–1440, three at 1920). */
export const GRID = listGridClass('lg');

/**
 * T1 frame: the title row, the pinned chrome, then the list with the right column docked from 1280
 * (the review prompt and the way to a lake: T1 ListAside). Below 1280 the screen places the prompt
 * itself, above the list (fish ListHeaderComponent), so `asideInline` is off.
 */
export function MyBookingsFrame({
  back = { href: routes.home(), label: 'Înapoi' },
  actions,
  chrome,
  aside,
  asideBusy = false,
  children,
}: {
  /** History back (else Acasă) in the screen; a plain link to Acasă in the server skeleton. */
  back?: ListBack;
  actions?: ReactNode;
  chrome: ReactNode;
  aside?: ReactNode;
  asideBusy?: boolean;
  children: ReactNode;
}) {
  return (
    <ListPage
      header={
        <>
          <ListHeader title={TITLE} back={back} actions={actions} />
          {chrome}
        </>
      }
      aside={aside}
      asideLabel="Pentru tine"
      asideInline={false}
      asideBusy={asideBusy}
    >
      {children}
    </ListPage>
  );
}

/** First load of a tab (c7): three cards in the shape of the real ones, under the chrome. */
export function BookingCardsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div role="status" data-testid="bookings-skeleton">
      <span className="sr-only">Se încarcă rezervările…</span>
      <ul aria-hidden className={GRID}>
        {Array.from({ length: count }, (_, i) => (
          <li key={i} className="flex flex-col gap-3 rounded-card bg-surface p-4 shadow-e1">
            <div className="flex items-start gap-3">
              <span className="size-10 shrink-0 animate-shimmer rounded-avatar md:size-12" />
              <span className="flex flex-1 flex-col gap-2 pt-0.5">
                <span className="flex justify-between gap-3">
                  <span className="h-3.5 w-[55%] rounded-full bg-soft-fill" />
                  <span className="h-3.5 w-12 rounded-full bg-soft-fill" />
                </span>
                <span className="flex justify-between gap-3">
                  <span className="h-3 w-20 rounded-full bg-soft-fill" />
                  <span className="h-6.5 w-22 animate-shimmer rounded-full" />
                </span>
                <span className="h-3 w-[75%] rounded-full bg-soft-fill" />
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The route's skeleton (the page's Suspense fallback and loading.tsx): the frame before the gate answers. */
export function MyBookingsSkeleton() {
  return (
    <MyBookingsFrame
      chrome={
        <div className={CHROME}>
          <TabsSkeleton count={4} />
        </div>
      }
      aside={<AsideSkeleton rows={1} />}
      asideBusy
    >
      <BookingCardsSkeleton />
    </MyBookingsFrame>
  );
}
