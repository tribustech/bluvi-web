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
 */
export type SignatureSize = "count" | "tile" | "stat";
export type SignatureTone = "ink" | "lavender";
export type UnitTone = "muted" | "faint" | "lavender";

const NUMBER: Record<SignatureSize, string> = {
  count: "t-count",
  tile: "text-[64px] leading-[60px] font-extrabold tracking-[-4px] tabular-nums",
  stat: "t-num-40",
};

const UNIT: Record<SignatureSize, string> = {
  count: "t-title1",
  tile: "t-heading",
  stat: "text-[18px] leading-none font-extrabold",
};

const NUMBER_TONE: Record<SignatureTone, string> = {
  ink: "text-ink",
  lavender: "text-lavender",
};

const UNIT_TONE: Record<UnitTone, string> = {
  muted: "text-muted",
  // The "/48" grey (#98A2B3 in light) sits one step below muted.
  faint: "text-faint",
  lavender: "text-lavender-2",
};

export interface SignatureNumberProps {
  value: ReactNode;
  /** Unit or denominator, set tight after the number: "kg", "/48", " zile". */
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
  return (
    <div className={cn("flex flex-col", className)}>
      <span className={cn(NUMBER[size], NUMBER_TONE[tone])}>
        {value}
        {unit ? (
          <span
            className={cn(UNIT[size], UNIT_TONE[unitTone], "tracking-normal")}
          >
            {unit}
          </span>
        ) : null}
      </span>
      {caption ? <span className="t-caption text-muted">{caption}</span> : null}
    </div>
  );
}
