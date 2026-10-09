'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircleIcon } from '@heroicons/react/24/solid';
import { ExclamationTriangleIcon, UserCircleIcon } from '@heroicons/react/24/outline';
import {
  T4ActionBar,
  T4ErrorSummary,
  T4Frame,
  T4Gate,
  T4Header,
  T4Section,
  T4Spinner,
  T4TextArea,
  validateStep,
  type T4Back,
} from '@/components/templates/T4';
import { Button, buttonClass } from '@/components/ui/Button';
import { anglerLookupQuery, createWalkInBookingMutation, MIN_PHONE_DIGITS, type WalkInBookingInput } from '@/core/booking';
import type { AnglerListItem } from '@/core/social';
import { useSiteToast } from '@/app/(site)/_shell/Toast';
import { useKeyboardInset } from '@/app/(site)/balti/[id]/recenzie/_components/useKeyboardInset';
import { guardStep, previousStep, SELECTION_TAKEN_MESSAGE, selectionStand } from '@/app/(site)/balti/[id]/rezerva/_flow/guards';
import { useFlowQuote, useLiveAvailability } from '@/app/(site)/balti/[id]/rezerva/_flow/hooks';
import { useFlowNav } from '@/app/(site)/balti/[id]/rezerva/_flow/nav';
import { readFlowParams, type FlowSelection } from '@/app/(site)/balti/[id]/rezerva/_flow/params';
import { quoteView, type ReviewLake } from '@/app/(site)/balti/[id]/rezerva/confirmare/model';
import { QuoteUnavailable } from '@/app/(site)/balti/[id]/rezerva/confirmare/QuoteUnavailable';
import { SummaryCard } from '@/app/(site)/balti/[id]/rezerva/confirmare/SummaryCard';
import { useOperatorTransport } from '../../../../_shared/useOperatorTransport';
import { walkInFlow } from '../../_walkin/flowConfig';
import { AnglerAccountPicker } from './AnglerAccountPicker';
import { AnglerMatchDialog } from './AnglerMatchDialog';
import { AnglerModeSwitch } from './AnglerModeSwitch';
import { GuestContactFields } from './GuestContactFields';
import { LinkBanner } from './LinkBanner';
import {
  accountInput,
  AUTO_CONFIRM_NOTE,
  baseInput,
  currentMatch,
  DEFAULT_MODE,
  EMPTY_GUEST,
  GUEST_FIELDS,
  guestInput,
  guestSchema,
  NO_ACCOUNT_PICKED,
  NOTES_FIELD,
  NOTES_MAX,
  notesSchema,
  TITLE,
  undecided,
  walkInErrorMessage,
  walkInSuccessMessage,
  type AnglerMode,
  type GuestField,
  type GuestValues,
  type MatchedUser,
} from './model';
import { useSubmitFreeze } from './useSubmitFreeze';
import { ACTIONS_SPLIT, HEADER_SPLIT, WalkInReviewFrame } from './WalkInReviewFrame';
import { WalkInReviewSkeleton } from './WalkInReviewSkeleton';

/*
 * operator.calendar-confirmare — /operator/[lakeId]/calendar/confirmare, step 3 of the walk-in
 * (fish app/(app)/operator/[lakeId]/walk-in/review.tsx), on T4:
 *  - c1 the guard: page.tsx sends a URL without a selection to the calendar before anything
 *    renders (a lake the public read does not know keeps its owned-lakes name, as the calendar
 *    does); here a stand the lake no longer has, booking
 *    turned off, or a tour no longer free → the calendar, replaced, before the step renders (the
 *    angler review's guards with the walk-in's rules: a started slot is still sellable);
 *  - c2 «Confirmă rezervarea»; Back walks one step (the extras step when this tour has one, else
 *    the calendar with the selection) and is frozen while the submit runs (useSubmitFreeze) — from
 *    the press, the awaited phone lookup included: fields, switch, both Backs and the browser's;
 *  - c3 no price: QuoteUnavailable, no CTA; c4 the angler's summary card WITHOUT the request notice
 *    (a walk-in is confirmed, cash at the gate — the note below says so, c15), built as a cash
 *    booking whatever the lake's mode (model.walkInFacts: «Numerar», «Total · se plătește la fața locului»);
 *  - c5–c13 «Date pescar»: AnglerModeSwitch, AnglerAccountPicker (account), GuestContactFields +
 *    the phone lookup (armed on blur / submit, keyed to the number it was armed with) + the match
 *    dialog + LinkBanner (guest); c14 the notes in both modes;
 *  - c16–c19 «Adaugă rezervarea» (only with a price, above the keyboard, busy while sending), the POST,
 *    the success toast and the way out of the whole flow, the refusal toasts; the invalidations are
 *    core's createWalkInBookingMutation (bookings + owned-lakes stats + every per-lake stats).
 * Layout: WalkInReviewFrame (one column below 1024; the summary column on the right from 1024).
 */

const TITLE_ID = 'la-poarta-titlu';
/** How many months past the first the review reads ahead to judge a tour further out (the grid's own cap). */
const READ_AHEAD_MAX = 13;

export function WalkInReviewScreen({ lake }: { lake: ReviewLake }) {
  const lakeId = lake.documentId;
  const config = useMemo(() => walkInFlow(lakeId), [lakeId]);
  const router = useRouter();
  const search = useSearchParams();
  const params = useMemo(() => readFlowParams(new URLSearchParams(search.toString())), [search]);
  const sel = params.selection;
  const nav = useFlowNav(lakeId, config);
  const toast = useSiteToast();
  const { query: avail, merged, checkoutBufferMinutes } = useLiveAvailability(lakeId);
  /**
   * `leaving`: the flow is being left (success). `holding`: a submit is in flight — the create's own
   * refetch of the availability (the new booking now holds the stand) must not send the review away
   * under it. Neither re-judges the URL.
   */
  const [leaving, setLeaving] = useState(false);
  const [holding, setHolding] = useState(false);
  const [mountMs] = useState(() => Date.now());
  const nowMs = Math.max(mountMs, avail.dataUpdatedAt);

  const redirect = useMemo(
    () => (leaving || holding ? null : guardStep(lakeId, 'review', params, merged, nowMs, config)),
    [leaving, holding, lakeId, params, merged, nowMs, config],
  );
  const taken = !!redirect && !!merged?.bookingEnabled && !!selectionStand(merged, sel);
  useEffect(() => {
    if (!redirect) return;
    if (taken) toast(SELECTION_TAKEN_MESSAGE, 'danger');
    router.replace(redirect);
  }, [redirect, taken, router, toast]);

  // A tour further out than the loaded months: read ahead until its end is loaded (the grid's rule).
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = avail;
  const pageCount = avail.data?.pages.length ?? 0;
  const beyond = !!merged && !!sel && !(Date.parse(sel.end) <= Date.parse(merged.loadedRange.to));
  useEffect(() => {
    if (beyond && hasNextPage && !isFetchingNextPage && pageCount <= READ_AHEAD_MAX) void fetchNextPage();
  }, [beyond, hasNextPage, isFetchingNextPage, pageCount, fetchNextPage]);

  const stand = selectionStand(merged, sel);
  const back: T4Back = {
    label: 'Înapoi',
    onClick: () => sel && nav.stepBack(previousStep(merged, sel), params),
  };

  if (!sel || redirect || (!stand && !avail.isError)) {
    return <WalkInReviewSkeleton eyebrow={lake.name} back={back} />;
  }
  if (!stand) {
    // The availability (the stand's name) could not be read, and nothing is cached: a retry.
    return (
      <T4Frame pageState label={TITLE} header={<T4Header title={TITLE} eyebrow={lake.name} back={back} />}>
        <T4Gate
          tone="danger"
          role="alert"
          icon={<ExclamationTriangleIcon />}
          title="A apărut o eroare la încărcarea disponibilității."
          actions={
            <Button onClick={() => void avail.refetch()} disabled={avail.isFetching} aria-busy={avail.isFetching || undefined}>
              Încearcă din nou
            </Button>
          }
        />
      </T4Frame>
    );
  }
  return (
    <Review
      lake={lake}
      sel={sel}
      extras={params.extras}
      standName={stand.name}
      checkoutBufferMinutes={checkoutBufferMinutes ?? lake.checkoutBufferMinutes ?? 0}
      back={back}
      nav={nav}
      onLeave={() => setLeaving(true)}
      onHold={setHolding}
    />
  );
}

function Review({
  lake,
  sel,
  extras,
  standName,
  checkoutBufferMinutes,
  back,
  nav,
  onLeave,
  onHold,
}: {
  lake: ReviewLake;
  sel: FlowSelection;
  extras: string[];
  standName: string;
  checkoutBufferMinutes: number;
  back: T4Back;
  nav: ReturnType<typeof useFlowNav>;
  onLeave: () => void;
  onHold: (holding: boolean) => void;
}) {
  const lakeId = lake.documentId;
  const t = useOperatorTransport();
  const qc = useQueryClient();
  const toast = useSiteToast();
  const quoteQ = useFlowQuote(lakeId, sel, extras, true);
  const view = quoteView(quoteQ.data, quoteQ.isFetching, quoteQ.isError);
  // The toast and the invalidations belong to the mutation, not to this call: they land even if the
  // page is gone by then (TanStack drops a mutate()'s own callbacks once the component unmounts).
  const base = createWalkInBookingMutation(t, qc);
  const create = useMutation({
    ...base,
    onSuccess: (...args: Parameters<NonNullable<typeof base.onSuccess>>) => {
      base.onSuccess?.(...args);
      toast(walkInSuccessMessage(args[0].code), 'success');
    },
    onError: (error) => toast(walkInErrorMessage(error), 'danger'),
  });
  useKeyboardInset();

  // ── Who the booking is for (c5) ─────────────────────────────────────────────────────────────
  const [mode, setMode] = useState<AnglerMode>(DEFAULT_MODE);
  const [picked, setPicked] = useState<AnglerListItem | null>(null);
  const [values, setValues] = useState<GuestValues>(EMPTY_GUEST);
  const phone = values.contactPhone;

  // ── The phone lookup + the match (c10–c13) ──────────────────────────────────────────────────
  /** The number the lookup was armed with (on leaving the field / a submit) — never each keystroke. */
  const [lookedUp, setLookedUp] = useState<string | null>(null);
  const lookup = useQuery(anglerLookupQuery(t, lakeId, lookedUp ?? '', lookedUp !== null));
  const match = currentMatch(phone, lookedUp, lookup.data);
  /** The number the operator already answered the dialog for: it is not asked again for it. */
  const [decidedPhone, setDecidedPhone] = useState<string | null>(null);
  /** The number the answer was «Leagă contul» for. A number with no match has no link (c12). */
  const [linkedPhone, setLinkedPhone] = useState<string | null>(null);
  const linked = !!match && linkedPhone === phone;
  /** Leaving the field arms the dialog; the lookup may still be in flight, so it opens when it lands. */
  const [promptArmed, setPromptArmed] = useState(false);
  const [dialogAsked, setDialogAsked] = useState(false);
  const dialogOpen = dialogAsked || (promptArmed && undecided(match, phone, decidedPhone));

  const onChange = (field: GuestField, value: string) => {
    setValues((v) => ({ ...v, [field]: value }));
    if (field === 'contactPhone' && value !== phone) {
      // A new number is an undecided number: the link is dropped, the prompt waits for the next blur.
      setDecidedPhone(null);
      setLinkedPhone(null);
      setPromptArmed(false);
    }
  };

  const armLookup = useCallback(() => {
    if (phone.replace(/\D/g, '').length >= MIN_PHONE_DIGITS) setLookedUp(phone);
  }, [phone]);
  const onPhoneBlur = () => {
    armLookup();
    setPromptArmed(true);
  };
  const decide = (link: boolean) => {
    setLinkedPhone(link ? phone : null);
    setDecidedPhone(phone);
    setPromptArmed(false);
    setDialogAsked(false);
  };

  // ── Validation (shown after a refused submit, then live) ────────────────────────────────────
  const [attempt, setAttempt] = useState(0);
  const check =
    mode === 'guest'
      ? validateStep(guestSchema, values, [...GUEST_FIELDS])
      : validateStep(notesSchema, { notes: values.notes }, NOTES_FIELD);
  const shown = attempt > 0 ? check : null;
  const fieldErrors = (shown?.byField ?? {}) as Partial<Record<GuestField, string>>;
  useEffect(() => {
    if (attempt === 0) return;
    const first = check.list[0];
    if (!first) return;
    const el = document.getElementById(first.id);
    el?.focus({ preventScroll: true });
    el?.scrollIntoView({
      block: 'center',
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
    // Only a new attempt moves focus; typing must not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  // ── The submit (c8, c13, c16–c18) ───────────────────────────────────────────────────────────
  const { freeze, thaw } = useSubmitFreeze(onHold);
  const [checking, setChecking] = useState(false);
  const [left, setLeft] = useState(false);
  const pending = create.isPending || left;
  const busy = pending || checking;
  const priced = view.kind === 'priced' ? view.quote : null;
  const held = busy || (view.kind === 'priced' && view.refreshing);
  /** A submit is under way (the lookup it awaits, then the create): a second press is ignored. */
  const sending = useRef(false);
  /** What the screen shows now, read after the awaited lookup (the submit's own closure is stale by then). */
  const live = useRef({ mode, values });
  useLayoutEffect(() => {
    live.current = { mode, values };
  });
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const send = (input: WalkInBookingInput) => {
    sending.current = true;
    freeze();
    create.mutate(input, {
      onSuccess: () => {
        thaw(false);
        setLeft(true);
        onLeave();
        // Leaves the whole flow (fish exitFlow — NOT one step back): where the calendar was opened from.
        nav.exitFlow();
      },
      onError: () => {
        sending.current = false;
        thaw(true);
      },
    });
  };

  /** The account the typed number belongs to, answered for THIS number (awaits an armed lookup in flight). */
  const resolveMatch = async (): Promise<MatchedUser | null> => {
    if (phone.replace(/\D/g, '').length < MIN_PHONE_DIGITS) return null;
    setLookedUp(phone);
    try {
      const r = await qc.fetchQuery(anglerLookupQuery(t, lakeId, phone, true));
      return currentMatch(phone, phone, r);
    } catch {
      // A failed lookup (403 without the grant, offline) books without a link, as fish does.
      return null;
    }
  };

  const onSubmit = async () => {
    if (held || !priced || sending.current) return;
    if (mode === 'account') {
      if (!picked) {
        toast(NO_ACCOUNT_PICKED, 'danger');
        return;
      }
      if (!check.ok) {
        setAttempt((a) => a + 1);
        return;
      }
      send(accountInput(baseInput(lakeId, sel, extras), picked.documentId, values.notes ?? ''));
      return;
    }
    setAttempt((a) => a + 1);
    const parsed = guestSchema.safeParse(values);
    if (!parsed.success) {
      armLookup();
      return;
    }
    // The whole screen is frozen from here (fields, switch, both Backs, the browser's Back), not
    // only once the create is sent: the lookup can take seconds over a slow link.
    sending.current = true;
    freeze();
    setChecking(true);
    const m = await resolveMatch();
    // Left meanwhile: nothing is sent after the operator is gone.
    if (!mounted.current) return;
    setChecking(false);
    const stop = () => {
      sending.current = false;
      thaw(true);
    };
    // Belt and braces (the fields are frozen): never book what the screen no longer shows.
    if (live.current.mode !== 'guest' || live.current.values !== values) return stop();
    // A match not answered for this number is asked first: never an unlinked booking behind it.
    if (undecided(m, phone, decidedPhone)) {
      stop();
      setDialogAsked(true);
      return;
    }
    send(guestInput(baseInput(lakeId, sel, extras), parsed.data, linked && m ? m.documentId : null));
  };

  const header = <T4Header className={HEADER_SPLIT} title={TITLE} titleId={TITLE_ID} eyebrow={lake.name} back={back} busy={busy} />;

  if (!priced) {
    return (
      <T4Frame pageState label={TITLE} header={<T4Header title={TITLE} titleId={TITLE_ID} eyebrow={lake.name} back={back} />}>
        <QuoteUnavailable
          state={view.kind === 'priced' ? { kind: 'quoting' } : view}
          retrying={quoteQ.isFetching}
          onRetry={() => void quoteQ.refetch()}
          onBack={nav.backToGrid}
        />
      </T4Frame>
    );
  }

  const refreshing = view.kind === 'priced' && view.refreshing;
  const showBanner = mode === 'guest' && !!match && phone === decidedPhone;
  return (
    <>
      <WalkInReviewFrame
        label={TITLE}
        header={header}
        summary={
          <SummaryCard
            stacked
            lake={lake}
            standName={standName}
            startISO={sel.start}
            endISO={sel.end}
            checkoutBufferMinutes={checkoutBufferMinutes}
            quote={priced}
            refreshing={refreshing}
          />
        }
        note={
          <div data-testid="walkin-auto-confirm" className="flex items-center gap-2.5 rounded-card bg-surface p-3 shadow-e0">
            <CheckCircleIcon aria-hidden className="size-5 shrink-0 text-status-success-fg" />
            <p className="t-caption flex-1 text-ink-2">{AUTO_CONFIRM_NOTE}</p>
          </div>
        }
        actions={
          <T4ActionBar
            className={`${ACTIONS_SPLIT} bottom-[var(--review-kb-inset,0px)]`}
            back={
              <Button variant="ghost" onClick={back.onClick} disabled={busy}>
                Înapoi
              </Button>
            }
            primary={
              // Held, never `disabled`: focus stays on it while the submit runs.
              <button
                type="button"
                data-testid="walkin-submit"
                aria-disabled={held || undefined}
                aria-busy={busy || undefined}
                onClick={() => void onSubmit()}
                className={buttonClass({ disabled: held })}
              >
                {busy ? <T4Spinner /> : null}
                Adaugă rezervarea
              </button>
            }
          />
        }
      >
        <T4ErrorSummary errors={shown?.list ?? []} attempt={attempt} />
        <T4Section title="Date pescar" icon={<UserCircleIcon />} id="date-pescar">
          {/* The card keeps the column's full width; what is inside is sized to what it holds
              (a 768 cap: the name and phone side by side at ~370 each, never a 1250 px field). */}
          <div data-testid="walkin-angler-body" className="flex max-w-3xl flex-col gap-4">
            <AnglerModeSwitch value={mode} onChange={setMode} disabled={busy} />
            {mode === 'account' ? (
              <AnglerAccountPicker selected={picked} onSelect={setPicked} onClear={() => setPicked(null)} disabled={busy} />
            ) : (
              <GuestContactFields
                values={values}
                errors={fieldErrors}
                disabled={busy}
                onChange={onChange}
                onPhoneBlur={onPhoneBlur}
                below={
                  showBanner && match ? (
                    <LinkBanner user={match} linked={linked} onChange={() => setDialogAsked(true)} disabled={busy} />
                  ) : null
                }
              />
            )}
            <T4TextArea
              id={GUEST_FIELDS[2].id}
              label={GUEST_FIELDS[2].label}
              placeholder="Detalii adiționale, ora estimată de sosire, etc."
              maxLength={NOTES_MAX}
              value={values.notes ?? ''}
              onChange={(e) => onChange('notes', e.currentTarget.value)}
              error={fieldErrors.notes}
              readOnly={busy}
              className="[&_textarea]:min-h-25"
              data-testid="walkin-notes"
            />
          </div>
        </T4Section>
        <p role="status" className="sr-only">
          {busy ? 'Se adaugă rezervarea…' : ''}
        </p>
      </WalkInReviewFrame>
      <AnglerMatchDialog open={dialogOpen} user={match} phone={phone} onLink={() => decide(true)} onSkip={() => decide(false)} />
    </>
  );
}
