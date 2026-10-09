'use client';

import { memo, useId } from 'react';
import { TrashIcon } from '@heroicons/react/24/outline';
import { FOCUS_RING } from '@/components/templates/T1';
import { cn } from '@/components/ui/cn';
import type { BlockRow as BlockRowModel } from '@/core/booking';
import { BLOCK_TONE_CLASS, blockRowView } from './model';

/**
 * fish features/operator/BlockRow.tsx — one compact line per block group (c6–c8): the reason's
 * tinted square with its dot, the period, «{reason} · {scope}», the optional contact / note line
 * (2 lines max) and the trash (c9) at the right. Finished blocks are dimmed (c5): fish fades the
 * whole row to .55, which would take the text under AA contrast — here the tint fades and the text
 * steps down to muted. While its blocks
 * are being deleted the trash is a spinner (c10) and the row says so (aria-busy).
 *
 * The trash stays focusable while busy (aria-disabled, not disabled) so keyboard focus is not lost
 * to the page while the DELETEs run.
 */
function BlockRowComponent({
  row,
  past,
  deleting,
  locked,
  onDelete,
}: {
  row: BlockRowModel;
  past: boolean;
  deleting: boolean;
  /** Another row is being deleted: one delete at a time (fish runs them one after another too). */
  locked: boolean;
  onDelete: (row: BlockRowModel) => void;
}) {
  const v = blockRowView(row);
  const tone = BLOCK_TONE_CLASS[v.tone];
  const inert = deleting || locked;
  // Every trash is named «Șterge blocajul» (c9); its description says which block (WCAG 2.4.6).
  const id = useId();
  return (
    <div
      data-testid="block-row"
      data-block={row.documentIds.join(',')}
      data-reason={v.tone}
      aria-busy={deleting || undefined}
      data-past={past || undefined}
      className="flex items-center gap-3 px-3.5 py-3"
    >
      <span
        aria-hidden
        data-testid="block-tint"
        className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl', tone.bg, past && 'opacity-55')}
      >
        <span className={cn('size-2.5 rounded-full', tone.dot)} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p id={`${id}-period`} data-testid="block-period" className={cn('t-body-strong', past ? 'text-muted' : 'text-ink')}>
          {v.period}
        </p>
        <p id={`${id}-meta`} data-testid="block-meta" className="t-caption truncate text-muted">
          {v.meta}
        </p>
        {v.extra ? (
          <p data-testid="block-extra" className={cn('t-caption line-clamp-2', past ? 'text-muted' : 'text-ink-2')}>
            {v.extra}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        aria-label="Șterge blocajul"
        aria-describedby={`${id}-period ${id}-meta`}
        aria-disabled={inert || undefined}
        title="Șterge blocajul"
        data-testid="block-delete"
        onClick={() => {
          if (!inert) onDelete(row);
        }}
        className={cn(
          'flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted transition-colors duration-(--duration-fast) ease-fast',
          'hover:bg-status-danger-bg hover:text-status-danger-fg aria-disabled:cursor-default aria-disabled:hover:bg-transparent aria-disabled:hover:text-muted',
          'md:w-auto md:gap-1.5 md:rounded-control md:px-3',
          FOCUS_RING,
        )}
      >
        {deleting ? (
          <span
            data-testid="block-deleting"
            className="size-4.5 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none"
          />
        ) : (
          <TrashIcon aria-hidden className="size-4.5" strokeWidth={1.8} />
        )}
        {/* Desktop: the action reads as one (row actions visible), the name stays «Șterge blocajul». */}
        <span aria-hidden className="t-caption hidden md:inline">
          {deleting ? 'Se șterge…' : 'Șterge'}
        </span>
      </button>
    </div>
  );
}

export const BlockRow = memo(BlockRowComponent);
