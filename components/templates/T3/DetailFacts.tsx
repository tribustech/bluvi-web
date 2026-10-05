import type { ReactNode } from 'react';
import { cn } from '@/components/ui/cn';

/*
 * T3 facts — the key attributes of the thing (fish LakeCharacteristics: Suprafață, Adâncime,
 * Standuri pescuit, Regim, Tip, Loc de pescuit; on a competition: tip, clasament, taxă, locuri).
 *  - `grid`: fish tiles — two per row on the phone (three from 768), page-grey, radius 16 (the
 *    card radius every grey inset tile on a T3 page uses), a 24px outline icon (Fundații §05), value
 *    (bodyStrong), label (t-label, muted).
 *  - `list`: a definition list for a side column — label left, value right, hairlines between.
 * fish colours each characteristic icon; tokens have no such palette, so icons take the accent.
 */

export type DetailFact = { key: string; label: string; value: ReactNode; icon?: ReactNode };

export function DetailFacts({ facts, layout = 'grid', className }: { facts: DetailFact[]; layout?: 'grid' | 'list'; className?: string }) {
  if (!facts.length) return null;
  if (layout === 'list') {
    return (
      <dl className={cn('flex flex-col', className)}>
        {facts.map(f => (
          <div key={f.key} className="flex items-center gap-3 border-b border-hairline py-3 first:pt-0 last:border-b-0 last:pb-0">
            {/* The icon lives in the <dt>: a <dl> group may hold only dt / dd. */}
            <dt className="flex min-w-0 flex-1 items-center gap-3 t-body text-ink-2">
              {f.icon ? (
                <span aria-hidden className="flex size-6 shrink-0 items-center justify-center text-accent [&>svg]:size-6">
                  {f.icon}
                </span>
              ) : null}
              {f.label}
            </dt>
            <dd className="max-w-[60%] text-right t-body-strong">{f.value}</dd>
          </div>
        ))}
      </dl>
    );
  }
  return (
    <dl className={cn('grid grid-cols-2 gap-2.5 md:grid-cols-3', className)}>
      {facts.map(f => (
        <div key={f.key} className="flex flex-col rounded-card bg-page p-3">
          {/* dt first in the DOM (a valid group), drawn under the value: the value leads (fish). */}
          <dt className="order-last mt-0.5 t-label text-muted">{f.label}</dt>
          {/* The icon sits in the <dd> (a <dl> group may hold only dt / dd), above the value. */}
          <dd className="flex flex-col gap-2">
            {f.icon ? (
              <span aria-hidden className="flex size-6 items-center justify-center text-accent [&>svg]:size-6">
                {f.icon}
              </span>
            ) : null}
            <span className="line-clamp-2 t-body-strong">{f.value}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}
