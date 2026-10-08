import { cn } from '@/components/ui/cn';
import { AsideSkeleton } from '@/components/templates/T1';
import { BODY, CARD, COL, LIST_COLUMN, SIDE } from './layout';

/*
 * The first load (parity partide.spectator-capturi.c4; fish CatchListSkeleton rows={8}): the list's
 * own shape in grey — on the phone fish's rows (thumbnail, species and time, kg at the right), from
 * 768 the table with its real column head, from 1280 the summary card beside it. One status line
 * for screen readers.
 */

const BONE = 'animate-shimmer';

/** The table's first and last columns less the row's 20px side padding (their <col> includes it). */
const SKEL = { time: 'w-17', kg: 'w-23' } as const;

function Line({ className }: { className: string }) {
  return <span aria-hidden className={cn('block h-3 rounded-full bg-soft-fill', className)} />;
}

/** The subtitle line («Partidă la …») while the partidă is read, so the list does not move down when it lands. */
export function SubtitleBone() {
  return (
    <span aria-hidden className="relative inline-block w-40 align-top">
      &nbsp;
      <span className={cn('absolute inset-x-0 top-1/2 h-[0.62em] -translate-y-1/2 rounded-full', BONE)} />
    </span>
  );
}

export function CatchesListSkeleton({ rows = 8 }: { rows?: number }) {
  const items = Array.from({ length: rows }, (_, i) => i);
  return (
    <div role="status" data-testid="catches-skeleton" className={CARD}>
      <span className="sr-only">Se încarcă capturile…</span>
      {/* Phone: fish's rows. */}
      <ul aria-hidden className="divide-y divide-hairline md:hidden">
        {items.map(i => (
          <li key={i} className="flex items-center gap-3 px-4 py-2.75">
            <span className={cn('size-11 shrink-0 rounded-control', BONE)} />
            <span className="flex flex-1 flex-col gap-2">
              <Line className="w-24" />
              <Line className="h-2.5 w-12" />
            </span>
            <Line className="w-14" />
          </li>
        ))}
      </ul>
      {/* From 768: the table, its head real. */}
      <div aria-hidden className="hidden md:block">
        <div className="flex items-center border-b border-hairline bg-page px-5 py-2.5 t-label text-muted">
          <span className={SKEL.time}>Ora</span>
          <span className={COL.photo}>Foto</span>
          <span className="flex-1">Specie</span>
          <span className={cn(SKEL.kg, 'text-right')}>Greutate</span>
        </div>
        <ul className="divide-y divide-hairline">
          {items.map(i => (
            <li key={i} className="flex items-center px-5 py-2.75">
              <span className={SKEL.time}>
                <Line className="w-11" />
              </span>
              <span className={COL.photo}>
                <span className={cn('block size-11 rounded-control', BONE)} />
              </span>
              <span className="flex-1">
                <Line className="w-28" />
              </span>
              <span className={cn(SKEL.kg, 'flex justify-end')}>
                <Line className="w-16" />
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** The whole body while nothing is read: the list, and the summary card from 1280. */
export function CatchesBodySkeleton() {
  return (
    <div className={BODY} aria-busy="true">
      <div className={LIST_COLUMN}>
        <CatchesListSkeleton />
      </div>
      <div aria-hidden className={SIDE}>
        <AsideSkeleton rows={4} />
      </div>
    </div>
  );
}
