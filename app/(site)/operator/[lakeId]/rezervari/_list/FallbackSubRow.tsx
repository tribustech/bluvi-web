'use client';

import { useSyncExternalStore } from 'react';
import { PILL_H } from '@/components/templates/T1';
import { cn } from '@/components/ui/cn';
import { parseInboxPlace, STATUS_PARAM, SUB_PARAM, subChips } from './model';

const noop = () => () => {};
/** The bucket the URL lands on, read in the browser (the fallback has no searchParams of its own). */
function chipCountNow(): number {
  const q = new URLSearchParams(window.location.search);
  return subChips(parseInboxPlace(q.get(STATUS_PARAM), q.get(SUB_PARAM)).bucket).length;
}
/** The server's guess: the default place (no ?status — the panel's «Vezi toate», Acasă) is Confirmate · Azi. */
const DEFAULT_CHIPS = subChips(parseInboxPlace(undefined, undefined).bucket).length;

/**
 * The fallback's twin of ./SubFilterRow: the chip row's bones in the same py-3 box for the buckets
 * that have chips (Confirmate, Nefinalizate — and every legacy ?status that lands on them), the 12px
 * breath for the others (?status=pending|all) — so the list skeleton does not jump when the real
 * chrome mounts.
 */
export function FallbackSubRow() {
  const count = useSyncExternalStore(noop, chipCountNow, () => DEFAULT_CHIPS);
  if (!count) return <div aria-hidden data-testid="inbox-fallback-subs" data-chips="0" className="h-3" />;
  return (
    <div aria-hidden data-testid="inbox-fallback-subs" data-chips={count} className="-mx-4 flex gap-2 overflow-hidden px-4 py-3 md:mx-0 md:px-0">
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className={cn(PILL_H, 'shrink-0 animate-shimmer rounded-full', i === 0 ? 'w-16' : 'w-22')} />
      ))}
    </div>
  );
}
