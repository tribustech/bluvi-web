import { T4Frame, T4Header, T4ProgressPlaceholder, T4SectionSkeleton } from '@/components/templates/T4';

/*
 * The flow's loading shapes (fish has none — the screen renders at once; the web waits for the
 * session gate): the real header (title, «Pasul 1 din 2», the segment row in grey), then the venue
 * step's search row, pin card and a suggestions block — the same boxes as ./VenueStep, so nothing
 * jumps when it lands. `DetailSkeleton` is step 2 while a `?balta` / `?apa` preselect loads.
 */

function VenueStepSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-5 md:gap-6">
      <div className="grid gap-3 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <span className="h-12 rounded-control bg-surface shadow-e0 md:h-16" />
        <span className="h-16 rounded-card border border-dashed border-faint" />
      </div>
      <div className="flex flex-col gap-2.5">
        <span className="h-5 w-36 rounded-full bg-soft-fill animate-shimmer" />
        <span className="grid gap-2 md:grid-cols-[repeat(auto-fill,minmax(--spacing(80),1fr))] md:gap-3">
          {Array.from({ length: 3 }, (_, i) => (
            <span key={i} className="h-16 rounded-card bg-soft-fill animate-shimmer" />
          ))}
        </span>
      </div>
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div aria-hidden data-testid="start-detail-skeleton" className="flex flex-col gap-4 md:gap-5">
      <span className="h-17 rounded-card bg-surface shadow-e0 md:h-19" />
      <T4SectionSkeleton fields={1} />
      <T4SectionSkeleton fields={0} tiles={0} />
      <T4SectionSkeleton fields={0} />
    </div>
  );
}

export function StartSkeleton() {
  return (
    <>
      <p role="status" className="sr-only">
        Se încarcă…
      </p>
      <T4Frame
        busy
        header={<T4Header title="Începe o partidă" eyebrow="Partide" step={1} total={2} progress={<T4ProgressPlaceholder steps={2} shimmer />} />}
      >
        <span aria-hidden className="hidden xl:block">
          <T4ProgressPlaceholder steps={2} shimmer />
        </span>
        <VenueStepSkeleton />
      </T4Frame>
    </>
  );
}
