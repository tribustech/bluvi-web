import { FlowAsideSkeleton, FlowHeaderSkeleton, FlowLayout, FlowLoadingStatus } from '@/components/templates/T6';

/*
 * The penalties hub while it loads: the real title, the list heading and three penalty cards in
 * grey, announced once — the same boxes as the loaded list, so nothing moves when it lands.
 */

const BAR = 'inline-block max-w-full rounded-full bg-soft-fill animate-shimmer align-middle';

export const PENALTIES_TITLE = 'Penalizări';
export const PENALTIES_TITLE_ID = 'penalizari-titlu';

export function PenaltiesBodySkeleton() {
  return (
    <>
      <FlowLoadingStatus label="Se încarcă penalizările…" />
      <p aria-hidden className="t-title2">
        <span className={`${BAR} h-4 w-56`} />
      </p>
      <ul aria-hidden className={PENALTY_GRID}>
        {Array.from({ length: 3 }, (_, i) => (
          <li key={i} className="flex gap-3 rounded-card border border-hairline p-4">
            <span className="mt-1 h-3.5 w-2.5 shrink-0 rounded-badge bg-soft-fill" />
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="t-heading">
                <span className={`${BAR} h-3.5 w-32`} />
              </span>
              <span className="t-caption">
                <span className={`${BAR} h-2.5 w-28`} />
              </span>
              <span className="t-body">
                <span className={`${BAR} h-3 w-full`} />
              </span>
              <span className="t-caption">
                <span className={`${BAR} h-2.5 w-40`} />
              </span>
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

/** The cards' grid: one column on a phone, then as many ≥ 320px columns as fit (never wider cards). */
export const PENALTY_GRID = 'grid grid-cols-1 gap-3 md:grid-cols-[repeat(auto-fill,minmax(20rem,1fr))]';

/** The whole page while the session is read on the server (page Suspense / loading.tsx). */
export function PenaltiesSkeleton() {
  return (
    <FlowLayout
      header={<FlowHeaderSkeleton title={PENALTIES_TITLE} id={PENALTIES_TITLE_ID} trailing={false} />}
      busy
      labelledBy={PENALTIES_TITLE_ID}
      aside={<FlowAsideSkeleton />}
      asideMobile="hidden"
    >
      <PenaltiesBodySkeleton />
    </FlowLayout>
  );
}
