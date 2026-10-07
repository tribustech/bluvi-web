import type { Metadata } from 'next';
import { Suspense } from 'react';
import { HydrationBoundary } from '@tanstack/react-query';
import { communityStatsQuery, parseStatsPeriodParam } from '@/core/partide';
import { routes } from '@/lib/routes';
import { SetBreadcrumb } from '../../../_shell/SiteHeader';
import { StatsFallback } from '../../_components/venue/StatsScreen';
import { StatsRoute } from '../../_components/venue/StatsRoute';
import { jsonLdHtml } from '@/lib/json-ld';
import { param } from '@/lib/search-params';
import {
  breadcrumbJsonLd,
  loadCommunityWater,
  metadataWater,
  unresolvedMetadata,
  prefetchWater,
  qualifiedWaterName,
  subMetadata,
  subPath,
  subTrail,
  waterAbout,
  type CommunityWater,
} from '../../_server/sub';
import { statsFromState, statsPageJsonLd } from '@/lib/seo/community';

/*
 * Statisticile apei — fish app/(app)/public-waters/[id]/statistici.tsx (parity
 * public-waters.statistici, T5). The water read is static; the period comes from `?perioada=`
 * (behind a Suspense whose fallback is the page's skeleton) and its figures — a cached public
 * read, `/feed/community/stats?period=&venue=water:<code>` — are prefetched into the HTML; the
 * client screen takes the same query over. Canonical: the bare page.
 */

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export const instant = false;

export async function generateStaticParams() {
  return [{ id: '_' }];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const water = await metadataWater((await params).id);
  if (typeof water === 'string') return unresolvedMetadata(water);
  return subMetadata(water, { page: 'statistici', title: 'Statistici' });
}

export default async function PublicWaterStatsPage({ params, searchParams }: Props) {
  const { id } = await params;
  const cw = await loadCommunityWater(id);
  const title = cw.water.name ?? 'Statistici';
  return (
    <>
      <SetBreadcrumb trail={subTrail(cw.water, 'Statistici')} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdHtml(breadcrumbJsonLd(cw.water, 'Statistici', subPath(cw.water, 'statistici')))} />
      <Suspense fallback={<StatsFallback title={title} backHref={routes.publicWater(cw.key)} />}>
        <Stats id={id} cw={cw} title={title} searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Stats({ id, cw, title, searchParams }: { id: string; cw: CommunityWater; title: string; searchParams: Props['searchParams'] }) {
  const period = parseStatsPeriodParam(param(await searchParams, 'perioada'));
  const state = await prefetchWater(id, (t) => [communityStatsQuery(t, period, cw.venue)]);
  // CollectionPage of the period on screen (its totals and «Top pescari»), at the canonical URL.
  const ld = statsPageJsonLd(`Statistici · ${qualifiedWaterName(cw.water)}`, subPath(cw.water, 'statistici'), waterAbout(cw.water), statsFromState(state));
  return (
    <HydrationBoundary state={state}>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdHtml(ld)} />
      <StatsRoute code={cw.code} waterKey={cw.key} title={title} initialPeriod={period} />
    </HydrationBoundary>
  );
}
