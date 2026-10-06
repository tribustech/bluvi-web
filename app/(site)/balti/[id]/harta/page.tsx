import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { HydrationBoundary } from '@tanstack/react-query';
import { standStatsByLakeIdQuery } from '@/core/competitions';
import { parseLakeCoordinates, type LakeDetail } from '@/core/lakes';
import { routes } from '@/lib/routes';
import { SetBreadcrumb } from '../../../_shell/SiteHeader';
import { lakeIdsToPrerender, loadLake } from '../_components/load';
import { jsonLdHtml } from '@/lib/json-ld';
import { breadcrumbJsonLd, prefetchSub, subMetadata, subTrail } from '../_sub/server';
import { LakeMapLoading } from './LakeMapLoading';
import { LakeMapScreen } from './LakeMapScreen';

/*
 * Hartă baltă — fish app/(app)/lakes/[lakeId]/map.tsx (parity lakes.map, T2). The lake read is
 * static; its stands (`/lakes/:id/statistics`, a cached public read) are prefetched into the HTML
 * and taken over by the client map. Without coordinates the page says so (c2) and needs no stands.
 * The dev fault switch names the stands read `stand-stats`.
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
    title: 'Hartă',
    description: `Harta din satelit a bălții ${load.lake.name}: standurile cu cea mai mare captură, calitatea și numărul de capturi, plus navigarea până la baltă sau la un stand.`,
    path: routes.lakeMap(load.lake.documentId),
  });
}

export default async function LakeMapPage({ params }: Props) {
  const { id } = await params;
  const load = await loadLake(id);
  if (load.kind === 'missing') notFound();
  const lake = load.lake;
  return (
    <>
      <SetBreadcrumb trail={subTrail(lake, 'Hartă')} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdHtml(breadcrumbJsonLd(lake, 'Hartă', routes.lakeMap(lake.documentId)))} />
      {/* The stands' read behind the map's frame with the lake's title (loading.tsx is only for the
          lake read itself). */}
      <Suspense fallback={<LakeMapLoading lakeName={lake.name} lakeId={lake.documentId} />}>
        <LakeMap lake={lake} />
      </Suspense>
    </>
  );
}

async function LakeMap({ lake }: { lake: LakeDetail }) {
  const coords = parseLakeCoordinates(lake.coordinates);
  const { state } = coords
    ? await prefetchSub(lake.documentId, 'stand-stats', t => [standStatsByLakeIdQuery(t, lake.documentId)])
    : { state: { queries: [], mutations: [] } };
  return (
    <HydrationBoundary state={state}>
      <LakeMapScreen lakeId={lake.documentId} lakeName={lake.name} coords={coords} />
    </HydrationBoundary>
  );
}
