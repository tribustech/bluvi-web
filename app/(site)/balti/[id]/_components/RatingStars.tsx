import { StarIcon } from '@heroicons/react/20/solid';
import { cn } from '@/components/ui/cn';

/*
 * One star renderer for the lake's pages (fish CustomStarRatingDisplay): five stars filled to the
 * value — fractionally («3,4» → three stars and two fifths of the fourth) — one image named «3,4
 * din 5» («4 din 5» for a whole score). The reviews page's scores and every review card draw it, so
 * a score never reads as two different star rows on one screen.
 * TODO(kit): promote to components/ui/RatingStars (the lake card, the review form) — this unit may
 * only touch the lake pages.
 */

const SIZE = { xs: 'size-3.5', sm: 'size-4', md: 'size-5' } as const;

/** «3,4», «4»: one decimal with the Romanian comma, none for a whole score. */
export function ratingText(value: number): string {
  const v = Math.round(Math.max(0, Math.min(5, value)) * 10) / 10;
  return Number.isInteger(v) ? String(v) : v.toFixed(1).replace('.', ',');
}

export function RatingStars({ value, size = 'sm', className }: { value: number; size?: keyof typeof SIZE; className?: string }) {
  const v = Math.max(0, Math.min(5, value));
  return (
    <span className={cn('flex items-center gap-0.5', className)} role="img" aria-label={`${ratingText(v)} din 5`}>
      {[1, 2, 3, 4, 5].map(i => {
        const fill = Math.max(0, Math.min(1, v - (i - 1)));
        return (
          <span key={i} aria-hidden className={cn('relative', SIZE[size])}>
            <StarIcon className={cn('absolute inset-0 text-faint', SIZE[size])} />
            {fill > 0 ? (
              <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
                <StarIcon className={cn('text-rating', SIZE[size])} />
              </span>
            ) : null}
          </span>
        );
      })}
    </span>
  );
}
