'use client';

import { StarIcon } from '@heroicons/react/20/solid';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { Ago } from '@/app/(site)/balti/[id]/_components/Ago';
import { RatingStars } from '@/app/(site)/balti/[id]/_components/RatingStars';
// The overlay module, not the T2 barrel: the barrel drags T2Map (supercluster, maplibre CSS) along.
import { T2Spinner } from '@/components/templates/T2/T2MapOverlay';
import { cn } from '@/components/ui/cn';
import {
  anglerReviewOverall,
  anglerReviewSubtitle,
  anglerReviewTagLabels,
  noShowLabel,
  ratingCountLabel,
  userReputationQuery,
  type AnglerReview,
} from '@/core/social';
import { createBrowserTransport } from '@/lib/client/transport';

/**
 * fish features/reputation/ReputationBlock.tsx — an angler's standing with lake operators (parity
 * account.angler-profile c36, c37). Shared API (the settings page imports it in a later batch):
 *
 *   <ReputationBlock userId={documentId} />            // with its «Reputație» heading
 *   <ReputationBlock userId={documentId} heading={false} />  // inside a surface that titles it
 *
 *  - GET /feed/users/{id}/reputation (public; core userReputationQuery);
 *  - a spinner while loading, then the average with a star and «{n} evaluare/evaluări», or «Fără
 *    evaluări»; «{n} neprezentare/neprezentări» in red only when the count is above zero;
 *  - then each review: stars and the value with one decimal (a legacy review with three
 *    sub-scores shows their exact mean), «acum {durată}», «{autor} · {baltă}», the tag chips
 *    (unknown keys dropped), the comment.
 * A failed read says so with a retry (fish shows nothing: rule 4 — never a «Fără evaluări» we do
 * not know).
 */
export function ReputationBlock({ userId, heading = true, className }: { userId: string; heading?: boolean; className?: string }) {
  const t = useMemo(() => createBrowserTransport(), []);
  const q = useQuery(userReputationQuery(t, userId));
  const data = q.data;

  return (
    <section aria-label={heading ? undefined : 'Reputație'} aria-busy={q.isPending || undefined} className={cn('flex flex-col gap-4', className)} data-testid="reputation">
      {heading ? <h2 className="t-title2 text-ink">Reputație</h2> : null}
      {q.isPending ? (
        <span className="flex justify-center py-6 text-accent" role="status" aria-label="Se încarcă reputația">
          <T2Spinner className="size-8" />
        </span>
      ) : q.isError ? (
        <div role="alert" className="flex flex-col items-start gap-2">
          <p className="t-body text-ink-2">Nu am putut încărca reputația.</p>
          <button
            type="button"
            onClick={() => void q.refetch()}
            className="min-h-11 cursor-pointer rounded-control px-1 t-button-compact text-accent-ink hover:underline focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-accent"
          >
            Încearcă din nou
          </button>
        </div>
      ) : data ? (
        <>
          <div className="flex items-center gap-6" data-testid="reputation-summary">
            <div className="flex flex-col items-center gap-0.5">
              {data.avgStars != null ? (
                <>
                  <p className="flex items-center gap-1 t-title2 text-ink">
                    <StarIcon aria-hidden className="size-5 text-rating" />
                    {data.avgStars.toFixed(1).replace('.', ',')}
                  </p>
                  <p className="t-caption text-muted">{ratingCountLabel(data.ratingCount)}</p>
                </>
              ) : (
                <p className="t-body text-muted">Fără evaluări</p>
              )}
            </div>
            {data.noShowCount > 0 ? (
              <div className="flex flex-col items-center gap-0.5" data-testid="reputation-no-shows">
                <p className="t-title2 text-status-danger-fg">{data.noShowCount}</p>
                <p className="t-caption text-muted">{noShowLabel(data.noShowCount)}</p>
              </div>
            ) : null}
          </div>
          {data.reviews.length > 0 ? (
            <ul className="flex flex-col gap-3" aria-label="Evaluări">
              {data.reviews.map((review, i) => (
                <ReviewItem key={i} review={review} />
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

function ReviewItem({ review }: { review: AnglerReview }) {
  const overall = anglerReviewOverall(review);
  const subtitle = anglerReviewSubtitle(review);
  const tags = anglerReviewTagLabels(review);
  return (
    <li className="flex flex-col gap-1.5 border-t border-hairline pt-3" data-testid="reputation-review">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5">
          <RatingStars value={overall} size="xs" />
          <span className="t-label text-ink-2" data-testid="review-score">
            {overall.toFixed(1).replace('.', ',')}
          </span>
        </span>
        <span className="t-caption text-muted">
          <Ago iso={review.createdAt} />
        </span>
      </div>
      {subtitle ? <p className="t-label text-ink-2">{subtitle}</p> : null}
      {tags.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5" aria-label="Etichete">
          {tags.map(label => (
            <li key={label} className="rounded-full bg-soft-fill px-2.5 py-1 t-label text-ink-2">
              {label}
            </li>
          ))}
        </ul>
      ) : null}
      {review.comment ? <p className="t-body text-ink-2">{review.comment}</p> : null}
    </li>
  );
}
