'use client';

import { useEffect, useId, useRef, useState, type DragEvent } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowPathIcon, CameraIcon, ExclamationTriangleIcon, InformationCircleIcon, PhotoIcon } from '@heroicons/react/24/outline';
import { FlowHeader, FlowHeaderSkeleton, FlowLayout, FlowLoadingStatus } from '@/components/templates/T6';
import { T4Gate } from '@/components/templates/T4';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { uploadRaffleReceiptMutation, type RaffleState } from '@/core/organizer';
import { isApiError, type Transport } from '@/core/transport';
import { routes } from '@/lib/routes';
import { raffleCopy, receiptDialogTitle, showReceiptPreview, type ReceiptUploadMode } from '../../_shared/copy';
import { prepareReceipt, useCoarsePointer } from '../../_shared/media';
import { RAFFLE_MEDIA_ORIGIN, useRaffle } from '../../_shared/useRaffle';

const C = raffleCopy.uploadReceipt;
const TITLE_ID = 'bon-titlu';
const UPLOAD_ID = 'bon-incarca';
const PREVIEW_ID = 'bon-incarcat';
const INSTRUCTIONS_ID = 'bon-instructiuni';
const TIPS_ID = 'bon-sfaturi';
/** Web only: the upload card takes a dropped photo on a desktop (a pointer, not a touch screen). */
const DROP_HINT = 'Sau trage fotografia bonului aici.';

/**
 * DOM order = the phone's order (fish's single column, WCAG 1.3.2): the preview (replace), the
 * instructions, the upload card, the tips. ≥1024 the same DOM is placed on a grid, never reordered:
 * the upload card (a drop zone) alone on the left, spanning every row; the preview (a compact row),
 * the instructions and the tips auto-flow down the right column (26rem; 30rem from 1536). The last
 * row is `1fr` so a tall drop zone grows that track, not the gaps between the right-hand cards.
 */
const COLUMNS =
  'flex flex-col gap-4 md:gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:grid-rows-[auto_auto_auto_1fr] lg:items-start lg:gap-x-8 2xl:grid-cols-[minmax(0,1fr)_minmax(0,30rem)]';
const LEFT = 'lg:col-start-1 lg:row-start-1 lg:row-span-4 lg:min-w-0';
const RIGHT = 'lg:col-start-2 lg:min-w-0';
const CARD = 'rounded-card bg-surface p-4 shadow-e0 md:p-5 xl:p-6';

function Header({ mode }: { mode: ReceiptUploadMode }) {
  return <FlowHeader title={receiptDialogTitle(mode)} id={TITLE_ID} backHref={routes.raffleConfirmation()} />;
}

/**
 * /tombola/bon «Încarcă bonul fiscal» (fish app/(app)/raffle/upload-receipt.tsx; parity
 * participant.raffle-upload-receipt, T6) — the page form of _shared/ReceiptUploadDialog, same
 * sections, same copy, same core mutation (multipart POST /raffle-sessions/{id}/receipt, which also
 * replaces: fish replaceReceipt is the same endpoint).
 *
 * Gating as «Șansele mele»: unknown → skeleton or the retry gate (owner rule 4); a viewer who is not
 * in the raffle (or without a session) is handed to the intro (/tombola), which routes them on —
 * a receipt belongs to a participation.
 */
export function UploadReceiptScreen({ mode }: { mode: ReceiptUploadMode }) {
  const raffle = useRaffle();
  const router = useRouter();
  const dead = isApiError(raffle.error) && raffle.error.code === 'SESSION_DEAD';
  const leave = raffle.hasData && !dead && !raffle.state.joined && !raffle.retrying;
  // fish hides the receipt block once the draw is over (status.tsx `!isEnded`): a deep link after
  // the end goes to «Șansele mele», never to an upload the CMS would still accept.
  const ended = raffle.hasData && !dead && !leave && raffle.state.isEnded;
  useEffect(() => {
    if (leave) router.replace(routes.raffle());
    else if (ended) router.replace(routes.raffleStatus());
  }, [leave, ended, router]);

  if (dead) return <UploadReceiptSkeleton mode={mode} />;
  if (!raffle.hasData) {
    if (raffle.status === 'error') return <LoadError mode={mode} retrying={raffle.retrying} onRetry={raffle.retry} />;
    return <UploadReceiptSkeleton mode={mode} />;
  }
  if (!raffle.state.joined || !raffle.state.sessionDocumentId || raffle.state.isEnded) return <UploadReceiptSkeleton mode={mode} />;
  return <UploadContent mode={mode} state={raffle.state} transport={raffle.transport} />;
}

function UploadContent({ mode, state, transport }: { mode: ReceiptUploadMode; state: RaffleState; transport: Transport }) {
  const router = useRouter();
  const qc = useQueryClient();
  const upload = useMutation(uploadRaffleReceiptMutation(transport, qc, { mediaOrigin: RAFFLE_MEDIA_ORIGIN }));
  const touch = useCoarsePointer();
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const errorId = useId();
  const preview = showReceiptPreview(mode, state.receiptUploaded, state.receiptImageUrl);
  const sessionId = state.sessionDocumentId!;

  const onFile = async (file: File | undefined) => {
    if (!file || busy) return;
    setBusy(true);
    setError(null);
    try {
      const ready = await prepareReceipt(file);
      await upload.mutateAsync({ raffleId: sessionId, file: { blob: ready, filename: ready.name } });
      // Stays busy: the page is on its way out (fish router.replace('/raffle/receipt-submitted')).
      router.replace(routes.raffleReceiptSubmitted());
    } catch {
      // fish has no catch (the upload just stops); the web says so and keeps the page.
      setError(C.uploadFailed);
      setBusy(false);
    }
  };

  const imageOf = (files: FileList | undefined) => Array.from(files ?? []).find((x) => x.type.startsWith('image/'));

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    void onFile(imageOf(e.dataTransfer.files));
  };

  // A pointer device: a photo dropped just outside the drop zone (instructions, tips, gutter,
  // header) would make the browser open the file and leave the page. The whole window takes it
  // instead, same upload; the card's own drop has already called preventDefault, so it is skipped.
  const dropRef = useRef({ busy, onFile, imageOf });
  useEffect(() => {
    dropRef.current = { busy, onFile, imageOf };
  });
  useEffect(() => {
    if (touch) return;
    const hasFiles = (e: globalThis.DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files');
    const over = (e: globalThis.DragEvent) => {
      if (!hasFiles(e) || e.defaultPrevented) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = dropRef.current.busy ? 'none' : 'copy';
    };
    const drop = (e: globalThis.DragEvent) => {
      if (!hasFiles(e) || e.defaultPrevented) return;
      e.preventDefault();
      const { busy: b, onFile: upload, imageOf: pick } = dropRef.current;
      if (!b) void upload(pick(e.dataTransfer?.files));
    };
    window.addEventListener('dragover', over);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragover', over);
      window.removeEventListener('drop', drop);
    };
  }, [touch]);

  const spinner = busy ? <ArrowPathIcon className="animate-spin motion-reduce:animate-none" /> : undefined;

  return (
    <FlowLayout header={<Header mode={mode} />} labelledBy={TITLE_ID} variant="bare">
      <div className={COLUMNS} aria-busy={busy || undefined}>
        {preview && state.receiptImageUrl ? (
          <section
            aria-labelledby={PREVIEW_ID}
            data-testid="receipt-preview"
            className={cn(CARD, RIGHT, 'flex flex-col gap-3 lg:flex-row-reverse lg:items-center lg:justify-end lg:gap-4')}
          >
            {/* Phone: fish's stack (title, image, hint). From lg a compact row: the thumbnail left, the text right. */}
            <div className="flex min-w-0 flex-col gap-1">
              <h2 id={PREVIEW_ID} className="t-heading text-ink">
                {C.previewTitle}
              </h2>
              <p className="t-caption hidden text-muted lg:block">{C.previewHint}</p>
            </div>
            <span className="relative mx-auto block h-50 w-full max-w-70 shrink-0 overflow-hidden rounded-control bg-soft-fill lg:mx-0 lg:h-28 lg:w-40">
              {/* A private receipt: the browser fetches it, never the image optimizer's shared cache. */}
              <Image src={state.receiptImageUrl} alt={C.previewTitle} fill unoptimized sizes="(min-width: 1024px) 160px, 280px" className="object-contain" />
            </span>
            <p className="t-caption text-center text-muted lg:hidden">{C.previewHint}</p>
          </section>
        ) : null}

        <section aria-labelledby={INSTRUCTIONS_ID} data-testid="receipt-instructions" className={cn(RIGHT, 'rounded-card border-l-4 border-accent bg-accent-tint p-4 md:p-5 xl:p-6')}>
          <h2 id={INSTRUCTIONS_ID} className="t-body-strong text-accent-ink">
            {C.instructionsTitle}
          </h2>
          <p className="t-body mt-2 text-ink-2">{C.instructions}</p>
          <p data-testid="receipt-disclaimer" className="t-caption mt-3 rounded-control bg-status-danger-bg p-3 text-status-danger-fg">
            {C.receiptVerificationDisclaimer}
          </p>
        </section>

        <section
          aria-labelledby={UPLOAD_ID}
          data-testid="receipt-upload-card"
          onDragOver={(e) => {
            if (busy || touch) return;
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            if (busy || touch) return;
            onDrop(e);
          }}
          className={cn(
            CARD,
            LEFT,
            'flex flex-col items-center gap-4 text-center',
            'lg:min-h-96 lg:justify-center lg:border-2 lg:border-dashed lg:border-accent-tint-3 lg:py-10',
            dragging && 'lg:border-accent lg:bg-accent-tint',
          )}
        >
          <span aria-hidden className="flex size-14 items-center justify-center rounded-full bg-accent-tint text-accent-ink lg:size-20">
            <CameraIcon className="size-7 lg:size-10" />
          </span>
          <div className="flex flex-col gap-1">
            <h2 id={UPLOAD_ID} className="t-title2 text-ink">
              {C.uploadSectionTitle}
            </h2>
            <p className="t-body text-muted">{C.uploadSectionSubtitle}</p>
          </div>
          <div className="flex w-full flex-col gap-2.5 md:max-w-sm">
            {touch ? (
              <Button
                block
                icon={spinner ?? <CameraIcon />}
                onClick={() => camera.current?.click()}
                disabled={busy}
                aria-busy={busy || undefined}
                aria-describedby={error ? errorId : undefined}
              >
                {C.takePhoto}
              </Button>
            ) : null}
            <Button
              block
              variant={touch ? 'outline' : 'primary'}
              icon={spinner ?? <PhotoIcon />}
              onClick={() => gallery.current?.click()}
              disabled={busy}
              aria-busy={busy || undefined}
              aria-describedby={error ? errorId : undefined}
            >
              {C.pickFromGallery}
            </Button>
          </div>
          {!touch ? <p className="t-caption hidden text-muted lg:block">{DROP_HINT}</p> : null}
          <p role="status" data-testid="receipt-upload-status" className="t-caption text-muted empty:hidden">
            {busy ? C.uploading : ''}
          </p>
          <p id={errorId} role="alert" data-testid="receipt-upload-error" className="t-body-strong text-status-danger-fg empty:hidden">
            {error ?? ''}
          </p>
          <input
            ref={camera}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            data-testid="receipt-upload-camera"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              void onFile(f);
            }}
          />
          <input
            ref={gallery}
            type="file"
            accept="image/*"
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            data-testid="receipt-upload-gallery"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              void onFile(f);
            }}
          />
        </section>

        <section aria-labelledby={TIPS_ID} data-testid="receipt-tips" className={cn(RIGHT, 'flex gap-3 rounded-card bg-status-info-bg p-4 md:p-5 xl:p-6')}>
          <InformationCircleIcon aria-hidden className="size-6 shrink-0 text-status-info-fg" />
          <div className="min-w-0">
            <h2 id={TIPS_ID} className="t-body-strong text-ink">
              {C.tipsTitle}
            </h2>
            <ul className="t-body mt-1 list-disc pl-4 text-ink-2">
              {C.tips.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </FlowLayout>
  );
}

/* ------------------------------------------------------------------ */
/* States                                                              */
/* ------------------------------------------------------------------ */

function LoadError({ mode, retrying, onRetry }: { mode: ReceiptUploadMode; retrying: boolean; onRetry: () => void }) {
  return (
    <FlowLayout header={<Header mode={mode} />} variant="bare" narrow>
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

/**
 * Loading: the real header when the mode is known (the client screen), a grey title line in the
 * route's Suspense fallback (the query is not read yet); the two columns in grey.
 */
export function UploadReceiptSkeleton({ mode }: { mode?: ReceiptUploadMode }) {
  const shimmer = 'block bg-soft-fill animate-shimmer';
  return (
    <FlowLayout
      header={mode ? <Header mode={mode} /> : <FlowHeaderSkeleton meta={false} trailing={false} />}
      labelledBy={mode ? TITLE_ID : undefined}
      variant="bare"
      busy
    >
      <FlowLoadingStatus />
      <div aria-hidden className={COLUMNS}>
        <div className={cn(CARD, RIGHT, 'flex flex-col gap-3')}>
          <span className={cn(shimmer, 'h-4 w-28 rounded-full')} />
          <span className={cn(shimmer, 'h-3 w-full rounded-full')} />
          <span className={cn(shimmer, 'h-3 w-4/5 rounded-full')} />
          <span className={cn(shimmer, 'h-14 rounded-control')} />
        </div>
        <div className={cn(CARD, LEFT, 'flex flex-col items-center gap-4 lg:min-h-96 lg:justify-center')}>
          <span className={cn(shimmer, 'size-14 rounded-full lg:size-20')} />
          <span className={cn(shimmer, 'h-5 w-48 rounded-full')} />
          <span className={cn(shimmer, 'h-4 w-40 rounded-full')} />
          <span className={cn(shimmer, 'h-12 w-full rounded-control md:max-w-sm')} />
        </div>
        <div className={cn(CARD, RIGHT, 'flex flex-col gap-3')}>
          <span className={cn(shimmer, 'h-4 w-56 rounded-full')} />
          <span className={cn(shimmer, 'h-3 w-full rounded-full')} />
          <span className={cn(shimmer, 'h-3 w-3/4 rounded-full')} />
        </div>
      </div>
    </FlowLayout>
  );
}
