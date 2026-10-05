import type { ReactNode } from 'react';
import { cn } from '@/components/ui/cn';

type Props = {
  /** The step's CTA (kit <Button>, `block` is applied below 768): «Continuă», «Trimite cererea». */
  primary: ReactNode;
  /** A second, quieter action: «Salvează și ieși» (fish step-basics). Stacked under the CTA on a phone. */
  secondary?: ReactNode;
  /**
   * «Înapoi» (ghost) at the far left, from 768. Below 768 the header's back control does it (fish
   * has no footer back), so it is not rendered there.
   */
  back?: ReactNode;
  /**
   * What the CTA commits to, beside it: the running total («300 lei · total»), a hint («Alege un
   * stand»). On a phone it sits left of the CTA when there is no `secondary`.
   */
  meta?: ReactNode;
  /**
   * Hide `meta` from 1280, where the frame's summary column already shows the same total: one
   * signature number per screen, the CTA stands alone with «Înapoi».
   */
  metaBelowXl?: boolean;
  className?: string;
};

/**
 * The step's action bar (fish StickyActionBar / ScrollScreen footer) — one shape with T6
 * FlowActions, so the flows have one CTA placement per width.
 * - <1280: edge to edge (it cancels the page gutters), surface + hairline top edge + the upward
 *   tab-bar shadow (= T3 DetailActionBar), 12px above and max(12px, safe-area) below — iOS
 *   Safari's home indicator. Sticky to the viewport bottom; `mt-auto` in the frame's full-height
 *   column: on a short step it rests on the viewport's bottom edge, never mid-screen.
 *   From 768 the order is «Înapoi» · (space) · meta · CTA: what the CTA commits to sits beside it,
 *   right-aligned, never against «Înapoi».
 * - ≥1280: docked under the summary in the right column (T4Frame places it there), next to the
 *   total it commits to — never floating over the form, so it covers no field, tile or notice.
 *   A card (as T6 FlowActions): the CTA full width on top, «Înapoi» under it.
 * It stays in the flow (sticky, not fixed): the last field is never hidden under it.
 */
export function T4ActionBar({ primary, secondary, back, meta, metaBelowXl = false, className }: Props) {
  const inline = Boolean(meta) && !secondary;
  return (
    <div
      className={cn(
        'sticky bottom-0 z-sticky -mx-4 mt-auto md:-mx-6 xl:static xl:mx-0 xl:mt-0',
        'border-t border-hairline bg-surface px-4 pt-3 pb-[max(--spacing(3),env(safe-area-inset-bottom))] shadow-tabbar',
        'md:px-6 xl:rounded-card xl:border-t-0 xl:px-6 xl:py-4 xl:shadow-[var(--shadow-e1),var(--shadow-e0)]',
        className,
      )}
    >
      <div
        className={cn(
          'flex gap-2.5',
          inline ? 'items-center' : 'flex-col',
          'md:flex-row md:items-center md:gap-3 xl:flex-col xl:items-stretch',
        )}
      >
        {back ? <div className="hidden md:block xl:order-last xl:[&>*]:w-full">{back}</div> : null}
        <div aria-hidden className="hidden md:block md:flex-1 xl:hidden" />
        {meta ? (
          <div className={cn('min-w-0 md:text-right', inline && 'flex-1 md:flex-none', metaBelowXl && 'xl:hidden')}>{meta}</div>
        ) : null}
        <div
          className={cn(
            'flex flex-col-reverse gap-2.5 md:flex-row md:items-center xl:flex-col-reverse xl:items-stretch',
            inline ? 'shrink-0' : 'w-full md:w-auto xl:w-full',
            '[&>*]:w-full md:[&>*]:w-auto xl:[&>*]:w-full',
          )}
        >
          {secondary}
          {primary}
        </div>
      </div>
    </div>
  );
}

/**
 * The `meta` money line: a caption over the amount in stat type, accent-ink (fish DetailRows
 * total). The box is always two lines tall (caption + stat), so the bar never changes height
 * when the quote arrives. Without a figure and not busy (no price yet: «Alege un stand liber»)
 * the hint is one body line centred in that box — beside the CTA's centre, not stuck to the top
 * of an empty figure line. While busy («Calculăm prețul…») the label sits over the reserved
 * figure, as it will once the price lands. From 768 it right-aligns against the CTA.
 * `live`: a polite live region (opt-in: one announcer per screen).
 */
export function T4ActionTotal({
  label,
  value,
  sub,
  busy = false,
  live = false,
}: {
  label: string;
  value: string | null;
  sub?: string;
  busy?: boolean;
  live?: boolean;
}) {
  const hint = value == null && !busy;
  return (
    <div className="grid min-w-0 md:justify-items-end" aria-live={live ? 'polite' : undefined}>
      {/* The two lines' height, always (an invisible caption + figure in the same cell). */}
      <span aria-hidden className="invisible col-start-1 row-start-1 flex flex-col">
        <span className="t-caption">0</span>
        <span className="t-stat">0</span>
      </span>
      {hint ? (
        <span className="t-body col-start-1 row-start-1 min-w-0 self-center truncate text-muted">{label}</span>
      ) : (
        <span className="col-start-1 row-start-1 flex min-w-0 flex-col md:items-end">
          {/* Busy is said in words («Calculăm prețul…»): no 16px glyph in a caption line (§05). */}
          <span className="t-caption max-w-full min-w-0 truncate text-muted">{sub ? `${label} · ${sub}` : label}</span>
          {value == null ? null : <span className="t-stat text-accent-ink tabular-nums">{value}</span>}
        </span>
      )}
    </div>
  );
}
