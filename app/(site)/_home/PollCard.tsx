'use client';

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronRightIcon, ShareIcon } from '@heroicons/react/24/outline';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { currentPollQuery, pollVoteMutation, type Poll, type PollOption } from '@/core/competitions';
import { createBrowserTransport } from '@/lib/client/transport';
import { plural, Tag } from '@/components/cards';
import { IconButton } from '@/components/nav/IconButton';
import { DashboardSection } from '@/components/templates/T5';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { useSiteToast } from '../_shell/Toast';
import { announce, prepareAnnouncer } from './announce';
import { closesInLabel } from './format';
import { homeLinks } from './links';
import { pollShareText } from '../sondaje/_components/model';

const PREVIEW_OPTION_COUNT = 3;

/**
 * fish components/PollCard.tsx + PollOption.tsx — the current poll, for everyone (staging/prod grant
 * the Public role `/polls/current`; the local CMS does not, so locally guests see nothing). A guest's
 * option or suggest field is a link to sign-in that comes back to the poll (fish
 * `router.push('/sign-in', { redirectTo: '/polls/current' })`). Options sorted by votes; three shown, the third
 * faded, «Vezi toate opțiunile» expands. Tapping an option arms it; the inline «Votează» /
 * «Schimbă votul» on the row casts it (optimistic, core `pollVoteMutation`). A closed poll is a
 * results view, not a disabled one (web difference: fish fades it to 60%, which drops the option
 * names under AA): every option draws its share bar, the leader's stronger, and the footer says
 * «vot închis». The header carries fish's share button; the
 * «Sugerează o opțiune» row sits under the options while the poll is open and every option is
 * visible (fish `!votingClosed && (!canCollapse || expanded)`): fish's `onPressInsteadOfFocus`
 * preview, a link to /sondaje?focus=sugestie, where the field takes focus (home.acasa.c34).
 *
 * Keyboard: casting a vote unmounts the focused «Votează», so focus goes back to that option's own
 * toggle and the outcome is announced («Vot înregistrat.»; a failure — core rolls it back — is a
 * toast). The faded third row is a pointer shortcut only; «Vezi toate opțiunile» is the one
 * keyboard control, with aria-expanded on the list it controls.
 */
export function PollCard({ layout, signedIn }: { layout: 'mobile' | 'desktop'; signedIn: boolean }) {
  const t = useMemo(() => createBrowserTransport(), []);
  const qc = useQueryClient();
  const { data: poll } = useQuery(currentPollQuery(t));
  const vote = useMutation(pollVoteMutation(t, qc));
  const toast = useSiteToast();
  const [pending, setPending] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);
  const listId = useId();
  const toggles = useRef(new Map<number, HTMLButtonElement>());
  const refocus = useRef<number | null>(null);

  useEffect(() => prepareAnnouncer(), []);
  // After a vote the armed row's «Votează» is gone: put focus back on its option.
  useLayoutEffect(() => {
    if (pending !== null || refocus.current === null) return;
    toggles.current.get(refocus.current)?.focus();
    refocus.current = null;
  }, [pending]);

  if (!poll) return null;

  const canCollapse = poll.options.length > PREVIEW_OPTION_COUNT;
  const visible = canCollapse && !expanded ? poll.options.slice(0, PREVIEW_OPTION_COUNT) : poll.options;
  const submitLabel = poll.myVoteOptionId === null ? 'Votează' : 'Schimbă votul';
  const desktop = layout === 'desktop';
  const leaderVotes = Math.max(0, ...poll.options.map((o) => o.votesCount));

  const press = (optionId: number) => {
    if (poll.votingClosed) return;
    if (poll.myVoteOptionId === optionId && pending === null) return;
    setPending(pending === optionId ? null : optionId);
  };
  const submit = () => {
    if (pending === null) return;
    const optionId = pending;
    // Only when focus is on the «Votează» that is about to unmount (not after a pointer press).
    if (document.activeElement?.closest('[data-poll-submit]')) refocus.current = optionId;
    setPending(null);
    vote.mutate(
      { pollId: poll.documentId, optionId },
      {
        onSuccess: () => announce('Vot înregistrat.'),
        onError: () => toast('Votul nu a fost înregistrat. Încearcă din nou.', 'danger'),
      }
    );
  };

  return (
    // The plain T5 card, on the surface like every other card of the column (fish tints the poll's
    // ground; the web keeps the column's one surface / hairline rhythm — the share bars carry the tint).
    <DashboardSection variant="card" title={poll.title} action={<ShareButton title={poll.title} />}>
      <div className="flex flex-col gap-3">
      {poll.description ? <p className="t-body text-ink">{poll.description}</p> : null}

      <ul id={listId} className="flex flex-col gap-2">
        {visible.map((option, i) => {
          const faded = i === visible.length - 1 && canCollapse && !expanded;
          return (
            <li key={option.id} className="relative">
              <Option
                option={option}
                poll={poll}
                pending={pending === option.id}
                disabled={poll.votingClosed || faded}
                onPress={() => press(option.id)}
                toggleRef={(el) => {
                  if (el) toggles.current.set(option.id, el);
                  else toggles.current.delete(option.id);
                }}
                signInHref={signedIn ? undefined : homeLinks.pollSignIn}
                onSubmit={submit}
                submitLabel={submitLabel}
                compact={desktop}
                leader={poll.votingClosed && leaderVotes > 0 && option.votesCount === leaderVotes}
              />
              {faded ? (
                // A pointer shortcut over the faded row; the keyboard uses «Vezi toate opțiunile».
                <button
                  type="button"
                  tabIndex={-1}
                  aria-hidden
                  onClick={() => setExpanded(true)}
                  className="absolute inset-0 rounded-control bg-linear-to-b from-transparent from-30% to-surface"
                />
              ) : null}
            </li>
          );
        })}
      </ul>

      {!poll.votingClosed && (!canCollapse || expanded) ? (
        // fish PollSuggestInput `onPressInsteadOfFocus` (home.acasa.c34): a preview row that opens the
        // poll page with its suggestion field focused — for everyone (a guest meets the sign-in there).
        <Link
          href={homeLinks.pollSuggest}
          className="flex items-center gap-3 rounded-control border border-hairline bg-surface p-3.5 hover:border-accent"
        >
          <span className="min-w-0 flex-1">
            <span className="block t-heading text-ink-2">Sugerează o opțiune</span>
            <span className="mt-1 block t-body text-muted">Scrie ideea ta...</span>
          </span>
          <ChevronRightIcon aria-hidden className="size-5 shrink-0 text-muted" />
        </Link>
      ) : null}

      {canCollapse ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-controls={listId}
          className="inline-flex min-h-11 items-center self-center rounded-control t-body text-accent-ink hover:underline"
        >
          {expanded ? 'Restrânge' : 'Vezi toate opțiunile'}
        </button>
      ) : null}

      {desktop || poll.votingClosed ? <PollFooter poll={poll} /> : null}
      </div>
    </DashboardSection>
  );
}

function Option({
  option,
  poll,
  pending,
  disabled,
  onPress,
  toggleRef,
  signInHref,
  onSubmit,
  submitLabel,
  compact = false,
  leader = false,
}: {
  option: PollOption;
  poll: Poll;
  pending: boolean;
  disabled: boolean;
  onPress: () => void;
  /** The option's vote toggle, to give focus back to after a vote. */
  toggleRef: (el: HTMLButtonElement | null) => void;
  /** Guest: the option is a link to sign-in instead of a vote toggle. */
  signInHref?: string;
  onSubmit: () => void;
  submitLabel: string;
  /** The 264–320px «ce mă așteaptă» column: tighter rows, body-strong titles. */
  compact?: boolean;
  /** Closed poll: the option with the most votes (stronger bar and label). */
  leader?: boolean;
}) {
  const closed = poll.votingClosed;
  const voted = poll.myVoteOptionId === option.id;
  const pct = poll.totalVotes > 0 ? Math.round((option.votesCount / poll.totalVotes) * 100) : 0;
  const strong = pending || voted || leader;
  const body = (
    <>
      <span className="min-w-0 flex-1">
        {option.suggestedBy ? (
          <span className="mb-1 flex">
            <Tag tone="gray">Sugerat de {option.suggestedBy.name}</Tag>
          </span>
        ) : null}
        <span className={cn('block', compact ? 't-body-strong' : 't-heading', strong ? 'text-accent-ink' : closed ? 'text-ink' : 'text-ink-2')}>{option.title}</span>
        {/* ink-2, not muted: a bar (accent-tint-2 / -3) can sit under it, and muted is 4.0:1 there. */}
        {option.description ? <span className="mt-0.5 block t-caption text-ink-2">{option.description}</span> : null}
      </span>
      {pending ? null : (
        // The share is the row's signature: ink (accent ink on the vote / the leader), the count
        // under it in ink-2 — muted drops under 4.5:1 on the bars' tint.
        <span className="flex min-w-12 flex-col items-end">
          <span className={cn('tabular-nums', compact ? 't-body-strong' : 't-heading', strong ? 'text-accent-ink' : 'text-ink')}>{pct}%</span>
          <span className="t-caption text-ink-2">
            {option.votesCount} {option.votesCount === 1 ? 'vot' : 'voturi'}
          </span>
        </span>
      )}
    </>
  );
  return (
    <div
      className={cn(
        'relative flex items-center gap-3 overflow-hidden rounded-control border bg-surface',
        pending ? 'border-2 border-accent bg-accent-tint-2' : voted ? 'border-2 border-indigo-4' : 'border-hairline',
        pending && !voted && 'border-dashed'
      )}
    >
      {/* The share bar: on the viewer's vote while open, on every option once closed. Every bar
          is accent-tint-2 (accent-tint is a near-white on the white row); the leader's a step
          stronger, accent-tint-3 (ink, ink-2 and accent ink stay above 4.5:1 on both, in both themes). */}
      {voted || closed ? (
        <span
          aria-hidden
          className={cn(
            'absolute inset-y-0 left-0 transition-[width] duration-(--duration-slow) ease-slow',
            leader ? 'bg-accent-tint-3' : 'bg-accent-tint-2'
          )}
          style={{ width: `${pct}%` }}
        />
      ) : null}
      {signInHref && !poll.votingClosed ? (
        <Link
          href={signInHref}
          tabIndex={disabled ? -1 : undefined}
          className={cn('relative flex min-w-0 flex-1 items-center gap-3 text-left', compact ? 'px-3 py-2.5' : 'p-3.5')}
        >
          {body}
          <span className="sr-only">, intră în cont ca să votezi</span>
        </Link>
      ) : (
        <button
          ref={toggleRef}
          type="button"
          onClick={onPress}
          disabled={disabled}
          aria-pressed={pending || voted}
          className={cn('relative flex min-w-0 flex-1 items-center gap-3 text-left disabled:cursor-default', compact ? 'px-3 py-2.5' : 'p-3.5')}
        >
          {body}
        </button>
      )}
      {pending ? (
        <Button size="compact" data-poll-submit onClick={onSubmit} className={cn('relative', compact ? 'mr-3' : 'mr-3.5')}>
          {submitLabel}
        </Button>
      ) : null}
    </div>
  );
}

/**
 * fish ShareButton + helpers/sharePoll: the poll page's link (fish `/polls/current`,
 * web /sondaje). The kit icon button (48 / 40 from 1280, the 24 outline glyph), plain on the
 * surface card; -my-3 / -my-2 keep the heading row at its text height. No emoji in the shared text
 * (Fundații: no emoji; fish opens it with a ballot-box emoji — web difference). No share sheet (desktop
 * browsers): the link is copied instead.
 */
function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 2500);
    return () => clearTimeout(id);
  }, [copied]);

  const share = async () => {
    const url = `${window.location.origin}${homeLinks.polls}`;
    const text = pollShareText(title);
    try {
      if (navigator.share) {
        await navigator.share({ title, text, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // Share sheet dismissed or clipboard refused: nothing to report (fish: silent).
    }
  };

  return (
    <div className="relative -my-3 flex shrink-0 items-center xl:-my-2">
      <span
        role="status"
        className={cn('absolute right-full mr-2 whitespace-nowrap rounded-badge bg-surface px-1.5 py-0.5 t-caption text-accent-ink shadow-e0', !copied && 'sr-only')}
      >
        {copied ? 'Linkul a fost copiat.' : ''}
      </span>
      <IconButton onClick={share} aria-label="Distribuie sondajul" title="Distribuie sondajul">
        <ShareIcon aria-hidden />
      </IconButton>
    </div>
  );
}

/** Design-only (desktop poll): «412 voturi · se închide în 3 zile». fish has no footer. */
function PollFooter({ poll }: { poll: Poll }) {
  const closes = poll.votingClosed ? 'vot închis' : closesInLabel(poll.closesAt);
  return (
    <p className="t-caption text-ink-2" suppressHydrationWarning>
      {plural(poll.totalVotes, 'vot', 'voturi')}
      {closes ? ` · ${closes}` : null}
    </p>
  );
}
