import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { HydrationBoundary } from '@tanstack/react-query';
import { communityStatsQuery, parseStatsPeriodParam } from '@/core/partide';
import type { LakeDetail } from '@/core/lakes';
import { routes } from '@/lib/routes';
import { SetBreadcrumb } from '../../../_shell/SiteHeader';
import { lakeIdsToPrerender, loadLake } from '../_components/load';
import { param } from '@/lib/search-params';
import { jsonLdHtml } from '@/lib/json-ld';
import { breadcrumbJsonLd, lakeAbout, lakeSubpageEmpty, prefetchSub, subMetadata, subTrail } from '../_sub/server';
import { anglersRankingJsonLd, statsFromState } from '@/lib/seo/community';
import { RankingFallback } from './RankingFallback';
import { RankingScreen } from './RankingScreen';

/*
 * Clasament pescari la baltă — fish app/(app)/lakes/[lakeId]/clasament.tsx (parity
 * lakes.anglers-ranking, T1). The lake read is static; the period comes from `?perioada=` (read
 * behind a Suspense whose fallback is the page's own frame) and its ranking — a cached public read,
 * `/feed/community/stats?period=&venue=lake:<id>` — is prefetched into the HTML; the client screen
 * takes the same query over and switches periods in the browser. Canonical: the bare page.
 */

/**
 * The subpage's one name — breadcrumb band, BreadcrumbList, <title> and the JSON-LD — as its H1
 * names it («Clasament · {baltă}», «Clasament pescari» being the H1's caption line).
 */
const LABEL = 'Clasament';

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
    description: `Cei mai buni pescari de la ${load.lake.name}: podiumul, kilogramele prinse și speciile, pe săptămână, lună și an, din partidele comunității Bluvi.`,
    path: routes.lakeRanking(load.lake.documentId),
    empty: await lakeSubpageEmpty(load.lake, 'clasament'),
  });
}

export default async function LakeRankingPage({ params, searchParams }: Props) {
  const { id } = await params;
  const load = await loadLake(id);
  if (load.kind === 'missing') notFound();
  const lake = load.lake;
  const path = routes.lakeRanking(lake.documentId);
  return (
    <>
      <SetBreadcrumb trail={subTrail(lake, LABEL)} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdHtml(breadcrumbJsonLd(lake, LABEL, path))} />
      <Suspense fallback={<RankingFallback lakeName={lake.name} lakeId={lake.documentId} />}>
        <Ranking lake={lake} searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Ranking({ lake, searchParams }: { lake: LakeDetail; searchParams: Props['searchParams'] }) {
  const period = parseStatsPeriodParam(param(await searchParams, 'perioada'));
  const { state } = await prefetchSub(lake.documentId, 'stats', t => [communityStatsQuery(t, period, { kind: 'lake', id: lake.documentId })]);
  // CollectionPage + the ranking on screen as an ItemList, at the canonical URL.
  const ld = anglersRankingJsonLd(`${LABEL} · ${lake.name}`, routes.lakeRanking(lake.documentId), lakeAbout(lake), statsFromState(state));
  return (
    <HydrationBoundary state={state}>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdHtml(ld)} />
      <RankingScreen lakeId={lake.documentId} lakeName={lake.name} initialPeriod={period} />
    </HydrationBoundary>
  );
}
