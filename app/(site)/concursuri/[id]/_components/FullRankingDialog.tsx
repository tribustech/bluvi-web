'use client';

import { useMemo, type ReactNode } from 'react';
import { PhotoIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { ButtonLink } from '@/components/ui/Button';
import { IconButton } from '@/components/nav/IconButton';
import { RankingFace } from '@/components/ranking/RankingFace';
import { useModalDialog } from '@/components/surfaces/useModalDialog';
import { cn } from '@/components/ui/cn';
import type { RankingTableData } from './ranking';
import { FishTable } from './FishTable';
import { standardFishRows } from './MobileRanking';
import { useRankingFaces } from './rankingFaces';
import { RANKING_TABLE_FIXES } from './tableFixes';

/**
 * fish «Vezi full» (/competitions/ranking-image: the whole table, every column) — on the web the
 * full table on the whole screen, fish's table at every width (FishTable; `wide` from 768, owner
 * 2026-10-11); the header's «Clasament complet» opens the same view.
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
  imageHref,
  onImage,
  currentUserStandId = null,
  children,
}: {
  /** The viewer's stand: from 768 their row is marked and prefixed «Tu · », as in the inline table. */
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
  /** The rows in the order the page shows them (fish Sortare: stand by default). */
  table: RankingTableData | null;
  /** A ranking the shared table does not draw (feeder legs, the club ranking): its own table. */
  children?: ReactNode;
}) {
  const dialog = useModalDialog(open, onClose);
  const faces = useRankingFaces();
  const phoneRows = useMemo(() => (table ? standardFishRows(table.columns, table.rows) : []), [table]);
  const wideRows = useMemo(
    () =>
      table
        ? standardFishRows(
            table.columns,
            table.rows,
            row => <RankingFace name={row.participant} face={faces.byStand.get(String(row.standId))} />,
            currentUserStandId,
          )
        : [],
    [table, faces, currentUserStandId],
  );
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
      {open && children ? children : null}
      {open && table && !children ? (
        <FullFishTables
          phone={<FishTable caption="Clasament complet" columns={table.columns} rows={phoneRows} />}
          wide={<FishTable wide caption="Clasament complet" columns={table.columns} rows={wideRows} />}
        />
      ) : null}
    </dialog>
  );
}

/**
 * The dialog's body: the phone's table below 768, the `wide` one from 768 in a card as wide as the
 * table, centred (ROADMAP §4b.16: the rest is margin); the body scrolls (the header row with it, as
 * fish's table).
 */
export function FullFishTables({ phone, wide }: { phone: ReactNode; wide: ReactNode }) {
  return (
    <div className={cn('min-h-0 flex-1 overflow-y-auto md:p-6', RANKING_TABLE_FIXES)}>
      <div className="pt-3 md:hidden">{phone}</div>
      <div className="mx-auto w-fit max-w-full overflow-clip rounded-card bg-surface shadow-e0 max-md:hidden">{wide}</div>
    </div>
  );
}
