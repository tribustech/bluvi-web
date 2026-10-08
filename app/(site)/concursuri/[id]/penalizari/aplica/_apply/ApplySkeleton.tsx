import { FlowAsideSkeleton, FlowHeaderSkeleton, FlowLayout, FlowLoadingStatus, FlowSubjectSkeleton } from '@/components/templates/T6';
import { cn } from '@/components/ui/cn';

/*
 * «Aplică penalizare» loading: the real title, then the form's own boxes in grey — the subject card
 * (below 1280; from 1280 it is the aside's), «Tip penalizare» with its three cards and «Motiv» — so
 * nothing moves when the data lands. Announced once.
 */

const BAR = 'inline-block max-w-full rounded-full bg-soft-fill animate-shimmer align-middle';

export const APPLY_TITLE = 'Aplică penalizare';
export const APPLY_TITLE_ID = 'aplica-penalizare-titlu';

export function ApplyBodySkeleton({ label = 'Se încarcă echipa…' }: { label?: string }) {
  return (
    // From 1440 the form is two columns («Tip penalizare» | «Motiv»), as the loaded one.
    <div className="flex flex-col gap-6 2xl:grid 2xl:grid-cols-2 2xl:items-start 2xl:gap-x-8">
      <FlowLoadingStatus label={label} />
      <div className="xl:hidden">
        <FlowSubjectSkeleton people={2} />
      </div>
      <div aria-hidden data-testid="apply-skeleton" className="flex flex-col gap-3">
        <p className="t-title2 mb-3">
          <span className={cn(BAR, 'h-4 w-32')} />
        </p>
        <div className="flex flex-col gap-2.5">
          {Array.from({ length: 3 }, (_, i) => (
            <span key={i} className="block min-h-18 rounded-card bg-soft-fill animate-shimmer" />
          ))}
        </div>
      </div>
      <div aria-hidden className="flex flex-col gap-1.5">
        <p className="t-title2 mb-1.5">
          <span className={cn(BAR, 'h-4 w-16')} />
        </p>
        <p className="t-label">
          <span className={cn(BAR, 'h-3 w-14')} />
        </p>
        <span className="block h-28 rounded-control bg-soft-fill animate-shimmer" />
      </div>
    </div>
  );
}

export function ApplyAsideSkeleton() {
  return (
    <>
      <FlowSubjectSkeleton people={2} />
      <FlowAsideSkeleton />
    </>
  );
}

/** The whole page while the session is read on the server (page Suspense / loading.tsx). */
export function ApplySkeleton() {
  return (
    <FlowLayout
      header={<FlowHeaderSkeleton title={APPLY_TITLE} id={APPLY_TITLE_ID} trailing={false} />}
      busy
      labelledBy={APPLY_TITLE_ID}
      aside={<ApplyAsideSkeleton />}
      asideMobile="hidden"
    >
      <ApplyBodySkeleton label="Se încarcă…" />
    </FlowLayout>
  );
}
