import { cn } from "./cn";
import { getInitials, hashString } from "./initials";

/**
 * Avatar + FaceStack — Fundații §07. Photo when there is one, otherwise initials
 * (fish anglerInitials.ts) on a pastel tone from the status pairs. Round by default;
 * square (radius 12) for teams and lakes.
 */
export type AvatarTone = "indigo" | "tint" | "success" | "warning" | "neutral";
export type AvatarSize = 24 | 32 | 40 | 44 | 48 | 64;

const TONES: AvatarTone[] = ["indigo", "tint", "success", "warning", "neutral"];

const TONE: Record<AvatarTone, string> = {
  indigo: "bg-accent-tint text-accent-ink",
  tint: "bg-accent-tint-2 text-accent-ink",
  success: "bg-status-success-bg text-status-success-fg",
  warning: "bg-status-warning-bg text-status-warning-fg",
  neutral: "bg-status-neutral-bg text-status-neutral-fg",
};

// Initials at ~1/3 of the side (32 → 11, 48 → 16), weight 800.
const SIZE: Record<AvatarSize, string> = {
  24: "size-6 text-[9px]",
  32: "size-8 text-[11px]",
  40: "size-10 text-[14px]",
  44: "size-11 text-[15px]",
  48: "size-12 text-[16px]",
  64: "size-16 text-[22px]",
};

export function toneForName(name: string): AvatarTone {
  return TONES[hashString(name) % TONES.length];
}

export interface AvatarProps {
  name: string;
  src?: string | null;
  size?: AvatarSize;
  shape?: "round" | "square";
  /** Override the name-derived tone. */
  tone?: AvatarTone;
  /**
   * 2px border in the surface color, for overlapping stacks. It is drawn INSIDE the side
   * (border-box), so a 24px face stays 24px and the initials keep a 20px box.
   */
  ring?: boolean;
  /** Decorative when the name is already printed next to it (the default). */
  decorative?: boolean;
  className?: string;
}

export function Avatar({
  name,
  src,
  size = 48,
  shape = "round",
  tone,
  ring,
  decorative = true,
  className,
}: AvatarProps) {
  const base = cn(
    "relative inline-flex shrink-0 items-center justify-center overflow-hidden font-extrabold leading-none select-none",
    SIZE[size],
    shape === "round" ? "rounded-full" : "rounded-avatar",
    ring && "box-border border-2 border-surface",
    className,
  );
  const a11y = decorative
    ? { "aria-hidden": true as const }
    : { role: "img" as const, "aria-label": name };

  if (src) {
    return (
      <span className={cn(base, "bg-soft-fill")} {...a11y}>
        {/* Remote CMS photos at avatar size: the image optimizer buys nothing here. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          className="size-full object-cover"
          loading="lazy"
          decoding="async"
        />
      </span>
    );
  }
  return (
    <span className={cn(base, TONE[tone ?? toneForName(name)])} {...a11y}>
      {getInitials(name)}
    </span>
  );
}

export interface FacePerson {
  name: string;
  src?: string | null;
  tone?: AvatarTone;
}

export interface FaceStackProps {
  people: FacePerson[];
  /** How many more are not shown: renders the "+N" pill. */
  overflow?: number;
  size?: 24 | 32 | 40;
  /**
   * One label for the whole row ("38 participanți"); the faces themselves are decorative.
   * Omit it when the caller already prints the same text next to the stack: the row is hidden.
   */
  label?: string;
  className?: string;
}

const OVERLAP: Record<NonNullable<FaceStackProps["size"]>, string> = {
  24: "*:not-first:-ml-1.5",
  32: "*:not-first:-ml-2",
  40: "*:not-first:-ml-2.5",
};

const OVERFLOW_SIZE: Record<NonNullable<FaceStackProps["size"]>, string> = {
  24: "h-6 px-2 text-[10px]",
  32: "h-8 px-2.5 text-[12px]",
  40: "h-10 px-3 text-[14px]",
};

export function FaceStack({
  people,
  overflow = 0,
  size = 32,
  label,
  className,
}: FaceStackProps) {
  if (!people.length && overflow <= 0) return null;
  return (
    // Overlap is a quarter of the side (−6px at 24, −8px at 32), as in the design.
    <div
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
      className={cn("flex items-center", OVERLAP[size], className)}
    >
      {people.map((p, i) => (
        <Avatar
          key={`${p.name}-${i}`}
          name={p.name}
          src={p.src}
          tone={p.tone}
          size={size}
          ring
        />
      ))}
      {overflow > 0 ? (
        <span
          aria-hidden="true"
          className={cn(
            "box-border inline-flex shrink-0 items-center rounded-full border-2 border-surface bg-soft-fill font-extrabold text-ink-2 tabular-nums",
            OVERFLOW_SIZE[size],
          )}
        >
          +{overflow}
        </span>
      ) : null}
    </div>
  );
}
