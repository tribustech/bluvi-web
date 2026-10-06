'use client';

import { useRef, type ReactNode } from 'react';
import { PhotoIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { ButtonLink } from '@/components/ui/Button';
import { IconButton } from '@/components/nav/IconButton';
import { useModalDialog } from '@/components/surfaces/useModalDialog';
import { cn } from '@/components/ui/cn';
import type { RankingTableData } from './ranking';
import { CompetitionRankingTable, type RankingInitialSort } from './CompetitionRankingTable';
import { useMyStandId } from './rankingShell';
import { GENERAL_TABLE_LAYOUT, RANKING_TABLE_FIXES, STICKY_HEAD_DIALOG, useTablePins } from './tableFixes';

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
  subtitle = 'Clasament complet',
  table,
  initialSort = 'stand',
  imageHref,
  onImage,
  currentUserStandId,
  children,
}: {
  /**
   * The viewer's stand: their row is marked and prefixed «Tu · », as in the inline table. Left out,
   * it is read from the page (the competition's registrations and the session: useMyStandId).
   */
  currentUserStandId?: string | null;
  /**
   * fish «Vezi full» opens the ranking IMAGE (competition-page.imagine-clasament): on the web the
   * full table opens here, and «Imagine» goes on to the image of this same table.
   */
  imageHref?: string;
  /** fish ranking_image_pressed. */
  onImage?: () => void;
  open: boolean;
  onClose: () => void;
  title: string;
  /** What the table is («Clasament complet», «Manșa 2», «Sector B»). */
  subtitle?: string;
  table: RankingTableData | null;
  /** The order the table opens in: the phone's Sortare (fish: stand by default). */
  initialSort?: RankingInitialSort;
  /** A ranking the shared table does not draw (feeder legs, the club ranking): its own table. */
  children?: ReactNode;
}) {
  const dialog = useModalDialog(open, onClose);
  const hostRef = useRef<HTMLDivElement>(null);
  // fish RankingTable: the stand stays put while the other columns scroll sideways (parity
  // clasament.c22) — Loc and Stand pinned, as the inline table. Only the «wide» half of the layout:
  // without a data-wide attribute the «fits» rules (no inner scroll box) never apply here, so the
  // table keeps scrolling inside the dialog.
  const pins = useTablePins(hostRef, table?.columns ?? [], open && table ? table.rows.length : 0);
  const mine = useMyStandId();
  const myStandId = currentUserStandId === undefined ? mine.standId : currentUserStandId;
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
          <p className="t-caption text-muted">{subtitle}</p>
        </div>
        {imageHref ? (
          <ButtonLink href={imageHref} variant="secondary" size="compact" icon={<PhotoIcon />} onClick={onImage} aria-label="Imagine clasament">
            <span className="max-md:sr-only">Imagine clasament</span>
          </ButtonLink>
        ) : null}
        <IconButton aria-label="Închide" onClick={onClose}>
          <XMarkIcon aria-hidden />
        </IconButton>
      </div>
      {currentUserStandId === undefined ? mine.probe : null}
      {open && children ? <div className="flex min-h-0 flex-1 flex-col p-3 md:p-6 [&>*]:max-h-full">{children}</div> : null}
      {open && table && !children ? (
        <div
          ref={hostRef}
          data-wide={pins.wide ? 'true' : undefined}
          data-fade={pins.wide && pins.fade ? 'true' : undefined}
          style={pins.style}
          // The table is as wide as its columns (ROADMAP §4b.16): centred, the rest is margin.
          className={cn('min-h-0 flex-1 p-3 md:p-6 [&>[role=region]]:mx-auto', RANKING_TABLE_FIXES, GENERAL_TABLE_LAYOUT, STICKY_HEAD_DIALOG)}
        >
          <CompetitionRankingTable
            caption="Clasament complet"
            columns={table.columns}
            rows={table.rows}
            currentUserStandId={myStandId}
            maxHeight="100%"
            initialSort={initialSort}
          />
        </div>
      ) : null}
    </dialog>
  );
}
