'use client';

import { useParams } from 'next/navigation';
import { FlowActions, FlowFieldSkeleton, FlowHeader, FlowLayout, FlowLoadingStatus } from '@/components/templates/T6';
import { Button } from '@/components/ui/Button';
import { routes } from '@/lib/routes';
import { BlockCalendarSkeleton } from './BlockCalendar';
import { TITLE, TITLE_ID } from './model';

/*
 * «Adaugă blocaj» before its first availability page: the real header (title known, the lake's name
 * a bar — rule 4), the form's boxes in grey in the same grid as the loaded form, the summary card
 * and the action bar with its buttons off. Used by loading.tsx, the gate's Suspense fallback and the
 * screen itself while the first page loads, so nothing moves when the data lands.
 */

const BAR = 'inline-block max-w-full animate-shimmer rounded-full bg-soft-fill align-middle';

export function EyebrowBar() {
  return (
    <>
      <span className="sr-only">Se încarcă…</span>
      <span aria-hidden className={`${BAR} h-3 w-32`} />
    </>
  );
}

function Heading({ w }: { w: string }) {
  return (
    <p aria-hidden className="t-title2">
      <span className={`${BAR} h-4 ${w}`} />
    </p>
  );
}

function Chips({ n }: { n: number }) {
  return (
    <div aria-hidden className="flex flex-wrap gap-2">
      {Array.from({ length: n }, (_, i) => (
        <span key={i} className="block h-12 w-14 animate-shimmer rounded-control bg-soft-fill xl:h-10" />
      ))}
    </div>
  );
}

/** The form's grey boxes (same grid as CreateBlockScreen's form). */
export function CreateBlockBody() {
  return (
    <div className="flex flex-col gap-8 lg:grid lg:grid-cols-2 lg:grid-rows-[auto_auto_1fr] lg:items-start lg:gap-x-8 lg:gap-y-8 xl:gap-x-10">
      <FlowLoadingStatus label="Se încarcă calendarul bălții…" />
      <div className="flex flex-col gap-3 lg:col-start-2 lg:row-start-1">
        <Heading w="w-32" />
        <Chips n={8} />
      </div>
      <div className="flex flex-col gap-3 lg:col-start-1 lg:row-span-3 lg:row-start-1">
        <Heading w="w-24" />
        <BlockCalendarSkeleton />
      </div>
      <div className="flex flex-col gap-3 lg:col-start-2 lg:row-start-2">
        <Heading w="w-20" />
        <Chips n={4} />
        <FlowFieldSkeleton height="h-24" label="w-24" />
      </div>
    </div>
  );
}

export function CreateBlockAsideSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-3 rounded-card bg-surface p-4 shadow-e0 md:p-5 xl:p-6">
      <p className="t-heading">
        <span className={`${BAR} h-3.5 w-20`} />
      </p>
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="flex flex-col gap-1 border-t border-hairline pt-3 first-of-type:border-t-0">
          <span className={`${BAR} h-2.5 w-20`} />
          <span className={`${BAR} h-3.5 w-40`} />
        </div>
      ))}
    </div>
  );
}

/** The route's first paint (loading.tsx and the gate's fallback). */
export function CreateBlockFallback() {
  const { lakeId } = useParams<{ lakeId: string }>();
  return (
    <FlowLayout
      header={
        <FlowHeader
          title={TITLE}
          id={TITLE_ID}
          eyebrow={<EyebrowBar />}
          backHref={lakeId ? routes.operatorBlocks(lakeId) : routes.operator()}
          backLabel="Înapoi la blocaje"
        />
      }
      labelledBy={TITLE_ID}
      busy
      aside={<CreateBlockAsideSkeleton />}
      asideMobile="hidden"
      actions={
        <FlowActions
          primary={
            <Button block disabled>
              Salvează și închide
            </Button>
          }
          secondary={
            <>
              <Button variant="outline" block disabled>
                Salvează și adaugă altul
              </Button>
              <Button variant="ghost" block className="max-md:hidden" disabled>
                Anulează
              </Button>
            </>
          }
        />
      }
    >
      <CreateBlockBody />
    </FlowLayout>
  );
}
