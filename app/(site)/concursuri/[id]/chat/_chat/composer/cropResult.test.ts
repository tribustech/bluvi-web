import { describe, expect, it, vi } from "vitest";
import type { ComposerAttachment } from "../../_live/hooks";
import { applyChatPhotoEdit, jpegName } from "./cropResult";

const att = (id: string, over: Partial<ComposerAttachment> = {}): ComposerAttachment => ({
  id,
  file: new Blob(["x"], { type: "image/png" }),
  name: `${id}.png`,
  mime: "image/png",
  previewUrl: `blob:${id}`,
  width: 320,
  height: 240,
  ...over,
});

describe("applyChatPhotoEdit (participant.chat-photo c5, c7)", () => {
  const blob = new Blob(["cropped"], { type: "image/jpeg" });

  it("c5: replaces that attachment's file, preview, width and height in place, keeping its id and position", () => {
    const items = [att("a"), att("b"), att("c")];
    const mint = vi.fn(() => "blob:new");
    const out = applyChatPhotoEdit(items, { attachmentId: "b", blob, width: 240, height: 240 }, mint);
    expect(out).not.toBeNull();
    expect(out!.previous).toBe(items[1]);
    expect(out!.items.map((a) => a.id)).toEqual(["a", "b", "c"]);
    expect(out!.items[1]).toEqual({
      id: "b",
      file: blob,
      name: "b.jpg",
      mime: "image/jpeg",
      previewUrl: "blob:new",
      width: 240,
      height: 240,
    });
    expect(out!.items[0]).toBe(items[0]);
    expect(out!.items[2]).toBe(items[2]);
    expect(mint).toHaveBeenCalledWith(blob);
    // The input is not mutated.
    expect(items[1].previewUrl).toBe("blob:b");
  });

  it("c7: a photo removed from the tray meanwhile ignores the result and mints no URL", () => {
    const items = [att("a")];
    const mint = vi.fn(() => "blob:new");
    expect(applyChatPhotoEdit(items, { attachmentId: "gone", blob, width: 1, height: 1 }, mint)).toBeNull();
    expect(applyChatPhotoEdit([], { attachmentId: "a", blob, width: 1, height: 1 }, mint)).toBeNull();
    expect(mint).not.toHaveBeenCalled();
  });
});

describe("jpegName", () => {
  it("swaps the extension for .jpg (the crop is JPEG)", () => {
    expect(jpegName("poza.png")).toBe("poza.jpg");
    expect(jpegName("IMG.1234.HEIC")).toBe("IMG.1234.jpg");
    expect(jpegName("fara-extensie")).toBe("fara-extensie.jpg");
    expect(jpegName(".png")).toBe("chat-image.jpg");
  });
});
