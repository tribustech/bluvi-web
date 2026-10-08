import type { Metadata } from 'next';
import { breadcrumbListJsonLd, jsonLdHtml } from '@/lib/json-ld';
import { absoluteUrl, routes } from '@/lib/routes';
import { raffleCopy } from '../_shared/copy';
import { WINNERS_DESCRIPTION } from './_components/model';
import { WinnersScreen } from './_components/WinnersScreen';

/*
 * /tombola/castigatori — «Câștigători», the winners of an ended raffle session (parity
 * participant.raffle-winners, T6). fish: app/(app)/raffle/winners.tsx (+ ExpandablePrizeRow,
 * hooks/useRaffle.ts, services/api/raffle.ts).
 *
 * Public (c7: fish opens it for guests from the Acasă card; GET /raffle-sessions/active is public):
 * not in proxy.ts's sign-in list. Static shell — metadata, JSON-LD, header and skeleton are
 * prerendered; the session is read in the browser through /api/cms (it flips from open to ended to
 * drawn, and the CMS has no cache tag for raffle sessions to revalidate a cached copy on). The page
 * lives only while a drawn session is the active one (otherwise it sends visitors home), so it is
 * not indexed and not in the sitemap; links to it still get a title, a description and a card.
 */

const TITLE = raffleCopy.winners.title;

export const metadata: Metadata = {
  title: `${TITLE} · Tombolă`,
  description: WINNERS_DESCRIPTION,
  alternates: { canonical: routes.raffleWinners() },
  robots: { index: false, follow: true },
  openGraph: {
    type: 'website',
    title: `${TITLE} · Tombolă Bluvi`,
    description: WINNERS_DESCRIPTION,
    url: absoluteUrl(routes.raffleWinners()),
    siteName: 'Bluvi',
    locale: 'ro_RO',
  },
  twitter: { card: 'summary_large_image', title: `${TITLE} · Tombolă Bluvi`, description: WINNERS_DESCRIPTION },
};

export default function RaffleWinnersPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLdHtml(
          breadcrumbListJsonLd([{ label: 'Acasă', href: routes.home() }, { label: TITLE }], routes.raffleWinners()),
        )}
      />
      <WinnersScreen />
    </>
  );
}
