import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { HydrationBoundary } from '@tanstack/react-query';
import type { CompetitionCardsPage } from '@/core/competitions';
import type { LakeDetail } from '@/core/lakes';
import { absoluteUrl, routes } from '@/lib/routes';
import { SetBreadcrumb } from '../../../_shell/SiteHeader';
import { lakeIdsToPrerender, loadLake } from '../_components/load';
import { param } from '@/lib/search-params';
import { jsonLdHtml } from '@/lib/json-ld';
import { breadcrumbJsonLd, prefetchSub, subMetadata, subTrail } from '../_sub/server';
import { LakeCompetitionsFallback } from './LakeCompetitionsFallback';
import { LakeCompetitionsScreen } from './LakeCompetitionsScreen';
import { lakeCompetitionCardsQuery } from './query';
import { parseLakeCompetitionTab, tabOf } from './tabs';

/*
 * Concursuri la baltă — fish app/(app)/lakes/[lakeId]/concursuri.tsx (parity lakes.competitions,
 * T1). Static lake read; `?tab=` is read behind a Suspense with the page's frame as fallback and that
 * tab's first page (a cached public read, /feed/competitions?status=&lakeId=) comes with the HTML,
 * with an ItemList of SportsEvent as JSON-LD. The other tabs load in the browser. Canonical: the
 * bare page (Live).
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
    title: 'Concursuri',
    description: `Concursurile de pescuit de la ${load.lake.name}: cele live, cele care urmează și rezultatele celor încheiate, pe Bluvi.`,
    path: routes.lakeCompetitions(load.lake.documentId),
  });
}

export default async function LakeCompetitionsPage({ params, searchParams }: Props) {
  const { id } = await params;
  const load = await loadLake(id);
  if (load.kind === 'missing') notFound();
  const lake = load.lake;
  return (
    <>
      <SetBreadcrumb trail={subTrail(lake, 'Concursuri')} />
      <Suspense fallback={<LakeCompetitionsFallback lakeName={lake.name} lakeId={lake.documentId} />}>
        <Competitions lake={lake} searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Competitions({ lake, searchParams }: { lake: LakeDetail; searchParams: Props['searchParams'] }) {
  const tab = parseLakeCompetitionTab(param(await searchParams, 'tab'));
  const status = tabOf(tab).status;
  const { state } = await prefetchSub(lake.documentId, 'competitions-tab', t => [lakeCompetitionCardsQuery(t, lake.documentId, status)]);
  const path = routes.lakeCompetitions(lake.documentId);
  const first = (state.queries[0]?.state.data as { pages?: CompetitionCardsPage[] } | undefined)?.pages?.[0]?.data ?? [];
  const list = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${tabOf(tab).title} · ${lake.name}`,
    url: absoluteUrl(routes.lakeCompetitions(lake.documentId, tab)),
    itemListElement: first.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'SportsEvent',
        name: c.name,
        url: absoluteUrl(routes.competition(c.documentId)),
        sport: 'Pescuit sportiv',
        ...(c.startDate ? { startDate: c.startDate } : {}),
        ...(c.endDate ? { endDate: c.endDate } : {}),
        eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
        location: { '@type': 'Place', name: lake.name, url: absoluteUrl(routes.lake(lake.documentId)) },
        ...(c.banner?.url ? { image: c.banner.url } : {}),
        ...(c.organizer ? { organizer: { '@type': 'Person', name: c.organizer.username } } : {}),
      },
    })),
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdHtml([list, breadcrumbJsonLd(lake, 'Concursuri', path)])} />
      <HydrationBoundary state={state}>
        <LakeCompetitionsScreen lakeId={lake.documentId} lakeName={lake.name} initialTab={tab} />
      </HydrationBoundary>
    </>
  );
}
