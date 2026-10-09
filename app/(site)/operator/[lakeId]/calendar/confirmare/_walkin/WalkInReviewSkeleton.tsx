'use client';

import { useParams } from 'next/navigation';
import { T4ActionBar, T4Header, T4LineBar, type T4Back } from '@/components/templates/T4';
import { Button } from '@/components/ui/Button';
import { routes } from '@/lib/routes';
import { useOwnedLakeName } from '../../../../_shared/useOwnedLakeName';
import { TITLE } from './model';
import { ACTIONS_SPLIT, HEADER_SPLIT, WalkInReviewFrame } from './WalkInReviewFrame';

/**
 * The step before its data (the session gate, the lake read, the live availability, the quote's
 * first answer is NOT this — that is QuoteUnavailable): the header with the lake's name once the
 * owned-lakes list knows it (a grey bar meanwhile, never a placeholder name that swaps — rule 4),
 * the summary card's shape on the right from 1024, «Date pescar»'s shape and a disabled CTA. The same
 * geometry as the step, so nothing moves when it lands. Announced once (sr-only status).
 */
export function WalkInReviewSkeleton({ eyebrow, back }: { eyebrow?: string; back?: T4Back }) {
  const { lakeId } = useParams<{ lakeId?: string }>();
  const owned = useOwnedLakeName(lakeId ?? '');
  const name = eyebrow ?? owned;
  return (
    <>
      <p role="status" className="sr-only" data-testid="walkin-review-loading">
        Se încarcă rezervarea…
      </p>
      <WalkInReviewFrame
        busy
        label={TITLE}
        header={
          <T4Header
            className={HEADER_SPLIT}
            title={TITLE}
            eyebrow={name ? name : <T4LineBar type="t-eyebrow" className="w-28" />}
            back={back ?? { label: 'Înapoi', href: lakeId ? routes.operatorCalendar(lakeId) : routes.operator() }}
          />
        }
        summary={<SummarySkeleton />}
        actions={<T4ActionBar className={ACTIONS_SPLIT} primary={<Button disabled>Adaugă rezervarea</Button>} />}
      >
        <div aria-hidden className="flex flex-col gap-4 rounded-card bg-surface p-4 shadow-e0 md:p-5 xl:p-6">
          <span className="flex items-center gap-3">
            <span className="size-10 shrink-0 animate-shimmer rounded-full bg-soft-fill" />
            <T4LineBar type="t-heading" className="w-32" />
          </span>
          <span className="h-11 animate-shimmer rounded-control bg-soft-fill" />
          <span className="flex flex-col gap-1.5">
            <T4LineBar type="t-label" className="w-24" />
            <span className="h-11 animate-shimmer rounded-control bg-soft-fill" />
          </span>
          <T4LineBar type="t-caption" className="w-64 max-w-full" />
          <span className="flex flex-col gap-1.5">
            <T4LineBar type="t-label" className="w-32" />
            <span className="h-25 animate-shimmer rounded-control bg-soft-fill" />
          </span>
        </div>
      </WalkInReviewFrame>
    </>
  );
}

function SummarySkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-4 rounded-card bg-surface p-4 shadow-e0 md:p-5 xl:p-6">
      <span className="flex items-center gap-3">
        <span className="size-11 shrink-0 animate-shimmer rounded-full bg-soft-fill" />
        <span className="flex flex-1 flex-col">
          <T4LineBar type="t-heading" className="w-40" />
          <T4LineBar type="t-caption" className="w-20" />
        </span>
      </span>
      <span className="flex gap-1.75">
        {['w-24', 'w-20', 'w-18'].map((w) => (
          <span key={w} className={`h-7 animate-shimmer rounded-control bg-soft-fill ${w}`} />
        ))}
      </span>
      <T4LineBar type="t-body" className="w-56 max-w-full" />
      <span className="flex flex-col gap-3 border-t border-hairline pt-3">
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
  );
}
