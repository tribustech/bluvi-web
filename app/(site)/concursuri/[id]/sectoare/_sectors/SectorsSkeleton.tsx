import { FlowAsideSkeleton, FlowHeaderSkeleton, FlowLayout, FlowLoadingStatus } from '@/components/templates/T6';
import { cn } from '@/components/ui/cn';
import { SECTOR_CARD, SECTOR_COLUMNS, SLOT_BOX, SLOT_TRACK } from './layout';

/*
 * organizer.sectors c1, loading: the header with the real title, the info lines and four sectors of
 * slots in grey, announced once — the loaded page's boxes (SlotGrid's columns, slot track and slot
 * height), so nothing moves when the data lands. From 1280 the aside's card.
 */

export const SECTORS_TITLE = 'Alocarea standurilor pe sectoare';
export const SECTORS_TITLE_ID = 'sectoare-titlu';

const BAR = 'inline-block max-w-full rounded-full bg-soft-fill animate-shimmer align-middle';

export function SectorsBodySkeleton({ label = 'Se încarcă sectoarele…' }: { label?: string }) {
  return (
    <>
      <FlowLoadingStatus label={label} />
      <div aria-hidden className="flex flex-col gap-1 md:flex-row md:gap-6">
        <p className="t-body">
          <span className={cn(BAR, 'h-3 w-28')} />
        </p>
        <p className="t-body">
          <span className={cn(BAR, 'h-3 w-52')} />
        </p>
      </div>
      <div aria-hidden data-testid="sectors-skeleton" className={SECTOR_COLUMNS}>
        {Array.from({ length: 4 }, (_, s) => (
          <div key={s} className={SECTOR_CARD}>
            <span className="-mx-3 hidden h-1 bg-soft-fill md:block" />
            <div className="flex items-center gap-2">
              <span className="size-2.5 shrink-0 rounded-full bg-soft-fill animate-shimmer md:hidden" />
              <p className="t-title2 md:t-heading">
                <span className={cn(BAR, 'h-4 w-20')} />
              </p>
            </div>
            <div className={SLOT_TRACK}>
              {Array.from({ length: 5 }, (_, i) => (
                <span key={i} className={cn('block rounded-control bg-soft-fill animate-shimmer', SLOT_BOX)} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/** The whole page while the session is read on the server (page Suspense / loading.tsx). */
export function SectorsSkeleton() {
  return (
    <FlowLayout
      header={<FlowHeaderSkeleton title={SECTORS_TITLE} id={SECTORS_TITLE_ID} trailing={false} />}
      busy
      labelledBy={SECTORS_TITLE_ID}
      aside={<FlowAsideSkeleton />}
      asideMobile="hidden"
    >
      <SectorsBodySkeleton label="Se încarcă…" />
    </FlowLayout>
  );
}
