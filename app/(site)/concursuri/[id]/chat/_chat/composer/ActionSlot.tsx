"use client";

import { CameraIcon } from "@heroicons/react/24/outline";
import { PaperAirplaneIcon } from "@heroicons/react/24/solid";
import { cn } from "@/components/ui/cn";

/*
 * fish ActionSlot (participant.chat.c28): one 44 px slot right of the field. Empty field: the camera
 * «Fă o poză». Text, a photo or an edit: the accent circle «Trimite» grows over it (a spinner while
 * the message is being prepared). Both stay mounted so the swap animates; the hidden one is inert.
 */
export function ActionSlot({
  mode,
  sending,
  disabled,
  onSend,
  onCamera,
}: {
  mode: "camera" | "send";
  sending: boolean;
  disabled: boolean;
  onSend: () => void;
  onCamera: () => void;
}) {
  const isSend = mode === "send";
  return (
    <div className="relative size-11 shrink-0">
      <button
        type="button"
        aria-label="Fă o poză"
        title="Fă o poză"
        disabled={disabled}
        inert={isSend}
        onClick={onCamera}
        className={cn(
          "absolute inset-0 flex cursor-pointer items-center justify-center rounded-full text-ink-2 transition-[opacity,scale,translate,background-color] duration-(--duration-fast) ease-fast hover:bg-soft-fill hover:text-ink active:opacity-60 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent motion-reduce:transition-none",
          "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-solid focus-visible:outline-accent",
          isSend && "pointer-events-none translate-x-2.5 scale-60 opacity-0",
        )}
      >
        <CameraIcon aria-hidden className="size-6" />
      </button>
      <button
        type="submit"
        aria-label="Trimite"
        title="Trimite"
        // While sending the button stays focusable (the spinner is announced through aria-busy);
        // a second press is ignored by the composer.
        aria-disabled={disabled || undefined}
        aria-busy={sending || undefined}
        inert={!isSend}
        onClick={(e) => {
          e.preventDefault();
          if (!disabled) onSend();
        }}
        className={cn(
          "absolute inset-0 flex cursor-pointer items-center justify-center rounded-full bg-accent text-on-accent shadow-button transition-[opacity,scale,filter] duration-(--duration-fast) ease-select hover:brightness-95 active:opacity-85 motion-reduce:transition-none",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-accent",
          disabled &&
            !sending &&
            "cursor-not-allowed bg-accent-disabled text-on-accent-disabled shadow-none hover:brightness-100",
          sending && "cursor-progress",
          !isSend && "pointer-events-none scale-30 opacity-0",
        )}
      >
        {sending ? (
          <span
            aria-hidden
            className="size-4.5 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none"
          />
        ) : (
          <PaperAirplaneIcon
            aria-hidden
            className={cn(
              "ml-0.5 size-5 transition-[opacity,scale] delay-60 duration-(--duration-fast) motion-reduce:transition-none",
              isSend ? "scale-100 opacity-100" : "scale-60 opacity-0",
            )}
          />
        )}
      </button>
    </div>
  );
}
