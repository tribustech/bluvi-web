'use client';

import Link from 'next/link';
import { ArrowPathIcon, ArrowRightIcon, ClockIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { TileChevron } from '@/components/templates/T6/TileChevron';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/components/ui/cn';
import { formatWeighingKg, type WeighingRow } from './model';

/*
 * One weighing below 1280 (fish components/scale/CantarItem.tsx, parity organizer.scale-history c4/c5/c7):
 * «Cântar N» (+ «(Extra)»), the «Terminat» / «În curs» badge (fish indigo / solid indigo; fish's
 * «In curs» gets its diacritic), «Total: x,xxx kg» and «Capturi: n», then start → end
 * («dd.MM, HH:mm», the end «În curs» while open). The card opens the weighing (c5).
 * A weighing that can be deleted (empty, unfinished, actions allowed) carries fish's red ✕ at its
 * corner (c7) — a sibling of the link, never a button inside it.
 */

export function WeighingCard({
  row,
  href,
  deletable,
  deleting,
  onDelete,
  onNavigate,
}: {
  row: WeighingRow;
  href: string;
  deletable: boolean;
  deleting: boolean;
  onDelete: () => void;
  /** The navigation guard (a repeat activation within 800 ms is ignored). */
  onNavigate: (event: { preventDefault: () => void }) => void;
}) {
  return (
    <li className="relative flex" data-testid={`weighing-${row.id}`}>
      <Link
        href={href}
        onClick={onNavigate}
        aria-label={`${row.title}, ${row.finished ? 'terminat' : 'în curs'}, ${formatWeighingKg(row.totalKg)} kg, ${row.catches} ${row.catches === 1 ? 'captură' : 'capturi'}`}
        className={cn(
          'flex min-w-0 flex-1 items-stretch gap-2 rounded-card border border-hairline bg-surface p-4',
          'transition-colors duration-(--duration-fast) ease-fast hover:bg-soft-fill',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        )}
      >
        <span className="flex min-w-0 flex-1 flex-col gap-2">
          <span className={cn('flex items-center gap-2', deletable && 'pr-5')}>
            <span className="t-heading min-w-0 flex-1 text-ink">{row.title}</span>
            <StatusBadge finished={row.finished} />
          </span>
          <span className="flex items-baseline justify-between gap-3">
            <span className="t-body text-muted">
              Total:{' '}
              <span className="t-body-strong whitespace-nowrap text-accent-ink tabular-nums">
                {formatWeighingKg(row.totalKg)}
                <span className="t-caption ml-1 text-muted">kg</span>
              </span>
            </span>
            <span className="t-body text-muted">
              Capturi: <span className="t-body-strong text-accent-ink tabular-nums">{row.catches}</span>
            </span>
          </span>
          <Interval row={row} />
        </span>
        <TileChevron />
      </Link>
      {deletable ? (
        <button
          type="button"
          onClick={onDelete}
          disabled={deleting}
          aria-busy={deleting || undefined}
          aria-label={`Șterge ${row.title}`}
          data-testid={`delete-${row.id}`}
          // fish: a 20px red disc at the corner with a 40px hit area around it.
          className="absolute -top-3 -right-3 flex size-10 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-60"
        >
          <span aria-hidden className="flex size-6 items-center justify-center rounded-full bg-status-danger-fg text-surface shadow-e1">
            {deleting ? <ArrowPathIcon className="size-3.5 motion-safe:animate-spin" /> : <XMarkIcon className="size-3.5" strokeWidth={2.5} />}
          </span>
        </button>
      ) : null}
    </li>
  );
}

/** fish Badge: «Terminat» indigo, «În curs» solid indigo. */
export function StatusBadge({ finished }: { finished: boolean }) {
  return <Badge color={finished ? 'indigo' : 'solidIndigo'}>{finished ? 'Terminat' : 'În curs'}</Badge>;
}

/** fish's clock line: start → end («În curs» while open). */
export function Interval({ row, className }: { row: WeighingRow; className?: string }) {
  return (
    <span className={cn('t-caption flex items-center gap-2 text-muted tabular-nums', className)}>
      <ClockIcon aria-hidden className="size-4 shrink-0" />
      <span>{row.start || '–'}</span>
      <ArrowRightIcon aria-hidden className="size-3 shrink-0" />
      <span className={row.open ? 'text-accent-ink' : undefined}>{row.end}</span>
    </span>
  );
}
