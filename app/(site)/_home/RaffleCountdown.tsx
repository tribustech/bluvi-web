'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

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
 *
 * At zero the clock stops and the page is re-rendered once (router.refresh): the server decides
 * «ended» (RaffleCard), so the card swaps to its ended state and its CTA instead of freezing on
 * 00 00 00 00 with «Înscrie-te» still live. Once only — a server clock a little behind must not
 * loop the refresh, and the two compositions (both mount the card) share the once.
 *
 * The digits are the card's signature number (t-num-18, ink). fish's flip card is drawn as two
 * tinted halves BEHIND the digits — never a hairline across them, which read as struck-through.
 */
/** Ends already refreshed for, in this page's life. */
const refreshedEnds = new Set<string>();

export function RaffleCountdown({ end }: { end: string }) {
  const router = useRouter();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const endAt = new Date(end).getTime();
    let id: ReturnType<typeof setInterval> | undefined;
    const tick = () => {
      const t = Date.now();
      setNow(t);
      if (t < endAt) return;
      clearInterval(id);
      if (!refreshedEnds.has(end)) {
        refreshedEnds.add(end);
        router.refresh();
      }
    };
    tick();
    // An already elapsed end needs no clock.
    if (Date.now() < endAt) id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [end, router]);
  const parts = now === null ? null : remaining(new Date(end).getTime(), now);

  return (
    <div className="mt-1.5 flex justify-center gap-1.5">
      <span className="sr-only">
        {!parts
          ? 'Închidere în curând'
          : parts.every((p) => p === 0)
            ? 'Tombola s-a încheiat'
            : `Închidere în ${parts[0]} zile, ${parts[1]} ore și ${parts[2]} minute`}
      </span>
      {UNITS.map(([label], i) => {
        const v = parts ? String(parts[i]).padStart(2, '0') : '--';
        return (
          <span key={label} aria-hidden className="flex min-w-11 flex-col items-center gap-1">
            <span className="w-full rounded-control bg-linear-to-b from-surface from-50% to-soft-fill to-50% px-1.5 py-1.5 text-center t-num-18 text-ink">
              {v}
            </span>
            <span className="t-label tracking-wide text-on-accent">{label}</span>
          </span>
        );
      })}
    </div>
  );
}
