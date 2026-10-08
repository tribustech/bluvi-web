import { FlowAsideSkeleton, FlowHeaderSkeleton, FlowLayout, FlowLoadingStatus, FlowSubjectSkeleton } from '@/components/templates/T6';

/*
 * The stand history while it loads: the real title, the dashed stand card and three weighing cards
 * in grey (below 1280) or the table's header and rows (from 1280), announced once. The same boxes
 * as the loaded page, so nothing moves when the data lands.
 */

const BAR = 'inline-block max-w-full rounded-full bg-soft-fill animate-shimmer align-middle';

export const HISTORY_TITLE = 'Istoric cântăriri';
export const HISTORY_TITLE_ID = 'istoric-titlu';

export function HistoryBodySkeleton() {
  return (
    <>
      <FlowLoadingStatus label="Se încarcă cântările standului…" />
      <FlowSubjectSkeleton people={1} subtitle={false} />
      <ul aria-hidden className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:hidden">
        {Array.from({ length: 3 }, (_, i) => (
          <li key={i} className="flex flex-col gap-2 rounded-card border border-hairline p-4">
            <span className="t-heading">
              <span className={`${BAR} h-3.5 w-24`} />
            </span>
            <span className="t-body">
              <span className={`${BAR} h-3 w-full`} />
            </span>
            <span className="t-caption">
              <span className={`${BAR} h-2.5 w-36`} />
            </span>
          </li>
        ))}
      </ul>
      <div aria-hidden className="hidden overflow-hidden rounded-card border border-hairline xl:block">
        <div className="h-10 bg-accent-tint-2" />
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="flex h-12 items-center gap-6 border-t border-hairline px-3">
            <span className={`${BAR} h-3 w-24`} />
            <span className={`${BAR} h-3 w-20`} />
            <span className={`${BAR} h-3 w-20`} />
            <span className={`${BAR} ml-auto h-3 w-16`} />
          </div>
        ))}
      </div>
    </>
  );
}

/** The whole page while the session is read on the server (page Suspense / loading.tsx). */
export function HistorySkeleton() {
  return (
    <FlowLayout
      header={<FlowHeaderSkeleton title={HISTORY_TITLE} id={HISTORY_TITLE_ID} trailing={false} />}
      busy
      labelledBy={HISTORY_TITLE_ID}
      aside={<FlowAsideSkeleton />}
      asideMobile="hidden"
    >
      <HistoryBodySkeleton />
    </FlowLayout>
  );
}
