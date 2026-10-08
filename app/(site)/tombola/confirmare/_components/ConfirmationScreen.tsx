'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowPathIcon, ArrowUpTrayIcon, ExclamationTriangleIcon, LockClosedIcon, TicketIcon, TrophyIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { FlowAsideCard, FlowConfirmation, FlowHeader, FlowLayout, FlowLoadingStatus } from '@/components/templates/T6';
import { T4Gate } from '@/components/templates/T4';
import { BentoTile } from '@/components/ui/BentoTile';
import { Button, ButtonLink } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { SignatureNumber } from '@/components/ui/SignatureNumber';
import { deleteRaffleReceiptMutation, raffleKeys, type RaffleState } from '@/core/organizer';
import { isApiError } from '@/core/transport';
import { routes } from '@/lib/routes';
import { prizesToShow, prizeTypeLabel, raffleCopy, type ReceiptUploadMode } from '../../_shared/copy';
import { PrizeRow } from '../../_shared/PrizeRow';
import { RECEIPT_DELETE_FAILED, ReceiptCard } from '../../_shared/ReceiptCard';
import { ReceiptUploadDialog } from '../../_shared/ReceiptUploadDialog';
import { RAFFLE_MEDIA_ORIGIN, useRaffle } from '../../_shared/useRaffle';
import { Confetti } from './Confetti';
import { chancesUnit, confirmationHeading, firstUploadIsFinal, notJoinedRedirect, receiptBlock, showWinnersLink } from './model';

const C = raffleCopy.confirmation;
const TITLE_ID = 'confirmare-titlu';
const UPLOAD_ID = 'confirmare-bon';
const RECEIPT_ID = 'confirmare-bon-incarcat';
const PRIZES_ID = 'confirmare-premii';

/**
 * Phone: fish's single column, in fish's order (celebration, chances, prizes, the receipt card, the
 * buttons). ≥1024 two columns on the same DOM: the celebration + chances, the receipt card and the
 * buttons on the left (rows 1–3), the prizes on the right spanning them. The last row takes the
 * slack (1fr) so a long prize list never pushes the buttons away from the card above them.
 */
const GRID =
  'flex flex-col gap-4 md:gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:grid-rows-[auto_auto_1fr] lg:items-start lg:gap-x-8 2xl:grid-cols-[minmax(0,1fr)_minmax(0,30rem)]';
const LEFT = 'lg:col-start-1';
/** The bento: the celebration and the chances tile side by side from 768 (rule 19: own surfaces). */
const HERO = 'grid gap-4 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] md:gap-6';
const CELEBRATION = 'relative isolate overflow-hidden rounded-bento bg-linear-160 from-bento-lavender from-40% to-bento-lavender-2';
const CARD = 'rounded-card bg-surface p-4 shadow-e0 md:p-5 xl:p-6';

/** Web only: a failed background refresh over data already on screen (rule 4: say it may be old). */
const REFRESH_FAILED = 'Nu am putut actualiza tombola. Ce vezi poate să nu fie la zi.';
/** Web only (c5 + c7): registration closed, no receipt yet — a first upload is still taken, but final. */
const FIRST_UPLOAD_FINAL = 'Înscrierile s-au închis: după ce îl încarci, bonul nu mai poate fi înlocuit sau șters.';

function Header() {
  return <FlowHeader title={C.title} id={TITLE_ID} backHref={routes.home()} backLabel="Înapoi acasă" />;
}

/**
 * /tombola/confirmare «Confirmare participare» (fish app/(app)/raffle/confirmation.tsx; parity
 * participant.raffle-confirmation, T6). The gate (requireViewer) already sent signed-out visitors to
 * sign-in; the session and the participation are per viewer, read through /api/cms (useRaffle).
 *
 * Unknown → skeleton or the retry gate (owner rule 4), never «0 șanse» for «we could not check» —
 * but only while nothing has loaded: a failed background refetch (focus, stale, after a write) keeps
 * the known content and says the refresh failed inline (`hasData`).
 * Not joined (or no session): fish renders «Ești înscris…» with 0 chances; the web hands over to the
 * intro (/tombola), which shows the join form or sends the viewer on (notJoinedRedirect).
 */
export function ConfirmationScreen() {
  const raffle = useRaffle();
  const router = useRouter();
  const dead = isApiError(raffle.error) && raffle.error.code === 'SESSION_DEAD';
  const leave = raffle.hasData && !dead && notJoinedRedirect(raffle.state, { fetching: raffle.retrying });
  useEffect(() => {
    if (leave) router.replace(routes.raffle());
  }, [leave, router]);

  if (dead) return <ConfirmationSkeleton />;
  if (!raffle.hasData) {
    if (raffle.status === 'error') return <LoadError retrying={raffle.retrying} onRetry={raffle.retry} />;
    return <ConfirmationSkeleton />;
  }
  // Not joined: the skeleton while the intro loads (also while a just-made join's refetch lands).
  if (!raffle.state.joined) return <ConfirmationSkeleton />;
  return (
    <ConfirmationContent
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

function ConfirmationContent({ state, transport, refreshFailed, refreshing, onRefresh }: ContentProps) {
  const qc = useQueryClient();
  const del = useMutation(deleteRaffleReceiptMutation(transport, qc, { mediaOrigin: RAFFLE_MEDIA_ORIGIN }));
  const [dialog, setDialog] = useState<ReceiptUploadMode | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  /** After an upload / a delete the card is swapped: focus goes to the new card's heading. */
  const focusTarget = useRef<'upload' | 'receipt' | null>(null);

  const { prizes, fromSession } = useMemo(() => prizesToShow(state.sessionPrizes), [state.sessionPrizes]);
  const block = receiptBlock(state);
  const uploadIsFinal = firstUploadIsFinal(state);
  const selectedType = state.types.find((t) => t.key === state.selectedTypeKey) ?? null;
  const n = state.entriesCount;

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
      // Set before the refetch lands: the swap to the upload card runs the focus effect.
      focusTarget.current = 'upload';
      // Stay busy until the participation is back (the card then becomes the upload card, c11):
      // joins the invalidation's refetch instead of starting a second one.
      await qc.invalidateQueries({ queryKey: raffleKeys.participation }, { cancelRefetch: false });
    } catch {
      // fish swallows it (confirmation.tsx:50-57); the web says so (c8).
      setDeleteError(RECEIPT_DELETE_FAILED);
    } finally {
      setDeleting(false);
    }
  };

  /** A stale «Nu am putut șterge bonul…» never outlives the next attempt to change the receipt. */
  const openDialog = (mode: ReceiptUploadMode) => () => {
    setDeleteError(null);
    setDialog(mode);
  };

  const heading = confirmationHeading(state);

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
            {REFRESH_FAILED}
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
      <div className={GRID}>
        {/* c2 c3 — the celebration and the chances, one bento row. */}
        <div className={cn(HERO, LEFT, 'lg:row-start-1')}>
          <div className={CELEBRATION} data-testid="raffle-celebration">
            {/* Centred on FlowConfirmation's disc: its top padding (32 / 48 from 768) + 28 − 56. */}
            <Confetti className="absolute inset-x-0 top-1 z-behind h-28 w-full md:top-5" />
            <FlowConfirmation
              label={`${heading} ${C.subMessage}`}
              value={
                <h2 className="t-title2 max-w-md text-balance text-ink" data-testid="raffle-heading">
                  {heading}
                </h2>
              }
              caption={<span className="t-body-strong text-on-bento-lavender">{C.subMessage}</span>}
            />
          </div>
          <BentoTile tone="signature" art={<TicketIcon />} className="md:min-h-0">
            <p className="t-label tracking-[0.4px] text-lavender-2 uppercase">{C.currentChancesLabel}</p>
            <SignatureNumber
              size="tile"
              tone="lavender"
              unitTone="lavender"
              value={<span className="tabular-nums" data-testid="raffle-chances">{n}</span>}
              unit={chancesUnit(n)}
            />
            {selectedType ? (
              <p className="t-caption pe-16 text-lavender-2">
                {raffleCopy.winners.perCategory} {selectedType.label}
              </p>
            ) : (
              <span aria-hidden />
            )}
          </BentoTile>
        </div>

        {/* c4 — every prize expanded at first (fish's default expand). */}
        <FlowAsideCard title={raffleCopy.intro.prizesTitle} id={PRIZES_ID} className="lg:col-start-2 lg:row-span-3 lg:row-start-1">
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
        </FlowAsideCard>

        {/* c5 — before the end, no receipt yet. */}
        {block === 'upload' ? (
          <section aria-labelledby={UPLOAD_ID} className={cn(CARD, LEFT, 'flex flex-col gap-4 lg:row-start-2')} data-testid="receipt-upload-card">
            <div className="flex flex-col gap-2">
              <h2 id={UPLOAD_ID} tabIndex={-1} className="t-heading text-ink outline-none">
                {C.bonusHeading}
              </h2>
              <p className="t-body-strong text-ink-2">{C.bonusInstructions}</p>
            </div>
            <div className="flex items-center gap-3 rounded-control border-2 border-dashed border-status-success-fg p-3 md:self-start md:pe-5" data-testid="receipt-bonus">
              <span className="t-title2 shrink-0 text-status-success-fg tabular-nums">{C.bonusHighlight}</span>
              <span className="t-body-strong text-ink">{C.bonusHighlightLabel}</span>
            </div>
            {uploadIsFinal ? (
              <p className="t-caption flex items-start gap-1.5 text-ink-2" data-testid="receipt-upload-final">
                <LockClosedIcon aria-hidden className="mt-px size-4 shrink-0" />
                {FIRST_UPLOAD_FINAL}
              </p>
            ) : null}
            <Button icon={<ArrowUpTrayIcon />} onClick={openDialog('first')} className="w-full md:w-auto md:self-start">
              {C.uploadCta}
            </Button>
          </section>
        ) : null}

        {/* c6 c7 c8 — before the end, with a receipt. */}
        {block === 'receipt' ? (
          <ReceiptCard
            className={cn(LEFT, 'lg:row-start-2')}
            title={C.receiptUploadedTitle}
            headingId={RECEIPT_ID}
            imageUrl={state.receiptImageUrl}
            canChange={state.canChangeType}
            onReplace={openDialog('replace')}
            onDelete={() => void onDelete()}
            deleting={deleting}
            error={deleteError}
          />
        ) : null}

        {/* c9 c1 */}
        <div className={cn(LEFT, block ? 'lg:row-start-3' : 'lg:row-start-2', 'flex flex-col gap-2.5 px-0 md:flex-row md:flex-wrap md:items-center')}>
          {showWinnersLink(state) ? (
            <ButtonLink href={routes.raffleWinners()} icon={<TrophyIcon />}>
              {raffleCopy.dashboard.ctaSeeWinners}
            </ButtonLink>
          ) : null}
          <ButtonLink href={routes.home()} variant="outline" icon={<XMarkIcon />}>
            {C.laterCta}
          </ButtonLink>
        </div>
      </div>

      {/* c10 — mounted only while open, so every open starts clean. */}
      {state.sessionDocumentId ? (
        <ReceiptUploadDialog
          open={dialog !== null}
          onClose={() => setDialog(null)}
          mode={dialog ?? 'first'}
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

/** Loading: the real header, the bento row, the receipt card and the prizes column in grey. */
export function ConfirmationSkeleton() {
  const bar = 'block rounded-full bg-soft-fill animate-shimmer';
  return (
    <FlowLayout header={<Header />} labelledBy={TITLE_ID} variant="bare" busy>
      <FlowLoadingStatus />
      <div aria-hidden className={GRID}>
        <div className={cn(HERO, LEFT, 'lg:row-start-1')}>
          <span className="block h-64 rounded-bento bg-soft-fill animate-shimmer md:h-72" />
          <span className="block h-39 rounded-bento bg-soft-fill animate-shimmer md:h-auto" />
        </div>
        <div className={cn(CARD, 'flex flex-col gap-2 lg:col-start-2 lg:row-span-3 lg:row-start-1')}>
          <span className={cn(bar, 'mb-1 h-4 w-20')} />
          {[0, 1, 2].map((i) => (
            <span key={i} className="block h-15 rounded-control bg-soft-fill animate-shimmer" />
          ))}
        </div>
        <div className={cn(CARD, LEFT, 'flex flex-col gap-3 lg:row-start-2')}>
          <span className={cn(bar, 'h-4 w-56')} />
          <span className={cn(bar, 'h-3 w-full')} />
          <span className="block h-12 rounded-control bg-soft-fill animate-shimmer" />
        </div>
      </div>
    </FlowLayout>
  );
}
