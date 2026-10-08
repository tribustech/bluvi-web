import type { Metadata } from 'next';
import { breadcrumbListJsonLd, jsonLdHtml } from '@/lib/json-ld';
import { absoluteUrl, routes } from '@/lib/routes';
import { POLL_TITLE } from './_components/model';
import { PollScreen } from './_components/PollScreen';

/*
 * /sondaje — «Sondaj», the community's current poll (parity participant.poll-current, T6).
 * fish: app/(app)/polls/current.tsx (+ components/PollOption, PollSuggestInput,
 * PollSuggestionSentSheet, helpers/sharePoll, goBackOrHome).
 *
 * Public and static: metadata, JSON-LD and the header are prerendered; the poll is read in the
 * browser through /api/cms because GET /polls/current is personalised when signed in
 * (myVoteOptionId) — a shared cached copy would show one viewer's vote to everybody. Votes and
 * suggestions are the signed-in viewer's writes (same proxy); a guest is sent to sign-in and back.
 * ?focus=sugestie (Acasă's «Sugerează o opțiune») focuses the suggestion field (c12).
 * fish's /polls/current and /polls/past links redirect here (next.config.ts, b.poll-deeplink).
 */

const DESCRIPTION = 'Votează în sondajul comunității Bluvi și propune propriile opțiuni. Rezultatele se actualizează pe loc.';

export const metadata: Metadata = {
  title: POLL_TITLE,
  description: DESCRIPTION,
  alternates: { canonical: routes.polls() },
  openGraph: {
    type: 'website',
    title: `${POLL_TITLE} · Bluvi`,
    description: DESCRIPTION,
    url: absoluteUrl(routes.polls()),
    siteName: 'Bluvi',
    locale: 'ro_RO',
  },
  twitter: { card: 'summary_large_image', title: `${POLL_TITLE} · Bluvi`, description: DESCRIPTION },
};

export default function PollPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLdHtml(breadcrumbListJsonLd([{ label: 'Acasă', href: routes.home() }, { label: POLL_TITLE }], routes.polls()))}
      />
      <PollScreen />
    </>
  );
}
