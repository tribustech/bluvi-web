"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSiteToast } from "@/app/(site)/_shell/Toast";
import { measurePhoto, renderCropPlan, workingSize } from "@/components/photo-crop/canvasPipeline";
import { CropOverlay } from "@/components/photo-crop/CropOverlay";
import { PhotoDialog } from "@/components/surfaces/Lightbox";
import type { Size } from "@/core/partide/domain/cropGeometry";
import { computeCropPlan, type CropChange } from "@/core/partide/domain/photoCropPipeline";
import { CROP_COPY, type ChatPhotoEdit } from "./cropResult";

/*
 * participant.chat-photo — fish app/(app)/competitions/[competitionId]/chat/photo.tsx: crop / rotate /
 * flip a pending chat photo before it is sent, with the same overlay + crop pipeline the Partide photo
 * preview uses (components/photo-crop, core/partide/domain/{cropGeometry,photoCropPipeline}).
 *
 * No URL: the picked File lives only in memory, so the crop is a dialog over the chat (fish pushes a
 * route and returns the result through an atom). Phone: full-screen on black. From 768: a large centred
 * modal (≤ 960 × 720), tools on top, actions at the bottom.
 *
 *  - c1  the photo is re-measured here (fish RNImage.getSize, not the picker's size) so the crop rect
 *        maps onto the pixels displayed; until then a neutral skeleton.
 *  - c5  «Anulează» / Escape close unchanged; «Salvează» latches (a second quick click is ignored).
 *        A click on the backdrop around the centred modal does nothing: fish's crop is a full-screen
 *        route with only «Anulează» / «Salvează», and a stray click must not throw the edit away.
 *  - focus: showModal() focuses the skeleton's «Anulează», which the overlay then replaces — so focus
 *        is moved to the crop stage (role application, described by #crop-help) once it appears.
 *  - size: the crop is planned and drawn on canvasPipeline workingSize (≤ 2560 px long edge), never the
 *        full 24–200 MP photo (iOS Safari's canvas cap); the overlay itself only needs the ratio.
 *  - c6  unreadable → the site toast + close; a failed crop → the error in the dialog (the page's toast
 *        host sits under the modal's top layer) and it stays open.
 */

export type CropTarget = { id: string; file: Blob };

const NOTICE_MS = 8000;

export function PhotoCropDialog({
  target,
  onCancel,
  onSave,
}: {
  /** The attachment being cropped (a snapshot: removing it from the tray meanwhile does not close this). */
  target: CropTarget | null;
  onCancel: () => void;
  onSave: (edit: ChatPhotoEdit) => void;
}) {
  // Escape is «Anulează» — except while a crop is applied (a cancelled crop never lands).
  const busyRef = useRef(false);
  const close = useCallback(() => {
    if (!busyRef.current) onCancel();
  }, [onCancel]);
  return (
    <PhotoDialog
      open={target !== null}
      onClose={close}
      labelledBy="crop-title"
      backdrop={false}
      data-testid="chat-photo-crop"
      className="md:m-auto md:h-[min(720px,calc(100dvh-(--spacing(16))))] md:w-[min(960px,calc(100vw-(--spacing(16))))] md:overflow-hidden md:rounded-bento md:shadow-e2"
    >
      {target ? <CropBody key={target.id} target={target} busyRef={busyRef} onCancel={onCancel} onSave={onSave} /> : null}
    </PhotoDialog>
  );
}

function CropBody({
  target,
  busyRef,
  onCancel,
  onSave,
}: {
  target: CropTarget;
  busyRef: React.RefObject<boolean>;
  onCancel: () => void;
  onSave: (edit: ChatPhotoEdit) => void;
}) {
  const toast = useSiteToast();
  const url = useObjectUrl(target.file);
  const [size, setSize] = useState<Size | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; id: number } | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const ready = size !== null && url !== null;

  // The skeleton's «Anulează» held the initial focus and is gone: land on the stage (or, in a preset
  // without a stage to drive, the first tool), so the editor and its help text are announced.
  useEffect(() => {
    if (!ready) return;
    const root = overlayRef.current;
    const target = root?.querySelector<HTMLElement>('[role="application"]') ?? root?.querySelector<HTMLElement>("button");
    target?.focus();
  }, [ready]);

  // c1 / c6: measured from the file itself; unreadable → toast and back to the chat.
  useEffect(() => {
    let cancelled = false;
    measurePhoto(target.file).then(
      (s) => {
        if (!cancelled) setSize(s);
      },
      () => {
        if (cancelled) return;
        toast(CROP_COPY.readError, "danger");
        onCancel();
      },
    );
    return () => {
      cancelled = true;
    };
  }, [target.file, toast, onCancel]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), NOTICE_MS);
    return () => clearTimeout(t);
  }, [notice]);

  // fish savingRef: a fast second «Salvează» would crop again and hand back twice.
  const saving = useRef(false);
  const save = async (change: CropChange) => {
    if (!size || saving.current) return;
    saving.current = true;
    busyRef.current = true;
    setBusy(true);
    setNotice(null);
    try {
      const work = workingSize(size);
      const out = await renderCropPlan(target.file, computeCropPlan(work, change), work);
      busyRef.current = false;
      onSave({ attachmentId: target.id, blob: out.blob, width: out.size.width, height: out.size.height });
    } catch {
      saving.current = false;
      busyRef.current = false;
      setBusy(false);
      setNotice({ text: CROP_COPY.cropError, id: Date.now() });
    }
  };

  return (
    <>
      {notice ? (
        <p
          key={notice.id}
          role="alert"
          data-testid="chat-photo-crop-error"
          className="absolute top-[max(--spacing(16),calc(env(safe-area-inset-top)+(--spacing(16))))] left-1/2 z-overlay w-max max-w-[calc(100%-(--spacing(8)))] -translate-x-1/2 rounded-card bg-status-danger-bg px-4 py-2.5 text-center t-label text-status-danger-fg shadow-e2 md:top-18"
        >
          {notice.text}
        </p>
      ) : null}
      {size && url ? (
        <div ref={overlayRef} className="contents">
          <CropOverlay src={url} imageSize={size} busy={busy} onCancel={onCancel} onSave={save} />
        </div>
      ) : (
        <Measuring onCancel={onCancel} />
      )}
    </>
  );
}

/** c1 «measuring»: the overlay's frame, neutral, until the photo's real size is known (usually a blink). */
function Measuring({ onCancel }: { onCancel: () => void }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="chat-photo-crop-measuring">
      <div className="flex shrink-0 items-center justify-center px-4 pt-[max(--spacing(3),env(safe-area-inset-top))] pb-2 md:px-6 md:pt-4">
        <h2 id="crop-title" className="flex h-11 items-center t-body-strong">
          Decupează
        </h2>
      </div>
      <div role="status" className="relative flex min-h-0 flex-1 items-center justify-center p-5 md:mx-6 md:my-2">
        <span aria-hidden className="aspect-4/3 w-full max-w-160 animate-pulse rounded-card bg-on-photo-scrim/10" />
        <span className="sr-only">Se pregătește poza…</span>
      </div>
      <div className="flex shrink-0 items-center justify-between px-5 pt-3.5 pb-[max(--spacing(3.5),env(safe-area-inset-bottom))] md:border-t md:border-on-photo-scrim/15 md:px-6 md:py-4">
        <button
          type="button"
          onClick={onCancel}
          className="h-11 cursor-pointer rounded-full px-3 t-body text-on-photo-scrim/85 hover:bg-photo-scrim focus-visible:outline-2 focus-visible:outline-on-photo-scrim"
        >
          Anulează
        </button>
        <span aria-hidden className="h-12 w-28 rounded-full bg-on-photo-scrim/10" />
      </div>
    </div>
  );
}

/** An object URL for the file, minted and revoked by this dialog (independent of the tray's preview URL). */
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
