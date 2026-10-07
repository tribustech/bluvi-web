'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { canGoBackInApp } from '@/lib/client/in-app-history';
import { partideHrefs } from '@/lib/partide-pages';
import { routes } from '@/lib/routes';
import { COLUMN } from './layout';

/*
 * The capture page's whole-page states (fish captura.tsx:641-654): «Partida nu a fost găsită.» with
 * «Înapoi» (the viewer has no live partidă with this id — not a member, ended, or unknown), and the
 * skeleton while the session and the live snapshot load (owner rule 4: never a guess).
 */

export function CaptureNotFound({ documentId }: { documentId: string }) {
  const router = useRouter();
  const back = () => (canGoBackInApp() ? router.back() : router.replace(partideHrefs.partida(documentId) ?? routes.partide()));
  return (
    <div data-testid="capture-not-found" className="flex min-h-[60dvh] flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <p className="t-body-strong text-muted">Partida nu a fost găsită.</p>
      <button type="button" onClick={back} className="cursor-pointer rounded-control px-3 py-2 t-body-strong text-accent-ink hover:bg-soft-fill">
        Înapoi
      </button>
    </div>
  );
}

/**
 * The pointer names this partidă but its live snapshot never arrived (_member DownloadFailed's copy).
 * «Reîncearcă» reloads the page — a fresh pointer read and a fresh subscription; «Înapoi» leaves.
 */
export function CaptureDownloadFailed({ documentId }: { documentId: string }) {
  const router = useRouter();
  const back = () => (canGoBackInApp() ? router.back() : router.replace(partideHrefs.partida(documentId) ?? routes.partide()));
  return (
    <div data-testid="capture-download-failed" className="flex min-h-[60dvh] flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <h1 className="t-title2 text-ink">Nu am putut descărca partida</h1>
      <p className="max-w-sm t-body text-muted">Verifică conexiunea și încearcă din nou.</p>
      <div className="mt-2 flex flex-col items-center gap-1">
        <Button type="button" onClick={() => window.location.reload()}>
          Reîncearcă
        </Button>
        <button type="button" onClick={back} className="cursor-pointer rounded-control px-3 py-2 t-body-strong text-accent-ink hover:bg-soft-fill">
          Înapoi
        </button>
      </div>
    </div>
  );
}

const BONE = 'animate-shimmer';

/** The form's shape in grey under an indigo hero placeholder. */
export function CaptureSkeleton() {
  return (
    <div data-testid="capture-skeleton" aria-busy="true" className="flex flex-col">
      <p role="status" className="sr-only">
        Se încarcă…
      </p>
      <div aria-hidden className={cn(COLUMN, 'flex flex-col gap-4.5 pb-8')}>
        <div className="h-24 rounded-b-bento bg-accent md:h-28 md:rounded-bento" />
        <div className="flex flex-col gap-2.5 px-4 md:px-0">
          <span className={cn('h-3 w-24 rounded-full', BONE)} />
          <div className="flex gap-2">
            {['w-20', 'w-18', 'w-20', 'w-24'].map((w, i) => (
              <span key={i} className={cn('h-10 rounded-full', w, BONE)} />
            ))}
          </div>
          <span className={cn('mt-3 h-3 w-20 rounded-full', BONE)} />
          <span className={cn('h-20 rounded-card', BONE)} />
          <span className={cn('mt-3 h-3 w-16 rounded-full', BONE)} />
          <span className={cn('h-80 rounded-card', BONE)} />
        </div>
      </div>
    </div>
  );
}
