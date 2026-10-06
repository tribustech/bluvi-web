import { BreadcrumbBand } from '@/components/nav/Breadcrumbs';
import { CompetitionSkeleton } from '../_components/CompetitionSkeleton';
import { COMPETITIONS_CRUMB } from '../_components/crumbs';

/** While the competition read is in flight: the band and this tab's body in grey (../loading.tsx). */
export default function Loading() {
  return (
    <>
      <BreadcrumbBand trail={[COMPETITIONS_CRUMB]} pendingCurrent />
      <CompetitionSkeleton variant="shell" tab="participanti" />
    </>
  );
}
