import {
  FlowAsideSkeleton,
  FlowHeaderSkeleton,
  FlowLayout,
  FlowLoadingStatus,
  FlowSubjectSkeleton,
} from '@/components/templates/T6';
import { cn } from '@/components/ui/cn';

/*
 * The weighing's loading state: the stand card (below 1280; from 1280 it is in the aside), the
 * «Capturi» heading and the table's header + four rows in grey, announced once — the loaded page's
 * boxes, so nothing moves when the data lands.
 */

const BAR = 'inline-block max-w-full rounded-full bg-soft-fill animate-shimmer align-middle';

export function WeighingBodySkeleton() {
  return (
    <>
      <FlowLoadingStatus label="Se încarcă cântarul…" />
      <div className="xl:hidden">
        <FlowSubjectSkeleton people={1} subtitle={false} />
      </div>
      <div aria-hidden className="flex flex-col gap-3" data-testid="weighing-skeleton">
        <p className="t-title2">
          <span className={cn(BAR, 'h-4 w-24')} />
        </p>
        <div className="overflow-hidden rounded-card border border-hairline xl:max-w-170">
          <div className="h-10 bg-accent-tint" />
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex h-14 items-center gap-4 border-t border-hairline px-3 md:px-4">
              <span className={cn(BAR, 'h-3 w-4')} />
              <span className={cn(BAR, 'h-3.5 w-24')} />
              <span className={cn(BAR, 'ml-auto h-3.5 w-16')} />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export function WeighingAsideSkeleton() {
  return (
    <>
      <FlowSubjectSkeleton people={1} subtitle={false} />
      <FlowAsideSkeleton />
    </>
  );
}

/** The whole page while the session is read on the server (page Suspense / loading.tsx). */
export function WeighingSkeleton() {
  return (
    <FlowLayout
      header={<FlowHeaderSkeleton id="cantar-titlu" trailing={false} />}
      busy
      labelledBy="cantar-titlu"
      aside={<WeighingAsideSkeleton />}
      asideMobile="hidden"
    >
      <WeighingBodySkeleton />
    </FlowLayout>
  );
}
