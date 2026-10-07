import { PartidaCardSkeleton } from '@/components/partide/community/AcasaSceneSkeleton';
import { listGridClass } from '@/components/templates/T1';
import { cn } from '@/components/ui/cn';

/**
 * fish IstoricSkeleton (parity partide.istoric.c7): a month label bone over own-card bones, in the
 * same auto-fill grid as the loaded months — never an empty-result line while the list is read.
 */
export function IstoricSkeleton() {
  return (
    <div role="status" aria-label="Se încarcă istoricul" data-testid="history-skeleton">
      <div aria-hidden className="pt-4.5 pb-2.5">
        <span className="ms-1 block h-3 w-24 animate-shimmer rounded-full" />
      </div>
      <div aria-hidden className={cn(listGridClass('md'), 'pt-1')}>
        <PartidaCardSkeleton />
        <PartidaCardSkeleton photos={false} />
        <PartidaCardSkeleton />
        <span className="contents max-md:hidden">
          <PartidaCardSkeleton photos={false} />
          <PartidaCardSkeleton />
          <PartidaCardSkeleton photos={false} />
        </span>
      </div>
    </div>
  );
}
