import type { Metadata } from 'next';
import { Suspense } from 'react';
import { HydrationBoundary } from '@tanstack/react-query';
import { AcasaSceneSkeleton } from '@/components/partide/community/AcasaSceneSkeleton';
import { DashboardPage } from '@/components/templates/T5';
import { collectionPageJsonLd, jsonLdHtml } from '@/lib/json-ld';
import { absoluteUrl, routes } from '@/lib/routes';
import { ComunitateScreen } from '../_comunitate/ComunitateScreen';
import { comunitateState, overviewForSeo } from '../_comunitate/state';
import { HubRefresh } from '../_hub/HubRefresh';
import { PartideHeader, PartideTabs } from '../_hub/PartideChrome';

/*
 * Partide — the hub's «Comunitate» tab: fish app/(app)/(tabs)/partide.tsx (sub-tab «acasa») and
 * features/partide/scenes/AcasaScene.tsx (parity docs/parity/areas/partide.yml partide.comunitate),
 * template T5.
 *
 * Public and static: the overview (and, with nothing live, the first finished partide) is the
 * cached public CMS read (_comunitate/state.ts; tags community-live / community-history), hydrated
 * into the browser's query, which polls it every 60s. The header, the tabs and every public block
 * are in the HTML; the per-user parts (the «Începe» pill, the hero or the live dock, the viewer's
 * own rows) render in the browser once the session and the live probe have answered.
 */

const TITLE = 'Partide de pescuit';
const DESCRIPTION =
  'Partidele pescarilor din comunitatea Bluvi: cine e la apă acum, ultimele capturi cu poze, recordurile zilei, săptămânii și lunii și locurile cele mai populare.';

export const metadata: Metadata = {
  title: 'Partide',
  description: DESCRIPTION,
  alternates: { canonical: routes.partide() },
  openGraph: {
    type: 'website',
    title: `${TITLE} · Bluvi`,
    description: DESCRIPTION,
    url: absoluteUrl(routes.partide()),
    siteName: 'Bluvi',
    locale: 'ro_RO',
  },
  twitter: { card: 'summary_large_image', title: `${TITLE} · Bluvi`, description: DESCRIPTION },
};

export default function PartidePage() {
  return (
    <>
      <Suspense fallback={null}>
        <PartideJsonLd />
      </Suspense>
      <DashboardPage header={<PartideHeader actions={<HubRefresh />} />} toolbar={<PartideTabs current="comunitate" />}>
        <Suspense fallback={<AcasaSceneSkeleton />}>
          <Comunitate />
        </Suspense>
      </DashboardPage>
    </>
  );
}

async function Comunitate() {
  const state = await comunitateState();
  return (
    <HydrationBoundary state={state}>
      <ComunitateScreen />
    </HydrationBoundary>
  );
}

/** schema.org CollectionPage; the popular venues that are lakes as its ItemList (the same cached read). */
async function PartideJsonLd() {
  const overview = await overviewForSeo();
  const lakes = (overview?.popularVenues ?? []).filter(v => v.lakeId);
  const data = collectionPageJsonLd({
    name: TITLE,
    description: DESCRIPTION,
    path: routes.partide(),
    ...(lakes.length
      ? { list: { name: 'Locuri populare', items: lakes.map(v => ({ name: v.name, description: v.locality ?? undefined, path: routes.lake(v.lakeId as string) })) } }
      : {}),
  });
  return <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdHtml(data)} />;
}
