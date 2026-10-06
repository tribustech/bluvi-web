import { AsideSkeleton, FilterColumnSkeleton, ListHeader, ListPage } from '@/components/templates/T1';
import { routes } from '@/lib/routes';
import { FallbackHeader } from '../_sub/FallbackHeader';
import { ChipsSkeleton, StandsSkeletonBody } from '../_sub/stats';

/** The stand ranking's frame while it is read (fish StatisticiSkeleton under the header, c5). */
export function StandsFallback({ lakeName, lakeId }: { lakeName?: string; lakeId?: string }) {
  const description = lakeName ?? <span aria-hidden className="inline-block h-3 w-32 animate-shimmer rounded-full align-middle" />;
  return (
    <div aria-busy>
      <ListPage
        header={
          lakeId ? (
            <ListHeader title="Clasament standuri" description={description} back={{ label: 'Înapoi', href: routes.lake(lakeId) }} />
          ) : (
            <FallbackHeader title="Clasament standuri" description={description} />
          )
        }
        filters={<FilterColumnSkeleton title="Ordonează" sections={[3]} />}
        aside={<AsideSkeleton rows={1} />}
        asideBusy
      >
        <div className="xl:hidden">
          <ChipsSkeleton widths={['w-24', 'w-20', 'w-20']} />
        </div>
        <StandsSkeletonBody />
      </ListPage>
    </div>
  );
}
