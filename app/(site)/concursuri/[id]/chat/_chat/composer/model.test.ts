import { describe, expect, it } from "vitest";
import {
  MAX_ATTACHMENTS,
  MAX_TEXT,
  canSend,
  clampText,
  enterSends,
  isImageFile,
  isPhotoFormat,
  maxFieldHeight,
  remainingSlots,
  replySnippet,
  reportsTyping,
  slotDisabled,
  slotMode,
  takeForSlots,
  type ComposerState,
} from "./model";

/* participant.chat composer (c25, c26, c28, c29, c32) — the pure rules; tests/e2e/concurs-chat-compunere.spec.ts proves them on the page. */

const base: ComposerState = {
  canWrite: true,
  sending: false,
  text: "",
  attachmentCount: 0,
  editing: false,
};

describe("text limit (c28)", () => {
  it("cuts at 1000 characters and keeps shorter text", () => {
    expect(MAX_TEXT).toBe(1000);
    expect(clampText("a".repeat(1200))).toHaveLength(1000);
    expect(clampText("Salut")).toBe("Salut");
  });
  it("the field grows to five lines plus its padding", () => {
    expect(maxFieldHeight(22, 20)).toBe(130);
  });
});

describe("canSend / slot (c28, c26)", () => {
  it("needs text or a photo", () => {
    expect(canSend(base)).toBe(false);
    expect(canSend({ ...base, text: "   " })).toBe(false);
    expect(canSend({ ...base, text: " x " })).toBe(true);
    expect(canSend({ ...base, attachmentCount: 1 })).toBe(true);
  });
  it("never while sending or without the right to write", () => {
    expect(canSend({ ...base, text: "x", sending: true })).toBe(false);
    expect(canSend({ ...base, text: "x", canWrite: false })).toBe(false);
  });
  it("the slot is the camera when empty, «Trimite» with text, a photo or an edit", () => {
    expect(slotMode(base)).toBe("camera");
    expect(slotMode({ ...base, text: " " })).toBe("camera");
    expect(slotMode({ ...base, text: "x" })).toBe("send");
    expect(slotMode({ ...base, attachmentCount: 2 })).toBe("send");
    expect(slotMode({ ...base, editing: true })).toBe("send");
  });
  it("the slot is disabled without a profile, and «Trimite» with nothing to send or while sending", () => {
    expect(slotDisabled({ ...base, canWrite: false })).toBe(true);
    expect(slotDisabled(base)).toBe(false); // the camera
    expect(slotDisabled({ ...base, editing: true })).toBe(true); // an emptied edit
    expect(slotDisabled({ ...base, text: "x" })).toBe(false);
    expect(slotDisabled({ ...base, text: "x", sending: true })).toBe(true);
  });
});

describe("photo slots (c29)", () => {
  it("up to 10 per message", () => {
    expect(MAX_ATTACHMENTS).toBe(10);
    expect(remainingSlots(0)).toBe(10);
    expect(remainingSlots(7)).toBe(3);
    expect(remainingSlots(12)).toBe(0);
  });
  it("a selection is cut to the remaining slots and says how many were left out", () => {
    expect(takeForSlots([1, 2, 3, 4], 8)).toEqual({
      taken: [1, 2],
      dropped: 2,
    });
    expect(takeForSlots([1, 2], 0)).toEqual({ taken: [1, 2], dropped: 0 });
    expect(takeForSlots([1], 10)).toEqual({ taken: [], dropped: 1 });
  });
  it("only images go into the tray", () => {
    expect(isImageFile({ type: "image/jpeg", name: "a.jpg" })).toBe(true);
    expect(isImageFile({ type: "application/pdf", name: "a.pdf" })).toBe(false);
    expect(isImageFile({ type: "", name: "IMG_1.HEIC" })).toBe(true);
    expect(isImageFile({ type: "", name: "notes.txt" })).toBe(false);
  });
  it("isPhotoFormat: only JPEG / PNG / WebP / HEIC(F), never SVG or GIF", () => {
    expect(isPhotoFormat({ type: "image/jpeg", name: "a.jpg" })).toBe(true);
    expect(isPhotoFormat({ type: "image/webp", name: "a.webp" })).toBe(true);
    expect(isPhotoFormat({ type: "image/heic", name: "a.heic" })).toBe(true);
    expect(isPhotoFormat({ type: "image/svg+xml", name: "a.svg" })).toBe(false);
    expect(isPhotoFormat({ type: "image/gif", name: "a.gif" })).toBe(false);
    expect(isPhotoFormat({ type: "", name: "IMG_1.HEIC" })).toBe(true);
    expect(isPhotoFormat({ type: "", name: "logo.svg" })).toBe(false);
  });
});

describe("Enter (c28, web)", () => {
  const enter = { key: "Enter", shiftKey: false };
  it("sends on a desktop keyboard, Shift+Enter is a newline", () => {
    expect(enterSends(enter, false)).toBe(true);
    expect(enterSends({ ...enter, shiftKey: true }, false)).toBe(false);
    expect(enterSends({ ...enter, altKey: true }, false)).toBe(false);
  });
  it("is a newline on a touch screen and never sends mid-composition", () => {
    expect(enterSends(enter, true)).toBe(false);
    expect(enterSends({ ...enter, isComposing: true }, false)).toBe(false);
    expect(enterSends({ key: "a", shiftKey: false }, false)).toBe(false);
  });
});

describe("typing (c32)", () => {
  it("a keystroke reports typing only while the field has text", () => {
    expect(reportsTyping("a")).toBe(true);
    expect(reportsTyping("  ")).toBe(false);
    expect(reportsTyping("")).toBe(false);
  });
});

describe("reply preview (c25)", () => {
  it("the text, else «Imagine» for a photo, else «Mesaj»", () => {
    expect(replySnippet({ text: "Pe ce stand\n ești?" })).toBe(
      "Pe ce stand ești?",
    );
    expect(replySnippet({ text: "", attachments: [{}] })).toBe("Imagine");
    expect(replySnippet({ text: "" })).toBe("Mesaj");
  });
});
