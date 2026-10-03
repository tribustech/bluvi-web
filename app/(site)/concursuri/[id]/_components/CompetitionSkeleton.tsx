/**
 * fish CompetitionHeaderSkeleton + CompetitionRankingSkeleton (design «Se încarcă»): text-only grey
 * lines, the table as a tinted header bar and grey rows. Announced once.
 */
export function CompetitionSkeleton() {
  return (
    <div role="status" aria-label="Se încarcă concursul" className="flex flex-col gap-3 px-4 py-4 md:px-6 xl:px-8 xl:py-6">
      <div aria-hidden className="flex flex-col items-center gap-2.5 md:flex-row md:items-center md:gap-5">
        <span className="hidden size-24 shrink-0 rounded-card bg-soft-fill md:block" />
        <span className="flex flex-col items-center gap-2.5 md:items-start">
          <span className="h-5.5 w-55 rounded-md bg-soft-fill animate-shimmer md:w-80" />
          <span className="h-3 w-35 rounded-sm bg-soft-fill" />
          <span className="h-6.5 w-45 rounded-sm bg-soft-fill" />
        </span>
      </div>
      <span aria-hidden className="my-1.5 h-px w-full bg-hairline" />
      <div aria-hidden className="flex flex-col gap-1">
        <span className="h-9 rounded-sm bg-accent-tint-2 opacity-60" />
        {Array.from({ length: 6 }, (_, i) => (
          <span key={i} className="h-7 rounded-sm bg-soft-fill" />
        ))}
      </div>
    </div>
  );
}
