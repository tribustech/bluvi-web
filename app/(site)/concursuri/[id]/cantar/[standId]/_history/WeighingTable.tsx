'use client';

import Link from 'next/link';
import { ArrowPathIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { RANKING_HEAD } from '@/components/ranking/tableHead';
import { cn } from '@/components/ui/cn';
import { canDeleteWeighing, formatWeighingKg, type WeighingRow } from './model';
import { StatusBadge } from './WeighingCard';

/*
 * The stand's weighings from 1280 (owner rule 14: not the phone's cards stretched). Every column
 * visible — Cântar, Început, Sfârșit, Capturi, Kg, Stare — under the ranking tables' coloured header
 * row (rule 12). It spans the task card (the card is the main column, full width as the owner asks;
 * a capped table left a half-empty card at 1440/1920), the columns sharing the width in proportion.
 * The selected row is accent-tint-2 + the left bar: on accent-tint the indigo «Terminat» badge vanished.
 * A row selects the weighing for the side panel (click, or focus on its link); the «Cântar N» link
 * opens the weighing (c5). An empty, unfinished weighing has the delete ✕ in its last cell (c7).
 */

const TH = 't-label px-3 py-2.5 text-left whitespace-nowrap';
const TD = 'border-t border-hairline px-3 py-2.5 align-middle';

export function WeighingTable({
  rows,
  selected,
  onSelect,
  hrefFor,
  actionsAllowed,
  deletingId,
  onDelete,
  onNavigate,
}: {
  rows: WeighingRow[];
  selected: string | null;
  onSelect: (id: string) => void;
  hrefFor: (id: string) => string;
  actionsAllowed: boolean;
  deletingId: string | null;
  onDelete: (row: WeighingRow) => void;
  onNavigate: (event: { preventDefault: () => void }) => void;
}) {
  const anyDeletable = rows.some((r) => canDeleteWeighing(r, actionsAllowed));
  return (
    <div className="overflow-hidden rounded-card border border-hairline">
      <table className="w-full table-fixed border-collapse" data-testid="weighing-table">
        <caption className="sr-only">Cântările standului</caption>
        <colgroup>
          <col className="w-[24%]" />
          <col className="w-[18%]" />
          <col className="w-[18%]" />
          <col className="w-[12%]" />
          <col className="w-[14%]" />
          <col className="w-[14%]" />
          {anyDeletable ? <col className="w-14" /> : null}
        </colgroup>
        <thead className={RANKING_HEAD}>
          <tr>
            <th scope="col" className={TH}>
              Cântar
            </th>
            <th scope="col" className={TH}>
              Început
            </th>
            <th scope="col" className={TH}>
              Sfârșit
            </th>
            <th scope="col" className={cn(TH, 'text-right')}>
              Capturi
            </th>
            <th scope="col" className={cn(TH, 'text-right')}>
              Kg
            </th>
            <th scope="col" className={TH}>
              Stare
            </th>
            {anyDeletable ? (
              <th scope="col" className={TH}>
                <span className="sr-only">Acțiuni</span>
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isSelected = row.id === selected;
            const deletable = canDeleteWeighing(row, actionsAllowed);
            return (
              <tr
                key={row.id}
                data-testid={`weighing-row-${row.id}`}
                data-selected={isSelected || undefined}
                onClick={() => onSelect(row.id)}
                className={cn(
                  'cursor-pointer transition-colors duration-(--duration-fast)',
                  isSelected ? 'bg-accent-tint-2' : 'bg-surface hover:bg-soft-fill',
                )}
              >
                <td className={cn(TD, 'relative')}>
                  {isSelected ? <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-accent" /> : null}
                  <Link
                    href={hrefFor(row.id)}
                    onFocus={() => onSelect(row.id)}
                    onClick={(e) => {
                      e.stopPropagation();
                      onNavigate(e);
                    }}
                    className="t-body-strong rounded-control text-ink underline-offset-4 hover:text-accent-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    {row.title}
                  </Link>
                </td>
                <td className={cn(TD, 't-body text-ink-2 tabular-nums')}>{row.start || '–'}</td>
                <td className={cn(TD, 't-body tabular-nums', row.open ? 'text-accent-ink' : 'text-ink-2')}>{row.end}</td>
                <td className={cn(TD, 't-body text-right text-ink tabular-nums')}>{row.catches}</td>
                <td className={cn(TD, 't-body-strong text-right text-ink tabular-nums')}>{formatWeighingKg(row.totalKg)}</td>
                <td className={TD}>
                  <StatusBadge finished={row.finished} />
                </td>
                {anyDeletable ? (
                  <td className={cn(TD, 'py-1 text-right')}>
                    {deletable ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(row);
                        }}
                        disabled={deletingId === row.id}
                        aria-busy={deletingId === row.id || undefined}
                        aria-label={`Șterge ${row.title}`}
                        data-testid={`delete-${row.id}`}
                        className="inline-flex size-9 items-center justify-center rounded-full hover:bg-status-danger-bg focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-60"
                      >
                        <span aria-hidden className="flex size-6 items-center justify-center rounded-full bg-status-danger-fg text-surface">
                          {deletingId === row.id ? (
                            <ArrowPathIcon className="size-3.5 motion-safe:animate-spin" />
                          ) : (
                            <XMarkIcon className="size-3.5" strokeWidth={2.5} />
                          )}
                        </span>
                      </button>
                    ) : null}
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
