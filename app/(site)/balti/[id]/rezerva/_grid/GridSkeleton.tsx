import { cn } from '@/components/ui/cn';
import { GRID_CARD } from './BookingFrame';
import { CELL_H, HEADER_DAY_H, HEADER_H, PINNED_W } from './model';

/*
 * The grid's own geometry, empty (fish GridSkeleton, c27): header pills and chips, the frozen
 * column and 10 rows × 4 days of ghost bands — so the screen paints its final shape at once and
 * the data fills a frame already parsed. Static: no shimmer on the bands (fish: "motion for its own
 * sake"). The day width is the canonical 06/18 × 12h lake's: 120px on a phone. From 768 the ghost is
 * a desktop page (model.ts pageFit): its days fill the card's width — about 4 from 768, 5 from 1024,
 * 7 from 1280 — under the period navigation's placeholder, over the selection bar's.
 */

const ROWS = 10;
const DAYS = 8;
/** Days 5–8 only from 768. */
const extra = (d: number) => (d >= 4 ? 'hidden md:block' : undefined);
const at = (d: number, plus: string) => `calc(var(--day) * ${d} + ${plus})`;

export function GridSkeleton() {
  const days = Array.from({ length: DAYS }, (_, i) => i);
  return (
    <>
    <PeriodNavSkeleton />
    <div
      role="status"
      aria-label="Se încarcă disponibilitatea"
      data-testid="availability-skeleton"
      className={cn(
        '@container flex min-h-0 flex-1 flex-col overflow-hidden [--day:120px]',
        // The page's day width: the card's inner width (less the stand column) over the days a page holds.
        'md:[--day:calc((100cqw-var(--spacing)*14)/4)] lg:[--day:calc((100cqw-var(--spacing)*14)/5)] xl:[--day:calc((100cqw-var(--spacing)*14)/7)]',
        GRID_CARD,
      )}
    >
      <div aria-hidden className="flex shrink-0 border-b border-hairline" style={{ height: HEADER_H }}>
        <div className="shrink-0 border-r border-hairline" style={{ width: PINNED_W }} />
        <div className="relative flex-1 overflow-hidden">
          {days.map(d => (
            <span key={d} className={extra(d)}>
              <span className="absolute rounded-control bg-accent-tint" style={{ left: at(d, '3px'), width: 'calc(var(--day) - 6px)', top: 4, height: HEADER_DAY_H - 8 }} />
              {[0, 1].map(h => (
                <span
                  key={h}
                  className="absolute h-4 rounded-full bg-soft-fill"
                  style={{ left: at(d, `var(--day) * ${h / 2} + 12px`), width: 'calc(var(--day) / 2 - 24px)', top: HEADER_DAY_H + 6 }}
                />
              ))}
            </span>
          ))}
        </div>
      </div>
      <div aria-hidden className="min-h-0 flex-1 overflow-hidden">
        {Array.from({ length: ROWS }, (_, r) => (
          <div key={r} className="flex" style={{ height: CELL_H }}>
            <div className="flex shrink-0 items-center justify-center border-r border-b border-hairline" style={{ width: PINNED_W }}>
              <span className="h-3 w-3.5 rounded-sm bg-soft-fill" />
            </div>
            <div className="relative flex-1 overflow-hidden border-b border-hairline">
              {days.flatMap(d =>
                [0, 1].map(h => (
                  <span
                    key={`${d}-${h}`}
                    className={cn('absolute rounded-md bg-soft-fill', extra(d))}
                    style={{ left: at(d, `var(--day) * ${h / 2} + 1.5px`), width: 'calc(var(--day) / 2 - 3px)', top: 1.5, height: CELL_H - 4 }}
                  />
                ))
              )}
            </div>
          </div>
        ))}
      </div>
      {/* The selection bar's one-line hint (from 768). */}
      <div aria-hidden className="hidden shrink-0 items-center border-t border-hairline px-4 py-3 md:flex lg:px-5">
        <span className="h-6 w-2/3 max-w-140 rounded-full bg-soft-fill" />
      </div>
    </div>
    </>
  );
}

/** The period navigation (‹ period ›, «Azi»), empty — from 768, over the grid (PeriodNav). */
export function PeriodNavSkeleton() {
  return (
    <div aria-hidden className="hidden shrink-0 items-center justify-center pb-3 md:flex">
      <span className="h-9 w-72 rounded-full bg-soft-fill" />
    </div>
  );
}

