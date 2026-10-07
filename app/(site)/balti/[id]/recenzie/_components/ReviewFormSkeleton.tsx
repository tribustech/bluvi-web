'use client';

import type { ReactNode } from 'react';
import { useParams } from 'next/navigation';
import { routes } from '@/lib/routes';
import { T4ActionBar, T4Frame, T4Header, T4LineBar, T4Spinner, type T4Back } from '@/components/templates/T4';
import { Button } from '@/components/ui/Button';
import { LakeSummaryAsideSkeleton } from './LakeSummaryAside';

/**
 * The form's grey shape on the form's own geometry (the ratings card, the comment card) with the
 * header, the lake card's outline from 1280 and a disabled CTA already in place, so nothing moves
 * when the form lands. `spinner`: the edit mode's «loading my review» (fish Spinner, c7), announced.
 */
export function ReviewFormSkeleton({
  title = 'Se încarcă…',
  eyebrow,
  back,
  aside,
  primaryLabel = 'Adaugă o recenzie',
  spinner = false,
}: {
  title?: string;
  eyebrow?: ReactNode;
  back?: T4Back;
  /** The real lake card when it is already known; default: its skeleton. */
  aside?: ReactNode | null;
  primaryLabel?: string;
  spinner?: boolean;
}) {
  const params = useParams<{ id?: string }>();
  const fallback = params?.id ? routes.lakeReviews(params.id) : routes.lakes();
  return (
    <T4Frame
      busy
      label={title}
      header={<T4Header title={title} eyebrow={eyebrow} back={back ?? { label: 'Înapoi', href: fallback }} />}
      aside={aside === undefined ? <LakeSummaryAsideSkeleton /> : (aside ?? undefined)}
      actions={<T4ActionBar primary={<Button disabled>{primaryLabel}</Button>} />}
    >
      <p role="status" className={spinner ? 'flex items-center gap-2 t-body text-muted' : 'sr-only'} data-testid="review-form-loading">
        {spinner ? <T4Spinner className="text-accent" /> : null}
        {spinner ? 'Se încarcă recenzia ta…' : 'Se încarcă formularul…'}
      </p>
      <div aria-hidden className="flex flex-col gap-4 rounded-card bg-surface p-4 shadow-e0 md:p-5 xl:p-6">
        <span className="flex items-start gap-3">
          <span className="size-10 shrink-0 animate-shimmer rounded-full" />
          <span className="flex flex-1 flex-col pt-0.5">
            <T4LineBar type="t-heading" className="w-56 max-w-full" />
          </span>
        </span>
        <span className="flex flex-col gap-3 md:grid md:grid-cols-3 md:gap-4">
          {[0, 1, 2].map(i => (
            <span key={i} className="flex items-center justify-between gap-2 md:flex-col md:rounded-card md:bg-page md:px-3 md:py-4">
              <T4LineBar type="t-heading" className="w-20" />
              <span className="h-10 w-50 max-w-full animate-shimmer rounded-full md:h-11 md:w-55" />
            </span>
          ))}
        </span>
      </div>
      <div aria-hidden className="flex flex-col gap-4 rounded-card bg-surface p-4 shadow-e0 md:p-5 xl:p-6">
        <span className="flex items-start gap-3">
          <span className="size-10 shrink-0 animate-shimmer rounded-full" />
          <span className="flex flex-1 flex-col pt-0.5">
            <T4LineBar type="t-heading" className="w-40" />
            <T4LineBar type="t-caption" className="w-64 max-w-full" />
          </span>
        </span>
        <span className="h-28 animate-shimmer rounded-control" />
        <span className="h-14 animate-shimmer rounded-card" />
      </div>
    </T4Frame>
  );
}
