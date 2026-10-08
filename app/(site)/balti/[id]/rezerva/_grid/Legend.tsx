import { HomeModernIcon } from '@heroicons/react/24/outline';
import { cn } from '@/components/ui/cn';

/*
 * fish AvailabilityGrid Legend + TodayButton (c3, c4): «Liber» (white), «Indisponibil» (red tint),
 * «Doar telefonic» (yellow — the angler flow enforces the lead time) and the cabin glyph «Cabană»
 * (the mark a stand with extras carries in the frozen column). The operator's grid has no lead time,
 * so its legend has no «Doar telefonic» (fish `<Legend showTooSoon={!!enforceLeadTime} />`,
 * operator.calendar.c4).
 */

function Swatch({ className, label }: { className: string; label: string }) {
  return (
    <li className="flex items-center gap-1.5">
      <span aria-hidden className={cn('size-3.5 shrink-0 rounded-sm border', className)} />
      <span className="t-caption text-ink-2">{label}</span>
    </li>
  );
}

export function Legend({ className, showTooSoon = true }: { className?: string; showTooSoon?: boolean }) {
  return (
    <ul aria-label="Legendă" className={cn('flex flex-wrap items-center gap-x-4 gap-y-1.5', className)}>
      <Swatch className="border-faint bg-surface" label="Liber" />
      <Swatch className="border-status-danger-line bg-status-danger-bg" label="Indisponibil" />
      {showTooSoon ? <Swatch className="border-yellow-5 bg-status-warning-bg" label="Doar telefonic" /> : null}
      <li className="flex items-center gap-1.5">
        <HomeModernIcon aria-hidden className="size-4 shrink-0 text-status-success-fg" />
        <span className="t-caption text-ink-2">Cabană</span>
      </li>
    </ul>
  );
}

/** «Azi»: scrolls the grid to today (fish TodayButton, aria «Mergi la ziua de azi»). */
export function TodayButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Mergi la ziua de azi"
      className={cn(
        't-label inline-flex h-9 cursor-pointer items-center rounded-full border border-indigo-2 bg-accent-tint px-4 text-accent-ink',
        'transition-[filter,opacity] duration-(--duration-fast) ease-fast hover:brightness-95 active:opacity-60',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
      )}
    >
      Azi
    </button>
  );
}
