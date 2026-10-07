import { DashboardPage } from '@/components/templates/T5';
import { PartideHeader, PartideTabs } from '../_hub/PartideChrome';
import { ExploreChipsSkeleton, ExploreListSkeleton } from './_explore/parts';

/** fish CommunitySceneSkeleton under the real chrome: the chip row, a section label and cards. */
export default function ExploreLoading() {
  return (
    <DashboardPage header={<PartideHeader />} toolbar={<PartideTabs current="exploreaza" />}>
      <div className="flex flex-col gap-4 md:gap-5">
        <ExploreChipsSkeleton />
        <ExploreListSkeleton />
      </div>
    </DashboardPage>
  );
}
