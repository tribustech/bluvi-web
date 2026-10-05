'use client';

import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode, type Ref, type RefObject } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRightEndOnRectangleIcon,
  ArrowUturnLeftIcon,
  BanknotesIcon,
  BoltIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  DocumentTextIcon,
  ExclamationCircleIcon,
  MapPinIcon,
  NoSymbolIcon,
  PhoneIcon,
  SparklesIcon,
  UserIcon,
} from '@heroicons/react/24/outline';
import {
  bookingQuoteQuery,
  cancellationPolicyText,
  countNights,
  durationLabel,
  offeredExtras,
  rowLabelAddsMeaning,
  type BookingQuote,
  type LakeAvailability,
} from '@/core/booking';
import type { LakeDetail } from '@/core/lakes';
import { IconButton } from '@/components/nav/IconButton';
import { Dialog } from '@/components/surfaces/Dialog';
import { SegmentedControl } from '@/components/forms/SegmentedControl';
import { TextInput } from '@/components/forms/TextInput';
import { ButtonLink, buttonClass, type ButtonSize, type ButtonVariant } from '@/components/ui/Button';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import {
  T4ActionBar,
  T4ActionTotal,
  T4ChoiceCard,
  T4ErrorSummary,
  T4FieldGrid,
  T4Frame,
  T4Gate,
  T4Header,
  T4Notice,
  T4PriceRows,
  T4Progress,
  T4ReviewGroup,
  T4Rows,
  T4SaveStatus,
  T4Section,
  T4Spinner,
  T4StepList,
  T4Summary,
  T4TextArea,
  T4TotalLine,
  T4_CHOICE_GRID,
  validateStep,
  type T4FieldError,
  type T4Row,
  type T4SaveState,
  type T4Step,
  type T4Total,
} from '@/components/templates/T4';
import { createBrowserTransport } from '@/lib/client/transport';
import { routes } from '@/lib/routes';
import {
  blockText,
  contactSchema,
  dayIsFull,
  dayOptions,
  durationOptions,
  formatLei,
  formatSlot,
  intervalOf,
  intervalStepSchema,
  sanitizePhoneInput,
  standOptions,
  startOptions,
  tooSoonDayOptions,
  type Contact,
  type DayOption,
  type StandOption,
} from './model';
import { withTimeout } from './deadline';
import { readFlowParams, type DemoState, type FlowParams, type StepId } from './states';

export type DemoProfile = { username: string; phone: string | null };

/** Why the page has no data: the read failed (retry can help) or the lake does not exist (404). */
export type LoadProblem = 'failed' | 'missing';

type Props = {
  state: DemoState;
  /** From the URL: the back actions go to this lake even when its read failed. */
  lakeId: string;
  /** This flow's URL (with ?lake=, without ?state=): «Intră în cont» returns here, a retry reloads it. */
  flowHref: string;
  signInHref: string;
  signedIn: boolean;
  lake: LakeDetail | null;
  availability: LakeAvailability | null;
  /** Set when `lake` / `availability` are null. */
  problem: LoadProblem | null;
  profile: DemoProfile | null;
  /** The step and selection from the URL (a reload, a shared link, Back / Forward). */
  initial: FlowParams;
  /** Pinned once by the server, so SSR and hydration agree on «too soon» and the day list. */
  nowMs: number;
};

const STEP_TITLE: Record<StepId, string> = { interval: 'Interval și stand', extras: 'Extra', confirm: 'Confirmă' };
const PAGE_TITLE: Record<StepId, string> = {
  interval: 'Alege intervalul și standul',
  extras: 'Adaugă la rezervare',
  confirm: 'Confirmă rezervarea',
};
/** The gates' h1: one title for every state the flow cannot run in, so it never jumps between them. */
export const GATE_TITLE = 'Rezervă un stand';
/** The h1's id: a dismissed notice hands focus back to the top of the step. */
const TITLE_ID = 't4-title';
/** «Rezervările mele» (parity booking.rezervarile-mele web_route). */
const MY_BOOKINGS_HREF = '/rezervari';

const INTERVAL_FIELDS = [
  { name: 'day', id: 't4-day', label: 'Ziua sosirii' },
  { name: 'start', id: 't4-start', label: 'Ora de început' },
  { name: 'hours', id: 't4-hours', label: 'Durata' },
  { name: 'stand', id: 't4-stand', label: 'Standul' },
];
const CONTACT_FIELDS = [
  { name: 'contactFullname', id: 't4-name', label: 'Nume și prenume' },
  { name: 'contactPhone', id: 't4-phone', label: 'Număr telefon' },
  { name: 'notes', id: 't4-notes', label: 'Detalii adiționale' },
];

type Selection = { day: string; start: string; hours: number; stand: string };

/** States that open mid-flow, on a seeded selection. */
const OPENS_MID_FLOW: DemoState[] = [
  'done',
  'extras',
  'review',
  'contact-invalid',
  'refusal',
  'submitting',
  'submit-error',
  'draft',
  'save-error',
  'quoting',
  'quote-error',
  'price-changed',
  'stand-taken',
  'unknown-error',
];
const OPENS_ON_CONFIRM: DemoState[] = [
  'review',
  'contact-invalid',
  'refusal',
  'submitting',
  'submit-error',
  'price-changed',
  'unknown-error',
];

/**
 * The first selection that shows the whole flow: an evening start, a tour that crosses a night
 * (so per-night extras are offered), on a free stand that sells an extra. Used by the edge states
 * that open on step 2 / 3; the default state starts empty, as fish does.
 */
function seedSelection(av: LakeAvailability, days: DayOption[], nowMs: number): Selection | null {
  for (const day of days) {
    for (const start of [...av.slotStartTimes].reverse()) {
      if (startOptions(av, day, nowMs).find((o) => o.value === start)?.disabled) continue;
      for (const hours of durationOptions(av, start)) {
        const interval = intervalOf(av, day, start, hours);
        if (countNights(interval.startISO, interval.endISO, av.timezone) < 1) continue;
        const stand = standOptions(av, interval, nowMs).find((s) => s.status === 'available' && s.extras.length > 0);
        if (stand) return { day: day.key, start, hours, stand: stand.documentId };
      }
    }
  }
  return null;
}

/**
 * A CTA that refuses without leaving the tab order: `aria-disabled`, never native `disabled`, so
 * focus stays on it while a price loads or a submit runs (and the confirm dialog can return focus
 * to it). The disabled look is the kit's (buttonClass).
 * TODO(kit): replace with a `held` prop on components/ui/Button (aria-disabled + DISABLED look,
 * onClick swallowed) — this task may only touch the T4 folders, so the kit's icon slot is mirrored.
 */
function HeldButton({
  busy,
  onClick,
  icon,
  variant,
  size,
  ref,
  children,
}: {
  busy: boolean;
  onClick: () => void;
  icon?: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  ref?: Ref<HTMLButtonElement>;
  children: ReactNode;
}) {
  return (
    <button
      ref={ref}
      type="button"
      aria-disabled={busy || undefined}
      onClick={onClick}
      className={buttonClass({ disabled: busy, variant, size })}
    >
      {icon ? (
        <span aria-hidden className="flex size-5 items-center justify-center [&>svg]:size-5">
          {icon}
        </span>
      ) : null}
      {children}
    </button>
  );
}

/** The quote never hangs: past this it is a failed price (the notice with «Reîncearcă»). */
const QUOTE_TIMEOUT_MS = 10_000;

/** Focus the first of `els` that is rendered at this width (the others are display: none). */
function focusShown(...els: (HTMLElement | null)[]) {
  els.find((el) => el && el.getClientRects().length > 0)?.focus();
}

/** Replace or add `params` on the current URL's query (null removes), without a server round trip. */
function urlWith(params: Record<string, string | null>): string {
  const q = new URLSearchParams(window.location.search);
  for (const [k, v] of Object.entries(params)) {
    if (v == null) q.delete(k);
    else q.set(k, v);
  }
  const s = q.toString();
  return `${window.location.pathname}${s ? `?${s}` : ''}`;
}

export function BookingDemo({
  state,
  lakeId,
  flowHref,
  signInHref,
  signedIn,
  lake,
  availability: av,
  problem,
  profile,
  initial,
  nowMs,
}: Props) {
  const t = useMemo(() => withTimeout(createBrowserTransport(), QUOTE_TIMEOUT_MS), []);
  const router = useRouter();
  const searchParams = useSearchParams();
  const days = useMemo(() => (av && state !== 'no-availability' ? dayOptions(av, nowMs) : []), [av, nowMs, state]);
  const tooSoonDays = useMemo(() => (av && days.length ? tooSoonDayOptions(av, nowMs) : []), [av, days.length, nowMs]);

  const seeded = useMemo(
    () => (av && OPENS_MID_FLOW.includes(state) ? seedSelection(av, days, nowMs) : null),
    [av, days, nowMs, state],
  );

  const [sel, setSel] = useState<Partial<Selection>>(() => {
    // The URL first: a reload or a shared link resumes the selection (a stand that is no longer
    // free is dropped below — the flow then explains it and returns to the grid).
    if (av && initial.day && days.some((d) => d.key === initial.day))
      return normalise(av, days, nowMs, { day: initial.day, start: initial.start, hours: initial.hours, stand: initial.stand });
    // STAND_TAKEN: back on the grid with the interval kept and the stand cleared (fish).
    if (seeded && state === 'stand-taken') return { ...seeded, stand: undefined };
    if (seeded) return seeded;
    // The validation state: «Continuă» pressed with nothing chosen.
    if (state === 'invalid' || !av) return {};
    // «Prea curând»: today / tomorrow picked — fish sends these to the phone.
    if (state === 'too-soon' && tooSoonDays[0]) return { day: tooSoonDays[0].key };
    // Like fish's grid, nothing is picked for the angler — but the first day shown is one with
    // a free stand, not a day the lake is closed for a competition.
    for (const day of days) {
      const s = normalise(av, days, nowMs, { day: day.key });
      if (s.start && s.hours && standOptions(av, intervalOf(av, day, s.start, s.hours), nowMs).some((o) => o.status === 'available'))
        return s;
    }
    return normalise(av, days, nowMs, { day: days[0]?.key });
  });
  const [extras, setExtras] = useState<string[]>(() => {
    if (initial.extras && initial.day) return initial.extras;
    if (!seeded || !av || state === 'stand-taken') return [];
    const stand = av.stands.find((s) => s.documentId === seeded.stand);
    // The refusal state asks for an extra this stand does not sell: the server refuses the quote.
    if (state === 'refusal') return av.extras.filter((e) => !stand?.extras.includes(e.key)).slice(0, 1).map((e) => e.key);
    return stand?.extras.slice(0, 1) ?? [];
  });
  // The step lives in the URL (`?step=`): «Continuă» / a step jump push a history entry, so the
  // browser's Back and Forward walk the steps and a reload stays on the step. Without the param,
  // the state's own opening step.
  const openingStep: StepId = state === 'extras' ? 'extras' : OPENS_ON_CONFIRM.includes(state) ? 'confirm' : 'interval';
  const requestedStep: StepId = readFlowParams(searchParams ?? new URLSearchParams()).step ?? openingStep;
  const [visited, setVisited] = useState<Set<StepId>>(
    () =>
      new Set<StepId>(
        requestedStep === 'confirm' ? ['interval', 'extras', 'confirm'] : requestedStep === 'extras' ? ['interval', 'extras'] : ['interval'],
      ),
  );
  // A later step reached without a usable stand (a reload after the stand was taken, an old link):
  // back on the grid, and the step says why.
  const [lostSelection, setLostSelection] = useState(false);
  const [contact, setContact] = useState<Contact>(() =>
    state === 'contact-invalid'
      ? { contactFullname: '', contactPhone: '07', notes: '' }
      : { contactFullname: profile?.username ?? '', contactPhone: profile?.phone ?? '', notes: '' },
  );
  // The real screen reads the profile on the client: when it arrives after the first render, it
  // fills the fields the user has not typed in (parity rezerva-confirmare: «fields fill in»).
  const [seenProfile, setSeenProfile] = useState(profile);
  if (profile !== seenProfile) {
    setSeenProfile(profile);
    if (profile && state !== 'contact-invalid')
      setContact((c) => ({
        ...c,
        contactFullname: c.contactFullname || profile.username,
        contactPhone: c.contactPhone || (profile.phone ?? ''),
      }));
  }
  // Forced failed attempts: the validation edge states open with their summary already up.
  const [attempt, setAttempt] = useState<Record<StepId, number>>({
    interval: state === 'invalid' ? 1 : 0,
    extras: 0,
    confirm: state === 'contact-invalid' ? 1 : 0,
  });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(state === 'submitting');
  // A failed submit: no answer (network) or a code the screen has no copy for (unknown).
  const [submitError, setSubmitError] = useState<'network' | 'unknown' | null>(
    state === 'submit-error' ? 'network' : state === 'unknown-error' ? 'unknown' : null,
  );
  const [done, setDone] = useState(state === 'done' || Boolean(initial.sent));
  // Opened on a sent booking's URL (a reload or Back / Forward after «Trimite cererea»): the outcome
  // again, never a submittable step — but this mount no longer knows what was sent.
  const sentFromUrl = Boolean(initial.sent) && state !== 'done';
  const [draftDismissed, setDraftDismissed] = useState(false);
  // 409 PRICE_CHANGED: the user stays on the review, the price is asked for again.
  const [priceChanged, setPriceChanged] = useState(state === 'price-changed');
  // STAND_TAKEN: sent back to the grid; the notice stays until another stand is picked.
  const [standTaken] = useState(state === 'stand-taken');
  // «Reîncearcă» on a load error: the re-read runs in a transition, so the button is busy
  // (and cannot stack refreshes) until the new page commits.
  const [reloading, startReload] = useTransition();
  // The save-error notice stays mounted through its retry (focus never falls to <body>).
  const [saveNotice] = useState(state === 'save-error');
  // Create-competition autosave, shown here through the forced states.
  const [save, setSave] = useState<T4SaveState>(() =>
    state === 'draft'
      ? { kind: 'saved', label: 'Salvat · acum 2 min' }
      : state === 'save-error'
        ? { kind: 'error', label: 'Nu s-a salvat' }
        : { kind: 'idle' },
  );
  const quoteNotice = useRef<HTMLDivElement>(null);
  const asideQuote = useRef<HTMLDivElement>(null);
  const submitNotice = useRef<HTMLDivElement>(null);
  const asideSubmitNotice = useRef<HTMLDivElement>(null);
  const saveNoticeRef = useRef<HTMLDivElement>(null);
  const tooSoonNotice = useRef<HTMLDivElement>(null);
  const forcedNotice = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  // A failed submit moves focus to its notice (once per failure).
  useEffect(() => {
    if (submitError) focusShown(submitNotice.current, asideSubmitNotice.current);
  }, [submitError]);

  const day = days.find((d) => d.key === sel.day);
  const tooSoonDay = tooSoonDays.find((d) => d.key === sel.day) ?? null;
  const interval = av && day && sel.start && sel.hours ? intervalOf(av, day, sel.start, sel.hours) : null;
  const rawStands = av ? standOptions(av, interval, nowMs) : [];
  // The forced STAND_TAKEN answer: the stand that was just taken shows «Ocupat» on the grid (the
  // real screen re-reads availability, below), so it cannot be picked into the same error again.
  const stands =
    standTaken && seeded
      ? rawStands.map((s) => (s.documentId === seeded.stand && s.status === 'available' ? { ...s, status: 'booked' as const } : s))
      : rawStands;
  const stand = stands.find((s) => s.documentId === sel.stand && s.status === 'available') ?? null;
  const nights = interval && av ? countNights(interval.startISO, interval.endISO, av.timezone) : 0;
  const offered = av && stand ? offeredExtras(stand, av.extras, nights) : [];
  // The extras step exists only when the chosen stand can add something (fish extras.tsx); before
  // a stand is chosen, when any stand sells something.
  const hasExtrasStep = stand ? offered.length > 0 : Boolean(av?.stands.some((s) => s.extras.length > 0));
  const flow: StepId[] = hasExtrasStep ? ['interval', 'extras', 'confirm'] : ['interval', 'confirm'];
  // The refusal state forces an extra the stand does not sell — on the seeded stand only: another
  // stand or «Alege alt interval» drops it, so the flow can always be finished from there.
  const forceRefusal = state === 'refusal' && stand?.documentId === seeded?.stand;
  const activeExtras = extras.filter((k) => forceRefusal || offered.some((e) => e.key === k));

  const baseQuote = bookingQuoteQuery(t, {
    lakeId: lake?.documentId,
    standId: stand?.documentId,
    startISO: interval?.startISO,
    endISO: interval?.endISO,
    extras: activeExtras,
  });
  const quoteQuery = useQuery({
    ...baseQuote,
    // «Preț eșuat»: the quote request fails (its own cache key, so the real answer is untouched).
    ...(state === 'quote-error'
      ? {
          queryKey: [...baseQuote.queryKey, 'demo-fail'] as unknown as typeof baseQuote.queryKey,
          queryFn: (): Promise<BookingQuote> => Promise.reject(new Error('Demo: cererea de preț a eșuat')),
          retry: false,
        }
      : {}),
    // «Se calculează»: the quote is held, as if the request never came back. A real hang ends at
    // QUOTE_TIMEOUT_MS (the transport) as a failed price.
    enabled: state !== 'quoting' && Boolean(lake && stand && interval) && signedIn,
  });
  const quoteFor = Boolean(stand && interval);
  // A placeholder (the previous selection's answer) is never a price for THIS selection: the CTA
  // cannot commit to it and an old refusal does not speak for the new choice.
  const fresh = !quoteQuery.isPlaceholderData;
  const quote: BookingQuote | undefined = fresh ? quoteQuery.data : undefined;
  const priced = quote?.total != null ? quote : null;
  const isQuoting = quoteFor && (state === 'quoting' || quoteQuery.isFetching);
  const refusal = !isQuoting && quote?.total === null ? quote.refusal : null;
  const quoteFailed = quoteFor && !isQuoting && quoteQuery.isError;

  // PRICE_CHANGED / STAND_TAKEN open on their notice: focus it. PRICE_CHANGED asks for the price
  // again; STAND_TAKEN re-reads availability (fish c7: the grid is refetched on every return).
  useEffect(() => {
    if (state !== 'price-changed' && state !== 'stand-taken') return;
    forcedNotice.current?.focus();
    if (state === 'price-changed') void quoteQuery.refetch();
    if (state === 'stand-taken') router.refresh();
    // Mount only: the forced state is the server's answer to a submit that just happened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reached a later step without a usable stand: the grid, with a notice (fish sends it back too).
  const lost = Boolean(av && lake && requestedStep !== 'interval' && !stand && !submitting && !done);
  const step: StepId = lost ? 'interval' : requestedStep;
  if (lost && !lostSelection) setLostSelection(true);
  if (!visited.has(step)) setVisited((v) => new Set(v).add(step));
  useEffect(() => {
    // The URL stops claiming a step the page is not on.
    if (lost) window.history.replaceState(null, '', urlWith({ step: null }));
  }, [lost]);

  // Every step change starts at the top of the page — «Continuă», a step jump AND the browser's
  // Back / Forward (the step comes from the URL there). T4Header's focusKey focuses the h1 without
  // scrolling; from 1280 the header is not sticky, so without this the focused h1 is off screen.
  const shownStep = useRef(step);
  useEffect(() => {
    if (shownStep.current === step) return;
    shownStep.current = step;
    window.scrollTo({ top: 0 });
  }, [step]);

  // The selection follows in the URL (replace, not push: picking a day is not a page). Not once
  // sent: the outcome's URL carries no selection to resubmit.
  useEffect(() => {
    if (!av || done) return;
    const next = urlWith({
      day: sel.day ?? null,
      start: sel.start ?? null,
      hours: sel.hours ? String(sel.hours) : null,
      stand: sel.stand ?? null,
      extras: extras.length ? extras.join(',') : null,
    });
    if (next !== `${window.location.pathname}${window.location.search}`) window.history.replaceState(null, '', next);
  }, [av, sel, extras, done]);

  const focusTitle = () => document.getElementById(TITLE_ID)?.focus({ preventScroll: true });
  const retryLoad = () => {
    if (reloading) return;
    startReload(() => (state === 'error' ? router.push(flowHref) : router.refresh()));
  };

  // ── Gates (the step content cannot be shown) ───────────────────────────────────────────────────
  const eyebrow = lake ? `${lake.name} · Rezervare` : 'Rezervare';
  // The lake is known from the URL: «Înapoi la baltă» goes there even when its read failed.
  const lakeHref = routes.lake(lakeId);
  const backToLake = { label: 'Înapoi la baltă', href: lakeHref };
  // `reserve` only on the gates that turn into step 1 in place (signed out, a load error after
  // «Reîncearcă»): the header keeps the step header's height so nothing jumps then. Terminal gates
  // (nothing to book, missing lake, sent) have no step to become: no reserved band.
  const gateHeader = (inPlace: boolean) => (
    <T4Header eyebrow={eyebrow} title={GATE_TITLE} back={backToLake} reserve={inPlace ? 3 : undefined} />
  );
  // From 1280 a gate keeps the frame's right column: the lake being booked, so the page keeps the
  // step layout's shape instead of one card under the title and an empty canvas.
  const lakeAside = lake ? <T4Summary title="Balta" header={<LakeIdentity lake={lake} />} rows={[]} /> : undefined;

  if (problem === 'missing') {
    // The lake does not exist (deleted, a bad link): no retry can fix it, so none is offered.
    return (
      <T4Frame header={<T4Header eyebrow="Rezervare" title={GATE_TITLE} back={{ label: 'Înapoi la bălți', href: routes.lakes() }} />}>
        <T4Gate
          align="start"
          indent
          icon={<MapPinIcon />}
          title="Balta nu mai există"
          description="Linkul duce la o baltă care nu mai e pe Bluvi. Caută alta în lista de bălți."
          actions={<ButtonLink href={routes.lakes()}>Înapoi la bălți</ButtonLink>}
        />
      </T4Frame>
    );
  }
  // Signed out: only the lake was read (its name), never the availability — the gate is the answer.
  if (!signedIn && lake) {
    return (
      <T4Frame header={gateHeader(true)} aside={lakeAside}>
        <T4Gate
          align="start"
          indent
          icon={<ArrowRightEndOnRectangleIcon />}
          title="Intră în cont ca să rezervi"
          description={`Rezervarea la ${lake.name} se face din contul tău: așa primești confirmarea și o găsești la Rezervările mele.`}
          actions={
            <>
              <ButtonLink href={signInHref}>Intră în cont</ButtonLink>
              <ButtonLink href={lakeHref} variant="secondary">
                Înapoi la baltă
              </ButtonLink>
            </>
          }
        />
      </T4Frame>
    );
  }
  if (!lake || !av) {
    return (
      <T4Frame header={gateHeader(true)} aside={lakeAside}>
        <T4Gate
          tone="danger"
          role="alert"
          align="start"
          indent
          icon={<ExclamationCircleIcon />}
          title="Disponibilitatea nu s-a încărcat"
          description="A apărut o eroare la încărcarea disponibilității."
          actions={
            <>
              <HeldButton busy={reloading} onClick={retryLoad} icon={reloading ? <T4Spinner /> : undefined}>
                {reloading ? 'Se reîncarcă…' : 'Reîncearcă'}
              </HeldButton>
              <ButtonLink href={lakeHref} variant="secondary">
                Înapoi la baltă
              </ButtonLink>
            </>
          }
        />
        <p role="status" className="sr-only">
          {reloading ? 'Se reîncarcă disponibilitatea…' : ''}
        </p>
      </T4Frame>
    );
  }
  const lakePhone = lake.contact.find((c) => c.phone)?.phone ?? null;
  if (state === 'empty' || !av.bookingEnabled) {
    // Copy: parity rezerva-grila.c26. Not a dead end: the phone books what the web cannot.
    return (
      <T4Frame header={gateHeader(false)} aside={lakeAside}>
        <T4Gate
          align="start"
          indent
          icon={<NoSymbolIcon />}
          title="Rezervările nu sunt disponibile"
          description="Acest lac nu acceptă deocamdată rezervări online."
          actions={
            lakePhone ? (
              <>
                <ButtonLink href={`tel:${lakePhone}`} icon={<PhoneIcon />}>
                  Sună la baltă
                </ButtonLink>
                <ButtonLink href={lakeHref} variant="secondary">
                  Înapoi la baltă
                </ButtonLink>
              </>
            ) : (
              <ButtonLink href={lakeHref}>Înapoi la baltă</ButtonLink>
            )
          }
        />
      </T4Frame>
    );
  }
  if (days.length === 0 || av.stands.length === 0) {
    return (
      <T4Frame header={gateHeader(false)} aside={lakeAside}>
        <T4Gate
          align="start"
          indent
          icon={<CalendarDaysIcon />}
          title="Nicio disponibilitate"
          description="Nu există standuri sau intervale disponibile pentru această perioadă."
          actions={<ButtonLink href={lakeHref}>Înapoi la baltă</ButtonLink>}
        />
      </T4Frame>
    );
  }
  const isRequest = lake.confirmationMode === 'manual' || lake.paymentMode === 'offline';
  // fish BookingConfirmSheet `collectsUpFront`: a refund line only when money is taken up front.
  const collectsUpFront = lake.paymentMode === 'deposit' || lake.paymentMode === 'full';
  const cancellation = collectsUpFront ? cancellationPolicyText(lake.cancellationPolicy) : null;
  // The departure the angler sees: the slot end minus the lake's checkout buffer (parity
  // rezerva-grila.c28, rezerva-confirmare.c4). The quote still asks for the raw slot end.
  const bufferMinutes = lake.checkoutBufferMinutes ?? 0;
  const departureISO = interval ? new Date(new Date(interval.endISO).getTime() - bufferMinutes * 60_000).toISOString() : null;

  // ── Validation ─────────────────────────────────────────────────────────────────────────────────
  const rawIntervalCheck = validateStep(
    intervalStepSchema,
    { day: sel.day ?? '', start: sel.start ?? '', hours: sel.hours, stand: stand?.documentId ?? '' },
    INTERVAL_FIELDS,
  );
  // Start and duration only exist once a bookable day is picked (and are then always filled):
  // without one the summary names the day and the stand, never two fields that are not on screen.
  // A day with no free start shows one line (#t4-start) instead of both controls: the duration is
  // not named, it cannot be chosen before a start.
  const dayStarts = startOptions(av, day, nowMs).filter((o) => !o.disabled);
  const intervalCheck =
    sel.day && !tooSoonDay
      ? dayStarts.length
        ? rawIntervalCheck
        : { ...rawIntervalCheck, list: rawIntervalCheck.list.filter((e) => e.id !== 't4-hours') }
      : { ...rawIntervalCheck, list: rawIntervalCheck.list.filter((e) => e.id !== 't4-start' && e.id !== 't4-hours') };
  const contactCheck = validateStep(contactSchema, contact, CONTACT_FIELDS);
  const shown = {
    interval: attempt.interval > 0 ? intervalCheck : null,
    confirm: attempt.confirm > 0 ? contactCheck : null,
  };

  // ── Steps ──────────────────────────────────────────────────────────────────────────────────────
  const intervalSummary = stand && interval ? `Standul ${stand.name} · ${formatSlot(interval.startISO, av.timezone)}` : undefined;
  const extrasSummary = activeExtras.length
    ? activeExtras.map((k) => av.extras.find((e) => e.key === k)?.label ?? k).join(', ')
    : visited.has('confirm')
      ? 'Fără extra'
      : undefined;
  const stepState = (id: StepId): T4Step['state'] => {
    if (id === step) return 'current';
    if (id === 'interval' && attempt.interval > 0 && !intervalCheck.ok) return 'error';
    if (id === 'confirm' && attempt.confirm > 0 && !contactCheck.ok) return 'error';
    if (!visited.has(id)) return 'upcoming';
    if (id === 'interval') return intervalCheck.ok ? 'done' : 'upcoming';
    return flow.indexOf(id) < flow.indexOf(step) ? 'done' : 'upcoming';
  };
  const steps: T4Step[] = flow.map((id) => ({
    id,
    title: STEP_TITLE[id],
    state: stepState(id),
    reachable: visited.has(id) && (id === 'interval' || intervalCheck.ok),
    summary: stepState(id) === 'done' ? (id === 'interval' ? intervalSummary : id === 'extras' ? extrasSummary : undefined) : undefined,
  }));
  const index = Math.max(0, flow.indexOf(step));

  // The header's h1 takes focus on every step change (T4Header `focusKey`); the page starts at the
  // top (the effect on `step` above, so Back / Forward do it too).
  // A new history entry per step: Back / Forward walk the steps (the URL is the step's source).
  const goTo = (id: string) => {
    if (submitting || id === step) return;
    setVisited((v) => new Set(v).add(id as StepId));
    window.history.pushState(null, '', urlWith({ step: id }));
  };
  // fish: no CTA without a price (review.tsx hides its footer; extras.tsx disables «Continuă»).
  // Step 1 refuses through validation until a stand is picked, then waits for a fresh price.
  const waitingForPrice = step === 'interval' ? quoteFor && !priced : !priced;
  const primaryBusy = submitting || waitingForPrice || Boolean(tooSoonDay);
  const next = () => {
    if (primaryBusy) {
      // A refused / failed price, or a day only the phone can book, is why the CTA waits: take
      // the user to the reason.
      if (submitting) return;
      if (tooSoonDay) tooSoonNotice.current?.focus();
      else if (refusal || quoteFailed) focusShown(quoteNotice.current, asideQuote.current);
      return;
    }
    if (step === 'interval') {
      setAttempt((a) => ({ ...a, interval: a.interval + 1 }));
      if (!intervalCheck.ok) return;
    }
    if (step === 'confirm') {
      setAttempt((a) => ({ ...a, confirm: a.confirm + 1 }));
      if (contactCheck.ok) setConfirmOpen(true);
      return;
    }
    goTo(flow[index + 1]);
  };
  const prev = () => goTo(flow[Math.max(0, index - 1)]);
  const submit = () => {
    setConfirmOpen(false);
    setSubmitError(null);
    setPriceChanged(false);
    setSubmitting(true);
    // Demo only: no booking is created. The real screen calls createBookingMutation (core/booking).
    window.setTimeout(() => {
      setSubmitting(false);
      setDone(true);
      // The outcome's own URL: no step, no selection — a reload or Back→Forward shows the outcome
      // again and never lands on a live «Trimite cererea» (a duplicate booking). The real screen
      // puts the booking's id here and reads it back (or redirects to /rezervari).
      window.history.replaceState(
        null,
        '',
        urlWith({ step: null, day: null, start: null, hours: null, stand: null, extras: null, sent: 'demo' }),
      );
      window.scrollTo({ top: 0 });
    }, 1400);
  };
  const retrySave = () => {
    if (save.kind === 'saving') return;
    setSave({ kind: 'saving' });
    window.setTimeout(() => {
      // The retry button leaves with the success: focus the notice first, which stays (now «salvată»).
      saveNoticeRef.current?.focus();
      setSave({ kind: 'saved', label: 'Salvat · acum' });
    }, 900);
  };
  // Back to the grid's stand choice: from step 1 the stands are right there.
  const backToSelection = () => {
    if (step === 'interval') {
      const el = document.getElementById('t4-stand');
      el?.focus();
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    // fish resets extras on return to the grid (parity rezerva-extra.c8).
    setExtras([]);
    goTo('interval');
  };

  // ── Money ──────────────────────────────────────────────────────────────────────────────────────
  // The total line is always there (its value «—» until a fresh price), so nothing under it moves
  // when the quote lands.
  const pct = lake.depositPercent ?? 0;
  const total: T4Total =
    lake.paymentMode === 'deposit'
      ? {
          label: 'Avans de plată',
          sub: priced ? `${pct}% din ${formatLei(priced.total)}` : `${pct}% din total`,
          value: priced ? formatLei((priced.total * pct) / 100) : null,
        }
      : lake.paymentMode === 'full'
        ? { label: 'De plată acum', value: priced ? formatLei(priced.total) : null }
        : { label: 'Total', sub: 'se plătește la fața locului', value: priced ? formatLei(priced.total) : null };
  const extraLabel = (k: string) => av.extras.find((e) => e.key === k)?.label ?? k;
  // Price rows: the quote's when fresh; while it loads, the same rows (tour + chosen extras) with «—».
  const breakdown: T4Row[] = priced
    ? [
        {
          label: rowLabelAddsMeaning(priced.basis.rowLabel, priced.basis.durationHours)
            ? (priced.basis.rowLabel as string)
            : `Tur ${priced.basis.durationHours}h`,
          value: formatLei(priced.basis.tourPrice),
        },
        ...priced.basis.extras.map((e) => ({
          label: e.quantity > 1 ? `${e.label} × ${e.quantity}` : e.label,
          value: formatLei(e.total),
        })),
      ]
    : sel.hours
      ? // The tour line from the moment a duration is chosen («—» until priced): the receipt keeps
        // its shape (and the skeleton's), only the figures arrive.
        [{ label: `Tur ${sel.hours}h`, value: null }, ...activeExtras.map((k) => ({ label: extraLabel(k), value: null }))]
      : [];
  const choiceRows: T4Row[] = [
    { label: 'Standul', value: stand ? stand.name : null },
    { label: 'Sosire', value: interval ? formatSlot(interval.startISO, av.timezone) : null },
    { label: 'Plecare', value: departureISO ? formatSlot(departureISO, av.timezone) : null },
  ];
  // While the price is computed the total line says so (the bar's meta is hidden from 1280, so
  // this is the only progress there). A failed or refused price says why in the same place, in
  // the danger hue: from 1280 the summary is where the user looks, beside the CTA it holds.
  const priceProblem = Boolean(quoteFor && (refusal || quoteFailed));
  const shownTotal: T4Total = isQuoting
    ? { ...total, sub: 'Calculăm prețul…', busy: true }
    : priceProblem
      ? { ...total, sub: refusal ? 'Preț refuzat de baltă' : 'Prețul nu e disponibil', tone: 'danger' }
      : total;
  const footnote =
    step === 'interval' && !sel.stand ? 'Prețul îl calculează balta după ce alegi standul.' : (cancellation ?? undefined);
  const lakeIdentity = <LakeIdentity lake={lake} />;

  if (done) {
    // The step layout's frame, finished: every step done in the rail, what was sent in the summary
    // column (under the message below 1280), only the outcome and its ways on in the form column.
    // Opened from the sent URL, this mount does not know the selection: the lake alone.
    const doneSteps: T4Step[] = flow.map((id) => ({
      id,
      title: STEP_TITLE[id],
      state: 'done',
      reachable: false,
      summary: sentFromUrl ? undefined : id === 'interval' ? intervalSummary : id === 'extras' ? (extrasSummary ?? 'Fără extra') : undefined,
    }));
    return (
      <T4Frame
        header={<T4Header eyebrow={eyebrow} title="Rezervarea ta" back={backToLake} />}
        rail={<T4StepList steps={doneSteps} label="Pașii rezervării" />}
        aside={
          sentFromUrl ? (
            lakeAside
          ) : (
            <T4Summary
              title="Ce ai trimis"
              header={lakeIdentity}
              rows={choiceRows}
              priceRows={priced ? breakdown : undefined}
              // A confirmation never shows an empty total: the line only once the price is known.
              total={priced ? total : null}
              footnote={priced ? (cancellation ?? undefined) : undefined}
            />
          )
        }
        asideBelow
      >
        <T4Gate
          tone="success"
          align="start"
          indent="below-xl"
          focusOnMount
          icon={<CheckCircleIcon />}
          title={isRequest ? 'Cererea a fost trimisă' : 'Rezervare confirmată'}
          description={
            <>
              {isRequest
                ? `Administratorul ${lake.name} o acceptă sau o refuză. Te anunțăm când răspunde.`
                : 'Te așteptăm la baltă.'}
              <span className="mt-2 block t-caption text-muted">Demonstrație: nu s-a trimis nimic la server.</span>
            </>
          }
          actions={
            <>
              <ButtonLink href={lakeHref}>Înapoi la baltă</ButtonLink>
              <ButtonLink href={MY_BOOKINGS_HREF} variant="secondary">
                Rezervările mele
              </ButtonLink>
            </>
          }
        />
      </T4Frame>
    );
  }

  const metaLabel = priced
    ? total.label
    : isQuoting
      ? 'Calculăm prețul…'
      : refusal
        ? 'Preț refuzat de baltă'
        : quoteFailed
          ? 'Prețul nu e disponibil'
          : tooSoonDay
            ? 'Doar telefonic'
            : !interval
              ? 'Alege ziua, ora și durata'
              : 'Alege un stand liber';
  const meta = (
    <T4ActionTotal
      label={metaLabel}
      sub={priced && sel.hours ? durationLabel(sel.hours, Number(sel.start?.slice(0, 2) ?? 0)) : undefined}
      value={priced ? total.value : null}
      busy={isQuoting}
      live
    />
  );

  const primaryLabel = step === 'confirm' ? (isRequest ? 'Trimite cererea' : 'Rezervă') : 'Continuă';
  const errors: T4FieldError[] = step === 'interval' ? (shown.interval?.list ?? []) : step === 'confirm' ? (shown.confirm?.list ?? []) : [];

  // The price can't be had. Below 1280: a notice under the step's content (never above it, where
  // it would push the form the user is reading). From 1280: in the summary column, under the total
  // that has no figure and beside the CTA that waits for it (the notice would sit under 21
  // stands, below the fold). Either is focused when the CTA is pressed.
  // Copy: parity rezerva-confirmare.c3 (fish QuoteUnavailable).
  // `stacked`: the notice's stacked layout pulls the ghost onto the text column (its padding
  // outdented); in the summary column the two sit on one row, so no outdent there.
  const quoteActions = (stacked: boolean) => (
    <>
      {refusal ? null : (
        <Button size="compact" variant="secondary" onClick={() => quoteQuery.refetch()}>
          Reîncearcă
        </Button>
      )}
      <Button size="compact" variant={refusal ? 'secondary' : 'ghost'} className={refusal || !stacked ? undefined : '-ml-3 @2xl:ml-0'} onClick={backToSelection}>
        Înapoi la selecție
      </Button>
    </>
  );
  const quoteProblem =
    priceProblem ? (
      <T4Notice
        ref={quoteNotice}
        tabIndex={-1}
        tone="danger"
        role="alert"
        className="xl:hidden"
        title={refusal ? refusal.message : 'Nu am putut calcula prețul pentru acest interval.'}
        actions={quoteActions(true)}
      >
        {refusal ? 'Alege alt interval sau alt stand.' : 'Verifică legătura la internet și reîncearcă.'}
      </T4Notice>
    ) : null;

  // A failed submit, beside «Trimite cererea» at every width: under the form below 1280, inside the
  // summary column (no second card: `inline`) from 1280. One copy is shown per width; a focus
  // goes to the shown one.
  const submitProblem = (where: 'form' | 'aside') =>
    step === 'confirm' && submitError ? (
      <T4Notice
        ref={where === 'form' ? submitNotice : asideSubmitNotice}
        tabIndex={-1}
        tone="danger"
        role="alert"
        inline={where === 'aside'}
        className={where === 'form' ? 'xl:hidden' : 'hidden border-t border-hairline pt-4 xl:block'}
        title={isRequest ? 'Cererea nu a fost trimisă' : 'Rezervarea nu a fost făcută'}
        actions={
          <Button
            size="compact"
            variant="secondary"
            onClick={() => {
              // The notice leaves with the retry: the CTA (now «Se trimite…») keeps focus.
              primaryRef.current?.focus();
              submit();
            }}
          >
            Reîncearcă
          </Button>
        }
      >
        {submitError === 'unknown'
          ? 'A apărut o eroare. Reîncearcă peste câteva momente.'
          : 'Serverul nu a răspuns. Alegerile și datele de contact au rămas aici.'}
      </T4Notice>
    ) : null;

  return (
    <>
      <T4Frame
        label={`Pasul ${index + 1}: ${STEP_TITLE[step]}`}
        header={
          <T4Header
            eyebrow={eyebrow}
            title={PAGE_TITLE[step]}
            titleId={TITLE_ID}
            step={index + 1}
            total={flow.length}
            status={save.kind === 'idle' ? undefined : <T4SaveStatus state={save} />}
            // The autosaving flows keep the status line's place, so the first save does not grow it.
            reserveStatus={state === 'draft' || state === 'save-error'}
            back={index === 0 ? backToLake : { label: 'Pasul anterior', onClick: prev }}
            busy={submitting}
            focusKey={step}
            // While a submit runs the steps are display only (as the header's back control).
            progress={<T4Progress steps={steps} onSelect={submitting ? undefined : goTo} label="Pașii rezervării" />}
          />
        }
        rail={
          <div className="flex flex-col gap-6">
            <T4StepList steps={steps} onSelect={submitting ? undefined : goTo} label="Pașii rezervării" />
            <p className="t-caption text-muted">
              Rezervi cu cel puțin {av.leadHours ?? 24} de ore înainte. Pentru azi și mâine, sună la baltă.
            </p>
          </div>
        }
        aside={
          <T4Summary
            title="Rezumat"
            header={lakeIdentity}
            rows={choiceRows}
            priceRows={breakdown}
            total={shownTotal}
            // From 1280 this is the screen's one announced total (the bar's meta is hidden there).
            liveTotal
            footnote={priceProblem ? (refusal ? `${refusal.message} Alege alt interval sau alt stand.` : 'Verifică legătura la internet și reîncearcă.') : footnote}
          >
            {priceProblem ? (
              <div ref={asideQuote} tabIndex={-1} className="-mt-1 flex flex-wrap gap-2 rounded-control outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
                {quoteActions(false)}
              </div>
            ) : null}
            {submitProblem('aside')}
          </T4Summary>
        }
        actions={
          <T4ActionBar
            back={
              index > 0 ? (
                <Button variant="ghost" onClick={prev} disabled={submitting}>
                  Înapoi
                </Button>
              ) : undefined
            }
            // On «Confirmă» the review card carries the total: one signature number per screen.
            meta={step === 'confirm' ? undefined : meta}
            metaBelowXl
            primary={
              <HeldButton ref={primaryRef} busy={primaryBusy} onClick={next} icon={submitting ? <T4Spinner /> : undefined}>
                {submitting ? 'Se trimite…' : primaryLabel}
              </HeldButton>
            }
          />
        }
      >
        <T4ErrorSummary errors={errors} attempt={step === 'interval' ? attempt.interval : attempt.confirm} />

        {standTaken && step === 'interval' && !sel.stand ? (
          <T4Notice ref={forcedNotice} tabIndex={-1} tone="warning" role="alert" title="Standul a fost rezervat între timp">
            Alege alt stand.
          </T4Notice>
        ) : null}
        {lostSelection && step === 'interval' && !sel.stand && !standTaken ? (
          <T4Notice tone="info" role="status" title="Alege din nou standul">
            Standul din link nu mai e liber pentru intervalul ales, așa că am revenit la primul pas.
          </T4Notice>
        ) : null}

        {saveNotice ? (
          save.kind === 'saved' ? (
            <T4Notice ref={saveNoticeRef} tabIndex={-1} tone="success" title="Ciorna e salvată">
              Alegerile tale sunt păstrate.
            </T4Notice>
          ) : (
            <T4Notice
              ref={saveNoticeRef}
              tabIndex={-1}
              tone="warning"
              title="Ciorna nu s-a salvat"
              actions={
                <HeldButton
                  busy={save.kind === 'saving'}
                  onClick={retrySave}
                  variant="secondary"
                  size="compact"
                  icon={save.kind === 'saving' ? <T4Spinner /> : undefined}
                >
                  {save.kind === 'saving' ? 'Se salvează…' : 'Reîncearcă'}
                </HeldButton>
              }
            >
              Alegerile rămân pe ecran. Încercăm din nou când reapare conexiunea.
            </T4Notice>
          )
        ) : null}
        {(state === 'draft' || state === 'save-error') && !draftDismissed ? (
          <T4Notice
            tone="info"
            title="Ai o rezervare începută"
            actions={
              <>
                <Button
                  size="compact"
                  variant="secondary"
                  onClick={() => {
                    // The notice leaves: the step's title takes focus, never <body>.
                    focusTitle();
                    setDraftDismissed(true);
                  }}
                >
                  Continuă de unde ai rămas
                </Button>
                <Button
                  size="compact"
                  variant="ghost"
                  className="-ml-3 @2xl:ml-0"
                  onClick={() => {
                    focusTitle();
                    setDraftDismissed(true);
                    setSel({});
                    setExtras([]);
                  }}
                >
                  Începe din nou
                </Button>
              </>
            }
          >
            Am păstrat alegerile de ieri, 18:40. Verificăm din nou dacă standul mai e liber.
          </T4Notice>
        ) : null}

        {step === 'interval' ? (
          <IntervalStep
            av={av}
            lake={lake}
            days={days}
            tooSoonDays={tooSoonDays}
            tooSoonRef={tooSoonNotice}
            nowMs={nowMs}
            bufferMinutes={bufferMinutes}
            sel={sel}
            stands={stands}
            errors={shown.interval?.byField ?? {}}
            disabled={submitting}
            onChange={(patch) => setSel((s) => normalise(av, days, nowMs, { ...s, ...patch }))}
          />
        ) : null}

        {step === 'extras' && stand ? (
          <T4Section
            title="Extra"
            description="Poți adăuga la rezervare, dacă vrei."
            icon={<SparklesIcon />}
            action={<span className="t-caption text-muted">Standul {stand.name}</span>}
          >
            {/* A list (one per row) — a grid only once there are enough extras to fill it. */}
            <div className={cn('grid gap-2.5', offered.length >= 3 && 'md:grid-cols-[repeat(auto-fill,minmax(--spacing(70),1fr))]')}>
              {offered.map((e) => {
                const price = e.unit === 'perNight' ? e.price * nights : e.price;
                return (
                  <T4ChoiceCard
                    key={e.key}
                    type="checkbox"
                    name="extras"
                    value={e.key}
                    checked={extras.includes(e.key)}
                    onChange={(on) => setExtras((xs) => (on ? [...xs, e.key] : xs.filter((k) => k !== e.key)))}
                    title={e.label}
                    description={
                      e.unit === 'perNight'
                        ? `${formatLei(e.price)}/noapte · ${nights} ${nights === 1 ? 'noapte' : 'nopți'}`
                        : 'o dată pe rezervare'
                    }
                    meta={<span className="t-heading text-accent-ink tabular-nums">+{formatLei(price)}</span>}
                  />
                );
              })}
            </div>
          </T4Section>
        ) : null}

        {step === 'confirm' ? (
          <>
            {priceChanged ? (
              <T4Notice ref={forcedNotice} tabIndex={-1} tone="warning" role="alert" title="Prețul s-a schimbat">
                {priced
                  ? `Prețul s-a actualizat la ${total.value}. Verifică și confirmă din nou.`
                  : 'Prețul s-a actualizat. Verifică noul total și confirmă din nou.'}
              </T4Notice>
            ) : null}
            {/* From 1280 the summary column carries this; below it, it is the step's first card
                and its total is the screen's one (the action bar drops its meta on this step). */}
            <T4ReviewGroup
              className="xl:hidden"
              title="Rezervarea"
              icon={<MapPinIcon />}
              onEdit={() => goTo('interval')}
              editLabel="Modifică intervalul și standul"
              busy={submitting}
            >
              <T4Rows rows={[{ label: 'Balta', value: lake.name }, ...choiceRows]} />
              {breakdown.length ? <T4PriceRows rows={breakdown} /> : null}
              <T4TotalLine total={shownTotal} live />
              {/* The aside's footnote, in the same slot: it belongs to the price. */}
              {cancellation ? <p className="t-caption text-muted">{cancellation}</p> : null}
            </T4ReviewGroup>

            {isRequest ? (
              <T4Notice tone="pending" title="Este o cerere, nu o rezervare confirmată">
                Administratorul lacului o acceptă sau o refuză.
              </T4Notice>
            ) : null}

            <T4Section title="Date de contact" icon={<UserIcon />} description="Le vede doar administratorul bălții.">
              <T4FieldGrid>
                <TextInput
                  id="t4-name"
                  label="Nume și prenume"
                  placeholder="Numele tău"
                  autoComplete="name"
                  value={contact.contactFullname}
                  onChange={(e) => setContact((c) => ({ ...c, contactFullname: e.target.value }))}
                  error={shown.confirm?.byField.contactFullname}
                  disabled={submitting}
                />
                <TextInput
                  id="t4-phone"
                  label="Număr telefon"
                  placeholder="07XX XXX XXX"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={contact.contactPhone}
                  onChange={(e) => setContact((c) => ({ ...c, contactPhone: sanitizePhoneInput(e.target.value) }))}
                  error={shown.confirm?.byField.contactPhone}
                  helper="Îl salvăm și în profil, pentru data viitoare."
                  disabled={submitting}
                />
              </T4FieldGrid>
              <T4TextArea
                id="t4-notes"
                label="Detalii adiționale"
                placeholder="Detalii adiționale, ora estimată de sosire, etc."
                maxLength={1000}
                value={contact.notes ?? ''}
                onChange={(e) => setContact((c) => ({ ...c, notes: e.target.value }))}
                error={shown.confirm?.byField.notes}
                disabled={submitting}
              />
            </T4Section>

          </>
        ) : null}

        {quoteProblem}

        {submitProblem('form')}
      </T4Frame>

      {/* «Se trimite…» is said, not only shown on the (still focused) CTA. */}
      <p role="status" className="sr-only">
        {submitting ? (isRequest ? 'Se trimite cererea…' : 'Se face rezervarea…') : ''}
      </p>

      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={isRequest ? 'Trimiți cererea?' : 'Confirmi rezervarea?'}
        subtitle={`${lake.name} · Standul ${stand?.name ?? ''}`}
        actions={
          <>
            <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
              Renunță
            </Button>
            <Button onClick={submit}>{primaryLabel}</Button>
          </>
        }
      >
        {/* fish BookingConfirmSheet: every term the angler commits to, one line each. */}
        <ul className="flex flex-col gap-3">
          {interval && departureISO ? (
            <Term icon={<CalendarDaysIcon />} tone="accent">
              {formatSlot(interval.startISO, av.timezone)} → {formatSlot(departureISO, av.timezone)}
            </Term>
          ) : null}
          <Term icon={<BanknotesIcon />} tone="success">
            {paymentText(lake.paymentMode, lake.depositPercent ?? 0, priced ? formatLei(priced.total) : null)}
          </Term>
          {isRequest ? (
            <Term icon={<ClockIcon />} tone="pending">
              Este o cerere, nu o confirmare. Administratorul o acceptă sau o refuză.
            </Term>
          ) : (
            <Term icon={<BoltIcon />} tone="info">
              Rezervarea se confirmă imediat.
            </Term>
          )}
          {cancellation ? (
            <Term icon={<ArrowUturnLeftIcon />} tone="neutral">
              {cancellation}
            </Term>
          ) : null}
        </ul>
        {lake.regulationUrl ? (
          <a
            href={lake.regulationUrl}
            target="_blank"
            rel="noreferrer"
            className={buttonClass({ variant: 'secondary', block: true, className: 'mt-4' })}
          >
            <DocumentTextIcon aria-hidden className="size-5" />
            Deschide regulamentul (PDF)
          </a>
        ) : null}
        <div className="mt-4">
          <T4TotalLine total={total} />
        </div>
        <p className="t-caption mt-3 text-muted">Prin continuare confirmi că ai citit și accepți regulamentul bălții.</p>
      </Dialog>
    </>
  );
}

/** The summary column's identity block: the lake being booked (a 40px tinted disc, name, county). */
function LakeIdentity({ lake }: { lake: LakeDetail }) {
  return (
    <div className="flex items-center gap-3">
      <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-tint text-accent-ink">
        <MapPinIcon className="size-6" />
      </span>
      <div className="min-w-0">
        <p className="t-heading truncate text-ink">{lake.name}</p>
        {lake.county ? <p className="t-caption text-muted">{lake.county}</p> : null}
      </div>
    </div>
  );
}

/** The money term of the confirm dialog (fish BookingConfirmSheet `paymentText`). */
function paymentText(mode: LakeDetail['paymentMode'], depositPercent: number, total: string | null): string {
  if (mode === 'deposit') return `Avans ${depositPercent}% din ${total ?? 'total'}, restul la fața locului`;
  if (mode === 'full') return total ? `${total}, se plătesc acum` : 'Totalul se plătește acum';
  return total ? `${total}, se plătesc la fața locului` : 'Totalul se plătește la fața locului';
}

const TERM_TONE = {
  accent: 'bg-accent-tint text-accent-ink',
  success: 'bg-status-success-bg text-status-success-fg',
  pending: 'bg-status-pending-bg text-status-pending-fg',
  info: 'bg-status-info-bg text-status-info-fg',
  neutral: 'bg-soft-fill text-ink-2',
} as const;

/** One term in the confirm dialog: the 40px tinted disc of the T4 cards and its sentence. */
function Term({ icon, tone, children }: { icon: ReactNode; tone: keyof typeof TERM_TONE; children: ReactNode }) {
  return (
    <li className="flex items-center gap-3">
      <span aria-hidden className={cn('flex size-10 shrink-0 items-center justify-center rounded-full [&>svg]:size-6', TERM_TONE[tone])}>
        {icon}
      </span>
      <span className="t-body min-w-0 text-ink-2">{children}</span>
    </li>
  );
}

/** Keeps the selection coherent: a start that went too soon, a duration the new start forbids. */
function normalise(av: LakeAvailability, days: DayOption[], nowMs: number, s: Partial<Selection>): Partial<Selection> {
  const day = days.find((d) => d.key === s.day);
  const starts = startOptions(av, day, nowMs).filter((o) => !o.disabled).map((o) => o.value);
  const start = s.start && starts.includes(s.start) ? s.start : starts[0];
  const hoursList = start ? durationOptions(av, start) : [];
  const hours = s.hours && hoursList.includes(s.hours) ? s.hours : hoursList[0];
  return { ...s, start, hours };
}

/**
 * The day scroller's arrows at an end: `aria-disabled`, never native `disabled` — the arrow keeps
 * keyboard focus when it reaches the end (a disabled button drops it to <body>). The kit's
 * disabled fade, no hover. TODO(kit): a `disabled` look in IconButton itself — this task may only
 * touch T4.
 */
const ARROW_HELD =
  'aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:hover:bg-transparent aria-disabled:hover:text-ink-2 aria-disabled:active:opacity-50';

/** The bleed of a scroller inside a T4Section card: it runs to the card's edges, padding kept. */
const CARD_BLEED = '-mx-4 px-4 scroll-px-4 md:-mx-5 md:px-5 md:scroll-px-5 xl:-mx-6 xl:px-6 xl:scroll-px-6';

/**
 * From 768, the day scroller fades at an edge that has more days behind it (a hard cut reads as
 * the end of the list). Phones keep the plain overflow: the swipe is the affordance there.
 */
const EDGE_FADE = {
  none: '',
  end: 'md:[mask-image:linear-gradient(to_right,black_calc(100%_-_--spacing(8)),transparent)]',
  start: 'md:[mask-image:linear-gradient(to_right,transparent,black_--spacing(8))]',
  both: 'md:[mask-image:linear-gradient(to_right,transparent,black_--spacing(8),black_calc(100%_-_--spacing(8)),transparent)]',
} as const;

/** The spoken name of a stand choice: the tile shows only its number. */
function standSpoken(s: StandOption, extrasLabel: string): string {
  if (s.status === 'available') return `Standul ${s.name}, liber${extrasLabel ? `, ${extrasLabel}` : ''}`;
  return `Standul ${s.name}, ${standWhy(s)}`;
}
function standWhy(s: StandOption): string {
  return s.status === 'booked' ? 'Ocupat' : s.status === 'blocked' && s.block ? blockText(s.block) : 'Indisponibil';
}

function IntervalStep({
  av,
  lake,
  days,
  tooSoonDays,
  tooSoonRef,
  nowMs,
  bufferMinutes,
  sel,
  stands,
  errors,
  disabled,
  onChange,
}: {
  av: LakeAvailability;
  lake: LakeDetail;
  days: DayOption[];
  tooSoonDays: DayOption[];
  tooSoonRef: RefObject<HTMLDivElement | null>;
  nowMs: number;
  /** The lake's checkout buffer: the departure shown is the slot end minus it. */
  bufferMinutes: number;
  sel: Partial<Selection>;
  stands: StandOption[];
  errors: Record<string, string>;
  disabled: boolean;
  onChange: (patch: Partial<Selection>) => void;
}) {
  const day = days.find((d) => d.key === sel.day);
  const tooSoon = tooSoonDays.find((d) => d.key === sel.day) ?? null;
  const starts = startOptions(av, day, nowMs).filter((o) => !o.disabled);
  const durations = sel.start ? durationOptions(av, sel.start) : [];
  const free = stands.filter((s) => s.status === 'available').length;
  const interval = day && sel.start && sel.hours ? intervalOf(av, day, sel.start, sel.hours) : null;
  const departureISO = interval ? new Date(new Date(interval.endISO).getTime() - bufferMinutes * 60_000).toISOString() : null;
  const fullDays = useMemo(() => new Set(days.filter((d) => dayIsFull(av, d, nowMs)).map((d) => d.key)), [av, days, nowMs]);
  const phone = lake.contact.find((c) => c.phone)?.phone ?? null;
  const firstFree = stands.find((s) => s.status === 'available');
  // Why nothing is free: one competition over every stand names it; anything else stays generic.
  const blocks = new Set(stands.map((s) => (s.status === 'blocked' ? blockText(s.block) : null)));
  const allBlockedBy = free === 0 && blocks.size === 1 ? [...blocks][0] : null;
  const focusDays = () => {
    const el = document.querySelector<HTMLInputElement>('input[name="day"]:checked') ?? document.getElementById('t4-day');
    el?.focus();
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };
  // «Alege altă zi» from a phone-only day: the first day that can be booked here.
  const firstBookable = days.find((d) => !fullDays.has(d.key)) ?? days[0];
  const focusFirstBookable = () => {
    const el =
      document.querySelector<HTMLInputElement>(`input[name="day"][value="${firstBookable?.key}"]`) ?? document.getElementById('t4-day');
    el?.focus();
    el?.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
  };

  // The day scroller's edges: the fade and the arrows say whether more days hide behind them.
  const scroller = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });
  const readEdges = () => {
    const el = scroller.current;
    if (!el) return;
    const start = el.scrollLeft <= 1;
    const end = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1;
    setEdges((e) => (e.start === start && e.end === end ? e : { start, end }));
  };
  useEffect(() => {
    readEdges();
    window.addEventListener('resize', readEdges);
    return () => window.removeEventListener('resize', readEdges);
  }, []);
  const page = (dir: -1 | 1) => {
    const el = scroller.current;
    // Five tiles (60 + 8 gap) a press; snap-start lands it on a tile.
    if (el) el.scrollBy({ left: dir * 5 * 68, behavior: 'smooth' });
  };
  const fade = edges.start && edges.end ? 'none' : edges.start ? 'end' : edges.end ? 'start' : 'both';

  return (
    <>
      <T4Section
        title="Când vii"
        description={
          interval && departureISO
            ? `${formatSlot(interval.startISO, av.timezone)} → ${formatSlot(departureISO, av.timezone)}`
            : 'Ziua sosirii, ora și cât stai.'
        }
        icon={<CalendarDaysIcon />}
        invalid={Boolean(errors.day)}
      >
        <fieldset className="flex min-w-0 flex-col gap-1.5" disabled={disabled} aria-describedby={errors.day ? 't4-day-error' : undefined}>
          <legend className="sr-only">Ziua sosirii</legend>
          {/* The legend's line, drawn as a row so the arrows can share it (a legend can't hold a
              flex row). From 768: arrows for a mouse — a trackpad / shift+wheel is not obvious. */}
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <span aria-hidden className="t-label text-ink-2">
              Ziua sosirii
            </span>
            {edges.start && edges.end ? null : (
              // The system icon button (48, 40 from 1280); negative margins keep the label line's
              // height. At an end: held (ARROW_HELD), still focusable.
              <div className="-my-4 hidden gap-1 md:flex xl:-my-3">
                <IconButton
                  aria-label="Zilele anterioare"
                  aria-disabled={edges.start || undefined}
                  onClick={() => (edges.start ? undefined : page(-1))}
                  className={ARROW_HELD}
                >
                  <ChevronLeftIcon aria-hidden />
                </IconButton>
                <IconButton
                  aria-label="Zilele următoare"
                  aria-disabled={edges.end || undefined}
                  onClick={() => (edges.end ? undefined : page(1))}
                  className={ARROW_HELD}
                >
                  <ChevronRightIcon aria-hidden />
                </IconButton>
              </div>
            )}
          </div>
          {/* A horizontal scroller at every width: the days are a sequence, never a stretched grid. */}
          <div
            ref={scroller}
            onScroll={readEdges}
            className={cn('-my-1 flex snap-x gap-2 overflow-x-auto py-1', CARD_BLEED, EDGE_FADE[fade])}
          >
            {[
              ...tooSoonDays.map((d) => ({ d, note: 'telefonic', noteLabel: 'se rezervă doar telefonic' })),
              ...days.map((d) =>
                fullDays.has(d.key)
                  ? { d, note: 'complet', noteLabel: 'complet, niciun stand liber' }
                  : { d, note: undefined, noteLabel: undefined },
              ),
            ].map(({ d, note, noteLabel }) => (
              <T4ChoiceCard
                key={d.key}
                type="radio"
                name="day"
                value={d.key}
                id={d.key === days[0]?.key ? 't4-day' : undefined}
                checked={sel.day === d.key}
                onChange={() => onChange({ day: d.key })}
                layout="tile"
                kicker={d.weekday}
                title={d.day}
                description={note ?? d.month}
                ariaLabel={`${d.weekday} ${d.day} ${d.month}${noteLabel ? `, ${noteLabel}` : ''}`}
                // A day only the phone or nobody can take reads quieter than a bookable one.
                className={cn('w-15 shrink-0 snap-start', note && 'text-muted')}
              />
            ))}
          </div>
          {/* Field's message element (role=alert, linked from the group). TODO(kit): export
              Field's FieldMessage and render it here — this task may only touch T4. */}
          {errors.day ? (
            <p id="t4-day-error" role="alert" className="t-caption text-status-danger-fg">
              {errors.day}
            </p>
          ) : null}
        </fieldset>

        {tooSoon ? (
          <T4Notice
            ref={tooSoonRef}
            tabIndex={-1}
            tone="warning"
            title="Prea curând pentru o rezervare online"
            actions={
              <>
                {phone ? (
                  <ButtonLink href={`tel:${phone}`} size="compact" variant="secondary" icon={<PhoneIcon />}>
                    Sună la baltă
                  </ButtonLink>
                ) : null}
                {firstBookable ? (
                  <Button size="compact" variant={phone ? 'ghost' : 'secondary'} className={phone ? '-ml-3 @2xl:ml-0' : undefined} onClick={focusFirstBookable}>
                    Alege altă zi
                  </Button>
                ) : null}
              </>
            }
            inline
          >
            Rezervi online cu cel puțin {av.leadHours ?? 24} de ore înainte.{' '}
            {phone
              ? `Pentru ${tooSoon.weekday} ${tooSoon.day} ${tooSoon.month}, sună la baltă.`
              : firstBookable
                ? `Prima zi pe care o poți rezerva aici e ${firstBookable.weekday} ${firstBookable.day} ${firstBookable.month}.`
                : null}
          </T4Notice>
        ) : !day ? null : starts.length === 0 ? (
          // The error summary's «Ora de început» link lands here: the field it names, explained.
          <T4Notice id="t4-start" tabIndex={-1} tone="info" title="Nicio oră liberă în această zi" inline>
            Alege altă zi.
          </T4Notice>
        ) : (
          <T4FieldGrid>
            {/* The ids the error summary links to (the kit SegmentedControl takes none). */}
            <div id="t4-start" tabIndex={-1} className="scroll-mt-40 rounded-control outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent xl:scroll-mt-24">
              <SegmentedControl
                label="Ora de început"
                name="start"
                value={sel.start}
                onChange={(v) => onChange({ start: v })}
                options={starts.map((s) => ({ value: s.value, label: s.value }))}
              />
            </div>
            {durations.length ? (
              <div id="t4-hours" tabIndex={-1} className="scroll-mt-40 rounded-control outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent xl:scroll-mt-24">
                <SegmentedControl
                  label="Durata"
                  name="hours"
                  value={sel.hours ? String(sel.hours) : undefined}
                  onChange={(v) => onChange({ hours: Number(v) })}
                  options={durations.map((h) => ({ value: String(h), label: durationLabel(h, Number(sel.start?.slice(0, 2) ?? 0)) }))}
                  helper={av.forbiddenEndTimes?.length ? `Balta nu primește plecări la ${av.forbiddenEndTimes.join(', ')}.` : undefined}
                />
              </div>
            ) : null}
          </T4FieldGrid>
        )}
      </T4Section>

      <T4Section
        title="Standul"
        description={interval ? 'Libere pentru intervalul ales.' : 'Alege întâi ziua și ora.'}
        icon={<MapPinIcon />}
        invalid={Boolean(errors.stand)}
        action={
          interval ? (
            <span className="t-caption text-muted tabular-nums">
              {free} din {stands.length} libere
            </span>
          ) : undefined
        }
      >
        {!interval ? (
          // No interval, no verdict: nothing is claimed free before a day is picked.
          <p
            id="t4-stand"
            tabIndex={-1}
            className="t-caption rounded-control text-muted outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
          >
            {tooSoon
              ? 'Standurile se rezervă online începând de la ziua următoare.'
              : `Alege ziua sosirii: îți arătăm apoi care din cele ${stands.length} standuri sunt libere.`}
          </p>
        ) : free === 0 ? (
          <T4Notice
            id="t4-stand"
            tabIndex={-1}
            tone="warning"
            title="Niciun stand liber în acest interval"
            actions={
              <Button size="compact" variant="secondary" onClick={focusDays}>
                Alege altă zi
              </Button>
            }
            inline
          >
            {allBlockedBy ? `${allBlockedBy}. ` : null}Încearcă altă zi sau altă oră de început.
          </T4Notice>
        ) : (
          <fieldset disabled={disabled} className="min-w-0" aria-describedby={errors.stand ? 't4-stand-error' : undefined}>
            <legend className="sr-only">Standul</legend>
            {/* Auto-fill: more columns as the screen grows, never wider tiles (ROADMAP §4). Number
                tiles on a phone (64px min: 4 across at 375), row cards from 768 (3 across at 768
                and 1280, 4 at 1440). */}
            <div className={T4_CHOICE_GRID}>
              {stands.map((s) => {
                const ok = s.status === 'available';
                const extrasLabel = s.extras.map((k) => av.extras.find((e) => e.key === k)?.label ?? k).join(', ');
                // Only what differs is written: the extra a free stand sells, why another can't be taken.
                const caption = ok ? extrasLabel || undefined : standWhy(s);
                return (
                  <T4ChoiceCard
                    key={s.documentId}
                    type="radio"
                    name="stand"
                    value={s.documentId}
                    id={s === firstFree ? 't4-stand' : undefined}
                    checked={sel.stand === s.documentId && ok}
                    onChange={() => onChange({ stand: s.documentId })}
                    disabled={!ok}
                    density="compact"
                    layout="tile-row"
                    // One carrier for the name: the numeral tile on a phone, «Standul 7» as a row
                    // (fish's label) — never a badge AND a title saying the same number.
                    title={
                      <>
                        <span className="md:hidden">{s.name}</span>
                        <span className="hidden md:inline">Standul {s.name}</span>
                      </>
                    }
                    description={caption}
                    ariaLabel={standSpoken(s, extrasLabel)}
                  />
                );
              })}
            </div>
          </fieldset>
        )}
        {errors.stand ? (
          <p id="t4-stand-error" role="alert" className="t-caption text-status-danger-fg">
            {errors.stand}
          </p>
        ) : null}
      </T4Section>
    </>
  );
}
