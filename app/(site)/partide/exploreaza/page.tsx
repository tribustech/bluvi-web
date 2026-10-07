import type { Metadata } from 'next';
import { Suspense } from 'react';
import { HydrationBoundary } from '@tanstack/react-query';
import { DashboardPage } from '@/components/templates/T5';
import { membersLabel } from '@/core/partide';
import { collectionPageJsonLd, jsonLdHtml } from '@/lib/json-ld';
import { partideHrefs } from '@/lib/partide-pages';
import { absoluteUrl, routes } from '@/lib/routes';
import { HubRefresh } from '../_hub/HubRefresh';
import { PartideHeader, PartideTabs } from '../_hub/PartideChrome';
import { ExploreRoot } from './_explore/ExploreScreen';
import { ExploreListSkeleton } from './_explore/parts';
import { exploreState, prefetchedHistory } from './_explore/state';

/*
 * Partide · Explorează — the hub's second tab: fish app/(app)/(tabs)/partide.tsx (sub-tab «partide»)
 * and features/partide/scenes/CommunityScene.tsx (parity docs/parity/areas/partide.yml
 * partide.exploreaza), template T1 (a horizontal filter bar over the list) under the hub's chrome.
 *
 * Public and static: live page 1 and finished page 1 of the unfiltered view are the cached public
 * CMS reads (./_explore/state.ts; tags community-live / community-history), hydrated into the
 * browser's infinite queries, which load the next pages and every filtered view. The URL's filters
 * (?live, ?filtru, ?loc) are read in the browser (./_explore/place.ts).
 */

const TITLE = 'Explorează partidele de pescuit';
const DESCRIPTION =
  'Toate partidele publice din comunitatea Bluvi: cine pescuiește acum, pe ce baltă, cu câte capturi și câte kilograme, și partidele încheiate cu pozele lor.';

export const metadata: Metadata = {
  title: 'Explorează partide',
  description: DESCRIPTION,
  alternates: { canonical: routes.partideExplore() },
  openGraph: {
    type: 'website',
    title: `${TITLE} · Bluvi`,
    description: DESCRIPTION,
    url: absoluteUrl(routes.partideExplore()),
    siteName: 'Bluvi',
    locale: 'ro_RO',
  },
  twitter: { card: 'summary_large_image', title: `${TITLE} · Bluvi`, description: DESCRIPTION },
};

export default function ExplorePage() {
  return (
    <DashboardPage header={<PartideHeader actions={<HubRefresh />} />} toolbar={<PartideTabs current="exploreaza" />}>
      <Suspense fallback={<ExploreListSkeleton />}>
        <Explore />
      </Suspense>
    </DashboardPage>
  );
}

async function Explore() {
  const state = await exploreState();
  return (
    <>
      <ExploreJsonLd rows={prefetchedHistory(state)} />
      <HydrationBoundary state={state}>
        <ExploreRoot />
      </HydrationBoundary>
    </>
  );
}

/** schema.org CollectionPage; the finished partide of page 1 as its ItemList once their pages are on the web. */
function ExploreJsonLd({ rows }: { rows: ReturnType<typeof prefetchedHistory> }) {
  const items = rows.flatMap(r => {
    const path = partideHrefs.partida(r.documentId);
    return path ? [{ name: `${membersLabel(r.members)} · ${r.venue.name}`, path }] : [];
  });
  const data = collectionPageJsonLd({
    name: TITLE,
    description: DESCRIPTION,
    path: routes.partideExplore(),
    ...(items.length ? { list: { name: 'Partide încheiate', items, order: 'descending' as const } } : {}),
  });
  return <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdHtml(data)} />;
}
