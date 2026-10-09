'use client';

import { useId, useState, useSyncExternalStore, type FormEvent, type ReactNode } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowPathIcon, ChevronLeftIcon } from '@heroicons/react/24/outline';
import { StarIcon } from '@heroicons/react/24/solid';
import { controlShell } from '@/components/forms/Field';
import { useBack } from '@/components/nav/useBack';
import { headerChipClass } from '@/components/templates/T3/DetailHeader';
import { FlowActions, FlowHeader, FlowLayout, FlowLoadingStatus, FlowSubjectCard, FlowSubjectSkeleton } from '@/components/templates/T6';
import { Avatar, toneForId } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { createAnglerReviewMutation, type ReviewTag } from '@/core/social';
import { routes } from '@/lib/routes';
import { useSiteToast } from '../../../../_shell/Toast';
import { useOperatorTransport } from '../../../_shared/useOperatorTransport';
import {
  COMMENT_MAX,
  commentRequired,
  DEFAULT_STARS,
  displayName,
  friendlyReviewError,
  isFinalRefusal,
  isValid,
  RATE_TITLE,
  reviewInput,
  SENT_MESSAGE,
  stayLine,
  toggleTag,
  verdict,
  withStars,
  type RateParams,
  type RateState,
  type VerdictTone,
} from './model';
import { StarRating } from './StarRating';
import { TagGroups } from './TagGroups';

/*
 * «Evaluează pescarul» — parity operator.evalueaza-pescar, fish app/(app)/operator/rate-angler/[bookingId].tsx,
 * on T6 (one task: one score, optional tags, a comment).
 *  - c1 nothing is fetched: who and which stay come from the link (routes.operatorRateAngler, fish
 *    openRateAngler), validated by the page (model.parseRateParams);
 *  - c2 back + «Evaluează pescarul»; c3 the stay card (avatar or initials, the name or «pescarul»,
 *    «Standul {s} · {period}» with what is known — the period in the device's zone, as fish, so it
 *    is written after hydration);
 *  - c4 «Cum a fost cu {name}?» over five whole stars, preset 5, a radio group; c5 the verdict;
 *  - c6 the tag groups by score (TagGroups), c7 raising to five drops the faults (model.withStars);
 *  - c8 the comment card, c9 «Trimite evaluarea» off while invalid or sending;
 *  - c10 POST /feed/angler-reviews → «Evaluare trimisă» → back (history, else the operator area);
 *  - c11 refusals by code, 403 / 404 by status (model.friendlyReviewError); a final one (not this
 *    owner's, gone, already rated, a no-show) keeps the CTA off with its sentence under the form
 *    (model.isFinalRefusal) — a second press could only be refused again; c12 core createAnglerReviewMutation
 *    invalidates reputation, bookings and operator-stats.
 * Layout (T6): below 1280 one column — the stay card on top of the task, the CTA in the bar stuck
 * to the bottom edge; from 1280 the stay card in the aside with the CTA docked under it; from 1440
 * stars and tags side by side, the comment under both.
 */

const TITLE_ID = 'evalueaza-titlu';
const FORM_ID = 'evalueaza-form';

const VERDICT_TONE: Record<VerdictTone, string> = {
  success: 'text-status-success-fg',
  neutral: 'text-ink-2',
  danger: 'text-status-danger-fg',
};

/** false on the server and during hydration, true after: device-local text is written in the browser only. */
const subscribeNoop = () => () => {};
function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );
}

/** FlowHeader's back chip as a button: history back when the page before is the site's, else the operator area. */
function BackChip({ onClick }: { onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label="Înapoi" className={headerChipClass()} data-testid="rate-back">
      <ChevronLeftIcon aria-hidden />
    </button>
  );
}

function RateFrame({
  back,
  aside,
  actions,
  busy,
  children,
}: {
  back: ReactNode;
  aside: ReactNode;
  actions: ReactNode;
  busy?: boolean;
  children: ReactNode;
}) {
  return (
    <FlowLayout
      header={<FlowHeader title={RATE_TITLE} id={TITLE_ID} backPlaceholder={back} />}
      labelledBy={TITLE_ID}
      fill
      busy={busy}
      aside={aside}
      asideMobile="hidden"
      actions={actions}
    >
      {children}
    </FlowLayout>
  );
}

/** The blocks of the task: stars | tags side by side from 1440, the comment under both. */
const BLOCKS = 'flex flex-col divide-y divide-hairline 2xl:grid 2xl:grid-cols-2 2xl:divide-y-0';
const STARS_BLOCK = 'flex flex-col items-center gap-3 pb-6 2xl:border-r 2xl:border-hairline 2xl:pr-8';
const TAGS_BLOCK = 'py-6 2xl:pt-0 2xl:pl-8';
const COMMENT_BLOCK = 'flex flex-col gap-2.5 pt-6 2xl:col-span-2 2xl:mt-6 2xl:border-t 2xl:border-hairline';

function StayCard({ params, name }: { params: RateParams; name: string }) {
  const hydrated = useHydrated();
  const stand = params.standName ? `Standul ${params.standName}` : null;
  const hasPeriod = Boolean(params.startDate && params.endDate);
  // The period is device-local (fish date-fns): known after hydration; until then a bar holds its place.
  // A word joiner around the en dash keeps «06:00–18:00» on one line.
  const line = (hydrated ? stayLine(params) : stand)?.replace(/(\d)–(\d)/g, '$1\u2060–\u2060$2') ?? null;
  const pending = !hydrated && hasPeriod;
  return (
    <div data-testid="rate-stay">
      <FlowSubjectCard
        leading={<Avatar name={name} src={params.anglerAvatar} size={44} tone={toneForId(params.anglerId ?? params.bookingId)} />}
        title={<span className="line-clamp-2 break-words">{name}</span>}
        subtitle={
          line || pending ? (
            <span className="t-body block text-ink-2" data-testid="rate-stay-line">
              {line}
              {pending ? (
                <>
                  {stand ? ' · ' : null}
                  <span aria-hidden className="inline-block h-3 w-40 max-w-full rounded-full bg-accent-tint-2 align-middle" />
                </>
              ) : null}
            </span>
          ) : undefined
        }
      />
    </div>
  );
}

export function RateAnglerScreen({ params }: { params: RateParams }) {
  const t = useOperatorTransport();
  const qc = useQueryClient();
  const toast = useSiteToast();
  const goBack = useBack(routes.operator());
  const commentId = useId();
  const hintId = useId();
  const questionId = useId();

  const [state, setState] = useState<RateState>({ stars: DEFAULT_STARS, tags: [] });
  const [comment, setComment] = useState('');
  // Sent: leaving — still busy, never a second submit.
  const [done, setDone] = useState(false);
  // A refusal no retry can change: its sentence stays under the form, the CTA stays off.
  const [refused, setRefused] = useState<string | null>(null);
  const create = useMutation(createAnglerReviewMutation(t, qc));
  const sending = create.isPending || done;
  // Off until hydrated: a press before then would be the browser's own GET submit of the form.
  const hydrated = useHydrated();

  const name = displayName(params);
  const required = commentRequired(state.stars);
  const valid = isValid(state.stars, comment);
  const missingComment = required && comment.trim().length === 0;
  const v = verdict(state.stars);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!valid || sending || refused) return;
    create.mutate(reviewInput(params.bookingId, state.stars, comment, state.tags), {
      onSuccess: () => {
        setDone(true);
        toast(SENT_MESSAGE, 'success');
        goBack();
      },
      onError: (error) => {
        const e = error as { status?: number; bluCode?: string; message?: string };
        const message = friendlyReviewError(e);
        if (isFinalRefusal(e)) setRefused(message);
        toast(message, 'danger');
      },
    });
  };

  const stay = <StayCard params={params} name={name} />;

  return (
    <RateFrame
      back={<BackChip onClick={goBack} />}
      aside={stay}
      actions={
        <FlowActions
          primary={
            <Button
              block
              type="submit"
              form={FORM_ID}
              disabled={!hydrated || !valid || sending || refused !== null}
              aria-busy={sending || undefined}
              icon={sending ? <ArrowPathIcon className="motion-safe:animate-spin" /> : undefined}
              data-testid="rate-submit"
            >
              Trimite evaluarea
            </Button>
          }
        />
      }
    >
      <form id={FORM_ID} noValidate onSubmit={submit} aria-labelledby={TITLE_ID} className="flex flex-col gap-6">
        <div className="xl:hidden">{stay}</div>
        <div className={BLOCKS}>
          <div className={STARS_BLOCK}>
            <p id={questionId} className="t-heading text-center text-ink" data-testid="rate-question">
              {`Cum a fost cu ${name}?`}
            </p>
            <StarRating labelledBy={questionId} value={state.stars} onChange={(n) => setState((s) => withStars(s, n))} disabled={sending} />
            <p aria-live="polite" className={cn('t-title2', VERDICT_TONE[v.tone])} data-testid="rate-verdict" data-tone={v.tone}>
              {v.label}
            </p>
          </div>
          <div className={TAGS_BLOCK}>
            <TagGroups
              stars={state.stars}
              tags={state.tags}
              onToggle={(tag: ReviewTag) => setState((s) => ({ ...s, tags: toggleTag(s.tags, tag) }))}
              disabled={sending}
            />
          </div>
          <div className={COMMENT_BLOCK} data-testid="rate-comment">
            <div className="flex items-center gap-2">
              <h2 className="t-body-strong flex-1 text-ink">
                <label htmlFor={commentId}>Comentariu</label>
              </h2>
              <span className={cn('t-caption', required ? 'text-status-danger-fg' : 'text-muted')} data-testid="rate-comment-marker">
                {required ? 'obligatoriu' : 'opțional'}
              </span>
            </div>
            <div className={cn(controlShell(false, sending), 'h-auto items-stretch py-2.5')}>
              <textarea
                id={commentId}
                value={comment}
                onChange={(e) => setComment(e.currentTarget.value)}
                placeholder={required ? 'Spune pe scurt ce nu a mers.' : 'Ceva de menționat despre această rezervare?'}
                maxLength={COMMENT_MAX}
                disabled={sending}
                aria-required={required || undefined}
                aria-describedby={missingComment ? hintId : undefined}
                className="t-body field-sizing-content max-h-62 min-h-24 min-w-0 flex-1 resize-none bg-transparent text-ink outline-none placeholder:text-muted focus-visible:outline-none disabled:cursor-not-allowed"
                data-testid="rate-comment-input"
              />
            </div>
            {missingComment ? (
              <p id={hintId} className="t-caption text-status-danger-fg" data-testid="rate-comment-hint">
                Adaugă un comentariu pentru o notă sub 3 stele
              </p>
            ) : null}
          </div>
        </div>
        {refused ? (
          <p className="t-caption text-status-danger-fg" data-testid="rate-refused">
            {refused}
          </p>
        ) : null}
        {sending ? <FlowLoadingStatus label="Se trimite evaluarea…" /> : null}
      </form>
    </RateFrame>
  );
}

/** Behind the session gate: the frame, the stay card's and the form's outlines in grey, a disabled CTA. */
export function RateAnglerSkeleton() {
  const grey = 'inline-block max-w-full animate-shimmer rounded-full bg-soft-fill align-middle';
  return (
    <RateFrame
      back={<span aria-hidden className="size-12 shrink-0 rounded-control bg-soft-fill xl:size-10" />}
      aside={<FlowSubjectSkeleton people={0} />}
      busy
      actions={
        <FlowActions
          primary={
            <Button block disabled>
              Trimite evaluarea
            </Button>
          }
        />
      }
    >
      <FlowLoadingStatus />
      <div aria-hidden className="flex flex-col gap-6">
        <div className="xl:hidden">
          <FlowSubjectSkeleton people={0} />
        </div>
        <div className={BLOCKS}>
          <div className={STARS_BLOCK}>
            <p className="t-heading">
              <span className={cn(grey, 'h-4 w-44')} />
            </p>
            <div className="flex">
              {[1, 2, 3, 4, 5].map((n) => (
                <span key={n} className="flex size-13 items-center justify-center">
                  <StarIcon className="size-11 text-soft-fill" />
                </span>
              ))}
            </div>
            <p className="t-title2">
              <span className={cn(grey, 'h-5 w-24')} />
            </p>
          </div>
          <div className={TAGS_BLOCK}>
            <p className="t-body-strong">
              <span className={cn(grey, 'h-3.5 w-28')} />
            </p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {['w-40', 'w-36', 'w-24', 'w-20'].map((w) => (
                <span key={w} className={cn('h-10 animate-shimmer rounded-full bg-soft-fill', w)} />
              ))}
            </div>
          </div>
          <div className={COMMENT_BLOCK}>
            <p className="t-body-strong">
              <span className={cn(grey, 'h-3.5 w-24')} />
            </p>
            <span className="block h-29 animate-shimmer rounded-control bg-soft-fill" />
          </div>
        </div>
      </div>
    </RateFrame>
  );
}
