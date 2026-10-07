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
import { breadcrumbJsonLd, lakeAbout, lakeSubpageEmpty, prefetchSub, subMetadata, subTrail } from '../_sub/server';
import { standsRankingJsonLd, statsFromState } from '@/lib/seo/community';
import { StandsFallback } from './StandsFallback';
import { StandsScreen } from './StandsScreen';

/*
 * Clasament standuri — fish app/(app)/lakes/[lakeId]/standuri.tsx (parity lakes.stands-ranking,
 * T1). Static lake read; `?perioada=` and `?sortare=` are read behind a Suspense with the page's
 * frame as fallback, and the period's stats (the same cached public read as the anglers' ranking —
 * fish shares the cache entry) come with the HTML. Canonical: the bare page.
 */

/** The subpage's one name — breadcrumb band, BreadcrumbList, <title> and the JSON-LD — as its H1 names it. */
const LABEL = 'Clasament standuri';

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
    title: LABEL,
    description: `Standurile de la ${load.lake.name} după kilograme, capturi și record, din partidele comunității Bluvi.`,
    path: routes.lakeStands(load.lake.documentId),
    empty: await lakeSubpageEmpty(load.lake, 'standuri'),
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
      <SetBreadcrumb trail={subTrail(lake, LABEL)} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdHtml(breadcrumbJsonLd(lake, LABEL, path))} />
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
  // CollectionPage + the stands by kg (the canonical sort) as an ItemList; a sorted view (?sortare=)
  // keeps the canonical's order, the page it canonicalises to.
  const ld = standsRankingJsonLd(`${LABEL} · ${lake.name}`, routes.lakeStands(lake.documentId), lakeAbout(lake), statsFromState(state));
  return (
    <HydrationBoundary state={state}>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdHtml(ld)} />
      <StandsScreen lakeId={lake.documentId} lakeName={lake.name} period={period} initialSort={sort} />
    </HydrationBoundary>
  );
}
