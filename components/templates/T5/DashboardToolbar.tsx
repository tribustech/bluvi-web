import type { ReactNode } from 'react';
import { cn } from '@/components/ui/cn';

/**
 * The filter row of a dashboard (period, scope): chips at the start, anything else at the end.
 * Below 768 the end slot takes its own full-width row (a segmented control stretches its segments)
 * rather than hanging right-aligned under the chips; from 768 it sits on the right of the row,
 * bottom-aligned with the chips (a labelled control's legend sits above its track).
 *
 * Use the kit's radio chips (T1 ChoiceChips) and SegmentedControl. A URL-driven filter has no chip
 * of its own yet: when one is needed, export the chip class from T1 Filters (or add the
 * `--shadow-selected` token the T1 TODO asks for) and use it from both, never a second chip spec.
 */
export function DashboardToolbar({ children, end, className }: { children: ReactNode; end?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-end gap-x-3 gap-y-3', className)}>
      {children}
      {end ? <div className="flex basis-full items-end gap-2 md:ml-auto md:basis-auto">{end}</div> : null}
    </div>
  );
}
