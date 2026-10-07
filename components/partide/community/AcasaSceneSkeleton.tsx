import { DashboardLayout } from '@/components/templates/T5';
import { cn } from '@/components/ui/cn';

/*
 * fish features/partide/components/PartideSkeletons.tsx `AcasaSceneSkeleton` — the Comunitate
 * dashboard in grey while the overview (or, with nothing live, the first history page) is read
 * (parity partide.comunitate.c10, c25): never zero-filled sections, never the empty prose before
 * the history has answered. Same geometry as the loaded page at every width — below 1280 fish's
 * order (quick nav, the catches rail, the section and two cards), from 1280 the three columns (the
 * quick nav on the left, the cards in the centre, the 2×2 records and the venues on the right).
 * The hero is per-user and draws its own box; it is not part of this skeleton.
 */

const BONE = 'block animate-shimmer rounded-full';

function QuickNavBones({ layout }: { layout: 'row' | 'list' }) {
  if (layout === 'list') {
    return (
      <div aria-hidden className="flex flex-col rounded-card bg-surface p-2 shadow-e0">
        {[0, 1, 2].map(i => (
          <span key={i} className="flex min-h-11 items-center gap-3 px-2.5 py-1.5">
            <span className="size-9 animate-shimmer rounded-full" />
            <span className={cn(BONE, 'h-3 w-24')} />
          </span>
        ))}
      </div>
    );
  }
  return (
    <div aria-hidden className="grid grid-cols-3 gap-2.5">
      {[0, 1, 2].map(i => (
        <span key={i} className="flex flex-col items-center gap-2.25 rounded-card bg-surface px-1.5 py-3.5 shadow-e0">
          <span className="size-9.5 animate-shimmer rounded-full" />
          <span className={cn(BONE, 'h-3 w-14.5')} />
        </span>
      ))}
    </div>
  );
}

function SectionTitleBone({ width }: { width: string }) {
  return (
    <span aria-hidden className="flex items-center t-title2 pb-3">
      {'​'}
      <span className={cn(BONE, 'h-4.5', width)} />
    </span>
  );
}

/** fish PartidaCardSkeleton: header, the stat strip, (photos), the footer. */
export function PartidaCardSkeleton({ photos = true }: { photos?: boolean }) {
  return (
    <div aria-hidden className="flex flex-col gap-3.5 rounded-card bg-surface p-4 shadow-e0">
      <span className="flex min-h-11 items-center gap-3">
        <span className="size-11 animate-shimmer rounded-full" />
        <span className="flex flex-1 flex-col gap-1.5">
          <span className={cn(BONE, 'h-4 w-36 max-w-full')} />
          <span className={cn(BONE, 'h-3 w-24')} />
        </span>
      </span>
      <span className="grid grid-cols-3 gap-3.5 border-t border-hairline pt-3">
        {[0, 1, 2].map(i => (
          <span key={i} className="flex flex-col gap-1.5">
            <span className={cn(BONE, 'h-5 w-12')} />
            <span className={cn(BONE, 'h-2.5 w-14')} />
          </span>
        ))}
      </span>
      {photos ? (
        <span className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map(i => (
            <span key={i} className="h-24 animate-shimmer rounded-control" />
          ))}
        </span>
      ) : null}
      <span className="flex items-center justify-between border-t border-hairline pt-3">
        <span className={cn(BONE, 'h-3 w-32')} />
        <span className={cn(BONE, 'h-3 w-20')} />
      </span>
    </div>
  );
}

function RailBones() {
  return (
    <div aria-hidden>
      <SectionTitleBone width="w-32" />
      <div className="-mx-4 flex gap-3 overflow-hidden px-4 md:mx-0 md:grid md:grid-cols-3 md:px-0">
        {[0, 1, 2].map(i => (
          <span key={i} className={cn('h-47 w-62.5 shrink-0 animate-shimmer rounded-card md:h-52 md:w-auto', i === 2 && 'max-md:hidden')} />
        ))}
      </div>
    </div>
  );
}

function MiddleBones() {
  return (
    <div aria-hidden>
      <SectionTitleBone width="w-24" />
      <div className="grid gap-3 @3xl:grid-cols-2">
        <PartidaCardSkeleton />
        <PartidaCardSkeleton photos={false} />
      </div>
    </div>
  );
}

function RecordsBones() {
  return (
    <div aria-hidden>
      <SectionTitleBone width="w-24" />
      <div className="grid grid-cols-2 gap-3">
        {[0, 1, 2, 3].map(i => (
          <span key={i} className="h-42.5 animate-shimmer rounded-bento" />
        ))}
      </div>
    </div>
  );
}

/** The dashboard body in grey (the header and the tabs stay real above it). */
export function AcasaSceneSkeleton() {
  return (
    <div role="status" aria-busy className="contents" data-testid="comunitate-skeleton">
      <span className="sr-only">Se încarcă partidele comunității…</span>
      <DashboardLayout
        sidesBelowXl="hidden"
        context={<QuickNavBones layout="list" />}
        main={
          <>
            <div className="contents xl:hidden">
              <QuickNavBones layout="row" />
            </div>
            <RailBones />
            <MiddleBones />
          </>
        }
        aside={<RecordsBones />}
      />
    </div>
  );
}
