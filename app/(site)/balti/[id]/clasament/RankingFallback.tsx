import { AsideSkeleton, FilterColumnSkeleton, ListHeader, ListPage } from '@/components/templates/T1';
import { routes } from '@/lib/routes';
import { FallbackHeader, TitleShimmer } from '../_sub/FallbackHeader';
import { ChipsSkeleton } from '../_sub/stats';
import { RankingSkeletonBody } from './RankingScreen';

/** The ranking's frame while its period is read: title, chips, podium and rows in grey (fish ClasamentSkeleton). */
export function RankingFallback({ lakeName, lakeId }: { lakeName?: string; lakeId?: string }) {
  const title = (
    <>
      Clasament<span className="max-sm:sr-only"> · </span>
      <span className="max-sm:block">{lakeName ?? <TitleShimmer srLabel="baltă" />}</span>
    </>
  );
  return (
    <div aria-busy>
      <ListPage
        header={lakeId ? <ListHeader title={title} back={{ label: 'Înapoi', href: routes.lake(lakeId) }} /> : <FallbackHeader title={title} />}
        filters={<FilterColumnSkeleton title="Clasament" sections={[3, 2]} />}
        aside={<AsideSkeleton rows={2} />}
        asideBusy
      >
        <div className="xl:hidden">
          <ChipsSkeleton />
        </div>
        <RankingSkeletonBody />
      </ListPage>
    </div>
  );
}
