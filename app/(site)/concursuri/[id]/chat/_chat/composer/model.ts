/*
 * The composer's pure rules (participant.chat.c25, c26, c28, c29, c32; fish ChatComposer.tsx,
 * useChatAttachments.ts, ReplyPreview.tsx). The components only wire these to the page.
 */

/** fish ChatComposer MAX_TEXT. */
export const MAX_TEXT = 1000;
/** fish ChatComposer MAX_LINES: the field grows to this many lines, then scrolls. */
export const MAX_LINES = 5;
/** fish useChatAttachments MAX_CHAT_ATTACHMENTS. */
export const MAX_ATTACHMENTS = 10;

export const PHOTO_COPY = {
  galleryDenied: "Nu ai acordat permisiuni pentru galerie.",
  cameraDenied: "Nu ai acordat permisiuni pentru cameră.",
  /** Web only: the browser's picker cannot cap the selection (fish passes selectionLimit). */
  overLimit: `Poți trimite cel mult ${MAX_ATTACHMENTS} poze într-un mesaj.`,
  /** Web only: a picked image the browser cannot decode (HEIC outside Safari, SVG, GIF, …). */
  unsupported: "Formatul pozei nu este suportat.",
} as const;

/**
 * The formats a chat photo may have (fish's picker always yields a JPEG). HEIC/HEIF only enter the
 * tray where the browser decodes them (Safari), so compression turns them into a JPEG.
 */
export const PHOTO_ACCEPT =
  "image/jpeg,image/png,image/webp,image/heic,image/heif";
const PHOTO_MIMES = new Set(PHOTO_ACCEPT.split(","));

/** fish onChangeText: the value is cut at MAX_TEXT. */
export function clampText(value: string): string {
  return value.length > MAX_TEXT ? value.slice(0, MAX_TEXT) : value;
}

export type ComposerState = {
  /** The composer may write at all (signed in with a profile, room readable, chat open). */
  canWrite: boolean;
  sending: boolean;
  text: string;
  attachmentCount: number;
  editing: boolean;
};

/** fish canSend: not disabled, not already sending, and some text or a photo. */
export function canSend(s: ComposerState): boolean {
  return (
    s.canWrite &&
    !s.sending &&
    (s.text.trim().length > 0 || s.attachmentCount > 0)
  );
}

/** fish slotMode: the right slot is «Trimite» while editing or with text / a photo, else the camera. */
export function slotMode(
  s: Pick<ComposerState, "text" | "attachmentCount" | "editing">,
): "send" | "camera" {
  return s.editing || s.text.trim().length > 0 || s.attachmentCount > 0
    ? "send"
    : "camera";
}

/** fish ActionSlot `disabled`: no writing at all, or «Trimite» with nothing to send / already sending. */
export function slotDisabled(s: ComposerState): boolean {
  if (!s.canWrite) return true;
  return slotMode(s) === "send" && !canSend(s);
}

export function remainingSlots(attachmentCount: number): number {
  return Math.max(0, MAX_ATTACHMENTS - attachmentCount);
}

/**
 * fish selectionLimit + `.slice(0, remaining)`: the picked files that fit, and whether some were
 * left out (the web picker cannot cap the selection, so the composer says so).
 */
export function takeForSlots<T>(
  picked: readonly T[],
  attachmentCount: number,
): { taken: T[]; dropped: number } {
  const room = remainingSlots(attachmentCount);
  const taken = picked.slice(0, room);
  return { taken, dropped: picked.length - taken.length };
}

/** Only images go into the tray (the picker's `accept` is a hint a drop or «Toate fișierele» can bypass). */
export function isImageFile(file: { type: string; name: string }): boolean {
  if (file.type) return file.type.startsWith("image/");
  return /\.(jpe?g|png|webp|gif|heic|heif|avif|svg)$/i.test(file.name);
}

/**
 * An image in a format a chat photo may have (PHOTO_ACCEPT). The tray still probes the decode
 * (createImageBitmap): a HEIC passes this check everywhere but only decodes in Safari.
 */
export function isPhotoFormat(file: { type: string; name: string }): boolean {
  if (file.type) return PHOTO_MIMES.has(file.type.toLowerCase());
  return /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name);
}

/**
 * Enter sends on a desktop keyboard (Shift+Enter is a newline); on a touch screen Enter is always a
 * newline (fish: the return key of a multi-line field); never while an IME composes.
 */
export function enterSends(
  e: {
    key: string;
    shiftKey: boolean;
    altKey?: boolean;
    ctrlKey?: boolean;
    metaKey?: boolean;
    isComposing?: boolean;
  },
  coarsePointer: boolean,
): boolean {
  if (e.key !== "Enter" || e.isComposing) return false;
  if (coarsePointer) return false;
  return !e.shiftKey && !e.altKey;
}

/**
 * fish onChangeText (2026-09-15): only «typing» is reported from a keystroke, and only while the
 * field has text; stopping is the writer's idle timeout, a send, a blur or leaving.
 */
export function reportsTyping(next: string): boolean {
  return next.trim().length > 0;
}

/** fish ReplyPreview: the quoted line — the text, else «Imagine» for a photo, else «Mesaj». */
export function replySnippet(m: {
  text?: string | null;
  attachments?: readonly unknown[] | null;
  deletedAt?: unknown;
}): string {
  const text = (m.text ?? "").replace(/\s+/g, " ").trim();
  if (text) return text;
  return m.attachments && m.attachments.length > 0 ? "Imagine" : "Mesaj";
}

/** The field's max height: MAX_LINES lines plus its vertical padding (px). */
export function maxFieldHeight(
  lineHeightPx: number,
  paddingYPx: number,
): number {
  return lineHeightPx * MAX_LINES + paddingYPx;
}
