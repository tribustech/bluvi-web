import { AsideSkeleton, FilterColumn, FilterColumnSkeleton, FilterSection, ListHeader, ListPage } from '@/components/templates/T1';
import { PERIOD_OPTIONS } from '@/lib/stats-period';
import { routes } from '@/lib/routes';
import { FallbackHeader, TitleShimmer } from '../_sub/FallbackHeader';
import { LakePages } from '../_sub/LakePages';
import { ChipsSkeleton } from '../_sub/stats';
import { RANKING_CAPTION } from './caption';
import { RankingSkeletonBody } from './RankingScreen';

/** The «Perioadă» / «Arată» sections' chips in grey: three periods, two segments. */
function ChoiceBones({ count }: { count: number }) {
  return (
    <span aria-hidden className="flex flex-col gap-2.5">
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className="h-10 animate-shimmer rounded-control" />
      ))}
    </span>
  );
}

/**
 * The ranking's frame while its period is read: title, chips, podium and rows in grey (fish
 * ClasamentSkeleton). With the lake's id known (the page's Suspense fallback) the left column is
 * the loaded one's — Perioadă and Arată as shimmer rows, the real static «Pe această baltă» — so
 * it never jumps from bones to links (as Statistici's StatsFallback); loading.tsx knows no id and
 * keeps the column skeleton.
 */
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
        header={
          lakeId ? (
            <ListHeader title={title} description={RANKING_CAPTION} back={{ label: 'Înapoi', href: routes.lake(lakeId) }} />
          ) : (
            <FallbackHeader title={title} description={RANKING_CAPTION} />
          )
        }
        filters={
          lakeId ? (
            <FilterColumn title="Clasament">
              <FilterSection title="Perioadă">
                <ChoiceBones count={PERIOD_OPTIONS.length} />
              </FilterSection>
              <FilterSection title="Arată">
                <ChoiceBones count={2} />
              </FilterSection>
              <LakePages lakeId={lakeId} current="clasament" />
            </FilterColumn>
          ) : (
            <FilterColumnSkeleton title="Clasament" sections={[3, 2]} />
          )
        }
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
