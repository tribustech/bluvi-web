'use client';

import { useParams } from 'next/navigation';
import { T4ActionBar, T4Frame, T4Header, T4LineBar, T4SectionSkeleton, type T4Back } from '@/components/templates/T4';
import { Button } from '@/components/ui/Button';
import { routes } from '@/lib/routes';

/**
 * The step before its data (the gate, the lake read, the live availability): the header, the summary
 * card's and the contact card's grey shapes, the price column from 1280 and a disabled CTA — the same
 * geometry as the step, so nothing moves when it lands. Announced once (sr-only status).
 */
export function ReviewSkeleton({ eyebrow, back }: { eyebrow?: string; back?: T4Back }) {
  const { id } = useParams<{ id?: string }>();
  return (
    <>
      <p role="status" className="sr-only" data-testid="review-loading">
        Se încarcă rezervarea…
      </p>
      <T4Frame
        busy
        label="Confirmă rezervarea"
        header={
          <T4Header
            title="Confirmă rezervarea"
            eyebrow={eyebrow ?? <T4LineBar type="t-eyebrow" className="w-28" />}
            back={back ?? { label: 'Înapoi', href: id ? routes.lakeBooking(id) : routes.lakes() }}
          />
        }
        aside={
          <div aria-hidden className="flex flex-col gap-4 rounded-card bg-surface p-4 shadow-e0 md:p-5 xl:p-6">
            <T4LineBar type="t-eyebrow" className="w-16" />
            <span className="flex justify-between gap-3">
              <T4LineBar type="t-body" className="w-16" />
              <T4LineBar type="t-body" className="w-20" />
            </span>
            <span className="flex items-end justify-between gap-3 border-t border-hairline pt-3">
              <T4LineBar type="t-body-strong" className="w-20" />
              <T4LineBar type="t-display" className="w-28" />
            </span>
          </div>
        }
        actions={<T4ActionBar primary={<Button disabled>Continuă</Button>} />}
      >
        <div aria-hidden className="flex flex-col gap-4 rounded-card bg-surface p-4 shadow-e0 md:p-5 xl:p-6">
          <span className="flex items-center gap-3">
            <span className="size-11 shrink-0 animate-shimmer rounded-full bg-soft-fill" />
            <span className="flex flex-1 flex-col">
              <T4LineBar type="t-heading" className="w-40" />
              <T4LineBar type="t-caption" className="w-20" />
            </span>
          </span>
          <span className="flex gap-1.75">
            {['w-24', 'w-20', 'w-18'].map(w => (
              <span key={w} className={`h-7 animate-shimmer rounded-control bg-soft-fill ${w}`} />
            ))}
          </span>
          <T4LineBar type="t-body" className="w-64 max-w-full" />
          <span className="flex flex-col gap-3 border-t border-hairline pt-3 xl:hidden">
            <span className="flex justify-between gap-3">
              <T4LineBar type="t-body" className="w-16" />
              <T4LineBar type="t-body" className="w-20" />
            </span>
            <span className="flex items-end justify-between gap-3 border-t border-hairline pt-3">
              <T4LineBar type="t-body-strong" className="w-20" />
              <T4LineBar type="t-display" className="w-28" />
            </span>
          </span>
        </div>
        <T4SectionSkeleton fields={3} columns={2} />
      </T4Frame>
    </>
  );
}
