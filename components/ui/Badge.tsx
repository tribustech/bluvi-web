import type { ReactNode } from "react";
import { cn } from "./cn";

/**
 * Badge — an ATTRIBUTE of a thing (radius 2): Individual, Cantitate/Calitate, Best of 5,
 * Verificată. Same six colors as fish components/Badge.tsx. Indigo is the accent tint + accent
 * ink (indigo-1 / indigo-7 in light, as in Fundații §07; fish uses indigo-5, 4.0:1 on indigo-1),
 * so it swaps under [data-theme=dark]; green and yellow use the badge-* pairs; green keeps fish's green3, which Fundații flags at 2.3:1
 * and keeps for parity.
 */
export type BadgeColor =
  "indigo" | "solidIndigo" | "green" | "gray" | "yellow" | "red";

const COLOR: Record<BadgeColor, string> = {
  indigo: "bg-accent-tint text-accent-ink",
  solidIndigo: "bg-accent text-on-accent",
  green: "bg-badge-green-bg text-badge-green-fg",
  gray: "bg-status-neutral-bg text-status-neutral-fg",
  // fish yellow1 at 31% + yellow6 (theme-aware pair in globals.css).
  yellow: "bg-badge-yellow-bg text-badge-yellow-fg",
  red: "bg-status-danger-bg text-status-danger-fg",
};

export interface BadgeProps {
  color?: BadgeColor;
  icon?: ReactNode;
  iconRight?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Badge({
  color = "indigo",
  icon,
  iconRight,
  children,
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        "t-label inline-flex shrink-0 items-center gap-1 self-start whitespace-nowrap rounded-badge px-1.25 py-0.5 [&_svg]:size-3.5",
        COLOR[color],
        className,
      )}
    >
      {icon}
      {children}
      {iconRight}
    </span>
  );
}
