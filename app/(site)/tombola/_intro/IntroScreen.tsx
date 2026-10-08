'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowPathIcon, CheckIcon, ExclamationCircleIcon, ExclamationTriangleIcon, GiftIcon } from '@heroicons/react/24/outline';
import { FlowAsideCard, FlowHeader, FlowLayout, FlowLoadingStatus } from '@/components/templates/T6';
import { T4Gate } from '@/components/templates/T4';
import { RING_DANGER } from '@/components/templates/rings';
import { ResponsiveSurface } from '@/components/surfaces/ResponsiveSurface';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { joinRaffleSessionMutation, uploadRaffleReceiptMutation, type RaffleState } from '@/core/organizer';
import { profileQuery } from '@/core/social';
import { isApiError } from '@/core/transport';
import { routes } from '@/lib/routes';
import { useSiteToast } from '../../_shell/Toast';
import { chancesLabel, joinBlocker, prizesToShow, prizeTypeLabel, raffleCopy } from '../_shared/copy';
import { prepareReceipt } from '../_shared/media';
import { PrizeRow } from '../_shared/PrizeRow';
import { introRedirect, RAFFLE_MEDIA_ORIGIN, useRaffle } from '../_shared/useRaffle';
import heroPhoto from '../_shared/assets/lake-hero.jpg';
import { PhonePromptDialog } from './PhonePromptDialog';
import { ReceiptPicker } from './ReceiptPicker';
import { TypePicker } from './TypePicker';

const C = raffleCopy.intro;
export const INTRO_TITLE = C.pageTitle;
const TITLE_ID = 'tombola-titlu';
const SUMMARY_ID = 'tombola-rezumat';

/**
 * ≥1024 the content (the rest of the shell width) and the summary column (384) side by side, the
 * summary sticking under the top bar (64 + 24). Full width like the rest of the site (owner rule).
 */
const GRID = 'flex flex-col gap-4 md:gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:items-start lg:gap-8';
/**
 * The content column: fish's single column; from 1440 a two-column bento (hero | intro, the type
 * picker across, the prizes on the left beside how it works over the bonus, then the receipt and
 * the disclaimer across). DOM order stays fish's.
 */
const CONTENT = 'flex min-w-0 flex-col gap-4 md:gap-5 2xl:grid 2xl:grid-cols-2 2xl:gap-6';
const ACROSS = '2xl:col-span-2';
/** The hero: 180 / 240 tall; in the bento as tall as the intro card next to it (240 at least). */
const HERO = 'relative h-45 overflow-hidden rounded-card bg-soft-fill md:h-60 2xl:h-auto 2xl:min-h-60';
const STICKY = 'lg:sticky lg:top-[calc(--spacing(22)_+_var(--shell-banner-h,0px))]';
/** The content cards (fish: white, radius 16, padding 16). */
const CARD = 'rounded-card bg-surface p-4 shadow-e0 md:p-5';

function Header() {
  return <FlowHeader title={INTRO_TITLE} id={TITLE_ID} backHref={routes.home()} backLabel="Înapoi acasă" />;
}

/**
 * /tombola «Tragere la sorți» (fish app/(app)/raffle/index.tsx; parity participant.raffle-intro).
 * The page gate (requireViewer) already sent signed-out visitors to sign-in. Everything here is
 * per viewer and read client-side through /api/cms: the session, the participation and the profile.
 *
 * - Until the three are known: the skeleton. A read error: a gate with «Încearcă din nou» (owner
 *   rule 4 — never the form for an unknown participation). A dead session: the skeleton (the
 *   session-expired guard signs out).
 * - c1: joined → Acasă; no session → Acasă; ended → the winners page when it has winners, else
 *   Acasă (router.replace, after the data).
 * - c2–c11 the content, phone in fish's order; ≥1024 the content on the left and «Înscrierea ta»
 *   (type, chances, the regulation, the CTA) sticking on the right.
 * - c12–c14 the join: fish's checks in order into the «Erori» card, the phone dialog, then join →
 *   optional receipt → confirmation.
 */
export function IntroScreen() {
  const raffle = useRaffle();
  const profile = useQuery(profileQuery(raffle.transport));
  const router = useRouter();
  // On while the join runs and after it succeeded: the participation refetch (joined) must not
  // send the viewer home in place of the confirmation.
  const [leaving, setLeaving] = useState(false);

  const target = raffle.status === 'ready' && !leaving ? introRedirect(raffle.state) : null;
  useEffect(() => {
    if (target) router.replace(target === 'winners' ? routes.raffleWinners() : routes.home());
  }, [target, router]);

  const dead = [raffle.error, profile.error].some((e) => isApiError(e) && e.code === 'SESSION_DEAD');
  // A dead session: the skeleton while the session-expired guard signs out.
  if (dead) return <IntroSkeleton />;
  if (raffle.status === 'error' || profile.isError) {
    return (
      <LoadError
        retrying={raffle.retrying || profile.isFetching}
        onRetry={() => {
          raffle.retry();
          if (profile.isError) void profile.refetch();
        }}
      />
    );
  }
  if (raffle.status === 'pending' || profile.isPending || target) return <IntroSkeleton />;

  return (
    <IntroContent
      state={raffle.state}
      transport={raffle.transport}
      setSelectedTypeKey={raffle.setSelectedTypeKey}
      phone={profile.data.phone}
      onLeaving={setLeaving}
    />
  );
}

function IntroContent({
  state,
  transport,
  setSelectedTypeKey,
  phone,
  onLeaving,
}: {
  state: RaffleState;
  transport: ReturnType<typeof useRaffle>['transport'];
  setSelectedTypeKey: (key: string | null) => void;
  phone: string | null;
  onLeaving: (on: boolean) => void;
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useSiteToast();
  const join = useMutation(joinRaffleSessionMutation(transport, qc, { mediaOrigin: RAFFLE_MEDIA_ORIGIN }));
  const upload = useMutation(uploadRaffleReceiptMutation(transport, qc, { mediaOrigin: RAFFLE_MEDIA_ORIGIN }));
  const [regulationAccepted, setRegulationAccepted] = useState(false);
  const [receipt, setReceipt] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [regulationOpen, setRegulationOpen] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);
  /** The error card + «Înscrierea ta» column (on a phone the end of the page: the checkbox and the CTA). */
  const columnRef = useRef<HTMLDivElement>(null);

  const { prizes, fromSession } = useMemo(() => prizesToShow(state.sessionPrizes), [state.sessionPrizes]);
  const selectedType = state.types.find((t) => t.key === state.selectedTypeKey) ?? null;

  useEffect(() => {
    if (attempt === 0) return;
    const card = errorRef.current;
    if (!card) return;
    card.focus();
    // Below 1024 the card sits above the whole «Înscrierea ta» summary: also bring its end (the
    // checkbox and the CTA the message is about) into view, as fish has the card right above them.
    if (!window.matchMedia('(min-width: 1024px)').matches) {
      columnRef.current?.scrollIntoView({ block: 'end' });
    }
  }, [attempt]);

  const fail = (message: string) => {
    setError(message);
    setAttempt((a) => a + 1);
  };

  const onJoin = async () => {
    if (busy) return;
    setError(null);
    const blocker = joinBlocker({
      regulationAccepted,
      isRegistrationOpen: state.isRegistrationOpen,
      selectedTypeKey: state.selectedTypeKey,
    });
    if (blocker) return fail(C.errors[blocker]);
    if (!phone?.trim()) {
      setPhoneOpen(true);
      return;
    }
    const sessionId = state.sessionDocumentId;
    const typeKey = state.selectedTypeKey;
    if (!sessionId || !typeKey) return fail(C.errors.join);
    setBusy(true);
    onLeaving(true);
    try {
      await join.mutateAsync({ sessionDocumentId: sessionId, typeKey });
    } catch {
      onLeaving(false);
      setBusy(false);
      return fail(C.errors.join);
    }
    if (receipt) {
      try {
        const ready = await prepareReceipt(receipt);
        await upload.mutateAsync({ raffleId: sessionId, file: { blob: ready, filename: ready.name } });
      } catch {
        // fish shows its join message, then its <Redirect> (now joined) drops the viewer on Acasă.
        // The web opens the confirmation (the viewer IS registered, and that is where a receipt is
        // added), so the toast says exactly that — never «try again», which would now redirect home.
        toast(C.receiptFailedAfterJoin, 'danger');
      }
    }
    router.push(routes.raffleConfirmation());
  };

  const summary = (
    <FlowAsideCard title={C.summaryTitle} id={SUMMARY_ID}>
      <dl className="flex flex-col gap-2.5">
        {state.types.length > 0 ? (
          <div className="flex items-baseline justify-between gap-3">
            <dt className="t-body text-ink-2">{C.summaryType}</dt>
            <dd className={cn('t-body-strong', selectedType ? 'text-ink' : 'text-muted')} data-testid="summary-type">
              {selectedType?.label ?? C.summaryTypeNone}
            </dd>
          </div>
        ) : null}
        <div className="flex items-baseline justify-between gap-3">
          <dt className="t-body text-ink-2">{C.summaryChancesNow}</dt>
          <dd className="t-body-strong text-ink">{chancesLabel(1)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="t-body text-ink-2">{C.summaryChancesReceipt}</dt>
          <dd className="t-body-strong text-status-success-fg">+{chancesLabel(2)}</dd>
        </div>
      </dl>

      <div className="flex flex-col gap-3 border-t border-hairline pt-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <label className="flex min-h-11 flex-1 cursor-pointer items-center gap-2.5">
            <input
              type="checkbox"
              checked={regulationAccepted}
              onChange={(e) => {
                setRegulationAccepted(e.target.checked);
                if (e.target.checked && error === C.errors.regulation) setError(null);
              }}
              className="size-5 shrink-0 cursor-pointer accent-accent"
            />
            <span className="t-body-strong text-ink">{C.regulationCheckboxLabel}</span>
          </label>
          <button
            type="button"
            onClick={() => setRegulationOpen(true)}
            className="t-body-strong min-h-11 rounded-control text-accent-ink underline underline-offset-2 hover:decoration-2 focus-visible:outline-2 focus-visible:outline-accent"
          >
            {C.viewRegulationLink}
          </button>
        </div>
        {state.types.length === 0 ? (
          // c12: a session without types can never be joined; fish's checks still run on a press.
          <p className="t-caption text-ink-2" data-testid="raffle-no-types">
            {C.noTypesNote}
          </p>
        ) : null}
        <Button
          block
          onClick={() => void onJoin()}
          aria-busy={busy || undefined}
          aria-disabled={busy || undefined}
          icon={busy ? <ArrowPathIcon className="animate-spin motion-reduce:animate-none" /> : <GiftIcon />}
        >
          {busy ? C.ctaJoining : C.ctaJoin}
        </Button>
      </div>
    </FlowAsideCard>
  );

  return (
    <FlowLayout header={<Header />} labelledBy={TITLE_ID} variant="bare">
      <div className={GRID}>
        <div className={CONTENT}>
          {/* c2: fish's lake photo, 180 tall; a wide banner from 768. Decorative. */}
          <div className={HERO}>
            <Image
              src={heroPhoto}
              alt=""
              fill
              priority
              sizes="(min-width: 1440px) 50vw, (min-width: 1024px) 70vw, 100vw"
              className="object-cover object-[50%_32%]"
            />
          </div>

          {/* c3 */}
          <section aria-labelledby="tombola-intro" className={cn(CARD, 'flex items-start gap-3 2xl:items-center')}>
            <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-tint text-accent-ink">
              <GiftIcon className="size-6" />
            </span>
            <div className="flex min-w-0 flex-col gap-1">
              <h2 id="tombola-intro" className="t-body-strong text-ink">
                {C.prizesHeading}
              </h2>
              <p className="t-body text-ink-2">{C.prizesBody}</p>
            </div>
          </section>

          {/* c4 */}
          {state.types.length > 0 ? (
            <div className={cn(CARD, ACROSS)}>
              <TypePicker
                types={state.types}
                selected={state.selectedTypeKey}
                registrationsByType={state.registrationsByType}
                onSelect={(key) => {
                  setSelectedTypeKey(key);
                  setError(null);
                }}
              />
            </div>
          ) : null}

          {/* c5 c6 */}
          <section aria-labelledby="tombola-premii" className={cn(CARD, 'flex flex-col gap-3 2xl:row-span-2')}>
            <h2 id="tombola-premii" className="t-heading text-ink">
              {C.prizesTitle}
            </h2>
            <ul className="flex flex-col gap-2" data-testid="raffle-prizes" data-source={fromSession ? 'session' : 'static'}>
              {prizes.map((p, i) => {
                const type = state.types.find((t) => t.key === p.typeKey);
                return (
                  <li key={i}>
                    <PrizeRow
                      prize={p}
                      typeLabel={prizeTypeLabel(p.typeKey, type?.label)}
                      typeBadgeColor={type?.badgeColor ?? null}
                      registrations={state.registrationsByType[p.typeKey ?? ''] ?? 0}
                    />
                  </li>
                );
              })}
            </ul>
          </section>

          {/* c7 */}
          <section aria-labelledby="tombola-cum" className={cn(CARD, 'flex flex-col gap-3')}>
            <h2 id="tombola-cum" className="t-heading text-ink">
              {C.howItWorksTitle}
            </h2>
            <ol className="flex flex-col gap-2.5">
              {C.howItWorksSteps.map((step, i) => (
                <li key={i} className="flex items-center gap-3">
                  <span aria-hidden className="t-caption flex size-6 shrink-0 items-center justify-center rounded-full bg-accent font-bold text-on-accent">
                    {i + 1}
                  </span>
                  <span className="t-body text-ink">{step}</span>
                </li>
              ))}
            </ol>
          </section>

          {/* c8 */}
          <section aria-labelledby="tombola-bonus" className="flex items-center gap-3 rounded-card bg-status-success-bg p-4 md:p-5">
            <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full bg-status-success-fg text-on-accent">
              <CheckIcon className="size-5" />
            </span>
            <div className="min-w-0">
              <h2 id="tombola-bonus" className="t-body-strong text-ink">
                {C.bonusTitle}
              </h2>
              <p className="t-body text-ink-2">{C.bonusText}</p>
            </div>
          </section>

          {/* c9 */}
          <div className={ACROSS}>
            <ReceiptPicker file={receipt} onChange={setReceipt} disabled={busy} />
          </div>

          {/* c10 */}
          <p className={cn('t-caption rounded-control bg-status-danger-bg p-3 text-ink', ACROSS)}>{C.receiptVerificationDisclaimer}</p>
        </div>

        <div ref={columnRef} className={cn('flex min-w-0 flex-col gap-4', STICKY)}>
          {/* c12: fish's «Erori» card, the T4ErrorSummary look; focused on every refused press. */}
          <div
            ref={errorRef}
            tabIndex={-1}
            role="group"
            aria-labelledby="tombola-erori"
            hidden={!error}
            data-testid="raffle-errors"
            className={cn('scroll-mt-24 gap-3 rounded-card bg-surface p-4 outline-none focus-visible:outline-2 focus-visible:outline-accent md:p-5', RING_DANGER, error && 'flex')}
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-status-danger-bg text-status-danger-fg">
              <ExclamationCircleIcon aria-hidden className="size-6" />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p id="tombola-erori" className="t-body-strong text-ink">
                {C.errorsTitle}
              </p>
              <p className="t-body mt-1 text-status-danger-fg">{error}</p>
            </div>
          </div>
          <p role="status" className="sr-only">
            {error ?? ''}
          </p>
          {summary}
        </div>
      </div>

      <PhonePromptDialog open={phoneOpen} onClose={() => setPhoneOpen(false)} initialPhone={phone} />
      <RegulationDialog open={regulationOpen} onClose={() => setRegulationOpen(false)} title={state.regulationTitle} sections={state.regulationSections} />
    </FlowLayout>
  );
}

/**
 * fish components/raffle/RaffleRegulationSheet.tsx (c11): the CMS regulationTitle (only when set),
 * each section's title and body, «Închide». A sheet on the phone, a dialog from 768.
 */
function RegulationDialog({
  open,
  onClose,
  title,
  sections,
}: {
  open: boolean;
  onClose: () => void;
  title: string | null;
  sections: RaffleState['regulationSections'];
}) {
  return (
    <ResponsiveSurface
      open={open}
      onClose={onClose}
      intent="info"
      title={title || C.regulationDialogTitle}
      titleHidden={!title}
      sheetSnap={0.9}
      pinnedActions
      actions={
        <Button variant="outline" onClick={onClose}>
          {raffleCopy.close}
        </Button>
      }
    >
      <div className="flex flex-col gap-5" data-testid="raffle-regulation">
        {sections.map((s, i) => (
          <section key={i} className="flex flex-col gap-1.5">
            <h3 className="t-body-strong text-ink">{s.title}</h3>
            <p className="t-body whitespace-pre-line text-ink-2">{s.body}</p>
          </section>
        ))}
      </div>
    </ResponsiveSurface>
  );
}

function LoadError({ retrying, onRetry }: { retrying: boolean; onRetry: () => void }) {
  return (
    <FlowLayout header={<Header />} variant="bare" narrow>
      <T4Gate
        tone="danger"
        role="alert"
        icon={<ExclamationTriangleIcon />}
        title="Nu am putut încărca tombola"
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

/** Loading (and while a redirect is on its way): the real header, the hero, the cards and the summary column in grey. */
export function IntroSkeleton() {
  const bar = 'block rounded-full bg-soft-fill animate-shimmer';
  return (
    <FlowLayout header={<Header />} labelledBy={TITLE_ID} variant="bare" busy>
      <FlowLoadingStatus />
      <div aria-hidden className={GRID}>
        <div className={CONTENT}>
          <span className={cn(HERO, 'block animate-shimmer')} />
          <div className={cn(CARD, 'flex items-start gap-3')}>
            <span className="size-10 shrink-0 rounded-full bg-soft-fill animate-shimmer" />
            <div className="flex flex-1 flex-col gap-2 pt-1">
              <span className={cn(bar, 'h-3.5 w-11/12')} />
              <span className={cn(bar, 'h-3.5 w-2/3')} />
              <span className={cn(bar, 'h-3 w-full')} />
            </div>
          </div>
          <div className={cn(CARD, ACROSS, 'flex flex-col gap-3')}>
            <span className={cn(bar, 'h-4 w-40')} />
            <span className={cn(bar, 'h-3 w-full')} />
            <div className="grid grid-cols-3 gap-2 md:gap-3">
              {[0, 1, 2].map((i) => (
                <span key={i} className="block h-16 rounded-card bg-soft-fill animate-shimmer" />
              ))}
            </div>
          </div>
          <div className={cn(CARD, 'flex flex-col gap-2')}>
            <span className={cn(bar, 'mb-1 h-4 w-20')} />
            {[0, 1, 2].map((i) => (
              <span key={i} className="block h-15 rounded-control bg-soft-fill animate-shimmer" />
            ))}
          </div>
        </div>
        <div className={cn('flex flex-col gap-3 rounded-card bg-surface p-4 shadow-e0 md:p-5 xl:p-6', STICKY)}>
          <span className={cn(bar, 'h-4 w-32')} />
          <span className={cn(bar, 'h-3 w-full')} />
          <span className={cn(bar, 'h-3 w-full')} />
          <span className="mt-2 block h-12 rounded-control bg-soft-fill animate-shimmer xl:h-10" />
        </div>
      </div>
    </FlowLayout>
  );
}
