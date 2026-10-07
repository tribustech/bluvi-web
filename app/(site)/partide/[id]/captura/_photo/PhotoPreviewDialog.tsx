'use client';

import { ChevronLeftIcon, PhotoIcon } from '@heroicons/react/24/outline';
import { useCallback, useEffect, useRef, useState } from 'react';
import { PhotoDialog } from '@/components/surfaces/Lightbox';
import { cn } from '@/components/ui/cn';
import type { Size } from '@/core/partide/domain/cropGeometry';
import { computeCropPlan, type CropChange } from '@/core/partide/domain/photoCropPipeline';
import type { SessionMember } from '@/core/partide/domain/types';
import { measurePhoto, renderCropPlan } from './canvasPipeline';
import { CropOverlay } from './CropOverlay';
import { CropIcon } from './icons';
import { PhotoTagPicker } from './PhotoTagPicker';

/*
 * fish app/(app)/partide/photo-preview.tsx — the step between picking a catch photo and saving the
 * captură (partide.captura-poza): the photo full-bleed, an optional non-destructive crop and, in a
 * co-op partidă, who is IN the photo. «Gata» hands `{ blob, tags, changed }` back to the capture form
 * (fish's photoPreviewResultAtom — a callback here, since a dialog can return a value); «Renunță»
 * (or Escape) discards the step and leaves the form's photo as it was.
 *
 * IMPORTANT: catches are always team-owned (every catch counts in every member's stats regardless
 * of tagging). `tags` decides ONLY whose photo gallery shows it — never conflate the two.
 *
 * Crop contract (core/partide/domain/photoCropPipeline): rotate/flip BEFORE crop, the crop rect on
 * the ROTATED size. The working image is replaced by each saved crop (a fresh pass from THIS image,
 * never compounded) and re-measured, so a second crop is measured against the CURRENT image.
 *
 * Layout: phone — the photo fills the screen, the chrome sits on scrims over it (fish). From 768 the
 * photo is centred at its largest in a stage and every control lives in one bottom bar (no floating
 * chrome over the picture).
 */

export type PhotoPreviewResult = {
  /** The working image: the source itself when nothing was cropped, else the last saved crop. */
  blob: Blob;
  /** null = «Toți» (everyone); never an empty array. */
  tags: string[] | null;
  /**
   * Whether a crop replaced the source. fish hands back the unchanged `workingUri` and the capture
   * form only sends `photo` when the uri moved — so a re-opened, uncropped photo is never re-uploaded.
   */
  changed: boolean;
};

const READ_ERROR = 'Nu am putut citi poza. Încearcă din nou.';
const NOT_READY = 'Poza nu este încă pregătită. Încearcă din nou.';
const CROP_ERROR = 'Nu am putut aplica decuparea. Încearcă din nou.';
const NOTICE_MS = 5000;

export function PhotoPreviewDialog({
  open,
  source,
  members,
  initialTags = null,
  onDone,
  onCancel,
}: {
  open: boolean;
  source: Blob | null;
  members: SessionMember[];
  /** Restored when re-opening an existing photo (fish `initialTagUids`). */
  initialTags?: string[] | null;
  onDone: (result: PhotoPreviewResult) => void;
  onCancel: () => void;
}) {
  // Escape is «Renunță» — or, with the crop open, «Anulează» (back to the preview).
  const escape = useRef<() => void>(onCancel);
  return (
    <PhotoDialog open={open && source != null} onClose={() => escape.current()} labelledBy="photo-preview-title" data-testid="photo-preview">
      {open && source ? (
        <PreviewBody key={blobKey(source)} source={source} members={members} initialTags={initialTags} onDone={onDone} onCancel={onCancel} escapeRef={escape} />
      ) : null}
    </PhotoDialog>
  );
}

// A fresh body (working image, tags, crop state) for every picked photo.
const keys = new WeakMap<Blob, number>();
let nextKey = 0;
function blobKey(b: Blob): number {
  let k = keys.get(b);
  if (k === undefined) keys.set(b, (k = ++nextKey));
  return k;
}

function PreviewBody({
  source,
  members,
  initialTags,
  onDone,
  onCancel,
  escapeRef,
}: {
  source: Blob;
  members: SessionMember[];
  initialTags: string[] | null;
  onDone: (result: PhotoPreviewResult) => void;
  onCancel: () => void;
  escapeRef: React.RefObject<() => void>;
}) {
  // The working image: the picked photo, replaced by each saved crop. Cancelling a crop never touches it.
  const [working, setWorking] = useState<Blob>(source);
  const url = useObjectUrl(working);
  const [size, setSize] = useState<Size | null>(null);
  const [readFailed, setReadFailed] = useState(false);
  const [tags, setTags] = useState<string[] | null>(() => (initialTags && initialTags.length ? initialTags : null));
  const [cropOpen, setCropOpen] = useState(false);
  const [cropping, setCropping] = useState(false);
  const [notice, setNotice] = useState<{ text: string; id: number } | null>(null);

  // Re-measure whenever the working image changes, so the cropper always sees the dimensions of what
  // is displayed now — never a stale pre-crop size.
  useEffect(() => {
    let cancelled = false;
    measurePhoto(working).then(
      s => {
        if (!cancelled) {
          setSize(s);
          setReadFailed(false);
        }
      },
      () => {
        if (!cancelled) {
          setSize(null);
          setReadFailed(true);
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [working]);

  const say = useCallback((text: string) => setNotice({ text, id: Date.now() }), []);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), NOTICE_MS);
    return () => clearTimeout(t);
  }, [notice]);

  // A crop closed while it was being applied must never land (belt to «Anulează» being disabled).
  const cropRun = useRef(0);
  const closeCrop = () => {
    cropRun.current += 1;
    setCropOpen(false);
  };
  const saveCrop = async (change: CropChange) => {
    if (!size || change.boxSize.width === 0 || change.boxSize.height === 0) {
      say(NOT_READY);
      return;
    }
    const run = ++cropRun.current;
    setCropping(true);
    try {
      const out = await renderCropPlan(working, computeCropPlan(size, change));
      if (run !== cropRun.current) return;
      setWorking(out.blob);
      setSize(out.size);
      setCropOpen(false);
    } catch {
      if (run === cropRun.current) say(CROP_ERROR);
    } finally {
      setCropping(false);
    }
  };

  // Latch against a fast double activation of «Gata» (fish F5): the result is handed over once.
  const done = useRef(false);
  const finish = () => {
    if (done.current || cropping || readFailed) return;
    done.current = true;
    onDone({ blob: working, tags, changed: working !== source });
  };

  useEffect(() => {
    escapeRef.current = cropOpen ? () => !cropping && closeCrop() : onCancel;
  }, [escapeRef, cropOpen, cropping, onCancel]);

  const cropDisabled = !size || cropping;

  return (
    <>
      {/* The dialog's first focus: its name, not «Renunță» (no ring on a button nobody aimed at). */}
      <h2 id="photo-preview-title" className="sr-only" tabIndex={-1} autoFocus>
        Previzualizare poză
      </h2>

      {notice ? (
        <p
          key={notice.id}
          role="alert"
          className="absolute top-[max(--spacing(16),calc(env(safe-area-inset-top)+(--spacing(16))))] left-1/2 z-overlay w-max max-w-[calc(100%-(--spacing(8)))] -translate-x-1/2 rounded-full bg-status-danger-bg px-4 py-2.5 text-center t-label text-status-danger-fg shadow-e2 md:top-6"
          data-testid="photo-preview-notice"
        >
          {notice.text}
        </p>
      ) : null}

      {cropOpen && size && url ? (
        <CropOverlay src={url} imageSize={size} busy={cropping} onCancel={closeCrop} onSave={saveCrop} />
      ) : (
        <div className="relative flex min-h-0 flex-1 flex-col" data-testid="photo-preview-main">
          {/* Stage: full-bleed on the phone, the photo at its largest and centred from 768. */}
          <div className="absolute inset-0 md:relative md:inset-auto md:min-h-0 md:flex-1 md:p-6">
            {readFailed ? (
              <div role="alert" className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center text-lavender-3" data-testid="photo-preview-read-error">
                <PhotoIcon aria-hidden className="size-12" />
                <p className="t-body">{READ_ERROR}</p>
              </div>
            ) : (
              url && (
              // eslint-disable-next-line @next/next/no-img-element -- a local object URL, never optimisable
              <img
                src={url}
                alt="Poza capturii"
                data-testid="photo-preview-image"
                data-width={size?.width}
                data-height={size?.height}
                className={cn('size-full object-contain transition-opacity duration-150', size ? 'opacity-100' : 'opacity-0')}
              />
              )
            )}
          </div>

          {/* Phone scrims: the only thing keeping light-on-photo chrome legible over a bright photo. */}
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[calc(env(safe-area-inset-top)+(--spacing(20)))] bg-linear-to-b from-photo-scrim to-transparent md:hidden" />
          <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[calc(env(safe-area-inset-bottom)+(--spacing(72)))] bg-linear-to-t from-ink via-photo-scrim to-transparent md:hidden" />

          {/* Phone top row: round icon buttons over the photo. */}
          <div className="absolute inset-x-3.5 top-[max(--spacing(2),env(safe-area-inset-top))] flex items-center justify-between md:hidden">
            <GlassButton label="Renunță" onClick={onCancel} testId="photo-preview-cancel">
              <ChevronLeftIcon aria-hidden className="size-5 stroke-[2.4]" />
            </GlassButton>
            <GlassButton label="Decupează" onClick={() => setCropOpen(true)} disabled={cropDisabled} testId="photo-preview-crop">
              <CropIcon className="size-4.5" />
            </GlassButton>
          </div>

          {/* Bottom: tag picker + «Gata» (phone, over the photo) / one bar (from 768). */}
          <div className="absolute inset-x-0 bottom-0 flex flex-col gap-3.5 px-4 pb-[max(--spacing(3.5),env(safe-area-inset-bottom))] md:relative md:flex-row md:items-center md:gap-6 md:border-t md:border-on-photo-scrim/15 md:px-6 md:py-4">
            <button
              type="button"
              onClick={onCancel}
              className="hidden h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-full pr-4 pl-2.5 t-body-strong hover:bg-photo-scrim focus-visible:outline-2 focus-visible:outline-on-photo-scrim md:flex"
            >
              <ChevronLeftIcon aria-hidden className="size-5 stroke-2" />
              Renunță
            </button>
            <PhotoTagPicker members={members} value={tags} onChange={setTags} className="md:flex-1" />
            <div className="flex shrink-0 items-center justify-end gap-2 md:ml-auto">
              <button
                type="button"
                onClick={() => setCropOpen(true)}
                disabled={cropDisabled}
                className="hidden h-11 cursor-pointer items-center gap-2 rounded-full border-[1.5px] border-on-photo-scrim/35 px-4 t-body-strong hover:bg-photo-scrim focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-photo-scrim disabled:cursor-default disabled:opacity-40 md:flex"
              >
                <CropIcon className="size-4.5" />
                Decupează
              </button>
              <button
                type="button"
                onClick={finish}
                disabled={cropping || readFailed}
                data-testid="photo-preview-done"
                className="h-12 cursor-pointer rounded-full bg-photo-chip px-6.5 t-body-strong text-ink transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-photo-scrim disabled:cursor-default disabled:opacity-35"
              >
                Gata
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** An object URL for the blob, revoked when the blob changes or the body unmounts. */
function useObjectUrl(blob: Blob): string | null {
  const [entry, setEntry] = useState<{ blob: Blob; url: string } | null>(null);
  useEffect(() => {
    const url = URL.createObjectURL(blob);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the URL is an external resource: minted and revoked by the same effect (StrictMode-safe)
    setEntry({ blob, url });
    return () => URL.revokeObjectURL(url);
  }, [blob]);
  return entry?.blob === blob ? entry.url : null;
}

function GlassButton({ label, onClick, disabled, testId, children }: { label: string; onClick: () => void; disabled?: boolean; testId: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      className="flex size-11 cursor-pointer items-center justify-center rounded-full border border-on-photo-scrim/25 bg-photo-scrim focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-photo-scrim disabled:cursor-default disabled:opacity-40"
    >
      {children}
    </button>
  );
}
