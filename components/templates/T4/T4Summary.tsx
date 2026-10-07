import type { ReactNode } from 'react';
import { PencilSquareIcon } from '@heroicons/react/24/outline';
import { Button, buttonClass } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { T4SectionHeader } from './T4Section';

export type T4Row = {
  label: string;
  /** null: not chosen yet — printed as a muted «—», so the panel keeps its shape from step 1. */
  value: ReactNode | null;
};

/**
 * `value: null` — no price: the line keeps its height (an invisible figure in the display step)
 * and prints a faint body-size «—» at the right, as the rows above it do (a display-size «—»
 * would read as a grey rule). While busy nothing is printed there; the sub says why. Nothing under
 * it moves when the quote arrives (ROADMAP §5, CLS ≤ 0.05).
 */
export type T4Total = {
  label: string;
  value: string | null;
  /**
   * The value's unit («lei»), set apart from the figure: smaller, muted, a space before it (owner
   * rule 10). Omit when `value` already carries it.
   */
  unit?: string;
  sub?: string;
  /** The price is being computed (say so in `sub`: «Calculăm prețul…»): no «—» meanwhile. */
  busy?: boolean;
  /** `danger`: `sub` is why there is no price («Prețul nu e disponibil»), in the danger hue. */
  tone?: 'danger';
};

type SummaryProps = {
  /** «Rezumat». */
  title: string;
  /** Identity block on top: the lake / competition name, a thumb. */
  header?: ReactNode;
  rows: T4Row[];
  /**
   * The price lines (tour, extras), a second group under a hairline: the receipt reads choices →
   * price lines → total, never one undivided list of facts and amounts.
   */
  priceRows?: T4Row[];
  /** The money line under a hairline (fish DetailRows total: display type, accent-ink). */
  total?: T4Total | null;
  /** Announce total changes (see <T4TotalLine live>): one announcer per screen. */
  liveTotal?: boolean;
  /** Under the total: «Prețul final îl confirmă balta», the cancellation policy. */
  footnote?: ReactNode;
  children?: ReactNode;
  className?: string;
};

/**
 * Running summary (right column from 1280; the summary step below it). Everything the user has
 * chosen so far plus the price, so the CTA never commits to something off screen. Rows without a
 * value show «—» rather than disappearing: the panel does not jump as the steps fill it.
 */
export function T4Summary({ title, header, rows, priceRows, total, liveTotal = false, footnote, children, className }: SummaryProps) {
  return (
    <section
      aria-label={title}
      className={cn('flex flex-col gap-4 rounded-card bg-surface p-4 shadow-e0 md:p-5 xl:p-6', className)}
    >
      {/* The system's caps label (T4Header eyebrow, T3/T5/T6 headers): t-eyebrow, never t-label caps. */}
      <h2 className="t-eyebrow text-muted uppercase">{title}</h2>
      {header}
      {rows.length ? <T4Rows rows={rows} /> : null}
      {priceRows?.length ? <T4PriceRows rows={priceRows} /> : null}
      {total ? <T4TotalLine total={total} live={liveTotal} /> : null}
      {footnote ? <div className="t-caption text-muted">{footnote}</div> : null}
      {children}
    </section>
  );
}

/** Label / value rows, no dividers (fish DetailRows): spacing separates them. */
export function T4Rows({ rows, className }: { rows: T4Row[]; className?: string }) {
  return (
    <dl className={cn('flex flex-col gap-2.5', className)}>
      {rows.map((r) => (
        <div key={r.label} className="flex items-baseline justify-between gap-3">
          <dt className="t-body shrink-0 text-muted">{r.label}</dt>
          <dd className={cn('t-body-strong min-w-0 text-right', r.value == null ? 'text-muted' : 'text-ink')}>
            {r.value ?? '—'}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** The price lines of a receipt: the second group, set off from the chosen facts by a hairline. */
export function T4PriceRows({ rows, className }: { rows: T4Row[]; className?: string }) {
  return <T4Rows rows={rows} className={cn('border-t border-hairline pt-3', className)} />;
}

/**
 * The money line. `live`: a polite live region, so a re-quote is said — opt-in, because the same
 * price is often on screen twice (bar + card); the screen marks exactly one visible copy live.
 */
export function T4TotalLine({ total, live = false }: { total: T4Total; live?: boolean }) {
  return (
    <div className="flex items-end justify-between gap-3 border-t border-hairline pt-3" aria-live={live ? 'polite' : undefined}>
      <div className="min-w-0">
        <p className="t-body-strong text-ink">{total.label}</p>
        {total.sub ? (
          <p className={cn('t-caption', total.tone === 'danger' ? 'text-status-danger-fg' : 'text-muted')}>{total.sub}</p>
        ) : null}
      </div>
      {total.value == null ? (
        // The display line's height, with the rows' muted «—» on its baseline (none while busy).
        <span className="grid shrink-0 justify-items-end">
          <span aria-hidden className="t-display invisible col-start-1 row-start-1">
            0
          </span>
          {total.busy ? null : (
            <span className="t-body-strong col-start-1 row-start-1 self-end text-muted">—</span>
          )}
        </span>
      ) : (
        <p className="shrink-0 whitespace-nowrap">
          <span className="t-display text-accent-ink tabular-nums">{total.value}</span>
          {total.unit ? <span className="t-body-strong text-muted">{` ${total.unit}`}</span> : null}
        </p>
      )}
    </div>
  );
}

type GroupProps = {
  title: string;
  /** 24px outline icon in the same 40px disc as <T4Section>, so the text column stays put. */
  icon?: ReactNode;
  /** Jump back to the step that owns these answers. */
  onEdit?: () => void;
  /**
   * A submit is running: «Modifică» stays in place and in the tab order but refuses (aria-disabled,
   * the kit's disabled look), as the header's back control does — never a dead button that looks live.
   */
  busy?: boolean;
  /** «Modifică intervalul» — the visible text stays «Modifică», this names it for screen readers. */
  editLabel?: string;
  rows?: T4Row[];
  children?: ReactNode;
  className?: string;
};

/**
 * One block of the summary step: what a step decided, with «Modifică» to go back to it (create
 * competition step-review, booking review). A card like the sections.
 */
export function T4ReviewGroup({ title, icon, onEdit, editLabel, busy = false, rows, children, className }: GroupProps) {
  return (
    <section aria-label={title} className={cn('flex flex-col gap-4 rounded-card bg-surface p-4 shadow-e0 md:p-5 xl:p-6', className)}>
      <T4SectionHeader
        title={title}
        icon={icon}
        action={
          onEdit ? (
            busy ? (
              <button
                type="button"
                aria-disabled
                aria-label={editLabel}
                className={buttonClass({ variant: 'ghost', size: 'compact', disabled: true, className: '-my-1.5 -mr-3' })}
              >
                <span aria-hidden className="flex size-5 items-center justify-center [&>svg]:size-5">
                  <PencilSquareIcon />
                </span>
                Modifică
              </button>
            ) : (
              <Button
                variant="ghost"
                size="compact"
                onClick={onEdit}
                aria-label={editLabel}
                icon={<PencilSquareIcon />}
                className="-my-1.5 -mr-3"
              >
                Modifică
              </Button>
            )
          ) : undefined
        }
      />
      {rows ? <T4Rows rows={rows} /> : null}
      {children}
    </section>
  );
}
