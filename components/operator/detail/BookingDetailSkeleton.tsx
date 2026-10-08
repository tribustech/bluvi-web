/**
 * fish DetailSkeleton (features/operator/BookingDetailSheet.tsx) — the detail's shape while the
 * booking it was opened on is being fetched (c1): the avatar, two lines (name, period), two blocks.
 */
export function BookingDetailSkeleton() {
  return (
    <div data-testid="booking-detail-skeleton" aria-busy="true" className="flex flex-col gap-3.5">
      <span className="sr-only" role="status">
        Se încarcă rezervarea…
      </span>
      <div className="flex items-center gap-3">
        <span aria-hidden className="size-12 shrink-0 animate-shimmer rounded-full" />
        <div className="flex flex-1 flex-col gap-2">
          <span aria-hidden className="h-4.5 w-3/5 animate-shimmer rounded-md" />
          <span aria-hidden className="h-3 w-2/5 animate-shimmer rounded-md" />
        </div>
      </div>
      <span aria-hidden className="h-24 w-full animate-shimmer rounded-card" />
      <span aria-hidden className="h-18 w-full animate-shimmer rounded-card" />
    </div>
  );
}
