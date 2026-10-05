'use client';

import { useRef } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { IconButton } from '@/components/nav/IconButton';
import { RankingTable } from '@/components/ranking';
import { useModalDialog } from '@/components/surfaces/useModalDialog';
import { cn } from '@/components/ui/cn';
import type { RankingTableData } from './ranking';
import { GENERAL_TABLE_LAYOUT, RANKING_TABLE_FIXES, useTablePins } from './tableFixes';

/**
 * fish «Vezi full» (/competitions/ranking-image: the whole table, every column) — on the web the
 * full table on the whole screen; the header's «Clasament complet» opens the same view.
 * TODO(kit): a `fullscreen` variant of surfaces/Dialog (it caps at 480px, Fundații «confirmări»)
 * would replace this <dialog>; until then it is driven by the kit's useModalDialog (top layer,
 * focus trap, Escape) and closed with the shell's IconButton.
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
  const hostRef = useRef<HTMLDivElement>(null);
  // fish RankingTable: the stand stays put while the other columns scroll sideways (parity
  // clasament.c22) — Loc and Stand pinned, as the inline table. Only the «wide» half of the layout:
  // without a data-wide attribute the «fits» rules (no inner scroll box) never apply here, so the
  // table keeps scrolling inside the dialog.
  const pins = useTablePins(hostRef, table?.columns ?? [], open && table ? table.rows.length : 0);
  return (
    <dialog
      {...dialog}
      aria-labelledby="clasament-complet-titlu"
      className="m-0 h-dvh max-h-none w-full max-w-none bg-page p-0 text-ink backdrop:bg-scrim open:flex open:flex-col"
    >
      <div className="flex items-center gap-3 border-b border-hairline bg-surface py-2 pr-2 pl-4 md:pl-6">
        <div className="min-w-0 flex-1">
          <h2 id="clasament-complet-titlu" className="truncate t-heading">
            {title}
          </h2>
          <p className="t-caption text-muted">Clasament complet</p>
        </div>
        <IconButton aria-label="Închide" onClick={onClose}>
          <XMarkIcon aria-hidden />
        </IconButton>
      </div>
      {open && table ? (
        <div
          ref={hostRef}
          data-wide={pins.wide ? 'true' : undefined}
          data-fade={pins.wide && pins.fade ? 'true' : undefined}
          style={pins.style}
          className={cn('min-h-0 flex-1 p-3 md:p-6', RANKING_TABLE_FIXES, GENERAL_TABLE_LAYOUT)}
        >
          <RankingTable caption="Clasament complet" columns={table.columns} rows={table.rows} maxHeight="100%" />
        </div>
      ) : null}
    </dialog>
  );
}
