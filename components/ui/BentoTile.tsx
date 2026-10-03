import type { ReactNode } from "react";
import { cn } from "./cn";
import { SignatureNumber, type UnitTone } from "./SignatureNumber";

/**
 * Bento tiles — Fundații §07. Radius 20, padding 18, label on top, number in the middle,
 * caption or progress at the bottom (space-between, min height 156).
 *  - CountTile: navy, lavender signature number. One per view, the thing that is happening now.
 *  - StatTile: on page (or surface when the tile sits on the page ground), ink number.
 */
export type BentoTone = "navy" | "page" | "surface";

const TONE: Record<BentoTone, string> = {
  navy: "bg-navy",
  page: "bg-page",
  surface: "bg-surface",
};

export interface BentoTileProps {
  tone?: BentoTone;
  className?: string;
  children: ReactNode;
}

export function BentoTile({
  tone = "page",
  className,
  children,
}: BentoTileProps) {
  return (
    <div
      className={cn(
        "flex min-h-39 flex-col justify-between gap-2 rounded-bento p-4.5",
        TONE[tone],
        className,
      )}
    >
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
  tone?: Exclude<BentoTone, "navy">;
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
  tone = "page",
  className,
}: StatTileProps) {
  const pct = progress
    ? Math.max(
        0,
        Math.min(100, (progress.value / Math.max(progress.max, 1)) * 100),
      )
    : 0;
  return (
    <BentoTile tone={tone} className={className}>
      <div className="t-label flex items-center gap-2 text-muted">
        {icon ? (
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
        unitTone={unitTone}
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
      {caption ? <div className="t-caption text-muted">{caption}</div> : null}
    </BentoTile>
  );
}
