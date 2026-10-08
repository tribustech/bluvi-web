'use client';

import { CameraIcon, TrashIcon } from '@heroicons/react/24/outline';
import { isOptimisticCatchId, type WeighingDetailCatch } from '@/core/organizer';
import { cn } from '@/components/ui/cn';
import { kg } from './model';

/*
 * c4/c5 (fish add.tsx CatchCard): the catches in the CMS's order — newest first — numbered «n.», the
 * species and its weight «x,xxx kg». A table at every width (owner rule 12: a coloured header row,
 * row separators), compact (rule 16): # · Specie · Greutate · (media) · (Șterge).
 *  - The delete column exists only while the viewer may act (c5); an optimistic row (not confirmed
 *    by the CMS yet) has no delete and says «Se confirmă…» instead.
 *  - Empty: «Acest cântar nu conține nicio captură.»
 */
export function CatchList({
  catches,
  canDelete,
  onDelete,
}: {
  catches: WeighingDetailCatch[];
  canDelete: boolean;
  onDelete: (c: WeighingDetailCatch, index: number) => void;
}) {
  if (catches.length === 0) {
    return (
      <p className="t-body-strong text-muted" data-testid="catches-empty">
        Acest cântar nu conține nicio captură.
      </p>
    );
  }
  const hasMedia = catches.some((c) => c.media.length > 0);
  return (
    <div className="overflow-hidden rounded-card border border-hairline xl:max-w-170">
      <table className="w-full border-collapse" data-testid="catches">
        <caption className="sr-only">Capturile cântarului, cele mai noi primele</caption>
        <thead className="bg-accent-tint">
          <tr className="t-label text-accent-ink">
            <th scope="col" className="w-10 py-2.5 pr-1 pl-3 text-left md:pl-4">
              #
            </th>
            <th scope="col" className="py-2.5 pr-2 text-left">
              Specie
            </th>
            <th scope="col" className="py-2.5 pr-3 text-right md:pr-4">
              Greutate
            </th>
            {hasMedia ? (
              <th scope="col" className="hidden py-2.5 pr-3 text-left md:table-cell">
                Media
              </th>
            ) : null}
            {canDelete ? (
              <th scope="col" className="w-14 py-2.5 pr-2 md:w-16">
                <span className="sr-only">Acțiuni</span>
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline bg-surface">
          {catches.map((c, i) => {
            const optimistic = isOptimisticCatchId(c.documentId);
            const name = c.fishType?.Name || 'Specie necunoscută';
            return (
              <tr key={c.documentId} data-testid="catch-row" data-optimistic={optimistic || undefined} className={cn(optimistic && 'bg-soft-fill/60')}>
                <td className="t-caption py-3 pr-1 pl-3 text-muted tabular-nums md:pl-4">{i + 1}.</td>
                <td className="py-3 pr-2">
                  <span className="t-body-strong text-ink">{name}</span>
                  {optimistic ? (
                    <span className="t-caption block text-muted" data-testid="catch-pending">
                      Se confirmă…
                    </span>
                  ) : null}
                </td>
                <td className="py-3 pr-3 text-right whitespace-nowrap md:pr-4">
                  <span className="t-body-strong text-accent-ink tabular-nums">{kg(c.weight)}</span>
                  <span className="t-caption ms-1 text-muted">kg</span>
                </td>
                {hasMedia ? (
                  <td className="hidden py-3 pr-3 md:table-cell">
                    {c.media.length > 0 ? (
                      <span className="t-caption inline-flex items-center gap-1 text-muted">
                        <CameraIcon aria-hidden className="size-4" />
                        {c.media.length === 1 ? '1 foto' : `${c.media.length} foto`}
                      </span>
                    ) : null}
                  </td>
                ) : null}
                {canDelete ? (
                  <td className="py-1.5 pr-2 text-right">
                    {optimistic ? null : (
                      <button
                        type="button"
                        onClick={() => onDelete(c, i)}
                        aria-label={`Șterge captura ${i + 1}: ${name}, ${kg(c.weight)} kg`}
                        className="inline-flex size-12 items-center justify-center rounded-control bg-status-danger-bg text-status-danger-fg transition-[filter] duration-(--duration-fast) hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent xl:size-10"
                      >
                        <TrashIcon aria-hidden className="size-5" />
                      </button>
                    )}
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
