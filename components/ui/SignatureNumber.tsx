import type { ReactNode } from "react";
import { cn } from "./cn";

/**
 * SignatureNumber — Bluvi's big number: value + unit on one baseline, optional caption below.
 * Letter-spacing rule (Fundații §02): the number is pulled in by −6.25% of its size
 * (64 → −4px, 96 → −6px); the 40px step keeps the design's −2px. The unit never inherits it.
 *
 * Sizes:
 *  - count: the page hero (64/60 mobile, 96/88 from 1280px — the `t-count` step)
 *  - tile:  fixed 64/60, the number inside a CountTile at every width
 *  - stat:  fixed 40/44, the number inside a StatTile at every width
 *  - fact:  fixed 26/28, the number inside a small FactTile (and a compact KPI row)
 *
 * The unit (owner rule 10, ROADMAP §4b): a unit word («kg», «lei», «zile») is its own element —
 * smaller, muted, after a real space (a no-break one, so it never wraps away) plus a small gap, so
 * «12,5 kg» never reads «12,5kg». A denominator («/48») stays tight on the number. Callers pass the
 * bare unit («kg»); a leading space they pass is folded into the one the component sets.
 */
export type SignatureSize = "count" | "tile" | "stat" | "fact";
/**
 * Tones per bento surface (owner rule 19): ink on the light tiles, lavender on navy, white on the
 * indigo tile. `current` takes the colour around the number — the tile's own AA fg on a soft
 * tint — since only the figure carries the number tone.
 */
export type SignatureTone = "ink" | "lavender" | "onIndigo";
export type UnitTone = "muted" | "lavender" | "onIndigo" | "current";

const NUMBER: Record<SignatureSize, string> = {
  count: "t-count",
  tile: "t-num-64",
  stat: "t-num-40",
  fact: "t-num-26",
};

const UNIT: Record<SignatureSize, string> = {
  count: "t-title1",
  tile: "t-heading",
  stat: "t-unit-18",
  fact: "t-body-strong",
};

/** The gap after the no-break space, one step per size: the space alone is a hairline at 12–18px. */
const UNIT_GAP: Record<SignatureSize, string> = {
  count: "ms-1",
  tile: "ms-1",
  stat: "ms-0.5",
  fact: "ms-0.5",
};

/** «/48» sits tight on the number; any other unit is a word of its own. */
function splitUnit(unit: ReactNode): { text: ReactNode; tight: boolean } {
  if (typeof unit === "string" || typeof unit === "number") {
    const text = String(unit).trim();
    return { text, tight: text.startsWith("/") };
  }
  return { text: unit, tight: false };
}

const NUMBER_TONE: Record<SignatureTone, string> = {
  ink: "text-ink",
  lavender: "text-lavender",
  onIndigo: "text-on-bento-indigo",
};

const UNIT_TONE: Record<UnitTone, string> = {
  muted: "text-muted",
  lavender: "text-lavender-2",
  onIndigo: "text-on-bento-indigo-2",
  current: "",
};

export interface SignatureNumberProps {
  value: ReactNode;
  /** Unit or denominator: "kg", "zile" (spaced, smaller, muted) or "/48" (tight). */
  unit?: ReactNode;
  caption?: ReactNode;
  size?: SignatureSize;
  tone?: SignatureTone;
  unitTone?: UnitTone;
  className?: string;
}

export function SignatureNumber({
  value,
  unit,
  caption,
  size = "count",
  tone = "ink",
  unitTone = "muted",
  className,
}: SignatureNumberProps) {
  const u = unit === undefined || unit === null || unit === "" ? null : splitUnit(unit);
  return (
    <div className={cn("flex flex-col", className)}>
      {/* The tone sits on the figure alone: the unit is a sibling, so `current` takes the wrapper's
          colour (a tinted tile's AA fg), never the number's ink (owner rule 10). */}
      <span className={NUMBER[size]}>
        <span data-number className={NUMBER_TONE[tone]}>{value}</span>
        {u ? (
          <span
            data-unit
            className={cn(
              UNIT[size],
              UNIT_TONE[unitTone],
              "tracking-normal whitespace-nowrap",
              !u.tight && UNIT_GAP[size],
            )}
          >
            {u.tight ? null : "\u00a0"}
            {u.text}
          </span>
        ) : null}
      </span>
      {caption ? <span className="t-caption text-muted">{caption}</span> : null}
    </div>
  );
}

/**
 * A figure inside a line of text (a caption: «media pe stand 141,0 kg»), with SignatureNumber's unit
 * rule at caption size (owner rule 10): the number a step stronger, the unit its own smaller, muted
 * word after a no-break space — never glued into the sentence at the words' weight and colour.
 */
export function InlineNumber({
  value,
  unit,
  className,
  valueClassName = "t-label text-ink-2",
  unitClassName = "text-muted",
}: {
  value: ReactNode;
  unit?: ReactNode;
  className?: string;
  /** The figure's type step and colour (default: a caption's strong step, «t-label text-ink-2»). */
  valueClassName?: string;
  /** The unit's colour (default muted; a bento surface passes its own AA tone). */
  unitClassName?: string;
}) {
  const u = unit === undefined || unit === null || unit === "" ? null : splitUnit(unit);
  return (
    <span className={cn("whitespace-nowrap", className)}>
      <span className={cn(valueClassName, "tabular-nums")}>{value}</span>
      {u ? (
        <span
          className={cn("t-micro", unitClassName, !u.tight && UNIT_GAP.fact)}
        >
          {u.tight ? null : " "}
          {u.text}
        </span>
      ) : null}
    </span>
  );
}
