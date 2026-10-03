'use client';

import { XMarkIcon } from '@heroicons/react/24/outline';
import { RankingTable } from '@/components/ranking';
import { useModalDialog } from '@/components/surfaces/useModalDialog';
import type { RankingTableData } from './ranking';

/**
 * fish «Vezi full» (/competitions/ranking-image: the whole table, every column) — on the web the
 * full table in a full-screen dialog; desktop's «Imagine clasament» opens the same view.
 */
export function FullRankingDialog({
  open,
  onClose,
  title,
  table,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  table: RankingTableData | null;
}) {
  const dialog = useModalDialog(open, onClose);
  return (
    <dialog
      {...dialog}
      aria-label={`Clasament complet, ${title}`}
      className="m-0 h-dvh max-h-none w-full max-w-none bg-page p-0 text-ink backdrop:bg-scrim open:flex open:flex-col"
    >
      <div className="flex items-center gap-3 bg-surface px-4 py-3 shadow-e1 md:px-6">
        <div className="min-w-0 flex-1">
          <p className="truncate t-heading">{title}</p>
          <p className="t-caption text-muted">Clasament complet</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Închide"
          className="flex size-10 shrink-0 items-center justify-center rounded-control text-ink-2 hover:bg-soft-fill"
        >
          <XMarkIcon aria-hidden className="size-5" />
        </button>
      </div>
      {open && table ? (
        <div className="min-h-0 flex-1 p-3 md:p-6">
          <RankingTable caption="Clasament complet" columns={table.columns} rows={table.rows} maxHeight="calc(100dvh - 112px)" />
        </div>
      ) : null}
    </dialog>
  );
}
