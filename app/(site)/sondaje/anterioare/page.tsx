import type { Metadata } from 'next';
import { breadcrumbListJsonLd, jsonLdHtml } from '@/lib/json-ld';
import { absoluteUrl, routes } from '@/lib/routes';
import { POLL_TITLE } from '../_components/model';
import { PAST_POLLS_TITLE } from './_components/format';
import { PastPollsList } from './_components/PastPollsList';

/*
 * /sondaje/anterioare — «Sondaje anterioare», the closed polls with their final results (parity
 * participant.polls-past, T1). fish: app/(app)/polls/past.tsx (+ components/PollOption,
 * services/queries/usePollsPast, services/api/polls.ts).
 *
 * Public and static (c8: fish has no sign-in gate; the CMS grants GET /polls/past to Public and
 * Authenticated): metadata, JSON-LD and the shell are prerendered; the polls are read in the
 * browser through /api/cms because the read is personalised when signed in (myVoteOptionId) — a
 * shared cached copy would show one viewer's votes to everybody. A guest reads the same list with
 * no vote of their own. fish's /polls/past links redirect here (next.config.ts, POLLS_PAST_ON_WEB).
 */

const DESCRIPTION = 'Rezultatele finale ale sondajelor comunității Bluvi: fiecare opțiune, cu voturile și procentul ei.';

export const metadata: Metadata = {
  title: PAST_POLLS_TITLE,
  description: DESCRIPTION,
  alternates: { canonical: routes.pollsPast() },
  openGraph: {
    type: 'website',
    title: `${PAST_POLLS_TITLE} · Bluvi`,
    description: DESCRIPTION,
    url: absoluteUrl(routes.pollsPast()),
    siteName: 'Bluvi',
    locale: 'ro_RO',
  },
  twitter: { card: 'summary_large_image', title: `${PAST_POLLS_TITLE} · Bluvi`, description: DESCRIPTION },
};

export default function PastPollsPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLdHtml(
          breadcrumbListJsonLd(
            [{ label: 'Acasă', href: routes.home() }, { label: POLL_TITLE, href: routes.polls() }, { label: PAST_POLLS_TITLE }],
            routes.pollsPast(),
          ),
        )}
      />
      <PastPollsList />
    </>
  );
}
