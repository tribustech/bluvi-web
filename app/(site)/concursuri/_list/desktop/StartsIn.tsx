'use client';

import { spanLabel } from './model';
import { useNow } from './motion';

/** «Începe în 2 zile 4 h» — ticks every minute; nothing until mounted (no server/client drift). */
export function StartsIn({ iso }: { iso: string }) {
  const now = useNow(60_000);
  if (now == null) return null;
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return null;
  return (
    <span className="inline-flex items-center rounded-full bg-accent-tint-2 px-2 py-0.5 t-micro-strong text-accent-ink normal-case tabular-nums">
      Începe în {spanLabel(ms)}
    </span>
  );
}
