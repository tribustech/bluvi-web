import type { Metadata } from 'next';
import { Suspense } from 'react';
import { HydrationBoundary } from '@tanstack/react-query';
import { isWeighed, fmtKg } from '@/core/partide';
import { formatCount } from '@/core/realtime/chat/format';
import { collectionPageJsonLd, jsonLdHtml } from '@/lib/json-ld';
import { absoluteUrl, anglerHref, routes } from '@/lib/routes';
import { SetBreadcrumb } from '../../_shell/SiteHeader';
import { rankingOrder } from './_ranking/place';
import { RankingFallback, RankingRoot } from './_ranking/RankingScreen';
import { rankingState, statsOf } from './_ranking/state';

/*
 * Clasamente — fish app/(app)/partide/clasament.tsx → features/partide/screens/
 * AnglersLeaderboardScreen.tsx (parity docs/parity/areas/partide.yml partide.clasament), template T1.
 *
 * Public and static: the default period's ranking (luna) is the cached public CMS read
 * (`/feed/community/stats?period=month`, tag community-stats; ./_ranking/state.ts), prerendered and
 * hydrated into the browser's query. The URL's place (?perioada=, ?tab=) is read in the browser
 * (./_ranking/place.ts), which reads another period itself; the «EU» pill is computed there from the
 * shell session. Canonical: the bare page. JSON-LD: a CollectionPage with the anglers' ranking as
 * its ItemList, in the order the page ranks them (./_ranking/place rankingOrder; only what the page
 * shows: no list for an empty period).
 */

const DESCRIPTION =
  'Clasamentul pescarilor din comunitatea Bluvi: cine a prins cele mai multe kilograme săptămâna aceasta, luna aceasta și anul acesta, plus bălțile cu cele mai multe partide și speciile prinse.';

export const metadata: Metadata = {
  title: 'Clasamente partide',
  description: DESCRIPTION,
  alternates: { canonical: routes.partideRanking() },
  openGraph: {
    type: 'website',
    title: 'Clasamente partide · Bluvi',
    description: DESCRIPTION,
    url: absoluteUrl(routes.partideRanking()),
    siteName: 'Bluvi',
    locale: 'ro_RO',
  },
  twitter: { card: 'summary_large_image', title: 'Clasamente partide · Bluvi', description: DESCRIPTION },
};

const TRAIL = [{ label: 'Partide', href: routes.partide() }, { label: 'Clasamente' }];

export default function PartideRankingPage() {
  return (
    <>
      <SetBreadcrumb trail={TRAIL} />
      <Suspense fallback={<RankingFallback />}>
        <Ranking />
      </Suspense>
    </>
  );
}

async function Ranking() {
  const state = await rankingState();
  return (
    <>
      <RankingJsonLd state={state} />
      <HydrationBoundary state={state}>
        <RankingRoot />
      </HydrationBoundary>
    </>
  );
}

const kg = (n: number) => `${fmtKg(n)} kg`;

function RankingJsonLd({ state }: { state: Awaited<ReturnType<typeof rankingState>> }) {
  const stats = statsOf(state);
  const items =
    stats && stats.totals.partide > 0
      ? rankingOrder(stats.topAnglers).map((a) => {
          const path = anglerHref(a.uid);
          return {
            name: a.name ?? 'Pescar',
            description: [isWeighed(a.totalKg) ? kg(a.totalKg) : null, formatCount(a.partide, 'partidă', 'partide'), formatCount(a.catches, 'captură', 'capturi')]
              .filter(Boolean)
              .join(' · '),
            ...(path ? { path } : {}),
          };
        })
      : [];
  const data = collectionPageJsonLd({
    name: 'Clasamente partide — luna aceasta',
    description: DESCRIPTION,
    path: routes.partideRanking(),
    ...(items.length ? { list: { name: 'Clasament pescari', items } } : {}),
  });
  return <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdHtml(data)} />;
}
