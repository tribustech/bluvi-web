'use client';

import { useEffect, useState } from 'react';

const UNITS = [
  ['ZILE', 'zile'],
  ['ORE', 'ore'],
  ['MIN', 'minute'],
  ['SEC', 'secunde'],
] as const;

function remaining(end: number, now: number) {
  const diff = Math.max(0, end - now);
  return [
    Math.floor(diff / 86_400_000),
    Math.floor((diff % 86_400_000) / 3_600_000),
    Math.floor((diff % 3_600_000) / 60_000),
    Math.floor((diff % 60_000) / 1000),
  ];
}

/**
 * fish useCountdownToDate + FlipCountdownUnit: days / hours / minutes / seconds to the raffle's
 * end, ticking every second. The clock is read only after hydration (the server renders «--»).
 * Screen readers get one static sentence, not a live tick.
 */
export function RaffleCountdown({ end }: { end: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the clock starts after hydration
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const parts = now === null ? null : remaining(new Date(end).getTime(), now);

  return (
    <div className="mt-1.5 flex justify-center gap-1.5">
      <span className="sr-only">
        {parts ? `Închidere în ${parts[0]} zile, ${parts[1]} ore și ${parts[2]} minute` : 'Închidere în curând'}
      </span>
      {UNITS.map(([label], i) => {
        const v = parts ? String(parts[i]).padStart(2, '0') : '--';
        return (
          <span key={label} aria-hidden className="flex min-w-9 flex-col items-center gap-1">
            <span className="relative flex w-full overflow-hidden rounded-md border border-hairline bg-surface t-body tabular-nums text-ink-2">
              <span className="flex-1 py-1 text-center">{v[0]}</span>
              <span className="my-1 w-px bg-hairline" />
              <span className="flex-1 py-1 text-center">{v[1]}</span>
              <span className="absolute inset-x-0 top-1/2 h-px bg-hairline" />
            </span>
            <span className="t-label tracking-wide text-on-accent">{label}</span>
          </span>
        );
      })}
    </div>
  );
}
