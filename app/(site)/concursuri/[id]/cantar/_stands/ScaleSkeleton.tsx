import { FlowAsideSkeleton, FlowHeaderSkeleton, FlowLayout, FlowLoadingStatus } from '@/components/templates/T6';
import { cn } from '@/components/ui/cn';
import { STAND_TILE_HEIGHT, STAND_TRACK } from '../../_organizer/standGrid';

/*
 * The scale's loading state: the header with the real title (known before the data), the search bar
 * and two sectors of tiles in grey, announced once («Se încarcă standurile…»); from 1280 the aside's
 * card. The same boxes as the loaded page — StandOccupantList's grid (STAND_TRACK: 208 / 200 px
 * columns, the same gaps) and its tile height (STAND_TILE_HEIGHT) — so nothing moves when the data
 * lands.
 */

const BAR = 'inline-block max-w-full rounded-full bg-soft-fill animate-shimmer align-middle';

export function ScaleBodySkeleton({ label = 'Se încarcă standurile…' }: { label?: string }) {
  return (
    <>
      <FlowLoadingStatus label={label} />
      <div aria-hidden className="flex flex-col gap-2 md:flex-row md:items-start">
        {/* FlowSearch in the task card: the kit control shell at rest (soft-fill, radius 10). */}
        <span className="block h-12 w-full min-w-0 rounded-control bg-soft-fill animate-shimmer md:max-w-120 md:flex-1 xl:h-10" />
      </div>
      <div aria-hidden data-testid="scale-skeleton" className={cn('flex flex-col gap-6 md:grid md:gap-x-3 xl:gap-y-8', STAND_TRACK)}>
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
                // A plain shimmering tile of the loaded tile's height (no bars: a sweep over a sweep).
                <span key={i} className={cn('block rounded-card bg-soft-fill animate-shimmer', STAND_TILE_HEIGHT)} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export function ScaleAsideSkeleton() {
  return <FlowAsideSkeleton />;
}

/** The whole page while the session is read on the server (page Suspense / loading.tsx). */
export function ScaleSkeleton() {
  return (
    <FlowLayout
      header={<FlowHeaderSkeleton title="Alege standul" id="cantar-titlu" trailing={false} />}
      busy
      labelledBy="cantar-titlu"
      aside={<ScaleAsideSkeleton />}
      asideMobile="hidden"
    >
      <ScaleBodySkeleton label="Se încarcă…" />
    </FlowLayout>
  );
}
