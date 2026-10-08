import { cn } from '@/components/ui/cn';

/*
 * fish MessagesSkeleton (participant.chat c13): bubble-shaped placeholders, left and right, of
 * varying widths, at the bottom of the room — the room looks like it is filling in, never a spinner.
 */
const ROWS = [
  { mine: false, w: 'w-[58%]', h: 'h-11' },
  { mine: true, w: 'w-[44%]', h: 'h-9.5' },
  { mine: false, w: 'w-[52%]', h: 'h-11' },
  { mine: false, w: 'w-[40%]', h: 'h-11' },
  { mine: true, w: 'w-[56%]', h: 'h-9.5' },
  { mine: false, w: 'w-[48%]', h: 'h-11' },
] as const;

export function BubbleSkeleton() {
  return (
    <div role="status" aria-label="Se încarcă mesajele" className="mx-auto flex h-full w-full max-w-180 flex-col xl:max-w-none justify-end gap-2 px-3 pb-3">
      {ROWS.map((r, i) => (
        <span key={i} aria-hidden className={cn('block max-w-80 animate-shimmer rounded-card', r.w, r.h, r.mine ? 'self-end' : 'ml-10 self-start')} />
      ))}
    </div>
  );
}
