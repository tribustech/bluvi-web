import Link from 'next/link';
import type { ReactNode } from 'react';
import { HandThumbDownIcon, HandThumbUpIcon } from '@heroicons/react/20/solid';
import { Pill } from '@/components/cards/parts';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/components/ui/cn';
import type { Review } from '@/core/lakes';
import { routes } from '@/lib/routes';
import { Ago } from './Ago';
import { lakeHref } from './availability';
import { VerifiedBadge } from './parts';
import { RatingStars } from './RatingStars';

/*
 * fish features/reviews/components/ReviewCard.tsx, read-only (`editable={false}` on the lake page,
 * parity lakes.detail.c27): the author (a link to their profile once that page is on the web —
 * availability.ts `angler`), «acum …», «Verificat» when the review comes from a completed booking,
 * the verdict Recomandă / Nu recomandă (a state: the kit's round status Pill, Fundații §07 — green, or
 * the danger pair for «Nu recomandă», fish Badge color="red"), the three scores as stars on t-label
 * rows (RatingStars, the same stars as the reviews page's scores), the comment.
 * On the reviews page (lakes.reviews) the viewer's own card takes `actions` (Editează / Șterge) and
 * its author is not a link (fish: no press on an editable card).
 */

const SCORES = [
  { key: 'quality', label: 'Pescuit' },
  { key: 'facilities', label: 'Facilități' },
  { key: 'atmosphere', label: 'Atmosferă' },
] as const;

export function ReviewCard({ review, actions, className }: { review: Review; actions?: ReactNode; className?: string }) {
  const name = review.author?.username?.trim() || 'Pescar';
  const authorId = review.author?.documentId;
  const authorHref = authorId && !actions ? lakeHref('angler', routes.angler(authorId)) : undefined;
  const who = (
    <>
      <Avatar name={name} src={review.author?.avatar?.thumbnailUrl || review.author?.avatar?.url} size={32} />
      <span className="flex min-w-0 flex-col">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="truncate t-body-strong">{name}</span>
          {review.verified ? <VerifiedBadge>Verificat</VerifiedBadge> : null}
        </span>
        <span className="t-caption text-muted">
          <Ago iso={review.createdAt} />
        </span>
      </span>
    </>
  );
  return (
    <article className={cn('flex flex-col gap-3 rounded-card p-3.5 shadow-e0', className)} data-testid="lake-review">
      <header className="flex items-start gap-2">
        {authorHref ? (
          <Link href={authorHref} className="-m-1 flex min-w-0 flex-1 items-center gap-2 rounded-control p-1 hover:bg-soft-fill">
            {who}
          </Link>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-2">{who}</div>
        )}
        {/* The kit status Pill (StatusPill has no danger tone yet): green / the danger pair (AA). */}
        <span className="flex" data-testid="review-verdict" data-tone={review.recommendToOthers ? 'success' : 'danger'}>
          <Pill tone={review.recommendToOthers ? 'success' : 'danger'}>
            {review.recommendToOthers ? 'Recomandă' : 'Nu recomandă'}
            {review.recommendToOthers ? <HandThumbUpIcon aria-hidden className="size-3.5" /> : <HandThumbDownIcon aria-hidden className="size-3.5" />}
          </Pill>
        </span>
      </header>
      <dl className="flex flex-col gap-1">
        {SCORES.map(s => (
          <div key={s.key} className="flex items-center justify-between gap-3">
            <dt className="t-label text-muted">{s.label}</dt>
            <dd>
              <RatingStars value={review[s.key]} />
            </dd>
          </div>
        ))}
      </dl>
      {review.comment ? <p className="t-body break-words whitespace-pre-line text-ink">{review.comment}</p> : null}
      {actions ? <footer className="flex flex-wrap items-center gap-2 border-t border-hairline pt-3">{actions}</footer> : null}
    </article>
  );
}
