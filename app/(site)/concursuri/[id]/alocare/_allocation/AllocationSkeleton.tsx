import { FlowAsideSkeleton, FlowHeaderSkeleton, FlowLayout, FlowLoadingStatus } from '@/components/templates/T6';
import { cn } from '@/components/ui/cn';
import { ALLOCATION_TITLE_ID } from './model';
import { ROW_BOX, ROW_LIST, SECTOR_CARD, SECTOR_COLUMNS } from './layout';

/*
 * organizer.participants c1, loading: the header with the real title, then four sectors of stand rows
 * in grey (the loaded page's columns, rows and row height, so nothing moves when the data lands),
 * announced once. From 1280 the aside's card.
 */

const BAR = 'inline-block max-w-full rounded-full bg-soft-fill animate-shimmer align-middle';

export function AllocationBodySkeleton({ label = 'Se încarcă standurile…' }: { label?: string }) {
  return (
    <>
      <FlowLoadingStatus label={label} />
      <div aria-hidden data-testid="alloc-skeleton" className={SECTOR_COLUMNS}>
        {Array.from({ length: 4 }, (_, s) => (
          <div key={s} className={SECTOR_CARD}>
            <span className="-mx-3 hidden h-1 bg-soft-fill md:block" />
            <div className="flex items-center gap-2">
              <span className="size-2.5 shrink-0 rounded-full bg-soft-fill animate-shimmer md:hidden" />
              <p className="t-title2 md:t-heading">
                <span className={cn(BAR, 'h-4 w-20')} />
              </p>
            </div>
            <div className={ROW_LIST}>
              {Array.from({ length: 4 }, (_, i) => (
                <span key={i} className={cn('flex items-center gap-3 rounded-control bg-soft-fill/60 px-3', ROW_BOX)}>
                  <span className="size-10 shrink-0 rounded-full bg-soft-fill animate-shimmer" />
                  <span className="flex flex-1 flex-col gap-1.5">
                    <span className={cn(BAR, 'h-3.5 w-16')} />
                    <span className={cn(BAR, 'h-2.5 w-32')} />
                  </span>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/** The whole page while the session is read (page Suspense / loading.tsx); `title` unknown → a grey bar. */
export function AllocationSkeleton({ title }: { title?: string }) {
  return (
    <FlowLayout
      header={<FlowHeaderSkeleton title={title} id={ALLOCATION_TITLE_ID} trailing={false} />}
      busy
      labelledBy={ALLOCATION_TITLE_ID}
      aside={<FlowAsideSkeleton />}
      asideMobile="hidden"
    >
      <AllocationBodySkeleton label="Se încarcă…" />
    </FlowLayout>
  );
}
