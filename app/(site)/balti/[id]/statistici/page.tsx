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
import { statsFromState, statsPageJsonLd } from '@/lib/seo/community';
import { StatsFallback, StatsScreen } from './StatsScreen';

/*
 * Statistici baltă — fish app/(app)/lakes/[lakeId]/statistici.tsx (parity lakes.stats, T5). The
 * lake read is static; the period comes from `?perioada=` (behind a Suspense whose fallback is the
 * page's skeleton) and its figures — a cached public read, `/feed/community/stats?period=&venue=
 * lake:<id>` (the same entry as clasament / standuri) — are prefetched into the HTML; the client
 * screen takes the same query over and switches periods in the browser. Canonical: the bare page.
 */

/** The subpage's one name: breadcrumb band, BreadcrumbList, <title> and the page's JSON-LD. */
const LABEL = 'Statistici';

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
    description: `Statisticile partidelor de la ${load.lake.name}: partide, pescari, capturi, activitate, top pescari, top standuri, recordul și speciile prinse, pe săptămână, lună și an.`,
    path: routes.lakeStats(load.lake.documentId),
    empty: await lakeSubpageEmpty(load.lake, 'statistici'),
  });
}

export default async function LakeStatsPage({ params, searchParams }: Props) {
  const { id } = await params;
  const load = await loadLake(id);
  if (load.kind === 'missing') notFound();
  const lake = load.lake;
  return (
    <>
      <SetBreadcrumb trail={subTrail(lake, LABEL)} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdHtml(breadcrumbJsonLd(lake, LABEL, routes.lakeStats(lake.documentId)))} />
      <Suspense fallback={<StatsFallback lakeName={lake.name} lakeId={lake.documentId} />}>
        <Stats lake={lake} searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Stats({ lake, searchParams }: { lake: LakeDetail; searchParams: Props['searchParams'] }) {
  const period = parseStatsPeriodParam(param(await searchParams, 'perioada'));
  const { state } = await prefetchSub(lake.documentId, 'stats', t => [communityStatsQuery(t, period, { kind: 'lake', id: lake.documentId })]);
  // CollectionPage of the period on screen (its totals and «Top pescari»), at the canonical URL.
  const ld = statsPageJsonLd(`${LABEL} · ${lake.name}`, routes.lakeStats(lake.documentId), lakeAbout(lake), statsFromState(state));
  return (
    <HydrationBoundary state={state}>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdHtml(ld)} />
      <StatsScreen lakeId={lake.documentId} lakeName={lake.name} initialPeriod={period} />
    </HydrationBoundary>
  );
}
