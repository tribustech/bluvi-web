'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { agoLabel, clock } from './model';

/*
 * The desktop views' client helpers: a ticking clock (relative times render after hydration, so the
 * server and the first client paint agree), the reduced-motion and desktop media queries, and a
 * digit roll (NumberFlow-like, no dependency).
 */

/** `Date.now()` that ticks every `everyMs`; null on the server and the hydration pass. */
export function useNow(everyMs = 30_000): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, everyMs);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [everyMs]);
  return now;
}

const subscribeTo = (query: string) => (cb: () => void) => {
  const m = window.matchMedia(query);
  m.addEventListener('change', cb);
  return () => m.removeEventListener('change', cb);
};

const RM = '(prefers-reduced-motion: reduce)';
const subscribeRM = subscribeTo(RM);
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribeRM, () => window.matchMedia(RM).matches, () => false);
}

const LG = '(min-width: 64rem)';
const subscribeLG = subscribeTo(LG);
/**
 * ≥1024 (Tailwind `lg`): the desktop tab views are on screen. Their extra reads (rankings,
 * weighings, registrations) wait for it, so a phone never pays for a view it does not show.
 */
export function useDesktop(): boolean {
  return useSyncExternalStore(subscribeLG, () => window.matchMedia(LG).matches, () => false);
}

/** «acum 3 min» once mounted; the wall-clock time before that (and as the tooltip). */
export function Ago({ iso, className }: { iso: string; className?: string }) {
  const now = useNow();
  return (
    <time dateTime={iso} title={clock(iso)} className={className} suppressHydrationWarning>
      {now == null ? clock(iso) : agoLabel(iso, now)}
    </time>
  );
}

/**
 * A number that rolls to its new value (600 ms, ease-out) — on first view from 0, then on every
 * change. Reduced motion: the value swaps instantly.
 */
export function Roll({ value, format, fromZero = true }: { value: number; format: (n: number) => string; fromZero?: boolean }) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(value);
  const from = useRef<number | null>(fromZero ? 0 : null);
  useEffect(() => {
    if (reduced) {
      const id = requestAnimationFrame(() => setShown(value));
      from.current = value;
      return () => cancelAnimationFrame(id);
    }
    const start = from.current ?? value;
    from.current = value;
    if (start === value) {
      const id = requestAnimationFrame(() => setShown(value));
      return () => cancelAnimationFrame(id);
    }
    const t0 = performance.now();
    let id = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / 600);
      const e = 1 - Math.pow(1 - p, 3);
      setShown(start + (value - start) * e);
      if (p < 1) id = requestAnimationFrame(step);
    };
    id = requestAnimationFrame(step);
    return () => cancelAnimationFrame(id);
  }, [value, reduced]);
  return (
    <span className="tabular-nums">
      <span className="sr-only">{format(value)}</span>
      <span aria-hidden>{format(shown)}</span>
    </span>
  );
}
