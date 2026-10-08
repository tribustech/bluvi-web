'use client';

import Link from 'next/link';
import { useEffect, useState, type KeyboardEvent, type Ref } from 'react';
import type { PollOption } from '@/core/competitions';
import { plural, Tag } from '@/components/cards';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { pendingIsDashed, pollPercent } from './model';

type Props = {
  option: PollOption;
  totalVotes: number;
  /** The viewer's vote (poll.myVoteOptionId). */
  myVote: number | null;
  /** This row is the pending selection (c7). */
  pending?: boolean;
  /** Voting closed: dimmed, no clicks (fish `disabled`, opacity .6). */
  closed?: boolean;
  /** A results row with no control at all (the past polls). */
  readOnly?: boolean;
  /** A guest: the row is a link to sign-in that comes back to the poll (c7). */
  signInHref?: string;
  onSelect?: (optionId: number) => void;
  /** The pending row's inline «Votează» / «Schimbă votul» (c8). */
  submitLabel?: string;
  onSubmit?: () => void;
  /** The row's control (focus goes back to it after a vote). */
  controlRef?: Ref<HTMLButtonElement>;
  /** Up / Down / Home / End between the option controls of one list (the list's handler). */
  onArrowKey?: (e: KeyboardEvent<HTMLElement>) => void;
};

/**
 * fish components/PollOption.tsx — one poll option, shared by /sondaje (vote), Acasă and the past
 * polls (readOnly). A 12px-radius row: optional «Sugerat de {name}» chip, the title (heading), an
 * optional description, and on the right «{p}%» over «{n} vot/voturi» (c6). My vote: a 2px indigo-4
 * border and a tint bar to its share that grows from 0 every time my vote changes (fish restarts it
 * on a vote change; reduced motion: no animation). Pending (c7): accent border, accent-tint-2 ground,
 * dashed unless it is already my vote; the share gives way to the inline submit (c8).
 *
 * The control is a real <button> (aria-pressed = my vote or pending while voting is open), the
 * submit its sibling — a button never sits inside a button. A guest's row is a link to sign-in. My
 * vote is also said in words («, votul tău», sr-only) whatever the mode: a read-only or closed row
 * is a result, not a toggle, so it carries no aria-pressed.
 */
export function PollOptionRow({
  option,
  totalVotes,
  myVote,
  pending = false,
  closed = false,
  readOnly = false,
  signInHref,
  onSelect,
  submitLabel,
  onSubmit,
  controlRef,
  onArrowKey,
}: Props) {
  const voted = myVote === option.id;
  const pct = pollPercent(option.votesCount, totalVotes);
  const strong = pending || voted;
  const showSubmit = pending && !!onSubmit && !readOnly;

  const body = (
    <>
      <span className="min-w-0 flex-1">
        {option.suggestedBy ? (
          <span className="mb-1 flex">
            <Tag tone="gray">Sugerat de {option.suggestedBy.name}</Tag>
          </span>
        ) : null}
        <span className={cn('block t-heading', strong ? 'text-accent-ink' : 'text-ink')}>{option.title}</span>
        {/* My vote in words, in every mode (read-only results and closed rows have no pressed state). */}
        {voted ? <span className="sr-only">, votul tău</span> : null}
        {/* ink-2, not muted: the vote's tint bar can sit under it (muted drops under 4.5:1 there). */}
        {option.description ? <span className="mt-1 block t-caption text-ink-2">{option.description}</span> : null}
      </span>
      {showSubmit ? null : (
        <span className="flex min-w-14 shrink-0 flex-col items-end">
          <span className={cn('t-heading tabular-nums', strong ? 'text-accent-ink' : 'text-ink')}>{pct}%</span>
          <span className="t-caption whitespace-nowrap text-ink-2">{plural(option.votesCount, 'vot', 'voturi')}</span>
        </span>
      )}
    </>
  );

  const pad = 'relative flex min-w-0 flex-1 items-center gap-3 p-3.5 text-left';

  return (
    <div
      data-poll-option={option.id}
      className={cn(
        'relative flex items-center overflow-hidden rounded-control border bg-surface',
        pending ? 'border-2 border-accent bg-accent-tint-2' : voted ? 'border-2 border-indigo-4' : 'border-hairline',
        pendingIsDashed(pending, voted) && 'border-dashed',
        // fish fades a closed poll's rows (opacity .6); .75 keeps every text pair above AA.
        closed && !readOnly && 'opacity-75',
      )}
    >
      {voted && !pending ? <FillBar key={myVote ?? 'none'} pct={pct} /> : null}
      {readOnly ? (
        <div className={pad}>{body}</div>
      ) : signInHref && !closed ? (
        <Link href={signInHref} onKeyDown={onArrowKey} data-poll-control className={cn(pad, 'hover:bg-soft-fill/60')}>
          {body}
          <span className="sr-only">, intră în cont ca să votezi</span>
        </Link>
      ) : (
        <button
          ref={controlRef}
          type="button"
          data-poll-control
          onClick={() => onSelect?.(option.id)}
          onKeyDown={onArrowKey}
          aria-disabled={closed || undefined}
          aria-pressed={closed ? undefined : strong}
          className={cn(pad, closed ? 'cursor-default' : 'cursor-pointer')}
        >
          {body}
        </button>
      )}
      {showSubmit ? (
        <Button size="compact" data-poll-submit onClick={onSubmit} className="relative mr-3.5 shrink-0">
          {submitLabel}
        </Button>
      ) : null}
    </div>
  );
}

/**
 * My vote's bar (fish Animated.View, indigo-2 → accent-tint-2): mounted at 0 and grown to the share
 * on the next frame. Its parent keys it by my vote, so a changed vote replays it from 0; a count
 * that moves under the same vote (a refetch) only eases to the new width.
 */
function FillBar({ pct }: { pct: number }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setWidth(pct));
    return () => cancelAnimationFrame(id);
  }, [pct]);
  return (
    <span
      aria-hidden
      data-poll-bar
      className="absolute inset-y-0 left-0 bg-accent-tint-2 transition-[width] duration-(--duration-slow) ease-slow motion-reduce:transition-none"
      style={{ width: `${width}%` }}
    />
  );
}
