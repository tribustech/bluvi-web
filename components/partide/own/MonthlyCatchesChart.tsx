import { cn } from '@/components/ui/cn';

/**
 * fish features/partide/components/MonthlyCatchesChart.tsx — «Capturi pe lună» (design 6a; parity
 * partide.ale-mele.c11): one column per month, the count above its bar, the month under it. The last
 * bar (this month) is the full accent, the one before it a lighter indigo, the rest the pale tint —
 * the eye goes to «now». A month with no catch keeps a 6px stub. Bars grow from the baseline left
 * to right when the chart mounts (staggered 40ms; none with reduced motion).
 *
 * Plain elements, no chart library. For a screen reader the chart is a list («IAN: 3 capturi»);
 * the drawing is hidden from it. `tall` triples the bar area (the 1280+ bento tile).
 */
const MAX_BAR = 59;
const MIN_BAR = 6;

export function MonthlyCatchesChart({ months, tall = false }: { months: { label: string; count: number }[]; tall?: boolean }) {
  const max = Math.max(1, ...months.map(m => m.count));
  const n = months.length;
  const area = tall ? MAX_BAR * 3 : MAX_BAR;
  return (
    <div data-testid="monthly-chart">
      <ul className="sr-only">
        {months.map((m, i) => (
          <li key={m.label + i}>
            {m.label}: {m.count} {m.count === 1 ? 'captură' : 'capturi'}
          </li>
        ))}
      </ul>
      <div aria-hidden className="flex flex-col">
        <div className="flex items-end" style={{ height: area + 21 }}>
          {months.map((m, i) => {
            const last = i === n - 1;
            const beforeLast = i === n - 2;
            const h = Math.max(MIN_BAR, (m.count / max) * area);
            const delay = { transitionDelay: `${i * 40}ms` };
            return (
              <div key={m.label + i} className="flex min-w-0 flex-1 flex-col items-center gap-0.75" data-testid="chart-bar" data-count={m.count}>
                <span
                  className={cn(
                    't-micro-strong tabular-nums transition-opacity duration-(--duration-slow) starting:opacity-0 motion-reduce:transition-none',
                    last && m.count > 0 ? 'text-accent-ink' : 'text-muted',
                  )}
                  style={delay}
                >
                  {m.count}
                </span>
                <span
                  className={cn(
                    'block w-6.5 max-w-[70%] origin-bottom rounded-[4px] transition-transform duration-(--duration-slow) ease-out starting:scale-y-0 motion-reduce:transition-none',
                    last ? 'bg-accent' : beforeLast ? 'bg-indigo-4' : 'bg-accent-tint-3',
                    tall && 'w-9',
                  )}
                  style={{ height: h, ...delay }}
                />
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex">
          {months.map((m, i) => (
            <span key={m.label + i} className="min-w-0 flex-1 truncate text-center t-micro-strong text-muted">
              {m.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
