'use client';

import { NoSymbolIcon, TrophyIcon } from '@heroicons/react/24/outline';
import { formatHHmm, formatMonthAbbr, type BlockInfo } from '@/core/booking';
import { ResponsiveSurface } from '@/components/surfaces/ResponsiveSurface';
import { Button, ButtonLink } from '@/components/ui/Button';
import { routes } from '@/lib/routes';
import { blockTitle } from './model';

/*
 * Why a slot cannot be booked, for the blocks that have something to say — fish
 * CompetitionBlockSheet (c17): a competition (the whole lake, every stand) or an operator's note on
 * a manual block. A competition also offers a way in: anglers who find the lake closed usually want
 * to know what is happening there. Plain blocks never open it (c18).
 */

/** «3 iun, 06:00» — fish `format(d, "d MMM, HH:mm", { locale: ro })`. */
export const blockStamp = (iso: string) => {
  const d = new Date(iso);
  return `${d.getDate()} ${formatMonthAbbr(d)}, ${formatHHmm(d)}`;
};

/** `block` is retained by the caller through the closing animation; `open` drives the surface. */
export function BlockDialog({ open, block, onClose }: { open: boolean; block: BlockInfo | null; onClose: () => void }) {
  const competition = block?.reason === 'competition';
  const text = block
    ? competition
      ? `Balta e rezervată integral pentru concurs, toate standurile, între ${blockStamp(block.start)} și ${blockStamp(block.end)}.`
      : `Indisponibil între ${blockStamp(block.start)} și ${blockStamp(block.end)}.`
    : '';
  return (
    <ResponsiveSurface
      open={open && !!block}
      onClose={onClose}
      intent="info"
      title={block ? blockTitle(block) : 'Indisponibil'}
      subtitle={competition ? 'Concurs' : undefined}
      sheetSnap="fit"
      actions={
        <>
          {block?.competitionId ? (
            <ButtonLink href={routes.competition(block.competitionId)} icon={<TrophyIcon />}>
              Vezi concursul
            </ButtonLink>
          ) : null}
          <Button variant={block?.competitionId ? 'secondary' : 'primary'} onClick={onClose}>
            Am înțeles
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-3" data-testid="block-body">
        <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-tint text-accent-ink">
          {competition ? <TrophyIcon className="size-6" /> : <NoSymbolIcon className="size-6" />}
        </span>
        <p className="t-body text-muted">{text}</p>
      </div>
    </ResponsiveSurface>
  );
}
