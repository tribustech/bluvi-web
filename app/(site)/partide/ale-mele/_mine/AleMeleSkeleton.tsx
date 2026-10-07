import { cn } from '@/components/ui/cn';

/*
 * fish PartideSkeletons `AleMeleSceneSkeleton` (parity partide.ale-mele.c3): the journal in grey
 * while the session, the live probe or the first own-sessions list is read — never four honest-
 * looking zeros. Same geometry as the loaded page: below 1280 the flat stat card, «Capturile mele»
 * and the «Statistici» chart card with its two tiles; from 1280 the bento (four tiles beside the
 * tall chart tile, the two wide facts under them) and a row of cards. Shimmer only on text and
 * figures (Fundații §07); photo boxes are a still soft fill.
 */

const BONE = 'block animate-shimmer rounded-full';

function Title() {
  return <span aria-hidden className={cn(BONE, 'mb-3 h-4.5 w-36')} />;
}

function Card({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn('flex flex-col gap-3.5 rounded-card bg-surface p-4 shadow-e0', className)}>
      <span className="flex items-center gap-3">
        <span className="size-11 shrink-0 rounded-control bg-soft-fill" />
        <span className="flex flex-1 flex-col gap-2">
          <span className={cn(BONE, 'h-3.5 w-[55%]')} />
          <span className={cn(BONE, 'h-2.5 w-[35%]')} />
        </span>
      </span>
      <span className="grid grid-cols-3 gap-3 border-t border-hairline pt-3">
        {[0, 1, 2].map(i => (
          <span key={i} className="flex flex-col gap-1.5">
            <span className={cn(BONE, 'h-4.5 w-10')} />
            <span className={cn(BONE, 'h-2 w-14')} />
          </span>
        ))}
      </span>
      <span className="flex justify-between border-t border-hairline pt-3">
        <span className={cn(BONE, 'h-2.5 w-28')} />
        <span className={cn(BONE, 'h-2.5 w-20')} />
      </span>
    </div>
  );
}

export function AleMeleSkeleton() {
  return (
    <div role="status" aria-label="Se încarcă jurnalul" className="flex flex-col gap-4 md:gap-5 xl:gap-6" data-testid="ale-mele-skeleton">
      {/* phone / tablet */}
      <div aria-hidden className="flex flex-col gap-4 md:gap-5 xl:hidden">
        <div className="flex rounded-card bg-surface px-1 py-3.5 shadow-e0">
          {[0, 1, 2, 3].map(i => (
            <span key={i} className={cn('flex flex-1 flex-col items-center gap-2', i > 0 && 'border-l border-hairline')}>
              <span className={cn(BONE, 'h-5.5 w-10')} />
              <span className={cn(BONE, 'h-2 w-12')} />
            </span>
          ))}
        </div>
        <div>
          <Title />
          <div className="-mx-4 flex gap-3 overflow-hidden px-4 md:mx-0 md:grid md:grid-cols-3 md:px-0">
            {[0, 1, 2].map(i => (
              <span key={i} className="h-47 w-62.5 shrink-0 rounded-card bg-soft-fill md:h-52 md:w-auto" />
            ))}
          </div>
        </div>
        <div>
          <Title />
          <div className="flex flex-col gap-3.5">
            <div className="flex h-36 flex-col justify-end gap-2 rounded-card bg-surface px-3.75 py-3.5 shadow-e0">
              <span className="flex items-end gap-4">
                {[20, 35, 15, 50, 30, 45, 60].map((h, i) => (
                  <span key={i} className="flex-1 animate-shimmer rounded-[4px]" style={{ height: h }} />
                ))}
              </span>
            </div>
            <div className="flex gap-2.75">
              <span className="h-22 flex-1 rounded-card bg-surface shadow-e0" />
              <span className="h-22 flex-1 rounded-card bg-surface shadow-e0" />
            </div>
          </div>
        </div>
        <div>
          <Title />
          <Card />
        </div>
      </div>
      {/* from 1280: the bento, then the cards */}
      <div aria-hidden className="hidden flex-col gap-6 xl:flex">
        <div>
          <Title />
          <div className="grid grid-cols-4 gap-4">
            <div className="col-span-2 grid grid-cols-2 gap-4">
              <span className="flex h-32 flex-col justify-between rounded-bento bg-navy p-4.5">
                <span className="block h-3 w-16 rounded-full bg-lavender/15" />
                <span className="block h-8 w-14 rounded-full bg-lavender/15" />
              </span>
              {[0, 1, 2].map(i => (
                <span key={i} className="flex h-32 flex-col justify-between rounded-bento bg-surface p-4.5 shadow-e0">
                  <span className={cn(BONE, 'h-3 w-16')} />
                  <span className={cn(BONE, 'h-8 w-20')} />
                </span>
              ))}
            </div>
            <span className="col-span-2 rounded-bento bg-surface shadow-e0" />
            <span className="col-span-2 h-32 rounded-bento bg-surface shadow-e0" />
            <span className="col-span-2 h-32 rounded-bento bg-surface shadow-e0" />
          </div>
        </div>
        <div>
          <Title />
          <div className="grid grid-cols-3 gap-3.5">
            <Card />
            <Card />
            <Card />
          </div>
        </div>
      </div>
    </div>
  );
}
