import type { Metadata } from 'next';
import { Suspense } from 'react';
import { DashboardPage } from '@/components/templates/T5';
import { routes } from '@/lib/routes';
import { SetBreadcrumb } from '../../_shell/SiteHeader';
import { HubRefresh } from '../_hub/HubRefresh';
import { PartideHeader, PartideTabs } from '../_hub/PartideChrome';
import { AleMeleScreen } from './_mine/AleMeleScreen';
import { AleMeleSkeleton } from './_mine/AleMeleSkeleton';

/*
 * /partide/ale-mele — the Partide hub's «Ale mele» tab: fish app/(app)/(tabs)/partide.tsx (sub-tab
 * «alemele») + features/partide/scenes/AleMeleScene.tsx (parity docs/parity/areas/partide.yml
 * partide.ale-mele), template T5, under the hub's chrome.
 *
 * Per user: the static shell is the chrome and the journal's skeleton; the journal itself is read
 * in the browser through /api/cms (_mine/AleMeleScreen). A guest stays on the page and gets the
 * sign-in wall (c1: Comunitate and Explorează stay browsable), so there is no redirect. noindex.
 */
export const metadata: Metadata = {
  title: 'Ale mele · Partide',
  description: 'Jurnalul tău de pescuit: partidele, capturile și statisticile tale într-un singur loc.',
  robots: { index: false, follow: false },
};

export default function AleMelePage() {
  return (
    <>
      {/* The tab names itself in the shell's band: Partide › Ale mele. */}
      <SetBreadcrumb trail={[{ label: 'Partide', href: routes.partide() }, { label: 'Ale mele' }]} />
      <DashboardPage header={<PartideHeader actions={<HubRefresh />} />} toolbar={<PartideTabs current="ale-mele" />}>
        <Suspense fallback={<AleMeleSkeleton />}>
          <AleMeleScreen />
        </Suspense>
      </DashboardPage>
    </>
  );
}
