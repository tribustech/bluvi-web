'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowPathIcon,
  ArrowUpTrayIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  FlagIcon,
  GiftIcon,
  HomeIcon,
  LockClosedIcon,
  ReceiptPercentIcon,
  TicketIcon,
  TrophyIcon,
} from '@heroicons/react/24/outline';
import { ChoiceGrid, ChoiceTile, FlowAsideCard, FlowHeader, FlowLayout, FlowLoadingStatus } from '@/components/templates/T6';
import { T4Gate } from '@/components/templates/T4';
import { BentoTile, FactTile } from '@/components/ui/BentoTile';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { SignatureNumber } from '@/components/ui/SignatureNumber';
import { deleteRaffleReceiptMutation, joinRaffleSessionMutation, raffleKeys, type RaffleState } from '@/core/organizer';
import { isApiError } from '@/core/transport';
import { routes } from '@/lib/routes';
import lakePhoto from '../../_shared/assets/lake.jpeg';
import { prizeTypeLabel, raffleCopy, type ReceiptUploadMode } from '../../_shared/copy';
import { PrizeRow } from '../../_shared/PrizeRow';
import { RECEIPT_DELETE_FAILED, ReceiptCard } from '../../_shared/ReceiptCard';
import { ReceiptUploadDialog } from '../../_shared/ReceiptUploadDialog';
import { RAFFLE_MEDIA_ORIGIN, useRaffle } from '../../_shared/useRaffle';
import { countdownCells, countdownParts, showCountdown } from './Countdown';
import {
  bonusChances,
  chancesToWinUnit,
  ENTRY_CHANCES,
  leaveForIntro,
  statusCopy,
  statusReceiptBlock,
  totalWithReceiptLine,
  typeTileDisabled,
  typesNote,
} from './model';

const S = raffleCopy.status;
const TITLE_ID = 'sansele-mele-titlu';
const TYPES_ID = 'sansele-mele-tip';
const PRIZES_ID = 'sansele-mele-premii';
const UPLOAD_ID = 'sansele-mele-bon';
const RECEIPT_ID = 'sansele-mele-bon-incarcat';

/**
 * The bento hero (owner rules 9/10/19). Phone: the signature tile, the three breakdown facts in a
 * row, then the countdown (fish's order: the card, its breakdown, the countdown). From 768 six
 * columns: the signature tile on the left half over two rows, the countdown (or «ended») on the
 * right of the first row, the three facts under it.
 */
const BENTO = 'grid grid-cols-3 gap-3 md:grid-cols-6 md:gap-4 xl:gap-6';
/**
 * Under the hero, phone: fish's single column (type, prizes, receipt, back). ≥1024 two columns on
 * the same DOM: the type card, the receipt and the way home on the left (rows 1–3), the prizes on
 * the right spanning them; the last row takes the slack so the button stays under the card above.
 */
const COLUMNS =
  'flex flex-col gap-4 md:gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:grid-rows-[auto_auto_1fr] lg:items-start lg:gap-x-8 2xl:grid-cols-[minmax(0,1fr)_minmax(0,30rem)]';
const LEFT_ROWS = ['lg:row-start-1', 'lg:row-start-2', 'lg:row-start-3'] as const;
const CARD = 'rounded-card bg-surface p-4 shadow-e0 md:p-5 xl:p-6';

function Header() {
  return <FlowHeader title={S.title} id={TITLE_ID} backHref={routes.home()} backLabel={S.backToHomeCta} />;
}

/**
 * /tombola/sansele-mele «Șansele mele» (fish app/(app)/raffle/status.tsx; parity
 * participant.raffle-status, T6). An orphan in fish (no screen navigates to it, c1): reachable by
 * URL only — nothing on the web links here either until the owner decides.
 *
 * Gating as the confirmation: unknown → skeleton or the retry gate (owner rule 4); a failed
 * background refetch over known data keeps it and says so; a viewer who is not in the raffle (or
 * without a session) is handed to the intro (/tombola), which routes them on.
 */
export function StatusScreen() {
  const raffle = useRaffle();
  const router = useRouter();
  const dead = isApiError(raffle.error) && raffle.error.code === 'SESSION_DEAD';
  const leave = raffle.hasData && !dead && leaveForIntro(raffle.state, { fetching: raffle.retrying });
  useEffect(() => {
    if (leave) router.replace(routes.raffle());
  }, [leave, router]);

  if (dead) return <StatusSkeleton />;
  if (!raffle.hasData) {
    if (raffle.status === 'error') return <LoadError retrying={raffle.retrying} onRetry={raffle.retry} />;
    return <StatusSkeleton />;
  }
  if (!raffle.state.joined) return <StatusSkeleton />;
  return (
    <StatusContent
      state={raffle.state}
      transport={raffle.transport}
      refreshFailed={raffle.status === 'error'}
      refreshing={raffle.retrying}
      onRefresh={raffle.retry}
    />
  );
}

type ContentProps = {
  state: RaffleState;
  transport: ReturnType<typeof useRaffle>['transport'];
  refreshFailed: boolean;
  refreshing: boolean;
  onRefresh: () => void;
};

function StatusContent({ state, transport, refreshFailed, refreshing, onRefresh }: ContentProps) {
  const router = useRouter();
  const qc = useQueryClient();
  const del = useMutation(deleteRaffleReceiptMutation(transport, qc, { mediaOrigin: RAFFLE_MEDIA_ORIGIN }));
  const [dialog, setDialog] = useState<ReceiptUploadMode | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  /** After an upload / a delete the card is swapped: focus goes to the new card's heading. */
  const focusTarget = useRef<'upload' | 'receipt' | null>(null);
  const block = statusReceiptBlock(state);

  useEffect(() => {
    if (!focusTarget.current || block !== focusTarget.current) return;
    document.getElementById(block === 'upload' ? UPLOAD_ID : RECEIPT_ID)?.focus();
    focusTarget.current = null;
  }, [block]);

  const onDelete = async () => {
    const id = state.sessionDocumentId;
    if (!id || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await del.mutateAsync(id);
      focusTarget.current = 'upload';
      await qc.invalidateQueries({ queryKey: raffleKeys.participation }, { cancelRefetch: false });
    } catch {
      // fish swallows it (status.tsx:50-57); the web says so.
      setDeleteError(RECEIPT_DELETE_FAILED);
    } finally {
      setDeleting(false);
    }
  };

  const openDialog = (mode: ReceiptUploadMode) => () => {
    setDeleteError(null);
    setDialog(mode);
  };

  const hasTypes = state.types.length > 0;
  const left: ('types' | 'receipt' | 'back')[] = [...(hasTypes ? (['types'] as const) : []), ...(block ? (['receipt'] as const) : []), 'back'];
  const row = (k: (typeof left)[number]) => LEFT_ROWS[left.indexOf(k)];

  return (
    <FlowLayout header={<Header />} labelledBy={TITLE_ID} variant="bare">
      {refreshFailed ? (
        <div
          role="alert"
          data-testid="raffle-refresh-error"
          className="mb-4 flex flex-col gap-3 rounded-card bg-status-danger-bg p-4 md:mb-6 md:flex-row md:items-center md:justify-between"
        >
          <p className="t-body-strong flex items-start gap-2 text-status-danger-fg">
            <ExclamationTriangleIcon aria-hidden className="mt-0.5 size-5 shrink-0" />
            {statusCopy.refreshFailed}
          </p>
          <Button
            size="compact"
            variant="outline"
            icon={<ArrowPathIcon className={cn(refreshing && 'animate-spin motion-reduce:animate-none')} />}
            onClick={onRefresh}
            disabled={refreshing}
            aria-busy={refreshing || undefined}
            className="self-start md:self-auto"
          >
            Încearcă din nou
          </Button>
        </div>
      ) : null}

      <div className="flex flex-col gap-4 md:gap-6">
        <Hero state={state} />

        <div className={COLUMNS}>
          {/* c5 */}
          {hasTypes ? (
            <TypeCard key={state.sessionDocumentId} state={state} transport={transport} className={cn('lg:col-start-1', row('types'))} />
          ) : null}

          {/* c6 */}
          <PrizesCard state={state} className="lg:col-start-2 lg:row-span-3 lg:row-start-1" />

          {/* c7 — before the end only. */}
          {block === 'upload' ? (
            <section aria-labelledby={UPLOAD_ID} data-testid="receipt-upload-card" className={cn(CARD, 'flex flex-col gap-3 lg:col-start-1', row('receipt'))}>
              <div className="flex items-start gap-3">
                <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-status-success-bg text-status-success-fg">
                  <ReceiptPercentIcon className="size-6" />
                </span>
                <div className="flex min-w-0 flex-col gap-1">
                  <h2 id={UPLOAD_ID} tabIndex={-1} className="t-heading text-ink outline-none">
                    {S.receiptSectionTitle}
                  </h2>
                  <p className="t-body text-ink-2">{raffleCopy.dashboard.prizesDescription}</p>
                </div>
              </div>
              {!state.canChangeType ? (
                <p className="t-caption flex items-start gap-1.5 text-ink-2" data-testid="receipt-upload-final">
                  <LockClosedIcon aria-hidden className="mt-px size-4 shrink-0" />
                  {statusCopy.firstUploadFinal}
                </p>
              ) : null}
              <Button icon={<ArrowUpTrayIcon />} onClick={openDialog('add')} className="w-full md:w-auto md:self-start">
                {S.addReceiptCta}
              </Button>
            </section>
          ) : null}
          {block === 'receipt' ? (
            <ReceiptCard
              className={cn('lg:col-start-1', row('receipt'))}
              headingId={RECEIPT_ID}
              imageUrl={state.receiptImageUrl}
              canChange={state.canChangeType}
              onReplace={openDialog('replace')}
              onDelete={() => void onDelete()}
              deleting={deleting}
              error={deleteError}
            />
          ) : null}

          {/* c8 */}
          <div className={cn('flex lg:col-start-1', row('back'))}>
            <Button variant="outline" icon={<HomeIcon />} onClick={() => router.replace(routes.home())} className="w-full md:w-auto">
              {S.backToHomeCta}
            </Button>
          </div>
        </div>
      </div>

      {state.sessionDocumentId ? (
        <ReceiptUploadDialog
          open={dialog !== null}
          onClose={() => setDialog(null)}
          mode={dialog ?? 'add'}
          sessionDocumentId={state.sessionDocumentId}
          receiptUploaded={state.receiptUploaded}
          receiptImageUrl={state.receiptImageUrl}
          onSuccess={() => {
            setDeleteError(null);
            focusTarget.current = 'receipt';
          }}
        />
      ) : null}
    </FlowLayout>
  );
}

/* ------------------------------------------------------------------ */
/* c2 c3 c4 — the bento hero                                           */
/* ------------------------------------------------------------------ */

function Hero({ state }: { state: RaffleState }) {
  const n = state.entriesCount;
  const countdown = showCountdown(state);
  const side = countdown || state.isEnded;
  return (
    <section aria-label={S.totalChancesLabel} className={BENTO} data-testid="raffle-hero">
      <BentoTile tone="signature" art={<TicketIcon />} className={cn('col-span-3', side && 'md:col-start-1 md:row-span-2 md:row-start-1')}>
        <p className="t-label tracking-[0.4px] text-lavender-2 uppercase">{S.totalChancesLabel}</p>
        <SignatureNumber
          size="tile"
          tone="lavender"
          unitTone="lavender"
          className="md:py-2 lg:py-4"
          value={<span className="tabular-nums" data-testid="raffle-chances">{n}</span>}
          unit={chancesToWinUnit(n)}
        />
        {state.receiptUploaded ? (
          <p className="t-caption pe-16 text-lavender-2" data-testid="raffle-with-receipt">
            {totalWithReceiptLine(n)}
          </p>
        ) : (
          <span aria-hidden />
        )}
      </BentoTile>

      {/* Phone: after the facts (order); from 768 the top right of the bento. */}
      {countdown ? <CountdownTile end={state.countdownEnd} className="order-last col-span-3 md:order-none md:col-start-4 md:row-start-1" /> : null}
      {state.isEnded ? (
        <BentoTile tone="lavender" art={<FlagIcon />} className="order-last col-span-3 min-h-0 md:order-none md:col-start-4 md:row-start-1 md:min-h-39">
          <p className="t-title2 my-auto pe-16 text-ink" data-testid="raffle-ended">
            {statusCopy.ended}
          </p>
        </BentoTile>
      ) : null}

      <ul aria-label="Detalii șanse" className="contents" data-testid="raffle-breakdown">
        <Fact label={S.entryLabel} value={ENTRY_CHANCES} tone="lavender" side={side && FACT_COLS[0]} testId="raffle-entry" />
        <Fact label={S.bonusLabel} value={bonusChances(state.receiptUploaded)} tone={state.receiptUploaded ? 'mint' : 'violet'} side={side && FACT_COLS[1]} testId="raffle-bonus" />
        <Fact label={S.totalLabel} value={n} tone="sky" side={side && FACT_COLS[2]} testId="raffle-total" />
      </ul>
    </section>
  );
}

/** With a countdown / «ended» tile: the facts sit under it, on the right half (columns 4–6, row 2). */
const FACT_COLS = ['md:col-start-4', 'md:col-start-5', 'md:col-start-6'] as const;

function Fact({ label, value, tone, side, testId }: { label: string; value: number; tone: 'lavender' | 'mint' | 'violet' | 'sky'; side: false | string; testId: string }) {
  return (
    <li className={cn('col-span-1 flex', side && cn('md:row-start-2', side))} data-testid={testId}>
      <FactTile label={label} value={<span className="tabular-nums">{value}</span>} tone={tone} className="w-full min-h-24 md:min-h-0" />
    </li>
  );
}

function CountdownTile({ end, className }: { end: Date | null; className?: string }) {
  // c3: computed when the page renders, never ticking (fish useCountdown has no timer).
  const [now] = useState(() => Date.now());
  const cells = countdownCells(countdownParts(end, now));
  return (
    <BentoTile tone="amber" art={<ClockIcon />} className={cn('min-h-0 md:min-h-39', className)}>
      <section aria-labelledby="sansele-mele-countdown" data-testid="raffle-countdown" className="flex flex-col gap-3">
        <h2 id="sansele-mele-countdown" className="t-body-strong text-status-warning-fg">
          {S.countdownLabel}
        </h2>
        {/* A countdown: masked in visual baselines (tests/visual/README.md). */}
        <ul className="grid grid-cols-3 gap-2 md:gap-3" data-visual-mask>
          {cells.map((c) => (
            <li key={c.id} className="flex flex-col items-center gap-0.5 rounded-control bg-surface/85 px-2 py-2.5 md:py-3" data-testid={`raffle-countdown-${c.id}`}>
              <span aria-hidden className="t-num-26 text-accent-ink tabular-nums" data-value>
                {c.value}
              </span>
              <span aria-hidden className="t-caption text-ink-2" data-label>
                {c.label}
              </span>
              <span className="sr-only">{c.spoken}</span>
            </li>
          ))}
        </ul>
      </section>
    </BentoTile>
  );
}

/* ------------------------------------------------------------------ */
/* c5 — the type                                                       */
/* ------------------------------------------------------------------ */

/**
 * c5: the type. fish commits on each tap (status.tsx:188-200); the web keeps that for a pointer, but
 * a server write must not ride on a radio's arrow keys (arrows move the selection as they move
 * focus, so just listening to the options would re-join with each one). Arrows only pick; Space /
 * Enter, a tap / click, or «Schimbă în …» commit. Escape drops an unconfirmed pick.
 */
function TypeCard({ state, transport, className }: { state: RaffleState; transport: ContentProps['transport']; className?: string }) {
  const qc = useQueryClient();
  const join = useMutation(joinRaffleSessionMutation(transport, qc, { mediaOrigin: RAFFLE_MEDIA_ORIGIN }));
  const [pending, setPending] = useState<string | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fieldset = useRef<HTMLFieldSetElement>(null);
  /** The last input came from a pointer (a tap / click on a tile commits at once, as fish). */
  const viaPointer = useRef(false);
  const saved = state.selectedTypeKey;
  const chosen = pending ?? draft ?? saved;
  const note = typesNote(state);
  const labelOf = (key: string | null) => state.types.find((t) => t.key === key)?.label ?? '';
  const unsaved = draft !== null && draft !== saved && pending === null;

  const commit = async (key: string) => {
    const id = state.sessionDocumentId;
    if (pending || !id || !state.canChangeType) return;
    if (key === saved) {
      setDraft(null);
      return;
    }
    const hadFocus = Boolean(fieldset.current?.contains(document.activeElement));
    setPending(key);
    setError(null);
    try {
      await join.mutateAsync({ sessionDocumentId: id, typeKey: key });
      // Busy until the participation says the new type (joins the mutation's own refetch).
      await qc.invalidateQueries({ queryKey: raffleKeys.participation }, { cancelRefetch: false });
    } catch {
      setError(statusCopy.typeChangeFailed);
    } finally {
      setDraft(null);
      setPending(null);
      // The fieldset was disabled meanwhile, which drops focus: give it back to the chosen tile.
      if (hadFocus) requestAnimationFrame(() => fieldset.current?.querySelector<HTMLInputElement>('input:checked')?.focus());
    }
  };

  const radioOf = (target: EventTarget) =>
    target instanceof HTMLInputElement && target.type === 'radio' && !target.disabled ? target : null;

  return (
    <section className={cn(CARD, className)} data-testid="raffle-types">
      <fieldset
        ref={fieldset}
        id={TYPES_ID}
        disabled={pending !== null}
        aria-busy={pending !== null || undefined}
        className="flex min-w-0 flex-col gap-3"
        onPointerDown={() => {
          viaPointer.current = true;
        }}
        onKeyDown={(e) => {
          viaPointer.current = false;
          const input = radioOf(e.target);
          if (!input) return;
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            void commit(input.value);
          } else if (e.key === 'Escape' && draft !== null) {
            e.preventDefault();
            setDraft(null);
          }
        }}
        // The label forwards its click to the radio: commit on the radio's own click, pointer only
        // (an arrow key also clicks the radio it lands on).
        onClick={(e) => {
          const input = radioOf(e.target);
          if (!input || !viaPointer.current) return;
          viaPointer.current = false;
          void commit(input.value);
        }}
      >
        <legend className="t-heading float-left w-full text-ink">{statusCopy.typesTitle}</legend>
        {note.locked ? (
          <p className="t-body flex items-start gap-1.5 text-ink-2" data-testid="raffle-type-locked">
            <LockClosedIcon aria-hidden className="mt-0.5 size-5 shrink-0" />
            {note.text}
          </p>
        ) : (
          <p className="t-body text-ink-2" data-testid="raffle-type-body">
            {note.text}
          </p>
        )}
        <ChoiceGrid compact>
          {state.types.map((t) => {
            const busy = pending === t.key;
            return (
              <ChoiceTile
                key={t.key}
                title={t.label}
                disabled={typeTileDisabled(t.key, chosen, state.canChangeType)}
                badge={
                  busy ? (
                    <span className="flex items-center" data-testid="raffle-type-busy">
                      <ArrowPathIcon aria-hidden className="size-5 animate-spin text-on-accent motion-reduce:animate-none" />
                      <span className="sr-only">{statusCopy.typeChanging}</span>
                    </span>
                  ) : undefined
                }
                radio={{
                  name: 'sansele-mele-tip',
                  value: t.key,
                  checked: chosen === t.key,
                  // A keyboard pick only (a pointer's commits in onClick above).
                  onChange: () => {
                    if (!viaPointer.current) setDraft(t.key === saved ? null : t.key);
                  },
                }}
              />
            );
          })}
        </ChoiceGrid>
        {unsaved ? (
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between" data-testid="raffle-type-unsaved">
            <p className="t-caption text-ink-2">{statusCopy.typeUnsaved(labelOf(saved))}</p>
            <Button size="compact" onClick={() => { if (draft) void commit(draft); }} className="self-start md:self-auto">
              {statusCopy.typeConfirmCta(labelOf(draft))}
            </Button>
          </div>
        ) : null}
        <p role="alert" data-testid="raffle-type-error" className="t-body-strong text-status-danger-fg empty:hidden">
          {error ?? ''}
        </p>
      </fieldset>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* c6 — the prizes                                                     */
/* ------------------------------------------------------------------ */

const STATIC_ART = [
  null,
  { icon: <GiftIcon className="size-7" />, className: 'bg-accent-tint text-accent-ink' },
  { icon: <TrophyIcon className="size-7" />, className: 'bg-status-warning-bg text-status-warning-fg' },
] as const;

function PrizesCard({ state, className }: { state: RaffleState; className?: string }) {
  const [open, setOpen] = useState<number | null>(null);
  const fromSession = state.sessionPrizes.length > 0;
  return (
    <FlowAsideCard title={S.prizesTitle} id={PRIZES_ID} className={className}>
      <ul className="flex flex-col gap-4" data-testid="raffle-prizes" data-source={fromSession ? 'session' : 'static'}>
        {fromSession
          ? state.sessionPrizes.map((p, i) => {
              const type = state.types.find((t) => t.key === p.typeKey);
              return (
                <li key={i}>
                  <PrizeRow
                    variant="status"
                    prize={p}
                    typeLabel={prizeTypeLabel(p.typeKey, type?.label)}
                    typeBadgeColor={type?.badgeColor ?? null}
                    // One open at a time, all closed at first (fish expandedPrizeIndex).
                    expanded={open === i}
                    onToggle={(next) => setOpen(next ? i : null)}
                  />
                </li>
              );
            })
          : statusCopy.staticPrizes.map((p, i) => {
              const art = STATIC_ART[i];
              return (
                <li key={p.title} className="flex items-center gap-3">
                  {art ? (
                    <span aria-hidden className={cn('flex size-14 shrink-0 items-center justify-center rounded-full', art.className)}>
                      {art.icon}
                    </span>
                  ) : (
                    <span className="relative size-14 shrink-0 overflow-hidden rounded-avatar bg-accent-tint-2">
                      <Image src={lakePhoto} alt="" fill sizes="56px" className="object-cover" />
                    </span>
                  )}
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="t-body-strong text-ink">{p.title}</span>
                    <span className="t-caption text-ink-2">{p.description}</span>
                  </span>
                </li>
              );
            })}
      </ul>
    </FlowAsideCard>
  );
}

/* ------------------------------------------------------------------ */
/* States                                                              */
/* ------------------------------------------------------------------ */

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

/** Loading: the real header, the bento in grey, then the two columns in grey. */
export function StatusSkeleton() {
  const shimmer = 'block bg-soft-fill animate-shimmer';
  return (
    <FlowLayout header={<Header />} labelledBy={TITLE_ID} variant="bare" busy>
      <FlowLoadingStatus />
      <div aria-hidden className="flex flex-col gap-4 md:gap-6">
        <div className={BENTO}>
          <span className={cn(shimmer, 'col-span-3 h-39 rounded-bento md:col-start-1 md:row-span-2 md:row-start-1 md:h-auto')} />
          <span className={cn(shimmer, 'order-last col-span-3 h-32 rounded-bento md:order-none md:col-start-4 md:row-start-1 md:h-39')} />
          {FACT_COLS.map((c) => (
            <span key={c} className={cn(shimmer, 'col-span-1 h-24 rounded-bento md:row-start-2', c)} />
          ))}
        </div>
        <div className={COLUMNS}>
          <div className={cn(CARD, 'flex flex-col gap-3 lg:col-start-1 lg:row-start-1')}>
            <span className={cn(shimmer, 'h-4 w-44 rounded-full')} />
            <span className={cn(shimmer, 'h-3 w-full rounded-full')} />
            <span className="grid grid-cols-3 gap-2">
              {[0, 1, 2].map((i) => (
                <span key={i} className={cn(shimmer, 'h-16 rounded-card')} />
              ))}
            </span>
          </div>
          <div className={cn(CARD, 'flex flex-col gap-4 lg:col-start-2 lg:row-span-3 lg:row-start-1')}>
            <span className={cn(shimmer, 'h-4 w-48 rounded-full')} />
            {[0, 1, 2].map((i) => (
              <span key={i} className={cn(shimmer, 'h-14 rounded-control')} />
            ))}
          </div>
          <div className={cn(CARD, 'flex flex-col gap-3 lg:col-start-1 lg:row-start-2')}>
            <span className={cn(shimmer, 'h-4 w-56 rounded-full')} />
            <span className={cn(shimmer, 'h-12 rounded-control')} />
          </div>
        </div>
      </div>
    </FlowLayout>
  );
}
