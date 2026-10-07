import { DashboardPage } from '@/components/templates/T5';
import { routes } from '@/lib/routes';
import { SetBreadcrumb } from '../../_shell/SiteHeader';
import { PartideHeader, PartideTabs } from '../_hub/PartideChrome';
import { AleMeleSkeleton } from './_mine/AleMeleSkeleton';

/** fish AleMeleSceneSkeleton under the real chrome (parity partide.ale-mele.c3). */
export default function AleMeleLoading() {
  return (
    <>
      {/* The tab names itself in the shell's band: Partide › Ale mele. */}
      <SetBreadcrumb trail={[{ label: 'Partide', href: routes.partide() }, { label: 'Ale mele' }]} />
      <DashboardPage header={<PartideHeader />} toolbar={<PartideTabs current="ale-mele" />}>
        <AleMeleSkeleton />
      </DashboardPage>
    </>
  );
}
