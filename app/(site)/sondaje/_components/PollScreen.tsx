'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent, type MouseEvent } from 'react';
import { ChartBarIcon, ChevronLeftIcon, ChevronRightIcon, ClockIcon, ExclamationTriangleIcon, ShareIcon } from '@heroicons/react/24/outline';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { currentPollQuery, pollVoteMutation, type Poll } from '@/core/competitions';
import { plural } from '@/components/cards';
import { FlowHeader, FlowLayout, FlowLoadingStatus } from '@/components/templates/T6';
import { T4Gate } from '@/components/templates/T4';
import { headerChipClass } from '@/components/templates/T3/DetailHeader';
import { Button, ButtonLink } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { track } from '@/lib/analytics';
import { canGoBackInApp } from '@/lib/client/in-app-history';
import { createBrowserTransport } from '@/lib/client/transport';
import { routes } from '@/lib/routes';
import { useSiteToast } from '../../_shell/Toast';
import { isUnknownViewer, userOf, useViewerState } from '../../_shell/viewer-context';
import { announce, prepareAnnouncer } from '../../_home/announce';
import { closesInLabel } from '../../_home/format';
import { FOCUS_SUGGEST, POLL_TITLE, POLLS_PAST_ON_WEB, pressOption, submitLabel, voteEvent } from './model';
import { PollOptionRow } from './PollOptionRow';
import { sharePoll } from './sharePoll';
import { SuggestInput } from './SuggestInput';

const TITLE_ID = 'sondaj-title';
const POLL_HEADING_ID = 'sondaj-poll-title';
const SIGN_IN = routes.signIn(routes.polls());

/**
 * /sondaje on T6 — fish app/(app)/polls/current.tsx (parity participant.poll-current).
 *
 * The shell is static (the page's metadata, the header); the poll is read in the browser through
 * /api/cms (`GET /polls/current` is personalised — myVoteOptionId — when signed in; core
 * currentPollQuery: stale after 10 s, refetched on focus, no polling, c13).
 *
 * Geometry. Below 768: fish's white screen — the header, then the poll as a flush white section
 * that fills the screen to the bottom (fish current.tsx YStack white flex=1): title, description,
 * the facts line, the options and the «Sugerează o opțiune» row; «Sondaje anterioare» and share are
 * the header's chips (c1). 768–1023: the same as a card on the page ground, full column width. From
 * 1024: the FlowHeader's column (same max width and left edge as the header) split into the poll
 * (fluid) and a 360 aside: the suggestion form as its own card, a «Sondaje anterioare» link card and
 * a share card; the header keeps back and title only. The header's chips are a viewport decision
 * (CSS, hidden from 1024), never a data one, so loading → loaded never adds or drops a chip; the
 * skeleton has the loaded geometry (poll column + grey aside cards). Nothing sticks (owner rule 3).
 * «Sondaje anterioare» shows only once that page exists (POLLS_PAST_ON_WEB, rule 4).
 */
export function PollScreen() {
  const t = useMemo(() => createBrowserTransport(), []);
  const query = useQuery(currentPollQuery(t));
  const poll = query.data;
  const wide = useWide();
  const gate = !query.isPending && !poll;

  return (
    <FlowLayout header={<PollHeader poll={poll ?? null} />} labelledBy={TITLE_ID} variant="bare" busy={query.isPending} narrow={gate} fill={!gate}>
      {query.isPending ? (
        <PollSkeleton />
      ) : poll ? (
        // The viewer read suspends; until it answers the options are the skeleton's (rule 4).
        <Suspense fallback={<PollSkeleton />}>
          <PollBody poll={poll} wide={wide} />
        </Suspense>
      ) : poll === null ? (
        <T4Gate
          icon={<ChartBarIcon />}
          title="Niciun sondaj activ"
          description="Revino mai târziu pentru următorul sondaj al comunității."
          actions={
            POLLS_PAST_ON_WEB ? (
              <ButtonLink href={routes.pollsPast()} variant="outline">
                Vezi sondajele anterioare
              </ButtonLink>
            ) : undefined
          }
        />
      ) : (
        <T4Gate
          tone="danger"
          role="alert"
          icon={<ExclamationTriangleIcon />}
          title="Nu am putut încărca sondajul"
          description="Verifică conexiunea și încearcă din nou."
          actions={
            <Button onClick={() => void query.refetch()} disabled={query.isFetching} aria-busy={query.isFetching || undefined}>
              Reîncearcă
            </Button>
          }
        />
      )}
    </FlowLayout>
  );
}

/** The route's loading.tsx: the same header, the poll card in grey. */
export function PollScreenLoading() {
  return (
    <FlowLayout header={<PollHeader poll={null} />} labelledBy={TITLE_ID} variant="bare" busy fill>
      <PollSkeleton />
    </FlowLayout>
  );
}

/* ------------------------------------------------------------------ */
/* Header                                                              */
/* ------------------------------------------------------------------ */

/**
 * c1: back (fish goBackOrHome: history back when the page before is ours, else Acasă — a replace,
 * so a shared link's Back does not land on the poll again), «Sondaj», then «Sondaje anterioare» and
 * «Distribuie sondajul» (only with a poll) as the header's chips below 1024 — from 1024 the aside
 * carries both, so the chips are hidden by CSS (the viewport decides, not the data).
 */
function PollHeader({ poll }: { poll: Poll | null }) {
  const past = POLLS_PAST_ON_WEB ? (
    <Link href={routes.pollsPast()} aria-label="Sondaje anterioare" title="Sondaje anterioare" className={headerChipClass()}>
      <ClockIcon aria-hidden />
    </Link>
  ) : null;
  const share = poll ? <ShareChip title={poll.title} /> : null;
  return (
    <FlowHeader
      title={POLL_TITLE}
      id={TITLE_ID}
      backPlaceholder={<BackChip />}
      trailing={
        past || share ? (
          <span className="contents lg:hidden">
            {past}
            {share}
          </span>
        ) : undefined
      }
    />
  );
}

function BackChip() {
  const router = useRouter();
  const href = routes.home();
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    if (canGoBackInApp()) router.back();
    else router.replace(href);
  };
  return (
    <Link href={href} onClick={onClick} aria-label="Înapoi" className={headerChipClass()}>
      <ChevronLeftIcon aria-hidden />
    </Link>
  );
}

function useShare(title: string) {
  const toast = useSiteToast();
  return async () => {
    const outcome = await sharePoll({ title });
    if (outcome === 'copied') toast('Linkul a fost copiat.');
  };
}

function ShareChip({ title }: { title: string }) {
  const share = useShare(title);
  return (
    <button type="button" onClick={() => void share()} aria-label="Distribuie sondajul" title="Distribuie sondajul" className={headerChipClass()}>
      <ShareIcon aria-hidden />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Body                                                                */
/* ------------------------------------------------------------------ */

/**
 * The page's grid, on the FlowHeader's column (FlowLayout's SHELL_MAX and gutters, so header and
 * body share one left edge at every width): one column below 1024, then the poll (fluid) + a 360 aside.
 */
const GRID = 'flex flex-col max-md:flex-1 lg:grid lg:grid-cols-[minmax(0,1fr)_22.5rem] lg:items-start lg:gap-6';
/**
 * Phone: flush white from the header to the bottom of the screen (the bare layout's 16px ground
 * strips and gutter undone, and the section grows to fill the rest — fish's white screen).
 */
const CARD = '-mx-4 -mt-4 -mb-4 flex min-w-0 flex-col gap-4 bg-surface px-4 py-5 max-md:flex-1 md:m-0 md:rounded-card md:p-5 md:shadow-e0 xl:p-6';

function PollBody({ poll, wide }: { poll: Poll; wide: boolean }) {
  const viewer = useViewerState();
  const unknown = isUnknownViewer(viewer);
  const signedIn = userOf(viewer) !== null;
  const t = useMemo(() => createBrowserTransport(), []);
  const qc = useQueryClient();
  const vote = useMutation(pollVoteMutation(t, qc));
  const toast = useSiteToast();
  const router = useRouter();
  const focusSuggest = useSearchParams().get('focus') === FOCUS_SUGGEST;
  const [pending, setPending] = useState<number | null>(null);
  const controls = useRef(new Map<number, HTMLButtonElement>());
  const refocus = useRef<number | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  usePollView(poll);
  useEffect(() => prepareAnnouncer(), []);
  // After a vote the pending row's «Votează» is gone: focus goes back to that option.
  useLayoutEffect(() => {
    if (pending !== null || refocus.current === null) return;
    controls.current.get(refocus.current)?.focus();
    refocus.current = null;
  }, [pending]);

  const closed = poll.votingClosed;
  // Unknown session (rule 4): results only — never a guest's sign-in link for someone signed in.
  const readOnly = unknown;
  const guestHref = !signedIn && !unknown ? SIGN_IN : undefined;

  const select = (optionId: number) => {
    const r = pressOption({
      optionId,
      closed,
      signedIn,
      myVote: poll.myVoteOptionId,
      pending,
    });
    if (r.kind === 'sign-in') router.push(SIGN_IN);
    else if (r.kind === 'pending') setPending(r.pending);
  };

  const submit = () => {
    if (pending === null) return;
    const optionId = pending;
    if (document.activeElement?.closest('[data-poll-submit]')) refocus.current = optionId;
    setPending(null);
    // fish usePollVote onMutate (c15) — from the cache the optimistic update starts from.
    track(voteEvent(poll.myVoteOptionId, optionId), {
      poll_document_id: poll.documentId,
      option_id: optionId,
    });
    vote.mutate(
      { pollId: poll.documentId, optionId },
      {
        onSuccess: () => announce('Vot înregistrat.'),
        onError: () => toast('Votul nu a fost înregistrat. Încearcă din nou.', 'danger'),
      },
    );
  };

  // Up / Down / Home / End between the options (each is also a Tab stop).
  const onArrowKey = useCallback((e: KeyboardEvent<HTMLElement>) => {
    const keys = ['ArrowDown', 'ArrowUp', 'Home', 'End'];
    if (!keys.includes(e.key)) return;
    const all = Array.from(listRef.current?.querySelectorAll<HTMLElement>('[data-poll-control]') ?? []);
    const i = all.indexOf(e.currentTarget);
    if (i < 0 || all.length === 0) return;
    e.preventDefault();
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? all.length - 1 : (i + (e.key === 'ArrowDown' ? 1 : -1) + all.length) % all.length;
    all[next]?.focus();
  }, []);

  const closes = closed ? 'Vot închis' : closesInLabel(poll.closesAt);
  const suggest = !closed && !unknown ? <SuggestInput key={poll.documentId} pollId={poll.documentId} signInHref={guestHref} autoFocus={focusSuggest} /> : null;

  return (
    <div className={GRID}>
      <section aria-labelledby={POLL_HEADING_ID} className={CARD}>
        <div className="flex flex-col gap-2">
          <h2 id={POLL_HEADING_ID} className="t-title1 text-ink">
            {poll.title}
          </h2>
          {poll.description ? <p className="t-body text-ink-2">{poll.description}</p> : null}
          <p className="t-caption text-muted">
            {plural(poll.totalVotes, 'vot', 'voturi')}
            {closes ? ` · ${closes}` : null}
          </p>
        </div>
        <ul ref={listRef} aria-label="Opțiuni" className="flex flex-col gap-2">
          {poll.options.map((option) => (
            <li key={option.id}>
              <PollOptionRow
                option={option}
                totalVotes={poll.totalVotes}
                myVote={poll.myVoteOptionId}
                pending={pending === option.id}
                closed={closed}
                readOnly={readOnly}
                signInHref={guestHref}
                onSelect={select}
                submitLabel={submitLabel(poll.myVoteOptionId)}
                onSubmit={submit}
                onArrowKey={onArrowKey}
                controlRef={(el) => {
                  if (el) controls.current.set(option.id, el);
                  else controls.current.delete(option.id);
                }}
              />
            </li>
          ))}
        </ul>
        {wide ? null : suggest}
      </section>
      {wide ? (
        <aside aria-label="Despre sondaj" className="flex min-w-0 flex-col gap-4">
          {suggest}
          {POLLS_PAST_ON_WEB ? (
            <Link
              href={routes.pollsPast()}
              className="group flex items-center gap-3 rounded-card bg-surface p-5 shadow-e0 xl:p-6 transition-[background-color] duration-(--duration-fast) ease-fast hover:bg-soft-fill"
            >
              <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-tint text-accent-ink [&>svg]:size-5">
                <ClockIcon />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block t-heading text-ink">Sondaje anterioare</span>
                <span className="block t-caption text-muted">Rezultatele finale ale sondajelor închise</span>
              </span>
              <ChevronRightIcon aria-hidden className="size-5 shrink-0 text-muted" />
            </Link>
          ) : null}
          <ShareCard title={poll.title} />
        </aside>
      ) : null}
    </div>
  );
}

function ShareCard({ title }: { title: string }) {
  const share = useShare(title);
  return (
    <div className="flex flex-col gap-3 rounded-card bg-surface p-5 shadow-e0 xl:p-6">
      <p className="t-body text-ink-2">Mai mulți votanți, un rezultat mai bun. Trimite sondajul prietenilor.</p>
      <Button variant="outline" block icon={<ShareIcon />} onClick={() => void share()}>
        Distribuie sondajul
      </Button>
    </div>
  );
}

/** fish: poll_view once per poll seen on this screen (c15). */
function usePollView(poll: Poll) {
  const seen = useRef(new Set<string>());
  useEffect(() => {
    if (seen.current.has(poll.documentId)) return;
    seen.current.add(poll.documentId);
    track('poll_view', {
      poll_document_id: poll.documentId,
      voting_closed: poll.votingClosed,
      has_voted: poll.myVoteOptionId !== null,
    });
  }, [poll.documentId, poll.votingClosed, poll.myVoteOptionId]);
}

/** ≥1024: the two-column layout. Read in the browser only (the poll itself is browser-only data). */
function useWide(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia('(min-width: 64rem)');
      mq.addEventListener('change', cb);
      return () => mq.removeEventListener('change', cb);
    },
    () => window.matchMedia('(min-width: 64rem)').matches,
    () => false,
  );
}

/* ------------------------------------------------------------------ */
/* Loading                                                             */
/* ------------------------------------------------------------------ */

const BAR = 'inline-block max-w-full rounded-full bg-soft-fill animate-shimmer align-middle';

/**
 * c2: the header stays, the poll card in grey, «Se încarcă...» announced (and shown). The loaded
 * geometry at every width: from 1024 the same two tracks, the aside as grey cards (CSS, so the
 * route's loading.tsx matches too).
 */
function PollSkeleton() {
  return (
    <div className={GRID}>
      <div data-poll-skeleton className={CARD}>
        <FlowLoadingStatus label="Se încarcă..." />
        <div aria-hidden className="flex flex-col gap-2">
          <p className="t-title1">
            <span className={cn(BAR, 'h-6 w-72')} />
          </p>
          <p className="t-caption">
            <span className={cn(BAR, 'h-2.5 w-32')} />
          </p>
        </div>
        <div aria-hidden className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <span key={i} className="block h-17 rounded-control border border-hairline bg-soft-fill animate-shimmer" />
          ))}
        </div>
        <p aria-hidden className="t-body text-center text-muted">
          Se încarcă...
        </p>
      </div>
      <div aria-hidden data-poll-skeleton-aside className="hidden min-w-0 flex-col gap-4 lg:flex">
        <span className="block h-44 rounded-card bg-surface p-5 shadow-e0 xl:p-6">
          <span className={cn(BAR, 'h-4 w-40')} />
          <span className="mt-4 block h-12 rounded-control bg-soft-fill animate-shimmer" />
        </span>
        <span className="block h-20 rounded-card bg-surface p-5 shadow-e0 xl:p-6">
          <span className={cn(BAR, 'h-4 w-48')} />
        </span>
        <span className="block h-32 rounded-card bg-surface p-5 shadow-e0 xl:p-6">
          <span className={cn(BAR, 'h-3 w-56')} />
          <span className="mt-4 block h-12 rounded-control bg-soft-fill animate-shimmer" />
        </span>
      </div>
    </div>
  );
}
