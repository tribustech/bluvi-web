'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import {
  T4ActionBar,
  T4ErrorSummary,
  T4Frame,
  T4Gate,
  T4Header,
  T4Notice,
  T4Spinner,
  validateStep,
  type T4Back,
} from '@/components/templates/T4';
import { Button, buttonClass } from '@/components/ui/Button';
import {
  bookingKeys,
  bookingSubmitFailure,
  bookingSuccessMessage,
  createBookingMutation,
  isBookingRequest,
} from '@/core/booking';
import { profileQuery, updateProfileMutation } from '@/core/social';
import { useSiteToast } from '../../../../_shell/Toast';
import { useKeyboardInset } from '../../recenzie/_components/useKeyboardInset';
import { guardStep, previousStep, SELECTION_TAKEN_MESSAGE, selectionStand } from '../_flow/guards';
import { useFlowQuote, useFlowTransport, useLiveAvailability } from '../_flow/hooks';
import { useFlowNav } from '../_flow/nav';
import { readFlowParams } from '../_flow/params';
import { ConfirmDialog } from './ConfirmDialog';
import { ContactCard } from './ContactCard';
import {
  CONTACT_FIELDS,
  contactSchema,
  createInput,
  phoneChanged,
  prefillContact,
  quoteView,
  type ContactField,
  type ContactValues,
  type PricedQuote,
  type ReviewLake,
} from './model';
import { QuoteUnavailable } from './QuoteUnavailable';
import { ReviewSkeleton } from './ReviewSkeleton';
import { PriceAside, SummaryCard } from './SummaryCard';

/*
 * Step 3 of the angler's booking flow — fish app/(app)/book-lake/[lakeId]/review.tsx (parity
 * booking.rezerva-confirmare), on T4:
 *  - c1 the guard: a stand the lake no longer has (or booking turned off) → the grid, replaced,
 *    before the step renders (page.tsx already sent a URL without a selection there); and a tour
 *    the live availability no longer has free (taken — the angler's own booking reached again by
 *    Forward too —, started, inside the lead time) → the grid, «Intervalul ales nu mai e liber.»;
 *  - c2 «Confirmă rezervarea»; back walks one step (the extras step when this tour has one, else
 *    the grid) and is frozen while the submit runs (fish freezes the stack): the header's control
 *    refuses, a click on any page link is swallowed, the browser's Back / a push is cancelled
 *    through the Navigation API, or — without it — undone by a sentinel entry
 *    (booking.b.double-submit-guard). The outcome's toast and invalidations live on the mutation
 *    itself, so they land even if the page is gone; only the navigation is per call;
 *  - c3 no price: QuoteUnavailable (quoting / refused / failed), no CTA;
 *  - c4–c8 the summary card, the price only from the server's quote (booking.b.server-priced), the
 *    request notice; c9–c13 the contact card, prefilled from the profile, «Continuă» validates (the
 *    error summary on top, focus and scroll on the first invalid field) and opens the confirmation;
 *  - c14–c17 ConfirmDialog; c18–c24 the submit and its outcomes; c25 no online payment (the flag is
 *    off on the web: a client secret is never handled); c26 the CTA rides above the keyboard.
 * Layout: below 1280 one column (summary with the price, the request notice, contact) and the CTA
 * pinned to the bottom edge; from 1280 the price in the sticky right column with the CTA under it.
 */

const TITLE = 'Confirmă rezervarea';
const TITLE_ID = 'confirmare-titlu';

type NavigationLike = { addEventListener?: (t: 'navigate', l: (e: Event) => void) => void; removeEventListener?: (t: 'navigate', l: (e: Event) => void) => void };
type NavigateEventLike = Event & { navigationType?: string; cancelable: boolean; hashChange?: boolean; destination?: { url: string } };

/** The history entry pushed over the review while a submit runs, in a browser without the Navigation API. */
const FREEZE_MARK = 'bluviBookingFrozen';
/** How many months past the first the review reads ahead to judge a tour further out (the grid's own cap). */
const READ_AHEAD_MAX = 13;

function navigationApi(): NavigationLike | undefined {
  return (window as unknown as { navigation?: NavigationLike }).navigation;
}

export function ReviewStep({ lake }: { lake: ReviewLake }) {
  const lakeId = lake.documentId;
  const router = useRouter();
  const search = useSearchParams();
  const params = useMemo(() => readFlowParams(new URLSearchParams(search.toString())), [search]);
  const sel = params.selection;
  const nav = useFlowNav(lakeId);
  const toast = useSiteToast();
  const { query: avail, merged, checkoutBufferMinutes } = useLiveAvailability(lakeId);
  /**
   * `leaving`: the flow is being left (success, a dead stand). `holding`: a submit is in flight — the
   * create's own refetches must not send the review away under it. Neither re-judges the URL.
   */
  const [leaving, setLeaving] = useState(false);
  const [holding, setHolding] = useState(false);
  // «Now» moves with every fresh read, as on the grid: a tab left open re-judges the lead time.
  const [mountMs] = useState(() => Date.now());
  const nowMs = Math.max(mountMs, avail.dataUpdatedAt);

  const redirect = useMemo(
    () => (leaving || holding ? null : guardStep(lakeId, 'review', params, merged, nowMs)),
    [leaving, holding, lakeId, params, merged, nowMs]
  );
  /** The redirect is the tour itself (taken, started, lead time), not a missing stand or URL. */
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
    return <ReviewSkeleton eyebrow={lake.name} back={back} />;
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
  sel: NonNullable<ReturnType<typeof readFlowParams>['selection']>;
  extras: string[];
  standName: string;
  checkoutBufferMinutes: number;
  back: T4Back;
  nav: ReturnType<typeof useFlowNav>;
  onLeave: () => void;
  onHold: (holding: boolean) => void;
}) {
  const lakeId = lake.documentId;
  const t = useFlowTransport();
  const qc = useQueryClient();
  const toast = useSiteToast();
  const quoteQ = useFlowQuote(lakeId, sel, extras);
  const profile = useQuery(profileQuery(t));
  const isRequest = isBookingRequest(lake);
  // The outcome's toast and cache work belong to the mutation, not to this call: TanStack drops a
  // mutate()'s own callbacks once the component is gone, but these run regardless — the angler is
  // told the booking exists even if the page was left while it was sent.
  const base = createBookingMutation(t, qc);
  const create = useMutation({
    ...base,
    onSuccess: (...args: Parameters<NonNullable<typeof base.onSuccess>>) => {
      base.onSuccess?.(...args);
      // c25: the online-payment branch is off on the web — `result.payment` is never read.
      toast(bookingSuccessMessage(isRequest, args[0].data.code), 'success');
    },
    onError: error => {
      const failure = bookingSubmitFailure(error);
      if (failure.kind === 'price-changed' || failure.kind === 'stand-gone') {
        // Both keys, and the quote is the one that matters: invalidating only the availability left
        // the rejected figure on screen, and confirming again gave the same 409 forever.
        void qc.invalidateQueries({ queryKey: bookingKeys.availabilityPaged(lakeId) });
        void qc.invalidateQueries({ queryKey: ['booking-quote'] });
      }
      toast(failure.message, 'danger');
    },
  });
  const updateProfile = useMutation(updateProfileMutation(t, qc));
  useKeyboardInset();

  const view = quoteView(quoteQ.data, quoteQ.isFetching, quoteQ.isError);

  // ── The contact form ───────────────────────────────────────────────────────────────────────
  const dirty = useRef(new Set<ContactField>());
  const [values, setValues] = useState<ContactValues>(() =>
    prefillContact({ contactFullname: '', contactPhone: '', notes: '' }, new Set(), profile.data)
  );
  // The profile may arrive after the first render (a cold visit): fill what is still empty and
  // untouched, never what the user typed (fish reset(…, { keepDirtyValues: true })).
  useEffect(() => {
    if (profile.data) setValues(v => prefillContact(v, dirty.current, profile.data));
  }, [profile.data]);
  const onChange = (field: ContactField, value: string) => {
    dirty.current.add(field);
    setValues(v => ({ ...v, [field]: value }));
  };
  const [attempt, setAttempt] = useState(0);
  const check = validateStep(contactSchema, values, [...CONTACT_FIELDS]);
  const shown = attempt > 0 ? check : null;
  const fieldErrors = (shown?.byField ?? {}) as Partial<Record<ContactField, string>>;

  // A refused «Continuă»: the summary lists the errors (it takes focus first, being a child), then
  // the first invalid field takes it and scrolls into view (fish focusFirstInvalid, c13).
  useEffect(() => {
    if (attempt === 0) return;
    const first = check.list[0];
    if (!first) return;
    const el = document.getElementById(first.id);
    el?.focus({ preventScroll: true });
    el?.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    // Only a new attempt moves focus; typing must not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  // ── Confirm + submit ───────────────────────────────────────────────────────────────────────
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const pending = create.isPending || leaving;
  const priced = view.kind === 'priced' ? view.quote : null;
  /** After a price change the CTA waits for the fresh answer: never confirm the rejected figure. */
  const held = pending || (view.kind === 'priced' && view.refreshing);

  // Nothing leaves the review while the submit runs (fish setPending → goBack ignored, the tab bar
  // out of reach): a click on any same-tab link (the site header's too) is swallowed before Next's
  // <Link> sees it; a traversal, push or replace to another URL is cancelled through the Navigation
  // API; without the API, a sentinel entry over the review turns the browser's Back into a no-op.
  const frozen = useRef(false);
  const sentinel = useRef(false);
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!frozen.current || e.defaultPrevented) return;
      const a = (e.target as Element | null)?.closest?.('a[href]');
      if (!a || (a as HTMLAnchorElement).target === '_blank' || a.hasAttribute('download')) return;
      e.preventDefault();
    };
    const navApi = navigationApi();
    const onNavigate = (e: Event) => {
      const ev = e as NavigateEventLike;
      if (!frozen.current || !ev.cancelable || ev.hashChange) return;
      // Next's own bookkeeping (a replace of this very URL) passes; leaving does not.
      if (ev.navigationType !== 'traverse' && ev.destination?.url === window.location.href) return;
      ev.preventDefault();
    };
    const onPop = () => {
      // Back off the sentinel onto the review: stand on the sentinel again.
      if (!frozen.current || !sentinel.current) return;
      if ((window.history.state as Record<string, unknown> | null)?.[FREEZE_MARK]) return;
      window.history.pushState({ [FREEZE_MARK]: 1 }, '', window.location.href);
    };
    window.addEventListener('click', onClick, true);
    if (navApi?.addEventListener) navApi.addEventListener('navigate', onNavigate);
    else window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('click', onClick, true);
      navApi?.removeEventListener?.('navigate', onNavigate);
      window.removeEventListener('popstate', onPop);
    };
  }, []);
  const freeze = useCallback(() => {
    frozen.current = true;
    onHold(true);
    if (navigationApi()?.addEventListener || sentinel.current) return;
    sentinel.current = true;
    window.history.pushState({ [FREEZE_MARK]: 1 }, '', window.location.href);
  }, [onHold]);
  /** `stay`: the review goes on (an error it shows) — the sentinel is popped; a way out replaces it. */
  const thaw = useCallback(
    (stay: boolean) => {
      frozen.current = false;
      if (stay) onHold(false);
      if (!sentinel.current) return;
      sentinel.current = false;
      if (stay && (window.history.state as Record<string, unknown> | null)?.[FREEZE_MARK]) window.history.back();
    },
    [onHold]
  );

  const onContinue = () => {
    if (held || !priced) return;
    setAttempt(a => a + 1);
    if (check.ok) setConfirmOpen(true);
  };

  const submit = (quote: PricedQuote) => {
    if (create.isPending || leaving) return;
    // fish onConfirm = handleSubmit(onSubmit): validated again, the parsed (trimmed) values sent.
    const parsed = contactSchema.safeParse(values);
    if (!parsed.success) {
      setConfirmOpen(false);
      setAttempt(a => a + 1);
      return;
    }
    const contact = parsed.data;
    // The phone lives on the profile: an edited one is written back, fire-and-forget (c19).
    if (phoneChanged(contact.contactPhone, profile.data)) updateProfile.mutate({ phone: contact.contactPhone });
    freeze();
    // Navigation only: the toast and the cache work are the mutation's own (above).
    create.mutate(createInput(lakeId, sel, extras, contact, quote), {
      onSuccess: () => {
        thaw(false);
        setLeaving(true);
        onLeave();
        setConfirmOpen(false);
        nav.exitFlow();
      },
      onError: error => {
        setConfirmOpen(false);
        if (bookingSubmitFailure(error).kind === 'stand-gone') {
          // The selection is dead: back to the grid (read again) without it, to pick again.
          thaw(false);
          setLeaving(true);
          onLeave();
          nav.backToGrid();
          return;
        }
        thaw(true);
      },
    });
  };

  const header = <T4Header title={TITLE} titleId={TITLE_ID} eyebrow={lake.name} back={back} busy={pending} />;

  if (!priced) {
    return (
      <T4Frame pageState label={TITLE} header={header}>
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
  return (
    <>
      <T4Frame
        label={TITLE}
        header={header}
        aside={<PriceAside lake={lake} quote={priced} refreshing={refreshing} />}
        actions={
          <T4ActionBar
            className="bottom-[var(--review-kb-inset,0px)]"
            back={
              <Button variant="ghost" onClick={back.onClick} disabled={pending}>
                Înapoi
              </Button>
            }
            primary={
              // Held, never `disabled`: focus stays on it while a fresh price loads or the submit runs.
              <button
                type="button"
                data-testid="booking-submit"
                aria-disabled={held || undefined}
                aria-busy={pending || undefined}
                onClick={onContinue}
                className={buttonClass({ disabled: held })}
              >
                {pending ? <T4Spinner /> : null}
                Continuă
              </button>
            }
          />
        }
      >
        <T4ErrorSummary errors={shown?.list ?? []} attempt={attempt} />
        <SummaryCard
          lake={lake}
          standName={standName}
          startISO={sel.start}
          endISO={sel.end}
          checkoutBufferMinutes={checkoutBufferMinutes}
          quote={priced}
          refreshing={refreshing}
        />
        {isRequest ? (
          <T4Notice tone="pending" title="Este o cerere, nu o rezervare confirmată">
            Administratorul lacului o acceptă sau o refuză.
          </T4Notice>
        ) : null}
        <ContactCard values={values} errors={fieldErrors} disabled={pending} onChange={onChange} />
      </T4Frame>
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        lake={lake}
        standName={standName}
        startISO={sel.start}
        endISO={sel.end}
        checkoutBufferMinutes={checkoutBufferMinutes}
        total={priced.total}
        isRequest={isRequest}
        pending={pending}
        onConfirm={() => submit(priced)}
      />
    </>
  );
}
