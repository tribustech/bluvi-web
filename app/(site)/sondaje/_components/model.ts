/*
 * The current poll's pure rules (parity participant.poll-current), shared by /sondaje, Acasă's poll
 * card and (read-only) the past polls. fish: app/(app)/polls/current.tsx, components/PollOption.tsx,
 * components/PollSuggestInput.tsx, helpers/sharePoll.ts. No React, no DOM: unit-tested in model.test.ts.
 */

/** The page's title (fish's header «Sondaj»). */
export const POLL_TITLE = 'Sondaj';

/** fish PollSuggestInput MIN_LEN / MAX_LEN (trimmed characters). */
export const SUGGEST_MIN = 3;
export const SUGGEST_MAX = 200;

/**
 * Whether /sondaje/anterioare (participant.polls-past) is live. Until it ships, every «Sondaje anterioare»
 * entry point (header chip, aside card, the empty state's button) is hidden (rule 4: never link what
 * we cannot open) and fish's /polls/past redirects TEMPORARILY to /sondaje (next.config.ts). The
 * polls-past screen flips this to true, which also turns the redirect into the permanent
 * /polls/past → /sondaje/anterioare.
 */
export const POLLS_PAST_ON_WEB = false;

/** The web's `?focus=` value that focuses the suggestion field (fish `?focus=suggest`). */
export const FOCUS_SUGGEST = 'sugestie';

/** fish PollOption: rounded share of the votes, 0 when nobody voted. */
export function pollPercent(votes: number, total: number): number {
  return total > 0 ? Math.round((votes / total) * 100) : 0;
}

export type OptionPress =
  /** Nothing happens (closed poll, or my current vote with nothing pending). */
  | { kind: 'none' }
  /** A guest: sign in, then come back to the poll. */
  | { kind: 'sign-in' }
  /** The new pending selection (null = deselected). */
  | { kind: 'pending'; pending: number | null };

/** fish current.tsx handleOptionPress (c7), in its order. */
export function pressOption({
  optionId,
  closed,
  signedIn,
  myVote,
  pending,
}: {
  optionId: number;
  closed: boolean;
  signedIn: boolean;
  myVote: number | null;
  pending: number | null;
}): OptionPress {
  if (closed) return { kind: 'none' };
  if (!signedIn) return { kind: 'sign-in' };
  if (myVote === optionId && pending === null) return { kind: 'none' };
  if (pending === optionId) return { kind: 'pending', pending: null };
  return { kind: 'pending', pending: optionId };
}

/** The pending row's inline button (c8): a first vote or a change. */
export const submitLabel = (myVote: number | null) => (myVote === null ? 'Votează' : 'Schimbă votul');

/**
 * fish PollOption `isPendingSwitch = isPending && !isVoted`: the pending row is dashed unless it is
 * already my vote (fish draws it on a first vote too — its code, not its comment).
 */
export const pendingIsDashed = (pending: boolean, voted: boolean) => pending && !voted;

/** fish usePollVote: `poll_vote_change` when it moves an existing vote elsewhere, else `poll_vote`. */
export function voteEvent(myVote: number | null, optionId: number): 'poll_vote' | 'poll_vote_change' {
  return myVote !== null && myVote !== optionId ? 'poll_vote_change' : 'poll_vote';
}

/** fish PollSuggestInput canSubmit (signed in): 3–200 trimmed characters, not while sending. */
export function canSuggest(text: string, sending: boolean): boolean {
  const n = text.trim().length;
  return !sending && n >= SUGGEST_MIN && n <= SUGGEST_MAX;
}

/**
 * fish helpers/sharePoll.ts. The web drops fish's leading ballot-box emoji (Fundații: no emoji —
 * the decision recorded on home.acasa.c35, kept identical here so both share buttons say the same).
 */
export function pollShareText(title: string): string {
  return `Votează în sondajul comunității Bluvi:\n\n${title}`;
}
