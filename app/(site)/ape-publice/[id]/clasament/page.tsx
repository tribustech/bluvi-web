import type { Metadata } from 'next';
import { Suspense } from 'react';
import { HydrationBoundary } from '@tanstack/react-query';
import { communityStatsQuery, parseStatsPeriodParam } from '@/core/partide';
import { routes } from '@/lib/routes';
import { SetBreadcrumb } from '../../../_shell/SiteHeader';
import { RankingFallback, RankingScreen } from '../../_components/venue/RankingScreen';
import { jsonLdHtml } from '@/lib/json-ld';
import { param } from '@/lib/search-params';
import {
  breadcrumbJsonLd,
  loadCommunityWater,
  metadataWater,
  unresolvedMetadata,
  prefetchWater,
  subMetadata,
  subPath,
  subTrail,
  type CommunityWater,
} from '../../_server/sub';

/*
 * Clasament · <apă> — fish app/(app)/public-waters/[id]/clasament.tsx (parity
 * public-waters.clasament, T1). The water read is static; the period comes from `?perioada=` (read
 * behind a Suspense whose fallback is the page's own frame) and its ranking — a cached public read,
 * `/feed/community/stats?period=&venue=water:<code>` — is prefetched into the HTML; the client screen
 * takes the same query over and switches periods in the browser. Canonical: the bare page.
 */

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export const instant = false;

export async function generateStaticParams() {
  return [{ id: '_' }];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const water = await metadataWater((await params).id);
  if (typeof water === 'string') return unresolvedMetadata(water);
  return subMetadata(water, {
    page: 'clasament',
    title: 'Clasament pescari',
    description: `Cei mai buni pescari pe ${water.name ?? 'această apă'}: podiumul, kilogramele prinse și speciile, pe săptămână, lună și an, din partidele comunității Bluvi.`,
  });
}

export default async function PublicWaterRankingPage({ params, searchParams }: Props) {
  const { id } = await params;
  const cw = await loadCommunityWater(id);
  // The family header (parity clasament.c2 note): the water's name, «Clasamentul apei» under it.
  const title = cw.water.name ?? 'Clasament';
  return (
    <>
      <SetBreadcrumb trail={subTrail(cw.water, 'Clasament')} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdHtml(breadcrumbJsonLd(cw.water, 'Clasament', subPath(cw.water, 'clasament')))} />
      <Suspense fallback={<RankingFallback title={title} backHref={routes.publicWater(cw.key)} />}>
        <Ranking id={id} cw={cw} title={title} searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Ranking({ id, cw, title, searchParams }: { id: string; cw: CommunityWater; title: string; searchParams: Props['searchParams'] }) {
  const period = parseStatsPeriodParam(param(await searchParams, 'perioada'));
  const state = await prefetchWater(id, (t) => [communityStatsQuery(t, period, cw.venue)]);
  return (
    <HydrationBoundary state={state}>
      <RankingScreen venue={cw.venue} waterKey={cw.key} title={title} backHref={routes.publicWater(cw.key)} initialPeriod={period} />
    </HydrationBoundary>
  );
}
