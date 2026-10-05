import { cn } from '@/components/ui/cn';

/** «99+» above 99, nothing at 0 or below. */
export function countLabel(n: number | null | undefined): string | null {
  if (!n || n <= 0) return null;
  return n > 99 ? '99+' : String(n);
}

/**
 * The unanswered-count badge (fish: the Rezervări tile's pending count). One colour per meaning:
 * a count waiting for an answer is the «în așteptare» pair (status-pending, StatusPill `pending`),
 * never the live red, which only ever means LIVE. The surface ring lifts it off a filled tile.
 * Decorative — the caller says the count in words (sr-only) next to it.
 *
 * The corner badge is for a tile with no room for words (the phone/tablet shortcut bar); a list row
 * says the count as a trailing StatusPill `pending` instead (DashboardActions list).
 *
 * TODO(kit): promote this one spec (h-4.5, ring-2 surface, the pending pair) to
 * components/ui/CountBadge.tsx and use it in T3 DetailQuickActions (today h-5, border-2,
 * status-live — a second spec for the same meaning), T1 FilterButton's count and the TopBar dot.
 * This task may only touch T5; no page outside the T5 demo uses it until then.
 */
export function CountBadge({ count, className }: { count: number | null | undefined; className?: string }) {
  const label = countLabel(count);
  if (!label) return null;
  return (
    <span
      aria-hidden
      className={cn('flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-status-pending-bg px-1.25 t-micro-strong text-status-pending-fg tabular-nums ring-2 ring-surface', className)}
    >
      {label}
    </span>
  );
}
