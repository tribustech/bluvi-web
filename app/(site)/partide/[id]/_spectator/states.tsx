'use client';

import { DetailBackButton, DetailError, DetailNotFound } from '@/components/templates/T3';
import { Button } from '@/components/ui/Button';
import { routes } from '@/lib/routes';
import { MarkNotFound, SetBreadcrumb } from '../../../_shell/SiteHeader';

/*
 * The partidă's whole-page states (parity partide.spectator.c2, fish comunitate/[id].tsx
 * :291-323), on the T3 page-state card with the way out (back on the phone, the band from 768):
 *  - not found — unknown, deleted, or private (the CMS answers 404 for visibleOnProfile false and
 *    the page says no more than that: a private partidă never leaks, domain invariant 15).
 *    «Partida nu a fost găsită.» / «Poate a fost ștearsă sau nu mai este vizibilă.»; the way on is
 *    the Partide hub. MarkNotFound: no section highlighted, no breadcrumb band.
 *  - error — the read failed (network / 5xx; fish: the first-load error, never «was deleted» on a
 *    blip): «Nu am putut încărca partida.» / «Verifică conexiunea și reîncearcă.» + «Reîncearcă».
 */

export function SpectatorNotFound() {
  return (
    <div data-testid="partida-not-found">
      <MarkNotFound />
      <DetailNotFound
        back={<DetailBackButton fallbackHref={routes.partide()} ground="page" />}
        title="Partida nu a fost găsită."
        description="Poate a fost ștearsă sau nu mai este vizibilă."
        href={routes.partide()}
        cta="Vezi partidele"
      />
    </div>
  );
}

export function SpectatorError({ onRetry, retrying }: { onRetry: () => void; retrying: boolean }) {
  return (
    <div data-testid="partida-error">
      <SetBreadcrumb trail={[{ label: 'Partide', href: routes.partide() }, { label: 'Eroare' }]} />
      <DetailError
        back={<DetailBackButton fallbackHref={routes.partide()} ground="page" />}
        heading="Nu am putut încărca partida."
        description="Verifică conexiunea și reîncearcă."
        action={
          <Button aria-busy={retrying || undefined} aria-disabled={retrying || undefined} onClick={() => !retrying && onRetry()}>
            {retrying ? 'Se încarcă…' : 'Reîncearcă'}
          </Button>
        }
      />
    </div>
  );
}
