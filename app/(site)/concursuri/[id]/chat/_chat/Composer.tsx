"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { PlusIcon } from "@heroicons/react/24/outline";
import { cn } from "@/components/ui/cn";
import { useChat } from "./ChatController";
import { ActionSlot } from "./composer/ActionSlot";
import { AttachmentTray } from "./composer/AttachmentTray";
import { EditBanner } from "./composer/EditBanner";
import { ReplyPreview } from "./composer/ReplyPreview";
import { useAttachments } from "./composer/useAttachments";
import { useTypingWriter } from "./composer/useTypingWriter";
import {
  MAX_TEXT,
  PHOTO_ACCEPT,
  canSend as canSendOf,
  clampText,
  enterSends,
  maxFieldHeight,
  slotDisabled,
  slotMode,
} from "./composer/model";

/*
 * fish ChatComposer (participant.chat.c25, c26, c28, c29, c30, c32), attached to the bottom edge of
 * the conversation column (ChatFrame; on a phone above the safe area), never floating over the list.
 * Top to bottom: the reply preview or the edit banner, the photo tray, then the row «Adaugă poze» |
 * «Mesaj» (multi-line, ≤ 1000 characters, grows to 5 lines) | the action slot (camera «Fă o poză»
 * when empty, else «Trimite» with a spinner). Enter sends on a desktop keyboard, Shift+Enter is a
 * newline; on a touch screen Enter is a newline (fish's return key) and «Trimite» sends.
 *
 * It talks to the page only through the controller: `send(text)` runs fish useChatSend — the edit
 * (`editing`), or the outbox (the pending bubble at once; a failed prepare puts the photos and the
 * reply back and toasts, c30) — and `replyTo` / `editing` / `attachments` are its state, so a room
 * switch clears them (c6). The closed chat replaces this component with ClosedNotice (ChatFrame).
 */

type Croppable = { openCrop?: (attachmentId: string) => void };

export function Composer({ className }: { className?: string }) {
  const c = useChat();
  const {
    attachments,
    galleryRef,
    cameraRef,
    onPicked,
    openGallery,
    openCamera,
    remove,
    isFull,
    isCoarse,
  } = useAttachments();
  const typing = useTypingWriter();
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const editing = c.editing;
  const isEditing = editing !== null;

  // c26: an edit fills the field with the message's text (derived on the change of message, so the
  // reader's own typing is not overwritten on a re-render).
  const [seenEditId, setSeenEditId] = useState<string | null>(
    editing?.id ?? null,
  );
  if ((editing?.id ?? null) !== seenEditId) {
    setSeenEditId(editing?.id ?? null);
    if (editing) setText(clampText(editing.text ?? ""));
  }

  const focusField = useCallback(() => {
    const el = fieldRef.current;
    if (!el || el.disabled) return;
    el.focus({ preventScroll: true });
    const end = el.value.length;
    el.setSelectionRange(end, end);
  }, []);

  // c25 / c26: choosing «Răspunde» or «Editează» puts the caret in the field.
  const replyId = c.replyTo?.id ?? null;
  useEffect(() => {
    if (replyId || seenEditId) focusField();
  }, [replyId, seenEditId, focusField]);

  // fish: the field grows with its content up to MAX_LINES, then scrolls.
  useLayoutEffect(() => {
    const el = fieldRef.current;
    if (!el) return;
    const cs = window.getComputedStyle(el);
    const line = parseFloat(cs.lineHeight) || 20;
    const pad =
      (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
    const max = maxFieldHeight(line, pad);
    el.style.height = "auto";
    const next = Math.min(el.scrollHeight, max);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > max ? "auto" : "hidden";
  }, [text]);

  const state = {
    canWrite: c.canWrite,
    sending,
    text,
    attachmentCount: attachments.length,
    editing: isEditing,
  };
  const mode = slotMode(state);
  const sendable = canSendOf(state);

  const submit = async () => {
    if (!sendable) return;
    const outgoing = text.trim();
    setText("");
    typing.stopped();
    setSending(true);
    try {
      await c.send(outgoing);
    } finally {
      setSending(false);
    }
    focusField();
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void submit();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      enterSends(
        {
          key: e.key,
          shiftKey: e.shiftKey,
          altKey: e.altKey,
          isComposing: e.nativeEvent.isComposing,
        },
        isCoarse(),
      )
    ) {
      e.preventDefault();
      void submit();
      return;
    }
    if (e.key === "Escape" && (isEditing || c.replyTo)) {
      e.preventDefault();
      if (isEditing) cancelEdit();
      else c.setReplyTo(null);
    }
  };

  const cancelEdit = () => {
    setText("");
    c.setEditing(null);
    focusField();
  };

  const disabled = !c.canWrite;
  // «Decupează poza» exists only once participant.chat-photo puts openCrop on the controller.
  const openCrop = (c as Croppable).openCrop;

  // e2e only (the fake chat exists only outside production, see _live/source.ts): the composer's
  // half of «Răspunde» / «Editează» driven without the list's menu (slice 2 proves its own half).
  const { setReplyTo, setEditing } = c;
  const messages = c.current.room.messages;
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const fake = (
      window as unknown as { __BLUVI_FAKE_CHAT__?: Record<string, unknown> }
    ).__BLUVI_FAKE_CHAT__;
    if (!fake) return;
    const find = (id: string) => messages.find((m) => m.id === id) ?? null;
    fake.composer = {
      reply: (id: string) => setReplyTo(find(id)),
      edit: (id: string) => setEditing(find(id)),
    };
    return () => {
      delete fake.composer;
    };
  }, [messages, setReplyTo, setEditing]);

  return (
    <form
      aria-label="Scrie un mesaj"
      onSubmit={onSubmit}
      className={cn(
        "shrink-0 border-t border-hairline bg-surface pb-[env(safe-area-inset-bottom)]",
        className,
      )}
    >
      {/* The list's reading column (MessageList max-w-180, the full column from xl): border and fill span the card, the contents line up with the bubbles. */}
      <div className="mx-auto w-full max-w-180 xl:max-w-none">
        {c.replyTo && !isEditing ? (
          <ReplyPreview
            message={c.replyTo}
            mine={c.replyTo.senderId === c.viewer.documentId}
            onCancel={() => {
              c.setReplyTo(null);
              focusField();
            }}
          />
        ) : null}
        {isEditing ? <EditBanner onCancel={cancelEdit} /> : null}
        <AttachmentTray
          items={attachments}
          onEdit={openCrop ? (id) => openCrop(id) : undefined}
          onRemove={remove}
        />

        <div className="flex items-end gap-2 px-2.5 py-2 xl:px-3">
          {!isEditing ? (
            <button
              type="button"
              aria-label="Adaugă poze"
              title={isFull ? "Ai atașat 10 poze" : "Adaugă poze"}
              disabled={disabled || isFull}
              onClick={openGallery}
              className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-soft-fill text-accent-ink transition-[background-color,opacity] duration-(--duration-fast) ease-fast hover:bg-accent-tint active:opacity-70 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-soft-fill focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-solid focus-visible:outline-accent"
            >
              <PlusIcon aria-hidden className="size-5.5" strokeWidth={2} />
            </button>
          ) : null}

          <div
            className={cn(
              "flex min-h-11 min-w-0 flex-1 items-end rounded-3xl border border-transparent bg-soft-fill px-4 transition-colors duration-(--duration-fast)",
              "focus-within:border-accent focus-within:bg-surface",
              disabled && "opacity-60",
            )}
          >
            <label htmlFor="chat-mesaj" className="sr-only">
              Mesaj
            </label>
            <textarea
              ref={fieldRef}
              id="chat-mesaj"
              rows={1}
              maxLength={MAX_TEXT}
              value={text}
              disabled={disabled}
              placeholder="Mesaj"
              autoComplete="off"
              onChange={(e) => {
                const next = clampText(e.target.value);
                setText(next);
                typing.typed(next);
              }}
              onBlur={typing.stopped}
              onKeyDown={onKeyDown}
              className="block max-h-34 min-w-0 flex-1 resize-none overflow-hidden bg-transparent py-2.5 [font:600_16px/21px_var(--bluvi-font)] text-ink xl:pointer-fine:t-body outline-none placeholder:text-muted focus-visible:outline-none disabled:cursor-not-allowed"
            />
          </div>

          <ActionSlot
            mode={mode}
            sending={sending}
            disabled={slotDisabled(state)}
            onSend={() => void submit()}
            onCamera={openCamera}
          />
        </div>
      </div>

      {/* The pickers (c29). `capture` asks a phone for its back camera; a desktop ignores it and opens the file picker. */}
      <input
        ref={galleryRef}
        type="file"
        accept={PHOTO_ACCEPT}
        multiple
        hidden
        tabIndex={-1}
        aria-hidden
        onChange={onPicked}
        data-testid="chat-gallery-input"
      />
      <input
        ref={cameraRef}
        type="file"
        accept={PHOTO_ACCEPT}
        capture="environment"
        hidden
        tabIndex={-1}
        aria-hidden
        onChange={onPicked}
        data-testid="chat-camera-input"
      />
    </form>
  );
}
