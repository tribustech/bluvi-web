'use client';

import { CloudIcon } from '@heroicons/react/24/outline';
import { DetailBand, DetailPage } from '@/components/templates/T3';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { PartidaHeader } from './PartidaHeader';

/*
 * The member view's whole-page states (fish app/(app)/partide/[id].tsx:433-492), each under the
 * compact header so the way back is always there:
 *  - preparing (c6): the pointer names this partidă but its first live snapshot has not landed —
 *    a spinner and «Se pregătește partida…», never a «not found» flash;
 *  - not found (c7): «Partida nu a fost găsită» / «Poate a fost ștearsă sau încă nu s-a sincronizat.»;
 *  - summary only (c8): the list row is known, the detail is downloading — the detail's skeleton;
 *  - download failed (c8): a cloud-off icon, «Nu am putut descărca partida», «Ai nevoie de
 *    conexiune pentru a descărca această partidă.» and «Reîncearcă» (invalidates the detail).
 */

function Frame({ name, children, testId }: { name: string; children: React.ReactNode; testId: string }) {
  return (
    <div data-testid={testId} className="contents">
      <DetailPage phoneGround="page">
        <DetailBand>
          <PartidaHeader name={name} />
        </DetailBand>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center md:py-24">{children}</div>
      </DetailPage>
    </div>
  );
}

export function PreparingState() {
  return (
    <Frame name="Partidă" testId="partida-preparing">
      <span aria-hidden className="size-9 animate-spin rounded-full border-3 border-accent-tint-2 border-t-accent" />
      <p role="status" className="t-body text-muted">
        Se pregătește partida…
      </p>
    </Frame>
  );
}

export function MemberNotFound() {
  return (
    <Frame name="Partidă" testId="partida-member-not-found">
      <h2 className="t-title2">Partida nu a fost găsită</h2>
      <p className="max-w-sm t-body text-muted">Poate a fost ștearsă sau încă nu s-a sincronizat.</p>
    </Frame>
  );
}

export function DownloadFailed({ name, retrying, onRetry }: { name: string; retrying: boolean; onRetry: () => void }) {
  return (
    <Frame name={name} testId="partida-download-failed">
      <CloudOffIcon />
      <h2 className="t-title2">Nu am putut descărca partida</h2>
      <p className="max-w-sm t-body text-muted">Ai nevoie de conexiune pentru a descărca această partidă.</p>
      <Button variant="success" className="mt-2" aria-busy={retrying || undefined} aria-disabled={retrying || undefined} onClick={() => !retrying && onRetry()}>
        {retrying ? 'Se încarcă…' : 'Reîncearcă'}
      </Button>
    </Frame>
  );
}

/** heroicons has no «cloud off»: the cloud with a stroke through it (fish CloudOffIcon). */
function CloudOffIcon() {
  return (
    <span aria-hidden className="relative block size-10 text-muted">
      <CloudIcon className="size-10" />
      <span className="absolute top-1/2 left-1/2 h-0.5 w-12 -translate-1/2 rotate-45 rounded-full bg-current ring-2 ring-page" />
    </span>
  );
}

const BONE = 'animate-shimmer';

/** fish OwnPartidaDetailSkeleton: the tab strip and the body as placeholders, under the real header. */
export function DetailSkeletonState({ name }: { name: string }) {
  return (
    <div data-testid="partida-detail-skeleton" aria-busy="true" className="contents">
      <p role="status" className="sr-only">
        Se încarcă partida…
      </p>
      <DetailPage phoneGround="page">
        <DetailBand>
          <PartidaHeader name={name} />
          <div aria-hidden className="flex gap-6 px-4 pb-3 md:px-6 xl:px-8">
            {['w-16', 'w-14', 'w-16', 'w-20', 'w-14'].map((w, i) => (
              <span key={i} className={cn('block h-4 rounded-full', w, BONE)} />
            ))}
          </div>
        </DetailBand>
        <div aria-hidden className="flex flex-col gap-2 pt-2 md:gap-4 md:px-6 md:pt-6 xl:grid xl:grid-cols-[minmax(0,1fr)_--spacing(90)] xl:gap-6 xl:px-8 xl:pt-8">
          <div className="flex flex-col gap-2 md:gap-4">
            <span className={cn('block h-28 md:rounded-card', BONE)} />
            <span className={cn('block h-64 md:rounded-card', BONE)} />
          </div>
          <span className={cn('block h-80 max-xl:hidden md:rounded-card', BONE)} />
        </div>
      </DetailPage>
    </div>
  );
}
