import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { HydrationBoundary } from '@tanstack/react-query';
import { communityHistoryInfiniteQuery, communityVenueCatchesInfiniteQuery, communityVenueKey, communityVenueSectionQuery, type CommunityVenueRef } from '@/core/partide';
import type { LakeDetail } from '@/core/lakes';
import { routes } from '@/lib/routes';
import { SetBreadcrumb } from '../../../_shell/SiteHeader';
import { lakeIdsToPrerender, loadLake } from '../_components/load';
import { jsonLdHtml } from '@/lib/json-ld';
import { breadcrumbJsonLd, prefetchSub, subMetadata, subTrail } from '../_sub/server';
import { PartideFallback, PartideScreen } from './PartideScreen';

/*
 * Partide la baltă — fish app/(app)/lakes/[lakeId]/partide.tsx (parity lakes.partide, T1). Public:
 * the lake, the live section, the first history page and the first catches page are cached public
 * CMS reads prefetched into the HTML (the client screen takes the same queries over, polls the live
 * section every 60s and loads the next history pages). A failed read leaves the browser to read it
 * (the dev fault switch names it `partide`).
 */

type Props = { params: Promise<{ id: string }> };

export const instant = false;

export async function generateStaticParams() {
  const ids = await lakeIdsToPrerender();
  return (ids.length ? ids : ['_']).map(id => ({ id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const load = await loadLake(id);
  if (load.kind === 'missing') return { title: 'Balta nu a fost găsită' };
  return subMetadata(load.lake, {
    title: 'Partide',
    description: `Partidele de pescuit de la ${load.lake.name}: cine pescuiește acum, ultimele capturi și partidele încheiate, din comunitatea Bluvi.`,
    path: routes.lakePartide(load.lake.documentId),
  });
}

export default async function LakePartidePage({ params }: Props) {
  const { id } = await params;
  const load = await loadLake(id);
  if (load.kind === 'missing') notFound();
  const lake = load.lake;
  return (
    <>
      <SetBreadcrumb trail={subTrail(lake, 'Partide')} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdHtml(breadcrumbJsonLd(lake, 'Partide', routes.lakePartide(lake.documentId)))} />
      {/* The feeds' reads (up to the read budget on a slow CMS) behind the page's own skeleton, under
          the lake's name — loading.tsx is only for the lake read itself. */}
      <Suspense fallback={<PartideFallback lakeName={lake.name} lakeId={lake.documentId} />}>
        <Partide lake={lake} />
      </Suspense>
    </>
  );
}

async function Partide({ lake }: { lake: LakeDetail }) {
  const venue: CommunityVenueRef = { kind: 'lake', id: lake.documentId };
  const { state } = await prefetchSub(lake.documentId, 'partide', t => [
    communityVenueSectionQuery(t, venue),
    communityHistoryInfiniteQuery(t, [communityVenueKey(venue)]),
    communityVenueCatchesInfiniteQuery(t, venue),
  ]);
  return (
    <HydrationBoundary state={state}>
      <PartideScreen lakeId={lake.documentId} lakeName={lake.name} />
    </HydrationBoundary>
  );
}
