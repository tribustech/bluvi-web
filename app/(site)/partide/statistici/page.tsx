import type { Metadata } from 'next';
import { Suspense } from 'react';
import { HydrationBoundary } from '@tanstack/react-query';
import { parseStatsPeriodParam } from '@/core/partide';
import { breadcrumbListJsonLd, collectionPageJsonLd, jsonLdHtml } from '@/lib/json-ld';
import { param, type SearchParams } from '@/lib/search-params';
import { absoluteUrl, routes } from '@/lib/routes';
import { anglerItems, statsFromState, totalsLine } from '@/lib/seo/community';
import { PERIOD_TITLE } from '@/lib/stats-period';
import { SetBreadcrumb } from '../../_shell/SiteHeader';
import { StatsScreen, StatsSkeleton } from './_stats/StatsScreen';
import { statsState } from './_stats/state';

/*
 * /partide/statistici — «Statistici comunitate»: fish app/(app)/partide/statistici.tsx (parity
 * docs/parity/areas/partide.yml partide.statistici), template T5 as a bento.
 *
 * Public. The shell (header, breadcrumb) is static; the period comes from `?perioada=` (behind a
 * Suspense whose fallback is the page's skeleton) and its figures — the cached public read
 * `/feed/community/stats?period=` (lib/server/public-get, tag community-stats; one cache entry per
 * period) — are in the HTML, hydrated into the browser's query, which switches periods itself.
 * Canonical: the bare page (Luna).
 */

const TITLE = 'Statistici comunitate';
const DESCRIPTION =
  'Statisticile partidelor din comunitatea Bluvi pe săptămână, lună și an: partide, pescari, capturi, activitate, top pescari, top bălți, recordul și speciile prinse.';
const TRAIL = [{ label: 'Partide', href: routes.partide() }, { label: 'Statistici' }];

type Props = { searchParams: Promise<SearchParams> };

export const metadata: Metadata = {
  title: `${TITLE} · Partide`,
  description: DESCRIPTION,
  alternates: { canonical: routes.partideStats() },
  openGraph: {
    type: 'website',
    title: `${TITLE} · Bluvi`,
    description: DESCRIPTION,
    url: absoluteUrl(routes.partideStats()),
    siteName: 'Bluvi',
    locale: 'ro_RO',
  },
  twitter: { card: 'summary_large_image', title: `${TITLE} · Bluvi`, description: DESCRIPTION },
};

export default function PartideStatsPage({ searchParams }: Props) {
  return (
    <>
      <SetBreadcrumb trail={TRAIL} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdHtml(breadcrumbListJsonLd(TRAIL, routes.partideStats()))} />
      <Suspense fallback={<StatsSkeleton />}>
        <Stats searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Stats({ searchParams }: Props) {
  const period = parseStatsPeriodParam(param(await searchParams, 'perioada'));
  const state = await statsState(period);
  // CollectionPage of the period on screen (its totals and «Top pescari»), at the canonical URL.
  const stats = statsFromState(state);
  const has = !!stats && stats.totals.partide > 0;
  const ld = collectionPageJsonLd({
    name: TITLE,
    path: routes.partideStats(),
    description: has ? `${PERIOD_TITLE[period]}: ${totalsLine(stats)}.` : DESCRIPTION,
    ...(has && stats.topAnglers.length ? { list: { name: 'Top pescari', items: anglerItems(stats).slice(0, 3) } } : {}),
  });
  return (
    <HydrationBoundary state={state}>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdHtml(ld)} />
      <StatsScreen initialPeriod={period} />
    </HydrationBoundary>
  );
}
