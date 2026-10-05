import type { ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { T4ActionBar } from './T4ActionBar';
import { T4Frame, type T4Offset } from './T4Frame';
import { T4Header, type T4Back } from './T4Header';
import { T4ProgressPlaceholder } from './T4Steps';

/**
 * A grey text bar (Fundații §07: the skeleton is for text only, photos load over their blurhash)
 * inside a line of the real type step, so the line is exactly as tall as the text:
 * `h-lh` gives the empty span its step's line height (an empty box has no line box of its own and
 * would collapse to the bar), so a title bar and its caption bar sit apart as the text lines do.
 */
export function T4LineBar({ type, className }: { type: string; className?: string }) {
  return (
    <span aria-hidden className={cn('flex h-lh items-center', type)}>
      <span className={cn('inline-block h-[0.7em] rounded-full bg-soft-fill animate-shimmer', className)} />
    </span>
  );
}

/**
 * The choice grid of a step (stands): T4ChoiceCard `tile-row` cells — tiles from 64px below 768
 * (56 tall), row cards from 176px from 768 (56–62 tall: 12 + title (+ caption) + 12; the skeleton draws 60), from 144px from
 * 1280, so the desktop form column (512 inside at 1280, 620 at 1440) gets 3 / 4 across — never
 * sparser than the tablet's 3. The skeleton draws the same grid, so the page does not grow by
 * hundreds of px when the data lands.
 */
export const T4_CHOICE_GRID =
  'grid grid-cols-[repeat(auto-fill,minmax(--spacing(16),1fr))] gap-2 md:grid-cols-[repeat(auto-fill,minmax(--spacing(44),1fr))] md:gap-2.5 xl:grid-cols-[repeat(auto-fill,minmax(--spacing(36),1fr))]';

/**
 * A section card's skeleton (fish DraftLoadingSkeleton): the 40px disc, heading and caption lines,
 * then optionally a row of `tiles` (a day picker: label + 60×72 tiles), then `fields` label +
 * control pairs — side by side from 768 when `columns={2}`, as <T4FieldGrid> — the fields listed
 * in `helpers` (0-based) with a helper caption under the control, then optionally a `grid` of N
 * choice cells in T4_CHOICE_GRID (the stand grid).
 */
export function T4SectionSkeleton({
  fields = 2,
  tiles = 0,
  columns = 1,
  grid = 0,
  helpers = [],
}: {
  fields?: number;
  tiles?: number;
  columns?: 1 | 2;
  grid?: number;
  helpers?: number[];
}) {
  return (
    <div aria-hidden className="flex flex-col gap-4 rounded-card bg-surface p-4 shadow-e0 md:p-5 xl:p-6">
      <div className="flex items-start gap-3">
        <span className="size-10 shrink-0 rounded-full bg-soft-fill animate-shimmer" />
        <span className="flex flex-1 flex-col pt-0.5">
          <T4LineBar type="t-heading" className="w-40" />
          <T4LineBar type="t-caption" className="w-56 max-w-full" />
        </span>
      </div>
      {tiles > 0 ? (
        <span className="flex min-w-0 flex-col gap-1.5">
          <T4LineBar type="t-label mb-1.5" className="w-24" />
          <span className="flex gap-2 overflow-hidden">
            {Array.from({ length: tiles }, (_, i) => (
              <span key={i} className="h-18 w-15 shrink-0 rounded-card bg-soft-fill animate-shimmer" />
            ))}
          </span>
        </span>
      ) : null}
      {fields > 0 ? (
        <span className={cn('grid gap-4', columns === 2 && 'md:grid-cols-2')}>
          {Array.from({ length: fields }, (_, i) => (
            <span key={i} className="flex flex-col gap-1.5">
              <T4LineBar type="t-label mb-1.5" className="w-24" />
              <span className="block h-11 rounded-control bg-soft-fill animate-shimmer" />
              {helpers.includes(i) ? <T4LineBar type="t-caption" className="w-48 max-w-full" /> : null}
            </span>
          ))}
        </span>
      ) : null}
      {grid > 0 ? (
        <span className={T4_CHOICE_GRID}>
          {Array.from({ length: grid }, (_, i) => (
            <span key={i} className="h-14 rounded-card bg-soft-fill animate-shimmer md:h-15" />
          ))}
        </span>
      ) : null}
    </div>
  );
}

type Props = {
  /** Known before the data: the flow's eyebrow and first title, so the header does not jump. */
  eyebrow?: ReactNode;
  title?: string;
  /** The real back control (the flow's entry is known from the URL), so the title does not shift. */
  back?: T4Back;
  steps?: number;
  offset?: T4Offset;
  /** Right column skeleton from 1280 (default true). */
  aside?: boolean;
  /**
   * The step's action bar, as it will render (its CTA label, disabled), with a grey money line —
   * so the sticky bar does not pop in on a phone. `false`: the flow has none on its first step.
   */
  primaryLabel?: string | false;
  /** The summary's price lines under their hairline (the tour, an extra): as many as the step shows. */
  priceRows?: number;
  /** The rail's help caption under the step list (as many caption lines as the real one wraps to). */
  railHelp?: number;
  children?: ReactNode;
};

/**
 * The whole T4 page while the step's data loads: the real header (eyebrow, title, step count when
 * known — the URL already says which flow this is), grey bars where the progress goes, section
 * skeletons, the summary column's shape (identity disc, rows, total line) and the action bar. One
 * sr-only `role=status` line announces «Se încarcă formularul…» (a live region reads its text, so
 * it wraps nothing else — never the h1 or the back link); the form column is aria-busy.
 */
export function T4Skeleton({
  eyebrow,
  title = 'Se încarcă…',
  back,
  steps = 3,
  offset = 'shell',
  aside = true,
  primaryLabel = 'Continuă',
  priceRows = 1,
  railHelp = 2,
  children,
}: Props) {
  // T4StepList's row, bar for text: the same pt-1 row, 40px marker + connector, pt-2 / pb-5 text
  // column — so the markers do not move when the real list replaces it.
  const rail = (
    <div aria-hidden className="flex flex-col gap-6">
      <span className="flex flex-col">
        {Array.from({ length: steps }, (_, i) => {
          const last = i === steps - 1;
          return (
            <span key={i} className="-mx-2 flex gap-4 px-2 pt-1">
              <span className="flex flex-col items-center self-stretch">
                <span className="size-10 shrink-0 rounded-full bg-soft-fill animate-shimmer" />
                {last ? null : <span className="mt-1 w-0.5 flex-1 rounded-full bg-soft-fill" />}
              </span>
              <span className={cn('flex min-w-0 flex-1 flex-col pt-2', last ? 'pb-1' : 'pb-5')}>
                <T4LineBar type="t-body-strong" className="w-32" />
              </span>
            </span>
          );
        })}
      </span>
      {railHelp > 0 ? (
        <span className="flex flex-col">
          {Array.from({ length: railHelp }, (_, i) => (
            <T4LineBar key={i} type="t-caption" className={i === railHelp - 1 ? 'w-32' : 'w-full'} />
          ))}
        </span>
      ) : null}
    </div>
  );
  return (
    <>
      <p role="status" className="sr-only">
        Se încarcă formularul…
      </p>
      <T4Frame
        busy
        offset={offset}
        header={
          <T4Header
            title={title}
            eyebrow={eyebrow}
            back={back}
            step={1}
            total={steps}
            progress={<T4ProgressPlaceholder steps={steps} shimmer />}
            offset={offset}
          />
        }
        rail={rail}
        aside={
          aside ? (
            <div aria-hidden className="flex flex-col gap-4 rounded-card bg-surface p-4 shadow-e0 md:p-5 xl:p-6">
              <T4LineBar type="t-eyebrow" className="w-20" />
              <span className="flex items-center gap-3">
                <span className="size-10 shrink-0 rounded-full bg-soft-fill animate-shimmer" />
                <span className="flex flex-1 flex-col">
                  <T4LineBar type="t-heading" className="w-32" />
                  <T4LineBar type="t-caption" className="w-20" />
                </span>
              </span>
              <span className="flex flex-col gap-2.5">
                {Array.from({ length: 3 }, (_, i) => (
                  <span key={i} className="flex justify-between gap-3">
                    <T4LineBar type="t-body" className="w-20" />
                    <T4LineBar type="t-body" className="w-24" />
                  </span>
                ))}
              </span>
              {/* The price lines (T4Summary priceRows: the tour, an extra; «—» until priced) under their hairline. */}
              {priceRows > 0 ? (
                <span className="flex flex-col gap-2.5 border-t border-hairline pt-3">
                  {Array.from({ length: priceRows }, (_, i) => (
                    <span key={i} className="flex justify-between gap-3">
                      <T4LineBar type="t-body" className="w-16" />
                      <T4LineBar type="t-body" className="w-14" />
                    </span>
                  ))}
                </span>
              ) : null}
              <span className="flex items-end justify-between gap-3 border-t border-hairline pt-3">
                <span className="flex flex-col">
                  <T4LineBar type="t-body-strong" className="w-16" />
                  <T4LineBar type="t-caption" className="w-28" />
                </span>
                <span className="t-display invisible">0</span>
              </span>
              <T4LineBar type="t-caption" className="w-48" />
            </div>
          ) : undefined
        }
        actions={
          primaryLabel ? (
            <T4ActionBar
              metaBelowXl
              meta={
                <span aria-hidden className="flex min-w-0 flex-col md:items-end">
                  <T4LineBar type="t-caption" className="w-28" />
                  <span className="t-stat invisible">0</span>
                </span>
              }
              primary={<Button disabled>{primaryLabel}</Button>}
            />
          ) : undefined
        }
      >
        {children ?? (
          <>
            <T4SectionSkeleton tiles={10} fields={2} columns={2} />
            <T4SectionSkeleton fields={0} grid={12} />
          </>
        )}
      </T4Frame>
    </>
  );
}
