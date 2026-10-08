'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ExclamationTriangleIcon, TrophyIcon as TrophyOutline } from '@heroicons/react/24/outline';
import { TrophyIcon, UserIcon } from '@heroicons/react/24/solid';
import { FlowHeader, FlowLayout, FlowLoadingStatus, FlowNoticeSkeleton } from '@/components/templates/T6';
import { T4Gate, T4Notice } from '@/components/templates/T4';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import type { RaffleWinnerEntry } from '@/core/organizer';
import { isApiError } from '@/core/transport';
import { anglerHref, routes } from '@/lib/routes';
import { raffleCopy } from '../../_shared/copy';
import { PrizeRow, TypeBadge } from '../../_shared/PrizeRow';
import { useRaffle } from '../../_shared/useRaffle';
import { BACK_HOME, shouldLeave, WINNERS_NOTICE_BODY, WINNERS_NOTICE_TITLE, winnerGroups, winnerName, type WinnerGroup } from './model';

const C = raffleCopy.winners;
const TITLE_ID = 'castigatori-titlu';

/**
 * The type cards: fish's stack on a phone and a tablet; from 1024 the grid is sized by the number
 * of categories so the cards always fill the row (owner rule: full-width desktop): one category →
 * one wide card (its prize left, its winners right, see TypeCard `wide`), two → two columns,
 * three or more → three.
 */
const STACK = 'flex flex-col gap-4 md:gap-5 lg:grid lg:items-start lg:gap-6';
function gridFor(count: number): string {
  return cn(STACK, count <= 1 ? 'lg:grid-cols-1' : count === 2 ? 'lg:grid-cols-2' : 'lg:grid-cols-3');
}
/** fish's type card: white, radius 16, padding 16 (20 / 24 from 768 / 1280, the T6 rhythm). */
const CARD = 'flex min-w-0 flex-col gap-4 rounded-card bg-surface p-4 shadow-e0 md:p-5 xl:p-6';

function Header() {
  return <FlowHeader title={C.title} id={TITLE_ID} backHref={routes.home()} backLabel={BACK_HOME} />;
}

/**
 * /tombola/castigatori «Câștigători» (fish app/(app)/raffle/winners.tsx; parity
 * participant.raffle-winners). Public (c7): the active session is read in the browser through
 * /api/cms, with no participation read (a guest has none, and the page does not need one).
 *
 * - Until the session is known: the skeleton (no CMS tag for raffle sessions, so nothing is
 *   prerendered from it). A read error: a gate with «Încearcă din nou» (rule 4).
 * - c1: not ended, or ended without winners, or no session → home (router.replace, after the data).
 * - c2: winners flagged but no group → «Câștigătorii nu au fost anunțați încă.» + «Înapoi acasă».
 * - c3–c5: the notice, then one card per type (badge, prize, winners).
 * - c6: «Înapoi acasă» (header chip and the button at the end) replaces the page with home.
 * Layout: fish's stack on a phone; from 1024 the type cards fill the row (1 wide card, 2 or 3 columns), notice above.
 */
export function WinnersScreen() {
  const raffle = useRaffle({ signedIn: false });
  const router = useRouter();
  const leave = raffle.status === 'ready' && shouldLeave(raffle.state);

  useEffect(() => {
    if (leave) router.replace(routes.home());
  }, [leave, router]);

  const dead = isApiError(raffle.error) && raffle.error.code === 'SESSION_DEAD';
  if (dead) return <WinnersSkeleton />;
  if (raffle.status === 'error') return <LoadError retrying={raffle.retrying} onRetry={raffle.retry} />;
  if (raffle.status === 'pending' || leave) return <WinnersSkeleton />;

  const groups = winnerGroups(raffle.state);
  const home = () => router.replace(routes.home());

  if (groups.length === 0) {
    return (
      <FlowLayout header={<Header />} labelledBy={TITLE_ID} variant="bare" narrow>
        <T4Gate
          icon={<TrophyOutline />}
          title={C.noWinnersYet}
          actions={
            <Button variant="outline" onClick={home}>
              {BACK_HOME}
            </Button>
          }
        />
      </FlowLayout>
    );
  }

  return (
    <FlowLayout
      header={<Header />}
      labelledBy={TITLE_ID}
      variant="bare"
      notice={
        <T4Notice tone="info" title={WINNERS_NOTICE_TITLE}>
          {WINNERS_NOTICE_BODY}
        </T4Notice>
      }
    >
      <div className={gridFor(groups.length)}>
        {groups.map((g) => (
          <TypeCard key={g.typeKey} group={g} wide={groups.length === 1} />
        ))}
      </div>
      {/* fish: the outlined button at the end of the scroll, not a bar — the page has no task to
          finish, so nothing sticks over the winners. Full width on a phone, its own width from 768. */}
      <Button variant="outline" onClick={home} className="w-full md:w-auto md:self-start md:min-w-60">
        {BACK_HOME}
      </Button>
    </FlowLayout>
  );
}

/**
 * One category. `wide` (the only category, from 1024): the badge across the card, then the prize
 * on the left and the winners on the right; with no prize the winners take the width in columns.
 */
function TypeCard({ group, wide = false }: { group: WinnerGroup; wide?: boolean }) {
  const headingId = `castigatori-${group.typeKey}`;
  const split = wide && group.prize != null;
  return (
    <section
      aria-labelledby={headingId}
      className={cn(CARD, wide && 'lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-8 lg:gap-y-5')}
      data-testid="winners-type"
    >
      <h2 id={headingId} className={cn('flex', wide && 'lg:col-span-2')}>
        <TypeBadge label={`${C.perCategory} ${group.label}`} color={group.badgeColor} />
      </h2>
      {/* The card's badge already names the category: the row's own type badge would repeat it. */}
      {group.prize ? <PrizeRow prize={group.prize} typeLabel="" variant="status" defaultExpanded={false} /> : null}
      <div className={cn('flex flex-col gap-2', wide && !split && 'lg:col-span-2')}>
        <h3 className="t-caption text-muted">{C.winnersLabel}</h3>
        <ul className={cn('flex flex-col gap-2', wide && !split && 'lg:grid lg:grid-cols-2 xl:grid-cols-3')}>
          {group.winners.map((w, i) => (
            <li key={w.documentId || i}>
              <WinnerRow winner={w} index={i} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/**
 * fish WinnerRow: avatar 40 (the photo, else fish's guest picture for every winner without one —
 * a person on the neutral disc, named or not), the name on one line, a trophy on the first. The
 * row opens the angler's profile; an entry without a documentId has no link.
 */
function WinnerRow({ winner, index }: { winner: RaffleWinnerEntry; index: number }) {
  const name = winnerName(winner, index);
  const href = winner.documentId ? anglerHref(winner.documentId) : null;
  const body = (
    <>
      {winner.avatarUrl?.trim() ? (
        <Avatar name={name} src={winner.avatarUrl} size={40} />
      ) : (
        // fish's guest.png for every winner without a photo: a person on the neutral disc.
        <span data-testid="guest-avatar" aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface text-ink-2 shadow-e0">
          <UserIcon className="size-6" />
        </span>
      )}
      <span className="t-body-strong min-w-0 flex-1 truncate text-ink">{name}</span>
      {index === 0 ? (
        <>
          <TrophyIcon aria-hidden data-testid="winner-trophy" className="size-5 shrink-0 text-medal-gold" />
          <span className="sr-only">(primul extras)</span>
        </>
      ) : null}
    </>
  );
  const shape = 'flex min-h-15 items-center gap-3 rounded-control bg-soft-fill px-3 py-2.5';
  if (!href) return <div className={shape}>{body}</div>;
  return (
    <Link
      href={href}
      className={cn(
        shape,
        'transition-[background-color,opacity] duration-(--duration-fast) ease-fast hover:bg-shimmer active:opacity-70',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
      )}
    >
      {body}
    </Link>
  );
}

function LoadError({ retrying, onRetry }: { retrying: boolean; onRetry: () => void }) {
  return (
    <FlowLayout header={<Header />} labelledBy={TITLE_ID} variant="bare" narrow>
      <T4Gate
        tone="danger"
        role="alert"
        icon={<ExclamationTriangleIcon />}
        title="Nu am putut încărca câștigătorii"
        description="Verifică conexiunea și încearcă din nou."
        actions={
          <Button onClick={onRetry} disabled={retrying} aria-busy={retrying || undefined}>
            Încearcă din nou
          </Button>
        }
      />
    </FlowLayout>
  );
}

/**
 * Loading, and while the redirect home is on its way (rule 4: nothing that says «winners» or
 * «no winners» before the session is known): the header, a notice and two grey type cards.
 */
export function WinnersSkeleton() {
  const bar = 'block rounded-full bg-soft-fill animate-shimmer';
  return (
    <FlowLayout header={<Header />} labelledBy={TITLE_ID} variant="bare" busy notice={<FlowNoticeSkeleton />}>
      <FlowLoadingStatus />
      <div aria-hidden className={gridFor(2)}>
        {[0, 1].map((k) => (
          <div key={k} className={CARD}>
            <span className={cn(bar, 'h-7 w-36')} />
            <div className="flex items-center gap-3">
              <span className="size-14 shrink-0 rounded-avatar bg-soft-fill animate-shimmer" />
              <div className="flex flex-1 flex-col gap-2">
                <span className={cn(bar, 'h-3.5 w-2/3')} />
                <span className={cn(bar, 'h-3 w-1/2')} />
              </div>
            </div>
            <span className={cn(bar, 'h-3 w-20')} />
            {[0, 1].map((i) => (
              <span key={i} className="block h-15 rounded-control bg-soft-fill animate-shimmer" />
            ))}
          </div>
        ))}
      </div>
    </FlowLayout>
  );
}
