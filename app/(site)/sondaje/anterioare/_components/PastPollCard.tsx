import type { Poll } from '@/core/competitions';
import { PollOptionRow } from '../../_components/PollOptionRow';
import { pastPollFacts } from './format';

/**
 * One closed poll (c4) — fish past.tsx renderItem: a white 12-radius card with the title, the facts
 * line «Închis · {d lună yyyy} · {n} vot/voturi», the description when present, then every option
 * as a read-only result (PollOptionRow readOnly: share, votes, my vote's border + bar and «, votul
 * tău» in words) in the order the CMS returns them — fish does not re-sort past polls.
 *
 * The card is an <article> named by its title (an h2: the page's h1 is «Sondaje anterioare»); the
 * options are a list named «Rezultate». Nothing in it is interactive.
 *
 * `[overflow-wrap:anywhere]` on the card: titles, descriptions and community-suggested options are
 * free text (a URL, names joined by hyphens) — a word longer than the card breaks instead of running
 * past its edge or under the share column. Inherited, so PollOptionRow's spans break too.
 */
export function PastPollCard({ poll }: { poll: Poll }) {
  const titleId = `sondaj-${poll.documentId}`;
  return (
    <article aria-labelledby={titleId} data-past-poll={poll.documentId} className="flex min-w-0 flex-col gap-3 rounded-card [overflow-wrap:anywhere] bg-surface p-4 shadow-e0 md:p-5">
      <header className="flex flex-col gap-1">
        <h2 id={titleId} className="t-heading text-ink">
          {poll.title}
        </h2>
        <p className="t-caption text-muted" data-past-poll-facts>
          {pastPollFacts(poll)}
        </p>
      </header>
      {poll.description ? <p className="t-body text-ink-2">{poll.description}</p> : null}
      <ul aria-label="Rezultate" className="flex flex-col gap-2">
        {poll.options.map((o) => (
          <li key={o.id}>
            <PollOptionRow option={o} totalVotes={poll.totalVotes} myVote={poll.myVoteOptionId} readOnly />
          </li>
        ))}
      </ul>
    </article>
  );
}

