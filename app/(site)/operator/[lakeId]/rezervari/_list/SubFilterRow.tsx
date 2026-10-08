'use client';

import { filterChipClass } from '@/components/templates/T1';
import { BUCKET_LABELS, type OperatorBucket, type OperatorSub } from '@/core/booking';
import { subChips } from './model';

/**
 * c4 — the bucket's sub-filters as a horizontal chip row (owner rule 2; fish SubFilterRow), only for
 * Confirmate and Nefinalizate, led by «Toate» (the unfiltered view). Quieter than the tabs above it
 * (fish: two rows of pills would read as two competing tab sets). Below the tabs on every bucket a
 * 12px breath keeps the chrome's height steady where there are no chips.
 */
export function SubFilterRow({
  bucket,
  sub,
  onSub,
}: {
  bucket: OperatorBucket;
  sub: OperatorSub | undefined;
  onSub: (s: OperatorSub | undefined) => void;
}) {
  const chips = subChips(bucket);
  if (!chips.length) return <div aria-hidden className="h-3" />;
  return (
    <div
      role="group"
      aria-label={`Filtru ${BUCKET_LABELS[bucket]}`}
      data-testid="inbox-subs"
      className="-mx-4 flex gap-2 overflow-x-auto px-4 py-3 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden"
    >
      {chips.map((c) => {
        const active = c.key === sub;
        return (
          <button key={c.key ?? 'toate'} type="button" aria-pressed={active} onClick={() => onSub(c.key)} className={filterChipClass({ active })}>
            {c.label}
          </button>
        );
      })}
    </div>
  );
}
