'use client';

import { useId, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowPathIcon, CameraIcon, InformationCircleIcon, PhotoIcon } from '@heroicons/react/24/outline';
import { ResponsiveSurface } from '@/components/surfaces/ResponsiveSurface';
import { Button } from '@/components/ui/Button';
import { uploadRaffleReceiptMutation } from '@/core/organizer';
import { createBrowserTransport } from '@/lib/client/transport';
import { raffleCopy, receiptDialogTitle, showReceiptPreview, type ReceiptUploadMode } from './copy';
import { prepareReceipt, useCoarsePointer } from './media';
import { RAFFLE_MEDIA_ORIGIN } from './useRaffle';

const C = raffleCopy.uploadReceipt;

type Props = {
  open: boolean;
  onClose: () => void;
  mode: ReceiptUploadMode;
  /** The active session (POST /raffle-sessions/{id}/receipt). */
  sessionDocumentId: string;
  /** The participation's receipt: replace mode previews it. */
  receiptUploaded: boolean;
  receiptImageUrl: string | null;
  /** After a successful upload, once the dialog has closed (fish onSuccess). */
  onSuccess?: () => void;
};

/**
 * fish components/raffle/RaffleUploadReceiptSheet.tsx (opened from the confirmation, the status and
 * the upload pages): a sheet on the phone, a dialog from 768 (ResponsiveSurface «info»).
 * - title per mode: «Încarcă bonul fiscal» / «Adaugă bon fiscal» / «Înlocuiește bonul fiscal»;
 * - replace with a receipt already uploaded: «Bonul tău încărcat» with the image;
 * - instructions + the red disqualification disclaimer, the upload card («Fotografiază acum» on a
 *   touch screen, «Încarcă din galerie» always), the tips;
 * - a chosen file uploads at once (core uploadRaffleReceiptMutation: multipart `files`, invalidates
 *   raffle active + participation + competitions); both buttons busy meanwhile; success closes and
 *   calls onSuccess. fish swallows a failure (no catch) — the web shows the error and stays open.
 * Mounted only while open, so a reopen starts clean (no stale error).
 */
export function ReceiptUploadDialog(props: Props) {
  if (!props.open) return null;
  return <UploadSurface {...props} />;
}

function UploadSurface({ onClose, mode, sessionDocumentId, receiptUploaded, receiptImageUrl, onSuccess }: Props) {
  const t = useMemo(() => createBrowserTransport(), []);
  const qc = useQueryClient();
  const upload = useMutation(uploadRaffleReceiptMutation(t, qc, { mediaOrigin: RAFFLE_MEDIA_ORIGIN }));
  const touch = useCoarsePointer();
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorId = useId();
  const preview = showReceiptPreview(mode, receiptUploaded, receiptImageUrl);

  const onFile = async (file: File | undefined) => {
    if (!file || busy) return;
    setBusy(true);
    setError(null);
    try {
      const ready = await prepareReceipt(file);
      await upload.mutateAsync({ raffleId: sessionDocumentId, file: { blob: ready, filename: ready.name } });
      onClose();
      onSuccess?.();
    } catch {
      setError(C.uploadFailed);
      setBusy(false);
    }
  };

  const close = () => {
    if (!busy) onClose();
  };

  const spinner = busy ? <ArrowPathIcon className="animate-spin motion-reduce:animate-none" /> : undefined;

  return (
    <ResponsiveSurface open onClose={close} intent="info" title={receiptDialogTitle(mode)} sheetSnap={0.9} pinnedActions>
      <div className="flex flex-col gap-4" aria-busy={busy || undefined}>
        {preview && receiptImageUrl ? (
          <section aria-label={C.previewTitle} className="flex flex-col gap-2 rounded-card bg-soft-fill p-3">
            <p className="t-body-strong text-ink">{C.previewTitle}</p>
            <span className="relative mx-auto block h-45 w-full max-w-65 overflow-hidden rounded-control">
              <Image src={receiptImageUrl} alt={C.previewTitle} fill sizes="260px" className="object-contain" />
            </span>
            <p className="t-caption text-center text-muted">{C.previewHint}</p>
          </section>
        ) : null}

        <div className="rounded-card border-l-4 border-accent bg-accent-tint p-4">
          <p className="t-body-strong text-accent-ink">{C.instructionsTitle}</p>
          <p className="t-body mt-2 text-ink-2">{C.instructions}</p>
          <p className="t-caption mt-3 rounded-control bg-status-danger-bg p-3 text-status-danger-fg">{C.receiptVerificationDisclaimer}</p>
        </div>

        <div className="flex flex-col gap-4 rounded-card bg-surface p-4 shadow-e0">
          <div className="flex flex-col items-center gap-3 text-center">
            <span aria-hidden className="flex size-14 items-center justify-center rounded-full bg-accent-tint text-accent-ink">
              <CameraIcon className="size-7" />
            </span>
            <p className="t-body-strong text-ink">{C.uploadSectionTitle}</p>
            <p className="t-body text-muted">{C.uploadSectionSubtitle}</p>
          </div>
          <div className="flex flex-col gap-2.5">
            {touch ? (
              <Button block icon={spinner ?? <CameraIcon />} onClick={() => camera.current?.click()} disabled={busy} aria-busy={busy || undefined}>
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
          <p role="status" className="sr-only">
            {busy ? C.uploading : ''}
          </p>
          <p id={errorId} role="alert" data-testid="receipt-upload-error" className="t-body-strong text-center text-status-danger-fg empty:hidden">
            {error ?? ''}
          </p>
        </div>

        <div className="flex gap-2.5 rounded-card bg-status-info-bg p-3">
          <InformationCircleIcon aria-hidden className="size-6 shrink-0 text-status-info-fg" />
          <div className="min-w-0">
            <p className="t-caption font-semibold text-ink">{C.tipsTitle}</p>
            <ul className="t-caption mt-1 list-disc pl-4 text-ink-2">
              {C.tips.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
          </div>
        </div>

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
      </div>
    </ResponsiveSurface>
  );
}
