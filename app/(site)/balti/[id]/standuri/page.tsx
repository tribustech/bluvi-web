import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { HydrationBoundary } from '@tanstack/react-query';
import { communityStatsQuery, parseStandSortParam, parseStatsPeriodParam } from '@/core/partide';
import type { LakeDetail } from '@/core/lakes';
import { routes } from '@/lib/routes';
import { SetBreadcrumb } from '../../../_shell/SiteHeader';
import { lakeIdsToPrerender, loadLake } from '../_components/load';
import { param } from '@/lib/search-params';
import { jsonLdHtml } from '@/lib/json-ld';
import { breadcrumbJsonLd, prefetchSub, subMetadata, subTrail } from '../_sub/server';
import { StandsFallback } from './StandsFallback';
import { StandsScreen } from './StandsScreen';

/*
 * Clasament standuri — fish app/(app)/lakes/[lakeId]/standuri.tsx (parity lakes.stands-ranking,
 * T1). Static lake read; `?perioada=` and `?sortare=` are read behind a Suspense with the page's
 * frame as fallback, and the period's stats (the same cached public read as the anglers' ranking —
 * fish shares the cache entry) come with the HTML. Canonical: the bare page.
 */

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

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
    title: 'Clasament standuri',
    description: `Standurile de la ${load.lake.name} după kilograme, capturi și record, din partidele comunității Bluvi.`,
    path: routes.lakeStands(load.lake.documentId),
  });
}

export default async function LakeStandsPage({ params, searchParams }: Props) {
  const { id } = await params;
  const load = await loadLake(id);
  if (load.kind === 'missing') notFound();
  const lake = load.lake;
  const path = routes.lakeStands(lake.documentId);
  return (
    <>
      <SetBreadcrumb trail={subTrail(lake, 'Standuri')} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdHtml(breadcrumbJsonLd(lake, 'Clasament standuri', path))} />
      <Suspense fallback={<StandsFallback lakeName={lake.name} lakeId={lake.documentId} />}>
        <Stands lake={lake} searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Stands({ lake, searchParams }: { lake: LakeDetail; searchParams: Props['searchParams'] }) {
  const sp = await searchParams;
  const period = parseStatsPeriodParam(param(sp, 'perioada'));
  const sort = parseStandSortParam(param(sp, 'sortare'));
  const { state } = await prefetchSub(lake.documentId, 'stats', t => [communityStatsQuery(t, period, { kind: 'lake', id: lake.documentId })]);
  return (
    <HydrationBoundary state={state}>
      <StandsScreen lakeId={lake.documentId} lakeName={lake.name} period={period} initialSort={sort} />
    </HydrationBoundary>
  );
}
