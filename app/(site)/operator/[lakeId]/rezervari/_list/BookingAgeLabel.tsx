import { cn } from '@/components/ui/cn';

/**
 * c16 — how long a request has waited, next to the name («acum 2 h 13 min»; core bookingAgeLabel),
 * red once it waited 5 hours or more (isRequestStale). Pending requests only; the model passes null
 * for anything else.
 */
export function BookingAgeLabel({ age, stale }: { age: string | null; stale: boolean }) {
  if (!age) return null;
  return (
    <span data-testid="inbox-age" data-stale={stale || undefined} className={cn('shrink-0 t-caption', stale ? 'font-bold text-status-danger-fg' : 'text-muted')}>
      {age}
    </span>
  );
}
