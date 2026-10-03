'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import Link from 'next/link';
import { ShareIcon } from '@heroicons/react/24/outline';
import { CheckCircleIcon } from '@heroicons/react/24/solid';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { currentPollQuery, pollSuggestMutation, pollVoteMutation, type Poll, type PollOption } from '@/core/competitions';
import { createBrowserTransport } from '@/lib/client/transport';
import { plural } from '@/components/cards';
import { ResponsiveSurface } from '@/components/surfaces/ResponsiveSurface';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { closesInLabel } from './format';
import { homeLinks } from './links';

const PREVIEW_OPTION_COUNT = 3;

/**
 * fish components/PollCard.tsx + PollOption.tsx — the current poll, for everyone (staging/prod grant
 * the Public role `/polls/current`; the local CMS does not, so locally guests see nothing). A guest's
 * option or suggest field is a link to sign-in that comes back to the poll (fish
 * `router.push('/sign-in', { redirectTo: '/polls/current' })`). Options sorted by votes; three shown, the third
 * faded, «Vezi toate opțiunile» expands. Tapping an option arms it; the inline «Votează» /
 * «Schimbă votul» on the row casts it (optimistic, core `pollVoteMutation`). Closed polls are read
 * only (options at 60%, fish PollOption `disabled`). The header carries fish's share button; the
 * «Sugerează o opțiune» field sits under the options while the poll is open and every option is
 * visible (fish `!votingClosed && (!canCollapse || expanded)`). It is a real field here: the web
 * has no full-screen poll page to send the tap to (fish `onPressInsteadOfFocus`).
 */
export function PollCard({ layout, signedIn }: { layout: 'mobile' | 'desktop'; signedIn: boolean }) {
  const t = useMemo(() => createBrowserTransport(), []);
  const qc = useQueryClient();
  const { data: poll } = useQuery(currentPollQuery(t));
  const vote = useMutation(pollVoteMutation(t, qc));
  const [pending, setPending] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);

  if (!poll) return null;

  const canCollapse = poll.options.length > PREVIEW_OPTION_COUNT;
  const visible = canCollapse && !expanded ? poll.options.slice(0, PREVIEW_OPTION_COUNT) : poll.options;
  const submitLabel = poll.myVoteOptionId === null ? 'Votează' : 'Schimbă votul';
  const desktop = layout === 'desktop';
  const id = `acasa-sondaj-${layout}`;

  const press = (optionId: number) => {
    if (poll.votingClosed) return;
    if (poll.myVoteOptionId === optionId && pending === null) return;
    setPending(pending === optionId ? null : optionId);
  };
  const submit = () => {
    if (pending === null) return;
    const optionId = pending;
    setPending(null);
    vote.mutate({ pollId: poll.documentId, optionId });
  };

  return (
    <section aria-labelledby={id} className={cn('flex flex-col rounded-card bg-accent-tint', desktop ? 'gap-2.5 p-3.5' : 'gap-3 p-4')}>
      <div className="flex items-center gap-2">
        <h2 id={id} className="min-w-0 flex-1 t-heading text-ink-2">
          {poll.title}
        </h2>
        <ShareButton title={poll.title} />
      </div>
      {poll.description ? <p className="t-body text-ink">{poll.description}</p> : null}

      <ul className="flex flex-col gap-2">
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
                signInHref={signedIn ? undefined : homeLinks.pollSignIn}
                onSubmit={submit}
                submitLabel={submitLabel}
              />
              {faded ? (
                <button
                  type="button"
                  onClick={() => setExpanded(true)}
                  aria-label="Vezi toate opțiunile"
                  className="absolute inset-0 rounded-[12px] bg-linear-to-b from-transparent from-30% to-accent-tint"
                />
              ) : null}
            </li>
          );
        })}
      </ul>

      {!poll.votingClosed && (!canCollapse || expanded) ? (
        signedIn ? (
          <SuggestField pollId={poll.documentId} />
        ) : (
          <Link
            href={homeLinks.pollSignIn}
            className="flex items-center gap-3 rounded-[12px] border border-hairline bg-surface p-3.5 hover:border-accent"
          >
            <span className="min-w-0 flex-1">
              <span className="block t-heading text-ink-2">Sugerează o opțiune</span>
              <span className="mt-1 block t-body text-muted">Intră în cont ca să trimiți ideea ta</span>
            </span>
            <span className="shrink-0 rounded-md bg-accent px-3 py-1.5 t-caption text-on-accent">Trimite</span>
          </Link>
        )
      ) : null}

      {canCollapse ? (
        <button type="button" onClick={() => setExpanded((v) => !v)} className="self-center py-1 t-body text-accent-ink hover:underline">
          {expanded ? 'Restrânge' : 'Vezi toate opțiunile'}
        </button>
      ) : null}

      {desktop ? <PollFooter poll={poll} /> : null}
    </section>
  );
}

function Option({
  option,
  poll,
  pending,
  disabled,
  onPress,
  signInHref,
  onSubmit,
  submitLabel,
}: {
  option: PollOption;
  poll: Poll;
  pending: boolean;
  disabled: boolean;
  onPress: () => void;
  /** Guest: the option is a link to sign-in instead of a vote toggle. */
  signInHref?: string;
  onSubmit: () => void;
  submitLabel: string;
}) {
  const voted = poll.myVoteOptionId === option.id;
  const pct = poll.totalVotes > 0 ? Math.round((option.votesCount / poll.totalVotes) * 100) : 0;
  const strong = pending || voted;
  const body = (
    <>
      <span className="min-w-0 flex-1">
        {option.suggestedBy ? (
          <span className="mb-1 inline-block rounded-lg bg-soft-fill px-2 py-0.5 t-caption text-ink-2">Sugerat de {option.suggestedBy.name}</span>
        ) : null}
        <span className={cn('block t-heading', strong ? 'text-accent-ink' : 'text-ink-2')}>{option.title}</span>
        {option.description ? <span className="mt-1 block t-caption text-muted">{option.description}</span> : null}
      </span>
      {pending ? null : (
        <span className="flex min-w-14 flex-col items-end">
          <span className={cn('t-heading tabular-nums', strong ? 'text-accent-ink' : 'text-ink-2')}>{pct}%</span>
          <span className="t-caption text-muted">
            {option.votesCount} {option.votesCount === 1 ? 'vot' : 'voturi'}
          </span>
        </span>
      )}
    </>
  );
  return (
    <div
      className={cn(
        'relative flex items-center gap-3 overflow-hidden rounded-[12px] border bg-surface',
        pending ? 'border-2 border-accent bg-accent-tint-2' : voted ? 'border-2 border-indigo-4' : 'border-hairline',
        pending && !voted && 'border-dashed',
        poll.votingClosed && 'opacity-60'
      )}
    >
      {voted ? (
        <span aria-hidden className="absolute inset-y-0 left-0 bg-accent-tint-2 transition-[width] duration-(--duration-slow) ease-slow" style={{ width: `${pct}%` }} />
      ) : null}
      {signInHref && !poll.votingClosed ? (
        <Link
          href={signInHref}
          tabIndex={disabled ? -1 : undefined}
          className="relative flex min-w-0 flex-1 items-center gap-3 p-3.5 text-left"
        >
          {body}
          <span className="sr-only">, intră în cont ca să votezi</span>
        </Link>
      ) : (
        <button
          type="button"
          onClick={onPress}
          disabled={disabled}
          aria-pressed={pending || voted}
          className="relative flex min-w-0 flex-1 items-center gap-3 p-3.5 text-left disabled:cursor-default"
        >
          {body}
        </button>
      )}
      {pending ? (
        <button type="button" onClick={onSubmit} className="relative mr-3.5 shrink-0 rounded-md bg-accent px-2.5 py-1.5 t-caption text-on-accent">
          {submitLabel}
        </button>
      ) : null}
    </div>
  );
}

/**
 * fish ShareButton `on="tinted"` (36px, radius 12, indigo-2 chip, 19px icon) + helpers/sharePoll.
 * fish shares `/polls/current`; the web has no poll page yet, so the link is Acasă, where the poll
 * lives here. No share sheet (desktop browsers): the link is copied instead.
 */
function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 2500);
    return () => clearTimeout(id);
  }, [copied]);

  const share = async () => {
    const url = `${window.location.origin}/`;
    const text = `Votează în sondajul comunității Bluvi:\n\n${title}`;
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
    <div className="relative flex shrink-0 items-center">
      <span role="status" className={cn('absolute right-11 whitespace-nowrap rounded-md bg-accent-tint px-1.5 py-0.5 t-caption text-accent-ink', !copied && 'sr-only')}>
        {copied ? 'Linkul a fost copiat.' : ''}
      </span>
      <button
        type="button"
        onClick={share}
        aria-label="Distribuie sondajul"
        title="Distribuie sondajul"
        className="flex size-9 items-center justify-center rounded-[12px] bg-accent-tint-2 text-ink transition-opacity duration-(--duration-fast) ease-fast hover:opacity-80"
      >
        <ShareIcon aria-hidden className="size-[19px] stroke-2" />
      </button>
    </div>
  );
}

const SUGGEST_MIN = 3;
const SUGGEST_MAX = 200;

/** fish PollSuggestInput: an option-shaped row with a multi-line field and a «Trimite» pill. */
function SuggestField({ pollId }: { pollId: string }) {
  const t = useMemo(() => createBrowserTransport(), []);
  const suggest = useMutation(pollSuggestMutation(t));
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const fieldId = useId();
  const errorId = `${fieldId}-error`;
  const trimmed = text.trim();
  const canSubmit = !suggest.isPending && trimmed.length >= SUGGEST_MIN && trimmed.length <= SUGGEST_MAX;

  const submit = async () => {
    if (!canSubmit) return;
    setError(null);
    try {
      await suggest.mutateAsync({ pollId, text: trimmed });
      setText('');
      setSent(true);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'Nu am putut trimite sugestia.');
    }
  };

  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="flex items-center gap-3 rounded-[12px] border border-hairline bg-surface p-3.5 focus-within:border-accent"
      >
        <div className="min-w-0 flex-1">
          <label htmlFor={fieldId} className="block t-heading text-ink-2">
            Sugerează o opțiune
          </label>
          <textarea
            id={fieldId}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void submit();
              }
            }}
            placeholder="Scrie ideea ta..."
            maxLength={SUGGEST_MAX}
            rows={1}
            disabled={suggest.isPending}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            className="mt-1 block w-full resize-none bg-transparent t-body text-ink-2 outline-none [field-sizing:content] placeholder:text-muted"
          />
          {error ? (
            <p id={errorId} role="alert" className="mt-1 t-caption text-status-danger-fg">
              {error}
            </p>
          ) : null}
        </div>
        <button
          type="submit"
          disabled={!canSubmit}
          className={cn(
            'shrink-0 rounded-md px-3 py-1.5 t-caption',
            canSubmit ? 'bg-accent text-on-accent' : 'cursor-not-allowed bg-accent-disabled text-on-accent-disabled'
          )}
        >
          Trimite
        </button>
      </form>
      <ResponsiveSurface
        open={sent}
        onClose={() => setSent(false)}
        intent="decision"
        title="Sugestie trimisă!"
        actions={
          <Button block onClick={() => setSent(false)}>
            Am înțeles
          </Button>
        }
      >
        <p className="flex items-start gap-2.5 t-body text-ink-2">
          <CheckCircleIcon aria-hidden className="size-7 shrink-0 text-success" />
          Sugestia ta a fost trimisă spre verificare. Dacă este aprobată, va fi adăugată ca opțiune în sondaj și vei primi o
          notificare.
        </p>
      </ResponsiveSurface>
    </>
  );
}

/** Design-only (desktop poll): «412 voturi · se închide în 3 zile». fish has no footer. */
function PollFooter({ poll }: { poll: Poll }) {
  const closes = poll.votingClosed ? 'vot închis' : closesInLabel(poll.closesAt);
  return (
    <p className="t-caption text-muted" suppressHydrationWarning>
      {plural(poll.totalVotes, 'vot', 'voturi')}
      {closes ? ` · ${closes}` : null}
    </p>
  );
}
