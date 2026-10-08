"use client";

import { PencilIcon } from "@heroicons/react/24/outline";
import { CancelButton } from "./ReplyPreview";

/* fish EditBanner (participant.chat.c26): «Editezi mesajul» and «Renunță la editare». */
export function EditBanner({ onCancel }: { onCancel: () => void }) {
  return (
    <div
      role="group"
      aria-label="Editezi mesajul"
      className="mx-3 mt-2.5 flex items-center gap-2 rounded-control bg-accent-tint py-1 pr-1 pl-3"
    >
      <PencilIcon aria-hidden className="size-4 shrink-0 text-accent-ink" />
      <p className="min-w-0 flex-1 truncate t-label text-accent-ink">
        Editezi mesajul
      </p>
      <CancelButton label="Renunță la editare" onClick={onCancel} />
    </div>
  );
}
