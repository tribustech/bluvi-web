'use client';

import { XMarkIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import type { MouseEvent } from 'react';
import { useFollowAngler } from '@/components/account/angler/useFollowAngler';
import { FollowButton } from '@/components/cards/FollowButton';
import { IconButton } from '@/components/nav/IconButton';
import { Avatar, fishToneForId, toneForId } from '@/components/ui/Avatar';
import { cn } from '@/components/ui/cn';
import { formatFollowers, pickTopStats, type SuggestedAngler } from '@/core/social';
import { track } from '@/lib/analytics';
import { routes } from '@/lib/routes';

/** The card's box, shared with its skeleton so the two have one height. */
const CARD = 'relative flex h-full w-full min-w-0 flex-col items-center gap-2.5 rounded-card bg-surface px-3 pt-4 pb-3 shadow-e0';

/**
 * One suggestion — fish features/anglers/components/SuggestedAnglerCard.tsx, ONE card for both
 * places fish uses it (only `followSource` differs): the Home rail («home_rail»,
 * app/(site)/_home/SuggestedAnglers.tsx) and /pescari/sugerati («see_all»).
 *  - the 64px avatar (photo, or initials on the angler's tone keyed by documentId, as on their
 *    profile and the connections rows — fish InitialsAvatar is keyed the same way);
 *  - the username on one line (the full name as the link's title when cut), the followers line
 *    (core formatFollowers: «fără urmăritori» / «1 urmăritor» / «1.284 urmăritori»; zero reads
 *    quieter, muted vs ink-2);
 *  - up to two stats (core pickTopStats: podiums → concursuri → CMMC → partide, zeros skipped) on a
 *    two-column grid so figures line up from card to card, a lone one spanning both; none → «Pescar
 *    nou» in the same 36px band, so every card in a row keeps one height;
 *  - fish's FollowButton size="small" (kit look="profile" size="compact" block: 32px, 13px label,
 *    14px icon, solid accent «Urmărește» + user-plus / neutral «Urmăresc» + check). Following keeps
 *    the card with «Urmăresc» (useFollowAngler → core followAnglerMutation patches the cache and only
 *    marks the pool stale). fish shows no toast on a failed follow: the rollback is the feedback.
 *  - «Ascunde sugestia» top right: fish's quiet 14px gray X (stroke 2.5) inside a 40px target.
 * The whole card opens /pescari/{id}: the name is a link stretched over the card; both buttons sit
 * above it (z-above), so pressing them never navigates. An <article>, so each place wraps it in its
 * own list item.
 */
export function SuggestedAnglerCard({
  angler,
  source,
  onDismiss,
  headingLevel = 2,
}: {
  angler: SuggestedAngler;
  /** fish `followSource`, the analytics events' `source`. */
  source: 'home_rail' | 'see_all';
  onDismiss: (e: MouseEvent<HTMLButtonElement>) => void;
  /** 2 under the page's h1, 3 under the rail's h2. */
  headingLevel?: 2 | 3;
}) {
  const stats = pickTopStats(angler.stats);
  const followers = angler.stats.followers ?? 0;
  // Both places are signed-in only (the page's gate, the rail's slot).
  const follow = useFollowAngler(angler.documentId, { signedIn: true });
  const Heading = headingLevel === 3 ? 'h3' : 'h2';

  return (
    <article
      className={cn(
        CARD,
        'transition-shadow duration-(--duration-fast) ease-fast hover:shadow-e1 has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-solid has-[a:focus-visible]:outline-accent',
      )}
      data-testid="suggested-card"
      data-id={angler.documentId}
    >
      <span className="absolute top-1.5 right-1.5 z-above">
        <IconButton
          size="size-10"
          // The shell icon button draws a 24px glyph; fish's X is 14px, stroke 2.5, gray.
          className="text-muted hover:text-ink [&>svg]:size-3.5! [&>svg]:stroke-[2.5]"
          onClick={(e) => {
            track('suggested_angler_dismiss', { source });
            onDismiss(e);
          }}
          data-dismiss={angler.documentId}
          aria-label={`Ascunde sugestia: ${angler.username}`}
        >
          <XMarkIcon aria-hidden />
        </IconButton>
      </span>
      {/* Below 768 fish's saturated disc (InitialsAvatar solid, ROADMAP §4b.25); from 768 the kit's pastel tone. */}
      <Avatar name={angler.username} src={angler.avatarUrl} size={64} tone={toneForId(angler.documentId)} className="max-md:hidden" />
      <Avatar name={angler.username} src={angler.avatarUrl} size={64} tone={fishToneForId(angler.documentId)} className="md:hidden" />
      <div className="flex w-full min-w-0 flex-col items-center gap-0.5">
        <Heading className="w-full min-w-0 truncate text-center t-body-strong text-ink">
          <Link
            href={routes.angler(angler.documentId)}
            title={angler.username}
            className="outline-hidden after:absolute after:inset-0 after:rounded-card after:content-['']"
            data-testid="suggested-name"
          >
            {angler.username}
          </Link>
        </Heading>
        <p className={cn('max-w-full truncate t-caption', followers > 0 ? 'text-ink-2' : 'text-muted')} data-testid="suggested-followers">
          {formatFollowers(followers)}
        </p>
      </div>
      <div className="grid min-h-9 w-full grid-cols-2 items-start gap-x-2" data-testid="suggested-stats">
        {stats.length === 0 ? (
          <p className="col-span-2 text-center t-caption leading-9 text-muted">Pescar nou</p>
        ) : (
          stats.map((s) => (
            <p key={s.label} className={cn('flex min-w-0 flex-col items-center', stats.length === 1 && 'col-span-2')}>
              <StatValue value={s.value} />
              <span className="max-w-full truncate t-micro text-muted">{s.label}</span>
            </p>
          ))
        )}
      </div>
      <div className="mt-auto w-full">
        <FollowButton
          look="profile"
          size="compact"
          block
          name={angler.username}
          following={angler.isFollowedByMe}
          pending={follow.isPending}
          onToggle={(next) => {
            follow.toggle(next);
            // fish logs the follow only, never the unfollow.
            if (next) track('suggested_angler_follow', { source });
          }}
        />
      </div>
    </article>
  );
}

/**
 * The card while the first page loads, at the card's real height: the same box, paddings and gaps,
 * each bar inside a line box of the text it stands for (64px circle, name, followers, the 36px stats
 * band, the 32px button).
 */
export function SuggestedAnglerCardSkeleton() {
  return (
    <div aria-hidden className={CARD}>
      <span className="size-16 shrink-0 animate-shimmer rounded-full" />
      <div className="flex w-full flex-col items-center gap-0.5">
        <span className="block w-full text-center t-body-strong">
          <span className="inline-block h-3.5 w-[70%] rounded-full bg-soft-fill align-middle" />
        </span>
        <span className="block w-full text-center t-caption">
          <span className="inline-block h-2.5 w-[50%] rounded-full bg-soft-fill align-middle" />
        </span>
      </div>
      <div className="grid h-9 w-full grid-cols-2 items-center gap-x-2">
        <span className="mx-auto h-6 w-[70%] rounded-lg bg-soft-fill" />
        <span className="mx-auto h-6 w-[70%] rounded-lg bg-soft-fill" />
      </div>
      <span className="mt-auto block h-8 w-full rounded-lg bg-soft-fill" />
    </div>
  );
}

/**
 * The figure; a unit (CMMC «5,1 kg») is its own smaller, muted element beside the number, a space
 * apart (owner rule 10), never glued into the figure.
 */
function StatValue({ value }: { value: string }) {
  const m = /^(.*\S) (kg)$/.exec(value);
  return (
    <span className="t-body whitespace-nowrap text-ink">
      {m ? (
        <>
          {m[1]} <span className="t-micro text-muted">{m[2]}</span>
        </>
      ) : (
        value
      )}
    </span>
  );
}
