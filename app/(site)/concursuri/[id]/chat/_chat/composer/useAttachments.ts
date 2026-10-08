"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { useSiteToast } from "@/app/(site)/_shell/Toast";
import type { ComposerAttachment } from "../../_live/hooks";
import { useChat } from "../ChatController";
import { applyChatPhotoEdit, type ChatPhotoEdit } from "./cropResult";
import type { CropTarget } from "./PhotoCropDialog";
import {
  PHOTO_COPY,
  isImageFile,
  isPhotoFormat,
  remainingSlots,
  takeForSlots,
} from "./model";

/*
 * fish useChatAttachments (participant.chat.c29) on the web: the tray lives in the controller
 * (`attachments`, so a failed prepare can restore it, c30); this hook fills it from two hidden file
 * inputs.
 *  - «Adaugă poze»: the picker, several images, cut to the remaining slots (the browser cannot cap
 *    the selection the way fish's selectionLimit does, so the cut is said in a toast).
 *  - «Fă o poză»: on a touch screen the input asks for the back camera (`capture="environment"`);
 *    on a desktop it is the file picker for one photo.
 * Permissions: a file picker needs none; the camera's denial is only knowable where the browser
 * exposes it (Permissions API «camera» = denied) — then fish's toast instead of a picker that would
 * open on nothing. Front-camera un-mirroring does not apply (the browser's capture returns the
 * photo as others see it, with no EXIF hint to act on). Compression happens at send (enqueueMessage,
 * c30). «Decupează poza» (participant.chat-photo): `openCrop(id)` snapshots that attachment for
 * PhotoCropDialog; `saveCrop` swaps the cropped file in (cropResult, fish `update`), a no-op when the
 * photo was removed meanwhile (c7). Fish's picker always yields a JPEG; the web takes JPEG / PNG / WebP / HEIC and probes the
 * decode on the way in, so a photo the browser cannot read (HEIC outside Safari, SVG, a broken file)
 * is refused with a toast instead of being uploaded as an original other viewers cannot show.
 */

let seq = 0;
const nextId = () => `att-${Date.now().toString(36)}-${(seq += 1)}`;

function toAttachment(
  file: File,
  size: { width: number; height: number },
): ComposerAttachment {
  return {
    id: nextId(),
    file,
    name: file.name || `chat-image-${Date.now()}.jpg`,
    mime: file.type || "image/jpeg",
    previewUrl: URL.createObjectURL(file),
    ...size,
  };
}

/** The decoded size, or null when this browser cannot decode the file. */
async function probe(
  file: File,
): Promise<{ width: number; height: number } | null> {
  try {
    const bitmap = await createImageBitmap(file, {
      imageOrientation: "from-image",
    });
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size.width > 0 && size.height > 0 ? size : null;
  } catch {
    return null;
  }
}

const COARSE = "(pointer: coarse)";

export function useCoarsePointer(): () => boolean {
  return useCallback(() => {
    try {
      return window.matchMedia(COARSE).matches;
    } catch {
      return false;
    }
  }, []);
}

export function useAttachments() {
  const c = useChat();
  const toast = useSiteToast();
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const isCoarse = useCoarsePointer();
  const { attachments, setAttachments } = c;
  const latest = useRef(attachments);
  useEffect(() => {
    latest.current = attachments;
  }, [attachments]);

  // The camera permission, read ahead of the click: a file input opened after an await loses the
  // user's gesture in Safari, so the state is cached and kept live.
  const cameraDenied = useRef(false);
  useEffect(() => {
    let status: PermissionStatus | null = null;
    let cancelled = false;
    const onChange = () => {
      cameraDenied.current = status?.state === "denied";
    };
    navigator.permissions
      ?.query({ name: "camera" as PermissionName })
      .then((s) => {
        if (cancelled) return;
        status = s;
        onChange();
        s.addEventListener("change", onChange);
      })
      .catch(() => {
        // Not exposed (Firefox, older Safari): nothing to say ahead of the picker.
      });
    return () => {
      cancelled = true;
      status?.removeEventListener("change", onChange);
    };
  }, []);

  const remaining = remainingSlots(attachments.length);
  const isFull = remaining <= 0;
  const disabled = !c.canWrite;

  const add = useCallback(
    async (files: File[]) => {
      const images = files.filter(isImageFile);
      if (images.length === 0) return;
      const probed = await Promise.all(
        images.map(async (f) => ({
          file: f,
          size: isPhotoFormat(f) ? await probe(f) : null,
        })),
      );
      const readable = probed.filter(
        (p): p is { file: File; size: { width: number; height: number } } =>
          p.size !== null,
      );
      if (readable.length < probed.length)
        toast(PHOTO_COPY.unsupported, "danger");
      if (readable.length === 0) return;
      const { taken, dropped } = takeForSlots(readable, latest.current.length);
      if (dropped > 0) toast(PHOTO_COPY.overLimit, "neutral");
      if (taken.length === 0) return;
      const next = [
        ...latest.current,
        ...taken.map((p) => toAttachment(p.file, p.size)),
      ];
      latest.current = next;
      setAttachments(next);
    },
    [setAttachments, toast],
  );

  const onPicked = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      // The same photo can be picked again after it was removed.
      e.target.value = "";
      void add(files);
    },
    [add],
  );

  const openGallery = useCallback(() => {
    if (disabled || isFull) return;
    galleryRef.current?.click();
  }, [disabled, isFull]);

  const openCamera = useCallback(() => {
    if (disabled || isFull) return;
    if (isCoarse() && cameraDenied.current) {
      toast(PHOTO_COPY.cameraDenied, "danger");
      return;
    }
    cameraRef.current?.click();
  }, [disabled, isFull, isCoarse, toast]);

  const remove = useCallback(
    (id: string) => {
      const gone = latest.current.find((a) => a.id === id);
      const next = latest.current.filter((a) => a.id !== id);
      latest.current = next;
      setAttachments(next);
      if (gone) URL.revokeObjectURL(gone.previewUrl);
    },
    [setAttachments],
  );

  // participant.chat-photo: the photo being cropped — a snapshot, so a removal meanwhile (a room
  // switch, a failed send's restore) does not yank the dialog; its result is then ignored (c7).
  const [cropTarget, setCropTarget] = useState<CropTarget | null>(null);
  const openCrop = useCallback(
    (id: string) => {
      if (disabled) return;
      const a = latest.current.find((x) => x.id === id);
      if (a) setCropTarget({ id: a.id, file: a.file });
    },
    [disabled],
  );
  const closeCrop = useCallback(() => setCropTarget(null), []);
  const saveCrop = useCallback(
    (edit: ChatPhotoEdit) => {
      setCropTarget(null);
      const out = applyChatPhotoEdit(latest.current, edit, (b) =>
        URL.createObjectURL(b),
      );
      if (!out) return;
      latest.current = out.items;
      setAttachments(out.items);
      URL.revokeObjectURL(out.previous.previewUrl);
    },
    [setAttachments],
  );

  // e2e only (the fake chat exists only outside production, see _live/source.ts): a removal while
  // the crop dialog is open (c7) — the tray is under the modal, so no click can reach it.
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const fake = (
      window as unknown as { __BLUVI_FAKE_CHAT__?: Record<string, unknown> }
    ).__BLUVI_FAKE_CHAT__;
    if (!fake) return;
    fake.attachments = { remove, ids: () => latest.current.map((a) => a.id) };
    return () => {
      delete fake.attachments;
    };
  }, [remove]);

  return {
    attachments,
    cropTarget,
    openCrop,
    closeCrop,
    saveCrop,
    galleryRef,
    cameraRef,
    onPicked,
    openGallery,
    openCamera,
    remove,
    isFull,
    remaining,
    isCoarse,
  };
}
