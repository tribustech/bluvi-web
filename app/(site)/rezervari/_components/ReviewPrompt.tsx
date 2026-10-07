import { StarIcon } from '@heroicons/react/24/outline';
import { ButtonLink } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import type { LakeToReview } from '@/core/booking';
import { formatCount } from '@/core/realtime/chat/format';
import { routes } from '@/lib/routes';

/**
 * c11 — fish AlertCard tone «amber» over the list (app/(app)/bookings/index.tsx:186-222): the FIRST
 * lake the angler fished and never reviewed. «Cum a fost la {lake}?», then «Ai fost acolo, dar n-ai
 * lăsat încă o recenzie.» or, with more waiting, «… Încă {n} baltă așteaptă | {n} bălți așteaptă.»
 * (owner plural rule: formatCount, «20 de bălți»). «Scrie» opens the review form for that lake,
 * filed against that stay (?rezervare=).
 *
 * `stack`: the docked right column (≥1280, 320–360 wide) puts the button under the text; the phone
 * keeps fish's one row.
 */
export function ReviewPrompt({ lakes, layout = 'row' }: { lakes: LakeToReview[]; layout?: 'row' | 'stack' }) {
  const first = lakes[0];
  if (!first) return null;
  const extra = lakes.length - 1;
  const stack = layout === 'stack';
  return (
    <section
      aria-labelledby={`review-prompt-${layout}`}
      data-testid="review-prompt"
      className={cn('flex gap-3 rounded-card bg-surface p-4 shadow-e1', stack ? 'flex-col' : 'flex-wrap items-center')}
    >
      <div className={cn('flex min-w-0 items-center gap-3', !stack && 'flex-1 basis-56')}>
        <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-control bg-status-warning-bg text-status-warning-fg">
          <StarIcon className="size-4.5" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={`review-prompt-${layout}`} className="t-heading text-ink">
            Cum a fost la {first.lakeName}?
          </h2>
          <p className="t-caption text-status-warning-fg">
            {extra > 0
              ? `Ai fost acolo și n-ai lăsat recenzie. Încă ${formatCount(extra, 'baltă', 'bălți')} așteaptă.`
              : 'Ai fost acolo, dar n-ai lăsat încă o recenzie.'}
          </p>
        </div>
      </div>
      <ButtonLink
        href={routes.lakeReview(first.lakeId, { rezervare: first.bookingId })}
        aria-label={`Scrie o recenzie pentru ${first.lakeName}`}
        block={stack}
        className={stack ? undefined : 'max-md:w-full'}
      >
        Scrie
      </ButtonLink>
    </section>
  );
}
