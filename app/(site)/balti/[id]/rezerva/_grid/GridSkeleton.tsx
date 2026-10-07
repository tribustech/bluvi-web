import { cn } from '@/components/ui/cn';
import { CELL_H, HEADER_DAY_H, HEADER_H, PINNED_W } from './model';

/*
 * The grid's own geometry, empty (fish GridSkeleton, c27): header pills and chips, the frozen
 * column and 10 rows × 4 days of ghost bands — so the screen paints its final shape at once and
 * the data fills a frame already parsed. Static: no shimmer on the bands (fish: "motion for its own
 * sake"). The day width is the canonical 06/18 × 12h lake's: 120px, 180 from 768 (model.ts scale);
 * from 768 the ghost runs 8 days so a wide column is not half empty.
 */

const ROWS = 10;
const DAYS = 8;
/** Days 5–8 only from 768. */
const extra = (d: number) => (d >= 4 ? 'hidden md:block' : undefined);
const at = (d: number, plus: string) => `calc(var(--day) * ${d} + ${plus})`;

export function GridSkeleton() {
  const days = Array.from({ length: DAYS }, (_, i) => i);
  return (
    <div
      role="status"
      aria-label="Se încarcă disponibilitatea"
      data-testid="availability-skeleton"
      className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-card border border-hairline bg-surface [--day:120px] md:[--day:180px]"
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
    </div>
  );
}
