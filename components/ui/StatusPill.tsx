import type { ReactNode } from "react";
import { cn } from "./cn";

/**
 * StatusPill — a STATE (radius 999), never an attribute; attributes are Badge (radius 2).
 * Fundații §07: LIVE · Înscrieri deschise · Ultimele 3 locuri · Viitor · Încheiat · Anulat ·
 * capot · "2 în așteptare". Only the LIVE dot pulses (§06), via `animate-live`.
 */
export type StatusTone =
  | "live"
  | "success"
  | "warning"
  | "info"
  | "neutral"
  | "cancelled"
  | "capot"
  | "pending";

const TONE: Record<StatusTone, string> = {
  live: "bg-status-live-bg text-status-live-fg font-extrabold tracking-[0.4px]",
  success: "bg-status-success-bg text-status-success-fg",
  warning: "bg-status-warning-bg text-status-warning-fg",
  info: "bg-status-info-bg text-status-info-fg",
  neutral: "bg-status-neutral-bg text-status-neutral-fg",
  cancelled: "bg-status-neutral-bg text-status-neutral-fg line-through",
  // A team with no catch: present but empty, hence the dashed outline.
  capot: "border border-dashed border-faint bg-soft-fill text-ink",
  // Orange-50 / orange-700 in light: the design's "awaiting" pair (not a fish status).
  pending: "bg-status-pending-bg text-status-pending-fg",
};

export interface StatusPillProps {
  tone: StatusTone;
  children: ReactNode;
  className?: string;
}

export function StatusPill({ tone, children, className }: StatusPillProps) {
  return (
    <span
      className={cn(
        "t-label inline-flex h-6.5 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5",
        TONE[tone],
        className,
      )}
    >
      {tone === "live" ? (
        <span
          className="size-1.5 animate-live rounded-full bg-current"
          aria-hidden="true"
        />
      ) : null}
      {children}
    </span>
  );
}
