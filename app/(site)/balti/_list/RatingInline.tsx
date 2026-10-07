import { StarIcon } from '@heroicons/react/20/solid';
import { formatDecimal, formatInt, plural } from '@/components/cards';
import { cn } from '@/components/ui/cn';

/*
 * The rating of a lake list card — one format for the /balti grid (LakeGridCard) and the
 * /balti/harta list (LakeRowCard), so the same lake never reads «4,8» on one page and «4,83» on
 * the other: «★ 4,8 (2)», one decimal like fish MiniatureLakeCard, the review count muted. The
 * pin card keeps fish LakeMapPinCard's two decimals (lakes.results-map.c12, ResultCards).
 */
export function RatingInline({ overall, count, className }: { overall: number; count: number; className?: string }) {
  return (
    <p className={cn('flex shrink-0 items-center gap-0.5 text-ink', className)}>
      <StarIcon aria-hidden className="size-4 text-rating" />
      <span className="sr-only">Rating </span>
      {formatDecimal(overall, 1, 1)}
      <span className="text-muted">
        {' '}
        ({formatInt(count)}
        <span className="sr-only"> {plural(count, 'recenzie', 'recenzii').replace(/^\S+ /, '')}</span>)
      </span>
    </p>
  );
}
