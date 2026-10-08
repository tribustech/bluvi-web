import { TabsSkeleton } from '@/components/templates/T1';
import { cn } from '@/components/ui/cn';
import { routes } from '@/lib/routes';
import { OperatorFrame, OperatorTitleSkeleton, operatorTrail } from '../../../_shared/OperatorFrame';
import { FallbackSubRow } from './FallbackSubRow';
import { CHROME, LIST_CONTAINER, LIST_ITEMS, LIST_SURFACE, ROW_BOX } from './layout';

/** fish ScreenHeader title (bookings.tsx:355). */
export const INBOX_TITLE = 'Administrare rezervări';

/** The tab panel's id: the bucket tabs control it (ARIA tablist). */
export const PANEL_ID = 'rezervari-operator';

/**
 * c9 — an uncached tab's first load: three rows in the shape of the real ones (fish
 * BookingListSkeleton), under the chrome — never the previous tab's rows. The same container rules
 * as the list, so cards on the phone and table rows from 768 of list width.
 */
export function InboxSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div role="status" data-testid="inbox-skeleton" className={LIST_CONTAINER}>
      <span className="sr-only">Se încarcă rezervările…</span>
      <div aria-hidden className={LIST_SURFACE}>
        <ul className={LIST_ITEMS}>
          {Array.from({ length: count }, (_, i) => (
            <li
              key={i}
              className={cn('flex items-start gap-3 rounded-card bg-surface shadow-e1 @3xl:items-center @3xl:rounded-none @3xl:shadow-none', ROW_BOX)}
            >
              <span className="size-10 shrink-0 animate-shimmer rounded-full" />
              <span className="flex min-w-0 flex-1 flex-col gap-2 pt-0.5 @3xl:flex-row @3xl:items-center @3xl:gap-6 @3xl:pt-0">
                <span className="h-3.5 w-[55%] rounded-full bg-soft-fill @3xl:w-40" />
                <span className="h-3 w-24 rounded-full bg-soft-fill" />
                <span className="h-3 w-[75%] rounded-full bg-soft-fill @3xl:w-56" />
              </span>
              <span className="flex shrink-0 flex-col items-end gap-2">
                <span className="h-3.5 w-14 rounded-full bg-soft-fill" />
                <span className="h-6.5 w-20 animate-shimmer rounded-full" />
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/**
 * The route's first paint (the gate's Suspense fallback and loading.tsx): the real title over the
 * lake caption's bone, the tab row's bones, the chip row's (./FallbackSubRow — or its 12px breath
 * for the chip-less buckets) and the list skeleton, so nothing at the top moves when the screen lands. The lake is
 * not known here (no read on the server): Back goes to the picker, which replaces itself with the
 * single lake's panel.
 */
export function InboxFallback() {
  return (
    <OperatorFrame
      title={INBOX_TITLE}
      caption={<OperatorTitleSkeleton className="h-3 w-28" />}
      back={{ fallbackHref: routes.operator() }}
      trail={operatorTrail({ label: 'Rezervări' })}
    >
      <div className={CHROME}>
        <TabsSkeleton count={4} />
        <FallbackSubRow />
      </div>
      <InboxSkeleton />
    </OperatorFrame>
  );
}
