import type { ComposerAttachment } from "../../_live/hooks";

/*
 * participant.chat-photo — what «Salvează» hands back to the composer (fish
 * features/chat/domain/chatPhotoEditResult.ts + useChatAttachments.ts:80-85 `update`). fish carries
 * the result across a route through a jotai atom; the web dialog is in the page, so the result is a
 * plain value given to the tray's owner.
 */

export const CROP_COPY = {
  readError: "Nu am putut citi poza. Încearcă din nou.",
  cropError: "Nu am putut aplica decuparea. Încearcă din nou.",
} as const;

/** The cropped photo for one pending attachment (fish ChatPhotoEditResult: attachmentId, uri, width, height). */
export type ChatPhotoEdit = {
  attachmentId: string;
  blob: Blob;
  width: number;
  height: number;
};

/** The crop is always encoded as JPEG (fish saveAsync JPEG): the file name follows the bytes. */
export function jpegName(name: string): string {
  const base = name.replace(/\.[^./]+$/, "");
  return `${base || "chat-image"}.jpg`;
}

/**
 * fish `update(id, patch)`: swaps the edited file into its pending attachment, keeping its place in
 * the tray and its id. A photo removed from the tray meanwhile (c7) is a no-op: null, and `mintUrl`
 * is never called (no object URL minted for a result nobody shows).
 */
export function applyChatPhotoEdit(
  items: readonly ComposerAttachment[],
  edit: ChatPhotoEdit,
  mintUrl: (blob: Blob) => string,
): { items: ComposerAttachment[]; previous: ComposerAttachment } | null {
  const index = items.findIndex((a) => a.id === edit.attachmentId);
  if (index < 0) return null;
  const previous = items[index];
  const next: ComposerAttachment = {
    ...previous,
    file: edit.blob,
    mime: "image/jpeg",
    name: jpegName(previous.name),
    previewUrl: mintUrl(edit.blob),
    width: edit.width,
    height: edit.height,
  };
  return { items: items.map((a, i) => (i === index ? next : a)), previous };
}
