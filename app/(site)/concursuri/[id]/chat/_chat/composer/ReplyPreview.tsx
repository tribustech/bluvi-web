"use client";

import { XMarkIcon } from "@heroicons/react/24/outline";
import type { chat } from "@/core/realtime";
import { replySnippet } from "./model";

/*
 * fish ReplyPreview (participant.chat.c25): above the field, the quoted sender and line (text,
 * «Imagine» or «Mesaj») on the accent bar, and «Renunță la răspuns».
 */
export function ReplyPreview({
  message,
  mine,
  onCancel,
}: {
  message: chat.ChatListMessage;
  mine: boolean;
  onCancel: () => void;
}) {
  const snippet = replySnippet(message);
  return (
    <div
      role="group"
      aria-label={`Răspunzi lui ${message.senderName}`}
      className="mx-3 mt-2.5 flex items-center gap-2.5 rounded-control bg-soft-fill py-2 pr-1 pl-2.5"
    >
      <span
        aria-hidden
        className="w-0.75 self-stretch rounded-full bg-accent"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate t-label text-accent-ink">
          {mine ? `${message.senderName} (eu)` : message.senderName}
        </p>
        <p className="truncate t-caption text-ink-2">{snippet}</p>
      </div>
      <CancelButton label="Renunță la răspuns" onClick={onCancel} />
    </div>
  );
}

export function CancelButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted transition-colors duration-(--duration-fast) hover:bg-hairline hover:text-ink active:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-solid focus-visible:outline-accent"
    >
      <XMarkIcon aria-hidden className="size-4.5" />
    </button>
  );
}
