"use client";

import { XMarkIcon } from "@heroicons/react/24/outline";
import type { ComposerAttachment } from "../../_live/hooks";
import { MAX_ATTACHMENTS } from "./model";

/*
 * fish AttachmentTray (participant.chat.c29): a row of 64 px thumbnails above the field, the dark X
 * is «Elimină poza». A thumbnail is «Decupează poza» (participant.chat-photo: useAttachments
 * openCrop → PhotoCropDialog) when `onEdit` is given; without it (the composer is not writable) it
 * is a plain picture, never a button that does nothing (rule 4). Each name carries its position, so
 * a screen reader can tell ten photos apart. `data-width` / `data-height` are the photo's pixels
 * (a crop replaces them).
 */
const THUMB = "block size-16 overflow-hidden rounded-xl bg-hairline";

export function AttachmentTray({
  items,
  onEdit,
  onRemove,
}: {
  items: ComposerAttachment[];
  onEdit?: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="flex items-end gap-2 pt-2.5 pr-3">
      <ul
        aria-label={`Poze atașate: ${items.length} din ${MAX_ATTACHMENTS}`}
        className="flex min-w-0 gap-2.5 overflow-x-auto overscroll-x-contain px-3 pt-1.5 pb-1 [scrollbar-width:thin]"
      >
        {items.map((a, i) => (
          <li
            key={a.id}
            className="relative size-16 shrink-0"
            data-width={a.width}
            data-height={a.height}
          >
            {onEdit ? (
              <button
                type="button"
                aria-label={`Decupează poza ${i + 1}`}
                onClick={() => onEdit(a.id)}
                className={`${THUMB} cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-accent`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- a local blob: preview, nothing for next/image to optimise */}
                <img
                  src={a.previewUrl}
                  alt=""
                  className="size-full object-cover"
                  draggable={false}
                />
              </button>
            ) : (
              <span className={THUMB}>
                {/* eslint-disable-next-line @next/next/no-img-element -- a local blob: preview, nothing for next/image to optimise */}
                <img
                  src={a.previewUrl}
                  alt={`Poza ${i + 1}`}
                  className="size-full object-cover"
                  draggable={false}
                />
              </span>
            )}
            <button
              type="button"
              aria-label={`Elimină poza ${i + 1}`}
              onClick={() => onRemove(a.id)}
              className="absolute -top-1.5 -right-1.5 flex size-5.5 cursor-pointer items-center justify-center rounded-full border-2 border-surface bg-navy text-lavender before:absolute before:-inset-2.5 before:content-[''] hover:brightness-125 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-solid focus-visible:outline-accent"
            >
              <XMarkIcon aria-hidden className="size-3" strokeWidth={2.5} />
            </button>
          </li>
        ))}
      </ul>
      <p aria-hidden className="shrink-0 pb-1 t-micro text-muted tabular-nums">
        {items.length}/{MAX_ATTACHMENTS}
      </p>
    </div>
  );
}
