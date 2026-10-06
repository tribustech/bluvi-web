import type { ReactNode } from "react";
import { cn } from "./cn";
import { SignatureNumber, type SignatureTone, type UnitTone } from "./SignatureNumber";

/**
 * Bento tiles — Fundații §07. Radius 20, padding 18, label on top, number in the middle,
 * caption or progress at the bottom (space-between, min height 156).
 *  - CountTile: navy, lavender signature number. One per view, the thing that is happening now.
 *  - StatTile: on page (or surface when the tile sits on the page ground), ink number.
 *
 * Apple-style surfaces (owner rule 19, ROADMAP §4b): a bento is never a grid of identical white
 * cards — each tile can take its own surface:
 *  - `signature`: the navy tile with a subtle navy → navy-2 gradient (the one headline number);
 *  - `indigo`: indigo gradient, white number (a second headline);
 *  - `lavender`: the light indigo tint;
 *  - `mint` · `amber` · `rose`: the soft status tints, fading into the surface;
 *  - `sky` (cyan) · `violet` (orchid): their own bento tints, clearly apart from lavender (the
 *    badge blue / violet tints read as the same periwinkle beside it);
 *  - `peach` (orange) · `lime` (yellow-green): two more, so a page of up to nine tinted surfaces
 *    (the Statistici strip, facts and chart cards) never repeats one.
 *    Each tint fades into the surface. Labels, units and captions take the tint's own AA foreground (never muted grey,
 *    which is under 4.5:1 on most tints).
 * `art` is a large decorative icon in the bottom-right corner (aria-hidden, under the text).
 */
export type BentoTone =
  | "navy"
  | "page"
  | "surface"
  | "signature"
  | "indigo"
  | "lavender"
  | "mint"
  | "sky"
  | "amber"
  | "rose"
  | "violet"
  | "peach"
  | "lime";

/** A tint fades into the surface towards the bottom-right corner (lighter = more contrast). */
const TINT = "bg-linear-160 from-40% to-surface to-160%";

const TONE: Record<BentoTone, string> = {
  navy: "bg-navy",
  page: "bg-page",
  surface: "bg-surface",
  signature: "bg-linear-160 from-navy from-30% to-bento-navy-2",
  indigo: "bg-linear-160 from-bento-indigo to-bento-indigo-2",
  lavender: "bg-linear-160 from-bento-lavender from-40% to-bento-lavender-2",
  mint: cn(TINT, "from-status-success-bg"),
  sky: cn(TINT, "from-bento-sky"),
  amber: cn(TINT, "from-status-warning-bg"),
  rose: cn(TINT, "from-status-danger-bg"),
  violet: cn(TINT, "from-bento-violet"),
  peach: cn(TINT, "from-bento-peach"),
  lime: cn(TINT, "from-bento-lime"),
};

/** The text tones of a surface: label / caption colour, the number, its unit. */
export interface BentoInk {
  /** Label, caption and link colour on this surface (AA). */
  fg: string;
  number: SignatureTone;
  unit: UnitTone;
  /** InlineNumber on this surface: the figure, and its unit. */
  inlineValue: string;
  inlineUnit: string;
}

const LIGHT = (fg: string): BentoInk => ({
  fg,
  number: "ink",
  unit: "current",
  inlineValue: "t-label text-ink",
  inlineUnit: "",
});

export const BENTO_INK: Record<BentoTone, BentoInk> = {
  navy: { fg: "text-lavender-2", number: "lavender", unit: "lavender", inlineValue: "t-label text-lavender", inlineUnit: "text-lavender-2" },
  signature: { fg: "text-lavender-2", number: "lavender", unit: "lavender", inlineValue: "t-label text-lavender", inlineUnit: "text-lavender-2" },
  indigo: {
    fg: "text-on-bento-indigo-2",
    number: "onIndigo",
    unit: "onIndigo",
    inlineValue: "t-label text-on-bento-indigo",
    inlineUnit: "text-on-bento-indigo-2",
  },
  page: { fg: "text-muted", number: "ink", unit: "muted", inlineValue: "t-label text-ink-2", inlineUnit: "text-muted" },
  surface: { fg: "text-muted", number: "ink", unit: "muted", inlineValue: "t-label text-ink-2", inlineUnit: "text-muted" },
  lavender: LIGHT("text-on-bento-lavender"),
  mint: LIGHT("text-status-success-fg"),
  sky: LIGHT("text-on-bento-sky"),
  amber: LIGHT("text-status-warning-fg"),
  rose: LIGHT("text-status-danger-fg"),
  violet: LIGHT("text-on-bento-violet"),
  peach: LIGHT("text-on-bento-peach"),
  lime: LIGHT("text-on-bento-lime"),
};

/** The plain kit surfaces (white / grey cards) keep the small icon disc; the others get corner art. */
const isPlain = (tone: BentoTone) => tone === "page" || tone === "surface";

/** The surface classes of a tone, for a tile that draws its own anatomy (a subgrid KPI tile). */
export const bentoSurface = (tone: BentoTone) => cn("relative isolate overflow-hidden", TONE[tone], BENTO_INK[tone].fg);

/**
 * The large corner icon of a coloured tile: decorative, in the tile's text colour at low opacity,
 * bleeding off the bottom-right corner, under the text (`isolate` on the tile, z-behind here).
 * It shows 80 × 76px of the corner; the caption line beside it keeps clear of it with
 * BENTO_ART_CLEAR, so no text ever runs over the icon.
 */
export function BentoArt({ children }: { children: ReactNode }) {
  return (
    // The bleed is clipped by its own tile-sized box, so it never counts as the tile's overflow.
    <span aria-hidden="true" className="pointer-events-none absolute inset-0 z-behind overflow-hidden rounded-[inherit]">
      <span className="absolute -right-4 -bottom-5 size-24 opacity-15 [&>svg]:size-full">{children}</span>
    </span>
  );
}

/**
 * The end padding of a tile's bottom (caption) line when the tile has BentoArt: the art shows 80px
 * of the corner, 62px of it inside the 18px padding, so 64px keeps the text off the icon (it wraps
 * or truncates before it).
 */
export const BENTO_ART_CLEAR = "pe-16";

export interface BentoTileProps {
  tone?: BentoTone;
  /** A large decorative icon in the corner (coloured surfaces). */
  art?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function BentoTile({
  tone = "page",
  art,
  className,
  children,
}: BentoTileProps) {
  return (
    <div
      className={cn(
        "relative isolate flex min-h-39 flex-col justify-between gap-2 overflow-hidden rounded-bento p-4.5",
        TONE[tone],
        !isPlain(tone) && BENTO_INK[tone].fg,
        className,
      )}
    >
      {art ? <BentoArt>{art}</BentoArt> : null}
      {children}
    </div>
  );
}

export interface CountTileProps {
  /** Short uppercase label: "LIVE ACUM". */
  label: string;
  value: ReactNode;
  unit?: ReactNode;
  /** "concursuri · 1.284 urmăresc", or a row (sector chip + name). */
  caption?: ReactNode;
  className?: string;
}

export function CountTile({
  label,
  value,
  unit,
  caption,
  className,
}: CountTileProps) {
  return (
    <BentoTile tone="navy" className={className}>
      <div className="t-label tracking-[0.4px] text-lavender-2 uppercase">
        {label}
      </div>
      <SignatureNumber
        size="tile"
        tone="lavender"
        value={value}
        unit={unit}
        unitTone="lavender"
      />
      {caption ? (
        <div className="t-caption text-lavender-3">{caption}</div>
      ) : null}
    </BentoTile>
  );
}

export interface StatTileProps {
  label: string;
  /** Optional icon before the label (Heroicon outline or brand icon, 16px). */
  icon?: ReactNode;
  value: ReactNode;
  unit?: ReactNode;
  unitTone?: Exclude<UnitTone, "lavender">;
  /** Filled bar under the number, e.g. registrations 38 of 48. */
  progress?: { value: number; max: number; label: string };
  caption?: ReactNode;
  /** Extra classes on the caption line (e.g. a caption shown only at one width). */
  captionClassName?: string;
  tone?: Exclude<BentoTone, "navy" | "signature">;
  className?: string;
}

export function StatTile({
  label,
  icon,
  value,
  unit,
  unitTone = "muted",
  progress,
  caption,
  captionClassName,
  tone = "page",
  className,
}: StatTileProps) {
  const pct = progress
    ? Math.max(
        0,
        Math.min(100, (progress.value / Math.max(progress.max, 1)) * 100),
      )
    : 0;
  const ink = BENTO_INK[tone];
  const plain = isPlain(tone);
  return (
    <BentoTile tone={tone} art={plain ? undefined : icon} className={className}>
      <div className={cn("t-label flex items-center gap-2", ink.fg)}>
        {icon && plain ? (
          <span
            className="flex size-4 items-center justify-center text-accent [&>svg]:size-4"
            aria-hidden="true"
          >
            {icon}
          </span>
        ) : null}
        {label}
      </div>
      <SignatureNumber
        size="stat"
        value={value}
        unit={unit}
        tone={ink.number}
        unitTone={plain ? unitTone : ink.unit}
      />
      {progress ? (
        <div
          role="progressbar"
          aria-label={progress.label}
          aria-valuemin={0}
          aria-valuemax={progress.max}
          aria-valuenow={progress.value}
          className="h-1.5 overflow-hidden rounded-[3px] bg-accent-tint-2"
        >
          <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
        </div>
      ) : null}
      {caption ? (
        <div className={cn("t-caption", ink.fg, !plain && icon ? BENTO_ART_CLEAR : null, captionClassName)}>
          {caption}
        </div>
      ) : null}
    </BentoTile>
  );
}

export interface FactTileProps {
  label: string;
  /** Optional icon: on page / surface 16px in a small accent-tint disc; on a coloured tone 28px in the top-right corner. */
  icon?: ReactNode;
  value: ReactNode;
  unit?: ReactNode;
  caption?: ReactNode;
  /** Extra classes on the caption line (e.g. a caption shown only at one width). */
  captionClassName?: string;
  tone?: Exclude<BentoTone, "navy" | "signature">;
  className?: string;
}

/**
 * The small bento tile (owner rule 9): one fact — «Capturi 389», «Fără capturi 3» — at the 26px
 * signature step, no 156 minimum, so it can sit two to a column beside a tall StatTile. Same
 * radius as every bento tile; the unit is the kit's spaced, muted one (SignatureNumber `fact`).
 */
export function FactTile({
  label,
  icon,
  value,
  unit,
  caption,
  captionClassName,
  tone = "page",
  className,
}: FactTileProps) {
  const ink = BENTO_INK[tone];
  const plain = isPlain(tone);
  return (
    <div
      className={cn(
        "relative isolate flex min-w-0 flex-col justify-between gap-2 overflow-hidden rounded-bento p-4",
        TONE[tone],
        className,
      )}
    >
      <div className={cn("flex min-w-0 items-center gap-2 t-label", ink.fg)}>
        {icon && plain ? (
          <span
            aria-hidden="true"
            className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-tint text-accent [&>svg]:size-4"
          >
            {icon}
          </span>
        ) : null}
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {/* A coloured fact tile: its icon in the top-right corner, in the tile's own colour (rule 19). */}
        {icon && !plain ? (
          <span aria-hidden="true" className="-my-1 -me-1 flex size-8 shrink-0 items-center justify-center [&>svg]:size-7">
            {icon}
          </span>
        ) : null}
      </div>
      <SignatureNumber
        size="fact"
        value={value}
        unit={unit}
        tone={ink.number}
        unitTone={plain ? "muted" : ink.unit}
        className={cn("whitespace-nowrap", !plain && ink.fg)}
      />
      {caption ? (
        <div className={cn("line-clamp-2 t-caption", ink.fg, captionClassName)}>
          {caption}
        </div>
      ) : null}
    </div>
  );
}
