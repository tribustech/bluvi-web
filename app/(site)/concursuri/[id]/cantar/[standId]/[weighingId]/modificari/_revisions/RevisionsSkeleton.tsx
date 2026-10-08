import { FlowHeaderSkeleton, FlowLayout, FlowLoadingStatus, FlowSubjectSkeleton } from '@/components/templates/T6';
import { cn } from '@/components/ui/cn';

/*
 * «Istoric modificări» loading: the real title, then two rounds in grey in the loaded card's boxes
 * (dashed accent card, heading line, two timeline rows with their 32px discs), announced once.
 * ≥1280 the aside's stand card and summary.
 */

const BAR = 'inline-block max-w-full rounded-full bg-accent-tint-2 align-middle';
const GREY = 'inline-block max-w-full rounded-full bg-soft-fill animate-shimmer align-middle';

export const TITLE = 'Istoric modificări';
export const TITLE_ID = 'modificari-titlu';

export function RevisionsBodySkeleton({ label = 'Se încarcă modificările…' }: { label?: string }) {
  return (
    <>
      <FlowLoadingStatus label={label} />
      <div aria-hidden data-testid="revisions-skeleton" className="flex flex-col gap-4">
        {Array.from({ length: 2 }, (_, s) => (
          <div key={s} className="flex flex-col gap-3 rounded-card border border-dashed border-accent bg-accent-tint px-4 py-3 md:gap-4 md:px-5 md:py-4">
            <p className="t-heading">
              <span className={cn(BAR, 'h-3.5 w-56')} />
            </p>
            <div className="flex flex-col gap-4">
              {Array.from({ length: 2 }, (_, i) => (
                <div key={i} className="flex gap-3">
                  <span className="size-8 shrink-0 rounded-full bg-accent-tint-2" />
                  <div className="flex flex-1 flex-col gap-1 pt-1">
                    <p className="t-body-strong">
                      <span className={cn(BAR, i === 0 ? 'h-3 w-48' : 'h-3 w-40')} />
                    </p>
                    <p className="t-caption">
                      <span className={cn(BAR, 'h-2.5 w-36')} />
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export function RevisionsAsideSkeleton() {
  return (
    <>
      <FlowSubjectSkeleton people={1} subtitle={false} />
      {/* The «Rezumat» card: title, the count and its caption, two stats under a hairline. */}
      <div aria-hidden className="flex flex-col gap-3 rounded-card bg-surface p-4 shadow-e0 md:p-5 xl:p-6">
        <p className="t-heading">
          <span className={cn(GREY, 'h-3.5 w-20')} />
        </p>
        <span className="t-num-40">
          <span className="inline-block h-9 w-24 rounded-control bg-soft-fill align-middle animate-shimmer" />
        </span>
        <div className="grid grid-cols-2 gap-3 border-t border-hairline pt-3">
          {Array.from({ length: 2 }, (_, i) => (
            <div key={i} className="flex flex-col gap-0.5">
              <span className="t-caption">
                <span className={cn(GREY, 'h-2.5 w-24')} />
              </span>
              <span className="t-stat">
                <span className={cn(GREY, 'h-4 w-8')} />
              </span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/** The whole page while the session is read on the server (page Suspense / loading.tsx). */
export function RevisionsSkeleton() {
  return (
    <FlowLayout
      header={<FlowHeaderSkeleton title={TITLE} id={TITLE_ID} trailing={false} />}
      busy
      labelledBy={TITLE_ID}
      aside={<RevisionsAsideSkeleton />}
      asideMobile="hidden"
    >
      <RevisionsBodySkeleton label="Se încarcă…" />
    </FlowLayout>
  );
}
