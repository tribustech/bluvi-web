import { FlowHeaderSkeleton, FlowLayout, FlowLoadingStatus } from '@/components/templates/T6';
import { cn } from '@/components/ui/cn';
import { STAND_TILE_HEIGHT, STAND_TRACK } from '../../../_organizer/standGrid';

/*
 * The penalties' «Alege standul» while it loads: the search field, two sectors and their tiles in
 * grey on StandOccupantList's own grid (same track, same tile height), so nothing moves when the data
 * lands. Server-safe (no client hooks): loading.tsx and the page's Suspense draw it too.
 */

const BAR = 'inline-block max-w-full rounded-full bg-soft-fill animate-shimmer align-middle';

export function PenaltyStandBodySkeleton({ label = 'Se încarcă standurile…' }: { label?: string }) {
  return (
    <>
      <FlowLoadingStatus label={label} />
      <div aria-hidden className="flex flex-col gap-2 md:flex-row md:items-start">
        <span className="block h-12 w-full min-w-0 rounded-control bg-soft-fill animate-shimmer md:max-w-120 md:flex-1 xl:h-10" />
      </div>
      <div aria-hidden data-testid="penalty-stand-skeleton" className={cn('flex flex-col gap-6 md:grid md:gap-x-3 xl:gap-y-8', STAND_TRACK)}>
        {Array.from({ length: 2 }, (_, s) => (
          <div key={s} className="flex flex-col gap-3 md:col-span-full">
            <div className="flex items-center gap-2">
              <span className="size-2.5 shrink-0 rounded-full bg-soft-fill animate-shimmer" />
              <p className="t-title2">
                <span className={cn(BAR, 'h-4 w-24')} />
              </p>
              <p className="t-caption ml-auto">
                <span className={cn(BAR, 'h-2.5 w-20')} />
              </p>
            </div>
            <div className={cn('grid grid-cols-1 gap-2 md:gap-3', STAND_TRACK)}>
              {Array.from({ length: 6 }, (_, i) => (
                <span key={i} className={cn('block rounded-card bg-soft-fill animate-shimmer', STAND_TILE_HEIGHT)} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/** The whole page while the session is read on the server (page Suspense / loading.tsx). */
export function PenaltyStandSkeleton() {
  return (
    <FlowLayout header={<FlowHeaderSkeleton title="Alege standul" id="penalizare-stand-titlu" trailing={false} />} busy labelledBy="penalizare-stand-titlu">
      <PenaltyStandBodySkeleton label="Se încarcă…" />
    </FlowLayout>
  );
}
