import { AcasaSceneSkeleton } from '@/components/partide/community/AcasaSceneSkeleton';
import { DashboardPage } from '@/components/templates/T5';
import { PartideHeader, PartideTabs } from '../_hub/PartideChrome';

/** fish AcasaSceneSkeleton under the real chrome (parity partide.comunitate.c25). */
export default function PartideLoading() {
  return (
    <DashboardPage header={<PartideHeader />} toolbar={<PartideTabs current="comunitate" />}>
      <AcasaSceneSkeleton />
    </DashboardPage>
  );
}
